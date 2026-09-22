---
title: "Rebase vs Merge: What Each Does to History"
description: "Merge the same diverged branches two ways, once with git merge and once with git rebase, and read the difference straight off git log --graph, hash by hash."
pillar: version-control
order: 3
author: markus
published: 2026-09-22
updated: 2026-09-22
level: intermediate
tags: [git, rebase, merging, commit-history]
prerequisites: ["version-control/how-git-works", "version-control/branching-and-merging"]
sources:
  - title: "git-rebase"
    url: "https://git-scm.com/docs/git-rebase"
    publisher: "Git documentation"
    accessed: 2026-09-22
  - title: "git-merge"
    url: "https://git-scm.com/docs/git-merge"
    publisher: "Git documentation"
    accessed: 2026-09-22
  - title: "git-merge-base"
    url: "https://git-scm.com/docs/git-merge-base"
    publisher: "Git documentation"
    accessed: 2026-09-22
  - title: "git-commit (--fixup)"
    url: "https://git-scm.com/docs/git-commit"
    publisher: "Git documentation"
    accessed: 2026-09-22
  - title: "git-bisect (--first-parent)"
    url: "https://git-scm.com/docs/git-bisect"
    publisher: "Git documentation"
    accessed: 2026-09-22
  - title: "Pro Git, 2nd ed., section 3.6: Git Branching - Rebasing"
    url: "https://git-scm.com/book/en/v2/Git-Branching-Rebasing"
    publisher: "git-scm.com"
    accessed: 2026-09-22
draft: true
---

`git merge` and `git rebase` can both bring one branch's work onto another, and for a change that does not conflict, the file you end up with can be identical either way. What differs is what each one writes to the commit graph. Merge adds one new commit that names both parents and leaves every existing commit exactly where it was. Rebase writes a new set of commits with new hashes and moves a branch pointer to them; the commits it copied from stay behind, no longer reachable from that branch. This page builds one small repository, brings the same two diverged branches together first with merge and then, from an untouched copy of the same starting point, with rebase, and reads the difference straight off `git log --graph`. It builds on [How Git Works Inside](/version-control/how-git-works/), which shows that [objects are immutable and that rebase writes new commits rather than editing old ones](/version-control/how-git-works/#git-commit-does-the-same-and-reuses-what-did-not-change), and on [Branching and Merging](/version-control/branching-and-merging/), which covers merge bases, conflicts and merge strategies in depth; none of that is repeated here.

## Same starting point, two branches

The project is a one-file reading log. Two commits land on `main`, then a branch called `annotate` adds notes to two of the books while `main`, independently, adds a third month's books.

```bash run
git init -q -b main reading-log
cd reading-log
git config core.autocrlf false
cat > log.txt <<'EOF'
Feb: Piranesi
Feb: The Left Hand of Darkness
EOF
git add log.txt
git commit -q -m 'Start the reading log'
cat >> log.txt <<'EOF'
Mar: Dune
Mar: The Dispossessed
Mar: Hyperion
Mar: The Sparrow
EOF
git commit -q -a -m 'Add March books'
git switch -q -c annotate
sed -i '/Dune/s/$/ -- reread/' log.txt
git commit -q -a -m 'Note: reread Dune'
sed -i '/Hyperion/s/$/ -- borrowed/' log.txt
git commit -q -a -m 'Note: borrowed Hyperion'
git switch -q main
echo 'Apr: The Fifth Season' >> log.txt
git commit -q -a -m 'Add April books'
git log --graph --format='%s%d' --all
```

```text output
* Note: borrowed Hyperion (annotate)
* Note: reread Dune
| * Add April books (HEAD -> main)
|/
* Add March books
* Start the reading log
```

The session on this page ran under Git 2.52 in Git Bash on Windows; `-b main` and `core.autocrlf false` only make the session independent of your own `init.defaultBranch` setting and line-ending warnings, as in the two articles this one builds on. `main` and `annotate` share "Add March books" as their merge base and have each gained a commit the other lacks, so neither tip is an ancestor of the other.

Two copies of these branches are made before anything changes them, one pair to merge and one to rebase, so both operations start from the identical graph above:

```bash run
git branch main-for-rebase main
git branch annotate-for-rebase annotate
git branch
```

```text output
  annotate
  annotate-for-rebase
* main
  main-for-rebase
```

<figure class="diagram">
<svg viewBox="0 0 360 216" role="img" aria-labelledby="rvm-start-title rvm-start-desc">
<title id="rvm-start-title">The starting graph shared by both demonstrations</title>
<desc id="rvm-start-desc">Two commits, Start the log and Add March books, form a line. From Add March books two lines diverge: one to Add April books, kept by main and main-for-rebase, and one to a two-commit chain ending at Note: borrowed Hyperion, kept by annotate and annotate-for-rebase.</desc>
<defs>
<marker id="rvm-start-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-stroke"/></marker>
</defs>
<rect x="10" y="10" width="150" height="34" rx="6" class="d-box"/>
<text x="85" y="32" text-anchor="middle">Start the log</text>
<path d="M160 27 H182" class="d-line" marker-end="url(#rvm-start-arrow)"/>
<rect x="184" y="10" width="166" height="34" rx="6" class="d-box"/>
<text x="267" y="32" text-anchor="middle">Add March books</text>
<path d="M230 44 L120 80" class="d-line" marker-end="url(#rvm-start-arrow)"/>
<path d="M300 44 L300 80" class="d-line" marker-end="url(#rvm-start-arrow)"/>
<rect x="40" y="82" width="160" height="34" rx="6" class="d-box"/>
<text x="120" y="104" text-anchor="middle">Add April books</text>
<text x="120" y="128" text-anchor="middle" class="d-small d-muted">main, main-for-rebase</text>
<rect x="220" y="82" width="130" height="34" rx="6" class="d-box"/>
<text x="285" y="104" text-anchor="middle" class="d-small">reread Dune</text>
<path d="M285 116 V138" class="d-line" marker-end="url(#rvm-start-arrow)"/>
<rect x="220" y="140" width="130" height="34" rx="6" class="d-box"/>
<text x="285" y="158" text-anchor="middle" class="d-small">borrowed</text>
<text x="285" y="172" text-anchor="middle" class="d-small">Hyperion</text>
<text x="285" y="194" text-anchor="middle" class="d-small d-muted">annotate,</text>
<text x="285" y="208" text-anchor="middle" class="d-small d-muted">annotate-for-rebase</text>
</svg>
<figcaption>Figure 1. The graph both demonstrations below start from. "reread Dune" and "borrowed Hyperion" are two separate commits, drawn close together for space.</figcaption>
</figure>

## What `git merge` writes to the graph

On `main`, merge in `annotate`. The two branches touched different lines of `log.txt` (the March lines versus a new April line), so there is nothing to resolve by hand:

::::exercise[Rule out the easy case first]
Before running the merge, decide whether Git can get away with just moving a pointer. Is `main`'s tip an ancestor of `annotate`'s tip, or the other way around? Work it out from Figure 1, then check both directions with `git merge-base --is-ancestor`, which "checks if the first commit is an ancestor of the second, and exits with status 0 if true, or with status 1 if not" ([git-merge-base](https://git-scm.com/docs/git-merge-base)).

:::solution
Neither is true. `main` gained "Add April books" after the split, and `annotate` gained two commits of its own; each tip has a commit the other's history lacks, so a fast-forward is impossible and a merge commit is the only outcome.

```bash run
git merge-base --is-ancestor \
  main annotate ||
  echo 'main is not an ancestor of annotate'
git merge-base --is-ancestor \
  annotate main ||
  echo 'annotate is not an ancestor of main'
```

```text output
main is not an ancestor of annotate
annotate is not an ancestor of main
```
:::
::::

```bash run
git merge --no-edit annotate
git log --graph --format='%s%d' main annotate
```

```text output
Auto-merging log.txt
Merge made by the 'ort' strategy.
 log.txt | 4 ++--
 1 file changed, 2 insertions(+), 2 deletions(-)
*   Merge branch 'annotate' (HEAD -> main)
|\
| * Note: borrowed Hyperion (annotate-for-rebase, annotate)
| * Note: reread Dune
* | Add April books (main-for-rebase)
|/
* Add March books
* Start the reading log
```

The [git-merge documentation](https://git-scm.com/docs/git-merge) describes what just happened as recording "the result in a new commit along with the names of the two parent commits". That new commit is the only thing that changed: "Start the reading log" through "Add April books" and "Note: reread Dune" through "Note: borrowed Hyperion" all kept the hashes they already had, and `annotate` still names its own tip, unmoved. Merging is additive: it names a point where two histories rejoin without touching either one.

<figure class="diagram">
<svg viewBox="0 0 360 200" role="img" aria-labelledby="rvm-merge-title rvm-merge-desc">
<title id="rvm-merge-title">After git merge annotate, on main</title>
<desc id="rvm-merge-desc">The same two commits, Add April books and Note: borrowed Hyperion, both now point down to a new merge commit. The ref main points to the merge commit. The ref annotate still points to Note: borrowed Hyperion, unchanged.</desc>
<defs>
<marker id="rvm-merge-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-stroke"/></marker>
<marker id="rvm-merge-arrow-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-accent"/></marker>
</defs>
<rect x="30" y="10" width="150" height="34" rx="6" class="d-box"/>
<text x="105" y="32" text-anchor="middle" class="d-small">Add April books</text>
<rect x="190" y="10" width="150" height="34" rx="6" class="d-box"/>
<text x="265" y="32" text-anchor="middle" class="d-small">borrowed Hyperion</text>
<path d="M140 90 L110 48" class="d-accent" marker-end="url(#rvm-merge-arrow-a)"/>
<text x="90" y="72" text-anchor="end" class="d-small d-text-accent">parent 1</text>
<path d="M190 90 L250 48" class="d-accent" marker-end="url(#rvm-merge-arrow-a)"/>
<text x="255" y="72" class="d-small d-text-accent">parent 2</text>
<rect x="85" y="92" width="190" height="40" rx="6" class="d-box-accent"/>
<text x="180" y="117" text-anchor="middle" class="d-bold">Merge branch 'annotate'</text>
<rect x="10" y="144" width="60" height="28" rx="14" class="d-box-2"/>
<text x="40" y="163" text-anchor="middle" class="d-mono d-bold">main</text>
<path d="M70 158 H83" class="d-line" marker-end="url(#rvm-merge-arrow)"/>
<rect x="264" y="144" width="82" height="28" rx="14" class="d-box-2"/>
<text x="305" y="163" text-anchor="middle" class="d-mono">annotate</text>
<path d="M305 144 V48" class="d-line" marker-end="url(#rvm-merge-arrow)"/>
<text x="10" y="192" class="d-small d-muted">Both originals still exist; one new commit joins them.</text>
</svg>
<figcaption>Figure 2. Merging never moves an existing commit. It adds one, with two parent links, and moves only the branch you were on.</figcaption>
</figure>

## What `git rebase` writes instead

Now do the same job on the untouched copies, `main-for-rebase` and `annotate-for-rebase`, with rebase rather than merge:

```bash run
git switch -q annotate-for-rebase
before_tip=$(git rev-parse annotate-for-rebase)
git rebase main-for-rebase
after_tip=$(git rev-parse annotate-for-rebase)
echo "tip is the same commit: $([ "$before_tip" = "$after_tip" ] && echo yes || echo no)"
git log --graph --format='%s%d' \
  main-for-rebase annotate-for-rebase
```

```text output
tip is the same commit: no
* Note: borrowed Hyperion (HEAD -> annotate-for-rebase)
* Note: reread Dune
* Add April books (main-for-rebase)
* Add March books
* Start the reading log
```

A plain rebase like this one never opens an editor. The [git-rebase documentation](https://git-scm.com/docs/git-rebase)'s own summary of what happened is: check out the upstream commit, then "replay the commits, one by one, in order. This is similar to running `git cherry-pick` for each commit". `annotate-for-rebase` is a straight line now, four commits deep instead of the fork Figure 1 showed, and the two commits that used to sit on top of "Add March books" sit on top of "Add April books" instead. Both messages survived unchanged, but neither survived as the same object: `before_tip` and `after_tip` differ, and so does every commit between the fork point and the tip, because a commit's hash covers its parent, and the parent of the first replayed commit is no longer "Add March books".

The two "Note: reread Dune" commits, `annotate~1` and `annotate-for-rebase~1`, are different objects, but the one line either of them actually changed reads the same either way:

```bash run
git rev-parse annotate~1
git rev-parse annotate-for-rebase~1
echo "-- the Dune line each one produced:"
git show annotate~1:log.txt | grep Dune
git show annotate-for-rebase~1:log.txt |
  grep Dune
```

```text output
ac26f6b58281449f4fa4079c23f7479123b68011
e3d0a89b599d07a1a40a1e30ca4c349833244ae4
-- the Dune line each one produced:
Mar: Dune -- reread
Mar: Dune -- reread
```

Different commit, same edit. Their full trees are not equal either, because `annotate-for-rebase~1`'s tree also carries "Apr: The Fifth Season" (it sits on top of "Add April books" now, and every tree is a complete snapshot, not a diff); but a commit's identity does not depend only on its tree. It also hashes its parent, and the parents differ, "Add March books" on one side and "Add April books" on the other. That is the whole mechanism behind "rebase changes hashes": the edit `sed` made is reproduced exactly, and the hash still changes, because a commit ID is a function of where it sits in the graph as well as what it contains.

The original "Note: reread Dune" and "Note: borrowed Hyperion" did not stop existing. `annotate` (not `annotate-for-rebase`) still names them, which is the only reason they are still reachable; a rebase that was not shadowed by a second, untouched branch name would leave them dangling in exactly the sense the [prerequisite on Git internals](/version-control/how-git-works/#a-branch-is-a-41-byte-file-and-a-log-line) describes for any commit nothing points at. Recovering from a rebase you did not mean to run, before `git gc` sweeps those dangling commits away, is the reflog's job, and it deserves its own worked example rather than a paragraph here.

<figure class="diagram">
<svg viewBox="0 0 360 260" role="img" aria-labelledby="rvm-rebase-title rvm-rebase-desc">
<title id="rvm-rebase-title">After git rebase main-for-rebase, on annotate-for-rebase</title>
<desc id="rvm-rebase-desc">Add April books now has one line continuing straight up through two new commits, reread Dune prime and borrowed Hyperion prime, which the ref annotate-for-rebase points to. Off to the side, unconnected to this line, the original reread Dune and borrowed Hyperion commits remain, still named by the ref annotate.</desc>
<defs>
<marker id="rvm-rebase-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-stroke"/></marker>
<marker id="rvm-rebase-arrow-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-accent"/></marker>
</defs>
<rect x="80" y="10" width="150" height="30" rx="6" class="d-box"/>
<text x="155" y="30" text-anchor="middle" class="d-small">Add April books</text>
<path d="M155 66 V40" class="d-accent" marker-end="url(#rvm-rebase-arrow-a)"/>
<rect x="80" y="68" width="150" height="30" rx="6" class="d-box-accent"/>
<text x="155" y="88" text-anchor="middle" class="d-small">reread Dune, new hash</text>
<path d="M155 124 V98" class="d-accent" marker-end="url(#rvm-rebase-arrow-a)"/>
<rect x="80" y="126" width="150" height="30" rx="6" class="d-box-accent"/>
<text x="155" y="146" text-anchor="middle" class="d-small">borrowed Hyperion, new</text>
<rect x="88" y="160" width="134" height="26" rx="13" class="d-box-2"/>
<text x="155" y="177" text-anchor="middle" class="d-mono d-small">annotate-for-rebase</text>
<path d="M155 160 V156" class="d-line" marker-end="url(#rvm-rebase-arrow)"/>
<rect x="20" y="200" width="120" height="26" rx="6" class="d-box-2 d-dashed"/>
<text x="80" y="217" text-anchor="middle" class="d-small d-muted">original 2 commits</text>
<rect x="20" y="230" width="80" height="26" rx="13" class="d-box-2"/>
<text x="60" y="247" text-anchor="middle" class="d-mono d-small">annotate</text>
<path d="M60 230 V226" class="d-line" marker-end="url(#rvm-rebase-arrow)"/>
</svg>
<figcaption>Figure 3. Rebase never edits a commit in place: it writes new ones after the new base and moves the branch pointer. The old commits are untouched too, but only <code>annotate</code> still leads to them.</figcaption>
</figure>

::::exercise[Read the graph before you run it]
Both `main` and `main-for-rebase` still point at "Add April books" (merging `main` never touched `main-for-rebase`, and rebasing `annotate-for-rebase` never touched `main-for-rebase` either, since rebase only moves the branch that was checked out). Given that, and the rebase output above, predict what `git log --graph --format='%s%d' --all` prints for the whole repository now: how many branch labels does "Add April books" carry, and how many separate commits carry the text "Note: reread Dune" as a subject?

:::solution
"Add April books" carries two labels, `main` and `main-for-rebase`, since only one of the two copies was ever rebased or merged onto. "Note: reread Dune" appears as the subject of two different commits: the untouched original (named only by `annotate`) and the replayed one (named only by `annotate-for-rebase`, until the next section changes it again).

```bash run
git log --graph --format='%s%d' --all |
  grep -c 'reread Dune'
```

```text output
2
```
:::
::::

## Squashing with interactive rebase

Interactive rebase runs the same replay, but lets you edit the list of commits first: reorder them, drop them, or change `pick` to `reword`, `edit`, `squash` or `fixup` for one of them ([git-rebase](https://git-scm.com/docs/git-rebase), INTERACTIVE MODE). A common use is folding a small correction into the commit it belongs with, rather than leaving it as its own line in the log. Suppose the "reread" note on Dune should have said when the reread happened:

```bash run
sed -i \
  's/Dune -- reread/Dune -- reread in April/' \
  log.txt
git commit -q -a \
  --fixup=HEAD~1
git log --format='%s' -3
```

```text output
fixup! Note: reread Dune
Note: borrowed Hyperion
Note: reread Dune
```

`--fixup=HEAD~1` names the target by its position, "the commit before the current tip", which was "Note: reread Dune" before this new commit existed. The [git-commit documentation](https://git-scm.com/docs/git-commit) says plain `--fixup=<commit>` "creates a 'fixup!' commit which changes the content of `<commit>` but leaves its log message untouched", titled with `fixup!` followed by the target's own subject line, specifically so that `git rebase --autosquash` can find it later by that title.

```bash run
git rev-list --count annotate-for-rebase
GIT_SEQUENCE_EDITOR=true \
  git rebase -i --autosquash \
  main-for-rebase
git rev-list --count annotate-for-rebase
git log --format='%s' \
  main-for-rebase..annotate-for-rebase
```

```text output
6
5
Note: borrowed Hyperion
Note: reread Dune
```

`--autosquash` moves the fixup commit's todo line "right after the commit they modify" and changes its action from `pick` to `fixup` ([git-rebase](https://git-scm.com/docs/git-rebase), `--autosquash`); `GIT_SEQUENCE_EDITOR=true` accepts that rewritten plan without opening an editor, and a plain fixup needs no message editor either. Six commits went in, five came out: the fixup commit is gone, its change is inside "Note: reread Dune", and that commit has yet another new hash, because rebase, interactive or not, only ever writes new commits.

```bash run
git show annotate-for-rebase~1:log.txt |
  grep Dune
```

```text output
Mar: Dune -- reread in April
```

## The golden rule, and why

The [Pro Git book](https://git-scm.com/book/en/v2/Git-Branching-Rebasing) states the rule plainly, under the heading "The Perils of Rebasing": "Do not rebase commits that exist outside your repository and that people may have based work on." The [git-rebase documentation](https://git-scm.com/docs/git-rebase) reaches the same place from the command's own notes: "Rebasing (or any other form of rewriting) a branch that others have based work on is a bad idea: anyone downstream of it is forced to manually fix their history. ... The real fix, however, would be to avoid rebasing the upstream in the first place."

The reasoning follows directly from what this page has already shown twice over: a rebase does not edit a commit, it writes a new one with the same tree and a different parent, so the old and new versions are unrelated objects that happen to have the same content. If `annotate` had already been pushed and a teammate had fetched it and built a commit of their own on top of the original "Note: borrowed Hyperion", replacing `annotate` with `annotate-for-rebase` and force-pushing would not update their copy for them. Their branch still points at the original commit, which is not an ancestor of the new tip (the new tip's ancestry runs through "Add April books" instead), so their next ordinary `git pull` would try to reconcile two histories that share only the much older "Add March books" (or, if they too rebase onto the replaced branch, their commit gets replayed a second time, and Git cannot tell that it was already there).

::::exercise[What the force-push changes for someone else]
You have not force-pushed anything in this walk-through; every branch here is local. If you had pushed `annotate`, then run the two rebase sections above and pushed `annotate-for-rebase` to the same remote name with `git push --force`, name one command a teammate who already has the old `annotate` could run to see exactly which of their assumptions broke.

:::solution
`git merge-base --is-ancestor annotate origin/annotate` (after a `git fetch`) now exits 1: the commit their local branch is built on is no longer an ancestor of what the remote calls `annotate`. That is the same check this page already used to show a fast-forward was impossible for the original merge, applied to the question "is my work still downstream of yours" instead of "did our branches diverge". Either answer is a plain fact about the graph, not something Git has an opinion about; the golden rule is a recommendation about when to put a teammate in that position, not a technical limitation of `rebase` itself.
:::
::::

## Choosing merge or rebase for a shared branch

Both are correct; they optimize the resulting graph for different questions.

A history built entirely from merges keeps a record of when each branch of work landed, because every join is its own commit naming both sides. Rebasing onto `main` before merging, or configuring a remote to require it, removes that record along with the fork: the log reads as if the work had been written in one pass, in the replayed order, directly on `main`.

`git bisect` gives one concrete reason to prefer the record. Its own documentation describes `--first-parent`, which is needed specifically because ordinary bisection can walk into either side of a merge: "In detecting regressions introduced through the merging of a branch, the merge commit will be identified as introduction of the bug and its ancestors will be ignored. This option is particularly useful in avoiding false positives when a merged branch contained broken or non-buildable commits, but the merge itself was OK" ([git-bisect](https://git-scm.com/docs/git-bisect)). That option exists because, without it, a bisection can walk into commits from inside a merged branch that were never individually correct on their own, such as an intermediate commit that does not even build; a linear, rebased history has no such intermediate commits to walk into; on our repository, `git rev-list --min-parents=2 --count main` is 1 and the same count against `annotate-for-rebase` is 0.

A team that wants both, an audit trail of when work integrated and a `bisect`-friendly line of commits, gets it by rebasing feature work before merging, so the branch itself is linear and the one merge commit still marks the join; that trade only becomes the golden rule's problem the moment the feature branch is something someone else has already pulled. Which policy a team settles on is usually decided alongside its larger branching workflow, trunk-based development, GitHub-Flow-style pull requests, or Git Flow's longer-lived branches, rather than as a rule about `merge` and `rebase` in isolation.

Pull request review tools that comment on a specific commit or line inherit the same fact, without needing a tool-specific claim to state it: a commit ID is what a comment or a CI run is attached to, and this page has shown that a rebase always changes that ID for every commit from the fork point on, even when nothing about the content changed. Rewriting a branch mid-review invalidates whatever was anchored to the old IDs; merging in new work as its own commits does not.

## Telling a merged history from a rebased one

Reading `git log --graph` is the direct way, but two counts settle it without a graph at all. A branch with any merge commits has `git rev-list --min-parents=2 --count <ref>` greater than zero; a branch that only ever received rebased, linear work does not, whatever its commit messages say about "merging" something in conversation.

::::exercise[Extend the check to a branch that did neither]
`annotate` itself was never merged into anything and never rebased onto anything; it only diverged. Apply the same `--min-parents=2` count to it and say, before running it, whether you expect the same answer as `annotate-for-rebase` got above and why.

:::solution
The same answer, 0, but for a different reason: `annotate-for-rebase` has no merge commits because rebasing replaced its history with a flat replay, while `annotate` has no merge commits because nothing has ever joined into it at all. The count alone cannot distinguish "linearized" from "never combined"; reading the commit subjects, or the count of commits since the merge base, tells them apart.

```bash run
git rev-list --min-parents=2 \
  --count annotate
```

```text output
0
```
:::
::::

The reflog adds a second, more local clue, though only on a machine that did the work: a rebase leaves entries like `rebase (start)`, `rebase (pick)` and `rebase (finish)` for the ref it moved, while a merge leaves a single `merge annotate: Merge made by...` entry. [How Git Works Inside](/version-control/how-git-works/) already covers why that trail does not survive a clone: the reflog is local bookkeeping, never pushed and never fetched.
