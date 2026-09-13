import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIRC, parseEmotes, chatEvent, rolesFromTags } from '../src/adapters/twitch/normalize.js';

const LINE =
  '@badges=moderator/1,subscriber/6;color=#1E90FF;display-name=PixelPete;emotes=25:6-10;' +
  'id=abc-123;mod=1;subscriber=1;tmi-sent-ts=1700000000000;user-id=44322889 ' +
  ':pixelpete!pixelpete@pixelpete.tmi.twitch.tv PRIVMSG #mychan :hello Kappa world';

test('parses tags, prefix, command and trailing text', () => {
  const msg = parseIRC(LINE);
  assert.equal(msg.command, 'PRIVMSG');
  assert.equal(msg.params[0], '#mychan');
  assert.equal(msg.params[1], 'hello Kappa world', 'trailing text keeps its spaces');
  assert.equal(msg.tags['display-name'], 'PixelPete');
});

test('unescapes IRCv3 tag values', () => {
  const msg = parseIRC('@system-msg=Big\\sGift\\son!;other=a\\:b :tmi.twitch.tv USERNOTICE #c');
  assert.equal(msg.tags['system-msg'], 'Big Gift on!');
  assert.equal(msg.tags.other, 'a;b');
});

test('handles lines with no tags and no trailing part', () => {
  const msg = parseIRC('PING :tmi.twitch.tv');
  assert.equal(msg.command, 'PING');
  assert.equal(parseIRC(''), null);
});

test('emote tag becomes positioned emotes', () => {
  const emotes = parseEmotes('25:0-4,12-16/1902:6-10');
  assert.equal(emotes.length, 3);
  assert.deepEqual(emotes.map((e) => [e.id, e.start, e.end]), [['25', 0, 4], ['25', 12, 16], ['1902', 6, 10]]);
  assert.match(emotes[0].url, /emoticons\/v2\/25\//);
});

test('roles come from badges as well as the boolean tags', () => {
  assert.deepEqual(rolesFromTags({ badges: 'vip/1', mod: '0' }, 'c'), ['vip']);
  assert.deepEqual(rolesFromTags({ badges: 'broadcaster/1' }, 'c'), ['broadcaster']);
});

test('a PRIVMSG becomes a normalized chat event', () => {
  const event = chatEvent(parseIRC(LINE), 'mychan');
  assert.equal(event.type, 'chat');
  assert.equal(event.platform, 'twitch');
  assert.equal(event.user.displayName, 'PixelPete');
  assert.equal(event.user.name, 'pixelpete');
  assert.deepEqual(event.user.roles, ['moderator', 'subscriber']);
  assert.equal(event.ts, 1700000000000, 'uses Twitch’s own timestamp');
  assert.deepEqual(event.data.fragments.map((f) => f.type), ['text', 'emote', 'text']);
});
