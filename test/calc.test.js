'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { evaluate: ev, fmt, stats, parseList, toFraction, pretty } = require('../public/calc.js');

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);

test('calculator: arithmetic, precedence and formatting', () => {
  assert.equal(ev('2+3*4'), 14);
  assert.equal(ev('(2+3)*4'), 20);
  assert.equal(ev('2^3^2'), 512);
  assert.equal(ev('-2^2'), -4);
  assert.equal(ev('2^-1'), 0.5);
  assert.equal(ev('10 ÷ 4 × 2 − 1'), 4);
  assert.equal(fmt(ev('0.1+0.2')), '0.3');
  assert.equal(ev('5!'), 120);
  assert.equal(ev('nCr(5,2)'), 10);
  assert.equal(ev('nPr(5;2)'), 20);
  assert.equal(ev('50%'), 0.5);
  assert.equal(ev('2(3+4)'), 14);
  near(ev('2π'), 2 * Math.PI);
  near(ev('ln(e)'), 1);
  assert.equal(ev('log(1000)'), 3);
  assert.equal(ev('√(144)'), 12);
  assert.equal(ev('sqrt(16)+1'), 5);
  near(ev('exp(1)'), Math.E);
  assert.equal(ev('1.5e3'), 1500);
  assert.equal(ev('ans*2', 21), 42);
  assert.throws(() => ev('2+'));
  assert.throws(() => ev('(2+3'));
  assert.throws(() => ev('2)'));
  assert.equal(fmt(1 / 0), '∞');
});

test('calculator: exam-style calculations', () => {
  // 95% CI of a mean: 120 ± 1.96 × 20/√100
  near(ev('120 - 1.96*20/√100'), 116.08);
  near(ev('120 + 1.96 × 20/√(100)'), 123.92);
  // case fatality rate 5/20, secondary attack rate 20/(600-1)
  assert.equal(ev('5/20*100'), 25);
  assert.equal(fmt(ev('20/(1000*0.4-1)*100')), '5.01253132832');
  // SD from variance
  assert.equal(ev('√144'), 12);
});

test('statistics helper (1-Var Stats as on the TI-30XS)', () => {
  const r = stats(parseList('65, 72, 68, 80, 70'));
  assert.equal(r.n, 5);
  assert.equal(r.mean, 71);
  assert.equal(r.median, 70);
  assert.equal(r.sum, 355);
  near(r.sd, Math.sqrt(32));
  near(r.sdP, Math.sqrt(128 / 5));
  assert.deepEqual([r.min, r.q1, r.q3, r.max], [65, 66.5, 76, 80]);
  assert.equal(stats(parseList('4 1 3 2')).median, 2.5);
  assert.deepEqual(parseList('١٢، 5;6'), [12, 5, 6]);
  assert.equal(stats([]), null);
  assert.equal('mode' in r || 'cv' in r || 'ciLo' in r, false, 'only what an approved exam calculator shows');
});

test('fractions: entry, display and F<>D conversion', () => {
  assert.equal(ev('(3)/(8)'), 0.375);
  assert.deepEqual(toFraction(0.375), { n: 3, d: 8 });
  assert.deepEqual(toFraction(ev('1/3+1/6')), { n: 1, d: 2 });
  assert.deepEqual(toFraction(-0.25), { n: -1, d: 4 });
  assert.equal(toFraction(2), null);
  assert.equal(toFraction(Math.PI), null);
  assert.equal(ev('2^-1'), 0.5);
  assert.match(pretty('(5)/(20)'), /class="mf".*5.*20/);
  assert.match(pretty('20/(1000×0.4−1)'), /<span class="mn">20<\/span><span class="md">1000 × 0.4 − 1<\/span>/);
  assert.match(pretty('√(144)'), /class="mr"/);
});
