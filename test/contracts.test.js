'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../lib/contracts');
const { diffLines } = require('../public/assets/diff.js');

const IMG = 'data:image/png;base64,' + 'A'.repeat(400);
const make = () => C.createContract({
  title: 'عقد شراكة', body: '# البند الأول\nنص', ownerName: 'المنشئ',
  parties: ['أحمد', 'سارة', 'خالد', 'منى'].map((name) => ({ name, role: 'شريك' })),
});
const signAs = (c, pid) => C.sign(c, pid, { versionHash: C.currentVersion(c).hash, consent: true, method: 'draw', image: IMG, idNumber: '1012345678' });

test('يكتمل العقد فقط عندما يوقّع الأطراف الأربعة على النسخة نفسها', () => {
  const c = make();
  for (const pid of ['p1', 'p2', 'p3']) signAs(c, pid);
  assert.equal(C.status(c), C.STATUS.IN_PROGRESS);
  signAs(c, 'p4');
  assert.equal(C.status(c), C.STATUS.COMPLETED);
  assert.match(c.finalHash, /^[0-9a-f]{64}$/);
  assert.ok(C.verifyAuditChain(c));
  assert.throws(() => signAs(c, 'p1'), { code: 'COMPLETED' });
  assert.throws(() => C.amend(c, { type: 'owner' }, { baseHash: C.currentVersion(c).hash, title: 'x', body: 'y', note: 'z' }), { code: 'COMPLETED' });
});

test('أي تعديل يُلغي التوقيعات ويطلب إعادة التوقيع من الجميع', () => {
  const c = make();
  signAs(c, 'p1'); signAs(c, 'p2'); signAs(c, 'p3');
  const v1 = C.currentVersion(c);
  C.amend(c, { type: 'party', partyId: 'p4' }, { baseHash: v1.hash, title: v1.title, body: v1.body + '\nبند جديد', note: 'إضافة بند' });
  const view = C.view(c, { type: 'party', partyId: 'p1' });
  assert.equal(view.current.n, 2);
  assert.ok(view.parties.every((p) => p.state === 'pending'));
  assert.equal(view.parties[0].lastSignedVersion, 1);
  // توقيع على النسخة القديمة مرفوض
  assert.throws(() => C.sign(c, 'p1', { versionHash: v1.hash, consent: true, image: IMG }), { code: 'VERSION_CHANGED' });
  for (const pid of ['p1', 'p2', 'p3']) signAs(c, pid);
  assert.equal(C.status(c), C.STATUS.IN_PROGRESS);
  signAs(c, 'p4');
  assert.equal(C.status(c), C.STATUS.COMPLETED);
  const amended = c.audit.find((e) => e.action === 'amended');
  assert.deepEqual(amended.details.invalidatedSignatures, ['أحمد', 'سارة', 'خالد']);
});

test('طلب التعديل يوقف الاكتمال ويسحب توقيع صاحبه', () => {
  const c = make();
  signAs(c, 'p1'); signAs(c, 'p2'); signAs(c, 'p3');
  C.requestChanges(c, 'p3', { reason: 'تعديل النسب' });
  assert.equal(C.status(c), C.STATUS.CHANGES_REQUESTED);
  signAs(c, 'p4');
  assert.notEqual(C.status(c), C.STATUS.COMPLETED);
  const v = C.currentVersion(c);
  C.amend(c, { type: 'owner' }, { baseHash: v.hash, title: v.title, body: 'نص معدل', note: 'تعديل النسب' });
  assert.equal(C.status(c), C.STATUS.IN_PROGRESS);
});

test('حماية من التعديلات المتزامنة والمدخلات غير الصالحة', () => {
  const c = make();
  assert.throws(() => C.amend(c, { type: 'owner' }, { baseHash: 'old', title: 'a', body: 'b', note: 'c' }), { code: 'VERSION_CHANGED' });
  const v = C.currentVersion(c);
  assert.throws(() => C.amend(c, { type: 'owner' }, { baseHash: v.hash, title: v.title, body: v.body, note: 'x' }), { code: 'NO_CHANGES' });
  assert.throws(() => C.sign(c, 'p1', { versionHash: v.hash, consent: false, image: IMG }), { code: 'CONSENT_REQUIRED' });
  assert.throws(() => C.sign(c, 'p1', { versionHash: v.hash, consent: true, image: 'javascript:x' }), { code: 'INVALID_SIGNATURE' });
  signAs(c, 'p1');
  assert.throws(() => signAs(c, 'p1'), { code: 'ALREADY_SIGNED' });
  assert.throws(() => C.createContract({ title: 't', body: 'b', parties: [{ name: 'a' }] }), { code: 'PARTY_COUNT' });
  assert.throws(() => C.createContract({ title: 't', body: 'b', parties: [{ name: 'a' }, { name: 'a' }] }), { code: 'DUPLICATE_PARTY' });
});

test('منع الأطراف من التعديل المباشر عند إيقاف الخيار', () => {
  const c = C.createContract({ title: 't', body: 'b', allowPartyEdits: false, parties: [{ name: 'a' }, { name: 'b' }] });
  const v = C.currentVersion(c);
  assert.throws(() => C.amend(c, { type: 'party', partyId: 'p1' }, { baseHash: v.hash, title: 't', body: 'c', note: 'n' }), { code: 'EDIT_FORBIDDEN' });
});

test('كشف التلاعب في سجل التدقيق', () => {
  const c = make();
  signAs(c, 'p1');
  assert.ok(C.verifyAuditChain(c));
  c.audit[0].details.parties = ['مزوّر'];
  assert.equal(C.verifyAuditChain(c), false);
});

test('مقارنة الأسطر', () => {
  const d = diffLines('أ\nب\nج', 'أ\nد\nج');
  assert.deepEqual(d.map((x) => x.type), ['same', 'del', 'add', 'same']);
});

test('كل رابط يبدأ بمعرّف العقد ليصل مباشرة إلى عقده', () => {
  const c = make();
  assert.equal(c.id.length, C.ID_LENGTH);
  for (const t of [c.adminToken, ...c.parties.map((p) => p.token)]) {
    assert.ok(t.startsWith(c.id) && t.length > C.ID_LENGTH);
  }
});

test('كل طرف يُدخل رقم هويته بنفسه عند التوقيع', () => {
  const c = C.createContract({ title: 'ع', body: 'نص', parties: [{ name: 'أ', role: 'الطرف الأول' }, { name: 'ب', role: 'الطرف الثاني' }] });
  const v = C.currentVersion(c);
  const base = { versionHash: v.hash, consent: true, method: 'draw', image: IMG };
  assert.throws(() => C.sign(c, 'p1', base), { code: 'REQUIRED' });
  assert.throws(() => C.sign(c, 'p1', { ...base, idNumber: '12345' }), { code: 'INVALID_ID' });
  C.sign(c, 'p1', { ...base, idNumber: '١٠١٢٣٤٥٦٧٨' });
  const view = C.view(c, { type: 'party', partyId: 'p2' });
  assert.equal(view.parties[0].idNumber, '1012345678');
  assert.equal(view.parties[1].idNumber, '');
  assert.equal(C.currentVersion(c).hash, v.hash);
});
