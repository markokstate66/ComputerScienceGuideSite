# Wanted cross-links: /version-control/how-git-works/

One line each: anchor text | target route | where in the article.

- "a merge has two or more" | /version-control/branching-and-merging/ | section "A commit is a tree plus parents plus who, when and why", paragraph after the first commit output — Status: wired (body, that paragraph)
- "`git commit --amend` and `git rebase` never edit commits" | /version-control/rebase-vs-merge/ | section "`git commit` does the same, and reuses what did not change", paragraph "Objects are immutable." — Status: wired (body, "Objects are immutable." paragraph)
- "reflog" (first mention, in the pitfall callout about `git update-ref`) | /version-control/undoing-things-in-git/ | section "The commit exists, and Git cannot find it" — Status: wired (body, `:::pitfall` callout)
- "`HEAD`'s reflog" | /version-control/undoing-things-in-git/ | section "HEAD is usually a pointer to a pointer", last paragraph (recovering commits made on a detached HEAD) — Status: dropped (duplicate target — undoing-things-in-git already linked earlier via "reflog" in the update-ref pitfall callout; site policy is first occurrence only)
- "`git fsck` reports such objects as *dangling*" | /version-control/undoing-things-in-git/ | exercise 3 solution — Status: dropped (duplicate target — undoing-things-in-git already linked earlier; site policy is first occurrence only)
- "interactive rebase" | /version-control/rebase-vs-merge/ | exercise 4 question — Status: dropped (duplicate target — rebase-vs-merge already linked earlier via "`git commit --amend` and `git rebase` never edit commits"; site policy is first occurrence only)
- "`--force-with-lease`" | /version-control/rebase-vs-merge/ | exercise 4 solution (golden rule of rewriting shared history) — Status: dropped (duplicate target — rebase-vs-merge already linked earlier; site policy is first occurrence only)
- "annotated tag" | /version-control/git-workflows/ | section "The fourth object type: the annotated tag" (tags and releases) — Status: wired (body, "An annotated tag is a real object:"; removed the italic emphasis on "annotated" since it is now part of the link text)
