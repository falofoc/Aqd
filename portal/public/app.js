'use strict';
// واجهة المنصة: صفحة واحدة بتوجيه عبر #

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
  if (!r.ok) throw new Error(data.message || 'خطأ');
  return data;
}

const STATE = { open: 'مفتوح للتسليم', late: 'تسليم متأخر', closed: 'مغلق', upcoming: 'لم يُفتح بعد', unscheduled: 'لم يُحدَّد موعده' };
const RATE = [['excellent', 'ممتاز (100%)'], ['adequate', 'مناسب (70%)'], ['weak', 'ضعيف (40%)'], ['absent', 'غير موجود (0%)']];
const fmt = (d) => d ? '<bdi>' + new Date(d).toLocaleString('ar-SA-u-ca-gregory-nu-latn', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Riyadh' }) + '</bdi>' : '—';
const left = (d) => {
  const ms = new Date(d) - Date.now();
  if (ms <= 0) return '';
  const days = Math.floor(ms / 86400000), h = Math.floor(ms / 3600000) % 24;
  return days ? `متبقٍ ${days} يوم و${h} ساعة` : `متبقٍ ${h} ساعة`;
};
const toLocalInput = (d) => d ? new Date(new Date(d).getTime() + 3 * 3600000).toISOString().slice(0, 16) : '';
const fromLocalInput = (v) => v ? new Date(v + ':00+03:00').toISOString() : null;

function nav() {
  const h = location.hash || '#';
  const links = !ME
    ? [['#login', 'الدخول'], ['#register', 'تسجيل متدرب'], ['#guide', 'دليل الاستخدام'], ['#sites', 'مواقع التسجيل'], ['#refs', 'المراجع']]
    : ME.role === 'admin'
      ? [['#admin/users', 'المتدربون'], ['#admin/reqs', 'المتطلبات'], ['#admin/subs', 'التسليمات'], ['#guide', 'الدليل'], ['#refs', 'المراجع']]
      : [['#dash', 'متطلباتي'], ['#guide', 'دليل الاستخدام'], ['#sites', 'مواقع التسجيل'], ['#refs', 'المراجع']];
  $('#nav').innerHTML = links.map(([k, t]) => `<a href="${k}" class="${h.startsWith(k) ? 'on' : ''}">${t}</a>`).join('') +
    (ME ? `<button id="out">خروج (${esc(ME.name)})</button>` : '');
  if (ME) $('#out').onclick = async () => { await api('logout', { method: 'POST' }); ME = null; location.hash = '#login'; };
}

// ---------- الدخول والتسجيل ----------

function viewLogin() {
  app.innerHTML = `<div class="card" style="max-width:420px;margin:auto;width:100%"><h1>تسجيل الدخول</h1>
  <form id="f" class="list"><label>البريد الإلكتروني<input name="email" type="email" required autocomplete="email"></label>
  <label>كلمة المرور<input name="password" type="password" required autocomplete="current-password"></label>
  <div id="e"></div><button class="pri">دخول</button></form>
  <p class="muted">ليس لديك حساب؟ <a href="#register">سجّل كمتدرب</a> — يُفعَّل الحساب بعد موافقة الإدارة.</p></div>`;
  $('#f').onsubmit = async (ev) => {
    ev.preventDefault();
    try { const u = await api('login', { body: Object.fromEntries(new FormData(ev.target)) }); ME = null; location.hash = u.role === 'admin' ? '#admin/users' : '#dash'; }
    catch (e) { $('#e').innerHTML = `<div class="err">${esc(e.message)}</div>`; }
  };
}

function viewRegister() {
  app.innerHTML = `<div class="card"><h1>تسجيل متدرب جديد</h1>
  <div class="box"><p>بعد التسجيل يكون الحساب <b>بانتظار التفعيل</b>. تراجع الإدارة بياناتك (رقم التصنيف ومستوى التدريب) ثم تفعّل الحساب، وبعدها تظهر لك متطلبات مستواك.</p></div>
  <form id="f" class="grid2">
   <label>الاسم الرباعي (كما في الهيئة)<input name="name" required></label>
   <label>البريد الإلكتروني<input name="email" type="email" required></label>
   <label>رقم الجوال<input name="phone" inputmode="tel"></label>
   <label>رقم التصنيف المهني (SCFHS)<input name="scfhs" required></label>
   <label>المستوى التدريبي<select name="level">${['R1', 'R2', 'R3', 'R4'].map((l) => `<option>${l}</option>`).join('')}</select></label>
   <label>مركز التدريب<input name="center"></label>
   <label>كلمة المرور (8 أحرف على الأقل)<input name="password" type="password" minlength="8" required autocomplete="new-password"></label>
   <div style="align-self:end"><button class="pri">إرسال طلب التسجيل</button></div>
  </form><div id="e"></div></div>`;
  $('#f').onsubmit = async (ev) => {
    ev.preventDefault();
    try { const r = await api('register', { body: Object.fromEntries(new FormData(ev.target)) }); app.innerHTML = `<div class="box"><h2>تم استلام طلبك</h2><p>${esc(r.message)}</p><a class="btn" href="#login">العودة للدخول</a></div>`; }
    catch (e) { $('#e').innerHTML = `<div class="err">${esc(e.message)}</div>`; }
  };
}

// ---------- لوحة المتدرب ----------

function stateTag(r) {
  if (r.submission?.grade) return `<span class="tag t-done">مُقيَّم ${r.submission.grade.total}/100</span>`;
  if (r.submission) return `<span class="tag t-done">تم التسليم</span>`;
  return `<span class="tag t-${r.state}">${STATE[r.state]}</span>`;
}

async function viewDash() {
  const reqs = await api('requirements');
  const lv = LEVELS[ME.level] || {};
  const done = reqs.filter((r) => r.submission).length;
  const openNow = reqs.filter((r) => ['open', 'late'].includes(r.state) && !r.submission);
  app.innerHTML = `<div class="box"><h1>${esc(lv.title || ME.level)}</h1><p class="en">${esc(lv.desc || '')}</p>
   <p>المسلَّم: <b>${done}</b> من <b>${reqs.length}</b> · مفتوح الآن ولم يُسلَّم: <b>${openNow.length}</b></p></div>
   ${openNow.length ? `<div class="warn"><b>مطلوب الآن:</b> ${openNow.map((r) => `${esc(r.title)} (${left(r.state === 'open' ? r.closeAt : new Date(new Date(r.closeAt).getTime() + r.lateDays * 864e5))})`).join(' · ')}</div>` : ''}
   <div class="filters"><select id="fs"><option value="">كل الحالات</option>${Object.entries(STATE).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}<option value="sub">المسلَّمة</option></select></div>
   <div class="list" id="l"></div>`;
  const draw = () => {
    const f = $('#fs').value;
    $('#l').innerHTML = reqs.filter((r) => !f || (f === 'sub' ? r.submission : r.state === f && !r.submission))
      .map((r) => `<button class="req" data-id="${r.id}"><span class="win">${esc(r.window)}</span><span class="en">${esc(r.title)}<br><small class="muted" dir="rtl">${fmt(r.openAt)} ← ${fmt(r.closeAt)}</small></span>${stateTag(r)}</button>`).join('') || '<p class="muted">لا يوجد</p>';
    app.querySelectorAll('.req').forEach((b) => b.onclick = () => openReq(reqs.find((x) => x.id === b.dataset.id)));
  };
  $('#fs').onchange = draw; draw();
}

function rubricTable(r, grade) {
  const rows = r.rubric.map((c, i) => `<tr><td class="en">${esc(c.name)}</td><td class="n">${c.max}</td>${grade ? `<td class="n">${grade.items[i]?.score ?? '—'}</td>` : ''}</tr>`).join('');
  return `<div class="tw"><table><tr><th>المعيار</th><th class="n">الدرجة القصوى</th>${grade ? '<th class="n">درجتك</th>' : ''}</tr>${rows}
  <tr><td>الالتزام بالموعد (في الموعد 10 · تأخير 1–7 أيام 5 · أكثر 0)</td><td class="n">10</td>${grade ? `<td class="n">${grade.timeliness}</td>` : ''}</tr>
  <tr><th>المجموع</th><th class="n">100</th>${grade ? `<th class="n">${grade.total}</th>` : ''}</tr></table></div>`;
}

function reqDetails(r) {
  const lateEnd = new Date(new Date(r.closeAt).getTime() + r.lateDays * 864e5);
  return `<div class="row"><span class="win">${esc(r.window)}</span><span class="tag t-${r.state}">${STATE[r.state]}</span>${r.proposed ? '<span class="tag t-late">مقترح من المنهج</span>' : ''}</div>
  <h2 class="en">${esc(r.title)}</h2>
  <div class="grid2">
   <div class="box"><b>نافذة التسليم</b><span>يفتح: ${fmt(r.openAt)}</span><span>يغلق: ${fmt(r.closeAt)}</span>${r.lateDays ? `<span class="muted">يُقبل متأخراً حتى ${fmt(lateEnd)} مع خصم درجات الموعد</span>` : ''}<b>${r.state === 'upcoming' ? 'يفتح بعد: ' + left(r.openAt).replace('متبقٍ ', '') : r.state === 'open' ? left(r.closeAt) : ''}</b></div>
   <div class="box"><b>الملف المطلوب</b><span>الصيغ المقبولة: <b class="en">${r.fileTypes.map((x) => '.' + x).join(' ')}</b></span><span>الحد الأقصى: ${r.maxMB} ميجابايت</span><span>${esc(r.howToSubmit)}</span></div>
  </div>
  <div><h3>خطوات التنفيذ</h3><ol class="en steps">${r.instructions.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></div>
  <div><h3>آلية التقييم (100 درجة)</h3><p class="muted">كل معيار يُقدَّر: ممتاز 100% · مناسب 70% · ضعيف 40% · غير موجود 0%. النتيجة: ≥90 يتجاوز · 70–89 يحقق · 50–69 حدّي · أقل من 50 لا يحقق.</p>${rubricTable(r, r.submission?.grade)}</div>
  ${r.resources.length ? `<div><h3>مراجع وأدوات</h3><ul class="en">${r.resources.map((x) => `<li><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title)}</a></li>`).join('')}</ul></div>` : ''}`;
}

function openReq(r) {
  const s = r.submission;
  const canUpload = ['open', 'late'].includes(r.state) && !s?.grade;
  $('#dlgBody').innerHTML = `${reqDetails(r)}
   <div class="card"><h3>التسليم</h3>
    ${s ? `<p>آخر تسليم: <a href="/api/submissions/${s.id}/file">${esc(s.fileName)}</a> · ${fmt(s.submittedAt)} ${s.late ? '<span class="tag t-late">متأخر</span>' : ''}</p>` : '<p class="muted">لم تسلّم بعد.</p>'}
    ${s?.grade ? `<div class="box"><span class="score">${s.grade.total}/100 · ${esc(s.grade.band)}</span>${s.grade.feedback ? `<p><b>ملاحظات المقيّم:</b> ${esc(s.grade.feedback)}</p>` : ''}</div>` : ''}
    ${canUpload ? `<div class="drop"><input type="file" id="file" accept="${r.fileTypes.map((x) => '.' + x).join(',')}"><label style="margin-top:8px">ملاحظة للمقيّم (اختياري)<input id="note"></label>
      <button class="pri" id="up" style="margin-top:8px">${s ? 'استبدال الملف' : 'رفع الملف'}</button>${r.state === 'late' ? '<p class="err" style="margin-top:8px">التسليم الآن متأخر وسيُخصم من درجة الالتزام بالموعد.</p>' : ''}</div>`
      : `<p class="muted">${s?.grade ? 'تم التقييم، لا يمكن الاستبدال.' : r.state === 'upcoming' ? 'سيُتاح الرفع عند فتح النافذة.' : r.state === 'closed' ? 'أُغلقت نافذة التسليم.' : ''}</p>`}
    <div id="e"></div></div>
   <button id="x">إغلاق</button>`;
  $('#x').onclick = () => $('#dlg').close();
  if (canUpload) $('#up').onclick = async () => {
    const f = $('#file').files[0];
    if (!f) return $('#e').innerHTML = '<div class="err">اختر ملفاً</div>';
    if (f.size > r.maxMB * 1048576) return $('#e').innerHTML = `<div class="err">الملف أكبر من ${r.maxMB} ميجابايت</div>`;
    $('#up').disabled = true; $('#up').textContent = 'جارٍ الرفع…';
    try {
      await api(`requirements/${r.id}/submit`, { method: 'POST', body: f, headers: { 'X-File-Name': encodeURIComponent(f.name), 'X-Note': encodeURIComponent($('#note').value) } });
      $('#dlg').close(); route();
    } catch (e) { $('#e').innerHTML = `<div class="err">${esc(e.message)}</div>`; $('#up').disabled = false; $('#up').textContent = 'رفع الملف'; }
  };
  $('#dlg').showModal();
}

// ---------- الإدارة ----------

async function viewUsers() {
  const users = await api('admin/users');
  const st = { pending: ['بانتظار التفعيل', 't-late'], active: ['مفعّل', 't-open'], disabled: ['موقوف', 't-closed'] };
  app.innerHTML = `<h1>المتدربون</h1><div class="box">الطلبات الجديدة تظهر أولاً. تحقّق من رقم التصنيف في الهيئة ثم فعّل الحساب وحدّد المستوى.</div>
  <div class="tw card"><table><tr><th>الاسم</th><th>البريد / الجوال</th><th>التصنيف</th><th>المركز</th><th>المستوى</th><th>الحالة</th><th></th></tr>
  ${users.sort((a, b) => (a.status === 'pending' ? -1 : 0) - (b.status === 'pending' ? -1 : 0)).map((u) => `<tr data-id="${u.id}"><td>${esc(u.name)}</td><td class="en">${esc(u.email)}<br>${esc(u.phone)}</td><td>${esc(u.scfhs)}</td><td>${esc(u.center)}</td>
   <td><select data-lv>${['R1', 'R2', 'R3', 'R4'].map((l) => `<option ${l === u.level ? 'selected' : ''}>${l}</option>`).join('')}</select></td>
   <td><span class="tag ${st[u.status][1]}">${st[u.status][0]}</span></td>
   <td class="row">${u.status !== 'active' ? '<button class="pri" data-s="active">تفعيل</button>' : '<button class="bad" data-s="disabled">إيقاف</button>'}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">لا يوجد متدربون بعد</td></tr>'}
  </table></div>`;
  app.querySelectorAll('tr[data-id]').forEach((tr) => {
    const save = (b) => api('admin/users/' + tr.dataset.id, { body: b }).then(route).catch((e) => alert(e.message));
    tr.querySelectorAll('[data-s]').forEach((b) => b.onclick = () => save({ status: b.dataset.s, level: $('[data-lv]', tr).value }));
    $('[data-lv]', tr).onchange = (e) => save({ level: e.target.value });
  });
}

async function viewReqsAdmin() {
  const reqs = await api('requirements');
  app.innerHTML = `<div class="row" style="justify-content:space-between"><h1>المتطلبات</h1><button class="pri" id="new">+ متطلب جديد</button></div>
  <div class="filters"><select id="fl"><option value="">كل المستويات</option><option>R1</option><option>R2</option><option>R3</option><option>R4</option></select><input id="q" placeholder="بحث"></div>
  <div class="list" id="l"></div>`;
  const draw = () => {
    const lv = $('#fl').value, q = $('#q').value.toLowerCase();
    $('#l').innerHTML = reqs.filter((r) => (!lv || r.level === lv) && (!q || r.title.toLowerCase().includes(q))).map((r) => `<button class="req" data-id="${r.id}"><span class="win">${r.level} · ${esc(r.window)}</span>
     <span class="en">${esc(r.title)}<br><small class="muted" dir="rtl">${fmt(r.openAt)} ← ${fmt(r.closeAt)} · ${r.count} تسليم</small></span>
     <span class="tag t-${r.published ? r.state : 'closed'}">${r.published ? STATE[r.state] : 'غير منشور'}</span></button>`).join('');
    app.querySelectorAll('.req').forEach((b) => b.onclick = () => editReq(reqs.find((x) => x.id === b.dataset.id)));
  };
  $('#fl').onchange = $('#q').oninput = draw; draw();
  $('#new').onclick = () => editReq({ title: '', level: 'R1', window: '', description: '', instructions: [], rubric: [{ name: 'المحتوى', max: 90 }], resources: [], fileTypes: ['pdf'], howToSubmit: '', maxMB: 25, lateDays: 14, published: false });
}

function editReq(r) {
  $('#dlgBody').innerHTML = `<h2>${r.id ? 'تعديل متطلب' : 'متطلب جديد'}</h2><form id="f" class="list">
   <div class="grid2"><label>العنوان<input name="title" value="${esc(r.title)}" required></label>
    <label>المستوى<select name="level">${['R1', 'R2', 'R3', 'R4'].map((l) => `<option ${l === r.level ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label>الوسم (مثل MAR أو JAN–FEB)<input name="window" value="${esc(r.window)}"></label>
    <label>يفتح (توقيت الرياض)<input type="datetime-local" name="openAt" value="${toLocalInput(r.openAt)}"></label>
    <label>يغلق (توقيت الرياض)<input type="datetime-local" name="closeAt" value="${toLocalInput(r.closeAt)}"></label>
    <label>أيام القبول المتأخر بعد الإغلاق<input type="number" name="lateDays" min="0" value="${r.lateDays}"></label>
    <label>صيغ الملفات (مفصولة بفاصلة)<input name="fileTypes" class="en" value="${esc(r.fileTypes.join(', '))}"></label>
    <label>الحد الأقصى (ميجابايت)<input type="number" name="maxMB" min="1" max="100" value="${r.maxMB}"></label>
    <label style="align-self:end;display:flex;gap:8px;align-items:center"><input type="checkbox" name="published" style="width:auto" ${r.published ? 'checked' : ''}> منشور للمتدربين</label></div>
   <label>الوصف<textarea name="description">${esc(r.description)}</textarea></label>
   <label>طريقة التسليم<textarea name="howToSubmit">${esc(r.howToSubmit)}</textarea></label>
   <label>خطوات التنفيذ (سطر لكل خطوة)<textarea name="instructions" class="en" rows="6">${esc(r.instructions.join('\n'))}</textarea></label>
   <label>معايير التقييم (سطر لكل معيار: الدرجة | المعيار — المجموع 90، و10 للموعد تُضاف آلياً)<textarea name="rubric" class="en" rows="6">${esc(r.rubric.map((c) => `${c.max} | ${c.name}`).join('\n'))}</textarea></label>
   <label>المراجع (سطر لكل مرجع: العنوان | الرابط)<textarea name="resources" class="en">${esc(r.resources.map((x) => `${x.title} | ${x.url}`).join('\n'))}</textarea></label>
   <div id="e"></div>
   <div class="row"><button class="pri">حفظ</button><button type="button" id="x">إلغاء</button>${r.id ? '<button type="button" class="bad" id="del">حذف</button>' : ''}</div></form>`;
  const lines = (v) => v.split('\n').map((s) => s.trim()).filter(Boolean);
  $('#x').onclick = () => $('#dlg').close();
  if (r.id) $('#del').onclick = async () => { if (!confirm('حذف المتطلب؟')) return; try { await api('admin/requirements/' + r.id, { method: 'DELETE' }); $('#dlg').close(); route(); } catch (e) { $('#e').innerHTML = `<div class="err">${esc(e.message)}</div>`; } };
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
    catch (e) { $('#e').innerHTML = `<div class="err">${esc(e.message)}</div>`; }
  };
  $('#dlg').showModal();
}

async function viewSubs() {
  const [subs, reqs] = await Promise.all([api('admin/submissions'), api('requirements')]);
  const R = Object.fromEntries(reqs.map((r) => [r.id, r]));
  app.innerHTML = `<h1>التسليمات</h1>
  <div class="filters"><select id="fg"><option value="">الكل</option><option value="new">بانتظار التقييم</option><option value="done">مُقيَّمة</option></select><select id="fl"><option value="">كل المستويات</option><option>R1</option><option>R2</option><option>R3</option><option>R4</option></select></div>
  <div class="card tw"><table id="t"></table></div>`;
  const draw = () => {
    const g = $('#fg').value, lv = $('#fl').value;
    const rows = subs.filter((s) => (!g || (g === 'done') === !!s.grade) && (!lv || R[s.reqId]?.level === lv)).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
    $('#t').innerHTML = `<tr><th>المتدرب</th><th>المتطلب</th><th>التسليم</th><th class="n">الدرجة</th><th></th></tr>` + (rows.map((s) => `<tr><td>${esc(s.user.name)}<br><small class="muted">${s.user.level}</small></td>
     <td class="en">${esc(R[s.reqId]?.title)}</td><td><a href="/api/submissions/${s.id}/file">${esc(s.fileName)}</a><br><small>${fmt(s.submittedAt)}</small> ${s.late ? '<span class="tag t-late">متأخر</span>' : ''}</td>
     <td class="n">${s.grade ? `${s.grade.total}<br><small>${esc(s.grade.band)}</small>` : '—'}</td><td><button data-id="${s.id}">${s.grade ? 'تعديل' : 'تقييم'}</button></td></tr>`).join('') || '<tr><td colspan="5" class="muted">لا يوجد</td></tr>');
    $('#t').querySelectorAll('button').forEach((b) => b.onclick = () => grade(subs.find((s) => s.id === b.dataset.id), R));
  };
  $('#fg').onchange = $('#fl').onchange = draw; draw();
}

function grade(s, R) {
  const r = R[s.reqId];
  const lateDays = (new Date(s.submittedAt) - new Date(r.closeAt)) / 864e5;
  const t = lateDays <= 0 ? 10 : lateDays <= 7 ? 5 : 0;
  $('#dlgBody').innerHTML = `<h2 class="en">${esc(r.title)}</h2><p>${esc(s.user.name)} · <a href="/api/submissions/${s.id}/file">${esc(s.fileName)}</a> · ${fmt(s.submittedAt)}</p>
   ${s.note ? `<div class="box">ملاحظة المتدرب: ${esc(s.note)}</div>` : ''}
   <div class="tw"><table><tr><th>المعيار</th><th class="n">القصوى</th><th>التقدير</th><th class="n">الدرجة</th></tr>
   ${r.rubric.map((c, i) => `<tr><td class="en">${esc(c.name)}</td><td class="n">${c.max}</td><td><select data-i="${i}">${RATE.map(([k, v]) => `<option value="${k}" ${s.grade?.items[i]?.rating === k ? 'selected' : ''}>${v}</option>`).join('')}</select></td><td class="n" data-o></td></tr>`).join('')}
   <tr><td>الالتزام بالموعد (يُحسب آلياً)</td><td class="n">10</td><td>${t === 10 ? 'في الموعد' : t === 5 ? 'تأخير 1–7 أيام' : 'تأخير أكثر من 7 أيام'}</td><td class="n">${t}</td></tr>
   <tr><th colspan="3">المجموع</th><th class="n score" id="tot"></th></tr></table></div>
   <label>ملاحظات للمتدرب<textarea id="fb">${esc(s.grade?.feedback || '')}</textarea></label><div id="e"></div>
   <div class="row"><button class="pri" id="sv">حفظ التقييم</button><button id="x">إلغاء</button>${s.grade ? '<button class="bad" id="rm">إلغاء التقييم (يسمح بإعادة الرفع)</button>' : ''}</div>`;
  const pct = Object.fromEntries([['excellent', 1], ['adequate', .7], ['weak', .4], ['absent', 0]]);
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
    catch (e) { $('#e').innerHTML = `<div class="err">${esc(e.message)}</div>`; }
  };
  $('#dlg').showModal();
}

// ---------- صفحات المعلومات ----------

function viewGuide() {
  app.innerHTML = `<h1>دليل استخدام المنصة</h1>
  <div class="card"><h2>للمتدرب</h2><ol class="steps">
   <li><b>التسجيل:</b> من «تسجيل متدرب» أدخل اسمك كما في الهيئة، بريدك، رقم التصنيف المهني، ومستواك (R1–R4).</li>
   <li><b>انتظار التفعيل:</b> تراجع الإدارة الطلب وتفعّله. لا يمكن الدخول قبل التفعيل.</li>
   <li><b>متطلباتي:</b> بعد الدخول تظهر متطلبات مستواك فقط، مع حالة كل متطلب: لم يُفتح بعد · مفتوح · متأخر · مغلق · تم التسليم · مُقيَّم.</li>
   <li><b>التفاصيل:</b> اضغط أي متطلب لترى خطوات التنفيذ، نوع الملف المطلوب وحجمه، طريقة التسليم، معايير التقييم، والمراجع.</li>
   <li><b>الرفع:</b> يُتاح فقط داخل نافذة التسليم. يمكنك استبدال الملف حتى الإغلاق أو حتى يُقيَّم.</li>
   <li><b>النتيجة:</b> تظهر الدرجة لكل معيار وملاحظات المقيّم داخل المتطلب نفسه.</li></ol></div>
  <div class="card"><h2>نافذة التسليم والتأخير</h2><ul>
   <li>لكل متطلب موعد <b>فتح</b> وموعد <b>إغلاق</b> (بتوقيت الرياض)، ويظهر عدّاد للوقت المتبقي.</li>
   <li>بعد الإغلاق يُقبل التسليم متأخراً لمدة 14 يوماً (قابلة للتعديل من الإدارة): تأخير 1–7 أيام = 5 من 10، 8–14 يوماً = 0 من 10.</li>
   <li>بعد انتهاء فترة التأخير يُغلق الرفع نهائياً ويُحال الأمر لمدير البرنامج.</li></ul></div>
  <div class="card"><h2>آلية التقييم</h2><p>كل متطلب من 100 درجة: 90 لمعايير المحتوى الخاصة به و10 للالتزام بالموعد. يُقدَّر كل معيار:</p>
   <div class="tw"><table><tr><th>التقدير</th><th class="n">النسبة من درجة المعيار</th></tr><tr><td>ممتاز – مكتمل ودقيق ويتجاوز المعيار</td><td class="n">100%</td></tr><tr><td>مناسب – يحقق المعيار مع نواقص بسيطة</td><td class="n">70%</td></tr><tr><td>ضعيف – نواقص جوهرية</td><td class="n">40%</td></tr><tr><td>غير موجود</td><td class="n">0%</td></tr></table></div>
   <div class="tw"><table><tr><th>المجموع</th><th>التصنيف (SCFHS)</th></tr><tr><td class="n">90 فأكثر</td><td>يتجاوز التوقعات</td></tr><tr><td class="n">70–89.9</td><td>يحقق التوقعات</td></tr><tr><td class="n">50–69.9</td><td>حدّي (الحد الأدنى للترقية غير المشروطة)</td></tr><tr><td class="n">أقل من 50</td><td>لا يحقق التوقعات</td></tr></table></div></div>
  <div class="card"><h2>أنواع الملفات</h2><div class="tw"><table><tr><th>نوع المتطلب</th><th>الصيغة</th><th>المحتوى</th></tr>
   <tr><td>الدورات والشهادات</td><td class="en">PDF</td><td>الشهادة باسمك الكامل + تأمل من 3–5 أسطر</td></tr>
   <tr><td>CAP، السمنار، العرض العلمي</td><td class="en">PPTX / PDF</td><td>الشرائح + نموذج التقييم الموقّع</td></tr>
   <tr><td>التقارير والأبحاث (CAT، الورقة البيضاء، التقصي…)</td><td class="en">DOCX / PDF</td><td>تقرير بغلاف ومراجع + النموذج الموقّع</td></tr>
   <tr><td>CBD، Mini-CEX، COT</td><td class="en">PDF / JPG / PNG</td><td>النموذج الموقّع من المقيّم</td></tr>
   <tr><td>ملف الإنجاز والمراحل البحثية</td><td class="en">PDF / ZIP</td><td>كل الأدلة مرتبة في مجلدات</td></tr></table></div>
   <p class="muted">سمِّ الملف: الاسم_المستوى_المتطلب (مثال: Ahmed_R2_CAT1.pdf). الحد الأقصى 25 ميجابايت.</p></div>
  <div class="card"><h2>للإدارة</h2><ol class="steps">
   <li><b>المتدربون:</b> فعّل الطلبات الجديدة بعد التحقق من رقم التصنيف، وعدّل المستوى عند الترقية، أو أوقف الحساب.</li>
   <li><b>المتطلبات:</b> مُعبّأة مسبقاً من دليل الترقية (R1–R4) بمواعيد العام التدريبي. عدّل المواعيد، الصيغ، المعايير، المراجع، أو أضف متطلباً جديداً وانشره.</li>
   <li><b>التسليمات:</b> نزّل الملف، اختر تقدير كل معيار، وتُحسب درجة الموعد والمجموع آلياً، ثم أضف ملاحظاتك.</li></ol></div>`;
}

const SITES = [
  ['الهيئة السعودية للتخصصات الصحية (SCFHS)', 'https://www.scfhs.org.sa/', ['أنشئ حساباً في بوابة الهيئة/ممارس بلس برقم الهوية والبريد.', 'الوحدات الإلكترونية للموضوعات العامة (المعلَّمة *) من منصة التعلم الإلكتروني للهيئة بنفس الحساب.', 'حمّل الشهادة بعد اجتياز الاختبار، وارفعها PDF.']],
  ['CDC TRAIN (Health Literacy، Communicating Science Clearly، CERC، ERHMS)', 'https://www.train.org/cdctrain/', ['اضغط Create an Account واختر Group: CDC، وأكّد البريد.', 'ابحث برقم الدورة (مثل 1105934 أو 1112747) أو باسمها ثم Register ثم Launch.', 'بعد الإكمال: Your Learning ← Completed ← Certificate، واحفظها PDF.']],
  ['WHO Vaccine Safety Basics', 'https://vaccine-safety-training.org/', ['سجّل من Register بالبريد.', 'أكمل الوحدات والاختبار النهائي.', 'حمّل الشهادة من صفحة الحساب.']],
  ['OpenWHO (دورات منظمة الصحة العالمية المجانية)', 'https://openwho.org/', ['Register بالبريد أو حساب Google.', 'Enroll في الدورة ثم أكمل الوحدات.', 'Record of Achievement يظهر في Certificates.']],
  ['اللجنة الوطنية للأخلاقيات الحيوية (NCBE)', 'http://bioethics.kacst.edu.sa/', ['سجّل كباحث وأكمل دورة أخلاقيات البحث.', 'احفظ شهادة التسجيل/الدورة (صالحة لمدة محددة—تحقق من التاريخ).', 'ستحتاجها في تقديم بروتوكول البحث للجنة IRB.']],
  ['PROSPERO (تسجيل المراجعات المنهجية)', 'https://www.crd.york.ac.uk/prospero/', ['أنشئ حساباً (Join).', 'Register a review واملأ نموذج البروتوكول قبل بدء الفرز.', 'احفظ رقم التسجيل CRD وأضفه لمقترح البحث.']],
  ['قائمة مجلات Web of Science', 'https://mjl.clarivate.com/', ['ابحث باسم المجلة أو ISSN.', 'تأكد أنها ضمن SCIE/SSCI قبل الإرسال.', 'احفظ بريد الإرسال ورقم المخطوطة كدليل.']],
];

function viewSites() {
  app.innerHTML = `<h1>مواقع التسجيل الخارجية</h1><div class="box">بعض المتطلبات تُنجز في مواقع خارجية. استخدم بريدك الرسمي واسمك كما في الهيئة حتى تطابق الشهادات سجلك.</div>
  ${SITES.map(([t, u, s]) => `<div class="card"><h2>${esc(t)}</h2><a class="en" href="${u}" target="_blank" rel="noopener">${u}</a><ol class="steps">${s.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></div>`).join('')}`;
}

const REFS = {
  'المنهج والأنظمة': [['SCFHS – المناهج واللوائح والنماذج', 'https://www.scfhs.org.sa/'], ['Saudi MOH Statistical Yearbook', 'https://www.moh.gov.sa/en/Ministry/Statistics/book/Pages/default.aspx'], ['GASTAT', 'https://www.stats.gov.sa/']],
  'القراءة النقدية والطب المبني على البراهين': [['CASP checklists (PDF)', 'https://casp-uk.net/casp-tools-checklists/'], ['JBI critical appraisal tools (PDF)', 'https://jbi.global/critical-appraisal-tools'], ['Oxford CEBM – levels of evidence & CAT tools', 'https://www.cebm.ox.ac.uk/resources'], ['AGREE II instrument', 'https://www.agreetrust.org/'], ['PubMed', 'https://pubmed.ncbi.nlm.nih.gov/'], ['Cochrane Library', 'https://www.cochranelibrary.com/']],
  'البحث والنشر': [['EQUATOR Network – reporting guidelines', 'https://www.equator-network.org/'], ['PRISMA 2020 checklist & flow diagram', 'https://www.prisma-statement.org/'], ['STROBE checklists', 'https://www.strobe-statement.org/'], ['CONSORT', 'https://www.consort-spirit.org/'], ['COPE guidelines for peer reviewers', 'https://publicationethics.org/guidance'], ['Web of Science Master Journal List', 'https://mjl.clarivate.com/']],
  'الوبائيات الميدانية والترصد': [['CDC Field Epidemiology Manual', 'https://www.cdc.gov/field-epi-manual/'], ['CDC Guidelines for Evaluating Surveillance Systems (MMWR 2001)', 'https://www.cdc.gov/mmwr/preview/mmwrhtml/rr5013a1.htm'], ['WHO Disease Outbreak News', 'https://www.who.int/emergencies/disease-outbreak-news'], ['ProMED', 'https://promedmail.org/'], ['CDC NHSN – surveillance definitions', 'https://www.cdc.gov/nhsn/'], ['WHO Infection Prevention and Control', 'https://www.who.int/health-topics/infection-prevention-and-control']],
  'التواصل والتثقيف الصحي': [['CDC CERC manual', 'https://emergency.cdc.gov/cerc/'], ['CDC Clear Communication Index', 'https://www.cdc.gov/ccindex/'], ['Community Tool Box', 'https://ctb.ku.edu/en']],
  'البرامج والتقييم': [['CDC Program Evaluation Framework', 'https://www.cdc.gov/evaluation/'], ['RE-AIM', 'https://re-aim.org/']],
};

function viewRefs() {
  app.innerHTML = `<h1>مراجع للتحميل</h1><p class="muted">روابط رسمية لتحميل القوائم والنماذج والأدلة المستخدمة في المتطلبات.</p>
  ${Object.entries(REFS).map(([g, l]) => `<div class="card"><h2>${g}</h2><ul class="en">${l.map(([t, u]) => `<li><a href="${u}" target="_blank" rel="noopener">${esc(t)}</a> <small class="muted">${u.replace(/^https?:\/\//, '')}</small></li>`).join('')}</ul></div>`).join('')}`;
}

// ---------- التوجيه ----------

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
