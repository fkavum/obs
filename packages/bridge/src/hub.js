/**
 * The hub owns adapter lifecycles and the event fan-out.
 *
 * It contains no platform-specific code at all: it knows about adapters, not
 * about Twitch. That is what lets a platform be added or deleted as a folder.
 */
import { EventEmitter } from 'node:events';
import { createLogger, isEvent } from '#core/index.js';
import { discoverAdapters } from './adapters/loader.js';
import { setPlatformConfig } from './config.js';

const log = createLogger('hub');
const RECENT_LIMIT = 200;

export class Hub extends EventEmitter {
  /** @param {object} config */
  constructor(config) {
    super();
    this.config = config;
    /** @type {Map<string, {manifest:object, createAdapter:Function, oauth:object|null, adapter:object|null, enabled:boolean, error:string|null, dir:string}>} */
    this.platforms = new Map();
    this.recent = [];
    this.setMaxListeners(50);
  }

  async load() {
    const found = await discoverAdapters();
    for (const { manifest, createAdapter, oauth, dir } of found) {
      this.platforms.set(manifest.id, {
        manifest,
        createAdapter,
        oauth,
        adapter: null,
        enabled: this.config.platforms[manifest.id]?.enabled ?? false,
        error: null,
        dir,
      });
    }
  }

  /** Manifests of every discovered platform, for GET /api/platforms. */
  manifests({ enabledOnly = false } = {}) {
    return [...this.platforms.values()]
      .filter((p) => !enabledOnly || p.enabled)
      .map((p) => ({ ...p.manifest, enabled: p.enabled }));
  }

  /** Start every platform the operator has switched on. */
  async startAll() {
    for (const id of this.platforms.keys()) {
      const entry = this.platforms.get(id);
      if (entry.enabled) await this.startPlatform(id);
    }
  }

  async startPlatform(id) {
    const entry = this.platforms.get(id);
    if (!entry) throw new Error(`unknown platform: ${id}`);
    if (entry.adapter) return entry;

    const platformLog = log.child(id);
    const emit = (event) => this.#ingest(id, event);
    // The fake adapter simulates the *other* installed platforms, so an overlay
    // being styled looks exactly like it will on a real stream.
    const peers = [...this.platforms.keys()].filter((p) => p !== id && p !== 'fake');

    try {
      entry.adapter = entry.createAdapter({
        config: this.config.platforms[id] || {},
        emit,
        log: platformLog,
        peers,
        saveConfig: (patch) => setPlatformConfig(this.config, id, patch),
      });
      await entry.adapter.start();
      entry.error = null;
      entry.enabled = true;
      platformLog.info('started');
    } catch (err) {
      // A platform that fails to start must not take down the bridge or its peers.
      entry.error = err.message;
      entry.adapter = null;
      platformLog.error(`failed to start: ${err.message}`);
    }
    this.emit('status');
    return entry;
  }

  async stopPlatform(id) {
    const entry = this.platforms.get(id);
    if (!entry?.adapter) return;
    try {
      await entry.adapter.stop();
    } catch (err) {
      log.warn(`${id} stop failed: ${err.message}`);
    }
    entry.adapter = null;
    log.child(id).info('stopped');
    this.emit('status');
  }

  async setEnabled(id, enabled) {
    const entry = this.platforms.get(id);
    if (!entry) throw new Error(`unknown platform: ${id}`);
    entry.enabled = enabled;
    setPlatformConfig(this.config, id, { enabled });
    if (enabled) await this.startPlatform(id);
    else await this.stopPlatform(id);
    return this.status(id);
  }

  /** Plain-words health for the status screen. Never an error code on its own. */
  status(only = null) {
    const rows = [];
    for (const [id, entry] of this.platforms) {
      if (only && id !== only) continue;
      let health = { connected: false, detail: 'not started' };
      if (entry.adapter) {
        try {
          health = entry.adapter.health() || health;
        } catch (err) {
          health = { connected: false, detail: `health check failed: ${err.message}` };
        }
      }
      rows.push({
        id,
        label: entry.manifest.label,
        color: entry.manifest.color,
        auth: entry.manifest.auth || 'none',
        setupUrl: entry.manifest.setupUrl || '',
        description: entry.manifest.description || '',
        needs: entry.oauth?.needs || [],
        capabilities: entry.manifest.capabilities || [],
        enabled: entry.enabled,
        running: !!entry.adapter,
        connected: !!health.connected,
        detail: health.detail || '',
        needsLogin: !!health.needsLogin,
        error: entry.error,
      });
    }
    return only ? rows[0] : rows;
  }

  #ingest(platformId, event) {
    if (!isEvent(event)) {
      log.warn(`${platformId} emitted a malformed event; dropped`);
      return;
    }
    // Trust the adapter's own platform tag (the fake adapter deliberately
    // impersonates its peers), but fall back to the folder id.
    if (!event.platform) event.platform = platformId;

    this.recent.push(event);
    if (this.recent.length > RECENT_LIMIT) this.recent.shift();
    this.emit('event', event);
  }

  /** Recent events, so an overlay added mid-stream isn't blank. */
  backlog(limit = 25, platforms = null) {
    const list = platforms?.length
      ? this.recent.filter((e) => platforms.includes(e.platform))
      : this.recent;
    return list.slice(-limit);
  }

  async shutdown() {
    for (const id of this.platforms.keys()) await this.stopPlatform(id);
  }
}
