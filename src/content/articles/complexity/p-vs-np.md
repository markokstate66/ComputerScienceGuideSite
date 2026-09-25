---
title: "P, NP and NP-Completeness for Working Programmers"
description: "A question-driven tour of P, NP and NP-completeness: what checkable really means, how reductions connect problems, and what to do when your problem is NP-hard."
pillar: complexity
order: 6
author: markus
published: 2026-09-22
updated: 2026-09-22
level: intermediate
tags: [p-vs-np, np-complete, np-hard, reductions, subset-sum]
prerequisites: ["complexity/big-o-notation"]
sources:
  - title: "P vs NP Problem"
    url: "https://www.claymath.org/millennium/p-vs-np/"
    publisher: "Clay Mathematics Institute"
    accessed: 2026-09-22
  - title: "P (complexity class)"
    url: "https://xlinux.nist.gov/dads/HTML/p.html"
    publisher: "NIST Dictionary of Algorithms and Data Structures"
    accessed: 2026-09-22
  - title: "NP (complexity class)"
    url: "https://xlinux.nist.gov/dads/HTML/np.html"
    publisher: "NIST Dictionary of Algorithms and Data Structures"
    accessed: 2026-09-22
  - title: "NP-complete"
    url: "https://xlinux.nist.gov/dads/HTML/npcomplete.html"
    publisher: "NIST Dictionary of Algorithms and Data Structures"
    accessed: 2026-09-22
  - title: "NP-hard"
    url: "https://xlinux.nist.gov/dads/HTML/nphard.html"
    publisher: "NIST Dictionary of Algorithms and Data Structures"
    accessed: 2026-09-22
  - title: "decision problem"
    url: "https://xlinux.nist.gov/dads/HTML/decisionProblem.html"
    publisher: "NIST Dictionary of Algorithms and Data Structures"
    accessed: 2026-09-22
  - title: "reduction"
    url: "https://xlinux.nist.gov/dads/HTML/reduction.html"
    publisher: "NIST Dictionary of Algorithms and Data Structures"
    accessed: 2026-09-22
  - title: "polynomial time"
    url: "https://xlinux.nist.gov/dads/HTML/polynomialtm.html"
    publisher: "NIST Dictionary of Algorithms and Data Structures"
    accessed: 2026-09-22
  - title: "polynomial-time reduction"
    url: "https://xlinux.nist.gov/dads/HTML/polynomtredc.html"
    publisher: "NIST Dictionary of Algorithms and Data Structures"
    accessed: 2026-09-22
  - title: "Karp reduction"
    url: "https://xlinux.nist.gov/dads/HTML/karpreductin.html"
    publisher: "NIST Dictionary of Algorithms and Data Structures"
    accessed: 2026-09-22
  - title: "knapsack problem"
    url: "https://xlinux.nist.gov/dads/HTML/knapsackProblem.html"
    publisher: "NIST Dictionary of Algorithms and Data Structures"
    accessed: 2026-09-22
  - title: "polynomial approximation scheme"
    url: "https://xlinux.nist.gov/dads/HTML/polynomaprox.html"
    publisher: "NIST Dictionary of Algorithms and Data Structures"
    accessed: 2026-09-22
  - title: "fully polynomial approximation scheme"
    url: "https://xlinux.nist.gov/dads/HTML/fullypolynml.html"
    publisher: "NIST Dictionary of Algorithms and Data Structures"
    accessed: 2026-09-22
  - title: "halting problem"
    url: "https://xlinux.nist.gov/dads/HTML/haltingProblem.html"
    publisher: "NIST Dictionary of Algorithms and Data Structures"
    accessed: 2026-09-22
  - title: "Introduction to Algorithms, 4th ed., chapter 34 (NP-Completeness)"
    url: "https://mitpress.mit.edu/9780262046305/introduction-to-algorithms/"
    publisher: "MIT Press"
    accessed: 2026-09-22
draft: false
---

A payments system needs to pick a batch of pending invoices that sums to exactly the day's bank settlement figure, out of a few hundred candidates. Write the obvious loop — try every combination — and for 300 invoices that means checking up to 2³⁰⁰ subsets, a number with far more digits than there are atoms worth counting. Hand a computer one particular batch instead, and confirming it sums to the target takes one pass down the list. That gap, hard to find but trivial to check, is what P, NP and NP-completeness exist to name precisely. Subset-sum — the invoice problem with the details filed off — is the running example below, worked in C# both ways.

## What exactly is a decision problem?

A [decision problem](https://xlinux.nist.gov/dads/HTML/decisionProblem.html) is, in NIST's definition, "a problem with a 'yes' or 'no' answer" — equivalently a function whose only possible outputs are two values. Subset-sum's decision form is: *given a finite set of integers and a target integer, does some subset of the set sum exactly to the target?* That is a yes/no question about one specific instance, not a request to produce the subset.

Complexity theory is usually stated for decision problems because "yes" or "no" has a single, unambiguous cost to bound. The more natural-sounding version of many problems — *find* the subset, *find* the shortest route, *find* the best packing — is an optimization problem, and it is normally at least as hard as its decision twin: an algorithm that outputs an actual subset summing to the target also answers whether one exists, just by checking whether it returned anything. The rest of this page moves freely between the two, but every complexity claim below is a claim about the decision version.

## What does "P" mean for real code?

[P](https://xlinux.nist.gov/dads/HTML/p.html) is "the complexity class of languages that can be accepted by a deterministic Turing machine in polynomial time" — in the vocabulary of [Big-O notation](/complexity/big-o-notation/), a decision problem is in P if *some* algorithm decides every instance of size *n* in worst-case O(*n*ᵏ) steps for a fixed constant *k*. "Some" is doing real work in that sentence: showing a problem is in P only requires exhibiting one polynomial algorithm, however slow, not the fastest one. [Polynomial time](https://xlinux.nist.gov/dads/HTML/polynomialtm.html) itself is defined the same way Big-O states an upper bound: running time m(*n*) = O(*n*ᵏ) for a constant *k*.

Sorting a list, searching a sorted array, finding a shortest path in a graph with non-negative weights — all in P, all with known polynomial algorithms. The catch, and the reason this page exists, is the other direction: nobody has to prove a problem is *not* in P to make it worth studying. Not having found a polynomial algorithm after decades of trying is not the same statement as a proof that none exists, and for subset-sum specifically, that gap is exactly where the next few sections sit.

## What does "NP" mean — checking, not solving?

[NP](https://xlinux.nist.gov/dads/HTML/np.html) is "the complexity class of decision problems for which answers can be checked by an algorithm whose run time is polynomial in the size of the input." Crucially, that definition never asks how the answer was *found*. It asks whether, handed a proposed answer — a *certificate* — some algorithm can confirm it is correct, quickly. NIST's own illustration is a Hamiltonian cycle: nobody has to explain how a proposed tour of a graph was discovered in order to check it in one pass — walk it once, confirm every vertex appears exactly once and every step uses a real edge.

Subset-sum's certificate is the candidate subset itself. Given a set of items, a target, and a claimed selection, checking the claim is a single pass:

```csharp run id=subset-sum-verifier
using System.Globalization;

CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;

int[] items = [8, 5, 3, 9, 7, 14, 21, 4];
int target = 33;

// Certificates: which items are supposedly in the subset.
// candidate A: 8 + 21 + 4
bool[] correctPick =
    [true, false, false, false,
     false, false, true, true];
// candidate B: 5 + 9 + 7 + 4
bool[] wrongPick =
    [false, true, false, true,
     true, false, false, true];

Report("candidate A", correctPick);
Report("candidate B", wrongPick);

void Report(string name, bool[] chosen)
{
    long sum = VerifiedSum(items, chosen);
    bool valid = sum == target;
    Console.WriteLine(
        $"{name}: sum = {sum}, valid = {valid}");
}

static long VerifiedSum(int[] items, bool[] chosen)
{
    if (chosen.Length != items.Length)
        throw new ArgumentException(
            "A certificate must pick one true/false per item.");
    long sum = 0;
    for (int i = 0; i < items.Length; i++)
        if (chosen[i]) sum += items[i];
    return sum;
}
```

```text output
candidate A: sum = 33, valid = True
candidate B: sum = 25, valid = False
```

`VerifiedSum` is one loop over the items: O(*n*) time, however the candidate was produced. That single function is the entire reason subset-sum is in NP — the definition asks for a checker, not a solver, and this is that checker. Whether subset-sum is *also* in P — whether some algorithm can find such a certificate, not just confirm one, in polynomial time — is a separate question, and the next two sections build one candidate solver each.

One consequence of the two definitions falls straight out of them: **P ⊆ NP.** Any algorithm that solves a problem outright in polynomial time is, in particular, a polynomial-time way to check a certificate — run the solver and ignore whatever candidate was handed in. Every problem with a fast solver trivially has a fast checker too; the open question is whether the reverse ever fails.

::::exercise[Classify: checking fast, solving fast, or neither established yet]
For each task, say whether *checking* a proposed answer is obviously fast (so the problem is at least in NP), and whether *finding* an answer from scratch is obviously fast too (so it looks like it is in P) — or whether neither is established by what has been said so far.

1. Checking that a proposed route visits every city on a map exactly once and returns to the start (a Hamiltonian cycle).
2. Finding such a route, if one exists.
3. Checking that a proposed subset of a set of numbers sums to a target.
4. Checking that a list of a million numbers is already sorted.
5. Producing a sorted version of that list.

:::solution
1. Fast: walk the proposed route once, confirm every city appears exactly once and each consecutive pair is connected — O(*n*). At least in NP. This is literally NIST's own example for the definition of NP.
2. Not obviously fast — no known algorithm finds a Hamiltonian cycle in every graph in polynomial time, and none has been ruled out either. Unresolved by anything said so far.
3. Fast — one pass, exactly what `VerifiedSum` above does — O(*n*). At least in NP.
4. Fast — compare each item to the next, one pass, O(*n*). In P (checking a sequence for a property is generally at least as easy as producing one with that property).
5. Also fast — a comparison sort is O(*n* log *n*). Both directions of this task are fast, so unlike 1–2 there is no interesting checking/finding gap here at all.
:::
::::

## Brute force actually decides subset-sum — so why isn't that the end of the story?

Subset-sum is decidable: try every subset. For *n* items there are 2ⁿ possible subsets, so enumerating them all and summing each one settles the question with certainty.

```csharp run id=subset-sum-brute
#:property Optimize=true
using System.Diagnostics;
using System.Globalization;

CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;

Console.WriteLine(
    $"{"n",4}{"subsets",12}{"time",9}{"growth",8}");
double previousMs = 0;
int[] sizes = [14, 16, 18, 20, 22];
foreach (int n in sizes)
{
    int[] items = MakeItems(n);
    int target = SumOf(items) / 2;

    long start = Stopwatch.GetTimestamp();
    bool exists = AnySubsetSums(items, target);
    double ms = Stopwatch.GetElapsedTime(start).TotalMilliseconds;
    if (!exists) throw new InvalidOperationException("expected a match");

    string growth = previousMs == 0
        ? "" : $"x{ms / previousMs:F1}";
    Console.WriteLine(
        $"{n,4}{1L << n,12:N0}{ms,6:F0} ms{growth,8}");
    previousMs = ms;
}

static bool AnySubsetSums(int[] items, int target)
{
    int n = items.Length;
    long subsetCount = 1L << n;
    for (long mask = 0; mask < subsetCount; mask++)
    {
        int sum = 0;
        for (int i = 0; i < n; i++)
            if ((mask & (1L << i)) != 0)
                sum += items[i];
        if (sum == target) return true;
    }
    return false;
}

static int SumOf(int[] items)
{
    int total = 0;
    foreach (int item in items) total += item;
    return total;
}

static int[] MakeItems(int count)
{
    var random = new Random(3);
    var items = new int[count];
    for (int i = 0; i < count; i++)
        items[i] = random.Next(1, 100);
    return items;
}
```

```text output
   n     subsets     time  growth
  14      16,384[...] ms
  16      65,536[...] ms[...]
  18     262,144[...] ms[...]
  20   1,048,576[...] ms[...]
  22   4,194,304[...] ms[...]
```

One run on this machine printed:

```text
   n     subsets     time  growth
  14      16,384     1 ms
  16      65,536     3 ms    x3.0
  18     262,144    11 ms    x3.7
  20   1,048,576    46 ms    x4.2
  22   4,194,304   187 ms    x4.1
```

These numbers, and every other measured timing on this page, come from .NET 10.0.12 on Windows 11, x64, on a desktop Core i7-11700K; the milliseconds are specific to that machine, but the growth factor is not.

The subsets column is exact: 2ⁿ, doubling every time *n* goes up by one, quadrupling every two items — the O(2ⁿ) row of [the growth-rate table](/complexity/big-o-notation/#the-growth-rates-you-will-meet-judged-by-doubling), where doubling *n* squares the work instead of merely multiplying it. Every measured row above tracks that: two more items and the time roughly quadruples, on this machine, on this input. `AnySubsetSums` decides subset-sum correctly and it is not evidence of a bug that it gets much slower — that slowdown is the entire content of "exponential."

## A dynamic-programming subset-sum — and why "polynomial" is misleading here

Brute force repeats work: many different subsets share the same partial sum, and each is summed from scratch. [Dynamic programming](/glossary/#dynamic-programming) fixes that by tracking, after each item, the *set* of sums reachable so far, as a boolean array indexed by sum:

```csharp run id=subset-sum-dp
using System.Globalization;

CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;

// Sanity check against brute force on a small, hand-checkable instance.
int[] small = [11, 6, 19, 2, 15, 8];
bool dpSmall = SubsetSumExists(small, 23);   // 6 + 2 + 15 = 23
bool bruteSmall = BruteForceExists(small, 23);
if (dpSmall != bruteSmall)
    throw new InvalidOperationException("DP and brute force disagree.");
Console.WriteLine(
    $"DP agrees with brute force: {dpSmall}");

static bool SubsetSumExists(int[] items, int target)
{
    // reachable[s] becomes true once some subset seen so far sums to s.
    var reachable = new bool[target + 1];
    reachable[0] = true;
    foreach (int item in items)
    {
        for (int s = target; s >= item; s--)
            if (reachable[s - item])
                reachable[s] = true;
    }
    return reachable[target];
}

static bool BruteForceExists(int[] items, int target)
{
    int n = items.Length;
    for (long mask = 0; mask < (1L << n); mask++)
    {
        int sum = 0;
        for (int i = 0; i < n; i++)
            if ((mask & (1L << i)) != 0)
                sum += items[i];
        if (sum == target) return true;
    }
    return false;
}
```

```text output
DP agrees with brute force: True
```

Each item is looked at once per possible sum, so this runs in O(*n* · target) time and uses O(target) space — a table of `target + 1` booleans, filled *n* times over. For a target in the thousands and a few dozen items, that is a few hundred thousand array slots, nowhere near 2ⁿ:

```csharp run id=subset-sum-dp-scaling
#:property Optimize=true
using System.Diagnostics;
using System.Globalization;

CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;

const int ItemCount = 40;
var random = new Random(5);
int[] items = new int[ItemCount];
for (int i = 0; i < ItemCount; i++)
    items[i] = random.Next(1, 80_000);

Console.WriteLine(
    $"{"target",10}{"bits",6}{"time",9}{"growth",8}");
double previousMs = 0;
int[] targets =
    [50_000, 100_000, 200_000,
     400_000, 800_000, 1_600_000];
foreach (int target in targets)
{
    long start = Stopwatch.GetTimestamp();
    SubsetSumExists(items, target);
    double ms = Stopwatch.GetElapsedTime(start).TotalMilliseconds;

    int bits = (int)Math.Floor(Math.Log2(target)) + 1;
    string growth = previousMs == 0
        ? "" : $"x{ms / previousMs:F1}";
    Console.WriteLine(
        $"{target,10:N0}{bits,6}{ms,6:F1} ms{growth,8}");
    previousMs = ms;
}

static bool SubsetSumExists(int[] items, int target)
{
    var reachable = new bool[target + 1];
    reachable[0] = true;
    foreach (int item in items)
    {
        for (int s = target; s >= item; s--)
            if (reachable[s - item])
                reachable[s] = true;
    }
    return reachable[target];
}
```

```text output
    target  bits     time  growth
    50,000    16[...] ms
   100,000    17[...] ms[...]
   200,000    18[...] ms[...]
   400,000    19[...] ms[...]
   800,000    20[...] ms[...]
 1,600,000    21[...] ms[...]
```

One run on this machine printed:

```text
    target  bits     time  growth
    50,000    16     0.9 ms
   100,000    17     1.9 ms    x2.1
   200,000    18     3.7 ms    x1.9
   400,000    19     7.3 ms    x2.0
   800,000    20    14.9 ms    x2.0
 1,600,000    21    30.0 ms    x2.0
```

Read the two right-hand columns together. Every row doubles the target and the running time doubles with it, matching O(*n* · target) exactly. But look at `bits`: it climbs by exactly *one* each row, because doubling a number only adds one bit to how it is written down. That single extra bit doubles the running time. Expressed against the actual size of the input — the number of bits it takes to write `target` down, the way [the definition of polynomial time](https://xlinux.nist.gov/dads/HTML/polynomialtm.html) means it — this algorithm's cost is exponential, not polynomial, in the input length, even though it is a straightforward polynomial *arithmetic expression* in *n* and target. A running time that is polynomial in the numeric values appearing in the input but exponential in the number of bits needed to encode them is called *pseudo-polynomial*, a distinction CLRS develops using this exact problem (*Introduction to Algorithms*, 4th ed., chapter 34). It is why the DP algorithm above is a perfectly practical way to decide subset-sum when target is a few million — an invoice total, say — and a poor one once target is, for instance, a 256-bit cryptographic value: the table would need 2²⁵⁶ entries.

::::exercise[Extend the code: return the subset, not just yes or no]
`SubsetSumExists` answers a yes/no question. Change it to also return *which* items it used, by recording, for each newly reachable sum, the index of the item that reached it, then walking that trail backwards from `target` to `0`.

:::solution
Track one extra array, `reachedBy`, alongside `reachable`. `reachedBy[s]` holds the index of the item that first made sum `s` reachable, `-2` marks the base case `s = 0`, and `-1` marks "not reached yet."

```csharp run id=subset-sum-witness
using System.Globalization;
using System.Linq;

CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;

int[] items = [11, 6, 19, 2, 15, 8];
int target = 23;

(bool Exists, List<int> Chosen) result = SubsetSumWitness(items, target);
Console.WriteLine($"exists = {result.Exists}");
Console.WriteLine(
    "chosen indices: " + string.Join(", ", result.Chosen));
Console.WriteLine(
    "chosen values: " +
    string.Join(" + ", result.Chosen.Select(i => items[i])) +
    $" = {result.Chosen.Sum(i => items[i])}");

static (bool, List<int>) SubsetSumWitness(int[] items, int target)
{
    var reachedBy = new int[target + 1];
    Array.Fill(reachedBy, -1);
    reachedBy[0] = -2;

    for (int i = 0; i < items.Length; i++)
    {
        int item = items[i];
        for (int s = target; s >= item; s--)
            if (reachedBy[s] == -1 && s != 0 && reachedBy[s - item] != -1)
                reachedBy[s] = i;
    }

    if (reachedBy[target] == -1) return (false, []);

    var chosen = new List<int>();
    int remaining = target;
    while (remaining != 0)
    {
        int usedIndex = reachedBy[remaining];
        chosen.Add(usedIndex);
        remaining -= items[usedIndex];
    }
    return (true, chosen);
}
```

```text output
exists = True
chosen indices: 4, 3, 1
chosen values: 15 + 2 + 6 = 23
```

The certificate this produces is exactly the kind `VerifiedSum` checks earlier on this page — a subset of the items — which is the point: the DP *finds* a certificate; the O(*n*) verifier is a completely different, much simpler piece of code that only *checks* one.
:::
::::

## What is a polynomial-time reduction, and how does it connect two problems?

A [reduction](https://xlinux.nist.gov/dads/HTML/reduction.html) is "a computable transformation of one problem into another." A [polynomial-time reduction](https://xlinux.nist.gov/dads/HTML/polynomtredc.html) — a [Karp reduction](https://xlinux.nist.gov/dads/HTML/karpreductin.html), specifically, "a reduction given by a polynomial time computable transformation function" — adds one requirement beyond what those NIST definitions state outright: the transformation itself must run in polynomial time, and it must turn every "yes" instance of the first problem into a "yes" instance of the second, and every "no" into a "no." That answer-preserving clause is standard textbook material rather than something the NIST pages spell out — CLRS (already cited earlier on this page for the pseudo-polynomial distinction, and again below for subset-sum's own NP-completeness) develops it the same way.

That gives reductions a direct practical consequence: if problem A reduces to problem B in polynomial time, and B has a polynomial-time solver, then A does too — transform the instance (polynomial time), solve it as a B-instance (polynomial time), and the answer is correct for A as well; two polynomial steps in a row is still polynomial. Reductions are how "hardness" spreads from one problem to another without re-proving anything from scratch.

A short, concrete example: PARTITION asks whether a set of numbers can be split into two groups with equal sums. Every PARTITION instance reduces to a SUBSET-SUM instance by asking for exactly half the total:

<figure class="diagram">
<svg viewBox="0 0 340 335" role="img" aria-labelledby="pnp-reduce-title pnp-reduce-desc">
<title id="pnp-reduce-title">Partition reduces to Subset-Sum in polynomial time</title>
<desc id="pnp-reduce-desc">A box holding a Partition instance, the set 8, 5, 3, 9, 7, points down through a transform f that sets the target to half the total, 16, into a box holding the equivalent Subset-Sum instance. A second arrow points down to a result box: Subset-Sum answers yes because 9 and 7 sum to 16, and that same yes answers the original Partition question, since the remaining 8, 5, 3 also sums to 16.</desc>
<defs>
<marker id="pnp-reduce-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-accent"/></marker>
</defs>
<rect x="30" y="20" width="280" height="76" rx="8" class="d-box"/>
<text x="170" y="44" text-anchor="middle" class="d-bold">PARTITION instance</text>
<text x="170" y="64" text-anchor="middle" class="d-mono d-small">{8, 5, 3, 9, 7}</text>
<text x="170" y="82" text-anchor="middle" class="d-muted d-small">split into two equal-sum groups?</text>
<path d="M288 96 V132" class="d-accent" marker-end="url(#pnp-reduce-arrow)"/>
<text x="30" y="112" class="d-text-accent d-small">transform f, polynomial time:</text>
<text x="30" y="126" class="d-mono d-small">target = sum / 2 = 16</text>
<rect x="30" y="140" width="280" height="76" rx="8" class="d-box-accent"/>
<text x="170" y="164" text-anchor="middle" class="d-bold">SUBSET-SUM instance</text>
<text x="170" y="184" text-anchor="middle" class="d-mono d-small">{8, 5, 3, 9, 7}, target 16</text>
<text x="170" y="202" text-anchor="middle" class="d-muted d-small">same yes/no answer as above</text>
<path d="M288 216 V252" class="d-accent" marker-end="url(#pnp-reduce-arrow)"/>
<text x="30" y="232" class="d-text-accent d-small">solved by any Subset-Sum method:</text>
<text x="30" y="246" class="d-mono d-small">{9, 7} sums to 16</text>
<rect x="30" y="260" width="280" height="56" rx="8" class="d-box-good"/>
<text x="170" y="284" text-anchor="middle" class="d-bold">PARTITION answer: yes</text>
<text x="170" y="302" text-anchor="middle" class="d-muted d-small">remainder {8, 5, 3} also sums to 16</text>
</svg>
<figcaption>Figure 1. Every PARTITION instance reduces to a SUBSET-SUM instance by asking for half the total; solving the SUBSET-SUM instance answers the PARTITION question unchanged, because the transform runs in polynomial time and preserves the yes/no answer exactly.</figcaption>
</figure>

Computing the target (sum the numbers, divide by two) is a single O(*n*) pass — comfortably polynomial — so this reduction shows PARTITION is no harder than SUBSET-SUM: any algorithm that decides SUBSET-SUM also decides PARTITION, just behind one small transformation.

::::exercise[Prove it: the reduction is correct in both directions]
A reduction has to work both ways: a "yes" PARTITION instance must become a "yes" SUBSET-SUM instance, *and* a "no" PARTITION instance must become a "no" SUBSET-SUM instance. Prove both directions for `target = sum / 2`.

:::solution
Let the numbers be *S* with total sum *T*, and suppose *T* is even (if *T* is odd, no equal split is possible at all, and no subset of integers can sum to a non-integer *T*/2 either, so both sides are trivially "no").

**Yes implies yes.** If *S* splits into two groups *A* and *B* with equal sums, then sum(*A*) = sum(*B*) = *T*/2 (since sum(*A*) + sum(*B*) = *T* and the two are equal). So *A* is a subset of *S* summing to exactly *T*/2 — the SUBSET-SUM instance with target *T*/2 answers yes.

**No implies no** (equivalently, its contrapositive: yes implies yes, run the other way). If some subset *A* of *S* sums to exactly *T*/2, then its complement *B* = *S* − *A* sums to *T* − *T*/2 = *T*/2 as well. *A* and *B* partition *S* into two equal-sum groups, so PARTITION answers yes too.

Both directions hold for every instance, not just the example in the figure, which is what makes `target = sum / 2` a genuine reduction rather than a trick that happens to work on one input.
:::
::::

## NP-complete vs. NP-hard: what's actually the difference?

[NP-complete](https://xlinux.nist.gov/dads/HTML/npcomplete.html) means two things at once: the problem is in NP (a polynomial-time checker exists), *and* every other problem in NP reduces to it in polynomial time — informally, "answers can be verified quickly, and a quick algorithm to solve this problem can be used to solve all other NP problems quickly." The first NP-complete problem, Boolean satisfiability (SAT), was identified this way by Stephen Cook in 1971 and, independently, by Leonid Levin, whose paper appeared in 1973. Once one such problem is nailed down, showing a *new* problem is NP-complete no longer requires reasoning about every problem in NP directly — it only requires a polynomial-time reduction from an already-known NP-complete problem, exactly the kind of transformation the previous section built. Subset-sum is one of the problems reachable that way (again, CLRS chapter 34 develops the argument), and its close relative, the [decision version of the knapsack problem](https://xlinux.nist.gov/dads/HTML/knapsackProblem.html), is stated by NIST as NP-complete directly.

[NP-hard](https://xlinux.nist.gov/dads/HTML/nphard.html) drops the "in NP" half of that definition: it means "intrinsically harder than those that can be solved by a nondeterministic Turing machine in polynomial time" — every NP problem still has to reduce to it, but the problem itself is not required to have a polynomial-time checker, or even to be decidable at all. Every NP-complete problem is NP-hard; not every NP-hard problem is NP-complete. The [halting problem](https://xlinux.nist.gov/dads/HTML/haltingProblem.html) — "is there an algorithm to determine whether any arbitrary program halts?" — is the standard example: Turing proved no algorithm decides it, for any input size, so it cannot have a polynomial-time (or any-time) checker and is therefore not in NP at all, yet every NP problem still reduces to it (build a machine that halts exactly when a satisfying certificate exists), which is enough to make it NP-hard.

<figure class="diagram">
<svg viewBox="0 0 340 285" role="img" aria-labelledby="pnp-classes-title pnp-classes-desc">
<title id="pnp-classes-title">P, NP-complete and NP-hard, drawn assuming P is not NP</title>
<desc id="pnp-classes-desc">A wide shape labeled NP-hard sits on the right. A circle labeled NP overlaps its left edge; that overlap is labeled NP-complete. A smaller filled circle labeled P sits inside NP, away from the overlap. A dot outside the NP circle but inside NP-hard marks the halting problem, undecidable and so not even in NP. A note below says the whole picture assumes the unproven belief that P is not NP.</desc>
<ellipse cx="225" cy="110" rx="95" ry="80" class="d-box-2"/>
<circle cx="140" cy="110" r="85" class="d-accent" style="stroke-width:2.5"/>
<circle cx="78" cy="115" r="32" class="d-box-accent"/>
<text x="255" y="42" text-anchor="middle" class="d-bold">NP-hard</text>
<text x="85" y="50" text-anchor="middle" class="d-bold">NP</text>
<text x="78" y="119" text-anchor="middle" class="d-text-accent d-bold">P</text>
<text x="195" y="150" text-anchor="middle" class="d-small d-bold">NP-complete</text>
<circle cx="283" cy="54" r="4" class="d-fill-bad"/>
<text x="250" y="72" text-anchor="middle" class="d-small">halting problem</text>
<text x="250" y="88" text-anchor="middle" class="d-small d-muted">(undecidable, not in NP)</text>
<text x="20" y="215" class="d-muted d-small">P: fast to solve, e.g. sorting</text>
<text x="20" y="231" class="d-muted d-small">NP-complete: fast to check only,</text>
<text x="20" y="245" class="d-muted d-small">e.g. subset-sum, SAT</text>
<text x="20" y="263" class="d-bold d-small">Assumes P not-equal NP: believed, not proven.</text>
</svg>
<figcaption>Figure 2. P sits strictly inside NP, and NP-complete is the crescent where NP overlaps NP-hard — but only if P is not NP, which nobody has proven. NP-hard also reaches problems outside NP entirely, like the undecidable halting problem.</figcaption>
</figure>

The P circle in that picture is drawn disjoint from NP-hard, and that placement is itself a real, checkable claim, not just artistic license: if any NP-hard problem were in P, every NP problem would reduce to it in polynomial time and then solve in polynomial time too (compose the two polynomial steps, exactly as in the previous section), which forces P = NP. So the picture as drawn is only correct if P ≠ NP; if P = NP, the P circle would have to swallow the whole NP circle, NP-complete included, while NP-hard's undecidable outliers (the halting problem among them) stay exactly where they are, unaffected either way.

## Has anyone actually proven P ≠ NP?

No. The Clay Mathematics Institute lists [P vs NP](https://www.claymath.org/millennium/p-vs-np/) as one of its seven Millennium Prize Problems, each carrying a stated prize for a correct solution; as of this writing it is marked unsolved, one of six that remain open — only the Poincaré conjecture, among the seven, has been resolved. The Institute frames the question exactly the way this page has: "If it is easy to check that a solution to a problem is correct, is it also easy to solve the problem?" Nobody has published a proof of P = NP, and nobody has published a proof of P ≠ NP either.

What decades of attempts have produced is a long list of NP-complete problems — thousands of them, subset-sum among the smaller and more approachable — every one interconvertible by polynomial-time reductions, so that a genuine polynomial-time algorithm for *any single one* would immediately give one for *all of them*, resolving the Millennium Prize problem outright. That so many people, working on so many different NP-complete problems for so long, have never found one is often treated as informal evidence for P ≠ NP. It is not a substitute for a proof, and this page makes no claim about which way the open question will eventually go.

## How do you recognize an NP-hard problem at work?

The invoice-reconciliation example that opened this page is a real shape, not a contrived one: *does some combination of these numbers hit an exact target* is subset-sum with the serial numbers filed off, and it shows up anywhere a set of transactions, weights, durations or amounts has to add up exactly — cash-drawer reconciliation, matching a batch of payments to a settlement figure, packing a shipment to a weight limit. A few other shapes recur just as often:

- **Visit or process a set of things where the order changes the cost**, and you need the best order, not just any order — delivery routing, tool-path planning, any "traveling salesperson"-flavored problem.
- **Assign labels, colors or time slots to items so that conflicting ones never collide** — exam or shift scheduling, register allocation, spectrum assignment.
- **Choose the best-value subset under a hard budget** — which is knapsack, subset-sum's closer relative, whenever items carry both a cost and a separate value.

Not everything that sounds combinatorial belongs on that list. Finding a shortest path, a minimum spanning tree, or a maximum bipartite matching are all well-known polynomial problems with long-established algorithms; the giveaway for the NP-hard shapes above is that no polynomial algorithm is known for the *general* case, not merely that the problem involves choices or graphs.

## Your problem is NP-hard. Now what?

Being NP-hard is a statement about the worst case over every possible instance, not a verdict on the one instance sitting in front of you. A few practical responses, roughly in the order worth trying first:

- **Solve it exactly, if the instance is small enough.** The DP above is already the practical exact answer for subset-sum whenever the target stays bounded — a reconciliation target of a few million cents is nothing for an O(*n* · target) table. For the shapes where no such bound exists, brute force with aggressive pruning, or a general integer/constraint solver, regularly disposes of instances with tens or low hundreds of items well inside a second; NP-hard describes what happens as instances grow without bound, not what happens at the sizes many real jobs actually have.
- **Reach for an approximation algorithm when a bounded gap from optimal is acceptable.** Some NP-hard optimization problems have a known [polynomial approximation scheme](https://xlinux.nist.gov/dads/HTML/polynomaprox.html) (a PTAS): a family of algorithms, one per accuracy level ε, each running in polynomial time and guaranteed to land within a factor of (1 + ε) of optimal. A [fully polynomial approximation scheme](https://xlinux.nist.gov/dads/HTML/fullypolynml.html) (FPTAS) strengthens that further, running in time polynomial in both the input size *and* 1/ε. Neither exists for every NP-hard problem, but it is worth checking before assuming none does.
- **Fall back to a heuristic with no guarantee, on a time budget.** Greedy construction, local search, simulated annealing and similar methods routinely find good — not provably optimal — answers to problems where nothing else finishes. Comparing a heuristic's answer against a cheap relaxation of the problem (drop a constraint, solve what remains) at least bounds how far from optimal it could be.

## A verifier that lies: find the bug

A verifier is only as trustworthy as its checks. The whole argument that subset-sum is in NP rests on a verifier that never accepts a bad certificate — so it is worth seeing one that does.

::::exercise[Find the bug: a verifier that lies]
Here is a verifier meant to check the same thing `VerifiedSum` does earlier on this page, working from a list of chosen *indices* instead of a boolean mask:

```text
static bool VerifyByIndices(
    int[] items, int[] chosenIndices, int target)
{
    int sum = 0;
    foreach (int index in chosenIndices)
        sum += items[index];
    return sum == target;
}
```

For `items = [7, 5, 3]`, `target = 21`, and the certificate `[0, 0, 0]` (index 0, three times over): what does this function return, and is that the correct answer to "does some *subset* of `items` sum to 21"? If not, what check is missing?

:::solution
It returns `True` — wrong. `items` contains exactly one `7`; no subset can use it three times, but `VerifyByIndices` never checks whether an index repeats, so it sums the same slot three times over and calls that valid:

```csharp run id=buggy-verifier
using System.Globalization;

CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;

int[] items = [7, 5, 3];
int[] chosenIndices = [0, 0, 0];
Console.WriteLine(
    $"valid = {VerifyByIndices(items, chosenIndices, 21)}");

static bool VerifyByIndices(
    int[] items, int[] chosenIndices, int target)
{
    int sum = 0;
    foreach (int index in chosenIndices)
        sum += items[index];
    return sum == target;
}
```

```text output
valid = True
```

The fix rejects a repeated index before trusting the sum:

```csharp run id=fixed-verifier
using System.Globalization;

CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;

int[] items = [7, 5, 3];

int[] repeated = [0, 0, 0];
int[] genuine = [0, 1];
Console.WriteLine(
    $"repeated, target 21: valid = {VerifyByIndices(items, repeated, 21)}");
Console.WriteLine(
    $"genuine, target 12: valid = {VerifyByIndices(items, genuine, 12)}");

static bool VerifyByIndices(int[] items, int[] chosenIndices, int target)
{
    var seen = new HashSet<int>();
    int sum = 0;
    foreach (int index in chosenIndices)
    {
        if (!seen.Add(index)) return false;
        sum += items[index];
    }
    return sum == target;
}
```

```text output
repeated, target 21: valid = False
genuine, target 12: valid = True
```

This is exactly why the verifier earlier on this page uses a boolean mask, one slot per item, instead of a list of indices: a mask has no way to say "use this item twice," so the bug above has nothing to attach to.
:::
::::
