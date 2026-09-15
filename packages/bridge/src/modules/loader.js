/**
 * Feature module auto-discovery.
 *
 * A module is a folder in packages/modules/ holding a module.json. Drop it in
 * and the feature exists; delete it and it's gone, with nothing left behind in
 * shared files. Exactly the contract platforms already have - this exists
 * because the chat games had to edit seven shared files to register themselves,
 * and a game center is several times larger.
 *
 * A module may provide:
 *   routes    its own HTTP API, mounted under /api/m/<id>/
 *   overlays  browser sources, served at /overlays/<id>/<name>/
 *   panel     setup-page cards and pages, served at /panel/<id>/
 *   data      files seeded into config/<id>/ like initial.config.json
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createLogger } from '#core/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
export const MODULES_DIR = join(HERE, '..', '..', '..', 'modules');
const log = createLogger('modules');

const REQUIRED_KEYS = ['id', 'label'];

/**
 * @returns {Promise<Array<{manifest: object, createModule: Function|null, dir: string}>>}
 */
export async function discoverModules(dir = MODULES_DIR) {
  const found = [];
  let entries = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    // No modules directory at all is a perfectly valid toolkit.
    return found;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const moduleDir = join(dir, entry.name);
    const manifestPath = join(moduleDir, 'module.json');
    if (!existsSync(manifestPath)) continue;

    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      const missing = REQUIRED_KEYS.filter((k) => !(k in manifest));
      if (missing.length) {
        log.warn(`${entry.name}: module.json missing ${missing.join(', ')} -- skipped`);
        continue;
      }
      if (manifest.id !== entry.name) {
        log.warn(`${entry.name}: module.json says id "${manifest.id}" -- skipped, they must match`);
        continue;
      }

      let createModule = null;
      const indexPath = join(moduleDir, 'index.js');
      if (existsSync(indexPath)) {
        const mod = await import(pathToFileURL(indexPath).href);
        createModule = mod.createModule || null;
      }

      found.push({ manifest, createModule, dir: moduleDir });
    } catch (err) {
      // One broken module must never stop the others, or the toolkit, loading.
      log.error(`${entry.name}: failed to load (${err.message}) -- skipped`);
    }
  }

  found.sort((a, b) => (a.manifest.order ?? 50) - (b.manifest.order ?? 50));
  if (found.length) log.info(`found ${found.length} module(s): ${found.map((f) => f.manifest.id).join(', ')}`);
  return found;
}

/**
 * Loads modules and starts them. Returns a registry the server asks about
 * routes, overlays and panel pages - so server code never names a feature.
 */
export async function startModules({ config, hub, dir } = {}) {
  const discovered = await discoverModules(dir);
  const running = [];

  for (const { manifest, createModule, dir: moduleDir } of discovered) {
    let instance = null;
    if (createModule) {
      try {
        instance = createModule({ config, hub, dir: moduleDir, log: createLogger(manifest.id) });
        await instance.start?.();
      } catch (err) {
        log.error(`${manifest.id}: failed to start (${err.message})`);
        instance = null;
      }
    }
    running.push({ manifest, instance, dir: moduleDir });
  }

  return {
    list: running,
    get(id) {
      return running.find((m) => m.manifest.id === id) || null;
    },
    /** Overlay definitions from every module, for the settings screen. */
    overlays() {
      return running.flatMap((m) =>
        (m.manifest.overlays || []).map((o) => ({
          ...o,
          module: m.manifest.id,
          path: `/overlays/${m.manifest.id}/${o.id}/`,
        })),
      );
    },
    /** Lines a module wants the demo chat to sometimes type, for testing. */
    previewMessages() {
      return running.flatMap((m) => m.manifest.previewMessages || []);
    },

    /** Setup-page cards, in manifest order. */
    panelCards() {
      return running
        .filter((m) => m.manifest.panel?.card)
        .map((m) => ({
          module: m.manifest.id,
          label: m.manifest.label,
          src: `/panel/${m.manifest.id}/${m.manifest.panel.card}`,
        }));
    },
    status() {
      return running.map((m) => ({
        id: m.manifest.id,
        label: m.manifest.label,
        version: m.manifest.version || '0.0.0',
        running: !!m.instance,
        ...(m.instance?.status?.() || {}),
      }));
    },
    async stop() {
      for (const m of running) {
        try {
          await m.instance?.stop?.();
        } catch (err) {
          log.warn(`${m.manifest.id}: stop failed (${err.message})`);
        }
      }
    },
  };
}
