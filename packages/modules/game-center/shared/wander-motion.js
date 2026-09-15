/**
 * How a wandering pet moves. Pure: no DOM, no clock of its own.
 *
 * The overlay owns pixels and elements; this owns the behaviour — where a pet
 * enters, where it heads, when it rests, when it turns around and when it
 * leaves. Keeping it separate is what makes the wandering testable at all: a
 * browser's animation loop can't be stepped, but this can.
 */

export const MOTION = {
  /** Multiplier on walking speed while heading to the chosen spot. */
  hurry: 2.6,
  /** A pet closer than this fraction of its own width is crowding. */
  personalSpace: 0.8,
  thinkMin: 900,
  thinkSpread: 2600,
  restMin: 1200,
  restSpread: 2600,
  /** Chance of turning round at a think, when not crowded and not resting. */
  turnChance: 0.35,
  /** How long the fade-out lasts before the pet is removed. */
  exitMs: 700,
  entryOffset: 140,
};

/**
 * Where is there most room? Purely random spots cluster — with five pets out,
 * two landing on top of each other is likely rather than unlucky. Sampling a
 * handful and taking the loneliest looks deliberate and costs nothing.
 */
export function pickSpot(walkers, bounds, random = Math.random) {
  const lo = bounds.left + 40;
  const hi = Math.max(lo + 1, bounds.right - bounds.width - 40);
  let best = lo + random() * (hi - lo);
  let bestGap = -1;
  for (let i = 0; i < 8; i++) {
    const candidate = lo + random() * (hi - lo);
    let gap = Infinity;
    for (const w of walkers) {
      if (w.state === 'leaving') continue;
      gap = Math.min(gap, Math.abs(w.x - candidate));
    }
    if (gap > bestGap) { bestGap = gap; best = candidate; }
  }
  return best;
}

/**
 * A new walker, entering from whichever edge is nearer its chosen spot.
 * Choosing the spot first is what stops a burst of arrivals piling into one
 * corner, which a coin-flip entry edge does immediately.
 */
export function createWalker({ key, now, bounds, config, walkers = [], random = Math.random }) {
  const target = pickSpot(walkers, bounds, random);
  const fromLeft = target < (bounds.left + bounds.right) / 2;
  return {
    key,
    state: 'arriving',
    x: fromLeft ? bounds.left - MOTION.entryOffset : bounds.right + 40,
    target,
    dir: fromLeft ? 1 : -1,
    depth: random(),
    width: bounds.width,
    speed: config.speed * (0.8 + random() * 0.45),
    until: now + config.staySec * 1000,
    restUntil: 0,
    nextThink: now + 800 + random() * 1800,
    removeAt: 0,
  };
}

/** Send a walker off. It keeps walking on the way out. */
export function startLeaving(walker, now) {
  walker.state = 'leaving';
  walker.removeAt = now + MOTION.exitMs;
  return walker;
}

/** The pet whose owner has been quiet longest — the one to make room. */
export function longestQuiet(walkers) {
  let oldest = null;
  for (const w of walkers) {
    if (w.state === 'leaving') continue;
    if (!oldest || w.until < oldest.until) oldest = w;
  }
  return oldest;
}

export function nearestNeighbour(walker, walkers) {
  let nearest = null;
  let distance = Infinity;
  for (const other of walkers) {
    if (other === walker || other.state === 'leaving') continue;
    const gap = Math.abs(other.x - walker.x);
    if (gap < distance) { distance = gap; nearest = other; }
  }
  return { nearest, distance };
}

/**
 * Advance every walker by `dt` seconds.
 *
 * @returns {Array} the walkers that have finished leaving and should be removed.
 */
export function step(walkers, { now, dt, bounds, config, random = Math.random }) {
  const done = [];
  for (const walker of walkers) {
    if (walker.removeAt && now >= walker.removeAt) {
      done.push(walker);
      continue;
    }
    if (walker.state !== 'leaving' && now >= walker.until) startLeaving(walker, now);

    if (now >= walker.nextThink) {
      walker.nextThink = now + MOTION.thinkMin + random() * MOTION.thinkSpread;
      if (walker.state !== 'leaving' && walker.target == null) {
        // Personal space: standing on someone else reads as a glitch, so a
        // crowded pet walks away instead of resting where it is.
        const { nearest, distance } = nearestNeighbour(walker, walkers);
        if (nearest && distance < walker.width * MOTION.personalSpace) {
          walker.dir = walker.x <= nearest.x ? -1 : 1;
          walker.restUntil = 0;
        } else if (random() * 100 < config.restiness) {
          walker.restUntil = now + MOTION.restMin + random() * MOTION.restSpread;
        } else if (random() < MOTION.turnChance) {
          walker.dir *= -1;
        }
      }
    }

    const resting = now < walker.restUntil && walker.state !== 'leaving';
    walker.moving = !resting;
    if (resting) continue;

    // On the way to its chosen spot a pet walks briskly; once there it settles
    // into an ordinary wander.
    let speed = walker.speed;
    if (walker.target != null) {
      walker.dir = walker.target > walker.x ? 1 : -1;
      speed = walker.speed * MOTION.hurry;
      if (Math.abs(walker.x - walker.target) <= speed * dt + 1) {
        walker.x = walker.target;
        walker.target = null;
      }
    }
    walker.x += walker.dir * speed * dt;

    // Turn at the edges rather than walking off — except on the way out.
    if (walker.state !== 'leaving' && walker.target == null) {
      if (walker.x < bounds.left) { walker.x = bounds.left; walker.dir = 1; }
      const maxX = bounds.right - walker.width;
      if (walker.x > maxX) { walker.x = maxX; walker.dir = -1; }
    }
  }
  return done;
}

/** Where on screen a walker sits, given the strip it walks in. */
export function positionOf(walker, { edge, lane, laneDepth, viewportHeight, height }) {
  const depth = Math.round(walker.depth * laneDepth);
  const y = edge === 'top' ? lane + depth : viewportHeight - lane - depth - height;
  return { x: Math.round(walker.x), y: Math.round(y), z: 1000 - Math.round(walker.depth * 1000) };
}
