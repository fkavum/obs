/**
 * Shared machinery for chat games.
 *
 * The point of these games here, rather than in any of the existing bots: the
 * crew is pooled from EVERY platform at once. A Twitch viewer and a Kick viewer
 * race each other. Nothing native to a platform can do that.
 *
 * Everything is pure and takes its randomness as an argument, so a whole game
 * can be replayed deterministically in a test.
 */

export const PHASES = ['idle', 'joining', 'running', 'finished'];

/** A player's identity is per-platform: the same name on Twitch and Kick is two people. */
export const playerKey = (event) => `${event.platform}:${(event.user?.name || event.user?.displayName || '').toLowerCase()}`;

export function playerFrom(event) {
  return {
    key: playerKey(event),
    name: event.user?.displayName || event.user?.name || 'someone',
    platform: event.platform,
    color: event.user?.color || null,
  };
}

/** Seeded, so a test can replay an identical game. */
export function makeRandom(seed = Date.now()) {
  let state = seed >>> 0 || 1;
  return () => {
    // xorshift32 - small, fast, good enough for deciding who wins a race.
    state ^= state << 13; state >>>= 0;
    state ^= state >> 17;
    state ^= state << 5; state >>>= 0;
    return state / 0x100000000;
  };
}

export const pick = (random, list) => list[Math.floor(random() * list.length)] ?? list[0];
export const between = (random, min, max) => min + random() * (max - min);
export const roll = (random, chance) => random() < chance;

/** Base state every game starts from. */
export function baseState(game, { now = Date.now(), seed, settings = {} } = {}) {
  return {
    id: game.id,
    phase: 'joining',
    players: [],
    startedAt: now,
    joinEndsAt: now + (settings.joinWindowSec ?? game.joinWindowSec) * 1000,
    endsAt: null,
    seed: seed ?? Math.floor(Math.random() * 2 ** 31),
    message: game.joinPrompt,
    results: null,
  };
}

/** True when this chat message is the game's join/action command. */
export function matchesCommand(text, command) {
  const trimmed = String(text || '').trim().toLowerCase();
  return trimmed === command || trimmed.startsWith(`${command} `);
}

export function commandArgs(text, command) {
  const trimmed = String(text || '').trim();
  return trimmed.slice(command.length).trim();
}

/** Nobody turned up: end it without pretending a game happened. */
export function abandon(state, reason = 'Not enough players — maybe next time') {
  return { ...state, phase: 'finished', message: reason, results: [], abandoned: true };
}
