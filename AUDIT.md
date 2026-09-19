# Site Audit — computerscienceguide.com

Audited 2026-09-18 on branch `adsense-rebuild`. Every number below was measured by building the repo (`npm run build`), running `tools/verify-page.mjs` (headless Chrome + Lighthouse, default mobile profile, against a local static server), and fetching the live homepage. Nothing here is estimated.

## Verdict

As it stands the site would most likely be rejected for **low value content**. It is a well-built shell around 17 short, generic overview pages with no author, no sources, no diagrams, unverified code, and affiliate links without disclosure. The fix is a content rebuild, not a tweak.

## Stack

| Item | Finding |
|---|---|
| Generator | Astro 4.16, static output, `@astrojs/sitemap` |
| Hosting | Azure Static Web Apps, GitHub Action deploys on push to `master` |
| API | One Azure Function (`api/contact`) sending mail via Azure Communication Services |
| Content format | Hand-written `.astro` pages with raw HTML; no content collections, no Markdown, no front matter schema |
| Styling | One 6 KB `global.css`, light/dark theme via `data-theme` + `localStorage` |
| Analytics / ads | GA4 `G-08FYJQ54RN` and the AdSense loader `ca-pub-6676281664229738` are injected on every page from `BaseLayout.astro` |
| Local toolchain | Node 24.11, npm 11, .NET SDK 10.0.302, Chrome + Edge. **Python is not installed** |

**Decision: keep Astro + Azure SWA.** It builds 26 pages in 2.4 s, scores 96–99 on performance, and the deploy pipeline works. What must change is the content model: move articles to Markdown/MDX content collections with a validated front matter schema.

## Page inventory (26 pages)

Word counts are prose inside `<main>`, excluding code blocks, nav, scripts and SVG.

| Route | Words | Code blocks | Figures |
|---|---:|---:|---:|
| `/` | 202 | 0 | 0 |
| `/about/` | 258 | 0 | 0 |
| `/contact/` | 113 | 0 | 3 (icons) |
| `/privacy/` | 286 | 0 | 0 |
| `/terms/` | 794 | 0 | 0 |
| `/resources/` | 752 | 0 | 25 (hot-linked) |
| `/roadmap/` | 235 | 0 | 0 |
| `/guides/` | 226 | 0 | 0 |
| `/guides/interview-prep/` | 1007 | 8 | 0 |
| `/guides/web-development/` | 717 | 3 | 0 |
| `/guides/programming-fundamentals/` | 663 | 12 | 0 |
| `/guides/algorithms/` | 655 | 15 | 0 |
| `/guides/portfolio/` | 622 | 3 | 0 |
| `/guides/data-structures/` | 563–600 | 8 | 0 |
| `/guides/system-design/` | 538 | 7 | 0 |
| `/guides/api-design/` | 500 | 9 | 0 |
| `/guides/cs-basics/` | 485 | 7 | 0 |
| `/guides/git-version-control/` | 451 | 23 | 0 |
| `/guides/databases/` | 396 | 10 | 0 |
| `/guides/oop/` | 384 | 12 | 0 |
| `/guides/html-css/` | 365 | 20 | 0 |
| `/guides/react/` | 359 | 11 | 0 |
| `/guides/nodejs/` | 281 | 14 | 0 |
| `/guides/javascript/` | 247 | 25 | 0 |
| `/404.html`, `/500.html` | 59 / 75 | 1 / 1 | 0 |

17 guides, **median 485 words of prose**, zero diagrams anywhere. A page titled "Data Structures: Complete Guide with Examples" that covers seven structures in 563 words claims "30 min read".

## Lighthouse (mobile profile, local static server)

| Page | Perf | A11y | Best practices | SEO |
|---|---:|---:|---:|---:|
| `/` | 96 | 95 | **77** | 100 |
| `/guides/` | 99 | 100 | **77** | 100 |
| `/guides/data-structures/` | 99 | 93 | **77** | 100 |
| `/resources/` | 99 | 95 | **77** | 100 |

Best practices fails the ≥90 bar on every page. Causes reported by Lighthouse: third-party cookies and DevTools "Issues" from the AdSense/GA loaders, plus a console 404 for `/apple-touch-icon.png`. Accessibility loses points to insufficient colour contrast and skipped heading levels (`h4` footer/TOC headings directly under `h1`/`h2`). 218 KiB of unused JavaScript is entirely third-party.

## What would fail AdSense review

### Content (the main problem)
1. **Thin content.** Every guide is a skim-level survey: a two-sentence definition, a bullet list, a code block, next section. No depth, no worked examples, no exercises, no edge cases.
2. **Generic, mass-produced feel.** All 17 guides follow one template (intro blockquote → `h2` → bullets → code → "Next Steps"). Openers are filler: "Data structures are the building blocks of efficient programs."
3. **No author, no sources.** Article JSON-LD lists the author as an Organization. No byline, no bio, no citations, no editorial policy. The About page speaks as "we" with no person behind it, and claims "visual aids" and "practice exercises" the guides do not contain.
4. **Unverified code.** Around 190 code blocks, none compiled or run by any tooling. Mostly Python/JavaScript, which does not match the owner's actual expertise (C#/.NET).
5. **Misleading metadata.** "30 min read" on a 563-word page; all guides dated December 2024 with no real update history.
6. **Off-mission breadth.** React, Node.js, HTML/CSS, portfolio and interview-prep pages each get ~300–600 words on topics where entire documentation sites exist. They cannot compete and dilute the site's focus.

### Trust and policy
7. **Undisclosed affiliate links.** `/resources/` has 8 Amazon links tagged `dreamscribe09-20` with no affiliate disclosure, no `rel="sponsored"`, and no Amazon Associates statement. This is an FTC and Amazon programme requirement and a trust red flag.
8. **Hot-linked images.** `/resources/` pulls book covers and logos from `m.media-amazon.com`, `pll.harvard.edu`, `code.visualstudio.com`, `codewars.com`. Four of them already fail to load, and the rest are other people's assets.
9. **Privacy policy is generic.** 286 words, dated December 2024, no named data controller, no contact address, no mention of the contact form's data (name, email, message sent through Azure Communication Services), no cookie consent. Google requires a consent mechanism for EEA/UK/Swiss visitors when serving personalised ads.
10. **No editorial policy / "how content is made" page.**
11. **AdSense loader already on every page** before approval. The brief says no ad code; it should be reduced to a single, clearly marked verification slot.

### Navigation and UX
12. **Mobile header is broken.** At 390 px the logo wraps to three lines and the nav runs off-screen ("About" and the theme toggle are clipped); there is no menu button. Verified in `.verify/home/mobile-dark-fold.png`.
13. **No search**, although the WebSite JSON-LD advertises a `SearchAction` at `/search?q=`, which 404s.
14. **No syntax highlighting, no copy button, no callouts, no diagrams.** Code renders as plain monochrome text.
15. **Dead ends.** Guides end with two "Next Steps" links; no related articles, no previous/next, no glossary, no hub structure.

### Technical SEO
16. **`robots.txt` points to a sitemap that does not exist.** It declares `/sitemap-index.xml`, but the build script deletes that file and ships `/sitemap.xml`.
17. **Missing assets referenced in markup:** `/apple-touch-icon.png` (404 on every page) and `/logo.png` (used in Organization and Article JSON-LD).
18. **`og-default.png` is 650 KB**, and every page shares it.
19. **`staticwebapp.config.json` has `navigationFallback` → `/index.html`.** Unknown URLs are rewritten to the homepage with a 200 instead of returning the 404 page: soft-404s, which Google treats as low quality.
20. **Sitemap `lastmod` is the build time for every URL**, so it carries no signal.
21. `Crawl-delay` is ignored by Google and blocking Ahrefs/Semrush achieves nothing for AdSense; harmless but pointless.
22. Breadcrumb names are derived from slugs ("Git Version Control", "Oop", "Html Css").

### What is already fine
- Performance 96–99, SEO 100, clean URLs, canonical tags, Open Graph tags, a themed 404 page, security headers, `ads.txt` present with the correct publisher line, Search Console and Bing verification tags in place.
- Internal links: no broken page links or anchors found across all 26 pages (only the missing icon).

## Plan of record

See `CONTENT_PLAN.md`. In short: keep the stack, replace the content model, rebuild the shell (responsive nav, search, code blocks, diagrams, trust pages), retire the 17 thin guides with 301 redirects to their new pillar hubs, and publish 40+ verified in-depth articles, C#-first.
