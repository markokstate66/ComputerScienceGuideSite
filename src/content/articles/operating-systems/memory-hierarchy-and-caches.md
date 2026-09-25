---
title: "The Memory Hierarchy and What Cache Lines Actually Cost"
description: "Read this machine's real cache sizes, time a latency ladder across them, then measure false sharing and struct-of-arrays layout changing real C# run times."
pillar: operating-systems
order: 6
author: markus
published: 2026-09-24
updated: 2026-09-24
level: advanced
tags: [cache-locality, cache-lines, false-sharing, memory-hierarchy, data-oriented-design]
prerequisites: ["data-structures/arrays-and-dynamic-arrays"]
sources:
  - title: "What Every Programmer Should Know About Memory, Part 2: CPU caches"
    url: "https://lwn.net/Articles/252125/"
    publisher: "LWN.net (Ulrich Drepper, Red Hat, 2007)"
    accessed: 2026-09-24
  - title: "What Every Programmer Should Know About Memory, Part 5: What programmers can do"
    url: "https://lwn.net/Articles/255364/"
    publisher: "LWN.net (Ulrich Drepper, Red Hat, 2007)"
    accessed: 2026-09-24
  - title: "What Every Programmer Should Know About Memory, Part 6: More things programmers can do"
    url: "https://lwn.net/Articles/256433/"
    publisher: "LWN.net (Ulrich Drepper, Red Hat, 2007)"
    accessed: 2026-09-24
  - title: "GetLogicalProcessorInformation function"
    url: "https://learn.microsoft.com/en-us/windows/win32/api/sysinfoapi/nf-sysinfoapi-getlogicalprocessorinformation"
    publisher: "Microsoft Learn"
    accessed: 2026-09-24
  - title: "CACHE_DESCRIPTOR (winnt.h)"
    url: "https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-cache_descriptor"
    publisher: "Microsoft Learn"
    accessed: 2026-09-24
  - title: "StructLayoutAttribute Class"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.runtime.interopservices.structlayoutattribute"
    publisher: "Microsoft Learn"
    accessed: 2026-09-24
draft: false
---

"Cache-friendly" gets thrown around as praise for code nobody has actually timed. This page asks a machine, not a slide deck: how big are its caches, how much does missing one really cost, and does rearranging a handful of fields in C# change a measured number. Every figure below is either read from the operating system through a small P/Invoke call or printed by a program you can see in full, run with `dotnet run`. Where the timing varies between runs, the output blocks say so with `[...]`, and the prose describes the shape rather than inventing a single "true" number.

## Reading your own cache sizes before trusting anyone else's table

Blog posts about caches love a table of "typical" sizes copied from one machine and reused for every reader's. Windows already knows the real numbers for the machine running this article, and .NET can ask for them without any native library beyond `kernel32.dll`. `GetLogicalProcessorInformation` fills a buffer with one `SYSTEM_LOGICAL_PROCESSOR_INFORMATION` record per core relationship it finds; the ones whose `Relationship` field is `RelationCache` carry a `CACHE_DESCRIPTOR` with `Level`, `Type`, `Size` and `LineSize` members ([CACHE_DESCRIPTOR](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-cache_descriptor)). The function is called twice, once to ask how large a buffer it needs and once to fill it — the same two calls its own reference example needs in the common case, though that example also loops back and retries if the size changes between calls ([GetLogicalProcessorInformation](https://learn.microsoft.com/en-us/windows/win32/api/sysinfoapi/nf-sysinfoapi-getlogicalprocessorinformation)):

```csharp run id=cacheinfo
using System.Runtime.InteropServices;

uint len = 0;
GetLogicalProcessorInformation(IntPtr.Zero, ref len);
IntPtr buffer = Marshal.AllocHGlobal((int)len);
try
{
    if (!GetLogicalProcessorInformation(buffer, ref len))
    {
        Console.WriteLine("call failed: " +
            Marshal.GetLastWin32Error());
        return;
    }
    int size = Marshal.SizeOf<Info>();
    int count = (int)len / size;
    var seen = new HashSet<string>();
    for (int i = 0; i < count; i++)
    {
        IntPtr item = IntPtr.Add(buffer, i * size);
        var info = Marshal.PtrToStructure<Info>(item);
        if (info.Relationship != 2) continue; // RelationCache
        var c = info.Cache;
        string line = $"L{c.Level} {TypeName(c.Type)} " +
            $"size={c.Size} line={c.LineSize} assoc={c.Associativity}";
        if (seen.Add(line)) Console.WriteLine(line);
    }
}
finally { Marshal.FreeHGlobal(buffer); }

static string TypeName(int t) => t switch
{
    0 => "Unified", 1 => "Instruction", 2 => "Data", _ => "Trace"
};

[DllImport("kernel32.dll", SetLastError = true)]
static extern bool GetLogicalProcessorInformation(
    IntPtr Buffer, ref uint ReturnedLength);

[StructLayout(LayoutKind.Sequential)]
struct Cache
{
    public byte Level, Associativity;
    public ushort LineSize;
    public uint Size;
    public int Type;
}

[StructLayout(LayoutKind.Explicit, Size = 32)]
struct Info
{
    [FieldOffset(0)] public UIntPtr ProcessorMask;
    [FieldOffset(8)] public int Relationship;
    [FieldOffset(16)] public Cache Cache;
}
```

```text output
L1 Data size=49152 line=64 assoc=12
L1 Instruction size=32768 line=64 assoc=8
L2 Unified size=524288 line=64 assoc=8
L3 Unified size=16777216 line=64 assoc=16
```

That is 48 KB of L1 data cache and 32 KB of L1 instructions per core, 512 KB of L2 per core, and 16 MB of L3 shared across every core on this eight-core machine (.NET 10.0.401, Windows 11, x64) — the same figures the [row- versus column-major measurement](/data-structures/arrays-and-dynamic-arrays/#why-the-column-first-loop-falls-off-a-cliff) in the arrays article found by asking Windows the same way. Every level reports a 64-byte `LineSize`, matching what Drepper's survey of cache designs calls the current norm, up from 32 bytes in early caches (["Part 2: CPU caches", §3.2](https://lwn.net/Articles/252125/)). A cache line, not a byte and not a word, is the unit that actually moves between a core and the memory behind it, and almost everything below follows from that one sentence.

## A ladder you can feel: timing a walk across those sizes

A cache only helps a program that revisits data while it is still resident. To make a program that cannot benefit from that, this one builds a single **cycle** through an array: starting anywhere and following `next[i]` visits every slot exactly once before returning to the start, in an order fixed by a shuffle. Nothing about the current index predicts the next one, so the processor's sequential prefetcher — which watches for a steady stride and starts fetching ahead of the program, described in the same section of Drepper's paper — has nothing to work with. Four buffer sizes are chosen to land inside L1, inside L2, inside L3, and past all three, using the sizes measured above:

```csharp run id=ladder
using System.Diagnostics;
using System.Globalization;

CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;

int[] sizesKb = { 16, 256, 2048, 32768 };
foreach (var kb in sizesKb)
{
    int n = kb * 1024 / sizeof(int);
    int[] next = BuildCycle(n, seed: 42);
    double ns = ChaseNsPerStep(next, steps: 30_000_000);
    Console.WriteLine(
        $"{kb,7} KB  n={n,9}  {ns,6:F2} ns/access");
}

// A single-cycle permutation: following `next` from any start
// visits every slot once before returning, so the processor
// can never predict the next address from the current one.
static int[] BuildCycle(int n, int seed)
{
    var order = new int[n];
    for (int i = 0; i < n; i++) order[i] = i;
    var rnd = new Random(seed);
    for (int i = n - 1; i > 0; i--)
    {
        int j = rnd.Next(i + 1);
        (order[i], order[j]) = (order[j], order[i]);
    }
    var next = new int[n];
    for (int i = 0; i < n; i++)
        next[order[i]] = order[(i + 1) % n];
    return next;
}

static double ChaseNsPerStep(int[] next, long steps)
{
    int i = 0;
    for (long k = 0; k < next.Length; k++) i = next[i]; // warm-up
    double best = double.MaxValue;
    long sum = 0; // read only here, so the JIT cannot drop the loop
    for (int run = 0; run < 3; run++)
    {
        long start = Stopwatch.GetTimestamp();
        for (long k = 0; k < steps; k++) { i = next[i]; sum += i; }
        double ns = Stopwatch.GetElapsedTime(start).TotalNanoseconds;
        best = Math.Min(best, ns / steps);
    }
    if (sum < 0) Console.WriteLine("unreachable: " + sum);
    return best;
}
```

```text output
     16 KB  n=     4096  [...] ns/access
    256 KB  n=    65536  [...] ns/access
   2048 KB  n=   524288  [...] ns/access
  32768 KB  n=  8388608  [...] ns/access
```

**The shape holds even though the numbers move.** Repeated runs on this machine keep the same shape: a little under two nanoseconds a step while the whole array sits in L1, roughly double that once it only fits in L2, a further jump — noisier, since L3 is shared with whatever else the eight cores are doing — once it only fits in L3, and well over a hundred nanoseconds once the array is 32 MB and every step misses all three levels and waits on RAM. Nothing here claims exact multipliers, because the L3-resident row moved by more than 3x between two runs recorded while writing this page; what stays constant is the order of the four numbers and that the last step change dwarfs the first two. Intel's own published cost table, which Drepper quotes for a Pentium M rather than measuring himself, describes the same shape in cycles rather than nanoseconds: roughly 3 cycles for an L1 hit, 14 for L2, and over 240 once main memory is involved, with the explicit caveat that the exact counts belong to that processor and only the "roughly an order of magnitude per level" pattern travels (["Part 2: CPU caches", §3.2](https://lwn.net/Articles/252125/)).

## Locality is the only reason any of this is worth exploiting

Drepper's advice to programmers reduces to one sentence: "improve locality (spatial and temporal) and align the code and data" (["Part 5: What programmers can do", §6.2](https://lwn.net/Articles/255364/)). **Temporal locality** is reusing the same address again soon; **spatial locality** is touching addresses that sit near each other. A cache is a bet that both are true of real programs, and the two demonstrations above are the bet's two failure modes on purpose: the pointer chase above has neither, which is why it pays close to the full RAM latency on its last row, and the [column-first traversal](/data-structures/arrays-and-dynamic-arrays/#why-the-column-first-loop-falls-off-a-cliff) in the arrays article has spatial locality within a row but none across the 4,000-element stride between reads, which is why it sits between the row-major and pointer-chase extremes rather than at either one.

Locality is not free once it is established, either: a thread that built up a working set in L1 and L2 loses that state the moment the operating system switches it out for another thread, which is one of the reasons a [context switch costs more than the register save alone](/operating-systems/processes-and-threads/#what-a-context-switch-costs). And an access pattern that keeps jumping to addresses more than a page apart, as the pointer chase above does once the buffer no longer fits in a handful of pages, pays a second, separate penalty from missing the [TLB](/operating-systems/virtual-memory/#why-is-there-a-tlb-and-what-does-a-miss-cost) as well as the cache — the 32 MB row above is almost certainly paying both.

<figure class="diagram">
<svg viewBox="0 0 340 470" role="img" aria-labelledby="pyramid-title pyramid-desc">
<title id="pyramid-title">The memory hierarchy, narrow and fast at the top, wide and slow at the bottom</title>
<desc id="pyramid-desc">Six stacked bands, widening from top to bottom: registers, L1, L2, L3, RAM, and SSD or network. Each band names its size and, where this page measured one, its access time; the bottom band is left unmeasured on purpose.</desc>
<rect x="110" y="10" width="120" height="46" rx="6" class="d-box-accent"/>
<text x="170" y="30" text-anchor="middle" class="d-bold">Registers</text>
<text x="170" y="46" text-anchor="middle" class="d-small">on-die, sub-nanosecond</text>
<path d="M170 56 V70" class="d-line"/>
<rect x="90" y="70" width="160" height="46" rx="6" class="d-box"/>
<text x="170" y="90" text-anchor="middle" class="d-bold d-mono">L1</text>
<text x="170" y="106" text-anchor="middle" class="d-small">48 KB/core, ~2 ns here</text>
<path d="M170 116 V130" class="d-line"/>
<rect x="70" y="130" width="200" height="46" rx="6" class="d-box-2"/>
<text x="170" y="150" text-anchor="middle" class="d-bold d-mono">L2</text>
<text x="170" y="166" text-anchor="middle" class="d-small">512 KB/core, ~4 ns here</text>
<path d="M170 176 V190" class="d-line"/>
<rect x="50" y="190" width="240" height="46" rx="6" class="d-box"/>
<text x="170" y="210" text-anchor="middle" class="d-bold d-mono">L3</text>
<text x="170" y="226" text-anchor="middle" class="d-small">16 MB, shared, ~15-45 ns here</text>
<path d="M170 236 V250" class="d-line"/>
<rect x="30" y="250" width="280" height="46" rx="6" class="d-box-2"/>
<text x="170" y="270" text-anchor="middle" class="d-bold d-mono">RAM</text>
<text x="170" y="286" text-anchor="middle" class="d-small">gigabytes, over 120 ns here</text>
<path d="M170 296 V310" class="d-line"/>
<rect x="10" y="310" width="320" height="46" rx="6" class="d-box-warn"/>
<text x="170" y="330" text-anchor="middle" class="d-bold">SSD / network</text>
<text x="170" y="346" text-anchor="middle" class="d-small">further still; not measured here</text>
<text x="20" y="390" class="d-muted d-small">Sizes and line size: read from this machine.</text>
<text x="20" y="408" class="d-muted d-small">L1/L2/L3 times: measured here (this page).</text>
<text x="20" y="426" class="d-muted d-small">Each step down is roughly an order of</text>
<text x="20" y="444" class="d-muted d-small">magnitude, not a fixed multiplier.</text>
<text x="20" y="462" class="d-muted d-small">RAM figure only; SSD/network not tested.</text>
</svg>
<figcaption>Figure 1. Every size and the 64-byte line size came from this machine; the L1-L3-RAM times are what the ladder above measured on it, not a copied table.</figcaption>
</figure>

## What actually moves is the whole line, not the byte you asked for

Because a miss fetches 64 bytes — sixteen `int`s — reading one value from a line that is not yet cached costs about the same as reading all sixteen, once that first read has paid the miss. The next program sums a 128 MB array twice: once touching every element, once touching only the first `int` of every cache line and skipping the other fifteen.

```csharp run id=lineonly
using System.Diagnostics;
using System.Globalization;

CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;

const int n = 32_000_000; // 128 MB: far bigger than this machine's L3

var data = new int[n];
for (int i = 0; i < n; i++) data[i] = i % 13;

long allSum = 0, strideSum = 0;
double allMs = Best(() => allSum = SumAll(data));
double strideMs = Best(() => strideSum = SumStride(data, 16));

Console.WriteLine($"sum every element:  {allMs,6:F1} ms  " +
    $"total={allSum}");
Console.WriteLine($"sum every 16th:     {strideMs,6:F1} ms  " +
    $"total={strideSum}");
Console.WriteLine(
    $"ratio {allMs / strideMs,4:F1}x for 16x less data summed");

static long SumAll(int[] d)
{
    long s = 0;
    for (int i = 0; i < d.Length; i++) s += d[i];
    return s;
}

static long SumStride(int[] d, int stride)
{
    long s = 0;
    for (int i = 0; i < d.Length; i += stride) s += d[i];
    return s;
}

static double Best(Action run)
{
    run(); // warm-up
    double best = double.MaxValue;
    for (int i = 0; i < 5; i++)
    {
        long start = Stopwatch.GetTimestamp();
        run();
        double ms = Stopwatch.GetElapsedTime(start)
            .TotalMilliseconds;
        best = Math.Min(best, ms);
    }
    return best;
}
```

```text output
sum every element:  [...] ms  total=191999979
sum every 16th:     [...] ms  total=11999991
ratio [...]x for 16x less data summed
```

Every stride-16 read is the first `int` of a line the loop has never touched before, so it is a full miss exactly as often as the loop that reads all sixteen; the two loops fetch the same lines from RAM, in the same order. If the cost were per element, sixteen times the summed data should cost close to sixteen times as long. On this machine it consistently cost three to five times as long across repeated runs, not sixteen — most of the price of a cache miss is paid once the line arrives, and reading the fifteen `int`s already sitting in L1 next to the one you asked for is nearly free by comparison. That is also the mechanism behind the arrays article's [row-major result](/data-structures/arrays-and-dynamic-arrays/#why-the-column-first-loop-falls-off-a-cliff): a row-first loop is a longer version of "sum every element" above, cashing in every byte of every line it fetches.

## Two threads, two counters, one cache line

A cache line has an owner. Under the MESI protocol, a core that wants to write to a line first has to bring it into the **Modified** or **Exclusive** state in its own L1, which means every other core's copy of that same line is invalidated first (["Part 2: CPU caches", §3.3.4](https://lwn.net/Articles/252125/)). If two threads on different cores write to two different variables that happen to share a line, the hardware cannot tell the variables apart — it only tracks ownership per line — so the line bounces between the two cores' L1 caches on every write, even though the threads never touch each other's data and there is no [race condition](/operating-systems/concurrency-race-conditions-locks/#counter-is-three-steps-not-one) to fix. Drepper calls this **false sharing** and measured it directly: on a four-processor Pentium 4, four threads each incrementing their own counter 500 million times took 1,147% longer when the four counters shared one line than when each had its own (["Part 6: More things programmers can do", §6.4.1](https://lwn.net/Articles/256433/)). The multiplier is specific to that 2007 machine; this page measures its own, on four threads incrementing their own `long` two hundred million times each, first packed into one `long[4]` — four 8-byte counters fit in a single 64-byte line — then each padded out to its own line with `[StructLayout(LayoutKind.Explicit, Size = 64)]`, which fixes the type's total size regardless of how few bytes it declares (["StructLayoutAttribute Class"](https://learn.microsoft.com/en-us/dotnet/api/system.runtime.interopservices.structlayoutattribute)):

```csharp run id=falseshare
using System.Diagnostics;
using System.Globalization;
using System.Runtime.InteropServices;

CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;

const int threads = 4;
const long iters = 200_000_000;

double unpadded = RunUnpadded(threads, iters);
double padded = RunPadded(threads, iters);
Console.WriteLine(
    $"unpadded (same line): {unpadded,7:F0} ms");
Console.WriteLine(
    $"padded (own line):    {padded,7:F0} ms");
Console.WriteLine(
    $"unpadded is {unpadded / padded,4:F1}x slower than padded");

static double RunUnpadded(int threads, long iters)
{
    var counters = new long[threads]; // 32 bytes: one shared line
    var ready = new Barrier(threads + 1);
    var workers = new Thread[threads];
    for (int t = 0; t < threads; t++)
    {
        int id = t;
        workers[t] = new Thread(() =>
        {
            ready.SignalAndWait();
            for (long k = 0; k < iters; k++) counters[id]++;
        });
        workers[t].Start();
    }
    var sw = Stopwatch.StartNew();
    ready.SignalAndWait();
    foreach (var w in workers) w.Join();
    return sw.Elapsed.TotalMilliseconds;
}

static double RunPadded(int threads, long iters)
{
    var counters = new PaddedCounter[threads]; // one line each
    var ready = new Barrier(threads + 1);
    var workers = new Thread[threads];
    for (int t = 0; t < threads; t++)
    {
        int id = t;
        workers[t] = new Thread(() =>
        {
            ready.SignalAndWait();
            for (long k = 0; k < iters; k++) counters[id].Value++;
        });
        workers[t].Start();
    }
    var sw = Stopwatch.StartNew();
    ready.SignalAndWait();
    foreach (var w in workers) w.Join();
    return sw.Elapsed.TotalMilliseconds;
}

[StructLayout(LayoutKind.Explicit, Size = 64)]
struct PaddedCounter { [FieldOffset(0)] public long Value; }
```

```text output
unpadded (same line): [...] ms
padded (own line):    [...] ms
unpadded is [...]x slower than padded
```

**No lock anywhere, and the hardware still slows down.** Across repeated runs here the unpadded version consistently took two and a half to three times as long as the padded one, with four threads and no lock, semaphore or `Interlocked` call anywhere in either version — every counter belongs to exactly one thread, so there is nothing to synchronize. The slowdown is a property of the hardware's coherence protocol, not of the program's logic, which is exactly why it survives code review: nothing about `counters[id]++` looks wrong.

<figure class="diagram">
<svg viewBox="0 0 340 300" role="img" aria-labelledby="fs-title fs-desc">
<title id="fs-title">Four counters on one line bounce between cores; four counters on separate lines do not</title>
<desc id="fs-desc">Top: one 64-byte line holds all four counters; two cores writing their own slots still force the line to bounce between them, drawn as a dashed arrow. Bottom: the same four counters, now on four separate lines; each core keeps its own line with no arrow between them.</desc>
<text x="10" y="18" class="d-bold">Packed into one line</text>
<rect x="10" y="26" width="70" height="34" class="d-box-bad"/>
<rect x="80" y="26" width="70" height="34" class="d-box-bad"/>
<rect x="150" y="26" width="70" height="34" class="d-box-2"/>
<rect x="220" y="26" width="70" height="34" class="d-box-2"/>
<text x="45" y="48" text-anchor="middle" class="d-mono d-small">c[0]</text>
<text x="115" y="48" text-anchor="middle" class="d-mono d-small">c[1]</text>
<text x="10" y="80" class="d-small">Core 0 owns c[0], Core 1 owns c[1],</text>
<text x="10" y="96" class="d-small">but both sit in the same 64-byte line.</text>
<path d="M45 60 C 20 110, 20 130, 45 150" class="d-bad d-dashed"/>
<path d="M115 150 C 140 130, 140 110, 115 60" class="d-bad d-dashed"/>
<text x="10" y="140" class="d-text-bad d-small">line keeps bouncing</text>
<text x="10" y="156" class="d-text-bad d-small">Core 0 to Core 1 on every write</text>
<text x="10" y="196" class="d-bold">Padded to one line each</text>
<rect x="10" y="204" width="130" height="34" class="d-box-good"/>
<rect x="200" y="204" width="130" height="34" class="d-box-good"/>
<text x="75" y="226" text-anchor="middle" class="d-mono d-small">c[0] + 56B pad</text>
<text x="265" y="226" text-anchor="middle" class="d-mono d-small">c[1] + 56B pad</text>
<text x="10" y="256" class="d-small">Core 0's line and Core 1's line never</text>
<text x="10" y="272" class="d-small">overlap, so neither core invalidates</text>
<text x="10" y="288" class="d-small">the other's copy.</text>
</svg>
<figcaption>Figure 2. Packing four independent counters into one cache line makes independent writers fight over ownership of that line; padding each counter out to 64 bytes ends the fight.</figcaption>
</figure>

## Struct-of-arrays: paying only for the fields the loop reads

Padding fixes false sharing by giving each writer more space than it needs. The opposite problem shows up inside a single thread: a struct that carries more fields than a hot loop reads still pays to move all of them, because the cache does not know which fields the loop cares about — it only knows lines. A simulated particle needs a position and a velocity for its physics step, but a realistic one also carries a color, a facing vector, some flags and a lifetime a renderer would want, none of which the physics step touches:

```csharp run id=soa
using System.Diagnostics;
using System.Globalization;
using System.Runtime.InteropServices;

CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;

const int n = 2_000_000;
const int passes = 60;

double aos = RunAos(n, passes);
double soa = RunSoa(n, passes);
Console.WriteLine(
    $"array-of-structs:  {aos,6:F2} ns/particle");
Console.WriteLine(
    $"struct-of-arrays:  {soa,6:F2} ns/particle");
Console.WriteLine($"AoS is {aos / soa,4:F1}x slower than SoA");

static double RunAos(int n, int passes)
{
    var p = new Particle[n];
    var rnd = new Random(1);
    for (int i = 0; i < n; i++)
        p[i].Vx = p[i].Vy = (float)rnd.NextDouble();
    Step(p); // warm-up
    double best = double.MaxValue;
    for (int run = 0; run < 5; run++)
    {
        var sw = Stopwatch.StartNew();
        for (int pass = 0; pass < passes; pass++) Step(p);
        double ns = sw.Elapsed.TotalNanoseconds;
        best = Math.Min(best, ns / passes / n);
    }
    return best;

    static void Step(Particle[] p)
    {
        for (int i = 0; i < p.Length; i++)
        {
            p[i].X += p[i].Vx;
            p[i].Y += p[i].Vy;
        }
    }
}

static double RunSoa(int n, int passes)
{
    var x = new float[n];
    var y = new float[n];
    var vx = new float[n];
    var vy = new float[n];
    var rnd = new Random(1);
    for (int i = 0; i < n; i++)
        vx[i] = vy[i] = (float)rnd.NextDouble();
    Step(x, y, vx, vy); // warm-up
    double best = double.MaxValue;
    for (int run = 0; run < 5; run++)
    {
        var sw = Stopwatch.StartNew();
        for (int pass = 0; pass < passes; pass++)
            Step(x, y, vx, vy);
        double ns = sw.Elapsed.TotalNanoseconds;
        best = Math.Min(best, ns / passes / n);
    }
    return best;

    static void Step(
        float[] x, float[] y, float[] vx, float[] vy)
    {
        for (int i = 0; i < x.Length; i++)
        {
            x[i] += vx[i];
            y[i] += vy[i];
        }
    }
}

// 64 bytes: position and velocity plus the payload a renderer
// would want (color, a facing vector, flags, a lifetime) that
// the physics step above never reads.
[StructLayout(LayoutKind.Sequential)]
struct Particle
{
    public float X, Y, Vx, Vy;
    public float R, G, B, A;
    public float Nx, Ny, Nz;
    public int Flags, Id, Group;
    public float Scale, Life;
}
```

```text output
array-of-structs:  [...] ns/particle
struct-of-arrays:  [...] ns/particle
AoS is [...]x slower than SoA
```

**Two million particles, one fetching four times as much as it needs.** Two million particles at 64 bytes each is 128 MB as an array of structs, well past this machine's 16 MB L3 either way, so both versions are bound by how fast the memory bus can deliver lines rather than by anything in L1 or L2. The struct-of-arrays version only ever fetches the four float arrays the loop touches — 32 MB total — while the array-of-structs version fetches the full 128 MB, three-quarters of it color, normal and id fields the physics step never reads, and it measured two to three times slower here across several runs. Choosing `struct` over `class` for `Particle` already matters on its own terms, laying the sixteen fields inline in one block instead of scattering `Particle` objects across the heap behind pointers, which the [space complexity](/complexity/space-complexity/#what-an-object-actually-costs-struct-vs-class-in-an-array) article measures directly; struct-of-arrays goes one step further and stops paying for fields a given loop never reads at all. Passing a slice of one of those parallel arrays to a helper without copying it is a separate article's subject in its own right, one this series has not reached yet.

<figure class="diagram">
<svg viewBox="0 0 340 300" role="img" aria-labelledby="soa-title soa-desc">
<title id="soa-title">Array-of-structs fetches every field in the line; struct-of-arrays fetches only the fields a loop reads</title>
<desc id="soa-desc">Top: one 64-byte Particle struct drawn as sixteen packed fields, four highlighted as the fields the physics step reads and twelve shown as unused payload the loop still has to fetch alongside them. Bottom: the same four fields as four separate arrays, with no unused payload sitting between them.</desc>
<text x="10" y="18" class="d-bold">Array-of-structs: one 64-byte struct per particle</text>
<rect x="10" y="26" width="20" height="30" class="d-box-good"/>
<rect x="30" y="26" width="20" height="30" class="d-box-good"/>
<rect x="50" y="26" width="20" height="30" class="d-box-good"/>
<rect x="70" y="26" width="20" height="30" class="d-box-good"/>
<rect x="90" y="26" width="20" height="30" class="d-box-bad"/>
<rect x="110" y="26" width="20" height="30" class="d-box-bad"/>
<rect x="130" y="26" width="20" height="30" class="d-box-bad"/>
<rect x="150" y="26" width="20" height="30" class="d-box-bad"/>
<rect x="170" y="26" width="20" height="30" class="d-box-bad"/>
<rect x="190" y="26" width="20" height="30" class="d-box-bad"/>
<rect x="210" y="26" width="20" height="30" class="d-box-bad"/>
<rect x="230" y="26" width="20" height="30" class="d-box-bad"/>
<rect x="250" y="26" width="20" height="30" class="d-box-bad"/>
<rect x="270" y="26" width="20" height="30" class="d-box-bad"/>
<rect x="290" y="26" width="20" height="30" class="d-box-bad"/>
<rect x="310" y="26" width="20" height="30" class="d-box-bad"/>
<text x="20" y="46" text-anchor="middle" class="d-mono d-small">X</text>
<text x="40" y="46" text-anchor="middle" class="d-mono d-small">Y</text>
<text x="60" y="46" text-anchor="middle" class="d-mono d-small">Vx</text>
<text x="80" y="46" text-anchor="middle" class="d-mono d-small">Vy</text>
<text x="10" y="76" class="d-small">Green: the four fields the physics step reads.</text>
<text x="10" y="92" class="d-small">Red: color, normal, flags, id, scale, life — fetched</text>
<text x="10" y="108" class="d-small">anyway because they share the same 64-byte line.</text>
<text x="10" y="144" class="d-bold">Struct-of-arrays: four separate arrays</text>
<rect x="10" y="152" width="70" height="34" class="d-box-good"/>
<rect x="90" y="152" width="70" height="34" class="d-box-good"/>
<rect x="170" y="152" width="70" height="34" class="d-box-good"/>
<rect x="250" y="152" width="70" height="34" class="d-box-good"/>
<text x="45" y="174" text-anchor="middle" class="d-mono d-small">X[]</text>
<text x="125" y="174" text-anchor="middle" class="d-mono d-small">Y[]</text>
<text x="205" y="174" text-anchor="middle" class="d-mono d-small">Vx[]</text>
<text x="285" y="174" text-anchor="middle" class="d-mono d-small">Vy[]</text>
<text x="10" y="210" class="d-small">Only the arrays a loop touches ever move; there is</text>
<text x="10" y="226" class="d-small">no unused payload packed in next to them.</text>
</svg>
<figcaption>Figure 3. Array-of-structs fetches all sixteen fields of every line it touches; struct-of-arrays fetches only the four arrays the physics loop reads.</figcaption>
</figure>

:::pitfall
Struct-of-arrays is not free. `p[i].X += p[i].Vx` becomes four array reads and two array writes at four different indices, the four arrays have to stay the same length by convention rather than by the type system, and a method that used to take one `Particle` now takes four parallel spans. It earns its complexity when a hot loop demonstrably reads a narrow slice of a wide record's fields, not as a default layout for every struct.
:::

## When this is worth doing

None of the three measured effects above show up in a complexity analysis: false sharing and the array-of-structs penalty both leave the Big-O of the code completely unchanged, and the pointer-chase ladder is a property of the data's access order, not its size class. They also do not show up until someone measures, because the compiler accepts all of it silently and the program produces the right answer at every step along the way. The cases where they are worth chasing share a shape: a loop that already dominates a profile, running over data too large to fit in cache, where a small, local change — padding a struct, splitting one array of records into several arrays of fields — removes work the hardware was doing uselessly. Applying any of them to code that is not already a measured bottleneck adds real complexity (the pitfall above) for a speedup nobody will notice, which is its own kind of waste.

::::exercise[Predict, then check]
Two versions of a struct hold the same four `int` fields. One is written as four separate fields; the other wraps them in an inner four-element array. On this machine's 64-byte lines, how many instances of each version fit in one L1 line, and does that change which one false-sharing padding would need to worry about?

:::solution
Four `int` fields, or an inner `int[4]`-shaped block of four `int`s, are both 16 bytes of payload either way — a C# array is a reference type, so "wrapping them in an array" inside a struct without `[InlineArray]` would only store an 8-byte reference, not the sixteen bytes, changing the answer entirely. Assuming the four fields are stored directly (the first, realistic case), 64 / 16 = 4 instances share a line, so four threads each owning one instance of that struct are in exactly the false-sharing situation this page measured, and padding each instance out to 64 bytes fixes it the same way `PaddedCounter` did above.
:::
::::

::::exercise[Find the bug]
A developer "fixes" false sharing by wrapping each thread's counter in its own `object` on the heap instead of padding a struct:

```text
class BoxedCounter { public long Value; }
var counters = new BoxedCounter[4];
for (int i = 0; i < 4; i++) counters[i] = new BoxedCounter();
```

Does this reliably end false sharing? What would you check before trusting it?

:::solution
Not reliably. Each `BoxedCounter` is a separate heap allocation, so it usually lands far from the others — but "usually" is doing the work here, not a guarantee. The .NET garbage collector is free to compact the heap and move objects during a collection, and nothing stops two small, recently allocated objects from starting out adjacent, or becoming adjacent after a compaction, if they happen to be promoted together. The explicit `[StructLayout(..., Size = 64)]` from this page is a guarantee about layout; relying on allocator behavior is a hope about it. Checking would mean measuring under GC pressure representative of the real program, not just once at start-up.
:::
::::

::::exercise[Extend the code]
The struct-of-arrays program above only updates position from velocity. Extend `RunSoa` and `RunAos` so the hot loop also multiplies each particle's `Scale` field by a constant every step, and predict what happens to the gap between the two versions before running it.

:::solution
Touching `Scale` forces the array-of-structs loop to keep reading roughly the same lines it already reads for `X`/`Y`/`Vx`/`Vy` — `Scale` sits in the same 64-byte struct — so its cost barely moves. The struct-of-arrays version now has to add a fifth array and a fifth stream of reads and writes, which narrows the gap between the two versions without closing it, because array-of-structs is still moving the color, facing-vector, flag and lifetime fields for every particle that struct-of-arrays never touches.
:::
::::

::::exercise[Measure it]
Change `threads` in the false-sharing program from 4 to 2, keeping everything else the same, and run it twice. Before running, predict whether the unpadded-to-padded ratio should grow, shrink, or stay about the same, and why.

:::solution
With two threads there are still two counters within one 64-byte line — a `long[2]` is 16 bytes — so false sharing still happens, but there is one fewer other core for the line to be stolen from. Drepper's own measurements went from 390% overhead at two threads to 1,147% at four on his hardware, so the expectation is that the ratio shrinks with fewer threads sharing the line, not that it disappears; running it is the only way to see this machine's actual shrinkage rather than assuming his 2007 Pentium 4's numbers transfer.
:::
::::

::::exercise[Prove it]
The cache-line demonstration sums every 16th `int` of a 128 MB array and calls that "one read per cache line." Show, from the measured L1 line size and the size of an `int`, why stride 16 is the right choice and not, say, stride 8 or stride 32.

:::solution
`LineSize` read from this machine is 64 bytes, and `sizeof(int)` is 4 bytes, so one line holds exactly 64 / 4 = 16 `int`s. A stride of 8 would read two values from most lines (touching two out of every four lines' worth of data more than once is not the point of the demonstration); a stride of 32 would skip whole lines untouched, reading half of them and never paying for the other half at all, which changes the comparison from "one read per line, all lines" to "one read per line, half the lines," a different and less direct question. Sixteen is the stride at which every line is touched exactly once for exactly one useful read.
:::
::::
