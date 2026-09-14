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
      return String(raw).slice(0, spec.maxLength ?? 120);
  }
}

/**
 * Turn a query string into a complete, valid settings object.
 * Unknown parameters are ignored; invalid values fall back to their default.
 * @param {string|URLSearchParams} query
 * @param {object} [schema]
 */
export function parseSettings(query, schema = CHAT_SETTINGS, themes = THEMES) {
  const params = query instanceof URLSearchParams ? query : new URLSearchParams(query || '');
  const out = {};

  // A theme preset is applied first so explicit parameters win over it.
  const themeName = params.get('theme');
  const preset = (themeName && themes[themeName]) || {};

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

  // Chat-only: defaults differ per layout; only correct them when not explicitly set.
  if ('layout' in schema && out.layout === 'horizontal') {
    if (!params.has('anchor') && !('anchor' in preset)) out.anchor = 'bottom';
    if (!params.has('flow') && !('flow' in preset)) out.flow = 'newest-right';
  }
  if ('layout' in schema) {
    if (out.layout === 'vertical' && !['left', 'right'].includes(out.anchor)) out.anchor = 'left';
    if (out.layout === 'horizontal' && !['top', 'bottom'].includes(out.anchor)) out.anchor = 'bottom';
  }

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

// ===========================================================================
// Alerts overlay
// ===========================================================================

export const ALERT_GROUPS = [
  { id: 'layout', label: 'Position' },
  { id: 'size', label: 'Size' },
  { id: 'look', label: 'Look' },
  { id: 'timing', label: 'Timing & animation' },
  { id: 'events', label: 'Which alerts' },
  { id: 'text', label: 'Wording' },
  { id: 'sound', label: 'Sound' },
  { id: 'behaviour', label: 'Behaviour' },
];

/**
 * Wording uses placeholders, filled from the event:
 *   {name} {platform} {amount} {currency} {tier} {months} {count} {viewers} {message}
 */
export const ALERT_SETTINGS = {
  // ---- Position -----------------------------------------------------------
  position: { group: 'layout', kind: 'select', default: 'top', options: ['top', 'center', 'bottom'], label: 'Where on the screen', help: 'Add the source at full screen size (1920×1080) and let this place the alert.' },
  align: { group: 'layout', kind: 'select', default: 'center', options: ['left', 'center', 'right'], label: 'Left / centre / right' },
  offset: { group: 'layout', kind: 'number', default: 48, min: 0, max: 400, step: 4, label: 'Distance from the edge', unit: 'px' },
  width: { group: 'layout', kind: 'number', default: 520, min: 240, max: 1200, step: 10, label: 'Alert width', unit: 'px' },

  // ---- Size ---------------------------------------------------------------
  scale: { group: 'size', kind: 'number', default: 100, min: 50, max: 200, step: 5, label: 'Overall size', unit: '%' },
  fontSize: { group: 'size', kind: 'number', default: 22, min: 12, max: 64, step: 1, label: 'Text size', unit: 'px' },
  font: { group: 'size', kind: 'text', default: 'Inter', label: 'Font' },
  padding: { group: 'size', kind: 'number', default: 18, min: 4, max: 60, step: 1, label: 'Space inside', unit: 'px' },
  iconSize: { group: 'size', kind: 'number', default: 30, min: 0, max: 96, step: 2, label: 'Platform icon size', unit: 'px', help: '0 hides the icon.' },

  // ---- Look ---------------------------------------------------------------
  bg: { group: 'look', kind: 'select', default: 'platform', options: ['platform', 'flat', 'none'], label: 'Background', help: 'Platform tints the alert by where it came from.' },
  bgOpacity: { group: 'look', kind: 'number', default: 88, min: 0, max: 100, step: 1, label: 'Background transparency', unit: '%' },
  bgColor: { group: 'look', kind: 'color', default: '#101018', label: 'Background colour', showIf: { bg: 'flat' } },
  bgTint: { group: 'look', kind: 'number', default: 45, min: 0, max: 100, step: 1, label: 'Platform tint strength', unit: '%', showIf: { bg: 'platform' } },
  textColor: { group: 'look', kind: 'color', default: '#ffffff', label: 'Text colour' },
  accent: { group: 'look', kind: 'color', default: 'platform', label: 'Highlight colour', allowPlatform: true, help: 'Used for the name, the amount and the border.' },
  border: { group: 'look', kind: 'select', default: 'glow', options: ['none', 'solid', 'glow', 'accent-left', 'accent-top'], label: 'Border style' },
  borderWidth: { group: 'look', kind: 'number', default: 2, min: 0, max: 16, step: 1, label: 'Border thickness', unit: 'px' },
  radius: { group: 'look', kind: 'number', default: 18, min: 0, max: 48, step: 1, label: 'Corner rounding', unit: 'px' },
  shadow: { group: 'look', kind: 'select', default: 'soft', options: ['none', 'soft', 'hard', 'outline'], label: 'Text edge' },

  // ---- Timing -------------------------------------------------------------
  duration: { group: 'timing', kind: 'number', default: 6, min: 2, max: 30, step: 0.5, label: 'Show each alert for', unit: 'sec' },
  pause: { group: 'timing', kind: 'number', default: 0.6, min: 0, max: 5, step: 0.1, label: 'Pause between alerts', unit: 'sec' },
  animIn: { group: 'timing', kind: 'select', default: 'pop', options: ['pop', 'slide-down', 'slide-up', 'fade'], label: 'Entrance' },
  maxQueue: { group: 'timing', kind: 'number', default: 20, min: 1, max: 100, step: 1, label: 'Most alerts waiting in line', help: 'If more pile up than this, the oldest are skipped so you never fall minutes behind.' },

  // ---- Which alerts -------------------------------------------------------
  follows: { group: 'events', kind: 'toggle', default: true, label: 'New followers' },
  subs: { group: 'events', kind: 'toggle', default: true, label: 'Subscriptions & memberships' },
  donations: { group: 'events', kind: 'toggle', default: true, label: 'Tips, bits & Super Chats' },
  raids: { group: 'events', kind: 'toggle', default: true, label: 'Raids & hosts' },
  minDonation: { group: 'events', kind: 'number', default: 0, min: 0, max: 1000, step: 1, label: 'Only show tips of at least', help: 'In the tip’s own currency; bits count as 1 each. 0 shows all.', showIf: { donations: true } },
  minRaid: { group: 'events', kind: 'number', default: 0, min: 0, max: 10000, step: 1, label: 'Only show raids of at least', unit: 'viewers', showIf: { raids: true } },
  showMessage: { group: 'events', kind: 'toggle', default: true, label: 'Show the message attached to tips and subs' },
  platforms: { group: 'events', kind: 'list', default: [], label: 'Show only these platforms', help: 'Leave empty for all.' },

  // ---- Wording ------------------------------------------------------------
  followText: { group: 'text', kind: 'text', default: '{name} just followed!', label: 'New follower', maxLength: 200 },
  subText: { group: 'text', kind: 'text', default: '{name} just subscribed!', label: 'New subscriber', maxLength: 200 },
  resubText: { group: 'text', kind: 'text', default: '{name} resubscribed for {months} months!', label: 'Returning subscriber', maxLength: 200 },
  giftText: { group: 'text', kind: 'text', default: '{name} gifted {count} subs!', label: 'Gifted subs', maxLength: 200 },
  donationText: { group: 'text', kind: 'text', default: '{name} tipped {amount}!', label: 'Tip / bits / Super Chat', maxLength: 200 },
  raidText: { group: 'text', kind: 'text', default: '{name} is raiding with {viewers} viewers!', label: 'Raid', maxLength: 200 },

  // ---- Sound --------------------------------------------------------------
  sound: { group: 'sound', kind: 'toggle', default: true, label: 'Play a sound', help: 'A built-in chime; nothing to download. Tips get a brighter one, raids a bigger one.' },
  volume: { group: 'sound', kind: 'number', default: 60, min: 0, max: 100, step: 5, label: 'Volume', unit: '%', showIf: { sound: true } },
  soundUrl: { group: 'sound', kind: 'text', default: '', label: 'Or use your own sound file (web address)', maxLength: 500, showIf: { sound: true } },

  // ---- Behaviour ----------------------------------------------------------
  preview: { group: 'behaviour', kind: 'toggle', default: false, label: 'Preview mode', help: 'Fires fake alerts so you can style it without being live.' },
  theme: { group: 'behaviour', kind: 'text', default: 'default', label: 'Theme preset' },
};

export const ALERT_THEMES = {
  default: {},
  minimal: { bg: 'none', border: 'none', shadow: 'outline', iconSize: 22, animIn: 'fade' },
  neon: { bg: 'flat', bgColor: '#0b0b16', bgOpacity: 90, border: 'glow', borderWidth: 3, accent: 'platform', animIn: 'pop' },
  clean: { bg: 'flat', bgColor: '#ffffff', bgOpacity: 94, textColor: '#14141c', border: 'accent-left', borderWidth: 5, shadow: 'none', radius: 12 },
  bold: { fontSize: 30, padding: 24, border: 'solid', borderWidth: 3, animIn: 'slide-down', duration: 7 },
  banner: { position: 'top', offset: 0, width: 1200, radius: 0, border: 'accent-top', borderWidth: 6, animIn: 'slide-down' },
};

/**
 * Every overlay the settings screen knows about. Adding an overlay here gives it
 * a tab, a live preview, a Copy URL button and per-platform colour controls -
 * the screen is built from this table, not from per-overlay code.
 */
export const OVERLAYS = {
  chat: {
    id: 'chat',
    label: 'Chat overlay',
    path: '/overlays/chat/',
    schema: CHAT_SETTINGS,
    groups: GROUPS,
    themes: THEMES,
    openGroups: ['layout', 'background', 'border'],
    obsSize: { width: 400, height: 1080 },
    fakeLabel: 'Use fake messages in this preview',
  },
  alerts: {
    id: 'alerts',
    label: 'Alerts',
    path: '/overlays/alerts/',
    schema: ALERT_SETTINGS,
    groups: ALERT_GROUPS,
    themes: ALERT_THEMES,
    openGroups: ['layout', 'look', 'events'],
    obsSize: { width: 1920, height: 1080 },
    fakeLabel: 'Fire fake alerts in this preview',
    testEvents: [
      { type: 'follow', label: 'Follow' },
      { type: 'subscription', label: 'Sub' },
      { type: 'donation', label: 'Tip' },
      { type: 'raid', label: 'Raid' },
    ],
  },
};

// ===========================================================================
// Stats bar
// ===========================================================================

export const STATS_GROUPS = [
  { id: 'show', label: 'What to show' },
  { id: 'goal', label: 'Goal bar' },
  { id: 'layout', label: 'Layout' },
  { id: 'size', label: 'Size' },
  { id: 'look', label: 'Look' },
  { id: 'behaviour', label: 'Behaviour' },
];

export const STATS_SETTINGS = {
  // ---- What to show -------------------------------------------------------
  showTotal: { group: 'show', kind: 'toggle', default: true, label: 'Total viewers across all platforms' },
  showPerPlatform: { group: 'show', kind: 'toggle', default: true, label: 'Viewers per platform' },
  showUptime: { group: 'show', kind: 'toggle', default: true, label: 'Time live' },
  showFollows: { group: 'show', kind: 'toggle', default: true, label: 'New followers this stream' },
  showSubs: { group: 'show', kind: 'toggle', default: true, label: 'New subs this stream' },
  showTips: { group: 'show', kind: 'toggle', default: false, label: 'Tips this stream' },
  showRaids: { group: 'show', kind: 'toggle', default: false, label: 'Raids this stream' },
  icons: { group: 'show', kind: 'toggle', default: true, label: 'Platform icons' },
  platforms: { group: 'show', kind: 'list', default: [], label: 'Show only these platforms', help: 'Leave empty for all.' },

  // ---- Goal ---------------------------------------------------------------
  goalType: { group: 'goal', kind: 'select', default: 'none', options: ['none', 'followers', 'subs', 'viewers', 'tips'], label: 'Goal', help: 'A progress bar toward a target.' },
  goalTarget: { group: 'goal', kind: 'number', default: 100, min: 1, max: 1000000, step: 1, label: 'Target' },
  goalStart: { group: 'goal', kind: 'number', default: 0, min: 0, max: 1000000, step: 1, label: 'Starting from', help: 'Where you already are, e.g. your follower count before the stream. Not used for viewer goals.' },
  goalLabel: { group: 'goal', kind: 'text', default: '', label: 'Label', maxLength: 60, help: 'Leave empty for "Follower goal", "Sub goal"…' },

  // ---- Layout -------------------------------------------------------------
  direction: { group: 'layout', kind: 'select', default: 'row', options: ['row', 'column'], label: 'Arrangement', help: 'Row is a bar; column is a stacked panel for a corner.' },
  align: { group: 'layout', kind: 'select', default: 'left', options: ['left', 'center', 'right'], label: 'Align' },
  gap: { group: 'layout', kind: 'number', default: 10, min: 0, max: 60, step: 1, label: 'Space between items', unit: 'px' },

  // ---- Size ---------------------------------------------------------------
  scale: { group: 'size', kind: 'number', default: 100, min: 50, max: 200, step: 5, label: 'Overall size', unit: '%' },
  fontSize: { group: 'size', kind: 'number', default: 20, min: 10, max: 64, step: 1, label: 'Text size', unit: 'px' },
  font: { group: 'size', kind: 'text', default: 'Inter', label: 'Font' },
  padding: { group: 'size', kind: 'number', default: 10, min: 0, max: 40, step: 1, label: 'Space inside each item', unit: 'px' },
  iconSize: { group: 'size', kind: 'number', default: 20, min: 10, max: 48, step: 1, label: 'Icon size', unit: 'px', showIf: { icons: true } },

  // ---- Look ---------------------------------------------------------------
  bg: { group: 'look', kind: 'select', default: 'flat', options: ['flat', 'platform', 'none'], label: 'Item background', help: 'Platform tints each platform’s chip by its colour.' },
  bgOpacity: { group: 'look', kind: 'number', default: 60, min: 0, max: 100, step: 1, label: 'Background transparency', unit: '%' },
  bgColor: { group: 'look', kind: 'color', default: '#000000', label: 'Background colour', showIf: { bg: 'flat' } },
  bgTint: { group: 'look', kind: 'number', default: 40, min: 0, max: 100, step: 1, label: 'Platform tint strength', unit: '%', showIf: { bg: 'platform' } },
  textColor: { group: 'look', kind: 'color', default: '#ffffff', label: 'Text colour' },
  accent: { group: 'look', kind: 'color', default: '#7c5cff', label: 'Highlight colour', allowPlatform: true, help: 'Numbers and the goal bar.' },
  radius: { group: 'look', kind: 'number', default: 999, min: 0, max: 999, step: 1, label: 'Corner rounding', unit: 'px', help: '999 makes pills.' },
  border: { group: 'look', kind: 'select', default: 'none', options: ['none', 'solid', 'glow'], label: 'Border' },
  borderWidth: { group: 'look', kind: 'number', default: 1, min: 0, max: 8, step: 1, label: 'Border thickness', unit: 'px' },
  shadow: { group: 'look', kind: 'select', default: 'soft', options: ['none', 'soft', 'hard', 'outline'], label: 'Text edge' },

  // ---- Behaviour ----------------------------------------------------------
  stale: { group: 'behaviour', kind: 'number', default: 90, min: 10, max: 600, step: 5, label: 'Hide a platform after no update for', unit: 'sec', help: 'So a platform that went offline drops out of the total.' },
  preview: { group: 'behaviour', kind: 'toggle', default: false, label: 'Preview mode', help: 'Fake numbers so you can style it without being live.' },
  theme: { group: 'behaviour', kind: 'text', default: 'default', label: 'Theme preset' },
};

export const STATS_THEMES = {
  default: {},
  minimal: { bg: 'none', shadow: 'outline', icons: true, gap: 18 },
  platform: { bg: 'platform', bgOpacity: 75, accent: 'platform' },
  panel: { direction: 'column', radius: 12, bg: 'flat', bgOpacity: 70, gap: 6 },
  neon: { bg: 'flat', bgColor: '#0b0b16', bgOpacity: 85, border: 'glow', borderWidth: 1, accent: '#4dd2ff' },
};

OVERLAYS.stats = {
  id: 'stats',
  label: 'Stats bar',
  path: '/overlays/stats/',
  schema: STATS_SETTINGS,
  groups: STATS_GROUPS,
  themes: STATS_THEMES,
  openGroups: ['show', 'goal', 'look'],
  obsSize: { width: 1920, height: 90 },
  fakeLabel: 'Use fake numbers in this preview',
};
