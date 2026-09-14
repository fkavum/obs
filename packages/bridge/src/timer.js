/**
 * Owns the timer's state for the whole toolkit.
 *
 * It lives here rather than in the overlay so that pressing Start on the setup
 * page reaches the source running inside OBS, and so an OBS source that is
 * refreshed mid-countdown resumes at the right moment instead of restarting.
 *
 * State is deliberately in memory only: a countdown surviving a restart of the
 * toolkit would be resuming against time that has already passed.
 */
import { EventEmitter } from 'node:events';
import { createTimer, apply } from '#core/timer-model.js';

export class TimerService extends EventEmitter {
  constructor(initial = {}) {
    super();
    this.state = createTimer(initial);
  }

  get() {
    return this.state;
  }

  /** Apply an action and tell everyone, if anything actually changed. */
  dispatch(action) {
    const next = apply(this.state, action);
    if (next === this.state) return this.state; // no-op (e.g. pause while stopped)
    this.state = next;
    this.emit('change', this.state);
    return this.state;
  }
}
