/**
 * Game Center module.
 *
 * Self-contained: games, coins, profiles, the overlay, the setup-page card and
 * the tests all live under packages/modules/game-center/. Nothing outside this
 * folder names it — there is a test that enforces exactly that.
 */
import { createModuleStore } from '#bridge/store.js';
import { GameService } from './service.js';
import { ProfileStore } from './profiles.js';
import { createCommands } from './commands.js';
import { createWardrobe } from './wardrobe.js';
import { createPets } from './pets.js';
import { createAvatars } from './avatars.js';

export function createModule({ config, hub, log }) {
  const store = createModuleStore('game-center');
  const profiles = new ProfileStore({ store, log });
  const games = new GameService({ config, hub, profiles });
  const pets = createPets({ profiles, log });
  const wardrobe = createWardrobe({ profiles, pets, log });
  const avatars = createAvatars({ profiles, pets, log });
  const commands = createCommands({ profiles, games, pets, wardrobe, avatars, hub, log });

  // Mythic pets are milestones, not drops: a game result advances the counter.
  games.on('settled', (results) => {
    for (const r of results) {
      const profile = profiles.byName(r.platform, r.name);
      if (!profile) continue;
      pets.recordGameResult(profile, r);
      // Trophies are handed over the moment they're earned, not claimed later.
      for (const item of wardrobe.claimEarned(profile)) {
        hub.broadcast?.({ type: 'gc:card', card: { kind: 'note', text: `${profile.name} earned the ${item.label}!` } });
      }
    }
  });

  const onEvent = (event) => commands.handle(event);

  return {
    async start() {
      games.start();
      games.on('change', (state) => hub.broadcast?.({ type: 'game', state }));
      hub.on('event', onEvent);
      log.info(`ready — ${Object.keys(profiles.all()).length} profile(s)`);
    },

    async stop() {
      hub.off('event', onEvent);
      games.stop();
      // Flush immediately: nothing earned in the last few seconds should be lost.
      profiles.stop();
    },

    /** Sent to an overlay the moment it connects, so a game in progress shows. */
    hello() {
      return games.state ? [{ type: 'game', state: games.state }] : [];
    },

    async routes({ path, method, req, res, sendJSON, readBody, url }) {
      if (path === '/games' && method === 'GET') {
        sendJSON(res, 200, games.status());
        return true;
      }
      if (path === '/games' && method === 'POST') {
        const body = await readBody(req);
        try {
          if (body.action === 'cancel') sendJSON(res, 200, { ok: true, state: games.cancel() });
          else {
            games.begin(body.game, body);
            sendJSON(res, 200, { ok: true, ...games.status() });
          }
        } catch (err) {
          sendJSON(res, 400, { error: err.message });
        }
        return true;
      }

      if (path === '/shop' && method === 'GET') {
        sendJSON(res, 200, { items: wardrobe.catalogue() });
        return true;
      }

      if (path === '/species' && method === 'GET') {
        const { SPECIES_LIST } = await import('./shared/pets/species.js');
        sendJSON(res, 200, {
          species: SPECIES_LIST.map((s) => ({
            id: s.id, label: s.label, tier: s.tier, personality: s.personality,
            stageNames: s.stageNames, favourite: s.favourite, earnedBy: s.earnedBy || null,
          })),
        });
        return true;
      }

      if (path === '/profiles' && method === 'GET') {
        const limit = Math.min(100, Number(url.searchParams.get('limit')) || 25);
        sendJSON(res, 200, {
          total: Object.keys(profiles.all()).length,
          leaderboard: profiles.leaderboard(limit),
        });
        return true;
      }

      const one = /^\/profiles\/([a-z0-9_-]+):(.+)$/i.exec(path);
      if (one && method === 'GET') {
        const profile = profiles.byName(one[1], decodeURIComponent(one[2]));
        if (!profile) {
          sendJSON(res, 404, { error: 'no profile for that viewer yet' });
          return true;
        }
        sendJSON(res, 200, { profile });
        return true;
      }

      // Adjusting someone's coins by hand, from the setup page.
      if (path === '/coins' && method === 'POST') {
        const body = await readBody(req);
        const profile = profiles.byName(body.platform, body.name);
        if (!profile) {
          sendJSON(res, 404, { error: 'no profile for that viewer yet' });
          return true;
        }
        const key = `${profile.platform}:${profile.name.toLowerCase()}`;
        profiles.award(key, Number(body.delta) || 0);
        sendJSON(res, 200, { ok: true, coins: profile.coins });
        return true;
      }

      return false;
    },

    status() {
      return { running: games.status().running, profiles: Object.keys(profiles.all()).length };
    },
  };
}
