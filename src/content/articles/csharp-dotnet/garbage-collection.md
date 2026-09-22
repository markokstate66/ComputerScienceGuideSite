---
title: "How the .NET Garbage Collector Actually Works"
description: "Trace roots and reachability, generations and the large object heap, then measure a real event-handler leak with WeakReference and GC.CollectionCount."
pillar: csharp-dotnet
order: 2
author: markus
published: 2026-09-22
updated: 2026-09-22
level: intermediate
tags: [garbage-collection, generations, idisposable, weak-references, memory-leaks]
prerequisites: ["csharp-dotnet/value-types-vs-reference-types"]
sources:
  - title: "Fundamentals of garbage collection"
    url: "https://learn.microsoft.com/en-us/dotnet/standard/garbage-collection/fundamentals"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Large object heap (LOH) on Windows"
    url: "https://learn.microsoft.com/en-us/dotnet/standard/garbage-collection/large-object-heap"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Weak References"
    url: "https://learn.microsoft.com/en-us/dotnet/standard/garbage-collection/weak-references"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "WeakReference Class"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.weakreference"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "GC.Collect Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.gc.collect"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "GC.CollectionCount(Int32) Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.gc.collectioncount"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Implement a Dispose method"
    url: "https://learn.microsoft.com/en-us/dotnet/standard/garbage-collection/implementing-dispose"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Using objects that implement IDisposable"
    url: "https://learn.microsoft.com/en-us/dotnet/standard/garbage-collection/using-objects"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Object.Finalize Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.object.finalize"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Delegate.Target Property"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.delegate.target"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Handling and raising events"
    url: "https://learn.microsoft.com/en-us/dotnet/standard/events/"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
draft: false
---

On the managed heap, a .NET program never calls `free`. Every `new` asks the garbage collector for a slot there, and the collector decides, unasked, when that slot's contents stop mattering. It gets that decision right almost all the time, which is exactly why the times it looks like it got something wrong — a subscriber that never dies, a file handle held open long after the `using` block ended — are confusing. Both of those have real mechanical explanations, and both are demonstrated below with running code, not just described.

## What decides whether an object is garbage?

Not whether anything still holds a reference to it in some abstract sense — whether the collector can *reach* it. Starting from a fixed set of **roots** — "static fields, local variables on a thread's stack, CPU registers, GC handles, and the finalize queue" — the collector follows every reference it finds and builds the set of objects reachable that way. Anything left over is garbage, full stop, regardless of how many other objects still point at it ([Fundamentals of garbage collection](https://learn.microsoft.com/en-us/dotnet/standard/garbage-collection/fundamentals)).

That last clause matters more than it looks. Two objects can hold references to each other and still both be garbage, because reachability is about a path back to a root, not about whether an object's reference count is zero. The program below builds exactly that: two `Node`s that reference each other, reachable from nothing once the method that created them returns.

```csharp run id=cycle
WeakReference tracker = MakeCycle();

GC.Collect();
GC.WaitForPendingFinalizers();
Console.WriteLine(
    $"cycle collected: {!tracker.IsAlive}");

static WeakReference MakeCycle()
{
    var a = new Node();
    var b = new Node();
    a.Other = b;
    b.Other = a;   // each keeps the other "alive"
    return new WeakReference(a);
    // neither a nor b is reachable from a root here
}

class Node { public Node? Other; }
```

```text output
cycle collected: True
```

[`WeakReference`](https://learn.microsoft.com/en-us/dotnet/api/system.weakreference) is what makes this checkable at all: it points at an object without being a root itself, so its `Target` can be read while the object lives and its `IsAlive` property turns false once the collector has reclaimed it ([WeakReference Class](https://learn.microsoft.com/en-us/dotnet/api/system.weakreference)). `MakeCycle` returns a `WeakReference` to `a`, not `a` itself — if it returned `a`, the caller's local variable would be a new root and the demonstration would prove nothing. `GC.Collect()` forces an immediate, blocking collection of every generation, which is not something production code should call routinely — Microsoft's own guidance says the method "is primarily used for unique situations and testing" ([Fundamentals of garbage collection](https://learn.microsoft.com/en-us/dotnet/standard/garbage-collection/fundamentals)), which is precisely the situation here.

<figure class="diagram">
<svg viewBox="0 0 360 360" role="img" aria-labelledby="gc-reach-title gc-reach-desc">
<title id="gc-reach-title">Reachability from roots, not reference counts</title>
<desc id="gc-reach-desc">A local variable and a static field are roots. Arrows lead from them through Sensor, Gauge and Reading objects. A separate old Reading object at the bottom has no incoming arrow from any root and is marked unreachable, even though nothing shown has zero references drawn to it from elsewhere.</desc>
<defs>
<marker id="gc-reach-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-accent"/></marker>
</defs>
<text x="20" y="20" class="d-bold">Roots</text>
<rect x="20" y="30" width="150" height="34" rx="6" class="d-box"/>
<text x="95" y="52" text-anchor="middle" class="d-mono d-small">local variable</text>
<rect x="190" y="30" width="150" height="34" rx="6" class="d-box"/>
<text x="265" y="52" text-anchor="middle" class="d-mono d-small">static field</text>
<path d="M95 64 V90" class="d-accent" marker-end="url(#gc-reach-arrow)"/>
<path d="M265 64 V90" class="d-accent" marker-end="url(#gc-reach-arrow)"/>
<rect x="20" y="94" width="150" height="40" rx="6" class="d-box-accent"/>
<text x="95" y="119" text-anchor="middle" class="d-small d-bold">Sensor</text>
<rect x="190" y="94" width="150" height="40" rx="6" class="d-box-accent"/>
<text x="265" y="119" text-anchor="middle" class="d-small d-bold">Gauge (cached)</text>
<path d="M95 134 V160" class="d-accent" marker-end="url(#gc-reach-arrow)"/>
<rect x="20" y="164" width="150" height="40" rx="6" class="d-box-accent"/>
<text x="95" y="189" text-anchor="middle" class="d-small d-bold">Reading</text>
<text x="20" y="224" class="d-muted d-small">Reachable: a chain of arrows leads</text>
<text x="20" y="240" class="d-muted d-small">back to some root.</text>
<path d="M20 258 H340" class="d-line d-dashed"/>
<rect x="105" y="270" width="150" height="54" rx="6" class="d-box-bad"/>
<text x="180" y="292" text-anchor="middle" class="d-small d-bold">old Reading</text>
<text x="180" y="310" text-anchor="middle" class="d-text-bad d-small">no root reaches this</text>
<text x="20" y="344" class="d-muted d-small">Unreachable: no path from any root,</text>
</svg>
<figcaption>Figure 1. Reachability is about paths from roots. The old Reading object could still have inbound references drawn from elsewhere on the heap and be garbage anyway, as long as none of those paths starts at a root.</figcaption>
</figure>

::::exercise[Predict it: which weak reference survives]
Two objects are created. One is added to a list kept in a local variable that lives until the end of the method; the other is not kept anywhere. Predict what each `WeakReference` reports after a collection, then check.

```csharp run id=predict-roots
var kept = new List<object>();
WeakReference a = Track(kept, root: true);
WeakReference b = Track(kept, root: false);

GC.Collect();
GC.WaitForPendingFinalizers();

// a.IsAlive is ______, b.IsAlive is ______

static WeakReference Track(
    List<object> kept, bool root)
{
    var probe = new object();
    if (root) kept.Add(probe);
    return new WeakReference(probe);
}
```

:::solution
```csharp run id=predict-roots-solved
var kept = new List<object>();
WeakReference a = Track(kept, root: true);
WeakReference b = Track(kept, root: false);

GC.Collect();
GC.WaitForPendingFinalizers();

Console.WriteLine($"a.IsAlive: {a.IsAlive}");
Console.WriteLine($"b.IsAlive: {b.IsAlive}");

static WeakReference Track(
    List<object> kept, bool root)
{
    var probe = new object();
    if (root) kept.Add(probe);
    return new WeakReference(probe);
}
```

```text output
a.IsAlive: True
b.IsAlive: False
```

`kept` is a local variable, so it is a root for as long as the method is running, and every element it holds is reachable through it. `a`'s `object` is one of those elements; `b`'s was never stored anywhere the collector could reach, so it was garbage as soon as `Track` returned.
:::
::::

## Why sort objects into generations instead of collecting everything at once?

Because most objects die young. The [Fundamentals](https://learn.microsoft.com/en-us/dotnet/standard/garbage-collection/fundamentals) page states the two premises the whole scheme rests on: "it's faster to compact the memory for a portion of the managed heap than for the entire managed heap," and "newer objects have shorter lifetimes, and older objects have longer lifetimes." Put an object into **generation 0** when it is created. Collect generation 0 by itself, often and cheaply, and most of what is in it turns out to be garbage — a loop variable, a string built for one `Console.WriteLine`, a LINQ enumerator. What survives moves to generation 1, a buffer; what survives *that* moves to generation 2 — usually because a generation 0 collection, and then a generation 1 collection, didn't free enough memory on their own. That cascade is the common path, not the only one: the Fundamentals page's "Conditions for a garbage collection" section also lists a low-memory notification from the operating system or host, and an explicit `GC.Collect()` call, as independent triggers that can force a full sweep of every generation without generations 0 and 1 first proving insufficient ([Fundamentals](https://learn.microsoft.com/en-us/dotnet/standard/garbage-collection/fundamentals)). Collecting generation 2 collects every generation younger than it too, which is why it is also called a full garbage collection.

`GC.GetGeneration` reports which generation an object is currently in, and `GC.Collect(n)` forces a collection up through generation `n` ([GC.Collect Method](https://learn.microsoft.com/en-us/dotnet/api/system.gc.collect)). Together they show promotion happening to one specific object, one step at a time:

```csharp run id=promotion
var longLived = new byte[16];
Report("just allocated", longLived);

GC.Collect(0);
Report("after gen 0", longLived);

GC.Collect(1);
Report("after gen 1", longLived);

static void Report(string when, object o) =>
    Console.WriteLine(
        $"{when,-16}generation {GC.GetGeneration(o)}");
```

```text output
just allocated  generation 0
after gen 0     generation 1
after gen 1     generation 2
```

The generation-0-only collections that dominate real programs are cheaper precisely because they never have to look at generations 1 or 2 at all. `GC.CollectionCount(generation)` counts how many collections have happened for that generation since the process started ([GC.CollectionCount Method](https://learn.microsoft.com/en-us/dotnet/api/system.gc.collectioncount)) — and because "collecting a generation means collecting objects in that generation and all its younger generations" ([Fundamentals](https://learn.microsoft.com/en-us/dotnet/standard/garbage-collection/fundamentals)), a generation 2 collection bumps the generation 0 and 1 counts too, so each counter really tracks collections of *at least* that generation. Subtracting two readings around a workload shows the split directly. The loop below allocates and immediately drops three million small arrays — nothing here is ever promoted on purpose, it just keeps generation 0 busy:

```csharp run id=gen-split
#:property Optimize=true
int startGen0 = GC.CollectionCount(0);
int startGen2 = GC.CollectionCount(2);

var longLived = new byte[16];
for (int i = 0; i < 3_000_000; i++)
{
    var temp = new byte[64];
    GC.KeepAlive(temp);
}

Console.WriteLine(
    $"gen 0 collections: {GC.CollectionCount(0) - startGen0}");
Console.WriteLine(
    $"gen 2 collections: {GC.CollectionCount(2) - startGen2}");
GC.KeepAlive(longLived);
```

```text output
gen 0 collections: [...]
gen 2 collections: 0
```

The exact gen-0 count is machine- and load-specific — it was in the low thirties here, on .NET 10.0.12, Windows 11, x64, on a desktop Core i7-11700K — but it is never zero, and generation 2 needed no collection at all to absorb three million short-lived arrays. `#:property Optimize=true` turns on the release-mode JIT for this single-file program; without it, `dotnet run` builds a debug configuration and the numbers are noisier.

<figure class="diagram">
<svg viewBox="0 0 360 356" role="img" aria-labelledby="gc-gen-title gc-gen-desc">
<title id="gc-gen-title">Generations 0 through 2, and the large object heap</title>
<desc id="gc-gen-desc">Generation 0 sits at the top with an arrow labeled survivors promoted leading to generation 1, and another such arrow leading to generation 2. A large object heap band sits beside generation 2, joined to it by a dashed line captioned that both are collected together during a full garbage collection.</desc>
<defs>
<marker id="gc-gen-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-accent"/></marker>
</defs>
<rect x="20" y="20" width="320" height="40" rx="6" class="d-box-accent"/>
<text x="180" y="45" text-anchor="middle" class="d-bold">Generation 0</text>
<text x="20" y="76" class="d-muted d-small">Newest objects. Collected most often;</text>
<text x="20" y="92" class="d-muted d-small">most die here and go no further.</text>
<path d="M180 98 V128" class="d-accent" marker-end="url(#gc-gen-arrow)"/>
<text x="190" y="116" class="d-text-accent d-small">survivors promoted</text>
<rect x="20" y="132" width="320" height="40" rx="6" class="d-box"/>
<text x="180" y="157" text-anchor="middle" class="d-bold">Generation 1</text>
<text x="20" y="188" class="d-muted d-small">A buffer between young and old objects.</text>
<path d="M180 196 V226" class="d-accent" marker-end="url(#gc-gen-arrow)"/>
<text x="190" y="214" class="d-text-accent d-small">survivors promoted</text>
<rect x="20" y="230" width="150" height="54" rx="6" class="d-box-2"/>
<text x="95" y="252" text-anchor="middle" class="d-small d-bold">Generation 2</text>
<text x="95" y="270" text-anchor="middle" class="d-muted d-small">long-lived objects</text>
<rect x="190" y="230" width="150" height="54" rx="6" class="d-box-2"/>
<text x="265" y="252" text-anchor="middle" class="d-small d-bold">Large object heap</text>
<text x="265" y="270" text-anchor="middle" class="d-muted d-small">objects &#8805; 85,000 B</text>
<path d="M20 300 H340" class="d-line d-dashed"/>
<text x="20" y="320" class="d-small d-bold">Swept together:</text>
<text x="20" y="336" class="d-small">a generation 2 collection is a full GC.</text>
</svg>
<figcaption>Figure 2. Objects age from generation 0 toward generation 2 by surviving collections. The large object heap has no generation 0 or 1 of its own; a large allocation goes straight in and is collected on generation 2's schedule.</figcaption>
</figure>

::::exercise[Find the bug]
A colleague writes this helper to check whether an object has been promoted out of generation 0, and is confused that it prints `True` for an object created one line above the call, before any collection has happened:

```csharp run id=was-promoted
Console.WriteLine(
    WasPromoted(new object()));

static bool WasPromoted(object o) =>
    GC.GetGeneration(o) >= 0;
```

```text output
True
```

What is wrong with the check?

:::solution
Every generation number is `>= 0`, including 0 itself, so the comparison is true for every object that exists, promoted or not. The intended check is `GC.GetGeneration(o) > 0` — strictly greater than the generation new objects start in.
:::
::::

## What happens to an allocation too big for the young generations?

It skips them. An object of 85,000 bytes or more goes straight onto a separate segment, the **large object heap** (LOH), because copying a large object during compaction is expensive enough that the collector avoids it: "if an object is greater than or equal to 85,000 bytes in size, it's considered a large object" ([Large object heap (LOH) on Windows](https://learn.microsoft.com/en-us/dotnet/standard/garbage-collection/large-object-heap)). The same page places the LOH on generation 2's schedule: "large objects belong to generation 2 because they are collected only during a generation 2 collection." The threshold is on the object's total size, header included, not on the number of elements you asked for — which is checkable by finding the exact array length where a `byte[]` crosses it:

```csharp run id=loh-boundary
byte[] small = new byte[84_960];
byte[] large = new byte[85_000];

Console.WriteLine(
    $"84,960-byte array -> generation {GC.GetGeneration(small)}");
Console.WriteLine(
    $"85,000-byte array -> generation {GC.GetGeneration(large)}");
GC.KeepAlive(small);
GC.KeepAlive(large);
```

```text output
84,960-byte array -> generation 0
85,000-byte array -> generation 2
```

Forty bytes of array length is the entire difference between an ordinary generation-0 allocation and one that rides along with every full collection from the moment it is created — `GC.GetGeneration` reports 2 immediately, with no collection needed to get it there, which is the checkable form of "large objects belong to generation 2." A cache of a few hundred medium-sized buffers, or one array sized generously "to be safe," can cross that line without anyone intending it — avoiding large temporary allocations in the first place, rather than just tolerating where they land, is a separate technique from anything on this page.

::::exercise[Measure it: find the exact cutover]
Binary search the smallest `byte[]` length that lands on the LOH, using `GC.GetGeneration` as the test, and compare the result with the 85,000-byte threshold above. Where does the difference come from?

:::solution
```csharp run id=loh-search
int lo = 0, hi = 200_000;
while (lo < hi)
{
    int mid = (lo + hi) / 2;
    byte[] probe = new byte[mid];
    bool large = GC.GetGeneration(probe) == 2;
    if (large) hi = mid; else lo = mid + 1;
    GC.KeepAlive(probe);
}
Console.WriteLine(
    $"smallest byte[] on the LOH: {lo:N0} bytes");
```

```text output
smallest byte[] on the LOH: 84,976 bytes
```

84,976 bytes of array data plus a 24-byte array header lands on exactly 85,000 total bytes — the array's payload alone can be a little under the documented figure and still cross it once its header is counted.
:::
::::

## What does a collection actually do to the heap?

Three things, in order: mark, then relocate references, then compact. The marking phase walks the graph from roots — the same graph reachability built in the first section — and records every object it reaches. The relocating phase fixes up every reference that will point somewhere new. The compacting phase copies the surviving objects so they sit next to each other, "moves objects that have survived a garbage collection towards the older end of the segment," and only then does the free space left by dead objects become available for new allocations ([Fundamentals](https://learn.microsoft.com/en-us/dotnet/standard/garbage-collection/fundamentals)). Compaction only happens "if a collection discovers a significant number of unreachable objects" — a collection where everything survives has nothing to compact, so it skips that step ([Fundamentals](https://learn.microsoft.com/en-us/dotnet/standard/garbage-collection/fundamentals)).

<figure class="diagram">
<svg viewBox="0 0 360 260" role="img" aria-labelledby="gc-compact-title gc-compact-desc">
<title id="gc-compact-title">Live objects packed together after compaction</title>
<desc id="gc-compact-desc">Before compaction, six blocks alternate between live and dead in no particular order. After compaction, the three live blocks sit next to each other at the start of the segment and one large free block follows them, ready for new allocations.</desc>
<defs>
<marker id="gc-compact-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-accent"/></marker>
</defs>
<text x="20" y="20" class="d-bold">Before a collection</text>
<rect x="20" y="30" width="48" height="40" class="d-box-accent"/><text x="44" y="55" text-anchor="middle" class="d-small d-bold">A</text>
<rect x="74" y="30" width="48" height="40" class="d-box-2"/>
<rect x="128" y="30" width="48" height="40" class="d-box-accent"/><text x="152" y="55" text-anchor="middle" class="d-small d-bold">B</text>
<rect x="182" y="30" width="48" height="40" class="d-box-2"/>
<rect x="236" y="30" width="48" height="40" class="d-box-2"/>
<rect x="290" y="30" width="48" height="40" class="d-box-accent"/><text x="314" y="55" text-anchor="middle" class="d-small d-bold">C</text>
<text x="20" y="90" class="d-muted d-small">Accent = live. Grey = dead, in between.</text>
<path d="M180 100 V130" class="d-accent" marker-end="url(#gc-compact-arrow)"/>
<text x="190" y="120" class="d-text-accent d-small">mark, then compact</text>
<text x="20" y="152" class="d-bold">After compaction</text>
<rect x="20" y="162" width="48" height="40" class="d-box-accent"/><text x="44" y="187" text-anchor="middle" class="d-small d-bold">A</text>
<rect x="68" y="162" width="48" height="40" class="d-box-accent"/><text x="92" y="187" text-anchor="middle" class="d-small d-bold">B</text>
<rect x="116" y="162" width="48" height="40" class="d-box-accent"/><text x="140" y="187" text-anchor="middle" class="d-small d-bold">C</text>
<rect x="164" y="162" width="174" height="40" class="d-box-2 d-dashed"/>
<text x="251" y="187" text-anchor="middle" class="d-muted d-small">free</text>
<text x="20" y="226" class="d-muted d-small">New objects are handed out from the</text>
<text x="20" y="242" class="d-muted d-small">free block next, with no gaps to search.</text>
</svg>
<figcaption>Figure 3. The dead blocks are not individually erased. The live ones are copied together, which turns every gap between them into one reusable block in a single step.</figcaption>
</figure>

The [large object heap does not get this treatment by default](https://learn.microsoft.com/en-us/dotnet/standard/garbage-collection/large-object-heap): moving a multi-megabyte object costs real time, so the collector sweeps it instead — building a free list out of the gaps between surviving objects rather than sliding everything together — unless `GCSettings.LargeObjectHeapCompactionMode` asks it to compact once. Compaction shows up indirectly in how much reachable memory a program reports before and after a collection. The program below keeps half of twenty thousand 256-byte blocks and lets the rest go:

```csharp run id=reclaim
#:property Optimize=true
var keep = new List<byte[]>();
for (int i = 0; i < 20_000; i++)
{
    var block = new byte[256];
    if (i % 2 == 0) keep.Add(block);
}

long before = GC.GetTotalMemory(false);
GC.Collect();
long after = GC.GetTotalMemory(true);

Console.WriteLine($"before collect: {before:N0} B");
Console.WriteLine($"after collect:  {after:N0} B");
Console.WriteLine($"kept blocks:    {keep.Count:N0}");
```

```text output
before collect: [...] B
after collect:  [...] B
kept blocks:    10,000
```

The exact byte counts vary with the runtime and machine, but the shape does not: `after` came out to roughly half of `before` here, which is what keeping exactly half the blocks should produce once the discarded half is marked, relocated past, and swept away.

## Does calling `Dispose` collect the object?

No — `Dispose` and garbage collection are two different mechanisms that happen to cooperate. `Dispose` is an ordinary method call — one you write explicitly, or one a dependency-injection container runs for you, since "implementations of `IDisposable`... are properly disposed at the end of their specified lifetime" for registered services ([Implement a Dispose method](https://learn.microsoft.com/en-us/dotnet/standard/garbage-collection/implementing-dispose)) — and the object it runs on is not reclaimed by that call; it stays exactly as reachable as it was before. What `Dispose` is for is releasing **unmanaged** resources — a file handle, a native buffer, anything the collector has no idea how to free, because "the .NET garbage collector doesn't allocate or release unmanaged memory" ([Implement a Dispose method](https://learn.microsoft.com/en-us/dotnet/standard/garbage-collection/implementing-dispose)). Memory reclamation is still entirely the collector's job, on its own schedule, whether or not `Dispose` was ever called.

A **finalizer** — written in C# as `~ClassName()` — is the collector's own backstop for that same unmanaged resource, for the case where nobody called `Dispose`. If a type has one, the collector defers reclaiming that object: it adds an entry to an internal finalization queue, and once the object becomes unreachable, the runtime runs the finalizer before the memory can actually be freed. That detour is why Microsoft's own guidance is blunt about the cost: "reclaiming memory tends to take much longer if a finalization operation runs, because it requires at least two garbage collections" ([Object.Finalize Method](https://learn.microsoft.com/en-us/dotnet/api/system.object.finalize)) — one collection to discover the object is unreachable and queue its finalizer, a second to reclaim it once the finalizer has run. `GC.SuppressFinalize(this)`, called from `Dispose`, tells the collector that the cleanup already happened and the finalizer can be skipped, restoring the object to an ordinary one-collection reclaim.

The two paths are easy to tell apart by tracing which one runs. `SensorProbe` below wraps ten bytes of real unmanaged memory:

```csharp run id=dispose-vs-finalize
using System.Runtime.InteropServices;

Console.WriteLine("-- disposed explicitly --");
RunDisposed();
GC.Collect();
GC.WaitForPendingFinalizers();

Console.WriteLine("-- dropped, never disposed --");
RunDropped();
GC.Collect();
GC.WaitForPendingFinalizers();

static void RunDisposed()
{
    var probe = new SensorProbe(10);
    probe.Dispose();
}

static void RunDropped()
{
    var probe = new SensorProbe(10);
}

sealed class SensorProbe : IDisposable
{
    private IntPtr _buffer;
    private bool _disposed;

    public SensorProbe(int bytes)
    {
        _buffer = Marshal.AllocHGlobal(bytes);
        Console.WriteLine(
            $"  allocated {bytes} unmanaged bytes");
    }

    public void Dispose()
    {
        if (_disposed) return;
        Console.WriteLine("  Dispose(): freed now");
        Marshal.FreeHGlobal(_buffer);
        _disposed = true;
        GC.SuppressFinalize(this);
    }

    ~SensorProbe()
    {
        if (_disposed) return;
        Console.WriteLine("  ~SensorProbe(): freed late");
        Marshal.FreeHGlobal(_buffer);
    }
}
```

```text output
-- disposed explicitly --
  allocated 10 unmanaged bytes
  Dispose(): freed now
-- dropped, never disposed --
  allocated 10 unmanaged bytes
  ~SensorProbe(): freed late
```

`RunDisposed` calls `Dispose`, which frees the buffer immediately and suppresses the finalizer — the `~SensorProbe()` line never prints. `RunDropped` never calls `Dispose`; the object becomes unreachable when the method returns, the collector notices it still has unmanaged state to release, and the finalizer does the freeing instead, one cycle later. The 10 bytes are freed correctly either way, but only one of the two paths does it the moment you meant it to.

:::pitfall
`Dispose()` has to tolerate being called more than once — a caller can call it twice, or call it and then let the object go out of scope anyway — and a finalizer has to tolerate running on an object that was already disposed. That is why `SensorProbe.Dispose()` and `~SensorProbe()` both check `_disposed` first: whichever one runs, first or second, must free nothing and print nothing beyond that check.
:::

::::exercise[Extend the code: the shape a base class needs]
`SensorProbe` is `sealed`, so its shortcut — `Dispose()` and the finalizer both call `Marshal.FreeHGlobal` directly — is safe. A class written to be a base class cannot assume that, because a derived class's `Dispose(bool)` override needs a single place to route both the explicit-dispose and the finalizer paths through. Rewrite `SensorProbe` with a `protected virtual void Dispose(bool disposing)` that both `Dispose()` and `~SensorProbe()` call, guarded so a second call does nothing, and confirm it produces the same trace.

:::solution
```csharp run id=dispose-bool
using System.Runtime.InteropServices;

var probe = new SensorProbe(10);
probe.Dispose();
probe.Dispose();   // must be safe to call twice
Console.WriteLine("done");

class SensorProbe : IDisposable
{
    private IntPtr _buffer;
    private bool _disposed;

    public SensorProbe(int bytes) =>
        _buffer = Marshal.AllocHGlobal(bytes);

    public void Dispose()
    {
        Dispose(disposing: true);
        GC.SuppressFinalize(this);
    }

    protected virtual void Dispose(bool disposing)
    {
        if (_disposed) return;
        Marshal.FreeHGlobal(_buffer);
        Console.WriteLine(disposing
            ? "  Dispose(): freed"
            : "  ~SensorProbe(): freed");
        _disposed = true;
    }

    ~SensorProbe() => Dispose(disposing: false);
}
```

```text output
  Dispose(): freed
done
```

The second `probe.Dispose()` call still runs `Dispose(true)`, but `_disposed` is already `true`, so it returns immediately: no double free, no second message. A subclass overriding `Dispose(bool)` releases its own resources, then calls `base.Dispose(disposing)`, and the finalizer stays declared once, on the base class, exactly as [Implement a Dispose method](https://learn.microsoft.com/en-us/dotnet/standard/garbage-collection/implementing-dispose#dispose-and-disposebool) describes it.
:::
::::

## What does `using` actually guarantee, and what does it not?

That `Dispose` runs when the block ends, however it ends. The compiler lowers a `using` statement to a `try`/`finally` with the `Dispose` call in the `finally`, so it runs on the normal path out of the block and on the way out through a thrown exception alike ([Using objects that implement IDisposable](https://learn.microsoft.com/en-us/dotnet/standard/garbage-collection/using-objects)):

```csharp run id=using-order
Console.WriteLine("before block");
using (var probe = new Recorder("A"))
{
    Console.WriteLine("inside block");
}
Console.WriteLine("after block");

sealed class Recorder(string name) : IDisposable
{
    public void Dispose() =>
        Console.WriteLine($"  disposed {name}");
}
```

```text output
before block
inside block
  disposed A
after block
```

What `using` does *not* do is free the object's memory. `Recorder` is still an object on the managed heap after `Dispose` runs — it is unreachable once the local variable `probe` goes out of scope, same as any other object, and the collector reclaims it on its own schedule, exactly as the earlier sections described. `using` fixes the *timing of cleanup you write*, not the timing of collection, which is precisely the gap a finalizer exists to cover if `Dispose` never runs at all.

## Can a program leak memory with a garbage collector watching it?

Yes — reachability cuts both ways. The collector will never free an object that something can still reach, and it has no way to know that a reference you forgot about was a mistake. Two everyday sources of exactly that: a `static` field that only ever grows, and an event subscription that is never removed.

### A cache with no eviction is a permanent root

A `static` field is itself a root, for the entire lifetime of the process, so anything reachable through it is reachable forever — including every item ever added to a cache that is never trimmed:

```csharp run id=static-leak
var tracker = Cache.Remember(new byte[1000]);
GC.Collect();
GC.WaitForPendingFinalizers();
Console.WriteLine(
    $"cached item alive: {tracker.IsAlive}");

static class Cache
{
    private static readonly List<object> _items = [];

    public static WeakReference Remember(object item)
    {
        _items.Add(item);
        return new WeakReference(item);
    }
}
```

```text output
cached item alive: True
```

Nothing here is a bug in the collector. `_items` is exactly as reachable as `Cache` itself, which is reachable for as long as the process runs, so every element it ever accumulates is reachable too. A cache needs its own eviction policy — a size cap, a time-to-live, or, for a single object that is expensive to rebuild, a `WeakReference` the way [Weak References](https://learn.microsoft.com/en-us/dotnet/standard/garbage-collection/weak-references) walks through for a tree view a user has switched away from. That page is explicit that this is not a substitute for the eviction policy itself: "avoid using weak references as an automatic solution to memory management problems," it says; "instead, develop an effective caching policy." The collector will not invent one for you either way.

### The subscription that outlives the object that made it

Events are more surprising, because nothing about `+=` looks like storing a reference forever. By design, "the event sender doesn't know the object or method that receives (handles) the events it raises" ([Handling and raising events](https://learn.microsoft.com/en-us/dotnet/standard/events/)) — but not knowing what a subscriber is does not stop the publisher from holding onto it. `+=` on an event adds a delegate to a list the publisher owns, and a delegate created from an instance method carries a reference to that instance — "the object on which the current delegate invokes the instance method" ([Delegate.Target Property](https://learn.microsoft.com/en-us/dotnet/api/system.delegate.target)) — for as long as the delegate itself is reachable. Subscribe a short-lived object to a long-lived publisher's event and never unsubscribe, and the publisher's delegate list roots the subscriber for as long as the publisher lives, whatever the subscriber's own code thought its lifetime was.

`Gauge` below subscribes to a `TemperatureSensor`'s event in its constructor and never unsubscribes. Five hundred gauges are created, tracked with weak references, and the only strong references — the loop's local variable — go out of scope as soon as the loop moves on:

```csharp run id=event-leak
var sensor = new TemperatureSensor();
var tracked = AttachGauges(sensor, count: 500);

GC.Collect();
GC.WaitForPendingFinalizers();
GC.Collect();

int alive = tracked.Count(r => r.IsAlive);
Console.WriteLine(
    $"leaky: {alive} / {tracked.Count} gauges alive");

static List<WeakReference> AttachGauges(
    TemperatureSensor sensor, int count)
{
    var tracked = new List<WeakReference>();
    for (int i = 0; i < count; i++)
    {
        var gauge = new Gauge(sensor, i);
        tracked.Add(new WeakReference(gauge));
    }
    return tracked;
}

class TemperatureSensor
{
    public event EventHandler<double>? ReadingReceived;
    public void Publish(double c) =>
        ReadingReceived?.Invoke(this, c);
}

class Gauge
{
    public Gauge(TemperatureSensor sensor, int id) =>
        sensor.ReadingReceived += OnReading;

    private void OnReading(
        object? sender, double celsius) { }
}
```

```text output
leaky: 500 / 500 gauges alive
```

All five hundred survive two rounds of `GC.Collect()`, because every one of them is still reachable: `sensor` is a root (a local variable in the calling method), `sensor.ReadingReceived` is a field on it, and that field's delegate list holds a reference to every `Gauge` that ever subscribed. None of the loop-local `gauge` variables matter anymore — they went out of scope hundreds of iterations ago — because the event field found a different path back to the same root.

<figure class="diagram">
<svg viewBox="0 0 360 300" role="img" aria-labelledby="gc-leak-title gc-leak-desc">
<title id="gc-leak-title">A publisher's event field outlives the local variable that subscribed</title>
<desc id="gc-leak-desc">A dashed box labeled loop-local gauge variable, gone, sits above a solid Sensor box that is rooted. Three solid arrows lead from the Sensor box down to three Gauge boxes, labeled kept alive by the event's delegate list.</desc>
<defs>
<marker id="gc-leak-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-accent"/></marker>
</defs>
<rect x="105" y="10" width="150" height="30" rx="6" class="d-box d-dashed"/>
<text x="180" y="30" text-anchor="middle" class="d-muted d-small">loop-local `gauge` (gone)</text>
<rect x="105" y="70" width="150" height="44" rx="6" class="d-box-accent"/>
<text x="180" y="96" text-anchor="middle" class="d-bold">Sensor (rooted)</text>
<text x="20" y="134" class="d-muted d-small">field: ReadingReceived, a delegate list</text>
<path d="M140 140 V174" class="d-accent" marker-end="url(#gc-leak-arrow)"/>
<path d="M180 140 V174" class="d-accent" marker-end="url(#gc-leak-arrow)"/>
<path d="M220 140 V174" class="d-accent" marker-end="url(#gc-leak-arrow)"/>
<rect x="20" y="178" width="90" height="40" rx="6" class="d-box-2"/>
<text x="65" y="203" text-anchor="middle" class="d-mono d-small">Gauge 0</text>
<rect x="135" y="178" width="90" height="40" rx="6" class="d-box-2"/>
<text x="180" y="203" text-anchor="middle" class="d-mono d-small">Gauge 1</text>
<rect x="250" y="178" width="90" height="40" rx="6" class="d-box-2"/>
<text x="295" y="203" text-anchor="middle" class="d-mono d-small">Gauge 2</text>
<text x="20" y="248" class="d-muted d-small">Each Gauge's local variable is gone, but</text>
<text x="20" y="264" class="d-muted d-small">the event's delegate list still references</text>
<text x="20" y="280" class="d-muted d-small">it, and that list is reachable from Sensor.</text>
</svg>
<figcaption>Figure 4. Subscribing does not just run code when an event fires; it stores a reference until something unsubscribes. A rooted publisher makes that reference permanent.</figcaption>
</figure>

The fix is the same idea `using` already relies on: give the subscription a defined end. `Gauge` implementing `IDisposable` and unsubscribing in `Dispose` turns "leaked forever" back into "reachable only until something says otherwise" — and a `using` declaration inside the loop supplies exactly that "otherwise" at the end of each iteration:

```csharp run id=event-fixed
var sensor = new TemperatureSensor();
var tracked = AttachGauges(sensor, count: 500);

GC.Collect();
GC.WaitForPendingFinalizers();
GC.Collect();

int alive = tracked.Count(r => r.IsAlive);
Console.WriteLine(
    $"fixed: {alive} / {tracked.Count} gauges alive");

static List<WeakReference> AttachGauges(
    TemperatureSensor sensor, int count)
{
    var tracked = new List<WeakReference>();
    for (int i = 0; i < count; i++)
    {
        using var gauge = new Gauge(sensor, i);
        tracked.Add(new WeakReference(gauge));
    }
    return tracked;
}

class TemperatureSensor
{
    public event EventHandler<double>? ReadingReceived;
    public void Publish(double c) =>
        ReadingReceived?.Invoke(this, c);
}

sealed class Gauge : IDisposable
{
    private readonly TemperatureSensor _sensor;

    public Gauge(TemperatureSensor sensor, int id)
    {
        _sensor = sensor;
        sensor.ReadingReceived += OnReading;
    }

    public void Dispose() =>
        _sensor.ReadingReceived -= OnReading;

    private void OnReading(
        object? sender, double celsius) { }
}
```

```text output
fixed: 0 / 500 gauges alive
```

`using var gauge` disposes the gauge at the end of each loop iteration, `Dispose` removes the delegate from `sensor.ReadingReceived`, and once that reference is gone nothing roots the gauge anymore — all five hundred are collected. This particular fix only makes sense because the demo's gauges are meant to stop listening immediately; a real subscriber usually needs to unsubscribe when *it*, not the publisher, is done — typically from its own `Dispose`, called by whoever owns it.

::::exercise[Predict it: partial cleanup]
Change `AttachGauges` so that only the first 250 of the 500 gauges get `using var` (the rest are created with a plain `var`, never disposed). Predict how many of the 500 `WeakReference`s report `IsAlive` after the same two-round collection, then run it.

:::solution
```csharp run id=event-partial
var sensor = new TemperatureSensor();
var tracked = AttachGauges(sensor, count: 500);

GC.Collect();
GC.WaitForPendingFinalizers();
GC.Collect();

int alive = tracked.Count(r => r.IsAlive);
Console.WriteLine(
    $"partial: {alive} / {tracked.Count} alive");

static List<WeakReference> AttachGauges(
    TemperatureSensor sensor, int count)
{
    var tracked = new List<WeakReference>();
    for (int i = 0; i < count; i++)
    {
        if (i < 250)
        {
            using var gauge = new Gauge(sensor, i);
            tracked.Add(new WeakReference(gauge));
        }
        else
        {
            var gauge = new Gauge(sensor, i);
            tracked.Add(new WeakReference(gauge));
        }
    }
    return tracked;
}

class TemperatureSensor
{
    public event EventHandler<double>? ReadingReceived;
    public void Publish(double c) =>
        ReadingReceived?.Invoke(this, c);
}

sealed class Gauge : IDisposable
{
    private readonly TemperatureSensor _sensor;

    public Gauge(TemperatureSensor sensor, int id)
    {
        _sensor = sensor;
        sensor.ReadingReceived += OnReading;
    }

    public void Dispose() =>
        _sensor.ReadingReceived -= OnReading;

    private void OnReading(
        object? sender, double celsius) { }
}
```

```text output
partial: 250 / 500 alive
```

Each gauge's fate is decided independently, by whether *its own* subscription was removed, not by anything about the other 499. The 250 disposed gauges are unsubscribed and collected; the 250 that were only assigned to a plain `var` are still in `sensor.ReadingReceived`'s delegate list, still reachable through the rooted `sensor`, and still alive.
:::
::::

## How do you check any of this without guessing?

Everything measured on this page reduces to three tools. `GC.CollectionCount(generation)` counts collections since the process started, which is what turned "generation 0 collects far more often than generation 2" from a claim into a number above. `GC.GetAllocatedBytesForCurrentThread` reports bytes allocated on the managed heap by the calling thread, which is how [Value Types vs Reference Types](/csharp-dotnet/value-types-vs-reference-types/) measures what boxing and struct arrays actually cost — the same technique applies to checking whether a piece of code allocates at all. And `WeakReference`, used throughout this page, is the only reliable way to ask "would this object survive a collection if I stopped holding it?" — reading `.IsAlive` after a `GC.Collect()` is a direct answer, where reasoning about the object graph by eye is easy to get wrong once an event or a cache is involved.

:::note
For a running process you can't add `WeakReference` probes to, the `dotnet-counters` and `dotnet-trace` diagnostic tools read the same kind of collection counts and allocation events from outside, without changing the program. Neither is exercised on this page, because that measurement is external tooling, not C# you can read next to its output.
:::

::::exercise[Prove it: make the check mean something]
A test tries to confirm a cache entry is collectible by writing this, immediately after adding it:

```csharp run id=isalive-too-soon
var cache = new List<object> { new byte[10] };

var tracker = new WeakReference(cache[0]);
Console.WriteLine(tracker.IsAlive);
```

```text output
True
```

An assertion built on this always passes, leak or no leak, because no collection has happened yet and `cache` still holds the item. Prove that the check can be made to mean something: drop the item's only strong reference, force a real collection, and show `IsAlive` correctly reporting `False` once nothing keeps the object alive.

:::solution
```csharp run id=isalive-proven
#:property Optimize=true
var cache = new List<object>();
object? item = new byte[10];
cache.Add(item);

var tracker = new WeakReference(item);
Console.WriteLine($"before: {tracker.IsAlive}");

cache.Clear();
item = null;
GC.Collect();
GC.WaitForPendingFinalizers();

Console.WriteLine($"after:  {tracker.IsAlive}");
```

```text output
before: True
after:  False
```

`WeakReference` reports whether the collector *has* reclaimed the object, not whether it *would* if given the chance, so a meaningful check needs every strong reference to the probed item dropped — both `cache.Clear()` and the local `item` set to `null` — then `GC.Collect()` and `GC.WaitForPendingFinalizers()`, before reading `IsAlive`, exactly as every measurement on this page does.
:::
::::
