/**
 * Saved presets - the operator's own looks for each overlay, and their own sets
 * of chat commands.
 *
 * Kept in their own file rather than in config.local.json: a preset is a whole
 * settings string, and a handful of them would bury the credentials and options
 * that actually need to be readable in the working file.
 */
import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { presetsPath } from './config.js';

/** Where presets may be saved. Overlay ids plus the command editor. */
export const PRESET_KINDS = ['chat', 'alerts', 'stats', 'health', 'timer', 'commands'];

const MAX_PER_KIND = 20;

function empty() {
  return Object.fromEntries(PRESET_KINDS.map((k) => [k, []]));
}

export function loadPresets(config) {
  const path = presetsPath(config);
  if (!existsSync(path)) return empty();
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    const out = empty();
    for (const kind of PRESET_KINDS) if (Array.isArray(parsed[kind])) out[kind] = parsed[kind];
    return out;
  } catch (err) {
    console.error(`presets file unreadable, starting empty: ${err.message}`);
    return empty();
  }
}

export function savePresets(config, presets) {
  const path = presetsPath(config);
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(presets, null, 2));
  renameSync(tmp, path);
  return presets;
}

const slug = (name) => String(name).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'preset';

/**
 * Add or replace a preset. Saving under a name that already exists overwrites
 * it, which is what "save" means to someone who just tweaked their own look.
 * @param {'chat'|'alerts'|'stats'|'health'|'timer'|'commands'} kind
 * @param {{name: string, query?: string, data?: object}} preset
 */
export function putPreset(config, kind, preset) {
  if (!PRESET_KINDS.includes(kind)) throw new Error(`unknown preset kind: ${kind}`);
  const name = String(preset.name || '').trim().slice(0, 40);
  if (!name) throw new Error('a preset needs a name');

  const presets = loadPresets(config);
  const id = slug(name);
  const entry = {
    id,
    name,
    savedAt: Date.now(),
    ...(preset.query !== undefined ? { query: String(preset.query).slice(0, 4000) } : {}),
    ...(preset.data !== undefined ? { data: preset.data } : {}),
  };

  const existing = presets[kind].findIndex((p) => p.id === id);
  if (existing >= 0) presets[kind][existing] = entry;
  else presets[kind].push(entry);

  if (presets[kind].length > MAX_PER_KIND) {
    throw new Error(`that's ${MAX_PER_KIND} presets already — delete one first`);
  }
  savePresets(config, presets);
  return entry;
}

export function deletePreset(config, kind, id) {
  if (!PRESET_KINDS.includes(kind)) throw new Error(`unknown preset kind: ${kind}`);
  const presets = loadPresets(config);
  const before = presets[kind].length;
  presets[kind] = presets[kind].filter((p) => p.id !== id);
  savePresets(config, presets);
  return before !== presets[kind].length;
}
