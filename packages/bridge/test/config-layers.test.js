import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Point the module at a scratch directory BEFORE importing it.
const dir = mkdtempSync(join(tmpdir(), 'obs-config-'));
process.env.OBS_TOOLKIT_CONFIG_DIR = dir;
const { loadConfig, setPlatformConfig, saveConfig, mergeConfig, CONFIG_PATH } = await import('../src/config.js');
process.on('exit', () => rmSync(dir, { recursive: true, force: true }));

// Each test starts from no saved state, so they can't leak overrides into each other.
const editDefaults = (obj) => writeFileSync(join(dir, 'app.config.json'), JSON.stringify(obj));
const writeDefaults = (obj) => {
  rmSync(CONFIG_PATH, { force: true });
  editDefaults(obj);
};
const readLocal = () => JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));

test('defaults from app.config.json apply when nothing is saved', () => {
  writeDefaults({ platforms: { twitch: { channel: 's0mcs', enabled: true }, kick: { channel: '4head', enabled: true } } });
  const cfg = loadConfig();
  assert.equal(cfg.platforms.twitch.channel, 's0mcs');
  assert.equal(cfg.platforms.kick.enabled, true);
  assert.equal(existsSync(CONFIG_PATH), false, 'nothing was written just by reading');
});

test('a saved value wins over the default, and only the difference is persisted', () => {
  writeDefaults({ platforms: { twitch: { channel: 's0mcs', enabled: true } } });
  const cfg = loadConfig();
  setPlatformConfig(cfg, 'twitch', { channel: 'someone_else' });

  assert.equal(cfg.platforms.twitch.channel, 'someone_else', 'merged view updated');
  assert.equal(cfg.platforms.twitch.enabled, true, 'untouched default still shows through');
  const local = readLocal();
  assert.deepEqual(local.platforms.twitch, { channel: 'someone_else' }, 'the default was NOT baked into the saved file');
});

test('editing app.config.json later still takes effect for anything not overridden', () => {
  writeDefaults({ platforms: { twitch: { channel: 'old', enabled: true } } });
  const first = loadConfig();
  setPlatformConfig(first, 'twitch', { enabled: false }); // operator switched it off

  editDefaults({ platforms: { twitch: { channel: 'new', enabled: true } } }); // operator edits defaults
  const second = loadConfig();
  assert.equal(second.platforms.twitch.channel, 'new', 'edited default applies');
  assert.equal(second.platforms.twitch.enabled, false, 'but the saved override still wins');
});

test('undefined removes a saved key so the default shows through again', () => {
  writeDefaults({ platforms: { twitch: { channel: 's0mcs', enabled: true } } });
  const cfg = loadConfig();
  setPlatformConfig(cfg, 'twitch', { accessToken: 'tok', enabled: false });
  setPlatformConfig(cfg, 'twitch', { accessToken: undefined, enabled: undefined });
  assert.equal(cfg.platforms.twitch.accessToken, undefined, 'token forgotten');
  assert.equal(cfg.platforms.twitch.enabled, true, 'back to the default');
  assert.deepEqual(readLocal().platforms.twitch, {});
});

test('the local layer never leaks into JSON output', () => {
  const cfg = mergeConfig({ platforms: { a: { x: 1 } } }, { platforms: { a: { y: 2 } } });
  assert.deepEqual(JSON.parse(JSON.stringify(cfg)).platforms, { a: { x: 1, y: 2 } });
  assert.equal('defaults' in JSON.parse(JSON.stringify(cfg)), false);
});

test('a corrupt defaults file is ignored rather than fatal', () => {
  writeFileSync(join(dir, 'app.config.json'), '{ this is not json');
  const cfg = loadConfig();
  assert.ok(cfg.platforms, 'still returns a usable config');
  saveConfig(cfg); // and saving still works
  assert.ok(existsSync(CONFIG_PATH));
});
