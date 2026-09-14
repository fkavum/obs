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
/** key -> { el, n, l } - the elements stay; only their text changes. */
const nodes = new Map();
let lastOrder = '';

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
  bar.dataset.animate = s.animateChanges ? 'on' : 'off';
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

  // The goal bar's own look. 'accent' means follow the highlight colour.
  const colour = (v) => (v === 'accent' ? 'var(--accent)' : v);
  st.setProperty('--goal-width', px(s.goalWidth));
  st.setProperty('--goal-height', px(s.goalHeight));
  st.setProperty('--goal-radius', s.goalRadius >= 999 ? '999px' : px(s.goalRadius));
  st.setProperty('--goal-padding', s.goalBg === 'flat' ? px(s.goalPadding) : '0px');
  st.setProperty('--goal-bg', s.goalBg === 'flat' ? withAlpha(s.goalBgColor, s.goalBgOpacity / 100) : 'transparent');
  st.setProperty('--goal-track', withAlpha(s.goalTrack, s.goalTrackOpacity / 100));
  st.setProperty('--goal-fill', colour(s.goalFill));
  st.setProperty('--goal-border', colour(s.goalBorderColor));
  st.setProperty('--goal-border-width', px(s.goalBorderWidth));
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

  // What should be on screen, in order. Nothing here touches the DOM yet.
  const want = [];
  if (s.showTotal && live.length) want.push({ key: 'total', value: formatCompact(totalViewers(state, opts)), label: 'watching', glyph: '👁' });
  if (s.showPerPlatform) for (const p of live) want.push({ key: `p:${p.id}`, value: formatCompact(p.viewers), label: platforms.get(p.id)?.label || p.id, platformId: p.id });
  if (s.showUptime && state.liveSince !== null) want.push({ key: 'uptime', value: formatUptime(uptimeMs(state)), label: 'live', glyph: '⏱', quiet: true });
  if (s.showFollows && state.follows) want.push({ key: 'follows', value: `+${state.follows}`, label: state.follows === 1 ? 'follower' : 'followers' });
  if (s.showSubs && state.subs) want.push({ key: 'subs', value: `+${state.subs}`, label: state.subs === 1 ? 'sub' : 'subs' });
  if (s.showTips && (state.tips || state.bits)) {
    const money = state.tips ? formatMoney(state.tips, state.tipsCurrency) : '';
    const bits = state.bits ? `${formatCompact(state.bits)} bits` : '';
    want.push({ key: 'tips', value: [money, bits].filter(Boolean).join(' + '), label: 'in tips' });
  }
  if (s.showRaids && state.raids) want.push({ key: 'raids', value: `${state.raids}`, label: state.raids === 1 ? 'raid' : 'raids' });
  const goal = goalProgress(state, s, opts);
  if (goal) want.push({ key: 'goal', goal });

  // Update text in place. Elements are created once and kept, so nothing
  // re-animates and nothing flickers when a number changes.
  for (const w of want) {
    let node = nodes.get(w.key);
    if (!node) {
      node = w.goal ? createGoal() : createItem(w);
      nodes.set(w.key, node);
    }
    if (w.goal) updateGoal(node, w.goal);
    else updateItem(node, w);
  }

  // Only touch the DOM's structure when the set or order of items changed.
  const order = want.map((w) => w.key).join('|');
  if (order !== lastOrder) {
    for (const key of [...nodes.keys()]) if (!want.some((w) => w.key === key)) { nodes.get(key).el.remove(); nodes.delete(key); }
    bar.replaceChildren(...want.map((w) => nodes.get(w.key).el));
    lastOrder = order;
  }
}

function createItem(w) {
  const el = document.createElement('div');
  el.className = 'item fresh';
  el.dataset.key = w.key;
  el.dataset.border = settings.border;
  el.style.setProperty('--item-bg', itemBackground(w.platformId));
  if (w.platformId) {
    el.style.setProperty('--platform-color', platformColor(w.platformId));
    if (settings.accent === 'platform') el.style.setProperty('--item-accent', platformColor(w.platformId));
    if (settings.icons) {
      const img = document.createElement('img');
      img.src = `/api/platforms/${encodeURIComponent(w.platformId)}/icon.svg`;
      img.alt = '';
      img.onerror = () => img.remove();
      el.append(img);
    } else {
      const dot = document.createElement('span');
      dot.className = 'dot';
      el.append(dot);
    }
  } else if (w.glyph && settings.icons) {
    const g = document.createElement('span');
    g.textContent = w.glyph;
    g.style.fontSize = '0.9em';
    el.append(g);
  }
  const n = document.createElement('span');
  n.className = 'n';
  const l = document.createElement('span');
  l.className = 'l';
  el.append(n, l);
  // The entrance class is for the first appearance only.
  el.addEventListener('animationend', () => el.classList.remove('fresh'), { once: true });
  return { el, n, l };
}

function updateItem(node, w) {
  if (node.n.textContent !== w.value) {
    node.n.textContent = w.value;
    // Uptime ticks every second; bumping it would be constant motion.
    if (settings.animateChanges && !w.quiet) {
      node.n.classList.remove('bump');
      void node.n.offsetWidth; // restart the animation if it's already playing
      node.n.classList.add('bump');
    }
  }
  if (node.l.textContent !== w.label) node.l.textContent = w.label;
}

function createGoal() {
  const el = document.createElement('div');
  el.className = 'goal';
  el.dataset.key = 'goal';
  el.dataset.border = settings.goalBorder;
  el.dataset.text = settings.goalText;
  const row = document.createElement('div');
  row.className = 'row';
  const label = document.createElement('span');
  const value = document.createElement('span');
  value.className = 'n';
  row.append(label, value);
  const track = document.createElement('div');
  track.className = 'track';
  const fill = document.createElement('div');
  fill.className = 'fill';
  track.append(fill);
  el.append(row, track);
  return { el, label, value, fill };
}

function updateGoal(node, goal) {
  const text = `${formatCompact(goal.value)} / ${formatCompact(goal.target)}`;
  if (node.label.textContent !== goal.label) node.label.textContent = goal.label;
  if (node.value.textContent !== text) node.value.textContent = text;
  const width = `${goal.pct}%`;
  if (node.fill.style.width !== width) node.fill.style.width = width;
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
