#!/usr/bin/env node
/**
 * Connection diagnostic. Run it on the machine that's having trouble and paste
 * the output back. Explains why one computer passes Kick's bot protection and
 * another on the same network doesn't - the answer is always client-side:
 * which address family it connected over, what its TLS looks like, and whether
 * something on the PC (antivirus, proxy) is sitting in the middle.
 *
 *   npm run diagnose            (or: node packages/bridge/bin/diagnose.js)
 */
import https from 'node:https';
import dns from 'node:dns/promises';
import { browserCandidates, fetchViaBrowser, LOOKUP_HEADERS } from '../src/adapters/kick/index.js';
import { existsSync } from 'node:fs';

const TARGET = 'https://kick.com/api/v2/channels/4head';
const out = [];
const line = (s = '') => out.push(s);
const ok = (s) => line(`  [ok]   ${s}`);
const bad = (s) => line(`  [!!]   ${s}`);
const info = (s) => line(`  [..]   ${s}`);

line('OBS Toolkit - connection diagnostic');
line('===================================');
line(`  platform : ${process.platform} ${process.arch}  (${process.release?.name} ${process.version}, OpenSSL ${process.versions.openssl})`);
line(`  time     : ${new Date().toISOString()}`);
line(`  toolkit  : prefers IPv4 by default (OBS_TOOLKIT_IP_FAMILY=${process.env.OBS_TOOLKIT_IP_FAMILY || 'unset -> 4'})`);
if (process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.https_proxy || process.env.http_proxy) {
  bad(`a proxy is set in the environment: ${process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.https_proxy || process.env.http_proxy}`);
}
line();

// ---- 1. DNS: does this machine have both an IPv4 and an IPv6 route to Kick? ----
line('1. Name resolution for kick.com');
let v4 = [], v6 = [];
try { v4 = await dns.resolve4('kick.com'); ok(`IPv4: ${v4.join(', ')}`); } catch (e) { info(`IPv4: none (${e.code || e.message})`); }
try { v6 = await dns.resolve6('kick.com'); ok(`IPv6: ${v6.join(', ')}`); } catch (e) { info(`IPv6: none (${e.code || e.message})`); }
line();

// ---- 2. Raw request, per address family, with TLS details ----
line('2. Direct request from Node, sending exactly what the toolkit sends');
const verdicts = {};
for (const family of [0, 4, 6, 'noua']) {
  const label = family === 'noua' ? 'same, but with NO User-Agent (control)' : family === 0 ? 'auto (what Node picks)' : `IPv${family} only`;
  if (family === 6 && !v6.length) { info(`${label}: skipped, no IPv6 route`); continue; }
  try {
    const r = await probe(TARGET, family === 'noua' ? 0 : family, family === 'noua' ? { accept: LOOKUP_HEADERS.accept } : LOOKUP_HEADERS);
    verdicts[family] = r;
    const where = `${r.remoteFamily} ${r.remoteAddress}`;
    const cf = `edge ${r.cfRay || '?'}${r.cfMitigated ? `, cf-mitigated=${r.cfMitigated}` : ''}`;
    const mark = r.status === 200 && r.kind === 'JSON' ? ok : family === 'noua' ? info : bad;
    mark(`${label}: ${r.status} ${r.kind} via ${where}  (${cf})`);
    if (family !== 'noua') {
      info(`      TLS issuer seen: ${r.issuer}   protocol ${r.tlsProtocol}, ALPN ${r.alpn || 'none'}`);
      if (r.suspiciousIssuer) bad(`      certificate is NOT from Cloudflare/Google/Let's Encrypt - something on this PC is inspecting HTTPS (${r.issuer})`);
    }
  } catch (e) {
    bad(`${label}: ${e.code || ''} ${e.message}`);
  }
}
line();

// ---- 3. Browser fallback ----
line('3. Browser fallback (what the toolkit tries when Node is refused)');
const candidates = browserCandidates();
const present = candidates.filter((c) => (c.includes('/') || c.includes('\\') ? existsSync(c) : false));
if (present.length) ok(`browsers found: ${present.map((p) => p.split(/[\\/]/).pop()).join(', ')}`);
else bad(`no browser found at: ${candidates.join(' | ')}`);
if (present.length) {
  const t = Date.now();
  const json = await fetchViaBrowser(TARGET, { candidates: present, log: null });
  if (json?.chatroom?.id) ok(`browser fetch worked (chatroom ${json.chatroom.id}) in ${Date.now() - t} ms`);
  else bad(`browser fetch returned nothing in ${Date.now() - t} ms - the challenge may need longer, or the browser blocked headless mode`);
}
line();

// ---- 4. Verdict ----
line('4. Likely explanation');
const auto = verdicts[0], only4 = verdicts[4], only6 = verdicts[6];
const pass = (r) => r && r.status === 200 && r.kind === 'JSON';
if (pass(auto)) {
  ok('this machine is NOT being blocked right now. If the toolkit still fails here, send this output anyway.');
} else {
  if (Object.values(verdicts).some((r) => r?.suspiciousIssuer)) {
    bad('HTTPS is being intercepted on this PC (antivirus web-shield, parental control, or corporate proxy). Cloudflare sees ITS fingerprint, not Node\'s, and refuses it. Add an exception for node.exe in that software, or turn its HTTPS/web scanning off, and retry.');
  }
  if (auto && only4 && auto.remoteFamily !== only4.remoteFamily && pass(only4) && !pass(auto)) {
    bad(`Node connected over ${auto.remoteFamily} and was refused, but IPv4 passes. The two machines on your Wi-Fi are using DIFFERENT public addresses (IPv6 vs IPv4), so Cloudflare scores them differently. The toolkit already prefers IPv4 when started normally; if it still fails, send this output.`);
  } else if (only6 && !pass(only6) && pass(only4)) {
    bad('IPv6 is refused while IPv4 passes - the IPv6 address has a worse reputation. The toolkit prefers IPv4 by default, so a normal start should already avoid this.');
  }
  if (verdicts.noua && !pass(verdicts.noua) && pass(verdicts[4])) {
    info('the no-User-Agent control was refused while the real request passed: Kick refuses anonymous-looking requests, which is expected and not the toolkit\'s problem.');
  }
  if (![0, 4, 6].map((k) => verdicts[k]).some(pass)) {
    info('every direct attempt was refused. Cloudflare is scoring this connection low; the browser fallback above is the intended path, and it only needs to succeed once per channel.');
  }
}
line();
line('Paste everything above when asking for help.');
console.log(out.join('\n'));

/** One HTTPS GET with the details Cloudflare actually judges. */
function probe(url, family, headers) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        host: u.hostname,
        path: u.pathname,
        method: 'GET',
        headers,
        family: family || undefined,
        autoSelectFamily: family === 0 ? undefined : false,
        timeout: 15000,
        ALPNProtocols: ['http/1.1'],
      },
      (res) => {
        const sock = res.socket;
        const cert = sock.getPeerCertificate?.() || {};
        const issuer = [cert.issuer?.O, cert.issuer?.CN].filter(Boolean).join(' / ') || 'unknown';
        const trusted = /cloudflare|google trust|let's encrypt|lets encrypt|digicert|sectigo|globalsign|amazon|baltimore|isrg/i.test(issuer);
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { if (body.length < 4000) body += c; });
        res.on('end', () => {
          const kind = body.trim().startsWith('{') ? (res.statusCode === 200 ? 'JSON' : 'JSON block response')
            : /just a moment|cf-chl|challenge-platform|enable javascript/i.test(body) ? 'CLOUDFLARE CHALLENGE PAGE'
            : /access denied|blocked/i.test(body) ? 'CLOUDFLARE BLOCK PAGE' : `other (${body.slice(0, 40).replace(/\s+/g, ' ')})`;
          resolve({
            status: res.statusCode,
            kind,
            cfRay: res.headers['cf-ray'],
            cfMitigated: res.headers['cf-mitigated'],
            remoteAddress: sock.remoteAddress,
            remoteFamily: sock.remoteFamily,
            tlsProtocol: sock.getProtocol?.(),
            alpn: sock.alpnProtocol,
            issuer,
            suspiciousIssuer: !trusted,
          });
        });
      },
    );
    req.on('timeout', () => req.destroy(new Error('timed out after 15s')));
    req.on('error', reject);
    req.end();
  });
}
