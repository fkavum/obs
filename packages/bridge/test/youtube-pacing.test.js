import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeInterval, refreshMsFrom, DEFAULT_REFRESH_SECONDS, LOW_WATER } from '../src/adapters/youtube/index.js';

const BUDGET = 9500;
// A fresh day: full budget, many hours until reset.
const fresh = { remainingUnits: BUDGET, budgetUnits: BUDGET, hoursLeft: 20 };

test('default is 10 seconds', () => {
  assert.equal(DEFAULT_REFRESH_SECONDS, 10);
});

test('honours the configured rate on a fresh day', () => {
  assert.equal(computeInterval({ refreshMs: 10000, ...fresh }), 10000);
  assert.equal(computeInterval({ refreshMs: 5000, ...fresh }), 5000);
});

test('does NOT throttle a morning stream on the assumption it will run all day', () => {
  // This was the original bug: spreading the budget over 16 remaining hours
  // produced ~38s intervals from the first poll of the day.
  const morning = computeInterval({ refreshMs: 10000, remainingUnits: BUDGET, budgetUnits: BUDGET, hoursLeft: 16 });
  assert.equal(morning, 10000);
});

test("never polls faster than YouTube's own minimum", () => {
  assert.equal(computeInterval({ refreshMs: 5000, apiMinMs: 8000, ...fresh }), 8000, 'API minimum raises it');
  assert.equal(computeInterval({ refreshMs: 10000, apiMinMs: 8000, ...fresh }), 10000, 'but never lowers it');
});

test('quiet chat is checked less often, up to 4x', () => {
  assert.equal(computeInterval({ refreshMs: 10000, idleStreak: 2, ...fresh }), 20000);
  assert.equal(computeInterval({ refreshMs: 10000, idleStreak: 6, ...fresh }), 40000);
  assert.equal(computeInterval({ refreshMs: 10000, idleStreak: 50, ...fresh }), 40000, 'backoff is capped');
});

test('keeps the requested rate right down to the low-water mark', () => {
  const justAbove = computeInterval({ refreshMs: 10000, remainingUnits: BUDGET * LOW_WATER + 1, budgetUnits: BUDGET, hoursLeft: 10 });
  assert.equal(justAbove, 10000);
});

test('below low water it stretches the remainder over the hours left', () => {
  // 500 units = 100 polls left, 10 hours to go -> one poll per 6 minutes to survive.
  const tight = computeInterval({ refreshMs: 10000, remainingUnits: 500, budgetUnits: BUDGET, hoursLeft: 10 });
  assert.ok(tight > 10000, 'slower than asked');
  assert.equal(tight, 60000, 'but capped at a minute so chat is never abandoned');

  // 2000 units = 400 polls, 2 hours to go -> 18s is enough; that is what it should pick.
  const mild = computeInterval({ refreshMs: 10000, remainingUnits: 2000, budgetUnits: BUDGET, hoursLeft: 2 });
  assert.equal(mild, 18000);
});

test('a slower configured rate raises the one-minute cap', () => {
  assert.equal(computeInterval({ refreshMs: 120000, ...fresh }), 120000);
  assert.equal(computeInterval({ refreshMs: 120000, remainingUnits: 100, budgetUnits: BUDGET, hoursLeft: 10 }), 120000);
});

test('exhausted quota backs off for half an hour', () => {
  assert.equal(computeInterval({ refreshMs: 10000, remainingUnits: 0, budgetUnits: BUDGET, hoursLeft: 5 }), 30 * 60 * 1000);
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
