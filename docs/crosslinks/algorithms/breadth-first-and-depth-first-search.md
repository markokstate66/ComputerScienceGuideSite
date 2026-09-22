# Cross-links wanted by `/algorithms/breadth-first-and-depth-first-search/`

One line each: anchor text | target route | where in the article. All targets are planned in CONTENT_PLAN.md section 7 and were unpublished when this round was written (2026-09-22), so the body does not link them yet. Each sentence reads correctly with or without the link.

- "adjacency-list representation" | /data-structures/graphs-representation/ | "What both cost", the sentence introducing "which every algorithm in this article assumes."
- "adjacency matrix" | /data-structures/graphs-representation/ | "What both cost", the sentence about the O(V^2) bound for a matrix representation.
- "`Queue<T>`, `Stack<T>` internals" | /data-structures/stacks-and-queues/ | The `:::dotnet` callout in "The one-line swap: `Queue<T>` for a `Stack<T>`" — that article covers the ring-buffer and array-growth internals of both types in depth; this one only cites the documented complexity.
- "the next article in this pillar" | /algorithms/dijkstra-shortest-path/ | "What both cost", closing sentence about weighted shortest paths.

## Boundaries with planned siblings

- /data-structures/stacks-and-queues/ owns the ADT-level treatment of stacks and queues (bracket matching, ring buffer, monotonic stack) and the internal layout of `Stack<T>`/`Queue<T>`. This article only uses them as a BFS/DFS frontier and cites their documented Big-O, not their implementation.
- /data-structures/graphs-representation/ owns adjacency list vs matrix vs edge list trade-offs and weighted/directed representation choices. This article assumes an adjacency-list `Dictionary<TKey, List<TValue>>` throughout and states only the complexity consequence of choosing a matrix instead.
- /algorithms/dijkstra-shortest-path/ owns weighted shortest paths. This article's BFS shortest-path section is scoped to unweighted graphs only, and says so.
- /algorithms/recursion/ owns the call-stack/recursion-vs-iteration story in general; this article reuses "call stack" without re-deriving it, since recursive DFS is the running example throughout.
