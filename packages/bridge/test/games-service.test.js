import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'obs-games-'));
process.env.OBS_TOOLKIT_CONFIG_DIR = dir;
const { GameService } = await import('../src/games.js');
const { saveData } = await import('../src/store.js');
process.on('exit', () => rmSync(dir, { recursive: true, force: true }));

const FILES = { points: 'games/points' };
const chat = (name, platform, text) => ({
  type: 'chat', platform, ts: Date.now(), channel: 'c',
  user: { id: name, name: name.toLowerCase(), displayName: name, roles: [] },
  data: { text },
});

function makeService({ keepPoints = false } = {}) {
  const hub = new EventEmitter();
  hub.platforms = new Map();
  const config = { files: FILES };
  // Points persist to a file, so without this each test would inherit the last
  // one's leaderboard - which is exactly what caught me out writing these.
  if (!keepPoints) rmSync(join(dir, 'games', 'points.local.config'), { force: true });
  const service = new GameService({ config, hub });
  service.start();
  return { service, hub, config };
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
  const { service } = makeService();
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

  assert.equal(service.balanceOf('twitch:ann'), 50);
  assert.equal(service.balanceOf('kick:ben'), 25);
  assert.equal(service.balanceOf('kick:cal'), 0, 'turning up still counts as played');
  assert.equal(service.points['twitch:ann'].wins, 1);
  assert.equal(service.points['kick:ben'].wins, 0, 'second place is not a win');
  assert.equal(service.points['kick:cal'].played, 1);
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
  assert.equal(service.balanceOf('twitch:ann'), 50, 'not 100');
  service.stop();
});

test('a lost heist takes points away but never below zero', () => {
  const { service } = makeService();
  service.points['twitch:ann'] = { name: 'Ann', platform: 'twitch', points: 30 };
  service.begin('heist');
  service.state = {
    ...service.state, phase: 'finished',
    results: [{ key: 'twitch:ann', name: 'Ann', platform: 'twitch', survived: false, wager: 100, reward: -100 }],
  };
  service.settle();
  assert.equal(service.balanceOf('twitch:ann'), 0, 'floored at zero rather than going negative');
  service.stop();
});

test('points survive a restart because they live in their own file', () => {
  const { service, config } = makeService();  // fresh ledger, then prove it reloads
  service.begin('race');
  service.state = {
    ...service.state, phase: 'finished',
    results: [{ key: 'twitch:ann', name: 'Ann', platform: 'twitch', place: 1, reward: 120 }],
  };
  service.settle();
  service.stop();
  assert.equal(existsSync(join(dir, 'games', 'points.local.config')), true, 'written to its own file');

  const again = new GameService({ config, hub: Object.assign(new EventEmitter(), { platforms: new Map() }) });
  assert.equal(again.balanceOf('twitch:ann'), 120, 'and read back on the next start');
  assert.equal(again.leaderboard()[0].name, 'Ann');
});

test('the heist uses each viewer’s own balance', () => {
  const { service, hub } = makeService();
  service.points['twitch:rich'] = { name: 'Rich', platform: 'twitch', points: 400 };
  service.points['kick:poor'] = { name: 'Poor', platform: 'kick', points: 5 };
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
  assert.ok(service.balanceOf('kick:newcomer') > 0, 'and they have an account now');
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
