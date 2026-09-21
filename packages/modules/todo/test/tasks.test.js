import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'obs-todo-'));
process.env.OBS_TOOLKIT_CONFIG_DIR = dir;
const { createModuleStore } = await import('#bridge/store.js');
const { createTaskList, cleanText, normalize, MAX_TEXT, MAX_TASKS } = await import('../tasks.js');
process.on('exit', () => rmSync(dir, { recursive: true, force: true }));

const quiet = { info() {}, warn() {}, debug() {}, error() {} };
const file = join(dir, 'todo', 'tasks.local.config');

/** A fresh list with nothing behind it, and no file watching in tests. */
function fresh(options = {}) {
  rmSync(join(dir, 'todo'), { recursive: true, force: true });
  return createTaskList({ store: createModuleStore('todo'), log: quiet, watchFile: false, ...options });
}

const viewer = { platform: 'twitch', name: 'pixelpete', displayName: 'PixelPete' };
const other = { platform: 'kick', name: 'aylin', displayName: 'Aylin' };

// ---------------------------------------------------------------- the text

test('a task is one clean line, however it was typed', () => {
  assert.equal(cleanText('  two   spaces  '), 'two spaces');
  assert.equal(cleanText('one\ntwo\r\nthree'), 'one two three');
  assert.equal(cleanText('a'.repeat(400)).length, MAX_TEXT);
  assert.equal(cleanText(null), '');
});

test('invisible characters cannot make a task look blank', () => {
  assert.equal(cleanText('​​'), '', 'zero-width spaces are not a task');
  assert.equal(cleanText('hi‮there'), 'hithere', 'no right-to-left override on stream');
});

// ---------------------------------------------------------- the numbering

test('tasks are numbered by where they sit, starting at 1', () => {
  const list = fresh();
  list.add('first');
  list.add('second');
  list.add('third');
  assert.deepEqual(list.state().tasks.map((t) => [t.n, t.text]), [[1, 'first'], [2, 'second'], [3, 'third']]);
});

test('removing one renumbers the rest, so the screen and chat always agree', () => {
  const list = fresh();
  list.add('first');
  list.add('second');
  list.add('third');
  assert.equal(list.remove(1).ok, true);
  assert.deepEqual(list.state().tasks.map((t) => [t.n, t.text]), [[1, 'second'], [2, 'third']]);
});

test('a number that is not on the list is refused in plain words', () => {
  const list = fresh();
  list.add('only one');
  for (const bad of [0, 2, -1, 'x', undefined]) {
    const result = list.check(bad);
    assert.equal(result.ok, false);
    assert.match(result.message, /no task/i);
  }
});

test('ticking and unticking', () => {
  const list = fresh();
  list.add('wash up');
  assert.equal(list.check(1).ok, true);
  assert.equal(list.state().tasks[0].done, true);
  assert.equal(list.state().left, 0);
  list.check(1, false);
  assert.equal(list.state().tasks[0].done, false);
});

test('moving a task puts it at the number asked for', () => {
  const list = fresh();
  ['a', 'b', 'c', 'd'].forEach((t) => list.add(t));
  list.move(3, 1);
  assert.deepEqual(list.state().tasks.map((t) => t.text), ['c', 'a', 'b', 'd']);
  list.move(1, 99);
  assert.deepEqual(list.state().tasks.map((t) => t.text), ['a', 'b', 'd', 'c'], 'past the end lands last');
});

test('editing changes the wording and nothing else', () => {
  const list = fresh();
  list.add('old');
  list.check(1);
  list.edit(1, 'new');
  assert.equal(list.state().tasks[0].text, 'new');
  assert.equal(list.state().tasks[0].done, true, 'still ticked');
  assert.equal(list.edit(1, '   ').ok, false, 'nothing is not a task');
});

test('clearing takes the finished ones, everything, or just the viewers', () => {
  const list = fresh();
  list.setChatCanAdd(true);
  list.add('mine');
  list.add('mine too');
  list.check(2);
  list.createForViewer(viewer, 'theirs');

  list.clear('done');
  assert.deepEqual(list.state().tasks.map((t) => t.text), ['mine', 'theirs']);
  list.clear('chat');
  assert.deepEqual(list.state().tasks.map((t) => t.text), ['mine']);
  list.clear('all');
  assert.equal(list.state().total, 0);
});

test('the list has a ceiling, so nobody can push it off the screen', () => {
  const list = fresh();
  for (let i = 0; i < MAX_TASKS; i++) list.add(`task ${i}`);
  const result = list.add('one too many');
  assert.equal(result.ok, false);
  assert.equal(list.state().total, MAX_TASKS);
});

// ------------------------------------------------------------ the viewers

test('viewers cannot add anything until the streamer switches it on', () => {
  const list = fresh();
  const refused = list.createForViewer(viewer, 'let me in');
  assert.equal(refused.ok, false);
  assert.equal(refused.silent, true, 'a bot that tells chat off is worse than one that says nothing');
  assert.equal(list.state().total, 0);
});

test('a viewer task carries their name and platform', () => {
  const list = fresh();
  list.setChatCanAdd(true);
  list.createForViewer(viewer, 'beating the boss');
  const [task] = list.state().tasks;
  assert.equal(task.text, 'beating the boss');
  assert.deepEqual(task.by, { platform: 'twitch', name: 'pixelpete', displayName: 'PixelPete' });
});

test('one task each: creating again replaces the one they had', () => {
  const list = fresh();
  list.setChatCanAdd(true);
  list.createForViewer(viewer, 'first idea');
  list.createForViewer(viewer, 'better idea');
  list.createForViewer(other, 'my own thing');
  assert.deepEqual(list.state().tasks.map((t) => t.text), ['better idea', 'my own thing']);
});

test('the same name on two platforms is two different people', () => {
  const list = fresh();
  list.setChatCanAdd(true);
  list.createForViewer({ platform: 'twitch', name: 'sam', displayName: 'Sam' }, 'twitch sam');
  list.createForViewer({ platform: 'kick', name: 'sam', displayName: 'Sam' }, 'kick sam');
  assert.equal(list.state().total, 2);
});

test('a viewer finishing ticks it first, then it clears itself', async () => {
  const list = fresh({ linger: 40 });
  list.setChatCanAdd(true);
  list.createForViewer(viewer, 'homework');
  assert.equal(list.doneForViewer(viewer).ok, true);
  assert.equal(list.state().tasks[0].done, true, 'chat sees the tick');
  await new Promise((r) => setTimeout(r, 90));
  assert.equal(list.state().total, 0, 'and then it is gone');
  list.stop();
});

test('a viewer with nothing on the list finishing is simply ignored', () => {
  const list = fresh();
  list.setChatCanAdd(true);
  const result = list.doneForViewer(viewer);
  assert.equal(result.ok, false);
  assert.equal(result.silent, true);
});

test('the streamer’s own tasks stay ticked - only viewer ones clear themselves', async () => {
  const list = fresh({ linger: 30 });
  list.add('mine');
  list.check(1);
  await new Promise((r) => setTimeout(r, 80));
  assert.equal(list.state().total, 1, 'still there for the whole stream');
  list.stop();
});

// -------------------------------------------------------------- the file

test('every change is on disk straight away', () => {
  const list = fresh();
  list.add('written down');
  const saved = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(saved.tasks[0].text, 'written down');
  assert.equal(saved.chatCanAdd, false);
});

test('a restart comes back with the same list', () => {
  const list = fresh();
  list.setChatCanAdd(true);
  list.add('survive the restart');
  list.createForViewer(viewer, 'mine too');

  const again = createTaskList({ store: createModuleStore('todo'), log: quiet, watchFile: false });
  assert.equal(again.chatCanAdd, true);
  assert.deepEqual(again.state().tasks.map((t) => t.text), ['survive the restart', 'mine too']);
  assert.equal(again.state().tasks[1].by.displayName, 'PixelPete');
});

test('a file typed by hand can be as simple as a list of lines', () => {
  fresh();
  writeFileSync(file, JSON.stringify({ tasks: ['wake up', 'go live'] }));
  const list = createTaskList({ store: createModuleStore('todo'), log: quiet, watchFile: false });
  assert.deepEqual(list.state().tasks.map((t) => [t.n, t.text]), [[1, 'wake up'], [2, 'go live']]);
});

test('nonsense in the file is dropped, never thrown', () => {
  const messy = normalize({ chatCanAdd: 'yes', tasks: [null, 42, { text: '' }, { text: 'real' }, 'also real'] });
  assert.equal(messy.chatCanAdd, true);
  assert.deepEqual(messy.tasks.map((t) => t.text), ['real', 'also real']);
  assert.deepEqual(normalize(null), { chatCanAdd: false, tasks: [] });
  assert.deepEqual(normalize({ tasks: 'not a list' }).tasks, []);
});

test('an edit made in a text editor is picked up while the stream runs', async () => {
  rmSync(join(dir, 'todo'), { recursive: true, force: true });
  let latest = null;
  const list = createTaskList({
    store: createModuleStore('todo'),
    log: quiet,
    onChange: (state) => { latest = state; },
  });
  list.start();
  list.add('from the page');

  writeFileSync(file, JSON.stringify({ chatCanAdd: true, tasks: ['typed by hand'] }));
  for (let i = 0; i < 40 && list.state().tasks[0]?.text !== 'typed by hand'; i++) {
    await new Promise((r) => setTimeout(r, 25));
  }
  list.stop();

  assert.deepEqual(list.state().tasks.map((t) => t.text), ['typed by hand']);
  assert.equal(list.chatCanAdd, true);
  assert.equal(latest.tasks[0].text, 'typed by hand', 'and the overlays were told');
});

test('a half-saved file leaves what is on screen alone', async () => {
  rmSync(join(dir, 'todo'), { recursive: true, force: true });
  const list = createTaskList({ store: createModuleStore('todo'), log: quiet });
  list.start();
  list.add('still here');

  writeFileSync(file, '{ "tasks": [ not json');
  await new Promise((r) => setTimeout(r, 250));
  list.stop();
  assert.deepEqual(list.state().tasks.map((t) => t.text), ['still here']);
});

test('the shipped file is laid down once, so starting over is always possible', () => {
  rmSync(join(dir, 'todo'), { recursive: true, force: true });
  const store = createModuleStore('todo');
  store.seed('tasks', { chatCanAdd: false, tasks: [] });
  assert.equal(existsSync(join(dir, 'todo', 'tasks.initial.config')), true);
});
