'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { Store } = require('./lib/store');
const C = require('./lib/contracts');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const BASE_URL = (process.env.BASE_URL || '').replace(/\/+$/, '');
const TRUST_PROXY = process.env.TRUST_PROXY === '1';
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_BODY = 1024 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

const SECURITY_HEADERS = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'self'",
  ].join('; '),
  // الروابط تحتوي على مفاتيح سرية، فلا نرسلها لأي موقع آخر.
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

// ---------- أدوات ----------

function clientIp(req) {
  if (TRUST_PROXY) {
    const xf = req.headers['x-forwarded-for'];
    if (xf) return String(xf).split(',')[0].trim();
  }
  return req.socket.remoteAddress || null;
}

function ctxOf(req) {
  return { ip: clientIp(req), ua: String(req.headers['user-agent'] || '').slice(0, 300) };
}

function baseUrl(req) {
  if (BASE_URL) return BASE_URL;
  const proto = TRUST_PROXY && req.headers['x-forwarded-proto'] ? String(req.headers['x-forwarded-proto']).split(',')[0] : 'http';
  return `${proto}://${req.headers.host || `localhost:${PORT}`}`;
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...SECURITY_HEADERS, ...headers });
  res.end(body);
}

function json(res, status, data, headers = {}) {
  send(res, status, JSON.stringify(data), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new C.AppError(413, 'TOO_LARGE', 'حجم الطلب كبير جداً'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch {
        reject(new C.AppError(400, 'BAD_JSON', 'صيغة البيانات غير صالحة'));
      }
    });
    req.on('error', reject);
  });
}

// حد بسيط لعدد الطلبات في الذاكرة.
const buckets = new Map();
function rateLimit(key, limit, windowMs) {
  const t = Date.now();
  let b = buckets.get(key);
  if (!b || b.reset < t) b = { count: 0, reset: t + windowMs };
  b.count++;
  buckets.set(key, b);
  if (b.count > limit) throw new C.AppError(429, 'RATE_LIMIT', 'طلبات كثيرة، يرجى المحاولة بعد قليل.');
}
setInterval(() => {
  const t = Date.now();
  for (const [k, b] of buckets) if (b.reset < t) buckets.delete(k);
}, 60000).unref();

// ---------- الواجهة البرمجية ----------

function links(req, c) {
  const base = baseUrl(req);
  return {
    adminUrl: `${base}/admin/${c.adminToken}`,
    parties: c.parties.map((p) => ({ id: p.id, name: p.name, role: p.role, idNumber: p.idNumber, email: p.email, phone: p.phone, signUrl: `${base}/sign/${p.token}` })),
  };
}

function session(req, token) {
  const s = store.resolve(token);
  if (!s) throw new C.AppError(404, 'NOT_FOUND', 'الرابط غير صحيح أو منتهي.');
  return s;
}

function sessionPayload(req, contract, who) {
  const v = C.view(contract, who);
  if (who.type === 'owner') {
    const l = links(req, contract);
    v.adminUrl = l.adminUrl;
    for (const p of v.parties) {
      p.signUrl = l.parties.find((x) => x.id === p.id).signUrl;
      delete p.token;
    }
  }
  v.verifyUrl = `${baseUrl(req)}/verify/${contract.id}`;
  return v;
}

async function api(req, res, parts) {
  const ctx = ctxOf(req);
  const method = req.method;

  if (parts[0] === 'contracts' && parts.length === 1 && method === 'POST') {
    rateLimit(`create:${ctx.ip}`, 30, 3600000);
    const body = await readJson(req);
    const c = C.createContract(body, ctx);
    await store.create(c);
    return json(res, 201, { id: c.id, ...links(req, c) });
  }

  if (parts[0] === 'verify' && parts.length === 2 && method === 'GET') {
    rateLimit(`verify:${ctx.ip}`, 120, 60000);
    const c = store.get(parts[1]);
    if (!c) throw new C.AppError(404, 'NOT_FOUND', 'لا يوجد عقد بهذا المعرّف.');
    return json(res, 200, C.publicSummary(c));
  }

  if (parts[0] === 'session' && parts[1]) {
    const s = session(req, parts[1]);
    const who = s.type === 'owner' ? { type: 'owner' } : { type: 'party', partyId: s.partyId };
    const action = parts[2] || '';

    if (method === 'GET' && action === '') {
      let contract = s.contract;
      if (who.type === 'party' && C.status(contract) !== C.STATUS.COMPLETED) {
        const v = C.currentVersion(contract);
        const p = contract.parties.find((x) => x.id === who.partyId);
        if (!p.viewedVersions.includes(v.n)) {
          ({ contract } = await store.update(contract.id, (d) => C.markViewed(d, who.partyId, ctx)));
        }
      }
      return json(res, 200, sessionPayload(req, contract, who));
    }

    if (method === 'GET' && action === 'export') {
      const c = s.contract;
      const data = {
        format: 'aqd-evidence/1',
        exportedAt: new Date().toISOString(),
        summary: C.publicSummary(c),
        contract: C.view(c, { type: 'export' }),
      };
      delete data.contract.me;
      delete data.contract.role;
      return send(res, 200, JSON.stringify(data, null, 2), {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="aqd-${c.id}-evidence.json"`,
        'Cache-Control': 'no-store',
      });
    }

    if (method === 'POST') {
      rateLimit(`post:${parts[1]}`, 30, 60000);
      const body = await readJson(req);
      const ops = {
        sign: () => { if (who.type !== 'party') throw new C.AppError(403, 'FORBIDDEN', 'التوقيع متاح للأطراف فقط.'); return (d) => C.sign(d, who.partyId, body, ctx); },
        'request-changes': () => { if (who.type !== 'party') throw new C.AppError(403, 'FORBIDDEN', 'طلب التعديل متاح للأطراف فقط.'); return (d) => C.requestChanges(d, who.partyId, body, ctx); },
        amend: () => (d) => C.amend(d, who, body, ctx),
        void: () => { if (who.type !== 'owner') throw new C.AppError(403, 'FORBIDDEN', 'الإلغاء متاح لمنشئ العقد فقط.'); return (d) => C.voidContract(d, body, ctx); },
      };
      if (!Object.hasOwn(ops, action)) throw new C.AppError(404, 'NOT_FOUND', 'عملية غير معروفة');
      const fn = ops[action]();
      const { contract } = await store.update(s.contract.id, fn);
      return json(res, 200, sessionPayload(req, contract, who));
    }
  }

  throw new C.AppError(404, 'NOT_FOUND', 'غير موجود');
}

// ---------- الملفات الثابتة ----------

const SPA_ROUTES = /^\/(|new|admin\/[\w-]+|sign\/[\w-]+|certificate\/[\w-]+|verify(\/[\w-]+)?)$/;

function serveStatic(req, res, pathname) {
  let file;
  if (SPA_ROUTES.test(pathname)) file = path.join(PUBLIC_DIR, 'index.html');
  else {
    file = path.normalize(path.join(PUBLIC_DIR, decodeURIComponent(pathname)));
    if (!file.startsWith(PUBLIC_DIR + path.sep)) return send(res, 403, 'Forbidden');
  }
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
    const ext = path.extname(file);
    send(res, 200, data, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=300',
    });
  });
}

// ---------- الخادم ----------

let store;

function createServer(opts = {}) {
  store = new Store(opts.dataDir || DATA_DIR);
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const pathname = url.pathname;
    try {
      if (pathname === '/healthz') return json(res, 200, { ok: true });
      if (pathname.startsWith('/api/')) return await api(req, res, pathname.slice(5).split('/').filter(Boolean));
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
      return serveStatic(req, res, pathname);
    } catch (err) {
      if (err instanceof C.AppError) return json(res, err.status, { error: err.code, message: err.message });
      console.error(err);
      return json(res, 500, { error: 'INTERNAL', message: 'حدث خطأ غير متوقع.' });
    }
  });
}

if (require.main === module) {
  createServer().listen(PORT, HOST, () => {
    console.log(`عَقد يعمل على http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}  (البيانات: ${path.resolve(DATA_DIR)})`);
  });
}

module.exports = { createServer };
