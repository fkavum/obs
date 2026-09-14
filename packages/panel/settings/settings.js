/**
 * Visual settings screen for the chat overlay.
 *
 * Every control here is generated from the selected overlay's schema in the
 * OVERLAYS registry -- the same schema that overlay parses. Adding an option to
 * a schema makes a control appear here, and adding an overlay to the registry
 * gives it a tab, a preview and a Copy URL button, with no edit to this file.
 */
import { OVERLAYS, parseSettings, toQuery, isVisible } from '/core/settings-schema.js';

// Which overlay this screen is editing: /settings/?overlay=alerts. Everything
// below reads from the registry entry, so a new overlay needs no code here.
const overlayId = new URLSearchParams(location.search).get('overlay') || 'chat';
const overlay = OVERLAYS[overlayId] || OVERLAYS.chat;
const STORAGE_KEY = `${overlay.id}-overlay-query`;

const controlsEl = document.getElementById('controls');
const themesEl = document.getElementById('themes');
const previewEl = document.getElementById('preview');
const urlEl = document.getElementById('url');
const toastEl = document.getElementById('toast');
const fakeToggle = document.getElementById('fakeToggle');

// Declared before first use: update() runs during module evaluation, and a `let`
// further down the file would still be in its temporal dead zone.
let debounce;
let toastTimer;
let settings = parseSettings(location.search.slice(1), overlay.schema, overlay.themes);
let activeTheme = new URLSearchParams(location.search).get('theme') || 'default';
let platforms = [];

// Remember the last look between visits; the URL still wins if one is given.
// (the overlay= param alone doesn't count as "settings were given")
if (![...new URLSearchParams(location.search).keys()].some((k) => k !== 'overlay')) {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      settings = parseSettings(saved, overlay.schema, overlay.themes);
      activeTheme = new URLSearchParams(saved).get('theme') || 'default';
    }
  } catch { /* private window: just use defaults */ }
}

platforms = await loadPlatforms();
paintChrome();
// Nothing connected yet? Then the preview has to fake it to be useful.
fakeToggle.checked = !platforms.some((p) => p.connected && p.id !== 'fake');

renderThemes();
renderControls();
update();

document.getElementById('copy').addEventListener('click', () => {
  const url = overlayUrl(false);
  navigator.clipboard?.writeText(url).then(
    () => toast('Copied — paste it into your OBS Browser Source'),
    () => toast('Could not copy; select the link and copy it yourself'),
  );
});

document.getElementById('reset').addEventListener('click', () => {
  settings = parseSettings('', overlay.schema, overlay.themes);
  activeTheme = 'default';
  renderControls();
  update();
  toast('Back to the default look');
});

fakeToggle.addEventListener('change', () => update());

// ------------------------------------------------------------ chrome

function paintChrome() {
  document.title = `${overlay.label} style`;
  document.getElementById('title').textContent = `${overlay.label} style`;
  fakeToggle.parentElement.querySelector('span').textContent = overlay.fakeLabel;
  document.getElementById('obsSize').textContent = `${overlay.obsSize.width} × ${overlay.obsSize.height}`;

  const tabs = document.getElementById('tabs');
  tabs.innerHTML = '<a href="/">Setup</a>';
  for (const o of Object.values(OVERLAYS)) {
    const a = document.createElement('a');
    a.href = `/settings/?overlay=${o.id}`;
    a.textContent = `${o.label} style`;
    if (o.id === overlay.id) a.setAttribute('aria-current', 'page');
    tabs.append(a);
  }

  const testRow = document.getElementById('testRow');
  if (!overlay.testEvents) {
    testRow.hidden = true;
    return;
  }
  testRow.hidden = false;
  testRow.innerHTML = '<span class="pill">Send a test alert to OBS</span>';
  for (const t of overlay.testEvents) {
    const btn = document.createElement('button');
    btn.textContent = t.label;
    btn.addEventListener('click', async () => {
      const res = await fetch('/api/test-event', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: t.type }),
      }).catch(() => null);
      toast(res?.ok ? `Test ${t.label.toLowerCase()} sent — watch OBS (and the preview if fake alerts are off)` : 'Could not reach the toolkit');
    });
    testRow.append(btn);
  }
}

// ------------------------------------------------------------ rendering

async function loadPlatforms() {
  try {
    const [manifests, status] = await Promise.all([
      fetch('/api/platforms').then((r) => r.json()),
      fetch('/api/status').then((r) => r.json()).catch(() => ({ platforms: [] })),
    ]);
    return manifests.platforms.map((p) => ({
      ...p,
      connected: !!status.platforms?.find((s) => s.id === p.id)?.connected,
    }));
  } catch {
    return [];
  }
}

function renderThemes() {
  themesEl.innerHTML = '<span class="pill" style="margin-right:4px">Quick looks</span>';
  for (const name of Object.keys(overlay.themes)) {
    const btn = document.createElement('button');
    btn.textContent = name;
    btn.setAttribute('aria-pressed', String(name === activeTheme));
    btn.addEventListener('click', () => {
      activeTheme = name;
      // Apply the preset over a clean slate so switching looks is predictable.
      settings = parseSettings(`theme=${name}`, overlay.schema, overlay.themes);
      renderThemes();
      renderControls();
      update();
    });
    themesEl.append(btn);
  }
}

function renderControls() {
  controlsEl.innerHTML = '';

  for (const group of overlay.groups) {
    const entries = Object.entries(overlay.schema).filter(([, spec]) => spec.group === group.id);
    if (!entries.length) continue;

    const details = document.createElement('details');
    details.className = 'group';
    details.open = overlay.openGroups.includes(group.id);
    const summary = document.createElement('summary');
    summary.textContent = group.label;
    const body = document.createElement('div');
    body.className = 'body';

    for (const [key, spec] of entries) {
      if (key === 'theme') continue; // handled by the Quick looks row
      const ctl = buildControl(key, spec);
      if (ctl) body.append(ctl);
    }

    if (group.id === 'background' || group.id === 'look') body.append(platformColorControls());

    details.append(summary, body);
    controlsEl.append(details);
  }
  applyVisibility();
}

function buildControl(key, spec) {
  const wrap = document.createElement('div');
  wrap.className = 'ctl';
  wrap.dataset.key = key;

  if (spec.kind === 'toggle') {
    const label = document.createElement('label');
    label.className = 'switch';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = !!settings[key];
    input.addEventListener('change', () => set(key, input.checked));
    const span = document.createElement('span');
    span.textContent = spec.label;
    label.append(input, span);
    wrap.append(label);
    if (spec.help) wrap.append(help(spec.help));
    return wrap;
  }

  const lab = document.createElement('div');
  lab.className = 'lab';
  lab.innerHTML = `<span>${escape(spec.label)}</span>`;
  const val = document.createElement('span');
  val.className = 'val';
  lab.append(val);
  wrap.append(lab);

  switch (spec.kind) {
    case 'number': {
      const input = document.createElement('input');
      input.type = 'range';
      input.min = spec.min ?? 0;
      input.max = spec.max ?? 100;
      input.step = spec.step ?? 1;
      input.value = settings[key];
      val.textContent = `${settings[key]}${spec.unit || ''}`;
      input.addEventListener('input', () => {
        val.textContent = `${input.value}${spec.unit || ''}`;
        set(key, Number(input.value));
      });
      wrap.append(input);
      break;
    }
    case 'select': {
      const select = document.createElement('select');
      for (const option of spec.options) {
        const o = document.createElement('option');
        o.value = option;
        o.textContent = prettify(option);
        o.selected = String(settings[key]) === option;
        select.append(o);
      }
      select.addEventListener('change', () => set(key, select.value));
      wrap.append(select);
      break;
    }
    case 'color': {
      const swap = document.createElement('div');
      swap.className = 'swap';
      const special = [spec.allowPlatform && 'platform', spec.allowUser && 'user'].filter(Boolean);
      const current = settings[key];

      const picker = document.createElement('input');
      picker.type = 'color';
      picker.value = /^#[0-9a-f]{6}$/i.test(current) ? current : '#ffffff';
      picker.addEventListener('input', () => set(key, picker.value));

      if (special.length) {
        const mode = document.createElement('select');
        for (const option of [...special, 'custom']) {
          const o = document.createElement('option');
          o.value = option;
          o.textContent = { platform: 'Match the platform', user: "The chatter's own colour", custom: 'Pick a colour' }[option];
          o.selected = special.includes(current) ? current === option : option === 'custom';
          mode.append(o);
        }
        mode.addEventListener('change', () => {
          picker.style.display = mode.value === 'custom' ? '' : 'none';
          set(key, mode.value === 'custom' ? picker.value : mode.value);
        });
        picker.style.display = special.includes(current) ? 'none' : '';
        swap.append(mode, picker);
      } else {
        swap.append(picker);
      }
      wrap.append(swap);
      break;
    }
    case 'list': {
      const input = document.createElement('input');
      input.type = 'text';
      input.value = (settings[key] || []).join(', ');
      input.placeholder = 'Separate names with commas';
      input.addEventListener('change', () => {
        set(key, input.value.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
      });
      wrap.append(input);
      break;
    }
    case 'text':
    default: {
      const input = document.createElement('input');
      input.type = 'text';
      input.value = settings[key];
      input.addEventListener('change', () => set(key, input.value));
      wrap.append(input);
    }
  }

  if (spec.help) wrap.append(help(spec.help));
  return wrap;
}

/** Per-platform background overrides, built from whatever adapters exist. */
function platformColorControls() {
  const wrap = document.createElement('div');
  wrap.className = 'ctl';
  if (!platforms.length) return wrap;

  wrap.innerHTML = '<div class="lab"><span>Colour per platform</span></div>';
  const row = document.createElement('div');
  row.className = 'row';

  for (const p of platforms) {
    const holder = document.createElement('label');
    holder.className = 'swap';
    holder.style.gap = '6px';
    holder.title = `${p.label} message colour`;

    const picker = document.createElement('input');
    picker.type = 'color';
    picker.value = settings.platformBg?.[p.id] || p.color;
    picker.addEventListener('input', () => {
      settings.platformBg = { ...(settings.platformBg || {}), [p.id]: picker.value };
      update();
    });

    const name = document.createElement('span');
    name.style.fontSize = '12px';
    name.style.color = 'var(--muted)';
    name.textContent = p.label;

    holder.append(picker, name);
    row.append(holder);
  }

  const reset = document.createElement('button');
  reset.className = 'ghost';
  reset.style.fontSize = '12px';
  reset.textContent = 'Use each platform’s own colour';
  reset.addEventListener('click', () => {
    settings.platformBg = {};
    renderControls();
    update();
  });

  wrap.append(row, reset);
  wrap.append(help('Only used when the background is set to Platform.'));
  return wrap;
}

function help(text) {
  const el = document.createElement('div');
  el.className = 'help';
  el.textContent = text;
  return el;
}

// ------------------------------------------------------------ state

function set(key, value) {
  settings[key] = value;
  // A hand edit means the preset no longer describes the look.
  if (activeTheme !== 'default') {
    activeTheme = 'default';
    renderThemes();
  }
  applyVisibility();
  update();
}

/** Hide controls that don't apply to the current choices. */
function applyVisibility() {
  for (const el of controlsEl.querySelectorAll('.ctl[data-key]')) {
    const spec = overlay.schema[el.dataset.key];
    if (spec) el.hidden = !isVisible(spec, settings);
  }
}

function overlayUrl(forPreview) {
  const query = toQuery(settings, overlay.schema);
  const params = new URLSearchParams(query);
  if (forPreview && fakeToggle.checked) params.set('preview', 'on');
  const q = params.toString();
  return `${location.origin}${overlay.path}${q ? `?${q}` : ''}`;
}

function update() {
  urlEl.value = overlayUrl(false);
  try {
    localStorage.setItem(STORAGE_KEY, toQuery(settings, overlay.schema));
  } catch { /* private window */ }

  // Reloading the frame is fine: the overlay pulls recent messages on connect,
  // so the preview repopulates immediately instead of flashing empty.
  clearTimeout(debounce);
  debounce = setTimeout(() => {
    previewEl.src = overlayUrl(true);
  }, 200);
}

// ------------------------------------------------------------ helpers

function prettify(value) {
  return String(value).replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
}

function escape(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
