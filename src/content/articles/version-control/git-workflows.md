---
title: "Git Workflows: Trunk-Based, GitHub Flow, Git Flow"
description: "Script real branch histories for trunk-based development and Git Flow, compare both to GitHub Flow, and automate a semantic-versioning release tag."
pillar: version-control
order: 5
author: markus
published: 2026-09-22
updated: 2026-09-22
level: intermediate
tags: [git, git-workflows, github-flow, git-flow, trunk-based-development, semantic-versioning]
prerequisites: ["version-control/how-git-works", "version-control/branching-and-merging"]
sources:
  - title: "Trunk-Based Development"
    url: "https://trunkbaseddevelopment.com/"
    publisher: "trunkbaseddevelopment.com"
    accessed: 2026-09-22
  - title: "Trunk-Based Development: Continuous Delivery"
    url: "https://trunkbaseddevelopment.com/continuous-delivery/"
    publisher: "trunkbaseddevelopment.com"
    accessed: 2026-09-22
  - title: "GitHub Flow"
    url: "https://docs.github.com/en/get-started/using-github/github-flow"
    publisher: "GitHub Docs"
    accessed: 2026-09-22
  - title: "About pull request merges"
    url: "https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/about-pull-request-merges"
    publisher: "GitHub Docs"
    accessed: 2026-09-22
  - title: "A successful Git branching model"
    url: "https://nvie.com/posts/a-successful-git-branching-model/"
    publisher: "nvie.com"
    accessed: 2026-09-22
  - title: "Conventional Commits 1.0.0"
    url: "https://www.conventionalcommits.org/en/v1.0.0/"
    publisher: "conventionalcommits.org"
    accessed: 2026-09-22
  - title: "Semantic Versioning 2.0.0"
    url: "https://semver.org/"
    publisher: "semver.org"
    accessed: 2026-09-22
  - title: "git-tag"
    url: "https://git-scm.com/docs/git-tag"
    publisher: "Git documentation"
    accessed: 2026-09-22
  - title: "git-branch"
    url: "https://git-scm.com/docs/git-branch"
    publisher: "Git documentation"
    accessed: 2026-09-22
draft: false
---

A branching model answers two questions for a team: which branches live longer than a day, and what has to be true about a commit before it reaches the one branch a deploy is built from. Trunk-based development, GitHub Flow and Git Flow answer both questions differently, and each is a specific, named structure with its own primary source, not a mood. This page builds a real branch history for the two that differ most, trunk-based development and Git Flow, reads the difference straight off `git log --graph`, and builds the same kind of history more lightly for GitHub Flow in between. It builds on [How Git Works Inside](/version-control/how-git-works/) and [Branching and Merging](/version-control/branching-and-merging/): merge mechanics, fast-forwards and `--no-ff` are not re-explained here.

## Trunk-based development: one branch, and short trips off it

[Trunk-Based Development](https://trunkbaseddevelopment.com/) defines itself precisely: "developers collaborate on code in a single branch called 'trunk' ... and resist any pressure to create other long-lived development branches." Side branches are allowed, but only briefly: "short-lived feature branches are used for code-review and build checking (CI), but not artifact creation or publication, to happen before commits land in the trunk." "Short-lived" is not a figure of speech in the source either; the branches below live for a single article session and merge back before the next one starts.

The session on this page ran under Git 2.52 in Git Bash on Windows. Blob and tree IDs would match on any machine, but the commit IDs printed further down also hash a name, an email address and two timestamps, the way [How Git Works Inside](/version-control/how-git-works/#a-commit-is-a-tree-plus-parents-plus-who-when-and-why) showed. Pin those the same way that article did, and every commit ID and tag on this page reproduces exactly; the two exported dates carry forward for the rest of the session, so they are set once, here:

```bash run
git init -q -b main storefront
cd storefront
git config user.name 'Ada Example'
git config user.email ada@example.com
git config commit.gpgsign false
git config tag.gpgsign false
git config core.autocrlf false
export GIT_AUTHOR_DATE=2026-01-15T10:00:00Z
export GIT_COMMITTER_DATE=2026-01-15T10:00:00Z
cat > cart.txt <<'EOF'
add_item
remove_item
EOF
git add cart.txt
git commit -q -m 'feat: initial cart operations'
git log --format='%s%d'
```

```text output
feat: initial cart operations (HEAD -> main)
```

The commit type prefixes (`feat:`, and `fix:` and `chore:` further down) are a real convention with its own rules, covered in full [later on this page](#commit-messages-conventional-commits); for now, read them as a plain description of what changed.

A short branch for a half-finished feature, merged back the same day, with the unfinished part switched off rather than left out:

```bash run
git switch -q -c discounts
cat > flags.txt <<'EOF'
ENABLE_DISCOUNTS=false
EOF
cat > discount.sh <<'EOF'
#!/bin/sh
. ./flags.txt
if [ "$ENABLE_DISCOUNTS" = true ]; then
  echo "discount applied: 10%"
else
  echo "discounts not enabled"
fi
EOF
git add flags.txt discount.sh
git commit -q -m \
  'feat: add discounts flag'
git switch -q main
git merge -q --no-ff --no-edit discounts
git branch -d discounts
git log --oneline --graph
```

```text output
Deleted branch discounts (was 0162249).
*   0231e49 Merge branch 'discounts'
|\  
| * 0162249 feat: add discounts flag
|/  
* fb7d5a7 feat: initial cart operations
```

`discount.sh` is real, runnable code, not a comment saying "TODO: discounts"; `ENABLE_DISCOUNTS=false` is what makes it safe to sit on `main` unfinished. The trunk-based source names this directly: teams "use feature flags in day to day development to allow for hedging on the order of releases," which is exactly what happened here — the feature merged before it was ready to ship, and shipping is a separate decision from merging.

A second short branch, this time a plain fix, merges the same way:

```bash run
git switch -q -c cart-guard
echo 'checkout_guard' >> cart.txt
git commit -q -a -m \
  'fix: guard against empty cart'
git switch -q main
git merge -q --no-ff --no-edit cart-guard
git branch -d cart-guard
sh discount.sh
git log --oneline --graph --all
```

```text output
Deleted branch cart-guard (was c4ae26e).
discounts not enabled
*   9a8e1dd Merge branch 'cart-guard'
|\  
| * c4ae26e fix: guard against empty cart
|/  
*   0231e49 Merge branch 'discounts'
|\  
| * 0162249 feat: add discounts flag
|/  
* fb7d5a7 feat: initial cart operations
```

`main` is a straight line with two small bumps, one per branch, and `discount.sh` still prints "discounts not enabled": the flag, not the merge, controls what ships.

<figure class="diagram">
<svg viewBox="0 0 320 300" role="img" aria-labelledby="trunk-title trunk-desc">
<title id="trunk-title">Trunk-based development: short branches that merge back the same day</title>
<desc id="trunk-desc">A single vertical main line with two small loops, one for the discounts branch and one for the cart-guard branch, each peeling off and rejoining within the same box. Below them a third loop for a just-in-time release branch is dashed, showing it gets deleted once tagged.</desc>
<defs>
<marker id="trunk-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-accent"/></marker>
</defs>
<rect x="20" y="8" width="140" height="30" rx="6" class="d-box"/>
<text x="90" y="28" text-anchor="middle" class="d-small">initial commit</text>
<path d="M90 38 V64" class="d-line" marker-end="url(#trunk-arrow)"/>
<path d="M90 64 L220 64" class="d-accent d-dashed" marker-end="url(#trunk-arrow)"/>
<rect x="180" y="46" width="130" height="36" rx="6" class="d-box-2"/>
<text x="245" y="68" text-anchor="middle" class="d-small">discounts, 1 commit</text>
<path d="M220 82 L90 100" class="d-accent" marker-end="url(#trunk-arrow)"/>
<rect x="20" y="90" width="140" height="30" rx="6" class="d-box-accent"/>
<text x="90" y="110" text-anchor="middle" class="d-small">merge discounts</text>
<path d="M90 120 V146" class="d-line" marker-end="url(#trunk-arrow)"/>
<path d="M90 146 L220 146" class="d-accent d-dashed" marker-end="url(#trunk-arrow)"/>
<rect x="180" y="128" width="130" height="36" rx="6" class="d-box-2"/>
<text x="245" y="150" text-anchor="middle" class="d-small">cart-guard, 1 commit</text>
<path d="M220 164 L90 182" class="d-accent" marker-end="url(#trunk-arrow)"/>
<rect x="20" y="172" width="140" height="30" rx="6" class="d-box-accent"/>
<text x="90" y="192" text-anchor="middle" class="d-small">merge cart-guard</text>
<path d="M90 202 V228" class="d-line" marker-end="url(#trunk-arrow)"/>
<rect x="20" y="226" width="140" height="30" rx="6" class="d-box"/>
<text x="90" y="246" text-anchor="middle" class="d-small">gift-wrap merged</text>
<path d="M90 256 L90 268" class="d-line d-dashed"/>
<rect x="20" y="268" width="160" height="30" rx="6" class="d-box-warn d-dashed"/>
<text x="100" y="284" text-anchor="middle" class="d-small">release-0.2</text>
<text x="100" y="296" text-anchor="middle" class="d-small">tagged, deleted</text>
</svg>
<figcaption>Figure 1. Every side trip off <code>main</code> is small and short: one commit, one merge, same day. The release branch at the bottom exists only long enough to be tagged.</figcaption>
</figure>

Once a change is worth shipping, trunk-based development leaves the timing to a separate step: there may be "release branches that are cut from the trunk on a just-in-time basis, are 'hardened' before a release ... and those branches are deleted some time after release." The rest of this section builds that step as a real script, reusing the `feat:`/`fix:` prefixes already on every commit above.

```bash run
cat > next-version.sh <<'SCRIPT'
#!/bin/sh
last=$(git tag -l 'v*' --sort=-v:refname | head -1)
subjects=$(git log --format=%s "${last:+$last..}HEAD")
bump=none
echo "$subjects" |
  grep -Eq '^[a-z]+(\([^)]*\))?!:' && bump=major
[ "$bump" = none ] &&
  echo "$subjects" | grep -q 'BREAKING CHANGE' && bump=major
[ "$bump" = none ] &&
  echo "$subjects" | grep -Eq '^feat' && bump=minor
[ "$bump" = none ] &&
  echo "$subjects" | grep -Eq '^fix' && bump=patch
if [ "$bump" = none ]; then
  echo "no release-worthy commits" >&2
  exit 1
fi
old=${last#v}
old=${old:-0.0.0}
major=$(echo "$old" | cut -d. -f1)
minor=$(echo "$old" | cut -d. -f2)
patch=$(echo "$old" | cut -d. -f3)
case "$bump" in
  major) major=$((major + 1)); minor=0; patch=0 ;;
  minor) minor=$((minor + 1)); patch=0 ;;
  patch) patch=$((patch + 1)) ;;
esac
echo "v$major.$minor.$patch"
SCRIPT
chmod +x next-version.sh
./next-version.sh
```

```text output
v0.1.0
```

The rule the script encodes — `fix` bumps the patch number, `feat` bumps minor, a `!` or a `BREAKING CHANGE` bumps major — is [Conventional Commits](#commit-messages-conventional-commits)' own mapping to [semantic versioning](https://semver.org/), read straight from the log instead of decided by hand. With no prior tag, every commit counts from the start, the highest bump found is `feat` (minor), and `0.0.0` becomes `0.1.0` — a version under `1.0.0`, which [semver's own rule](https://semver.org/) marks as fair warning: "the public API SHOULD NOT be considered stable." Tagging makes it official:

```bash run
ver=$(./next-version.sh)
git tag -a "$ver" -m "Release $ver"
git tag -l -n1
```

```text output
v0.1.0          Release v0.1.0
```

`-a` makes this an *annotated* tag, a real object with its own message and date rather than a bare pointer; [git-tag](https://git-scm.com/docs/git-tag) draws the same line: "annotated tags are meant for release while lightweight tags are meant for private or temporary object labels." One more feature, one just-in-time release branch to harden it, and the script runs again to prove it is not a one-off:

```bash run
git switch -q -c gift-wrap
echo 'gift_wrap_option' >> cart.txt
git commit -q -a -m \
  'feat: add gift wrap option'
git switch -q main
git merge -q --no-ff --no-edit gift-wrap
git branch -d gift-wrap
git switch -q -c release-0.2
sed -i \
  's/ENABLE_DISCOUNTS=false/ENABLE_DISCOUNTS=false  # frozen/' \
  flags.txt
git commit -q -a -m \
  'chore: freeze flag for release'
./next-version.sh
```

```text output
Deleted branch gift-wrap (was 2b9a5d6).
v0.2.0
```

`chore:` is not `feat:` or `fix:`, so it does not move the version on its own; the `feat:` commit merged two blocks up is what earns the minor bump from `0.1.0` to `0.2.0`. Tag the release branch, then discard it — `-D`, not `-d`, because its one commit (the frozen flag, a release-only note) was never merged back to `main`, so [git-branch](https://git-scm.com/docs/git-branch)'s merge check would otherwise refuse the delete, the same safety net [Branching and Merging](/version-control/branching-and-merging/#after-the-merge-deleting-branches-undoing-merges) already covered:

```bash run
ver=$(./next-version.sh)
git tag -a "$ver" -m "Release $ver"
git switch -q main
git branch -D release-0.2
git tag -l -n1
git log --oneline --graph --all
```

```text output
Deleted branch release-0.2 (was ea4e212).
v0.1.0          Release v0.1.0
v0.2.0          Release v0.2.0
* ea4e212 chore: freeze flag for release
*   a9efec3 Merge branch 'gift-wrap'
|\  
| * 2b9a5d6 feat: add gift wrap option
|/  
*   9a8e1dd Merge branch 'cart-guard'
|\  
| * c4ae26e fix: guard against empty cart
|/  
*   0231e49 Merge branch 'discounts'
|\  
| * 0162249 feat: add discounts flag
|/  
* fb7d5a7 feat: initial cart operations
```

The branch name `release-0.2` is gone, but its commit is not: `v0.2.0` still points at it, so `--all` still shows it. A ref, any ref, is what keeps a commit listed; [How Git Works Inside](/version-control/how-git-works/#a-branch-is-a-41-byte-file-and-a-log-line) covers why deleting the name does not delete the object.

::::exercise[Read the graph before running it]
Before the block above runs, `main` has two merge commits on it (`discounts`, `cart-guard`) and `gift-wrap` has not landed yet. Predict how many *merge* commits `git rev-list --count --merges main` reports once `gift-wrap` is merged, and whether the frozen-flag commit on `release-0.2` adds to that count once it is force-deleted. Then check.

:::solution
Three: `discounts`, `cart-guard` and `gift-wrap`, the only three branches ever merged into `main`. `release-0.2`'s commit is real but was never merged with `git merge`, so it never produced a merge commit at all, and deleting the branch name does not remove the ordinary commit it left behind.

```bash run
git rev-list --count --merges main
git rev-list --count main
```

```text output
3
7
```

Seven total: one initial commit, three feature/fix commits, three merge commits. `release-0.2`'s single commit is not reachable from `main` (only from the `v0.2.0` tag), so it is not in either count.
:::
::::

## GitHub Flow: every change through a pull request into a deployable main

[GitHub's own description](https://docs.github.com/en/get-started/using-github/github-flow) of GitHub flow is six steps, in order: "Create a branch," "Make changes," "Create a pull request," "Address review comments," "Merge your pull request," "Delete your branch." The branch is still short, as in trunk-based development, but the gate before it reaches the default branch is named and mandatory: a pull request, not an informal short-lived branch that anyone with commit access can merge on their own judgment. "Your changes will not end up on the default branch until you merge your branch," and even then, "branch protection settings may block merging if your pull request does not meet certain requirements" — required reviews or checks, enforced by the host rather than by convention.

A script cannot open a real pull request; what it can do is the git side of one — branch, commits that respond to review, then the merge a host's "Merge pull request" button performs, which by default is "Merge Commit: Preserves every commit from the pull request branch and adds an explicit merge point" (GitHub also offers squash and rebase merges, which rewrite that history instead; this walkthrough keeps the default so every commit stays visible, matching the two demonstrations elsewhere on this page):

```bash run
cd ..
git init -q -b main landing-page
cd landing-page
git config user.name 'Ada Example'
git config user.email ada@example.com
git config commit.gpgsign false
git config tag.gpgsign false
git config core.autocrlf false
cat > index.html <<'EOF'
<h1>Storefront</h1>
EOF
git add index.html
git commit -q -m 'chore: scaffold the landing page'
git log --format='%s%d'
```

```text output
chore: scaffold the landing page (HEAD -> main)
```

The `git config` lines are repeated because each `git init` starts a fresh `.git/config`, local to this repository; the two dates exported at the top of the page are shell variables, not repository config, so they still apply here without being set again.

A feature branch, then a second commit that stands in for "address review comments" — a reviewer asked for a label on the form field, and the fix lands as its own commit rather than rewriting the first one:

```bash run
git switch -q -c newsletter
cat > signup.html <<'EOF'
<form><input name="email"></form>
EOF
git add signup.html
git commit -q -m \
  'feat: add newsletter signup form'
echo 'requires an email' >> signup.html
git commit -q -a -m \
  'fix: label the signup field'
git switch -q main
git merge -q --no-ff --no-edit newsletter
git branch -d newsletter
git log --oneline --graph
```

```text output
Deleted branch newsletter (was bfef33d).
*   46077ac Merge branch 'newsletter'
|\  
| * bfef33d fix: label the signup field
| * 7a83f5b feat: add newsletter signup form
|/  
* cc15d4b chore: scaffold the landing page
```

There is no release branch and no hardening step: GitHub flow's default branch is what a deploy is built from, so the merge above is the release. Tagging it records that fact without changing anything about the branch:

```bash run
git tag -a v1.0.0 -m 'Release v1.0.0'
git switch -q -c signup-fix
sed -i \
  's/requires an email/label: requires an email/' \
  signup.html
git commit -q -a -m \
  'fix: correct signup label typo'
git switch -q main
git merge -q --no-ff --no-edit signup-fix
git branch -d signup-fix
git tag -a v1.0.1 -m 'Release v1.0.1'
git log --oneline --graph --all
```

```text output
Deleted branch signup-fix (was 9168d77).
*   ab2b423 Merge branch 'signup-fix'
|\  
| * 9168d77 fix: correct signup label typo
|/  
*   46077ac Merge branch 'newsletter'
|\  
| * bfef33d fix: label the signup field
| * 7a83f5b feat: add newsletter signup form
|/  
* cc15d4b chore: scaffold the landing page
```

Two pull requests, two merges, two tags, no branch other than `main` living more than a few commands. `docs.github.com` states the last step as plainly as the first: "After you merge your pull request, delete your branch" — cleanup, not an afterthought, which is why `-d` (not `-D`) never had to be overridden above: every branch here was fully merged before deletion.

<figure class="diagram">
<svg viewBox="0 0 320 240" role="img" aria-labelledby="ghf-title ghf-desc">
<title id="ghf-title">GitHub Flow: every branch through a pull request, tagged where it merges</title>
<desc id="ghf-desc">A vertical main line with two pull-request branches merging in, each merge immediately followed by a version tag on main, since there is no separate release branch.</desc>
<defs>
<marker id="ghf-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-accent"/></marker>
</defs>
<rect x="20" y="8" width="150" height="30" rx="6" class="d-box"/>
<text x="95" y="28" text-anchor="middle" class="d-small">scaffold page</text>
<path d="M95 38 V60" class="d-line" marker-end="url(#ghf-arrow)"/>
<path d="M95 60 L230 60" class="d-accent d-dashed" marker-end="url(#ghf-arrow)"/>
<rect x="190" y="42" width="120" height="36" rx="6" class="d-box-2"/>
<text x="250" y="64" text-anchor="middle" class="d-small">PR: newsletter</text>
<path d="M230 78 L95 96" class="d-accent" marker-end="url(#ghf-arrow)"/>
<rect x="20" y="86" width="150" height="30" rx="6" class="d-box-accent"/>
<text x="95" y="106" text-anchor="middle" class="d-small">merge PR</text>
<rect x="20" y="120" width="150" height="26" rx="6" class="d-box-good"/>
<text x="95" y="138" text-anchor="middle" class="d-mono d-small">tag v1.0.0</text>
<path d="M95 146 V166" class="d-line" marker-end="url(#ghf-arrow)"/>
<path d="M95 166 L230 166" class="d-accent d-dashed" marker-end="url(#ghf-arrow)"/>
<rect x="190" y="148" width="120" height="36" rx="6" class="d-box-2"/>
<text x="250" y="170" text-anchor="middle" class="d-small">PR: signup-fix</text>
<path d="M230 184 L95 200" class="d-accent" marker-end="url(#ghf-arrow)"/>
<rect x="20" y="192" width="150" height="26" rx="6" class="d-box-good"/>
<text x="95" y="210" text-anchor="middle" class="d-mono d-small">tag v1.0.1</text>
</svg>
<figcaption>Figure 2. No release branch: the merge into <code>main</code> and the release are the same event, so each tag sits directly under its merge.</figcaption>
</figure>

::::exercise[What the merge method changes]
`docs.github.com` describes squash merging as combining "all commits in the pull request into a single commit on the base branch." If the `newsletter` pull request above had been squash-merged instead of merged with `--no-ff`, would `main`'s log still show `feat: add newsletter signup form` and `fix: label the signup field` as two separate entries? What would `git rev-list --count --merges main` report afterward?

:::solution
No: a squash merge writes one new commit with the combined diff, so only one subject line would appear on `main` (commonly the pull request's title, chosen by whoever merges it), and neither original commit message survives there — they are still on the source branch's history until it is deleted, just not reachable from `main`. `git rev-list --count --merges main` would report one less merge commit per squash-merged pull request, because squash merging, despite the name, creates a single-parent commit, not a merge commit; [About pull request merges](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/about-pull-request-merges) is explicit that this method "combines" commits rather than joining histories.
:::
::::

## Git Flow: two permanent branches, three kinds of temporary ones

Vincent Driessen's [original post](https://nvie.com/posts/a-successful-git-branching-model/) names two branches that never go away. `master` (this walkthrough uses `main`, as most hosts now default to, without changing what the model does) is the one where "`HEAD` always reflects a *production-ready* state"; `develop` is where "`HEAD` always reflects a state with the latest delivered development changes for the next release." Three more kinds of branch move work between them: **feature** branches, cut from `develop` and merged back into it; **release** branches, cut from `develop` to prepare a specific version and merged into both `develop` and `master`; and **hotfix** branches, cut from `master` for an urgent production fix and, again, merged into both.

```bash run
cd ..
git init -q -b main ticketing
cd ticketing
git config user.name 'Ada Example'
git config user.email ada@example.com
git config commit.gpgsign false
git config tag.gpgsign false
git config core.autocrlf false
echo '0.0.0' > VERSION
git add VERSION
git commit -q -m \
  'chore: seed the production branch'
git switch -q -c develop
git log --format='%s%d'
```

```text output
chore: seed the production branch (HEAD -> develop, main)
```

Two feature branches, each cut from `develop` and merged back into it, never touching `main`:

```bash run
git switch -q -c refunds develop
cat > refunds.txt <<'EOF'
partial_refund
full_refund
EOF
git add refunds.txt
git commit -q -m \
  'feat: add refund processing'
git switch -q develop
git merge -q --no-ff --no-edit refunds
git branch -d refunds
git switch -q -c seats develop
cat > seats.txt <<'EOF'
rows: 20
cols: 30
EOF
git add seats.txt
git commit -q -m \
  'feat: add venue seat map'
git switch -q develop
git merge -q --no-ff --no-edit seats
git branch -d seats
git log --oneline --graph develop
```

```text output
Deleted branch refunds (was 8638ade).
Deleted branch seats (was 5a7eca4).
*   a08d0a2 Merge branch 'seats' into develop
|\  
| * 5a7eca4 feat: add venue seat map
|/  
*   933f0f4 Merge branch 'refunds' into develop
|\  
| * 8638ade feat: add refund processing
|/  
* 1f19068 chore: seed the production branch
```

Git names these merge commits "into develop" on its own, because `develop` is not the branch this repository started on; `main` still gets the plain "Merge branch 'x'" message, as it did in the two sections above. Neither feature has reached `main` yet — it is still exactly the one seed commit. A release branch cuts from `develop`, bumps the version, and takes one last-minute confirmation the original post calls out by name: it "allow[s] for minor bug fixes and preparing meta-data for a release," while "adding large new features here is strictly prohibited"; the version bump is the same kind of `chore:` commit the trunk-based release used, and the fix stays a `fix:`:

```bash run
git switch -q -c release-1.0.0 develop
echo '1.0.0' > VERSION
git commit -q -a -m \
  'chore: bump version to 1.0.0'
sed -i \
  's/cols: 30/cols: 30  # verified/' \
  seats.txt
git commit -q -a -m \
  'fix: confirm seat column count'
git switch -q main
git merge -q --no-ff --no-edit release-1.0.0
git tag -a v1.0.0 -m 'Release v1.0.0'
git switch -q develop
git merge -q --no-ff --no-edit release-1.0.0
git branch -d release-1.0.0
git log --oneline --graph main
```

```text output
Deleted branch release-1.0.0 (was 8006add).
*   fcf1bf3 Merge branch 'release-1.0.0'
|\  
| * 8006add fix: confirm seat column count
| * c37e574 chore: bump version to 1.0.0
| *   a08d0a2 Merge branch 'seats' into develop
| |\  
| | * 5a7eca4 feat: add venue seat map
| |/  
| * 933f0f4 Merge branch 'refunds' into develop
|/| 
| * 8638ade feat: add refund processing
|/  
* 1f19068 chore: seed the production branch
```

One merge into `main` brings both features and both release-branch commits at once — `main` was one commit behind `develop` before this, and the merge closes the whole gap, which is why `--no-ff` matters here specifically: the source's own reasoning is that a fast-forward would erase the fact that a release branch existed at all, and "yes, it will create a few more (empty) commit objects, but the gain is much bigger than the cost." The release branch is deleted with a plain `-d` this time, unlike trunk-based development's: every commit on it was merged into both `main` and `develop`, so nothing is left stranded.

A hotfix behaves like a release branch that starts from `main` instead of `develop`, for a fix that cannot wait for the next one:

```bash run
git switch -q -c hotfix-1.0.1 main
echo '1.0.1' > VERSION
git commit -q -a -m \
  'chore: bump version to 1.0.1'
sed -i 's/rows: 20/rows: 22/' seats.txt
git commit -q -a -m \
  'fix: correct row count'
git switch -q main
git merge -q --no-ff --no-edit hotfix-1.0.1
git tag -a v1.0.1 -m 'Release v1.0.1'
git switch -q develop
git merge -q --no-ff --no-edit hotfix-1.0.1
git branch -d hotfix-1.0.1
git log --oneline --graph main
```

```text output
Deleted branch hotfix-1.0.1 (was bc59002).
*   c5414f7 Merge branch 'hotfix-1.0.1'
|\  
| * bc59002 fix: correct row count
| * faf0c75 chore: bump version to 1.0.1
|/  
*   fcf1bf3 Merge branch 'release-1.0.0'
|\  
| * 8006add fix: confirm seat column count
| * c37e574 chore: bump version to 1.0.0
| *   a08d0a2 Merge branch 'seats' into develop
| |\  
| | * 5a7eca4 feat: add venue seat map
| |/  
| * 933f0f4 Merge branch 'refunds' into develop
|/| 
| * 8638ade feat: add refund processing
|/  
* 1f19068 chore: seed the production branch
```

`develop` also merged the hotfix, so the row-count fix is not lost the next time a release branch cuts from it — the exact problem a fix applied only to `main` would create. Driessen's post is direct about why this branch exists at all: hotfix branches are "very much like release branches in that they are also meant to prepare for a new production release, albeit unplanned," which is the whole justification for keeping `main` and `develop` separate in the first place: production can be patched without dragging in whatever `develop` happens to hold at the time.

<figure class="diagram">
<svg viewBox="0 0 340 420" role="img" aria-labelledby="gf-title gf-desc">
<title id="gf-title">Git Flow: two permanent branches joined by release and hotfix branches</title>
<desc id="gf-desc">Two vertical columns, main on the left and develop on the right, both starting from a shared seed commit. Two feature branches merge into the develop column only. A release branch splits from develop, then merges into main, where it is tagged v1.0.0, and also into develop. A hotfix branch splits from main, merges back into main, tagged v1.0.1, and also into develop.</desc>
<defs>
<marker id="gf-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-accent"/></marker>
</defs>
<rect x="90" y="6" width="160" height="28" rx="6" class="d-box"/>
<text x="170" y="25" text-anchor="middle" class="d-small">seed commit</text>
<text x="40" y="52" text-anchor="middle" class="d-mono d-small d-bold">main</text>
<text x="290" y="52" text-anchor="middle" class="d-mono d-small d-bold">develop</text>
<path d="M150 34 V64" class="d-line" marker-end="url(#gf-arrow)"/>
<path d="M190 34 L280 64" class="d-line" marker-end="url(#gf-arrow)"/>
<rect x="210" y="62" width="120" height="46" rx="6" class="d-box-2"/>
<text x="270" y="82" text-anchor="middle" class="d-small">2 feature merges</text>
<text x="270" y="98" text-anchor="middle" class="d-small d-muted">refunds, seats</text>
<path d="M270 108 V134" class="d-line" marker-end="url(#gf-arrow)"/>
<path d="M270 134 L110 158" class="d-accent d-dashed" marker-end="url(#gf-arrow)"/>
<rect x="70" y="142" width="120" height="40" rx="6" class="d-box-accent"/>
<text x="130" y="162" text-anchor="middle" class="d-small">release-1.0.0</text>
<text x="130" y="176" text-anchor="middle" class="d-small d-muted">bump + fix</text>
<path d="M130 182 V206" class="d-line" marker-end="url(#gf-arrow)"/>
<rect x="20" y="204" width="120" height="26" rx="6" class="d-box-good"/>
<text x="80" y="222" text-anchor="middle" class="d-mono d-small">tag v1.0.0</text>
<path d="M130 182 L270 206" class="d-line" marker-end="url(#gf-arrow)"/>
<rect x="210" y="204" width="120" height="26" rx="6" class="d-box-2"/>
<text x="270" y="222" text-anchor="middle" class="d-small">develop, caught up</text>
<path d="M80 230 V254" class="d-line" marker-end="url(#gf-arrow)"/>
<path d="M80 254 L270 278" class="d-accent d-dashed" marker-end="url(#gf-arrow)"/>
<rect x="20" y="262" width="120" height="40" rx="6" class="d-box-accent"/>
<text x="80" y="282" text-anchor="middle" class="d-small">hotfix-1.0.1</text>
<text x="80" y="296" text-anchor="middle" class="d-small d-muted">bump + fix</text>
<path d="M80 302 V326" class="d-line" marker-end="url(#gf-arrow)"/>
<rect x="20" y="324" width="120" height="26" rx="6" class="d-box-good"/>
<text x="80" y="342" text-anchor="middle" class="d-mono d-small">tag v1.0.1</text>
<path d="M80 302 L270 326" class="d-line" marker-end="url(#gf-arrow)"/>
<rect x="210" y="324" width="120" height="26" rx="6" class="d-box-2"/>
<text x="270" y="342" text-anchor="middle" class="d-small">develop, caught up</text>
<text x="20" y="380" class="d-muted d-small">Every release and hotfix branch</text>
<text x="20" y="396" class="d-muted d-small">merges into both columns before it is deleted.</text>
</svg>
<figcaption>Figure 3. Feature work only ever reaches <code>develop</code> directly. A release or hotfix branch is the sole bridge back to <code>main</code>, and each one crosses in both directions before it is discarded.</figcaption>
</figure>

::::exercise[Where a hotfix commit does and does not live]
`refunds` and `seats` were merged into `develop` and never directly into `main`; they only reached `main` by riding along inside `release-1.0.0`. Is the same true of the hotfix's row-count fix — does it reach `develop` only by riding inside some later release branch, or some other way? Answer from the commands above before checking with `git merge-base --is-ancestor`, the same ancestry check [Branching and Merging](/version-control/branching-and-merging/#fast-forward-the-merge-that-creates-nothing) used for fast-forwards.

:::solution
Some other way: the hotfix branch was merged into `develop` directly, one command after it was merged into `main`, with no release branch involved. `refunds` and `seats` needed a release branch to reach `main` because features only ever merge into `develop`; a hotfix does not have that restriction, since it starts from `main` and is merged into both by name.

```bash run
git merge-base --is-ancestor \
  hotfix-1.0.1 develop 2>/dev/null ||
  git log --oneline -1 \
    --grep='row count' develop
```

```text output
bc59002 fix: correct row count
```

The branch name `hotfix-1.0.1` no longer exists to check against directly, so the search falls back to finding the commit by message; either way, it is on `develop`, one merge away from the tip, not buried inside a release branch.
:::
::::

## What each model assumes about releases

The numbers above are not close. Trunk-based development shipped four pieces of work — two features, one fix, one hardening commit — through three merges, all on one branch, with no branch ever separate from `main` for more than a few commands. Git Flow shipped the same shape of work — two features, two release fixes, two version bumps — through four merges into `main` and five more into `develop`, eleven commits deep on `main` alone:

```bash run
cd ../storefront
echo "storefront (trunk-based):"
git rev-list --count --merges main
git rev-list --count main
cd ../ticketing
echo "ticketing (Git Flow):"
git rev-list --count --merges main
git rev-list --count main
```

```text output
storefront (trunk-based):
3
7
ticketing (Git Flow):
4
11
```

That gap is not an accident of this example; it is what Driessen's own post predicts when it defends the extra merge commits as worth the cost. It is also, by the same post's own later account, exactly the cost that makes Git Flow a poor fit for some teams. In a 2020 note added to the original article, Driessen draws the line himself: the model was designed for software with "multiple versions of the software running in the wild," and for the opposite case — "web apps ... typically continuously delivered, not rolled back" — he recommends "a much simpler workflow (like GitHub flow) instead of trying to shoehorn git-flow into your team." Git Flow's `develop`/`release`/`hotfix` structure exists to let several versions be prepared, shipped and patched independently; a team with exactly one thing in production at a time, deployed on every merge, is paying for machinery it has no use for.

Trunk-based development's answer to the same problem — ship continuously, without numbered release branches — has a cost of its own, and the source is equally direct about it: without a release branch to hold back unfinished work, the discount feature above could only merge safely because it shipped behind a flag. That is the trade the [Continuous Delivery](https://trunkbaseddevelopment.com/continuous-delivery/) page describes as a layer built on top of trunk-based development, up to teams that "deploy their major application to production with each commit." Feature flags decouple *merged* from *released*, which is the same decoupling Git Flow gets from a release branch, paid for in application code that has to check a flag instead of in extra merge commits.

GitHub Flow sits between the two without either cost: no release branch to maintain, and no flag required, because the pull request itself is the gate — nothing merges until it is reviewed and its checks pass, and once it merges it is live. What it does not give a team is Git Flow's ability to patch an older release while a newer one is in progress on a separate line, because there is only one long-lived branch to patch.

::::exercise[Count the model, not the feature]
A team adds a third feature to each of the two repositories above, following the same pattern as the ones already shown (a short branch on `storefront`, a feature branch off `develop` on `ticketing`, no release cut yet). Without running anything, predict the new `git rev-list --count --merges main` for each repository, then decide: does the gap between the two models get bigger, smaller, or stay the same?

:::solution
`storefront`'s count becomes 4 (one more direct merge into `main`). `ticketing`'s stays at 4, because a feature branch merges into `develop`, not `main`; the gap only reopens once another release branch carries it across. Counted this way the gap does not track "how much work shipped" at all — it tracks how many times work crossed from `develop` to `main`, which is exactly Git Flow's point: that crossing is deliberate and batched, not automatic on every merge.
:::
::::

## Commit messages: Conventional Commits

Every commit message on this page follows one convention: [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) defines `type: description`, optionally `type(scope): description`, where "the type `feat` MUST be used when a commit adds a new feature" and "the type `fix` MUST be used when a commit represents a bug fix." `chore` is not part of the required set — the specification defines only `feat` and `fix` and leaves the rest, `chore` among them, as an open convention — but it is a common way to mark a commit like a version bump that is neither. A breaking change is marked one of two ways: "a `!` immediately before the `:`" in the header (`feat!:`), or "the uppercase text `BREAKING CHANGE`, followed by a colon, space, and description" in the footer. `next-version.sh`, [built earlier on this page](#trunk-based-development-one-branch-and-short-trips-off-it), implements the specification's own mapping to semver directly: `fix` → `PATCH`, `feat` → `MINOR`, a breaking change → `MAJOR` "regardless of type."

That script has a real gap, though, and the two forms of breaking change above are exactly where it shows:

::::exercise[Find what the version script misses]
`next-version.sh` reads commit subjects with `git log --format=%s`. Conventional Commits allows a breaking change to be marked in the header, with `!`, or in the footer, with `BREAKING CHANGE:`. Which of the two will the script actually detect? Check by committing one of each kind against the `storefront` repository (still checked out from the trade-offs section above) and running the script.

:::solution
Only the `!` form: `%s` is the *subject line* alone, and a footer is part of the message *body*, which `%s` never includes. A `feat!:` commit is caught; a `feat:` commit with `BREAKING CHANGE:` in a later paragraph is invisible to the script, however the log itself is checked.

```bash run
cd ../storefront
git commit -q --allow-empty \
  -m 'feat!: redesign the cart file format'
git log -1 --format=%s |
  grep -c 'BREAKING CHANGE' || true
echo "-- as a footer instead:"
git reset -q --hard HEAD~1
git commit -q --allow-empty \
  -m 'feat: redesign the cart file format' \
  -m 'BREAKING CHANGE: cart.txt is now JSON'
git log -1 --format=%s |
  grep -Ec '!:|BREAKING CHANGE' || true
git log -1 --format=%B |
  grep -c 'BREAKING CHANGE' || true
git reset -q --hard HEAD~1
```

```text output
0
-- as a footer instead:
0
1
```

The first block's `!:` form would have matched the script's own `grep -Eq '^[a-z]+(\([^)]*\))?!:'`, but this test checks the literal string `BREAKING CHANGE` against the subject alone, which neither commit's *subject* contains — the `!` is detected by a different pattern, not this one. The second commit's footer is where the real gap shows: `%s` finds nothing, `%B` (the full message) finds one. The fix is one word: swap `%s` for `%B` wherever the script reads commit text, so a footer-only breaking change is not missed.
:::
::::

## Pull request hygiene

Git Flow predates pull requests as a universal practice — Driessen's 2010 post never mentions one — so hygiene there is whatever a team layers on top of `feature`/`release`/`hotfix` branches itself. GitHub Flow builds the pull request in as the mechanism, and its own documentation gives three concrete rules worth following regardless of which branching model sits underneath: open a **draft** pull request "if you want early feedback or advice before you complete your changes," so review starts before the branch claims to be finished; expect **branch protection** to "block merging if your pull request does not meet certain requirements," which turns "someone should review this" from a convention into something the host enforces; and **delete the branch** immediately after merging, per the flow's own last step, so a repository's branch list reflects work in progress, not a history of everything ever finished.

The merge method is a related, separate choice. This page used `--no-ff` merge commits throughout, which is one of the three methods GitHub documents; squash merging "combines all commits in the pull request into a single commit," trading the branch's own commit-by-commit history (visible above in `newsletter`'s two commits, one feature and one review fix) for one line on `main`. Neither is more correct — a team that writes disposable, unpolished commits during review and wants `main` to read as a curated log prefers squash; a team that writes each commit as a reviewable, working step, the way a red-green-refactor cycle does, has a real reason to keep them.

## Choosing a model by team and release style

| Situation | Fits | Why |
|---|---|---|
| One thing in production, deployed on every merge | Trunk-based or GitHub Flow | No release branch to maintain |
| Every change needs a review gate, enforced by the host | GitHub Flow | Branch protection enforces the gate |
| Merging and releasing are different decisions | Trunk-based, with feature flags | Flags decouple "merged" from "released" |
| Several versions supported in the field at once | Git Flow | `hotfix` patches `main` without `develop` |
| Small team, low process overhead wanted | Trunk-based or GitHub Flow | Fewest branch types, fewest merge commits |

None of the three is a personality. A team can run GitHub Flow with feature flags, or Git Flow with every feature branch reviewed through a pull request before it merges into `develop` — the choice above is about which structural guarantee the release process actually needs, not which one looks more disciplined on a diagram.
