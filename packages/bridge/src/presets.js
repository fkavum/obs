/**
 * Presets, one folder per feature, one file per preset:
 *
 *   config/chat/neon.initial.config      a look that ships with the toolkit
 *   config/chat/my-look.local.config     one the operator saved
 *   config/commands/gaming.local.config  a whole set of chat commands
 *
 * `.initial.config` files are written out on first run from the looks built into
 * the toolkit, so they are readable and editable rather than buried in code.
 * `.local.config` files are the operator's own. Neither overwrites the other: a
 * saved preset is a separate file even if it shares a name.
 *
 * The folder for each feature is named in the master config under `presets`.
 */
import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { CONFIG_DIR } from './config.js';

export const PRESET_KINDS = ['chat', 'alerts', 'stats', 'health', 'timer', 'commands'];
export const INITIAL_EXT = '.initial.config';
export const LOCAL_EXT = '.local.config';
const MAX_LOCAL_PER_KIND = 20;

/** Where a feature's presets live, per the master config. */
export function kindDir(config, kind) {
  const folder = config.presets?.[kind] || kind;
  return join(CONFIG_DIR, folder);
}

export const slugify = (name) =>
  String(name).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'preset';

function readPresetFile(path) {
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (err) {
    console.error(`preset ${path} is unreadable, skipping it: ${err.message}`);
    return null;
  }
}

function writePresetFile(path, body) {
  mkdirSync(join(path, '..'), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(body, null, 2)}\n`);
  renameSync(tmp, path);
}

/**
 * Every preset for one feature.
 * @returns {{initial: object[], local: object[]}}
 */
export function listPresets(config, kind) {
  const dir = kindDir(config, kind);
  const out = { initial: [], local: [] };
  if (!existsSync(dir)) return out;

  for (const file of readdirSync(dir).sort()) {
    const source = file.endsWith(INITIAL_EXT) ? 'initial' : file.endsWith(LOCAL_EXT) ? 'local' : null;
    if (!source) continue;
    const body = readPresetFile(join(dir, file));
    if (!body) continue;
    const id = file.slice(0, -(source === 'initial' ? INITIAL_EXT : LOCAL_EXT).length);
    out[source].push({ id, source, name: body.name || id, file, ...body });
  }
  return out;
}

export function loadPresets(config) {
  return Object.fromEntries(PRESET_KINDS.map((kind) => [kind, listPresets(config, kind)]));
}

/**
 * Save one of the operator's presets. Always a `.local.config` file - the
 * shipped ones are never edited from the UI, so a bad save can't destroy them.
 */
export function putPreset(config, kind, preset) {
  if (!PRESET_KINDS.includes(kind)) throw new Error(`unknown preset kind: ${kind}`);
  const name = String(preset.name || '').trim().slice(0, 40);
  if (!name) throw new Error('a preset needs a name');

  const id = slugify(name);
  const dir = kindDir(config, kind);
  const path = join(dir, `${id}${LOCAL_EXT}`);
  const isNew = !existsSync(path);

  if (isNew && listPresets(config, kind).local.length >= MAX_LOCAL_PER_KIND) {
    throw new Error(`that's ${MAX_LOCAL_PER_KIND} presets already — delete one first`);
  }

  const body = { name, savedAt: Date.now() };
  if (preset.settings !== undefined) body.settings = preset.settings;
  if (preset.data !== undefined) body.data = preset.data;
  writePresetFile(path, body);
  return { id, source: 'local', file: `${id}${LOCAL_EXT}`, ...body };
}

/** Only the operator's own presets can be deleted; the shipped ones stay put. */
export function deletePreset(config, kind, id) {
  if (!PRESET_KINDS.includes(kind)) throw new Error(`unknown preset kind: ${kind}`);
  const path = join(kindDir(config, kind), `${slugify(id)}${LOCAL_EXT}`);
  if (!existsSync(path)) return false;
  rmSync(path);
  return true;
}

/**
 * Write the toolkit's built-in looks out as `.initial.config` files, so they can
 * be read and edited. Existing files are left alone - an edited built-in must
 * survive a restart, or editing it would be pointless.
 */
export function seedInitialPresets(config, overlays) {
  let written = 0;
  for (const [kind, overlay] of Object.entries(overlays)) {
    if (!PRESET_KINDS.includes(kind) || !overlay.themes) continue;
    const dir = kindDir(config, kind);
    for (const [name, settings] of Object.entries(overlay.themes)) {
      const path = join(dir, `${slugify(name)}${INITIAL_EXT}`);
      if (existsSync(path)) continue;
      writePresetFile(path, {
        name: name.charAt(0).toUpperCase() + name.slice(1),
        settings,
      });
      written += 1;
    }
  }
  return written;
}

/** Move a pre-folder presets.json into the new layout, then retire it. */
export function migrateLegacyPresets(config) {
  const legacy = join(CONFIG_DIR, config.presetsFile || 'presets.json');
  if (!existsSync(legacy)) return 0;
  const parsed = readPresetFile(legacy);
  if (!parsed) return 0;

  let moved = 0;
  for (const kind of PRESET_KINDS) {
    for (const preset of parsed[kind] || []) {
      try {
        // Old presets stored a query string; the folder format stores settings.
        const settings = preset.query !== undefined
          ? Object.fromEntries(new URLSearchParams(preset.query))
          : undefined;
        putPreset(config, kind, { name: preset.name, settings, data: preset.data });
        moved += 1;
      } catch (err) {
        console.error(`could not move preset "${preset.name}": ${err.message}`);
      }
    }
  }
  if (moved) {
    renameSync(legacy, `${legacy}.migrated`);
    console.log(`moved ${moved} preset(s) into the new per-feature folders`);
  }
  return moved;
}
