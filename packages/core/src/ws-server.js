/**
 * Minimal RFC 6455 WebSocket server, attached to a node:http server.
 *
 * Exists so the toolkit has zero npm dependencies: no `npm install` step for the
 * operator, no lockfile to drift, no supply chain to audit. Node ships a WebSocket
 * *client* but not a server, so this is the one piece we provide ourselves.
 *
 * Scope is deliberately small -- it serves local overlays on loopback:
 *   - text and binary frames, fragmented or not
 *   - ping/pong keepalive, close handshake
 *   - no permessage-deflate (messages are small; compression is not worth the code)
 */
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const OP = { CONT: 0x0, TEXT: 0x1, BINARY: 0x2, CLOSE: 0x8, PING: 0x9, PONG: 0xa };

/** A single connected client. */
class WSConnection extends EventEmitter {
  constructor(socket, req) {
    super();
    this.socket = socket;
    this.req = req;
    this.alive = true;
    this.closed = false;
    this.#buffer = Buffer.alloc(0);
    this.#fragments = [];
    this.#fragmentOp = null;

    socket.on('data', (chunk) => this.#onData(chunk));
    socket.on('close', () => this.#finish());
    socket.on('error', () => this.#finish());
    socket.setTimeout(0);
    socket.setNoDelay(true);
  }

  #buffer;
  #fragments;
  #fragmentOp;

  send(data) {
    if (this.closed) return false;
    const payload = typeof data === 'string' ? Buffer.from(data, 'utf8') : Buffer.from(data);
    const op = typeof data === 'string' ? OP.TEXT : OP.BINARY;
    try {
      this.socket.write(encodeFrame(op, payload));
      return true;
    } catch {
      this.#finish();
      return false;
    }
  }

  ping() {
    if (this.closed) return;
    try {
      this.socket.write(encodeFrame(OP.PING, Buffer.alloc(0)));
    } catch {
      this.#finish();
    }
  }

  close(code = 1000, reason = '') {
    if (this.closed) return;
    const body = Buffer.alloc(2 + Buffer.byteLength(reason));
    body.writeUInt16BE(code, 0);
    body.write(reason, 2);
    try {
      this.socket.write(encodeFrame(OP.CLOSE, body));
      this.socket.end();
    } catch {
      /* socket already gone */
    }
    this.#finish();
  }

  #finish() {
    if (this.closed) return;
    this.closed = true;
    try {
      this.socket.destroy();
    } catch {
      /* already destroyed */
    }
    this.emit('close');
  }

  #onData(chunk) {
    this.#buffer = this.#buffer.length ? Buffer.concat([this.#buffer, chunk]) : chunk;
    // A single TCP read can carry several frames, or half of one.
    for (;;) {
      const frame = decodeFrame(this.#buffer);
      if (!frame) return;
      this.#buffer = this.#buffer.subarray(frame.size);
      this.#onFrame(frame);
      if (this.closed) return;
    }
  }

  #onFrame(frame) {
    switch (frame.opcode) {
      case OP.PING:
        try {
          this.socket.write(encodeFrame(OP.PONG, frame.payload));
        } catch {
          this.#finish();
        }
        return;
      case OP.PONG:
        this.alive = true;
        return;
      case OP.CLOSE:
        this.close(1000);
        return;
      case OP.CONT:
        if (this.#fragmentOp === null) return; // continuation with no start: ignore
        this.#fragments.push(frame.payload);
        if (frame.fin) this.#deliver();
        return;
      case OP.TEXT:
      case OP.BINARY:
        if (frame.fin) {
          this.#emitMessage(frame.opcode, frame.payload);
        } else {
          this.#fragmentOp = frame.opcode;
          this.#fragments = [frame.payload];
        }
        return;
      default:
        this.close(1002, 'unsupported opcode');
    }
  }

  #deliver() {
    const op = this.#fragmentOp;
    const payload = Buffer.concat(this.#fragments);
    this.#fragments = [];
    this.#fragmentOp = null;
    this.#emitMessage(op, payload);
  }

  #emitMessage(opcode, payload) {
    this.alive = true;
    this.emit('message', opcode === OP.TEXT ? payload.toString('utf8') : payload);
  }
}

export class WSServer extends EventEmitter {
  /**
   * @param {import('node:http').Server} httpServer
   * @param {{ path?: string, heartbeatMs?: number }} [options]
   */
  constructor(httpServer, { path = null, heartbeatMs = 30000 } = {}) {
    super();
    this.clients = new Set();
    this.path = path;
    if (httpServer) this.attach(httpServer);

    // Drop connections that stopped answering, so a crashed OBS source doesn't
    // leave a dead client accumulating broadcasts forever.
    this.heartbeat = setInterval(() => {
      for (const c of this.clients) {
        if (!c.alive) {
          c.close(1001, 'no response');
          continue;
        }
        c.alive = false;
        c.ping();
      }
    }, heartbeatMs);
    this.heartbeat.unref?.();
  }

  /**
   * Accept upgrades from another http server too. Used to serve the same
   * socket on both loopback addresses (127.0.0.1 and ::1).
   */
  attach(httpServer) {
    httpServer.on('upgrade', (req, socket) => {
      if (this.path && new URL(req.url, 'http://x').pathname !== this.path) {
        socket.destroy();
        return;
      }
      const key = req.headers['sec-websocket-key'];
      if (req.headers.upgrade?.toLowerCase() !== 'websocket' || !key) {
        socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
        socket.destroy();
        return;
      }
      const accept = createHash('sha1').update(key + GUID).digest('base64');
      socket.write(
        'HTTP/1.1 101 Switching Protocols\r\n' +
          'Upgrade: websocket\r\n' +
          'Connection: Upgrade\r\n' +
          `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
      );
      const conn = new WSConnection(socket, req);
      this.clients.add(conn);
      conn.on('close', () => this.clients.delete(conn));
      this.emit('connection', conn, req);
    });
    return this;
  }

  /** Send to every connected client. Returns how many received it. */
  broadcast(data) {
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    let sent = 0;
    for (const c of this.clients) if (c.send(payload)) sent++;
    return sent;
  }

  close() {
    clearInterval(this.heartbeat);
    for (const c of this.clients) c.close(1001, 'server shutting down');
    this.clients.clear();
  }
}

function encodeFrame(opcode, payload) {
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  header[0] = 0x80 | opcode; // FIN + opcode; server frames are never masked
  return Buffer.concat([header, payload]);
}

/** Returns null when `buf` doesn't yet hold a complete frame. */
function decodeFrame(buf) {
  if (buf.length < 2) return null;
  const fin = (buf[0] & 0x80) !== 0;
  const opcode = buf[0] & 0x0f;
  const masked = (buf[1] & 0x80) !== 0;
  let len = buf[1] & 0x7f;
  let offset = 2;

  if (len === 126) {
    if (buf.length < offset + 2) return null;
    len = buf.readUInt16BE(offset);
    offset += 2;
  } else if (len === 127) {
    if (buf.length < offset + 8) return null;
    const big = buf.readBigUInt64BE(offset);
    if (big > 8n * 1024n * 1024n) throw new Error('websocket frame too large');
    len = Number(big);
    offset += 8;
  }

  let mask = null;
  if (masked) {
    if (buf.length < offset + 4) return null;
    mask = buf.subarray(offset, offset + 4);
    offset += 4;
  }

  if (buf.length < offset + len) return null;
  const payload = Buffer.from(buf.subarray(offset, offset + len));
  if (mask) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];

  return { fin, opcode, payload, size: offset + len };
}
