'use strict';
// Portal front end: a single page routed by #hash

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const app = $('#app');
let ME = null, LEVELS = {};

async function api(path, opts = {}) {
  const headers = { 'X-Requested-With': 'portal', ...(opts.headers || {}) };
  let body = opts.body;
  if (body && !(body instanceof Blob)) { body = JSON.stringify(body); headers['Content-Type'] = 'application/json'; }
  const r = await fetch('/api/' + path, { method: opts.method || (body ? 'POST' : 'GET'), headers, body });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.message || 'Error');
  return data;
}

const STATE = { open: 'Open', late: 'Late submission', closed: 'Closed', upcoming: 'Not open yet', unscheduled: 'Not scheduled' };
const RATE = [['excellent', 'Excellent (100%)'], ['adequate', 'Adequate (70%)'], ['weak', 'Weak (40%)'], ['absent', 'Absent (0%)']];
const LEVEL_OPTS = (sel) => ['R1', 'R2', 'R3', 'R4'].map((l) => `<option ${l === sel ? 'selected' : ''}>${l}</option>`).join('');
const fmt = (d) => d ? '<bdi>' + new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Riyadh' }) + '</bdi>' : '—';
const left = (d) => {
  const ms = new Date(d) - Date.now();
  if (ms <= 0) return '';
  const days = Math.floor(ms / 86400000), h = Math.floor(ms / 3600000) % 24;
  return days ? `${days} d ${h} h left` : `${h} h left`;
};
const toLocalInput = (d) => d ? new Date(new Date(d).getTime() + 3 * 3600000).toISOString().slice(0, 16) : '';
const fromLocalInput = (v) => v ? new Date(v + ':00+03:00').toISOString() : null;
const errBox = (e) => { $('#e').innerHTML = `<div class="err">${esc(e.message || e)}</div>`; };

function nav() {
  const h = location.hash || '#';
  const links = !ME
    ? [['#login', 'Sign in'], ['#register', 'Register'], ['#guide', 'User guide'], ['#sites', 'External sites'], ['#refs', 'References']]
    : ME.role === 'admin'
      ? [['#admin/users', 'Trainees'], ['#admin/reqs', 'Requirements'], ['#admin/subs', 'Submissions'], ['#guide', 'Guide'], ['#refs', 'References']]
      : [['#dash', 'My requirements'], ['#guide', 'User guide'], ['#sites', 'External sites'], ['#refs', 'References']];
  $('#nav').innerHTML = links.map(([k, t]) => `<a href="${k}" class="${h.startsWith(k) ? 'on' : ''}">${t}</a>`).join('') +
    (ME ? `<button id="out">Sign out (${esc(ME.name)})</button>` : '');
  if (ME) $('#out').onclick = async () => { await api('logout', { method: 'POST' }); ME = null; location.hash = '#login'; };
}

// ---------- Sign in and registration ----------

function viewLogin() {
  app.innerHTML = `<div class="card" style="max-width:420px;margin:auto;width:100%"><h1>Sign in</h1>
  <form id="f" class="list"><label>Email<input name="email" type="email" required autocomplete="email"></label>
  <label>Password<input name="password" type="password" required autocomplete="current-password"></label>
  <div id="e"></div><button class="pri">Sign in</button></form>
  <p class="muted">No account? <a href="#register">Register as a trainee</a> — the administration activates it after review.</p></div>`;
  $('#f').onsubmit = async (ev) => {
    ev.preventDefault();
    try { const u = await api('login', { body: Object.fromEntries(new FormData(ev.target)) }); ME = null; location.hash = u.role === 'admin' ? '#admin/users' : '#dash'; }
    catch (e) { errBox(e); }
  };
}

function viewRegister() {
  app.innerHTML = `<div class="card"><h1>Trainee registration</h1>
  <div class="box"><p>After registering, your account is <b>awaiting activation</b>. The administration checks your details (SCFHS number and training level), activates the account, and then the requirements for your level appear.</p></div>
  <form id="f" class="grid2">
   <label>Full name (as in SCFHS records)<input name="name" required></label>
   <label>Email<input name="email" type="email" required></label>
   <label>Mobile number<input name="phone" inputmode="tel"></label>
   <label>SCFHS classification number<input name="scfhs" required></label>
   <label>Training level<select name="level">${LEVEL_OPTS('R1')}</select></label>
   <label>Password (at least 8 characters)<input name="password" type="password" minlength="8" required autocomplete="new-password"></label>
   <div style="align-self:end"><button class="pri">Submit registration</button></div>
  </form><div id="e"></div></div>`;
  $('#f').onsubmit = async (ev) => {
    ev.preventDefault();
    try { const r = await api('register', { body: Object.fromEntries(new FormData(ev.target)) }); app.innerHTML = `<div class="box"><h2>Registration received</h2><p>${esc(r.message)}</p><a class="btn" href="#login">Back to sign in</a></div>`; }
    catch (e) { errBox(e); }
  };
}

// ---------- Trainee dashboard ----------

function stateTag(r) {
  if (r.submission?.grade) return `<span class="tag t-done">Graded ${r.submission.grade.total}/100</span>`;
  if (r.submission) return `<span class="tag t-done">Submitted</span>`;
  return `<span class="tag t-${r.state}">${STATE[r.state]}</span>`;
}
const lateEnd = (r) => new Date(new Date(r.closeAt).getTime() + r.lateDays * 864e5);

async function viewDash() {
  const reqs = await api('requirements');
  const lv = LEVELS[ME.level] || {};
  const done = reqs.filter((r) => r.submission).length;
  const openNow = reqs.filter((r) => ['open', 'late'].includes(r.state) && !r.submission);
  app.innerHTML = `<div class="box"><h1>${esc(lv.title || ME.level)}</h1><p>${esc(lv.desc || '')}</p>
   <p>Submitted: <b>${done}</b> of <b>${reqs.length}</b> · Open now and not submitted: <b>${openNow.length}</b></p></div>
   ${openNow.length ? `<div class="warn"><b>Due now:</b> ${openNow.map((r) => `${esc(r.title)} (${left(r.state === 'open' ? r.closeAt : lateEnd(r))})`).join(' · ')}</div>` : ''}
   <div class="filters"><select id="fs"><option value="">All statuses</option>${Object.entries(STATE).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}<option value="sub">Submitted</option></select></div>
   <div class="list" id="l"></div>`;
  const draw = () => {
    const f = $('#fs').value;
    $('#l').innerHTML = reqs.filter((r) => !f || (f === 'sub' ? r.submission : r.state === f && !r.submission))
      .map((r) => `<button class="req" data-id="${r.id}"><span class="win">${esc(r.window)}</span><span>${esc(r.title)}<br><small class="muted">${fmt(r.openAt)} → ${fmt(r.closeAt)}</small></span>${stateTag(r)}</button>`).join('') || '<p class="muted">Nothing here</p>';
    app.querySelectorAll('.req').forEach((b) => b.onclick = () => openReq(reqs.find((x) => x.id === b.dataset.id)));
  };
  $('#fs').onchange = draw; draw();
}

function rubricTable(r, grade) {
  const rows = r.rubric.map((c, i) => `<tr><td>${esc(c.name)}</td><td class="n">${c.max}</td>${grade ? `<td class="n">${grade.items[i]?.score ?? '—'}</td>` : ''}</tr>`).join('');
  return `<div class="tw"><table><tr><th>Criterion</th><th class="n">Max</th>${grade ? '<th class="n">Your score</th>' : ''}</tr>${rows}
  <tr><td>Submitted on time (on time 10 · 1–7 days late 5 · more 0)</td><td class="n">10</td>${grade ? `<td class="n">${grade.timeliness}</td>` : ''}</tr>
  <tr><th>Total</th><th class="n">100</th>${grade ? `<th class="n">${grade.total}</th>` : ''}</tr></table></div>`;
}

function reqDetails(r) {
  return `<div class="row"><span class="win">${esc(r.window)}</span><span class="tag t-${r.state}">${STATE[r.state]}</span>${r.proposed ? '<span class="tag t-late">Proposed by curriculum</span>' : ''}</div>
  <h2>${esc(r.title)}</h2>
  <div class="grid2">
   <div class="box"><b>Submission window</b><span>Opens: ${fmt(r.openAt)}</span><span>Closes: ${fmt(r.closeAt)}</span>${r.lateDays ? `<span class="muted">Late submissions accepted until ${fmt(lateEnd(r))}, with the timeliness deduction</span>` : ''}<b>${r.state === 'upcoming' ? 'Opens in: ' + left(r.openAt).replace(' left', '') : r.state === 'open' ? left(r.closeAt) : ''}</b></div>
   <div class="box"><b>File to submit</b><span>Accepted formats: <b>${r.fileTypes.map((x) => '.' + x).join(' ')}</b></span><span>Maximum size: ${r.maxMB} MB</span><span>${esc(r.howToSubmit)}</span></div>
  </div>
  <div><h3>Instructions</h3><ol class="steps">${r.instructions.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></div>
  <div><h3>Evaluation (100 points)</h3><p class="muted">Each criterion is rated Excellent 100% · Adequate 70% · Weak 40% · Absent 0%. Result: ≥90 exceeds · 70–89 meets · 50–69 borderline · below 50 does not meet.</p>${rubricTable(r, r.submission?.grade)}</div>
  ${r.resources.length ? `<div><h3>References and tools</h3><ul>${r.resources.map((x) => `<li><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title)}</a></li>`).join('')}</ul></div>` : ''}`;
}

function openReq(r) {
  const s = r.submission;
  const canUpload = ['open', 'late'].includes(r.state) && !s?.grade;
  $('#dlgBody').innerHTML = `${reqDetails(r)}
   <div class="card"><h3>Submission</h3>
    ${s ? `<p>Last upload: <a href="/api/submissions/${s.id}/file">${esc(s.fileName)}</a> · ${fmt(s.submittedAt)} ${s.late ? '<span class="tag t-late">Late</span>' : ''}</p>` : '<p class="muted">Not submitted yet.</p>'}
    ${s?.grade ? `<div class="box"><span class="score">${s.grade.total}/100 · ${esc(s.grade.band)}</span>${s.grade.feedback ? `<p><b>Assessor feedback:</b> ${esc(s.grade.feedback)}</p>` : ''}</div>` : ''}
    ${canUpload ? `<div class="drop"><input type="file" id="file" accept="${r.fileTypes.map((x) => '.' + x).join(',')}"><label style="margin-top:8px">Note to the assessor (optional)<input id="note"></label>
      <button class="pri" id="up" style="margin-top:8px">${s ? 'Replace file' : 'Upload file'}</button>${r.state === 'late' ? '<p class="err" style="margin-top:8px">Submitting now is late and will reduce the timeliness score.</p>' : ''}</div>`
      : `<p class="muted">${s?.grade ? 'Graded; the file can no longer be replaced.' : r.state === 'upcoming' ? 'Uploading opens when the window opens.' : r.state === 'closed' ? 'The submission window is closed.' : ''}</p>`}
    <div id="e"></div></div>
   <div class="bar"><button id="x">Close</button></div>`;
  $('#x').onclick = () => $('#dlg').close();
  if (canUpload) $('#up').onclick = async () => {
    const f = $('#file').files[0];
    if (!f) return errBox('Choose a file');
    if (f.size > r.maxMB * 1048576) return errBox(`The file is larger than ${r.maxMB} MB`);
    $('#up').disabled = true; $('#up').textContent = 'Uploading…';
    try {
      await api(`requirements/${r.id}/submit`, { method: 'POST', body: f, headers: { 'X-File-Name': encodeURIComponent(f.name), 'X-Note': encodeURIComponent($('#note').value) } });
      $('#dlg').close(); route();
    } catch (e) { errBox(e); $('#up').disabled = false; $('#up').textContent = 'Upload file'; }
  };
  $('#dlg').showModal();
}

// ---------- Admin ----------

async function viewUsers() {
  const users = await api('admin/users');
  const st = { pending: ['Awaiting activation', 't-late'], active: ['Active', 't-open'], disabled: ['Disabled', 't-closed'] };
  app.innerHTML = `<h1>Trainees</h1><div class="box">New registrations are listed first. Check the SCFHS number, then activate the account and set the level.</div>
  <div class="tw card"><table class="stack"><tr class="hd"><th>Name</th><th>Email / mobile</th><th>SCFHS no.</th><th>Level</th><th>Status</th><th></th></tr>
  ${users.sort((a, b) => (a.status === 'pending' ? -1 : 0) - (b.status === 'pending' ? -1 : 0)).map((u) => `<tr data-id="${u.id}"><td class="ttl">${esc(u.name)}</td><td data-label="Email / mobile">${esc(u.email)}<br>${esc(u.phone)}</td><td data-label="SCFHS no.">${esc(u.scfhs)}</td>
   <td data-label="Level"><select data-lv>${LEVEL_OPTS(u.level)}</select></td>
   <td data-label="Status"><span class="tag ${st[u.status][1]}">${st[u.status][0]}</span></td>
   <td class="row">${u.status !== 'active' ? '<button class="pri" data-s="active">Activate</button>' : '<button class="bad" data-s="disabled">Disable</button>'}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">No trainees yet</td></tr>'}
  </table></div>`;
  app.querySelectorAll('tr[data-id]').forEach((tr) => {
    const save = (b) => api('admin/users/' + tr.dataset.id, { body: b }).then(route).catch((e) => alert(e.message));
    tr.querySelectorAll('[data-s]').forEach((b) => b.onclick = () => save({ status: b.dataset.s, level: $('[data-lv]', tr).value }));
    $('[data-lv]', tr).onchange = (e) => save({ level: e.target.value });
  });
}

async function viewReqsAdmin() {
  const reqs = await api('requirements');
  app.innerHTML = `<div class="row" style="justify-content:space-between"><h1>Requirements</h1><button class="pri" id="new">+ New requirement</button></div>
  <div class="filters"><select id="fl"><option value="">All levels</option>${LEVEL_OPTS()}</select><input id="q" placeholder="Search"></div>
  <div class="list" id="l"></div>`;
  const draw = () => {
    const lv = $('#fl').value, q = $('#q').value.toLowerCase();
    $('#l').innerHTML = reqs.filter((r) => (!lv || r.level === lv) && (!q || r.title.toLowerCase().includes(q))).map((r) => `<button class="req" data-id="${r.id}"><span class="win">${r.level} · ${esc(r.window)}</span>
     <span>${esc(r.title)}<br><small class="muted">${fmt(r.openAt)} → ${fmt(r.closeAt)} · ${r.count} submission${r.count === 1 ? '' : 's'}</small></span>
     <span class="tag t-${r.published ? r.state : 'closed'}">${r.published ? STATE[r.state] : 'Unpublished'}</span></button>`).join('');
    app.querySelectorAll('.req').forEach((b) => b.onclick = () => editReq(reqs.find((x) => x.id === b.dataset.id)));
  };
  $('#fl').onchange = $('#q').oninput = draw; draw();
  $('#new').onclick = () => editReq({ title: '', level: 'R1', window: '', description: '', instructions: [], rubric: [{ name: 'Content', max: 90 }], resources: [], fileTypes: ['pdf'], howToSubmit: '', maxMB: 25, lateDays: 14, published: false });
}

function editReq(r) {
  $('#dlgBody').innerHTML = `<h2>${r.id ? 'Edit requirement' : 'New requirement'}</h2><form id="f" class="list">
   <div class="grid2"><label>Title<input name="title" value="${esc(r.title)}" required></label>
    <label>Level<select name="level">${LEVEL_OPTS(r.level)}</select></label>
    <label>Label (e.g. MAR or JAN–FEB)<input name="window" value="${esc(r.window)}"></label>
    <label>Opens (Riyadh time)<input type="datetime-local" name="openAt" value="${toLocalInput(r.openAt)}"></label>
    <label>Closes (Riyadh time)<input type="datetime-local" name="closeAt" value="${toLocalInput(r.closeAt)}"></label>
    <label>Late days accepted after closing<input type="number" name="lateDays" min="0" value="${r.lateDays}"></label>
    <label>File formats (comma-separated)<input name="fileTypes" value="${esc(r.fileTypes.join(', '))}"></label>
    <label>Maximum size (MB)<input type="number" name="maxMB" min="1" max="100" value="${r.maxMB}"></label>
    <label style="align-self:end;display:flex;gap:8px;align-items:center"><input type="checkbox" name="published" style="width:auto" ${r.published ? 'checked' : ''}> Published to trainees</label></div>
   <label>Description<textarea name="description">${esc(r.description)}</textarea></label>
   <label>How to submit<textarea name="howToSubmit">${esc(r.howToSubmit)}</textarea></label>
   <label>Instructions (one step per line)<textarea name="instructions" rows="6">${esc(r.instructions.join('\n'))}</textarea></label>
   <label>Evaluation criteria (one per line: points | criterion — must total 90; 10 for timeliness is added automatically)<textarea name="rubric" rows="6">${esc(r.rubric.map((c) => `${c.max} | ${c.name}`).join('\n'))}</textarea></label>
   <label>References (one per line: title | link)<textarea name="resources">${esc(r.resources.map((x) => `${x.title} | ${x.url}`).join('\n'))}</textarea></label>
   <div id="e"></div>
   <div class="row bar"><button class="pri">Save</button><button type="button" id="x">Cancel</button>${r.id ? '<button type="button" class="bad" id="del">Delete</button>' : ''}</div></form>`;
  const lines = (v) => v.split('\n').map((s) => s.trim()).filter(Boolean);
  $('#x').onclick = () => $('#dlg').close();
  if (r.id) $('#del').onclick = async () => { if (!confirm('Delete this requirement?')) return; try { await api('admin/requirements/' + r.id, { method: 'DELETE' }); $('#dlg').close(); route(); } catch (e) { errBox(e); } };
  $('#f').onsubmit = async (ev) => {
    ev.preventDefault();
    const f = ev.target;
    const body = {
      title: f.title.value, level: f.level.value, window: f.window.value, description: f.description.value, howToSubmit: f.howToSubmit.value,
      openAt: fromLocalInput(f.openAt.value), closeAt: fromLocalInput(f.closeAt.value), lateDays: +f.lateDays.value, maxMB: +f.maxMB.value,
      published: f.published.checked, fileTypes: f.fileTypes.value.split(',').map((s) => s.trim()).filter(Boolean),
      instructions: lines(f.instructions.value),
      rubric: lines(f.rubric.value).map((l) => { const [m, ...n] = l.split('|'); return { max: +m, name: n.join('|').trim() }; }),
      resources: lines(f.resources.value).map((l) => { const i = l.lastIndexOf('|'); return { title: l.slice(0, i).trim(), url: l.slice(i + 1).trim() }; }),
    };
    try { await api('admin/requirements' + (r.id ? '/' + r.id : ''), { body }); $('#dlg').close(); route(); }
    catch (e) { errBox(e); }
  };
  $('#dlg').showModal();
}

async function viewSubs() {
  const [subs, reqs] = await Promise.all([api('admin/submissions'), api('requirements')]);
  const R = Object.fromEntries(reqs.map((r) => [r.id, r]));
  app.innerHTML = `<h1>Submissions</h1>
  <div class="filters"><select id="fg"><option value="">All</option><option value="new">Awaiting grading</option><option value="done">Graded</option></select><select id="fl"><option value="">All levels</option>${LEVEL_OPTS()}</select></div>
  <div class="card tw"><table id="t" class="stack"></table></div>`;
  const draw = () => {
    const g = $('#fg').value, lv = $('#fl').value;
    const rows = subs.filter((s) => (!g || (g === 'done') === !!s.grade) && (!lv || R[s.reqId]?.level === lv)).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
    $('#t').innerHTML = `<tr class="hd"><th>Trainee</th><th>Requirement</th><th>Submission</th><th class="n">Score</th><th></th></tr>` + (rows.map((s) => `<tr><td class="ttl">${esc(s.user.name)} <small class="muted">${s.user.level}</small></td>
     <td data-label="Requirement">${esc(R[s.reqId]?.title)}</td><td data-label="Submission"><a href="/api/submissions/${s.id}/file">${esc(s.fileName)}</a><br><small>${fmt(s.submittedAt)}</small> ${s.late ? '<span class="tag t-late">Late</span>' : ''}</td>
     <td class="n" data-label="Score">${s.grade ? `${s.grade.total}<br><small>${esc(s.grade.band)}</small>` : '—'}</td><td><button data-id="${s.id}">${s.grade ? 'Edit' : 'Grade'}</button></td></tr>`).join('') || '<tr><td colspan="5" class="muted">Nothing here</td></tr>');
    $('#t').querySelectorAll('button').forEach((b) => b.onclick = () => grade(subs.find((s) => s.id === b.dataset.id), R));
  };
  $('#fg').onchange = $('#fl').onchange = draw; draw();
}

function grade(s, R) {
  const r = R[s.reqId];
  const lateDays = (new Date(s.submittedAt) - new Date(r.closeAt)) / 864e5;
  const t = lateDays <= 0 ? 10 : lateDays <= 7 ? 5 : 0;
  $('#dlgBody').innerHTML = `<h2>${esc(r.title)}</h2><p>${esc(s.user.name)} · <a href="/api/submissions/${s.id}/file">${esc(s.fileName)}</a> · ${fmt(s.submittedAt)}</p>
   ${s.note ? `<div class="box">Trainee's note: ${esc(s.note)}</div>` : ''}
   <div class="tw"><table class="stack"><tr class="hd"><th>Criterion</th><th class="n">Max</th><th>Rating</th><th class="n">Score</th></tr>
   ${r.rubric.map((c, i) => `<tr><td class="ttl">${esc(c.name)}</td><td class="n" data-label="Max">${c.max}</td><td data-label="Rating"><select data-i="${i}">${RATE.map(([k, v]) => `<option value="${k}" ${s.grade?.items[i]?.rating === k ? 'selected' : ''}>${v}</option>`).join('')}</select></td><td class="n" data-label="Score" data-o></td></tr>`).join('')}
   <tr><td class="ttl">Submitted on time (computed automatically)</td><td class="n" data-label="Max">10</td><td data-label="Rating">${t === 10 ? 'On time' : t === 5 ? '1–7 days late' : 'More than 7 days late'}</td><td class="n" data-label="Score">${t}</td></tr>
   <tr class="tot"><th colspan="3">Total</th><th class="n score" id="tot"></th></tr></table></div>
   <label>Feedback to the trainee<textarea id="fb">${esc(s.grade?.feedback || '')}</textarea></label><div id="e"></div>
   <div class="row bar"><button class="pri" id="sv">Save grade</button><button id="x">Cancel</button>${s.grade ? '<button class="bad" id="rm">Remove grade (allows re-upload)</button>' : ''}</div>`;
  const pct = { excellent: 1, adequate: 0.7, weak: 0.4, absent: 0 };
  const calc = () => {
    let sum = t;
    $('#dlgBody').querySelectorAll('select[data-i]').forEach((sel) => { const v = Math.round(r.rubric[sel.dataset.i].max * pct[sel.value] * 10) / 10; sel.closest('tr').querySelector('[data-o]').textContent = v; sum += v; });
    $('#tot').textContent = Math.round(sum * 10) / 10;
  };
  $('#dlgBody').onchange = calc; calc();
  $('#x').onclick = () => $('#dlg').close();
  if (s.grade) $('#rm').onclick = async () => { await api('admin/grade/' + s.id, { method: 'DELETE' }); $('#dlg').close(); route(); };
  $('#sv').onclick = async () => {
    const ratings = [...$('#dlgBody').querySelectorAll('select[data-i]')].map((x) => x.value);
    try { await api('admin/grade/' + s.id, { body: { ratings, feedback: $('#fb').value } }); $('#dlg').close(); route(); }
    catch (e) { errBox(e); }
  };
  $('#dlg').showModal();
}

// ---------- Information pages ----------

function viewGuide() {
  app.innerHTML = `<h1>User guide</h1>
  <div class="card"><h2>For trainees</h2><ol class="steps">
   <li><b>Register:</b> under “Register”, enter your name as in SCFHS records, your email, SCFHS classification number and level (R1–R4).</li>
   <li><b>Wait for activation:</b> the administration reviews and activates your account. You cannot sign in before that.</li>
   <li><b>My requirements:</b> after signing in you see only your level's requirements, each with a status: not open yet · open · late · closed · submitted · graded.</li>
   <li><b>Details:</b> open any requirement to see the instructions, the required file type and size, how to submit, the evaluation criteria and references.</li>
   <li><b>Upload:</b> only within the submission window. You can replace the file until the window closes or it is graded.</li>
   <li><b>Result:</b> the score per criterion and the assessor's feedback appear inside the requirement.</li></ol></div>
  <div class="card"><h2>Submission window and lateness</h2><ul>
   <li>Each requirement has an <b>open</b> and a <b>close</b> time (Riyadh time), with a countdown.</li>
   <li>After closing, late submissions are accepted for 14 days (the administration can change this): 1–7 days late = 5 of 10, 8–14 days = 0 of 10.</li>
   <li>After the late period, uploading is closed and the case goes to the program director.</li></ul></div>
  <div class="card"><h2>How grading works</h2><p>Every requirement is scored out of 100: 90 for its own content criteria and 10 for on-time submission. Each criterion is rated:</p>
   <div class="tw"><table><tr><th>Rating</th><th class="n">Share of the criterion's points</th></tr><tr><td>Excellent – complete, accurate, exceeds the standard</td><td class="n">100%</td></tr><tr><td>Adequate – meets the standard with minor gaps</td><td class="n">70%</td></tr><tr><td>Weak – major gaps</td><td class="n">40%</td></tr><tr><td>Absent – not done</td><td class="n">0%</td></tr></table></div>
   <div class="tw"><table><tr><th>Total</th><th>SCFHS band</th></tr><tr><td class="n">≥ 90</td><td>Exceeds expectation</td></tr><tr><td class="n">70–89.9</td><td>Meets expectation</td></tr><tr><td class="n">50–69.9</td><td>Borderline (minimum for unconditional promotion)</td></tr><tr><td class="n">&lt; 50</td><td>Does not meet expectation</td></tr></table></div></div>
  <div class="card"><h2>File types</h2><div class="tw"><table><tr><th>Requirement type</th><th>Format</th><th>Content</th></tr>
   <tr><td>Courses and certificates</td><td>PDF</td><td>Certificate in your full name + a 3–5 line reflection</td></tr>
   <tr><td>CAP, seminars, scientific presentation</td><td>PPTX / PDF</td><td>Slides + signed evaluation form</td></tr>
   <tr><td>Reports and research (CAT, white paper, outbreak…)</td><td>DOCX / PDF</td><td>Report with cover page and references + signed form</td></tr>
   <tr><td>CBD, Mini-CEX, COT</td><td>PDF / JPG / PNG</td><td>Form signed by the assessor</td></tr>
   <tr><td>Portfolio and research milestones</td><td>PDF / ZIP</td><td>All evidence organized in folders</td></tr></table></div>
   <p class="muted">Name the file Name_Level_Requirement (e.g. Ahmed_R2_CAT1.pdf). Maximum 25 MB.</p></div>
  <div class="card"><h2>For the administration</h2><ol class="steps">
   <li><b>Trainees:</b> activate new registrations after checking the SCFHS number, change the level on promotion, or disable an account.</li>
   <li><b>Requirements:</b> pre-filled from the promotion handbook (R1–R4) with the training-year dates. Edit dates, formats, criteria and references, or add and publish a new requirement.</li>
   <li><b>Submissions:</b> download the file and rate each criterion; the timeliness score and total are computed automatically. Add your feedback.</li></ol></div>`;
}

const SITES = [
  ['Saudi Commission for Health Specialties (SCFHS)', 'https://www.scfhs.org.sa/', ['Create an account on the SCFHS portal (Mumaris+) with your national ID and email.', 'Take the universal-topic e-modules (marked *) on the SCFHS e-learning platform with the same account.', 'Download the certificate after passing the quiz and upload it as a PDF.']],
  ['CDC TRAIN (Health Literacy, Communicating Science Clearly, CERC, ERHMS)', 'https://www.train.org/cdctrain/', ['Click Create an Account, choose the CDC group, and confirm your email.', 'Search by course ID (e.g. 1105934 or 1112747) or name, then Register and Launch.', 'When finished: Your Learning → Completed → Certificate; save it as a PDF.']],
  ['WHO Vaccine Safety Basics', 'https://vaccine-safety-training.org/', ['Register with your email.', 'Complete the modules and the final test.', 'Download the certificate from your account page.']],
  ['OpenWHO (free WHO courses)', 'https://openwho.org/', ['Register with email or a Google account.', 'Enroll in the course and complete the units.', 'The Record of Achievement appears under Certificates.']],
  ['National Committee of Bioethics (NCBE)', 'http://bioethics.kacst.edu.sa/', ['Register as a researcher and complete the research ethics course.', 'Save the registration/course certificate (it expires — check the date).', 'You will need it when submitting your research protocol to the IRB.']],
  ['PROSPERO (systematic review registration)', 'https://www.crd.york.ac.uk/prospero/', ['Create an account (Join).', 'Register a review and complete the protocol form before screening starts.', 'Save the CRD registration number and add it to your proposal.']],
  ['Web of Science Master Journal List', 'https://mjl.clarivate.com/', ['Search by journal name or ISSN.', 'Make sure it is in SCIE/SSCI before submitting.', 'Keep the submission email and manuscript ID as proof.']],
];

function viewSites() {
  app.innerHTML = `<h1>External registration sites</h1><div class="box">Some requirements are completed on external sites. Use your official email and your name as in SCFHS records so certificates match your file.</div>
  ${SITES.map(([t, u, s]) => `<div class="card"><h2>${esc(t)}</h2><a href="${u}" target="_blank" rel="noopener">${u}</a><ol class="steps">${s.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></div>`).join('')}`;
}

const REFS = {
  'Curriculum and regulations': [['SCFHS – curricula, bylaws and forms', 'https://www.scfhs.org.sa/'], ['Saudi MOH Statistical Yearbook', 'https://www.moh.gov.sa/en/Ministry/Statistics/book/Pages/default.aspx'], ['GASTAT', 'https://www.stats.gov.sa/']],
  'Critical appraisal and EBM': [['CASP checklists (PDF)', 'https://casp-uk.net/casp-tools-checklists/'], ['JBI critical appraisal tools (PDF)', 'https://jbi.global/critical-appraisal-tools'], ['Oxford CEBM – levels of evidence & CAT tools', 'https://www.cebm.ox.ac.uk/resources'], ['AGREE II instrument', 'https://www.agreetrust.org/'], ['PubMed', 'https://pubmed.ncbi.nlm.nih.gov/'], ['Cochrane Library', 'https://www.cochranelibrary.com/']],
  'Research and publication': [['EQUATOR Network – reporting guidelines', 'https://www.equator-network.org/'], ['PRISMA 2020 checklist & flow diagram', 'https://www.prisma-statement.org/'], ['STROBE checklists', 'https://www.strobe-statement.org/'], ['CONSORT', 'https://www.consort-spirit.org/'], ['COPE guidelines for peer reviewers', 'https://publicationethics.org/guidance'], ['Web of Science Master Journal List', 'https://mjl.clarivate.com/']],
  'Field epidemiology and surveillance': [['CDC Field Epidemiology Manual', 'https://www.cdc.gov/field-epi-manual/'], ['CDC Guidelines for Evaluating Surveillance Systems (MMWR 2001)', 'https://www.cdc.gov/mmwr/preview/mmwrhtml/rr5013a1.htm'], ['WHO Disease Outbreak News', 'https://www.who.int/emergencies/disease-outbreak-news'], ['ProMED', 'https://promedmail.org/'], ['CDC NHSN – surveillance definitions', 'https://www.cdc.gov/nhsn/'], ['WHO Infection Prevention and Control', 'https://www.who.int/health-topics/infection-prevention-and-control']],
  'Communication and health education': [['CDC CERC manual', 'https://emergency.cdc.gov/cerc/'], ['CDC Clear Communication Index', 'https://www.cdc.gov/ccindex/'], ['Community Tool Box', 'https://ctb.ku.edu/en']],
  'Programs and evaluation': [['CDC Program Evaluation Framework', 'https://www.cdc.gov/evaluation/'], ['RE-AIM', 'https://re-aim.org/']],
};

function viewRefs() {
  app.innerHTML = `<h1>References to download</h1><p class="muted">Official links to the checklists, forms and guides used in the requirements.</p>
  ${Object.entries(REFS).map(([g, l]) => `<div class="card"><h2>${g}</h2><ul>${l.map(([t, u]) => `<li><a href="${u}" target="_blank" rel="noopener">${esc(t)}</a> <small class="muted">${u.replace(/^https?:\/\//, '')}</small></li>`).join('')}</ul></div>`).join('')}`;
}

// ---------- Routing ----------

async function route() {
  const h = (location.hash || '#').slice(1);
  if (ME === null) { try { const r = await api('me'); ME = r.user; LEVELS = r.levels; } catch { ME = false; } }
  nav();
  const pub = { login: viewLogin, register: viewRegister, guide: viewGuide, sites: viewSites, refs: viewRefs };
  try {
    if (pub[h]) return pub[h]();
    if (!ME) return viewLogin();
    if (ME.role === 'admin') return await ({ 'admin/reqs': viewReqsAdmin, 'admin/subs': viewSubs }[h] || viewUsers)();
    return await viewDash();
  } catch (e) { app.innerHTML = `<div class="err">${esc(e.message)}</div>`; }
}
window.addEventListener('hashchange', route);
route();
