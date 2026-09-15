import test from 'node:test';
import assert from 'node:assert/strict';
import { createToastQueue, DEFAULTS } from '../shared/toasts.js';

const fed = (owner) => ({ kind: 'pet', event: 'fed', owner, pet: { name: 'X', level: 2 } });
const evolved = (owner) => ({ kind: 'pet', event: 'evolved', owner, pet: { name: 'X', level: 25 } });
const levelled = (owner) => ({ kind: 'pet', event: 'levelled', owner, pet: { name: 'X', level: 4 } });

test('quiet mode is on by default', () => {
  assert.equal(DEFAULTS.quiet, true);
});

test('quiet mode drops the ordinary and keeps the moments', () => {
  const q = createToastQueue({ quiet: true });
  assert.equal(q.offer(fed('ann'), 0), 'dropped');
  assert.equal(q.offer({ kind: 'coins', name: 'ann' }, 0), 'dropped');
  assert.equal(q.offer(levelled('ann'), 0), 'queued');
  assert.equal(q.offer(evolved('bob'), 0), 'queued');
  assert.equal(q.offer({ kind: 'note', event: 'earned', text: 'x' }, 0), 'queued');
  assert.equal(q.depth().pending, 3);
});

test('with quiet off, everything is admitted until the cooldown bites', () => {
  const q = createToastQueue({ quiet: false, cooldownMs: 60000 });
  assert.equal(q.offer(fed('ann'), 0), 'queued');
  q.tick(0);
  assert.equal(q.offer(fed('ann'), 30000), 'dropped', 'same person, inside the minute');
  assert.equal(q.offer(fed('bob'), 30000), 'queued', 'somebody else is fine');
  assert.equal(q.offer(fed('ann'), 61000), 'queued', 'and after the minute, ann again');
});

test('the cooldown never blocks a moment', () => {
  const q = createToastQueue({ quiet: false, cooldownMs: 60000 });
  q.offer(fed('ann'), 0);
  q.tick(0);
  assert.equal(q.offer(fed('ann'), 1000), 'dropped');
  assert.equal(q.offer(evolved('ann'), 1000), 'queued', 'an evolution always gets through');
});

test('one card at a time, held for the configured time', () => {
  const q = createToastQueue({ quiet: false, holdMs: 6000 });
  q.offer(fed('ann'), 0);
  q.offer(fed('bob'), 0);

  const first = q.tick(0);
  assert.equal(first.card.owner, 'ann');
  assert.equal(q.tick(3000).card.owner, 'ann', 'still ann mid-hold');
  assert.equal(q.depth().pending, 1, 'bob is waiting, not shown');
  assert.equal(q.tick(6000).card.owner, 'bob');
  assert.equal(q.tick(12000), null, 'and then nothing');
});

test('an evolution gets its own six seconds', () => {
  const q = createToastQueue({ quiet: false, holdMs: 2000, evolveMs: 6000 });
  q.offer(evolved('ann'), 0);
  const shown = q.tick(0);
  assert.equal(shown.until, 6000);
  assert.equal(q.tick(3000).card.owner, 'ann', 'not cut short by the normal hold');
  assert.equal(q.tick(6000), null);
});

test('past the queue depth the rest collapse into one line', () => {
  const q = createToastQueue({ quiet: false, depth: 5, cooldownMs: 0 });
  for (let i = 0; i < 5; i++) assert.equal(q.offer(fed(`v${i}`), 0), 'queued');
  for (let i = 5; i < 17; i++) assert.equal(q.offer(fed(`v${i}`), 0), 'collapsed');
  assert.deepEqual(q.depth(), { pending: 5, collapsed: 12 });

  // Drain the five that got a slot...
  let t = 0;
  for (let i = 0; i < 5; i++) {
    const shown = q.tick(t);
    assert.equal(shown.card.owner, `v${i}`);
    t += DEFAULTS.holdMs;
  }
  // ...then the collapsed ones arrive as a single line.
  const summary = q.tick(t);
  assert.equal(summary.card.kind, 'collapsed');
  assert.equal(summary.card.total, 12);
  assert.equal(summary.card.text, '…and 12 others fed their pets');
  assert.deepEqual(q.depth(), { pending: 0, collapsed: 0 }, 'said once, then cleared');
  assert.equal(q.tick(t + DEFAULTS.holdMs), null);
});

test('one collapsed card reads as one, not "1 others"', () => {
  const q = createToastQueue({ quiet: false, depth: 1, cooldownMs: 0 });
  q.offer(fed('ann'), 0);
  q.offer(fed('bob'), 0);
  q.tick(0);
  const summary = q.tick(DEFAULTS.holdMs);
  assert.equal(summary.card.text, '…and 1 other fed their pets');
});

test('a moment jumps the queue but keeps its place among other moments', () => {
  const q = createToastQueue({ quiet: false, depth: 10, cooldownMs: 0 });
  q.offer(fed('a'), 0);
  q.offer(fed('b'), 0);
  q.offer(evolved('c'), 0);
  q.offer(fed('d'), 0);
  q.offer(levelled('e'), 0);

  let t = 0;
  const order = [];
  for (let i = 0; i < 5; i++) {
    order.push(q.tick(t).card.owner);
    t += 7000;
  }
  assert.deepEqual(order, ['c', 'e', 'a', 'b', 'd'], 'moments first, each in arrival order');
});

test('a full queue still lets a moment in', () => {
  const q = createToastQueue({ quiet: false, depth: 3, cooldownMs: 0 });
  q.offer(fed('a'), 0);
  q.offer(fed('b'), 0);
  q.offer(fed('c'), 0);
  assert.equal(q.offer(fed('d'), 0), 'collapsed');
  assert.equal(q.offer(evolved('e'), 0), 'queued');
  assert.equal(q.tick(0).card.owner, 'e');
});

test('clear empties everything, including the cooldowns', () => {
  const q = createToastQueue({ quiet: false, cooldownMs: 60000 });
  q.offer(fed('ann'), 0);
  q.tick(0);
  q.offer(fed('bob'), 0);
  q.clear();
  assert.deepEqual(q.depth(), { pending: 0, collapsed: 0 });
  assert.equal(q.tick(1), null);
  assert.equal(q.offer(fed('ann'), 1), 'queued', 'ann is not still on cooldown');
});

test('nothing offered means nothing shown — an empty overlay, not an error', () => {
  const q = createToastQueue();
  assert.equal(q.tick(0), null);
  assert.equal(q.offer(null, 0), 'dropped');
  assert.equal(q.offer(undefined, 0), 'dropped');
  assert.equal(q.tick(999999), null);
});
