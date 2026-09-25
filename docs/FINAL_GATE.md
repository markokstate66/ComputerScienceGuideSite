# Final gate (brief step 5)

Status as of 2026-09-25, branch `issue-14-final-gate-audit` (from `adsense-rebuild` at `d6b3455`). Issue #14.

**Verdict so far: the site structure and trust pages are ready; the gate is not closed.** Two things are still open: blind A/B judging (not started; split into its own issue, see below) and one article page with a reproducible Lighthouse performance failure. Every number below comes from a real run on the owner's machine; nothing is estimated.

## 1. Whole-site audit

Two parts: a mechanical crawl of the production build (`npm run build` → `dist/`, 90 HTML pages), and an independent critic (a subagent that wrote none of the content) reading the source.

### Mechanical crawl of `dist/`

| Check | Result |
|---|---|
| Pages built | 90 (67 articles, 23 other pages) |
| Click depth from `/` | depth 1: 26 pages, depth 2: 61 pages. **Nothing deeper than 2 and nothing unreachable** (excluding `/404.html`, `/search/`, `/styleguide/`, which are noindex by design) |
| Placeholder text in `<main>` (`NEEDS_MARKUS`, coming soon, lorem, TODO, TBD, placeholder, under construction) | 5 hits, **all legitimate**: an exercise stub `// TODO: fill in result[i]` in `/csharp-dotnet/generics/` (the solution follows), and prose uses of "placeholder", "under construction", "TODO" and git's rebase "todo line" |
| `NEEDS_MARKUS` markers in the built site | 0 |
| Ad units (`<ins class="adsbygoogle">`) | 0 pages |
| AdSense loader script | on all 90 pages, by the owner's decision in #139 (needed for site verification; auto ads are configured in the AdSense account). Publisher ID `ca-pub-6676281664229738` matches `public/ads.txt` |
| Article length (prose in `<main>`, code and SVG excluded) | minimum 2,506 words (`/testing/unit-testing-fundamentals/`), median 3,827 |
| Pages under 300 words | `/contact/` (163) and `/corrections/` (200). Both are trust pages whose job is short; not thin content |
| Near-duplicates (5-word shingles, Jaccard over every article pair) | highest pair 0.049; **no pair above 0.08** |
| Byline (JSON-LD `author` on articles) | "Computer Science Guide" on all 67 (owner decision: the publication is the byline) |
| Trust pages | `/about/`, `/contact/`, `/privacy/`, `/terms/`, `/editorial-policy/`, `/corrections/`: all present, all at depth 1 |

### Independent critic (source read)

**Blocking: none.**

Should fix:
- `src/pages/terms.astro:16`: code samples are covered by informal wording ("copy, run, modify and use them in your own learning and your own projects"), not a named licence. Already tracked as `docs/NEEDS_MARKUS.md` item 13 / #11. Owner decision.
- `src/pages/about.astro:11`: the lede says "written by one .NET developer", which sits slightly apart from the "byline is the publication" framing used everywhere else (JSON-LD `Organization`, `authors/markus.yaml`). Not a contradiction and no fact is invented; owner's wording call.
- `src/content/articles/complexity/zz-layout-fixture.md`: the `draft: true` layout fixture lives in a real pillar folder. It never builds into production, but it could confuse later triage.

Fine: the privacy policy covers AdSense cookies, third-party vendors, Google's partner-sites link, the EEA/UK/Swiss consent message and GPC; nothing on the site still says "no advertising"; `ads.txt` and `robots.txt` are correct; homepage, hubs and pillar blurbs promise nothing unpublished; no "In conclusion" / "In this article we will" filler. Spot-read articles (`big-o-notation`, `normalization`, `ip-addresses-and-subnets`) were judged original and substantive.

## 2. `node tools/run-code.mjs --all`

**67 / 67 articles pass.** On the full run, `algorithms/recursion.md` failed one shell block because the .NET compiler server printed `Warning: Compiler server returned unexpected response: RejectedBuildResponse` ahead of the expected stack-overflow output. That warning comes from the machine, not the article. Re-run alone after the build server was reset: `PASS algorithms/recursion.md blocks=24 executed=12`.

## 3. `node tools/verify-page.mjs --all`

Full serial run over 89 routes: **64 pass, 25 fail, and all 25 failures are Lighthouse performance < 90.** Accessibility, best practices and SEO are 100 on every page. No broken links, console errors or placeholder failures were reported.

The performance numbers from the full run are mostly noise: the machine was loaded, and even tiny pages failed (`/networking/` hub at 72, `/search/` at 84). The five worst pages were re-run on their own:

| Page | Full run | Alone |
|---|---|---|
| `/testing/test-driven-development/` | 41 | 100 |
| `/networking/tcp-vs-udp/` | 66 | 97 |
| `/networking/` | 72 | 99 |
| `/testing/unit-testing-fundamentals/` | 83 | 99 |
| `/oop-design/strategy-observer-decorator/` | 53 | **77, then 73** |

`/oop-design/strategy-observer-decorator/` fails reproducibly: total blocking time 1,350 ms, main-thread work 3.4 s. DOM size is not the cause (the TDD page has more elements and scores 100). Filed as #142.

The other 20 full-run performance failures were **not** re-run individually in this pass, so they are not yet proven green. Pages that failed in the full run: `/complexity/space-complexity/`, `/csharp-dotnet/garbage-collection/`, `/csharp-dotnet/generics/`, `/csharp-dotnet/strings-and-unicode/`, `/data-structures/heaps-and-priority-queues/`, `/data-structures/stacks-and-queues/`, `/databases/sql-injection-and-parameters/`, `/databases/transactions-and-acid/`, `/networking/how-the-internet-works/`, `/networking/http-explained/`, `/networking/tls-and-https/`, `/oop-design/dependency-injection/`, `/oop-design/four-pillars-of-oop/`, `/oop-design/solid-principles/`, `/operating-systems/cpu-scheduling/`, `/operating-systems/file-systems/`, `/operating-systems/memory-hierarchy-and-caches/`, `/search/`, `/testing/testing-pyramid-and-integration-tests/`, `/version-control/branching-and-merging/` (plus the five in the table).

## 4. Blind A/B judging

**Not run yet.** For 67 articles this means 67 search-and-fetch pairs plus judges, too much for one run under the project's token budget, so the owner chose to split it into batches of about 10 articles per `/work-next` run (7 batches). Tracked in #141. No win/loss numbers exist yet, and none are claimed here.

## 5. Cut articles

None. All 67 planned articles passed the gauntlet (`docs/STATUS.json`).

## 6. Still missing before applying to AdSense

1. Blind A/B judging for all 67 articles, with losses reported (#141).
2. Lighthouse performance on `/oop-design/strategy-observer-decorator/`, plus clean single-page re-runs of the other 20 full-run failures (#142).
3. Owner decisions (#11): licence for code samples (NEEDS_MARKUS 13); optionally the About-page lede wording. Amazon affiliate (item 10) blocks nothing.
