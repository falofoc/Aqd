'use strict';
// Storage for the Node server: one JSON file (atomic writes) + an uploads folder.

const fs = require('node:fs');
const path = require('node:path');

const COLS = ['users', 'requirements', 'submissions', 'sessions'];

class FileStore {
  constructor(dir) {
    this.file = path.join(dir, 'db.json');
    this.uploads = path.join(dir, 'uploads');
    fs.mkdirSync(this.uploads, { recursive: true });
    const d = fs.existsSync(this.file) ? JSON.parse(fs.readFileSync(this.file, 'utf8')) : {};
    this.d = {};
    for (const c of COLS) {
      const v = d[c] || {};
      // Older files kept arrays; documents are now keyed by id.
      this.d[c] = Array.isArray(v) ? Object.fromEntries(v.map((x) => [x.id, x])) : c === 'sessions' && v && !Object.values(v).every((s) => s.id) ? Object.fromEntries(Object.entries(v).map(([k, s]) => [k, { id: k, ...s }])) : v;
    }
  }
  save() {
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.d));
    fs.renameSync(tmp, this.file);
  }
  // Copies keep callers from mutating stored documents without a put().
  async all(col) { return Object.values(this.d[col]).map((x) => structuredClone(x)); }
  async get(col, id) { const x = this.d[col][id]; return x ? structuredClone(x) : null; }
  async find(col, field, value) { return (await this.all(col)).filter((x) => x[field] === value); }
  async put(col, doc) { this.d[col][doc.id] = structuredClone(doc); this.save(); }
  async putMany(col, docs) { for (const doc of docs) this.d[col][doc.id] = structuredClone(doc); this.save(); }
  async del(col, id) { delete this.d[col][id]; this.save(); }
  async putFile(key, bytes) { fs.writeFileSync(path.join(this.uploads, key), bytes); }
  async getFile(key) { try { return fs.readFileSync(path.join(this.uploads, key)); } catch { return null; } }
  async delFile(key) { fs.rmSync(path.join(this.uploads, key), { force: true }); }
}

module.exports = { FileStore };
