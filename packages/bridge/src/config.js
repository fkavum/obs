/**
 * Configuration lives in ONE working file: config/config.local.json.
 *
 * config/initial.config.json is the seed. On first run its contents are copied
 * into the working file, which from then on is the single source of truth -
 * everything the operator changes, and every token, is written there.
 *
 * Two rules protect the operator's data:
 *   - an existing working file is NEVER overwritten by the seed;
 *   - keys the seed has but the working file lacks ARE filled in, so a toolkit
 *     update that adds a feature gets its defaults without touching anything else.
 *
 * Long lists that would bury the file - saved presets - live in presets.json,
 * pointed at from here.
 */
import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(HERE, '..', '..', '..');
// Overridable so tests can point at a scratch directory.
export const CONFIG_DIR = process.env.OBS_TOOLKIT_CONFIG_DIR || join(ROOT, 'config');
export const SEED_PATH = join(CONFIG_DIR, 'initial.config.json');
export const CONFIG_PATH = join(CONFIG_DIR, 'config.local.json');

/** Anything the seed does not mention still needs a sane value. */
export const DEFAULT_CONFIG = {
  bridge: { host: '127.0.0.1', wsPort: 8777, httpPort: 8778 },
  obs: { url: 'ws://127.0.0.1:4455', password: '', enabled: false },
  platforms: {},
  chatbot: { enabled: false, sendTo: [] },
  commands: [],
  autoMessages: [],
  timer: { durationMs: 300000, label: 'Starting soon', mode: 'countdown' },
  // One folder per feature, holding that feature's presets as individual files.
  presets: {
    chat: 'chat',
    alerts: 'alerts',
    stats: 'stats',
    health: 'health',
    timer: 'timer',
    commands: 'commands',
  },
};

function readJSON(path, label) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    // A corrupt file must not stop the bridge starting - the operator needs the
    // setup page to come up so they can fix things.
    console.error(`${label} is unreadable, ignoring it: ${err.message}`);
    return null;
  }
}

/** Fill in only the keys `target` is missing. Never replaces what is already there. */
function fillMissing(target, source) {
  let added = 0;
  for (const [key, value] of Object.entries(source || {})) {
    if (key === '$comment') continue;
    if (target[key] === undefined) {
      target[key] = structuredClone(value);
      added += 1;
    } else if (isPlainObject(target[key]) && isPlainObject(value)) {
      added += fillMissing(target[key], value);
    }
  }
  return added;
}

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * Load the working config, creating it from the seed on first run.
 * @returns {object} config, with a non-enumerable `seed` for "reset to defaults".
 */
export function loadConfig() {
  const seed = readJSON(SEED_PATH, 'initial.config.json') || {};
  const existing = readJSON(CONFIG_PATH, 'config.local.json');

  const config = existing ? { ...existing } : {};
  const fromSeed = fillMissing(config, seed);
  const fromDefaults = fillMissing(config, DEFAULT_CONFIG);

  Object.defineProperty(config, 'seed', { value: seed, enumerable: false });

  // Write on first run, and whenever an update introduced new settings, so the
  // file on disk always shows everything that exists rather than hiding some of it.
  if (!existing || fromSeed || fromDefaults) saveConfig(config);
  return config;
}

/** Write the whole working file. Atomic, so a crash mid-save can't corrupt it. */
export function saveConfig(config) {
  mkdirSync(CONFIG_DIR, { recursive: true });
  const tmp = `${CONFIG_PATH}.tmp`;
  writeFileSync(tmp, JSON.stringify(config, null, 2), { mode: 0o600 });
  renameSync(tmp, CONFIG_PATH);
  return config;
}

/** Throw the working file away and start again from the seed. */
export function resetToSeed() {
  const seed = readJSON(SEED_PATH, 'initial.config.json') || {};
  const config = structuredClone(seed);
  delete config.$comment;
  fillMissing(config, DEFAULT_CONFIG);
  Object.defineProperty(config, 'seed', { value: seed, enumerable: false });
  return saveConfig(config);
}

export function getPlatformConfig(config, id) {
  return config.platforms[id] || {};
}

/**
 * Change one platform's saved values. A key set to `undefined` is removed
 * (used by Disconnect to forget a login).
 */
export function setPlatformConfig(config, id, patch) {
  const saved = { ...(config.platforms[id] || {}) };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) delete saved[key];
    else saved[key] = value;
  }
  config.platforms[id] = saved;
  saveConfig(config);
  return saved;
}


