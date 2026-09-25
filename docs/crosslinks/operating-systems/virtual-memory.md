# Cross-links wanted by /operating-systems/virtual-memory/

One line each: anchor text | target route | where in the article. `processes-and-threads` is unpublished (draft, round 1, not yet reviewed) as of 2026-09-22, so the body does not link it yet. Each sentence reads correctly with or without the link.

- "The article on processes and threads" | /operating-systems/processes-and-threads/ | Opening paragraph, first sentence. — Status: wired (/operating-systems/processes-and-threads/, first occurrence of this target in the article)
- "exactly analogous to two threads reaching the same heap array in the processes-and-threads article" | /operating-systems/processes-and-threads/ | "How does a memory-mapped file put a file's bytes directly into that address space?", first paragraph. — Status: dropped (duplicate target /operating-systems/processes-and-threads/, already linked earlier in the opening paragraph)

## Boundaries with planned siblings (to avoid near-duplicate coverage)

- /operating-systems/processes-and-threads/ owns what a process/thread each own, context-switch cost, the thread pool. It already covers reserve vs commit only shallowly, to read a per-thread stack size measurement, and explicitly defers "how the hardware enforces the process boundary" to this article.
- /operating-systems/memory-hierarchy-and-caches/ (planned) owns the general cache hierarchy, cache lines and false sharing. This article's TLB coverage is scoped narrowly to address translation, not caches in general; no link needed since the article never names that sibling.
- /operating-systems/cpu-scheduling/ (planned) owns scheduling algorithms; not referenced here.
- /operating-systems/file-systems/ (planned) owns blocks, inodes/MFT and `FileStream` flush semantics. This article's memory-mapped-file section stops at the OS-mapping boundary and does not cover file-system durability.
