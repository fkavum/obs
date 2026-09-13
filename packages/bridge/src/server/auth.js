/**
 * Shared OAuth plumbing.
 *
 * Adapters supply only the platform-specific bits (authorize URL, token exchange,
 * refresh). State handling, storage, the browser callback page and the background
 * refresh timer live here once, so each new platform inherits them -- that is a
 * direct maintenance saving, and why "log in once, ever" is achievable.
 */
import { randomBytes } from 'node:crypto';
import { createLogger } from '#core/index.js';
import { setPlatformConfig } from '../config.js';

const log = createLogger('auth');
const pending = new Map(); // state -> { platformId, createdAt }
const STATE_TTL_MS = 10 * 60 * 1000;

export function redirectUriFor(config, platformId) {
  const { httpPort } = config.bridge;
  // Platforms accept http:// redirects only for localhost, so always use that name.
  return `http://localhost:${httpPort}/auth/${platformId}/callback`;
}

export function beginAuth(hub, config, platformId) {
  const entry = hub.platforms.get(platformId);
  if (!entry) throw new Error(`unknown platform: ${platformId}`);
  const oauth = entry.oauth;
  if (!oauth?.authorizeUrl) throw new Error(`${platformId} does not use a login`);

  const saved = config.platforms[platformId] || {};
  for (const field of oauth.needs || []) {
    if (!saved[field]) throw new Error(`missing ${field}`);
  }

  const state = randomBytes(16).toString('hex');
  sweepStates();

  // An adapter may need to remember something between the redirect out and the
  // callback back (PKCE verifiers, for instance). It returns { url, stash } and
  // we hand the stash back to exchange() -- it never touches disk or the browser.
  const result = oauth.authorizeUrl({
    ...saved,
    redirectUri: redirectUriFor(config, platformId),
    state,
  });
  const url = typeof result === 'string' ? result : result.url;
  const stash = typeof result === 'string' ? {} : result.stash || {};
  pending.set(state, { platformId, createdAt: Date.now(), stash });
  return url;
}

export async function completeAuth(hub, config, platformId, query) {
  const state = query.get('state');
  const record = pending.get(state);
  if (!record || record.platformId !== platformId) {
    throw new Error('This login link has expired. Go back and press Connect again.');
  }
  pending.delete(state);

  if (query.get('error')) {
    throw new Error(query.get('error_description') || query.get('error'));
  }
  const code = query.get('code');
  if (!code) throw new Error('The platform did not send back a login code.');

  const entry = hub.platforms.get(platformId);
  const oauth = entry.oauth;
  const tokens = await oauth.exchange({
    ...(config.platforms[platformId] || {}),
    ...record.stash,
    code,
    redirectUri: redirectUriFor(config, platformId),
  });

  setPlatformConfig(config, platformId, {
    ...tokens,
    connectedAt: Date.now(),
    enabled: true,
  });
  log.info(`${platformId}: connected`);

  await hub.stopPlatform(platformId);
  await hub.startPlatform(platformId);
  return true;
}

/**
 * Refresh any token nearing expiry. Runs on a timer so the operator never has to
 * think about tokens after the first login.
 */
export async function refreshExpiring(hub, config, { windowMs = 15 * 60 * 1000 } = {}) {
  for (const [id, entry] of hub.platforms) {
    const oauth = entry.oauth;
    const saved = config.platforms[id];
    if (!oauth?.refresh || !saved?.refreshToken || !saved.expiresAt) continue;
    if (saved.expiresAt - Date.now() > windowMs) continue;

    try {
      const tokens = await oauth.refresh({ ...saved });
      setPlatformConfig(config, id, tokens);
      log.info(`${id}: token refreshed`);
    } catch (err) {
      // Don't wipe credentials on a transient failure -- the status screen will
      // say a re-login is needed only once the token is actually dead.
      log.warn(`${id}: token refresh failed (${err.message})`);
    }
  }
}

/** The page the platform redirects back to. Written for a non-technical reader. */
export function callbackPage({ ok, platform, message }) {
  const title = ok ? `${platform} connected` : `${platform} could not connect`;
  const icon = ok ? '&#10003;' : '!';
  return `<!doctype html><meta charset="utf-8"><title>${title}</title>
<style>
  :root { color-scheme: dark }
  body { margin:0; min-height:100vh; display:grid; place-items:center;
         font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;
         background:#0e0e14; color:#f3f3f7 }
  .card { text-align:center; padding:40px 48px; background:#1a1a24;
          border:1px solid #2a2a38; border-radius:18px; max-width:420px }
  .mark { width:56px; height:56px; margin:0 auto 20px; border-radius:50%;
          display:grid; place-items:center; font-size:28px; font-weight:700;
          background:${ok ? '#1f7a4d' : '#7a2f2f'} }
  h1 { font-size:20px; margin:0 0 10px }
  p { margin:0; color:#a9a9bb }
  .hint { margin-top:22px; font-size:14px; color:#7a7a90 }
</style>
<div class="card">
  <div class="mark">${icon}</div>
  <h1>${title}</h1>
  <p>${escapeHtml(message)}</p>
  <p class="hint">You can close this tab and go back to the toolkit.</p>
</div>
${ok ? '<script>setTimeout(()=>window.close(),2500)</script>' : ''}`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function sweepStates() {
  const cutoff = Date.now() - STATE_TTL_MS;
  for (const [state, rec] of pending) if (rec.createdAt < cutoff) pending.delete(state);
}
