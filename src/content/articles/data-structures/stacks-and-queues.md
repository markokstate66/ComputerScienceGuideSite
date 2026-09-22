---
title: "Stacks, Queues and Deques, with Real Uses"
description: "Fix a bracket checker with a stack, build a ring-buffer queue with real head/tail wraparound, and see what .NET's Stack<T> and Queue<T> actually do inside."
pillar: data-structures
order: 3
author: markus
published: 2026-09-22
updated: 2026-09-22
level: intermediate
tags: [stack, queue, deque, circular-buffer, monotonic-stack]
prerequisites: ["data-structures/arrays-and-dynamic-arrays"]
sources:
  - title: "Stack<T> Class"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.stack-1"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Queue<T> Class"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.queue-1"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "System.Collections.Generic Namespace"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Stack.cs (System.Collections), dotnet/runtime main branch"
    url: "https://github.com/dotnet/runtime/blob/main/src/libraries/System.Collections/src/System/Collections/Generic/Stack.cs"
    publisher: "GitHub, dotnet/runtime"
    accessed: 2026-09-22
  - title: "Queue.cs (System.Private.CoreLib), dotnet/runtime main branch"
    url: "https://github.com/dotnet/runtime/blob/main/src/libraries/System.Private.CoreLib/src/System/Collections/Generic/Queue.cs"
    publisher: "GitHub, dotnet/runtime"
    accessed: 2026-09-22
  - title: "List<T>.RemoveAt(Int32) Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.list-1.removeat"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Algorithms, 4th edition, section 1.3 (Stacks and Queues)"
    url: "https://algs4.cs.princeton.edu/13stacks/"
    publisher: "Robert Sedgewick and Kevin Wayne, Princeton University"
    accessed: 2026-09-22
  - title: "Stack / queue modifications (minimum stack, monotonic deque)"
    url: "https://cp-algorithms.com/data_structures/stack_queue_modification.html"
    publisher: "cp-algorithms.com"
    accessed: 2026-09-22
draft: true
---

A configuration parser reports a file as well-formed when it is not. Its bracket checker counts opening and closing brackets and calls the text balanced when the two counts agree — but `([)]` has two of each in the wrong order, and the check waves it through. Getting the *order* right, not just the count, is exactly what a [stack](/glossary/#abstract-data-type) buys you, and it is the cleanest way into two structures that agree on almost nothing except that code reaches for them constantly: a stack undoes the most recent action first, a queue serves the oldest request first, and .NET ships a real, inspectable implementation of each.

## A checker that agrees when it should not

The programs on this page compile and run with .NET 10 (runtime 10.0.12) on Windows 11, x64. Here is the buggy checker, tried against three strings, only one of which is actually balanced:

```csharp run id=naive-check
string[] samples = ["(a[b]{c})", "([)]", "(a[b)]"];
foreach (var s in samples)
    Console.WriteLine(
        $"{s,-10} counts equal? {CountsMatch(s)}");

static bool CountsMatch(string text)
{
    int opens = 0, closes = 0;
    foreach (char c in text)
    {
        if (c is '(' or '[' or '{') opens++;
        if (c is ')' or ']' or '}') closes++;
    }
    return opens == closes;
}
```

```text output
(a[b]{c})  counts equal? True
([)]       counts equal? True
(a[b)]     counts equal? True
```

All three read `True`. The first one should; the other two are not balanced — `([)]` closes the `(` before the `[` that opened after it, and `(a[b)]` closes the `(` while a `[` is still open. Counting brackets throws away the one fact that matters: which bracket a given close is allowed to match, which is always the *most recently opened one still unclosed*. That is a last-in-first-out rule, so a stack enforces it directly: push every opener, and on a closer, the top of the stack must be its partner.

```csharp run id=bracket-matcher
string[] samples =
    ["(a[b]{c})", "([)]", "(a[b)]", "(a", "a)"];
foreach (var s in samples)
    Console.WriteLine($"{s,-10} balanced? {IsBalanced(s)}");

static bool IsBalanced(string text)
{
    var open = new Stack<char>();
    var pairs = new Dictionary<char, char>
    {
        [')'] = '(', [']'] = '[', ['}'] = '{',
    };
    foreach (char c in text)
    {
        if (c is '(' or '[' or '{')
        {
            open.Push(c);
        }
        else if (pairs.TryGetValue(c, out char match))
        {
            if (open.Count == 0 || open.Pop() != match)
                return false;
        }
    }
    return open.Count == 0;
}
```

```text output
(a[b]{c})  balanced? True
([)]       balanced? False
(a[b)]     balanced? False
(a         balanced? False
a)         balanced? False
```

`open.Count == 0` on a closer catches `a)`, a close with nothing to match. The `open.Count == 0` at the end catches `(a`, an opener that never got closed. Both are the same check — has the stack been fully drained — asked at two different moments.

## The stack: last in, first out

A stack is an [abstract data type](/glossary/#abstract-data-type): a contract stated in terms of operations, not storage. Three operations define it: `Push(item)` adds an element, `Pop()` removes and returns the most recently pushed element that is still present, and `Peek()` returns that same element without removing it. Whatever holds the elements, the guarantee is that `Pop` always answers "last in, first out" (LIFO).

The bracket checker is one use. A more pervasive one runs under every program without being asked for: the [call stack](/glossary/#call-stack). Each method call pushes a frame holding its arguments, locals and return address; returning pops it. Nested calls therefore unwind in the reverse of the order they were entered, which is visible just by printing on the way in and the way out:

```csharp run id=call-stack-order
Visit(1);

static void Visit(int level)
{
    if (level > 3) return;
    Console.WriteLine($"enter {level}");
    Visit(level + 1);
    Console.WriteLine($"leave {level}");
}
```

```text output
enter 1
enter 2
enter 3
leave 3
leave 2
leave 1
```

`Visit(4)` is never entered because the guard returns first, so only three `enter`/`leave` pairs print. Level 3 is the last one entered and the first one to leave — the runtime's call stack, not a data structure the program built itself, but the same LIFO discipline.

<figure class="diagram">
<svg viewBox="0 0 360 320" role="img" aria-labelledby="callstack-title callstack-desc">
<title id="callstack-title">Four call frames stacked while Visit(3) is running</title>
<desc id="callstack-desc">Three frames stacked vertically, Visit(1) at the bottom and Visit(3) at the top, each labelled with the order it was pushed. A note beneath explains that returning pops them top to bottom, the reverse of the push order.</desc>
<defs>
<marker id="callstack-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-accent"/></marker>
</defs>
<text x="20" y="20" class="d-bold">Frames while Visit(3) runs</text>
<rect x="70" y="34" width="220" height="50" class="d-box-accent"/>
<text x="180" y="55" text-anchor="middle" class="d-mono d-bold">Visit(3)</text>
<text x="180" y="72" text-anchor="middle" class="d-small d-text-accent">top of stack, pushed 3rd</text>
<rect x="70" y="96" width="220" height="50" class="d-box"/>
<text x="180" y="117" text-anchor="middle" class="d-mono">Visit(2)</text>
<text x="180" y="134" text-anchor="middle" class="d-small d-muted">pushed 2nd</text>
<rect x="70" y="158" width="220" height="50" class="d-box"/>
<text x="180" y="179" text-anchor="middle" class="d-mono">Visit(1)</text>
<text x="180" y="196" text-anchor="middle" class="d-small d-muted">pushed 1st, bottom of stack</text>
<path d="M50 218 V44" class="d-accent" marker-end="url(#callstack-arrow)"/>
<text x="30" y="230" class="d-small d-text-accent">push</text>
<text x="20" y="250" class="d-small d-muted">Visit(3) returns, then Visit(2), then Visit(1):</text>
<text x="20" y="268" class="d-mono d-small">leave 3 -&gt; leave 2 -&gt; leave 1</text>
<text x="20" y="296" class="d-small d-muted">Pop order is the reverse of push order.</text>
</svg>
<figcaption>Figure 1. Each call pushes a frame on top of the last one; each return pops the top frame. The runtime never needs to search for the right frame to remove — it is always the one on top.</figcaption>
</figure>

## One end only: array-backed or linked

A stack's operations only ever touch one end, so the shifting that made inserting at the front of a growable array expensive elsewhere does not apply here: `Push` and `Pop` work at the same end every time, and neither has to move any other element to make room.

An array-backed stack keeps its elements packed from index 0 up, exactly like a growable array elsewhere on this site: when the backing array is full, allocate a bigger one — usually double the size — and copy across. A linked-node stack instead allocates one small object per element and links each new node to the previous top, so `Push` and `Pop` are O(1) worst case, never O(*n*), because there is no doubling pause; the price is an extra reference per element, a separate heap allocation for each one, and no contiguous memory to walk quickly. [Sedgewick and Wayne's *Algorithms*](https://algs4.cs.princeton.edu/13stacks/) walks through both implementations side by side for exactly this reason: the array and linked-list versions of a stack (and a queue) make the same underlying tradeoff.

General-purpose libraries mostly pick the array, because a doubling pause that happens once every few thousand pushes on average costs less overall than an allocation on every single one. .NET's own `Stack<T>` is one of them — the section on what it does inside makes that concrete.

## A List&lt;T&gt; makes a slow queue

A stack undoes the most recent action; a queue serves requests in the order they arrived, first in, first out (FIFO). The obvious way to build one from a `List<T>` is `Add` at the end and `RemoveAt(0)` at the front. It works. It is also quietly quadratic: [`RemoveAt`](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.list-1.removeat) is documented as O(*n*) where *n* is the number of elements after the removed index, and removing index 0 means *every remaining element* is that count — the whole list shifts left by one slot on every single dequeue.

```csharp run id=list-queue-timing
#:property Optimize=true
using System.Diagnostics;
using System.Globalization;

CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;

int[] sizes = [5_000, 10_000, 20_000, 40_000];
Console.WriteLine("     n  ListQueue ms  Queue<T> ms");
foreach (int n in sizes)
{
    double listMs = Time(() => ListQueueWork(n));
    double queueMs = Time(() => QueueWork(n));
    Console.WriteLine(
        $"{n,6}{listMs,14:F1}{queueMs,13:F3}");
}

static void ListQueueWork(int n)
{
    var q = new List<int>();
    for (int i = 0; i < n; i++) q.Add(i);
    while (q.Count > 0) q.RemoveAt(0);
}

static void QueueWork(int n)
{
    var q = new Queue<int>();
    for (int i = 0; i < n; i++) q.Enqueue(i);
    while (q.Count > 0) q.Dequeue();
}

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
```

```text output
     n  ListQueue ms  Queue<T> ms
  5000  [...]
 10000  [...]
 20000  [...]
 40000  [...]
```

The exact milliseconds vary by run, so the panel above shows only the shape; here is one run's real numbers, filling *n* and then fully draining it:

| n | ListQueue ms | Queue&lt;T&gt; ms |
|---:|---:|---:|
| 5,000 | 9.6 | 0.058 |
| 10,000 | 44.4 | 0.083 |
| 20,000 | 215.6 | 0.151 |
| 40,000 | 796.5 | 0.162 |

Every doubling of *n* multiplies the `List<T>` column by roughly four — the signature of Θ(*n*²) — while `Queue<T>` barely moves. Something in `Queue<T>` avoids the shift entirely, and the next two sections build it and then find it.

## Building a ring buffer that actually wraps

A queue only ever adds at one end and removes at the other, so the fix is to stop treating "remove the front" as "close the gap." Instead, keep two positions into a fixed backing array — `head`, the oldest live element, and a count of how many elements are live — and move `head` forward on every dequeue instead of shifting everything else backward. The array does not grow toward one end and shrink toward the other; positions past the end simply continue from index 0. That is a ring buffer, and the part every tutorial glosses over is what happens the moment `head` has moved partway down the array and a new element still needs to go in *after* the last one, which by now sits behind `head` in memory rather than in front of it.

```csharp run id=ring-queue
var q = new RingQueue<string>(4);
Print("new ", q);
q.Enqueue("A"); Print("+A  ", q);
q.Enqueue("B"); Print("+B  ", q);
q.Enqueue("C"); Print("+C  ", q);
q.Enqueue("D"); Print("+D  ", q);
Console.WriteLine($"-A  -> {q.Dequeue()}");
Print("    ", q);
Console.WriteLine($"-B  -> {q.Dequeue()}");
Print("    ", q);
q.Enqueue("E"); Print("+E  ", q);
q.Enqueue("F"); Print("+F  ", q);
q.Enqueue("G"); Print("+G  ", q);
Console.WriteLine($"contents: {string.Join(' ', q)}");

static void Print(string label, RingQueue<string> q) =>
    Console.WriteLine($"{label}{q.Row()}");

sealed class RingQueue<T> : IEnumerable<T>
{
    private T?[] _items;
    private int _head;
    private int _count;

    public RingQueue(int capacity) => _items = new T?[capacity];

    public int Count => _count;
    public int Capacity => _items.Length;

    public void Enqueue(T item)
    {
        if (_count == _items.Length) Grow();
        int tail = (_head + _count) % _items.Length;
        _items[tail] = item;
        _count++;
    }

    public T Dequeue()
    {
        if (_count == 0)
            throw new InvalidOperationException("empty");
        T item = _items[_head]!;
        _items[_head] = default;
        _head = (_head + 1) % _items.Length;
        _count--;
        return item;
    }

    private void Grow()
    {
        var bigger = new T?[
            _items.Length == 0 ? 4 : _items.Length * 2];
        for (int i = 0; i < _count; i++)
            bigger[i] = _items[(_head + i) % _items.Length];
        _items = bigger;
        _head = 0;
    }

    // Debug view only: every physical slot, '.' for unused.
    public string Row()
    {
        var cells = new string[_items.Length];
        for (int i = 0; i < _items.Length; i++)
            cells[i] = _items[i] is null
                ? "." : _items[i]!.ToString()!;
        return string.Join(' ', cells) +
            $"  h={_head} cap={_items.Length}";
    }

    public IEnumerator<T> GetEnumerator()
    {
        for (int i = 0; i < _count; i++)
            yield return _items[(_head + i) % _items.Length]!;
    }
    System.Collections.IEnumerator System.Collections.IEnumerable.GetEnumerator() => GetEnumerator();
}
```

```text output
new . . . .  h=0 cap=4
+A  A . . .  h=0 cap=4
+B  A B . .  h=0 cap=4
+C  A B C .  h=0 cap=4
+D  A B C D  h=0 cap=4
-A  -> A
    . B C D  h=1 cap=4
-B  -> B
    . . C D  h=2 cap=4
+E  E . C D  h=2 cap=4
+F  E F C D  h=2 cap=4
+G  C D E F G . . .  h=0 cap=8
contents: C D E F G
```

Follow the `+E` line. After the two dequeues, `head` is 2 and `count` is 2, so `Enqueue` computes `tail = (2 + 2) mod 4 = 0`: E is written into slot 0, the slot A used to occupy, even though slot 0 sits *before* slot 2 when you read the array left to right. The modulo is what makes "after slot 3" mean "slot 0" instead of running off the array. `F` follows the same rule into slot 1, and the buffer is full again — four live elements in four slots, with neither `head` nor the logical front of the queue anywhere near index 0.

<figure class="diagram">
<svg viewBox="0 0 360 260" role="img" aria-labelledby="ringbuf-title ringbuf-desc">
<title id="ringbuf-title">Enqueueing into a full ring buffer wraps the tail back to slot 0</title>
<desc id="ringbuf-desc">Two rows of four slots. Before: slots 0 and 1 are empty, slot 2 holds C and is marked as the head, slot 3 holds D. After enqueuing E, slot 0 holds E while the head marker stays at slot 2, because the tail wrapped from past slot 3 back to slot 0.</desc>
<rect x="20" y="30" width="68" height="44" class="d-box-2 d-dashed"/>
<rect x="98" y="30" width="68" height="44" class="d-box-2 d-dashed"/>
<rect x="176" y="30" width="68" height="44" class="d-box-accent"/>
<text x="210" y="58" text-anchor="middle" class="d-mono d-bold">C</text>
<rect x="254" y="30" width="68" height="44" class="d-box"/>
<text x="288" y="58" text-anchor="middle" class="d-mono">D</text>
<text x="54" y="90" text-anchor="middle" class="d-mono d-small d-muted">[0]</text>
<text x="132" y="90" text-anchor="middle" class="d-mono d-small d-muted">[1]</text>
<text x="210" y="90" text-anchor="middle" class="d-mono d-small d-text-accent">[2] head</text>
<text x="288" y="90" text-anchor="middle" class="d-mono d-small d-muted">[3]</text>
<text x="20" y="118" class="d-bold">Before: head=2, count=2</text>
<rect x="20" y="148" width="68" height="44" class="d-box-warn"/>
<text x="54" y="176" text-anchor="middle" class="d-mono d-bold">E</text>
<rect x="98" y="148" width="68" height="44" class="d-box-2 d-dashed"/>
<rect x="176" y="148" width="68" height="44" class="d-box-accent"/>
<text x="210" y="176" text-anchor="middle" class="d-mono d-bold">C</text>
<rect x="254" y="148" width="68" height="44" class="d-box"/>
<text x="288" y="176" text-anchor="middle" class="d-mono">D</text>
<text x="54" y="208" text-anchor="middle" class="d-mono d-small">[0]</text>
<text x="132" y="208" text-anchor="middle" class="d-mono d-small d-muted">[1]</text>
<text x="210" y="208" text-anchor="middle" class="d-mono d-small d-text-accent">[2] head</text>
<text x="288" y="208" text-anchor="middle" class="d-mono d-small d-muted">[3]</text>
<text x="20" y="236" class="d-bold">Enqueue(E): tail=(2+2) mod 4=0</text>
</svg>
<figcaption>Figure 2. Enqueue writes at (head + count) mod capacity. The new element lands at slot 0, physically ahead of the head pointer in the array, but still logically last because count says how many slots starting at head are live.</figcaption>
</figure>

The last line shows the other half: `Enqueue(G)` arrives with the array full (`count == capacity`), so `Grow` allocates an eight-slot array and copies the four live elements out starting from `head`, in logical order, resetting `head` to 0. The physical scramble across slots 0–3 is gone; `C D E F G` reads correctly left to right because `Grow` walked the elements in queue order, not array order, while copying.

::::exercise[Find the bug in a two-index ring buffer]
This queue tracks only `_head` and `_tail`, with no `_count`, and treats `_head == _tail` as "empty" — a common shortcut. Capacity is 4. What does the program below print, and why is it wrong?

```csharp run id=ex-broken-ring
var q = new BrokenRingQueue<int>(4);
for (int i = 1; i <= 4; i++) q.Enqueue(i);
Console.WriteLine($"IsEmpty: {q.IsEmpty}");
q.Enqueue(5);
Console.WriteLine("draining:");
while (!q.IsEmpty)
    Console.WriteLine(q.Dequeue());

sealed class BrokenRingQueue<T>
{
    private readonly T?[] _items;
    private int _head;
    private int _tail;

    public BrokenRingQueue(int capacity) =>
        _items = new T?[capacity];

    public bool IsEmpty => _head == _tail;

    public void Enqueue(T item)
    {
        _items[_tail] = item;
        _tail = (_tail + 1) % _items.Length;
    }

    public T Dequeue()
    {
        T item = _items[_head]!;
        _head = (_head + 1) % _items.Length;
        return item;
    }
}
```

:::solution
```text output
IsEmpty: True
draining:
5
```

After four enqueues into a capacity-4 buffer, `_tail` has wrapped all the way around to 0, which is exactly where `_head` still is. `IsEmpty` reports `true` for a completely full buffer — the two states are indistinguishable when the only evidence is `head == tail`. The caller trusts `IsEmpty`, calls `Enqueue(5)` anyway, and it silently overwrites slot 0 (which held `1`, never read). The drain loop then reads back only `5`; items `2`, `3` and `4` are still sitting in the array with nothing that will ever report them.

`RingQueue<T>` above avoids this by tracking `_count` directly: "full" is `_count == _items.Length` and "empty" is `_count == 0`, two different, unambiguous conditions. The other standard fix, if you want to keep only two indices, is to always leave one slot permanently unused, so a full buffer is `(tail + 1) % capacity == head` and can never collide with empty — at the cost of one wasted slot.
:::
::::

## The other end: turning the ring buffer into a deque

A double-ended queue (deque) adds `AddFirst`/`RemoveFirst` to the queue's `AddLast`/`RemoveFirst`, so either end can grow or shrink. As of this writing, [`System.Collections.Generic`](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic) has no public `Deque<T>`: the namespace lists `List<T>`, `LinkedList<T>`, `Stack<T>`, `Queue<T>`, `PriorityQueue<TElement,TPriority>` and the rest, and a double-ended queue is not among them. A `List<T>` can stand in, but `Insert(0, x)` and `RemoveAt(0)` are exactly the O(*n*) shifts from the section above — a `List<T>` deque is a slow deque.

Extending `RingQueue<T>` costs one method. Adding at the front means moving `head` backward instead of forward, with the same wraparound arithmetic pointed the other way:

::::exercise[Extend RingQueue into a deque]
Add an `AddFirst(T item)` method to `RingQueue<T>` (renaming it, if you like) that inserts before the current head, growing the array first if it is full. Use it to build `["A", "B", "C", "D"]` by adding `"B"` and `"C"` at the back and `"A"` at the front, then force a resize by adding one more element at the front.

:::solution
```csharp run id=ex-deque
var d = new RingDeque<string>(4);
d.AddLast("B");
d.AddLast("C");
d.AddFirst("A");
d.AddLast("D");
Console.WriteLine(string.Join(' ', d));
d.AddFirst("Z"); // count == capacity: forces growth
Console.WriteLine(string.Join(' ', d));

sealed class RingDeque<T> : IEnumerable<T>
{
    private T?[] _items;
    private int _head;
    private int _count;

    public RingDeque(int capacity) => _items = new T?[capacity];

    public void AddLast(T item)
    {
        if (_count == _items.Length) Grow();
        int tail = (_head + _count) % _items.Length;
        _items[tail] = item;
        _count++;
    }

    public void AddFirst(T item)
    {
        if (_count == _items.Length) Grow();
        _head = (_head - 1 + _items.Length) % _items.Length;
        _items[_head] = item;
        _count++;
    }

    private void Grow()
    {
        var bigger = new T?[
            _items.Length == 0 ? 4 : _items.Length * 2];
        for (int i = 0; i < _count; i++)
            bigger[i] = _items[(_head + i) % _items.Length];
        _items = bigger;
        _head = 0;
    }

    public IEnumerator<T> GetEnumerator()
    {
        for (int i = 0; i < _count; i++)
            yield return _items[(_head + i) % _items.Length]!;
    }
    System.Collections.IEnumerator System.Collections.IEnumerable.GetEnumerator() => GetEnumerator();
}
```

```text output
A B C D
Z A B C D
```

`AddFirst` subtracts one from `_head` and adds `_items.Length` before taking the remainder, because C#'s `%` can return a negative result for a negative left operand and an index must never be negative. The rest — growth, the enumerator walking `count` slots starting at `head` — is unchanged from `RingQueue<T>`; a deque is a queue that can also write behind its own head.
:::
::::

## What Stack&lt;T&gt; and Queue&lt;T&gt; really do inside

Both mechanisms above are not just a teaching device. .NET's documentation says outright what each collection is: [`Stack<T>`'s page](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.stack-1) states "`Stack<T>` is implemented as an array," and [`Queue<T>`'s page](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.queue-1) states "this class implements a generic queue as a circular array." The two collections that look like siblings from their APIs are, underneath, exactly the two structures built above.

In the runtime source, [`Stack.cs`](https://github.com/dotnet/runtime/blob/main/src/libraries/System.Collections/src/System/Collections/Generic/Stack.cs) keeps a `T[] _array` and an `int _size`; `Push` writes `_array[_size++]` when there is room and otherwise calls `PushWithResize`, which doubles the array — the same growth policy the [amortized analysis of `List<T>.Add`](/complexity/amortized-analysis/) covers in detail. `Pop` just reads `_array[--_size]` and clears the slot if `T` holds references, so it needs no wraparound at all: the "moving end" of a stack is always index `_size`, never index 0.

[`Queue.cs`](https://github.com/dotnet/runtime/blob/main/src/libraries/System.Private.CoreLib/src/System/Collections/Generic/Queue.cs) keeps `_array`, `_head`, `_tail` and `_size`. `Enqueue` writes at `_tail` and calls a `MoveNext` helper to advance it; `Dequeue` reads at `_head` and advances that the same way. `MoveNext` does not use `%`:

```text
int tmp = index + 1;
if (tmp == _array.Length) tmp = 0;
index = tmp;
```

One comparison instead of a division, because `%` is slower than a branch the processor predicts correctly almost every time — an optimization `RingQueue<T>` above skips for clarity. When the array does fill up, `Queue<T>` grows it by doubling (with a minimum growth of 4 elements) and, like `RingQueue<T>`'s `Grow`, copies the live elements out starting from `_head` so the new array holds them in logical order from index 0.

The clearest proof that `Queue<T>` really is circular, rather than just resizing quietly, is watching its own `Capacity` refuse to move:

```csharp run id=capacity-trace
var s = new Stack<int>();
Console.WriteLine("Stack<T>");
for (int i = 1; i <= 9; i++)
{
    s.Push(i);
    Console.WriteLine(
        $"  push {i}: Count {s.Count,2} Cap {s.Capacity,2}");
}

var q = new Queue<int>();
Console.WriteLine("Queue<T>");
for (int i = 1; i <= 4; i++)
{
    q.Enqueue(i);
    Console.WriteLine(
        $"  enqueue {i}: Count {q.Count} Cap {q.Capacity}");
}
q.Dequeue(); q.Dequeue();
Console.WriteLine(
    $"  after 2 dequeues: Count {q.Count} Cap {q.Capacity}");
q.Enqueue(5); q.Enqueue(6);
Console.WriteLine(
    $"  after 2 enqueues: Count {q.Count} Cap {q.Capacity}");
Console.WriteLine($"  order: {string.Join(' ', q)}");
```

```text output
Stack<T>
  push 1: Count  1 Cap  4
  push 2: Count  2 Cap  4
  push 3: Count  3 Cap  4
  push 4: Count  4 Cap  4
  push 5: Count  5 Cap  8
  push 6: Count  6 Cap  8
  push 7: Count  7 Cap  8
  push 8: Count  8 Cap  8
  push 9: Count  9 Cap 16
Queue<T>
  enqueue 1: Count 1 Cap 4
  enqueue 2: Count 2 Cap 4
  enqueue 3: Count 3 Cap 4
  enqueue 4: Count 4 Cap 4
  after 2 dequeues: Count 2 Cap 4
  after 2 enqueues: Count 4 Cap 4
  order: 3 4 5 6
```

`Stack<T>.Capacity` doubles at 4, 8 and 16, precisely on schedule with `Count`, because a stack only ever grows at one end and every element it has ever held is still adjacent to the next slot. `Queue<T>` fills to capacity 4, gives back two elements, takes on two more — and `Capacity` never moves. `1` and `2` are gone; `5` and `6` physically landed in the array slots `1` and `2` used to occupy, and `order` still prints `3 4 5 6`, the correct FIFO sequence, because the enumerator (like `RingQueue<T>`'s) walks `Count` slots starting from `_head`, not from index 0. That is not resizing hidden well — it is reuse, which is the entire point of a ring buffer.

::::exercise[Predict a Queue<T>'s Count and Capacity]
A `Queue<int>` starts empty. Six `Enqueue` calls run, then three `Dequeue` calls, then two more `Enqueue` calls. Predict `Count` and `Capacity` after each phase before running anything.

:::solution
```csharp run id=ex-predict
var q = new Queue<int>();
for (int i = 1; i <= 6; i++) q.Enqueue(i);
Console.WriteLine(
    $"after 6 enqueues: Count {q.Count} Cap {q.Capacity}");
for (int i = 0; i < 3; i++) q.Dequeue();
Console.WriteLine(
    $"after 3 dequeues: Count {q.Count} Cap {q.Capacity}");
q.Enqueue(7); q.Enqueue(8);
Console.WriteLine(
    $"after 2 more:     Count {q.Count} Cap {q.Capacity}");
Console.WriteLine($"contents: {string.Join(' ', q)}");
```

```text output
after 6 enqueues: Count 6 Cap 8
after 3 dequeues: Count 3 Cap 8
after 2 more:     Count 5 Cap 8
contents: 4 5 6 7 8
```

Six enqueues push capacity past 4 to 8 (the same doubling `Stack<T>` uses), and nothing after that needs another resize, because `Count` never exceeds 8 again. The three dequeued values (`1`, `2`, `3`) are gone for good; `7` and `8` reuse their old slots, and the enumerator still produces `4 5 6 7 8` in the right order.
:::
::::

## A next-greater-element with a monotonic stack

A different use for a stack has nothing to do with undoing actions: keeping it in *sorted* order as you scan a sequence once, left to right, so each element can answer a question about the elements after it in O(1) amortized work. Structures kept sorted this way by removing anything that would break the order before inserting are called monotonic; cp-algorithms describes the same technique for a minimum-tracking structure, explaining that it will "keep the queue in nondecreasing order" by removing trailing elements larger than the new one before adding it.

The classic use is next-greater-element: for each value, find the first value to its right that is strictly greater, or report none. Applied to a week of temperatures, it answers "for each day, what is the next temperature that beats it?":

```csharp run id=monotonic-stack
int[] temps = [73, 74, 75, 71, 69, 72, 76, 73];
int[] next = NextGreaterElement(temps);
Console.WriteLine("day  temp  next-greater");
for (int i = 0; i < temps.Length; i++)
    Console.WriteLine(
        $"{i,3}{temps[i],6}{next[i],13}");

// For each index, the first later value that is strictly
// greater, or -1 if none. Amortized O(n): see below.
static int[] NextGreaterElement(int[] values)
{
    var result = new int[values.Length];
    var decreasing = new Stack<int>(); // indices, values ↓
    for (int i = 0; i < values.Length; i++)
    {
        while (decreasing.Count > 0 &&
               values[decreasing.Peek()] < values[i])
        {
            result[decreasing.Pop()] = values[i];
        }
        decreasing.Push(i);
    }
    while (decreasing.Count > 0)
        result[decreasing.Pop()] = -1;
    return result;
}
```

```text output
day  temp  next-greater
  0    73           74
  1    74           75
  2    75           76
  3    71           72
  4    69           72
  5    72           76
  6    76           -1
  7    73           -1
```

The stack holds indices whose next-greater value is still unknown, kept in decreasing order of temperature bottom to top. Day 4 (69°) and day 3 (71°) both get resolved by day 5 (72°) in the same pass, because both are less than it and both sit on top of the stack when day 5 arrives; day 2 (75°) survives that same `while` loop untouched because 75 is not less than 72, and waits for day 6 (76°) instead.

The nested `while` loop looks like it could make this Θ(*n*²), the same shape as the naive bracket counter's blind spot from the other direction: code that looks fine can hide its true cost. It does not, because of a fact the loop condition itself guarantees: an index is pushed exactly once (every iteration of the outer loop pushes `i` exactly once) and popped at most once (once popped, an index never returns to the stack). So the total number of pops across the *entire* run, inner loop included, cannot exceed the total number of pushes, which is exactly *n*:

```csharp run id=ex-count-ops
var rng = new Random(7);
int[] sizes = [10, 100, 1_000, 10_000];
Console.WriteLine("     n  pushes  pops");
foreach (int n in sizes)
{
    int[] values = new int[n];
    for (int i = 0; i < n; i++)
        values[i] = rng.Next(0, 1_000_000);
    var (pushes, pops) = CountPushesAndPops(values);
    Console.WriteLine($"{n,6}{pushes,8}{pops,6}");
}

static (int pushes, int pops) CountPushesAndPops(
    int[] values)
{
    var result = new int[values.Length];
    var decreasing = new Stack<int>();
    int pushes = 0, pops = 0;
    for (int i = 0; i < values.Length; i++)
    {
        while (decreasing.Count > 0 &&
               values[decreasing.Peek()] < values[i])
        {
            decreasing.Pop();
            pops++;
        }
        decreasing.Push(i);
        pushes++;
    }
    while (decreasing.Count > 0) { decreasing.Pop(); pops++; }
    return (pushes, pops);
}
```

```text output
     n  pushes  pops
    10      10    10
   100     100   100
  1000    1000  1000
 10000   10000 10000
```

For four different sizes of random input, `pushes` and `pops` both land exactly on *n*, every time — not "roughly," exactly, because every one of the *n* pushed indices is popped precisely once, either inside the main loop or during the final drain. Total stack operations are bounded by 2*n* regardless of how the while loop's work is distributed across outer iterations, which is the same [amortized](/complexity/amortized-analysis/) argument that makes `List<T>.Add` O(1) despite the occasional expensive resize: charge the cost somewhere it cannot be exceeded in total, not to the single operation that happens to trigger it.

::::exercise[Adapt next-greater-element to a distance]
A common variant asks not for the next greater *value* but how many positions away it is — "how many days until a warmer day?" Adapt `NextGreaterElement` to return that gap instead (0 if there is no later warmer day), reusing the same temperature data.

:::solution
```csharp run id=ex-warmer
int[] temps = [73, 74, 75, 71, 69, 72, 76, 73];
int[] wait = DaysUntilWarmer(temps);
Console.WriteLine(string.Join(' ', wait));

static int[] DaysUntilWarmer(int[] temps)
{
    var result = new int[temps.Length];
    var decreasing = new Stack<int>();
    for (int i = 0; i < temps.Length; i++)
    {
        while (decreasing.Count > 0 &&
               temps[decreasing.Peek()] < temps[i])
        {
            int j = decreasing.Pop();
            result[j] = i - j; // distance, not value
        }
        decreasing.Push(i);
    }
    return result; // never-resolved entries stay 0
}
```

```text output
1 1 4 2 1 1 0 0
```

Only the payload written at `result[j]` changes, from `values[i]` to `i - j`; the loop that decides *which* index resolves *when* is identical, so the O(n) argument above carries over unchanged. Day 2 (75°) waits 4 days for day 6 (76°); the last two days never see a warmer one and keep the default `0`.
:::
::::
