/**
 * Game Center module.
 *
 * Self-contained by design: everything this feature needs lives under
 * packages/modules/game-center/. Nothing outside this folder names it, so
 * deleting the folder removes the feature cleanly.
 */
export function createModule({ config, hub, dir, log }) {
  let started = false;

  return {
    async start() {
      started = true;
      log.info('ready');
    },

    async stop() {
      started = false;
    },

    /**
     * Everything under /api/m/game-center/. Return false for anything this
     * module doesn't recognise so the server can answer 404.
     */
    async routes({ path, method, sendJSON, res }) {
      if (path === '/ping' && method === 'GET') {
        sendJSON(res, 200, { ok: true, module: 'game-center', started });
        return true;
      }
      return false;
    },

    status() {
      return { started };
    },
  };
}
