'use strict';
// Academic day attendance. Trainees sign a paper sheet; the program records absences here.
// Trainees do not need an account: each one has a private link (a long random token) to see their
// record, give an excuse or say they were present, or tell the program in advance about an absence.
// Only the program director (admin) decides whether an absence is excused.
//
// Collections:
//   attRoster  { id, no, name, level, phone, email, token, active }
//   attDays    { id: 'YYYY-MM-DD', present: [rid], absent: [rid], cancelled, sheetFileId, sheetName, by, at }
//   attCases   { id: 'YYYY-MM-DD:rid', date, rid, response: { kind, text, fileId, fileName, at }, decision, note, by, at, log }
//   settings   { id: 'attendance', allowed, from, to, replyDays }

const DEFAULTS = { allowed: 2, from: '2026-11-19', to: '2027-04-29', replyDays: 7 };
const KINDS = ['excuse', 'present', 'none', 'notice'];
const DECISIONS = ['excused', 'unexcused', 'present'];
const FILE_TYPES = ['pdf', 'jpg', 'jpeg', 'png', 'heic'];
const FILE_MB = 10;
// An excuse is accepted only with an official document attached.
const NEEDS_DOC = ['excuse', 'notice'];
const hasDoc = (res) => !!res?.fileId;
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'));
const dayEnd = (date) => new Date(date + 'T23:59:59+03:00'); // Riyadh
const todayRiyadh = () => new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 10);

function makeAttendanceApi({ db, json, AppError, readJson, str, id }) {
  const policy = async () => ({ ...DEFAULTS, ...((await db.get('settings', 'attendance')) || {}), id: undefined });

  // Status of one trainee on one recorded day.
  function statusOf(day, rid, c, pol, t = Date.now()) {
    if (day.cancelled) return null;
    if (!day.absent.includes(rid)) return day.present.includes(rid) ? { status: 'present' } : null;
    const deadline = new Date(dayEnd(day.id).getTime() + pol.replyDays * 86400000);
    if (c?.decision === 'present') return { status: 'present', corrected: true };
    if (c?.decision) return { status: c.decision, deadline };
    const missingDoc = NEEDS_DOC.includes(c?.response?.kind) && !hasDoc(c.response);
    if (c?.response && c.response.kind !== 'none' && !missingDoc) return { status: 'awaiting', deadline };
    if (c?.response?.kind === 'none' || t > deadline) return { status: 'unexcused', auto: !c?.response || missingDoc, missingDoc: missingDoc || undefined, deadline };
    return { status: 'reply', missingDoc: missingDoc || undefined, deadline };
  }

  // A trainee's full record: every recorded day in the period where they were listed.
  function recordOf(r, days, cases, pol) {
    const caseOf = Object.fromEntries(cases.filter((c) => c.rid === r.id).map((c) => [c.date, c]));
    const rows = [];
    for (const d of days.filter((x) => x.id >= pol.from && x.id <= pol.to).sort((a, b) => (a.id < b.id ? -1 : 1))) {
      const s = statusOf(d, r.id, caseOf[d.id], pol);
      if (!s) continue;
      const c = caseOf[d.id];
      rows.push({ date: d.id, ...s, response: c?.response ? { kind: c.response.kind, text: c.response.text, fileName: c.response.fileName, at: c.response.at } : undefined, note: c?.note || undefined });
    }
    const counted = rows.filter((x) => x.status === 'unexcused').length;
    const attended = rows.filter((x) => x.status === 'present').length;
    // Absences the trainee announced in advance, for days not recorded yet.
    const recorded = new Set(days.map((d) => d.id));
    const notices = cases.filter((c) => c.rid === r.id && !recorded.has(c.date) && c.response?.kind === 'notice')
      .map((c) => ({ date: c.date, text: c.response.text, fileName: c.response.fileName, at: c.response.at }));
    const standing = counted > pol.allowed ? 'over' : counted === pol.allowed ? 'limit' : counted > 0 ? 'notice' : 'ok';
    return { rows, counted, attended, held: rows.length, allowed: pol.allowed, remaining: Math.max(0, pol.allowed - counted), standing, notices };
  }

  const all = async () => {
    const [roster, days, cases, pol] = await Promise.all([db.all('attRoster'), db.all('attDays'), db.all('attCases'), policy()]);
    return { roster: roster.sort((a, b) => (a.no || 999) - (b.no || 999) || (a.name < b.name ? -1 : 1)), days, cases, pol };
  };
  async function byToken(tok) {
    if (!/^[a-f0-9]{40,}$/.test(tok || '')) throw new AppError(404, 'This link is not valid');
    const [r] = await db.find('attRoster', 'token', tok);
    if (!r || r.active === false) throw new AppError(404, 'This link is not valid');
    return r;
  }
  async function saveFile(req, c) {
    const name = decodeURIComponent(String(req.header('x-file-name') || 'file')).split(/[\\/]/).pop().slice(0, 200) || 'file';
    const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
    if (!FILE_TYPES.includes(ext)) throw new AppError(415, `File type not accepted. Allowed: ${FILE_TYPES.join(', ')}`);
    const buf = await req.body(FILE_MB * 1048576);
    if (!buf.length) throw new AppError(400, 'The file is empty');
    const fileId = 'att-' + id() + '.' + ext;
    await db.putFile(fileId, buf);
    if (c.response?.fileId) await db.delFile(c.response.fileId);
    return { fileId, fileName: name };
  }
  const download = async (fileId, name) => {
    const data = fileId && (await db.getFile(fileId));
    if (!data) throw new AppError(404, 'File not found');
    return { status: 200, body: data, headers: { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name || 'file')}`, 'Cache-Control': 'no-store' } };
  };

  // ---------- Trainee, by private link: /api/att/<token>[/...] ----------
  async function publicApi(req, p) {
    if (p[0] !== 'att') return null;
    const m = req.method;
    const r = await byToken(p[1]);
    const { days, cases, pol } = await all();
    const caseId = (date) => `${date}:${r.id}`;
    const dayOf = (date) => days.find((d) => d.id === date);

    if (!p[2] && m === 'GET') {
      return json(200, { name: r.name, level: r.level, no: r.no, policy: pol, today: todayRiyadh(), ...recordOf(r, days, cases, pol) });
    }
    // Reply to an absence (excuse / I was present / no excuse), or tell the program in advance (notice).
    if (p[2] === 'reply' && m === 'POST') {
      const b = await readJson(req);
      const date = String(b.date || '');
      if (!isDate(date)) throw new AppError(400, 'Invalid date');
      const kind = KINDS.includes(b.kind) ? b.kind : null;
      if (!kind) throw new AppError(400, 'Choose a reply');
      const text = str(b.text, 1500);
      const d = dayOf(date);
      if (kind === 'notice') {
        if (d) throw new AppError(409, 'This day is already recorded; reply to the absence instead');
        if (date < todayRiyadh()) throw new AppError(400, 'Advance notice is for a coming academic day');
        if (date < pol.from || date > pol.to) throw new AppError(400, 'This date is outside the academic year');
        if (new Date(date + 'T12:00:00+03:00').getUTCDay() !== 4) throw new AppError(400, 'Academic days are on Thursdays');
        if (!text) throw new AppError(400, 'Write the reason');
      } else {
        if (!d || !d.absent.includes(r.id)) throw new AppError(404, 'No absence recorded on this day');
        if ((kind === 'excuse' || kind === 'present') && !text) throw new AppError(400, 'Write a short explanation');
      }
      const c = (await db.get('attCases', caseId(date))) || { id: caseId(date), date, rid: r.id, log: [] };
      if (c.decision) throw new AppError(409, 'The program director has already decided on this absence');
      if (d && Date.now() > dayEnd(date).getTime() + pol.replyDays * 86400000) throw new AppError(409, 'The time to reply has passed; contact the program director');
      const keepFile = c.response?.fileId && kind !== 'none';
      if (c.response?.fileId && !keepFile) await db.delFile(c.response.fileId);
      c.response = { ...(keepFile ? { fileId: c.response.fileId, fileName: c.response.fileName } : {}), kind, text, at: new Date().toISOString() };
      c.log = [...(c.log || []), { at: c.response.at, by: 'trainee', kind }];
      await db.put('attCases', c);
      return json(200, { ok: true });
    }
    // Attach a document (medical report…) to a reply already made.
    if (p[2] === 'file' && m === 'POST') {
      const date = String(req.header('x-date') || '');
      const c = isDate(date) && (await db.get('attCases', caseId(date)));
      if (!c || !c.response || c.response.kind === 'none') throw new AppError(400, 'Send your reply first, then attach the file');
      if (c.decision) throw new AppError(409, 'The program director has already decided on this absence');
      Object.assign(c.response, await saveFile(req, c));
      await db.put('attCases', c);
      return json(200, { ok: true, fileName: c.response.fileName });
    }
    if (p[2] === 'file' && p[3] && m === 'GET') {
      const c = await db.get('attCases', caseId(p[3]));
      return download(c?.response?.fileId, c?.response?.fileName);
    }
    throw new AppError(404, 'Not found');
  }

  // ---------- Program director: /api/admin/att/... ----------
  async function adminApi(req, p, admin) {
    if (p[1] !== 'att') return null;
    const m = req.method;

    if (!p[2] && m === 'GET') {
      const { roster, days, cases, pol } = await all();
      return json(200, {
        policy: pol, today: todayRiyadh(),
        roster: roster.map((r) => ({ ...r, record: recordOf(r, days, cases, pol) })),
        days: days.sort((a, b) => (a.id < b.id ? 1 : -1)).map((d) => ({ ...d, sheetFileId: undefined, sheet: !!d.sheetFileId })),
        cases: cases.map((c) => ({ ...c, response: c.response && { ...c.response, fileId: undefined, file: !!c.response.fileId } })),
      });
    }
    if (p[2] === 'settings' && m === 'POST') {
      const b = await readJson(req);
      const pol = await policy();
      const next = {
        id: 'attendance',
        allowed: b.allowed !== undefined ? Math.max(0, Math.min(40, Math.round(Number(b.allowed) || 0))) : pol.allowed,
        from: isDate(b.from) ? b.from : pol.from, to: isDate(b.to) ? b.to : pol.to,
        replyDays: b.replyDays !== undefined ? Math.max(1, Math.min(60, Math.round(Number(b.replyDays) || 7))) : pol.replyDays,
      };
      if (next.from > next.to) throw new AppError(400, 'The start date must be before the end date');
      await db.put('settings', next);
      return json(200, next);
    }
    // Add or edit trainees. One at a time ({ id?, no, name, level, phone, email, active }) or a list ({ list: [...] }, matched by number).
    if (p[2] === 'roster' && !p[3] && m === 'POST') {
      const b = await readJson(req);
      const roster = await db.all('attRoster');
      const clean = (x, r = {}) => ({
        ...r,
        no: x.no !== undefined && x.no !== '' ? Math.max(0, Math.round(Number(x.no) || 0)) || null : r.no ?? null,
        name: str(x.name ?? r.name, 120), level: ['R1', 'R2', 'R3', 'R4', ''].includes(x.level) ? x.level : r.level || '',
        phone: str(x.phone ?? r.phone, 30), email: str(x.email ?? r.email, 120).toLowerCase(),
        active: x.active !== undefined ? !!x.active : r.active !== false,
      });
      const items = Array.isArray(b.list) ? b.list : [b];
      const out = [];
      for (const x of items.slice(0, 300)) {
        let r = x.id ? roster.find((y) => y.id === x.id) : x.no ? roster.find((y) => y.no && y.no === Number(x.no)) : null;
        if (x.id && !r) throw new AppError(404, 'Trainee not found');
        r = clean(x, r || { id: id(6), token: id(24), createdAt: new Date().toISOString() });
        if (!r.name) throw new AppError(400, 'Every trainee needs a name');
        if (r.no && roster.some((y) => y.id !== r.id && y.no === r.no) && !out.some((y) => y.id === r.id)) throw new AppError(409, `Number ${r.no} is already used`);
        out.push(r);
        const i = roster.findIndex((y) => y.id === r.id);
        if (i >= 0) roster[i] = r; else roster.push(r);
      }
      await db.putMany('attRoster', out);
      return json(200, out);
    }
    // A new private link (the old one stops working).
    if (p[2] === 'roster' && p[3] && p[4] === 'token' && m === 'POST') {
      const r = await db.get('attRoster', p[3]);
      if (!r) throw new AppError(404, 'Trainee not found');
      r.token = id(24);
      await db.put('attRoster', r);
      return json(200, r);
    }
    // Record a day: everyone active is present except those listed as absent.
    if (p[2] === 'day' && !p[4] && m === 'POST') {
      const b = await readJson(req);
      const date = String(b.date || p[3] || '');
      if (!isDate(date)) throw new AppError(400, 'Choose the date');
      if (date > todayRiyadh()) throw new AppError(400, 'This day has not happened yet');
      const roster = (await db.all('attRoster')).filter((r) => r.active !== false);
      const absent = roster.filter((r) => Array.isArray(b.absent) && b.absent.includes(r.id)).map((r) => r.id);
      const old = (await db.get('attDays', date)) || {};
      const d = { ...old, id: date, cancelled: !!b.cancelled, absent: b.cancelled ? [] : absent, present: b.cancelled ? [] : roster.filter((r) => !absent.includes(r.id)).map((r) => r.id), by: admin.email, at: new Date().toISOString() };
      await db.put('attDays', d);
      return json(200, d);
    }
    if (p[2] === 'day' && p[3] && !p[4] && m === 'DELETE') {
      const d = await db.get('attDays', p[3]);
      if (d?.sheetFileId) await db.delFile(d.sheetFileId);
      await db.del('attDays', p[3]);
      return json(200, { ok: true });
    }
    // The signed paper sheet, kept as evidence.
    if (p[2] === 'day' && p[3] && p[4] === 'sheet' && m === 'POST') {
      const d = await db.get('attDays', p[3]);
      if (!d) throw new AppError(404, 'Record the day first');
      const f = await saveFile(req, {});
      if (d.sheetFileId) await db.delFile(d.sheetFileId);
      Object.assign(d, { sheetFileId: f.fileId, sheetName: f.fileName });
      await db.put('attDays', d);
      return json(200, { ok: true });
    }
    if (p[2] === 'day' && p[3] && p[4] === 'sheet' && m === 'GET') {
      const d = await db.get('attDays', p[3]);
      return download(d?.sheetFileId, d?.sheetName);
    }
    // The director's decision on one absence: excused, unexcused, or recorded by mistake (was present).
    if (p[2] === 'decide' && m === 'POST') {
      const b = await readJson(req);
      const date = String(b.date || ''), rid = String(b.rid || '');
      const d = isDate(date) && (await db.get('attDays', date));
      if (!d || !d.absent.includes(rid)) throw new AppError(404, 'No absence recorded for this trainee on this day');
      const c = (await db.get('attCases', `${date}:${rid}`)) || { id: `${date}:${rid}`, date, rid, log: [] };
      const at = new Date().toISOString();
      if (b.decision === null || b.decision === '') { delete c.decision; c.note = ''; c.log = [...(c.log || []), { at, by: admin.email, decision: 'cleared' }]; }
      else {
        if (!DECISIONS.includes(b.decision)) throw new AppError(400, 'Choose a decision');
        if (b.decision === 'excused' && !hasDoc(c.response)) throw new AppError(400, 'An absence is excused only with an official document; none is attached');
        Object.assign(c, { decision: b.decision, note: str(b.note, 1000), by: admin.email, at });
        c.log = [...(c.log || []), { at, by: admin.email, decision: b.decision }];
      }
      await db.put('attCases', c);
      return json(200, c);
    }
    if (p[2] === 'file' && p[3] && m === 'GET') {
      const c = await db.get('attCases', decodeURIComponent(p[3]));
      return download(c?.response?.fileId, c?.response?.fileName);
    }
    throw new AppError(404, 'Not found');
  }

  return { publicApi, adminApi };
}

module.exports = { makeAttendanceApi, ATTENDANCE_DEFAULTS: DEFAULTS };
