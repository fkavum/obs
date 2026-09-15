/**
 * Chat Race - everyone who types !race gets a runner, and they sprint across the
 * screen. The most watchable of the three: chat can see themselves moving.
 */
import { baseState, playerFrom, playerKey, between, roll, abandon } from './engine.js';

const TRACK = 100;

export const race = {
  id: 'race',
  label: 'Chat Race',
  emoji: '🏁',
  joinCommand: '!race',
  joinWindowSec: 40,
  minPlayers: 2,
  maxPlayers: 30,
  joinPrompt: 'Type !race to join the race!',
  reward: 50,

  create(options) {
    return { ...baseState(race, options), track: TRACK, tick: 0 };
  },

  /** @returns {object} the next state - never mutates. */
  join(state, event) {
    if (state.phase !== 'joining') return state;
    const key = playerKey(event);
    if (state.players.some((p) => p.key === key)) return state;
    if (state.players.length >= race.maxPlayers) return state;
    return {
      ...state,
      players: [...state.players, { ...playerFrom(event), pos: 0, boosts: 0, finishedAt: null }],
    };
  },

  start(state, now) {
    if (state.players.length < race.minPlayers) return abandon(state);
    return { ...state, phase: 'running', endsAt: now + 60000, message: 'And they’re off!' };
  },

  /** One step of the simulation. Called a few times a second. */
  advance(state, random, now) {
    if (state.phase !== 'running') return state;

    let anyFinished = false;
    const players = state.players.map((p) => {
      if (p.finishedAt) return p;
      // A small chance of a burst keeps the lead changing, which is the fun part.
      const boosted = roll(random, 0.08);
      const step = between(random, 0.6, 2.2) * (boosted ? 2.6 : 1);
      const pos = Math.min(TRACK, p.pos + step);
      const finishedAt = pos >= TRACK ? now : null;
      if (finishedAt) anyFinished = true;
      return { ...p, pos, boosts: p.boosts + (boosted ? 1 : 0), finishedAt };
    });

    const next = { ...state, players, tick: state.tick + 1 };
    // Let stragglers keep running for a moment so chat sees the placings fill in.
    const done = players.filter((p) => p.finishedAt).length;
    const enough = done >= Math.min(3, players.length);
    if ((anyFinished && enough) || now >= state.endsAt) return race.finish(next, now);
    return next;
  },

  finish(state, now) {
    const ranked = [...state.players].sort((a, b) => {
      if (a.finishedAt && b.finishedAt) return a.finishedAt - b.finishedAt;
      if (a.finishedAt) return -1;
      if (b.finishedAt) return 1;
      return b.pos - a.pos;
    });
    const results = ranked.map((p, i) => ({
      key: p.key, name: p.name, platform: p.platform, place: i + 1,
      reward: i === 0 ? race.reward : i === 1 ? Math.round(race.reward / 2) : i === 2 ? Math.round(race.reward / 4) : 0,
    }));
    return {
      ...state,
      phase: 'finished',
      players: ranked,
      results,
      finishedAt: now,
      message: results.length ? `🏆 ${results[0].name} wins!` : 'Nobody finished',
    };
  },
};
