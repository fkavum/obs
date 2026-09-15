/**
 * Pet and profile cards.
 *
 * One slot, fed by the toast queue, which decides what's worth showing. The
 * cards are drawn from the same pet renderer and crest renderer the rest of the
 * module uses, so a new species or accessory turns up here with no work.
 */
import { parseSettings } from '/core/settings-schema.js';
import { PROFILE_SETTINGS, PROFILE_THEMES } from './settings.js';
import { createToastQueue } from '/m/game-center/toasts.js';
import { renderPet, PET_STYLES } from '/m/game-center/pets/render.js';
import { ACCESSORIES } from '/m/game-center/pets/accessories.js';
import { renderCrest } from '/m/game-center/crest.js';
import { formatCoins } from '/m/game-center/profiles.js';

const settings = parseSettings(location.search, PROFILE_SETTINGS, PROFILE_THEMES);
const stage = document.getElementById('stage');
const slot = document.getElementById('slot');
const moment = document.getElementById('moment');

const queue = createToastQueue({
  quiet: settings.quiet,
  holdMs: settings.holdSec * 1000,
  evolveMs: Math.max(settings.holdSec, 6) * 1000,
  cooldownMs: settings.cooldownSec * 1000,
  depth: settings.queueDepth,
});

let platforms = new Map();
let shown = null;
let retryDelay = 1000;
let retryTimer = null;

applyStaticStyles();
loadPlatforms().then(() => {
  if (settings.preview) startPreview();
  else connect();
});
// One timer for the whole overlay. The queue is clock-driven, so this is the
// clock — nothing else schedules anything.
setInterval(pump, 150);

function applyStaticStyles() {
  const k = settings.scale / 100;
  const px = (n) => `${Math.round(n * k * 100) / 100}px`;
  stage.dataset.position = settings.position;
  stage.dataset.align = settings.align;
  stage.dataset.shadow = settings.shadow;
  stage.dataset.entrance = settings.entrance;
  const st = document.documentElement.style;
  st.setProperty('--font', `${settings.font}, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`);
  st.setProperty('--font-size', px(settings.fontSize));
  st.setProperty('--radius', px(settings.radius));
  st.setProperty('--offset', px(settings.offset));
  st.setProperty('--bg', withAlpha(settings.bgColor, settings.bgOpacity / 100));
  st.setProperty('--text-color', settings.textColor);
  st.setProperty('--accent', settings.accent);
  st.setProperty('--card-w', px(300));
  st.setProperty('--card-h', px(120));
  st.setProperty('--big-w', px(600));
  st.setProperty('--big-h', px(400));
  document.head.append(Object.assign(document.createElement('style'), { textContent: PET_STYLES }));
}

async function loadPlatforms() {
  try {
    const body = await (await fetch('/api/platforms')).json();
    platforms = new Map(body.platforms.map((p) => [p.id, p]));
  } catch {
    // An overlay with no bridge shows nothing at all, never an error.
    platforms = new Map();
  }
}

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
    if (payload.type === 'gc:card' && payload.card) queue.offer(payload.card, Date.now());
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

// ------------------------------------------------------------ the slot

function pump() {
  const now = Date.now();
  const active = queue.tick(now);
  const card = active?.card || null;
  if (card === shown) return;
  shown = card;
  if (!card) {
    slot.replaceChildren();
    return;
  }
  if (card.event === 'evolved' && settings.evolutionMoment) playMoment(card);
  slot.replaceChildren(render(card));
}

function render(card) {
  switch (card.kind) {
    case 'leaderboard': return leaderboardCard(card);
    case 'collapsed': return noteCard(card.text);
    case 'note': return noteCard(card.text);
    case 'help': return noteCard('Games: !race !attack !heist · Pets: !adopt !feed !pet · Shop: !shop !buy !wear');
    case 'shop': return shopCard(card);
    case 'shop-index': return shelvesCard(card);
    case 'closet': return noteCard(`${card.name}'s closet: ${card.items.map((i) => i.label).join(' · ') || 'empty'}`);
    case 'avatar': return avatarCard(card);
    case 'coins': return coinsCard(card);
    default: return petCard(card);
  }
}

/** The 300x120 card: the pet, who it belongs to, and how far to the next level. */
function petCard(card) {
  if (!card.pet) return noteCard(card.note || card.text || '');
  const big = card.event === 'evolved' || card.size === 'big';
  const el = card_(big ? 'big' : 'small', card.event);
  const art = div('art');
  art.innerHTML = renderPet({ ...card.pet, size: big ? 200 : 88 }, { accessories: ACCESSORIES });
  el.append(art, nameRow(card), body(card), meter(card.progress));
  return el;
}

function nameRow(card) {
  const row = div('name');
  if (card.crest) {
    const crest = div('crest');
    crest.innerHTML = renderCrest(card.crest, { size: 24 });
    row.append(crest);
  }
  const who = div('who');
  who.textContent = card.pet ? `${card.pet.name} the ${card.stageName || ''}`.trim() : card.name || '';
  row.append(who);
  if (settings.icons) {
    const mark = platformMark(card.platform || card.owner_platform);
    if (mark) row.append(mark);
  }
  return row;
}

function body(card) {
  const el = div('body');
  const bits = [];
  if (card.pet) bits.push(`level <b>${card.pet.level}</b>`);
  if (card.owner) bits.push(`${escapeHtml(card.owner)}`);
  if (settings.showCoins && Number.isFinite(card.coins)) bits.push(`<span class="coins">${formatCoins(card.coins)}</span>`);
  el.innerHTML = bits.join(' · ');
  if (card.note) {
    const note = div('');
    note.textContent = card.note;
    el.append(note);
  }
  return el;
}

function meter(progress) {
  const el = div('meter');
  const fill = document.createElement('i');
  const pct = progress ? Math.max(0, Math.min(100, Math.round(progress.pct ?? (progress.into / progress.need) * 100))) : 0;
  fill.style.width = `${pct}%`;
  el.append(fill);
  return el;
}

function coinsCard(card) {
  const el = card_('small', 'coins');
  const art = div('art');
  art.innerHTML = renderCrest(card.crest, { size: 88 });
  const bodyEl = div('body');
  bodyEl.innerHTML = `<span class="coins">${formatCoins(card.coins)}</span> coins${
    card.rank ? ` · #${card.rank.place} of ${card.rank.of}` : ''}`;
  el.append(art, nameRow(card), bodyEl, meter(null));
  return el;
}

function avatarCard(card) {
  const el = card_('small', 'avatar');
  const art = div('art');
  art.innerHTML = renderCrest(card.crest, { size: 88 });
  const bodyEl = div('body');
  bodyEl.textContent = card.note || '';
  el.append(art, nameRow(card), bodyEl, meter(null));
  return el;
}

function leaderboardCard(card) {
  const el = card_('big', 'leaderboard');
  const title = div('name');
  title.textContent = 'Top of the board';
  const rows = div('rows');
  for (const [i, entry] of (card.entries || []).entries()) {
    const row = div('row');
    const rank = div('rank');
    rank.textContent = `${i + 1}.`;
    const crest = div('crest');
    crest.innerHTML = renderCrest(entry.crest, { size: 22 });
    const who = div('who');
    who.textContent = entry.name;
    const amount = div('amount');
    amount.textContent = formatCoins(entry.coins);
    row.append(rank, crest, who, amount);
    if (settings.icons) {
      const mark = platformMark(entry.platform);
      if (mark) row.append(mark);
    }
    rows.append(row);
  }
  el.append(title, rows);
  return el;
}

/** The shelf list: what there is to browse, and what to type to browse it. */
function shelvesCard(card) {
  const el = card_('list', 'shop');
  const title = div('name');
  title.textContent = card.note || 'What\u2019s in the shop';
  const rows = div('rows');
  for (const shelf of card.shelves || []) {
    const row = div('row');
    const cmd = div('cmd');
    cmd.textContent = `!shop ${shelf.slot}`;
    const blurb = div('blurb');
    blurb.textContent = shelf.blurb || '';
    const amount = div('amount');
    amount.textContent = shelf.from == null ? `${shelf.count}` : `${shelf.count} · from ${shelf.from}`;
    row.append(cmd, blurb, amount);
    rows.append(row);
  }
  el.append(title, rows);
  return el;
}

function shopCard(card) {
  const el = card_('big', 'shop');
  const title = div('name');
  title.textContent = card.label || `${card.slot} shop`;
  const rows = div('rows');
  for (const item of card.items || []) {
    const row = div('row');
    const who = div('who');
    who.textContent = item.label;
    const amount = div('amount');
    amount.textContent = item.owned ? 'owned' : item.price == null ? 'earn it' : formatCoins(item.price);
    row.append(who, amount);
    rows.append(row);
  }
  el.append(title, rows);
  return el;
}

function noteCard(text) {
  const el = card_('small', 'note');
  const bodyEl = div('body');
  bodyEl.textContent = text || '';
  el.append(div('art'), div('name'), bodyEl, div('meter'));
  return el;
}

/**
 * The evolution moment: the new shape as a white silhouette, then the colour
 * arrives. Six seconds, once, over everything else.
 */
function playMoment(card) {
  if (!card.pet) return;
  const art = div('art silhouette');
  art.innerHTML = renderPet({ ...card.pet, size: 400 }, { accessories: ACCESSORIES });
  const label = div('label');
  label.textContent = `${card.pet.name} evolved!`;
  moment.replaceChildren(art, label);
  moment.hidden = false;
  // The moment replaces the card rather than sitting on top of it — two pets
  // in the same place at the same size just reads as a smudge.
  stage.dataset.hidden = 'yes';
  // Hold the silhouette, then reveal. Two timers, both cleared by the next one
  // starting — an overlay left running all day must not accumulate them.
  clearTimeout(playMoment.revealTimer);
  clearTimeout(playMoment.endTimer);
  playMoment.revealTimer = setTimeout(() => {
    art.className = 'art reveal';
  }, 2600);
  playMoment.endTimer = setTimeout(() => {
    moment.hidden = true;
    moment.replaceChildren();
    stage.dataset.hidden = 'no';
  }, 6000);
}
playMoment.revealTimer = null;
playMoment.endTimer = null;

// ------------------------------------------------------------ preview

function startPreview() {
  const pets = ['dog', 'cat', 'duck', 'frog', 'dragon'];
  const names = ['Biscuit', 'Noodle', 'Captain', 'Pickle', 'Ash'];
  const owners = ['ava_plays', 'benlikespie', 'cloudkid', 'dmitri', 'eeveelyn'];
  let n = 0;
  const offer = () => {
    const i = n % pets.length;
    const level = [1, 9, 10, 25, 50][i];
    // Preview mode shows what quiet mode would hide too, or there'd be nothing
    // to style: every third card is an evolution.
    const event = n % 3 === 0 ? 'evolved' : n % 3 === 1 ? 'levelled' : 'fed';
    queue.offer({
      kind: 'pet', event,
      pet: { name: names[i], species: pets[i], level, colour: ['biscuit', 'plum', 'honey', 'moss', 'lagoon'][i],
        eyes: 'onyx', shiny: i === 4, accessories: i % 2 ? { hat: 'crown' } : { neck: 'scarf' } },
      stageName: ['Pup', 'Good Dog', 'Big Dog', 'Goodest Boy', 'Ancient'][i],
      owner: owners[i], platform: [...platforms.keys()][i % Math.max(1, platforms.size)],
      crest: { shape: 'hexagon', pattern: 'rays', emblem: 'paw', primary: 'lagoon', secondary: 'honey' },
      coins: 120 * (i + 3), progress: { into: level * 7, need: level * 25, pct: 30 + i * 15 },
      note: event === 'evolved' ? 'grew up!' : event === 'levelled' ? 'levelled up' : 'had a snack',
    }, Date.now());
    n++;
  };
  offer();
  setInterval(offer, Math.max(2000, settings.holdSec * 1000));
}

// ------------------------------------------------------------ helpers

function card_(size, event) {
  const el = div('card');
  el.dataset.size = size;
  if (event) el.dataset.event = event;
  return el;
}

function div(className) {
  const el = document.createElement('div');
  if (className) el.className = className;
  return el;
}

/**
 * The platform's mark comes from its manifest — this overlay never knows which
 * platforms exist, which is what keeps one drop-in removable.
 */
function platformMark(id) {
  const platform = platforms.get(id);
  if (!platform) return null;
  const mark = div('mark');
  mark.title = platform.label;
  // The icons ship already in the platform's own colour, so a coloured chip
  // behind one hides it. The colour is the fallback *instead of* the icon.
  const paintFallback = () => { mark.style.background = platform.color || 'var(--accent)'; };
  if (!platform.icon) {
    paintFallback();
    return mark;
  }
  const img = document.createElement('img');
  img.src = `/api/platforms/${encodeURIComponent(platform.id)}/icon.svg`;
  img.alt = platform.label;
  img.onerror = () => { img.remove(); paintFallback(); };
  mark.append(img);
  return mark;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function withAlpha(hex, alpha) {
  const h = String(hex).replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
