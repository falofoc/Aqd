'use strict';
// Intensive grading checks with shuffled choices.
// Expected scores are computed independently of the server's grading: from the TEXT of the choices each trainee
// saw on screen and the TEXT of the correct answers in the answer key.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../server');
const { FileStore } = require('../lib/file-store');

const TRAINEES = Number(process.env.GRADING_TRAINEES) || 40; // GRADING_TRAINEES=200 for the full run

function server(store) {
  const srv = createApp({ store, adminEmail: 'a@x.sa', adminPassword: 'adminpass' });
  return new Promise((r) => srv.listen(0, () => r(srv)));
}
function client(srv) {
  const base = `http://localhost:${srv.address().port}/api/`;
  return async (p, { body, cookie } = {}) => {
    const r = await fetch(base + p, { method: body ? 'POST' : 'GET', body: body && JSON.stringify(body), headers: { 'X-Requested-With': 'portal', 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) } });
    return { status: r.status, data: await r.json().catch(() => null), cookie: (r.headers.get('set-cookie') || '').split(';')[0] };
  };
}
// A small seeded random generator, so a failure can be reproduced.
function rng(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0) / 4294967296); }
const sameSet = (a, b) => a.length === b.length && [...a].sort().join('\u0000') === [...b].sort().join('\u0000');

test(`grading with shuffled choices: ${TRAINEES} trainees, exclusions, key changes, restart`, { timeout: 300000 }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grading-'));
  const store = new FileStore(dir);
  const realSave = store.save.bind(store);
  store.save = () => {}; // fast while the trainees sit the exam; written to disk before the restart check
  let srv = await server(store);
  let call = client(srv);
  const rand = rng(20261111);
  try {
    const admin = (await call('login', { body: { email: 'a@x.sa', password: 'adminpass' } })).cookie;
    await call('admin/exams/t1', { cookie: admin, body: { openAt: new Date(Date.now() - 6e4).toISOString(), closeAt: new Date(Date.now() + 36e5).toISOString() } });
    let { exam } = (await call('admin/exams/t1', { cookie: admin })).data;

    // Precondition: within a question no two choices have the same text (otherwise "by text" would be ambiguous).
    for (const it of exam.items) assert.equal(new Set(it.options.map((o) => o.text)).size, it.options.length, `duplicate choice text in ${it.id}`);

    const keyTextOf = (ex) => Object.fromEntries(ex.items.map((it) => [it.id, (Array.isArray(it.answer) ? it.answer : [it.answer]).map((id) => it.options.find((o) => o.id === id).text)]));
    let keyText = keyTextOf(exam);

    let alt = {};
    const sat = []; // what each trainee saw and chose, all as text
    for (let n = 0; n < TRAINEES; n++) {
      const nid = String(3000000000 + n);
      const st = (await call('exam/t1/start', { body: { name: `Trainee Number ${n}`, scfhs: nid, password: 'AFHSR26' } })).data;
      assert.ok(st.token, 'started');
      assert.ok(!JSON.stringify(st).includes('"answer"'), 'no answer key is sent to the trainee');
      const chosen = {}, shown = {};
      let seq = 0;
      for (const [pi, part] of st.parts.entries()) {
        for (const q of part.questions) {
          const texts = q.options.map((o) => o.text);
          shown[q.id] = texts;
          const byText = (t) => q.options.find((o) => o.text === t).id;
          const r = rand();
          let pick; // as text
          if (r < 0.08) pick = null; // left blank
          else if (q.multi) {
            const k = 1 + Math.floor(rand() * texts.length);
            pick = r < 0.5 ? keyText[q.id] : [...texts].sort(() => rand() - 0.5).slice(0, k); // exact key, or a random subset
          } else pick = r < 0.55 ? keyText[q.id][0] : texts[Math.floor(rand() * texts.length)];
          // sometimes a first, different choice, replaced later (the later save must win)
          if (rand() < 0.2) {
            const first = texts[Math.floor(rand() * texts.length)];
            await call('exam/attempt/answer', { body: { token: st.token, itemId: q.id, optionId: q.multi ? [byText(first)] : byText(first), seq: ++seq } });
          }
          const optionId = pick === null ? null : q.multi ? pick.map(byText) : byText(pick);
          const res = await call('exam/attempt/answer', { body: { token: st.token, itemId: q.id, optionId, seq: ++seq } });
          assert.equal(res.status, 200, JSON.stringify(res.data));
          // an older save arriving late must not overwrite the answer
          if (rand() < 0.1) await call('exam/attempt/answer', { body: { token: st.token, itemId: q.id, optionId: q.multi ? [byText(texts[0])] : byText(texts[0]), seq: 0 } });
          if (pick !== null && !(q.multi && !pick.length)) chosen[q.id] = q.multi ? pick : [pick];
        }
        if (pi < st.parts.length - 1) await call('exam/attempt/next-part', { body: { token: st.token, from: pi } });
      }
      await call('exam/attempt/submit', { body: { token: st.token } });
      sat.push({ nid, chosen, shown });
    }

    // Independent expected scores (by text), overall and per part.
    const partOf = (it) => it.part || exam.parts[0].id;
    const expect = (ex, kt, s) => {
      const live = ex.items.filter((it) => !it.excluded);
      const right = (it) => !!s.chosen[it.id] && (sameSet(s.chosen[it.id], kt[it.id]) || (alt[it.id] || []).some((t) => sameSet(s.chosen[it.id], t)));
      const score = live.filter(right).length;
      const byPart = Object.fromEntries(ex.parts.map((pt) => [pt.id, live.filter((it) => partOf(it) === pt.id && right(it)).length]));
      return { score, total: live.length, percent: Math.round((score / live.length) * 1000) / 10, byPart };
    };
    const check = async (label) => {
      ({ exam } = (await call('admin/exams/t1', { cookie: admin })).data);
      const kt = keyTextOf(exam);
      // answers also accepted after an item review count as right too
      alt = Object.fromEntries(exam.items.map((it) => [it.id, (it.alsoAccept || []).map((id) => [it.options.find((o) => o.id === id).text])]));
      const res = (await call('admin/exams/t1', { cookie: admin })).data.attempts;
      let checked = 0;
      for (const s of sat) {
        const a = res.find((x) => x.scfhs === s.nid), e = expect(exam, kt, s);
        assert.ok(a && a.submittedAt, `${label}: ${s.nid} submitted`);
        assert.deepEqual([a.score, a.total, a.percent], [e.score, e.total, e.percent], `${label}: ${s.nid} score`);
        for (const pt of exam.parts) assert.equal(a.byPart[pt.id].score, e.byPart[pt.id], `${label}: ${s.nid} ${pt.id}`);
        // the stored answers are exactly the last choices made, mapped back to text
        for (const it of exam.items) {
          const stored = a.answers[it.id];
          const storedText = stored === undefined || stored === null ? undefined : (Array.isArray(stored) ? stored : [stored]).map((id) => it.options.find((o) => o.id === id).text);
          assert.ok(storedText === undefined ? !s.chosen[it.id] : sameSet(storedText, s.chosen[it.id]), `${label}: ${s.nid} answer ${it.id}`);
        }
        checked++;
      }
      return checked;
    };

    assert.equal(await check('after the exam'), TRAINEES);

    // The shuffling is real: for each shuffled question the correct choice appears in several positions.
    for (const it of exam.items.filter((x) => !x.fixedOptions && !x.multi)) {
      const positions = new Set(sat.map((s) => s.shown[it.id].indexOf(keyText[it.id][0])));
      assert.ok(positions.size >= Math.min(3, it.options.length), `${it.id}: correct answer seen in ${positions.size} positions`);
    }
    // Curve questions keep their order for everyone.
    for (const it of exam.items.filter((x) => x.fixedOptions)) assert.equal(new Set(sat.map((s) => s.shown[it.id].join('|'))).size, 1);
    // Not everyone sees the same order.
    const orders = new Set(sat.map((s) => exam.items.map((it) => s.shown[it.id].join('|')).join('#')));
    assert.equal(orders.size, TRAINEES, 'every trainee has a different set of orders');

    // Excluding two questions re-grades everyone (out of 49).
    for (const id of [exam.items[3].id, exam.items[40].id]) await call(`admin/exams/t1/items/${id}`, { cookie: admin, body: { excluded: true } });
    assert.equal(await check('after excluding 2 questions'), TRAINEES);

    // Changing the correct answer of a question re-grades everyone by the new key.
    const it = exam.items.find((x) => !x.multi && !x.excluded && !x.fixedOptions);
    const other = it.options.find((o) => o.id !== it.answer).id;
    await call(`admin/exams/t1/items/${it.id}`, { cookie: admin, body: { answer: other } });
    assert.equal(await check('after changing an answer key'), TRAINEES);

    // Restart the server from what is on disk: same results.
    const before = (await call('admin/exams/t1', { cookie: admin })).data.attempts;
    realSave();
    srv.close();
    srv = await server(new FileStore(dir));
    call = client(srv);
    const admin2 = (await call('login', { body: { email: 'a@x.sa', password: 'adminpass' } })).cookie;
    const after = (await call('admin/exams/t1', { cookie: admin2 })).data.attempts;
    assert.equal(after.length, TRAINEES);
    for (const a of before) assert.deepEqual([after.find((x) => x.id === a.id).score, after.find((x) => x.id === a.id).total], [a.score, a.total], 'same score after a restart');
  } finally { srv.close(); }
});
