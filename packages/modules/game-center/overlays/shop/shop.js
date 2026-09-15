/**
 * Shop board. Shows what's for sale, one section at a time, and pages itself.
 *
 * The board draws every item from the same definitions the pets wear, so a new
 * accessory appears here the moment it's added — there is no second list to
 * keep in sync.
 */
import { parseSettings } from '/core/settings-schema.js';
import { SHOP_SETTINGS, SHOP_THEMES } from './settings.js';
import { catalogue, SHELF_LABELS, resolveShelf } from '/m/game-center/pets/wardrobe.js';
import { ACCESSORIES } from '/m/game-center/pets/accessories.js';
import { PALETTE } from '/m/game-center/profiles.js';

const settings = parseSettings(location.search, SHOP_SETTINGS, SHOP_THEMES);
const stage = document.getElementById('stage');
const board = document.getElementById('board');

/** The box each item is drawn in, by slot — hats grow upward, wings sideways. */
const VIEWBOX = {
  hat: '-22 -38 44 44',
  face: '-20 -16 40 32',
  neck: '-18 -10 36 30',
  back: '-28 -14 56 48',
  paw: '-20 -28 40 38',
};

let pages = [];
let at = 0;
let timer = null;

applyStaticStyles();
build();
show();
// A single interval, not one per page: a board left running for an eight-hour
// stream must not accumulate timers.
timer = setInterval(() => { at = (at + 1) % Math.max(1, pages.length); show(); }, settings.rotateSec * 1000);

function applyStaticStyles() {
  const k = settings.scale / 100;
  const px = (n) => `${Math.round(n * k * 100) / 100}px`;
  stage.dataset.position = settings.position;
  stage.dataset.align = settings.align;
  stage.dataset.shadow = settings.shadow;
  const st = document.documentElement.style;
  st.setProperty('--font', `${settings.font}, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`);
  st.setProperty('--font-size', px(settings.fontSize));
  st.setProperty('--padding', px(settings.padding));
  st.setProperty('--radius', px(settings.radius));
  st.setProperty('--width', px(settings.width));
  st.setProperty('--offset', px(settings.offset));
  st.setProperty('--bg', withAlpha(settings.bgColor, settings.bgOpacity / 100));
  st.setProperty('--text-color', settings.textColor);
  st.setProperty('--accent', settings.accent);
}

/** Split the catalogue into fixed-size pages, section by section. */
function build() {
  // Accept the same words chat can type, so the board's sections and the
  // !shop command can never drift apart.
  const wanted = String(settings.slots).split(',')
    .map((s) => resolveShelf(s.trim())).filter(Boolean);
  const perPage = Math.max(1, settings.rows * Number(settings.columns || 1));
  const all = catalogue();
  pages = [];
  for (const slot of wanted) {
    let items = all.filter((i) => i.slot === slot);
    if (!settings.showEarned) items = items.filter((i) => !i.earnedBy);
    if (!items.length) continue;
    const count = Math.ceil(items.length / perPage);
    for (let p = 0; p < count; p++) {
      pages.push({ slot, page: p, of: count, items: items.slice(p * perPage, (p + 1) * perPage) });
    }
  }
}

function show() {
  const page = pages[at];
  stage.dataset.hidden = page ? 'no' : 'yes';
  if (!page) return;

  const head = el('div', 'head', [
    el('span', 'title', [text(SHELF_LABELS[page.slot] || titleCase(page.slot))]),
    el('span', 'pager', [text(pages.length > 1 ? `${at + 1}/${pages.length}` : '')]),
  ]);

  const grid = el('div', 'grid', page.items.map(rowFor));
  grid.dataset.cols = String(settings.columns || 1);

  const children = [head, grid];
  if (settings.hint) children.push(el('div', 'hint', [text('!buy <item> · !wear <item> · !shop <section>')]));
  board.replaceChildren(...children);
}

function rowFor(item) {
  const row = el('div', 'row', [chipFor(item), el('span', 'name', [text(item.label)])]);
  row.dataset.rarity = item.rarity;
  if (settings.showPrices) {
    const price = el('span', 'price', [text(item.price == null ? 'earn it' : String(item.price))]);
    if (item.price == null) price.dataset.kind = 'earned';
    row.append(price);
  }
  return row;
}

/** A coat shows as a swatch; everything else draws itself. */
function chipFor(item) {
  if (item.slot === 'coat') {
    const dot = el('span', 'swatch');
    const base = item.swatch || PALETTE.biscuit;
    dot.style.background = `linear-gradient(145deg, #fff6 0%, ${base} 55%, #0006 100%), ${base}`;
    return dot;
  }
  const def = ACCESSORIES[item.id];
  const chip = el('span', 'chip');
  if (def) {
    chip.innerHTML = `<svg viewBox="${VIEWBOX[item.slot] || '-20 -20 40 40'}" aria-hidden="true">${def.svg}</svg>`;
  }
  return chip;
}

// ------------------------------------------------------------ helpers

function el(tag, className, children = []) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  for (const child of children) node.append(child);
  return node;
}
// Function declarations, not consts: the first render runs while this module
// is still evaluating, so anything it calls has to be hoisted.
function text(value) {
  return document.createTextNode(value);
}
function titleCase(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function withAlpha(hex, alpha) {
  const h = String(hex).replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

window.addEventListener('pagehide', () => clearInterval(timer));
