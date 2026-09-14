import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'obs-store-'));
process.env.OBS_TOOLKIT_CONFIG_DIR = dir;
const {
  loadData, saveData, resetData, seedInitialData, dataStemsIn, initialPath, localPath,
} = await import('../src/store.js');
process.on('exit', () => rmSync(dir, { recursive: true, force: true }));

const config = {
  files: { commands: 'commands/commands', autoMessages: 'commands/auto-messages', timer: 'timer/timer' },
};
const EXAMPLES = [{ trigger: '!socials' }, { trigger: '!discord' }];
const reset = () => { rmSync(join(dir, 'commands'), { recursive: true, force: true }); rmSync(join(dir, 'timer'), { recursive: true, force: true }); };
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));

test('the file for each feature is named in the master config', () => {
  assert.equal(initialPath(config, 'commands'), join(dir, 'commands/commands.initial.config'));
  assert.equal(localPath(config, 'timer'), join(dir, 'timer/timer.local.config'));
  assert.throws(() => initialPath(config, 'nothing'), /no file is configured/);
});

test('the examples become a working copy on the very first read', () => {
  reset();
  seedInitialData(config, 'commands', EXAMPLES);
  assert.equal(existsSync(localPath(config, 'commands')), false, 'not copied until something reads it');

  const loaded = loadData(config, 'commands', []);
  assert.deepEqual(loaded, EXAMPLES);
  assert.equal(existsSync(localPath(config, 'commands')), true, 'now there is a working copy');
  assert.deepEqual(read(localPath(config, 'commands')), EXAMPLES);
});

test('editing changes only the working copy - the examples are never touched', () => {
  reset();
  seedInitialData(config, 'commands', EXAMPLES);
  loadData(config, 'commands', []);
  saveData(config, 'commands', [{ trigger: '!mine' }]);

  assert.deepEqual(loadData(config, 'commands'), [{ trigger: '!mine' }], 'reads back the edit');
  assert.deepEqual(read(initialPath(config, 'commands')), EXAMPLES, 'the examples survive untouched');
});

test('restoring brings the examples back', () => {
  reset();
  seedInitialData(config, 'commands', EXAMPLES);
  loadData(config, 'commands', []);
  saveData(config, 'commands', [{ trigger: '!mine' }]);
  assert.deepEqual(resetData(config, 'commands'), EXAMPLES);
  assert.deepEqual(loadData(config, 'commands'), EXAMPLES);
});

test('deleting the working copy by hand has the same effect as restoring', () => {
  reset();
  seedInitialData(config, 'commands', EXAMPLES);
  saveData(config, 'commands', [{ trigger: '!gone' }]);
  rmSync(localPath(config, 'commands'));
  assert.deepEqual(loadData(config, 'commands'), EXAMPLES);
});

test('the shipped file is written once and then left alone', () => {
  reset();
  assert.equal(seedInitialData(config, 'commands', EXAMPLES), true);
  assert.equal(seedInitialData(config, 'commands', [{ trigger: '!different' }]), false, 'not rewritten');
  assert.deepEqual(read(initialPath(config, 'commands')), EXAMPLES);
});

test('with no shipped file the fallback is used and saved', () => {
  reset();
  assert.deepEqual(loadData(config, 'autoMessages', []), []);
  assert.equal(existsSync(localPath(config, 'autoMessages')), true);
});

test('an unreadable working copy falls back to the examples rather than failing', () => {
  reset();
  seedInitialData(config, 'commands', EXAMPLES);
  mkdirSync(join(dir, 'commands'), { recursive: true });
  writeFileSync(localPath(config, 'commands'), 'not json');
  assert.deepEqual(loadData(config, 'commands'), EXAMPLES);
});

test('objects work as well as lists, which is what the timer needs', () => {
  reset();
  seedInitialData(config, 'timer', { durationMs: 300000, label: 'Starting soon' });
  assert.deepEqual(loadData(config, 'timer', {}), { durationMs: 300000, label: 'Starting soon' });
  saveData(config, 'timer', { durationMs: 60000, label: 'Back soon' });
  assert.equal(loadData(config, 'timer').label, 'Back soon');
});

test('data stems are known per folder, so presets never list a data file', () => {
  assert.deepEqual([...dataStemsIn(config, 'commands')].sort(), ['auto-messages', 'commands']);
  assert.deepEqual([...dataStemsIn(config, 'timer')], ['timer']);
  assert.deepEqual([...dataStemsIn(config, 'chat')], [], 'a folder with no data file reserves nothing');
});
