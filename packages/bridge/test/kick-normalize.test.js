import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pusherData, toChatEvent } from '../src/adapters/kick/index.js';

// Captured from Kick's realtime socket. Note `data` arrives as a STRING - the
// bug this pins was treating it as an object and dropping every message.
const RAW_FRAME = {
  event: 'App\\Events\\ChatMessageEvent',
  data: JSON.stringify({
    id: 'dbe2016d-3b27-49e7-9cec-d5cb8c1d152a',
    chatroom_id: 2579856,
    content: 'hello [emote:37226:KEKW] there',
    type: 'message',
    created_at: '2026-09-13T16:43:36+00:00',
    sender: {
      id: 282723,
      username: 'JakeMcEx',
      slug: 'jakemcex',
      identity: { color: '#FFD899', badges: [{ type: 'moderator', text: 'Moderator' }] },
    },
  }),
  channel: 'chatrooms.2579856.v2',
};

test('pusher payloads arrive as JSON strings and are decoded', () => {
  const data = pusherData(RAW_FRAME.data);
  assert.equal(typeof data, 'object');
  assert.equal(data.content, 'hello [emote:37226:KEKW] there');
  assert.deepEqual(pusherData({ already: 'object' }), { already: 'object' });
  assert.equal(pusherData('not json'), null);
});

test('a real Kick frame becomes a normalized chat event', () => {
  const event = toChatEvent(pusherData(RAW_FRAME.data), '4head');
  assert.ok(event, 'message must not be dropped');
  assert.equal(event.type, 'chat');
  assert.equal(event.platform, 'kick');
  assert.equal(event.channel, '4head');
  assert.equal(event.user.displayName, 'JakeMcEx');
  assert.equal(event.user.name, 'jakemcex');
  assert.equal(event.user.color, '#FFD899');
  assert.deepEqual(event.user.roles, ['moderator']);
  assert.equal(event.ts, Date.parse('2026-09-13T16:43:36+00:00'));
});

test('inline [emote:id:name] markup becomes emote fragments', () => {
  const event = toChatEvent(pusherData(RAW_FRAME.data), '4head');
  assert.equal(event.data.text, 'hello KEKW there');
  assert.deepEqual(event.data.fragments.map((f) => f.type), ['text', 'emote', 'text']);
  assert.equal(event.data.fragments[1].name, 'KEKW');
  assert.match(event.data.fragments[1].url, /emotes\/37226\//);
});

test('the un-decoded string is rejected rather than half-rendered', () => {
  assert.equal(toChatEvent(RAW_FRAME.data, '4head'), null);
});
