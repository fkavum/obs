/**
 * Adapter auto-discovery.
 *
 * Every subdirectory of this folder holding a manifest.json is a platform.
 * Drop a folder in -> the platform exists. Delete it -> it's gone. Nothing else
 * in the codebase names a platform, which is what keeps them removable.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createLogger } from '#core/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const log = createLogger('adapters');

const REQUIRED_MANIFEST_KEYS = ['id', 'label', 'color', 'capabilities'];

/**
 * @returns {Promise<Array<{manifest: object, createAdapter: Function, oauth: object|null, dir: string}>>}
 */
export async function discoverAdapters(dir = HERE) {
  const found = [];
  let entries = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    log.error(`cannot read adapter directory: ${err.message}`);
    return found;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const adapterDir = join(dir, entry.name);
    const manifestPath = join(adapterDir, 'manifest.json');
    const indexPath = join(adapterDir, 'index.js');
    if (!existsSync(manifestPath) || !existsSync(indexPath)) continue;

    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      const missing = REQUIRED_MANIFEST_KEYS.filter((k) => !(k in manifest));
      if (missing.length) {
        log.warn(`${entry.name}: manifest missing ${missing.join(', ')} -- skipped`);
        continue;
      }
      const mod = await import(pathToFileURL(indexPath).href);
      if (typeof mod.createAdapter !== 'function') {
        log.warn(`${entry.name}: no createAdapter export -- skipped`);
        continue;
      }
      found.push({ manifest, createAdapter: mod.createAdapter, oauth: mod.oauth || null, dir: adapterDir });
    } catch (err) {
      // One broken adapter must never stop the others from loading.
      log.error(`${entry.name}: failed to load (${err.message}) -- skipped`);
    }
  }

  found.sort((a, b) => (a.manifest.order ?? 50) - (b.manifest.order ?? 50));
  log.info(`found ${found.length} platform(s): ${found.map((f) => f.manifest.id).join(', ') || 'none'}`);
  return found;
}
