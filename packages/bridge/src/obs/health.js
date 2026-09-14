/**
 * Polls OBS for health numbers and republishes them on the normal event stream,
 * so the health overlay is an ordinary browser source like every other overlay.
 *
 * Two requests per poll: GetStats (CPU, fps, render/encode frames) and
 * GetStreamStatus (dropped frames, congestion, bytes). Both are cheap and local
 * - there is no quota to respect here, unlike YouTube.
 */
import { makeEvent } from '#core/index.js';
import { ObsClient } from './client.js';

const DEFAULT_INTERVAL_MS = 2000;

export function createHealthService({ config, emit, log }) {
  let client = null;
  let timer = null;
  let stopped = true;
  let targetFps = null;
  let lastError = null;

  async function poll() {
    if (stopped || !client?.identified) return;
    try {
      const [stats, stream] = await Promise.all([
        client.request('GetStats'),
        client.request('GetStreamStatus'),
      ]);
      lastError = null;
      emit(makeEvent({
        type: 'obs.stats',
        platform: 'obs',
        channel: '',
        data: { stats, stream, targetFps },
      }));
    } catch (err) {
      lastError = err.message;
      log.debug(`poll failed: ${err.message}`);
    }
  }

  return {
    async start() {
      if (!config.obs?.enabled) return;
      stopped = false;
      client = new ObsClient({
        url: config.obs.url || 'ws://127.0.0.1:4455',
        password: config.obs.password || '',
        log,
      });

      client.on('connected', async () => {
        try {
          // The configured frame rate, so "only 24 of 60 fps" can be said at all.
          const video = await client.request('GetVideoSettings');
          targetFps = video.fpsNumerator && video.fpsDenominator
            ? Math.round(video.fpsNumerator / video.fpsDenominator)
            : null;
        } catch {
          targetFps = null;
        }
        poll();
      });

      await client.start().catch(() => {}); // reconnects on its own; never fatal
      const interval = Math.max(500, Number(config.obs.intervalMs) || DEFAULT_INTERVAL_MS);
      timer = setInterval(poll, interval);
      timer.unref?.();
    },

    async stop() {
      stopped = true;
      clearInterval(timer);
      timer = null;
      client?.stop();
      client = null;
    },

    /** Plain-words state for the setup screen. */
    status() {
      if (!config.obs?.enabled) return { enabled: false, connected: false, detail: 'off' };
      if (!client) return { enabled: true, connected: false, detail: 'not started' };
      if (client.identified) {
        return { enabled: true, connected: true, detail: `connected to OBS ${client.obsVersion || ''}`.trim() };
      }
      return {
        enabled: true,
        connected: false,
        detail: client.lastError || 'connecting to OBS…',
        needsPassword: /password/i.test(client.lastError || ''),
      };
    },

    /** Used by the setup screen's Test button. */
    async test() {
      const probe = new ObsClient({
        url: config.obs.url || 'ws://127.0.0.1:4455',
        password: config.obs.password || '',
        log,
      });
      try {
        await probe.start();
        // start() reconnects rather than throwing, so ask the client how it went;
        // otherwise a refused connection reads as the unhelpful "not connected".
        if (!probe.identified) {
          return {
            ok: false,
            detail: probe.lastError || 'could not reach OBS — is it running with the WebSocket server enabled?',
            needsPassword: /password/i.test(probe.lastError || ''),
          };
        }
        const version = await probe.request('GetVersion');
        return { ok: true, detail: `OBS ${version.obsVersion} (WebSocket ${version.obsWebSocketVersion})` };
      } catch (err) {
        return { ok: false, detail: err.message, needsPassword: !!err.needsPassword };
      } finally {
        probe.stop();
      }
    },
  };
}
