/**
 * Stream health, as a pure function of OBS's own counters.
 *
 * The one thing that matters here: OBS's counters are CUMULATIVE since the
 * stream started. A lifetime "2% dropped" tells you nothing about right now -
 * you could have lost 500 frames an hour ago and be perfectly fine since. So
 * everything below is computed from the DIFFERENCE between samples over a short
 * window, which is what the streamer actually needs to know.
 *
 * No DOM, no timers: feed it samples and ask it how things are.
 */

export const LEVELS = { ok: 0, warn: 1, bad: 2 };

/** Defaults chosen to warn before the viewer notices, not after. */
export const DEFAULT_THRESHOLDS = {
  droppedWarn: 1, droppedBad: 5,        // % of frames lost to the network
  renderWarn: 1, renderBad: 5,          // % of frames the GPU couldn't draw
  encodeWarn: 1, encodeBad: 5,          // % of frames the encoder couldn't keep up with
  cpuWarn: 80, cpuBad: 92,              // % CPU used by OBS
  congestionWarn: 0.3, congestionBad: 0.7,
  fpsDropWarn: 10, fpsDropBad: 25,      // % below the configured frame rate
};

export function createHealthState({ windowMs = 15000 } = {}) {
  return { samples: [], windowMs, targetFps: null };
}

/**
 * Record one poll. `stats` is GetStats, `stream` is GetStreamStatus.
 * Returns the state for convenience.
 */
export function addSample(state, { stats = {}, stream = {}, at = Date.now() }) {
  state.samples.push({
    at,
    cpu: num(stats.cpuUsage),
    fps: num(stats.activeFps),
    renderSkipped: num(stats.renderSkippedFrames),
    renderTotal: num(stats.renderTotalFrames),
    encodeSkipped: num(stats.outputSkippedFrames),
    encodeTotal: num(stats.outputTotalFrames),
    streaming: !!stream.outputActive,
    reconnecting: !!stream.outputReconnecting,
    congestion: num(stream.outputCongestion),
    bytes: num(stream.outputBytes),
    dropped: num(stream.outputSkippedFrames),
    delivered: num(stream.outputTotalFrames),
    durationMs: num(stream.outputDuration),
  });
  // Keep a little more than the window so a rate can always be computed.
  const cutoff = at - state.windowMs * 2;
  while (state.samples.length > 2 && state.samples[0].at < cutoff) state.samples.shift();
  return state;
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const pct = (part, whole) => (whole > 0 ? Math.max(0, Math.min(100, (part / whole) * 100)) : 0);

/** The oldest sample still inside the window, for rate calculations. */
function windowStart(state, now) {
  const cutoff = now - state.windowMs;
  for (let i = state.samples.length - 1; i >= 0; i--) if (state.samples[i].at <= cutoff) return state.samples[i];
  return state.samples[0];
}

/**
 * Current readings. Rates are over the recent window, not since the stream began.
 * @returns {null|object} null until there is anything to report.
 */
export function readings(state, now = Date.now()) {
  const latest = state.samples.at(-1);
  if (!latest) return null;
  const first = windowStart(state, now);
  const spanMs = Math.max(0, latest.at - first.at);
  const d = (key) => Math.max(0, latest[key] - first[key]);

  const deliveredDelta = d('delivered');
  const renderDelta = d('renderTotal');
  const encodeDelta = d('encodeTotal');

  return {
    streaming: latest.streaming,
    reconnecting: latest.reconnecting,
    cpu: latest.cpu,
    fps: latest.fps,
    congestion: latest.congestion,
    durationMs: latest.durationMs,
    // Rates over the window; fall back to lifetime when the window has no frames yet.
    droppedPct: deliveredDelta > 0 ? pct(d('dropped'), deliveredDelta) : pct(latest.dropped, latest.delivered),
    renderPct: renderDelta > 0 ? pct(d('renderSkipped'), renderDelta) : pct(latest.renderSkipped, latest.renderTotal),
    encodePct: encodeDelta > 0 ? pct(d('encodeSkipped'), encodeDelta) : pct(latest.encodeSkipped, latest.encodeTotal),
    kbps: spanMs > 0 ? Math.round((d('bytes') * 8) / (spanMs / 1000) / 1000) : 0,
    // Lifetime totals, useful as context.
    droppedTotal: latest.dropped,
    windowMs: spanMs,
  };
}

/**
 * Turn readings into a verdict plus plain-words issues. Each issue says what is
 * wrong AND what to do about it - a warning you can't act on is just noise.
 */
export function assess(state, settings = {}, now = Date.now()) {
  const r = readings(state, now);
  if (!r) return { level: 'ok', issues: [], readings: null, streaming: false };

  const t = { ...DEFAULT_THRESHOLDS, ...settings };
  const issues = [];
  const add = (level, key, title, advice) => issues.push({ level, key, title, advice });

  if (r.reconnecting) {
    add('bad', 'reconnecting', 'Reconnecting to the platform', 'Your connection dropped. OBS is trying to get back on.');
  }

  if (r.droppedPct >= t.droppedBad) {
    add('bad', 'dropped', `Losing frames — ${r.droppedPct.toFixed(1)}% right now`, 'Your upload can’t keep up. Lower the bitrate in OBS, or stop other uploads on your network.');
  } else if (r.droppedPct >= t.droppedWarn) {
    add('warn', 'dropped', `Dropping a few frames — ${r.droppedPct.toFixed(1)}%`, 'Your connection is struggling slightly. Worth watching.');
  }

  if (r.encodePct >= t.encodeBad) {
    add('bad', 'encode', `Encoder overloaded — ${r.encodePct.toFixed(1)}%`, 'Your computer can’t encode fast enough. Lower the output resolution, drop to 30fps, or use a faster encoder preset.');
  } else if (r.encodePct >= t.encodeWarn) {
    add('warn', 'encode', `Encoder is behind — ${r.encodePct.toFixed(1)}%`, 'Close something heavy, or use a faster encoder preset.');
  }

  if (r.renderPct >= t.renderBad) {
    add('bad', 'render', `Graphics lagging — ${r.renderPct.toFixed(1)}%`, 'Your GPU is overloaded. Lower the game’s settings or OBS’s canvas resolution.');
  } else if (r.renderPct >= t.renderWarn) {
    add('warn', 'render', `Graphics slightly behind — ${r.renderPct.toFixed(1)}%`, 'The GPU is near its limit.');
  }

  if (r.congestion >= t.congestionBad) {
    add('bad', 'congestion', 'Network congested', 'The connection to the platform is backing up. Lower your bitrate.');
  } else if (r.congestion >= t.congestionWarn) {
    add('warn', 'congestion', 'Network getting congested', 'Keep an eye on it.');
  }

  if (r.cpu >= t.cpuBad) {
    add('bad', 'cpu', `CPU at ${Math.round(r.cpu)}%`, 'Close other programs, or OBS will start skipping frames.');
  } else if (r.cpu >= t.cpuWarn) {
    add('warn', 'cpu', `CPU at ${Math.round(r.cpu)}%`, 'Getting busy.');
  }

  if (state.targetFps > 0 && r.fps > 0) {
    const shortfall = pct(state.targetFps - r.fps, state.targetFps);
    if (shortfall >= t.fpsDropBad) add('bad', 'fps', `Only ${r.fps.toFixed(0)} fps of ${state.targetFps}`, 'OBS can’t keep up with its own frame rate.');
    else if (shortfall >= t.fpsDropWarn) add('warn', 'fps', `${r.fps.toFixed(0)} fps of ${state.targetFps}`, 'Slightly below target.');
  }

  const level = issues.reduce((worst, i) => (LEVELS[i.level] > LEVELS[worst] ? i.level : worst), 'ok');
  // Sort worst-first so a small display can show the most important one.
  issues.sort((a, b) => LEVELS[b.level] - LEVELS[a.level]);
  return { level, issues, readings: r, streaming: r.streaming };
}

export function formatBitrate(kbps) {
  if (!kbps) return '0 kbps';
  return kbps >= 1000 ? `${(kbps / 1000).toFixed(1)} Mbps` : `${Math.round(kbps)} kbps`;
}
