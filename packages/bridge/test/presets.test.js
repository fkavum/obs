import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, existsSync, rmSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'obs-presets-'));
process.env.OBS_TOOLKIT_CONFIG_DIR = dir;
const {
  listPresets, loadPresets, putPreset, deletePreset, seedInitialPresets,
  migrateLegacyPresets, kindDir, PRESET_KINDS, INITIAL_EXT, LOCAL_EXT,
} = await import('../src/presets.js');
process.on('exit', () => rmSync(dir, { recursive: true, force: true }));

const config = { presets: { chat: 'chat', alerts: 'alerts', stats: 'stats', health: 'health', timer: 'timer', commands: 'commands' } };
const reset = () => { for (const k of PRESET_KINDS) rmSync(join(dir, k), { recursive: true, force: true }); };

test('each feature has its own folder, named in the master config', () => {
  assert.equal(kindDir(config, 'chat'), join(dir, 'chat'));
  assert.equal(kindDir({ presets: { chat: 'looks/chat' } }, 'chat'), join(dir, 'looks/chat'));
  assert.equal(kindDir({}, 'alerts'), join(dir, 'alerts'), 'falls back to the feature name');
});

test('built-in looks are written out as editable .initial.config files', () => {
  reset();
  const overlays = { chat: { themes: { default: {}, neon: { border: 'glow', bgColor: '#0b0b16' } } } };
  assert.equal(seedInitialPresets(config, overlays), 2);

  const path = join(dir, 'chat', `neon${INITIAL_EXT}`);
  assert.equal(existsSync(path), true);
  const body = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(body.name, 'Neon');
  assert.deepEqual(body.settings, { border: 'glow', bgColor: '#0b0b16' });
});

test('an edited built-in is never overwritten on the next start', () => {
  reset();
  const overlays = { chat: { themes: { neon: { border: 'glow' } } } };
  seedInitialPresets(config, overlays);
  const path = join(dir, 'chat', `neon${INITIAL_EXT}`);
  writeFileSync(path, JSON.stringify({ name: 'Neon', settings: { border: 'solid' } }));

  assert.equal(seedInitialPresets(config, overlays), 0, 'nothing rewritten');
  assert.equal(JSON.parse(readFileSync(path, 'utf8')).settings.border, 'solid', 'the edit survived');
});

test('the operator’s own preset is a separate .local.config file', () => {
  reset();
  const saved = putPreset(config, 'chat', { name: 'My stream look', settings: { layout: 'horizontal', scale: 120 } });
  assert.equal(saved.file, `my-stream-look${LOCAL_EXT}`);
  assert.equal(existsSync(join(dir, 'chat', saved.file)), true);

  const { local } = listPresets(config, 'chat');
  assert.equal(local.length, 1);
  assert.equal(local[0].name, 'My stream look');
  assert.deepEqual(local[0].settings, { layout: 'horizontal', scale: 120 });
  assert.equal(local[0].source, 'local');
});

test('shipped and saved presets are listed apart and never collide', () => {
  reset();
  seedInitialPresets(config, { chat: { themes: { neon: { border: 'glow' } } } });
  putPreset(config, 'chat', { name: 'Neon', settings: { border: 'solid' } });

  const { initial, local } = listPresets(config, 'chat');
  assert.deepEqual(initial.map((p) => p.name), ['Neon']);
  assert.deepEqual(local.map((p) => p.name), ['Neon']);
  assert.notEqual(initial[0].settings.border, local[0].settings.border, 'same name, different files');
});

test('saving over one of your own names replaces it rather than duplicating', () => {
  reset();
  putPreset(config, 'chat', { name: 'Mine', settings: { scale: 100 } });
  putPreset(config, 'chat', { name: 'Mine', settings: { scale: 150 } });
  const { local } = listPresets(config, 'chat');
  assert.equal(local.length, 1);
  assert.equal(local[0].settings.scale, 150);
});

test('only your own presets can be deleted; shipped ones stay', () => {
  reset();
  seedInitialPresets(config, { chat: { themes: { neon: { border: 'glow' } } } });
  putPreset(config, 'chat', { name: 'Mine' });
  assert.equal(deletePreset(config, 'chat', 'mine'), true);
  assert.equal(deletePreset(config, 'chat', 'neon'), false, 'a shipped preset is not deleted');
  assert.equal(listPresets(config, 'chat').initial.length, 1, 'and is still there');
});

test('command sets keep commands and auto-messages together', () => {
  reset();
  putPreset(config, 'commands', {
    name: 'Gaming nights',
    data: { commands: [{ trigger: '!gg' }, { trigger: '!rank' }], autoMessages: [{ text: 'follow!' }] },
  });
  const saved = listPresets(config, 'commands').local[0];
  assert.equal(saved.data.commands.length, 2);
  assert.equal(saved.data.autoMessages[0].text, 'follow!');
});

test('a preset needs a name, and unknown kinds are refused', () => {
  reset();
  assert.throws(() => putPreset(config, 'chat', { name: '  ' }), /needs a name/);
  assert.throws(() => putPreset(config, 'nonsense', { name: 'x' }), /unknown preset kind/);
  assert.throws(() => deletePreset(config, 'nonsense', 'x'), /unknown preset kind/);
});

test('one unreadable preset file does not hide the others', () => {
  reset();
  mkdirSync(join(dir, 'chat'), { recursive: true });
  putPreset(config, 'chat', { name: 'Good one', settings: { scale: 110 } });
  writeFileSync(join(dir, 'chat', `broken${LOCAL_EXT}`), 'not json at all');
  const { local } = listPresets(config, 'chat');
  assert.deepEqual(local.map((p) => p.name), ['Good one']);
});

test('files that are not presets are ignored', () => {
  reset();
  mkdirSync(join(dir, 'chat'), { recursive: true });
  writeFileSync(join(dir, 'chat', 'notes.txt'), 'hello');
  writeFileSync(join(dir, 'chat', 'README.md'), '# hi');
  assert.deepEqual(listPresets(config, 'chat'), { initial: [], local: [] });
});

test('a missing folder is empty, not an error', () => {
  reset();
  assert.deepEqual(listPresets(config, 'timer'), { initial: [], local: [] });
  const all = loadPresets(config);
  for (const kind of PRESET_KINDS) assert.deepEqual(all[kind], { initial: [], local: [] }, kind);
});

test('presets from the old single-file layout are moved into the folders', () => {
  reset();
  const legacy = join(dir, 'presets.json');
  writeFileSync(legacy, JSON.stringify({
    chat: [{ id: 'old-look', name: 'Old look', query: 'layout=horizontal&scale=120' }],
    commands: [{ id: 'old-set', name: 'Old set', data: { commands: [{ trigger: '!x' }] } }],
  }));

  assert.equal(migrateLegacyPresets({ ...config, presetsFile: 'presets.json' }), 2);
  const chat = listPresets(config, 'chat').local[0];
  assert.equal(chat.name, 'Old look');
  assert.deepEqual(chat.settings, { layout: 'horizontal', scale: '120' }, 'the old query string became settings');
  assert.equal(listPresets(config, 'commands').local[0].data.commands[0].trigger, '!x');
  assert.equal(existsSync(legacy), false, 'the old file is retired');
  assert.equal(existsSync(`${legacy}.migrated`), true, 'but kept as a backup');
});
