# Worklog

Newest first. Facts only: what was run, what it showed.

## 2026-09-24 — Shipped all 17 wave-B article PRs

- At the owner's instruction ("ship all the articles"), shipped #114–#123 and #132–#138 into `adsense-rebuild` one at a time with a script following `/ship`: per PR a temporary worktree on the PR head, merge of the latest `adsense-rebuild` (shared bookkeeping conflicts took the integration branch's version; none touched an article), last-round reviews checked ≥ 8.5, `draft: true` → `false` for the 7 fan-out articles, `npm run build` and `node tools/run-code.mjs <article>` green, push, squash-merge. All 17 merged; five needed a second merge attempt because GitHub was still recomputing mergeability after the previous merge. Build grew from 73 to 90 pages.
- #121 p-vs-np 502c3ec r2 9/8.8/9.2; #119 heaps-and-priority-queues c5cc7a6 r2 9.2/9.2/9.3; #115 graphs-representation 4726b9a r1 9/9/8.7; #123 tries dc79253 r2 9/8.8/9.1; #122 dynamic-programming 17f2e7a r2 9.2/9/9.4; #114 greedy-algorithms 7126c8a r1 9.2/9.1/9.4; #117 backtracking 79b14a1 r1 9.2/9.2/9.3; #116 factory-builder-singleton 7987ae3 r2 9/9/9; #120 dependency-injection b7796bb r1 9.3/9.2/8.9; #118 strings-and-unicode d885ec3 r2 9/9/8.7; #132 exceptions fda4b1a r2 8.7/9.3/9.2; #133 span-and-memory 23a67ad r1 9.2/8.7/9.2; #134 aggregation-and-window-functions a99e52a r1 8.9/9.2/8.7; #135 sql-injection-and-parameters 62acb52 r2 9/9.2/9.3; #136 ip-addresses-and-subnets a249c56 r3 9.3/9.2/8.7; #137 memory-hierarchy-and-caches e659cf9 r2 8.8/8.7/9; #138 code-coverage ee468b4 r3 9/9/9.
- Checked afterwards: the squash merges changed nothing outside `src/content/articles`, `docs/reviews` and `docs/crosslinks`. One loss found and restored: #123's glossary request for "trie" in `docs/INTEGRATOR_REQUESTS.md` was dropped by the conflict rule; re-added here.
- `Closes #N` does not fire on a non-default base branch, so the 17 issues were closed by hand with the final scores. Totals: 67 passed, 0 in review. Not yet in production: that is the owner's `adsense-rebuild` → `master` merge.

## 2026-09-24 — Plan, article harness, and parallel fan-out of the last 7 wave-B articles

- Shipped #124 (plan, harness, draft-until-ship rule) into `adsense-rebuild` as e5b1091: head built green in a temporary worktree (73 pages), `check-article` sanity run green; worktree removed with the junction unlinked first, main `node_modules` intact.
- `docs/ARTICLES_PLAN.md` written (17 unpublished articles as modules, core modules, definition of done, dependency graph, waves). `docs/STATUS.json` extended additively.
- Harness: `tools/check-article.mjs` (0 errors on all 50 published articles), `tools/gate.mjs` (check-article + run-code + verify-page, one `gate.json`, machine-wide verify lock; tested concurrently and in a worktree), `tools/worktree.mjs` (safe removal that unlinks the `node_modules` junction first). The main checkout's `node_modules` was found completely empty at the start of the session and reinstalled with `npm ci`.
- O-1 adopted at the owner's say-so: article PRs keep `draft: true`; `/ship` flips it (gauntlet, work-next, ship updated).
- At the owner's request ("lets fan them"), ran the 7 not-started articles (#125–#131) as one workflow in 7 worktrees: 70 subagents (Sonnet writers/critics, Haiku checkpoint commits), 9.64M subagent tokens, about 2 h 6 min. All 7 passed within 3 rounds: exceptions r2 (8.7/9.3/9.2), span-and-memory r1 (9.2/8.7/9.2), aggregation-and-window-functions r1 (8.9/9.2/8.7), sql-injection-and-parameters r2 (9.0/9.2/9.3), ip-addresses-and-subnets r3 (9.3/9.2/8.7), memory-hierarchy-and-caches r2 (8.8/8.7/9.0), code-coverage r3 (9.0/9.0/9.0). Round-1 failures included a fabricated Fowler quote and a flaky test block in code-coverage, both caught by critics and fixed.
- Orchestrator then ran `node tools/gate.mjs` serially on each branch: all 7 GATE PASS, Lighthouse 98–100 performance and 100 on the other three categories, 0 console errors, 0 broken links. Spot-opened two screenshots. PRs #132–#138 opened into `adsense-rebuild` (all based on #124), issues moved to `review`.
- Side effect: the code-coverage writer installed `dotnet-coverage` as a global .NET tool on this machine.

## 2026-09-23 — Second production deploy: 7 wave-A articles + the virtual-memory hotfix

At the owner's explicit instruction, following the same pattern as the first deploy (batch merge, no individual playtest).

- Merged PRs #97-#103 (strategy-observer-decorator, dijkstra-shortest-path, generics, tls-and-https, property-based-testing, binary-search-trees, file-systems) into `adsense-rebuild` via `gh pr merge --squash --delete-branch`. All 7 reported `CLEAN`/`MERGEABLE` beforehand; all 7 merged without conflict.
- `npm ci` (main checkout's `node_modules` had emptied out again, same junction-fragility pattern seen earlier this session -- reinstalled, 448 packages) then `npm run build`: green, 73 pages (up from 66). Sanity-checked the generated `staticwebapp.config.json` for the duplicate-route bug that broke the first deploy: 27 routes, 0 duplicates, `trailingSlash` correctly absent.
- Fast-forwarded `master` to `adsense-rebuild` (which already carried the earlier virtual-memory `draft: false` hotfix from this same session) and pushed. Deploy succeeded on the first attempt this time -- no repeat of the first deploy's config validation failures, since the underlying `staticwebapp.config.json` bugs were already fixed and this push didn't touch that file again.
- **Verified live via curl** against `www.computerscienceguide.com`: two of the new articles (`/data-structures/binary-search-trees/`, `/operating-systems/file-systems/`) both return 200; `/operating-systems/virtual-memory/` (the earlier hotfix) now also returns 200, confirming the silent-missing-page gap from the first deploy is closed; homepage still 200.
- `docs/STATUS.json` reconciled from the real per-round review JSON files now on disk for all 7 articles (each cross-checked: round count, final scores, Lighthouse from the last design review, open issues). Totals: passed 43 -> 50, notStarted 24 -> 17. **Wave A is now fully complete** -- every remaining unstarted article is wave B.
- `CHANGELOG.md`: one line per newly-published article.
- Did not re-run `pr-playtest.html`/issue-closing bookkeeping in this entry; that follows immediately after in a separate commit per article-issue-closing convention.

## 2026-09-23 — First production deploy (issue #15): merged `adsense-rebuild` into `master`

At the owner's explicit instruction. Owner confirmed proceeding despite low current traffic and accepted the batch-merge deviation from the normal playtest gate for this session's earlier 32-article merge (see the 2026-09-22 batch-merge entry).

**Before merging**, closed the "obviously broken" gap the owner flagged: every article byline, the footer copyright, and the About page showed a literal `NEEDS_MARKUS(#n: ...)` marker. Fixed without inventing any fact: attributed to the publication name ("Computer Science Guide") instead of a person, omitted the bio paragraph. The owner then supplied real facts for Privacy/Terms/Contact (a `CLAUDE.md` danger zone, edited only after this explicit confirmation): legal operator Summit Technology Group LLC (stgengineer.com), contact mark@stgengineer.com, governing law Colorado, contact-form retention policy, and confirmed GA4 property `G-08FYJQ54RN`. Consent-management platform left honestly unresolved (owner will choose one once AdSense accepts the site). `docs/NEEDS_MARKUS.md` updated to reflect real status per item.

**Deploy took 3 attempts** — the config had never actually been deployed before (`docs/SHELL_NOTES.md` item 2), so none of this was previously testable:
1. First push failed at Azure's config validation: `staticwebapp.config.json` listed every legacy redirect twice (without and with a trailing slash) plus `trailingSlash: "always"`. Azure's route *matching* already ignores trailing-slash differences regardless of that setting, so the two entries per path always matched the same requests and Azure rejected the second as a literal duplicate.
2. Second attempt: removed the no-slash duplicates but also removed `trailingSlash: "always"` and tried restoring all 46 entries in the same push — reintroduced the identical duplicate-route error, because nothing about removing `trailingSlash` changes how Azure matches routes.
3. Third attempt (shipped): single entry per path (slash form, 27 routes total) **and** `trailingSlash` removed entirely. This combination was needed for a second reason discovered live: `trailingSlash: "always"` also canonicalizes *any* unmatched request, including real static files with no route rule — `/robots.txt`, `/sitemap.xml` and `/404.html` were each 301-redirecting to a slash-suffixed path that doesn't exist. Confirmed via direct `curl` against `www.computerscienceguide.com` before and after each attempt.

**Post-deploy verification** (curl against `www.computerscienceguide.com` — the bare `computerscienceguide.com` domain forwards there via Squarespace DNS, expected and already correctly handled by `SITE.productionHosts`):
- `/robots.txt` → 200, real content, correct `Sitemap:` line. `/sitemap.xml` → 200, `Content-Type: application/xml`, real URLs with real `lastmod` dates.
- Every legacy redirect in `docs/REDIRECTS.md` → 301 to its listed target, confirmed **both with and without** the trailing slash (Azure's route matching normalizes this at match time, independent of any `trailingSlash` setting — corrected a wrong assumption written into `docs/REDIRECTS.md` earlier in this same session and then fixed once verified live).
- Unknown URL → real 404 (custom 404 page, not a 200 fallback to the homepage). `/404.html` visited directly → 200 with `X-Robots-Tag: noindex`. `/styleguide/` and `/search/` → both `noindex`.
- Security headers present on every response checked (`Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`).
- GA4 loads client-side only (confirmed the compiled `_assets/hoisted.*.js` bundle contains the real property ID, the `productionHosts` check, and the GPC/DNT opt-out check — invisible to a plain `curl` since it's injected after page load, not present in server-rendered HTML).
- `.github/ISSUE_TEMPLATE/*.yml` (article, bug, task, config) present on `master`, which is confirmed as the repo's default branch, so GitHub's issue-creation UI should now offer them.

`adsense-rebuild` fast-forwarded to match `master` after each fix so the two branches stay in sync going forward.

**Known limitation, not blocking:** none found — every acceptance criterion in issue #15 was verified live and passed on the third deploy.

## 2026-09-22 — Batch merge: 32 articles + 1 tooling PR, all open PRs cleared

- At the owner's explicit instruction ("let's merge it all"), merged all 33 open PRs into `adsense-rebuild` in one pass, skipping the normal per-PR playtest gate for this batch. Confirmed first that every open PR targeted `adsense-rebuild` (none targeted `master`), none were drafts, and `gh pr list` reported all 33 as `CLEAN`/`MERGEABLE` before merging any of them.
- Squash-merged #21, #24, #37–#41, #42, #43–#46, #48, #59–#68, #79–#88 (32 articles across every pillar plus the `verify-page` compression-bug tooling PR), branches deleted, 10 leftover worktrees from this session's own Batch 3 removed.
- Discovered mid-batch: PR #42 (my own, "verify-page: fix response compression never actually applying") duplicated an already-open, already-validated PR #42... no — duplicated PR #42 was original; my newly-opened PR #89 duplicated it. Closed #89 as a duplicate before merging, merged #42 instead. Root cause was the same as #26's original fix (`sirv` sets headers via a direct `res.writeHead(code, headers)` call, bypassing `res.setHeader()`), #42 fixed it properly by intercepting `writeHead` itself.
- **Post-merge verification:** `npm ci` (main checkout's `node_modules` had emptied out again, same junction-fragility pattern as earlier in the session — reinstalled, 448 packages), then `npm run build`: green, 65 pages.
- **`docs/STATUS.json` reconciliation:** built from the real per-round review JSON files on disk under `docs/reviews/` wherever available (240 files), cross-checked against each merged PR's own "## Gauntlet" summary. Found 4 articles whose passing-round review JSON files were missing from disk despite the PR recording a real pass: `operating-systems/virtual-memory` (rounds 2–3), `version-control/undoing-things-in-git` (round 1), `testing/testing-pyramid-and-integration-tests` (round 1 design — from earlier in this session, before the visible window), and `operating-systems/cpu-scheduling` (round 2 — my own mistake this session: committed the `draft: false` flip without the round-2 review JSON files before deleting the worktree). For all 4, used the real scores recorded in the PR body at merge time (not fabricated — genuinely subagent-verified results, just not persisted to the expected file path) and flagged the gap explicitly in each entry's `openIssues`.
- Also found and removed 4 stray untracked review JSON files sitting in the **main checkout** (not any worktree) — leftover phantom-writes from critics that wrote to the wrong working directory earlier this session, including the file that explains an earlier `hash-tables` "phantom write" mystery from mid-session (the critic's file did exist, just not where anyone was looking).
- `docs/STATUS.json` totals: passed 11 → 43, notStarted 54 → 24 (of 67 planned).
- `CHANGELOG.md`: one line per newly-published article under Unreleased/Added.
- Did not run a fresh serial Lighthouse pass on all 32 articles post-merge — each was already verified individually (serially, by the consumer) before its own PR was opened; this entry does not re-assert those numbers, `docs/STATUS.json` carries them per-article.
- **Known deviation from the normal process, disclosed to the owner before merging and explicitly confirmed:** none of these 33 PRs were played through `pr-playtest.html` by the owner first, which `CLAUDE.md` and the `/ship` skill both otherwise require. The owner chose the full-batch scope after being asked to confirm it (vs. a narrower "just this session's 11" option).

## 2026-09-22 — `/ship 47`: run-code xUnit support merged

- PR #47 squash-merged into `adsense-rebuild`, branch deleted, issue #12 closed. Tooling change, not an article — no gauntlet round.
- `tools/run-code.mjs` now runs file-based xUnit v3 test programs (`#:package xunit.v3@1.*`, no project/`dotnet test`). The `fails` flag (previously bash-only) now also applies to `csharp run` blocks, so a deliberately-red test (a TDD red step) can exit non-zero without failing the check.
- Verified before merge: `npm run build` green (32 pages), `node tools/run-code.mjs tools/fixtures/run-code-selftest.md` reports exactly its 3 planted failures (two new xUnit blocks — one passing, one deliberately-red via `fails` — both verify correctly), `node tools/run-code.mjs --all` green across all 14 published articles.
- Unblocks issue #29 (`testing/unit-testing-fundamentals`), which was the only `todo` item waiting on this.

## 2026-09-22 — `/ship 25`: testing/test-doubles merged

- PR #25 squash-merged into `adsense-rebuild`, branch deleted, issue #10 closed. Round 1 gauntlet result: technical 9.0 / AdSense 9.0 / design 9.0, all ≥ the 8.5 bar. First published article in the testing pillar.
- Verified before merge: `npm run build` green (32 pages), `node tools/run-code.mjs src/content/articles/testing/test-doubles.md` PASS (blocks=22, executed=4).
- Serial `verify-page` Lighthouse (owner-facing, run earlier by the consumer with nothing else running): 91/100/100/100. Only failure was the expected `NEEDS_MARKUS` byline placeholder.
- `docs/STATUS.json` totals: passed 10 → 11, drafted 3 → 2.

## 2026-09-22 — `/ship 23`: databases/relational-model-and-keys merged

- PR #23 squash-merged into `adsense-rebuild`, branch deleted, issue #8 closed. Round 2 gauntlet result: technical 8.8 / AdSense 9.3 / design 9.3, all ≥ the 8.5 bar.
- Verified before merge: `npm run build` green (30 pages), `node tools/run-code.mjs src/content/articles/databases/relational-model-and-keys.md` PASS (blocks=72, executed=42).
- Serial `verify-page` Lighthouse (owner-facing, run earlier by the consumer with nothing else running): 97/100/100/100. Only failure was the expected `NEEDS_MARKUS` byline placeholder.
- `docs/STATUS.json` totals: passed 9 → 10, drafted 4 → 3.

## 2026-09-22 — `/ship 22`: csharp-dotnet/value-types-vs-reference-types merged

- PR #22 squash-merged into `adsense-rebuild`, branch deleted, issue #7 closed. Round 1 gauntlet result: technical 9.3 / AdSense 9.0 / design 9.0, all ≥ the 8.5 bar. First published article in the csharp-dotnet pillar.
- Verified before merge: `npm run build` green (29 pages), `node tools/run-code.mjs src/content/articles/csharp-dotnet/value-types-vs-reference-types.md` PASS (blocks=34, executed=19).
- Serial `verify-page` Lighthouse (owner-facing, run earlier by the consumer with nothing else running): 96/100/100/100. Only failure was the expected `NEEDS_MARKUS` byline placeholder.
- `docs/STATUS.json` totals: passed 8 → 9, drafted 5 → 4.
- Known open issue, not a merge blocker: the "Find the lost update" exercise prints its output before the collapsed solution, unlike the article's other three exercises.

## 2026-09-22 — `/ship 26`: verify-page compression fix merged

- PR #26 squash-merged into `adsense-rebuild`, branch deleted. Not an article; no issue closed (related to #6, does not resolve it alone).
- `tools/verify-page.mjs` served its private preview build uncompressed via `sirv({ dev: true })`; wrapped it with gzip/brotli negotiation (`node:zlib`, no new dependency).
- Verified before merge: `npm run build` green (27 pages), run-code self-test still reports exactly its three planted failures.
- Re-measured `data-structures/arrays-and-dynamic-arrays` (the article whose round-4 gauntlet failed on Lighthouse) with the fix: 90, 88, 91 across three runs, versus 87/79/78 before. Real improvement, still borderline for that specific article — not re-scored or republished.

## 2026-09-21 — `/ship 20`: complexity/big-o-notation merged

- PR #20 squash-merged into `adsense-rebuild`, branch deleted, issue #5 closed. Round 3 gauntlet result: technical 9.4 / AdSense 9.3 / design 8.7, all ≥ the 8.5 bar.
- Verified before merge: `npm run build` green (27 pages), `node tools/run-code.mjs src/content/articles/complexity/big-o-notation.md` PASS (blocks=26, executed=10).
- Serial `verify-page` Lighthouse (owner-facing, run earlier by the consumer with nothing else running): 93/100/100/100. Only failure was the expected `NEEDS_MARKUS` byline placeholder.
- `docs/STATUS.json` totals: passed 7 → 8, drafted 6 → 5.

## 2026-09-21 — `/ship 19`: oop-design/four-pillars-of-oop merged

- PR #19 squash-merged into `adsense-rebuild`, branch deleted, issue #2 closed. Round 3 gauntlet result: technical 9.0 / AdSense 9.3 / design 9.0, all ≥ the 8.5 bar.
- Verified before merge: `npm run build` green (26 pages), `node tools/run-code.mjs src/content/articles/oop-design/four-pillars-of-oop.md` PASS (blocks=29, executed=15).
- Serial `verify-page` Lighthouse (owner-facing, run earlier by the consumer with nothing else running): 95/100/100/100. Only failure was the expected `NEEDS_MARKUS` byline placeholder.
- `docs/STATUS.json` totals: passed 6 → 7, inReview 1 → 0.
- Note for the record: this article's round 3 was redone once mid-session after an orchestration mistake discarded the first round-3 writer pass (a stray `git checkout` reverted uncommitted edits). The scores shipped here are from the clean redo, verified against the file as committed.

## 2026-09-21 — `/ship 18`: networking/how-the-internet-works merged

- PR #18 squash-merged into `adsense-rebuild`, branch deleted, issue #3 closed. Round 4 gauntlet result (its last round before a mandatory cut): technical 9.2 / AdSense 8.8 / design 8.7, all ≥ the 8.5 bar.
- Verified before merge: `npm run build` green (24 pages), `node tools/run-code.mjs src/content/articles/networking/how-the-internet-works.md` PASS (blocks=24, executed=11).
- Serial `verify-page` Lighthouse (owner-facing, run earlier by the consumer with nothing else running): 95/100/100/100. Only failure was the expected `NEEDS_MARKUS` byline placeholder.
- `docs/STATUS.json` totals: passed 5 → 6, inReview 2 → 1.

## 2026-09-21 — `/ship 17`: version-control/branching-and-merging merged

- PR #17 squash-merged into `adsense-rebuild`, branch deleted, issue #4 closed. Round 2 gauntlet result: technical 8.8 / AdSense 9.2 / design 8.5, all ≥ the 8.5 bar.
- Verified before merge: `npm run build` green (22 pages), `node tools/run-code.mjs src/content/articles/version-control/branching-and-merging.md` PASS (blocks=55, executed=28).
- Serial `verify-page` Lighthouse (owner-facing, run earlier by the consumer with nothing else running): 97/100/100/100. Only failure was the expected `NEEDS_MARKUS` byline placeholder.
- `docs/STATUS.json` totals: passed 4 → 5, inReview 3 → 2.

## 2026-09-21 — `/ship 16`: algorithms/binary-search merged

- PR #16 squash-merged into `adsense-rebuild`, branch deleted, issue #1 closed. Round 2 gauntlet result: technical 8.7 / AdSense 8.6 / design 8.7, all ≥ the 8.5 bar.
- Verified before merge: `npm run build` green (21 pages), `node tools/run-code.mjs src/content/articles/algorithms/binary-search.md` PASS (blocks=31, executed=15).
- Serial `verify-page` Lighthouse (owner-facing, run earlier by the consumer with nothing else running): 94/100/100/100. Only failure was the expected `NEEDS_MARKUS` byline placeholder.
- `docs/STATUS.json` totals: passed 3 → 4, inReview 4 → 3.

## 2026-09-18 (continued) — batch 1 stopped, work moved to a GitHub issue queue

- The owner asked to stop before hitting the usage limit again. Batch 1 was stopped mid-run. State at the stop, all verified by the orchestrator afterwards with no agents running:
  - All ten round-1 drafts exist, all `draft: true` (none can publish). Production build green at 19 pages; drafts build green at 37 pages.
  - `run-code` is green on nine of the ten. `version-control/branching-and-merging` **fails**: its round-2 writer was interrupted mid-edit and left an output block containing the literal text `PLACEHOLDER` (near line 624).
  - Four articles got a full round-1 review (technical / AdSense / design): `binary-search` 8.3 / 8.3 / 8.5; `how-the-internet-works` 7.0 / 8.6 / 8.3; `four-pillars-of-oop` 7.0 / 8.7 / 8.2; `branching-and-merging` 7.0 / 9.0 / 8.3. None passed. Three of the four technical scores are capped at 7 by factual errors the editors found.
  - Six drafts have **not been reviewed by anyone**: `big-o-notation`, `arrays-and-dynamic-arrays`, `value-types-vs-reference-types`, `relational-model-and-keys`, `processes-and-threads`, `test-doubles`.
- Set up the producer/consumer issue queue the owner uses on other repos (modelled on `WheelOfFoodMAUI`): `/triage` and `/groom` file scored `todo` issues, `/work-next` (alias `/next`) claims one, works it on a branch and opens a PR into `adsense-rebuild`. Adapted so that one `/work-next` run on an article does exactly **one gauntlet round** (about 0.6–0.8 M tokens), which makes spend predictable. Files: `CLAUDE.md`, `.claude/commands/*`, `.claude/workflows/article-gauntlet.js` (the prompts that worked in the pilot), `docs/ARTICLE_GAUNTLET.md`, `.github/DEFINITION_OF_READY.md`, `.github/ISSUE_TEMPLATE/*`.
- Committed everything to `adsense-rebuild` and pushed that branch so PRs have a base. `master` is untouched; nothing was deployed.

### Not done / left for next session
- 54 planned articles not started; 4 in review; 6 drafted but unreviewed. Floor is 40 published; 3 are.
- Wave 3 (hubs, cross-links from `docs/crosslinks/`, glossary reconciliation, learning paths, homepage) not started.
- Final gate (whole-site AdSense audit, blind A/B judging against the top Google result) not started.
- `tools/run-code.mjs` cannot run xUnit projects yet; `testing/unit-testing-fundamentals`, `test-driven-development` and `testing-pyramid-and-integration-tests` depend on it.
- Production behaviour of redirects, security headers and the real 404 status is unverified until the first deploy.
- 13 owner inputs open in `docs/NEEDS_MARKUS.md`; every article page fails `verify-page` on the byline placeholder until #1 is supplied.

## 2026-09-18 (continued) — pilot rounds 2–3, batch 1 launched

- Integrator fixed all ten shell findings (details in `docs/SHELL_NOTES.md`, "Wave 2 shell fixes"). Orchestrator spot-checked the light-theme nested output panels and the scroll fade in a 390 px screenshot. Reading times for the pilots dropped from 29–33 min to 22–23 min under the new formula.
- **Pilot result: 3 of 3 passed.** Final critic scores (technical / AdSense / design): `amortized-analysis` 9.1 / 8.9 / 8.6 in round 2; `sql-joins` 9.0 / 9.0 / 8.7 in round 2; `how-git-works` 7.0 / 8.9 / 8.8 in round 2 (technical editor reproduced one more false claim: `git switch` between two branches on the same commit still rewrites `HEAD` and appends to the reflog), then 8.8 / 9.0 / 9.0 in round 3.
- Orchestrator's own serial verification after the pass: `run-code` green on all three (9, 33 and 26 blocks executed); Lighthouse 98/100/100/100, 95/100/100/100, 98/100/100/100; zero console errors and broken links; only failure is the byline `NEEDS_MARKUS` placeholder. Looked at the sql-joins mobile rendering: figure legible and original.
- Record-keeping caveat: on resume, the round-1 critics were not served from cache and re-ran against articles that the interrupted round-2 writers had already half-edited, overwriting `docs/reviews/*.round-1.*.json`. The original round-1 scores are the ones in the table below and in `STATUS.json` history; the round-1 files on disk are the re-run (for example `how-git-works` technical 5.0 with `run-code` failing, caused by my mid-round change to shell-session handling).
- The three articles were flipped to `draft: false`. Production build: 19 pages.
- **Batch 1 of wave A launched** (10 articles: the first article of nine pillars plus `testing/test-doubles`). `testing/unit-testing-fundamentals` is held back until the code runner can execute xUnit projects.
- Cost note: the pilot used about 5.2 million subagent tokens for three articles (two to three rounds each).

## 2026-09-18 (continued) — pilot round 1

Real scores, nothing rounded. **No article passed round 1.** All code ran (`run-code` green for all three, confirmed independently by the technical editors), zero console errors, zero broken links, Lighthouse 97–98/100/100/100.

| Article | Technical | AdSense | Design | Why it did not pass |
|---|---:|---:|---:|---|
| `complexity/amortized-analysis` | 8.8 | 8.7 | 8.1 | Both diagrams and a key table clipped at 390 px; sources listed but not cited inline |
| `databases/sql-joins` | 8.7 | 8.6 | 8.0 | Exercise showed its own answer; diagram labels ~7.5 px on phones; light-theme output panels unreadable inside callouts (shell bug) |
| `version-control/how-git-works` | 7.0 | 8.7 | 8.3 | Four factual over-generalisations found by testing (e.g. `git branch` creates two files, not one; commits can carry extra headers); example depended on the harness's `init.defaultBranch` |

Round-2 writers did not run: the session hit its usage limit. Resumed after the user confirmed tokens were back.

What the pilot changed in the process:
- Shell-level findings (light-theme callout output panels, no scroll affordance, inflated reading time of "29–33 min" for ~3,300 words, TOC dropping `#` from "C#", inline code breaking mid-token, dead-end article endings, diagram phone rules) sent to an integrator agent.
- `tools/run-code.mjs`: shell blocks now share one session (working directory carries over), so articles no longer need an artificial `cd` at the top of every block. Self-test extended; still exactly the three planted failures.
- `docs/EDITORIAL_BRIEF.md`: added "Lessons from the pilot round" (test generalisations, do not depend on harness config, cite where the claim is made, do not give away exercise answers, vary endings, phone-width rules, cross-link file for unpublished siblings).
- Critics in later rounds must form a fresh judgement first, then check that previous blockers were truly fixed.

## 2026-09-18

- Read `computerscienceguide-adsense-prompt.md`. Created branch `adsense-rebuild` (pushes to `master` auto-deploy, so all work stays off it). Nothing has been committed or pushed.
- **Audit.** Built the existing site (26 pages, 2.4 s). Measured prose word counts, links, Lighthouse and screenshots. Median guide is 485 words; Lighthouse best-practices is 77 on every page; mobile header overflows; robots.txt points at a sitemap the build deletes; affiliate links undisclosed; AdSense loader already in the layout. Full findings in `AUDIT.md`.
- **Plan.** Wrote `CONTENT_PLAN.md`: keep Astro + Azure SWA, move to content collections, 10 pillars, 67 planned articles (50 in wave A), C#-first, SQLite for SQL. Python is not installed on this machine, so no Python samples.
- **Verification tools.**
  - `tools/verify-page.mjs`: private build, local server, 4 full-page + 4 above-the-fold screenshots per page (desktop/mobile × light/dark), Lighthouse, internal + optional external link check, word count, console/network error log, placeholder scan, mobile overflow check. Tested on 4 pages of the old site; all 4 correctly FAIL.
  - `tools/run-code.mjs`: extracts fenced blocks and runs them (`dotnet run` file-based C#, SQLite via `node:sqlite`, Git Bash with pinned identity/dates). Compares stdout with the article's `text output` block. Self-test fixture `tools/fixtures/run-code-selftest.md` exercises pass paths plus three deliberate failures. On its first run the tool caught a real arithmetic error I had made in the fixture (claimed 7, program printed 8).
- Wrote `docs/NEEDS_MARKUS.md` (12 open items).
- **Wave 1 (site shell)** built by the integrator agent: content collections, hub/article routes, Shiki dual-theme code blocks with output panels and copy buttons, callouts, TOC, themed SVG diagram classes, Pagefind search, six trust pages, sitemap/robots/JSON-LD/OG images, legacy redirects, AdSense loader removed, GA4 limited to the production hostname with consent defaulted to denied. 17 legacy guides, `/resources/` and `/roadmap/` deleted. Details and assumptions in `docs/SHELL_NOTES.md`.
  - Independently re-verified by the orchestrator: `/`, `/styleguide/`, `/privacy/`, fixture article all Lighthouse 100/100/100/100, zero console errors, zero broken links, no mobile overflow. `/privacy/` and the fixture FAIL only on the intended `NEEDS_MARKUS` placeholder check. Screenshots inspected (desktop light, mobile dark, homepage dark).
  - Finding from the integrator worth knowing: the root `staticwebapp.config.json` was never deployed (the workflow uploads `dist/` only), so the old security headers were not live either. The build now writes the config into `dist/`. Redirects, headers and the real 404 status can only be confirmed after a deploy.
- **Tool fix:** full-page mobile screenshots of long pages exceeded Chrome's 16384 px limit (content repeated) and were unreadable when scaled. `verify-page` now writes numbered segments (`<device>-<theme>-partNN.png`) plus the fold.
- Wrote `docs/EDITORIAL_BRIEF.md` (writer rules, critic rubrics) and generated `docs/STATUS.json` from the plan (67 articles, 50 in wave A).
- **Pilot gauntlet launched** on three articles chosen to exercise each executed language: `complexity/amortized-analysis` (C#), `databases/sql-joins` (SQLite), `version-control/how-git-works` (Git Bash). One writer + three critics per round, max 4 rounds. Deviation from the brief, deliberate: one writer per *article* (confined to its pillar folder) rather than one per pillar, because five deep articles do not fit one agent's context. Critics' Lighthouse performance numbers are advisory while agents run in parallel; the orchestrator re-runs Lighthouse serially before recording a pass.
