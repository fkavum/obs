/**
 * Settings for the wandering pets.
 *
 * This overlay sits across your whole scene for the entire stream, so the
 * defaults are deliberately modest: small pets, a short strip along the bottom,
 * and a cap on how many can be out at once. Everything here exists to let a
 * streamer make it quieter or louder on purpose.
 */
export const WANDER_GROUPS = [
  { id: 'where', label: 'Where they walk' },
  { id: 'size', label: 'Size' },
  { id: 'look', label: 'Look' },
  { id: 'behaviour', label: 'How they behave' },
];

export const WANDER_SETTINGS = {
  edge: { group: 'where', kind: 'select', default: 'bottom', options: ['bottom', 'top'], label: 'Which edge they walk along' },
  lane: { group: 'where', kind: 'number', default: 24, min: 0, max: 600, step: 4, label: 'Distance from that edge', unit: 'px' },
  laneDepth: { group: 'where', kind: 'number', default: 60, min: 0, max: 500, step: 5, label: 'Depth of the strip', unit: 'px', help: 'Pets sit at random depths within this, so they do not queue up in one line.' },
  marginLeft: { group: 'where', kind: 'number', default: 0, min: 0, max: 1600, step: 10, label: 'Keep clear on the left', unit: 'px' },
  marginRight: { group: 'where', kind: 'number', default: 0, min: 0, max: 1600, step: 10, label: 'Keep clear on the right', unit: 'px' },

  size: { group: 'size', kind: 'number', default: 96, min: 32, max: 320, step: 4, label: 'Pet size', unit: 'px' },
  sizeByLevel: { group: 'size', kind: 'toggle', default: true, label: 'Bigger as they grow', help: 'A fully grown pet is about half again the size of a new one.' },
  fontSize: { group: 'size', kind: 'number', default: 14, min: 8, max: 32, step: 1, label: 'Name size', unit: 'px' },
  font: { group: 'size', kind: 'text', default: 'Inter', label: 'Font' },

  names: { group: 'look', kind: 'select', default: 'owner', options: ['owner', 'pet', 'both', 'none'], label: 'Show whose pet it is' },
  nameColor: { group: 'look', kind: 'color', default: '#ffffff', label: 'Name colour' },
  namePlate: { group: 'look', kind: 'toggle', default: true, label: 'Dark plate behind the name', help: 'Keeps names readable over bright video.' },
  icons: { group: 'look', kind: 'toggle', default: true, label: 'Show platform icons' },
  shadow: { group: 'look', kind: 'toggle', default: true, label: 'Shadow under each pet' },
  opacity: { group: 'look', kind: 'number', default: 100, min: 20, max: 100, step: 5, label: 'How solid they are', unit: '%' },

  staySec: { group: 'behaviour', kind: 'int', default: 90, min: 10, max: 1800, label: 'Stay for', unit: 'sec', help: 'Counted from their last message. Talking again resets it.' },
  maxPets: { group: 'behaviour', kind: 'int', default: 10, min: 1, max: 40, label: 'Most on screen at once', help: 'When it is full, the one that has been quiet longest wanders off.' },
  speed: { group: 'behaviour', kind: 'number', default: 28, min: 4, max: 140, step: 2, label: 'Walking speed', unit: 'px/sec' },
  restiness: { group: 'behaviour', kind: 'number', default: 40, min: 0, max: 100, step: 5, label: 'How often they stop for a rest', unit: '%' },
  hop: { group: 'behaviour', kind: 'toggle', default: true, label: 'Little hop as they walk' },
  preview: { group: 'behaviour', kind: 'toggle', default: false, label: 'Preview mode', help: 'Sends a few pretend pets out so you can style it.' },
  theme: { group: 'behaviour', kind: 'text', default: 'default', label: 'Theme preset' },
};

export const WANDER_THEMES = {
  default: {},
  tiny: { size: 56, fontSize: 11, maxPets: 14, laneDepth: 40 },
  showcase: { size: 150, maxPets: 5, speed: 18, laneDepth: 90, names: 'both' },
  quiet: { maxPets: 4, staySec: 45, speed: 16, names: 'none' },
  parade: { size: 80, maxPets: 20, speed: 46, staySec: 240, restiness: 10 },
};

/**
 * The standard shape a module overlay exports: the settings screen imports this
 * and builds itself from it, exactly as it does for the built-in overlays.
 */
export const overlay = {
  id: 'game-center.wander',
  label: 'Wandering pets',
  path: '/overlays/game-center/wander/',
  schema: WANDER_SETTINGS,
  groups: WANDER_GROUPS,
  themes: WANDER_THEMES,
  openGroups: ['where', 'behaviour'],
  obsSize: { width: 1920, height: 1080 },
  fakeLabel: 'Send pretend pets out in this preview',
};
