---
description: Producer — turn something you just described (a bug, an article idea, a task) into one well-defined, scored `todo` GitHub issue the consumer can pull
argument-hint: "<what you want done, in your own words>"
allowed-tools: Bash, PowerShell, Read, Grep, Glob, AskUserQuestion
---

You are the **producer** in the GitHub-issue work queue. GitHub issues are the hub between producer and consumer: you put exactly one ready item on it; `/work-next` takes it off. Repo: `markokstate66/ComputerScienceGuideSite`.

What the user wants: **$ARGUMENTS**

## Important
- This command **files an issue and nothing else**. Do not edit files, do not start the work, do not open a PR, even if it looks quick. (If the user clearly wants it done now, file it, then tell them to run `/work-next <N>`.)
- Issues on this repo are **public**. Never put private facts, email addresses or secrets in one.
- The readiness bar is `.github/DEFINITION_OF_READY.md`; the scoring model and the risk gate are in `.claude/commands/triage.md`. Use both verbatim.
- If `$ARGUMENTS` is empty, ask the user what they want filed (one `AskUserQuestion`), or suggest `/triage` to scan for undone work.

## Steps

1. **Dedup.** `gh issue list --state open --limit 200 --json number,title,labels,body`. If the item already exists (by meaning, not wording), comment the new context on that issue and stop. One issue per article, ever: search for the slug.

2. **Understand it.** Read enough of the repo to be concrete: real file paths, routes, tool names. Sources by type:
   - *Article idea:* `CONTENT_PLAN.md` §7 and `docs/STATUS.json`. If it is already planned, file that planned article (use its row). If it is new, make sure it is not a near-duplicate or minor keyword variant of a planned one (the brief forbids doorway pages), choose pillar, slug, target intent, shape (different from its neighbours), outline, unique angle, diagrams and runnable code, and make "add the row to `CONTENT_PLAN.md` and `docs/STATUS.json`" the first checklist step.
   - *Bug on the site or in an article:* find the page/file and reproduce what you can (`npm run build`, `tools/run-code.mjs`, `tools/verify-page.mjs`). A factual correction to a published article also needs an entry in `src/data/corrections.ts`; put that in the checklist.
   - *Shell/tooling/integration task:* check `docs/SHELL_NOTES.md`, `docs/INTEGRATOR_REQUESTS.md` and the ownership table in `CONTENT_PLAN.md` §9.

3. **Clarify only if truly blocked.** One focused `AskUserQuestion` (up to 4 questions) if you cannot write testable acceptance criteria. Otherwise choose sensible defaults and state them in the issue.

4. **Score it**: Impact / Effort / Risk 1–5 → `P#`, `risk:x`, `effort:x`, `Score N/17`. Type label: `article` | `bug` | `enhancement` | `shell` | `integration` | `chore`.

5. **Risk gate.** `risk:low` → file. `risk:med` → file, and say so in your report. `risk:high` (any `CLAUDE.md` danger zone: production/`master`, redirects and headers, contact API, analytics/consent, `ads.txt` or ad code, legal text) → **ask before filing** (file as-is / narrow the scope / file as `needs-grooming`).

6. **Write the body to the Definition of Ready** (template in `.github/DEFINITION_OF_READY.md`), plus one section the consumer must carry into its PR:

   ```text
   **Playtest (what the owner should check before merging):**
   1. <route to open, and what to look for>
   2. <…>
   ```
   Make these things a human can judge in a browser in a few minutes: routes (`/pillar/slug/`), phone width, dark mode, whether an explanation lands. Not things the tools already prove.

7. **File it:** write the body to a temp file, then
   `gh issue create --title "<title>" --body-file <tmp> --label todo --label <type> --label <P#> --label <risk:x> --label <effort:x>`
   Article titles: `Article: <pillar>/<slug> — <working title>`. If it depends on the owner, add `blocked-on-human`. If you could not make it Ready, use `needs-grooming` instead of `todo` and say what is missing.

## Output
Issue number and URL, its `P# · risk:x · effort:x · Score`, any defaults you assumed, and where it now sits in the queue (how many `todo` items rank above it). Then: "Run `/work-next` to pull the top item, or `/work-next <N>` for this one."
