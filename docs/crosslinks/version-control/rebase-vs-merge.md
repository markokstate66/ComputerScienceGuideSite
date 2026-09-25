# Cross-links wanted by /version-control/rebase-vs-merge/

One line each: anchor text | target route | where in the article. Both targets are planned in `CONTENT_PLAN.md` section 7 (`version-control` #4 and #5) and are unpublished as of this round (2026-09-22), so the body mentions them by name without a link. Each sentence reads correctly with or without the link.

- "reflog" / "worked example" (the sentence "Recovering from a rebase you did not mean to run... deserves its own worked example rather than a paragraph here") | /version-control/undoing-things-in-git/ | "What `git rebase` writes instead", last paragraph before Figure 3. That article owns the three-trees model, `restore`/`reset`/`revert` and reflog-based rescue in depth; this page only needs the one sentence tying the dangling-commit fact to where the rescue is taught. — Status: wired (body, "What `git rebase` writes instead", last paragraph)
- "trunk-based development, GitHub-Flow-style pull requests, or Git Flow" | /version-control/git-workflows/ | "Choosing merge or rebase for a shared branch", last paragraph. That article owns the comparison of branching models, PR hygiene and tagging; this page only notes that a merge/rebase policy is usually chosen alongside one of those models, not on its own. — Status: wired (body, "Choosing merge or rebase for a shared branch", last paragraph)

## Boundaries with planned siblings

- `/version-control/undoing-things-in-git/` owns `git restore`, `git reset` (all three modes), `git revert` and reflog-based recovery, organized by what went wrong. This article only uses the reflog once, to note that a rebase's replaced commits are recoverable for a while and that the rebase and merge reflog entries look different; it does not teach the rescue itself.
- `/version-control/git-workflows/` owns trunk-based development, GitHub Flow, Git Flow, PR hygiene, commit-message conventions and tagging/release branches. This article only compares what `merge` and `rebase` write to the graph and states the concrete, sourced reasons (bisect, audit trail, shared-history risk) a team might prefer one; it does not lay out a full branching model.
