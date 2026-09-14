import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, existsSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'obs-presets-'));
process.env.OBS_TOOLKIT_CONFIG_DIR = dir;
const { loadPresets, putPreset, deletePreset, PRESET_KINDS } = await import('../src/presets.js');
process.on('exit', () => rmSync(dir, { recursive: true, force: true }));

const config = { presetsFile: 'presets.json' };
const presetsFile = join(dir, 'presets.json');
const reset = () => rmSync(presetsFile, { force: true });

test('there is a slot for every overlay plus the command editor', () => {
  assert.deepEqual(PRESET_KINDS, ['chat', 'alerts', 'stats', 'health', 'timer', 'commands']);
  reset();
  const empty = loadPresets(config);
  for (const kind of PRESET_KINDS) assert.deepEqual(empty[kind], [], kind);
});

test('a saved look comes back with its settings intact', () => {
  reset();
  putPreset(config, 'chat', { name: 'My stream look', query: 'layout=horizontal&scale=120' });
  const presets = loadPresets(config);
  assert.equal(presets.chat.length, 1);
  assert.equal(presets.chat[0].name, 'My stream look');
  assert.equal(presets.chat[0].query, 'layout=horizontal&scale=120');
  assert.ok(presets.chat[0].savedAt > 0);
});

test('presets live in their own file, not in the working config', () => {
  reset();
  putPreset(config, 'alerts', { name: 'Loud', query: 'theme=neon' });
  assert.equal(existsSync(presetsFile), true);
  assert.equal(JSON.parse(readFileSync(presetsFile, 'utf8')).alerts[0].name, 'Loud');
});

test('saving under the same name replaces it rather than making a duplicate', () => {
  reset();
  putPreset(config, 'chat', { name: 'Mine', query: 'scale=100' });
  putPreset(config, 'chat', { name: 'Mine', query: 'scale=150' });
  const list = loadPresets(config).chat;
  assert.equal(list.length, 1, 'still one');
  assert.equal(list[0].query, 'scale=150', 'updated to the newer settings');
});

test('names that differ only in punctuation are treated as the same slot', () => {
  reset();
  putPreset(config, 'chat', { name: 'My Look' });
  putPreset(config, 'chat', { name: 'my-look' });
  assert.equal(loadPresets(config).chat.length, 1);
});

test('kinds are kept apart', () => {
  reset();
  putPreset(config, 'chat', { name: 'Same name', query: 'a=1' });
  putPreset(config, 'timer', { name: 'Same name', query: 'b=2' });
  const presets = loadPresets(config);
  assert.equal(presets.chat[0].query, 'a=1');
  assert.equal(presets.timer[0].query, 'b=2');
});

test('command sets are saved whole, commands and auto-messages together', () => {
  reset();
  putPreset(config, 'commands', {
    name: 'Gaming nights',
    data: { commands: [{ trigger: '!gg' }, { trigger: '!rank' }], autoMessages: [{ text: 'follow!' }] },
  });
  const saved = loadPresets(config).commands[0];
  assert.equal(saved.data.commands.length, 2);
  assert.equal(saved.data.autoMessages[0].text, 'follow!');
});

test('a preset must have a name, and an unknown kind is refused', () => {
  reset();
  assert.throws(() => putPreset(config, 'chat', { name: '   ' }), /needs a name/);
  assert.throws(() => putPreset(config, 'nonsense', { name: 'x' }), /unknown preset kind/);
  assert.throws(() => deletePreset(config, 'nonsense', 'x'), /unknown preset kind/);
});

test('deleting removes just that one', () => {
  reset();
  putPreset(config, 'chat', { name: 'Keep', query: 'a=1' });
  const gone = putPreset(config, 'chat', { name: 'Drop', query: 'b=2' });
  assert.equal(deletePreset(config, 'chat', gone.id), true);
  assert.deepEqual(loadPresets(config).chat.map((p) => p.name), ['Keep']);
  assert.equal(deletePreset(config, 'chat', 'not-there'), false, 'deleting nothing is not an error');
});

test('a corrupt presets file loses the presets but never the toolkit', () => {
  writeFileSync(presetsFile, 'this is not json');
  const presets = loadPresets(config);
  assert.deepEqual(presets.chat, []);
  // ...and it can still be written to afterwards.
  putPreset(config, 'chat', { name: 'Fresh start', query: 'a=1' });
  assert.equal(loadPresets(config).chat.length, 1);
});
