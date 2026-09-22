---
title: "Big-O Notation: What It Measures and What It Hides"
description: "Count the steps in real C# loops, meet the formal definition of Big-O with its constants c and n₀, and measure where an O(n²) sort beats an O(n log n) one."
pillar: complexity
order: 1
author: markus
published: 2026-09-21
updated: 2026-09-21
level: beginner
tags: [big-o, asymptotic-analysis, time-complexity, sorting]
prerequisites: []
sources:
  - title: "big-O notation, Dictionary of Algorithms and Data Structures"
    url: "https://xlinux.nist.gov/dads/HTML/bigOnotation.html"
    publisher: "NIST"
    accessed: 2026-09-21
  - title: "o (little-o), Dictionary of Algorithms and Data Structures"
    url: "https://xlinux.nist.gov/dads/HTML/littleOnotation.html"
    publisher: "NIST"
    accessed: 2026-09-21
  - title: "Θ (theta), Dictionary of Algorithms and Data Structures"
    url: "https://xlinux.nist.gov/dads/HTML/theta.html"
    publisher: "NIST"
    accessed: 2026-09-18
  - title: "Ω (omega), Dictionary of Algorithms and Data Structures"
    url: "https://xlinux.nist.gov/dads/HTML/omegaCapital.html"
    publisher: "NIST"
    accessed: 2026-09-21
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
    accessed: 2026-09-21
  - title: "HashSet<T>.Add(T) Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.hashset-1.add"
    publisher: "Microsoft Learn"
    accessed: 2026-09-21
  - title: "File-based apps"
    url: "https://learn.microsoft.com/en-us/dotnet/core/sdk/file-based-apps"
    publisher: "Microsoft Learn"
    accessed: 2026-09-18
  - title: "Introduction to Algorithms, 4th ed., chapter 3 (Characterizing Running Times)"
    url: "https://mitpress.mit.edu/9780262046305/introduction-to-algorithms/"
    publisher: "MIT Press"
    accessed: 2026-09-18
  - title: "Big Omicron and Big Omega and Big Theta"
    url: "https://danluu.com/knuth-big-o.pdf"
    publisher: "Donald E. Knuth, ACM SIGACT News 8(2), 1976"
    accessed: 2026-09-21
  - title: "Common MSBuild Project Properties (Optimize)"
    url: "https://learn.microsoft.com/en-us/visualstudio/msbuild/common-msbuild-project-properties"
    publisher: "Microsoft Learn"
    accessed: 2026-09-21
draft: false
---

A race-timing app holds an array of lap times and has to answer two questions: which lap was fastest, and which two laps were closest to each other. Both are a few lines of C#. On 1,000 laps both feel instant. On 80,000 laps the first still does, and the second, written the obvious way, takes a couple of seconds on the machine used for this page, one comparison at a time. Big-O notation states how the number of steps an algorithm takes grows as its input grows, largely apart from the constants: it is how you see that difference coming from the code itself, before anyone has 80,000 laps to wait through. The way in is to count what each loop does.

## Count the steps before you time anything

The two programs below count the steps used to work out each of the opening questions, for arrays of 1,000 to 8,000 random lap times — one *step* every time a loop body runs — without yet printing either answer.

Finding the fastest lap needs one pass over the array:

```csharp run id=count-fastest
using System.Globalization;

CultureInfo.CurrentCulture =
    CultureInfo.InvariantCulture;

Console.WriteLine(
    $"{"n",6}{"fastest",10}");
foreach (int n in
    (int[])[1_000, 2_000, 4_000, 8_000])
{
    double[] laps = MakeLaps(n);
    long scanSteps = 0;
    double fastest = laps[0];
    for (int i = 1; i < n; i++)
    {
        scanSteps++;
        if (laps[i] < fastest)
            fastest = laps[i];
    }
    Console.WriteLine(
        $"{n,6:N0}{scanSteps,10:N0}");
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
     n   fastest
 1,000       999
 2,000     1,999
 4,000     3,999
 8,000     7,999
```

Every lap after the first is looked at exactly once, so the scan takes *n* − 1 steps.

Finding the closest pair compares each lap with every later one:

```csharp run id=count-pairs
using System.Globalization;

CultureInfo.CurrentCulture =
    CultureInfo.InvariantCulture;

Console.WriteLine(
    $"{"n",6}{"pairs",12}{"growth",7}");
long prev = 0;
foreach (int n in
    (int[])[1_000, 2_000, 4_000, 8_000])
{
    double[] laps = MakeLaps(n);
    long steps = 0;
    double smallestGap = double.MaxValue;
    for (int i = 0; i < n; i++)
    {
        for (int j = i + 1; j < n; j++)
        {
            steps++;
            double gap = Math.Abs(
                laps[i] - laps[j]);
            if (gap < smallestGap)
                smallestGap = gap;
        }
    }

    string growth = prev == 0
        ? ""
        : $"x{(double)steps / prev:F2}";
    Console.WriteLine(
        $"{n,6:N0}{steps,12:N0}{growth,7}");
    prev = steps;
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
     n       pairs growth
 1,000     499,500
 2,000   1,999,000  x4.00
 4,000   7,998,000  x4.00
 8,000  31,996,000  x4.00
```

Lap 0 is compared with *n* − 1 later laps, lap 1 with *n* − 2, and so on down to 1. That sum is

```text
(n-1) + (n-2) + ... + 1 = n(n-1)/2
                        = n²/2 - n/2
```

and 1,000 · 999 / 2 is the 499,500 in the first row. Neither count depends on the lap times themselves, only on how many there are, which makes this a convenient first example: there is no lucky or unlucky input to worry about.

Now read down the columns instead of across. Each time *n* doubles, the scan's count doubles and the pair count is multiplied by four. Those multipliers are the information Big-O keeps. The scan is O(*n*), "order *n*"; the pair search is O(*n*²).

Choosing what to count as a step is called choosing a *cost model*; Sedgewick and Wayne's [analysis chapter](https://algs4.cs.princeton.edu/14analysis/) uses array accesses for its running example, and comparisons are the usual choice for sorting. *n* is the *input size*, here the number of laps. A function from input size to step count, such as *n*²/2 − *n*/2, is an algorithm's [time complexity](/glossary/#time-complexity); the same idea applied to memory is [space complexity](/glossary/#space-complexity).

## The count predicts growth, not milliseconds

A step count is not a running time. But if each step takes roughly the same time, multiplying the steps by four multiplies the time by four, whatever that time is. The program below times the pair search (without the counter) on inputs that double. Its first line, [`#:property`](https://learn.microsoft.com/en-us/dotnet/core/sdk/file-based-apps) `Optimize=true`, is a build directive that sets the [`Optimize` MSBuild property](https://learn.microsoft.com/en-us/visualstudio/msbuild/common-msbuild-project-properties), documented as a boolean that "enables compiler optimizations" when true — the way a release build would. Every timing program on this page carries it; a plain debug build of the same loop runs several times slower, which a later section measures precisely.

```csharp run id=doubling
#:property Optimize=true
using System.Diagnostics;
using System.Globalization;

CultureInfo.CurrentCulture =
    CultureInfo.InvariantCulture;

// Warm-up for the JIT.
ClosestGap(MakeLaps(2_000));

Console.WriteLine(
    $"{"n",7}{"time",12}{"growth",9}");
double previousMs = 0;
int[] sizes =
[
    5_000, 10_000, 20_000,
    40_000, 80_000,
];
foreach (int n in sizes)
{
    double[] laps = MakeLaps(n);
    long start = Stopwatch.GetTimestamp();
    ClosestGap(laps);
    double ms = Stopwatch
        .GetElapsedTime(start)
        .TotalMilliseconds;

    string growth = previousMs == 0
        ? ""
        : $"x{ms / previousMs:F1}";
    Console.WriteLine(
        $"{n,7:N0}{ms,9:F0} ms{growth,9}");
    previousMs = ms;
}

static double ClosestGap(double[] laps)
{
    double smallestGap = double.MaxValue;
    for (int i = 0; i < laps.Length; i++)
    {
        for (int j = i + 1; j < laps.Length; j++)
        {
            double gap = Math.Abs(
                laps[i] - laps[j]);
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
 80,000[...] ms[...]x[...]
```

One run on this machine printed:

```text
      n        time   growth
  5,000        7 ms
 10,000       29 ms     x4.1
 20,000      121 ms     x4.2
 40,000      544 ms     x4.5
 80,000     2138 ms     x3.9
```

Three runs gave 7 to 11 ms for 5,000 laps and 2.14 to 2.26 seconds for 80,000; the smallest, fastest row is the noisiest one, since a few milliseconds of timer and JIT variation is a large share of 7 ms. From 20,000 laps up, every growth factor stayed close to four, typically between 3.9 and 4.5 but occasionally further off on a busy machine, near the four the step count predicts.

The measurements on this page come from .NET 10 (SDK 10.0.401, runtime 10.0.12) on Windows 11, on a desktop with an Intel Core i7-11700K; your digits will differ.

Split what was just measured into two parts. The milliseconds belong to this CPU, this runtime, this compiler setting and this way of writing the loop; a different machine, a debug build, or the same loop in another language gives another number. The factor of four belongs to the algorithm and travels with it, roughly, on any machine, until cache effects or timer noise intrude. Big-O notation is a way of writing down the second part while saying nothing about the first. That is its strength, and its blind spot is what [a later section](#when-the-dropped-constant-decides-the-winner) measures.

### The pair search does not have to be quadratic

The loop above compares every lap with every later one because it never reuses what one comparison tells it. Sort the laps first, and the two closest values are guaranteed to end up next to each other in the sorted order, so a single pass over neighboring pairs finds the same answer. `Array.Sort` is O(*n* log *n*) (cited again in [the growth-rate table](#the-growth-rates-you-will-meet-judged-by-doubling) below), the adjacent scan afterwards is O(*n*), and O(*n* log *n*) + O(*n*) is O(*n* log *n*): the same class as the sort that dominates it.

The program below checks that the sorted approach agrees with `ClosestGap` on the same laps, then times both at the two largest sizes from the table above.

```csharp run id=sorted-gap
#:property Optimize=true
using System.Diagnostics;
using System.Globalization;

CultureInfo.CurrentCulture =
    CultureInfo.InvariantCulture;

// Warm-up, and check the two functions agree.
double[] warm = MakeLaps(2_000);
if (ClosestGap(warm) != SortedClosestGap(warm))
    throw new InvalidOperationException(
        "Mismatch on warm-up.");

Console.WriteLine(
    $"{"n",7}{"quadratic",12}{"sorted",10}{"match",7}");
int[] sizes = [40_000, 80_000];
foreach (int n in sizes)
{
    double[] laps = MakeLaps(n);

    long start1 = Stopwatch.GetTimestamp();
    double slow = ClosestGap(laps);
    double slowMs = Stopwatch
        .GetElapsedTime(start1)
        .TotalMilliseconds;

    long start2 = Stopwatch.GetTimestamp();
    double fast = SortedClosestGap(laps);
    double fastMs = Stopwatch
        .GetElapsedTime(start2)
        .TotalMilliseconds;

    string match = slow == fast ? "yes" : "NO";
    Console.WriteLine(
        $"{n,7:N0}{slowMs,9:F0} ms{fastMs,7:F1} ms{match,7}");
}

static double ClosestGap(double[] laps)
{
    double smallestGap = double.MaxValue;
    for (int i = 0; i < laps.Length; i++)
    {
        for (int j = i + 1; j < laps.Length; j++)
        {
            double gap = Math.Abs(
                laps[i] - laps[j]);
            if (gap < smallestGap)
                smallestGap = gap;
        }
    }
    return smallestGap;
}

static double SortedClosestGap(double[] laps)
{
    double[] sorted = (double[])laps.Clone();
    Array.Sort(sorted);
    double smallestGap = double.MaxValue;
    for (int i = 1; i < sorted.Length; i++)
    {
        double gap = sorted[i] - sorted[i - 1];
        if (gap < smallestGap)
            smallestGap = gap;
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
      n   quadratic    sorted  match
 40,000[...] ms[...] ms[...]
 80,000[...] ms[...] ms[...]
```

One run on this machine printed:

```text
      n   quadratic    sorted  match
 40,000      589 ms    9.7 ms    yes
 80,000     2158 ms    8.1 ms    yes
```

Sorting first turns the opening hook's couple of seconds into single-digit milliseconds — a couple of hundred times faster at 80,000 laps — and the `match` column confirms the two functions found the same smallest gap on every run. That is the payoff Big-O reasoning promises: the shape of the code, not a stopwatch, told you which version to write before either was measured.

## The definition, with its two constants

So far "O(*n*²)" has meant "quadruples when *n* doubles". The real definition is more careful, and short. For two non-negative functions *f* and *g* of the input size:

> *f*(*n*) is O(*g*(*n*)) if there are positive constants *c* and *n*₀ such that 0 ≤ *f*(*n*) ≤ *c* · *g*(*n*) for every *n* ≥ *n*₀.

This is the definition in CLRS ([*Introduction to Algorithms*](https://mitpress.mit.edu/9780262046305/introduction-to-algorithms/), chapter 3) and in NIST's [Dictionary of Algorithms and Data Structures](https://xlinux.nist.gov/dads/HTML/bigOnotation.html), which calls the threshold *k* instead of *n*₀ and states the same 0 ≤ *f*(*n*) clause. In words: beyond some input size, *f* never exceeds a fixed multiple of *g*. Every step count on this page is a count of something, so it is never negative; that is all the non-negativity assumption costs a reader here. To prove a Big-O claim you produce one pair (*c*, *n*₀) that works. The pair is called a *witness*.

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
<text x="20" y="290">Left of n₀: f(20) = 100 > 80, bound fails.</text>
<text x="20" y="306">From n₀ on: f(n) ≤ 4n holds (shaded).</text>
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

**For large *n* the leading term is nearly everything.** In the last row of the first table above, the −*n*/2 term is worth 4,000 steps out of 31,996,000, about one part in eight thousand.

All three arguments are sound, and all three are arguments about *large n*. The definition says "for every *n* ≥ *n*₀" and says nothing at all about inputs below the threshold. There, the discarded constants are the whole story.

## When the dropped constant decides the winner

Two classic sorts make the point. Both costs here are from Sedgewick and Wayne, measured in comparisons:

- **Insertion sort** grows a sorted prefix by sliding each new item leftwards into place. On a randomly ordered array of distinct keys it uses about *n*²/4 comparisons on average; the worst case (reverse order) is about *n*²/2, and the best case (already sorted) is *n* − 1 ([section 2.1](https://algs4.cs.princeton.edu/21elementary/)). Worst case Θ(*n*²), no extra memory.
- **Merge sort** sorts each half [recursively](/glossary/#recursion) and merges the two. Top-down merge sort uses between ½ *n* log₂ *n* and *n* log₂ *n* comparisons on any input ([section 2.2](https://algs4.cs.princeton.edu/22mergesort/)): Θ(*n* log *n*) in every case, at the price of a second array of *n* items to merge through.

For large inputs merge sort wins without a contest. The program in the collapsed block below asks what happens for small ones. For each size it builds many random arrays (enough to total two million values), sorts copies of all of them with each algorithm, checks the results, and reports the best of five rounds as time per array.

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
    $"{"n",5}{"insertion",12}" +
    $"{"merge",12}  faster");
int[] sizes =
[
    8, 16, 32, 64, 128,
    256, 512, 1024, 2048,
];
foreach (int n in sizes)
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
        insertionNs = Math.Min(
            insertionNs,
            TimePerArray(inputs, InsertionSort));
        mergeNs = Math.Min(
            mergeNs,
            TimePerArray(inputs, MergeSort));
    }

    string faster = insertionNs < mergeNs
        ? "insertion" : "merge";
    Console.WriteLine(
        $"{n,5}{insertionNs,9:N0} ns" +
        $"{mergeNs,9:N0} ns  {faster}");
}

static double TimePerArray(
    int[][] inputs, Action<int[]> sort)
{
    // Sort copies; every round starts unsorted.
    var copies = new int[inputs.Length][];
    for (int a = 0; a < inputs.Length; a++)
        copies[a] = (int[])inputs[a].Clone();

    long start = Stopwatch.GetTimestamp();
    foreach (int[] copy in copies) sort(copy);
    TimeSpan took =
        Stopwatch.GetElapsedTime(start);

    foreach (int[] copy in copies)
        for (int i = 1; i < copy.Length; i++)
            if (copy[i - 1] > copy[i])
                throw new InvalidOperationException(
                    "Not sorted.");
    return took.TotalNanoseconds
        / inputs.Length;
}

static void InsertionSort(int[] items)
{
    for (int i = 1; i < items.Length; i++)
    {
        int value = items[i];
        int j = i - 1;
        while (j >= 0
            && items[j] > value)
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

    // Merge the two sorted halves.
    Array.Copy(items, lo, buffer, lo, hi - lo);
    int left = lo, right = mid;
    for (int k = lo; k < hi; k++)
    {
        bool takeLeft = right >= hi ||
            (left < mid &&
             buffer[left] <= buffer[right]);
        items[k] = takeLeft
            ? buffer[left++]
            : buffer[right++];
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

The full program includes the harness that generates and times the arrays; open it above if you want the details. What matters for the rest of this section is just the two sorts inside it, and what each one costs.

The digits vary from run to run. One run on this machine printed:

```text
    n   insertion       merge  faster
    8       53 ns      205 ns  insertion
   16      155 ns      413 ns  insertion
   32      351 ns    1,013 ns  insertion
   64      985 ns    3,012 ns  insertion
  128    3,029 ns    5,195 ns  insertion
  256    9,911 ns   10,470 ns  insertion
  512   35,594 ns   23,078 ns  merge
 1024  125,171 ns   50,405 ns  merge
 2048  481,771 ns  110,491 ns  merge
```

At 8 items the O(*n*²) algorithm is almost four times faster than the O(*n* log *n*) one. It keeps its lead until the two are within 6 percent of each other at 256, and loses from 512 on; by 2,048 it is more than four times slower, and the gap widens from there just as the notation promises. Look at how each column grows near the bottom of the table: insertion sort's time is multiplied by roughly 3.5 to 3.9 per doubling (heading for 4), merge sort's by about 2.2.

The reason is the constants. Insertion sort's inner loop is one comparison and one assignment on a single array, all the way through, with no method calls. Merge sort pays more before it does any useful work: `MergeSort` allocates a fresh *n*-element buffer once per call, and `Split` then recurses all the way down to arrays of length 1 — at *n* = 8 that is 7 recursive calls and 7 merge steps to sort 8 numbers, each with call overhead insertion sort never pays. Every one of merge sort's steps costs more, and at small sizes it does not take enough fewer of them to make up for that. The crossover point itself is a property of this implementation (no cutoff into insertion sort, one buffer allocation per call, `int` elements), this range of sizes, and this machine; a different element type, a cache-friendlier merge, or a faster processor moves it.

Now take the collapsed `id=crossover` program above, delete its one build directive (`#:property Optimize=true`), and run it again. This specific comparison is an informal aside: `tools/run-code.mjs` does not exercise it, because pasting the whole hundred-line harness a second time just to remove one line would only pad the page rather than teach anything new. Reproduce it yourself in under a minute — delete the line, save, rerun. The code and the Big-O class are unchanged; only the compiler switch is gone. On this machine it printed:

```text
    n   insertion       merge  faster
    8      120 ns      338 ns  insertion
   16      343 ns      742 ns  insertion
   32      975 ns    1,788 ns  insertion
   64    3,037 ns    4,093 ns  insertion
  128   10,408 ns    9,368 ns  merge
  256   38,011 ns   20,476 ns  merge
  512  146,989 ns   44,457 ns  merge
 1024  576,459 ns  100,846 ns  merge
```

Two more runs stayed within a few percent of these numbers at every row, and the crossover stayed between 64 and 128 each time. (2,048 is left out only because its unformatted digit count collides with the column beside it; unoptimized, that row printed 2,396,718 ns for insertion sort and 217,457 ns for merge sort, still an eleven-fold gap.) Insertion sort is still ahead at 64 and merge sort wins from 128 on: the crossover point moved from between 256 and 512 down to between 64 and 128, a shift of about a factor of four, purely from a compiler switch. Both algorithms are exactly the same Big-O as before. That is the precise sense in which Big-O "ignores constants": it is silent about them, and they are free to matter.

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
for (int i = 0; i < Length; i++)
    input[i] = random.Next();

Console.WriteLine(
    $"{"cutoff",6}{"time",10}{"vs pure",9}");
double pureMs = 0;
int[] cutoffs = [1, 8, 16, 32, 64, 256];
foreach (int cutoff in cutoffs)
{
    double best = double.MaxValue;
    for (int round = 0; round < 5; round++)
    {
        var copy = (int[])input.Clone();
        long start = Stopwatch.GetTimestamp();
        HybridSort(copy, cutoff);
        best = Math.Min(
            best,
            Stopwatch.GetElapsedTime(start)
                .TotalMilliseconds);
        for (int i = 1; i < copy.Length; i++)
            if (copy[i - 1] > copy[i])
                throw new InvalidOperationException(
                    "Not sorted.");
    }

    if (cutoff == 1) pureMs = best;
    Console.WriteLine(
        $"{cutoff,6}{best,7:F0} ms" +
        $"{best / pureMs,8:P0}");
}

static void HybridSort(int[] items, int cutoff) =>
    Split(items, new int[items.Length],
        0, items.Length, cutoff);

static void Split(
    int[] items, int[] buffer,
    int lo, int hi, int cutoff)
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
        bool takeLeft = right >= hi ||
            (left < mid &&
             buffer[left] <= buffer[right]);
        items[k] = takeLeft
            ? buffer[left++]
            : buffer[right++];
    }
}

static void InsertionSort(int[] items, int lo, int hi)
{
    for (int i = lo + 1; i < hi; i++)
    {
        int value = items[i];
        int j = i - 1;
        while (j >= lo
            && items[j] > value)
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

One run on this machine printed:

```text
cutoff      time  vs pure
     1     92 ms   100 %
     8     79 ms    86 %
    16     77 ms    84 %
    32     77 ms    84 %
    64     77 ms    84 %
   256     95 ms   103 %
```

Three runs gave 88 to 98 ms for pure merge sort, about 73 to 88 ms (80 to 91 percent) for cutoffs from 8 to 64, and 95 to 102 ms (103 to 108 percent) for a cutoff of 256, slightly *worse* than not switching at all. Sedgewick and Wayne [report](https://algs4.cs.princeton.edu/22mergesort/) a 10 to 15 percent gain for a typical implementation, the same order as this one.

The best cutoff is well below 256 because the earlier table asked the wrong question for this purpose. It raced insertion sort against *pure* merge sort on 256 items. Inside the hybrid, the alternative to insertion-sorting a block of 256 is to split it into blocks of 32 that are insertion-sorted and then merged, and that is faster than either pure algorithm. The hybrid is still Θ(*n* log *n*) in the worst case: the insertion-sorted blocks have a fixed maximum size, so they add at most a constant times *n*. The cutoff tunes the constant, which is all a cutoff can do.
:::
::::

## Three more things Big-O leaves out

Constants are the biggest thing the notation hides, but three more are worth a sentence each.

- **Which input.** Big-O bounds a function, and an algorithm has several: its worst-case step count, its best case, its average over some distribution of inputs. "Insertion sort is O(*n*²)" is about the worst case; on already-sorted input the code above takes only *n* − 1 comparisons, one pass, the same shape as the fastest-lap scan at the top of this page. When no case is named, assume the worst case is meant, and check.
- **What a step really costs.** The cost model used on this page charges the same for every array access, comparison and assignment. Hardware does not: an access that misses cache can cost tens of times an access that hits it, and Sedgewick and Wayne [warn](https://algs4.cs.princeton.edu/14analysis/) that their own analysis leaves out caching, garbage collection and just-in-time compilation for the same reason.
- **How big *n* gets.** If the input is the seven days of the week, every algorithm on this page is fast enough, and the clearest code is the right code; the growth-rate table two sections down only starts to matter once *n* is in the thousands.

## O, Ω and Θ: upper bound, lower bound, both

Big-O is an upper bound, and upper bounds are allowed to be loose. Merge sort is O(*n* log *n*). It is also, truthfully, O(*n*²) and O(*n*³), in the way that a person who is 30 is also "under 90". Two companion notations close the gap. The definitions below are again those of CLRS chapter 3 and the NIST dictionary ([Ω](https://xlinux.nist.gov/dads/HTML/omegaCapital.html), [Θ](https://xlinux.nist.gov/dads/HTML/theta.html)).

- ***f*(*n*) is Ω(*g*(*n*))**, "big omega", if there are positive constants *c* and *n*₀ with *f*(*n*) ≥ *c* · *g*(*n*) for every *n* ≥ *n*₀. A lower bound: *f* grows at least as fast as *g*.
- ***f*(*n*) is Θ(*g*(*n*))**, "big theta", if it is both O(*g*(*n*)) and Ω(*g*(*n*)): it can be sandwiched between two multiples of *g*. A tight bound: *f* grows exactly as fast as *g*.

The pair count is Θ(*n*²). The upper half was proved above with *c* = ½. For the lower half, *n*/2 ≤ *n*²/4 once *n* ≥ 2, so *n*²/2 − *n*/2 ≥ ¼ · *n*² from *n*₀ = 2. Sandwiched between ¼*n*² and ½*n*², the count cannot be described by any other power of *n*.

The NIST entry notes that Big-O is often misused to mean "equal to" rather than "less than": a speaker who says "this loop is O(*n*²)" frequently means Θ(*n*²). In conversation that rarely causes trouble. When a statement has to be exact, for instance "no comparison sort can beat this" or "this loop really is quadratic, not just at most quadratic", Ω and Θ are the tools. A third notation, [*o*, "little-o"](https://xlinux.nist.gov/dads/HTML/littleOnotation.html), tightens O further: *f* is o(*g*(*n*)) if for *every* positive *c*, not just some, *f*(*n*) < *c* · *g*(*n*) beyond some threshold — *f* grows strictly slower than *g*, not just no faster. And Ω itself has had two conventions. Hardy and Littlewood introduced Ω in 1914 to mean a function whose absolute value exceeds a constant multiple of *g*(*n*) for infinitely many *n* — weaker than O's mirror image, since it says nothing about the *n* in between. [Knuth's 1976 note on the notation](https://danluu.com/knuth-big-o.pdf) changed this to the symmetric definition used here, requiring the bound for *every* sufficiently large *n*, because "for all the applications I have seen so far in computer science, a stronger requirement... is much more appropriate." This page uses Knuth's convention, now the standard one in computer science, throughout.

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
3. **Does not follow.** Big-O says nothing about any particular *n*, and nothing about constants. The sorting table above showed exactly this kind of reversal: at *n* = 8, insertion sort — O(*n*²), the larger class — beat merge sort — O(*n* log *n*), the smaller one. It does not even follow for large *n*, because O(*n*²) is only an upper bound: B might in fact be linear.
4. **True.** Upper: 100*n* + 5 ≤ 105*n* for *n* ≥ 1. Lower: 100*n* + 5 ≥ 100*n* always.
5. **True.** 2<sup>*n*+1</sup> = 2 · 2ⁿ, so *c* = 2 works. A constant added to an exponent is a constant factor.
6. **False.** 2<sup>2*n*</sup> = 2ⁿ · 2ⁿ. The ratio to 2ⁿ is 2ⁿ itself, which outgrows every constant *c*. A constant *factor* in an exponent is not a constant factor of the function.
:::
::::

## The growth rates you will meet, judged by doubling

A handful of functions cover nearly every bound you will read. The most practical way to tell them apart is the test from the first section: what happens to the work when *n* doubles? The table below answers that for the pure function *g*(*n*) itself, not for every function that happens to be O(*g*(*n*)) — a function that is O(log *n*) with a huge constant can still be slow at every size you will ever run. (The O(log *n*) row assumes base 2, the natural base for something that halves each step, such as binary search; doubling *n* adds exactly one step only at that base, though the earlier point about dropping the base still holds for the O(log *n*) *class* itself.)

| Bound | Doubling *n* | Example |
|---|---|---|
| O(1) | unchanged | hash lookup |
| O(log *n*) | +1 step | binary search |
| O(*n*) | doubles | linear scan |
| O(*n* log *n*) | just over 2x | comparison sort |
| O(*n*²) | quadruples | all pairs |
| O(*n*³) | grows 8-fold | all triples |
| O(2ⁿ) | is squared | all subsets |
| O(*n*!) | grows fastest | all orderings |

(The last row: going from *n*! to (2*n*)! multiplies by (*n*+1)(*n*+2)···(2*n*), a product of *n* terms each bigger than *n*, so the multiplier itself exceeds *n*ⁿ and grows without bound as *n* grows — a stronger and more precise statement than "grows faster still".)

Each row has a familiar face. In .NET, [`HashSet<T>.Contains`](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.hashset-1.contains) is documented as O(1), [`List<T>.BinarySearch`](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.list-1.binarysearch) as O(log *n*), [`List<T>.Contains`](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.list-1.contains) as O(*n*) and [`Array.Sort`](https://learn.microsoft.com/en-us/dotnet/api/system.array.sort) as O(*n* log *n*). Comparing every pair of *n* items is O(*n*²) and every triple O(*n*³); trying every subset of *n* items is O(2ⁿ), and every ordering of them O(*n*!).

Two of the documented bounds carry conditions that the one-line form hides: binary search requires a list that is already sorted, and the O(1) for a [hash table](/glossary/#hash-table) lookup depends on the hash function spreading the items evenly across the table.

To get a feel for the distances between the rows, turn them into a budget. Assume, generously, that a step takes one nanosecond, so that one second buys a billion steps. The program finds the largest *n* each growth rate can handle in that second. Nothing here is measured; it is arithmetic on the assumption.

```csharp run id=budget
using System.Globalization;

CultureInfo.CurrentCulture =
    CultureInfo.InvariantCulture;

// Assume 1 step = 1 ns,
// so 1 second buys 1e9 steps.
const double Budget = 1e9;

(string Name, Func<double, double> Steps)[]
    classes =
    [
        ("n",       n => n),
        ("n log n", n => n * Math.Log2(n)),
        ("n^2",     n => n * n),
        ("n^3",     n => n * n * n),
        ("2^n",     n => Math.Pow(2, n)),
        ("n!",      Factorial),
    ];

Console.WriteLine(
    $"{"steps",-9}{"largest n in 1 s",18}");
foreach (var (name, steps) in classes)
{
    // Steps only grows, so find the last n
    // that fits: double the limit, then bisect.
    long fits = 1, tooBig = 2;
    while (steps(tooBig) <= Budget)
        (fits, tooBig) =
            (tooBig, tooBig * 2);
    while (tooBig - fits > 1)
    {
        long mid =
            fits + (tooBig - fits) / 2;
        if (steps(mid) <= Budget)
            fits = mid;
        else
            tooBig = mid;
    }
    Console.WriteLine(
        $"{name,-9}{fits,18:N0}");
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

The top two rows are separated by a factor of 25: for practical purposes *n* log *n* is "linear with a small tax", which is why sorting first is so often an acceptable move — the same trade the sorted closest-pair search above relies on. Then the cliff: a quadratic algorithm gets through 31,622 items in the time a linear one handles a billion. The last two rows are a different kind of thing. A machine a thousand times faster raises the quadratic limit to about a million; it raises the 2ⁿ limit from 29 to 39, because each extra item doubles the work and 2¹⁰ is about a thousand. O(log *n*) and O(1) are missing from the table because no input you could store would use up the budget.

<figure class="diagram">
<svg viewBox="0 0 360 260" role="img" aria-labelledby="growth-linear-title growth-linear-desc">
<title id="growth-linear-title">Growth rates on linear axes: two curves dominate almost immediately</title>
<desc id="growth-linear-desc">A chart of steps against n from 0 to 32, steps from 0 to 1,024. 2 to the n leaves the chart before n = 10. n squared curves up toward the top right corner. n log n, n and log n stay squashed along the bottom, nearly indistinguishable at this scale.</desc>
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
<text x="40" y="214" text-anchor="end" class="d-mono">0</text>
<text x="40" y="129" text-anchor="end" class="d-mono">512</text>
<text x="40" y="44" text-anchor="end" class="d-mono">1024</text>
<text x="44" y="226" text-anchor="middle" class="d-mono">0</text>
<text x="118" y="226" text-anchor="middle" class="d-mono">8</text>
<text x="192" y="226" text-anchor="middle" class="d-mono">16</text>
<text x="266" y="226" text-anchor="middle" class="d-mono">24</text>
<text x="340" y="226" text-anchor="middle" class="d-mono">32</text>
<text x="20" y="246" class="d-muted">n and log n stay flat near the axis.</text>
</svg>
<figcaption>Figure 2a. Growth rates on linear axes, <em>n</em> up to 32. Only O(<em>n</em>²) and O(2ⁿ) are visible as curves at this scale; every slower-growing rate sits nearly flat along the bottom.</figcaption>
</figure>

<figure class="diagram">
<svg viewBox="0 0 360 320" role="img" aria-labelledby="growth-log-title growth-log-desc">
<title id="growth-log-title">Growth rates on logarithmic axes: every power of n becomes a straight line</title>
<desc id="growth-log-desc">A chart of steps against n from 1 to one billion, steps from 1 to ten to the twelfth, both on logarithmic axes. n, n squared and n cubed are straight lines of increasing slope. n log n runs just above n. log n is almost flat. 2 to the n bends upward almost vertically. A dashed horizontal line at one billion steps crosses the curves at n = 29, 1,000, 31,622, about 40 million and one billion, matching the budget table above.</desc>
<text x="20" y="14" class="d-bold">Log axes: n up to 10⁹</text>
<path d="M44 30 V270 H340" class="d-line"/>
<path d="M44 90 H340" class="d-line d-dashed"/>
<path d="M53.9 270 L63.7 264 L76.9 259.6 L93.3 256.1 L109.8 253.6 L142.7 250 L175.6 247.5 L208.4 245.6 L241.3 244 L274.2 242.7 L307.1 241.5 L340 240.5" class="d-good" style="stroke-width:2"/>
<path d="M44 270 L340 90" class="d-good" style="stroke-width:2"/>
<path d="M53.9 264 L63.7 252 L76.9 239.6 L93.3 226.1 L109.8 213.6 L142.7 190 L175.6 167.5 L208.4 145.6 L241.3 124 L274.2 102.7 L307.1 81.5 L340 60.5" class="d-good" style="stroke-width:2"/>
<path d="M44 270 L241.3 30" class="d-accent" style="stroke-width:2.5"/>
<path d="M44 270 L175.6 30" class="d-accent" style="stroke-width:2.5"/>
<path d="M44 264 L53.9 258 L63.7 246 L70.3 232 L76.9 209.8 L80.2 194.2 L83.5 174.6 L86.8 149.9 L90 118.8 L93.3 79.6 L95 56.4 L96.6 30" class="d-bad" style="stroke-width:2.5"/>
<circle cx="92.1" cy="90" r="4" class="d-fill-bad"/>
<circle cx="142.7" cy="90" r="4" class="d-fill-accent"/>
<circle cx="192" cy="90" r="4" class="d-fill-accent"/>
<circle cx="293.9" cy="90" r="4" class="d-fill-good"/>
<circle cx="340" cy="90" r="4" class="d-fill-good"/>
<text x="104" y="46" class="d-text-bad d-bold">2ⁿ</text>
<text x="183" y="46" class="d-text-accent d-bold">n³</text>
<text x="249" y="46" class="d-text-accent d-bold">n²</text>
<text x="330" y="54" text-anchor="end" class="d-text-good d-small">n log n</text>
<text x="336" y="116" text-anchor="end" class="d-text-good d-small">n</text>
<text x="336" y="260" text-anchor="end" class="d-text-good d-small">log n</text>
<text x="40" y="274" text-anchor="end" class="d-mono">1</text>
<text x="40" y="214" text-anchor="end">10³</text>
<text x="40" y="154" text-anchor="end">10⁶</text>
<text x="40" y="94" text-anchor="end" class="d-bold">10⁹</text>
<text x="40" y="34" text-anchor="end">10¹²</text>
<text x="44" y="286" text-anchor="middle" class="d-mono">1</text>
<text x="142.7" y="286" text-anchor="middle">10³</text>
<text x="241.3" y="286" text-anchor="middle">10⁶</text>
<text x="336" y="286" text-anchor="middle">10⁹</text>
<text x="20" y="306" class="d-muted">Dashed: 10⁹ steps. Dots: table limits.</text>
</svg>
<figcaption>Figure 2b. The same growth rates on log-log axes, <em>n</em> up to 10⁹. Every power of <em>n</em> is now a straight line whose slope is its exponent; 2ⁿ still bends upward and leaves the chart before <em>n</em> = 40. The dots where curves cross the dashed line are the limits the budget program printed above.</figcaption>
</figure>

The log-log picture in Figure 2b is also a measuring tool. Plot running time against *n* on log-log axes and read the slope: about 1 means linear, about 2 quadratic. The doubling experiment near the top of this page is the same test in numbers: a growth factor of 4 per doubling is a slope of log₂ 4 = 2.

## Reading a bound off C# code

Working out bounds for nested loops and recursive methods is a subject in its own right. For everyday code, a few rules go a long way.

1. **Statements in sequence add, and the largest term wins.** A sort followed by a single pass is O(*n* log *n*) + O(*n*) = O(*n* log *n*).
2. **Nested loops multiply**, if the inner loop's trip count does not depend on the outer variable. If it does, add up the trips as the first section did: the inner loop there shrinks every time round, yet the total is still Θ(*n*²).
3. **A loop variable that is multiplied or divided by a constant** each time round runs about log *n* times. Doubling from 1 reaches *n* after log₂ *n* steps.
4. **Two inputs get two variables.** Comparing every item of one list with every item of another is O(*n* · *m*). Writing O(*n*²) quietly assumes the lists are the same size.
5. **A method call costs what the method costs.** The loop that decides the bound may not be on the screen at all.

The next program checks an array of IDs for a repeat in two ways. Both versions are a single visible loop. One remembers the IDs it has seen in a `List<int>`, the other in a `HashSet<int>`. The IDs are all distinct, so neither can stop early.

```csharp run id=hidden
#:property Optimize=true
using System.Diagnostics;
using System.Globalization;

CultureInfo.CurrentCulture =
    CultureInfo.InvariantCulture;

// Warm-up at full size, so the JIT has
// finished optimizing both methods first.
HasRepeatList(MakeIds(200_000));
HasRepeatSet(MakeIds(200_000));

Console.WriteLine(
    $"{"n",8}{"List",12}{"HashSet",12}");
int[] sizes = [25_000, 50_000, 100_000, 200_000];
foreach (int n in sizes)
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

// Distinct ids in shuffled order: the worst
// case, since neither method stops early.
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
        throw new InvalidOperationException(
            "Ids are distinct.");
    return Stopwatch
        .GetElapsedTime(start)
        .TotalMilliseconds;
}
```

```text output
       n        List     HashSet
  25,000[...] ms[...] ms
  50,000[...] ms[...] ms
 100,000[...] ms[...] ms
 200,000[...] ms[...] ms
```

One run on this machine printed:

```text
       n        List     HashSet
  25,000     12.4 ms      0.5 ms
  50,000     50.3 ms      1.0 ms
 100,000    279.5 ms      3.3 ms
 200,000   1028.5 ms      3.4 ms
```

Two runs on the machine used here put the `List` column at about 12 to 14, 50 to 68, 210 to 280 and 995 to 1,030 ms across the four sizes: growth factors between about 3.1 and 5.6 per doubling. The `HashSet` column stayed under a few milliseconds throughout (0.4 to 3.4 ms), roughly doubling on average, though at these durations timer noise is a large share of the reading.

[`List<T>.Contains`](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.list-1.contains) is documented as a linear search, O(*n*) in the list's `Count`. Called once per ID on a list that grows from 0 to *n* − 1 entries, it examines 0 + 1 + … + (*n* − 1) entries in total: the same *n*(*n* − 1)/2 as the lap pairs, inside what looks like a single loop. The model predicts a factor of four; the measured factor is noisier than the pair-search timings, because the absolute times here are smaller and more exposed to scheduling jitter. The `HashSet` version calls [`Add`](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.hashset-1.add), documented as O(1) when `Count` is below the set's capacity and O(*n*) when the set must be resized. Averaged over a run that resizes only a handful of times, that is expected O(1) per call, amortized over the resizes, hence O(*n*) expected in total — expected because it also assumes the hash function spreads the IDs evenly across buckets; a hash that collided on every ID would degrade every `Add` and `Contains` toward O(*n*). At 200,000 IDs it was 240 to 300 times faster than the list in these runs.

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

Console.WriteLine(
    $"{"n",10}{"steps",12}{"steps/n",9}");
int[] sizes = [1_000, 10_000, 100_000, 1_000_000];
foreach (int n in sizes)
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
        $"{n,10:N0}{steps,12:N0}" +
        $"{(double)steps / n,9:F2}");
}
```

```text output
         n       steps  steps/n
     1,000       1,023     1.02
    10,000      16,383     1.64
   100,000     131,071     1.31
 1,000,000   1,048,575     1.05
```

If the count were Θ(*n* log *n*), the last column would climb by about 3.3 for every tenfold increase in *n* (log₂ 10 ≈ 3.3). It stays between 1 and 2. The same doubling sum is what makes appending to a `List<T>` cheap on average, which is the subject of [amortized analysis](/complexity/amortized-analysis/).
:::
::::

The nested-loop bound above is the last stop on the counting side of this page. Two threads are left open on purpose: nothing here proves that merge sort really is Θ(*n* log *n*) — that comes from solving the recursion, the subject of recurrences and the Master theorem, one level up from the rule-of-thumb list above — and nothing here compares insertion sort and merge sort against the rest of the sorting toolbox, or says which one `Array.Sort` actually runs for a given input shape. Both build directly on the counting and witness techniques used throughout this page, and on the same measure-first habit as the sorted closest-pair search that answered the opening hook.
