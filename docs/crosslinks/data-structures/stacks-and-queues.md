# Cross-links wanted by /data-structures/stacks-and-queues/

One line each: anchor text | target route | where in the article. Targets are planned in CONTENT_PLAN.md section 7 and were unpublished on 2026-09-22, so the body does not link them yet. Each sentence reads correctly with or without the link.

- "a growable array elsewhere on this site" | /data-structures/arrays-and-dynamic-arrays/ | "One end only: array-backed or linked", first paragraph, describing the array-backed stack's growth policy.
- "linked-node stack" | /data-structures/linked-lists/ | "One end only: array-backed or linked", second paragraph.

## Boundaries with siblings

- /data-structures/arrays-and-dynamic-arrays/ owns the full `DynamicArray<T>` build, the doubling-growth proof and cache-locality measurements; this article only names the same doubling policy for `Stack<T>`/`Queue<T>` and does not re-derive it.
- /data-structures/linked-lists/ owns the full singly/doubly linked list build and the "why arrays usually win" argument; this article's array-vs-linked comparison for a stack stays to two paragraphs.
- /complexity/amortized-analysis/ (published) owns the `List<T>.Add` amortized proof; this article links to it directly (not through crosslinks, since it is already published) for the same doubling argument applied to `Stack<T>`/`Queue<T>` and to the monotonic-stack push/pop bound.
