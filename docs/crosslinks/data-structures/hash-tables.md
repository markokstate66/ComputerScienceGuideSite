# Cross-links wanted by /data-structures/hash-tables/

One line each: anchor text | target route | where in the article. All targets are planned in CONTENT_PLAN.md section 7 and were unpublished on 2026-09-22, so the body does not link them yet. Each sentence reads correctly with or without the link.

- "exactly like indexing an array" | /data-structures/arrays-and-dynamic-arrays/ | "Direct addressing: when the key is already an index", first paragraph after the direct-addressing code block. It is the listed prerequisite.
- "Linked list" (as an alternative collision-chain node shape) | /data-structures/linked-lists/ | "Building `HashMap<K,V>`: real chaining, not pseudocode", where `Node`/`Next` are introduced — the singly linked list built there is the same shape used per bucket here.
- "`SortedDictionary`/`SortedSet`" (ordered alternative) | /data-structures/binary-search-trees/ | "Choosing chaining, open addressing, or `Dictionary<TKey,TValue>`" table, as a row for "keys must be enumerated in order" (a case this article does not cover, since chained hashing has no order).

## Boundaries with siblings

- /data-structures/arrays-and-dynamic-arrays/ owns array memory layout and index arithmetic in depth; this article assumes that and only reuses "an array access is O(1)".
- /complexity/amortized-analysis/ (published) owns the doubling-and-copy amortized argument in full; this article's "prove-it" exercise references it rather than re-deriving it from scratch.
- /csharp-dotnet/value-types-vs-reference-types/ (published) owns why a struct is copied on assignment; this article's struct-key exercise uses that fact but does not re-explain it.
- /data-structures/binary-search-trees/ will own ordered key/value structures (`SortedDictionary`); this article is explicit that chaining gives no ordering guarantee.
