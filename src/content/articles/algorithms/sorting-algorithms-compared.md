---
title: "Sorting Algorithms Compared: What to Know and What .NET Uses"
description: "Insertion through heap sort, implemented and counted; the proved Ω(n log n) floor no comparison sort can beat; and what Array.Sort and OrderBy run in .NET 10."
pillar: algorithms
order: 2
author: markus
published: 2026-09-22
updated: 2026-09-22
level: intermediate
tags: [sorting, quicksort, merge-sort, heap-sort, stability, big-o]
prerequisites: ["complexity/big-o-notation"]
sources:
  - title: "Introduction to Algorithms, 4th ed., chapters 2, 6, 7 and 8"
    url: "https://mitpress.mit.edu/9780262046305/introduction-to-algorithms/"
    publisher: "MIT Press"
    accessed: 2026-09-22
  - title: "Algorithms, 4th ed., section 2.1: Elementary Sorts"
    url: "https://algs4.cs.princeton.edu/21elementary/"
    publisher: "Sedgewick and Wayne, Princeton University"
    accessed: 2026-09-22
  - title: "Algorithms, 4th ed., section 2.2: Mergesort"
    url: "https://algs4.cs.princeton.edu/22mergesort/"
    publisher: "Sedgewick and Wayne, Princeton University"
    accessed: 2026-09-22
  - title: "Algorithms, 4th ed., section 2.3: Quicksort"
    url: "https://algs4.cs.princeton.edu/23quicksort/"
    publisher: "Sedgewick and Wayne, Princeton University"
    accessed: 2026-09-22
  - title: "Algorithms, 4th ed., section 2.4: Priority Queues"
    url: "https://algs4.cs.princeton.edu/24pq/"
    publisher: "Sedgewick and Wayne, Princeton University"
    accessed: 2026-09-22
  - title: "Array.Sort Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.array.sort"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "List<T>.Sort Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.list-1.sort"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Enumerable.OrderBy Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.linq.enumerable.orderby"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "ArraySortHelper.cs (System.Private.CoreLib), dotnet/runtime main branch"
    url: "https://github.com/dotnet/runtime/blob/main/src/libraries/System.Private.CoreLib/src/System/Collections/Generic/ArraySortHelper.cs"
    publisher: "GitHub, dotnet/runtime"
    accessed: 2026-09-22
  - title: "Array.cs (IntrosortSizeThreshold), dotnet/runtime main branch"
    url: "https://github.com/dotnet/runtime/blob/main/src/libraries/System.Private.CoreLib/src/System/Array.cs"
    publisher: "GitHub, dotnet/runtime"
    accessed: 2026-09-22
draft: true
---

Sort the array `[3, 1, 4, 1, 5, 9, 2, 6]` with insertion sort and it makes 14 comparisons. Sort the same eight numbers already in order and it makes 7. Sort them reversed and it makes 28. Selection sort, given all three arrays, makes 28 comparisons every single time — it cannot tell a sorted array from a reversed one until it has looked at every element regardless. That gap between "adapts to the input" and "always pays the worst case" is most of what choosing a sorting algorithm comes down to. This page builds five of them, counts what each one actually does, proves a limit none of them can beat, and ends with what `Array.Sort` and `OrderBy` run when you call them.

## Insertion sort: the cost depends on how sorted the input already is

Insertion sort keeps a sorted prefix at the front of the array and grows it by one element at a time: take the next value, slide it left past every already-sorted element that is bigger than it, and drop it in the gap.

```csharp run id=hook
int[] baseline = [3, 1, 4, 1, 5, 9, 2, 6];
int[] sortedArr = (int[])baseline.Clone();
Array.Sort(sortedArr);
int[] reverseArr = (int[])sortedArr.Clone();
Array.Reverse(reverseArr);

Console.WriteLine($"{"input",-8}{"comparisons",12}");
foreach (var (name, arr) in new (string Name, int[] Values)[]
{
    ("random", baseline),
    ("sorted", sortedArr),
    ("reverse", reverseArr),
})
{
    int[] copy = (int[])arr.Clone();
    int comparisons = InsertionSort(copy);
    Console.WriteLine($"{name,-8}{comparisons,12}");
}

static int InsertionSort(int[] a)
{
    int comparisons = 0;
    for (int i = 1; i < a.Length; i++)
    {
        int value = a[i];
        int j = i - 1;
        while (j >= 0)
        {
            comparisons++;
            if (a[j] <= value) break;
            a[j + 1] = a[j];
            j--;
        }
        a[j + 1] = value;
    }
    return comparisons;
}
```

```text output
input    comparisons
random            14
sorted             7
reverse           28
```

Every comparison is charged inside the `while` loop, including the one that finds the resting place. On an array that is already sorted, each new element needs exactly one comparison against its left neighbor before the loop breaks, so the total is *n* − 1 = 7. On a reversed array, element *i* (counting from 1) has to pass all *i* elements already placed, so the total is 1 + 2 + ⋯ + (*n* − 1) = *n*(*n* − 1)/2 = 28. Sedgewick and Wayne's [analysis of insertion sort](https://algs4.cs.princeton.edu/21elementary/) states the same two bounds in general — best case *n* − 1 compares, worst case ~*n*²/2 — and gives ~*n*²/4 as the average over random arrays of distinct keys, which sits between the two just as 14 sits between 7 and 28 above.

Insertion sort moves elements in place (no second array), so its extra space is O(1). Its worst case is Θ(*n*²), same as selection sort below, but on data that is already close to sorted — a log file with a few late entries, a leaderboard after one new score — it does close to O(*n*) work instead, which the other four algorithms on this page cannot promise.

::::exercise[Predict the counts, then run them]
Before running anything, predict how many comparisons and how many left-shifts insertion sort makes on `[5, 2, 8, 2, 1]`. A shift is one `a[j + 1] = a[j]` inside the loop.

:::solution
Comparisons: 9. Shifts: 7. Tracing it by hand (`a[j] <= value` breaks the loop, anything else shifts):

| Step | value | Comparisons this step | Shifts this step | Array after |
|---|---:|---:|---:|---|
| i=1 | 2 | 1 | 1 | `[2, 5, 8, 2, 1]` |
| i=2 | 8 | 1 | 0 | `[2, 5, 8, 2, 1]` |
| i=3 | 2 | 2 | 2 | `[2, 2, 5, 8, 1]` |
| i=4 | 1 | 4 | 4 | `[1, 2, 2, 5, 8]` |

Totals: 1+1+2+4 = 9 comparisons, 1+0+2+4 = 7 shifts.

```csharp run
int[] a = [5, 2, 8, 2, 1];
int comparisons = 0, shifts = 0;
for (int i = 1; i < a.Length; i++)
{
    int value = a[i];
    int j = i - 1;
    while (j >= 0)
    {
        comparisons++;
        if (a[j] <= value) break;
        a[j + 1] = a[j];
        shifts++;
        j--;
    }
    a[j + 1] = value;
}
Console.WriteLine($"comparisons: {comparisons}");
Console.WriteLine($"shifts: {shifts}");
Console.WriteLine(string.Join(',', a));
```

```text output
comparisons: 9
shifts: 7
1,2,2,5,8
```
:::
::::

## Selection sort: the cost never depends on the input

Selection sort does the opposite: instead of sliding new values into a growing sorted prefix, it repeatedly scans the whole unsorted suffix for the minimum and swaps it to the front.

```csharp run id=selection
int[] baseline = [3, 1, 4, 1, 5, 9, 2, 6];
int[] sortedArr = (int[])baseline.Clone();
Array.Sort(sortedArr);
int[] reverseArr = (int[])sortedArr.Clone();
Array.Reverse(reverseArr);

Console.WriteLine($"{"input",-8}{"comparisons",12}{"swaps",8}");
foreach (var (name, arr) in new (string Name, int[] Values)[]
{
    ("random", baseline),
    ("sorted", sortedArr),
    ("reverse", reverseArr),
})
{
    int[] copy = (int[])arr.Clone();
    var (comparisons, swaps) = SelectionSort(copy);
    Console.WriteLine($"{name,-8}{comparisons,12}{swaps,8}");
}

static (int Comparisons, int Swaps) SelectionSort(int[] a)
{
    int comparisons = 0, swaps = 0;
    for (int i = 0; i < a.Length - 1; i++)
    {
        int min = i;
        for (int j = i + 1; j < a.Length; j++)
        {
            comparisons++;
            if (a[j] < a[min]) min = j;
        }
        (a[i], a[min]) = (a[min], a[i]);
        swaps++;
    }
    return (comparisons, swaps);
}
```

```text output
input    comparisons   swaps
random            28       7
sorted            28       7
reverse           28       7
```

The comparison count is identical on all three arrays, and that is not a coincidence of this particular data: the inner loop always scans every remaining element to find the minimum, no matter what those elements are, so the count is *n* + (*n* − 1) + ⋯ + 1 = *n*(*n* − 1)/2 = 28 for every input of length 8. Sedgewick and Wayne [state this as a fixed bound](https://algs4.cs.princeton.edu/21elementary/), not an average: "~*n*²/2 compares and *n* exchanges", independent of the data's order. Selection sort is in-place, O(1) extra space, and its comparison count is provably worst-case-equal-to-best-case — the one thing insertion sort cannot say about itself.

## Merge sort: recursion buys a guarantee insertion sort can't make

[Recursion](/glossary/#recursion) gives a way out of the trade-off above: split the array in half, sort each half, then merge the two sorted halves in one linear pass. Figure 1 follows that on the same eight numbers.

<figure class="diagram">
<svg viewBox="0 0 360 320" role="img" aria-labelledby="merge-title merge-desc">
<title id="merge-title">Merge sort dividing eight numbers into pairs, then merging back up</title>
<desc id="merge-desc">Four rows of eight cells. The first row is the original array with tick marks showing where it splits into two halves and four quarters. The second row shows each adjacent pair merged into order. The third row shows each half merged into a four-element run. The fourth row is the fully sorted array.</desc>
<rect x="15" y="30" width="30" height="30" class="d-box"/><text x="30" y="50" text-anchor="middle" class="d-mono d-small">3</text>
<rect x="45" y="30" width="30" height="30" class="d-box"/><text x="60" y="50" text-anchor="middle" class="d-mono d-small">1</text>
<rect x="75" y="30" width="30" height="30" class="d-box"/><text x="90" y="50" text-anchor="middle" class="d-mono d-small">4</text>
<rect x="105" y="30" width="30" height="30" class="d-box"/><text x="120" y="50" text-anchor="middle" class="d-mono d-small">1</text>
<rect x="135" y="30" width="30" height="30" class="d-box"/><text x="150" y="50" text-anchor="middle" class="d-mono d-small">5</text>
<rect x="165" y="30" width="30" height="30" class="d-box"/><text x="180" y="50" text-anchor="middle" class="d-mono d-small">9</text>
<rect x="195" y="30" width="30" height="30" class="d-box"/><text x="210" y="50" text-anchor="middle" class="d-mono d-small">2</text>
<rect x="225" y="30" width="30" height="30" class="d-box"/><text x="240" y="50" text-anchor="middle" class="d-mono d-small">6</text>
<path d="M75 26 V64" class="d-line"/>
<path d="M135 24 V66" class="d-accent" style="stroke-width:2"/>
<path d="M195 26 V64" class="d-line"/>
<text x="15" y="82" class="d-small d-muted">split into halves (thick line) and quarters (thin lines)</text>
<rect x="15" y="104" width="30" height="30" class="d-box"/><text x="30" y="124" text-anchor="middle" class="d-mono d-small">1</text>
<rect x="45" y="104" width="30" height="30" class="d-box"/><text x="60" y="124" text-anchor="middle" class="d-mono d-small">3</text>
<rect x="75" y="104" width="30" height="30" class="d-box"/><text x="90" y="124" text-anchor="middle" class="d-mono d-small">1</text>
<rect x="105" y="104" width="30" height="30" class="d-box"/><text x="120" y="124" text-anchor="middle" class="d-mono d-small">4</text>
<rect x="135" y="104" width="30" height="30" class="d-box"/><text x="150" y="124" text-anchor="middle" class="d-mono d-small">5</text>
<rect x="165" y="104" width="30" height="30" class="d-box"/><text x="180" y="124" text-anchor="middle" class="d-mono d-small">9</text>
<rect x="195" y="104" width="30" height="30" class="d-box"/><text x="210" y="124" text-anchor="middle" class="d-mono d-small">2</text>
<rect x="225" y="104" width="30" height="30" class="d-box"/><text x="240" y="124" text-anchor="middle" class="d-mono d-small">6</text>
<text x="15" y="156" class="d-small d-muted">merge each pair: 1 comparison each, 4 total</text>
<rect x="15" y="178" width="30" height="30" class="d-box-2"/><text x="30" y="198" text-anchor="middle" class="d-mono d-small">1</text>
<rect x="45" y="178" width="30" height="30" class="d-box-2"/><text x="60" y="198" text-anchor="middle" class="d-mono d-small">1</text>
<rect x="75" y="178" width="30" height="30" class="d-box-2"/><text x="90" y="198" text-anchor="middle" class="d-mono d-small">3</text>
<rect x="105" y="178" width="30" height="30" class="d-box-2"/><text x="120" y="198" text-anchor="middle" class="d-mono d-small">4</text>
<rect x="135" y="178" width="30" height="30" class="d-box-2"/><text x="150" y="198" text-anchor="middle" class="d-mono d-small">2</text>
<rect x="165" y="178" width="30" height="30" class="d-box-2"/><text x="180" y="198" text-anchor="middle" class="d-mono d-small">5</text>
<rect x="195" y="178" width="30" height="30" class="d-box-2"/><text x="210" y="198" text-anchor="middle" class="d-mono d-small">6</text>
<rect x="225" y="178" width="30" height="30" class="d-box-2"/><text x="240" y="198" text-anchor="middle" class="d-mono d-small">9</text>
<text x="15" y="230" class="d-small d-muted">merge the two halves into quarters: 3 comparisons each, 6 total</text>
<rect x="15" y="252" width="30" height="30" class="d-box-good"/><text x="30" y="272" text-anchor="middle" class="d-mono d-small">1</text>
<rect x="45" y="252" width="30" height="30" class="d-box-good"/><text x="60" y="272" text-anchor="middle" class="d-mono d-small">1</text>
<rect x="75" y="252" width="30" height="30" class="d-box-good"/><text x="90" y="272" text-anchor="middle" class="d-mono d-small">2</text>
<rect x="105" y="252" width="30" height="30" class="d-box-good"/><text x="120" y="272" text-anchor="middle" class="d-mono d-small">3</text>
<rect x="135" y="252" width="30" height="30" class="d-box-good"/><text x="150" y="272" text-anchor="middle" class="d-mono d-small">4</text>
<rect x="165" y="252" width="30" height="30" class="d-box-good"/><text x="180" y="272" text-anchor="middle" class="d-mono d-small">5</text>
<rect x="195" y="252" width="30" height="30" class="d-box-good"/><text x="210" y="272" text-anchor="middle" class="d-mono d-small">6</text>
<rect x="225" y="252" width="30" height="30" class="d-box-good"/><text x="240" y="272" text-anchor="middle" class="d-mono d-small">9</text>
<text x="15" y="304" class="d-small d-muted">final merge: 5 comparisons — 15 comparisons in total, sorted</text>
</svg>
<figcaption>Figure 1. Merge sort on eight numbers. Splitting (row 1) does no comparisons and does not reorder anything; every comparison happens while merging (rows 2 to 4).</figcaption>
</figure>

```csharp run id=merge
int[] items = [3, 1, 4, 1, 5, 9, 2, 6];
int[] buffer = new int[items.Length];
var calls = new List<int>();
Split(items, buffer, 0, items.Length, calls);

Console.WriteLine(string.Join(',', items));
Console.WriteLine($"comparisons per merge call: {string.Join(' ', calls)}");
Console.WriteLine($"total: {calls.Sum()}");

static void Split(int[] items, int[] buffer, int lo, int hi, List<int> calls)
{
    if (hi - lo < 2) return;
    int mid = lo + (hi - lo) / 2;
    Split(items, buffer, lo, mid, calls);
    Split(items, buffer, mid, hi, calls);

    Array.Copy(items, lo, buffer, lo, hi - lo);
    int left = lo, right = mid, comparisons = 0;
    for (int k = lo; k < hi; k++)
    {
        bool takeLeft;
        if (right >= hi) takeLeft = true;
        else if (left >= mid) takeLeft = false;
        else
        {
            comparisons++;
            takeLeft = buffer[left] <= buffer[right];
        }
        items[k] = takeLeft ? buffer[left++] : buffer[right++];
    }
    calls.Add(comparisons);
}
```

```text output
1,1,2,3,4,5,6,9
comparisons per merge call: 1 1 3 1 1 3 5
total: 15
```

The seven numbers are the seven merge calls a recursive split makes for *n* = 8 (one per internal node of the recursion), visited in the order the recursion returns from them: the two left pairs, the left half, the two right pairs, the right half, then the final merge — matching Figure 1's rows once grouped by level (1+1+1+1 = 4, then 3+3 = 6, then 5). Sedgewick and Wayne's [bound for top-down merge sort](https://algs4.cs.princeton.edu/22mergesort/) is between ½*n* log₂ *n* and *n* log₂ *n* comparisons *on every input*, not just on average: for *n* = 8 that is between 12 and 24, and 15 sits inside it. Unlike insertion and selection sort, merge sort's cost does not depend on how the input was ordered, only on its length — the tree shape in Figure 1 is the same regardless of what the eight numbers are.

That guarantee costs memory: `buffer` is a second *n*-element array, so merge sort needs Θ(*n*) auxiliary [space](/glossary/#space-complexity), against O(1) for insertion and selection sort. The `<=` in the merge step is also doing a second job worth noticing now and returning to two sections down: when the left and right elements are equal, it takes the left one first, which is what makes this particular merge sort *stable*.

::::exercise[Find the bug: a merge that still looks sorted]
This merge is copied from the code above with one operator changed, `<` instead of `<=`. Run it on the priority queue below — `(2, 1)` means priority 2, ticket 1, in arrival order — and check that the priorities come out in order. Then check the ticket numbers within priority 2. What went wrong, and why does the numeric order still look fine?

```csharp run
(int Priority, int Id)[] a = [(2, 1), (1, 2), (2, 3)];
BuggyMergeSort(a);
foreach (var t in a) Console.WriteLine($"priority {t.Priority}, ticket {t.Id}");

static void BuggyMergeSort((int Priority, int Id)[] a)
{
    if (a.Length < 2) return;
    var buffer = new (int Priority, int Id)[a.Length];
    Split(a, buffer, 0, a.Length);
}

static void Split(
    (int Priority, int Id)[] items,
    (int Priority, int Id)[] buffer,
    int lo, int hi)
{
    if (hi - lo < 2) return;
    int mid = lo + (hi - lo) / 2;
    Split(items, buffer, lo, mid);
    Split(items, buffer, mid, hi);

    Array.Copy(items, lo, buffer, lo, hi - lo);
    int left = lo, right = mid;
    for (int k = lo; k < hi; k++)
    {
        bool takeLeft = right >= hi ||
            (left < mid &&
             buffer[left].Priority < buffer[right].Priority);
        items[k] = takeLeft ? buffer[left++] : buffer[right++];
    }
}
```

```text output
priority 1, ticket 2
priority 2, ticket 3
priority 2, ticket 1
```

:::solution
The priorities print 1, 2, 2 — perfectly sorted, so a test that only checks numeric order would pass. But ticket 1 arrived before ticket 3, and the buggy merge printed ticket 3 first. With `<`, a tie (`buffer[left].Priority == buffer[right].Priority`) makes `takeLeft` false, so the merge reaches into the *right* run before the *left* run it should have preferred, and the right run holds a later arrival. Changing `<` back to `<=` fixes it: on a tie, the left side — which always holds the earlier-arriving run in this merge order — wins, and ticket 1 comes out before ticket 3. This single operator is the entire difference between a stable sort and an unstable one that happens to look sorted; [the section on stability](#which-of-these-keep-ties-in-their-original-order) checks all five algorithms on this page against exactly this kind of case.
:::
::::

## Quicksort: fast on average, and one bad pivot from quadratic

Quicksort also splits and recurses, but it splits by *value* instead of by position: pick a pivot, move everything smaller to its left and everything bigger to its right, and recurse on the two sides. That single pass is a *partition*. The version here uses Lomuto's scheme — pick the last element as the pivot, and sweep an index `i` that marks the boundary of "seen so far and no bigger than the pivot".

<figure class="diagram">
<svg viewBox="0 0 360 200" role="img" aria-labelledby="partition-title partition-desc">
<title id="partition-title">Partitioning eight numbers around the pivot 6</title>
<desc id="partition-desc">Before: the original eight numbers with the last one, 6, marked as the pivot. After: the same eight numbers rearranged so the six values 3, 1, 4, 1, 5, 2 are on the left, 6 sits at index 6, and 9 is alone on the right.</desc>
<text x="15" y="20" class="d-small d-muted">before, pivot = last element</text>
<rect x="15" y="30" width="30" height="30" class="d-box"/><text x="30" y="50" text-anchor="middle" class="d-mono d-small">3</text>
<rect x="45" y="30" width="30" height="30" class="d-box"/><text x="60" y="50" text-anchor="middle" class="d-mono d-small">1</text>
<rect x="75" y="30" width="30" height="30" class="d-box"/><text x="90" y="50" text-anchor="middle" class="d-mono d-small">4</text>
<rect x="105" y="30" width="30" height="30" class="d-box"/><text x="120" y="50" text-anchor="middle" class="d-mono d-small">1</text>
<rect x="135" y="30" width="30" height="30" class="d-box"/><text x="150" y="50" text-anchor="middle" class="d-mono d-small">5</text>
<rect x="165" y="30" width="30" height="30" class="d-box"/><text x="180" y="50" text-anchor="middle" class="d-mono d-small">9</text>
<rect x="195" y="30" width="30" height="30" class="d-box"/><text x="210" y="50" text-anchor="middle" class="d-mono d-small">2</text>
<rect x="225" y="30" width="30" height="30" class="d-box-accent"/><text x="240" y="50" text-anchor="middle" class="d-mono d-small d-bold">6</text>
<text x="15" y="90" class="d-small d-muted">7 comparisons, one per other element</text>
<text x="15" y="120" class="d-small d-muted">after</text>
<rect x="15" y="130" width="30" height="30" class="d-box-good"/><text x="30" y="150" text-anchor="middle" class="d-mono d-small">3</text>
<rect x="45" y="130" width="30" height="30" class="d-box-good"/><text x="60" y="150" text-anchor="middle" class="d-mono d-small">1</text>
<rect x="75" y="130" width="30" height="30" class="d-box-good"/><text x="90" y="150" text-anchor="middle" class="d-mono d-small">4</text>
<rect x="105" y="130" width="30" height="30" class="d-box-good"/><text x="120" y="150" text-anchor="middle" class="d-mono d-small">1</text>
<rect x="135" y="130" width="30" height="30" class="d-box-good"/><text x="150" y="150" text-anchor="middle" class="d-mono d-small">5</text>
<rect x="165" y="130" width="30" height="30" class="d-box-good"/><text x="180" y="150" text-anchor="middle" class="d-mono d-small">2</text>
<rect x="195" y="130" width="30" height="30" class="d-box-accent"/><text x="210" y="150" text-anchor="middle" class="d-mono d-small d-bold">6</text>
<rect x="225" y="130" width="30" height="30" class="d-box-bad"/><text x="240" y="150" text-anchor="middle" class="d-mono d-small">9</text>
<text x="15" y="184" class="d-small d-muted">≤6 on the left, 6 at its sorted index, &gt;6 on the right</text>
</svg>
<figcaption>Figure 2. One partition around pivot 6. The pivot lands exactly where it belongs in the final sorted array; the two sides still need sorting, but never need to be compared against each other again.</figcaption>
</figure>

```csharp run id=partition-demo
int[] items = [3, 1, 4, 1, 5, 9, 2, 6];
int pivotIndex = Partition(items, 0, items.Length - 1);
Console.WriteLine(string.Join(',', items));
Console.WriteLine($"pivot index: {pivotIndex}");

static int Partition(int[] a, int lo, int hi)
{
    int pivot = a[hi];
    int i = lo - 1;
    for (int j = lo; j < hi; j++)
    {
        if (a[j] <= pivot)
        {
            i++;
            (a[i], a[j]) = (a[j], a[i]);
        }
    }
    (a[i + 1], a[hi]) = (a[hi], a[i + 1]);
    return i + 1;
}
```

```text output
3,1,4,1,5,2,6,9
pivot index: 6
```

A partition of *m* elements does *m* − 1 comparisons. If the two sides it produces are always close to equal, that is the same halving pattern as merge sort and the total is Θ(*n* log *n*); Sedgewick and Wayne give [~2*n* ln *n* comparisons on average](https://algs4.cs.princeton.edu/23quicksort/) for randomly ordered distinct keys, more than merge sort's own range even at its upper end (2 ln *n* is about 1.39 log₂ *n*). Quicksort still tends to be faster in practice, because — unlike merge sort — it is [in-place, "uses only a small auxiliary stack"](https://algs4.cs.princeton.edu/23quicksort/), with no second array to copy into on every merge. But nothing stops the split from being as lopsided as possible: pick the last element as the pivot on an array that is *already sorted*, and every partition peels off exactly one element, giving the same 1 + 2 + ⋯ + (*n* − 1) shape as insertion sort's worst case.

```csharp run id=quicksort-cost
using System.Globalization;
CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;

const int Length = 1_000;
int[] sortedInput = new int[Length];
for (int i = 0; i < Length; i++) sortedInput[i] = i;

int[] naiveCopy = (int[])sortedInput.Clone();
int naiveComparisons = 0;
QuickSort(naiveCopy, 0, naiveCopy.Length - 1, ref naiveComparisons);

int[] shuffled = (int[])sortedInput.Clone();
Shuffle(shuffled, new Random(7));
int shuffledComparisons = 0;
QuickSort(shuffled, 0, shuffled.Length - 1, ref shuffledComparisons);

Console.WriteLine(
    $"already sorted:  {naiveComparisons,8:N0} comparisons");
Console.WriteLine(
    $"shuffled first:  {shuffledComparisons,8:N0} comparisons");

static void Shuffle(int[] a, Random random)
{
    for (int i = a.Length - 1; i > 0; i--)
    {
        int j = random.Next(i + 1);
        (a[i], a[j]) = (a[j], a[i]);
    }
}

static void QuickSort(int[] a, int lo, int hi, ref int comparisons)
{
    // Recurse into the smaller side, loop over the larger one,
    // so the call stack never grows past O(log n) even here.
    while (lo < hi)
    {
        int p = Partition(a, lo, hi, ref comparisons);
        if (p - lo < hi - p)
        {
            QuickSort(a, lo, p - 1, ref comparisons);
            lo = p + 1;
        }
        else
        {
            QuickSort(a, p + 1, hi, ref comparisons);
            hi = p - 1;
        }
    }
}

static int Partition(int[] a, int lo, int hi, ref int comparisons)
{
    int pivot = a[hi];
    int i = lo - 1;
    for (int j = lo; j < hi; j++)
    {
        comparisons++;
        if (a[j] <= pivot)
        {
            i++;
            (a[i], a[j]) = (a[j], a[i]);
        }
    }
    (a[i + 1], a[hi]) = (a[hi], a[i + 1]);
    return i + 1;
}
```

```text output
already sorted:   499,500 comparisons
shuffled first:    10,134 comparisons
```

Both runs use the identical pivot rule; only the input order changes. The already-sorted array hits exactly *n*(*n* − 1)/2 = 499,500 comparisons, matching the ~*n*²/2 worst case. Shuffling first — the fix Sedgewick and Wayne [recommend](https://algs4.cs.princeton.edu/23quicksort/), noting that a shuffled array making quicksort quadratic "is much less than the probability that your computer will be struck by lightning" — brings the same 1,000 numbers back down near the ~2*n* ln *n* average. (The comparison count for the shuffled run depends on the shuffle, so it is machine- and run-independent here only because the seed is fixed; a different seed gives a different number in the same range.) What actually goes wrong for large already-sorted or already-reverse-sorted input, and how the depth of a bad partition chain relates to a real stack overflow, is its own topic; a deeper case study of quicksort's three cases is planned for this site.

Quicksort partitions in place, so its extra space is the O(log *n*) recursion stack used above rather than a second array, and — because Lomuto's scheme can swap an element past an equal one without comparing the two equal elements directly — it does not preserve the order of equal keys. [The stability section](#which-of-these-keep-ties-in-their-original-order) checks this rather than asserting it.

::::exercise[Measure it: does the shuffle always help the same amount?]
Run the comparison-counting program above three more times with `new Random(1)`, `new Random(2)` and `new Random(3)` instead of `new Random(7)` for the shuffle (the `already sorted` row will not change). Are the shuffled counts close to each other, or wildly different? What does that tell you about relying on a single measurement?

:::solution
Three more seeds on this machine gave 10,490, 10,237 and 10,556 shuffled comparisons — all within about 4% of the `Random(7)` figure above (10,134) and all far below the 499,500 for the unshuffled array. Sedgewick and Wayne quantify this directly, for running time rather than comparisons specifically: "the standard deviation of the running time is about .65 *N*, so the running time tends to the average as *N* grows and is unlikely to be far from the average." One seed is enough to see the shape; it is not enough to claim a precise average.
:::
::::

## Heap sort: quicksort's guarantee, built into the algorithm

A binary [heap](/glossary/#heap) stores a tree in an array: for any index `i`, its children live at `2·i + 1` and `2·i + 2`. Heap sort turns the whole array into a max-heap (every parent at least as big as its children) and then repeatedly swaps the root — the current maximum — with the last unsorted slot and restores the heap property on what remains.

```csharp run id=heap
int[] a = [3, 1, 4, 1, 5, 9, 2, 6];
int comparisons = 0;
HeapSort(a, ref comparisons);
Console.WriteLine(string.Join(',', a));
Console.WriteLine($"comparisons: {comparisons}");

static void HeapSort(int[] a, ref int comparisons)
{
    int n = a.Length;
    for (int i = n / 2 - 1; i >= 0; i--)
        SiftDown(a, i, n, ref comparisons);
    for (int end = n - 1; end > 0; end--)
    {
        (a[0], a[end]) = (a[end], a[0]);
        SiftDown(a, 0, end, ref comparisons);
    }
}

static void SiftDown(int[] a, int root, int size, ref int comparisons)
{
    while (true)
    {
        int left = 2 * root + 1, right = 2 * root + 2, largest = root;
        if (left < size)
        {
            comparisons++;
            if (a[left] > a[largest]) largest = left;
        }
        if (right < size)
        {
            comparisons++;
            if (a[right] > a[largest]) largest = right;
        }
        if (largest == root) return;
        (a[root], a[largest]) = (a[largest], a[root]);
        root = largest;
    }
}
```

```text output
1,1,2,3,4,5,6,9
comparisons: 25
```

Sedgewick and Wayne [give heap sort's bound](https://algs4.cs.princeton.edu/24pq/) as fewer than 2*n* lg *n* compares and exchanges to sort *n* items, and that bound holds in the worst case, not just on average — there is no input that makes heap sort quadratic. It sorts in place: the heap lives inside the same array being sorted, so extra space is O(1), the best of any algorithm on this page with a guaranteed Θ(*n* log *n*) worst case. The first loop, building the initial heap, looks like it should cost O(*n* log *n*) on its own (*n* calls to a function that walks O(log *n*) levels), but a tighter accounting (CLRS, chapter 6) shows it is actually O(*n*) — most nodes are near the bottom of the tree and sift down only a level or two. A full binary-heap implementation with `Peek`/`Push`/`Pop`, and that O(*n*) argument in detail, is planned as its own article on this site. Heap sort does not preserve the order of equal keys either: a sift-down step can swap a large value past an equal one several levels down without ever comparing the two directly.

## Which of these keep ties in their original order?

A sort is **stable** if, for two elements with equal keys, the one that came first in the input still comes first in the output. The .NET documentation for `List<T>.Sort` [states the definition](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.list-1.sort) the same way: "if two elements are equal, their order might not be preserved. In contrast, a stable sort preserves the order of elements that are equal." Stability matters whenever "equal" does not mean "identical": sort support tickets by priority and you still want same-priority tickets handled in the order they arrived, not shuffled.

The program below sorts eight `(Priority, Id)` tickets — `Id` records arrival order — using every hand-rolled algorithm on this page, comparing by `Priority` alone, and checks whether same-priority tickets keep their `Id` order.

```csharp run id=stability
Report("insertion", InsertionSort);
Report("selection", SelectionSort);
Report("merge", MergeSort);
Report("quicksort", QuickSort);
Report("heap sort", HeapSort);

static void Report(string name, Action<(int Priority, int Id)[]> sort)
{
    (int Priority, int Id)[] tickets =
    [
        (2, 1), (1, 2), (2, 3), (3, 4),
        (1, 5), (2, 6), (3, 7), (1, 8),
    ];
    sort(tickets);
    string ids = string.Join(',', tickets.Select(t => t.Id));
    Console.WriteLine($"{name,-11}{(IsStable(tickets) ? "yes" : "no"),8}  {ids}");
}

static bool IsStable((int Priority, int Id)[] t)
{
    for (int i = 1; i < t.Length; i++)
        if (t[i - 1].Priority == t[i].Priority && t[i - 1].Id > t[i].Id)
            return false;
    return true;
}

static void InsertionSort((int Priority, int Id)[] a)
{
    for (int i = 1; i < a.Length; i++)
    {
        var value = a[i];
        int j = i - 1;
        while (j >= 0 && a[j].Priority > value.Priority)
        {
            a[j + 1] = a[j];
            j--;
        }
        a[j + 1] = value;
    }
}

static void SelectionSort((int Priority, int Id)[] a)
{
    for (int i = 0; i < a.Length - 1; i++)
    {
        int min = i;
        for (int j = i + 1; j < a.Length; j++)
            if (a[j].Priority < a[min].Priority) min = j;
        (a[i], a[min]) = (a[min], a[i]);
    }
}

static void MergeSort((int Priority, int Id)[] a)
{
    if (a.Length < 2) return;
    var buffer = new (int Priority, int Id)[a.Length];
    MergeSplit(a, buffer, 0, a.Length);
}

static void MergeSplit(
    (int Priority, int Id)[] items,
    (int Priority, int Id)[] buffer,
    int lo, int hi)
{
    if (hi - lo < 2) return;
    int mid = lo + (hi - lo) / 2;
    MergeSplit(items, buffer, lo, mid);
    MergeSplit(items, buffer, mid, hi);
    Array.Copy(items, lo, buffer, lo, hi - lo);
    int left = lo, right = mid;
    for (int k = lo; k < hi; k++)
    {
        bool takeLeft = right >= hi ||
            (left < mid && buffer[left].Priority <= buffer[right].Priority);
        items[k] = takeLeft ? buffer[left++] : buffer[right++];
    }
}

static void QuickSort((int Priority, int Id)[] a) =>
    QuickSortRange(a, 0, a.Length - 1);

static void QuickSortRange((int Priority, int Id)[] a, int lo, int hi)
{
    if (lo >= hi) return;
    var pivot = a[hi];
    int i = lo - 1;
    for (int j = lo; j < hi; j++)
    {
        if (a[j].Priority <= pivot.Priority)
        {
            i++;
            (a[i], a[j]) = (a[j], a[i]);
        }
    }
    (a[i + 1], a[hi]) = (a[hi], a[i + 1]);
    QuickSortRange(a, lo, i);
    QuickSortRange(a, i + 2, hi);
}

static void HeapSort((int Priority, int Id)[] a)
{
    int n = a.Length;
    for (int i = n / 2 - 1; i >= 0; i--) SiftDown(a, i, n);
    for (int end = n - 1; end > 0; end--)
    {
        (a[0], a[end]) = (a[end], a[0]);
        SiftDown(a, 0, end);
    }
}

static void SiftDown((int Priority, int Id)[] a, int root, int size)
{
    while (true)
    {
        int left = 2 * root + 1, right = 2 * root + 2, largest = root;
        if (left < size && a[left].Priority > a[largest].Priority) largest = left;
        if (right < size && a[right].Priority > a[largest].Priority) largest = right;
        if (largest == root) return;
        (a[root], a[largest]) = (a[largest], a[root]);
        root = largest;
    }
}

```

```text output
insertion       yes  2,5,8,1,3,6,4,7
selection        no  2,5,8,1,6,3,7,4
merge           yes  2,5,8,1,3,6,4,7
quicksort        no  2,5,8,1,6,3,7,4
heap sort        no  8,5,2,6,1,3,7,4
```

The stable rows (insertion, merge) both print the same `2,5,8,1,3,6,4,7`: the priority-1 tickets stay in arrival order (2, 5, 8), then priority 2 (1, 3, 6), then priority 3 (4, 7). Every unstable row reaches the correct *priorities* but scrambles the *ids* inside each group. The section on `Array.Sort` further down runs this same check against it and against `OrderBy`.

Stability is a property of an *implementation*, not something forced by the abstract problem: any unstable sort can be made stable by carrying the original index along and using it to break ties, at the cost of extra comparisons or extra memory for that index.

::::exercise[Extend the code: a stable selection sort]
Selection sort above swaps the minimum into place, which is what breaks stability — a swap can jump an equal element backward past one that was ahead of it. Change `SelectionSort` above so that instead of swapping the minimum directly into position `i`, it *removes* the minimum and shifts everything between `i` and the minimum's old position one slot to the right (like a single step of insertion sort). Confirm with `IsStable` that the result is stable on the ticket array, and count how many element moves it costs compared to the original's *n* − 1 swaps.

:::solution
```csharp run
(int Priority, int Id)[] tickets =
[
    (2, 1), (1, 2), (2, 3), (3, 4),
    (1, 5), (2, 6), (3, 7), (1, 8),
];
int moves = StableSelectionSort(tickets);
Console.WriteLine(string.Join(',', tickets.Select(t => t.Id)));
Console.WriteLine($"stable: {IsStable(tickets)}");
Console.WriteLine($"moves: {moves}");

static int StableSelectionSort((int Priority, int Id)[] a)
{
    int moves = 0;
    for (int i = 0; i < a.Length - 1; i++)
    {
        int min = i;
        for (int j = i + 1; j < a.Length; j++)
            if (a[j].Priority < a[min].Priority) min = j;

        var value = a[min];
        for (int k = min; k > i; k--)
        {
            a[k] = a[k - 1];
            moves++;
        }
        a[i] = value;
    }
    return moves;
}

static bool IsStable((int Priority, int Id)[] t)
{
    for (int i = 1; i < t.Length; i++)
        if (t[i - 1].Priority == t[i].Priority && t[i - 1].Id > t[i].Id)
            return false;
    return true;
}
```

```text output
2,5,8,1,3,6,4,7
stable: True
moves: 10
```

The ids match the stable ordering from the table above, and `IsStable` confirms it. The fix costs 10 element moves instead of 7 swaps (a swap is usually implemented as 3 assignments, so this is not simply "worse" — it depends on what an "operation" is charged for), and the outer comparison count is unchanged: stability was never about how many comparisons selection sort makes, only about what it does with the answer.
:::
::::

## No comparison sort can beat *n* log *n* comparisons

Every algorithm above decides where an element goes only by comparing it with others — merge sort's `<=`, quicksort's `a[j] <= pivot`, heap sort's sift-down. CLRS calls this family **comparison sorts** (chapter 8) and proves a floor under all of them: no comparison sort can guarantee fewer than ⌈log₂(*n*!)⌉ comparisons in the worst case, for any *n*.

The argument treats an algorithm as a decision tree: each internal node is one comparison, each leaf is one possible output ordering. Figure 3 is the tree that this page's own `InsertionSort` (from the first section) walks to sort three elements at array positions `a0`, `a1`, `a2`.

<figure class="diagram">
<svg viewBox="0 0 360 300" role="img" aria-labelledby="tree-title tree-desc">
<title id="tree-title">The decision tree insertion sort walks to sort three elements</title>
<desc id="tree-desc">A tree with a root comparison a0 vs a1, two child comparisons, and six leaves, one per possible final order of the three elements. The path for the array 3, 1, 4 is highlighted: it goes right at the root then left, reaching the leaf for order a1, a0, a2 after two comparisons.</desc>
<path d="M173 34 L90 96" class="d-line"/>
<path d="M173 34 L255 96" class="d-accent" style="stroke-width:2.5"/>
<text x="150" y="60" text-anchor="end" class="d-small d-muted">≤</text>
<text x="210" y="60" class="d-small d-text-accent">&gt;</text>
<text x="173" y="24" text-anchor="middle" class="d-mono d-small d-bold">a0:a1</text>
<path d="M90 106 L35 164" class="d-line"/>
<path d="M90 106 L118 164" class="d-line"/>
<text x="173" y="130" text-anchor="middle" class="d-mono d-small">a1:a2</text>
<path d="M255 106 L200 164" class="d-accent" style="stroke-width:2.5"/>
<path d="M255 106 L283 164" class="d-line"/>
<text x="255" y="130" text-anchor="middle" class="d-mono d-small d-bold">a0:a2</text>
<rect x="20" y="166" width="30" height="26" class="d-box"/>
<text x="35" y="184" text-anchor="middle" class="d-mono d-small">012</text>
<path d="M118 166 L90 224" class="d-line"/>
<path d="M118 166 L145 224" class="d-line"/>
<text x="118" y="150" text-anchor="middle" class="d-mono d-small">a0:a2</text>
<rect x="185" y="166" width="30" height="26" class="d-box-accent"/>
<text x="200" y="184" text-anchor="middle" class="d-mono d-small d-bold">102</text>
<path d="M283 166 L255 224" class="d-line"/>
<path d="M283 166 L310 224" class="d-line"/>
<text x="283" y="150" text-anchor="middle" class="d-mono d-small">a1:a2</text>
<rect x="75" y="226" width="30" height="26" class="d-box"/>
<text x="90" y="244" text-anchor="middle" class="d-mono d-small">021</text>
<rect x="130" y="226" width="30" height="26" class="d-box"/>
<text x="145" y="244" text-anchor="middle" class="d-mono d-small">201</text>
<rect x="240" y="226" width="30" height="26" class="d-box"/>
<text x="255" y="244" text-anchor="middle" class="d-mono d-small">120</text>
<rect x="295" y="226" width="30" height="26" class="d-box"/>
<text x="310" y="244" text-anchor="middle" class="d-mono d-small">210</text>
<text x="15" y="270" class="d-small d-muted">Leaf digits = original positions, left to right in the sorted result.</text>
<text x="15" y="286" class="d-small d-muted">Accent path: array [3,1,4] reaches "102" in 2 comparisons.</text>
</svg>
<figcaption>Figure 3. Six leaves for the 3! = 6 possible orderings, height 3. No binary tree with only 6 leaves can be shorter than ⌈log₂ 6⌉ = 3 levels, so no comparison sort can guarantee sorting three elements in fewer than 3 comparisons in the worst case.</figcaption>
</figure>

A correct sort must reach a different leaf for every one of the *n*! possible input orderings — if two different orderings ended at the same leaf, the algorithm would give one of them the wrong answer. A binary tree with *n*! leaves needs height at least log₂(*n*!), because a tree of height *h* has at most 2<sup>*h*</sup> leaves. Rounding up (a comparison count is an integer) gives the ⌈log₂(*n*!)⌉ floor, and Stirling's approximation shows this grows as Θ(*n* log *n*) — the same class merge sort and heap sort already hit. [Binary search](/algorithms/binary-search/) on this site's algorithms pillar reaches the analogous O(log *n*) class for a different problem (finding one value in an already-sorted array), by a different argument: it halves the size of a search interval every probe, rather than counting a decision tree's leaves.

The bound is about the *worst* input, not every input — merge sort's 15 comparisons for the specific array on this page is below the *n* = 8 floor of 16 only because that array is not the hardest one merge sort can face. The program below checks all 8! = 40,320 orderings of eight distinct values directly.

```csharp run id=lower-bound
int[] baseArray = [1, 2, 3, 4, 5, 6, 7, 8];
var counts = new List<int>();
Permute(baseArray, 0, counts);

Console.WriteLine($"permutations checked: {counts.Count}");
Console.WriteLine($"min comparisons: {counts.Min()}");
Console.WriteLine($"max comparisons: {counts.Max()}");
Console.WriteLine($"average: {counts.Average():F1}");
Console.WriteLine($"lower bound, n=8: {LowerBound(8)}");

static void Permute(int[] a, int k, List<int> counts)
{
    if (k == a.Length)
    {
        int[] copy = (int[])a.Clone();
        int[] buffer = new int[copy.Length];
        int comparisons = 0;
        MergeSortCounted(copy, buffer, 0, copy.Length, ref comparisons);
        counts.Add(comparisons);
        return;
    }
    for (int i = k; i < a.Length; i++)
    {
        (a[k], a[i]) = (a[i], a[k]);
        Permute(a, k + 1, counts);
        (a[k], a[i]) = (a[i], a[k]);
    }
}

static void MergeSortCounted(
    int[] items, int[] buffer, int lo, int hi, ref int comparisons)
{
    if (hi - lo < 2) return;
    int mid = lo + (hi - lo) / 2;
    MergeSortCounted(items, buffer, lo, mid, ref comparisons);
    MergeSortCounted(items, buffer, mid, hi, ref comparisons);
    Array.Copy(items, lo, buffer, lo, hi - lo);
    int left = lo, right = mid;
    for (int k = lo; k < hi; k++)
    {
        bool takeLeft;
        if (right >= hi) takeLeft = true;
        else if (left >= mid) takeLeft = false;
        else
        {
            comparisons++;
            takeLeft = buffer[left] <= buffer[right];
        }
        items[k] = takeLeft ? buffer[left++] : buffer[right++];
    }
}

static int LowerBound(int n)
{
    double logFactorial = 0;
    for (int k = 2; k <= n; k++) logFactorial += Math.Log2(k);
    return (int)Math.Ceiling(logFactorial);
}
```

```text output
permutations checked: 40320
min comparisons: [...]
max comparisons: [...]
average: [...]
lower bound, n=8: 16
```

Every one of the 40,320 orderings is a real input this merge sort could be handed, so the maximum observed is this implementation's true worst case for *n* = 8, not an estimate. It sits inside the [12, 24] range from Sedgewick and Wayne, and the worst case is bounded below by the 16 the decision-tree argument requires of *any* comparison sort — which no measurement of a single implementation could show on its own, only the proof does.

::::exercise[Prove it: the bound for five and six elements]
Without running any code, compute ⌈log₂(5!)⌉ and ⌈log₂(6!)⌉. Then check both with `LowerBound` from the program above.

:::solution
5! = 120. log₂ 120 is between log₂ 64 = 6 and log₂ 128 = 7, closer to 7: log₂ 120 ≈ 6.907, so ⌈log₂ 120⌉ = 7.

6! = 720. log₂ 720 is between log₂ 512 = 9 and log₂ 1024 = 10: log₂ 720 ≈ 9.492, so ⌈log₂ 720⌉ = 10.

```csharp run
static int LowerBound(int n)
{
    double logFactorial = 0;
    for (int k = 2; k <= n; k++) logFactorial += Math.Log2(k);
    return (int)Math.Ceiling(logFactorial);
}

Console.WriteLine(LowerBound(5));
Console.WriteLine(LowerBound(6));
```

```text output
7
10
```
:::
::::

## What Array.Sort and List&lt;T&gt;.Sort actually run

None of the five algorithms above is what runs when C# code calls `Array.Sort` or `List<T>.Sort`. Both use **introsort** — introspective sort — which starts as quicksort and switches strategy when quicksort's own weaknesses would show up.

:::dotnet
[The documented behavior of `Array.Sort`](https://learn.microsoft.com/en-us/dotnet/api/system.array.sort) is:

- "If the partition size is less than or equal to 16 elements, it uses an insertion sort algorithm."
- "If the number of partitions exceeds 2 \* Log *N*, where *N* is the range of the input array, it uses a Heapsort algorithm."
- "Otherwise, it uses a Quicksort algorithm."

[`ArraySortHelper.cs`](https://github.com/dotnet/runtime/blob/main/src/libraries/System.Private.CoreLib/src/System/Collections/Generic/ArraySortHelper.cs) computes that heapsort trigger as a fixed recursion-depth budget, `2 * (BitOperations.Log2((uint)keys.Length) + 1)`, decremented once per partition; hitting zero switches the *current* partition to heapsort rather than recursing further. [`Array.cs`](https://github.com/dotnet/runtime/blob/main/src/libraries/System.Private.CoreLib/src/System/Array.cs) fixes the 16-element cutoff as `IntrosortSizeThreshold`, with a comment that "empirically, 16 seems to speed up most cases without slowing down others, at least for integers." The quicksort step itself picks its pivot as the median of the partition's first, middle and last elements: the source sorts those three positions into order and then uses the middle one, with a comment reading "compute median-of-three. But also partition them, since we've done the comparison."
:::

Every piece matches something on this page: the 16-element cutoff hands small partitions to insertion sort exactly because — as the earlier section on [big-O's hidden constants](/complexity/big-o-notation/#when-the-dropped-constant-decides-the-winner) measures directly — insertion sort's simpler inner loop wins at small sizes despite its worse Big-O; median-of-three is a cheaper, deterministic alternative to this page's random shuffle, and it already defeats the plain already-sorted case above on its own, since the middle of a sorted range is its true median; and the recursion-depth budget is the backstop for inputs adversarial enough to beat median-of-three too, handing that partition to heap sort instead of letting quicksort's rare quadratic case run. The result is an algorithm with quicksort's typical speed and heap sort's worst-case guarantee, and [the documentation states the combined cost](https://learn.microsoft.com/en-us/dotnet/api/system.array.sort) as "an O(*n* log *n*) operation" outright, not just "usually."

What introsort does *not* inherit from any of the three is stability. The eight-ticket array from the stability section is small enough that `Array.Sort` would handle it with the insertion-sort fallback alone, which is stable — too small a case to show the real answer. Twenty tickets clear the 16-element cutoff, so `Array.Sort` actually reaches its quicksort and heapsort code paths:

```csharp run
(int Priority, int Id)[] MakeTickets()
{
    var random = new Random(5);
    var tickets = new (int Priority, int Id)[20];
    for (int id = 1; id <= 20; id++)
        tickets[id - 1] = (random.Next(1, 6), id);
    return tickets;
}

var forArraySort = MakeTickets();
Array.Sort(forArraySort, (x, y) => x.Priority.CompareTo(y.Priority));
Console.WriteLine($"Array.Sort stable: {IsStable(forArraySort)}");

var forOrderBy = MakeTickets();
var ordered = forOrderBy.OrderBy(t => t.Priority).ToArray();
Console.WriteLine($"OrderBy stable:    {IsStable(ordered)}");

static bool IsStable((int Priority, int Id)[] t)
{
    for (int i = 1; i < t.Length; i++)
        if (t[i - 1].Priority == t[i].Priority && t[i - 1].Id > t[i].Id)
            return false;
    return true;
}
```

```text output
Array.Sort stable: False
OrderBy stable:    True
```

That matches [the `List<T>.Sort` documentation](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.list-1.sort) directly: "this implementation performs an unstable sort." `Enumerable.OrderBy` does not use introsort or share this limitation; [its documentation states](https://learn.microsoft.com/en-us/dotnet/api/system.linq.enumerable.orderby) "this method performs a stable sort" without naming an algorithm. Since `OrderBy` is still a comparison sort, the Ω(*n* log *n*) floor proved above applies to it too, so O(*n* log *n*) is the reasonable expectation even without a documented figure to cite.

::::exercise[Measure it: how close does Array.Sort get to 2n ln n?]
`Array.Sort` accepts an `IComparer<T>`. Write one whose `Compare` method increments a counter before delegating to `CompareTo`, pass it to `Array.Sort`, and measure the real comparison count on random arrays of 100, 1,000 and 10,000 `int`s. Compare against Sedgewick and Wayne's ~2*n* ln *n* quicksort average from earlier in this article.

:::solution
```csharp run
int[] sizes = [100, 1_000, 10_000];
Console.WriteLine($"{"n",7}{"actual",10}{"~2n ln n",11}");
foreach (int n in sizes)
{
    var random = new Random(11);
    int[] data = new int[n];
    for (int i = 0; i < n; i++) data[i] = random.Next();

    int comparisons = 0;
    var counting = Comparer<int>.Create((x, y) =>
    {
        comparisons++;
        return x.CompareTo(y);
    });
    Array.Sort(data, counting);

    int predicted = (int)(2 * n * Math.Log(n));
    Console.WriteLine($"{n,7}{comparisons,10}{predicted,11}");
}
```

```text output
      n    actual   ~2n ln n
    100       631        921
   1000     10202      13815
  10000    146439     184206
```

`Array.Sort` beats the plain-quicksort prediction by 20 to 30 percent at every size, not just approaches it — consistent with median-of-three picking a better pivot than a random element would, and with the insertion-sort fallback finishing small partitions in fewer comparisons than one more level of partitioning would cost. The gap narrows as *n* grows (31%, then 26%, then 21%), since a fixed advantage from a handful of better pivot choices matters less as the total comparison count grows.
:::
::::

## Choosing a sort

| Algorithm | Worst case | Extra space | Stable | Best for |
|---|---|---|---|---|
| Insertion sort | Θ(n²) | O(1) | Yes | Small or nearly-sorted input |
| Selection sort | Θ(n²) | O(1) | No | Rarely — minimizes swaps, not comparisons |
| Merge sort | Θ(n log n) | Θ(n) | Yes | Guaranteed time and stability matter more than memory |
| Quicksort | Θ(n²), rare with a good pivot | O(log n) | No | Typical case speed, memory is tight |
| Heap sort | Θ(n log n) | O(1) | No | Guaranteed time *and* O(1) memory |
| `Array.Sort` / `List<T>.Sort` | Θ(n log n) | O(log n) | No | Default choice with no stability requirement |
| `Enumerable.OrderBy` | Θ(n log n)\* | Θ(n) | Yes | Stability matters, or chaining `ThenBy` |

\* Not documented as a specific bound; it follows from `OrderBy` being a comparison sort, per the previous section.

Four questions narrow the table to one row. **Does the order of equal keys matter?** If yes, that rules out selection sort, quicksort, heap sort and `Array.Sort` — reach for merge sort, `OrderBy`, or `Array.Sort` with a comparer that falls back to comparing original position when the primary keys tie. **Is the input already close to sorted, or small?** Insertion sort wins there specifically, which is exactly why introsort switches to it under 16 elements rather than trusting quicksort's general-case speed on a case it is not needed for. **Does a single slow call matter (a real-time system, a deadline), or only the average?** That is heap sort or introsort (which absorbs heap sort as its fallback) over plain quicksort, whose worst case is real even if rare. **Otherwise:** `Array.Sort` or `List<T>.Sort` already combine three of the algorithms on this page — insertion sort for small partitions, quicksort with a chosen pivot for the common case, heap sort as the guarantee — so writing a general-purpose sort by hand only pays off when one of the first three questions demands a property introsort does not have.
