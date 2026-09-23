---
title: "Property-Based Testing: Let the Computer Find Your Edge Cases"
description: "Seven passing unit tests hide an integer-overflow bug in a sort. Build a tiny generator and shrinker in C# that finds it, then meet FsCheck and CsCheck."
pillar: testing
order: 5
author: markus
published: 2026-09-22
updated: 2026-09-22
level: intermediate
tags: [property-based-testing, generators, shrinking, integer-overflow, unit-testing, xunit]
prerequisites: ["testing/unit-testing-fundamentals"]
sources:
  - title: "FsCheck"
    url: "https://github.com/fscheck/FsCheck"
    publisher: "FsCheck (GitHub)"
    accessed: 2026-09-22
  - title: "FsCheck Documentation"
    url: "https://fscheck.github.io/FsCheck/"
    publisher: "FsCheck"
    accessed: 2026-09-22
  - title: "CsCheck: Random Testing Library for C#"
    url: "https://github.com/AnthonyLloyd/CsCheck"
    publisher: "CsCheck (GitHub)"
    accessed: 2026-09-22
  - title: "IComparable.CompareTo(Object) Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.icomparable.compareto"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Arithmetic operators - C# reference"
    url: "https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/operators/arithmetic-operators"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Array.Sort Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.array.sort"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
draft: false
---

Seven [unit tests](/glossary/#unit-test) exercise `Sorter.Sort`: the empty array, a single element, an already-sorted run, its reverse, a run with duplicates, a mix of positive and negative numbers, and a typical eight-item batch. Every program on this page ran against .NET SDK 10.0.401 on Windows 11, x64.

```csharp run id=sorter-tests
#:package xunit.v3@1.*
using Xunit;

public class SorterTests
{
    [Fact]
    public void Sort_EmptyArray_ReturnsEmpty()
    {
        Assert.Equal([], Sorter.Sort([]));
    }

    [Fact]
    public void Sort_SingleElement_ReturnsSameElement()
    {
        Assert.Equal([7], Sorter.Sort([7]));
    }

    [Fact]
    public void Sort_AlreadySorted_IsUnchanged()
    {
        Assert.Equal([1, 2, 3, 4], Sorter.Sort([1, 2, 3, 4]));
    }

    [Fact]
    public void Sort_ReverseSorted_IsFlipped()
    {
        Assert.Equal([1, 2, 3, 4], Sorter.Sort([4, 3, 2, 1]));
    }

    [Fact]
    public void Sort_WithDuplicates_GroupsThem()
    {
        Assert.Equal([1, 2, 2, 5], Sorter.Sort([2, 5, 1, 2]));
    }

    [Fact]
    public void Sort_NegativeAndPositive_OrdersBySign()
    {
        Assert.Equal([-8, -1, 0, 3, 9], Sorter.Sort([3, -1, 9, -8, 0]));
    }

    [Fact]
    public void Sort_TypicalRandomBatch_EndsUpOrdered()
    {
        int[] input = [842, 17, 653, 4, 291, 88, 730, 12];
        int[] expected = [4, 12, 17, 88, 291, 653, 730, 842];
        Assert.Equal(expected, Sorter.Sort(input));
    }
}

static class Sorter
{
    public static int[] Sort(int[] items)
    {
        var copy = (int[])items.Clone();
        Array.Sort(copy, (a, b) => a - b);
        return copy;
    }
}
```

```text output
xUnit.net v3 In-Process Runner [...]
  Discovering: sorter-tests
  Discovered:  sorter-tests
  Starting:    sorter-tests
  Finished:    sorter-tests
=== TEST EXECUTION SUMMARY ===
   sorter-tests  Total: 7, Errors: 0, Failed: 0, Skipped: 0, Not Run: 0, Time: [...]
```

All seven pass. `Sorter.Sort` still has a real bug: for some inputs it returns an array that is not sorted. Below is a small program that finds that input on its own — generating arrays, checking a rule instead of an example, and narrowing any failure down to a minimal one. It is collapsed so you can run it first or read the rest of this page first; every later section walks through one piece of it.

<details>
<summary>Full program</summary>

```csharp run id=proptest
Property.Check(
    "Sorter.Sort produces a non-decreasing array",
    Gen.ArrayOf(Gen.Int(), maxLength: 12),
    xs => !IsSorted(Sorter.Sort(xs)),
    seed: 2,
    trials: 200);

static bool IsSorted(int[] xs)
{
    for (var i = 0; i + 1 < xs.Length; i++)
        if (xs[i] > xs[i + 1]) return false;
    return true;
}

static class Sorter
{
    public static int[] Sort(int[] items)
    {
        var copy = (int[])items.Clone();
        Array.Sort(copy, (a, b) => a - b);
        return copy;
    }
}

delegate T Gen<T>(Random rng);

static class Gen
{
    // One draw in four returns a value from a short list that most
    // often breaks arithmetic: zero, +/-1, and the type's extremes.
    // The rest are uniform over every int, including negative ones.
    public static Gen<int> Int() => rng =>
    {
        if (rng.Next(4) == 0)
        {
            int[] edges = [0, 1, -1, int.MinValue, int.MaxValue];
            return edges[rng.Next(edges.Length)];
        }
        Span<byte> bytes = stackalloc byte[4];
        rng.NextBytes(bytes);
        return BitConverter.ToInt32(bytes);
    };

    public static Gen<int[]> ArrayOf(Gen<int> element, int maxLength) => rng =>
    {
        var length = rng.Next(maxLength + 1);
        var items = new int[length];
        for (var i = 0; i < length; i++)
            items[i] = element(rng);
        return items;
    };
}

static class Property
{
    public static void Check(
        string name, Gen<int[]> generate, Func<int[], bool> fails,
        int seed, int trials = 200)
    {
        var rng = new Random(seed);
        for (var trial = 1; trial <= trials; trial++)
        {
            var candidate = generate(rng);
            if (!fails(candidate)) continue;

            Console.WriteLine(name);
            Console.WriteLine($"  falsified after {trial} trial(s), starting length {candidate.Length}");
            var minimal = Shrink(candidate, fails);
            Console.WriteLine($"  minimal: [{string.Join(", ", minimal)}]");
            return;
        }
        Console.WriteLine(name);
        Console.WriteLine($"  OK, passed {trials} trials");
    }

    static int[] Shrink(int[] failing, Func<int[], bool> fails)
    {
        var current = failing;
        bool improved;
        do
        {
            improved = TryDropOneElement(ref current, fails)
                || TryShrinkOneElement(ref current, fails);
        } while (improved);
        return current;
    }

    // If the property still fails with item i missing, item i was
    // never essential, so keep the shorter array and try again.
    static bool TryDropOneElement(ref int[] current, Func<int[], bool> fails)
    {
        for (var i = 0; i < current.Length; i++)
        {
            var without = current.Where((_, j) => j != i).ToArray();
            if (!fails(without)) continue;
            Report(current, without);
            current = without;
            return true;
        }
        return false;
    }

    static bool TryShrinkOneElement(ref int[] current, Func<int[], bool> fails)
    {
        for (var i = 0; i < current.Length; i++)
        {
            var smaller = ElementTowardZero(current, i, fails);
            if (smaller[i] == current[i]) continue;
            Report(current, smaller);
            current = smaller;
            return true;
        }
        return false;
    }

    // Binary search for the value closest to zero at this index that
    // still fails: 0 is assumed innocent, xs[index] is known guilty.
    static int[] ElementTowardZero(int[] xs, int index, Func<int[], bool> fails)
    {
        long lo = 0, hi = xs[index];
        while (Math.Abs(hi - lo) > 1)
        {
            var mid = lo + (hi - lo) / 2;
            var candidate = (int[])xs.Clone();
            candidate[index] = (int)mid;
            if (fails(candidate)) hi = mid; else lo = mid;
        }
        var result = (int[])xs.Clone();
        result[index] = (int)hi;
        return result;
    }

    static void Report(int[] from, int[] to) =>
        Console.WriteLine($"  shrink: [{string.Join(", ", from)}] -> [{string.Join(", ", to)}]");
}
```

```text output
Sorter.Sort produces a non-decreasing array
  falsified after 1 trial(s), starting length 10
  shrink: [-1188784698, -1741128593, 0, 504807691, 381546542, -1813599758, -2147483648, 1518726963, -172993782, 1] -> [-1741128593, 0, 504807691, 381546542, -1813599758, -2147483648, 1518726963, -172993782, 1]
  shrink: [-1741128593, 0, 504807691, 381546542, -1813599758, -2147483648, 1518726963, -172993782, 1] -> [0, 504807691, 381546542, -1813599758, -2147483648, 1518726963, -172993782, 1]
  shrink: [0, 504807691, 381546542, -1813599758, -2147483648, 1518726963, -172993782, 1] -> [504807691, 381546542, -1813599758, -2147483648, 1518726963, -172993782, 1]
  shrink: [504807691, 381546542, -1813599758, -2147483648, 1518726963, -172993782, 1] -> [381546542, -1813599758, -2147483648, 1518726963, -172993782, 1]
  shrink: [381546542, -1813599758, -2147483648, 1518726963, -172993782, 1] -> [-1813599758, -2147483648, 1518726963, -172993782, 1]
  shrink: [-1813599758, -2147483648, 1518726963, -172993782, 1] -> [-2147483648, 1518726963, -172993782, 1]
  shrink: [-2147483648, 1518726963, -172993782, 1] -> [-2147483648, -172993782, 1]
  shrink: [-2147483648, -172993782, 1] -> [-2147483648, 1]
  minimal: [-2147483648, 1]
```

</details>

The first random array — ten elements, drawn from the generator below — already falsifies the property, on the very first trial. Nine shrink steps later, the minimal failing case is two numbers: `-2147483648` and `1`.

## What those seven tests didn't check

Look at the comparer inside `Sort`: `(a, b) => a - b`. That reads as "negative when `a` is smaller, positive when `a` is larger, zero when equal" — correct for every pair of numbers the seven tests happened to use, which top out at `842` and bottom out at `-8`. `int` holds values from `-2,147,483,648` to `2,147,483,647`. The seven tests sampled a range about 1,700 wide out of one roughly 4.3 billion wide, all of it clustered near zero.

An [invariant](/glossary/#invariant) is a statement that has to hold no matter which input you pick, not just the ones you happened to write down. "The output of `Sort` is non-decreasing" is an invariant of a correct sort; it is a claim about *every* `int[]`, not about the seven arrays above. A property-based test states the invariant directly and lets a machine hunt for a counterexample, instead of a person hand-picking a handful of inputs and hoping they're representative:

```csharp snippet of=proptest
static bool IsSorted(int[] xs)
{
    for (var i = 0; i + 1 < xs.Length; i++)
        if (xs[i] > xs[i + 1]) return false;
    return true;
}
```

That function alone is not a test yet — it needs inputs to run against, and a way to search a space of 4.3 billion `int`s, let alone arrays of them, for the ones that break it.

## A generator biased toward trouble

A *generator* is a function from a source of randomness to a value. The simplest one for `int` draws four random bytes and reinterprets them, which reaches every possible `int`, including the extremes that the seven examples never touched:

```csharp snippet of=proptest
delegate T Gen<T>(Random rng);

static class Gen
{
    // One draw in four returns a value from a short list that most
    // often breaks arithmetic: zero, +/-1, and the type's extremes.
    // The rest are uniform over every int, including negative ones.
    public static Gen<int> Int() => rng =>
    {
        if (rng.Next(4) == 0)
        {
            int[] edges = [0, 1, -1, int.MinValue, int.MaxValue];
            return edges[rng.Next(edges.Length)];
        }
        Span<byte> bytes = stackalloc byte[4];
        rng.NextBytes(bytes);
        return BitConverter.ToInt32(bytes);
    };

    public static Gen<int[]> ArrayOf(Gen<int> element, int maxLength) => rng =>
    {
        var length = rng.Next(maxLength + 1);
        var items = new int[length];
        for (var i = 0; i < length; i++)
            items[i] = element(rng);
        return items;
    };
}
```

Purely uniform sampling would find `int.MinValue` too, eventually, but it is one value in about 4.3 billion, so a run of a few hundred draws is unlikely to land on it by chance. Spending a quarter of the draws on a short list of values that are disproportionately likely to break arithmetic — zero, the two values next to zero, and the two extremes — is a cheap way to reach the interesting corners of the input space sooner. `ArrayOf` composes with any element generator to build arrays: `Gen.ArrayOf(Gen.Int(), maxLength: 12)` produces arrays from length 0 to 12 of these biased integers.

## Generate, then shrink whenever it fails

Generating and checking a few hundred random arrays would already have found the bug — but the array that finds it first is normally not a nice one to read (the ten-element array above proves the point). Real property-based tools follow every failure with *shrinking*: given a failing input, look for a smaller one that still fails, and repeat until nothing smaller does. Two moves are enough for arrays of numbers: drop one element and see if the property still fails without it, or push one element toward zero and see if it still fails at the smaller magnitude.

```csharp snippet of=proptest
    static int[] Shrink(int[] failing, Func<int[], bool> fails)
    {
        var current = failing;
        bool improved;
        do
        {
            improved = TryDropOneElement(ref current, fails)
                || TryShrinkOneElement(ref current, fails);
        } while (improved);
        return current;
    }

    // If the property still fails with item i missing, item i was
    // never essential, so keep the shorter array and try again.
    static bool TryDropOneElement(ref int[] current, Func<int[], bool> fails)
    {
        for (var i = 0; i < current.Length; i++)
        {
            var without = current.Where((_, j) => j != i).ToArray();
            if (!fails(without)) continue;
            Report(current, without);
            current = without;
            return true;
        }
        return false;
    }
```

`TryShrinkOneElement`, called when no element can be dropped, tries the second move — shrinking one array entry toward zero. Doing that one step at a time could take up to two billion steps for a value near `int.MinValue`, so it binary-searches instead: `0` is assumed not to reproduce the failure, the current value is known to, and each probe halves the gap between them — the same halving [binary search](/algorithms/binary-search/) uses to find a value in a sorted array, aimed here at the smallest magnitude that still fails.

```csharp snippet of=proptest
    // Binary search for the value closest to zero at this index that
    // still fails: 0 is assumed innocent, xs[index] is known guilty.
    static int[] ElementTowardZero(int[] xs, int index, Func<int[], bool> fails)
    {
        long lo = 0, hi = xs[index];
        while (Math.Abs(hi - lo) > 1)
        {
            var mid = lo + (hi - lo) / 2;
            var candidate = (int[])xs.Clone();
            candidate[index] = (int)mid;
            if (fails(candidate)) hi = mid; else lo = mid;
        }
        var result = (int[])xs.Clone();
        result[index] = (int)hi;
        return result;
    }
```

`lo` and `hi` are `long` so that `hi - lo` never overflows even when `hi` is `int.MinValue` and `lo` is `0` — the same class of bug this whole page is about, avoided here on purpose rather than by luck.

A property runner ties generation and shrinking together: draw candidates until one fails the property (or the trial budget runs out), then shrink whatever failed and report the result.

```csharp snippet of=proptest
static class Property
{
    public static void Check(
        string name, Gen<int[]> generate, Func<int[], bool> fails,
        int seed, int trials = 200)
    {
        var rng = new Random(seed);
        for (var trial = 1; trial <= trials; trial++)
        {
            var candidate = generate(rng);
            if (!fails(candidate)) continue;

            Console.WriteLine(name);
            Console.WriteLine($"  falsified after {trial} trial(s), starting length {candidate.Length}");
            var minimal = Shrink(candidate, fails);
            Console.WriteLine($"  minimal: [{string.Join(", ", minimal)}]");
            return;
        }
        Console.WriteLine(name);
        Console.WriteLine($"  OK, passed {trials} trials");
    }
```

## Running it: the bug the examples missed

The output shown with the collapsed program above is real: on this run, with this seed, the first randomly generated array — ten elements — already falsifies the property, and nine drop-one-element shrink steps turn it into `[-2147483648, 1]`, with nothing smaller still failing. None of the nine intermediate arrays shown were constructed by hand; they are the actual `Report` lines this program printed.

<figure class="diagram">
<svg viewBox="0 0 300 350" role="img" aria-labelledby="shrink-title shrink-desc">
<title id="shrink-title">Shrinking a ten-element failing array down to two</title>
<desc id="shrink-desc">A vertical chain of four boxes connected by downward arrows. The top box holds a ten-element array that fails the sortedness property. Two arrows carry it down through nine and then three elements, each step dropping one element and still failing. The bottom box, highlighted, holds the two-element minimal case: int.MinValue and 1.</desc>
<defs>
<marker id="shrink-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-stroke"/></marker>
</defs>
<rect x="30" y="10" width="240" height="40" rx="6" class="d-box"/>
<text x="150" y="35" text-anchor="middle" class="d-bold">10 elements — fails</text>
<path d="M150 50 V88" class="d-line" marker-end="url(#shrink-arrow)"/>
<text x="160" y="73" class="d-small d-muted">drop one element</text>
<rect x="30" y="90" width="240" height="40" rx="6" class="d-box"/>
<text x="150" y="115" text-anchor="middle" class="d-bold">9 elements — fails</text>
<path d="M150 130 V168" class="d-line" marker-end="url(#shrink-arrow)"/>
<text x="160" y="153" class="d-small d-muted">5 more drops</text>
<rect x="30" y="170" width="240" height="40" rx="6" class="d-box"/>
<text x="150" y="195" text-anchor="middle" class="d-bold">3 elements — fails</text>
<path d="M150 210 V248" class="d-line" marker-end="url(#shrink-arrow)"/>
<text x="160" y="233" class="d-small d-muted">drop one more</text>
<rect x="30" y="250" width="240" height="56" rx="6" class="d-box-bad"/>
<text x="150" y="272" text-anchor="middle" class="d-small d-bold">2 elements — minimal</text>
<text x="150" y="294" text-anchor="middle" class="d-mono d-bold">[-2147483648, 1]</text>
<text x="20" y="326" class="d-small d-muted">Every step still falsifies the property;</text>
<text x="20" y="342" class="d-small d-muted">no shorter array in this run does.</text>
</svg>
<figcaption>Figure 1. The real shrink path from this page's run: nine drops turn a ten-element counterexample into the two-number pair that exposes the bug.</figcaption>
</figure>

## Why `-2147483648` and `1` break the sort

`Array.Sort(copy, (a, b) => a - b)` calls that delegate directly to decide order; for 16 elements or fewer, which covers every array on this page, `Array.Sort` runs an insertion sort internally ([Array.Sort Method](https://learn.microsoft.com/en-us/dotnet/api/system.array.sort), Microsoft Learn), so the comparer runs exactly as written, on exactly the two values given, with nothing skipped for a small array. `Compare(-2147483648, 1)` computes `-2147483648 - 1`. `int` cannot represent that value — it is one past `int.MinValue` in the negative direction — and C# does not stop to tell you: "In an unchecked context, the result is truncated by discarding any high-order bits that don't fit in the destination type," and "by default, arithmetic operations occur in an unchecked context" ([Arithmetic operators — C# reference](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/operators/arithmetic-operators), Microsoft Learn). The truncated result of `int.MinValue - 1` is `int.MaxValue`: a large *positive* number, so the comparer reports that `-2147483648` sorts *after* `1`, backwards.

`IComparable.CompareTo`'s own contract only promises a sign — its return value means "Less than zero," "Zero," or "Greater than zero," nothing more specific ([IComparable.CompareTo(Object) Method](https://learn.microsoft.com/en-us/dotnet/api/system.icomparable.compareto), Microsoft Learn). Subtraction answers a different question — "how far apart are these two numbers" — and only agrees with the sign question when the subtraction itself doesn't overflow. For the seven hand-picked examples at the top of this page it always agreed; for `int.MinValue` and `1` it doesn't.

A binary search's midpoint calculation overflows for the same underlying reason — an arithmetic result silently wrapping instead of raising an error — and one hand-rolled binary search's route to a fix is worked through in [Binary Search and the Three Bugs It Invites](/algorithms/binary-search/#the-midpoint-that-overflows).

::::exercise[Would a permutation check have caught this?]
`Sorter.Sort` uses `Array.Sort` in place on a cloned array. Before writing any code, decide: would a property that checks "the output is a permutation of the input" (same multiset of values) have caught the same bug that "the output is sorted" caught? Then check your answer: run 500 trials of the biased array generator through both `Sorter.Sort` and a multiset-equality check.

:::solution
No. `Array.Sort` rearranges elements in place — it never invents or drops a value, no matter what the comparer says — so "same multiset in and out" holds even when the order is wrong:

```csharp run id=permutation-check
var rng = new Random(2);
var allSame = true;
for (var trial = 0; trial < 500; trial++)
{
    var xs = Gen.ArrayOf(Gen.Int(), maxLength: 12)(rng);
    var sorted = Sorter.Sort(xs);
    if (!SameMultiset(xs, sorted)) allSame = false;
}

Console.WriteLine(allSame
    ? "OK: every output was a permutation of its input, 500 trials"
    : "found an input where the output was not a permutation");

static bool SameMultiset(int[] a, int[] b) =>
    a.OrderBy(x => x).SequenceEqual(b.OrderBy(x => x));

static class Sorter
{
    public static int[] Sort(int[] items)
    {
        var copy = (int[])items.Clone();
        Array.Sort(copy, (a, b) => a - b);
        return copy;
    }
}

delegate T Gen<T>(Random rng);

static class Gen
{
    public static Gen<int> Int() => rng =>
    {
        if (rng.Next(4) == 0)
        {
            int[] edges = [0, 1, -1, int.MinValue, int.MaxValue];
            return edges[rng.Next(edges.Length)];
        }
        Span<byte> bytes = stackalloc byte[4];
        rng.NextBytes(bytes);
        return BitConverter.ToInt32(bytes);
    };

    public static Gen<int[]> ArrayOf(Gen<int> element, int maxLength) => rng =>
    {
        var length = rng.Next(maxLength + 1);
        var items = new int[length];
        for (var i = 0; i < length; i++)
            items[i] = element(rng);
        return items;
    };
}
```

```text output
OK: every output was a permutation of its input, 500 trials
```

500 trials, no counterexample. A permutation check and a sortedness check test two different invariants of a sort; `Sort_WithDuplicates_GroupsThem` in the opening test suite happens to check both at once for one small array, which is exactly why it didn't help. The property that catches a given bug has to say something that bug actually violates.
:::
::::

## Fixing the comparer, then rerunning

`int` already has a comparison that doesn't go through subtraction: `CompareTo`. Swapping `(a, b) => a - b` for `(a, b) => a.CompareTo(b)` is a one-line change. Rerunning the same generator for ten times as many trials — 2,000 instead of 200, same seed, same shape of input, including the extremes — now finds nothing:

```csharp run id=fixed-check
var rng = new Random(2);
var stillFails = Enumerable.Range(0, 2000)
    .Select(_ => Gen.ArrayOf(Gen.Int(), maxLength: 12)(rng))
    .Any(xs => !IsSorted(Sorter.Sort(xs)));

Console.WriteLine(stillFails
    ? "found a counterexample"
    : "OK, no counterexample in 2000 trials");

static bool IsSorted(int[] xs)
{
    for (var i = 0; i + 1 < xs.Length; i++)
        if (xs[i] > xs[i + 1]) return false;
    return true;
}

static class Sorter
{
    public static int[] Sort(int[] items)
    {
        var copy = (int[])items.Clone();
        Array.Sort(copy, (a, b) => a.CompareTo(b));
        return copy;
    }
}

delegate T Gen<T>(Random rng);

static class Gen
{
    public static Gen<int> Int() => rng =>
    {
        if (rng.Next(4) == 0)
        {
            int[] edges = [0, 1, -1, int.MinValue, int.MaxValue];
            return edges[rng.Next(edges.Length)];
        }
        Span<byte> bytes = stackalloc byte[4];
        rng.NextBytes(bytes);
        return BitConverter.ToInt32(bytes);
    };

    public static Gen<int[]> ArrayOf(Gen<int> element, int maxLength) => rng =>
    {
        var length = rng.Next(maxLength + 1);
        var items = new int[length];
        for (var i = 0; i < length; i++)
            items[i] = element(rng);
        return items;
    };
}
```

```text output
OK, no counterexample in 2000 trials
```

That is not a proof that the fixed comparer is correct for every one of the roughly 1.8 × 10¹⁹ possible pairs of `int`s — 2,000 trials is 2,000 trials, whatever the generator's bias — but it is a far stronger check than seven hand-picked numbers, run against exactly the range of input the original bug lived in.

## A median function, for you to shrink

`Median` below is meant to work on a pre-sorted array: return the middle element for an odd length, or the average of the two middle elements for an even length.

```csharp run id=median-preview
static double Median(int[] sorted) => sorted[sorted.Length / 2];

Console.WriteLine(Median([1, 2, 3, 4]));
```

```text output
3
```

The true median of `[1, 2, 3, 4]` is the average of `2` and `3`, which is `2.5`. `Median` only implements half of its own specification.

::::exercise[Extend the framework to find the bug]
Using `Property.Check` and `Shrink` from earlier on this page (copied as-is, or rewritten), write a property that catches `Median`'s bug: generate a non-empty `int[]`, sort it with `OrderBy` to get a trustworthy reference order, and compare `Median` against "the middle element for odd length, the average of the two middle elements for even length." You will need a bounded integer generator — `Gen.Int()` from earlier draws from the full range of `int`, which is unnecessary here and makes the output harder to read.

:::solution
```csharp run id=median-fix
Property.Check(
    "Median matches the sort-and-average definition",
    Gen.ArrayOf(Gen.IntRange(-50, 50), maxLength: 8),
    xs => xs.Length > 0 && Median(Sorted(xs)) != Expected(xs),
    seed: 1,
    trials: 200);

static int[] Sorted(int[] xs) => xs.OrderBy(x => x).ToArray();

static double Expected(int[] xs)
{
    var sorted = Sorted(xs);
    var n = sorted.Length;
    return n % 2 == 1
        ? sorted[n / 2]
        : (sorted[n / 2 - 1] + sorted[n / 2]) / 2.0;
}

static double Median(int[] sorted) => sorted[sorted.Length / 2];

delegate T Gen<T>(Random rng);

static class Gen
{
    public static Gen<int> IntRange(int min, int max) => rng => rng.Next(min, max + 1);

    public static Gen<int[]> ArrayOf(Gen<int> element, int maxLength) => rng =>
    {
        var length = rng.Next(maxLength + 1);
        var items = new int[length];
        for (var i = 0; i < length; i++)
            items[i] = element(rng);
        return items;
    };
}

static class Property
{
    public static void Check(
        string name, Gen<int[]> generate, Func<int[], bool> fails,
        int seed, int trials = 200)
    {
        var rng = new Random(seed);
        for (var trial = 1; trial <= trials; trial++)
        {
            var candidate = generate(rng);
            if (!fails(candidate)) continue;

            Console.WriteLine(name);
            Console.WriteLine($"  falsified after {trial} trial(s), starting length {candidate.Length}");
            var minimal = Shrink(candidate, fails);
            Console.WriteLine($"  minimal: [{string.Join(", ", minimal)}]");
            return;
        }
        Console.WriteLine(name);
        Console.WriteLine($"  OK, passed {trials} trials");
    }

    static int[] Shrink(int[] failing, Func<int[], bool> fails)
    {
        var current = failing;
        bool improved;
        do
        {
            improved = TryDropOneElement(ref current, fails)
                || TryShrinkOneElement(ref current, fails);
        } while (improved);
        return current;
    }

    static bool TryDropOneElement(ref int[] current, Func<int[], bool> fails)
    {
        for (var i = 0; i < current.Length; i++)
        {
            var without = current.Where((_, j) => j != i).ToArray();
            if (!fails(without)) continue;
            Report(current, without);
            current = without;
            return true;
        }
        return false;
    }

    static bool TryShrinkOneElement(ref int[] current, Func<int[], bool> fails)
    {
        for (var i = 0; i < current.Length; i++)
        {
            var smaller = ElementTowardZero(current, i, fails);
            if (smaller[i] == current[i]) continue;
            Report(current, smaller);
            current = smaller;
            return true;
        }
        return false;
    }

    static int[] ElementTowardZero(int[] xs, int index, Func<int[], bool> fails)
    {
        long lo = 0, hi = xs[index];
        while (Math.Abs(hi - lo) > 1)
        {
            var mid = lo + (hi - lo) / 2;
            var candidate = (int[])xs.Clone();
            candidate[index] = (int)mid;
            if (fails(candidate)) hi = mid; else lo = mid;
        }
        var result = (int[])xs.Clone();
        result[index] = (int)hi;
        return result;
    }

    static void Report(int[] from, int[] to) =>
        Console.WriteLine($"  shrink: [{string.Join(", ", from)}] -> [{string.Join(", ", to)}]");
}
```

```text output
Median matches the sort-and-average definition
  falsified after 1 trial(s), starting length 2
  shrink: [-39, -3] -> [-1, -3]
  shrink: [-1, -3] -> [-1, -2]
  minimal: [-1, -2]
```

The minimal case is `[-1, -2]`: sorted, that's `[-2, -1]`, whose true median is `-1.5`. `Median` returns `sorted[1]`, which is `-1`. `Shrink` and `Property.Check` are copied unchanged from the sorting example — only the generator and the property changed, which is the point of separating "how to search" from "what to check."
:::
::::

## Beyond a toy: FsCheck and CsCheck

The framework on this page is a few dozen lines because it only ever has to generate and shrink `int[]`. A production property-testing library has to do that for arbitrary types — records, discriminated unions, recursive structures — compose generators for them from smaller ones, shrink each piece independently, and integrate with a test runner's pass/fail reporting.

[FsCheck](https://github.com/fscheck/FsCheck), the older of the two, describes itself as "a tool for testing .NET programs automatically," where a property is a specification the code should satisfy rather than a single example ([FsCheck](https://github.com/fscheck/FsCheck)). When a property fails, "FsCheck automatically displays a minimal counter-example" ([FsCheck Documentation](https://fscheck.github.io/FsCheck/)) — the same idea as `Property.Check` above, generalized to any type, with C# access via the `FsCheck.Xunit` package (`FsCheck.Xunit.v3` for xUnit v3) and a `[Property]` test attribute used where you would otherwise write `[Fact]`.

[CsCheck](https://github.com/AnthonyLloyd/CsCheck) is a newer, C#-first library inspired by QuickCheck. Its generators compose through ordinary LINQ methods rather than a separate arbitrary type, and — its own words — "Gen classes are composable with no need for Arb classes. So less boilerplate" ([CsCheck](https://github.com/AnthonyLloyd/CsCheck)). It really finds the same bug this page built a framework to find:

```csharp run id=cscheck-demo
#:package CsCheck@4.*
using CsCheck;

static int[] Sort(int[] items)
{
    var copy = (int[])items.Clone();
    Array.Sort(copy, (a, b) => a - b);
    return copy;
}

try
{
    Gen.Int.Array[0, 12]
        .Sample(xs =>
        {
            var sorted = Sort(xs);
            for (var i = 0; i + 1 < sorted.Length; i++)
                if (sorted[i] > sorted[i + 1]) return false;
            return true;
        }, seed: "2fDh2sAGsnI3");
    Console.WriteLine("no failure found");
}
catch (CsCheck.CsCheckException ex)
{
    Console.WriteLine(ex.Message);
}
```

```text output
Set seed: "2fDh2sAGsnI3" or -e CsCheck_Seed=2fDh2sAGsnI3 to reproduce ([...] shrinks, [...] skipped, [...] total).
[-25, -1062590646, 1539332543]
```

:::note
This ran with CsCheck 4.9.1 on the .NET 10 SDK, with no `PublishAot=false` needed. `Gen.Int.Array[0, 12]` is CsCheck's built-in `int[]` generator bounded to length 12, matching the `maxLength` used throughout this page. `seed:` pins the run the way this page's own `Property.Check(..., seed: 2, ...)` does, for the same reason: a failure you can reproduce is worth far more than one you can't. The shrink and skip counts still vary run to run here — CsCheck shrinks in parallel across threads — so they're wildcarded above; the array it converges on does not.
:::

`Gen.Int.Array[0, 12]` maps onto this page's `Gen.ArrayOf(Gen.Int(), maxLength: 12)`, and `.Sample(...)` onto `Property.Check`. The three-element result, `[-25, -1062590646, 1539332543]`, is a different minimal counterexample from `[-2147483648, 1]` — CsCheck's generator and shrinker aren't built the way this page's toy ones are — but it's the same bug: `-1062590646 - 1539332543` needs one more bit than `int` has, and wraps.

Reach for a real library rather than hand-rolled generators and shrinkers for anything beyond a learning exercise: they cover far more types, shrink faster and more thoroughly, and have been tuned against bugs like this one for years. What's worth keeping from this page is the shape of the idea underneath them — generate broadly, including the values you didn't think to write by hand, and shrink every failure down to the smallest case that still explains it.
