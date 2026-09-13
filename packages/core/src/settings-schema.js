/**
 * Single source of truth for the chat overlay's settings.
 *
 * This one file drives three things:
 *   1. parsing the overlay's Browser Source URL,
 *   2. generating every control on the settings screen,
 *   3. validating values so a malformed URL can never blank the overlay on stream.
 *
 * Adding an option here makes it appear in the settings UI automatically -- there
 * is no second place to edit. Runs unchanged in Node and in the browser.
 */

/** @typedef {'select'|'number'|'color'|'text'|'toggle'|'list'} ControlKind */

export const GROUPS = [
  { id: 'layout', label: 'Layout' },
  { id: 'size', label: 'Size & spacing' },
  { id: 'background', label: 'Message background' },
  { id: 'border', label: 'Border' },
  { id: 'text', label: 'Text' },
  { id: 'platform', label: 'Platform display' },
  { id: 'behaviour', label: 'Behaviour' },
];

/**
 * `showIf` hides a control when it doesn't apply (e.g. card width is vertical-only).
 * The settings screen honours it; the overlay ignores it.
 */
export const CHAT_SETTINGS = {
  // ---- Layout -------------------------------------------------------------
  layout: {
    group: 'layout', kind: 'select', default: 'vertical',
    options: ['vertical', 'horizontal'],
    label: 'Layout',
    help: 'Vertical is a column down the side. Horizontal is a band across the top or bottom.',
  },
  anchor: {
    group: 'layout', kind: 'select', default: 'left',
    options: ['left', 'right', 'top', 'bottom'],
    label: 'Screen edge',
    help: 'Which edge the chat hugs. Icons and accents flip to match.',
  },
  flow: {
    group: 'layout', kind: 'select', default: 'newest-bottom',
    options: ['newest-bottom', 'newest-top', 'newest-left', 'newest-right'],
    label: 'New messages appear',
  },
  cardWidth: {
    group: 'layout', kind: 'number', default: 320, min: 120, max: 800, step: 10,
    label: 'Card width', unit: 'px', showIf: { layout: 'horizontal' },
  },
  cardLines: {
    group: 'layout', kind: 'number', default: 3, min: 1, max: 6, step: 1,
    label: 'Lines before cut off', showIf: { layout: 'horizontal' },
    help: 'A horizontal band cannot grow, so long messages are trimmed.',
  },

  // ---- Size ---------------------------------------------------------------
  scale: {
    group: 'size', kind: 'number', default: 100, min: 50, max: 200, step: 5,
    label: 'Overall size', unit: '%',
    help: 'The one knob to fix "too small on stream". Scales everything at once.',
  },
  fontSize: { group: 'size', kind: 'number', default: 18, min: 8, max: 72, step: 1, label: 'Text size', unit: 'px' },
  font: { group: 'size', kind: 'text', default: 'Inter', label: 'Font' },
  gap: { group: 'size', kind: 'number', default: 8, min: 0, max: 60, step: 1, label: 'Space between messages', unit: 'px' },
  padding: { group: 'size', kind: 'number', default: 10, min: 0, max: 48, step: 1, label: 'Space inside a message', unit: 'px' },
  maxMessages: { group: 'size', kind: 'number', default: 25, min: 1, max: 100, step: 1, label: 'Messages kept on screen' },
  avatar: { group: 'size', kind: 'number', default: 0, min: 0, max: 96, step: 2, label: 'Profile picture size', unit: 'px', help: '0 turns profile pictures off.' },

  // ---- Background ---------------------------------------------------------
  msgBg: {
    group: 'background', kind: 'select', default: 'platform',
    options: ['platform', 'flat', 'none'],
    label: 'Message background',
    help: 'Platform tints each message by where it came from. Flat uses one colour. None is fully transparent.',
  },
  bgOpacity: { group: 'background', kind: 'number', default: 45, min: 0, max: 100, step: 1, label: 'Background transparency', unit: '%', help: '0 is fully see-through.' },
  bgColor: { group: 'background', kind: 'color', default: '#000000', label: 'Background colour', showIf: { msgBg: 'flat' } },
  bgTint: { group: 'background', kind: 'number', default: 35, min: 0, max: 100, step: 1, label: 'Platform tint strength', unit: '%', showIf: { msgBg: 'platform' } },

  // ---- Border -------------------------------------------------------------
  border: {
    group: 'border', kind: 'select', default: 'accent-left',
    options: ['none', 'solid', 'accent-left', 'accent-top', 'glow', 'pill', 'outline'],
    label: 'Border style',
    help: 'Accent draws a coloured bar on one edge -- the quickest way to read the platform at a glance.',
  },
  borderWidth: { group: 'border', kind: 'number', default: 3, min: 0, max: 20, step: 1, label: 'Border thickness', unit: 'px' },
  borderColor: { group: 'border', kind: 'color', default: 'platform', label: 'Border colour', allowPlatform: true },
  radius: { group: 'border', kind: 'number', default: 10, min: 0, max: 40, step: 1, label: 'Corner rounding', unit: 'px' },

  // ---- Text ---------------------------------------------------------------
  textColor: { group: 'text', kind: 'color', default: '#ffffff', label: 'Message colour' },
  nameColor: { group: 'text', kind: 'color', default: 'user', label: 'Name colour', allowPlatform: true, allowUser: true, help: 'User keeps each chatter’s own colour.' },
  nameWeight: { group: 'text', kind: 'select', default: '700', options: ['400', '500', '600', '700', '800', '900'], label: 'Name boldness' },
  shadow: { group: 'text', kind: 'select', default: 'outline', options: ['none', 'soft', 'hard', 'outline'], label: 'Text edge', help: 'Keeps text readable over moving video.' },
  case: { group: 'text', kind: 'select', default: 'normal', options: ['normal', 'upper'], label: 'Name capitals' },

  // ---- Platform -----------------------------------------------------------
  icons: { group: 'platform', kind: 'toggle', default: true, label: 'Show platform icons' },
  iconStyle: { group: 'platform', kind: 'select', default: 'color', options: ['color', 'mono', 'badge'], label: 'Icon style', showIf: { icons: true } },
  iconPos: { group: 'platform', kind: 'select', default: 'before-name', options: ['before-name', 'after-name', 'corner'], label: 'Icon position', showIf: { icons: true } },
  iconSize: { group: 'platform', kind: 'number', default: 18, min: 8, max: 48, step: 1, label: 'Icon size', unit: 'px', showIf: { icons: true } },
  platforms: { group: 'platform', kind: 'list', default: [], label: 'Show only these platforms', help: 'Leave empty for all. Lets you run a Twitch-only overlay beside a merged one.' },
  badges: { group: 'platform', kind: 'toggle', default: true, label: 'Show mod / sub badges' },

  // ---- Behaviour ----------------------------------------------------------
  fade: { group: 'behaviour', kind: 'number', default: 0, min: 0, max: 600, step: 1, label: 'Hide messages after', unit: 'sec', help: '0 keeps them until they scroll off.' },
  animIn: { group: 'behaviour', kind: 'select', default: 'slide', options: ['fade', 'slide', 'pop', 'none'], label: 'Entrance animation' },
  hideCommands: { group: 'behaviour', kind: 'toggle', default: true, label: 'Hide !commands' },
  hideBots: { group: 'behaviour', kind: 'list', default: ['nightbot', 'streamelements', 'streamlabs', 'moobot', 'fossabot', 'sery_bot', 'botrix'], label: 'Hide these bots' },
  hideUsers: { group: 'behaviour', kind: 'list', default: [], label: 'Hide these users' },
  emotes: { group: 'behaviour', kind: 'toggle', default: true, label: 'Show emotes' },
  dedupe: { group: 'behaviour', kind: 'toggle', default: false, label: 'Collapse duplicate messages' },
  preview: { group: 'behaviour', kind: 'toggle', default: false, label: 'Preview mode', help: 'Shows fake messages so you can style it without being live.' },
  theme: { group: 'behaviour', kind: 'text', default: 'default', label: 'Theme preset' },
};

/** One-click looks. Individual settings still override a preset. */
export const THEMES = {
  default: {},
  minimal: { msgBg: 'none', border: 'none', shadow: 'outline', icons: true, iconStyle: 'mono', gap: 4 },
  cards: { msgBg: 'platform', border: 'solid', borderWidth: 1, radius: 14, bgOpacity: 70, bgTint: 45, padding: 12 },
  neon: { msgBg: 'flat', bgColor: '#0b0b16', bgOpacity: 70, border: 'glow', borderWidth: 2, radius: 12, nameColor: 'platform', shadow: 'soft' },
  clean: { msgBg: 'flat', bgColor: '#ffffff', bgOpacity: 88, textColor: '#14141c', border: 'accent-left', borderWidth: 4, shadow: 'none', nameColor: 'platform' },
  ticker: { layout: 'horizontal', anchor: 'bottom', msgBg: 'flat', bgOpacity: 30, border: 'accent-top', radius: 6, fade: 30 },
};

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

function coerce(spec, raw) {
  switch (spec.kind) {
    case 'number': {
      const n = Number(raw);
      if (!Number.isFinite(n)) return spec.default;
      return clamp(n, spec.min ?? -Infinity, spec.max ?? Infinity);
    }
    case 'toggle': {
      const v = String(raw).toLowerCase();
      if (['on', 'true', '1', 'yes'].includes(v)) return true;
      if (['off', 'false', '0', 'no'].includes(v)) return false;
      return spec.default;
    }
    case 'select':
      return spec.options.includes(String(raw)) ? String(raw) : spec.default;
    case 'color': {
      const v = String(raw);
      if (spec.allowPlatform && v === 'platform') return v;
      if (spec.allowUser && v === 'user') return v;
      return /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : spec.default;
    }
    case 'list':
      return String(raw)
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
    case 'text':
    default:
      return String(raw).slice(0, 120);
  }
}

/**
 * Turn a query string into a complete, valid settings object.
 * Unknown parameters are ignored; invalid values fall back to their default.
 * @param {string|URLSearchParams} query
 * @param {object} [schema]
 */
export function parseSettings(query, schema = CHAT_SETTINGS) {
  const params = query instanceof URLSearchParams ? query : new URLSearchParams(query || '');
  const out = {};

  // A theme preset is applied first so explicit parameters win over it.
  const themeName = params.get('theme');
  const preset = (themeName && THEMES[themeName]) || {};

  for (const [key, spec] of Object.entries(schema)) {
    out[key] = key in preset ? preset[key] : structuredCloneish(spec.default);
  }
  for (const [key, spec] of Object.entries(schema)) {
    if (params.has(key)) out[key] = coerce(spec, params.get(key));
  }

  // Per-platform background overrides: bgColor.twitch=#aabbcc. The key is built from
  // the adapter id, so a new platform is overridable with no code change here.
  out.platformBg = {};
  for (const [key, value] of params.entries()) {
    const m = /^bgColor\.([a-z0-9_-]+)$/i.exec(key);
    if (m && /^#[0-9a-fA-F]{3,8}$/.test(value)) out.platformBg[m[1].toLowerCase()] = value;
  }

  // Defaults differ per layout; only correct them when not explicitly set.
  if (out.layout === 'horizontal') {
    if (!params.has('anchor') && !('anchor' in preset)) out.anchor = 'bottom';
    if (!params.has('flow') && !('flow' in preset)) out.flow = 'newest-right';
  }
  if (out.layout === 'vertical' && !['left', 'right'].includes(out.anchor)) out.anchor = 'left';
  if (out.layout === 'horizontal' && !['top', 'bottom'].includes(out.anchor)) out.anchor = 'bottom';

  return out;
}

/** Serialize settings back to a query string, omitting anything at its default. */
export function toQuery(settings, schema = CHAT_SETTINGS) {
  const params = new URLSearchParams();
  for (const [key, spec] of Object.entries(schema)) {
    const value = settings[key];
    if (value === undefined) continue;
    const isDefault = Array.isArray(spec.default)
      ? Array.isArray(value) && value.join(',') === spec.default.join(',')
      : value === spec.default;
    if (isDefault) continue;
    if (spec.kind === 'toggle') params.set(key, value ? 'on' : 'off');
    else if (spec.kind === 'list') {
      if (value.length) params.set(key, value.join(','));
    } else params.set(key, String(value));
  }
  for (const [platform, color] of Object.entries(settings.platformBg || {})) {
    params.set(`bgColor.${platform}`, color);
  }
  return params.toString();
}

/** Whether a control applies given the current values. */
export function isVisible(spec, settings) {
  if (!spec.showIf) return true;
  return Object.entries(spec.showIf).every(([k, v]) => settings[k] === v);
}

function structuredCloneish(v) {
  return Array.isArray(v) ? [...v] : v;
}
