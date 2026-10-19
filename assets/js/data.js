/* Sun Nirantar: reference data, translations and the on-device store */
(function () {
  const DAY = 86400000;
  const today = () => { const d = new Date(); d.setHours(10, 0, 0, 0); return d; };
  const ago = (n, h) => { const d = new Date(today().getTime() - n * DAY); if (h != null) d.setHours(h, 15, 0, 0); return d.toISOString(); };
  const recent = (min) => new Date(Date.now() - min * 60000).toISOString();
  const ahead = (n) => new Date(today().getTime() + n * DAY).toISOString();

  const NURSING_HOMES = [
    { id: 'shanti', name: 'Shanti Nursing Home', city: 'Indore', area: 'Old Palasia', doctor: 'Dr. Anil Verma', beds: 40, phone: 'NH desk, 9am to 8pm' },
    { id: 'kaveri', name: 'Kaveri Nursing Home', city: 'Coimbatore', area: 'RS Puram', doctor: 'Dr. R. Subramanian', beds: 45, phone: 'NH desk, 9am to 8pm' },
  ];

  const CHEMISTS = [
    { id: 'jain', name: 'Jain Medical', area: 'Rajwada', city: 'Indore', hours: '8am to 10pm', lang: 'Hindi, English' },
    { id: 'sharma', name: 'Sharma Medicos', area: 'Vijay Nagar', city: 'Indore', hours: '9am to 11pm', lang: 'Hindi, English' },
    { id: 'gupta', name: 'Gupta Medical Hall', area: 'Palasia', city: 'Indore', hours: '8am to 10pm', lang: 'Hindi' },
    { id: 'malwa', name: 'Malwa Pharmacy', area: 'Bhawarkuan', city: 'Indore', hours: '24 hours', lang: 'Hindi, English' },
    { id: 'murugan', name: 'Sri Murugan Pharmacy', area: 'RS Puram', city: 'Coimbatore', hours: '8am to 10pm', lang: 'Tamil, English' },
    { id: 'lakshmi', name: 'Lakshmi Medicals', area: 'Gandhipuram', city: 'Coimbatore', hours: '9am to 10pm', lang: 'Tamil' },
    { id: 'anand', name: 'Anand Pharmacy', area: 'Peelamedu', city: 'Coimbatore', hours: '8am to 11pm', lang: 'Tamil, English' },
  ];

  // Generic names only: the core programme never names a brand.
  const MEDS = {
    atorva: { name: 'Atorvastatin 40 mg', why: 'Lowers cholesterol, protects the heart', when: 'Night, after dinner', group: 'Heart' },
    clopi: { name: 'Clopidogrel 75 mg', why: 'Prevents clots, keeps the stent open', when: 'Morning, after breakfast', group: 'Heart' },
    aspirin: { name: 'Aspirin 75 mg', why: 'Prevents clots', when: 'Afternoon, after lunch', group: 'Heart' },
    metop: { name: 'Metoprolol 25 mg', why: 'Slows the heart, lowers BP', when: 'Morning and night', group: 'Heart' },
    ramipril: { name: 'Ramipril 5 mg', why: 'Protects the heart and kidneys, lowers BP', when: 'Morning', group: 'BP' },
    telmi: { name: 'Telmisartan 40 mg', why: 'Lowers blood pressure', when: 'Morning', group: 'BP' },
    amlo: { name: 'Amlodipine 5 mg', why: 'Lowers blood pressure', when: 'Morning', group: 'BP' },
    furo: { name: 'Furosemide 40 mg', why: 'Removes extra water and swelling', when: 'Morning', group: 'Heart' },
    metformin: { name: 'Metformin 500 mg', why: 'Controls blood sugar', when: 'After breakfast and dinner', group: 'Diabetes' },
    glimi: { name: 'Glimepiride 1 mg', why: 'Controls blood sugar', when: 'Before breakfast', group: 'Diabetes' },
    glargine: { name: 'Insulin glargine 10 units', why: 'Long-acting insulin for sugar control', when: 'Night, same time daily', group: 'Diabetes' },
  };

  const COHORTS = [
    'Heart attack, stented (ACS/PCI)', 'Heart failure', 'High BP emergency', 'Uncontrolled diabetes', 'Diabetes with high BP',
  ];

  // Thresholds are set by each nursing home's doctor. The chemist records; the app decides.
  const DEFAULT_RULES = { sysUrgent: 180, diaUrgent: 110, sysFlag: 160, diaFlag: 100, sugarHigh: 300, sugarLow: 70, lateDays: 7 };

  // Translations for everything the patient reads
  const T = {
    en: {
      hello: 'Namaste', care: 'Your Nirantar care plan', nextRefill: 'Next refill', nextVisit: 'Next doctor visit', meds: 'Your medicines',
      worry: 'When to worry', worryNote: 'If you feel any of these, do not wait for your refill.', chest: 'Chest pain or pressure', breath: 'Breathless at rest or lying down',
      swell: 'New swelling in feet or ankles', faint: 'Fainting, confusion or slurred speech', sugarlow: 'Shaking, sweating, very low sugar',
      call108: 'Call 108 now', orNh: 'or go to your nursing home', inDays: 'in {n} days', today: 'today', overdue: '{n} days late',
      at: 'at', chemist: 'Your Nirantar Point', family: 'Family contact', readings: 'Your BP at each refill', history: 'Your care so far',
      reminders: 'Reminders', privacy: 'Privacy and consent', printCard: 'Print care card', code: 'Care card code', lang: 'Language',
      scan: 'Scan to open your care plan', freeCheck: 'Free BP and sugar check at every refill', doctorSays: 'Only your doctor changes your medicines.',
      take: 'Take', why: 'Why',
    },
    hi: {
      hello: 'नमस्ते', care: 'आपकी निरंतर देखभाल योजना', nextRefill: 'अगली दवा लेने की तारीख', nextVisit: 'अगली डॉक्टर विज़िट', meds: 'आपकी दवाइयाँ',
      worry: 'कब चिंता करें', worryNote: 'इनमें से कुछ भी हो तो अगली दवा का इंतज़ार न करें।', chest: 'सीने में दर्द या दबाव', breath: 'आराम में या लेटने पर साँस फूलना',
      swell: 'पैरों या टखनों में नई सूजन', faint: 'बेहोशी, उलझन या बोलने में दिक्कत', sugarlow: 'काँपना, पसीना, शुगर बहुत कम होना',
      call108: 'तुरंत 108 पर कॉल करें', orNh: 'या अपने नर्सिंग होम जाएँ', inDays: '{n} दिन में', today: 'आज', overdue: '{n} दिन देर',
      at: 'पर', chemist: 'आपका निरंतर पॉइंट', family: 'परिवार का संपर्क', readings: 'हर बार दवा लेते समय आपका BP', history: 'अब तक की देखभाल',
      reminders: 'रिमाइंडर', privacy: 'गोपनीयता और सहमति', printCard: 'केयर कार्ड प्रिंट करें', code: 'केयर कार्ड कोड', lang: 'भाषा',
      scan: 'अपनी देखभाल योजना खोलने के लिए स्कैन करें', freeCheck: 'हर बार दवा लेते समय BP और शुगर की मुफ़्त जाँच', doctorSays: 'आपकी दवा सिर्फ़ आपके डॉक्टर बदलते हैं।',
      take: 'कब लें', why: 'क्यों',
    },
    ta: {
      hello: 'வணக்கம்', care: 'உங்கள் நிரந்தர் பராமரிப்புத் திட்டம்', nextRefill: 'அடுத்த மருந்து வாங்கும் நாள்', nextVisit: 'அடுத்த மருத்துவர் சந்திப்பு', meds: 'உங்கள் மருந்துகள்',
      worry: 'எப்போது கவலைப்பட வேண்டும்', worryNote: 'இவற்றில் ஏதேனும் இருந்தால் அடுத்த மருந்து நாள் வரை காத்திருக்க வேண்டாம்.', chest: 'நெஞ்சு வலி அல்லது அழுத்தம்', breath: 'ஓய்விலும் படுக்கும்போதும் மூச்சுத் திணறல்',
      swell: 'கால் அல்லது கணுக்காலில் புதிய வீக்கம்', faint: 'மயக்கம், குழப்பம் அல்லது பேச்சுத் தடுமாற்றம்', sugarlow: 'நடுக்கம், வியர்வை, சர்க்கரை மிகக் குறைவு',
      call108: 'உடனே 108 ஐ அழைக்கவும்', orNh: 'அல்லது உங்கள் மருத்துவமனைக்குச் செல்லவும்', inDays: '{n} நாட்களில்', today: 'இன்று', overdue: '{n} நாள் தாமதம்',
      at: '', chemist: 'உங்கள் நிரந்தர் மையம்', family: 'குடும்பத் தொடர்பு', readings: 'ஒவ்வொரு முறையும் உங்கள் BP', history: 'இதுவரை உங்கள் பராமரிப்பு',
      reminders: 'நினைவூட்டல்கள்', privacy: 'தனியுரிமை மற்றும் ஒப்புதல்', printCard: 'அட்டையை அச்சிடவும்', code: 'பராமரிப்பு அட்டை குறியீடு', lang: 'மொழி',
      scan: 'உங்கள் திட்டத்தைத் திறக்க ஸ்கேன் செய்யவும்', freeCheck: 'ஒவ்வொரு முறையும் இலவச BP, சர்க்கரை பரிசோதனை', doctorSays: 'உங்கள் மருந்துகளை உங்கள் மருத்துவர் மட்டுமே மாற்றுவார்.',
      take: 'எப்போது', why: 'ஏன்',
    },
  };

  function seed() {
    const P = (o) => Object.assign({
      refillDays: 30, status: 'active', lang: 'hi',
      consent: { care: true, reminders: true, family: true, brand: false, at: o.discharged },
      remind: { channel: 'whatsapp', time: '09:00' },
    }, o);
    const patients = [
      P({ id: 'NR-2041', name: 'Ramesh Kumar', age: 61, sex: 'M', phone: '98XXXXX214', family: { name: 'Vikas (son)', phone: '97XXXXX563', city: 'Pune' }, nh: 'shanti', chemist: 'jain', cohort: COHORTS[0], meds: ['atorva', 'clopi', 'aspirin', 'metop'], discharged: ago(58), visits: [{ day: 30, date: ago(28), status: 'done' }, { day: 90, date: ahead(32), status: 'booked' }], labs: 'Lipid profile at day 90' }),
      P({ id: 'NR-2042', name: 'Sunita Patel', age: 58, sex: 'F', phone: '99XXXXX871', family: { name: 'Rohit (son)', phone: '98XXXXX102', city: 'Indore' }, nh: 'shanti', chemist: 'sharma', cohort: COHORTS[3], meds: ['metformin', 'glimi', 'telmi'], discharged: ago(69), visits: [{ day: 30, date: ago(39), status: 'done' }, { day: 90, date: ahead(21), status: 'booked' }], labs: 'HbA1c at day 90' }),
      P({ id: 'NR-2043', name: 'Mohan Lal', age: 67, sex: 'M', phone: '94XXXXX330', family: { name: 'Kamla (wife)', phone: '94XXXXX331', city: 'Indore' }, nh: 'shanti', chemist: 'gupta', cohort: COHORTS[1], meds: ['furo', 'ramipril', 'metop', 'atorva'], discharged: ago(33), visits: [{ day: 30, date: ago(3), status: 'done' }, { day: 90, date: ahead(57), status: 'booked' }], labs: 'Kidney function at day 30' }),
      P({ id: 'NR-2044', name: 'Farida Bano', age: 59, sex: 'F', phone: '96XXXXX448', family: { name: 'Imran (son)', phone: '96XXXXX449', city: 'Bhopal' }, nh: 'shanti', chemist: 'jain', cohort: COHORTS[2], meds: ['amlo', 'telmi', 'atorva'], discharged: ago(27), visits: [{ day: 30, date: ahead(3), status: 'booked' }, { day: 90, date: ahead(63), status: 'booked' }], labs: '' }),
      P({ id: 'NR-3107', name: 'Lakshmi Rajan', age: 55, sex: 'F', lang: 'ta', phone: '90XXXXX612', family: { name: 'Priya (daughter)', phone: '90XXXXX613', city: 'Chennai' }, nh: 'kaveri', chemist: 'murugan', cohort: COHORTS[4], meds: ['metformin', 'glargine', 'telmi'], discharged: ago(44), visits: [{ day: 30, date: ago(14), status: 'done' }, { day: 90, date: ahead(46), status: 'booked' }], labs: 'HbA1c at day 90' }),
      P({ id: 'NR-3108', name: 'Selvam Krishnan', age: 63, sex: 'M', lang: 'ta', phone: '93XXXXX207', family: { name: 'Meena (wife)', phone: '93XXXXX208', city: 'Coimbatore' }, nh: 'kaveri', chemist: 'lakshmi', cohort: COHORTS[0], meds: ['atorva', 'clopi', 'aspirin', 'ramipril'], discharged: ago(36), visits: [{ day: 30, date: ago(6), status: 'missed' }, { day: 90, date: ahead(54), status: 'booked' }], labs: 'Lipid profile at day 90' }),
    ];
    const E = [];
    let n = 1;
    const ev = (pid, type, date, by, data) => E.push({ id: 'E' + (n++), pid, type, date, by, data: data || {} });
    // Ramesh: on track, today a flag at the counter
    ev('NR-2041', 'enrol', ago(58, 11), 'shanti', { note: 'Discharged with 30 days of medicines' });
    ev('NR-2041', 'check', ago(51, 18), 'jain', { sys: 142, dia: 90, q: { chest: false, breath: false, swell: false } });
    ev('NR-2041', 'refill', ago(29, 19), 'jain', { sys: 138, dia: 86, q: { chest: false, breath: false, swell: false } });
    ev('NR-2041', 'visit', ago(28, 11), 'shanti', { note: 'Day 30 review done' });
    ev('NR-2041', 'refill', recent(55), 'jain', { sys: 148, dia: 92, q: { chest: false, breath: false, swell: true } });
    ev('NR-2041', 'flag', recent(54), 'jain', { level: 'flag', reasons: ['New ankle swelling', 'BP 148/92'], state: 'open' });
    // Sunita: missed refill, reached by care caller
    ev('NR-2042', 'enrol', ago(69, 12), 'shanti');
    ev('NR-2042', 'check', ago(62, 17), 'sharma', { sys: 136, dia: 84, sugar: 212, q: { chest: false, breath: false, swell: false } });
    ev('NR-2042', 'refill', ago(39, 18), 'sharma', { sys: 132, dia: 82, sugar: 168, q: { chest: false, breath: false, swell: false } });
    ev('NR-2042', 'visit', ago(39, 11), 'shanti', { note: 'Day 30 review done' });
    ev('NR-2042', 'call', ago(1, 16), 'hub', { outcome: 'Reached son; will refill today', kind: 'missed' });
    // Mohan: all on time
    ev('NR-2043', 'enrol', ago(33, 10), 'shanti');
    ev('NR-2043', 'check', ago(26, 19), 'gupta', { sys: 128, dia: 80, q: { chest: false, breath: false, swell: false } });
    ev('NR-2043', 'refill', ago(3, 18), 'gupta', { sys: 124, dia: 78, q: { chest: false, breath: false, swell: false } });
    ev('NR-2043', 'visit', ago(3, 12), 'shanti', { note: 'Day 30 review done; kidney test normal' });
    // Farida: due soon
    ev('NR-2044', 'enrol', ago(27, 13), 'shanti');
    ev('NR-2044', 'check', ago(20, 18), 'jain', { sys: 154, dia: 94, q: { chest: false, breath: false, swell: false } });
    // Lakshmi: steady
    ev('NR-3107', 'enrol', ago(44, 11), 'kaveri');
    ev('NR-3107', 'check', ago(37, 18), 'murugan', { sys: 140, dia: 88, sugar: 246, q: { chest: false, breath: false, swell: false } });
    ev('NR-3107', 'refill', ago(14, 19), 'murugan', { sys: 134, dia: 84, sugar: 178, q: { chest: false, breath: false, swell: false } });
    ev('NR-3107', 'visit', ago(14, 10), 'kaveri', { note: 'Day 30 review done' });
    // Selvam: urgent reading yesterday, triaged
    ev('NR-3108', 'enrol', ago(36, 12), 'kaveri');
    ev('NR-3108', 'check', ago(29, 18), 'lakshmi', { sys: 146, dia: 92, q: { chest: false, breath: false, swell: false } });
    ev('NR-3108', 'refill', ago(1, 19), 'lakshmi', { sys: 184, dia: 112, q: { chest: false, breath: true, swell: false } });
    ev('NR-3108', 'flag', ago(1, 19), 'lakshmi', { level: 'urgent', reasons: ['BP 184/112', 'Breathless'], state: 'triaged', outcome: 'Nurse called in 40 min; sent to Kaveri NH emergency' });
    return {
      version: 2, patients, events: E,
      rules: { shanti: Object.assign({}, DEFAULT_RULES), kaveri: Object.assign({}, DEFAULT_RULES) },
      declined: { shanti: 2, kaveri: 1 },
      ui: { nh: 'shanti', chemist: 'jain', recent: [] },
    };
  }

  const KEY = 'sun-nirantar-v1';
  const Store = {
    db: null,
    load() {
      try { const raw = localStorage.getItem(KEY); this.db = raw ? JSON.parse(raw) : seed(); } catch (e) { this.db = seed(); }
      if (!this.db || this.db.version !== 2) this.db = seed();
      return this.db;
    },
    save() { try { localStorage.setItem(KEY, JSON.stringify(this.db)); } catch (e) { /* storage unavailable: keep in memory */ } },
    reset() { const s = seed(); Object.keys(this.db).forEach((k) => delete this.db[k]); Object.assign(this.db, s); this.save(); },
  };

  window.NIR = { DAY, today, ago, ahead, NURSING_HOMES, CHEMISTS, MEDS, COHORTS, DEFAULT_RULES, T, Store };
})();
