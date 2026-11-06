'use strict';
// Scratchpad for the exam: draw or write with a finger, a pen (Apple Pencil) or a mouse. One page per question,
// kept on the device (survives a reload, works without internet). Nothing is sent to the server.
// When a pen is used, finger touches are ignored (palm rejection).
(function (root) {
  if (typeof document === 'undefined') return;
  const MAX_POINTS = 60000; // keeps the saved pages small
  let el = null, cv = null, ctx = null, key = '', pages = {}, page = '', tool = 'pen', drawing = null, penSeen = false, saveT = 0;

  const load = () => { try { pages = JSON.parse(localStorage.getItem(key)) || {}; } catch { pages = {}; } };
  const save = () => { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(key, JSON.stringify(pages)); } catch {} }, 400); };
  const strokes = () => (pages[page] = pages[page] || []);
  const total = () => Object.values(pages).reduce((n, p) => n + p.reduce((m, s) => m + s.p.length, 0), 0);

  // Points are stored relative to the canvas width, so a page keeps its shape when the panel changes size.
  function redraw() {
    if (!cv) return;
    const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    if (cv.width !== Math.round(r.width * dpr) || cv.height !== Math.round(r.height * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, r.width, r.height);
    // faint ruled lines, like a notepad
    ctx.strokeStyle = '#e4e9ee'; ctx.lineWidth = 1;
    for (let y = 28; y < r.height; y += 28) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(r.width, y + 0.5); ctx.stroke(); }
    for (const s of strokes()) drawStroke(s, r.width);
  }
  function drawStroke(s, w) {
    if (!s.p.length) return;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = s.e ? 'destination-out' : 'source-over';
    ctx.strokeStyle = '#1f2a33';
    ctx.lineWidth = s.e ? 22 : 2.2;
    ctx.beginPath();
    ctx.moveTo(s.p[0][0] * w, s.p[0][1] * w);
    if (s.p.length === 1) ctx.lineTo(s.p[0][0] * w + 0.1, s.p[0][1] * w);
    for (let i = 1; i < s.p.length; i++) ctx.lineTo(s.p[i][0] * w, s.p[i][1] * w);
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    if (s.e) redrawLines(w);
  }
  // the eraser also removes the ruled lines under it; draw them back faintly
  function redrawLines(w) {
    const h = cv.getBoundingClientRect().height;
    ctx.save(); ctx.globalCompositeOperation = 'destination-over'; ctx.strokeStyle = '#e4e9ee'; ctx.lineWidth = 1;
    for (let y = 28; y < h; y += 28) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); ctx.stroke(); }
    ctx.restore();
  }
  const pt = (e) => { const r = cv.getBoundingClientRect(); return [+((e.clientX - r.left) / r.width).toFixed(4), +((e.clientY - r.top) / r.width).toFixed(4)]; };

  function down(e) {
    if (e.pointerType === 'pen') penSeen = true;
    if (penSeen && e.pointerType === 'touch') return; // palm rejection
    if (total() > MAX_POINTS) { status('This scratchpad is full — clear a page to continue.'); return; }
    e.preventDefault();
    cv.setPointerCapture(e.pointerId);
    drawing = { id: e.pointerId, s: { e: tool === 'eraser' ? 1 : 0, p: [pt(e)] } };
    strokes().push(drawing.s);
    drawStroke(drawing.s, cv.getBoundingClientRect().width);
  }
  function move(e) {
    if (!drawing || e.pointerId !== drawing.id) return;
    e.preventDefault();
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    const w = cv.getBoundingClientRect().width, s = drawing.s;
    for (const ev of evs) {
      const p = pt(ev), last = s.p[s.p.length - 1];
      if (Math.abs(p[0] - last[0]) + Math.abs(p[1] - last[1]) < 0.0015) continue;
      s.p.push(p);
      ctx.lineCap = 'round'; ctx.globalCompositeOperation = s.e ? 'destination-out' : 'source-over';
      ctx.strokeStyle = '#1f2a33'; ctx.lineWidth = s.e ? 22 : 2.2;
      ctx.beginPath(); ctx.moveTo(last[0] * w, last[1] * w); ctx.lineTo(p[0] * w, p[1] * w); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  function up(e) {
    if (!drawing || e.pointerId !== drawing.id) return;
    const wasEraser = drawing.s.e;
    drawing = null; save();
    if (wasEraser) redraw();
  }
  function status(t) { const s = el && el.querySelector('.sp-st'); if (s) { s.textContent = t; clearTimeout(status.t); status.t = setTimeout(() => { s.textContent = ''; }, 3000); } }
  function setTool(t) { tool = t; el.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === t)); }

  function build() {
    el = document.createElement('div');
    el.className = 'sp'; el.hidden = true; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Scratchpad');
    el.innerHTML = `<div class="sp-head"><b>Scratchpad</b><small class="sp-q"></small>
        <div class="sp-tools"><button type="button" data-tool="pen" class="on" title="Pen">✎ Pen</button><button type="button" data-tool="eraser" title="Eraser">⌫ Eraser</button><button type="button" data-act="undo" title="Undo">↶</button><button type="button" data-act="clear" title="Clear this page">Clear</button></div>
        <button type="button" class="sp-x" aria-label="Close">✕</button></div>
      <canvas class="sp-cv"></canvas><small class="sp-st"></small>`;
    document.body.appendChild(el);
    cv = el.querySelector('canvas'); ctx = cv.getContext('2d');
    cv.addEventListener('pointerdown', down);
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    el.querySelectorAll('[data-tool]').forEach((b) => b.onclick = () => setTool(b.dataset.tool));
    el.querySelector('[data-act="undo"]').onclick = () => { strokes().pop(); save(); redraw(); };
    el.querySelector('[data-act="clear"]').onclick = () => { pages[page] = []; save(); redraw(); };
    el.querySelector('.sp-x').onclick = close;
    window.addEventListener('resize', redraw);
  }
  function open() { if (!el) build(); el.hidden = false; document.body.classList.add('sp-on'); requestAnimationFrame(redraw); }
  function close() { if (el) el.hidden = true; document.body.classList.remove('sp-on'); }
  function toggle() { el && !el.hidden ? close() : open(); }
  // Which question's page is shown (label = the number on screen).
  function setPage(id, label) { page = id; if (el) { el.querySelector('.sp-q').textContent = label ? `· ${label}` : ''; if (!el.hidden) redraw(); } }
  const isOpen = () => !!(el && !el.hidden);
  // A fresh scratchpad for each exam attempt, stored under its own key.
  function reset(storageKey) {
    close(); if (el) { el.remove(); window.removeEventListener('resize', redraw); }
    el = null; cv = null; ctx = null; drawing = null; penSeen = false; tool = 'pen'; page = '';
    key = storageKey || ''; pages = {}; if (key) load();
  }
  root.Scratch = { open, close, toggle, setPage, reset, isOpen };
})(typeof window !== 'undefined' ? window : globalThis);
