'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp, windowState, timeliness } = require('../server');

test('window state and timeliness', () => {
  const r = { openAt: '2026-01-01T00:00:00Z', closeAt: '2026-01-31T20:59:00Z', lateDays: 14 };
  assert.equal(windowState(r, new Date('2025-12-31')), 'upcoming');
  assert.equal(windowState(r, new Date('2026-01-15')), 'open');
  assert.equal(windowState(r, new Date('2026-02-05')), 'late');
  assert.equal(windowState(r, new Date('2026-03-01')), 'closed');
  assert.equal(timeliness(r, '2026-01-30'), 10);
  assert.equal(timeliness(r, '2026-02-04'), 5);
  assert.equal(timeliness(r, '2026-02-12'), 0);
});

test('register → activate → submit → grade', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-'));
  const srv = createApp({ dataDir: dir, adminEmail: 'a@x.sa', adminPassword: 'adminpass' });
  await new Promise((r) => srv.listen(0, r));
  const base = `http://localhost:${srv.address().port}/api/`;
  const call = async (p, { body, cookie, method, headers = {} } = {}) => {
    const raw = Buffer.isBuffer(body);
    const r = await fetch(base + p, { method: method || (body ? 'POST' : 'GET'), body: raw ? body : body && JSON.stringify(body),
      headers: { 'X-Requested-With': 'portal', ...(cookie ? { cookie } : {}), ...(raw ? {} : { 'Content-Type': 'application/json' }), ...headers } });
    return { status: r.status, data: await r.json().catch(() => null), cookie: (r.headers.get('set-cookie') || '').split(';')[0] };
  };
  try {
    assert.equal((await call('register', { body: { name: 'T', email: 't@x.sa', password: '12345678', level: 'R1', scfhs: '1' } })).status, 201);
    assert.equal((await call('login', { body: { email: 't@x.sa', password: '12345678' } })).status, 403, 'pending cannot log in');
    const admin = (await call('login', { body: { email: 'a@x.sa', password: 'adminpass' } })).cookie;
    const users = (await call('admin/users', { cookie: admin })).data;
    await call('admin/users/' + users[0].id, { cookie: admin, body: { status: 'active' } });
    const tr = (await call('login', { body: { email: 't@x.sa', password: '12345678' } })).cookie;
    assert.ok(tr);

    // متطلب مفتوح الآن
    const now = Date.now();
    const rq = (await call('admin/requirements', { cookie: admin, body: { title: 'Test', level: 'R1', rubric: [{ name: 'A', max: 90 }], fileTypes: ['pdf'], openAt: new Date(now - 864e5).toISOString(), closeAt: new Date(now + 864e5).toISOString(), published: true } })).data;
    const mine = (await call('requirements', { cookie: tr })).data;
    assert.ok(mine.every((r) => r.level === 'R1'));
    assert.ok(mine.some((r) => r.id === rq.id && r.state === 'open'));

    assert.equal((await call(`requirements/${rq.id}/submit`, { cookie: tr, body: Buffer.from('x'), headers: { 'X-File-Name': 'a.exe' } })).status, 415);
    const sub = (await call(`requirements/${rq.id}/submit`, { cookie: tr, body: Buffer.from('%PDF'), headers: { 'X-File-Name': 'a.pdf' } })).data;
    assert.equal(sub.fileName, 'a.pdf');
    const g = (await call('admin/grade/' + sub.id, { cookie: admin, body: { ratings: ['adequate'] } })).data;
    assert.equal(g.grade.total, 73);
    assert.equal((await call(`requirements/${rq.id}/submit`, { cookie: tr, body: Buffer.from('%PDF'), headers: { 'X-File-Name': 'b.pdf' } })).status, 409);
    assert.equal((await call('admin/users', { cookie: tr })).status, 403);
  } finally { srv.close(); }
});

test('admin can close and reopen registration per level', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-'));
  const srv = createApp({ dataDir: dir, adminEmail: 'a@x.sa', adminPassword: 'adminpass' });
  await new Promise((r) => srv.listen(0, r));
  const base = `http://localhost:${srv.address().port}/api/`;
  const call = async (p, body, cookie) => {
    const r = await fetch(base + p, { method: body ? 'POST' : 'GET', body: body && JSON.stringify(body), headers: { 'X-Requested-With': 'portal', 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) } });
    return { status: r.status, data: await r.json(), cookie: (r.headers.get('set-cookie') || '').split(';')[0] };
  };
  const reg = (level, email) => call('register', { name: 'T', email, password: '12345678', level, scfhs: '1' });
  try {
    assert.deepEqual((await call('registration')).data.closedLevels, ['R4']);
    assert.equal((await reg('R4', 'r4@x.sa')).status, 403);
    assert.equal((await reg('R3', 'r3@x.sa')).status, 201);
    const admin = (await call('login', { email: 'a@x.sa', password: 'adminpass' })).cookie;
    await call('admin/registration', { closedLevels: [] }, admin);
    assert.equal((await reg('R4', 'r4@x.sa')).status, 201);
  } finally { srv.close(); }
});

test('requirements catalog is public and lists only published items', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-'));
  const srv = createApp({ dataDir: dir, adminEmail: 'a@x.sa', adminPassword: 'adminpass' });
  await new Promise((r) => srv.listen(0, r));
  try {
    const r = await fetch(`http://localhost:${srv.address().port}/api/catalog`);
    assert.equal(r.status, 200);
    const { levels, requirements } = await r.json();
    assert.deepEqual(Object.keys(levels), ['R1', 'R2', 'R3', 'R4']);
    assert.equal(requirements.length, 55);
    assert.ok(requirements.every((x) => x.published && x.state));
  } finally { srv.close(); }
});

test('older databases move CAP/CAT/seminars/clinical tools to the year-long window once', async () => {
  const { windowFor, originalLabels } = require('../lib/catalog');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-'));
  const start = async () => { const s = createApp({ dataDir: dir, adminEmail: 'a@x.sa', adminPassword: 'adminpass' }); await new Promise((r) => s.listen(0, r)); await fetch(`http://localhost:${s.address().port}/api/catalog`); s.close(); };
  await start();
  // Rewind to the old schedule, as an earlier version would have seeded it.
  const file = path.join(dir, 'db.json');
  const d = JSON.parse(fs.readFileSync(file));
  const labels = originalLabels();
  for (const r of Object.values(d.requirements)) Object.assign(r, { window: labels[r.id], ...windowFor(labels[r.id], 2026) });
  const cap = Object.values(d.requirements).find((r) => r.type === 'cap');
  const edited = Object.values(d.requirements).find((r) => r.type === 'seminar');
  edited.closeAt = '2027-05-15T20:59:00.000Z'; // the admin changed this one
  delete d.settings.migrations;
  fs.writeFileSync(file, JSON.stringify(d));
  await start();
  const after = JSON.parse(fs.readFileSync(file)).requirements;
  assert.equal(after[cap.id].window, 'OCT–JUL');
  assert.equal(after[cap.id].closeAt, '2027-07-31T20:59:00.000Z');
  assert.equal(after[edited.id].closeAt, '2027-05-15T20:59:00.000Z');
  assert.notEqual(after[Object.values(d.requirements).find((r) => r.type === 'course').id].window, 'OCT–JUL');
});

test('older databases keep only the official list, with its exact titles', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-'));
  const start = async () => { const s = createApp({ dataDir: dir, adminEmail: 'a@x.sa', adminPassword: 'adminpass' }); await new Promise((r) => s.listen(0, r)); await fetch(`http://localhost:${s.address().port}/api/catalog`); s.close(); };
  await start();
  const file = path.join(dir, 'db.json');
  const d = JSON.parse(fs.readFileSync(file));
  const cap = d.requirements['r1-009'];
  const before = { openAt: cap.openAt, closeAt: cap.closeAt };
  cap.title = 'CAP (old title)';
  d.requirements['r1-001'] = { ...cap, id: 'r1-001', title: 'Communicating Science Clearly (online course)' }; // not on the list
  d.requirements['r1-002'] = { ...cap, id: 'r1-002', title: 'COT #1' }; // not on the list, but has a submission
  d.requirements['c-abcd'] = { ...cap, id: 'c-abcd', title: 'Added by admin' };
  d.submissions.s1 = { id: 's1', reqId: 'r1-002', userId: 'u1' };
  d.settings.migrations.done = d.settings.migrations.done.filter((x) => x !== 'official-list');
  fs.writeFileSync(file, JSON.stringify(d));
  await start();
  const after = JSON.parse(fs.readFileSync(file)).requirements;
  assert.equal(after['r1-009'].title, '1 CAP');
  assert.deepEqual({ openAt: after['r1-009'].openAt, closeAt: after['r1-009'].closeAt }, before);
  assert.equal(after['r1-001'], undefined);
  assert.equal(after['r1-002'].published, false);
  assert.equal(after['c-abcd'].title, 'Added by admin');
});

test('multi-item requirements, session note, and reject & resubmit', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-'));
  const srv = createApp({ dataDir: dir, adminEmail: 'a@x.sa', adminPassword: 'adminpass' });
  await new Promise((r) => srv.listen(0, r));
  const base = `http://localhost:${srv.address().port}/api/`;
  const call = async (p, { body, cookie, headers = {} } = {}) => {
    const raw = Buffer.isBuffer(body);
    const r = await fetch(base + p, { method: body ? 'POST' : 'GET', body: raw ? body : body && JSON.stringify(body),
      headers: { 'X-Requested-With': 'portal', ...(cookie ? { cookie } : {}), ...(raw ? {} : { 'Content-Type': 'application/json' }), ...headers } });
    return { status: r.status, data: await r.json().catch(() => null), cookie: (r.headers.get('set-cookie') || '').split(';')[0] };
  };
  try {
    const { requirements } = (await call('catalog')).data;
    const sem = requirements.find((r) => r.id === 'r1-013');
    assert.equal(sem.title, '2 Seminars');
    assert.equal(sem.slots, 2);
    assert.match(sem.note, /current training year/);
    assert.match(requirements.find((r) => r.id === 'r1-009').note, /current training year/); // 1 CAP
    assert.equal(requirements.find((r) => r.id === 'r4-080').slots, 3); // 3 CBD
    assert.equal(requirements.find((r) => r.id === 'r1-003').slots, 1);

    await call('register', { body: { name: 'T', email: 't@x.sa', password: '12345678', level: 'R1', scfhs: '1' } });
    const admin = (await call('login', { body: { email: 'a@x.sa', password: 'adminpass' } })).cookie;
    const uid = (await call('admin/users', { cookie: admin })).data[0].id;
    await call('admin/users/' + uid, { cookie: admin, body: { status: 'active' } });
    const tr = (await call('login', { body: { email: 't@x.sa', password: '12345678' } })).cookie;
    const up = (slot, name) => call('requirements/r1-013/submit', { cookie: tr, body: Buffer.from('%PDF'), headers: { 'X-File-Name': name, 'X-Slot': String(slot) } });

    const s1 = (await up(1, 'one.pdf')).data, s2 = (await up(2, 'two.pdf')).data;
    assert.notEqual(s1.id, s2.id);
    assert.equal((await up(3, 'x.pdf')).status, 400);
    const mine = (await call('requirements', { cookie: tr })).data.find((r) => r.id === 'r1-013');
    assert.deepEqual(mine.submissions.map((x) => [x.slot, x.fileName]), [[1, 'one.pdf'], [2, 'two.pdf']]);

    // separate grades
    await call('admin/grade/' + s1.id, { cookie: admin, body: { ratings: Array(sem.rubric.length).fill('excellent') } });
    await call('admin/grade/' + s2.id, { cookie: admin, body: { ratings: Array(sem.rubric.length).fill('weak') } });
    const graded = (await call('requirements', { cookie: tr })).data.find((r) => r.id === 'r1-013').submissions;
    assert.deepEqual(graded.map((x) => x.grade.total), [100, 46]);

    // reject: file deleted, reason kept, trainee can upload again
    assert.equal((await call('admin/reject/' + s2.id, { cookie: admin, body: {} })).status, 400);
    const rej = (await call('admin/reject/' + s2.id, { cookie: admin, body: { reason: 'Wrong file' } })).data;
    assert.equal(rej.rejected, true);
    assert.equal(rej.grade, undefined);
    assert.equal(fs.readdirSync(path.join(dir, 'uploads')).length, 1);
    assert.equal((await call(`submissions/${s2.id}/file`, { cookie: tr })).status, 404);
    assert.equal((await call('admin/grade/' + s2.id, { cookie: admin, body: { ratings: Array(sem.rubric.length).fill('excellent') } })).status, 409);
    const again = (await up(2, 'two-v2.pdf')).data;
    assert.equal(again.id, s2.id);
    assert.equal(again.rejected, false);
    assert.equal(again.fileName, 'two-v2.pdf');
    assert.ok(again.history.some((h) => h.reason === 'Wrong file'));
  } finally { srv.close(); }
});

test('VIP trainees can upload outside the submission window', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-'));
  const srv = createApp({ dataDir: dir, adminEmail: 'a@x.sa', adminPassword: 'adminpass' });
  await new Promise((r) => srv.listen(0, r));
  const base = `http://localhost:${srv.address().port}/api/`;
  const call = async (p, { body, cookie, headers = {} } = {}) => {
    const raw = Buffer.isBuffer(body);
    const r = await fetch(base + p, { method: body ? 'POST' : 'GET', body: raw ? body : body && JSON.stringify(body),
      headers: { 'X-Requested-With': 'portal', ...(cookie ? { cookie } : {}), ...(raw ? {} : { 'Content-Type': 'application/json' }), ...headers } });
    return { status: r.status, data: await r.json().catch(() => null), cookie: (r.headers.get('set-cookie') || '').split(';')[0] };
  };
  try {
    await call('register', { body: { name: 'T', email: 't@x.sa', password: '12345678', level: 'R1', scfhs: '1' } });
    const admin = (await call('login', { body: { email: 'a@x.sa', password: 'adminpass' } })).cookie;
    const uid = (await call('admin/users', { cookie: admin })).data[0].id;
    await call('admin/users/' + uid, { cookie: admin, body: { status: 'active' } });
    const tr = (await call('login', { body: { email: 't@x.sa', password: '12345678' } })).cookie;
    // a requirement whose window has not opened yet
    await call('admin/requirements/r1-019', { cookie: admin, body: { openAt: '2099-01-01T00:00:00Z', closeAt: '2099-02-01T00:00:00Z' } });
    const up = () => call('requirements/r1-019/submit', { cookie: tr, body: Buffer.from('%PDF'), headers: { 'X-File-Name': 'logbook.pdf' } });
    assert.equal((await up()).status, 403);
    assert.equal((await call('admin/users/' + uid, { cookie: admin, body: { vip: true } })).data.vip, true);
    assert.equal((await call('me', { cookie: tr })).data.user.vip, true);
    assert.equal((await up()).status, 200);
    await call('admin/users/' + uid, { cookie: admin, body: { vip: false } });
    assert.equal((await up()).status, 403);
  } finally { srv.close(); }
});

test('T1 exam: hidden answers, password, one attempt, grading, excluding a question', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-'));
  const srv = createApp({ dataDir: dir, adminEmail: 'a@x.sa', adminPassword: 'adminpass' });
  await new Promise((r) => srv.listen(0, r));
  const base = `http://localhost:${srv.address().port}/api/`;
  const call = async (p, { body, cookie, method } = {}) => {
    const r = await fetch(base + p, { method: method || (body ? 'POST' : 'GET'), body: body && JSON.stringify(body), headers: { 'X-Requested-With': 'portal', 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) } });
    return { status: r.status, data: await r.json().catch(() => null), cookie: (r.headers.get('set-cookie') || '').split(';')[0] };
  };
  try {
    const admin = (await call('login', { body: { email: 'a@x.sa', password: 'adminpass' } })).cookie;
    const info = (await call('exam/t1')).data;
    assert.equal(info.count, 51);
    assert.equal(info.durationMin, 60);
    const me = { name: 'Sara Ali Alqahtani', scfhs: '1000000098', password: 'AFHSR26' };
    assert.equal((await call('exam/t1/start', { body: me })).status, 403, 'not open yet');
    // open it now
    await call('admin/exams/t1', { cookie: admin, body: { openAt: new Date(Date.now() - 6e4).toISOString(), closeAt: new Date(Date.now() + 36e5).toISOString() } });
    assert.equal((await call('exam/t1/start', { body: { ...me, password: 'x' } })).status, 403);
    assert.equal((await call('exam/t1/start', { body: { ...me, name: 'Sara' } })).status, 400);
    const st = (await call('exam/t1/start', { body: me })).data;
    assert.equal(st.questions.length, 25, 'part 1 (biostatistics) only');
    assert.ok(st.questions.every((q) => q.id.startsWith('b')));
    assert.deepEqual([st.part.index, st.part.count], [0, 2]);
    const raw = JSON.stringify(st);
    assert.ok(!raw.includes('"answer"') && !raw.includes('keyNote') && !raw.includes('AFHSR26'), 'no answers or password sent');
    // answer every question correctly using the server's key
    const { exam } = (await call('admin/exams/t1', { cookie: admin })).data;
    const ans = (it) => call('exam/attempt/answer', { body: { token: st.token, itemId: it.id, optionId: it.answer } });
    const p2 = exam.items.find((it) => it.part === 'epi');
    assert.equal((await ans(p2)).status, 409, 'part 2 is not open yet');
    for (const it of exam.items.filter((x) => x.part === 'bio')) await ans(it);
    const next = (await call('exam/attempt/next-part', { body: { token: st.token } })).data;
    assert.equal(next.questions.length, 26);
    assert.equal(next.part.index, 1);
    // grouped questions stay together within part 2
    const pos = next.questions.map((q, i) => (q.group === 'lab' ? i : -1)).filter((i) => i >= 0);
    assert.equal(pos[2] - pos[0], 2);
    // part 1 is locked once finished
    assert.equal((await ans(exam.items.find((it) => it.id === 'b1'))).status, 409);
    for (const it of exam.items.filter((x) => x.part === 'epi')) await ans(it);
    await call('exam/attempt/event', { body: { token: st.token, type: 'hidden' } });
    const hid = (await call('exam/attempt/submit', { body: { token: st.token } })).data;
    assert.equal(hid.submitted, true);
    assert.equal(hid.scoreHidden, true, 'score hidden until released');
    assert.equal(hid.score, undefined);
    assert.equal(hid.percent, undefined);
    assert.equal((await call('admin/exams/t1', { cookie: admin })).data.attempts[0].score, 51, 'admin sees it');
    // releasing results: starting again shows the score
    await call('admin/exams/t1', { cookie: admin, body: { showScore: true } });
    assert.equal((await call('exam/t1')).data.showScore, true);
    const res = (await call('exam/t1/start', { body: me })).data;
    assert.deepEqual([res.score, res.total, res.percent], [51, 51, 100]);
    assert.deepEqual([res.byPart.bio.score, res.byPart.epi.score], [25, 26]);
    assert.equal(res.answers, undefined);
    // one attempt per ID number: starting again just shows the result
    const again = (await call('exam/t1/start', { body: me })).data;
    assert.equal(again.submitted, true);
    assert.equal(again.score, 51);
    // excluding a question re-grades everyone
    await call('admin/exams/t1/items/q4', { cookie: admin, body: { excluded: true } });
    const adm = (await call('admin/exams/t1', { cookie: admin })).data;
    assert.equal(adm.attempts[0].total, 50);
    assert.equal(adm.attempts[0].focusLost, 1);
    assert.equal((await call('exam/t1')).data.count, 50);
    // deleting the attempt allows a new one
    await call('admin/exams/t1/attempts/' + adm.attempts[0].id, { cookie: admin, method: 'DELETE' });
    assert.ok((await call('exam/t1/start', { body: me })).data.token);
  } finally { srv.close(); }
});

test('admin can preview a closed exam without it counting', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-'));
  const srv = createApp({ dataDir: dir, adminEmail: 'a@x.sa', adminPassword: 'adminpass' });
  await new Promise((r) => srv.listen(0, r));
  const base = `http://localhost:${srv.address().port}/api/`;
  const call = async (p, { body, cookie } = {}) => {
    const r = await fetch(base + p, { method: body ? 'POST' : 'GET', body: body && JSON.stringify(body), headers: { 'X-Requested-With': 'portal', 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) } });
    return { status: r.status, data: await r.json().catch(() => null), cookie: (r.headers.get('set-cookie') || '').split(';')[0] };
  };
  try {
    const me = { name: 'Admin Test User', scfhs: '1000000099', password: 'AFHSR26' };
    assert.equal((await call('exam/t1/start', { body: me })).status, 403, 'not open for trainees');
    const admin = (await call('login', { body: { email: 'a@x.sa', password: 'adminpass' } })).cookie;
    const st = (await call('exam/t1/start', { body: me, cookie: admin })).data;
    assert.ok(st.token);
    assert.equal((await call('exam/attempt/submit', { body: { token: st.token } })).data.total, 51);
    const st2 = (await call('exam/t1/start', { body: me, cookie: admin })).data;
    assert.ok(st2.token && st2.token !== st.token, 'a new preview replaces the old one');
    const adm = (await call('admin/exams/t1', { cookie: admin })).data;
    assert.equal(adm.attempts.length, 0);
    assert.equal(adm.analysis.n, 0);
  } finally { srv.close(); }
});

test('exam reviewer link: secret, read-only, revocable', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-'));
  const srv = createApp({ dataDir: dir, adminEmail: 'a@x.sa', adminPassword: 'adminpass' });
  await new Promise((r) => srv.listen(0, r));
  const base = `http://localhost:${srv.address().port}/api/`;
  const call = async (p, { body, cookie } = {}) => {
    const r = await fetch(base + p, { method: body ? 'POST' : 'GET', body: body && JSON.stringify(body), headers: { 'X-Requested-With': 'portal', 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) } });
    return { status: r.status, data: await r.json().catch(() => null), cookie: (r.headers.get('set-cookie') || '').split(';')[0] };
  };
  try {
    assert.equal((await call('exam/t1/review/anything')).status, 404);
    const admin = (await call('login', { body: { email: 'a@x.sa', password: 'adminpass' } })).cookie;
    const { token } = (await call('admin/exams/t1/review-link', { cookie: admin, body: {} })).data;
    const rv = await call('exam/t1/review/' + token);
    assert.equal(rv.status, 200);
    assert.equal(rv.data.items.length, 51); // both parts; removed questions are not shown
    assert.ok(rv.data.items.every((i) => i.answer));
    assert.ok(!JSON.stringify(rv.data).includes('AFHSR26'), 'password not exposed');
    assert.ok(!JSON.stringify((await call('exam/t1')).data).includes(token), 'token not in public info');
    await call('admin/exams/t1/review-link', { cookie: admin, body: { revoke: true } });
    assert.equal((await call('exam/t1/review/' + token)).status, 404);
  } finally { srv.close(); }
});

test('official evaluation forms: scoring rules and grading through the API', () => {
  const { FORMS, scoreForm, formFor } = require('../lib/forms');
  // CAP: 8 items on 1–5, N/A allowed → sum / (rated × 5) × 100
  const cap = FORMS.cap, r = {};
  cap.sections[0].items.forEach((_, i) => { r['s0i' + i] = 4; });
  assert.equal(scoreForm(cap, r), 80);
  r.s0i7 = 'na';
  assert.equal(scoreForm(cap, r), 80); // 28 / 35
  delete r.s0i0;
  assert.throws(() => scoreForm(cap, r), /Rate every item/);
  // Poster: no N/A allowed
  const pr = {}; FORMS.poster.sections.forEach((sec, si) => sec.items.forEach((_, ii) => { pr[`s${si}i${ii}`] = 5; }));
  assert.equal(scoreForm(FORMS.poster, pr), 100);
  pr.s0i0 = 'na';
  assert.throws(() => scoreForm(FORMS.poster, pr));
  // Program plan: section marks out of 100
  const pp = { s0: 5, s1: 8, s2: 12, s3: 20, s4: 10, s5: 15, s6: 7 };
  assert.equal(scoreForm(FORMS.program, pp), 77);
  assert.throws(() => scoreForm(FORMS.program, { ...pp, s3: 26 }), /between 0 and 25/);
  // every marks form adds up to 100, and requirement types map to forms
  for (const f of Object.values(FORMS)) if (f.kind === 'marks') assert.equal(f.sections.reduce((a, s) => a + s.max, 0), 100);
  assert.equal(formFor({ type: 'cat' }).title, FORMS.cat.title);
  assert.equal(formFor({ type: 'seminar' }), null);
});

test('exam roster: only listed trainees with the matching national ID can start', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-'));
  const srv = createApp({ dataDir: dir, adminEmail: 'a@x.sa', adminPassword: 'adminpass' });
  await new Promise((r) => srv.listen(0, r));
  const base = `http://localhost:${srv.address().port}/api/`;
  const call = async (p, { body, cookie } = {}) => {
    const r = await fetch(base + p, { method: body ? 'POST' : 'GET', body: body && JSON.stringify(body), headers: { 'X-Requested-With': 'portal', 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) } });
    return { status: r.status, data: await r.json().catch(() => null), cookie: (r.headers.get('set-cookie') || '').split(';')[0] };
  };
  try {
    const admin = (await call('login', { body: { email: 'a@x.sa', password: 'adminpass' } })).cookie;
    const roster = 'سارة عبدالله العتيبي \n1000000001\nنورة فهد القحطاني - ١٠٠٠٠٠٠٠٠٢';
    await call('admin/exams/t1', { cookie: admin, body: { roster, openAt: new Date(Date.now() - 6e4).toISOString(), closeAt: new Date(Date.now() + 36e5).toISOString() } });
    assert.equal((await call('exam/t1')).data.roster, true);
    // names only after the right password, never ID numbers
    assert.equal((await call('exam/t1/names', { body: { password: 'nope' } })).status, 403);
    const names = (await call('exam/t1/names', { body: { password: 'AFHSR26' } })).data;
    assert.equal(names.names.length, 2);
    assert.ok(!JSON.stringify(names).includes('1000000001'));
    const start = (name, nid) => call('exam/t1/start', { body: { name, nid, password: 'AFHSR26' } });
    assert.equal((await start('Someone Else Entirely', '1000000001')).status, 403, 'not on the list');
    assert.equal((await start('سارة عبدالله العتيبي', '1000000002')).status, 403, 'someone else’s ID');
    // spelling variants and Arabic digits are accepted; the listed spelling is used
    const ok = (await start('ساره عبد الله العتيبي', '١٠٠٠٠٠٠٠٠١')).data;
    assert.ok(ok.token);
    assert.equal(ok.name, 'سارة عبدالله العتيبي');
    assert.equal((await start('نوره فهد القحطاني', '1000000002')).status, 200);
    // the admin can still preview without being on the list
    assert.ok((await call('exam/t1/start', { cookie: admin, body: { name: 'Admin Test User', scfhs: '1000000099', password: 'AFHSR26' } })).data.token);
    // a malformed list is refused
    assert.equal((await call('admin/exams/t1', { cookie: admin, body: { roster: 'just a name' } })).status, 400);
  } finally { srv.close(); }
});

test('answers held offline are accepted shortly after the deadline and flagged', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-'));
  const srv = createApp({ dataDir: dir, adminEmail: 'a@x.sa', adminPassword: 'adminpass' });
  await new Promise((r) => srv.listen(0, r));
  const base = `http://localhost:${srv.address().port}/api/`;
  const call = async (p, { body, cookie } = {}) => {
    const r = await fetch(base + p, { method: body ? 'POST' : 'GET', body: body && JSON.stringify(body), headers: { 'X-Requested-With': 'portal', 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) } });
    return { status: r.status, data: await r.json().catch(() => null), cookie: (r.headers.get('set-cookie') || '').split(';')[0] };
  };
  try {
    const admin = (await call('login', { body: { email: 'a@x.sa', password: 'adminpass' } })).cookie;
    const now = Date.now();
    await call('admin/exams/t1', { cookie: admin, body: { openAt: new Date(now - 36e5).toISOString(), closeAt: new Date(now + 36e5).toISOString() } });
    const st = (await call('exam/t1/start', { body: { name: 'Sara Ali Alqahtani', scfhs: '1000000098', password: 'AFHSR26' } })).data;
    const { exam } = (await call('admin/exams/t1', { cookie: admin })).data;
    const b = exam.items.filter((x) => x.part === 'bio');
    // time ran out 2 minutes ago, but the answer was held by a lost connection
    await call('admin/exams/t1', { cookie: admin, body: { closeAt: new Date(Date.now() - 2 * 6e4).toISOString() } });
    assert.equal((await call('exam/attempt/answer', { body: { token: st.token, itemId: b[0].id, optionId: b[0].answer, seq: 1 } })).status, 200);
    let adm = (await call('admin/exams/t1', { cookie: admin })).data;
    assert.equal(adm.attempts[0].submittedAt, undefined, 'not auto-submitted yet');
    assert.equal(adm.attempts[0].lateSync, 1);
    // well past the limit: refused, and the attempt is submitted with what arrived
    await call('admin/exams/t1', { cookie: admin, body: { closeAt: new Date(Date.now() - 11 * 6e4).toISOString() } });
    assert.equal((await call('exam/attempt/answer', { body: { token: st.token, itemId: b[1].id, optionId: b[1].answer, seq: 2 } })).status, 409);
    adm = (await call('admin/exams/t1', { cookie: admin })).data;
    assert.ok(adm.attempts[0].submittedAt);
    assert.equal(adm.attempts[0].score, 1);
  } finally { srv.close(); }
});

test('exam taken fully offline: whole paper at start, late outbox accepted by answer time', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-'));
  const { FileStore } = require('../lib/file-store');
  const store = new FileStore(dir);
  const srv = createApp({ store, adminEmail: 'a@x.sa', adminPassword: 'adminpass' });
  await new Promise((r) => srv.listen(0, r));
  const base = `http://localhost:${srv.address().port}/api/`;
  const call = async (p, { body, cookie } = {}) => {
    const r = await fetch(base + p, { method: body ? 'POST' : 'GET', body: body && JSON.stringify(body), headers: { 'X-Requested-With': 'portal', 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) } });
    return { status: r.status, data: await r.json().catch(() => null) };
  };
  const login = async () => { const r = await fetch(base + 'login', { method: 'POST', body: JSON.stringify({ email: 'a@x.sa', password: 'adminpass' }), headers: { 'X-Requested-With': 'portal', 'Content-Type': 'application/json' } }); return (r.headers.get('set-cookie') || '').split(';')[0]; };
  try {
    const admin = await login();
    await call('admin/exams/t1', { cookie: admin, body: { openAt: new Date(Date.now() - 36e5).toISOString(), closeAt: new Date(Date.now() + 36e5).toISOString() } });
    const st = (await call('exam/t1/start', { body: { name: 'Sara Ali Alqahtani', scfhs: '1000000098', password: 'AFHSR26' } })).data;
    assert.equal(st.parts.length, 2);
    assert.deepEqual(st.parts.map((p) => p.questions.length), [25, 26]);
    assert.ok(Number.isFinite(st.serverNow));
    assert.ok(!JSON.stringify(st).includes('"answer"'), 'no answer keys sent');
    const { exam } = (await call('admin/exams/t1', { cookie: admin })).data;
    const bio = exam.items.filter((x) => x.part === 'bio'), epi = exam.items.filter((x) => x.part === 'epi');
    // the connection only returns 90 minutes after the start (60-minute limit + 10-minute window passed):
    const [att] = await store.all('attempts');
    att.startedAt = new Date(Date.now() - 90 * 6e4).toISOString();
    await store.put('attempts', att);
    const adm0 = (await call('admin/exams/t1', { cookie: admin })).data;
    assert.ok(adm0.attempts[0].autoSubmitted);
    assert.equal(adm0.attempts[0].score, 0);
    // answers made before the deadline are accepted (not those claiming a later time)
    let at = new Date(adm0.attempts[0].startedAt).getTime() + 1000;
    assert.equal((await call('exam/attempt/answer', { body: { token: st.token, itemId: bio[0].id, optionId: bio[0].answer, seq: 1, at } })).status, 200);
    assert.equal((await call('exam/attempt/answer', { body: { token: st.token, itemId: bio[1].id, optionId: bio[1].answer, seq: 2, at: Date.now() } })).status, 409, 'made after the deadline');
    // answers to part 2 before moving on are refused; the queued part change is applied by its time
    assert.equal((await call('exam/attempt/answer', { body: { token: st.token, itemId: epi[0].id, optionId: epi[0].answer, seq: 3, at } })).status, 409);
    assert.equal((await call('exam/attempt/next-part', { body: { token: st.token, from: 0, at } })).status, 200);
    assert.equal((await call('exam/attempt/next-part', { body: { token: st.token, from: 0, at } })).status, 200, 'a repeated request is harmless');
    assert.equal((await call('exam/attempt/answer', { body: { token: st.token, itemId: epi[0].id, optionId: epi[0].answer, seq: 4, at } })).status, 200);
    assert.equal((await call('exam/attempt/answer', { body: { token: st.token, itemId: bio[2].id, optionId: bio[2].answer, seq: 5, at } })).status, 409, 'part 1 is closed');
    assert.equal((await call('exam/attempt/submit', { body: { token: st.token, at } })).data.submitted, true);
    const adm = (await call('admin/exams/t1', { cookie: admin })).data;
    assert.equal(adm.attempts[0].score, 2);
    assert.equal(adm.attempts[0].lateSync, 2);
  } finally { srv.close(); }
});

test('exam download first, clock starts on begin (also when begin arrives late from the outbox)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-'));
  const srv = createApp({ dataDir: dir, adminEmail: 'a@x.sa', adminPassword: 'adminpass' });
  await new Promise((r) => srv.listen(0, r));
  const base = `http://localhost:${srv.address().port}/api/`;
  const call = async (p, { body, cookie } = {}) => {
    const r = await fetch(base + p, { method: body ? 'POST' : 'GET', body: body && JSON.stringify(body), headers: { 'X-Requested-With': 'portal', 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) } });
    return { status: r.status, data: await r.json().catch(() => null), cookie: (r.headers.get('set-cookie') || '').split(';')[0] };
  };
  try {
    const admin = (await call('login', { body: { email: 'a@x.sa', password: 'adminpass' } })).cookie;
    await call('admin/exams/t1', { cookie: admin, body: { openAt: new Date(Date.now() - 6e4).toISOString(), closeAt: new Date(Date.now() + 2 * 36e5).toISOString() } });
    const me = { name: 'Sara Ali Alqahtani', scfhs: '1000000098', password: 'AFHSR26', prepare: true };
    const st = (await call('exam/t1/start', { body: me })).data;
    assert.equal(st.begun, false);
    assert.equal(st.deadline, null);
    assert.equal(st.durationMin, 60);
    assert.equal(st.parts.length, 2);
    const { exam } = (await call('admin/exams/t1', { cookie: admin })).data;
    const q = exam.items.find((x) => x.part === 'bio');
    assert.equal((await call('exam/attempt/answer', { body: { token: st.token, itemId: q.id, optionId: q.answer, seq: 1, at: Date.now() } })).status, 409, 'not started yet');
    // signing in again before starting gives the same download, still not started
    const again = (await call('exam/t1/start', { body: me })).data;
    assert.equal(again.token, st.token);
    assert.equal(again.begun, false);
    // Start pressed a moment ago (sent late from the outbox): the clock runs from that moment, never before the download
    await new Promise((r) => setTimeout(r, 400));
    const pressed = Date.now() - 300;
    const b = (await call('exam/attempt/begin', { body: { token: st.token, at: pressed } })).data;
    assert.ok(Math.abs(new Date(b.deadline).getTime() - (pressed + 60 * 6e4)) < 50);
    const b2 = (await call('exam/attempt/begin', { body: { token: st.token, at: Date.now() } })).data;
    assert.equal(b2.deadline, b.deadline, 'begin only counts once');
    assert.equal((await call('exam/attempt/answer', { body: { token: st.token, itemId: q.id, optionId: q.answer, seq: 2, at: Date.now() } })).status, 200);
    // leaving the page: question and time away are recorded and shown to the admin
    await call('exam/attempt/event', { body: { token: st.token, type: 'away', itemId: q.id, ms: 42000, at: Date.now() - 42000 } });
    await call('exam/attempt/event', { body: { token: st.token, type: 'away', itemId: 'nope', ms: 1000 } });
    const att = (await call('admin/exams/t1', { cookie: admin })).data.attempts[0];
    assert.equal(att.focusLost, 1);
    assert.equal(att.awayMs, 42000);
    assert.deepEqual(att.away.map((x) => x.itemId), [q.id]);
    // 42 s away (over the 10 s limit): that question is locked; its saved answer stays, a change is refused
    assert.equal((await call('exam/attempt/answer', { body: { token: st.token, itemId: q.id, optionId: null, seq: 3, at: Date.now() } })).status, 409);
    const q2 = exam.items.filter((x) => x.part === 'bio')[1];
    await call('exam/attempt/event', { body: { token: st.token, type: 'away', itemId: q2.id, ms: 4000, at: Date.now() - 4000 } });
    assert.equal((await call('exam/attempt/answer', { body: { token: st.token, itemId: q2.id, optionId: q2.answer, seq: 4, at: Date.now() } })).status, 200, 'a short exit does not lock');
    const att2 = (await call('admin/exams/t1', { cookie: admin })).data.attempts[0];
    assert.deepEqual(att2.locked, [q.id]);
    assert.equal(att2.answers[q.id], q.answer);
    assert.equal((await call('exam/t1/start', { body: me })).data.locked[0], q.id, 'the lock comes back on re-entry');
  } finally { srv.close(); }
});

test('trainee email for the result, saved even after submitting', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-'));
  const srv = createApp({ dataDir: dir, adminEmail: 'a@x.sa', adminPassword: 'adminpass' });
  await new Promise((r) => srv.listen(0, r));
  const base = `http://localhost:${srv.address().port}/api/`;
  const call = async (p, { body, cookie } = {}) => {
    const r = await fetch(base + p, { method: body ? 'POST' : 'GET', body: body && JSON.stringify(body), headers: { 'X-Requested-With': 'portal', 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) } });
    return { status: r.status, data: await r.json().catch(() => null), cookie: (r.headers.get('set-cookie') || '').split(';')[0] };
  };
  try {
    const admin = (await call('login', { body: { email: 'a@x.sa', password: 'adminpass' } })).cookie;
    await call('admin/exams/t1', { cookie: admin, body: { openAt: new Date(Date.now() - 6e4).toISOString(), closeAt: new Date(Date.now() + 36e5).toISOString() } });
    const st = (await call('exam/t1/start', { body: { name: 'Sara Ali Alqahtani', scfhs: '1000000098', password: 'AFHSR26' } })).data;
    await call('exam/attempt/submit', { body: { token: st.token } });
    assert.equal((await call('exam/attempt/email', { body: { token: st.token, email: 'not-an-email' } })).status, 400);
    assert.equal((await call('exam/attempt/email', { body: { token: st.token, email: ' Sara@Example.com ' } })).data.email, 'sara@example.com');
    assert.equal((await call('admin/exams/t1', { cookie: admin })).data.attempts[0].email, 'sara@example.com');
  } finally { srv.close(); }
});

test('laptops and tablets only: phones are refused', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-'));
  const srv = createApp({ dataDir: dir, adminEmail: 'a@x.sa', adminPassword: 'adminpass' });
  await new Promise((r) => srv.listen(0, r));
  const base = `http://localhost:${srv.address().port}/api/`;
  const call = async (p, { body, cookie, ua } = {}) => {
    const r = await fetch(base + p, { method: body ? 'POST' : 'GET', body: body && JSON.stringify(body), headers: { 'X-Requested-With': 'portal', 'Content-Type': 'application/json', ...(ua ? { 'User-Agent': ua } : {}), ...(cookie ? { cookie } : {}) } });
    return { status: r.status, data: await r.json().catch(() => null), cookie: (r.headers.get('set-cookie') || '').split(';')[0] };
  };
  const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
  const ANDROID_PHONE = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';
  const ANDROID_TAB = 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
  const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
  try {
    const admin = (await call('login', { body: { email: 'a@x.sa', password: 'adminpass' } })).cookie;
    await call('admin/exams/t1', { cookie: admin, body: { openAt: new Date(Date.now() - 6e4).toISOString(), closeAt: new Date(Date.now() + 36e5).toISOString() } });
    assert.equal((await call('exam/t1')).data.noPhones, true, 'on by default');
    const me = (n) => ({ name: 'Sara Ali Alqahtani', scfhs: '100000009' + n, password: 'AFHSR26', prepare: true });
    assert.equal((await call('exam/t1/start', { body: me(1), ua: IPHONE })).status, 403);
    assert.equal((await call('exam/t1/start', { body: me(1), ua: ANDROID_PHONE })).status, 403);
    // a phone asking for the desktop site: refused by its screen size
    assert.equal((await call('exam/t1/start', { body: { ...me(1), screen: { short: 390, touch: true } }, ua: IPAD })).status, 403);
    assert.ok((await call('exam/t1/start', { body: { ...me(2), screen: { short: 820, touch: true } }, ua: IPAD })).data.token, 'iPad');
    assert.ok((await call('exam/t1/start', { body: { ...me(3), screen: { short: 800, touch: true } }, ua: ANDROID_TAB })).data.token, 'Android tablet');
    assert.ok((await call('exam/t1/start', { body: { ...me(4), screen: { short: 900, touch: false } } })).data.token, 'laptop');
    assert.ok((await call('exam/t1/start', { body: me(5), ua: IPHONE, cookie: admin })).data.token, 'admin preview on a phone');
    await call('admin/exams/t1', { cookie: admin, body: { noPhones: false } });
    assert.ok((await call('exam/t1/start', { body: me(6), ua: IPHONE })).data.token, 'allowed when the setting is off');
  } finally { srv.close(); }
});
