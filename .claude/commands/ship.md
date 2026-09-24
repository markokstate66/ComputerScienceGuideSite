---
description: After you have playtested a PR (pr-playtest.html), merge it into the integration branch and close the loop on its issue
argument-hint: "<PR number>"
allowed-tools: Bash, PowerShell, Read, Edit, Grep, Glob, AskUserQuestion
---

Final step of the loop: `/new-issue` → `/work-next` → the owner playtests from `pr-playtest.html` → **`/ship <PR#>`**. Invoking this command IS the owner's confirmation that the playtest passed. Repo: `markokstate66/ComputerScienceGuideSite`.

PR to ship: **$ARGUMENTS**

## Steps

1. **Identify the PR.** Use the number given. If none was given and exactly one non-draft PR is open, confirm that is the one. Never guess between several.

2. **Pre-flight** (`gh pr view <n> --json number,title,isDraft,baseRefName,mergeable,headRefName,body,files`):
   - **Base must be `adsense-rebuild`.** If the base is `master`, STOP: merging to `master` deploys to production. Tell the user and use `AskUserQuestion` before doing anything (this is the `risk:high` first-deploy path, issue "First deploy").
   - Not a draft. A draft PR is an article that has not passed the gauntlet; do not ship it. Say so.
   - Mergeable. If it conflicts, check out the branch, merge `adsense-rebuild` into it, resolve, rebuild, push, and re-check. Do not resolve conflicts inside an article's prose by guessing; ask.
   - `gh pr checks <n>` green if any checks exist (PRs into `adsense-rebuild` normally have none).
   - For an article PR: the last round's three review files in `docs/reviews/` are all ≥ 8.5. If not, stop and report. Since 2026-09-24 article PRs keep `draft: true` until this command (docs/ARTICLES_PLAN.md, O-1); PRs opened earlier already say `draft: false`.

3. **Verify the merge result builds**, locally, before merging: `gh pr checkout <n>`, merge the latest `adsense-rebuild` in if behind. For an article still on `draft: true`, this is the owner's approval: set `draft: false` (leave `published`, the date it passed the gauntlet, as is), commit `publish: <slug>` and push. Then `npm run build`. For an article, also `node tools/run-code.mjs <file>`. A red build is a stop.

4. **Merge:** `gh pr merge <n> --squash --delete-branch`, squash title = PR title + ` (#<n>)`. Then `git checkout adsense-rebuild && git pull`.

5. **Close the loop** in one small follow-up commit on `adsense-rebuild` (these files are deliberately not touched by work PRs, so they never conflict):
   - `Closes #N` closed the issue; remove a leftover `review`/`in-progress` label if present.
   - `docs/STATUS.json`: for an article set `state: "passed"`, `round`, final `scores`, `published`; recompute `totals`.
   - `CHANGELOG.md` "Unreleased": one line. `WORKLOG.md`: one dated line with the real scores or what was verified.
   - `git add docs/STATUS.json CHANGELOG.md WORKLOG.md`, commit `chore: status + changelog for #<n>`, `git push`.

6. **Refresh the hub page:** `node tools/refresh-playtest.mjs`.

7. **Report:** merged PR, closed issue, published-article count vs the floor of 40, anything you could not verify, and the next highest-priority `todo` issue so the user can `/work-next` it.
