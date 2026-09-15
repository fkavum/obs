/**
 * Settings for the shop board. It sits on stream while the streamer talks over
 * it, so every option here exists to make it *fit* — never to make it scroll.
 */
export const SHOP_GROUPS = [
  { id: 'layout', label: 'Position' },
  { id: 'size', label: 'Size' },
  { id: 'look', label: 'Look' },
  { id: 'behaviour', label: 'Behaviour' },
];

export const SHOP_SETTINGS = {
  position: { group: 'layout', kind: 'select', default: 'center', options: ['top', 'center', 'bottom'], label: 'Where on the screen' },
  align: { group: 'layout', kind: 'select', default: 'right', options: ['left', 'center', 'right'], label: 'Left / centre / right' },
  offset: { group: 'layout', kind: 'number', default: 60, min: 0, max: 500, step: 4, label: 'Distance from the edge', unit: 'px' },
  width: { group: 'layout', kind: 'number', default: 420, min: 260, max: 900, step: 10, label: 'Board width', unit: 'px' },

  scale: { group: 'size', kind: 'number', default: 100, min: 50, max: 200, step: 5, label: 'Overall size', unit: '%' },
  fontSize: { group: 'size', kind: 'number', default: 18, min: 10, max: 40, step: 1, label: 'Text size', unit: 'px' },
  font: { group: 'size', kind: 'text', default: 'Inter', label: 'Font' },
  padding: { group: 'size', kind: 'number', default: 20, min: 0, max: 60, step: 2, label: 'Space inside', unit: 'px' },
  columns: { group: 'size', kind: 'select', default: '2', options: ['1', '2'], label: 'Columns' },
  rows: { group: 'size', kind: 'int', default: 4, min: 2, max: 8, label: 'Rows per page', help: 'The board never scrolls — it pages instead.' },

  bgColor: { group: 'look', kind: 'color', default: '#0d0d13', label: 'Background colour' },
  bgOpacity: { group: 'look', kind: 'number', default: 88, min: 0, max: 100, step: 1, label: 'Background transparency', unit: '%' },
  textColor: { group: 'look', kind: 'color', default: '#ffffff', label: 'Text colour' },
  accent: { group: 'look', kind: 'color', default: '#e8c15a', label: 'Highlight colour' },
  radius: { group: 'look', kind: 'number', default: 18, min: 0, max: 48, step: 1, label: 'Corner rounding', unit: 'px' },
  shadow: { group: 'look', kind: 'select', default: 'soft', options: ['none', 'soft', 'hard', 'outline'], label: 'Text edge' },
  showPrices: { group: 'look', kind: 'toggle', default: true, label: 'Show prices' },
  showEarned: { group: 'look', kind: 'toggle', default: true, label: 'Show items that must be earned' },

  rotateSec: { group: 'behaviour', kind: 'number', default: 8, min: 3, max: 60, step: 1, label: 'Seconds per page', unit: 'sec' },
  slots: { group: 'behaviour', kind: 'text', default: 'hat,face,neck,back,paw,coat', label: 'Sections to show', help: 'Comma separated. Leave one for a single section.' },
  hint: { group: 'behaviour', kind: 'toggle', default: true, label: 'Show the "!buy <item>" hint' },
  theme: { group: 'behaviour', kind: 'text', default: 'default', label: 'Theme preset' },
};

export const SHOP_THEMES = {
  default: {},
  compact: { width: 300, columns: '1', rows: 4, fontSize: 15, padding: 14 },
  wide: { width: 720, columns: '2', rows: 6, fontSize: 20 },
  minimal: { bgOpacity: 0, shadow: 'hard', showPrices: true, hint: false },
};
