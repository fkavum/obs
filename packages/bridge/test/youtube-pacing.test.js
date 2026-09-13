import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeInterval, intervalDetail, refreshMsFrom, DEFAULT_REFRESH_SECONDS, LOW_WATER } from '../src/adapters/youtube/index.js';

const BUDGET = 9500;
// A fresh day: full budget, many hours until reset.
const fresh = { remainingUnits: BUDGET, budgetUnits: BUDGET, hoursLeft: 20 };

test('default is 10 seconds', () => {
  assert.equal(DEFAULT_REFRESH_SECONDS, 10);
});

test('"10 means 10": the configured rate is honoured exactly while budget is healthy', () => {
  assert.deepEqual(intervalDetail({ refreshMs: 10000, ...fresh }), { ms: 10000, reason: 'as configured' });
  assert.equal(computeInterval({ refreshMs: 5000, ...fresh }), 5000);
});

test('no back-off of our own for quiet chat - YouTube adjusts its minimum itself', () => {
  // The old quiet-chat factor made 10s become 15s after one empty poll. Gone.
  assert.equal(computeInterval({ refreshMs: 10000, idleStreak: 1, ...fresh }), 10000);
  assert.equal(computeInterval({ refreshMs: 10000, idleStreak: 6, ...fresh }), 10000);
});

test('does NOT throttle a morning stream on the assumption it will run all day', () => {
  const morning = computeInterval({ refreshMs: 10000, remainingUnits: BUDGET, budgetUnits: BUDGET, hoursLeft: 16 });
  assert.equal(morning, 10000);
});

test("YouTube's own minimum can raise the interval, and says so", () => {
  assert.deepEqual(intervalDetail({ refreshMs: 10000, apiMinMs: 15000, ...fresh }), { ms: 15000, reason: "YouTube's minimum" });
  assert.deepEqual(intervalDetail({ refreshMs: 10000, apiMinMs: 8000, ...fresh }), { ms: 10000, reason: 'as configured' }, 'a lower minimum changes nothing');
});

test('keeps the requested rate right down to the low-water mark', () => {
  const justAbove = intervalDetail({ refreshMs: 10000, remainingUnits: BUDGET * LOW_WATER + 1, budgetUnits: BUDGET, hoursLeft: 10 });
  assert.deepEqual(justAbove, { ms: 10000, reason: 'as configured' });
});

test('below low water it stretches the remainder over the hours left, and says so', () => {
  // 500 units = 100 polls left, 10 hours to go -> one poll per 6 minutes to survive.
  const tight = intervalDetail({ refreshMs: 10000, remainingUnits: 500, budgetUnits: BUDGET, hoursLeft: 10 });
  assert.equal(tight.ms, 60000, 'capped at a minute so chat is never abandoned');
  assert.equal(tight.reason, 'saving quota');

  // 2000 units = 400 polls, 2 hours to go -> 18s is enough; that is what it should pick.
  assert.deepEqual(intervalDetail({ refreshMs: 10000, remainingUnits: 2000, budgetUnits: BUDGET, hoursLeft: 2 }), { ms: 18000, reason: 'saving quota' });
});

test('low water only ever slows down, never below what YouTube or the operator asked', () => {
  // Plenty of budget for the hours left even though we're under low water.
  assert.deepEqual(intervalDetail({ refreshMs: 10000, remainingUnits: 2000, budgetUnits: BUDGET, hoursLeft: 0.5 }), { ms: 10000, reason: 'as configured' });
});

test('a slower configured rate raises the one-minute cap', () => {
  assert.equal(computeInterval({ refreshMs: 120000, ...fresh }), 120000);
  assert.equal(computeInterval({ refreshMs: 120000, remainingUnits: 100, budgetUnits: BUDGET, hoursLeft: 10 }), 120000);
});

test('exhausted quota backs off for half an hour, and says so', () => {
  assert.deepEqual(intervalDetail({ refreshMs: 10000, remainingUnits: 0, budgetUnits: BUDGET, hoursLeft: 5 }), { ms: 30 * 60 * 1000, reason: 'quota used up for today' });
});

test('refreshSeconds from config is clamped, and junk falls back to the default', () => {
  assert.equal(refreshMsFrom({ refreshSeconds: 10 }), 10000);
  assert.equal(refreshMsFrom({ refreshSeconds: 20 }), 20000);
  assert.equal(refreshMsFrom({ refreshSeconds: 1 }), 3000, 'too fast is raised to the floor');
  assert.equal(refreshMsFrom({ refreshSeconds: 9999 }), 300000, 'too slow is capped');
  assert.equal(refreshMsFrom({ refreshSeconds: 'abc' }), 10000, 'text falls back');
  assert.equal(refreshMsFrom({ refreshSeconds: -5 }), 10000, 'negative falls back');
  assert.equal(refreshMsFrom({}), 10000, 'missing falls back');
  assert.equal(refreshMsFrom(), 10000);
});
