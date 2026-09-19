# Wanted cross-links: /version-control/how-git-works/

One line each: anchor text | target route | where in the article.

- "a merge has two or more" | /version-control/branching-and-merging/ | section "A commit is a tree plus parents plus who, when and why", paragraph after the first commit output
- "`git commit --amend` and `git rebase` never edit commits" | /version-control/rebase-vs-merge/ | section "`git commit` does the same, and reuses what did not change", paragraph "Objects are immutable."
- "reflog" (first mention, in the pitfall callout about `git update-ref`) | /version-control/undoing-things-in-git/ | section "The commit exists, and Git cannot find it"
- "`HEAD`'s reflog" | /version-control/undoing-things-in-git/ | section "HEAD is usually a pointer to a pointer", last paragraph (recovering commits made on a detached HEAD)
- "`git fsck` reports such objects as *dangling*" | /version-control/undoing-things-in-git/ | exercise 3 solution
- "interactive rebase" | /version-control/rebase-vs-merge/ | exercise 4 question
- "`--force-with-lease`" | /version-control/rebase-vs-merge/ | exercise 4 solution (golden rule of rewriting shared history)
- "annotated tag" | /version-control/git-workflows/ | section "The fourth object type: the annotated tag" (tags and releases)
