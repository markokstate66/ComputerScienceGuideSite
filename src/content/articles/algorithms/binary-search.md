---
title: "Binary Search and the Three Bugs It Invites"
description: "A binary search that passes its spot checks still misses 4 of 11 values. Fix it with a loop invariant, then meet midpoint overflow, lower bound and ~index."
pillar: algorithms
order: 1
author: markus
published: 2026-09-21
updated: 2026-09-21
level: intermediate
tags: [binary-search, searching, loop-invariants, big-o]
prerequisites: ["complexity/big-o-notation"]
sources:
  - title: "Array.BinarySearch Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.array.binarysearch"
    publisher: "Microsoft Learn"
    accessed: 2026-09-21
  - title: "List<T>.BinarySearch Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.list-1.binarysearch"
    publisher: "Microsoft Learn"
    accessed: 2026-09-21
  - title: "ArraySortHelper.cs (InternalBinarySearch)"
    url: "https://github.com/dotnet/runtime/blob/main/src/libraries/System.Private.CoreLib/src/System/Collections/Generic/ArraySortHelper.cs"
    publisher: "dotnet/runtime on GitHub"
    accessed: 2026-09-21
  - title: "SpanHelpers.BinarySearch.cs"
    url: "https://github.com/dotnet/runtime/blob/main/src/libraries/System.Private.CoreLib/src/System/SpanHelpers.BinarySearch.cs"
    publisher: "dotnet/runtime on GitHub"
    accessed: 2026-09-21
  - title: "Extra, Extra - Read All About It: Nearly All Binary Searches and Mergesorts are Broken"
    url: "https://research.google/blog/extra-extra-read-all-about-it-nearly-all-binary-searches-and-mergesorts-are-broken/"
    publisher: "Google Research (Joshua Bloch)"
    accessed: 2026-09-21
  - title: "The checked and unchecked statements"
    url: "https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/statements/checked-and-unchecked"
    publisher: "Microsoft Learn"
    accessed: 2026-09-21
  - title: "Bitwise and shift operators"
    url: "https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/operators/bitwise-and-shift-operators"
    publisher: "Microsoft Learn"
    accessed: 2026-09-21
  - title: "MemoryExtensions.BinarySearch Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.memoryextensions.binarysearch"
    publisher: "Microsoft Learn"
    accessed: 2026-09-21
  - title: "Unsigned Right Shift Operator (C# 11 proposal)"
    url: "https://github.com/dotnet/csharplang/blob/main/proposals/csharp-11.0/unsigned-right-shift-operator.md"
    publisher: "dotnet/csharplang on GitHub"
    accessed: 2026-09-21
  - title: "Array.MaxLength Property"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.array.maxlength"
    publisher: "Microsoft Learn"
    accessed: 2026-09-21
  - title: "List<T>.Insert(Int32, T) Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.list-1.insert"
    publisher: "Microsoft Learn"
    accessed: 2026-09-21
  - title: "Dictionary<TKey,TValue> Class"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.dictionary-2"
    publisher: "Microsoft Learn"
    accessed: 2026-09-21
  - title: "Programming Pearls, 2nd ed., column 4: Writing Correct Programs"
    url: "https://www.pearson.com/en-us/subject-catalog/p/programming-pearls/P200000000629"
    publisher: "Addison-Wesley (Jon Bentley)"
    accessed: 2026-09-18
  - title: "Introduction to Algorithms, 4th ed., chapters 2, 8 and 13"
    url: "https://mitpress.mit.edu/9780262046305/introduction-to-algorithms/"
    publisher: "MIT Press"
    accessed: 2026-09-18
draft: false
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
        if (a[mid] == target)
            return mid;
        if (a[mid] < target)
            lo = mid + 1;
        else
            hi = mid - 1;
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
        if (a[mid] == target)
            return mid;
        if (a[mid] < target)
            lo = mid + 1;
        else
            hi = mid - 1;
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
<svg viewBox="0 0 360 420" role="img" aria-labelledby="miss-title miss-desc">
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
<rect x="165" y="34" width="30" height="30" class="d-box"/><text x="180" y="54" text-anchor="middle" class="d-mono d-small d-bold">560</text>
<rect x="195" y="34" width="30" height="30" class="d-box"/><text x="210" y="54" text-anchor="middle" class="d-mono d-small">635</text>
<rect x="225" y="34" width="30" height="30" class="d-box"/><text x="240" y="54" text-anchor="middle" class="d-mono d-small">710</text>
<rect x="255" y="34" width="30" height="30" class="d-box"/><text x="270" y="54" text-anchor="middle" class="d-mono d-small">800</text>
<rect x="285" y="34" width="30" height="30" class="d-box"/><text x="300" y="54" text-anchor="middle" class="d-mono d-small">905</text>
<rect x="315" y="34" width="30" height="30" class="d-box"/><text x="330" y="54" text-anchor="middle" class="d-mono d-small">990</text>
<path d="M180 68 l-5 8 h10z" class="d-fill-stroke"/>
<text x="15" y="92" class="d-small">[0, 11): probe a[5] = 560, too big</text>
<text x="15" y="108" class="d-small d-text-bad">hi = 5 - 1 = 4 throws out index 4 unseen</text>
<rect x="15" y="128" width="30" height="30" class="d-box"/><text x="30" y="148" text-anchor="middle" class="d-mono d-small">305</text>
<rect x="45" y="128" width="30" height="30" class="d-box"/><text x="60" y="148" text-anchor="middle" class="d-mono d-small">350</text>
<rect x="75" y="128" width="30" height="30" class="d-box"/><text x="90" y="148" text-anchor="middle" class="d-mono d-small d-bold">395</text>
<rect x="105" y="128" width="30" height="30" class="d-box"/><text x="120" y="148" text-anchor="middle" class="d-mono d-small">440</text>
<rect x="135" y="128" width="30" height="30" class="d-box-bad"/><text x="150" y="148" text-anchor="middle" class="d-mono d-small d-text-bad d-bold">500</text>
<rect x="165" y="128" width="30" height="30" class="d-box-2 d-dashed"/><text x="180" y="148" text-anchor="middle" class="d-mono d-small d-muted">560</text>
<rect x="195" y="128" width="30" height="30" class="d-box-2 d-dashed"/><text x="210" y="148" text-anchor="middle" class="d-mono d-small d-muted">635</text>
<rect x="225" y="128" width="30" height="30" class="d-box-2 d-dashed"/><text x="240" y="148" text-anchor="middle" class="d-mono d-small d-muted">710</text>
<rect x="255" y="128" width="30" height="30" class="d-box-2 d-dashed"/><text x="270" y="148" text-anchor="middle" class="d-mono d-small d-muted">800</text>
<rect x="285" y="128" width="30" height="30" class="d-box-2 d-dashed"/><text x="300" y="148" text-anchor="middle" class="d-mono d-small d-muted">905</text>
<rect x="315" y="128" width="30" height="30" class="d-box-2 d-dashed"/><text x="330" y="148" text-anchor="middle" class="d-mono d-small d-muted">990</text>
<path d="M90 162 l-5 8 h10z" class="d-fill-stroke"/>
<text x="15" y="186" class="d-small">[0, 4): probe a[2] = 395, too small</text>
<text x="15" y="202" class="d-small d-muted">lo = 2 + 1 = 3</text>
<rect x="15" y="222" width="30" height="30" class="d-box-2 d-dashed"/><text x="30" y="242" text-anchor="middle" class="d-mono d-small d-muted">305</text>
<rect x="45" y="222" width="30" height="30" class="d-box-2 d-dashed"/><text x="60" y="242" text-anchor="middle" class="d-mono d-small d-muted">350</text>
<rect x="75" y="222" width="30" height="30" class="d-box-2 d-dashed"/><text x="90" y="242" text-anchor="middle" class="d-mono d-small d-muted">395</text>
<rect x="105" y="222" width="30" height="30" class="d-box"/><text x="120" y="242" text-anchor="middle" class="d-mono d-small d-bold">440</text>
<rect x="135" y="222" width="30" height="30" class="d-box-bad"/><text x="150" y="242" text-anchor="middle" class="d-mono d-small d-text-bad d-bold">500</text>
<rect x="165" y="222" width="30" height="30" class="d-box-2 d-dashed"/><text x="180" y="242" text-anchor="middle" class="d-mono d-small d-muted">560</text>
<rect x="195" y="222" width="30" height="30" class="d-box-2 d-dashed"/><text x="210" y="242" text-anchor="middle" class="d-mono d-small d-muted">635</text>
<rect x="225" y="222" width="30" height="30" class="d-box-2 d-dashed"/><text x="240" y="242" text-anchor="middle" class="d-mono d-small d-muted">710</text>
<rect x="255" y="222" width="30" height="30" class="d-box-2 d-dashed"/><text x="270" y="242" text-anchor="middle" class="d-mono d-small d-muted">800</text>
<rect x="285" y="222" width="30" height="30" class="d-box-2 d-dashed"/><text x="300" y="242" text-anchor="middle" class="d-mono d-small d-muted">905</text>
<rect x="315" y="222" width="30" height="30" class="d-box-2 d-dashed"/><text x="330" y="242" text-anchor="middle" class="d-mono d-small d-muted">990</text>
<path d="M120 256 l-5 8 h10z" class="d-fill-stroke"/>
<text x="15" y="280" class="d-small">[3, 4): probe a[3] = 440, too small</text>
<text x="15" y="296" class="d-small d-muted">lo = 3 + 1 = 4</text>
<rect x="15" y="316" width="30" height="30" class="d-box-2 d-dashed"/><text x="30" y="336" text-anchor="middle" class="d-mono d-small d-muted">305</text>
<rect x="45" y="316" width="30" height="30" class="d-box-2 d-dashed"/><text x="60" y="336" text-anchor="middle" class="d-mono d-small d-muted">350</text>
<rect x="75" y="316" width="30" height="30" class="d-box-2 d-dashed"/><text x="90" y="336" text-anchor="middle" class="d-mono d-small d-muted">395</text>
<rect x="105" y="316" width="30" height="30" class="d-box-2 d-dashed"/><text x="120" y="336" text-anchor="middle" class="d-mono d-small d-muted">440</text>
<rect x="135" y="316" width="30" height="30" class="d-box-bad"/><text x="150" y="336" text-anchor="middle" class="d-mono d-small d-text-bad d-bold">500</text>
<rect x="165" y="316" width="30" height="30" class="d-box-2 d-dashed"/><text x="180" y="336" text-anchor="middle" class="d-mono d-small d-muted">560</text>
<rect x="195" y="316" width="30" height="30" class="d-box-2 d-dashed"/><text x="210" y="336" text-anchor="middle" class="d-mono d-small d-muted">635</text>
<rect x="225" y="316" width="30" height="30" class="d-box-2 d-dashed"/><text x="240" y="336" text-anchor="middle" class="d-mono d-small d-muted">710</text>
<rect x="255" y="316" width="30" height="30" class="d-box-2 d-dashed"/><text x="270" y="336" text-anchor="middle" class="d-mono d-small d-muted">800</text>
<rect x="285" y="316" width="30" height="30" class="d-box-2 d-dashed"/><text x="300" y="336" text-anchor="middle" class="d-mono d-small d-muted">905</text>
<rect x="315" y="316" width="30" height="30" class="d-box-2 d-dashed"/><text x="330" y="336" text-anchor="middle" class="d-mono d-small d-muted">990</text>
<text x="15" y="374" class="d-small">[4, 4): empty, so the loop ends: return -1</text>
<text x="15" y="390" class="d-small d-text-bad">500 sat at index 4 the whole time</text>
</svg>
<figcaption>Figure 1. The search for 500. Solid cells are still in the interval, dashed cells have been thrown away, and the triangle marks the probe. The red cell is the target. Comparing with <code>a[5]</code> justified discarding indexes 5 to 10 and nothing else, yet index 4 went with them.</figcaption>
</figure>

The damage is done in the first step. The loop condition `lo < hi` and the starting value `hi = a.Length` both treat `hi` as the first index that is *outside* the search. The assignment `hi = mid - 1` treats `hi` as the last index *inside* it. Put together, `hi = 4` means "index 4 is out", although the only fact the code had was that `a[5]` is too big.

That also explains why the spot checks passed. A value is lost only when it sits immediately left of a probe that was too big, so whether a given target is found depends on the path the probes happen to take. The first, middle and last elements, which the first program checked, are not on a losing path in an array of eleven.

## Say what lo and hi mean, then hold every line to it

A [loop invariant](/glossary/#invariant) is a statement that is true every time execution reaches the top of the loop. For binary search the useful one is a promise about where the target can still be:

> If `target` is anywhere in `a`, its index is in the half-open interval `[lo, hi)`: at least `lo`, and strictly less than `hi`.

Deriving binary search from an invariant like this is the approach of column 4 of Jon Bentley's *Programming Pearls*; the choice of a half-open interval and the C# below are this page's own. Now go through the function one line at a time and ask whether the line keeps the promise.

- **Before the loop.** `lo = 0, hi = a.Length` makes the interval cover every index. The promise holds trivially.
- **`a[mid] < target`.** The array is sorted, so everything at or left of `mid` is also too small. The target, if present, is in `[mid + 1, hi)`. Setting `lo = mid + 1` keeps the promise.
- **`a[mid] > target`.** Everything at or right of `mid` is too big. The target, if present, is in `[lo, mid)`. The assignment that says so is `hi = mid`. Writing `hi = mid - 1` claims `[lo, mid - 1)`, which excludes index `mid - 1` on no evidence. That is the bug.
- **After the loop.** The loop ends when `lo == hi`, so the interval is empty. The promise says the target can only be in an empty set of indexes, so it is not in the array, and returning -1 is correct.

Correctness also needs the loop to end, and that is where the second bug lives. With `lo < hi`, the midpoint `lo + (hi - lo) / 2` satisfies `lo <= mid < hi`. Both updates therefore shrink the interval: `lo = mid + 1` moves `lo` up by at least one, and `hi = mid` moves `hi` down by at least one. An interval of non-negative length that shrinks every time round must reach length zero.

The converse is the bug. An update that can leave both `lo` and `hi` where they were makes the loop run forever, on particular inputs and with no error message. Every update has to be checked for progress as well as for the promise, and an exercise after the lower-bound section has a loop that fails that check.

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
        if (a[mid] == target)
            return mid;
        if (a[mid] < target)
            lo = mid + 1;
        else
            hi = mid;
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
int target = 700;
int lo = 0, hi = a.Length;
while (lo < hi)
{
    int mid = lo + (hi - lo) / 2;
    Console.WriteLine(
        $"[{lo}, {hi}) probe {mid}");
    if (a[mid] == target)
        break;
    if (a[mid] < target)
        lo = mid + 1;
    else
        hi = mid;
}
Console.WriteLine(
    $"end: lo = {lo}, hi = {hi}");
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

Call the number of indexes in `[lo, hi)` the size *s* of the interval. A probe at `lo + s / 2` that does not hit the target leaves either the left part, with ⌊*s*/2⌋ elements, or the right part, with ⌈*s*/2⌉ − 1. The larger of the two is ⌊*s*/2⌋. So in the worst case the sizes run *n*, ⌊*n*/2⌋, ⌊*n*/4⌋, and so on, and the number of probes before the size reaches zero is ⌊log₂ *n*⌋ + 1. That makes binary search [O(log *n*)](/complexity/big-o-notation/) in the worst case, against O(*n*) for a linear scan. The [best case](/complexity/best-average-worst-case/) is a single probe, when the target happens to be in the middle. Extra memory is O(1): two indexes and a midpoint.

The formula can be checked exactly rather than timed. The next program searches for every present value and every gap between values, and records the largest probe count it sees.

```csharp run
using System.Numerics;

int[] sizes = [11, 1_000, 1_000_000];
Console.WriteLine(
    "      n  worst  formula");
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
        if (a[mid] == target)
            break;
        if (a[mid] < target)
            lo = mid + 1;
        else
            hi = mid;
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

The logarithm depends on two preconditions. The data must be sorted by the same ordering the search compares with ([one easy way to break that](#sorted-by-one-comparer-searched-with-another) comes later), and reading `a[mid]` must cost O(1). An array, a `List<T>` or a span qualifies. [A linked list](/data-structures/linked-lists/) does not, because reaching the middle node is itself O(*n*).

## The midpoint that overflows

The first program computed `(lo + hi) / 2`. Both indexes are valid `int` values, but their sum need not be. In 2006 [Joshua Bloch reported](https://research.google/blog/extra-extra-read-all-about-it-nearly-all-binary-searches-and-mergesorts-are-broken/) that `java.util.Arrays.binarySearch` had carried this bug for about nine years: once an array has more than 2³⁰ elements, `lo + hi` can exceed 2³¹ − 1 and wrap to a negative number.

His post quotes Jon Bentley's remark that binary search was first published in 1946 and the first version correct for all *n* did not appear until 1962, and then notes that the proven-correct version in Bentley's *Programming Pearls* contained this overflow too. A proof about `lo` and `hi` does not catch it, because such a proof reasons about mathematical integers and the program runs on 32-bit ones.

C# behaves the same way as Java here. Integer arithmetic on non-constant values is [unchecked by default](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/statements/checked-and-unchecked): unless the code sits inside a `checked` block or operator, or the project sets `CheckForOverflowUnderflow`, the result is truncated to 32 bits and the sum wraps around. .NET arrays can be long enough for that to matter: [`Array.MaxLength`](https://learn.microsoft.com/en-us/dotnet/api/system.array.maxlength), the runtime's cap on the number of elements (the first line of output below), is just under 2³¹ (2,147,483,591 on the 64-bit .NET 10 runtime used for this page), and a `byte[]` with 1.2 billion elements needs only about 1.2 GB. The arithmetic can be shown without allocating one:

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
max      21474[...]
naive    -547483648
subtract 1600000000
shift    1600000000
checked  OverflowException
```

With the naive midpoint, the next line of the search would be `a[-547483648]` and an `IndexOutOfRangeException` from code that passed every test on small arrays. There are two standard repairs:

- `lo + (hi - lo) / 2` never forms a number larger than `hi`. It is correct whenever `lo <= hi` and the difference fits in the type, which is always true for array indexes. Use this one by default.
- `(lo + hi) >>> 1` lets the sum wrap and then reinterprets it. The [unsigned right shift](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/operators/bitwise-and-shift-operators) `>>>` always fills the top bit with zero, whatever the sign, which recovers the right answer as long as the true sum is below 2³². It is correct only for non-negative operands. The operator arrived in [C# 11](https://github.com/dotnet/csharplang/blob/main/proposals/csharp-11.0/unsigned-right-shift-operator.md); older code casts to `uint` and uses `>>`, as the runtime's span search below does.

:::dotnet
The runtime uses both. The array search helper in [`ArraySortHelper.cs`](https://github.com/dotnet/runtime/blob/main/src/libraries/System.Private.CoreLib/src/System/Collections/Generic/ArraySortHelper.cs) computes `lo + ((hi - lo) >> 1)`. The span version in [`SpanHelpers.BinarySearch.cs`](https://github.com/dotnet/runtime/blob/main/src/libraries/System.Private.CoreLib/src/System/SpanHelpers.BinarySearch.cs) computes `(int)(((uint)hi + (uint)lo) >> 1)`, with a comment explaining that the indexes are never negative there and the unsigned form saves a subtraction per iteration. Both loops are closed-interval loops that return `~lo` when the value is absent. These are implementation details of the source as read on the access date, not documented behavior.
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
<svg viewBox="0 0 360 482" role="img" aria-labelledby="lb-title lb-desc">
<title id="lb-title">Lower bound of 2 in a sorted array with duplicates</title>
<desc id="lb-desc">Five rows show the array 0 0 1 2 2 2 2 4 6 6 9. Cells left of lo are known to be below 2, cells from hi onward are known to be 2 or more, and the cells between are unknown. The unknown region shrinks from all eleven cells to none, with lo and hi meeting at index 3.</desc>
<rect x="15" y="8" width="14" height="14" class="d-box"/><text x="35" y="20" class="d-small">below 2</text>
<rect x="105" y="8" width="14" height="14" class="d-box-accent"/><text x="125" y="20" class="d-small">unknown</text>
<rect x="205" y="8" width="14" height="14" class="d-box-good"/><text x="225" y="20" class="d-small">2 or more</text>
<text x="30" y="42" text-anchor="middle" class="d-small d-muted">0</text>
<text x="60" y="42" text-anchor="middle" class="d-small d-muted">1</text>
<text x="90" y="42" text-anchor="middle" class="d-small d-muted">2</text>
<text x="120" y="42" text-anchor="middle" class="d-small d-muted">3</text>
<text x="150" y="42" text-anchor="middle" class="d-small d-muted">4</text>
<text x="180" y="42" text-anchor="middle" class="d-small d-muted">5</text>
<text x="210" y="42" text-anchor="middle" class="d-small d-muted">6</text>
<text x="240" y="42" text-anchor="middle" class="d-small d-muted">7</text>
<text x="270" y="42" text-anchor="middle" class="d-small d-muted">8</text>
<text x="300" y="42" text-anchor="middle" class="d-small d-muted">9</text>
<text x="330" y="42" text-anchor="middle" class="d-small d-muted">10</text>
<rect x="15" y="54" width="30" height="30" class="d-box-accent"/><text x="30" y="74" text-anchor="middle" class="d-mono d-small">0</text>
<rect x="45" y="54" width="30" height="30" class="d-box-accent"/><text x="60" y="74" text-anchor="middle" class="d-mono d-small">0</text>
<rect x="75" y="54" width="30" height="30" class="d-box-accent"/><text x="90" y="74" text-anchor="middle" class="d-mono d-small">1</text>
<rect x="105" y="54" width="30" height="30" class="d-box-accent"/><text x="120" y="74" text-anchor="middle" class="d-mono d-small">2</text>
<rect x="135" y="54" width="30" height="30" class="d-box-accent"/><text x="150" y="74" text-anchor="middle" class="d-mono d-small">2</text>
<rect x="165" y="54" width="30" height="30" class="d-box-accent"/><text x="180" y="74" text-anchor="middle" class="d-mono d-small d-bold">2</text>
<rect x="195" y="54" width="30" height="30" class="d-box-accent"/><text x="210" y="74" text-anchor="middle" class="d-mono d-small">2</text>
<rect x="225" y="54" width="30" height="30" class="d-box-accent"/><text x="240" y="74" text-anchor="middle" class="d-mono d-small">4</text>
<rect x="255" y="54" width="30" height="30" class="d-box-accent"/><text x="270" y="74" text-anchor="middle" class="d-mono d-small">6</text>
<rect x="285" y="54" width="30" height="30" class="d-box-accent"/><text x="300" y="74" text-anchor="middle" class="d-mono d-small">6</text>
<rect x="315" y="54" width="30" height="30" class="d-box-accent"/><text x="330" y="74" text-anchor="middle" class="d-mono d-small">9</text>
<path d="M180 88 l-5 8 h10z" class="d-fill-stroke"/>
<path d="M15 85 v8" class="d-line"/>
<path d="M345 85 v8" class="d-line"/>
<text x="15" y="106" text-anchor="middle" class="d-small d-bold">lo</text>
<text x="345" y="106" text-anchor="middle" class="d-small d-bold">hi</text>
<text x="15" y="126" class="d-small d-muted">probe a[5] = 2: not below 2, so hi = 5</text>
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
<path d="M90 172 l-5 8 h10z" class="d-fill-stroke"/>
<path d="M15 169 v8" class="d-line"/>
<path d="M165 169 v8" class="d-line"/>
<text x="15" y="190" text-anchor="middle" class="d-small d-bold">lo</text>
<text x="165" y="190" text-anchor="middle" class="d-small d-bold">hi</text>
<text x="15" y="210" class="d-small d-muted">probe a[2] = 1: below 2, so lo = 3</text>
<rect x="15" y="222" width="30" height="30" class="d-box"/><text x="30" y="242" text-anchor="middle" class="d-mono d-small">0</text>
<rect x="45" y="222" width="30" height="30" class="d-box"/><text x="60" y="242" text-anchor="middle" class="d-mono d-small">0</text>
<rect x="75" y="222" width="30" height="30" class="d-box"/><text x="90" y="242" text-anchor="middle" class="d-mono d-small">1</text>
<rect x="105" y="222" width="30" height="30" class="d-box-accent"/><text x="120" y="242" text-anchor="middle" class="d-mono d-small">2</text>
<rect x="135" y="222" width="30" height="30" class="d-box-accent"/><text x="150" y="242" text-anchor="middle" class="d-mono d-small d-bold">2</text>
<rect x="165" y="222" width="30" height="30" class="d-box-good"/><text x="180" y="242" text-anchor="middle" class="d-mono d-small">2</text>
<rect x="195" y="222" width="30" height="30" class="d-box-good"/><text x="210" y="242" text-anchor="middle" class="d-mono d-small">2</text>
<rect x="225" y="222" width="30" height="30" class="d-box-good"/><text x="240" y="242" text-anchor="middle" class="d-mono d-small">4</text>
<rect x="255" y="222" width="30" height="30" class="d-box-good"/><text x="270" y="242" text-anchor="middle" class="d-mono d-small">6</text>
<rect x="285" y="222" width="30" height="30" class="d-box-good"/><text x="300" y="242" text-anchor="middle" class="d-mono d-small">6</text>
<rect x="315" y="222" width="30" height="30" class="d-box-good"/><text x="330" y="242" text-anchor="middle" class="d-mono d-small">9</text>
<path d="M150 256 l-5 8 h10z" class="d-fill-stroke"/>
<path d="M105 253 v8" class="d-line"/>
<path d="M165 253 v8" class="d-line"/>
<text x="105" y="274" text-anchor="middle" class="d-small d-bold">lo</text>
<text x="165" y="274" text-anchor="middle" class="d-small d-bold">hi</text>
<text x="15" y="294" class="d-small d-muted">probe a[4] = 2: not below 2, so hi = 4</text>
<rect x="15" y="306" width="30" height="30" class="d-box"/><text x="30" y="326" text-anchor="middle" class="d-mono d-small">0</text>
<rect x="45" y="306" width="30" height="30" class="d-box"/><text x="60" y="326" text-anchor="middle" class="d-mono d-small">0</text>
<rect x="75" y="306" width="30" height="30" class="d-box"/><text x="90" y="326" text-anchor="middle" class="d-mono d-small">1</text>
<rect x="105" y="306" width="30" height="30" class="d-box-accent"/><text x="120" y="326" text-anchor="middle" class="d-mono d-small d-bold">2</text>
<rect x="135" y="306" width="30" height="30" class="d-box-good"/><text x="150" y="326" text-anchor="middle" class="d-mono d-small">2</text>
<rect x="165" y="306" width="30" height="30" class="d-box-good"/><text x="180" y="326" text-anchor="middle" class="d-mono d-small">2</text>
<rect x="195" y="306" width="30" height="30" class="d-box-good"/><text x="210" y="326" text-anchor="middle" class="d-mono d-small">2</text>
<rect x="225" y="306" width="30" height="30" class="d-box-good"/><text x="240" y="326" text-anchor="middle" class="d-mono d-small">4</text>
<rect x="255" y="306" width="30" height="30" class="d-box-good"/><text x="270" y="326" text-anchor="middle" class="d-mono d-small">6</text>
<rect x="285" y="306" width="30" height="30" class="d-box-good"/><text x="300" y="326" text-anchor="middle" class="d-mono d-small">6</text>
<rect x="315" y="306" width="30" height="30" class="d-box-good"/><text x="330" y="326" text-anchor="middle" class="d-mono d-small">9</text>
<path d="M120 340 l-5 8 h10z" class="d-fill-stroke"/>
<path d="M105 337 v8" class="d-line"/>
<path d="M135 337 v8" class="d-line"/>
<text x="105" y="358" text-anchor="middle" class="d-small d-bold">lo</text>
<text x="135" y="358" text-anchor="middle" class="d-small d-bold">hi</text>
<text x="15" y="378" class="d-small d-muted">probe a[3] = 2: not below 2, so hi = 3</text>
<rect x="15" y="390" width="30" height="30" class="d-box"/><text x="30" y="410" text-anchor="middle" class="d-mono d-small">0</text>
<rect x="45" y="390" width="30" height="30" class="d-box"/><text x="60" y="410" text-anchor="middle" class="d-mono d-small">0</text>
<rect x="75" y="390" width="30" height="30" class="d-box"/><text x="90" y="410" text-anchor="middle" class="d-mono d-small">1</text>
<rect x="105" y="390" width="30" height="30" class="d-box-good"/><text x="120" y="410" text-anchor="middle" class="d-mono d-small">2</text>
<rect x="135" y="390" width="30" height="30" class="d-box-good"/><text x="150" y="410" text-anchor="middle" class="d-mono d-small">2</text>
<rect x="165" y="390" width="30" height="30" class="d-box-good"/><text x="180" y="410" text-anchor="middle" class="d-mono d-small">2</text>
<rect x="195" y="390" width="30" height="30" class="d-box-good"/><text x="210" y="410" text-anchor="middle" class="d-mono d-small">2</text>
<rect x="225" y="390" width="30" height="30" class="d-box-good"/><text x="240" y="410" text-anchor="middle" class="d-mono d-small">4</text>
<rect x="255" y="390" width="30" height="30" class="d-box-good"/><text x="270" y="410" text-anchor="middle" class="d-mono d-small">6</text>
<rect x="285" y="390" width="30" height="30" class="d-box-good"/><text x="300" y="410" text-anchor="middle" class="d-mono d-small">6</text>
<rect x="315" y="390" width="30" height="30" class="d-box-good"/><text x="330" y="410" text-anchor="middle" class="d-mono d-small">9</text>
<path d="M105 421 v8" class="d-line"/>
<text x="105" y="442" text-anchor="middle" class="d-small d-bold">lo = hi</text>
<text x="15" y="462" class="d-small d-muted">lo = hi = 3: the first index holding 2 or more</text>
</svg>
<figcaption>Figure 2. Lower bound of 2. The short ticks and the labels <code>lo</code> and <code>hi</code> mark boundaries between cells, not cells. Everything left of <code>lo</code> is known to be below the target and everything from <code>hi</code> onward is known not to be; the triangle marks the probe, which moves one boundary each step. When the unknown region is empty the two boundaries meet, and that index is the answer.</figcaption>
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
Console.WriteLine($"absent 5:   {lb5}");
Console.WriteLine($"absent 10:  {lb10}");

static int LowerBound(
    int[] a, int target)
{
    int lo = 0, hi = a.Length;
    while (lo < hi)
    {
        int mid = lo + (hi - lo) / 2;
        if (a[mid] < target)
            lo = mid + 1;
        else
            hi = mid;
    }
    return lo;
}

static int UpperBound(
    int[] a, int target)
{
    int lo = 0, hi = a.Length;
    while (lo < hi)
    {
        int mid = lo + (hi - lo) / 2;
        if (a[mid] <= target)
            lo = mid + 1;
        else
            hi = mid;
    }
    return lo;
}
```

```text output
first 2 at  3
past 2s at  7
exactly 2:  4
4 or more:  4
absent 5:   8
absent 10:  11
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
        if (a[mid] <= t)
            lo = mid;
        else
            hi = mid - 1;
    }
    return lo;
}
```

```text output
0
```

:::solution
This is bug two. The termination argument needs every branch to shrink the interval, and `lo = mid` does not when `mid == lo`. Integer division rounds down, so `mid == lo` whenever `hi == lo + 1`. If `a[lo] <= t` at that moment, the loop assigns `lo = lo` and spins. The program below adds a step counter to the function so the hang becomes a message; searching two departures for 400 is enough to trigger it.

One repair keeps the structure and rounds the midpoint *up*, `lo + (hi - lo + 1) / 2`, so that `mid > lo` and `lo = mid` makes progress. The better repair is to stop inventing variants: the last element at or before `t` is the one just left of the upper bound.

```csharp run
int[] two = [350, 395];
int r = LastAtOrBefore(two, 400);
Console.WriteLine($"returned {r}");
int last = UpperBound(two, 400) - 1;
Console.WriteLine($"repaired {last}");

static int LastAtOrBefore(
    int[] a, int t)
{
    int lo = 0, hi = a.Length - 1;
    int steps = 0;
    while (lo < hi)
    {
        if (++steps > 64)
        {
            Console.WriteLine(
                $"stuck [{lo}, {hi}]");
            return -2;
        }
        int mid = lo + (hi - lo) / 2;
        if (a[mid] <= t)
            lo = mid;
        else
            hi = mid - 1;
    }
    return lo;
}

static int UpperBound(
    int[] a, int target)
{
    int lo = 0, hi = a.Length;
    while (lo < hi)
    {
        int mid = lo + (hi - lo) / 2;
        if (a[mid] <= target)
            lo = mid + 1;
        else
            hi = mid;
    }
    return lo;
}
```

```text output
stuck [0, 1]
returned -2
repaired 1
```

`UpperBound(a, t) - 1` also handles the case the original had to assume away: when every departure is after `t` it returns -1.
:::
::::

::::exercise[Count a time window]
Using only `LowerBound`, write `CountBetween(a, from, to)` that returns how many departures fall in the closed window from `from` to `to`, in O(log *n*). Check it on the eleven departures with the windows 440 to 710, 441 to 499, and 0 to 2000.

:::solution
Departures are whole minutes, so "at most `to`" is the same as "below `to + 1`", and the count is the distance between two lower bounds. (For a type with no successor, such as `double` or `string`, use `UpperBound(a, to)` instead.)

```csharp run
int[] a =
[
    305, 350, 395, 440, 500, 560,
    635, 710, 800, 905, 990,
];

(int F, int T)[] windows =
[
    (440, 710), (441, 499), (0, 2000),
];
foreach (var (f, t) in windows)
{
    int n = CountBetween(a, f, t);
    Console.WriteLine($"{f}-{t}: {n}");
}

static int CountBetween(
    int[] a, int from, int to) =>
    LowerBound(a, to + 1)
    - LowerBound(a, from);

static int LowerBound(
    int[] a, int target)
{
    int lo = 0, hi = a.Length;
    while (lo < hi)
    {
        int mid = lo + (hi - lo) / 2;
        if (a[mid] < target)
            lo = mid + 1;
        else
            hi = mid;
    }
    return lo;
}
```

```text output
440-710: 5
441-499: 0
0-2000: 11
```

`to + 1` overflows if `to` is `int.MaxValue`; a library version would use `UpperBound` for that reason too.
:::
::::

## What Array.BinarySearch tells you with a negative number

The base class library has binary search built in: [`Array.BinarySearch`](https://learn.microsoft.com/en-us/dotnet/api/system.array.binarysearch), [`List<T>.BinarySearch`](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.list-1.binarysearch), and [`BinarySearch` extension methods on spans](https://learn.microsoft.com/en-us/dotnet/api/system.memoryextensions.binarysearch). The first two are documented as O(log *n*), and all of them require the input to be sorted already. Their return value packs two answers into one `int`.

```csharp run id=bcl
int[] departures =
[
    305, 350, 395, 440, 500, 560,
    635, 710, 800, 905, 990,
];

int[] targets = [560, 300, 600, 2000];
Console.WriteLine(
    "target  result  ~result");
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

A non-negative result is the index of a match. A negative result means "not found", and [the documentation defines it](https://learn.microsoft.com/en-us/dotnet/api/system.array.binarysearch) as the bitwise complement of the index of the first element larger than the value, or of the array's length if there is none; `List<T>` and the span methods use the same convention. The [`~` operator](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/operators/bitwise-and-shift-operators) flips every bit of its operand, and because negation in two's complement is "flip the bits, then add one", that works out to `~x == -x - 1`. Applying `~` a second time undoes it, so `~result` is the insertion point: exactly the lower bound from the previous section. The last lines of the program use it to insert 600 where it belongs.

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

With duplicates, [the documentation says](https://learn.microsoft.com/en-us/dotnet/api/system.array.binarysearch) the method "returns the index of only one of the occurrences, and not necessarily the first one". Here it returns 5, the first probe, while the first 2 is at index 3. Which occurrence you get depends on where the probes happen to fall, and nothing promises it; when you need the first or the last, write a lower or upper bound. (The library has no such variant, which is why the earlier section builds one.)

The second call searches an unsorted array for a value that is plainly there at index 0. There is no exception and no check. The documentation warns that the return value [can be incorrect](https://learn.microsoft.com/en-us/dotnet/api/system.array.binarysearch) for an unsorted array. The method follows its comparisons to a wrong answer, which is the only thing an O(log *n*) algorithm can do, since verifying sortedness would cost O(*n*).

### Sorted by one comparer, searched with another

"Sorted" is always relative to a comparison. The overloads that take an `IComparer<T>` require the array to be sorted in the order that comparer defines, so an array sorted one way and searched another is as broken as a shuffled one, and it can look sorted when printed.

```csharp run id=comparers
string[] names =
    ["Pear", "apple", "Mango", "kiwi"];
var ic = StringComparer.OrdinalIgnoreCase;
int Find(string w) =>
    Array.BinarySearch(names, w, ic);
string Line() => string.Join(' ', names);

Array.Sort(names, StringComparer.Ordinal);
Console.WriteLine(Line());
Console.WriteLine($"kiwi {Find("kiwi")}");
Console.WriteLine($"Pear {Find("Pear")}");

Array.Sort(names, ic);
Console.WriteLine(Line());
Console.WriteLine($"kiwi {Find("kiwi")}");
```

```text output
Mango Pear apple kiwi
kiwi -1
Pear 1
apple kiwi Mango Pear
kiwi 1
```

Ordinal order puts every uppercase ASCII letter before every lowercase one, so the array is not sorted by the ignore-case order that the search uses. `kiwi` is present at index 3 and the search reports it missing; `Pear` is found only because it sits on the first probe. Sorting with the comparer you search with fixes it. The same comparer overloads are how you would generalize `LowerBound` beyond `int[]`: replace `a[mid] < target` with `comparer.Compare(a[mid], target) < 0`.

## Searching a range of answers instead of an array

Strip the array out of `LowerBound` and what remains is a search for the boundary in a sequence of answers that goes false, false, …, true, true. Any yes/no question over a range of integers works, provided that once the answer becomes yes it stays yes. Such a predicate is called **monotonic**. Call this *binary search on the answer*: instead of looking for a value in data, you search the space of possible answers for the smallest one that passes a test.

An example. A gallery page stores uncompressed RGBA thumbnails of six photos in a cache with an 8 MB budget. All thumbnails share one width, heights follow each photo's aspect ratio, and the goal is the largest width that fits. Total bytes only grow as the width grows, so "is this width too big?" is monotonic: false up to some width and true from then on. The answer is one less than the first width that is too big, and Figure 3 shows how the probes find it.

<figure class="diagram">
<svg viewBox="0 0 360 374" role="img" aria-labelledby="ans-title ans-desc">
<title id="ans-title">Binary search over thumbnail widths from 1 to 1920</title>
<desc id="ans-desc">A bar for widths 1 to 1920 is green up to width 633, where the thumbnails fit the cache budget, and red from width 634, where they do not. Below it, six rows show the search interval halving with each probe while the probes home in on the boundary.</desc>
<rect x="15" y="10" width="108.8" height="26" class="d-box-good"/>
<rect x="123.8" y="10" width="221.2" height="26" class="d-box-bad"/>
<text x="69.4" y="28" text-anchor="middle" class="d-small d-text-good d-bold">fits</text>
<text x="234.4" y="28" text-anchor="middle" class="d-small d-text-bad d-bold">too big</text>
<text x="15" y="54" class="d-small d-muted">width 1</text>
<text x="345" y="54" text-anchor="end" class="d-small d-muted">1920</text>
<text x="123.8" y="54" text-anchor="middle" class="d-small d-bold">634</text>
<rect x="15.0" y="82" width="330.0" height="10" rx="2" class="d-box-accent"/>
<path d="M123.8 77 V97" class="d-line d-dashed"/>
<path d="M123.8 77 V97" class="d-line d-dashed"/>
<circle cx="180.0" cy="87" r="5" class="d-fill-bad"/>
<text x="15" y="110" class="d-small">1. width 961: too big</text>
<rect x="15.0" y="128" width="165.0" height="10" rx="2" class="d-box-accent"/>
<path d="M123.8 123 V143" class="d-line d-dashed"/>
<path d="M123.8 123 V143" class="d-line d-dashed"/>
<circle cx="97.5" cy="133" r="5" class="d-fill-good"/>
<text x="15" y="156" class="d-small">2. width 481: fits</text>
<rect x="97.7" y="174" width="82.3" height="10" rx="2" class="d-box-accent"/>
<path d="M123.8 169 V189" class="d-line d-dashed"/>
<path d="M123.8 169 V189" class="d-line d-dashed"/>
<circle cx="138.8" cy="179" r="5" class="d-fill-bad"/>
<text x="15" y="202" class="d-small">3. width 721: too big</text>
<rect x="97.7" y="220" width="41.1" height="10" rx="2" class="d-box-accent"/>
<path d="M123.8 215 V235" class="d-line d-dashed"/>
<path d="M123.8 215 V235" class="d-line d-dashed"/>
<circle cx="118.1" cy="225" r="5" class="d-fill-good"/>
<text x="15" y="248" class="d-small">4. width 601: fits</text>
<rect x="118.3" y="266" width="20.5" height="10" rx="2" class="d-box-accent"/>
<path d="M123.8 261 V281" class="d-line d-dashed"/>
<path d="M123.8 261 V281" class="d-line d-dashed"/>
<circle cx="128.4" cy="271" r="5" class="d-fill-bad"/>
<text x="15" y="294" class="d-small">5. width 661: too big</text>
<rect x="118.3" y="312" width="10.1" height="10" rx="2" class="d-box-accent"/>
<path d="M123.8 307 V327" class="d-line d-dashed"/>
<path d="M123.8 307 V327" class="d-line d-dashed"/>
<circle cx="123.3" cy="317" r="5" class="d-fill-good"/>
<text x="15" y="340" class="d-small">6. width 631: fits</text>
<text x="15" y="360" class="d-small d-muted">Probes 7 to 11 pin down the boundary at 634.</text>
</svg>
<figcaption>Figure 3. Each bar is the interval still to search and each dot is that probe's answer. The interval halves every time, and the dashed line marks the boundary the search is homing in on: 633 is the widest width that fits.</figcaption>
</figure>

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
        if (pred(mid))
            hi = mid;
        else
            lo = mid + 1;
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

The failures of this technique are all outside the loop:

- **The predicate is not monotonic.** Then the search returns *some* boundary between a false and a true, with no error. Before using the technique, state in one sentence why a yes can never be followed by a no. Here: widening every thumbnail cannot make the total smaller.
- **The range does not bracket the answer.** `FirstTrue` returns `hi` when nothing in the range is true, and `lo` when everything is. Both are correct, and both need handling by the caller: `best` would be 1,920 (everything fits) or 0 (nothing does).
- **The arithmetic overflows.** Bounds are now values, and a predicate often multiplies them. `BytesAt` uses `long` throughout for that reason. Even the midpoint can overflow: `hi - lo` does not fit in a `long` for the range from `long.MinValue` to `long.MaxValue`, so a search over signed values that wide needs a wider type for the difference.
- **The range is real numbers.** With `double` bounds there is no `lo = mid + 1`, so `lo < hi` may never become false. Loop a fixed number of times (for ordinary ranges a hundred halvings exhaust a `double`'s precision) or until `hi - lo` drops below a tolerance you choose.

::::exercise[An integer square root, and where it overflows]
Use `FirstTrue` to compute the integer square root of a non-negative `long` *n*: the largest *x* with *x*² ≤ *n*. The obvious predicate is `x => x * x > n` over the range 1 to `long.MaxValue`. Find out what that returns for *n* = 1,000,000, explain it, and write a version that is correct for every *n* up to `long.MaxValue`.

:::solution
The first midpoint is about 4.6 × 10¹⁸, and squaring it overflows `long`. In an unchecked context the product wraps to an arbitrary value, the predicate's answers stop being monotonic, and the search converges on a meaningless boundary.

Two changes fix it. Compare by division, `x > n / x`, which is equivalent to *x*² > *n* for positive integers and cannot overflow. And bound the range by the largest possible answer: the square root of `long.MaxValue` is 3,037,000,499 and a fraction, so an exclusive upper bound of 3,037,000,500 brackets every case.

```csharp run
long m = 1_000_000;
long naive = IsqrtNaive(m);
Console.WriteLine($"naive  {naive}");
Console.WriteLine($"safe   {Isqrt(m)}");
long[] more =
    [999_999, 0, long.MaxValue];
foreach (long n in more)
{
    long root = Isqrt(n);
    Console.WriteLine($"safe   {root}");
}

static long IsqrtNaive(long n) =>
    FirstTrue(1, long.MaxValue,
        x => x * x > n) - 1;

static long Isqrt(long n) =>
    FirstTrue(1, 3_037_000_500,
        x => x > n / x) - 1;

static long FirstTrue(
    long lo, long hi,
    Func<long, bool> pred)
{
    while (lo < hi)
    {
        long mid = lo + (hi - lo) / 2;
        if (pred(mid))
            hi = mid;
        else
            lo = mid + 1;
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

- **The data is not sorted and you need one lookup.** [Sorting costs O(*n* log *n*) with merge sort](/algorithms/sorting-algorithms-compared/) (CLRS, chapter 2), and no comparison sort beats that in the worst case (CLRS, chapter 8), so it costs more than the O(*n*) linear scan it would replace. Sorting first pays for itself only when it is followed by enough searches.
- **You only ever ask "is this exact key present?"** [A hash table](/data-structures/hash-tables/) answers that in expected O(1); the [`Dictionary<TKey,TValue>` documentation](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.dictionary-2) describes retrieval as "close to O(1)", depending on the quality of the key's hash function. What a hash table cannot do is anything in this article's second half: nearest value, range counts, insertion points. Those need order.
- **The collection changes all the time.** Finding the insertion point in a sorted `List<T>` is O(log *n*), but [`List<T>.Insert`](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.list-1.insert) [is documented as O(*n*)](/data-structures/arrays-and-dynamic-arrays/) because the elements after it shift. A [balanced binary search tree](/data-structures/binary-search-trees/), such as a red-black tree (CLRS, chapter 13), makes both search and insertion O(log *n*) at the cost of a pointer-chasing layout.
- **The array is tiny.** For a dozen elements the difference between at most 4 probes and at most 12 comparisons is not worth a line of reasoning. Use whichever is clearer.

When binary search does fit, prefer the library method for plain membership and insertion points, and write a lower or upper bound yourself when duplicates or ranges matter. Either way, write the invariant as a comment above the loop, and test against a linear scan over every small case. The missed values and the endless loop on this page both survive spot checks and both fall to that exhaustive comparison. The overflow survives even that, because no small test reaches it, which is why the midpoint is worth writing the safe way out of habit.
