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
