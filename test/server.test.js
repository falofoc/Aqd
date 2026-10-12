'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('../server');

const IMG = 'data:image/png;base64,' + 'A'.repeat(400);

test('رحلة كاملة عبر HTTP: إنشاء، توقيع، تعديل، إعادة توقيع، اكتمال', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aqd-'));
  const server = createServer({ dataDir: dir });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, url, body) => {
    const res = await fetch(base + url, { method, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
    return { status: res.status, data: await res.json() };
  };
  try {
    const created = await call('POST', '/api/contracts', {
      title: 'عقد', body: 'نص', parties: [1, 2, 3, 4].map((i) => ({ name: `شريك ${i}` })),
    });
    assert.equal(created.status, 201);
    const tokens = created.data.parties.map((p) => p.signUrl.split('/').pop());
    const admin = created.data.adminUrl.split('/').pop();

    const s1 = await call('GET', `/api/session/${tokens[0]}`);
    assert.equal(s1.data.role, 'party');
    assert.equal(s1.data.parties[1].token, undefined, 'لا تُكشف روابط الآخرين');
    const sign = async (t, hash) => call('POST', `/api/session/${t}/sign`, { versionHash: hash, consent: true, image: IMG });

    await sign(tokens[0], s1.data.current.hash);
    await sign(tokens[1], s1.data.current.hash);

    const amended = await call('POST', `/api/session/${admin}/amend`, { baseHash: s1.data.current.hash, title: 'عقد', body: 'نص معدل', note: 'تعديل' });
    assert.equal(amended.status, 200);
    const h2 = amended.data.current.hash;
    assert.equal(amended.data.parties.filter((p) => p.state === 'signed').length, 0);

    const stale = await sign(tokens[2], s1.data.current.hash);
    assert.equal(stale.status, 409);

    for (const t of tokens.slice(0, 3)) assert.equal((await sign(t, h2)).status, 200);
    const last = await sign(tokens[3], h2);
    assert.equal(last.data.status, 'completed');

    const verify = await call('GET', `/api/verify/${created.data.id}`);
    assert.equal(verify.data.finalHash, last.data.finalHash);
    assert.equal((await call('POST', `/api/session/${admin}/constructor`, {})).status, 404);
    assert.equal((await call('GET', '/api/session/nope')).status, 404);

    // البيانات تبقى بعد إعادة التشغيل
    const again = createServer({ dataDir: dir });
    assert.ok(again);
  } finally {
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
