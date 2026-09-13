/**
 * Fake platform: scripted chat for development, styling and demos.
 *
 * Emits events tagged with the *other* installed platforms, so an overlay being
 * styled looks exactly like it will on a real stream.
 */
import { startPreviewFeed } from '#core/preview-feed.js';

export function createAdapter({ config, emit, log, peers = [] }) {
  let stop = null;
  const simulate = config.simulate?.length ? config.simulate : peers.length ? peers : ['fake'];

  return {
    async start() {
      log.info(`generating fake chat as: ${simulate.join(', ')}`);
      stop = startPreviewFeed(emit, {
        platforms: simulate,
        minMs: config.minMs ?? 700,
        maxMs: config.maxMs ?? 3500,
      });
    },
    async stop() {
      stop?.();
      stop = null;
    },
    health() {
      return { connected: !!stop, detail: stop ? `simulating ${simulate.join(', ')}` : 'stopped' };
    },
  };
}
