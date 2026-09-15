/**
 * The profile model — pure, and shared between the bridge and the overlay.
 *
 * A profile belongs to a viewer *on one platform*: the same name on Twitch and
 * Kick is two people, which is usually true and always cheaper than building
 * account linking (OAuth on both sides, and a maintenance sink forever).
 */

export const STARTING_COINS = 100;

/** The twelve coats. Pets and crests share them, which is what makes a card look like one design. */
export const PALETTE = {
  biscuit: '#D9A066', charcoal: '#4A4A55', snow: '#F2F0EA', rust: '#C1583A',
  moss: '#7A9B57', lagoon: '#3E9BB0', plum: '#7D5BA6', bubblegum: '#E98BB4',
  honey: '#E8C15A', slate: '#6C7A89', cocoa: '#6B4A35', mint: '#8FD3B6',
};
export const COAT_NAMES = Object.keys(PALETTE);

export const CREST_SHAPES = ['circle', 'squircle', 'hexagon', 'shield', 'diamond', 'blob'];
export const CREST_PATTERNS = ['solid', 'stripes', 'dots', 'rays', 'checker'];
export const CREST_EMBLEMS = [
  'star', 'bolt', 'leaf', 'moon', 'sun', 'flame', 'snowflake', 'heart',
  'diamond', 'skull', 'crown', 'sword', 'shield', 'arrow', 'note', 'headphones',
  'controller', 'coffee', 'paw', 'planet', 'rocket', 'dice', 'anchor', 'clover',
];

/** Stable 32-bit hash. Same input always gives the same crest, on any machine. */
export function hashKey(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Everyone has a crest before they do anything, derived from who they are — so
 * the very first card already looks personal rather than blank.
 */
export function defaultCrest(key) {
  const h = hashKey(key);
  const pick = (list, shift) => list[(h >>> shift) % list.length];
  const primary = pick(COAT_NAMES, 0);
  let secondary = pick(COAT_NAMES, 12);
  // Never derive a crest that is one colour on itself.
  if (secondary === primary) secondary = COAT_NAMES[(COAT_NAMES.indexOf(primary) + 5) % COAT_NAMES.length];
  return {
    shape: pick(CREST_SHAPES, 4),
    pattern: pick(CREST_PATTERNS, 8),
    emblem: pick(CREST_EMBLEMS, 16),
    primary,
    secondary,
  };
}

export function profileKey(platform, name) {
  return `${platform}:${String(name || '').toLowerCase()}`;
}

export function createProfile({ key, name, platform, now = Date.now() }) {
  return {
    name,
    platform,
    coins: STARTING_COINS,
    crest: defaultCrest(key),
    pets: [],
    activePet: null,
    inventory: [],
    stats: { played: 0, wins: 0, fed: 0, streak: 0, lastFedDay: null },
    joinedAt: now,
    lastSeen: now,
  };
}

/** Bring an older record up to the current shape without losing anything. */
export function upgradeProfile(key, raw, now = Date.now()) {
  const p = { ...createProfile({ key, name: raw.name, platform: raw.platform, now }), ...raw };
  p.coins = Math.max(0, Number(raw.coins ?? raw.points ?? STARTING_COINS) || 0);
  p.crest = raw.crest || defaultCrest(key);
  p.pets = Array.isArray(raw.pets) ? raw.pets : [];
  p.inventory = Array.isArray(raw.inventory) ? raw.inventory : [];
  p.stats = {
    played: 0, wins: 0, fed: 0, streak: 0, lastFedDay: null,
    // A flat pre-profile ledger kept wins/played at the top level.
    ...(Number.isFinite(raw.played) ? { played: raw.played } : {}),
    ...(Number.isFinite(raw.wins) ? { wins: raw.wins } : {}),
    ...(raw.stats || {}),
  };
  delete p.points;
  delete p.played;
  delete p.wins;
  return p;
}

/** Coins can never go negative — losing a heist you can't cover floors at zero. */
export function addCoins(profile, amount) {
  profile.coins = Math.max(0, Math.round(profile.coins + (Number(amount) || 0)));
  return profile.coins;
}

export function canAfford(profile, cost) {
  return profile.coins >= Math.max(0, Math.round(cost));
}

/** @returns {boolean} whether the purchase went through. */
export function spend(profile, cost) {
  const price = Math.max(0, Math.round(cost));
  if (!canAfford(profile, price)) return false;
  profile.coins -= price;
  return true;
}

export function formatCoins(n) {
  const v = Math.round(Number(n) || 0);
  return v >= 10000 ? `${(v / 1000).toFixed(1)}k` : v.toLocaleString();
}
