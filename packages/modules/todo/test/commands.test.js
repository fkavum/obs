import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'obs-todo-cmd-'));
process.env.OBS_TOOLKIT_CONFIG_DIR = dir;
const { createModuleStore } = await import('#bridge/store.js');
const { createTaskList } = await import('../tasks.js');
const { createCommands, isStreamer } = await import('../commands.js');
process.on('exit', () => rmSync(dir, { recursive: true, force: true }));

const quiet = { info() {}, warn() {}, debug() {}, error() {} };

/** A list and its commands, with whatever the bot tried to say recorded. */
function room() {
  rmSync(join(dir, 'todo'), { recursive: true, force: true });
  const said = [];
  const hub = { say: async (platform, text) => { said.push(text); return true; } };
  const tasks = createTaskList({ store: createModuleStore('todo'), log: quiet, watchFile: false });
  const commands = createCommands({ tasks, hub, log: quiet });
  return { tasks, commands, said, texts: () => tasks.state().tasks.map((t) => t.text) };
}

const chat = (text, user = {}) => ({
  type: 'chat',
  platform: user.platform || 'twitch',
  user: { name: user.name || 'pixelpete', displayName: user.displayName || 'PixelPete', roles: user.roles || [] },
  data: { text },
});
const me = (text, extra = {}) => chat(text, { name: 'thestreamer', displayName: 'TheStreamer', roles: ['broadcaster'], ...extra });

// ------------------------------------------------------- who the streamer is

test('the streamer is whoever the platform badges as the channel owner', () => {
  assert.equal(isStreamer(me('!task add x')), true);
  assert.equal(isStreamer(chat('!task add x', { roles: ['moderator', 'subscriber'] })), false, 'not even a mod');
  assert.equal(isStreamer(chat('!task add x')), false);
});

// ------------------------------------------------------------ the streamer

test('the streamer runs the whole list from their own chat', () => {
  const r = room();
  r.commands.handle(me('!task add water the plants'));
  r.commands.handle(me('!task add feed the cat'));
  r.commands.handle(me('!task add nap'));
  assert.deepEqual(r.texts(), ['water the plants', 'feed the cat', 'nap']);

  r.commands.handle(me('!task done 2'));
  assert.equal(r.tasks.state().tasks[1].done, true);

  r.commands.handle(me('!task move 3 1'));
  assert.deepEqual(r.texts(), ['nap', 'water the plants', 'feed the cat']);

  r.commands.handle(me('!task edit 1 a long nap'));
  assert.equal(r.texts()[0], 'a long nap');

  r.commands.handle(me('!task remove 1'));
  assert.deepEqual(r.texts(), ['water the plants', 'feed the cat']);
});

test('a task with no verb is just added, so nothing has to be remembered', () => {
  const r = room();
  r.commands.handle(me('!task buy more coffee'));
  assert.deepEqual(r.texts(), ['buy more coffee']);
});

test('the wording works however it is typed', () => {
  const r = room();
  r.commands.handle(me('!todo new stretch'));
  r.commands.handle(me('!TASK ADD drink water'));
  r.commands.handle(me('!task tick 1'));
  assert.deepEqual(r.texts(), ['stretch', 'drink water']);
  assert.equal(r.tasks.state().tasks[0].done, true);
});

test('clearing from chat takes the finished ones by default', () => {
  const r = room();
  r.commands.handle(me('!task add one'));
  r.commands.handle(me('!task add two'));
  r.commands.handle(me('!task done 1'));
  r.commands.handle(me('!task clear'));
  assert.deepEqual(r.texts(), ['two']);
  r.commands.handle(me('!task clear all'));
  assert.deepEqual(r.texts(), []);
});

test('the streamer can switch chat tasks on and off from chat', () => {
  const r = room();
  assert.equal(r.tasks.chatCanAdd, false);
  r.commands.handle(me('!task chat on'));
  assert.equal(r.tasks.chatCanAdd, true);
  r.commands.handle(me('!task viewers off'));
  assert.equal(r.tasks.chatCanAdd, false);
});

test('nobody else can touch the list, however they phrase it', () => {
  const r = room();
  r.commands.handle(me('!task add mine'));
  for (const roles of [[], ['subscriber'], ['vip'], ['moderator']]) {
    r.commands.handle(chat('!task add sneaky', { roles }));
    r.commands.handle(chat('!task remove 1', { roles }));
    r.commands.handle(chat('!task clear all', { roles }));
    r.commands.handle(chat('!task chat on', { roles }));
  }
  assert.deepEqual(r.texts(), ['mine'], 'the list is untouched');
  assert.equal(r.tasks.chatCanAdd, false);
});

test('chat asking !tasks is answered, not ignored', () => {
  const r = room();
  r.commands.handle(me('!task add stream for two hours'));
  r.commands.handle(chat('!tasks'));
  assert.match(r.said.at(-1), /1\. stream for two hours/);
});

// ------------------------------------------------------------- the viewers

test('!create does nothing at all while the switch is off', () => {
  const r = room();
  r.commands.handle(chat('!create my own task'));
  assert.deepEqual(r.texts(), []);
  assert.deepEqual(r.said, [], 'and the bot does not tell them off');
});

test('!create puts a viewer on the list under their own name', () => {
  const r = room();
  r.commands.handle(me('!task chat on'));
  r.commands.handle(chat('!create finishing my homework', { name: 'aylin', displayName: 'Aylin', platform: 'kick' }));
  const [task] = r.tasks.state().tasks;
  assert.equal(task.text, 'finishing my homework');
  assert.equal(task.by.displayName, 'Aylin');
  assert.equal(task.by.platform, 'kick');
});

test('a second !create replaces the first, so nobody can fill the list', () => {
  const r = room();
  r.commands.handle(me('!task chat on'));
  r.commands.handle(chat('!create one', { name: 'aylin' }));
  r.commands.handle(chat('!create two', { name: 'aylin' }));
  r.commands.handle(chat('!create three', { name: 'aylin' }));
  assert.deepEqual(r.texts(), ['one'], 'the repeats are inside the cooldown');
});

test('!done ticks the viewer’s own task and nobody else’s', () => {
  const r = room();
  r.commands.handle(me('!task chat on'));
  r.commands.handle(chat('!create mine', { name: 'aylin', displayName: 'Aylin' }));
  r.commands.handle(chat('!create theirs', { name: 'rakun', displayName: 'Rakun' }));

  r.commands.handle(chat('!done', { name: 'rakun', displayName: 'Rakun' }));
  const state = r.tasks.state();
  assert.equal(state.tasks.find((t) => t.text === 'theirs').done, true);
  assert.equal(state.tasks.find((t) => t.text === 'mine').done, false);
});

test('!done from someone with no task is silent', () => {
  const r = room();
  r.commands.handle(me('!task chat on'));
  const before = r.said.length;
  r.commands.handle(chat('!done', { name: 'lurker' }));
  assert.equal(r.said.length, before, 'nothing to say');
});

test('the streamer can tick or remove a viewer’s task by its number', () => {
  const r = room();
  r.commands.handle(me('!task chat on'));
  r.commands.handle(me('!task add my own'));
  r.commands.handle(chat('!create theirs', { name: 'aylin', displayName: 'Aylin' }));
  r.commands.handle(me('!task remove 2'));
  assert.deepEqual(r.texts(), ['my own']);
});

// ------------------------------------------------------------------- other

test('a message that is not one of ours is left alone', () => {
  const r = room();
  assert.equal(r.commands.handle(chat('hello everyone')), false);
  assert.equal(r.commands.handle(chat('!coins')), false, 'another feature owns that one');
  assert.equal(r.commands.handle({ type: 'follow', user: {}, data: {} }), false);
  assert.equal(r.commands.handle(me('!task add x')), true);
});

test('the bot staying silent never stops the list working', () => {
  rmSync(join(dir, 'todo'), { recursive: true, force: true });
  // No hub.say at all: this is what every unsigned-in platform looks like.
  const tasks = createTaskList({ store: createModuleStore('todo'), log: quiet, watchFile: false });
  const commands = createCommands({ tasks, hub: {}, log: quiet });
  commands.handle(me('!task add works anyway'));
  assert.deepEqual(tasks.state().tasks.map((t) => t.text), ['works anyway']);
});
