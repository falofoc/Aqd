// Cloudflare Workers version of the portal.
// Data lives in D1 (one table of JSON documents), uploaded files in Workers KV,
// and the interface is served from public/ as static assets.
import core from '../lib/core.js';

const { createCore, SECURITY_HEADERS } = core;
const KV_MAX_MB = 25; // Workers KV values are limited to 25 MiB

class D1Store {
  constructor(db, kv) { this.db = db; this.kv = kv; this.ready = null; }
  ensure() {
    return (this.ready ||= this.db.prepare('CREATE TABLE IF NOT EXISTS docs (col TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY (col, id))').run());
  }
  async rows(sql, ...args) {
    await this.ensure();
    const { results } = await this.db.prepare(sql).bind(...args).all();
    return results.map((r) => JSON.parse(r.data));
  }
  all(col) { return this.rows('SELECT data FROM docs WHERE col = ?', col); }
  async get(col, id) { return (await this.rows('SELECT data FROM docs WHERE col = ? AND id = ?', col, id))[0] || null; }
  find(col, field, value) { return this.rows('SELECT data FROM docs WHERE col = ? AND json_extract(data, ?) = ?', col, '$.' + field, value); }
  stmt(col, doc) { return this.db.prepare('INSERT OR REPLACE INTO docs (col, id, data) VALUES (?, ?, ?)').bind(col, doc.id, JSON.stringify(doc)); }
  async put(col, doc) { await this.ensure(); await this.stmt(col, doc).run(); }
  async putMany(col, docs) { await this.ensure(); await this.db.batch(docs.map((d) => this.stmt(col, d))); }
  async del(col, id) { await this.ensure(); await this.db.prepare('DELETE FROM docs WHERE col = ? AND id = ?').bind(col, id).run(); }
  putFile(key, bytes) { return this.kv.put(key, bytes); }
  async getFile(key) { const b = await this.kv.get(key, 'arrayBuffer'); return b && new Uint8Array(b); }
  delFile(key) { return this.kv.delete(key); }
}

let handle = null;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

    if (!env.ADMIN_PASSWORD) {
      return Response.json({ message: 'Set the ADMIN_EMAIL and ADMIN_PASSWORD secrets in the Worker settings first.' }, { status: 503 });
    }
    handle ||= createCore({
      store: new D1Store(env.DB, env.FILES),
      adminEmail: env.ADMIN_EMAIL,
      adminPassword: env.ADMIN_PASSWORD,
      yearStart: Number(env.YEAR_START) || 2026,
      maxUploadMB: KV_MAX_MB,
    });
    const r = await handle({
      method: request.method,
      pathname: url.pathname,
      secure: url.protocol === 'https:',
      header: (n) => request.headers.get(n),
      body: async (limit) => {
        if (Number(request.headers.get('content-length') || 0) > limit) throw new core.AppError(413, 'File is larger than allowed');
        const b = new Uint8Array(await request.arrayBuffer());
        if (b.length > limit) throw new core.AppError(413, 'File is larger than allowed');
        return b;
      },
    });
    return new Response(r.body, { status: r.status, headers: { ...SECURITY_HEADERS, ...r.headers } });
  },
};
