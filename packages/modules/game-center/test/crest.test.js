import test from 'node:test';
import assert from 'node:assert/strict';
import {
  renderCrest, normaliseCrest, applyAvatarWords, randomCrest, crestFromPet, COLOUR_ALIASES,
} from '../shared/crest.js';
import {
  CREST_SHAPES, CREST_PATTERNS, CREST_EMBLEMS, COAT_NAMES, defaultCrest, createProfile,
} from '../shared/profiles.js';

test('every shape, pattern and emblem combination draws', () => {
  let drawn = 0;
  for (const shape of CREST_SHAPES) {
    for (const pattern of CREST_PATTERNS) {
      for (const emblem of CREST_EMBLEMS) {
        const svg = renderCrest({ shape, pattern, emblem, primary: 'lagoon', secondary: 'honey' });
        assert.ok(svg.startsWith('<svg'), `${shape}/${pattern}/${emblem} is an svg`);
        assert.equal(svg.includes('undefined'), false, `${shape}/${pattern}/${emblem} is fully defined`);
        assert.equal(svg.includes('NaN'), false, `${shape}/${pattern}/${emblem} has no NaN`);
        drawn++;
      }
    }
  }
  assert.equal(drawn, CREST_SHAPES.length * CREST_PATTERNS.length * CREST_EMBLEMS.length);
});

test('a broken or hostile crest falls back instead of drawing nothing', () => {
  const junk = renderCrest({ shape: 'triangle', pattern: 'plaid', emblem: 'banana', primary: 'neon', secondary: 'neon' });
  assert.ok(junk.includes('<svg'));
  assert.equal(junk.includes('undefined'), false);
  assert.deepEqual(normaliseCrest({}), { shape: 'circle', pattern: 'solid', emblem: 'star', primary: 'lagoon', secondary: 'honey' });
  assert.ok(renderCrest(null).includes('<svg'), 'even no crest at all renders');
});

test('the id is derived from the crest, so two of the same share one definition', () => {
  const a = renderCrest({ shape: 'hexagon', pattern: 'dots', emblem: 'star', primary: 'moss', secondary: 'snow' });
  const b = renderCrest({ shape: 'hexagon', pattern: 'dots', emblem: 'bolt', primary: 'moss', secondary: 'snow' });
  const c = renderCrest({ shape: 'hexagon', pattern: 'dots', emblem: 'star', primary: 'plum', secondary: 'snow' });
  const idOf = (svg) => /clipPath id="([^"]+)"/.exec(svg)[1];
  assert.equal(idOf(a), idOf(b), 'the emblem does not change the clip');
  assert.notEqual(idOf(a), idOf(c), 'a different colour is a different definition');
});

test('the default crest is stable for a name and differs between names', () => {
  assert.deepEqual(defaultCrest('twitch:ann'), defaultCrest('twitch:ann'));
  assert.notDeepEqual(defaultCrest('twitch:ann'), defaultCrest('twitch:bob'));
  // The same name on two platforms is two people, so two crests.
  assert.notDeepEqual(defaultCrest('twitch:ann'), defaultCrest('kick:ann'));
});

test('a crest is never one colour on itself', () => {
  for (const coat of COAT_NAMES) {
    const { crest } = applyAvatarWords({}, `${coat} ${coat}`);
    assert.notEqual(crest.secondary, crest.primary, `${coat} on ${coat} was nudged apart`);
  }
  let seed = 0;
  const fixed = () => { seed += 0.083; return seed % 1; };
  for (let i = 0; i < 50; i++) {
    const c = randomCrest(fixed);
    assert.notEqual(c.secondary, c.primary);
  }
});

test('avatar words are matched against every list at once', () => {
  const { crest, changed, unknown } = applyAvatarWords({}, 'shield checker moss flame');
  assert.equal(crest.shape, 'shield');
  assert.equal(crest.pattern, 'checker');
  assert.equal(crest.emblem, 'flame');
  assert.equal(crest.primary, 'moss');
  assert.deepEqual(unknown, []);
  assert.ok(changed.includes('shape') && changed.includes('emblem'));

  // Order does not matter: nobody should have to learn which word goes where.
  const reordered = applyAvatarWords({}, 'flame moss checker shield');
  assert.deepEqual(reordered.crest, crest);
});

test('the first colour is the crest and the second is the pattern on it', () => {
  const { crest } = applyAvatarWords({}, 'plum honey dots');
  assert.equal(crest.primary, 'plum');
  assert.equal(crest.secondary, 'honey');
});

test('everyday colour words work without knowing the palette names', () => {
  for (const [word, coat] of Object.entries(COLOUR_ALIASES)) {
    const { crest, unknown } = applyAvatarWords({}, word);
    assert.equal(crest.primary, coat, `"${word}" means ${coat}`);
    assert.deepEqual(unknown, [], `"${word}" is not reported as unknown`);
  }
});

test('words that mean nothing are reported, not silently dropped', () => {
  const { changed, unknown, crest } = applyAvatarWords({ shape: 'shield' }, 'banana hexagon wombat');
  assert.deepEqual(unknown, ['banana', 'wombat']);
  assert.equal(crest.shape, 'hexagon', 'the part that made sense still applied');
  assert.deepEqual(changed, ['shape']);
});

test('matching the avatar to the pet takes the pet colour and a paw', () => {
  const pet = { name: 'Biscuit', species: 'dog', colour: 'plum', level: 4 };
  const crest = crestFromPet({ shape: 'hexagon', pattern: 'rays', emblem: 'star', primary: 'moss', secondary: 'plum' }, pet);
  assert.equal(crest.primary, 'plum');
  assert.equal(crest.emblem, 'paw');
  assert.equal(crest.shape, 'hexagon', 'the shape they chose is kept');
  assert.notEqual(crest.secondary, 'plum', 'and it is still not one colour on itself');
  assert.equal(crestFromPet({}, null), null);
});

test('a new profile already has a crest before doing anything', () => {
  const profile = createProfile({ key: 'twitch:newcomer', name: 'Newcomer', platform: 'twitch' });
  assert.ok(profile.crest?.shape);
  assert.ok(renderCrest(profile.crest).includes('<svg'));
});
