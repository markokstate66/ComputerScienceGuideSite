# Worklog

Newest first. Facts only: what was run, what it showed.

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
