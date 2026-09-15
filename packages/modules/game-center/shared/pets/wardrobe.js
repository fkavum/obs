/**
 * The shop and wardrobe — pure functions over a profile.
 *
 * Rules that shape this:
 *  - Items are owned by the *viewer*, not the pet. Buying a crown twice because
 *    you adopted a second pet feels like a bug to the person paying.
 *  - Coats and eye colours are free. They're how someone makes a creature theirs
 *    in their first minute; charging for that is the wrong toll booth. The paid
 *    cosmetic tier is shiny coats and accessories.
 *  - Legendary items are never for sale. They're proof you did something.
 */
import { ACCESSORIES, ACCESSORY_LIST, RARITY, SLOTS, SLOT_LABELS, priceOf } from './accessories.js';
import { COAT_NAMES, PALETTE, canAfford, spend } from '../profiles.js';
import { EYE_COLOURS } from './colours.js';

export const SHINY_PRICE = 1500;
export const SHINY_PREFIX = 'shiny:';
export { SLOTS, SLOT_LABELS, RARITY };

export const EYE_NAMES = Object.keys(EYE_COLOURS);

/**
 * The shelves, in the order a viewer should meet them: a hat first because it's
 * the cheapest visible change, coats last because they're the priciest.
 *
 * Coats are a shelf here even though they aren't an accessory slot — from the
 * shopper's side "what can I browse" and "what can my pet wear" are the same
 * question, and leaving coats out of this list is why `!shop coat` used to
 * silently show hats instead.
 */
export const SHELVES = [...SLOTS, 'coat'];

export const SHELF_LABELS = { ...SLOT_LABELS, coat: 'Coats' };

/** One line each, so the shelf list says what's actually on the shelf. */
export const SHELF_BLURBS = {
  hat: 'crowns, beanies, wizard hats',
  face: 'glasses, shades, an eyepatch',
  neck: 'scarves, bow ties, gold chains',
  back: 'capes and wings (stage 3 and up)',
  paw: 'things to hold — balloons, swords, coffee',
  coat: 'shiny versions of the twelve colours',
};

/**
 * What people actually type. Nobody browsing a shop thinks in slot names, so
 * "hats", "head", "glasses" and "eyes" all have to land somewhere sensible —
 * an unrecognised word here means a viewer who tried once and gave up.
 */
export const SHELF_WORDS = {
  hat: ['hat', 'hats', 'head', 'cap', 'caps', 'crown', 'crowns', 'helmet'],
  face: ['face', 'faces', 'eyes', 'eye', 'glasses', 'shades', 'sunglasses', 'mask'],
  neck: ['neck', 'necks', 'collar', 'collars', 'scarf', 'scarves', 'tie', 'chain'],
  back: ['back', 'backs', 'wing', 'wings', 'cape', 'capes', 'bag', 'backpack'],
  paw: ['paw', 'paws', 'held', 'hold', 'hand', 'hands', 'item', 'items', 'toy', 'toys'],
  coat: ['coat', 'coats', 'colour', 'colours', 'color', 'colors', 'shiny', 'skin', 'skins', 'fur'],
};

const WORD_TO_SHELF = new Map(
  Object.entries(SHELF_WORDS).flatMap(([shelf, words]) => words.map((w) => [w, shelf])),
);

/** @returns {string|null} the shelf a word means, or null if it means nothing. */
export function resolveShelf(word) {
  const key = String(word || '').trim().toLowerCase();
  if (!key) return null;
  return WORD_TO_SHELF.get(key) || (SHELVES.includes(key) ? key : null);
}

/**
 * The shelf list: what there is to browse, how much of it this viewer already
 * owns, and the cheapest thing on each shelf. This is what `!shop` on its own
 * answers — showing one shelf and leaving the other five undiscovered is how a
 * shop with 43 things in it reads as a shop with 10.
 */
export function shelves(profile) {
  const all = catalogue();
  return SHELVES.map((slot) => {
    const items = all.filter((i) => i.slot === slot);
    const prices = items.map((i) => i.price).filter((p) => p != null);
    const ownedCount = items.filter((i) => owns(profile, i.id)).length;
    return {
      slot,
      label: SHELF_LABELS[slot],
      blurb: SHELF_BLURBS[slot],
      count: items.length,
      owned: ownedCount,
      from: prices.length ? Math.min(...prices) : null,
      to: prices.length ? Math.max(...prices) : null,
      affordable: prices.some((p) => canAfford(profile, p)),
    };
  });
}

export const shinyId = (coat) => `${SHINY_PREFIX}${coat}`;
export const isShinyId = (id) => String(id).startsWith(SHINY_PREFIX);
export const coatOfShiny = (id) => String(id).slice(SHINY_PREFIX.length);

/** Everything buyable or earnable, in one list the shop board can render. */
export function catalogue() {
  const items = ACCESSORY_LIST.map((item) => ({
    id: item.id,
    label: item.label,
    slot: item.slot,
    rarity: item.rarity,
    price: priceOf(item),
    earnedBy: item.earnedBy || null,
  }));
  const shinies = COAT_NAMES.map((coat) => ({
    id: shinyId(coat),
    label: `Shiny ${coat[0].toUpperCase()}${coat.slice(1)}`,
    slot: 'coat',
    rarity: 'epic',
    price: SHINY_PRICE,
    earnedBy: null,
    swatch: PALETTE[coat],
  }));
  return [...items, ...shinies];
}

export function itemById(id) {
  if (isShinyId(id)) {
    const coat = coatOfShiny(id);
    return COAT_NAMES.includes(coat)
      ? { id, label: `Shiny ${coat}`, slot: 'coat', rarity: 'epic', coat }
      : null;
  }
  return ACCESSORIES[id] || null;
}

export function owns(profile, id) {
  return (profile.inventory || []).includes(id);
}

/** Has this viewer met an item's earn condition? */
export function earnProgress(profile, item) {
  if (!item?.earnedBy) return null;
  const have = profile.stats?.[item.earnedBy.stat] || 0;
  return { have, need: item.earnedBy.need, how: item.earnedBy.label, earned: have >= item.earnedBy.need };
}

const no = (message) => ({ ok: false, message });

/**
 * Buy an item. Earned items can't be bought at any price — they're granted by
 * {@link grantEarned} the moment the condition is met.
 */
export function buy(profile, id) {
  const item = itemById(id);
  if (!item) return no(`there's nothing called "${id}" in the shop — try !shop`);
  if (owns(profile, item.id)) return no(`you already own the ${item.label} — wear it with !wear ${item.id}`);
  if (item.earnedBy) {
    const p = earnProgress(profile, item);
    return no(`the ${item.label} isn't for sale — ${item.earnedBy.label} (${p.have}/${p.need})`);
  }
  const price = isShinyId(item.id) ? SHINY_PRICE : priceOf(item);
  if (!canAfford(profile, price)) {
    return no(`the ${item.label} costs ${price} coins and you have ${profile.coins}`);
  }
  spend(profile, price);
  profile.inventory.push(item.id);
  return { ok: true, item, price, message: `bought the ${item.label} for ${price} coins` };
}

/** Grant anything whose condition is now met. Returns what was newly granted. */
export function grantEarned(profile) {
  const granted = [];
  for (const item of ACCESSORY_LIST) {
    if (!item.earnedBy || owns(profile, item.id)) continue;
    if (earnProgress(profile, item).earned) {
      profile.inventory.push(item.id);
      granted.push(item);
    }
  }
  return granted;
}

/** Put an owned item on the given pet. An item replaces whatever shares its slot. */
export function wear(profile, pet, id) {
  const item = itemById(id);
  if (!item) return no(`there's nothing called "${id}" — try !shop`);
  if (item.slot === 'coat') return no(`${item.label} is a coat — use !coat ${coatOfShiny(item.id)} shiny`);
  if (!owns(profile, item.id)) return no(`you don't own the ${item.label} yet — !buy ${item.id}`);
  if (!pet) return no('you have no pet to dress — adopt one with !adopt');
  pet.accessories = { ...(pet.accessories || {}), [item.slot]: item.id };
  const note = item.slot === 'back' && (pet.level || 1) < 25
    ? ` — it'll show once ${pet.name} reaches stage 3`
    : '';
  return { ok: true, item, message: `${pet.name} is wearing the ${item.label}${note}` };
}

export function takeOff(profile, pet, slot) {
  if (!SLOTS.includes(slot)) return no(`slots are: ${SLOTS.join(', ')}`);
  if (!pet) return no('you have no pet — adopt one with !adopt');
  if (!pet.accessories?.[slot]) return no(`nothing is on ${pet.name}'s ${SLOT_LABELS[slot].toLowerCase()} slot`);
  const was = itemById(pet.accessories[slot]);
  const rest = { ...pet.accessories };
  delete rest[slot];
  pet.accessories = rest;
  return { ok: true, message: `took off ${pet.name}'s ${was?.label || slot}` };
}

export function setCoat(profile, pet, coat, { shiny = false } = {}) {
  const name = String(coat || '').toLowerCase();
  if (!COAT_NAMES.includes(name)) return no(`coats are: ${COAT_NAMES.join(', ')}`);
  if (!pet) return no('you have no pet — adopt one with !adopt');
  if (shiny && !owns(profile, shinyId(name))) {
    return no(`you don't own Shiny ${name} — !buy ${shinyId(name)} (${SHINY_PRICE} coins)`);
  }
  pet.colour = name;
  pet.shiny = !!shiny;
  return { ok: true, message: `${pet.name} is now ${shiny ? 'shiny ' : ''}${name}` };
}

export function setEyes(profile, pet, eyes) {
  const name = String(eyes || '').toLowerCase();
  if (!EYE_NAMES.includes(name)) return no(`eye colours are: ${EYE_NAMES.join(', ')}`);
  if (!pet) return no('you have no pet — adopt one with !adopt');
  pet.eyes = name;
  return { ok: true, message: `${pet.name} has ${name} eyes` };
}

/**
 * What the shop board shows: one slot at a time, affordable first, with what
 * the viewer already owns marked. Deliberately not everything at once — the
 * board is on stream and must not scroll.
 */
export function shopPage(profile, { slot = 'hat', page = 0, perPage = 8 } = {}) {
  const all = catalogue().filter((i) => i.slot === slot);
  const withState = all.map((i) => ({
    ...i,
    owned: owns(profile, i.id),
    affordable: i.price != null && canAfford(profile, i.price),
    progress: i.earnedBy ? earnProgress(profile, { earnedBy: i.earnedBy }) : null,
  }));
  const pages = Math.max(1, Math.ceil(withState.length / perPage));
  const at = ((page % pages) + pages) % pages;
  return { slot, page: at, pages, items: withState.slice(at * perPage, at * perPage + perPage) };
}
