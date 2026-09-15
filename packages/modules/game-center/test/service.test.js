import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'obs-games-'));
process.env.OBS_TOOLKIT_CONFIG_DIR = dir;
const { GameService } = await import('../service.js');
const { createModuleStore } = await import('#bridge/store.js');
const { ProfileStore } = await import('../profiles.js');
process.on('exit', () => rmSync(dir, { recursive: true, force: true }));

const store = createModuleStore('game-center');
const quietLog = { info() {}, warn() {}, debug() {}, error() {} };
const chat = (name, platform, text) => ({
  type: 'chat', platform, ts: Date.now(), channel: 'c',
  user: { id: name, name: name.toLowerCase(), displayName: name, roles: [] },
  data: { text },
});

function makeService({ keepPoints = false } = {}) {
  const hub = new EventEmitter();
  hub.platforms = new Map();
  const config = {};
  // Coins persist to a file, so without this each test would inherit the last
  // one's leaderboard - which is exactly what caught me out writing these.
  if (!keepPoints) {
    rmSync(join(dir, 'game-center', 'coins.local.config'), { force: true });
    rmSync(join(dir, 'game-center', 'profiles.local.config'), { force: true });
  }
  const profiles = new ProfileStore({ store, log: quietLog, flushMs: 5 });
  const service = new GameService({ config, hub, profiles });
  service.start();
  return { service, hub, config, profiles };
}

test('a game cannot start while another is running', () => {
  const { service } = makeService();
  service.begin('race');
  assert.throws(() => service.begin('boss'), /already running/);
  service.cancel();
  service.begin('boss'); // fine once the first is done
  service.stop();
});

test('an unknown game is refused', () => {
  const { service } = makeService();
  assert.throws(() => service.begin('chess'), /unknown game/);
  service.stop();
});

test('chat from every platform joins the same game', () => {
  const { service, hub } = makeService();
  service.begin('race');
  hub.emit('event', chat('Ann', 'twitch', '!race'));
  hub.emit('event', chat('Ben', 'kick', '!race'));
  hub.emit('event', chat('Cal', 'youtube', '!race'));
  hub.emit('event', chat('Dee', 'twitch', 'just talking'));

  assert.equal(service.state.players.length, 3, 'only the three who typed the command');
  assert.deepEqual(service.state.players.map((p) => p.platform), ['twitch', 'kick', 'youtube']);
  service.stop();
});

test('finishing a game pays the players and records a win', () => {
  const { service, profiles } = makeService();
  service.begin('race');
  service.state = {
    ...service.state,
    phase: 'finished',
    results: [
      { key: 'twitch:ann', name: 'Ann', platform: 'twitch', place: 1, reward: 50 },
      { key: 'kick:ben', name: 'Ben', platform: 'kick', place: 2, reward: 25 },
      { key: 'kick:cal', name: 'Cal', platform: 'kick', place: 3, reward: 0 },
    ],
  };
  service.settle();

  // Everyone starts on 100, so a win is the starting balance plus the prize.
  assert.equal(service.balanceOf('twitch:ann'), 150);
  assert.equal(service.balanceOf('kick:ben'), 125);
  assert.equal(service.balanceOf('kick:cal'), 100, 'no prize, but turning up still counts as played');
  assert.equal(profiles.get('twitch:ann').stats.wins, 1);
  assert.equal(profiles.get('kick:ben').stats.wins, 0, 'second place is not a win');
  assert.equal(profiles.get('kick:cal').stats.played, 1);
  assert.deepEqual(service.leaderboard().map((p) => p.name), ['Ann', 'Ben', 'Cal']);
  service.stop();
});

test('a game is never paid out twice', () => {
  const { service } = makeService();
  service.begin('race');
  service.state = {
    ...service.state, phase: 'finished',
    results: [{ key: 'twitch:ann', name: 'Ann', platform: 'twitch', place: 1, reward: 50 }],
  };
  service.settle();
  service.settle();
  assert.equal(service.balanceOf('twitch:ann'), 150, 'paid once, not twice');
  service.stop();
});

test('a lost heist takes coins away but never below zero', () => {
  const { service, profiles } = makeService();
  profiles.ensure('twitch', 'Ann').coins = 30;
  service.begin('heist');
  service.state = {
    ...service.state, phase: 'finished',
    results: [{ key: 'twitch:ann', name: 'Ann', platform: 'twitch', survived: false, wager: 100, reward: -100 }],
  };
  service.settle();
  assert.equal(service.balanceOf('twitch:ann'), 0, 'floored at zero rather than going negative');
  service.stop();
});

test('coins survive a restart because profiles live in their own file', () => {
  const { service, profiles, config } = makeService();  // fresh ledger, then prove it reloads
  service.begin('race');
  service.state = {
    ...service.state, phase: 'finished',
    results: [{ key: 'twitch:ann', name: 'Ann', platform: 'twitch', place: 1, reward: 20 }],
  };
  service.settle();
  service.stop();
  profiles.stop();
  assert.equal(existsSync(join(dir, 'game-center', 'profiles.local.config')), true, 'written to its own file');

  const reloaded = new ProfileStore({ store: createModuleStore('game-center'), log: quietLog });
  assert.equal(reloaded.coinsOf('twitch:ann'), 120, 'starting 100 plus the 20 won, read back on the next start');
  assert.equal(reloaded.leaderboard()[0].name, 'Ann');
});

test('the heist uses each viewer’s own balance', () => {
  const { service, hub, profiles } = makeService();
  profiles.ensure('twitch', 'Rich').coins = 400;
  profiles.ensure('kick', 'Poor').coins = 5;
  service.begin('heist');

  hub.emit('event', chat('Rich', 'twitch', '!heist all'));
  hub.emit('event', chat('Poor', 'kick', '!heist 100'));

  assert.equal(service.state.players.length, 1, 'Poor cannot afford the minimum');
  assert.equal(service.state.players[0].wager, 400, 'Rich staked everything');
  service.stop();
});

test('status reports the games on offer even with nothing running', () => {
  const { service } = makeService();
  const status = service.status();
  assert.equal(status.running, false);
  assert.deepEqual(status.games.map((g) => g.id), ['race', 'boss', 'heist']);
  for (const g of status.games) assert.match(g.joinCommand, /^!/);
  service.stop();
});

test('a viewer nobody has seen before can still join a heist', () => {
  // Without a starting balance the heist is unplayable on a fresh install:
  // you need points to stake, and points only come from playing.
  const { service, hub } = makeService();
  service.begin('heist');
  hub.emit('event', chat('Newcomer', 'kick', '!heist 50'));

  assert.equal(service.state.players.length, 1);
  assert.equal(service.state.players[0].wager, 50);
  assert.equal(service.balanceOf('kick:newcomer'), 100, 'and they have an account now');
  service.stop();
});

test('a starting balance is granted once, not every time they play', () => {
  const { service, hub } = makeService();
  service.begin('heist');
  hub.emit('event', chat('Ann', 'twitch', '!heist all'));
  const staked = service.state.players[0].wager;

  // They lose the lot.
  service.state = {
    ...service.state, phase: 'finished',
    results: [{ key: 'twitch:ann', name: 'Ann', platform: 'twitch', survived: false, wager: staked, reward: -staked }],
  };
  service.settle();
  assert.equal(service.balanceOf('twitch:ann'), 0, 'broke, and not topped back up');
  service.stop();
});
