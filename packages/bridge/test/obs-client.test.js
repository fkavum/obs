import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { WSServer } from '#core/ws-server.js';
import { ObsClient, authString } from '../src/obs/client.js';

const quietLog = { info() {}, warn() {}, debug() {}, error() {} };

test('the authentication string follows obs-websocket’s documented steps', () => {
  // base64(sha256(password + salt)) -> base64(sha256(secret + challenge)).
  // Matches obs-websocket-js and simpleobsws, the two reference clients.
  const password = 'supersecretpassword';
  const salt = 'lM1GncleQOaCu9lT1yeUZhFYnqhsLLP1G5lAGo3ixaI=';
  const challenge = '+IxH4CnCiqpX1rM9scsNynZzbOe4KhDeYcTNS3PDaeY=';
  const secret = createHash('sha256').update(password + salt).digest('base64');
  const expected = createHash('sha256').update(secret + challenge).digest('base64');
  assert.equal(authString(password, salt, challenge), expected);
  assert.equal(authString('', salt, challenge).length, 44, 'still produces a base64 sha256');
});

/**
 * A stand-in for OBS. Real OBS isn't available here, so the client is tested
 * against a server that speaks the same protocol.
 */
async function fakeObs({ password = '', rejectAuth = false } = {}) {
  const http = createServer();
  const ws = new WSServer(http, { heartbeatMs: 100000 });
  const salt = 'c2FsdHNhbHRzYWx0c2FsdA==';
  const challenge = 'Y2hhbGxlbmdlY2hhbGxlbmdl';
  const seen = { identify: null, requests: [], identifyCount: 0 };

  ws.on('connection', (conn) => {
    conn.send(JSON.stringify({
      op: 0,
      d: { obsStudioVersion: '30.2.2', obsWebSocketVersion: '5.5.2', rpcVersion: 1, ...(password ? { authentication: { challenge, salt } } : {}) },
    }));
    conn.on('message', (raw) => {
      const msg = JSON.parse(raw);
      if (msg.op === 1) {
        seen.identify = msg.d;
        seen.identifyCount += 1;
        if (password && (rejectAuth || msg.d.authentication !== authString(password, salt, challenge))) {
          conn.close(4009, 'auth failed'); // AuthenticationFailed
          return;
        }
        conn.send(JSON.stringify({ op: 2, d: { negotiatedRpcVersion: 1 } }));
        return;
      }
      if (msg.op === 6) {
        seen.requests.push(msg.d.requestType);
        const ok = msg.d.requestType !== 'Boom';
        conn.send(JSON.stringify({
          op: 7,
          d: {
            requestType: msg.d.requestType,
            requestId: msg.d.requestId,
            requestStatus: ok ? { result: true, code: 100 } : { result: false, code: 604, comment: 'no such request' },
            responseData: ok ? { cpuUsage: 12.5, activeFps: 60 } : undefined,
          },
        }));
      }
    });
  });

  await new Promise((r) => http.listen(0, '127.0.0.1', r));
  return { url: `ws://127.0.0.1:${http.address().port}`, seen, close: () => { ws.close(); http.close(); } };
}

test('connects and identifies against a server with no password', async () => {
  const obs = await fakeObs();
  const client = new ObsClient({ url: obs.url, log: quietLog });
  try {
    await client.start();
    assert.equal(client.identified, true);
    assert.equal(client.obsVersion, '30.2.2');
    assert.equal(obs.seen.identify.rpcVersion, 1);
  } finally {
    client.stop();
    obs.close();
  }
});

test('authenticates when the server asks for a password', async () => {
  const obs = await fakeObs({ password: 'hunter2' });
  const client = new ObsClient({ url: obs.url, password: 'hunter2', log: quietLog });
  try {
    await client.start();
    assert.equal(client.identified, true, 'the server accepted our authentication string');
  } finally {
    client.stop();
    obs.close();
  }
});

test('a wrong password is reported, and NOT retried forever', async () => {
  const obs = await fakeObs({ password: 'hunter2' });
  const client = new ObsClient({ url: obs.url, password: 'wrong', log: quietLog });
  try {
    await client.start();
    assert.equal(client.identified, false);
    assert.match(client.lastError, /password/i, 'says it is the password, not a generic failure');
    // A wrong password never fixes itself, so hammering OBS would be pointless.
    const before = obs.seen.identifyCount;
    await new Promise((r) => setTimeout(r, 250));
    assert.equal(obs.seen.identifyCount, before, 'no further connection attempts');
  } finally {
    client.stop();
    obs.close();
  }
});

test('a missing password is reported before connecting rather than timing out', async () => {
  const obs = await fakeObs({ password: 'hunter2' });
  const client = new ObsClient({ url: obs.url, password: '', log: quietLog });
  try {
    await client.start();
    assert.equal(client.identified, false);
    assert.match(client.lastError, /password/i);
  } finally {
    client.stop();
    obs.close();
  }
});

test('requests resolve with their response data, and failures carry OBS’s comment', async () => {
  const obs = await fakeObs();
  const client = new ObsClient({ url: obs.url, log: quietLog });
  try {
    await client.start();
    const stats = await client.request('GetStats');
    assert.equal(stats.cpuUsage, 12.5);
    assert.deepEqual(obs.seen.requests, ['GetStats']);
    await assert.rejects(() => client.request('Boom'), /no such request/);
  } finally {
    client.stop();
    obs.close();
  }
});

test('requests before identifying are refused rather than hanging', async () => {
  const client = new ObsClient({ url: 'ws://127.0.0.1:1', log: quietLog });
  await assert.rejects(() => client.request('GetStats'), /not connected/);
});
