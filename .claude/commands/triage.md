---
description: Scan STATUS.json, the content plan, worklog and review files for undone work, score it (priority/risk/effort), and file/update `todo` GitHub issues — auto for low-risk items, ask first for high-risk ones
argument-hint: "[optional: focus area, e.g. 'algorithms' or 'shell']"
allowed-tools: Bash, PowerShell, Read, Grep, Glob, AskUserQuestion
---

You are the **pusher** (producer) in a GitHub-issue work queue. Your job: find real, undone work, **score it**, and file/update `todo` issues on `markokstate66/ComputerScienceGuideSite`, without creating duplicates or noise, and **without making risky calls on the user's behalf**.

Optional focus for this run: **$ARGUMENTS** (if empty, scan everything).

## Important
- Do **not** push code or edit files. This command only reads, scores, creates, and re-labels issues. (One exception, only when the user asks for it in this session: reconciling `docs/STATUS.json` with merged PRs, on a `chore/status-sync` branch with its own PR into `adsense-rebuild`.)
- The repository and its issues are **public**. Never put owner-private facts, secrets or email addresses in an issue.

## Scoring model: score every candidate on three axes (1–5)

| Axis | 1 (low) | 5 (high) |
|---|---|---|
| **Impact** | cosmetic / nice-to-have | blocks AdSense readiness: fewer than 40 published articles, a missing trust page, a policy violation, a broken build |
| **Effort** (reach) | one-line, config, doc, single-file | a full article through the gauntlet, a multi-page integration wave, new tooling |
| **Risk** (blast radius) | isolated, trivially reverted, draft-only | touches a `CLAUDE.md` danger zone (merge to `master`/production deploy, redirects and headers in `staticwebapp.config.json`, the contact API, analytics/consent code, `ads.txt` or any ad code, legal text) |

Derive from those:
- **Priority label**: `P0` = impact 5 **and** the site or build is broken · `P1` = impact 4–5 · `P2` = impact 3 · `P3` = impact 1–2.
- **Risk label**: `risk:low` (1–2) · `risk:med` (3) · `risk:high` (4–5).
- **Effort label**: `effort:S` (1–2) · `effort:M` (3) · `effort:L` (4–5).
- **Tie-break score** (higher = sooner): `Score = Impact*3 + Urgency − Effort − Risk`, Urgency 0–2. Report as `Score N/17`.
- For articles, Urgency is 2 when a draft or reviews already exist (finishing beats starting), 1 for wave A, 0 for wave B. An article is normally `P1 · risk:low · effort:L`.

## The autonomy gate, keyed on **Risk**

| Risk | What you do |
|---|---|
| **`risk:low`** | **Auto.** Create or update immediately. No questions. |
| **`risk:med`** | **Auto, but surfaced.** Create/update, then list it under "Filed — please glance" with a one-line risk note. |
| **`risk:high`** | **Ask first.** Do not file yet. `AskUserQuestion` (batch up to 4): file or skip, priority, scope narrowing. Recommended option first, labelled "(Recommended)". |

## Steps

0. **Ensure labels exist** (idempotent; ignore "already exists" errors): `todo`, `in-progress`, `review`, `needs-grooming`, `blocked-on-human`, `P0`–`P3`, `risk:low|med|high`, `effort:S|M|L`, `chore`, `article`, `shell`, `integration`. Colours and descriptions are listed in `.github/DEFINITION_OF_READY.md`.

1. **Gather candidate work** from:
   - `docs/STATUS.json`: articles whose `state` is `planned`, `drafted` or `in-review` and that have no open issue. **Wave A before wave B**; do not file wave B articles while wave A has unfiled ones.
   - `docs/reviews/**`: `owner: "integrator"` findings not yet fixed (check `docs/INTEGRATOR_REQUESTS.md` and `docs/SHELL_NOTES.md`).
   - `WORKLOG.md` (latest entries), `docs/INTEGRATOR_REQUESTS.md` (status `open`), `docs/NEEDS_MARKUS.md` (open rows → one `blocked-on-human` issue, not one per row), `CONTENT_PLAN.md` wave-3 and final-gate items.
   - Code markers: `TODO|FIXME|HACK` under `src/` and `tools/`.

2. **Fetch existing issues** for dedup and for re-labelling: `gh issue list --state all --limit 200 --json number,title,labels,state`. Any open issue missing `P#`/`risk:`/`effort:` is an update candidate.

3. **Dedup by meaning.** One issue per article, ever: search for the slug. When unsure whether two items are the same, treat them as the same and comment on the existing one.

4. **Filter to real work.** Actionable and substantive only.

5. **Score**, **apply the gate**, then **create / update**:
   - Article title format: `Article: <pillar>/<slug> — <working title>`; labels `todo`, `article`, `P#`, `risk:x`, `effort:x`. Body per the Definition of Ready, with the plan row's intent, shape, angle, diagrams and code copied in, the current state (no draft / draft unreviewed / round N scores), and `Verification: docs/ARTICLE_GAUNTLET.md pass bar`.
   - Other work: labels `todo`, a type (`shell` | `integration` | `chore` | `bug` | `enhancement`), `P#`, `risk:x`, `effort:x`.
   - Mark cross-dependencies in the body (`depends on #N`).

6. **Cap at 10 new issues per run.** File the 10 highest-Score and list the rest for the user. Never silently drop items.

## Output
- **Created / Updated**: title, issue #, `P# · risk:x · effort:x · Score`.
- **Filed — please glance**: the `risk:med` items.
- **Skipped**: duplicates (→ existing #), items declined at the high-risk gate, anything deferred past the cap.
- **Queue depth**: counts of `todo`, `in-progress`, `review`, `blocked-on-human`, and how many articles are published vs the 40 floor.

An empty triage run is a valid, good outcome; say so plainly.
