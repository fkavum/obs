/**
 * YouTube Live adapter.
 *
 * YouTube is the highest-maintenance of the three platforms and the one that can
 * silently die mid-stream, so the design is built around its constraints:
 *
 *   - Live chat is POLLED, not pushed, and each poll costs API quota (a default
 *     project gets 10,000 units/day; a chat poll costs 5). Polling every 5s all
 *     day exhausts the budget in under three hours.
 *   - The chat id changes with every broadcast, so it has to be rediscovered.
 *
 * So: honour the interval YouTube itself asks for, slow down when chat is quiet,
 * and surface remaining budget on the status screen instead of just stopping.
 */
import { makeEvent } from '#core/index.js';

const OAUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN = 'https://oauth2.googleapis.com/token';
const API = 'https://www.googleapis.com/youtube/v3';

const SCOPES = ['https://www.googleapis.com/auth/youtube.readonly'];

// Documented quota costs, used for budgeting.
const COST = { liveBroadcasts: 1, liveChatMessages: 5, videos: 1 };

export const oauth = {
  needs: ['clientId', 'clientSecret'],
  setupUrl: 'https://console.cloud.google.com/apis/credentials',

  authorizeUrl({ clientId, redirectUri, state }) {
    const p = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPES.join(' '),
      state,
      access_type: 'offline',   // we need a refresh token
      prompt: 'consent',        // without this Google omits it on re-auth
      include_granted_scopes: 'true',
    });
    return `${OAUTH}?${p}`;
  },

  async exchange({ clientId, clientSecret, code, redirectUri }) {
    return tokenRequest(new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }));
  },

  async refresh({ clientId, clientSecret, refreshToken }) {
    const tokens = await tokenRequest(new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }));
    // Google omits the refresh token on refresh; keep the one we have.
    return { ...tokens, refreshToken: tokens.refreshToken || refreshToken };
  },
};

async function tokenRequest(body) {
  const res = await fetch(TOKEN, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error_description || json.error || `Google rejected the login (${res.status})`);
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + (json.expires_in || 3600) * 1000,
  };
}

/** Quota resets at midnight US Pacific. Track spend against that day. */
function pacificDayKey(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function createAdapter({ config, emit, log, saveConfig }) {
  const budget = config.dailyQuota || 10000;
  // Leave room for the rest of the project's API use.
  const reserve = config.quotaReserve ?? 500;

  let spent = config.quotaSpent && config.quotaDay === pacificDayKey() ? config.quotaSpent : 0;
  let quotaDay = pacificDayKey();
  let liveChatId = null;
  let pageToken = null;
  let pollTimer = null;
  let stopped = false;
  let connected = false;
  let idleStreak = 0;
  let lastError = null;
  let broadcastTitle = '';

  function spend(units) {
    const today = pacificDayKey();
    if (today !== quotaDay) {
      quotaDay = today;
      spent = 0;
      log.info('daily quota reset');
    }
    spent += units;
    // Persist so a restart doesn't forget what today already cost.
    saveConfig?.({ quotaSpent: spent, quotaDay });
  }

  const remaining = () => Math.max(0, budget - reserve - spent);

  async function call(path, params, cost) {
    if (remaining() <= 0) throw new Error('daily YouTube quota used up');
    const url = `${API}/${path}?${new URLSearchParams(params)}`;
    const res = await fetch(url, { headers: { authorization: `Bearer ${config.accessToken}` } });
    spend(cost);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const reason = json.error?.errors?.[0]?.reason || '';
      if (reason === 'quotaExceeded' || reason === 'rateLimitExceeded') {
        throw Object.assign(new Error('YouTube quota exceeded for today'), { quota: true });
      }
      if (res.status === 401) throw Object.assign(new Error('YouTube login expired'), { auth: true });
      throw new Error(json.error?.message || `YouTube API error ${res.status}`);
    }
    return json;
  }

  /** Find the currently active broadcast and its chat id. */
  async function findLiveChat() {
    const json = await call('liveBroadcasts', {
      part: 'snippet,status',
      broadcastStatus: 'active',
      broadcastType: 'all',
      mine: 'true',
      maxResults: '1',
    }, COST.liveBroadcasts);

    const item = json.items?.[0];
    if (!item) return null;
    broadcastTitle = item.snippet?.title || '';
    emit(makeEvent({
      type: 'stream.state',
      platform: 'youtube',
      channel: item.snippet?.channelId || '',
      data: { live: true, title: broadcastTitle, category: '' },
    }));
    return item.snippet?.liveChatId || null;
  }

  async function tick() {
    if (stopped) return;
    let nextDelay = 10000;

    try {
      if (!liveChatId) {
        liveChatId = await findLiveChat();
        if (!liveChatId) {
          connected = false;
          lastError = null;
          // Not live: check back occasionally. 1 unit a minute is affordable.
          return schedule(60000);
        }
        pageToken = null;
        log.info(`found live chat for "${broadcastTitle}"`);
      }

      const json = await call('liveChatMessages', {
        liveChatId,
        part: 'snippet,authorDetails',
        maxResults: '200',
        ...(pageToken ? { pageToken } : {}),
      }, COST.liveChatMessages);

      connected = true;
      lastError = null;
      pageToken = json.nextPageToken || null;

      const items = json.items || [];
      // On the first poll we only take the tail: the API replays backlog, and
      // dumping 200 old messages onto the overlay at once looks broken.
      const fresh = idleStreak === 0 && !pageToken ? items.slice(-10) : items;
      for (const item of fresh) {
        const event = toEvent(item);
        if (event) emit(event);
      }

      idleStreak = items.length ? 0 : Math.min(idleStreak + 1, 6);

      // YouTube tells us its own minimum; never poll faster than that.
      const apiMin = Number(json.pollingIntervalMillis) || 5000;
      nextDelay = Math.max(apiMin, pacedInterval());
    } catch (err) {
      connected = false;
      lastError = err.message;
      if (err.quota) {
        log.warn('quota exhausted; pausing YouTube until it resets');
        return schedule(30 * 60 * 1000);
      }
      if (err.auth) {
        log.warn('login expired; waiting for the automatic refresh');
        return schedule(60000);
      }
      // A finished broadcast returns 403/404 on its chat id: go find a new one.
      liveChatId = null;
      log.warn(`poll failed: ${err.message}`);
      nextDelay = 30000;
    }

    schedule(nextDelay);
  }

  /**
   * Pace polling against the remaining budget so an 8-hour stream doesn't run dry
   * at hour three. Quiet chat is polled more slowly than busy chat.
   */
  function pacedInterval() {
    const hoursLeftToday = hoursUntilPacificMidnight();
    const pollsAffordable = remaining() / COST.liveChatMessages;
    if (pollsAffordable <= 0) return 30 * 60 * 1000;
    const evenPace = (hoursLeftToday * 3600 * 1000) / pollsAffordable;
    // Idle chat backs off up to 4x; busy chat stays at the API minimum.
    const idleFactor = 1 + idleStreak * 0.5;
    return Math.min(60000, Math.max(5000, evenPace * idleFactor));
  }

  function schedule(ms) {
    clearTimeout(pollTimer);
    if (stopped) return;
    pollTimer = setTimeout(tick, ms);
    pollTimer.unref?.();
  }

  return {
    async start() {
      stopped = false;
      idleStreak = 0;
      // No token yet is not a failure to start - it's a platform waiting for its
      // one-time sign-in. health() explains that; polling begins once it exists.
      if (!config.accessToken) return;
      await tick();
    },

    async stop() {
      stopped = true;
      clearTimeout(pollTimer);
      connected = false;
      liveChatId = null;
    },

    health() {
      if (!config.accessToken) {
        return {
          connected: false,
          detail: 'YouTube needs you to sign in before it will show chat (Google\u2019s rule)',
          needsLogin: true,
        };
      }
      const pct = Math.round((remaining() / Math.max(1, budget - reserve)) * 100);
      if (lastError) return { connected: false, detail: `${lastError} — quota ${pct}% left` };
      if (!liveChatId) return { connected: false, detail: `waiting for you to go live — quota ${pct}% left` };
      return { connected, detail: `live chat — quota ${pct}% left today` };
    },
  };
}

function hoursUntilPacificMidnight() {
  const now = new Date();
  const pacificHour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', hour12: false }).format(now));
  return Math.max(0.5, 24 - pacificHour);
}

/** One liveChatMessages item -> normalized event. */
function toEvent(item) {
  const snippet = item.snippet || {};
  const author = item.authorDetails || {};
  const user = {
    id: author.channelId || '',
    name: (author.displayName || '').toLowerCase(),
    displayName: author.displayName || '',
    avatar: author.profileImageUrl || null,
    roles: [
      author.isChatOwner ? 'broadcaster' : null,
      author.isChatModerator ? 'moderator' : null,
      author.isChatSponsor ? 'subscriber' : null,
      author.isVerified ? 'verified' : null,
    ].filter(Boolean),
    color: null,
  };
  const base = { platform: 'youtube', channel: snippet.liveChatId || '', user, ts: Date.parse(snippet.publishedAt) || Date.now(), id: item.id };

  switch (snippet.type) {
    case 'textMessageEvent': {
      const text = snippet.textMessageDetails?.messageText || '';
      return makeEvent({ ...base, type: 'chat', data: { text, fragments: [{ type: 'text', text }] } });
    }
    case 'superChatEvent': {
      const d = snippet.superChatDetails || {};
      return makeEvent({ ...base, type: 'donation', data: { amount: Number(d.amountMicros || 0) / 1e6, currency: d.currency || '', message: d.userComment || '' } });
    }
    case 'superStickerEvent': {
      const d = snippet.superStickerDetails || {};
      return makeEvent({ ...base, type: 'donation', data: { amount: Number(d.amountMicros || 0) / 1e6, currency: d.currency || '', message: '' } });
    }
    case 'newSponsorEvent':
      return makeEvent({ ...base, type: 'subscription', data: { tier: '1', months: 1, isGift: false } });
    case 'memberMilestoneChatEvent': {
      const d = snippet.memberMilestoneChatDetails || {};
      return makeEvent({ ...base, type: 'subscription', data: { tier: '1', months: d.memberMonth || 1, isGift: false, message: d.userComment || '' } });
    }
    case 'messageDeletedEvent':
      return makeEvent({ ...base, type: 'chat.delete', data: { messageId: snippet.messageDeletedDetails?.deletedMessageId || '' } });
    default:
      return null;
  }
}
