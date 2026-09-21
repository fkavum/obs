import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventEmitter } from 'node:events';

const dir = mkdtempSync(join(tmpdir(), 'obs-todo-mod-'));
process.env.OBS_TOOLKIT_CONFIG_DIR = dir;
const { createModule } = await import('../index.js');
process.on('exit', () => rmSync(dir, { recursive: true, force: true }));

const quiet = { info() {}, warn() {}, debug() {}, error() {} };

/** The module wired to a hub that records what overlays would be sent. */
async function running() {
  rmSync(join(dir, 'todo'), { recursive: true, force: true });
  const sent = [];
  const hub = new EventEmitter();
  hub.broadcast = (message) => sent.push(message);
  hub.say = async () => true;
  const module = createModule({ config: {}, hub, log: quiet });
  await module.start();
  return { module, hub, sent };
}

/** Calls a route the way the server does. */
async function call(module, path, method, body = null) {
  let status = 0;
  let payload = null;
  const handled = await module.routes({
    path,
    method,
    req: {},
    res: {},
    url: new URL(`http://127.0.0.1${path}`),
    sendJSON: (_res, code, data) => { status = code; payload = data; },
    readBody: async () => body,
  });
  return { handled, status, payload };
}

test('the module starts, and an overlay connecting is told the list at once', async () => {
  const { module } = await running();
  await call(module, '/tasks', 'POST', { action: 'add', text: 'say hello' });
  const [hello] = module.hello();
  assert.equal(hello.type, 'todo');
  assert.equal(hello.state.tasks[0].text, 'say hello');
  await module.stop();
});

test('every change reaches the overlays', async () => {
  const { module, sent } = await running();
  await call(module, '/tasks', 'POST', { action: 'add', text: 'first' });
  await call(module, '/tasks', 'POST', { action: 'check', n: 1 });
  assert.equal(sent.length, 2);
  assert.equal(sent[0].type, 'todo');
  assert.equal(sent.at(-1).state.tasks[0].done, true);
  await module.stop();
});

test('a chat message from the streamer changes the list, and the overlays hear it', async () => {
  const { module, hub, sent } = await running();
  hub.emit('event', {
    type: 'chat',
    platform: 'twitch',
    user: { name: 'thestreamer', displayName: 'TheStreamer', roles: ['broadcaster'] },
    data: { text: '!task add from chat' },
  });
  assert.equal(sent.at(-1).state.tasks[0].text, 'from chat');
  await module.stop();
});

test('the setup page reads and writes the same list chat does', async () => {
  const { module } = await running();
  const added = await call(module, '/tasks', 'POST', { action: 'add', text: 'from the page' });
  assert.equal(added.status, 200);
  assert.equal(added.payload.ok, true);
  assert.equal(added.payload.tasks[0].text, 'from the page', 'the whole list comes back with it');

  const read = await call(module, '/tasks', 'GET');
  assert.equal(read.payload.total, 1);
  assert.equal(read.payload.left, 1);
  await module.stop();
});

test('a bad request is answered, not thrown', async () => {
  const { module } = await running();
  const bad = await call(module, '/tasks', 'POST', { action: 'explode' });
  assert.equal(bad.status, 400);
  assert.match(bad.payload.message, /no such action/);

  const missing = await call(module, '/nope', 'GET');
  assert.equal(missing.handled, false, 'the server sends its own 404');
  await module.stop();
});

test('stopping lets go of the chat feed', async () => {
  const { module, hub, sent } = await running();
  await module.stop();
  const before = sent.length;
  hub.emit('event', {
    type: 'chat',
    platform: 'twitch',
    user: { roles: ['broadcaster'], name: 'thestreamer' },
    data: { text: '!task add after stop' },
  });
  assert.equal(sent.length, before, 'nothing is listening any more');
});
