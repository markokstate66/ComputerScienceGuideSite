# Needs Markus

Things only you can supply. Nothing here has been guessed. Each item appears on the site as a visible `NEEDS_MARKUS` marker, and `tools/verify-page.mjs` fails any page that still contains one, so none of these can ship by accident.

| # | What | Where it is used | Status |
|---|---|---|---|
| 1 | **Author display name** exactly as you want it on bylines | `src/content/authors/`, every article byline, Article JSON-LD | open |
| 2 | **Author bio facts**: current role, what you actually work on, which technologies, anything you want to link (GitHub, LinkedIn). Only true statements; no "years of experience" unless you give the number | About page, author box | open |
| 3 | **Author photo** (optional) | About page, author box | open |
| 4 | **Legal/business name** that owns the site (you personally, or a company) | Privacy Policy, Terms, footer copyright | open |
| 5 | **Public contact email** (or confirm the contact form is the only channel) | Contact, Privacy Policy | open |
| 6 | **Governing-law jurisdiction** for the Terms | Terms | open |
| 7 | **Analytics in use.** The code loads GA4 property `G-08FYJQ54RN`. Confirm that is correct and the only analytics/tracking in use | Privacy Policy | open |
| 8 | **Contact form data**: the API sends form contents by email through Azure Communication Services. Who receives it, and how long are messages kept? | Privacy Policy | open |
| 9 | **Consent management.** Google requires a certified CMP for personalised ads to EEA/UK/Swiss visitors. Which one will you use (Google's own Privacy & messaging tool in AdSense is the usual choice)? | Privacy Policy, layout | open |
| 10 | **Amazon affiliate programme.** The old `/resources/` page used tag `dreamscribe09-20` with no disclosure. It has been removed. If you want book recommendations back, confirm the tag is yours and we will add them with a proper disclosure and `rel="sponsored"` | Possible future page | open |
| 11 | **AdSense verification snippet**: paste it at the marked comment in `src/layouts/BaseLayout.astro` when you apply. `public/ads.txt` already contains `google.com, pub-6676281664229738, DIRECT, f08c47fec0942fa0`; confirm that publisher ID is yours | Layout, ads.txt | open |
| 12 | **Editorial policy sign-off.** The draft states that articles are drafted with AI assistance, that every code sample is compiled and run by tooling, and that you review articles before publication. Confirm this describes what you will actually do | Editorial Policy | open |
| 13 | **Licence for code samples.** The Terms currently say readers may use code samples in their own learning and projects (carried over from the old Terms). Confirm, or choose a licence (for example MIT for code, all rights reserved for prose) | Terms | open |
