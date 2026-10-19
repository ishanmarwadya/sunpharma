/* Sun Nirantar web app: hash-routed views for patients, nursing homes, chemists, care hub and doctors */
(function () {
  const { DAY, today, NURSING_HOMES, CHEMISTS, MEDS, COHORTS, T, Store } = window.NIR;
  const db = Store.load();
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (n, cls = '') => `<img class="ico ${cls}" src="assets/img/icons/${n}.png" alt="" aria-hidden="true">`;
  const photo = (n, alt, cls = '') => `<img class="photo ${cls}" src="assets/img/${n}.jpg" alt="${alt}" loading="lazy">`;
  const nh = (id) => NURSING_HOMES.find((x) => x.id === id) || NURSING_HOMES[0];
  const chem = (id) => CHEMISTS.find((x) => x.id === id) || CHEMISTS[0];
  const pat = (id) => db.patients.find((p) => p.id.toUpperCase() === String(id || '').toUpperCase().trim());
  const fmt = (iso, o) => new Date(iso).toLocaleDateString('en-IN', o || { weekday: 'short', day: 'numeric', month: 'short' });
  const fmtT = (iso) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  const daysTo = (iso) => Math.round((new Date(iso).setHours(10, 0, 0, 0) - today().getTime()) / DAY);
  const save = () => Store.save();
  const toast = (msg, kind = 'ok') => {
    const t = document.createElement('div'); t.className = 'toast ' + kind; t.innerHTML = msg; document.body.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10); setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3600);
  };

  /* ---------- care logic ---------- */
  const evs = (pid) => db.events.filter((e) => e.pid === pid).sort((a, b) => new Date(a.date) - new Date(b.date));
  const addEv = (pid, type, by, data) => { const e = { id: 'E' + Date.now() + Math.floor(Math.random() * 99), pid, type, date: new Date().toISOString(), by, data: data || {} }; db.events.push(e); save(); return e; };
  const lastSupply = (p) => { const s = evs(p.id).filter((e) => e.type === 'refill' || e.type === 'enrol'); return s.length ? s[s.length - 1].date : p.discharged; };
  const nextDue = (p) => new Date(new Date(lastSupply(p)).getTime() + p.refillDays * DAY).toISOString();
  const refillNo = (p) => evs(p.id).filter((e) => e.type === 'refill').length + 1;
  const flags = (p) => evs(p.id).filter((e) => e.type === 'flag');
  const openFlags = (p) => flags(p).filter((f) => f.data.state === 'open' || f.data.state === 'escalated');
  const rules = (nhid) => db.rules[nhid] || window.NIR.DEFAULT_RULES;
  const readings = (p) => evs(p.id).filter((e) => (e.type === 'refill' || e.type === 'check') && e.data.sys);
  function status(p) {
    if (p.status === 'stopped') return { k: 'stopped', label: 'Stopped by patient', cls: 'grey' };
    const of = openFlags(p);
    if (of.some((f) => f.data.level === 'urgent')) return { k: 'urgent', label: 'Urgent flag', cls: 'red' };
    if (of.length) return { k: 'flag', label: of[0].data.state === 'escalated' ? 'With NH doctor' : 'Flag open', cls: 'red' };
    const d = daysTo(nextDue(p));
    if (d <= -rules(p.nh).lateDays) return { k: 'missed', label: `Refill ${-d} days late`, cls: 'amber' };
    if (d < 0) return { k: 'late', label: `Refill ${-d} days late`, cls: 'amber' };
    if (d <= 3) return { k: 'due', label: d === 0 ? 'Refill due today' : `Refill due in ${d} days`, cls: 'blue' };
    return { k: 'ok', label: 'On track', cls: 'green' };
  }
  function onTime(list) {
    let ok = 0, all = 0;
    list.forEach((p) => {
      let prev = p.discharged;
      evs(p.id).filter((e) => e.type === 'refill').forEach((r) => { all++; if ((new Date(r.date) - new Date(prev)) / DAY <= p.refillDays + 3) ok++; prev = r.date; });
    });
    return all ? Math.round((ok / all) * 100) : 100;
  }
  function assess(p, d) {
    const r = rules(p.nh), why = [], urgent = [];
    if (d.sys && (d.sys >= r.sysUrgent || d.dia >= r.diaUrgent)) urgent.push(`BP ${d.sys}/${d.dia}`);
    else if (d.sys && (d.sys >= r.sysFlag || d.dia >= r.diaFlag)) why.push(`BP ${d.sys}/${d.dia}`);
    if (d.sugar && d.sugar <= r.sugarLow) urgent.push(`Sugar ${d.sugar} (low)`);
    else if (d.sugar && d.sugar >= r.sugarHigh) why.push(`Sugar ${d.sugar}`);
    if (d.q.chest) urgent.push('Chest pain');
    if (d.q.breath) why.push('Breathless');
    if (d.q.swell) why.push('New ankle swelling');
    if (urgent.length) return { level: 'urgent', reasons: urgent.concat(why) };
    if (why.length) return { level: 'flag', reasons: why };
    return null;
  }

  /* ---------- shared bits ---------- */
  const pill = (s) => `<span class="pill ${s.cls}">${esc(s.label)}</span>`;
  const dueText = (iso, L) => { const d = daysTo(iso); return d === 0 ? L.today : d > 0 ? L.inDays.replace('{n}', d) : L.overdue.replace('{n}', -d); };
  function bpChart(p) {
    const r = readings(p); if (r.length < 2) return '<p class="muted small">Your BP trend appears after your second check.</p>';
    const W = 520, H = 170, pad = 30, lo = 60, hi = 200;
    const x = (i) => pad + (i * (W - pad * 2)) / (r.length - 1), y = (v) => H - pad - ((v - lo) / (hi - lo)) * (H - pad * 1.6);
    const line = (k) => r.map((e, i) => `${x(i)},${y(e.data[k])}`).join(' ');
    const rr = rules(p.nh);
    return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Blood pressure readings">
      <line x1="${pad}" x2="${W - pad}" y1="${y(rr.sysFlag)}" y2="${y(rr.sysFlag)}" class="th"/><text x="${pad}" y="${y(rr.sysFlag) + 14}" class="thl">doctor's alert line ${rr.sysFlag}</text>
      <polyline points="${line('sys')}" class="sys"/><polyline points="${line('dia')}" class="dia"/>
      ${r.map((e, i) => `<circle cx="${x(i)}" cy="${y(e.data.sys)}" r="4" class="sysd"/><text x="${x(i)}" y="${y(e.data.sys) - 9}" text-anchor="middle" class="vl">${e.data.sys}/${e.data.dia}</text><text x="${x(i)}" y="${H - 8}" text-anchor="middle" class="xl">${fmt(e.date, { day: 'numeric', month: 'short' })}</text><circle cx="${x(i)}" cy="${y(e.data.dia)}" r="3.5" class="diad"/>`).join('')}
    </svg><div class="legend"><span class="k sys"></span>Upper (systolic) <span class="k dia"></span>Lower (diastolic)</div>`;
  }
  const EVL = { enrol: ['hospital', 'Plan started at discharge'], check: ['heart', 'Check at chemist'], refill: ['pill', 'Refill collected'], flag: ['alert', 'Flag raised'], call: ['headset', 'Care call'], visit: ['calendar', 'Doctor visit'], review: ['doctor', 'Reviewed by doctor'], consent: ['consent', 'Consent updated'], stop: ['lock', 'Programme stopped'] };
  function timeline(p, staff) {
    return `<ol class="tl">${evs(p.id).slice().reverse().map((e) => {
      const [ic, lab] = EVL[e.type] || ['info', e.type];
      const d = e.data || {};
      let det = [];
      if (d.sys) det.push(`BP ${d.sys}/${d.dia}`); if (d.sugar) det.push(`sugar ${d.sugar}`);
      if (d.reasons) det.push(d.reasons.join(', ')); if (d.outcome) det.push(d.outcome); if (d.note) det.push(d.note);
      const who = e.by === 'hub' ? 'Nirantar care hub' : (NURSING_HOMES.find((x) => x.id === e.by) || CHEMISTS.find((x) => x.id === e.by) || { name: e.by }).name;
      return `<li class="${e.type} ${d.level || ''}">${icon(ic)}<div><b>${lab}</b>${staff && d.state ? ` <span class="pill ${d.state === 'open' ? 'red' : d.state === 'escalated' ? 'amber' : 'green'}">${esc(d.state)}</span>` : ''}<span class="muted"> ${fmtT(e.date)} | ${esc(who)}</span>${det.length ? `<div class="small">${esc(det.join('; '))}</div>` : ''}</div></li>`;
    }).join('')}</ol>`;
  }
  function qrSvg(text, size) {
    try {
      const q = window.NirQR(text), n = q.getModuleCount(), m = 2; let d = '';
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + m},${r + m}h1v1h-1z`;
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n + m * 2} ${n + m * 2}" shape-rendering="crispEdges" role="img" aria-label="QR code for this care plan"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#1F2340"/></svg>`;
    } catch (e) { return `<div class="qrfb">${icon('qr')}</div>`; }
  }
  const cardUrl = (id) => `${location.origin}${location.pathname}#/me/${id}`;
  function remember(id) { db.ui.recent = [id].concat((db.ui.recent || []).filter((x) => x !== id)).slice(0, 4); save(); }

  /* ---------- HOME ---------- */
  function vHome() {
    const steps = [
      ['DAY 0', 'hospital', 'Plan at discharge', 'The nursing-home nurse explains your medicines in your language, takes your consent and you pick your neighbourhood chemist. You leave with a care card.'],
      ['DAY 1', 'whatsapp', 'Family is in the loop', 'You and one family member get a welcome message on WhatsApp, SMS or a voice call in Hindi, Tamil or English.'],
      ['DAY 7', 'heart', 'First check at your chemist', 'Your chemist checks BP or sugar for free and asks three simple questions. It takes two minutes.'],
      ['EVERY MONTH', 'pill', 'Refill = check-up', 'Each time you refill, the reading is logged. Your doctor sees how you are doing without you travelling.'],
      ['IF YOU MISS', 'bell', 'A gentle reminder', 'If a refill is a week late, you get a reminder, then a call from the Nirantar care team.'],
      ['IF SOMETHING IS WRONG', 'alert', 'A nurse calls back', 'Warning signs reach a nurse within 4 hours and your nursing-home doctor the same day. Emergencies: 108 at once.'],
      ['DAY 30 AND 90', 'calendar', 'Back to your doctor', 'Your follow-up visits are booked at the same nursing home, with your readings ready for the doctor.'],
    ];
    const RPH = { patient: 'home-call', hospital: 'discharge', chemist: 'hero', doctor: 'doctor' };
    const roles = [
      ['patient', 'For patients and families', 'Open your care plan, see your next refill and visit, and know when to worry.', '#/patient', 'Open my care plan'],
      ['hospital', 'For nursing homes', 'Set up a patient in 10 minutes at discharge and see every patient after they go home.', '#/desk', 'Discharge desk'],
      ['chemist', 'For chemists', 'Log a refill and a BP check in two minutes. Your counter becomes a care point.', '#/point', 'Nirantar Point'],
      ['doctor', 'For doctors', 'One board with flags, late refills and visits due. You decide; nothing changes without you.', '#/doctor', 'Doctor board'],
    ];
    return `
    <section class="hero">
      <div class="hero-img" style="background-image:url('assets/img/hero.jpg')"></div>
      <div class="hero-in">
        <span class="eyebrow">SUN NIRANTAR | CONTINUOUS CARE</span>
        <h1>Care that doesn't stop <em>at discharge.</em></h1>
        <p class="lead">Nirantar links your <b>nursing home</b>, your <b>neighbourhood chemist</b> and <b>your doctor</b>, so every monthly refill becomes a quick check-up. Free for patients. Your doctor stays in charge.</p>
        <div class="cta"><a class="btn primary" href="#/patient">Open my care plan</a><a class="btn ghost" href="#/points">Find a Nirantar Point</a></div>
        <div class="hero-facts"><div><b>Free</b><span>BP and sugar check at every refill</span></div><div><b>3 languages</b><span>Hindi, Tamil, English; voice calls for basic phones</span></div><div><b>4 hours</b><span>for a nurse to call back on a warning sign</span></div></div>
      </div>
    </section>
    <section class="why wrap">
      <div class="why-grid">
        <div class="why-card">${icon('missed')}<div><b>1 in 3 heart patients</b> stops key medicines within 6 months of a hospital stay, often without telling anyone.<span class="src">Indian Heart Journal, 2025</span></div></div>
        <div class="why-card">${icon('chemist')}<div><b>86% of Indians</b> buy their medicines mainly from a local chemist, the one person who sees them every month.<span class="src">LocalCircles survey, 2026</span></div></div>
        <div class="why-card">${icon('heart')}<div><b>Pharmacy BP care</b> lowered BP by 11.5 mmHg in a rural Indian programme. Small drops prevent heart attacks.<span class="src">J Hum Hypertens, 2023</span></div></div>
      </div>
    </section>
    <section class="wrap" id="how">
      <div class="sec-h"><span class="eyebrow">HOW IT WORKS</span><h2>One loop from the discharge desk to your chemist and back</h2><p>Nothing new to install. Your chemist and your nursing home do the work; you just keep refilling.</p></div>
      <div class="journey">${steps.map(([d, ic, h, t], i) => `<div class="step"><span class="day">${d}</span>${icon(ic, 'big')}<h3>${h}</h3><p>${t}</p>${i < steps.length - 1 ? '<span class="arrow" aria-hidden="true">›</span>' : ''}</div>`).join('')}</div>
    </section>
    <section class="wrap moments">${[['discharge', 'At the discharge desk', 'A nurse walks the family through the care card in their own language.'], ['home-call', 'At home', 'A reminder call in Hindi or Tamil, two days before every refill.'], ['doctor', 'At the doctor\'s desk', 'Readings from every refill, ready before the follow-up visit.']].map(([im, h, t]) => `<figure>${photo(im, h)}<figcaption><b>${h}</b>${t}</figcaption></figure>`).join('')}</section>
    <section class="loop-band"><img src="assets/img/strip1.png" alt="Families, phones and doctors working together"></section>
    <section class="wrap">
      <div class="sec-h"><span class="eyebrow">ONE PROGRAMME, FOUR PEOPLE</span><h2>Everyone sees only what they need</h2></div>
      <div class="roles">${roles.map(([ic, h, t, href, b]) => `<a class="role" href="${href}"><div class="role-ph" style="background-image:url('assets/img/${RPH[ic]}.jpg')"></div>${icon(ic, 'big')}<h3>${h}</h3><p>${t}</p><span class="link">${b} ›</span></a>`).join('')}</div>
    </section>
    <section class="wrap promise">
      <div class="sec-h"><span class="eyebrow">YOUR DATA, YOUR CHOICE</span><h2>Six promises we keep</h2></div>
      <div class="prom">${[
        ['consent', 'You say yes first', 'Nothing starts without your consent at discharge. Say STOP any time.'],
        ['funnel', 'Chemist sees the minimum', 'Only your medicines, refill dates and three safety questions. No diagnosis, no history.'],
        ['lock', 'No sales access', 'Sales teams never see your name, phone or health data.'],
        ['doctor', 'Your doctor decides', 'Nirantar never changes a medicine. Alerts go to a nurse, then your doctor.'],
        ['seal', 'No brand pushing', 'Your plan uses generic names. We never ask you to switch brands.'],
        ['eye', 'Every access logged', 'Who saw what and when is recorded and audited.'],
      ].map(([ic, h, t]) => `<div>${icon(ic)}<b>${h}</b><p>${t}</p></div>`).join('')}</div>
      <a class="btn ghost" href="#/privacy">How your data moves</a>
    </section>
    ${worryBlock(T.en)}
    <section class="wrap faq">
      <div class="sec-h"><span class="eyebrow">QUESTIONS</span><h2>Things people ask us</h2></div>
      ${[
        ['Does Nirantar cost anything?', 'No. Checks at your chemist, reminders and nurse calls are free for patients. You pay for your medicines as usual.'],
        ['I do not use a smartphone. Can I still join?', 'Yes. Reminders come as a voice call or SMS in your language, and your chemist reminds you in person. A family member can also receive them.'],
        ['Will Nirantar change my medicines?', 'Never. Only your treating doctor changes medicines. Your care card uses generic names, and no one will ask you to switch brands.'],
        ['Who can see my readings?', 'Your nursing-home doctor and nurse, the Nirantar care team and the chemist you chose (medicines and dates only). No one else.'],
        ['How do I stop?', 'Reply STOP to any message, tell your chemist or your nursing home, or use the stop button in your care plan. Your data is deleted 12 months later.'],
        ['Where is Nirantar available?', 'Partner nursing homes and chemists in Indore and Coimbatore today, for heart, diabetes and high BP patients. More cities next year.'],
      ].map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('')}
    </section>`;
  }
  function worryBlock(L) {
    return `<section class="worry wrap"><div class="worry-in">${icon('siren', 'big')}<div><h2>${L.worry}</h2><p>${L.worryNote}</p>
      <ul><li>${L.chest}</li><li>${L.breath}</li><li>${L.swell}</li><li>${L.faint}</li><li>${L.sugarlow}</li></ul></div>
      <a class="btn danger big108" href="tel:108">${icon('ambulance')}<span>${L.call108}<small>${L.orNh}</small></span></a></div></section>`;
  }

  /* ---------- PATIENT ---------- */
  function vPatientEntry() {
    const rec = (db.ui.recent || []).map(pat).filter(Boolean);
    return `<section class="wrap narrow page">
      <div class="photo-head">${photo('home-call', 'A patient at home taking a reminder call')}<div class="sec-h left"><span class="eyebrow">MY CARE PLAN</span><h1>Open your care plan</h1><p>Scan the QR code on your care card, or type the code printed under it.</p></div></div>
      <form class="card form" id="openForm">
        <label>Care card code<input name="code" placeholder="NR-0000" autocomplete="off"></label>
        <div class="btnrow"><button class="btn primary" type="submit">Open my care plan</button><a class="btn ghost" href="#/me/NR-2041">See a sample care plan</a></div>
        <p class="small muted">The code starts with NR and is printed below the QR on the card you got at discharge. Lost it? Ask your chemist or nursing home desk.</p>
      </form>
      ${rec.length ? `<h3 class="mt">Opened on this phone</h3><div class="list">${rec.map((p) => `<a class="row" href="#/me/${p.id}">${icon('patient')}<div><b>${esc(p.name)}</b><span class="muted">${p.id} | ${esc(nh(p.nh).name)}</span></div><span class="chev">›</span></a>`).join('')}</div>` : ''}
      <div class="card tip mt">${icon('qr')}<div><b>Using a family member's phone?</b> That is fine. Open the plan with the same code; everyone sees the same reminders and readings.</div></div>
    </section>`;
  }
  function vMe(id, langParam) {
    const p = pat(id); if (!p) return vNotFound(id);
    remember(p.id);
    const lang = langParam || p.lang || 'en'; const L = T[lang] || T.en;
    const n = nh(p.nh), c = chem(p.chemist), due = nextDue(p);
    const visit = p.visits.find((v) => v.status === 'booked');
    const st = status(p);
    if (p.status === 'stopped') return `<section class="wrap narrow page"><div class="card center">${icon('lock', 'big')}<h2>Nirantar is stopped for ${esc(p.name.split(' ')[0])}</h2><p>No reminders or calls will be made. Your nursing home still has your discharge record. Changed your mind?</p><button class="btn primary" id="restart">Restart my care plan</button></div></section>`;
    return `<section class="wrap page me" data-lang="${lang}">
      <div class="me-top">
        <div><span class="eyebrow">${L.care.toUpperCase()}</span><h1>${L.hello}, ${esc(p.name.split(' ')[0])}</h1><p class="muted">${p.id} | ${esc(n.name)}, ${esc(n.city)} | ${esc(n.doctor)}</p></div>
        <div class="langs" role="group" aria-label="${L.lang}">${[['en', 'English'], ['hi', 'हिन्दी'], ['ta', 'தமிழ்']].map(([k, v]) => `<a href="#/me/${p.id}/${k}" class="${k === lang ? 'on' : ''}">${v}</a>`).join('')}</div>
      </div>
      ${st.k === 'flag' || st.k === 'urgent' ? `<div class="banner red">${icon('headset')}<div><b>The Nirantar nurse will call you.</b> Your chemist noticed something at your last check. Keep your phone near you. If you feel worse, call 108.</div></div>` : ''}
      ${st.k === 'late' || st.k === 'missed' ? `<div class="banner amber">${icon('bell')}<div><b>Your refill is ${-daysTo(due)} days late.</b> Please visit ${esc(c.name)} today. Missing heart and sugar medicines is risky even if you feel fine.</div></div>` : ''}
      <div class="tiles">
        <div class="tile big">${icon('pill', 'big')}<span>${L.nextRefill}</span><b>${fmt(due)}</b><em>${dueText(due, L)}</em><small>${L.at} ${esc(c.name)}, ${esc(c.area)}</small></div>
        <div class="tile big">${icon('calendar', 'big')}<span>${L.nextVisit}</span><b>${visit ? fmt(visit.date) : 'To be booked'}</b><em>${visit ? dueText(visit.date, L) : ''}</em><small>${esc(n.name)}${p.labs ? ' | ' + esc(p.labs) : ''}</small></div>
        <div class="tile big">${icon('heart', 'big')}<span>${L.freeCheck}</span><b>${readings(p).length}</b><em>checks so far</em><small>Last BP ${readings(p).length ? readings(p).slice(-1)[0].data.sys + '/' + readings(p).slice(-1)[0].data.dia : 'not yet'}</small></div>
      </div>
      <div class="grid2">
        <div class="card"><h2>${icon('pill')}${L.meds}</h2><p class="small muted">${L.doctorSays}</p>
          <div class="meds">${p.meds.map((m) => `<div class="med"><b>${esc(MEDS[m].name)}</b><span><i>${L.take}:</i> ${esc(MEDS[m].when)}</span><span><i>${L.why}:</i> ${esc(MEDS[m].why)}</span></div>`).join('')}</div></div>
        <div class="card worrycard"><h2>${icon('siren')}${L.worry}</h2><p class="small">${L.worryNote}</p><ul><li>${L.chest}</li><li>${L.breath}</li><li>${L.swell}</li><li>${L.faint}</li>${p.meds.some((m) => MEDS[m].group === 'Diabetes') ? `<li>${L.sugarlow}</li>` : ''}</ul><a class="btn danger" href="tel:108">${icon('ambulance')} ${L.call108}</a></div>
      </div>
      <div class="grid2">
        <div class="card"><h2>${icon('chart')}${L.readings}</h2>${bpChart(p)}</div>
        <div class="card"><h2>${icon('chemist')}${L.chemist}</h2><div class="kv"><b>${esc(c.name)}</b><span>${esc(c.area)}, ${esc(c.city)} | ${esc(c.hours)}</span><span class="muted small">Speaks ${esc(c.lang)}</span></div>
          <h2 class="mt">${icon('family')}${L.family}</h2><div class="kv"><b>${esc(p.family.name)}</b><span>${esc(p.family.phone)} | ${esc(p.family.city)}</span><span class="muted small">Gets the same reminders${p.consent.family ? '' : ' (switched off)'}</span></div>
          <a class="btn ghost mt" href="#/card/${p.id}/${lang}">${icon('qr')} ${L.printCard}</a></div>
      </div>
      <div class="grid2">
        <div class="card"><h2>${icon('bell')}${L.reminders}</h2>
          <form id="remForm" class="form inline">
            <div class="seg">${[['whatsapp', 'WhatsApp'], ['ivr', 'Voice call'], ['sms', 'SMS']].map(([k, v]) => `<label><input type="radio" name="ch" value="${k}" ${p.remind.channel === k ? 'checked' : ''}><span>${v}</span></label>`).join('')}</div>
            <label>Time of day<input type="time" name="time" value="${p.remind.time}"></label>
            <button class="btn primary" type="submit">Save</button>
          </form><p class="small muted">A reminder comes 2 days before each refill and visit. Voice calls play in your language.</p></div>
        <div class="card"><h2>${icon('consent')}${L.privacy}</h2>
          <div class="toggles">${[['reminders', 'Reminders and care calls'], ['family', 'Share reminders with my family contact'], ['brand', 'Support for medicines my doctor prescribed (refill offers, home delivery)']].map(([k, v]) => `<label class="tg"><input type="checkbox" data-c="${k}" ${p.consent[k] ? 'checked' : ''}><span></span>${v}</label>`).join('')}</div>
          <p class="small muted">Your care plan is shared only with ${esc(n.name)}, ${esc(c.name)} and the Nirantar care team. <a href="#/privacy">Read more</a></p>
          <button class="btn link danger-t" id="stopBtn">Stop Nirantar</button></div>
      </div>
      <div class="card"><h2>${icon('file')}${L.history}</h2>${timeline(p)}</div>
    </section>`;
  }
  function bindMe(id) {
    const p = pat(id); if (!p) return;
    const rf = $('#remForm'); if (rf) rf.addEventListener('submit', (e) => { e.preventDefault(); const f = new FormData(rf); p.remind = { channel: f.get('ch'), time: f.get('time') }; save(); toast('Reminder settings saved'); });
    $$('[data-c]').forEach((cb) => cb.addEventListener('change', () => { p.consent[cb.dataset.c] = cb.checked; addEv(p.id, 'consent', 'patient', { note: `${cb.dataset.c}: ${cb.checked ? 'on' : 'off'}` }); toast('Your choice is saved'); }));
    const sb = $('#stopBtn'); if (sb) sb.addEventListener('click', () => { if (!confirmBox(sb, 'Stop all Nirantar reminders and calls?')) return; p.status = 'stopped'; addEv(p.id, 'stop', 'patient', { note: 'Stopped by patient' }); route(); });
    const rs = $('#restart'); if (rs) rs.addEventListener('click', () => { p.status = 'active'; addEv(p.id, 'consent', 'patient', { note: 'Restarted by patient' }); route(); });
  }
  function confirmBox(btn, q) { if (btn.dataset.armed) return true; btn.dataset.armed = '1'; btn.textContent = q + ' Tap again to confirm'; setTimeout(() => { delete btn.dataset.armed; btn.textContent = 'Stop Nirantar'; }, 5000); return false; }
  function vCard(id, langParam) {
    const p = pat(id); if (!p) return vNotFound(id);
    const lang = langParam || p.lang || 'en'; const L = T[lang] || T.en;
    const n = nh(p.nh), c = chem(p.chemist), fresh = sessionStorage.getItem('nir-new') === p.id;
    if (fresh) sessionStorage.removeItem('nir-new');
    return `<section class="wrap page">
      ${fresh ? `<div class="banner green noprint">${icon('check')}<div><b>Plan activated.</b> Care plan sent to ${esc(c.name)} and a welcome message to ${esc(p.family.name)}. Print this card and hand it to the patient.</div></div>` : ''}
      <div class="noprint row-actions"><div class="langs">${[['en', 'English'], ['hi', 'हिन्दी'], ['ta', 'தமிழ்']].map(([k, v]) => `<a href="#/card/${p.id}/${k}" class="${k === lang ? 'on' : ''}">${v}</a>`).join('')}</div><button class="btn primary" onclick="window.print()">${icon('file')} Print card</button><a class="btn ghost" href="#/me/${p.id}/${lang}">Open care plan</a></div>
      <article class="carecard" data-lang="${lang}">
        <header><div class="logo-sm"><span class="sunmark"></span><b>Sun Nirantar</b></div><span>${L.care}</span></header>
        <div class="cc-body">
          <div class="cc-left">
            <h2>${esc(p.name)}</h2><p class="muted">${p.age} ${p.sex === 'M' ? 'M' : 'F'} | ${esc(n.name)} | ${esc(n.doctor)}</p>
            <h3>${L.meds}</h3><table>${p.meds.map((m) => `<tr><td><b>${esc(MEDS[m].name)}</b><br><span class="small">${esc(MEDS[m].why)}</span></td><td>${esc(MEDS[m].when)}</td></tr>`).join('')}</table>
            <div class="cc-row"><div><span>${L.nextRefill}</span><b>${fmt(nextDue(p))}</b><small>${esc(c.name)}, ${esc(c.area)}</small></div><div><span>${L.nextVisit}</span><b>${p.visits.find((v) => v.status === 'booked') ? fmt(p.visits.find((v) => v.status === 'booked').date) : '-'}</b><small>${esc(n.name)}</small></div></div>
          </div>
          <div class="cc-right">
            <div class="qr">${qrSvg(cardUrl(p.id), 5)}</div><p class="small center">${L.scan}</p><p class="code">${p.id}</p>
            <div class="cc-worry"><b>${L.worry}</b><ul><li>${L.chest}</li><li>${L.breath}</li><li>${L.swell}</li><li>${L.faint}</li></ul><div class="b108">${L.call108}</div></div>
          </div>
        </div>
        <footer>${L.freeCheck}. ${L.doctorSays}</footer>
      </article>
    </section>`;
  }

  /* ---------- DISCHARGE DESK ---------- */
  function nhPicker(cur, route_) { return `<label class="picker">${icon('hospital')}<select data-pick="nh" data-route="${route_}">${NURSING_HOMES.map((x) => `<option value="${x.id}" ${x.id === cur ? 'selected' : ''}>${x.name}, ${x.city}</option>`).join('')}</select></label>`; }
  function vDesk(tab) {
    const n = nh(db.ui.nh), list = db.patients.filter((p) => p.nh === n.id).sort((a, b) => new Date(b.discharged) - new Date(a.discharged));
    const cs = CHEMISTS.filter((c) => c.city === n.city);
    const groups = ['Heart', 'BP', 'Diabetes'];
    return `<section class="wrap page">
      <div class="app-h with-photo">${photo('discharge', 'A nurse explaining the care plan to a patient and his son')}<div><span class="eyebrow">DISCHARGE DESK</span><h1>${esc(n.name)}</h1><p class="muted">Set up a Nirantar plan in about 10 minutes, before the patient leaves. Fields left blank use the details on the discharge summary.</p>${nhPicker(n.id, 'desk')}</div></div>
      <div class="tabs"><a href="#/desk" class="${tab !== 'list' ? 'on' : ''}">New discharge</a><a href="#/desk/list" class="${tab === 'list' ? 'on' : ''}">My patients (${list.length})</a></div>
      ${tab === 'list' ? `<div class="list">${list.map((p) => `<a class="row" href="#/card/${p.id}">${icon('patient')}<div><b>${esc(p.name)}</b><span class="muted">${p.id} | discharged ${fmt(p.discharged)} | ${esc(chem(p.chemist).name)}</span></div>${pill(status(p))}<span class="chev">›</span></a>`).join('')}</div>` : `
      <form class="steps" id="deskForm" autocomplete="off">
        <fieldset class="card"><legend><span>1</span>Patient</legend>
          <div class="f3"><label>Full name<input name="name" placeholder="As on the discharge summary"></label><label>Age<input name="age" type="number"></label><label>Sex<select name="sex"><option value="M">Male</option><option value="F">Female</option></select></label></div>
          <div class="f3"><label>Mobile<input name="phone" inputmode="tel" placeholder="10-digit mobile"></label><label>Preferred language<select name="lang"><option value="hi">Hindi</option><option value="ta">Tamil</option><option value="en">English</option></select></label><label>Condition<select name="cohort">${COHORTS.map((c) => `<option>${c}</option>`).join('')}</select></label></div>
          <div class="f3"><label>Family member<input name="fname" placeholder="Name and relation, e.g. Vikas (son)"></label><label>Family mobile<input name="fphone" inputmode="tel" placeholder="Gets the same reminders"></label><label>Family lives in<input name="fcity" placeholder="City"></label></div>
        </fieldset>
        <fieldset class="card"><legend><span>2</span>Medicines on the discharge prescription</legend><p class="small muted">Generic names only. Strengths as signed by ${esc(n.doctor)}.</p>
          <div class="medpick">${groups.map((g) => `<div><h4>${g}</h4>${Object.entries(MEDS).filter(([, m]) => m.group === g).map(([k, m]) => `<label class="chk"><input type="checkbox" name="meds" value="${k}"><span><b>${m.name}</b><small>${m.when}</small></span></label>`).join('')}</div>`).join('')}</div>
          <label class="mt">Tests before the next visit<input name="labs" placeholder="e.g. Lipid profile at day 90"></label>
        </fieldset>
        <fieldset class="card"><legend><span>3</span>Home chemist, chosen by the patient</legend><p class="small muted">Ask: "Where do you usually buy medicines?" Pick the nearest Nirantar Point to that shop.</p>
          <div class="chemgrid">${cs.map((c, i) => `<label class="chemopt"><input type="radio" name="chemist" value="${c.id}" ${i === 0 ? 'checked' : ''}><span>${icon('chemist')}<b>${c.name}</b><small>${c.area} | ${c.hours}</small></span></label>`).join('')}</div>
        </fieldset>
        <fieldset class="card"><legend><span>4</span>Consent, read aloud in the patient's language</legend>
          <div class="consent-read">"Your care plan will be shared with your chosen chemist, this nursing home and the Nirantar care team only. They will remind you, check your BP or sugar for free, and call you if something looks wrong. Your doctor decides all treatment. You can stop at any time."</div>
          <label class="chk"><input type="checkbox" name="c_care"><span><b>Patient agrees to the care plan sharing above</b><small>Required. Recorded with ABDM consent and a DPDP notice.</small></span></label>
          <label class="chk"><input type="checkbox" name="c_rem" checked><span><b>Reminders on WhatsApp, SMS or voice call</b><small>2 days before each refill and visit</small></span></label>
          <label class="chk"><input type="checkbox" name="c_fam" checked><span><b>Family member gets the same reminders</b><small>Only if a family number is given</small></span></label>
          <label class="chk"><input type="checkbox" name="c_brand"><span><b>Optional: support for medicines the doctor already prescribed</b><small>Refill offers and delivery. Never changes the prescription. Separate consent.</small></span></label>
        </fieldset>
        <div class="submitbar"><span class="muted small">${icon('timer')} Plan goes to the chemist and the family at once.</span><button class="btn primary big" type="submit">Activate plan and print care card</button></div>
      </form>`}
    </section>`;
  }
  function bindDesk() {
    const f = $('#deskForm'); if (!f) return;
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const d = new FormData(f); let meds = d.getAll('meds');
      const DEF = { 'Heart attack, stented (ACS/PCI)': ['atorva', 'clopi', 'aspirin', 'metop'], 'Heart failure': ['furo', 'ramipril', 'metop', 'atorva'], 'High BP emergency': ['amlo', 'telmi', 'atorva'], 'Uncontrolled diabetes': ['metformin', 'glimi', 'telmi'], 'Diabetes with high BP': ['metformin', 'glargine', 'telmi'] };
      if (!meds.length) meds = DEF[d.get('cohort')] || ['atorva', 'telmi'];
      const g = (k, v) => (d.get(k) || '').toString().trim() || v;
      const n = db.ui.nh, base = n === 'kaveri' ? 3100 : 2040;
      const nums = db.patients.filter((p) => p.nh === n).map((p) => +p.id.split('-')[1]);
      const id = 'NR-' + (Math.max(base, ...nums) + 1);
      const now = new Date().toISOString();
      const p = {
        id, name: g('name', 'Geeta Sharma'), age: +g('age', 64), sex: d.get('sex'), phone: g('phone', '98XXXXX520'), lang: d.get('lang'), cohort: d.get('cohort'),
        family: { name: g('fname', 'Amit (son)'), phone: g('fphone', '91XXXXX780'), city: g('fcity', nh(db.ui.nh).city) },
        nh: n, chemist: d.get('chemist'), meds, labs: g('labs', 'Lipid profile at day 90'), discharged: now, refillDays: 30, status: 'active',
        consent: { care: true, reminders: !!d.get('c_rem'), family: !!d.get('c_fam'), brand: !!d.get('c_brand'), at: now },
        remind: { channel: 'whatsapp', time: '09:00' },
        visits: [{ day: 30, date: new Date(Date.now() + 30 * DAY).toISOString(), status: 'booked' }, { day: 90, date: new Date(Date.now() + 90 * DAY).toISOString(), status: 'booked' }],
      };
      db.patients.push(p); addEv(id, 'enrol', n, { note: 'Discharged with 30 days of medicines; day 7 check, day 30 and 90 visits booked' });
      sessionStorage.setItem('nir-new', id); location.hash = `#/card/${id}/${p.lang}`;
    });
  }

  /* ---------- NIRANTAR POINT (CHEMIST) ---------- */
  function chemPicker(cur) { return `<label class="picker">${icon('chemist')}<select data-pick="chemist">${CHEMISTS.map((x) => `<option value="${x.id}" ${x.id === cur ? 'selected' : ''}>${x.name}, ${x.area}</option>`).join('')}</select></label>`; }
  function vPoint(pid) {
    const c = chem(db.ui.chemist);
    const mine = db.patients.filter((p) => p.chemist === c.id && p.status !== 'stopped').sort((a, b) => new Date(nextDue(a)) - new Date(nextDue(b)));
    if (pid) return vPointPatient(c, pat(pid));
    const due = mine.filter((p) => daysTo(nextDue(p)) <= 3);
    return `<section class="wrap page">
      <div class="app-h"><div><span class="eyebrow">NIRANTAR POINT</span><h1>${esc(c.name)}</h1><p class="muted">${esc(c.area)}, ${esc(c.city)} | ${mine.length} Nirantar patients linked to your counter</p></div>${chemPicker(c.id)}</div>
      <form class="card search" id="findForm">${icon('search')}<input name="q" placeholder="Care card code or last 3 digits of mobile" autocomplete="off"><button class="btn primary">Find</button></form>
      <h3 class="mt">Due this week</h3>
      <div class="list">${due.length ? due.map((p) => ptRow(p, `#/point/${p.id}`)).join('') : '<p class="muted">No refills due in the next 3 days.</p>'}</div>
      <h3 class="mt">All linked patients</h3>
      <div class="list">${mine.map((p) => ptRow(p, `#/point/${p.id}`)).join('')}</div>
      <div class="card tip mt">${icon('academy')}<div><b>Your role is to record, not to judge.</b> Enter what you measure and what the patient says. The app applies the doctor's rules and sends any warning to the nurse. Never change or advise on a dose.</div></div>
    </section>`;
  }
  function ptRow(p, href) { const d = daysTo(nextDue(p)); return `<a class="row" href="${href}">${icon('patient')}<div><b>${esc(p.name)}</b><span class="muted">${p.id} | refill ${refillNo(p)} | due ${fmt(nextDue(p))}${d < 0 ? ` (${-d} days late)` : ''}</span></div>${pill(status(p))}<span class="chev">›</span></a>`; }
  function vPointPatient(c, p) {
    if (!p || p.chemist !== c.id) return `<section class="wrap page narrow"><div class="card center">${icon('lock', 'big')}<h2>Not linked to ${esc(c.name)}</h2><p>This patient chose a different Nirantar Point. You can still sell medicines as usual, but their care plan is not shared with you.</p><a class="btn ghost" href="#/point">Back</a></div></section>`;
    const last = readings(p).slice(-1)[0];
    const diab = p.meds.some((m) => MEDS[m].group === 'Diabetes');
    return `<section class="wrap page narrow">
      <a class="back" href="#/point">‹ All patients</a>
      <div class="card pt-head">${icon('patient', 'big')}<div><h1>${esc(p.name)}</h1><p class="muted">${p.id} | from ${esc(nh(p.nh).name)} | refill ${refillNo(p)} | due ${fmt(nextDue(p))}</p></div>${pill(status(p))}</div>
      <form class="card form" id="logForm">
        <h2>${icon('pill')}Medicines on the plan</h2>
        <div class="meds compact">${p.meds.map((m) => `<label class="chk"><input type="checkbox" name="disp" value="${m}" checked><span><b>${MEDS[m].name}</b><small>${MEDS[m].when}</small></span></label>`).join('')}</div>
        <h2 class="mt">${icon('heart')}Free check</h2>
        <div class="f3"><label>BP upper<input name="sys" type="number" placeholder="e.g. 130"></label><label>BP lower<input name="dia" type="number" placeholder="e.g. 80"></label><label>Sugar${diab ? '' : ' (optional)'}<input name="sugar" type="number" ${diab ? 'required' : ''} placeholder="mg/dL"></label></div>
        ${last ? `<p class="small muted">Last reading ${last.data.sys}/${last.data.dia}${last.data.sugar ? ', sugar ' + last.data.sugar : ''} on ${fmt(last.date)}</p>` : ''}
        <h2 class="mt">${icon('clipboard')}Ask these three questions</h2>
        ${[['chest', 'Any chest pain or pressure since the last visit?'], ['breath', 'Breathless while resting or lying down?'], ['swell', 'Any new swelling in the feet or ankles?']].map(([k, q]) => `<div class="yn"><span>${q}</span><label><input type="radio" name="${k}" value="0" checked><b>No</b></label><label><input type="radio" name="${k}" value="1"><b class="yes">Yes</b></label></div>`).join('')}
        <div class="submitbar"><label class="chk inline"><input type="checkbox" name="isRefill" checked><span><b>Refill sold today</b></span></label><button class="btn primary big" type="submit">Log refill and check</button></div>
      </form>
      <div id="logResult"></div>
    </section>`;
  }
  function bindPoint(pid) {
    const ff = $('#findForm'); if (ff) ff.addEventListener('submit', (e) => {
      e.preventDefault(); const q = new FormData(ff).get('q').trim().toUpperCase();
      const c = db.ui.chemist;
      const mine = db.patients.filter((p) => p.chemist === c && p.status !== 'stopped').sort((a, b) => new Date(nextDue(a)) - new Date(nextDue(b)));
      let hit = q ? (db.patients.find((p) => p.id.toUpperCase().replace('-', '') === q.replace('-', '')) || db.patients.find((p) => p.chemist === c && p.phone.replace(/\D/g, '').endsWith(q))) : mine[0];
      if (!hit) { toast('No match, opening the next patient due', 'warn'); hit = mine[0] || db.patients[0]; }
      if (hit.chemist !== c) { db.ui.chemist = hit.chemist; save(); }
      location.hash = '#/point/' + hit.id;
    });
    const lf = $('#logForm'); if (!lf) return;
    lf.addEventListener('submit', (e) => {
      e.preventDefault(); const p = pat(pid), d = new FormData(lf);
      const lr = readings(p).slice(-1)[0], diabP = p.meds.some((m) => MEDS[m].group === 'Diabetes');
      const data = { sys: +d.get('sys') || (lr ? lr.data.sys : 132), dia: +d.get('dia') || (lr ? lr.data.dia : 84), sugar: d.get('sugar') ? +d.get('sugar') : (diabP ? ((lr && lr.data.sugar) || 162) : undefined), q: { chest: d.get('chest') === '1', breath: d.get('breath') === '1', swell: d.get('swell') === '1' }, meds: d.getAll('disp') };
      addEv(p.id, d.get('isRefill') ? 'refill' : 'check', p.chemist, data);
      const a = assess(p, data); const out = $('#logResult');
      if (a) addEv(p.id, 'flag', p.chemist, { level: a.level, reasons: a.reasons, state: 'open' });
      const n = nh(p.nh);
      out.innerHTML = a && a.level === 'urgent'
        ? `<div class="result red">${icon('ambulance', 'big')}<div><h2>Urgent: tell the patient to call 108 now</h2><p>Or go straight to the ${esc(n.name)} emergency. Do not let them leave alone. <b>${esc(a.reasons.join(', '))}</b>. The care team and ${esc(n.doctor)} have been alerted.</p><a class="btn danger" href="tel:108">Call 108</a></div></div>`
        : a ? `<div class="result amber">${icon('headset', 'big')}<div><h2>Flag sent to ${esc(n.name)}</h2><p><b>${esc(a.reasons.join(', '))}</b>. A Nirantar nurse will call the patient within 4 hours. Tell the patient to keep their phone close and to call 108 if they feel worse.</p></div></div>`
          : `<div class="result green">${icon('check', 'big')}<div><h2>All logged. Thank you.</h2><p>Next refill due <b>${fmt(nextDue(p))}</b>. The patient and family will get a reminder 2 days before.</p></div></div>`;
      const hp = $('.pt-head .pill'); if (hp) hp.outerHTML = pill(status(p));
      lf.remove(); out.scrollIntoView({ behavior: 'smooth' });
      out.insertAdjacentHTML('beforeend', `<a class="btn ghost mt" href="#/point">Next patient</a>`);
    });
  }

  /* ---------- CARE HUB ---------- */
  function vHub() {
    const all = db.patients.filter((p) => p.status !== 'stopped');
    const fl = [];
    all.forEach((p) => flags(p).filter((f) => f.data.state === 'open').forEach((f) => fl.push({ p, f })));
    fl.sort((a, b) => (a.f.data.level === 'urgent' ? -1 : 1) - (b.f.data.level === 'urgent' ? -1 : 1) || new Date(a.f.date) - new Date(b.f.date));
    const missed = all.filter((p) => { const due = nextDue(p); const d = daysTo(due); if (d > -rules(p.nh).lateDays) return false; return !evs(p.id).some((e) => e.type === 'call' && new Date(e.date) > new Date(due) && daysTo(e.date) > -2); });
    const recent = db.events.filter((e) => e.type === 'call' || (e.type === 'flag' && e.data.state !== 'open')).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6);
    const sla = (f) => { const left = 4 * 60 - Math.round((Date.now() - new Date(f.date)) / 60000); return left > 0 ? `${Math.floor(left / 60)}h ${left % 60}m left` : `${-left} min over`; };
    return `<section class="wrap page">
      <div class="app-h"><div><span class="eyebrow">NIRANTAR CARE HUB</span><h1>Today's queue</h1><p class="muted">Nurses handle warning signs, care callers handle missed refills. 8am to 8pm, 7 days.</p></div><div class="kpis mini"><div><b>${fl.length}</b><span>flags to call</span></div><div><b>${missed.length}</b><span>missed refills</span></div></div></div>
      <div class="grid2 top">
        <div><h2>${icon('alert')}Warning signs: nurse calls within 4 hours</h2>
          ${fl.length ? fl.map(({ p, f }) => `<div class="card qitem ${f.data.level}"><div class="qh">${pill({ cls: f.data.level === 'urgent' ? 'red' : 'amber', label: f.data.level === 'urgent' ? 'Urgent' : 'Flag' })}<b>${esc(p.name)}</b><span class="muted">${p.id} | ${p.age}${p.sex} | ${esc(p.cohort)}</span><span class="sla">${icon('timer')}${sla(f)}</span></div>
            <p><b>${esc(f.data.reasons.join(', '))}</b> logged at ${esc(chem(f.by).name)}, ${fmtT(f.date)}. Patient ${esc(p.phone)}; family ${esc(p.family.name)} ${esc(p.family.phone)}. Language: ${({ hi: 'Hindi', ta: 'Tamil', en: 'English' })[p.lang]}.</p>
            <div class="qa"><button class="btn sm" data-flag="${f.id}" data-act="resolved">Called: settled, monitor</button><button class="btn sm amberb" data-flag="${f.id}" data-act="escalated">Send to NH doctor today</button><button class="btn sm danger" data-flag="${f.id}" data-act="emergency">Advised 108 / emergency</button></div></div>`).join('') : `<div class="card center muted">${icon('smiley', 'big')}<p>No open flags. Well done.</p></div>`}
        </div>
        <div><h2>${icon('bell')}Missed refills: care caller</h2>
          ${missed.length ? missed.map((p) => `<div class="card qitem"><div class="qh">${pill(status(p))}<b>${esc(p.name)}</b><span class="muted">${p.id} | ${esc(chem(p.chemist).name)}</span></div><p>Due ${fmt(nextDue(p))}. Call ${esc(p.phone)}, then family ${esc(p.family.phone)}.</p>
            <div class="qa"><button class="btn sm" data-call="${p.id}" data-out="Will refill today">Will refill today</button><button class="btn sm" data-call="${p.id}" data-out="Bought at another shop">Bought elsewhere</button><button class="btn sm amberb" data-call="${p.id}" data-out="Stopped medicine; sent to NH doctor">Stopped medicine</button><button class="btn sm ghost" data-call="${p.id}" data-out="Not reachable; retry tomorrow">Not reachable</button></div></div>`).join('') : `<div class="card center muted">${icon('smiley', 'big')}<p>Everyone has refilled on time.</p></div>`}
          <h2 class="mt">${icon('file')}Recently closed</h2><div class="card"><ul class="plain">${recent.map((e) => `<li><b>${esc((pat(e.pid) || {}).name || e.pid)}</b>: ${esc(e.data.outcome || e.data.state)} <span class="muted small">${fmtT(e.date)}</span></li>`).join('') || '<li class="muted">Nothing yet today.</li>'}</ul></div>
        </div>
      </div>
    </section>`;
  }
  function bindHub() {
    $$('[data-flag]').forEach((b) => b.addEventListener('click', () => {
      const f = db.events.find((e) => e.id === b.dataset.flag); const act = b.dataset.act;
      f.data.state = act === 'resolved' ? 'resolved' : 'escalated';
      f.data.outcome = act === 'resolved' ? 'Nurse called; settled, monitor at next refill' : act === 'escalated' ? 'Nurse called; sent to NH doctor for same-day review' : 'Nurse advised 108 / NH emergency';
      if (act === 'emergency') f.data.level = 'urgent';
      addEv(f.pid, 'call', 'hub', { outcome: f.data.outcome, kind: 'flag' }); toast('Call outcome saved'); route();
    }));
    $$('[data-call]').forEach((b) => b.addEventListener('click', () => {
      const out = b.dataset.out; addEv(b.dataset.call, 'call', 'hub', { outcome: out, kind: 'missed' });
      if (/Stopped/.test(out)) addEv(b.dataset.call, 'flag', 'hub', { level: 'flag', reasons: ['Patient stopped a medicine'], state: 'escalated', outcome: out });
      toast('Call outcome saved'); route();
    }));
  }

  /* ---------- DOCTOR ---------- */
  function vDoctor(pid) {
    const n = nh(db.ui.nh), list = db.patients.filter((p) => p.nh === n.id);
    if (pid) return vDoctorPatient(n, pat(pid));
    const active = list.filter((p) => p.status !== 'stopped');
    const order = { urgent: 0, flag: 1, missed: 2, late: 3, due: 4, ok: 5 };
    const risk = active.filter((p) => ['urgent', 'flag', 'missed', 'late'].includes(status(p).k) || flags(p).some((f) => f.data.state === 'escalated')).sort((a, b) => order[status(a).k] - order[status(b).k]);
    const vis = []; active.forEach((p) => p.visits.filter((v) => v.status === 'booked' && daysTo(v.date) >= 0 && daysTo(v.date) <= 7).forEach((v) => vis.push({ p, v })));
    const consent = Math.round((list.length / (list.length + (db.declined[n.id] || 0))) * 100);
    const r = rules(n.id);
    return `<section class="wrap page">
      <div class="app-h with-photo">${photo('doctor', 'A doctor reviewing patients on a tablet')}<div><span class="eyebrow">DOCTOR BOARD</span><h1>${esc(n.name)}</h1><p class="muted">${esc(n.doctor)} | ${active.length} patients at home on Nirantar. Tap any patient for their full history.</p>${nhPicker(n.id, 'doctor')}</div></div>
      <div class="kpis">
        <div>${icon('pill')}<b>${onTime(active)}%</b><span>refills on time</span></div>
        <div>${icon('alert')}<b>${active.filter((p) => openFlags(p).length).length}</b><span>open flags</span></div>
        <div>${icon('calendar')}<b>${vis.length}</b><span>visits in 7 days</span></div>
        <div>${icon('consent')}<b>${consent}%</b><span>consent at discharge</span></div>
      </div>
      <div class="grid2 top">
        <div><h2>${icon('alert')}Needs your attention</h2><div class="list">${risk.length ? risk.map((p) => { const f = openFlags(p).slice(-1)[0]; return `<a class="row" href="#/doctor/${p.id}">${icon('patient')}<div><b>${esc(p.name)}, ${p.age}${p.sex}</b><span class="muted">${esc(p.cohort)}${f ? ' | ' + esc(f.data.reasons.join(', ')) : ''}${f && f.data.outcome ? ' | ' + esc(f.data.outcome) : ''}</span></div>${pill(status(p))}<span class="chev">›</span></a>`; }).join('') : '<p class="muted">Nothing needs you right now.</p>'}</div>
          <h2 class="mt">${icon('users')}All patients at home</h2><div class="list">${active.map((p) => `<a class="row" href="#/doctor/${p.id}">${icon('patient')}<div><b>${esc(p.name)}</b><span class="muted">${p.id} | discharged ${fmt(p.discharged)} | ${esc(chem(p.chemist).name)}</span></div>${pill(status(p))}<span class="chev">›</span></a>`).join('')}</div></div>
        <div><h2>${icon('calendar')}Visits in the next 7 days</h2><div class="card"><ul class="plain">${vis.length ? vis.sort((a, b) => new Date(a.v.date) - new Date(b.v.date)).map(({ p, v }) => `<li><b>${fmt(v.date)}</b> ${esc(p.name)}, day ${v.day} review${p.labs ? ' | ' + esc(p.labs) : ''}</li>`).join('') : '<li class="muted">No visits booked this week.</li>'}</ul></div>
          <h2 class="mt">${icon('scales')}Your red-flag rules</h2>
          <form class="card form" id="rulesForm"><p class="small muted">Chemists only record. These numbers decide what reaches the nurse and you.</p>
            <div class="f2"><label>Urgent BP upper at or above<input type="number" name="sysUrgent" value="${r.sysUrgent}"></label><label>Urgent BP lower at or above<input type="number" name="diaUrgent" value="${r.diaUrgent}"></label>
            <label>Flag BP upper at or above<input type="number" name="sysFlag" value="${r.sysFlag}"></label><label>Flag BP lower at or above<input type="number" name="diaFlag" value="${r.diaFlag}"></label>
            <label>Flag sugar at or above<input type="number" name="sugarHigh" value="${r.sugarHigh}"></label><label>Urgent sugar at or below<input type="number" name="sugarLow" value="${r.sugarLow}"></label>
            <label>Call after refill late by (days)<input type="number" name="lateDays" value="${r.lateDays}"></label></div>
            <button class="btn primary">Save rules</button></form></div>
      </div>
    </section>`;
  }
  function vDoctorPatient(n, p) {
    if (!p) return vNotFound('');
    const of = openFlags(p);
    return `<section class="wrap page">
      <a class="back" href="#/doctor">‹ Doctor board</a>
      <div class="card pt-head">${icon('patient', 'big')}<div><h1>${esc(p.name)}, ${p.age}${p.sex}</h1><p class="muted">${p.id} | ${esc(p.cohort)} | discharged ${fmt(p.discharged, { day: 'numeric', month: 'short', year: 'numeric' })} | chemist ${esc(chem(p.chemist).name)} | family ${esc(p.family.name)}</p></div>${pill(status(p))}</div>
      ${of.length ? `<div class="banner red">${icon('alert')}<div><b>${esc(of.map((f) => f.data.reasons.join(', ')).join('; '))}</b>${of[0].data.outcome ? '. ' + esc(of[0].data.outcome) : ''}</div><button class="btn sm" id="reviewBtn">Mark reviewed</button></div>` : ''}
      <div class="grid2">
        <div class="card"><h2>${icon('chart')}BP at each check</h2>${bpChart(p)}</div>
        <div class="card"><h2>${icon('pill')}Plan</h2><div class="meds compact">${p.meds.map((m) => `<div class="med"><b>${MEDS[m].name}</b><span>${MEDS[m].when}</span></div>`).join('')}</div>
          <h2 class="mt">${icon('calendar')}Visits</h2><ul class="plain">${p.visits.map((v) => `<li>Day ${v.day}: <b>${fmt(v.date)}</b> ${pill({ cls: v.status === 'done' ? 'green' : v.status === 'missed' ? 'red' : 'blue', label: v.status })}</li>`).join('')}</ul>
          <form class="form inline mt" id="bookForm"><label>Book an extra visit<input type="date" name="d"></label><button class="btn primary">Book</button></form></div>
      </div>
      <div class="card"><h2>${icon('file')}Everything since discharge</h2>${timeline(p, true)}</div>
    </section>`;
  }
  function bindDoctor(pid) {
    const rf = $('#rulesForm'); if (rf) rf.addEventListener('submit', (e) => { e.preventDefault(); const d = new FormData(rf); const r = {}; for (const [k, v] of d.entries()) r[k] = +v; db.rules[db.ui.nh] = r; save(); toast('Rules saved. They apply to the next check at every chemist.'); });
    const p = pid && pat(pid); if (!p) return;
    const rb = $('#reviewBtn'); if (rb) rb.addEventListener('click', () => { openFlags(p).forEach((f) => { f.data.state = 'reviewed'; }); addEv(p.id, 'review', p.nh, { note: `Reviewed by ${nh(p.nh).doctor}` }); toast('Marked reviewed'); route(); });
    const bf = $('#bookForm'); if (bf) bf.addEventListener('submit', (e) => { e.preventDefault(); const d = new FormData(bf).get('d'); const iso = d ? new Date(d + 'T10:00:00').toISOString() : new Date(Date.now() + 7 * DAY).toISOString(); p.visits.push({ day: Math.round((new Date(iso) - new Date(p.discharged)) / DAY), date: iso, status: 'booked' }); addEv(p.id, 'visit', p.nh, { note: `Extra visit booked for ${fmt(iso)}` }); toast('Visit booked. The patient gets a reminder.'); route(); });
  }

  /* ---------- POINTS, PRIVACY, PARTNERS ---------- */
  function vPoints() {
    const cities = [...new Set(CHEMISTS.map((c) => c.city))];
    return `<section class="wrap page">
      <div class="sec-h left"><span class="eyebrow">NIRANTAR POINTS</span><h1>Find a Nirantar Point near you</h1><p>Neighbourhood chemists trained to check your BP and sugar for free when you refill, and to pass any warning sign to your nurse.</p></div>
      <div class="card search"><input id="pq" placeholder="Search by area or shop name" autocomplete="off"></div>
      ${cities.map((ct) => `<h2 class="mt">${icon('pin')}${ct}</h2><div class="points">${CHEMISTS.filter((c) => c.city === ct).map((c) => `<div class="card point" data-s="${(c.name + ' ' + c.area).toLowerCase()}">${icon('chemist', 'big')}<div><b>${c.name}</b><span>${c.area}, ${c.city}</span><span class="muted small">${c.hours} | ${c.lang}</span><div class="chips"><span>Free BP check</span><span>Sugar check</span><span>Refill log</span></div></div></div>`).join('')}</div>`).join('')}
      <div class="card tip mt">${icon('hospital')}<div><b>Partner nursing homes:</b> ${NURSING_HOMES.map((x) => `${x.name}, ${x.area}, ${x.city}`).join('; ')}. Ask the discharge desk about Nirantar before you go home.</div></div>
    </section>`;
  }
  function vPrivacy() {
    const flow = [['patient', 'You and your family', 'Give consent at discharge (ABDM consent and a DPDP notice). Change choices or stop any time.'], ['hospital', 'Your nursing home', 'Owns your record and decides who may see what. Contracts the care team.'], ['chemist', 'Your chemist', 'Sees only your name, medicines, refill dates and three safety questions.'], ['headset', 'Nirantar care team', 'Sends reminders and makes nurse calls for your nursing home. ISO 27001 certified.'], ['pie', 'Sun Pharma', 'Sees only totals for groups of 20 or more patients. Never names, phones or readings.']];
    return `<section class="wrap page">
      <div class="sec-h left"><span class="eyebrow">PRIVACY</span><h1>How your information moves</h1><p>We collect the least we need to keep you on track, and we tell you who sees it.</p></div>
      <div class="flow">${flow.map(([ic, h, t], i) => `<div class="card">${icon(ic, 'big')}<b>${h}</b><p>${t}</p></div>${i < flow.length - 1 ? '<span class="arrow">›</span>' : ''}`).join('')}</div>
      <div class="grid2 mt">
        <div class="card"><h2>${icon('filelock')}What we keep</h2><ul class="plain"><li>Your name, mobile and language</li><li>Medicines from your discharge prescription</li><li>Refill dates, BP and sugar readings, answers to three questions</li><li>Calls and visits linked to your plan</li></ul><p class="small muted">Kept while you are on Nirantar and for 12 months after, then deleted.</p></div>
        <div class="card"><h2>${icon('shield')}What we never do</h2><ul class="plain"><li>Share your data with sales teams</li><li>Change your medicines or suggest brands</li><li>Diagnose by app; a nurse and your doctor decide</li><li>Sell or advertise with your data</li></ul></div>
      </div>
      <div class="card mt"><h2>${icon('mobile')}Information saved on this phone</h2><p>Care plans you open are stored on this device so they load quickly. You can remove them at any time.</p><button class="btn ghost" id="wipe">Delete Nirantar data from this device</button></div>
    </section>`;
  }
  function vPartners() {
    return `<section class="wrap page">
      <div class="sec-h left"><span class="eyebrow">PARTNER WITH NIRANTAR</span><h1>For nursing homes and chemists</h1><p>Keep your patients after they go home, without new staff or software.</p></div>
      <div class="grid2">
        <div class="card partner">${photo('discharge', 'Nurse at discharge', 'wide')}${icon('hospital', 'big')}<h2>Nursing homes</h2><ul class="plain"><li><b>10 minutes</b> per discharge, done by your own nurse</li><li><b>Patients come back</b> for day 30 and 90 reviews, with readings ready</li><li><b>One doctor board</b> for flags, late refills and visits</li><li><b>NABH toolkit</b>: discharge and patient-rights SOPs</li><li><b>Free training</b>: 8-hour nurse course with CE credits</li></ul>
          <div class="calc"><b>A typical 40-bed home</b><span>144 patients a year x 30% more follow-up visits = <b>43 extra visits</b></span><span>43 x (₹500 consultation + ₹400 lab) = <b>about ₹39,000 a year</b></span><span>Service fee from year 3: ₹10,000 a year, paid to the care operator</span></div></div>
        <div class="card partner">${photo('hero', 'Chemist checking blood pressure', 'wide')}${icon('chemist', 'big')}<h2>Chemists</h2><ul class="plain"><li><b>Patients keep refilling</b> at your counter every month</li><li><b>A clinical role</b>: BP and sugar checks with a free BP monitor</li><li><b>2-minute logging</b> on a simple app, in your language</li><li><b>Paid per logged check</b> by the care operator, never per brand sold</li><li><b>4-hour course</b> and a certificate for your counter</li></ul>
          <div class="calc"><b>What stays the same</b><span>You sell what the doctor prescribed, as always.</span><span>No targets, no brand switching, no patient data beyond the plan.</span></div></div>
      </div>
      <div class="card tip mt">${icon('handshake')}<div><b>Interested?</b> Ask your Sun Pharma key account manager or the Nirantar desk at a partner nursing home. Enrolment starts with a 30-minute visit to set up your desk or counter.</div></div>
    </section>`;
  }
  function vNotFound(id) { return `<section class="wrap page narrow"><div class="card center">${icon('search', 'big')}<h2>We could not find ${esc(id) || 'that page'}</h2><p>Check the code on the care card, or ask your chemist or nursing home desk.</p><a class="btn primary" href="#/patient">Try again</a></div></section>`; }

  /* ---------- router ---------- */
  function setNav(key) { $$('.nav a, .menu a').forEach((a) => a.classList.toggle('on', a.dataset.k === key)); }
  function route() {
    const parts = (location.hash.replace(/^#\/?/, '') || '').split('/').filter(Boolean);
    const [r, a, b] = parts; const app = $('#app'); let html = '', bind = null, key = r || 'home';
    switch (r) {
      case undefined: case 'how': html = vHome(); if (r === 'how') setTimeout(() => $('#how') && $('#how').scrollIntoView(), 50); break;
      case 'patient': html = vPatientEntry(); bind = () => { const f = $('#openForm'); f.addEventListener('submit', (e) => { e.preventDefault(); let c = new FormData(f).get('code').trim().toUpperCase(); if (!c) c = 'NR-2041'; if (!c.includes('-')) c = c.slice(0, 2) + '-' + c.slice(2); location.hash = '#/me/' + (pat(c) ? c : 'NR-2041'); }); }; break;
      case 'me': html = vMe(a, b); bind = () => bindMe(a); key = 'patient'; break;
      case 'card': html = vCard(a, b); key = 'patient'; break;
      case 'desk': html = vDesk(a); bind = bindDesk; key = 'team'; break;
      case 'point': html = vPoint(a); bind = () => bindPoint(a); key = 'team'; break;
      case 'hub': html = vHub(); bind = bindHub; key = 'team'; break;
      case 'doctor': html = vDoctor(a); bind = () => bindDoctor(a); key = 'team'; break;
      case 'points': html = vPoints(); bind = () => $('#pq').addEventListener('input', (e) => { const q = e.target.value.toLowerCase(); $$('.point').forEach((c) => { c.style.display = c.dataset.s.includes(q) ? '' : 'none'; }); }); break;
      case 'privacy': html = vPrivacy(); bind = () => { const w = $('#wipe'); w.addEventListener('click', () => { Store.reset(); toast('Removed from this device'); location.hash = '#/'; }); }; break;
      case 'partners': html = vPartners(); break;
      default: html = vNotFound(r);
    }
    app.innerHTML = html; setNav(key); window.scrollTo(0, 0);
    $$('[data-pick]').forEach((s) => s.addEventListener('change', () => { db.ui[s.dataset.pick] = s.value; save(); route(); }));
    if (bind) bind();
    $('.nav').classList.remove('open');
  }
  window.addEventListener('hashchange', route);
  const EMBED = /[?&]embed=1/.test(location.search);
  function phoneView(on) {
    let ov = $('#phoneOverlay');
    if (!on) { if (ov) ov.remove(); document.body.classList.remove('phone-on'); try { localStorage.setItem('nir-view', 'laptop'); } catch (e) {} setToggle(); return; }
    if (!ov) {
      ov = document.createElement('div'); ov.id = 'phoneOverlay';
      ov.innerHTML = `<div class="ph-wrap"><div class="ph-frame"><div class="ph-notch"></div><iframe title="Sun Nirantar on a phone" src="${location.pathname}?embed=1${location.hash}"></iframe></div><p class="ph-note">Phone view: scroll and tap inside the screen</p></div>`;
      document.body.appendChild(ov);
    }
    document.body.classList.add('phone-on'); try { localStorage.setItem('nir-view', 'phone'); } catch (e) {} setToggle();
  }
  function setToggle() { const b = $('#viewToggle'); if (!b) return; const on = document.body.classList.contains('phone-on'); b.innerHTML = on ? '<span class="vt-i laptop"></span>Laptop view' : '<span class="vt-i phone"></span>Phone view'; b.setAttribute('aria-pressed', on); }
  document.addEventListener('DOMContentLoaded', () => {
    if (EMBED) document.documentElement.classList.add('embed');
    $('#burger').addEventListener('click', () => $('.nav').classList.toggle('open'));
    const mb = $('.menu-b'), menu = $('.menu');
    mb.addEventListener('click', (e) => { e.stopPropagation(); menu.classList.toggle('open'); });
    document.addEventListener('click', (e) => { if (!menu.contains(e.target)) menu.classList.remove('open'); });
    $$('.menu-l a').forEach((a) => a.addEventListener('click', () => menu.classList.remove('open')));
    const vt = $('#viewToggle');
    if (vt && !EMBED) { vt.addEventListener('click', () => phoneView(!document.body.classList.contains('phone-on'))); setToggle(); let v = null; try { v = localStorage.getItem('nir-view'); } catch (e) {} if (v === 'phone' && window.innerWidth > 900) phoneView(true); }
    window.addEventListener('message', (e) => { if (e.data === 'nir-close-phone') phoneView(false); });
    route();
  });
})();
