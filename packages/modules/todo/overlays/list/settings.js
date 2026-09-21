/**
 * Settings for the to-do overlay. Lives with the overlay it describes, not in
 * the shared schema - a module registers its overlays, it doesn't edit core.
 */
export const TODO_GROUPS = [
  { id: 'layout', label: 'Position' },
  { id: 'size', label: 'Size' },
  { id: 'look', label: 'Look' },
  { id: 'behaviour', label: 'What it shows' },
];

export const TODO_SETTINGS = {
  position: { group: 'layout', kind: 'select', default: 'top', options: ['top', 'center', 'bottom'], label: 'Where on the screen' },
  align: { group: 'layout', kind: 'select', default: 'right', options: ['left', 'center', 'right'], label: 'Left / centre / right' },
  offset: { group: 'layout', kind: 'number', default: 48, min: 0, max: 500, step: 4, label: 'Distance from the edge', unit: 'px' },
  width: { group: 'layout', kind: 'number', default: 420, min: 220, max: 1200, step: 10, label: 'Panel width', unit: 'px' },

  scale: { group: 'size', kind: 'number', default: 100, min: 50, max: 200, step: 5, label: 'Overall size', unit: '%' },
  fontSize: { group: 'size', kind: 'number', default: 20, min: 10, max: 48, step: 1, label: 'Text size', unit: 'px' },
  font: { group: 'size', kind: 'text', default: 'Inter', label: 'Font' },
  padding: { group: 'size', kind: 'number', default: 20, min: 0, max: 80, step: 2, label: 'Space inside', unit: 'px' },
  gap: { group: 'size', kind: 'number', default: 8, min: 0, max: 40, step: 1, label: 'Space between tasks', unit: 'px' },
  maxRows: { group: 'size', kind: 'number', default: 12, min: 1, max: 40, step: 1, label: 'Tasks shown at once' },

  bgColor: { group: 'look', kind: 'color', default: '#0d0d13', label: 'Background colour' },
  bgOpacity: { group: 'look', kind: 'number', default: 82, min: 0, max: 100, step: 1, label: 'Background transparency', unit: '%' },
  textColor: { group: 'look', kind: 'color', default: '#ffffff', label: 'Text colour' },
  accent: { group: 'look', kind: 'color', default: '#7c5cff', label: 'Highlight colour' },
  doneColor: { group: 'look', kind: 'color', default: '#2fbf71', label: 'Finished colour' },
  radius: { group: 'look', kind: 'number', default: 16, min: 0, max: 48, step: 1, label: 'Corner rounding', unit: 'px' },
  shadow: { group: 'look', kind: 'select', default: 'soft', options: ['none', 'soft', 'hard', 'outline'], label: 'Text edge' },
  rowBg: { group: 'look', kind: 'toggle', default: true, label: 'Give each task its own strip' },

  title: { group: 'behaviour', kind: 'text', default: 'To-do', label: 'Heading', help: 'Leave it empty for no heading.' },
  showCount: { group: 'behaviour', kind: 'toggle', default: true, label: 'Show how many are left' },
  numbers: { group: 'behaviour', kind: 'toggle', default: true, label: 'Show task numbers', help: 'The numbers you type into chat, like !task done 2.' },
  showDone: { group: 'behaviour', kind: 'toggle', default: true, label: 'Keep finished tasks on screen' },
  strike: { group: 'behaviour', kind: 'toggle', default: true, label: 'Cross out finished tasks' },
  names: { group: 'behaviour', kind: 'toggle', default: true, label: "Show the viewer's name on their task" },
  icons: { group: 'behaviour', kind: 'toggle', default: true, label: 'Show platform icons on chat tasks' },
  hideEmpty: { group: 'behaviour', kind: 'toggle', default: true, label: 'Hide the panel when the list is empty' },
  preview: { group: 'behaviour', kind: 'toggle', default: false, label: 'Preview mode', help: 'Shows a pretend list so you can style it.' },
  theme: { group: 'behaviour', kind: 'text', default: 'default', label: 'Theme preset' },
};

export const TODO_THEMES = {
  default: {},
  compact: { width: 320, fontSize: 16, padding: 14, gap: 6, maxRows: 8, rowBg: false },
  big: { width: 620, fontSize: 28, padding: 28, gap: 12, maxRows: 10 },
  clear: { bgOpacity: 0, rowBg: false, shadow: 'outline' },
  corner: { position: 'bottom', align: 'left', width: 360, fontSize: 16, maxRows: 6, padding: 14 },
};

/**
 * The standard shape a module overlay exports: the settings screen imports this
 * and builds itself from it, exactly as it does for the built-in overlays.
 */
export const overlay = {
  id: 'todo.list',
  label: 'To-do list',
  path: '/overlays/todo/list/',
  schema: TODO_SETTINGS,
  groups: TODO_GROUPS,
  themes: TODO_THEMES,
  openGroups: ['layout', 'look'],
  obsSize: { width: 1920, height: 1080 },
  fakeLabel: 'Show a pretend list in this preview',
};
