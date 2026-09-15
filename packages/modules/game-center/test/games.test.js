import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GAMES, race, boss, heist, makeRandom, playerKey, matchesCommand } from '../shared/games/index.js';

const T0 = 1_000_000;
const chatter = (name, platform = 'twitch', text = '') => ({
  type: 'chat', platform, ts: T0, channel: 'c',
  user: { id: name, name: name.toLowerCase(), displayName: name, roles: [], color: null },
  data: { text },
});
/** Run a game to completion without waiting in real time. */
function playOut(game, state, random, { step = 500, limit = 400 } = {}) {
  let now = state.startedAt;
  for (let i = 0; i < limit && state.phase !== 'finished'; i++) {
    now += step;
    if (state.phase === 'joining' && now >= state.joinEndsAt) state = game.start(state, now, random);
    else if (state.phase === 'running' && game.advance) state = game.advance(state, random, now);
  }
  return state;
}

test('a player is identified per platform, so the same name twice is two people', () => {
  assert.equal(playerKey(chatter('Bob', 'twitch')), 'twitch:bob');
  assert.notEqual(playerKey(chatter('Bob', 'twitch')), playerKey(chatter('Bob', 'kick')));
});

test('join commands match the whole word, with or without arguments', () => {
  assert.equal(matchesCommand('!race', '!race'), true);
  assert.equal(matchesCommand('  !RACE  ', '!race'), true);
  assert.equal(matchesCommand('!heist 50', '!heist'), true);
  assert.equal(matchesCommand('!racecar', '!race'), false, 'not a prefix match');
  assert.equal(matchesCommand('go !race', '!race'), false);
});

test('the same game replays identically from a seed', () => {
  const run = () => {
    const random = makeRandom(42);
    let state = race.create({ now: T0, seed: 42 });
    for (const n of ['A', 'B', 'C']) state = race.join(state, chatter(n));
    return playOut(race, state, random).results.map((r) => r.name);
  };
  assert.deepEqual(run(), run(), 'same seed, same winner');
});

// ---------------------------------------------------------------- race

test('race: players from different platforms share one field', () => {
  let state = race.create({ now: T0 });
  state = race.join(state, chatter('Ann', 'twitch'));
  state = race.join(state, chatter('Ben', 'kick'));
  state = race.join(state, chatter('Cal', 'youtube'));
  assert.deepEqual(state.players.map((p) => p.platform), ['twitch', 'kick', 'youtube']);
});

test('race: joining twice does nothing, and joining late does nothing', () => {
  let state = race.create({ now: T0 });
  state = race.join(state, chatter('Ann'));
  state = race.join(state, chatter('Ann'));
  assert.equal(state.players.length, 1);

  const running = { ...state, phase: 'running' };
  assert.equal(race.join(running, chatter('Late')).players.length, 1, 'the gate is shut');
});

test('race: finishes with everyone placed and the winner rewarded most', () => {
  const random = makeRandom(7);
  let state = race.create({ now: T0 });
  for (const n of ['Ann', 'Ben', 'Cal', 'Dee']) state = race.join(state, chatter(n));
  state = playOut(race, state, random);

  assert.equal(state.phase, 'finished');
  assert.deepEqual(state.results.map((r) => r.place), [1, 2, 3, 4]);
  assert.ok(state.results[0].reward > state.results[1].reward);
  assert.equal(state.results[3].reward, 0, 'only the podium is paid');
  assert.match(state.message, /wins/);
});

test('race: one player alone is abandoned rather than crowned', () => {
  let state = race.create({ now: T0 });
  state = race.join(state, chatter('Solo'));
  state = race.start(state, T0 + 1000);
  assert.equal(state.phase, 'finished');
  assert.equal(state.abandoned, true);
  assert.deepEqual(state.results, []);
});

// ---------------------------------------------------------------- boss

test('boss: every attack both joins the fight and lands a hit', () => {
  const random = makeRandom(3);
  let state = boss.create({ now: T0, random });
  state = boss.join(state, chatter('Ann'), random, T0);
  assert.equal(state.players.length, 1);
  assert.ok(state.players[0].damage > 0);
  assert.ok(state.boss.hp < state.boss.maxHp);
});

test('boss: attacks are rate-limited per person, not per chat', () => {
  const random = makeRandom(3);
  let state = boss.create({ now: T0, random });
  state = boss.join(state, chatter('Ann'), random, T0);
  const damage = state.players[0].damage;

  state = boss.join(state, chatter('Ann'), random, T0 + 500);
  assert.equal(state.players[0].damage, damage, 'too soon: ignored');

  state = boss.join(state, chatter('Ben'), random, T0 + 500);
  assert.equal(state.players.length, 2, 'someone else may still swing');

  state = boss.join(state, chatter('Ann'), random, T0 + 5000);
  assert.ok(state.players[0].damage > damage, 'and Ann may swing again after the cooldown');
});

test('boss: health scales with the crowd so a big chat is not trivial', () => {
  const random = makeRandom(11);
  let small = boss.create({ now: T0, random });
  small = boss.join(small, chatter('A'), random, T0);
  const smallMax = small.boss.maxHp;

  let big = boss.create({ now: T0, random });
  for (const n of ['A', 'B', 'C', 'D', 'E']) big = big.phase === 'finished' ? big : boss.join(big, chatter(n), random, T0);
  assert.ok(big.boss.maxHp > smallMax, `${big.boss.maxHp} should exceed ${smallMax}`);
});

test('boss: beaten in time is a win and pays everyone who turned up', () => {
  const random = makeRandom(5);
  let state = boss.create({ now: T0, random });
  let now = T0;
  for (let i = 0; i < 200 && state.phase === 'running'; i++) {
    now += 5000;
    state = boss.join(state, chatter('Ann'), random, now);
  }
  assert.equal(state.phase, 'finished');
  assert.equal(state.won, true);
  assert.ok(state.results[0].reward > 0);
  assert.match(state.message, /defeated/);
});

test('boss: running out of time is a loss and pays nobody', () => {
  const random = makeRandom(5);
  let state = boss.create({ now: T0, random });
  state = boss.join(state, chatter('Ann'), random, T0);
  state = boss.advance(state, random, state.endsAt + 1);
  assert.equal(state.phase, 'finished');
  assert.equal(state.won, false);
  assert.equal(state.results[0].reward, 0);
  assert.match(state.message, /survived/);
});

// ---------------------------------------------------------------- heist

test('heist: the wager is read from the message and capped by what you have', () => {
  const balance = () => 120;
  let state = heist.create({ now: T0 });
  state = heist.join(state, chatter('Ann', 'twitch', '!heist 50'), balance);
  state = heist.join(state, chatter('Ben', 'kick', '!heist 9999'), balance);
  state = heist.join(state, chatter('Cal', 'kick', '!heist all'), balance);
  state = heist.join(state, chatter('Dee', 'kick', '!heist'), balance);

  assert.equal(state.players[0].wager, 50);
  assert.equal(state.players[1].wager, 120, 'capped at the balance');
  assert.equal(state.players[2].wager, 120, '"all" means everything');
  assert.equal(state.players[3].wager, heist.minWager, 'no number means the minimum');
  assert.equal(state.pot, 50 + 120 + 120 + heist.minWager);
});

test('heist: someone who cannot afford the minimum is not added', () => {
  let state = heist.create({ now: T0 });
  state = heist.join(state, chatter('Broke', 'twitch', '!heist 50'), () => 3);
  assert.equal(state.players.length, 0);
});

test('heist: a bigger crew means better odds, which is the whole game', () => {
  assert.ok(heist.successChance(10) > heist.successChance(2));
  assert.ok(heist.successChance(100) <= 0.82, 'but never a sure thing');
});

test('heist: survivors double their stake and the caught lose theirs', () => {
  const random = makeRandom(9);
  let state = heist.create({ now: T0 });
  for (const n of ['Ann', 'Ben', 'Cal', 'Dee', 'Eve']) {
    state = heist.join(state, chatter(n, 'twitch', '!heist 100'), () => 500);
  }
  state = heist.start(state, T0 + 60000, random);

  assert.equal(state.phase, 'finished');
  assert.equal(state.results.length, 5);
  for (const r of state.results) {
    assert.equal(r.reward, r.survived ? r.wager : -r.wager);
  }
});

test('heist: too small a crew is called off and nobody loses anything', () => {
  const random = makeRandom(9);
  let state = heist.create({ now: T0 });
  state = heist.join(state, chatter('Solo', 'twitch', '!heist 100'), () => 500);
  state = heist.start(state, T0 + 60000, random);
  assert.equal(state.abandoned, true);
  assert.deepEqual(state.results, []);
  assert.match(state.message, /keeps their points/);
});

test('all three games are registered with a join command and a label', () => {
  for (const [id, game] of Object.entries(GAMES)) {
    assert.equal(game.id, id);
    assert.match(game.joinCommand, /^![a-z]+$/);
    assert.ok(game.label && game.emoji, id);
  }
});

test('boss: a late rush of joiners cannot make the fight unwinnable', () => {
  // Each fighter adds health. Without a cap, people arriving near the end add
  // more health than they can remove, punishing the chat for turning up.
  const random = makeRandom(21);
  let state = boss.create({ now: T0, random });
  const half = T0 + (boss.fightSec * 1000) / 2;

  for (const n of ['A', 'B', 'C']) state = boss.join(state, chatter(n), random, T0 + 1000);
  const maxAtHalf = state.boss.maxHp;

  // A crowd piles in after halfway.
  for (const n of ['D', 'E', 'F', 'G', 'H', 'I']) {
    if (state.phase === 'running') state = boss.join(state, chatter(n), random, half + 5000);
  }
  assert.equal(state.boss.maxHp, maxAtHalf, 'health is frozen from halfway on');
  assert.ok(state.players.length > 3, 'but the newcomers still get to fight');
});
