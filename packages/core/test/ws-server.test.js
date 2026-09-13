import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { WSServer } from '#core/ws-server.js';

/** Spin up the server on an ephemeral port and hand back a real client. */
async function withServer(run) {
  const http = createServer((_req, res) => res.end('ok'));
  const ws = new WSServer(http, { path: '/events', heartbeatMs: 100000 });
  await new Promise((r) => http.listen(0, '127.0.0.1', r));
  const port = http.address().port;
  try {
    await run({ ws, port });
  } finally {
    ws.close();
    http.close();
  }
}

const open = (port, path = '/events') =>
  new Promise((resolve, reject) => {
    const client = new WebSocket(`ws://127.0.0.1:${port}${path}`);
    client.onopen = () => resolve(client);
    client.onerror = () => reject(new Error('failed to connect'));
  });

test('completes the handshake and delivers a broadcast', async () => {
  await withServer(async ({ ws, port }) => {
    const client = await open(port);
    const got = new Promise((r) => (client.onmessage = (m) => r(m.data)));
    ws.broadcast({ hello: 'world' });
    assert.deepEqual(JSON.parse(await got), { hello: 'world' });
    client.close();
  });
});

test('reads a message sent by the client (masked frames)', async () => {
  await withServer(async ({ ws, port }) => {
    const received = new Promise((resolve) => ws.on('connection', (conn) => conn.on('message', resolve)));
    const client = await open(port);
    client.send('from the client');
    assert.equal(await received, 'from the client');
    client.close();
  });
});

test('handles payloads across all three frame length encodings', async () => {
  await withServer(async ({ ws, port }) => {
    const received = [];
    let resolveAll;
    const all = new Promise((r) => (resolveAll = r));
    ws.on('connection', (conn) =>
      conn.on('message', (m) => {
        received.push(m.length);
        if (received.length === 3) resolveAll();
      }),
    );
    const client = await open(port);
    // <126 uses the short form, <65536 the 16-bit form, above that the 64-bit form.
    const sizes = [10, 1000, 70000];
    for (const size of sizes) client.send('x'.repeat(size));
    await all;
    assert.deepEqual(received, sizes);
    client.close();
  });
});

test('broadcast reaches every connected client', async () => {
  await withServer(async ({ ws, port }) => {
    const clients = await Promise.all([open(port), open(port), open(port)]);
    const messages = clients.map((c) => new Promise((r) => (c.onmessage = (m) => r(m.data))));
    const sent = ws.broadcast('ping-all');
    assert.equal(sent, 3, 'server counted three recipients');
    assert.deepEqual(await Promise.all(messages), ['ping-all', 'ping-all', 'ping-all']);
    for (const c of clients) c.close();
  });
});

test('a closed client is dropped from the set', async () => {
  await withServer(async ({ ws, port }) => {
    const client = await open(port);
    assert.equal(ws.clients.size, 1);
    client.close();
    await new Promise((r) => setTimeout(r, 120));
    assert.equal(ws.clients.size, 0, 'server forgot the disconnected client');
  });
});

test('requests outside the configured path are refused', async () => {
  await withServer(async ({ port }) => {
    await assert.rejects(open(port, '/somewhere-else'));
  });
});

test('attach() serves the same socket from a second http server (dual loopback)', async () => {
  const a = createServer((_req, res) => res.end('a'));
  const b = createServer((_req, res) => res.end('b'));
  const ws = new WSServer(a, { path: '/events', heartbeatMs: 100000 }).attach(b);
  await new Promise((r) => a.listen(0, '127.0.0.1', r));
  await new Promise((r) => b.listen(0, '127.0.0.1', r));
  try {
    const viaA = await open(a.address().port);
    const viaB = await open(b.address().port);
    const got = [viaA, viaB].map((c) => new Promise((r) => (c.onmessage = (m) => r(m.data))));
    assert.equal(ws.broadcast('both'), 2, 'one client set spans both listeners');
    assert.deepEqual(await Promise.all(got), ['both', 'both']);
    viaA.close();
    viaB.close();
  } finally {
    ws.close();
    a.close();
    b.close();
  }
});
