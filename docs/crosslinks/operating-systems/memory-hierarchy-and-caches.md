# Cross-links wanted by /operating-systems/memory-hierarchy-and-caches/

One line each: anchor text | target route | where in the article. The target was unpublished on 2026-09-24, so the body does not link it yet. The sentence reads correctly with or without the link.

- "a separate article's subject in its own right" | /csharp-dotnet/span-and-memory/ | "Struct-of-arrays: paying only for the fields the loop reads", last sentence of the paragraph that ends "goes one step further and stops paying for fields a given loop never reads at all." — Status: wired (/csharp-dotnet/span-and-memory/)

## Boundaries with planned/published siblings (to avoid near-duplicate coverage)

- /data-structures/arrays-and-dynamic-arrays/ owns the row-major vs column-major measurement, the reuse-distance explanation, and the 4096-column alignment anomaly. This article links to that section instead of re-measuring matrix traversal, and only adds the pointer-chase latency ladder, the cache-line-granularity (stride) demonstration, false sharing, and struct-of-arrays vs array-of-structs, none of which the arrays article covers.
- /operating-systems/virtual-memory/ owns page tables, the TLB and working set in depth. This article links to the TLB section once, as a one-sentence aside on the largest pointer-chase buffer, and does not re-explain paging.
- /operating-systems/processes-and-threads/ owns what a context switch costs. This article links to it once, to note that a context switch also evicts a thread's cache state, without re-measuring switch cost.
- /operating-systems/concurrency-race-conditions-locks/ owns race conditions, `lock` and `Interlocked`. This article explicitly contrasts false sharing with a race condition (same section it links from) but does not cover synchronization primitives.
- /complexity/space-complexity/ owns the struct-vs-class-in-an-array memory-layout comparison. This article links to it once and treats struct-of-arrays as a further step beyond that comparison, not a restatement of it.
