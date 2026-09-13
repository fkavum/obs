import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBrowserDump, browserCandidates } from '../src/adapters/kick/index.js';
import { createReconnector } from '#core/backoff.js';

test('a browser dump of a JSON endpoint is decoded from its <pre> wrapper', () => {
  const dump = '<html><head></head><body><pre style="word-wrap: break-word;">{&quot;id&quot;:2587387,&quot;chatroom&quot;:{&quot;id&quot;:2579856}}</pre></body></html>';
  assert.deepEqual(parseBrowserDump(dump), { id: 2587387, chatroom: { id: 2579856 } });
});

test('a Cloudflare challenge page yields null rather than garbage', () => {
  const challenge = '<html><head><title>Just a moment...</title></head><body><div id="cf-chl">checking your browser</div></body></html>';
  assert.equal(parseBrowserDump(challenge), null);
  assert.equal(parseBrowserDump(''), null);
  assert.equal(parseBrowserDump('<pre>not json</pre>'), null);
});

test('Windows always has a candidate because Edge ships with it', () => {
  const list = browserCandidates('win32', { ProgramFiles: 'C:\\PF', 'ProgramFiles(x86)': 'C:\\PF86' });
  assert.ok(list.some((p) => /msedge\.exe$/.test(p)));
  assert.ok(list.some((p) => /chrome\.exe$/.test(p)));
});

test('an explicit browser path overrides discovery', () => {
  assert.deepEqual(browserCandidates('darwin', { OBS_TOOLKIT_BROWSER: '/my/browser' }), ['/my/browser']);
});

test('a blocked lookup waits the time it asks for instead of the fast retry curve', async () => {
  const waits = [];
  const log = { warn: (m) => waits.push(m) };
  let calls = 0;
  const conn = createReconnector({
    label: 'kick chat',
    log,
    minMs: 10,
    maxMs: 50,
    connect: async () => {
      calls++;
      throw Object.assign(new Error('blocked'), { retryAfterMs: 300000, blocked: true });
    },
  });
  await conn.start();
  conn.stop();
  assert.equal(calls, 1, 'attempted once');
  assert.match(waits[0], /retrying in 300s/, 'waited the requested 5 minutes, not 10ms');
});
