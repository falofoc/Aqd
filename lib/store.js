'use strict';

// تخزين بسيط بملفات JSON (ملف لكل عقد) مع كتابة ذرّية وقفل لكل عقد.
// يكفي لعشرات الآلاف من العقود دون أي قاعدة بيانات خارجية.

const fs = require('node:fs');
const path = require('node:path');

class Store {
  constructor(dir) {
    this.dir = path.resolve(dir);
    fs.mkdirSync(this.dir, { recursive: true });
    this.contracts = new Map();
    this.tokens = new Map(); // token -> { id, type: 'owner' | 'party', partyId }
    this.locks = new Map();
    for (const f of fs.readdirSync(this.dir)) {
      if (!f.endsWith('.json')) continue;
      const c = JSON.parse(fs.readFileSync(path.join(this.dir, f), 'utf8'));
      this.index(c);
    }
  }

  index(c) {
    this.contracts.set(c.id, c);
    this.tokens.set(c.adminToken, { id: c.id, type: 'owner' });
    for (const p of c.parties) this.tokens.set(p.token, { id: c.id, type: 'party', partyId: p.id });
  }

  get(id) {
    return this.contracts.get(id) || null;
  }

  resolve(token) {
    const t = typeof token === 'string' && this.tokens.get(token);
    return t ? { ...t, contract: this.contracts.get(t.id) } : null;
  }

  async write(c) {
    const file = path.join(this.dir, `${c.id}.json`);
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    await fs.promises.writeFile(tmp, JSON.stringify(c, null, 2));
    await fs.promises.rename(tmp, file);
  }

  async create(c) {
    await this.write(c);
    this.index(c);
    return c;
  }

  // ينفّذ fn على نسخة من العقد ثم يحفظها؛ إن رمت fn خطأً لا يتغيّر شيء.
  update(id, fn) {
    const prev = this.locks.get(id) || Promise.resolve();
    const run = prev.catch(() => {}).then(async () => {
      const draft = structuredClone(this.contracts.get(id));
      const result = await fn(draft);
      await this.write(draft);
      this.contracts.set(id, draft);
      return { contract: draft, result };
    });
    this.locks.set(id, run);
    run.finally(() => { if (this.locks.get(id) === run) this.locks.delete(id); }).catch(() => {});
    return run;
  }
}

module.exports = { Store };
