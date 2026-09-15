/**
 * Settings for the pet and profile cards.
 *
 * Quiet mode is ON by default, deliberately. A busy channel can produce a card
 * a second, and an overlay that covers the stream gets turned off on day one —
 * so out of the box you only see the moments that matter, and turning the noise
 * up is a choice the streamer makes.
 */
export const PROFILE_GROUPS = [
  { id: 'layout', label: 'Position' },
  { id: 'size', label: 'Size' },
  { id: 'look', label: 'Look' },
  { id: 'behaviour', label: 'How often cards show' },
];

export const PROFILE_SETTINGS = {
  position: { group: 'layout', kind: 'select', default: 'bottom', options: ['top', 'center', 'bottom'], label: 'Where on the screen' },
  align: { group: 'layout', kind: 'select', default: 'left', options: ['left', 'center', 'right'], label: 'Left / centre / right' },
  offset: { group: 'layout', kind: 'number', default: 60, min: 0, max: 500, step: 4, label: 'Distance from the edge', unit: 'px' },
  entrance: { group: 'layout', kind: 'select', default: 'slide', options: ['slide', 'fade', 'pop', 'none'], label: 'How cards appear' },

  scale: { group: 'size', kind: 'number', default: 100, min: 50, max: 200, step: 5, label: 'Overall size', unit: '%' },
  fontSize: { group: 'size', kind: 'number', default: 16, min: 10, max: 40, step: 1, label: 'Text size', unit: 'px' },
  font: { group: 'size', kind: 'text', default: 'Inter', label: 'Font' },

  bgColor: { group: 'look', kind: 'color', default: '#0d0d13', label: 'Background colour' },
  bgOpacity: { group: 'look', kind: 'number', default: 90, min: 0, max: 100, step: 1, label: 'Background transparency', unit: '%' },
  textColor: { group: 'look', kind: 'color', default: '#ffffff', label: 'Text colour' },
  accent: { group: 'look', kind: 'color', default: '#e8c15a', label: 'Highlight colour', allowAccent: true },
  radius: { group: 'look', kind: 'number', default: 16, min: 0, max: 48, step: 1, label: 'Corner rounding', unit: 'px' },
  shadow: { group: 'look', kind: 'select', default: 'soft', options: ['none', 'soft', 'hard', 'outline'], label: 'Text edge' },
  icons: { group: 'look', kind: 'toggle', default: true, label: 'Show platform icons' },
  showCoins: { group: 'look', kind: 'toggle', default: true, label: 'Show coins on the card' },

  quiet: { group: 'behaviour', kind: 'toggle', default: true, label: 'Quiet mode', help: 'Only level-ups, evolutions and things people earn. Turn this off to show every card.' },
  holdSec: { group: 'behaviour', kind: 'number', default: 6, min: 2, max: 30, step: 1, label: 'Keep a card up for', unit: 'sec' },
  cooldownSec: { group: 'behaviour', kind: 'int', default: 60, min: 0, max: 600, label: 'Same person, not again within', unit: 'sec' },
  queueDepth: { group: 'behaviour', kind: 'int', default: 5, min: 1, max: 20, label: 'Cards waiting before the rest collapse' },
  evolutionMoment: { group: 'behaviour', kind: 'toggle', default: true, label: 'The evolution moment', help: 'A six-second silhouette reveal when a pet evolves.' },
  preview: { group: 'behaviour', kind: 'toggle', default: false, label: 'Preview mode', help: 'Runs pretend cards so you can style it.' },
  theme: { group: 'behaviour', kind: 'text', default: 'default', label: 'Theme preset' },
};

export const PROFILE_THEMES = {
  default: {},
  busy: { quiet: false, holdSec: 4, cooldownSec: 30, queueDepth: 8 },
  loud: { quiet: false, holdSec: 5, cooldownSec: 0, queueDepth: 12, entrance: 'pop' },
  silent: { quiet: true, holdSec: 8, evolutionMoment: true },
};
