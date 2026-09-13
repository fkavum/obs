/**
 * Twitch adapter: chat over IRC, events over EventSub.
 *
 * Two sockets because Twitch splits them: IRC carries chat cheaply and without
 * per-message subscriptions, EventSub carries follows/subs/cheers/raids.
 * Either can drop and reconnect without disturbing the other.
 */
import { createReconnector } from '#core/backoff.js';
import { makeEvent } from '#core/index.js';
import { parseIRC, chatEvent, moderationEvent, eventSubEvent } from './normalize.js';

const IRC_URL = 'wss://irc-ws.chat.twitch.tv:443';
const EVENTSUB_URL = 'wss://eventsub.wss.twitch.tv/ws';
const HELIX = 'https://api.twitch.tv/helix';
const ID = 'https://id.twitch.tv/oauth2';

const SCOPES = [
  'chat:read',
  'moderator:read:followers',
  'channel:read:subscriptions',
  'bits:read',
];

/**
 * Twitch uses the Device Code flow: the operator presses Connect, gets a short
 * code, and types it on twitch.tv/activate.
 *
 * Why this rather than the usual redirect flow:
 *   - it is a PUBLIC client, so there is no client secret to hold. A local-first
 *     tool has no server to keep a secret on, and a secret shipped inside an app
 *     is not a secret;
 *   - there is no redirect URL, so the whole class of "registered URL doesn't
 *     match" failures disappears, and changing the port can't break logins;
 *   - with a client id shipped in the manifest, Connect is genuinely one click.
 */
export const oauth = {
  mode: 'device',
  needs: ['clientId'],
  setupUrl: 'https://dev.twitch.tv/console/apps/create',

  /** Ask Twitch for a code pair. */
  async startDevice({ clientId }) {
    const res = await fetch(`${ID}/device`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, scopes: SCOPES.join(' ') }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.message || `Twitch would not start the login (${res.status})`);
    return {
      deviceCode: json.device_code,
      userCode: json.user_code,
      verificationUri: json.verification_uri,
      intervalMs: (json.interval || 5) * 1000,
      expiresAt: Date.now() + (json.expires_in || 1800) * 1000,
    };
  },

  /**
   * One poll. Returns null while the operator hasn't finished on twitch.tv yet;
   * the shared auth layer keeps calling until it gets tokens or the code expires.
   */
  async pollDevice({ clientId, deviceCode }) {
    const res = await fetch(`${ID}/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        scopes: SCOPES.join(' '),
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });
    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      const message = String(json.message || '');
      // Expected while the operator is still typing the code on twitch.tv.
      if (/authorization_pending/i.test(message)) return null;
      if (/slow_?down/i.test(message)) return null;
      throw new Error(message || `Twitch rejected the login (${res.status})`);
    }

    const tokens = {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresAt: Date.now() + (json.expires_in || 14400) * 1000,
    };
    const me = await helixUser(clientId, tokens.accessToken);
    return { ...tokens, userId: me.id, login: me.login, displayName: me.display_name };
  },

  /** Public clients refresh with the client id alone -- no secret involved. */
  async refresh({ clientId, refreshToken }) {
    const res = await fetch(`${ID}/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.message || `could not refresh the Twitch login (${res.status})`);
    return {
      accessToken: json.access_token,
      // Twitch refresh tokens are single use: always store the new one.
      refreshToken: json.refresh_token || refreshToken,
      expiresAt: Date.now() + (json.expires_in || 14400) * 1000,
    };
  },
};

async function helixUser(clientId, accessToken) {
  const res = await fetch(`${HELIX}/users`, {
    headers: { 'client-id': clientId, authorization: `Bearer ${accessToken}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.data?.length) throw new Error(json.message || 'Could not read your Twitch account');
  return json.data[0];
}

export function createAdapter({ config, emit, log }) {
  const channel = (config.channel || config.login || '').toLowerCase().replace(/^#/, '');
  // Reading chat needs no account at all. Signing in only adds the things that
  // genuinely require permission: follows, subs, cheers, raids, viewer counts.
  const signedIn = !!config.accessToken;
  let irc = null;
  let eventsub = null;
  let sessionId = null;
  let ircReady = false;
  let esReady = false;
  let stopped = false;
  let keepaliveTimer = null;

  const ircConn = createReconnector({ label: 'twitch chat', log, connect: connectIRC });
  const esConn = createReconnector({ label: 'twitch events', log, connect: connectEventSub });

  // ---- chat (IRC) -------------------------------------------------------
  async function connectIRC() {
    if (stopped) return;
    await new Promise((resolve, reject) => {
      const socket = new WebSocket(IRC_URL);
      irc = socket;
      let settled = false;
      const fail = (err) => {
        if (settled) return;
        settled = true;
        reject(err);
      };

      const timeout = setTimeout(() => {
        fail(new Error('timed out connecting to chat'));
        socket.close();
      }, 15000);

      socket.onopen = () => {
        socket.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
        if (signedIn) {
          socket.send(`PASS oauth:${config.accessToken}`);
          socket.send(`NICK ${config.login || 'justinfan12345'}`);
        } else {
          // Anonymous read-only login. Any justinfan<number> nick works and no
          // PASS is sent; tags still arrive, so nothing is lost for chat.
          socket.send(`NICK justinfan${Math.floor(Math.random() * 90000 + 10000)}`);
        }
        socket.send(`JOIN #${channel}`);
      };

      socket.onmessage = (event) => {
        for (const line of String(event.data).split('\r\n')) {
          const msg = parseIRC(line);
          if (!msg) continue;
          handleIRC(msg);
          if (msg.command === '366' && !settled) {
            // End of names list: the join actually succeeded.
            settled = true;
            clearTimeout(timeout);
            ircReady = true;
            log.info(`chat connected to #${channel}`);
            resolve();
          }
          if (msg.command === 'NOTICE' && /login authentication failed/i.test(msg.params[1] || '')) {
            fail(new Error('Twitch rejected the login token'));
          }
        }
      };

      socket.onerror = () => fail(new Error('chat socket error'));
      socket.onclose = () => {
        clearTimeout(timeout);
        ircReady = false;
        irc = null;
        if (settled && !stopped) ircConn.retry('chat disconnected');
        else fail(new Error('chat closed before joining'));
      };
    });
  }

  function handleIRC(msg) {
    switch (msg.command) {
      case 'PING':
        irc?.send(`PONG :${msg.params[0] || 'tmi.twitch.tv'}`);
        return;
      case 'PRIVMSG':
        emit(chatEvent(msg, channel));
        return;
      case 'CLEARCHAT':
      case 'CLEARMSG':
        emit(moderationEvent(msg, channel));
        return;
      case 'RECONNECT':
        log.info('Twitch asked us to reconnect chat');
        irc?.close();
        return;
      default:
    }
  }

  // ---- events (EventSub) ------------------------------------------------
  async function connectEventSub() {
    if (stopped || !config.userId) return;
    await new Promise((resolve, reject) => {
      const socket = new WebSocket(EVENTSUB_URL);
      eventsub = socket;
      let settled = false;

      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error('timed out connecting to events'));
          socket.close();
        }
      }, 15000);

      socket.onmessage = async (raw) => {
        let msg;
        try {
          msg = JSON.parse(raw.data);
        } catch {
          return;
        }
        const type = msg.metadata?.message_type;

        if (type === 'session_welcome') {
          sessionId = msg.payload.session.id;
          resetKeepalive(msg.payload.session.keepalive_timeout_seconds);
          try {
            await subscribeAll();
            esReady = true;
            log.info('events connected');
          } catch (err) {
            // Missing scopes shouldn't kill chat -- report and carry on.
            log.warn(`could not subscribe to all events: ${err.message}`);
          }
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            resolve();
          }
        } else if (type === 'session_keepalive') {
          resetKeepalive();
        } else if (type === 'notification') {
          resetKeepalive();
          const event = eventSubEvent(msg.metadata.subscription_type, msg.payload.event, channel);
          if (event) emit(event);
        } else if (type === 'session_reconnect') {
          // Twitch is migrating us; it sends a new URL and keeps the old socket
          // alive briefly. Simplest correct response is a clean reconnect.
          socket.close();
        } else if (type === 'revocation') {
          log.warn(`subscription revoked: ${msg.payload.subscription?.type} (${msg.payload.subscription?.status})`);
        }
      };

      socket.onerror = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          reject(new Error('events socket error'));
        }
      };
      socket.onclose = () => {
        esReady = false;
        eventsub = null;
        clearTimeout(keepaliveTimer);
        if (settled && !stopped) esConn.retry('events disconnected');
      };
    });
  }

  function resetKeepalive(seconds = 30) {
    clearTimeout(keepaliveTimer);
    // No keepalive within the window means the socket is dead but not closed.
    keepaliveTimer = setTimeout(() => {
      log.warn('no keepalive from events socket; reconnecting');
      eventsub?.close();
    }, (seconds + 10) * 1000);
    keepaliveTimer.unref?.();
  }

  async function subscribeAll() {
    const broadcaster = String(config.userId);
    const wanted = [
      ['channel.follow', '2', { broadcaster_user_id: broadcaster, moderator_user_id: broadcaster }],
      ['channel.subscribe', '1', { broadcaster_user_id: broadcaster }],
      ['channel.subscription.message', '1', { broadcaster_user_id: broadcaster }],
      ['channel.subscription.gift', '1', { broadcaster_user_id: broadcaster }],
      ['channel.cheer', '1', { broadcaster_user_id: broadcaster }],
      ['channel.raid', '1', { to_broadcaster_user_id: broadcaster }],
    ];

    const failures = [];
    for (const [type, version, condition] of wanted) {
      const res = await fetch(`${HELIX}/eventsub/subscriptions`, {
        method: 'POST',
        headers: {
          'client-id': config.clientId,
          authorization: `Bearer ${config.accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ type, version, condition, transport: { method: 'websocket', session_id: sessionId } }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        failures.push(`${type} (${body.message || res.status})`);
      }
    }
    if (failures.length) throw new Error(failures.join('; '));
  }

  // ---- viewer count -----------------------------------------------------
  let viewerTimer = null;
  async function pollViewers() {
    if (!config.userId || !config.accessToken) return;
    try {
      const res = await fetch(`${HELIX}/streams?user_id=${config.userId}`, {
        headers: { 'client-id': config.clientId, authorization: `Bearer ${config.accessToken}` },
      });
      if (!res.ok) return;
      const json = await res.json();
      const stream = json.data?.[0];
      emit(makeEvent({
        type: 'viewers',
        platform: 'twitch',
        channel,
        data: { count: stream?.viewer_count ?? 0 },
      }));
      emit(makeEvent({
        type: 'stream.state',
        platform: 'twitch',
        channel,
        data: { live: !!stream, title: stream?.title || '', category: stream?.game_name || '' },
      }));
    } catch (err) {
      log.debug(`viewer poll failed: ${err.message}`);
    }
  }

  return {
    async start() {
      if (!channel) throw new Error('no channel name set');
      stopped = false;
      await ircConn.start();
      if (signedIn) {
        esConn.start(); // events are a bonus; chat must not wait on them
        pollViewers();
        viewerTimer = setInterval(pollViewers, 60000);
        viewerTimer.unref?.();
      }
    },

    async stop() {
      stopped = true;
      ircConn.stop();
      esConn.stop();
      clearInterval(viewerTimer);
      clearTimeout(keepaliveTimer);
      try { irc?.close(); } catch { /* already gone */ }
      try { eventsub?.close(); } catch { /* already gone */ }
      irc = eventsub = null;
      ircReady = esReady = false;
    },

    health() {
      if (!channel) return { connected: false, detail: 'no channel name set' };
      if (!ircReady) return { connected: false, detail: 'connecting…', signedIn };
      if (!signedIn) {
        return {
          connected: true,
          detail: `chat — #${channel} (not signed in)`,
          // Not an error: chat is working. Signing in only adds alerts.
          canSignIn: true,
          signedIn: false,
        };
      }
      const bits = ['chat', esReady ? 'alerts' : null].filter(Boolean);
      return { connected: true, detail: `${bits.join(' + ')} — #${channel}`, signedIn: true };
    },
  };
}
