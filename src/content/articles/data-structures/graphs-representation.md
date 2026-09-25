---
title: "Representing Graphs: Adjacency Lists, Matrices and Trade-offs"
description: "Store the same graph as a matrix, an adjacency list and an edge list, measure C# memory at each density, and use a decision guide grounded in real numbers."
pillar: data-structures
order: 7
author: markus
published: 2026-09-22
updated: 2026-09-22
level: intermediate
tags: [graphs, adjacency-list, adjacency-matrix, space-complexity, big-o]
prerequisites: ["data-structures/arrays-and-dynamic-arrays", "data-structures/hash-tables"]
sources:
  - title: "4.1 Undirected Graphs"
    url: "https://algs4.cs.princeton.edu/41graph/"
    publisher: "Algorithms, 4th ed. (Sedgewick & Wayne)"
    accessed: 2026-09-22
  - title: "4.2 Directed Graphs"
    url: "https://algs4.cs.princeton.edu/42digraph/"
    publisher: "Algorithms, 4th ed. (Sedgewick & Wayne)"
    accessed: 2026-09-22
  - title: "Introduction to Algorithms, 4th ed., the chapter on elementary graph algorithms"
    url: "https://mitpress.mit.edu/9780262046305/introduction-to-algorithms/"
    publisher: "MIT Press"
    accessed: 2026-09-22
  - title: "4.3 Minimum Spanning Trees"
    url: "https://algs4.cs.princeton.edu/43mst/"
    publisher: "Algorithms, 4th ed. (Sedgewick & Wayne)"
    accessed: 2026-09-22
  - title: "GC.GetAllocatedBytesForCurrentThread Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.gc.getallocatedbytesforcurrentthread"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Dictionary<TKey,TValue> Class"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.dictionary-2"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "List<T> Class"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.list-1"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
draft: false
---

A [graph](/glossary/#graph) is a set of vertices connected by edges, and nothing about that definition says how to store one. Take five junctions in a park, connected by footpaths: `A-B`, `A-C`, `B-D`, `C-D`, `D-E`. Every edge here is **undirected** (a footpath can be walked either way) and **unweighted** (the definition doesn't record distance, only that a path exists). Change either property and the same five junctions become a different kind of graph: a **directed** edge `A -> B` says you can go from `A` to `B` but says nothing about the reverse; a **weighted** edge attaches a number, usually a cost such as distance or time. A graph can be any combination of the two: this article's later sections build a directed, weighted one. None of that touches how many vertices or edges there are — that's what decides which representation is cheap.

## The same graph, stored three ways

There are three standard ways to hold a graph in memory, and all three describe the exact same five-junction graph above:

<figure class="diagram">
<svg viewBox="0 0 360 590" role="img" aria-labelledby="reps3-title reps3-desc">
<title id="reps3-title">One graph shown as a matrix, an adjacency list, and an edge list</title>
<desc id="reps3-desc">A five-node graph with junctions A through E and edges A-B, A-C, B-D, C-D, D-E is drawn once, then shown as a 5x5 adjacency matrix with the ten symmetric edge marks, then as five adjacency-list rows, then as one edge-list row of five pairs.</desc>
<text x="10" y="18" class="d-small d-muted">The graph:</text>
<path d="M55 84 L150 44" class="d-line"/>
<path d="M55 84 L150 124" class="d-line"/>
<path d="M150 44 L245 84" class="d-line"/>
<path d="M150 124 L245 84" class="d-line"/>
<path d="M245 84 L330 84" class="d-line"/>
<circle cx="55" cy="84" r="16" class="d-box-accent"/>
<text x="55" y="89" text-anchor="middle" class="d-mono d-small d-bold">A</text>
<circle cx="150" cy="44" r="16" class="d-box-accent"/>
<text x="150" y="49" text-anchor="middle" class="d-mono d-small d-bold">B</text>
<circle cx="150" cy="124" r="16" class="d-box-accent"/>
<text x="150" y="129" text-anchor="middle" class="d-mono d-small d-bold">C</text>
<circle cx="245" cy="84" r="16" class="d-box-accent"/>
<text x="245" y="89" text-anchor="middle" class="d-mono d-small d-bold">D</text>
<circle cx="330" cy="84" r="16" class="d-box-accent"/>
<text x="330" y="89" text-anchor="middle" class="d-mono d-small d-bold">E</text>
<text x="10" y="172" class="d-bold">1. Adjacency matrix</text>
<rect x="38" y="214" width="140" height="140" class="d-box"/>
<path d="M66 214 V354" class="d-line"/>
<path d="M94 214 V354" class="d-line"/>
<path d="M122 214 V354" class="d-line"/>
<path d="M150 214 V354" class="d-line"/>
<path d="M38 242 H178" class="d-line"/>
<path d="M38 270 H178" class="d-line"/>
<path d="M38 298 H178" class="d-line"/>
<path d="M38 326 H178" class="d-line"/>
<text x="52" y="206" text-anchor="middle" class="d-mono d-small">A</text>
<text x="80" y="206" text-anchor="middle" class="d-mono d-small">B</text>
<text x="108" y="206" text-anchor="middle" class="d-mono d-small">C</text>
<text x="136" y="206" text-anchor="middle" class="d-mono d-small">D</text>
<text x="164" y="206" text-anchor="middle" class="d-mono d-small">E</text>
<text x="24" y="232" text-anchor="middle" class="d-mono d-small">A</text>
<text x="24" y="260" text-anchor="middle" class="d-mono d-small">B</text>
<text x="24" y="288" text-anchor="middle" class="d-mono d-small">C</text>
<text x="24" y="316" text-anchor="middle" class="d-mono d-small">D</text>
<text x="24" y="344" text-anchor="middle" class="d-mono d-small">E</text>
<text x="80" y="232" text-anchor="middle" class="d-mono d-bold d-text-accent">1</text>
<text x="108" y="232" text-anchor="middle" class="d-mono d-bold d-text-accent">1</text>
<text x="52" y="260" text-anchor="middle" class="d-mono d-bold d-text-accent">1</text>
<text x="136" y="260" text-anchor="middle" class="d-mono d-bold d-text-accent">1</text>
<text x="52" y="288" text-anchor="middle" class="d-mono d-bold d-text-accent">1</text>
<text x="136" y="288" text-anchor="middle" class="d-mono d-bold d-text-accent">1</text>
<text x="80" y="316" text-anchor="middle" class="d-mono d-bold d-text-accent">1</text>
<text x="108" y="316" text-anchor="middle" class="d-mono d-bold d-text-accent">1</text>
<text x="164" y="316" text-anchor="middle" class="d-mono d-bold d-text-accent">1</text>
<text x="136" y="344" text-anchor="middle" class="d-mono d-bold d-text-accent">1</text>
<text x="10" y="372" class="d-bold">2. Adjacency list</text>
<rect x="10" y="386" width="150" height="22" rx="4" class="d-box"/>
<text x="20" y="401" class="d-mono d-small">A -&gt; B, C</text>
<rect x="10" y="412" width="150" height="22" rx="4" class="d-box"/>
<text x="20" y="427" class="d-mono d-small">B -&gt; A, D</text>
<rect x="10" y="438" width="150" height="22" rx="4" class="d-box"/>
<text x="20" y="453" class="d-mono d-small">C -&gt; A, D</text>
<rect x="10" y="464" width="150" height="22" rx="4" class="d-box"/>
<text x="20" y="479" class="d-mono d-small">D -&gt; B, C, E</text>
<rect x="10" y="490" width="150" height="22" rx="4" class="d-box"/>
<text x="20" y="505" class="d-mono d-small">E -&gt; D</text>
<text x="10" y="532" class="d-bold">3. Edge list</text>
<rect x="10" y="544" width="270" height="24" rx="4" class="d-box"/>
<text x="20" y="561" class="d-mono d-small">(A,B) (A,C) (B,D) (C,D) (D,E)</text>
</svg>
<figcaption>Figure 1. The matrix marks every edge twice, once on each side of the diagonal, because the graph is undirected. The adjacency list groups the same ten marks by vertex. The edge list is the shortest of the three: each of the five edges appears exactly once, with no per-vertex grouping at all.</figcaption>
</figure>

An **adjacency matrix** is a `V x V` grid of cells, one row and one column per vertex, where cell `(u, v)` records whether an edge connects `u` and `v`. An **adjacency list** keeps, for every vertex, the list of vertices it connects to directly — Sedgewick and Wayne describe it as "a vertex-indexed array of lists of the vertices connected by an edge to each vertex" ([Sedgewick & Wayne, "Undirected Graphs"](https://algs4.cs.princeton.edu/41graph/)). An **edge list** drops the per-vertex grouping entirely and just stores every edge once, as a pair (or a triple, with a weight) — the representation Kruskal's minimum-spanning-tree algorithm processes directly, since it needs every edge in one sorted sequence rather than grouped by vertex, and runs in "time proportional to E log E" doing it ([Sedgewick & Wayne, "Minimum Spanning Trees"](https://algs4.cs.princeton.edu/43mst/)).

The same graph, built three ways and cross-checked against each other:

```csharp run id=adjacency-classes
string[] names = ["A", "B", "C", "D", "E"];
(int From, int To)[] trails = [(0, 1), (0, 2), (1, 3), (2, 3), (3, 4)];

var byList = new AdjacencyListGraph(names.Length);
var byMatrix = new AdjacencyMatrixGraph(names.Length);
foreach (var (u, v) in trails)
{
    byList.AddEdge(u, v);
    byMatrix.AddEdge(u, v);
}

for (int u = 0; u < names.Length; u++)
{
    var fromList = byList.Neighbors(u).OrderBy(v => v);
    var fromMatrix = byMatrix.Neighbors(u).OrderBy(v => v);
    string joined = string.Join(", ", fromList.Select(v => names[v]));
    Console.WriteLine($"{names[u]} -> {joined}");
    if (!fromList.SequenceEqual(fromMatrix))
        throw new InvalidOperationException($"disagreement at {names[u]}");
}

Console.WriteLine("list and matrix agree on every vertex's neighbors: True");

sealed class AdjacencyListGraph(int vertexCount)
{
    private readonly List<int>[] adj = InitLists(vertexCount);

    public void AddEdge(int u, int v)
    {
        adj[u].Add(v);
        adj[v].Add(u);
    }

    public IReadOnlyList<int> Neighbors(int u) => adj[u];

    private static List<int>[] InitLists(int n)
    {
        var lists = new List<int>[n];
        for (int i = 0; i < n; i++) lists[i] = [];
        return lists;
    }
}

sealed class AdjacencyMatrixGraph(int vertexCount)
{
    private readonly bool[,] matrix = new bool[vertexCount, vertexCount];
    private readonly int vertexCount = vertexCount;

    public void AddEdge(int u, int v)
    {
        matrix[u, v] = true;
        matrix[v, u] = true;
    }

    public IEnumerable<int> Neighbors(int u)
    {
        for (int v = 0; v < vertexCount; v++)
            if (matrix[u, v]) yield return v;
    }
}
```

```text output
A -> B, C
B -> A, D
C -> A, D
D -> B, C, E
E -> D
list and matrix agree on every vertex's neighbors: True
```

`AdjacencyListGraph.AddEdge` and `AdjacencyMatrixGraph.AddEdge` both do their work in `u`'s row and `v`'s row (or column) in one call, because the graph is undirected: an edge from `u` to `v` is also an edge from `v` to `u`, so both representations record it twice. `Neighbors` is where the two diverge in shape. The list version returns exactly the vertices stored for `u`, work proportional to `u`'s **degree** — its number of incident edges. The matrix version has to look at every one of the `V` columns in `u`'s row, whether or not an edge is there, because a matrix has no way to skip a cell it hasn't set: absence of an edge and presence of a "0" are the same bit.

:::note
Both classes above index vertices `0` to `V - 1`. [BFS and DFS](/algorithms/breadth-first-and-depth-first-search/) and [Dijkstra's algorithm](/algorithms/dijkstra-shortest-path/) in this pillar instead key their graphs on `Dictionary<string, List<string>>`, because their vertices are named strings, not small contiguous integers. That trades the array's direct indexing for a hash lookup on every access — [`Dictionary<TKey,TValue>` is "implemented as a hash table"](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.dictionary-2), close to O(1) but with real constant-factor cost the array version doesn't pay. When vertices are already small integers (or you're willing to map each one to an integer once, up front), arrays are strictly cheaper.
:::

## What each operation costs

| Operation | Adjacency matrix | Adjacency list | Edge list |
|---|---|---|---|
| Does edge `(u, v)` exist? | O(1) | O(deg(u)) | O(E) |
| Every neighbor of `u` | O(V) | O(deg(u)) | O(E) |
| Add an edge | O(1) | O(1) | O(1) |
| Add a vertex | O(V<sup>2</sup>) (rebuild the matrix) | O(1) | O(1) |
| Every edge in the graph | O(V<sup>2</sup>) | O(V + E) | O(E) |
| Space | O(V<sup>2</sup>) | O(V + E) | O(E) |

The list and edge-list "add a vertex" row assumes a growable outer container — a `List<List<int>>` or the `Dictionary<string, List<string>>` the note above mentions — rather than the fixed-size `List<int>[]` this article's demo classes use to keep their vertex count matched to the matrix they're compared against; a fixed-size outer array would cost O(V) to grow, same as any array.

Every algorithm in [BFS and DFS](/algorithms/breadth-first-and-depth-first-search/) is built on the adjacency-list row "every neighbor of `u`," which is why that article states its cost as O(V + E): the traversal visits each vertex once and, when it does, scans exactly that vertex's list. Swap in an adjacency matrix and the same traversal becomes O(V<sup>2</sup>), because scanning "every neighbor of `u`" now means testing all `V` possible columns regardless of how many are actually edges — [Cormen, Leiserson, Rivest and Stein](https://mitpress.mit.edu/9780262046305/introduction-to-algorithms/) give exactly this V<sup>2</sup> bound for the matrix's storage, and it costs the same to scan a row as it did to allocate it. Nothing about the table depends on which language implements it; it depends only on what a cell in each structure can and can't skip.

## Weighted and directed variants

Adding weight or direction to either representation changes what's stored, not the overall shape. A weighted adjacency list pairs each neighbor with a weight instead of just the vertex; a weighted matrix stores a number in each cell instead of a bit, with a sentinel value standing in for "no edge" (a plain `0` would be ambiguous with a real zero-weight edge). Direction removes the requirement to write the edge twice: a directed edge `u -> v` updates only `u`'s row.

The next program builds a small one-way trail-connector system — four junctions, five directed segments, each with a distance in meters — as both a weighted adjacency list and a weighted adjacency matrix, and checks that a reverse edge nobody added is correctly absent from both:

```csharp run id=directed-weighted
string[] names = ["P", "Q", "R", "S"];
(int From, int To, int Meters)[] connectors =
[
    (0, 1, 120), // P -> Q, a one-way downhill staircase
    (1, 2, 80),  // Q -> R
    (0, 2, 250), // P -> R, a longer gentle path
    (2, 3, 60),  // R -> S
    (3, 1, 200), // S -> Q, a detour back
];

var byList = new WeightedDigraphList(names.Length);
var byMatrix = new WeightedDigraphMatrix(names.Length);
foreach (var (from, to, meters) in connectors)
{
    byList.AddEdge(from, to, meters);
    byMatrix.AddEdge(from, to, meters);
}

foreach (var (from, to, meters) in connectors)
{
    int viaMatrix = byMatrix.WeightOf(from, to);
    Console.WriteLine($"{names[from]} -> {names[to]}: {meters}m (matrix: {viaMatrix}m)");
}

Console.WriteLine(
    $"Q -> P exists? matrix says {byMatrix.WeightOf(1, 0) != WeightedDigraphMatrix.NoEdge}");

sealed class WeightedDigraphList(int vertexCount)
{
    private readonly List<(int To, int Weight)>[] adj = InitLists(vertexCount);

    public void AddEdge(int from, int to, int weight) => adj[from].Add((to, weight));

    public IReadOnlyList<(int To, int Weight)> Neighbors(int u) => adj[u];

    private static List<(int, int)>[] InitLists(int n)
    {
        var lists = new List<(int, int)>[n];
        for (int i = 0; i < n; i++) lists[i] = [];
        return lists;
    }
}

sealed class WeightedDigraphMatrix
{
    public const int NoEdge = -1;
    private readonly int[,] weight;
    private readonly int vertexCount;

    public WeightedDigraphMatrix(int vertexCount)
    {
        this.vertexCount = vertexCount;
        weight = new int[vertexCount, vertexCount];
        for (int u = 0; u < vertexCount; u++)
            for (int v = 0; v < vertexCount; v++)
                weight[u, v] = NoEdge;
    }

    public void AddEdge(int from, int to, int w) => weight[from, to] = w;

    public int WeightOf(int from, int to) => weight[from, to];
}
```

```text output
P -> Q: 120m (matrix: 120m)
Q -> R: 80m (matrix: 80m)
P -> R: 250m (matrix: 250m)
R -> S: 60m (matrix: 60m)
S -> Q: 200m (matrix: 200m)
Q -> P exists? matrix says False
```

`WeightedDigraphMatrix`'s constructor fills every cell with `NoEdge` up front, an O(V<sup>2</sup>) pass the unweighted `bool[,]` above didn't need, because `false` was already the right "no edge" default. `Q -> P` was never added, and both structures agree it doesn't exist — the last line would print `True` if `AddEdge` had accidentally written both directions, which is exactly the bug the exercise below asks you to find. `WeightedDigraphList.AddEdge` only appends to `adj[from]`, which is also the definition of outdegree: Sedgewick and Wayne state it directly — "the outdegree of a vertex is the number of edges pointing from it" ([Sedgewick & Wayne, "Directed Graphs"](https://algs4.cs.princeton.edu/42digraph/)) — so `adj[from].Count` *is* that vertex's outdegree, with no separate bookkeeping.

::::exercise[Find the bug in a one-way matrix]
This class is meant to model strictly one-way relationships (a "reports to" chain, say), but a caller who adds `AddEdge(manager, report)` finds that `HasEdge(report, manager)` also comes back `true`. Find the bug.

```csharp run id=buggy-digraph
var buggy = new BuggyDigraphMatrix(2);
buggy.AddEdge(0, 1); // AddEdge(manager, report)
_ = buggy.HasEdge(1, 0); // should this be true or false?

sealed class BuggyDigraphMatrix(int vertexCount)
{
    private readonly bool[,] edge = new bool[vertexCount, vertexCount];

    public void AddEdge(int from, int to)
    {
        edge[from, to] = true;
        edge[to, from] = true;
    }

    public bool HasEdge(int from, int to) => edge[from, to];
}
```

:::solution
`AddEdge` writes both `edge[from, to]` and `edge[to, from]`, which is the undirected `AddEdge` from the first section of this article, not a directed one. Every edge this class adds becomes bidirectional whether the caller wanted that or not — it can't build a graph with a one-way edge at all. The fix is to drop the second line and write only `edge[from, to] = true;`, exactly like `WeightedDigraphMatrix.AddEdge` above (minus the weight).

```csharp run
string[] names = ["Parent", "Child"];

var buggy = new BuggyDigraphMatrix(names.Length);
buggy.AddEdge(0, 1);
Console.WriteLine($"buggy: Child -> Parent exists? {buggy.HasEdge(1, 0)}");

var fixedGraph = new FixedDigraphMatrix(names.Length);
fixedGraph.AddEdge(0, 1);
Console.WriteLine($"fixed: Child -> Parent exists? {fixedGraph.HasEdge(1, 0)}");

sealed class BuggyDigraphMatrix(int vertexCount)
{
    private readonly bool[,] edge = new bool[vertexCount, vertexCount];

    public void AddEdge(int from, int to)
    {
        edge[from, to] = true;
        edge[to, from] = true;
    }

    public bool HasEdge(int from, int to) => edge[from, to];
}

sealed class FixedDigraphMatrix(int vertexCount)
{
    private readonly bool[,] edge = new bool[vertexCount, vertexCount];

    public void AddEdge(int from, int to) => edge[from, to] = true;

    public bool HasEdge(int from, int to) => edge[from, to];
}
```

```text output
buggy: Child -> Parent exists? True
fixed: Child -> Parent exists? False
```
:::
::::

## Measuring memory instead of counting Big-O terms

The Big-O table above says a matrix costs O(V<sup>2</sup>) and a list costs O(V + E) — but Big-O drops the constant factors, and it's exactly those constants that decide which representation actually uses less memory at a given size. [`GC.GetAllocatedBytesForCurrentThread`](https://learn.microsoft.com/en-us/dotnet/api/system.gc.getallocatedbytesforcurrentthread) reports the running total of bytes allocated on the calling thread, so the difference across a block of code is that code's real allocation, independent of when the garbage collector happens to run. The numbers below were measured on .NET 10.0.12, Windows 11, x64, on a desktop Core i7-11700K.

The program below builds the same 1,000-vertex graph as both a `List<int>[]` adjacency list and a `bool[,]` adjacency matrix, at six edge counts from sparse to nearly a fifth of every possible pair, and measures the bytes each construction allocates:

```csharp run id=memory-measurement
using System.Globalization;
CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;

const int V = 1000;
int[] edgeCounts = [1000, 4000, 20000, 30000, 100000, 400000];

// Warm-up pass: run the whole measurement once so JIT tiering happens
// here, not during the numbers that get printed below.
foreach (int e in edgeCounts) Measure(V, e);

Console.WriteLine($"V = {V:N0}, max possible edges = {V * (V - 1) / 2:N0}");
Console.WriteLine("      E   list MiB  matrix MiB");
foreach (int e in edgeCounts)
{
    var (listBytes, matrixBytes) = Measure(V, e);
    double listMiB = listBytes / (1024.0 * 1024.0);
    double matrixMiB = matrixBytes / (1024.0 * 1024.0);
    Console.WriteLine($"{e,7:N0}  {listMiB,9:F2}  {matrixMiB,10:F2}");
}

static (long ListBytes, long MatrixBytes) Measure(int v, int e)
{
    var edges = GenerateEdges(v, e, seed: 1);

    long beforeMatrix = GC.GetAllocatedBytesForCurrentThread();
    var matrix = new bool[v, v];
    foreach (var (a, b) in edges) { matrix[a, b] = true; matrix[b, a] = true; }
    long afterMatrix = GC.GetAllocatedBytesForCurrentThread();

    long beforeList = GC.GetAllocatedBytesForCurrentThread();
    var adj = new List<int>[v];
    for (int i = 0; i < v; i++) adj[i] = [];
    foreach (var (a, b) in edges) { adj[a].Add(b); adj[b].Add(a); }
    long afterList = GC.GetAllocatedBytesForCurrentThread();

    GC.KeepAlive(matrix);
    GC.KeepAlive(adj);
    return (afterList - beforeList, afterMatrix - beforeMatrix);
}

static (int, int)[] GenerateEdges(int v, int e, int seed)
{
    var rnd = new Random(seed);
    var seen = new HashSet<(int, int)>();
    var edges = new List<(int, int)>(e);
    while (edges.Count < e)
    {
        int a = rnd.Next(v);
        int b = rnd.Next(v);
        if (a == b) continue;
        var key = a < b ? (a, b) : (b, a);
        if (seen.Add(key)) edges.Add(key);
    }
    return edges.ToArray();
}
```

```text output
V = 1,000, max possible edges = 499,500
      E   list MiB  matrix MiB
  1,000       0.07        0.95
  4,000       0.16        0.95
 20,000       0.59        0.95
 30,000       0.77        0.95
100,000       2.14        0.95
400,000       8.04        0.95
```

The matrix's 0.95 MiB never changes, because `new bool[1000, 1000]` allocates its million cells in one block regardless of how many edges get set afterward — that allocation happens before the loop even starts. The list starts far cheaper (0.07 MiB at 1,000 edges, fourteen times smaller than the matrix) and grows with every edge added, crossing the matrix's fixed cost somewhere between 30,000 and 100,000 edges — between 6% and 20% of all 499,500 possible pairs at this vertex count. Past that point, the "sparse" and "dense" labels stop being vague: a graph denser than roughly one edge in five or six actually measures larger as a list than as a matrix on this runtime, exactly the reverse of the usual advice to default to adjacency lists. Two documented facts explain where the list's bytes go: [`List<T>` stores its elements "using an array whose size is dynamically increased as required"](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.list-1), so every one of the 1,000 per-vertex lists carries spare capacity from its last doubling, not just the exact count of neighbors it holds; and each of those 1,000 `List<int>` objects is itself a small heap object with its own header, on top of the backing array it owns. Neither cost appears in "O(V + E)" — both are the constant factor Big-O is allowed to hide, and both scale with the number of vertices, not just the number of edges.

:::pitfall
"Adjacency lists are always more memory-efficient than a matrix" is only true below that crossover. A graph that is genuinely dense — a fully connected dependency graph, a social network's mutual-friends within a tight cluster, an all-pairs distance table — can lose to the matrix on memory as well as losing the usual argument for choosing a list in the first place, which is that scanning a sparse row beats scanning a mostly-empty one.
:::

## When there's no graph to store: implicit graphs

Not every graph needs a matrix, a list, or an edge list at all. A grid — a maze, a game board, an image treated as a lattice of pixels — is a graph where every vertex is a `(row, column)` pair and every edge is "one step up, down, left or right," a rule fixed in advance rather than looked up. Computing a cell's neighbors from that rule, instead of storing them, is an **implicit graph**: the vertex and edge sets exist, but nothing beyond the grid itself is allocated to hold them.

```csharp run id=implicit-grid
string[] floor =
[
    "......",
    ".##.#.",
    "...#..",
    ".#....",
    "......",
];

int rows = floor.Length, cols = floor[0].Length;
for (int r = 0; r < rows; r++)
{
    var line = new char[cols];
    for (int c = 0; c < cols; c++)
        line[c] = floor[r][c] == '#'
            ? '#'
            : (char)('0' + Neighbors(floor, r, c).Count());
    Console.WriteLine(new string(line));
}

static IEnumerable<(int R, int C)> Neighbors(string[] grid, int r, int c)
{
    (int dr, int dc)[] moves = [(-1, 0), (1, 0), (0, -1), (0, 1)];
    foreach (var (dr, dc) in moves)
    {
        int nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= grid.Length) continue;
        if (nc < 0 || nc >= grid[0].Length) continue;
        if (grid[nr][nc] == '#') continue;
        yield return (nr, nc);
    }
}
```

```text output
222322
2##1#2
322#23
2#3343
223332
```

Every digit above is a vertex's degree, and `Neighbors` recomputed every one of them from the six strings that were already sitting in memory to describe the floor — the same six strings a person would read to see the maze at all. There is no adjacency list or matrix anywhere in this program. Storing this floor plan explicitly instead — as an adjacency list, say, with one entry per open cell and roughly one list entry per open edge — would cost roughly what the measurement above charges per vertex and per edge, for a grid whose vertex and edge count grow with its area; the implicit version's extra cost stays at zero no matter how large the grid gets, because `Neighbors` allocates nothing that outlives the call. The trade is the one thing implicit graphs can't do cheaply: answering "list every edge in the whole graph" still means visiting every cell and calling `Neighbors` on it, so an algorithm that needs the full edge set repeatedly may still be better off materializing it once.

## Choosing a representation

- **Vertex IDs are small, dense integers and the graph is a grid, a fixed board, or another rule-defined neighbor set.** Don't store an adjacency structure at all — compute neighbors on demand, as `Neighbors` does above.
- **The hot operation is "does this specific edge exist," and the graph is dense** (above roughly a fifth of all possible pairs, per the measurement above) or you need to answer that question in guaranteed O(1) regardless of density. Use an adjacency matrix.
- **The hot operation is "give me every neighbor of this vertex," and the graph is sparse** — which covers most real graphs: a dependency graph, a road network, a social graph, a call graph. Use an adjacency list, keyed by array index if vertex IDs are small contiguous integers, or by `Dictionary<TKey, List<TValue>>` if they're not (accepting the hashing cost the note above describes).
- **The algorithm processes the whole edge set at once, in an order that ignores which vertex each edge starts from** — Kruskal's minimum spanning tree, sorting edges by weight, or just counting edges. Use an edge list; it's the smallest of the three and the only one with no per-vertex structure to build first.
- **Vertices or edges need to be added and removed by the thousands after the graph is built.** An adjacency list's `List<T>` rows resize independently and cheaply; a `bool[,]` matrix has no way to grow by one row and column without reallocating the whole block, which is the O(V<sup>2</sup>) "add a vertex" cost in the table above.

::::exercise[Predict the next crossover]
The measurement above used V = 1,000, where the matrix's fixed cost was about 0.95 MiB. Without running anything, reason about V = 4,000 instead: the matrix stores `V^2` cells, so its cost should scale roughly by `4^2 = 16`, to around 15 MiB. The list's per-edge cost shouldn't depend on `V` at all — only on `E` and on the per-vertex overhead of `V` separate `List<int>` objects, which is small next to a large `E`. Given that, does the *edge density* at which list overtakes matrix (the percentage, not the raw edge count) go up, go down, or stay about the same as `V` grows from 1,000 to 4,000?

:::solution
It stays about the same. The matrix's cost is O(V<sup>2</sup>), so quadrupling `V` multiplies its fixed cost by roughly 16. The list's cost per edge stays the same no matter how many vertices there are — adding an edge always costs one more `int` in each of two `List<int>`s, plus occasional doubling slack — so the crossover *edge count* also grows by roughly 16x, from somewhere between 30,000 and 100,000 up to somewhere between 480,000 and 1,600,000. But the *maximum possible* edge count grows by `4^2 = 16` too (`V(V-1)/2` is quadratic in `V`), so the crossover as a **fraction of all possible pairs** stays roughly where it was — the 6%-to-20% range from the V = 1,000 measurement is a reasonable estimate at V = 4,000 as well, not a number tied to that one vertex count. What does shift with scale is the matrix's absolute cost: at large enough `V`, `V^2` bytes stops being a "just allocate it" number, which is a separate reason many production graphs default to adjacency lists even inside that crossover band — the fixed 15+ MiB has to be paid up front, in one contiguous block, before a single edge is added.
:::
::::
