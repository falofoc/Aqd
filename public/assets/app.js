/* عَقد — واجهة المستخدم (بدون أي مكتبات خارجية) */
(() => {
  'use strict';

  const $app = document.getElementById('app');
  const POLL_MS = 8000;
  const DEFAULT_PARTIES = 4;
  const MAX_PARTIES = 10;
  const MIN_PARTIES = 2;

  // ---------- أدوات DOM ----------

  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'style') el.style.cssText = v;
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'value') el.value = v;
        else if (k === 'checked') el.checked = !!v;
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    append(el, children);
    return el;
  }
  function append(el, children) {
    for (const c of children.flat(Infinity)) {
      if (c === null || c === undefined || c === false) continue;
      el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return el;
  }
  const mount = (...nodes) => { $app.replaceChildren(...nodes.flat()); };

  function toast(msg, kind) {
    const t = h('div', { class: kind || '' }, msg);
    document.getElementById('toast').appendChild(t);
    setTimeout(() => t.remove(), 3200);
  }

  async function copy(text, label) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = h('textarea', { style: 'position:fixed;opacity:0' }, text);
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    toast(label || 'تم النسخ');
  }

  // ---------- الاتصال بالخادم ----------

  async function api(method, url, body) {
    let res;
    try {
      res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
        cache: 'no-store',
      });
    } catch {
      throw Object.assign(new Error('تعذّر الاتصال بالخادم. تحقق من الإنترنت وحاول مرة أخرى.'), { code: 'NETWORK' });
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.message || 'حدث خطأ'), { code: data.error, status: res.status });
    return data;
  }

  // ---------- تنسيق ----------

  const dtf = new Intl.DateTimeFormat('ar', { dateStyle: 'medium', timeStyle: 'short', numberingSystem: 'latn', calendar: 'gregory' });
  const fmt = (iso) => (iso ? dtf.format(new Date(iso)) : '—');
  const shortHash = (hash) => (hash ? `${hash.slice(0, 10)}…${hash.slice(-6)}` : '—');
  const initials = (name) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join(' ');

  const STATUS_UI = {
    in_progress: { label: 'بانتظار التوقيعات', cls: 'info' },
    changes_requested: { label: 'مطلوب تعديل', cls: 'warn' },
    completed: { label: 'مكتمل وموقّع', cls: 'ok' },
    void: { label: 'ملغى', cls: 'bad' },
  };
  const statusChip = (s) => h('span', { class: `chip ${STATUS_UI[s].cls}` }, STATUS_UI[s].label);

  // ---------- عرض نص العقد ----------
  // صيغة مبسطة: "# " عنوان بند، "- " عنصر قائمة، سطر فارغ يفصل الفقرات.
  // **نص** يُعرض بخط عريض.
  function inline(line) {
    return line.split(/(\*\*[^*]+\*\*)/).filter(Boolean)
      .map((part) => (/^\*\*[^*]+\*\*$/.test(part) ? h('strong', null, part.slice(2, -2)) : part));
  }

  function renderBody(text) {
    const out = [];
    let list = null;
    for (const raw of text.split('\n')) {
      const line = raw.trim();
      if (line.startsWith('- ') || line.startsWith('• ')) {
        if (!list) { list = h('ul'); out.push(list); }
        list.appendChild(h('li', null, inline(line.slice(2))));
        continue;
      }
      list = null;
      if (!line) continue;
      let m;
      if (line.startsWith('#')) out.push(h('h3', null, inline(line.replace(/^#+\s*/, ''))));
      else if (/^بسم الله الرحمن الرحيم$/.test(line)) out.push(h('p', { class: 'basmala' }, line));
      else if ((m = line.match(/^([0-9\u0660-\u0669]+)\s*[.)\-]\s*(.*)$/))) out.push(h('p', { class: 'num-item' }, h('span', { class: 'n' }, `${m[1]}.`), h('span', null, inline(m[2]))));
      else out.push(h('p', null, inline(line)));
    }
    return out;
  }

  // ---------- تاريخ الإتمام داخل النص ----------
  // تُملأ خانات التاريخ الفارغة في نص العقد (مثل "  /  /1447هـ" و "  /  /2026م")
  // بتاريخ آخر توقيع، بالتقويم الهجري (أم القرى) والميلادي، وبنفس خط النص.
  const DATE_TZ = 'Asia/Riyadh';
  const DATE_SLOT = /[ \t]*\/[ \t]*\/[ \t]*([0-9\u0660-\u0669]{4})[ \t]*(هـ|م)/g;

  function dateParts(date, calendar, arabicDigits) {
    const parts = new Intl.DateTimeFormat(`en-u-ca-${calendar}-nu-${arabicDigits ? 'arab' : 'latn'}`, {
      timeZone: DATE_TZ, day: 'numeric', month: 'numeric', year: 'numeric',
    }).formatToParts(date);
    const get = (t) => parts.find((x) => x.type === t).value;
    return `${get('day')}/${get('month')}/${get('year')}`;
  }

  function fillCompletionDate(text, completedAt) {
    if (!completedAt) return text;
    const date = new Date(completedAt);
    const weekday = new Intl.DateTimeFormat('ar', { weekday: 'long', timeZone: DATE_TZ }).format(date);
    return text.replace(DATE_SLOT, (match, year, suffix, offset, whole) => {
      const arabic = /[\u0660-\u0669]/.test(year);
      const value = dateParts(date, suffix === 'هـ' ? 'islamic-umalqura' : 'gregory', arabic);
      const day = suffix === 'هـ' && /يوم\s*:?\s*$/.test(whole.slice(0, offset)) ? `${weekday} ` : '';
      return ` ${day}${value}${suffix}`;
    });
  }

  // الورقة تعرض نص العقد فقط: لا أرقام ولا بصمات ولا تواريخ من خارج النص.
  function paper(v, contract, extra) {
    const body = contract.status === 'completed' ? fillCompletionDate(v.body, contract.completedAt) : v.body;
    return h('article', { class: 'paper' },
      h('h2', { class: 'doc-title' }, v.title),
      renderBody(body),
      extra || null);
  }

  function diffView(a, b) {
    const parts = window.AqdDiff.diffLines(a, b);
    const box = h('div', { class: 'diff' });
    // نُظهر الأسطر المتغيرة مع سطرين من السياق حولها فقط.
    const keep = parts.map((p, i) => p.type !== 'same' || parts.slice(Math.max(0, i - 2), i + 3).some((q) => q.type !== 'same'));
    let skipped = 0;
    parts.forEach((p, i) => {
      if (!keep[i]) { skipped++; return; }
      if (skipped) { box.appendChild(h('div', { class: 'gap' }, `… ${skipped} سطر بدون تغيير …`)); skipped = 0; }
      box.appendChild(h('div', { class: p.type }, p.text || ' '));
    });
    if (skipped) box.appendChild(h('div', { class: 'gap' }, `… ${skipped} سطر بدون تغيير …`));
    if (!parts.some((p) => p.type !== 'same')) box.replaceChildren(h('div', { class: 'gap' }, 'لا توجد فروقات في النص'));
    return box;
  }

  function versionDiff(from, to) {
    return [
      from.title !== to.title ? h('div', { class: 'banner info' }, h('div', null, h('b', null, 'تغيّر العنوان'), h('p', null, `«${from.title}» ← «${to.title}»`))) : null,
      diffView(from.body, to.body),
    ];
  }

  // ---------- النافذة المنبثقة ----------

  let openModal = null;
  function modal(title, content, actions) {
    closeModal();
    const back = h('div', { class: 'modal-back', onclick: (e) => { if (e.target === back) closeModal(); } },
      h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' },
        h('h2', null, title), content,
        h('div', { class: 'actions' }, actions || h('button', { class: 'btn', onclick: closeModal }, 'إغلاق'))));
    document.body.appendChild(back);
    openModal = back;
    const first = back.querySelector('input, textarea');
    if (first) setTimeout(() => first.focus(), 30);
    return back;
  }
  function closeModal() {
    if (openModal) openModal.remove();
    openModal = null;
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  // ---------- الإطار العام ----------

  function topbar(right) {
    return h('header', { class: 'topbar' },
      h('a', { class: 'brand', href: '/' }, h('img', { src: '/assets/icon.svg', alt: '' }), 'عَقد', h('small', null, 'التوقيع الإلكتروني للشركاء')),
      h('nav', { class: 'topnav' }, right || [
        h('a', { class: 'btn ghost sm', href: '/verify' }, 'التحقق من عقد'),
        h('a', { class: 'btn primary sm', href: '/new' }, 'عقد جديد'),
      ]));
  }
  const footer = () => h('footer', { class: 'site' }, 'عَقد · توقيع إلكتروني بسجل تدقيق متسلسل وبصمات SHA-256 · لا يكتمل العقد إلا بموافقة جميع الأطراف على النسخة نفسها');

  // ---------- عقودي (محفوظة محلياً في هذا المتصفح) ----------

  const MY_KEY = 'aqd.mine';
  function myContracts() {
    try { return JSON.parse(localStorage.getItem(MY_KEY)) || []; } catch { return []; }
  }
  function remember(item) {
    try {
      const list = myContracts().filter((x) => x.url !== item.url);
      list.unshift(item);
      localStorage.setItem(MY_KEY, JSON.stringify(list.slice(0, 30)));
    } catch { /* التخزين المحلي غير متاح */ }
  }

  // ---------- الصفحة الرئيسية + إنشاء عقد ----------

  const TEMPLATE_TITLE = 'عقد شراكة';
  const TEMPLATE_BODY = `# التمهيد
اتفق الأطراف الموقعون أدناه، وهم بكامل أهليتهم المعتبرة شرعاً ونظاماً، على تأسيس شراكة وفق الشروط والأحكام الآتية، ويُعدّ هذا التمهيد جزءاً لا يتجزأ من العقد.

# البند الأول: موضوع الشراكة
يتفق الشركاء على التعاون في [وصف النشاط]، تحت اسم تجاري هو [الاسم التجاري]، ومقرّه [المدينة].

# البند الثاني: رأس المال والحصص
حدد رأس مال الشراكة بمبلغ [المبلغ] ريال، يُوزَّع على الشركاء على النحو الآتي:
- الطرف الأول: 25٪
- الطرف الثاني: 25٪
- الطرف الثالث: 25٪
- الطرف الرابع: 25٪

# البند الثالث: الإدارة واتخاذ القرار
تُتخذ القرارات الجوهرية بموافقة جميع الشركاء، وتُتخذ القرارات التشغيلية بأغلبية الحصص. ويُعيَّن [اسم الشريك] مديراً تنفيذياً للشراكة.

# البند الرابع: الأرباح والخسائر
تُوزَّع الأرباح وتُتحمَّل الخسائر بنسبة حصة كل شريك في رأس المال، ويُعدّ الحساب الختامي في نهاية كل سنة مالية.

# البند الخامس: السرية وعدم المنافسة
يلتزم كل شريك بالمحافظة على سرية معلومات الشراكة، وبعدم ممارسة نشاط منافس طوال مدة الشراكة ولمدة سنة بعد انتهائها.

# البند السادس: انسحاب شريك
يحق لأي شريك الانسحاب بإشعار خطي مدته تسعون يوماً، وللشركاء الباقين أولوية شراء حصته بالقيمة العادلة.

# البند السابع: مدة العقد
مدة هذا العقد [عدد] سنوات تبدأ من تاريخ اكتمال توقيعه، وتتجدد تلقائياً ما لم يُخطر أحد الشركاء بعدم رغبته في التجديد.

# البند الثامن: تسوية النزاعات
يُسعى لحل أي نزاع ودياً، فإن تعذّر ذلك خلال ثلاثين يوماً يُحال إلى الجهة القضائية المختصة.

# البند التاسع: أحكام ختامية
- يُوقَّع هذا العقد إلكترونياً، ويُعدّ التوقيع الإلكتروني ملزماً لأطرافه ومعادلاً للتوقيع الخطي.
- أي تعديل على نص هذا العقد يُلغي التوقيعات السابقة ويستلزم إعادة توقيع جميع الأطراف.
- لا يكتمل هذا العقد ولا يصبح نافذاً إلا بعد توقيع جميع الأطراف على النسخة نفسها.`;

  function renderHome() {
    const mine = myContracts();
    mount(
      topbar(),
      h('main', { class: 'wrap narrow' },
        h('section', { class: 'hero' },
          h('h1', null, 'وقّعوا عقدكم ', h('em', null, 'معاً'), '، من أي مكان'),
          h('p', null, 'أنشئ العقد، أرسل لكل شريك رابطه الخاص، وتابع التوقيعات لحظة بلحظة. أي تعديل يُعيد طلب التوقيع من الجميع، ولا يُعتمد العقد إلا حين يتفق الجميع على النسخة نفسها.'),
          h('div', { class: 'actions', style: 'justify-content:center;margin-top:22px' },
            h('a', { class: 'btn primary lg', href: '/new' }, 'ابدأ عقداً جديداً'),
            h('a', { class: 'btn lg', href: '/verify' }, 'تحقّق من عقد موقّع'))),
        h('section', { class: 'steps' },
          h('div', { class: 'step' }, h('b', null, 'أنشئ العقد'), h('span', null, 'اكتب النص أو استخدم نموذجاً جاهزاً وحدد الشركاء')),
          h('div', { class: 'step' }, h('b', null, 'شارك الروابط'), h('span', null, 'رابط شخصي آمن لكل شريك عبر واتساب أو البريد')),
          h('div', { class: 'step' }, h('b', null, 'راجع ووقّع'), h('span', null, 'توقيع بالرسم أو بالكتابة، وطلب تعديل عند الحاجة')),
          h('div', { class: 'step' }, h('b', null, 'نسخة نهائية'), h('span', null, 'نسخة موقعة بشهادة إتمام وسجل تدقيق قابل للتحقق'))),
        mine.length ? h('section', { class: 'card' },
          h('h2', null, 'عقودي على هذا الجهاز'),
          h('div', { class: 'mylist' }, mine.map((m) => h('a', { href: m.url }, h('span', null, m.title), h('span', { class: 'muted small' }, fmt(m.createdAt)))))) : null),
      footer());
  }

  function partyRow(i, data, onRemove) {
    return h('div', { class: 'party-row' },
      h('span', { class: 'num' }, i + 1),
      h('input', { class: 'input', name: 'name', placeholder: 'الاسم الكامل *', value: data.name || '', required: true, maxlength: 120, 'aria-label': `اسم الطرف ${i + 1}` }),
      h('input', { class: 'input', name: 'role', placeholder: 'الصفة (مثال: شريك)', value: data.role || '', maxlength: 120 }),
      h('input', { class: 'input', name: 'idNumber', dir: 'ltr', inputmode: 'numeric', placeholder: 'رقم الهوية', value: data.idNumber || '', maxlength: 30 }),
      h('input', { class: 'input', name: 'email', type: 'email', dir: 'ltr', placeholder: 'email@example.com', value: data.email || '', maxlength: 200 }),
      h('input', { class: 'input', name: 'phone', type: 'tel', dir: 'ltr', placeholder: '9665XXXXXXXX', value: data.phone || '', maxlength: 40 }),
      h('button', { type: 'button', class: 'icon-btn', title: 'حذف الطرف', 'aria-label': 'حذف الطرف', onclick: onRemove }, '✕'));
  }

  const ORDINALS = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر'];

  function renderNew() {
    let parties = Array.from({ length: DEFAULT_PARTIES }, (_, i) => ({ role: `الطرف ${ORDINALS[i]}` }));
    const rowsBox = h('div', { class: 'party-rows' });
    const addBtn = h('button', { type: 'button', class: 'btn sm', onclick: () => { collect(); parties.push({ role: `الطرف ${ORDINALS[parties.length]}` }); drawRows(); } }, '+ إضافة طرف');
    const countLabel = h('span', { class: 'muted small' });

    function collect() {
      parties = [...rowsBox.children].map((row) => Object.fromEntries([...row.querySelectorAll('input')].map((i) => [i.name, i.value])));
    }
    function drawRows() {
      rowsBox.replaceChildren(...parties.map((p, i) => partyRow(i, p, () => {
        if (parties.length <= MIN_PARTIES) return toast(`الحد الأدنى ${MIN_PARTIES} أطراف`, 'bad');
        collect(); parties.splice(i, 1); drawRows();
      })));
      addBtn.disabled = parties.length >= MAX_PARTIES;
      countLabel.textContent = `${parties.length} أطراف — لن يكتمل العقد إلا بتوقيعهم جميعاً`;
    }

    const title = h('input', { class: 'input', name: 'title', required: true, maxlength: 200, placeholder: 'مثال: عقد شراكة في مشروع …' });
    const body = h('textarea', { class: 'textarea', name: 'body', required: true, placeholder: 'اكتب نص العقد هنا أو الصقه…\n\nالتنسيق: "# " لعنوان البند، "- " للنقاط، "1. " للفقرات المرقّمة، و**نص** للخط العريض.' });
    const owner = h('input', { class: 'input', name: 'owner', maxlength: 120, placeholder: 'اسمك (يظهر في سجل العقد)' });
    const allowEdits = h('input', { type: 'checkbox', checked: true });
    const submit = h('button', { type: 'submit', class: 'btn gold lg' }, 'إنشاء العقد وتوليد روابط التوقيع');

    const form = h('form', { class: 'stack', onsubmit: async (e) => {
      e.preventDefault();
      collect();
      submit.disabled = true;
      submit.textContent = 'جارٍ الإنشاء…';
      try {
        const res = await api('POST', '/api/contracts', {
          title: title.value, body: body.value, ownerName: owner.value, allowPartyEdits: allowEdits.checked,
          parties: parties.map((p) => ({ name: p.name, role: p.role, idNumber: p.idNumber, email: p.email, phone: p.phone })),
        });
        remember({ title: title.value.trim(), url: new URL(res.adminUrl).pathname, createdAt: new Date().toISOString() });
        renderCreated(res, title.value.trim());
      } catch (err) {
        toast(err.message, 'bad');
        submit.disabled = false;
        submit.textContent = 'إنشاء العقد وتوليد روابط التوقيع';
      }
    } },
      h('section', { class: 'card' },
        h('div', { class: 'card-title' }, h('h2', null, '١. نص العقد'),
          h('button', { type: 'button', class: 'btn sm', onclick: () => {
            if (body.value.trim() && !confirm('سيتم استبدال النص الحالي بالنموذج. متابعة؟')) return;
            title.value = title.value || TEMPLATE_TITLE; body.value = TEMPLATE_BODY;
          } }, 'استخدم نموذج عقد شراكة')),
        h('label', { class: 'field' }, h('span', null, 'عنوان العقد'), title),
        h('label', { class: 'field' }, h('span', null, 'نص العقد'), body)),
      h('section', { class: 'card' },
        h('div', { class: 'card-title' }, h('h2', null, '٢. الأطراف الموقّعون'), addBtn),
        h('p', { class: 'hint', style: 'margin-top:-6px' }, 'البريد والجوال اختياريان ويُستخدمان فقط لتسهيل إرسال الرابط عبر البريد أو واتساب.'),
        rowsBox,
        h('div', { style: 'margin-top:8px' }, countLabel)),
      h('section', { class: 'card' },
        h('h2', null, '٣. الإعدادات'),
        h('label', { class: 'field' }, h('span', null, 'منشئ العقد ', h('i', null, '(اختياري)')), owner),
        h('label', { class: 'check' }, allowEdits, h('span', null, h('b', null, 'السماح للأطراف بتعديل النص مباشرة'), h('br'),
          h('span', { class: 'muted small' }, 'عند إيقافه يمكن للأطراف تقديم «طلب تعديل» فقط ويتولى منشئ العقد التعديل. في الحالتين أي تعديل يُلغي التوقيعات ويطلب إعادة التوقيع من الجميع.')))),
      h('div', { class: 'actions end' }, submit));

    drawRows();
    mount(topbar(), h('main', { class: 'wrap narrow' }, h('h1', { style: 'margin:8px 0 18px' }, 'عقد جديد'), form), footer());
  }

  // ---------- مشاركة الروابط ----------

  function shareText(title, name, url) {
    return `السلام عليكم ${name}،\nأدعوك لمراجعة وتوقيع «${title}» إلكترونياً عبر رابطك الخاص:\n${url}\n\nهذا الرابط شخصي، يرجى عدم مشاركته.`;
  }
  function shareTools(title, p) {
    const text = shareText(title, p.name, p.signUrl);
    const phone = (p.phone || '').replace(/[^\d]/g, '');
    return [
      h('button', { type: 'button', class: 'btn sm', onclick: () => copy(p.signUrl, `تم نسخ رابط ${p.name}`) }, 'نسخ الرابط'),
      h('a', { class: 'btn sm', target: '_blank', rel: 'noopener noreferrer', href: `https://wa.me/${phone}?text=${encodeURIComponent(text)}` }, 'واتساب'),
      h('a', { class: 'btn sm', href: `mailto:${encodeURIComponent(p.email || '')}?subject=${encodeURIComponent(`طلب توقيع: ${title}`)}&body=${encodeURIComponent(text)}` }, 'بريد'),
      navigator.share ? h('button', { type: 'button', class: 'btn sm', onclick: () => navigator.share({ title, text }).catch(() => {}) }, 'مشاركة') : null,
    ];
  }

  function renderCreated(res, title) {
    const adminPath = new URL(res.adminUrl).pathname;
    mount(topbar(), h('main', { class: 'wrap narrow' },
      h('section', { class: 'card center', style: 'padding:32px' },
        h('div', { class: 'success-mark' }, '✓'),
        h('h1', { style: 'margin:0 0 6px;font-size:24px' }, 'تم إنشاء العقد'),
        h('p', { class: 'muted', style: 'margin:0' }, 'أرسل لكل طرف رابطه الخاص. سيظهر لك تقدّم التوقيعات في لوحة المتابعة.')),
      h('section', { class: 'card', style: 'margin-top:16px' },
        h('h2', null, 'روابط التوقيع'),
        h('div', { class: 'parties' }, res.parties.map((p, i) => h('div', { class: 'party' },
          h('div', { class: 'avatar' }, i + 1),
          h('div', { class: 'who' }, h('b', null, p.name), h('small', null, p.role || '—'),
            h('div', { class: 'tools' }, shareTools(title, p))))))),
      h('section', { class: 'banner warn', style: 'margin-top:16px' },
        h('span', { class: 'ic' }, '🔐'),
        h('div', { style: 'flex:1;min-width:0' },
          h('b', null, 'رابط الإدارة الخاص بك'),
          h('p', { class: 'small' }, 'احتفظ بهذا الرابط ولا تشاركه — يتيح لك متابعة العقد وتعديله وإلغاءه. تم حفظه أيضاً في «عقودي» على هذا المتصفح.'),
          h('div', { class: 'link-box' }, h('input', { class: 'input', readonly: true, value: res.adminUrl, onfocus: (e) => e.target.select() }),
            h('button', { class: 'btn sm', onclick: () => copy(res.adminUrl) }, 'نسخ')))),
      h('div', { class: 'actions end', style: 'margin-top:16px' }, h('a', { class: 'btn primary lg', href: adminPath }, 'فتح لوحة المتابعة'))),
    footer());
  }

  // ---------- لوحة التوقيع ----------

  class SignaturePad {
    constructor() {
      this.strokes = [];
      this.current = null;
      this.canvas = h('canvas', { 'aria-label': 'مساحة التوقيع' });
      this.placeholder = h('div', { class: 'placeholder' }, 'وقّع هنا بإصبعك أو بالفأرة');
      this.el = h('div', { class: 'pad-wrap' },
        h('div', { class: 'baseline' }), this.placeholder, this.canvas,
        h('button', { type: 'button', class: 'btn sm clear', onclick: () => this.clear() }, 'مسح'));
      const c = this.canvas;
      const pos = (e) => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
      c.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        c.setPointerCapture(e.pointerId);
        this.current = [pos(e)];
        this.strokes.push(this.current);
        this.placeholder.classList.add('hidden');
        this.redraw();
      });
      c.addEventListener('pointermove', (e) => {
        if (!this.current) return;
        for (const ev of e.getCoalescedEvents ? e.getCoalescedEvents() : [e]) this.current.push(pos(ev));
        this.redraw();
      });
      const end = () => { this.current = null; };
      c.addEventListener('pointerup', end);
      c.addEventListener('pointercancel', end);
      this.ro = new ResizeObserver(() => this.redraw());
      this.ro.observe(c);
    }
    get dirty() { return this.strokes.some((s) => s.length > 1) || this.strokes.length > 2; }
    clear() { this.strokes = []; this.placeholder.classList.remove('hidden'); this.redraw(); }
    paint(ctx, w, hgt, lw) {
      ctx.clearRect(0, 0, w, hgt);
      ctx.strokeStyle = '#0f2a3f';
      ctx.fillStyle = '#0f2a3f';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = lw;
      for (const s of this.strokes) {
        const pts = s.map(([x, y]) => [x * w, y * hgt]);
        if (pts.length === 1) { ctx.beginPath(); ctx.arc(pts[0][0], pts[0][1], lw / 2, 0, Math.PI * 2); ctx.fill(); continue; }
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length - 1; i++) {
          const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
          ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
        }
        const last = pts[pts.length - 1];
        ctx.lineTo(last[0], last[1]);
        ctx.stroke();
      }
    }
    redraw() {
      const r = this.canvas.getBoundingClientRect();
      if (!r.width) return;
      const dpr = window.devicePixelRatio || 1;
      const w = Math.round(r.width * dpr), hh = Math.round(r.height * dpr);
      if (this.canvas.width !== w || this.canvas.height !== hh) { this.canvas.width = w; this.canvas.height = hh; }
      this.paint(this.canvas.getContext('2d'), w, hh, 2.6 * dpr);
    }
    toPNG() {
      // نعيد الرسم على مقاس ثابت لتوحيد حجم الصورة المحفوظة.
      const r = this.canvas.getBoundingClientRect();
      const w = 900, hh = Math.round(900 * (r.height / r.width || 0.25));
      const c = document.createElement('canvas');
      c.width = w; c.height = hh;
      this.paint(c.getContext('2d'), w, hh, 5);
      return c.toDataURL('image/png');
    }
  }

  async function typedSignaturePNG(name) {
    try { await document.fonts.load('80px "Aref Ruqaa"', name); } catch { /* نستخدم الخط الاحتياطي */ }
    const c = document.createElement('canvas');
    c.width = 900; c.height = 240;
    const ctx = c.getContext('2d');
    let size = 110;
    ctx.direction = 'rtl';
    do { ctx.font = `${size}px "Aref Ruqaa", "Amiri", serif`; size -= 6; } while (ctx.measureText(name).width > 840 && size > 30);
    ctx.fillStyle = '#0f2a3f';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, 450, 125);
    return c.toDataURL('image/png');
  }

  // ---------- صفحة العقد (للطرف وللمنشئ) ----------

  const page = { token: null, data: null, pad: null, busy: false, timer: null };
  const fingerprint = (d) => `${d.status}|${d.current.hash}|${d.audit.length}`;

  async function loadContract(token) {
    page.token = token;
    try {
      page.data = await api('GET', `/api/session/${token}`);
    } catch (err) {
      return renderError(err.message);
    }
    renderContract();
    clearInterval(page.timer);
    page.timer = setInterval(poll, POLL_MS);
  }

  async function poll() {
    if (document.hidden || !page.data) return;
    try {
      const d = await api('GET', `/api/session/${page.token}`);
      if (fingerprint(d) === fingerprint(page.data)) return;
      const versionChanged = d.current.hash !== page.data.current.hash;
      if (openModal || (page.pad && page.pad.dirty)) {
        if (!document.querySelector('.refresh-bar')) {
          document.body.appendChild(h('div', { class: 'refresh-bar' },
            h('button', { class: 'btn gold', onclick: (e) => { e.target.parentNode.remove(); page.data = d; closeModal(); renderContract(); } },
              versionChanged ? 'تم تعديل العقد — اضغط لعرض النسخة الجديدة' : 'توجد تحديثات — اضغط للتحديث')));
        }
        return;
      }
      page.data = d;
      renderContract(true);
      toast(versionChanged ? 'تم تعديل العقد — يرجى المراجعة' : 'تم تحديث حالة التوقيعات');
    } catch { /* نحاول في الدورة التالية */ }
  }

  function renderError(msg) {
    mount(topbar(), h('main', { class: 'wrap narrow' },
      h('section', { class: 'card center', style: 'padding:40px' },
        h('div', { class: 'success-mark', style: 'background:var(--bad-soft);color:var(--bad)' }, '!'),
        h('h1', { style: 'font-size:22px' }, 'تعذّر فتح العقد'),
        h('p', { class: 'muted' }, msg),
        h('a', { class: 'btn', href: '/' }, 'العودة للرئيسية'))), footer());
  }

  function partyCard(d, p, isOwner) {
    const cls = p.state === 'signed' ? 'ok' : p.state === 'objected' ? 'warn' : '';
    const label = p.state === 'signed' ? `وقّع · ${fmt(p.signedAt)}`
      : p.state === 'objected' ? 'طلب تعديلاً'
      : p.lastSignedVersion ? `بانتظار إعادة التوقيع (وقّع الإصدار ${p.lastSignedVersion})`
      : p.viewedCurrent ? 'اطّلع — لم يوقّع بعد' : 'لم يطّلع بعد';
    return h('div', { class: `party${p.isMe ? ' me' : ''}` },
      h('div', { class: `avatar ${cls}` }, initials(p.name), cls ? h('span', { class: 'badge' }, cls === 'ok' ? '✓' : '!') : null),
      h('div', { class: 'who' },
        h('b', null, p.name, p.isMe ? ' (أنت)' : ''),
        h('small', null, [p.role, p.idNumber && `هوية ${p.idNumber}`, label].filter(Boolean).join(' · ')),
        p.objection ? h('div', { class: 'party-obj' }, `«${p.objection.reason}»`) : null,
        isOwner && p.signUrl && d.status !== 'completed' && d.status !== 'void'
          ? h('div', { class: 'tools' }, shareTools(d.current.title, p)) : null));
  }

  const AUDIT_UI = {
    created: { t: 'أُنشئ العقد', c: 'info' },
    viewed: { t: 'اطّلع على العقد', c: '' },
    signed: { t: 'وقّع على العقد', c: 'ok' },
    changes_requested: { t: 'طلب تعديلاً', c: 'warn' },
    amended: { t: 'عدّل نص العقد', c: 'warn' },
    completed: { t: 'اكتمل العقد بتوقيع جميع الأطراف', c: 'ok' },
    voided: { t: 'ألغى العقد', c: 'bad' },
  };

  function auditLine(e) {
    const ui = AUDIT_UI[e.action] || { t: e.action, c: '' };
    const d = e.details || {};
    let note = null;
    if (e.action === 'signed' || e.action === 'viewed') note = `الإصدار ${d.version}`;
    if (e.action === 'amended') {
      note = `الإصدار ${d.fromVersion} ← ${d.version}: ${d.note}`;
      if (d.invalidatedSignatures && d.invalidatedSignatures.length) note += `\nأُلغيت توقيعات: ${d.invalidatedSignatures.join('، ')}`;
    }
    if (e.action === 'changes_requested' || e.action === 'voided') note = d.reason;
    const who = e.actor && e.actor.type !== 'system' ? `${e.actor.name} — ` : '';
    return h('li', { class: ui.c }, h('time', null, fmt(e.at)), h('div', null, who + ui.t), note ? h('div', { class: 'note' }, note) : null);
  }

  function renderContract(keepScroll) {
    const y = window.scrollY;
    const d = page.data;
    const v = d.current;
    const isOwner = d.role === 'owner';
    const me = d.parties.find((p) => p.isMe);
    const editable = d.status !== 'completed' && d.status !== 'void';
    const signedCount = d.parties.filter((p) => p.state === 'signed').length;
    const canEdit = editable && (isOwner || d.allowPartyEdits);
    page.pad = null;

    // --- اللافتة الرئيسية ---
    let banner = null;
    if (d.status === 'completed') {
      banner = h('div', { class: 'banner ok' }, h('span', { class: 'ic' }, '✅'), h('div', null,
        h('b', null, 'اكتمل العقد — وقّع جميع الأطراف'),
        h('p', null, `وقّع الأطراف الـ${d.parties.length} على الإصدار ${v.n} واكتمل في ${fmt(d.completedAt)}. العقد الآن مُقفل وجاهز للحفظ.`),
        h('div', { class: 'actions' },
          h('a', { class: 'btn ok', href: `/certificate/${page.token}` }, 'عرض النسخة الموقّعة وتنزيلها PDF'),
          h('a', { class: 'btn', href: `/api/session/${page.token}/export` }, 'تنزيل ملف الإثبات (JSON)'))));
    } else if (d.status === 'void') {
      banner = h('div', { class: 'banner bad' }, h('span', { class: 'ic' }, '⛔'), h('div', null, h('b', null, 'تم إلغاء العقد'), h('p', null, d.voidReason)));
    } else if (me && me.state === 'signed') {
      banner = h('div', { class: 'banner ok' }, h('span', { class: 'ic' }, '✍️'), h('div', null,
        h('b', null, 'تم تسجيل توقيعك على هذه النسخة'),
        h('p', null, `بانتظار ${d.parties.length - signedCount} من الأطراف. ستصلك النسخة النهائية عبر هذا الرابط عند اكتمال التوقيعات، وإذا عُدّل النص سيُطلب منك التوقيع مجدداً.`)));
    } else if (me && me.lastSignedVersion && me.lastSignedVersion < v.n) {
      const from = d.versions.find((x) => x.n === me.lastSignedVersion);
      banner = h('div', { class: 'banner warn' }, h('span', { class: 'ic' }, '🔄'), h('div', null,
        h('b', null, 'عُدّل العقد بعد توقيعك — مطلوب إعادة التوقيع'),
        h('p', null, `وقّعت سابقاً على الإصدار ${from.n}، والنسخة الحالية هي الإصدار ${v.n}. توقيعك السابق لم يعد سارياً.`),
        h('div', { class: 'actions' }, h('button', { class: 'btn', onclick: () => modal(`التغييرات منذ توقيعك (الإصدار ${from.n} ← ${v.n})`, versionDiff(from, v)) }, 'عرض التغييرات'))));
    } else if (d.status === 'changes_requested') {
      const objs = d.parties.filter((p) => p.objection);
      banner = h('div', { class: 'banner warn' }, h('span', { class: 'ic' }, '📝'), h('div', null,
        h('b', null, 'يوجد طلب تعديل على النسخة الحالية'),
        h('p', null, objs.map((p) => `${p.name}: «${p.objection.reason}»`).join(' — ')),
        canEdit ? h('div', { class: 'actions' }, h('button', { class: 'btn', onclick: openEditor }, 'تعديل النص')) : null));
    }

    // --- قسم التوقيع ---
    let signCard = null;
    if (me && editable && me.state !== 'signed') signCard = buildSignCard(d);

    const sigBlock = d.status === 'completed' ? h('section', { class: 'sign-section' },
      h('h3', null, 'توقيع الشركاء'), h('div', { class: 'sig-grid' }, d.parties.map((p) => sigBox(d, p)))) : null;

    const versionsCard = h('section', { class: 'card' },
      h('h3', null, `سجل الإصدارات (${d.versions.length})`),
      h('div', { class: 'versions' }, [...d.versions].reverse().map((x, idx, arr) => h('div', { class: `version${x.n === v.n ? ' current' : ''}` },
        h('header', null, h('b', null, `الإصدار ${x.n}${x.n === v.n ? ' · الحالي' : ''}`),
          arr[idx + 1] ? h('button', { class: 'btn ghost sm', onclick: () => modal(`الفروقات: الإصدار ${arr[idx + 1].n} ← ${x.n}`, versionDiff(arr[idx + 1], x)) }, 'الفروقات') : null),
        h('div', { class: 'muted' }, `${x.createdBy.name} · ${fmt(x.createdAt)}`),
        h('div', null, x.note)))));

    const auditCard = h('section', { class: 'card' },
      h('div', { class: 'card-title' }, h('h3', null, 'سجل النشاط'),
        d.auditChainValid ? h('span', { class: 'chip ok', title: 'سلسلة البصمات سليمة' }, 'سليم') : h('span', { class: 'chip bad' }, 'تحذير: السجل غير متطابق')),
      h('ol', { class: 'timeline' }, [...d.audit].reverse().slice(0, 8).map(auditLine)),
      d.audit.length > 8 ? h('details', { class: 'more' }, h('summary', null, `عرض الكل (${d.audit.length})`),
        h('ol', { class: 'timeline' }, [...d.audit].reverse().slice(8).map(auditLine))) : null);

    const ownerTools = isOwner && editable ? h('section', { class: 'card' },
      h('h3', null, 'أدوات المنشئ'),
      h('div', { class: 'actions' },
        h('button', { class: 'btn', onclick: openEditor }, 'تعديل النص'),
        h('button', { class: 'btn danger', onclick: openVoid }, 'إلغاء العقد')),
      h('p', { class: 'hint' }, 'رابط الإدارة هذا خاص بك. أرسل للأطراف روابطهم من قائمة الأطراف.')) : null;

    const partyTools = me && editable ? h('div', { class: 'actions', style: 'margin-top:12px' },
      h('button', { class: 'btn', onclick: openRequestChanges }, 'طلب تعديل'),
      d.allowPartyEdits ? h('button', { class: 'btn ghost', onclick: openEditor }, 'تعديل النص مباشرة') : null) : null;

    mount(
      topbar([statusChip(d.status)]),
      h('main', { class: 'wrap' },
        h('div', { class: 'doc-head' },
          h('div', null,
            h('h1', null, v.title),
            h('div', { class: 'meta' },
              h('span', null, `الإصدار ${v.n}`),
              h('span', null, 'البصمة ', h('span', { class: 'mono', title: v.hash }, shortHash(v.hash))),
              h('span', null, `أُنشئ ${fmt(d.createdAt)}`),
              h('span', null, isOwner ? 'أنت منشئ العقد' : `أنت: ${me.name}`))),
          h('div', { style: 'min-width:240px;flex:0 1 320px' },
            h('div', { class: 'progress-label' }, h('span', null, 'التوقيعات'), h('b', null, `${signedCount} من ${d.parties.length}`)),
            h('div', { class: 'progress' }, d.parties.map((p) => h('span', { class: p.state === 'signed' ? 'ok' : p.state === 'objected' ? 'warn' : '', title: p.name }))))),
        banner,
        h('div', { class: 'grid' },
          h('div', { class: 'stack' },
            paper(v, d, sigBlock),
            partyTools,
            signCard),
          h('aside', { class: 'stack' },
            h('section', { class: 'card' }, h('h3', null, 'الأطراف'), h('div', { class: 'parties' }, d.parties.map((p) => partyCard(d, p, isOwner)))),
            ownerTools,
            versionsCard,
            auditCard))),
      footer());

    if (keepScroll) window.scrollTo(0, y);
  }

  function sigBox(d, p) {
    const s = d.signatures.find((x) => x.partyId === p.id);
    return h('div', { class: 'sig-box' },
      p.role ? h('div', { class: 'role' }, `${p.role}:`) : null,
      s ? h('img', { src: s.image, alt: `توقيع ${p.name}` }) : h('div', { class: 'empty' }, 'بانتظار التوقيع'),
      h('b', null, p.name));
  }

  function buildSignCard(d) {
    const v = d.current;
    const me = d.parties.find((p) => p.isMe);
    let mode = 'draw';
    const pad = new SignaturePad();
    page.pad = pad;
    const nameInput = h('input', { class: 'input', value: me.name, maxlength: 120, oninput: () => { preview.textContent = nameInput.value || ' '; } });
    const preview = h('div', { class: 'typed-preview' }, me.name);
    const typeBox = h('div', { class: 'hidden' }, h('label', { class: 'field' }, h('span', null, 'اكتب اسمك كما تريد أن يظهر'), nameInput), preview);
    const tabBtns = {};
    const setMode = (m) => {
      mode = m;
      pad.el.classList.toggle('hidden', m !== 'draw');
      typeBox.classList.toggle('hidden', m !== 'type');
      for (const [k, b] of Object.entries(tabBtns)) b.classList.toggle('on', k === m);
      if (m === 'draw') pad.redraw();
    };
    tabBtns.draw = h('button', { type: 'button', class: 'on', onclick: () => setMode('draw') }, 'ارسم توقيعك');
    tabBtns.type = h('button', { type: 'button', onclick: () => setMode('type') }, 'اكتب اسمك');

    const consent = h('input', { type: 'checkbox' });
    const btn = h('button', { class: 'btn gold lg block', onclick: async () => {
      if (!consent.checked) return toast('يرجى الإقرار بالموافقة أولاً', 'bad');
      if (mode === 'draw' && !pad.dirty) return toast('يرجى رسم توقيعك أولاً', 'bad');
      if (mode === 'type' && !nameInput.value.trim()) return toast('يرجى كتابة اسمك', 'bad');
      btn.disabled = true;
      btn.textContent = 'جارٍ تسجيل التوقيع…';
      try {
        const image = mode === 'draw' ? pad.toPNG() : await typedSignaturePNG(nameInput.value.trim());
        page.data = await api('POST', `/api/session/${page.token}/sign`, {
          versionHash: v.hash, consent: true, method: mode, image, typedName: mode === 'type' ? nameInput.value : undefined,
        });
        renderContract();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        toast(page.data.status === 'completed' ? 'اكتمل العقد بتوقيع الجميع 🎉' : 'تم تسجيل توقيعك بنجاح');
      } catch (err) {
        toast(err.message, 'bad');
        if (err.code === 'VERSION_CHANGED' || err.code === 'COMPLETED' || err.code === 'VOID' || err.code === 'ALREADY_SIGNED') {
          page.pad = null;
          return loadContract(page.token);
        }
        btn.disabled = false;
        btn.textContent = 'اعتماد التوقيع';
      }
    } }, 'اعتماد التوقيع');

    return h('section', { class: 'card sign-card', id: 'sign' },
      h('h2', null, `توقيعك يا ${me.name}`),
      h('p', { class: 'muted small', style: 'margin-top:-6px' }, `أنت توقّع على الإصدار ${v.n} تحديداً. أي تعديل لاحق على النص سيُلغي هذا التوقيع ويطلب إعادة التوقيع.`),
      h('div', { class: 'tabs', role: 'tablist' }, tabBtns.draw, tabBtns.type),
      pad.el, typeBox,
      h('label', { class: 'check consent' }, consent, h('span', null,
        `أقرّ بأنني ${me.name} قد اطّلعت على كامل نص «${v.title}» (الإصدار ${v.n}، البصمة `,
        h('span', { class: 'mono' }, v.hash.slice(0, 12)),
        ') وأوافق على جميع بنوده، وأن توقيعي الإلكتروني هذا مُلزم لي ويعادل توقيعي الخطي.')),
      btn);
  }

  // ---------- النوافذ: تعديل / طلب تعديل / إلغاء ----------

  function openEditor() {
    const d = page.data;
    const v = d.current;
    const signed = d.parties.filter((p) => p.state === 'signed');
    const title = h('input', { class: 'input', value: v.title, maxlength: 200 });
    const body = h('textarea', { class: 'textarea', style: 'min-height:42vh' }, v.body);
    const note = h('input', { class: 'input', maxlength: 500, placeholder: 'مثال: تعديل نسب الحصص في البند الثاني' });
    const save = h('button', { class: 'btn gold', onclick: async () => {
      if (!note.value.trim()) return toast('يرجى كتابة وصف مختصر للتعديل', 'bad');
      save.disabled = true;
      try {
        page.data = await api('POST', `/api/session/${page.token}/amend`, { baseHash: v.hash, title: title.value, body: body.value, note: note.value });
        closeModal();
        renderContract();
        toast(`تم حفظ الإصدار ${page.data.current.n} وطُلب من جميع الأطراف إعادة التوقيع`);
      } catch (err) {
        toast(err.message, 'bad');
        save.disabled = false;
        if (err.code === 'VERSION_CHANGED') { closeModal(); loadContract(page.token); }
      }
    } }, 'حفظ التعديل وطلب إعادة التوقيع');
    modal('تعديل نص العقد', [
      h('div', { class: 'banner warn' }, h('span', { class: 'ic' }, '⚠️'), h('div', null,
        h('b', null, 'أي تعديل يُنشئ إصداراً جديداً ويُلغي جميع التوقيعات الحالية'),
        h('p', { class: 'small' }, signed.length
          ? `سيُلغى توقيع: ${signed.map((p) => p.name).join('، ')}. وسيُطلب من جميع الأطراف (${d.parties.length}) التوقيع على النسخة الجديدة.`
          : `سيُطلب من جميع الأطراف (${d.parties.length}) مراجعة النسخة الجديدة وتوقيعها.`))),
      h('label', { class: 'field' }, h('span', null, 'العنوان'), title),
      h('label', { class: 'field' }, h('span', null, 'النص'), body),
      h('label', { class: 'field' }, h('span', null, 'وصف التعديل (يظهر لجميع الأطراف)'), note),
    ], [h('button', { class: 'btn', onclick: closeModal }, 'تراجع'), save]);
  }

  function openRequestChanges() {
    const reason = h('textarea', { class: 'textarea', style: 'min-height:140px;font-family:var(--font);font-size:15px', maxlength: 1000, placeholder: 'ما الذي تقترح تعديله؟ مثال: أقترح أن تكون مدة الإشعار في البند السادس ستين يوماً.' });
    const me = page.data.parties.find((p) => p.isMe);
    const send = h('button', { class: 'btn gold', onclick: async () => {
      if (!reason.value.trim()) return toast('يرجى كتابة طلب التعديل', 'bad');
      send.disabled = true;
      try {
        page.data = await api('POST', `/api/session/${page.token}/request-changes`, { reason: reason.value });
        closeModal();
        renderContract();
        toast('تم إرسال طلب التعديل لبقية الأطراف');
      } catch (err) { toast(err.message, 'bad'); send.disabled = false; }
    } }, 'إرسال الطلب');
    modal('طلب تعديل على العقد', [
      h('p', { class: 'muted', style: 'margin-top:0' }, 'سيظهر طلبك لجميع الأطراف ولمنشئ العقد. لن يكتمل العقد حتى يُعدَّل النص ويوقّع الجميع على النسخة الجديدة.'),
      me.state === 'signed' ? h('div', { class: 'banner warn' }, h('span', { class: 'ic' }, '↩️'), h('p', null, 'سيتم سحب توقيعك الحالي على هذه النسخة.')) : null,
      reason,
    ], [h('button', { class: 'btn', onclick: closeModal }, 'تراجع'), send]);
  }

  function openVoid() {
    const reason = h('input', { class: 'input', maxlength: 1000, placeholder: 'سبب الإلغاء' });
    const go = h('button', { class: 'btn danger', onclick: async () => {
      if (!reason.value.trim()) return toast('يرجى كتابة سبب الإلغاء', 'bad');
      go.disabled = true;
      try {
        page.data = await api('POST', `/api/session/${page.token}/void`, { reason: reason.value });
        closeModal(); renderContract(); toast('تم إلغاء العقد');
      } catch (err) { toast(err.message, 'bad'); go.disabled = false; }
    } }, 'تأكيد الإلغاء');
    modal('إلغاء العقد', [h('p', { class: 'muted', style: 'margin-top:0' }, 'لا يمكن التراجع عن الإلغاء. سيبقى العقد وسجله متاحَين للاطلاع فقط.'), reason],
      [h('button', { class: 'btn', onclick: closeModal }, 'تراجع'), go]);
  }

  // ---------- النسخة الموقعة (الشهادة) ----------

  async function renderCertificate(token) {
    let d;
    try { d = await api('GET', `/api/session/${token}`); } catch (err) { return renderError(err.message); }
    const v = d.current;
    const done = d.status === 'completed';
    const back = d.role === 'owner' ? `/admin/${token}` : `/sign/${token}`;

    const rows = d.parties.map((p) => {
      const s = d.signatures.find((x) => x.partyId === p.id);
      return h('tr', null,
        h('td', null, p.name), h('td', null, p.role || '—'), h('td', { class: 'mono' }, p.idNumber || '—'),
        h('td', null, s ? fmt(s.signedAt) : '—'),
        h('td', null, s ? (s.method === 'draw' ? 'رسم يدوي' : 'اسم مكتوب') : '—'),
        h('td', { class: 'mono' }, s && s.ip ? s.ip : '—'));
    });

    const audit = new URLSearchParams(location.search).get('view') === 'audit';
    const here = `/certificate/${token}`;

    // النسخة الموقعة: نص العقد والتوقيعات فقط، بلا أي إضافات.
    const contractDoc = h('article', { class: 'cert' },
      done ? null : h('div', { class: 'watermark' }, h('span', null, 'مسودة غير مكتملة')),
      paper(v, d, h('section', { class: 'sign-section' },
        h('h3', null, 'توقيع الشركاء'),
        h('div', { class: 'sig-grid' }, d.parties.map((p) => sigBox(d, p))))));

    // شهادة الإتمام وسجل التدقيق: وثيقة إثبات مستقلة عن نص العقد.
    const auditDoc = h('article', { class: 'cert' },
      h('h1', null, 'شهادة إتمام التوقيع'),
      h('div', { class: `seal${done ? '' : ' draft'}` }, done ? `✔ ${v.title}` : '⏳ لم يكتمل توقيع جميع الأطراف'),
      h('dl', { class: 'kv' },
        h('dt', null, 'معرّف العقد'), h('dd', { class: 'mono' }, d.id),
        h('dt', null, 'الإصدار المعتمد'), h('dd', null, `${v.n} (${fmt(v.createdAt)})`),
        h('dt', null, 'بصمة النص SHA-256'), h('dd', { class: 'mono' }, v.hash),
        done ? [h('dt', null, 'تاريخ الاكتمال'), h('dd', null, fmt(d.completedAt)),
          h('dt', null, 'البصمة النهائية'), h('dd', { class: 'mono' }, d.finalHash)] : null),
      h('h2', null, 'التوقيعات'),
      h('table', null,
        h('thead', null, h('tr', null, ['الطرف', 'الصفة', 'رقم الهوية', 'وقت التوقيع', 'طريقة التوقيع', 'عنوان IP'].map((t) => h('th', null, t)))),
        h('tbody', null, rows)),
      h('h2', null, 'سجل التدقيق'),
      h('p', { class: 'small', style: 'margin-top:0' }, d.auditChainValid
        ? '✔ سلسلة البصمات سليمة: كل حدث مرتبط ببصمة الحدث الذي قبله، وأي تلاعب بالسجل يكسر السلسلة.'
        : '✖ تحذير: سلسلة البصمات غير متطابقة.'),
      h('table', null,
        h('thead', null, h('tr', null, ['#', 'الوقت', 'الحدث', 'بواسطة', 'تفاصيل', 'IP'].map((t) => h('th', null, t)))),
        h('tbody', null, d.audit.map((e) => {
          const dt = e.details || {};
          const det = e.action === 'amended' ? `${dt.fromVersion}←${dt.version}: ${dt.note}`
            : e.action === 'changes_requested' || e.action === 'voided' ? dt.reason
            : dt.version ? `الإصدار ${dt.version}` : '';
          return h('tr', null, h('td', null, e.seq), h('td', null, fmt(e.at)), h('td', null, (AUDIT_UI[e.action] || { t: e.action }).t),
            h('td', null, e.actor ? e.actor.name : ''), h('td', null, det), h('td', { class: 'mono' }, e.ip || '—'));
        }))),
      h('p', { class: 'small', style: 'margin-top:18px' }, 'للتحقق من صحة العقد: ', h('span', { class: 'mono' }, d.verifyUrl)));

    mount(
      topbar([h('a', { class: 'btn sm', href: back }, 'رجوع للعقد')]),
      h('main', { class: 'wrap' },
        h('div', { class: 'toolbar' },
          h('div', { class: 'tabs', style: 'margin:0' },
            h('a', { class: `btn sm ${audit ? 'ghost' : 'primary'}`, href: here }, 'العقد الموقّع'),
            h('a', { class: `btn sm ${audit ? 'primary' : 'ghost'}`, href: `${here}?view=audit` }, 'شهادة الإتمام والتدقيق')),
          h('button', { class: 'btn gold', onclick: () => window.print() }, 'طباعة / حفظ PDF'),
          h('a', { class: 'btn', href: `/api/session/${token}/export` }, 'ملف الإثبات (JSON)')),
        audit ? auditDoc : contractDoc),
      footer());
  }

  // ---------- صفحة التحقق ----------

  function renderVerify(id) {
    const idInput = h('input', { class: 'input', dir: 'ltr', placeholder: 'معرّف العقد', value: id || '' });
    const hashInput = h('input', { class: 'input', dir: 'ltr', placeholder: 'البصمة (اختياري) للمطابقة' });
    const out = h('div');
    const run = async (e) => {
      if (e) e.preventDefault();
      const cid = idInput.value.trim();
      if (!cid) return;
      out.replaceChildren(h('p', { class: 'muted' }, 'جارٍ التحقق…'));
      try {
        const s = await api('GET', `/api/verify/${encodeURIComponent(cid)}`);
        const hv = hashInput.value.trim().toLowerCase();
        const match = hv ? (hv === s.finalHash || hv === s.versionHash) : null;
        out.replaceChildren(h('section', { class: 'card', style: 'margin-top:16px' },
          h('div', { class: 'card-title' }, h('h2', null, s.title), statusChip(s.status)),
          match === null ? null : h('div', { class: `banner ${match ? 'ok' : 'bad'}` }, h('span', { class: 'ic' }, match ? '✔' : '✖'),
            h('div', null, h('b', null, match ? 'البصمة مطابقة' : 'البصمة غير مطابقة'), h('p', null, match ? 'الوثيقة التي لديك تطابق السجل الأصلي.' : 'الوثيقة التي لديك لا تطابق النسخة المسجّلة.'))),
          h('dl', { class: 'kv' },
            h('dt', null, 'الإصدار'), h('dd', null, s.version),
            h('dt', null, 'بصمة النص'), h('dd', { class: 'mono' }, s.versionHash),
            h('dt', null, 'البصمة النهائية'), h('dd', { class: 'mono' }, s.finalHash || '— (لم يكتمل)'),
            h('dt', null, 'تاريخ الاكتمال'), h('dd', null, fmt(s.completedAt)),
            h('dt', null, 'سلامة السجل'), h('dd', null, s.auditChainValid ? '✔ سليم' : '✖ غير متطابق')),
          h('h3', { style: 'margin-top:18px' }, 'الأطراف'),
          h('div', { class: 'parties' }, s.parties.map((p) => h('div', { class: 'party' },
            h('div', { class: `avatar ${p.signedAt ? 'ok' : ''}` }, initials(p.name)),
            h('div', { class: 'who' }, h('b', null, p.name), h('small', null, [p.role, p.signedAt ? `وقّع ${fmt(p.signedAt)}` : 'لم يوقّع على النسخة الحالية'].filter(Boolean).join(' · '))))))));
        history.replaceState(null, '', `/verify/${encodeURIComponent(cid)}`);
      } catch (err) {
        out.replaceChildren(h('div', { class: 'banner bad', style: 'margin-top:16px' }, h('span', { class: 'ic' }, '✖'), h('p', null, err.message)));
      }
    };
    mount(topbar(), h('main', { class: 'wrap narrow' },
      h('h1', { style: 'margin:8px 0 6px' }, 'التحقق من عقد'),
      h('p', { class: 'muted', style: 'margin-top:0' }, 'أدخل معرّف العقد الظاهر في النسخة الموقعة، ويمكنك إدخال البصمة للتأكد من أن الوثيقة لم تُعدَّل.'),
      h('form', { class: 'card', onsubmit: run },
        h('label', { class: 'field' }, h('span', null, 'معرّف العقد'), idInput),
        h('label', { class: 'field' }, h('span', null, 'البصمة ', h('i', null, '(اختياري)')), hashInput),
        h('button', { class: 'btn primary', type: 'submit' }, 'تحقّق')),
      out), footer());
    if (id) run();
  }

  // ---------- التوجيه ----------

  function route() {
    clearInterval(page.timer);
    closeModal();
    const p = location.pathname;
    let m;
    if (p === '/' || p === '') return renderHome();
    if (p === '/new') return renderNew();
    if ((m = p.match(/^\/(?:admin|sign)\/([\w-]+)$/))) return loadContract(m[1]);
    if ((m = p.match(/^\/certificate\/([\w-]+)$/))) return renderCertificate(m[1]);
    if ((m = p.match(/^\/verify(?:\/([\w-]+))?$/))) return renderVerify(m[1]);
    renderError('الصفحة غير موجودة');
  }

  route();
})();
