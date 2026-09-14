/**
 * Timer overlay.
 *
 * The bridge holds the authoritative state as absolute timestamps; this ticks
 * locally from them. That keeps the display perfectly smooth without a message
 * every second, and a source refreshed mid-countdown lands on the right number.
 */
import { parseSettings, TIMER_SETTINGS, TIMER_THEMES } from '/core/settings-schema.js';
import { createTimer, apply, display } from '/core/timer-model.js';

let retryDelay = 1000;
let retryTimer = null;
const settings = parseSettings(location.search, TIMER_SETTINGS, TIMER_THEMES);
const stage = document.getElementById('stage');
const box = document.getElementById('box');
const labelEl = document.getElementById('label');
const clockEl = document.getElementById('clock');

let state = createTimer();
// The bridge's clock may differ from this machine's; correct for it so the
// countdown doesn't end early or late on a PC whose clock has drifted.
let clockSkewMs = 0;

applyStaticStyles();
if (settings.preview) {
  state = apply(createTimer({ durationMs: 5 * 60 * 1000, label: 'Starting soon' }), { type: 'start' });
} else {
  connect();
}
setInterval(render, 100); // smooth enough that seconds never appear to skip
render();

function applyStaticStyles() {
  const s = settings;
  const k = s.scale / 100;
  const px = (n) => `${Math.round(n * k * 100) / 100}px`;
  stage.dataset.position = s.position;
  stage.dataset.align = s.align;
  stage.dataset.shadow = s.shadow;
  const st = document.documentElement.style;
  st.setProperty('--font', `${s.font}, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`);
  st.setProperty('--clock-size', px(s.clockSize));
  st.setProperty('--label-size', px(s.labelSize));
  st.setProperty('--gap', px(s.gap));
  st.setProperty('--offset', px(s.offset));
  st.setProperty('--padding', s.bg === 'flat' ? px(s.padding) : '0px');
  st.setProperty('--radius', px(s.radius));
  st.setProperty('--bg', s.bg === 'flat' ? withAlpha(s.bgColor, s.bgOpacity / 100) : 'transparent');
  st.setProperty('--clock-color', s.clockColor);
  st.setProperty('--label-color', s.labelColor);
  st.setProperty('--clock-weight', s.clockWeight);
  st.setProperty('--urgent-color', s.urgentColor);
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
    if (payload.type !== 'timer' || !payload.state) return;
    state = payload.state;
    if (Number.isFinite(state.updatedAt) && state.updatedAt > 0) {
      clockSkewMs = state.updatedAt - Date.now();
    }
    render();
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

function render() {
  const now = Date.now() + clockSkewMs;
  const view = display(state, now);
  const idle = state.status === 'stopped';
  const hide = view.hidden || (idle && settings.hideWhenStopped);
  stage.dataset.hidden = hide ? 'yes' : 'no';
  if (hide) return;

  const label = settings.showLabel ? view.label || '' : '';
  if (labelEl.textContent !== label) labelEl.textContent = label;
  if (clockEl.textContent !== view.text) clockEl.textContent = view.text;

  // Words (the finished message) need a smaller size than digits.
  const kind = /^[\d:+]+$/.test(view.text) ? 'digits' : 'words';
  if (clockEl.dataset.text !== kind) clockEl.dataset.text = kind;

  const urgent =
    settings.urgentAt > 0 &&
    state.mode === 'countdown' &&
    state.status === 'running' &&
    !view.finished &&
    view.ms <= settings.urgentAt * 1000;
  const flag = urgent ? 'yes' : 'no';
  if (clockEl.dataset.urgent !== flag) clockEl.dataset.urgent = flag;
}

function withAlpha(hex, alpha) {
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6) return `rgba(0,0,0,${alpha})`;
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
