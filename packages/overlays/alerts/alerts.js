/**
 * Alerts overlay.
 *
 * Subscribes to the bridge, filters events through the operator's settings,
 * and shows them one at a time: enter, hold, leave, pause, next. The queue is
 * capped so a raid's worth of follows can't leave you minutes behind. Platform
 * colours/icons come from the bridge's manifests, never a hardcoded map.
 *
 * Silence is the failure mode: bridge down -> nothing on screen, retry quietly.
 */
import { parseSettings, ALERT_SETTINGS, ALERT_THEMES } from '/core/settings-schema.js';
import { startPreviewFeed, makePreviewEvent } from '/core/preview-feed.js';
import { shouldAlert, formatAlert } from '/core/alert-format.js';

let retryDelay = 1000;
let retryTimer = null;
const settings = parseSettings(location.search, ALERT_SETTINGS, ALERT_THEMES);
const stage = document.getElementById('stage');
let platforms = new Map();
const queue = [];
let showing = false;

applyStaticStyles();
main();

async function main() {
  await loadPlatforms();
  if (settings.preview) {
    // Local, so styling works with no bridge. Alerts only: skip chat events.
    const ids = [...platforms.keys()].filter((p) => p !== 'fake');
    const types = ['follow', 'subscription', 'donation', 'raid'];
    let i = 0;
    const fire = () => {
      onEvent(makePreviewEvent(ids, types[i++ % types.length]));
      setTimeout(fire, (settings.duration + settings.pause) * 1000 + 800);
    };
    setTimeout(fire, 400);
    return;
  }
  connect();
}

// ------------------------------------------------------------ styling

function applyStaticStyles() {
  const s = settings;
  const k = s.scale / 100;
  const px = (n) => `${Math.round(n * k * 100) / 100}px`;
  stage.dataset.position = s.position;
  stage.dataset.align = s.align;
  stage.dataset.anim = s.animIn;
  stage.dataset.shadow = s.shadow;
  const st = document.documentElement.style;
  st.setProperty('--font', `${s.font}, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`);
  st.setProperty('--font-size', px(s.fontSize));
  st.setProperty('--padding', px(s.padding));
  st.setProperty('--radius', px(s.radius));
  st.setProperty('--border-width', px(s.borderWidth));
  st.setProperty('--icon-size', px(s.iconSize));
  st.setProperty('--width', px(s.width));
  st.setProperty('--offset', px(s.offset));
  st.setProperty('--text-color', s.textColor);
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

function background(platformId) {
  const s = settings;
  if (s.bg === 'none') return 'transparent';
  const a = s.bgOpacity / 100;
  if (s.bg === 'flat') return withAlpha(s.bgColor, a);
  const base = s.platformBg?.[platformId] || platformColor(platformId);
  return `color-mix(in srgb, ${withAlpha(base, a)} ${s.bgTint}%, ${withAlpha('#000000', a)})`;
}

// ------------------------------------------------------------ transport

function connect() {
  const params = new URLSearchParams();
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
    } else if (payload.type === 'event' && !payload.replay) {
      onEvent(payload.event); // never replay old alerts on reconnect
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

// ------------------------------------------------------------ queue

function onEvent(event) {
  if (!shouldAlert(event, settings)) return;
  const alert = formatAlert(event, settings);
  if (!alert) return;
  queue.push(alert);
  // Too far behind: skip the oldest rather than replaying history for minutes.
  while (queue.length > settings.maxQueue) queue.shift();
  if (!showing) next();
}

function next() {
  const alert = queue.shift();
  if (!alert) {
    showing = false;
    return;
  }
  showing = true;
  const el = render(alert);
  stage.replaceChildren(el);
  chime(alert.chime);
  setTimeout(() => {
    el.classList.add('leaving');
    setTimeout(() => {
      el.remove();
      setTimeout(next, settings.pause * 1000);
    }, 320);
  }, settings.duration * 1000);
}

function render(alert) {
  const el = document.createElement('div');
  el.className = 'alert';
  el.dataset.kind = alert.kind;
  el.dataset.border = settings.border;
  el.style.setProperty('--platform-color', platformColor(alert.platform));
  el.style.setProperty('--alert-bg', background(alert.platform));
  el.style.setProperty('--accent-color', settings.accent === 'platform' ? platformColor(alert.platform) : settings.accent);

  if (settings.iconSize > 0) {
    const img = document.createElement('img');
    img.className = 'picon';
    img.src = `/api/platforms/${encodeURIComponent(alert.platform)}/icon.svg`;
    img.alt = '';
    img.onerror = () => img.remove();
    el.append(img);
  }

  const body = document.createElement('div');
  body.className = 'body';
  const headline = document.createElement('div');
  headline.className = 'headline';
  headline.append(...emphasiseName(alert.headline));
  body.append(headline);
  if (alert.message) {
    const msg = document.createElement('div');
    msg.className = 'message';
    msg.textContent = alert.message; // untrusted: text node only
    body.append(msg);
  }
  el.append(body);

  if (alert.highlight) {
    const hl = document.createElement('div');
    hl.className = 'highlight';
    hl.textContent = alert.highlight;
    el.append(hl);
  }
  return el;
}

/** Colour the chatter's name inside the headline without using innerHTML. */
function emphasiseName(text) {
  // The name is whatever the template put first up to the first verb-ish gap;
  // simplest robust approach: highlight the leading token(s) before " just"/" is"/" tipped"/" gifted"/" resubscribed".
  const m = /^(.+?)(\s(?:just|is|tipped|gifted|resubscribed|subscribed|followed)\b.*)$/i.exec(text);
  if (!m) return [document.createTextNode(text)];
  const name = document.createElement('span');
  name.className = 'name';
  name.textContent = m[1];
  return [name, document.createTextNode(m[2])];
}

// ------------------------------------------------------------ sound

let audio = null;
function chime(kind) {
  if (!settings.sound || settings.volume <= 0) return;
  const vol = settings.volume / 100;

  if (settings.soundUrl) {
    try {
      const a = new Audio(settings.soundUrl);
      a.volume = vol;
      a.play().catch(() => {});
    } catch { /* bad URL: stay silent */ }
    return;
  }

  // Built-in chime via WebAudio: nothing to download, nothing to maintain.
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume().catch(() => {});
    const notes = kind === 'big' ? [523, 659, 784, 1047] : kind === 'bright' ? [659, 988] : [784];
    const t0 = audio.currentTime;
    notes.forEach((freq, i) => {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = t0 + i * 0.09;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.5 * vol, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.45);
      osc.connect(gain).connect(audio.destination);
      osc.start(start);
      osc.stop(start + 0.5);
    });
  } catch { /* no audio device: stay silent */ }
}

// ------------------------------------------------------------ helpers

function withAlpha(hex, alpha) {
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6) return `rgba(0,0,0,${alpha})`;
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
