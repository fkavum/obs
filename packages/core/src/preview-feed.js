/**
 * Scripted fake events.
 *
 * One corpus, two consumers: the `fake` adapter uses it so overlays can be built
 * and demoed without going live, and the overlay's own `preview=on` mode uses it
 * so styling works even when the bridge isn't running. Runs in Node and browser.
 */

const NAMES = [
  'PixelPete', 'sarah_streams', 'GG_Melody', 'thatoneguy', 'NoScopeNina',
  'kebab_lord', 'quietviewer', 'Rakun', 'mods_are_asleep', 'BigBossBora',
  'lurker_99', 'AylinPlays', 'CtrlAltDefeat', 'MelonMusk', 'zeynep.exe',
];

const COLORS = ['#ff4d6d', '#4dd2ff', '#9d7bff', '#4dffb8', '#ffd24d', '#ff884d', null];

const MESSAGES = [
  'first time here, this looks sick',
  'LETS GOOO',
  'how long have you been playing this?',
  'that clutch was insane',
  'gm from turkey 🇹🇷',
  'the new overlay looks clean ngl',
  'W stream',
  'can you turn the music up a bit?',
  'I was NOT expecting that ending',
  'chat is moving so fast today',
  'been watching for 3 years, still the best',
  'poggers',
  'is this on youtube too or just twitch?',
  'my man really said "trust the process"',
  'the fps drop is wild lol',
  'o7',
  'do the thing!!',
  'im supposed to be working right now',
  'that music slaps, whats the track?',
  'bro is cracked at this game',
  'hello from kick side 👋',
  '!socials',
  'KEKW',
  'skill issue honestly',
  'how do i get that border on my chat',
];

const ROLE_SETS = [[], [], [], ['subscriber'], ['subscriber'], ['moderator'], ['moderator', 'subscriber'], ['vip']];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const uuid = () =>
  globalThis.crypto?.randomUUID
    ? crypto.randomUUID()
    : `fake-${Date.now()}-${Math.random().toString(16).slice(2)}`;

/** Build one fake normalized event. */
export function makePreviewEvent(platforms = ['twitch', 'youtube', 'kick'], forceType = null) {
  const platform = pick(platforms.length ? platforms : ['fake']);
  const name = pick(NAMES);
  const user = {
    id: `u${Math.abs(hash(name))}`,
    name: name.toLowerCase(),
    displayName: name,
    avatar: null,
    roles: pick(ROLE_SETS),
    color: pick(COLORS),
  };
  const base = { id: uuid(), platform, ts: Date.now(), channel: 'demo', user };

  const roll = forceType ? null : Math.random();
  const type = forceType ?? (roll < 0.86 ? 'chat' : roll < 0.91 ? 'follow' : roll < 0.95 ? 'subscription' : roll < 0.98 ? 'donation' : 'raid');

  switch (type) {
    case 'follow':
      return { ...base, type: 'follow', data: {} };
    case 'subscription':
      return { ...base, type: 'subscription', data: { tier: pick(['1', '1', '2', '3']), months: 1 + Math.floor(Math.random() * 24), isGift: Math.random() < 0.3 } };
    case 'donation':
      return { ...base, type: 'donation', data: { amount: pick([5, 10, 20, 50, 100]), currency: 'USD', message: pick(MESSAGES) } };
    case 'raid':
      return { ...base, type: 'raid', data: { viewers: 10 + Math.floor(Math.random() * 500), fromChannel: pick(NAMES).toLowerCase() } };
    case 'chat':
    default: {
      const text = pick(MESSAGES);
      return { ...base, type: 'chat', data: { text, fragments: [{ type: 'text', text }] } };
    }
  }
}

/**
 * Emit fake events on a human-ish rhythm: bursts, then lulls, the way real chat behaves.
 * @returns {() => void} stop function
 */
export function startPreviewFeed(emit, { platforms, minMs = 700, maxMs = 3500, burstChance = 0.25 } = {}) {
  let timer = null;
  let stopped = false;

  const tick = () => {
    if (stopped) return;
    emit(makePreviewEvent(platforms));
    // Occasionally fire a quick second message, so chat doesn't look metronomic.
    if (Math.random() < burstChance) {
      setTimeout(() => !stopped && emit(makePreviewEvent(platforms)), 120 + Math.random() * 400);
    }
    timer = setTimeout(tick, minMs + Math.random() * (maxMs - minMs));
    timer.unref?.();
  };

  timer = setTimeout(tick, 300);
  timer.unref?.();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
