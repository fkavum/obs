import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTimer, apply, display, formatClock, parseClock } from '#core/timer-model.js';

const T0 = 1_000_000;
const mins = (n) => n * 60 * 1000;

test('a fresh timer sits stopped at its full duration', () => {
  const t = createTimer({ durationMs: mins(5), label: 'Starting soon' });
  assert.equal(t.status, 'stopped');
  assert.equal(display(t, T0).text, '5:00');
  assert.equal(display(t, T0).label, 'Starting soon');
});

test('a running countdown is computed from timestamps, not ticked', () => {
  // This is why an OBS source refreshed mid-countdown lands in the right place.
  const t = apply(createTimer({ durationMs: mins(5) }), { type: 'start' }, T0);
  assert.equal(display(t, T0).text, '5:00');
  assert.equal(display(t, T0 + 1000).text, '4:59');
  assert.equal(display(t, T0 + mins(2) + 30000).text, '2:30');
  assert.equal(display(t, T0 + mins(5)).ms, 0);
});

test('pause freezes the clock and resume carries on from there', () => {
  let t = apply(createTimer({ durationMs: mins(5) }), { type: 'start' }, T0);
  t = apply(t, { type: 'pause' }, T0 + mins(1));
  assert.equal(t.status, 'paused');
  assert.equal(display(t, T0 + mins(1)).text, '4:00');
  assert.equal(display(t, T0 + mins(9)).text, '4:00', 'paused time does not pass');
  t = apply(t, { type: 'resume' }, T0 + mins(9));
  assert.equal(display(t, T0 + mins(9)).text, '4:00');
  assert.equal(display(t, T0 + mins(10)).text, '3:00', 'and continues from where it stopped');
});

test('pausing something already stopped changes nothing', () => {
  const t = createTimer();
  assert.equal(apply(t, { type: 'pause' }, T0), t, 'same object: no needless broadcast');
  assert.equal(apply(t, { type: 'resume' }, T0), t);
});

test('reset goes back to the full duration', () => {
  let t = apply(createTimer({ durationMs: mins(5) }), { type: 'start' }, T0);
  t = apply(t, { type: 'reset' }, T0 + mins(3));
  assert.equal(t.status, 'stopped');
  assert.equal(display(t, T0 + mins(3)).text, '5:00');
});

test('time can be added or removed while it runs', () => {
  let t = apply(createTimer({ durationMs: mins(5) }), { type: 'start' }, T0);
  t = apply(t, { type: 'add', deltaMs: mins(1) }, T0 + mins(1));
  assert.equal(display(t, T0 + mins(1)).text, '5:00', '4:00 left plus a minute');
  t = apply(t, { type: 'add', deltaMs: -mins(2) }, T0 + mins(1));
  assert.equal(display(t, T0 + mins(1)).text, '3:00');
  // Removing more than remains lands on zero rather than going negative.
  t = apply(t, { type: 'add', deltaMs: -mins(99) }, T0 + mins(1));
  assert.equal(display(t, T0 + mins(1)).ms, 0);
});

test('what happens at zero is configurable', () => {
  const start = (atZero) => apply(apply(createTimer({ durationMs: mins(1) }), { type: 'configure', atZero }, T0), { type: 'start' }, T0);
  const at = T0 + mins(1) + 5000; // five seconds past zero

  assert.equal(display(start('stop'), at).text, '0:00');
  assert.equal(display(start('hide'), at).hidden, true);

  const msg = apply(start('message'), { type: 'configure', doneText: 'Back soon!' }, T0);
  assert.equal(display(msg, at).text, 'Back soon!');

  const up = display(start('countup'), at);
  assert.equal(up.text, '+0:05', 'counts past zero so you can see how late you are');
  assert.equal(up.finished, true);
});

test('count-up mode counts from zero and survives a pause', () => {
  let t = apply(createTimer({ mode: 'countup' }), { type: 'start' }, T0);
  assert.equal(display(t, T0 + 65000).text, '1:05');
  t = apply(t, { type: 'pause' }, T0 + 65000);
  assert.equal(display(t, T0 + mins(10)).text, '1:05');
  t = apply(t, { type: 'resume' }, T0 + mins(10));
  assert.equal(display(t, T0 + mins(11)).text, '2:05');
});

test('changing the duration while idle moves the display too', () => {
  let t = createTimer({ durationMs: mins(5) });
  t = apply(t, { type: 'configure', durationMs: mins(2) }, T0);
  assert.equal(display(t, T0).text, '2:00');
  // ...but must not disturb a running countdown.
  let r = apply(createTimer({ durationMs: mins(5) }), { type: 'start' }, T0);
  r = apply(r, { type: 'configure', durationMs: mins(2) }, T0 + 1000);
  assert.equal(display(r, T0 + 1000).text, '4:59');
});

test('durations are clamped to something sane', () => {
  const t = apply(createTimer(), { type: 'configure', durationMs: -5 }, T0);
  assert.equal(t.durationMs, 0);
  assert.equal(apply(createTimer(), { type: 'configure', durationMs: 99 * 3600 * 1000 }, T0).durationMs, 24 * 3600 * 1000);
});

test('clock formatting and parsing round-trip', () => {
  assert.equal(formatClock(0), '0:00');
  assert.equal(formatClock(65000), '1:05');
  assert.equal(formatClock(3665000), '1:01:05');
  assert.equal(parseClock('5:00'), mins(5));
  assert.equal(parseClock('90'), 90000);
  assert.equal(parseClock('1:30:00'), mins(90));
  assert.equal(parseClock('nonsense'), null);
  assert.equal(parseClock('-5'), null);
  assert.equal(formatClock(parseClock('12:34')), '12:34');
});

test('an unknown action is ignored rather than corrupting the state', () => {
  const t = createTimer();
  assert.equal(apply(t, { type: 'explode' }, T0), t);
});
