/**
 * The shop, wired to storage. The rules live in shared/pets/wardrobe.js so they
 * can be tested without a disk; this layer only saves and phrases things.
 */
import {
  buy, wear, takeOff, setCoat, setEyes, shopPage, catalogue, shelves,
  grantEarned, itemById, owns, isShinyId, coatOfShiny, SHINY_PRICE,
} from './shared/pets/wardrobe.js';
import { ACCESSORIES } from './shared/pets/accessories.js';
import { COAT_NAMES } from './shared/profiles.js';

export function createWardrobe({ profiles, pets, log }) {
  /** Save only when something actually changed. */
  function commit(result) {
    if (result.ok) profiles.touch();
    return result;
  }

  return {
    catalogue,
    itemById,
    owns,

    shop(profile, { slot, page } = {}) {
      return shopPage(profile, { slot, page });
    },

    /** What there is to browse — the answer to a bare !shop. */
    shelves(profile) {
      return shelves(profile);
    },

    buy(profile, id) {
      return commit(buy(profile, normalise(id)));
    },

    wear(profile, id) {
      return commit(wear(profile, pets.activePetOf(profile), normalise(id)));
    },

    takeOff(profile, slot) {
      return commit(takeOff(profile, pets.activePetOf(profile), String(slot || '').toLowerCase()));
    },

    /** `!coat moss shiny` — the word "shiny" is the only modifier. */
    coat(profile, args) {
      const words = String(args || '').toLowerCase().split(/\s+/).filter(Boolean);
      const shiny = words.includes('shiny');
      const name = words.find((w) => w !== 'shiny');
      return commit(setCoat(profile, pets.activePetOf(profile), name, { shiny }));
    },

    eyes(profile, args) {
      return commit(setEyes(profile, pets.activePetOf(profile), String(args || '').trim().split(/\s+/)[0]));
    },

    /**
     * Called after a game settles: anything earned is handed over immediately,
     * because an item you have to claim is an item you never find out about.
     */
    claimEarned(profile) {
      const granted = grantEarned(profile);
      if (granted.length) {
        profiles.touch();
        log?.info(`${profile.name} earned ${granted.map((i) => i.label).join(', ')}`);
      }
      return granted;
    },

    /** What a profile owns, grouped for a card. */
    wardrobeOf(profile) {
      const worn = pets.activePetOf(profile)?.accessories || {};
      return (profile.inventory || []).map((id) => {
        const item = itemById(id);
        return item && {
          id, label: item.label, slot: item.slot, rarity: item.rarity,
          worn: worn[item.slot] === id,
        };
      }).filter(Boolean);
    },
  };
}

/** Accept "Party Hat", "party hat" or "partyhat" — viewers type what they see. */
function normalise(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  const lower = raw.toLowerCase();
  if (ACCESSORIES[lower] || isShinyId(lower)) return lower;
  const squashed = lower.replace(/[\s_-]+/g, '');
  if (ACCESSORIES[squashed]) return squashed;
  const byLabel = Object.values(ACCESSORIES).find((i) => i.label.toLowerCase() === lower);
  if (byLabel) return byLabel.id;
  // "shiny moss" and "moss shiny" both mean the shiny coat.
  const words = lower.split(/\s+/);
  if (words.includes('shiny')) {
    const coat = words.find((w) => COAT_NAMES.includes(w));
    if (coat) return `shiny:${coat}`;
  }
  return squashed;
}

export { SHINY_PRICE, coatOfShiny };
