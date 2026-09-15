/**
 * Draws a pet as inline SVG. Pure: same input, same markup, in Node or browser.
 *
 * A stage is not a redraw — it's the same parts at different proportions plus
 * additive groups. That is what makes several species with four stages each
 * tractable to maintain.
 */
import { SPECIES } from './species.js';
import { coatColours, EYE_COLOURS } from './colours.js';
import { stageForLevel } from './model.js';
import { eyeComponent } from './species.js';

const HEAD_ORIGIN = { x: 50, y: 45 };
const BODY_ORIGIN = { x: 50, y: 70 };

/** Scale a group about a point, so parts grow from where they attach. */
function about(origin, scale, inner) {
  if (scale === 1) return inner;
  return `<g transform="translate(${origin.x},${origin.y}) scale(${scale}) translate(${-origin.x},${-origin.y})">${inner}</g>`;
}

/**
 * @param {{species: string, colour?: string, eyes?: string, level?: number,
 *          accessories?: object, size?: number, idle?: boolean}} pet
 * @param {{accessories?: object}} [options] accessory definitions, by id
 * @returns {string} an <svg> element
 */
export function renderPet(pet, options = {}) {
  const species = SPECIES[pet.species];
  if (!species) return '';
  const level = Math.max(1, pet.level || 1);
  const stageDef = stageForLevel(level);
  const c = coatColours(pet.colour);
  const eyeColour = EYE_COLOURS[pet.eyes] || EYE_COLOURS.onyx;
  const has = (group) => stageDef.groups.includes(group);

  // The eye component carries the stage's eye scale, so a stage-1 pet has the
  // oversized eyes that make it read as a baby.
  const eye = (opts = {}) => eyeComponent({
    ...opts,
    r: (opts.r ?? 3.2) * stageDef.eyeScale,
    colour: eyeColour,
  });

  const parts = species.draw({ c, eye, has, stage: stageDef.stage, locked: species.locked || {} });
  const slots = renderAccessories(species, pet.accessories || {}, options.accessories || {}, stageDef.stage);

  const aura = has('aura')
    ? `<circle cx="50" cy="60" r="40" fill="${c.coat}" opacity=".22"/>
       <g class="gc-sparkle" opacity=".9">
         <path d="M20,30 l1.6,4 4,1.6 -4,1.6 -1.6,4 -1.6,-4 -4,-1.6 4,-1.6Z" fill="#ffd24d"/>
         <path d="M82,36 l1.3,3.2 3.2,1.3 -3.2,1.3 -1.3,3.2 -1.3,-3.2 -3.2,-1.3 3.2,-1.3Z" fill="#ffd24d"/>
         <path d="M76,78 l1.1,2.8 2.8,1.1 -2.8,1.1 -1.1,2.8 -1.1,-2.8 -2.8,-1.1 2.8,-1.1Z" fill="#ffd24d"/>
       </g>` : '';

  const size = pet.size || 100;
  return `<svg class="gc-pet" viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="${species.label}">
    ${aura}
    ${slots.back}
    ${parts.back || ''}
    ${about(BODY_ORIGIN, stageDef.bodyScale, `${parts.feet || ''}${parts.body || ''}`)}
    ${slots.neck}
    ${about(HEAD_ORIGIN, stageDef.headScale, parts.head || '')}
    ${slots.face}
    ${slots.hat}
    ${slots.paw}
  </svg>`;
}

/**
 * Accessories are drawn once in their own 40x40 box with the attach point at
 * the origin, then placed by the species' anchor. One hat definition therefore
 * sits correctly on every body shape.
 */
function renderAccessories(species, worn, definitions, stage) {
  const out = { hat: '', face: '', neck: '', back: '', paw: '' };
  for (const [slot, id] of Object.entries(worn)) {
    if (!(slot in out) || !id) continue;
    // Capes and wings change the silhouette, so that slot is the prestige tier.
    if (slot === 'back' && stage < 3) continue;
    const def = definitions[id];
    const anchor = species.anchors?.[slot];
    if (!def || !anchor) continue;
    const rotate = anchor.rotate ? ` rotate(${anchor.rotate})` : '';
    out[slot] = `<g transform="translate(${anchor.x},${anchor.y}) scale(${anchor.scale})${rotate}">${def.svg}</g>`;
  }
  return out;
}

/** The CSS a page needs for the idle motion. Kept with the renderer. */
export const PET_STYLES = `
.gc-pet { overflow: visible; }
.gc-pet .gc-sparkle { transform-origin: 50px 60px; animation: gc-orbit 8s linear infinite; }
@keyframes gc-orbit { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .gc-pet .gc-sparkle { animation: none; } }
`;
