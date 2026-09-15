/**
 * Heist - chat puts points on the table and robs somewhere together. The more
 * people join, the better everyone's odds, which turns it into chat talking each
 * other into joining. That pressure is the whole game.
 */
import { baseState, playerFrom, playerKey, commandArgs, roll, pick } from './engine.js';

const TARGETS = [
  { name: 'the Sub-Only Vault', emoji: '🏦' },
  { name: 'the Emote Factory', emoji: '🏭' },
  { name: 'Mod Headquarters', emoji: '🚔' },
  { name: 'the Donation Goal', emoji: '💰' },
  { name: 'the Bit Mine', emoji: '⛏️' },
];

const BASE_CHANCE = 0.34;
const PER_MEMBER = 0.03;
const MAX_CHANCE = 0.82;

export const heist = {
  id: 'heist',
  label: 'Heist',
  emoji: '💰',
  joinCommand: '!heist',
  joinWindowSec: 60,
  minPlayers: 2,
  minWager: 10,
  maxWager: 500,
  joinPrompt: 'Type !heist <amount> to join the crew!',

  create(options = {}) {
    const state = baseState(heist, options);
    const target = options.random ? pick(options.random, TARGETS) : TARGETS[Math.floor(Math.random() * TARGETS.length)];
    return { ...state, target, pot: 0 };
  },

  /**
   * @param {(key: string) => number} balanceOf how many points this viewer has
   */
  join(state, event, balanceOf) {
    if (state.phase !== 'joining') return state;
    const key = playerKey(event);
    if (state.players.some((p) => p.key === key)) return state;

    const balance = Math.max(0, Math.floor(balanceOf(key)));
    const raw = commandArgs(event.data?.text, heist.joinCommand).toLowerCase();
    let wager = raw === 'all' || raw === 'allin' ? balance : Math.floor(Number(raw));
    if (!Number.isFinite(wager) || wager <= 0) wager = heist.minWager;
    wager = Math.min(heist.maxWager, Math.max(heist.minWager, wager), balance);

    if (wager < heist.minWager) return state; // can't afford the minimum
    return {
      ...state,
      players: [...state.players, { ...playerFrom(event), wager, survived: null }],
      pot: state.pot + wager,
    };
  },

  /** Odds improve with crew size - which is what makes chat recruit each other. */
  successChance(crewSize) {
    return Math.min(MAX_CHANCE, BASE_CHANCE + Math.max(0, crewSize - 1) * PER_MEMBER);
  },

  start(state, now, random) {
    if (state.players.length < heist.minPlayers) {
      return { ...state, phase: 'finished', message: 'The crew was too small — heist called off. Everyone keeps their points.', results: [], abandoned: true };
    }
    const chance = heist.successChance(state.players.length);
    const players = state.players.map((p) => ({ ...p, survived: roll(random, chance) }));
    return heist.finish({ ...state, players, chance, phase: 'running' }, now);
  },

  finish(state, now) {
    const results = state.players.map((p) => ({
      key: p.key, name: p.name, platform: p.platform, wager: p.wager, survived: p.survived,
      // Survivors double their stake; the caught lose what they put in.
      reward: p.survived ? p.wager : -p.wager,
    }));
    const survivors = results.filter((r) => r.survived);
    const haul = survivors.reduce((sum, r) => sum + r.wager * 2, 0);
    return {
      ...state,
      phase: 'finished',
      results,
      finishedAt: now,
      survivors: survivors.length,
      haul,
      message: survivors.length === 0
        ? `🚨 The whole crew got caught at ${state.target.name}!`
        : survivors.length === results.length
          ? `💰 Clean getaway! The entire crew escaped ${state.target.name}`
          : `🏃 ${survivors.length} of ${results.length} escaped ${state.target.name}`,
    };
  },
};
