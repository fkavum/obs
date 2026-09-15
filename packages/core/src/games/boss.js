/**
 * Raid Boss - a monster appears and the whole chat has to beat it together
 * before the timer runs out. The boss's health scales with how many people join,
 * so it stays close whether five or fifty turn up.
 */
import { baseState, playerFrom, playerKey, between, roll, pick } from './engine.js';

const BOSSES = [
  { name: 'The Lag Spike', emoji: '📉' },
  { name: 'Dropped Frame Dragon', emoji: '🐉' },
  { name: 'Copyright Strike', emoji: '⚖️' },
  { name: 'The Buffering Wheel', emoji: '🌀' },
  { name: 'Mod Mail Golem', emoji: '🗿' },
  { name: 'Sleep Deprivation', emoji: '😵' },
];

export const boss = {
  id: 'boss',
  label: 'Raid Boss',
  emoji: '🐉',
  joinCommand: '!attack',
  joinWindowSec: 25,
  minPlayers: 1,
  fightSec: 75,
  attackCooldownSec: 4,
  joinPrompt: 'A boss appeared! Type !attack to fight it.',
  reward: 30,

  create(options = {}) {
    const state = baseState(boss, options);
    const chosen = options.random ? pick(options.random, BOSSES) : BOSSES[Math.floor(Math.random() * BOSSES.length)];
    return {
      ...state,
      phase: 'running',           // no waiting room: the fight IS the join window
      boss: { ...chosen, hp: 400, maxHp: 400 },
      endsAt: state.startedAt + boss.fightSec * 1000,
      message: boss.joinPrompt,
    };
  },

  /** Every !attack both joins the fight and lands a hit. */
  join(state, event, random, now) {
    if (state.phase !== 'running') return state;
    const key = playerKey(event);
    const existing = state.players.find((p) => p.key === key);

    if (existing && now - existing.lastAttack < boss.attackCooldownSec * 1000) return state;

    const crit = roll(random, 0.12);
    const hit = Math.round(between(random, 8, 22) * (crit ? 3 : 1));

    const players = existing
      ? state.players.map((p) => (p.key === key ? { ...p, damage: p.damage + hit, hits: p.hits + 1, crits: p.crits + (crit ? 1 : 0), lastAttack: now } : p))
      : [...state.players, { ...playerFrom(event), damage: hit, hits: 1, crits: crit ? 1 : 0, lastAttack: now }];

    // More fighters means a tougher boss, so a big chat doesn't trivialise it -
    // but the health stops growing halfway through, otherwise a late rush of
    // joiners adds more health than they can possibly chip off and the fight
    // becomes unwinnable through no fault of the people fighting it.
    const half = state.startedAt + (boss.fightSec * 1000) / 2;
    const counted = now > half ? (state.scaledFor ?? players.length) : players.length;
    const scaledMax = 400 + Math.max(0, counted - 1) * 130;
    const dealt = players.reduce((sum, p) => sum + p.damage, 0);
    const hp = Math.max(0, scaledMax - dealt);

    const next = {
      ...state,
      players,
      scaledFor: counted,
      boss: { ...state.boss, hp, maxHp: scaledMax },
      lastHit: { name: existing ? existing.name : playerFrom(event).name, hit, crit },
    };
    return hp <= 0 ? boss.finish(next, now, true) : next;
  },

  advance(state, random, now) {
    if (state.phase !== 'running') return state;
    if (now >= state.endsAt) return boss.finish(state, now, state.boss.hp <= 0);
    return state;
  },

  finish(state, now, won) {
    const ranked = [...state.players].sort((a, b) => b.damage - a.damage);
    const results = ranked.map((p, i) => ({
      key: p.key, name: p.name, platform: p.platform, place: i + 1, damage: p.damage,
      // Everyone who turned up is paid when the boss falls; the top hitter most.
      reward: won ? boss.reward + (i === 0 ? 40 : i < 3 ? 15 : 0) : 0,
    }));
    return {
      ...state,
      phase: 'finished',
      players: ranked,
      results,
      won,
      finishedAt: now,
      message: won
        ? `⚔️ ${state.boss.name} defeated by ${ranked.length} ${ranked.length === 1 ? 'fighter' : 'fighters'}!`
        : `💀 ${state.boss.name} survived with ${Math.round((state.boss.hp / state.boss.maxHp) * 100)}% health`,
    };
  },
};
