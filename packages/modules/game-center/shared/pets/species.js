/**
 * The creatures.
 *
 * Silhouette rule: fill the creature black at 40px and it must still be
 * identifiable, and differ from every other species in at least two of head
 * shape, ear shape, tail shape, body proportion. Colour never carries identity —
 * viewers recolour their pets, and some viewers are colour-blind.
 *
 * Each species declares an anchor table so accessories can be drawn once and
 * placed on any body shape by transform. Parts are grouped by stage: `base` is
 * always drawn, `features` appears at stage 2, `flourish` at stage 3.
 */

/** Shared eye component — one family look across the whole roster. */
function eyes({ left = 42, right = 58, y = 54, r = 3.2, colour = '#1a1a22', shape = 'round' }) {
  if (shape === 'slit') {
    return `<ellipse cx="${left}" cy="${y}" rx="${r * 0.8}" ry="${r * 1.25}" fill="${colour}"/>
            <ellipse cx="${right}" cy="${y}" rx="${r * 0.8}" ry="${r * 1.25}" fill="${colour}"/>
            <circle cx="${left - 1}" cy="${y - 1.2}" r="0.9" fill="#fff" opacity=".9"/>
            <circle cx="${right - 1}" cy="${y - 1.2}" r="0.9" fill="#fff" opacity=".9"/>`;
  }
  return `<circle cx="${left}" cy="${y}" r="${r}" fill="${colour}"/>
          <circle cx="${right}" cy="${y}" r="${r}" fill="${colour}"/>
          <circle cx="${left - 1}" cy="${y - 1.2}" r="${r * 0.32}" fill="#fff" opacity=".9"/>
          <circle cx="${right - 1}" cy="${y - 1.2}" r="${r * 0.32}" fill="#fff" opacity=".9"/>`;
}

export const SPECIES = {
  dog: {
    id: 'dog', label: 'Dog', tier: 1, favourite: 'fish',
    personality: 'Loves you loudly. Has never had a bad day.',
    stageNames: ['Pup', 'Good Dog', 'Big Dog', 'Goodest Boy'],
    anchors: { hat: { x: 50, y: 26, scale: 0.95 }, face: { x: 50, y: 54, scale: 1 }, neck: { x: 50, y: 70, scale: 1 }, back: { x: 50, y: 66, scale: 1 }, paw: { x: 66, y: 82, scale: 0.9 } },
    draw: ({ c, eye, has }) => ({
      back: `<path d="M74,68 q18,4 12,22 q-6,-2 -8,-10" fill="${c.coat}" stroke="${c.outline}" stroke-width="2" stroke-linejoin="round"/>`,
      body: `<ellipse cx="50" cy="70" rx="17" ry="15" fill="${c.coat}" stroke="${c.outline}" stroke-width="2"/>
             ${has('features') ? `<ellipse cx="50" cy="75" rx="10" ry="8" fill="${c.belly}"/>` : ''}
             ${has('flourish') ? `<path d="M36,62 q14,8 28,0 q-6,7 -14,7 q-8,0 -14,-7Z" fill="${c.belly}" stroke="${c.outline}" stroke-width="1.5"/>` : ''}`,
      head: `<path d="M31,42 q-7,12 -1,22 q7,-3 8,-16Z" fill="${c.coat}" stroke="${c.outline}" stroke-width="2" stroke-linejoin="round"/>
             <path d="M69,42 q7,12 1,22 q-7,-3 -8,-16Z" fill="${c.coat}" stroke="${c.outline}" stroke-width="2" stroke-linejoin="round"/>
             <circle cx="50" cy="45" r="18" fill="${c.coat}" stroke="${c.outline}" stroke-width="2"/>
             <ellipse cx="50" cy="53" rx="10" ry="7" fill="${c.belly}"/>
             <ellipse cx="50" cy="49" rx="3.4" ry="2.6" fill="${c.outline}"/>
             ${eye({ y: 42 })}
             ${has('features') ? '<path d="M47,57 q3,5 6,0" stroke="#E86A8A" stroke-width="2.5" fill="none" stroke-linecap="round"/>' : ''}`,
      feet: `<ellipse cx="41" cy="84" rx="6" ry="3.5" fill="${c.coat}" stroke="${c.outline}" stroke-width="1.5"/>
             <ellipse cx="59" cy="84" rx="6" ry="3.5" fill="${c.coat}" stroke="${c.outline}" stroke-width="1.5"/>`,
    }),
  },

  cat: {
    id: 'cat', label: 'Cat', tier: 1, favourite: 'fish',
    personality: 'Judges you silently. Accepts fish as an apology.',
    stageNames: ['Kitten', 'Cat', 'Chonk', 'The Landlord'],
    anchors: { hat: { x: 50, y: 22, scale: 0.9 }, face: { x: 50, y: 54, scale: 1 }, neck: { x: 50, y: 68, scale: 1 }, back: { x: 50, y: 70, scale: 1 }, paw: { x: 64, y: 84, scale: 0.85 } },
    draw: ({ c, eye, has, stage }) => ({
      back: `<path d="M67,74 q20,-2 16,-22 q-1,-6 -5,-8" stroke="${c.coat}" stroke-width="6" fill="none" stroke-linecap="round"/>
             <path d="M67,74 q20,-2 16,-22 q-1,-6 -5,-8" stroke="${c.outline}" stroke-width="8" fill="none" stroke-linecap="round" opacity=".28"/>`,
      body: `<ellipse cx="50" cy="72" rx="${stage >= 3 ? 17 : 13}" ry="14" fill="${c.coat}" stroke="${c.outline}" stroke-width="2"/>
             ${has('features') ? `<ellipse cx="50" cy="76" rx="8" ry="7" fill="${c.belly}"/>` : ''}
             ${has('flourish') ? `<ellipse cx="50" cy="74" rx="11" ry="9" fill="${c.belly}" opacity=".7"/>` : ''}`,
      head: `<path d="M33,38 l-3,-18 l16,9Z" fill="${c.coat}" stroke="${c.outline}" stroke-width="2" stroke-linejoin="round"/>
             <path d="M67,38 l3,-18 l-16,9Z" fill="${c.coat}" stroke="${c.outline}" stroke-width="2" stroke-linejoin="round"/>
             <path d="M36,33 l-1,-9 l8,4Z" fill="${c.belly}"/>
             <path d="M64,33 l1,-9 l-8,4Z" fill="${c.belly}"/>
             <circle cx="50" cy="46" r="17" fill="${c.coat}" stroke="${c.outline}" stroke-width="2"/>
             ${eye({ y: 44, shape: 'slit' })}
             <path d="M48,52 q2,3 4,0" stroke="${c.outline}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
             ${has('features') ? `<g stroke="${c.outline}" stroke-width="1.2" stroke-linecap="round" opacity=".8">
               <path d="M34,50 l-11,-3"/><path d="M34,53 l-11,1"/><path d="M66,50 l11,-3"/><path d="M66,53 l11,1"/></g>` : ''}`,
      feet: `<ellipse cx="43" cy="85" rx="5" ry="3" fill="${c.coat}" stroke="${c.outline}" stroke-width="1.5"/>
             <ellipse cx="57" cy="85" rx="5" ry="3" fill="${c.coat}" stroke="${c.outline}" stroke-width="1.5"/>`,
    }),
  },

  duck: {
    id: 'duck', label: 'Duck', tier: 1, favourite: 'apple',
    personality: 'Chaotic. Screams. Admits no crimes.',
    stageNames: ['Duckling', 'Duck', 'Big Duck', 'Lord of the Pond'],
    locked: { bill: '#E8963D', feet: '#E8963D' },
    anchors: { hat: { x: 44, y: 24, scale: 0.85 }, face: { x: 44, y: 40, scale: 0.9 }, neck: { x: 48, y: 56, scale: 0.95 }, back: { x: 54, y: 68, scale: 1 }, paw: { x: 66, y: 80, scale: 0.85 } },
    draw: ({ c, eye, has, locked }) => ({
      back: `<path d="M70,62 l14,-8 l-2,10Z" fill="${c.coat}" stroke="${c.outline}" stroke-width="2" stroke-linejoin="round"/>`,
      body: `<ellipse cx="52" cy="66" rx="20" ry="16" fill="${c.coat}" stroke="${c.outline}" stroke-width="2"/>
             ${has('features') ? `<path d="M40,62 q12,-4 20,4 q-10,8 -20,-4Z" fill="${c.belly}" stroke="${c.outline}" stroke-width="1.2"/>` : ''}
             ${has('flourish') ? `<ellipse cx="54" cy="72" rx="12" ry="7" fill="${c.belly}" opacity=".6"/>` : ''}`,
      head: `<circle cx="42" cy="40" r="13" fill="${c.coat}" stroke="${c.outline}" stroke-width="2"/>
             <rect x="20" y="40" width="17" height="8" rx="4" fill="${locked.bill}" stroke="${c.outline}" stroke-width="1.6"/>
             ${eye({ left: 39, right: 47, y: 36, r: 2.8 })}`,
      feet: `<path d="M44,82 l-7,5 l14,0Z" fill="${locked.feet}" stroke="${c.outline}" stroke-width="1.4" stroke-linejoin="round"/>
             <path d="M60,82 l-7,5 l14,0Z" fill="${locked.feet}" stroke="${c.outline}" stroke-width="1.4" stroke-linejoin="round"/>`,
    }),
  },

  frog: {
    id: 'frog', label: 'Frog', tier: 1, favourite: 'kibble',
    personality: 'Zen. Occasionally licks something it should not.',
    stageNames: ['Tadpole', 'Frog', 'Big Frog', 'Pond Sage'],
    anchors: { hat: { x: 50, y: 34, scale: 1.05 }, face: { x: 50, y: 46, scale: 1.1 }, neck: { x: 50, y: 72, scale: 1 }, back: { x: 50, y: 64, scale: 1 }, paw: { x: 70, y: 80, scale: 0.9 } },
    draw: ({ c, eye, has }) => ({
      back: '',
      body: `<ellipse cx="50" cy="64" rx="24" ry="18" fill="${c.coat}" stroke="${c.outline}" stroke-width="2"/>
             ${has('features') ? `<ellipse cx="50" cy="70" rx="15" ry="10" fill="${c.belly}"/>` : ''}
             ${has('flourish') ? `<g fill="${c.outline}" opacity=".35"><circle cx="34" cy="58" r="2.4"/><circle cx="64" cy="61" r="2"/><circle cx="52" cy="53" r="1.8"/></g>` : ''}`,
      head: `<circle cx="37" cy="45" r="8.5" fill="${c.coat}" stroke="${c.outline}" stroke-width="2"/>
             <circle cx="63" cy="45" r="8.5" fill="${c.coat}" stroke="${c.outline}" stroke-width="2"/>
             ${eye({ left: 37, right: 63, y: 45, r: 3.6 })}
             <path d="M36,66 q14,7 28,0" stroke="${c.outline}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
      feet: `<path d="M32,80 q-8,4 -10,6 q6,1 12,-2Z" fill="${c.coat}" stroke="${c.outline}" stroke-width="1.5" stroke-linejoin="round"/>
             <path d="M68,80 q8,4 10,6 q-6,1 -12,-2Z" fill="${c.coat}" stroke="${c.outline}" stroke-width="1.5" stroke-linejoin="round"/>`,
    }),
  },

  dragon: {
    id: 'dragon', label: 'Dragon', tier: 'mythic', favourite: 'cake',
    personality: 'Enormous ego, tiny patience, secretly soft about you.',
    stageNames: ['Wyrmling', 'Dragon', 'Elder Dragon', 'Ancient'],
    earnedBy: { stat: 'bossTopDamage', need: 5, label: 'be top damage in 5 raid bosses' },
    anchors: { hat: { x: 50, y: 24, scale: 1 }, face: { x: 50, y: 48, scale: 1 }, neck: { x: 50, y: 66, scale: 1 }, back: { x: 50, y: 62, scale: 1.1 }, paw: { x: 68, y: 82, scale: 0.9 } },
    draw: ({ c, eye, has, stage }) => ({
      back: `<path d="M28,56 q-20,-14 -6,-28 q4,14 14,20Z" fill="${c.coat}" stroke="${c.outline}" stroke-width="2" stroke-linejoin="round" opacity="${stage >= 2 ? 1 : 0.55}" transform="${stage >= 2 ? '' : 'translate(10,10) scale(0.6)'}"/>
             <path d="M72,56 q20,-14 6,-28 q-4,14 -14,20Z" fill="${c.coat}" stroke="${c.outline}" stroke-width="2" stroke-linejoin="round" opacity="${stage >= 2 ? 1 : 0.55}" transform="${stage >= 2 ? '' : 'translate(-10,10) scale(0.6)'}"/>
             <path d="M74,72 q22,0 18,-26 l5,7" stroke="${c.coat}" stroke-width="6" fill="none" stroke-linecap="round"/>
             <path d="M92,44 l8,-4 l-3,9Z" fill="${c.coat}" stroke="${c.outline}" stroke-width="1.6" stroke-linejoin="round"/>`,
      body: `<ellipse cx="50" cy="68" rx="18" ry="15" fill="${c.coat}" stroke="${c.outline}" stroke-width="2"/>
             ${has('features') ? `<g fill="${c.belly}"><rect x="42" y="62" width="16" height="4" rx="2"/><rect x="42" y="68" width="16" height="4" rx="2"/><rect x="42" y="74" width="16" height="4" rx="2"/></g>` : ''}
             ${has('features') ? `<g fill="${c.outline}"><path d="M50,50 l4,6 l-8,0Z"/><path d="M58,56 l4,6 l-8,0Z"/><path d="M42,56 l4,6 l-8,0Z"/></g>` : ''}`,
      head: `<path d="M38,32 l-6,-14 l14,7Z" fill="${c.coat}" stroke="${c.outline}" stroke-width="2" stroke-linejoin="round"/>
             <path d="M62,32 l6,-14 l-14,7Z" fill="${c.coat}" stroke="${c.outline}" stroke-width="2" stroke-linejoin="round"/>
             ${has('flourish') ? `<path d="M33,36 l-9,-9 l13,3Z" fill="${c.coat}" stroke="${c.outline}" stroke-width="1.6" stroke-linejoin="round"/>
               <path d="M67,36 l9,-9 l-13,3Z" fill="${c.coat}" stroke="${c.outline}" stroke-width="1.6" stroke-linejoin="round"/>` : ''}
             <ellipse cx="50" cy="45" rx="17" ry="15" fill="${c.coat}" stroke="${c.outline}" stroke-width="2"/>
             <ellipse cx="50" cy="53" rx="8" ry="5" fill="${c.belly}"/>
             <circle cx="46" cy="52" r="1.2" fill="${c.outline}"/><circle cx="54" cy="52" r="1.2" fill="${c.outline}"/>
             ${eye({ y: 43 })}`,
      feet: `<ellipse cx="42" cy="83" rx="6" ry="3.5" fill="${c.coat}" stroke="${c.outline}" stroke-width="1.5"/>
             <ellipse cx="58" cy="83" rx="6" ry="3.5" fill="${c.coat}" stroke="${c.outline}" stroke-width="1.5"/>`,
    }),
  },
};

export const SPECIES_LIST = Object.values(SPECIES);
export const STARTER_SPECIES = SPECIES_LIST.filter((s) => s.tier === 1).map((s) => s.id);
export const MYTHIC_SPECIES = SPECIES_LIST.filter((s) => s.tier === 'mythic').map((s) => s.id);
export { eyes as eyeComponent };
