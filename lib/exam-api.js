'use strict';
// Online exams: no account needed (full name + national ID + exam password).
// Correct answers never leave the server; question and option order is shuffled per attempt;
// the time limit is enforced on the server; answers are saved as they are chosen.

const crypto = require('node:crypto');

const GRACE_MS = 30 * 1000; // network delay allowed after the deadline
// Answers chosen before the deadline but held on the device by a lost connection are still accepted for
// this long after it (the browser stops answering at the deadline); such late arrivals are flagged to the admin.
const SYNC_GRACE_MS = 10 * 60 * 1000;
// With no connection at all the browser keeps every answer, with the time it was chosen, and sends them
// whenever it is back online; answers chosen in time are accepted for this long after the deadline.
const OFFLINE_MAX_MS = 3 * 24 * 3600 * 1000;
const MAX_EVENTS = 300;

function shuffle(a) {
  const x = a.slice();
  for (let i = x.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
}

// Single-answer items store one option id; multiple-answer items (multi) store a list and need the exact set.
const keyOf = (it) => (Array.isArray(it.answer) ? it.answer : [it.answer]);
function isCorrect(it, ans) {
  if (!it.multi) return ans === it.answer;
  const got = Array.isArray(ans) ? [...ans].sort() : [];
  const key = keyOf(it).slice().sort();
  return got.length === key.length && got.every((x, i) => x === key[i]);
}
const chose = (ans, oid) => (Array.isArray(ans) ? ans.includes(oid) : ans === oid);

// Arabic name matching that ignores spelling variants: diacritics, tatweel, hamza forms, ta marbuta, alef maqsura, spaces.
function normName(t) {
  return String(t || '').normalize('NFKC')
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}
const nameKey = (t) => normName(t).replace(/\s+/g, ''); // "عبد الله" = "عبدالله"
const digits = (t) => String(t || '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/\D/g, '');

// "Name – 1234567890" lines (any order, Arabic or Latin digits) → [{ name, nid }]
function parseRoster(text) {
  // Accepts "name – ID" on one line, or the name on one line and the ID on the next.
  const out = [], bad = [];
  let pending = null;
  for (const line of String(text || '').split(/\r?\n/)) {
    const l = line.trim(); if (!l) continue;
    const nid = digits((l.match(/[0-9٠-٩۰-۹]{6,}/) || [''])[0]);
    const name = l.replace(/[0-9٠-٩۰-۹]{6,}/, '').replace(/[-–—|,:;]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (name && nid) { if (pending) bad.push(pending); pending = null; out.push({ name, nid }); }
    else if (name) { if (pending) bad.push(pending); pending = name; }
    else if (nid && pending) { out.push({ name: pending, nid }); pending = null; }
    else bad.push(l);
  }
  if (pending) bad.push(pending);
  return { roster: out, bad };
}

function examState(e, t = Date.now()) {
  if (t < new Date(e.openAt)) return 'upcoming';
  if (t > new Date(e.closeAt)) return 'closed';
  return 'open';
}

// Items in groups (shared stem/figures) stay together and in their own order; groups and single items are shuffled.
// Exams can have parts taken in order (e.g. Biostatistics, then Epidemiology); a finished part cannot be reopened.
const partsOf = (e) => (e.parts && e.parts.length ? e.parts : [{ id: 'all', title: '' }]);
const partOf = (e, it) => it.part || partsOf(e)[0].id;

function makeOrder(e) {
  // Parts stay in their order; inside each part, single items and shared-stem groups are shuffled.
  return partsOf(e).flatMap((pt) => {
    const blocks = [];
    const seen = {};
    for (const it of e.items.filter((x) => partOf(e, x) === pt.id)) {
      if (!it.group) blocks.push([it.id]);
      else if (seen[it.group]) seen[it.group].push(it.id);
      else blocks.push((seen[it.group] = [it.id]));
    }
    return shuffle(blocks).flat();
  });
}

function grade(e, a) {
  const live = e.items.filter((it) => !it.excluded);
  const byPart = partsOf(e).length > 1 ? Object.fromEntries(partsOf(e).map((pt) => {
    const its = live.filter((it) => partOf(e, it) === pt.id);
    const sc = its.filter((it) => isCorrect(it, a.answers[it.id])).length;
    return [pt.id, { score: sc, total: its.length, percent: its.length ? Math.round((sc / its.length) * 1000) / 10 : 0 }];
  })) : undefined;
  const correct = live.filter((it) => isCorrect(it, a.answers[it.id])).length;
  const percent = live.length ? Math.round((correct / live.length) * 1000) / 10 : 0;
  return { score: correct, total: live.length, percent, passed: e.passMark ? percent >= e.passMark : undefined, byPart };
}

// Item analysis: difficulty, discrimination (upper vs lower 27%), distractors, KR-20 reliability.
function analyse(e, attempts) {
  const done = attempts.filter((a) => a.submittedAt);
  const live = e.items.filter((it) => !it.excluded);
  const totals = done.map((a) => live.filter((it) => isCorrect(it, a.answers[it.id])).length);
  const ranked = done.map((a, i) => ({ a, s: totals[i] })).sort((x, y) => y.s - x.s);
  const k = Math.max(1, Math.round(done.length * 0.27));
  const upper = ranked.slice(0, k).map((x) => x.a), lower = ranked.slice(-k).map((x) => x.a);
  const items = e.items.map((it) => {
    const n = done.length;
    const right = done.filter((a) => isCorrect(it, a.answers[it.id])).length;
    const p = n ? right / n : null;
    const pu = upper.length ? upper.filter((a) => isCorrect(it, a.answers[it.id])).length / upper.length : 0;
    const pl = lower.length ? lower.filter((a) => isCorrect(it, a.answers[it.id])).length / lower.length : 0;
    const D = n >= 4 ? Math.round((pu - pl) * 100) / 100 : null;
    const counts = Object.fromEntries(it.options.map((o) => [o.id, done.filter((a) => chose(a.answers[it.id], o.id)).length]));
    const flags = [];
    if (n >= 4) {
      if (p >= 0.9) flags.push('Very easy');
      if (p <= 0.3) flags.push('Very hard');
      if (D !== null && D < 0) flags.push('Negative discrimination — check the key');
      else if (D !== null && D < 0.2) flags.push('Poor discrimination');
      const top = Object.entries(counts).sort((x, y) => y[1] - x[1])[0];
      if (top && !keyOf(it).includes(top[0]) && top[1] > right) flags.push('A wrong option was chosen more than the key');
    }
    return { id: it.id, p: p === null ? null : Math.round(p * 100) / 100, D, counts, unanswered: n - Object.values(counts).reduce((s, c) => s + c, 0), flags };
  });
  let kr20 = null;
  if (done.length >= 4 && live.length > 1) {
    const mean = totals.reduce((s, x) => s + x, 0) / totals.length;
    const varT = totals.reduce((s, x) => s + (x - mean) ** 2, 0) / totals.length;
    const pq = live.reduce((s, it) => { const p = done.filter((a) => isCorrect(it, a.answers[it.id])).length / done.length; return s + p * (1 - p); }, 0);
    if (varT > 0) kr20 = Math.round((live.length / (live.length - 1)) * (1 - pq / varT) * 100) / 100;
  }
  return { items, kr20, n: done.length };
}

function makeExamApi({ db, json, AppError, readJson, str, id, isAdmin = async () => false }) {
  const getExam = async (eid) => {
    const e = await db.get('exams', eid);
    if (!e) throw new AppError(404, 'Exam not found');
    return e;
  };
  // Laptops and tablets only (setting on by default): phones are refused by what the browser says it is and by
  // the size of its screen (a phone's short side is under 600 points; every tablet, iPad mini included, is larger).
  const noPhones = (e) => e.noPhones !== false;
  const isPhone = (ua, scr) => /iPhone|iPod|Windows Phone|Android.*Mobile|Mobile.*Android|BlackBerry|Opera Mini|IEMobile/i.test(String(ua || ''))
    || (scr && Number(scr.short) > 0 && Number(scr.short) < 600 && scr.touch === true);
  // Super password (set by the admin): signs in like the exam password but opens the exam at any time, outside
  // the dates and window. Such attempts count in the results and are marked for the admin.
  const isSuper = (e, pw) => !!(e.superPassword && String(pw || '') === e.superPassword);
  const passOk = (e, pw) => String(pw || '') === e.password || isSuper(e, pw);
  // Attempts free of the exam window: admin previews and super-password attempts.
  const anyTime = (a) => !!(a.preview || a.anytime);
  const lockSec = (e) => (e.lockAwaySec === undefined || e.lockAwaySec === null ? 10 : Number(e.lockAwaySec) || 0);
  const publicInfo = (e) => ({ lockAwaySec: lockSec(e), noPhones: noPhones(e), id: e.id, title: e.title, level: e.level, openAt: e.openAt, closeAt: e.closeAt, durationMin: e.durationMin, count: e.items.filter((i) => !i.excluded).length, state: examState(e), roster: !!(e.roster && e.roster.length), showScore: !!e.showScore });
  // Questions as the trainee sees them: no answers, no notes, shuffled options.
  const curPart = (e, a) => partsOf(e)[Math.min(a.partIndex || 0, partsOf(e).length - 1)];
  const partInfo = (e, a) => { const ps = partsOf(e), i = Math.min(a.partIndex || 0, ps.length - 1); return { index: i, count: ps.length, title: ps[i].title, next: ps[i + 1] ? ps[i + 1].title : null }; };
  // The questions of one part (the current one by default).
  const paper = (e, a, partId = curPart(e, a).id) => a.order.map((qid) => e.items.find((i) => i.id === qid)).filter((it) => it && !it.excluded && partOf(e, it) === partId).map((it) => ({
    id: it.id, text: it.text, table: it.table, group: it.group, multi: !!it.multi,
    stem: it.group ? e.groups[it.group].stem : undefined, images: it.group ? e.groups[it.group].images : undefined,
    options: a.optOrder[it.id].map((oid) => it.options.find((o) => o.id === oid)).filter(Boolean).map((o) => ({ id: o.id, text: o.text })),
  }));
  // The whole exam is sent at the start so it can run without a connection; the browser shows one part at a time
  // and the server still refuses answers to a part before it is reached or after it is closed.
  const paperAll = (e, a) => partsOf(e).map((pt, i) => ({ index: i, title: pt.title, questions: paper(e, a, pt.id) }));
  const startPayload = async (e, a) => ({
    token: a.token, deadline: iso(deadlineOf(e, a)), begun: !!a.startedAt, openAt: anyTime(a) ? null : e.openAt, lockAwaySec: lockSec(e), locked: a.locked || [], durationMin: e.durationMin, closeAt: anyTime(a) ? null : e.closeAt, anytime: !!a.anytime,
    serverNow: Date.now(), name: a.name, idTail: String(a.scfhs || '').slice(-4), title: e.title,
    questions: paper(e, a), part: partInfo(e, a), parts: paperAll(e, a), partIndex: Math.min(a.partIndex || 0, partsOf(e).length - 1), answers: await loadAnswers(a),
  });
  // The clock starts when the trainee presses Start after the download (an attempt only downloaded has none yet).
  const iso = (t) => (Number.isFinite(t) ? new Date(t).toISOString() : null);
  // extraMin: silent extra minutes added to every attempt on top of the published duration.
  const allowMs = (e) => (e.durationMin + (Number(e.extraMin) || 0)) * 60000;
  const deadlineOf = (e, a) => (!a.startedAt ? Infinity : anyTime(a) ? new Date(a.startedAt).getTime() + allowMs(e) : Math.min(new Date(a.startedAt).getTime() + allowMs(e), new Date(e.closeAt).getTime()));

  // Each answer and each activity event is its own record, so parallel requests never overwrite each other.
  async function loadAnswers(a) {
    const docs = await db.find('examAnswers', 'attemptId', a.id);
    const out = { ...(a.answers || {}) };
    for (const d of docs) { if (d.optionId) out[d.itemId] = d.optionId; else delete out[d.itemId]; }
    return out;
  }
  async function loadEvents(a) {
    const docs = (await db.find('examEvents', 'attemptId', a.id)).filter((d) => d.type !== 'hb').map((d) => ({ t: d.t, type: d.type, ...(d.itemId ? { itemId: d.itemId, ms: d.ms, why: d.why } : {}) }));
    return [...(a.events || []), ...docs].sort((x, y) => x.t.localeCompare(y.t)).slice(-MAX_EVENTS);
  }
  async function removeAttempt(a) {
    for (const d of await db.find('examAnswers', 'attemptId', a.id)) await db.del('examAnswers', d.id);
    for (const d of await db.find('examEvents', 'attemptId', a.id)) await db.del('examEvents', d.id);
    await db.del('attempts', a.id);
  }

  async function finish(e, a) {
    if (a.submittedAt) return a;
    a.answers = await loadAnswers(a);
    Object.assign(a, grade(e, a), { submittedAt: new Date().toISOString() });
    await db.put('attempts', a);
    return a;
  }
  // An auto-submitted attempt is re-graded when answers held offline arrive later.
  async function regrade(e, a) {
    a.answers = await loadAnswers(a);
    Object.assign(a, grade(e, a));
    await db.put('attempts', a);
  }
  // When the browser chose an answer (its clock corrected to the server's): trusted only within sane bounds.
  const madeAt = (a, b) => { const t = Number(b.at); return Number.isFinite(t) && t >= new Date(a.startedAt).getTime() - 60000 && t <= Date.now() + 60000 ? t : null; };
  const madeInTime = (e, a, b) => { const t = madeAt(a, b); return t !== null && t <= deadlineOf(e, a) + GRACE_MS && Date.now() <= deadlineOf(e, a) + OFFLINE_MAX_MS; };
  // Attempts whose time ran out are submitted automatically with the answers saved so far.
  async function autoFinish(e, a) {
    if (!a.submittedAt && Date.now() > deadlineOf(e, a) + SYNC_GRACE_MS) { a.autoSubmitted = true; await finish(e, a); }
    return a;
  }
  async function attemptByToken(token) {
    const [a] = await db.find('attempts', 'token', str(token, 100));
    if (!a) throw new AppError(401, 'Your exam session was not found. Enter your details again to continue.');
    return a;
  }
  // A short receipt code for a submitted attempt, shown to the trainee at the end and to the admin with the results.
  const receiptOf = (a) => { let h = 2166136261; for (const c of String(a.id)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36).toUpperCase().padStart(6, '0').slice(-6); };
  // Scores stay hidden from trainees until the admin releases them (admin previews always see theirs).
  const result = (e, a) => (e.showScore || a.preview
    ? { submitted: true, receipt: receiptOf(a), name: a.name, score: a.score, total: a.total, percent: a.percent, byPart: a.byPart, parts: partsOf(e).length > 1 ? partsOf(e) : undefined, passed: a.passed, autoSubmitted: !!a.autoSubmitted, submittedAt: a.submittedAt }
    : { submitted: true, receipt: receiptOf(a), scoreHidden: true, name: a.name, autoSubmitted: !!a.autoSubmitted, submittedAt: a.submittedAt });

  // ---------- Live view for the exam proctor ----------
  // Each trainee's state and the alerts worth walking over for, newest first. Levels: high (go and look now),
  // mid (keep an eye), low (for the record).
  const WHY_AR = { app: 'انتقل لتطبيق أو تبويب آخر', window: 'انتقل لنافذة أخرى', split: 'قسّم الشاشة' };
  const KIND_AR = { copy: 'محاولة نسخ', paste: 'محاولة لصق', contextmenu: 'ضغط بالزر الأيمن', print: 'محاولة طباعة', devtools: 'محاولة فتح أدوات المطوّر', screenshot: 'ضغط زر تصوير الشاشة', 'fullscreen-exit': 'خرج من وضع ملء الشاشة' };
  const mmss = (ms) => { const sec = Math.round((ms || 0) / 1000); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; };
  const screenNo = (e, a, itemId) => {
    const it = e.items.find((x) => x.id === itemId); if (!it || !a.order) return 0;
    const list = a.order.map((id) => e.items.find((x) => x.id === id)).filter((x) => x && !x.excluded && partOf(e, x) === partOf(e, it));
    return list.indexOf(it) + 1;
  };
  async function liveData(e) {
    const now = Date.now(), lockMs = lockSec(e) * 1000;
    const attempts = (await db.all('attempts')).filter((a) => a.examId === e.id && !a.preview);
    const ids = new Set(attempts.map((a) => a.id));
    const events = (await db.all('examEvents')).filter((d) => ids.has(d.attemptId));
    const total = e.items.filter((it) => !it.excluded).length;
    const alerts = [];
    const trainees = attempts.map((a) => {
      const evs = events.filter((d) => d.attemptId === a.id);
      const hb = evs.find((d) => d.type === 'hb');
      const seen = hb ? now - new Date(hb.t).getTime() : null;
      const status = a.submittedAt ? 'submitted' : !a.startedAt ? 'ready' : now > deadlineOf(e, a) ? 'ended' : 'active';
      const add = (d, level, text) => alerts.push({ id: d.id, t: d.t, level, attemptId: a.id, name: a.name, text });
      for (const d of evs) {
        if (d.type === 'away') {
          if (d.ms < 3000) continue;
          const locked = lockMs && d.ms >= lockMs;
          add(d, locked || d.why === 'split' ? 'high' : 'mid', `${WHY_AR[d.why] || 'خرج من صفحة الاختبار'} لمدة ${mmss(d.ms)} على السؤال ${screenNo(e, a, d.itemId) || '؟'}${locked ? ' — وقُفل السؤال' : ''}`);
        } else if (d.type === 'device') add(d, 'high', 'دخل للاختبار من جهاز أو متصفح آخر');
        else if (d.type === 'devtools' || d.type === 'screenshot') add(d, 'high', KIND_AR[d.type]);
        else if (KIND_AR[d.type]) add(d, d.type === 'fullscreen-exit' ? 'low' : 'mid', KIND_AR[d.type]);
        else if (d.type === 'resumed') add(d, 'low', 'أعاد الدخول للاختبار');
      }
      // outside the exam page right now (from the live pulse)
      const outNow = status === 'active' && hb && hb.away && seen < 60000;
      if (outNow) alerts.push({ id: `${a.id}:out:${hb.awaySince}`, t: hb.awaySince || hb.t, level: 'high', attemptId: a.id, name: a.name, live: true,
        text: `${hb.why === 'split' ? 'قسّم الشاشة' : 'خارج صفحة الاختبار'} الآن — منذ ${mmss(now - new Date(hb.awaySince || hb.t).getTime())}، على السؤال ${hb.q || '؟'}` });
      const mine = alerts.filter((x) => x.attemptId === a.id);
      return {
        id: a.id, name: a.name, status, anytime: !!a.anytime,
        device: /iPad|Macintosh.*Mobile|Tablet|Android(?!.*Mobile)/i.test(a.ua || '') ? 'تابلت' : /Mac|Windows|Linux|CrOS/i.test(a.ua || '') ? 'لابتوب' : 'جهاز',
        answered: a.submittedAt ? Object.keys(a.answers || {}).length : hb ? hb.answered : 0, total, part: hb ? hb.part : 0, q: hb ? hb.q : 0,
        locked: (a.locked || []).length, deadline: a.startedAt ? iso(deadlineOf(e, a)) : null, submittedAt: a.submittedAt || null,
        lastSeen: hb ? hb.t : null, signal: status !== 'active' ? 'n/a' : !hb || seen > 60000 ? 'lost' : 'ok', outNow: !!outNow, why: outNow ? hb.why : undefined,
        risk: mine.reduce((n, x) => n + (x.level === 'high' ? 3 : x.level === 'mid' ? 1 : 0), 0),
      };
    });
    alerts.sort((x, y) => String(y.t).localeCompare(String(x.t)));
    return { now, exam: { id: e.id, title: e.title, openAt: e.openAt, closeAt: e.closeAt, durationMin: e.durationMin, lockAwaySec: lockSec(e) }, trainees, alerts: alerts.slice(0, 300) };
  }

  async function publicApi(req, p) {
    const m = req.method;
    if (p[0] !== 'exam') return null;

    if (p[1] === 'list' && m === 'GET') {
      const all = await db.all('exams');
      return json(200, all.filter((e) => !e.hidden).map(publicInfo));
    }

    if (p[1] && !p[2] && m === 'GET') return json(200, publicInfo(await getExam(p[1])));

    // Live proctor view behind a secret, revocable link (no sign-in, e.g. on the proctor's phone).
    if (p[1] && p[2] === 'proctor' && p[3] && m === 'GET') {
      const e = await getExam(p[1]);
      const ok = e.proctorToken && p[3].length === e.proctorToken.length && crypto.timingSafeEqual(Buffer.from(p[3]), Buffer.from(e.proctorToken));
      if (!ok) throw new AppError(404, 'This proctor link is not valid or has been revoked.');
      return json(200, await liveData(e));
    }
    // Read-only review for an outside reviewer: the full exam with the key, behind a secret, revocable link.
    if (p[1] && p[2] === 'review' && p[3] && m === 'GET') {
      const e = await getExam(p[1]);
      const ok = e.reviewToken && p[3].length === e.reviewToken.length && crypto.timingSafeEqual(Buffer.from(p[3]), Buffer.from(e.reviewToken));
      if (!ok) throw new AppError(404, 'This review link is not valid or has been revoked.');
      return json(200, {
        title: e.title, level: e.level, course: e.course, durationMin: e.durationMin, openAt: e.openAt, groups: e.groups, parts: e.parts,
        items: e.items.filter((it) => !it.excluded).map(({ id: qid, part, group, text, table, options, answer, excluded, keyNote, keyUnverified }) => ({ id: qid, part, group, text, table, options, answer, excluded: !!excluded, keyNote, keyUnverified: !!keyUnverified })),
      });
    }

    // With the right password, the list of allowed names (names only — never ID numbers) for suggestions.
    if (p[1] && p[2] === 'names' && m === 'POST') {
      const e = await getExam(p[1]);
      const b = await readJson(req);
      if (!passOk(e, b.password)) throw new AppError(403, 'Incorrect exam password');
      return json(200, { names: (e.roster || []).map((x) => x.name).sort((a, c) => a.localeCompare(c, 'ar')) });
    }

    if (p[1] && p[2] === 'start' && m === 'POST') {
      const e = await getExam(p[1]);
      const b = await readJson(req);
      if (!passOk(e, b.password)) throw new AppError(403, 'Incorrect exam password');
      let name = str(b.name, 120).replace(/\s+/g, ' ');
      let scfhs = str(b.scfhs, 30).replace(/\s+/g, '').toUpperCase();
      const restricted = e.roster && e.roster.length && !(await isAdmin(req));
      if (restricted) {
        // Only trainees on the list: the name must match an entry and the ID number must be that entry's.
        const nid = digits(b.nid || b.scfhs);
        const entry = e.roster.find((x) => nameKey(x.name) === nameKey(name));
        if (!entry) throw new AppError(403, 'هذا الاسم غير موجود في قائمة المختبرين. اختر اسمك من الاقتراحات أو راجع المشرف.');
        if (!nid || nid !== entry.nid) throw new AppError(403, 'رقم الهوية لا يطابق الاسم المسجل. تأكد منه أو راجع المشرف.');
        name = entry.name; scfhs = entry.nid;
      } else {
        if (name.split(' ').length < 3) throw new AppError(400, 'Enter your full name (at least three names)');
        scfhs = digits(b.nid || b.scfhs);
        if (scfhs.length !== 10) throw new AppError(400, 'Enter your national ID number (10 digits)');
      }
      // Admins can preview the exam at any time; preview attempts are kept out of results and analysis.
      const preview = await isAdmin(req);
      if (!preview && noPhones(e) && isPhone(req.header('user-agent'), b.screen)) throw new AppError(403, 'This exam must be taken on a laptop or a tablet, not a phone.');
      if (preview) for (const old of (await db.find('attempts', 'scfhs', scfhs)).filter((a) => a.examId === e.id && a.preview)) await removeAttempt(old);
      const [prev] = (await db.find('attempts', 'scfhs', scfhs)).filter((a) => a.examId === e.id);
      if (prev) {
        await autoFinish(e, prev);
        if (prev.submittedAt) return json(200, result(e, prev));
        // Resume an unfinished attempt (refresh, lost connection, another device) — the clock keeps running.
        if (nameKey(prev.name) !== nameKey(name)) throw new AppError(409, 'This ID number already has an attempt under a different name. Contact the exam supervisor.');
        if (isSuper(e, b.password) && !prev.startedAt && !prev.anytime) { prev.anytime = true; await db.put('attempts', prev); }
        await db.put('examEvents', { id: id(), attemptId: prev.id, t: new Date().toISOString(), type: 'resumed' });
        // signed in again from a different kind of device (browser/OS): worth a look by the proctor
        const fam = (ua) => String(ua || '').replace(/[\d._]+/g, '').slice(0, 120);
        if (prev.ua && fam(prev.ua) !== fam(req.header('user-agent'))) await db.put('examEvents', { id: id(), attemptId: prev.id, t: new Date().toISOString(), type: 'device' });
        return json(200, await startPayload(e, prev));
      }
      const anytime = !preview && isSuper(e, b.password);
      const st = preview || anytime ? 'open' : examState(e);
      if (st === 'upcoming') throw new AppError(403, 'The exam has not opened yet');
      if (st === 'closed') throw new AppError(403, 'The exam is closed');
      if (!preview && !anytime && new Date(e.closeAt) - Date.now() < 60000) throw new AppError(403, 'The exam is about to close');
      const order = makeOrder(e);
      const a = {
        // With "prepare" the exam is only downloaded; the clock starts with "begin". Older pages start at once.
        id: id(), examId: e.id, token: id(24), name, scfhs, preparedAt: new Date().toISOString(), startedAt: b.prepare ? null : new Date().toISOString(), order,
        optOrder: Object.fromEntries(e.items.map((it) => [it.id, it.fixedOptions ? it.options.map((o) => o.id) : shuffle(it.options.map((o) => o.id))])),
        answers: {}, events: [], focusLost: 0, preview, ...(anytime ? { anytime: true } : {}), ua: str(req.header('user-agent'), 200),
      };
      await db.put('attempts', a);
      return json(200, await startPayload(e, a));
    }

    if (p[1] === 'attempt' && m === 'POST') {
      const b = await readJson(req);
      const a = await attemptByToken(b.token);
      const e = await getExam(a.examId);
      await autoFinish(e, a);
      // The trainee's email for receiving the result (asked at the end; accepted after submitting too).
      if (p[2] === 'email') {
        const email = str(b.email, 200).trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new AppError(400, 'Enter a valid email address');
        a.email = email; a.emailAt = new Date().toISOString();
        await db.put('attempts', a);
        return json(200, { ok: true, email });
      }
      // Start the clock. Sent when Start is pressed, or later from the device's outbox with the time it was pressed.
      // Live state for the proctor (sent every few seconds and at once when the trainee leaves or returns).
      // One record per attempt, replaced each time; nothing here affects the answers or the score.
      if (p[2] === 'hb') {
        if (!a.submittedAt) {
          const n = (v, max) => Math.max(0, Math.min(max, Math.round(Number(v) || 0)));
          await db.put('examEvents', { id: `${a.id}:hb`, attemptId: a.id, type: 'hb', t: new Date().toISOString(),
            answered: n(b.answered, 500), total: n(b.total, 500), q: n(b.q, 500), part: n(b.part, 20), locked: n(b.locked, 500),
            away: !!b.away, why: ['app', 'window', 'split'].includes(b.why) ? b.why : undefined, awaySince: b.away ? new Date(Math.min(Date.now(), Number(b.awaySince) || Date.now())).toISOString() : undefined });
        }
        return json(200, { ok: true, deadline: a.startedAt ? iso(deadlineOf(e, a)) : null, serverNow: Date.now() });
      }
      // Is this device's copy of the attempt still valid (not reset by the admin)? Used before reopening it.
      if (p[2] === 'status') return json(200, { ok: true, begun: !!a.startedAt, submitted: !!a.submittedAt, deadline: a.startedAt ? iso(deadlineOf(e, a)) : null, openAt: anyTime(a) ? null : e.openAt, closeAt: anyTime(a) ? null : e.closeAt, durationMin: e.durationMin, serverNow: Date.now() });
      if (p[2] === 'begin') {
        // The clock can only start inside the exam window (admin previews excepted).
        const pressed = Number.isFinite(Number(b.at)) ? Math.min(Number(b.at), Date.now()) : Date.now();
        if (!a.startedAt && !anyTime(a) && pressed < new Date(e.openAt).getTime()) throw new AppError(403, 'The exam has not opened yet');
        if (!a.startedAt && !anyTime(a) && pressed > new Date(e.closeAt).getTime()) throw new AppError(403, 'The exam is closed');
        if (!a.startedAt) {
          const t = Number(b.at), lo = new Date(a.preparedAt || Date.now()).getTime();
          a.startedAt = new Date(Number.isFinite(t) ? Math.min(Date.now(), Math.max(lo, t)) : Date.now()).toISOString();
          await db.put('attempts', a);
        }
        return json(200, { deadline: iso(deadlineOf(e, a)), startedAt: a.startedAt });
      }
      if (!a.startedAt && ['answer', 'next-part', 'submit'].includes(p[2])) return json(409, { message: 'The exam has not been started' });
      // Answers held offline may arrive after the attempt was auto-submitted; those chosen in time still count.
      const reopen = a.submittedAt && a.autoSubmitted && madeInTime(e, a, b);
      if (p[2] === 'answer') {
        if (a.submittedAt && !reopen) return json(409, { message: 'The exam has already been submitted', ...result(e, a) });
        const it = e.items.find((i) => i.id === b.itemId);
        if (it && partOf(e, it) !== curPart(e, a).id) return json(409, { message: 'This part is finished and cannot be changed' });
        if (it && (a.locked || []).includes(it.id)) return json(409, { message: 'This question is locked because the exam page was left' });
        const valid = (oid) => it && it.options.some((o) => o.id === oid);
        if (!it) throw new AppError(400, 'Invalid answer');
        if (it.multi) {
          if (b.optionId !== null && !(Array.isArray(b.optionId) && b.optionId.length <= it.options.length && b.optionId.every(valid))) throw new AppError(400, 'Invalid answer');
          if (Array.isArray(b.optionId) && !b.optionId.length) b.optionId = null;
        } else if (b.optionId !== null && !valid(b.optionId)) throw new AppError(400, 'Invalid answer');
        if (Date.now() > deadlineOf(e, a) + SYNC_GRACE_MS && !madeInTime(e, a, b)) return json(409, { message: 'Time is up' });
        if (Date.now() > deadlineOf(e, a) + GRACE_MS) await db.put('examEvents', { id: id(), attemptId: a.id, t: new Date().toISOString(), type: 'late-sync' });
        // seq comes from the browser, which numbers its saves; an older save never replaces a newer one.
        const seq = Number(b.seq) || 0;
        const docId = `${a.id}:${it.id}`;
        const old = await db.get('examAnswers', docId);
        if (!old || (old.seq || 0) <= seq) await db.put('examAnswers', { id: docId, attemptId: a.id, itemId: it.id, optionId: b.optionId, seq, t: new Date().toISOString() });
        if (reopen) await regrade(e, a);
        return json(200, { ok: true });
      }
      if (p[2] === 'event') {
        // "away": the trainee left the exam page while on a question, for ms milliseconds (sent from the device's
        // outbox when they come back, so it also arrives after a connection drop or after the exam was submitted).
        if (b.type === 'away') {
          const it = e.items.find((i) => i.id === b.itemId);
          const ms = Math.round(Number(b.ms));
          const t = madeAt(a, b);
          if (it && Number.isFinite(ms) && ms >= 0) {
            await db.put('examEvents', { id: id(), attemptId: a.id, t: new Date(t ?? Date.now()).toISOString(), type: 'away', itemId: it.id, ms: Math.min(ms, 6 * 3600 * 1000), why: ['app', 'window', 'split'].includes(b.why) ? b.why : undefined });
            // Away long enough: the question on screen is locked; its answer stays as it was.
            if (lockSec(e) && ms >= lockSec(e) * 1000 && !(a.locked || []).includes(it.id)) { a.locked = [...(a.locked || []), it.id]; await db.put('attempts', a); }
          }
          return json(200, { ok: true });
        }
        const type = ['blur', 'hidden', 'copy', 'paste', 'contextmenu', 'fullscreen-exit', 'print', 'devtools', 'screenshot'].includes(b.type) ? b.type : 'other';
        if (!a.submittedAt) await db.put('examEvents', { id: id(), attemptId: a.id, t: new Date().toISOString(), type });
        return json(200, { ok: true });
      }
      // Finish the current part and move to the next; the finished part is locked.
      if (p[2] === 'next-part') {
        if (a.submittedAt && !reopen) return json(409, { message: 'The exam has already been submitted', ...result(e, a) });
        if (!a.submittedAt && Date.now() > deadlineOf(e, a) + SYNC_GRACE_MS && !madeInTime(e, a, b)) return json(409, { message: 'Time is up' });
        const ps = partsOf(e);
        // A repeated request (its answer was lost on the way) does not skip a part.
        if (b.from !== undefined && (a.partIndex || 0) > Number(b.from)) return json(200, { questions: paper(e, a), part: partInfo(e, a), answers: await loadAnswers(a), deadline: iso(deadlineOf(e, a)) });
        if ((a.partIndex || 0) >= ps.length - 1) throw new AppError(400, 'This is the last part');
        a.partIndex = (a.partIndex || 0) + 1;
        a.partsDone = [...(a.partsDone || []), { id: ps[a.partIndex - 1].id, at: new Date().toISOString() }];
        await db.put('attempts', a);
        return json(200, { questions: paper(e, a), part: partInfo(e, a), answers: await loadAnswers(a), deadline: iso(deadlineOf(e, a)) });
      }
      if (p[2] === 'submit') return json(200, result(e, await finish(e, a)));
    }
    return null;
  }

  async function adminApi(req, p) {
    const m = req.method;
    if (p[0] !== 'admin' || p[1] !== 'exams') return null;
    if (!p[2] && m === 'GET') {
      const exams = await db.all('exams');
      return json(200, await Promise.all(exams.map(async (e) => {
        const at = (await db.all('attempts')).filter((a) => a.examId === e.id && !a.preview);
        return { ...publicInfo(e), attempts: at.length, submitted: at.filter((a) => a.submittedAt).length };
      })));
    }
    const e = await getExam(p[2]);
    // the live proctor view is polled every few seconds: answer it before the heavier work below
    if (p[3] === 'live' && m === 'GET') return json(200, await liveData(e));
    const all = (await db.all('attempts')).filter((a) => a.examId === e.id);
    for (const a of all) await autoFinish(e, a);
    const attempts = all.filter((a) => !a.preview);
    for (const a of attempts) {
      if (!a.submittedAt) a.answers = await loadAnswers(a);
      a.events = await loadEvents(a);
      a.focusLost = a.events.filter((x) => x.type === 'hidden' || x.type === 'away').length;
      a.away = a.events.filter((x) => x.type === 'away').map((x) => ({ itemId: x.itemId, ms: x.ms, t: x.t, why: x.why }));
      a.splitScreen = a.away.filter((x) => x.why === 'split').length;
      a.awayMs = a.away.reduce((n, x) => n + (x.ms || 0), 0);
      a.resumes = a.events.filter((x) => x.type === 'resumed').length;
      a.lateSync = a.events.filter((x) => x.type === 'late-sync').length;
    }

    if (!p[3] && m === 'GET') {
      return json(200, {
        exam: e, state: examState(e), analysis: analyse(e, attempts),
        attempts: attempts.map(({ token, ...a }) => ({ ...a, receipt: a.submittedAt ? receiptOf(a) : undefined, deadline: iso(deadlineOf(e, a)) })).sort((x, y) => (y.percent ?? -1) - (x.percent ?? -1)),
      });
    }
    // Exam settings
    if (!p[3] && m === 'POST') {
      const b = await readJson(req);
      if (b.openAt) e.openAt = new Date(b.openAt).toISOString();
      if (b.closeAt) e.closeAt = new Date(b.closeAt).toISOString();
      if (b.durationMin) e.durationMin = Math.min(600, Math.max(5, Number(b.durationMin) || 60));
      if (typeof b.password === 'string' && b.password.trim()) e.password = b.password.trim();
      if (typeof b.roster === 'string') {
        const { roster, bad } = parseRoster(b.roster);
        if (bad.length) throw new AppError(400, `Could not read these lines (each needs a name and an ID number): ${bad.slice(0, 3).join(' / ')}`);
        const dup = roster.find((x, i) => roster.findIndex((y) => y.nid === x.nid || nameKey(y.name) === nameKey(x.name)) !== i);
        if (dup) throw new AppError(400, `Listed twice: ${dup.name}`);
        e.roster = roster;
      }
      if (b.showScore !== undefined) e.showScore = !!b.showScore;
      if (b.noPhones !== undefined) e.noPhones = !!b.noPhones;
      if (b.extraMin !== undefined) e.extraMin = Math.min(120, Math.max(0, Math.round(Number(b.extraMin) || 0)));
      if (typeof b.superPassword === 'string') {
        const sp = b.superPassword.trim();
        if (sp && sp === e.password) throw new AppError(400, 'The super password must be different from the exam password');
        e.superPassword = sp || undefined;
      }
      if (b.lockAwaySec !== undefined) e.lockAwaySec = Math.min(600, Math.max(0, Math.round(Number(b.lockAwaySec) || 0)));
      if (b.passMark !== undefined) e.passMark = b.passMark === '' || b.passMark === null ? null : Math.min(100, Math.max(0, Number(b.passMark)));
      if (new Date(e.openAt) >= new Date(e.closeAt)) throw new AppError(400, 'Close time must be after open time');
      await db.put('exams', e);
      return json(200, { ok: true });
    }
    if (p[3] === 'proctor-link' && m === 'POST') {
      const b = await readJson(req);
      if (b.revoke) delete e.proctorToken; else e.proctorToken = id(16);
      await db.put('exams', e);
      return json(200, { token: e.proctorToken || null });
    }
    // Create or revoke the reviewer link
    if (p[3] === 'review-link' && m === 'POST') {
      const b = await readJson(req);
      if (b.revoke) delete e.reviewToken; else e.reviewToken = id(16);
      await db.put('exams', e);
      return json(200, { token: e.reviewToken || null });
    }
    // Exclude / restore a question, or change its key — every submitted attempt is re-graded.
    if (p[3] === 'items' && p[4] && m === 'POST') {
      const it = e.items.find((i) => i.id === p[4]);
      if (!it) throw new AppError(404, 'Question not found');
      const b = await readJson(req);
      if (typeof b.excluded === 'boolean') it.excluded = b.excluded;
      if (Array.isArray(b.answer) && it.multi && b.answer.length && b.answer.every((x) => it.options.some((o) => o.id === x))) it.answer = b.answer;
      else if (typeof b.answer === 'string' && !it.multi && it.options.some((o) => o.id === b.answer)) { it.answer = b.answer; delete it.keyUnverified; }
      await db.put('exams', e);
      for (const a of attempts.filter((x) => x.submittedAt)) { const { events, focusLost, resumes, away, awayMs, lateSync, splitScreen, ...rec } = a; Object.assign(rec, grade(e, rec)); await db.put('attempts', rec); }
      return json(200, { ok: true });
    }
    // Delete an attempt so the trainee can sit the exam again
    if (p[3] === 'attempts' && p[4] && m === 'DELETE') {
      const a = attempts.find((x) => x.id === p[4]);
      if (!a) throw new AppError(404, 'Attempt not found');
      await removeAttempt(a);
      return json(200, { ok: true });
    }
    return null;
  }

  return { publicApi, adminApi };
}

module.exports = { makeExamApi, normName, parseRoster, isCorrect, grade, analyse, shuffle, examState };
