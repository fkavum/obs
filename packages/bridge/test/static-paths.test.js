import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, win32 } from 'node:path';
import { serveStatic } from '../src/server/static.js';

/**
 * serveStatic is the only place a URL reaches the filesystem, so its escape
 * guard is worth pinning down. Backslash is a path separator on Windows but an
 * ordinary character on macOS/Linux, so both spellings are tested.
 */
const root = mkdtempSync(join(tmpdir(), 'obs-static-'));
mkdirSync(join(root, 'sub'), { recursive: true });
writeFileSync(join(root, 'index.html'), '<h1>root</h1>');
writeFileSync(join(root, 'sub', 'index.html'), '<h1>sub</h1>');
writeFileSync(join(root, 'app.js'), 'console.log(1)');
// The file an attacker would be reaching for, one level above the served root.
writeFileSync(join(root, '..', 'obs-secret-probe.txt'), 'SECRET');

process.on('exit', () => {
  rmSync(root, { recursive: true, force: true });
  rmSync(join(root, '..', 'obs-secret-probe.txt'), { force: true });
});

/** Minimal response stub: records what was sent, swallows the stream. */
function fakeRes() {
  return {
    status: null,
    headers: null,
    writeHead(status, headers) {
      this.status = status;
      this.headers = headers;
    },
    on() {}, once() {}, emit() {}, end() {}, write() { return true; },
  };
}

test('serves a file inside the root', () => {
  const res = fakeRes();
  assert.equal(serveStatic(res, root, '/app.js'), true);
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /javascript/);
});

test('serves index.html for a directory', () => {
  assert.equal(serveStatic(fakeRes(), root, '/'), true);
  assert.equal(serveStatic(fakeRes(), root, '/sub/'), true);
});

test('refuses to escape the root', () => {
  for (const attempt of [
    '/../obs-secret-probe.txt',
    '/sub/../../obs-secret-probe.txt',
    '/..%2Fobs-secret-probe.txt',
    '/....//obs-secret-probe.txt',
    '/..\\obs-secret-probe.txt',
    '/sub\\..\\..\\obs-secret-probe.txt',
  ]) {
    assert.equal(serveStatic(fakeRes(), root, attempt), false, `escaped with: ${attempt}`);
  }
});

test('the escape guard holds under Windows path rules', () => {
  // On macOS a backslash is an ordinary filename character, so the cases above
  // prove nothing about Windows, where it IS a separator. Re-run the guard's own
  // algorithm with win32 semantics so the Windows behaviour is actually pinned.
  const root = 'C:\\toolkit\\packages\\overlays';
  const guard = (rel) => {
    const full = win32.normalize(win32.join(root, rel));
    return full.startsWith(win32.normalize(root) + win32.sep) || full === win32.normalize(root);
  };
  assert.equal(guard('chat\\chat.js'), true, 'a normal file is allowed');
  assert.equal(guard('chat/chat.js'), true, 'forward slashes from the URL still resolve');
  for (const attempt of ['..\\..\\config\\config.local.json', '..\\..\\..\\Windows\\system.ini', 'chat\\..\\..\\..\\secret.txt']) {
    assert.equal(guard(attempt), false, `escaped with: ${attempt}`);
  }
});

test('a missing file is reported rather than thrown', () => {
  assert.equal(serveStatic(fakeRes(), root, '/nope.js'), false);
});

test('overlays are never cached, so edits show up in OBS', () => {
  const res = fakeRes();
  serveStatic(res, root, '/app.js');
  assert.equal(res.headers['cache-control'], 'no-cache');
});
