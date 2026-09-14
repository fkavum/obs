/**
 * The numbers behind the stats bar, as a pure reducer over normalized events.
 * No DOM, no timers: feed it events and ask it questions, so every rule here is
 * testable and the overlay is just a renderer.
 */

export function createStatsState() {
  return {
    /** platform id -> { viewers, at, live } */
    platforms: {},
    /** when the first platform went live this session; null when none is live */
    liveSince: null,
    /** session counters, since the overlay opened */
    follows: 0,
    subs: 0,
    raids: 0,
    tips: 0,
    tipsCurrency: '',
    bits: 0,
  };
}

/** Apply one event. Mutates and returns `state` for convenience. */
export function applyEvent(state, event, now = Date.now()) {
  if (!event || !event.type) return state;
  const p = (state.platforms[event.platform] ||= { viewers: null, at: 0, live: false });
  const d = event.data || {};

  switch (event.type) {
    case 'viewers':
      p.viewers = Math.max(0, Number(d.count) || 0);
      p.at = now;
      // A viewer count is as good as a "live" signal from platforms that never send one.
      if (!p.live) p.live = true;
      if (state.liveSince === null) state.liveSince = now;
      break;

    case 'stream.state':
      p.live = !!d.live;
      if (p.live && state.liveSince === null) state.liveSince = now;
      if (!Object.values(state.platforms).some((x) => x.live)) state.liveSince = null;
      break;

    case 'follow':
      state.follows += 1;
      break;

    case 'subscription':
      state.subs += d.isGift ? Math.max(1, Number(d.giftCount) || 1) : 1;
      break;

    case 'donation':
      if (!d.currency || d.currency === 'bits') state.bits += Number(d.amount) || 0;
      else {
        state.tips += Number(d.amount) || 0;
        state.tipsCurrency = d.currency;
      }
      break;

    case 'raid':
      state.raids += 1;
      break;

    default:
  }
  return state;
}

/** Per-platform counts that are recent enough to trust, oldest-stale dropped. */
export function livePlatforms(state, { staleMs = 90000, now = Date.now(), only = [] } = {}) {
  return Object.entries(state.platforms)
    .filter(([id, p]) => p.viewers !== null && now - p.at <= staleMs && (!only.length || only.includes(id)))
    .map(([id, p]) => ({ id, viewers: p.viewers }));
}

export function totalViewers(state, opts) {
  return livePlatforms(state, opts).reduce((sum, p) => sum + p.viewers, 0);
}

export function uptimeMs(state, now = Date.now()) {
  return state.liveSince === null ? 0 : Math.max(0, now - state.liveSince);
}

/** 1234 -> "1.2K", 1000000 -> "1.0M"; small numbers stay exact. */
export function formatCompact(n) {
  const v = Number(n) || 0;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e4) return `${Math.round(v / 1e3)}K`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(v);
}

/** 5025000 ms -> "1:23:45"; under an hour -> "23:45". */
export function formatUptime(ms) {
  const total = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0');
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * Progress toward the operator's goal.
 * goalType: 'none' | 'followers' | 'subs' | 'viewers' | 'tips'
 * `goalStart` lets the bar begin from an existing total (e.g. 1,180 followers already).
 */
export function goalProgress(state, settings, opts) {
  const type = settings.goalType || 'none';
  if (type === 'none' || !(settings.goalTarget > 0)) return null;
  const start = Number(settings.goalStart) || 0;
  const value =
    type === 'followers' ? start + state.follows
    : type === 'subs' ? start + state.subs
    : type === 'viewers' ? totalViewers(state, opts)
    : type === 'tips' ? start + state.tips
    : 0;
  const target = Number(settings.goalTarget);
  return {
    type,
    value,
    target,
    pct: Math.max(0, Math.min(100, (value / target) * 100)),
    label: settings.goalLabel || { followers: 'Follower goal', subs: 'Sub goal', viewers: 'Viewer goal', tips: 'Tip goal' }[type],
  };
}
