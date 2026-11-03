'use strict';
// Scientific calculator and statistics helper for the exam screen.
// The expression parser is our own (no eval): + − × ÷ ^ ( ) % ! π e, implicit multiplication,
// and the functions √ ln log exp sin cos tan abs nCr nPr.
(function (root) {
  const FN = {
    sqrt: Math.sqrt, ln: Math.log, log: Math.log10, exp: Math.exp, abs: Math.abs,
    sin: (x) => Math.sin(x * Math.PI / 180), cos: (x) => Math.cos(x * Math.PI / 180), tan: (x) => Math.tan(x * Math.PI / 180),
  };
  const FN2 = { ncr: (n, r) => fact(n) / (fact(r) * fact(n - r)), npr: (n, r) => fact(n) / fact(n - r) };
  function fact(n) {
    if (n < 0 || !Number.isInteger(n)) throw new Error('n! needs a whole number ≥ 0');
    if (n > 170) return Infinity;
    let r = 1; for (let i = 2; i <= n; i++) r *= i; return r;
  }

  function tokenize(src) {
    const s = String(src).replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/√/g, 'sqrt').replace(/π/g, 'pi').toLowerCase();
    const out = [];
    for (let i = 0; i < s.length;) {
      const c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      const num = s.slice(i).match(/^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/);
      if (num) { out.push({ t: 'n', v: parseFloat(num[0]) }); i += num[0].length; continue; }
      const word = s.slice(i).match(/^[a-z]+/);
      if (word) {
        const w = word[0];
        if (w === 'pi') out.push({ t: 'n', v: Math.PI });
        else if (w === 'e') out.push({ t: 'n', v: Math.E });
        else if (w === 'ans') out.push({ t: 'ans' });
        else if (FN[w] || FN2[w]) out.push({ t: 'f', v: w });
        else throw new Error(`Unknown: ${w}`);
        i += w.length; continue;
      }
      if ('+-*/^()%!'.includes(c)) { out.push({ t: c }); i++; continue; }
      if (c === ',' || c === ';') { out.push({ t: ';' }); i++; continue; }
      throw new Error(`Unexpected “${c}”`);
    }
    return out;
  }

  // expr := term (('+'|'-') term)* ; term := unary (('*'|'/'|implicit) unary)* ; unary := '-' unary | power
  // power := postfix ('^' unary)? ; postfix := atom ('!'|'%')* ; atom := number | ans | fn atom | '(' expr ')'
  function evaluate(src, ans = 0) {
    const tk = tokenize(src);
    if (!tk.length) throw new Error('Empty');
    let i = 0;
    const peek = () => tk[i], next = () => tk[i++];
    const expect = (t) => { if (!tk[i] || tk[i].t !== t) throw new Error(t === ')' ? 'Missing )' : `Expected ${t}`); i++; };
    const startsAtom = (x) => x && (x.t === 'n' || x.t === 'ans' || x.t === 'f' || x.t === '(');
    function expr() {
      let v = term();
      while (peek() && (peek().t === '+' || peek().t === '-')) { const o = next().t; const r = term(); v = o === '+' ? v + r : v - r; }
      return v;
    }
    function term() {
      let v = unary();
      for (;;) {
        const p = peek();
        if (p && (p.t === '*' || p.t === '/')) { next(); const r = unary(); v = p.t === '*' ? v * r : v / r; }
        else if (startsAtom(p)) v *= unary(); // 2π, 3(4+1), 2√9
        else return v;
      }
    }
    function unary() {
      if (peek() && peek().t === '-') { next(); return -unary(); }
      if (peek() && peek().t === '+') { next(); return unary(); }
      return power();
    }
    function power() {
      const b = postfix();
      if (peek() && peek().t === '^') { next(); return Math.pow(b, unary()); }
      return b;
    }
    function postfix() {
      let v = atom();
      while (peek() && (peek().t === '!' || peek().t === '%')) v = next().t === '!' ? fact(v) : v / 100;
      return v;
    }
    function atom() {
      const x = next();
      if (!x) throw new Error('Incomplete expression');
      if (x.t === 'n') return x.v;
      if (x.t === 'ans') return ans;
      if (x.t === '(') { const v = expr(); expect(')'); return v; }
      if (x.t === 'f') {
        if (FN2[x.v]) { expect('('); const a = expr(); const b = sepArg(); expect(')'); return FN2[x.v](a, b); }
        return FN[x.v](peek() && peek().t === '(' ? atom() : power());
      }
      throw new Error('Incomplete expression');
    }
    // nCr(n, r): the second argument follows ',' or ';'
    function sepArg() { if (peek() && peek().t === ';') next(); return expr(); }
    const v = expr();
    if (i < tk.length) throw new Error(tk[i].t === ')' ? 'Extra )' : 'Check the expression');
    if (Number.isNaN(v)) throw new Error('Not a number');
    return v;
  }

  // 12 significant digits removes floating-point noise (0.1+0.2 → 0.3)
  function fmt(v) {
    if (!Number.isFinite(v)) return v > 0 ? '∞' : v < 0 ? '−∞' : 'Error';
    if (v === 0) return '0';
    const a = Math.abs(v);
    if (a >= 1e12 || a < 1e-9) return v.toExponential(6).replace(/\.?0+e/, 'e');
    return String(parseFloat(v.toPrecision(12)));
  }

  function parseList(text) {
    return String(text).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).split(/[\s,;،]+/).filter(Boolean).map(Number).filter((x) => Number.isFinite(x));
  }
  function stats(xs) {
    const n = xs.length;
    if (!n) return null;
    const s = [...xs].sort((a, b) => a - b);
    const sum = xs.reduce((a, b) => a + b, 0), mean = sum / n;
    const q = (p) => { const k = (n - 1) * p, lo = Math.floor(k), hi = Math.ceil(k); return s[lo] + (s[hi] - s[lo]) * (k - lo); };
    const ss = xs.reduce((a, x) => a + (x - mean) ** 2, 0);
    const varS = n > 1 ? ss / (n - 1) : NaN, varP = ss / n;
    const sd = Math.sqrt(varS), se = sd / Math.sqrt(n);
    const counts = new Map(); xs.forEach((x) => counts.set(x, (counts.get(x) || 0) + 1));
    const top = Math.max(...counts.values());
    const mode = top > 1 ? [...counts].filter(([, c]) => c === top).map(([x]) => x).sort((a, b) => a - b) : [];
    const geo = s[0] > 0 ? Math.exp(xs.reduce((a, x) => a + Math.log(x), 0) / n) : NaN;
    return { n, sum, mean, median: q(0.5), mode, min: s[0], max: s[n - 1], range: s[n - 1] - s[0], q1: q(0.25), q3: q(0.75), iqr: q(0.75) - q(0.25),
      varS, varP, sd, sdP: Math.sqrt(varP), se, cv: mean ? (sd / Math.abs(mean)) * 100 : NaN, ciLo: mean - 1.96 * se, ciHi: mean + 1.96 * se, geo, sorted: s };
  }

  const api = { evaluate, fmt, parseList, stats };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;

  // ---------- UI ----------
  const KEYS = [
    ['sqrt(', '√'], ['^2', 'x²'], ['^', 'xʸ'], ['ln(', 'ln'], ['log(', 'log'],
    ['exp(', 'eˣ'], ['1/', '1/x'], ['!', 'n!'], ['nCr(', 'nCr'], ['π', 'π'],
    ['(', '('], [')', ')'], ['%', '%'], ['AC', 'AC'], ['DEL', '⌫'],
    ['7', '7'], ['8', '8'], ['9', '9'], ['÷', '÷'], ['ans', 'Ans'],
    ['4', '4'], ['5', '5'], ['6', '6'], ['×', '×'], [',', ','],
    ['1', '1'], ['2', '2'], ['3', '3'], ['−', '−'], ['e', 'e'],
    ['0', '0'], ['.', '.'], ['E', 'EXP'], ['+', '+'], ['=', '='],
  ];
  let el = null, state = { expr: '', ans: 0, hist: [], tab: 'calc', list: '' }, justEq = false;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function preview() {
    if (!state.expr.trim()) return '';
    try { return '= ' + fmt(evaluate(closeParens(state.expr), state.ans)); } catch { return ''; }
  }
  const closeParens = (s) => s + ')'.repeat(Math.max(0, (s.match(/\(/g) || []).length - (s.match(/\)/g) || []).length));

  function press(k) {
    const inp = el.querySelector('.cx-in');
    // After "=", a number or function starts a new calculation; an operator continues from the result.
    if (justEq && !['=', 'DEL', '^2', '^', '!', '%', '÷', '×', '−', '+', ')', ',', 'E'].includes(k)) state.expr = '';
    justEq = false;
    if (k === 'AC') state.expr = '';
    else if (k === 'DEL') state.expr = state.expr.replace(/(sqrt\(|ln\(|log\(|exp\(|nCr\(|ans|.)$/, '');
    else if (k === '=') return equals();
    else if (k === 'E') state.expr += 'e';
    else if (k === 'e' || k === 'π') state.expr += k === 'e' ? ' e ' : 'π';
    else state.expr += k;
    inp.value = state.expr; drawCalc(); inp.focus({ preventScroll: true });
  }
  function equals() {
    const src = closeParens(state.expr.trim());
    if (!src) return;
    const out = el.querySelector('.cx-pre');
    try {
      const v = evaluate(src, state.ans);
      state.hist.unshift({ e: src, v }); state.hist = state.hist.slice(0, 8);
      state.ans = v; state.expr = fmt(v).replace('−', '-');
      el.querySelector('.cx-in').value = state.expr; drawCalc(); out.classList.remove('bad'); justEq = true;
    } catch (err) { out.textContent = err.message; out.classList.add('bad'); }
  }
  function drawCalc() {
    el.querySelector('.cx-pre').textContent = preview();
    el.querySelector('.cx-pre').classList.remove('bad');
    el.querySelector('.cx-hist').innerHTML = state.hist.map((h, i) => `<button type="button" data-h="${i}"><span>${esc(h.e)}</span><b>${esc(fmt(h.v))}</b></button>`).join('');
    el.querySelectorAll('.cx-hist button').forEach((b) => b.onclick = () => { state.expr += fmt(state.hist[+b.dataset.h].v).replace('−', '-'); el.querySelector('.cx-in').value = state.expr; drawCalc(); });
  }
  function drawStats() {
    const box = el.querySelector('.cx-st-out');
    const xs = parseList(state.list), r = stats(xs);
    if (!r) { box.innerHTML = '<p class="cx-tip">Type or paste numbers separated by spaces, commas or new lines.</p>'; return; }
    const row = (k, v, hint) => `<div><span>${k}${hint ? `<small>${hint}</small>` : ''}</span><b>${typeof v === 'string' ? v : fmt(v)}</b></div>`;
    box.innerHTML = `<div class="cx-grid">
      ${row('n', r.n)}${row('Sum', r.sum)}${row('Mean', r.mean)}${row('Median', r.median)}
      ${row('Mode', r.mode.length ? r.mode.map(fmt).join(', ') : 'none')}${row('Min · Max', `${fmt(r.min)} · ${fmt(r.max)}`)}${row('Range', r.range)}
      ${row('Q1 · Q3', `${fmt(r.q1)} · ${fmt(r.q3)}`)}${row('IQR', r.iqr)}
      ${row('SD', r.n > 1 ? r.sd : '—', 'sample (n−1)')}${row('Variance', r.n > 1 ? r.varS : '—', 'sample (n−1)')}
      ${row('SD', r.sdP, 'population (n)')}${row('SE of mean', r.n > 1 ? r.se : '—', 'SD/√n')}
      ${row('95% CI of mean', r.n > 1 ? `${fmt(r.ciLo)} – ${fmt(r.ciHi)}` : '—', 'mean ± 1.96·SE')}
      ${row('CV', Number.isFinite(r.cv) ? fmt(r.cv) + '%' : '—', 'SD/mean')}${row('Geometric mean', Number.isFinite(r.geo) ? r.geo : '—')}
      </div><p class="cx-tip">Sorted: ${r.sorted.map(fmt).join(', ')}</p>`;
  }
  function tab(t) {
    state.tab = t;
    el.querySelectorAll('.cx-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === t));
    el.querySelector('.cx-calc').hidden = t !== 'calc';
    el.querySelector('.cx-stats').hidden = t !== 'stats';
    if (t === 'stats') drawStats();
  }

  function build() {
    el = document.createElement('div');
    el.className = 'cx'; el.hidden = true; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Calculator');
    el.innerHTML = `<div class="cx-head"><div class="cx-tabs"><button type="button" data-t="calc" class="on">Calculator</button><button type="button" data-t="stats">Statistics</button></div><button type="button" class="cx-x" aria-label="Close">✕</button></div>
      <div class="cx-calc"><div class="cx-hist"></div>
        <input class="cx-in" inputmode="none" autocomplete="off" spellcheck="false" placeholder="e.g. 120 + 1.96 × 20/√100">
        <div class="cx-pre"></div>
        <div class="cx-keys">${KEYS.map(([k, l]) => `<button type="button" data-k="${esc(k)}" class="${/^[0-9.]$/.test(k) ? 'd' : k === '=' ? 'eq' : ['AC', 'DEL'].includes(k) ? 'c' : ['÷', '×', '−', '+'].includes(k) ? 'o' : 'f'}">${l}</button>`).join('')}</div></div>
      <div class="cx-stats" hidden><textarea class="cx-list" rows="3" inputmode="decimal" placeholder="65, 72, 68, 80, 70"></textarea><div class="cx-st-out"></div></div>`;
    document.body.appendChild(el);
    const inp = el.querySelector('.cx-in');
    // On phones the on-screen keys are used (no system keyboard); on computers typing works too.
    if (!matchMedia('(pointer:coarse)').matches) inp.removeAttribute('inputmode');
    el.querySelectorAll('.cx-keys button').forEach((b) => b.addEventListener('click', () => press(b.dataset.k)));
    el.querySelectorAll('.cx-tabs button').forEach((b) => b.onclick = () => tab(b.dataset.t));
    el.querySelector('.cx-x').onclick = close;
    inp.addEventListener('input', () => { state.expr = inp.value; justEq = false; drawCalc(); });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); state.expr = inp.value; equals(); } if (e.key === 'Escape') close(); });
    el.querySelector('.cx-list').addEventListener('input', (e) => { state.list = e.target.value; drawStats(); });
    // Paste is blocked on the exam page; let it through inside the calculator.
    el.addEventListener('paste', (e) => e.stopPropagation(), true);
  }
  function open() { if (!el) build(); el.hidden = false; document.body.classList.add('cx-on'); tab(state.tab); drawCalc(); }
  function close() { if (el) el.hidden = true; document.body.classList.remove('cx-on'); }
  function toggle() { el && !el.hidden ? close() : open(); }
  // A fresh calculator for each exam attempt.
  function reset() { close(); if (el) el.remove(); el = null; state = { expr: '', ans: 0, hist: [], tab: 'calc', list: '' }; }
  root.Calc = { ...api, open, close, toggle, reset };
})(typeof window !== 'undefined' ? window : globalThis);
