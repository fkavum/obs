/**
 * Rehearsal: a pretend stream to check everything against before going live.
 *
 * The important decision here is that this drives the REAL toolkit. The stage
 * is the actual overlays in iframes at 1920x1080, styled with the settings you
 * saved, connected to the real bridge; the chat box posts real events through
 * the real adapters. A separate simulator would be a second thing to keep in
 * step with the module and adapter contracts, and the day it drifted you'd be
 * rehearsing against something that no longer resembles your stream.
 */
import { OVERLAYS } from '/core/settings-schema.js';
import { mountNav, STREAM_SECTION } from '/nav.js';

const STAGE_W = 1920;
const STAGE_H = 1080;
const ON_KEY = 'rehearsal-overlays-on';

const frame = document.getElementById('frame');
const stageBox = document.getElementById('stageBox');
const layers = document.getElementById('layers');
const backdrop = document.getElementById('backdrop');
const video = document.getElementById('video');
const toastEl = document.getElementById('toast');

let toastTimer;
let overlays = [];
// Declared up here on purpose: this file runs top-level calls (loadEverything,
// buildToggles) before the rest of the file is evaluated, so any state those
// calls touch has to exist by now. A `let` further down is still in its
// temporal dead zone and throws the moment it is read.
let quickLines = [];
let clipTimer = null;
const NOTHING = 'inset(100%)';
let platforms = [];
let on = loadOn();

mountNav(document.getElementById('nav'), { section: STREAM_SECTION, page: 'rehearsal' });

await loadEverything();
buildToggles();
buildQuickLines();
buildAlerts();
fit();
new ResizeObserver(fit).observe(frame);
window.addEventListener('resize', fit);

// ------------------------------------------------------------ what exists

async function loadEverything() {
  // Built-in overlays first, then whatever the feature modules provide — this
  // page never names an overlay or a module.
  overlays = Object.values(OVERLAYS).map((o) => ({
    id: o.id, label: o.label, path: o.path,
  }));
  try {
    const body = await (await fetch('/api/modules')).json();
    for (const o of body.overlays || []) {
      overlays.push({ id: `${o.module}.${o.id}`, label: o.label, path: o.path });
    }
    quickLines = body.previewMessages || [];
  } catch { /* no modules is fine */ }

  try {
    const body = await (await fetch('/api/platforms')).json();
    platforms = body.platforms || [];
  } catch {
    platforms = [];
  }

  const select = document.getElementById('asPlatform');
  const usable = platforms.filter((p) => p.enabled && p.id !== 'fake');
  for (const p of usable.length ? usable : platforms) {
    const option = document.createElement('option');
    option.value = p.id;
    option.textContent = p.label;
    select.append(option);
  }
  if (!select.options.length) {
    const option = document.createElement('option');
    option.value = 'fake';
    option.textContent = 'Demo';
    select.append(option);
  }

  const demo = platforms.find((p) => p.id === 'fake');
  document.getElementById('demoChat').checked = !!demo?.enabled;
}

/**
 * The URL an overlay is actually styled with. The settings screen saves each
 * overlay's query string, so the rehearsal shows what you'll stream rather than
 * the defaults — otherwise you'd be checking a version of your overlay that
 * exists nowhere.
 */
function urlFor(overlay) {
  let query = '';
  try {
    query = localStorage.getItem(`${overlay.id}-overlay-query`) || '';
  } catch { /* private window */ }
  return `${overlay.path}${query ? `?${query}` : ''}`;
}

// ------------------------------------------------------------ the stage

function buildToggles() {
  const host = document.getElementById('toggles');
  host.replaceChildren();
  for (const overlay of overlays) {
    const label = document.createElement('label');
    label.className = 'check chip';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = on[overlay.id] !== false;
    box.addEventListener('change', () => {
      on[overlay.id] = box.checked;
      saveOn();
      paintLayers();
    });
    const text = document.createElement('span');
    text.textContent = overlay.label;
    label.append(box, text);
    host.append(label);
  }
  paintLayers();
}

/**
 * Each overlay is its own iframe, added and removed rather than hidden: an
 * overlay left running behind a hidden layer still holds a WebSocket and still
 * animates, which is exactly the load you were trying to judge.
 */
function paintLayers() {
  const wanted = overlays.filter((o) => on[o.id] !== false);
  const have = new Map([...layers.children].map((el) => [el.dataset.overlay, el]));

  for (const [id, el] of have) {
    if (!wanted.some((o) => o.id === id)) el.remove();
  }
  for (const overlay of wanted) {
    if (have.has(overlay.id)) continue;
    const el = document.createElement('iframe');
    el.dataset.overlay = overlay.id;
    el.title = overlay.label;
    el.width = STAGE_W;
    el.height = STAGE_H;
    el.src = urlFor(overlay);
    el.addEventListener('load', () => clipLater(el));
    layers.append(el);
  }
  startClipping();
}

/**
 * Chrome paints every iframe on an opaque white base — there is no attribute or
 * CSS that makes one see-through, and `allowtransparency` has done nothing for
 * years. Stacked naively, the top overlay would be a white sheet over the rest.
 *
 * So each frame is clipped to exactly the boxes its overlay is currently
 * drawing in. Everywhere else the frame is cut away and the layer beneath —
 * ultimately the backdrop — shows through. Same origin, so the measuring is
 * just getBoundingClientRect inside each document.
 */
function startClipping() {
  if (clipTimer) return;
  // One timer for every layer. 8 fps is invisible to the eye for this and
  // costs a handful of rect reads — a per-frame clip would be a layout storm.
  clipTimer = setInterval(() => {
    for (const el of layers.children) clipToContent(el);
  }, 125);
}

function clipLater(el) {
  // A freshly loaded frame has nothing in it yet; cut it away entirely rather
  // than let a white rectangle flash over the stage.
  el.style.clipPath = NOTHING;
  setTimeout(() => clipToContent(el), 60);
}

function clipToContent(el) {
  let boxes;
  try {
    boxes = visibleBoxes(el.contentDocument);
  } catch {
    return;
  }
  if (!boxes.length) {
    el.style.clipPath = NOTHING;
    return;
  }
  // One path with a subpath per box: SVG's fill rule unions them, which plain
  // clip-path shapes cannot do.
  const pad = 24; // soft shadows and glows live outside the measured box
  const path = boxes.map(({ x, y, w, h }) =>
    `M${Math.round(x - pad)},${Math.round(y - pad)}h${Math.round(w + pad * 2)}v${Math.round(h + pad * 2)}h${-Math.round(w + pad * 2)}Z`).join('');
  el.style.clipPath = `path('${path}')`;
}

/**
 * The boxes an overlay actually paints in.
 *
 * The rule is "does this element put anything on the screen" — a background, a
 * border, text, or a picture — rather than anything about its size. A guess
 * based on size gets an empty full-screen wrapper wrong, and an overlay that
 * claims the whole stage puts a white sheet over everything beneath it.
 */
function visibleBoxes(doc) {
  if (!doc?.body) return [];
  const view = doc.defaultView;
  if (!view) return [];
  const out = [];

  const paints = (el, style) => {
    if (['IMG', 'SVG', 'CANVAS', 'VIDEO', 'PICTURE'].includes(el.tagName)) return true;
    if (style.backgroundColor && !/^rgba\(0, 0, 0, 0\)$|^transparent$/.test(style.backgroundColor)) return true;
    if (style.backgroundImage && style.backgroundImage !== 'none') return true;
    if (Number.parseFloat(style.borderTopWidth) > 0 || Number.parseFloat(style.borderLeftWidth) > 0) return true;
    if (style.boxShadow && style.boxShadow !== 'none') return true;
    // Text directly inside this element, rather than in a descendant.
    for (const node of el.childNodes) {
      if (node.nodeType === 3 && node.textContent.trim()) return true;
    }
    return false;
  };

  const look = (node, depth) => {
    if (out.length > 60 || depth > 8) return;
    for (const el of node.children) {
      if (el.hidden || el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'LINK') continue;
      const style = view.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      if (paints(el, style)) {
        out.push({ x: r.left, y: r.top, w: r.width, h: r.height });
        // Its children are inside its box, so there is nothing more to add.
        continue;
      }
      look(el, depth + 1);
    }
  };
  look(doc.body, 0);
  return out;
}

function fit() {
  const width = frame.clientWidth;
  const scale = width / STAGE_W;
  stageBox.style.transform = `scale(${scale})`;
  frame.style.height = `${Math.round(STAGE_H * scale)}px`;
}

document.getElementById('scene').addEventListener('change', (e) => {
  backdrop.dataset.scene = e.target.value;
});

document.getElementById('videoFile').addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  // Stays on this machine: an object URL, never an upload.
  video.src = URL.createObjectURL(file);
  video.hidden = false;
  video.play().catch(() => toast('Click the video once to start it'));
  backdrop.dataset.scene = 'none';
  document.getElementById('clearVideo').hidden = false;
});

document.getElementById('clearVideo').addEventListener('click', () => {
  video.pause();
  if (video.src.startsWith('blob:')) URL.revokeObjectURL(video.src);
  video.removeAttribute('src');
  video.hidden = true;
  document.getElementById('clearVideo').hidden = true;
  document.getElementById('videoFile').value = '';
  backdrop.dataset.scene = document.getElementById('scene').value;
});

// ------------------------------------------------------------ the director

function buildQuickLines() {
  const host = document.getElementById('quick');
  host.replaceChildren();
  const lines = [...new Set(quickLines)].slice(0, 14);
  for (const line of lines) {
    const button = document.createElement('button');
    button.className = 'chip';
    button.textContent = line;
    button.addEventListener('click', () => say(line));
    host.append(button);
  }
}

function buildAlerts() {
  const host = document.getElementById('alerts');
  const kinds = [
    ['follow', 'New follower'],
    ['subscription', 'Subscription'],
    ['donation', 'Donation'],
    ['raid', 'Raid'],
  ];
  for (const [type, label] of kinds) {
    const button = document.createElement('button');
    button.className = 'chip';
    button.textContent = label;
    button.addEventListener('click', () => fire({ type }));
    host.append(button);
  }
}

const lineInput = document.getElementById('line');
document.getElementById('send').addEventListener('click', () => say(lineInput.value));
lineInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') say(lineInput.value);
});

function say(text) {
  const message = String(text || '').trim();
  if (!message) return;
  // Wearing your own badge or not: a command only you may run has to be
  // testable here, and so does what everyone else sees when they try it.
  const asStreamer = document.getElementById('asStreamer').checked;
  const line = { type: 'chat', text: message, user: document.getElementById('who').value.trim() || 'PixelPete' };
  // Unchecked, the line keeps the mixed badges the pretend chat gives it, which
  // is what the chat overlay is being styled against.
  if (asStreamer) Object.assign(line, { user: 'You', roles: ['broadcaster'] });
  fire(line);
  if (lineInput.value.trim() === message) lineInput.value = '';
}

async function fire(body) {
  try {
    const res = await fetch('/api/test-event', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ platform: document.getElementById('asPlatform').value, ...body }),
    });
    if (!res.ok) throw new Error(String(res.status));
  } catch {
    toast('The toolkit is not running — start it and reload this page');
  }
}

document.getElementById('demoChat').addEventListener('change', async (e) => {
  const enabled = e.target.checked;
  try {
    await fetch('/api/platforms/fake/enabled', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    toast(enabled ? 'Demo chat is talking' : 'Demo chat stopped');
  } catch {
    toast('Could not reach the toolkit');
    e.target.checked = !enabled;
  }
});

document.getElementById('burst').addEventListener('click', async () => {
  // Spaced out rather than all at once: a burst that arrives in one tick tests
  // nothing about how the overlays queue and settle.
  const lines = [...quickLines, 'LETS GOOO', 'first time here, this looks sick', 'W stream'];
  for (let i = 0; i < 8; i++) {
    const line = lines[Math.floor(Math.random() * lines.length)];
    setTimeout(() => {
      fire({ type: 'chat', text: line, user: randomName() });
    }, i * 320);
  }
});

const NAMES = ['PixelPete', 'sarah_streams', 'GG_Melody', 'NoScopeNina', 'kebab_lord',
  'AylinPlays', 'CtrlAltDefeat', 'zeynep.exe', 'lurker_99', 'BigBossBora'];
const randomName = () => NAMES[Math.floor(Math.random() * NAMES.length)];

// ------------------------------------------------------------ helpers

function loadOn() {
  try {
    return JSON.parse(localStorage.getItem(ON_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveOn() {
  try {
    localStorage.setItem(ON_KEY, JSON.stringify(on));
  } catch { /* private window */ }
}

function toast(message) {
  toastEl.textContent = message;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2600);
}

window.addEventListener('pagehide', () => {
  clearInterval(clipTimer);
  clipTimer = null;
});
