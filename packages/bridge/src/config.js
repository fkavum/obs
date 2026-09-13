/**
 * Configuration is two layers read together:
 *
 *   config/initial.config.json  starting values for this install - channel names, which
 *                              platforms are on. Committed, human-edited.
 *   config/config.local.json  what the setup page saved - tokens, overrides.
 *                             Git-ignored, machine-written. Wins over defaults.
 *
 * The layers are merged at read time and only the local layer is ever written,
 * so editing initial.config.json keeps working after the wizard has saved things:
 * a value you set in the wizard overrides it; everything else still follows it.
 */
import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(HERE, '..', '..', '..');
// Overridable so tests can point at a scratch directory.
export const CONFIG_DIR = process.env.OBS_TOOLKIT_CONFIG_DIR || join(ROOT, 'config');
export const DEFAULTS_PATH = join(CONFIG_DIR, 'initial.config.json');
export const CONFIG_PATH = join(CONFIG_DIR, 'config.local.json');

export const DEFAULT_CONFIG = {
  bridge: { host: '127.0.0.1', wsPort: 8777, httpPort: 8778 },
  obs: { url: 'ws://127.0.0.1:4455', password: '', enabled: false },
  platforms: {},
};

/** The local layer travels with the merged view but never shows up in JSON or spreads. */
const LOCAL = Symbol('local');

function readJSON(path, label) {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf8')) || {};
  } catch (err) {
    // A corrupt file must not stop the bridge starting - the operator needs the
    // setup page to come up so they can fix things.
    console.error(`${label} unreadable, ignoring it: ${err.message}`);
    return {};
  }
}

/** Build the merged view from the two layers. Pure; tested directly. */
export function mergeConfig(defaults = {}, local = {}) {
  const cfg = {
    bridge: { ...DEFAULT_CONFIG.bridge, ...(defaults.bridge || {}), ...(local.bridge || {}) },
    obs: { ...DEFAULT_CONFIG.obs, ...(defaults.obs || {}), ...(local.obs || {}) },
    platforms: {},
  };
  const ids = new Set([...Object.keys(defaults.platforms || {}), ...Object.keys(local.platforms || {})]);
  for (const id of ids) {
    cfg.platforms[id] = { ...(defaults.platforms?.[id] || {}), ...(local.platforms?.[id] || {}) };
  }
  Object.defineProperty(cfg, LOCAL, { value: local, enumerable: false, writable: true });
  Object.defineProperty(cfg, 'defaults', { value: defaults, enumerable: false });
  return cfg;
}

export function loadConfig() {
  const defaults = readJSON(DEFAULTS_PATH, 'initial.config.json');
  const local = readJSON(CONFIG_PATH, 'config.local.json');
  if (!local.platforms) local.platforms = {};
  return mergeConfig(defaults, local);
}

/** Persist the local layer only. Atomic, so a crash mid-save can't corrupt it. */
export function saveConfig(config) {
  const local = config[LOCAL] || { platforms: {} };
  // bridge/obs settings are only ever edited through the wizard, so they live local.
  local.bridge = config.bridge;
  local.obs = config.obs;
  mkdirSync(CONFIG_DIR, { recursive: true });
  const tmp = `${CONFIG_PATH}.tmp`;
  writeFileSync(tmp, JSON.stringify(local, null, 2), { mode: 0o600 });
  renameSync(tmp, CONFIG_PATH);
  return config;
}

export function getPlatformConfig(config, id) {
  return config.platforms[id] || {};
}

/**
 * Change one platform's saved values. A key set to `undefined` is removed from
 * the local layer, which lets a default show through again (used by Disconnect).
 */
export function setPlatformConfig(config, id, patch) {
  const local = config[LOCAL];
  const saved = { ...(local.platforms[id] || {}) };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) delete saved[key];
    else saved[key] = value;
  }
  local.platforms[id] = saved;
  config.platforms[id] = { ...(config.defaults?.platforms?.[id] || {}), ...saved };
  saveConfig(config);
  return config.platforms[id];
}
