/** Static file serving for overlays, the panel, and browser-side core modules. */
import { createReadStream, statSync } from 'node:fs';
import { join, normalize, extname, sep } from 'node:path';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
};

/**
 * Serve `urlPath` from `root`. Returns true if handled.
 * Refuses anything that escapes the root.
 */
export function serveStatic(res, root, urlPath) {
  let rel = decodeURIComponent(urlPath).replace(/^\/+/, '');
  if (rel === '' || rel.endsWith('/')) rel += 'index.html';

  const full = normalize(join(root, rel));
  if (!full.startsWith(normalize(root) + sep) && full !== normalize(root)) return false;

  let stat;
  try {
    stat = statSync(full);
  } catch {
    return false;
  }
  if (stat.isDirectory()) return serveStatic(res, root, `${urlPath.replace(/\/*$/, '')}/index.html`);

  res.writeHead(200, {
    'content-type': MIME[extname(full).toLowerCase()] || 'application/octet-stream',
    'content-length': stat.size,
    // Overlays are edited while OBS holds them open; never let a stale copy stick.
    'cache-control': 'no-cache',
  });
  createReadStream(full).pipe(res);
  return true;
}

export function sendJSON(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
  });
  res.end(payload);
}

export function sendHTML(res, status, html) {
  res.writeHead(status, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(html);
}

export async function readBody(req, limit = 1_000_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error('request body too large');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new Error('request body was not valid JSON');
  }
}
