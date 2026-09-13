import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFragments, makeEvent, isEvent } from '#core/events.js';

test('plain text becomes a single fragment', () => {
  assert.deepEqual(buildFragments('hello'), [{ type: 'text', text: 'hello' }]);
  assert.deepEqual(buildFragments(''), []);
});

test('emotes split the text at the right places', () => {
  const frags = buildFragments('hi Kappa there', [{ start: 3, end: 7, id: '25', name: 'Kappa', url: 'u' }]);
  assert.deepEqual(frags.map((f) => f.type), ['text', 'emote', 'text']);
  assert.equal(frags[0].text, 'hi ');
  assert.equal(frags[2].text, ' there');
});

test('emote positions survive astral characters earlier in the message', () => {
  // The emoji is two UTF-16 units but one character; indexing by code unit
  // would shift the emote and slice the message in the wrong place.
  const text = '👋 Kappa';
  const frags = buildFragments(text, [{ start: 2, end: 6, id: '25', name: 'Kappa', url: 'u' }]);
  assert.equal(frags[0].text, '👋 ');
  assert.equal(frags[1].type, 'emote');
  assert.equal(frags.length, 2, 'nothing trails the emote');
});

test('overlapping or out-of-range emotes are skipped, not crashed on', () => {
  const frags = buildFragments('abc', [{ start: 99, end: 120, id: '1', name: 'x', url: 'u' }]);
  assert.deepEqual(frags, [{ type: 'text', text: 'abc' }]);
});

test('events carry an id and only known roles', () => {
  const event = makeEvent({
    type: 'chat',
    platform: 'twitch',
    user: { name: 'x', roles: ['moderator', 'wizard'] },
    data: { text: 'hi' },
  });
  assert.ok(isEvent(event));
  assert.deepEqual(event.user.roles, ['moderator'], 'unknown roles are dropped');
  assert.equal(event.user.displayName, 'x', 'display name falls back to the login');
});

test('isEvent rejects junk', () => {
  assert.equal(isEvent(null), false);
  assert.equal(isEvent({ type: 'nope', platform: 'x', id: '1' }), false);
});
