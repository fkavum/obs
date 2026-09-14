/**
 * Stream health panel. Streamer-only: this is meant for an OBS Custom Browser
 * Dock or a second monitor, not for a scene you broadcast.
 *
 * All judgement lives in the pure health model; this file only renders it, and
 * updates in place so nothing flickers.
 */
import { parseSettings, HEALTH_SETTINGS, HEALTH_THEMES } from '/core/settings-schema.js';
import { startPreviewObsStats } from '/core/preview-feed.js';
import { createHealthState, addSample, assess, formatBitrate } from '/core/health-model.js';

let retryDelay = 1000;
let retryTimer = null;
const settings = parseSettings(location.search, HEALTH_SETTINGS, HEALTH_THEMES);
const panel = document.getElementById('panel');
const state = createHealthState();
let nodes = null;

applyStaticStyles();
setInterval(render, 1000);
if (settings.preview) startPreviewObsStats(onEvent);
else connect();

function applyStaticStyles() {
  const s = settings;
  const k = s.scale / 100;
  const px = (n) => `${Math.round(n * k * 100) / 100}px`;
  panel.dataset.direction = s.direction;
  panel.dataset.align = s.align;
  const st = document.documentElement.style;
  st.setProperty('--font', `${s.font}, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`);
  st.setProperty('--font-size', px(s.fontSize));
  st.setProperty('--padding', px(s.padding));
  st.setProperty('--gap', px(s.gap));
  st.setProperty('--radius', px(s.radius));
  st.setProperty('--bg', withAlpha(s.bgColor, s.bgOpacity / 100));
  st.setProperty('--text-color', s.textColor);
  st.setProperty('--ok', s.okColor);
  st.setProperty('--warn', s.warnColor);
  st.setProperty('--bad', s.badColor);
}

function connect() {
  let socket;
  try {
    socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/events`);
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
    if (payload.type === 'event' && payload.event.type === 'obs.stats') onEvent(payload.event);
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
  const d = event.data || {};
  state.targetFps = d.targetFps || state.targetFps;
  addSample(state, { stats: d.stats, stream: d.stream });
}

// ------------------------------------------------------------ render

function render() {
  const s = settings;
  const verdict = assess(state, thresholds(), Date.now());
  const r = verdict.readings;

  // Nothing known yet, or deliberately hidden.
  const hide =
    !r ||
    (!r.streaming && !s.showWhenOffline) ||
    (s.mode === 'problems' && verdict.level === 'ok' && r.streaming);
  panel.dataset.empty = hide ? 'yes' : 'no';
  if (hide) return;

  if (!nodes) nodes = build();
  const colour = { ok: 'var(--ok)', warn: 'var(--warn)', bad: 'var(--bad)' }[verdict.level];
  panel.style.setProperty('--level-color', colour);

  const headline = !r.streaming ? 'Not streaming' : { ok: 'All good', warn: 'Something to watch', bad: 'Problem on stream' }[verdict.level];
  setText(nodes.headline, headline);

  // Issues, keyed so unchanged ones are left alone.
  // Worst-first already; cap the list so the numbers row is never pushed off screen.
  const want = r.streaming ? verdict.issues.slice(0, settings.maxIssues) : [];
  const seen = new Set();
  for (const issue of want) {
    seen.add(issue.key);
    let node = nodes.issues.get(issue.key);
    if (!node) {
      node = buildIssue();
      nodes.issues.set(issue.key, node);
      nodes.issueBox.append(node.el);
    }
    node.el.style.setProperty('--issue-color', issue.level === 'bad' ? 'var(--bad)' : 'var(--warn)');
    setText(node.title, issue.title);
    setText(node.advice, s.showAdvice ? issue.advice : '');
    node.advice.hidden = !s.showAdvice;
  }
  for (const [key, node] of nodes.issues) if (!seen.has(key)) { node.el.remove(); nodes.issues.delete(key); }

  nodes.numbers.hidden = !s.showNumbers;
  if (s.showNumbers) {
    setValue(nodes.n.bitrate, formatBitrate(r.kbps));
    setValue(nodes.n.fps, r.fps ? r.fps.toFixed(0) : '—', level(state.targetFps && r.fps ? ((state.targetFps - r.fps) / state.targetFps) * 100 : 0, 10, 25));
    setValue(nodes.n.dropped, `${r.droppedPct.toFixed(1)}%`, level(r.droppedPct, thresholds().droppedWarn, thresholds().droppedBad));
    setValue(nodes.n.cpu, `${Math.round(r.cpu)}%`, level(r.cpu, thresholds().cpuWarn, thresholds().cpuBad));
  }
}

function thresholds() {
  const s = settings;
  return {
    droppedWarn: s.droppedWarn, droppedBad: s.droppedBad,
    encodeWarn: s.encodeWarn, encodeBad: s.encodeBad,
    renderWarn: s.renderWarn, renderBad: s.renderBad,
    cpuWarn: s.cpuWarn, cpuBad: s.cpuBad,
  };
}
const level = (value, warn, bad) => (value >= bad ? 'bad' : value >= warn ? 'warn' : 'ok');

function build() {
  panel.replaceChildren();
  const head = document.createElement('div');
  head.className = 'headline';
  const lamp = document.createElement('span');
  lamp.className = 'lamp';
  const text = document.createElement('span');
  text.className = 'text';
  head.append(lamp, text);

  const issueBox = document.createElement('div');
  issueBox.className = 'issues';

  const numbers = document.createElement('div');
  numbers.className = 'numbers';
  const n = {};
  for (const [key, label] of [['bitrate', 'bitrate'], ['fps', 'fps'], ['dropped', 'dropped'], ['cpu', 'cpu']]) {
    const wrap = document.createElement('span');
    const k = document.createElement('span');
    k.className = 'k';
    k.textContent = `${label} `;
    const v = document.createElement('span');
    v.className = 'v';
    wrap.append(k, v);
    numbers.append(wrap);
    n[key] = v;
  }

  panel.append(head, issueBox, numbers);
  return { headline: text, issueBox, issues: new Map(), numbers, n };
}

function buildIssue() {
  const el = document.createElement('div');
  el.className = 'issue';
  const title = document.createElement('div');
  title.className = 't';
  const advice = document.createElement('div');
  advice.className = 'a';
  el.append(title, advice);
  return { el, title, advice };
}

function setText(el, text) {
  if (el.textContent !== text) el.textContent = text;
}
function setValue(el, text, lvl = 'ok') {
  setText(el, text);
  if (el.dataset.level !== lvl) el.dataset.level = lvl;
}
function withAlpha(hex, alpha) {
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6) return `rgba(0,0,0,${alpha})`;
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
