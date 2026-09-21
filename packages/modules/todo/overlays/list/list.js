/**
 * To-do overlay. Draws whatever list the bridge is holding.
 *
 * The bridge is the only owner of the list, so every source showing this
 * overlay - and the setup page - always agree, and a source refreshed mid-stream
 * comes straight back with the list on it.
 */
import { parseSettings } from '/core/settings-schema.js';
import { TODO_SETTINGS, TODO_THEMES } from './settings.js';

const settings = parseSettings(location.search, TODO_SETTINGS, TODO_THEMES);
const stage = document.getElementById('stage');
const rowsEl = document.getElementById('rows');
const headEl = document.getElementById('head');
const titleEl = document.getElementById('title');
const countEl = document.getElementById('count');

/** platform id -> { color, label } from GET /api/platforms */
let platforms = new Map();
let state = null;
let retryDelay = 1000;
let retryTimer = null;

applyStaticStyles();
loadPlatforms().then(() => {
  if (settings.preview) setState(previewState());
  else connect();
});

function applyStaticStyles() {
  const s = settings;
  const k = s.scale / 100;
  const px = (n) => `${Math.round(n * k * 100) / 100}px`;
  stage.dataset.position = s.position;
  stage.dataset.align = s.align;
  stage.dataset.shadow = s.shadow;
  rowsEl.dataset.rowbg = s.rowBg ? 'yes' : 'no';
  const st = document.documentElement.style;
  st.setProperty('--font', `${s.font}, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`);
  st.setProperty('--font-size', px(s.fontSize));
  st.setProperty('--padding', px(s.padding));
  st.setProperty('--gap', px(s.gap));
  st.setProperty('--radius', px(s.radius));
  st.setProperty('--width', px(s.width));
  st.setProperty('--offset', px(s.offset));
  st.setProperty('--bg', withAlpha(s.bgColor, s.bgOpacity / 100));
  st.setProperty('--text-color', s.textColor);
  st.setProperty('--accent', s.accent);
  st.setProperty('--done-color', s.doneColor);
  titleEl.textContent = s.title;
}

async function loadPlatforms() {
  try {
    const body = await (await fetch('/api/platforms')).json();
    platforms = new Map(body.platforms.map((p) => [p.id, p]));
  } catch {
    platforms = new Map();
  }
}
const platformColor = (id) => platforms.get(id)?.color || 'var(--accent)';

// ------------------------------------------------------------ transport

function connect() {
  let socket;
  try {
    socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/events`);
  } catch {
    scheduleReconnect();
    return;
  }
  socket.onopen = () => { retryDelay = 1000; };
  socket.onmessage = (msg) => {
    let payload;
    try {
      payload = JSON.parse(msg.data);
    } catch {
      return;
    }
    if (payload.type !== 'todo' || !payload.state) return;
    setState(payload.state);
  };
  socket.onclose = () => {
    // Keep the last list on screen rather than blanking mid-stream; the bridge
    // sends the current one again the moment it is back.
    scheduleReconnect();
  };
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

function setState(next) {
  state = next;
  render();
}

// ------------------------------------------------------------ render

function render() {
  const all = state?.tasks || [];
  const shown = (settings.showDone ? all : all.filter((t) => !t.done)).slice(0, settings.maxRows);
  const hiddenCount = (settings.showDone ? all.length : all.filter((t) => !t.done).length) - shown.length;

  stage.dataset.hidden = !state || (settings.hideEmpty && !shown.length) ? 'yes' : 'no';
  headEl.hidden = !settings.title && !settings.showCount;
  countEl.textContent = settings.showCount && all.length ? `${all.filter((t) => !t.done).length} left` : '';

  rowsEl.replaceChildren();
  for (const task of shown) rowsEl.append(row(task));
  if (hiddenCount > 0) {
    const more = document.createElement('div');
    more.className = 'more';
    more.textContent = `+${hiddenCount} more`;
    rowsEl.append(more);
  }
}

function row(task) {
  const el = document.createElement('div');
  el.className = 'task';
  el.dataset.done = task.done ? 'yes' : 'no';
  el.dataset.strike = settings.strike ? 'yes' : 'no';

  const box = document.createElement('span');
  box.className = 'box';
  box.textContent = '✓';
  el.append(box);

  if (settings.numbers) {
    const num = document.createElement('span');
    num.className = 'num';
    num.textContent = `${task.n}.`;
    el.append(num);
  }

  const body = document.createElement('div');
  body.className = 'body';
  const text = document.createElement('div');
  text.className = 'text';
  text.textContent = task.text;
  body.append(text);

  // Whose task it is, so chat can see who is doing what.
  if (task.by && settings.names) {
    const who = document.createElement('div');
    who.className = 'who';
    if (settings.icons && platforms.has(task.by.platform)) {
      const img = document.createElement('img');
      img.src = `/api/platforms/${encodeURIComponent(task.by.platform)}/icon.svg`;
      img.alt = '';
      who.append(img);
    }
    const name = document.createElement('span');
    name.className = 'name';
    name.style.setProperty('--pc', platformColor(task.by.platform));
    name.textContent = task.by.displayName || task.by.name;
    who.append(name);
    body.append(who);
  }

  el.append(body);
  return el;
}

/** A pretend list, so the overlay can be styled without the bridge running. */
function previewState() {
  // Whoever is installed, named by the manifests - the preview must not be the
  // one place a platform is written down.
  const ids = [...platforms.keys()].filter((id) => id !== 'fake');
  const at = (i) => ids[i % ids.length] || null;
  return {
    chatCanAdd: true,
    tasks: [
      { n: 1, text: 'Say hello to everyone', done: true, by: null },
      { n: 2, text: 'Finish the boss fight', done: false, by: null },
      { n: 3, text: 'Set up tomorrow’s stream', done: false, by: null },
      viewer(4, 'beating my personal best', false, at(0), 'PixelPete'),
      viewer(5, 'studying for my exam', false, at(1), 'AylinPlays'),
      viewer(6, 'cleaning the kitchen', true, at(2), 'Rakun'),
    ],
  };
}

/** A pretend viewer task; with no platforms loaded it is simply unattributed. */
function viewer(n, text, done, platform, displayName) {
  const by = platform ? { platform, name: displayName.toLowerCase(), displayName } : null;
  return { n, text, done, by };
}

function withAlpha(hex, alpha) {
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6) return `rgba(0,0,0,${alpha})`;
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
