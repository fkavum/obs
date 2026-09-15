/**
 * The toast queue: which cards reach the stream, and which quietly don't.
 *
 * There is exactly ONE slot. A pet game on a busy channel can produce a card a
 * second, and a stack of them covering the stream is how a fun feature gets
 * turned off on day one. So:
 *
 *  - quiet mode (on by default) shows only the moments that matter,
 *  - the same person can't take the slot twice inside a minute,
 *  - past five waiting, the rest collapse into one line: "...and 12 others fed
 *    their pets" — the channel still feels busy without the screen filling up,
 *  - and a level-up, an evolution or a hatching always gets through, because
 *    those are the moments the whole thing is for.
 *
 * Pure and clock-driven: pass `now` in, so this is testable without waiting.
 */

export const DEFAULTS = {
  depth: 5,
  cooldownMs: 60000,
  holdMs: 6000,
  evolveMs: 6000,
  quiet: true,
};

/** Cards that always get through, whatever the mode or the cooldown. */
const ALWAYS = new Set(['evolved', 'levelled', 'hatched', 'earned']);

/** What the collapsed line says, per kind of card. */
const COLLAPSE_VERB = {
  fed: 'fed their pets',
  bought: 'went shopping',
  dressed: 'dressed up',
  avatar: 'changed their avatar',
  coins: 'checked their coins',
  default: 'joined in',
};

const eventOf = (card) => card?.event || card?.kind || 'default';
const isAlways = (card) => ALWAYS.has(eventOf(card));
const ownerOf = (card) => card?.owner || card?.name || card?.profile?.name || '';

export function createToastQueue(options = {}) {
  const config = { ...DEFAULTS, ...options };
  const pending = [];
  const lastShown = new Map();
  let current = null;
  let collapsed = new Map();

  function admit(card, now) {
    if (isAlways(card)) return true;
    if (config.quiet) return false;
    const owner = ownerOf(card).toLowerCase();
    // `|| -Infinity` would be wrong here: a card shown at timestamp 0 is a
    // real time, and `0 ||` throws the cooldown away.
    if (owner && lastShown.has(owner) && now - lastShown.get(owner) < config.cooldownMs) return false;
    return true;
  }

  return {
    config,

    /** @returns {'shown'|'queued'|'collapsed'|'dropped'} what became of it. */
    offer(card, now = Date.now()) {
      if (!card) return 'dropped';
      if (!admit(card, now)) return 'dropped';

      const entry = { card, at: now, always: isAlways(card) };
      if (pending.length >= config.depth) {
        // The queue is full. Rather than drop these on the floor, count them —
        // except the ones that always matter, which push in at the front.
        if (!entry.always) {
          const verb = COLLAPSE_VERB[eventOf(card)] || COLLAPSE_VERB.default;
          collapsed.set(verb, (collapsed.get(verb) || 0) + 1);
          return 'collapsed';
        }
        pending.splice(lastAlwaysIndex(pending) + 1, 0, entry);
        return 'queued';
      }

      if (entry.always) pending.splice(lastAlwaysIndex(pending) + 1, 0, entry);
      else pending.push(entry);
      return 'queued';
    },

    /**
     * Advance the clock. Returns the card that should be on screen, or null.
     * Call it often; it only changes anything when a hold expires.
     */
    tick(now = Date.now()) {
      if (current && now >= current.until) current = null;
      if (current) return current;

      const next = pending.shift();
      if (next) {
        const owner = ownerOf(next.card).toLowerCase();
        if (owner) lastShown.set(owner, now);
        // An evolution is the payoff for weeks of feeding; it gets its own hold.
        const hold = eventOf(next.card) === 'evolved' ? config.evolveMs : config.holdMs;
        current = { card: next.card, until: now + hold, at: now };
        return current;
      }

      // Nothing waiting: if people were collapsed away, say so once, then clear.
      if (collapsed.size) {
        const card = collapsedCard(collapsed);
        collapsed = new Map();
        current = { card, until: now + config.holdMs, at: now };
        return current;
      }
      return null;
    },

    /** How much is waiting — for tests, and for the panel to show. */
    depth() {
      return { pending: pending.length, collapsed: [...collapsed.values()].reduce((a, b) => a + b, 0) };
    },

    /** Forget everything. Used when the streamer turns the overlay off. */
    clear() {
      pending.length = 0;
      collapsed = new Map();
      current = null;
      lastShown.clear();
    },
  };
}

/** Keep always-cards in arrival order, ahead of ordinary ones. */
function lastAlwaysIndex(queue) {
  let i = -1;
  for (let n = 0; n < queue.length; n++) if (queue[n].always) i = n;
  return i;
}

function collapsedCard(counts) {
  const parts = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const total = parts.reduce((sum, [, n]) => sum + n, 0);
  const verb = parts[0][0];
  return {
    kind: 'collapsed',
    total,
    // "...and 12 others fed their pets" — one line for a whole burst.
    text: `…and ${total} other${total === 1 ? '' : 's'} ${verb}`,
  };
}
