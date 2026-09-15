/**
 * Runs chat games.
 *
 * The games themselves are pure; this part watches the event stream, ticks the
 * simulation, broadcasts state to the overlay, and keeps the points ledger.
 *
 * Deliberately read-only: a game never needs to SEND a message, so unlike the
 * chatbot these work with no account connected at all - which is also why the
 * crew can be pooled across Twitch, Kick and YouTube at once.
 */
import { EventEmitter } from 'node:events';
import { createLogger } from '#core/index.js';
import { GAMES, makeRandom, matchesCommand, playerKey } from '#core/games/index.js';
import { loadData, saveData } from './store.js';

const log = createLogger('games');
const TICK_MS = 250;
// Everyone starts with something, or the heist is unplayable on day one: you
// need points to stake, and points only come from playing.
const STARTING_POINTS = 100;

export class GameService extends EventEmitter {
  constructor({ config, hub }) {
    super();
    this.config = config;
    this.hub = hub;
    this.state = null;      // the running game, or null
    this.random = makeRandom();
    this.timer = null;
    this.points = loadData(config, 'points', {}) || {};
    this.onEvent = (event) => this.#handleChat(event);
  }

  start() {
    this.hub.on('event', this.onEvent);
    this.timer = setInterval(() => this.#tick(), TICK_MS);
    this.timer.unref?.();
  }

  stop() {
    this.hub.off('event', this.onEvent);
    clearInterval(this.timer);
  }

  // ---------------------------------------------------------------- points

  balanceOf(key) {
    return this.points[key]?.points ?? STARTING_POINTS;
  }

  /** First time we see someone, open an account for them. */
  ensurePlayer(key, name, platform) {
    if (!this.points[key]) {
      this.points[key] = { name, platform, points: STARTING_POINTS, wins: 0, played: 0 };
    }
    return this.points[key];
  }

  /** Records the player even when they earned nothing - turning up still counts. */
  #award(key, name, platform, amount) {
    const entry = this.points[key] || { name, platform, points: 0, wins: 0, played: 0 };
    entry.name = name;
    entry.platform = platform;
    entry.points = Math.max(0, entry.points + (amount || 0));
    this.points[key] = entry;
    return entry;
  }

  /** Top of the leaderboard, for the overlay and the setup page. */
  leaderboard(limit = 10) {
    return Object.entries(this.points)
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.points - a.points)
      .slice(0, limit);
  }

  // ---------------------------------------------------------------- games

  begin(gameId, options = {}) {
    const game = GAMES[gameId];
    if (!game) throw new Error(`unknown game: ${gameId}`);
    if (this.state && this.state.phase !== 'finished') throw new Error('a game is already running');

    this.random = makeRandom(options.seed);
    this.state = game.create({ now: Date.now(), random: this.random, settings: options, seed: options.seed });
    log.info(`${game.label} started`);
    this.#broadcast();
    return this.state;
  }

  cancel() {
    if (!this.state) return null;
    this.state = { ...this.state, phase: 'finished', message: 'Game cancelled', results: [], abandoned: true };
    this.#broadcast();
    return this.state;
  }

  status() {
    return {
      running: !!this.state && this.state.phase !== 'finished',
      state: this.state,
      games: Object.values(GAMES).map((g) => ({
        id: g.id, label: g.label, emoji: g.emoji, joinCommand: g.joinCommand, joinWindowSec: g.joinWindowSec,
      })),
      leaderboard: this.leaderboard(),
    };
  }

  #handleChat(event) {
    if (event.type !== 'chat' || !this.state || this.state.phase === 'finished') return;
    const game = GAMES[this.state.id];
    if (!matchesCommand(event.data?.text, game.joinCommand)) return;

    const before = this.state;
    this.ensurePlayer(playerKey(event), event.user?.displayName || event.user?.name || 'someone', event.platform);
    // Each game takes what it needs: the boss needs randomness per hit, the
    // heist needs to know what the player can afford.
    if (game.id === 'boss') this.state = game.join(this.state, event, this.random, Date.now());
    else if (game.id === 'heist') this.state = game.join(this.state, event, (key) => this.balanceOf(key));
    else this.state = game.join(this.state, event);

    if (this.state !== before) {
      if (this.state.phase === 'finished') this.settle();
      this.#broadcast();
    }
  }

  #tick() {
    if (!this.state || this.state.phase === 'finished') return;
    const game = GAMES[this.state.id];
    const now = Date.now();
    const before = this.state;

    if (this.state.phase === 'joining' && now >= this.state.joinEndsAt) {
      this.state = game.start(this.state, now, this.random);
    } else if (this.state.phase === 'running' && game.advance) {
      this.state = game.advance(this.state, this.random, now);
    }

    if (this.state === before) return;
    if (this.state.phase === 'finished') this.settle();
    this.#broadcast();
  }

  /** Pay out once, when a game ends. Safe to call twice; the second is a no-op. */
  settle() {
    if (this.state.settled) return;
    for (const result of this.state.results || []) {
      const entry = this.#award(result.key, result.name, result.platform, result.reward || 0);
      entry.played = (entry.played || 0) + 1;
      if (result.place === 1 || result.survived === true) entry.wins = (entry.wins || 0) + 1;
    }
    this.state.settled = true;
    saveData(this.config, 'points', this.points);
    log.info(this.state.message);
  }

  #broadcast() {
    this.emit('change', { ...this.state, leaderboard: this.leaderboard(5) });
  }
}
