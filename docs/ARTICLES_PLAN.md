# Articles plan: the remaining wave-B articles

Phase 1 of the execution brief from 2026-09-24. This document turns the existing plan (`CONTENT_PLAN.md` §7, `docs/STATUS.json`, the GitHub issue queue) into modules with owners, contracts, a definition of done, a dependency graph and failure-isolation rules. It does not replace those files. `CONTENT_PLAN.md` is still the source for each article's outline, and `docs/STATUS.json` is still the source for state and scores.

## 0. Assumptions (made without asking, per the brief)

1. **17 articles, not 13.** The brief says "the remaining 13 articles", but the repo has 17 wave-B articles that are not published: 10 are drafted and in open PRs #114–#123 (issues #104–#113), and 7 have not been started. There are 13 open issues (the 10 article issues plus #11, #13 and #14), which is the likely source of the number. This plan covers all 17 so that nothing is missing. If 13 was deliberate, drop the modules you don't want. Nothing below forces them to ship.
2. **Existing machinery is reused, not rebuilt.** The brief's phase 2 asks for a verification harness. Most of it already exists: `tools/run-code.mjs` compiles and runs every code block and diffs the output, and `tools/verify-page.mjs` does private builds, desktop/mobile × light/dark screenshots, Lighthouse, links, console errors and placeholders. That script uses puppeteer-core rather than Playwright. The browsers and results are the same, so switching would only add churn. Phase 2 adds the checks that are missing (§6) as new tools next to these two scripts.
3. **The existing critic setup is kept.** Each article gets three critics (technical, AdSense, design) as in `docs/ARTICLE_GAUNTLET.md`, instead of the one critic the brief describes. Pass means **all three** ≥ 8.5, which is stricter than the brief's single ≥ 8.5. Rounds are capped at 4, and an article that fails round 4 is cut. The quality bar is the one the brief names: Microsoft Learn and Stripe's guides, plus our own best articles.
4. **"Unpublished until approved" means the change is not merged.** Pushing to `master` is the only way to deploy, and articles reach `master` only through `/ship` (the owner's approval) followed by the owner's own merge of `adsense-rebuild` into `master`. The 10 open PRs have `draft: false` in their front matter, but none of them is merged, so none is live. **Decision for the 7 new articles:** they keep `draft: true` in their PR, and `/ship` changes it to `false`. This means `docs/ARTICLE_GAUNTLET.md` step 7 and `.claude/commands/ship.md` need a one-line change, which is recorded as open item O-1 in `docs/STATUS.json` for the integrator. It is not done in this phase.
5. **No length is set by word count.** `CONTENT_PLAN.md` §7 deliberately has no word-count targets ("as thorough as the best existing result, plus our angle"). As a guide rather than a gate, the 50 published articles run from 3,169 to 9,970 words (`wc -w`, including code): the 25th percentile is 4,588, the median 5,657 and the 75th percentile 6,972. The target band is **4,000–7,000 words**. Going outside it needs a reason the critics accept. The editorial brief forbids padding to reach a number.
6. **Scope of edits.** Published articles are not edited. Fixes they need go in `docs/STATUS.json` (`publishedFixes`) for the owner to review. The one exception is `docs/crosslinks/*.md` link requests, which are applied in wave 3 as a batch, and only once the owner approves that batch (issue #13).

## 1. Modules and owners

"Owner" means the only agent role allowed to write the module's files. Each article module has exactly one writer. Critics write only their own review JSON. The integrator is the only role that touches shared/core files.

### 1.1 Core (shared) modules: integrator only

| Id | Module | Files | Reads | Writes / exposes |
|---|---|---|---|---|
| C-STYLE | Style guide and voice | `docs/EDITORIAL_BRIEF.md`, `docs/WRITER_GUIDE.md` | the brief, critic findings | the rules every writer and critic cites |
| C-GLOSS | Shared glossary and terminology | `src/content/glossary/*.yaml` (29 terms today) | `docs/INTEGRATOR_REQUESTS.md` term requests | `/glossary/#<id>` anchors; `term`, `definition`, `aliases`, `seeAlso` |
| C-TMPL | Article template and front matter | `src/content/config.ts` (schema), `src/layouts/`, `src/components/`, `src/styles/`, `tools/rehype-*`/`remark-*` | — | the front-matter contract (CONTENT_PLAN §3), callouts, code-fence contract (§3 "Code block contract"), diagram sizing |
| C-NAV | Site navigation and series navigation | `src/pages/` (hubs, `/topics/`, `/start-here/`), `src/content/pillars/*.yaml`, prev/next and "Keep reading" components | each article's `pillar`, `order`, `tags`, `prerequisites` | hub reading order, prev/next, related-by-tag, "Before you read" |
| C-LINK | Internal linking | applies `docs/crosslinks/<pillar>/<slug>.md` requests | crosslink files written by writers | links in articles, applied in wave 3 as one owner-approved batch |
| C-IMG | Images and diagrams (shared part) | `tools/make-images.mjs`, per-pillar OG images in `public/` | pillar data | OG images < 100 KB. Article diagrams are inline SVG and belong to the article module (writer guide §5) |
| C-SEO | SEO metadata | `src/layouts/BaseLayout*`, JSON-LD components, sitemap config, `robots.txt` | front matter `title`, `description`, `updated` | canonical, JSON-LD `Article`/`BreadcrumbList`, OG/Twitter, sitemap `lastmod` |
| C-TOOLS | Verification harness | `tools/run-code.mjs`, `tools/verify-page.mjs`, new `tools/check-article.mjs` (phase 2) | article files, built site | evidence under `docs/evidence/<pillar>/<slug>/` (phase 2) |
| C-STATE | Orchestration state | `docs/STATUS.json`, `WORKLOG.md`, `CHANGELOG.md` | reviews, PRs, issues | status of each module; this is the orchestrator's file, not the integrator's |

**Danger zones stay excluded.** `staticwebapp.config.json`, `api/`, analytics/consent, `public/ads.txt`, ad code and legal text are not part of any module in this plan (CLAUDE.md, "Danger zones").

### 1.2 Article modules: one writer each

Every article module owns exactly these files:

- `src/content/articles/<pillar>/<slug>.md`
- `src/assets/diagrams/<pillar>/<slug>-*.svg` (only if it uses asset files; most diagrams are inline)
- `docs/crosslinks/<pillar>/<slug>.md` (link requests for other people's articles)

Each module also has one branch (`issue-<n>-<slug>`), one issue and one PR. It reads the core modules and the published articles it builds on. The only APIs it exposes are **its route `/<pillar>/<slug>/`, its heading anchors and its `tags`**, which other articles link to and C-NAV uses. It calls nothing at runtime. Its code runs only inside `run-code`.

## 2. The 17 article modules

State as of 2026-09-24. "Scores" are the latest critic round as technical / AdSense / design, taken unrounded from `docs/reviews/`.

### 2.1 Drafted: passed the critics, waiting for the owner's playtest (10)

These already satisfy the critic gate. What's left for each is **your playtest and `/ship`**, then the wave-3 cross-links. No builder round is scheduled for them unless your playtest finds problems.

| Id | Article | Issue / PR | Round | Scores (T/A/D) | Words | Builds on (published) | Links it should gain in wave 3 |
|---|---|---|---|---|---|---|---|
| A-01 | `complexity/p-vs-np` (Q) | #104 / #121 | 2 | 9.0 / 8.8 / 9.2 | 5,518 | big-o-notation | → dynamic-programming (pseudo-polynomial subset-sum), backtracking (exact search for small n), greedy-algorithms (approximation) |
| A-02 | `data-structures/heaps-and-priority-queues` (B) | #105 / #119 | 2 | 9.2 / 9.2 / 9.3 | 6,129 | big-o-notation, arrays-and-dynamic-arrays; links dijkstra | ← greedy-algorithms (Huffman uses a priority queue) |
| A-03 | `data-structures/graphs-representation` (C) | #106 / #115 | 1 | 9.0 / 9.0 / 8.7 | 4,317 | arrays-and-dynamic-arrays, hash-tables; links BFS/DFS, dijkstra | ← backtracking (state space as an implicit graph) |
| A-04 | `data-structures/tries` (W) | #107 / #123 | 2 | 9.0 / 8.8 / 9.1 | 5,454 | binary-search, arrays-and-dynamic-arrays, binary-search-trees | → strings-and-unicode (what counts as a "character" in a trie key) |
| A-05 | `algorithms/dynamic-programming` (W) | #108 / #122 | 2 | 9.2 / 9.0 / 9.4 | 5,288 | recursion, big-o-notation, space-complexity | ← greedy-algorithms, p-vs-np |
| A-06 | `algorithms/greedy-algorithms` (D) | #109 / #114 | 1 | 9.2 / 9.1 / 9.4 | 4,557 | big-o-notation | → dynamic-programming ("greedy vs DP"), heaps-and-priority-queues (Huffman) |
| A-07 | `algorithms/backtracking` (B) | #110 / #117 | 1 | 9.3 / 9.2 / 9.3 | 4,734 | recursion | → p-vs-np (why "complexity honesty" is unavoidable), graphs-representation |
| A-08 | `oop-design/factory-builder-singleton` (C) | #111 / #116 | 2 | 9.0 / 9.0 / 9.0 | 4,119 | interfaces-vs-abstract-classes | → dependency-injection (lifetimes replace singleton) |
| A-09 | `oop-design/dependency-injection` (B) | #112 / #120 | 1 | 9.3 / 9.2 / 8.9 | 4,411 | solid-principles | ← factory-builder-singleton |
| A-10 | `csharp-dotnet/strings-and-unicode` (I) | #113 / #118 | 2 | 9.0 / 9.0 / 8.7 | 3,337 | value-types-vs-reference-types | → span-and-memory (once it exists) |

The full outline, angle, diagrams and code for each article are in its `CONTENT_PLAN.md` §7 row and in the PR itself. Target reader for all ten: `level: intermediate`, a working developer who knows C# syntax and wants the concept and how .NET does it. Sources: the `sources` front matter in each PR (≥ 2 primary sources each, checked by the technical critic).

### 2.2 Not started (7)

Target reader for all seven is the same as above unless stated otherwise. **Key claims** are what the article must establish, and each is checked against a cited primary source or proved by a run block. **Candidate sources** are real, named primary documents to start from. Writers must open each one and cite the specific page they used. Any claim that no source or runnable code can support is cut or flagged in `STATUS.json`.

#### A-11 `csharp-dotnet/exceptions`: Exception Handling That Helps You Debug (shape Q, order 7)

- **Outline** (CONTENT_PLAN §7.5 row 7): what to catch and where → `throw` vs `throw ex` (stack trace shown) → exception filters → custom exceptions → `finally`/`using` → exceptions vs result types → cost measured.
- **Target reader:** intermediate; has written `try/catch` and been confused by a stack trace that pointed at the wrong line.
- **Key claims:** `throw ex;` resets the stack trace and `throw;` preserves it (show both traces from run blocks). Filters (`catch ... when`) run before the stack unwinds. `ExceptionDispatchInfo` rethrows while keeping the original trace. `finally` runs on normal and exceptional exit. `using` lowers to `try/finally`. The cost of throwing is measured on this machine rather than asserted, and reported as "on this machine" with the setup stated.
- **Candidate sources:** Microsoft Learn "Best practices for exceptions"; C# language reference "Exception-handling statements"; `ExceptionDispatchInfo` class reference; .NET design guidelines on exceptions (Microsoft Learn).
- **Links to / builds on:** garbage-collection (`using`/`IDisposable`), async-await (exceptions through `await`), recursion (call stack). Published articles already point here: async-await, normalization, how-the-internet-works, composition-over-inheritance, testing-pyramid (`docs/crosslinks/`).
- **Risk:** stack-trace output contains paths and line numbers. Wildcard them with `[...]` so the output check is deterministic.

#### A-12 `csharp-dotnet/span-and-memory`: Span&lt;T&gt; and Memory&lt;T&gt;: Slicing Without Allocating (shape I, order 8)

- **Outline** (§7.5 row 8): substring allocations measured → `Span<T>` as a view → `ref struct` rules and the compile errors they cause (`error=` blocks) → `Memory<T>` for async → CSV-line parser, `string.Split` vs span.
- **Target reader:** intermediate to advanced; cares about allocations in hot paths.
- **Key claims:** slicing a span does not allocate (measured with `GC.GetAllocatedBytesForCurrentThread`). `ref struct` cannot be boxed, captured by lambdas or used across `await` (compile errors reproduced by diagnostic ID). `Memory<T>` is the heap-storable counterpart for async code.
- **Candidate sources:** Microsoft Learn "Memory&lt;T&gt; and Span&lt;T&gt; usage guidelines"; `Span<T>` struct reference; C# reference "ref structure types"; `GC.GetAllocatedBytesForCurrentThread` reference.
- **Depends on:** **A-10 strings-and-unicode**, which already has a short `Span<char>` section. This article must go deeper without repeating it and must link to it. Also builds on value-types-vs-reference-types, garbage-collection, space-complexity and async-await.
- **Risk:** the exact diagnostic IDs for `ref struct` misuse must come from a real compile, never from memory.

#### A-13 `databases/aggregation-and-window-functions`: GROUP BY, HAVING and Window Functions (shape R, order 6)

- **Outline** (§7.6 row 6): the GROUP BY mental model → HAVING vs WHERE → window functions (ranking, running totals, LAG/LEAD) → frames → top-N per group.
- **Target reader:** a developer who writes basic SQL and joins but reaches for application code for anything more.
- **Key claims:** logical processing order (FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY), cited. Aggregation collapses rows, and window functions keep them. The difference between the default frame and an explicit `ROWS` frame is shown with results. `RANK` vs `DENSE_RANK` vs `ROW_NUMBER` on ties. Dialect notes for SQL Server and PostgreSQL wherever they differ from SQLite.
- **Candidate sources:** SQLite documentation "Window Functions" and "SELECT"; PostgreSQL documentation "Window Functions" (tutorial and reference); SQL Server `OVER` clause reference (Microsoft Learn).
- **Builds on:** relational-model-and-keys (reuse the pillar's library schema), sql-joins (already requests a link here), indexes.
- **Risk:** `sql run` blocks run on `node:sqlite`. Only features that SQLite build supports can be run blocks; anything else is labelled illustrative and cited.

#### A-14 `databases/sql-injection-and-parameters`: SQL Injection and Parameterized Queries in .NET (shape D, order 7)

- **Outline** (§7.6 row 7): a vulnerable login exploited locally → why escaping fails → parameters → what ORMs do → least privilege.
- **Target reader:** intermediate .NET developer; knows injection is bad but not exactly why parameters fix it.
- **Key claims:** string concatenation lets the input change the query's structure (the exploit is shown against an **in-memory SQLite database only**, with no real systems, credentials or data). With parameters, the input stays data and cannot change the query's structure. Hand-written escaping is fragile. EF Core's `FromSqlInterpolated`/`FromSql` parameterize, and `FromSqlRaw` with concatenation does not (verified against the EF Core docs). Least privilege limits the damage an injection can do. It does not prevent the injection.
- **Candidate sources:** OWASP "SQL Injection Prevention Cheat Sheet"; MITRE CWE-89; Microsoft.Data.Sqlite "Parameters" docs (Microsoft Learn); EF Core "SQL Queries" docs (Microsoft Learn).
- **Builds on:** relational-model-and-keys, transactions-and-acid (the existing use of `Microsoft.Data.Sqlite` in run blocks is the model to copy), exceptions (A-11, a soft link only).
- **Risk:** security content. The exploit must be self-contained and educational, with no payloads that target real products.

#### A-15 `networking/ip-addresses-and-subnets`: IP Addresses, Subnets and CIDR (shape W, order 6)

- **Outline** (§7.7 row 6): binary addresses → masks → CIDR → computing ranges → private ranges and NAT → IPv6 essentials; the reader builds a CIDR calculator.
- **Target reader:** a developer who has typed `10.0.0.0/16` into a cloud console without being sure what it means.
- **Key claims:** an IPv4 address is 32 bits and a prefix length marks how many of them are the network part. Network, broadcast and host range are computed by bit masking, and the calculator's output matches `System.Net.IPNetwork` (.NET 8+) where that type applies. The private ranges are the ones RFC 1918 defines. CIDR replaced classful addressing. IPv6 addresses are 128 bits, with the documentation prefix `2001:db8::/32` used in the examples.
- **Candidate sources:** RFC 791 (IPv4), RFC 1918 (private address space), RFC 4632 (CIDR), RFC 8200 (IPv6), RFC 4291 (IPv6 addressing), RFC 5737 and RFC 3849 (documentation address ranges); `IPNetwork` struct reference (Microsoft Learn).
- **Builds on:** how-the-internet-works (already requests a link here), tcp-vs-udp, dns.
- **Risk:** every example address comes from a documentation range (RFC 5737 / RFC 3849), never from a real network.

#### A-16 `operating-systems/memory-hierarchy-and-caches`: The Memory Hierarchy and CPU Caches (shape I, order 6)

- **Outline** (§7.8 row 6): the latency ladder (cited) → locality → cache lines → false sharing measured → data-oriented layout (struct-of-arrays vs array-of-structs).
- **Target reader:** intermediate to advanced; has heard "cache-friendly" and wants to see it.
- **Key claims:** latency figures are cited to a source or measured on this machine and labelled that way, never copied from uncredited "latency numbers" tables. The false-sharing slowdown is measured, with padding as the fix. SoA vs AoS is measured. The cache-line size of the test machine is stated only if it is actually read from the machine (e.g. Windows `GetLogicalProcessorInformation` via P/Invoke) or cited from vendor documentation for the named CPU.
- **Candidate sources:** Intel 64 and IA-32 Architectures Optimization Reference Manual; Ulrich Drepper, "What Every Programmer Should Know About Memory" (2007); AMD software optimization guide for the relevant family; Microsoft Learn `StructLayoutAttribute` reference.
- **Builds on:** arrays-and-dynamic-arrays, which **already measures row- vs column-major traversal**. Link to it rather than re-measure, and extend to cache lines and false sharing. Also builds on virtual-memory (TLB), concurrency-race-conditions-locks and processes-and-threads. Published file-systems, processes-and-threads and virtual-memory already request links here.
- **Risk:** timing output is machine-dependent. Output blocks show ratios or `[...]` wildcards, and the text must not claim numbers the run does not print.

#### A-17 `testing/code-coverage`: Code Coverage: What the Number Means (shape D, order 6)

- **Outline** (§7.10 row 6): a 100%-coverage suite that misses a bug → line vs branch coverage → the idea of mutation testing → sensible targets.
- **Target reader:** a developer whose team has a coverage gate and suspects it measures the wrong thing.
- **Key claims:** 100% line coverage with a wrong assertion (or none) still passes, shown with a run block. Branch coverage catches cases that line coverage misses. Mutation testing measures whether the tests detect changes to the code. The case for or against "sensible targets" is argued from cited sources, not from invented industry numbers.
- **Candidate sources:** Microsoft Learn "Use code coverage for unit testing"; coverlet documentation (GitHub, coverlet-coverage/coverlet); Stryker.NET documentation; Martin Fowler, "TestCoverage" (bliki).
- **Builds on:** unit-testing-fundamentals, test-doubles, property-based-testing, testing-pyramid-and-integration-tests.
- **Risk (open question, flagged):** collecting coverage from a file-based `#:package xunit.v3` program under `run-code` is **unverified**. Coverage tools normally hook `dotnet test` or need `dotnet-coverage`. Round 1 must first prove a coverage report can be produced on this machine. If it can't, the report appears as a `console` transcript that was really produced by running the tool, and the constraint is recorded in `STATUS.json`. A coverage report must never be hand-written.

## 3. Definition of done (per module)

### 3.1 Article module

An article is done when **every** item below is true and the evidence for it exists:

1. **Contract:** it matches its `CONTENT_PLAN.md` §7 row (outline, angle, diagrams, code), or a critic has accepted the deviation with a written reason. Length is within the 4,000–7,000-word band (see assumption 5), or the critics accept why it isn't.
2. **Style and voice:** it follows `docs/EDITORIAL_BRIEF.md` and `docs/WRITER_GUIDE.md` and reads like the best published articles (e.g. `complexity/big-o-notation`, `algorithms/backtracking`). It has no filler, no "ultimate guide" framing and no ad code.
3. **Facts:** every factual claim, number and instruction is either proved by a `run` block in the article or cited to a primary source listed in `sources` (≥ 2). Nothing is invented. Claims nobody can verify are cut, or listed under the module in `STATUS.json` → `flags`.
4. **Code:** `node tools/run-code.mjs <file>` is green. Every `csharp`/`sql`/`bash` block is a `run` or `snippet of=` block.
5. **Links and images:** zero broken internal or external links and zero missing images. Every diagram has `role="img"`, `<title>` and `<desc>`, and is legible at 390 px (writer guide §5).
6. **Front matter and SEO:** schema-valid (`npm run build` green). The title is ≤ 70 characters and the description 110–160. It has 2–6 `tags` and real `prerequisites`. `published`/`updated` are real dates. **`draft: true` stays until `/ship`** (assumption 4).
7. **Renders cleanly:** `verify-page --drafts` shows zero console errors, Lighthouse ≥ 90 in all four categories on a serial run, and screenshots at desktop and mobile in light and dark. A critic must actually have **opened** those screenshots (`screenshotsOpened` in the design review).
8. **Critics:** technical, AdSense and design are each ≥ 8.5, with zero `severity: "error"` issues, within 4 rounds.
9. **Glossary:** each new term the article teaches has been requested in `docs/INTEGRATOR_REQUESTS.md`, and existing terms are used exactly as `src/content/glossary/` defines them.
10. **Approval:** you have playtested it and run `/ship`.

### 3.2 Core module

Done means that `npm run build` is green on `adsense-rebuild`, that `verify-page` is green on `/styleguide/` and on one published article from every pillar, that no published article's rendering changes except where intended (screenshots before and after), and that every request it served is marked `done` in `docs/INTEGRATOR_REQUESTS.md`.

## 4. Dependency graph

**Hard** edges block a module: it cannot pass its contract without the other module. **Soft** edges are only wave-3 links. They never block, and they are recorded as crosslink requests.

```text
Core, wave 1 (freeze before wave-1 articles start)
  C-STYLE ─┬─> every article
  C-TMPL  ─┤
  C-GLOSS ─┘   (new terms flow back to C-GLOSS through INTEGRATOR_REQUESTS)

Hard edges between articles
  A-10 strings-and-unicode ──hard──> A-12 span-and-memory
  (every other article depends only on already-published articles)

Soft edges (wave-3 links only)
  A-01 p-vs-np      ─soft─> A-05 dynamic-programming, A-07 backtracking, A-06 greedy
  A-06 greedy       ─soft─> A-05 dynamic-programming, A-02 heaps
  A-07 backtracking ─soft─> A-01 p-vs-np, A-03 graphs-representation
  A-08 factory      ─soft─> A-09 dependency-injection
  A-04 tries        ─soft─> A-10 strings-and-unicode
  A-14 sql-injection ─soft─> A-11 exceptions
  A-10 strings      ─soft─> A-12 span-and-memory (reverse link, added once A-12 exists)

Wave 3 (after every article module is done or cut)
  C-LINK, C-NAV, C-SEO, C-IMG ──> final gate (#14)
```

### Waves

| Wave | Modules | Starts when |
|---|---|---|
| 1 | C-STYLE, C-GLOSS, C-TMPL frozen for this batch (only the glossary terms listed in §5 are added); articles A-11, A-13, A-14, A-15, A-16, A-17; **owner playtest + `/ship` of A-01…A-10** (your work, not an agent's) | Phase 2 harness is green |
| 2 | A-12 span-and-memory; C-IMG (check OG images and any diagram fixes the critics raised) | A-10 has at least passed its critics (it already has). A-12 may start before A-10 is shipped and links to the route that shipping will create |
| 3 | C-LINK (apply every `docs/crosslinks/` request, which touches published articles and needs your approval of the batch), C-NAV (hub reading order, prev/next, `/start-here/`), C-SEO, full-site consistency pass; this is issue #13 | Every article module in waves 1–2 is done or cut |
| Final | whole-system critic, issue #14 | Wave 3 is done |

## 5. Glossary terms these articles need (C-GLOSS, wave 1)

These terms don't exist yet. The integrator writes each definition in its own words, pointing at the article that teaches the term: `np-complete` (A-01), `priority-queue` (A-02; `heap` exists), `adjacency-list` (A-03), `trie` (A-04), `greedy-algorithm` (A-06), `backtracking` (A-07), `design-pattern` (A-08), `dependency-injection` (A-09), `code-point` and `grapheme-cluster` (A-10), `exception` (A-11), `span` (A-12), `window-function` (A-13), `sql-injection` (A-14), `cidr` (A-15), `cache-line` and `false-sharing` (A-16), `code-coverage` and `mutation-testing` (A-17). Terms that already exist and must be used consistently include `big-o-notation`, `dynamic-programming`, `recursion`, `graph`, `heap`, `hash-table`, `value-type`, `reference-type`, `garbage-collection`, `transaction`, `primary-key`, `unit-test` and `call-stack`.

## 6. Verification loop (to build in phase 2)

Exists already, reused:

- `tools/run-code.mjs <file>` for code blocks.
- `tools/verify-page.mjs [--drafts] <route>` for the build, screenshots (desktop/mobile × light/dark), Lighthouse, links, console errors and placeholders.

To add in phase 2, as `tools/check-article.mjs <pillar/slug>`, runnable for a single article:

- word count (prose and total), the front-matter checks in §3.1 item 6, heading structure (one `h1`, no skipped levels), images without alt text / SVGs without `<title>`, external link status, glossary consistency (terms defined in `src/content/glossary` used with the same spelling), a spelling check against a project word list, and a readability score (Flesch reading ease, computed in-tool, **reported but not gated**, since technical prose scores low by nature)
- a wrapper that runs all three tools and writes `docs/evidence/<pillar>/<slug>/<date>.json` (a JSON log of the results), next to the PNGs `verify-page` already produces

Rule carried over from the brief: no agent claims a result it hasn't run and whose evidence it hasn't opened.

## 7. Failure isolation

- **One article cannot break the site.** Each article lives on its own branch and PR. `adsense-rebuild` only receives an article through `/ship`. Drafts are excluded from `npm run build`. A red `run-code` fails that article's gate, not the build.
- **One stalled article cannot block the others.** Only the hard edge A-10 → A-12 exists, and A-10 has already passed its critics. Every other ordering is soft and turns into a crosslink request. An article that fails round 4 is cut (the gauntlet rule), and its soft links are dropped from the wave-3 batch.
- **Writers can't break core.** Writers edit only their own module's files. Shared changes go through `docs/INTEGRATOR_REQUESTS.md` to the integrator, who works on a separate branch/PR and keeps `npm run build` green on `adsense-rebuild`. A core change that alters how published pages render needs before and after screenshots.
- **Merge conflicts are avoided.** Article PRs never touch `docs/STATUS.json`, `WORKLOG.md` or `CHANGELOG.md` (gauntlet step 9). Only the orchestrator writes those files.
- **Resume from the weakest module.** `docs/STATUS.json` keeps state, round, scores, history and open issues for each module, so each loop picks the lowest-scoring or furthest-behind module first rather than starting over.
- **Token budget.** Each gauntlet round costs about 0.6–0.8 M tokens (measured in the pilot). Wave 1 is six articles × up to 4 rounds, so the fan-out size is a cost decision. The default remains one issue per `/next` run unless you ask for a parallel wave.

## 8. What phase 1 did not do

- It wrote no article, changed no core file and edited no published article.
- It did not change the gauntlet or `/ship` for the `draft: true` rule (open item O-1).
- It did not build the phase-2 checker.
- It filed no issues for A-11…A-17. `/triage` or phase 3 files them.
