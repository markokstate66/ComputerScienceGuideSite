---
title: "BFS and DFS: Two Ways to Walk a Graph"
description: "Run breadth-first and depth-first search on one graph, swap a queue for a stack, then use DFS for cycle detection, topological sort, and components."
pillar: algorithms
order: 4
author: markus
published: 2026-09-22
updated: 2026-09-22
level: intermediate
tags: [graphs, breadth-first-search, depth-first-search, traversal, big-o]
prerequisites: ["algorithms/binary-search"]
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
  - title: "Queue<T> Class"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.queue-1"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Stack<T> Class"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.stack-1"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Queue<T>.Enqueue(T) Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.queue-1.enqueue"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Queue<T>.Dequeue Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.queue-1.dequeue"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Stack<T>.Push(T) Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.stack-1.push"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Stack<T>.Pop Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.stack-1.pop"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
draft: true
---

Here is a small [graph](/glossary/#graph) of application startup modules. An edge `A -> B` means "A must finish initializing before B can start."

```csharp run id=traverse
Dictionary<string, List<string>> modules = new()
{
    ["Config"] =
        ["Database", "Logging", "Cache", "Service"],
    ["Database"] = ["Repository"],
    ["Logging"] = ["Repository", "Client"],
    ["Cache"] = ["Service"],
    ["Repository"] = ["Service"],
    ["Service"] = ["Api"],
    ["Api"] = ["Client"],
    ["Client"] = [],
};

Console.WriteLine(
    "BFS: " + string.Join(" ", Bfs(modules, "Config")));
Console.WriteLine(
    "DFS: " + string.Join(" ", Dfs(modules, "Config")));

static List<string> Bfs(
    Dictionary<string, List<string>> g, string start)
{
    var order = new List<string>();
    var seen = new HashSet<string> { start };
    var frontier = new Queue<string>();
    frontier.Enqueue(start);
    while (frontier.Count > 0)
    {
        string node = frontier.Dequeue();
        order.Add(node);
        foreach (string next in g[node])
            if (seen.Add(next))
                frontier.Enqueue(next);
    }
    return order;
}

static List<string> Dfs(
    Dictionary<string, List<string>> g, string start)
{
    var order = new List<string>();
    var seen = new HashSet<string>();
    Visit(start);
    return order;

    void Visit(string node)
    {
        if (!seen.Add(node)) return;
        order.Add(node);
        foreach (string next in g[node])
            Visit(next);
    }
}
```

```text output
BFS: Config Database Logging Cache Service Repository Client Api
DFS: Config Database Repository Service Api Client Logging Cache
```

Same graph, same starting point, same set of eight modules visited — and a different order every time, because the two functions disagree about which unvisited neighbor to look at next. `Bfs` keeps a [`Queue<T>`](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.queue-1): first in, first out, so it finishes every module exactly one step away from `Config` before looking at anything two steps away. `Dfs` recurses, which means it uses the runtime's [call stack](/glossary/#call-stack): last in, first out, so it follows `Database` all the way to `Client` before backtracking to try `Logging`. Breadth-first search (BFS) and depth-first search (DFS) visit the same reachable set from the same graph; only the shape of the walk differs, and that shape is decided entirely by one data structure. Sedgewick and Wayne's *Algorithms* puts a number on both: each one runs in time proportional to *V* + *E* — the vertex count plus the edge count — because a correct implementation looks at every vertex once and follows every edge once ([Sedgewick & Wayne, "Undirected Graphs"](https://algs4.cs.princeton.edu/41graph/)).

Figure 1 draws the BFS run as it actually happened: everything reachable in one step from `Config`, then everything newly reachable in two.

<figure class="diagram">
<svg viewBox="0 0 360 150" role="img" aria-labelledby="bfs-levels-title bfs-levels-desc">
<title id="bfs-levels-title">BFS expanding outward from Config in two levels</title>
<desc id="bfs-levels-desc">Config sits alone at level 0. Four modules discovered directly from Config form level 1: Database, Logging, Cache, Service. Three more modules discovered from those form level 2: Repository, Client, Api, each reached from a specific level-1 parent.</desc>
<text x="8" y="10" class="d-small d-muted">level 0</text>
<rect x="132" y="16" width="96" height="28" rx="6" class="d-box-accent"/>
<text x="180" y="35" text-anchor="middle" class="d-mono d-small d-bold">Config</text>
<path d="M180 44 L48 64" class="d-line" marker-end="url(#bfs-arrow)"/>
<path d="M180 44 L136 64" class="d-line" marker-end="url(#bfs-arrow)"/>
<path d="M180 44 L224 64" class="d-line" marker-end="url(#bfs-arrow)"/>
<path d="M180 44 L312 64" class="d-line" marker-end="url(#bfs-arrow)"/>
<text x="8" y="58" class="d-small d-muted">level 1</text>
<rect x="8" y="64" width="80" height="28" rx="6" class="d-box"/>
<text x="48" y="83" text-anchor="middle" class="d-mono d-small">Database</text>
<rect x="96" y="64" width="80" height="28" rx="6" class="d-box"/>
<text x="136" y="83" text-anchor="middle" class="d-mono d-small">Logging</text>
<rect x="184" y="64" width="80" height="28" rx="6" class="d-box"/>
<text x="224" y="83" text-anchor="middle" class="d-mono d-small">Cache</text>
<rect x="272" y="64" width="80" height="28" rx="6" class="d-box"/>
<text x="312" y="83" text-anchor="middle" class="d-mono d-small">Service</text>
<path d="M48 92 L60 112" class="d-line" marker-end="url(#bfs-arrow)"/>
<path d="M136 92 L180 112" class="d-line" marker-end="url(#bfs-arrow)"/>
<path d="M312 92 L300 112" class="d-line" marker-end="url(#bfs-arrow)"/>
<text x="8" y="106" class="d-small d-muted">level 2</text>
<rect x="5" y="112" width="110" height="28" rx="6" class="d-box"/>
<text x="60" y="131" text-anchor="middle" class="d-mono d-small">Repository</text>
<rect x="125" y="112" width="110" height="28" rx="6" class="d-box"/>
<text x="180" y="131" text-anchor="middle" class="d-mono d-small">Client</text>
<rect x="245" y="112" width="110" height="28" rx="6" class="d-box"/>
<text x="300" y="131" text-anchor="middle" class="d-mono d-small">Api</text>
<defs>
<marker id="bfs-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-stroke"/></marker>
</defs>
</svg>
<figcaption>Figure 1. The queue never holds a level-2 module until every level-1 module has been dequeued, so BFS finishes a whole ring before starting the next one. <code>Cache</code> has no level-2 child here: its only neighbor, <code>Service</code>, was already claimed by <code>Config</code> at level 1.</figcaption>
</figure>

## The one-line swap: `Queue<T>` for a `Stack<T>`

`Bfs` and `Dfs` above don't look alike, because one recurses and the other loops. Write DFS iteratively instead, and the two functions become the same function with one type changed:

```csharp run id=skeleton
Dictionary<string, List<string>> modules = new()
{
    ["Config"] =
        ["Database", "Logging", "Cache", "Service"],
    ["Database"] = ["Repository"],
    ["Logging"] = ["Repository", "Client"],
    ["Cache"] = ["Service"],
    ["Repository"] = ["Service"],
    ["Service"] = ["Api"],
    ["Api"] = ["Client"],
    ["Client"] = [],
};

Console.WriteLine(
    "BFS: " + string.Join(" ", Bfs(modules, "Config")));
Console.WriteLine(
    "DFS: " + string.Join(" ", DfsIterative(modules, "Config")));

static List<string> Bfs(
    Dictionary<string, List<string>> g, string start)
{
    var order = new List<string>();
    var seen = new HashSet<string>();
    var frontier = new Queue<string>();
    frontier.Enqueue(start);
    while (frontier.Count > 0)
    {
        string node = frontier.Dequeue();
        if (!seen.Add(node)) continue;
        order.Add(node);
        foreach (string next in g[node])
            frontier.Enqueue(next);
    }
    return order;
}

static List<string> DfsIterative(
    Dictionary<string, List<string>> g, string start)
{
    var order = new List<string>();
    var seen = new HashSet<string>();
    var frontier = new Stack<string>();
    frontier.Push(start);
    while (frontier.Count > 0)
    {
        string node = frontier.Pop();
        if (!seen.Add(node)) continue;
        order.Add(node);
        foreach (string next in g[node])
            frontier.Push(next);
    }
    return order;
}
```

```text output
BFS: Config Database Logging Cache Service Repository Client Api
DFS: Config Service Api Client Cache Logging Repository Database
```

Every line of `Bfs` and `DfsIterative` matches except the field type, `Enqueue`/`Dequeue` against `Push`/`Pop`, and the variable name. That is the entire structural difference between the two searches: a first-in-first-out frontier gives you rings expanding outward, a last-in-first-out frontier gives you a single thread pulled as far as it goes before backtracking. It is also why every textbook description of DFS as "BFS with a stack" is simultaneously true and a little bit of a trap, which the [pitfalls section](#why-the-iterative-version-gets-it-wrong) below works through: this `DfsIterative` visits the *same eight modules* as the recursive `Dfs` from the first program, but not in the same order (`Config Service Api Client Cache Logging Repository Database`, against `Config Database Repository Service Api Client Logging Cache`). Marking a node "seen" the moment it is popped, rather than the moment it is enqueued, matters too: `Bfs` here marks on dequeue and still produces the identical level order as the enqueue-marking version above, because a queue only ever holds *first arrivals* ahead of any duplicate.

:::dotnet
[`Queue<T>` is documented as a circular array](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.queue-1): a fixed backing array with a head and tail index that wrap around, growing by reallocation when full. [`Stack<T>` is an array too](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.stack-1), used from one end. The operations a graph search calls in a loop split the same way on both types: [`Enqueue`](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.queue-1.enqueue) and [`Push`](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.stack-1.push) are each documented `O(1)`, except on the one call that forces a reallocation, which both document as `O(n)`; [`Dequeue`](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.queue-1.dequeue) and [`Pop`](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.stack-1.pop) are documented plain `O(1)`, with no such exception, because removing an element never grows the array. Neither type is a linked structure; "queue" and "stack" here are interfaces the algorithm relies on, not particular memory layouts.
:::

::::exercise[Predict a different walk]
`Config`'s adjacency list above is `[Database, Logging, Cache, Service]`. Suppose a teammate reorders it to `[Service, Cache, Logging, Database]` without touching any other list. Predict the new BFS and DFS visit orders from `Config` before running anything.

:::solution
```csharp run
Dictionary<string, List<string>> modules = new()
{
    ["Config"] =
        ["Service", "Cache", "Logging", "Database"],
    ["Database"] = ["Repository"],
    ["Logging"] = ["Repository", "Client"],
    ["Cache"] = ["Service"],
    ["Repository"] = ["Service"],
    ["Service"] = ["Api"],
    ["Api"] = ["Client"],
    ["Client"] = [],
};

Console.WriteLine(
    "BFS: " + string.Join(" ", Bfs(modules, "Config")));
Console.WriteLine(
    "DFS: " + string.Join(" ", Dfs(modules, "Config")));

static List<string> Bfs(
    Dictionary<string, List<string>> g, string start)
{
    var order = new List<string>();
    var seen = new HashSet<string> { start };
    var frontier = new Queue<string>();
    frontier.Enqueue(start);
    while (frontier.Count > 0)
    {
        string node = frontier.Dequeue();
        order.Add(node);
        foreach (string next in g[node])
            if (seen.Add(next))
                frontier.Enqueue(next);
    }
    return order;
}

static List<string> Dfs(
    Dictionary<string, List<string>> g, string start)
{
    var order = new List<string>();
    var seen = new HashSet<string>();
    Visit(start);
    return order;
    void Visit(string node)
    {
        if (!seen.Add(node)) return;
        order.Add(node);
        foreach (string next in g[node]) Visit(next);
    }
}
```

```text output
BFS: Config Service Cache Logging Database Api Repository Client
DFS: Config Service Api Client Cache Logging Repository Database
```

Both orders change completely, because both algorithms process a node's neighbors in whatever order the adjacency list gives them. BFS still finishes level 1 (`Service, Cache, Logging, Database`, all one step from `Config`) before touching level 2, just in the new list order; DFS still dives all the way down the first branch (`Service -> Api -> Client`) before backtracking. The *traversal order* depends on the adjacency list, but the *level* a node ends up on for BFS, and *which* edges DFS classifies as tree edges, do not — those are properties of the graph.
:::
::::

## Shortest path exists; DFS just doesn't find it

BFS's level-by-level expansion has a consequence beyond visit order: the first time BFS reaches a node, it has reached it by the fewest possible edges, because every node one step closer to the start is dequeued (and its neighbors enqueued) before any node one step further away. Sedgewick and Wayne state this directly: BFS "computes a shortest path from *s* to *v*" in an unweighted graph ([Sedgewick & Wayne, "Undirected Graphs"](https://algs4.cs.princeton.edu/41graph/)). DFS has no such guarantee — it commits to the first unexplored neighbor and only backs out when it runs out of options, so the first path it finds to any node can be far from the shortest one.

```csharp run
string[] room =
[
    "########",
    "#S.....#",
    "#......#",
    "#......#",
    "#......#",
    "########",
];

(int R, int C) start = (1, 1), end = (1, 2);
Console.WriteLine(
    $"BFS: {BfsSteps(room, start, end)} steps (shortest)");
Console.WriteLine(
    $"DFS: {DfsSteps(room, start, end)} steps");

static int BfsSteps(
    string[] g, (int R, int C) start, (int R, int C) end)
{
    int rows = g.Length, cols = g[0].Length;
    var dist = new int[rows, cols];
    for (int r = 0; r < rows; r++)
    for (int c = 0; c < cols; c++)
        dist[r, c] = -1;
    var frontier = new Queue<(int, int)>();
    dist[start.R, start.C] = 0;
    frontier.Enqueue(start);
    (int dr, int dc)[] moves =
        [(-1, 0), (1, 0), (0, -1), (0, 1)];
    while (frontier.Count > 0)
    {
        var (r, c) = frontier.Dequeue();
        foreach (var (dr, dc) in moves)
        {
            int nr = r + dr, nc = c + dc;
            if (g[nr][nc] == '#' || dist[nr, nc] != -1)
                continue;
            dist[nr, nc] = dist[r, c] + 1;
            frontier.Enqueue((nr, nc));
        }
    }
    return dist[end.R, end.C];
}

static int DfsSteps(
    string[] g, (int R, int C) start, (int R, int C) end)
{
    int rows = g.Length, cols = g[0].Length;
    var visited = new bool[rows, cols];
    (int dr, int dc)[] moves =
        [(1, 0), (0, -1), (-1, 0), (0, 1)];
    int result = -1;
    Visit(start.R, start.C, 0);
    return result;

    void Visit(int r, int c, int steps)
    {
        if (result != -1) return;
        visited[r, c] = true;
        if ((r, c) == end) { result = steps; return; }
        foreach (var (dr, dc) in moves)
        {
            int nr = r + dr, nc = c + dc;
            if (g[nr][nc] == '#' || visited[nr, nc])
                continue;
            Visit(nr, nc, steps + 1);
        }
    }
}
```

```text output
BFS: 1 steps (shortest)
DFS: 7 steps
```

`S` and `E` are next to each other, but `DfsSteps` tries "down" before "right" at every cell, so it walks the entire perimeter of the empty room before it happens to arrive next to `E` from the far side. That is not a contrived worst case for a strange grid: it is what DFS does whenever the neighbor order does not happen to point toward the goal, and a room with no walls at all gives it maximum room to wander.

A maze with actual walls makes the same point with a real route to reconstruct. Each cell records which cell discovered it, so the shortest path can be read backward from the target once BFS finishes:

```csharp run
string[] maze =
[
    "########",
    "#S..#..#",
    "#.#.#.##",
    "#.#...##",
    "#.####.#",
    "#......#",
    "#.####E#",
    "########",
];

int rows = maze.Length, cols = maze[0].Length;
(int R, int C) start = default, end = default;
for (int r = 0; r < rows; r++)
for (int c = 0; c < cols; c++)
{
    if (maze[r][c] == 'S') start = (r, c);
    if (maze[r][c] == 'E') end = (r, c);
}

var dist = new int[rows, cols];
var prev = new (int R, int C)?[rows, cols];
for (int r = 0; r < rows; r++)
for (int c = 0; c < cols; c++)
    dist[r, c] = -1;

var frontier = new Queue<(int R, int C)>();
dist[start.R, start.C] = 0;
frontier.Enqueue(start);
(int dr, int dc)[] moves =
    [(-1, 0), (1, 0), (0, -1), (0, 1)];

while (frontier.Count > 0)
{
    var (r, c) = frontier.Dequeue();
    foreach (var (dr, dc) in moves)
    {
        int nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= rows) continue;
        if (nc < 0 || nc >= cols) continue;
        if (maze[nr][nc] == '#') continue;
        if (dist[nr, nc] != -1) continue;
        dist[nr, nc] = dist[r, c] + 1;
        prev[nr, nc] = (r, c);
        frontier.Enqueue((nr, nc));
    }
}

Console.WriteLine($"shortest path: {dist[end.R, end.C]} steps");

var path = new HashSet<(int, int)>();
var at = ((int R, int C)?)end;
while (at is { } p)
{
    path.Add(p);
    at = prev[p.R, p.C];
}

var chars = maze.Select(row => row.ToCharArray()).ToArray();
foreach (var (r, c) in path)
    if (chars[r][c] == '.')
        chars[r][c] = '*';
foreach (var row in chars)
    Console.WriteLine(new string(row));
```

```text output
shortest path: 10 steps
########
#S..#..#
#*#.#.##
#*#...##
#*####.#
#******#
#.####E#
########
```

`prev[nr, nc]` is set exactly once, the first time BFS reaches that cell, and since that first arrival is always by the shortest route, walking `prev` backward from `E` to `S` reconstructs a shortest path without ever computing distances to cells the path doesn't use.

::::exercise[Find the farthest cell instead of a fixed target]
Adapt the maze `BfsSteps`/`prev` loop above to find the cell *farthest* from `S` by walking distance, without knowing its coordinates in advance, and report both the cell and its distance.

:::solution
Run the same BFS to completion — it already computes `dist` for every reachable cell — and track the maximum as you go instead of stopping at a fixed target:

```csharp run
string[] maze =
[
    "########",
    "#S..#..#",
    "#.#.#.##",
    "#.#...##",
    "#.####.#",
    "#......#",
    "#.####E#",
    "########",
];

int rows = maze.Length, cols = maze[0].Length;
(int R, int C) start = default;
for (int r = 0; r < rows; r++)
for (int c = 0; c < cols; c++)
    if (maze[r][c] == 'S') start = (r, c);

var dist = new int[rows, cols];
for (int r = 0; r < rows; r++)
for (int c = 0; c < cols; c++)
    dist[r, c] = -1;

var frontier = new Queue<(int R, int C)>();
dist[start.R, start.C] = 0;
frontier.Enqueue(start);
(int dr, int dc)[] moves =
    [(-1, 0), (1, 0), (0, -1), (0, 1)];
(int R, int C) farthest = start;

while (frontier.Count > 0)
{
    var (r, c) = frontier.Dequeue();
    if (dist[r, c] > dist[farthest.R, farthest.C])
        farthest = (r, c);
    foreach (var (dr, dc) in moves)
    {
        int nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= rows) continue;
        if (nc < 0 || nc >= cols) continue;
        if (maze[nr][nc] == '#') continue;
        if (dist[nr, nc] != -1) continue;
        dist[nr, nc] = dist[r, c] + 1;
        frontier.Enqueue((nr, nc));
    }
}

Console.WriteLine(
    $"farthest cell: ({farthest.R},{farthest.C}), " +
    $"{dist[farthest.R, farthest.C]} steps away");
```

```text output
farthest cell: (4,6), 10 steps away
```

That cell is 10 steps out, the same distance as `E` — this maze happens to have more than one cell tied for farthest, and BFS reports whichever one it dequeues first among the tie. A "farthest cell" query has no single right answer unless the maze is checked for ties.
:::
::::

## What depth-first search is actually for

DFS's dive-first order looks like a disadvantage after that section, but it is exactly the property that makes it good at questions BFS cannot answer as directly: does this graph loop back on itself, is there a valid order to process every node, and which nodes can even reach each other. All three come from watching *when* DFS revisits an already-seen node, not just *that* it does.

### A cycle in an undirected graph is not "any repeated node"

Here are two small floor plans, as sets of doors between rooms. In `rooms`, `Hall`, `Kitchen` and `LivingRoom` form a loop; `Pantry` hangs off `Kitchen` with no way back except the door it came through. In `hallway`, there is no loop at all — `Hall`, `Closet` and `Attic` form a single unbranching corridor.

```csharp run
Dictionary<string, List<string>> rooms = new()
{
    ["Hall"] = ["Kitchen", "LivingRoom"],
    ["Kitchen"] = ["Hall", "LivingRoom", "Pantry"],
    ["LivingRoom"] = ["Hall", "Kitchen"],
    ["Pantry"] = ["Kitchen"],
};

Dictionary<string, List<string>> hallway = new()
{
    ["Hall"] = ["Closet"],
    ["Closet"] = ["Hall", "Attic"],
    ["Attic"] = ["Closet"],
};

Console.WriteLine($"rooms,   naive:   {HasCycleNaive(rooms)}");
Console.WriteLine($"rooms,   correct: {HasCycleCorrect(rooms)}");
Console.WriteLine($"hallway, naive:   {HasCycleNaive(hallway)}");
Console.WriteLine($"hallway, correct: {HasCycleCorrect(hallway)}");

// Bug: every already-seen neighbor counts as a cycle, including
// the door you just walked through to get here.
static bool HasCycleNaive(Dictionary<string, List<string>> g)
{
    var seen = new HashSet<string>();
    foreach (string start in g.Keys)
        if (!seen.Contains(start) && Visit(start))
            return true;
    return false;

    bool Visit(string u)
    {
        seen.Add(u);
        foreach (string v in g[u])
        {
            if (seen.Contains(v)) return true;
            if (Visit(v)) return true;
        }
        return false;
    }
}

static bool HasCycleCorrect(Dictionary<string, List<string>> g)
{
    var seen = new HashSet<string>();
    foreach (string start in g.Keys)
        if (!seen.Contains(start) && Visit(start, null))
            return true;
    return false;

    bool Visit(string u, string? parent)
    {
        seen.Add(u);
        foreach (string v in g[u])
        {
            if (v == parent) continue; // the edge just arrived by
            if (seen.Contains(v)) return true;
            if (Visit(v, u)) return true;
        }
        return false;
    }
}
```

```text output
rooms,   naive:   True
rooms,   correct: True
hallway, naive:   True
hallway, correct: False
```

`hallway` is a straight corridor with no loop in it, and the naive check still reports one. An undirected edge is stored both ways — `Closet`'s list contains `Hall` and `Hall`'s list contains `Closet` — so the moment DFS recurses from `Hall` into `Closet`, `Closet` looks back at its own neighbor list and finds `Hall` already marked seen. That is not a cycle; it is the same door counted from both sides. `HasCycleCorrect` passes the parent along and skips exactly that one edge, so a real cycle only registers when DFS reaches an already-seen room through a *different* door than the one it arrived by, which is what happens at `LivingRoom` in `rooms`: it reaches back to `Hall`, and `Hall` is not `LivingRoom`'s parent.

:::pitfall
An undirected cycle check that doesn't exclude the parent edge reports a cycle on every graph with at least one edge, tree or not. This is not an edge case to test for later — it fires on the first edge the very first child examines.
:::

### A directed cycle needs "still on this call's path," not "seen before"

Directed edges only go one way, so there is no parent edge to accidentally re-cross — but a directed graph raises a sharper version of the same question. `modules` from the opening example has no cycle: every arrow points from something needed earlier to something needed later. Watch what happens when a cycle check tracks only "have I seen this module at all" instead of "is this module still an open call on my current path":

```csharp run
Dictionary<string, List<string>> modules = new()
{
    ["Config"] =
        ["Database", "Logging", "Cache", "Service"],
    ["Database"] = ["Repository"],
    ["Logging"] = ["Repository", "Client"],
    ["Cache"] = ["Service"],
    ["Repository"] = ["Service"],
    ["Service"] = ["Api"],
    ["Api"] = ["Client"],
    ["Client"] = [],
};

// A later change wires Service back into Config.
Dictionary<string, List<string>> broken = new(modules)
{
    ["Service"] = ["Api", "Config"],
};

Console.WriteLine($"modules, naive:   {HasCycleNaive(modules)}");
Console.WriteLine($"modules, correct: {HasCycleCorrect(modules)}");
Console.WriteLine($"broken,  naive:   {HasCycleNaive(broken)}");
Console.WriteLine($"broken,  correct: {HasCycleCorrect(broken)}");

// Bug: treats every already-visited node as a cycle, including
// a finished, unrelated branch reached through a second edge.
static bool HasCycleNaive(Dictionary<string, List<string>> g)
{
    var seen = new HashSet<string>();
    foreach (string start in g.Keys)
        if (!seen.Contains(start) && Visit(start))
            return true;
    return false;

    bool Visit(string u)
    {
        seen.Add(u);
        foreach (string v in g[u])
        {
            if (seen.Contains(v)) return true;
            if (Visit(v)) return true;
        }
        return false;
    }
}

// Correct: a cycle exists only when an edge reaches a node that
// is still an open call on this path (gray), not one that has
// already returned (black).
static bool HasCycleCorrect(Dictionary<string, List<string>> g)
{
    var onPath = new HashSet<string>();
    var done = new HashSet<string>();
    foreach (string start in g.Keys)
        if (!done.Contains(start) && Visit(start))
            return true;
    return false;

    bool Visit(string u)
    {
        onPath.Add(u);
        foreach (string v in g[u])
        {
            if (onPath.Contains(v)) return true;
            if (!done.Contains(v) && Visit(v)) return true;
        }
        onPath.Remove(u);
        done.Add(u);
        return false;
    }
}
```

```text output
modules, naive:   True
modules, correct: False
broken,  naive:   True
broken,  correct: True
```

The naive checker reports a cycle in `modules` — a graph that has none. `Logging` and `Cache` each have a second edge into a module DFS has already fully explored by another route (`Logging -> Repository`, `Cache -> Service`); the naive check cannot tell that from a genuine loop, because it only ever asks "have I marked this before," never "is this an ancestor of where I am now." A real cycle detector needs both sets: `onPath` for modules still open on the current call chain, `done` for modules whose entire subtree has already returned. Only a hit against `onPath` is a cycle; a hit against `done` means two different paths reach the same module, which is normal in a graph and not a defect.

This is exactly the theorem behind the check: a directed graph is acyclic if and only if a depth-first search of it never finds an edge to a node still open on the current path — a back edge, in the vocabulary the [edge-classification section](#why-the-iterative-version-gets-it-wrong) below uses. [Cormen, Leiserson, Rivest and Stein](https://mitpress.mit.edu/9780262046305/introduction-to-algorithms/) prove this in the chapter on elementary graph algorithms, and Sedgewick and Wayne's own cycle detector for digraphs is built on the same idea ([Sedgewick & Wayne, "Directed Graphs"](https://algs4.cs.princeton.edu/42digraph/)).

::::exercise[Find the second bug]
This directed cycle check uses the right idea — an `onPath` set of ancestors still open on the current call — but has one line missing. What does it report for the acyclic `modules` graph above, and why?

```csharp run id=missing-remove
Dictionary<string, List<string>> modules = new()
{
    ["Config"] =
        ["Database", "Logging", "Cache", "Service"],
    ["Database"] = ["Repository"],
    ["Logging"] = ["Repository", "Client"],
    ["Cache"] = ["Service"],
    ["Repository"] = ["Service"],
    ["Service"] = ["Api"],
    ["Api"] = ["Client"],
    ["Client"] = [],
};

Console.WriteLine(HasCycleBuggy(modules));

static bool HasCycleBuggy(Dictionary<string, List<string>> g)
{
    var onPath = new HashSet<string>();
    foreach (string start in g.Keys)
        if (!onPath.Contains(start) && Visit(start))
            return true;
    return false;

    bool Visit(string u)
    {
        onPath.Add(u);
        foreach (string v in g[u])
        {
            if (onPath.Contains(v)) return true;
            if (Visit(v)) return true;
        }
        return false;
    }
}
```

:::solution
It reports `True` on a graph with no cycle. `Visit` adds `u` to `onPath` on entry but never removes it on return, so `onPath` behaves like the naive checker's plain `seen` set: once a module has been visited at all, it stays "on the path" forever, even after DFS has completely finished it and backtracked. By the time `Cache` examines its edge to `Service`, `Service` is long finished — but still sitting in `onPath`, since nothing ever took it out — so the check misreports a back edge. The missing line is `onPath.Remove(u);` immediately before the final `return false;`, exactly where `HasCycleCorrect` moves `u` from `onPath` into `done`.

```text output
True
```
:::
::::

### Build order from finishing times: topological sort

A module's *finish time* — the moment DFS is done with it and every module it depends on — turns out to answer a third question: what order can these modules safely start in? Record each module the moment DFS finishes with it, then read that list backward.

```csharp run
Dictionary<string, List<string>> modules = new()
{
    ["Config"] =
        ["Database", "Logging", "Cache", "Service"],
    ["Database"] = ["Repository"],
    ["Logging"] = ["Repository", "Client"],
    ["Cache"] = ["Service"],
    ["Repository"] = ["Service"],
    ["Service"] = ["Api"],
    ["Api"] = ["Client"],
    ["Client"] = [],
};

List<string> order = TopoSort(modules);
Console.WriteLine(string.Join(" -> ", order));

var index = new Dictionary<string, int>();
for (int i = 0; i < order.Count; i++) index[order[i]] = i;
bool valid = modules.All(kv =>
    kv.Value.All(v => index[kv.Key] < index[v]));
Console.WriteLine($"valid start order: {valid}");

static List<string> TopoSort(Dictionary<string, List<string>> g)
{
    var seen = new HashSet<string>();
    var finishOrder = new List<string>();
    foreach (string start in g.Keys)
        if (!seen.Contains(start))
            Visit(start);
    finishOrder.Reverse();
    return finishOrder;

    void Visit(string u)
    {
        seen.Add(u);
        foreach (string v in g[u])
            if (!seen.Contains(v))
                Visit(v);
        finishOrder.Add(u);
    }
}
```

```text output
Config -> Cache -> Logging -> Database -> Repository -> Service -> Api -> Client
valid start order: True
```

A module can only finish after everything it points to has finished (`Visit` recurses into every neighbor before appending `u`), so reversing the finish order puts every dependency before its dependents. Spelled out, that start order is `Config`, `Cache`, `Logging`, `Database`, `Repository`, `Service`, `Api`, then `Client` — every module appears before anything that depends on it. Sedgewick and Wayne state this exactly: "reverse postorder in a DAG provides a topological order," computed in time proportional to *V* + *E* ([Sedgewick & Wayne, "Directed Graphs"](https://algs4.cs.princeton.edu/42digraph/)). It only works on a graph with no cycle — a DAG, directed acyclic graph — which is why `TopoSort` and `HasCycleCorrect` are two views of the same traversal: a topological order exists exactly when DFS finds no back edge to certify.

::::exercise[Prove the connection]
Using only the definitions above — a tree edge goes to an unvisited node, a back edge goes to a node still `onPath` (an ancestor on the current call) — explain why a graph with a valid topological order can never contain a back edge.

:::solution
Suppose edge `u -> v` is a back edge. By definition `v` is an ancestor of `u`: DFS reached `u` only by first calling `Visit(v)` and, from somewhere inside that still-open call, eventually calling `Visit(u)`. Since `Visit(v)` cannot finish (and so cannot be appended to the finish order) until every call it made — including the one that reached `u` — has returned, `u` finishes strictly before `v` does. Reversing finish order would then have to place `u` before `v`, satisfying the tree/cross/forward edges `u -> (something)` but contradicting the requirement for edge `u -> v` itself, which needs `u` before `v` in a topological order only if `u -> v` behaves like every other edge — an edge that must point from earlier to later. A back edge points from later (`u`, which finishes first) to earlier (`v`, which finishes last among the two), so no order can satisfy it. A graph with a valid topological order therefore has no back edge, which is the same fact `HasCycleCorrect` checks directly.
:::
::::

### Components in one pass

Nothing about DFS requires starting over from scratch between calls: looping over every vertex and only recursing into the ones no earlier call has reached partitions the whole graph into its connected pieces, directed reachability aside.

```csharp run
Dictionary<string, List<string>> floor = new()
{
    ["Hall"] = ["Kitchen", "LivingRoom"],
    ["Kitchen"] = ["Hall", "LivingRoom", "Pantry"],
    ["LivingRoom"] = ["Hall", "Kitchen"],
    ["Pantry"] = ["Kitchen"],
    ["Garage"] = ["Driveway"],
    ["Driveway"] = ["Garage"],
    ["Basement"] = [],
};

List<List<string>> parts = Components(floor);
foreach (List<string> part in parts)
    Console.WriteLine("{ " + string.Join(", ", part) + " }");
Console.WriteLine($"components: {parts.Count}");

static List<List<string>> Components(
    Dictionary<string, List<string>> g)
{
    var seen = new HashSet<string>();
    var parts = new List<List<string>>();
    foreach (string start in g.Keys)
    {
        if (seen.Contains(start)) continue;
        var part = new List<string>();
        Visit(start);
        parts.Add(part);

        void Visit(string u)
        {
            seen.Add(u);
            part.Add(u);
            foreach (string v in g[u])
                if (!seen.Contains(v))
                    Visit(v);
        }
    }
    return parts;
}
```

```text output
{ Hall, Kitchen, LivingRoom, Pantry }
{ Garage, Driveway }
{ Basement }
components: 3
```

`Components` is the connectivity check underneath every "is the whole graph reachable" question, including the ones earlier sections never had to ask because `modules` happened to be reachable from one node. `Basement`'s adjacency list is empty, and it still gets counted: a component can be a single unconnected vertex.

## Why the iterative version gets it wrong

The `DfsIterative` function from the [queue-vs-stack section](#the-one-line-swap-queuet-for-a-stackt) above visits every reachable node, but not in the recursive function's order, and Sedgewick and Wayne document exactly this: a stack-based, non-recursive DFS "explores the vertices adjacent to *v* in the reverse order of the standard recursive DFS," and its parent pointers "may be updated more than once, so it may not be suitable for backtracking applications" ([Sedgewick & Wayne, "Undirected Graphs"](https://algs4.cs.princeton.edu/41graph/)). Both symptoms are visible directly:

```csharp run
Dictionary<string, List<string>> modules = new()
{
    ["Config"] =
        ["Database", "Logging", "Cache", "Service"],
    ["Database"] = ["Repository"],
    ["Logging"] = ["Repository", "Client"],
    ["Cache"] = ["Service"],
    ["Repository"] = ["Service"],
    ["Service"] = ["Api"],
    ["Api"] = ["Client"],
    ["Client"] = [],
};

Console.WriteLine("recursive:   " +
    string.Join(" ", DfsRecursive(modules, "Config")));
Console.WriteLine("stack, push forward: " +
    string.Join(" ", DfsStackForward(modules, "Config")));
Console.WriteLine("stack, push reversed: " +
    string.Join(" ", DfsStackReversed(modules, "Config")));

static List<string> DfsRecursive(
    Dictionary<string, List<string>> g, string start)
{
    var order = new List<string>();
    var seen = new HashSet<string>();
    Visit(start);
    return order;
    void Visit(string node)
    {
        if (!seen.Add(node)) return;
        order.Add(node);
        foreach (string next in g[node]) Visit(next);
    }
}

// Pushes neighbors in adjacency-list order.
static List<string> DfsStackForward(
    Dictionary<string, List<string>> g, string start)
{
    var order = new List<string>();
    var seen = new HashSet<string>();
    var stack = new Stack<string>();
    stack.Push(start);
    while (stack.Count > 0)
    {
        string node = stack.Pop();
        if (!seen.Add(node)) continue;
        order.Add(node);
        foreach (string next in g[node]) stack.Push(next);
    }
    return order;
}

// Pushes neighbors in reverse, so the first one ends up on top.
static List<string> DfsStackReversed(
    Dictionary<string, List<string>> g, string start)
{
    var order = new List<string>();
    var seen = new HashSet<string>();
    var stack = new Stack<string>();
    stack.Push(start);
    while (stack.Count > 0)
    {
        string node = stack.Pop();
        if (!seen.Add(node)) continue;
        order.Add(node);
        for (int i = g[node].Count - 1; i >= 0; i--)
            stack.Push(g[node][i]);
    }
    return order;
}
```

```text output
recursive:   Config Database Repository Service Api Client Logging Cache
stack, push forward: Config Service Api Client Cache Logging Repository Database
stack, push reversed: Config Database Repository Service Api Client Logging Cache
```

Pushing `[Database, Logging, Cache, Service]` in list order puts `Service` — the *last* neighbor — on top, so it pops first: the stack tries the neighbors in the opposite order from recursion, which only ever calls into the *first* unvisited neighbor immediately. In full, `recursive` and `stack, push reversed` both visit `Config`, `Database`, `Repository`, `Service`, `Api`, `Client`, `Logging`, then `Cache`; `stack, push forward` visits `Config`, `Service`, `Api`, `Client`, `Cache`, `Logging`, `Repository`, then `Database` — reversing the push order before pushing fixes the mismatch and reproduces the recursive order exactly. Order is the easy half of the pitfall, though — the hard half is what a stack of plain nodes cannot recover at all.

### The naive stack can't tell a cycle from a coincidence

The `onPath`/`done` cycle check earlier needs to know, for each edge examined, whether the target is a currently-open ancestor, an already-finished node reached by a different route, or brand new. Recursion gets that for free: a call is "open" exactly as long as it is still on the call stack. A plain `Stack<string>` has no such state — a node is either in the `seen` set or it isn't — so the most natural translation of "already seen this neighbor" into a classification guesses wrong:

```csharp run
Dictionary<string, List<string>> modules = new()
{
    ["Config"] =
        ["Database", "Logging", "Cache", "Service"],
    ["Database"] = ["Repository"],
    ["Logging"] = ["Repository", "Client"],
    ["Cache"] = ["Service"],
    ["Repository"] = ["Service"],
    ["Service"] = ["Api"],
    ["Api"] = ["Client"],
    ["Client"] = [],
};

var seen = new HashSet<string>();
var stack = new Stack<string>();
stack.Push("Config");
while (stack.Count > 0)
{
    string node = stack.Pop();
    if (!seen.Add(node)) continue;
    for (int i = modules[node].Count - 1; i >= 0; i--)
    {
        string next = modules[node][i];
        string kind =
            seen.Contains(next) ? "back" : "tree";
        Console.WriteLine($"{kind,-4} {node} -> {next}");
        stack.Push(next);
    }
}
```

```text output
tree Config -> Service
tree Config -> Cache
tree Config -> Logging
tree Config -> Database
tree Database -> Repository
tree Repository -> Service
tree Service -> Api
tree Api -> Client
back Logging -> Client
back Logging -> Repository
back Cache -> Service
```

Three problems in eleven lines, on a graph with no cycle. `Config -> Service` gets called `tree` because `Service` is examined (and pushed) the moment `Config` is popped, long before it is actually discovered via `Repository`; `Repository -> Service` is *also* called `tree` a few lines later, so `Service` ends up with two "tree parents," which cannot happen in a real DFS tree. And `Logging -> Repository`, `Logging -> Client`, `Cache -> Service` are all called `back` — exactly the false positives from the [directed cycle section](#a-directed-cycle-needs-still-on-this-calls-path-not-seen-before) above, because "seen" is the only bit of state this version has, and a node that is seen-and-fully-explored looks identical to a node that is seen-and-still-open. A plain node stack cannot ask the question a correct classification needs.

The fix is to push exactly what the recursive call stack pushes: not just a node, but a frame that remembers where in that node's neighbor list it paused, so the frame can be resumed — and correctly marked finished — after each recursive step returns.

```csharp run
Dictionary<string, List<string>> modules = new()
{
    ["Config"] =
        ["Database", "Logging", "Cache", "Service"],
    ["Database"] = ["Repository"],
    ["Logging"] = ["Repository", "Client"],
    ["Cache"] = ["Service"],
    ["Repository"] = ["Service"],
    ["Service"] = ["Api"],
    ["Api"] = ["Client"],
    ["Client"] = [],
};

var onPath = new HashSet<string>();
var done = new HashSet<string>();
var stack = new Stack<(string Node, int Next)>();
stack.Push(("Config", 0));
onPath.Add("Config");

while (stack.Count > 0)
{
    var (node, next) = stack.Pop();
    List<string> adj = modules[node];
    if (next == adj.Count)
    {
        onPath.Remove(node);
        done.Add(node);
        continue;
    }
    stack.Push((node, next + 1)); // resume after the child returns
    string child = adj[next];
    if (onPath.Contains(child))
        Console.WriteLine($"back    {node} -> {child}");
    else if (done.Contains(child))
        Console.WriteLine($"nontree {node} -> {child}");
    else
    {
        Console.WriteLine($"tree    {node} -> {child}");
        onPath.Add(child);
        stack.Push((child, 0));
    }
}
```

```text output
tree    Config -> Database
tree    Database -> Repository
tree    Repository -> Service
tree    Service -> Api
tree    Api -> Client
tree    Config -> Logging
nontree Logging -> Repository
nontree Logging -> Client
tree    Config -> Cache
nontree Cache -> Service
nontree Config -> Service
```

Every tree edge here matches the recursive `Dfs` from the very first program, in the same order, and every non-tree edge — `Logging -> Repository`, `Logging -> Client`, `Cache -> Service`, `Config -> Service` — comes back `nontree` (a forward or cross edge; telling those apart needs discovery times too, but neither is a cycle) instead of a false `back`. The `(Node, Next)` pair is one stack frame per open call, exactly like the runtime's own call stack: the frame is pushed once, resumed after each child returns, and only removed from `onPath` when its neighbor list is exhausted — the iterative equivalent of a recursive call finally returning.

Figure 2 lays out the recursive DFS tree this all refers back to: five tree edges form the deep chain hanging off `Database`, two more attach `Logging` and `Cache` as childless branches of `Config`, and the four edges no tree edge accounts for are exactly the ones a correct classifier — recursive or the frame-based iterative version above — calls out by name.

<figure class="diagram">
<svg viewBox="0 0 310 360" role="img" aria-labelledby="dfs-tree-title dfs-tree-desc">
<title id="dfs-tree-title">The DFS tree for modules, rooted at Config</title>
<desc id="dfs-tree-desc">Config has three tree children: Database, Logging and Cache. Database starts a chain that continues through Repository, Service, Api and Client, each with one tree child. Logging and Cache have no tree children. A legend below lists the four edges DFS examines that are not tree edges: Config to Service is a forward edge, Logging to Repository and Logging to Client are cross edges, and Cache to Service is a cross edge.</desc>
<rect x="104" y="10" width="96" height="28" rx="6" class="d-box-accent"/>
<text x="152" y="29" text-anchor="middle" class="d-mono d-small d-bold">Config</text>
<path d="M152 38 L54 54" class="d-line" marker-end="url(#dfs-arrow)"/>
<path d="M152 38 L152 54" class="d-line" marker-end="url(#dfs-arrow)"/>
<path d="M152 38 L250 54" class="d-line" marker-end="url(#dfs-arrow)"/>
<rect x="10" y="54" width="88" height="28" rx="6" class="d-box"/>
<text x="54" y="73" text-anchor="middle" class="d-mono d-small">Database</text>
<rect x="108" y="54" width="88" height="28" rx="6" class="d-box"/>
<text x="152" y="73" text-anchor="middle" class="d-mono d-small">Logging</text>
<rect x="206" y="54" width="88" height="28" rx="6" class="d-box"/>
<text x="250" y="73" text-anchor="middle" class="d-mono d-small">Cache</text>
<path d="M54 82 L54 98" class="d-line" marker-end="url(#dfs-arrow)"/>
<rect x="10" y="98" width="88" height="28" rx="6" class="d-box"/>
<text x="54" y="117" text-anchor="middle" class="d-mono d-small">Repository</text>
<path d="M54 126 L54 142" class="d-line" marker-end="url(#dfs-arrow)"/>
<rect x="10" y="142" width="88" height="28" rx="6" class="d-box"/>
<text x="54" y="161" text-anchor="middle" class="d-mono d-small">Service</text>
<path d="M54 170 L54 186" class="d-line" marker-end="url(#dfs-arrow)"/>
<rect x="10" y="186" width="88" height="28" rx="6" class="d-box"/>
<text x="54" y="205" text-anchor="middle" class="d-mono d-small">Api</text>
<path d="M54 214 L54 230" class="d-line" marker-end="url(#dfs-arrow)"/>
<rect x="10" y="230" width="88" height="28" rx="6" class="d-box"/>
<text x="54" y="249" text-anchor="middle" class="d-mono d-small">Client</text>
<text x="10" y="278" class="d-small d-bold">Also examined (non-tree):</text>
<text x="10" y="296" class="d-small d-text-accent">Config -&gt; Service (forward)</text>
<text x="10" y="312" class="d-small d-muted">Logging -&gt; Repository (cross)</text>
<text x="10" y="328" class="d-small d-muted">Logging -&gt; Client (cross)</text>
<text x="10" y="344" class="d-small d-muted">Cache -&gt; Service (cross)</text>
<defs>
<marker id="dfs-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-stroke"/></marker>
</defs>
</svg>
<figcaption>Figure 2. No edge in this graph runs from a node to its own still-open ancestor, so there is no back edge and, as the topological-sort section showed, no cycle. Every dashed-legend edge instead points to a node DFS had already finished by a different route.</figcaption>
</figure>

## What both cost

Every traversal in this article — BFS, recursive DFS, and the frame-based iterative DFS — visits each vertex exactly once and, when it does, looks at every one of that vertex's outgoing edges exactly once. That is the whole basis for the *O(V + E)* bound Sedgewick and Wayne give both searches, phrased as "time proportional to the sum of \[the\] degrees" of the vertices visited ([Sedgewick & Wayne, "Undirected Graphs"](https://algs4.cs.princeton.edu/41graph/)). It can be checked exactly, by counting every edge examination rather than timing anything:

```csharp run
Console.WriteLine(
    "layers  verts  edges  BFS  DFS");
foreach (int layers in new[] { 2, 4, 6, 8 })
{
    var (g, edgeCount) = BuildLayered(layers);
    int bfsExamined = CountBfsEdges(g, 0);
    int dfsExamined = CountDfsEdges(g, 0);
    Console.WriteLine(
        $"{layers,6}  {g.Count,5}  {edgeCount,5}  " +
        $"{bfsExamined,3}  {dfsExamined,3}");
}

// Layer i has i+1 nodes, each pointing to every node in the
// next layer, so both vertex and edge counts grow with layers.
static (Dictionary<int, List<int>>, int) BuildLayered(int layers)
{
    var g = new Dictionary<int, List<int>>();
    int id = 0;
    var prevLayer = new List<int> { id };
    g[id++] = [];
    int edges = 0;
    for (int layer = 1; layer <= layers; layer++)
    {
        var thisLayer = new List<int>();
        for (int i = 0; i <= layer; i++)
        {
            thisLayer.Add(id);
            g[id++] = [];
        }
        foreach (int from in prevLayer)
        foreach (int to in thisLayer)
        {
            g[from].Add(to);
            edges++;
        }
        prevLayer = thisLayer;
    }
    return (g, edges);
}

static int CountBfsEdges(Dictionary<int, List<int>> g, int start)
{
    var seen = new HashSet<int> { start };
    var frontier = new Queue<int>();
    frontier.Enqueue(start);
    int examined = 0;
    while (frontier.Count > 0)
    {
        int node = frontier.Dequeue();
        foreach (int next in g[node])
        {
            examined++;
            if (seen.Add(next)) frontier.Enqueue(next);
        }
    }
    return examined;
}

static int CountDfsEdges(Dictionary<int, List<int>> g, int start)
{
    var seen = new HashSet<int>();
    int examined = 0;
    Visit(start);
    return examined;

    void Visit(int node)
    {
        seen.Add(node);
        foreach (int next in g[node])
        {
            examined++;
            if (!seen.Contains(next)) Visit(next);
        }
    }
}
```

```text output
layers  verts  edges  BFS  DFS
     2      6      8    8    8
     4     15     40   40   40
     6     28    112  112  112
     8     45    240  240  240
```

`edgesExamined` matches the edge count exactly at every size, for both algorithms: each edge is looked at precisely once, whichever end discovers it first, and every vertex is dequeued or recursed into exactly once. Add the *O(V)* vertex work to the *O(E)* edge work and the total is *O(V + E)* — linear in the size of the graph's adjacency-list representation, which every algorithm in this article assumes. An adjacency *matrix* changes the bound: checking all possible neighbors of one vertex costs *O(V)* regardless of how many actually exist, so a full traversal becomes *O(V<sup>2</sup>)*, worse than *O(V + E)* on any graph where most pairs of vertices are not directly connected. Space is *O(V)* for the `seen`/`onPath`/`done` sets and the frontier or call stack, on top of whatever the graph's own representation costs to store.

Cycle detection, topological sort and connected components each cost exactly what the DFS underneath them costs — *O(V + E)* — because none of them do more than a constant amount of extra work per vertex or per edge examined. Nothing in this article changes if a vertex has weighted edges; BFS's shortest-*path* guarantee, specifically, does not survive that change, because "fewest edges" and "least total weight" stop being the same question the moment edges stop being interchangeable — which is what the next article in this pillar takes on.

::::exercise[Extend the edge counter]
`CountBfsEdges` counts every edge examination, including edges to nodes already in `seen`. Modify it to also count how many of those examinations were *wasted* — pointed at an already-visited node — and report that count alongside the total for each layer size above.

:::solution
```csharp run
Console.WriteLine(
    "layers  edges  wasted");
foreach (int layers in new[] { 2, 4, 6, 8 })
{
    var (g, edgeCount) = BuildLayered(layers);
    int wasted = CountWastedEdges(g, 0);
    Console.WriteLine(
        $"{layers,6}  {edgeCount,5}  {wasted,6}");
}

static (Dictionary<int, List<int>>, int) BuildLayered(int layers)
{
    var g = new Dictionary<int, List<int>>();
    int id = 0;
    var prevLayer = new List<int> { id };
    g[id++] = [];
    int edges = 0;
    for (int layer = 1; layer <= layers; layer++)
    {
        var thisLayer = new List<int>();
        for (int i = 0; i <= layer; i++)
        {
            thisLayer.Add(id);
            g[id++] = [];
        }
        foreach (int from in prevLayer)
        foreach (int to in thisLayer)
        {
            g[from].Add(to);
            edges++;
        }
        prevLayer = thisLayer;
    }
    return (g, edges);
}

static int CountWastedEdges(
    Dictionary<int, List<int>> g, int start)
{
    var seen = new HashSet<int> { start };
    var frontier = new Queue<int>();
    frontier.Enqueue(start);
    int wasted = 0;
    while (frontier.Count > 0)
    {
        int node = frontier.Dequeue();
        foreach (int next in g[node])
        {
            if (seen.Add(next)) frontier.Enqueue(next);
            else wasted++;
        }
    }
    return wasted;
}
```

```text output
layers  edges  wasted
     2      8       3
     4     40      26
     6    112      85
     8    240     196
```

Every layer past the first has more than one parent pointing into it (each node in layer *i* is a target of every node in layer *i - 1*), so most incoming edges to layer 2 and beyond find their target already claimed by a sibling that got there first through the queue. The wasted count grows faster than the useful one, but the total (`edges`) still bounds it: `wasted` can never exceed `edgeCount`, since every wasted examination is still one of the *E* edges counted once.
:::
::::
