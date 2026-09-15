/**
 * Accessories.
 *
 * Each is drawn once in its own small box with the ATTACH POINT AT THE ORIGIN —
 * hats hang from bottom-centre, held items from the grip — and the species'
 * anchor table places it. That is why one definition works on every body shape.
 *
 * Animation is a CSS transform on the group and nothing else: OBS's browser
 * source is a CEF instance and a dozen animated filters will stutter.
 */

export const RARITY = {
  common: { label: 'Common', price: 75 },
  uncommon: { label: 'Uncommon', price: 200 },
  rare: { label: 'Rare', price: 600 },
  epic: { label: 'Epic', price: 2000 },
  legendary: { label: 'Legendary', price: null },
};

export const SLOTS = ['hat', 'face', 'neck', 'back', 'paw'];
export const SLOT_LABELS = { hat: 'Hat', face: 'Face', neck: 'Neck', back: 'Back', paw: 'Held' };

const a = (id, slot, label, rarity, svg, extra = {}) => ({ id, slot, label, rarity, svg, ...extra });

export const ACCESSORIES = Object.fromEntries([
  // ---- hats (attach: bottom-centre sits on the head anchor) ----------------
  a('partyhat', 'hat', 'Party Hat', 'common',
    '<path d="M0,-26 l9,22 l-18,0Z" fill="#E98BB4" stroke="#7a3f59" stroke-width="1.6" stroke-linejoin="round"/><path d="M-6,-10 l12,0" stroke="#F2F0EA" stroke-width="2"/><circle cy="-27" r="3" fill="#E8C15A"/>'),
  a('beanie', 'hat', 'Beanie', 'common',
    '<path d="M-11,-4 a11,11 0 0 1 22,0Z" fill="#3E9BB0" stroke="#1f464f" stroke-width="1.6"/><rect x="-12" y="-5" width="24" height="5" rx="2.5" fill="#2b7183"/><circle cy="-16" r="3.2" fill="#F2F0EA"/>'),
  a('flower', 'hat', 'Flower', 'common',
    '<g fill="#E98BB4"><circle cx="-5" cy="-8" r="4"/><circle cx="5" cy="-8" r="4"/><circle cx="0" cy="-13" r="4"/><circle cx="-3" cy="-3" r="4"/><circle cx="3" cy="-3" r="4"/></g><circle cy="-7" r="3" fill="#E8C15A"/>'),
  a('cap', 'hat', 'Cap', 'uncommon',
    '<path d="M-10,-3 a10,10 0 0 1 20,0Z" fill="#C1583A" stroke="#6b2e1d" stroke-width="1.6"/><ellipse cx="9" cy="-2" rx="9" ry="3" fill="#a3462e"/>'),
  a('cowboy', 'hat', 'Cowboy Hat', 'uncommon',
    '<ellipse cy="-3" rx="19" ry="5" fill="#6B4A35" stroke="#3d2a1e" stroke-width="1.5"/><path d="M-8,-4 q0,-13 8,-13 q8,0 8,13Z" fill="#7d5840" stroke="#3d2a1e" stroke-width="1.5" stroke-linejoin="round"/>'),
  a('wizard', 'hat', 'Wizard Hat', 'rare',
    '<path d="M0,-32 q7,18 11,28 l-22,0 q4,-10 11,-28Z" fill="#7D5BA6" stroke="#42305c" stroke-width="1.6" stroke-linejoin="round"/><ellipse cy="-3" rx="15" ry="4" fill="#5e458a"/><path d="M0,-22 l1.6,4 4,1.6 -4,1.6 -1.6,4 -1.6,-4 -4,-1.6 4,-1.6Z" fill="#E8C15A"/>'),
  a('halo', 'hat', 'Halo', 'rare',
    '<ellipse cy="-18" rx="11" ry="3.6" fill="none" stroke="#E8C15A" stroke-width="3"/>', { animate: 'gc-bob' }),
  a('chef', 'hat', 'Chef Hat', 'rare',
    '<g fill="#F2F0EA" stroke="#bfb79d" stroke-width="1.4"><circle cx="-7" cy="-16" r="7"/><circle cx="7" cy="-16" r="7"/><circle cy="-20" r="7.5"/></g><rect x="-9" y="-11" width="18" height="8" rx="2" fill="#F2F0EA" stroke="#bfb79d" stroke-width="1.4"/>'),
  a('crown', 'hat', 'Crown', 'epic',
    '<path d="M-12,-4 l2.5,-15 l5.5,7 l4,-11 l4,11 l5.5,-7 l2.5,15Z" fill="#E8C15A" stroke="#9c7d1f" stroke-width="1.6" stroke-linejoin="round"/><circle cy="-11" r="2.2" fill="#C1583A"/>'),
  a('champhelm', 'hat', 'Raid Champion Helm', 'legendary',
    '<path d="M-11,-4 a11,12 0 0 1 22,0Z" fill="#6C7A89" stroke="#38424d" stroke-width="1.6"/><path d="M-11,-8 l-7,-9 l7,2Z" fill="#C1583A" stroke="#6b2e1d" stroke-width="1.4" stroke-linejoin="round"/><path d="M11,-8 l7,-9 l-7,2Z" fill="#C1583A" stroke="#6b2e1d" stroke-width="1.4" stroke-linejoin="round"/><rect x="-2" y="-16" width="4" height="13" fill="#E8C15A"/>',
    { earnedBy: { stat: 'bossTopDamage', need: 25, label: 'top damage in 25 raid bosses' } }),

  // ---- face (attach: centre between the eyes) ------------------------------
  a('glasses', 'face', 'Round Glasses', 'common',
    '<g fill="none" stroke="#2b2b35" stroke-width="1.8"><circle cx="-8" r="5.5"/><circle cx="8" r="5.5"/><path d="M-2.5,0 l5,0"/></g>'),
  a('sunglasses', 'face', 'Sunglasses', 'uncommon',
    '<g fill="#23233a"><rect x="-14" y="-4" width="12" height="8" rx="3"/><rect x="2" y="-4" width="12" height="8" rx="3"/><rect x="-3" y="-2" width="6" height="2"/></g>'),
  a('monocle', 'face', 'Monocle', 'uncommon',
    '<circle cx="8" r="6" fill="none" stroke="#E8C15A" stroke-width="2"/><path d="M8,6 q2,8 8,9" stroke="#E8C15A" stroke-width="1.4" fill="none"/>'),
  a('eyepatch', 'face', 'Eyepatch', 'uncommon',
    '<path d="M-16,-3 l30,-2" stroke="#2b2b35" stroke-width="2"/><circle cx="-8" r="6" fill="#2b2b35"/>'),
  a('hearteyes', 'face', 'Heart Eyes', 'rare',
    '<g fill="#E86A8A"><path d="M-8,-4 q3,-4 5,0 q2,-4 5,0 q0,4 -5,7 q-5,-3 -5,-7Z"/><path d="M4,-4 q3,-4 5,0 q2,-4 5,0 q0,4 -5,7 q-5,-3 -5,-7Z"/></g>', { hidesEyes: true }),
  a('starshades', 'face', 'Star Shades', 'epic',
    '<g fill="#7D5BA6" stroke="#E8C15A" stroke-width="1.2"><path d="M-9,-6 l2,5 l5,1 -4,3 1,5 -4,-3 -4,3 1,-5 -4,-3 5,-1Z"/><path d="M9,-6 l2,5 l5,1 -4,3 1,5 -4,-3 -4,3 1,-5 -4,-3 5,-1Z"/></g>'),

  // ---- neck ---------------------------------------------------------------
  a('bandana', 'neck', 'Bandana', 'common',
    '<path d="M-13,-2 q13,7 26,0 l-5,9 q-8,3 -16,0Z" fill="#C1583A" stroke="#6b2e1d" stroke-width="1.4" stroke-linejoin="round"/>'),
  a('collar', 'neck', 'Collar & Tag', 'common',
    '<path d="M-13,-1 q13,7 26,0 l0,4 q-13,7 -26,0Z" fill="#7D5BA6" stroke="#42305c" stroke-width="1.2"/><circle cy="8" r="3.4" fill="#E8C15A" stroke="#9c7d1f" stroke-width="1"/>'),
  a('bowtie', 'neck', 'Bow Tie', 'uncommon',
    '<path d="M-11,-5 l0,10 l9,-5Z" fill="#C1583A" stroke="#6b2e1d" stroke-width="1.2" stroke-linejoin="round"/><path d="M11,-5 l0,10 l-9,-5Z" fill="#C1583A" stroke="#6b2e1d" stroke-width="1.2" stroke-linejoin="round"/><rect x="-2.5" y="-3" width="5" height="6" rx="1.5" fill="#8f3f28"/>'),
  a('scarf', 'neck', 'Scarf', 'uncommon',
    '<path d="M-13,-2 q13,8 26,0 l0,5 q-13,7 -26,0Z" fill="#3E9BB0" stroke="#1f464f" stroke-width="1.2"/><g class="gc-sway"><path d="M8,3 l6,13 l-6,2 l-3,-13Z" fill="#3E9BB0" stroke="#1f464f" stroke-width="1.2" stroke-linejoin="round"/></g>'),
  a('goldchain', 'neck', 'Gold Chain', 'rare',
    '<g fill="#E8C15A"><circle cx="-12" cy="0" r="2"/><circle cx="-8" cy="3" r="2"/><circle cx="-4" cy="5" r="2"/><circle cx="0" cy="6" r="2"/><circle cx="4" cy="5" r="2"/><circle cx="8" cy="3" r="2"/><circle cx="12" cy="0" r="2"/></g>'),

  // ---- back (stage 3+; these change the silhouette) ------------------------
  a('cape', 'back', 'Cape', 'rare',
    '<path d="M-14,-8 q14,6 28,0 l6,30 q-20,7 -40,0Z" fill="#C1583A" stroke="#6b2e1d" stroke-width="1.6" stroke-linejoin="round"/>', { animate: 'gc-sway' }),
  a('backpack', 'back', 'Backpack', 'rare',
    '<rect x="-11" y="-6" width="22" height="24" rx="5" fill="#6B4A35" stroke="#3d2a1e" stroke-width="1.6"/><rect x="-8" y="2" width="16" height="7" rx="2" fill="#8a6247"/>'),
  a('fairywings', 'back', 'Fairy Wings', 'epic',
    '<g fill="#8FD3B6" opacity=".62" stroke="#3f7a63" stroke-width="1.2"><path d="M-4,-4 q-22,-16 -16,4 q4,14 16,6Z"/><path d="M4,-4 q22,-16 16,4 q-4,14 -16,6Z"/></g>'),
  a('angelwings', 'back', 'Angel Wings', 'epic',
    '<g fill="#F2F0EA" stroke="#bfb79d" stroke-width="1.4"><path d="M-4,-2 q-20,-14 -20,6 q0,12 10,10 q8,-2 10,-16Z"/><path d="M4,-2 q20,-14 20,6 q0,12 -10,10 q-8,-2 -10,-16Z"/></g>'),

  // ---- held (attach: the grip) --------------------------------------------
  a('coffee', 'paw', 'Coffee Cup', 'common',
    '<rect x="-5" y="-2" width="10" height="11" rx="2" fill="#F2F0EA" stroke="#8a8375" stroke-width="1.3"/><path d="M5,1 q5,2 0,5" stroke="#8a8375" stroke-width="1.3" fill="none"/><rect x="-5" y="-2" width="10" height="3" fill="#6B4A35"/><g stroke="#cfd6db" stroke-width="1.2" fill="none" opacity=".8"><path d="M-2,-5 q2,-3 0,-6"/><path d="M2,-5 q2,-3 0,-6"/></g>'),
  a('balloon', 'paw', 'Balloon', 'common',
    '<path d="M0,0 q1,-8 1,-12" stroke="#8a8375" stroke-width="1" fill="none"/><ellipse cy="-18" rx="7" ry="8.5" fill="#E86A8A" stroke="#8f3f52" stroke-width="1.3"/>', { animate: 'gc-float' }),
  a('flag', 'paw', 'Podium Flag', 'common',
    '<rect x="-1" y="-18" width="2" height="22" fill="#6B4A35"/><path d="M1,-18 l14,4 l-14,4Z" fill="#E8C15A" stroke="#9c7d1f" stroke-width="1.1" stroke-linejoin="round"/>',
    { earnedBy: { stat: 'racePodium', need: 1, label: 'finish a race on the podium' } }),
  a('foamsword', 'paw', 'Foam Sword', 'rare',
    '<rect x="-2.5" y="-22" width="5" height="20" rx="2" fill="#3E9BB0" stroke="#1f464f" stroke-width="1.2"/><rect x="-7" y="-3" width="14" height="3.5" rx="1.5" fill="#E8C15A"/><rect x="-2" y="0" width="4" height="6" rx="1.5" fill="#6B4A35"/>'),
  a('controller', 'paw', 'Controller', 'rare',
    '<rect x="-10" y="-5" width="20" height="10" rx="5" fill="#4A4A55" stroke="#22222a" stroke-width="1.3"/><circle cx="-5" cy="0" r="1.6" fill="#8FD3B6"/><circle cx="4" cy="-2" r="1.4" fill="#E86A8A"/><circle cx="7" cy="1" r="1.4" fill="#E8C15A"/>'),
  a('heistbag', 'paw', 'Heist Bag', 'legendary',
    '<path d="M-8,-2 q8,-6 16,0 l2,14 q-10,4 -20,0Z" fill="#4A4A55" stroke="#22222a" stroke-width="1.4" stroke-linejoin="round"/><path d="M-4,-3 q4,-4 8,0" stroke="#22222a" stroke-width="1.4" fill="none"/><text x="0" y="10" font-size="8" text-anchor="middle" fill="#E8C15A" font-family="system-ui">$</text>',
    { earnedBy: { stat: 'heistSurvived', need: 50, label: 'survive 50 heists' } }),
].map((item) => [item.id, item]));

export const ACCESSORY_LIST = Object.values(ACCESSORIES);

export const priceOf = (item) => (item?.earnedBy ? null : RARITY[item?.rarity]?.price ?? null);

export function accessoriesForSlot(slot) {
  return ACCESSORY_LIST.filter((item) => item.slot === slot);
}

/** CSS for the small movements. Transform and opacity only. */
export const ACCESSORY_STYLES = `
.gc-pet .gc-sway { transform-origin: 0 0; animation: gc-sway 3.2s ease-in-out infinite; }
.gc-pet .gc-float { animation: gc-float 2.6s ease-in-out infinite; }
@keyframes gc-sway { 0%,100% { transform: rotate(-4deg); } 50% { transform: rotate(6deg); } }
@keyframes gc-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
@keyframes gc-bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
@media (prefers-reduced-motion: reduce) {
  .gc-pet .gc-sway, .gc-pet .gc-float { animation: none; }
}
`;
