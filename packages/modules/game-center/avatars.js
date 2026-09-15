/**
 * `!avatar` — changing the crest. The rules are pure (shared/crest.js); this
 * layer saves and phrases the reply.
 */
import { applyAvatarWords, randomCrest, crestFromPet, normaliseCrest } from './shared/crest.js';
import { CREST_SHAPES, CREST_PATTERNS, CREST_EMBLEMS, COAT_NAMES, defaultCrest } from './shared/profiles.js';

export function createAvatars({ profiles, pets, log }) {
  return {
    /**
     * One command, every list. "random" and "pet" are the two shortcuts; any
     * other words are matched against shapes, patterns, emblems and colours.
     */
    set(profile, input, { random = Math.random } = {}) {
      const words = String(input || '').trim().toLowerCase();

      if (!words) {
        const c = normaliseCrest(profile.crest);
        return {
          ok: true, crest: c, unchanged: true,
          message: `your avatar is a ${c.primary} ${c.shape} with a ${c.emblem} — try !avatar ${sample(random)} or !avatar random`,
        };
      }

      if (words === 'random') {
        profile.crest = randomCrest(random);
        profiles.touch();
        return { ok: true, crest: profile.crest, message: `new avatar: a ${profile.crest.primary} ${profile.crest.shape} with a ${profile.crest.emblem}` };
      }

      if (words === 'reset' || words === 'default') {
        profile.crest = defaultCrest(`${profile.platform}:${profile.name.toLowerCase()}`);
        profiles.touch();
        return { ok: true, crest: profile.crest, message: 'avatar back to the one you started with' };
      }

      if (words === 'pet') {
        const crest = crestFromPet(profile.crest, pets?.activePetOf(profile));
        if (!crest) return { ok: false, message: 'you have no pet to match — adopt one with !adopt' };
        profile.crest = crest;
        profiles.touch();
        return { ok: true, crest, message: `avatar matched to your pet — ${crest.primary} with a paw` };
      }

      const { crest, changed, unknown } = applyAvatarWords(profile.crest, words);
      if (!changed.length) {
        return {
          ok: false,
          message: `didn't recognise ${unknown.slice(0, 3).map((w) => `"${w}"`).join(', ')} — try a shape (${CREST_SHAPES.slice(0, 3).join('/')}), a pattern (${CREST_PATTERNS.slice(0, 3).join('/')}), a colour, or anything from !avatar list`,
        };
      }
      profile.crest = crest;
      profiles.touch();
      const ignored = unknown.length ? ` (ignored ${unknown.slice(0, 2).map((w) => `"${w}"`).join(', ')})` : '';
      return { ok: true, crest, changed, message: `avatar updated: ${changed.join(', ')}${ignored}` };
    },

    /** The vocabulary, for anyone who wants to see it rather than guess. */
    words() {
      return { shapes: CREST_SHAPES, patterns: CREST_PATTERNS, emblems: CREST_EMBLEMS, colours: COAT_NAMES };
    },
  };
}

/** A different suggestion each time, so the help line isn't the same forever. */
function sample(random) {
  const pick = (list) => list[Math.floor(random() * list.length) % list.length];
  return `${pick(CREST_SHAPES)} ${pick(COAT_NAMES)} ${pick(CREST_EMBLEMS)}`;
}
