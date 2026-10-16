// نسخة «عَقد» لـ Cloudflare Workers.
// كل عقد يعيش في Durable Object خاص به (تخزين دائم ومتسق، وطلب واحد في كل مرة)،
// والواجهة تُقدَّم من الملفات الثابتة في public/.
import { DurableObject } from 'cloudflare:workers';
import C from '../lib/contracts.js';
import S from '../lib/session.js';

const MAX_BODY = 1024 * 1024;

const SECURITY_HEADERS = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'self'",
  ].join('; '),
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

function withHeaders(res, extra = {}) {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries({ ...SECURITY_HEADERS, ...extra })) out.headers.set(k, v);
  return out;
}

const json = (status, data) => withHeaders(new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
}));

function errorResult(err) {
  if (err instanceof C.AppError || (err && err.status && err.code)) {
    return { status: err.status, json: { error: err.code, message: err.message } };
  }
  console.error(err);
  return { status: 500, json: { error: 'INTERNAL', message: 'حدث خطأ غير متوقع.' } };
}

function toResponse(r) {
  if (r.json) return json(r.status, r.json);
  return withHeaders(new Response(r.body, { status: r.status, headers: r.headers }));
}

async function readJson(request) {
  const text = await request.text();
  if (text.length > MAX_BODY) throw new C.AppError(413, 'TOO_LARGE', 'حجم الطلب كبير جداً');
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new C.AppError(400, 'BAD_JSON', 'صيغة البيانات غير صالحة');
  }
}

export class ContractObject extends DurableObject {
  async load() {
    if (this.contract === undefined) this.contract = (await this.ctx.storage.get('contract')) || null;
    return this.contract;
  }

  async save(c) {
    await this.ctx.storage.put('contract', c);
    this.contract = c;
  }

  async init(contract) {
    if (await this.load()) return { status: 409, json: { error: 'EXISTS', message: 'تعذّر إنشاء العقد، حاول مجدداً.' } };
    await this.save(contract);
    return { status: 201 };
  }

  async verify() {
    const c = await this.load();
    if (!c) return { status: 404, json: { error: 'NOT_FOUND', message: 'لا يوجد عقد بهذا المعرّف.' } };
    return { status: 200, json: C.publicSummary(c) };
  }

  async session(token, method, action, body, ctx, base) {
    try {
      let c = await this.load();
      const who = S.whoFor(c, token);
      if (!who) throw new C.AppError(404, 'NOT_FOUND', 'الرابط غير صحيح أو منتهي.');
      const fn = S.mutationFor(c, who, method, action, body, ctx);
      if (fn) {
        const draft = structuredClone(c);
        fn(draft);
        await this.save(draft);
        c = draft;
      }
      return S.respond(base, c, who, method, action);
    } catch (err) {
      return errorResult(err);
    }
  }
}

const stubFor = (env, id) => env.CONTRACTS.get(env.CONTRACTS.idFromName(id));
const validId = (id) => typeof id === 'string' && /^[\w-]+$/.test(id) && id.length >= C.ID_LENGTH;

async function api(request, env, parts) {
  const method = request.method;
  const url = new URL(request.url);
  const base = (env.BASE_URL || url.origin).replace(/\/+$/, '');
  const ctx = {
    ip: request.headers.get('cf-connecting-ip'),
    ua: (request.headers.get('user-agent') || '').slice(0, 300),
  };

  if (parts[0] === 'contracts' && parts.length === 1 && method === 'POST') {
    const c = C.createContract(await readJson(request), ctx);
    const r = await stubFor(env, c.id).init(c);
    if (r.status !== 201) return toResponse(r);
    return json(201, { id: c.id, ...S.links(base, c) });
  }

  if (parts[0] === 'verify' && parts.length === 2 && method === 'GET') {
    if (!validId(parts[1])) throw new C.AppError(404, 'NOT_FOUND', 'لا يوجد عقد بهذا المعرّف.');
    return toResponse(await stubFor(env, parts[1]).verify());
  }

  if (parts[0] === 'session' && parts[1] && parts.length <= 3) {
    const token = parts[1];
    if (!validId(token) || token.length <= C.ID_LENGTH) throw new C.AppError(404, 'NOT_FOUND', 'الرابط غير صحيح أو منتهي.');
    const body = method === 'POST' ? await readJson(request) : {};
    const stub = stubFor(env, token.slice(0, C.ID_LENGTH));
    return toResponse(await stub.session(token, method, parts[2] || '', body, ctx, base));
  }

  throw new C.AppError(404, 'NOT_FOUND', 'غير موجود');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/healthz') return json(200, { ok: true });
      if (url.pathname.startsWith('/api/')) return await api(request, env, url.pathname.slice(5).split('/').filter(Boolean));
      const res = await env.ASSETS.fetch(request);
      const isHtml = (res.headers.get('content-type') || '').includes('text/html');
      return withHeaders(res, isHtml ? { 'Cache-Control': 'no-store' } : {});
    } catch (err) {
      return toResponse(errorResult(err));
    }
  },
};
