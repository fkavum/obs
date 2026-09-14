/**
 * The countdown / count-up timer, as a pure state machine.
 *
 * State holds ABSOLUTE timestamps rather than a ticking number, for two reasons:
 * the overlay can tick smoothly on its own without the bridge broadcasting every
 * second, and an OBS source that gets refreshed mid-countdown picks up exactly
 * where it should be instead of restarting.
 *
 * No DOM, no timers: apply actions, then ask what to display.
 */

export const TIMER_MODES = ['countdown', 'countup'];
export const AT_ZERO = ['stop', 'message', 'countup', 'hide'];

export function createTimer({ durationMs = 5 * 60 * 1000, label = 'Starting soon', mode = 'countdown' } = {}) {
  return {
    mode,
    status: 'stopped',      // stopped | running | paused
    label,
    durationMs,             // what a reset goes back to
    endsAt: null,           // countdown, running: when it reaches zero
    startedAt: null,        // countup, running: when it began
    frozenMs: durationMs,   // the value while stopped or paused
    atZero: 'stop',
    doneText: "We'll be right back",
    updatedAt: 0,
  };
}

/**
 * Apply one action. Returns a NEW state; never mutates the old one.
 * @param {object} state
 * @param {{type: string, [k: string]: any}} action
 * @param {number} now
 */
export function apply(state, action, now = Date.now()) {
  const s = { ...state, updatedAt: now };

  switch (action.type) {
    case 'start':
      // Starting always begins a fresh run from the configured duration.
      if (s.mode === 'countdown') {
        s.endsAt = now + s.durationMs;
        s.frozenMs = s.durationMs;
      } else {
        s.startedAt = now;
        s.frozenMs = 0;
      }
      s.status = 'running';
      return s;

    case 'pause': {
      if (s.status !== 'running') return state;
      s.frozenMs = rawValue(state, now);
      s.status = 'paused';
      s.endsAt = null;
      s.startedAt = null;
      return s;
    }

    case 'resume': {
      if (s.status !== 'paused') return state;
      if (s.mode === 'countdown') s.endsAt = now + Math.max(0, s.frozenMs);
      else s.startedAt = now - Math.max(0, s.frozenMs);
      s.status = 'running';
      return s;
    }

    case 'reset':
      s.status = 'stopped';
      s.endsAt = null;
      s.startedAt = null;
      s.frozenMs = s.mode === 'countdown' ? s.durationMs : 0;
      return s;

    case 'add': {
      // Add or subtract time while it runs - the "+1 min" button.
      const deltaMs = Number(action.deltaMs) || 0;
      if (s.mode !== 'countdown') return state;
      if (s.status === 'running') s.endsAt = Math.max(now, (s.endsAt ?? now) + deltaMs);
      else s.frozenMs = Math.max(0, s.frozenMs + deltaMs);
      return s;
    }

    case 'configure': {
      const next = { ...s };
      if (TIMER_MODES.includes(action.mode)) next.mode = action.mode;
      if (typeof action.label === 'string') next.label = action.label.slice(0, 80);
      if (typeof action.doneText === 'string') next.doneText = action.doneText.slice(0, 120);
      if (AT_ZERO.includes(action.atZero)) next.atZero = action.atZero;
      if (Number.isFinite(Number(action.durationMs))) {
        next.durationMs = Math.max(0, Math.min(24 * 3600 * 1000, Number(action.durationMs)));
        // Changing the duration while idle should move the displayed number too.
        if (next.status === 'stopped') next.frozenMs = next.mode === 'countdown' ? next.durationMs : 0;
      }
      if (next.mode !== s.mode && next.status === 'stopped') {
        next.frozenMs = next.mode === 'countdown' ? next.durationMs : 0;
      }
      return next;
    }

    default:
      return state;
  }
}

/** Milliseconds on the clock, ignoring what happens at zero. */
function rawValue(state, now) {
  if (state.status === 'running') {
    return state.mode === 'countdown'
      ? Math.max(0, (state.endsAt ?? now) - now)
      : Math.max(0, now - (state.startedAt ?? now));
  }
  return Math.max(0, state.frozenMs);
}

/**
 * What to put on screen.
 * @returns {{ text: string, ms: number, finished: boolean, hidden: boolean, label: string }}
 */
export function display(state, now = Date.now()) {
  const ms = rawValue(state, now);
  const finished = state.mode === 'countdown' && state.status === 'running' && ms <= 0;

  if (finished) {
    if (state.atZero === 'hide') return { text: '', ms: 0, finished: true, hidden: true, label: state.label };
    if (state.atZero === 'message') return { text: state.doneText, ms: 0, finished: true, hidden: false, label: state.label };
    if (state.atZero === 'countup') {
      const over = Math.max(0, now - (state.endsAt ?? now));
      return { text: `+${formatClock(over)}`, ms: over, finished: true, hidden: false, label: state.label };
    }
  }
  return { text: formatClock(ms), ms, finished, hidden: false, label: state.label };
}

/** 65000 -> "1:05"; 3665000 -> "1:01:05"; always at least m:ss. */
export function formatClock(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0');
  const ss = String(sec).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** "5:00" or "90" or "1:30:00" -> milliseconds. For the duration box. */
export function parseClock(text) {
  const parts = String(text).trim().split(':').map((p) => Number(p));
  if (parts.some((n) => !Number.isFinite(n) || n < 0)) return null;
  if (parts.length === 1) return parts[0] * 1000;
  if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000;
  if (parts.length === 3) return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
  return null;
}
