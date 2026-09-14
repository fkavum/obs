import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'obs-chatbot-'));
process.env.OBS_TOOLKIT_CONFIG_DIR = dir;
const { createChatbot } = await import('../src/chatbot.js');
const { saveData } = await import('../src/store.js');

// Commands and auto-messages live in their own files now, so the stub config
// has to say where they are, exactly as the real one does.
const FILES = { commands: 'commands/commands', autoMessages: 'commands/auto-messages', timer: 'timer/timer' };
process.on('exit', () => rmSync(dir, { recursive: true, force: true }));

/** A hub with one platform that can talk, recording what it was asked to send. */
function makeHub({ canSend = true } = {}) {
  const hub = new EventEmitter();
  const sent = [];
  hub.sent = sent;
  hub.platforms = new Map([
    ['twitch', {
      adapter: canSend
        ? { send: async (text) => { sent.push(text); }, health: () => ({ connected: true, signedIn: true }) }
        : { health: () => ({ connected: true, signedIn: false }) },
    }],
  ]);
  return hub;
}

const chat = (text, platform = 'twitch') => ({
  id: 'm', type: 'chat', platform, ts: Date.now(), channel: 'c',
  user: { id: 'u1', name: 'bob', displayName: 'Bob', roles: [], color: null, avatar: null },
  data: { text },
});

const settle = () => new Promise((r) => setTimeout(r, 20));

function setup(configOverrides = {}) {
  const { commands, autoMessages, ...rest } = configOverrides;
  const config = { chatbot: { enabled: true, sendTo: [] }, files: FILES, ...rest };
  saveData(config, 'commands', commands ?? [
    { id: 'c1', trigger: '!socials', response: 'Find me at example.com', enabled: true, permission: 'everyone', cooldownSec: 0, userCooldownSec: 0, aliases: [], platforms: [] },
  ]);
  saveData(config, 'autoMessages', autoMessages ?? []);
  const hub = makeHub(configOverrides.hub || {});
  const bot = createChatbot({ config, hub });
  bot.start();
  return { config, hub, bot };
}

test('a command in chat is answered on the platform it came from', async () => {
  const { hub, bot } = setup();
  hub.emit('event', chat('!socials'));
  await settle();
  assert.deepEqual(hub.sent, ['Find me at example.com']);
  bot.stop();
});

test('nothing is sent while the bot is switched off', async () => {
  const { hub, bot } = setup({ chatbot: { enabled: false, sendTo: [] } });
  hub.emit('event', chat('!socials'));
  await settle();
  assert.deepEqual(hub.sent, []);
  bot.stop();
});

test('an ordinary message is not answered', async () => {
  const { hub, bot } = setup();
  hub.emit('event', chat('just chatting about socials'));
  await settle();
  assert.deepEqual(hub.sent, []);
  bot.stop();
});

test('the bot does not answer its own echoed message', async () => {
  // Kick echoes what we send back down the same chat socket. Without the guard,
  // a reply containing a trigger would set the bot talking to itself forever.
  const { hub, bot } = setup({
    commands: [{ id: 'loop', trigger: '!loop', response: '!loop again', enabled: true, permission: 'everyone', cooldownSec: 0, userCooldownSec: 0, aliases: [], platforms: [] }],
  });
  hub.emit('event', chat('!loop'));
  await settle();
  assert.deepEqual(hub.sent, ['!loop again'], 'answered once');

  hub.emit('event', chat('!loop again')); // the echo coming back
  await settle();
  assert.equal(hub.sent.length, 1, 'and did not answer its own echo');
  bot.stop();
});

test('a platform that is connected but NOT signed in cannot talk', async () => {
  const { hub, bot } = setup({ hub: { canSend: false } });
  hub.emit('event', chat('!socials'));
  await settle();
  assert.deepEqual(hub.sent, []);
  assert.deepEqual(bot.status().canSendOn, [], 'and it reports that it cannot talk anywhere');
  bot.stop();
});

test('status reports where the bot is able to talk', () => {
  const { bot } = setup();
  const status = bot.status();
  assert.equal(status.enabled, true);
  assert.deepEqual(status.canSendOn, ['twitch']);
  assert.equal(status.commands.length, 1);
  bot.stop();
});

test('the test button runs a command without cooldowns getting in the way', () => {
  const { bot } = setup();
  assert.deepEqual(bot.test('!socials'), { ok: true, reply: 'Find me at example.com' });
  assert.deepEqual(bot.test('!socials'), { ok: true, reply: 'Find me at example.com' }, 'twice in a row still works');
  assert.equal(bot.test('!nothing').ok, false);
  bot.stop();
});

test('saving replaces the command list and writes it to its own file', () => {
  const { bot } = setup();
  bot.save({ commands: [{ trigger: '!new', response: 'hello', enabled: true }] });
  const saved = bot.getCommands();
  assert.equal(saved.length, 1);
  assert.equal(saved[0].trigger, '!new');
  assert.ok(saved[0].id, 'an id is filled in for new commands');
  bot.stop();
});

test('restoring brings the shipped examples back after editing', () => {
  const { bot, config } = setup();
  bot.save({ commands: [{ trigger: '!mine', response: 'x', enabled: true }] });
  assert.equal(bot.getCommands()[0].trigger, '!mine');
  bot.restore('commands');
  assert.notEqual(bot.getCommands()[0]?.trigger, '!mine', 'the edit is gone');
  bot.stop();
});

test('an adapter that exists but is not signed in is not counted as able to talk', () => {
  // Every adapter has a send() method; only a signed-in one can actually use it,
  // so presence of the method must not be mistaken for the ability.
  const hub = new EventEmitter();
  hub.platforms = new Map([
    ['twitch', { adapter: { send: async () => {}, health: () => ({ connected: true, signedIn: false }) } }],
    ['kick', { adapter: { send: async () => {}, health: () => ({ connected: true, signedIn: true }) } }],
  ]);
  const bot = createChatbot({ config: { chatbot: { enabled: true, sendTo: [] }, files: FILES }, hub });
  assert.deepEqual(bot.status().canSendOn, ['kick']);
});
