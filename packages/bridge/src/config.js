/**
 * Configuration lives in config/config.local.json, which the setup wizard writes.
 * The operator never opens it -- that is the point.
 */
import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(HERE, '..', '..', '..');
export const CONFIG_DIR = join(ROOT, 'config');
export const CONFIG_PATH = join(CONFIG_DIR, 'config.local.json');

export const DEFAULT_CONFIG = {
  bridge: { host: '127.0.0.1', wsPort: 8777, httpPort: 8778 },
  obs: { url: 'ws://127.0.0.1:4455', password: '', enabled: false },
  platforms: {},
};

export function loadConfig() {
  if (!existsSync(CONFIG_PATH)) return structuredClone(DEFAULT_CONFIG);
  try {
    const parsed = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
    return {
      ...structuredClone(DEFAULT_CONFIG),
      ...parsed,
      bridge: { ...DEFAULT_CONFIG.bridge, ...(parsed.bridge || {}) },
      obs: { ...DEFAULT_CONFIG.obs, ...(parsed.obs || {}) },
      platforms: parsed.platforms || {},
    };
  } catch (err) {
    // A corrupt config must not stop the bridge from starting -- the operator
    // needs the wizard to come up so they can fix it.
    console.error('config unreadable, starting with defaults:', err.message);
    return structuredClone(DEFAULT_CONFIG);
  }
}

/** Atomic write, so a crash mid-save can't leave an unparseable config. */
export function saveConfig(config) {
  mkdirSync(CONFIG_DIR, { recursive: true });
  const tmp = `${CONFIG_PATH}.tmp`;
  writeFileSync(tmp, JSON.stringify(config, null, 2), { mode: 0o600 });
  renameSync(tmp, CONFIG_PATH);
  return config;
}

export function getPlatformConfig(config, id) {
  return config.platforms[id] || {};
}

export function setPlatformConfig(config, id, patch) {
  config.platforms[id] = { ...(config.platforms[id] || {}), ...patch };
  saveConfig(config);
  return config.platforms[id];
}
