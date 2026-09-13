/**
 * Kick adapter.
 *
 * Kick's official API covers login and channel info, but its event delivery is
 * webhook-based, which needs a public HTTPS URL -- impossible for a local-first
 * tool without a tunnel. So chat comes from Kick's realtime socket instead.
 *
 * That socket is the least stable surface the toolkit touches, which is exactly
 * why 100% of it lives in this folder: if Kick changes it, nothing outside this
 * directory needs editing, and the other platforms are unaffected.
 */
import { createHash, randomBytes } from 'node:crypto';
import { createReconnector } from '#core/backoff.js';
import { makeEvent, buildFragments } from '#core/index.js';

const ID = 'https://id.kick.com/oauth';
const API = 'https://api.kick.com/public/v1';
const WEB_API = 'https://kick.com/api/v2';
const PUSHER_KEY = '32cbd69e4b950bf97679';
const PUSHER_URL = `wss://ws-us2.pusher.com/app/${PUSHER_KEY}?protocol=7&client=js&version=8.4.0&flash=false`;

const SCOPES = ['user:read', 'channel:read', 'chat:write', 'events:subscribe'];

export const oauth = {
  needs: ['clientId', 'clientSecret'],
  setupUrl: 'https://kick.com/settings/developer',

  authorizeUrl({ clientId, redirectUri, state }) {
    // Kick uses OAuth 2.1, so PKCE is required rather than optional.
    const verifier = base64url(randomBytes(48));
    const challenge = base64url(createHash('sha256').update(verifier).digest());
    const p = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: SCOPES.join(' '),
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });
    return { url: `${ID}/authorize?${p}`, stash: { codeVerifier: verifier } };
  },

  async exchange({ clientId, clientSecret, code, redirectUri, codeVerifier }) {
    return tokenRequest(new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }));
  },

  async refresh({ clientId, clientSecret, refreshToken }) {
    return tokenRequest(new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }));
  },
};

async function tokenRequest(body) {
  const res = await fetch(`${ID}/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error_description || json.message || `Kick rejected the login (${res.status})`);
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + (json.expires_in || 7200) * 1000,
  };
}

const base64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export function createAdapter({ config, emit, log, saveConfig }) {
  const slug = (config.channel || '').toLowerCase().trim();
  let socket = null;
  let chatroomId = config.chatroomId || null;
  let connected = false;
  let stopped = false;
  let pingTimer = null;
  let viewerTimer = null;

  const conn = createReconnector({ label: 'kick chat', log, connect: connectChat });

  /**
   * The realtime socket is keyed by chatroom id, which the public API doesn't
   * expose, so it comes from the site API. That endpoint sits behind bot
   * protection and can refuse us; when it does we say so in plain words rather
   * than retrying forever.
   */
  async function resolveChatroom() {
    if (chatroomId) return chatroomId;
    const res = await fetch(`${WEB_API}/channels/${encodeURIComponent(slug)}`, {
      headers: {
        accept: 'application/json',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
        'accept-language': 'en-US,en;q=0.9',
      },
    });
    if (res.status === 403 || res.status === 429) {
      throw new Error('Kick blocked the lookup for this channel; try again in a few minutes');
    }
    if (res.status === 404) throw new Error(`no Kick channel called "${slug}"`);
    if (!res.ok) throw new Error(`Kick channel lookup failed (${res.status})`);

    const json = await res.json();
    chatroomId = json?.chatroom?.id;
    if (!chatroomId) throw new Error('Kick did not return a chatroom for this channel');
    saveConfig?.({ chatroomId, channelId: json.id });
    log.info(`resolved chatroom ${chatroomId} for ${slug}`);
    return chatroomId;
  }

  async function connectChat() {
    if (stopped) return;
    const room = await resolveChatroom();

    await new Promise((resolve, reject) => {
      const ws = new WebSocket(PUSHER_URL);
      socket = ws;
      let settled = false;
      const fail = (err) => {
        if (!settled) {
          settled = true;
          reject(err);
        }
      };
      const timeout = setTimeout(() => {
        fail(new Error('timed out connecting to Kick chat'));
        ws.close();
      }, 15000);

      ws.onmessage = (raw) => {
        let msg;
        try {
          msg = JSON.parse(raw.data);
        } catch {
          return;
        }

        if (msg.event === 'pusher:connection_established') {
          ws.send(JSON.stringify({ event: 'pusher:subscribe', data: { auth: '', channel: `chatrooms.${room}.v2` } }));
          return;
        }
        if (msg.event === 'pusher_internal:subscription_succeeded') {
          clearTimeout(timeout);
          connected = true;
          settled = true;
          log.info(`chat connected to ${slug}`);
          resolve();
          return;
        }
        if (msg.event === 'pusher:error') {
          fail(new Error(msg.data?.message || 'Kick socket refused the subscription'));
          return;
        }
        if (msg.event?.endsWith('ChatMessageEvent')) {
          const event = toChatEvent(msg.data, slug);
          if (event) emit(event);
        }
      };

      ws.onerror = () => fail(new Error('Kick socket error'));
      ws.onclose = () => {
        clearTimeout(timeout);
        clearInterval(pingTimer);
        connected = false;
        socket = null;
        if (settled && !stopped) conn.retry('Kick chat disconnected');
        else fail(new Error('Kick socket closed before subscribing'));
      };

      // Pusher drops idle connections; a periodic ping keeps it alive.
      pingTimer = setInterval(() => {
        if (ws.readyState === 1) ws.send(JSON.stringify({ event: 'pusher:ping', data: {} }));
      }, 60000);
      pingTimer.unref?.();
    });
  }

  async function pollViewers() {
    if (!config.accessToken || !slug) return;
    try {
      const res = await fetch(`${API}/channels?slug=${encodeURIComponent(slug)}`, {
        headers: { authorization: `Bearer ${config.accessToken}`, accept: 'application/json' },
      });
      if (!res.ok) return;
      const json = await res.json();
      const ch = json.data?.[0];
      if (!ch) return;
      emit(makeEvent({ type: 'viewers', platform: 'kick', channel: slug, data: { count: ch.stream?.viewer_count ?? 0 } }));
      emit(makeEvent({
        type: 'stream.state',
        platform: 'kick',
        channel: slug,
        data: { live: !!ch.stream?.is_live, title: ch.stream_title || '', category: ch.category?.name || '' },
      }));
    } catch (err) {
      log.debug(`viewer poll failed: ${err.message}`);
    }
  }

  return {
    async start() {
      if (!slug) throw new Error('no Kick channel name set');
      stopped = false;
      await conn.start();
      if (config.accessToken) {
        pollViewers();
        viewerTimer = setInterval(pollViewers, 60000);
        viewerTimer.unref?.();
      }
    },

    async stop() {
      stopped = true;
      conn.stop();
      clearInterval(pingTimer);
      clearInterval(viewerTimer);
      try { socket?.close(); } catch { /* already gone */ }
      socket = null;
      connected = false;
    },

    health() {
      if (!slug) return { connected: false, detail: 'no channel name set' };
      if (!connected) return { connected: false, detail: 'connecting…', signedIn: !!config.accessToken };
      // Kick chat needs no login at all; signing in only adds viewer counts.
      if (!config.accessToken) {
        return { connected: true, detail: `chat — ${slug} (not signed in)`, canSignIn: true, signedIn: false };
      }
      return { connected: true, detail: `chat + viewers — ${slug}`, signedIn: true };
    },
  };
}

/** Kick chat payload -> normalized event. */
function toChatEvent(data, channel) {
  if (!data?.content) return null;
  const sender = data.sender || {};
  const badges = sender.identity?.badges || [];
  const roles = [];
  for (const badge of badges) {
    if (badge.type === 'moderator') roles.push('moderator');
    else if (badge.type === 'subscriber' || badge.type === 'founder') roles.push('subscriber');
    else if (badge.type === 'vip') roles.push('vip');
    else if (badge.type === 'broadcaster') roles.push('broadcaster');
    else if (badge.type === 'verified') roles.push('verified');
  }

  const { text, emotes } = extractEmotes(data.content);

  return makeEvent({
    id: data.id,
    type: 'chat',
    platform: 'kick',
    channel,
    ts: data.created_at ? Date.parse(data.created_at) || Date.now() : Date.now(),
    user: {
      id: String(sender.id ?? ''),
      name: sender.slug || sender.username || '',
      displayName: sender.username || sender.slug || '',
      roles,
      color: sender.identity?.color || null,
    },
    data: { text, fragments: buildFragments(text, emotes) },
  });
}

/** Kick inlines emotes as [emote:ID:name]; pull them out into fragments. */
function extractEmotes(raw) {
  const pattern = /\[emote:(\d+):([^\]]*)\]/g;
  let text = '';
  const emotes = [];
  let last = 0;
  let match;

  while ((match = pattern.exec(raw)) !== null) {
    text += raw.slice(last, match.index);
    const name = match[2] || '';
    const start = [...text].length;
    text += name;
    emotes.push({
      id: match[1],
      name,
      start,
      end: start + [...name].length - 1,
      url: `https://files.kick.com/emotes/${match[1]}/fullsize`,
    });
    last = match.index + match[0].length;
  }
  text += raw.slice(last);
  return { text, emotes };
}
