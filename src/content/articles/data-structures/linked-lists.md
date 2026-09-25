---
title: "Linked Lists: How They Work and Why You Rarely Need One"
description: "Build a singly and doubly linked list in C#, measure why arrays usually beat them on modern hardware, and use LinkedList<T> where it truly wins: an LRU cache."
pillar: data-structures
order: 2
author: markus
published: 2026-09-22
updated: 2026-09-22
level: intermediate
tags: [linked-list, doubly-linked-list, list-t, cache-locality, lru-cache]
prerequisites: ["data-structures/arrays-and-dynamic-arrays", "complexity/big-o-notation"]
sources:
  - title: "LinkedList<T> Class"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.linkedlist-1"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "LinkedList<T>.Find(T) Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.linkedlist-1.find"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "LinkedList<T>.AddFirst Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.linkedlist-1.addfirst"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "LinkedList<T>.Remove Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.linkedlist-1.remove"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "LinkedListNode<T>.Previous Property"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.linkedlistnode-1.previous"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "LinkedList.cs (System.Collections), dotnet/runtime main branch"
    url: "https://github.com/dotnet/runtime/blob/main/src/libraries/System.Collections/src/System/Collections/Generic/LinkedList.cs"
    publisher: "GitHub, dotnet/runtime"
    accessed: 2026-09-22
  - title: "Selecting a Collection Class"
    url: "https://learn.microsoft.com/en-us/dotnet/standard/collections/selecting-a-collection-class"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "List<T>.Insert(Int32, T) Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.list-1.insert"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "List<T>.RemoveAt(Int32) Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.list-1.removeat"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "The array reference type (C# reference)"
    url: "https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/arrays"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "GC.GetAllocatedBytesForCurrentThread Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.gc.getallocatedbytesforcurrentthread"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "What every programmer should know about memory, part 5: what programmers can do"
    url: "https://lwn.net/Articles/255364/"
    publisher: "Ulrich Drepper, published by LWN.net"
    accessed: 2026-09-22
  - title: "Introduction to Algorithms, 4th ed., chapter 10 (Elementary Data Structures)"
    url: "https://mitpress.mit.edu/9780262046305/introduction-to-algorithms/"
    publisher: "MIT Press"
    accessed: 2026-09-22
draft: false
---

A node in a linked list is one heap object holding two things: a value, and a reference to the next node. There is no block, no index arithmetic, no fixed size. To reach the fifth element you read the first, then the second, then the third and the fourth, because that reference is the only way from one node to the next. Everything below — what a linked list can do quickly, what it cannot do at all, and the one shape of problem where it beats a [`List<T>`](/data-structures/arrays-and-dynamic-arrays/) outright — follows from that one sentence.

## Building the simplest version: one node, one pointer forward

A singly linked list keeps two things of its own: a reference to the first node (`_head`) and, so that appending does not require a walk to the end, a reference to the last one (`_tail`). Adding at the front only ever touches `_head`; adding at the back only ever touches `_tail`. Neither looks at anything in between.

<figure class="diagram">
<svg viewBox="0 0 360 370" role="img" aria-labelledby="chain-title chain-desc">
<title id="chain-title">A singly linked list of three nodes reached from a head reference</title>
<desc id="chain-desc">A head reference points down to the first node. Each node is a box holding a value and a next field; the next field of each node points down to the following node's box. The last node's next field is empty and labeled null.</desc>
<defs>
<marker id="chain-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-accent"/></marker>
</defs>
<rect x="20" y="10" width="80" height="32" rx="6" class="d-box-2"/>
<text x="60" y="31" text-anchor="middle" class="d-mono">_head</text>
<path d="M60 42 V70" class="d-line" marker-end="url(#chain-arrow)"/>
<rect x="20" y="74" width="120" height="40" class="d-box"/>
<line x1="90" y1="74" x2="90" y2="114" class="d-line"/>
<text x="55" y="99" text-anchor="middle" class="d-mono">A</text>
<text x="115" y="99" text-anchor="middle" class="d-mono d-small">next</text>
<path d="M115 114 V144" class="d-accent" marker-end="url(#chain-arrow)"/>
<rect x="20" y="148" width="120" height="40" class="d-box"/>
<line x1="90" y1="148" x2="90" y2="188" class="d-line"/>
<text x="55" y="173" text-anchor="middle" class="d-mono">B</text>
<text x="115" y="173" text-anchor="middle" class="d-mono d-small">next</text>
<path d="M115 188 V218" class="d-accent" marker-end="url(#chain-arrow)"/>
<rect x="20" y="222" width="120" height="40" class="d-box"/>
<line x1="90" y1="222" x2="90" y2="262" class="d-line"/>
<text x="55" y="247" text-anchor="middle" class="d-mono">C</text>
<text x="115" y="247" text-anchor="middle" class="d-mono d-small">next</text>
<text x="115" y="286" text-anchor="middle" class="d-muted d-small">null</text>
<text x="20" y="330" class="d-small d-muted">Each box is a separate heap object.</text>
<text x="20" y="350" class="d-small d-muted">Reaching C means reading head, A, then B.</text>
</svg>
<figcaption>Figure 1. A singly linked list: <code>_head</code> references the first node, and each node's <code>next</code> field references the following one. There is no way to reach C except by reading A and B first.</figcaption>
</figure>

```csharp run id=singly
var trail = new SinglyLinkedList<string>();
trail.AddLast("Basecamp");
trail.AddLast("Ridge");
trail.AddLast("Summit");
trail.AddFirst("Trailhead");

Console.WriteLine($"Count: {trail.Count}");
foreach (string stop in trail)
    Console.Write($"{stop} -> ");
Console.WriteLine("end");

sealed class SinglyLinkedList<T>
{
    private Node? _head;
    private Node? _tail;

    public int Count { get; private set; }

    public void AddFirst(T value)
    {
        _head = new Node(value, _head);
        _tail ??= _head;
        Count++;
    }

    public void AddLast(T value)
    {
        var node = new Node(value, null);
        if (_tail is null)
            _head = _tail = node;
        else
        {
            _tail.Next = node;
            _tail = node;
        }
        Count++;
    }

    public bool RemoveFirst()
    {
        if (_head is null) return false;
        _head = _head.Next;
        Count--;
        return true;
    }

    public IEnumerator<T> GetEnumerator()
    {
        for (Node? n = _head; n is not null; n = n.Next)
            yield return n.Value;
    }

    private sealed class Node(T value, Node? next)
    {
        public T Value = value;
        public Node? Next = next;
    }
}
```

```text output
Count: 4
Trailhead -> Basecamp -> Ridge -> Summit -> end
```

`GetEnumerator` is enough for `foreach` on its own: C# does not require `IEnumerable<T>` for the `foreach` keyword, only a public `GetEnumerator()` method that returns something with `Current` and `MoveNext`. A `yield return` inside an iterator method builds exactly that. Real collections still implement the interface too, because LINQ and methods like `string.Join` ask for it by type, not by shape; the next class below adds it once it is actually needed.

`AddFirst` and `AddLast` are both O(1): each touches one or two references and returns. Nothing here supports reading `trail[2]` — there is no index to compute an address from, only a chain to walk — so getting to a given position costs O(*n*) in the worst case, and there is no way around that without adding something to the node structure itself (a skip list does exactly that, at the cost of extra pointers per node, and is out of scope here).

::::exercise[Find the bug in RemoveFirst]
Run the program below and explain the output. `pantry` is reported to hold two items, but nothing prints inside the loop.

```csharp run id=ex-bug
var pantry = new SinglyLinkedList<string>();
pantry.AddLast("rice");
pantry.RemoveFirst();
pantry.AddLast("beans");
pantry.AddLast("pasta");

Console.WriteLine($"Count reported: {pantry.Count}");
foreach (string item in pantry)
    Console.WriteLine($"  {item}");

sealed class SinglyLinkedList<T>
{
    private Node? _head;
    private Node? _tail;
    public int Count { get; private set; }

    public void AddLast(T value)
    {
        var node = new Node(value, null);
        if (_tail is null)
            _head = _tail = node;
        else
        {
            _tail.Next = node;
            _tail = node;
        }
        Count++;
    }

    public bool RemoveFirst()
    {
        if (_head is null) return false;
        _head = _head.Next;
        Count--;
        return true;
    }

    public IEnumerator<T> GetEnumerator()
    {
        for (Node? n = _head; n is not null; n = n.Next)
            yield return n.Value;
    }

    private sealed class Node(T value, Node? next)
    {
        public T Value = value;
        public Node? Next = next;
    }
}
```

```text output
Count reported: 2
```

:::solution
`RemoveFirst` advances `_head` but never touches `_tail`. After the only element ("rice") is removed, `_head` is `null` — the list is empty — but `_tail` still points at the old "rice" node. The next `AddLast` checks `_tail is null`, finds it false, and links the new node onto that orphaned node instead of starting a fresh chain from `_head`. "beans" and "pasta" really are allocated and linked to each other, but they hang off a node that `_head` no longer leads to, so nothing is reachable from the front of the list and the `foreach` loop finds nothing.

The fix resets `_tail` the moment the list becomes empty:

```csharp run id=ex-bug-fix
var pantry = new SinglyLinkedList<string>();
pantry.AddLast("rice");
pantry.RemoveFirst();
pantry.AddLast("beans");
pantry.AddLast("pasta");

Console.WriteLine($"Count reported: {pantry.Count}");
foreach (string item in pantry)
    Console.WriteLine($"  {item}");

sealed class SinglyLinkedList<T>
{
    private Node? _head;
    private Node? _tail;
    public int Count { get; private set; }

    public void AddLast(T value)
    {
        var node = new Node(value, null);
        if (_tail is null)
            _head = _tail = node;
        else
        {
            _tail.Next = node;
            _tail = node;
        }
        Count++;
    }

    public bool RemoveFirst()
    {
        if (_head is null) return false;
        _head = _head.Next;
        if (_head is null) _tail = null;
        Count--;
        return true;
    }

    public IEnumerator<T> GetEnumerator()
    {
        for (Node? n = _head; n is not null; n = n.Next)
            yield return n.Value;
    }

    private sealed class Node(T value, Node? next)
    {
        public T Value = value;
        public Node? Next = next;
    }
}
```

```text output
Count reported: 2
  beans
  pasta
```

The one-line fix:

```csharp snippet of=ex-bug-fix
if (_head is null) _tail = null;
```

Two references that must always agree, updated in two different methods, is exactly the kind of bookkeeping a linked list forces onto its author. The sentinel technique in the next section exists to make bugs like this one structurally impossible instead of merely fixed.
:::
::::

## Two pointers per node: walking backward, and deleting without a search

A singly linked node cannot answer "what comes before me?" — nothing points backward. That has a real cost: to delete a specific node you already hold a reference to, you still need its predecessor, because deletion means changing *that* node's `Next` field, and finding the predecessor means walking from `_head` and comparing `current.Next` against the node you are holding. A doubly linked node stores that predecessor directly, in a second field, and turns the search into a field read.

::::exercise[Why a previous pointer changes what deletion can cost]
You hold a reference to node `x`, somewhere in the middle of a singly linked list (not the head), and want to remove it in O(1). Explain why `x` alone is not enough. Then explain the classic workaround — copy `x.Next`'s value into `x`, and delete `x.Next` instead — and name one case where it fails.

:::solution
Deleting `x` means making its predecessor's `Next` field skip past it. A singly linked node only ever points forward, so nothing reachable from `x` tells you which node's `Next` equals `x`; finding that node means walking from the head comparing `current.Next` to `x`, which is O(*n*) — no cheaper than searching for `x` by value in the first place. A doubly linked node stores `x.Previous` directly, which is the one field that turns this into O(1).

The workaround overwrites `x`'s value with `x.Next`'s value, then deletes `x.Next` (which is genuinely O(1), because you already hold a `Next` reference to it). The list now reads correctly, but `x`'s original identity is gone: it fails outright if `x` is the last node (`x.Next` is null, nothing to copy), and it silently breaks any other part of the program still holding a separate reference to the *old* `x`, which now carries the next node's data instead of being removed.
:::
::::

The version below keeps both directions and adds one more idea: a single **sentinel** node that is never a real element. `_sentinel.Next` is the first real node and `_sentinel.Prev` is the last, so the list is circular through the sentinel rather than terminating in `null` at either end. [CLRS](https://mitpress.mit.edu/9780262046305/introduction-to-algorithms/), chapter 10, describes this as a standard way to remove the special cases around an empty list or an operation at an end: insert and remove become one piece of code each, with no `if (at head)` / `if (at tail)` branch, because there is always a real node on both sides of the insertion point — even in an empty list, where both sides are the sentinel itself.

```csharp run id=doubly
var queue = new DoublyLinkedList<string>();
var alice = queue.AddLast("Alice");
var bob = queue.AddLast("Bob");
queue.AddLast("Cara");
Console.WriteLine("forward:  " + string.Join(" ", queue.Values()));
Console.WriteLine("backward: " + string.Join(" ", queue.ValuesBackward()));

queue.InsertBefore(bob, "Priya");
Console.WriteLine("insert:   " + string.Join(" ", queue.Values()));

queue.Remove(alice);
Console.WriteLine("remove:   " + string.Join(" ", queue.Values()));
Console.WriteLine($"Count: {queue.Count}");

sealed class DoublyLinkedList<T>
{
    private readonly Node _sentinel;
    public int Count { get; private set; }

    public DoublyLinkedList()
    {
        _sentinel = new Node(default!);
        _sentinel.Next = _sentinel;
        _sentinel.Prev = _sentinel;
    }

    public Node AddLast(T value) => InsertBefore(_sentinel, value);
    public Node AddFirst(T value) => InsertBefore(_sentinel.Next!, value);

    public Node InsertBefore(Node at, T value)
    {
        var node = new Node(value) { Next = at, Prev = at.Prev };
        at.Prev!.Next = node;
        at.Prev = node;
        Count++;
        return node;
    }

    public void Remove(Node node)
    {
        node.Prev!.Next = node.Next;
        node.Next!.Prev = node.Prev;
        Count--;
    }

    public IEnumerable<T> Values()
    {
        for (Node n = _sentinel.Next!; n != _sentinel; n = n.Next!)
            yield return n.Value;
    }

    public IEnumerable<T> ValuesBackward()
    {
        for (Node n = _sentinel.Prev!; n != _sentinel; n = n.Prev!)
            yield return n.Value;
    }

    public sealed class Node(T value)
    {
        public T Value = value;
        public Node? Next { get; internal set; }
        public Node? Prev { get; internal set; }
    }
}
```

```text output
forward:  Alice Bob Cara
backward: Cara Bob Alice
insert:   Alice Priya Bob Cara
remove:   Priya Bob Cara
Count: 3
```

`AddLast` and `AddFirst` are not separate implementations; both call `InsertBefore` with a different starting node, and `InsertBefore` never checks whether the list happens to be empty, because the sentinel guarantees `at.Prev` always exists. `Remove` given a node you already hold — `alice` here — is two field writes: O(1), no search.

`Next` and `Prev` use `internal set`: any code holding a `Node` can read where it sits, but only code inside this library can rewrite it — public callers get a read-only view, the same shape `LinkedListNode<T>` uses below for its own `Next` and `Previous`.

<figure class="diagram">
<svg viewBox="0 0 360 340" role="img" aria-labelledby="splice-title splice-desc">
<title id="splice-title">Inserting X between A and B by rewiring four pointer fields</title>
<desc id="splice-desc">Before: A, B and C are linked in both directions. During the insert, X is created pointing at A and B, and A's next and B's previous are redirected to X; the four changed links are highlighted. After: A, X, B and C are linked in both directions.</desc>
<defs>
<marker id="splice-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-accent"/></marker>
<marker id="splice-arrow-n" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-stroke"/></marker>
</defs>
<text x="20" y="20" class="d-bold">Before</text>
<rect x="20" y="30" width="50" height="36" class="d-box"/><text x="45" y="53" text-anchor="middle" class="d-mono">A</text>
<rect x="160" y="30" width="50" height="36" class="d-box"/><text x="185" y="53" text-anchor="middle" class="d-mono">B</text>
<rect x="230" y="30" width="50" height="36" class="d-box"/><text x="255" y="53" text-anchor="middle" class="d-mono">C</text>
<path d="M70 42 H158" class="d-line" marker-end="url(#splice-arrow-n)"/>
<path d="M158 54 H70" class="d-line" marker-end="url(#splice-arrow-n)"/>
<path d="M210 42 H228" class="d-line" marker-end="url(#splice-arrow-n)"/>
<path d="M228 54 H210" class="d-line" marker-end="url(#splice-arrow-n)"/>
<text x="20" y="100" class="d-bold">InsertBefore(B, X)</text>
<rect x="20" y="112" width="50" height="36" class="d-box"/><text x="45" y="135" text-anchor="middle" class="d-mono">A</text>
<rect x="90" y="112" width="50" height="36" class="d-box-accent"/><text x="115" y="135" text-anchor="middle" class="d-mono d-bold">X</text>
<rect x="160" y="112" width="50" height="36" class="d-box"/><text x="185" y="135" text-anchor="middle" class="d-mono">B</text>
<rect x="230" y="112" width="50" height="36" class="d-box"/><text x="255" y="135" text-anchor="middle" class="d-mono">C</text>
<path d="M70 124 H88" class="d-accent" marker-end="url(#splice-arrow)"/>
<path d="M88 136 H70" class="d-accent" marker-end="url(#splice-arrow)"/>
<path d="M140 124 H158" class="d-accent" marker-end="url(#splice-arrow)"/>
<path d="M158 136 H140" class="d-accent" marker-end="url(#splice-arrow)"/>
<path d="M210 124 H228" class="d-line" marker-end="url(#splice-arrow-n)"/>
<path d="M228 136 H210" class="d-line" marker-end="url(#splice-arrow-n)"/>
<text x="20" y="178" class="d-small d-text-accent">The four fields InsertBefore sets:</text>
<text x="20" y="194" class="d-small d-text-accent">X.Next, X.Prev, A.Next, B.Prev</text>
<text x="20" y="236" class="d-bold">After</text>
<rect x="20" y="248" width="50" height="36" class="d-box"/><text x="45" y="271" text-anchor="middle" class="d-mono">A</text>
<rect x="90" y="248" width="50" height="36" class="d-box-accent"/><text x="115" y="271" text-anchor="middle" class="d-mono d-bold">X</text>
<rect x="160" y="248" width="50" height="36" class="d-box"/><text x="185" y="271" text-anchor="middle" class="d-mono">B</text>
<rect x="230" y="248" width="50" height="36" class="d-box"/><text x="255" y="271" text-anchor="middle" class="d-mono">C</text>
<path d="M70 260 H88" class="d-line" marker-end="url(#splice-arrow-n)"/>
<path d="M88 272 H70" class="d-line" marker-end="url(#splice-arrow-n)"/>
<path d="M140 260 H158" class="d-line" marker-end="url(#splice-arrow-n)"/>
<path d="M158 272 H140" class="d-line" marker-end="url(#splice-arrow-n)"/>
<path d="M210 260 H228" class="d-line" marker-end="url(#splice-arrow-n)"/>
<path d="M228 272 H210" class="d-line" marker-end="url(#splice-arrow-n)"/>
<text x="20" y="306" class="d-small d-muted">Removing a node is the same rewiring</text>
<text x="20" y="322" class="d-small d-muted">in reverse: splice its neighbors, drop it.</text>
</svg>
<figcaption>Figure 2. Inserting X between A and B changes exactly four references; no other node moves. Deleting a node splices its two neighbors together the same way.</figcaption>
</figure>

## What each operation costs, and under what assumption

Per the [C# array reference](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/arrays), "you establish the length of each dimension when you create the array instance" and "can't change these values during the lifetime of the instance" — which is why insert and remove have no meaning for `T[]` at all — only `List<T>` and `LinkedList<T>` support them. Every entry below is a worst-case [Big-O](/complexity/big-o-notation/) bound, and each assumes you already have whatever reference the column needs (a valid position for an array, a node reference for a linked list) — reaching that reference in the first place is a separate cost, covered by "Access by position" and "Search by value".

| Operation | `T[]` | `List<T>` | `LinkedList<T>` |
|---|---|---|---|
| Access by position | O(1) | O(1) | not supported |
| Insert/remove at the front | not supported | O(*n*) | O(1) |
| Insert/remove at the back | not supported | O(1) amortized | O(1) |
| Insert/remove given a node you hold | not supported | O(*n*) | O(1) |
| Search by value | O(*n*) | O(*n*) | O(*n*) |

The `List<T>` column is documented directly: [`Insert`](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.list-1.insert) is O(*n*), and [`RemoveAt`](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.list-1.removeat) is O(*n* − index), because both shift the tail of the backing array. `LinkedList<T>`'s O(1) row is documented too — "insertion and removal are O(1) operations" for [`LinkedList<T>`](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.linkedlist-1) — but that bound only holds once you already hold the `LinkedListNode<T>` to insert next to or remove; getting that node by walking or by [`Find`](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.linkedlist-1.find) is O(*n*), which the documentation states separately ("this method performs a linear search"). The rest of this article is mostly about that one clause: how often a program already holds the node it needs.

## Reversing a list without copying it

Reversing in place needs to walk the list exactly once, redirecting each node's `Next` field to point at the node before it instead of the node after it. Because overwriting `current.Next` destroys the only way to reach the rest of the list, the walk saves that reference first, in a third variable, before it does the overwrite.

```csharp run id=reverse
using System.Collections;

var trail = new SinglyLinkedList<string>();
trail.AddLast("Trailhead");
trail.AddLast("Basecamp");
trail.AddLast("Ridge");
trail.AddLast("Summit");
Console.WriteLine(string.Join(" -> ", trail));

trail.Reverse();
Console.WriteLine(string.Join(" -> ", trail));

trail.AddLast("Overlook"); // appends after the new tail
Console.WriteLine(string.Join(" -> ", trail));

sealed class SinglyLinkedList<T> : IEnumerable<T>
{
    private Node? _head;
    private Node? _tail;

    public int Count { get; private set; }

    public void AddLast(T value)
    {
        var node = new Node(value, null);
        if (_tail is null)
            _head = _tail = node;
        else
        {
            _tail.Next = node;
            _tail = node;
        }
        Count++;
    }

    public void Reverse()
    {
        Node? prev = null;
        Node? current = _head;
        _tail = _head;
        while (current is not null)
        {
            Node? next = current.Next;
            current.Next = prev;
            prev = current;
            current = next;
        }
        _head = prev;
    }

    public IEnumerator<T> GetEnumerator()
    {
        for (Node? n = _head; n is not null; n = n.Next)
            yield return n.Value;
    }

    IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();

    private sealed class Node(T value, Node? next)
    {
        public T Value = value;
        public Node? Next = next;
    }
}
```

```text output
Trailhead -> Basecamp -> Ridge -> Summit
Summit -> Ridge -> Basecamp -> Trailhead
Summit -> Ridge -> Basecamp -> Trailhead -> Overlook
```

<figure class="diagram">
<svg viewBox="0 0 360 280" role="img" aria-labelledby="rev-title rev-desc">
<title id="rev-title">One step of reversing a list: A's next field flips from forward to backward</title>
<desc id="rev-desc">Before the step, node A points forward to node B, and a saved reference called next also points at B. After the step, A's next field points backward at P instead; B is no longer reachable through A, only through the saved next reference.</desc>
<defs>
<marker id="rev-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-accent"/></marker>
<marker id="rev-arrow-n" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-stroke"/></marker>
</defs>
<text x="20" y="20" class="d-bold">Before: current = A, next = B</text>
<rect x="20" y="30" width="50" height="36" class="d-box"/><text x="45" y="53" text-anchor="middle" class="d-mono d-muted">P</text>
<rect x="130" y="30" width="50" height="36" class="d-box-accent"/><text x="155" y="53" text-anchor="middle" class="d-mono d-bold">A</text>
<rect x="240" y="30" width="50" height="36" class="d-box"/><text x="265" y="53" text-anchor="middle" class="d-mono">B</text>
<path d="M180 48 H238" class="d-line" marker-end="url(#rev-arrow-n)"/>
<text x="20" y="90" class="d-small d-muted">A.Next still points forward, at B</text>
<text x="20" y="130" class="d-bold">After: A.Next = prev</text>
<rect x="20" y="140" width="50" height="36" class="d-box"/><text x="45" y="163" text-anchor="middle" class="d-mono d-muted">P</text>
<rect x="130" y="140" width="50" height="36" class="d-box-accent"/><text x="155" y="163" text-anchor="middle" class="d-mono d-bold">A</text>
<rect x="240" y="140" width="50" height="36" class="d-box"/><text x="265" y="163" text-anchor="middle" class="d-mono">B</text>
<path d="M128 158 H72" class="d-accent" marker-end="url(#rev-arrow)"/>
<text x="20" y="200" class="d-small d-text-accent">A now points backward, at P</text>
<text x="20" y="216" class="d-small d-muted">B is still reachable only because next</text>
<text x="20" y="232" class="d-small d-muted">was saved before this line ran</text>
<text x="20" y="260" class="d-small d-muted">Next step: prev = A, current = B</text>
</svg>
<figcaption>Figure 3. Reversing a list walks it once, flipping each node's next pointer to face backward. The saved next reference is what keeps the walk from losing the rest of the list.</figcaption>
</figure>

The loop touches every node exactly once and allocates nothing: O(*n*) time, O(1) extra space. `_tail = _head` before the loop is what keeps the list's own bookkeeping correct — the old head is the new tail — the same kind of field this article's first bug forgot to update.

::::exercise[Predict two edge cases]
Using the `SinglyLinkedList<T>` with `Reverse()` above: what does `Reverse()` do to an empty list, and to a list holding a single element? Predict `Count` and the contents in each case before checking.

:::solution
Both are handled without any special case, because the loop body simply does not run when `current` starts out `null` (empty list) or runs exactly once and leaves a one-node chain pointing at nothing (single element).

```csharp run id=ex-predict
using System.Collections;

var empty = new SinglyLinkedList<int>();
empty.Reverse();
Console.WriteLine($"empty:  Count={empty.Count}");

var single = new SinglyLinkedList<int>();
single.AddLast(42);
single.Reverse();
Console.WriteLine(
    $"single: Count={single.Count}, " +
    $"value={string.Join(",", single)}");

sealed class SinglyLinkedList<T> : IEnumerable<T>
{
    private Node? _head;
    private Node? _tail;
    public int Count { get; private set; }

    public void AddLast(T value)
    {
        var node = new Node(value, null);
        if (_tail is null)
            _head = _tail = node;
        else
        {
            _tail.Next = node;
            _tail = node;
        }
        Count++;
    }

    public void Reverse()
    {
        Node? prev = null;
        Node? current = _head;
        _tail = _head;
        while (current is not null)
        {
            Node? next = current.Next;
            current.Next = prev;
            prev = current;
            current = next;
        }
        _head = prev;
    }

    public IEnumerator<T> GetEnumerator()
    {
        for (Node? n = _head; n is not null; n = n.Next)
            yield return n.Value;
    }

    IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();

    private sealed class Node(T value, Node? next)
    {
        public T Value = value;
        public Node? Next = next;
    }
}
```

```text output
empty:  Count=0
single: Count=1, value=42
```
:::
::::

## What .NET actually ships: LinkedList\<T\>

[`LinkedList<T>`](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.linkedlist-1) is doubly linked, with `AddFirst`, `AddLast`, `AddBefore`, `AddAfter`, `Remove` and a `Find` that returns the `LinkedListNode<T>` itself so a program can hold onto it and act on it again later without searching twice. Microsoft's own guide to [selecting a collection class](https://learn.microsoft.com/en-us/dotnet/standard/collections/selecting-a-collection-class) singles it out as the type that "allows sequential access either from the head to the tail, or from the tail to the head" — the two directions this article built by hand above.

```csharp run id=builtin
var queue = new LinkedList<string>();
queue.AddLast("Alice");
LinkedListNode<string> bob = queue.AddLast("Bob");
queue.AddLast("Cara");
queue.AddBefore(bob, "Priya");

Console.WriteLine(string.Join(" ", queue));
Console.WriteLine($"First: {queue.First!.Value}, Last: {queue.Last!.Value}");
Console.WriteLine(
    $"bob.Previous: {bob.Previous!.Value}, " +
    $"first.Previous is null: {queue.First!.Previous is null}");

LinkedListNode<string>? found = queue.Find("Cara");
if (found is not null) queue.Remove(found);
Console.WriteLine(string.Join(" ", queue));
```

```text output
Alice Priya Bob Cara
First: Alice, Last: Cara
bob.Previous: Priya, first.Previous is null: True
Alice Priya Bob
```

:::dotnet
Internally, `LinkedList<T>` is circular: the [source](https://github.com/dotnet/runtime/blob/main/src/libraries/System.Collections/src/System/Collections/Generic/LinkedList.cs) links the last node's `next` back to the first node, the same trick this article's sentinel used, except here the real first node plays the sentinel's role instead of a dedicated empty one. None of that circularity is visible from outside: [`Previous`](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.linkedlistnode-1.previous) on the first node and `Next` on the last are documented to return `null`, exactly as if the list were not circular at all. It is an implementation detail, not a guarantee — the class documents O(1) insertion and removal, not how the nodes are wired to produce it.
:::

Removing a node you have not stored anywhere invalidates any enumeration in progress, the same way `List<T>` does. `LinkedList<T>` tracks its own version counter for the same reason:

```csharp run throws=InvalidOperationException
int[] values = [3, 8, 12, 15];
var numbers = new LinkedList<int>(values);
foreach (int n in numbers)
{
    if (n % 2 == 0)
        numbers.Remove(n);
}
```

One more documented limit: [`LinkedList<T>`](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.linkedlist-1) supports concurrent reads from multiple threads, but "the only multithreaded scenario supported... is multithreaded read operations" — any concurrent write needs external locking, the same as every other type in `System.Collections.Generic`.

## Two things worth measuring before you decide

### What a node costs beyond its value

Every node is a separate heap object, and every object carries fixed overhead — a method table pointer and a sync block, on top of its fields — that an array element sharing a block with its neighbors does not pay. [`GC.GetAllocatedBytesForCurrentThread`](https://learn.microsoft.com/en-us/dotnet/api/system.gc.getallocatedbytesforcurrentthread) reports the running total of bytes allocated on the current thread, so the difference across a loop is the loop's real allocation, independent of when the garbage collector happens to run. The three measurements in this section and the two that follow — node overhead, seek cost, and the LRU cache comparison — were all taken on .NET 10.0.12, Windows 11, x64, on a desktop Core i7-11700K.

```csharp run id=memory
long beforeArray = GC.GetAllocatedBytesForCurrentThread();
var array = new int[1_000_000];
for (int i = 0; i < array.Length; i++) array[i] = i;
long afterArray = GC.GetAllocatedBytesForCurrentThread();

long beforeNodes = GC.GetAllocatedBytesForCurrentThread();
IntNode? head = null;
for (int i = 0; i < 1_000_000; i++)
    head = new IntNode(i, head);
long afterNodes = GC.GetAllocatedBytesForCurrentThread();

Console.WriteLine(
    $"int[]:   {(afterArray - beforeArray) / 1_000_000.0,5:F1} bytes/element");
Console.WriteLine(
    $"IntNode: {(afterNodes - beforeNodes) / 1_000_000.0,5:F1} bytes/element");
Console.WriteLine($"head still reachable: {head is not null}");

sealed class IntNode(int value, IntNode? next)
{
    public int Value = value;
    public IntNode? Next = next;
}

```

```text output
int[]:     4.0 bytes/element
IntNode:  32.0 bytes/element
head still reachable: True
```

A million-element `int[]` pays a small, fixed overhead once, not per element: a 16-byte object header plus an 8-byte length field, 24 bytes total on this runtime. Measured directly the same way, around `new int[0]` and `new int[1000]`: the empty array allocates exactly 24 bytes, and the 1,000-element array allocates exactly 4,024 = 24 + 1,000 × 4. Spread across a million elements, that fixed 24 bytes disappears at one decimal place, which is why the array column above reads 4.0 — essentially just the four bytes each `int` itself occupies. Each `IntNode` pays a version of that same fixed cost on *every* element instead of once: a 16-byte object header, plus the 4-byte `int` and the 8-byte `Next` reference, padded to keep the object's size a multiple of eight bytes, comes to 32 bytes per node — eight times the array's per-element cost — and that ratio only gets worse for a doubly linked node, which pays for a second reference field. This is one run on one machine; the shape (array wins, by a wide and constant margin) is what to take from it, not the exact multiple.

### What "no index" really costs

`LinkedList<T>` has no indexer at all, so getting to a position means walking from `First`. The next program times exactly that walk against a `List<T>`'s direct index, for the middle element of lists of growing size.

```csharp run id=seek
#:property Optimize=true
using System.Diagnostics;
using System.Globalization;

CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;

int[] sizes = [1_000, 10_000, 100_000, 1_000_000];
Console.WriteLine("        n  array ns  linked ns");
foreach (int n in sizes)
{
    var array = new int[n];
    var linked = new LinkedList<int>();
    for (int i = 0; i < n; i++)
    {
        array[i] = i;
        linked.AddLast(i);
    }
    int mid = n / 2;
    int reps = Math.Max(3, 200_000 / n);

    double arrayNs = TimeOp(() => array[mid], reps);
    double linkedNs = TimeOp(() => SeekTo(linked, mid), reps);
    Console.WriteLine(
        $"{n,9:N0}{arrayNs,10:F1}{linkedNs,11:F1}");
}

static int SeekTo(LinkedList<int> list, int index)
{
    LinkedListNode<int> node = list.First!;
    for (int i = 0; i < index; i++)
        node = node.Next!;
    return node.Value;
}

static double TimeOp(Func<int> op, int reps)
{
    op(); // warm-up
    double best = double.MaxValue;
    for (int run = 0; run < 5; run++)
    {
        long start = Stopwatch.GetTimestamp();
        for (int i = 0; i < reps; i++) op();
        double ns = Stopwatch.GetElapsedTime(start)
            .TotalNanoseconds;
        best = Math.Min(best, ns / reps);
    }
    return best;
}
```

```text output
        n  array ns  linked ns
    1,000[...]
   10,000[...]
  100,000[...]
1,000,000[...]
```

The array column stays flat: one bounds check and one address computation, regardless of *n*. The linked column grows with *n*, because reaching the middle means following half of the list's node references one at a time, and each one lands on a different, unrelated heap allocation. Ulrich Drepper's paper [*What Every Programmer Should Know About Memory*](https://lwn.net/Articles/255364/) explains why that specific pattern is the worst case for hardware, not just an inconvenience: a CPU's prefetcher "cannot cross page boundaries" and current units "do not recognize non-linear access patterns", so a chain of pointers scattered across the heap gets none of the automatic read-ahead that a straight array scan gets for free.

:::warning[Big-O said O(1) node access and O(n) node search — both are true, and neither is the whole story]
"O(1) insertion given a node" and "no O(1) index" are both exactly correct and both stated in the docs cited above. What they leave out is that most code does not walk in to a `LinkedListNode<T>` for free — it has to get there first, by `Find`, by an index-like walk, or by keeping the node reference around from when it was created. The LRU cache built next is the one case where a program legitimately keeps that reference, and that is exactly why it is fast.
:::

## Where the pointers pay for themselves: an LRU cache

A least-recently-used cache evicts whatever it has not touched in the longest time once it reaches capacity. That needs two things done together, fast: find an entry by key, and move whatever was just touched to the "most recent" end. A `Dictionary<TKey, TValue>` alone gives you the first; nothing about a dictionary gives you an order. Pairing it with a `LinkedList<T>` gives you both, because the dictionary's values are not the cached data — they are the `LinkedListNode<T>` for each key, so touching an entry is `Remove(node)` followed by `AddFirst(node)`, reusing the same node object. The `LinkedList<T>` class remarks say this directly: "You can remove nodes and reinsert them, either in the same list or in another list, which results in no additional objects allocated on the heap."

```csharp run id=lru
var cache = new LruCache<string, int>(capacity: 3);
cache.Put("a", 1);
cache.Put("b", 2);
cache.Put("c", 3);
Console.WriteLine(cache.TryGet("a", out int a) ? $"a={a}" : "a=miss");

cache.Put("d", 4); // evicts the least recently used: b
Console.WriteLine(cache.TryGet("b", out int b) ? $"b={b}" : "b=miss");
Console.WriteLine(cache.TryGet("d", out int d) ? $"d={d}" : "d=miss");

cache.Put("a", 10); // updates the existing key, moves it to the front
Console.WriteLine(cache.TryGet("a", out int a2) ? $"a={a2}" : "a=miss");

sealed class LruCache<TKey, TValue> where TKey : notnull
{
    private readonly int _capacity;
    private readonly LinkedList<(TKey Key, TValue Value)> _order = new();
    private readonly Dictionary<
        TKey, LinkedListNode<(TKey Key, TValue Value)>> _index = new();

    public LruCache(int capacity)
    {
        if (capacity <= 0)
            throw new ArgumentOutOfRangeException(nameof(capacity));
        _capacity = capacity;
    }

    public bool TryGet(TKey key, out TValue value)
    {
        if (_index.TryGetValue(key, out var node))
        {
            _order.Remove(node);
            _order.AddFirst(node);
            value = node.Value.Value;
            return true;
        }
        value = default!;
        return false;
    }

    public void Put(TKey key, TValue value)
    {
        if (_index.TryGetValue(key, out var existing))
        {
            _order.Remove(existing);
            _index.Remove(key);
        }
        else if (_index.Count == _capacity)
        {
            var lru = _order.Last!;
            _order.RemoveLast();
            _index.Remove(lru.Value.Key);
        }
        _index[key] = _order.AddFirst((key, value));
    }
}
```

```text output
a=1
b=miss
d=4
a=10
```

Every step in `TryGet` and `Put` is O(1): the dictionary lookup is [expected O(1)](/glossary/#hash-table), and [`Remove(node)`](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.linkedlist-1.remove), [`AddFirst(node)`](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.linkedlist-1.addfirst) and `RemoveLast` are each documented as O(1) — because the node reference always comes from the dictionary, never from a search. This is the case the earlier warning called out: the program holds the node already, so the O(1) column is the one that applies.

::::exercise[Extend LruCache with an explicit Remove]
Add a `bool Remove(TKey key)` method that deletes an entry before it would naturally be evicted, returning whether it was present. Reuse the same node reference from `_index` rather than searching `_order` again.

:::solution
```csharp run id=ex-lru-remove
var cache = new LruCache<string, int>(capacity: 3);
cache.Put("a", 1);
cache.Put("b", 2);
Console.WriteLine($"removed a: {cache.Remove("a")}");
Console.WriteLine($"removed a again: {cache.Remove("a")}");
Console.WriteLine(cache.TryGet("a", out _) ? "a still there" : "a gone");
Console.WriteLine(cache.TryGet("b", out int b) ? $"b={b}" : "b=miss");

sealed class LruCache<TKey, TValue> where TKey : notnull
{
    private readonly int _capacity;
    private readonly LinkedList<(TKey Key, TValue Value)> _order = new();
    private readonly Dictionary<
        TKey, LinkedListNode<(TKey Key, TValue Value)>> _index = new();

    public LruCache(int capacity)
    {
        if (capacity <= 0)
            throw new ArgumentOutOfRangeException(nameof(capacity));
        _capacity = capacity;
    }

    public bool TryGet(TKey key, out TValue value)
    {
        if (_index.TryGetValue(key, out var node))
        {
            _order.Remove(node);
            _order.AddFirst(node);
            value = node.Value.Value;
            return true;
        }
        value = default!;
        return false;
    }

    public void Put(TKey key, TValue value)
    {
        if (_index.TryGetValue(key, out var existing))
        {
            _order.Remove(existing);
            _index.Remove(key);
        }
        else if (_index.Count == _capacity)
        {
            var lru = _order.Last!;
            _order.RemoveLast();
            _index.Remove(lru.Value.Key);
        }
        _index[key] = _order.AddFirst((key, value));
    }

    public bool Remove(TKey key)
    {
        if (!_index.TryGetValue(key, out var node)) return false;
        _order.Remove(node);
        _index.Remove(key);
        return true;
    }
}
```

```text output
removed a: True
removed a again: False
a gone
b=2
```
:::
::::

::::exercise[Measure the naive alternative]
Write `NaiveLruCache<TKey, TValue>` backed by a plain `List<(TKey, TValue)>`: touching an entry means `FindIndex` followed by `RemoveAt` and `Insert(0, ...)`. Run the same sequence of `Get`/`Put` calls through both caches and time them.

:::solution
```csharp run id=ex-lru-measure
#:property Optimize=true
using System.Diagnostics;
using System.Globalization;

CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;

const int capacity = 200;
const int operations = 20_000;
var rng = new Random(7);
int[] keys = new int[operations];
for (int i = 0; i < operations; i++) keys[i] = rng.Next(0, capacity * 3);

double naiveMs = Time(() =>
{
    var cache = new NaiveLruCache<int, int>(capacity);
    foreach (int k in keys)
        if (!cache.TryGet(k, out _)) cache.Put(k, k);
});

double realMs = Time(() =>
{
    var cache = new LruCache<int, int>(capacity);
    foreach (int k in keys)
        if (!cache.TryGet(k, out _)) cache.Put(k, k);
});

Console.WriteLine($"{operations:N0} ops, capacity {capacity}");
Console.WriteLine($"List<T> version:        {naiveMs,7:F1} ms");
Console.WriteLine($"LinkedList<T>+Dict:      {realMs,7:F1} ms");

static double Time(Action work)
{
    work(); // warm-up
    double best = double.MaxValue;
    for (int run = 0; run < 3; run++)
    {
        long start = Stopwatch.GetTimestamp();
        work();
        double ms = Stopwatch.GetElapsedTime(start)
            .TotalMilliseconds;
        best = Math.Min(best, ms);
    }
    return best;
}

sealed class NaiveLruCache<TKey, TValue> where TKey : notnull
{
    private readonly int _capacity;
    private readonly List<(TKey Key, TValue Value)> _order = [];

    public NaiveLruCache(int capacity) => _capacity = capacity;

    public bool TryGet(TKey key, out TValue value)
    {
        int i = _order.FindIndex(e =>
            EqualityComparer<TKey>.Default.Equals(e.Key, key));
        if (i < 0) { value = default!; return false; }
        var entry = _order[i];
        _order.RemoveAt(i);
        _order.Insert(0, entry);
        value = entry.Value;
        return true;
    }

    public void Put(TKey key, TValue value)
    {
        int i = _order.FindIndex(e =>
            EqualityComparer<TKey>.Default.Equals(e.Key, key));
        if (i >= 0) _order.RemoveAt(i);
        else if (_order.Count == _capacity) _order.RemoveAt(_order.Count - 1);
        _order.Insert(0, (key, value));
    }
}

sealed class LruCache<TKey, TValue> where TKey : notnull
{
    private readonly int _capacity;
    private readonly LinkedList<(TKey Key, TValue Value)> _order = new();
    private readonly Dictionary<
        TKey, LinkedListNode<(TKey Key, TValue Value)>> _index = new();

    public LruCache(int capacity) => _capacity = capacity;

    public bool TryGet(TKey key, out TValue value)
    {
        if (_index.TryGetValue(key, out var node))
        {
            _order.Remove(node);
            _order.AddFirst(node);
            value = node.Value.Value;
            return true;
        }
        value = default!;
        return false;
    }

    public void Put(TKey key, TValue value)
    {
        if (_index.TryGetValue(key, out var existing))
        {
            _order.Remove(existing);
            _index.Remove(key);
        }
        else if (_index.Count == _capacity)
        {
            var lru = _order.Last!;
            _order.RemoveLast();
            _index.Remove(lru.Value.Key);
        }
        _index[key] = _order.AddFirst((key, value));
    }
}
```

```text output
20,000 ops, capacity 200
List<T> version:        [...] ms
LinkedList<T>+Dict:      [...] ms
```

Both caches do the same 20,000 operations in the same order, so the difference is entirely the cost of `FindIndex` (a linear scan of up to 200 entries, on almost every call) against a dictionary lookup and a node splice. This is the shape of workload — many touches, a working set that does not fit conveniently in an array's front slots — where the extra pointers earn their keep.
:::
::::

## Deciding when to reach for a linked list

The measurements above are consistent with each other, not contradictory: arrays and `List<T>` win on raw access and traversal because their elements share memory and an index is arithmetic; a linked list wins only in the specific case where a program already holds the node it needs to change, and needs to change it — insert, remove, or reorder — without touching anything else in the sequence.

- **Reading, or building once and reading many times:** `T[]` or `List<T>`. Contiguous memory wins every measurement above.
- **Frequent insert/remove at a position found by index or by value:** still `List<T>` for most sizes; a linear search plus a shift is not meaningfully worse than a linear walk plus a splice, and the array version has far less per-element overhead.
- **Frequent insert/remove at a position you reach by an existing node handle, not a search:** `LinkedList<T>`, paired with a `Dictionary<TKey, LinkedListNode<T>>` when that handle needs to be looked up by key, exactly as the LRU cache above does.
- **A queue or stack of unknown, possibly large size:** `Queue<T>` or `Stack<T>`, both array-backed; reach for a linked structure only if you specifically need to splice nodes between two different lists without copying, which those types do not support.

One more shape is worth naming without building it here: an **intrusive list**, where the `Next`/`Prev` fields live directly on the object being listed rather than in a separate wrapper node. It avoids one allocation per entry and lets the same object belong to a list without the list "owning" it, at the cost of that object being able to sit in only one such list at a time (or needing one pair of fields per list it can join). It is a specialized technique for tight, low-allocation code, not a general replacement for `LinkedList<T>`.
