/**
 * Crests — the avatar every viewer has before they do anything.
 *
 * A crest is four choices: shape, pattern, emblem and two colours. Derived from
 * the viewer's name on first sight, so a brand-new person's card already looks
 * personal instead of blank, and changeable afterwards with !avatar.
 *
 * Drawn as inline SVG, pure, and from the same twelve-colour palette the pets
 * use — which is what makes a card read as one design rather than two.
 */
import { PALETTE, COAT_NAMES, CREST_SHAPES, CREST_PATTERNS, CREST_EMBLEMS, hashKey } from './profiles.js';
import { hexToHsl, hslToHex } from './pets/colours.js';

/** Outlines in a 100x100 box. */
const SHAPES = {
  circle: 'M50,4 a46,46 0 1 1 -0.1,0Z',
  squircle: 'M50,4 C78,4 96,22 96,50 C96,78 78,96 50,96 C22,96 4,78 4,50 C4,22 22,4 50,4Z',
  hexagon: 'M50,3 L91,26.5 L91,73.5 L50,97 L9,73.5 L9,26.5Z',
  shield: 'M50,3 L92,16 L92,52 Q92,82 50,97 Q8,82 8,52 L8,16Z',
  diamond: 'M50,2 L98,50 L50,98 L2,50Z',
  blob: 'M50,4 Q82,6 92,32 Q100,58 80,78 Q58,100 34,88 Q8,74 6,46 Q6,16 50,4Z',
};

/**
 * Emblems drawn in a 24x24 box centred on the origin, so one definition works
 * inside any shape — the same trick the pet accessories use.
 */
const EMBLEMS = {
  star: 'M0,-11 L3.2,-3.5 L11,-3.5 L4.8,1.4 L7.2,9 L0,4.4 L-7.2,9 L-4.8,1.4 L-11,-3.5 L-3.2,-3.5Z',
  bolt: 'M2,-11 L-7,1 L-1,1 L-3,11 L7,-2 L1,-2Z',
  // Leaning, with a stem and a vein cut out of it — a symmetric leaf just
  // reads as a shield at this size.
  leaf: 'M-9,10 Q-11,-2 -2,-8 Q6,-12 10,-10 Q11,0 2,6 Q-4,9 -7,8Z M-7.4,8.2 Q0,1 7,-7 L5.6,-8.4 Q-1.4,-0.6 -8.8,6.6Z',
  moon: 'M4,-10 A10,10 0 1 0 4,10 A8,8 0 1 1 4,-10Z',
  sun: 'M0,-5.5 a5.5,5.5 0 1 1 -0.1,0Z M0,-11 l0,3 M0,8 l0,3 M-11,0 l3,0 M8,0 l3,0 M-7.8,-7.8 l2.1,2.1 M5.7,5.7 l2.1,2.1 M7.8,-7.8 l-2.1,2.1 M-5.7,5.7 l-2.1,2.1',
  flame: 'M0,-11 Q6,-4 6,1 Q6,9 0,10 Q-6,9 -6,1 Q-6,-3 -2,-6 Q-2,-2 0,-2 Q2,-5 0,-11Z',
  snowflake: 'M0,-11 L0,11 M-9.5,-5.5 L9.5,5.5 M-9.5,5.5 L9.5,-5.5 M0,-7 l-3,-3 M0,-7 l3,-3 M0,7 l-3,3 M0,7 l3,3',
  heart: 'M0,10 Q-11,2 -11,-4 Q-11,-10 -5.5,-10 Q-1,-10 0,-5 Q1,-10 5.5,-10 Q11,-10 11,-4 Q11,2 0,10Z',
  diamond: 'M0,-10 L9,-2 L0,10 L-9,-2Z M-9,-2 L9,-2',
  // Drawn with the sockets as holes in the same path (even-odd), so the skull
  // reads as a skull at 40px instead of a white blob.
  skull: 'M0,-10 Q9,-10 9,-1 Q9,4 5,5 L5,9 L-5,9 L-5,5 Q-9,4 -9,-1 Q-9,-10 0,-10Z M-4.2,-2.5 a2.6,2.9 0 1 0 0.1,0Z M4.2,-2.5 a2.6,2.9 0 1 0 0.1,0Z M-1.4,3 l2.8,0 l0,2.6 l-2.8,0Z',
  crown: 'M-10,6 L-8,-8 L-3,-1 L0,-9 L3,-1 L8,-8 L10,6Z',
  sword: 'M0,-11 L2.5,-6 L2.5,3 L-2.5,3 L-2.5,-6Z M-6,3 L6,3 L6,5 L-6,5Z M-1.5,5 L1.5,5 L1.5,10 L-1.5,10Z',
  shield: 'M0,-10 L9,-6 L9,1 Q9,8 0,11 Q-9,8 -9,1 L-9,-6Z',
  arrow: 'M0,-11 L7,-3 L2.5,-3 L2.5,11 L-2.5,11 L-2.5,-3 L-7,-3Z',
  note: 'M-2,8 a4,3 0 1 0 0.1,0Z M2,8 L2,-9 L9,-11 L9,-6 L2,-4',
  headphones: 'M-9,4 L-9,-1 A9,9 0 0 1 9,-1 L9,4 M-9,2 a3,4 0 1 0 0.1,0Z M9,2 a3,4 0 1 0 0.1,0Z',
  controller: 'M-9,-4 L9,-4 A5,5 0 0 1 9,6 L-9,6 A5,5 0 0 1 -9,-4Z M-5,1 l4,0 M-3,-1 l0,4 M4,0 l0,0 M6,3 l0,0',
  coffee: 'M-6,-6 L6,-6 L5,7 L-5,7Z M6,-3 Q11,-2 9,2 Q8,4 5,4 M-7,9 L7,9',
  paw: 'M0,3 q6,0 6,4 q0,4 -6,4 q-6,0 -6,-4 q0,-4 6,-4Z M-6,-3 a2.6,3.2 0 1 0 0.1,0Z M6,-3 a2.6,3.2 0 1 0 0.1,0Z M-2.6,-8 a2.4,3 0 1 0 0.1,0Z M2.6,-8 a2.4,3 0 1 0 0.1,0Z',
  planet: 'M0,-7 a7,7 0 1 1 -0.1,0Z M-12,3 Q0,-3 12,3 M-12,3 Q0,9 12,3',
  rocket: 'M0,-11 Q5,-5 5,2 L-5,2 Q-5,-5 0,-11Z M-5,2 L-8,7 L-3,5 M5,2 L8,7 L3,5 M0,9 L-2,5 L2,5Z',
  dice: 'M-8,-8 L8,-8 L8,8 L-8,8Z M-4,-4 l0,0 M4,-4 l0,0 M0,0 l0,0 M-4,4 l0,0 M4,4 l0,0',
  anchor: 'M0,-10 a2.5,2.5 0 1 1 0.1,0Z M0,-6 L0,10 M-6,-2 L6,-2 M-9,4 Q-9,11 0,11 Q9,11 9,4',
  clover: 'M-4,-5 a3.8,3.8 0 1 0 0.1,0Z M4,-5 a3.8,3.8 0 1 0 0.1,0Z M-4,1.5 a3.8,3.8 0 1 0 0.1,0Z M4,1.5 a3.8,3.8 0 1 0 0.1,0Z M-1,3 L1,3 L1.4,11 L-1.4,11Z',
};

/** Emblems that are strokes rather than fills — a sun has rays, not a body. */
const STROKED = new Set(['sun', 'snowflake', 'note', 'headphones', 'controller', 'coffee', 'planet', 'anchor', 'dice', 'rocket', 'sword', 'diamond']);

/** Emblems whose fill has holes in it — sockets, not overlapping shapes. */
const EVEN_ODD = new Set(['skull', 'paw', 'leaf']);

/**
 * Everyday colour words mapped to the twelve coats. Somebody typing "blue"
 * means lagoon and shouldn't have to find that out.
 */
export const COLOUR_ALIASES = {
  gold: 'honey', yellow: 'honey', amber: 'honey',
  red: 'rust', orange: 'rust', crimson: 'rust',
  blue: 'lagoon', cyan: 'lagoon', teal: 'lagoon', aqua: 'lagoon',
  green: 'moss', lime: 'moss', emerald: 'mint',
  pink: 'bubblegum', magenta: 'bubblegum', rose: 'bubblegum',
  purple: 'plum', violet: 'plum', lilac: 'plum',
  white: 'snow', cream: 'snow', ivory: 'snow',
  black: 'charcoal', dark: 'charcoal',
  grey: 'slate', gray: 'slate', silver: 'slate',
  brown: 'cocoa', chocolate: 'cocoa', tan: 'biscuit', beige: 'biscuit',
};

const coatFor = (word) => (COAT_NAMES.includes(word) ? word : COLOUR_ALIASES[word] || null);

export const CREST_WORDS = [...CREST_SHAPES, ...CREST_PATTERNS, ...CREST_EMBLEMS, ...COAT_NAMES];

export function normaliseCrest(input) {
  // `= {}` would only cover undefined; a record saved with crest: null has to
  // fall back too, or one bad row takes the whole overlay down.
  const crest = input || {};
  return {
    shape: CREST_SHAPES.includes(crest.shape) ? crest.shape : 'circle',
    pattern: CREST_PATTERNS.includes(crest.pattern) ? crest.pattern : 'solid',
    emblem: CREST_EMBLEMS.includes(crest.emblem) ? crest.emblem : 'star',
    primary: COAT_NAMES.includes(crest.primary) ? crest.primary : 'lagoon',
    secondary: COAT_NAMES.includes(crest.secondary) ? crest.secondary : 'honey',
  };
}

/** Light emblem on a dark crest, dark on a light one. Readability, not taste. */
function inkFor(hex) {
  const { h, s, l } = hexToHsl(hex);
  return l > 0.58 ? hslToHex({ h, s: Math.min(1, s * 0.6), l: 0.16 }) : '#FFFFFF';
}

/**
 * @param {object} crest
 * @param {{size?: number, id?: string, title?: string}} [options]
 * @returns {string} an <svg> element
 */
export function renderCrest(crest, options = {}) {
  const c = normaliseCrest(crest);
  const size = options.size || 96;
  const primary = PALETTE[c.primary];
  const secondary = PALETTE[c.secondary];
  const ink = inkFor(primary);
  // One id per distinct crest, so several on a page share definitions instead
  // of colliding — two people with the same crest are the same picture anyway.
  const id = options.id || `gc-crest-${hashKey(`${c.shape}|${c.pattern}|${c.primary}|${c.secondary}`).toString(36)}`;
  const outline = hslToHex({ ...hexToHsl(primary), l: Math.max(0, hexToHsl(primary).l - 0.22) });

  return `<svg class="gc-crest" viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="${options.title || 'avatar'}">
    <defs><clipPath id="${id}"><path d="${SHAPES[c.shape]}"/></clipPath></defs>
    <path d="${SHAPES[c.shape]}" fill="${primary}"/>
    <g clip-path="url(#${id})">${patternFor(c.pattern, secondary)}</g>
    <path d="${SHAPES[c.shape]}" fill="none" stroke="${outline}" stroke-width="3"/>
    <g transform="translate(50,50) scale(1.9)" fill="${STROKED.has(c.emblem) ? 'none' : ink}"
       stroke="${ink}" stroke-width="${STROKED.has(c.emblem) ? 1.7 : 0.9}" stroke-linejoin="round" stroke-linecap="round">
      <path d="${EMBLEMS[c.emblem]}"${EVEN_ODD.has(c.emblem) ? ' fill-rule="evenodd"' : ''}/>
    </g>
  </svg>`;
}

/** Patterns are drawn oversized and clipped to the shape — no per-shape maths. */
function patternFor(pattern, colour) {
  if (pattern === 'solid') return '';
  if (pattern === 'stripes') {
    return [0, 1, 2, 3, 4].map((i) =>
      `<rect x="${-30 + i * 32}" y="-20" width="16" height="140" fill="${colour}" opacity=".55" transform="rotate(18 50 50)"/>`).join('');
  }
  if (pattern === 'dots') {
    const out = [];
    for (let y = 8; y < 100; y += 18) {
      for (let x = (y % 36 === 8 ? 8 : 17); x < 100; x += 18) {
        out.push(`<circle cx="${x}" cy="${y}" r="4.6" fill="${colour}" opacity=".5"/>`);
      }
    }
    return out.join('');
  }
  if (pattern === 'rays') {
    return Array.from({ length: 8 }, (_, i) =>
      `<path d="M50,50 L${50 + 90 * Math.cos((i * 45 - 11) * Math.PI / 180)},${50 + 90 * Math.sin((i * 45 - 11) * Math.PI / 180)} L${50 + 90 * Math.cos((i * 45 + 11) * Math.PI / 180)},${50 + 90 * Math.sin((i * 45 + 11) * Math.PI / 180)}Z" fill="${colour}" opacity=".5"/>`).join('');
  }
  if (pattern === 'checker') {
    const out = [];
    for (let y = 0; y < 100; y += 20) {
      for (let x = (y % 40 === 0 ? 0 : 20); x < 100; x += 40) {
        out.push(`<rect x="${x}" y="${y}" width="20" height="20" fill="${colour}" opacity=".45"/>`);
      }
    }
    return out.join('');
  }
  return '';
}

/**
 * `!avatar <words>` — every word is matched against every list, so a viewer can
 * type "hexagon gold star" or just "dragon-ish nonsense gold" and get whatever
 * part of it made sense. Nobody has to learn which word goes where.
 *
 * @returns {{crest: object, changed: string[], unknown: string[]}}
 */
export function applyAvatarWords(crest, input) {
  const next = normaliseCrest(crest);
  const changed = [];
  const unknown = [];
  const words = String(input || '').toLowerCase().split(/[\s,]+/).filter(Boolean);
  let colourSlot = 0;

  for (const word of words) {
    if (CREST_SHAPES.includes(word)) { next.shape = word; changed.push('shape'); continue; }
    if (CREST_PATTERNS.includes(word)) { next.pattern = word; changed.push('pattern'); continue; }
    if (CREST_EMBLEMS.includes(word)) { next.emblem = word; changed.push('emblem'); continue; }
    const coat = coatFor(word);
    if (coat) {
      // The first colour named is the crest, the second is the pattern on it.
      if (colourSlot === 0) { next.primary = coat; changed.push('colour'); } else { next.secondary = coat; changed.push('second colour'); }
      colourSlot++;
      continue;
    }
    unknown.push(word);
  }

  // A crest of one colour on itself is a blank badge. Nudge it apart.
  if (next.secondary === next.primary) {
    next.secondary = COAT_NAMES[(COAT_NAMES.indexOf(next.primary) + 5) % COAT_NAMES.length];
  }
  return { crest: next, changed: [...new Set(changed)], unknown };
}

/** A crest picked at random, but never one colour on itself. */
export function randomCrest(random = Math.random) {
  const pick = (list) => list[Math.floor(random() * list.length) % list.length];
  const primary = pick(COAT_NAMES);
  let secondary = pick(COAT_NAMES);
  if (secondary === primary) secondary = COAT_NAMES[(COAT_NAMES.indexOf(primary) + 5) % COAT_NAMES.length];
  return { shape: pick(CREST_SHAPES), pattern: pick(CREST_PATTERNS), emblem: pick(CREST_EMBLEMS), primary, secondary };
}

/** Match the crest to the pet someone has out — a one-word way to look tidy. */
export function crestFromPet(crest, pet) {
  if (!pet) return null;
  const primary = COAT_NAMES.includes(pet.colour) ? pet.colour : 'lagoon';
  const base = normaliseCrest(crest);
  let secondary = base.secondary;
  if (secondary === primary) secondary = COAT_NAMES[(COAT_NAMES.indexOf(primary) + 5) % COAT_NAMES.length];
  return { ...base, primary, secondary, emblem: 'paw' };
}

export const CREST_STYLES = `.gc-crest { display: block; }`;
