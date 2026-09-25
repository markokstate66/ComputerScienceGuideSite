---
title: "How Git Works Inside: Blobs, Trees, Commits, Refs"
description: "Build a Git commit by hand with plumbing commands and inspect each object with git cat-file to see what blobs, trees, commits and refs are on disk."
pillar: version-control
order: 1
author: markus
published: 2026-09-18
updated: 2026-09-18
level: intermediate
tags: [git, git-internals, hashing]
prerequisites: []
sources:
  - title: "Pro Git, 2nd ed., section 10.2: Git Internals - Git Objects"
    url: "https://git-scm.com/book/en/v2/Git-Internals-Git-Objects"
    publisher: "git-scm.com"
    accessed: 2026-09-18
  - title: "Pro Git, 2nd ed., section 10.3: Git Internals - Git References"
    url: "https://git-scm.com/book/en/v2/Git-Internals-Git-References"
    publisher: "git-scm.com"
    accessed: 2026-09-18
  - title: "Pro Git, 2nd ed., section 10.4: Git Internals - Packfiles"
    url: "https://git-scm.com/book/en/v2/Git-Internals-Packfiles"
    publisher: "git-scm.com"
    accessed: 2026-09-18
  - title: "Pro Git, 2nd ed., section 7.1: Git Tools - Revision Selection"
    url: "https://git-scm.com/book/en/v2/Git-Tools-Revision-Selection"
    publisher: "git-scm.com"
    accessed: 2026-09-18
  - title: "Pro Git, 2nd ed., section 10.7: Git Internals - Maintenance and Data Recovery"
    url: "https://git-scm.com/book/en/v2/Git-Internals-Maintenance-and-Data-Recovery"
    publisher: "git-scm.com"
    accessed: 2026-09-18
  - title: "gitrepository-layout: Git Repository Layout"
    url: "https://git-scm.com/docs/gitrepository-layout"
    publisher: "Git documentation"
    accessed: 2026-09-18
  - title: "gitformat-signature: Git cryptographic signature formats"
    url: "https://git-scm.com/docs/gitformat-signature"
    publisher: "Git documentation"
    accessed: 2026-09-18
  - title: "BreakingChanges: Upcoming breaking changes (Git 3.0)"
    url: "https://git-scm.com/docs/BreakingChanges"
    publisher: "Git documentation"
    accessed: 2026-09-18
  - title: "gitformat-pack: Git pack format"
    url: "https://git-scm.com/docs/gitformat-pack"
    publisher: "Git documentation"
    accessed: 2026-09-18
  - title: "hash-function-transition: Git hash function transition"
    url: "https://git-scm.com/docs/hash-function-transition"
    publisher: "Git documentation"
    accessed: 2026-09-18
  - title: "git-hash-object"
    url: "https://git-scm.com/docs/git-hash-object"
    publisher: "Git documentation"
    accessed: 2026-09-18
  - title: "git-cat-file"
    url: "https://git-scm.com/docs/git-cat-file"
    publisher: "Git documentation"
    accessed: 2026-09-18
  - title: "git-ls-files"
    url: "https://git-scm.com/docs/git-ls-files"
    publisher: "Git documentation"
    accessed: 2026-09-18
  - title: "git-fast-import (file modes)"
    url: "https://git-scm.com/docs/git-fast-import"
    publisher: "Git documentation"
    accessed: 2026-09-18
  - title: "git-reflog"
    url: "https://git-scm.com/docs/git-reflog"
    publisher: "Git documentation"
    accessed: 2026-09-18
  - title: "git-merge"
    url: "https://git-scm.com/docs/git-merge"
    publisher: "Git documentation"
    accessed: 2026-09-18
  - title: "git-pack-objects"
    url: "https://git-scm.com/docs/git-pack-objects"
    publisher: "Git documentation"
    accessed: 2026-09-18
  - title: "git-index-pack"
    url: "https://git-scm.com/docs/git-index-pack"
    publisher: "Git documentation"
    accessed: 2026-09-18
  - title: "git-push (--force-with-lease)"
    url: "https://git-scm.com/docs/git-push"
    publisher: "Git documentation"
    accessed: 2026-09-18
  - title: "git-update-index"
    url: "https://git-scm.com/docs/git-update-index"
    publisher: "Git documentation"
    accessed: 2026-09-18
  - title: "git-write-tree"
    url: "https://git-scm.com/docs/git-write-tree"
    publisher: "Git documentation"
    accessed: 2026-09-18
  - title: "git-commit-tree"
    url: "https://git-scm.com/docs/git-commit-tree"
    publisher: "Git documentation"
    accessed: 2026-09-18
  - title: "git-update-ref"
    url: "https://git-scm.com/docs/git-update-ref"
    publisher: "Git documentation"
    accessed: 2026-09-18
  - title: "git-pack-refs"
    url: "https://git-scm.com/docs/git-pack-refs"
    publisher: "Git documentation"
    accessed: 2026-09-18
  - title: "git-gc"
    url: "https://git-scm.com/docs/git-gc"
    publisher: "Git documentation"
    accessed: 2026-09-18
  - title: "git-verify-pack"
    url: "https://git-scm.com/docs/git-verify-pack"
    publisher: "Git documentation"
    accessed: 2026-09-18
  - title: "git-fsck"
    url: "https://git-scm.com/docs/git-fsck"
    publisher: "Git documentation"
    accessed: 2026-09-18
  - title: "git-init (--object-format, --ref-format)"
    url: "https://git-scm.com/docs/git-init"
    publisher: "Git documentation"
    accessed: 2026-09-18
draft: false
---

Commit two small files, one of them inside a folder, and Git adds exactly five files under `.git/objects`. Change one line, commit again, and it adds three more, not five. Create a branch and it adds none at all: the whole cost is one 41-byte file and one line in a log, both outside the object store.

Those three numbers fall out of a storage model small enough to operate by hand. This article makes a [commit](/glossary/#commit) without `git add` or `git commit`, using the low-level commands Git calls *plumbing* (the everyday ones are *porcelain*), and looks inside `.git` after every step. `git cat-file` is the main instrument: `-t` prints an object's type, `-s` its size and `-p` a readable rendering of its content ([git-cat-file](https://git-scm.com/docs/git-cat-file)).

## A new repository: no objects, and a HEAD that points at nothing

```bash run
git init -q -b main trail
cd trail
find .git/objects -type f | wc -l
cat .git/HEAD
ls .git/refs/heads | wc -l
```

```text output
0
ref: refs/heads/main
0
```

The object store is empty. `HEAD` names a branch, `refs/heads/main`, that has no file yet: a branch that has never been committed to does not exist on disk. The `-b main` matters if you type along, because without it (or an `init.defaultBranch` setting) Git 2.x calls the first branch `master`, and the `refs/heads/main` used later would be a different branch from the one `HEAD` names. The [git-init documentation](https://git-scm.com/docs/git-init) says that fallback changes to `main` in Git 3.0.

The session on this page ran under Git 2.52 in Git Bash on Windows. The helper tools (`sha1sum`, `od`, `sed`, `date`) are the GNU versions that Git Bash and Linux distributions ship; on macOS, use `shasum` in place of `sha1sum`, write `sed -i ''` for `sed -i`, and drop `-w8` from `od`, which then prints 16 bytes per row.

Blob and tree IDs on your machine will equal the ones printed here, whoever you are and whenever you run the commands. Commit and tag IDs also hash a name, an email address and two timestamps, and a signature if your configuration adds one. To reproduce those as well, pin the four values and switch signing off, the way this session did:

```bash run
git config user.name 'Ada Example'
git config user.email ada@example.com
git config commit.gpgsign false
git config tag.gpgsign false
git config core.autocrlf false
when=2026-01-15T10:00:00Z
export GIT_AUTHOR_DATE=$when
export GIT_COMMITTER_DATE=$when
```

The `git config` lines are stored in this repository's `.git/config` and apply to this repository only. The two `gpgsign` lines do nothing unless your global configuration signs commits or tags. The `autocrlf` line only silences the line-ending warnings that Git for Windows otherwise prints when it stages the LF-terminated files created below. The two exported variables last as long as the terminal does, so repeat them if you open a new one.

## What `git hash-object -w` writes

The project is a hiking plan. `git hash-object` computes the ID Git would give a file's content, and `-w` also writes it into the object database ([git-hash-object](https://git-scm.com/docs/git-hash-object)).

```bash run
printf 'Day 1: Pine Gap to Elk Lake, 14 km\n' \
  > route.txt
git hash-object -w route.txt
find .git/objects -type f
```

```text output
e51a5b5d32fa5610d69bae947791830c8f25c06d
.git/objects/e5/1a5b5d32fa5610d69bae947791830c8f25c06d
```

One file appeared, and its path is the 40-digit ID split after the second digit. The 256 possible two-digit directories exist to keep any single directory from growing huge ([gitrepository-layout](https://git-scm.com/docs/gitrepository-layout)). An object stored this way, one file each, is called a *loose* object.

`cat-file` confirms what it is:

```bash run
git cat-file -t e51a5b5
git cat-file -s e51a5b5
git cat-file -p e51a5b5
```

```text output
blob
35
Day 1: Pine Gap to Elk Lake, 14 km
```

A **blob** is file content and nothing else. The name `route.txt` is nowhere in it, nor a timestamp, nor permissions. Any unambiguous prefix of an ID, four digits or more, works wherever Git expects an object name ([Pro Git 7.1](https://git-scm.com/book/en/v2/Git-Tools-Revision-Selection)), which is why `e51a5b5` was enough.

### The ID is a SHA-1 of a short header plus the content

Git prepends a header made of the object type, a space, the content length in bytes as decimal text and a single zero byte, then runs SHA-1, a [hash function](/glossary/#hash-function) with a 160-bit result, over header and content together ([Pro Git 10.2](https://git-scm.com/book/en/v2/Git-Internals-Git-Objects)). Hashing the file alone therefore gives a different number, and adding the header by hand gives Git's:

```bash run
wc -c < route.txt
sha1sum < route.txt | cut -c1-40
{ printf 'blob 35\0'; cat route.txt; } |
  sha1sum | cut -c1-40
```

```text output
35
836073df6f5f1d81360c7b8e4893ffa3567b8968
e51a5b5d32fa5610d69bae947791830c8f25c06d
```

The last line is the same 40 digits `hash-object` printed. This is why your blob ID matches the one printed here: the ID is a pure function of the bytes. It is also why Git is described as *content-addressable* storage: you do not choose where something is stored, the content decides. Two files with equal content, anywhere in the project, at any point in history, are one blob.

::::exercise[Compute an ID without Git]
Every SHA-1 repository gives the same ID to the empty tree, a tree with no entries. Work it out using only `printf` and `sha1sum`, then ask Git for the ID of an empty input hashed as a tree, which is the second command in the solution.

:::solution
An empty tree has zero bytes of content, so the hashed bytes are just the header: the type `tree`, a space, the length `0` and a zero byte.

```bash run
printf 'tree 0\0' |
  sha1sum | cut -c1-40
git hash-object -t tree \
  /dev/null
```

```text output
4b825dc642cb6eb9a060e54bf8d69288fbee4904
4b825dc642cb6eb9a060e54bf8d69288fbee4904
```

The same reasoning gives the empty blob: `printf 'blob 0\0' | sha1sum`.
:::
::::

### The file on disk is those same bytes, zlib-compressed

Opening the object file in an editor shows noise, because Git deflates it with zlib before writing. Inflate it and the header is right there. The Perl bundled with Git for Windows, used here, includes the `Compress::Zlib` module, which is enough (`-w8` makes `od` print eight bytes per row):

```bash run
cat .git/objects/e5/1a5b5d32* |
  perl -MCompress::Zlib -e '
    binmode STDIN; undef $/;
    print uncompress(<STDIN>)' |
  od -c -w8
```

```text output
0000000   b   l   o   b       3   5  \0
0000010   D   a   y       1   :       P
0000020   i   n   e       G   a   p
0000030   t   o       E   l   k       L
0000040   a   k   e   ,       1   4
0000050   k   m  \n
0000053
```

<figure class="diagram">
<svg viewBox="0 0 360 226" role="img" aria-labelledby="lo-title lo-desc">
<title id="lo-title">How a loose object's path and contents are derived</title>
<desc id="lo-desc">A header, blob 35 and a zero byte, is joined to the file content. The SHA-1 of those bytes becomes the object's path under .git/objects, and the zlib-compressed form of the same bytes becomes the file's contents.</desc>
<defs>
<marker id="lo-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-stroke"/></marker>
</defs>
<text x="10" y="20" class="d-muted d-small">header</text>
<text x="96" y="20" class="d-muted d-small">content (35 bytes)</text>
<rect x="10" y="28" width="78" height="44" class="d-box-accent"/>
<text x="49" y="54" text-anchor="middle" class="d-mono d-small d-bold">blob 35\0</text>
<rect x="88" y="28" width="262" height="44" class="d-box"/>
<text x="219" y="54" text-anchor="middle" class="d-mono d-small">Day 1: Pine Gap to … 14 km\n</text>
<path d="M90 72 V128" class="d-line" marker-end="url(#lo-arrow)"/>
<text x="98" y="105" class="d-small">SHA-1</text>
<path d="M270 72 V128" class="d-line" marker-end="url(#lo-arrow)"/>
<text x="278" y="105" class="d-small">zlib deflate</text>
<rect x="10" y="130" width="162" height="44" rx="6" class="d-box-2"/>
<text x="91" y="157" text-anchor="middle" class="d-mono">e5 1a5b5d32…c06d</text>
<rect x="188" y="130" width="162" height="44" rx="6" class="d-box-2"/>
<text x="269" y="157" text-anchor="middle">compressed bytes</text>
<text x="10" y="196" class="d-muted d-small">names the file:</text>
<text x="10" y="214" class="d-muted d-small d-mono">.git/objects/e5/1a5b…</text>
<text x="188" y="196" class="d-muted d-small">fills the file</text>
</svg>
<figcaption>Figure 1. One byte string serves twice: hashed, it names the file; compressed, it fills it. The hash is taken before compression, so a different zlib version can never change an object's ID.</figcaption>
</figure>

## A tree is what gives a blob its name

A project needs file names and folders, so add a second file inside a directory and register both in the **index**, the binary file `.git/index` that records, per path, which blob and file mode the next commit will contain. `git add` normally does this; the plumbing equivalent is `git update-index --add` ([git-update-index](https://git-scm.com/docs/git-update-index)), which also writes any blob that is missing.

```bash run
mkdir notes
printf 'stove\nwater filter\nmap\n' \
  > notes/gear.txt
git update-index --add \
  route.txt notes/gear.txt
git ls-files --stage --abbrev=7
```

```text output
100644 bf6b004 0	notes/gear.txt
100644 e51a5b5 0	route.txt
```

The index is a flat list of paths (the `0` is a stage number; [git-ls-files](https://git-scm.com/docs/git-ls-files) describes stages 1 to 3, which appear only for paths with an unresolved merge conflict). `git write-tree` converts the list into **tree** objects, one per directory, and prints the ID of the top one ([git-write-tree](https://git-scm.com/docs/git-write-tree)). IDs are cut to seven digits in these listings so the names stay on screen:

```bash run
git write-tree
git ls-tree --abbrev=7 ce22f4d
echo "-- the notes entry:"
git ls-tree --abbrev=7 e0d71a5
```

```text output
ce22f4d14a3ea41d6d491771614255e168229f3f
040000 tree e0d71a5	notes
100644 blob e51a5b5	route.txt
-- the notes entry:
100644 blob bf6b004	gear.txt
```

A tree is a sorted list of entries, each a mode, a name and an object ID. This is where `route.txt` finally gets its name. The mode is a deliberately tiny subset of Unix permissions. [Pro Git 10.2](https://git-scm.com/book/en/v2/Git-Internals-Git-Objects) names the three that are valid for blobs, and [git-fast-import](https://git-scm.com/docs/git-fast-import) lists all five:

| Mode | Entry is |
|---|---|
| `100644` | regular file (blob) |
| `100755` | executable file (blob) |
| `120000` | symbolic link (blob) |
| `040000` | subdirectory (tree) |
| `160000` | submodule |

A symbolic link's blob holds the path the link points to. A submodule entry's ID is that of a commit in another repository, which makes it the one mode whose ID names neither a blob nor a tree. Git does not record owners, full permission bits or modification times.

`ls-tree` and `cat-file -p` print a friendly rendering of a tree. The stored form is binary, and `git cat-file tree` emits it raw. Its first 16 bytes:

```bash run
git cat-file tree ce22f4d |
  head -c 16 | od -c -w8
```

```text output
0000000   4   0   0   0   0       n   o
0000010   t   e   s  \0 340 327 032   ]
0000020
```

Each entry is the mode in ASCII, a space, the name, a zero byte, then the ID as raw bytes: 20 of them in a SHA-1 repository like this one, 32 under SHA-256. The stored mode is `40000`; the leading zero in `040000` is padding added by `ls-tree`. The three octal values after the `\0` are `e0 d7 1a`, the start of the `notes` tree's ID.

Because a tree's ID is a hash over its entries, and those entries contain the IDs of everything below, the root tree's ID fixes every name, mode and file byte in the directory. Your tree ID equals the one above for the same reason the blob ID did.

## A commit is a tree plus parents plus who, when and why

`git commit-tree` wraps a tree in a commit object and prints the new ID ([git-commit-tree](https://git-scm.com/docs/git-commit-tree)). The message comes from standard input.

```bash run
echo 'Plan day 1' |
  git commit-tree ce22f4d
git cat-file -p 505fb51
```

```text output
505fb5153c1ad312b39c1a3fab59e98e70c1cc49
tree ce22f4d14a3ea41d6d491771614255e168229f3f
author Ada Example <ada@example.com> 1768471200 +0000
committer Ada Example <ada@example.com> 1768471200 +0000

Plan day 1
```

A **commit** is that text: one `tree` line, zero or more `parent` lines (none here, as this is a root commit; [a merge has two or more](/version-control/branching-and-merging/)), an author, a committer, optionally extra headers such as the `gpgsig` that `git commit -S` adds to a signed commit ([gitformat-signature](https://git-scm.com/docs/gitformat-signature)), a blank line and the message. There is no diff in it. A commit identifies a complete snapshot through its tree, and `git show` computes a diff on demand by comparing that tree with the parent's.

The two fields after the email address are the time, as seconds since 1970, and the author's UTC offset. Cut them out of the `author` line and hand the first to GNU `date` (on macOS, `date -u -r 1768471200`):

```bash run
git cat-file -p 505fb51 |
  grep '^author' | cut -d'>' -f2
date -u -d @1768471200
```

```text output
 1768471200 +0000
Thu Jan 15 10:00:00 UTC 2026
```

That is the instant pinned in `GIT_AUTHOR_DATE` earlier.

The author and committer lines are why commit IDs do not travel between machines the way blob and tree IDs do. Your name, email and clock are part of the hashed bytes, so your commit ID differs from `505fb51` even though the tree line inside it is identical. If you skipped the pinning step, substitute your own commit IDs from here on.

The object store now holds five files, the count promised in the first paragraph: two blobs, two trees, one commit.

## The commit exists, and Git cannot find it

```bash run fails stderr
git log
```

```text output
fatal: your current branch 'main' does not have any commits yet
```

The complaint is that `main` "does not have any commits yet". Objects are found by ID or by following a pointer from another object, and nothing points at `505fb51`. `HEAD` still says `refs/heads/main`, and that file still does not exist. Creating it is the job of `git update-ref`:

```bash run
git update-ref \
  refs/heads/main 505fb51
cat .git/refs/heads/main
git log --oneline
git status
```

```text output
505fb5153c1ad312b39c1a3fab59e98e70c1cc49
505fb51 Plan day 1
On branch main
nothing to commit, working tree clean
```

A **ref** is a name for an object ID, and a branch is a ref under `refs/heads/`. In the default storage format it is a text file holding 40 hex digits and a newline. With that one file in place, porcelain agrees that there is a branch with one commit and a clean working tree. The objects and the ref are what `git commit` would have produced from the same inputs. The one trace of the detour is in the reflog described next: `update-ref` was given no reason to record, so the first line of `.git/logs/refs/heads/main` has an empty message where `git commit` would have written `commit (initial): Plan day 1`.

:::pitfall
Writing the 40 digits into `.git/refs/heads/main` with `echo` would have produced the same file. `git update-ref` does more: it takes a lock, can verify the ref's old value before replacing it, and appends to the ref's [reflog](/version-control/undoing-things-in-git/), a local log under `.git/logs/` of every value the ref has held, which is what later lets you recover from mistakes ([git-update-ref](https://git-scm.com/docs/git-update-ref), [git-reflog](https://git-scm.com/docs/git-reflog)). It also works when a ref is not an individual file, which is the state of every ref in this repository once `git gc` has run, as shown below.
:::

## `git commit` does the same, and reuses what did not change

Now the ordinary way. Add a second day to the route and commit with porcelain:

```bash run
printf 'Day 2: Elk Lake to Marten Pass, 11 km\n' \
  >> route.txt
git add route.txt
git commit -q -m 'Plan day 2'
git cat-file -p HEAD
echo "-- its tree:"
git ls-tree --abbrev=7 HEAD
echo "-- objects in the store:"
find .git/objects -type f | wc -l
```

```text output
tree dd1b3091224ef07360c48f3b4d99fde40902820b
parent 505fb5153c1ad312b39c1a3fab59e98e70c1cc49
author Ada Example <ada@example.com> 1768471200 +0000
committer Ada Example <ada@example.com> 1768471200 +0000

Plan day 2
-- its tree:
040000 tree e0d71a5	notes
100644 blob 0a47e9d	route.txt
-- objects in the store:
8
```

Five objects became eight. The three new ones are a blob for the new `route.txt`, a root tree that refers to it, and a commit with a `parent` line. Nothing under `notes/` changed, so the new root tree lists the very same `e0d71a5` as the old one, and neither that tree nor the blob below it was written again. Every commit is a full snapshot, yet what a commit adds to the store depends on the size of the files that changed, not on the size of the project, because unchanged subtrees are shared by ID. The new objects are one whole blob per changed file, however small the edit, one tree for each directory on the path down to a change, and the commit. Packing, [further down](#where-the-object-files-go-packfiles-and-packed-refs), shrinks even the whole-blob cost.

<figure class="diagram">
<svg viewBox="0 0 360 400" role="img" aria-labelledby="og-title og-desc">
<title id="og-title">Object graph after two commits</title>
<desc id="og-desc">HEAD points to the ref main, which points to commit be3c37b. That commit points to its parent 505fb51 and to root tree dd1b309. The parent points to root tree ce22f4d. Each root tree points to its own route.txt blob, and both root trees point to the same notes tree e0d71a5, which points to the gear.txt blob.</desc>
<defs>
<marker id="og-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-stroke"/></marker>
<marker id="og-arrow-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-accent"/></marker>
</defs>
<text x="8" y="16" class="d-muted d-small">refs</text>
<rect x="8" y="24" width="52" height="30" rx="15" class="d-box-2"/>
<text x="34" y="44" text-anchor="middle" class="d-mono">HEAD</text>
<path d="M60 39 H80" class="d-line" marker-end="url(#og-arrow)"/>
<rect x="82" y="24" width="66" height="30" rx="15" class="d-box-2"/>
<text x="115" y="44" text-anchor="middle" class="d-mono">main</text>
<path d="M115 54 V94" class="d-line" marker-end="url(#og-arrow)"/>
<text x="8" y="88" class="d-muted d-small">commits</text>
<rect x="60" y="96" width="110" height="50" rx="6" class="d-box-accent"/>
<text x="115" y="117" text-anchor="middle" class="d-mono d-bold">be3c37b</text>
<text x="115" y="136" text-anchor="middle" class="d-small">Plan day 2</text>
<path d="M170 121 H240" class="d-line" marker-end="url(#og-arrow)"/>
<text x="205" y="113" text-anchor="middle" class="d-muted d-small">parent</text>
<rect x="242" y="96" width="110" height="50" rx="6" class="d-box-accent"/>
<text x="297" y="117" text-anchor="middle" class="d-mono d-bold">505fb51</text>
<text x="297" y="136" text-anchor="middle" class="d-small">Plan day 1</text>
<path d="M115 146 V184" class="d-line" marker-end="url(#og-arrow)"/>
<path d="M297 146 V184" class="d-line" marker-end="url(#og-arrow)"/>
<text x="8" y="178" class="d-muted d-small">trees</text>
<rect x="60" y="186" width="110" height="40" rx="6" class="d-box"/>
<text x="115" y="211" text-anchor="middle" class="d-mono">dd1b309</text>
<rect x="242" y="186" width="110" height="40" rx="6" class="d-box"/>
<text x="297" y="211" text-anchor="middle" class="d-mono">ce22f4d</text>
<path d="M130 226 L156 260" class="d-accent" marker-end="url(#og-arrow-a)"/>
<path d="M272 226 L210 260" class="d-accent" marker-end="url(#og-arrow-a)"/>
<text x="184" y="246" text-anchor="middle" class="d-text-accent d-small">notes</text>
<rect x="125" y="262" width="110" height="40" rx="6" class="d-box"/>
<text x="180" y="287" text-anchor="middle" class="d-mono">e0d71a5</text>
<path d="M80 226 V346" class="d-line" marker-end="url(#og-arrow)"/>
<text x="74" y="290" text-anchor="end" class="d-small">route.txt</text>
<path d="M320 226 V346" class="d-line" marker-end="url(#og-arrow)"/>
<text x="314" y="290" text-anchor="end" class="d-small">route.txt</text>
<path d="M180 302 V346" class="d-line" marker-end="url(#og-arrow)"/>
<text x="186" y="328" class="d-small">gear.txt</text>
<text x="8" y="342" class="d-muted d-small">blobs</text>
<rect x="12" y="348" width="100" height="40" rx="6" class="d-box-2"/>
<text x="62" y="373" text-anchor="middle" class="d-mono">0a47e9d</text>
<rect x="130" y="348" width="100" height="40" rx="6" class="d-box-2"/>
<text x="180" y="373" text-anchor="middle" class="d-mono">bf6b004</text>
<rect x="248" y="348" width="100" height="40" rx="6" class="d-box-2"/>
<text x="298" y="373" text-anchor="middle" class="d-mono">e51a5b5</text>
</svg>
<figcaption>Figure 2. All eight objects and both refs, by row: two commits, three trees, three blobs. File names sit on the arrows because they are stored in the tree, not in the blob. The two highlighted arrows are the saving: both snapshots share one <code>notes</code> subtree.</figcaption>
</figure>

Every arrow in the figure is an ID stored inside the object the arrow leaves, and an ID is a hash of content. Two properties follow.

**Objects are immutable.** Changing one byte of an object would change its ID, so the result would be a different object. [`git commit --amend` and `git rebase` never edit commits](/version-control/rebase-vs-merge/); they write new ones and move a ref.

**A commit ID vouches for its whole history.** The commit hashes its tree ID and parent IDs, the parent hashes *its* parents, and so on down. Altering any file in any ancestor would change every ID from there to the tip. The guarantee is only as strong as the hash function, a caveat taken up [below](#what-is-specified-and-what-is-an-implementation-detail).

## A branch is a 41-byte file and a log line

```bash run
git branch detour
cat .git/refs/heads/detour
wc -c < .git/refs/heads/detour
find .git/objects -type f | wc -l
echo "-- reflog:"
wc -l < .git/logs/refs/heads/detour
git reflog show detour
```

```text output
be3c37bab9747372707a92bf3bd28d69f54bdadc
41
8
-- reflog:
1
be3c37b detour@{0}: branch: Created from main
```

Creating a branch wrote a 41-byte ref file (40 hex digits and a newline), started a one-line reflog for it, and wrote no objects. Nothing was copied, because there is nothing to copy: the branch is a name for a commit that already exists, and that commit already leads to all of its history. The cost does not depend on the size of the repository. Deleting a branch deletes the name and leaves the commits alone.

Since a branch is only a name for an ID, you can conjure one from any commit. The next block does it with a bare file write, purely to prove the point; use `git branch shortcut main~1` in real life.

```bash run
git rev-parse main~1 \
  > .git/refs/heads/shortcut
git branch -v
echo "-- branches with a reflog:"
ls .git/logs/refs/heads
```

```text output
  detour   be3c37b Plan day 2
* main     be3c37b Plan day 2
  shortcut 505fb51 Plan day 1
-- branches with a reflog:
detour
main
```

Git lists `shortcut` like any other branch. The shortcut did cost something, though. The reflog directory has `detour` and `main` and no `shortcut`, because a bare file write bypasses the reflog that `git branch` and `git update-ref` maintain.

What makes a branch differ from a fixed label is only that `git commit` moves it, and `HEAD` decides which branch that is.

## HEAD is usually a pointer to a pointer

`HEAD` answers the question "which branch should the next commit advance?". Normally it is a *symbolic ref*: it contains the name of another ref, not an ID ([Pro Git 10.3](https://git-scm.com/book/en/v2/Git-Internals-Git-References)).

```bash run
git switch -q detour
cat .git/HEAD
tail -1 .git/logs/HEAD | cut -f2
printf 'rope\n' >> notes/gear.txt
git commit -q -a \
  -m 'Pack rope for the detour'
echo "-- detour, then main:"
cat .git/refs/heads/detour
cat .git/refs/heads/main
```

```text output
ref: refs/heads/detour
checkout: moving from main to detour
-- detour, then main:
c55c497ebf2b6cfd8c17feaacf965917cf49fc0b
be3c37bab9747372707a92bf3bd28d69f54bdadc
```

Because `detour` and `main` named the same commit, switching wrote no objects and changed no working files. It rewrote the one line in `HEAD` and logged the move in `HEAD`'s own reflog, `.git/logs/HEAD`, whose newest entry is the second line of output. Between branches that differ, `git switch` also updates the index and the working files to match the target commit's tree. Committing then did what the plumbing session did by hand: wrote objects, created a commit whose parent is the ID `HEAD` resolved to, and stored the new ID in the ref that `HEAD` names. `detour` moved. `main` did not, since nothing touched its file.

`HEAD` may also hold a raw commit ID. Git calls that state *detached HEAD*:

```bash run
git switch -q --detach main
cat .git/HEAD
git switch -q main
```

```text output
be3c37bab9747372707a92bf3bd28d69f54bdadc
```

<figure class="diagram">
<svg viewBox="0 0 360 344" role="img" aria-labelledby="hd-title hd-desc">
<title id="hd-title">Attached and detached HEAD</title>
<desc id="hd-desc">At the top, HEAD points to the branch ref detour, which points to commit c55c497; a new commit moves detour. At the bottom, HEAD points directly to commit be3c37b, and the branch main points to the same commit but is not connected to HEAD; a new commit moves only HEAD.</desc>
<defs>
<marker id="hd-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-stroke"/></marker>
</defs>
<text x="10" y="22" class="d-bold">Attached: HEAD names a branch</text>
<rect x="10" y="40" width="66" height="34" rx="17" class="d-box-2"/>
<text x="43" y="62" text-anchor="middle" class="d-mono">HEAD</text>
<path d="M76 57 H106" class="d-line" marker-end="url(#hd-arrow)"/>
<rect x="108" y="40" width="80" height="34" rx="17" class="d-box-2"/>
<text x="148" y="62" text-anchor="middle" class="d-mono">detour</text>
<path d="M188 57 H238" class="d-line" marker-end="url(#hd-arrow)"/>
<rect x="240" y="35" width="110" height="44" rx="6" class="d-box-accent"/>
<text x="295" y="62" text-anchor="middle" class="d-mono d-bold">c55c497</text>
<text x="10" y="106" class="d-small">A new commit's ID is stored in detour,</text>
<text x="10" y="123" class="d-small">so the branch keeps it.</text>
<path d="M10 148 H350" class="d-line d-dashed"/>
<text x="10" y="182" class="d-bold">Detached: HEAD holds an ID</text>
<rect x="10" y="200" width="66" height="34" rx="17" class="d-box-2"/>
<text x="43" y="222" text-anchor="middle" class="d-mono">HEAD</text>
<path d="M76 217 H238" class="d-line" marker-end="url(#hd-arrow)"/>
<rect x="240" y="195" width="110" height="44" rx="6" class="d-box-accent"/>
<text x="295" y="222" text-anchor="middle" class="d-mono d-bold">be3c37b</text>
<rect x="10" y="262" width="66" height="34" rx="17" class="d-box-2"/>
<text x="43" y="284" text-anchor="middle" class="d-mono">main</text>
<path d="M76 279 H295 V241" class="d-line" marker-end="url(#hd-arrow)"/>
<text x="10" y="320" class="d-small">A new commit's ID is stored in HEAD alone;</text>
<text x="10" y="337" class="d-small">main stays put.</text>
</svg>
<figcaption>Figure 3. The only difference between the two states is what the <code>HEAD</code> file contains. Detached, new commits are named by nothing except <code>HEAD</code>, so switching away leaves them with no ref.</figcaption>
</figure>

Detached `HEAD` is the normal way to look around an old commit. The risk is specific: commits made in that state are reachable only from `HEAD`. Switch elsewhere and no ref leads to them. They survive for a while, because `HEAD`'s reflog, the file read above and the one `git reflog` prints, still lists their IDs, but the simpler fix is to name them before leaving, with `git switch -c some-name`.

## The fourth object type: the annotated tag

A lightweight tag (`git tag v0.1`) is a ref under `refs/tags/` holding a commit ID, a branch that nothing moves. An [annotated tag](/version-control/git-workflows/) is a real object:

```bash run
git tag -a v0.1 \
  -m 'First shareable plan' main
cat .git/refs/tags/v0.1
git cat-file -t v0.1
git cat-file -p v0.1
```

```text output
3ac7913495f7fc32f3b4b7995e473bb429cfb2f6
tag
object be3c37bab9747372707a92bf3bd28d69f54bdadc
type commit
tag v0.1
tagger Ada Example <ada@example.com> 1768471200 +0000

First shareable plan
```

The ref points at a **tag** object, which points at the commit and carries its own author, date and message (and a signature, if you sign it).

With blob, tree, commit and tag accounted for, the rest of `.git` is not objects. Chiefly it is:

- refs and their reflogs;
- the index;
- configuration and hooks;
- bookkeeping for an operation in progress, such as the `MERGE_HEAD` ref that [git-merge](https://git-scm.com/docs/git-merge) sets while a merge waits for conflicts to be resolved.

The [gitrepository-layout](https://git-scm.com/docs/gitrepository-layout) page has the full list. A push or fetch transfers objects and updates refs; reflogs, the index, local configuration and hooks stay on the machine that made them, so a fresh clone cannot give them back. Pack indexes, which appear in the next section, are the opposite case: [git index-pack](https://git-scm.com/docs/git-index-pack) rebuilds one from its pack.

## Where the object files go: packfiles and packed-refs

One zlib file per object, with every version of every file stored whole, would not scale. It is only the format in which objects are first written. To see the second format, give the repository a file big enough for the effect to show, change one line of it, and run `git gc`. The shape of this experiment follows the one in [Pro Git 10.4](https://git-scm.com/book/en/v2/Git-Internals-Packfiles); the data, and the look at the delta from the reading side, are new here.

```bash run
seq 1 400 | sed 's/^/waypoint /' \
  > waypoints.txt
git add waypoints.txt
git commit -q -m 'Add waypoints'
sed -i 's/^waypoint 200$/& (water)/' \
  waypoints.txt
git commit -q -a \
  -m 'Mark water at waypoint 200'
git count-objects -v |
  grep -E '^(count|in-pack):'
git gc -q
echo "-- after gc:"
git count-objects -v |
  grep -E '^(count|in-pack):'
ls .git/objects/pack |
  sed 's/pack-[0-9a-f]*/pack-<id>/'
```

```text output
count: 19
in-pack: 0
-- after gc:
count: 0
in-pack: 19
pack-<id>.idx
pack-<id>.pack
pack-<id>.rev
```

All 19 loose objects moved into one **packfile**. The `.idx` file beside it holds a sorted table of the pack's object IDs and a parallel table of their byte offsets in the pack, behind a 256-entry fan-out table indexed by an ID's first byte. To find one object among *n*, Git reads two adjacent fan-out entries, which bound the slice of IDs sharing that first byte (about *n*/256 of them, since hash bytes are evenly spread), then runs a binary search over that slice: O(log *n*) comparisons. The `.rev` file is the inverse mapping, from pack offsets back to index positions ([gitformat-pack](https://git-scm.com/docs/gitformat-pack)).

Every ID still resolves exactly as before; `cat-file` does not care which format holds an object. Inside the pack, Git is allowed to store an object as a *delta*: instructions to rebuild it by copying ranges from a base object and inserting new bytes. [`git verify-pack -v`](https://git-scm.com/docs/git-verify-pack) lists every object in a pack with its size, its size in the pack and, for a delta, its depth and base. Here are the two versions of `waypoints.txt`:

```bash run
git rev-parse --short=7 \
  HEAD:waypoints.txt
git rev-parse --short=7 \
  HEAD~1:waypoints.txt
echo "-- in the pack:"
git verify-pack -v \
  .git/objects/pack/*.idx |
  grep -E '^(bced210|bdb47cf)' |
  awk '{ print substr($1,1,7), $2,
    "size", $3, "packed", $4;
    if ($7) print "  depth", $6,
      "base", substr($7,1,7) }'
```

```text output
bced210
bdb47cf
-- in the pack:
bced210 blob size 5100 packed [...]
bdb47cf blob size [...] packed [...]
  depth 1 base bced210
```

The `[...]` marks stand for the three numbers that depend on the Git and zlib versions, which the output check on this page therefore leaves open. On this machine they were 864, 12 and 23: the newer blob (`bced210`, 5,100 bytes) occupies 864 bytes in the pack, and the older one is 12 bytes of delta instructions that compress to 23. Its depth of 1 and its base line mark it as a delta against the newer blob.

The old version is derived from the new one. [Pro Git 10.4](https://git-scm.com/book/en/v2/Git-Internals-Packfiles) gives the reason for that orientation: the most recent version is the one most likely to be read, so it should be the one that needs no reconstruction. In this repository the newer blob is also the larger of the two, and size is one of the documented sort keys for delta candidates (see the callout below), so this experiment cannot separate the two effects.

Reading the old blob back shows no sign of any of this:

```bash run
git cat-file -s bdb47cf
git cat-file -p bdb47cf |
  sed -n '200p'
fmt='%(objectsize) %(deltabase)'
echo bdb47cf |
  git cat-file --batch-check="$fmt" |
  cut -c1-12
```

```text output
5092
waypoint 200
5092 bced210
```

Asked for `bdb47cf`, `cat-file` reports the full 5,092 bytes and line 200 without its `(water)` suffix: Git rebuilt the old file from the new one plus the delta. `git show`, `git diff` and `git checkout` receive the same complete bytes whichever way they were stored. Plumbing that asks about storage can see the difference, as the `%(deltabase)` field in the last command does ([git-cat-file](https://git-scm.com/docs/git-cat-file)).

<figure class="diagram">
<svg viewBox="0 0 360 262" role="img" aria-labelledby="pk-title pk-desc">
<title id="pk-title">Loose objects before git gc and one packfile after it</title>
<desc id="pk-desc">On the left, a stack of 19 loose object files. An arrow labeled git gc leads to a packfile on the right. Inside the pack, blob bced210, the new waypoints.txt, is stored whole, and blob bdb47cf, the old waypoints.txt, is stored as a delta with an arrow pointing to bced210 as its base. Seventeen other objects share the pack. Below it, the idx file maps sorted IDs to offsets in the pack.</desc>
<defs>
<marker id="pk-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-stroke"/></marker>
<marker id="pk-arrow-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-accent"/></marker>
</defs>
<rect x="20" y="70" width="70" height="44" rx="4" class="d-box-2"/>
<rect x="14" y="78" width="70" height="44" rx="4" class="d-box-2"/>
<rect x="8" y="86" width="70" height="44" rx="4" class="d-box-2"/>
<text x="43" y="105" text-anchor="middle" class="d-small">19 loose</text>
<text x="43" y="121" text-anchor="middle" class="d-small">files</text>
<path d="M94 108 H134" class="d-line" marker-end="url(#pk-arrow)"/>
<text x="114" y="100" text-anchor="middle" class="d-small d-mono">gc</text>
<rect x="136" y="8" width="216" height="196" rx="6" class="d-box"/>
<text x="148" y="30" class="d-mono d-small d-muted">pack-&lt;id&gt;.pack</text>
<rect x="148" y="40" width="192" height="46" rx="4" class="d-box-2"/>
<text x="158" y="60" class="d-mono d-bold">bced210</text>
<text x="330" y="60" text-anchor="end" class="d-small">whole</text>
<text x="158" y="78" class="d-small">new waypoints.txt, 864 B</text>
<path d="M244 118 V88" class="d-accent" marker-end="url(#pk-arrow-a)"/>
<text x="252" y="108" class="d-small d-text-accent">base</text>
<rect x="148" y="120" width="192" height="46" rx="4" class="d-box-accent"/>
<text x="158" y="140" class="d-mono d-bold">bdb47cf</text>
<text x="330" y="140" text-anchor="end" class="d-small">delta</text>
<text x="158" y="158" class="d-small">old waypoints.txt, 23 B</text>
<text x="148" y="190" class="d-small">+ 17 more objects</text>
<rect x="136" y="214" width="216" height="40" rx="6" class="d-box-2"/>
<text x="148" y="231" class="d-mono d-small d-muted">pack-&lt;id&gt;.idx</text>
<text x="148" y="247" class="d-small">sorted IDs, and their offsets</text>
</svg>
<figcaption>Figure 4. The pack after <code>git gc</code>, with sizes as measured on this machine. The arrow runs from old to new: the current version is stored whole so that reading it needs no reconstruction, and the 5,092-byte previous version costs 23 bytes.</figcaption>
</figure>

:::warning[Deltas are not the diffs you see]
Delta compression is a storage detail below the object model. To find bases, `git pack-objects` sorts objects by type, size and optionally name, and tries each one against a window of its neighbors in that order, 10 by default. Chains of deltas are capped at a depth of 50 by default, because reading an object means applying every delta in its chain ([git-pack-objects](https://git-scm.com/docs/git-pack-objects)). Parent and child links between commits are not what selects a base, so a base need not be the previous version of a file, or the same file at all. Logically every blob is still a complete file and every commit a complete snapshot. "Git stores snapshots" and "Git stores deltas" are both true, at different layers.
:::

`git gc` does not wait to be typed. Ordinary porcelain commands check whether housekeeping is due and trigger it themselves, by default once there are roughly 6,700 loose objects ([git-gc](https://git-scm.com/docs/git-gc)). Packs are also the wire format: a fetch or push sends one pack built for the occasion, not a stream of loose objects ([git-pack-objects](https://git-scm.com/docs/git-pack-objects)).

`gc` also swept up the refs. The `sed` here only shortens each ID to seven digits to fit the page:

```bash run
ls .git/refs/heads | wc -l
sed -E 's/([0-9a-f]{7})[0-9a-f]{33}/\1/' \
  .git/packed-refs
```

```text output
0
# pack-refs with: peeled fully-peeled sorted
c55c497 refs/heads/detour
e853fb0 refs/heads/main
505fb51 refs/heads/shortcut
3ac7913 refs/tags/v0.1
^be3c37b
```

The branch files are gone and the branches are not. Refs now sit in a single `packed-refs` file; the `^` line records the commit an annotated tag finally points to, so Git need not open the tag object to find out. The next update to a branch creates a loose file again ([git-pack-refs](https://git-scm.com/docs/git-pack-refs)); Git looks for a loose file first and consults `packed-refs` only when there is none ([Pro Git 10.7](https://git-scm.com/book/en/v2/Git-Internals-Maintenance-and-Data-Recovery)). A script that reads `.git/refs/heads/main` directly therefore works on a fresh repository and breaks on an old one. Ask `git rev-parse main` instead.

## What is specified and what is an implementation detail

The object model (four types, IDs derived from content, refs naming IDs) is the stable part. Several things demonstrated above are defaults:

- **SHA-1 is not the only object format.** A practical SHA-1 collision was published in 2017. Since version 2.13, Git uses a hardened SHA-1 implementation that detects that attack, and the project chose SHA-256 as the successor ([hash-function-transition](https://git-scm.com/docs/hash-function-transition)). `git init --object-format=sha256` creates a repository with 64-digit IDs today, but the [git-init documentation](https://git-scm.com/docs/git-init) notes that SHA-256 and SHA-1 repositories cannot yet interoperate, so check that your hosting supports it first. Git 3.0 is planned to make SHA-256 the default for new repositories ([BreakingChanges](https://git-scm.com/docs/BreakingChanges)).
- **Refs are not always files.** `git init --ref-format=reftable` stores all refs in a binary table format; the loose-files-plus-`packed-refs` layout shown here is the `files` format, the default in Git 2.x ([git-init](https://git-scm.com/docs/git-init)); the same plan for Git 3.0 switches new repositories to `reftable`. Plumbing such as `update-ref`, `symbolic-ref` and `rev-parse` behaves the same on both.
- **Loose versus packed, and which deltas exist,** are invisible above the storage layer and change whenever Git repacks.

The safe rule: read `.git` to learn, and use commands to act.

## Three more experiments in the packed repository

These continue in the same repository, with `main` checked out and everything packed. The first one depends on that packed state, so do them in order.

::::exercise[What does a copied file cost?]
Copy `route.txt` to `notes/route-backup.txt`, stage it and commit. `git count-objects` reports the number of loose objects, which is currently 0. What will it report after the commit, and which objects are they?

:::solution
Three: a commit, a new root tree, and a new `notes` tree with one more entry. There is no new blob. The copy's content already exists as blob `0a47e9d`, and blobs do not know their names, so the new tree entry simply refers to it.

```bash run
cp route.txt \
  notes/route-backup.txt
git add notes/route-backup.txt
git commit -q -m 'Back up the route'
git count-objects
git ls-tree --abbrev=7 HEAD:notes
```

```text output
3 objects, [...] kilobytes
100644 blob bf6b004	gear.txt
100644 blob 0a47e9d	route-backup.txt
```

The size figure counts disk blocks, so it varies by file system.
:::
::::

::::exercise[Rescue content that was never committed]
You stage a draft with `git add`, then overwrite the file and stage it again before committing anything. Is the first draft gone? Decide from what you know about `git add`, then find a command in the [git-fsck documentation](https://git-scm.com/docs/git-fsck) that proves it.

:::solution
It is not gone. `git add` writes a blob at the moment of staging. Staging a second version makes the index point at a new blob, which leaves the first one in the object store with nothing referring to it. `git fsck` reports such objects as *dangling*.

```bash run
printf 'Day 3: rest at Marten Pass\n' \
  > day3.txt
git add day3.txt
printf 'Day 3: summit attempt\n' \
  > day3.txt
git add day3.txt
git fsck 2>/dev/null |
  grep 'dangling blob'
echo "-- content:"
git cat-file -p dcc235f
```

```text output
dangling blob dcc235fa531fbe27f9a99da45e9383d5d485b0b0
-- content:
Day 3: rest at Marten Pass
```

The rescue has a deadline. `git gc` removes unreachable objects once they are older than two weeks by default (`gc.pruneExpire`, see [git-gc](https://git-scm.com/docs/git-gc)). Until then it keeps them, in current versions by moving them into a separate *cruft pack*, so the dangling blob can outlive its loose file.
:::
::::

::::exercise[Explain the force-push]
A teammate uses an interactive rebase to fix a typo in the message of the commit three below the tip of a shared branch, changing no files. Afterwards, which IDs on that branch are different: commits, trees, blobs? Why is a normal push then rejected?

:::solution
No blob or tree changes, because no file content or name changed; the rewritten commits contain the same `tree` lines as before. The reworded commit gets a new ID, since its message is part of the hashed bytes. Its child must then be rewritten, as the child's `parent` line has to name the new ID, which changes the child's ID, and so on up to the tip. Four commits are replaced: the reworded one and the three above it.

The remote branch still names the old tip. The new tip does not have the old tip among its ancestors, so moving the remote ref would abandon commits rather than add to them. By default `git push` accepts only a *fast-forward*, an update whose new tip has the old tip among its ancestors. This one is not, and the push is rejected ([git-push](https://git-scm.com/docs/git-push)). `--force` switches that check off; `--force-with-lease` does too, but only if the remote branch still holds the value you last fetched, so it cannot silently discard a colleague's newer push. "Last fetched" means your remote-tracking ref, and the same page warns that an editor or scheduled job running `git fetch` in the background keeps that ref current and so defeats the check. Either way, anyone who built on the old commits now holds history that the branch no longer contains.
:::
::::
