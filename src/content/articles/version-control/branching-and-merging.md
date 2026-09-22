---
title: "Git Branching and Merging, Including Conflicts"
description: "Follow one small repository through a fast-forward, a three-way merge, a real conflict and an octopus merge, and see what Git records at each step."
pillar: version-control
order: 2
author: markus
published: 2026-09-21
updated: 2026-09-21
level: beginner
tags: [git, merging, branching, merge-conflicts]
prerequisites: ["version-control/how-git-works"]
sources:
  - title: "git-merge"
    url: "https://git-scm.com/docs/git-merge"
    publisher: "Git documentation"
    accessed: 2026-09-18
  - title: "git-merge-base"
    url: "https://git-scm.com/docs/git-merge-base"
    publisher: "Git documentation"
    accessed: 2026-09-18
  - title: "git-merge-file"
    url: "https://git-scm.com/docs/git-merge-file"
    publisher: "Git documentation"
    accessed: 2026-09-18
  - title: "git-ls-files"
    url: "https://git-scm.com/docs/git-ls-files"
    publisher: "Git documentation"
    accessed: 2026-09-18
  - title: "git-checkout"
    url: "https://git-scm.com/docs/git-checkout"
    publisher: "Git documentation"
    accessed: 2026-09-18
  - title: "git-switch"
    url: "https://git-scm.com/docs/git-switch"
    publisher: "Git documentation"
    accessed: 2026-09-18
  - title: "git-branch"
    url: "https://git-scm.com/docs/git-branch"
    publisher: "Git documentation"
    accessed: 2026-09-18
  - title: "git-diff (--check, combined diff format)"
    url: "https://git-scm.com/docs/git-diff"
    publisher: "Git documentation"
    accessed: 2026-09-18
  - title: "git-show (--diff-merges, --remerge-diff)"
    url: "https://git-scm.com/docs/git-show"
    publisher: "Git documentation"
    accessed: 2026-09-18
  - title: "git-status (short format codes)"
    url: "https://git-scm.com/docs/git-status"
    publisher: "Git documentation"
    accessed: 2026-09-18
  - title: "git-mergetool"
    url: "https://git-scm.com/docs/git-mergetool"
    publisher: "Git documentation"
    accessed: 2026-09-18
  - title: "git-revert"
    url: "https://git-scm.com/docs/git-revert"
    publisher: "Git documentation"
    accessed: 2026-09-18
  - title: "gitrevisions: specifying revisions and ranges"
    url: "https://git-scm.com/docs/gitrevisions"
    publisher: "Git documentation"
    accessed: 2026-09-18
  - title: "Pro Git, 2nd ed., section 3.2: Basic Branching and Merging"
    url: "https://git-scm.com/book/en/v2/Git-Branching-Basic-Branching-and-Merging"
    publisher: "git-scm.com"
    accessed: 2026-09-18
  - title: "Pro Git, 2nd ed., section 7.8: Advanced Merging"
    url: "https://git-scm.com/book/en/v2/Git-Tools-Advanced-Merging"
    publisher: "git-scm.com"
    accessed: 2026-09-18
draft: false
---

Run with default options on two branches of one project, `git merge` has three possible outcomes, and the shape of the history picks one before any file is compared. If the other branch is already contained in yours, nothing happens. If yours is contained in the other, Git moves a pointer and creates nothing. When each side has commits the other lacks, Git builds a new commit, and that is the case in which a conflict can occur. (Two histories with no commit in common are a fourth case, which `git merge` refuses unless you pass `--allow-unrelated-histories`, according to the [git-merge documentation](https://git-scm.com/docs/git-merge); it does not come up in this walk-through.)

This walk-through drives one small repository through all three, then through a conflict, a merge that succeeds and is still wrong, and a merge of three branches at once. It builds on [How Git Works Inside](/version-control/how-git-works/), which shows that a commit is a snapshot plus parent links and that a branch is [a 41-byte file holding a commit ID](/version-control/how-git-works/#a-branch-is-a-41-byte-file-and-a-log-line). Neither idea is explained again here.

## The project: a coffee kiosk in four files

The repository holds a kiosk's menu, its opening hours, a list of specials, and a four-line script that checks every special is on the menu. Type along in any empty directory; the session below ran under Git 2.52 in Git Bash on Windows.

```bash run
git init -q -b main kiosk
cd kiosk
git config core.autocrlf false
cat > menu.txt <<'EOF'
espresso       2.80
latte          3.90
flat white     3.70
mocha          4.20
hot choc       3.50
tea            2.60
EOF
cat > hours.txt <<'EOF'
Mon-Fri  07:00-17:00
Sat      08:00-14:00
Sun      closed
EOF
echo 'mocha' > specials.txt
cat > check.sh <<'EOF'
while read -r item; do
  grep -q "^$item  " menu.txt ||
    echo "not on the menu: $item"
done < specials.txt
EOF
git add .
git commit -q -m 'Open the kiosk'
git log --format='%s%d'
```

```text output
Open the kiosk (HEAD -> main)
```

`-b main` names the first branch explicitly, so the session does not depend on your `init.defaultBranch` setting. The `autocrlf` line only stops Git for Windows from warning about line endings. The format string `%s%d` prints each commit's subject followed by the refs that point at it, and it is used for every history listing below because commit IDs are hashes that depend on your name and clock and will differ from machine to machine. Where a command insists on printing IDs, the output panels show `[...]` in their place.

## A branch for the autumn menu

`git switch -c autumn` creates a branch at the current commit and makes `HEAD` name it, in one step ([git-switch](https://git-scm.com/docs/git-switch)). From then on, `git commit` advances `autumn` and leaves `main` where it was.

```bash run
git switch -q -c autumn
echo 'pumpkin latte  4.60' >> menu.txt
git commit -q -a -m 'Add pumpkin latte'
echo 'chai           3.80' >> menu.txt
git commit -q -a -m 'Add chai'
git log --graph --format='%s%d'
```

```text output
* Add chai (HEAD -> autumn)
* Add pumpkin latte
* Open the kiosk (main)
```

The history is a straight line. `main` sits two commits behind `autumn`, and every commit reachable from `main` is also reachable from `autumn`. Git can test that relationship directly. `git merge-base --is-ancestor A B` exits with status 0 when `A` is an ancestor of `B` and 1 when it is not ([git-merge-base](https://git-scm.com/docs/git-merge-base)):

```bash run
git merge-base --is-ancestor \
  main autumn &&
  echo 'main is an ancestor of autumn'
git merge-base --is-ancestor \
  autumn main ||
  echo 'autumn is not one of main'
```

```text output
main is an ancestor of autumn
autumn is not one of main
```

`&&` runs the `echo` only after exit status 0, and `||` only after a non-zero one.

## Fast-forward: the merge that creates nothing

You merge *into* the branch you are on. To bring the autumn items into `main`, switch to `main` and name the other branch:

```bash run
git switch -q main
git rev-list --count --all
git merge autumn
echo "-- commits in the repository:"
git rev-list --count --all
git log --graph --format='%s%d'
```

```text output
3
Updating [...]
Fast-forward
 menu.txt | 2 ++
 1 file changed, 2 insertions(+)
-- commits in the repository:
3
* Add chai (HEAD -> main, autumn)
* Add pumpkin latte
* Open the kiosk
```

Three commits before, three after. Because `main` was an ancestor of `autumn`, there were no changes on `main` to combine with anything, and the correct result was exactly the snapshot `autumn` already had. Git updated the `main` ref, the index and the working files to that commit and wrote no new commit. The [git-merge documentation](https://git-scm.com/docs/git-merge) calls this a *fast-forward* and says "a new commit is not needed to store the combined history".

<figure class="diagram">
<svg viewBox="0 0 360 330" role="img" aria-labelledby="ff-title ff-desc">
<title id="ff-title">A fast-forward merge moves the main ref along an existing line of commits</title>
<desc id="ff-desc">Before the merge, three commits form a line: Open, pumpkin, chai. The ref main points to Open and the ref autumn points to chai. After the merge the same three commits exist and both main and autumn point to chai.</desc>
<defs>
<marker id="ff-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-stroke"/></marker>
<marker id="ff-arrow-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-accent"/></marker>
</defs>
<text x="10" y="20" class="d-bold">Before: git merge autumn, on main</text>
<rect x="10" y="40" width="96" height="40" rx="6" class="d-box"/>
<text x="58" y="65" text-anchor="middle">Open</text>
<path d="M132 60 H108" class="d-line" marker-end="url(#ff-arrow)"/>
<rect x="132" y="40" width="96" height="40" rx="6" class="d-box"/>
<text x="180" y="65" text-anchor="middle">pumpkin</text>
<path d="M254 60 H230" class="d-line" marker-end="url(#ff-arrow)"/>
<rect x="254" y="40" width="96" height="40" rx="6" class="d-box"/>
<text x="302" y="65" text-anchor="middle">chai</text>
<rect x="24" y="106" width="68" height="30" rx="15" class="d-box-accent"/>
<text x="58" y="126" text-anchor="middle" class="d-mono d-bold">main</text>
<path d="M58 106 V82" class="d-accent" marker-end="url(#ff-arrow-a)"/>
<rect x="264" y="106" width="76" height="30" rx="15" class="d-box-2"/>
<text x="302" y="126" text-anchor="middle" class="d-mono">autumn</text>
<path d="M302 106 V82" class="d-line" marker-end="url(#ff-arrow)"/>
<path d="M10 160 H350" class="d-line d-dashed"/>
<text x="10" y="192" class="d-bold">After: same commits, one ref moved</text>
<rect x="10" y="212" width="96" height="40" rx="6" class="d-box"/>
<text x="58" y="237" text-anchor="middle">Open</text>
<path d="M132 232 H108" class="d-line" marker-end="url(#ff-arrow)"/>
<rect x="132" y="212" width="96" height="40" rx="6" class="d-box"/>
<text x="180" y="237" text-anchor="middle">pumpkin</text>
<path d="M254 232 H230" class="d-line" marker-end="url(#ff-arrow)"/>
<rect x="254" y="212" width="96" height="40" rx="6" class="d-box"/>
<text x="302" y="237" text-anchor="middle">chai</text>
<rect x="176" y="278" width="68" height="30" rx="15" class="d-box-accent"/>
<text x="210" y="298" text-anchor="middle" class="d-mono d-bold">main</text>
<path d="M232 278 L276 254" class="d-accent" marker-end="url(#ff-arrow-a)"/>
<rect x="264" y="278" width="76" height="30" rx="15" class="d-box-2"/>
<text x="302" y="298" text-anchor="middle" class="d-mono">autumn</text>
<path d="M310 278 V254" class="d-line" marker-end="url(#ff-arrow)"/>
</svg>
<figcaption>Figure 1. Arrows between commits point from child to parent, the direction Git stores. The top and bottom rows contain the same three commits; the only thing the fast-forward changed is which commit <code>main</code> names.</figcaption>
</figure>

::::exercise[The merge in the other direction]
`main` and `autumn` now name the same commit. Switch to `autumn` and run `git merge main`. Which of the three outcomes do you get, and what does Git print?

:::solution
Every commit on `main` is already in `autumn`'s history, so there is nothing to do. The documentation states the rule: if all named commits are already ancestors of `HEAD`, `git merge` exits early ([git-merge](https://git-scm.com/docs/git-merge)).

```bash run
git switch -q autumn
git merge main
git switch -q main
```

```text output
Already up to date.
```

The same message appears whenever you merge a branch that is behind yours, which makes it a quick way to find out that you merged in the wrong direction.
:::
::::

When you merge a branch under Git's default configuration, a fast-forward happens if one is possible. Two options change that, and the `merge.ff` configuration key makes either of them the default, so a machine with `merge.ff=false` prints something different above ([git-merge](https://git-scm.com/docs/git-merge)):

- `--no-ff` creates a merge commit even when a fast-forward would do. The history then records that these two commits arrived together as one branch, at the cost of a commit that carries no change of its own.
- `--ff-only` fast-forwards or refuses with a non-zero exit status. It suits a branch that should never gain local merge commits, such as your copy of a shared `main` that you only ever update.

Which of the two a team prefers is policy, not correctness: the resulting files are identical either way.

A third option, `--squash`, resembles a merge and, going by what it records, is not one. It leaves the index and working files as a merge would have, but makes no commit and does not record `MERGE_HEAD` ([git-merge](https://git-scm.com/docs/git-merge)), so nothing gives your next commit a second parent. The commit you then create has one parent, so the history does not show that the branch was merged, and `git branch -d` will still call the branch unmerged (checked in Git 2.52: "not fully merged").

## When both branches have moved: the three-way merge

Now make the histories diverge. A `sunday` branch opens the kiosk on Sundays and drops the price of tea; meanwhile `main` raises the price of espresso.

:::note
Edits from here on are scripted with `sed -i`, so that the page is reproducible. Each one reads: on the lines that match the first pattern, swap the old text for the new. `sed -i` with no argument is the GNU form, which Git Bash and Linux have. On macOS write `sed -i ''` every time it appears below, or make the same edits in an editor.
:::

```bash run
git switch -q -c sunday
sed -i '/^Sun /s/closed/09:00-13:00/' \
  hours.txt
sed -i '/^tea /s/2.60/2.40/' menu.txt
git commit -q -a \
  -m 'Open Sundays, cheaper tea'
git switch -q main
sed -i '/^espresso /s/2.80/3.00/' \
  menu.txt
git commit -q -a \
  -m 'Raise espresso to 3.00'
git log --graph --format='%s%d' --all
```

```text output
* Raise espresso to 3.00 (HEAD -> main)
| * Open Sundays, cheaper tea (sunday)
|/
* Add chai (autumn)
* Add pumpkin latte
* Open the kiosk
```

Neither tip is an ancestor of the other, so no pointer move can produce the right answer. The right answer is a snapshot that contains both sets of changes, and to know what each side *changed* Git needs a third snapshot to compare them against: the point where they diverged.

That point is the *merge base*. The commit history is a directed acyclic [graph](/glossary/#graph), and a merge base is a *best* common ancestor of the two tips: a common ancestor that is not an ancestor of any other common ancestor ([git-merge-base](https://git-scm.com/docs/git-merge-base)). "Open the kiosk" is a common ancestor of both tips here, but "Add chai" is a better one.

Finding it means walking parent links back from both tips until the walks meet, so the work grows with the number of commits made since the branches diverged and, at worst, with the size of the whole history.

```bash run
base=$(git merge-base main sunday)
git log -1 --format='%s' $base
echo "-- base to main:"
git diff --stat $base main | sed '$d'
echo "-- base to sunday:"
git diff --stat $base sunday | sed '$d'
```

```text output
Add chai
-- base to main:
 menu.txt | 2 +-
-- base to sunday:
 hours.txt | 2 +-
 menu.txt  | 2 +-
```

Both sides changed `menu.txt`. The merge goes through anyway:

```bash run
git merge --no-edit sunday
echo "-- menu.txt after the merge:"
cat menu.txt
```

```text output
Auto-merging menu.txt
Merge made by the 'ort' strategy.
 hours.txt | 2 +-
 menu.txt  | 2 +-
 2 files changed, 2 insertions(+), 2 deletions(-)
-- menu.txt after the merge:
espresso       3.00
latte          3.90
flat white     3.70
mocha          4.20
hot choc       3.50
tea            2.40
pumpkin latte  4.60
chai           3.80
```

Without `--no-edit`, Git opens your editor on the proposed message `Merge branch 'sunday'` first. The merged menu has the 3.00 espresso from `main` and the 2.40 tea from `sunday`. The diffstat lists only what came in from `sunday`, because it compares the merge with where `main` was.

### The rule Git applies to every file, then to every region

For each path, Git looks at three versions: base, ours (the branch you are on) and theirs (the branch you named). For a text file that exists in all three, which covers every file so far, the rule is:

| Since the base | Result |
|---|---|
| neither side changed it | keep it |
| one side changed it | take that side |
| both, identically | take it once |
| both, differently | merge by lines |

`hours.txt` fell under the second row: only `sunday` had touched it, so its version was taken whole without reading a line. `menu.txt` fell under the fourth, which is what the `Auto-merging menu.txt` message reports.

There Git compares base with ours and base with theirs, and applies the same four rows to each changed region of lines. The espresso change and the tea change are in separate regions with unchanged lines between them, so each region had a single claimant and both were applied. A *content conflict* is the fourth row at the level of a region: both sides changed the same stretch of lines, in different ways ([git-merge-file](https://git-scm.com/docs/git-merge-file)). Files that were deleted, added or are not text cannot be handled this way, and they produce [conflicts of another kind](#conflicts-with-no-lines-to-edit) further down.

This is why the merge needs the base and cannot work from the two tips alone. Looking only at the tips, line 1 reads `2.80` on one side and `3.00` on the other, and nothing says which is the edit and which is the original.

### The merge commit has two parents

```bash run
git log --graph --format='%s%d'
echo "-- parents of HEAD:"
git log -1 --format='%s' HEAD^1
git log -1 --format='%s' HEAD^2
```

```text output
*   Merge branch 'sunday' (HEAD -> main)
|\
| * Open Sundays, cheaper tea (sunday)
* | Raise espresso to 3.00
|/
* Add chai (autumn)
* Add pumpkin latte
* Open the kiosk
-- parents of HEAD:
Raise espresso to 3.00
Open Sundays, cheaper tea
```

A merge commit is an ordinary commit object with more than one `parent` line, which is the one thing [Pro Git 3.2](https://git-scm.com/book/en/v2/Git-Branching-Basic-Branching-and-Merging) singles out as special about it. Its tree is the merged snapshot, stored in full like any other. `HEAD^1` is the first parent, the commit you were on when you ran the merge; `HEAD^2` is the tip you merged in ([gitrevisions](https://git-scm.com/docs/gitrevisions)). The order is worth remembering, because "first parent" is how `git log --first-parent`, `HEAD~1` and `git revert -m 1` tell the mainline from the branch that joined it. Only `main` moved: `sunday` still names its own commit, and it is now reachable from `main` through the second parent link.

<figure class="diagram">
<svg viewBox="0 0 360 388" role="img" aria-labelledby="tw-title tw-desc">
<title id="tw-title">A three-way merge and the merge commit it produces</title>
<desc id="tw-desc">The commit Add chai is the merge base. Two commits descend from it: Raise espresso on main, and Open Sundays, cheaper tea on sunday. A new merge commit at the bottom has the main commit as parent 1 and the sunday commit as parent 2. The ref main points to the merge commit; the ref sunday still points to its own commit.</desc>
<defs>
<marker id="tw-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-stroke"/></marker>
<marker id="tw-arrow-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-accent"/></marker>
</defs>
<rect x="105" y="10" width="150" height="56" rx="6" class="d-box-2"/>
<text x="180" y="33" text-anchor="middle" class="d-bold">Add chai</text>
<text x="180" y="54" text-anchor="middle" class="d-small d-muted">merge base</text>
<path d="M85 130 L140 68" class="d-line" marker-end="url(#tw-arrow)"/>
<path d="M275 130 L220 68" class="d-line" marker-end="url(#tw-arrow)"/>
<rect x="10" y="130" width="150" height="66" rx="6" class="d-box"/>
<text x="85" y="153" text-anchor="middle" class="d-bold">Raise espresso</text>
<text x="85" y="172" text-anchor="middle" class="d-small d-muted">ours: menu line 1</text>
<text x="85" y="188" text-anchor="middle" class="d-small d-muted">changed</text>
<rect x="200" y="130" width="150" height="66" rx="6" class="d-box"/>
<text x="275" y="153" text-anchor="middle" class="d-bold">Open Sundays</text>
<text x="275" y="172" text-anchor="middle" class="d-small d-muted">theirs: menu line 6,</text>
<text x="275" y="188" text-anchor="middle" class="d-small d-muted">hours.txt changed</text>
<rect x="237" y="222" width="76" height="30" rx="15" class="d-box-2"/>
<text x="275" y="242" text-anchor="middle" class="d-mono">sunday</text>
<path d="M275 222 V198" class="d-line" marker-end="url(#tw-arrow)"/>
<path d="M150 290 L100 198" class="d-accent" marker-end="url(#tw-arrow-a)"/>
<text x="112" y="262" text-anchor="end" class="d-small d-text-accent">parent 1</text>
<path d="M205 290 L226 198" class="d-accent" marker-end="url(#tw-arrow-a)"/>
<text x="196" y="262" text-anchor="end" class="d-small d-text-accent">parent 2</text>
<rect x="95" y="290" width="170" height="56" rx="6" class="d-box-accent"/>
<text x="180" y="313" text-anchor="middle" class="d-bold">Merge branch 'sunday'</text>
<text x="180" y="334" text-anchor="middle" class="d-small">tree: both changes</text>
<rect x="10" y="303" width="68" height="30" rx="15" class="d-box-2"/>
<text x="44" y="323" text-anchor="middle" class="d-mono d-bold">main</text>
<path d="M78 318 H93" class="d-line" marker-end="url(#tw-arrow)"/>
<text x="10" y="376" class="d-small d-muted">Inputs: three snapshots. Output: one commit, two parents.</text>
</svg>
<figcaption>Figure 2. The merge reads three snapshots (the base and the two tips) and writes one commit. Each side's change is whatever differs between it and the base, which is why the two edits to <code>menu.txt</code> could both be kept.</figcaption>
</figure>

## A real conflict, start to finish

Set up the fourth row of the table on purpose. On a branch, the latte gets a longer name; on `main`, the same line gets a new price. `main` also extends Saturday hours, a change nobody else touches.

```bash run
git switch -q -c rename-latte
sed -i 's/^latte      /caffe latte/' \
  menu.txt
git commit -q -a \
  -m 'Call it caffe latte'
git switch -q main
sed -i '/^latte /s/3.90/4.10/' \
  menu.txt
sed -i '/^Sat /s/14:00/15:00/' \
  hours.txt
git commit -q -a \
  -m 'Latte to 4.10, longer Saturdays'
```

```bash run fails
git merge rename-latte
```

```text output
Auto-merging menu.txt
CONFLICT (content): Merge conflict in menu.txt
Automatic merge failed; fix conflicts and then commit the result.
```

Git names the file, `menu.txt`, and says what it expects of you: "fix conflicts and then commit the result". The command exited with status 1 and made no commit. The repository is now in a specific, documented in-between state.

### What Git leaves behind when it stops

```bash run
git status --short
echo "-- menu.txt, first 7 lines:"
head -n 7 menu.txt
echo "-- index entries for it:"
git ls-files -u --abbrev=7
```

```text output
UU menu.txt
-- menu.txt, first 7 lines:
espresso       3.00
<<<<<<< HEAD
latte          4.10
=======
caffe latte    3.90
>>>>>>> rename-latte
flat white     3.70
-- index entries for it:
100644 [...] 1	menu.txt
100644 [...] 2	menu.txt
100644 [...] 3	menu.txt
```

`UU` means unmerged, modified on both sides. In the working file, Git merged everything it could (the espresso and tea lines are as they should be) and bracketed the one region it could not. Between `<<<<<<< HEAD` and `=======` is the region as it stands on your branch; between `=======` and `>>>>>>> rename-latte` is the same region on the branch being merged.

The index holds more than the file shows. In place of one entry for `menu.txt` it has up to three, told apart by the *stage number* in the third column ([git-merge](https://git-scm.com/docs/git-merge), [git-ls-files](https://git-scm.com/docs/git-ls-files)):

- stage 1: the file at the merge base
- stage 2: the file on your branch, `HEAD`
- stage 3: the file on the branch being merged

Each stage is a complete, marker-free file. `git show :1:menu.txt` prints stage 1, and `git diff --base`, `--ours` or `--theirs` compares the working file with stage 1, 2 or 3 ([git-diff](https://git-scm.com/docs/git-diff)). These commands only read. Graphical merge tools start from the same material: [`git mergetool`](https://git-scm.com/docs/git-mergetool) hands the configured program the base, the current branch's file and the other branch's file as three temporary files.

Alongside the index entries, Git writes the ref `MERGE_HEAD`, naming the commit being merged. Its presence is what tells a later `git commit` to record two parents.

### Backing out with `git merge --abort`

Before resolving anything, note the exit. `git merge --abort` restores the state from before the merge:

```bash run
git merge --abort
git status --short | wc -l
head -n 2 menu.txt
```

```text output
0
espresso       3.00
latte          4.10
```

No unmerged paths, no markers, `main` where it was. The guarantee has one documented gap: if you had uncommitted changes when you started the merge, `--abort` "will in some cases be unable to reconstruct" them, so the [git-merge documentation](https://git-scm.com/docs/git-merge) recommends committing or stashing first. Git already refuses to start a merge when your uncommitted changes overlap with files the merge needs to update.

### The base version turns a guess into a decision

Run the merge again. The two-sided markers show what each branch ended up with, not what each branch *did*, and the resolution depends on the latter. Ask Git to rewrite the conflicted file with the base included. This command is not read-only: it regenerates the working copy of that path from the three stages, so any resolving you have already done in the file is discarded. Run it before you start editing.

```bash run
git merge rename-latte > /dev/null ||
  true
git checkout --conflict=diff3 menu.txt
sed -n '2,8p' menu.txt
```

```text output
<<<<<<< ours
latte          4.10
||||||| base
latte          3.90
=======
caffe latte    3.90
>>>>>>> theirs
```

The middle section, after `|||||||`, is the line as it was at the merge base ([git-checkout](https://git-scm.com/docs/git-checkout) describes `--conflict`). Now each side's intent can be read off: ours kept the name and changed 3.90 to 4.10, theirs kept the price and changed the name. The two edits are compatible, and the correct line is one that neither branch contains. Picking either side whole would silently lose the other's change.

To get three-section markers on every conflict, set `merge.conflictStyle` to `diff3`, or to `zdiff3`, which additionally moves lines that are identical on both sides out of the conflict region when they sit at its start or end ([git-merge](https://git-scm.com/docs/git-merge)).

<figure class="diagram">
<svg viewBox="0 0 360 372" role="img" aria-labelledby="cf-title cf-desc">
<title id="cf-title">Why line 2 of menu.txt conflicts</title>
<desc id="cf-desc">The base version of line 2 reads latte 3.90 and is stored in the index as stage 1. On main, ours, the price changed to 4.10, stored as stage 2. On rename-latte, theirs, the name changed to caffe latte, stored as stage 3. Both changes touch the same line, so Git reports a conflict. The resolution, caffe latte 4.10, combines the two changes and is staged with git add as stage 0.</desc>
<defs>
<marker id="cf-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-stroke"/></marker>
</defs>
<text x="180" y="18" text-anchor="middle" class="d-small d-muted">stage 1: base</text>
<rect x="80" y="26" width="200" height="40" rx="6" class="d-box-2"/>
<text x="180" y="51" text-anchor="middle" class="d-mono">latte        3.90</text>
<path d="M130 66 L90 118" class="d-line" marker-end="url(#cf-arrow)"/>
<path d="M230 66 L270 118" class="d-line" marker-end="url(#cf-arrow)"/>
<text x="92" y="96" text-anchor="end" class="d-small">price edit</text>
<text x="268" y="96" class="d-small">name edit</text>
<rect x="6" y="120" width="168" height="40" rx="6" class="d-box"/>
<text x="90" y="145" text-anchor="middle" class="d-mono d-small">latte        4.10</text>
<text x="90" y="178" text-anchor="middle" class="d-small d-muted">stage 2: ours (main)</text>
<rect x="186" y="120" width="168" height="40" rx="6" class="d-box"/>
<text x="270" y="145" text-anchor="middle" class="d-mono d-small">caffe latte  3.90</text>
<text x="270" y="178" text-anchor="middle" class="d-small d-muted">stage 3: theirs</text>
<path d="M90 186 L150 222" class="d-line" marker-end="url(#cf-arrow)"/>
<path d="M270 186 L210 222" class="d-line" marker-end="url(#cf-arrow)"/>
<rect x="60" y="224" width="240" height="44" rx="6" class="d-box-bad"/>
<text x="180" y="243" text-anchor="middle" class="d-small d-bold">same region, different edits:</text>
<text x="180" y="260" text-anchor="middle" class="d-small">conflict, Git stops</text>
<path d="M180 268 V306" class="d-line" marker-end="url(#cf-arrow)"/>
<text x="188" y="292" class="d-small">you edit, then git add</text>
<rect x="80" y="308" width="200" height="40" rx="6" class="d-box-good"/>
<text x="180" y="333" text-anchor="middle" class="d-mono">caffe latte  4.10</text>
<text x="180" y="366" text-anchor="middle" class="d-small d-muted">stage 0: resolved, ready to commit</text>
</svg>
<figcaption>Figure 3. The three versions of line 2 that the index holds during the conflict, and the resolution. The resolved line matches neither branch: it applies both edits to the base.</figcaption>
</figure>

### Resolve, stage, commit

Resolving means editing the file until it is what the merged project should contain, markers gone. In an editor you would replace the seven lines of the conflict block with the one correct line. Scripted, the same edit is a `sed` command that swaps everything from the opening marker to the closing one for a single line:

```bash run
sed -i '/^<<<<<<< /,/^>>>>>>> /c\
caffe latte    4.10' menu.txt
head -n 3 menu.txt
git diff --check &&
  echo 'no markers left'
```

```text output
espresso       3.00
caffe latte    4.10
flat white     3.70
no markers left
```

:::pitfall
Git does not read the file when you mark it resolved. `git add` on a file that still has `<<<<<<<` lines in it succeeds, and in a repository without hooks so does the commit. `git diff --check` is the guard: it warns about leftover conflict markers and exits non-zero when it finds any ([git-diff](https://git-scm.com/docs/git-diff)). Run it before `git add`, because it compares the working file with the index and has nothing left to report once the file is staged. After staging, the same check is `git diff --cached --check`.
:::

`git add` replaces the three staged versions with one ordinary entry, which is how Git learns the path is resolved. With no unmerged paths left, `git commit` concludes the merge; `git merge --continue` does the same after checking that a merge is in progress ([git-merge](https://git-scm.com/docs/git-merge)).

```bash run
git add menu.txt
git ls-files -u | wc -l
git commit -q --no-edit
git show --format='%s' HEAD
```

```text output
0
Merge branch 'rename-latte'

diff --cc menu.txt
index [...]
--- a/menu.txt
+++ b/menu.txt
@@@ -1,5 -1,5 +1,5 @@@
  espresso       3.00
- latte          4.10
 -caffe latte    3.90
++caffe latte    4.10
  flat white     3.70
  mocha          4.20
  hot choc       3.50
```

For a merge commit, `git show` prints a *combined diff* with one marker column per parent ([git-diff](https://git-scm.com/docs/git-diff) describes the format). Here it says that the first parent's line and the second parent's line were both removed, and a line that is new relative to both (`++`) took their place.

Two filters decide what reaches this output, both described under `--diff-merges` in the [git-show documentation](https://git-scm.com/docs/git-show). Only files that differ from every parent are listed, which is why `hours.txt` is absent: the merged version equals the first parent's. And within a listed file, the default dense format (`--cc`) leaves out every hunk where the result is simply one parent's version. That second filter explains something you can check with `git show` on the `sunday` merge. Its `menu.txt` differs from both parents, yet no diff is printed, because each changed line is identical to one parent or the other.

So read the combined diff for exactly what it can tell you. A non-empty one shows content found in no parent, which somebody or something wrote during the merge. An empty one means every region equals some parent. That covers a clean automatic merge, and it equally covers a conflict that was resolved by taking one side whole, by hand or with `-X ours`. The lossy resolution that the base version warned against leaves no trace here.

To see what the resolver did, use `--remerge-diff` (Git 2.36 and later). For a two-parent merge, Git repeats the merge in memory, conflict markers included, and diffs that against what was committed ([git-show](https://git-scm.com/docs/git-show)):

```bash run
git show --remerge-diff --format='%s' |
  sed -n '6,$p' | cut -c1-40
```

```text output
--- a/menu.txt
+++ b/menu.txt
@@ -1,9 +1,5 @@
 espresso       3.00
-<<<<<<< [...]
-latte          4.10
-=======
-caffe latte    3.90
->>>>>>> [...]
+caffe latte    4.10
 flat white     3.70
 mocha          4.20
 hot choc       3.50
```

The removed lines are the conflict block as Git would have written it, with each side labeled by an abbreviated commit ID and that commit's subject (the two `[...]` lines) because a commit records no branch names. The added line is the resolution. A take-one-side resolution shows up here as plainly as this one does, and a merge that Git completed unaided prints no diff.

::::exercise[How close can two edits get?]
The kiosk conflict had both edits on the *same* line. Do edits to two *neighboring* lines conflict? `git merge-file -p ours base theirs` runs the file-level merge on three plain files and prints the result, with no repository needed. Its exit status is the number of conflicts ([git-merge-file](https://git-scm.com/docs/git-merge-file)).

Create a five-line base (`mon` to `fri`). In `ours`, change line 2. Merge it against a version that changes line 3, then against one that changes line 4. Decide what you expect before running it.

:::solution
```bash run
printf 'mon\ntue\nwed\nthu\nfri\n' \
  > base
sed 's/tue/TUE/' base > ours
sed 's/wed/WED/' base > line3
sed 's/thu/THU/' base > line4
git merge-file -p ours base line3 ||
  echo "-- conflicts: $?"
git merge-file -p ours base line4 &&
  echo "-- conflicts: 0"
rm base ours line3 line4
```

```text output
mon
<<<<<<< ours
TUE
wed
=======
tue
WED
>>>>>>> line3
thu
fri
-- conflicts: 1
mon
TUE
wed
THU
fri
-- conflicts: 0
```

In Git 2.52, edits to adjacent lines conflict even though no line was changed twice, and a single unchanged line between them is enough for a clean merge. The conflict region covers both lines, because without an unchanged line separating the two changes Git treats them as one region claimed by both sides. The practical consequence: two branches that each append a line to the end of the same file conflict (tried in Git 2.52: a two-line file with a different line appended on each side), and so do neighboring entries in the same block of imports. The resolution in both cases is to keep both lines.
:::
::::

## Conflicts with no lines to edit

The table earlier covered a text file present in base, ours and theirs. When a path is missing from one of the three, or is not text, there is no region to bracket, and Git reports a conflict of another kind. Three of them fit in one merge. A `left` branch adds a logo (a binary file, here just a few bytes with a NUL in them) and then edits `check.sh`, `tips.txt` and the logo. A `right` branch, made from the commit that added the logo, deletes `check.sh`, creates its own `tips.txt` and also edits the logo.

```bash run
git switch -q -c left
printf 'logo v1\0' > logo.bin
git add logo.bin
git commit -q -m 'Add the logo'
git switch -q -c right
git rm -q check.sh
echo 'count the till float' > tips.txt
printf 'logo v2\0' > logo.bin
git add tips.txt
git commit -q -a -m 'Right side'
git switch -q left
echo '# specials must be on the menu' \
  >> check.sh
echo 'wipe the steam wand' > tips.txt
printf 'logo v3\0' > logo.bin
git add tips.txt
git commit -q -a -m 'Left side'
```

```bash run fails
git merge right
```

```text output
CONFLICT (modify/delete): check.sh [...]
warning: Cannot merge binary files: [...]
Auto-merging logo.bin
CONFLICT (content): Merge conflict in [...]
Auto-merging tips.txt
CONFLICT (add/add): Merge conflict in [...]
Automatic merge failed; [...]
```

The first line is cut short on a phone: it reads "check.sh deleted in right and modified in HEAD. Version HEAD of check.sh left in tree." The warning about binary files is Git declining to merge `logo.bin` line by line. The type in parentheses names the kind of conflict, and `git status` names it again in two letters, the first for our side and the second for theirs ([git-status](https://git-scm.com/docs/git-status)):

```bash run
git status --short
git ls-files -u --abbrev=7
```

```text output
UD check.sh
UU logo.bin
AA tips.txt
100644 [...] 1	check.sh
100644 [...] 2	check.sh
100644 [...] 1	logo.bin
100644 [...] 2	logo.bin
100644 [...] 3	logo.bin
100644 [...] 2	tips.txt
100644 [...] 3	tips.txt
```

Read the stage numbers against the letters:

- **`UD` (modify/delete).** The path has stages 1 and 2 and no stage 3: we changed it, they deleted it. Git leaves our version in the working tree, with no markers. The decision is whether the file should exist, so the resolution is `git add check.sh` to keep it or `git rm check.sh` to accept the deletion.
- **`AA` (add/add).** Both sides created the path independently. There is no base, so stage 1 is missing (`git show :1:tips.txt` fails with "not at stage 1"). For text files Git still writes markers, as in the earlier conflict, with the two whole files in place of the changed regions. Edit them into shape and `git add`.
- **`UU` on a file Git cannot merge by lines.** All three stages exist, but Git will not put markers into a binary file. It warns and leaves our version in the working tree. Choose a side with `git checkout --ours logo.bin` or `--theirs`, which copy stage 2 or 3 over the working file for an unmerged path ([git-checkout](https://git-scm.com/docs/git-checkout)), or produce the merged file some other way, then `git add` it.

The three resolutions, then the commit:

```bash run
git rm -q check.sh
echo 'wipe the steam wand' > tips.txt
echo 'count the till float' >> tips.txt
git add tips.txt
git checkout --ours logo.bin
git add logo.bin
git status --short
git commit -q --no-edit
```

```text output
D  check.sh
M  tips.txt
```

`git status` shows the resolved state against `HEAD`: `check.sh` is deleted and `tips.txt` has a new line, while the logo is unchanged because ours was kept. The scratch branches have done their job; delete them so that later listings stay short.

```bash run
git switch -q main
git branch -q -D left right
git branch
```

```text output
  autumn
* main
  rename-latte
  sunday
```

## A clean merge can still be wrong

Git merges text. Whether the merged text still means something sensible is outside its view. The kiosk's `check.sh` makes this easy to show. One branch spells out "hot chocolate" on the menu; `main` makes hot choc a special.

```bash run
git switch -q -c full-names
sed -i \
  's/^hot choc     /hot chocolate/' \
  menu.txt
git commit -q -a \
  -m 'Spell out hot chocolate'
echo "-- check on full-names:"
bash check.sh
git switch -q main
echo 'hot choc' >> specials.txt
git commit -q -a \
  -m 'Hot choc is a special'
echo "-- check on main:"
bash check.sh
git merge --no-edit full-names
echo "-- check after the merge:"
bash check.sh
```

```text output
-- check on full-names:
-- check on main:
Merge made by the 'ort' strategy.
 menu.txt | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
-- check after the merge:
not on the menu: hot choc
```

The check passed on each branch and fails on the merge of the two. The edits were in different files, so by the table above there was nothing to conflict, and Git was right to merge them. The defect exists only in the combination: one side renamed a thing while the other added a new use of the old name. In code the same shape appears as a renamed function on one branch and a new call to it on the other, and the result is a merge commit that does not compile although both parents did.

Two habits follow. Run the build and tests on the merge result, not only on the branches. And when you want to do that before the merge is recorded, `git merge --no-commit` stops "just before creating a merge commit, to give the user a chance to inspect and further tweak the merge result" ([git-merge](https://git-scm.com/docs/git-merge)). Here the merge is already committed, so the repair is an ordinary commit on top:

```bash run
sed -i 's/^hot choc$/hot chocolate/' \
  specials.txt
git commit -q -a \
  -m 'Use the new name in specials'
bash check.sh
echo "exit status: $?"
```

```text output
exit status: 0
```

## Merge strategies, and the options that look like them

"Merge made by the 'ort' strategy" has appeared twice. A *strategy* is the program that turns the tips and their base into a merged tree, selected with `-s`. A *strategy option*, passed with `-X`, adjusts the behavior of the chosen strategy. The [git-merge documentation](https://git-scm.com/docs/git-merge) lists these strategies:

- **`ort`** is what you have been running. It is chosen for you when you merge one branch, and it merges two tips against their base, following renamed files. Before Git 2.34 the default was `recursive`, and since Git 2.50 that name is accepted as a synonym for `ort`.
- **`octopus`** is chosen for you when you name two or more branches. It is all or nothing: a conflict that needs a person aborts the whole merge.
- **`ours`** merges nothing. It records a merge commit whose tree is exactly the current branch's tree, so every change on the other branches is discarded while their history becomes part of yours.
- **`resolve`** is an older two-tip strategy that does not follow renames, and **`subtree`** is `ort` adjusted for merging a project that lives in a subdirectory of the other one.

`ort` also covers a case the single-base description above skips: histories with criss-cross merges can have more than one best common ancestor ([git-merge-base](https://git-scm.com/docs/git-merge-base)), and `ort` then first merges those ancestors with each other and uses the result as the base. The `-X` options adjust it. `-X ignore-space-change` and its relatives treat whitespace-only changes to a line as no change. `-X ours` and `-X theirs` settle each conflicting region in favor of one side while still merging everything that does not conflict.

Octopus is what you get by naming several branches at once. Two small branches and one more commit on `main` give it three tips to join:

```bash run
git branch wifi
git branch allergens
git switch -q wifi
echo 'network: kiosk-guest' > wifi.txt
git add wifi.txt
git commit -q -m 'Post the wifi name'
git switch -q allergens
echo 'mocha: milk, soy' > allergens.txt
git add allergens.txt
git commit -q -m 'List allergens'
git switch -q main
sed -i '/^Mon-Fri /s/07:00/06:30/' \
  hours.txt
git commit -q -a \
  -m 'Open earlier on weekdays'
git merge --no-edit wifi allergens |
  grep -v '^ '
echo "-- parents of the merge:"
for n in 1 2 3
do git log -1 --format="$n: %s" HEAD^$n
done
```

```text output
Trying simple merge with wifi
Trying simple merge with allergens
Merge made by the 'octopus' strategy.
-- parents of the merge:
1: Open earlier on weekdays
2: Post the wifi name
3: List allergens
```

One commit, three parents, in the order the branches were named after the one you were on. Octopus is meant for bundling topic branches that do not interfere ([git-merge](https://git-scm.com/docs/git-merge)); had any of them conflicted, it would have refused and left you to merge them one at a time.

<figure class="diagram">
<svg viewBox="0 0 360 250" role="img" aria-labelledby="oct-title oct-desc">
<title id="oct-title">An octopus merge commit with three parents</title>
<desc id="oct-desc">Three commits sit side by side: Open earlier on main, Post the wifi name on wifi, and List allergens on allergens. One merge commit below them has three arrows pointing up, labeled parent 1, parent 2 and parent 3, one to each.</desc>
<defs>
<marker id="oct-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-accent"/></marker>
</defs>
<rect x="10" y="10" width="104" height="52" rx="6" class="d-box"/>
<text x="62" y="32" text-anchor="middle" class="d-small">Open earlier</text>
<text x="62" y="50" text-anchor="middle" class="d-mono d-small">main</text>
<rect x="128" y="10" width="104" height="52" rx="6" class="d-box"/>
<text x="180" y="32" text-anchor="middle" class="d-small">Post the wifi</text>
<text x="180" y="50" text-anchor="middle" class="d-mono d-small">wifi</text>
<rect x="246" y="10" width="104" height="52" rx="6" class="d-box"/>
<text x="298" y="32" text-anchor="middle" class="d-small">List allergens</text>
<text x="298" y="50" text-anchor="middle" class="d-mono d-small">allergens</text>
<path d="M140 150 L70 64" class="d-accent" marker-end="url(#oct-arrow)"/>
<path d="M180 150 V64" class="d-accent" marker-end="url(#oct-arrow)"/>
<path d="M220 150 L290 64" class="d-accent" marker-end="url(#oct-arrow)"/>
<text x="98" y="112" text-anchor="end" class="d-small d-text-accent">parent 1</text>
<text x="188" y="112" class="d-small d-text-accent">parent 2</text>
<text x="266" y="112" class="d-small d-text-accent">parent 3</text>
<rect x="90" y="152" width="180" height="44" rx="6" class="d-box-accent"/>
<text x="180" y="179" text-anchor="middle" class="d-bold">The merge commit</text>
<text x="10" y="226" class="d-small d-muted">One commit, three parent links, in command-line order.</text>
</svg>
<figcaption>Figure 4. An octopus merge is an ordinary commit with more than two parent links. Parent 1 is the branch you were on; the others follow in the order you named them.</figcaption>
</figure>

::::exercise[-X ours versus -s ours]
A `promo` branch cuts the caffe latte to 3.50 and adds a cortado. `main` raises the caffe latte to 4.30. Two commands differ by one letter:

```text
git merge -X ours promo
git merge -s ours promo
```

For each, what price does the caffe latte end up with, and is the cortado on the menu? Work it out from the strategy descriptions above, then check.

:::solution
`-X ours` is an option to `ort`: the merge runs normally, and only the conflicting region (the latte line) is settled in favor of `main`. The cortado line does not conflict, so it comes in. `-s ours` is a different strategy that does not look at `promo`'s content at all: the merged tree is `main`'s tree, so the cortado is dropped as well.

```bash run
git switch -q -c promo
sed -i '/^caffe /s/4.10/3.50/' menu.txt
echo 'cortado        3.20' >> menu.txt
git commit -q -a \
  -m 'Promo prices'
git switch -q main
sed -i '/^caffe /s/4.10/4.30/' menu.txt
git commit -q -a \
  -m 'Caffe latte to 4.30'
git merge -q --no-edit -X ours promo \
  > /dev/null
echo "-- with -X ours:"
grep -E '^(caffe|cortado)' menu.txt
git reset -q --hard ORIG_HEAD
git merge -q --no-edit -s ours promo
echo "-- with -s ours:"
grep -E '^(caffe|cortado)' menu.txt
echo "-- is promo merged?"
git branch --merged main | grep promo
```

```text output
-- with -X ours:
caffe latte    4.30
cortado        3.20
-- with -s ours:
caffe latte    4.30
-- is promo merged?
  promo
```

Between the two attempts, `git reset --hard ORIG_HEAD` undid the first merge: `git merge` saves the pre-merge tip in `ORIG_HEAD` ([gitrevisions](https://git-scm.com/docs/gitrevisions)), and resetting to it is safe for a merge that has not been pushed.

The last line is the hazard. After `-s ours`, Git considers `promo` fully merged although none of its changes are present, and merging `promo` again will say "Already up to date". The [git-merge documentation](https://git-scm.com/docs/git-merge) gives the strategy's purpose as superseding the old history of a side branch, which is a different job from "keep my version of the conflicts"; for that job use `-X ours`. Note also that both commands resolve silently, so nobody reviews the choice. There is a `-X theirs` but no `-s theirs`.
:::
::::

## After the merge: deleting branches, undoing merges

A merged branch has done its job. Its commits are reachable from `main` through a parent link, so the name can go without losing anything. `git branch --merged` lists the branches whose tips are reachable from `HEAD`, and `git branch -d` refuses to delete a branch that is not merged into its upstream branch, or into `HEAD` if it has no upstream ([git-branch](https://git-scm.com/docs/git-branch)):

```bash run
git switch -q -c draft-loyalty-card
echo 'ten stamps, one free' \
  > loyalty.txt
git add loyalty.txt
git commit -q -m 'Sketch a loyalty card'
git switch -q main
git branch --no-merged
git branch -d autumn sunday \
  rename-latte |
  sed 's/ (was.*//'
git branch -d draft-loyalty-card ||
  echo "refused, exit status $?"
```

```text output
  draft-loyalty-card
Deleted branch autumn
Deleted branch sunday
Deleted branch rename-latte
refused, exit status 1
```

The refusal is a safety check on reachability, the same ancestor test as at the start of this page. `-D` overrides it. A deleted branch's reflog is deleted with it ([git-branch](https://git-scm.com/docs/git-branch)), so an unmerged branch removed with `-D` is recoverable only for as long as you can still find its tip's ID, for instance in `HEAD`'s reflog.

Undoing a merge depends on whether anyone else has it. If not, move the branch back as the exercise above did, with `git reset --hard ORIG_HEAD` immediately afterwards or with the first parent's ID later. If the merge is already shared, `git revert -m 1 <merge>` adds a new commit that reverses the changes the merge brought in relative to parent 1, the mainline. The [git-revert documentation](https://git-scm.com/docs/git-revert) attaches a warning that matters later: a reverted merge still counts as merged, so merging the same branch again brings in only the commits made after the first merge, not the reverted ones. [Pro Git 7.8](https://git-scm.com/book/en/v2/Git-Tools-Advanced-Merging) walks through the fix, which is to revert the revert before merging again.

## What to check when a merge surprises you

- **"Already up to date" but the changes are missing.** Check the branch you are on and the direction of the merge first. Then check whether the branch was merged earlier and reverted, or merged with `-s ours`.
- **A merge commit you did not expect.** Your branch had a commit of its own, so a fast-forward was impossible. `git log --graph --format='%s%d' --all` shows where the histories split.
- **More conflicts than the edits seem to justify.** Look at the base, with `git checkout --conflict=diff3 <path>` before you edit that file (it regenerates the markers and discards edits) or `git show :1:<path>` at any time. Causes to rule out are edits on adjacent lines, whitespace-only reformatting on one side and line-ending changes. The `-X ignore-space-change` family covers the whitespace kinds, but "whitespace changes mixed with other changes to a line are not ignored" ([git-merge](https://git-scm.com/docs/git-merge), [Pro Git 7.8](https://git-scm.com/book/en/v2/Git-Tools-Advanced-Merging)).
- **Lost in the middle of a resolution.** `git status` names the unmerged paths, `git diff` shows the remaining conflict regions, and `git merge --abort` returns to the start, discarding the resolution work so far.
- **The merge was clean and the build broke.** That is the hot chocolate problem. The fix is a normal commit, and the prevention is running the tests on the merge result before it is pushed.
