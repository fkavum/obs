import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'obs-profiles-'));
process.env.OBS_TOOLKIT_CONFIG_DIR = dir;
const { createModuleStore } = await import('#bridge/store.js');
const { ProfileStore } = await import('../profiles.js');
const {
  defaultCrest, profileKey, createProfile, upgradeProfile, addCoins, spend, canAfford,
  formatCoins, STARTING_COINS, CREST_SHAPES, COAT_NAMES,
} = await import('../shared/profiles.js');
process.on('exit', () => rmSync(dir, { recursive: true, force: true }));

const quiet = { info() {}, warn() {}, debug() {}, error() {} };
const fresh = () => {
  rmSync(join(dir, 'game-center'), { recursive: true, force: true });
  return new ProfileStore({ store: createModuleStore('game-center'), log: quiet, flushMs: 5 });
};

// ---------------------------------------------------------------- identity

test('a profile belongs to a viewer on one platform', () => {
  assert.equal(profileKey('twitch', 'PixelPete'), 'twitch:pixelpete');
  assert.notEqual(profileKey('twitch', 'Pete'), profileKey('kick', 'Pete'));
});

test('everyone has a crest before they do anything, and it never changes', () => {
  const key = profileKey('twitch', 'pixelpete');
  const a = defaultCrest(key);
  assert.deepEqual(a, defaultCrest(key), 'same viewer, same crest, every time');
  assert.ok(CREST_SHAPES.includes(a.shape));
  assert.ok(COAT_NAMES.includes(a.primary));
  assert.notEqual(a.primary, a.secondary, 'never one colour on itself');
});

test('the same name on two platforms gets two different crests', () => {
  const twitch = defaultCrest(profileKey('twitch', 'sam'));
  const kick = defaultCrest(profileKey('kick', 'sam'));
  assert.notDeepEqual(twitch, kick, 'they are different people and should look it');
});

// ---------------------------------------------------------------- coins

test('a new viewer starts with coins so the heist is playable on day one', () => {
  const p = createProfile({ key: 'twitch:new', name: 'New', platform: 'twitch' });
  assert.equal(p.coins, STARTING_COINS);
  assert.deepEqual(p.pets, []);
  assert.equal(p.stats.played, 0);
});

test('coins never go negative', () => {
  const p = createProfile({ key: 'k', name: 'n', platform: 'twitch' });
  p.coins = 30;
  addCoins(p, -100);
  assert.equal(p.coins, 0, 'losing more than you have floors at zero');
});

test('spending is refused when it cannot be afforded, and changes nothing', () => {
  const p = createProfile({ key: 'k', name: 'n', platform: 'twitch' });
  p.coins = 50;
  assert.equal(canAfford(p, 75), false);
  assert.equal(spend(p, 75), false);
  assert.equal(p.coins, 50, 'a refused purchase must not deduct');
  assert.equal(spend(p, 50), true);
  assert.equal(p.coins, 0);
});

test('coins are shown compactly once they get big', () => {
  assert.equal(formatCoins(0), '0');
  assert.equal(formatCoins(1500), '1,500');
  assert.equal(formatCoins(24500), '24.5k');
});

// ---------------------------------------------------------------- the store

test('a viewer is given a profile the first time they are seen', () => {
  const store = fresh();
  const p = store.ensure('twitch', 'PixelPete');
  assert.equal(p.coins, STARTING_COINS);
  assert.equal(store.coinsOf('twitch:pixelpete'), STARTING_COINS);
  assert.equal(Object.keys(store.all()).length, 1);
  store.stop();
});

test('a changed display name is picked up without losing the profile', () => {
  const store = fresh();
  store.ensure('twitch', 'pixelpete').coins = 250;
  const again = store.ensure('twitch', 'PixelPete');
  assert.equal(again.coins, 250, 'same profile');
  assert.equal(again.name, 'PixelPete', 'name refreshed');
  store.stop();
});

test('the leaderboard ranks by coins and can say where someone sits', () => {
  const store = fresh();
  store.ensure('twitch', 'Ann').coins = 300;
  store.ensure('kick', 'Ben').coins = 900;
  store.ensure('youtube', 'Cal').coins = 100;
  assert.deepEqual(store.leaderboard().map((p) => p.name), ['Ben', 'Ann', 'Cal']);
  assert.deepEqual(store.rankOf('twitch:ann'), { place: 2, of: 3 });
  assert.equal(store.rankOf('twitch:nobody'), null);
  store.stop();
});

test('writes are debounced rather than one per change', () => {
  const store = fresh();
  const path = join(dir, 'game-center', 'profiles.local.config');
  for (let i = 0; i < 50; i++) store.ensure('twitch', `viewer${i}`);
  assert.equal(existsSync(path), false, 'fifty changes, nothing written yet');
  assert.equal(store.flush(), true);
  assert.equal(Object.keys(JSON.parse(readFileSync(path, 'utf8'))).length, 50);
  assert.equal(store.flush(), false, 'nothing to write the second time');
  store.stop();
});

test('stopping flushes, so coins won in the last few seconds are not lost', () => {
  const store = fresh();
  store.ensure('twitch', 'Ann').coins = 777;
  store.touch();
  store.stop();
  const reloaded = new ProfileStore({ store: createModuleStore('game-center'), log: quiet });
  assert.equal(reloaded.coinsOf('twitch:ann'), 777);
});

test('balances from the older flat coin ledger are carried over, not reset', () => {
  // Someone who had been playing before profiles existed must not lose what
  // they earned.
  rmSync(join(dir, 'game-center'), { recursive: true, force: true });
  const raw = createModuleStore('game-center');
  raw.save('coins', {
    'twitch:veteran': { name: 'Veteran', platform: 'twitch', coins: 4200, wins: 9, played: 40 },
  });

  const store = new ProfileStore({ store: createModuleStore('game-center'), log: quiet });
  const p = store.get('twitch:veteran');
  assert.equal(p.coins, 4200, 'balance intact');
  assert.equal(p.stats.wins, 9, 'and their record');
  assert.equal(p.stats.played, 40);
  assert.ok(p.crest, 'they get a crest they never had');
  assert.deepEqual(p.pets, []);
  store.stop();
});

test('an older record is upgraded without losing unknown fields', () => {
  const p = upgradeProfile('twitch:x', { name: 'X', platform: 'twitch', points: 55, somethingNew: 'keep me' });
  assert.equal(p.coins, 55, 'points became coins');
  assert.equal(p.somethingNew, 'keep me');
  assert.equal(p.points, undefined);
});
