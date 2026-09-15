/**
 * A coat is one swatch; the outline and belly shades are derived from it in
 * code. Twelve curated coats rather than a hex picker — a free picker produces
 * neon-on-neon that's unreadable over video within a day of launch.
 */
import { PALETTE } from '../profiles.js';

export function hexToHsl(hex) {
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let hue;
  if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) hue = ((b - r) / d + 2) / 6;
  else hue = ((r - g) / d + 4) / 6;
  return { h: hue * 360, s, l };
}

export function hslToHex({ h, s, l }) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const to = (v) => Math.round(Math.max(0, Math.min(1, v + m)) * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

const clamp01 = (n) => Math.max(0, Math.min(1, n));

/** The three shades every creature is drawn with. */
export function coatColours(coatName) {
  const base = PALETTE[coatName] || PALETTE.biscuit;
  const hsl = hexToHsl(base);
  return {
    coat: base,
    // Never black: an outline in the coat's own hue keeps the creature warm.
    outline: hslToHex({ ...hsl, l: clamp01(hsl.l - 0.25), s: clamp01(hsl.s * 0.9) }),
    belly: hslToHex({ h: hsl.h, s: clamp01(hsl.s * 0.8), l: clamp01(hsl.l + 0.2) }),
  };
}

export const EYE_COLOURS = {
  onyx: '#1a1a22', amber: '#E8A33D', sky: '#4DB8E8',
  forest: '#4F9A5E', rose: '#E86A8A', gold: '#E8C15A',
};
