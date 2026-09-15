import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readdirSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EventEmitter } from 'node:events';
import { discoverModules, startModules, MODULES_DIR } from '../src/modules/loader.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const scratch = mkdtempSync(join(tmpdir(), 'obs-modules-'));
process.on('exit', () => rmSync(scratch, { recursive: true, force: true }));

function writeModule(id, { manifest = {}, index = null } = {}) {
  const dir = join(scratch, id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'module.json'), JSON.stringify({ id, label: id, ...manifest }));
  if (index) writeFileSync(join(dir, 'index.js'), index);
  return dir;
}

test('a folder with a module.json becomes a module', async () => {
  rmSync(scratch, { recursive: true, force: true });
  writeModule('alpha', { manifest: { version: '1.2.3' } });
  const found = await discoverModules(scratch);
  assert.equal(found.length, 1);
  assert.equal(found[0].manifest.id, 'alpha');
});

test('a missing modules directory is fine, not an error', async () => {
  assert.deepEqual(await discoverModules(join(scratch, 'does-not-exist')), []);
});

test('a manifest without the required keys is skipped, not fatal', async () => {
  rmSync(scratch, { recursive: true, force: true });
  const dir = join(scratch, 'broken');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'module.json'), JSON.stringify({ label: 'no id' }));
  writeModule('good');
  const found = await discoverModules(scratch);
  assert.deepEqual(found.map((f) => f.manifest.id), ['good'], 'the good one still loads');
});

test('a manifest whose id disagrees with its folder is refused', async () => {
  rmSync(scratch, { recursive: true, force: true });
  writeModule('folder-name', { manifest: { id: 'something-else' } });
  assert.deepEqual(await discoverModules(scratch), [], 'mismatched id would break every path we build from it');
});

test('unparseable JSON in one module does not stop the others', async () => {
  rmSync(scratch, { recursive: true, force: true });
  const dir = join(scratch, 'corrupt');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'module.json'), '{ not json');
  writeModule('healthy');
  assert.deepEqual((await discoverModules(scratch)).map((f) => f.manifest.id), ['healthy']);
});

test('modules load in manifest order', async () => {
  rmSync(scratch, { recursive: true, force: true });
  writeModule('last', { manifest: { order: 90 } });
  writeModule('first', { manifest: { order: 10 } });
  assert.deepEqual((await discoverModules(scratch)).map((f) => f.manifest.id), ['first', 'last']);
});

test('a module that throws on start is reported, and the toolkit carries on', async () => {
  rmSync(scratch, { recursive: true, force: true });
  writeModule('explodes', { index: 'export function createModule() { return { start() { throw new Error("boom"); } }; }' });
  writeModule('fine', { index: 'export function createModule() { return { start() {}, status: () => ({ ok: true }) }; }' });
  const registry = await startModules({ dir: scratch, config: {}, hub: new EventEmitter() });
  const status = registry.status();
  assert.equal(status.find((m) => m.id === 'explodes').running, false);
  assert.equal(status.find((m) => m.id === 'fine').running, true);
  await registry.stop();
});

test('the registry exposes overlays and panel cards namespaced by module', async () => {
  rmSync(scratch, { recursive: true, force: true });
  writeModule('shiny', {
    manifest: { overlays: [{ id: 'cards', label: 'Cards' }], panel: { card: 'card.html' } },
    index: 'export function createModule() { return { start() {} }; }',
  });
  const registry = await startModules({ dir: scratch, config: {}, hub: new EventEmitter() });
  assert.deepEqual(registry.overlays()[0].path, '/overlays/shiny/cards/');
  assert.deepEqual(registry.panelCards()[0].src, '/panel/shiny/card.html');
  await registry.stop();
});

// ---------------------------------------------------------------------------
// The rules that stop this eroding. These are the point of the whole contract.
// ---------------------------------------------------------------------------

/** Files a feature must never have to touch to register itself. */
const SHARED = [
  'packages/core/src/settings-schema.js',
  'packages/core/src/preview-feed.js',
  'packages/bridge/src/config.js',
  'packages/bridge/src/server/index.js',
  'packages/panel/index.html',
  'packages/panel/wizard.js',
  'config/initial.config.json',
];

test('no module id appears anywhere in the shared tree', () => {
  // The chat games needed 183 lines across these seven files to register
  // themselves. That is the mistake this contract exists to prevent, so it is
  // written down as a test rather than left to discipline.
  const ids = existsSync(MODULES_DIR)
    ? readdirSync(MODULES_DIR, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
    : [];
  if (!ids.length) return;

  const offences = [];
  for (const file of SHARED) {
    const path = join(REPO, file);
    if (!existsSync(path)) continue;
    const text = readFileSync(path, 'utf8');
    for (const id of ids) if (text.includes(id)) offences.push(`${file} mentions "${id}"`);
  }
  assert.deepEqual(offences, [], `shared files must not name a module:\n  ${offences.join('\n  ')}`);
});

test('the server mounts modules generically, without naming one', () => {
  const server = readFileSync(join(REPO, 'packages/bridge/src/server/index.js'), 'utf8');
  assert.match(server, /\/api\/m\//, 'there is a generic module API namespace');
  const ids = existsSync(MODULES_DIR)
    ? readdirSync(MODULES_DIR, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
    : [];
  for (const id of ids) assert.ok(!server.includes(id), `server names the module "${id}"`);
});
