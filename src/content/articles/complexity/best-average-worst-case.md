---
title: "Best, Average and Worst Case: Quicksort as a Case Study"
description: "A first-element-pivot quicksort goes quadratic on sorted input; define best, average and worst case precisely, then fix it with a random pivot."
pillar: complexity
order: 5
author: markus
published: 2026-09-22
updated: 2026-09-22
level: intermediate
tags: [big-o, sorting, quicksort, randomized-algorithms, hash-table]
prerequisites: ["complexity/big-o-notation"]
sources:
  - title: "Introduction to Algorithms, 4th ed., chapter 7 (Quicksort)"
    url: "https://mitpress.mit.edu/9780262046305/introduction-to-algorithms/"
    publisher: "MIT Press"
    accessed: 2026-09-22
  - title: "Algorithms, 4th ed., section 2.3: Quicksort"
    url: "https://algs4.cs.princeton.edu/23quicksort/"
    publisher: "Sedgewick and Wayne, Princeton University"
    accessed: 2026-09-22
  - title: "Denial of Service via Algorithmic Complexity Attacks"
    url: "https://www.usenix.org/conference/12th-usenix-security-symposium/denial-service-algorithmic-complexity-attacks"
    publisher: "Scott A. Crosby and Dan S. Wallach, 12th USENIX Security Symposium, 2003"
    accessed: 2026-09-22
  - title: "Microsoft Security Advisory 2659883: Vulnerability in ASP.NET Could Allow Denial of Service"
    url: "https://learn.microsoft.com/en-us/security-updates/securityadvisories/2011/2659883"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "String.GetHashCode Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.string.gethashcode"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "StackOverflowException Class"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.stackoverflowexception"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Marvin.cs (System.Private.CoreLib), dotnet/runtime main branch"
    url: "https://github.com/dotnet/runtime/blob/main/src/libraries/System.Private.CoreLib/src/System/Marvin.cs"
    publisher: "GitHub, dotnet/runtime"
    accessed: 2026-09-22
  - title: "String.Comparison.cs (System.Private.CoreLib), dotnet/runtime main branch"
    url: "https://github.com/dotnet/runtime/blob/main/src/libraries/System.Private.CoreLib/src/System/String.Comparison.cs"
    publisher: "GitHub, dotnet/runtime"
    accessed: 2026-09-22
draft: true
---

Quicksort's first-element pivot is the version most courses teach first: partition around `items[lo]`, recurse on both halves, done in a dozen lines. It also has a specific, reproducible way of falling over, and the fastest way to understand best, average and worst case is to watch it happen.

## The pivot that always loses

The program below sorts arrays of growing size twice: once shuffled into random order, once already sorted ascending. It counts comparisons rather than timing, because a comparison count is exact and reproducible on any machine, unlike a millisecond figure.

```csharp run id=quadratic-quicksort
using System.Globalization;

CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;

Console.WriteLine($"{"n",7}{"random",14}{"sorted",14}");
int[] sizes = [500, 1_000, 2_000, 4_000, 8_000];
foreach (int n in sizes)
{
    int[] sorted = Enumerable.Range(1, n).ToArray();
    int[] random = Shuffle(sorted, new Random(7));

    long randomCompares = CountCompares(random);
    long sortedCompares = CountCompares(sorted);

    Console.WriteLine(
        $"{n,7:N0}{randomCompares,14:N0}{sortedCompares,14:N0}");
}

static long CountCompares(int[] source)
{
    int[] items = (int[])source.Clone();
    long compares = 0;
    Quicksort(items, 0, items.Length - 1, ref compares);
    return compares;
}

static void Quicksort(int[] items, int lo, int hi, ref long compares)
{
    if (lo >= hi) return;
    int pivotIndex = Partition(items, lo, hi, ref compares);
    Quicksort(items, lo, pivotIndex - 1, ref compares);
    Quicksort(items, pivotIndex + 1, hi, ref compares);
}

static int Partition(int[] items, int lo, int hi, ref long compares)
{
    int pivot = items[lo];
    int i = lo;
    for (int j = lo + 1; j <= hi; j++)
    {
        compares++;
        if (items[j] < pivot)
        {
            i++;
            (items[i], items[j]) = (items[j], items[i]);
        }
    }
    (items[lo], items[i]) = (items[i], items[lo]);
    return i;
}

static int[] Shuffle(int[] source, Random random)
{
    int[] items = (int[])source.Clone();
    for (int i = items.Length - 1; i > 0; i--)
    {
        int j = random.Next(i + 1);
        (items[i], items[j]) = (items[j], items[i]);
    }
    return items;
}
```

```text output
      n        random        sorted
    500         4,584       124,750
  1,000        10,535       499,500
  2,000        24,172     1,999,000
  4,000        52,775     7,998,000
  8,000       126,318    31,996,000
```

These figures are from .NET 10 (SDK 10.0.401, runtime 10.0.12) on Windows 11, x64; only the shape — sorted growing far faster than random — is guaranteed, not the exact digits. The random column roughly doubles each time *n* doubles, then a bit more: consistent with the O(*n* log *n*) this page will derive below. The sorted column quadruples almost exactly: 31,996,000 is sixteen times 1,999,000. It also matches a closed form. On sorted input the pivot `items[lo]` is always the smallest remaining value, so nothing is ever less than it: `Partition` moves nothing, and the recursive call on the left half gets zero elements every time. Comparisons follow

```text
T(n) = T(n-1) + (n-1),  T(0) = 0
     = (n-1) + (n-2) + ... + 0
     = n(n-1)/2
```

500 · 499 / 2 is 124,750, matching the first row exactly, and 8,000 · 7,999 / 2 is 31,996,000. Reversing the array gives the same total: the first element is then the largest, so again nothing is less than it and every partition is still `0 : n-1`. Either way, the pivot rule turns the input's own order against the algorithm.

## When it does not just get slow

A `0 : n-1` split every time means the recursion is `n` calls deep, not log₂ *n*. The program below drops the comparison counter and instead records the deepest a run's own recursion goes, using the same partition scheme.

```csharp run id=recursion-depth
using System.Globalization;

CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;

Console.WriteLine($"{"n",7}{"random depth",14}{"sorted depth",14}");
int[] sizes = [500, 1_000, 2_000, 4_000, 8_000];
foreach (int n in sizes)
{
    int[] sorted = Enumerable.Range(1, n).ToArray();
    int[] random = Shuffle(sorted, new Random(7));

    int randomDepth = MaxDepth(random);
    int sortedDepth = MaxDepth(sorted);

    Console.WriteLine(
        $"{n,7:N0}{randomDepth,14:N0}{sortedDepth,14:N0}");
}

static int MaxDepth(int[] source)
{
    int[] items = (int[])source.Clone();
    int deepest = 0;
    Quicksort(items, 0, items.Length - 1, 1, ref deepest);
    return deepest;
}

static void Quicksort(int[] items, int lo, int hi, int depth, ref int deepest)
{
    if (depth > deepest) deepest = depth;
    if (lo >= hi) return;
    int pivotIndex = Partition(items, lo, hi);
    Quicksort(items, lo, pivotIndex - 1, depth + 1, ref deepest);
    Quicksort(items, pivotIndex + 1, hi, depth + 1, ref deepest);
}

static int Partition(int[] items, int lo, int hi)
{
    int pivot = items[lo];
    int i = lo;
    for (int j = lo + 1; j <= hi; j++)
    {
        if (items[j] < pivot)
        {
            i++;
            (items[i], items[j]) = (items[j], items[i]);
        }
    }
    (items[lo], items[i]) = (items[i], items[lo]);
    return i;
}

static int[] Shuffle(int[] source, Random random)
{
    int[] items = (int[])source.Clone();
    for (int i = items.Length - 1; i > 0; i--)
    {
        int j = random.Next(i + 1);
        (items[i], items[j]) = (items[j], items[i]);
    }
    return items;
}
```

```text output
      n  random depth  sorted depth
    500            21           500
  1,000            19         1,000
  2,000            25         2,000
  4,000            26         4,000
  8,000            30         8,000
```

Random input keeps the [recursion](/glossary/#recursion) shallow — under 30 frames at *n* = 8,000, close to log₂ 8,000 ≈ 13 — while sorted input needs exactly *n* frames, one per element, confirmed by the table. Every active call holds a frame on the call stack, and `StackOverflowException` "is thrown when the execution stack exceeds the stack size." Unlike every other exception in .NET, the documentation is explicit that it cannot be handled: "you can't catch a `StackOverflowException` object with a `try`/`catch` block, and the corresponding process is terminated by default." Sorting an already-sorted array of 200,000 integers with the naive version above confirms it on the machine used for this page: the process prints `Stack overflow.`, dumps a stack trace thousands of frames deep, and exits — not a slow answer, no answer at all. A quicksort that is merely quadratic returns eventually; one whose recursion depth tracks *n* can instead take down the process that called it.

## Best, average and worst case, defined

"Quicksort is O(*n*²)" and "quicksort is O(*n* log *n*)" are both defensible sentences, and both are incomplete: [Big-O bounds a function, and an algorithm has more than one](/complexity/big-o-notation/) — its worst-case step count, its best case, its average over some distribution of inputs. Each case is a claim about a different function of *n*, and quicksort's recursive structure makes all three easy to state exactly.

Every call to `Quicksort` on a range of size *m* does *m* − 1 comparisons in `Partition`, then recurses on whatever the partition produced. That gives one recurrence per case, depending only on how the split sizes behave:

- **Worst case.** The split is `0 : (m-1)` at every level, the pattern measured above. *T*(*n*) = *T*(*n* − 1) + (*n* − 1) solves to *n*(*n* − 1)/2, which is Θ(*n*²).
- **Best case.** The split is as even as possible at every level, `⌊(m-1)/2⌋ : ⌈(m-1)/2⌉`. *T*(*n*) = 2*T*(*n*/2) + (*n* − 1) is the same recurrence merge sort satisfies (see [the O(*n* log *n*) argument for merge sort](/complexity/big-o-notation/#the-pair-search-does-not-have-to-be-quadratic)), and it solves to Θ(*n* log *n*).
- **Average case.** Average over what, precisely, is its own question, worked out below — but the answer is again Θ(*n* log *n*), with a larger constant than the best case.

<figure class="diagram">
<svg viewBox="0 0 360 622" role="img" aria-labelledby="qtree-title qtree-desc">
<title id="qtree-title">Two partition trees for the same seven values: one balanced, one degenerate</title>
<desc id="qtree-desc">Top panel: a balanced tree, pivot 4 at the root splitting into two branches of three nodes each, depth two. Bottom panel: a chain from pivot 1 down to pivot 7, each node's left subtree empty, depth six, one less than n.</desc>
<text x="20" y="22" class="d-bold">Balanced: every pivot near the median</text>
<path d="M180 76 L100 104" class="d-good"/>
<path d="M180 76 L260 104" class="d-good"/>
<path d="M100 136 L60 166" class="d-good"/>
<path d="M100 136 L140 166" class="d-good"/>
<path d="M260 136 L220 166" class="d-good"/>
<path d="M260 136 L300 166" class="d-good"/>
<circle cx="180" cy="60" r="16" class="d-box-good"/>
<text x="180" y="65" text-anchor="middle" class="d-mono d-bold">4</text>
<circle cx="100" cy="120" r="16" class="d-box-good"/>
<text x="100" y="125" text-anchor="middle" class="d-mono">2</text>
<circle cx="260" cy="120" r="16" class="d-box-good"/>
<text x="260" y="125" text-anchor="middle" class="d-mono">6</text>
<circle cx="60" cy="180" r="14" class="d-box-good"/>
<text x="60" y="185" text-anchor="middle" class="d-mono">1</text>
<circle cx="140" cy="180" r="14" class="d-box-good"/>
<text x="140" y="185" text-anchor="middle" class="d-mono">3</text>
<circle cx="220" cy="180" r="14" class="d-box-good"/>
<text x="220" y="185" text-anchor="middle" class="d-mono">5</text>
<circle cx="300" cy="180" r="14" class="d-box-good"/>
<text x="300" y="185" text-anchor="middle" class="d-mono">7</text>
<text x="20" y="218" class="d-small d-muted">Depth 2. Every split is about n/2 : n/2.</text>
<text x="20" y="264" class="d-bold">Degenerate: sorted input, pivot = first element</text>
<path d="M180 296 L180 316" class="d-bad"/>
<path d="M180 348 L180 368" class="d-bad"/>
<path d="M180 400 L180 420" class="d-bad"/>
<path d="M180 452 L180 472" class="d-bad"/>
<path d="M180 504 L180 524" class="d-bad"/>
<path d="M180 556 L180 576" class="d-bad"/>
<path d="M180 280 L140 280" class="d-bad d-dashed"/>
<text x="132" y="284" text-anchor="end" class="d-small d-muted">empty left</text>
<circle cx="180" cy="280" r="16" class="d-box-bad"/>
<text x="180" y="285" text-anchor="middle" class="d-mono">1</text>
<circle cx="180" cy="332" r="16" class="d-box-bad"/>
<text x="180" y="337" text-anchor="middle" class="d-mono">2</text>
<circle cx="180" cy="384" r="16" class="d-box-bad"/>
<text x="180" y="389" text-anchor="middle" class="d-mono">3</text>
<circle cx="180" cy="436" r="16" class="d-box-bad"/>
<text x="180" y="441" text-anchor="middle" class="d-mono">4</text>
<circle cx="180" cy="488" r="16" class="d-box-bad"/>
<text x="180" y="493" text-anchor="middle" class="d-mono">5</text>
<circle cx="180" cy="540" r="16" class="d-box-bad"/>
<text x="180" y="545" text-anchor="middle" class="d-mono">6</text>
<circle cx="180" cy="592" r="16" class="d-box-bad"/>
<text x="180" y="597" text-anchor="middle" class="d-mono">7</text>
</svg>
<figcaption>Figure 1. The same seven values, partitioned two ways. A balanced split (top) halves the work at every level; a first-element pivot on already-sorted input (bottom) peels off one element per call, so depth equals <em>n</em> − 1 instead of ⌈log₂ <em>n</em>⌉.</figcaption>
</figure>

:::pitfall
Neither Θ(*n*²) nor Θ(*n* log *n*) is "the" complexity of quicksort; each names one case. [O, Ω and Θ are not worst case, best case and average case](/complexity/big-o-notation/) — the case picks which function of *n* you are bounding, and only then does a notation bound it. "Quicksort is O(*n*²)" is a true statement about its worst case and a misleading one if left to imply its typical behavior.
:::

## The average case, counted

Average over what? Over every ordering of *n* distinct keys being equally likely — *n*! permutations, each with probability 1/*n*! — which is the standard assumption both CLRS and Sedgewick and Wayne make for this analysis. Call the keys' sorted ranks *z*₁ < *z*₂ < ... < *z*ₙ, and for each pair *i* < *j*, let *X*ᵢⱼ be 1 if *z*ᵢ and *z*ⱼ are ever compared against each other while sorting, 0 otherwise. Total comparisons is the sum of every *X*ᵢⱼ.

Here is the fact that makes the sum tractable: *z*ᵢ and *z*ⱼ are compared if and only if one of them is the *first* pivot chosen, among the whole set {*z*ᵢ, ..., *z*ⱼ}, of the *j* − *i* + 1 keys in that range. Once some key strictly between them is chosen as a pivot first, *z*ᵢ and *z*ⱼ land in different partitions and are never compared. With every ordering equally likely, each of those *j* − *i* + 1 keys is equally likely to be first, so the probability *z*ᵢ or *z*ⱼ is the one is 2/(*j* − *i* + 1). Summing that probability over all pairs gives the expected total:

```text
E[comparisons] = sum(i=1..n-1) sum(j=i+1..n) 2/(j-i+1)
```

Substituting *k* = *j* − *i* turns the inner sum into a piece of the harmonic series, and the whole double sum is bounded by 2*n* times the *n*-th harmonic number, which is Θ(log *n*). The result — Θ(*n* log *n*), worked out in full in CLRS chapter 7 and stated as "~2 *N* ln *N*" by Sedgewick and Wayne — matches the random column measured earlier: 2 · 8,000 · ln(8,000) ≈ 143,800, and the single random run above found 126,318, the right order of magnitude for one instance of a quantity whose exact value depends on which permutation was drawn.

::::exercise[Prove it: a lopsided split is still fast enough]
Suppose every partition splits its range 1 : (*m* − 2) instead of perfectly evenly — one element peeled off the small side, not zero. Using the recurrence *T*(*n*) = *T*(*n* − 2) + (*n* − 1), show that this is still Θ(*n*²) despite not being the exact `0 : n-1` worst case, by finding the closed form. Then explain in one sentence why the average-case argument above does not contradict this: which splits are rare under a uniform random permutation?

:::solution
*T*(*n*) = *T*(*n* − 2) + (*n* − 1) unrolls to (*n* − 1) + (*n* − 3) + (*n* − 5) + ... down to a base case, roughly *n*/2 terms averaging just under *n*, so *T*(*n*) is Θ(*n*²) — dropping one element per level instead of zero does not change the order, only the constant (the leading coefficient becomes about ¼ instead of ½).

The average-case sum weights every one of the *n*! orderings equally, and only two of the *j* − *i* + 1 possible "first pivots" in a range make that range's split `0 : m-1` or `m-1 : 0`-like at the extreme; the other *j* − *i* − 1 choices give some more balanced split. Extreme splits are not impossible under a random ordering, just rare enough that they do not dominate the sum: a single unlucky split costs at most a constant factor, and the argument above already accounts for every possible split, weighted by how often it actually occurs.
:::
::::

## Expected case: let the pivot be a coin flip

The average-case argument assumed the *input* was a uniformly random permutation. Most inputs are not — log files, imports and already-sorted lists are exactly the case that breaks the deterministic version. Randomized quicksort keeps the input fixed and instead makes the *algorithm's own choice* random: swap a uniformly chosen element into the front of the range before partitioning around it. The program below runs both versions, sharing the identical `Partition`, against the pathological inputs from the first section plus two more:

```csharp run id=randomized-fix
using System.Globalization;

CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;

const int N = 8000;
var rnd = new Random(7);
int[] sorted = Enumerable.Range(1, N).ToArray();
int[] reversed = Enumerable.Range(1, N).Reverse().ToArray();
int[] duplicates = Enumerable.Repeat(0, N)
    .Select(_ => rnd.Next(1, 5)).ToArray();
int[] random = Shuffle(sorted, new Random(7));

Console.WriteLine($"{"input",-12}{"naive",12}{"randomized",12}");
PrintRow("sorted", sorted);
PrintRow("reversed", reversed);
PrintRow("duplicates", duplicates);
PrintRow("random", random);

static void PrintRow(string label, int[] input)
{
    long naive = CountCompares(input, randomized: false, seed: 0);
    long rand = CountCompares(input, randomized: true, seed: 11);
    Console.WriteLine($"{label,-12}{naive,12:N0}{rand,12:N0}");
}

static long CountCompares(int[] source, bool randomized, int seed)
{
    int[] items = (int[])source.Clone();
    long compares = 0;
    var rng = new Random(seed);
    Quicksort(items, 0, items.Length - 1, randomized, rng, ref compares);
    return compares;
}

static void Quicksort(
    int[] items, int lo, int hi,
    bool randomized, Random rng, ref long compares)
{
    if (lo >= hi) return;
    if (randomized)
    {
        int r = rng.Next(lo, hi + 1);
        (items[lo], items[r]) = (items[r], items[lo]);
    }
    int pivotIndex = Partition(items, lo, hi, ref compares);
    Quicksort(items, lo, pivotIndex - 1, randomized, rng, ref compares);
    Quicksort(items, pivotIndex + 1, hi, randomized, rng, ref compares);
}

static int Partition(int[] items, int lo, int hi, ref long compares)
{
    int pivot = items[lo];
    int i = lo;
    for (int j = lo + 1; j <= hi; j++)
    {
        compares++;
        if (items[j] < pivot)
        {
            i++;
            (items[i], items[j]) = (items[j], items[i]);
        }
    }
    (items[lo], items[i]) = (items[i], items[lo]);
    return i;
}

static int[] Shuffle(int[] source, Random random)
{
    int[] items = (int[])source.Clone();
    for (int i = items.Length - 1; i > 0; i--)
    {
        int j = random.Next(i + 1);
        (items[i], items[j]) = (items[j], items[i]);
    }
    return items;
}
```

```text output
input              naive  randomized
sorted        31,996,000     123,746
reversed      31,996,000     122,896
duplicates     8,013,935   8,017,980
random           126,318     120,958
```

Against `Quicksort`'s naive branch, the only change is this one swap, made before every partition:

```csharp snippet of=randomized-fix
if (randomized)
{
    int r = rng.Next(lo, hi + 1);
    (items[lo], items[r]) = (items[r], items[lo]);
}
```

`Partition` itself is untouched, and that one swap reproduces the average-case argument exactly, for *any* fixed input: the probability that *z*ᵢ or *z*ⱼ is the first of {*z*ᵢ, ..., *z*ⱼ} chosen as a pivot is again 2/(*j* − *i* + 1), because the algorithm — not the input — is now the source of the randomness, and every key in the range is equally likely to be picked regardless of how the input was ordered. The same sum gives the same Θ(*n* log *n*), no longer averaged over inputs but *expected* over the algorithm's own coin flips, for every input including the ones that broke the deterministic version. Sorted and reversed both collapse from about 32 million comparisons to about 123,000 — in the same range as `random`'s 126,318, because to the randomized version there is no longer anything special about sorted order. Sedgewick and Wayne put a number on how reliable this is: "the probability that quicksort will use a quadratic number of compares when sorting a large array on your computer is much less than the probability that your computer will be struck by lightning." That guarantee is about input *order*; nothing here required the *values* to be varied, and the `duplicates` row shows why that matters.

## What randomization doesn't fix: duplicate keys

`duplicates` fills the array with only four distinct values, repeated 2,000 times each, in random positions — and both versions cost about 8 million comparisons, barely different from `sorted`'s naive worst case. Randomizing *which* element becomes the pivot cannot help when most of the array is equal to whatever gets picked: `Partition` puts every value equal to the pivot on the "not less than" side, so a pivot value that appears 2,000 times produces a split close to `0 : (m-1)` almost every time, no matter which of the equal copies was chosen. Sedgewick and Wayne name this directly: stopping each scan on keys equal to the pivot "might seem to create unnecessary exchanges," but "it is crucial to avoiding quadratic running time in certain typical applications" that have many repeated keys, and their fix is a different partitioning scheme — three-way partitioning, splitting each range into *less than*, *equal to* and *greater than* the pivot, so every element equal to the pivot is placed once and never scanned again by either recursive call.

::::exercise[Extend the code: fix the duplicates case]
Rewrite `Partition` (call it `PartitionThreeWay`) to produce three regions in one pass: `items[lo..lt-1]` less than the pivot, `items[lt..gt]` equal to it, `items[gt+1..hi]` greater. Recurse only on the outer two regions. Run it against the same `duplicates` array from above and compare the comparison count with the two-way version's.

:::solution
Sedgewick and Wayne's three-way scheme keeps three pointers moving toward each other:

```csharp run id=ex-threeway
using System.Globalization;
CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;

const int N = 8000;
var rnd = new Random(7);
int[] duplicates = Enumerable.Repeat(0, N)
    .Select(_ => rnd.Next(1, 5)).ToArray();

long twoWay = CountCompares(duplicates, threeWay: false);
long threeWay = CountCompares(duplicates, threeWay: true);
Console.WriteLine($"2-way partition: {twoWay,10:N0} compares");
Console.WriteLine($"3-way partition: {threeWay,10:N0} compares");

static long CountCompares(int[] source, bool threeWay)
{
    int[] items = (int[])source.Clone();
    long compares = 0;
    var rng = new Random(11);
    if (threeWay)
        QuicksortThreeWay(items, 0, items.Length - 1, rng, ref compares);
    else
        Quicksort(items, 0, items.Length - 1, rng, ref compares);
    return compares;
}

static void Quicksort(
    int[] items, int lo, int hi, Random rng, ref long compares)
{
    if (lo >= hi) return;
    int r = rng.Next(lo, hi + 1);
    (items[lo], items[r]) = (items[r], items[lo]);
    int pivot = items[lo];
    int i = lo;
    for (int j = lo + 1; j <= hi; j++)
    {
        compares++;
        if (items[j] < pivot)
        {
            i++;
            (items[i], items[j]) = (items[j], items[i]);
        }
    }
    (items[lo], items[i]) = (items[i], items[lo]);
    Quicksort(items, lo, i - 1, rng, ref compares);
    Quicksort(items, i + 1, hi, rng, ref compares);
}

static void QuicksortThreeWay(
    int[] items, int lo, int hi, Random rng, ref long compares)
{
    if (lo >= hi) return;
    int r = rng.Next(lo, hi + 1);
    (items[lo], items[r]) = (items[r], items[lo]);
    int pivot = items[lo];
    int lt = lo, gt = hi, k = lo + 1;
    while (k <= gt)
    {
        compares++;
        if (items[k] < pivot)
        {
            (items[lt], items[k]) = (items[k], items[lt]);
            lt++; k++;
        }
        else if (items[k] > pivot)
        {
            (items[gt], items[k]) = (items[k], items[gt]);
            gt--;
        }
        else k++;
    }
    QuicksortThreeWay(items, lo, lt - 1, rng, ref compares);
    QuicksortThreeWay(items, gt + 1, hi, rng, ref compares);
}
```

```text output
2-way partition:  8,017,980 compares
3-way partition:     19,959 compares
```

Two-way partitioning re-scans every element equal to the pivot on both sides of every later split; three-way retires them in the single pass that found them. 19,959 comparisons on 8,000 elements with only four distinct values is close to linear, matching Sedgewick and Wayne's claim that duplicate-heavy arrays can drop from linearithmic to linear time.
:::
::::

## Adversarial inputs and hash flooding

Randomization defeats an adversary who cannot predict which pivots the algorithm will draw. But the general shape of the problem — a deterministic scheme with no hidden randomness gives anyone who knows the algorithm a way to force its worst case — is not unique to quicksort, and it has a more consequential, well-documented instance: hash tables.

Crosby and Wallach's 2003 USENIX Security paper, "Denial of Service via Algorithmic Complexity Attacks," showed that data structures whose performance depends on a hash function behaving well can be driven to their worst case by an attacker who knows that function and chooses input keys to collide under it: "both binary trees and hash tables can degenerate to linked lists with carefully chosen input," turning an O(1) lookup into an O(*n*) one for every one of *n* attacker-supplied keys, an O(*n*²) total from a small, cheap request. The attack is not hypothetical: [Microsoft Security Advisory 2659883](https://learn.microsoft.com/en-us/security-updates/securityadvisories/2011/2659883) documents CVE-2011-3414, "Collisions in HashTable May Cause DoS Vulnerability," in ASP.NET, patched by the MS11-100 update in December 2011.

The program below builds the mechanism in miniature. All permutations of the same eight letters share the same character sum, so a hash function that just adds character codes sends every one of them to the same bucket — a free collision, no cryptanalysis required. `s.GetHashCode()`, .NET's real string hash, does not:

```csharp run id=hash-flood
using System.Globalization;

CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;

const int Keys = 4000;
const int Buckets = 4096;

string[] keys = DistinctPermutations("abcdefgh", Keys, new Random(7));

long naiveProbes = Insert(keys, Buckets, s => AdditiveHash(s));
long realProbes = Insert(keys, Buckets, s => s.GetHashCode());

Console.WriteLine($"{"hash",-16}{"total probes",14}{"per key",10}");
Console.WriteLine(
    $"{"sum-of-chars",-16}{naiveProbes,14:N0}{naiveProbes / (double)Keys,10:F1}");
Console.WriteLine(
    $"{"GetHashCode",-16}{realProbes,14:N0}{realProbes / (double)Keys,10:F1}");

static long Insert(string[] keys, int buckets, Func<string, int> hash)
{
    var table = new List<string>[buckets];
    long probes = 0;
    foreach (string key in keys)
    {
        int index = (int)((uint)hash(key) % buckets);
        table[index] ??= [];
        probes += table[index].Count; // scan the chain, as a real insert must
        table[index].Add(key);
    }
    return probes;
}

static int AdditiveHash(string s)
{
    int sum = 0;
    foreach (char c in s) sum += c;
    return sum;
}

static string[] DistinctPermutations(string source, int count, Random random)
{
    var seen = new HashSet<string>();
    char[] chars = source.ToCharArray();
    while (seen.Count < count)
    {
        for (int i = chars.Length - 1; i > 0; i--)
        {
            int j = random.Next(i + 1);
            (chars[i], chars[j]) = (chars[j], chars[i]);
        }
        seen.Add(new string(chars));
    }
    return [.. seen];
}
```

```text output
hash              total probes   per key
sum-of-chars         7,998,000    1999.5
GetHashCode     [...]
```

The `GetHashCode` row is left blank above on purpose: because .NET draws a fresh random seed every time the process starts, the exact probe count differs on every run — which is the entire point of this page's next callout. One run on this machine printed:

```text
GetHashCode              1,923       0.5
```

4,000 keys through the character-sum hash cost 7,998,000 chain scans — the exact 4,000 · 3,999/2 shape of the sorted-array bug, because every key lands in one bucket and each insert must scan every key already there. The same keys through `GetHashCode` cost under 2,000, close to half a probe per key, the mark of a healthy table, on every run tried while writing this page.

:::dotnet
This is not only about picking a hash function that mixes bits well. .NET's [`String.GetHashCode`](https://learn.microsoft.com/en-us/dotnet/api/system.string.gethashcode) documentation states plainly that "the hash code itself is not guaranteed to be stable" and that "two subsequent runs of the same program may return different hash codes." In the current [dotnet/runtime source](https://github.com/dotnet/runtime/blob/main/src/libraries/System.Private.CoreLib/src/System/String.Comparison.cs), the parameterless `GetHashCode()` computes a [Marvin32](https://github.com/dotnet/runtime/blob/main/src/libraries/System.Private.CoreLib/src/System/Marvin.cs) hash seeded from `Marvin.DefaultSeed`, a 64-bit value drawn once per process from the operating system's cryptographic random number generator. A separate, faster `GetNonRandomizedHashCode()` exists for internal, non-attacker-facing uses, with a comment in the source that states the reasoning outright: "Use if and only if 'Denial of Service' attacks are not a concern (i.e. never used for free-form user input), or are otherwise mitigated." A fixed hash function, however well it mixes bits, is a published formula an attacker can invert offline; a per-process random seed means the attacker would have to guess or leak that seed first. Older .NET Framework versions made this opt-in per `AppDomain` (the [`<UseRandomizedStringHashAlgorithm>`](https://learn.microsoft.com/en-us/dotnet/api/system.string.gethashcode) element); current .NET does it unconditionally.
:::

::::exercise[Predict the output: does the randomness break lookups?]
If `GetHashCode()` genuinely returns a different number for `"quicksort"` on every run of the program, can a `Dictionary<string, int>` built and queried within a single run still find a key it just inserted? Predict yes or no, and why, before running.

:::solution
Yes. The random part is the per-*process* seed, chosen once when the process starts; every `GetHashCode()` call made by that process for the rest of its life uses the same seed, so the same string hashes to the same bucket for every insert and every lookup made while the process is running. What changes between runs is which seed gets chosen, not whether a run is internally consistent.

```csharp run id=ex-dictionary
var prices = new Dictionary<string, int>();
prices["quicksort"] = 1;
prices["mergesort"] = 2;
prices["heapsort"] = 3;

bool found = prices.TryGetValue("quicksort", out int value);
Console.WriteLine($"found: {found}, value: {value}");
```

```text output
found: True, value: 1
```

Persist a hash code from one run and compare it against a fresh run's, though, and the two can legitimately differ — which is exactly what the documentation means by "should never be persisted."
:::
::::

## Stating the bound so it survives a code review

Four sentences, each true only under its own stated condition, cover this whole page:

| Case | Holds for | Quicksort's bound |
|---|---|---|
| Worst case | Some input exists that triggers it | Θ(*n*²) |
| Best case | Some input exists that triggers it | Θ(*n* log *n*) |
| Average case | Every ordering of the input equally likely | Θ(*n* log *n*) |
| Expected case | Any fixed input, averaged over the algorithm's own random pivots | O(*n* log *n*) |

"Quicksort is O(*n*²)" is defensible only as shorthand for the first row, and misleading read as a summary of the whole table. The honest version names the case: the deterministic, first-element-pivot version measured at the top of this page is Θ(*n*²) on adversarial input — including the unremarkable case of data that arrived pre-sorted — and Θ(*n* log *n*) on a random ordering; the randomized version is O(*n* log *n*) expected on every input, which is a guarantee about the algorithm rather than a hope about the data, but is not a defense against an adversary who can force many equal keys through a two-way partition, or, in a different data structure entirely, against one who can predict a hash function that was never given a secret to predict.

::::exercise[Find the bug: a randomized quicksort that isn't]
A colleague "fixes" the naive version by adding randomization, but keeps measuring it against the same sorted array from the first section and still gets roughly *n*²/2 comparisons every time:

```text
static void Quicksort(int[] items, int lo, int hi)
{
    if (lo >= hi) return;
    var rng = new Random();
    int r = rng.Next(lo, hi + 1);
    int pivotIndex = Partition(items, lo, hi);
    Quicksort(items, lo, pivotIndex - 1);
    Quicksort(items, pivotIndex + 1, hi);
}
```

Find the bug, without running it.

:::solution
`r` is computed and then never used. The line that does the actual work in every other version on this page — `(items[lo], items[r]) = (items[r], items[lo]);` — is missing, so `Partition` still always reads `items[lo]` as the pivot, exactly as in the naive version. Picking a random index is not the fix; *moving that element to where `Partition` looks for the pivot* is. This is worth checking for deliberately, because the code compiles, runs, and even calls `Random` — everything looks randomized except the one line that would make it so.
:::
::::
