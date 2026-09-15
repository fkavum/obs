import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buy, wear, takeOff, setCoat, setEyes, shopPage, catalogue, grantEarned,
  itemById, owns, shinyId, SHINY_PRICE, SLOTS,
} from '../shared/pets/wardrobe.js';
import { ACCESSORIES, ACCESSORY_LIST, priceOf, RARITY } from '../shared/pets/accessories.js';
import { createProfile } from '../shared/profiles.js';
import { renderPet } from '../shared/pets/render.js';
import { SPECIES_LIST } from '../shared/pets/species.js';

const profileWith = (coins) => {
  const p = createProfile({ key: 'twitch:ann', name: 'Ann', platform: 'twitch' });
  p.coins = coins;
  return p;
};
const petAt = (level = 1) => ({ id: 'p1', name: 'Biscuit', species: 'dog', level, colour: 'biscuit', accessories: {} });

test('every accessory has a real slot, rarity and price', () => {
  for (const item of ACCESSORY_LIST) {
    assert.ok(SLOTS.includes(item.slot), `${item.id} has slot ${item.slot}`);
    assert.ok(RARITY[item.rarity], `${item.id} has rarity ${item.rarity}`);
    assert.ok(item.svg.trim().startsWith('<'), `${item.id} draws something`);
    // Every item is exactly one of: for sale at a price, or earned by doing
    // something. Never both, and never neither — neither means unobtainable.
    if (item.earnedBy) {
      assert.equal(priceOf(item), null, `${item.id} is not for sale`);
      assert.ok(item.earnedBy.stat && item.earnedBy.need > 0, `${item.id} says how it's earned`);
      assert.ok(item.earnedBy.label, `${item.id} says it in words a viewer reads`);
    } else {
      assert.ok(priceOf(item) > 0, `${item.id} has a price`);
    }
    if (item.rarity === 'legendary') {
      assert.ok(item.earnedBy, `${item.id} is legendary, so it must be earned`);
    }
  }
});

test('buying takes the coins once and hands over the item', () => {
  const p = profileWith(500);
  const first = buy(p, 'partyhat');
  assert.equal(first.ok, true);
  assert.equal(p.coins, 500 - RARITY.common.price);
  assert.ok(owns(p, 'partyhat'));

  const again = buy(p, 'partyhat');
  assert.equal(again.ok, false);
  assert.match(again.message, /already own/);
  assert.equal(p.coins, 500 - RARITY.common.price, 'a refused buy costs nothing');
});

test('you cannot buy what you cannot afford, and are told the numbers', () => {
  const p = profileWith(10);
  const result = buy(p, 'crown');
  assert.equal(result.ok, false);
  assert.match(result.message, /2000 coins and you have 10/);
  assert.equal(p.coins, 10);
  assert.equal(owns(p, 'crown'), false);
});

test('legendary items are never for sale at any balance', () => {
  const p = profileWith(1000000);
  const result = buy(p, 'champhelm');
  assert.equal(result.ok, false);
  assert.match(result.message, /isn't for sale/);
  assert.equal(p.coins, 1000000);
});

test('an earned item is granted the moment the condition is met, and only once', () => {
  const p = profileWith(0);
  assert.deepEqual(grantEarned(p), []);

  p.stats.racePodium = 1;
  const granted = grantEarned(p);
  assert.deepEqual(granted.map((i) => i.id), ['flag']);
  assert.ok(owns(p, 'flag'));
  assert.deepEqual(grantEarned(p), [], 'not granted a second time');
});

test('wearing needs ownership, and an item replaces its own slot only', () => {
  const p = profileWith(1000);
  const pet = petAt(1);

  const notOwned = wear(p, pet, 'crown');
  assert.equal(notOwned.ok, false);
  assert.match(notOwned.message, /don't own/);

  buy(p, 'partyhat');
  buy(p, 'glasses');
  wear(p, pet, 'partyhat');
  wear(p, pet, 'glasses');
  assert.deepEqual(pet.accessories, { hat: 'partyhat', face: 'glasses' });

  buy(p, 'beanie');
  wear(p, pet, 'beanie');
  assert.deepEqual(pet.accessories, { hat: 'beanie', face: 'glasses' }, 'the hat swapped, the glasses stayed');

  takeOff(p, pet, 'hat');
  assert.deepEqual(pet.accessories, { face: 'glasses' });
});

test('a back item can be bought early but says when it will show', () => {
  const p = profileWith(1000);
  const pet = petAt(3);
  buy(p, 'cape');
  const result = wear(p, pet, 'cape');
  assert.equal(result.ok, true);
  assert.match(result.message, /stage 3/);

  // Worn, but deliberately not drawn until the creature is big enough.
  const early = renderPet({ ...pet, accessories: { back: 'cape' } }, { accessories: ACCESSORIES });
  assert.equal(early.includes('M-14,-8'), false, 'no cape at stage 1');
  const grown = renderPet({ ...pet, level: 30, accessories: { back: 'cape' } }, { accessories: ACCESSORIES });
  assert.ok(grown.includes('M-14,-8'), 'the cape shows once evolved');
});

test('coats are free, shiny coats are not', () => {
  const p = profileWith(100);
  const pet = petAt(1);

  assert.equal(setCoat(p, pet, 'moss').ok, true);
  assert.equal(pet.colour, 'moss');
  assert.equal(pet.shiny, false);
  assert.equal(p.coins, 100, 'changing coat costs nothing');

  const denied = setCoat(p, pet, 'moss', { shiny: true });
  assert.equal(denied.ok, false);
  assert.match(denied.message, new RegExp(String(SHINY_PRICE)));
  assert.equal(pet.shiny, false);

  p.coins = SHINY_PRICE;
  assert.equal(buy(p, shinyId('moss')).ok, true);
  assert.equal(setCoat(p, pet, 'moss', { shiny: true }).ok, true);
  assert.equal(pet.shiny, true);
});

test('a nonsense coat or eye colour lists the real ones instead of failing silently', () => {
  const p = profileWith(0);
  const pet = petAt(1);
  const coat = setCoat(p, pet, 'neon');
  assert.equal(coat.ok, false);
  assert.match(coat.message, /biscuit/);
  const eyes = setEyes(p, pet, 'x-ray');
  assert.equal(eyes.ok, false);
  assert.match(eyes.message, /onyx/);
  assert.equal(setEyes(p, pet, 'gold').ok, true);
  assert.equal(pet.eyes, 'gold');
});

test('the shop board pages rather than growing, and wraps', () => {
  const p = profileWith(300);
  const first = shopPage(p, { slot: 'hat', page: 0, perPage: 4 });
  assert.equal(first.items.length, 4);
  assert.ok(first.pages >= 2);
  // Out-of-range pages wrap instead of showing an empty board on stream.
  const wrapped = shopPage(p, { slot: 'hat', page: first.pages, perPage: 4 });
  assert.equal(wrapped.page, 0);
  assert.deepEqual(wrapped.items.map((i) => i.id), first.items.map((i) => i.id));

  const affordable = first.items.filter((i) => i.affordable).map((i) => i.id);
  assert.ok(affordable.length, 'a 300-coin viewer can afford something');
});

test('every accessory places on every species, and covering eyes removes them', () => {
  for (const species of SPECIES_LIST) {
    for (const item of ACCESSORY_LIST) {
      const svg = renderPet(
        { species: species.id, level: 30, colour: 'moss', accessories: { [item.slot]: item.id } },
        { accessories: ACCESSORIES },
      );
      assert.ok(svg.includes('<svg'), `${species.id} renders with ${item.id}`);
      assert.equal(svg.includes('NaN'), false, `${species.id} + ${item.id} has no NaN transform`);
      assert.equal(svg.includes('undefined'), false, `${species.id} + ${item.id} is fully defined`);
    }
  }
  const plain = renderPet({ species: 'dog', level: 1 }, { accessories: ACCESSORIES });
  const covered = renderPet({ species: 'dog', level: 1, accessories: { face: 'hearteyes' } }, { accessories: ACCESSORIES });
  assert.ok(plain.length > 0);
  assert.ok(covered.includes('E86A8A'), 'heart eyes are drawn');
  assert.ok(covered.length < plain.length + 400, 'the real eyes were removed, not stacked under');
});

test('the catalogue is what the board and the commands both read', () => {
  const all = catalogue();
  assert.equal(all.filter((i) => i.slot === 'coat').length, 12, 'twelve shiny coats');
  assert.equal(all.length, ACCESSORY_LIST.length + 12);
  for (const entry of all) {
    assert.ok(itemById(entry.id), `${entry.id} resolves back to an item`);
  }
  assert.equal(itemById('shiny:nonsense'), null);
  assert.equal(itemById('nothing-like-this'), null);
});
