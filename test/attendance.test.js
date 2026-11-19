'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../server');

test('attendance: roster, absences, private link replies, director decisions, limit', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'att-'));
  const srv = createApp({ dataDir: dir, adminEmail: 'a@x.sa', adminPassword: 'adminpass' });
  await new Promise((r) => srv.listen(0, r));
  const base = `http://localhost:${srv.address().port}/api/`;
  const call = async (p, { body, cookie, method, headers = {} } = {}) => {
    const raw = Buffer.isBuffer(body);
    const r = await fetch(base + p, { method: method || (body ? 'POST' : 'GET'), body: raw ? body : body && JSON.stringify(body),
      headers: { 'X-Requested-With': 'portal', ...(cookie ? { cookie } : {}), ...(raw ? {} : { 'Content-Type': 'application/json' }), ...headers } });
    return { status: r.status, data: await r.json().catch(() => null), raw: r };
  };
  try {
    const admin = (await fetch(base + 'login', { method: 'POST', headers: { 'X-Requested-With': 'portal', 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'a@x.sa', password: 'adminpass' }) })).headers.get('set-cookie').split(';')[0];
    // Fictional trainees only.
    assert.equal((await call('admin/att/roster')).status, 401, 'needs the admin');
    const list = [1, 2, 3, 4].map((n) => ({ no: n, name: `Trainee ${n}`, level: 'R2', phone: '0500000000' }));
    assert.equal((await call('admin/att/roster', { cookie: admin, body: { list } })).status, 200);
    assert.equal((await call('admin/att/roster', { cookie: admin, body: { list: [{ no: 2, name: 'Trainee Two' }] } })).data[0].name, 'Trainee Two', 'same number updates');
    let A = (await call('admin/att', { cookie: admin })).data;
    assert.equal(A.roster.length, 4);
    const [t1, t2, t3] = A.roster;
    assert.notEqual(t1.token, t2.token);

    // Days in the past (relative to today), so reply deadlines can be tested.
    const day = (n) => new Date(Date.now() - n * 864e5 + 3 * 36e5).toISOString().slice(0, 10);
    const old = day(20), recent = day(1);
    await call('admin/att/settings', { cookie: admin, body: { from: day(60), to: day(-60), allowed: 1, replyDays: 7 } });
    assert.equal((await call('admin/att/day', { cookie: admin, body: { date: day(-7), absent: [] } })).status, 400, 'not in the future');
    await call('admin/att/day', { cookie: admin, body: { date: old, absent: [t1.id, t2.id] } });
    await call('admin/att/day', { cookie: admin, body: { date: recent, absent: [t1.id, t3.id] } });
    assert.equal((await call(`admin/att/day/${recent}/sheet`, { cookie: admin, method: 'POST', body: Buffer.from('sheet'), headers: { 'X-File-Name': 'sheet.jpg' } })).status, 200);

    // Private link: a wrong token sees nothing.
    assert.equal((await call('att/' + 'f'.repeat(48))).status, 404);
    let me = (await call('att/' + t1.token)).data;
    assert.equal(me.name, 'Trainee 1');
    assert.equal(me.level, 'R2', 'the trainee level, not the standing');
    assert.deepEqual(me.rows.map((x) => x.status), ['unexcused', 'reply'], 'old absence without reply counts; recent one waits for a reply');
    assert.equal(me.counted, 1);
    assert.ok(!JSON.stringify(me).includes(t2.token) && !JSON.stringify(me).includes('Trainee Two'), 'only their own record');
    // Too late to reply to the old one; the recent one gets an excuse with a file.
    assert.equal((await call(`att/${t1.token}/reply`, { body: { date: old, kind: 'excuse', text: 'ill' } })).status, 409);
    assert.equal((await call(`att/${t1.token}/reply`, { body: { date: recent, kind: 'excuse', text: '' } })).status, 400, 'explanation needed');
    assert.equal((await call(`att/${t1.token}/reply`, { body: { date: recent, kind: 'excuse', text: 'Medical appointment' } })).status, 200);
    assert.equal((await call(`att/${t1.token}/file`, { method: 'POST', body: Buffer.from('%PDF-1'), headers: { 'X-File-Name': 'report.pdf', 'X-Date': recent } })).status, 200);
    assert.equal((await call(`att/${t1.token}/file`, { method: 'POST', body: Buffer.from('x'), headers: { 'X-File-Name': 'x.exe', 'X-Date': recent } })).status, 415);
    assert.equal((await call(`att/${t2.token}/reply`, { body: { date: recent, kind: 'excuse', text: 'x' } })).status, 404, 'no absence for them that day');
    me = (await call('att/' + t1.token)).data;
    assert.equal(me.rows[1].status, 'awaiting');
    assert.equal(me.counted, 1);

    // The director decides: excused; the old one turns out to be a recording mistake.
    assert.equal((await call('admin/att/decide', { cookie: admin, body: { date: recent, rid: t1.id, decision: 'excused', note: 'Report accepted' } })).status, 200);
    assert.equal((await call('admin/att/decide', { cookie: admin, body: { date: old, rid: t1.id, decision: 'present' } })).status, 200);
    me = (await call('att/' + t1.token)).data;
    assert.deepEqual(me.rows.map((x) => x.status), ['present', 'excused']);
    assert.equal(me.counted, 0);
    assert.equal(me.rows[1].note, 'Report accepted');
    assert.equal((await call(`att/${t1.token}/reply`, { body: { date: recent, kind: 'none' } })).status, 409, 'decided: no more changes');
    // "No excuse" counts at once; with one allowed, two unexcused is over the limit.
    await call(`att/${t3.token}/reply`, { body: { date: recent, kind: 'none' } });
    await call('admin/att/decide', { cookie: admin, body: { date: old, rid: t2.id, decision: 'unexcused' } });
    A = (await call('admin/att', { cookie: admin })).data;
    const rec = Object.fromEntries(A.roster.map((r) => [r.no, r.record]));
    assert.deepEqual([rec[1].counted, rec[2].counted, rec[3].counted, rec[4].counted], [0, 1, 1, 0]);
    assert.deepEqual([rec[2].standing, rec[3].standing, rec[4].standing], ['limit', 'limit', 'ok']);
    assert.equal(rec[4].attended, 2);
    assert.equal(A.cases.find((c) => c.rid === t1.id && c.date === recent).response.file, true);
    assert.ok(!JSON.stringify(A).includes('att-'), 'stored file names are not exposed');
    const f = await call(`admin/att/file/${encodeURIComponent(recent + ':' + t1.id)}`, { cookie: admin });
    assert.equal(f.status, 200);

    // Advance notice: a coming Thursday only.
    const next = new Date(Date.now() + 3 * 36e5); next.setUTCDate(next.getUTCDate() + ((4 - next.getUTCDay() + 7) % 7 || 7));
    const thu = next.toISOString().slice(0, 10);
    const fri = new Date(next.getTime() + 864e5).toISOString().slice(0, 10);
    assert.equal((await call(`att/${t2.token}/reply`, { body: { date: fri, kind: 'notice', text: 'Conference' } })).status, 400);
    assert.equal((await call(`att/${t2.token}/reply`, { body: { date: thu, kind: 'notice', text: 'Conference' } })).status, 200);
    assert.equal((await call('att/' + t2.token)).data.notices[0].date, thu);

    // A new link replaces the old one; an inactive trainee's link stops working.
    const t4 = A.roster[3];
    const nt = (await call(`admin/att/roster/${t4.id}/token`, { cookie: admin, method: 'POST' })).data.token;
    assert.equal((await call('att/' + t4.token)).status, 404);
    assert.equal((await call('att/' + nt)).status, 200);
    await call('admin/att/roster', { cookie: admin, body: { id: t4.id, active: false } });
    assert.equal((await call('att/' + nt)).status, 404);
  } finally { srv.close(); }
});
