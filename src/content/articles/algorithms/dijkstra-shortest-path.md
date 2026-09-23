---
title: "Dijkstra's Algorithm, Built on a PriorityQueue with No Decrease-Key"
description: "Why BFS misprices weighted edges, how PriorityQueue forces lazy deletion instead of decrease-key, path reconstruction, and where negative edges break Dijkstra."
pillar: algorithms
order: 5
author: markus
published: 2026-09-22
updated: 2026-09-22
level: intermediate
tags: [graphs, shortest-path, priority-queue, greedy-algorithms, astar]
prerequisites: ["algorithms/breadth-first-and-depth-first-search", "data-structures/heaps-and-priority-queues"]
sources:
  - title: "PriorityQueue<TElement,TPriority> Class"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.priorityqueue-2"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "PriorityQueue<TElement,TPriority>.Dequeue Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.priorityqueue-2.dequeue"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "PriorityQueue<TElement,TPriority>.Remove Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.priorityqueue-2.remove"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "PriorityQueue.cs (System.Collections), dotnet/runtime main branch"
    url: "https://github.com/dotnet/runtime/blob/main/src/libraries/System.Collections/src/System/Collections/Generic/PriorityQueue.cs"
    publisher: "dotnet/runtime on GitHub"
    accessed: 2026-09-22
  - title: "4.4 Shortest Paths"
    url: "https://algs4.cs.princeton.edu/44sp/"
    publisher: "Algorithms, 4th ed. (Sedgewick & Wayne)"
    accessed: 2026-09-22
  - title: "2.4 Priority Queues"
    url: "https://algs4.cs.princeton.edu/24pq/"
    publisher: "Algorithms, 4th ed. (Sedgewick & Wayne)"
    accessed: 2026-09-22
  - title: "A Formal Basis for the Heuristic Determination of Minimum Cost Paths"
    url: "https://doi.org/10.1109/TSSC.1968.300136"
    publisher: "IEEE Transactions on Systems Science and Cybernetics, vol. 4, no. 2 (1968)"
    accessed: 2026-09-22
  - title: "A note on two problems in connexion with graphs"
    url: "https://doi.org/10.1007/BF01386390"
    publisher: "Numerische Mathematik, vol. 1 (1959)"
    accessed: 2026-09-22
draft: true
---

Breadth-first search finds the fewest-edges path, and on an unweighted [graph](/glossary/#graph) that is also the cheapest one, because every edge costs the same. Put a price on each edge and the two questions come apart. Take three cities with two roads out of `A`:

```csharp run id=bfs-fails
Dictionary<string, List<(string To, int Weight)>> roads = new()
{
    ["A"] = [("B", 10), ("C", 1)],
    ["B"] = [],
    ["C"] = [("B", 1)],
};

Console.WriteLine($"BFS hops to B:    {BfsHops(roads, "A", "B")}");
Console.WriteLine($"true weight to B: {ShortestWeight(roads, "A", "B")}");

static int BfsHops(
    Dictionary<string, List<(string To, int Weight)>> g,
    string start, string target)
{
    var dist = new Dictionary<string, int> { [start] = 0 };
    var frontier = new Queue<string>();
    frontier.Enqueue(start);
    while (frontier.Count > 0)
    {
        string u = frontier.Dequeue();
        if (u == target) return dist[u];
        foreach (var (v, _) in g[u])
            if (!dist.ContainsKey(v))
            {
                dist[v] = dist[u] + 1;
                frontier.Enqueue(v);
            }
    }
    return -1;
}

static int ShortestWeight(
    Dictionary<string, List<(string To, int Weight)>> g,
    string start, string target)
{
    var dist = new Dictionary<string, int> { [start] = 0 };
    var visited = new HashSet<string>();
    var pq = new PriorityQueue<string, int>();
    pq.Enqueue(start, 0);
    while (pq.Count > 0)
    {
        string u = pq.Dequeue();
        if (!visited.Add(u)) continue;
        foreach (var (v, w) in g[u])
        {
            int nd = dist[u] + w;
            if (!dist.TryGetValue(v, out int cur) || nd < cur)
            {
                dist[v] = nd;
                pq.Enqueue(v, nd);
            }
        }
    }
    return dist[target];
}
```

```text output
BFS hops to B:    1
true weight to B: 2
```

`B` is one hop from `A`, so BFS reports it as reached and stops looking: it never even considers the two-hop route through `C`. But the direct road costs 10 and `A -> C -> B` costs 2, so the cheapest way to `B` is the one BFS didn't take. `ShortestWeight` above is a first cut at the algorithm E. W. Dijkstra published in 1959, in three pages, as one of two short results in the same note ([Dijkstra, *A note on two problems in connexion with graphs*](https://doi.org/10.1007/BF01386390), pp. 269-271): instead of a FIFO queue that expands strictly by hop count, it expands by a running total, always pulling out whichever reachable city currently has the smallest known cost from `A`. The rest of this article is about making that idea precise, implementing it with the priority queue .NET actually ships, reading a path back out of it, and being honest about where it stops working.

## Why picking the cheapest frontier vertex is safe

Call a vertex *finalized* once the algorithm has settled on its true shortest distance and will never revisit it. Dijkstra's rule for finalizing the next vertex is: among everything reached so far but not yet finalized, take the one with the smallest tentative distance. Sedgewick and Wayne describe the mechanics directly: Dijkstra's algorithm "repeatedly relaxes and adds to the tree a non-tree vertex with the lowest `distTo[]` value, continuing until all vertices are on the tree or no non-tree vertex has a finite `distTo[]` value" ([Sedgewick & Wayne, "Shortest Paths"](https://algs4.cs.princeton.edu/44sp/)). *Relaxing* an edge `u -> v` means checking whether reaching `v` by way of `u` beats the best route to `v` found so far, and updating it if so.

Here is why taking the frontier's minimum is safe, using the same kind of cut argument the algorithm's usual textbook proof relies on. Say vertex `u` is about to be finalized with tentative distance `d`, the smallest among everything still in the frontier. Consider any other path `P` from the source to `u`. If `P` uses only already-finalized vertices, it cannot be shorter than `d`, because those vertices' distances are already known correct, and — since the algorithm relaxes every outgoing edge of a vertex the moment that vertex finalizes, never deferring it — the effect of every edge along `P` is already folded into some tentative distance by the time `u` is chosen, so `d` already accounts for the best edge out of them. Otherwise `P` must cross, at some point, from the finalized set into an unfinalized vertex `w` — and `w` is still in the frontier, so its own tentative distance is at least `d` (that's what made `u` the minimum). Every edge from `w` onward can only add non-negative length to `P`, so `P`'s total is at least `w`'s tentative distance, which is at least `d`. Either way, nothing beats `d`, so finalizing `u` now can never be corrected later. Every step of that argument needed edge weights to be zero or positive; drop that and the chain breaks, which is exactly what the [negative-edge section](#what-a-negative-edge-breaks) below demonstrates concretely.

Figure 1 walks that argument through the three-city graph from the opening example, one relaxation at a time.

<figure class="diagram">
<svg viewBox="0 0 340 414" role="img" aria-labelledby="relax-title relax-desc">
<title id="relax-title">Three steps of Dijkstra's relaxation on a three-city graph</title>
<desc id="relax-desc">Step 1: A is finalized at 0, with B tentatively 10 by the direct edge and C tentatively 1. Step 2: C finalizes at 1 and relaxes its edge to B, dropping B's tentative distance from 10 to 2. Step 3: B finalizes at 2, the value found through C, not the original 10.</desc>
<defs>
<marker id="relax-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-stroke"/></marker>
</defs>
<text x="14" y="14" class="d-small d-bold">Step 1: start</text>
<rect x="14" y="24" width="56" height="24" rx="6" class="d-box-accent"/>
<text x="42" y="40" text-anchor="middle" class="d-mono d-small d-bold">A 0</text>
<rect x="270" y="24" width="56" height="24" rx="6" class="d-box"/>
<text x="298" y="40" text-anchor="middle" class="d-mono d-small">C 1</text>
<rect x="142" y="74" width="56" height="24" rx="6" class="d-box"/>
<text x="170" y="90" text-anchor="middle" class="d-mono d-small">B 10</text>
<path d="M70 36 L270 36" class="d-line" marker-end="url(#relax-arrow)"/>
<text x="170" y="30" text-anchor="middle" class="d-small d-muted">1</text>
<path d="M55 48 L150 74" class="d-line" marker-end="url(#relax-arrow)"/>
<text x="78" y="66" class="d-small d-muted">10</text>
<path d="M285 48 L198 74" class="d-line d-dashed"/>
<text x="245" y="66" class="d-small d-muted">1</text>
<text x="14" y="112" class="d-small d-muted">Frontier: C=1, B=10.</text>
<text x="14" y="124" class="d-small d-muted">Smallest is C, so it goes next.</text>
<text x="14" y="144" class="d-small d-bold">Step 2: pop C (1)</text>
<rect x="14" y="154" width="56" height="24" rx="6" class="d-box-2"/>
<text x="42" y="170" text-anchor="middle" class="d-mono d-small">A 0</text>
<rect x="270" y="154" width="56" height="24" rx="6" class="d-box-accent"/>
<text x="298" y="170" text-anchor="middle" class="d-mono d-small d-bold">C 1</text>
<rect x="142" y="204" width="56" height="24" rx="6" class="d-box"/>
<text x="170" y="220" text-anchor="middle" class="d-mono d-small">B 2</text>
<path d="M70 166 L270 166" class="d-line"/>
<text x="170" y="160" text-anchor="middle" class="d-small d-muted">1</text>
<path d="M55 178 L150 204" class="d-line d-dashed"/>
<text x="78" y="196" class="d-small d-muted">10</text>
<path d="M285 178 L198 204" class="d-accent" marker-end="url(#relax-arrow)"/>
<text x="230" y="196" class="d-small d-text-accent">1</text>
<text x="14" y="242" class="d-small d-muted">Relax C to B: 1 + 1 = 2, less</text>
<text x="14" y="254" class="d-small d-muted">than 10, so B's tentative</text>
<text x="14" y="266" class="d-small d-muted">distance drops to 2.</text>
<text x="14" y="286" class="d-small d-bold">Step 3: pop B (2, not 10)</text>
<rect x="14" y="296" width="56" height="24" rx="6" class="d-box-2"/>
<text x="42" y="312" text-anchor="middle" class="d-mono d-small">A 0</text>
<rect x="270" y="296" width="56" height="24" rx="6" class="d-box-2"/>
<text x="298" y="312" text-anchor="middle" class="d-mono d-small">C 1</text>
<rect x="142" y="346" width="56" height="24" rx="6" class="d-box-accent"/>
<text x="170" y="362" text-anchor="middle" class="d-mono d-small d-bold">B 2</text>
<path d="M285 320 L198 346" class="d-accent"/>
<text x="14" y="384" class="d-small d-muted">The stale (B,10) push from</text>
<text x="14" y="396" class="d-small d-muted">step 1 is still queued; it</text>
<text x="14" y="408" class="d-small d-muted">pops later and is skipped.</text>
</svg>
<figcaption>Figure 1. B is only ever finalized once, at 2 — the value the C edge produced, not the direct edge's 10 that got there first.</figcaption>
</figure>

## `PriorityQueue<TElement,TPriority>` has no decrease-key, so relax by re-enqueueing

The algorithm needs a structure that always hands back the frontier's current minimum. [`PriorityQueue<TElement,TPriority>`](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.priorityqueue-2) is a reasonable-looking fit, but its documented remarks are specific about what it is: it "implements an array-backed, quaternary min-heap," and it explicitly "does not guarantee first-in-first-out semantics for elements of equal priority" ([PriorityQueue Class](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.priorityqueue-2)). A quaternary [heap](/glossary/#heap) is the same idea as a binary heap — Sedgewick and Wayne's version "require\[s\] no more than 1 + lg *n* compares for insert and no more than 2 lg *n* compares for remove the maximum" on a binary layout ([Sedgewick & Wayne, "Priority Queues"](https://algs4.cs.princeton.edu/24pq/)) — except each internal node has four children instead of two, which shortens the tree without changing the logarithmic order of growth.

What it does not have is a way to tell an already-queued vertex "your priority just got better." Its full member list — `Enqueue`, `Dequeue`, `EnqueueDequeue`, `DequeueEnqueue`, `Peek`, `TryDequeue`, `TryPeek`, `Remove`, plus range and capacity helpers — has nothing that reprioritizes an existing entry in place. `Remove` looks like the closest option, but its remarks say plainly what it costs: "the method performs a linear-time scan of every element in the heap, removing the first value found to match the `element` parameter" ([`Remove` Method](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.priorityqueue-2.remove)). The backing store is a plain `(TElement, TPriority)[]` array with no supplementary lookup structure — nothing maps a value back to its position in the heap ([`PriorityQueue.cs`](https://github.com/dotnet/runtime/blob/main/src/libraries/System.Collections/src/System/Collections/Generic/PriorityQueue.cs)) — so there is nothing faster to scan: an `O(n)` search to undo an `O(log n)` insert. This is a real, documented gap against the classic presentation of the algorithm: Sedgewick and Wayne's own reference implementation, `DijkstraSP.java`, is built on `IndexMinPQ.java`, an *indexed* priority queue whose whole purpose is changing an already-queued key in `O(log n)`, and they set writing the alternative — "the lazy version of Dijkstra's algorithm... described in the text" — as a separate exercise ([Sedgewick & Wayne, "Shortest Paths"](https://algs4.cs.princeton.edu/44sp/)).

The lazy version is what .NET's `PriorityQueue` forces on every caller, decrease-key or not: when relaxation finds a cheaper route to a vertex already in the queue, don't touch the old entry — push a second one with the better priority, and leave the stale copy where it is. The fix for the duplicate is on the way out, not the way in. From here on the examples pop with `TryDequeue` rather than `Dequeue`, which throws `InvalidOperationException` on an empty queue ([`Dequeue` Method](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.priorityqueue-2.dequeue)); `TryDequeue` folds the emptiness check into the same call that pops, instead of needing `Count > 0` as a separate guard around it:

```csharp run id=dijkstra-trace
Dictionary<string, List<(string To, int Weight)>> city = new()
{
    ["A"] = [("B", 4), ("C", 1)],
    ["B"] = [("D", 1), ("E", 7)],
    ["C"] = [("B", 1), ("D", 5)],
    ["D"] = [("E", 2), ("F", 3)],
    ["E"] = [("F", 1)],
    ["F"] = [],
};

var dist = new Dictionary<string, int> { ["A"] = 0 };
var visited = new HashSet<string>();
var frontier = new PriorityQueue<string, int>();
frontier.Enqueue("A", 0);

Console.WriteLine("pop  pri  note");
while (frontier.TryDequeue(out string? popped, out int priority))
{
    string u = popped!;
    if (!visited.Add(u))
    {
        Console.WriteLine($"{u,-4} {priority,2}  stale (dist={dist[u]})");
        continue;
    }
    Console.WriteLine($"{u,-4} {priority,2}  final");
    foreach (var (v, weight) in city[u])
    {
        if (visited.Contains(v)) continue;
        int candidate = dist[u] + weight;
        if (!dist.TryGetValue(v, out int best) || candidate < best)
        {
            dist[v] = candidate;
            frontier.Enqueue(v, candidate);
        }
    }
}
```

```text output
pop  pri  note
A     0  final
C     1  final
B     2  final
D     3  final
B     4  stale (dist=2)
E     5  final
F     6  final
D     6  stale (dist=3)
E     9  stale (dist=5)
```

`B` is pushed twice: once at priority 4 from `A`'s direct edge, then again at priority 2 once `C` relaxes a cheaper route. `visited.Add(u)` is doing the lazy-deletion work — it returns `false` on the second copy, which the `stale` branch catches and discards without touching `dist`. The same thing happens to `D` (pushed at 6, then again at 3) and to `E` (pushed at 9, then again at 5). Nine pops handle six vertices: three of them are these harmless stale duplicates, caught in `O(log n)` on the way out instead of an `O(n)` scan on the way in. `visited` is also load-bearing for a second reason — `if (visited.Contains(v)) continue;` refuses to relax an edge *into* an already-finalized vertex at all, which matches the proof above (a finalized vertex's distance cannot improve) and matters a great deal once weights go negative.

Notice `D` and `F` both sit at priority 6 for a moment, and this trace — run on .NET 10 for this article — pops `F` before the stale `D`. That is not a rule to rely on: the class remarks already said ties are unordered, so a different .NET version, or the same graph built in a different order, could resolve that tie the other way without the algorithm being wrong.

:::dotnet
`PriorityQueue<TElement,TPriority>` also has `EnqueueDequeue` (push, then pop the new minimum) and the reverse `DequeueEnqueue` (pop, then push), which exist to update a size-bounded queue without two separate calls — useful for a bounded top-*k*, not for decrease-key, since both still only ever remove the current minimum.
:::

::::exercise[Predict what one heavier edge changes]
In the graph above, `D -> F` costs 3, and the cheapest route to `F` is `A -> C -> B -> D -> F` at 6. Suppose `D -> F` is re-priced to 10 and nothing else changes. Before running anything: does the shortest distance from `A` to `F` go up, and does the path change?

:::solution
Neither answer is the obvious one. The distance stays at 6, but the path changes completely, to `A -> C -> B -> D -> E -> F`:

```csharp run id=predict-ex
Dictionary<string, List<(string To, int Weight)>> city = new()
{
    ["A"] = [("B", 4), ("C", 1)],
    ["B"] = [("D", 1), ("E", 7)],
    ["C"] = [("B", 1), ("D", 5)],
    ["D"] = [("E", 2), ("F", 10)],
    ["E"] = [("F", 1)],
    ["F"] = [],
};

var dist = new Dictionary<string, int> { ["A"] = 0 };
var prev = new Dictionary<string, string?> { ["A"] = null };
var visited = new HashSet<string>();
var frontier = new PriorityQueue<string, int>();
frontier.Enqueue("A", 0);

Console.WriteLine("pop  pri  note");
while (frontier.TryDequeue(out string? popped, out int priority))
{
    string u = popped!;
    if (!visited.Add(u))
    {
        Console.WriteLine($"{u,-4} {priority,2}  stale (dist={dist[u]})");
        continue;
    }
    Console.WriteLine($"{u,-4} {priority,2}  final");
    foreach (var (v, weight) in city[u])
    {
        if (visited.Contains(v)) continue;
        int candidate = dist[u] + weight;
        if (!dist.TryGetValue(v, out int best) || candidate < best)
        {
            dist[v] = candidate;
            prev[v] = u;
            frontier.Enqueue(v, candidate);
        }
    }
}
Console.WriteLine();
Console.WriteLine($"F: {dist["F"]}, {PathString(prev, "F")}");

static string PathString(Dictionary<string, string?> prev, string target)
{
    var path = new List<string> { target };
    string? at = prev[target];
    while (at is not null) { path.Add(at); at = prev[at]; }
    path.Reverse();
    return string.Join(" -> ", path);
}
```

```text output
pop  pri  note
A     0  final
C     1  final
B     2  final
D     3  final
B     4  stale (dist=2)
E     5  final
D     6  stale (dist=3)
F     6  final
E     9  stale (dist=5)
F    13  stale (dist=6)

F: 6, A -> C -> B -> D -> E -> F
```

In the original graph, `E`'s route to `F` (distance 5, plus the edge's 1, totaling 6) was never used, because by the time `E` was finalized, `dist["F"]` was already 6 by way of `D`, and the relax condition needs a strict improvement (`candidate < best`), not a tie. Raising `D -> F` to 10 removes that competing 6 from `D`, so the relax condition through `E` finally succeeds — landing on the exact same total, because 6 was reachable both ways all along. `D` and `F` tie at priority 6 here too, and this time the stale `D` pops before the final `F` — the opposite order from the trace two sections back. Both traces are exactly what .NET 10 produces for their respective pushes; neither order is a guarantee `PriorityQueue` makes.
:::
::::

## Reading the shortest path back out

`dist` alone answers "how far," not "which way." A predecessor map, updated every time `dist` improves, answers the second question by walking backward from the target:

```csharp run id=dijkstra-full
Dictionary<string, List<(string To, int Weight)>> city = new()
{
    ["A"] = [("B", 4), ("C", 1)],
    ["B"] = [("D", 1), ("E", 7)],
    ["C"] = [("B", 1), ("D", 5)],
    ["D"] = [("E", 2), ("F", 3)],
    ["E"] = [("F", 1)],
    ["F"] = [],
};

var (dist, prev) = Dijkstra(city, "A");
foreach (string node in new[] { "A", "B", "C", "D", "E", "F" })
    Console.WriteLine($"{node} {dist[node],3}  {PathString(prev, node)}");

static (Dictionary<string, int> Dist, Dictionary<string, string?> Prev) Dijkstra(
    Dictionary<string, List<(string To, int Weight)>> graph, string start)
{
    var dist = new Dictionary<string, int> { [start] = 0 };
    var prev = new Dictionary<string, string?> { [start] = null };
    var visited = new HashSet<string>();
    var frontier = new PriorityQueue<string, int>();
    frontier.Enqueue(start, 0);

    while (frontier.TryDequeue(out string? popped, out _))
    {
        string u = popped!;
        if (!visited.Add(u)) continue; // a stale, already-finalized copy
        foreach (var (v, weight) in graph[u])
        {
            if (visited.Contains(v)) continue;
            int candidate = dist[u] + weight;
            if (!dist.TryGetValue(v, out int best) || candidate < best)
            {
                dist[v] = candidate;
                prev[v] = u;
                frontier.Enqueue(v, candidate);
            }
        }
    }
    return (dist, prev);
}

static string PathString(Dictionary<string, string?> prev, string target)
{
    var path = new List<string> { target };
    string? at = prev[target];
    while (at is not null)
    {
        path.Add(at);
        at = prev[at];
    }
    path.Reverse();
    return string.Join(" -> ", path);
}
```

```text output
A   0  A
B   2  A -> C -> B
C   1  A -> C
D   3  A -> C -> B -> D
E   5  A -> C -> B -> D -> E
F   6  A -> C -> B -> D -> F
```

`prev[v]` only ever gets overwritten alongside `dist[v]`, in the same `if`, so it always names the neighbor that produced the *current* best distance — never a neighbor from a route that later lost out. `PathString` reads that chain backward from any target to the source; it never has to touch `dist` on the vertices in between, because `prev` alone already encodes the shortest-path tree.

::::exercise[Find what makes this Dijkstra slower, not wrong]
This version tries to emulate a real decrease-key by removing the stale entry before pushing the improved one, instead of leaving duplicates in the queue:

```csharp run id=decreasekey
Dictionary<string, List<(string To, int Weight)>> city = new()
{
    ["A"] = [("B", 4), ("C", 1)],
    ["B"] = [("D", 1), ("E", 7)],
    ["C"] = [("B", 1), ("D", 5)],
    ["D"] = [("E", 2), ("F", 3)],
    ["E"] = [("F", 1)],
    ["F"] = [],
};

var dist = DijkstraWithRemove(city, "A");
foreach (string node in new[] { "A", "B", "C", "D", "E", "F" })
    Console.WriteLine($"{node} {dist[node],3}");

static Dictionary<string, int> DijkstraWithRemove(
    Dictionary<string, List<(string To, int Weight)>> graph, string start)
{
    var dist = new Dictionary<string, int> { [start] = 0 };
    var visited = new HashSet<string>();
    var inQueue = new HashSet<string> { start };
    var frontier = new PriorityQueue<string, int>();
    frontier.Enqueue(start, 0);

    while (frontier.TryDequeue(out string? popped, out _))
    {
        string u = popped!;
        visited.Add(u);
        inQueue.Remove(u);
        foreach (var (v, weight) in graph[u])
        {
            if (visited.Contains(v)) continue;
            int candidate = dist[u] + weight;
            if (!dist.TryGetValue(v, out int best) || candidate < best)
            {
                dist[v] = candidate;
                if (inQueue.Contains(v))
                    frontier.Remove(v, out _, out _, null);
                frontier.Enqueue(v, candidate);
                inQueue.Add(v);
            }
        }
    }
    return dist;
}
```

```text output
A   0
B   2
C   1
D   3
E   5
F   6
```

The output above isn't the puzzle: matching the lazy version's distances exactly is what correct removal-before-insert is supposed to do, and it's shown here only so you're not asked to take that on faith. The actual question is about cost, not correctness. What is actually wrong with shipping this instead?

:::solution
Nothing about the *answer* — the distances match exactly, because `Remove` really does delete the stale entry before the new one goes in, so there is never a duplicate to skip. The problem is cost: `Remove` does the `O(n)` linear scan documented above every time a relaxation improves a vertex that is already queued, on top of the `O(log n)` `Enqueue` that follows it. The lazy version pays `O(log n)` for the same relaxation and, at worst, one extra `O(log n)` pop later to discover the leftover copy is stale. On the six-vertex graph here the difference is invisible; on a graph where most vertices get relaxed more than once — which is the normal case, not a pathological one — this version's relaxation cost grows from `O(log n)` to `O(n)` per improvement, for no gain over just leaving the old entry alone.
:::
::::

## What a negative edge breaks

Every inequality in the [correctness argument](#why-picking-the-cheapest-frontier-vertex-is-safe) above depended on "everything past this point can only add distance." A negative edge cancels that:

```csharp run id=negative
Dictionary<string, List<(string To, int Weight)>> shortcuts = new()
{
    ["A"] = [("B", 1), ("C", 4)],
    ["B"] = [],
    ["C"] = [("B", -5)],
};

int dijkstraAnswer = Dijkstra(shortcuts, "A")["B"];
int trueAnswer = BruteForce(shortcuts, "A", "B");
Console.WriteLine($"Dijkstra says A to B costs {dijkstraAnswer}");
Console.WriteLine($"true shortest is {trueAnswer}, via A -> C -> B");

static Dictionary<string, int> Dijkstra(
    Dictionary<string, List<(string To, int Weight)>> graph, string start)
{
    var dist = new Dictionary<string, int> { [start] = 0 };
    var visited = new HashSet<string>();
    var frontier = new PriorityQueue<string, int>();
    frontier.Enqueue(start, 0);
    while (frontier.TryDequeue(out string? popped, out _))
    {
        string u = popped!;
        if (!visited.Add(u)) continue;
        foreach (var (v, weight) in graph[u])
        {
            if (visited.Contains(v)) continue; // v's distance is already final
            int candidate = dist[u] + weight;
            if (!dist.TryGetValue(v, out int best) || candidate < best)
            {
                dist[v] = candidate;
                frontier.Enqueue(v, candidate);
            }
        }
    }
    return dist;
}

// Every A-to-B route in this three-node graph, by exhaustion: direct,
// or by way of C. Good enough to check an answer this small; not how
// you would check a bigger graph.
static int BruteForce(
    Dictionary<string, List<(string To, int Weight)>> graph,
    string start, string target)
{
    int direct = graph[start].First(e => e.To == target).Weight;
    int viaC = graph[start].First(e => e.To == "C").Weight
        + graph["C"].First(e => e.To == target).Weight;
    return Math.Min(direct, viaC);
}
```

```text output
Dijkstra says A to B costs 1
true shortest is -1, via A -> C -> B
```

`B`'s direct edge costs 1, which is the smallest tentative distance on the very first pass, so `B` gets finalized immediately — before `C`'s edge into `B`, worth `-5`, is even examined. Once `B` is finalized, `if (visited.Contains(v)) continue;` refuses to relax into it again, exactly as it should for nonnegative weights. Here that refusal is the bug: the true cheapest route, `A -> C -> B` at `4 + (-5) = -1`, is discovered one step too late to matter. Figure 2 draws the same failure as a graph.

<figure class="diagram">
<svg viewBox="0 0 300 210" role="img" aria-labelledby="negex-title negex-desc">
<title id="negex-title">A negative edge discovered after Dijkstra has already finalized the vertex it would improve</title>
<desc id="negex-desc">A connects directly to B with weight 1 and to C with weight 4. C connects to B with weight negative 5. B is finalized at distance 1 from the direct edge before the C to B edge is examined, so the true shortest distance of negative 1 is never recorded.</desc>
<defs>
<marker id="negex-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-stroke"/></marker>
</defs>
<rect x="20" y="16" width="56" height="26" rx="6" class="d-box-accent"/>
<text x="48" y="34" text-anchor="middle" class="d-mono d-small d-bold">A</text>
<rect x="220" y="16" width="56" height="26" rx="6" class="d-box"/>
<text x="248" y="34" text-anchor="middle" class="d-mono d-small">C</text>
<rect x="120" y="96" width="56" height="26" rx="6" class="d-box-accent"/>
<text x="148" y="114" text-anchor="middle" class="d-mono d-small d-bold">B 1</text>
<path d="M76 29 L220 29" class="d-line" marker-end="url(#negex-arrow)"/>
<text x="148" y="23" text-anchor="middle" class="d-small d-muted">4</text>
<path d="M56 42 L128 98" class="d-accent" marker-end="url(#negex-arrow)"/>
<text x="70" y="72" class="d-small d-text-accent">1, wins first</text>
<path d="M238 42 L166 98" class="d-bad d-dashed" marker-end="url(#negex-arrow)"/>
<text x="185" y="72" class="d-small d-text-bad">-5, too late</text>
<text x="10" y="150" class="d-small d-muted">B finalizes at 1 from the</text>
<text x="10" y="164" class="d-small d-muted">direct edge. C to B (-5) is</text>
<text x="10" y="178" class="d-small d-muted">found afterward, from C=4,</text>
<text x="10" y="192" class="d-small d-muted">but B is already closed.</text>
</svg>
<figcaption>Figure 2. True shortest A to B is 4 + (-5) = -1, but Dijkstra's finalized set never lets that edge back in once B is closed at 1.</figcaption>
</figure>

The fix is not "use a smaller priority queue trick" — it is a different algorithm. Bellman-Ford relaxes every edge, up to `V - 1` times, without ever assuming a vertex is done: Sedgewick and Wayne describe it as solving "the single-source shortest-paths problem from a given source *s* (or finds a negative cycle reachable from *s*) for any edge-weighted digraph with *V* vertices and *E* edges, in time proportional to *EV*" ([Sedgewick & Wayne, "Shortest Paths"](https://algs4.cs.princeton.edu/44sp/)) — quadratically worse than Dijkstra's `O(E log V)` on the same page, but correct in the presence of negative weights, and able to report a negative cycle rather than a wrong number when the graph has one. Their own reference implementation of Dijkstra does not attempt to muddle through: it "throws an exception if the edge-weighted digraph has an edge with a negative weight, so that a programmer is not surprised by this exponential behavior" if the finalized-vertex check were simply dropped and relaxation allowed to repeat without bound ([Sedgewick & Wayne, "Shortest Paths"](https://algs4.cs.princeton.edu/44sp/)).

:::pitfall
"No negative edges" is a precondition on the whole graph, not on the path you care about. A single negative edge anywhere Dijkstra might reach — even one nowhere near the shortest path to your actual target — can finalize some other vertex too early and cascade from there.
:::

## Adding a heuristic: A* in brief

Dijkstra explores strictly by distance-from-start, so on an open map it spreads outward in every direction equally before favoring the one toward the goal. A* changes only the priority: instead of ordering the frontier by `g(v)`, the distance so far, it orders by `g(v) + h(v)`, where `h(v)` is a problem-specific estimate of the remaining distance to the goal. Hart, Nilsson and Raphael introduced the algorithm in 1968 under this generalization of best-first search ([Hart, Nilsson & Raphael, *A Formal Basis for the Heuristic Determination of Minimum Cost Paths*](https://doi.org/10.1109/TSSC.1968.300136)); the standard, well-known condition for A* to keep finding a truly shortest path is that `h` never *overestimates* the real remaining distance — an *admissible* heuristic. Set `h` to the constant zero function and every priority is just `g(v)` again: A* with no heuristic is Dijkstra's algorithm, letter for letter.

On a grid where movement is one step at a time in four directions, Manhattan distance (the sum of the row and column differences to the goal) never overestimates the number of steps still needed, because every step changes row or column by exactly one — so it is admissible by construction, not by luck. Adding it as `h` to the same lazy-deletion frontier costs one extra term in the priority:

```csharp run id=astar
string[] grid =
[
    "..........",
    ".####.###.",
    ".#........",
    ".#.######.",
    ".#.#....#.",
    ".#.#.##.#.",
    ".#...#....",
    ".#####.##.",
    "..........",
];

(int R, int C) start = (0, 0), goal = (8, 9);

var (dijkstraSteps, dijkstraSeen) = Search(grid, start, goal, weight: 0);
var (aStarSteps, aStarSeen) = Search(grid, start, goal, weight: 1);

Console.WriteLine("search       steps  expanded");
Console.WriteLine($"h=0 (plain) {dijkstraSteps,6}  {dijkstraSeen,8}");
Console.WriteLine($"h=Manhattan {aStarSteps,6}  {aStarSeen,8}");

static (int Steps, int Expanded) Search(
    string[] g, (int R, int C) start, (int R, int C) goal, int weight)
{
    int rows = g.Length, cols = g[0].Length;
    var dist = new Dictionary<(int, int), int> { [start] = 0 };
    var visited = new HashSet<(int, int)>();
    var frontier = new PriorityQueue<(int R, int C), int>();
    frontier.Enqueue(start, 0);
    (int dr, int dc)[] moves = [(-1, 0), (1, 0), (0, -1), (0, 1)];
    int expanded = 0;

    while (frontier.TryDequeue(out (int R, int C) u, out _))
    {
        if (!visited.Add(u)) continue;
        expanded++;
        if (u == goal) return (dist[u], expanded);
        foreach (var (dr, dc) in moves)
        {
            (int R, int C) v = (u.R + dr, u.C + dc);
            if (v.R < 0 || v.R >= rows || v.C < 0 || v.C >= cols) continue;
            if (g[v.R][v.C] == '#' || visited.Contains(v)) continue;
            int candidate = dist[u] + 1;
            if (!dist.TryGetValue(v, out int best) || candidate < best)
            {
                dist[v] = candidate;
                int h = (Math.Abs(v.R - goal.R) + Math.Abs(v.C - goal.C)) * weight;
                frontier.Enqueue(v, candidate + h);
            }
        }
    }
    return (-1, expanded);
}
```

```text output
search       steps  expanded
h=0 (plain)     17        53
h=Manhattan     17        34
```

Both searches agree on the shortest route through this maze — 17 steps — because the heuristic is admissible and the [same cut argument](#why-picking-the-cheapest-frontier-vertex-is-safe) from earlier still applies once you read `g(v) + h(v)` in place of `g(v)` throughout it. What changes is how much of the maze gets looked at: plain Dijkstra finalizes 53 of the grid's open cells before it happens to reach the goal, while the Manhattan-guided search settles for 34, because every cell it expands is one the heuristic already judged promising.

::::exercise[Measure what an exaggerated heuristic costs]
Admissibility is what *guarantees* A* stays optimal — it is not the only heuristic that happens to. Extend the `Search` function above to also try `weight: 3`, which multiplies the Manhattan estimate by three and can overestimate the true remaining distance around corners. Report its steps and expanded-cell counts alongside the other two.

:::solution
```csharp run id=astar-ex
string[] grid =
[
    "..........",
    ".####.###.",
    ".#........",
    ".#.######.",
    ".#.#....#.",
    ".#.#.##.#.",
    ".#...#....",
    ".#####.##.",
    "..........",
];

(int R, int C) start = (0, 0), goal = (8, 9);

Console.WriteLine("search       steps  expanded");
foreach (int weight in new[] { 0, 1, 3 })
{
    var (steps, expanded) = Search(grid, start, goal, weight);
    Console.WriteLine($"h x{weight,-9} {steps,6}  {expanded,8}");
}

static (int Steps, int Expanded) Search(
    string[] g, (int R, int C) start, (int R, int C) goal, int weight)
{
    int rows = g.Length, cols = g[0].Length;
    var dist = new Dictionary<(int, int), int> { [start] = 0 };
    var visited = new HashSet<(int, int)>();
    var frontier = new PriorityQueue<(int R, int C), int>();
    frontier.Enqueue(start, 0);
    (int dr, int dc)[] moves = [(-1, 0), (1, 0), (0, -1), (0, 1)];
    int expanded = 0;

    while (frontier.TryDequeue(out (int R, int C) u, out _))
    {
        if (!visited.Add(u)) continue;
        expanded++;
        if (u == goal) return (dist[u], expanded);
        foreach (var (dr, dc) in moves)
        {
            (int R, int C) v = (u.R + dr, u.C + dc);
            if (v.R < 0 || v.R >= rows || v.C < 0 || v.C >= cols) continue;
            if (g[v.R][v.C] == '#' || visited.Contains(v)) continue;
            int candidate = dist[u] + 1;
            if (!dist.TryGetValue(v, out int best) || candidate < best)
            {
                dist[v] = candidate;
                int h = (Math.Abs(v.R - goal.R) + Math.Abs(v.C - goal.C)) * weight;
                frontier.Enqueue(v, candidate + h);
            }
        }
    }
    return (-1, expanded);
}
```

```text output
search       steps  expanded
h x0             17        53
h x1             17        34
h x3             17        18
```

Tripling the heuristic expands barely a third of what plain Dijkstra does, and on this particular maze it still lands on the 17-step optimum — inflating an admissible heuristic does not automatically produce a wrong answer, it only removes the guarantee that it can't. A maze shaped so the inflated estimate overtakes the true remaining cost around a specific corner would make this version commit to a shorter-looking dead end and return a longer path than 17; this one just doesn't happen to be shaped that way.
:::
::::

Everything upstream of the priority function is unchanged from plain Dijkstra: same `visited` set finalizing vertices once, same lazy duplicates absorbed on the way out, same predecessor map for path reconstruction. A* is that algorithm with one extra number added to what gets compared — which is also why it inherits the same negative-weight failure the moment `h` or any edge goes negative.
