import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'obs-gc-commands-'));
process.env.OBS_TOOLKIT_CONFIG_DIR = dir;
const { createModuleStore } = await import('#bridge/store.js');
const { ProfileStore } = await import('../profiles.js');
const { createCommands } = await import('../commands.js');
process.on('exit', () => rmSync(dir, { recursive: true, force: true }));

const quiet = { info() {}, warn() {}, debug() {}, error() {} };

function setup() {
  rmSync(join(dir, 'game-center'), { recursive: true, force: true });
  const profiles = new ProfileStore({ store: createModuleStore('game-center'), log: quiet, flushMs: 5 });
  const cards = [];
  const said = [];
  const hub = Object.assign(new EventEmitter(), {
    broadcast: (m) => cards.push(m),
    say: async (platform, text) => { said.push({ platform, text }); return true; },
  });
  const commands = createCommands({ profiles, games: null, hub, log: quiet });
  return { profiles, commands, cards, said };
}

const chat = (name, platform, text) => ({
  type: 'chat', platform, ts: Date.now(), channel: 'c',
  user: { id: name, name: name.toLowerCase(), displayName: name, roles: [] },
  data: { text },
});

test('!coins answers with a card, and a chat line when a bot can talk', () => {
  const { commands, cards, said, profiles } = setup();
  profiles.ensure('twitch', 'Ann').coins = 250;

  assert.equal(commands.handle(chat('Ann', 'twitch', '!coins')), true);
  assert.equal(cards.length, 1);
  assert.equal(cards[0].card.kind, 'coins');
  assert.equal(cards[0].card.coins, 250);
  assert.ok(cards[0].card.crest, 'the card carries their crest');
  assert.match(said[0].text, /250 coins/);
});

test('the card is the primary answer — a chat reply is optional', () => {
  // Most channels will not have a signed-in bot, so nothing may depend on say().
  const { commands, cards } = setup();
  const hubless = createCommands({
    profiles: new ProfileStore({ store: createModuleStore('game-center'), log: quiet, flushMs: 5 }),
    games: null,
    hub: { broadcast: (m) => cards.push(m) }, // no say()
    log: quiet,
  });
  assert.doesNotThrow(() => hubless.handle(chat('Bob', 'kick', '!coins')));
  assert.equal(cards.at(-1).card.kind, 'coins');
});

test('asking for coins creates a profile for someone never seen before', () => {
  const { commands, profiles } = setup();
  commands.handle(chat('Newcomer', 'youtube', '!coins'));
  assert.equal(profiles.coinsOf('youtube:newcomer'), 100);
});

test('!coins reports where they sit on the leaderboard', () => {
  const { commands, cards, profiles } = setup();
  profiles.ensure('twitch', 'Top').coins = 900;
  profiles.ensure('kick', 'Mid').coins = 400;
  commands.handle(chat('Mid', 'kick', '!coins'));
  assert.deepEqual(cards[0].card.rank, { place: 2, of: 2 });
});

test('!top shows the leaderboard', () => {
  const { commands, cards, profiles } = setup();
  profiles.ensure('twitch', 'Ann').coins = 300;
  profiles.ensure('kick', 'Ben').coins = 800;
  assert.equal(commands.handle(chat('Ann', 'twitch', '!top')), true);
  assert.equal(cards[0].card.kind, 'leaderboard');
  assert.deepEqual(cards[0].card.entries.map((e) => e.name), ['Ben', 'Ann']);
});

test('a repeat within the cooldown is swallowed rather than spamming', () => {
  const { commands, cards } = setup();
  commands.handle(chat('Ann', 'twitch', '!coins'));
  commands.handle(chat('Ann', 'twitch', '!coins'));
  commands.handle(chat('Ann', 'twitch', '!coins'));
  assert.equal(cards.length, 1, 'one card, not three');
});

test('the cooldown is per person, not per channel', () => {
  const { commands, cards } = setup();
  commands.handle(chat('Ann', 'twitch', '!coins'));
  commands.handle(chat('Ben', 'twitch', '!coins'));
  assert.equal(cards.length, 2, 'Ben is not blocked by Ann');
});

test('ordinary chat and unknown commands are left alone', () => {
  const { commands, cards } = setup();
  assert.equal(commands.handle(chat('Ann', 'twitch', 'how many coins do you have')), false);
  assert.equal(commands.handle(chat('Ann', 'twitch', '!somethingelse')), false);
  assert.equal(commands.handle({ type: 'follow', platform: 'twitch' }), false);
  assert.equal(cards.length, 0);
});

test('the cooldown map cannot grow without bound over a long stream', () => {
  const { commands } = setup();
  for (let i = 0; i < 600; i++) commands.handle(chat(`viewer${i}`, 'twitch', '!coins'));
  assert.ok(commands._cooldowns.size <= 600, `held ${commands._cooldowns.size} entries`);
});
