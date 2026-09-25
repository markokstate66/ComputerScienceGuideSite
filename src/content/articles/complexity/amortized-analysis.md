---
title: "Amortized Analysis: Why List<T>.Add Is O(1)"
description: "Trace List<T>.Capacity as it grows, count every element copy, and prove with the aggregate and banker's methods why appending costs O(1) amortized."
pillar: complexity
order: 3
author: markus
published: 2026-09-18
updated: 2026-09-18
level: intermediate
tags: [amortized-analysis, big-o, dynamic-array, list-t]
prerequisites: ["complexity/big-o-notation"]
sources:
  - title: "List<T>.Add(T) Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.list-1.add"
    publisher: "Microsoft Learn"
    accessed: 2026-09-18
  - title: "List<T>.Capacity Property"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.list-1.capacity"
    publisher: "Microsoft Learn"
    accessed: 2026-09-18
  - title: "List<T>.TrimExcess Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.list-1.trimexcess"
    publisher: "Microsoft Learn"
    accessed: 2026-09-18
  - title: "List<T>.Clear Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.list-1.clear"
    publisher: "Microsoft Learn"
    accessed: 2026-09-18
  - title: "List.cs (System.Private.CoreLib), dotnet/runtime main branch"
    url: "https://github.com/dotnet/runtime/blob/main/src/libraries/System.Private.CoreLib/src/System/Collections/Generic/List.cs"
    publisher: "GitHub, dotnet/runtime"
    accessed: 2026-09-18
  - title: "Dictionary<TKey,TValue>.Add(TKey, TValue) Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.dictionary-2.add"
    publisher: "Microsoft Learn"
    accessed: 2026-09-18
  - title: "CS 3110 Lecture 21: Amortized Analysis"
    url: "https://www.cs.cornell.edu/courses/cs3110/2013sp/lectures/lec21-amortized/lec21.html"
    publisher: "Cornell University"
    accessed: 2026-09-18
  - title: "OCaml Programming: Correct + Efficient + Beautiful, Amortized Analysis"
    url: "https://cs3110.github.io/textbook/chapters/ds/amortized.html"
    publisher: "Cornell University"
    accessed: 2026-09-18
  - title: "Introduction to Algorithms, 4th ed., chapter 16 (Amortized Analysis)"
    url: "https://mitpress.mit.edu/9780262046305/introduction-to-algorithms/"
    publisher: "MIT Press"
    accessed: 2026-09-18
draft: false
---

The documentation for [`List<T>.Add`](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.list-1.add) makes two statements that seem to contradict everyday practice: when `Count` is less than `Capacity` the method is O(1) in [Big-O terms](/complexity/big-o-notation/), and when the capacity has to grow it "becomes an O(*n*) operation". Yet a loop that appends *n* items to a list runs in O(*n*) time, not O(*n*²). Both statements are true. The tool that reconciles them is [amortized analysis](/glossary/#amortized-analysis): instead of bounding one call, you bound the total cost of a whole sequence of calls and share that total among them. The proofs are short, and easier to believe once you have watched the real `List<T>` resize and counted what it copies, so the counting comes first.

## Watch the capacity move

A `List<T>` is a [dynamic array](/glossary/#dynamic-array): a plain array with spare room at the end, plus a count of how many slots are in use. `Capacity` is the length of that array, `Count` is the number of slots used. When an `Add` finds them equal, the list allocates a bigger array and copies every existing element into it. Indexing, insertion and removal in [arrays and dynamic arrays](/data-structures/arrays-and-dynamic-arrays/) are a data-structures topic; this page is only about what appending costs.

The program below appends 1,000 integers and reports each change of `Capacity` in the form `old -> new`. All programs on this page were run on .NET 10 (runtime 10.0.10, x64, Windows 11). At the moment of a change, the elements that had to be copied are exactly the ones that were already in the list, which is `n - 1` for the *n*-th `Add`. The first statement pins the culture so that `F2` and `N0` print a decimal point and comma separators on every machine; later programs on this page start the same way.

```csharp run id=trace
using System.Globalization;

CultureInfo.CurrentCulture =
    CultureInfo.InvariantCulture;

var readings = new List<int>();
int capacity = readings.Capacity;
long copied = 0;
Console.WriteLine($"Empty list: Capacity {capacity}");

for (int n = 1; n <= 1000; n++)
{
    readings.Add(n);
    if (readings.Capacity == capacity)
        continue;

    int moved = n - 1; // everything that lived in the old array
    copied += moved;
    Console.WriteLine(
        $"Add #{n,3}: {capacity,3} -> {readings.Capacity,4}," +
        $" copied {moved,3}");
    capacity = readings.Capacity;
}

Console.WriteLine($"Growths cost {copied} copies in total,");
Console.WriteLine($"which is {copied / 1000.0:F2} copies per Add.");
```

```text output
Empty list: Capacity 0
Add #  1:   0 ->    4, copied   0
Add #  5:   4 ->    8, copied   4
Add #  9:   8 ->   16, copied   8
Add # 17:  16 ->   32, copied  16
Add # 33:  32 ->   64, copied  32
Add # 65:  64 ->  128, copied  64
Add #129: 128 ->  256, copied 128
Add #257: 256 ->  512, copied 256
Add #513: 512 -> 1024, copied 512
Growths cost 1020 copies in total,
which is 1.02 copies per Add.
```

Nine of the thousand calls changed the capacity, eight of them copying elements, and the amount copied doubles each time: the 513th `Add` copied 512 elements. But the gaps between the expensive calls double as well, so the grand total is 1,020 copies, about one per `Add`.

<figure class="diagram">
<svg viewBox="0 0 360 376" role="img" aria-labelledby="stairs-title stairs-desc">
<title id="stairs-title">Capacity of a List&lt;T&gt; plotted against Count for the first 64 appends</title>
<desc id="stairs-desc">Capacity is a staircase with steps at 4, 8, 16, 32 and 64. Count is a dashed diagonal line beneath it. The two meet at the corner of each step, marked with a dot, where the next Add must copy every element: 4, 8, 16, 32 and then 64. Each step is twice as long as the one before.</desc>
<text x="12" y="186" text-anchor="middle" transform="rotate(-90 12 186)" class="d-muted d-small">slots in the array</text>
<polygon points="40,311.25 58.75,311.25 58.75,292.5 77.5,292.5 77.5,255 115,255 115,180 190,180 190,30 340,30 40,330" class="d-box-2" style="stroke:none"/>
<path d="M40 330 H346" class="d-line"/>
<path d="M40 330 V22" class="d-line"/>
<path d="M40 330 L340 30" class="d-line d-dashed"/>
<path d="M40 311.25 H58.75 V292.5 H77.5 V255 H115 V180 H190 V30 H340" class="d-accent" style="stroke-width:2.5"/>
<circle cx="58.75" cy="311.25" r="4" class="d-fill-bad"/>
<circle cx="77.5" cy="292.5" r="4" class="d-fill-bad"/>
<circle cx="115" cy="255" r="4" class="d-fill-bad"/>
<circle cx="190" cy="180" r="4" class="d-fill-bad"/>
<circle cx="340" cy="30" r="4" class="d-fill-bad"/>
<text x="67" y="319" class="d-small d-text-bad">copy 4</text>
<text x="86" y="300" class="d-small d-text-bad">copy 8</text>
<text x="124" y="263" class="d-small d-text-bad">copy 16</text>
<text x="199" y="188" class="d-small d-text-bad">copy 32</text>
<text x="340" y="18" text-anchor="end" class="d-small d-text-bad">full again: copy 64</text>
<text x="182" y="120" text-anchor="end" class="d-text-accent d-bold">Capacity</text>
<text x="238" y="162" class="d-muted">Count (dashed)</text>
<text x="198" y="56" class="d-small">free slots =</text>
<text x="198" y="72" class="d-small">cheap Adds</text>
<text x="58.75" y="346" text-anchor="middle" class="d-small d-mono">4</text>
<text x="77.5" y="346" text-anchor="middle" class="d-small d-mono">8</text>
<text x="115" y="346" text-anchor="middle" class="d-small d-mono">16</text>
<text x="190" y="346" text-anchor="middle" class="d-small d-mono">32</text>
<text x="340" y="346" text-anchor="middle" class="d-small d-mono">64</text>
<text x="190" y="368" text-anchor="middle" class="d-muted d-small">number of Adds so far (Count)</text>
<text x="35" y="315" text-anchor="end" class="d-small d-mono">4</text>
<text x="35" y="296" text-anchor="end" class="d-small d-mono">8</text>
<text x="35" y="259" text-anchor="end" class="d-small d-mono">16</text>
<text x="35" y="184" text-anchor="end" class="d-small d-mono">32</text>
<text x="35" y="34" text-anchor="end" class="d-small d-mono">64</text>
</svg>
<figcaption>Figure 1. Capacity (solid staircase) against Count (dashed) for the first 64 appends. A red dot marks a full list: the next Add copies everything. Each flat run is twice as long as the last, so each copy is followed by about as many cheap Adds as the elements it moved.</figcaption>
</figure>

:::dotnet
The staircase comes from a few lines in `List.cs`. Growth goes through one private method; the current main branch of [dotnet/runtime](https://github.com/dotnet/runtime/blob/main/src/libraries/System.Private.CoreLib/src/System/Collections/Generic/List.cs) computes the new size as

```text
newCapacity = _items.Length == 0
    ? DefaultCapacity
    : 2 * _items.Length;
```

with `DefaultCapacity = 4`, then clamps the result to `Array.MaxLength` and raises it to the requested minimum if doubling was not enough. The `Capacity` setter allocates the new array and calls `Array.Copy` for the first `Count` elements.

The trace above, observed on .NET 10, matches that rule line for line. None of it is a documented promise. The [`Capacity` documentation](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.list-1.capacity) says only that the capacity "is increased by automatically reallocating the internal array"; the starting size of 4 and the factor of 2 are implementation details that you can observe but should not hard-code into your logic.
:::

::::exercise[Predict the trace]
A list is created with `new List<int>(10)` and then receives 25 calls to `Add`. Using the growth rule just quoted from `List.cs`, predict every capacity the list passes through and the total number of element copies. Then check by running.

:::solution
The constructor allocates exactly 10 slots, so the default of 4 never applies. Growth doubles the current length: the 11th `Add` finds 10 of 10 used and grows to 20 (copying 10), the 21st grows to 40 (copying 20). Total: 30 copies, capacities 10, 20, 40.

```csharp run id=ex-predict
var list = new List<int>(10);
int capacity = list.Capacity;
int copies = 0;
Console.WriteLine($"start: {capacity}");

for (int n = 1; n <= 25; n++)
{
    list.Add(n);
    if (list.Capacity == capacity) continue;
    copies += n - 1;
    capacity = list.Capacity;
    Console.WriteLine($"Add #{n}: {capacity}");
}
Console.WriteLine($"copies: {copies}");
```

```text output
start: 10
Add #11: 20
Add #21: 40
copies: 30
```

The capacities are no longer powers of two. Nothing in the analysis needed them to be; it only needed each growth to multiply the size by a constant.
:::
::::

## The slow Add is real, and it shows up in a stopwatch

Counting copies is tidy. Timing is messier, but it shows that the O(*n*) call is not a theoretical nicety. This program appends 2²⁴ + 1 integers, times every single `Add`, and remembers the slowest one.

```csharp run id=latency
using System.Diagnostics;
using System.Globalization;

CultureInfo.CurrentCulture =
    CultureInfo.InvariantCulture;

const int Total = (1 << 24) + 1; // 16,777,217 appends
var samples = new List<int>();
long slowest = 0;
int slowestCall = 0;

long begin = Stopwatch.GetTimestamp();
for (int n = 1; n <= Total; n++)
{
    long before = Stopwatch.GetTimestamp();
    samples.Add(n);
    long ticks = Stopwatch.GetTimestamp() - before;
    if (ticks > slowest)
        (slowest, slowestCall) = (ticks, n);
}
TimeSpan whole = Stopwatch.GetElapsedTime(begin);

double meanNs = whole.TotalNanoseconds / Total;
double worstMs = slowest * 1000.0 / Stopwatch.Frequency;
Console.WriteLine($"Appends:      {Total:N0}");
Console.WriteLine($"Mean per Add: {meanNs:F0} ns");
Console.WriteLine($"Slowest Add:  #{slowestCall:N0}, {worstMs:F1} ms");
Console.WriteLine($"Slowest/mean: {worstMs * 1e6 / meanNs:N0}x");
```

```text output
Appends:      16,777,217
Mean per Add: [...] ns
Slowest Add:  #[...], [...] ms
Slowest/mean: [...]x
```

Four runs on the machine used for this article gave a mean of 33 to 39 ns, and that includes the two timer reads wrapped around each call. The slowest call took between 55 and 104 ms, roughly 1.4 to 2.7 million times the mean. In all four runs it was call number 16,777,217, which is 2²⁴ + 1: the append that finds a full array of 16 million elements, allocates one twice as large (128 MB of fresh memory, which the operating system has to map in as it is first touched) and copies the lot. Timing single calls is noisy, so on another machine a garbage collection or a scheduler pause could land on some other call and win instead, and your digits will certainly differ.

So the documentation's O(*n*) is an honest description of *that call*. What it does not tell you is how rarely it happens.

## Add up the whole sequence

The first proof technique is called the **aggregate method**. (The name is the one used in CLRS, chapter 16, and in [Cornell's CS 3110 lecture on amortized analysis](https://www.cs.cornell.edu/courses/cs3110/2013sp/lectures/lec21-amortized/lec21.html); both present the same three methods this page works through.) The recipe: compute a worst-case bound *T*(*n*) on the total cost of any sequence of *n* operations, then define the **amortized cost** of each operation as *T*(*n*) / *n*.

Fix a cost model first. Writing one element into a free slot costs 1. Copying one element into a new array costs 1. Allocation is left out.

That is a simplification, not a claim that it is free: the runtime zero-fills the new array, which takes time proportional to its length, and the [`Capacity` documentation](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.list-1.capacity) accordingly calls the setter O(*n*) in the *new* capacity. With doubling, the new array is twice the size of the copy, so counting allocation would multiply the growth cost by a constant and turn the 3 below into a larger constant. The conclusion would not change.

For *n* calls to `Add` on an empty list:

- Every call writes its own element: *n* in total.
- Growth copies nothing the first time (from 0 to 4 slots), then 4, then 8, then 16, and so on. The last growth happened while the list held fewer than *n* elements, so the largest term is less than *n*, and each earlier term is half the next. A series in which every term is half of the following one sums to less than twice its largest term, so all growth copies together cost less than 2*n*.

Total: *T*(*n*) < *n* + 2*n* = 3*n*. Divide by *n* and every `Add` has an amortized cost below 3, a constant. That is the precise meaning of "`List<T>.Add` is O(1) amortized": **any sequence of *n* appends, starting from an empty list, costs O(*n*) in total, in the worst case.** The trace above agrees: 1,000 writes plus 1,020 copies is 2,020, under 3,000.

Three things that statement does not say:

- It does not say any individual `Add` is fast. One of them cost 512 in the trace.
- It does not involve probability. No input is "unlucky"; the bound holds for every sequence.
- It says nothing about sequences that contain other operations. Add `TrimExcess` to the mix and the bound can evaporate, as a later section shows.

## Prepay for the copy: the banker's method

The aggregate method needed a closed-form sum. When operations are of several kinds, or the sum is awkward, the **banker's method** is often easier. ([*Introduction to Algorithms*](https://mitpress.mit.edu/9780262046305/introduction-to-algorithms/), chapter 16, calls it the accounting method; "banker" and "physicist" are the names used in the [Cornell CS 3110 textbook](https://cs3110.github.io/textbook/chapters/ds/amortized.html).) You choose a fixed *charge* for each operation, higher than its typical real cost. The surplus is saved as credit, pictured as coins sitting on elements of the data structure. An expensive operation pays for itself out of the saved coins. If you can show the balance never goes below zero, the total of the charges is an upper bound on the total real cost, so the charge is a valid amortized cost.

For `Add`, charge 3 coins. This is the standard split for a doubling array, the same one the Cornell lecture uses:

1. One coin pays for writing the new element.
2. One coin stays on the new element, to pay for *its own* first move to a bigger array.
3. One coin goes to an element in the older half of the array that has already spent its coin in the previous move.

<figure class="diagram">
<svg viewBox="0 0 360 348" role="img" aria-labelledby="coins-title coins-desc">
<title id="coins-title">Coins saved by the banker's method between two growths of a list</title>
<desc id="coins-desc">Top row: just after growing to capacity 8, five slots are used. The newest element, number 4, carries one coin and has placed a second coin on old element 0. Bottom row: when the list is full, all eight elements carry exactly one coin, which pays for copying all eight into a sixteen-slot array.</desc>
<text x="20" y="20" class="d-bold">After Add #5: Capacity 8, Count 5</text>
<rect x="20" y="30" width="40" height="40" class="d-box"/><text x="40" y="55" text-anchor="middle" class="d-mono">0</text>
<rect x="60" y="30" width="40" height="40" class="d-box"/><text x="80" y="55" text-anchor="middle" class="d-mono">1</text>
<rect x="100" y="30" width="40" height="40" class="d-box"/><text x="120" y="55" text-anchor="middle" class="d-mono">2</text>
<rect x="140" y="30" width="40" height="40" class="d-box"/><text x="160" y="55" text-anchor="middle" class="d-mono">3</text>
<rect x="180" y="30" width="40" height="40" class="d-box-accent"/><text x="200" y="55" text-anchor="middle" class="d-mono d-bold">4</text>
<rect x="220" y="30" width="40" height="40" class="d-box-2 d-dashed"/>
<rect x="260" y="30" width="40" height="40" class="d-box-2 d-dashed"/>
<rect x="300" y="30" width="40" height="40" class="d-box-2 d-dashed"/>
<circle cx="40" cy="88" r="9" class="d-box-good"/><text x="40" y="92" text-anchor="middle" class="d-small d-text-good">1</text>
<circle cx="200" cy="88" r="9" class="d-box-good"/><text x="200" y="92" text-anchor="middle" class="d-small d-text-good">1</text>
<text x="20" y="118" class="d-small">Add #5 was charged 3 coins: 1 paid for its write,</text>
<text x="20" y="134" class="d-small">1 stays on element 4, 1 goes to old element 0.</text>
<text x="20" y="176" class="d-bold">After Add #8: Capacity 8, Count 8 (full)</text>
<rect x="20" y="186" width="40" height="40" class="d-box"/><text x="40" y="211" text-anchor="middle" class="d-mono">0</text>
<rect x="60" y="186" width="40" height="40" class="d-box"/><text x="80" y="211" text-anchor="middle" class="d-mono">1</text>
<rect x="100" y="186" width="40" height="40" class="d-box"/><text x="120" y="211" text-anchor="middle" class="d-mono">2</text>
<rect x="140" y="186" width="40" height="40" class="d-box"/><text x="160" y="211" text-anchor="middle" class="d-mono">3</text>
<rect x="180" y="186" width="40" height="40" class="d-box-accent"/><text x="200" y="211" text-anchor="middle" class="d-mono">4</text>
<rect x="220" y="186" width="40" height="40" class="d-box-accent"/><text x="240" y="211" text-anchor="middle" class="d-mono">5</text>
<rect x="260" y="186" width="40" height="40" class="d-box-accent"/><text x="280" y="211" text-anchor="middle" class="d-mono">6</text>
<rect x="300" y="186" width="40" height="40" class="d-box-accent"/><text x="320" y="211" text-anchor="middle" class="d-mono">7</text>
<circle cx="40" cy="244" r="9" class="d-box-good"/><text x="40" y="248" text-anchor="middle" class="d-small d-text-good">1</text>
<circle cx="80" cy="244" r="9" class="d-box-good"/><text x="80" y="248" text-anchor="middle" class="d-small d-text-good">1</text>
<circle cx="120" cy="244" r="9" class="d-box-good"/><text x="120" y="248" text-anchor="middle" class="d-small d-text-good">1</text>
<circle cx="160" cy="244" r="9" class="d-box-good"/><text x="160" y="248" text-anchor="middle" class="d-small d-text-good">1</text>
<circle cx="200" cy="244" r="9" class="d-box-good"/><text x="200" y="248" text-anchor="middle" class="d-small d-text-good">1</text>
<circle cx="240" cy="244" r="9" class="d-box-good"/><text x="240" y="248" text-anchor="middle" class="d-small d-text-good">1</text>
<circle cx="280" cy="244" r="9" class="d-box-good"/><text x="280" y="248" text-anchor="middle" class="d-small d-text-good">1</text>
<circle cx="320" cy="244" r="9" class="d-box-good"/><text x="320" y="248" text-anchor="middle" class="d-small d-text-good">1</text>
<text x="20" y="274" class="d-small">Adds #5 to #8 left 8 coins behind: one on each new</text>
<text x="20" y="290" class="d-small">element and one on each old element.</text>
<text x="20" y="318" class="d-text-good d-small">Add #9 must copy 8 elements:</text>
<text x="20" y="334" class="d-text-good d-small">exactly 8 coins are waiting to pay for it.</text>
</svg>
<figcaption>Figure 2. The banker's method on a list that has just grown from 4 to 8. Old elements (grey) start the round with no coins. Each new element (accent) brings one coin for itself and one for an old element, so the array is fully funded at the moment it fills.</figcaption>
</figure>

The argument generalizes. Right after a growth to capacity 2*c*, the list holds *c* + 1 elements and the *c* old ones have no coins. The array fills after *c* appends in this round (the one that triggered the growth included); each brings a coin for itself and a coin for one old element, and there are *c* of each. When the next growth has to copy 2*c* elements, 2*c* coins are waiting.

You do not have to take the bookkeeping on trust. The next program runs the bank against the real `List<T>`, deducting the true cost of each call, with a charge of 3 and then with a charge of 2. It prints the balance just after each of the first six growths, and the lowest balance seen after any `Add`.

```csharp run id=bank
RunBank(charge: 3);
RunBank(charge: 2);

static void RunBank(int charge)
{
    var list = new List<int>();
    int capacity = list.Capacity;
    long balance = 0, lowest = long.MaxValue;
    int firstDebt = 0;
    var afterGrowth = new List<long>();

    for (int n = 1; n <= 1_000_000; n++)
    {
        list.Add(n);
        long realCost = 1; // the write
        bool grew = list.Capacity != capacity;
        if (grew)
        {
            realCost += n - 1; // the copies
            capacity = list.Capacity;
        }

        balance += charge - realCost;
        if (grew && afterGrowth.Count < 6)
            afterGrowth.Add(balance);
        if (balance < 0 && firstDebt == 0) firstDebt = n;
        lowest = Math.Min(lowest, balance);
    }

    Console.WriteLine($"Charge {charge} per Add");
    Console.WriteLine(
        $"  at growths: {string.Join(", ", afterGrowth)}");
    Console.WriteLine($"  lowest balance: {lowest}");
    Console.WriteLine(firstDebt == 0
        ? "  never in debt"
        : $"  first in debt at Add #{firstDebt}");
}
```

```text output
Charge 3 per Add
  at growths: 2, 6, 6, 6, 6, 6
  lowest balance: 2
  never in debt
Charge 2 per Add
  at growths: 1, 1, -3, -11, -27, -59
  lowest balance: -524283
  first in debt at Add #9
```

With 3 coins the account returns to the same small balance after every growth: the coins earmarked for the copy are exactly used up, and the account is never overdrawn. (The 6 is the 2 coins that the growing `Add` has just saved, plus 4 left over from the very first round, when the array had 4 slots and nothing to copy.) With 2 coins each element can pay for its own move but not for an old element's, and the debt doubles with every growth. Two is not a valid amortized cost under this cost model; three is.

### The same proof as a potential function

The third classical technique, the **potential method**, keeps one number for the whole structure instead of coins on elements (it is the physicist's method in the Cornell naming). Define a potential Φ that is never negative and starts at 0, and define the amortized cost of an operation as its real cost plus the change in Φ. Summed over a sequence, the changes telescope, so total amortized cost = total real cost + Φ(end) − Φ(start) ≥ total real cost.

For a doubling array, Φ = max(0, 2 · Count − Capacity) works; it is the textbook choice, written 2*n* − *m* in the same Cornell lecture. It is 0 for an empty list, close to 0 right after a growth, and equal to Count when the array is full. In an `Add`-only run from an empty list, the max only matters while the first 4-slot array is less than half full. There are two cases:

- **An `Add` into a free slot** has real cost 1 and raises Φ by at most 2. Amortized cost: at most 3.
- **An `Add` that grows a full array of size *c*** has real cost *c* + 1, and Φ drops from *c* to 2(*c* + 1) − 2*c* = 2. Amortized cost: (*c* + 1) + (2 − *c*) = 3.

The constant matches the banker's method because Φ counts the coins sitting on the elements, apart from the 4 surplus coins of the first round. That is why the bank printed 6 after each growth where Φ is 2; the difference is a constant, and a constant does not affect the bound.

Use whichever method is easier to find. Coins are intuitive when you can point at who pays for what; a potential function is easier when credit does not belong to any one element.

## Why the array doubles instead of growing by a fixed amount

Growing by a fixed number of slots looks thrifty: it never wastes more than *k* slots. The aggregate method shows what that costs. With `capacity += k`, a growth happens every *k* appends and copies *k*, 2*k*, 3*k*, … elements. For *n* appends that is about *n* / *k* growths whose sizes average *n* / 2, so roughly *n*² / (2*k*) copies: **Θ(*n*) amortized per `Add`**, for every constant *k*. A larger *k* only divides the quadratic term by a larger constant.

Any *multiplicative* factor *g* > 1 works. The copy sizes then form a geometric series whose largest term is below *n*, so, ignoring the rounding of each capacity to a whole number, the total is below *n* · *g* / (*g* − 1): 2*n* for doubling, 3*n* for a factor of 1.5. The following simulation counts copies for four policies, using the same rule as `List<T>` for the first allocation.

```csharp run id=policies
using System.Globalization;

CultureInfo.CurrentCulture =
    CultureInfo.InvariantCulture;

(string Name, Func<int, int> Grow)[] policies =
[
    ("x2",    c => c == 0 ? 4 : c * 2),
    ("x1.5",  c => c == 0 ? 4 : c + c / 2),
    ("+1000", c => c + 1000),
    ("+4",    c => c + 4),
];
int[] sizes = [1_000, 10_000, 100_000, 1_000_000];

Console.WriteLine($"{"policy",-6}{"n",9}{"per Add",11}");
foreach (var (name, grow) in policies)
{
    foreach (int n in sizes)
    {
        long copies = CountCopies(n, grow);
        double perAdd = (double)copies / n;
        Console.WriteLine(
            $"{name,-6}{n,9:N0}{perAdd,11:N2}");
    }
}

static long CountCopies(int appends, Func<int, int> grow)
{
    int capacity = 0;
    long copies = 0;
    for (int count = 0; count < appends; count++)
    {
        if (count < capacity) continue;
        copies += count; // move every element to the new array
        capacity = grow(capacity);
    }
    return copies;
}
```

```text output
policy        n    per Add
x2        1,000       1.02
x2       10,000       1.64
x2      100,000       1.31
x2    1,000,000       1.05
x1.5      1,000       2.13
x1.5     10,000       2.43
x1.5    100,000       2.77
x1.5  1,000,000       2.10
+1000     1,000       0.00
+1000    10,000       4.50
+1000   100,000      49.50
+1000 1,000,000     499.50
+4        1,000     124.50
+4       10,000   1,249.50
+4      100,000  12,499.50
+4    1,000,000 124,999.50
```

Read down the `per Add` column, which is total copies divided by *n* (the `x2` row for 1,000 is the 1,020 copies of the first trace). For the two multiplicative policies the cost per `Add` wobbles between 1 and 2 (or 2 and 3) depending on how recently the last growth happened, and never trends upward. For the additive policies it grows tenfold every time *n* grows tenfold. `+1000` costs nothing at *n* = 1,000 and 4.5 copies per `Add` at 10,000, so a test with small inputs will not reveal the problem.

<figure class="diagram">
<svg viewBox="0 0 360 316" role="img" aria-labelledby="growth-title growth-desc">
<title id="growth-title">Copies per Add against the number of Adds for three growth policies, on logarithmic axes</title>
<desc id="growth-desc">The line for doubling stays flat between 1 and 2 copies per Add from one thousand to one million Adds. The line for growing by 1000 slots rises from 4.5 to 499.5, and the line for growing by 4 slots rises from 124.5 to 124,999.5; both climb one decade for each decade of n.</desc>
<text x="10" y="16" class="d-muted d-small">copies per Add (log scale)</text>
<path d="M50 230 H330 M50 190 H330 M50 150 H330 M50 110 H330 M50 70 H330 M50 30 H330" class="d-line" style="opacity:.3"/>
<path d="M50 30 V270 H330" class="d-line"/>
<text x="44" y="274" text-anchor="end" class="d-small d-mono">1</text>
<text x="44" y="234" text-anchor="end" class="d-small d-mono">10</text>
<text x="44" y="194" text-anchor="end" class="d-small d-mono">100</text>
<text x="44" y="154" text-anchor="end" class="d-small d-mono">1k</text>
<text x="44" y="114" text-anchor="end" class="d-small d-mono">10k</text>
<text x="44" y="74" text-anchor="end" class="d-small d-mono">100k</text>
<text x="44" y="34" text-anchor="end" class="d-small d-mono">1M</text>
<text x="50" y="288" text-anchor="middle" class="d-small d-mono">1k</text>
<text x="143" y="288" text-anchor="middle" class="d-small d-mono">10k</text>
<text x="237" y="288" text-anchor="middle" class="d-small d-mono">100k</text>
<text x="330" y="288" text-anchor="middle" class="d-small d-mono">1M</text>
<text x="190" y="308" text-anchor="middle" class="d-muted d-small">n, the number of Adds (log scale)</text>
<path d="M50 186.2 L143.3 146.1 L236.7 106.1 L330 66.1" class="d-bad" style="stroke-width:2.5"/>
<path d="M143.3 243.9 L236.7 202.2 L330 162" class="d-bad" style="stroke-width:2.5"/>
<path d="M50 269.6 L143.3 261.4 L236.7 265.3 L330 269.2" class="d-good" style="stroke-width:2.5"/>
<circle cx="50" cy="186.2" r="3.5" class="d-fill-bad"/><circle cx="143.3" cy="146.1" r="3.5" class="d-fill-bad"/><circle cx="236.7" cy="106.1" r="3.5" class="d-fill-bad"/><circle cx="330" cy="66.1" r="3.5" class="d-fill-bad"/>
<circle cx="143.3" cy="243.9" r="3.5" class="d-fill-bad"/><circle cx="236.7" cy="202.2" r="3.5" class="d-fill-bad"/><circle cx="330" cy="162" r="3.5" class="d-fill-bad"/>
<circle cx="50" cy="269.6" r="3.5" class="d-fill-good"/><circle cx="143.3" cy="261.4" r="3.5" class="d-fill-good"/><circle cx="236.7" cy="265.3" r="3.5" class="d-fill-good"/><circle cx="330" cy="269.2" r="3.5" class="d-fill-good"/>
<text x="326" y="50" text-anchor="end" class="d-small d-text-bad">+4: reaches 124,999.5</text>
<text x="326" y="140" text-anchor="end" class="d-small d-text-bad">+1000: reaches 499.5</text>
<text x="326" y="252" text-anchor="end" class="d-small d-text-good">x2: stays under 2</text>
</svg>
<figcaption>Figure 3. The <code>per Add</code> column of the output above for three of the policies, on log-log axes. Doubling is a flat line. Both additive policies climb one decade for every decade of <em>n</em>, which is what Θ(<em>n</em>) per Add looks like; a larger step only starts the climb later. (The <code>+1000</code> point at <em>n</em> = 1,000 is 0 and cannot be drawn on a log axis; <code>x1.5</code> would run just above <code>x2</code>.)</figcaption>
</figure>

The factor is a trade between time and memory, that is, between this page's subject and [space complexity](/complexity/space-complexity/). Right after a growth by factor *g*, a fraction (*g* − 1) / *g* of the array is unused: half for doubling, a third for 1.5. A smaller factor wastes less and copies more. .NET's `List<T>` currently chooses 2. The analysis does not pick a winner: any constant factor greater than 1 keeps the O(1) amortized bound, and only the constant inside it changes.

::::exercise[Prove it for a factor of 1.5]
A library grows its array by a factor of 1.5 instead of 2. Find a per-`Add` charge for which the banker's method works, under the same cost model (1 per write, 1 per copied element), and justify it. Ignore rounding.

:::solution
Charge 4. After a growth from capacity *c* to 1.5*c*, the list holds *c* elements with no coins (they were just spent) and has 0.5*c* free slots. The next growth must copy 1.5*c* elements and only 0.5*c* appends happen before it, so each append must leave 1.5*c* / 0.5*c* = 3 coins behind, plus 1 for its own write.

In general, for factor *g* each round has (*g* − 1)*c* appends that must fund *gc* copies, so the charge is 1 + *g* / (*g* − 1). That gives 3 for *g* = 2 and 4 for *g* = 1.5, and it matches the aggregate bound of *n* writes plus at most *n* · *g* / (*g* − 1) copies. The `x1.5` rows of the simulation stay around or below 3 copies per `Add`, as predicted. (Its `c + c / 2` rounds down, so on odd capacities the effective factor is a little under 1.5 and the 3*n* ceiling is only approximate for that policy.) As *g* approaches 1 the charge grows without limit, which is the additive policy's failure seen from the other side.
:::
::::

## Amortized is not average-case

The two are easy to confuse, because both divide a total by a count. They average over different things.

- **Worst-case** bounds one operation and averages nothing. It assumes nothing, and its only fault is that it can be pessimistic.
- **Amortized** averages over the operations of one sequence. It assumes nothing about the input, so the total is guaranteed for every sequence, but a single operation in it can still be slow.
- **Average-case** averages over all possible inputs, weighted by an assumed probability distribution (for example, every order equally likely). One particular input can be slow *every time* it is supplied.
- **Expected** averages over the algorithm's own random choices and assumes only that they cannot be predicted. Any input can be slow, but only through bad luck, with small probability.

An amortized bound is a worst-case statement about a sequence. There is no distribution, and no adversary can pick a sequence of *n* appends that costs more than 3*n*. 

An average-case bound makes no promise at all for a specific input: a quicksort that always picks the first element as pivot is O(*n* log *n*) on average over random orders and O(*n*²) on every already-sorted input, however many times you run it. How the [best, average and worst cases](/complexity/best-average-worst-case/) of a single algorithm are defined, and how a random pivot turns that average-case bound into an expected one, is a separate subject from amortization.

The kinds combine. [`Dictionary<TKey,TValue>.Add`](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.dictionary-2.add) is documented as approaching O(1) when there is room and O(*n*) when the capacity must increase. The first half depends on the [hash table](/data-structures/hash-tables/)'s hash function spreading the keys evenly over the buckets. That is an average-case claim, an assumption about the keys, and it becomes an expected-case claim only if the hash function itself is randomized. The second half is a resize, and it is amortized away by the same argument as for `List<T>`, provided the table grows geometrically. Stated in full, a hash table insert is O(1) on average, assuming the hash spreads the keys uniformly, and amortized over resizes. The two qualifiers guard against different failures.

:::warning[Amortized bounds do not cap latency]
If a single slow operation matters, such as a frame budget in a game loop, a request timeout, or audio buffering, an amortized O(1) structure can still miss the deadline: the timing experiment above saw one `Add` take over a million times the mean. Pre-size the list (`new List<T>(expectedCount)` or `EnsureCapacity`) so the growth happens at a time you choose, or use a structure with a worst-case bound.
:::

## Three ways to lose the guarantee

The 3*n* proof covered sequences of `Add` calls with the library in charge of growth. Step outside that and the bound no longer applies. The program below fills a list with 40,000 integers in four ways (in the labels, *n* stands for the current `Count`) and reports how many bytes the thread allocated in the process, which is a direct measure of how much array was created and copied.

```csharp run id=breakit
using System.Diagnostics;
using System.Globalization;

CultureInfo.CurrentCulture =
    CultureInfo.InvariantCulture;
const int Items = 40_000;

Measure("Add only", (list, x) => list.Add(x));
Measure("EnsureCapacity(n + 1)", (list, x) =>
{
    list.EnsureCapacity(list.Count + 1);
    list.Add(x);
});
Measure("Capacity = n + 1", (list, x) =>
{
    if (list.Count == list.Capacity)
        list.Capacity = list.Count + 1;
    list.Add(x);
});
Measure("Add + TrimExcess", (list, x) =>
{
    list.Add(x);
    list.TrimExcess();
});

static void Measure(
    string label, Action<List<int>, int> append)
{
    var list = new List<int>();
    long bytes = GC.GetAllocatedBytesForCurrentThread();
    long begin = Stopwatch.GetTimestamp();
    for (int x = 0; x < Items; x++)
        append(list, x);
    TimeSpan took = Stopwatch.GetElapsedTime(begin);
    bytes = GC.GetAllocatedBytesForCurrentThread() - bytes;
    double mb = bytes / 1e6;
    double ms = took.TotalMilliseconds;
    Console.WriteLine(
        $"{label,-22}{mb,6:F1} MB  {ms,5:F1} ms");
}
```

```text output
Add only              [...] MB  [...] ms
EnsureCapacity(n + 1) [...] MB  [...] ms
Capacity = n + 1      [...] MB  [...] ms
Add + TrimExcess      [...] MB  [...] ms
```

On the machine used here, the first two rows allocated 0.5 MB each and finished in about half a millisecond. The third allocated 3,201 MB and took about 200 ms; the fourth allocated 9,602 MB and took about 800 ms, all to build a list whose final contents occupy 0.16 MB. The first row's time also includes JIT-compiling `Measure` and the first lambda, so read it as an upper bound. The times vary by machine and run; the gap of roughly four orders of magnitude in allocation does not, because it follows from the arithmetic below.

1. **Setting `Capacity` yourself, one slot at a time.** The setter allocates exactly what you ask for. `Capacity = Count + 1` is the `+k` policy with *k* = 1: every append copies the whole list, Θ(*n*²) overall. `EnsureCapacity` does not have this problem in current .NET: in [`List.cs`](https://github.com/dotnet/runtime/blob/main/src/libraries/System.Private.CoreLib/src/System/Collections/Generic/List.cs) it goes through the same doubling routine as `Add` and only uses your number as a minimum. That is an implementation detail too, but a convenient one.
2. **Calling `TrimExcess` in the loop.** The [documentation](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.list-1.trimexcess) says it currently does nothing if the list is more than 90 percent full (with a note that the threshold might change in future releases), which sounds safe. It is not: right after a doubling the list is about half full, so the trim fires, shrinks the array to `Count`, and guarantees that the next `Add` doubles again. Every append now allocates an array of 2*n* slots and then one of *n* slots, and copies the list twice, which is why this row allocates three times as much as the previous one. Trim once, when the list has stopped growing.
3. **Assuming the bound covers other operations.** `Insert(0, item)` shifts every element on every call; it is Θ(*n*) each time, worst-case, and there are no cheap calls for amortization to average against. The O(1) amortized claim is about appending at the end, and only that.

:::pitfall
"O(1) amortized" is a property of an operation *within a stated set of operations and a growth policy*. Quoting it for a loop that also trims, inserts at the front, or manages `Capacity` by hand is a claim nobody proved.
:::

## The same argument elsewhere: multipop and a binary counter

Dynamic arrays are the famous case, but the technique is general: look for an expensive operation that can only happen after enough cheap ones have set it up. Two standard examples from the algorithms literature ([CLRS](https://mitpress.mit.edu/9780262046305/introduction-to-algorithms/) uses both in chapter 16) show the pattern without any resizing.

**[A stack](/data-structures/stacks-and-queues/) with `MultiPop(k)`**, which pops up to *k* elements in one call. The cost model is 1 per push and 1 per element popped, ignoring the constant overhead of a call (so a pop on an empty stack costs 0; charging every call 1 as well would turn the 2*n* below into 3*n*). A single `MultiPop` can cost *n*, so a naive bound for *n* operations is O(*n*²). Banker's view: charge 2 for `Push`, one coin for the push and one left on the element to pay for its eventual pop. Every pop, single or multiple, is then prepaid. No element can be popped more times than it was pushed, so *n* operations cost at most 2*n* in total, and `Push`, `Pop` and `MultiPop` are all O(1) amortized.

**Incrementing a binary counter.** One increment can flip many bits: 0111 1111 + 1 flips eight. But bit 0 flips on every increment, bit 1 on every second, bit 2 on every fourth. Aggregate view: *n* increments flip *n* + *n*/2 + *n*/4 + … < 2*n* bits, so an increment is O(1) amortized, even though its worst case is the width of the counter.

Both claims are easy to check by counting.

```csharp run id=others
using System.Globalization;

CultureInfo.CurrentCulture =
    CultureInfo.InvariantCulture;

// 1. Stack with MultiPop, driven by a fixed pseudo-random script.
var stack = new Stack<int>();
var script = new Random(2026);
long pushes = 0, pops = 0, priciestCall = 0;
const int Operations = 1_000_000;

for (int op = 0; op < Operations; op++)
{
    if (script.Next(100) < 97)
    {
        stack.Push(op);
        pushes++;
    }
    else
    {
        int removed = MultiPop(stack, script.Next(1, 200));
        pops += removed;
        priciestCall = Math.Max(priciestCall, removed);
    }
}

Console.WriteLine($"Stack: {Operations:N0} operations");
Console.WriteLine($"  pushes {pushes:N0}, popped {pops:N0}");
Console.WriteLine($"  priciest single call popped {priciestCall}");
double perOp = (double)(pushes + pops) / Operations;
Console.WriteLine($"  cost per operation {perOp:F2}");

// 2. Binary counter: count bit flips over many increments.
var bits = new bool[32];
long flips = 0, worstIncrement = 0;
const int Increments = 1_000_000;

for (int n = 0; n < Increments; n++)
{
    int flipped = Increment(bits);
    flips += flipped;
    worstIncrement = Math.Max(worstIncrement, flipped);
}

Console.WriteLine($"Counter: {Increments:N0} increments");
double perIncrement = (double)flips / Increments;
Console.WriteLine($"  bit flips {flips:N0}");
Console.WriteLine($"  worst increment {worstIncrement}");
Console.WriteLine($"  flips per increment {perIncrement:F2}");

static int MultiPop(Stack<int> stack, int k)
{
    int removed = 0;
    while (removed < k && stack.TryPop(out _)) removed++;
    return removed;
}

static int Increment(bool[] bits)
{
    int i = 0;
    while (i < bits.Length && bits[i]) bits[i++] = false; // carry
    if (i < bits.Length) bits[i] = true;
    return Math.Min(i + 1, bits.Length);
}
```

```text output
Stack: 1,000,000 operations
  pushes 970,008, popped 969,943
  priciest single call popped 198
  cost per operation 1.94
Counter: 1,000,000 increments
  bit flips 1,999,993
  worst increment 20
  flips per increment 2.00
```

Averaged over the sequence the stack pays 1.94 per operation, under the proven ceiling of 2, even though one call popped 198 elements. (The model counts stack operations; the growth of the array inside `Stack<T>` is a separate amortized cost, the one the earlier sections dealt with.) The counter's 1,999,993 flips sit just under the 2*n* bound. (The exact figure is 2*n* minus the number of 1 bits in *n*; 1,000,000 has seven.)

## Two limits to test: shrinking and pre-sizing

The proofs above covered a list that only grows, and said nothing about memory. The first exercise asks what happens when a dynamic array also shrinks; the second measures what the growth history costs in allocation.

::::exercise[Find the bug in the shrink rule]
A colleague adds shrinking to a hand-written dynamic array: double when full, and **halve the capacity whenever the array is half empty** after a removal. The aggregate argument for appends still holds, so they claim append and remove-last are both O(1) amortized. Find a sequence of operations that costs Θ(*n*) per operation, then fix the rule.

:::solution
Append until a growth has just happened, so that Count = *c* + 1 and Capacity = 2*c*. Now remove one: Count = *c*, which is half of 2*c*, so the array halves to *c* (copying *c*). Add one: the array is full, so it doubles (copying *c*). Alternate forever and every operation copies the whole array. The problem is that right after a resize in either direction the structure is one step away from a resize in the other direction, so no cheap operations separate the expensive ones and there is nothing to amortize against.

The standard fix is hysteresis: halve only when the array is a *quarter* full. After any resize the array is then about half full, so the number of cheap operations before the next resize in either direction is proportional to the capacity: at least a quarter of the new capacity. Let each cheap operation bank a constant number of coins (4 is enough) and they cover the next resize, which copies at most one element per slot. That gives the O(1) amortized bound for both operations. The program counts copies for both rules over 20,000 operations of the hostile sequence.

```csharp run id=ex-shrink
int[] divisors = [2, 4];
foreach (int divisor in divisors)
{
    var bag = new ShrinkingArray(shrinkAtOneOver: divisor);
    for (int i = 0; i < 1025; i++) bag.Add(i); // just past a growth

    long before = bag.Copies;
    for (int round = 0; round < 10_000; round++)
    {
        bag.RemoveLast();
        bag.Add(round);
    }
    Console.WriteLine(
        $"shrink at 1/{divisor} full: " +
        $"{bag.Copies - before,10:N0} copies");
}

sealed class ShrinkingArray(int shrinkAtOneOver)
{
    private int[] _items = new int[4];
    public int Count { get; private set; }
    public long Copies { get; private set; }

    public void Add(int value)
    {
        if (Count == _items.Length) Resize(_items.Length * 2);
        _items[Count++] = value;
    }

    public void RemoveLast()
    {
        if (Count == 0)
            throw new InvalidOperationException("Array is empty.");
        Count--;
        bool sparse = Count <= _items.Length / shrinkAtOneOver;
        if (sparse && _items.Length > 4) Resize(_items.Length / 2);
    }

    private void Resize(int newLength)
    {
        var resized = new int[newLength];
        Array.Copy(_items, resized, Count);
        Copies += Count;
        _items = resized;
    }
}
```

```text output
shrink at 1/2 full: 20,480,000 copies
shrink at 1/4 full:          0 copies
```

`List<T>` sidesteps the question by never shrinking on its own. The documentation for [`Clear`](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.list-1.clear) states that `Capacity` "remains unchanged" and names `TrimExcess` and the `Capacity` setter as the ways to give memory back; the removal methods in `List.cs` likewise never touch the array's length.
:::
::::

::::exercise[Measure what pre-sizing saves]
If you know you will add 1,000,000 integers, `new List<int>(1_000_000)` avoids every growth. Before measuring, estimate from the aggregate argument how many bytes of array the default-constructed list allocates in total, compared with the pre-sized one. Then measure with `GC.GetAllocatedBytesForCurrentThread`.

:::solution
The pre-sized list allocates one array of 1,000,000 × 4 bytes = 4.0 MB. The default list allocates arrays of 4, 8, 16, … up to 1,048,576 slots (the first power of two that holds a million), which sum to just under 2,097,152 slots, about 8.4 MB. So expect a little over twice the allocation, plus a final array that is about 5 percent larger than needed.

```csharp run id=ex-presize
using System.Globalization;

CultureInfo.CurrentCulture =
    CultureInfo.InvariantCulture;
const int Items = 1_000_000;

Console.WriteLine($"default:   {Fill(new List<int>()):F1} MB");
Console.WriteLine($"pre-sized: {Fill(new List<int>(Items)):F1} MB");

static double Fill(List<int> list)
{
    // Arrays the list already owns were allocated before this line.
    long preallocated = (long)list.Capacity * sizeof(int);
    long before = GC.GetAllocatedBytesForCurrentThread();
    for (int i = 0; i < Items; i++) list.Add(i);
    long during = GC.GetAllocatedBytesForCurrentThread() - before;
    return (during + preallocated) / 1e6;
}
```

```text output
default:   [...] MB
pre-sized: [...] MB
```

On the machine used here the two lines read 8.4 MB and 4.0 MB. Both versions are O(*n*); pre-sizing removes a constant factor of about two in allocation and all of the copying, and, more usefully, removes the latency spikes. It is an optimization of the constant, not of the complexity class, so it is worth doing when the size is known and not worth guessing at when it is not.
:::
::::
