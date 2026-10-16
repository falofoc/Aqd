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
    assert.ok(requirements.length > 80 && requirements.every((x) => x.published && x.state));
  } finally { srv.close(); }
});
