---
title: "Space Complexity and the Memory Your Code Really Uses"
description: "Measure auxiliary space against total space, the call stack's real cost during recursion, and what memoization and stackalloc save or spend, in bytes."
pillar: complexity
order: 4
author: markus
published: 2026-09-22
updated: 2026-09-22
level: intermediate
tags: [space-complexity, auxiliary-space, call-stack, memory-allocation, span]
prerequisites: ["complexity/big-o-notation"]
sources:
  - title: "GC.GetAllocatedBytesForCurrentThread Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.gc.getallocatedbytesforcurrentthread"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "RuntimeHelpers.EnsureSufficientExecutionStack Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.runtime.compilerservices.runtimehelpers.ensuresufficientexecutionstack"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "StackOverflowException Class"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.stackoverflowexception"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Thread Constructor (maxStackSize overloads)"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.threading.thread.-ctor"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Span<T> Struct"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.span-1"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "stackalloc expression"
    url: "https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/operators/stackalloc"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Algorithms, 4th ed., section 1.4: Analysis of Algorithms"
    url: "https://algs4.cs.princeton.edu/14analysis/"
    publisher: "Sedgewick and Wayne, Princeton University"
    accessed: 2026-09-22
  - title: "Algorithms, 4th ed., section 2.3: Quicksort"
    url: "https://algs4.cs.princeton.edu/23quicksort/"
    publisher: "Sedgewick and Wayne, Princeton University"
    accessed: 2026-09-22
draft: false
---

Two functions can carry the same Big-O time and still put very different pressure on memory: one needs a second array the size of the input, the other needs none; one recurses a thousand levels deep, the other loops with two variables. [Big-O notation](/complexity/big-o-notation/) applies just as well to memory as to steps, but most explanations of it stop at time. This page measures the memory side directly, with [`GC.GetAllocatedBytesForCurrentThread`](https://learn.microsoft.com/en-us/dotnet/api/system.gc.getallocatedbytesforcurrentthread), so every space claim below is a number a program produced, not one asserted from the shape of the code.

## Two ways to reverse ten thousand readings

A sensor log needs its readings in reverse chronological order. Two functions produce that:

```csharp run id=reverse-space
#:property Optimize=true
using System.Globalization;

CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;
const int N = 10_000;
double[] readings = MakeReadings(N);
double[] scratch = (double[])readings.Clone();

Report("ReverseCopy", () => { var r = ReverseCopy(readings); return r[0]; });
Report("ReverseInPlace", () => { ReverseInPlace(scratch); return scratch[0]; });

static void Report(string name, Func<double> action)
{
    action();   // warm-up run, not measured
    long before = GC.GetAllocatedBytesForCurrentThread();
    double result = action();
    long bytes = GC.GetAllocatedBytesForCurrentThread() - before;
    Console.WriteLine($"{name,-15}{bytes,10:N0} B");
    GC.KeepAlive(result);
}

static double[] MakeReadings(int n)
{
    var random = new Random(3);
    var readings = new double[n];
    for (int i = 0; i < n; i++) readings[i] = random.NextDouble();
    return readings;
}

static double[] ReverseCopy(double[] source)
{
    var result = new double[source.Length];
    for (int i = 0; i < source.Length; i++)
        result[i] = source[source.Length - 1 - i];
    return result;
}

static void ReverseInPlace(double[] source)
{
    int lo = 0, hi = source.Length - 1;
    while (lo < hi)
    {
        (source[lo], source[hi]) = (source[hi], source[lo]);
        lo++; hi--;
    }
}
```

```text output
ReverseCopy        80,024 B
ReverseInPlace          0 B
```

The measurements on this page were taken with .NET 10 (SDK 10.0.401, runtime 10.0.12) on Windows 11, on a desktop with an Intel Core i7-11700K. `ReverseCopy` allocates a second 10,000-element array: 10,000 × 8 bytes for the `double`s plus 24 bytes of array overhead, exactly the 80,024 measured. `ReverseInPlace` swaps elements inside the array it was given and allocates nothing, at any *n*.

Neither function is free, though. Both need the 80,024-byte input array to exist before they can run at all; that memory does not appear in either row because `Report` only counts what happens *during* the call. Split what a run needs into two pieces:

- **Total space** is everything a run occupies at once: the input, plus whatever else the algorithm builds while it works. For both functions here, total space is Θ(*n*) — dominated by the 80,024-byte input either way.
- **Auxiliary space** is total space *minus* the input: only the extra, working memory the algorithm itself is responsible for. That is where the two functions differ — Θ(*n*) for `ReverseCopy`, Θ(1) for `ReverseInPlace` — and it is the number this page is mostly about, because it is the number a choice of algorithm actually controls.

A tutorial that just says "reversing an array is O(*n*) space" has picked total space and hidden the interesting part. [Space complexity](/glossary/#space-complexity), used without qualification for the rest of this page, means auxiliary space: the working memory an algorithm adds on top of its input.

::::exercise[Predict the output: a table that does not grow]
A byte-frequency counter scans an array of any length and tallies how often each of the 256 possible byte values appears:

```csharp run id=predict-counts
byte[] data = new byte[1_000];
new Random(2).NextBytes(data);
int[] counts = CountBytes(data);
GC.KeepAlive(counts);

static int[] CountBytes(byte[] data)
{
    var counts = new int[256];
    foreach (byte b in data) counts[b]++;
    return counts;
}
```

For arrays of 1,000, 10,000 and 100,000 random bytes, predict what `GC.GetAllocatedBytesForCurrentThread` reports for one call to `CountBytes`, *not counting* the input array itself. Does the number grow with the array, stay flat, or something else? Then run it.

:::solution
It stays exactly flat: `counts` is always a 256-element `int[]`, regardless of how many bytes are scanned, so its size — and therefore its allocation — does not depend on *n* at all.

```csharp run id=counts-solved
#:property Optimize=true
using System.Globalization;

CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;

Console.WriteLine($"{"n",8}{"bytes",8}");
foreach (int n in new[] { 1_000, 10_000, 100_000 })
{
    byte[] data = MakeBytes(n);
    CountBytes(data);   // warm-up run, not measured
    long before = GC.GetAllocatedBytesForCurrentThread();
    int[] counts = CountBytes(data);
    long bytes = GC.GetAllocatedBytesForCurrentThread() - before;
    Console.WriteLine($"{n,8:N0}{bytes,6:N0} B");
    GC.KeepAlive(counts);
}

static byte[] MakeBytes(int n)
{
    var random = new Random(2);
    var data = new byte[n];
    random.NextBytes(data);
    return data;
}

static int[] CountBytes(byte[] data)
{
    var counts = new int[256];
    foreach (byte b in data) counts[b]++;
    return counts;
}
```

```text output
       n   bytes
   1,000 1,048 B
  10,000 1,048 B
 100,000 1,048 B
```

256 × 4 bytes + 24 bytes of array overhead is exactly 1,048, at every *n*. `CountBytes` allocates and is Θ(1) auxiliary space at the same time: the two are not opposites. Counting sort leans on exactly this — a fixed-size table indexed by value, not by input length — which is why it can beat comparison sorts when the range of values is small and known, at the cost of needing that range ahead of time.
:::
::::

## The call stack spends memory too

`ReverseInPlace` above has no [recursion](/glossary/#recursion), so its [call stack](/glossary/#call-stack) usage never came up. A recursive function's stack usage is real memory, and it is easy to lose sight of because it never appears in a `new` expression. Consider a recursive version of the same kind of sum a loop would compute in Θ(1) space:

```csharp run id=recursive-sum-intro
int[] values = [3, 1, 4, 1, 5, 9, 2, 6];
Console.WriteLine(RecursiveSum(values, 0));

static long RecursiveSum(int[] values, int i) =>
    i == values.Length ? 0 : values[i] + RecursiveSum(values, i + 1);
```

```text output
31
```

Every call is still on the stack when the next one starts, so the stack holds *n* frames at the deepest point — Θ(*n*) auxiliary space for a computation a loop does in Θ(1). Push that far enough and [`StackOverflowException`](https://learn.microsoft.com/en-us/dotnet/api/system.stackoverflowexception) is thrown — except that, unusually for a .NET exception, "you can't catch a `StackOverflowException` object with a `try`/`catch` block, and the corresponding process is terminated by default." Measuring exactly how deep is "too deep" therefore cannot use a `try`/`catch` around the real overflow.

[`RuntimeHelpers.EnsureSufficientExecutionStack`](https://learn.microsoft.com/en-us/dotnet/api/system.runtime.compilerservices.runtimehelpers.ensuresufficientexecutionstack) exists for exactly this problem. Its documentation describes "an artificially limited stack that preserves enough space for an exception to be raised and recovery action to be taken," and says the method "is useful in situations where stack overflow might occur as a result of unbounded recursion." Called on every recursive step, it throws a catchable `InsufficientExecutionStackException` while there is still enough stack left to safely unwind — a safety margin, not the true hardware limit. Running the recursion on a [`Thread`](https://learn.microsoft.com/en-us/dotnet/api/system.threading.thread.-ctor) built with an explicit `maxStackSize` — "the maximum stack size, in bytes, to be used by the thread" — makes the available stack a chosen, known quantity instead of whatever the main thread happens to have:

```csharp run id=stack-depth
#:property Optimize=true
using System.Globalization;
using System.Runtime.CompilerServices;

CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;

Console.WriteLine($"{"stack",6}{"deepest n",11}");
(string Label, int Bytes)[] stacks =
[
    ("1 MiB", 1_048_576),
    ("4 MiB", 4_194_304),
];
long prevDepth = 0;
int prevStack = 0;
foreach (var (label, stackBytes) in stacks)
{
    long depth = DeepestSum(stackBytes);
    string perFrame = prevDepth == 0 ? "" :
        $"  ~{(double)(stackBytes - prevStack) / (depth - prevDepth):F0} B/frame";
    Console.WriteLine($"{label,6}{depth,11:N0}{perFrame}");
    prevDepth = depth;
    prevStack = stackBytes;
}

static long DeepestSum(int stackBytes)
{
    long depth = 0;
    var thread = new Thread(() =>
    {
        try { RecursiveSum(int.MaxValue); }
        catch (InsufficientExecutionStackException) { }
    }, stackBytes);
    thread.Start();
    thread.Join();
    return depth;

    long RecursiveSum(int n)
    {
        depth++;
        RuntimeHelpers.EnsureSufficientExecutionStack();
        return n == 0 ? 0 : n + RecursiveSum(n - 1);
    }
}
```

```text output
 stack  deepest n
[...]
[...]
```

One run on this machine printed:

```text
 stack  deepest n
 1 MiB     14,295
 4 MiB     63,443  ~64 B/frame
```

The exact depth wobbles by a few dozen frames between runs — the "artificially limited stack" margin `EnsureSufficientExecutionStack` reserves is not a fixed number of bytes the documentation publishes, so neither run gives frame size directly. Differencing does: going from a 1 MiB stack to a 4 MiB one adds 3,145,728 bytes and reached 49,148 frames further, both runs landing on almost exactly 64 bytes per frame. That reserved margin is roughly constant across stack sizes, so it cancels out of the subtraction whether or not you know its value.

Sixty-four bytes buys `n`, a return address and the pending `n +` addition each frame is still waiting to finish — this function is deliberately not tail-recursive, so nothing about it can be rewritten into a loop by the compiler. A function with larger locals pays more per frame for the same reason a wider `struct` does: [structs are copied and stored inline](/csharp-dotnet/value-types-vs-reference-types/), wherever they live, including in a stack frame.

<figure class="diagram">
<svg viewBox="0 0 360 350" role="img" aria-labelledby="sc-frames-title sc-frames-desc">
<title id="sc-frames-title">Four stacked call frames approaching a fixed stack limit</title>
<desc id="sc-frames-desc">Four boxes stacked vertically, each about 64 bytes and labeled with a call to RecursiveSum at a smaller n than the one below it. A dashed line above the top box marks the point where the thread's stack space runs out.</desc>
<text x="20" y="20" class="d-bold">Each call adds one frame, ~64 B</text>
<path d="M30 50 H330" class="d-bad d-dashed"/>
<text x="335" y="46" text-anchor="end" class="d-text-bad d-small">stack limit</text>
<rect x="60" y="58" width="200" height="38" rx="4" class="d-box-accent"/>
<text x="160" y="82" text-anchor="middle" class="d-mono d-small d-bold">RecursiveSum(n-3)</text>
<rect x="60" y="100" width="200" height="38" rx="4" class="d-box"/>
<text x="160" y="124" text-anchor="middle" class="d-mono d-small">RecursiveSum(n-2)</text>
<rect x="60" y="142" width="200" height="38" rx="4" class="d-box"/>
<text x="160" y="166" text-anchor="middle" class="d-mono d-small">RecursiveSum(n-1)</text>
<rect x="60" y="184" width="200" height="38" rx="4" class="d-box"/>
<text x="160" y="208" text-anchor="middle" class="d-mono d-small">RecursiveSum(n)</text>
<text x="20" y="248" class="d-muted d-small">Each frame holds n, a return address,</text>
<text x="20" y="264" class="d-muted d-small">and the pending "n +" left to finish.</text>
<text x="20" y="290" class="d-muted d-small">A 1 MiB stack holds about 14,300 of</text>
<text x="20" y="306" class="d-muted d-small">these frames; a 4 MiB stack holds about</text>
<text x="20" y="322" class="d-muted d-small">63,400 — four times the space, four</text>
<text x="20" y="338" class="d-muted d-small">times the frames.</text>
</svg>
<figcaption>Figure 1. RecursiveSum(n) pushes a new frame for every call and pops none until n reaches 0; each frame costs about 64 bytes here, found by comparing two thread stack sizes.</figcaption>
</figure>

::::exercise[Measure it: a wider frame]
Add one local to `RecursiveSum`: a 16-element scratch buffer, allocated on the stack with [`stackalloc`](#skipping-the-heap-altogether-spant-and-stackalloc) and touched so the compiler cannot optimize it away. Before running anything, predict whether the measured bytes-per-frame will go up, down, or stay the same, and roughly by how much.

```csharp run id=predict-scratch
long result = RecursiveSumWithScratch(5);
GC.KeepAlive(result);

long RecursiveSumWithScratch(int n)
{
    Span<double> scratch = stackalloc double[16];
    scratch[0] = n;
    return n == 0 ? 0
        : n + RecursiveSumWithScratch(n - 1) + (long)scratch[0] - n;
}
```

:::solution
Sixteen `double`s is 128 bytes, so the frame should grow by roughly that much — call it a rise from ~64 bytes to somewhere in the 150–250 range. Measuring it with the same two-stack-size technique:

```csharp run id=scratch-solved
#:property Optimize=true
using System.Globalization;
using System.Runtime.CompilerServices;

CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;

Console.WriteLine($"{"stack",6}{"deepest n",11}");
(string Label, int Bytes)[] stacks =
[
    ("1 MiB", 1_048_576),
    ("4 MiB", 4_194_304),
];
long prevDepth = 0;
int prevStack = 0;
foreach (var (label, stackBytes) in stacks)
{
    long depth = DeepestSumWithScratch(stackBytes);
    string perFrame = prevDepth == 0 ? "" :
        $"  ~{(double)(stackBytes - prevStack) / (depth - prevDepth):F0} B/frame";
    Console.WriteLine($"{label,6}{depth,11:N0}{perFrame}");
    prevDepth = depth;
    prevStack = stackBytes;
}

static long DeepestSumWithScratch(int stackBytes)
{
    long depth = 0;
    var thread = new Thread(() =>
    {
        try { RecursiveSumWithScratch(int.MaxValue); }
        catch (InsufficientExecutionStackException) { }
    }, stackBytes);
    thread.Start();
    thread.Join();
    return depth;

    long RecursiveSumWithScratch(int n)
    {
        depth++;
        Span<double> scratch = stackalloc double[16];
        scratch[0] = n;
        RuntimeHelpers.EnsureSufficientExecutionStack();
        return n == 0 ? 0
            : n + RecursiveSumWithScratch(n - 1) + (long)scratch[0] - n;
    }
}
```

```text output
 stack  deepest n
[...]
[...]
```

One run printed:

```text
 stack  deepest n
 1 MiB      3,366
 4 MiB     14,930  ~272 B/frame
```

About 272 bytes per frame, roughly four times the ~64-byte baseline — more than the 128 bytes of the buffer alone, since the frame also carries the buffer's alignment and the extra bookkeeping the JIT needs for a `stackalloc` inside a recursive method. The depth reached fell by the same factor: 3,366 versus the earlier 14,295 on the same 1 MiB stack. A recursive function's *time* complexity says nothing about this; its space complexity, measured as "frames × bytes per frame," does.
:::
::::

## In place doesn't mean free

An algorithm is commonly called *in-place* when it rearranges its input using O(1) or O(log *n*) auxiliary space, rather than building a second structure the size of the input. Sedgewick and Wayne describe their own quicksort this way: "it is in-place (uses only a small auxiliary stack)." Compare an in-place quicksort against a merge sort that allocates one buffer up front and threads it through every recursive call — the same pattern the sort in [Big-O Notation](/complexity/big-o-notation/#when-the-dropped-constant-decides-the-winner) uses, measured here instead of timed:

```csharp run id=sort-space
#:property Optimize=true
using System.Globalization;

CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;

Console.WriteLine($"{"n",6}{"quicksort",11}{"merge sort",12}");
foreach (int n in new[] { 1_000, 2_000, 4_000, 8_000 })
{
    int[] scores = MakeScores(n);

    int[] a = (int[])scores.Clone();
    long before1 = GC.GetAllocatedBytesForCurrentThread();
    QuickSortInPlace(a, 0, a.Length - 1);
    long qsBytes = GC.GetAllocatedBytesForCurrentThread() - before1;

    int[] b = (int[])scores.Clone();
    long before2 = GC.GetAllocatedBytesForCurrentThread();
    MergeSortSharedBuffer(b);
    long msBytes = GC.GetAllocatedBytesForCurrentThread() - before2;

    Console.WriteLine($"{n,6:N0}{qsBytes,8:N0} B{msBytes,9:N0} B");
}

static int[] MakeScores(int n)
{
    var random = new Random(5);
    var scores = new int[n];
    for (int i = 0; i < n; i++) scores[i] = random.Next(100_000);
    return scores;
}

static void QuickSortInPlace(int[] items, int lo, int hi)
{
    if (lo >= hi) return;
    int pivot = items[hi];
    int i = lo;
    for (int j = lo; j < hi; j++)
    {
        if (items[j] < pivot)
        {
            (items[i], items[j]) = (items[j], items[i]);
            i++;
        }
    }
    (items[i], items[hi]) = (items[hi], items[i]);
    QuickSortInPlace(items, lo, i - 1);
    QuickSortInPlace(items, i + 1, hi);
}

static void MergeSortSharedBuffer(int[] items)
{
    if (items.Length < 2) return;
    Split(items, new int[items.Length], 0, items.Length);
}

static void Split(int[] items, int[] buffer, int lo, int hi)
{
    if (hi - lo < 2) return;
    int mid = lo + (hi - lo) / 2;
    Split(items, buffer, lo, mid);
    Split(items, buffer, mid, hi);
    Array.Copy(items, lo, buffer, lo, hi - lo);
    int left = lo, right = mid, k = lo;
    while (left < mid || right < hi)
    {
        bool takeLeft = right >= hi || (left < mid && buffer[left] <= buffer[right]);
        items[k++] = takeLeft ? buffer[left++] : buffer[right++];
    }
}
```

```text output
     n  quicksort  merge sort
 1,000       0 B    4,024 B
 2,000       0 B    8,024 B
 4,000       0 B   16,024 B
 8,000       0 B   32,024 B
```

`QuickSortInPlace` allocates nothing at any size — every swap happens inside the caller's array. `MergeSortSharedBuffer` allocates exactly one buffer per call, sized to the input, and its bytes scale linearly with *n* (4 bytes per `int`, plus the fixed 24-byte array header): textbook Θ(*n*) auxiliary space, confirmed rather than assumed.

`GC.GetAllocatedBytesForCurrentThread` only sees the *managed heap*: its documentation is explicit that it counts "bytes allocated on the managed heap," and says nothing about the stack. Quicksort's 0 B rows are real, but they are not the whole story — recursive quicksort still uses the call stack measured in the previous section, and this counter is blind to it. How much stack it uses depends entirely on how lucky the partition is:

```csharp run id=quicksort-depth
int[] random5000 = MakeScores(5000, shuffled: true);
int[] sorted5000 = MakeScores(5000, shuffled: false);

Console.WriteLine($"random  n=5000  max depth = {MaxDepth(random5000)}");
Console.WriteLine($"sorted  n=5000  max depth = {MaxDepth(sorted5000)}");

static int[] MakeScores(int n, bool shuffled)
{
    var scores = new int[n];
    for (int i = 0; i < n; i++) scores[i] = i;
    if (shuffled)
    {
        var random = new Random(5);
        for (int i = n - 1; i > 0; i--)
        {
            int j = random.Next(i + 1);
            (scores[i], scores[j]) = (scores[j], scores[i]);
        }
    }
    return scores;
}

static int MaxDepth(int[] items)
{
    int depth = 0, max = 0;
    Sort(items, 0, items.Length - 1);
    return max;

    void Sort(int[] items, int lo, int hi)
    {
        if (lo >= hi) return;
        depth++;
        if (depth > max) max = depth;
        int pivot = items[hi];
        int i = lo;
        for (int j = lo; j < hi; j++)
        {
            if (items[j] < pivot)
            {
                (items[i], items[j]) = (items[j], items[i]);
                i++;
            }
        }
        (items[i], items[hi]) = (items[hi], items[i]);
        Sort(items, lo, i - 1);
        Sort(items, i + 1, hi);
        depth--;
    }
}
```

```text output
random  n=5000  max depth = 26
sorted  n=5000  max depth = 4999
```

On shuffled input, 5,000 values recurse only 26 levels deep — close to log₂(5,000) ≈ 12.3, the balanced-partition case. Feed the same code its own worst case, already-sorted input with the last element as pivot, and every partition peels off exactly one item: depth 4,999, one frame per element, O(*n*) auxiliary space from the call stack alone. At the ~64 bytes a plain frame costs here (this function's frames are a little larger, but the shape is the same), a sorted array of about 20,000 items — four times the size just sorted above — would be well on its way to the ~14,300-frame ceiling the previous section measured on a 1 MiB stack. "Small auxiliary stack" is a claim about *typical* partitions, not a guarantee; a later article in this pillar on best, average and worst case covers what forces the bad case and how randomization avoids it. Sorting on the smaller of the two partitions first, rather than always the left one, caps the *guaranteed* recursion depth at O(log *n*) regardless of input.

:::pitfall
"In-place" does not mean "zero extra memory," and it is not a synonym for Θ(1). It means the extra memory is O(1) or O(log *n*) rather than Θ(*n*) — and, for a recursive in-place algorithm, that extra memory includes the call stack, which a heap-only counter like `GC.GetAllocatedBytesForCurrentThread` will not show you.
:::

::::exercise[Find the bug: a Θ(n) sort that measures Θ(n log n)]
This merge sort looks like the one above — same recursion, same merge — with one change: the buffer is allocated inside `SplitPerCall` on every call, instead of once at the top and threaded through.

```csharp run id=buggy-mergesort
int[] items = [5, 3, 8, 1, 9, 2, 7, 4];
MergeSortPerCallBuffer(items);
for (int i = 1; i < items.Length; i++)
    if (items[i - 1] > items[i])
        throw new InvalidOperationException("Not sorted.");

static void MergeSortPerCallBuffer(int[] items)
{
    if (items.Length < 2) return;
    SplitPerCall(items, 0, items.Length);
}

static void SplitPerCall(int[] items, int lo, int hi)
{
    if (hi - lo < 2) return;
    int mid = lo + (hi - lo) / 2;
    SplitPerCall(items, lo, mid);
    SplitPerCall(items, mid, hi);
    int[] buffer = new int[hi - lo];
    Array.Copy(items, lo, buffer, 0, hi - lo);
    int left = 0, right = mid - lo, k = lo;
    while (left < mid - lo || right < hi - lo)
    {
        bool takeLeft = right >= hi - lo || (left < mid - lo && buffer[left] <= buffer[right]);
        items[k++] = takeLeft ? buffer[left++] : buffer[right++];
    }
}
```

Sorting is still correct. Before measuring: does this change the auxiliary-space *class* the code achieves, even though nothing about the algorithm's comparisons or merges changed?

:::solution
Yes. The version above the exercise allocates one buffer, sized *n*, exactly once. This version allocates a fresh buffer at *every* recursive call — one for each of the roughly 2*n* − 1 nodes in the recursion tree, most of them small but there are Θ(*n* log *n*) of them in total. Measured against the shared-buffer version from the same sizes:

```csharp run id=bug-solved
#:property Optimize=true
using System.Globalization;

CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;

Console.WriteLine($"{"n",6}{"shared",10}{"per-call",12}");
foreach (int n in new[] { 1_000, 2_000, 4_000, 8_000 })
{
    int[] scores = MakeScores(n);

    int[] a = (int[])scores.Clone();
    long before1 = GC.GetAllocatedBytesForCurrentThread();
    MergeSortSharedBuffer(a);
    long sharedBytes = GC.GetAllocatedBytesForCurrentThread() - before1;

    int[] b = (int[])scores.Clone();
    long before2 = GC.GetAllocatedBytesForCurrentThread();
    MergeSortPerCallBuffer(b);
    long perCallBytes = GC.GetAllocatedBytesForCurrentThread() - before2;

    Console.WriteLine($"{n,6:N0}{sharedBytes,7:N0} B{perCallBytes,9:N0} B");
}

static int[] MakeScores(int n)
{
    var random = new Random(5);
    var scores = new int[n];
    for (int i = 0; i < n; i++) scores[i] = random.Next(100_000);
    return scores;
}

static void MergeSortSharedBuffer(int[] items)
{
    if (items.Length < 2) return;
    SplitShared(items, new int[items.Length], 0, items.Length);
}

static void SplitShared(int[] items, int[] buffer, int lo, int hi)
{
    if (hi - lo < 2) return;
    int mid = lo + (hi - lo) / 2;
    SplitShared(items, buffer, lo, mid);
    SplitShared(items, buffer, mid, hi);
    Array.Copy(items, lo, buffer, lo, hi - lo);
    int left = lo, right = mid, k = lo;
    while (left < mid || right < hi)
    {
        bool takeLeft = right >= hi || (left < mid && buffer[left] <= buffer[right]);
        items[k++] = takeLeft ? buffer[left++] : buffer[right++];
    }
}

static void MergeSortPerCallBuffer(int[] items)
{
    if (items.Length < 2) return;
    SplitPerCall(items, 0, items.Length);
}

static void SplitPerCall(int[] items, int lo, int hi)
{
    if (hi - lo < 2) return;
    int mid = lo + (hi - lo) / 2;
    SplitPerCall(items, lo, mid);
    SplitPerCall(items, mid, hi);
    int[] buffer = new int[hi - lo];
    Array.Copy(items, lo, buffer, 0, hi - lo);
    int left = 0, right = mid - lo, k = lo;
    while (left < mid - lo || right < hi - lo)
    {
        bool takeLeft = right >= hi - lo || (left < mid - lo && buffer[left] <= buffer[right]);
        items[k++] = takeLeft ? buffer[left++] : buffer[right++];
    }
}
```

```text output
     n    shared    per-call
 1,000  4,024 B   64,328 B
 2,000  8,024 B  136,680 B
 4,000 16,024 B  289,384 B
 8,000 32,024 B  610,792 B
```

The shared-buffer column stays linear (doubles when *n* doubles); the per-call column grows faster — roughly ×2.1 to ×2.2 per doubling, the signature of an extra log₂(*n*) factor. This is a real, easy-to-write bug: "allocate a working buffer" is correct advice for merge sort's *peak* space, but allocating it inside the recursive function instead of once outside it turns O(*n*) space used at any one time into O(*n* log *n*) bytes allocated and discarded over the whole sort — real work for the garbage collector that the algorithm's Big-O space class never warned you about.
:::
::::

## Trading space for time: memoizing Fibonacci

The plain recursive definition of the Fibonacci sequence, `Fib(n) = Fib(n-1) + Fib(n-2)`, recomputes the same values exponentially many times. *Memoization* — caching each result the first time it is computed — is the standard fix, and it is a genuine space-for-time trade, not a free lunch: the cache costs memory the pure recursive version never spent. An iterative version sidesteps the trade entirely by not recursing at all:

```csharp run id=fib-tradeoff
#:property Optimize=true
using System.Diagnostics;
using System.Globalization;

CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;

// Warm-up for the JIT.
NaiveFib(10);
MemoFib(10, new Dictionary<int, long>());
IterFib(10);

int[] sizes = [20, 25, 30, 35, 38];
var naiveMs = new double[sizes.Length];
var memoMs = new double[sizes.Length];
var iterMs = new double[sizes.Length];
var naiveB = new long[sizes.Length];
var memoB = new long[sizes.Length];
var iterB = new long[sizes.Length];

for (int i = 0; i < sizes.Length; i++)
{
    int n = sizes[i];

    long b0 = GC.GetAllocatedBytesForCurrentThread();
    long t0 = Stopwatch.GetTimestamp();
    long r1 = NaiveFib(n);
    naiveMs[i] = Stopwatch.GetElapsedTime(t0).TotalMilliseconds;
    naiveB[i] = GC.GetAllocatedBytesForCurrentThread() - b0;

    var memo = new Dictionary<int, long>();
    long b1 = GC.GetAllocatedBytesForCurrentThread();
    long t1 = Stopwatch.GetTimestamp();
    long r2 = MemoFib(n, memo);
    memoMs[i] = Stopwatch.GetElapsedTime(t1).TotalMilliseconds;
    memoB[i] = GC.GetAllocatedBytesForCurrentThread() - b1;

    long b2 = GC.GetAllocatedBytesForCurrentThread();
    long t2 = Stopwatch.GetTimestamp();
    long r3 = IterFib(n);
    iterMs[i] = Stopwatch.GetElapsedTime(t2).TotalMilliseconds;
    iterB[i] = GC.GetAllocatedBytesForCurrentThread() - b2;

    if (r1 != r2 || r2 != r3) throw new InvalidOperationException("mismatch");
}

Console.WriteLine("time (ms)");
Console.WriteLine($"{"n",4}{"naive",10}{"memo",9}{"iter",9}");
for (int i = 0; i < sizes.Length; i++)
    Console.WriteLine($"{sizes[i],4}{naiveMs[i],8:F1}{memoMs[i],9:F3}{iterMs[i],9:F4}");

Console.WriteLine("heap bytes");
Console.WriteLine($"{"n",4}{"naive",8}{"memo",8}{"iter",6}");
for (int i = 0; i < sizes.Length; i++)
    Console.WriteLine($"{sizes[i],4}{naiveB[i],8:N0}{memoB[i],8:N0}{iterB[i],6:N0}");

static long NaiveFib(int n) => n <= 1 ? n : NaiveFib(n - 1) + NaiveFib(n - 2);

static long MemoFib(int n, Dictionary<int, long> memo)
{
    if (n <= 1) return n;
    if (memo.TryGetValue(n, out long cached)) return cached;
    long result = MemoFib(n - 1, memo) + MemoFib(n - 2, memo);
    memo[n] = result;
    return result;
}

static long IterFib(int n)
{
    long prev = 0, curr = 1;
    for (int i = 0; i < n; i++)
        (prev, curr) = (curr, prev + curr);
    return prev;
}
```

```text output
time (ms)
   n     naive     memo     iter
[...]
[...]
[...]
[...]
[...]
heap bytes
   n   naive    memo  iter
  20       0   2,000     0
  25       0   2,000     0
  30       0   2,000     0
  35       0   2,000     0
  38       0   2,000     0
```

One run's time table:

```text
time (ms)
   n     naive     memo     iter
  20     0.0    0.006   0.0002
  25     0.4    0.005   0.0003
  30     4.3    0.018   0.0003
  35    44.3    0.011   0.0004
  38   165.0    0.043   0.0004
```

The naive version's time grows exponentially — from under a millisecond at *n* = 20 to 165 ms at *n* = 38 — while memoized and iterative both stay near a hundredth of a millisecond regardless of *n*, since each does O(*n*) work total instead of O(2ⁿ). The byte table is the more surprising half. Naive recursion allocates exactly 0 heap bytes at every size: it uses only `long` locals and no collection, so its real cost — the O(*n*)-deep call stack from the previous two sections — never touches the heap this counter watches. Memoization allocates about 2,000 bytes, the internal arrays `Dictionary<int, long>` grows into as it fills; that number does not grow further from *n* = 20 to *n* = 38 because a dictionary sized for ~20 entries already has room for ~38 (see [Amortized Analysis](/complexity/amortized-analysis/) for the same growth-by-doubling story, told there for `List<T>`). Iteration allocates nothing: no recursion, no cache, just two `long` variables reused every step.

So the trade memoization makes is specific: it buys the same asymptotic time as the loop, at the price of the cache — here a few kilobytes, for `Fib`, but scaling with the number of distinct subproblems for a harder recurrence. Whether that price is worth it, and how to shrink it once you have paid it, is the subject of dynamic programming, covered in its own article in the algorithms pillar; this page's point is narrower: "add memoization" is a time-space trade you can and should measure on both sides, not just the time side.

## What an object actually costs: struct vs class in an array

A route tracker stores GPS points as pairs of coordinates. Declared as a `struct`, each `Coordinate` is copied and stored inline, wherever it lives, [as measured directly with the same allocation counter in Value Types vs Reference Types](/csharp-dotnet/value-types-vs-reference-types/#are-structs-on-the-stack-measure-it) — a plain `int`-holding class instance there cost 24 bytes on this runtime, all overhead, for 4 bytes of actual data. Sedgewick and Wayne describe the general shape behind that number, for the similarly garbage-collected Java runtime their book targets: "the overhead associated with each object, typically 16 bytes," with "memory usage... typically padded to be a multiple of 8 bytes," and "an array of primitive-type values typically requires 24 bytes of header information (16 bytes of object overhead, 4 bytes for the length, and 4 bytes of padding)." .NET's own object layout is a different implementation, but the shape matches: a fixed per-object tax, then rounding.

`Coordinate` holds two `double` fields, 16 bytes of real data — enough to see whether that tax changes with the field size:

```csharp run id=struct-class-array
#:property Optimize=true
using System.Globalization;

CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;
const int N = 100_000;

Report("struct[]", () =>
{
    var route = new Coordinate[N];
    for (int i = 0; i < N; i++)
        route[i] = new Coordinate(i, -i);
    return route[N - 1].Lat;
});

Report("class[]", () =>
{
    var route = new CoordinatePoint[N];
    for (int i = 0; i < N; i++)
        route[i] = new CoordinatePoint(i, -i);
    return route[N - 1].Lat;
});

static void Report(string name, Func<double> build)
{
    build();   // warm-up run, not measured
    long before = GC.GetAllocatedBytesForCurrentThread();
    double result = build();
    long bytes = GC.GetAllocatedBytesForCurrentThread() - before;
    Console.WriteLine($"{name,-9}{bytes,12:N0} B");
    GC.KeepAlive(result);
}

readonly struct Coordinate(double lat, double lon)
{
    public double Lat { get; } = lat;
    public double Lon { get; } = lon;
}

class CoordinatePoint(double lat, double lon)
{
    public double Lat { get; } = lat;
    public double Lon { get; } = lon;
}
```

```text output
struct[]    1,600,024 B
class[]     4,000,024 B
```

`struct[]` is exactly 100,000 × 16 bytes plus the 24-byte array header — one heap block, the points packed side by side, no per-point overhead. `class[]` is 4,000,024 bytes: an 800,024-byte array of 8-byte references, plus 100,000 separate objects at 32 bytes each (16 bytes of header-and-padding overhead, as the Java figures above describe, plus the 16 bytes of real data — already a multiple of 8, so no further padding). Both arrays are Θ(*n*) space; the constant factor is 2.5×, purely from where the fields live. [Big-O Notation](/complexity/big-o-notation/#why-constants-and-small-terms-get-dropped) makes the same point about time — the notation is silent about constants, and they are free to matter — and here it is the same lesson applied to memory.

<figure class="diagram">
<svg viewBox="0 0 360 300" role="img" aria-labelledby="sc-layout-title sc-layout-desc">
<title id="sc-layout-title">A struct array stores points inline; a class array stores references to separate objects</title>
<desc id="sc-layout-desc">Top: a Coordinate array of two elements is one heap block, a header followed by two 16-byte fields stored side by side. Bottom: a CoordinatePoint array of two elements is a block of two references, each pointing to its own separate 32-byte object that carries its own header.</desc>
<defs>
<marker id="sc-layout-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-accent"/></marker>
</defs>
<text x="20" y="20" class="d-bold">Coordinate[2] (struct): one block</text>
<rect x="20" y="30" width="50" height="44" class="d-box-2"/>
<text x="45" y="56" text-anchor="middle" class="d-muted d-small">hdr</text>
<rect x="70" y="30" width="130" height="44" class="d-box-accent"/>
<text x="135" y="56" text-anchor="middle" class="d-mono">16 B</text>
<rect x="200" y="30" width="130" height="44" class="d-box-accent"/>
<text x="265" y="56" text-anchor="middle" class="d-mono">16 B</text>
<text x="20" y="94" class="d-muted d-small">24 B header + 2 x 16 B = 56 B total.</text>
<path d="M20 114 H340" class="d-line d-dashed"/>
<text x="20" y="140" class="d-bold">CoordinatePoint[2] (class): refs + objects</text>
<rect x="20" y="150" width="50" height="36" class="d-box-2"/>
<text x="45" y="173" text-anchor="middle" class="d-muted d-small">hdr</text>
<rect x="70" y="150" width="60" height="36" class="d-box"/>
<text x="100" y="173" text-anchor="middle" class="d-muted d-small">ref</text>
<rect x="130" y="150" width="60" height="36" class="d-box"/>
<text x="160" y="173" text-anchor="middle" class="d-muted d-small">ref</text>
<path d="M100 186 V210" class="d-accent" marker-end="url(#sc-layout-arrow)"/>
<path d="M160 186 L275 210" class="d-accent" marker-end="url(#sc-layout-arrow)"/>
<rect x="40" y="210" width="110" height="48" rx="4" class="d-box-accent"/>
<text x="95" y="238" text-anchor="middle" class="d-mono d-bold">32 B</text>
<rect x="220" y="210" width="110" height="48" rx="4" class="d-box-accent"/>
<text x="275" y="238" text-anchor="middle" class="d-mono d-bold">32 B</text>
<text x="20" y="282" class="d-muted d-small">2 objects x 32 B + refs + header: 172 B.</text>
</svg>
<figcaption>Figure 2. Both layouts are on the heap; only the struct array stores its data inline. The class array pays for a reference plus a separate header on every element, which is why the measured bytes above are 2.5 times larger for the same 100,000 points.</figcaption>
</figure>

:::dotnet
This is exactly the trade the "large array or list of small structs" case argues for a `struct` in [Value Types vs Reference Types](/csharp-dotnet/value-types-vs-reference-types/#when-a-struct-is-the-right-call): one allocation with the data packed together, against one allocation per element for a class. It is not automatic — the moment those `Coordinate` values are boxed into `object` or an interface-typed variable, each one gets its own heap object anyway, and the space advantage disappears with it.
:::

## Skipping the heap altogether: `Span<T>` and `stackalloc`

Every measurement so far that allocated, allocated on the managed heap. There is a third place data can live besides "the heap" and "a struct's own fields": the call stack itself, deliberately, for a buffer that only needs to exist for the duration of one method call. [`Span<T>`](https://learn.microsoft.com/en-us/dotnet/api/system.span-1) is documented as "a `ref struct` that is allocated on the stack rather than on the managed heap," with restrictions — it "can't be" "boxed," "assigned to variables of type `Object`... or to any interface type," used as "fields in a reference type," or "used across `await` and `yield` boundaries" — that exist specifically to stop it from ever being promoted to the heap. [`stackalloc`](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/operators/stackalloc) is how you put something there on purpose: it "allocates a block of memory on the stack," and that block "is automatically discarded when that method returns" — no garbage collector involvement, because there was never a heap allocation to collect.

A function that doubles every value in a small buffer and sums the result can use either:

```csharp run id=stackalloc-sum
#:property Optimize=true
using System.Globalization;

CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;
const int Count = 64;
int[] source = MakeReadings(Count);

Report("heap array", () => SumHeap(source));
Report("stackalloc", () => SumStack(source));

static void Report(string name, Func<long> sum)
{
    sum();   // warm-up run, not measured
    long before = GC.GetAllocatedBytesForCurrentThread();
    long result = sum();
    long bytes = GC.GetAllocatedBytesForCurrentThread() - before;
    Console.WriteLine($"{name,-12}{result,8:N0}{bytes,8:N0} B");
}

static int[] MakeReadings(int n)
{
    var random = new Random(9);
    var values = new int[n];
    for (int i = 0; i < n; i++) values[i] = random.Next(100);
    return values;
}

static long SumHeap(int[] source)
{
    int[] doubled = new int[source.Length];
    for (int i = 0; i < source.Length; i++)
        doubled[i] = source[i] * 2;
    long total = 0;
    foreach (int v in doubled) total += v;
    return total;
}

static long SumStack(int[] source)
{
    Span<int> doubled = stackalloc int[source.Length];
    for (int i = 0; i < source.Length; i++)
        doubled[i] = source[i] * 2;
    long total = 0;
    foreach (int v in doubled) total += v;
    return total;
}
```

```text output
heap array     6,566     280 B
stackalloc     6,566       0 B
```

Same result, 6,566; `SumStack` allocates nothing the GC will ever see. But `stackalloc` memory *is* the call-stack space measured earlier on this page, and it shares that space's limit: "the amount of memory available on the stack is limited. If you allocate too much memory on the stack, a `StackOverflowException` is thrown" — the same exception, uncatchable for the same reason, as unbounded recursion running out of room. `stackalloc` also turns on the runtime's buffer-overrun detection, so the documentation adds that a detected overrun "terminates the process as quickly as possible" rather than continuing to run with corrupted memory. Both are reasons the same defensive habit from the recursion section applies here too: know the bound before you allocate on the stack, or fall back to the heap when you cannot.

::::exercise[Extend the code: a safe threshold]
Rewrite `SumStack` to use `stackalloc` only when `source.Length` is at or below some constant `MaxStackLimit`, and a regular heap array otherwise — the same pattern the `stackalloc` documentation itself recommends for input of unpredictable size. Test it with a small array (below the threshold) and a large one (above it), and confirm with `GC.GetAllocatedBytesForCurrentThread` that only the large one allocates.

:::solution
```csharp run id=threshold-solved
#:property Optimize=true
using System.Globalization;

CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;
const int MaxStackLimit = 256;

foreach (int n in new[] { 64, 10_000 })
{
    int[] source = MakeReadings(n);
    Report(n, () => SumDoubled(source));
}

static void Report(int n, Func<long> sum)
{
    sum();   // warm-up run, not measured
    long before = GC.GetAllocatedBytesForCurrentThread();
    long result = sum();
    long bytes = GC.GetAllocatedBytesForCurrentThread() - before;
    Console.WriteLine($"{n,7:N0}{result,10:N0}{bytes,8:N0} B");
    GC.KeepAlive(result);
}

static int[] MakeReadings(int n)
{
    var random = new Random(9);
    var values = new int[n];
    for (int i = 0; i < n; i++) values[i] = random.Next(100);
    return values;
}

static long SumDoubled(int[] source)
{
    Span<int> doubled = source.Length <= MaxStackLimit
        ? stackalloc int[source.Length]
        : new int[source.Length];
    for (int i = 0; i < source.Length; i++)
        doubled[i] = source[i] * 2;
    long total = 0;
    foreach (int v in doubled) total += v;
    return total;
}
```

```text output
     64     6,566       0 B
 10,000   991,820  40,024 B
```

At 64 elements, well under the 256-element limit, `Span<int> doubled` is the `stackalloc` branch and costs nothing on the heap. At 10,000 the ternary picks `new int[source.Length]` instead: 10,000 × 4 bytes plus the 24-byte array header, 40,024 — the same shape as every other array allocation measured on this page. The threshold turns an unconditional stack allocation, which would risk overflowing on unexpectedly large input, into one that only ever uses a bounded, known amount of the same finite stack space Section 2 measured directly.
:::
::::
