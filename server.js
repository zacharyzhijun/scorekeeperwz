// A static file server, so the app can be opened in a browser and installed to
// a phone's home screen. It holds no game data: every score lives in the
// browser that entered it, and this process never sees one.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';

const SITE_DIR = fileURLToPath(new URL('./docs', import.meta.url));
const PORT = Number(process.env.PORT) || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
  let rel = normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  // Serve a folder's index.html, the way static hosts do: "/phase10/" and
  // "/phase10" both resolve to "/phase10/index.html".
  if (rel.endsWith('/')) rel += 'index.html';
  else if (!extname(rel)) rel += '/index.html';
  const file = join(SITE_DIR, rel);

  if (!file.startsWith(SITE_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Forbidden');
    return;
  }

  try {
    const content = await readFile(file);
    const headers = {
      'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
      'Content-Length': content.length,
    };
    // The service worker must never be served stale, or updates can't ship.
    if (rel.endsWith('sw.js')) headers['Cache-Control'] = 'no-cache';
    res.writeHead(200, headers);
    res.end(content);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
  }
});

function lanAddress() {
  for (const addrs of Object.values(networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.family === 'IPv4' && !addr.internal) return addr.address;
    }
  }
  return null;
}

server.listen(PORT, () => {
  const lan = lanAddress();
  console.log('Phase 10 scorer:');
  console.log(`  on this Mac   http://localhost:${PORT}`);
  if (lan) console.log(`  on your phone http://${lan}:${PORT}`);
});
