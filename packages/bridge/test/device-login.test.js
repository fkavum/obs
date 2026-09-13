import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startDeviceLogin, deviceLoginStatus, cancelDeviceLogin } from '../src/server/auth.js';

/**
 * A stub hub: the real device flow can't be exercised without live credentials,
 * so the state machine is tested against a fake platform instead.
 */
function makeHub(oauth, { clientId = 'abc123' } = {}) {
  const saved = [];
  const restarts = [];
  return {
    saved,
    restarts,
    platforms: new Map([['stub', { manifest: { label: 'Stub' }, oauth }]]),
    effectiveConfig: () => ({ clientId }),
    saveTokens: (id, patch) => saved.push({ id, patch }),
    stopPlatform: async (id) => restarts.push(`stop:${id}`),
    startPlatform: async (id) => restarts.push(`start:${id}`),
  };
}

const settle = (ms = 40) => new Promise((r) => setTimeout(r, ms));

const baseStart = async () => ({
  deviceCode: 'dev-code',
  userCode: 'WXYZ-1234',
  verificationUri: 'https://example.test/activate',
  intervalMs: 10,
  expiresAt: Date.now() + 60000,
});

test('hands the browser a code to show, then reports pending', async () => {
  const hub = makeHub({ mode: 'device', needs: ['clientId'], startDevice: baseStart, pollDevice: async () => null });
  const session = await startDeviceLogin(hub, {}, 'stub');
  assert.equal(session.userCode, 'WXYZ-1234');
  assert.equal(session.verificationUri, 'https://example.test/activate');
  assert.equal(session.status, 'pending');
  assert.ok(session.secondsLeft > 0);
  assert.equal(deviceLoginStatus('stub').status, 'pending');
  cancelDeviceLogin('stub');
});

test('saves tokens and restarts the platform once the user approves', async () => {
  let calls = 0;
  const hub = makeHub({
    mode: 'device',
    needs: ['clientId'],
    startDevice: baseStart,
    // Pending twice, then success -- the shape a real device flow has.
    pollDevice: async () => (++calls < 3 ? null : { accessToken: 'tok', refreshToken: 'ref' }),
  });

  await startDeviceLogin(hub, {}, 'stub');
  await settle(120);

  assert.equal(deviceLoginStatus('stub').status, 'done');
  assert.equal(hub.saved.length, 1, 'saved exactly once');
  assert.equal(hub.saved[0].patch.accessToken, 'tok');
  assert.equal(hub.saved[0].patch.enabled, true, 'connecting also switches the platform on');
  assert.deepEqual(hub.restarts, ['stop:stub', 'start:stub'], 'platform reconnects with the new token');
  cancelDeviceLogin('stub');
});

test('a rejected login is reported, not retried forever', async () => {
  const hub = makeHub({
    mode: 'device',
    needs: ['clientId'],
    startDevice: baseStart,
    pollDevice: async () => {
      throw new Error('invalid device code');
    },
  });
  await startDeviceLogin(hub, {}, 'stub');
  await settle(80);
  const status = deviceLoginStatus('stub');
  assert.equal(status.status, 'error');
  assert.equal(status.error, 'invalid device code');
  assert.equal(hub.saved.length, 0, 'nothing was stored');
  cancelDeviceLogin('stub');
});

test('an expired code stops polling and says so', async () => {
  const hub = makeHub({
    mode: 'device',
    needs: ['clientId'],
    startDevice: async () => ({ ...(await baseStart()), expiresAt: Date.now() + 15 }),
    pollDevice: async () => null,
  });
  await startDeviceLogin(hub, {}, 'stub');
  await settle(90);
  assert.equal(deviceLoginStatus('stub').status, 'expired');
  cancelDeviceLogin('stub');
});

test('refuses to start without the credentials it needs', async () => {
  const hub = makeHub({ mode: 'device', needs: ['clientId'], startDevice: baseStart, pollDevice: async () => null }, { clientId: '' });
  await assert.rejects(() => startDeviceLogin(hub, {}, 'stub'), /missing clientId/);
});

test('refuses on a platform that does not use code login', async () => {
  const hub = makeHub({ mode: 'redirect', authorizeUrl: () => 'x' });
  await assert.rejects(() => startDeviceLogin(hub, {}, 'stub'), /does not use code login/);
});

test('cancelling forgets the session', async () => {
  const hub = makeHub({ mode: 'device', needs: ['clientId'], startDevice: baseStart, pollDevice: async () => null });
  await startDeviceLogin(hub, {}, 'stub');
  cancelDeviceLogin('stub');
  assert.equal(deviceLoginStatus('stub').status, 'none');
});
