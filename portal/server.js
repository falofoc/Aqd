'use strict';
// Requirements submission portal — server with no external dependencies.

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { seedRequirements, LEVEL_INFO } = require('./lib/catalog');

const PORT = Number(process.env.PORT) || 3100;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');
const YEAR_START = Number(process.env.YEAR_START) || 2026;
const MAX_JSON = 256 * 1024;
const LEVELS = ['R1', 'R2', 'R3', 'R4'];
const RATINGS = { excellent: 1, adequate: 0.7, weak: 0.4, absent: 0 };

class AppError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// ---------- Storage (JSON file with atomic writes) ----------

class DB {
  constructor(dir) {
    this.dir = dir;
    this.file = path.join(dir, 'db.json');
    this.uploads = path.join(dir, 'uploads');
    fs.mkdirSync(this.uploads, { recursive: true });
    if (fs.existsSync(this.file)) this.d = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    else this.d = { users: [], requirements: seedRequirements(YEAR_START), submissions: [], sessions: {} };
    this.save();
  }
  save() {
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.d));
    fs.renameSync(tmp, this.file);
  }
}

// ---------- Helpers ----------

const id = (n = 12) => crypto.randomBytes(n).toString('hex');
const now = () => new Date();

function hashPw(pw, salt = id(16)) {
  return salt + ':' + crypto.scryptSync(pw, salt, 32).toString('hex');
}
function checkPw(pw, stored) {
  const [salt, h] = stored.split(':');
  const a = Buffer.from(h, 'hex');
  const b = crypto.scryptSync(pw, salt, 32);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function publicUser(u) {
  const { password, ...rest } = u;
  return rest;
}

// Submission window state of a requirement at a given moment.
function windowState(r, t = now()) {
  if (!r.openAt || !r.closeAt) return 'unscheduled';
  const open = new Date(r.openAt), close = new Date(r.closeAt);
  const lateEnd = new Date(close.getTime() + (r.lateDays || 0) * 86400000);
  if (t < open) return 'upcoming';
  if (t <= close) return 'open';
  if (t <= lateEnd) return 'late';
  return 'closed';
}

// Timeliness score (out of 10): on time 10, 1–7 days late 5, more 0.
function timeliness(r, submittedAt) {
  const late = (new Date(submittedAt) - new Date(r.closeAt)) / 86400000;
  if (late <= 0) return 10;
  if (late <= 7) return 5;
  return 0;
}

function band(s) {
  return s >= 90 ? 'Exceeds expectation' : s >= 70 ? 'Meets expectation' : s >= 50 ? 'Borderline' : 'Does not meet expectation';
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
    'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; frame-ancestors 'none'",
    ...headers,
  });
  res.end(body);
}
const json = (res, status, data, headers) =>
  send(res, status, JSON.stringify(data), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });

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
async function readJson(req) {
  const b = await readBody(req, MAX_JSON);
  try { return b.length ? JSON.parse(b.toString('utf8')) : {}; }
  catch { throw new AppError(400, 'Invalid data'); }
}

function parseCookies(req) {
  const out = {};
  for (const p of String(req.headers.cookie || '').split(';')) {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  }
  return out;
}

const str = (v, max = 200) => String(v ?? '').trim().slice(0, max);

// ---------- API ----------

function createApp(opts = {}) {
  const db = new DB(opts.dataDir || DATA_DIR);
  const adminEmail = (opts.adminEmail || process.env.ADMIN_EMAIL || 'admin@example.com').toLowerCase();
  const adminPw = opts.adminPassword || process.env.ADMIN_PASSWORD;

  // Create the admin account on first run.
  if (!db.d.users.some((u) => u.role === 'admin')) {
    const pw = adminPw || id(6);
    db.d.users.push({ id: id(), role: 'admin', name: 'Administrator', email: adminEmail, password: hashPw(pw), status: 'active', createdAt: now().toISOString() });
    db.save();
    if (!adminPw) console.log(`Admin account: ${adminEmail} / password: ${pw}  (set ADMIN_PASSWORD to choose one)`);
  }

  function auth(req, role) {
    const tok = parseCookies(req).sid;
    const s = tok && db.d.sessions[tok];
    const u = s && db.d.users.find((x) => x.id === s.uid);
    if (!u) throw new AppError(401, 'Please sign in');
    if (u.status !== 'active') throw new AppError(403, 'Your account is awaiting activation by the administration');
    if (role && u.role !== role) throw new AppError(403, 'Not allowed');
    return u;
  }
  const getReq = (rid) => {
    const r = db.d.requirements.find((x) => x.id === rid);
    if (!r) throw new AppError(404, 'Requirement not found');
    return r;
  };
  const withState = (r) => ({ ...r, state: windowState(r) });

  async function api(req, res, p) {
    const m = req.method;

    // Registration
    if (p[0] === 'register' && m === 'POST') {
      const b = await readJson(req);
      const email = str(b.email, 120).toLowerCase();
      const u = {
        id: id(), role: 'trainee', status: 'pending', createdAt: now().toISOString(),
        name: str(b.name, 120), email, phone: str(b.phone, 30), scfhs: str(b.scfhs, 30),
        level: LEVELS.includes(b.level) ? b.level : 'R1', center: str(b.center, 120),
      };
      if (!u.name || !/^\S+@\S+\.\S+$/.test(email)) throw new AppError(400, 'Name and email are required');
      if (String(b.password || '').length < 8) throw new AppError(400, 'Password must be at least 8 characters');
      if (db.d.users.some((x) => x.email === email)) throw new AppError(409, 'This email is already registered');
      u.password = hashPw(String(b.password));
      db.d.users.push(u);
      db.save();
      return json(res, 201, { ok: true, message: 'Registration received. Your account will be activated after the administration reviews it.' });
    }

    if (p[0] === 'login' && m === 'POST') {
      const b = await readJson(req);
      const u = db.d.users.find((x) => x.email === str(b.email, 120).toLowerCase());
      if (!u || !checkPw(String(b.password || ''), u.password)) throw new AppError(401, 'Incorrect email or password');
      if (u.status === 'pending') throw new AppError(403, 'Your account is awaiting activation by the administration');
      if (u.status === 'disabled') throw new AppError(403, 'This account is disabled; contact the administration');
      const tok = id(24);
      db.d.sessions[tok] = { uid: u.id, at: Date.now() };
      db.save();
      return json(res, 200, publicUser(u), { 'Set-Cookie': `sid=${tok}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000` });
    }

    if (p[0] === 'logout' && m === 'POST') {
      delete db.d.sessions[parseCookies(req).sid];
      db.save();
      return json(res, 200, { ok: true }, { 'Set-Cookie': 'sid=; Path=/; Max-Age=0' });
    }

    if (p[0] === 'me' && m === 'GET') return json(res, 200, { user: publicUser(auth(req)), levels: LEVEL_INFO });

    // Trainee requirements with their submission status
    if (p[0] === 'requirements' && !p[1] && m === 'GET') {
      const u = auth(req);
      const list = db.d.requirements.filter((r) => u.role === 'admin' || (r.published && r.level === u.level));
      return json(res, 200, list.map((r) => {
        const s = db.d.submissions.find((x) => x.reqId === r.id && x.userId === u.id);
        const count = u.role === 'admin' ? db.d.submissions.filter((x) => x.reqId === r.id).length : undefined;
        return { ...withState(r), submission: s || null, count };
      }));
    }

    // Upload: the request body is the file itself; the file name is in a header
    if (p[0] === 'requirements' && p[2] === 'submit' && m === 'POST') {
      const u = auth(req, 'trainee');
      const r = getReq(p[1]);
      if (!r.published || r.level !== u.level) throw new AppError(403, 'This requirement is not for your level');
      const st = windowState(r);
      if (st === 'upcoming' || st === 'unscheduled') throw new AppError(403, 'The submission window has not opened yet');
      if (st === 'closed') throw new AppError(403, 'The submission window is closed');
      const name = path.basename(decodeURIComponent(String(req.headers['x-file-name'] || 'file')));
      const ext = path.extname(name).slice(1).toLowerCase();
      if (!r.fileTypes.includes(ext)) throw new AppError(415, `File type not accepted. Allowed: ${r.fileTypes.join(', ')}`);
      const buf = await readBody(req, (r.maxMB || 25) * 1048576);
      if (!buf.length) throw new AppError(400, 'The file is empty');
      let s = db.d.submissions.find((x) => x.reqId === r.id && x.userId === u.id);
      if (s?.grade) throw new AppError(409, 'This submission is graded and cannot be replaced');
      const fileId = id() + '.' + ext;
      fs.writeFileSync(path.join(db.uploads, fileId), buf);
      if (s) { fs.rmSync(path.join(db.uploads, s.fileId), { force: true }); s.history = [...(s.history || []), { at: s.submittedAt, name: s.fileName }]; }
      else { s = { id: id(), reqId: r.id, userId: u.id }; db.d.submissions.push(s); }
      Object.assign(s, { fileId, fileName: name, size: buf.length, submittedAt: now().toISOString(), late: st === 'late', note: str(req.headers['x-note'] && decodeURIComponent(req.headers['x-note']), 500) });
      db.save();
      return json(res, 200, s);
    }

    // File download (submission owner or admin)
    if (p[0] === 'submissions' && p[2] === 'file' && m === 'GET') {
      const u = auth(req);
      const s = db.d.submissions.find((x) => x.id === p[1]);
      if (!s || (u.role !== 'admin' && s.userId !== u.id)) throw new AppError(404, 'Not found');
      const f = path.join(db.uploads, s.fileId);
      return send(res, 200, fs.readFileSync(f), {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(s.fileName)}`,
      });
    }

    // ---------- Admin ----------
    if (p[0] === 'admin') {
      const admin = auth(req, 'admin');

      if (p[1] === 'users' && !p[2] && m === 'GET') return json(res, 200, db.d.users.filter((u) => u.role !== 'admin').map(publicUser));
      if (p[1] === 'users' && p[2] && m === 'POST') {
        const u = db.d.users.find((x) => x.id === p[2] && x.role !== 'admin');
        if (!u) throw new AppError(404, 'User not found');
        const b = await readJson(req);
        if (['active', 'disabled', 'pending'].includes(b.status)) {
          u.status = b.status;
          if (b.status === 'active') { u.activatedAt = now().toISOString(); u.activatedBy = admin.email; }
          if (b.status !== 'active') for (const [k, s] of Object.entries(db.d.sessions)) if (s.uid === u.id) delete db.d.sessions[k];
        }
        if (LEVELS.includes(b.level)) u.level = b.level;
        db.save();
        return json(res, 200, publicUser(u));
      }

      if (p[1] === 'requirements' && m === 'POST') {
        const b = await readJson(req);
        const r = p[2] ? getReq(p[2]) : { id: 'c-' + id(4), type: 'custom', proposed: false };
        Object.assign(r, {
          title: str(b.title ?? r.title, 200), level: LEVELS.includes(b.level) ? b.level : r.level || 'R1',
          window: str(b.window ?? r.window, 40), description: str(b.description ?? r.description, 3000),
          instructions: Array.isArray(b.instructions) ? b.instructions.map((x) => str(x, 1000)).filter(Boolean) : r.instructions || [],
          rubric: Array.isArray(b.rubric) ? b.rubric.map((c) => ({ name: str(c.name, 300), max: Number(c.max) || 0 })).filter((c) => c.name) : r.rubric || [],
          resources: Array.isArray(b.resources) ? b.resources.filter((x) => /^https?:\/\//.test(x.url)).map((x) => ({ title: str(x.title, 200), url: str(x.url, 500) })) : r.resources || [],
          fileTypes: Array.isArray(b.fileTypes) ? b.fileTypes.map((x) => str(x, 10).toLowerCase().replace('.', '')).filter(Boolean) : r.fileTypes || ['pdf'],
          howToSubmit: str(b.howToSubmit ?? r.howToSubmit, 1000), maxMB: Math.min(100, Number(b.maxMB ?? r.maxMB) || 25),
          openAt: b.openAt !== undefined ? (b.openAt ? new Date(b.openAt).toISOString() : null) : r.openAt,
          closeAt: b.closeAt !== undefined ? (b.closeAt ? new Date(b.closeAt).toISOString() : null) : r.closeAt,
          lateDays: Math.max(0, Number(b.lateDays ?? r.lateDays ?? 14)), published: b.published !== undefined ? !!b.published : !!r.published,
        });
        const total = r.rubric.reduce((a, c) => a + c.max, 0);
        if (total !== 90) throw new AppError(400, `Content criteria must total 90 (currently ${total}); timeliness adds the other 10`);
        if (r.openAt && r.closeAt && new Date(r.openAt) >= new Date(r.closeAt)) throw new AppError(400, 'Close time must be after open time');
        r.fileLabel = r.fileTypes.join(' / ').toUpperCase();
        if (!p[2]) db.d.requirements.push(r);
        db.save();
        return json(res, 200, withState(r));
      }
      if (p[1] === 'requirements' && p[2] && m === 'DELETE') {
        if (db.d.submissions.some((s) => s.reqId === p[2])) throw new AppError(409, 'It has submissions; unpublish it instead of deleting');
        db.d.requirements = db.d.requirements.filter((r) => r.id !== p[2]);
        db.save();
        return json(res, 200, { ok: true });
      }

      if (p[1] === 'submissions' && m === 'GET') {
        const users = Object.fromEntries(db.d.users.map((u) => [u.id, u]));
        const list = db.d.submissions.filter((s) => !p[2] || s.reqId === p[2]);
        return json(res, 200, list.map((s) => ({ ...s, user: { name: users[s.userId]?.name, email: users[s.userId]?.email, level: users[s.userId]?.level } })));
      }

      // Grading: a rating per criterion + 10 timeliness points computed automatically
      if (p[1] === 'grade' && p[2] && m === 'POST') {
        const s = db.d.submissions.find((x) => x.id === p[2]);
        if (!s) throw new AppError(404, 'Submission not found');
        const r = getReq(s.reqId);
        const b = await readJson(req);
        const ratings = Array.isArray(b.ratings) ? b.ratings : [];
        if (ratings.length !== r.rubric.length || ratings.some((x) => !(x in RATINGS))) throw new AppError(400, 'Every criterion must be rated');
        const items = r.rubric.map((c, i) => ({ name: c.name, max: c.max, rating: ratings[i], score: Math.round(c.max * RATINGS[ratings[i]] * 10) / 10 }));
        const t = timeliness(r, s.submittedAt);
        const total = Math.round((items.reduce((a, x) => a + x.score, 0) + t) * 10) / 10;
        s.grade = { items, timeliness: t, total, band: band(total), feedback: str(b.feedback, 3000), by: admin.email, at: now().toISOString() };
        db.save();
        return json(res, 200, s);
      }
      if (p[1] === 'grade' && p[2] && m === 'DELETE') {
        const s = db.d.submissions.find((x) => x.id === p[2]);
        if (s) { delete s.grade; db.save(); }
        return json(res, 200, { ok: true });
      }
    }

    throw new AppError(404, 'Not found');
  }

  function serveStatic(req, res, pathname) {
    const rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
    const file = path.normalize(path.join(PUBLIC_DIR, rel));
    if (!file.startsWith(PUBLIC_DIR + path.sep)) return send(res, 403, 'Forbidden');
    fs.readFile(file, (err, data) => {
      if (err) return send(res, 404, 'Not found');
      const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };
      send(res, 200, data, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    });
  }

  const server = http.createServer(async (req, res) => {
    const { pathname } = new URL(req.url, 'http://x');
    try {
      if (pathname.startsWith('/api/')) {
        // Basic CSRF guard: state-changing requests must come from the app itself
        if (req.method !== 'GET' && req.headers['x-requested-with'] !== 'portal') throw new AppError(403, 'Request not allowed');
        return await api(req, res, pathname.slice(5).split('/').filter(Boolean));
      }
      return serveStatic(req, res, pathname);
    } catch (e) {
      if (e instanceof AppError) return json(res, e.status, { message: e.message });
      console.error(e);
      return json(res, 500, { message: 'Unexpected error' });
    }
  });
  server.db = db;
  return server;
}

module.exports = { createApp, windowState, timeliness };

if (require.main === module) {
  createApp().listen(PORT, () => console.log(`Portal running at http://localhost:${PORT}`));
}
