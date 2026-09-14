import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createCommand, createRuntime, matchCommand, canRun, markRun, renderResponse,
  sanitizeOutgoing, handleMessage, rankOf, dueAutoMessage, markAutoSent,
} from '#core/command-engine.js';

const T0 = 1_000_000;
const chat = (text, over = {}) => ({
  id: 'm', type: 'chat', platform: over.platform || 'twitch', ts: T0, channel: 'c',
  user: { id: over.userId || 'u1', name: 'bob', displayName: 'Bob', roles: over.roles || [], color: null, avatar: null },
  data: { text },
});
const cmds = [
  createCommand({ id: 'c1', trigger: '!socials', aliases: ['!links'], response: 'Find me at example.com', cooldownSec: 0, userCooldownSec: 0 }),
  createCommand({ id: 'c2', trigger: '!mod', response: 'mods only', permission: 'moderator', cooldownSec: 0, userCooldownSec: 0 }),
];

test('a trigger is matched at the start of a message, case-insensitively', () => {
  assert.equal(matchCommand(cmds, '!socials').command.id, 'c1');
  assert.equal(matchCommand(cmds, '!SOCIALS').command.id, 'c1');
  assert.equal(matchCommand(cmds, '!links').command.id, 'c1', 'aliases work');
  assert.equal(matchCommand(cmds, '  !socials  ').command.id, 'c1');
  assert.equal(matchCommand(cmds, 'go to !socials'), null, 'only at the start');
  assert.equal(matchCommand(cmds, '!nothing'), null);
  assert.equal(matchCommand(cmds, 'hello'), null);
});

test('arguments after the trigger are captured', () => {
  assert.equal(matchCommand(cmds, '!socials right now').args, 'right now');
  assert.equal(matchCommand(cmds, '!socials').args, '');
});

test('a disabled command is invisible', () => {
  const off = [createCommand({ trigger: '!x', enabled: false })];
  assert.equal(matchCommand(off, '!x'), null);
});

test('role rank: a moderator satisfies a subscriber-only command', () => {
  assert.equal(rankOf({ roles: ['moderator'] }) > rankOf({ roles: ['subscriber'] }), true);
  const sub = createCommand({ id: 's', permission: 'subscriber', cooldownSec: 0, userCooldownSec: 0 });
  assert.equal(canRun(sub, chat('!x', { roles: ['moderator'] }), createRuntime(), T0).ok, true);
  assert.equal(canRun(sub, chat('!x', { roles: [] }), createRuntime(), T0).ok, false);
});

test('permission failures are silent, not an argument with chat', () => {
  const result = handleMessage(cmds, chat('!mod', { roles: [] }), createRuntime(), {}, T0);
  assert.equal(result, null, 'no reply at all');
});

test('cooldowns apply per command and per person', () => {
  const runtime = createRuntime();
  const cmd = createCommand({ id: 'cd', trigger: '!cd', response: 'hi', cooldownSec: 10, userCooldownSec: 30 });
  assert.equal(canRun(cmd, chat('!cd'), runtime, T0).ok, true);
  markRun(cmd, chat('!cd'), runtime, T0);

  assert.equal(canRun(cmd, chat('!cd', { userId: 'other' }), runtime, T0 + 5000).reason, 'cooldown');
  assert.equal(canRun(cmd, chat('!cd', { userId: 'other' }), runtime, T0 + 11000).ok, true, 'another person after the global wait');
  assert.equal(canRun(cmd, chat('!cd', { userId: 'u1' }), runtime, T0 + 11000).reason, 'user-cooldown', 'the same person waits longer');
  assert.equal(canRun(cmd, chat('!cd', { userId: 'u1' }), runtime, T0 + 31000).ok, true);
});

test('a command can be limited to certain platforms', () => {
  const cmd = createCommand({ id: 'p', platforms: ['kick'], cooldownSec: 0, userCooldownSec: 0 });
  assert.equal(canRun(cmd, chat('!x', { platform: 'twitch' }), createRuntime(), T0).reason, 'platform');
  assert.equal(canRun(cmd, chat('!x', { platform: 'kick' }), createRuntime(), T0).ok, true);
});

test('placeholders are filled, unknown ones vanish', () => {
  assert.equal(renderResponse('Hi {user} on {platform}!', { user: 'Bob', platform: 'kick' }), 'Hi Bob on kick!');
  assert.equal(renderResponse('{nope} clean', {}), 'clean');
  assert.equal(renderResponse('used {count} times', { count: 7 }), 'used 7 times');
});

test('{random: a | b} picks one of the options', () => {
  const seen = new Set();
  for (let i = 0; i < 40; i++) seen.add(renderResponse('{random: rock | paper | scissors}', {}));
  assert.ok(seen.size > 1, 'varies');
  for (const s of seen) assert.ok(['rock', 'paper', 'scissors'].includes(s), `unexpected: ${s}`);
});

test('{count} increases each time the command runs', () => {
  const runtime = createRuntime();
  const cmd = createCommand({ id: 'k', trigger: '!k', response: 'used {count}', cooldownSec: 0, userCooldownSec: 0 });
  assert.equal(handleMessage([cmd], chat('!k'), runtime, {}, T0).reply, 'used 1');
  assert.equal(handleMessage([cmd], chat('!k'), runtime, {}, T0 + 1).reply, 'used 2');
});

test('outgoing text can never become a platform command', () => {
  // The danger: a viewer types "!echo /ban someone" and the bot runs it as you.
  assert.equal(sanitizeOutgoing('/ban someone'), 'ban someone');
  assert.equal(sanitizeOutgoing('  .timeout bob'), 'timeout bob');
  assert.equal(sanitizeOutgoing('/me waves'), 'me waves');
  assert.equal(sanitizeOutgoing('line one\nline two'), 'line one line two', 'no newlines to inject with');
  assert.equal(sanitizeOutgoing('x'.repeat(900)).length, 400, 'length capped');
});

test('an echoing command cannot smuggle a slash command through its argument', () => {
  const echo = [createCommand({ id: 'e', trigger: '!echo', response: '{args}', cooldownSec: 0, userCooldownSec: 0 })];
  const result = handleMessage(echo, chat('!echo /ban bob'), createRuntime(), {}, T0);
  assert.equal(result.reply, 'ban bob');
  assert.ok(!result.reply.startsWith('/'));
});

test('a command producing empty text sends nothing', () => {
  const empty = [createCommand({ id: 'z', trigger: '!z', response: '{args}', cooldownSec: 0, userCooldownSec: 0 })];
  assert.equal(handleMessage(empty, chat('!z'), createRuntime(), {}, T0), null);
});

test('non-chat events are ignored', () => {
  assert.equal(handleMessage(cmds, { type: 'follow', platform: 'twitch' }, createRuntime(), {}, T0), null);
});

test('auto-messages wait for their interval and for a chat that is actually alive', () => {
  const runtime = createRuntime();
  const list = [{ id: 'a', text: 'hello', intervalSec: 600, minChatLines: 5, enabled: true }];
  assert.equal(dueAutoMessage(list, runtime, { now: T0, chatLinesSince: 10 })?.id, 'a', 'first one may go straight out');
  markAutoSent(runtime, list, T0);
  assert.equal(dueAutoMessage(list, runtime, { now: T0 + 60000, chatLinesSince: 10 }), null, 'too soon');
  assert.equal(dueAutoMessage(list, runtime, { now: T0 + 601000, chatLinesSince: 2 }), null, 'chat too quiet');
  assert.equal(dueAutoMessage(list, runtime, { now: T0 + 601000, chatLinesSince: 9 })?.id, 'a');
});

test('auto-messages rotate rather than repeating one', () => {
  const runtime = createRuntime();
  const list = [
    { id: 'a', text: 'one', intervalSec: 60, minChatLines: 0, enabled: true },
    { id: 'b', text: 'two', intervalSec: 60, minChatLines: 0, enabled: true },
  ];
  assert.equal(dueAutoMessage(list, runtime, { now: T0 }).id, 'a');
  markAutoSent(runtime, list, T0);
  assert.equal(dueAutoMessage(list, runtime, { now: T0 + 61000 }).id, 'b');
  markAutoSent(runtime, list, T0 + 61000);
  assert.equal(dueAutoMessage(list, runtime, { now: T0 + 122000 }).id, 'a', 'wraps around');
});

test('disabled auto-messages are skipped entirely', () => {
  assert.equal(dueAutoMessage([{ id: 'x', text: 'hi', enabled: false }], createRuntime(), { now: T0 }), null);
  assert.equal(dueAutoMessage([{ id: 'y', text: '   ', enabled: true }], createRuntime(), { now: T0 }), null);
});
