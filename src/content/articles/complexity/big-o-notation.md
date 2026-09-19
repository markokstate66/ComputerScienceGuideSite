---
title: "Big-O Notation: What It Measures and What It Hides"
description: "Count the steps in real C# loops, meet the formal definition of Big-O with its constants c and n₀, and measure where an O(n²) sort beats an O(n log n) one."
pillar: complexity
order: 1
author: markus
published: 2026-09-18
updated: 2026-09-18
level: beginner
tags: [big-o, asymptotic-analysis, time-complexity, sorting]
prerequisites: []
sources:
  - title: "big-O notation, Dictionary of Algorithms and Data Structures"
    url: "https://xlinux.nist.gov/dads/HTML/bigOnotation.html"
    publisher: "NIST"
    accessed: 2026-09-18
  - title: "Θ (theta), Dictionary of Algorithms and Data Structures"
    url: "https://xlinux.nist.gov/dads/HTML/theta.html"
    publisher: "NIST"
    accessed: 2026-09-18
  - title: "Ω (omega), Dictionary of Algorithms and Data Structures"
    url: "https://xlinux.nist.gov/dads/HTML/omegaCapital.html"
    publisher: "NIST"
    accessed: 2026-09-18
  - title: "Algorithms, 4th ed., section 1.4: Analysis of Algorithms"
    url: "https://algs4.cs.princeton.edu/14analysis/"
    publisher: "Sedgewick and Wayne, Princeton University"
    accessed: 2026-09-18
  - title: "Algorithms, 4th ed., section 2.1: Elementary Sorts"
    url: "https://algs4.cs.princeton.edu/21elementary/"
    publisher: "Sedgewick and Wayne, Princeton University"
    accessed: 2026-09-18
  - title: "Algorithms, 4th ed., section 2.2: Mergesort"
    url: "https://algs4.cs.princeton.edu/22mergesort/"
    publisher: "Sedgewick and Wayne, Princeton University"
    accessed: 2026-09-18
  - title: "Array.Sort Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.array.sort"
    publisher: "Microsoft Learn"
    accessed: 2026-09-18
  - title: "ArraySortHelper.cs (System.Private.CoreLib), dotnet/runtime main branch"
    url: "https://github.com/dotnet/runtime/blob/main/src/libraries/System.Private.CoreLib/src/System/Collections/Generic/ArraySortHelper.cs"
    publisher: "GitHub, dotnet/runtime"
    accessed: 2026-09-18
  - title: "List<T>.Contains(T) Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.list-1.contains"
    publisher: "Microsoft Learn"
    accessed: 2026-09-18
  - title: "List<T>.BinarySearch Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.list-1.binarysearch"
    publisher: "Microsoft Learn"
    accessed: 2026-09-18
  - title: "HashSet<T>.Contains(T) Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.hashset-1.contains"
    publisher: "Microsoft Learn"
    accessed: 2026-09-18
  - title: "File-based apps"
    url: "https://learn.microsoft.com/en-us/dotnet/core/sdk/file-based-apps"
    publisher: "Microsoft Learn"
    accessed: 2026-09-18
  - title: "Introduction to Algorithms, 4th ed., chapter 3 (Characterizing Running Times)"
    url: "https://mitpress.mit.edu/9780262046305/introduction-to-algorithms/"
    publisher: "MIT Press"
    accessed: 2026-09-18
draft: true
---

A race-timing app holds an array of lap times and has to answer two questions: which lap was fastest, and which two laps were closest to each other. Both are a few lines of C#. On 1,000 laps both feel instant. On 80,000 laps the first still does, and the second, written the obvious way, takes about nine seconds on the machine used for this page. Big-O notation is how you see that coming from the code, before anyone has 80,000 laps. The way in is to count what each loop does.

## Count the steps before you time anything

The program below answers both questions for arrays of 1,000 to 8,000 random lap times, and counts one *step* every time a loop body runs. The fastest lap needs one pass. The closest pair compares each lap with every later lap.

```csharp run id=count
using System.Globalization;

CultureInfo.CurrentCulture =
    CultureInfo.InvariantCulture;

Console.WriteLine(
    $"{"n",6}{"fastest",9}{"closest pair",15}");
long previous = 0;
foreach (int n in (int[])[1_000, 2_000, 4_000, 8_000])
{
    double[] laps = MakeLaps(n);
    long scanSteps = 0, pairSteps = 0;

    // Task 1: the fastest lap. One pass.
    double fastest = laps[0];
    for (int i = 1; i < n; i++)
    {
        scanSteps++;
        if (laps[i] < fastest)
            fastest = laps[i];
    }

    // Task 2: the two laps closest in time.
    // Compare every lap with every later lap.
    double smallestGap = double.MaxValue;
    for (int i = 0; i < n; i++)
    {
        for (int j = i + 1; j < n; j++)
        {
            pairSteps++;
            double gap =
                Math.Abs(laps[i] - laps[j]);
            if (gap < smallestGap)
                smallestGap = gap;
        }
    }

    string growth = previous == 0
        ? ""
        : $"  x{(double)pairSteps / previous:F2}";
    Console.WriteLine(
        $"{n,6:N0}{scanSteps,9:N0}{pairSteps,15:N0}{growth}");
    previous = pairSteps;
}

static double[] MakeLaps(int count)
{
    var random = new Random(7);
    var laps = new double[count];
    for (int i = 0; i < count; i++)
        laps[i] = 60 + random.NextDouble() * 30;
    return laps;
}
```

```text output
     n  fastest   closest pair
 1,000      999        499,500
 2,000    1,999      1,999,000  x4.00
 4,000    3,999      7,998,000  x4.00
 8,000    7,999     31,996,000  x4.00
```

Both columns can be derived without running anything. The scan looks at every lap after the first: *n* − 1 steps. In the pair loop, lap 0 is compared with *n* − 1 later laps, lap 1 with *n* − 2, and so on down to 1. That sum is

```text
(n-1) + (n-2) + ... + 1 = n(n-1)/2
                        = n²/2 - n/2
```

and 1,000 · 999 / 2 is the 499,500 in the first row. Neither count depends on the lap times themselves, only on how many there are, which makes this a convenient first example: there is no lucky or unlucky input to worry about.

Now read down the columns instead of across. Each time *n* doubles, the scan's count doubles and the pair count is multiplied by four. Those multipliers are the information Big-O keeps. The scan is O(*n*), "order *n*"; the pair search is O(*n*²).

Choosing what to count as a step is called choosing a *cost model*; Sedgewick and Wayne's [analysis chapter](https://algs4.cs.princeton.edu/14analysis/) uses array accesses for its running example, and comparisons are the usual choice for sorting. *n* is the *input size*, here the number of laps. A function from input size to step count, such as *n*²/2 − *n*/2, is an algorithm's [time complexity](/glossary/#time-complexity); the same idea applied to memory is [space complexity](/glossary/#space-complexity).

## The count predicts growth, not milliseconds

A step count is not a running time. But if each step takes roughly the same time, multiplying the steps by four multiplies the time by four, whatever that time is. This program times the pair search (without the counter) on inputs that double.

```csharp run id=doubling
using System.Diagnostics;
using System.Globalization;

CultureInfo.CurrentCulture =
    CultureInfo.InvariantCulture;

ClosestGap(MakeLaps(2_000)); // warm-up for the JIT

Console.WriteLine($"{"n",7}{"time",12}{"growth",9}");
double previousMs = 0;
foreach (int n in (int[])[5_000, 10_000, 20_000, 40_000])
{
    double[] laps = MakeLaps(n);
    long start = Stopwatch.GetTimestamp();
    ClosestGap(laps);
    double ms = Stopwatch.GetElapsedTime(start)
        .TotalMilliseconds;

    string growth = previousMs == 0
        ? ""
        : $"x{ms / previousMs:F1}";
    Console.WriteLine($"{n,7:N0}{ms,9:F0} ms{growth,9}");
    previousMs = ms;
}

static double ClosestGap(double[] laps)
{
    double smallestGap = double.MaxValue;
    for (int i = 0; i < laps.Length; i++)
    {
        for (int j = i + 1; j < laps.Length; j++)
        {
            double gap =
                Math.Abs(laps[i] - laps[j]);
            if (gap < smallestGap)
                smallestGap = gap;
        }
    }
    return smallestGap;
}

static double[] MakeLaps(int count)
{
    var random = new Random(7);
    var laps = new double[count];
    for (int i = 0; i < count; i++)
        laps[i] = 60 + random.NextDouble() * 30;
    return laps;
}
```

```text output
      n        time   growth
  5,000[...] ms
 10,000[...] ms[...]x[...]
 20,000[...] ms[...]x[...]
 40,000[...] ms[...]x[...]
```

The measurements on this page come from .NET 10 (runtime 10.0.10) on Windows 11, on a desktop with an Intel Core i7-11700K; your digits will differ. Three runs gave 33 to 40 ms for 5,000 laps and 2.2 to 2.4 s for 40,000, and every growth factor landed between 3.6 and 4.5. A further run with an 80,000 row added took 9.0 s for that row, 4.0 times the row before it.

Split what was just measured into two parts. The 33 ms belongs to this CPU, this runtime and this way of writing the loop; a different machine, or the same loop in another language, gives another number. The factor of four belongs to the algorithm and travels with it everywhere. Big-O notation is a way of writing down the second part while saying nothing about the first. That is its strength, and as a [later section](#when-the-dropped-constant-decides-the-winner) measures, its blind spot.

## The definition, with its two constants

So far "O(*n*²)" has meant "quadruples when *n* doubles". The real definition is more careful, and short. For two functions *f* and *g* of the input size:

> *f*(*n*) is O(*g*(*n*)) if there are positive constants *c* and *n*₀ such that *f*(*n*) ≤ *c* · *g*(*n*) for every *n* ≥ *n*₀.

This is the definition in CLRS ([*Introduction to Algorithms*](https://mitpress.mit.edu/9780262046305/introduction-to-algorithms/), chapter 3) and in NIST's [Dictionary of Algorithms and Data Structures](https://xlinux.nist.gov/dads/HTML/bigOnotation.html), which calls the threshold *k* instead of *n*₀. In words: beyond some input size, *f* never exceeds a fixed multiple of *g*. To prove a Big-O claim you produce one pair (*c*, *n*₀) that works. The pair is called a *witness*.

For the pair search, *f*(*n*) = *n*²/2 − *n*/2. Since *n*/2 is never negative, *f*(*n*) ≤ ½ · *n*² for every *n* ≥ 1. The witness is *c* = ½, *n*₀ = 1, and *f* is O(*n*²).

The threshold did no work there, so take a function where it does. Suppose a routine spends 40 steps on setup and then 3 steps per item: *f*(*n*) = 3*n* + 40. It should be O(*n*). Try *c* = 3: the claim 3*n* + 40 ≤ 3*n* is false for every *n*, so that constant never works. Try *c* = 4: the claim 3*n* + 40 ≤ 4*n* simplifies to *n* ≥ 40. It fails for small inputs and holds from 40 onwards, which is all the definition asks. The witness is *c* = 4, *n*₀ = 40.

<figure class="diagram">
<svg viewBox="0 0 360 312" role="img" aria-labelledby="bound-title bound-desc">
<title id="bound-title">The line 4n overtakes f(n) = 3n + 40 at n = 40 and stays above it</title>
<desc id="bound-desc">A chart of steps against n from 0 to 80. The function 3n + 40 starts at 40. The line 4n starts at zero, below it, crosses it at n = 40 where both equal 160, and is above it from then on; that region is shaded. A dashed line 3n runs parallel to f and never reaches it.</desc>
<text x="10" y="16" class="d-muted d-small">steps</text>
<rect x="192" y="30" width="148" height="220" class="d-box-2" style="stroke:none"/>
<path d="M44 30 V250 H340" class="d-line"/>
<path d="M44 250 L340 85" class="d-line d-dashed"/>
<path d="M44 222.5 L340 57.5" class="d-line" style="stroke-width:2.5"/>
<path d="M44 250 L340 30" class="d-accent" style="stroke-width:2.5"/>
<path d="M192 250 V140" class="d-accent d-dashed"/>
<circle cx="192" cy="140" r="4.5" class="d-fill-accent"/>
<text x="52" y="150" class="d-bold">f(n) = 3n + 40</text>
<text x="318" y="38" text-anchor="end" class="d-text-accent d-bold">c·g(n) = 4n</text>
<text x="336" y="172" text-anchor="end" class="d-muted d-small">3n (dashed)</text>
<text x="336" y="188" text-anchor="end" class="d-muted d-small">never reaches f</text>
<text x="40" y="254" text-anchor="end" class="d-small d-mono">0</text>
<text x="40" y="144" text-anchor="end" class="d-small d-mono">160</text>
<text x="40" y="34" text-anchor="end" class="d-small d-mono">320</text>
<text x="44" y="268" text-anchor="middle" class="d-small d-mono">0</text>
<text x="118" y="268" text-anchor="middle" class="d-small d-mono">20</text>
<text x="192" y="268" text-anchor="middle" class="d-small d-text-accent d-bold">n₀ = 40</text>
<text x="266" y="268" text-anchor="middle" class="d-small d-mono">60</text>
<text x="340" y="268" text-anchor="middle" class="d-small d-mono">80</text>
<text x="20" y="290" class="d-small">Left of n₀ the bound fails: f(20) = 100 > 80.</text>
<text x="20" y="306" class="d-small">From n₀ on (shaded), f(n) ≤ 4n holds for good.</text>
</svg>
<figcaption>Figure 1. The two constants at work for <em>f</em>(<em>n</em>) = 3<em>n</em> + 40. The multiplier <em>c</em> = 4 tilts the line <em>g</em>(<em>n</em>) = <em>n</em> steeply enough to overtake <em>f</em>; the threshold <em>n</em>₀ = 40 marks where it does. With <em>c</em> = 3 the lines are parallel and no threshold would ever help.</figcaption>
</figure>

Witnesses are not unique. *c* = 43 with *n*₀ = 1 also works for 3*n* + 40, because 40 ≤ 40*n* once *n* ≥ 1. A bigger *c* buys a smaller *n*₀ and the other way round. Nobody cares which pair you pick; only that one exists.

The definition also lets you prove a bound *false*. Is the pair search O(*n*)? That would need *n*²/2 − *n*/2 ≤ *c* · *n* for all large *n*. Divide by *n*: *n*/2 − ½ ≤ *c*, that is, *n* ≤ 2*c* + 1. Whatever *c* you choose, every *n* beyond 2*c* + 1 breaks the inequality, so no witness exists. A quadratic function cannot be held under any straight line forever.

::::exercise[Produce the witnesses]
A function performs *f*(*n*) = 2*n*² + 9*n* + 50 steps.

1. Find a witness (*c*, *n*₀) showing *f* is O(*n*²).
2. Find a second witness with *c* = 3.
3. Show that *f* is not O(*n*).

:::solution
1. For *n* ≥ 1, 9*n* ≤ 9*n*² and 50 ≤ 50*n*². So *f*(*n*) ≤ (2 + 9 + 50) *n*² = 61*n*². Witness: *c* = 61, *n*₀ = 1. Replacing every lower-order term by the same multiple of the leading power is a lazy trick, and it works for every polynomial.
2. 2*n*² + 9*n* + 50 ≤ 3*n*² is the same as 9*n* + 50 ≤ *n*². At *n* = 12 that reads 158 ≤ 144, false. At *n* = 13 it reads 167 ≤ 169, true, and from there on the right side grows faster (it gains 2*n* + 1 per step against 9). Witness: *c* = 3, *n*₀ = 13.
3. Since *f*(*n*) ≥ 2*n*², a bound *f*(*n*) ≤ *c* · *n* would force 2*n*² ≤ *c* · *n*, so *n* ≤ *c*/2. That fails for every *n* above *c*/2, whatever *c* is.
:::
::::

## Why constants and small terms get dropped

The exact count for the pair search is *n*²/2 − *n*/2. Its Big-O is written O(*n*²): no ½, no −*n*/2. Three separate reasons make that legitimate.

**The definition absorbs them.** A constant factor in *f* is swallowed by *c*, and a lower-order term is swallowed by a slightly larger *c* or a later *n*₀; the exercise above did both. O(½*n*²) and O(*n*²) describe exactly the same set of functions, so the shorter name is used. The same goes for the base of a logarithm: log₂ *n* = log₁₀ *n* / log₁₀ 2, a constant multiple, which is why "O(log *n*)" never states a base.

**The constant was never well defined.** Count array reads instead of loop iterations and the pair search costs *n*² − *n* steps. Count machine instructions and it is some larger multiple. The cost model moves the constant; it does not move the *n*². Dropping the constant leaves only what all the models agree on.

**For large *n* the leading term is nearly everything.** In the last row of the first output, the −*n*/2 term is worth 4,000 steps out of 31,996,000, about one part in eight thousand.

All three arguments are sound, and all three are arguments about *large n*. The definition says "for every *n* ≥ *n*₀" and says nothing at all about inputs below the threshold. There, the discarded constants are the whole story.

## When the dropped constant decides the winner

Two classic sorts make the point. Both costs here are from Sedgewick and Wayne, measured in comparisons:

- **Insertion sort** grows a sorted prefix by sliding each new item leftwards into place. On a randomly ordered array of distinct keys it uses about *n*²/4 comparisons on average; the worst case (reverse order) is about *n*²/2, and the best case (already sorted) is *n* − 1 ([section 2.1](https://algs4.cs.princeton.edu/21elementary/)). Worst case Θ(*n*²), no extra memory.
- **Merge sort** sorts each half [recursively](/glossary/#recursion) and merges the two. Top-down merge sort uses between ½ *n* log₂ *n* and *n* log₂ *n* comparisons on any input ([section 2.2](https://algs4.cs.princeton.edu/22mergesort/)): Θ(*n* log *n*) in every case, at the price of a second array of *n* items to merge through.

For large inputs merge sort wins without a contest. The program in the collapsed block below asks what happens for small ones. For each size it builds many random arrays (enough to total two million values), sorts copies of all of them with each algorithm, checks the results, and reports the best of five rounds as time per array.

The full program's first line is a build directive. [`#:property`](https://learn.microsoft.com/en-us/dotnet/core/sdk/file-based-apps) sets an MSBuild property for a single-file program, and `Optimize=true` asks the compiler for optimized code, as a release build would. What happens without it turns out to be part of the lesson.

<details>
<summary>Full program: the timing harness and both sorts</summary>

```csharp run id=crossover
#:property Optimize=true
using System.Diagnostics;
using System.Globalization;

CultureInfo.CurrentCulture =
    CultureInfo.InvariantCulture;

const int ValuesPerSize = 2_000_000;
var random = new Random(11);

Console.WriteLine(
    $"{"n",5}{"insertion",12}{"merge",12}  faster");
foreach (int n in (int[])[8, 16, 32, 64, 128, 256, 512, 1024, 2048])
{
    int arrays = Math.Max(4, ValuesPerSize / n);
    var inputs = new int[arrays][];
    for (int a = 0; a < arrays; a++)
    {
        inputs[a] = new int[n];
        for (int i = 0; i < n; i++)
            inputs[a][i] = random.Next();
    }

    double insertionNs = double.MaxValue;
    double mergeNs = double.MaxValue;
    for (int round = 0; round < 5; round++)
    {
        insertionNs = Math.Min(insertionNs,
            TimePerArray(inputs, InsertionSort));
        mergeNs = Math.Min(mergeNs,
            TimePerArray(inputs, MergeSort));
    }

    string faster = insertionNs < mergeNs
        ? "insertion" : "merge";
    Console.WriteLine(
        $"{n,5}{insertionNs,9:N0} ns{mergeNs,9:N0} ns" +
        $"  {faster}");
}

static double TimePerArray(int[][] inputs, Action<int[]> sort)
{
    // Sort copies, so every round sees the same unsorted data.
    var copies = new int[inputs.Length][];
    for (int a = 0; a < inputs.Length; a++)
        copies[a] = (int[])inputs[a].Clone();

    long start = Stopwatch.GetTimestamp();
    foreach (int[] copy in copies) sort(copy);
    TimeSpan took = Stopwatch.GetElapsedTime(start);

    foreach (int[] copy in copies)
        for (int i = 1; i < copy.Length; i++)
            if (copy[i - 1] > copy[i])
                throw new InvalidOperationException("Not sorted.");
    return took.TotalNanoseconds / inputs.Length;
}

static void InsertionSort(int[] items)
{
    for (int i = 1; i < items.Length; i++)
    {
        int value = items[i];
        int j = i - 1;
        while (j >= 0 && items[j] > value)
        {
            items[j + 1] = items[j];
            j--;
        }
        items[j + 1] = value;
    }
}

static void MergeSort(int[] items)
{
    if (items.Length < 2) return;
    Split(items, new int[items.Length], 0, items.Length);
}

static void Split(
    int[] items, int[] buffer, int lo, int hi)
{
    if (hi - lo < 2) return;
    int mid = lo + (hi - lo) / 2;
    Split(items, buffer, lo, mid);
    Split(items, buffer, mid, hi);

    // Merge the two sorted halves via the buffer.
    Array.Copy(items, lo, buffer, lo, hi - lo);
    int left = lo, right = mid;
    for (int k = lo; k < hi; k++)
    {
        if (right >= hi ||
            (left < mid && buffer[left] <= buffer[right]))
            items[k] = buffer[left++];
        else
            items[k] = buffer[right++];
    }
}
```

```text output
    n   insertion       merge  faster
    8[...] ns[...] ns  insertion
   16[...] ns[...] ns  insertion
   32[...] ns[...] ns  insertion
   64[...] ns[...] ns  insertion
  128[...] ns[...] ns  [...]
  256[...] ns[...] ns  [...]
  512[...] ns[...] ns  [...]
 1024[...] ns[...] ns  merge
 2048[...] ns[...] ns  merge
```

</details>

The parts of it that matter are the two sorts:

```csharp snippet of=crossover
static void InsertionSort(int[] items)
{
    for (int i = 1; i < items.Length; i++)
    {
        int value = items[i];
        int j = i - 1;
        while (j >= 0 && items[j] > value)
        {
            items[j + 1] = items[j];
            j--;
        }
        items[j + 1] = value;
    }
}
// ...
static void Split(
    int[] items, int[] buffer, int lo, int hi)
{
    if (hi - lo < 2) return;
    int mid = lo + (hi - lo) / 2;
    Split(items, buffer, lo, mid);
    Split(items, buffer, mid, hi);

    // Merge the two sorted halves via the buffer.
    Array.Copy(items, lo, buffer, lo, hi - lo);
    int left = lo, right = mid;
    for (int k = lo; k < hi; k++)
    {
        if (right >= hi ||
            (left < mid && buffer[left] <= buffer[right]))
            items[k] = buffer[left++];
        else
            items[k] = buffer[right++];
    }
}
```

The digits vary from run to run. One of two near-identical runs on the machine described earlier printed:

```text
    n   insertion       merge  faster
    8       53 ns      198 ns  insertion
   16      132 ns      474 ns  insertion
   32      358 ns      926 ns  insertion
   64    1,029 ns    2,171 ns  insertion
  128    3,041 ns    4,996 ns  insertion
  256    9,814 ns   10,247 ns  insertion
  512   34,734 ns   22,518 ns  merge
 1024  125,121 ns   48,393 ns  merge
 2048  479,975 ns  103,718 ns  merge
```

At 8 items the O(*n*²) algorithm is almost four times faster than the O(*n* log *n*) one. It keeps its lead up to a dead heat at 256 and loses from 512 on; by 2,048 it is more than four times slower, and the gap widens from there just as the notation promises. Look at how each column grows: insertion sort's time is multiplied by 3.6 to 3.8 per doubling at the bottom of the table (heading for 4), merge sort's by a little over 2.

The reason is the constants. Insertion sort's inner loop is one comparison and one assignment on a single array, with no method calls. Merge sort pays for a recursive call per split, a copy of every range into the buffer, and a loop body with three conditions. Each of its steps costs more, and at small sizes it does not take enough fewer of them to make up for that.

Now remove the first line of the program. On the same machine both sorts became slower, but not equally: insertion sort was still ahead at 64 and merge sort won from 128. The algorithms had not changed and neither had their Big-O. A compiler switch changed the constants, and the crossover moved by a factor of about four. That is the precise sense in which Big-O "ignores constants": it is silent about them, and they are free to matter.

:::dotnet
Library sorts are built around this crossover. The documentation for [`Array.Sort`](https://learn.microsoft.com/en-us/dotnet/api/system.array.sort) describes an introspective sort: insertion sort when a partition has 16 elements or fewer, heapsort if the partitioning goes too deep, quicksort otherwise, O(*n* log *n*) overall. In the current source, [`ArraySortHelper.cs`](https://github.com/dotnet/runtime/blob/main/src/libraries/System.Private.CoreLib/src/System/Collections/Generic/ArraySortHelper.cs) goes one step further and sorts partitions of 2 and 3 elements with hard-coded compare-and-swap calls. Those remarks describe the current implementation; treat the 16 as a detail that can change between releases.
:::

::::exercise[Extend the code: a merge sort that switches]
Change the merge sort so that a range of `cutoff` items or fewer is finished by insertion sort instead of being split further. Time it on one array of 1,000,000 random integers with cutoffs of 1 (pure merge sort), 8, 16, 32, 64 and 256. Before you run it: the table above says insertion sort wins up to 256. Do you expect 256 to be the best cutoff?

:::solution
`Split` gains a parameter and a different base case; `InsertionSort` now works on a range.

```csharp run id=ex-hybrid
#:property Optimize=true
using System.Diagnostics;
using System.Globalization;

CultureInfo.CurrentCulture =
    CultureInfo.InvariantCulture;

const int Length = 1_000_000;
var random = new Random(23);
var input = new int[Length];
for (int i = 0; i < Length; i++) input[i] = random.Next();

Console.WriteLine($"{"cutoff",6}{"time",10}{"vs pure",9}");
double pureMs = 0;
foreach (int cutoff in (int[])[1, 8, 16, 32, 64, 256])
{
    double best = double.MaxValue;
    for (int round = 0; round < 5; round++)
    {
        var copy = (int[])input.Clone();
        long start = Stopwatch.GetTimestamp();
        HybridSort(copy, cutoff);
        best = Math.Min(best,
            Stopwatch.GetElapsedTime(start).TotalMilliseconds);
        for (int i = 1; i < copy.Length; i++)
            if (copy[i - 1] > copy[i])
                throw new InvalidOperationException("Not sorted.");
    }

    if (cutoff == 1) pureMs = best;
    Console.WriteLine(
        $"{cutoff,6}{best,7:F0} ms{best / pureMs,8:P0}");
}

static void HybridSort(int[] items, int cutoff) =>
    Split(items, new int[items.Length], 0, items.Length, cutoff);

static void Split(
    int[] items, int[] buffer, int lo, int hi, int cutoff)
{
    if (hi - lo <= cutoff)
    {
        InsertionSort(items, lo, hi);
        return;
    }

    int mid = lo + (hi - lo) / 2;
    Split(items, buffer, lo, mid, cutoff);
    Split(items, buffer, mid, hi, cutoff);

    Array.Copy(items, lo, buffer, lo, hi - lo);
    int left = lo, right = mid;
    for (int k = lo; k < hi; k++)
    {
        if (right >= hi ||
            (left < mid && buffer[left] <= buffer[right]))
            items[k] = buffer[left++];
        else
            items[k] = buffer[right++];
    }
}

static void InsertionSort(int[] items, int lo, int hi)
{
    for (int i = lo + 1; i < hi; i++)
    {
        int value = items[i];
        int j = i - 1;
        while (j >= lo && items[j] > value)
        {
            items[j + 1] = items[j];
            j--;
        }
        items[j + 1] = value;
    }
}
```

```text output
cutoff      time  vs pure
     1[...] ms[...]%
     8[...] ms[...]%
    16[...] ms[...]%
    32[...] ms[...]%
    64[...] ms[...]%
   256[...] ms[...]%
```

Two runs on the machine used here gave about 90 ms for pure merge sort, 73 to 75 ms (81 to 84 percent) for cutoffs of 32 and 64, and 93 ms for a cutoff of 256, slightly *worse* than not switching at all. Sedgewick and Wayne [report](https://algs4.cs.princeton.edu/22mergesort/) a 10 to 15 percent gain for a typical implementation, the same order as this one.

The best cutoff is well below 256 because the earlier table asked the wrong question for this purpose. It raced insertion sort against *pure* merge sort on 256 items. Inside the hybrid, the alternative to insertion-sorting a block of 256 is to split it into blocks of 32 that are insertion-sorted and then merged, and that is faster than either pure algorithm. The hybrid is still Θ(*n* log *n*) in the worst case: the insertion-sorted blocks have a fixed maximum size, so they add at most a constant times *n*. The cutoff tunes the constant, which is all a cutoff can do.
:::
::::

Constants are the biggest thing the notation hides, but three others deserve a sentence each.

- **Which input.** Big-O bounds a function, and an algorithm has several: its worst-case step count, its best case, its average over some distribution of inputs. "Insertion sort is O(*n*²)" is about the worst case; on sorted input it takes *n* − 1 comparisons. When no case is named, assume the worst case is meant, and check.
- **What a step really costs.** The cost model charges the same for every array access. Hardware does not, and Sedgewick and Wayne [warn](https://algs4.cs.princeton.edu/14analysis/) that their analysis leaves out system effects such as caching, garbage collection and just-in-time compilation.
- **How big *n* gets.** If the input is the seven days of the week, every algorithm is fast, and the clearest code is the right code.

## O, Ω and Θ: upper bound, lower bound, both

Big-O is an upper bound, and upper bounds are allowed to be loose. Merge sort is O(*n* log *n*). It is also, truthfully, O(*n*²) and O(*n*³), in the way that a person who is 30 is also "under 90". Two companion notations close the gap. The definitions below are again those of CLRS chapter 3 and the NIST dictionary ([Ω](https://xlinux.nist.gov/dads/HTML/omegaCapital.html), [Θ](https://xlinux.nist.gov/dads/HTML/theta.html)).

- ***f*(*n*) is Ω(*g*(*n*))**, "big omega", if there are positive constants *c* and *n*₀ with *f*(*n*) ≥ *c* · *g*(*n*) for every *n* ≥ *n*₀. A lower bound: *f* grows at least as fast as *g*.
- ***f*(*n*) is Θ(*g*(*n*))**, "big theta", if it is both O(*g*(*n*)) and Ω(*g*(*n*)): it can be sandwiched between two multiples of *g*. A tight bound: *f* grows exactly as fast as *g*.

The pair count is Θ(*n*²). The upper half was proved above with *c* = ½. For the lower half, *n*/2 ≤ *n*²/4 once *n* ≥ 2, so *n*²/2 − *n*/2 ≥ ¼ · *n*² from *n*₀ = 2. Sandwiched between ¼*n*² and ½*n*², the count cannot be described by any other power of *n*.

The NIST entry notes that Big-O is often misused to mean "equal to" rather than "less than": a speaker who says "this loop is O(*n*²)" frequently means Θ(*n*²). In conversation that rarely causes trouble. When a statement has to be exact, for instance "no comparison sort can beat this" or "this loop really is quadratic, not just at most quadratic", Ω and Θ are the tools.

:::pitfall
O, Ω and Θ are not "worst case, best case, average case". The notation bounds a function; the case chooses *which* function. Every combination is meaningful: insertion sort's worst case is Θ(*n*²), its best case is Θ(*n*), and the algorithm taken over all inputs is O(*n*²) and Ω(*n*), with no single Θ that covers every input.
:::

You will also see the definition written with an equals sign, *f*(*n*) = O(*g*(*n*)); the NIST entries do it. Read that "=" as "is": it only works left to right. *n* = O(*n*²) is true, O(*n*²) = *n* is meaningless, and from *n* = O(*n*²) and *n*² = O(*n*²) you may not conclude that *n* = *n*².

::::exercise[True, false, or not even a claim]
Decide each statement, using the definitions rather than intuition.

1. Merge sort's comparison count is O(*n*³).
2. Insertion sort's comparison count on every input is Ω(*n*²).
3. If algorithm A is O(*n*) and algorithm B is O(*n*²), A is faster than B on an input of size 10.
4. 100*n* + 5 is Θ(*n*).
5. 2<sup>*n*+1</sup> is O(2ⁿ).
6. 2<sup>2*n*</sup> is O(2ⁿ).

:::solution
1. **True.** At most *n* log₂ *n* ≤ *n*³ for *n* ≥ 1. True and useless: an upper bound is only informative when it is close.
2. **False.** On sorted input the count is *n* − 1, which is not at least *c* · *n*² for any positive *c* once *n* is large. The *worst-case* count is Ω(*n*²).
3. **Does not follow.** Big-O says nothing about any particular *n*, and nothing about constants. The sorting table showed the opposite outcome at *n* = 8. It does not even follow for large *n*, because O(*n*²) is only an upper bound: B might in fact be linear.
4. **True.** Upper: 100*n* + 5 ≤ 105*n* for *n* ≥ 1. Lower: 100*n* + 5 ≥ 100*n* always.
5. **True.** 2<sup>*n*+1</sup> = 2 · 2ⁿ, so *c* = 2 works. A constant added to an exponent is a constant factor.
6. **False.** 2<sup>2*n*</sup> = 2ⁿ · 2ⁿ. The ratio to 2ⁿ is 2ⁿ itself, which outgrows every constant *c*. A constant *factor* in an exponent is not a constant factor of the function.
:::
::::

## The growth rates you will meet, judged by doubling

A handful of functions cover nearly every bound you will read. The most practical way to tell them apart is the test from the first section: what happens to the work when *n* doubles?

| Bound | If *n* doubles, the work |
|---|---|
| O(1) | is unchanged |
| O(log *n*) | gains one step |
| O(*n*) | doubles |
| O(*n* log *n*) | just over doubles |
| O(*n*²) | quadruples |
| O(*n*³) | grows 8-fold |
| O(2ⁿ) | is squared |
| O(*n*!) | grows faster still |

Each row has a familiar face. In .NET, [`HashSet<T>.Contains`](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.hashset-1.contains) is documented as O(1), [`List<T>.BinarySearch`](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.list-1.binarysearch) as O(log *n*), [`List<T>.Contains`](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.list-1.contains) as O(*n*) and [`Array.Sort`](https://learn.microsoft.com/en-us/dotnet/api/system.array.sort) as O(*n* log *n*). Comparing every pair of *n* items is O(*n*²) and every triple O(*n*³); trying every subset of *n* items is O(2ⁿ), and every ordering of them O(*n*!).

Two of the documented bounds carry conditions that the one-line form hides: binary search requires a list that is already sorted, and the O(1) for a [hash table](/glossary/#hash-table) lookup depends on the hash function spreading the items evenly across the table.

To get a feel for the distances between the rows, turn them into a budget. Assume, generously, that a step takes one nanosecond, so that one second buys a billion steps. The program finds the largest *n* each growth rate can handle in that second. Nothing here is measured; it is arithmetic on the assumption.

```csharp run id=budget
using System.Globalization;

CultureInfo.CurrentCulture =
    CultureInfo.InvariantCulture;

// Assumption: one step takes one nanosecond,
// so one second buys 1,000,000,000 steps.
const double Budget = 1e9;

(string Name, Func<double, double> Steps)[] classes =
[
    ("n",       n => n),
    ("n log n", n => n * Math.Log2(n)),
    ("n^2",     n => n * n),
    ("n^3",     n => n * n * n),
    ("2^n",     n => Math.Pow(2, n)),
    ("n!",      Factorial),
];

Console.WriteLine($"{"steps",-9}{"largest n in 1 s",18}");
foreach (var (name, steps) in classes)
{
    // Steps(n) only grows, so search for the last n that fits:
    // double an upper limit, then bisect.
    long fits = 1, tooBig = 2;
    while (steps(tooBig) <= Budget)
        (fits, tooBig) = (tooBig, tooBig * 2);
    while (tooBig - fits > 1)
    {
        long mid = fits + (tooBig - fits) / 2;
        if (steps(mid) <= Budget) fits = mid;
        else tooBig = mid;
    }
    Console.WriteLine($"{name,-9}{fits,18:N0}");
}

static double Factorial(double n)
{
    double product = 1;
    for (int k = 2; k <= n; k++) product *= k;
    return product;
}
```

```text output
steps      largest n in 1 s
n             1,000,000,000
n log n          39,620,077
n^2                  31,622
n^3                   1,000
2^n                      29
n!                       12
```

The top two rows are separated by a factor of 25: for practical purposes *n* log *n* is "linear with a small tax", which is why sorting first is so often an acceptable move. Then the cliff: a quadratic algorithm gets through 31,622 items in the time a linear one handles a billion. The last two rows are a different kind of thing. A machine a thousand times faster raises the quadratic limit to about a million; it raises the 2ⁿ limit from 29 to 39, because each extra item doubles the work and 2¹⁰ is about a thousand. O(log *n*) and O(1) are missing from the table because no input you could store would use up the budget.

<figure class="diagram">
<svg viewBox="0 0 360 574" role="img" aria-labelledby="curves-title curves-desc">
<title id="curves-title">Growth rates plotted on linear axes and again on logarithmic axes</title>
<desc id="curves-desc">Top chart, linear axes up to n = 32 and 1,024 steps: 2 to the n leaves the chart before n = 10, n squared curves up to the top right corner, and n log n, n and log n are squashed along the bottom. Bottom chart, logarithmic axes up to n = one billion and ten to the twelfth steps: n, n squared and n cubed are straight lines of increasing slope, n log n runs just above n, log n is almost flat, and 2 to the n bends upward almost vertically. A dashed horizontal line at one billion steps crosses the curves at n = 29, 1,000, 31,622, about 40 million and one billion.</desc>
<text x="20" y="18" class="d-bold">Linear axes: n up to 32</text>
<path d="M44 40 V210 H340" class="d-line"/>
<path d="M53.3 210 L62.5 209.8 L81 209.7 L118 209.5 L192 209.3 L340 209.2" class="d-good" style="stroke-width:2"/>
<path d="M44 210 L340 204.7" class="d-good" style="stroke-width:2"/>
<path d="M62.5 209.7 L90.3 208.1 L118 206 L145.8 203.7 L173.5 201.2 L201.3 198.5 L229 195.6 L256.8 192.7 L284.5 189.7 L312.3 186.6 L340 183.4" class="d-good" style="stroke-width:2"/>
<path d="M44 210 L62.5 209.3 L81 207.3 L99.5 204 L118 199.4 L136.5 193.4 L155 186.1 L173.5 177.5 L192 167.5 L210.5 156.2 L229 143.6 L247.5 129.6 L266 114.4 L284.5 97.8 L303 79.8 L321.5 60.6 L340 40" class="d-accent" style="stroke-width:2.5"/>
<path d="M44 209.8 L62.5 209.3 L81 207.3 L90.3 204.7 L99.5 199.4 L108.8 188.8 L113.4 179.9 L118 167.5 L122.6 149.9 L127.3 125 L131.9 89.8 L136.5 40" class="d-bad" style="stroke-width:2.5"/>
<text x="144" y="54" class="d-text-bad d-bold">2ⁿ</text>
<text x="312" y="50" text-anchor="end" class="d-text-accent d-bold">n²</text>
<text x="336" y="174" text-anchor="end" class="d-text-good d-small">n log n</text>
<text x="40" y="214" text-anchor="end" class="d-small d-mono">0</text>
<text x="40" y="129" text-anchor="end" class="d-small d-mono">512</text>
<text x="40" y="44" text-anchor="end" class="d-small d-mono">1024</text>
<text x="44" y="226" text-anchor="middle" class="d-small d-mono">0</text>
<text x="118" y="226" text-anchor="middle" class="d-small d-mono">8</text>
<text x="192" y="226" text-anchor="middle" class="d-small d-mono">16</text>
<text x="266" y="226" text-anchor="middle" class="d-small d-mono">24</text>
<text x="340" y="226" text-anchor="middle" class="d-small d-mono">32</text>
<text x="20" y="246" class="d-muted d-small">n and log n are there too, flat along the axis.</text>
<text x="20" y="274" class="d-bold">Log axes: n up to 10⁹</text>
<path d="M44 290 V530 H340" class="d-line"/>
<path d="M44 350 H340" class="d-line d-dashed"/>
<path d="M53.9 530 L63.7 524 L76.9 519.6 L93.3 516.1 L109.8 513.6 L142.7 510 L175.6 507.5 L208.4 505.6 L241.3 504 L274.2 502.7 L307.1 501.5 L340 500.5" class="d-good" style="stroke-width:2"/>
<path d="M44 530 L340 350" class="d-good" style="stroke-width:2"/>
<path d="M53.9 524 L63.7 512 L76.9 499.6 L93.3 486.1 L109.8 473.6 L142.7 450 L175.6 427.5 L208.4 405.6 L241.3 384 L274.2 362.7 L307.1 341.5 L340 320.5" class="d-good" style="stroke-width:2"/>
<path d="M44 530 L241.3 290" class="d-accent" style="stroke-width:2.5"/>
<path d="M44 530 L175.6 290" class="d-accent" style="stroke-width:2.5"/>
<path d="M44 524 L53.9 518 L63.7 506 L70.3 492 L76.9 469.8 L80.2 454.2 L83.5 434.6 L86.8 409.9 L90 378.8 L93.3 339.6 L95 316.4 L96.6 290" class="d-bad" style="stroke-width:2.5"/>
<circle cx="92.1" cy="350" r="4" class="d-fill-bad"/>
<circle cx="142.7" cy="350" r="4" class="d-fill-accent"/>
<circle cx="192" cy="350" r="4" class="d-fill-accent"/>
<circle cx="293.9" cy="350" r="4" class="d-fill-good"/>
<circle cx="340" cy="350" r="4" class="d-fill-good"/>
<text x="104" y="306" class="d-text-bad d-bold">2ⁿ</text>
<text x="183" y="306" class="d-text-accent d-bold">n³</text>
<text x="249" y="306" class="d-text-accent d-bold">n²</text>
<text x="330" y="314" text-anchor="end" class="d-text-good d-small">n log n</text>
<text x="336" y="376" text-anchor="end" class="d-text-good d-small">n</text>
<text x="336" y="520" text-anchor="end" class="d-text-good d-small">log n</text>
<text x="40" y="534" text-anchor="end" class="d-small d-mono">1</text>
<text x="40" y="474" text-anchor="end" class="d-small">10³</text>
<text x="40" y="414" text-anchor="end" class="d-small">10⁶</text>
<text x="40" y="354" text-anchor="end" class="d-small d-bold">10⁹</text>
<text x="40" y="294" text-anchor="end" class="d-small">10¹²</text>
<text x="44" y="546" text-anchor="middle" class="d-small d-mono">1</text>
<text x="142.7" y="546" text-anchor="middle" class="d-small">10³</text>
<text x="241.3" y="546" text-anchor="middle" class="d-small">10⁶</text>
<text x="336" y="546" text-anchor="middle" class="d-small">10⁹</text>
<text x="20" y="566" class="d-muted d-small">Dashed: 10⁹ steps. Dots: the limits in the table.</text>
</svg>
<figcaption>Figure 2. The same growth rates drawn twice. On linear axes (top) only the two fastest growers are visible. On log-log axes (bottom) every power of <em>n</em> is a straight line whose slope is its exponent, so <em>n</em>² climbs twice as steeply as <em>n</em>, while 2ⁿ bends upward and leaves the chart before <em>n</em> = 40. The dots where the curves cross the dashed line are the limits printed by the budget program.</figcaption>
</figure>

The log-log picture is also a measuring tool. Plot running time against *n* on log-log axes and read the slope: about 1 means linear, about 2 quadratic. The doubling experiment near the top of this page is the same test in numbers: a growth factor of 4 per doubling is a slope of log₂ 4 = 2.

## Reading a bound off C# code

Working out bounds for nested loops and recursive methods is a subject in its own right. For everyday code, a few rules go a long way.

1. **Statements in sequence add, and the largest term wins.** A sort followed by a single pass is O(*n* log *n*) + O(*n*) = O(*n* log *n*).
2. **Nested loops multiply**, if the inner loop's trip count does not depend on the outer variable. If it does, add up the trips as the first section did: the inner loop there shrinks every time round, yet the total is still Θ(*n*²).
3. **A loop variable that is multiplied or divided by a constant** each time round runs about log *n* times. Doubling from 1 reaches *n* after log₂ *n* steps.
4. **Two inputs get two variables.** Comparing every item of one list with every item of another is O(*n* · *m*). Writing O(*n*²) quietly assumes the lists are the same size.
5. **A method call costs what the method costs.** The loop that decides the bound may not be on the screen at all.

The next program checks an array of IDs for a repeat in two ways. Both versions are a single visible loop. One remembers the IDs it has seen in a `List<int>`, the other in a `HashSet<int>`. The IDs are all distinct, so neither can stop early.

```csharp run id=hidden
using System.Diagnostics;
using System.Globalization;

CultureInfo.CurrentCulture =
    CultureInfo.InvariantCulture;

// Warm-up at full size, so the JIT has finished
// optimizing both methods before the timed runs.
HasRepeatList(MakeIds(200_000));
HasRepeatSet(MakeIds(200_000));

Console.WriteLine($"{"n",8}{"List",12}{"HashSet",12}");
foreach (int n in (int[])[25_000, 50_000, 100_000, 200_000])
{
    int[] ids = MakeIds(n);
    double listMs =
        TimeMs(() => HasRepeatList(ids));
    double setMs =
        TimeMs(() => HasRepeatSet(ids));
    Console.WriteLine(
        $"{n,8:N0}{listMs,9:F1} ms{setMs,9:F1} ms");
}

static bool HasRepeatList(int[] ids)
{
    var seen = new List<int>();
    foreach (int id in ids)
    {
        if (seen.Contains(id))
            return true;
        seen.Add(id);
    }
    return false;
}

static bool HasRepeatSet(int[] ids)
{
    var seen = new HashSet<int>();
    foreach (int id in ids)
        if (!seen.Add(id)) return true;
    return false;
}

// Distinct ids in shuffled order: the worst case,
// because neither method can stop early.
static int[] MakeIds(int count)
{
    int[] ids = [.. Enumerable.Range(1, count)];
    new Random(5).Shuffle(ids);
    return ids;
}

static double TimeMs(Func<bool> check)
{
    long start = Stopwatch.GetTimestamp();
    if (check())
        throw new InvalidOperationException("Ids are distinct.");
    return Stopwatch.GetElapsedTime(start).TotalMilliseconds;
}
```

```text output
       n        List     HashSet
  25,000[...] ms[...] ms
  50,000[...] ms[...] ms
 100,000[...] ms[...] ms
 200,000[...] ms[...] ms
```

Two runs on the machine used here put the `List` column at about 12, 45, 220 and 1,100 ms: growth factors between 3.4 and 5.2 per doubling. The `HashSet` column went from under 1 ms to between 6 and 10 ms, roughly doubling each time, though at these durations the timer noise is a large share of the reading.

[`List<T>.Contains`](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.list-1.contains) is documented as a linear search, O(*n*) in the list's `Count`. Called once per ID on a list that grows from 0 to *n* − 1 entries, it examines 0 + 1 + … + (*n* − 1) entries in total: the same *n*(*n* − 1)/2 as the lap pairs, inside what looks like a single loop. The model predicts a factor of four; the measured factor drifts above that at the largest sizes, one more reminder that a step is not a fixed amount of time. The `HashSet` version does O(1) work per ID under the usual hashing assumption, O(*n*) in total, and at 200,000 IDs it is more than a hundred times faster.

::::exercise[A nested loop that is not what it seems]
Without running it (it prints nothing anyway), give a Θ bound for the number of times `steps++` executes, as a function of `n`. The outer loop runs about log₂ *n* times and the inner loop's longest run is at least *n*/2, so rule 2 suggests O(*n* log *n*). Is that bound true? Is it tight?

```csharp run id=ex-blocks-question
int n = 1_000_000;
long steps = 0;

for (int block = 1;
     block < n;
     block *= 2)
{
    for (int j = 0; j < block; j++)
        steps++;
}
```

:::solution
O(*n* log *n*) is true, and it is not tight. The inner trip count depends on the outer variable, so the trips have to be added, not multiplied: 1 + 2 + 4 + … up to the last power of two below *n*. A sum of doubling terms is less than twice its last term, and the last term is below *n*, so the total is below 2*n*. It is also at least *n*/2, since the last term alone is. The count is Θ(*n*).

```csharp run id=ex-blocks
using System.Globalization;

CultureInfo.CurrentCulture =
    CultureInfo.InvariantCulture;

Console.WriteLine($"{"n",10}{"steps",12}{"steps / n",11}");
foreach (int n in (int[])[1_000, 10_000, 100_000, 1_000_000])
{
    long steps = 0;
    for (int block = 1;
         block < n;
         block *= 2)
    {
        for (int j = 0; j < block; j++)
            steps++;
    }

    Console.WriteLine(
        $"{n,10:N0}{steps,12:N0}{(double)steps / n,11:F2}");
}
```

```text output
         n       steps  steps / n
     1,000       1,023       1.02
    10,000      16,383       1.64
   100,000     131,071       1.31
 1,000,000   1,048,575       1.05
```

If the count were Θ(*n* log *n*), the last column would climb by about 3.3 for every tenfold increase in *n* (log₂ 10 ≈ 3.3). It stays between 1 and 2. The same doubling sum is what makes appending to a `List<T>` cheap on average, which is the subject of [amortized analysis](/complexity/amortized-analysis/).
:::
::::
