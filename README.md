# Sun Nirantar

**Care that doesn't stop at discharge.** Sun Nirantar links a nursing home's discharge desk, the patient's neighbourhood chemist ("Nirantar Point"), a nurse-led care hub and the treating doctor, so every monthly refill becomes a free check-up.

## What is inside

| Route | Who uses it | What it does |
|---|---|---|
| `#/` | Everyone | How the programme works, promises on data, when to worry, FAQ |
| `#/patient`, `#/me/NR-2041` | Patients and families | Care plan in English, Hindi or Tamil: next refill, next visit, medicines, warning signs, BP trend, reminders, consent, stop button |
| `#/card/NR-2041` | Discharge nurse, patient | Printable care card with QR code that opens the care plan |
| `#/desk` | Nursing-home nurse | 4-step discharge enrolment: patient, medicines (generic names), home chemist, consent |
| `#/point` | Chemist | Find patient, log refill, BP/sugar and 3 safety questions; the doctor's rules decide flag or urgent |
| `#/hub` | Care-hub nurses and callers | Warning signs with a 4-hour timer; missed-refill call list |
| `#/doctor` | Treating doctor | KPIs, patients needing attention, visits due, editable red-flag rules, full patient timeline |
| `#/points`, `#/privacy`, `#/partners` | Public | Chemist finder, data flow, nursing-home and chemist value |

**Phone / laptop view:** the round button at the bottom right of any page on a laptop shows the site inside a phone frame (the real mobile layout) and switches back. On an actual phone the site is already in mobile layout and the button is hidden.

**Nothing is mandatory:** every form moves on even when left blank. An empty care-card code opens the sample plan NR-2041, a blank discharge form creates a sample patient, a blank chemist search opens the next patient due, and blank readings reuse the last reading.

Sample patients to try: **NR-2041** (flag today), **NR-2042** (late refill), **NR-2043** (on track), **NR-3107** (Tamil), **NR-3108** (urgent, triaged).

Everything runs in the browser. Data is kept in the visitor's own browser storage (`localStorage`), so each visitor gets their own working copy; "Delete Nirantar data from this device" on the Privacy page restores it.

## Files

```
index.html               page shell, header, footer
assets/css/style.css     all styles (responsive, print styles for the care card)
assets/js/data.js        nursing homes, chemists, medicines, translations, sample patients, storage
assets/js/app.js         router and all screens
assets/js/vendor/qrcode.js  QR encoder (Kazuhiko Arase, MIT licence)
assets/img/              hero photo, illustrations, icons, favicon
vercel.json              cache headers
```

No build step and no dependencies to install.

## Run locally

```bash
cd nirantar-site
python3 -m http.server 8000
# open http://localhost:8000
```

## Put it on GitHub and Vercel

1. Create a new GitHub repository (for example `sun-nirantar`) and upload the contents of this folder (index.html at the top level).
   ```bash
   git init && git add . && git commit -m "Sun Nirantar site"
   git branch -M main
   git remote add origin https://github.com/<your-username>/sun-nirantar.git
   git push -u origin main
   ```
2. Go to vercel.com, choose **Add New > Project**, import the repository.
3. Framework preset: **Other**. Build command: leave empty. Output directory: leave empty (root).
4. Click **Deploy**. Your site is live at `https://sun-nirantar.vercel.app` (or similar). QR codes on care cards automatically point to whatever domain the site is served from.
