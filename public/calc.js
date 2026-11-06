'use strict';
// Scientific calculator and statistics helper for the exam screen, modelled on the TI-30XS MultiView that
// standard exams allow: the same functions, a fraction key (n/d) shown as a stacked fraction, a key to switch a
// result between fraction and decimal (F◄►D), and one-variable statistics (n, Σx, Σx², x̄, Sx, σx, min, Q1,
// median, Q3, max). The expression parser is our own (no eval): + − × ÷ ^ ( ) % ! π e, implicit multiplication,
// and √ ln log exp sin cos tan abs nCr nPr.
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
      if (num) { out.push({ t: 'n', v: parseFloat(num[0]), raw: num[0] }); i += num[0].length; continue; }
      const word = s.slice(i).match(/^[a-z]+/);
      if (word) {
        const w = word[0];
        if (w === 'pi') out.push({ t: 'n', v: Math.PI, raw: 'π' });
        else if (w === 'e') out.push({ t: 'n', v: Math.E, raw: 'e' });
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

  // Grammar: expr := term (('+'|'-') term)* ; term := unary (('*'|'/'|implicit) unary)* ; unary := '-' unary | power
  // power := postfix ('^' unary)? ; postfix := atom ('!'|'%')* ; atom := number | ans | fn atom | '(' expr ')'
  // Builds a tree, used both to compute the value and to draw the expression (fractions stacked, √, powers).
  function parse(src) {
    const tk = tokenize(src);
    if (!tk.length) throw new Error('Empty');
    let i = 0;
    const peek = () => tk[i], next = () => tk[i++];
    const expect = (t) => { if (!tk[i] || tk[i].t !== t) throw new Error(t === ')' ? 'Missing )' : `Expected ${t}`); i++; };
    const startsAtom = (x) => x && (x.t === 'n' || x.t === 'ans' || x.t === 'f' || x.t === '(');
    function expr() {
      let v = term();
      while (peek() && (peek().t === '+' || peek().t === '-')) { const op = next().t; v = { k: 'bin', op, l: v, r: term() }; }
      return v;
    }
    function term() {
      let v = unary();
      for (;;) {
        const p = peek();
        if (p && (p.t === '*' || p.t === '/')) { next(); v = { k: 'bin', op: p.t, l: v, r: unary() }; }
        else if (startsAtom(p)) v = { k: 'bin', op: 'imp', l: v, r: unary() }; // 2π, 3(4+1), 2√9
        else return v;
      }
    }
    function unary() {
      if (peek() && peek().t === '-') { next(); return { k: 'neg', x: unary() }; }
      if (peek() && peek().t === '+') { next(); return unary(); }
      return power();
    }
    function power() {
      const b = postfix();
      if (peek() && peek().t === '^') { next(); return { k: 'pow', b, e: unary() }; }
      return b;
    }
    function postfix() {
      let v = atom();
      while (peek() && (peek().t === '!' || peek().t === '%')) v = { k: 'post', op: next().t, x: v };
      return v;
    }
    function atom() {
      const x = next();
      if (!x) throw new Error('Incomplete expression');
      if (x.t === 'n') return { k: 'num', v: x.v, raw: x.raw };
      if (x.t === 'ans') return { k: 'ans' };
      if (x.t === '(') { if (peek() && peek().t === ')') throw new Error('Empty brackets'); const v = expr(); expect(')'); return { k: 'par', x: v }; }
      if (x.t === 'f') {
        if (FN2[x.v]) { expect('('); const a = expr(); if (peek() && peek().t === ';') next(); const b = expr(); expect(')'); return { k: 'fn2', f: x.v, a, b }; }
        return { k: 'fn', f: x.v, x: peek() && peek().t === '(' ? atom() : power() };
      }
      throw new Error('Incomplete expression');
    }
    const v = expr();
    if (i < tk.length) throw new Error(tk[i].t === ')' ? 'Extra )' : 'Check the expression');
    return v;
  }

  function calc(n, ans) {
    switch (n.k) {
      case 'num': return n.v;
      case 'ans': return ans;
      case 'par': return calc(n.x, ans);
      case 'neg': return -calc(n.x, ans);
      case 'pow': return Math.pow(calc(n.b, ans), calc(n.e, ans));
      case 'post': { const v = calc(n.x, ans); return n.op === '!' ? fact(v) : v / 100; }
      case 'fn': return FN[n.f](calc(n.x, ans));
      case 'fn2': return FN2[n.f](calc(n.a, ans), calc(n.b, ans));
      case 'bin': {
        const l = calc(n.l, ans), r = calc(n.r, ans);
        return n.op === '+' ? l + r : n.op === '-' ? l - r : n.op === '/' ? l / r : l * r;
      }
    }
    throw new Error('Check the expression');
  }
  function evaluate(src, ans = 0) {
    const v = calc(parse(src), ans);
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
  // A result as an exact fraction when it is one (denominator up to 10000), like F◄►D on the TI-30XS.
  function toFraction(v) {
    if (!Number.isFinite(v) || Number.isInteger(v) || Math.abs(v) >= 1e9) return null;
    const sign = v < 0 ? -1 : 1, x = Math.abs(v);
    let h1 = 1, h0 = 0, k1 = 0, k0 = 1, b = x;
    for (let i = 0; i < 40; i++) {
      const a = Math.floor(b);
      [h1, h0] = [a * h1 + h0, h1]; [k1, k0] = [a * k1 + k0, k1];
      if (k1 > 10000) return null;
      if (Math.abs(x - h1 / k1) < 1e-10 * Math.max(1, x)) return k1 === 1 ? null : { n: sign * h1, d: k1 };
      if (b - a < 1e-12) break;
      b = 1 / (b - a);
    }
    return null;
  }

  // ---------- drawing an expression (MathPrint style) ----------
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const FNAME = { sqrt: '√', ln: 'ln', log: 'log', exp: 'exp', abs: 'abs', sin: 'sin', cos: 'cos', tan: 'tan', ncr: 'nCr', npr: 'nPr' };
  const frac = (a, b) => `<span class="mf"><span class="mn">${a}</span><span class="md">${b}</span></span>`;
  function draw(n) {
    const inner = (x) => (x.k === 'par' ? draw(x.x) : draw(x)); // brackets are implied by the fraction bar
    switch (n.k) {
      case 'num': return esc(n.raw || fmt(n.v));
      case 'ans': return 'Ans';
      case 'par': return `(${draw(n.x)})`;
      case 'neg': return `−${draw(n.x)}`;
      case 'pow': return `${draw(n.b)}<sup>${inner(n.e)}</sup>`;
      case 'post': return `${draw(n.x)}${n.op}`;
      case 'fn': return n.f === 'sqrt' ? `<span class="mr">√<span class="mo">${inner(n.x)}</span></span>` : `${FNAME[n.f]}(${inner(n.x)})`;
      case 'fn2': return `${FNAME[n.f]}(${draw(n.a)}, ${draw(n.b)})`;
      case 'bin':
        if (n.op === '/') return frac(inner(n.l), inner(n.r));
        return `${draw(n.l)}${n.op === 'imp' ? '' : ` ${{ '+': '+', '-': '−', '*': '×' }[n.op]} `}${draw(n.r)}`;
    }
    return '';
  }
  const pretty = (src) => draw(parse(src));
  const prettyNumber = (v, asFrac) => { const f = asFrac && toFraction(v); return f ? `${f.n < 0 ? '−' : ''}${frac(Math.abs(f.n), f.d)}` : esc(fmt(v)); };

  function parseList(text) {
    return String(text).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).split(/[\s,;،]+/).filter(Boolean).map(Number).filter((x) => Number.isFinite(x));
  }
  // One-variable statistics, as on the TI-30XS (quartiles by the usual median-of-halves method).
  function stats(xs) {
    const n = xs.length;
    if (!n) return null;
    const s = [...xs].sort((a, b) => a - b);
    const med = (a) => { const m = a.length; return m ? (m % 2 ? a[(m - 1) / 2] : (a[m / 2 - 1] + a[m / 2]) / 2) : NaN; };
    const sum = xs.reduce((a, b) => a + b, 0), mean = sum / n;
    const ss = xs.reduce((a, x) => a + (x - mean) ** 2, 0);
    const lower = s.slice(0, Math.floor(n / 2)), upper = s.slice(Math.ceil(n / 2));
    return { n, sum, sum2: xs.reduce((a, x) => a + x * x, 0), mean, sd: n > 1 ? Math.sqrt(ss / (n - 1)) : NaN, sdP: Math.sqrt(ss / n),
      min: s[0], q1: n > 1 ? med(lower) : NaN, median: med(s), q3: n > 1 ? med(upper) : NaN, max: s[n - 1], sorted: s };
  }

  const api = { evaluate, parse, fmt, toFraction, pretty, prettyNumber, parseList, stats };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;

  // ---------- UI ----------
  const KEYS = [
    ['FRAC', 'n/d'], ['FD', 'F◄►D'], ['L', '◀'], ['R', '▶'], ['nPr(', 'nPr'],
    ['sqrt(', '√'], ['^2', 'x²'], ['^', 'xʸ'], ['ln(', 'ln'], ['log(', 'log'],
    ['exp(', 'eˣ'], ['^-1', 'x⁻¹'], ['!', 'n!'], ['nCr(', 'nCr'], ['π', 'π'],
    ['(', '('], [')', ')'], ['%', '%'], ['AC', 'AC'], ['DEL', '⌫'],
    ['7', '7'], ['8', '8'], ['9', '9'], ['÷', '÷'], ['ans', 'Ans'],
    ['4', '4'], ['5', '5'], ['6', '6'], ['×', '×'], [',', ','],
    ['1', '1'], ['2', '2'], ['3', '3'], ['−', '−'], ['e', 'e'],
    ['0', '0'], ['.', '.'], ['E', 'EXP'], ['+', '+'], ['=', '='],
  ];
  let el = null, state = { ans: 0, hist: [], tab: 'calc', list: '', flip: false, last: null }, justEq = false;
  // Results are shown as decimals; F◄►D switches the result on screen to a fraction (when it is one) and back.
  const autoFrac = () => false;
  const inp = () => el.querySelector('.cx-in');
  const closeParens = (s) => s + ')'.repeat(Math.max(0, (s.match(/\(/g) || []).length - (s.match(/\)/g) || []).length));

  // Insert at the cursor (not only at the end), keeping the cursor after what was inserted (or at `caret`).
  function insert(text, caret = text.length) {
    const i = inp(), a = i.selectionStart ?? i.value.length, b = i.selectionEnd ?? a;
    i.value = i.value.slice(0, a) + text + i.value.slice(b);
    i.setSelectionRange(a + caret, a + caret);
  }
  // n/d: after a number or a bracket it becomes the numerator; otherwise an empty fraction is started.
  function fraction() {
    const i = inp(), a = i.selectionStart ?? i.value.length, v = i.value, before = v.slice(0, a);
    let start = a;
    const m = before.match(/(\d+\.?\d*|\.\d+|π|ans|e)$/);
    if (m) start = a - m[0].length;
    else if (before.endsWith(')')) { let d = 0; for (let k = a - 1; k >= 0; k--) { if (v[k] === ')') d++; if (v[k] === '(') d--; if (d === 0) { start = k; break; } } }
    if (start < a) {
      const num = v.slice(start, a), wrapped = num.startsWith('(') ? num : `(${num})`;
      i.value = v.slice(0, start) + `${wrapped}/()` + v.slice(a);
      const c = start + wrapped.length + 2; i.setSelectionRange(c, c);
    } else insert('()/()', 1);
  }
  // ▶ steps over ")/(" in one go, so moving from the numerator to the denominator is a single press.
  function move(dir) {
    const i = inp(), v = i.value; let c = i.selectionStart ?? v.length;
    if (dir > 0) c = v.slice(c, c + 3) === ')/(' ? c + 3 : Math.min(v.length, c + 1);
    else c = v.slice(c - 3, c) === ')/(' ? c - 3 : Math.max(0, c - 1);
    i.setSelectionRange(c, c);
  }

  function press(k) {
    const i = inp();
    // After "=", a number or function starts a new calculation; an operator continues from the result.
    if (justEq && !['=', 'DEL', '^2', '^', '^-1', '!', '%', '÷', '×', '−', '+', ')', ',', 'E', 'FD', 'L', 'R', 'FRAC'].includes(k)) { i.value = ''; }
    justEq = false;
    if (k === 'AC') i.value = '';
    else if (k === 'DEL') {
      const a = i.selectionStart ?? i.value.length, b = i.selectionEnd ?? a;
      if (a !== b) insert('');
      else { const m = i.value.slice(0, a).match(/(sqrt\(|ln\(|log\(|exp\(|nCr\(|nPr\(|ans|.)$/); if (m) { i.setSelectionRange(a - m[0].length, a); insert(''); } }
    } else if (k === '=') return equals();
    else if (k === 'FD') { state.flip = !state.flip; return show(); }
    else if (k === 'FRAC') fraction();
    else if (k === 'L' || k === 'R') move(k === 'L' ? -1 : 1);
    else if (k === 'E') insert('e');
    else if (k === 'e') insert(' e ');
    else if (/\($/.test(k)) insert(k);
    else insert(k);
    state.flip = false;
    show(); i.focus({ preventScroll: true });
  }
  function equals() {
    const src = closeParens(inp().value.trim());
    if (!src) return;
    try {
      const v = evaluate(src, state.ans);
      state.hist.unshift({ e: src, v }); state.hist = state.hist.slice(0, 8);
      state.ans = v; state.last = { src, v }; state.flip = false;
      inp().value = ''; justEq = true;
      show();
    } catch (err) { const o = el.querySelector('.cx-out'); o.innerHTML = `<span class="bad">${esc(err.message)}</span>`; }
  }
  // Screen: the expression drawn as on paper (fractions stacked) and its value; F◄►D switches fraction/decimal.
  function show() {
    const src = inp().value, pv = el.querySelector('.cx-pretty'), out = el.querySelector('.cx-out');
    if (src.trim()) {
      try { pv.innerHTML = pretty(closeParens(src)); } catch { pv.textContent = src; }
      try { out.innerHTML = '= ' + prettyNumber(evaluate(closeParens(src), state.ans), autoFrac(src) !== state.flip); } catch { out.innerHTML = ''; }
    } else if (state.last) {
      try { pv.innerHTML = pretty(state.last.src); } catch { pv.textContent = state.last.src; }
      out.innerHTML = '= ' + prettyNumber(state.last.v, autoFrac(state.last.src) !== state.flip);
    } else { pv.innerHTML = '<span class="cx-ph">Type a calculation; n/d makes a fraction</span>'; out.innerHTML = ''; }
    el.querySelector('.cx-hist').innerHTML = state.hist.map((h, n) => `<button type="button" data-h="${n}"><span>${esc(h.e)}</span><b>${prettyNumber(h.v, autoFrac(h.e))}</b></button>`).join('');
    el.querySelectorAll('.cx-hist button').forEach((b) => b.onclick = () => { insert(fmt(state.hist[+b.dataset.h].v).replace('−', '-')); justEq = false; show(); });
  }
  function drawStats() {
    const box = el.querySelector('.cx-st-out');
    const r = stats(parseList(state.list));
    if (!r) { box.innerHTML = '<p class="cx-tip">Type numbers separated by spaces, commas or new lines (1-Var Stats).</p>'; return; }
    const row = (k, v, hint) => `<div><span>${k}${hint ? `<small>${hint}</small>` : ''}</span><b>${typeof v === 'string' ? v : Number.isFinite(v) ? fmt(v) : '—'}</b></div>`;
    box.innerHTML = `<div class="cx-grid">
      ${row('n', r.n)}${row('x̄', r.mean, 'mean')}${row('Σx', r.sum)}${row('Σx²', r.sum2)}
      ${row('Sx', r.sd, 'sample SD (n−1)')}${row('σx', r.sdP, 'population SD (n)')}
      ${row('minX', r.min)}${row('maxX', r.max)}${row('Q1', r.q1)}${row('Med', r.median, 'median')}${row('Q3', r.q3)}
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
        <div class="cx-screen"><div class="cx-pretty"></div><div class="cx-out"></div></div>
        <input class="cx-in" inputmode="none" autocomplete="off" spellcheck="false" aria-label="Expression" placeholder="e.g. 120 + 1.96 × 20/√100">
        <div class="cx-keys">${KEYS.map(([k, l]) => `<button type="button" data-k="${esc(k)}" class="${/^[0-9.]$/.test(k) ? 'd' : k === '=' ? 'eq' : ['AC', 'DEL'].includes(k) ? 'c' : ['÷', '×', '−', '+'].includes(k) ? 'o' : ['FRAC', 'FD', 'L', 'R'].includes(k) ? 'm' : 'f'}">${l}</button>`).join('')}</div></div>
      <div class="cx-stats" hidden><textarea class="cx-list" rows="3" inputmode="decimal" placeholder="65, 72, 68, 80, 70"></textarea><div class="cx-st-out"></div></div>`;
    document.body.appendChild(el);
    const i = inp();
    // On phones the on-screen keys are used (no system keyboard); on computers typing works too.
    if (!matchMedia('(pointer:coarse)').matches) i.removeAttribute('inputmode');
    el.querySelectorAll('.cx-keys button').forEach((b) => {
      b.addEventListener('mousedown', (e) => e.preventDefault()); // keep the cursor where it is in the input
      b.addEventListener('click', () => press(b.dataset.k));
    });
    el.querySelectorAll('.cx-tabs button').forEach((b) => b.onclick = () => tab(b.dataset.t));
    el.querySelector('.cx-x').onclick = close;
    i.addEventListener('input', () => { justEq = false; state.flip = false; show(); });
    i.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); equals(); }
      if (e.key === 'Escape') close();
      if (e.key === '/' && e.altKey) { e.preventDefault(); fraction(); show(); }
    });
    el.querySelector('.cx-list').addEventListener('input', (e) => { state.list = e.target.value; drawStats(); });
    // Paste is blocked on the exam page; let it through inside the calculator.
    el.addEventListener('paste', (e) => e.stopPropagation(), true);
  }
  function open() { if (!el) build(); el.hidden = false; document.body.classList.add('cx-on'); tab(state.tab); show(); }
  function close() { if (el) el.hidden = true; document.body.classList.remove('cx-on'); }
  function toggle() { el && !el.hidden ? close() : open(); }
  // A fresh calculator for each exam attempt.
  function reset() { close(); if (el) el.remove(); el = null; state = { ans: 0, hist: [], tab: 'calc', list: '', flip: false, last: null }; justEq = false; }
  root.Calc = { ...api, open, close, toggle, reset };
})(typeof window !== 'undefined' ? window : globalThis);
