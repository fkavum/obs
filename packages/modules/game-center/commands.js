/**
 * Chat commands the Game Center answers.
 *
 * Two routes for a reply, in this order: a card on the overlay (works for
 * everyone, always), and a one-line chat reply (only when a platform is signed
 * in). Nothing here may *depend* on the chat reply — most viewers will be on a
 * channel where the bot can't talk.
 */
import { formatCoins } from './shared/profiles.js';
import { SPECIES, STARTER_SPECIES } from './shared/pets/species.js';
import { FOODS } from './shared/pets/model.js';
import { SLOTS, SLOT_LABELS, EYE_NAMES } from './shared/pets/wardrobe.js';
import { COAT_NAMES } from './shared/profiles.js';

const COOLDOWN_MS = 30000;

export function createCommands({ profiles, games, pets, wardrobe, avatars, hub, log }) {
  const lastUse = new Map();

  function onCooldown(key, command, now) {
    const id = `${command}:${key}`;
    const last = lastUse.get(id) || 0;
    if (now - last < COOLDOWN_MS) return true;
    lastUse.set(id, now);
    // A long stream would otherwise grow this map without bound.
    if (lastUse.size > 500) {
      for (const [k, t] of lastUse) if (now - t > COOLDOWN_MS * 4) lastUse.delete(k);
    }
    return false;
  }

  /** Card first, chat reply if it happens to be possible. */
  function reply(event, card, text) {
    hub.broadcast?.({ type: 'gc:card', card });
    if (text) hub.say?.(event.platform, text).catch(() => {});
  }

  return {
    /** @returns {boolean} whether this message was a Game Center command. */
    handle(event) {
      if (event.type !== 'chat') return false;
      const text = String(event.data?.text || '').trim();
      if (!text.startsWith('!')) return false;
      const [word, ...rest] = text.split(/\s+/);
      const command = word.toLowerCase();
      const args = rest.join(' ');
      const now = Date.now();

      if (command === '!coins' || command === '!balance') {
        const profile = profiles.ensure(event.platform, event.user?.displayName || event.user?.name);
        const key = `${event.platform}:${(event.user?.name || '').toLowerCase()}`;
        if (onCooldown(key, command, now)) return true;
        const rank = profiles.rankOf(key);
        reply(event,
          { kind: 'coins', name: profile.name, platform: profile.platform, crest: profile.crest, coins: profile.coins, rank },
          `${profile.name}: ${formatCoins(profile.coins)} coins${rank ? ` (#${rank.place} of ${rank.of})` : ''}`);
        return true;
      }

      if (command === '!top') {
        const key = `${event.platform}:${(event.user?.name || '').toLowerCase()}`;
        if (onCooldown(key, command, now)) return true;
        const board = profiles.leaderboard(5);
        reply(event,
          { kind: 'leaderboard', entries: board },
          board.length ? `Top: ${board.map((p, i) => `${i + 1}. ${p.name} ${formatCoins(p.coins)}`).join(' · ')}` : 'Nobody has any coins yet!');
        return true;
      }

      // ---- pets ----------------------------------------------------------
      if (pets && ['!adopt', '!pet', '!feed', '!name', '!pets', '!switch', '!egg'].includes(command)) {
        const profile = profiles.ensure(event.platform, event.user?.displayName || event.user?.name);
        const key = `${event.platform}:${(event.user?.name || '').toLowerCase()}`;

        if (command === '!adopt') {
          const result = pets.adopt(profile, args.split(/\s+/)[0]?.toLowerCase());
          reply(event, result.ok ? pets.card(profile) : { kind: 'note', text: result.message }, result.message);
          return true;
        }

        if (command === '!feed') {
          const result = pets.feed(profile, args.split(/\s+/)[0]?.toLowerCase());
          if (!result.ok) {
            reply(event, { kind: 'note', text: result.message }, result.message);
            return true;
          }
          // A level-up or evolution always shows, even in quiet mode.
          const card = { ...pets.card(profile), event: result.evolvedTo ? 'evolved' : result.levelledTo ? 'levelled' : 'fed',
            gained: result.xp, reasons: result.reasons, forage: result.forage, note: result.message };
          reply(event, card,
            `${result.message} +${result.xp} XP, found ${result.forage} coins. ${result.mealsLeft} meal(s) left today.`);
          return true;
        }

        if (command === '!name') {
          const result = pets.rename(profile, args);
          reply(event, result.ok ? pets.card(profile) : { kind: 'note', text: result.message }, result.message);
          return true;
        }

        if (command === '!switch') {
          const result = pets.switchTo(profile, args.split(/\s+/)[0]?.toLowerCase());
          reply(event, result.ok ? pets.card(profile) : { kind: 'note', text: result.message }, result.message);
          return true;
        }

        if (command === '!pets') {
          const list = profile.pets.map((p) => `${p.name} (${SPECIES[p.species]?.label} lv${p.level})`).join(' · ');
          reply(event, { kind: 'note', text: list || 'No pets yet' },
            list ? `Your pets: ${list}` : `No pets yet — try !adopt ${STARTER_SPECIES[0]}`);
          return true;
        }

        if (command === '!egg') {
          const progress = pets.mythicProgress(profile);
          const text = progress.map((m) => `${m.label} ${m.have}/${m.need}`).join(' · ');
          reply(event, { kind: 'note', text }, `Mythic progress: ${text}`);
          return true;
        }

        // !pet, with an optional @someone
        const target = args.replace(/^@/, '').trim();
        const shown = target ? profiles.byName(event.platform, target) : profile;
        if (!shown) {
          reply(event, { kind: 'note', text: `No profile for ${target} yet` }, `No profile for ${target} yet.`);
          return true;
        }
        if (onCooldown(key, command, now)) return true;
        const card = pets.card(shown);
        reply(event, card || { kind: 'note', text: `${shown.name} has no pet yet` },
          card ? `${card.pet.name} the ${card.stageName} — level ${card.pet.level}` : `${shown.name} has no pet yet.`);
        return true;
      }

      // ---- shop and wardrobe ---------------------------------------------
      if (wardrobe && ['!shop', '!buy', '!wear', '!off', '!coat', '!eyes', '!closet'].includes(command)) {
        const profile = profiles.ensure(event.platform, event.user?.displayName || event.user?.name);
        const key = `${event.platform}:${(event.user?.name || '').toLowerCase()}`;

        if (command === '!shop') {
          if (onCooldown(key, command, now)) return true;
          const words = args.toLowerCase().split(/\s+/).filter(Boolean);
          const slot = SLOTS.find((s) => words.includes(s)) || 'hat';
          const page = Math.max(1, parseInt(words.find((w) => /^\d+$/.test(w)) || '1', 10)) - 1;
          const view = wardrobe.shop(profile, { slot, page });
          reply(event,
            { kind: 'shop', ...view, coins: profile.coins, name: profile.name },
            `${SLOT_LABELS[view.slot]} shop (${view.page + 1}/${view.pages}): ${view.items
              .map((i) => `${i.label} ${i.owned ? '✓' : i.price == null ? 'earned' : i.price}`).join(' · ')}`);
          return true;
        }

        if (command === '!closet') {
          const items = wardrobe.wardrobeOf(profile);
          const text = items.length
            ? items.map((i) => `${i.label}${i.worn ? ' (worn)' : ''}`).join(' · ')
            : 'nothing yet — browse !shop';
          reply(event, { kind: 'closet', items, name: profile.name }, `${profile.name}'s closet: ${text}`);
          return true;
        }

        // The rest change something, so they answer with the pet card.
        const result = command === '!buy' ? wardrobe.buy(profile, args)
          : command === '!wear' ? wardrobe.wear(profile, args)
          : command === '!off' ? wardrobe.takeOff(profile, args)
          : command === '!coat' ? wardrobe.coat(profile, args)
          : wardrobe.eyes(profile, args);

        const hint = !args && command === '!coat' ? ` — coats: ${COAT_NAMES.join(', ')}`
          : !args && command === '!eyes' ? ` — eyes: ${EYE_NAMES.join(', ')}` : '';
        const card = result.ok && pets.card(profile)
          ? { ...pets.card(profile), event: command === '!buy' ? 'bought' : 'dressed', note: result.message }
          : { kind: 'note', text: result.message + hint };
        reply(event, card, result.message + hint);
        return true;
      }

      // ---- avatar ---------------------------------------------------------
      if (avatars && (command === '!avatar' || command === '!crest')) {
        const profile = profiles.ensure(event.platform, event.user?.displayName || event.user?.name);
        if (args.trim().toLowerCase() === 'list') {
          const w = avatars.words();
          reply(event, { kind: 'avatar-list', ...w },
            `Shapes: ${w.shapes.join(' ')} · Patterns: ${w.patterns.join(' ')} · Colours: ${w.colours.join(' ')}`);
          return true;
        }
        const result = avatars.set(profile, args);
        reply(event,
          result.ok
            ? { kind: 'avatar', name: profile.name, platform: profile.platform, crest: result.crest, coins: profile.coins, note: result.message }
            : { kind: 'note', text: result.message },
          result.message);
        return true;
      }

      if (command === '!gchelp') {
        reply(event, { kind: 'help' },
          'Games: !race !attack !heist · Coins: !coins !top · Pets: !adopt !pet !feed !name · Shop: !shop !buy !wear !coat !eyes · !avatar');
        return true;
      }

      return false;
    },

    /** Exposed so a test can drive the clock rather than wait. */
    _cooldowns: lastUse,
  };
}
