# Changelog

User-visible and repo-visible changes. Newest first.

## Unreleased (branch `adsense-rebuild`, not deployed)

### Added
- 17 wave-B articles shipped (every planned article is now written): `complexity/p-vs-np` (#121), `data-structures/heaps-and-priority-queues` (#119), `data-structures/graphs-representation` (#115), `data-structures/tries` (#123), `algorithms/dynamic-programming` (#122), `algorithms/greedy-algorithms` (#114), `algorithms/backtracking` (#117), `oop-design/factory-builder-singleton` (#116), `oop-design/dependency-injection` (#120), `csharp-dotnet/strings-and-unicode` (#118), `csharp-dotnet/exceptions` (#132), `csharp-dotnet/span-and-memory` (#133), `databases/aggregation-and-window-functions` (#134), `databases/sql-injection-and-parameters` (#135), `networking/ip-addresses-and-subnets` (#136), `operating-systems/memory-hierarchy-and-caches` (#137), `testing/code-coverage` (#138).
- Article harness: `tools/check-article.mjs` (static editorial checks), `tools/gate.mjs` (one-command evidence gate with a machine-wide verify lock) and `tools/worktree.mjs` (safe parallel worktrees); `docs/ARTICLES_PLAN.md`. Article PRs now stay `draft: true` until `/ship` (#124).
- New site shell: content collections with a validated front matter schema, topic hubs and article pages generated from Markdown, Shiki dual-theme code blocks with attached output panels and copy buttons, callouts, "On this page" contents, theme-aware SVG diagrams with phone-width scrolling, Pagefind search, responsive header with a real mobile menu.
- Pages: Start here, Topics, Glossary (29 seed terms), Search, Editorial Policy, Corrections, Styleguide (noindex). About, Contact, Privacy and Terms rewritten.
- Three published articles, each passed by three independent critics with all code machine-verified: `complexity/amortized-analysis`, `databases/sql-joins`, `version-control/how-git-works`.
- Published article: `algorithms/binary-search` (passed round 2: technical 8.7 / AdSense 8.6 / design 8.7).
- Published article: `version-control/branching-and-merging` (passed round 2: technical 8.8 / AdSense 9.2 / design 8.5).
- Published article: `networking/how-the-internet-works` (passed round 4, its last round before a mandatory cut: technical 9.2 / AdSense 8.8 / design 8.7).
- Published article: `oop-design/four-pillars-of-oop` (passed round 3: technical 9.0 / AdSense 9.3 / design 9.0).
- Published article: `complexity/big-o-notation` (passed round 3: technical 9.4 / AdSense 9.3 / design 8.7).
- Published article: `csharp-dotnet/value-types-vs-reference-types` (passed round 1: technical 9.3 / AdSense 9.0 / design 9.0, first article in the csharp-dotnet pillar).
- Published article: `databases/relational-model-and-keys` (passed round 2: technical 8.8 / AdSense 9.3 / design 9.3).
- Published article: `testing/test-doubles` (passed round 1: technical 9.0 / AdSense 9.0 / design 9.0, first article in the testing pillar).
- Published article: `data-structures/arrays-and-dynamic-arrays` (passed round 6: technical 9.5 / AdSense 9.2 / design 9).
- Published article: `operating-systems/processes-and-threads` (passed round 3: technical 9.2 / AdSense 8.6 / design 9).
- Published article: `networking/tcp-vs-udp` (passed round 2: technical 8.5 / AdSense 8.6 / design 9).
- Published article: `data-structures/linked-lists` (passed round 2: technical 9.3 / AdSense 9.5 / design 9.2).
- Published article: `csharp-dotnet/garbage-collection` (passed round 2: technical 8.6 / AdSense 9.5 / design 9.5).
- Published article: `complexity/analyzing-loops-and-recursion` (passed round 2: technical 9.4 / AdSense 9 / design 9.2).
- Published article: `algorithms/sorting-algorithms-compared` (passed round 3: technical 9.5 / AdSense 9.2 / design 9).
- Published article: `operating-systems/concurrency-race-conditions-locks` (passed round 2: technical 9.3 / AdSense 8.8 / design 9.3).
- Published article: `version-control/rebase-vs-merge` (passed round 2: technical 9.5 / AdSense 9.1 / design 8.9).
- Published article: `databases/indexes` (passed round 2: technical 9 / AdSense 8.7 / design 8.7).
- Published article: `oop-design/composition-over-inheritance` (passed round 2: technical 9.2 / AdSense 8.8 / design 8.7).
- Published article: `testing/unit-testing-fundamentals` (passed round 2: technical 8.8 / AdSense 9 / design 9.3).
- Published article: `oop-design/solid-principles` (passed round 2: technical 9.3 / AdSense 8.9 / design 9.2).
- Published article: `operating-systems/virtual-memory` (passed round 3: technical 9 / AdSense 9 / design 9.2).
- Published article: `data-structures/stacks-and-queues` (passed round 2: technical 9 / AdSense 8.8 / design 9.3).
- Published article: `networking/http-explained` (passed round 3: technical 9 / AdSense 9.2 / design 9.3).
- Published article: `csharp-dotnet/async-await` (passed round 1: technical 9.3 / AdSense 8.9 / design 8.6).
- Published article: `complexity/space-complexity` (passed round 1: technical 9.2 / AdSense 8.7 / design 9.3).
- Published article: `algorithms/recursion` (passed round 1: technical 9.3 / AdSense 9.1 / design 9.1).
- Published article: `version-control/undoing-things-in-git` (passed round 2: technical 9.2 / AdSense 9 / design 9).
- Published article: `databases/normalization` (passed round 1: technical 8.9 / AdSense 8.8 / design 9.1).
- Published article: `testing/test-driven-development` (passed round 2: technical 9 / AdSense 9 / design 9).
- Published article: `csharp-dotnet/linq-deferred-execution` (passed round 3: technical 8.7 / AdSense 8.6 / design 9.3).
- Published article: `testing/testing-pyramid-and-integration-tests` (passed round 2: technical 9.2 / AdSense 9.2 / design 9).
- Published article: `data-structures/hash-tables` (passed round 2: technical 9.1 / AdSense 9 / design 9.3).
- Published article: `oop-design/interfaces-vs-abstract-classes` (passed round 2: technical 9 / AdSense 8.8 / design 9.3).
- Published article: `version-control/git-workflows` (passed round 2: technical 9 / AdSense 9 / design 9.1).
- Published article: `databases/transactions-and-acid` (passed round 2: technical 9 / AdSense 9 / design 9.3).
- Published article: `networking/dns` (passed round 4: technical 8.7 / AdSense 9 / design 8.6).
- Published article: `complexity/best-average-worst-case` (passed round 3: technical 8.8 / AdSense 8.7 / design 9.3).
- Published article: `operating-systems/cpu-scheduling` (passed round 2: technical 9.2 / AdSense 9 / design 9).
- Published article: `algorithms/breadth-first-and-depth-first-search` (passed round 2: technical 9.3 / AdSense 9 / design 8.8).
- Published article: `data-structures/binary-search-trees` (passed round 2: technical 9.2 / AdSense 9 / design 8.9).
- Published article: `algorithms/dijkstra-shortest-path` (passed round 2: technical 9.3 / AdSense 9 / design 9.2).
- Published article: `oop-design/strategy-observer-decorator` (passed round 1: technical 9.2 / AdSense 8.7 / design 9.4).
- Published article: `csharp-dotnet/generics` (passed round 2: technical 9.3 / AdSense 8.8 / design 9.3).
- Published article: `networking/tls-and-https` (passed round 2: technical 9 / AdSense 8.8 / design 9.4).
- Published article: `operating-systems/file-systems` (passed round 2: technical 9.1 / AdSense 8.7 / design 9.3).
- Published article: `testing/property-based-testing` (passed round 1: technical 9 / AdSense 8.7 / design 9.4).
- 17 articles remain unstarted (`state: planned` in `docs/STATUS.json`, all wave B); 50 of 67 planned articles are now published. Wave A is fully complete.
- Technical SEO: own `sitemap.xml` with real `lastmod`, corrected `robots.txt`, JSON-LD (Article with Person author, BreadcrumbList, WebSite, Organization), per-pillar OG images under 15 KB, `apple-touch-icon.png`, `logo.png`, 301s for every legacy URL, real 404.
- Tools: `tools/verify-page.mjs`, `tools/run-code.mjs`, `tools/make-images.mjs`.
- Project docs: `AUDIT.md`, `CONTENT_PLAN.md`, `WORKLOG.md`, `CLAUDE.md`, `docs/` (editorial brief, writer guide, gauntlet, status, reviews, cross-links, shell notes, redirects, owner inputs).
- GitHub issue work queue: `/triage`, `/groom`, `/work-next`, `/next`, Definition of Ready, issue forms.

### Changed
- `staticwebapp.config.json` is now written into `dist/` at build time (it was never deployed before), without the SPA `navigationFallback`.
- `tools/verify-page.mjs` now compresses its private preview responses (gzip/brotli), matching how the production host actually serves static assets; the private-build dev server previously understated Lighthouse performance for content-heavy pages.
- GA4 loads only on the production hostname, with consent defaulted to denied and not at all under GPC/DNT.
- Reading time is computed (220 wpm prose + 2 s per code line, capped per block).
- `tools/run-code.mjs` now runs file-based xUnit v3 test programs (`#:package xunit.v3@1.*`, no project or `dotnet test` needed); the `fails` flag (previously bash-only) now also applies to `csharp run` blocks, for a deliberately-red test in a TDD red/green step.

### Removed
- The 17 legacy `/guides/*` pages, `/resources/` (undisclosed affiliate links, hot-linked images), `/roadmap/`, `500.astro`, `SETUP.md`.
- The AdSense loader script and its preconnect. One marked comment in `BaseLayout.astro` shows where the verification snippet goes. `public/ads.txt` is kept.
- `@astrojs/sitemap`.
