/**
 * Stats bar overlay. Feeds events into the pure stats model and renders it
 * once a second. Renders nothing until it has a number to show, and nothing
 * when the bridge is down.
 */
import { parseSettings, STATS_SETTINGS, STATS_THEMES } from '/core/settings-schema.js';
import { startPreviewFeed } from '/core/preview-feed.js';
import {
  createStatsState, applyEvent, livePlatforms, totalViewers, uptimeMs,
  formatCompact, formatUptime, goalProgress,
} from '/core/stats-model.js';

let retryDelay = 1000;
let retryTimer = null;
const settings = parseSettings(location.search, STATS_SETTINGS, STATS_THEMES);
const bar = document.getElementById('bar');
const state = createStatsState();
let platforms = new Map();
const lastShown = {}; // key -> last value, to animate changes

applyStaticStyles();
main();

async function main() {
  await loadPlatforms();
  setInterval(render, 1000);
  if (settings.preview) {
    startPreviewFeed(onEvent, { platforms: [...platforms.keys()].filter((p) => p !== 'fake') });
    return;
  }
  connect();
}

function applyStaticStyles() {
  const s = settings;
  const k = s.scale / 100;
  const px = (n) => `${Math.round(n * k * 100) / 100}px`;
  bar.dataset.direction = s.direction;
  bar.dataset.align = s.align;
  bar.dataset.shadow = s.shadow;
  const st = document.documentElement.style;
  st.setProperty('--font', `${s.font}, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`);
  st.setProperty('--font-size', px(s.fontSize));
  st.setProperty('--padding', px(s.padding));
  st.setProperty('--gap', px(s.gap));
  st.setProperty('--radius', s.radius >= 999 ? '999px' : px(s.radius));
  st.setProperty('--border-width', px(s.borderWidth));
  st.setProperty('--icon-size', px(s.iconSize));
  st.setProperty('--text-color', s.textColor);
  if (s.accent !== 'platform') st.setProperty('--accent', s.accent);
}

async function loadPlatforms() {
  try {
    const body = await (await fetch('/api/platforms')).json();
    platforms = new Map(body.platforms.map((p) => [p.id, p]));
  } catch {
    platforms = new Map();
  }
}
const platformColor = (id) => platforms.get(id)?.color || '#888888';

function itemBackground(platformId) {
  const s = settings;
  if (s.bg === 'none') return 'transparent';
  const a = s.bgOpacity / 100;
  if (s.bg === 'flat' || !platformId) return withAlpha(s.bgColor, a);
  const base = s.platformBg?.[platformId] || platformColor(platformId);
  return `color-mix(in srgb, ${withAlpha(base, a)} ${s.bgTint}%, ${withAlpha('#000000', a)})`;
}

// ------------------------------------------------------------ transport

function connect() {
  const params = new URLSearchParams({ backlog: '50' });
  if (settings.platforms.length) params.set('platforms', settings.platforms.join(','));
  let socket;
  try {
    socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/events?${params}`);
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
    if (payload.type === 'hello' && payload.platforms) platforms = new Map(payload.platforms.map((p) => [p.id, p]));
    else if (payload.type === 'event') {
      // Replayed backlog seeds viewer counts but must not inflate session counters.
      if (payload.replay && !['viewers', 'stream.state'].includes(payload.event.type)) return;
      onEvent(payload.event);
    }
  };
  socket.onclose = scheduleReconnect;
  socket.onerror = () => socket.close();
}
function scheduleReconnect() {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    retryDelay = Math.min(15000, retryDelay * 1.7);
    connect();
  }, retryDelay);
}

function onEvent(event) {
  if (settings.platforms.length && !settings.platforms.includes(event.platform)) return;
  applyEvent(state, event);
}

// ------------------------------------------------------------ render

function render() {
  const s = settings;
  const opts = { staleMs: s.stale * 1000, only: s.platforms };
  const live = livePlatforms(state, opts);
  const items = [];

  if (s.showTotal && live.length) items.push(item('total', formatCompact(totalViewers(state, opts)), 'watching', null, '👁'));
  if (s.showPerPlatform) for (const p of live) items.push(item(`p:${p.id}`, formatCompact(p.viewers), platforms.get(p.id)?.label || p.id, p.id));
  if (s.showUptime && state.liveSince !== null) items.push(item('uptime', formatUptime(uptimeMs(state)), 'live', null, '⏱'));
  if (s.showFollows && state.follows) items.push(item('follows', `+${state.follows}`, state.follows === 1 ? 'follower' : 'followers'));
  if (s.showSubs && state.subs) items.push(item('subs', `+${state.subs}`, state.subs === 1 ? 'sub' : 'subs'));
  if (s.showTips && (state.tips || state.bits)) {
    const money = state.tips ? formatMoney(state.tips, state.tipsCurrency) : '';
    const bits = state.bits ? `${formatCompact(state.bits)} bits` : '';
    items.push(item('tips', [money, bits].filter(Boolean).join(' + '), 'in tips'));
  }
  if (s.showRaids && state.raids) items.push(item('raids', `${state.raids}`, state.raids === 1 ? 'raid' : 'raids'));

  const goal = goalProgress(state, s, opts);
  if (goal) items.push(goalEl(goal));

  bar.replaceChildren(...items);
}

function item(key, value, label, platformId = null, glyph = null) {
  const el = document.createElement('div');
  el.className = 'item';
  el.dataset.border = settings.border;
  el.style.setProperty('--item-bg', itemBackground(platformId));
  if (platformId) {
    el.style.setProperty('--platform-color', platformColor(platformId));
    if (settings.accent === 'platform') el.style.setProperty('--item-accent', platformColor(platformId));
    if (settings.icons) {
      const img = document.createElement('img');
      img.src = `/api/platforms/${encodeURIComponent(platformId)}/icon.svg`;
      img.alt = '';
      img.onerror = () => img.remove();
      el.append(img);
    } else {
      const dot = document.createElement('span');
      dot.className = 'dot';
      el.append(dot);
    }
  } else if (glyph && settings.icons) {
    const g = document.createElement('span');
    g.textContent = glyph;
    g.style.fontSize = '0.9em';
    el.append(g);
  }
  const n = document.createElement('span');
  n.className = 'n';
  n.textContent = value;
  if (lastShown[key] !== undefined && lastShown[key] !== value && key !== 'uptime') n.classList.add('bump');
  lastShown[key] = value;
  const l = document.createElement('span');
  l.className = 'l';
  l.textContent = label;
  el.append(n, l);
  return el;
}

function goalEl(goal) {
  const el = document.createElement('div');
  el.className = 'goal';
  const row = document.createElement('div');
  row.className = 'row';
  const a = document.createElement('span');
  a.textContent = goal.label;
  const b = document.createElement('span');
  b.className = 'n';
  b.textContent = `${formatCompact(goal.value)} / ${formatCompact(goal.target)}`;
  row.append(a, b);
  const track = document.createElement('div');
  track.className = 'track';
  const fill = document.createElement('div');
  fill.className = 'fill';
  fill.style.width = `${goal.pct}%`;
  track.append(fill);
  el.append(row, track);
  return el;
}

function formatMoney(amount, currency) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${Math.round(amount)} ${currency}`;
  }
}
function withAlpha(hex, alpha) {
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6) return `rgba(0,0,0,${alpha})`;
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
