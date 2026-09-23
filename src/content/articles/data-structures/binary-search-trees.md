---
title: "Binary Search Trees, Balance, and What SortedDictionary Uses"
description: "Build a generic Bst<T> with a complete delete, measure how insertion order wrecks height, then meet the red-black tree behind SortedDictionary and SortedSet."
pillar: data-structures
order: 5
author: markus
published: 2026-09-22
updated: 2026-09-22
level: intermediate
tags: [binary-search-tree, red-black-tree, tree-rotation, sorteddictionary, recursion]
prerequisites: ["complexity/big-o-notation", "algorithms/recursion", "data-structures/linked-lists"]
sources:
  - title: "SortedDictionary<TKey,TValue> Class"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.sorteddictionary-2"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "SortedSet<T> Class"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.sortedset-1"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "SortedSet<T>.Min Property"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.sortedset-1.min"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Dictionary<TKey,TValue> Class"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.dictionary-2"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "SortedSet.cs (System.Collections), dotnet/runtime main branch"
    url: "https://github.com/dotnet/runtime/blob/main/src/libraries/System.Collections/src/System/Collections/Generic/SortedSet.cs"
    publisher: "GitHub, dotnet/runtime"
    accessed: 2026-09-22
  - title: "SortedSet.TreeSubSet.cs (System.Collections), dotnet/runtime main branch"
    url: "https://github.com/dotnet/runtime/blob/main/src/libraries/System.Collections/src/System/Collections/Generic/SortedSet.TreeSubSet.cs"
    publisher: "GitHub, dotnet/runtime"
    accessed: 2026-09-22
  - title: "SortedDictionary.cs (System.Collections), dotnet/runtime main branch"
    url: "https://github.com/dotnet/runtime/blob/main/src/libraries/System.Collections/src/System/Collections/Generic/SortedDictionary.cs"
    publisher: "GitHub, dotnet/runtime"
    accessed: 2026-09-22
  - title: "Introduction to Algorithms, 4th ed., chapter 12 (Binary Search Trees)"
    url: "https://mitpress.mit.edu/9780262046305/introduction-to-algorithms/"
    publisher: "MIT Press"
    accessed: 2026-09-22
  - title: "Introduction to Algorithms, 4th ed., chapter 13 (Red-Black Trees)"
    url: "https://mitpress.mit.edu/9780262046305/introduction-to-algorithms/"
    publisher: "MIT Press"
    accessed: 2026-09-22
draft: true
---

A [binary search tree](/glossary/#binary-search-tree) keeps values ordered using nothing but two pointers per node: every node's key is greater than everything in its left subtree and smaller than everything in its right subtree, so a query can throw away half of what remains at every step, the same idea [binary search](/algorithms/binary-search/) applies to a sorted array, except the tree updates itself as you insert and delete instead of needing a re-sort. The catch is in that update: a binary search tree only behaves like a fast structure if it stays roughly balanced, and nothing in the ordering rule above guarantees that. This article builds one, deletes from it fully, breaks it on purpose, fixes the break, and then looks at what .NET actually ships.

## The ordering invariant that makes a tree a *search* tree

CLRS states the binary-search-tree property precisely: for a node `x`, every key in `x`'s left subtree is at most `x.key`, and every key in `x`'s right subtree is at least `x.key`, and this holds [recursively](/algorithms/recursion/) for every node, not just the root. That single [invariant](/glossary/#invariant) is what turns an ordinary binary tree into a *search* tree: it tells you, at every node, which of the two subtrees could possibly contain a given key, without having to look inside either one.

A plain binary tree with no such rule gives you no way to search it faster than checking every node. The invariant is the entire point — every operation below is just "compare against the current node, then go left or go right," repeated until you run out of tree.

## Search and insert: the same downward walk

Searching a binary search tree means comparing the target against the current node and moving to the matching child, starting at the root, until either the key is found or a `null` child is reached. Insertion is the identical walk with one difference: when it runs out of tree, instead of reporting failure, it attaches a new node there. `Bst<T>` below does both, requiring only that `T` can compare itself to another `T`:

```csharp run id=bst-insert
var tree = new Bst<int>();
foreach (int v in new[] { 40, 20, 60, 10, 30, 50, 70 })
    tree.Insert(v);

Console.WriteLine($"Count: {tree.Count}");
foreach (int probe in new[] { 30, 45 })
    Console.WriteLine($"Contains({probe}): {tree.Contains(probe)}");

sealed class Bst<T> where T : IComparable<T>
{
    private sealed class Node(T value)
    {
        public T Value = value;
        public Node? Left;
        public Node? Right;
    }

    private Node? _root;
    public int Count { get; private set; }

    public bool Contains(T value)
    {
        Node? node = _root;
        while (node is not null)
        {
            int cmp = value.CompareTo(node.Value);
            if (cmp == 0) return true;
            node = cmp < 0 ? node.Left : node.Right;
        }
        return false;
    }

    public void Insert(T value)
    {
        if (_root is null)
        {
            _root = new Node(value);
            Count++;
            return;
        }
        Node current = _root;
        while (true)
        {
            int cmp = value.CompareTo(current.Value);
            if (cmp == 0) return; // no duplicates
            if (cmp < 0)
            {
                if (current.Left is null)
                {
                    current.Left = new Node(value);
                    Count++;
                    return;
                }
                current = current.Left;
            }
            else
            {
                if (current.Right is null)
                {
                    current.Right = new Node(value);
                    Count++;
                    return;
                }
                current = current.Right;
            }
        }
    }
}
```

```text output
Count: 7
Contains(30): True
Contains(45): False
```

Both `Contains` and `Insert` do the same constant amount of work per node visited, and the number of nodes they visit is bounded by the tree's height — the length of the longest root-to-leaf path. CLRS states this directly: search, minimum, maximum, successor, predecessor, insert and delete all run in O(*h*) time on a binary search tree of height *h*, with no better general bound available, because each one is fundamentally a walk from the root along a single path. Whether O(*h*) is good depends entirely on how large *h* can get relative to the node count *n* — the [degenerate trees](#degenerate-trees-the-shape-insertion-order-can-force) section below shows exactly how bad that can get.

## Delete: the three shapes a removed node can take

Deleting a node is where a binary search tree stops being simple, because removing an interior node can't just erase it — something has to take its place while keeping the ordering invariant intact. There are exactly three shapes the node being deleted can have, and each needs different handling:

<figure class="diagram">
<svg viewBox="0 0 360 470" role="img" aria-labelledby="delcases-title delcases-desc">
<title id="delcases-title">The three cases of binary search tree deletion: leaf, one child, and two children</title>
<desc id="delcases-desc">Case 1: deleting leaf 20 under 40 leaves 40 with no left child. Case 2: deleting 20, which has only child 10, splices 10 directly under 40. Case 3: deleting 40, which has two children 20 and 60 (60 has left child 50), copies 50's value into 40's node and removes the original 50 node from under 60.</desc>
<text x="20" y="20" class="d-bold d-small">Case 1: delete a leaf</text>
<line x1="70" y1="50" x2="45" y2="88" class="d-line"/>
<circle cx="70" cy="50" r="13" class="d-box"/>
<text x="70" y="55" text-anchor="middle" class="d-mono d-small">40</text>
<circle cx="45" cy="88" r="13" class="d-box-bad"/>
<text x="45" y="93" text-anchor="middle" class="d-mono d-small">20</text>
<text x="150" y="70" class="d-large">&#8594;</text>
<circle cx="270" cy="68" r="13" class="d-box"/>
<text x="270" y="73" text-anchor="middle" class="d-mono d-small">40</text>
<text x="20" y="120" class="d-small d-muted">40's left pointer just becomes null.</text>
<text x="20" y="155" class="d-bold d-small">Case 2: delete a one-child node</text>
<line x1="80" y1="185" x2="55" y2="220" class="d-line"/>
<line x1="55" y1="220" x2="55" y2="255" class="d-line"/>
<circle cx="80" cy="185" r="13" class="d-box"/>
<text x="80" y="190" text-anchor="middle" class="d-mono d-small">40</text>
<circle cx="55" cy="220" r="13" class="d-box-bad"/>
<text x="55" y="225" text-anchor="middle" class="d-mono d-small">20</text>
<circle cx="55" cy="255" r="13" class="d-box-accent"/>
<text x="55" y="260" text-anchor="middle" class="d-mono d-small">10</text>
<text x="160" y="220" class="d-large">&#8594;</text>
<line x1="270" y1="185" x2="270" y2="220" class="d-line"/>
<circle cx="270" cy="185" r="13" class="d-box"/>
<text x="270" y="190" text-anchor="middle" class="d-mono d-small">40</text>
<circle cx="270" cy="220" r="13" class="d-box-accent"/>
<text x="270" y="225" text-anchor="middle" class="d-mono d-small">10</text>
<text x="20" y="290" class="d-small d-muted">20's only child (10) is spliced</text>
<text x="20" y="304" class="d-small d-muted">directly onto 40 in 20's place.</text>
<text x="20" y="339" class="d-bold d-small">Case 3: delete a two-child node</text>
<line x1="90" y1="365" x2="55" y2="400" class="d-line"/>
<line x1="90" y1="365" x2="155" y2="400" class="d-line"/>
<line x1="155" y1="400" x2="130" y2="435" class="d-line"/>
<circle cx="90" cy="365" r="13" class="d-box-warn"/>
<text x="90" y="370" text-anchor="middle" class="d-mono d-small">40</text>
<circle cx="55" cy="400" r="13" class="d-box"/>
<text x="55" y="405" text-anchor="middle" class="d-mono d-small">20</text>
<circle cx="155" cy="400" r="13" class="d-box"/>
<text x="155" y="405" text-anchor="middle" class="d-mono d-small">60</text>
<circle cx="130" cy="435" r="13" class="d-box-bad"/>
<text x="130" y="440" text-anchor="middle" class="d-mono d-small">50</text>
<text x="205" y="400" class="d-large">&#8594;</text>
<line x1="290" y1="365" x2="255" y2="400" class="d-line"/>
<line x1="290" y1="365" x2="325" y2="400" class="d-line"/>
<circle cx="290" cy="365" r="13" class="d-box-accent"/>
<text x="290" y="370" text-anchor="middle" class="d-mono d-small">50</text>
<circle cx="255" cy="400" r="13" class="d-box"/>
<text x="255" y="405" text-anchor="middle" class="d-mono d-small">20</text>
<circle cx="325" cy="400" r="13" class="d-box"/>
<text x="325" y="405" text-anchor="middle" class="d-mono d-small">60</text>
</svg>
<figcaption>Figure 1. The three delete cases: a leaf just vanishes, a one-child node is replaced by its child, and a two-child node has its value overwritten by its in-order successor (50, in red) before that successor's own now-empty spot is removed.</figcaption>
</figure>

The first two cases are really one case: if the node being deleted has at most one child, that child (possibly `null`) simply takes the deleted node's place in the parent. The third case is the interesting one. A node with two children can't be spliced out directly — both of its subtrees have to end up somewhere — so the standard technique, which CLRS presents as part of its `TREE-DELETE` procedure, copies in a neighboring value that is guaranteed to fit: the node's in-order successor (the smallest key in its right subtree) or, symmetrically, its in-order predecessor (the largest key in its left subtree). That neighbor has at most one child by construction — it is the *leftmost* node of the right subtree, so it cannot itself have a left child — which means removing the original copy of that neighbor is always an instance of one of the first two cases, never a second two-child case. `Bst<T>.Remove` below uses the successor, and adds the in-order iterator this article needs throughout:

```csharp run id=bst-delete
var leafCase = new Bst<int>();
foreach (int v in new[] { 40, 20 }) leafCase.Insert(v);
Show("leaf before", leafCase);
leafCase.Remove(20);
Show("leaf after", leafCase);

var oneChildCase = new Bst<int>();
foreach (int v in new[] { 40, 20, 10 }) oneChildCase.Insert(v);
Show("1-child before", oneChildCase);
oneChildCase.Remove(20);
Show("1-child after", oneChildCase);

var twoChildCase = new Bst<int>();
foreach (int v in new[] { 40, 20, 60, 50 }) twoChildCase.Insert(v);
Show("2-child before", twoChildCase);
twoChildCase.Remove(40);
Show("2-child after", twoChildCase);
Console.WriteLine(
    $"40 is gone, 50 answers for it: {twoChildCase.Contains(50)}");

static void Show(string label, Bst<int> tree) =>
    Console.WriteLine($"{label}: {string.Join(", ", tree.InOrder())}");

sealed class Bst<T> where T : IComparable<T>
{
    private sealed class Node(T value)
    {
        public T Value = value;
        public Node? Left;
        public Node? Right;
    }

    private Node? _root;
    public int Count { get; private set; }

    public bool Contains(T value)
    {
        Node? node = _root;
        while (node is not null)
        {
            int cmp = value.CompareTo(node.Value);
            if (cmp == 0) return true;
            node = cmp < 0 ? node.Left : node.Right;
        }
        return false;
    }

    public void Insert(T value)
    {
        if (_root is null)
        {
            _root = new Node(value);
            Count++;
            return;
        }
        Node current = _root;
        while (true)
        {
            int cmp = value.CompareTo(current.Value);
            if (cmp == 0) return;
            if (cmp < 0)
            {
                if (current.Left is null)
                {
                    current.Left = new Node(value);
                    Count++;
                    return;
                }
                current = current.Left;
            }
            else
            {
                if (current.Right is null)
                {
                    current.Right = new Node(value);
                    Count++;
                    return;
                }
                current = current.Right;
            }
        }
    }

    public bool Remove(T value)
    {
        int before = Count;
        _root = Remove(_root, value);
        return Count < before;
    }

    private Node? Remove(Node? node, T value)
    {
        if (node is null) return null; // not found
        int cmp = value.CompareTo(node.Value);
        if (cmp < 0) { node.Left = Remove(node.Left, value); return node; }
        if (cmp > 0) { node.Right = Remove(node.Right, value); return node; }

        // node.Value == value: this is the node to delete.
        Count--;
        if (node.Left is null) return node.Right;  // leaf or 1 R child
        if (node.Right is null) return node.Left;  // 1 L child

        // Two children: splice in the in-order successor
        // (the smallest key in the right subtree).
        Node successorParent = node;
        Node successor = node.Right;
        while (successor.Left is not null)
        {
            successorParent = successor;
            successor = successor.Left;
        }
        node.Value = successor.Value;
        if (successorParent == node)
            successorParent.Right = successor.Right;
        else
            successorParent.Left = successor.Right;
        return node;
    }

    public IEnumerable<T> InOrder()
    {
        var stack = new Stack<Node>();
        Node? current = _root;
        while (current is not null || stack.Count > 0)
        {
            while (current is not null)
            {
                stack.Push(current);
                current = current.Left;
            }
            current = stack.Pop();
            yield return current.Value;
            current = current.Right;
        }
    }
}
```

```text output
leaf before: 20, 40
leaf after: 40
1-child before: 10, 20, 40
1-child after: 10, 40
2-child before: 20, 40, 50, 60
2-child after: 20, 50, 60
40 is gone, 50 answers for it: True
```

The two-child branch never deletes the node the caller asked to delete — it overwrites that node's `Value` field and then deletes a *different* node (the successor) further down. That is why `successorParent == node` needs its own check: if the deleted node's right child has no left subtree at all, the successor is that right child itself, and its parent is the node being deleted, not some node further down the right spine.

`InOrder` walks the tree using an explicit [`Stack<T>`](/data-structures/stacks-and-queues/) instead of recursion, pushing every left-spine node before visiting anything, exactly the way a reader tracing the walk by hand would keep a pile of "come back to this one" nodes. Popping the stack and moving right whenever a node is visited produces every key in ascending order, without ever building the full list of them in memory at once.

::::exercise[Delete by predecessor instead of successor]
`Remove` above always splices in the in-order successor for a two-child delete. Rewrite the two-children branch to use the in-order predecessor instead — the largest key in the node's *left* subtree, found by walking left once then right until there is no more right — and confirm on the tree from Figure 1's balanced example (`40, 20, 60, 10, 30, 50, 70`) that deleting the root still leaves every other key in sorted order.

:::solution
The predecessor walk is the mirror image of the successor walk: start at `node.Left`, then follow `.Right` pointers instead of `.Left` ones, and splice the predecessor out through the same "which side owns the removed node's slot" check.

```csharp run id=ex-predecessor
var tree = new Bst<int>();
foreach (int v in new[] { 40, 20, 60, 10, 30, 50, 70 }) tree.Insert(v);
Console.WriteLine($"before: {string.Join(", ", tree.InOrder())}");
tree.Remove(40);
Console.WriteLine($"after:  {string.Join(", ", tree.InOrder())}");

sealed class Bst<T> where T : IComparable<T>
{
    private sealed class Node(T value)
    {
        public T Value = value;
        public Node? Left;
        public Node? Right;
    }

    private Node? _root;

    public void Insert(T value)
    {
        if (_root is null)
        {
            _root = new Node(value);
            return;
        }
        Node current = _root;
        while (true)
        {
            int cmp = value.CompareTo(current.Value);
            if (cmp == 0) return;
            if (cmp < 0)
            {
                if (current.Left is null)
                {
                    current.Left = new Node(value);
                    return;
                }
                current = current.Left;
            }
            else
            {
                if (current.Right is null)
                {
                    current.Right = new Node(value);
                    return;
                }
                current = current.Right;
            }
        }
    }

    public void Remove(T value) => _root = Remove(_root, value);

    private Node? Remove(Node? node, T value)
    {
        if (node is null) return null;
        int cmp = value.CompareTo(node.Value);
        if (cmp < 0) { node.Left = Remove(node.Left, value); return node; }
        if (cmp > 0) { node.Right = Remove(node.Right, value); return node; }

        if (node.Left is null) return node.Right;
        if (node.Right is null) return node.Left;

        // Two children: splice in the in-order predecessor
        // (the largest key in the left subtree).
        Node predecessorParent = node;
        Node predecessor = node.Left;
        while (predecessor.Right is not null)
        {
            predecessorParent = predecessor;
            predecessor = predecessor.Right;
        }
        node.Value = predecessor.Value;
        if (predecessorParent == node)
            predecessorParent.Left = predecessor.Left;
        else
            predecessorParent.Right = predecessor.Left;
        return node;
    }

    public IEnumerable<T> InOrder()
    {
        var stack = new Stack<Node>();
        Node? current = _root;
        while (current is not null || stack.Count > 0)
        {
            while (current is not null)
            {
                stack.Push(current);
                current = current.Left;
            }
            current = stack.Pop();
            yield return current.Value;
            current = current.Right;
        }
    }
}
```

```text output
before: 10, 20, 30, 40, 50, 60, 70
after:  10, 20, 30, 50, 60, 70
```

Both versions delete the same key and leave every remaining key in the same sorted order — the choice between successor and predecessor only changes which physical node ends up removed and which value ends up copied, never the set of keys left behind or their order.
:::
::::

## Traversals: what "in order" really promises (and two variants)

`InOrder` visits left subtree, then the node, then right subtree, and that specific order is what guarantees ascending output — it is not a coincidence of the stack-based implementation above, it is true of *any* correct in-order walk, recursive or not, because the binary-search-tree property puts every smaller key in the left subtree and every larger key in the right one. Swap the order of the three steps and the traversal still visits every node exactly once, but the sequence stops being sorted and starts meaning something else:

```csharp run id=bst-traversals
var tree = new Bst<int>();
foreach (int v in new[] { 40, 20, 60, 10, 30, 50, 70 }) tree.Insert(v);

Console.WriteLine($"in-order:   {string.Join(", ", tree.InOrder())}");
Console.WriteLine($"pre-order:  {string.Join(", ", tree.PreOrder())}");
Console.WriteLine($"post-order: {string.Join(", ", tree.PostOrder())}");

sealed class Bst<T> where T : IComparable<T>
{
    private sealed class Node(T value)
    {
        public T Value = value;
        public Node? Left;
        public Node? Right;
    }

    private Node? _root;

    public void Insert(T value)
    {
        if (_root is null)
        {
            _root = new Node(value);
            return;
        }
        Node current = _root;
        while (true)
        {
            int cmp = value.CompareTo(current.Value);
            if (cmp == 0) return;
            if (cmp < 0)
            {
                if (current.Left is null)
                {
                    current.Left = new Node(value);
                    return;
                }
                current = current.Left;
            }
            else
            {
                if (current.Right is null)
                {
                    current.Right = new Node(value);
                    return;
                }
                current = current.Right;
            }
        }
    }

    public IEnumerable<T> InOrder()
    {
        var stack = new Stack<Node>();
        Node? current = _root;
        while (current is not null || stack.Count > 0)
        {
            while (current is not null)
            {
                stack.Push(current);
                current = current.Left;
            }
            current = stack.Pop();
            yield return current.Value;
            current = current.Right;
        }
    }

    public IEnumerable<T> PreOrder() => PreOrder(_root);
    private IEnumerable<T> PreOrder(Node? node)
    {
        if (node is null) yield break;
        yield return node.Value;
        foreach (T v in PreOrder(node.Left)) yield return v;
        foreach (T v in PreOrder(node.Right)) yield return v;
    }

    public IEnumerable<T> PostOrder() => PostOrder(_root);
    private IEnumerable<T> PostOrder(Node? node)
    {
        if (node is null) yield break;
        foreach (T v in PostOrder(node.Left)) yield return v;
        foreach (T v in PostOrder(node.Right)) yield return v;
        yield return node.Value;
    }
}
```

```text output
in-order:   10, 20, 30, 40, 50, 60, 70
pre-order:  40, 20, 10, 30, 60, 50, 70
post-order: 10, 30, 20, 50, 70, 60, 40
```

Pre-order visits a node before either of its children, so it always lists a parent before its descendants — the shape you want to serialize a tree and rebuild an identical one by re-inserting in that same order. Post-order visits a node after both children, so every node is listed after everything underneath it — the shape you want to delete a whole tree bottom-up without ever freeing a node while something still points at it, or to evaluate an expression tree where each operator needs its operands' results first.

`InOrder` above walks iteratively with its own `Stack<Node>`; `PreOrder` and `PostOrder` walk by recursion instead, `yield return`-ing from nested `foreach` loops over the recursive calls. Both styles produce the same kind of lazy `IEnumerable<T>` — the iterative one avoids growing the [call stack](/glossary/#call-stack) for a very tall tree, which matters more than it looks like it should, as the next section shows.

::::exercise[Find the bug in a post-order traversal]
`BuggyPostOrder` below is supposed to compute a post-order traversal but was written by moving a line from a working pre-order implementation and forgetting to move it back. Predict what it prints for the five-node tree below, and name which of the three traversals it is actually computing.

```csharp run id=ex-postorder-bug
Node? root = null;
foreach (int v in new[] { 40, 20, 60, 10, 30 }) root = Insert(root, v);

Console.WriteLine($"buggy:   {string.Join(", ", BuggyPostOrder(root))}");
Console.WriteLine($"correct: {string.Join(", ", CorrectPostOrder(root))}");

static Node Insert(Node? node, int value)
{
    if (node is null) return new Node(value);
    if (value < node.Value) node.Left = Insert(node.Left, value);
    else if (value > node.Value) node.Right = Insert(node.Right, value);
    return node;
}

static IEnumerable<int> BuggyPostOrder(Node? node)
{
    if (node is null) yield break;
    yield return node.Value; // BUG: belongs after the recursive calls
    foreach (int v in BuggyPostOrder(node.Left)) yield return v;
    foreach (int v in BuggyPostOrder(node.Right)) yield return v;
}

static IEnumerable<int> CorrectPostOrder(Node? node)
{
    if (node is null) yield break;
    foreach (int v in CorrectPostOrder(node.Left)) yield return v;
    foreach (int v in CorrectPostOrder(node.Right)) yield return v;
    yield return node.Value;
}

sealed class Node(int value)
{
    public int Value = value;
    public Node? Left;
    public Node? Right;
}
```

:::solution
```text output
buggy:   40, 20, 10, 30, 60
correct: 10, 30, 20, 60, 40
```

`BuggyPostOrder` yields a node's value *before* recursing into its children instead of after, which is exactly the definition of pre-order, not post-order — the bug turned one traversal into a different, working one, rather than into broken output, which is why it is easy to miss without checking against the definition (root before children, versus root after children) rather than just glancing at whether the output "looks traversed."
:::
::::

## Degenerate trees: the shape insertion order can force

Every operation above costs O(*h*), and nothing about `Insert` keeps *h* small — it just walks down whichever branch the comparisons send it down and attaches the new node at the bottom. Insert values in an order that never zig-zags and the tree stops branching at all:

<figure class="diagram">
<svg viewBox="0 0 360 490" role="img" aria-labelledby="shape-title shape-desc">
<title id="shape-title">The same seven keys as a balanced tree and as a degenerate chain</title>
<desc id="shape-desc">Top: inserting 40, 20, 60, 10, 30, 50, 70 in that order builds a three-level tree of height 2. Bottom: inserting the same seven keys in ascending order builds a seven-node chain of height 6, each node's only child its right child.</desc>
<text x="20" y="20" class="d-bold d-small">Shuffled insert order</text>
<text x="20" y="34" class="d-mono d-small d-muted">40 20 60 10 30 50 70</text>
<line x1="180" y1="55" x2="100" y2="100" class="d-line"/>
<line x1="180" y1="55" x2="260" y2="100" class="d-line"/>
<line x1="100" y1="100" x2="60" y2="145" class="d-line"/>
<line x1="100" y1="100" x2="140" y2="145" class="d-line"/>
<line x1="260" y1="100" x2="220" y2="145" class="d-line"/>
<line x1="260" y1="100" x2="300" y2="145" class="d-line"/>
<circle cx="180" cy="55" r="14" class="d-box-accent"/>
<text x="180" y="60" text-anchor="middle" class="d-mono d-small">40</text>
<circle cx="100" cy="100" r="14" class="d-box"/>
<text x="100" y="105" text-anchor="middle" class="d-mono d-small">20</text>
<circle cx="260" cy="100" r="14" class="d-box"/>
<text x="260" y="105" text-anchor="middle" class="d-mono d-small">60</text>
<circle cx="60" cy="145" r="14" class="d-box"/>
<text x="60" y="150" text-anchor="middle" class="d-mono d-small">10</text>
<circle cx="140" cy="145" r="14" class="d-box"/>
<text x="140" y="150" text-anchor="middle" class="d-mono d-small">30</text>
<circle cx="220" cy="145" r="14" class="d-box"/>
<text x="220" y="150" text-anchor="middle" class="d-mono d-small">50</text>
<circle cx="300" cy="145" r="14" class="d-box"/>
<text x="300" y="150" text-anchor="middle" class="d-mono d-small">70</text>
<text x="20" y="182" class="d-small d-muted">Height 2: root to any leaf is 2 edges.</text>
<text x="20" y="222" class="d-bold d-small">Ascending insert order</text>
<text x="20" y="236" class="d-mono d-small d-muted">10 20 30 40 50 60 70</text>
<line x1="60" y1="257" x2="80" y2="292" class="d-line"/>
<line x1="80" y1="292" x2="100" y2="327" class="d-line"/>
<line x1="100" y1="327" x2="120" y2="362" class="d-line"/>
<line x1="120" y1="362" x2="140" y2="397" class="d-line"/>
<line x1="140" y1="397" x2="160" y2="432" class="d-line"/>
<line x1="160" y1="432" x2="180" y2="467" class="d-line"/>
<circle cx="60" cy="257" r="14" class="d-box-accent"/>
<text x="60" y="262" text-anchor="middle" class="d-mono d-small">10</text>
<circle cx="80" cy="292" r="14" class="d-box"/>
<text x="80" y="297" text-anchor="middle" class="d-mono d-small">20</text>
<circle cx="100" cy="327" r="14" class="d-box"/>
<text x="100" y="332" text-anchor="middle" class="d-mono d-small">30</text>
<circle cx="120" cy="362" r="14" class="d-box"/>
<text x="120" y="367" text-anchor="middle" class="d-mono d-small">40</text>
<circle cx="140" cy="397" r="14" class="d-box"/>
<text x="140" y="402" text-anchor="middle" class="d-mono d-small">50</text>
<circle cx="160" cy="432" r="14" class="d-box"/>
<text x="160" y="437" text-anchor="middle" class="d-mono d-small">60</text>
<circle cx="180" cy="467" r="14" class="d-box"/>
<text x="180" y="472" text-anchor="middle" class="d-mono d-small">70</text>
</svg>
<figcaption>Figure 2. The same seven keys, two insertion orders: shuffled order builds a tree of height 2, ascending order builds a chain of height 6 — a linked list wearing a tree's interface.</figcaption>
</figure>

A tree built by inserting values in already-sorted order is called degenerate: every node has at most one child, so it is, structurally, a [linked list](/data-structures/linked-lists/) with unused pointers. Its height is *n* − 1, the worst case the O(*h*) bound from the search/insert section allows, and every operation on it costs O(*n*) — the entire advantage of a search tree over a plain sorted list is gone. Reverse-sorted order degenerates identically, just leaning the other way; it is monotonic insertion order in general that is the problem, not ascending order specifically.

::::exercise[Predict the height of a reverse-sorted insert]
Figure 2 shows that inserting `10, 20, 30, 40, 50, 60, 70` builds a degenerate tree of height 6. Predict the height of a tree built by inserting the same seven values in the opposite order, `70, 60, 50, 40, 30, 20, 10`, and whether its in-order traversal still comes out sorted. Then check with the code below.

:::solution
Descending order is degenerate for the same reason ascending order is: each new value is smaller than everything already inserted, so it always becomes the new leftmost node's left child, building a chain leaning the other way. The height is still *n* − 1 = 6, and in-order traversal is still sorted ascending, because in-order walks left-subtree-first regardless of which side the chain leans toward.

```csharp run id=ex-reverse-height
var ascending = new Bst<int>();
foreach (int v in new[] { 10, 20, 30, 40, 50, 60, 70 }) ascending.Insert(v);

var descending = new Bst<int>();
foreach (int v in new[] { 70, 60, 50, 40, 30, 20, 10 }) descending.Insert(v);

string ascOrder = string.Join(",", ascending.InOrder());
string descOrder = string.Join(",", descending.InOrder());
Console.WriteLine($"ascending insert height:  {ascending.Height()}");
Console.WriteLine($"descending insert height: {descending.Height()}");
Console.WriteLine($"both in-order match: {ascOrder == descOrder}");

sealed class Bst<T> where T : IComparable<T>
{
    private sealed class Node(T value)
    {
        public T Value = value;
        public Node? Left;
        public Node? Right;
    }

    private Node? _root;

    public void Insert(T value)
    {
        if (_root is null)
        {
            _root = new Node(value);
            return;
        }
        Node current = _root;
        while (true)
        {
            int cmp = value.CompareTo(current.Value);
            if (cmp == 0) return;
            if (cmp < 0)
            {
                if (current.Left is null)
                {
                    current.Left = new Node(value);
                    return;
                }
                current = current.Left;
            }
            else
            {
                if (current.Right is null)
                {
                    current.Right = new Node(value);
                    return;
                }
                current = current.Right;
            }
        }
    }

    public IEnumerable<T> InOrder()
    {
        var stack = new Stack<Node>();
        Node? current = _root;
        while (current is not null || stack.Count > 0)
        {
            while (current is not null)
            {
                stack.Push(current);
                current = current.Left;
            }
            current = stack.Pop();
            yield return current.Value;
            current = current.Right;
        }
    }

    public int Height()
    {
        if (_root is null) return -1;
        var stack = new Stack<(Node node, int depth)>();
        stack.Push((_root, 0));
        int max = 0;
        while (stack.Count > 0)
        {
            (Node node, int depth) = stack.Pop();
            if (depth > max) max = depth;
            if (node.Left is not null) stack.Push((node.Left, depth + 1));
            if (node.Right is not null) stack.Push((node.Right, depth + 1));
        }
        return max;
    }
}
```

```text output
ascending insert height:  6
descending insert height: 6
both in-order match: True
```
:::
::::

## Measuring height: insertion order against the theoretical bounds

Two numbers bound how bad a tree's height can be. The best possible height for *n* nodes is ⌊log₂ *n*⌋, achieved only by a perfectly balanced tree; CLRS's binary-search-tree chapter also gives the other end, proving that a *randomly built* binary search tree — one built by inserting *n* keys in a uniformly random order — has expected height O(log *n*), far below the O(*n*) worst case a sorted insertion produces. "Expected" is doing real work in that sentence: it is a property of the *average* over random insertion orders, not a promise about any one run, which is exactly what the measurement below checks.

`Bst<T>.Height` below computes height with an explicit stack rather than recursion, on purpose: the recursive version used earlier is fine for the small trees in this article, but calling it on the *n* − 1-deep degenerate trees this experiment builds would recurse *n* deep and risk overflowing the call stack, the same risk `InOrder`'s stack-based design avoids for search and delete. Building the degenerate tree itself is also the expensive part here, since each of its *n* inserts has to walk past every node already inserted — an O(*n*²) construction — so the sizes below stop well short of where that quadratic cost would matter. The insertion order for the "random" column is shuffled with a fixed seed so the numbers below are exactly reproducible, not just "roughly" reproducible, on any machine running this same code:

```csharp run id=bst-height
#:property Optimize=true

int[] sizes = [500, 2_000, 8_000, 30_000];
var rng = new Random(42);

Console.WriteLine($"{"n",7} {"sorted h",9} {"random h",9} {"min h",6}");
foreach (int n in sizes)
{
    var sortedTree = new Bst<int>();
    for (int i = 0; i < n; i++) sortedTree.Insert(i);

    int[] shuffled = [.. Enumerable.Range(0, n)];
    for (int i = shuffled.Length - 1; i > 0; i--)
    {
        int j = rng.Next(i + 1);
        (shuffled[i], shuffled[j]) = (shuffled[j], shuffled[i]);
    }
    var randomTree = new Bst<int>();
    foreach (int v in shuffled) randomTree.Insert(v);

    int sortedHeight = sortedTree.Height();
    int randomHeight = randomTree.Height();
    int minHeight = (int)Math.Floor(Math.Log2(n));
    Console.WriteLine(
        $"{n,7} {sortedHeight,9} {randomHeight,9} {minHeight,6}");
}

sealed class Bst<T> where T : IComparable<T>
{
    private sealed class Node(T value)
    {
        public T Value = value;
        public Node? Left;
        public Node? Right;
    }

    private Node? _root;

    public void Insert(T value)
    {
        if (_root is null)
        {
            _root = new Node(value);
            return;
        }
        Node current = _root;
        while (true)
        {
            int cmp = value.CompareTo(current.Value);
            if (cmp == 0) return;
            if (cmp < 0)
            {
                if (current.Left is null)
                {
                    current.Left = new Node(value);
                    return;
                }
                current = current.Left;
            }
            else
            {
                if (current.Right is null)
                {
                    current.Right = new Node(value);
                    return;
                }
                current = current.Right;
            }
        }
    }

    public int Height()
    {
        if (_root is null) return -1;
        var stack = new Stack<(Node node, int depth)>();
        stack.Push((_root, 0));
        int max = 0;
        while (stack.Count > 0)
        {
            (Node node, int depth) = stack.Pop();
            if (depth > max) max = depth;
            if (node.Left is not null) stack.Push((node.Left, depth + 1));
            if (node.Right is not null) stack.Push((node.Right, depth + 1));
        }
        return max;
    }
}
```

```text output
      n  sorted h  random h  min h
    500       499        17      8
   2000      1999        23     10
   8000      7999        27     12
  30000     29999        33     14
```

Every number in this table came from one run on one machine — .NET 10.0.12 on Windows 11 (build 22631), 16 logical processors — with the shape of the result, not the exact digits, being what generalizes. The sorted column is exact arithmetic, not a measurement: a degenerate tree of *n* nodes always has height *n* − 1. The random column grows far more slowly, staying at roughly two to two-and-a-half times the minimum-height column across the whole range, rather than drifting toward the sorted column's *n* − 1 — which is the visible signature of the O(log *n*) expected-height result: not a guarantee that random insertion produces the *best* tree, but a guarantee that it stays close to it, while a single bad insertion order stays exactly as bad as it was on paper.

## Rotations: reshaping without breaking the invariant

A degenerate tree needs restructuring, not just re-insertion — and the tool for restructuring a binary search tree without violating its ordering invariant is the rotation. CLRS defines a rotation as a local, constant-time operation: it changes which of two adjacent nodes is the parent and which is the child, while preserving the binary-search-tree property for the whole subtree, and it touches only a fixed number of pointers, which is why CLRS states it runs in O(1) time regardless of the subtree's size.

<figure class="diagram">
<svg viewBox="0 0 360 400" role="img" aria-labelledby="rotate-title rotate-desc">
<title id="rotate-title">Left-rotating at 20 makes 40 the new root while every key keeps its place in sorted order</title>
<desc id="rotate-desc">Before: 20 is root with left child 10 and right child 40; 40 has left child 30 and right child 60. After: 40 is root with left child 20 and right child 60; 20 has left child 10 and right child 30, the subtree that moved.</desc>
<text x="20" y="20" class="d-bold d-small">Before: rotateLeft(20)</text>
<line x1="140" y1="40" x2="70" y2="85" class="d-line"/>
<line x1="140" y1="40" x2="210" y2="85" class="d-line"/>
<line x1="210" y1="85" x2="170" y2="130" class="d-line"/>
<line x1="210" y1="85" x2="250" y2="130" class="d-line"/>
<circle cx="140" cy="40" r="14" class="d-box"/>
<text x="140" y="45" text-anchor="middle" class="d-mono d-small">20</text>
<circle cx="70" cy="85" r="14" class="d-box"/>
<text x="70" y="90" text-anchor="middle" class="d-mono d-small">10</text>
<circle cx="210" cy="85" r="14" class="d-box-accent"/>
<text x="210" y="90" text-anchor="middle" class="d-mono d-small">40</text>
<circle cx="170" cy="130" r="14" class="d-box-2 d-dashed"/>
<text x="170" y="135" text-anchor="middle" class="d-mono d-small">30</text>
<circle cx="250" cy="130" r="14" class="d-box"/>
<text x="250" y="135" text-anchor="middle" class="d-mono d-small">60</text>
<text x="20" y="168" class="d-small d-muted">40's left child (30) moves to</text>
<text x="20" y="182" class="d-small d-muted">20's right; 40 becomes root.</text>
<text x="20" y="215" class="d-bold d-small">After</text>
<line x1="200" y1="235" x2="130" y2="280" class="d-line"/>
<line x1="200" y1="235" x2="270" y2="280" class="d-line"/>
<line x1="130" y1="280" x2="95" y2="325" class="d-line"/>
<line x1="130" y1="280" x2="165" y2="325" class="d-line"/>
<circle cx="200" cy="235" r="14" class="d-box-accent"/>
<text x="200" y="240" text-anchor="middle" class="d-mono d-small">40</text>
<circle cx="130" cy="280" r="14" class="d-box"/>
<text x="130" y="285" text-anchor="middle" class="d-mono d-small">20</text>
<circle cx="270" cy="280" r="14" class="d-box"/>
<text x="270" y="285" text-anchor="middle" class="d-mono d-small">60</text>
<circle cx="95" cy="325" r="14" class="d-box"/>
<text x="95" y="330" text-anchor="middle" class="d-mono d-small">10</text>
<circle cx="165" cy="325" r="14" class="d-box-2 d-dashed"/>
<text x="165" y="330" text-anchor="middle" class="d-mono d-small">30</text>
<text x="20" y="365" class="d-small d-muted">In-order is unchanged both ways:</text>
<text x="20" y="379" class="d-small d-muted">10, 20, 30, 40, 60.</text>
</svg>
<figcaption>Figure 3. A left rotation at 20 changes which node is root and which is a child, but never changes the sorted order a reader would get from an in-order walk.</figcaption>
</figure>

A left rotation at node `p` promotes `p`'s right child `q` to take `p`'s place; `q`'s old left subtree (labeled 30, in the dashed circle) is the only piece that has to move, and it moves to become `p`'s new right child, the only slot in the new shape it can legally occupy without breaking the ordering invariant:

```csharp run id=bst-rotate
Node root = new(20)
{
    Left = new Node(10),
    Right = new Node(40) { Left = new Node(30), Right = new Node(60) },
};

string beforeOrder = string.Join(", ", InOrder(root));
Console.WriteLine($"before: root={root.Value}, in-order={beforeOrder}");
root = RotateLeft(root);
string afterOrder = string.Join(", ", InOrder(root));
Console.WriteLine($"after:  root={root.Value}, in-order={afterOrder}");
Console.WriteLine(
    $"new root's children: left={root.Left!.Value}, " +
    $"right={root.Right!.Value}");
Console.WriteLine(
    $"the subtree that moved is now the old root's right " +
    $"child: {root.Left!.Right!.Value}");

static Node RotateLeft(Node p)
{
    Node q = p.Right!;
    p.Right = q.Left; // the moved subtree becomes p's right child
    q.Left = p; // p becomes q's left child
    return q; // q is the new subtree root
}

static IEnumerable<int> InOrder(Node? node)
{
    if (node is null) yield break;
    foreach (int v in InOrder(node.Left)) yield return v;
    yield return node.Value;
    foreach (int v in InOrder(node.Right)) yield return v;
}

sealed class Node(int value)
{
    public int Value = value;
    public Node? Left;
    public Node? Right;
}
```

```text output
before: root=20, in-order=10, 20, 30, 40, 60
after:  root=40, in-order=10, 20, 30, 40, 60
new root's children: left=20, right=60
the subtree that moved is now the old root's right child: 30
```

Only three pointer assignments happen inside `RotateLeft`, and the in-order sequence is byte-for-byte identical before and after — a rotation reshapes a tree without ever changing what a sorted walk of it reports. Repeated rotations, applied in the right places, are how self-balancing trees keep height close to log₂ *n* after every insert and delete instead of letting it drift toward *n*, without ever having to rebuild the tree from scratch.

::::exercise[Prove a rotation and its inverse cancel out]
`RotateLeft` promotes a node's right child; a `RotateRight` that promotes a node's left child undoes it. Write `RotateRight`, apply `RotateLeft` and then `RotateRight` back-to-back to the tree from the code above, and confirm the tree is not just sorted the same way but has exactly the same shape as before either call.

:::solution
`RotateRight(q)` is `RotateLeft` with every left and right swapped: it promotes `q.Left`, moves that promoted node's right subtree onto `q`'s left, and returns the promoted node.

```csharp run id=ex-rotate-roundtrip
Node root = new(20)
{
    Left = new Node(10),
    Right = new Node(40) { Left = new Node(30), Right = new Node(60) },
};
string before = Describe(root);

root = RotateLeft(root);
root = RotateRight(root);

string after = Describe(root);
Console.WriteLine($"before: {before}");
Console.WriteLine($"after:  {after}");
Console.WriteLine($"same shape: {before == after}");

static Node RotateLeft(Node p)
{
    Node q = p.Right!;
    p.Right = q.Left;
    q.Left = p;
    return q;
}

static Node RotateRight(Node q)
{
    Node p = q.Left!;
    q.Left = p.Right;
    p.Right = q;
    return p;
}

static string Describe(Node? node)
{
    if (node is null) return ".";
    return $"({node.Value} {Describe(node.Left)} {Describe(node.Right)})";
}

sealed class Node(int value)
{
    public int Value = value;
    public Node? Left;
    public Node? Right;
}
```

```text output
before: (20 (10 . .) (40 (30 . .) (60 . .)))
after:  (20 (10 . .) (40 (30 . .) (60 . .)))
same shape: True
```

`Describe` prints a node's value together with both children recursively, so two equal `Describe` strings mean the trees are structurally identical, not merely sorted the same — a stronger check than comparing `InOrder` output, which the earlier rotation figure already showed stays the same regardless of shape.
:::
::::

## The red-black invariant, at the level that matters

Rotations are the mechanism; a red-black tree is a policy for when to apply them, chosen so height never drifts far from log₂ *n* no matter what order keys arrive in — solving exactly the degeneration problem measured above, for every insertion order, not just random ones. .NET's own tree implementation states the four invariants directly, in the source for `SortedSet<T>`:

> A binary search tree is a red-black tree if it satisfies the following red-black properties: 1. Every node is either red or black 2. Every leaf (nil node) is black 3. If a node is red, the both its children are black 4. Every simple path from a node to a descendant leaf contains the same number of black nodes

Every real node is colored red or black (a color bit added on top of an ordinary binary-search-tree node); the *absence* of a child — conceptually a `null` "leaf" — counts as black; red nodes may never have red children; and every root-to-leaf path passes through the same number of black nodes, called the tree's black-height. Rule 3 stops two reds ever stacking directly, and rule 4 forces every path to look similar in black-node count, and together CLRS proves — a proof the .NET source cites directly rather than re-deriving — that these four rules bound the height of an *n*-node red-black tree at 2·log₂(*n* + 1), regardless of insertion order. Compare that to the measured table above: no column, at any size, needs to get anywhere near *n* − 1 for a red-black tree to guarantee it never will.

Maintaining the invariants after an ordinary binary-search-tree insert or delete is what a full red-black implementation spends most of its code on: a new node is inserted red (rule 4 is trivially preserved, since adding a red node changes no path's black count), which can momentarily violate rule 3, and fixing that violation is a bounded sequence of recolorings and — this is where the mechanism from the previous section comes back — at most a few rotations, climbing back toward the root at most O(log *n*) steps. That fixup logic is the genuinely fiddly part of a from-scratch red-black tree and is deliberately out of scope here; what carries forward is the invariant itself, and the height bound it buys, which is exactly what the next section leans on.

## Inside SortedDictionary<TKey,TValue> and SortedSet<T>

.NET's own ordered collections are exactly this: Microsoft's documentation for `SortedDictionary<TKey,TValue>` states plainly that it "is a binary search tree with O(log n) retrieval," and the [dotnet/runtime source](https://github.com/dotnet/runtime/blob/main/src/libraries/System.Collections/src/System/Collections/Generic/SortedSet.cs) for `SortedSet<T>` confirms the specific kind of binary search tree: an `internal enum NodeColor : byte { Black, Red }` field on every node, a root always constructed black, and `RotateLeft`/`RotateRight` methods used throughout insertion and deletion — the same red-black tree this article just described. `SortedDictionary<TKey,TValue>` does not reimplement any of this; its [source](https://github.com/dotnet/runtime/blob/main/src/libraries/System.Collections/src/System/Collections/Generic/SortedDictionary.cs) holds a private `TreeSet<KeyValuePair<TKey,TValue>>` field, and `TreeSet<T>` is declared as `sealed class TreeSet<T> : SortedSet<T>` — a thin subclass that throws on duplicate keys instead of silently ignoring them. Both types are the same red-black tree engine underneath.

```csharp run id=bst-sorteddictionary
var byName = new SortedDictionary<string, int>
{
    ["mercury"] = 1,
    ["venus"] = 2,
    ["earth"] = 3,
    ["mars"] = 4,
};
foreach ((string name, int order) in byName)
    Console.WriteLine($"{order}: {name}");

var years = new SortedSet<int> { 1969, 1957, 1998, 1981, 2003 };
Console.WriteLine($"earliest: {years.Min}, latest: {years.Max}");

SortedSet<int> nineties = years.GetViewBetween(1990, 1999);
Console.WriteLine($"in the 1990s: {string.Join(", ", nineties)}");
years.Add(1995); // mutate the underlying set after taking the view
Console.WriteLine($"the view sees it too: {string.Join(", ", nineties)}");
```

```text output
3: earth
4: mars
1: mercury
2: venus
earliest: 1957, latest: 2003
in the 1990s: 1998
the view sees it too: 1995, 1998
```

`byName` enumerates by key, alphabetically, regardless of insertion order — the payoff of maintaining the ordering invariant on every write, at O(log *n*) per insert, rather than sorting once on demand. `Min` and `Max` are not cached constants; the source's `MinInternal`/`MaxInternal` walk the leftmost or rightmost spine from the root, an O(*h*) operation exactly like the `Contains` walk earlier in this article, which for a red-black tree means O(log *n*) rather than O(1). `GetViewBetween` is the most surprising of the three: it does not copy anything. It returns a `TreeSubSet`, and that class's own documentation says so directly — "this class represents a subset view into the tree. Any changes to this view are reflected in the actual tree" — which is why adding `1995` to `years` after `nineties` was already created still shows up when `nineties` is enumerated again: the view re-derives its own root from the live underlying tree on every access, rather than freezing a snapshot at the moment `GetViewBetween` was called.

::::exercise[Compare enumeration order against a plain Dictionary]
`Dictionary<TKey,TValue>` gives expected O(1) lookup — covered in full in the [hash tables](/data-structures/hash-tables/) article — against `SortedDictionary<TKey,TValue>`'s O(log n). Insert the same five out-of-order integer keys into one of each and compare what `foreach` gives back.

:::solution
```csharp run id=ex-dict-vs-sorted
int[] keys = [42, 7, 19, 3, 88];
var plain = new Dictionary<int, string>();
var sorted = new SortedDictionary<int, string>();
foreach (int k in keys)
{
    plain[k] = $"item-{k}";
    sorted[k] = $"item-{k}";
}

Console.WriteLine($"Dictionary:       {string.Join(", ", plain.Keys)}");
Console.WriteLine($"SortedDictionary: {string.Join(", ", sorted.Keys)}");
Console.WriteLine($"sorted matches an actual sort: " +
    $"{sorted.Keys.SequenceEqual(keys.OrderBy(k => k))}");
```

```text output
Dictionary:       42, 7, 19, 3, 88
SortedDictionary: 3, 7, 19, 42, 88
sorted matches an actual sort: True
```

`SortedDictionary<TKey,TValue>` always enumerates low to high, because that is what walking its red-black tree in order produces. `Dictionary<TKey,TValue>` happened to enumerate in insertion order here, but Microsoft's documentation for it is explicit that this is not a promise: "the order in which the items are returned is undefined." A future .NET version, a resize, or a removal can all change it without breaking any documented contract — code that needs order has to ask for `SortedDictionary<TKey,TValue>` (or sort explicitly), never rely on what an unsorted dictionary happens to do today.
:::
::::

## When to write your own tree instead of reaching for SortedDictionary

For ordinary "keep these keys sorted, and look one up occasionally" needs in C#, `SortedDictionary<TKey,TValue>` or `SortedSet<T>` is the answer, not a hand-rolled `Bst<T>`: the same red-black guarantee this article derived by hand, O(log n) worst case rather than merely expected, already implemented, tested, and maintained. A hand-rolled tree earns its place in three narrower situations: learning the mechanism, as this article did; needing an invariant beyond plain ordering that the BCL type does not expose, such as an augmented node that also tracks its subtree's size for O(log n) rank queries ("what is the 40th-smallest key") or an interval tree for overlap queries; or needing direct access to tree structure — a specific node's successor as a cursor, not just a fresh range scan — which `SortedSet<T>`'s public surface deliberately does not hand out.
