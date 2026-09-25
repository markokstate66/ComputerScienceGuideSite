---
title: "Binary Heaps: Sift, Heapify, and PriorityQueue in C#"
description: "Build a generic MinHeap<T> from array index math, prove the O(n) heapify bound visually, and fix PriorityQueue's missing decrease-key and stability."
pillar: data-structures
order: 6
author: markus
published: 2026-09-22
updated: 2026-09-22
level: intermediate
tags: [heap, priority-queue, binary-heap, big-o, top-k]
prerequisites: ["complexity/big-o-notation", "data-structures/arrays-and-dynamic-arrays"]
sources:
  - title: "PriorityQueue<TElement,TPriority> Class"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.priorityqueue-2"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "PriorityQueue<TElement,TPriority>.Remove Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.priorityqueue-2.remove"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "PriorityQueue<TElement,TPriority>.Dequeue Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.priorityqueue-2.dequeue"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "PriorityQueue.cs (System.Collections), dotnet/runtime main branch"
    url: "https://github.com/dotnet/runtime/blob/main/src/libraries/System.Collections/src/System/Collections/Generic/PriorityQueue.cs"
    publisher: "dotnet/runtime on GitHub"
    accessed: 2026-09-22
  - title: "Algorithms, 4th ed., section 2.4: Priority Queues"
    url: "https://algs4.cs.princeton.edu/24pq/"
    publisher: "Sedgewick and Wayne, Princeton University"
    accessed: 2026-09-22
  - title: "Introduction to Algorithms, 4th ed., chapter 6 (Heap and Heapsort)"
    url: "https://mitpress.mit.edu/9780262046305/introduction-to-algorithms/"
    publisher: "MIT Press"
    accessed: 2026-09-22
draft: false
---

An unsorted array answers "insert something" in O(1) — append at the end — but answers "give me the smallest" in O(n): there is nothing to do but scan every element. A sorted array is the mirror image: O(1) to read off the smallest (it's at the front), but O(n) to insert, because everything after the insertion point has to shift over. A [binary heap](/glossary/#heap) is the structure that refuses to pick a side: both operations cost O(log n). This article builds one — a generic `MinHeap<T>` backed by a plain array, nothing pointer-based — derives why building one from n elements up front costs O(n) and not the O(n log n) a first guess suggests, and then checks that argument against what `PriorityQueue<TElement,TPriority>` actually is under the hood and where its public surface stops short of a textbook priority queue.

## A heap lives in one array, not in node pointers

The *priority queue* abstract data type needs exactly two operations to matter: `Insert(item, priority)` and `ExtractMin()` (or `ExtractMax`, depending on which end you care about — the two are symmetric, so this article builds the min-returning version throughout). A *binary heap* is the standard way to implement both in O(log n): a complete binary tree — every level full except possibly the last, which fills left to right with no gaps — where every node's key is less than or equal to both of its children's keys. That's the whole *heap property*. It says nothing about how a node compares to its sibling, so a heap is not sorted; it only guarantees the minimum is always at the root.

"Complete, filled left to right with no gaps" is exactly what makes an array the right container: node `i`'s two children always live at fixed offsets from `i`, so the tree needs no `Left`/`Right` pointers at all.

<figure class="diagram">
<svg viewBox="0 0 340 300" role="img" aria-labelledby="idx-title idx-desc">
<title id="idx-title">A seven-node heap drawn as a tree, then as the array that stores it</title>
<desc id="idx-desc">Seven circles numbered 0 through 6 arranged as a complete binary tree, with node 2's edges to nodes 5 and 6 highlighted. Below, the same seven indices appear as boxes in one row, in the same left-to-right order as the tree's levels.</desc>
<defs>
<marker id="idx-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-stroke"/></marker>
</defs>
<path d="M170 34 L90 84" class="d-line"/>
<path d="M170 34 L250 84" class="d-line"/>
<path d="M90 104 L50 154" class="d-line"/>
<path d="M90 104 L130 154" class="d-line"/>
<path d="M250 104 L210 154" class="d-accent" marker-end="url(#idx-arrow)"/>
<path d="M250 104 L290 154" class="d-accent" marker-end="url(#idx-arrow)"/>
<circle cx="170" cy="20" r="16" class="d-box"/>
<text x="170" y="25" text-anchor="middle" class="d-mono d-bold">0</text>
<circle cx="90" cy="90" r="16" class="d-box"/>
<text x="90" y="95" text-anchor="middle" class="d-mono d-bold">1</text>
<circle cx="250" cy="90" r="16" class="d-box-accent"/>
<text x="250" y="95" text-anchor="middle" class="d-mono d-bold">2</text>
<circle cx="50" cy="160" r="16" class="d-box"/>
<text x="50" y="165" text-anchor="middle" class="d-mono d-bold">3</text>
<circle cx="130" cy="160" r="16" class="d-box"/>
<text x="130" y="165" text-anchor="middle" class="d-mono d-bold">4</text>
<circle cx="210" cy="160" r="16" class="d-box-accent"/>
<text x="210" y="165" text-anchor="middle" class="d-mono d-bold">5</text>
<circle cx="290" cy="160" r="16" class="d-box-accent"/>
<text x="290" y="165" text-anchor="middle" class="d-mono d-bold">6</text>
<text x="170" y="200" text-anchor="middle" class="d-small d-text-accent">node 2's children: 2·2+1=5, 2·2+2=6</text>
<rect x="10" y="224" width="40" height="30" class="d-box"/>
<rect x="50" y="224" width="40" height="30" class="d-box"/>
<rect x="90" y="224" width="40" height="30" class="d-box-accent"/>
<rect x="130" y="224" width="40" height="30" class="d-box"/>
<rect x="170" y="224" width="40" height="30" class="d-box"/>
<rect x="210" y="224" width="40" height="30" class="d-box-accent"/>
<rect x="250" y="224" width="40" height="30" class="d-box-accent"/>
<text x="30" y="244" text-anchor="middle" class="d-mono">0</text>
<text x="70" y="244" text-anchor="middle" class="d-mono">1</text>
<text x="110" y="244" text-anchor="middle" class="d-mono d-bold">2</text>
<text x="150" y="244" text-anchor="middle" class="d-mono">3</text>
<text x="190" y="244" text-anchor="middle" class="d-mono">4</text>
<text x="230" y="244" text-anchor="middle" class="d-mono d-bold">5</text>
<text x="270" y="244" text-anchor="middle" class="d-mono d-bold">6</text>
<text x="20" y="280" class="d-muted d-small">index i's parent: (i-1)/2</text>
<text x="20" y="294" class="d-muted d-small">index i's children: 2i+1, 2i+2</text>
</svg>
<figcaption>Figure 1. The tree's level order is the array's index order — index 2's children fall at 2·2+1=5 and 2·2+2=6 with no pointer stored anywhere.</figcaption>
</figure>

```csharp run id=index-math
string[] node = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

Console.WriteLine("i  node  parent  left  right");
for (int i = 0; i < node.Length; i++)
{
    int parent = i == 0 ? -1 : (i - 1) / 2;
    int left = 2 * i + 1;
    int right = 2 * i + 2;
    string parentText = parent < 0 ? "-" : parent.ToString();
    string leftText = left < node.Length ? left.ToString() : "-";
    string rightText = right < node.Length ? right.ToString() : "-";
    Console.WriteLine($"{i,-2} {node[i],-4}  {parentText,6}  {leftText,4}  {rightText,5}");
}
```

```text output
i  node  parent  left  right
0  A          -     1      2
1  B          0     3      4
2  C          0     5      6
3  D          1     7      8
4  E          1     9      -
5  F          2     -      -
6  G          2     -      -
7  H          3     -      -
8  I          3     -      -
9  J          4     -      -
```

Every index but 0 has exactly one parent computed by integer division, and every index has at most two children computed by multiplication — no traversal, no allocation, just arithmetic on the array's own index.

## Sift-up after an insert, sift-down after a removal

Inserting means appending at the array's end (the tree's next open leaf slot) and then walking that new node up: while it is smaller than its parent, swap with the parent. That's *sift-up*, and it stops as soon as the node reaches a parent it isn't smaller than, or reaches the root. It touches at most one node per level, so it costs O(log n) — a complete tree of n nodes has height ⌊log₂ n⌋.

Removing the minimum means removing the root — the only element the heap ever hands back — which leaves a hole exactly where the invariant is checked first. The standard fix moves the *last* element (the tree's last leaf) into the root and then walks it down: while it is bigger than the smaller of its two children, swap with that smaller child. That's *sift-down*, again O(log n) for the same reason.

```csharp run id=minheap-core
int[] data = [5, 3, 8, 1, 9, 2, 7];
var heap = new MinHeap<int>(data);
Console.WriteLine($"after building:  [{string.Join(", ", heap.Items)}]");

int popped = heap.Pop();
Console.WriteLine($"pop() returned:  {popped}");
Console.WriteLine($"after pop:       [{string.Join(", ", heap.Items)}]");

heap.Push(0);
Console.WriteLine($"after push(0):   [{string.Join(", ", heap.Items)}]");

public class MinHeap<T>
{
    private readonly List<T> _items = [];
    private readonly IComparer<T> _comparer;

    public MinHeap(IComparer<T>? comparer = null) => _comparer = comparer ?? Comparer<T>.Default;

    public MinHeap(IEnumerable<T> items, IComparer<T>? comparer = null)
    {
        _comparer = comparer ?? Comparer<T>.Default;
        _items.AddRange(items);
        for (int parent = ParentIndex(_items.Count - 1); parent >= 0; parent--)
            SiftDown(parent);
    }

    public int Count => _items.Count;
    public IReadOnlyList<T> Items => _items;

    public T Peek() =>
        _items.Count > 0 ? _items[0] : throw new InvalidOperationException("Heap is empty.");

    public void Push(T item)
    {
        _items.Add(item);
        SiftUp(_items.Count - 1);
    }

    public T Pop()
    {
        if (_items.Count == 0) throw new InvalidOperationException("Heap is empty.");
        T min = _items[0];
        int last = _items.Count - 1;
        _items[0] = _items[last];
        _items.RemoveAt(last);
        if (_items.Count > 0) SiftDown(0);
        return min;
    }

    private static int ParentIndex(int i) => (i - 1) / 2;
    private static int LeftIndex(int i) => 2 * i + 1;
    private static int RightIndex(int i) => 2 * i + 2;

    private void SiftUp(int i)
    {
        while (i > 0)
        {
            int parent = ParentIndex(i);
            if (_comparer.Compare(_items[i], _items[parent]) >= 0) break;
            (_items[i], _items[parent]) = (_items[parent], _items[i]);
            i = parent;
        }
    }

    private void SiftDown(int i)
    {
        int count = _items.Count;
        while (true)
        {
            int left = LeftIndex(i), right = RightIndex(i), smallest = i;
            if (left < count && _comparer.Compare(_items[left], _items[smallest]) < 0) smallest = left;
            if (right < count && _comparer.Compare(_items[right], _items[smallest]) < 0) smallest = right;
            if (smallest == i) break;
            (_items[i], _items[smallest]) = (_items[smallest], _items[i]);
            i = smallest;
        }
    }
}
```

```text output
after building:  [1, 3, 2, 5, 9, 8, 7]
pop() returned:  1
after pop:       [2, 3, 7, 5, 9, 8]
after push(0):   [0, 3, 2, 5, 9, 8, 7]
```

Figure 2 walks `Pop()`'s sift-down on that exact array: `7` (the last element) moves into the empty root, then trades places with whichever child is smaller until it lands somewhere both of its own children are bigger.

<figure class="diagram">
<svg viewBox="0 0 320 340" role="img" aria-labelledby="sift-title sift-desc">
<title id="sift-title">Sift-down after popping the root of [1, 3, 2, 5, 9, 8, 7]</title>
<desc id="sift-desc">Before: 7 sits at the root with children 3 and 2. Since 2 is the smaller child, 7 and 2 swap. After: 2 is the new root, 3 is still its left child, and 7 is now the right child with its own single child, 8. Because 7 is smaller than 8, sifting stops there, matching the final row 2, 3, 7, 5, 9, 8.</desc>
<defs>
<marker id="sift-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-stroke"/></marker>
</defs>
<text x="10" y="14" class="d-small d-bold">Before: 7 sits at the root, misplaced</text>
<rect x="130" y="24" width="60" height="26" rx="6" class="d-box-warn"/>
<text x="160" y="42" text-anchor="middle" class="d-mono d-bold">7</text>
<rect x="50" y="74" width="60" height="26" rx="6" class="d-box"/>
<text x="80" y="92" text-anchor="middle" class="d-mono">3</text>
<rect x="210" y="74" width="60" height="26" rx="6" class="d-box-accent"/>
<text x="240" y="92" text-anchor="middle" class="d-mono d-bold">2</text>
<path d="M150 50 L90 74" class="d-line"/>
<path d="M170 50 L230 74" class="d-accent" marker-end="url(#sift-arrow)"/>
<text x="10" y="118" class="d-small d-muted">2 is the smaller child, so 7 swaps with it</text>
<text x="10" y="150" class="d-small d-bold">After: 2 moves up, 7 takes its place</text>
<rect x="130" y="160" width="60" height="26" rx="6" class="d-box-accent"/>
<text x="160" y="178" text-anchor="middle" class="d-mono d-bold">2</text>
<rect x="50" y="210" width="60" height="26" rx="6" class="d-box"/>
<text x="80" y="228" text-anchor="middle" class="d-mono">3</text>
<rect x="210" y="210" width="60" height="26" rx="6" class="d-box-warn"/>
<text x="240" y="228" text-anchor="middle" class="d-mono d-bold">7</text>
<path d="M150 186 L90 210" class="d-line"/>
<path d="M170 186 L230 210" class="d-line"/>
<rect x="210" y="260" width="60" height="26" rx="6" class="d-box"/>
<text x="240" y="278" text-anchor="middle" class="d-mono">8</text>
<path d="M240 236 L240 260" class="d-line"/>
<text x="10" y="304" class="d-small d-muted">7's only child is 8, and 7 &lt; 8, so</text>
<text x="10" y="318" class="d-small d-muted">sifting stops: [2, 3, 7, 5, 9, 8].</text>
</svg>
<figcaption>Figure 2. 7 trades places once with the smaller child, 2, then stops one level down because its remaining child, 8, is already bigger.</figcaption>
</figure>

::::exercise[Predict a build before running it]
Building `new MinHeap<int>([9, 1, 5, 3, 7, 2])` calls `SiftDown` on parents in reverse index order — first index 2 (parent of 5 and 2), then index 1 (parent of 1 and 3), then index 0 (the root). Work through those three calls by hand: what does `Items` hold once the constructor returns?

:::solution
```csharp run id=build-predict
int[] data = [9, 1, 5, 3, 7, 2];
var heap = new MinHeap<int>(data);
Console.WriteLine($"[{string.Join(", ", heap.Items)}]");

public class MinHeap<T>
{
    private readonly List<T> _items = [];
    private readonly IComparer<T> _comparer;
    public MinHeap(IComparer<T>? comparer = null) => _comparer = comparer ?? Comparer<T>.Default;
    public MinHeap(IEnumerable<T> items, IComparer<T>? comparer = null)
    {
        _comparer = comparer ?? Comparer<T>.Default;
        _items.AddRange(items);
        for (int parent = ParentIndex(_items.Count - 1); parent >= 0; parent--)
            SiftDown(parent);
    }
    public IReadOnlyList<T> Items => _items;
    private static int ParentIndex(int i) => (i - 1) / 2;
    private static int LeftIndex(int i) => 2 * i + 1;
    private static int RightIndex(int i) => 2 * i + 2;
    private void SiftDown(int i)
    {
        int count = _items.Count;
        while (true)
        {
            int left = LeftIndex(i), right = RightIndex(i), smallest = i;
            if (left < count && _comparer.Compare(_items[left], _items[smallest]) < 0) smallest = left;
            if (right < count && _comparer.Compare(_items[right], _items[smallest]) < 0) smallest = right;
            if (smallest == i) break;
            (_items[i], _items[smallest]) = (_items[smallest], _items[i]);
            i = smallest;
        }
    }
}
```

```text output
[1, 3, 2, 9, 7, 5]
```

Index 2 (value 5, a leaf here — it has no children within a 6-element array) does nothing. Index 1 (value 1, children 3 and 7) already beats both children, so it also does nothing. Index 0 (value 9, children 1 and 5) is the only real work: 9 is bigger than both, the smaller child is 1, so 9 and 1 swap; 9 is now at index 1, whose children are 3 and 7, and 9 is bigger than both, so it swaps again with the smaller, 3. 9 has no children past index 3, so it stops there.
:::
::::

## Building a heap from n elements is O(n), not O(n log n)

The constructor above calls `SiftDown` once per internal node, and each call costs up to O(log n) in the worst case, so the obvious bound is n·O(log n) = O(n log n). That bound is correct but not tight, and the gap between them is the entire point: **sift-down's cost depends on a node's height — its distance down to the nearest leaf — not on the tree's overall height**, and in a complete tree most nodes are close to the bottom.

Take a complete, 15-node heap: 1 node at the root (height 3, meaning up to 3 levels to descend), 2 nodes at height 2, 4 nodes at height 1, and 8 leaves at height 0. A leaf's `SiftDown` call returns immediately — a leaf has no children to compare against — so those 8 nodes, more than half the tree, do zero work regardless of what "the tree has O(log n) height" says about the *worst possible* node.

<figure class="diagram">
<svg viewBox="0 0 340 260" role="img" aria-labelledby="levels-title levels-desc">
<title id="levels-title">Heapify work per level of a 15-node heap</title>
<desc id="levels-desc">Four rows, one per level. Root: 1 node, height 3, work up to 3, subtotal 3. Next level: 2 nodes, height 2, work up to 2 each, subtotal 4. Next level: 4 nodes, height 1, work up to 1 each, subtotal 4. Leaves: 8 nodes, height 0, work 0 each, subtotal 0. The total, 11, is far below the naive 15 times 3 equals 45 bound.</desc>
<text x="10" y="14" class="d-small d-bold">level    nodes  height  max subtotal</text>
<rect x="10" y="22" width="20" height="20" class="d-box-accent"/>
<text x="45" y="37" class="d-small">1 node</text>
<text x="120" y="37" class="d-small">h=3</text>
<text x="180" y="37" class="d-small d-bold">1x3 = 3</text>
<rect x="10" y="50" width="20" height="20" class="d-box-accent"/>
<rect x="34" y="50" width="20" height="20" class="d-box-accent"/>
<text x="65" y="65" class="d-small">2 nodes</text>
<text x="120" y="65" class="d-small">h=2</text>
<text x="180" y="65" class="d-small d-bold">2x2 = 4</text>
<rect x="10" y="78" width="20" height="20" class="d-box"/>
<rect x="34" y="78" width="20" height="20" class="d-box"/>
<rect x="58" y="78" width="20" height="20" class="d-box"/>
<rect x="82" y="78" width="20" height="20" class="d-box"/>
<text x="113" y="93" class="d-small">4 nodes</text>
<text x="180" y="93" class="d-small">h=1</text>
<text x="230" y="93" class="d-small d-bold">4x1 = 4</text>
<rect x="10" y="106" width="20" height="20" class="d-box-2"/>
<rect x="34" y="106" width="20" height="20" class="d-box-2"/>
<rect x="58" y="106" width="20" height="20" class="d-box-2"/>
<rect x="82" y="106" width="20" height="20" class="d-box-2"/>
<rect x="106" y="106" width="20" height="20" class="d-box-2"/>
<rect x="130" y="106" width="20" height="20" class="d-box-2"/>
<rect x="154" y="106" width="20" height="20" class="d-box-2"/>
<rect x="178" y="106" width="20" height="20" class="d-box-2"/>
<text x="230" y="121" class="d-small d-muted">8 leaves, h=0, work 0</text>
<text x="10" y="150" class="d-small d-bold">total across all levels: 3+4+4+0 = 11</text>
<text x="10" y="168" class="d-small d-muted">versus treating every one of the 15</text>
<text x="10" y="182" class="d-small d-muted">nodes as worst-case height-3 work:</text>
<text x="10" y="196" class="d-small d-muted">15 x 3 = 45 — heapify's real cost is</text>
<text x="10" y="210" class="d-small d-muted">under a third of that loose bound.</text>
<text x="10" y="234" class="d-small d-muted">More than half the nodes (the leaves)</text>
<text x="10" y="248" class="d-small d-muted">contribute nothing at all.</text>
</svg>
<figcaption>Figure 3. Work is concentrated where there are few nodes (near the root) and absent where there are many (the leaves), so the level-by-level sum stays proportional to n instead of growing with n log n.</figcaption>
</figure>

Generalize that: a complete tree of n nodes has at most ⌈n / 2^(h+1)⌉ nodes at height h, and `SiftDown` on a height-h node does O(h) work. Summed over every height from 0 up to ⌊log₂ n⌋:

```text
sum of h * n / 2^(h+1), for h = 0 up to log2(n)
  <= n * sum of h / 2^(h+1), for h = 0 to infinity
  = n * 1        (the infinite sum h/2^(h+1) converges to 1)
  = O(n)
```

The series `h / 2^(h+1)` shrinks fast enough that its infinite sum is a constant, so the whole expression is n times a constant — O(n), not O(n log n). Sedgewick and Wayne state the conclusion directly for the sink-based construction this article's constructor uses: "Sink-based heap construction is linear time" ([Sedgewick & Wayne, "Priority Queues"](https://algs4.cs.princeton.edu/24pq/)). CLRS derives the same bound with the same per-height accounting, as the running-time analysis of `BUILD-MAX-HEAP` (CLRS, chapter 6). Inserting n elements one at a time instead — n calls to `SiftUp`, each bounded by the *tree's* height rather than the *node's* height — has no such cancellation and stays O(n log n); that gap is measured directly below, not just claimed.

```csharp run id=heapify-cost
int[] sizes = [1_000, 2_000, 4_000, 8_000];

Console.WriteLine("n        build/n  insert/n");
foreach (int n in sizes)
{
    var rng = new Random(42);
    int[] data = new int[n];
    for (int i = 0; i < n; i++) data[i] = rng.Next();

    long buildUp = ComparisonsBuildingBottomUp((int[])data.Clone());
    long oneAtATime = ComparisonsInsertingOneAtATime((int[])data.Clone());

    Console.WriteLine($"{n,-8} {(double)buildUp / n,7:F2}  {(double)oneAtATime / n,8:F2}");
}

static long ComparisonsBuildingBottomUp(int[] a)
{
    long comparisons = 0;
    int n = a.Length;
    for (int parent = (n - 2) / 2; parent >= 0; parent--)
        SiftDown(a, parent, n, ref comparisons);
    return comparisons;
}

static long ComparisonsInsertingOneAtATime(int[] a)
{
    long comparisons = 0;
    int[] heap = new int[a.Length];
    int size = 0;
    foreach (int value in a)
    {
        heap[size] = value;
        SiftUp(heap, size, ref comparisons);
        size++;
    }
    return comparisons;
}

static void SiftDown(int[] a, int i, int count, ref long comparisons)
{
    while (true)
    {
        int left = 2 * i + 1, right = 2 * i + 2, smallest = i;
        if (left < count) { comparisons++; if (a[left] < a[smallest]) smallest = left; }
        if (right < count) { comparisons++; if (a[right] < a[smallest]) smallest = right; }
        if (smallest == i) break;
        (a[i], a[smallest]) = (a[smallest], a[i]);
        i = smallest;
    }
}

static void SiftUp(int[] a, int i, ref long comparisons)
{
    while (i > 0)
    {
        int parent = (i - 1) / 2;
        comparisons++;
        if (a[i] >= a[parent]) break;
        (a[i], a[parent]) = (a[parent], a[i]);
        i = parent;
    }
}
```

```text output
n        build/n  insert/n
1000        1.83      2.14
2000        1.87      2.20
4000        1.87      2.21
8000        1.87      2.24
```

`build/n` — comparisons per element for the bottom-up constructor — sits flat around 1.85 as n rises eightfold; that flatness is what "O(n)" means empirically, comparisons growing in direct proportion to n. `insert/n` stays noticeably higher and drifts up slightly, from 2.14 to 2.24, but nowhere near as much as the worst-case bound for a single insert would suggest: with 1 + log₂ n comparisons as the *worst case* for one insert ([Sedgewick & Wayne, "Priority Queues"](https://algs4.cs.princeton.edu/24pq/)), n = 8,000 puts that worst case at roughly 14 comparisons per element, six times what this run actually measured. What the numbers show is the direction of both quantities: `build/n` stays flat while `insert/n` keeps creeping upward as n grows, which is the signature of an O(n) process next to one carrying an extra, slowly-growing term.

## What `PriorityQueue<TElement,TPriority>` actually gives you

.NET's [`PriorityQueue<TElement,TPriority>`](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.priorityqueue-2) is the same idea as `MinHeap<T>` above with two differences the documentation states plainly. First, its remarks describe it as implementing "an array-backed, quaternary min-heap" ([PriorityQueue Class](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.priorityqueue-2)) — each internal node has up to four children rather than two, which the `PriorityQueue.cs` source fixes as `private const int Arity = 4` ([`PriorityQueue.cs`](https://github.com/dotnet/runtime/blob/main/src/libraries/System.Collections/src/System/Collections/Generic/PriorityQueue.cs)). A shallower tree means fewer levels to sift through per operation, but the same O(log n) order of growth as the binary version, and the same O(n) bottom-up construction the source's own `Heapify` method performs from any constructor that takes an initial collection.

```csharp run id=pq-basics
var queue = new PriorityQueue<string, int>();
queue.Enqueue("wash dishes", 3);
queue.Enqueue("put out kitchen fire", 0);
queue.Enqueue("reply to email", 5);
queue.Enqueue("water the plants", 3);

while (queue.TryDequeue(out string? task, out int priority))
    Console.WriteLine($"{priority}: {task}");
```

```text output
0: put out kitchen fire
3: water the plants
3: wash dishes
5: reply to email
```

`wash dishes` was enqueued before `water the plants`, yet `water the plants` came out first — and that is an accident of this run, not a rule: the class's own remarks say it plainly, "the type does not guarantee first-in-first-out semantics for elements of equal priority" ([PriorityQueue Class](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.priorityqueue-2)). A different .NET version, or the same two tasks enqueued in the opposite order, can legally print them either way.

Second, and more consequential: nothing in the type's public surface reprioritizes an item already in the queue. Its full member list — `Enqueue`, `Dequeue`/`TryDequeue`, `Peek`/`TryPeek`, `EnqueueDequeue`, `DequeueEnqueue`, `Remove`, `EnqueueRange`, plus capacity helpers — has no `DecreaseKey` or `UpdatePriority`. `Remove(TElement, ...)` looks like it could substitute (remove the stale entry, then re-`Enqueue` the improved one), but its own remarks rule that out as anything cheap: "the method performs a linear-time scan of every element in the heap, removing the first value found to match the `element` parameter," and if the queue holds duplicates of that element, "what entry does get removed is non-deterministic and does not take priority into account" ([`Remove` Method](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.priorityqueue-2.remove)). An O(n) scan to undo an O(log n) insert defeats the point of using a heap for anything reprioritized often. `Dequeue()` (without `Try`) also throws `InvalidOperationException` on an empty queue rather than returning a default value ([`Dequeue` Method](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.priorityqueue-2.dequeue)), which is why every loop in this article reads with `TryDequeue` instead.

[Dijkstra's algorithm](/algorithms/dijkstra-shortest-path/) is the case most people hit this in: relaxing an edge wants to lower a vertex's distance that may already be queued. That article works around the missing decrease-key by leaving stale duplicates in the queue and skipping them with a `visited` set the moment they resurface — cheap there specifically because a vertex's distance only ever needs to *improve once* before it's finalized for good. That trick doesn't generalize to every reprioritization problem, which the next section works through directly instead of repeating.

## A generation counter, for priorities that change more than once

A vertex in Dijkstra's algorithm is finalized the moment it's dequeued and never revisited — one improvement, ever, per vertex. A job scheduler doesn't get that guarantee: a job's priority can be raised and lowered repeatedly for as long as it sits in the queue, so "skip it if we've seen this key before" isn't available — a job might legitimately need processing after being seen, reprioritized, and seen again. What still works is tagging every push with a version number and discarding any pop whose version doesn't match the job's *current* one:

```csharp run id=generation-counter
var jobs = new Dictionary<string, Job>();
var queue = new PriorityQueue<(string Name, int Generation), int>();

Enqueue(new Job("backup", 5));
Enqueue(new Job("compact-index", 5));
Enqueue(new Job("send-digest", 2));
Reprioritize("compact-index", 0); // now more urgent than everything else
Reprioritize("backup", 9);        // now less urgent than everything else

while (queue.TryDequeue(out var entry, out int priority))
{
    Job job = jobs[entry.Name];
    if (entry.Generation != job.Generation)
    {
        Console.WriteLine($"skip  {entry.Name} (stale, was {priority})");
        continue;
    }
    Console.WriteLine($"run   {entry.Name} at priority {job.Priority}");
}

void Enqueue(Job job)
{
    jobs[job.Name] = job;
    job.Generation++;
    queue.Enqueue((job.Name, job.Generation), job.Priority);
}

void Reprioritize(string name, int newPriority)
{
    Job job = jobs[name];
    job.Priority = newPriority;
    Enqueue(job);
}

class Job(string name, int priority)
{
    public string Name { get; } = name;
    public int Priority { get; set; } = priority;
    public int Generation { get; set; }
}
```

```text output
run   compact-index at priority 0
run   send-digest at priority 2
skip  compact-index (stale, was 5)
skip  backup (stale, was 5)
run   backup at priority 9
```

`compact-index` is pushed twice (generations 1 and 2) and `backup` is pushed twice as well (generations 1 and 2); each job's `Generation` field always holds the number stamped on its *most recent* push, so every earlier copy fails the `entry.Generation != job.Generation` check and is discarded on the way out — including the two stale, equal-priority-5 entries, which happen to pop in `compact-index`-then-`backup` order here for the same implementation-defined-tie reason as the previous section, but are skipped either way. That's the same lazy-deletion shape as Dijkstra's `visited` set, generalized to handle a key resurfacing an unbounded number of times rather than exactly once.

:::dotnet
`EnqueueDequeue` and `DequeueEnqueue` exist for a related but different job: updating a size-bounded queue in one call instead of two. Neither reprioritizes an existing entry — both still only ever look at the current minimum. The [top-k section](#keeping-only-the-k-largest-with-a-bounded-heap) below is the pattern they're built for.
:::

## Forcing FIFO order among equal priorities

The no-stability guarantee has its own workaround, and it doesn't need a generation counter: fold a strictly increasing sequence number into the priority itself, so ties on the priority the caller cares about are broken by insertion order instead of being left to the implementation.

```csharp run id=stability-tiebreak
var queue = new PriorityQueue<string, (int Priority, long Sequence)>();
long sequence = 0;

void Enqueue(string item, int priority) => queue.Enqueue(item, (priority, sequence++));

Enqueue("wash dishes", 3);
Enqueue("put out kitchen fire", 0);
Enqueue("reply to email", 5);
Enqueue("water the plants", 3);

while (queue.TryDequeue(out string? task, out (int Priority, long Sequence) key))
    Console.WriteLine($"{key.Priority}: {task}");
```

```text output
0: put out kitchen fire
3: wash dishes
3: water the plants
5: reply to email
```

`ValueTuple`'s default comparer orders lexicographically — `Priority` first, `Sequence` only as a tie-break — so `wash dishes` and `water the plants` (both priority 3) now come out in the order they were enqueued every time, on every .NET version, instead of by accident as in the earlier trace.

## Keeping only the k largest, with a bounded heap

A min-heap capped at size k, where anything smaller than the current minimum is rejected outright, is the standard way to find the k largest elements of a stream without sorting all of it: keep the heap's minimum as the current "worst of the best," and only pay a swap when something beats it.

<details>
<summary>Full program</summary>

```csharp run id=topk-heap
int[] scores = [72, 91, 68, 85, 40, 99, 77, 63, 88, 55, 94, 81];
int[] top3 = TopK(scores, 3);
Console.WriteLine($"top 3 of {scores.Length} scores: [{string.Join(", ", top3)}]");

static int[] TopK(IEnumerable<int> stream, int k)
{
    var heap = new MinHeap<int>();
    foreach (int value in stream)
    {
        if (heap.Count < k)
        {
            heap.Push(value);
        }
        else if (value > heap.Peek())
        {
            heap.Pop();
            heap.Push(value);
        }
    }

    var result = new int[heap.Count];
    for (int i = result.Length - 1; i >= 0; i--)
        result[i] = heap.Pop();
    return result;
}

public class MinHeap<T>
{
    private readonly List<T> _items = [];
    private readonly IComparer<T> _comparer;
    public MinHeap(IComparer<T>? comparer = null) => _comparer = comparer ?? Comparer<T>.Default;
    public MinHeap(IEnumerable<T> items, IComparer<T>? comparer = null)
    {
        _comparer = comparer ?? Comparer<T>.Default;
        _items.AddRange(items);
        for (int parent = ParentIndex(_items.Count - 1); parent >= 0; parent--)
            SiftDown(parent);
    }
    public int Count => _items.Count;
    public T Peek() => _items.Count > 0 ? _items[0] : throw new InvalidOperationException("Heap is empty.");
    public void Push(T item)
    {
        _items.Add(item);
        SiftUp(_items.Count - 1);
    }
    public T Pop()
    {
        if (_items.Count == 0) throw new InvalidOperationException("Heap is empty.");
        T min = _items[0];
        int last = _items.Count - 1;
        _items[0] = _items[last];
        _items.RemoveAt(last);
        if (_items.Count > 0) SiftDown(0);
        return min;
    }
    private static int ParentIndex(int i) => (i - 1) / 2;
    private static int LeftIndex(int i) => 2 * i + 1;
    private static int RightIndex(int i) => 2 * i + 2;
    private void SiftUp(int i)
    {
        while (i > 0)
        {
            int parent = ParentIndex(i);
            if (_comparer.Compare(_items[i], _items[parent]) >= 0) break;
            (_items[i], _items[parent]) = (_items[parent], _items[i]);
            i = parent;
        }
    }
    private void SiftDown(int i)
    {
        int count = _items.Count;
        while (true)
        {
            int left = LeftIndex(i), right = RightIndex(i), smallest = i;
            if (left < count && _comparer.Compare(_items[left], _items[smallest]) < 0) smallest = left;
            if (right < count && _comparer.Compare(_items[right], _items[smallest]) < 0) smallest = right;
            if (smallest == i) break;
            (_items[i], _items[smallest]) = (_items[smallest], _items[i]);
            i = smallest;
        }
    }
}
```

```text output
top 3 of 12 scores: [99, 94, 91]
```

</details>

The heap does the selection; only the loop and the final unload from it matter:

```csharp snippet of=topk-heap
static int[] TopK(IEnumerable<int> stream, int k)
{
    var heap = new MinHeap<int>();
    foreach (int value in stream)
    {
        if (heap.Count < k)
        {
            heap.Push(value);
        }
        else if (value > heap.Peek())
        {
            heap.Pop();
            heap.Push(value);
        }
    }

    var result = new int[heap.Count];
    for (int i = result.Length - 1; i >= 0; i--)
        result[i] = heap.Pop();
    return result;
}
```

Every element is looked at once: below capacity it's an O(log k) `Push`; at capacity, a rejection is a single O(1) comparison against `Peek()`, and only an actual improvement pays for a `Pop` plus a `Push`. For a stream of n items and a fixed k, that's O(n log k) rather than the O(n log n) of sorting everything to read off the top k. Draining the heap afterward pops smallest-first, so writing each pop into `result` from the back fills it largest-first, matching "top 3" read left to right above.

## Merging k sorted lists

Given k already-sorted lists, a heap avoids ever comparing more than k candidates at a time: push each list's current head, pop the smallest, then push whatever that list's next element is. The heap only ever holds one candidate per list, so its size never exceeds k regardless of how many elements the lists hold in total.

<details>
<summary>Full program</summary>

```csharp run id=merge-k
int[][] lists = [[1, 4, 9, 20], [2, 3, 15], [0, 5, 6, 7, 30]];
int[] merged = MergeSorted(lists).ToArray();
Console.WriteLine($"[{string.Join(", ", merged)}]");

static IEnumerable<int> MergeSorted(IReadOnlyList<int[]> lists)
{
    var byValueThenList = Comparer<(int Value, int ListIndex, int ElementIndex)>.Create(
        (a, b) => a.Value != b.Value ? a.Value.CompareTo(b.Value) : a.ListIndex.CompareTo(b.ListIndex));
    var heap = new MinHeap<(int Value, int ListIndex, int ElementIndex)>(byValueThenList);

    for (int i = 0; i < lists.Count; i++)
        if (lists[i].Length > 0)
            heap.Push((lists[i][0], i, 0));

    while (heap.Count > 0)
    {
        var (value, listIndex, elementIndex) = heap.Pop();
        yield return value;

        int next = elementIndex + 1;
        if (next < lists[listIndex].Length)
            heap.Push((lists[listIndex][next], listIndex, next));
    }
}

public class MinHeap<T>
{
    private readonly List<T> _items = [];
    private readonly IComparer<T> _comparer;
    public MinHeap(IComparer<T>? comparer = null) => _comparer = comparer ?? Comparer<T>.Default;
    public MinHeap(IEnumerable<T> items, IComparer<T>? comparer = null)
    {
        _comparer = comparer ?? Comparer<T>.Default;
        _items.AddRange(items);
        for (int parent = ParentIndex(_items.Count - 1); parent >= 0; parent--)
            SiftDown(parent);
    }
    public int Count => _items.Count;
    public T Peek() => _items.Count > 0 ? _items[0] : throw new InvalidOperationException("Heap is empty.");
    public void Push(T item)
    {
        _items.Add(item);
        SiftUp(_items.Count - 1);
    }
    public T Pop()
    {
        if (_items.Count == 0) throw new InvalidOperationException("Heap is empty.");
        T min = _items[0];
        int last = _items.Count - 1;
        _items[0] = _items[last];
        _items.RemoveAt(last);
        if (_items.Count > 0) SiftDown(0);
        return min;
    }
    private static int ParentIndex(int i) => (i - 1) / 2;
    private static int LeftIndex(int i) => 2 * i + 1;
    private static int RightIndex(int i) => 2 * i + 2;
    private void SiftUp(int i)
    {
        while (i > 0)
        {
            int parent = ParentIndex(i);
            if (_comparer.Compare(_items[i], _items[parent]) >= 0) break;
            (_items[i], _items[parent]) = (_items[parent], _items[i]);
            i = parent;
        }
    }
    private void SiftDown(int i)
    {
        int count = _items.Count;
        while (true)
        {
            int left = LeftIndex(i), right = RightIndex(i), smallest = i;
            if (left < count && _comparer.Compare(_items[left], _items[smallest]) < 0) smallest = left;
            if (right < count && _comparer.Compare(_items[right], _items[smallest]) < 0) smallest = right;
            if (smallest == i) break;
            (_items[i], _items[smallest]) = (_items[smallest], _items[i]);
            i = smallest;
        }
    }
}
```

```text output
[0, 1, 2, 3, 4, 5, 6, 7, 9, 15, 20, 30]
```

</details>

The heap picks the next value; the rest is bookkeeping for which list it came from:

```csharp snippet of=merge-k
static IEnumerable<int> MergeSorted(IReadOnlyList<int[]> lists)
{
    var byValueThenList = Comparer<(int Value, int ListIndex, int ElementIndex)>.Create(
        (a, b) => a.Value != b.Value ? a.Value.CompareTo(b.Value) : a.ListIndex.CompareTo(b.ListIndex));
    var heap = new MinHeap<(int Value, int ListIndex, int ElementIndex)>(byValueThenList);

    for (int i = 0; i < lists.Count; i++)
        if (lists[i].Length > 0)
            heap.Push((lists[i][0], i, 0));

    while (heap.Count > 0)
    {
        var (value, listIndex, elementIndex) = heap.Pop();
        yield return value;

        int next = elementIndex + 1;
        if (next < lists[listIndex].Length)
            heap.Push((lists[listIndex][next], listIndex, next));
    }
}
```

The explicit `IComparer` breaks ties on `ListIndex` — otherwise two equal values from different lists would compare only by `Value`, and the heap would be free to pop either one first, making the output order (though not its correctness) depend on `MinHeap<T>`'s internal layout rather than on the input.

Each `Pop`/`Push` pair costs O(log k), and there are as many pairs as there are total elements across all lists, so merging n total elements from k lists costs O(n log k) — better than concatenating and sorting everything (O(n log n)) whenever k is smaller than n, which it is by definition here. [Heap sort](/algorithms/sorting-algorithms-compared/#heap-sort-quicksorts-guarantee-built-into-the-algorithm) is the same sift-down operation used to sort a single array in place rather than to merge several already-sorted ones; that article builds the full in-place sort, so it isn't repeated here.

::::exercise[Add decrease-key by tracking positions]
`PriorityQueue<TElement,TPriority>` has no decrease-key because its array holds no map from an element back to its index — finding an element at all means scanning, as `Remove`'s O(n) cost shows. Nothing stops a hand-built heap from keeping that map itself. Sketch (or build) an `IndexedMinHeap<TKey, TPriority>` for unique `TKey`s that adds a `DecreaseKey(TKey key, TPriority newPriority)` running in O(log n): what extra field does every heap operation now have to keep in sync?

:::solution
A `Dictionary<TKey, int>` mapping each key to its current array index, updated every time two entries swap — including inside `SiftUp` and `SiftDown`, not just in `Push` and `Pop`:

```csharp run id=indexed-heap
var heap = new IndexedMinHeap<string, int>();
heap.Push("backup", 5);
heap.Push("compact-index", 5);
heap.Push("send-digest", 2);
heap.DecreaseKey("compact-index", 0);

while (heap.Count > 0)
{
    var (key, priority) = heap.Pop();
    Console.WriteLine($"{priority}: {key}");
}

public class IndexedMinHeap<TKey, TPriority> where TKey : notnull
{
    private readonly List<TKey> _keys = [];
    private readonly List<TPriority> _priorities = [];
    private readonly Dictionary<TKey, int> _position = [];
    private readonly IComparer<TPriority> _comparer = Comparer<TPriority>.Default;

    public int Count => _keys.Count;

    public void Push(TKey key, TPriority priority)
    {
        _keys.Add(key);
        _priorities.Add(priority);
        _position[key] = _keys.Count - 1;
        SiftUp(_keys.Count - 1);
    }

    public void DecreaseKey(TKey key, TPriority newPriority)
    {
        int i = _position[key];
        if (_comparer.Compare(newPriority, _priorities[i]) >= 0)
            throw new ArgumentException("newPriority must be smaller than the current priority.", nameof(newPriority));
        _priorities[i] = newPriority;
        SiftUp(i);
    }

    public (TKey Key, TPriority Priority) Pop()
    {
        (TKey Key, TPriority Priority) min = (_keys[0], _priorities[0]);
        int last = _keys.Count - 1;
        MoveEntry(last, 0);
        _keys.RemoveAt(last);
        _priorities.RemoveAt(last);
        _position.Remove(min.Key);
        if (_keys.Count > 0) SiftDown(0);
        return min;
    }

    private void MoveEntry(int from, int to)
    {
        _keys[to] = _keys[from];
        _priorities[to] = _priorities[from];
        _position[_keys[to]] = to;
    }

    private void Swap(int a, int b)
    {
        (_keys[a], _keys[b]) = (_keys[b], _keys[a]);
        (_priorities[a], _priorities[b]) = (_priorities[b], _priorities[a]);
        _position[_keys[a]] = a;
        _position[_keys[b]] = b;
    }

    private void SiftUp(int i)
    {
        while (i > 0)
        {
            int parent = (i - 1) / 2;
            if (_comparer.Compare(_priorities[i], _priorities[parent]) >= 0) break;
            Swap(i, parent);
            i = parent;
        }
    }

    private void SiftDown(int i)
    {
        int count = _keys.Count;
        while (true)
        {
            int left = 2 * i + 1, right = 2 * i + 2, smallest = i;
            if (left < count && _comparer.Compare(_priorities[left], _priorities[smallest]) < 0) smallest = left;
            if (right < count && _comparer.Compare(_priorities[right], _priorities[smallest]) < 0) smallest = right;
            if (smallest == i) break;
            Swap(i, smallest);
            i = smallest;
        }
    }
}
```

```text output
0: compact-index
2: send-digest
5: backup
```

`_position[key]` has to be corrected inside `Swap` itself, not just at the call sites, because every place that moves an entry — `SiftUp`, `SiftDown`, and the root-replacement inside `Pop` — moves it through a swap. `DecreaseKey` then becomes: look up the key's current index in O(1) instead of scanning for it, reject any `newPriority` that isn't strictly smaller than what's already stored, overwrite the priority, and sift up. The rejection isn't optional bookkeeping — `SiftUp` only ever moves a node toward the root, so handing it a *larger* priority would leave that node exactly where a smaller one belongs, silently breaking the heap property with nothing to signal it went wrong. That is the same guard CLRS's DECREASE-KEY makes explicit. What's left is the exact operation `Remove`-then-`Enqueue` on `PriorityQueue<TElement,TPriority>` fakes at O(n) because it has no such map.
:::
::::
