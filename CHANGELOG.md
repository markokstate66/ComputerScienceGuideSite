# Changelog

User-visible and repo-visible changes. Newest first.

## Unreleased (branch `adsense-rebuild`, not deployed)

### Added
- New site shell: content collections with a validated front matter schema, topic hubs and article pages generated from Markdown, Shiki dual-theme code blocks with attached output panels and copy buttons, callouts, "On this page" contents, theme-aware SVG diagrams with phone-width scrolling, Pagefind search, responsive header with a real mobile menu.
- Pages: Start here, Topics, Glossary (29 seed terms), Search, Editorial Policy, Corrections, Styleguide (noindex). About, Contact, Privacy and Terms rewritten.
- Three published articles, each passed by three independent critics with all code machine-verified: `complexity/amortized-analysis`, `databases/sql-joins`, `version-control/how-git-works`.
- Published article: `algorithms/binary-search` (passed round 2: technical 8.7 / AdSense 8.6 / design 8.7).
- Published article: `version-control/branching-and-merging` (passed round 2: technical 8.8 / AdSense 9.2 / design 8.5).
- Published article: `networking/how-the-internet-works` (passed round 4, its last round before a mandatory cut: technical 9.2 / AdSense 8.8 / design 8.7).
- Ten draft articles (`draft: true`, excluded from the build): see `docs/STATUS.json`.
- Technical SEO: own `sitemap.xml` with real `lastmod`, corrected `robots.txt`, JSON-LD (Article with Person author, BreadcrumbList, WebSite, Organization), per-pillar OG images under 15 KB, `apple-touch-icon.png`, `logo.png`, 301s for every legacy URL, real 404.
- Tools: `tools/verify-page.mjs`, `tools/run-code.mjs`, `tools/make-images.mjs`.
- Project docs: `AUDIT.md`, `CONTENT_PLAN.md`, `WORKLOG.md`, `CLAUDE.md`, `docs/` (editorial brief, writer guide, gauntlet, status, reviews, cross-links, shell notes, redirects, owner inputs).
- GitHub issue work queue: `/triage`, `/groom`, `/work-next`, `/next`, Definition of Ready, issue forms.

### Changed
- `staticwebapp.config.json` is now written into `dist/` at build time (it was never deployed before), without the SPA `navigationFallback`.
- GA4 loads only on the production hostname, with consent defaulted to denied and not at all under GPC/DNT.
- Reading time is computed (220 wpm prose + 2 s per code line, capped per block).

### Removed
- The 17 legacy `/guides/*` pages, `/resources/` (undisclosed affiliate links, hot-linked images), `/roadmap/`, `500.astro`, `SETUP.md`.
- The AdSense loader script and its preconnect. One marked comment in `BaseLayout.astro` shows where the verification snippet goes. `public/ads.txt` is kept.
- `@astrojs/sitemap`.
