import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'obs-pets-'));
process.env.OBS_TOOLKIT_CONFIG_DIR = dir;
const { createModuleStore } = await import('#bridge/store.js');
const { ProfileStore } = await import('../profiles.js');
const { createPets, cleanName, EXTRA_PET_COST } = await import('../pets.js');
const {
  xpForNext, totalXpFor, stageForLevel, createPet, gainXp, mealsToday, markFed,
  feedValue, forageFor, isMissingYou, dayKey, MEALS_PER_DAY, FOODS,
} = await import('../shared/pets/model.js');
const { SPECIES, STARTER_SPECIES } = await import('../shared/pets/species.js');
const { renderPet } = await import('../shared/pets/render.js');
const { coatColours } = await import('../shared/pets/colours.js');
process.on('exit', () => rmSync(dir, { recursive: true, force: true }));

const quiet = { info() {}, warn() {}, debug() {}, error() {} };
function setup() {
  rmSync(join(dir, 'game-center'), { recursive: true, force: true });
  const profiles = new ProfileStore({ store: createModuleStore('game-center'), log: quiet, flushMs: 5 });
  return { profiles, pets: createPets({ profiles, log: quiet }) };
}
const richProfile = (profiles, coins = 5000) => {
  const p = profiles.ensure('twitch', 'Ann');
  p.coins = coins;
  return p;
};

// ---------------------------------------------------------------- levels

test('levels follow 25 x level, matching the designed pace', () => {
  assert.equal(xpForNext(1), 25);
  assert.equal(xpForNext(10), 250);
  assert.equal(totalXpFor(10), 1125, 'stage 2 at ~4 casual streams');
  assert.equal(totalXpFor(25), 7500);
  assert.equal(totalXpFor(50), 30625, 'stage 4 should be rare on a channel');
});

test('stages are reached at the designed levels', () => {
  assert.equal(stageForLevel(1).stage, 1);
  assert.equal(stageForLevel(9).stage, 1);
  assert.equal(stageForLevel(10).stage, 2);
  assert.equal(stageForLevel(24).stage, 2);
  assert.equal(stageForLevel(25).stage, 3);
  assert.equal(stageForLevel(50).stage, 4);
  assert.equal(stageForLevel(500).stage, 4, 'four is the visual cap');
});

test('a big meal can cross several levels at once', () => {
  const pet = createPet({ id: 'p', species: 'dog', name: 'Biscuit' });
  const growth = gainXp(pet, 1125);
  assert.equal(growth.level, 10);
  assert.deepEqual(growth.stagesCrossed, [2], 'and reports the stage it grew into');
  assert.ok(growth.levels.length > 1);
});

// ---------------------------------------------------------------- feeding

test('three meals a stream-day, and the count resets the next day', () => {
  const pet = createPet({ id: 'p', species: 'dog', name: 'B' });
  const today = '2026-09-15';
  for (let i = 0; i < MEALS_PER_DAY; i++) {
    assert.equal(mealsToday(pet, today).full, false, `meal ${i + 1} allowed`);
    markFed(pet, today);
  }
  assert.equal(mealsToday(pet, today).full, true, 'four is too many');
  assert.equal(mealsToday(pet, '2026-09-16').full, false, 'a new stream-day resets it');
});

test('the first feed of a stream is worth double', () => {
  const pet = createPet({ id: 'p', species: 'dog', name: 'B' });
  const day = '2026-09-15';
  const first = feedValue({ pet, food: 'kibble', species: SPECIES.dog, day });
  markFed(pet, day);
  const second = feedValue({ pet, food: 'kibble', species: SPECIES.dog, day });
  assert.equal(first.xp, 20, 'showing up beats showing off');
  assert.equal(second.xp, 10);
});

test('a favourite food is worth more, and says so', () => {
  const pet = createPet({ id: 'p', species: 'dog', name: 'B' });
  markFed(pet, '2026-09-15');
  const value = feedValue({ pet, food: 'fish', species: SPECIES.dog, day: '2026-09-15' });
  assert.equal(value.xp, 105, '70 x 1.5');
  assert.ok(value.reasons.some((r) => /loves/i.test(r.label)), 'the card can explain the number');
});

test('coming back after a break is rewarded, never punished', () => {
  const pet = createPet({ id: 'p', species: 'dog', name: 'B' });
  markFed(pet, '2026-09-01');
  assert.equal(isMissingYou(pet, '2026-09-10'), true);
  const value = feedValue({ pet, food: 'kibble', species: SPECIES.dog, day: '2026-09-10' });
  // 10 base x2 first-feed x3 welcome-back.
  assert.equal(value.xp, 60);
  assert.ok(value.reasons.some((r) => r.label === 'welcome back'));
  assert.equal(pet.level, 1, 'and nothing was taken away while they were gone');
});

test('a fed pet forages, and a bigger pet forages more', () => {
  const pet = createPet({ id: 'p', species: 'dog', name: 'B' });
  const small = forageFor(pet, SPECIES.dog);
  pet.level = 50;
  assert.ok(forageFor(pet, SPECIES.dog) > small);
});

// ---------------------------------------------------------------- adopting

test('the first starter is free; a second pet costs coins', () => {
  const { profiles, pets } = setup();
  const profile = richProfile(profiles, 100);
  assert.equal(pets.adopt(profile, 'dog').ok, true);
  assert.equal(profile.coins, 100, 'the first one is free');

  const second = pets.adopt(profile, 'cat');
  assert.equal(second.ok, false, 'not affordable on 100 coins');
  assert.match(second.message, /600/);

  profile.coins = 700;
  assert.equal(pets.adopt(profile, 'cat').ok, true);
  assert.equal(profile.coins, 100, 'and it was paid for');
});

test('you cannot adopt the same species twice, or something that does not exist', () => {
  const { profiles, pets } = setup();
  const profile = richProfile(profiles);
  pets.adopt(profile, 'dog');
  assert.match(pets.adopt(profile, 'dog').message, /already have/);
  assert.match(pets.adopt(profile, 'unicorn').message, new RegExp(STARTER_SPECIES[0]));
});

test('a mythic must be earned and cannot simply be bought', () => {
  const { profiles, pets } = setup();
  const profile = richProfile(profiles, 100000);
  const refused = pets.adopt(profile, 'dragon');
  assert.equal(refused.ok, false);
  assert.match(refused.message, /top damage in 5 raid bosses/i);
  assert.equal(profile.coins, 100000, 'and no coins were taken');

  profile.stats.bossTopDamage = 5;
  assert.equal(pets.adopt(profile, 'dragon').ok, true, 'earned, so now it is theirs');
});

test('mythic progress is visible, so it reads as a milestone not a lottery', () => {
  const { profiles, pets } = setup();
  const profile = richProfile(profiles);
  profile.stats.bossTopDamage = 3;
  const dragon = pets.mythicProgress(profile).find((m) => m.species === 'dragon');
  assert.deepEqual([dragon.have, dragon.need, dragon.earned], [3, 5, false]);
});

test('winning a boss as top damage advances the dragon milestone', () => {
  const { profiles, pets } = setup();
  const profile = richProfile(profiles);
  pets.recordGameResult(profile, { game: 'boss', place: 1, topDamage: true });
  pets.recordGameResult(profile, { game: 'boss', place: 2, topDamage: false });
  assert.equal(profile.stats.bossTopDamage, 1, 'only the top damage dealer counts');
});

// ---------------------------------------------------------------- the loop

test('feeding costs coins, gives XP, and hands some coins back', () => {
  const { profiles, pets } = setup();
  const profile = richProfile(profiles, 1000);
  pets.adopt(profile, 'dog');
  const result = pets.feed(profile, 'fish');

  assert.equal(result.ok, true);
  assert.ok(result.xp > 0);
  assert.ok(result.forage > 0);
  assert.equal(profile.coins, 1000 - FOODS.fish.cost + result.forage);
  assert.equal(result.mealsLeft, MEALS_PER_DAY - 1);
});

test('a fourth meal is refused politely, with what to do about it', () => {
  const { profiles, pets } = setup();
  const profile = richProfile(profiles);
  pets.adopt(profile, 'dog');
  for (let i = 0; i < MEALS_PER_DAY; i++) assert.equal(pets.feed(profile, 'kibble').ok, true);
  const refused = pets.feed(profile, 'kibble');
  assert.equal(refused.ok, false);
  assert.match(refused.message, /full/i);
});

test('a feed you cannot afford changes nothing', () => {
  const { profiles, pets } = setup();
  const profile = richProfile(profiles, 5);
  pets.adopt(profile, 'dog');
  const refused = pets.feed(profile, 'cake');
  assert.equal(refused.ok, false);
  assert.equal(profile.coins, 5, 'no coins taken');
  assert.equal(profile.pets[0].xp, 0, 'and no XP given');
});

test('feeding with no pet says how to get one', () => {
  const { profiles, pets } = setup();
  const result = pets.feed(richProfile(profiles), 'kibble');
  assert.equal(result.ok, false);
  assert.match(result.message, /!adopt/);
});

test('evolving is reported so the card can make a moment of it', () => {
  const { profiles, pets } = setup();
  const profile = richProfile(profiles, 100000);
  pets.adopt(profile, 'dog');
  let evolved = null;
  // Feed across many stream-days until it grows up.
  for (let d = 1; d <= 40 && !evolved; d++) {
    const day = `2026-10-${String(d).padStart(2, '0')}`;
    for (let m = 0; m < 3; m++) {
      const r = pets.feed(profile, 'cake', { day });
      if (r.ok && r.evolvedTo) { evolved = r; break; }
    }
  }
  assert.ok(evolved, 'it evolves within a reasonable number of streams');
  assert.equal(evolved.evolvedTo, 2);
  assert.match(evolved.message, /grew up into a Good Dog/);
});

// ---------------------------------------------------------------- names

test('pet names are cleaned, and nonsense is refused', () => {
  assert.equal(cleanName('Biscuit'), 'Biscuit');
  assert.equal(cleanName('  Sir  Barks  '), 'Sir Barks');
  assert.equal(cleanName('Zoë 2'), 'Zoë 2', 'letters from any language are fine');
  assert.equal(cleanName('x'), null, 'too short');
  assert.equal(cleanName('a'.repeat(40)).length, 16, 'capped');
  assert.equal(cleanName('line\nbreak'), 'line break');
  assert.equal(cleanName('<script>'), null);
  assert.equal(cleanName(''), null);
});

test('the first rename is free and the next one costs', () => {
  const { profiles, pets } = setup();
  const profile = richProfile(profiles, 150);
  pets.adopt(profile, 'dog');
  assert.equal(pets.rename(profile, 'Biscuit').ok, true);
  assert.equal(profile.coins, 150, 'first is free');
  assert.equal(pets.rename(profile, 'Crumpet').ok, true);
  assert.equal(profile.coins, 50);
});

// ---------------------------------------------------------------- drawing

test('every species draws at every stage without blowing up', () => {
  for (const species of Object.keys(SPECIES)) {
    for (const level of [1, 10, 25, 50]) {
      const svg = renderPet({ species, colour: 'biscuit', level });
      assert.match(svg, /^<svg/, `${species} lv${level}`);
      assert.ok(svg.length > 200, `${species} lv${level} is suspiciously small`);
      assert.ok(!svg.includes('undefined'), `${species} lv${level} has an undefined in it`);
      assert.ok(!svg.includes('NaN'), `${species} lv${level} has a NaN in it`);
    }
  }
});

test('an unknown species draws nothing rather than throwing', () => {
  assert.equal(renderPet({ species: 'griffin', level: 5 }), '');
});

test('stage changes the drawing, not just the label', () => {
  const baby = renderPet({ species: 'dog', colour: 'biscuit', level: 1 });
  const grown = renderPet({ species: 'dog', colour: 'biscuit', level: 25 });
  assert.notEqual(baby, grown);
  assert.ok(grown.length > baby.length, 'later stages add parts rather than replace them');
});

test('a coat derives its own outline and belly, and they differ', () => {
  const c = coatColours('lagoon');
  assert.match(c.coat, /^#[0-9a-f]{6}$/i);
  assert.notEqual(c.coat, c.outline);
  assert.notEqual(c.coat, c.belly);
  assert.deepEqual(coatColours('not-a-coat'), coatColours('biscuit'), 'unknown coats fall back');
});

test('the back slot is held back until stage 3, where the silhouette can take it', () => {
  const defs = { cape: { svg: '<rect width="10" height="10"/>' } };
  const early = renderPet({ species: 'dog', level: 5, accessories: { back: 'cape' } }, { accessories: defs });
  const later = renderPet({ species: 'dog', level: 30, accessories: { back: 'cape' } }, { accessories: defs });
  assert.ok(!early.includes('<rect width="10"'), 'not worn at stage 1');
  assert.ok(later.includes('<rect width="10"'), 'worn once grown');
});

test('one accessory definition sits on every species', () => {
  const defs = { hat: { svg: '<rect id="thehat" width="10" height="10"/>' } };
  for (const species of Object.keys(SPECIES)) {
    const svg = renderPet({ species, level: 12, accessories: { hat: 'hat' } }, { accessories: defs });
    assert.ok(svg.includes('thehat'), `${species} wears the hat`);
    assert.match(svg, /<g transform="translate\([\d.]+,[\d.]+\) scale\([\d.]+\)/, `${species} places it by anchor`);
  }
});
