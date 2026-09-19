---
description: Pick the highest-priority `todo` issue by P0→P3 label (or a given #), work it on a branch, open a PR that closes it
argument-hint: "[optional: issue number]"
allowed-tools: Bash, PowerShell, Read, Edit, Write, Grep, Glob, Agent, WebSearch, WebFetch, AskUserQuestion
---

You are the **puller** (consumer) in a GitHub-issue work queue. Take one issue off the `todo` queue, do it properly, and open a PR, or, if it isn't work you can do here, hand it back with clear notes. Repo: `markokstate66/ComputerScienceGuideSite`.

Requested issue (optional): **$ARGUMENTS**

## Important: read before acting
- Read `CLAUDE.md` first. **Never commit or push to `master`** (it deploys to production). Branch from, and open PRs into, the integration branch **`adsense-rebuild`**.
- **One issue per run. For an `article` issue, one gauntlet round per run** (`docs/ARTICLE_GAUNTLET.md`). Do not start a second round or a second issue in the same run; token spend per run must stay predictable. Do not use the Workflow tool to fan out over several articles unless the user explicitly asks for that in this session.
- **Do not fake completion.** If the issue needs the owner (facts only they have, an account, a deploy), do NOT open an empty PR; see step 5b. Never report a score, a Lighthouse number or a passing check you did not get from a real run.
- End every commit message with the co-author attribution line Claude Code gives you for this session.

## Steps

1. **Choose the issue.**
   - If `$ARGUMENTS` contains a number, use that issue.
   - Otherwise: `gh issue list --label todo --state open --limit 100 --json number,title,labels,createdAt` and pick by **priority label**, highest first: `P0` → `P1` → `P2` → `P3`.
     - Skip anything labelled `blocked-on-human` or `in-progress`.
     - **Tie-break within a priority:** higher `Score N/17` (in the body) first; then an article that already has a draft or reviews before one that does not (finishing beats starting); then oldest `createdAt`.
     - **Unlabeled fallback:** an issue with no `P#` label predates scoring; rank it as `P2` and say in your announcement that it was unscored so the user knows to run `/triage`.
   - Announce which you picked and why.

2. **Read it fully:** `gh issue view <N> --comments`. Understand the acceptance criteria, checklist, earlier round results in the comments, and any `depends on #M`. If it depends on unfinished work (an open `#M`, or a stated condition such as "at least ~40 article issues merged"), don't work it: say so in one line and pick the next item in priority order. Stop only when nothing unblocked remains.
   - **Readiness check:** you pull only `todo` items and trust they meet `.github/DEFINITION_OF_READY.md`. If the picked issue clearly doesn't, either groom it inline to the DoR first, or hand it back: `gh issue edit <N> --add-label needs-grooming --remove-label todo` with a comment on what's missing, then pick the next item.
   - **Risk gate:** if the issue carries `risk:high`, do **not** silently start. Surface the risk and confirm before claiming it (`AskUserQuestion`: proceed / pick a lower-risk item instead / skip). Auto-proceed only for `risk:low`/`risk:med` (and unlabeled).

3. **Claim it** so no other agent double-works:
   `gh issue edit <N> --add-label in-progress --remove-label todo`
   and comment: `gh issue comment <N> --body "Starting work (automated /work-next)."`

4. **Decide the work type:**
   - **`article` issue** → step 5-article.
   - **Other repo work** (shell, tools, integration, docs) → step 5a.
   - **Owner-only / external work** (facts only the owner has, AdSense or Azure portal, a production deploy) → step 5b.

5-article. **Run exactly one gauntlet round** as `docs/ARTICLE_GAUNTLET.md` describes: branch `issue-<N>-<slug>` from `adsense-rebuild` (or reuse it), writer pass if due, three critics in parallel as separate subagents, then your own **serial** `run-code` and `verify-page --drafts` run. Commit the article, crosslinks and review files with `git add <specific files>` (never `-A`), push, and comment the round's real scores on the issue.
   - Passed → flip `draft: false`, open the PR with `gh pr create --base adsense-rebuild --title "<article title>" --body "Closes #<N> ..."`, then `gh issue edit <N> --add-label review --remove-label in-progress`.
   - Not passed, rounds remain → open/update a **draft** PR (`--draft`), then `gh issue edit <N> --add-label todo --remove-label in-progress` so the next run takes the next round.
   - Failed round 4 → cut it as the gauntlet doc describes and close the issue as not planned.

5a. **Do other repo work:**
   - `git checkout adsense-rebuild && git pull && git checkout -b issue-<N>-<short-slug>`
   - Make the changes. Follow `CLAUDE.md`, and the ownership table in `CONTENT_PLAN.md` §9.
   - Verify: `npm run build`; `verify-page` on every page you affected, and look at the screenshots; `run-code` if you touched code samples or the runner (plus `tools/fixtures/run-code-selftest.md`, which must report exactly its three planted failures). If you cannot verify something here (production redirects, headers, 404 status), say so in the PR body; never claim it.
   - `git add <specific files>`, commit, `git push -u origin issue-<N>-<short-slug>`.
   - `gh pr create --base adsense-rebuild --title "<title>" --body "Closes #<N>` + summary + verification status`"`
   - `gh issue edit <N> --add-label review --remove-label in-progress`

5b. **Hand back owner-only work:** comment the exact step-by-step the owner must perform (or the exact facts needed), then `gh issue edit <N> --add-label blocked-on-human --add-label todo --remove-label in-progress`. Report to the user that it needs them.

## PR body format (every PR, draft or not)

The owner playtests every PR from `pr-playtest.html` before anything merges, and that page is generated from PR bodies. Use exactly this shape (write it to a temp file and pass `--body-file`):

```text
Closes #<N>

## Summary
<what changed and why, 2–5 lines>

## 🧪 Playtest instructions
1. Open /<route>/ … <what to look at, and what "right" looks like>
2. <phone width / dark mode / a specific figure, table or interaction>
3. <for an article: the one explanation or example most worth a human read>

## Verification
<commands you really ran and their real results: build, run-code, verify-page Lighthouse numbers, console errors, broken links. Anything you could NOT verify here, said plainly.>

## Gauntlet            (article PRs only)
Round <n>: technical <x.x> / AdSense <x.x> / design <x.x> — passed | not passed
<top open issues if not passed>
```
- The heading must contain the 🧪 emoji and the steps must be a numbered list: the page parses them into a checklist. Start from the issue's "Playtest" section if it has one.
- Write routes as bare paths with both slashes (`/databases/sql-joins/`); the page turns them into links to the local preview.
- Steps are things a human can judge in a browser in a few minutes, not things the tools already proved.
- Never merge your own PR. Merging is `/ship <PR#>`, which the owner runs after playtesting.

After opening or updating a PR run `node tools/refresh-playtest.mjs` (a hook normally does this for you).

6. **Report:** which issue, what you did, real scores/numbers, the PR link (or the hand-back), current label state, and roughly how many subagents you used. Point the user at `pr-playtest.html` for the playtest, and `/ship <PR#>` when it looks right. If nothing is in `todo`, say the queue is empty and suggest `/triage`.
