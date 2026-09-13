/**
 * Unified chat overlay.
 *
 * Reads every visual setting from the URL, subscribes to the bridge, renders.
 * Two rules it must never break:
 *   - when the bridge is down it shows nothing (never an error box on stream);
 *   - platform colours and icons come from the bridge's manifests, never from a
 *     hardcoded map, so a newly added platform renders correctly with no edit here.
 */
import { parseSettings } from '/core/settings-schema.js';
import { startPreviewFeed } from '/core/preview-feed.js';

const settings = parseSettings(location.search);
const root = document.getElementById('chat');

/** platform id -> { color, icon, label } from GET /api/platforms */
let platforms = new Map();
const seen = new Map(); // dedupe: text -> { el, count }
let queueTail = Promise.resolve();

applyStaticStyles();
main();

async function main() {
  await loadPlatforms();
  if (settings.preview) {
    // Local feed: preview works even with no bridge running.
    startPreviewFeed(onEvent, { platforms: [...platforms.keys()].filter((p) => p !== 'fake') });
    return;
  }
  connect();
}

// ---------------------------------------------------------------- styling

function applyStaticStyles() {
  const s = settings;
  const k = s.scale / 100;
  const px = (n) => `${Math.round(n * k * 100) / 100}px`;

  root.dataset.layout = s.layout;
  root.dataset.anchor = s.anchor;
  root.dataset.flow = s.flow;
  root.dataset.anim = s.animIn;
  root.dataset.shadow = s.shadow;

  const style = document.documentElement.style;
  style.setProperty('--font', `${s.font}, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`);
  style.setProperty('--font-size', px(s.fontSize));
  style.setProperty('--gap', px(s.gap));
  style.setProperty('--padding', px(s.padding));
  style.setProperty('--radius', px(s.radius));
  style.setProperty('--border-width', px(s.borderWidth));
  style.setProperty('--icon-size', px(s.iconSize));
  style.setProperty('--avatar-size', px(s.avatar));
  style.setProperty('--text-color', s.textColor);
  style.setProperty('--name-weight', s.nameWeight);
  style.setProperty('--name-case', s.case === 'upper' ? 'uppercase' : 'none');
  style.setProperty('--card-width', px(s.cardWidth));
  style.setProperty('--card-lines', String(s.cardLines));
  // Entrance slides in from whichever edge the chat is anchored to.
  style.setProperty('--anim-shift', s.anchor === 'right' ? px(14) : px(-14));
}

async function loadPlatforms() {
  try {
    const res = await fetch('/api/platforms');
    const body = await res.json();
    platforms = new Map(body.platforms.map((p) => [p.id, p]));
  } catch {
    // Bridge not up yet. Messages still render, just with the fallback colour.
    platforms = new Map();
  }
}

function platformColor(id) {
  return platforms.get(id)?.color || '#888888';
}

/** Background for one message, honouring msgBg / bgOpacity / bgTint / per-platform overrides. */
function messageBackground(platformId) {
  const s = settings;
  if (s.msgBg === 'none') return 'transparent';
  const alpha = s.bgOpacity / 100;
  if (s.msgBg === 'flat') return withAlpha(s.bgColor, alpha);
  const base = s.platformBg[platformId] || platformColor(platformId);
  // Tint toward the platform colour, away from black, by bgTint.
  return `color-mix(in srgb, ${withAlpha(base, alpha)} ${s.bgTint}%, ${withAlpha('#000000', alpha)})`;
}

function borderColorFor(platformId) {
  return settings.borderColor === 'platform' ? platformColor(platformId) : settings.borderColor;
}

function nameColorFor(platformId, userColor) {
  if (settings.nameColor === 'platform') return platformColor(platformId);
  if (settings.nameColor === 'user') return userColor || platformColor(platformId);
  return settings.nameColor;
}

// ---------------------------------------------------------------- transport

function connect() {
  const params = new URLSearchParams({ backlog: '10' });
  if (settings.platforms.length) params.set('platforms', settings.platforms.join(','));
  const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/events?${params}`;

  let socket;
  try {
    socket = new WebSocket(url);
  } catch {
    scheduleReconnect();
    return;
  }

  socket.onmessage = (msg) => {
    let payload;
    try {
      payload = JSON.parse(msg.data);
    } catch {
      return;
    }
    if (payload.type === 'hello' && payload.platforms) {
      platforms = new Map(payload.platforms.map((p) => [p.id, p]));
    } else if (payload.type === 'event') {
      onEvent(payload.event);
    }
  };
  // Silence is the correct failure mode: no error box, just keep retrying.
  socket.onclose = scheduleReconnect;
  socket.onerror = () => socket.close();
}

let retryDelay = 1000;
let retryTimer = null;
function scheduleReconnect() {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    retryDelay = Math.min(15000, retryDelay * 1.7);
    connect();
  }, retryDelay);
}

// ---------------------------------------------------------------- rendering

function onEvent(event) {
  if (event.type !== 'chat') return; // alerts are a separate overlay
  if (settings.platforms.length && !settings.platforms.includes(event.platform)) return;

  const name = (event.user?.name || '').toLowerCase();
  const text = event.data?.text || '';
  if (settings.hideCommands && text.trimStart().startsWith('!')) return;
  if (settings.hideBots.includes(name)) return;
  if (settings.hideUsers.includes(name)) return;
  if (!text.trim()) return;

  if (settings.dedupe) {
    const key = text.trim().toLowerCase();
    const prior = seen.get(key);
    if (prior && root.contains(prior.el)) {
      prior.count += 1;
      let tag = prior.el.querySelector('.dupe');
      if (!tag) {
        tag = document.createElement('span');
        tag.className = 'dupe';
        prior.el.querySelector('.body').append(tag);
      }
      tag.textContent = `×${prior.count}`;
      return;
    }
  }

  append(renderMessage(event), event);
}

function renderMessage(event) {
  const s = settings;
  const platform = event.platform;
  const el = document.createElement('div');
  el.className = 'msg';
  el.dataset.platform = platform;
  el.dataset.border = s.border;
  el.dataset.iconpos = s.iconPos;
  el.style.setProperty('--platform-color', platformColor(platform));
  el.style.setProperty('--msg-bg', messageBackground(platform));
  el.style.setProperty('--border-color', borderColorFor(platform));

  const head = document.createElement('div');
  head.className = 'head';

  if (s.avatar > 0 && event.user?.avatar) {
    const img = document.createElement('img');
    img.className = 'avatar';
    img.src = event.user.avatar;
    img.alt = '';
    img.onerror = () => img.remove();
    head.append(img);
  }

  const icon = s.icons ? buildIcon(platform) : null;
  if (icon && s.iconPos === 'before-name') head.append(icon);

  if (s.badges) for (const role of event.user?.roles || []) {
    const label = { moderator: 'mod', subscriber: 'sub', vip: 'vip', broadcaster: 'host', verified: '✓', staff: 'staff' }[role];
    if (!label) continue;
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = label;
    head.append(badge);
  }

  const nameEl = document.createElement('span');
  nameEl.className = 'name';
  nameEl.textContent = event.user?.displayName || event.user?.name || 'someone';
  nameEl.style.setProperty('--name-color', nameColorFor(platform, event.user?.color));
  head.append(nameEl);

  if (icon && s.iconPos !== 'before-name') head.append(icon);

  const body = document.createElement('div');
  body.className = 'body';
  for (const frag of fragmentsOf(event)) {
    if (frag.type === 'emote' && s.emotes && frag.url) {
      const img = document.createElement('img');
      img.className = 'emote';
      img.src = frag.url;
      img.alt = frag.name || '';
      body.append(img);
    } else {
      // textContent, never innerHTML: chat is untrusted input.
      body.append(document.createTextNode(frag.text ?? frag.name ?? ''));
    }
  }

  el.append(head, body);
  return el;
}

function buildIcon(platform) {
  const url = `url("/api/platforms/${encodeURIComponent(platform)}/icon.svg")`;
  if (settings.iconStyle === 'color') {
    const img = document.createElement('img');
    img.className = 'picon';
    img.src = `/api/platforms/${encodeURIComponent(platform)}/icon.svg`;
    img.alt = platforms.get(platform)?.label || platform;
    img.onerror = () => img.remove();
    return img;
  }
  const span = document.createElement('span');
  if (settings.iconStyle === 'badge') {
    span.className = 'picon badge-chip';
    const inner = document.createElement('i');
    inner.style.setProperty('--icon-url', url);
    span.append(inner);
  } else {
    span.className = 'picon mono';
    span.style.setProperty('--icon-url', url);
  }
  return span;
}

function fragmentsOf(event) {
  const frags = event.data?.fragments;
  if (Array.isArray(frags) && frags.length) return frags;
  return [{ type: 'text', text: event.data?.text || '' }];
}

function append(el, event) {
  const toTop = settings.flow === 'newest-top' || settings.flow === 'newest-left';
  if (toTop) root.prepend(el);
  else root.append(el);

  if (settings.dedupe) {
    const key = (event.data?.text || '').trim().toLowerCase();
    seen.set(key, { el, count: 1 });
    if (seen.size > 200) seen.delete(seen.keys().next().value);
  }

  while (root.children.length > settings.maxMessages) {
    (toTop ? root.lastElementChild : root.firstElementChild)?.remove();
  }

  if (settings.fade > 0) {
    setTimeout(() => {
      el.classList.add('leaving');
      setTimeout(() => el.remove(), 450);
    }, settings.fade * 1000);
  }
}

// ---------------------------------------------------------------- helpers

/** Accepts #rgb / #rrggbb and returns an rgba() string. */
function withAlpha(hex, alpha) {
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6) return `rgba(0,0,0,${alpha})`;
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
