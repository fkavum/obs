/**
 * Per-feature data files, each with the same two-file shape as the master config:
 *
 *   config/commands/commands.initial.config   the examples that ship - never written to
 *   config/commands/commands.local.config     the working copy, created by copying the
 *                                             initial one, and the only file ever edited
 *
 * Copying on first read is what lets the starter commands be edited freely
 * without losing the examples: the originals stay on disk, so "restore" is
 * always available and deleting the local file brings them back.
 *
 * Which file belongs to which feature is named in the master config under `files`.
 */
import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { CONFIG_DIR } from './config.js';

export const INITIAL_EXT = '.initial.config';
export const LOCAL_EXT = '.local.config';

/** Where a feature's data lives, e.g. 'commands' -> config/commands/commands */
export function dataStem(config, key) {
  const stem = config.files?.[key];
  if (!stem) throw new Error(`no file is configured for "${key}"`);
  return join(CONFIG_DIR, stem);
}

export const initialPath = (config, key) => `${dataStem(config, key)}${INITIAL_EXT}`;
export const localPath = (config, key) => `${dataStem(config, key)}${LOCAL_EXT}`;

function readFile(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    console.error(`${path} is unreadable, ignoring it: ${err.message}`);
    return null;
  }
}

function writeFileAtomic(path, body) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(body, null, 2)}\n`);
  renameSync(tmp, path);
}

/**
 * Read a feature's data, creating the working copy from the shipped one the
 * first time. Returns `fallback` only when neither file exists.
 */
export function loadData(config, key, fallback = null) {
  const local = readFile(localPath(config, key));
  if (local !== null) return local;

  const initial = readFile(initialPath(config, key));
  if (initial !== null) {
    // Copy it out immediately so the operator edits their own file from the
    // very first change, and the examples they started from stay intact.
    writeFileAtomic(localPath(config, key), initial);
    return initial;
  }

  if (fallback !== null) {
    writeFileAtomic(localPath(config, key), fallback);
    return fallback;
  }
  return null;
}

export function saveData(config, key, data) {
  writeFileAtomic(localPath(config, key), data);
  return data;
}

/** Throw the working copy away; the next read recreates it from the shipped one. */
export function resetData(config, key) {
  rmSync(localPath(config, key), { force: true });
  return loadData(config, key);
}

/** Write a shipped file if it is missing. Used to lay down the examples once. */
export function seedInitialData(config, key, data) {
  const path = initialPath(config, key);
  if (existsSync(path)) return false;
  writeFileAtomic(path, data);
  return true;
}

/** File stems inside `folder` that hold data rather than presets. */
export function dataStemsIn(config, folder) {
  const stems = new Set();
  for (const stem of Object.values(config.files || {})) {
    const [dir, name] = String(stem).split('/');
    if (dir === folder && name) stems.add(name);
  }
  return stems;
}
