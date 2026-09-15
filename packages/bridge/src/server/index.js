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
import { makePreviewEvent } from '#core/preview-feed.js';
import { parseClock } from '#core/timer-model.js';
import { TimerService } from '../timer.js';
import { startModules } from '../modules/loader.js';
import { ROOT, saveConfig, setPlatformConfig, resetToSeed } from '../config.js';
import { loadPresets, listPresets, putPreset, deletePreset } from '../presets.js';
import { loadData, saveData } from '../store.js';
import { serveStatic, sendJSON, sendHTML, readBody } from './static.js';
import {
  beginAuth, completeAuth, callbackPage, redirectUriFor,
  startDeviceLogin, deviceLoginStatus, cancelDeviceLogin,
} from './auth.js';

const log = createLogger('server');

const OVERLAYS_DIR = join(ROOT, 'packages', 'overlays');
const MODULES_DIR = join(ROOT, 'packages', 'modules');
const PANEL_DIR = join(ROOT, 'packages', 'panel');
const CORE_DIR = join(ROOT, 'packages', 'core', 'src');
const ASSETS_DIR = join(ROOT, 'assets');

export async function startServer({ hub, config, onQuit = null }) {
  // Feature modules register themselves; nothing below names one.
  const modules = await startModules({ config, hub });
  hub.modules = modules;

  // Toolkit state rather than a platform event, so it travels as its own
  // top-level message type instead of being squeezed into the event schema.
  const timer = new TimerService(loadData(config, 'timer', {}) || {});
  // Remember how the timer is set up, so a restart comes back the same.
  timer.on('change', (state) => {
    saveData(config, 'timer', { durationMs: state.durationMs, label: state.label, mode: state.mode, atZero: state.atZero, doneText: state.doneText });
  });
  hub.timer = timer;
  const requestHandler = (req, res) => {
    handle(req, res, { hub, config, onQuit }).catch((err) => {
      log.error(`${req.method} ${req.url}: ${err.message}`);
      if (!res.headersSent) sendJSON(res, 500, { error: err.message });
      else res.end();
    });
  };
  const http = createServer(requestHandler);
  const ws = new WSServer(http, { path: '/events' });
  // How a module reaches connected overlays without knowing about sockets.
  hub.broadcast = (message) => ws.broadcast(message);

  // Windows resolves "localhost" to ::1 before 127.0.0.1, and on some setups a
  // connection to an unbound ::1 hangs instead of failing fast, so the browser
  // sits on "loading". Serve both loopback addresses; still nothing off-machine.
  const http6 = createServer(requestHandler);
  ws.attach(http6);

  ws.on('connection', (conn, req) => {
    const params = new URL(req.url, 'http://x').searchParams;
    const filter = (params.get('platforms') || '').split(',').map((s) => s.trim()).filter(Boolean);
    const backlogSize = Math.min(100, Number(params.get('backlog')) || 0);

    conn.send(JSON.stringify({ type: 'hello', platforms: hub.manifests(), ts: Date.now() }));
    // A freshly opened timer source needs the current state immediately.
    conn.send(JSON.stringify({ type: 'timer', state: timer.get() }));
    // Anything a module wants a freshly connected overlay to know.
    for (const m of hub.modules.list) {
      for (const message of m.instance?.hello?.() || []) conn.send(JSON.stringify(message));
    }
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
  const onTimer = (state) => ws.broadcast({ type: 'timer', state });
  timer.on('change', onTimer);
  hub.on('event', onEvent);
  hub.on('status', () => ws.broadcast({ type: 'status', platforms: hub.status(), ts: Date.now() }));

  const { host, httpPort } = config.bridge;
  http.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n  Port ${httpPort} is already in use. The toolkit is probably already running\n  in another window - use that one, or close it and start again.\n`);
    } else {
      console.error(`\n  Could not start the local server: ${err.message}\n`);
    }
    process.exit(1);
  });
  http.listen(httpPort, host);

  if (host === '127.0.0.1') {
    // No IPv6 loopback on this machine is fine; the IPv4 listener already works.
    http6.on('error', (err) => log.debug(`no ::1 listener (${err.code})`));
    http6.listen(httpPort, '::1');
  }

  return {
    http,
    ws,
    url: `http://localhost:${httpPort}`,
    altUrl: `http://${host}:${httpPort}`,
    close() {
      modules.stop();
      timer.off('change', onTimer);
      hub.off('event', onEvent);
      ws.close();
      http.close();
      http6.close();
    },
  };
}

async function handle(req, res, ctx) {
  const url = new URL(req.url, 'http://127.0.0.1');
  const path = url.pathname;

  // ---- Module-owned API ----------------------------------------------------
  // /api/m/<module>/<rest> is handed straight to that module. This one branch
  // replaces the per-feature route branches that used to accumulate here.
  const moduleApi = /^\/api\/m\/([a-z0-9-]+)(\/.*)?$/i.exec(path);
  if (moduleApi) {
    const entry = ctx.hub.modules?.get(moduleApi[1]);
    if (!entry?.instance?.routes) return sendJSON(res, 404, { error: `no such module: ${moduleApi[1]}` });
    const handled = await entry.instance.routes({
      path: moduleApi[2] || '/', method: req.method, url, req, res, sendJSON, readBody,
    });
    if (handled !== false) return;
    return sendJSON(res, 404, { error: `no such endpoint: ${path}` });
  }

  // ---- Module-owned static -------------------------------------------------
  const moduleOverlay = /^\/overlays\/([a-z0-9-]+)\/(.*)$/i.exec(path);
  if (moduleOverlay && ctx.hub.modules?.get(moduleOverlay[1])) {
    const entry = ctx.hub.modules.get(moduleOverlay[1]);
    if (serveStatic(res, join(entry.dir, 'overlays'), `/${moduleOverlay[2]}`)) return;
  }
  const moduleShared = /^\/m\/([a-z0-9-]+)\/(.*)$/i.exec(path);
  if (moduleShared && ctx.hub.modules?.get(moduleShared[1])) {
    const entry = ctx.hub.modules.get(moduleShared[1]);
    if (serveStatic(res, join(entry.dir, 'shared'), `/${moduleShared[2]}`)) return;
  }
  const modulePanel = /^\/panel\/([a-z0-9-]+)\/(.*)$/i.exec(path);
  if (modulePanel && ctx.hub.modules?.get(modulePanel[1])) {
    const entry = ctx.hub.modules.get(modulePanel[1]);
    if (serveStatic(res, join(entry.dir, 'panel'), `/${modulePanel[2]}`)) return;
  }

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

async function api(req, res, url, { hub, config, onQuit }) {
  const path = url.pathname;

  if (path === '/api/modules' && req.method === 'GET') {
    return sendJSON(res, 200, {
      modules: hub.modules?.status() || [],
      overlays: hub.modules?.overlays() || [],
      cards: hub.modules?.panelCards() || [],
    });
  }

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
      obs: {
        enabled: config.obs.enabled,
        url: config.obs.url,
        hasPassword: !!config.obs.password,
        ...(hub.health?.status() || {}),
      },
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
      setPlatformConfig(config, id, body);
      // Apply immediately: a corrected channel name must not wait for a toggle.
      const entry = hub.platforms.get(id);
      if (entry.enabled) {
        await hub.stopPlatform(id);
        await hub.startPlatform(id);
      }
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
    // undefined removes the key from the saved layer, forgetting the login.
    setPlatformConfig(config, id, {
      accessToken: undefined, refreshToken: undefined, expiresAt: undefined,
      connectedAt: undefined, userId: undefined, login: undefined, displayName: undefined,
      enabled: false,
    });
    hub.platforms.get(id).enabled = false;
    return sendJSON(res, 200, { ok: true });
  }

  if (path === '/api/backlog' && req.method === 'GET') {
    const limit = Math.min(100, Number(url.searchParams.get('limit')) || 25);
    const platforms = (url.searchParams.get('platforms') || '').split(',').filter(Boolean);
    return sendJSON(res, 200, { events: hub.backlog(limit, platforms.length ? platforms : null) });
  }

  // ---- saved presets (the operator's own looks and command sets) ----
  if (path === '/api/presets' && req.method === 'GET') {
    return sendJSON(res, 200, { presets: loadPresets(config) });
  }

  if (path === '/api/presets' && req.method === 'POST') {
    const body = await readBody(req);
    try {
      const preset = putPreset(config, body.kind, body);
      return sendJSON(res, 200, { ok: true, preset, presets: loadPresets(config) });
    } catch (err) {
      return sendJSON(res, 400, { error: err.message });
    }
  }

  const presetKind = /^\/api\/presets\/([a-z]+)$/i.exec(path);
  if (presetKind && req.method === 'GET') {
    try {
      return sendJSON(res, 200, { presets: listPresets(config, presetKind[1]) });
    } catch (err) {
      return sendJSON(res, 400, { error: err.message });
    }
  }

  const presetDelete = /^\/api\/presets\/([a-z]+)\/([a-z0-9-]+)$/i.exec(path);
  if (presetDelete && req.method === 'DELETE') {
    try {
      deletePreset(config, presetDelete[1], presetDelete[2]);
      return sendJSON(res, 200, { ok: true, presets: loadPresets(config) });
    } catch (err) {
      return sendJSON(res, 400, { error: err.message });
    }
  }

  if (path === '/api/config/reset' && req.method === 'POST') {
    const fresh = resetToSeed();
    // Replace the live object's contents so everything already holding it sees the reset.
    for (const key of Object.keys(config)) delete config[key];
    Object.assign(config, fresh);
    return sendJSON(res, 200, { ok: true, restartRequired: true });
  }

  if (path === '/api/chatbot' && req.method === 'GET') {
    return sendJSON(res, 200, hub.chatbot.status());
  }

  if (path === '/api/chatbot' && req.method === 'POST') {
    const body = await readBody(req);
    return sendJSON(res, 200, hub.chatbot.save(body));
  }

  if (path === '/api/chatbot/restore' && req.method === 'POST') {
    const body = await readBody(req);
    return sendJSON(res, 200, hub.chatbot.restore(body.which));
  }

  if (path === '/api/chatbot/test' && req.method === 'POST') {
    const body = await readBody(req);
    return sendJSON(res, 200, hub.chatbot.test(String(body.trigger || '')));
  }

  if (path === '/api/timer' && req.method === 'GET') {
    return sendJSON(res, 200, { state: hub.timer.get() });
  }

  if (path === '/api/timer' && req.method === 'POST') {
    const body = await readBody(req);
    // The duration may arrive as "5:00" from the setup page's box.
    if (typeof body.duration === 'string') {
      const ms = parseClock(body.duration);
      if (ms === null) return sendJSON(res, 400, { error: `"${body.duration}" is not a time like 5:00` });
      body.durationMs = ms;
    }
    const state = hub.timer.dispatch({ ...body, type: body.action || body.type });
    return sendJSON(res, 200, { ok: true, state });
  }

  if (path === '/api/obs/config' && req.method === 'POST') {
    const body = await readBody(req);
    const next = { ...config.obs };
    if (typeof body.url === 'string') next.url = body.url.trim();
    if (typeof body.password === 'string' && body.password !== '__set__') next.password = body.password;
    if (typeof body.enabled === 'boolean') next.enabled = body.enabled;
    config.obs = next;
    saveConfig(config);
    // Reconnect with the new details straight away.
    await hub.health?.stop();
    await hub.health?.start();
    return sendJSON(res, 200, { ok: true, obs: { url: next.url, enabled: next.enabled, hasPassword: !!next.password } });
  }

  if (path === '/api/obs/test' && req.method === 'POST') {
    if (!hub.health) return sendJSON(res, 200, { ok: false, detail: 'health service not running' });
    return sendJSON(res, 200, await hub.health.test());
  }

  // Fire one fake alert through the real pipeline so the OBS source shows it.
  if (path === '/api/test-event' && req.method === 'POST') {
    const body = await readBody(req);
    const allowed = ['follow', 'subscription', 'donation', 'raid', 'chat'];
    const type = allowed.includes(body.type) ? body.type : 'follow';
    const enabled = hub.status().filter((r) => r.enabled && r.id !== 'fake').map((r) => r.id);
    const platform = hub.platforms.has(body.platform) ? body.platform : enabled[0] || 'fake';
    const event = makePreviewEvent([platform], type);
    // An exact line, so a feature that reacts to chat can be driven from a test.
    if (typeof body.text === 'string' && body.text && event.data) event.data.text = body.text;
    hub.inject(event);
    return sendJSON(res, 200, { ok: true, event });
  }

  if (path === '/api/quit' && req.method === 'POST') {
    sendJSON(res, 200, { ok: true });
    // Reply first, then shut down on the next tick so the response gets out.
    setTimeout(() => onQuit?.(), 50);
    return;
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
