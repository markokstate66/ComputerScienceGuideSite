# Cross-links wanted by /operating-systems/file-systems/

One line each: anchor text | target route | where in the article.

- "virtual-memory article" | /operating-systems/virtual-memory/ | Opening paragraph, first sentence. Linked directly (not deferred): per the round-1 task brief, `operating-systems/virtual-memory` and `operating-systems/processes-and-threads` are already published. If that is not true at merge time (this worktree's own copy of `virtual-memory.md` still had `draft: true` when this article was written), the integrator should confirm the target is live before this PR merges, or park the link the same way `virtual-memory.md`'s own crosslinks file parked its link to `processes-and-threads` during round 1.
- "write-ahead logging" | /databases/transactions-and-acid/#how-does-write-ahead-logging-change-durability-and-concurrency | "What breaks if the system crashes mid-update, and how does a journal fix it?", paragraph after Figure 2. `transactions-and-acid.md` is `draft: false` in this worktree, so this one should be safe as written.

## Boundaries with planned siblings (to avoid near-duplicate coverage)

- /operating-systems/virtual-memory/ owns memory-mapped files and page faults; its own crosslinks file already notes it "stops at the OS-mapping boundary and does not cover file-system durability," which this article covers instead. This article does not re-explain page faults or `MemoryMappedFile`.
- /operating-systems/memory-hierarchy-and-caches/ (planned, order 6) owns the general cache hierarchy; not referenced here, since this article's "OS cache" mentions are scoped narrowly to file I/O visibility, not caches in general.
- /databases/transactions-and-acid/ owns database write-ahead logging and isolation in depth; this article only draws the one-sentence parallel between its own journaling section and that article's WAL section, and does not re-explain ACID or SQLite's WAL mode.
