/**
 * Game Center module.
 *
 * Self-contained: the games, their overlay, the setup-page card, the coin
 * ledger and the tests all live under packages/modules/game-center/. Nothing
 * outside this folder names it, so deleting the folder removes the feature
 * cleanly — there is a test that enforces exactly that.
 */
import { createModuleStore } from '#bridge/store.js';
import { GameService } from './service.js';

export function createModule({ config, hub, log }) {
  const store = createModuleStore('game-center');
  const games = new GameService({ config, hub, store });
  let broadcast = null;

  return {
    async start() {
      games.start();
      // The server hands modules a way to push to connected overlays.
      broadcast = hub.broadcast?.bind(hub) || null;
      games.on('change', (state) => broadcast?.({ type: 'game', state }));
      log.info('ready');
    },

    async stop() {
      games.stop();
    },

    /** Sent to an overlay the moment it connects, so a game already in progress shows. */
    hello() {
      return games.state ? [{ type: 'game', state: games.state }] : [];
    },

    /** Everything under /api/m/game-center/. */
    async routes({ path, method, req, res, sendJSON, readBody }) {
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
      return false;
    },

    status() {
      return { running: games.status().running };
    },
  };
}
