# Cross-links wanted by /algorithms/sorting-algorithms-compared/

One line each: anchor text | target route | where in the article. All targets are planned in CONTENT_PLAN.md section 7 and were unpublished when this round was written (2026-09-22), so the body does not link them yet. Each sentence reads correctly with or without the link.

- "a deeper case study of quicksort's three cases is planned for this site" | /complexity/best-average-worst-case/ | "Quicksort: fast on average, and one bad pivot from quadratic", after the timing program's output paragraph. That article's own angle is quicksort dying on sorted input and the three cases defined properly; this page only shows the comparison-count blowup and the shuffle fix, and should not duplicate its depth.
- "A full binary-heap implementation... is planned as its own article on this site" | /data-structures/heaps-and-priority-queues/ | "Heap sort: quicksort's guarantee, built into the algorithm", after the O(n) heapify sentence. That article owns `Peek`/`Push`/`Pop`, the sift-up/down mechanics in depth, the O(n) heapify proof sketch, and `PriorityQueue<TElement,TPriority>`'s BCL quirks; this page uses only as much heap machinery as heap sort itself needs.
- "recursion" (first use, in "Merge sort: recursion buys a guarantee...") | /algorithms/recursion/ | Currently links only to the glossary entry /glossary/#recursion; once published, consider linking the article instead since it is in the same pillar and covers the call-stack mechanics this page assumes.
- "Θ(n) auxiliary space" | /complexity/space-complexity/ | "Merge sort: recursion buys a guarantee...", the sentence introducing merge sort's memory cost. Currently links only to the glossary entry /glossary/#space-complexity.

## Boundaries with planned siblings

- /complexity/best-average-worst-case/ owns quicksort's worst-case failure mode as a case study (why it dies on sorted/adversarial input, the three cases defined properly, adversarial inputs and hash flooding). This article states only the measured comparison counts needed to motivate randomizing or using median-of-three.
- /data-structures/heaps-and-priority-queues/ owns the binary heap data structure itself (array-tree mapping, sift-up, the O(n) heapify proof, `PriorityQueue<TElement,TPriority>` API quirks, top-k and k-way merge). This article uses a heap only as the engine inside heap sort.
- /algorithms/recursion/ owns recursion's mechanics (call stack, base/recursive case, stack overflow, tail calls). This article assumes the reader can follow a recursive split/merge or partition/recurse without re-deriving how recursion works.
