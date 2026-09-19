# Article gauntlet (one round per run)

How an `article` issue is worked by `/work-next`. One run = **one round for one article**: a writer pass plus three independent critics. That is roughly 0.6–0.8 million tokens (measured in the pilot), so the owner controls spend by how often the consumer is run.

Rules of the road: `computerscienceguide-adsense-prompt.md` (the owner's brief), `docs/EDITORIAL_BRIEF.md` (quality rules and critic rubrics), `docs/WRITER_GUIDE.md` (mechanics), `CONTENT_PLAN.md` §7 (the article's row).

## Roles

| Role | May write |
|---|---|
| Writer | `src/content/articles/<pillar>/<slug>.md` and `docs/crosslinks/<pillar>/<slug>.md` only |
| Critic (technical, adsense, design) | `docs/reviews/<pillar>/<slug>.round-N.<critic>.json` only. Critics never edit articles |
| Consumer (the `/work-next` session) | Orchestrates, verifies, commits, pushes, comments on the issue, manages labels and the PR |

Writer and critics are separate subagents (Agent tool) so that critics judge with fresh eyes. The three critics run in parallel and do not see each other's reviews. The exact prompts that worked in the pilot are in `.claude/workflows/article-gauntlet.js` (`writerPrompt`, `criticPrompt`); reuse them verbatim, for a single round.

## One round

1. **Find the round number** N: the highest `round-N` among `docs/reviews/<pillar>/<slug>.round-*.json`, plus one; 1 if none. If the article file does not exist, this is round 1 and the writer starts from the plan row. If N > 4, the article is **cut** (see below).
2. **Branch.** `issue-<n>-<slug>` from the integration branch (see `CLAUDE.md`). If the branch already exists from an earlier round, check it out and merge the integration branch into it.
3. **Writer pass.**
   - Round 1, no draft: research and write (writer prompt, round 1).
   - Draft exists but has never been reviewed: skip the writer; go to step 4.
   - Otherwise: revise against the previous round's three reviews (writer prompt, round ≥ 2).
   The writer must leave `node tools/run-code.mjs <file>` and `npm run build` green and must look at its own screenshots.
4. **Three critics in parallel**, each writing its review JSON: `score` (one decimal), `comparedAgainst`, `justification`, `issues[]` (`severity`, `location`, `problem`, `fixLooksLike`, `owner`), plus `runCodePass` (technical) and `lighthouse`, `consoleErrors`, `brokenLinks` (design).
5. **Consumer verifies serially**, with nothing else running, because Lighthouse performance is unreliable under load:
   `node tools/run-code.mjs <file>` and `node tools/verify-page.mjs --drafts /<pillar>/<slug>/`.
   The `placeholder text: NEEDS_MARKUS` failure is expected until the owner supplies a byline (issue "Owner inputs").
6. **Decide.** Pass = all three critics ≥ 8.5, `run-code` green, zero console errors, zero broken links, Lighthouse ≥ 90 in all four categories on the serial run. Report real numbers. Never round up, never re-run a critic to fish for a better score.
7. **Record.** Commit the article, its crosslinks file and the three review files. Push the branch. Comment on the issue with a one-line score table for the round and the top open issues.
   - **Passed:** set `draft: false` and `published`/`updated` to today's date, commit, open the PR (`Closes #<n>`) into the integration branch, move the issue to `review`.
   - **Not passed, N < 4:** open or update a **draft PR** so the work is visible, then move the issue back to `todo` (remove `in-progress`). The next `/work-next` run picks up round N+1.
   - **Not passed, N = 4: cut.** Delete the article file on the branch, keep the reviews, open a PR titled "Cut: <slug> (failed 4 rounds)", and close the issue as not planned with the final scores. The brief is explicit: articles that fail four rounds are cut, not published.
8. **PR body** follows the format in `.claude/commands/work-next.md`, including the `## 🧪 Playtest instructions` numbered list (routes to open, the figure or explanation most worth a human look, phone width, dark mode) and a `## Gauntlet` section with the round's real scores. `pr-playtest.html` is generated from it. The consumer never merges; the owner runs `/ship <PR#>` after playtesting.
9. Article PRs do **not** touch `docs/STATUS.json`, `WORKLOG.md` or `CHANGELOG.md` (parallel PRs would conflict). Issue labels and `docs/reviews/` are the source of truth for in-flight work; `/triage` reconciles `STATUS.json`.

## Shell-level findings

A critic issue with `owner: "integrator"` is not the writer's to fix. The consumer files it (or comments on an existing issue) as a `shell` issue via `/groom`, and the article is not blocked on it unless it is the reason a critic scored below 8.5.
