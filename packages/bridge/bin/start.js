#!/usr/bin/env node
/**
 * Entry point. One command, no install step, no build step.
 *
 *   node packages/bridge/bin/start.js          normal run
 *   node packages/bridge/bin/start.js --demo   force the fake-chat platform on
 */
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import dns from 'node:dns';
import { createLogger, setLogLevel } from '#core/index.js';
import { loadConfig, setPlatformConfig, CONFIG_PATH } from '../src/config.js';
import { Hub } from '../src/hub.js';
import { startServer } from '../src/server/index.js';
import { refreshExpiring } from '../src/server/auth.js';
import { createHealthService } from '../src/obs/health.js';

// Prefer IPv4 for outbound connections. Two machines on one Wi-Fi can present
// different public addresses (one over IPv6, one over IPv4), and bot filters
// score them separately; IPv4 is the better-known one and IPv6 buys nothing here.
// Override with OBS_TOOLKIT_IP_FAMILY=6 or =auto.
const ipFamily = process.env.OBS_TOOLKIT_IP_FAMILY;
if (ipFamily !== '6' && ipFamily !== 'auto') dns.setDefaultResultOrder('ipv4first');
else if (ipFamily === '6') dns.setDefaultResultOrder('verbatim');

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
if (has('--debug')) setLogLevel('debug');

const log = createLogger('bridge');

const firstRun = !existsSync(CONFIG_PATH);
const config = loadConfig();

// --demo is for this run only; it must not be remembered as a saved choice.
if (has('--demo')) {
  config.platforms.fake = { ...(config.platforms.fake || {}), enabled: true };
}
// With nothing configured or defaulted at all, run the demo platform so the
// operator sees chat immediately instead of an empty screen to debug.
if (firstRun && !Object.values(config.platforms).some((p) => p.enabled)) {
  setPlatformConfig(config, 'fake', { enabled: true });
}

const hub = new Hub(config);
await hub.load();

// OBS is not a platform, so it sits beside the hub rather than inside it.
const health = createHealthService({
  config,
  emit: (event) => hub.inject(event),
  log: createLogger('obs'),
});
hub.health = health;
const server = startServer({ hub, config, onQuit: () => shutdown('Stopped from the setup page.') });
await hub.startAll();
await health.start();

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
    (if that page won't load, use \x1b[36m${server.altUrl}/\x1b[0m)

  Chat overlay URL for OBS (Browser Source):
    \x1b[36m${url}/overlays/chat/\x1b[0m
 ${line}
  Platforms: ${on.length ? on.map((r) => `${r.label}${r.connected ? ' \x1b[32m●\x1b[0m' : ' \x1b[33m○\x1b[0m'}`).join('  ') : '\x1b[33mnone connected yet — open the link above\x1b[0m'}

  Leave this window open while you stream.
  To stop: press "Stop the toolkit" on the setup page, or just close this window.
`);
}

function openBrowser(target) {
  // On Windows `start` is a cmd.exe builtin rather than an executable, so it has
  // to be invoked through cmd; the empty "" is the window title that `start`
  // otherwise steals from the URL.
  const [cmd, args] =
    process.platform === 'darwin'
      ? ['open', [target]]
      : process.platform === 'win32'
        ? ['cmd', ['/c', 'start', '', target]]
        : ['xdg-open', [target]];
  execFile(cmd, args, () => {}); // best effort; never fatal
}

let shuttingDown = false;
async function shutdown(reason = 'Shutting down…') {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n${reason}`);
  clearInterval(refreshTimer);
  // Never hang on a stuck socket: give adapters a moment, then leave regardless.
  await Promise.race([Promise.all([hub.shutdown(), health.stop()]), new Promise((r) => setTimeout(r, 3000))]);
  server.close();
  process.exit(0);
}
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (shuttingDown) process.exit(1);
    shutdown();
  });
}

// A crash in one corner must never take the stream's overlays down silently.
process.on('unhandledRejection', (err) => log.error('unhandled rejection:', err?.message || err));
process.on('uncaughtException', (err) => log.error('uncaught exception:', err?.message || err));
