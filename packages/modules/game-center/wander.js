/**
 * Wandering pets: when someone chats, their pet walks onto the stream.
 *
 * The decision of *who* has a pet is made here rather than in the overlay, for
 * two reasons: the overlay would otherwise have to look up every chatter over
 * HTTP, and a channel with a thousand lurkers would have a thousand profiles
 * created for people who never played. So this only ever reads — a chatter with
 * no pet costs one map lookup and nothing else.
 */

/** Don't re-announce the same person more often than this. */
export const MIN_GAP_MS = 8000;

export function createWander({ profiles, pets, hub, log }) {
  const lastSent = new Map();

  /** The smallest description the overlay needs to draw and walk a pet. */
  function payloadFor(profile) {
    const pet = pets.activePetOf(profile);
    if (!pet) return null;
    return {
      key: `${profile.platform}:${profile.name.toLowerCase()}`,
      owner: profile.name,
      platform: profile.platform,
      pet: {
        name: pet.name,
        species: pet.species,
        level: pet.level,
        colour: pet.colour,
        eyes: pet.eyes,
        shiny: !!pet.shiny,
        accessories: pet.accessories || {},
      },
    };
  }

  function send(profile, { force = false, now = Date.now() } = {}) {
    if (!profile) return false;
    const key = `${profile.platform}:${profile.name.toLowerCase()}`;
    if (!force && now - (lastSent.get(key) ?? -Infinity) < MIN_GAP_MS) return false;
    const payload = payloadFor(profile);
    if (!payload) return false;
    lastSent.set(key, now);
    // A long stream would otherwise grow this map for every chatter, forever.
    if (lastSent.size > 500) {
      for (const [k, t] of lastSent) if (now - t > MIN_GAP_MS * 20) lastSent.delete(k);
    }
    hub.broadcast?.({ type: 'gc:wander', ...payload });
    return true;
  }

  return {
    /** Every chat message. Cheap on purpose: most people have no pet. */
    handle(event) {
      if (event?.type !== 'chat') return false;
      const name = event.user?.displayName || event.user?.name;
      if (!name) return false;
      // byName, never ensure: chatting is not the same as playing.
      const profile = profiles.byName(event.platform, name);
      if (!profile) return false;
      return send(profile);
    },

    /**
     * Something about the pet changed — a new hat, a new colour. Push it out
     * at once and bypass the gap, so the person who just typed !wear sees it
     * on their pet rather than waiting for the next message.
     */
    refresh(profile) {
      return send(profile, { force: true });
    }
  };
}
