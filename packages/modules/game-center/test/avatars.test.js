import test from 'node:test';
import assert from 'node:assert/strict';
import { createAvatars } from '../avatars.js';
import { createProfile } from '../shared/profiles.js';

function setup(pet = null) {
  let touched = 0;
  const profiles = { touch: () => { touched++; } };
  const pets = { activePetOf: () => pet };
  const profile = createProfile({ key: 'twitch:ann', name: 'Ann', platform: 'twitch' });
  return { avatars: createAvatars({ profiles, pets }), profile, touched: () => touched };
}

const fixedRandom = () => 0.42;

test('no arguments describes the current avatar and suggests one', () => {
  const { avatars, profile, touched } = setup();
  const before = { ...profile.crest };
  const result = avatars.set(profile, '', { random: fixedRandom });
  assert.equal(result.ok, true);
  assert.equal(result.unchanged, true);
  assert.deepEqual(profile.crest, before, 'looking does not change anything');
  assert.equal(touched(), 0, 'and does not write to disk');
  assert.match(result.message, /!avatar/);
});

test('random gives a new one and saves it', () => {
  const { avatars, profile, touched } = setup();
  const result = avatars.set(profile, 'random', { random: fixedRandom });
  assert.equal(result.ok, true);
  assert.equal(profile.crest, result.crest);
  assert.equal(touched(), 1);
});

test('reset goes back to the crest derived from the name', () => {
  const { avatars, profile } = setup();
  const original = { ...profile.crest };
  avatars.set(profile, 'diamond rays');
  assert.notDeepEqual(profile.crest, original);
  const result = avatars.set(profile, 'reset');
  assert.equal(result.ok, true);
  assert.deepEqual(profile.crest, original);
});

test('pet needs a pet, and says so kindly rather than failing', () => {
  const { avatars, profile, touched } = setup(null);
  const result = avatars.set(profile, 'pet');
  assert.equal(result.ok, false);
  assert.match(result.message, /!adopt/);
  assert.equal(touched(), 0);

  const withPet = setup({ name: 'Biscuit', species: 'dog', colour: 'mint', level: 2 });
  const ok = withPet.avatars.set(withPet.profile, 'pet');
  assert.equal(ok.ok, true);
  assert.equal(withPet.profile.crest.primary, 'mint');
});

test('a completely unrecognised avatar changes nothing and explains', () => {
  const { avatars, profile, touched } = setup();
  const before = { ...profile.crest };
  const result = avatars.set(profile, 'banana wombat');
  assert.equal(result.ok, false);
  assert.deepEqual(profile.crest, before);
  assert.equal(touched(), 0);
  assert.match(result.message, /didn't recognise/);
});

test('a half-understood avatar applies the half that made sense', () => {
  const { avatars, profile } = setup();
  const result = avatars.set(profile, 'shield banana');
  assert.equal(result.ok, true);
  assert.equal(profile.crest.shape, 'shield');
  assert.match(result.message, /ignored "banana"/);
});

test('the word lists are all there for anyone who wants to read them', () => {
  const { avatars } = setup();
  const words = avatars.words();
  assert.ok(words.shapes.length >= 6);
  assert.ok(words.emblems.length >= 24);
  assert.ok(words.colours.length === 12);
});
