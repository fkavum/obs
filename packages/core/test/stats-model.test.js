import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createStatsState, applyEvent, livePlatforms, totalViewers, uptimeMs,
  formatCompact, formatUptime, goalProgress,
} from '#core/stats-model.js';

const ev = (type, platform, data = {}) => ({ id: 'x', type, platform, ts: 0, channel: 'c', user: null, data });

test('total viewers is the sum of each platform’s latest count', () => {
  const s = createStatsState();
  applyEvent(s, ev('viewers', 'twitch', { count: 800 }), 1000);
  applyEvent(s, ev('viewers', 'kick', { count: 300 }), 1000);
  applyEvent(s, ev('viewers', 'twitch', { count: 820 }), 2000); // newer replaces, not adds
  assert.equal(totalViewers(s, { now: 2000 }), 1120);
  assert.deepEqual(livePlatforms(s, { now: 2000 }).map((p) => p.id).sort(), ['kick', 'twitch']);
});

test('a platform that stops reporting drops out of the total', () => {
  const s = createStatsState();
  applyEvent(s, ev('viewers', 'twitch', { count: 800 }), 0);
  applyEvent(s, ev('viewers', 'kick', { count: 300 }), 100000);
  assert.equal(totalViewers(s, { now: 100000, staleMs: 90000 }), 300, 'twitch is 100s old, gone');
  assert.equal(totalViewers(s, { now: 100000, staleMs: 200000 }), 1100, 'with a longer window it counts');
});

test('the platform filter applies to totals', () => {
  const s = createStatsState();
  applyEvent(s, ev('viewers', 'twitch', { count: 800 }), 0);
  applyEvent(s, ev('viewers', 'kick', { count: 300 }), 0);
  assert.equal(totalViewers(s, { now: 0, only: ['kick'] }), 300);
});

test('uptime starts at the first live signal and resets when everything goes offline', () => {
  const s = createStatsState();
  assert.equal(uptimeMs(s, 5000), 0);
  applyEvent(s, ev('stream.state', 'twitch', { live: true }), 1000);
  applyEvent(s, ev('stream.state', 'kick', { live: true }), 3000);
  assert.equal(uptimeMs(s, 61000), 60000, 'counts from the first platform to go live');
  applyEvent(s, ev('stream.state', 'twitch', { live: false }), 70000);
  assert.equal(uptimeMs(s, 71000), 70000, 'still live on kick');
  applyEvent(s, ev('stream.state', 'kick', { live: false }), 80000);
  assert.equal(uptimeMs(s, 90000), 0, 'all offline: reset');
});

test('a viewer count counts as a live signal for platforms that never send one', () => {
  const s = createStatsState();
  applyEvent(s, ev('viewers', 'kick', { count: 12 }), 1000);
  assert.equal(uptimeMs(s, 2000), 1000);
});

test('session counters: follows, subs (gifts count each), raids, tips vs bits', () => {
  const s = createStatsState();
  applyEvent(s, ev('follow', 'twitch'));
  applyEvent(s, ev('follow', 'kick'));
  applyEvent(s, ev('subscription', 'twitch', { isGift: false }));
  applyEvent(s, ev('subscription', 'twitch', { isGift: true, giftCount: 5 }));
  applyEvent(s, ev('raid', 'twitch', { viewers: 40 }));
  applyEvent(s, ev('donation', 'twitch', { amount: 500, currency: 'bits' }));
  applyEvent(s, ev('donation', 'youtube', { amount: 10, currency: 'USD' }));
  applyEvent(s, ev('donation', 'youtube', { amount: 5.5, currency: 'USD' }));
  assert.equal(s.follows, 2);
  assert.equal(s.subs, 6);
  assert.equal(s.raids, 1);
  assert.equal(s.bits, 500);
  assert.equal(s.tips, 15.5);
  assert.equal(s.tipsCurrency, 'USD');
});

test('chat events change nothing', () => {
  const s = createStatsState();
  applyEvent(s, ev('chat', 'twitch', { text: 'hi' }));
  assert.deepEqual({ ...s, platforms: Object.keys(s.platforms) }, { ...createStatsState(), platforms: ['twitch'] });
});

test('compact numbers', () => {
  assert.equal(formatCompact(7), '7');
  assert.equal(formatCompact(999), '999');
  assert.equal(formatCompact(1234), '1.2K');
  assert.equal(formatCompact(12345), '12K');
  assert.equal(formatCompact(1500000), '1.5M');
});

test('uptime formatting', () => {
  assert.equal(formatUptime(0), '0:00');
  assert.equal(formatUptime(65000), '1:05');
  assert.equal(formatUptime(5025000), '1:23:45');
});

test('goal progress from a starting total, clamped to 100%', () => {
  const s = createStatsState();
  applyEvent(s, ev('follow', 'twitch'));
  applyEvent(s, ev('follow', 'twitch'));
  const g = goalProgress(s, { goalType: 'followers', goalTarget: 1200, goalStart: 1180 });
  assert.equal(g.value, 1182);
  assert.equal(g.label, 'Follower goal');
  assert.ok(Math.abs(g.pct - 98.5) < 0.01);
  const done = goalProgress(s, { goalType: 'followers', goalTarget: 1000, goalStart: 5000, goalLabel: 'Road to 1K' });
  assert.equal(done.pct, 100);
  assert.equal(done.label, 'Road to 1K');
  assert.equal(goalProgress(s, { goalType: 'none', goalTarget: 10 }), null);
  assert.equal(goalProgress(s, { goalType: 'subs', goalTarget: 0 }), null, 'no target, no bar');
});

test('viewer goals use the live total, ignoring goalStart', () => {
  const s = createStatsState();
  applyEvent(s, ev('viewers', 'twitch', { count: 250 }), 0);
  const g = goalProgress(s, { goalType: 'viewers', goalTarget: 500, goalStart: 999 }, { now: 0 });
  assert.equal(g.value, 250);
  assert.equal(g.pct, 50);
});
