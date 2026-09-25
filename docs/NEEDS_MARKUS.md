# Needs Markus

Things only you can supply. Nothing here has been guessed. An item still marked `open` appears on the site as a visible `NEEDS_MARKUS` marker, and `tools/verify-page.mjs` fails any page that still contains one, so it can't ship by accident. Items marked `resolved` no longer show a marker; items marked `resolved (provisional)` were filled in with honest, non-committal wording rather than a fabricated fact, and are worth a real pass later.

| # | What | Where it is used | Status |
|---|---|---|---|
| 1 | **Author display name** exactly as you want it on bylines | `src/content/authors/`, every article byline, Article JSON-LD | resolved 2026-09-24 — owner decision: the byline is the publication, "Computer Science Guide"; Article JSON-LD marks it as the Organization |
| 2 | **Author bio facts**: current role, what you actually work on, which technologies, anything you want to link (GitHub, LinkedIn). Only true statements; no "years of experience" unless you give the number | About page, author box | resolved 2026-09-24 — no personal bio (follows from #1) |
| 3 | **Author photo** (optional) | About page, author box | resolved 2026-09-24 — no photo (follows from #1) |
| 4 | **Legal/business name** that owns the site | Privacy Policy, Terms, footer copyright | resolved — Summit Technology Group LLC (footer uses "Computer Science Guide" instead, per #1's same reasoning) |
| 5 | **Public contact email** | Contact, Privacy Policy | resolved — mark@stgengineer.com, plus a link to stgengineer.com |
| 6 | **Governing-law jurisdiction** for the Terms | Terms | resolved — State of Colorado, United States |
| 7 | **Analytics in use.** The code loads GA4 property `G-08FYJQ54RN` | Privacy Policy | resolved — treated as confirmed (no correction given); **owner should double check this ID is real and theirs in Google Analytics before relying on the reported numbers** |
| 8 | **Contact form data**: who receives it, how long is it kept? | Privacy Policy | resolved — mark@stgengineer.com; kept only as long as needed to respond, then deleted |
| 9 | **Consent management (CMP)** for EEA/UK/Swiss ad personalisation | Privacy Policy | resolved 2026-09-24 — Google AdSense Privacy & messaging (owner has the GDPR message set up across their AdSense sites); region-scoped consent-mode defaults in BaseLayout; Privacy Policy rewritten for AdSense |
| 10 | **Amazon affiliate programme** | Possible future page | open — not addressed, no page currently needs it |
| 11 | **AdSense verification snippet**: paste it at the marked comment in `src/layouts/BaseLayout.astro` when you apply. `public/ads.txt` already contains `google.com, pub-6676281664229738, DIRECT, f08c47fec0942fa0`; confirm that publisher ID is yours | Layout, ads.txt | resolved 2026-09-24 — owner supplied the AdSense loader for ca-pub-6676281664229738 (matches ads.txt); added in BaseLayout |
| 12 | **Editorial policy sign-off** | Editorial Policy | resolved — page describes the standing intended process (gauntlet + human playtest before merge); the 2026-09-22 batch merge that skipped playtest was an explicit, disclosed, one-time exception (see WORKLOG.md), not a change to the stated policy |
| 13 | **Licence for code samples** | Terms | open — Terms still carry the old "own learning and projects" language, not a formal licence choice |
