/**
 * The local HTTP + WebSocket server.
 *
 * Serves three things on one port: the overlays OBS loads, the panel the
 * operator uses (wizard + settings), and a small JSON API. Bound to loopback --
 * nothing here is reachable from the network.
 */
import { createServer } from 'node:http';
import { join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { WSServer, createLogger } from '#core/index.js';
import { ROOT, saveConfig } from '../config.js';
import { serveStatic, sendJSON, sendHTML, readBody } from './static.js';
import {
  beginAuth, completeAuth, callbackPage, redirectUriFor,
  startDeviceLogin, deviceLoginStatus, cancelDeviceLogin,
} from './auth.js';

const log = createLogger('server');

const OVERLAYS_DIR = join(ROOT, 'packages', 'overlays');
const PANEL_DIR = join(ROOT, 'packages', 'panel');
const CORE_DIR = join(ROOT, 'packages', 'core', 'src');
const ASSETS_DIR = join(ROOT, 'assets');

export function startServer({ hub, config }) {
  const http = createServer((req, res) => {
    handle(req, res, { hub, config }).catch((err) => {
      log.error(`${req.method} ${req.url}: ${err.message}`);
      if (!res.headersSent) sendJSON(res, 500, { error: err.message });
      else res.end();
    });
  });

  const ws = new WSServer(http, { path: '/events' });

  ws.on('connection', (conn, req) => {
    const params = new URL(req.url, 'http://x').searchParams;
    const filter = (params.get('platforms') || '').split(',').map((s) => s.trim()).filter(Boolean);
    const backlogSize = Math.min(100, Number(params.get('backlog')) || 0);

    conn.send(JSON.stringify({ type: 'hello', platforms: hub.manifests(), ts: Date.now() }));
    if (backlogSize) {
      for (const event of hub.backlog(backlogSize, filter.length ? filter : null)) {
        conn.send(JSON.stringify({ type: 'event', event, replay: true }));
      }
    }
    conn.filter = filter;
    log.debug(`overlay connected (${ws.clients.size} total)`);
  });

  const onEvent = (event) => {
    const payload = JSON.stringify({ type: 'event', event });
    for (const c of ws.clients) {
      if (c.filter?.length && !c.filter.includes(event.platform)) continue;
      c.send(payload);
    }
  };
  hub.on('event', onEvent);
  hub.on('status', () => ws.broadcast({ type: 'status', platforms: hub.status(), ts: Date.now() }));

  const { host, httpPort } = config.bridge;
  http.listen(httpPort, host);

  return {
    http,
    ws,
    url: `http://${host}:${httpPort}`,
    close() {
      hub.off('event', onEvent);
      ws.close();
      http.close();
    },
  };
}

async function handle(req, res, ctx) {
  const url = new URL(req.url, 'http://127.0.0.1');
  const path = url.pathname;

  // ---- API ---------------------------------------------------------------
  if (path.startsWith('/api/')) return api(req, res, url, ctx);

  // ---- OAuth redirects ---------------------------------------------------
  const auth = /^\/auth\/([a-z0-9_-]+)\/(start|callback)$/i.exec(path);
  if (auth) {
    const [, platformId, action] = auth;
    if (action === 'start') {
      try {
        res.writeHead(302, { location: beginAuth(ctx.hub, ctx.config, platformId) });
        res.end();
      } catch (err) {
        sendHTML(res, 400, callbackPage({ ok: false, platform: platformId, message: err.message }));
      }
      return;
    }
    try {
      await completeAuth(ctx.hub, ctx.config, platformId, url.searchParams);
      sendHTML(res, 200, callbackPage({ ok: true, platform: platformId, message: 'You are all set. This platform is now connected.' }));
    } catch (err) {
      sendHTML(res, 400, callbackPage({ ok: false, platform: platformId, message: err.message }));
    }
    return;
  }

  // ---- Static ------------------------------------------------------------
  if (path.startsWith('/overlays/') && serveStatic(res, OVERLAYS_DIR, path.slice('/overlays'.length))) return;
  if (path.startsWith('/core/') && serveStatic(res, CORE_DIR, path.slice('/core'.length))) return;
  if (path.startsWith('/assets/') && serveStatic(res, ASSETS_DIR, path.slice('/assets'.length))) return;
  if (path === '/settings') { res.writeHead(302, { location: '/settings/' }); res.end(); return; }
  if (serveStatic(res, PANEL_DIR, path === '/' ? '/index.html' : path)) return;

  sendHTML(res, 404, '<!doctype html><meta charset="utf-8"><title>Not found</title><body style="font:16px system-ui;padding:40px">Nothing here. <a href="/">Go back to the toolkit</a>.');
}

async function api(req, res, url, { hub, config }) {
  const path = url.pathname;

  if (path === '/api/platforms' && req.method === 'GET') {
    return sendJSON(res, 200, { platforms: hub.manifests() });
  }

  if (path === '/api/status' && req.method === 'GET') {
    return sendJSON(res, 200, {
      ok: true,
      bridge: {
        host: config.bridge.host,
        httpPort: config.bridge.httpPort,
        url: `http://${config.bridge.host}:${config.bridge.httpPort}`,
        uptimeSec: Math.round(process.uptime()),
      },
      // The redirect URI must match what the platform has registered exactly, so
      // it is computed here rather than guessed from the browser's address bar.
      platforms: hub.status().map((row) => ({ ...row, redirectUri: redirectUriFor(config, row.id) })),
      obs: { enabled: config.obs.enabled, url: config.obs.url },
    });
  }

  const icon = /^\/api\/platforms\/([a-z0-9_-]+)\/icon\.svg$/i.exec(path);
  if (icon) {
    const entry = hub.platforms.get(icon[1]);
    const file = entry && join(entry.dir, entry.manifest.icon || 'icon.svg');
    if (file && existsSync(file)) {
      res.writeHead(200, { 'content-type': 'image/svg+xml', 'cache-control': 'no-cache' });
      return res.end(readFileSync(file));
    }
    return sendJSON(res, 404, { error: 'no icon' });
  }

  // ---- device code login (one-click Connect) ----
  const device = /^\/api\/platforms\/([a-z0-9_-]+)\/device\/(start|status|cancel)$/i.exec(path);
  if (device) {
    const [, id, action] = device;
    if (action === 'status') return sendJSON(res, 200, deviceLoginStatus(id));
    if (action === 'cancel') {
      cancelDeviceLogin(id);
      return sendJSON(res, 200, { ok: true });
    }
    try {
      return sendJSON(res, 200, await startDeviceLogin(hub, config, id));
    } catch (err) {
      return sendJSON(res, 400, { status: 'error', error: err.message });
    }
  }

  const enable = /^\/api\/platforms\/([a-z0-9_-]+)\/enabled$/i.exec(path);
  if (enable && req.method === 'POST') {
    const body = await readBody(req);
    const status = await hub.setEnabled(enable[1], !!body.enabled);
    return sendJSON(res, 200, { ok: true, platform: status });
  }

  const platformCfg = /^\/api\/platforms\/([a-z0-9_-]+)\/config$/i.exec(path);
  if (platformCfg) {
    const id = platformCfg[1];
    if (!hub.platforms.has(id)) return sendJSON(res, 404, { error: `unknown platform: ${id}` });
    if (req.method === 'GET') {
      return sendJSON(res, 200, { config: publicPlatformConfig(config.platforms[id]) });
    }
    if (req.method === 'POST') {
      const body = await readBody(req);
      config.platforms[id] = { ...(config.platforms[id] || {}), ...body };
      saveConfig(config);
      return sendJSON(res, 200, {
        ok: true,
        config: publicPlatformConfig(config.platforms[id]),
        redirectUri: redirectUriFor(config, id),
      });
    }
  }

  const disconnect = /^\/api\/platforms\/([a-z0-9_-]+)\/disconnect$/i.exec(path);
  if (disconnect && req.method === 'POST') {
    const id = disconnect[1];
    await hub.stopPlatform(id);
    const kept = { ...(config.platforms[id] || {}) };
    for (const key of ['accessToken', 'refreshToken', 'expiresAt', 'connectedAt', 'userId']) delete kept[key];
    kept.enabled = false;
    config.platforms[id] = kept;
    saveConfig(config);
    hub.platforms.get(id).enabled = false;
    return sendJSON(res, 200, { ok: true });
  }

  if (path === '/api/backlog' && req.method === 'GET') {
    const limit = Math.min(100, Number(url.searchParams.get('limit')) || 25);
    const platforms = (url.searchParams.get('platforms') || '').split(',').filter(Boolean);
    return sendJSON(res, 200, { events: hub.backlog(limit, platforms.length ? platforms : null) });
  }

  if (path === '/api/bridge' && req.method === 'POST') {
    const body = await readBody(req);
    config.bridge = { ...config.bridge, ...body };
    saveConfig(config);
    return sendJSON(res, 200, { ok: true, bridge: config.bridge, restartRequired: true });
  }

  return sendJSON(res, 404, { error: `no such endpoint: ${path}` });
}

/** Never send secrets to the browser -- only whether they are set. */
function publicPlatformConfig(cfg = {}) {
  const out = {};
  for (const [key, value] of Object.entries(cfg)) {
    if (/token|secret|password/i.test(key)) out[key] = value ? '__set__' : '';
    else out[key] = value;
  }
  return out;
}
