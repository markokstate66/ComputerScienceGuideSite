# Definition of Ready

An issue may carry the `todo` label only when a consumer (`/work-next`) can execute it without guessing. Raw intake from the issue forms lands as `needs-grooming`; `/groom` promotes it.

## An issue is Ready when it has

1. **Why**: one line on the impact (what it unblocks for AdSense readiness, or what is broken).
2. **Acceptance criteria**: observable, testable conditions for done.
3. **Checklist**: concrete steps naming real files, routes and tools in this repo.
4. **Verification**: how done is confirmed *here* (`npm run build`, `tools/run-code.mjs`, `tools/verify-page.mjs`, the gauntlet pass bar), or an explicit "cannot be verified locally: needs a deploy / the owner".
5. **Score**: `P#`, `risk:x`, `effort:x`, `Score N/17` with a one-line reason per axis (model in `.claude/commands/triage.md`).
6. **Danger zone** named, or "none" (list in `CLAUDE.md`).
7. **Dependencies** (`depends on #N`) and **Source**.

For an `article` issue the acceptance criteria are always the gauntlet pass bar (`docs/ARTICLE_GAUNTLET.md`), and the body carries the article's row from `CONTENT_PLAN.md` §7 plus its current state (no draft / draft unreviewed / round N with scores).

## Body template

```text
**Why:** <one line>

**Acceptance criteria:**
- [ ] <observable, testable condition>

**Checklist:**
- [ ] <concrete step, specific to this repo>

**Verification:** <commands, or "needs deploy/owner: worker must hand back">

**Score:** <P#> · <risk:x> · <effort:x> · Score N/17
- Impact: N/5 — <reason>   · Effort: N/5 — <reason>   · Risk: N/5 — <reason>

**Danger zone:** <name it, or "none">
**Depends on:** <#N, or "nothing">
**Source:** <STATUS.json / review file / WORKLOG / user inline / intake #N>
```

## Labels

| Label | Colour | Meaning |
|---|---|---|
| `todo` | `1d76db` | Queued work, ready to pick up |
| `in-progress` | `fbca04` | Claimed / being worked |
| `review` | `5319e7` | Done, awaiting review or PR merge |
| `needs-grooming` | `e99695` | Raw intake, not yet groomed to Definition of Ready |
| `blocked-on-human` | `b60205` | Needs the owner: facts, accounts, or a production action |
| `P0` | `b60205` | Critical / site or build broken |
| `P1` | `d93f0b` | High priority |
| `P2` | `fbca04` | Medium priority |
| `P3` | `0e8a16` | Low priority |
| `risk:low` | `c2e0c6` | Isolated, easily reverted |
| `risk:med` | `fef2c0` | Moderate blast radius |
| `risk:high` | `e99695` | Danger zone: confirm before acting |
| `effort:S` | `ededed` | Easy reach: one-line/config/single-file |
| `effort:M` | `d4c5f9` | Moderate effort |
| `effort:L` | `5319e7` | Large: a full article, a wave, new tooling |
| `article` | `0e8a16` | One article through the writer + three-critic gauntlet |
| `shell` | `bfd4f2` | Layout, components, styles, plugins, tools (integrator-owned) |
| `integration` | `c5def5` | Hubs, cross-links, glossary, learning paths, homepage, final gate |
| `chore` | `c5def5` | Maintenance / plan / task (non-bug, non-feature) |

## State machine

`/new-issue` or `/triage` → `todo` (raw intake: `needs-grooming` → `/groom` → `todo`) → (`/work-next` claims) → `in-progress` → PR opened → `review` → owner playtests from `pr-playtest.html` → `/ship <PR#>` merges and closes the issue.
An article that does not pass a round goes `in-progress` → `todo` with the round's scores in a comment and a draft PR; after a failed round 4 it is cut and closed as not planned. Owner-only work goes to `blocked-on-human`.
