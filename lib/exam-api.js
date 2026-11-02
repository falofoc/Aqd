'use strict';
// Online exams: no account needed (full name + SCFHS number + exam password).
// Correct answers never leave the server; question and option order is shuffled per attempt;
// the time limit is enforced on the server; answers are saved as they are chosen.

const crypto = require('node:crypto');

const GRACE_MS = 30 * 1000; // network delay allowed after the deadline
const MAX_EVENTS = 300;

function shuffle(a) {
  const x = a.slice();
  for (let i = x.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
}

function examState(e, t = Date.now()) {
  if (t < new Date(e.openAt)) return 'upcoming';
  if (t > new Date(e.closeAt)) return 'closed';
  return 'open';
}

// Items in groups (shared stem/figures) stay together and in their own order; groups and single items are shuffled.
function makeOrder(e) {
  const blocks = [];
  const seen = {};
  for (const it of e.items) {
    if (!it.group) blocks.push([it.id]);
    else if (seen[it.group]) seen[it.group].push(it.id);
    else blocks.push((seen[it.group] = [it.id]));
  }
  return shuffle(blocks).flat();
}

function grade(e, a) {
  const live = e.items.filter((it) => !it.excluded);
  const correct = live.filter((it) => a.answers[it.id] === it.answer).length;
  const percent = live.length ? Math.round((correct / live.length) * 1000) / 10 : 0;
  return { score: correct, total: live.length, percent, passed: e.passMark ? percent >= e.passMark : undefined };
}

// Item analysis: difficulty, discrimination (upper vs lower 27%), distractors, KR-20 reliability.
function analyse(e, attempts) {
  const done = attempts.filter((a) => a.submittedAt);
  const live = e.items.filter((it) => !it.excluded);
  const totals = done.map((a) => live.filter((it) => a.answers[it.id] === it.answer).length);
  const ranked = done.map((a, i) => ({ a, s: totals[i] })).sort((x, y) => y.s - x.s);
  const k = Math.max(1, Math.round(done.length * 0.27));
  const upper = ranked.slice(0, k).map((x) => x.a), lower = ranked.slice(-k).map((x) => x.a);
  const items = e.items.map((it) => {
    const n = done.length;
    const right = done.filter((a) => a.answers[it.id] === it.answer).length;
    const p = n ? right / n : null;
    const pu = upper.length ? upper.filter((a) => a.answers[it.id] === it.answer).length / upper.length : 0;
    const pl = lower.length ? lower.filter((a) => a.answers[it.id] === it.answer).length / lower.length : 0;
    const D = n >= 4 ? Math.round((pu - pl) * 100) / 100 : null;
    const counts = Object.fromEntries(it.options.map((o) => [o.id, done.filter((a) => a.answers[it.id] === o.id).length]));
    const flags = [];
    if (n >= 4) {
      if (p >= 0.9) flags.push('Very easy');
      if (p <= 0.3) flags.push('Very hard');
      if (D !== null && D < 0) flags.push('Negative discrimination — check the key');
      else if (D !== null && D < 0.2) flags.push('Poor discrimination');
      const top = Object.entries(counts).sort((x, y) => y[1] - x[1])[0];
      if (top && top[0] !== it.answer && top[1] > right) flags.push('A wrong option was chosen more than the key');
    }
    return { id: it.id, p: p === null ? null : Math.round(p * 100) / 100, D, counts, unanswered: n - Object.values(counts).reduce((s, c) => s + c, 0), flags };
  });
  let kr20 = null;
  if (done.length >= 4 && live.length > 1) {
    const mean = totals.reduce((s, x) => s + x, 0) / totals.length;
    const varT = totals.reduce((s, x) => s + (x - mean) ** 2, 0) / totals.length;
    const pq = live.reduce((s, it) => { const p = done.filter((a) => a.answers[it.id] === it.answer).length / done.length; return s + p * (1 - p); }, 0);
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
  const publicInfo = (e) => ({ id: e.id, title: e.title, level: e.level, openAt: e.openAt, closeAt: e.closeAt, durationMin: e.durationMin, count: e.items.filter((i) => !i.excluded).length, state: examState(e) });
  // Questions as the trainee sees them: no answers, no notes, shuffled options.
  const paper = (e, a) => a.order.map((qid) => e.items.find((i) => i.id === qid)).filter((it) => it && !it.excluded).map((it) => ({
    id: it.id, text: it.text, table: it.table, group: it.group,
    stem: it.group ? e.groups[it.group].stem : undefined, images: it.group ? e.groups[it.group].images : undefined,
    options: a.optOrder[it.id].map((oid) => it.options.find((o) => o.id === oid)).filter(Boolean).map((o) => ({ id: o.id, text: o.text })),
  }));
  const deadlineOf = (e, a) => (a.preview ? new Date(a.startedAt).getTime() + e.durationMin * 60000 : Math.min(new Date(a.startedAt).getTime() + e.durationMin * 60000, new Date(e.closeAt).getTime()));

  async function finish(e, a) {
    if (a.submittedAt) return a;
    Object.assign(a, grade(e, a), { submittedAt: new Date().toISOString() });
    await db.put('attempts', a);
    return a;
  }
  // Attempts whose time ran out are submitted automatically with the answers saved so far.
  async function autoFinish(e, a) {
    if (!a.submittedAt && Date.now() > deadlineOf(e, a) + GRACE_MS) { a.autoSubmitted = true; await finish(e, a); }
    return a;
  }
  async function attemptByToken(token) {
    const [a] = await db.find('attempts', 'token', str(token, 100));
    if (!a) throw new AppError(401, 'Your exam session was not found. Enter your details again to continue.');
    return a;
  }
  const result = (e, a) => ({ submitted: true, name: a.name, score: a.score, total: a.total, percent: a.percent, passed: a.passed, autoSubmitted: !!a.autoSubmitted, submittedAt: a.submittedAt });

  async function publicApi(req, p) {
    const m = req.method;
    if (p[0] !== 'exam') return null;

    if (p[1] === 'list' && m === 'GET') {
      const all = await db.all('exams');
      return json(200, all.filter((e) => !e.hidden).map(publicInfo));
    }

    if (p[1] && !p[2] && m === 'GET') return json(200, publicInfo(await getExam(p[1])));

    if (p[1] && p[2] === 'start' && m === 'POST') {
      const e = await getExam(p[1]);
      const b = await readJson(req);
      const name = str(b.name, 120).replace(/\s+/g, ' ');
      const scfhs = str(b.scfhs, 30).replace(/\s+/g, '').toUpperCase();
      if (name.split(' ').length < 3) throw new AppError(400, 'Enter your full name (at least three names)');
      if (scfhs.length < 4) throw new AppError(400, 'Enter your SCFHS number');
      if (String(b.password || '') !== e.password) throw new AppError(403, 'Incorrect exam password');
      // Admins can preview the exam at any time; preview attempts are kept out of results and analysis.
      const preview = await isAdmin(req);
      if (preview) for (const old of (await db.find('attempts', 'scfhs', scfhs)).filter((a) => a.examId === e.id && a.preview)) await db.del('attempts', old.id);
      const [prev] = (await db.find('attempts', 'scfhs', scfhs)).filter((a) => a.examId === e.id);
      if (prev) {
        await autoFinish(e, prev);
        if (prev.submittedAt) return json(200, result(e, prev));
        // Resume an unfinished attempt (refresh, lost connection, another device) — the clock keeps running.
        if (prev.name.toLowerCase() !== name.toLowerCase()) throw new AppError(409, 'This SCFHS number already has an attempt under a different name. Contact the exam supervisor.');
        prev.events = [...(prev.events || []), { t: new Date().toISOString(), type: 'resumed' }].slice(-MAX_EVENTS);
        prev.resumes = (prev.resumes || 0) + 1;
        await db.put('attempts', prev);
        return json(200, { token: prev.token, deadline: new Date(deadlineOf(e, prev)).toISOString(), questions: paper(e, prev), answers: prev.answers, name: prev.name, title: e.title });
      }
      const st = preview ? 'open' : examState(e);
      if (st === 'upcoming') throw new AppError(403, 'The exam has not opened yet');
      if (st === 'closed') throw new AppError(403, 'The exam is closed');
      if (!preview && new Date(e.closeAt) - Date.now() < 60000) throw new AppError(403, 'The exam is about to close');
      const order = makeOrder(e);
      const a = {
        id: id(), examId: e.id, token: id(24), name, scfhs, startedAt: new Date().toISOString(), order,
        optOrder: Object.fromEntries(e.items.map((it) => [it.id, it.fixedOptions ? it.options.map((o) => o.id) : shuffle(it.options.map((o) => o.id))])),
        answers: {}, events: [], focusLost: 0, preview, ua: str(req.header('user-agent'), 200),
      };
      await db.put('attempts', a);
      return json(200, { token: a.token, deadline: new Date(deadlineOf(e, a)).toISOString(), questions: paper(e, a), answers: {}, name, title: e.title });
    }

    if (p[1] === 'attempt' && m === 'POST') {
      const b = await readJson(req);
      const a = await attemptByToken(b.token);
      const e = await getExam(a.examId);
      await autoFinish(e, a);
      if (p[2] === 'answer') {
        if (a.submittedAt) return json(409, { message: 'The exam has already been submitted', ...result(e, a) });
        const it = e.items.find((i) => i.id === b.itemId);
        if (!it || (b.optionId !== null && !it.options.some((o) => o.id === b.optionId))) throw new AppError(400, 'Invalid answer');
        if (b.optionId === null) delete a.answers[it.id]; else a.answers[it.id] = b.optionId;
        await db.put('attempts', a);
        return json(200, { ok: true, saved: Object.keys(a.answers).length });
      }
      if (p[2] === 'event') {
        const type = ['blur', 'hidden', 'copy', 'paste', 'contextmenu', 'fullscreen-exit', 'print', 'devtools'].includes(b.type) ? b.type : 'other';
        if (!a.submittedAt) {
          a.events = [...(a.events || []), { t: new Date().toISOString(), type }].slice(-MAX_EVENTS);
          if (type === 'hidden' || type === 'blur') a.focusLost = (a.focusLost || 0) + 1;
          await db.put('attempts', a);
        }
        return json(200, { ok: true, focusLost: a.focusLost });
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
    const all = (await db.all('attempts')).filter((a) => a.examId === e.id);
    for (const a of all) await autoFinish(e, a);
    const attempts = all.filter((a) => !a.preview);

    if (!p[3] && m === 'GET') {
      return json(200, {
        exam: e, state: examState(e), analysis: analyse(e, attempts),
        attempts: attempts.map(({ token, ...a }) => ({ ...a, deadline: new Date(deadlineOf(e, a)).toISOString() })).sort((x, y) => (y.percent ?? -1) - (x.percent ?? -1)),
      });
    }
    // Exam settings
    if (!p[3] && m === 'POST') {
      const b = await readJson(req);
      if (b.openAt) e.openAt = new Date(b.openAt).toISOString();
      if (b.closeAt) e.closeAt = new Date(b.closeAt).toISOString();
      if (b.durationMin) e.durationMin = Math.min(600, Math.max(5, Number(b.durationMin) || 60));
      if (typeof b.password === 'string' && b.password.trim()) e.password = b.password.trim();
      if (b.passMark !== undefined) e.passMark = b.passMark === '' || b.passMark === null ? null : Math.min(100, Math.max(0, Number(b.passMark)));
      if (new Date(e.openAt) >= new Date(e.closeAt)) throw new AppError(400, 'Close time must be after open time');
      await db.put('exams', e);
      return json(200, { ok: true });
    }
    // Exclude / restore a question, or change its key — every submitted attempt is re-graded.
    if (p[3] === 'items' && p[4] && m === 'POST') {
      const it = e.items.find((i) => i.id === p[4]);
      if (!it) throw new AppError(404, 'Question not found');
      const b = await readJson(req);
      if (typeof b.excluded === 'boolean') it.excluded = b.excluded;
      if (b.answer && it.options.some((o) => o.id === b.answer)) { it.answer = b.answer; delete it.keyUnverified; }
      await db.put('exams', e);
      for (const a of attempts.filter((x) => x.submittedAt)) { Object.assign(a, grade(e, a)); await db.put('attempts', a); }
      return json(200, { ok: true });
    }
    // Delete an attempt so the trainee can sit the exam again
    if (p[3] === 'attempts' && p[4] && m === 'DELETE') {
      if (!attempts.some((a) => a.id === p[4])) throw new AppError(404, 'Attempt not found');
      await db.del('attempts', p[4]);
      return json(200, { ok: true });
    }
    return null;
  }

  return { publicApi, adminApi };
}

module.exports = { makeExamApi, grade, analyse, shuffle, examState };
