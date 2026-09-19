---
description: Groom a raw inbound item (or the whole needs-grooming queue) into a well-defined, scored, Definition-of-Ready issue the worker can execute
argument-hint: "[raw item text — or empty to process the needs-grooming queue]"
allowed-tools: Bash, PowerShell, Read, Grep, Glob, AskUserQuestion
---

You are the **groomer** in the producer/consumer issue queue. You take rough inbound work and make it **Ready**: well-defined enough that `/work-next` can execute it without guessing. Repo: `markokstate66/ComputerScienceGuideSite`.

Inbound item (optional): **$ARGUMENTS**

## Important
- Do **not** push code or edit repo files. This command reads, refines, scores, creates, and re-labels issues only.
- The readiness bar is `.github/DEFINITION_OF_READY.md`: **read it first** and make every issue you touch satisfy it before you apply `todo`.
- The scoring model and the **risk autonomy gate** are defined in `.claude/commands/triage.md`; use them verbatim. Never auto-promote a `risk:high` item; ask first.
- Issues are **public**. No owner-private facts, secrets or email addresses.

## Two modes

**A. Inline item**: `$ARGUMENTS` is non-empty; treat it as one raw item (a bug, need, article idea or plan the user just described).

**B. Queue drain**: `$ARGUMENTS` is empty; process every open `needs-grooming` issue:
`gh issue list --label needs-grooming --state open --json number,title,body,labels`

## Steps

1. **Dedup first.** `gh issue list --state open --limit 200 --json number,title,labels,body`. If the item is already represented (by meaning), comment the new context on the existing issue and stop.

2. **Clarify only if truly blocked.** If you cannot infer intent from `CONTENT_PLAN.md`, `WORKLOG.md`, `docs/` or the code, ask one focused `AskUserQuestion` (batch up to 4). Otherwise groom with sensible defaults.

3. **Investigate enough to be concrete.** Name real files, routes and tools. For a **new article idea**: check it is not a near-duplicate of a planned article (`CONTENT_PLAN.md` §7; the brief forbids doorway pages and minor keyword variants), pick its pillar, slug, target search intent, shape (W/B/I/C/D/R/Q, different from its neighbours), outline, unique angle, diagrams and runnable code, exactly like a plan row, and note that `CONTENT_PLAN.md` and `docs/STATUS.json` need the new row as the first checklist step.

4. **Score it** per the triage model; derive `P#`, `risk:x`, `effort:x`, `Score N/17`. Pick the type: `article` | `shell` | `integration` | `bug` | `enhancement` | `chore`.

5. **Apply the autonomy gate (keyed on Risk):** low → promote; med → promote and surface under "Groomed — please glance"; high → **ask before promoting**. `CLAUDE.md` danger zones are always `risk:high`.

6. **Write it to the Definition of Ready** (body template in `.github/DEFINITION_OF_READY.md`). Note any `depends on #M`.

7. **Commit the state transition:**
   - Inline new item → `gh issue create --label todo --label <type> --label <P#> --label <risk:x> --label <effort:x> --title "<title>" --body-file <tmp>`
   - Queue item → rewrite its body to the template, then `gh issue edit <N> --body-file <tmp> --add-label todo --add-label <P#> --add-label <risk:x> --add-label <effort:x> --remove-label needs-grooming`
   - A high-risk item that was **not** approved stays `needs-grooming`; record that.

8. **Cap at 10 promotions per run.** Groom the 10 highest-Score and list the rest.

## Output
- **Groomed → ready (`todo`)**: title, issue #, `P# · risk:x · effort:x · Score`.
- **Groomed — please glance**: the `risk:med` items, one-line risk note each.
- **Left in needs-grooming**: high-risk items the user declined, or ones you couldn't define (say why).
- **Merged into existing**: duplicates you commented on instead of re-filing (→ existing #).

Then remind the user: run **`/work-next`** to have the consumer pull the top ready item.
