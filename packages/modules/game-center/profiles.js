/**
 * Profile storage.
 *
 * Held in memory and flushed on a timer rather than written per change: a busy
 * chat playing a raid boss touches a profile every few hundred milliseconds, and
 * rewriting the file each time would be the first thing to fall over on a real
 * stream.
 */
import { upgradeProfile, createProfile, profileKey, addCoins, spend, canAfford } from './shared/profiles.js';

const FLUSH_MS = 5000;

export class ProfileStore {
  /** @param {{store: object, log: object, flushMs?: number}} options */
  constructor({ store, log, flushMs = FLUSH_MS }) {
    this.store = store;
    this.log = log;
    this.flushMs = flushMs;
    this.dirty = false;
    this.timer = null;
    this.profiles = this.#load();
  }

  #load() {
    const saved = this.store.load('profiles', null);
    if (saved && typeof saved === 'object') {
      const out = {};
      for (const [key, raw] of Object.entries(saved)) out[key] = upgradeProfile(key, raw);
      return out;
    }

    // First run after the flat coin ledger: carry those balances over rather
    // than resetting everyone to 100.
    const legacy = this.store.load('coins', null);
    if (legacy && typeof legacy === 'object' && Object.keys(legacy).length) {
      const out = {};
      for (const [key, raw] of Object.entries(legacy)) out[key] = upgradeProfile(key, raw);
      this.log?.info(`carried ${Object.keys(out).length} coin balance(s) into profiles`);
      this.store.save('profiles', out);
      return out;
    }
    return {};
  }

  /** Get a profile, creating it the first time we see someone. */
  ensure(platform, name) {
    const key = profileKey(platform, name);
    if (!this.profiles[key]) {
      this.profiles[key] = createProfile({ key, name, platform });
      this.touch();
    }
    const profile = this.profiles[key];
    // Keep the display name current: people change capitalisation.
    if (name && profile.name !== name) {
      profile.name = name;
      this.touch();
    }
    profile.lastSeen = Date.now();
    return profile;
  }

  get(key) {
    return this.profiles[key] || null;
  }

  byName(platform, name) {
    return this.get(profileKey(platform, name));
  }

  all() {
    return this.profiles;
  }

  coinsOf(key) {
    return this.profiles[key]?.coins ?? 0;
  }

  award(key, amount) {
    const profile = this.profiles[key];
    if (!profile || !amount) return null;
    addCoins(profile, amount);
    this.touch();
    return profile.coins;
  }

  spend(key, cost) {
    const profile = this.profiles[key];
    if (!profile) return false;
    const ok = spend(profile, cost);
    if (ok) this.touch();
    return ok;
  }

  canAfford(key, cost) {
    const profile = this.profiles[key];
    return !!profile && canAfford(profile, cost);
  }

  leaderboard(limit = 10) {
    return Object.entries(this.profiles)
      .map(([key, p]) => ({ key, name: p.name, platform: p.platform, coins: p.coins, ...p.stats }))
      .sort((a, b) => b.coins - a.coins)
      .slice(0, limit);
  }

  rankOf(key) {
    const sorted = Object.entries(this.profiles).sort((a, b) => b[1].coins - a[1].coins);
    const index = sorted.findIndex(([k]) => k === key);
    return index === -1 ? null : { place: index + 1, of: sorted.length };
  }

  /** Mark changed; the write happens on the next flush. */
  touch() {
    this.dirty = true;
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush();
    }, this.flushMs);
    this.timer.unref?.();
  }

  flush() {
    if (!this.dirty) return false;
    this.store.save('profiles', this.profiles);
    this.dirty = false;
    return true;
  }

  /** Always flush on the way out, so nothing earned in the last few seconds is lost. */
  stop() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.flush();
  }
}
