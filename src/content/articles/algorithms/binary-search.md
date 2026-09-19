---
title: "Binary Search and the Three Bugs It Invites"
description: "Debug a binary search that silently misses values, fix it with a loop invariant, then cover midpoint overflow, lower bound, ~index, and answer search."
pillar: algorithms
order: 1
author: markus
published: 2026-09-18
updated: 2026-09-18
level: intermediate
tags: [binary-search, searching, loop-invariants, big-o]
prerequisites: ["complexity/big-o-notation"]
sources:
  - title: "Array.BinarySearch Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.array.binarysearch"
    publisher: "Microsoft Learn"
    accessed: 2026-09-18
  - title: "List<T>.BinarySearch Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.list-1.binarysearch"
    publisher: "Microsoft Learn"
    accessed: 2026-09-18
  - title: "ArraySortHelper.cs (InternalBinarySearch)"
    url: "https://github.com/dotnet/runtime/blob/main/src/libraries/System.Private.CoreLib/src/System/Collections/Generic/ArraySortHelper.cs"
    publisher: "dotnet/runtime on GitHub"
    accessed: 2026-09-18
  - title: "SpanHelpers.BinarySearch.cs"
    url: "https://github.com/dotnet/runtime/blob/main/src/libraries/System.Private.CoreLib/src/System/SpanHelpers.BinarySearch.cs"
    publisher: "dotnet/runtime on GitHub"
    accessed: 2026-09-18
  - title: "Extra, Extra - Read All About It: Nearly All Binary Searches and Mergesorts are Broken"
    url: "https://research.google/blog/extra-extra-read-all-about-it-nearly-all-binary-searches-and-mergesorts-are-broken/"
    publisher: "Google Research (Joshua Bloch)"
    accessed: 2026-09-18
  - title: "The checked and unchecked statements"
    url: "https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/statements/checked-and-unchecked"
    publisher: "Microsoft Learn"
    accessed: 2026-09-18
  - title: "Bitwise and shift operators"
    url: "https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/operators/bitwise-and-shift-operators"
    publisher: "Microsoft Learn"
    accessed: 2026-09-18
  - title: "Array.MaxLength Property"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.array.maxlength"
    publisher: "Microsoft Learn"
    accessed: 2026-09-18
  - title: "List<T>.Insert(Int32, T) Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.list-1.insert"
    publisher: "Microsoft Learn"
    accessed: 2026-09-18
  - title: "Dictionary<TKey,TValue> Class"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.dictionary-2"
    publisher: "Microsoft Learn"
    accessed: 2026-09-18
  - title: "Programming Pearls, 2nd ed., column 4: Writing Correct Programs"
    url: "https://www.pearson.com/en-us/subject-catalog/p/programming-pearls/P200000000629"
    publisher: "Addison-Wesley (Jon Bentley)"
    accessed: 2026-09-18
  - title: "Introduction to Algorithms, 4th ed., chapters 2 and 13"
    url: "https://mitpress.mit.edu/9780262046305/introduction-to-algorithms/"
    publisher: "MIT Press"
    accessed: 2026-09-18
draft: true
---

The function below looks up a bus departure in a sorted timetable. Times are minutes after midnight, so 305 is 05:05. It follows the usual recipe: keep two indexes, look at the element halfway between them, throw away the half that cannot hold the target.

```csharp run id=buggy
int[] departures =
[
    305, 350, 395, 440, 500, 560,
    635, 710, 800, 905, 990,
];

// First, middle, last, and an absent one.
int[] spotChecks = [305, 560, 990, 600];
foreach (int t in spotChecks)
{
    int index = Find(departures, t);
    Console.WriteLine($"{t} -> {index}");
}

static int Find(int[] a, int target)
{
    int lo = 0, hi = a.Length;
    while (lo < hi)
    {
        int mid = (lo + hi) / 2;
        if (a[mid] == target) return mid;
        if (a[mid] < target) lo = mid + 1;
        else hi = mid - 1;
    }
    return -1;
}
```

```text output
305 -> 0
560 -> 5
990 -> 10
600 -> -1
```

Four sensible checks, four right answers. Now ask it for every departure that is in the array, and print the ones it fails to find:

```csharp run
int[] departures =
[
    305, 350, 395, 440, 500, 560,
    635, 710, 800, 905, 990,
];

foreach (int t in departures)
    if (Find(departures, t) < 0)
        Console.WriteLine($"{t}: not found");

static int Find(int[] a, int target)
{
    int lo = 0, hi = a.Length;
    while (lo < hi)
    {
        int mid = (lo + hi) / 2;
        if (a[mid] == target) return mid;
        if (a[mid] < target) lo = mid + 1;
        else hi = mid - 1;
    }
    return -1;
}
```

```text output
350: not found
500: not found
710: not found
905: not found
```

Four of eleven lookups are wrong, and nothing crashed. This is the first of three bugs this page works through, each with a different symptom: a search that silently misses values, a search that never returns, and a midpoint that overflows on large inputs. All three have the same cure, which is to decide exactly what `lo` and `hi` mean and check every line against that meaning.

## Follow 500 through the loop

Figure 1 traces the search for 500, which sits at index 4.

<figure class="diagram">
<svg viewBox="0 0 360 356" role="img" aria-labelledby="miss-title miss-desc">
<title id="miss-title">The buggy search for 500 discarding index 4 without examining it</title>
<desc id="miss-desc">Four rows show the same eleven-element array. In row one the probe is index 5 and the interval shrinks to indexes 0 to 3, leaving index 4, which holds 500, outside. Rows two and three probe indexes 2 and 3. Row four has an empty interval and the search reports not found.</desc>
<text x="30" y="24" text-anchor="middle" class="d-small d-muted">0</text>
<text x="60" y="24" text-anchor="middle" class="d-small d-muted">1</text>
<text x="90" y="24" text-anchor="middle" class="d-small d-muted">2</text>
<text x="120" y="24" text-anchor="middle" class="d-small d-muted">3</text>
<text x="150" y="24" text-anchor="middle" class="d-small d-muted">4</text>
<text x="180" y="24" text-anchor="middle" class="d-small d-muted">5</text>
<text x="210" y="24" text-anchor="middle" class="d-small d-muted">6</text>
<text x="240" y="24" text-anchor="middle" class="d-small d-muted">7</text>
<text x="270" y="24" text-anchor="middle" class="d-small d-muted">8</text>
<text x="300" y="24" text-anchor="middle" class="d-small d-muted">9</text>
<text x="330" y="24" text-anchor="middle" class="d-small d-muted">10</text>
<rect x="15" y="34" width="30" height="30" class="d-box"/><text x="30" y="54" text-anchor="middle" class="d-mono d-small">305</text>
<rect x="45" y="34" width="30" height="30" class="d-box"/><text x="60" y="54" text-anchor="middle" class="d-mono d-small">350</text>
<rect x="75" y="34" width="30" height="30" class="d-box"/><text x="90" y="54" text-anchor="middle" class="d-mono d-small">395</text>
<rect x="105" y="34" width="30" height="30" class="d-box"/><text x="120" y="54" text-anchor="middle" class="d-mono d-small">440</text>
<rect x="135" y="34" width="30" height="30" class="d-box"/><text x="150" y="54" text-anchor="middle" class="d-mono d-small">500</text>
<rect x="165" y="34" width="30" height="30" class="d-box-accent"/><text x="180" y="54" text-anchor="middle" class="d-mono d-small d-bold">560</text>
<rect x="195" y="34" width="30" height="30" class="d-box"/><text x="210" y="54" text-anchor="middle" class="d-mono d-small">635</text>
<rect x="225" y="34" width="30" height="30" class="d-box"/><text x="240" y="54" text-anchor="middle" class="d-mono d-small">710</text>
<rect x="255" y="34" width="30" height="30" class="d-box"/><text x="270" y="54" text-anchor="middle" class="d-mono d-small">800</text>
<rect x="285" y="34" width="30" height="30" class="d-box"/><text x="300" y="54" text-anchor="middle" class="d-mono d-small">905</text>
<rect x="315" y="34" width="30" height="30" class="d-box"/><text x="330" y="54" text-anchor="middle" class="d-mono d-small">990</text>
<text x="15" y="81" class="d-small">[0, 11): probe a[5] = 560, too big</text>
<text x="15" y="97" class="d-small d-text-bad">hi = 5 - 1 = 4 throws out index 4 unseen</text>
<rect x="15" y="116" width="30" height="30" class="d-box"/><text x="30" y="136" text-anchor="middle" class="d-mono d-small">305</text>
<rect x="45" y="116" width="30" height="30" class="d-box"/><text x="60" y="136" text-anchor="middle" class="d-mono d-small">350</text>
<rect x="75" y="116" width="30" height="30" class="d-box-accent"/><text x="90" y="136" text-anchor="middle" class="d-mono d-small d-bold">395</text>
<rect x="105" y="116" width="30" height="30" class="d-box"/><text x="120" y="136" text-anchor="middle" class="d-mono d-small">440</text>
<rect x="135" y="116" width="30" height="30" class="d-box-bad"/><text x="150" y="136" text-anchor="middle" class="d-mono d-small d-text-bad d-bold">500</text>
<rect x="165" y="116" width="30" height="30" class="d-box-2 d-dashed"/><text x="180" y="136" text-anchor="middle" class="d-mono d-small d-muted">560</text>
<rect x="195" y="116" width="30" height="30" class="d-box-2 d-dashed"/><text x="210" y="136" text-anchor="middle" class="d-mono d-small d-muted">635</text>
<rect x="225" y="116" width="30" height="30" class="d-box-2 d-dashed"/><text x="240" y="136" text-anchor="middle" class="d-mono d-small d-muted">710</text>
<rect x="255" y="116" width="30" height="30" class="d-box-2 d-dashed"/><text x="270" y="136" text-anchor="middle" class="d-mono d-small d-muted">800</text>
<rect x="285" y="116" width="30" height="30" class="d-box-2 d-dashed"/><text x="300" y="136" text-anchor="middle" class="d-mono d-small d-muted">905</text>
<rect x="315" y="116" width="30" height="30" class="d-box-2 d-dashed"/><text x="330" y="136" text-anchor="middle" class="d-mono d-small d-muted">990</text>
<text x="15" y="163" class="d-small">[0, 4): probe a[2] = 395, too small</text>
<text x="15" y="179" class="d-small d-muted">lo = 2 + 1 = 3</text>
<rect x="15" y="198" width="30" height="30" class="d-box-2 d-dashed"/><text x="30" y="218" text-anchor="middle" class="d-mono d-small d-muted">305</text>
<rect x="45" y="198" width="30" height="30" class="d-box-2 d-dashed"/><text x="60" y="218" text-anchor="middle" class="d-mono d-small d-muted">350</text>
<rect x="75" y="198" width="30" height="30" class="d-box-2 d-dashed"/><text x="90" y="218" text-anchor="middle" class="d-mono d-small d-muted">395</text>
<rect x="105" y="198" width="30" height="30" class="d-box-accent"/><text x="120" y="218" text-anchor="middle" class="d-mono d-small d-bold">440</text>
<rect x="135" y="198" width="30" height="30" class="d-box-bad"/><text x="150" y="218" text-anchor="middle" class="d-mono d-small d-text-bad d-bold">500</text>
<rect x="165" y="198" width="30" height="30" class="d-box-2 d-dashed"/><text x="180" y="218" text-anchor="middle" class="d-mono d-small d-muted">560</text>
<rect x="195" y="198" width="30" height="30" class="d-box-2 d-dashed"/><text x="210" y="218" text-anchor="middle" class="d-mono d-small d-muted">635</text>
<rect x="225" y="198" width="30" height="30" class="d-box-2 d-dashed"/><text x="240" y="218" text-anchor="middle" class="d-mono d-small d-muted">710</text>
<rect x="255" y="198" width="30" height="30" class="d-box-2 d-dashed"/><text x="270" y="218" text-anchor="middle" class="d-mono d-small d-muted">800</text>
<rect x="285" y="198" width="30" height="30" class="d-box-2 d-dashed"/><text x="300" y="218" text-anchor="middle" class="d-mono d-small d-muted">905</text>
<rect x="315" y="198" width="30" height="30" class="d-box-2 d-dashed"/><text x="330" y="218" text-anchor="middle" class="d-mono d-small d-muted">990</text>
<text x="15" y="245" class="d-small">[3, 4): probe a[3] = 440, too small</text>
<text x="15" y="261" class="d-small d-muted">lo = 3 + 1 = 4</text>
<rect x="15" y="280" width="30" height="30" class="d-box-2 d-dashed"/><text x="30" y="300" text-anchor="middle" class="d-mono d-small d-muted">305</text>
<rect x="45" y="280" width="30" height="30" class="d-box-2 d-dashed"/><text x="60" y="300" text-anchor="middle" class="d-mono d-small d-muted">350</text>
<rect x="75" y="280" width="30" height="30" class="d-box-2 d-dashed"/><text x="90" y="300" text-anchor="middle" class="d-mono d-small d-muted">395</text>
<rect x="105" y="280" width="30" height="30" class="d-box-2 d-dashed"/><text x="120" y="300" text-anchor="middle" class="d-mono d-small d-muted">440</text>
<rect x="135" y="280" width="30" height="30" class="d-box-bad"/><text x="150" y="300" text-anchor="middle" class="d-mono d-small d-text-bad d-bold">500</text>
<rect x="165" y="280" width="30" height="30" class="d-box-2 d-dashed"/><text x="180" y="300" text-anchor="middle" class="d-mono d-small d-muted">560</text>
<rect x="195" y="280" width="30" height="30" class="d-box-2 d-dashed"/><text x="210" y="300" text-anchor="middle" class="d-mono d-small d-muted">635</text>
<rect x="225" y="280" width="30" height="30" class="d-box-2 d-dashed"/><text x="240" y="300" text-anchor="middle" class="d-mono d-small d-muted">710</text>
<rect x="255" y="280" width="30" height="30" class="d-box-2 d-dashed"/><text x="270" y="300" text-anchor="middle" class="d-mono d-small d-muted">800</text>
<rect x="285" y="280" width="30" height="30" class="d-box-2 d-dashed"/><text x="300" y="300" text-anchor="middle" class="d-mono d-small d-muted">905</text>
<rect x="315" y="280" width="30" height="30" class="d-box-2 d-dashed"/><text x="330" y="300" text-anchor="middle" class="d-mono d-small d-muted">990</text>
<text x="15" y="327" class="d-small">[4, 4): empty, so the loop ends: return -1</text>
<text x="15" y="343" class="d-small d-text-bad">500 sat at index 4 the whole time</text>
</svg>
<figcaption>Figure 1. The search for 500. Solid cells are still in the interval, the accent cell is the probe, and the red cell is the target after the first step has wrongly excluded it. Comparing with <code>a[5]</code> justified discarding indexes 5 to 10 and nothing else.</figcaption>
</figure>

The damage is done in the first step. The loop condition `lo < hi` and the starting value `hi = a.Length` both treat `hi` as the first index that is *outside* the search. The assignment `hi = mid - 1` treats `hi` as the last index *inside* it. Put together, `hi = 4` means "index 4 is out", although the only fact the code had was that `a[5]` is too big.

That also explains why the spot checks passed. A value is lost only when it sits immediately left of a probe that was too big, so whether a given target is found depends on the path the probes happen to take. The first, middle and last elements, the natural picks for a quick test, are not on a losing path in an array of eleven.

## Say what lo and hi mean, then hold every line to it

A [loop invariant](/glossary/#invariant) is a statement that is true every time execution reaches the top of the loop. For binary search the useful one is a promise about where the target can still be:

> If `target` is anywhere in `a`, its index is in the half-open interval `[lo, hi)`: at least `lo`, and strictly less than `hi`.

Deriving binary search from an invariant like this is the approach of column 4 of Jon Bentley's *Programming Pearls*; the choice of a half-open interval and the C# below are this page's own. Now go through the function one line at a time and ask whether the line keeps the promise.

- **Before the loop.** `lo = 0, hi = a.Length` makes the interval cover every index. The promise holds trivially.
- **`a[mid] < target`.** The array is sorted, so everything at or left of `mid` is also too small. The target, if present, is in `[mid + 1, hi)`. Setting `lo = mid + 1` keeps the promise.
- **`a[mid] > target`.** Everything at or right of `mid` is too big. The target, if present, is in `[lo, mid)`. The assignment that says so is `hi = mid`. Writing `hi = mid - 1` claims `[lo, mid - 1)`, which excludes index `mid - 1` on no evidence. That is the bug.
- **After the loop.** The loop ends when `lo == hi`, so the interval is empty. The promise says the target can only be in an empty set of indexes, so it is not in the array, and returning -1 is correct.

Correctness also needs the loop to end. With `lo < hi`, the midpoint `lo + (hi - lo) / 2` satisfies `lo <= mid < hi`. Both updates therefore shrink the interval: `lo = mid + 1` moves `lo` up by at least one, and `hi = mid` moves `hi` down by at least one. An interval of non-negative length that shrinks every time round must reach length zero.

```csharp run id=fixed
int[] departures =
[
    305, 350, 395, 440, 500, 560,
    635, 710, 800, 905, 990,
];

// Every prefix, including the empty
// one, against targets 300 to 1000.
int wrong = 0;
int len = departures.Length;
for (int n = 0; n <= len; n++)
{
    int[] a = departures[..n];
    for (int t = 300; t <= 1000; t++)
    {
        int want = Array.IndexOf(a, t);
        if (Find(a, t) != want) wrong++;
    }
}
Console.WriteLine($"wrong: {wrong}");

static int Find(int[] a, int target)
{
    // If target is in a, its index
    // is in [lo, hi).
    int lo = 0, hi = a.Length;
    while (lo < hi)
    {
        int mid = lo + (hi - lo) / 2;
        if (a[mid] == target) return mid;
        if (a[mid] < target) lo = mid + 1;
        else hi = mid;
    }
    return -1;
}
```

```text output
wrong: 0
```

The test compares against `Array.IndexOf`, a linear scan that is too simple to get wrong, over twelve array lengths and 701 targets each. The values are distinct, so there is only one right index per target. A brute-force oracle like this is the test to write for any binary search; four spot checks are not. (The midpoint is written differently from the first program. That is bug three, and it has [its own section](#the-midpoint-that-overflows).)

### The closed-interval version is equally correct

The .NET runtime's own binary searches (quoted [further down](#the-midpoint-that-overflows)) use a closed interval `[lo, hi]`, in which `hi` is the last candidate. Neither convention is better. What matters is that the places that mention `hi` agree (`n` is `a.Length`):

| Line | Half-open | Closed |
|---|---|---|
| Interval | `[lo, hi)` | `[lo, hi]` |
| Start | `hi = n` | `hi = n - 1` |
| Loop | `lo < hi` | `lo <= hi` |
| Too big | `hi = mid` | `hi = mid - 1` |
| Too small | `lo = mid + 1` | `lo = mid + 1` |
| Empty | `lo == hi` | `lo == hi + 1` |

The buggy function took its start and loop condition from the left column and its too-big update from the right. Mixing them the other way round (`hi = a.Length` with `lo <= hi`) gives a different symptom: searching for anything larger than the last element reads `a[a.Length]` and throws `IndexOutOfRangeException`.

::::exercise[Trace it on paper first]
Using the corrected `Find` and the eleven departures, search for 700, which is not in the array. Write down each `mid` that gets probed, and the values of `lo` and `hi` when the loop ends. What does that final index tell you about 700?

:::solution
| `[lo, hi)` | `mid` | `a[mid]` | Update |
|---|---:|---:|---|
| `[0, 11)` | 5 | 560 | `lo = 6` |
| `[6, 11)` | 8 | 800 | `hi = 8` |
| `[6, 8)` | 7 | 710 | `hi = 7` |
| `[6, 7)` | 6 | 635 | `lo = 7` |

The loop ends with `lo == hi == 7`. Everything left of index 7 was found to be below 700 and everything from index 7 onward was found to be above it, so 7 is where 700 would have to be inserted to keep the array sorted. That by-product is the subject of the lower-bound section further down. This program prints the same trace:

```csharp run
int[] a =
[
    305, 350, 395, 440, 500, 560,
    635, 710, 800, 905, 990,
];
int target = 700, lo = 0, hi = a.Length;
while (lo < hi)
{
    int mid = lo + (hi - lo) / 2;
    Console.WriteLine($"[{lo}, {hi}) probe {mid}");
    if (a[mid] == target) break;
    if (a[mid] < target) lo = mid + 1;
    else hi = mid;
}
Console.WriteLine($"end: lo = {lo}, hi = {hi}");
```

```text output
[0, 11) probe 5
[6, 11) probe 8
[6, 8) probe 7
[6, 7) probe 6
end: lo = 7, hi = 7
```
:::
::::

## Why a million elements need twenty probes

Call the number of indexes in `[lo, hi)` the size *s* of the interval. A probe at `lo + s / 2` that does not hit the target leaves either the left part, with ⌊*s*/2⌋ elements, or the right part, with ⌈*s*/2⌉ − 1. The larger of the two is ⌊*s*/2⌋. So in the worst case the sizes run *n*, ⌊*n*/2⌋, ⌊*n*/4⌋, and so on, and the number of probes before the size reaches zero is ⌊log₂ *n*⌋ + 1. That makes binary search [O(log *n*)](/glossary/#big-o-notation) in the worst case, against O(*n*) for a linear scan. The best case is a single probe, when the target happens to be in the middle. Extra memory is O(1): two indexes and a midpoint.

The formula can be checked exactly rather than timed. The next program searches for every present value and every gap between values, and records the largest probe count it sees.

```csharp run
using System.Numerics;

int[] sizes = [11, 1_000, 1_000_000];
Console.WriteLine("      n  worst  formula");
foreach (int n in sizes)
{
    // Odd numbers: 1, 3, 5, ...
    int[] a = new int[n];
    for (int i = 0; i < n; i++)
        a[i] = 2 * i + 1;

    int worst = 0;
    for (int t = 0; t <= 2 * n; t++)
    {
        int p = Probes(a, t);
        worst = Math.Max(worst, p);
    }

    int formula =
        BitOperations.Log2((uint)n) + 1;
    Console.WriteLine(
        $"{n,7}  {worst,5}  {formula,7}");
}

static int Probes(int[] a, int target)
{
    int lo = 0, hi = a.Length;
    int probes = 0;
    while (lo < hi)
    {
        int mid = lo + (hi - lo) / 2;
        probes++;
        if (a[mid] == target) break;
        if (a[mid] < target) lo = mid + 1;
        else hi = mid;
    }
    return probes;
}
```

```text output
      n  worst  formula
     11      4        4
   1000     10       10
1000000     20       20
```

The array holds odd numbers, so odd targets are present and even targets fall in the gaps. `BitOperations.Log2` returns the floor of the base-2 logarithm. Doubling the array adds one probe: a billion elements would need 30.

The logarithm depends on two preconditions. The data must be sorted by the same ordering the search compares with, and reading `a[mid]` must cost O(1). An array, a `List<T>` or a span qualifies. A linked list does not, because reaching the middle node is itself O(*n*).

## The midpoint that overflows

The first program computed `(lo + hi) / 2`. Both indexes are valid `int` values, but their sum need not be. In 2006 Joshua Bloch reported that `java.util.Arrays.binarySearch` had carried this bug for about nine years: once an array has more than 2³⁰ elements, `lo + hi` can exceed 2³¹ − 1 and wrap to a negative number.

His post quotes Bentley's remark that binary search was first published in 1946 and the first version correct for all *n* did not appear until 1962, and then notes that Bentley's own proven-correct version contained this overflow too. A proof about `lo` and `hi` does not catch it, because such a proof reasons about mathematical integers and the program runs on 32-bit ones.

C# behaves the same way as Java here. Integer arithmetic on non-constant values is unchecked unless the project turns on `CheckForOverflowUnderflow`, and in an unchecked context the result is truncated to 32 bits, so the sum wraps around. .NET arrays can be long enough for that to matter: `Array.MaxLength` (the first line of output below) is just under 2³¹, and a `byte[]` with 1.2 billion elements needs only about 1.2 GB. The arithmetic can be shown without allocating one:

```csharp run
int lo = 1_200_000_000;
int hi = 2_000_000_000;

int naive = (lo + hi) / 2;
int subtract = lo + (hi - lo) / 2;
int shift = (lo + hi) >>> 1;

int max = Array.MaxLength;
Console.WriteLine($"max      {max}");
Console.WriteLine($"naive    {naive}");
Console.WriteLine($"subtract {subtract}");
Console.WriteLine($"shift    {shift}");

try
{
    int mid = checked((lo + hi) / 2);
    Console.WriteLine(mid);
}
catch (OverflowException e)
{
    string name = e.GetType().Name;
    Console.WriteLine($"checked  {name}");
}
```

```text output
max      2147483591
naive    -547483648
subtract 1600000000
shift    1600000000
checked  OverflowException
```

With the naive midpoint, the next line of the search would be `a[-547483648]` and an `IndexOutOfRangeException` from code that passed every test on small arrays. There are two standard repairs:

- `lo + (hi - lo) / 2` never forms a number larger than `hi`. It is correct whenever `lo <= hi` and the difference fits in the type, which is always true for array indexes. Use this one by default.
- `(lo + hi) >>> 1` lets the sum wrap and then reinterprets it. The unsigned right shift `>>>` fills the top bit with zero regardless of sign, which recovers the right answer as long as the true sum is below 2³². It is correct only for non-negative operands.

:::dotnet
The runtime uses both. The array search helpers in `ArraySortHelper.cs` compute `lo + ((hi - lo) >> 1)`. The span version in `SpanHelpers.BinarySearch.cs` computes `(int)(((uint)hi + (uint)lo) >> 1)`, with a comment explaining that the indexes are never negative there and the unsigned form saves a subtraction per iteration. These are implementation details of the current source, not documented behavior.
:::

Overflow stops being exotic the moment `lo` and `hi` are *values* instead of indexes, as in the [last technique on this page](#searching-a-range-of-answers-instead-of-an-array), where a bound of two billion is an ordinary input.

## First, last, and how many: lower bound and upper bound

`Find` stops at whichever match it lands on. With duplicates that is rarely the question. Here are the delays, in minutes, of eleven buses, sorted:

```text
index   0  1  2  3  4  5  6  7  8  9  10
delay   0  0  1  2  2  2  2  4  6  6   9
```

"How many buses were exactly 2 minutes late?" needs the first and last 2. "How many were at least 4 minutes late?" has no target to find at all if nobody was late by exactly 4. Both are answered by the **lower bound**: the first index whose element is greater than or equal to the target, or `a.Length` if there is none. The **upper bound** is the same with "strictly greater than".

The invariant changes shape. Instead of one promise about where the target might be, it makes two promises about what is already known:

> Every element left of `lo` is less than the target. Every element at `hi` or beyond is greater than or equal to it.

The cells in between are the unknown region, and each probe moves one boundary to shrink it (Figure 2). There is no early return, because finding *a* 2 says nothing about whether it is the *first* 2.

<figure class="diagram">
<svg viewBox="0 0 360 456" role="img" aria-labelledby="lb-title lb-desc">
<title id="lb-title">Lower bound of 2 in a sorted array with duplicates</title>
<desc id="lb-desc">Five rows show the array 0 0 1 2 2 2 2 4 6 6 9. Cells left of lo are known to be below 2, cells from hi onward are known to be 2 or more, and the cells between are unknown. The unknown region shrinks from all eleven cells to none, with lo and hi meeting at index 3.</desc>
<rect x="15" y="10" width="14" height="14" class="d-box"/><text x="35" y="22" class="d-small">below 2</text>
<rect x="105" y="10" width="14" height="14" class="d-box-accent"/><text x="125" y="22" class="d-small">unknown</text>
<rect x="205" y="10" width="14" height="14" class="d-box-good"/><text x="225" y="22" class="d-small">2 or more</text>
<text x="30" y="48" text-anchor="middle" class="d-small d-muted">0</text>
<text x="60" y="48" text-anchor="middle" class="d-small d-muted">1</text>
<text x="90" y="48" text-anchor="middle" class="d-small d-muted">2</text>
<text x="120" y="48" text-anchor="middle" class="d-small d-muted">3</text>
<text x="150" y="48" text-anchor="middle" class="d-small d-muted">4</text>
<text x="180" y="48" text-anchor="middle" class="d-small d-muted">5</text>
<text x="210" y="48" text-anchor="middle" class="d-small d-muted">6</text>
<text x="240" y="48" text-anchor="middle" class="d-small d-muted">7</text>
<text x="270" y="48" text-anchor="middle" class="d-small d-muted">8</text>
<text x="300" y="48" text-anchor="middle" class="d-small d-muted">9</text>
<text x="330" y="48" text-anchor="middle" class="d-small d-muted">10</text>
<rect x="15" y="56" width="30" height="30" class="d-box-accent"/><text x="30" y="76" text-anchor="middle" class="d-mono d-small">0</text>
<rect x="45" y="56" width="30" height="30" class="d-box-accent"/><text x="60" y="76" text-anchor="middle" class="d-mono d-small">0</text>
<rect x="75" y="56" width="30" height="30" class="d-box-accent"/><text x="90" y="76" text-anchor="middle" class="d-mono d-small">1</text>
<rect x="105" y="56" width="30" height="30" class="d-box-accent"/><text x="120" y="76" text-anchor="middle" class="d-mono d-small">2</text>
<rect x="135" y="56" width="30" height="30" class="d-box-accent"/><text x="150" y="76" text-anchor="middle" class="d-mono d-small">2</text>
<rect x="165" y="56" width="30" height="30" class="d-box-accent"/><text x="180" y="76" text-anchor="middle" class="d-mono d-small d-bold">2</text>
<rect x="195" y="56" width="30" height="30" class="d-box-accent"/><text x="210" y="76" text-anchor="middle" class="d-mono d-small">2</text>
<rect x="225" y="56" width="30" height="30" class="d-box-accent"/><text x="240" y="76" text-anchor="middle" class="d-mono d-small">4</text>
<rect x="255" y="56" width="30" height="30" class="d-box-accent"/><text x="270" y="76" text-anchor="middle" class="d-mono d-small">6</text>
<rect x="285" y="56" width="30" height="30" class="d-box-accent"/><text x="300" y="76" text-anchor="middle" class="d-mono d-small">6</text>
<rect x="315" y="56" width="30" height="30" class="d-box-accent"/><text x="330" y="76" text-anchor="middle" class="d-mono d-small">9</text>
<path d="M169 82 h22" class="d-line"/>
<text x="15" y="100" text-anchor="middle" class="d-small d-bold">lo</text>
<text x="345" y="100" text-anchor="middle" class="d-small d-bold">hi</text>
<text x="15" y="118" class="d-small d-muted">probe a[5] = 2: not below 2, so hi = 5</text>
<rect x="15" y="138" width="30" height="30" class="d-box-accent"/><text x="30" y="158" text-anchor="middle" class="d-mono d-small">0</text>
<rect x="45" y="138" width="30" height="30" class="d-box-accent"/><text x="60" y="158" text-anchor="middle" class="d-mono d-small">0</text>
<rect x="75" y="138" width="30" height="30" class="d-box-accent"/><text x="90" y="158" text-anchor="middle" class="d-mono d-small d-bold">1</text>
<rect x="105" y="138" width="30" height="30" class="d-box-accent"/><text x="120" y="158" text-anchor="middle" class="d-mono d-small">2</text>
<rect x="135" y="138" width="30" height="30" class="d-box-accent"/><text x="150" y="158" text-anchor="middle" class="d-mono d-small">2</text>
<rect x="165" y="138" width="30" height="30" class="d-box-good"/><text x="180" y="158" text-anchor="middle" class="d-mono d-small">2</text>
<rect x="195" y="138" width="30" height="30" class="d-box-good"/><text x="210" y="158" text-anchor="middle" class="d-mono d-small">2</text>
<rect x="225" y="138" width="30" height="30" class="d-box-good"/><text x="240" y="158" text-anchor="middle" class="d-mono d-small">4</text>
<rect x="255" y="138" width="30" height="30" class="d-box-good"/><text x="270" y="158" text-anchor="middle" class="d-mono d-small">6</text>
<rect x="285" y="138" width="30" height="30" class="d-box-good"/><text x="300" y="158" text-anchor="middle" class="d-mono d-small">6</text>
<rect x="315" y="138" width="30" height="30" class="d-box-good"/><text x="330" y="158" text-anchor="middle" class="d-mono d-small">9</text>
<path d="M79 164 h22" class="d-line"/>
<text x="15" y="182" text-anchor="middle" class="d-small d-bold">lo</text>
<text x="165" y="182" text-anchor="middle" class="d-small d-bold">hi</text>
<text x="15" y="200" class="d-small d-muted">probe a[2] = 1: below 2, so lo = 3</text>
<rect x="15" y="220" width="30" height="30" class="d-box"/><text x="30" y="240" text-anchor="middle" class="d-mono d-small">0</text>
<rect x="45" y="220" width="30" height="30" class="d-box"/><text x="60" y="240" text-anchor="middle" class="d-mono d-small">0</text>
<rect x="75" y="220" width="30" height="30" class="d-box"/><text x="90" y="240" text-anchor="middle" class="d-mono d-small">1</text>
<rect x="105" y="220" width="30" height="30" class="d-box-accent"/><text x="120" y="240" text-anchor="middle" class="d-mono d-small">2</text>
<rect x="135" y="220" width="30" height="30" class="d-box-accent"/><text x="150" y="240" text-anchor="middle" class="d-mono d-small d-bold">2</text>
<rect x="165" y="220" width="30" height="30" class="d-box-good"/><text x="180" y="240" text-anchor="middle" class="d-mono d-small">2</text>
<rect x="195" y="220" width="30" height="30" class="d-box-good"/><text x="210" y="240" text-anchor="middle" class="d-mono d-small">2</text>
<rect x="225" y="220" width="30" height="30" class="d-box-good"/><text x="240" y="240" text-anchor="middle" class="d-mono d-small">4</text>
<rect x="255" y="220" width="30" height="30" class="d-box-good"/><text x="270" y="240" text-anchor="middle" class="d-mono d-small">6</text>
<rect x="285" y="220" width="30" height="30" class="d-box-good"/><text x="300" y="240" text-anchor="middle" class="d-mono d-small">6</text>
<rect x="315" y="220" width="30" height="30" class="d-box-good"/><text x="330" y="240" text-anchor="middle" class="d-mono d-small">9</text>
<path d="M139 246 h22" class="d-line"/>
<text x="105" y="264" text-anchor="middle" class="d-small d-bold">lo</text>
<text x="165" y="264" text-anchor="middle" class="d-small d-bold">hi</text>
<text x="15" y="282" class="d-small d-muted">probe a[4] = 2: not below 2, so hi = 4</text>
<rect x="15" y="302" width="30" height="30" class="d-box"/><text x="30" y="322" text-anchor="middle" class="d-mono d-small">0</text>
<rect x="45" y="302" width="30" height="30" class="d-box"/><text x="60" y="322" text-anchor="middle" class="d-mono d-small">0</text>
<rect x="75" y="302" width="30" height="30" class="d-box"/><text x="90" y="322" text-anchor="middle" class="d-mono d-small">1</text>
<rect x="105" y="302" width="30" height="30" class="d-box-accent"/><text x="120" y="322" text-anchor="middle" class="d-mono d-small d-bold">2</text>
<rect x="135" y="302" width="30" height="30" class="d-box-good"/><text x="150" y="322" text-anchor="middle" class="d-mono d-small">2</text>
<rect x="165" y="302" width="30" height="30" class="d-box-good"/><text x="180" y="322" text-anchor="middle" class="d-mono d-small">2</text>
<rect x="195" y="302" width="30" height="30" class="d-box-good"/><text x="210" y="322" text-anchor="middle" class="d-mono d-small">2</text>
<rect x="225" y="302" width="30" height="30" class="d-box-good"/><text x="240" y="322" text-anchor="middle" class="d-mono d-small">4</text>
<rect x="255" y="302" width="30" height="30" class="d-box-good"/><text x="270" y="322" text-anchor="middle" class="d-mono d-small">6</text>
<rect x="285" y="302" width="30" height="30" class="d-box-good"/><text x="300" y="322" text-anchor="middle" class="d-mono d-small">6</text>
<rect x="315" y="302" width="30" height="30" class="d-box-good"/><text x="330" y="322" text-anchor="middle" class="d-mono d-small">9</text>
<path d="M109 328 h22" class="d-line"/>
<text x="105" y="346" text-anchor="middle" class="d-small d-bold">lo</text>
<text x="135" y="346" text-anchor="middle" class="d-small d-bold">hi</text>
<text x="15" y="364" class="d-small d-muted">probe a[3] = 2: not below 2, so hi = 3</text>
<rect x="15" y="384" width="30" height="30" class="d-box"/><text x="30" y="404" text-anchor="middle" class="d-mono d-small">0</text>
<rect x="45" y="384" width="30" height="30" class="d-box"/><text x="60" y="404" text-anchor="middle" class="d-mono d-small">0</text>
<rect x="75" y="384" width="30" height="30" class="d-box"/><text x="90" y="404" text-anchor="middle" class="d-mono d-small">1</text>
<rect x="105" y="384" width="30" height="30" class="d-box-good"/><text x="120" y="404" text-anchor="middle" class="d-mono d-small">2</text>
<rect x="135" y="384" width="30" height="30" class="d-box-good"/><text x="150" y="404" text-anchor="middle" class="d-mono d-small">2</text>
<rect x="165" y="384" width="30" height="30" class="d-box-good"/><text x="180" y="404" text-anchor="middle" class="d-mono d-small">2</text>
<rect x="195" y="384" width="30" height="30" class="d-box-good"/><text x="210" y="404" text-anchor="middle" class="d-mono d-small">2</text>
<rect x="225" y="384" width="30" height="30" class="d-box-good"/><text x="240" y="404" text-anchor="middle" class="d-mono d-small">4</text>
<rect x="255" y="384" width="30" height="30" class="d-box-good"/><text x="270" y="404" text-anchor="middle" class="d-mono d-small">6</text>
<rect x="285" y="384" width="30" height="30" class="d-box-good"/><text x="300" y="404" text-anchor="middle" class="d-mono d-small">6</text>
<rect x="315" y="384" width="30" height="30" class="d-box-good"/><text x="330" y="404" text-anchor="middle" class="d-mono d-small">9</text>
<text x="105" y="428" text-anchor="middle" class="d-small d-bold">lo = hi</text>
<text x="15" y="446" class="d-small d-muted">lo = hi = 3: the first index holding 2 or more</text>
</svg>
<figcaption>Figure 2. Lower bound of 2. Every cell left of <code>lo</code> is known to be below the target and every cell from <code>hi</code> onward is known not to be; the underlined probe moves one boundary each step. When the unknown region is empty the two boundaries are the same index, and that index is the answer.</figcaption>
</figure>

```csharp run id=bounds
int[] delays =
    [0, 0, 1, 2, 2, 2, 2, 4, 6, 6, 9];

int first = LowerBound(delays, 2);
int after = UpperBound(delays, 2);
int count = after - first;
Console.WriteLine($"first 2 at  {first}");
Console.WriteLine($"past 2s at  {after}");
Console.WriteLine($"exactly 2:  {count}");

int from4 = LowerBound(delays, 4);
int late = delays.Length - from4;
Console.WriteLine($"4 or more:  {late}");

int lb5 = LowerBound(delays, 5);
int lb10 = LowerBound(delays, 10);
Console.WriteLine($"bound of 5: {lb5}");
Console.WriteLine($"bound of 10: {lb10}");

static int LowerBound(int[] a, int target)
{
    int lo = 0, hi = a.Length;
    while (lo < hi)
    {
        int mid = lo + (hi - lo) / 2;
        if (a[mid] < target) lo = mid + 1;
        else hi = mid;
    }
    return lo;
}

static int UpperBound(int[] a, int target)
{
    int lo = 0, hi = a.Length;
    while (lo < hi)
    {
        int mid = lo + (hi - lo) / 2;
        if (a[mid] <= target) lo = mid + 1;
        else hi = mid;
    }
    return lo;
}
```

```text output
first 2 at  3
past 2s at  7
exactly 2:  4
4 or more:  4
bound of 5: 8
bound of 10: 11
```

The two functions differ in one character, `<` against `<=`. Both run the full ⌊log₂ *n*⌋ + 1 iterations or one fewer, since they never stop early, and both make one element comparison per iteration where `Find` makes up to two. A lower bound also subsumes `Find`: the target is present exactly when `i < a.Length && a[i] == target` for `i = LowerBound(a, target)`. When the target is absent, lower and upper bound are equal and give its insertion point, which is what the trace for 700 found by accident.

::::exercise[The loop that never returns]
This function is meant to return the index of the last departure at or before time `t`, for the bus you have just missed. It assumes `a[0] <= t`, and it passes the check shown. For which inputs does it never return, and why? Fix it.

```csharp run
int[] three = [350, 395, 440];
int i = LastAtOrBefore(three, 360);
Console.WriteLine(i);

static int LastAtOrBefore(
    int[] a, int t)
{
    int lo = 0, hi = a.Length - 1;
    while (lo < hi)
    {
        int mid =
            lo + (hi - lo) / 2;
        if (a[mid] <= t) lo = mid;
        else hi = mid - 1;
    }
    return lo;
}
```

```text output
0
```

:::solution
This is bug two. The termination argument needs every branch to shrink the interval, and `lo = mid` does not when `mid == lo`. Integer division rounds down, so `mid == lo` whenever `hi == lo + 1`. If `a[lo] <= t` at that moment, the loop assigns `lo = lo` and spins. The program below adds a step counter to the function so the hang becomes an exception; searching two departures for 400 is enough to trigger it.

One repair keeps the structure and rounds the midpoint *up*, `lo + (hi - lo + 1) / 2`, so that `mid > lo` and `lo = mid` makes progress. The better repair is to stop inventing variants: the last element at or before `t` is the one just left of the upper bound.

```csharp run
int[] two = [350, 395];
try
{
    Console.WriteLine(LastAtOrBefore(two, 400));
}
catch (InvalidOperationException e)
{
    Console.WriteLine(e.Message);
}
Console.WriteLine(UpperBound(two, 400) - 1);

static int LastAtOrBefore(int[] a, int t)
{
    int lo = 0, hi = a.Length - 1;
    int steps = 0;
    while (lo < hi)
    {
        if (++steps > 64)
            throw new InvalidOperationException(
                $"stuck at lo = {lo}, hi = {hi}");
        int mid = lo + (hi - lo) / 2;
        if (a[mid] <= t) lo = mid;
        else hi = mid - 1;
    }
    return lo;
}

static int UpperBound(int[] a, int target)
{
    int lo = 0, hi = a.Length;
    while (lo < hi)
    {
        int mid = lo + (hi - lo) / 2;
        if (a[mid] <= target) lo = mid + 1;
        else hi = mid;
    }
    return lo;
}
```

```text output
stuck at lo = 0, hi = 1
1
```

`UpperBound(a, t) - 1` also handles the case the original had to assume away: when every departure is after `t` it returns -1.
:::
::::

::::exercise[Count a time window]
Using only `LowerBound`, write `CountBetween(a, from, to)` that returns how many departures fall in the closed window from `from` to `to`, in O(log *n*). Check it on the eleven departures with the windows 440 to 710, 441 to 499, and 0 to 2000.

:::solution
Departures are whole minutes, so "at most `to`" is the same as "below `to + 1`", and the count is the distance between two lower bounds. (For a type with no successor, such as `double` or `string`, use `UpperBound(a, to)` instead.)

```csharp run
int[] departures =
[
    305, 350, 395, 440, 500, 560,
    635, 710, 800, 905, 990,
];

Console.WriteLine(CountBetween(departures, 440, 710));
Console.WriteLine(CountBetween(departures, 441, 499));
Console.WriteLine(CountBetween(departures, 0, 2000));

static int CountBetween(int[] a, int from, int to) =>
    LowerBound(a, to + 1) - LowerBound(a, from);

static int LowerBound(int[] a, int target)
{
    int lo = 0, hi = a.Length;
    while (lo < hi)
    {
        int mid = lo + (hi - lo) / 2;
        if (a[mid] < target) lo = mid + 1;
        else hi = mid;
    }
    return lo;
}
```

```text output
5
0
11
```

`to + 1` overflows if `to` is `int.MaxValue`; a library version would use `UpperBound` for that reason too.
:::
::::

## What Array.BinarySearch tells you with a negative number

The base class library has binary search built in: `Array.BinarySearch`, `List<T>.BinarySearch`, and `BinarySearch` extension methods on spans. They are documented as O(log *n*) and they require the input to be sorted already. Their return value packs two answers into one `int`.

```csharp run id=bcl
int[] departures =
[
    305, 350, 395, 440, 500, 560,
    635, 710, 800, 905, 990,
];

int[] targets = [560, 300, 600, 2000];
Console.WriteLine("target  result  ~result");
foreach (int t in targets)
{
    int r = Array.BinarySearch(
        departures, t);
    string flip = r < 0 ? $"{~r}" : "";
    Console.WriteLine(
        $"{t,6}  {r,6}  {flip,7}");
}

List<int> timetable = [.. departures];
int at = timetable.BinarySearch(600);
if (at < 0) timetable.Insert(~at, 600);
Console.WriteLine(
    string.Join(' ', timetable[5..8]));
```

```text output
target  result  ~result
   560       5
   300      -1        0
   600      -7        6
  2000     -12       11
560 600 635
```

A non-negative result is the index of a match. A negative result means "not found", and the documentation defines it as the bitwise complement of the index of the first element larger than the value, or of the array's length if there is none. The `~` operator flips every bit of its operand, and in two's complement that works out to `~x == -x - 1`. Applying `~` a second time undoes it, so `~result` is the insertion point: exactly the lower bound from the previous section. The last lines of the program use it to insert 600 where it belongs.

Why the complement and not simply `-index`? Because of index 0:

| Insert at | As `-index` | As `~index` |
|---:|---:|---:|
| 0 | 0 | -1 |
| 6 | -6 | -7 |
| 11 | -11 | -12 |

Negating 0 gives 0, which already means "found at index 0". The complement maps every insertion point from 0 upward to a distinct negative number, so the sign alone separates the two cases. The runtime gets the value for free: its closed-interval loop ends with `lo` at the insertion point, and the method returns `~lo`.

:::pitfall
Test the result with `>= 0`. Writing `> 0` reports a match at index 0 as missing. Writing `!= -1` reports every absent value as found, unless its insertion point happens to be 0.
:::

Two more documented behaviors follow from the algorithm and are worth seeing once:

```csharp run
int[] delays =
    [0, 0, 1, 2, 2, 2, 2, 4, 6, 6, 9];
int some2 = Array.BinarySearch(delays, 2);
Console.WriteLine(some2);

int[] unsorted = [560, 305, 990, 350];
int r = Array.BinarySearch(unsorted, 560);
Console.WriteLine(r);
```

```text output
5
-3
```

With duplicates, the method "returns the index of only one of the occurrences, and not necessarily the first one". Here it returns 5, the first probe, while the first 2 is at index 3. Which occurrence you get depends on the array's length and is not something to rely on; when you need the first or the last, write a lower or upper bound.

The second call searches an unsorted array for a value that is plainly there at index 0. There is no exception and no check. The method follows its comparisons to a wrong answer, which is the only thing an O(log *n*) algorithm can do, since verifying sortedness would cost O(*n*).

## Searching a range of answers instead of an array

Strip the array out of `LowerBound` and what remains is a search for the boundary in a sequence of answers that goes false, false, …, true, true. Any yes/no question over a range of integers works, provided that once the answer becomes yes it stays yes. Such a predicate is called **monotonic**. This is usually named *binary search on the answer*: instead of looking for a value in data, you search the space of possible answers for the smallest one that passes a test.

An example. A gallery page stores uncompressed RGBA thumbnails of six photos in a cache with an 8 MB budget. All thumbnails share one width, heights follow each photo's aspect ratio, and the goal is the largest width that fits. Total bytes only grow as the width grows, so "is this width too big?" is monotonic: false up to some width and true from then on. The answer is one less than the first width that is too big.

```csharp run id=thumbs
(int W, int H)[] photos =
[
    (4032, 3024), (3024, 4032),
    (6000, 4000), (1920, 1080),
    (2048, 2048), (5472, 3648),
];
const long Budget = 8_000_000;

long BytesAt(long width)
{
    long total = 0;
    foreach (var (w, h) in photos)
    {
        // Height, rounded up.
        long height =
            (width * h + w - 1) / w;
        total += width * height * 4;
    }
    return total;
}

int calls = 0;
bool TooBig(long width)
{
    calls++;
    return BytesAt(width) > Budget;
}

// The narrowest photo is 1920 wide,
// and thumbnails are never upscaled.
long firstTooBig =
    FirstTrue(1, 1921, TooBig);
long best = firstTooBig - 1;
long fits = BytesAt(best);
long over = BytesAt(best + 1);
Console.WriteLine($"best width   {best}");
Console.WriteLine($"bytes        {fits}");
Console.WriteLine($"one wider    {over}");
Console.WriteLine($"calls        {calls}");

long scan = 1;
while (scan <= 1920
       && BytesAt(scan) <= Budget)
    scan++;
bool agrees = scan == firstTooBig;
Console.WriteLine($"scan agrees  {agrees}");

// pred: false below the result,
// true from it onward. Returns hi
// if pred is false on all of [lo, hi).
static long FirstTrue(
    long lo, long hi,
    Func<long, bool> pred)
{
    while (lo < hi)
    {
        long mid = lo + (hi - lo) / 2;
        if (pred(mid)) hi = mid;
        else lo = mid + 1;
    }
    return lo;
}
```

```text output
best width   633
bytes        7983396
one wider    8011224
calls        11
scan agrees  True
```

`FirstTrue` is `LowerBound` with the comparison replaced by a call. The invariant is the same pair of promises: the predicate is false on everything below `lo` and true on everything from `hi` up. Search the range 0 to `a.Length` with the predicate `i => a[i] >= target` and `FirstTrue` *is* `LowerBound`. With *R* candidate answers and a predicate that costs *P*, the search costs O(*P* log *R*). Here *R* is 1,920 and each call walks six photos, so a handful of calls replace up to 1,920. The linear scan at the end is the brute-force oracle again, affordable here because the range is small.

Three things can go wrong with this technique, and none of them is inside the loop:

- **The predicate is not monotonic.** Then the search returns *some* boundary between a false and a true, with no error. Before using the technique, state in one sentence why a yes can never be followed by a no. Here: widening every thumbnail cannot make the total smaller.
- **The range does not bracket the answer.** `FirstTrue` returns `hi` when nothing in the range is true, and `lo` when everything is. Both are correct, and both need handling by the caller: `best` would be 1,920 (everything fits) or 0 (nothing does).
- **The arithmetic overflows.** Bounds are now values, and a predicate often multiplies them. `BytesAt` uses `long` throughout for that reason.

::::exercise[An integer square root, and where it overflows]
Use `FirstTrue` to compute the integer square root of a non-negative `long` *n*: the largest *x* with *x*² ≤ *n*. The obvious predicate is `x => x * x > n` over the range 1 to `long.MaxValue`. Find out what that returns for *n* = 1,000,000, explain it, and write a version that is correct for every *n* up to `long.MaxValue`.

:::solution
The first midpoint is about 4.6 × 10¹⁸, and squaring it overflows `long`. In an unchecked context the product wraps to an arbitrary value, the predicate's answers stop being monotonic, and the search converges on a meaningless boundary.

Two changes fix it. Compare by division, `x > n / x`, which is equivalent to *x*² > *n* for positive integers and cannot overflow. And bound the range by the largest possible answer: the square root of `long.MaxValue` is 3,037,000,499 and a fraction, so an exclusive upper bound of 3,037,000,500 brackets every case.

```csharp run
Console.WriteLine($"naive  {IsqrtNaive(1_000_000)}");
Console.WriteLine($"safe   {Isqrt(1_000_000)}");
Console.WriteLine($"safe   {Isqrt(999_999)}");
Console.WriteLine($"safe   {Isqrt(0)}");
Console.WriteLine($"safe   {Isqrt(long.MaxValue)}");

static long IsqrtNaive(long n) =>
    FirstTrue(1, long.MaxValue, x => x * x > n) - 1;

static long Isqrt(long n) =>
    FirstTrue(1, 3_037_000_500, x => x > n / x) - 1;

static long FirstTrue(
    long lo, long hi,
    Func<long, bool> pred)
{
    while (lo < hi)
    {
        long mid = lo + (hi - lo) / 2;
        if (pred(mid)) hi = mid;
        else lo = mid + 1;
    }
    return lo;
}
```

```text output
naive  9223372033817775308
safe   1000
safe   999
safe   0
safe   3037000499
```
:::
::::

## When binary search is the wrong tool

Binary search buys O(log *n*) lookups, and the price is keeping data sorted in a random-access structure. Whether that is a good trade depends on what else happens to the data.

- **The data is not sorted and you need one lookup.** A comparison sort costs O(*n* log *n*) (CLRS, chapter 2, for merge sort), more than the O(*n*) linear scan it would replace. Sorting first pays for itself only when it is followed by enough searches.
- **You only ever ask "is this exact key present?"** A hash table answers that in expected O(1); the `Dictionary<TKey,TValue>` documentation describes retrieval as "close to O(1)", depending on the quality of the key's hash function. What a hash table cannot do is anything in this article's second half: nearest value, range counts, insertion points. Those need order.
- **The collection changes all the time.** Finding the insertion point in a sorted `List<T>` is O(log *n*), but `List<T>.Insert` is documented as O(*n*) because the elements after it shift. A balanced binary search tree, such as a red-black tree (CLRS, chapter 13), makes both search and insertion O(log *n*) at the cost of a pointer-chasing layout.
- **The array is tiny.** For a dozen elements the difference between 4 probes and an average of 6 is not worth a line of reasoning. Use whichever is clearer.

When binary search does fit, prefer the library method for plain membership and insertion points, and write a lower or upper bound yourself when duplicates or ranges matter. Either way, write the invariant as a comment above the loop, and test against a linear scan over every small case. The missed values and the endless loop on this page both survive spot checks and both fall to that exhaustive comparison. The overflow survives even that, because no small test reaches it, which is why the midpoint is worth writing the safe way out of habit.
