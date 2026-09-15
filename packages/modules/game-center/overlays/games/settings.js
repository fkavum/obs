/**
 * Settings for the chat games overlay. Lives with the overlay it describes, not
 * in the shared schema - a module registers its overlays, it doesn't edit core.
 */
export const GAMES_GROUPS = [
  { id: 'layout', label: 'Position' },
  { id: 'size', label: 'Size' },
  { id: 'look', label: 'Look' },
  { id: 'behaviour', label: 'Behaviour' },
];

export const GAMES_SETTINGS = {
  position: { group: 'layout', kind: 'select', default: 'center', options: ['top', 'center', 'bottom'], label: 'Where on the screen' },
  align: { group: 'layout', kind: 'select', default: 'center', options: ['left', 'center', 'right'], label: 'Left / centre / right' },
  offset: { group: 'layout', kind: 'number', default: 60, min: 0, max: 500, step: 4, label: 'Distance from the edge', unit: 'px' },
  width: { group: 'layout', kind: 'number', default: 760, min: 320, max: 1800, step: 20, label: 'Panel width', unit: 'px' },

  scale: { group: 'size', kind: 'number', default: 100, min: 50, max: 200, step: 5, label: 'Overall size', unit: '%' },
  fontSize: { group: 'size', kind: 'number', default: 20, min: 10, max: 48, step: 1, label: 'Text size', unit: 'px' },
  font: { group: 'size', kind: 'text', default: 'Inter', label: 'Font' },
  padding: { group: 'size', kind: 'number', default: 24, min: 0, max: 80, step: 2, label: 'Space inside', unit: 'px' },
  maxRows: { group: 'size', kind: 'number', default: 10, min: 3, max: 30, step: 1, label: 'Players shown at once' },

  bgColor: { group: 'look', kind: 'color', default: '#0d0d13', label: 'Background colour' },
  bgOpacity: { group: 'look', kind: 'number', default: 88, min: 0, max: 100, step: 1, label: 'Background transparency', unit: '%' },
  textColor: { group: 'look', kind: 'color', default: '#ffffff', label: 'Text colour' },
  accent: { group: 'look', kind: 'color', default: '#7c5cff', label: 'Highlight colour' },
  radius: { group: 'look', kind: 'number', default: 18, min: 0, max: 48, step: 1, label: 'Corner rounding', unit: 'px' },
  shadow: { group: 'look', kind: 'select', default: 'soft', options: ['none', 'soft', 'hard', 'outline'], label: 'Text edge' },
  icons: { group: 'look', kind: 'toggle', default: true, label: 'Show platform icons' },

  holdSec: { group: 'behaviour', kind: 'number', default: 12, min: 3, max: 60, step: 1, label: 'Keep results on screen for', unit: 'sec' },
  showLeaderboard: { group: 'behaviour', kind: 'toggle', default: true, label: 'Show the points leaderboard after a game' },
  preview: { group: 'behaviour', kind: 'toggle', default: false, label: 'Preview mode', help: 'Runs a pretend game so you can style it.' },
  theme: { group: 'behaviour', kind: 'text', default: 'default', label: 'Theme preset' },
};

export const GAMES_THEMES = {
  default: {},
  compact: { width: 520, fontSize: 16, padding: 16, maxRows: 6 },
  big: { width: 1100, fontSize: 26, padding: 34, maxRows: 14 },
  clear: { bgOpacity: 0, shadow: 'outline' },
  corner: { position: 'bottom', align: 'right', width: 460, fontSize: 15, maxRows: 6, padding: 16 },
};

/**
 * The standard shape a module overlay exports: the settings screen imports this
 * and builds itself from it, exactly as it does for the built-in overlays.
 */
export const overlay = {
  id: 'game-center.games',
  label: 'Chat games',
  path: '/overlays/game-center/games/',
  schema: GAMES_SETTINGS,
  groups: GAMES_GROUPS,
  themes: GAMES_THEMES,
  openGroups: ['layout', 'look'],
  obsSize: { width: 1920, height: 1080 },
  fakeLabel: 'Run a pretend game in this preview',
};
