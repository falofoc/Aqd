'use strict';
// Platform-independent portal logic, shared by the Node server and the Cloudflare Worker.
//
// It talks to storage only through this async interface:
//   all(col) · get(col, id) · find(col, field, value) · put(col, doc) · putMany(col, docs) · del(col, id)
//   putFile(key, bytes) · getFile(key) · delFile(key)
// Collections: users, requirements, submissions, sessions (the session id is its token), settings.

const crypto = require('node:crypto');
const { seedRequirements, windowFor, originalLabels, OFFICIAL_TITLES, YEAR_LONG_TYPES, YEAR_LONG_WINDOW, YEAR_LONG_STEP, LEVEL_INFO } = require('./catalog');

const MAX_JSON = 256 * 1024;
const LEVELS = ['R1', 'R2', 'R3', 'R4'];
const RATINGS = { excellent: 1, adequate: 0.7, weak: 0.4, absent: 0 };
const SESSION_DAYS = 30;
const RESUBMIT_DAYS = 14; // after a rejection, a new file is accepted for this many days even if the window closed
const SESSION_NOTE = 'This refers to the one you will present, or have presented, during the current training year.';

// "2 Seminars", "3 CBD": one upload slot per item, each graded separately.
function slotsOf(r) {
  if (r.slots) return r.slots;
  const n = Number((/^(\d+)\s/.exec(r.title || '') || [])[1]);
  return n >= 2 && n <= 5 ? n : 1;
}

// Levels closed for new registrations until the admin reopens them.
const DEFAULT_CLOSED_LEVELS = ['R4'];

class AppError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const id = (n = 12) => crypto.randomBytes(n).toString('hex');
const now = () => new Date();
const str = (v, max = 200) => String(v ?? '').trim().slice(0, max);

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

function parseCookies(header) {
  const out = {};
  for (const p of String(header || '').split(';')) {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  }
  return out;
}

const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

const json = (status, data, headers = {}) => ({
  status, body: JSON.stringify(data),
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
});

// opts: { store, adminEmail, adminPassword, yearStart, maxUploadMB, log }
function createCore(opts) {
  const db = opts.store;
  const maxUploadMB = opts.maxUploadMB || 100;
  let ready = null;

  // Seed the requirements and create the admin account on first use.
  async function init() {
    const yearStart = opts.yearStart || 2026;
    if (!(await db.all('requirements')).length) await db.putMany('requirements', seedRequirements(yearStart));
    await migrate(yearStart);
    const admin = (await db.all('users')).find((u) => u.role === 'admin');
    // Changing ADMIN_PASSWORD resets the admin password on the next start.
    if (admin && opts.adminPassword && !checkPw(opts.adminPassword, admin.password)) {
      admin.password = hashPw(opts.adminPassword);
      await db.put('users', admin);
    }
    if (!admin) {
      const email = str(opts.adminEmail || 'admin@example.com', 120).toLowerCase();
      const pw = opts.adminPassword || id(6);
      await db.put('users', { id: id(), role: 'admin', name: 'Administrator', email, password: hashPw(pw), status: 'active', createdAt: now().toISOString() });
      if (!opts.adminPassword) (opts.log || console.log)(`Admin account: ${email} / password: ${pw}  (set ADMIN_PASSWORD to choose one)`);
    }
  }

  // One-time data updates for databases seeded by an earlier version.
  async function migrate(yearStart) {
    const m = (await db.get('settings', 'migrations')) || { id: 'migrations', done: [] };
    if (!m.done.includes('year-long-sessions')) {
      // CAP, CAT, seminars and clinical tools are presented in turn on Thursdays: open them all year.
      // Requirements whose dates the admin already changed are left alone.
      const labels = originalLabels();
      const yl = windowFor(YEAR_LONG_WINDOW, yearStart);
      const moved = [];
      for (const r of await db.all('requirements')) {
        const old = labels[r.id] && windowFor(labels[r.id], yearStart);
        if (!YEAR_LONG_TYPES.includes(r.type) || !old || r.openAt !== old.openAt || r.closeAt !== old.closeAt) continue;
        Object.assign(r, { window: YEAR_LONG_WINDOW, openAt: yl.openAt, closeAt: yl.closeAt });
        if (!r.instructions.includes(YEAR_LONG_STEP)) r.instructions = [...r.instructions, YEAR_LONG_STEP];
        moved.push(r);
      }
      if (moved.length) await db.putMany('requirements', moved);
      m.done.push('year-long-sessions');
      await db.put('settings', m);
    }
    if (!m.done.includes('session-note')) {
      const add = (await db.all('requirements')).filter((r) => ['cap', 'seminar'].includes(r.type) && !r.note).map((r) => Object.assign(r, { note: SESSION_NOTE }));
      if (add.length) await db.putMany('requirements', add);
      m.done.push('session-note');
      await db.put('settings', m);
    }
    if (!m.done.includes('official-list')) {
      // Keep only the program's official list, with its exact titles. Dates are not touched.
      // A seeded requirement outside the list is deleted, or unpublished if someone already submitted to it.
      const subs = await db.all('submissions');
      const keep = [];
      for (const r of await db.all('requirements')) {
        if (!/^r\d-\d{3}$/.test(r.id)) continue; // added by the admin
        if (OFFICIAL_TITLES[r.id]) keep.push(Object.assign(r, { title: OFFICIAL_TITLES[r.id], proposed: false }));
        else if (subs.some((s) => s.reqId === r.id)) keep.push(Object.assign(r, { published: false }));
        else await db.del('requirements', r.id);
      }
      if (keep.length) await db.putMany('requirements', keep);
      m.done.push('official-list');
      await db.put('settings', m);
    }
  }

  async function auth(req, role) {
    const tok = parseCookies(req.header('cookie')).sid;
    const s = tok && (await db.get('sessions', tok));
    if (s && Date.now() - s.at > SESSION_DAYS * 86400000) { await db.del('sessions', tok); throw new AppError(401, 'Please sign in'); }
    const u = s && (await db.get('users', s.uid));
    if (!u) throw new AppError(401, 'Please sign in');
    if (u.status !== 'active') throw new AppError(403, 'Your account is awaiting activation by the administration');
    if (role && u.role !== role) throw new AppError(403, 'Not allowed');
    return u;
  }
  async function getReq(rid) {
    const r = await db.get('requirements', rid);
    if (!r) throw new AppError(404, 'Requirement not found');
    return r;
  }
  const withState = (r) => ({ ...r, state: windowState(r) });
  const closedLevels = async () => (await db.get('settings', 'registration'))?.closedLevels ?? DEFAULT_CLOSED_LEVELS;
  async function readJson(req) {
    const b = await req.body(MAX_JSON);
    try { return b.length ? JSON.parse(Buffer.from(b).toString('utf8')) : {}; }
    catch { throw new AppError(400, 'Invalid data'); }
  }

  async function api(req, p) {
    const m = req.method;

    if (p[0] === 'register' && m === 'POST') {
      const b = await readJson(req);
      const email = str(b.email, 120).toLowerCase();
      const u = {
        id: id(), role: 'trainee', status: 'pending', createdAt: now().toISOString(),
        name: str(b.name, 120), email, phone: str(b.phone, 30), scfhs: str(b.scfhs, 30),
        level: LEVELS.includes(b.level) ? b.level : 'R1',
      };
      if (!u.name || !/^\S+@\S+\.\S+$/.test(email)) throw new AppError(400, 'Name and email are required');
      if ((await closedLevels()).includes(u.level)) throw new AppError(403, `Registration for ${u.level} is closed for now`);
      if (String(b.password || '').length < 8) throw new AppError(400, 'Password must be at least 8 characters');
      if ((await db.find('users', 'email', email)).length) throw new AppError(409, 'This email is already registered');
      u.password = hashPw(String(b.password));
      await db.put('users', u);
      return json(201, { ok: true, message: 'Registration received. Your account will be activated after the administration reviews it.' });
    }

    if (p[0] === 'login' && m === 'POST') {
      const b = await readJson(req);
      const [u] = await db.find('users', 'email', str(b.email, 120).toLowerCase());
      if (!u || !checkPw(String(b.password || ''), u.password)) throw new AppError(401, 'Incorrect email or password');
      if (u.status === 'pending') throw new AppError(403, 'Your account is awaiting activation by the administration');
      if (u.status === 'disabled') throw new AppError(403, 'This account is disabled; contact the administration');
      const tok = id(24);
      await db.put('sessions', { id: tok, uid: u.id, at: Date.now() });
      const secure = req.secure ? ' Secure;' : '';
      return json(200, publicUser(u), { 'Set-Cookie': `sid=${tok}; HttpOnly;${secure} SameSite=Lax; Path=/; Max-Age=${SESSION_DAYS * 86400}` });
    }

    if (p[0] === 'logout' && m === 'POST') {
      const tok = parseCookies(req.header('cookie')).sid;
      if (tok) await db.del('sessions', tok);
      return json(200, { ok: true }, { 'Set-Cookie': 'sid=; Path=/; Max-Age=0' });
    }

    // Public catalog: every published requirement, readable before registering
    if (p[0] === 'catalog' && m === 'GET') {
      const reqs = (await db.all('requirements')).filter((r) => r.published).sort(byId);
      return json(200, { levels: LEVEL_INFO, requirements: reqs.map((r) => ({ ...withState(r), slots: slotsOf(r) })) });
    }

    if (p[0] === 'registration' && m === 'GET') return json(200, { closedLevels: await closedLevels() });

    if (p[0] === 'me' && m === 'GET') return json(200, { user: publicUser(await auth(req)), levels: LEVEL_INFO });

    // Requirements with the caller's submission status (admins see all, with submission counts)
    if (p[0] === 'requirements' && !p[1] && m === 'GET') {
      const u = await auth(req);
      const reqs = (await db.all('requirements')).filter((r) => u.role === 'admin' || (r.published && r.level === u.level)).sort(byId);
      const subs = u.role === 'admin' ? await db.all('submissions') : await db.find('submissions', 'userId', u.id);
      return json(200, reqs.map((r) => ({
        ...withState(r),
        slots: slotsOf(r),
        submissions: subs.filter((x) => x.reqId === r.id && x.userId === u.id).sort((a, b) => (a.slot || 1) - (b.slot || 1)),
        count: u.role === 'admin' ? subs.filter((x) => x.reqId === r.id).length : undefined,
      })));
    }

    // Upload: the request body is the file itself; the file name is in a header
    if (p[0] === 'requirements' && p[2] === 'submit' && m === 'POST') {
      const u = await auth(req, 'trainee');
      const r = await getReq(p[1]);
      if (!r.published || r.level !== u.level) throw new AppError(403, 'This requirement is not for your level');
      const st = windowState(r);
      const name = decodeURIComponent(String(req.header('x-file-name') || 'file')).split(/[\\/]/).pop().slice(0, 200) || 'file';
      const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
      if (!r.fileTypes.includes(ext)) throw new AppError(415, `File type not accepted. Allowed: ${r.fileTypes.join(', ')}`);
      const buf = await req.body(Math.min(r.maxMB || 25, maxUploadMB) * 1048576);
      if (!buf.length) throw new AppError(400, 'The file is empty');
      const slots = slotsOf(r);
      const slot = Number(req.header('x-slot') || 1);
      if (!Number.isInteger(slot) || slot < 1 || slot > slots) throw new AppError(400, 'Invalid item number');
      let s = (await db.find('submissions', 'userId', u.id)).find((x) => x.reqId === r.id && (x.slot || 1) === slot);
      if (s?.grade) throw new AppError(409, 'This submission is graded and cannot be replaced');
      const resubmit = s?.rejected && Date.now() - new Date(s.rejectedAt) < RESUBMIT_DAYS * 86400000;
      // VIP trainees may upload at any time; everyone else only inside the window (or after a rejection).
      if (!resubmit && !u.vip) {
        if (st === 'upcoming' || st === 'unscheduled') throw new AppError(403, 'The submission window has not opened yet');
        if (st === 'closed') throw new AppError(403, 'The submission window is closed');
      }
      const fileId = id() + '.' + ext;
      await db.putFile(fileId, buf);
      if (s) {
        if (s.fileId) await db.delFile(s.fileId);
        if (s.fileName) s.history = [...(s.history || []), { at: s.submittedAt, name: s.fileName }];
      } else s = { id: id(), reqId: r.id, userId: u.id };
      const note = req.header('x-note');
      Object.assign(s, { slot, fileId, fileName: name, size: buf.length, submittedAt: now().toISOString(), late: new Date() > new Date(r.closeAt), note: str(note && decodeURIComponent(note), 500), rejected: false });
      await db.put('submissions', s);
      return json(200, s);
    }

    // File download (submission owner or admin)
    if (p[0] === 'submissions' && p[2] === 'file' && m === 'GET') {
      const u = await auth(req);
      const s = await db.get('submissions', p[1]);
      if (!s || !s.fileId || (u.role !== 'admin' && s.userId !== u.id)) throw new AppError(404, 'Not found');
      const data = await db.getFile(s.fileId);
      if (!data) throw new AppError(404, 'File not found');
      return {
        status: 200, body: data,
        headers: { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(s.fileName)}`, 'Cache-Control': 'no-store' },
      };
    }

    // ---------- Admin ----------
    if (p[0] === 'admin') {
      const admin = await auth(req, 'admin');

      if (p[1] === 'registration' && m === 'POST') {
        const b = await readJson(req);
        const closed = LEVELS.filter((l) => Array.isArray(b.closedLevels) && b.closedLevels.includes(l));
        await db.put('settings', { id: 'registration', closedLevels: closed });
        return json(200, { closedLevels: closed });
      }

      if (p[1] === 'users' && !p[2] && m === 'GET') return json(200, (await db.all('users')).filter((u) => u.role !== 'admin').map(publicUser));
      if (p[1] === 'users' && p[2] && m === 'POST') {
        const u = await db.get('users', p[2]);
        if (!u || u.role === 'admin') throw new AppError(404, 'User not found');
        const b = await readJson(req);
        if (['active', 'disabled', 'pending'].includes(b.status)) {
          u.status = b.status;
          if (b.status === 'active') { u.activatedAt = now().toISOString(); u.activatedBy = admin.email; }
          else for (const s of await db.find('sessions', 'uid', u.id)) await db.del('sessions', s.id);
        }
        if (LEVELS.includes(b.level)) u.level = b.level;
        if (typeof b.vip === 'boolean') u.vip = b.vip;
        await db.put('users', u);
        return json(200, publicUser(u));
      }

      if (p[1] === 'requirements' && m === 'POST') {
        const b = await readJson(req);
        const r = p[2] ? await getReq(p[2]) : { id: 'c-' + id(4), type: 'custom', proposed: false };
        Object.assign(r, {
          title: str(b.title ?? r.title, 200), level: LEVELS.includes(b.level) ? b.level : r.level || 'R1',
          window: str(b.window ?? r.window, 40), description: str(b.description ?? r.description, 3000),
          instructions: Array.isArray(b.instructions) ? b.instructions.map((x) => str(x, 1000)).filter(Boolean) : r.instructions || [],
          rubric: Array.isArray(b.rubric) ? b.rubric.map((c) => ({ name: str(c.name, 300), max: Number(c.max) || 0 })).filter((c) => c.name) : r.rubric || [],
          resources: Array.isArray(b.resources) ? b.resources.filter((x) => /^https?:\/\//.test(x.url)).map((x) => ({ title: str(x.title, 200), url: str(x.url, 500) })) : r.resources || [],
          fileTypes: Array.isArray(b.fileTypes) ? b.fileTypes.map((x) => str(x, 10).toLowerCase().replace('.', '')).filter(Boolean) : r.fileTypes || ['pdf'],
          howToSubmit: str(b.howToSubmit ?? r.howToSubmit, 1000), note: str(b.note ?? r.note, 500),
          slots: b.slots !== undefined ? Math.min(5, Math.max(1, Number(b.slots) || 1)) : r.slots, maxMB: Math.min(maxUploadMB, Number(b.maxMB ?? r.maxMB) || 25),
          openAt: b.openAt !== undefined ? (b.openAt ? new Date(b.openAt).toISOString() : null) : r.openAt,
          closeAt: b.closeAt !== undefined ? (b.closeAt ? new Date(b.closeAt).toISOString() : null) : r.closeAt,
          lateDays: Math.max(0, Number(b.lateDays ?? r.lateDays ?? 14)), published: b.published !== undefined ? !!b.published : !!r.published,
        });
        const total = r.rubric.reduce((a, c) => a + c.max, 0);
        if (total !== 90) throw new AppError(400, `Content criteria must total 90 (currently ${total}); timeliness adds the other 10`);
        if (r.openAt && r.closeAt && new Date(r.openAt) >= new Date(r.closeAt)) throw new AppError(400, 'Close time must be after open time');
        r.fileLabel = r.fileTypes.join(' / ').toUpperCase();
        await db.put('requirements', r);
        return json(200, withState(r));
      }
      if (p[1] === 'requirements' && p[2] && m === 'DELETE') {
        if ((await db.find('submissions', 'reqId', p[2])).length) throw new AppError(409, 'It has submissions; unpublish it instead of deleting');
        await db.del('requirements', p[2]);
        return json(200, { ok: true });
      }

      if (p[1] === 'submissions' && m === 'GET') {
        const users = Object.fromEntries((await db.all('users')).map((u) => [u.id, u]));
        const list = p[2] ? await db.find('submissions', 'reqId', p[2]) : await db.all('submissions');
        return json(200, list.map((s) => ({ ...s, user: { name: users[s.userId]?.name, email: users[s.userId]?.email, level: users[s.userId]?.level } })));
      }

      // Grading: a rating per criterion + 10 timeliness points computed automatically
      if (p[1] === 'grade' && p[2] && m === 'POST') {
        const s = await db.get('submissions', p[2]);
        if (!s) throw new AppError(404, 'Submission not found');
        if (s.rejected) throw new AppError(409, 'This submission was rejected; wait for the new file');
        const r = await getReq(s.reqId);
        const b = await readJson(req);
        const ratings = Array.isArray(b.ratings) ? b.ratings : [];
        if (ratings.length !== r.rubric.length || ratings.some((x) => !(x in RATINGS))) throw new AppError(400, 'Every criterion must be rated');
        const items = r.rubric.map((c, i) => ({ name: c.name, max: c.max, rating: ratings[i], score: Math.round(c.max * RATINGS[ratings[i]] * 10) / 10 }));
        const t = timeliness(r, s.submittedAt);
        const total = Math.round((items.reduce((a, x) => a + x.score, 0) + t) * 10) / 10;
        s.grade = { items, timeliness: t, total, band: band(total), feedback: str(b.feedback, 3000), by: admin.email, at: now().toISOString() };
        await db.put('submissions', s);
        return json(200, s);
      }
      // Reject: delete the file so the trainee can submit a new one
      if (p[1] === 'reject' && p[2] && m === 'POST') {
        const s = await db.get('submissions', p[2]);
        if (!s) throw new AppError(404, 'Submission not found');
        const b = await readJson(req);
        const reason = str(b.reason, 1000);
        if (!reason) throw new AppError(400, 'Give the trainee a reason');
        if (s.fileId) await db.delFile(s.fileId);
        s.history = [...(s.history || []), { at: s.submittedAt, name: s.fileName, rejected: now().toISOString(), reason }];
        Object.assign(s, { rejected: true, rejectReason: reason, rejectedAt: now().toISOString(), rejectedBy: admin.email, fileId: null, fileName: null, size: 0 });
        delete s.grade;
        await db.put('submissions', s);
        return json(200, s);
      }
      if (p[1] === 'grade' && p[2] && m === 'DELETE') {
        const s = await db.get('submissions', p[2]);
        if (s) { delete s.grade; await db.put('submissions', s); }
        return json(200, { ok: true });
      }
    }

    throw new AppError(404, 'Not found');
  }

  // req: { method, pathname, secure, header(name), body(limit) → Promise<Uint8Array> }
  return async function handle(req) {
    try {
      ready = ready || init().catch((e) => { ready = null; throw e; });
      await ready;
      // Basic CSRF guard: state-changing requests must come from the app itself
      if (req.method !== 'GET' && req.header('x-requested-with') !== 'portal') throw new AppError(403, 'Request not allowed');
      return await api(req, req.pathname.slice(5).split('/').filter(Boolean));
    } catch (e) {
      if (e instanceof AppError) return json(e.status, { message: e.message });
      (opts.log || console.error)(e);
      return json(500, { message: 'Unexpected error' });
    }
  };
}

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'same-origin',
  'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; frame-ancestors 'none'",
};

module.exports = { slotsOf, createCore, AppError, windowState, timeliness, SECURITY_HEADERS };
