import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createWalker, step, pickSpot, startLeaving, longestQuiet, nearestNeighbour, positionOf, MOTION,
} from '../shared/wander-motion.js';
import { createWander, MIN_GAP_MS } from '../wander.js';
import { createProfile } from '../shared/profiles.js';

const BOUNDS = { left: 0, right: 1920, width: 96 };
const CONFIG = { speed: 30, staySec: 90, restiness: 0, maxPets: 10 };
/** A fixed "random" so a walk is reproducible. */
const seeded = (seed = 1) => () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

function walk(walkers, { from = 0, to, dt = 0.05, config = CONFIG, random = seeded(7) }) {
  const done = [];
  for (let now = from; now <= to; now += dt * 1000) {
    done.push(...step(walkers, { now, dt, bounds: BOUNDS, config, random }));
  }
  return done;
}

test('a pet enters from off screen and walks to its spot', () => {
  const walker = createWalker({ key: 'a', now: 0, bounds: BOUNDS, config: CONFIG, random: seeded(3) });
  assert.ok(walker.x < BOUNDS.left || walker.x > BOUNDS.right - BOUNDS.width, 'starts off screen');
  assert.ok(walker.target >= BOUNDS.left && walker.target <= BOUNDS.right, 'has somewhere to go');

  walk([walker], { to: 60000 });
  assert.equal(walker.target, null, 'it arrived');
  assert.ok(walker.x >= BOUNDS.left && walker.x <= BOUNDS.right - BOUNDS.width,
    `settled on screen at ${walker.x}`);
});

test('pets stay inside the strip forever, however long they walk', () => {
  const walkers = [];
  const random = seeded(11);
  for (let i = 0; i < 6; i++) {
    walkers.push(createWalker({ key: `p${i}`, now: 0, bounds: BOUNDS, config: { ...CONFIG, staySec: 100000 }, walkers, random }));
  }
  // Eight simulated minutes.
  walk(walkers, { to: 480000, config: { ...CONFIG, staySec: 100000 }, random });
  for (const w of walkers) {
    assert.ok(w.x >= BOUNDS.left - 1, `${w.key} is not off the left (${w.x})`);
    assert.ok(w.x <= BOUNDS.right - w.width + 1, `${w.key} is not off the right (${w.x})`);
    assert.ok(Number.isFinite(w.x), `${w.key} has a real position`);
  }
});

test('margins are respected, so a pet never walks over your webcam', () => {
  const bounds = { left: 400, right: 1500, width: 96 };
  const random = seeded(5);
  const walkers = [createWalker({ key: 'a', now: 0, bounds, config: CONFIG, random })];
  for (let now = 0; now <= 200000; now += 50) {
    step(walkers, { now, dt: 0.05, bounds, config: CONFIG, random });
    const w = walkers[0];
    if (w.target == null) {
      assert.ok(w.x >= bounds.left - 1, `stayed right of the margin (${w.x})`);
      assert.ok(w.x <= bounds.right - w.width + 1, `stayed left of the margin (${w.x})`);
    }
  }
});

test('arrivals spread out instead of piling into one corner', () => {
  const walkers = [];
  const random = seeded(23);
  const config = { ...CONFIG, staySec: 100000 };
  for (let i = 0; i < 5; i++) {
    const walker = createWalker({ key: `p${i}`, now: 0, bounds: BOUNDS, config, walkers, random });
    walkers.push(walker);
    walk(walkers, { from: i * 1400, to: (i + 1) * 1400, config, random });
  }
  walk(walkers, { from: 7000, to: 30000, config, random });

  const xs = walkers.map((w) => w.x).sort((a, b) => a - b);
  const gaps = xs.slice(1).map((x, i) => x - xs[i]);
  assert.ok(Math.min(...gaps) > BOUNDS.width * 0.5,
    `nobody is standing on anybody: gaps were ${gaps.map(Math.round).join(', ')}`);
  assert.ok(xs[xs.length - 1] - xs[0] > 600, 'and they used the width of the screen');
});

test('a crowded pet moves away rather than settling on top of someone', () => {
  const random = seeded(2);
  const config = { ...CONFIG, staySec: 100000, restiness: 100 };
  const a = { key: 'a', state: 'here', x: 500, target: null, dir: 1, depth: 0, width: 96, speed: 30, until: 1e9, restUntil: 0, nextThink: 0, removeAt: 0 };
  const b = { key: 'b', state: 'here', x: 520, target: null, dir: -1, depth: 0, width: 96, speed: 30, until: 1e9, restUntil: 0, nextThink: 0, removeAt: 0 };
  const walkers = [a, b];
  walk(walkers, { to: 20000, config, random });
  assert.ok(Math.abs(a.x - b.x) > 96 * MOTION.personalSpace,
    `they separated (${Math.round(a.x)} vs ${Math.round(b.x)})`);
});

test('resting stops the walking, and only while resting', () => {
  const random = () => 0.5;
  const config = { ...CONFIG, staySec: 100000, restiness: 100 };
  const walker = createWalker({ key: 'a', now: 0, bounds: BOUNDS, config, random });
  walker.target = null;
  walker.x = 900;
  walker.nextThink = 0;
  step([walker], { now: 1, dt: 0.05, bounds: BOUNDS, config, random });
  assert.ok(walker.restUntil > 1, 'it decided to rest');
  const parked = walker.x;
  step([walker], { now: 100, dt: 0.05, bounds: BOUNDS, config, random });
  assert.equal(walker.x, parked, 'and did not move');
  assert.equal(walker.moving, false);

  // Stop it deciding to rest again the instant this rest ends — at 100%
  // restiness it would, quite correctly, and there'd be nothing to observe.
  walker.nextThink = Infinity;
  step([walker], { now: walker.restUntil + 1, dt: 0.05, bounds: BOUNDS, config, random });
  assert.notEqual(walker.x, parked, 'then walked on');
  assert.equal(walker.moving, true);
});

test('a pet leaves when its stay runs out, and is removed after the fade', () => {
  const random = seeded(9);
  const config = { ...CONFIG, staySec: 10 };
  const walker = createWalker({ key: 'a', now: 0, bounds: BOUNDS, config, random });
  walk([walker], { to: 9000, config, random });
  assert.equal(walker.state, 'arriving');

  step([walker], { now: 10001, dt: 0.05, bounds: BOUNDS, config, random });
  assert.equal(walker.state, 'leaving');
  assert.equal(walker.removeAt, 10001 + MOTION.exitMs);

  const gone = step([walker], { now: walker.removeAt + 1, dt: 0.05, bounds: BOUNDS, config, random });
  assert.deepEqual(gone, [walker], 'reported once it can be taken off the page');
});

test('a leaving pet keeps walking, and off the edge rather than turning', () => {
  const random = seeded(4);
  const walker = createWalker({ key: 'a', now: 0, bounds: BOUNDS, config: CONFIG, random });
  walk([walker], { to: 40000, random });
  walker.dir = -1;
  walker.x = 10;
  startLeaving(walker, 40000);
  walker.removeAt = Infinity;
  walk([walker], { from: 40000, to: 60000, random });
  assert.ok(walker.x < BOUNDS.left, 'it walked off rather than bouncing off the wall');
});

test('when the yard is full it is the quietest owner who leaves', () => {
  const walkers = [
    { key: 'chatty', state: 'here', until: 9000, x: 100 },
    { key: 'quiet', state: 'here', until: 3000, x: 300 },
    { key: 'leaving', state: 'leaving', until: 1, x: 500 },
  ];
  assert.equal(longestQuiet(walkers).key, 'quiet', 'one already leaving does not count');
});

test('the position puts pets in the strip, near pets in front', () => {
  const near = { x: 100, depth: 1 };
  const far = { x: 100, depth: 0 };
  const shape = { edge: 'bottom', lane: 24, laneDepth: 60, viewportHeight: 1080, height: 120 };
  const a = positionOf(near, shape);
  const b = positionOf(far, shape);
  assert.equal(b.y, 1080 - 24 - 0 - 120);
  assert.equal(a.y, 1080 - 24 - 60 - 120, 'a deeper pet sits higher up the strip');
  assert.ok(a.z < b.z, 'and behind the one in front');

  const top = positionOf(far, { ...shape, edge: 'top' });
  assert.equal(top.y, 24, 'the top edge measures from the top');
});

test('pickSpot avoids where pets already are', () => {
  const crowd = [{ x: 100, state: 'here' }, { x: 200, state: 'here' }, { x: 300, state: 'here' }];
  const random = seeded(31);
  for (let i = 0; i < 20; i++) {
    const spot = pickSpot(crowd, BOUNDS, random);
    assert.ok(spot >= BOUNDS.left, 'inside the strip');
    assert.ok(spot <= BOUNDS.right - BOUNDS.width);
  }
  const far = pickSpot(crowd, BOUNDS, seeded(31));
  assert.ok(Math.min(...crowd.map((c) => Math.abs(c.x - far))) > 100, 'and not on top of anyone');
});

test('nearestNeighbour ignores itself and anyone on the way out', () => {
  const me = { x: 500, state: 'here' };
  const leaving = { x: 505, state: 'leaving' };
  const other = { x: 700, state: 'here' };
  const { nearest, distance } = nearestNeighbour(me, [me, leaving, other]);
  assert.equal(nearest, other);
  assert.equal(distance, 200);
  assert.equal(nearestNeighbour(me, [me]).nearest, null);
});

// ---- the broadcaster -------------------------------------------------------

function bridge({ pet = { name: 'Biscuit', species: 'dog', level: 3, colour: 'moss', accessories: { hat: 'crown' } } } = {}) {
  const sent = [];
  const store = {};
  const profiles = {
    byName: (platform, name) => store[`${platform}:${String(name).toLowerCase()}`] || null,
    all: () => store,
    touch() {},
  };
  const pets = { activePetOf: (profile) => (profile.pets.length ? pet : null) };
  const hub = { broadcast: (m) => sent.push(m) };
  const add = (platform, name, withPet = true) => {
    const profile = createProfile({ key: `${platform}:${name}`, name, platform });
    if (withPet) profile.pets.push(pet);
    store[`${platform}:${name.toLowerCase()}`] = profile;
    return profile;
  };
  return { wander: createWander({ profiles, pets, hub }), sent, add, profiles };
}

const chat = (name, platform = 'twitch') => ({
  type: 'chat', platform, user: { name: name.toLowerCase(), displayName: name },
});

test('chatting brings out your pet', () => {
  const b = bridge();
  b.add('twitch', 'Ann');
  assert.equal(b.wander.handle(chat('Ann')), true);
  assert.equal(b.sent.length, 1);
  const msg = b.sent[0];
  assert.equal(msg.type, 'gc:wander');
  assert.equal(msg.owner, 'Ann');
  assert.equal(msg.platform, 'twitch');
  assert.equal(msg.pet.name, 'Biscuit');
  assert.deepEqual(msg.pet.accessories, { hat: 'crown' }, 'what they are wearing comes with them');
});

test('a chatter with no profile costs nothing and creates nothing', () => {
  const b = bridge();
  assert.equal(b.wander.handle(chat('Stranger')), false);
  assert.equal(b.sent.length, 0);
  assert.deepEqual(Object.keys(b.profiles.all()), [], 'lurkers do not become profiles');
});

test('someone with a profile but no pet stays off screen', () => {
  const b = bridge();
  b.add('twitch', 'Petless', false);
  assert.equal(b.wander.handle(chat('Petless')), false);
  assert.equal(b.sent.length, 0);
});

test('a talkative viewer is not re-announced on every message', () => {
  const b = bridge();
  b.add('twitch', 'Ann');
  assert.equal(b.wander.handle(chat('Ann')), true);
  assert.equal(b.wander.handle(chat('Ann')), false, 'inside the gap');
  assert.equal(b.sent.length, 1);
});

test('the same name on two platforms is two pets', () => {
  const b = bridge();
  b.add('twitch', 'Ann');
  b.add('kick', 'Ann');
  assert.equal(b.wander.handle(chat('Ann', 'twitch')), true);
  assert.equal(b.wander.handle(chat('Ann', 'kick')), true);
  assert.deepEqual(b.sent.map((m) => m.platform), ['twitch', 'kick']);
  assert.notEqual(b.sent[0].key, b.sent[1].key);
});

test('a new hat goes out at once, without waiting for the gap', () => {
  const b = bridge();
  const profile = b.add('twitch', 'Ann');
  b.wander.handle(chat('Ann'));
  assert.equal(b.sent.length, 1);
  assert.equal(b.wander.refresh(profile), true, 'a change is never throttled');
  assert.equal(b.sent.length, 2);
});

test('nothing but chat moves anything', () => {
  const b = bridge();
  b.add('twitch', 'Ann');
  for (const type of ['follow', 'subscription', 'raid', 'donation']) {
    assert.equal(b.wander.handle({ ...chat('Ann'), type }), false);
  }
  assert.equal(b.wander.handle(null), false);
  assert.equal(b.wander.handle({ type: 'chat' }), false, 'a chat with no user');
  assert.equal(b.sent.length, 0);
});

test('the gap is long enough to matter but short enough to feel live', () => {
  assert.ok(MIN_GAP_MS >= 3000 && MIN_GAP_MS <= 30000);
});
