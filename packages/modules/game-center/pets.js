/**
 * Adopting, feeding and evolving.
 *
 * All the arithmetic lives in shared/pets/model.js; this decides what a viewer
 * is allowed to do and what the card should say about it.
 */
import { SPECIES, STARTER_SPECIES } from './shared/pets/species.js';
import {
  createPet, feedValue, gainXp, markFed, mealsToday, forageFor, stageForLevel,
  levelProgress, dayKey, isMissingYou, FOODS, DEFAULT_FOOD,
} from './shared/pets/model.js';

/** A second pet of any kind costs this; the first starter is free. */
export const EXTRA_PET_COST = 600;
const NAME_MAX = 16;
const RENAME_COST = 100;

/** Refuse politely, and always say what to do instead. */
const no = (message) => ({ ok: false, message });

export function createPets({ profiles, log }) {
  function speciesOf(pet) {
    return SPECIES[pet?.species] || null;
  }

  function activePetOf(profile) {
    if (!profile.pets.length) return null;
    return profile.pets.find((p) => p.id === profile.activePet) || profile.pets[0];
  }

  /** Has this viewer earned a mythic they haven't claimed? */
  function mythicProgress(profile) {
    const out = [];
    for (const species of Object.values(SPECIES)) {
      if (!species.earnedBy) continue;
      const have = profile.stats[species.earnedBy.stat] || 0;
      out.push({
        species: species.id,
        label: species.label,
        have,
        need: species.earnedBy.need,
        how: species.earnedBy.label,
        earned: have >= species.earnedBy.need,
        owned: profile.pets.some((p) => p.species === species.id),
      });
    }
    return out;
  }

  return {
    activePetOf,
    mythicProgress,

    adopt(profile, speciesId, { name } = {}) {
      const species = SPECIES[speciesId];
      if (!species) {
        return no(`No such pet. Try: ${STARTER_SPECIES.join(', ')}`);
      }
      if (profile.pets.some((p) => p.species === speciesId)) {
        return no(`You already have a ${species.label}.`);
      }

      if (species.earnedBy) {
        const have = profile.stats[species.earnedBy.stat] || 0;
        if (have < species.earnedBy.need) {
          return no(`${species.label} must be earned: ${species.earnedBy.label} (${have}/${species.earnedBy.need}).`);
        }
      } else if (profile.pets.length > 0) {
        // The first starter is free; any after that costs.
        if (profile.coins < EXTRA_PET_COST) {
          return no(`A second pet costs ${EXTRA_PET_COST} coins — you have ${profile.coins}.`);
        }
        profile.coins -= EXTRA_PET_COST;
      }

      const pet = createPet({
        id: `p${profile.pets.length + 1}-${Date.now().toString(36)}`,
        species: speciesId,
        name: cleanName(name) || species.label,
      });
      profile.pets.push(pet);
      profile.activePet = pet.id;
      profiles.touch();
      return { ok: true, pet, species, message: `${profile.name} adopted a ${species.label}!` };
    },

    /**
     * Feed the active pet. Coins decide how good the meal is; how many meals
     * you get is decided by turning up, which is what stops this being
     * click-to-win.
     */
    feed(profile, foodId = DEFAULT_FOOD, { day = dayKey(), now = Date.now() } = {}) {
      const pet = activePetOf(profile);
      if (!pet) return no(`No pet yet — try !adopt ${STARTER_SPECIES[0]}`);

      const food = FOODS[foodId] ? foodId : DEFAULT_FOOD;
      const meals = mealsToday(pet, day);
      if (meals.full) {
        return no(`${pet.name} is full. Three meals a stream — come back next stream.`);
      }
      if (profile.coins < FOODS[food].cost) {
        return no(`${FOODS[food].label} costs ${FOODS[food].cost} — you have ${profile.coins} coins.`);
      }

      const species = speciesOf(pet);
      const missed = isMissingYou(pet, day);
      const value = feedValue({ pet, food: food, species, streak: profile.stats.streak || 0, day });

      profile.coins -= value.cost;
      // Streak counts stream-days fed, and never resets — a week off costs the
      // week, nothing more.
      if (pet.fedDay !== day) profile.stats.streak = (profile.stats.streak || 0) + 1;
      profile.stats.fed = (profile.stats.fed || 0) + 1;

      const before = stageForLevel(pet.level).stage;
      const growth = gainXp(pet, value.xp);
      markFed(pet, day, now);

      // A fed pet brings something back, so turning up alone moves a number.
      const forage = forageFor(pet, species);
      profile.coins += forage;
      profiles.touch();

      return {
        ok: true,
        pet,
        species,
        food: FOODS[food],
        xp: value.xp,
        reasons: value.reasons,
        forage,
        missed,
        levelledTo: growth.levels.at(-1) || null,
        evolvedTo: growth.stagesCrossed.at(-1) || null,
        stageName: species.stageNames[stageForLevel(pet.level).stage - 1],
        mealsLeft: mealsToday(pet, day).left,
        message: growth.stagesCrossed.length
          ? `${pet.name} grew up into a ${species.stageNames[growth.stagesCrossed.at(-1) - 1]}!`
          : growth.levels.length
            ? `${pet.name} reached level ${growth.levels.at(-1)}!`
            : `${pet.name} ate the ${FOODS[food].label}.`,
        grewFrom: before,
      };
    },

    rename(profile, name) {
      const pet = activePetOf(profile);
      if (!pet) return no('No pet to name yet.');
      const clean = cleanName(name);
      if (!clean) return no('Names are 2–16 letters, digits or spaces.');
      const free = !profile.stats.renamed;
      if (!free && profile.coins < RENAME_COST) {
        return no(`Renaming costs ${RENAME_COST} coins after the first time.`);
      }
      if (!free) profile.coins -= RENAME_COST;
      profile.stats.renamed = (profile.stats.renamed || 0) + 1;
      const was = pet.name;
      pet.name = clean;
      profiles.touch();
      return { ok: true, pet, message: `${was} is now called ${clean}.` };
    },

    switchTo(profile, speciesId) {
      const pet = profile.pets.find((p) => p.species === speciesId || p.id === speciesId);
      if (!pet) return no(`You don't have one of those. You have: ${profile.pets.map((p) => p.name).join(', ') || 'nothing yet'}`);
      profile.activePet = pet.id;
      profiles.touch();
      return { ok: true, pet, message: `${pet.name} is out front now.` };
    },

    /** Everything a card needs to draw this viewer's pet. */
    card(profile) {
      const pet = activePetOf(profile);
      if (!pet) return null;
      const species = speciesOf(pet);
      const stage = stageForLevel(pet.level).stage;
      return {
        kind: 'pet',
        owner: profile.name,
        platform: profile.platform,
        crest: profile.crest,
        coins: profile.coins,
        pet: { ...pet },
        species: species.id,
        speciesLabel: species.label,
        stage,
        stageName: species.stageNames[stage - 1],
        progress: levelProgress(pet),
        mealsLeft: mealsToday(pet).left,
        missingYou: isMissingYou(pet),
      };
    },

    /** Called when a game is settled, so mythic milestones can advance. */
    recordGameResult(profile, { game, place, topDamage, survived }) {
      if (game === 'boss' && topDamage) {
        profile.stats.bossTopDamage = (profile.stats.bossTopDamage || 0) + 1;
      }
      if (game === 'race' && place <= 3) {
        profile.stats.racePodium = (profile.stats.racePodium || 0) + 1;
      }
      if (game === 'heist' && survived) {
        profile.stats.heistSurvived = (profile.stats.heistSurvived || 0) + 1;
      }
      profiles.touch();
    },
  };
}

/** Pet names are viewer input; keep them short, plain and single-line. */
export function cleanName(raw) {
  const name = String(raw || '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!/^[\p{L}\p{N} ]{2,}$/u.test(name)) return null;
  return name.slice(0, NAME_MAX);
}
