'use strict';
// Requirements submission portal — Node server with no external dependencies.

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { createCore, AppError, windowState, timeliness, SECURITY_HEADERS } = require('./lib/core');
const { FileStore } = require('./lib/file-store');

const PORT = Number(process.env.PORT) || 3100;
const PUBLIC_DIR = path.join(__dirname, 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new AppError(413, 'File is larger than allowed')); req.destroy(); }
      else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...SECURITY_HEADERS, ...headers });
  res.end(body);
}

function serveStatic(res, pathname) {
  const rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return send(res, 403, 'Forbidden');
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, 'Not found');
    send(res, 200, data, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  });
}

function createApp(opts = {}) {
  const store = new FileStore(opts.dataDir || process.env.DATA_DIR || path.join(__dirname, 'data'));
  const handle = createCore({
    store,
    adminEmail: opts.adminEmail || process.env.ADMIN_EMAIL,
    adminPassword: opts.adminPassword || process.env.ADMIN_PASSWORD,
    yearStart: Number(process.env.YEAR_START) || 2026,
  });
  return http.createServer(async (req, res) => {
    const { pathname } = new URL(req.url, 'http://x');
    if (!pathname.startsWith('/api/')) return serveStatic(res, pathname);
    const r = await handle({
      method: req.method, pathname,
      secure: req.headers['x-forwarded-proto'] === 'https',
      header: (n) => req.headers[n.toLowerCase()],
      body: (limit) => readBody(req, limit),
    });
    send(res, r.status, r.body, r.headers);
  });
}

module.exports = { createApp, windowState, timeliness };

if (require.main === module) {
  createApp().listen(PORT, () => console.log(`Portal running at http://localhost:${PORT}`));
}
