/**
 * obs-websocket v5 client.
 *
 * Talks to OBS itself rather than a streaming platform, so it lives outside the
 * adapter system. Scope is deliberately small: connect, authenticate, poll two
 * requests, reconnect forever. No control of OBS - this feature only watches.
 *
 * Protocol (opcodes): 0 Hello -> 1 Identify -> 2 Identified, then 6 Request /
 * 7 RequestResponse. Verified against the published spec; the auth steps below
 * are exercised by the spec's own worked example in the tests.
 */
import { createHash, randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { createReconnector } from '#core/backoff.js';

const OP = { HELLO: 0, IDENTIFY: 1, IDENTIFIED: 2, EVENT: 5, REQUEST: 6, RESPONSE: 7 };
const RPC_VERSION = 1;
const REQUEST_TIMEOUT_MS = 8000;

/**
 * The authentication string obs-websocket expects:
 *   base64(sha256(password + salt)) then base64(sha256(that + challenge)).
 * Pure, so the spec's worked example can be asserted in a test.
 */
export function authString(password, salt, challenge) {
  const secret = createHash('sha256').update(password + salt).digest('base64');
  return createHash('sha256').update(secret + challenge).digest('base64');
}

export class ObsClient extends EventEmitter {
  /** @param {{url: string, password?: string, log: object}} options */
  constructor({ url, password = '', log }) {
    super();
    this.url = url;
    this.password = password;
    this.log = log;
    this.socket = null;
    this.identified = false;
    this.lastError = null;
    this.obsVersion = null;
    this.pending = new Map(); // requestId -> { resolve, reject, timer }
    this.stopped = false;
    this.conn = createReconnector({ label: 'OBS', log, connect: () => this.#connect(), maxMs: 30000 });
  }

  start() {
    this.stopped = false;
    return this.conn.start();
  }

  stop() {
    this.stopped = true;
    this.conn.stop();
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(new Error('disconnected'));
    }
    this.pending.clear();
    try {
      this.socket?.close();
    } catch {
      /* already gone */
    }
    this.socket = null;
    this.identified = false;
  }

  /** @returns {Promise<object>} the response data, or throws with OBS's own comment. */
  request(requestType, requestData = undefined) {
    if (!this.identified) return Promise.reject(new Error('not connected to OBS'));
    const requestId = randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error(`OBS did not answer ${requestType} in time`));
      }, REQUEST_TIMEOUT_MS);
      timer.unref?.();
      this.pending.set(requestId, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ op: OP.REQUEST, d: { requestType, requestId, requestData } }));
    });
  }

  #connect() {
    if (this.stopped) return Promise.resolve();
    return new Promise((resolve, reject) => {
      let socket;
      try {
        socket = new WebSocket(this.url);
      } catch (err) {
        reject(new Error(`bad OBS address (${err.message})`));
        return;
      }
      this.socket = socket;
      let settled = false;
      const fail = (err) => {
        if (settled) return;
        settled = true;
        this.lastError = err.message;
        reject(err);
      };
      const timeout = setTimeout(() => {
        fail(new Error('timed out connecting to OBS'));
        socket.close();
      }, 10000);

      socket.onmessage = (raw) => {
        let msg;
        try {
          msg = JSON.parse(raw.data);
        } catch {
          return;
        }

        if (msg.op === OP.HELLO) {
          const d = msg.d || {};
          this.obsVersion = d.obsStudioVersion || null;
          const identify = { rpcVersion: RPC_VERSION, eventSubscriptions: 0 }; // we only poll
          if (d.authentication) {
            if (!this.password) {
              fail(Object.assign(new Error('OBS needs the WebSocket password'), { needsPassword: true, noRetry: true }));
              socket.close();
              return;
            }
            identify.authentication = authString(this.password, d.authentication.salt, d.authentication.challenge);
          }
          socket.send(JSON.stringify({ op: OP.IDENTIFY, d: identify }));
          return;
        }

        if (msg.op === OP.IDENTIFIED) {
          clearTimeout(timeout);
          this.identified = true;
          this.lastError = null;
          settled = true;
          this.log.info(`connected to OBS ${this.obsVersion || ''}`.trim());
          this.emit('connected');
          resolve();
          return;
        }

        if (msg.op === OP.RESPONSE) {
          const d = msg.d || {};
          const p = this.pending.get(d.requestId);
          if (!p) return;
          this.pending.delete(d.requestId);
          clearTimeout(p.timer);
          if (d.requestStatus?.result) p.resolve(d.responseData || {});
          else p.reject(new Error(d.requestStatus?.comment || `OBS refused ${d.requestType} (code ${d.requestStatus?.code})`));
        }
      };

      socket.onerror = () => fail(new Error('could not reach OBS'));
      socket.onclose = (event) => {
        clearTimeout(timeout);
        const wasIdentified = this.identified;
        this.identified = false;
        this.socket = null;
        for (const [id, p] of this.pending) {
          clearTimeout(p.timer);
          p.reject(new Error('OBS disconnected'));
          this.pending.delete(id);
        }
        // 4009 is obs-websocket's AuthenticationFailed close code.
        if (event?.code === 4009) {
          this.lastError = 'that OBS WebSocket password is wrong';
          fail(Object.assign(new Error(this.lastError), { needsPassword: true, noRetry: true }));
          return;
        }
        if (wasIdentified) {
          this.emit('disconnected');
          if (!this.stopped) this.conn.retry('OBS disconnected');
        } else {
          fail(new Error(this.lastError || 'OBS closed the connection'));
        }
      };
    });
  }
}
