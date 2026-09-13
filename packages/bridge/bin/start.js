#!/usr/bin/env node
/**
 * Entry point. One command, no install step, no build step.
 *
 *   node packages/bridge/bin/start.js          normal run
 *   node packages/bridge/bin/start.js --demo   force the fake-chat platform on
 */
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { createLogger, setLogLevel } from '#core/index.js';
import { loadConfig, saveConfig, CONFIG_PATH } from '../src/config.js';
import { Hub } from '../src/hub.js';
import { startServer } from '../src/server/index.js';
import { refreshExpiring } from '../src/server/auth.js';

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
if (has('--debug')) setLogLevel('debug');

const log = createLogger('bridge');

const firstRun = !existsSync(CONFIG_PATH);
const config = loadConfig();

if (has('--demo')) {
  config.platforms.fake = { ...(config.platforms.fake || {}), enabled: true };
}
// With nothing configured at all, run the demo platform so the operator sees
// chat immediately instead of an empty screen they have to debug.
if (firstRun && !Object.values(config.platforms).some((p) => p.enabled)) {
  config.platforms.fake = { ...(config.platforms.fake || {}), enabled: true };
}

const hub = new Hub(config);
await hub.load();
const server = startServer({ hub, config });
await hub.startAll();
saveConfig(config);

// Keep tokens alive without the operator ever thinking about them.
const refreshTimer = setInterval(() => {
  refreshExpiring(hub, config).catch((err) => log.warn(`token refresh sweep: ${err.message}`));
}, 5 * 60 * 1000);
refreshTimer.unref();
refreshExpiring(hub, config).catch(() => {});

banner();

if (firstRun || has('--open')) openBrowser(`${server.url}/`);

function banner() {
  const { url } = server;
  const rows = hub.status();
  const on = rows.filter((r) => r.enabled);
  const line = '─'.repeat(52);
  console.log(`
\x1b[1m OBS Streaming Toolkit \x1b[0m is running
 ${line}
  Open this to set up and style everything:
    \x1b[36m${url}/\x1b[0m

  Chat overlay URL for OBS (Browser Source):
    \x1b[36m${url}/overlays/chat/\x1b[0m
 ${line}
  Platforms: ${on.length ? on.map((r) => `${r.label}${r.connected ? ' \x1b[32m●\x1b[0m' : ' \x1b[33m○\x1b[0m'}`).join('  ') : '\x1b[33mnone connected yet — open the link above\x1b[0m'}

  Leave this window open while you stream. Press Ctrl+C to stop.
`);
}

function openBrowser(target) {
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  execFile(cmd, [target], () => {}); // best effort; never fatal
}

let shuttingDown = false;
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    if (shuttingDown) process.exit(1);
    shuttingDown = true;
    console.log('\nShutting down…');
    clearInterval(refreshTimer);
    await hub.shutdown();
    server.close();
    process.exit(0);
  });
}

// A crash in one corner must never take the stream's overlays down silently.
process.on('unhandledRejection', (err) => log.error('unhandled rejection:', err?.message || err));
process.on('uncaughtException', (err) => log.error('uncaught exception:', err?.message || err));
