import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHealthState, addSample, readings, assess, formatBitrate, DEFAULT_THRESHOLDS } from '#core/health-model.js';

/** Build a sample with sensible defaults; counters are cumulative like OBS's. */
const sample = (at, o = {}) => ({
  at,
  stats: {
    cpuUsage: o.cpu ?? 20, activeFps: o.fps ?? 60,
    renderSkippedFrames: o.renderSkipped ?? 0, renderTotalFrames: o.renderTotal ?? 0,
    outputSkippedFrames: o.encodeSkipped ?? 0, outputTotalFrames: o.encodeTotal ?? 0,
  },
  stream: {
    outputActive: o.streaming ?? true, outputReconnecting: o.reconnecting ?? false,
    outputCongestion: o.congestion ?? 0, outputBytes: o.bytes ?? 0,
    outputSkippedFrames: o.dropped ?? 0, outputTotalFrames: o.delivered ?? 0,
  },
});

test('nothing to report before any sample arrives', () => {
  const s = createHealthState();
  assert.equal(readings(s), null);
  assert.deepEqual(assess(s), { level: 'ok', issues: [], readings: null, streaming: false });
});

test('rates are measured over the recent window, not since the stream began', () => {
  // The whole point: 500 frames were lost an hour ago, none since. Lifetime says
  // 5% and screams; the last 15 seconds are clean and should say so.
  const s = createHealthState({ windowMs: 15000 });
  addSample(s, sample(0, { dropped: 500, delivered: 10000 }));
  addSample(s, sample(10000, { dropped: 500, delivered: 10600 }));
  addSample(s, sample(20000, { dropped: 500, delivered: 11200 }));
  const r = readings(s, 20000);
  assert.equal(r.droppedPct, 0, 'no frames lost inside the window');
  assert.equal(r.droppedTotal, 500, 'lifetime total still available as context');
  assert.equal(assess(s, {}, 20000).level, 'ok');
});

test('a problem happening right now is caught even with a clean history', () => {
  const s = createHealthState({ windowMs: 15000 });
  addSample(s, sample(0, { dropped: 0, delivered: 100000 }));
  addSample(s, sample(10000, { dropped: 0, delivered: 100600 }));
  addSample(s, sample(20000, { dropped: 60, delivered: 101200 }));
  const v = assess(s, {}, 20000);
  assert.equal(v.level, 'bad');
  assert.equal(v.issues[0].key, 'dropped');
  // The window reaches back past the cutoff so a rate can always be computed:
  // 60 frames lost out of the 1200 delivered since then.
  assert.match(v.issues[0].title, /5\.0%/);
  assert.match(v.issues[0].advice, /bitrate/i, 'says what to do, not just what is wrong');
});

test('falls back to lifetime figures until the window has data', () => {
  const s = createHealthState();
  addSample(s, sample(0, { dropped: 10, delivered: 100 }));
  assert.equal(readings(s, 0).droppedPct, 10);
});

test('bitrate comes from the byte delta over elapsed time', () => {
  const s = createHealthState({ windowMs: 15000 });
  addSample(s, sample(0, { bytes: 0 }));
  addSample(s, sample(10000, { bytes: 7500000 })); // 7.5 MB in 10s = 6000 kbps
  assert.equal(readings(s, 10000).kbps, 6000);
  assert.equal(formatBitrate(6000), '6.0 Mbps');
  assert.equal(formatBitrate(850), '850 kbps');
  assert.equal(formatBitrate(0), '0 kbps');
});

test('each kind of trouble is reported separately, worst first', () => {
  const s = createHealthState({ windowMs: 15000 });
  addSample(s, sample(0, {}));
  addSample(s, sample(10000, {
    encodeSkipped: 60, encodeTotal: 600,   // 10% - bad
    renderSkipped: 12, renderTotal: 600,   // 2%  - warn
    cpu: 95,                               // bad
  }));
  const v = assess(s, {}, 10000);
  assert.equal(v.level, 'bad');
  const keys = v.issues.map((i) => i.key);
  assert.ok(keys.includes('encode') && keys.includes('render') && keys.includes('cpu'));
  assert.equal(v.issues[0].level, 'bad', 'worst first');
  assert.ok(v.issues.at(-1).level === 'warn');
});

test('reconnecting is always an alarm', () => {
  const s = createHealthState();
  addSample(s, sample(0, { reconnecting: true }));
  const v = assess(s);
  assert.equal(v.level, 'bad');
  assert.equal(v.issues[0].key, 'reconnecting');
});

test('thresholds are configurable and defaults are sane', () => {
  const s = createHealthState({ windowMs: 15000 });
  addSample(s, sample(0, {}));
  addSample(s, sample(10000, { dropped: 18, delivered: 600 })); // 3%
  assert.equal(assess(s, {}, 10000).level, 'warn', 'default: 3% is a warning');
  assert.equal(assess(s, { droppedBad: 2 }, 10000).level, 'bad', 'stricter alarm threshold');
  assert.equal(assess(s, { droppedWarn: 10 }, 10000).level, 'ok', 'looser warn threshold');
  assert.ok(DEFAULT_THRESHOLDS.droppedWarn < DEFAULT_THRESHOLDS.droppedBad);
});

test('fps shortfall is only judged when the target frame rate is known', () => {
  const s = createHealthState({ windowMs: 15000 });
  addSample(s, sample(0, { fps: 30 }));
  assert.equal(assess(s).issues.length, 0, 'no target: no complaint');
  s.targetFps = 60;
  const v = assess(s);
  assert.equal(v.issues[0].key, 'fps');
  assert.match(v.issues[0].title, /30 fps of 60/);
});

test('old samples are dropped so memory cannot grow over an 8-hour stream', () => {
  const s = createHealthState({ windowMs: 15000 });
  for (let i = 0; i <= 2000; i++) addSample(s, sample(i * 2000));
  assert.ok(s.samples.length < 25, `kept ${s.samples.length} samples`);
});
