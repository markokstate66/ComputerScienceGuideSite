---
title: "Undoing Things in Git: restore, reset, revert, reflog"
description: "Make five real mistakes in a scripted repo — from an unstaged edit to a deleted branch — and fix each with git restore, reset, revert or reflog."
pillar: version-control
order: 4
author: markus
published: 2026-09-22
updated: 2026-09-22
level: beginner
tags: [git, git-reset, git-revert, reflog, undo]
prerequisites: ["version-control/how-git-works", "version-control/branching-and-merging"]
sources:
  - title: "git (\"Reset, restore and revert\" section)"
    url: "https://git-scm.com/docs/git#_reset_restore_and_revert"
    publisher: "Git documentation"
    accessed: 2026-09-22
  - title: "git-restore"
    url: "https://git-scm.com/docs/git-restore"
    publisher: "Git documentation"
    accessed: 2026-09-22
  - title: "git-reset"
    url: "https://git-scm.com/docs/git-reset"
    publisher: "Git documentation"
    accessed: 2026-09-22
  - title: "git-revert"
    url: "https://git-scm.com/docs/git-revert"
    publisher: "Git documentation"
    accessed: 2026-09-22
  - title: "git-reflog"
    url: "https://git-scm.com/docs/git-reflog"
    publisher: "Git documentation"
    accessed: 2026-09-22
  - title: "git-push (--force, --force-with-lease, fast-forward rules)"
    url: "https://git-scm.com/docs/git-push"
    publisher: "Git documentation"
    accessed: 2026-09-22
  - title: "git-branch (-d, -D, reflogs)"
    url: "https://git-scm.com/docs/git-branch"
    publisher: "Git documentation"
    accessed: 2026-09-22
draft: false
---

An edited file, a staged change, a commit you haven't pushed, a commit you have pushed, and a branch you deleted are five different problems. "How do I undo this" does not say which one you have, and the four commands that undo things in Git are not interchangeable. Git's own manual draws the line for you, in one paragraph that names a *place* for each command: [git-revert](https://git-scm.com/docs/git-revert) "is about making a new commit that reverts the changes made by other commits"; [git-restore](https://git-scm.com/docs/git-restore) "is about restoring files in the working tree from either the index or another commit... This command does not update your branch"; and [git-reset](https://git-scm.com/docs/git-reset) "is about updating your branch, moving the tip in order to add or remove commits from the branch. This operation changes the commit history" ([git, "Reset, restore and revert"](https://git-scm.com/docs/git#_reset_restore_and_revert)). Which command is right depends on where the change is sitting when you notice it, not on how bad the mistake feels.

This page works through five real mistakes with one small project, each made on purpose and then fixed for real, organized by that question: where is the change right now?

## Three places a change can be

Between an edit and a pushed commit, a change passes through three places, and every command below acts on one or two of them:

- **The working directory.** The files on disk, exactly as your editor or a script left them.
- **The index**, also called the *stage*. A snapshot of what the *next* commit will contain. `git add` copies a file's current working-directory content into it; `git commit` turns the whole index into a new commit.
- **HEAD.** The commit your branch currently points to — the *last* thing you committed, before any edits since.

<figure class="diagram">
<svg viewBox="0 0 340 356" role="img" aria-labelledby="tt-title tt-desc">
<title id="tt-title">Three places a change passes through, and what git restore moves between them</title>
<desc id="tt-desc">Three stacked boxes: working directory on top, index in the middle, HEAD at the bottom. An upward arrow from the index to the working directory is labelled git restore, index to working directory. A second upward arrow from HEAD to the index is labelled git restore --staged, HEAD to index.</desc>
<defs>
<marker id="tt-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-accent"/></marker>
</defs>
<rect x="20" y="10" width="300" height="54" rx="6" class="d-box"/>
<text x="170" y="32" text-anchor="middle" class="d-bold">Working directory</text>
<text x="170" y="50" text-anchor="middle" class="d-small d-muted">the files you edit and see</text>
<path d="M60 146 V68" class="d-accent" marker-end="url(#tt-arrow)"/>
<text x="80" y="100" class="d-small d-text-accent">git restore</text>
<text x="80" y="116" class="d-small d-muted">index → working directory</text>
<rect x="20" y="150" width="300" height="54" rx="6" class="d-box"/>
<text x="170" y="172" text-anchor="middle" class="d-bold">Index (the stage)</text>
<text x="170" y="190" text-anchor="middle" class="d-small d-muted">what the next commit will contain</text>
<path d="M60 286 V208" class="d-accent" marker-end="url(#tt-arrow)"/>
<text x="80" y="240" class="d-small d-text-accent">git restore --staged</text>
<text x="80" y="256" class="d-small d-muted">HEAD → index</text>
<rect x="20" y="290" width="300" height="54" rx="6" class="d-box-2"/>
<text x="170" y="312" text-anchor="middle" class="d-bold">HEAD</text>
<text x="170" y="330" text-anchor="middle" class="d-small d-muted">the last commit's snapshot</text>
</svg>
<figcaption>Figure 1. <code>git add</code> and <code>git commit</code> move content up this diagram, index to HEAD; <code>git restore</code> and <code>git restore --staged</code> move it back down.</figcaption>
</figure>

The project below is a plain-text task list. The session ran under Git 2.52 in Git Bash on Windows. Blob and tree IDs would match on any machine, because they hash only content, but the commit IDs shown further down also hash a name, an email address and two timestamps ([How Git Works Inside](/version-control/how-git-works/) works through why). Pin those the same way that article does, and every commit ID on this page reproduces exactly:

```bash run
git init -q -b main planner
cd planner
git config user.name 'Ada Example'
git config user.email ada@example.com
git config commit.gpgsign false
git config core.autocrlf false
export GIT_AUTHOR_DATE=2026-01-15T10:00:00Z
export GIT_COMMITTER_DATE=2026-01-15T10:00:00Z
cat > tasks.txt <<'EOF'
[ ] Buy stamps
[ ] Renew library card
EOF
git add tasks.txt
git commit -q -m 'Start the task list'
git log --format='%s%d'
```

```text output
Start the task list (HEAD -> main)
```

## "I edited a file, haven't staged it, and want the old content back"

A script meant to *append* a line runs with the wrong redirect and overwrites the file instead — a one-character typo (`>` for `>>`) that is easy to make and, if you catch it before staging, free to undo:

```bash run
echo '[ ] Pay water bill' > tasks.txt
git status --short
git diff --stat
```

```text output
 M tasks.txt
 tasks.txt | 3 +--
 1 file changed, 1 insertion(+), 2 deletions(-)
```

Nothing has been staged, so the index still holds the file exactly as it was committed. `git restore` with no flags restores the *working tree*, and by default — when `--staged` is not given — its source is the index: "if `--staged` is given, the contents are restored from `HEAD`, otherwise from the index" ([git-restore](https://git-scm.com/docs/git-restore)). Here the index equals `HEAD`, so either way the result is the last commit:

```bash run
git restore tasks.txt
git status --short
cat tasks.txt
```

```text output
[ ] Buy stamps
[ ] Renew library card
```

The file is back, byte for byte, and `git status` prints nothing because nothing differs from the index any more. This only works before the bad content is staged — the next section covers what to do once it is.

## "I staged the edit, and want to undo just that"

Stage a change, then have second thoughts before committing it — a plumber's number half-remembered, added to the list too soon:

```bash run
echo '[ ] Ask about plumbers' >> tasks.txt
git add tasks.txt
git status --short
```

```text output
M  tasks.txt
```

The leading `M` in column one (rather than column two) means the index differs from `HEAD`; there is no second `M`, so the working tree currently matches what's staged. `git restore --staged` moves the other direction from the previous section: it restores the *index* from `HEAD`, which is exactly what "unstage" means — the [git](https://git-scm.com/docs/git#_reset_restore_and_revert) page's own summary calls this "restoring files in the index from another commit." The working tree is untouched:

```bash run
git restore --staged tasks.txt
git status --short
cat tasks.txt
```

```text output
 M tasks.txt
[ ] Buy stamps
[ ] Renew library card
[ ] Ask about plumbers
```

The `M` moved to column two: unstaged, not staged. The half-remembered line is still sitting in the file, which is correct — you asked to *unstage* it, not delete it. If you also don't want the edit itself, one command does both at once.

::::exercise[One command, two trees]
`git restore <file>` restores the working tree from the index; `git restore --staged <file>` restores the index from `HEAD`. Predict what `git restore --staged --worktree <file>` does to a file that is currently staged, with no further edits on top — which of the three places named in Figure 1 end up matching which — then run it and check.

:::solution
`--staged --worktree` restores *both* locations from `HEAD` in one step, so the file returns to exactly what the last commit has, with nothing staged and nothing edited — nothing left to discard a second time:

```bash run
git add tasks.txt
git restore --staged --worktree tasks.txt
git status --short
cat tasks.txt
```

```text output
[ ] Buy stamps
[ ] Renew library card
```

`git status` prints nothing and the plumber line is gone from the file, not just from the index.
:::
::::

With the false start cleared, add the real task and commit it, so there's a normal, wanted commit to work from in the next section:

```bash run
echo '[ ] Pay water bill' >> tasks.txt
git add tasks.txt
git commit -q -m 'Add task: pay water bill'
git log --format='%s%d'
```

```text output
Add task: pay water bill (HEAD -> main)
Start the task list
```

## "I committed, but haven't pushed — and I want it gone"

A typo survives into a commit — "Cal" for "Call" — and only catches your eye afterward:

```bash run
echo '[ ] Cal the plumber' >> tasks.txt
git commit -q -a -m 'Add task: call the plumber'
git branch try-mixed
git branch try-hard
git branch
```

```text output
* main
  try-hard
  try-mixed
```

`git reset [<mode>] <commit>` "changes which commit `HEAD` points to" ([git-reset](https://git-scm.com/docs/git-reset)) — a fundamentally different move from `restore`, because it relabels *which* commit is the branch tip rather than copying content between the three places. All three modes below move `HEAD` back one commit; they differ only in what they do to the index and the working tree while they do it. Two throwaway branch names (`try-mixed`, `try-hard`) let each mode start from the identical bad commit, one mode per branch, instead of undoing and redoing the mistake three times.

<figure class="diagram">
<svg viewBox="0 0 340 296" role="img" aria-labelledby="rm-title rm-desc">
<title id="rm-title">What each reset mode does to the index and working tree while it moves HEAD</title>
<desc id="rm-desc">Three stacked boxes, one per mode. Soft: HEAD moved, index unchanged and now differs from HEAD so its diff shows as staged, working tree unchanged. Mixed: HEAD moved, index updated to match the new HEAD so nothing is staged, working tree unchanged so the diff shows as unstaged. Hard, highlighted in amber: HEAD moved, index updated to match, and the working tree is overwritten to match too, discarding the diff entirely.</desc>
<rect x="10" y="6" width="320" height="80" rx="6" class="d-box"/>
<text x="24" y="28" class="d-bold d-mono">--soft</text>
<text x="24" y="48" class="d-small">HEAD: moved back one commit</text>
<text x="24" y="64" class="d-small d-muted">Index: unchanged — now staged</text>
<text x="24" y="80" class="d-small d-muted">Working tree: unchanged</text>
<rect x="10" y="100" width="320" height="80" rx="6" class="d-box"/>
<text x="24" y="122" class="d-bold d-mono">(default, or --mixed)</text>
<text x="24" y="142" class="d-small">HEAD: moved back one commit</text>
<text x="24" y="158" class="d-small">Index: matches new HEAD</text>
<text x="24" y="174" class="d-small d-muted">Working tree: unchanged — now unstaged</text>
<rect x="10" y="194" width="320" height="90" rx="6" class="d-box-warn"/>
<text x="24" y="216" class="d-bold d-mono">--hard</text>
<text x="24" y="236" class="d-small">HEAD: moved back one commit</text>
<text x="24" y="252" class="d-small">Index: matches new HEAD</text>
<text x="24" y="268" class="d-small d-bold">Working tree: overwritten to match</text>
</svg>
<figcaption>Figure 2. Every mode moves HEAD. Soft leaves the diff staged, mixed leaves it as an unstaged edit, and only hard erases it from the working tree.</figcaption>
</figure>

`--soft` is the gentlest: "leave your working tree files and the index unchanged" ([git-reset](https://git-scm.com/docs/git-reset)). The index still has the *old* HEAD's content, which now disagrees with the new HEAD, so that disagreement shows up as a staged change — as if you had `git add`ed it a moment ago:

```bash run
git reset --soft HEAD~1
git log --format='%s%d'
git status --short
git diff --cached --stat
git diff --cached -- tasks.txt | tail -1
```

```text output
Add task: pay water bill (HEAD -> main)
Start the task list
M  tasks.txt
 tasks.txt | 1 +
 1 file changed, 1 insertion(+)
+[ ] Cal the plumber
```

Plain `git reset <commit>`, with no mode flag, is `--mixed`, the default: "leave your working directory unchanged. Update the index to match the new HEAD, so nothing will be staged" ([git-reset](https://git-scm.com/docs/git-reset)). The typo is still on disk, but it is no longer staged — the same content, one step further from being committed again by accident:

```bash run
git switch -q try-mixed
git reset HEAD~1
git log --format='%s%d'
git status --short
git diff --stat
git diff -- tasks.txt | tail -1
```

```text output
Unstaged changes after reset:
M	tasks.txt
Add task: pay water bill (HEAD -> try-mixed, main)
Start the task list
 M tasks.txt
 tasks.txt | 1 +
 1 file changed, 1 insertion(+)
+[ ] Cal the plumber
```

`--hard` goes all the way: "overwrite all files and directories with the version from `<commit>`... update the index to match the new HEAD" ([git-reset](https://git-scm.com/docs/git-reset)). `git switch` refuses to leave a branch with an edit like the one just made, so clear it first, the same way the first section did:

```bash run
git restore tasks.txt
git switch -q try-hard
git reset --hard HEAD~1
git log --format='%s%d'
git status --short
cat tasks.txt
```

```text output
HEAD is now at 42badad Add task: pay water bill
Add task: pay water bill (HEAD -> try-hard, try-mixed, main)
Start the task list
[ ] Buy stamps
[ ] Renew library card
[ ] Pay water bill
```

The typo is gone from the file, the index and the log alike. The docs are blunt about the cost, twice over: `--hard` "may overwrite untracked files" too, not only the ones Git already knows about, and its own worked example warns "do **not** do this if you have already given these commits to somebody else" ([git-reset](https://git-scm.com/docs/git-reset)) — the subject of the next section.

:::pitfall
`--hard` is the only one of the three that touches files it doesn't have to. If an untracked file happens to occupy a path that the target commit *does* track, resetting overwrites it with no staging step to catch the collision first — there's nothing to `git restore` afterward, because nothing was ever committed. `git status` before a hard reset costs nothing and catches this.
:::

::::exercise[Where did the typo commit go?]
All three branches above started from the same bad commit and were reset away from it independently. Predict whether `Add task: call the plumber` is still reachable from *any* of the three branch tips now, then check with a single command over the whole repository.

:::solution
Reachable from none of them — each reset moved its own branch's tip past it, and nothing else points at it:

```bash run
git log --all --format='%s%d' |
  grep -c 'call the plumber' || true
```

```text output
0
```

Unreachable is not the same as gone. The object is still in `.git`, and the reflog rescue further down this page is exactly how you'd get a branch name pointing at it again if you needed to.
:::
::::

## "I already pushed the commit"

Reset moves a branch pointer locally; it does not know or care who else has fetched the commits it leaves behind. Set up a shared history to see why that matters — a bare repository standing in for a host, and two independent clones:

```bash run
cd ..
git init -q --bare -b main team-planner.git
git init -q -b main alice
cd alice
git config user.name 'Ada Example'
git config user.email ada@example.com
git config commit.gpgsign false
git config core.autocrlf false
cat > tasks.txt <<'EOF'
[ ] Buy stamps
[ ] Renew library card
EOF
git add tasks.txt
git commit -q -m 'Start the task list'
echo '[ ] Pay water bill' >> tasks.txt
git commit -q -a -m 'Add task: pay water bill'
git remote add origin ../team-planner.git
git push -q -u origin main
git log --format='%s%d'
```

```text output
Add task: pay water bill (HEAD -> main, origin/main)
Start the task list
```

The `git config` lines are repeated because each `git init` starts a fresh `.git/config`, local to that repository. `GIT_AUTHOR_DATE` and `GIT_COMMITTER_DATE`, exported once for the planner repo near the top of this page, are shell environment variables, not repository config, so they carry forward for the rest of the session and apply here too — which is why the commit IDs below still reproduce exactly.

```bash run
cd ..
git init -q -b main bob
cd bob
git config user.name 'Ada Example'
git config user.email ada@example.com
git config commit.gpgsign false
git config core.autocrlf false
git remote add origin ../team-planner.git
git fetch -q origin
git switch -q -c main --track origin/main
git log --format='%s%d'
```

```text output
Add task: pay water bill (HEAD -> main, origin/main, origin/HEAD)
Start the task list
```

Alice commits a second typo — "vet" instead of the intended errand — and pushes without noticing:

```bash run
cd ../alice
echo '[ ] Cal the vet' >> tasks.txt
git commit -q -a -m 'Add task: call the vet'
git push -q origin main
```

Bob, elsewhere, pulls in the ordinary course of his day:

```bash run
cd ../bob
git pull -q
git log --format='%s%d' -1
cat tasks.txt
```

```text output
Add task: call the vet (HEAD -> main, origin/main, origin/HEAD)
[ ] Buy stamps
[ ] Renew library card
[ ] Pay water bill
[ ] Cal the vet
```

Back on her own machine, alice reaches for the tool from the previous section:

```bash run
cd ../alice
git reset --hard HEAD~1
cat tasks.txt
```

```text output
HEAD is now at 42badad Add task: pay water bill
[ ] Buy stamps
[ ] Renew library card
[ ] Pay water bill
```

Locally, the typo is gone. Pushing that, though, is a different commit history than the one on the shared repository — one that does not descend from what's already there:

```bash run fails stderr
git push origin main
```

```text output
To ../team-planner.git
 ! [rejected]        main -> main (non-fast-forward)
error: failed to push some refs to '../team-planner.git'
hint: Updates were rejected because the tip of your current branch is behind
hint: its remote counterpart. If you want to integrate the remote changes,
hint: use 'git pull' before pushing again.
hint: See the 'Note about fast-forwards' in 'git push --help' for details.
```

Only fast-forward updates are accepted by default; the rejection is Git protecting bob's copy of history, not a bug. `--force` is the override, and the documentation states exactly when it's safe: "only if you are certain that nobody in the meantime fetched your earlier commit... you can run `git push --force`... In other words, `git push --force` is a method reserved for a case where you do mean to lose history" ([git-push](https://git-scm.com/docs/git-push)).

:::warning[Bob already fetched it]
Bob's pull, two blocks up, is exactly the condition the quote above rules out. Forcing anyway does not undo his fetch — it changes what the remote says without reaching into his clone. The next two blocks show what that leaves behind, before this page moves on to the command that avoids the problem.
:::

```bash run stderr
git push --force origin main
```

```text output
To ../team-planner.git
 + 1c4e376...42badad main -> main (forced update)
```

```bash run
cd ../bob
git fetch -q origin
git status --short --branch
git log --format='%s%d' --all
```

```text output
## main...origin/main [ahead 1]
Add task: call the vet (HEAD -> main)
Add task: pay water bill (origin/main, origin/HEAD)
Start the task list
```

Bob's `main` is "ahead" of the rewritten `origin/main` by exactly the commit alice tried to erase. It is not a conflict and his working tree is clean, so nothing forces him to notice — but the typo is still fully present in his repository, one `git push` away from reappearing on the shared history the moment he next publishes his own work.

::::exercise[Prove nothing was actually deleted]
`git merge-base --is-ancestor <A> <B>` exits 0 exactly when `A` is an ancestor of `B` — the same check [Branching and Merging](/version-control/branching-and-merging/) uses to decide whether a merge can fast-forward. From bob's clone, use it to confirm that the rewritten `origin/main` is still fully contained within his own `main`, before predicting the result.

:::solution
It is — alice's force-push shortened what the *remote* points at, but every commit it used to include is still an ancestor of bob's copy:

```bash run
git merge-base --is-ancestor origin/main main &&
  echo 'origin/main is an ancestor of main: still fully there'
```

```text output
origin/main is an ancestor of main: still fully there
```
:::
::::

`git revert <commit>` takes the other approach: instead of moving a pointer backward, it "record[s] some new commits" that apply the opposite change on top of history that already exists ([git-revert](https://git-scm.com/docs/git-revert)). Nothing before it changes, so there is no rewritten history for a push to conflict with. Put the mistake back the way it was first, using the escape hatch `reset --hard` itself provides — `ORIG_HEAD`, set to "the tip of the current branch" before the reset ran ([git-reset](https://git-scm.com/docs/git-reset)) — then revert properly:

```bash run
cd ../alice
git log --format='%s%d' ORIG_HEAD -1
git reset -q --hard ORIG_HEAD
git push -q --force origin main
git revert --no-edit HEAD
git log --format='%s%d' -3
```

```text output
Add task: call the vet
[main e9966a8] Revert "Add task: call the vet"
 Date: Thu Jan 15 10:00:00 2026 +0000
 1 file changed, 1 deletion(-)
Revert "Add task: call the vet" (HEAD -> main)
Add task: call the vet (origin/main)
Add task: pay water bill
```

`Add task: call the vet` is still right there in the log, unedited — revert doesn't erase a mistake, it cancels one, on the record. Pushing it needs no override, because every earlier commit alice published is still an ancestor of the new tip:

```bash run stderr
git push origin main
```

```text output
To ../team-planner.git
   1c4e376..e9966a8  main -> main
```

```bash run
cd ../bob
git pull -q
git log --format='%s%d' -3
cat tasks.txt
```

```text output
Revert "Add task: call the vet" (HEAD -> main, origin/main, origin/HEAD)
Add task: call the vet
Add task: pay water bill
[ ] Buy stamps
[ ] Renew library card
[ ] Pay water bill
```

An ordinary pull, no conflict, no warning that anything was rewritten — because nothing was. Once a commit is somewhere you don't control, that asymmetry (a fast-forwarding fix versus a history-rewriting one) is one real reason to prefer revert — alongside protected-branch policies that block force-pushes outright and the audit trail a revert leaves that a rewritten history does not.

## "I think I lost a commit entirely"

Back on alice's own machine: a short-lived branch, done and force-deleted without a second thought — the everyday way most branches actually leave a repository:

```bash run
cd ../alice
git switch -q -c sort-experiment
cat > tasks.txt <<'EOF'
[ ] Pay water bill
[ ] Buy stamps
[ ] Renew library card
EOF
git commit -q -a -m 'Sort tasks by due date'
git switch -q main
git branch -D sort-experiment
git log --all --format='%s%d' |
  grep -c 'Sort tasks' || true
```

```text output
Deleted branch sort-experiment (was 07662de).
0
```

`git branch -D` is `--delete --force`: it removes a branch "irrespective of its merged status", and "if the branch currently has a reflog then the reflog will also be deleted" ([git-branch](https://git-scm.com/docs/git-branch)) — so `sort-experiment`'s own history of where it pointed is gone along with the name. `git log --all` confirms the commit is unreachable from every remaining ref. Neither fact means the commit is gone.

`git reflog` reads a different log: not a branch's own history, but `HEAD`'s — "the tips of branches and other references" as they were updated "in the local repository", and specifically, "the `HEAD` reflog records branch switching" ([git-reflog](https://git-scm.com/docs/git-reflog)) as well as commits. Switching *away* from `sort-experiment`, right before deleting it, is what left a trace that survives the deletion:

```bash run
git reflog | head -4
```

```text output
e9966a8 HEAD@{0}: checkout: moving from sort-experiment to main
07662de HEAD@{1}: commit: Sort tasks by due date
e9966a8 HEAD@{2}: checkout: moving from main to sort-experiment
e9966a8 HEAD@{3}: revert: Revert "Add task: call the vet"
```

`HEAD@{1}` names "where `HEAD` used to be" one move before now ([git-reflog](https://git-scm.com/docs/git-reflog)) — the sort commit, by its subject line, right there. A ref is just a name for a commit ID, so pointing a new one at it undoes the deletion completely:

```bash run
git branch sort-experiment HEAD@{1}
git log --format='%s%d' sort-experiment -1
git switch -q sort-experiment
cat tasks.txt
```

```text output
Sort tasks by due date (sort-experiment)
[ ] Pay water bill
[ ] Buy stamps
[ ] Renew library card
```

Same commit, same tree, branch restored under its old name.

:::note
This only worked because alice ran the deletion herself, on the machine that recorded it. "Local repository" in the quote above is not a formality: reflogs are never pushed, fetched or cloned, so a teammate — bob, in the previous section — has no reflog entry for a branch he never checked into locally, however carefully he looks.
:::

A deleted branch is one way to misplace a commit; `git commit --amend` is another, quieter one, because it looks like editing a commit rather than replacing it.

::::exercise[Does --amend really lose anything?]
`git commit --amend` is often described as "editing the last commit." Given that [objects are immutable](/version-control/how-git-works/#git-commit-does-the-same-and-reuses-what-did-not-change) and a commit's ID is a hash of its own content, predict what actually happens to the *original* commit when you amend, and whether `git reflog` would find it — then verify.

:::solution
Nothing is edited in place; like `revert` above, `--amend` writes a brand-new commit object and moves the branch to it — the two commands on this page that undo something by creating a new commit, rather than by repointing a branch (`reset`) or touching only the working tree and index (`restore`). The original becomes unreachable from any branch, but the reflog records the move, the same way it recorded the branch deletion above:

```bash run
git switch -q main
sed -i '/Buy stamps/d' tasks.txt
git commit -q -a -m 'Remove done task'
git commit -q --amend \
  -m 'Remove done task: stamps bought'
git log --format='%s%d' -1
git reflog | head -2
echo "-- the amended-away original:"
git show HEAD@{1} --format='%s' -s
```

```text output
Remove done task: stamps bought (HEAD -> main)
7b96631 HEAD@{0}: commit (amend): Remove done task: stamps bought
36bb7be HEAD@{1}: commit: Remove done task
-- the amended-away original:
Remove done task
```

`HEAD@{1}` is the pre-amend commit, findable and fully intact, by the same mechanism as the deleted branch above.
:::
::::

## Eight situations, one lookup

| Where the change is | Command |
|---|---|
| Unstaged edit, discard it | `git restore <file>` |
| Staged edit, unstage it (keep the edit) | `git restore --staged <file>` |
| Staged edit, discard it entirely | `git restore --staged --worktree <file>` |
| Committed, not pushed, want it staged again | `git reset --soft HEAD~1` |
| Committed, not pushed, want it as an unstaged edit | `git reset HEAD~1` |
| Committed, not pushed, want it fully gone | `git reset --hard HEAD~1` |
| Already pushed | `git revert <commit>` |
| Seems lost (deleted branch, `--amend`, a reset) | `git reflog`, then `git branch <name> <ref>` or `git reset --hard <ref>` |

The reflog rescue above has a deadline, the same way an unreachable object does. Reflog entries themselves expire — `gc.reflogExpire` defaults to 90 days, and `gc.reflogExpireUnreachable`, for an entry whose commit no other ref can reach, defaults to 30 days ([git-reflog](https://git-scm.com/docs/git-reflog)) — after which routine housekeeping is free to remove them and, eventually, the objects they were the last thing pointing at. Ninety days covers essentially every "wait, where did that go" moment that shows up while you're still working; it does not cover a repository nobody has opened in months.
