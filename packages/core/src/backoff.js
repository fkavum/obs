/**
 * Reconnection with exponential backoff and jitter.
 *
 * Every adapter must survive a platform going away without help, and without
 * hammering it when it comes back. This is the shared implementation so each
 * adapter doesn't invent its own.
 */
export function createReconnector({ connect, log, minMs = 1000, maxMs = 60000, label = 'connection' }) {
  let attempt = 0;
  let timer = null;
  let stopped = false;
  let running = false;

  async function run() {
    if (stopped || running) return;
    running = true;
    try {
      await connect();
      attempt = 0; // a clean connect resets the backoff
    } catch (err) {
      if (stopped) return;
      // An error may ask for a specific wait (e.g. "blocked, come back in 5 min");
      // otherwise use the exponential curve.
      const delay = err?.retryAfterMs
        ? err.retryAfterMs
        : Math.min(maxMs, minMs * 2 ** attempt) * (0.7 + Math.random() * 0.6);
      attempt++;
      log?.warn(`${label} failed (${err.message}); retrying in ${Math.round(delay / 1000)}s`);
      timer = setTimeout(() => {
        running = false;
        run();
      }, delay);
      timer.unref?.();
      return;
    }
    running = false;
  }

  return {
    start: run,
    /** Call when an established connection drops: schedules a fresh attempt. */
    retry(reason = 'disconnected') {
      if (stopped || timer) return;
      running = false;
      const delay = Math.min(maxMs, minMs * 2 ** attempt) * (0.7 + Math.random() * 0.6);
      attempt++;
      log?.warn(`${label} ${reason}; reconnecting in ${Math.round(delay / 1000)}s`);
      timer = setTimeout(() => {
        timer = null;
        run();
      }, delay);
      timer.unref?.();
    },
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      timer = null;
    },
    get attempts() {
      return attempt;
    },
  };
}
