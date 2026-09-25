---
title: "Greedy Algorithms and How to Know When They Work"
description: "A greedy coin-change algorithm that returns three coins where two exist, the exchange-argument proof for when greedy is safe, and where it actually works."
pillar: algorithms
order: 7
author: markus
published: 2026-09-22
updated: 2026-09-22
level: intermediate
tags: [greedy-algorithms, exchange-argument, interval-scheduling, huffman-coding, priority-queue, dynamic-programming]
prerequisites: ["complexity/big-o-notation"]
sources:
  - title: "Introduction to Algorithms, 4th ed., chapter 15: Greedy Algorithms"
    url: "https://mitpress.mit.edu/9780262046305/introduction-to-algorithms/"
    publisher: "MIT Press"
    accessed: 2026-09-22
  - title: "Introduction to Algorithms, 4th ed., chapter 14: Dynamic Programming"
    url: "https://mitpress.mit.edu/9780262046305/introduction-to-algorithms/"
    publisher: "MIT Press"
    accessed: 2026-09-22
  - title: "PriorityQueue<TElement,TPriority> Class"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.priorityqueue-2"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Enumerable.OrderBy Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.linq.enumerable.orderby"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
draft: false
---

A **greedy algorithm** builds a solution one choice at a time, and at each step it takes whatever looks best right now and never revisits that choice. Making change is the textbook first example, so start there: given coins worth 1, 3, and 4, make 6 units of change with as few coins as possible, by always taking the largest coin that still fits.

```csharp run id=greedy-coins
int[] denominations = [4, 3, 1]; // largest first
int target = 6;

var picks = new List<int>();
int remaining = target;
foreach (int coin in denominations)
{
    while (remaining >= coin)
    {
        picks.Add(coin);
        remaining -= coin;
    }
}

Console.WriteLine($"target: {target}");
Console.WriteLine($"greedy picks: {string.Join(" + ", picks)}");
Console.WriteLine($"coin count: {picks.Count}");
```

```text output
target: 6
greedy picks: 4 + 1 + 1
coin count: 3
```

Three coins. But 3 + 3 is also 6, and that is two coins. A brute-force check confirms two is the best possible, by trying every combination of coins that sums to 6 and keeping the shortest:

```csharp run id=optimal-coins
int[] denominations = [4, 3, 1];
int target = 6;

int[] minCoins = new int[target + 1];
List<int>?[] chosen = new List<int>?[target + 1];
Array.Fill(minCoins, int.MaxValue);
minCoins[0] = 0;
chosen[0] = [];

for (int amount = 1; amount <= target; amount++)
{
    foreach (int coin in denominations)
    {
        if (coin > amount) continue;
        int candidate = minCoins[amount - coin];
        if (candidate == int.MaxValue) continue;
        if (candidate + 1 < minCoins[amount])
        {
            minCoins[amount] = candidate + 1;
            chosen[amount] = [.. chosen[amount - coin]!, coin];
        }
    }
}

Console.WriteLine($"optimal coin count: {minCoins[target]}");
Console.WriteLine($"optimal picks: {string.Join(" + ", chosen[target]!)}");
```

```text output
optimal coin count: 2
optimal picks: 3 + 3
```

The greedy loop is not buggy in the way a binary search with an off-by-one is buggy; it does exactly what "always take the largest coin that fits" says to do. The algorithm itself is the wrong tool for this input. The rest of this page is about telling those two situations apart before you ship a greedy algorithm: how to check whether greedy matches optimal, the proof technique that establishes it for good, and two real problems — scheduling and compression — where that proof goes through.

## Checking whether greedy matches optimal, systematically

One counterexample is enough to disprove "greedy always works for coin change", but it says nothing about *which* coin systems are safe. The check below runs greedy and an exact dynamic-programming solver against every amount up to a limit, for two denomination sets, and reports the first amount where they disagree — or that none was found.

```csharp run id=coin-checker
int[] oddCoins = [1, 3, 4];
int[] usCoins = [1, 5, 10, 25];

Report("{1, 3, 4}", oddCoins, 30);
Report("{1, 5, 10, 25}", usCoins, 1000);

static void Report(string name, int[] denominations, int upTo)
{
    int? gap = FirstDisagreement(denominations, upTo);
    Console.WriteLine(gap is int amount
        ? $"{name,-16}first wrong at {amount}"
        : $"{name,-16}no gap up to {upTo}");
}

static int? FirstDisagreement(int[] denominations, int upTo)
{
    int[] optimal = MinCoins(denominations, upTo);
    for (int amount = 1; amount <= upTo; amount++)
        if (GreedyCoinCount(denominations, amount) != optimal[amount])
            return amount;
    return null;
}

static int GreedyCoinCount(int[] denominations, int amount)
{
    int count = 0, remaining = amount;
    foreach (int coin in denominations.OrderDescending())
    {
        count += remaining / coin;
        remaining %= coin;
    }
    return remaining == 0 ? count : int.MaxValue;
}

static int[] MinCoins(int[] denominations, int upTo)
{
    int[] minCoins = new int[upTo + 1];
    Array.Fill(minCoins, int.MaxValue);
    minCoins[0] = 0;
    for (int amount = 1; amount <= upTo; amount++)
        foreach (int coin in denominations)
            if (coin <= amount && minCoins[amount - coin] != int.MaxValue)
                minCoins[amount] = Math.Min(minCoins[amount], minCoins[amount - coin] + 1);
    return minCoins;
}
```

```text output
{1, 3, 4}       first wrong at 6
{1, 5, 10, 25}  no gap up to 1000
```

Both denomination sets let greedy make exact change for every amount (they all include a 1-unit coin), so `GreedyCoinCount` never hits the `int.MaxValue` sentinel here. `{1, 3, 4}` breaks at the smallest amount where it can, 6. `{1, 5, 10, 25}` — the familiar U.S. coins — turns up no disagreement across every amount from 1 to 1,000. That is evidence for a system that happens to be "greedy-safe", not a proof of it for every amount; the next section is about what an actual proof needs.

::::exercise[Prove it: a second failing system]
Denominations `{1, 4, 5}` also include a 1-unit coin, so greedy can always make change. Without running anything, find the smallest amount where its greedy pick count differs from optimal, and say what each one picks.

:::solution
The smallest failing amount is 8. Greedy takes the largest coin first: 5, leaving 3, then two 1s — `5 + 1 + 1 + 1`, four coins. The optimal answer is `4 + 4`, two coins. Every amount below 8 has only one way greedy and an exhaustive search could differ, and none of them do: 1 through 4 use a single coin each, 5 is a single 5-coin, 6 is `5 + 1`, 7 is `5 + 1 + 1`, and all of those already match what a search would find, because there is no `4 + 4`-style combination available yet. Checked directly:

```csharp run
int[] denominations = [1, 4, 5];
for (int amount = 1; amount <= 8; amount++)
{
    int greedy = GreedyCoinCount(denominations, amount);
    int optimal = MinCoins(denominations, amount)[amount];
    Console.WriteLine($"{amount}: greedy {greedy}, optimal {optimal}");
}

static int GreedyCoinCount(int[] denominations, int amount)
{
    int count = 0, remaining = amount;
    foreach (int coin in denominations.OrderDescending())
    {
        count += remaining / coin;
        remaining %= coin;
    }
    return count;
}

static int[] MinCoins(int[] denominations, int upTo)
{
    int[] minCoins = new int[upTo + 1];
    Array.Fill(minCoins, int.MaxValue);
    minCoins[0] = 0;
    for (int amount = 1; amount <= upTo; amount++)
        foreach (int coin in denominations)
            if (coin <= amount && minCoins[amount - coin] != int.MaxValue)
                minCoins[amount] = Math.Min(minCoins[amount], minCoins[amount - coin] + 1);
    return minCoins;
}
```

```text output
1: greedy 1, optimal 1
2: greedy 2, optimal 2
3: greedy 3, optimal 3
4: greedy 1, optimal 1
5: greedy 1, optimal 1
6: greedy 2, optimal 2
7: greedy 3, optimal 3
8: greedy 4, optimal 2
```
:::
::::

## The exchange argument: proving a greedy choice is safe

"No counterexample up to 1,000" is not a proof, and hand-checking every amount does not scale to every problem greedy gets applied to. The standard technique for proving a greedy algorithm correct — used for both problems later on this page — is an **exchange argument**, structured in two parts, as laid out in CLRS chapter 15:

1. **Greedy-choice property.** Show that there is *some* optimal solution that starts with the choice greedy makes. Usually by taking an arbitrary optimal solution and showing it can be rewritten ("exchanged") to include greedy's choice without getting worse.
2. **Optimal substructure.** Show that once greedy's first choice is fixed, the rest of the problem is a smaller instance of the same problem, so the same argument applies again to the remaining choices.

Together, these mean greedy's first choice is never a mistake, and neither is any choice after it, by induction. That is a much stronger claim than "greedy's choice looks reasonable" — it has to be a choice that *some* optimal solution actually makes, and step 1 is exactly where the coin-change example above falls apart. For `{1, 3, 4}` and amount 6, greedy's first choice is a 4-coin. But the exercise above already computed every optimal solution up to 8, and the only optimal solution for 6 is `3 + 3` — no optimal solution for 6 contains a 4-coin. There is no optimal solution to exchange into, so the greedy-choice property is false at the very first step, and the proof technique gets no foothold. This is not a proof that *every* coin system fails the same way (`{1, 5, 10, 25}` did not, up to 1,000) — it is a proof that this particular exchange fails for this particular system, which is all "showing a counterexample" ever establishes.

The next two sections apply the same two-part argument to problems where step 1 actually goes through.

## Interval scheduling: choosing the right thing to sort by

Interval scheduling asks: given a set of time intervals, pick the largest possible subset with no two overlapping. Picture a single 3D printer and a queue of print jobs, each needing exclusive use of the printer for a fixed start and end time; the shop wants to run as many jobs as possible on that one printer today.

```csharp run id=interval-scheduling
(string Name, int Start, int End)[] jobs =
[
    ("J1", 0, 20),
    ("J2", 10, 40),
    ("J3", 30, 50),
    ("J4", 40, 70),
    ("J5", 60, 80),
    ("J6", 70, 90),
];

var scheduled = MaxNonOverlapping(jobs);
Console.WriteLine($"scheduled: {string.Join(", ", scheduled.Select(j => j.Name))}");
Console.WriteLine($"count: {scheduled.Count} of {jobs.Length}");

static List<(string Name, int Start, int End)> MaxNonOverlapping(
    (string Name, int Start, int End)[] jobs)
{
    // Sort by finish time, not start time or duration — the
    // exchange argument below only goes through for this key.
    var byFinish = jobs.OrderBy(j => j.End).ToArray();
    var chosen = new List<(string Name, int Start, int End)>();
    int lastEnd = int.MinValue;
    foreach (var job in byFinish)
    {
        if (job.Start >= lastEnd)
        {
            chosen.Add(job);
            lastEnd = job.End;
        }
    }
    return chosen;
}
```

```text output
scheduled: J1, J3, J5
count: 3 of 6
```

Figure 1 walks through the same six jobs, already listed in order of increasing finish time.

<figure class="diagram">
<svg viewBox="0 0 360 320" role="img" aria-labelledby="sched-title sched-desc">
<title id="sched-title">Greedy interval scheduling processing six print jobs by finish time</title>
<desc id="sched-desc">A time axis from 0 to 90 minutes above six bars, one per print job, in order of increasing finish time. J1 0 to 20, J3 30 to 50, and J5 60 to 80 are marked selected. J2 10 to 40, J4 40 to 70, and J6 70 to 90 are marked rejected because each starts before the greedy algorithm's most recently selected end time.</desc>
<line x1="20" y1="34" x2="290" y2="34" class="d-line"/>
<text x="20" y="22" class="d-small d-muted">0</text>
<text x="80" y="22" text-anchor="middle" class="d-small d-muted">20</text>
<text x="140" y="22" text-anchor="middle" class="d-small d-muted">40</text>
<text x="200" y="22" text-anchor="middle" class="d-small d-muted">60</text>
<text x="260" y="22" text-anchor="middle" class="d-small d-muted">80</text>
<rect x="20" y="44" width="60" height="22" class="d-box-good"/>
<text x="50" y="59" text-anchor="middle" class="d-mono d-small">J1</text>
<text x="20" y="80" class="d-small">selected: 0-20</text>
<rect x="50" y="90" width="90" height="22" class="d-box-bad"/>
<text x="95" y="105" text-anchor="middle" class="d-mono d-small">J2</text>
<text x="20" y="126" class="d-small">rejected: starts at 10, before 20</text>
<rect x="110" y="136" width="60" height="22" class="d-box-good"/>
<text x="140" y="151" text-anchor="middle" class="d-mono d-small">J3</text>
<text x="20" y="172" class="d-small">selected: 30-50</text>
<rect x="140" y="182" width="90" height="22" class="d-box-bad"/>
<text x="185" y="197" text-anchor="middle" class="d-mono d-small">J4</text>
<text x="20" y="218" class="d-small">rejected: starts at 40, before 50</text>
<rect x="200" y="228" width="60" height="22" class="d-box-good"/>
<text x="230" y="243" text-anchor="middle" class="d-mono d-small">J5</text>
<text x="20" y="264" class="d-small">selected: 60-80</text>
<rect x="230" y="274" width="60" height="22" class="d-box-bad"/>
<text x="260" y="289" text-anchor="middle" class="d-mono d-small">J6</text>
<text x="20" y="310" class="d-small">rejected: starts at 70, before 80</text>
</svg>
<figcaption>Figure 1. Six jobs scanned in finish-time order. J1 is free to take, which fixes the printer's next-available time at 20. J2 needs the printer starting at 10, still occupied, so it is skipped; J3 does not need it until 30, so it is taken and next-available becomes 50, and the pattern repeats.</figcaption>
</figure>

Why finish time and not, say, shortest job first, or earliest start first? Because only "earliest finish time" makes step 1 of the exchange argument true. The claim: **some optimal schedule includes the job with the single earliest finish time.**

This follows CLRS's exchange-argument structure for the activity-selection problem (chapter 15.1), applied here to the print-job example above rather than its own. Let *j\** be the job with the earliest finish time overall, and let *O* be any optimal schedule. If *O* already contains *j\**, there is nothing to show. Otherwise, let *o\** be the job in *O* with the earliest finish time. Because *j\** has the earliest finish time of *every* job, `End(j*) <= End(o*)`. Every other job in *O* is compatible with *o\**, meaning it starts at or after `End(o*)`, and therefore also starts at or after `End(j*)`. So replacing *o\** with *j\** keeps every pair in *O* compatible: *O′* = *O* − {*o\**} + {*j\**} is still a valid non-overlapping schedule, and it has exactly as many jobs as *O*. *O′* is optimal and contains *j\**, which is what the claim needed.

For step 2, once *j\** is fixed, every job that overlaps it can never be scheduled alongside it, so the remaining problem is exactly the same problem on the jobs that start at or after `End(j*)` — a strictly smaller instance. Applying the same argument to that smaller instance, and to the one after that, is what the `foreach` loop in the code above is actually doing: each iteration re-solves a shrinking instance of the same claim.

The cost is dominated by the sort: [`OrderBy`](https://learn.microsoft.com/en-us/dotnet/api/system.linq.enumerable.orderby) is O(*n* log *n*) as a comparison sort, and [the documentation states it performs a stable sort](https://learn.microsoft.com/en-us/dotnet/api/system.linq.enumerable.orderby) (not load-bearing here, since finish times in this example are distinct, but it would matter for jobs that tie). The scan afterward is a single O(*n*) pass. Total: O(*n* log *n*).

::::exercise[Extend the code: when the exchange argument stops applying]
Give each job a `Value` in addition to `Start` and `End`, and change the goal to *maximize total value* of the scheduled jobs rather than maximizing the count. Does sorting by finish time and taking every compatible job still produce an optimal answer? Try it on three jobs: `("A", 0, 10, 1)`, `("B", 0, 5, 2)`, `("C", 6, 10, 2)`, where the fourth number is `Value`.

:::solution
No. Sorted by finish time, greedy meets `B` (0-5, value 2) first and takes it, fixing `lastEnd = 5`. It then sees `A` (0-10, value 1), which starts before 5 and is rejected, and `C` (6-10, value 2), which starts after 5 and is taken. Total: `B + C` = 4.

```csharp run
(string Name, int Start, int End, int Value)[] jobs =
[
    ("A", 0, 10, 1),
    ("B", 0, 5, 2),
    ("C", 6, 10, 2),
];

var byFinish = jobs.OrderBy(j => j.End).ToArray();
var chosen = new List<(string Name, int Start, int End, int Value)>();
int lastEnd = int.MinValue, totalValue = 0;
foreach (var job in byFinish)
{
    if (job.Start >= lastEnd)
    {
        chosen.Add(job);
        lastEnd = job.End;
        totalValue += job.Value;
    }
}
Console.WriteLine($"greedy picks: {string.Join(", ", chosen.Select(j => j.Name))}");
Console.WriteLine($"greedy value: {totalValue}");
```

```text output
greedy picks: B, C
greedy value: 4
```

But `A` alone is also compatible with nothing else and is worth only 1, so that is not the counterexample — the real problem is that `B` was never worth giving up. Taking only `A` scores 1, `B + C` scores 4: greedy's answer of 4 is in fact optimal *here*. The counterexample needs the high-value job to conflict with two lower-value but still-valuable ones: replace `A` with `("A", 0, 10, 5)`. Now `A` alone scores 5, beating greedy's `B + C` at 4 — greedy picked the job that finished first without checking whether giving it up would have paid for two others. The greedy-choice property from the interval-scheduling proof no longer holds, because the earliest-finishing job is not always part of an optimal *weighted* solution. Weighted interval scheduling needs to consider both taking and skipping each job and remember the best result so far — [the DP article on this site](/algorithms/dynamic-programming/) covers that construction.
:::
::::

## Huffman coding: a greedy choice made one merge at a time

Huffman coding builds a binary code for a set of symbols, assigning short bit strings to frequent symbols and long ones to rare symbols, such that no code is a prefix of another (so a decoder never has to guess where one symbol's code ends and the next begins). The greedy rule: repeatedly take the two *least* frequent remaining symbols (or partial groups) and merge them into a new node whose frequency is their sum, until one node is left. That final node is the root of the code tree.

```csharp run id=huffman
string text = "MISSISSIPPI";

var frequencies = new Dictionary<char, int>();
var firstSeen = new List<char>();
foreach (char c in text)
{
    if (!frequencies.ContainsKey(c)) firstSeen.Add(c);
    frequencies[c] = frequencies.GetValueOrDefault(c) + 1;
}

var (root, codes) = BuildHuffmanTree(frequencies, firstSeen);

Console.WriteLine("char  freq  code");
foreach (char c in firstSeen)
    Console.WriteLine($"{c,4}  {frequencies[c],4}  {codes[c]}");

string encoded = string.Concat(text.Select(c => codes[c]));
string decoded = Decode(root, encoded);

int alphabetBits = (int)Math.Ceiling(Math.Log2(frequencies.Count));
Console.WriteLine($"ASCII (8 bits each): {text.Length * 8} bits");
Console.WriteLine($"fixed {alphabetBits}-bit code:   {text.Length * alphabetBits} bits");
Console.WriteLine($"Huffman code:        {encoded.Length} bits");
Console.WriteLine($"round-trip:          {(decoded == text ? "matches" : "MISMATCH")}");

static (HuffmanNode Root, Dictionary<char, string> Codes) BuildHuffmanTree(
    Dictionary<char, int> frequencies, List<char> firstSeen)
{
    // TPriority is (Frequency, Order): PriorityQueue does not promise
    // FIFO order for equal priorities, so Order breaks ties ourselves.
    var queue = new PriorityQueue<HuffmanNode, (int Freq, int Order)>();
    int order = 0;
    foreach (char c in firstSeen)
    {
        var leaf = new HuffmanNode { Symbol = c, Frequency = frequencies[c] };
        queue.Enqueue(leaf, (leaf.Frequency, order++));
    }

    while (queue.Count > 1)
    {
        var left = queue.Dequeue();
        var right = queue.Dequeue();
        var merged = new HuffmanNode
        {
            Frequency = left.Frequency + right.Frequency,
            Left = left,
            Right = right,
        };
        queue.Enqueue(merged, (merged.Frequency, order++));
    }

    var root = queue.Dequeue();
    var codes = new Dictionary<char, string>();
    AssignCodes(root, "", codes);
    return (root, codes);
}

static void AssignCodes(HuffmanNode node, string prefix, Dictionary<char, string> codes)
{
    if (node.IsLeaf)
    {
        codes[node.Symbol] = prefix.Length == 0 ? "0" : prefix;
        return;
    }
    AssignCodes(node.Left!, prefix + "0", codes);
    AssignCodes(node.Right!, prefix + "1", codes);
}

static string Decode(HuffmanNode root, string encoded)
{
    var result = new System.Text.StringBuilder();
    var node = root;
    foreach (char bit in encoded)
    {
        node = bit == '0' ? node.Left! : node.Right!;
        if (node.IsLeaf)
        {
            result.Append(node.Symbol);
            node = root;
        }
    }
    return result.ToString();
}

sealed class HuffmanNode
{
    public char Symbol;
    public int Frequency;
    public HuffmanNode? Left;
    public HuffmanNode? Right;
    public bool IsLeaf => Left is null && Right is null;
}
```

```text output
char  freq  code
   M     1  100
   I     4  11
   S     4  0
   P     2  101
ASCII (8 bits each): 88 bits
fixed 2-bit code:   22 bits
Huffman code:        21 bits
round-trip:          matches
```

:::dotnet
[The class remarks for `PriorityQueue<TElement,TPriority>`](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.priorityqueue-2) state it "implements an array-backed, quaternary min-heap" and that "the type does not guarantee first-in-first-out semantics for elements of equal priority." Two leaves that start with the same frequency — `I` and `S` above both start at 4 — would merge in whichever order the heap's internal layout happens to produce, unless the code breaks the tie itself. Packing `(Frequency, Order)` into `TPriority` and letting `System.ValueTuple`'s built-in lexicographic comparison do the tie-breaking is what makes the merge order (and therefore the exact codes) reproducible here.
:::

Figure 2 shows the tree `BuildHuffmanTree` produced for `MISSISSIPPI`: `S` and `I` are the two most frequent letters and end up closest to the root, while the single `M` is furthest away.

<figure class="diagram">
<svg viewBox="0 0 360 300" role="img" aria-labelledby="huff-title huff-desc">
<title id="huff-title">Huffman tree built for the letters of MISSISSIPPI</title>
<desc id="huff-desc">A binary tree with root frequency 11. The root's left child is the leaf S, frequency 4, code 0. The root's right child is an internal node, frequency 7, whose own children are an internal node of frequency 3 and the leaf I, frequency 4, code 11. The frequency-3 node's children are the leaves M, frequency 1, code 100, and P, frequency 2, code 101.</desc>
<line x1="180" y1="46" x2="90" y2="78" class="d-line"/>
<text x="128" y="58" class="d-small d-muted">0</text>
<line x1="180" y1="46" x2="270" y2="84" class="d-line"/>
<text x="232" y="60" class="d-small d-muted">1</text>
<line x1="270" y1="116" x2="230" y2="154" class="d-line"/>
<text x="245" y="132" class="d-small d-muted">0</text>
<line x1="270" y1="116" x2="320" y2="148" class="d-line"/>
<text x="300" y="128" class="d-small d-muted">1</text>
<line x1="230" y1="186" x2="200" y2="218" class="d-line"/>
<text x="210" y="199" class="d-small d-muted">0</text>
<line x1="230" y1="186" x2="260" y2="218" class="d-line"/>
<text x="250" y="199" class="d-small d-muted">1</text>
<rect x="152" y="14" width="56" height="32" class="d-box"/>
<text x="180" y="34" text-anchor="middle" class="d-mono d-small">11</text>
<rect x="62" y="78" width="56" height="40" class="d-box-good"/>
<text x="90" y="94" text-anchor="middle" class="d-mono d-small d-bold">S:4</text>
<text x="90" y="110" text-anchor="middle" class="d-mono d-small">code 0</text>
<rect x="242" y="84" width="56" height="32" class="d-box"/>
<text x="270" y="104" text-anchor="middle" class="d-mono d-small">7</text>
<rect x="202" y="154" width="56" height="32" class="d-box"/>
<text x="230" y="174" text-anchor="middle" class="d-mono d-small">3</text>
<rect x="292" y="148" width="56" height="40" class="d-box-good"/>
<text x="320" y="164" text-anchor="middle" class="d-mono d-small d-bold">I:4</text>
<text x="320" y="180" text-anchor="middle" class="d-mono d-small">code 11</text>
<rect x="172" y="218" width="56" height="40" class="d-box-good"/>
<text x="200" y="234" text-anchor="middle" class="d-mono d-small d-bold">M:1</text>
<text x="200" y="250" text-anchor="middle" class="d-mono d-small">code 100</text>
<rect x="232" y="218" width="56" height="40" class="d-box-good"/>
<text x="260" y="234" text-anchor="middle" class="d-mono d-small d-bold">P:2</text>
<text x="260" y="250" text-anchor="middle" class="d-mono d-small">code 101</text>
<text x="20" y="282" class="d-small d-muted">Leaf boxes: symbol:frequency, and its code.</text>
</svg>
<figcaption>Figure 2. Building the tree bottom-up: M and P (the two smallest frequencies, 1 and 2) merge first into a node of frequency 3; that node and I (frequency 4) merge into frequency 7; finally that node and S (frequency 4) merge into the root. Reading root-to-leaf gives each symbol's code.</figcaption>
</figure>

`S` and `I` — the two most frequent letters — get the two shortest codes (1 bit and 2 bits); `M`, appearing once, gets the longest (3 bits). CLRS proves the greedy-choice property behind this (chapter 15.3) with its own exchange argument: in any optimal code tree, the two least-frequent symbols can always be made siblings at the tree's greatest depth without increasing the tree's total cost, which is exactly the pair the algorithm merges first. Encoding text this way needs `n` − 1 merges for an alphabet of `n` distinct symbols, and each merge does one dequeue-dequeue-enqueue on a heap of size at most `n`, so building the tree is O(*n* log *n*) in the size of the *alphabet* — not the length of the text being compressed, which is what actually decides the resulting code's bit length.

On `MISSISSIPPI`, Huffman's 21 bits beats even a flat 2-bit-per-symbol code (22 bits) that ignores frequency entirely, and both are far below 88 bits of unpacked ASCII. That margin over the flat code is small here because the alphabet has only 4 symbols with fairly close frequencies (4, 4, 2, 1); a skewed distribution over a larger alphabet — natural-language text, for instance — is where Huffman coding earns most of its keep, because a fixed-width code cannot give any symbol fewer bits than `⌈log₂ n⌉`, however common it is, while Huffman can.

::::exercise[Predict the codes before running them]
A four-symbol alphabet has frequencies `A: 1, B: 1, C: 1, D: 5`. Using the same "merge the two smallest" rule, and breaking ties by treating `A` as inserted before `B`, before `C`, predict each symbol's code without running anything. Then check your answer.

:::solution
`A` and `B` are the two smallest (both 1, tie broken by insertion order), so they merge first into a node of frequency 2. The next-smallest pair is that node (2) and `C` (1) — `C` is smaller than the frequency-2 node, so it merges second, giving frequency 3. The last merge combines that frequency-3 node with `D` (5) at the root. `D` sits one level from the root: 1 bit. `C` sits two levels down: 2 bits. `A` and `B` share the deepest node, 3 bits each, differing only in their last bit.

```csharp run
Dictionary<char, int> frequencies = new() { ['A'] = 1, ['B'] = 1, ['C'] = 1, ['D'] = 5 };
List<char> firstSeen = ['A', 'B', 'C', 'D'];
var (_, codes) = BuildHuffmanTree(frequencies, firstSeen);
foreach (char c in firstSeen)
    Console.WriteLine($"{c}: {codes[c]}");

static (HuffmanNode Root, Dictionary<char, string> Codes) BuildHuffmanTree(
    Dictionary<char, int> frequencies, List<char> firstSeen)
{
    var queue = new PriorityQueue<HuffmanNode, (int Freq, int Order)>();
    int order = 0;
    foreach (char c in firstSeen)
    {
        var leaf = new HuffmanNode { Symbol = c, Frequency = frequencies[c] };
        queue.Enqueue(leaf, (leaf.Frequency, order++));
    }
    while (queue.Count > 1)
    {
        var left = queue.Dequeue();
        var right = queue.Dequeue();
        var merged = new HuffmanNode
        {
            Frequency = left.Frequency + right.Frequency,
            Left = left,
            Right = right,
        };
        queue.Enqueue(merged, (merged.Frequency, order++));
    }
    var root = queue.Dequeue();
    var codes = new Dictionary<char, string>();
    AssignCodes(root, "", codes);
    return (root, codes);
}

static void AssignCodes(HuffmanNode node, string prefix, Dictionary<char, string> codes)
{
    if (node.IsLeaf)
    {
        codes[node.Symbol] = prefix.Length == 0 ? "0" : prefix;
        return;
    }
    AssignCodes(node.Left!, prefix + "0", codes);
    AssignCodes(node.Right!, prefix + "1", codes);
}

sealed class HuffmanNode
{
    public char Symbol;
    public int Frequency;
    public HuffmanNode? Left;
    public HuffmanNode? Right;
    public bool IsLeaf => Left is null && Right is null;
}
```

```text output
A: 010
B: 011
C: 00
D: 1
```

`D` at 1 bit and `C` at 2 bits match the prediction. `A` and `B` are 3 bits each and differ only in the last bit (`010` vs `011`), also as predicted — the exact bit patterns (`0`/`1` per branch) depend on which child of each merge is called "left", which the prediction did not need to pin down to get the lengths right.
:::
::::

## Greedy vs. dynamic programming

Every algorithm on this page so far either was greedy and correct (interval scheduling, Huffman coding) or greedy and wrong (coin change on `{1, 3, 4}`). Dynamic programming is what coin change actually needs, and the coin-count table built in `MinCoins` above already *is* one: `minCoins[amount]` is the optimal answer to a subproblem, built from smaller subproblems already solved. The difference between the two techniques is what each is allowed to reconsider:

| Property | Greedy | Dynamic programming |
|---|---|---|
| Choices per step | One, made once, never revisited | All the relevant ones, compared |
| Needs | Greedy-choice property + optimal substructure | Optimal substructure alone |
| Coin change `{1,3,4}` | Wrong (this page, first section) | Right (`minCoins[6] == 2`, above) |
| Interval scheduling | Right (exchange argument, above) | Also right, but does more work than it needs to |

Optimal substructure — "an optimal solution is built from optimal solutions to smaller subproblems", the property CLRS's dynamic-programming chapter builds on throughout (chapter 14) — holds for all three problems on this page; it is why a DP table can solve any of them. What greedy adds on top is the much stronger greedy-choice property, and that property is what actually has to be proven, problem by problem, the way the exchange argument did above for interval scheduling and the way CLRS does for Huffman coding. When it holds, greedy reaches the same answer as DP while doing asymptotically less work — interval scheduling never has to fill in a table of subproblem answers, just sort once and scan. When it does not hold, as for `{1, 3, 4}`, greedy does not become slower or approximate; it becomes wrong, silently, on inputs that happen not to be counterexamples.
