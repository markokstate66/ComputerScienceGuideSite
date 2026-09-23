---
title: "Race Conditions, Locks and Deadlocks in C#"
description: "A shared counter loses updates on purpose, fixed with lock and Interlocked; a real deadlock is reproduced, caught with a timeout, then fixed by ordering locks."
pillar: operating-systems
order: 2
author: markus
published: 2026-09-22
updated: 2026-09-22
level: intermediate
tags: [race-condition, locks, deadlock, interlocked, concurrency]
prerequisites: ["operating-systems/processes-and-threads"]
sources:
  - title: "The lock statement"
    url: "https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/statements/lock"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Monitor.TryEnter Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.threading.monitor.tryenter"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Interlocked Class"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.threading.interlocked"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "SemaphoreSlim Class"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.threading.semaphoreslim"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Thread-Safe Collections"
    url: "https://learn.microsoft.com/en-us/dotnet/standard/collections/thread-safe/"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "ConcurrentDictionary<TKey,TValue>.AddOrUpdate Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.concurrent.concurrentdictionary-2.addorupdate"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Operating Systems: Three Easy Pieces, chapter 32: Common Concurrency Problems"
    url: "https://pages.cs.wisc.edu/~remzi/OSTEP/threads-bugs.pdf"
    publisher: "Arpaci-Dusseau Books"
    accessed: 2026-09-22
draft: false
---

Run the program below and it prints a number that is wrong. Not wrong because of a typo or an off-by-one; wrong because four [threads](/glossary/#thread) added to the same counter eight million times between them, and some of those additions never happened.

## Two million increments per thread, one lost update

```csharp run id=lost-update
const int Threads = 4;
const int IncrementsPerThread = 2_000_000;
long counter = 0;

var workers = new Thread[Threads];
for (int i = 0; i < Threads; i++)
{
    workers[i] = new Thread(() =>
    {
        for (int j = 0; j < IncrementsPerThread; j++)
            counter++;   // read, add 1, write: three steps
    });
}
foreach (var w in workers) w.Start();
foreach (var w in workers) w.Join();

long expected = (long)Threads * IncrementsPerThread;
Console.WriteLine($"expected: {expected:N0}");
Console.WriteLine($"actual:   {counter:N0}");
Console.WriteLine($"lost:     {expected - counter:N0}");
Console.WriteLine($"counter == expected: {counter == expected}");
```

```text output
expected: 8,000,000
actual:   [...]
lost:     [...]
counter == expected: False
```

`counter` is a plain `long`, `counter++` reads it, and every one of the 8,000,000 additions ran. Yet the total is short, and it is short by a different amount every time you run this: on the test machine (.NET 10.0.401, Windows 11, x64, Core i7-11700K, 8 cores/16 logical processors) five runs lost between roughly 4.7 and 5.9 million of the 8,000,000 increments, never zero. The exact figure depends on how the scheduler happened to interleave four two-million-iteration loops on that run, which is why the program checks `counter == expected` itself rather than printing a number you'd have to take on faith: that line reads `False` on every run, on this machine, even though the two numbers above it change. This is a [race condition](/glossary/#race-condition): the result depends on timing that neither thread controls.

## `counter++` is three steps, not one

Nothing here is a compiler bug. `counter++` on a shared field compiles to a read, an addition and a write, and the CPU can be interrupted between any of them. Microsoft's own description of `Interlocked.Increment` explains why the plain version breaks: "on most computers, incrementing a variable is not an atomic operation," and without a synchronizing method a thread can be preempted after the load and the add, another thread can run the same three steps to completion, and when the first thread resumes it overwrites the instance variable with a value computed before the second thread's write ever happened ([Interlocked Class](https://learn.microsoft.com/en-us/dotnet/api/system.threading.interlocked)). The diagram below is exactly that sequence with two threads and one counter.

<figure class="diagram">
<svg viewBox="0 0 360 350" role="img" aria-labelledby="race-title race-desc">
<title id="race-title">Two threads interleaving a read-modify-write on one counter</title>
<desc id="race-desc">Four steps in time order down the page. Thread A reads the counter as 0, thread B also reads it as 0, thread A writes 1, then thread B writes 1 too, so thread A's write is overwritten and lost.</desc>
<text x="10" y="18" class="d-bold">counter = 0, two threads each add 1</text>
<text x="55" y="38" text-anchor="middle" class="d-small d-muted">thread A</text>
<text x="305" y="38" text-anchor="middle" class="d-small d-muted">thread B</text>
<rect x="10" y="46" width="90" height="30" rx="5" class="d-box-2"/>
<text x="55" y="66" text-anchor="middle" class="d-mono d-small">read: 0</text>
<text x="178" y="66" text-anchor="middle" class="d-small d-muted">t1</text>
<text x="10" y="90" class="d-small d-muted">A's local copy is now 0</text>
<rect x="260" y="104" width="90" height="30" rx="5" class="d-box-2"/>
<text x="305" y="124" text-anchor="middle" class="d-mono d-small">read: 0</text>
<text x="178" y="124" text-anchor="middle" class="d-small d-muted">t2</text>
<text x="10" y="148" class="d-small d-muted">B's local copy is 0 too</text>
<rect x="10" y="162" width="90" height="30" rx="5" class="d-box-2"/>
<text x="55" y="182" text-anchor="middle" class="d-mono d-small">write: 1</text>
<text x="178" y="182" text-anchor="middle" class="d-small d-muted">t3</text>
<text x="10" y="206" class="d-small d-muted">shared counter becomes 1</text>
<rect x="260" y="220" width="90" height="30" rx="5" class="d-box-bad"/>
<text x="305" y="240" text-anchor="middle" class="d-mono d-small d-bold">write: 1</text>
<text x="178" y="240" text-anchor="middle" class="d-small d-muted">t4</text>
<text x="10" y="264" class="d-small d-text-bad">counter is still 1: A's write is gone</text>
<path d="M10 280 H350" class="d-line d-dashed"/>
<text x="10" y="302" class="d-small d-text-bad d-bold">result: counter = 1 after two increments</text>
<text x="10" y="320" class="d-small d-muted">expected: counter = 2</text>
</svg>
<figcaption>Figure 1. Both threads read the same starting value before either writes, so one write clobbers the other. Neither thread did anything wrong on its own; the three steps of `counter++` were never one step.</figcaption>
</figure>

Nothing forces the four steps in the demo above to interleave that exact way every time, which is exactly the problem: on a single core, one thread's three steps would usually finish before the next thread's `counter++` starts, and the count would come out right by luck rather than by design. Two million iterations per thread on eight real cores gives the scheduler millions of chances to interrupt a thread between the read and the write, which is why the loss is large and repeatable here rather than a one-in-a-million fluke.

## Making the increment atomic: `lock`

The `lock` statement acquires "the mutual-exclusion lock for a given object, executes a statement block, and then releases the lock," blocking every other thread that tries to acquire the same object until it is released ([The lock statement](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/statements/lock)). Wrapping the increment in a `lock` on one dedicated object shared by every thread turns the three steps back into one, as far as any other thread can observe:

```csharp run id=with-lock
const int Threads = 4;
const int IncrementsPerThread = 2_000_000;
long counter = 0;
object gate = new();

var workers = new Thread[Threads];
for (int i = 0; i < Threads; i++)
{
    workers[i] = new Thread(() =>
    {
        for (int j = 0; j < IncrementsPerThread; j++)
            lock (gate) { counter++; }
    });
}
foreach (var w in workers) w.Start();
foreach (var w in workers) w.Join();

long expected = (long)Threads * IncrementsPerThread;
Console.WriteLine($"counter == expected: {counter == expected}");
```

```text output
counter == expected: True
```

`gate` exists for no other reason than to be locked; that's the guidance behind the example, which uses one dedicated instance and warns specifically against locking on `this`, a `Type` object or a string, because code you don't control might lock the same value for an unrelated reason and serialize against you by accident ([The lock statement](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/statements/lock)). Under the hood, `lock (gate) { counter++; }` compiles to a `Monitor.Enter`/`Monitor.Exit` pair wrapped in `try`/`finally`, so the lock is released even if the guarded code throws.

:::dotnet
Since .NET 9 and C# 13, that same guidance recommends a `System.Threading.Lock` instead of `object` for the dedicated instance, "for best performance": `gate` could be declared `Lock gate = new();` in place of `object gate = new();`. When the compiler can see that a locked expression's static type is `Lock`, `lock (gate)` compiles to `gate.EnterScope()` rather than `Monitor.Enter`/`Monitor.Exit`. Plain `lock (object)`, the form used throughout this article, still compiles and still works; it just doesn't take that faster path ([The lock statement](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/statements/lock)).
:::

## Making the increment atomic: `Interlocked`

`Interlocked.Increment` gets the same result a different way: it performs the load, add and store as a single hardware-level atomic operation rather than serializing threads through a lock. The `Interlocked` class also has `Add`, `Decrement`, `Exchange` and `CompareExchange`, all described as atomic operations for variables shared by multiple threads ([Interlocked Class](https://learn.microsoft.com/en-us/dotnet/api/system.threading.interlocked)):

```csharp run id=with-interlocked
const int Threads = 4;
const int IncrementsPerThread = 2_000_000;
long counter = 0;

var workers = new Thread[Threads];
for (int i = 0; i < Threads; i++)
{
    workers[i] = new Thread(() =>
    {
        for (int j = 0; j < IncrementsPerThread; j++)
            Interlocked.Increment(ref counter);
    });
}
foreach (var w in workers) w.Start();
foreach (var w in workers) w.Join();

long expected = (long)Threads * IncrementsPerThread;
Console.WriteLine($"counter == expected: {counter == expected}");
```

```text output
counter == expected: True
```

`Interlocked` only reaches as far as the one operation you call. It cannot protect an invariant that spans two fields (`Balance` and `LastUpdated` staying consistent with each other, say), because nothing stops another thread from running between two separate `Interlocked` calls; that needs `lock`, which holds a critical section open across as many statements as you put inside it. Prefer `Interlocked` for a single counter or flag, and `lock` the moment more than one piece of state has to change together.

:::pitfall
Switching the writes to `Interlocked.Increment` does not make every read of `counter` safe. The `Interlocked` class documentation is explicit that you must "ensure that any write or read access to a shared variable is atomic," not just the increments, because a plain read racing an in-progress `Interlocked` write can still observe a value from partway through the update on some platforms ([Interlocked Class](https://learn.microsoft.com/en-us/dotnet/api/system.threading.interlocked)). Read a value you plan to publish with `Interlocked.Read` (for a `long` on a 32-bit runtime) or `Interlocked.CompareExchange(ref counter, 0, 0)`, not a bare field access.
:::

::::exercise[A lock that locks nothing]
This program looks like the fix above: every increment happens inside a `lock`. It still loses updates. Run it, then explain why.

```csharp run id=fake-fix
const int Threads = 4;
const int IncrementsPerThread = 2_000_000;
long counter = 0;

var workers = new Thread[Threads];
for (int i = 0; i < Threads; i++)
{
    workers[i] = new Thread(() =>
    {
        for (int j = 0; j < IncrementsPerThread; j++)
            lock (new object()) { counter++; }
    });
}
foreach (var w in workers) w.Start();
foreach (var w in workers) w.Join();

long expected = (long)Threads * IncrementsPerThread;
Console.WriteLine($"counter == expected: {counter == expected}");
```

```text output
counter == expected: False
```

:::solution
`lock (x)` only blocks another thread that locks the *same object reference* `x`. `new object()` allocates a fresh, unique object on every call, so every increment locks an object that no other thread will ever try to acquire; the `lock` keyword is doing real work, just work with no effect, since it always succeeds instantly against a lock nobody else contends for. This is the mistake the lock statement's own guidance is aimed at when it says to lock "a dedicated object instance": dedicated means one instance, shared by every thread that touches the protected data, not a fresh one per call.
:::
::::

## What locking costs

`lock` and `Interlocked` both fix the race, but they are not free, and not equally expensive. This program times 8,000,000 increments done the two ways, one after the other:

```csharp run id=cost
using System.Diagnostics;

const int Threads = 4;
const int IncrementsPerThread = 2_000_000;

long RunWithLock()
{
    long counter = 0;
    object gate = new();
    var sw = Stopwatch.StartNew();
    var workers = new Thread[Threads];
    for (int i = 0; i < Threads; i++)
        workers[i] = new Thread(() =>
        {
            for (int j = 0; j < IncrementsPerThread; j++)
                lock (gate) { counter++; }
        });
    foreach (var w in workers) w.Start();
    foreach (var w in workers) w.Join();
    sw.Stop();
    return sw.ElapsedMilliseconds;
}

long RunWithInterlocked()
{
    long counter = 0;
    var sw = Stopwatch.StartNew();
    var workers = new Thread[Threads];
    for (int i = 0; i < Threads; i++)
        workers[i] = new Thread(() =>
        {
            for (int j = 0; j < IncrementsPerThread; j++)
                Interlocked.Increment(ref counter);
        });
    foreach (var w in workers) w.Start();
    foreach (var w in workers) w.Join();
    sw.Stop();
    return sw.ElapsedMilliseconds;
}

Console.WriteLine($"lock:        {RunWithLock(),4} ms");
Console.WriteLine($"Interlocked: {RunWithInterlocked(),4} ms");
```

```text output
lock:        [...] ms
Interlocked: [...] ms
```

Two runs on the test machine gave 362-380 ms for the locked version against 88-102 ms for `Interlocked`: roughly four times slower under heavy contention from four threads hammering the same counter. `lock` pays for a kernel-aware wait and wake path when a thread finds the lock held; `Interlocked.Increment` compiles to one locked CPU instruction with no thread ever blocked. That gap is specific to this contended, nothing-but-increments workload; a `lock` guarding a few statements that run occasionally will not show up in a profiler at all. Reach for `Interlocked` because a single field is all you need to protect, not because a benchmark says so.

## Reproducing a deadlock, on purpose

A lock that fixes one race can create a different bug once there is more than one lock. If thread A holds lock 1 and wants lock 2, while thread B holds lock 2 and wants lock 1, neither thread can ever proceed: each is waiting on a lock the other refuses to give up. This is a deadlock, and *Operating Systems: Three Easy Pieces* states the four conditions that must all hold for one to happen: mutual exclusion (a thread holds a resource exclusively), hold-and-wait (a thread keeps what it has while waiting for more), no preemption (a held resource can't be forcibly taken away) and circular wait (a cycle of threads each waiting on the next) ([OSTEP chapter 32](https://pages.cs.wisc.edu/~remzi/OSTEP/threads-bugs.pdf)). `lock` gives you the first three for free: it's exclusive, a thread waiting for a second lock keeps the first, and nothing can preempt it. The fourth condition, a cycle, is the one your code creates or avoids.

<figure class="diagram">
<svg viewBox="0 0 360 300" role="img" aria-labelledby="deadlock-title deadlock-desc">
<title id="deadlock-title">A two-thread cycle in the wait-for graph</title>
<desc id="deadlock-desc">Thread A holds lock A and is blocked wanting lock B. Thread B holds lock B and is blocked wanting lock A. The two wait arrows form a cycle, which is a deadlock.</desc>
<defs>
<marker id="deadlock-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-bad"/></marker>
</defs>
<rect x="60" y="14" width="240" height="54" rx="8" class="d-box-accent"/>
<text x="180" y="36" text-anchor="middle" class="d-bold">thread A</text>
<text x="180" y="56" text-anchor="middle" class="d-mono d-small">holds lock A</text>
<rect x="60" y="222" width="240" height="54" rx="8" class="d-box-accent"/>
<text x="180" y="244" text-anchor="middle" class="d-bold">thread B</text>
<text x="180" y="264" text-anchor="middle" class="d-mono d-small">holds lock B</text>
<path d="M232 68 V222" class="d-bad d-dashed" marker-end="url(#deadlock-arrow)"/>
<text x="240" y="130" class="d-small d-text-bad">wants</text>
<text x="240" y="146" class="d-small d-text-bad">lock B</text>
<path d="M128 222 V68" class="d-bad d-dashed" marker-end="url(#deadlock-arrow)"/>
<text x="64" y="130" class="d-small d-text-bad">wants</text>
<text x="64" y="146" class="d-small d-text-bad">lock A</text>
</svg>
<figcaption>Figure 2. A cycle in the wait-for graph: A waits for a lock B holds, B waits for a lock A holds, and neither can move. That cycle is what "deadlock" means.</figcaption>
</figure>

A deadlock's whole nature makes it awkward to put in an article that has to finish running: left alone, both threads below would block forever and the test harness that checks this page would time out. Instead of hoping two `lock` statements happen to collide, the program forces the collision with a `CountdownEvent` so each thread is guaranteed to be holding its first lock before either reaches for its second, and it detects the resulting deadlock with `Monitor.TryEnter(object, TimeSpan)`, an overload that blocks only up to the given timeout and returns `false` instead of hanging forever ([Monitor.TryEnter Method](https://learn.microsoft.com/en-us/dotnet/api/system.threading.monitor.tryenter)):

```csharp run id=deadlock
object lockA = new();
object lockB = new();
using CountdownEvent bothHolding = new(2);
bool aTimedOut = false, bTimedOut = false;

Thread threadA = new(() =>
{
    lock (lockA)
    {
        bothHolding.Signal();
        bothHolding.Wait();
        aTimedOut =
            !Monitor.TryEnter(lockB, TimeSpan.FromSeconds(1));
    }
});

Thread threadB = new(() =>
{
    lock (lockB)
    {
        bothHolding.Signal();
        bothHolding.Wait();
        bTimedOut =
            !Monitor.TryEnter(lockA, TimeSpan.FromSeconds(1));
    }
});

threadA.Start();
threadB.Start();
threadA.Join();
threadB.Join();
Console.WriteLine($"A timed out waiting for B: {aTimedOut}");
Console.WriteLine($"B timed out waiting for A: {bTimedOut}");
```

```text output
A timed out waiting for B: True
B timed out waiting for A: True
```

`bothHolding.Wait()` is what makes this reproduce every time rather than most of the time: without it, one thread might grab both locks before the other starts and no deadlock would occur on that run. With it, thread A cannot proceed past the barrier until it already holds `lockA`, and neither can thread B without `lockB`, so by the time either calls `TryEnter` the cycle is already real. Both calls block for the full second and both return `false`: a genuine deadlock, caught rather than suffered.

## Breaking the cycle: ordering the locks

The fix removes the circular-wait condition, the one condition `lock` doesn't give you automatically. OSTEP calls this "probably the most practical prevention technique": write the locking code so that every thread acquires a shared set of locks in the same order, however many code paths lead there. With two locks and a total order of "always lockA before lockB," no thread can be holding lockB while waiting for lockA, so the cycle in Figure 2 can't form ([OSTEP chapter 32](https://pages.cs.wisc.edu/~remzi/OSTEP/threads-bugs.pdf)):

```csharp run id=ordered
object lockA = new();
object lockB = new();
using CountdownEvent bothStarted = new(2);
int completed = 0;

void RunOrdered()
{
    bothStarted.Signal();
    bothStarted.Wait();
    lock (lockA)
    {
        lock (lockB)
        {
            Interlocked.Increment(ref completed);
        }
    }
}

Thread threadA = new(RunOrdered);
Thread threadB = new(RunOrdered);
threadA.Start();
threadB.Start();
bool aDone = threadA.Join(TimeSpan.FromSeconds(5));
bool bDone = threadB.Join(TimeSpan.FromSeconds(5));
Console.WriteLine($"both threads finished: {aDone && bDone}");
Console.WriteLine($"completed: {completed}");
```

```text output
both threads finished: True
completed: 2
```

Both threads now race for `lockA` first. Whichever loses that race simply waits, the way any lock contention works; it never gets to hold `lockB` while blocked on `lockA`, so there is no second thread for a cycle to go through. A total order across every lock in a program is easy to state and hard to keep once there are more than two or three locks, which is why OSTEP also describes a *partial* order — grouping related locks and ordering within each group — as the practical compromise for larger systems ([OSTEP chapter 32](https://pages.cs.wisc.edu/~remzi/OSTEP/threads-bugs.pdf)).

::::exercise[Three threads, three locks]
Deadlocks aren't limited to two threads. Below, thread A holds `lockA` and wants `lockB`; thread B holds `lockB` and wants `lockC`; thread C holds `lockC` and wants `lockA`. Before running it, decide: does the same `CountdownEvent` trick force all three into a genuine three-way deadlock, or does one of them get lucky?

```csharp run id=ring
object lockA = new(), lockB = new(), lockC = new();
using CountdownEvent allHolding = new(3);
bool aTimedOut = false, bTimedOut = false, cTimedOut = false;

void HoldThenWant(object mine, object wanted, Action<bool> report)
{
    lock (mine)
    {
        allHolding.Signal();
        allHolding.Wait();
        report(!Monitor.TryEnter(wanted, TimeSpan.FromSeconds(1)));
    }
}

Thread threadA = new(() =>
    HoldThenWant(lockA, lockB, v => aTimedOut = v));
Thread threadB = new(() =>
    HoldThenWant(lockB, lockC, v => bTimedOut = v));
Thread threadC = new(() =>
    HoldThenWant(lockC, lockA, v => cTimedOut = v));
threadA.Start();
threadB.Start();
threadC.Start();
threadA.Join();
threadB.Join();
threadC.Join();
Console.WriteLine($"A timed out waiting for B: {aTimedOut}");
Console.WriteLine($"B timed out waiting for C: {bTimedOut}");
Console.WriteLine($"C timed out waiting for A: {cTimedOut}");
```

:::solution
```text output
A timed out waiting for B: True
B timed out waiting for C: True
C timed out waiting for A: True
```

All three time out. The `CountdownEvent` guarantees every thread is already holding its own lock before any of them tries for the next one, exactly as in the two-thread version, so by the time `TryEnter` runs, A holds `lockA` and wants `lockB`, B holds `lockB` and wants `lockC`, and C holds `lockC` and wants `lockA`: a three-node cycle instead of a two-node one, but still a cycle. Circular wait doesn't require exactly two participants; it requires a cycle of any length in the wait-for graph. A total lock order still fixes it (acquire `lockA`, then `lockB`, then `lockC`, never the reverse), because a total order makes a cycle impossible regardless of how many locks are in it.
:::
::::

## Waiting for more than one thing at a time: `SemaphoreSlim`

`lock` grants access to one thread at a time. Sometimes the resource being protected can safely serve more than one caller at once, up to a limit, which is what `SemaphoreSlim` is for: it "limits the number of threads that can access a resource or pool of resources concurrently," constructed with an initial and maximum count, entered with `Wait` or the awaitable `WaitAsync`, and given back with `Release` ([SemaphoreSlim Class](https://learn.microsoft.com/en-us/dotnet/api/system.threading.semaphoreslim)):

```csharp run id=semaphore
using SemaphoreSlim gate = new(initialCount: 2, maxCount: 2);
int active = 0, peak = 0;
object statsGate = new();

void UseResource()
{
    gate.Wait();
    try
    {
        lock (statsGate)
        {
            active++;
            peak = Math.Max(peak, active);
        }
        Thread.Sleep(50);   // stand-in for real work
        lock (statsGate) { active--; }
    }
    finally
    {
        gate.Release();
    }
}

var workers = new Thread[6];
for (int i = 0; i < workers.Length; i++)
    workers[i] = new Thread(UseResource);
foreach (var w in workers) w.Start();
foreach (var w in workers) w.Join();

Console.WriteLine($"peak concurrent users: {peak}");
```

```text output
peak concurrent users: 2
```

Six threads want the resource; the semaphore lets at most two run `UseResource`'s body at once and makes the rest wait their turn, and `peak` never rises above the `maxCount` of 2 no matter how the six threads are scheduled. `SemaphoreSlim` also differs from `lock` in a way that matters for `async` code: it "doesn't enforce thread or task identity" on `Wait`, `WaitAsync` and `Release` ([SemaphoreSlim Class](https://learn.microsoft.com/en-us/dotnet/api/system.threading.semaphoreslim)), so one thread (or one continuation, after an `await`) can acquire it and a different one can release it. `lock` cannot do that: a `Monitor`-based lock must be released by the same thread that entered it, which is also why C# refuses to let you `await` inside a `lock` block.

::::exercise[How much does the limit cost]
Six workers each need 50 ms with the resource. Measure the total wall-clock time with `SemaphoreSlim` limits of 1 and of 6, and check whether the ratio is roughly what you'd predict from `6 / limit`.

:::solution
```csharp run id=measure-semaphore
using System.Diagnostics;

long RunWithLimit(int limit)
{
    using SemaphoreSlim gate = new(limit, limit);
    var sw = Stopwatch.StartNew();
    var workers = new Thread[6];
    for (int i = 0; i < workers.Length; i++)
    {
        workers[i] = new Thread(() =>
        {
            gate.Wait();
            try { Thread.Sleep(50); }
            finally { gate.Release(); }
        });
    }
    foreach (var w in workers) w.Start();
    foreach (var w in workers) w.Join();
    sw.Stop();
    return sw.ElapsedMilliseconds;
}

long oneAtATime = RunWithLimit(1);
long sixAtOnce = RunWithLimit(6);
Console.WriteLine($"limit 1: {oneAtATime,4} ms");
Console.WriteLine($"limit 6: {sixAtOnce,4} ms");
Console.WriteLine(
    $"limit 1 slower than limit 6: {oneAtATime > sixAtOnce}");
```

```text output
limit 1: [...] ms
limit 6: [...] ms
limit 1 slower than limit 6: True
```

On the test machine, limit 1 took roughly 360-375 ms (six 50 ms turns run one after another, plus scheduling overhead: about `6 * 50`) and limit 6 took roughly 63-65 ms (all six run at once, so the total is close to one 50 ms turn). The ratio is close to 6, matching `6 / limit` for both `limit = 1` (ratio 6) and `limit = 6` (ratio 1); it isn't exact because `Thread.Sleep` only promises to wait *at least* the requested time, and thread start-up adds a little more.
:::
::::

## Collections that do their own locking

The counter demos all protect a single value; a server tallying hits per page has many. Locking a plain `Dictionary<TKey,TValue>` by hand works but serializes every key behind one lock, even keys no two threads are touching at the same time. `System.Collections.Concurrent` types manage their own synchronization: `ConcurrentQueue<T>` and `ConcurrentStack<T>` use `Interlocked` operations internally and never take a lock at all ([Thread-Safe Collections](https://learn.microsoft.com/en-us/dotnet/standard/collections/thread-safe/)), while `ConcurrentDictionary<TKey,TValue>` uses fine-grained locking so that unrelated keys don't contend with each other ([AddOrUpdate Method](https://learn.microsoft.com/en-us/dotnet/api/system.collections.concurrent.concurrentdictionary-2.addorupdate)):

```csharp run id=concurrent-dictionary
using System.Collections.Concurrent;

const int Threads = 4;
const int IncrementsPerThread = 500_000;
var hits = new ConcurrentDictionary<string, long>();

var workers = new Thread[Threads];
for (int i = 0; i < Threads; i++)
{
    workers[i] = new Thread(() =>
    {
        for (int j = 0; j < IncrementsPerThread; j++)
            hits.AddOrUpdate("page-views", 1, (_, old) => old + 1);
    });
}
foreach (var w in workers) w.Start();
foreach (var w in workers) w.Join();

long expected = (long)Threads * IncrementsPerThread;
Console.WriteLine(
    $"hits[\"page-views\"] == expected: {hits["page-views"] == expected}");
```

```text output
hits["page-views"] == expected: True
```

`AddOrUpdate(key, addValue, updateValueFactory)` reads the current value for the key and replaces it with `updateValueFactory`'s result, and the two million calls above land on the same key from four threads without losing one, which is the entire point of a concurrent collection: no `lock` statement appears anywhere in this program. It comes with a sharper edge than a plain `lock`, though. The documentation warns that the update delegate "may be executed multiple times" under contention, because it runs outside the dictionary's internal lock so that arbitrary user code never runs while that lock is held, and `AddOrUpdate` is therefore "not atomic with regards to all other operations" on the dictionary ([AddOrUpdate Method](https://learn.microsoft.com/en-us/dotnet/api/system.collections.concurrent.concurrentdictionary-2.addorupdate)). `old => old + 1` is safe to call twice because it has no side effect beyond its return value; an update factory that sends an email or writes a file would send it more than once.

## Two accounts, two locks, one bug

A lock-ordering bug rarely looks like the abstract `lockA`/`lockB` example. It usually looks like a transfer function, called both ways round. `Transfer(from, to, amount)` below locks `from` before `to`, which is fine for any one transfer, and wrong the moment two transfers run in opposite directions at the same time:

```csharp run id=transfer-naive
using CountdownEvent bothStarted = new(2);
var accA = new Account(1, 100m);
var accB = new Account(2, 100m);
bool stalled = false;

// Locks `from` before `to`, in whichever order the caller passes.
void Transfer(Account from, Account to, decimal amount)
{
    lock (from.Gate)
    {
        bothStarted.Signal();
        bothStarted.Wait();
        if (!Monitor.TryEnter(to.Gate, TimeSpan.FromSeconds(1)))
        {
            stalled = true;
            return;
        }
        from.Balance -= amount;
        to.Balance += amount;
        Monitor.Exit(to.Gate);
    }
}

Thread t1 = new(() => Transfer(accA, accB, 10m));   // A then B
Thread t2 = new(() => Transfer(accB, accA, 5m));    // B then A
t1.Start();
t2.Start();
t1.Join();
t2.Join();
Console.WriteLine($"a transfer stalled: {stalled}");

class Account(int id, decimal balance)
{
    public int Id { get; } = id;
    public decimal Balance { get; set; } = balance;
    public readonly object Gate = new();
}
```

```text output
a transfer stalled: True
```

`t1` transfers from A to B and locks A first; `t2` transfers from B to A and locks B first. The `CountdownEvent` guarantees both threads are already holding their first account's lock before either reaches for the second, so `t1` wants B's lock while holding A's, and `t2` wants A's lock while holding B's: the same cycle as Figure 2, dressed up as a money transfer.

::::exercise[Fix the transfer]
Change `Transfer` so that concurrent transfers in opposite directions can't deadlock, without changing what a transfer does. Each `Account` already has a unique `Id`.

:::solution
Order the two locks by something that doesn't depend on which parameter is `from` and which is `to` — `Account.Id` works, since it never changes:

```csharp run id=transfer-fixed
using CountdownEvent bothStarted = new(2);
var accA = new Account(1, 100m);
var accB = new Account(2, 100m);
bool stalled = false;

// Always locks the lower Id first, no matter which way money moves.
void Transfer(Account from, Account to, decimal amount)
{
    var (first, second) =
        from.Id < to.Id ? (from, to) : (to, from);
    bothStarted.Signal();
    bothStarted.Wait();
    lock (first.Gate)
    {
        if (!Monitor.TryEnter(second.Gate, TimeSpan.FromSeconds(1)))
        {
            stalled = true;
            return;
        }
        from.Balance -= amount;
        to.Balance += amount;
        Monitor.Exit(second.Gate);
    }
}

Thread t1 = new(() => Transfer(accA, accB, 10m));   // A then B
Thread t2 = new(() => Transfer(accB, accA, 5m));    // B then A
t1.Start();
t2.Start();
t1.Join();
t2.Join();
Console.WriteLine($"a transfer stalled: {stalled}");
Console.WriteLine($"balance A: {accA.Balance}");
Console.WriteLine($"balance B: {accB.Balance}");

class Account(int id, decimal balance)
{
    public int Id { get; } = id;
    public decimal Balance { get; set; } = balance;
    public readonly object Gate = new();
}
```

```text output
a transfer stalled: False
balance A: 95
balance B: 105
```

Both threads now agree on lock order regardless of transfer direction: `first` is always the account with the smaller `Id`. Whichever thread reaches `lockA` (account 1's gate) first proceeds through both locks and finishes; the other simply waits for it, the same as any two threads contending for one lock, and then runs its own transfer once the first is done. Neither thread can be holding account 2's lock while blocked on account 1's, so the cycle from the naive version can't form, and the two ordinary-looking transfers — minus 10 then plus 5, and plus 10 then minus 5, applied in some order — leave A at 95 and B at 105 every time.
:::
::::
