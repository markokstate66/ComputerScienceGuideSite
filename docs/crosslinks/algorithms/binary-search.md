# Cross-links wanted by /algorithms/binary-search/

One line each: anchor text | target route | where in the article. All targets are planned in CONTENT_PLAN.md section 7 and were unpublished when this round was written (2026-09-21), so the body does not link them yet. Each sentence reads correctly with or without the link.

- "O(log *n*)" | /complexity/big-o-notation/ | "Why a million elements need twenty probes", first paragraph. Currently links to the glossary entry /glossary/#big-o-notation; switch to the article (it is also the listed prerequisite). — Status: wired (body, "Why a million elements need twenty probes")
- "A linked list" | /data-structures/linked-lists/ | "Why a million elements need twenty probes", last paragraph ("A linked list does not, because reaching the middle node is itself O(n)"). — Status: wired (body, "Why a million elements need twenty probes")
- "Sorting costs O(*n* log *n*) with merge sort" | /algorithms/sorting-algorithms-compared/ | "When binary search is the wrong tool", first bullet. — Status: wired (body, "When binary search is the wrong tool", first bullet)
- "A hash table" | /data-structures/hash-tables/ | "When binary search is the wrong tool", second bullet. — Status: wired (body, "When binary search is the wrong tool", second bullet)
- "`List<T>.Insert` is documented as O(*n*)" | /data-structures/arrays-and-dynamic-arrays/ | "When binary search is the wrong tool", third bullet. — Status: wired (body, "When binary search is the wrong tool", third bullet; kept the existing external MS Learn link on `List<T>.Insert` and added the internal crosslink on "is documented as O(*n*)" so the inline citation stays intact)
- "balanced binary search tree" | /data-structures/binary-search-trees/ | "When binary search is the wrong tool", third bullet. — Status: wired (body, "When binary search is the wrong tool", third bullet)
- "best case" | /complexity/best-average-worst-case/ | "Why a million elements need twenty probes", first paragraph ("The best case is a single probe"). — Status: wired (body, "Why a million elements need twenty probes")

## Boundaries with planned siblings

- /data-structures/binary-search-trees/ owns tree search, insertion, deletion and balancing. This article mentions a balanced tree only as the alternative when a sorted array's O(n) insertion is the bottleneck.
- /data-structures/tries/ plans a "sorted array + binary search" comparison for prefix lookup; it can link to the lower-bound section here (/algorithms/binary-search/#first-last-and-how-many-lower-bound-and-upper-bound) instead of re-deriving it.
- /algorithms/sorting-algorithms-compared/ owns sorting costs; this article states only the O(n log n) figure needed to argue when sorting first pays off.
