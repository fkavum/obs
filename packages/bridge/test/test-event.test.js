import test from 'node:test';
import assert from 'node:assert/strict';
import { makePreviewEvent } from '#core/preview-feed.js';

/**
 * The shape /api/test-event produces. The handler itself needs a live server,
 * so this covers the part that was wrong: overriding a generated event without
 * leaving a contradiction inside it.
 */
function overrideChat(event, { text, user }) {
  if (typeof text === 'string' && text && event.data) {
    event.data.text = text;
    event.data.fragments = [{ type: 'text', text }];
  }
  if (typeof user === 'string' && user && event.user) {
    event.user.name = user.toLowerCase();
    event.user.displayName = user;
    event.user.id = user.toLowerCase();
  }
  return event;
}

/** What a chat overlay draws: fragments if there are any, otherwise the text. */
function rendered(event) {
  const frags = event.data?.fragments;
  if (Array.isArray(frags) && frags.length) return frags.map((f) => f.text ?? f.name ?? '').join('');
  return event.data?.text || '';
}

test('a typed line is what gets shown, not the generated one', () => {
  const event = overrideChat(makePreviewEvent(['twitch'], 'chat'), { text: 'hello chat!' });
  assert.equal(event.data.text, 'hello chat!');
  assert.equal(rendered(event), 'hello chat!',
    'the overlay renders fragments, so they have to be rewritten too');
});

test('no stale fragment survives the override', () => {
  for (let i = 0; i < 25; i++) {
    const generated = makePreviewEvent(['twitch'], 'chat');
    const before = generated.data.fragments.map((f) => f.text ?? f.name).join('');
    const event = overrideChat(generated, { text: '!shop face' });
    assert.equal(rendered(event), '!shop face');
    assert.equal(event.data.fragments.length, 1, 'exactly one fragment, whatever was there before');
    if (before !== '!shop face') {
      assert.equal(rendered(event).includes(before), false, 'nothing of the old line is left');
    }
  }
});

test('a command reads the same words the overlay shows', () => {
  const event = overrideChat(makePreviewEvent(['kick'], 'chat'), { text: '!adopt dog', user: 'Ann' });
  // The command engine reads data.text; the overlay reads fragments. They were
  // allowed to disagree, which is why commands worked while chat showed junk.
  assert.equal(event.data.text, rendered(event));
  assert.equal(event.user.displayName, 'Ann');
  assert.equal(event.user.name, 'ann');
});

test('sending as somebody keeps the line they actually typed', () => {
  const event = overrideChat(makePreviewEvent(['twitch'], 'chat'), { text: 'gg', user: 'PixelPete' });
  assert.equal(rendered(event), 'gg');
  assert.equal(event.user.displayName, 'PixelPete');
});

test('with no text override the generated line is left intact', () => {
  const generated = makePreviewEvent(['twitch'], 'chat');
  const expected = rendered(generated);
  const event = overrideChat(generated, { user: 'Ann' });
  assert.equal(rendered(event), expected, 'only the name changed');
});
