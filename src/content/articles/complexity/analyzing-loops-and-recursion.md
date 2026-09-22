---
title: "How to Work Out the Time Complexity of Your Code"
description: "A step-by-step procedure for loops, nested loops and recursion, ending in the Master Theorem's three cases, each confirmed by running instrumented C#."
pillar: complexity
order: 2
author: markus
published: 2026-09-22
updated: 2026-09-22
level: intermediate
tags: [recursion, recurrence-relations, master-theorem, big-o]
prerequisites: ["complexity/big-o-notation"]
sources:
  - title: "Introduction to Algorithms, 4th ed., chapter 4 (Divide-and-Conquer)"
    url: "https://mitpress.mit.edu/9780262046305/introduction-to-algorithms/"
    publisher: "MIT Press"
    accessed: 2026-09-22
  - title: "Introduction to Algorithms, 4th ed., chapter 7 (Quicksort)"
    url: "https://mitpress.mit.edu/9780262046305/introduction-to-algorithms/"
    publisher: "MIT Press"
    accessed: 2026-09-22
  - title: "divide and conquer, Dictionary of Algorithms and Data Structures"
    url: "https://xlinux.nist.gov/dads/HTML/divideAndConquer.html"
    publisher: "NIST"
    accessed: 2026-09-22
  - title: "easy split, hard merge, Dictionary of Algorithms and Data Structures"
    url: "https://xlinux.nist.gov/dads/HTML/easySplitHardMerge.html"
    publisher: "NIST"
    accessed: 2026-09-22
  - title: "hard split, easy merge, Dictionary of Algorithms and Data Structures"
    url: "https://xlinux.nist.gov/dads/HTML/hardSplitEasyMerge.html"
    publisher: "NIST"
    accessed: 2026-09-22
  - title: "Thread.Thread(ThreadStart, Int32) Constructor"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.threading.thread.-ctor?view=net-10.0"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "StackOverflowException Class"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.stackoverflowexception"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
draft: true
---

A loop nested inside another loop is not automatically O(*n*²): that only holds once both trip counts actually depend on *n*. [Big-O notation](/complexity/big-o-notation/) covered a single loop and one pair of nested loops, then closed with five rules of thumb for reading a bound off C# code. This page turns those rules into a repeatable procedure, reaches the loop shapes they didn't — loops that halve, loops whose inner bound rides on the outer one — and then does for recursive code what tracing a loop cannot: turns a function that calls itself into a number, by way of recurrence relations and the Master Theorem.

## How do you find the complexity of two loops that run one after another?

Two loops over the same data, back to back, cost whatever they cost added together. A warehouse's stock check totals every quantity in one pass, then counts low-stock items in a second:

```csharp run id=seq-scan
using System.Globalization;

CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;

Console.WriteLine($"{"n",8}{"steps",8}");
foreach (int n in (int[])[1_000, 2_000, 4_000, 8_000])
{
    int[] stock = MakeStock(n);
    long steps = 0;

    long total = 0;
    for (int i = 0; i < n; i++)
    {
        steps++;
        total += stock[i];
    }

    int lowCount = 0;
    for (int i = 0; i < n; i++)
    {
        steps++;
        if (stock[i] < 5) lowCount++;
    }

    Console.WriteLine($"{n,8:N0}{steps,8:N0}");
}

static int[] MakeStock(int count)
{
    var random = new Random(3);
    var stock = new int[count];
    for (int i = 0; i < count; i++)
        stock[i] = random.Next(0, 50);
    return stock;
}
```

```text output
       n   steps
   1,000   2,000
   2,000   4,000
   4,000   8,000
   8,000  16,000
```

Steps track *n* exactly at 2*n*: each loop is O(*n*) and O(*n*) + O(*n*) is O(*n*), not O(2*n*) — the constant 2 is dropped for the reason [the prerequisite article](/complexity/big-o-notation/#why-constants-and-small-terms-get-dropped) gives. That is rule 1 from its closing list, "statements in sequence add, and the largest term wins," confirmed by a counter instead of just asserted.

## How do you find the complexity of nested loops?

Nesting multiplies trip counts only when neither loop's count depends on the other. Checking every order line against a list of discontinued SKUs does exactly that: *m* orders against *n* codes, independent of each other.

```csharp run id=cross-check
using System.Globalization;

CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;

Console.WriteLine($"{"orders",8}{"codes",7}{"checks",9}");
(int Orders, int Codes)[] sizes =
[
    (1_000, 40), (2_000, 40), (4_000, 40), (4_000, 80),
];
foreach (var (m, n) in sizes)
{
    int[] orderSkus = MakeCodes(m, seed: 1);
    int[] discontinued = MakeCodes(n, seed: 2);
    long checks = 0;
    int flagged = 0;

    for (int i = 0; i < m; i++)
    {
        for (int j = 0; j < n; j++)
        {
            checks++;
            if (orderSkus[i] == discontinued[j])
                flagged++;
        }
    }

    Console.WriteLine($"{m,8:N0}{n,7:N0}{checks,9:N0}");
}

static int[] MakeCodes(int count, int seed)
{
    var random = new Random(seed);
    var codes = new int[count];
    for (int i = 0; i < count; i++)
        codes[i] = random.Next(100_000, 999_999);
    return codes;
}
```

```text output
  orders  codes   checks
   1,000     40   40,000
   2,000     40   80,000
   4,000     40  160,000
   4,000     80  320,000
```

Doubling *m* alone doubles the checks; doubling *n* alone doubles them again. The cost is O(*m*·*n*), and writing O(*n*²) would quietly assume the two lists are the same size — rule 4 from the prerequisite's list, now measured rather than stated.

::::exercise[Find the trap: two loops, one bound by a constant]
Both loops below are nested, syntactically. What is the true Θ bound as a function of `n`? The inner loop's range never changes.

```csharp run
int n = 1_000_000;
long steps = 0;

for (int row = 0; row < n; row++)
    for (int col = 0; col < 8; col++)
        steps++;
```

:::solution
Θ(*n*), not Θ(*n*²). "Two nested loops" describes the *syntax*; the *cost* depends on whether the inner trip count grows with `n`. Here it is pinned at 8 regardless of `n`, so the whole thing is *n* repetitions of 8 constant-time steps — O(*n*) work multiplied by an O(1) inner loop, which is still O(*n*).

```csharp run id=ex-nested-trap
using System.Globalization;

CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;

Console.WriteLine($"{"n",9}{"steps",10}{"steps/n",8}");
foreach (int n in (int[])[1_000, 10_000, 100_000, 1_000_000])
{
    long steps = 0;
    for (int row = 0; row < n; row++)
        for (int col = 0; col < 8; col++)
            steps++;

    Console.WriteLine(
        $"{n,9:N0}{steps,10:N0}{(double)steps / n,8:F1}");
}
```

```text output
        n     steps steps/n
    1,000     8,000     8.0
   10,000    80,000     8.0
  100,000   800,000     8.0
1,000,000 8,000,000     8.0
```

`steps/n` holds flat at 8.0 across three orders of magnitude of `n`; a Θ(*n*²) function's ratio to *n* would itself grow without bound.
:::
::::

## What happens when the inner loop's range depends on the outer one?

A round-robin tournament schedules every team against every *later* team exactly once, so team *i* has *n* − 1 − *i* opponents left to fix — the inner loop shrinks as the outer one advances.

```csharp run id=round-robin
using System.Globalization;

CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;

Console.WriteLine($"{"n",6}{"matches",9}{"formula",9}");
foreach (int n in (int[])[8, 16, 100, 1_000])
{
    long matches = 0;
    for (int i = 0; i < n; i++)
        for (int j = i + 1; j < n; j++)
            matches++;

    long formula = (long)n * (n - 1) / 2;
    Console.WriteLine($"{n,6:N0}{matches,9:N0}{formula,9:N0}");
}
```

```text output
     n  matches  formula
     8       28       28
    16      120      120
   100    4,950    4,950
 1,000  499,500  499,500
```

Rule 2 from the prerequisite article covers this: "nested loops multiply, if the inner loop's trip count does not depend on the outer variable... if it does, add up the trips." Written as a sum, that is *n* − 1 opponents for team 0, plus *n* − 2 for team 1, down to 0 for the last team:

```text
(n-1) + (n-2) + ... + 1 + 0 = n(n-1)/2
```

The closed form comes from pairing the sum's first and last surviving terms, second and second-to-last, and so on — each pair adds to *n* − 1, there are about *n*/2 such pairs, and (*n* − 1)·*n*/2 is the total. The same pairing trick reduces any arithmetic series (one that changes by a fixed amount each step) to a product, and it is the technique the recursion trees below reuse to sum a series of a different shape.

<figure class="diagram">
<svg viewBox="0 0 360 210" role="img" aria-labelledby="rr-title rr-desc">
<title id="rr-title">Remaining matches for each team in a 6-team round robin</title>
<desc id="rr-desc">Six rows, one per team, shrinking from 5 remaining matches down to 0. The rows form a staircase whose total area is 15, which is 6 times 5 over 2.</desc>
<text x="20" y="16" class="d-bold">n = 6 teams, matches left to schedule</text>
<rect x="90" y="24" width="100" height="20" class="d-box-accent"/>
<text x="20" y="39" class="d-small">team 0</text>
<text x="200" y="39" class="d-mono d-small">5</text>
<rect x="90" y="52" width="80" height="20" class="d-box"/>
<text x="20" y="67" class="d-small">team 1</text>
<text x="180" y="67" class="d-mono d-small">4</text>
<rect x="90" y="80" width="60" height="20" class="d-box"/>
<text x="20" y="95" class="d-small">team 2</text>
<text x="160" y="95" class="d-mono d-small">3</text>
<rect x="90" y="108" width="40" height="20" class="d-box"/>
<text x="20" y="123" class="d-small">team 3</text>
<text x="140" y="123" class="d-mono d-small">2</text>
<rect x="90" y="136" width="20" height="20" class="d-box"/>
<text x="20" y="151" class="d-small">team 4</text>
<text x="120" y="151" class="d-mono d-small">1</text>
<text x="20" y="179" class="d-small">team 5</text>
<text x="90" y="179" class="d-mono d-small">0 opponents left</text>
<text x="20" y="197" class="d-muted d-small">5+4+3+2+1+0 = 15 = 6·5/2 matches total.</text>
</svg>
<figcaption>Figure 1. Team <em>i</em> has <em>n</em> − 1 − <em>i</em> opponents left; the shrinking rows are the same staircase the code's inner loop walks, row by row.</figcaption>
</figure>

::::exercise[Extend the code: replace the loop with the formula]
Add a second computation next to the loop above that gets the match count in O(1), and check the two agree for a size too large to eyeball.

:::solution
```csharp run id=ex-closed-form
using System.Globalization;

CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;

Console.WriteLine($"{"n",7}  {"loop",10}  {"formula",10}");
foreach (int n in (int[])[8, 100, 1_000, 20_000])
{
    long loopMatches = 0;
    for (int i = 0; i < n; i++)
        for (int j = i + 1; j < n; j++)
            loopMatches++;

    long formulaMatches = (long)n * (n - 1) / 2;
    Console.WriteLine(
        $"{n,7:N0}  {loopMatches,10:N0}  {formulaMatches,10:N0}");
}
```

```text output
      n        loop     formula
      8          28          28
    100       4,950       4,950
  1,000     499,500     499,500
 20,000  199,990,000  199,990,000
```

Once a loop's total has a closed form, computing it stops being O(*n*²) work and becomes O(1) arithmetic — the loop was never necessary once the sum was known, only convenient.
:::
::::

## What's the complexity of a loop whose counter multiplies or divides?

A pallet of boxes that gets halved each time — split it, keep one half, split that — reaches one box after a small, predictable number of splits.

```csharp run id=halving
using System.Globalization;

CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;

Console.WriteLine($"{"pallet",8}{"splits",8}");
foreach (int n in (int[])[100, 200, 400, 800, 1_600, 3_200])
{
    int boxes = n;
    long splits = 0;
    while (boxes > 1)
    {
        boxes /= 2;
        splits++;
    }
    Console.WriteLine($"{n,8:N0}{splits,8:N0}");
}
```

```text output
  pallet  splits
     100       6
     200       7
     400       8
     800       9
   1,600      10
   3,200      11
```

Every doubling of the pallet costs exactly one more split — rule 3 from the prerequisite article ("a loop variable that is multiplied or divided by a constant each time round runs about log *n* times"), and the same "+1 step per doubling" the [growth-rate table](/complexity/big-o-notation/#the-growth-rates-you-will-meet-judged-by-doubling) there predicted for O(log *n*). It is Θ(log₂ *n*): a loop like this one never touches most of the input, only a shrinking prefix of it.

## How do you find the complexity of a recursive function?

Splitting a problem into smaller instances of itself, solving each, and combining the results is [divide and conquer](https://xlinux.nist.gov/dads/HTML/divideAndConquer.html), the shape behind every [recursive](/glossary/#recursion) function below. A recursive function that finds the highest score on a leaderboard by splitting it in half, finding each half's highest, and comparing the two is the simplest version: one comparison of O(1) work per call, on top of two calls on half the input.

```csharp run id=recursive-max
using System.Globalization;

CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;

Console.WriteLine($"{"n",7}{"calls",8}{"2n-1",8}");
foreach (int n in (int[])[8, 16, 32, 64, 128, 256])
{
    int[] scores = MakeScores(n);
    long calls = 0;
    RecursiveMax(scores, 0, n, ref calls);
    Console.WriteLine($"{n,7:N0}{calls,8:N0}{2 * n - 1,8:N0}");
}

static int RecursiveMax(int[] scores, int lo, int hi, ref long calls)
{
    calls++;
    if (hi - lo == 1) return scores[lo];

    int mid = lo + (hi - lo) / 2;
    int leftMax = RecursiveMax(scores, lo, mid, ref calls);
    int rightMax = RecursiveMax(scores, mid, hi, ref calls);
    return Math.Max(leftMax, rightMax);
}

static int[] MakeScores(int count)
{
    var random = new Random(9);
    var scores = new int[count];
    for (int i = 0; i < count; i++)
        scores[i] = random.Next(0, 100);
    return scores;
}
```

```text output
      n   calls    2n-1
      8      15      15
     16      31      31
     32      63      63
     64     127     127
    128     255     255
    256     511     511
```

The call count is exactly 2*n* − 1: an intuition worth checking here, because it is easy to expect Θ(log *n*) since the input keeps halving. That intuition describes how *deep* the recursion goes (about log₂ *n* levels), not how many calls happen in total — every one of those levels has calls of its own, and it is the total across every level, not the depth of any one branch, that the rest of this page counts.

A *recursion tree* makes both numbers visible at once: draw one box per call, children below their parent. The tree for `RecursiveMax` on 8 scores has a root, two children, four grandchildren and eight leaves — 1 + 2 + 4 + 8 = 15, matching the table's first row. Doubling geometric sums like that one total less than twice their last term, which is why a tree with *n* leaves has only about 2*n* nodes overall, not *n* log *n*: at each level the *number* of calls doubles while the *work per call* (here, none beyond the comparison) does not shrink to compensate the way it does in the next section.

## What is a recurrence relation, and how do you solve one?

A *recurrence relation* defines a function's cost in terms of the same function on smaller input, plus whatever work happens outside the recursive calls. `RecursiveMax`'s cost function *T*(*n*) — the number of calls to process *n* scores — satisfies

```text
T(n) = 2·T(n/2) + O(1),  T(1) = O(1)
```

two calls on half the input, plus one comparison. Solving a recurrence means finding a closed-form Θ(...) that satisfies it. One way is the *recursion tree method*: sum the work done at every level. Level *k* has 2<sup>*k*</sup> calls, and each call does O(1) work regardless of how many scores it covers — one comparison, once its two recursive calls return — so level *k* costs Θ(2<sup>*k*</sup>): a total that *doubles* every level, all the way down to the deepest level, *k* = log₂ *n*, where the 2<sup>*k*</sup> = *n* leaf calls sit. Summing a doubling number of calls across log₂ *n* + 1 levels — 1 + 2 + 4 + ... + *n* — is the same "sum less than twice its last term" trick as the previous section, so the total is dominated by the leaves: Θ(*n*), matching the table exactly.

A second way, the *substitution method*, guesses a closed form and checks it by unrolling the recurrence a few steps: *T*(*n*) = 2*T*(*n*/2) + 1 = 2(2*T*(*n*/4) + 1) + 1 = 4*T*(*n*/4) + 3 = ... = *n*·*T*(1) + (*n* − 1), which is Θ(*n*) once *T*(1) is a constant. Both methods land on the same answer; recursion trees make the *shape* of the cost visible, which is what the rest of this page relies on.

## What is the Master Theorem, and how do you use it?

Most divide-and-conquer recurrences have the same three-part shape: *a* recursive calls, each on an input of size *n*/*b*, plus *f*(*n*) work outside the calls.

> For constants *a* ≥ 1 and *b* > 1, and *T*(*n*) = *a*·*T*(*n*/*b*) + *f*(*n*), let *p* = log<sub>*b*</sub> *a*. Then:
> 1. If *f*(*n*) = O(*n*<sup>*p*−ε</sup>) for some constant ε > 0, then *T*(*n*) = Θ(*n*<sup>*p*</sup>).
> 2. If *f*(*n*) = Θ(*n*<sup>*p*</sup>), then *T*(*n*) = Θ(*n*<sup>*p*</sup> log *n*).
> 3. If *f*(*n*) = Ω(*n*<sup>*p*+ε</sup>) for some constant ε > 0, and *a*·*f*(*n*/*b*) ≤ *c*·*f*(*n*) for some constant *c* < 1 and all large enough *n*, then *T*(*n*) = Θ(*f*(*n*)).

This is the master method of CLRS chapter 4, which also proves it by generalizing the recursion-tree argument above to an arbitrary *f*(*n*). The three cases compare *f*(*n*), the cost outside the recursive calls, against *n*<sup>*p*</sup>, the cost the calls alone would have if they did no work at their base cases beyond O(1) each — the number of leaves in the tree. Case 3's extra clause, the *regularity condition*, always holds when *f*(*n*) is a polynomial, which covers every example below, so it costs nothing extra to check here.

### Case 1: the leaves dominate

`RecursiveMax`'s recurrence has *a* = 2, *b* = 2, so *p* = log₂ 2 = 1, and *f*(*n*) = O(1) = O(*n*<sup>1−1</sup>) — polynomially smaller than *n*¹, satisfying case 1 with ε = 1. The theorem predicts *T*(*n*) = Θ(*n*¹) = Θ(*n*), exactly the 2*n* − 1 the earlier table measured. When the work outside the calls is cheap enough, the sheer number of leaves — Θ(*n*<sup>*p*</sup>) of them — is what the total cost tracks; everything above the leaves is a lower-order term.

### Case 2: every level pulls the same weight

Merging two already-sorted halves of the same leaderboard costs one comparison per element moved — Θ(*hi* − *lo*) work at each call, not O(1):

```csharp run id=merge-recurrence
using System.Globalization;

CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;

Console.WriteLine($"{"n",8}{"moves",10}{"n*log2n",10}{"ratio",7}");
foreach (int n in (int[])[64, 128, 256, 512, 1_024, 2_048, 4_096])
{
    int[] scores = MakeScores(n);
    long moves = 0;
    RankSort(scores, 0, n, new int[n], ref moves);

    double nlogn = n * Math.Log2(n);
    Console.WriteLine(
        $"{n,8:N0}{moves,10:N0}{nlogn,10:N0}{moves / nlogn,7:F2}");
}

static void RankSort(int[] scores, int lo, int hi, int[] buffer, ref long moves)
{
    if (hi - lo < 2) return;

    int mid = lo + (hi - lo) / 2;
    RankSort(scores, lo, mid, buffer, ref moves);
    RankSort(scores, mid, hi, buffer, ref moves);

    // Combine: merge the two sorted halves. This is the
    // O(hi - lo) work charged to this call.
    int left = lo, right = mid, k = lo;
    while (left < mid && right < hi)
    {
        moves++;
        buffer[k++] = scores[left] <= scores[right]
            ? scores[left++] : scores[right++];
    }
    while (left < mid) { moves++; buffer[k++] = scores[left++]; }
    while (right < hi) { moves++; buffer[k++] = scores[right++]; }
    Array.Copy(buffer, lo, scores, lo, hi - lo);
}

static int[] MakeScores(int count)
{
    var random = new Random(9);
    var scores = new int[count];
    for (int i = 0; i < count; i++)
        scores[i] = random.Next(0, 1000);
    return scores;
}
```

```text output
       n     moves   n*log2n  ratio
      64       384       384   1.00
     128       896       896   1.00
     256     2,048     2,048   1.00
     512     4,608     4,608   1.00
   1,024    10,240    10,240   1.00
   2,048    22,528    22,528   1.00
   4,096    49,152    49,152   1.00
```

Here *a* = 2, *b* = 2, *p* = 1, and *f*(*n*) = Θ(*n*) = Θ(*n*<sup>1</sup>): case 2, so *T*(*n*) = Θ(*n* log *n*). The ratio column holds at 1.00 because, for a power of two, every level moves exactly *n* elements in total and there are exactly log₂ *n* levels — the recursion tree from two sections back, but this time the per-call work grows back to Θ(*n*) at every level instead of collapsing to the leaves. This is the derivation behind the Θ(*n* log *n*) that [the prerequisite article measured empirically](/complexity/big-o-notation/#when-the-dropped-constant-decides-the-winner) for merge sort without proving it. Halving the array costs nothing; all the work is in recombining the two sorted halves afterward — NIST's dictionary of algorithms calls this shape "[easy split, hard merge](https://xlinux.nist.gov/dads/HTML/easySplitHardMerge.html)".

<figure class="diagram">
<svg viewBox="0 0 360 345" role="img" aria-labelledby="rt-title rt-desc">
<title id="rt-title">Recursion tree for T(n) = 2T(n/2) + n</title>
<desc id="rt-desc">Three drawn levels of a binary call tree, root at top. The root does n units of work. Two children at the next level do n/2 each, four grandchildren do n/4 each. Every level's boxes add up to n. A final band stands for the leaves, n calls of O(1) each.</desc>
<path d="M180 54 L80 84" class="d-line"/>
<path d="M180 54 L280 84" class="d-line"/>
<path d="M80 118 L40 148" class="d-line"/>
<path d="M80 118 L120 148" class="d-line"/>
<path d="M280 118 L240 148" class="d-line"/>
<path d="M280 118 L320 148" class="d-line"/>
<rect x="135" y="20" width="90" height="34" rx="5" class="d-box-accent"/>
<text x="180" y="42" text-anchor="middle" class="d-mono d-bold">n</text>
<text x="180" y="66" text-anchor="middle" class="d-muted d-small">level 0: 1 call of n</text>
<rect x="45" y="84" width="70" height="34" rx="5" class="d-box"/>
<text x="80" y="106" text-anchor="middle" class="d-mono">n/2</text>
<rect x="245" y="84" width="70" height="34" rx="5" class="d-box"/>
<text x="280" y="106" text-anchor="middle" class="d-mono">n/2</text>
<text x="180" y="130" text-anchor="middle" class="d-muted d-small">level 1: 2 calls of n/2 = n</text>
<rect x="16" y="148" width="48" height="30" rx="4" class="d-box-2"/>
<text x="40" y="168" text-anchor="middle" class="d-mono d-small">n/4</text>
<rect x="96" y="148" width="48" height="30" rx="4" class="d-box-2"/>
<text x="120" y="168" text-anchor="middle" class="d-mono d-small">n/4</text>
<rect x="216" y="148" width="48" height="30" rx="4" class="d-box-2"/>
<text x="240" y="168" text-anchor="middle" class="d-mono d-small">n/4</text>
<rect x="296" y="148" width="48" height="30" rx="4" class="d-box-2"/>
<text x="320" y="168" text-anchor="middle" class="d-mono d-small">n/4</text>
<text x="180" y="192" text-anchor="middle" class="d-muted d-small">level 2: 4 calls of n/4 = n</text>
<text x="180" y="212" text-anchor="middle" class="d-muted">⋮</text>
<rect x="20" y="224" width="320" height="30" rx="4" class="d-box-2"/>
<text x="180" y="244" text-anchor="middle" class="d-mono d-small">n calls of O(1) each</text>
<text x="180" y="268" text-anchor="middle" class="d-muted d-small">level log₂n: n leaves × 1 = n</text>
<text x="20" y="298" class="d-small">Every level sums to n, and there are</text>
<text x="20" y="314" class="d-small">about log₂n + 1 levels top to bottom.</text>
<text x="20" y="334" class="d-bold d-text-accent">Total work: Θ(n log n)</text>
</svg>
<figcaption>Figure 2. Every level of the tree does <em>n</em> units of total work; summing <em>n</em> over about log₂<em>n</em> + 1 levels gives Θ(<em>n</em> log <em>n</em>), the closed form the program above confirms by counting real moves.</figcaption>
</figure>

### Case 3: the combine step dominates

Now make the combine step expensive instead of the split: recursively rank two halves of the leaderboard (trivial work), then compare every score in the left half against every score in the right half — Θ((*hi* − *lo*)²) at each call.

```csharp run id=expensive-combine
using System.Globalization;

CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;

Console.WriteLine($"{"n",6}{"compares",11}{"n^2/2",11}{"ratio",7}");
foreach (int n in (int[])[16, 32, 64, 128, 256, 512])
{
    int[] scores = MakeScores(n);
    long compares = 0;
    CountCrossPairs(scores, 0, n, ref compares);

    double quadratic = n * (double)n / 2;
    Console.WriteLine(
        $"{n,6:N0}{compares,11:N0}{quadratic,11:N0}{compares / quadratic,7:F2}");
}

static long CountCrossPairs(int[] scores, int lo, int hi, ref long compares)
{
    if (hi - lo < 2) return 0;

    int mid = lo + (hi - lo) / 2;
    long count = CountCrossPairs(scores, lo, mid, ref compares)
               + CountCrossPairs(scores, mid, hi, ref compares);

    // Combine: compare every left-half score with every
    // right-half score. O((hi - lo)^2) work, charged here.
    for (int i = lo; i < mid; i++)
        for (int j = mid; j < hi; j++)
        {
            compares++;
            if (scores[i] > scores[j]) count++;
        }
    return count;
}

static int[] MakeScores(int count)
{
    var random = new Random(9);
    var scores = new int[count];
    for (int i = 0; i < count; i++)
        scores[i] = random.Next(0, 1000);
    return scores;
}
```

```text output
     n   compares      n^2/2  ratio
    16        120        128   0.94
    32        496        512   0.97
    64      2,016      2,048   0.98
   128      8,128      8,192   0.99
   256     32,640     32,768   1.00
   512    130,816    131,072   1.00
```

*a* = 2, *b* = 2, *p* = 1 again, but the combine step alone costs *f*(*n*) = (*n*/2)² = *n*²/4 at the root — Ω(*n*<sup>1+1</sup>): polynomially *larger* than *n*¹, case 3 with ε = 1. The regularity check: *a*·*f*(*n*/*b*) = 2·(*n*/2)²/4 = *n*²/8, and *n*²/8 ≤ ½·*f*(*n*) = *n*²/8, so *c* = ½ works. The theorem gives *T*(*n*) = Θ(*f*(*n*)) = Θ(*n*²) — the root's own combine step, not the calls beneath it, decides the order of growth. Unrolling the recurrence shows why the measured ratio converges to 1.00 against *n*²/2 rather than *n*²/4: the root contributes *n*²/4, the level below it contributes *n*²/8 in total (two calls of *n*²/16 each), the level below that *n*²/16, and so on — halving every level, a geometric series that sums to exactly twice the root's own share.

::::exercise[Apply it: binary search's recurrence]
[Binary search](/algorithms/binary-search/) halves the search range and does O(1) work choosing which half to keep: *T*(*n*) = *T*(*n*/2) + O(1). Which case applies, and what does it give?

:::solution
*a* = 1, *b* = 2, so *p* = log₂ 1 = 0, and *n*<sup>0</sup> = 1. *f*(*n*) = O(1) = Θ(*n*<sup>0</sup>): that is case 2, not case 1 — a single call, not two, but the theorem doesn't require *a* > 1. *T*(*n*) = Θ(*n*<sup>0</sup> log *n*) = Θ(log *n*), the bound documented for [`List<T>.BinarySearch`](/complexity/big-o-notation/#the-growth-rates-you-will-meet-judged-by-doubling).
:::
::::

::::exercise[Measure it: three subproblems instead of two]
Change *a* from 2 to 3 — three recursive calls on half the input each, plus Θ(*n*) work per call: *T*(*n*) = 3*T*(*n*/2) + O(*n*). Work out *p* = log₂ 3 ≈ 1.585 and which case applies, then confirm by running.

:::solution
*n*<sup>*p*</sup> = *n*<sup>1.585</sup>, and *f*(*n*) = O(*n*) = O(*n*<sup>1.585−ε</sup>) for any ε < 0.585: case 1, so *T*(*n*) = Θ(*n*<sup>1.585</sup>). This is not a made-up exponent — it is the cost of Karatsuba's integer multiplication algorithm, which splits an *n*-digit multiplication into three multiplications of *n*/2 digits, exactly this recurrence, beating the naive O(*n*²) method for large enough *n*.

Doubling *n* should multiply the cost by 2<sup>1.585</sup> ≈ 3 — the same 3 as *a*, since the leaves dominate:

```csharp run id=ex-triple-split
using System.Globalization;

CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;

Console.WriteLine($"{"n",7}{"steps",10}{"ratio",7}");
long previous = 0;
foreach (int n in (int[])[64, 128, 256, 512, 1_024, 2_048])
{
    long steps = 0;
    Explore(n, ref steps);
    string ratio = previous == 0 ? "" : $"x{(double)steps / previous:F2}";
    Console.WriteLine($"{n,7:N0}{steps,10:N0}{ratio,7}");
    previous = steps;
}

// T(n) = 3T(n/2) + O(n)
static void Explore(int n, ref long steps)
{
    if (n < 1) return;
    for (int i = 0; i < n; i++) steps++;
    Explore(n / 2, ref steps);
    Explore(n / 2, ref steps);
    Explore(n / 2, ref steps);
}
```

```text output
      n     steps  ratio
     64     2,059
    128     6,305  x3.06
    256    19,171  x3.04
    512    58,025  x3.03
  1,024   175,099  x3.02
  2,048   527,345  x3.01
```

The ratio closes in on 3.00 from above as *n* grows, matching 2<sup>log₂ 3</sup> = 3 exactly.
:::
::::

:::dotnet
Every recursive call in this section keeps a real stack frame until it returns; nothing here relies on the JIT collapsing them. A Θ(*n*) recursion — case 1 above, `RecursiveMax` included — allocates *n* stack frames at its deepest point, not log *n*, because the deepest branch of the tree still has to return through every ancestor above it. The default thread stack size in .NET is documented as 1 megabyte, and an unhandled [`StackOverflowException`](https://learn.microsoft.com/en-us/dotnet/api/system.stackoverflowexception) "can't be caught... and the corresponding process is terminated by default." That is a [space complexity](/glossary/#space-complexity) concern, not a time one, and it is why a recursive solution whose recursion *depth* (not its total call count) grows with *n* is sometimes rewritten as an explicit loop with its own stack or queue — a trade this page does not measure.
:::

## When does the Master Theorem not apply?

The theorem needs *a* and *b* to be constants and every subproblem to be the same size, *n*/*b*. Two common shapes break that, and a third slips between the cases without breaking it at all.

**Quicksort's worst case doesn't divide the input at all.** Partitioning around a pivot costs Θ(*n*) — NIST's dictionary calls this shape "[hard split, easy merge](https://xlinux.nist.gov/dads/HTML/hardSplitEasyMerge.html)", the reverse of merge sort's — and on already-sorted input with a first-element pivot, every partition puts all *n* − 1 remaining items on one side and none on the other. The recurrence is *T*(*n*) = *T*(*n* − 1) + Θ(*n*), which is not *a*·*T*(*n*/*b*) at all: one recursive call, not *a* of them, and the input shrinks by a fixed amount rather than a fixed factor. Unrolling it by hand gives (*n* − 1) + (*n* − 2) + ... + 1 — the exact round-robin sum from earlier in this page, so the worst case is Θ(*n*²) by the same arithmetic-series argument, no master theorem required.

**Unequal-sized subproblems** — *T*(*n*) = *T*(*n*/3) + *T*(2*n*/3) + Θ(*n*), say — also fall outside the theorem's shape, though a recursion tree still solves them: every level's sizes sum to *n* regardless of how unevenly they split, so each of the tree's Θ(log *n*) levels still contributes Θ(*n*), giving Θ(*n* log *n*) overall even though the tree is lopsided, with branches of different lengths depending which side keeps getting the bigger share.

**The gap between cases is real, and the theorem is silent there.** *f*(*n*) has to be polynomially smaller, equal to, or polynomially larger than *n*<sup>*p*</sup> — the exponent ε has to exist. *T*(*n*) = *T*(*n*/2) + O(log *n*) has *a* = 1, *b* = 2, *p* = 0, and *f*(*n*) = O(log *n*), which is bigger than *n*<sup>0</sup> = 1 but not by any polynomial factor: none of the three cases fires.

```csharp run id=gap-case
using System.Globalization;

CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;

Console.WriteLine($"{"n",9}{"steps",8}{"L(L+1)/2",9}");
foreach (int n in (int[])[64, 256, 1_024, 4_096, 16_384, 65_536])
{
    long steps = 0;
    Explore(n, ref steps);

    int L = (int)Math.Log2(n);
    long formula = (long)L * (L + 1) / 2;
    Console.WriteLine($"{n,9:N0}{steps,8:N0}{formula,9:N0}");
}

// T(n) = T(n/2) + O(log n): one recursive call on half
// the input, plus work proportional to log n at this level.
static void Explore(int n, ref long steps)
{
    if (n < 1) return;

    int remaining = n;
    while (remaining > 1)
    {
        remaining /= 2;
        steps++;
    }

    Explore(n / 2, ref steps);
}
```

```text output
        n   steps L(L+1)/2
       64      21       21
      256      36       36
    1,024      55       55
    4,096      78       78
   16,384     105      105
   65,536     136      136
```

Solving this one directly (the recursion tree again): level *k* does O(log(*n*/2<sup>*k*</sup>)) = O(log *n* − *k*) work, for *k* from 0 to log₂ *n*. Summing log *n* − *k* over that range is the same arithmetic series as the round-robin section, now in units of log *n* rather than *n*: the total is Θ((log *n*)²), matching `L(L+1)/2` in the table with *L* = log₂ *n*. Growth confirms it is neither linear in *n* (65,536 does 136 steps, not thousands) nor constant (136 is not 21): it sits in the gap, and only unrolling the recurrence by hand — not the Master Theorem — says where.

## What's the procedure, from scratch?

1. **Loop or recursion?** A loop's cost is read directly from its trip counts; a recursive function needs a recurrence *T*(*n*) first.
2. **For loops:** sequential loops add, keeping the largest term. Nested loops multiply when the inner trip count is independent of the outer one — genuinely independent of *n* too, not just of the outer variable, per the nested-loop trap above. When the inner bound depends on the outer one, write the sum out and evaluate it: an arithmetic series (this page's triangular sums) gives Θ(*n*²); a loop whose counter is multiplied or divided by a constant gives Θ(log *n*).
3. **For recursion:** identify *a* (how many recursive calls), *b* (the factor the input shrinks by) and *f*(*n*) (the work outside the calls). If every subproblem is size *n*/*b* for constant *a* and *b*, compute *p* = log<sub>*b*</sub> *a* and compare *f*(*n*) to *n*<sup>*p*</sup>: polynomially smaller is case 1 (Θ(*n*<sup>*p*</sup>)), the same order is case 2 (Θ(*n*<sup>*p*</sup> log *n*)), polynomially larger is case 3 (Θ(*f*(*n*))).
4. **If the shape doesn't match** — subproblems of unequal size, a recurrence that subtracts rather than divides, or a comparison that falls in the gap between cases — draw the recursion tree and sum each level directly, or guess a closed form and confirm it by unrolling a few steps (the substitution method).
5. **Write the counter into the real code.** Every derivation on this page was a guess until a `long` field, incremented in the right place and printed across a few sizes that double, confirmed it. A ratio that refuses to settle near the predicted number means the analysis or the code has a bug — usually the code.
