/**
 * Chat commands the Game Center answers.
 *
 * Two routes for a reply, in this order: a card on the overlay (works for
 * everyone, always), and a one-line chat reply (only when a platform is signed
 * in). Nothing here may *depend* on the chat reply — most viewers will be on a
 * channel where the bot can't talk.
 */
import { formatCoins } from './shared/profiles.js';

const COOLDOWN_MS = 30000;

export function createCommands({ profiles, games, hub, log }) {
  const lastUse = new Map();

  function onCooldown(key, command, now) {
    const id = `${command}:${key}`;
    const last = lastUse.get(id) || 0;
    if (now - last < COOLDOWN_MS) return true;
    lastUse.set(id, now);
    // A long stream would otherwise grow this map without bound.
    if (lastUse.size > 500) {
      for (const [k, t] of lastUse) if (now - t > COOLDOWN_MS * 4) lastUse.delete(k);
    }
    return false;
  }

  /** Card first, chat reply if it happens to be possible. */
  function reply(event, card, text) {
    hub.broadcast?.({ type: 'gc:card', card });
    if (text) hub.say?.(event.platform, text).catch(() => {});
  }

  return {
    /** @returns {boolean} whether this message was a Game Center command. */
    handle(event) {
      if (event.type !== 'chat') return false;
      const text = String(event.data?.text || '').trim();
      if (!text.startsWith('!')) return false;
      const [word, ...rest] = text.split(/\s+/);
      const command = word.toLowerCase();
      const args = rest.join(' ');
      const now = Date.now();

      if (command === '!coins' || command === '!balance') {
        const profile = profiles.ensure(event.platform, event.user?.displayName || event.user?.name);
        const key = `${event.platform}:${(event.user?.name || '').toLowerCase()}`;
        if (onCooldown(key, command, now)) return true;
        const rank = profiles.rankOf(key);
        reply(event,
          { kind: 'coins', name: profile.name, platform: profile.platform, crest: profile.crest, coins: profile.coins, rank },
          `${profile.name}: ${formatCoins(profile.coins)} coins${rank ? ` (#${rank.place} of ${rank.of})` : ''}`);
        return true;
      }

      if (command === '!top') {
        const key = `${event.platform}:${(event.user?.name || '').toLowerCase()}`;
        if (onCooldown(key, command, now)) return true;
        const board = profiles.leaderboard(5);
        reply(event,
          { kind: 'leaderboard', entries: board },
          board.length ? `Top: ${board.map((p, i) => `${i + 1}. ${p.name} ${formatCoins(p.coins)}`).join(' · ')}` : 'Nobody has any coins yet!');
        return true;
      }

      if (command === '!gchelp') {
        reply(event, { kind: 'help' }, 'Games: !race !attack !heist · Coins: !coins !top');
        return true;
      }

      return false;
    },

    /** Exposed so a test can drive the clock rather than wait. */
    _cooldowns: lastUse,
  };
}
