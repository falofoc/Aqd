'use strict';

// منطق طلبات الجلسة (رابط الطرف أو رابط المنشئ) مستقلاً عن بيئة التشغيل،
// ليستخدمه خادم Node وعامل Cloudflare بالطريقة نفسها.

const C = require('./contracts');

function whoFor(contract, token) {
  if (!contract || typeof token !== 'string' || !token) return null;
  if (contract.adminToken === token) return { type: 'owner' };
  const p = contract.parties.find((x) => x.token === token);
  return p ? { type: 'party', partyId: p.id } : null;
}

function links(base, c) {
  return {
    adminUrl: `${base}/admin/${c.adminToken}`,
    parties: c.parties.map((p) => ({
      id: p.id, name: p.name, role: p.role, idNumber: p.idNumber, email: p.email, phone: p.phone, signUrl: `${base}/sign/${p.token}`,
    })),
  };
}

function sessionPayload(base, contract, who) {
  const v = C.view(contract, who);
  if (who.type === 'owner') {
    const l = links(base, contract);
    v.adminUrl = l.adminUrl;
    for (const p of v.parties) {
      p.signUrl = l.parties.find((x) => x.id === p.id).signUrl;
      delete p.token;
    }
  }
  v.verifyUrl = `${base}/verify/${contract.id}`;
  return v;
}

function exportFile(c) {
  const contract = C.view(c, { type: 'export' });
  delete contract.me;
  delete contract.role;
  const data = { format: 'aqd-evidence/1', exportedAt: new Date().toISOString(), summary: C.publicSummary(c), contract };
  return {
    status: 200,
    body: JSON.stringify(data, null, 2),
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="aqd-${c.id}-evidence.json"`,
      'Cache-Control': 'no-store',
    },
  };
}

// يعيد دالة تعدّل العقد إن كان الطلب يغيّره، وإلا null.
function mutationFor(contract, who, method, action, body, ctx) {
  if (method === 'GET') {
    if (action !== '' || who.type !== 'party' || C.status(contract) === C.STATUS.COMPLETED) return null;
    const v = C.currentVersion(contract);
    const p = contract.parties.find((x) => x.id === who.partyId);
    return p.viewedVersions.includes(v.n) ? null : (d) => C.markViewed(d, who.partyId, ctx);
  }
  if (method !== 'POST') throw new C.AppError(405, 'METHOD', 'طريقة غير مدعومة');
  const partyOnly = (msg) => { if (who.type !== 'party') throw new C.AppError(403, 'FORBIDDEN', msg); };
  switch (action) {
    case 'sign':
      partyOnly('التوقيع متاح للأطراف فقط.');
      return (d) => C.sign(d, who.partyId, body, ctx);
    case 'request-changes':
      partyOnly('طلب التعديل متاح للأطراف فقط.');
      return (d) => C.requestChanges(d, who.partyId, body, ctx);
    case 'amend':
      return (d) => C.amend(d, who, body, ctx);
    case 'void':
      if (who.type !== 'owner') throw new C.AppError(403, 'FORBIDDEN', 'الإلغاء متاح لمنشئ العقد فقط.');
      return (d) => C.voidContract(d, body, ctx);
    default:
      throw new C.AppError(404, 'NOT_FOUND', 'عملية غير معروفة');
  }
}

// الرد بعد تطبيق أي تعديل: { status, json } أو { status, body, headers }.
function respond(base, contract, who, method, action) {
  if (method === 'GET' && action === 'export') return exportFile(contract);
  if ((method === 'GET' && action === '') || method === 'POST') return { status: 200, json: sessionPayload(base, contract, who) };
  throw new C.AppError(404, 'NOT_FOUND', 'غير موجود');
}

module.exports = { whoFor, links, mutationFor, respond };
