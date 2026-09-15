/**
 * Wandering pets.
 *
 * Somebody with a pet types in chat, and their pet walks onto the bottom of the
 * stream for a while. It's how the things people buy actually get seen: a hat
 * on a card nobody was looking at is a hat nobody bought.
 *
 * One animation loop drives every pet. The alternative — a timer each — is what
 * makes an overlay that has been open for six hours start dropping frames.
 */
import { parseSettings } from '/core/settings-schema.js';
import { WANDER_SETTINGS, WANDER_THEMES } from './settings.js';
import { renderPet, PET_STYLES } from '/m/game-center/pets/render.js';
import { ACCESSORIES } from '/m/game-center/pets/accessories.js';
import { stageForLevel } from '/m/game-center/pets/model.js';
import { createWalker, startLeaving, longestQuiet, step, positionOf }
  from '/m/game-center/wander-motion.js';

const settings = parseSettings(location.search, WANDER_SETTINGS, WANDER_THEMES);
const yard = document.getElementById('yard');

/** key -> walker */
const walkers = new Map();
let platforms = new Map();
let retryDelay = 1000;
let retryTimer = null;
let last = 0;

applyStaticStyles();
loadPlatforms().then(() => {
  if (settings.preview) startPreview();
  else connect();
});
requestAnimationFrame(frame);

function applyStaticStyles() {
  const st = document.documentElement.style;
  st.setProperty('--font', `${settings.font}, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`);
  st.setProperty('--name-size', `${settings.fontSize}px`);
  st.setProperty('--name-color', settings.nameColor);
  st.setProperty('--opacity', String(settings.opacity / 100));
  document.head.append(Object.assign(document.createElement('style'), { textContent: PET_STYLES }));
}

async function loadPlatforms() {
  try {
    const body = await (await fetch('/api/platforms')).json();
    platforms = new Map(body.platforms.map((p) => [p.id, p]));
  } catch {
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
    if (payload.type === 'gc:wander' && payload.pet) arrive(payload);
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

// ------------------------------------------------------------ the yard

/** Somebody talked. Bring their pet out, or top up its stay if it's already here. */
function arrive(payload) {
  const now = performance.now();
  const existing = walkers.get(payload.key);
  if (existing) {
    existing.until = now + settings.staySec * 1000;
    if (existing.state !== 'leaving') existing.el.dataset.state = 'here';
    // Their pet may have changed since it walked on — a new hat, a new colour.
    if (existing.signature !== signatureOf(payload)) redraw(existing, payload);
    return;
  }

  // Full: the pet whose owner has been quiet longest heads off, so the screen
  // stays as busy as the streamer asked for and no busier.
  if (walkers.size >= settings.maxPets) {
    const oldest = longestQuiet(walkers.values());
    if (oldest) startLeaving(oldest, now);
    if (walkers.size >= settings.maxPets + 4) return;
  }

  const walker = createWalker({
    key: payload.key, now, bounds: bounds(), config: settings, walkers: [...walkers.values()],
  });
  walker.el = document.createElement('div');
  walker.el.className = 'pet';
  walker.el.dataset.state = 'arriving';
  walker.el.dataset.hop = settings.hop ? 'yes' : 'no';
  walker.el.dataset.plate = settings.namePlate ? 'yes' : 'no';
  redraw(walker, payload);
  yard.append(walker.el);
  walkers.set(payload.key, walker);
  draw(walker);
  // One frame as "arriving" so the fade-in has something to animate from.
  requestAnimationFrame(() => {
    walker.state = 'here';
    walker.el.dataset.state = 'here';
  });
}

/** The strip the pets walk in, in page pixels. */
function bounds() {
  return {
    left: settings.marginLeft,
    right: window.innerWidth - settings.marginRight,
    width: settings.size,
  };
}

/** What the pet looks like right now — cheap to compare, so redraws are rare. */
function signatureOf(payload) {
  const p = payload.pet;
  return [p.species, p.level, p.colour, p.eyes, p.shiny, p.name,
    ...Object.entries(p.accessories || {}).flat()].join('|');
}

function redraw(walker, payload) {
  walker.signature = signatureOf(payload);
  const pet = payload.pet;
  // A grown pet is visibly bigger than a new one — the reward for feeding is
  // supposed to be noticeable from across the room.
  const grow = settings.sizeByLevel ? 0.78 + stageForLevel(pet.level).stage * 0.11 : 1;
  const size = Math.round(settings.size * grow);
  walker.width = size;

  const inner = document.createElement('div');
  inner.className = 'inner';

  const art = document.createElement('div');
  art.className = 'art';
  art.innerHTML = renderPet({ ...pet, size }, { accessories: ACCESSORIES });
  if (settings.shadow) {
    const shadow = document.createElement('div');
    shadow.className = 'shadow';
    art.style.position = 'relative';
    art.append(shadow);
  }
  inner.append(art);

  const label = nameFor(payload);
  if (label) inner.append(label);

  walker.el.replaceChildren(inner);
  // Measured once per redraw, never in the animation loop: reading offsetHeight
  // after writing a transform forces a synchronous layout, and doing that for
  // every pet on every frame is what makes an overlay judder after an hour.
  walker.height = 0;
}

function nameFor(payload) {
  if (settings.names === 'none') return null;
  const label = document.createElement('div');
  label.className = 'label';
  if (settings.icons) {
    const mark = platformMark(payload.platform);
    if (mark) label.append(mark);
  }
  const who = document.createElement('span');
  who.className = 'who';
  who.textContent = settings.names === 'pet' ? payload.pet.name
    : settings.names === 'both' ? `${payload.pet.name} · ${payload.owner}`
      : payload.owner;
  label.append(who);
  return label;
}

// ------------------------------------------------------------ the loop

/**
 * One loop for every pet. A timer each is what makes an overlay that has been
 * open for six hours start dropping frames.
 */
function frame(now) {
  requestAnimationFrame(frame);
  const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
  last = now;
  if (!walkers.size) return;

  const list = [...walkers.values()];
  const gone = step(list, { now, dt, bounds: bounds(), config: settings });
  for (const walker of gone) {
    walker.el.remove();
    walkers.delete(walker.key);
  }
  for (const walker of list) {
    if (walker.removeAt && !walkers.has(walker.key)) continue;
    if (walker.state === 'leaving') walker.el.dataset.state = 'leaving';
    walker.el.dataset.moving = walker.moving ? 'yes' : 'no';
    walker.el.dataset.facing = walker.dir < 0 ? 'left' : 'right';
    draw(walker);
  }
}

/** The one write per pet per frame. */
function draw(walker) {
  if (!walker.height) walker.height = walker.el.offsetHeight || 0;
  const at = positionOf(walker, {
    edge: settings.edge, lane: settings.lane, laneDepth: settings.laneDepth,
    viewportHeight: window.innerHeight, height: walker.height,
  });
  walker.el.style.transform = `translate3d(${at.x}px, ${at.y}px, 0)`;
  // Pets further back sit behind the ones in front, so the strip has depth
  // rather than reading as a single row.
  walker.el.style.zIndex = String(at.z);
}

function platformMark(id) {
  const platform = platforms.get(id);
  if (!platform) return null;
  if (!platform.icon) {
    const dot = document.createElement('span');
    dot.className = 'mark';
    dot.style.background = platform.color || '#888';
    return dot;
  }
  const img = document.createElement('img');
  img.className = 'mark';
  img.src = `/api/platforms/${encodeURIComponent(platform.id)}/icon.svg`;
  img.alt = platform.label;
  img.onerror = () => img.remove();
  return img;
}

// ------------------------------------------------------------ preview

function startPreview() {
  const species = ['dog', 'cat', 'duck', 'frog', 'dragon'];
  const owners = ['ava_plays', 'benlikespie', 'cloudkid', 'dmitri', 'eeveelyn'];
  const hats = ['crown', 'wizard', 'partyhat', 'cowboy', 'beanie'];
  const ids = [...platforms.keys()];
  let n = 0;
  const send = () => {
    const i = n % species.length;
    arrive({
      key: `preview:${i}`,
      owner: owners[i],
      platform: ids[i % Math.max(1, ids.length)],
      pet: {
        name: ['Biscuit', 'Noodle', 'Captain', 'Pickle', 'Ash'][i],
        species: species[i],
        level: [1, 9, 25, 50, 30][i],
        colour: ['biscuit', 'plum', 'honey', 'moss', 'lagoon'][i],
        eyes: 'onyx',
        shiny: i === 4,
        accessories: { hat: hats[i], neck: i % 2 ? 'scarf' : 'bowtie', paw: i === 2 ? 'balloon' : undefined },
      },
    });
    n++;
    // Keep them alive so a preview doesn't empty out while it's being styled.
    for (const key of walkers.keys()) {
      const w = walkers.get(key);
      if (w.state !== 'leaving') w.until = performance.now() + settings.staySec * 1000;
    }
  };
  send();
  setInterval(send, 1400);
}
