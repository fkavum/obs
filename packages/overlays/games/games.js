/**
 * Chat games overlay. Renders whichever game the bridge is running.
 *
 * Preview mode runs the real game modules against made-up players, so what you
 * style is exactly what viewers will see - not a mock-up that drifts from it.
 */
import { parseSettings, GAMES_SETTINGS, GAMES_THEMES } from '/core/settings-schema.js';
import { GAMES, makeRandom } from '/core/games/index.js';

let retryDelay = 1000;
let retryTimer = null;
const settings = parseSettings(location.search, GAMES_SETTINGS, GAMES_THEMES);
const stage = document.getElementById('stage');
const panel = document.getElementById('panel');
let state = null;
let platforms = new Map();
let hideAt = 0;

applyStaticStyles();
loadPlatforms().then(() => {
  if (settings.preview) startPreview();
  else connect();
});
setInterval(render, 120);

function applyStaticStyles() {
  const s = settings;
  const k = s.scale / 100;
  const px = (n) => `${Math.round(n * k * 100) / 100}px`;
  stage.dataset.position = s.position;
  stage.dataset.align = s.align;
  stage.dataset.shadow = s.shadow;
  const st = document.documentElement.style;
  st.setProperty('--font', `${s.font}, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`);
  st.setProperty('--font-size', px(s.fontSize));
  st.setProperty('--padding', px(s.padding));
  st.setProperty('--radius', px(s.radius));
  st.setProperty('--width', px(s.width));
  st.setProperty('--offset', px(s.offset));
  st.setProperty('--bg', withAlpha(s.bgColor, s.bgOpacity / 100));
  st.setProperty('--text-color', s.textColor);
  st.setProperty('--accent', s.accent);
}

async function loadPlatforms() {
  try {
    const body = await (await fetch('/api/platforms')).json();
    platforms = new Map(body.platforms.map((p) => [p.id, p]));
  } catch {
    platforms = new Map();
  }
}
const platformColor = (id) => platforms.get(id)?.color || 'var(--accent)';

// ------------------------------------------------------------ transport

function connect() {
  let socket;
  try {
    socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/events`);
  } catch {
    scheduleReconnect();
    return;
  }
  socket.onmessage = (msg) => {
    let payload;
    try {
      payload = JSON.parse(msg.data);
    } catch {
      return;
    }
    if (payload.type !== 'game' || !payload.state) return;
    setState(payload.state);
  };
  socket.onclose = scheduleReconnect;
  socket.onerror = () => socket.close();
}
function scheduleReconnect() {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    retryDelay = Math.min(15000, retryDelay * 1.7);
    connect();
  }, retryDelay);
}

function setState(next) {
  state = next;
  // A finished game lingers so chat can read the result, then clears itself.
  hideAt = next.phase === 'finished' ? Date.now() + settings.holdSec * 1000 : 0;
  render();
}

// ------------------------------------------------------------ render

function render() {
  const hide = !state || (hideAt && Date.now() > hideAt);
  stage.dataset.hidden = hide ? 'yes' : 'no';
  if (hide) return;

  const game = GAMES[state.id];
  panel.replaceChildren(
    header(game),
    ...(state.phase === 'joining' ? joining() : []),
    ...(state.id === 'race' ? raceView() : []),
    ...(state.id === 'boss' ? bossView() : []),
    ...(state.id === 'heist' ? heistView() : []),
    ...(state.phase === 'finished' ? finished() : []),
  );
}

function header(game) {
  const el = document.createElement('div');
  el.className = 'head';
  const title = document.createElement('span');
  title.className = 'title';
  title.textContent = `${game.emoji} ${game.label}`;
  const count = document.createElement('span');
  count.className = 'count';
  const n = state.players?.length || 0;
  count.textContent = state.phase === 'finished' ? '' : `${n} ${n === 1 ? 'player' : 'players'}`;
  el.append(title, count);
  return el;
}

function message() {
  const el = document.createElement('div');
  el.className = 'msg';
  el.textContent = state.message || '';
  return el;
}

function joining() {
  const left = Math.max(0, state.joinEndsAt - Date.now());
  const total = Math.max(1, state.joinEndsAt - state.startedAt);
  const bar = document.createElement('div');
  bar.className = 'bar';
  const fill = document.createElement('i');
  fill.style.width = `${(left / total) * 100}%`;
  bar.append(fill);

  const msg = message();
  msg.innerHTML = `${escapeHtml(state.message || '')} <strong>${Math.ceil(left / 1000)}s</strong>`;
  return [msg, bar, ...(state.players?.length ? [playerChips()] : [])];
}

function playerChips() {
  const rows = document.createElement('div');
  rows.className = 'rows';
  for (const p of state.players.slice(0, settings.maxRows)) {
    rows.append(row({ name: p.name, platform: p.platform, value: p.wager ? `${p.wager}` : '' }));
  }
  if (state.players.length > settings.maxRows) rows.append(more(state.players.length - settings.maxRows));
  return rows;
}

// ---- race ----
function raceView() {
  if (state.phase === 'joining') return [];
  const lanes = document.createElement('div');
  lanes.className = 'lanes';
  for (const p of state.players.slice(0, settings.maxRows)) {
    const lane = document.createElement('div');
    lane.className = 'lane';
    lane.dataset.done = p.finishedAt ? 'yes' : 'no';
    const runner = document.createElement('div');
    runner.className = 'runner';
    runner.style.left = `${Math.min(100, p.pos)}%`;
    runner.style.setProperty('--pc', platformColor(p.platform));
    const dot = document.createElement('span');
    dot.className = 'dot';
    const name = document.createElement('span');
    name.textContent = p.name;
    runner.append(dot, name);
    lane.append(runner);
    lanes.append(lane);
  }
  return [lanes];
}

// ---- boss ----
function bossView() {
  const out = [];
  const head = document.createElement('div');
  head.className = 'boss';
  head.innerHTML = `<div class="face">${escapeHtml(state.boss.emoji)}</div><div class="name">${escapeHtml(state.boss.name)}</div>`;
  out.push(head);

  const hp = document.createElement('div');
  hp.className = 'hp';
  const fill = document.createElement('i');
  fill.style.width = `${(state.boss.hp / state.boss.maxHp) * 100}%`;
  const label = document.createElement('span');
  label.textContent = `${Math.round(state.boss.hp)} / ${state.boss.maxHp}`;
  hp.append(fill, label);
  out.push(hp);

  const hit = document.createElement('div');
  hit.className = 'hit';
  if (state.lastHit && state.phase === 'running') {
    hit.innerHTML = state.lastHit.crit
      ? `<span class="crit">CRIT!</span> ${escapeHtml(state.lastHit.name)} hits for ${state.lastHit.hit}`
      : `${escapeHtml(state.lastHit.name)} hits for ${state.lastHit.hit}`;
  } else if (state.phase === 'running') {
    hit.textContent = `Type ${GAMES.boss.joinCommand} — ${Math.max(0, Math.ceil((state.endsAt - Date.now()) / 1000))}s left`;
  }
  out.push(hit);

  if (state.phase === 'running' && state.players.length) {
    const rows = document.createElement('div');
    rows.className = 'rows';
    [...state.players].sort((a, b) => b.damage - a.damage).slice(0, settings.maxRows)
      .forEach((p, i) => rows.append(row({ rank: i + 1, name: p.name, platform: p.platform, value: `${p.damage}` })));
    out.push(rows);
  }
  return out;
}

// ---- heist ----
function heistView() {
  if (state.phase === 'joining') {
    const target = document.createElement('div');
    target.className = 'msg';
    target.innerHTML = `Target: <strong>${escapeHtml(state.target.emoji)} ${escapeHtml(state.target.name)}</strong> · pot <strong>${state.pot}</strong>`;
    return [target];
  }
  return [];
}

// ---- finished ----
function finished() {
  const out = [message()];
  const results = state.results || [];
  if (results.length) {
    const rows = document.createElement('div');
    rows.className = 'rows';
    for (const r of results.slice(0, settings.maxRows)) {
      rows.append(row({
        rank: r.place,
        name: r.name,
        platform: r.platform,
        good: r.survived === undefined ? undefined : r.survived,
        gold: r.place === 1,
        value: r.damage !== undefined ? `${r.damage}` : '',
        reward: r.reward,
      }));
    }
    if (results.length > settings.maxRows) rows.append(more(results.length - settings.maxRows));
    out.push(rows);
  }

  if (settings.showLeaderboard && state.leaderboard?.length) {
    const label = document.createElement('div');
    label.className = 'sub';
    label.textContent = 'Points leaderboard';
    const rows = document.createElement('div');
    rows.className = 'rows';
    state.leaderboard.slice(0, 5).forEach((p, i) =>
      rows.append(row({ rank: i + 1, name: p.name, platform: p.platform, value: `${p.points}` })));
    out.push(label, rows);
  }
  return out;
}

// ---- shared row ----
function row({ rank, name, platform, value, reward, good, gold }) {
  const el = document.createElement('div');
  el.className = `row2${gold ? ' gold' : ''}`;
  if (good !== undefined) el.dataset.good = good ? 'yes' : 'no';

  if (rank !== undefined) {
    const r = document.createElement('span');
    r.className = 'rank';
    r.textContent = `${rank}.`;
    el.append(r);
  }
  if (settings.icons && platform) {
    const img = document.createElement('img');
    img.src = `/api/platforms/${encodeURIComponent(platform)}/icon.svg`;
    img.alt = '';
    img.onerror = () => img.remove();
    el.append(img);
  }
  const who = document.createElement('span');
  who.className = 'who';
  who.textContent = name;
  el.append(who);

  if (value) {
    const v = document.createElement('span');
    v.className = 'val';
    v.textContent = value;
    el.append(v);
  }
  if (reward) {
    const v = document.createElement('span');
    v.className = `val ${reward > 0 ? 'plus' : 'minus'}`;
    v.textContent = reward > 0 ? `+${reward}` : `${reward}`;
    el.append(v);
  }
  return el;
}

function more(n) {
  const el = document.createElement('div');
  el.className = 'row2';
  el.style.opacity = '0.6';
  el.textContent = `…and ${n} more`;
  return el;
}

// ------------------------------------------------------------ preview

/** Runs the real games against invented players, cycling through all three. */
function startPreview() {
  const names = ['PixelPete', 'sarah_streams', 'GG_Melody', 'kebab_lord', 'AylinPlays', 'Rakun', 'zeynep.exe', 'MelonMusk'];
  const ids = [...platforms.keys()].filter((p) => p !== 'fake');
  // ?game=heist previews just that one, which is what you want while styling it.
  const only = new URLSearchParams(location.search).get('game');
  const order = GAMES[only] ? [only] : ['race', 'boss', 'heist'];
  let index = 0;

  const runOne = () => {
    const game = GAMES[order[index++ % order.length]];
    const random = makeRandom(Date.now());
    let local = game.create({ now: Date.now(), random, seed: Date.now() });
    // A viewer belongs to one platform; picking randomly per message would make
    // the same person look like three different fighters.
    const home = Object.fromEntries(names.map((n, i) => [n, ids[i % Math.max(1, ids.length)] || 'twitch']));
    const fakeEvent = (name, extra = '') => ({
      type: 'chat', platform: home[name] || 'twitch',
      user: { name: name.toLowerCase(), displayName: name, roles: [] },
      data: { text: `${game.joinCommand}${extra}` },
    });

    // Chat piles in over the first few seconds.
    names.forEach((name, i) => setTimeout(() => {
      if (game.id === 'heist') local = game.join(local, fakeEvent(name, ` ${50 + i * 20}`), () => 500);
      else if (game.id === 'boss') local = game.join(local, fakeEvent(name), random, Date.now());
      else local = game.join(local, fakeEvent(name));
      setState({ ...local, leaderboard: previewBoard(names, ids) });
    }, 400 + i * 500));

    // Boss keeps taking hits until it falls.
    let hammer = null;
    if (game.id === 'boss') {
      hammer = setInterval(() => {
        if (local.phase !== 'running') return;
        local = game.join(local, fakeEvent(names[Math.floor(random() * names.length)]), random, Date.now());
        setState({ ...local, leaderboard: previewBoard(names, ids) });
      }, 350);
    }

    const loop = setInterval(() => {
      const now = Date.now();
      if (local.phase === 'joining' && now >= local.joinEndsAt) local = game.start(local, now, random);
      else if (local.phase === 'running' && game.advance) local = game.advance(local, random, now);
      setState({ ...local, leaderboard: previewBoard(names, ids) });
      if (local.phase === 'finished') {
        clearInterval(loop);
        if (hammer) clearInterval(hammer);
        setTimeout(runOne, (settings.holdSec + 2) * 1000);
      }
    }, 200);
  };

  // Shorten the waiting room so a preview doesn't spend a minute doing nothing.
  for (const game of Object.values(GAMES)) game.joinWindowSec = Math.min(game.joinWindowSec, 6);
  runOne();
}

function previewBoard(names, ids) {
  return names.slice(0, 5).map((name, i) => ({
    name, platform: ids[i % Math.max(1, ids.length)] || 'twitch', points: 900 - i * 137,
  }));
}

// ------------------------------------------------------------ helpers

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
function withAlpha(hex, alpha) {
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6) return `rgba(0,0,0,${alpha})`;
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
