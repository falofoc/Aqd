'use strict';

// منطق العقد: الإصدارات، التوقيعات، طلبات التعديل، وسجل التدقيق المتسلسل.
// كل الدوال هنا نقية تقريباً: تستقبل كائن العقد وتعدّله، ولا تعرف شيئاً عن HTTP أو التخزين.

const crypto = require('node:crypto');

const MIN_PARTIES = 2;
const MAX_PARTIES = 10;
const DEFAULT_PARTIES = 4;

const LIMITS = {
  title: 200,
  body: 100000,
  name: 120,
  role: 120,
  email: 200,
  phone: 40,
  idNumber: 30,
  note: 500,
  reason: 1000,
  image: 400000,
};

const STATUS = {
  IN_PROGRESS: 'in_progress',
  CHANGES_REQUESTED: 'changes_requested',
  COMPLETED: 'completed',
  VOID: 'void',
};

class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const newToken = () => crypto.randomBytes(24).toString('base64url');
const newId = () => crypto.randomBytes(9).toString('base64url');
const now = () => new Date().toISOString();

function text(value, field, max, { required = true, multiline = false } = {}) {
  if (value === undefined || value === null) value = '';
  if (typeof value !== 'string') throw new AppError(400, 'INVALID_INPUT', `قيمة غير صالحة: ${field}`);
  let v = value.replace(/\r\n?/g, '\n');
  v = multiline ? v.replace(/[ \t]+$/gm, '').trim() : v.replace(/\s+/g, ' ').trim();
  if (required && !v) throw new AppError(400, 'REQUIRED', `الحقل مطلوب: ${field}`);
  if (v.length > max) throw new AppError(400, 'TOO_LONG', `الحقل طويل جداً: ${field}`);
  return v;
}

function email(value, field) {
  const v = text(value, field, LIMITS.email, { required: false });
  if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw new AppError(400, 'INVALID_EMAIL', `بريد إلكتروني غير صالح: ${field}`);
  return v.toLowerCase();
}

// ---------- البصمات ----------

function versionHash(contract, version) {
  return sha256(JSON.stringify({
    contractId: contract.id,
    n: version.n,
    title: version.title,
    body: version.body,
    parties: contract.parties.map((p) => ({ id: p.id, name: p.name, role: p.role, idNumber: p.idNumber || '' })),
  }));
}

function appendAudit(contract, action, { actor = null, details = {}, ip = null, ua = null } = {}) {
  const prev = contract.audit[contract.audit.length - 1];
  const entry = {
    seq: contract.audit.length + 1,
    at: now(),
    action,
    actor,
    details,
    ip,
    ua,
    prevHash: prev ? prev.hash : '0'.repeat(64),
  };
  entry.hash = sha256(entry.prevHash + JSON.stringify([entry.seq, entry.at, entry.action, entry.actor, entry.details, entry.ip, entry.ua]));
  contract.audit.push(entry);
  return entry;
}

function verifyAuditChain(contract) {
  let prevHash = '0'.repeat(64);
  for (const e of contract.audit) {
    if (e.prevHash !== prevHash) return false;
    const h = sha256(e.prevHash + JSON.stringify([e.seq, e.at, e.action, e.actor, e.details, e.ip, e.ua]));
    if (h !== e.hash) return false;
    prevHash = e.hash;
  }
  return true;
}

function finalHash(contract) {
  const v = currentVersion(contract);
  const sigs = signaturesFor(contract, v).map((s) => ({
    partyId: s.partyId, versionHash: s.versionHash, signedAt: s.signedAt, imageHash: sha256(s.image),
  }));
  return sha256(JSON.stringify({ versionHash: v.hash, signatures: sigs }));
}

// ---------- الحالة ----------

const currentVersion = (c) => c.versions[c.versions.length - 1];
const signaturesFor = (c, v) => c.signatures.filter((s) => s.versionN === v.n && s.versionHash === v.hash && !s.withdrawnAt);
const findParty = (c, partyId) => c.parties.find((p) => p.id === partyId);

function openObjections(c) {
  const v = currentVersion(c);
  return c.objections.filter((o) => o.versionN === v.n && !o.resolvedAt);
}

function status(c) {
  if (c.voidedAt) return STATUS.VOID;
  if (c.completedAt) return STATUS.COMPLETED;
  if (openObjections(c).length) return STATUS.CHANGES_REQUESTED;
  return STATUS.IN_PROGRESS;
}

function assertEditable(c) {
  const s = status(c);
  if (s === STATUS.COMPLETED) throw new AppError(409, 'COMPLETED', 'العقد مكتمل ومُقفل، لا يمكن تعديله أو توقيعه مجدداً.');
  if (s === STATUS.VOID) throw new AppError(409, 'VOID', 'تم إلغاء هذا العقد.');
}

// ---------- العمليات ----------

function createContract(input, ctx = {}) {
  if (!input || typeof input !== 'object') throw new AppError(400, 'INVALID_INPUT', 'بيانات غير صالحة');
  const title = text(input.title, 'عنوان العقد', LIMITS.title);
  const body = text(input.body, 'نص العقد', LIMITS.body, { multiline: true });
  const ownerName = text(input.ownerName, 'اسم منشئ العقد', LIMITS.name, { required: false });
  const rawParties = Array.isArray(input.parties) ? input.parties : [];
  if (rawParties.length < MIN_PARTIES || rawParties.length > MAX_PARTIES) {
    throw new AppError(400, 'PARTY_COUNT', `عدد الأطراف يجب أن يكون بين ${MIN_PARTIES} و ${MAX_PARTIES}.`);
  }
  const id = newId();
  const parties = rawParties.map((p, i) => ({
    id: `p${i + 1}`,
    name: text(p && p.name, `اسم الطرف ${i + 1}`, LIMITS.name),
    role: text(p && p.role, `صفة الطرف ${i + 1}`, LIMITS.role, { required: false }),
    email: email(p && p.email, `بريد الطرف ${i + 1}`),
    phone: text(p && p.phone, `جوال الطرف ${i + 1}`, LIMITS.phone, { required: false }),
    idNumber: text(p && p.idNumber, `رقم هوية الطرف ${i + 1}`, LIMITS.idNumber, { required: false }),
    token: id + newToken(),
    viewedVersions: [],
  }));
  const names = new Set(parties.map((p) => p.name));
  if (names.size !== parties.length) throw new AppError(400, 'DUPLICATE_PARTY', 'أسماء الأطراف يجب أن تكون مختلفة.');

  const contract = {
    schema: 1,
    id,
    adminToken: id + newToken(),
    ownerName,
    allowPartyEdits: input.allowPartyEdits !== false,
    createdAt: now(),
    parties,
    versions: [],
    signatures: [],
    objections: [],
    audit: [],
    completedAt: null,
    finalHash: null,
    voidedAt: null,
    voidReason: null,
  };
  const v = { n: 1, title, body, note: 'الإصدار الأول', createdAt: contract.createdAt, createdBy: { type: 'owner', name: ownerName || 'منشئ العقد' } };
  v.hash = versionHash(contract, v);
  contract.versions.push(v);
  appendAudit(contract, 'created', {
    actor: { type: 'owner', name: v.createdBy.name },
    details: { version: 1, hash: v.hash, parties: parties.map((p) => p.name) },
    ip: ctx.ip, ua: ctx.ua,
  });
  return contract;
}

function actorFor(c, who) {
  if (who.type === 'owner') return { type: 'owner', name: c.ownerName || 'منشئ العقد' };
  const p = findParty(c, who.partyId);
  return { type: 'party', id: p.id, name: p.name };
}

function markViewed(c, partyId, ctx = {}) {
  const p = findParty(c, partyId);
  const v = currentVersion(c);
  if (!p || p.viewedVersions.includes(v.n)) return false;
  p.viewedVersions.push(v.n);
  appendAudit(c, 'viewed', { actor: actorFor(c, { type: 'party', partyId }), details: { version: v.n }, ip: ctx.ip, ua: ctx.ua });
  return true;
}

function sign(c, partyId, input, ctx = {}) {
  assertEditable(c);
  const p = findParty(c, partyId);
  if (!p) throw new AppError(404, 'NOT_FOUND', 'الطرف غير موجود');
  const v = currentVersion(c);
  if (!input || input.versionHash !== v.hash) {
    throw new AppError(409, 'VERSION_CHANGED', 'تم تعديل العقد أثناء مراجعتك. يرجى مراجعة النسخة الجديدة ثم التوقيع.');
  }
  if (input.consent !== true) throw new AppError(400, 'CONSENT_REQUIRED', 'يجب الإقرار بالموافقة على التوقيع الإلكتروني.');
  if (signaturesFor(c, v).some((s) => s.partyId === partyId)) {
    throw new AppError(409, 'ALREADY_SIGNED', 'لقد وقّعت على هذه النسخة مسبقاً.');
  }
  const method = input.method === 'type' ? 'type' : 'draw';
  const image = typeof input.image === 'string' ? input.image : '';
  if (!/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(image) || image.length > LIMITS.image || image.length < 200) {
    throw new AppError(400, 'INVALID_SIGNATURE', 'صورة التوقيع غير صالحة. يرجى التوقيع مرة أخرى.');
  }
  const typedName = method === 'type' ? text(input.typedName, 'الاسم المكتوب', LIMITS.name) : '';

  const sig = {
    partyId, versionN: v.n, versionHash: v.hash, method, typedName, image,
    signedAt: now(), ip: ctx.ip || null, ua: ctx.ua || null,
  };
  c.signatures.push(sig);
  for (const o of c.objections) {
    if (o.partyId === partyId && o.versionN === v.n && !o.resolvedAt) o.resolvedAt = sig.signedAt;
  }
  appendAudit(c, 'signed', {
    actor: actorFor(c, { type: 'party', partyId }),
    details: { version: v.n, hash: v.hash, method, imageHash: sha256(image) },
    ip: ctx.ip, ua: ctx.ua,
  });

  if (signaturesFor(c, v).length === c.parties.length) {
    c.completedAt = now();
    c.finalHash = finalHash(c);
    appendAudit(c, 'completed', {
      actor: { type: 'system', name: 'النظام' },
      details: { version: v.n, hash: v.hash, finalHash: c.finalHash },
    });
  }
  return sig;
}

function requestChanges(c, partyId, input, ctx = {}) {
  assertEditable(c);
  const v = currentVersion(c);
  const reason = text(input && input.reason, 'سبب طلب التعديل', LIMITS.reason, { multiline: true });
  // من يطلب تعديلاً يسحب موافقته على النسخة الحالية إن كان قد وقّعها.
  const o = { partyId, versionN: v.n, reason, at: now(), resolvedAt: null };
  for (const s of signaturesFor(c, v)) if (s.partyId === partyId) s.withdrawnAt = o.at;
  c.objections.push(o);
  appendAudit(c, 'changes_requested', { actor: actorFor(c, { type: 'party', partyId }), details: { version: v.n, reason }, ip: ctx.ip, ua: ctx.ua });
  return o;
}

function amend(c, who, input, ctx = {}) {
  assertEditable(c);
  if (who.type === 'party' && !c.allowPartyEdits) {
    throw new AppError(403, 'EDIT_FORBIDDEN', 'تعديل النص متاح لمنشئ العقد فقط. يمكنك تقديم طلب تعديل.');
  }
  const prev = currentVersion(c);
  if (!input || input.baseHash !== prev.hash) {
    throw new AppError(409, 'VERSION_CHANGED', 'قام طرف آخر بتعديل العقد قبلك. تم تحميل أحدث نسخة، يرجى إعادة تطبيق تعديلك.');
  }
  const title = text(input.title, 'عنوان العقد', LIMITS.title);
  const body = text(input.body, 'نص العقد', LIMITS.body, { multiline: true });
  const note = text(input.note, 'وصف التعديل', LIMITS.note);
  if (title === prev.title && body === prev.body) throw new AppError(400, 'NO_CHANGES', 'لم يتم إجراء أي تغيير على النص.');

  const invalidated = signaturesFor(c, prev).map((s) => findParty(c, s.partyId).name);
  const actor = actorFor(c, who);
  const v = { n: prev.n + 1, title, body, note, createdAt: now(), createdBy: actor };
  v.hash = versionHash(c, v);
  c.versions.push(v);
  for (const o of c.objections) if (!o.resolvedAt) o.resolvedAt = v.createdAt;
  appendAudit(c, 'amended', {
    actor,
    details: { fromVersion: prev.n, version: v.n, hash: v.hash, note, invalidatedSignatures: invalidated },
    ip: ctx.ip, ua: ctx.ua,
  });
  return v;
}

function voidContract(c, input, ctx = {}) {
  assertEditable(c);
  const reason = text(input && input.reason, 'سبب الإلغاء', LIMITS.reason, { multiline: true });
  c.voidedAt = now();
  c.voidReason = reason;
  appendAudit(c, 'voided', { actor: actorFor(c, { type: 'owner' }), details: { reason }, ip: ctx.ip, ua: ctx.ua });
}

// ---------- العرض ----------

function view(c, who) {
  const v = currentVersion(c);
  const current = signaturesFor(c, v);
  const objections = openObjections(c);
  const parties = c.parties.map((p) => {
    const sig = current.find((s) => s.partyId === p.id);
    const last = [...c.signatures].reverse().find((s) => s.partyId === p.id && !s.withdrawnAt);
    const obj = objections.find((o) => o.partyId === p.id);
    return {
      id: p.id,
      name: p.name,
      role: p.role,
      idNumber: p.idNumber || '',
      ...(who.type === 'owner' ? { email: p.email, phone: p.phone, token: p.token } : {}),
      state: sig ? 'signed' : obj ? 'objected' : 'pending',
      signedAt: sig ? sig.signedAt : null,
      objection: obj ? { reason: obj.reason, at: obj.at } : null,
      viewedCurrent: p.viewedVersions.includes(v.n),
      lastSignedVersion: last ? last.versionN : null,
      isMe: who.type === 'party' && who.partyId === p.id,
    };
  });
  return {
    id: c.id,
    status: status(c),
    allowPartyEdits: c.allowPartyEdits,
    ownerName: c.ownerName,
    createdAt: c.createdAt,
    completedAt: c.completedAt,
    finalHash: c.finalHash,
    voidedAt: c.voidedAt,
    voidReason: c.voidReason,
    auditChainValid: verifyAuditChain(c),
    me: who.type === 'party' ? who.partyId : null,
    role: who.type,
    current: v,
    versions: c.versions,
    parties,
    signatures: current.map((s) => ({
      partyId: s.partyId, method: s.method, typedName: s.typedName, image: s.image, signedAt: s.signedAt, ip: s.ip,
    })),
    audit: c.audit.map((e) => ({ seq: e.seq, at: e.at, action: e.action, actor: e.actor, details: e.details, ip: e.ip, hash: e.hash })),
  };
}

function publicSummary(c) {
  const v = currentVersion(c);
  const current = signaturesFor(c, v);
  return {
    id: c.id,
    title: v.title,
    status: status(c),
    version: v.n,
    versionHash: v.hash,
    finalHash: c.finalHash,
    completedAt: c.completedAt,
    auditChainValid: verifyAuditChain(c),
    parties: c.parties.map((p) => {
      const s = current.find((x) => x.partyId === p.id);
      return { name: p.name, role: p.role, signedAt: s ? s.signedAt : null };
    }),
  };
}

module.exports = {
  AppError, STATUS, LIMITS, ID_LENGTH: 12, MIN_PARTIES, MAX_PARTIES, DEFAULT_PARTIES,
  createContract, markViewed, sign, requestChanges, amend, voidContract,
  view, publicSummary, status, currentVersion, verifyAuditChain, sha256,
};
