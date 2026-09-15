/**
 * Pet rules — levels, food, feeding limits. Pure, so every rule is testable and
 * the overlay can compute the same numbers the bridge does.
 *
 * The loop in one sentence: show up, feed your pet up to three times, watch it
 * grow; the pet finds you a few coins for tomorrow.
 */

export const MEALS_PER_DAY = 3;
export const MAX_LEVEL_VISUAL = 50;

/** Each stage is the same drawing at different proportions, plus added groups. */
export const STAGES = [
  { stage: 1, from: 1, headScale: 1.15, bodyScale: 0.75, eyeScale: 1.3, groups: [] },
  { stage: 2, from: 10, headScale: 1.0, bodyScale: 1.0, eyeScale: 1.0, groups: ['features'] },
  { stage: 3, from: 25, headScale: 1.0, bodyScale: 1.05, eyeScale: 1.0, groups: ['features', 'flourish'] },
  { stage: 4, from: 50, headScale: 1.0, bodyScale: 1.05, eyeScale: 1.0, groups: ['features', 'flourish', 'aura'] },
];

export const FOODS = {
  kibble: { label: 'Kibble', emoji: '🥫', cost: 10, xp: 10 },
  apple: { label: 'Apple', emoji: '🍎', cost: 25, xp: 30 },
  fish: { label: 'Fish', emoji: '🐟', cost: 50, xp: 70 },
  cake: { label: 'Cake', emoji: '🍰', cost: 150, xp: 250 },
  carrot: { label: 'Golden Carrot', emoji: '🥕', cost: 500, xp: 1000, limitPerStream: 1 },
};
export const DEFAULT_FOOD = 'kibble';

/** Foraging: what a fed pet brings back, so turning up alone moves a number. */
export const FORAGE_BY_STAGE = { 1: 10, 2: 15, 3: 20, 4: 30 };

/** XP needed to go from `level` to the next one. */
export const xpForNext = (level) => 25 * Math.max(1, level);

/** Total XP to reach a level from scratch — used for progress bars and tests. */
export function totalXpFor(level) {
  let total = 0;
  for (let l = 1; l < level; l++) total += xpForNext(l);
  return total;
}

export function stageForLevel(level) {
  let found = STAGES[0];
  for (const s of STAGES) if (level >= s.from) found = s;
  return found;
}

/** Local calendar day. A "stream-day" is any day the stream went live. */
export function dayKey(at = Date.now()) {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function createPet({ id, species, name, colour = 'biscuit', now = Date.now() }) {
  return {
    id,
    species,
    name,
    colour,
    eyes: 'onyx',
    xp: 0,
    level: 1,
    accessories: {},
    bornAt: now,
    fedAt: null,
    fedDay: null,
    mealsToday: 0,
  };
}

/**
 * How many meals this pet has had today, resetting on a new stream-day.
 * @returns {{eaten: number, left: number, full: boolean}}
 */
export function mealsToday(pet, day = dayKey()) {
  const eaten = pet.fedDay === day ? pet.mealsToday || 0 : 0;
  return { eaten, left: Math.max(0, MEALS_PER_DAY - eaten), full: eaten >= MEALS_PER_DAY };
}

/** Stream-days since this pet was last fed. Used for the "missed you" mood. */
export function daysSinceFed(pet, day = dayKey()) {
  if (!pet.fedDay) return 0;
  const a = Date.parse(`${pet.fedDay}T00:00:00`);
  const b = Date.parse(`${day}T00:00:00`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86400000));
}

/** After a few missed days the pet droops — a mood, never a punishment. */
export const isMissingYou = (pet, day = dayKey()) => daysSinceFed(pet, day) >= 3;

/**
 * What one feed is worth, and why. Multipliers are returned so the card can
 * explain the number rather than just showing it.
 */
export function feedValue({ pet, food, species, streak = 0, day = dayKey() }) {
  const item = FOODS[food];
  if (!item) return null;
  const reasons = [];
  let multiplier = 1;

  if (mealsToday(pet, day).eaten === 0) {
    multiplier *= 2;
    reasons.push({ label: 'first feed today', factor: 2 });
  }
  if (species?.favourite === food) {
    multiplier *= 1.5;
    reasons.push({ label: `${species.label} loves ${item.label}`, factor: 1.5 });
  }
  // Coming back after a break is rewarded, never penalised.
  if (isMissingYou(pet, day)) {
    multiplier *= 3;
    reasons.push({ label: 'welcome back', factor: 3 });
  }
  const streakBonus = streak >= 10 ? 1.5 : streak >= 5 ? 1.25 : streak >= 3 ? 1.1 : 1;
  if (streakBonus > 1) {
    multiplier *= streakBonus;
    reasons.push({ label: `${streak}-stream streak`, factor: streakBonus });
  }

  return { xp: Math.round(item.xp * multiplier), multiplier, reasons, cost: item.cost, item };
}

/**
 * Apply XP and return what changed, so the caller can decide what to show.
 * @returns {{levels: number[], stagesCrossed: number[], level: number, stage: number}}
 */
export function gainXp(pet, xp) {
  const before = { level: pet.level, stage: stageForLevel(pet.level).stage };
  pet.xp += Math.max(0, Math.round(xp));

  const levels = [];
  // A big cake can cross more than one level at once.
  while (pet.xp >= xpForNext(pet.level)) {
    pet.xp -= xpForNext(pet.level);
    pet.level += 1;
    levels.push(pet.level);
  }

  const stage = stageForLevel(pet.level).stage;
  const stagesCrossed = [];
  for (let s = before.stage + 1; s <= stage; s++) stagesCrossed.push(s);
  return { levels, stagesCrossed, level: pet.level, stage };
}

/** Record the meal against today's allowance. */
export function markFed(pet, day = dayKey(), at = Date.now()) {
  pet.mealsToday = pet.fedDay === day ? (pet.mealsToday || 0) + 1 : 1;
  pet.fedDay = day;
  pet.fedAt = at;
  return pet;
}

export function forageFor(pet, species) {
  const base = FORAGE_BY_STAGE[stageForLevel(pet.level).stage] || 10;
  return Math.round(base * (species?.forageBonus || 1));
}

/** Progress within the current level, for the XP bar. */
export function levelProgress(pet) {
  const need = xpForNext(pet.level);
  return { xp: pet.xp, need, pct: Math.max(0, Math.min(100, (pet.xp / need) * 100)) };
}
