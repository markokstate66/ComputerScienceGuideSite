---
title: "Arrays and List<T>: Contiguous Memory and Why It Wins"
description: "See how C# arrays and List<T> sit in memory, measure row- against column-order traversal, and learn what Insert, RemoveAt, Span<T> and jagged arrays cost."
pillar: data-structures
order: 1
author: markus
published: 2026-09-18
updated: 2026-09-21
level: intermediate
tags: [arrays, list-t, dynamic-array, cache-locality, span]
prerequisites: ["complexity/big-o-notation"]
sources:
  - title: "The array reference type (C# reference)"
    url: "https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/arrays"
    publisher: "Microsoft Learn"
    accessed: 2026-09-18
  - title: "ECMA-335, Common Language Infrastructure, 6th ed., Partition I, section 8.9.1 (Array types)"
    url: "https://ecma-international.org/wp-content/uploads/ECMA-335_6th_edition_june_2012.pdf"
    publisher: "Ecma International"
    accessed: 2026-09-18
  - title: "What every programmer should know about memory, part 2: CPU caches"
    url: "https://lwn.net/Articles/252125/"
    publisher: "Ulrich Drepper, published by LWN.net"
    accessed: 2026-09-18
  - title: "List.cs (System.Private.CoreLib), dotnet/runtime main branch"
    url: "https://github.com/dotnet/runtime/blob/main/src/libraries/System.Private.CoreLib/src/System/Collections/Generic/List.cs"
    publisher: "GitHub, dotnet/runtime"
    accessed: 2026-09-18
  - title: "List<T>.Insert(Int32, T) Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.list-1.insert"
    publisher: "Microsoft Learn"
    accessed: 2026-09-18
  - title: "List<T>.RemoveAt(Int32) Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.list-1.removeat"
    publisher: "Microsoft Learn"
    accessed: 2026-09-18
  - title: "List<T>.RemoveAll(Predicate<T>) Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.list-1.removeall"
    publisher: "Microsoft Learn"
    accessed: 2026-09-18
  - title: "Span<T> Struct"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.span-1"
    publisher: "Microsoft Learn"
    accessed: 2026-09-18
  - title: "ArraySegment<T> Struct"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.arraysegment-1"
    publisher: "Microsoft Learn"
    accessed: 2026-09-18
  - title: "CollectionsMarshal.AsSpan<T>(List<T>) Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.runtime.interopservices.collectionsmarshal.asspan"
    publisher: "Microsoft Learn"
    accessed: 2026-09-18
  - title: "ReadOnlySpan.cs (System.Private.CoreLib), dotnet/runtime main branch"
    url: "https://github.com/dotnet/runtime/blob/main/src/libraries/System.Private.CoreLib/src/System/ReadOnlySpan.cs"
    publisher: "GitHub, dotnet/runtime"
    accessed: 2026-09-21
  - title: "Array.GetLowerBound(Int32) Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.array.getlowerbound"
    publisher: "Microsoft Learn"
    accessed: 2026-09-21
draft: true
---

Two loops add up the same 16 million integers. They execute the same number of additions, and any [Big-O](/complexity/big-o-notation/) analysis calls them identical: Θ(*n*) for *n* elements. On the machine used for this page one of them takes six times as long as the other, and with an unlucky grid size, eighteen times. The only difference is the order in which they visit the elements. Explaining that gap takes in everything that matters about an [array](/glossary/#array): how it is laid out in memory, how an index becomes an address, and why a `List<T>`, which is an array with a counter on top, inherits both the speed and the costs.

## Same sum, two loop orders

The program builds a square grid of `int` values at six sizes and sums each grid twice. `SumRowFirst` moves along a row before going to the next row. `SumColumnFirst` runs down a column before going to the next column. Each sum is repeated and the best time is reported as nanoseconds per element, so that grids of different sizes can be compared.

All measurements on this page come from .NET 10 (runtime 10.0.10) on Windows 11, on an 8-core x64 desktop processor that reports 16 MB of last-level cache. The first line of the program turns on compiler optimizations. Without it, `dotnet run` on a single file produced unoptimized code here, and every timing on this page was noticeably slower and noisier, which is why the property is on in every measured program below.

<details>
<summary>Full program: the traversal timing harness</summary>

```csharp run id=traversal
#:property Optimize=true
using System.Diagnostics;
using System.Globalization;

CultureInfo.CurrentCulture =
    CultureInfo.InvariantCulture;

int[] sizes =
    [100, 500, 1000, 2000, 4000, 4096];
Console.WriteLine(
    "size    row     col  ratio");
foreach (int n in sizes)
{
    var grid = new int[n, n];
    for (int r = 0; r < n; r++)
        for (int c = 0; c < n; c++)
            grid[r, c] = (r + c) & 7;

    double row = NsPerElement(
        grid, SumRowFirst);
    double col = NsPerElement(
        grid, SumColumnFirst);
    Console.WriteLine(
        $"{n,4} {row,7:F2} {col,7:F2}" +
        $" {col / row,6:F1}");
}

static double NsPerElement(
    int[,] grid, Func<int[,], long> sum)
{
    int reps = Math.Max(
        5, 20_000_000 / grid.Length);
    sum(grid); // warm-up: JIT-compiles it
    double best = double.MaxValue;
    for (int run = 0; run < 5; run++)
    {
        long start =
            Stopwatch.GetTimestamp();
        for (int i = 0; i < reps; i++)
            sum(grid);
        double ns = Stopwatch
            .GetElapsedTime(start)
            .TotalNanoseconds;
        best = Math.Min(
            best, ns / reps / grid.Length);
    }
    return best;
}

static long SumRowFirst(int[,] g)
{
    int rows = g.GetLength(0);
    int cols = g.GetLength(1);
    long sum = 0;
    for (int r = 0; r < rows; r++)
        for (int c = 0; c < cols; c++)
            sum += g[r, c];
    return sum;
}

static long SumColumnFirst(int[,] g)
{
    int rows = g.GetLength(0);
    int cols = g.GetLength(1);
    long sum = 0;
    for (int c = 0; c < cols; c++)
        for (int r = 0; r < rows; r++)
            sum += g[r, c];
    return sum;
}
```

```text output
size    row     col  ratio
 100 [...] [...] [...]
 500 [...] [...] [...]
1000 [...] [...] [...]
2000 [...] [...] [...]
4000 [...] [...] [...]
4096 [...] [...] [...]
```

</details>

The two functions inside it that actually differ are the loop nesting around the same read:

```csharp snippet of=traversal
static long SumRowFirst(int[,] g)
{
    int rows = g.GetLength(0);
    int cols = g.GetLength(1);
    long sum = 0;
    for (int r = 0; r < rows; r++)
        for (int c = 0; c < cols; c++)
            sum += g[r, c];
    return sum;
}

static long SumColumnFirst(int[,] g)
{
    int rows = g.GetLength(0);
    int cols = g.GetLength(1);
    long sum = 0;
    for (int c = 0; c < cols; c++)
        for (int r = 0; r < rows; r++)
            sum += g[r, c];
    return sum;
}
```

Everything else in the program above is instrumentation: building six grids, warming the JIT up with one throwaway call per size, and keeping the best of five timed repetitions so one slow run does not skew the result.

The timings differ on every run and every machine, so the output panel above shows only the shape. These are the numbers from one run here, with the size of each grid added; a second run agreed to within about 15 percent in every cell.

| Size | Ratio | Grid MB | Row ns | Col ns |
|---:|---:|---:|---:|---:|
| 100 | 1.0 | 0.04 | 1.16 | 1.20 |
| 500 | 1.0 | 1.0 | 0.73 | 0.76 |
| 1000 | 1.1 | 3.8 | 0.75 | 0.82 |
| 2000 | 3.4 | 15.3 | 0.84 | 2.89 |
| 4000 | 6.0 | 61.0 | 0.87 | 5.17 |
| 4096 | 17.8 | 64.0 | 0.89 | 15.82 |

Row-first costs about the same per element at every size. Column-first matches it while the grid is small, then falls behind once the grid reaches tens of megabytes. And 4096 is three times worse than 4000, although the grid is only 5 percent larger. None of this is visible in the C# source; it comes from where the elements are in memory.

## One block of memory, and the arithmetic that finds an element

An array is a single block of memory holding its elements side by side, all the same size, with nothing between them. The [C# reference](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/arrays) adds the two properties that everything else follows from: the length of each dimension is fixed when the array instance is created and cannot change for the lifetime of the instance, and elements are indexed from 0 to *n* − 1.

Because every element has the same size, the address of element `i` does not have to be looked up. It is computed:

```text
address of a[i] = address of a[0]
                + i × element size
```

One multiplication and one addition, whatever the value of `i` and however long the array is. That is the whole reason indexing an array is O(1) in the worst case. It is also why 0-based indexing keeps the formula simplest: the index is already the distance, in elements, from the first one, with nothing to subtract.

<figure class="diagram">
<svg viewBox="0 0 360 232" role="img" aria-labelledby="layout-title layout-desc">
<title id="layout-title">An int array in memory: a reference, a header, and six elements four bytes apart</title>
<desc id="layout-desc">The variable scores holds a reference that points at one block. The block starts with a header that stores the length, 6, followed by six four-byte elements holding 70, 85, 92, 64, 78 and 88. Under the elements are their indices 0 to 5 and their byte offsets 0, 4, 8, 12, 16 and 20. Element 3 is highlighted at offset 12.</desc>
<defs>
<marker id="layout-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-stroke"/></marker>
</defs>
<rect x="20" y="12" width="84" height="32" rx="6" class="d-box-2"/>
<text x="62" y="33" text-anchor="middle" class="d-mono">scores</text>
<text x="114" y="33" class="d-muted d-small">a reference: where the block is</text>
<path d="M62 44 V80" class="d-line" marker-end="url(#layout-arrow)"/>
<rect x="20" y="84" width="68" height="44" class="d-box-2"/>
<text x="54" y="103" text-anchor="middle" class="d-small d-muted">header</text>
<text x="54" y="119" text-anchor="middle" class="d-small d-muted">Length 6</text>
<rect x="88" y="84" width="42" height="44" class="d-box"/><text x="109" y="111" text-anchor="middle" class="d-mono">70</text>
<rect x="130" y="84" width="42" height="44" class="d-box"/><text x="151" y="111" text-anchor="middle" class="d-mono">85</text>
<rect x="172" y="84" width="42" height="44" class="d-box"/><text x="193" y="111" text-anchor="middle" class="d-mono">92</text>
<rect x="214" y="84" width="42" height="44" class="d-box-accent"/><text x="235" y="111" text-anchor="middle" class="d-mono d-bold">64</text>
<rect x="256" y="84" width="42" height="44" class="d-box"/><text x="277" y="111" text-anchor="middle" class="d-mono">78</text>
<rect x="298" y="84" width="42" height="44" class="d-box"/><text x="319" y="111" text-anchor="middle" class="d-mono">88</text>
<text x="109" y="146" text-anchor="middle" class="d-mono d-small">[0]</text>
<text x="151" y="146" text-anchor="middle" class="d-mono d-small">[1]</text>
<text x="193" y="146" text-anchor="middle" class="d-mono d-small">[2]</text>
<text x="235" y="146" text-anchor="middle" class="d-mono d-small d-text-accent">[3]</text>
<text x="277" y="146" text-anchor="middle" class="d-mono d-small">[4]</text>
<text x="319" y="146" text-anchor="middle" class="d-mono d-small">[5]</text>
<text x="109" y="164" text-anchor="middle" class="d-mono d-small d-muted">+0</text>
<text x="151" y="164" text-anchor="middle" class="d-mono d-small d-muted">+4</text>
<text x="193" y="164" text-anchor="middle" class="d-mono d-small d-muted">+8</text>
<text x="235" y="164" text-anchor="middle" class="d-mono d-small d-text-accent">+12</text>
<text x="277" y="164" text-anchor="middle" class="d-mono d-small d-muted">+16</text>
<text x="319" y="164" text-anchor="middle" class="d-mono d-small d-muted">+20</text>
<text x="20" y="194" class="d-small d-text-accent">scores[3] is 3 × 4 = 12 bytes past scores[0]</text>
<text x="20" y="214" class="d-small d-muted">Offsets are in bytes; an int occupies 4</text>
</svg>
<figcaption>Figure 1. An <code>int[]</code> of six elements is one object: a header that records the length, then the elements with no gaps. The offset of an element is its index times the element size, so reaching element 3 takes the same work as reaching element 3 million.</figcaption>
</figure>

You can observe these distances from safe code. `Unsafe.ByteOffset` reports how many bytes separate two references; despite the class name it only measures, and the program needs no `unsafe` block.

```csharp run id=offsets
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;

Console.WriteLine(
    "bytes from [0] to:   [1]  [3]");
Show("int[]", new int[8]);
Show("long[]", new long[8]);
Show("Sample[]", new Sample[8]);
Show("string[]", new string[8]);

var grid = new int[3, 5];
Console.WriteLine(
    "int[3,5], bytes from [0,0] to:");
long g01 = Gap(
    ref grid[0, 0], ref grid[0, 1]);
long g10 = Gap(
    ref grid[0, 0], ref grid[1, 0]);
long g23 = Gap(
    ref grid[0, 0], ref grid[2, 3]);
Console.WriteLine(
    $"  [0,1] {g01}  [1,0] {g10}" +
    $"  [2,3] {g23}");

// View the same 15 slots as one flat run of ints.
Span<int> flat = MemoryMarshal.CreateSpan(
    ref grid[0, 0], grid.Length);
for (int i = 0; i < flat.Length; i++)
    flat[i] = i;
Console.WriteLine($"grid[2,3] holds {grid[2, 3]}");

static long Gap<T>(ref T from, ref T to) =>
    (long)Unsafe.ByteOffset(ref from, ref to);

static void Show<T>(string type, T[] a)
{
    long one = Gap(ref a[0], ref a[1]);
    long three = Gap(ref a[0], ref a[3]);
    Console.WriteLine($"{type,-20}{one,4}{three,5}");
}

record struct Sample(
    double Celsius, int Station, bool Valid);
```

```text output
bytes from [0] to:   [1]  [3]
int[]                  4   12
long[]                 8   24
Sample[]              16   48
string[]               8   24
int[3,5], bytes from [0,0] to:
  [0,1] 4  [1,0] 20  [2,3] 52
grid[2,3] holds 13
```

- **`int[]` and `long[]`** step by 4 and 8 bytes, the sizes of the element types.
- **`Sample[]`** steps by 16, although its fields add up to 8 + 4 + 1 = 13 bytes. The runtime pads the [value type](/glossary/#value-type) so that the `double` in every element stays aligned. The structs themselves are in the array, side by side. The padding is a choice of this runtime on x64, not a rule of the language.
- **`string[]`** steps by 8 whatever the length of the strings, because a string is a [reference type](/glossary/#reference-type). The array holds eight-byte references on this 64-bit runtime; the characters are in separate objects elsewhere on the heap. The references are contiguous. The things they refer to need not be.
- **`int[3,5]`** is one block as well. Moving one column to the right moves 4 bytes; moving one row down moves 20 bytes, which is a whole row of five. Element `[2,3]` is 52 bytes in, which is (2 × 5 + 3) × 4.

That last formula is row-major order: rows are stored one after another, so the rightmost index is the one that moves through adjacent memory. For .NET this is a requirement of the runtime standard, not an accident of the implementation. [ECMA-335](https://ecma-international.org/wp-content/uploads/ECMA-335_6th_edition_june_2012.pdf), Partition I, section 8.9.1, says array elements "shall be laid out within the array object in row-major order". For a rectangular array with `cols` columns:

```text
slot of [r, c]  = r × cols + c
bytes to [r, c] = slot × element size
```

The last three lines of the program confirm it from the other direction: written through a flat 15-element view, the value 13 lands in `grid[2,3]`.

::::exercise[Work out an offset by hand]
A `long[6, 10]` holds six rows of ten 64-bit integers. How many bytes separate element `[0,0]` from element `[4,7]`? From `[4,7]`, how far away are its neighbors `[4,8]` and `[5,7]`? Work it out from the formula, then check with a program.

:::solution
`[4,7]` is slot 4 × 10 + 7 = 47, and each slot is 8 bytes, so the offset is 376 bytes. `[4,8]` is the next slot, 8 bytes further. `[5,7]` is a full row of ten slots further: 80 bytes.

```csharp run id=ex-offset
using System.Runtime.CompilerServices;

var table = new long[6, 10];
Console.WriteLine(
    Gap(ref table[0, 0], ref table[4, 7]));
Console.WriteLine(
    Gap(ref table[4, 7], ref table[4, 8]));
Console.WriteLine(
    Gap(ref table[4, 7], ref table[5, 7]));

static long Gap<T>(ref T from, ref T to) =>
    (long)Unsafe.ByteOffset(ref from, ref to);
```

```text output
376
8
80
```

Hold on to the 8 against the 80. In the traversal experiment the same two distances were 4 bytes and 16,000 bytes.
:::
::::

## Why the column-first loop falls off a cliff

Now the two loops can be described by their memory access pattern instead of their source code. On the 4000 × 4000 grid, `SumRowFirst` reads addresses that rise 4 bytes at a time from the start of the block to its end. `SumColumnFirst` jumps 16,000 bytes between consecutive reads, and returns to the top of the block 4,000 times.

That matters because main memory is slow compared with the processor, and the hardware hides this with caches: small, fast memories that keep copies of recently used data. Ulrich Drepper's paper [*What Every Programmer Should Know About Memory*](https://lwn.net/Articles/252125/) is the standard detailed description of how they behave.

1. **Caches load whole lines, not single values.** A cache line is 64 bytes on current processors, as Drepper's paper explains in section 3.2, so a miss on one `int` brings in the 15 after it too. Walking a row, at most one read in 16 can miss.
2. **Sequential access is predicted, and costs a few cycles.** When a program moves steadily through memory, the processor fetches the next line before it is asked for, as Drepper's paper explains in section 3.3.2. On the Pentium 4 he measured, sequential reads over data far larger than the cache cost about 4 to 9 cycles per element; random reads over the same data cost over 450.
3. **The penalty for leaving the cache is large.** The figures often quoted for this, 3 cycles for the first-level cache, 14 for the second level, 240 for main memory, are what Drepper's paper, in section 3.2, says "Intel lists for a Pentium M", not a measurement of the processor above. They are two hardware generations old. What still holds is the shape: each level out is roughly an order of magnitude slower.
4. **A stride bigger than a page thrashes the TLB too.** Every read is translated from a virtual to a physical address through the TLB, a small cache of that translation, one entry per 4 KB page. Drepper's paper calls TLB misses "another big reason for the slowdown" of exactly this kind of strided access, in section 3.3.2.

### What actually explains the 2,000-to-4,000 range

Row-first is the best case on every mechanism above, which is why its cost per element sits close to flat, at 0.7 to 0.9 ns from 500 upward. It is not perfectly flat: the smallest grid, 100 × 100, read 1.16 ns per element here, higher than the mid-range sizes even though it fits entirely in L1. Running it with 20 warm-up calls instead of one narrowed that gap for the 1,000-and-larger sizes but not for 100, so a JIT-tiering effect does not fully explain it; a fixed per-call overhead spread over very few elements is more likely, and this page did not isolate it further.

Column-first is the interesting case, and the table above does not by itself say why. Because the grid is stored row by row, sixteen consecutive columns in the same row share one 64-byte line. That line is read once while column 0 is being summed, then not touched again until the loop reaches column 1, then column 2, and so on: a full pass over all *n* rows sits between two touches of it. That gap is the **reuse distance**, and it is about *n* cache lines, or 64*n* bytes, not the size of the whole grid.

At *n* = 4,000 that is 256,000 bytes, about 250 KB. This machine, queried through Windows rather than a source, reports 48 KB of L1 data cache and 512 KB of L2 per core, with the 16 MB L3 already mentioned shared across all eight. A 250 KB reuse distance does not fit L1, but it fits L2 with room to spare. Judged by cache-line reuse alone, the slowdown from 2,000 to 4,000 should be modest, not the six-times jump the table shows.

The TLB is the more likely reason it is not modest. A column-first read jumps 4*n* bytes each time, more than the 4,096-byte page size once *n* exceeds 1,024, so consecutive reads in a column mostly land on different pages. Over one pass, a column touches on the order of *n* distinct pages spread across the whole grid: about 4,000 of them at *n* = 4,000. No TLB holds anywhere near that many translations, so most reads miss it as well as the cache, and each miss adds a page-table walk on top of the memory fetch. That failure mode grows with *n* in exactly the range where the cache-only story runs out of room, which fits the table better than cache eviction alone.

Neither mechanism was measured in isolation here, so treat this as the more defensible explanation, not a demonstrated one: cache-line reuse distance and TLB reach are both consistent with the data, and the TLB is the likelier dominant cause between 2,000 and 4,000.

<figure class="diagram">
<svg viewBox="0 0 360 250" role="img" aria-labelledby="cache-title cache-desc">
<title id="cache-title">Row-first reads stay on the next cache line; column-first reads jump a whole row to a different one</title>
<desc id="cache-desc">Top strip: four boxes, row 0's first four cache lines, with an arrow from the first to the second labeled row-first, next line, 64 bytes away. Bottom strip: the same four columns in row 1, drawn lower down, with a vertical arrow from row 0's first line to row 1's first line labeled column-first, next line is 16,000 bytes down. Text underneath says the loop returns to a line near the top only after n rows, which is the reuse distance.</desc>
<defs>
<marker id="cache-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-accent"/></marker>
</defs>
<text x="20" y="18" class="d-bold">Row 0, four of its cache lines</text>
<rect x="20" y="26" width="70" height="34" class="d-box-accent"/>
<rect x="100" y="26" width="70" height="34" class="d-box"/>
<rect x="180" y="26" width="70" height="34" class="d-box"/>
<rect x="260" y="26" width="70" height="34" class="d-box"/>
<path d="M55 66 V78 H125 V66" class="d-accent" marker-end="url(#cache-arrow)"/>
<text x="20" y="98" class="d-small d-text-accent">Row-first: next line, 64 B away</text>
<text x="20" y="128" class="d-bold">Row 1, the same four columns</text>
<rect x="20" y="136" width="70" height="34" class="d-box-accent"/>
<rect x="100" y="136" width="70" height="34" class="d-box-2 d-dashed"/>
<rect x="180" y="136" width="70" height="34" class="d-box-2 d-dashed"/>
<rect x="260" y="136" width="70" height="34" class="d-box-2 d-dashed"/>
<path d="M55 60 V136" class="d-accent d-dashed" marker-end="url(#cache-arrow)"/>
<text x="20" y="188" class="d-small d-text-accent">Column-first: next line is 16,000 B</text>
<text x="20" y="204" class="d-small d-text-accent">down, a whole row away</text>
<text x="20" y="226" class="d-muted d-small">Back near the top only after n rows:</text>
<text x="20" y="242" class="d-muted d-small">that gap is the reuse distance.</text>
</svg>
<figcaption>Figure 4. Row-first moves to the very next cache line each read. Column-first moves to a line a full row away, and does not return near its starting point until it has read a whole column, about <em>n</em> lines later.</figcaption>
</figure>

#### The 4096 row

At *n* = 4,096 the reuse distance is barely bigger than at 4,000, about 256 KB against 250 KB, yet the ratio nearly triples, from around 6 to around 18. Size alone does not explain that; alignment might. A cache does not choose freely where to place a line: which of its sets a line can go in comes from some of the address bits, as Drepper's paper explains in section 3.3.1. With 4,096 columns of 4-byte values, consecutive column-first reads are exactly 16,384 = 2¹⁴ bytes apart, so every address in a column agrees in its low 14 bits and all of them compete for the same narrow group of sets instead of spreading across the cache.

This page did not measure cache misses directly, so that account is a hypothesis, not a finding. It is testable, though: if the problem is the power-of-two stride and not the size, padding the row so the stride is no longer a power of two should remove most of the anomaly while leaving a grid of nearly the same size. The next program checks that, and also checks the reuse-distance story above directly, by summing the columns in narrow bands instead of one column at a time. A band of 16 `int` columns is exactly one 64-byte cache line, so each row's slice of a band is read in full the moment it is touched, with nothing left to reuse a whole pass later: the reuse distance drops from about *n* lines to essentially none, without reading a single byte more.

```csharp run id=tiled
#:property Optimize=true
using System.Diagnostics;
using System.Globalization;

CultureInfo.CurrentCulture =
    CultureInfo.InvariantCulture;

Report(4000, band: 16);
Report(4096, band: 16);
Report(4097, band: 16);

static void Report(int n, int band)
{
    var g = new int[n, n];
    for (int r = 0; r < n; r++)
        for (int c = 0; c < n; c++)
            g[r, c] = (r + c) & 7;

    double row = Best(
        n, () => SumRows(g, n));
    double col = Best(
        n, () => SumCols(g, n));
    double tiled = Best(
        n, () => SumTiled(g, n, band));
    Console.WriteLine(
        $"n={n,4}  col/row" +
        $" {col / row,5:F1}" +
        $"  tiled/row" +
        $" {tiled / row,5:F1}");
}

static double Best(int n, Func<long> sum)
{
    sum(); // warm-up
    long cells = (long)n * n;
    int reps = (int)Math.Max(
        3, 8_000_000L / cells);
    double best = double.MaxValue;
    for (int run = 0; run < 5; run++)
    {
        long start = Stopwatch.GetTimestamp();
        for (int i = 0; i < reps; i++) sum();
        double ns = Stopwatch
            .GetElapsedTime(start)
            .TotalNanoseconds;
        best = Math.Min(best, ns / reps / cells);
    }
    return best;
}

static long SumRows(int[,] g, int n)
{
    long s = 0;
    for (int r = 0; r < n; r++)
        for (int c = 0; c < n; c++)
            s += g[r, c];
    return s;
}

static long SumCols(int[,] g, int n)
{
    long s = 0;
    for (int c = 0; c < n; c++)
        for (int r = 0; r < n; r++)
            s += g[r, c];
    return s;
}

static long SumTiled(
    int[,] g, int n, int band)
{
    long s = 0;
    for (int c0 = 0; c0 < n; c0 += band)
    {
        int end = Math.Min(c0 + band, n);
        for (int r = 0; r < n; r++)
            for (int c = c0; c < end; c++)
                s += g[r, c];
    }
    return s;
}
```

```text output
n=4000  col/row [...]  tiled/row [...]
n=4096  col/row [...]  tiled/row [...]
n=4097  col/row [...]  tiled/row [...]
```

Two runs here put the 4000 and 4097 rows within noise of each other, `col/row` around 6.5 to 7 and `tiled/row` around 1.5 to 1.6, while 4096 stayed well above both: `col/row` between 13 and 14, `tiled/row` still 5.6 to 6.4 even after tiling. Both predictions held. Padding by one column removes most of the size-4096 penalty without changing the reuse-distance story, which supports treating it as a separate, alignment-specific effect. Tiling helps every size, which supports the reuse-distance account of the general 2,000-to-4,000 slowdown, and it is the practical remedy: when a column-major or strided pass is unavoidable, process it in cache-sized bands rather than one long stride at a time. Tiling does not fully close the gap at 4,096, which is consistent with an extra, alignment-specific cost on top of the reuse-distance one.

:::warning[Big-O does not see any of this]
Both loops are Θ(*n*). Asymptotic analysis counts operations and assumes each memory access costs the same; on real hardware a memory access costs between 1 and a few hundred cycles depending on what was accessed just before it. Use Big-O to choose the algorithm and the data layout to decide how fast that algorithm really runs.
:::

## A list is an array with a counter

An array cannot grow, so a program that does not know its element count in advance needs something else. A `List<T>` is the standard answer, and it is not a different kind of structure. In [`List.cs`](https://github.com/dotnet/runtime/blob/main/src/libraries/System.Private.CoreLib/src/System/Collections/Generic/List.cs) its state is three fields: `T[] _items`, the backing array; `int _size`, how many slots at the front of that array are in use, which is what `Count` returns; and `int _version`, which comes up again below. This arrangement is a [dynamic array](/glossary/#dynamic-array). When the backing array is full, the list allocates a larger one, copies the elements across and drops the old one.

Here is the same idea in about forty lines. It does only what is needed to see the mechanism: indexing and appending.

```csharp run id=dynamic
var laps = new DynamicArray<int>();
int[] seconds = [71, 69, 74, 70, 68];
foreach (int lap in seconds)
    laps.Add(lap);

Console.WriteLine(
    $"Count {laps.Count}, Capacity {laps.Capacity}");
laps[2] = 72;
Console.WriteLine($"laps[2] = {laps[2]}");

try
{
    Console.WriteLine(laps[6]);
}
catch (ArgumentOutOfRangeException)
{
    Console.WriteLine("laps[6]: a slot, not an element");
}

sealed class DynamicArray<T>
{
    private T[] _items = [];
    private int _count;

    public int Count => _count;
    public int Capacity => _items.Length;

    public T this[int index]
    {
        get
        {
            CheckIndex(index);
            return _items[index];
        }
        set
        {
            CheckIndex(index);
            _items[index] = value;
        }
    }

    public void Add(T item)
    {
        if (_count == _items.Length)
            Grow();
        _items[_count++] = item;
    }

    private void Grow()
    {
        int newLength = _items.Length == 0
            ? 4
            : _items.Length * 2;
        var bigger = new T[newLength];
        Array.Copy(_items, bigger, _count);
        _items = bigger;
    }

    // The array's own bounds check accepts any index
    // below Capacity. This one stops at Count.
    private void CheckIndex(int index)
    {
        if ((uint)index >= (uint)_count)
            throw new ArgumentOutOfRangeException(
                nameof(index));
    }
}
```

```text output
Count 5, Capacity 8
laps[2] = 72
laps[6]: a slot, not an element
```

`CheckIndex` exists because the array and the list disagree about what is valid. After five appends the backing array has eight slots, and the array would hand over slot 6 without complaint: it holds `default(T)`, not a lap time. The list has to check against its own count first. The cast to `uint` folds the two tests `index >= 0` and `index < _count` into one comparison, because a negative `int` reinterpreted as unsigned is larger than any valid count. `List<T>`'s indexer in `List.cs` does exactly this, with a comment saying so.

That indexer returns `T` by value, not by reference, and that has a consequence a reader only meets once `T` is a mutable struct: you cannot assign into a field through it.

```csharp run error=CS1612
List<Reading> readings = [new(20.0)];
readings[0].Celsius = 21.0;

struct Reading(double celsius)
{
    public double Celsius = celsius;
}
```

The same line compiles against an array, because `a[i]` is not an indexer at all: the compiler treats array element access as a variable, the same as a field, so it can be assigned into directly, unlike `List<T>`'s indexer, which is a method call that returns a copy. `Reading[] readings = [new(20.0)]; readings[0].Celsius = 21.0;` builds and runs. `List<T>` cannot offer that without handing out a reference into its backing array, which is exactly what `CollectionsMarshal.AsSpan`, further down this page, does on purpose.

`Grow` doubles. Why doubling, and not adding a fixed number of slots, makes `Add` cost O(1) [amortized](/glossary/#amortized-analysis) is the subject of [Amortized Analysis: Why List&lt;T&gt;.Add Is O(1)](/complexity/amortized-analysis/), which traces the real `List<T>` doing it. The starting size of 4 and the factor of 2 mirror what `List.cs` does today; neither is documented behavior.

### The third field: catching edits during a loop

`_version` is incremented by the methods that change the list: `Add`, `Insert`, `RemoveAt`, `Clear`, the indexer's setter and the rest. An enumerator remembers the version it started with, and `MoveNext` in `List.cs` throws if the number has moved. That is where this failure comes from:

```csharp run throws=InvalidOperationException
List<int> jobs = [3, 8, 12, 15];
foreach (int job in jobs)
{
    if (job % 2 == 0)
        jobs.Remove(job);
}
```

The exception ("Collection was modified; enumeration operation may not execute") is the list protecting you: after a removal, every later element has a new index, and an enumerator that carried on would skip one. The check is there to catch this bug in single-threaded code. It is a plain integer comparison with no locking, so it is not a thread-safety mechanism.

### Does the wrapper make a list slower than an array?

Every `list[i]` is a method call that checks the index against `_size` and then indexes `_items`, where the array's own bounds check happens as well. Whether that is measurable is an empirical question, so here is the measurement: summing 10 million `int` values held in an array, in a list, and in a list read through a span, plus the same values in a `LinkedList<int>`, where each element is a separate heap object pointing to the next.

```csharp run id=containers
#:property Optimize=true
using System.Diagnostics;
using System.Globalization;
using System.Runtime.InteropServices;

CultureInfo.CurrentCulture =
    CultureInfo.InvariantCulture;
const int N = 10_000_000;
var array = new int[N];
for (int i = 0; i < N; i++) array[i] = i & 15;
List<int> list = [.. array];
var linked = new LinkedList<int>(array);

Report("int[]", () => SumArray(array));
Report("List<int>", () => SumList(list));
Report("List<int> as span", () =>
    SumSpan(CollectionsMarshal.AsSpan(list)));
Report("LinkedList<int>", () => SumLinked(linked));

static long SumArray(int[] values)
{
    long s = 0;
    for (int i = 0; i < values.Length; i++)
        s += values[i];
    return s;
}

static long SumList(List<int> values)
{
    long s = 0;
    for (int i = 0; i < values.Count; i++)
        s += values[i];
    return s;
}

static long SumSpan(ReadOnlySpan<int> values)
{
    long s = 0;
    foreach (int v in values) s += v;
    return s;
}

static long SumLinked(LinkedList<int> values)
{
    long s = 0;
    foreach (int v in values) s += v;
    return s;
}

static void Report(string label, Func<long> sum)
{
    sum(); // warm-up
    double best = double.MaxValue;
    for (int run = 0; run < 7; run++)
    {
        long start = Stopwatch.GetTimestamp();
        sum();
        double ms = Stopwatch.GetElapsedTime(start)
            .TotalMilliseconds;
        best = Math.Min(best, ms);
    }
    Console.WriteLine($"{label,-19}{best,6:F1} ms");
}
```

```text output
int[]              [...] ms
List<int>          [...] ms
List<int> as span  [...] ms
LinkedList<int>    [...] ms
```

Over half a dozen runs here, the array, the list and the span each took between 4.3 and 7 ms, in no consistent order, and the linked list took between 37 and 66 ms. The first three are the same contiguous block read front to back, and the run-to-run noise is larger than any difference between them. The linked list is roughly ten times slower, and this is a kind case for it: its nodes were allocated one after another by a fresh process, so they are probably close together in memory. Its elements are reached by following a reference from each node to the next, which gives the hardware no address arithmetic to predict.

So for reading, the choice between `T[]` and `List<T>` is not a performance decision in code like this. What separates them is whether the length may change, and what the list's extra operations cost.

## What Insert and RemoveAt really move

Contiguity has a price. There are no gaps, so putting a new element anywhere but the end means making room, and taking one out means closing the hole.

<figure class="diagram">
<svg viewBox="0 0 360 318" role="img" aria-labelledby="shift-title shift-desc">
<title id="shift-title">Inserting 15 at index 1 of a five-element list shifts four elements one slot to the right</title>
<desc id="shift-desc">Three rows of eight slots. Before: 10, 20, 30, 40, 50 and three free slots. During the insert, the block 20, 30, 40, 50 is copied one slot to the right, leaving slot 1 open. After: 10, 15, 20, 30, 40, 50 and two free slots.</desc>
<defs>
<marker id="shift-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-accent"/></marker>
</defs>
<text x="20" y="20" class="d-bold">Before: Count 5, Capacity 8</text>
<rect x="20" y="30" width="40" height="40" class="d-box"/><text x="40" y="55" text-anchor="middle" class="d-mono">10</text>
<rect x="60" y="30" width="40" height="40" class="d-box"/><text x="80" y="55" text-anchor="middle" class="d-mono">20</text>
<rect x="100" y="30" width="40" height="40" class="d-box"/><text x="120" y="55" text-anchor="middle" class="d-mono">30</text>
<rect x="140" y="30" width="40" height="40" class="d-box"/><text x="160" y="55" text-anchor="middle" class="d-mono">40</text>
<rect x="180" y="30" width="40" height="40" class="d-box"/><text x="200" y="55" text-anchor="middle" class="d-mono">50</text>
<rect x="220" y="30" width="40" height="40" class="d-box-2 d-dashed"/>
<rect x="260" y="30" width="40" height="40" class="d-box-2 d-dashed"/>
<rect x="300" y="30" width="40" height="40" class="d-box-2 d-dashed"/>
<text x="20" y="112" class="d-bold">Insert(1, 15): copy slots 1 to 4 right</text>
<rect x="20" y="122" width="40" height="40" class="d-box"/><text x="40" y="147" text-anchor="middle" class="d-mono">10</text>
<rect x="60" y="122" width="40" height="40" class="d-box-2 d-dashed"/>
<rect x="100" y="122" width="40" height="40" class="d-box-warn"/><text x="120" y="147" text-anchor="middle" class="d-mono">20</text>
<rect x="140" y="122" width="40" height="40" class="d-box-warn"/><text x="160" y="147" text-anchor="middle" class="d-mono">30</text>
<rect x="180" y="122" width="40" height="40" class="d-box-warn"/><text x="200" y="147" text-anchor="middle" class="d-mono">40</text>
<rect x="220" y="122" width="40" height="40" class="d-box-warn"/><text x="240" y="147" text-anchor="middle" class="d-mono">50</text>
<rect x="260" y="122" width="40" height="40" class="d-box-2 d-dashed"/>
<rect x="300" y="122" width="40" height="40" class="d-box-2 d-dashed"/>
<path d="M64 176 H254" class="d-accent" marker-end="url(#shift-arrow)"/>
<text x="20" y="196" class="d-small d-text-accent">4 elements moved: Count − index = 5 − 1</text>
<text x="20" y="232" class="d-bold">After: Count 6</text>
<rect x="20" y="242" width="40" height="40" class="d-box"/><text x="40" y="267" text-anchor="middle" class="d-mono">10</text>
<rect x="60" y="242" width="40" height="40" class="d-box-accent"/><text x="80" y="267" text-anchor="middle" class="d-mono d-bold">15</text>
<rect x="100" y="242" width="40" height="40" class="d-box"/><text x="120" y="267" text-anchor="middle" class="d-mono">20</text>
<rect x="140" y="242" width="40" height="40" class="d-box"/><text x="160" y="267" text-anchor="middle" class="d-mono">30</text>
<rect x="180" y="242" width="40" height="40" class="d-box"/><text x="200" y="267" text-anchor="middle" class="d-mono">40</text>
<rect x="220" y="242" width="40" height="40" class="d-box"/><text x="240" y="267" text-anchor="middle" class="d-mono">50</text>
<rect x="260" y="242" width="40" height="40" class="d-box-2 d-dashed"/>
<rect x="300" y="242" width="40" height="40" class="d-box-2 d-dashed"/>
<text x="20" y="304" class="d-small d-muted">RemoveAt(1) is the same picture read upward</text>
</svg>
<figcaption>Figure 2. An insert copies every element from the insertion point to the end one slot to the right (amber), then writes the new value into the opening. The work is proportional to the number of elements after the index, not to the size of the new element.</figcaption>
</figure>

The documentation states the costs. [`Insert`](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.list-1.insert) is "an O(*n*) operation, where *n* is Count". [`RemoveAt`](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.list-1.removeat) is more precise: O(*n*) "where *n* is (Count − index)". That bound covers both methods, but it is not the same element count for each, and the difference matters if you want the exact number, not just the order of growth.

`Insert(index, x)` makes room first, so it shifts every element from `index` to the old last slot: exactly `Count - index` elements, which is what Figure 2 shows moving. `RemoveAt(index)` closes a hole instead: the element that was at `index` is gone, and everything *after* it slides down one slot, so it moves `Count - index - 1` elements, one fewer than `Insert` at the same index. At `index = Count - 1`, that formula gives `Count - (Count - 1) - 1 = 0`, not 1: removing the last element moves nothing, which the first bullet below depends on. In `List.cs` each is a bounds check followed by one `Array.Copy` of the tail, sized accordingly.

- At the end of the list, both are cheap: `Insert(Count, x)` shifts nothing (it is `Add`, amortized O(1)), and `RemoveAt(Count - 1)` shifts nothing. A list makes a good stack.
- At the front, both move everything: `Insert(0, x)` shifts all `Count` elements, `RemoveAt(0)` shifts all `Count - 1` remaining ones. Either one in a loop is Θ(*n*²) in total.
- `Remove(item)` is not cheaper than `RemoveAt`. In `List.cs` it is `IndexOf` followed by `RemoveAt`: a linear search, then the shift.

The quadratic growth is easy to see on a stopwatch. This program builds a list of *n* integers by appending, then by inserting at the front, doubling *n* each time.

```csharp run id=front
#:property Optimize=true
using System.Diagnostics;
using System.Globalization;

CultureInfo.CurrentCulture =
    CultureInfo.InvariantCulture;

int[] sizes =
    [25_000, 50_000, 100_000, 200_000];
Console.WriteLine(
    "n         Add   Insert(0)");
foreach (int n in sizes)
{
    double back = Time(() =>
    {
        var list = new List<int>();
        for (int i = 0; i < n; i++)
            list.Add(i);
    });
    double front = Time(() =>
    {
        var list = new List<int>();
        for (int i = 0; i < n; i++)
            list.Insert(0, i);
    });
    Console.WriteLine(
        $"{n,7:N0} {back,7:F2} ms" +
        $" {front,7:F1} ms");
}

static double Time(Action work)
{
    double best = double.MaxValue;
    for (int run = 0; run < 3; run++)
    {
        long start = Stopwatch.GetTimestamp();
        work();
        double ms = Stopwatch.GetElapsedTime(start)
            .TotalMilliseconds;
        best = Math.Min(best, ms);
    }
    return best;
}
```

```text output
n         Add   Insert(0)
 25,000 [...] ms [...] ms
 50,000 [...] ms [...] ms
100,000 [...] ms [...] ms
200,000 [...] ms [...] ms
```

On this machine the `Add` column stayed between 0.15 and 0.33 ms for all four sizes. The `Insert(0)` column read 21.6, 91.4, 407 and 1,676 ms: each doubling of *n* multiplied the time by a little over four, which is the signature of Θ(*n*²). At 200,000 elements the front-insert version is about five thousand times slower than appending, and the gap doubles with every doubling of *n*. If the final order must be reversed, append and call `Reverse()` once at the end, which is one pass over the list.

:::pitfall
Removing several elements one call at a time is the same trap from the other side. Each `RemoveAt` shifts the whole tail, so deleting *k* scattered elements from a list of *n* costs O(*k* · *n*). [`RemoveAll`](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.list-1.removeall) is documented as O(*n*) in total: in `List.cs` it makes one pass with two indices, copying each element that is kept straight to its final position, so every element moves at most once.
:::

::::exercise[Find the bug, then the slow part]
`DropEvens` is meant to remove every even number from a list. It compiles, throws nothing, and leaves two even numbers behind. Explain the wrong answer. Then give two fixes, and say which you would keep for a list of 100,000 elements.

```csharp run id=ex-broken
List<int> nums =
    [4, 6, 7, 10, 12, 3];
DropEvens(nums);
Console.WriteLine(
    string.Join(' ', nums));

static void DropEvens(
    List<int> nums)
{
    for (int i = 0;
         i < nums.Count; i++)
        if (nums[i] % 2 == 0)
            nums.RemoveAt(i);
}
```

```text output
6 7 12 3
```

:::solution
When `RemoveAt(i)` closes the hole, the element that was at `i + 1` now sits at `i`. The loop then increments `i` and never looks at it. Here the 4 is removed, the 6 slides into slot 0 and is skipped; later the 10 is removed and the 12 is skipped. The bug only shows when two matching elements are adjacent, which is why a test with `[1, 2, 3, 4]` passes.

Walking backward fixes the logic, because the elements that move have already been examined. It is still one shift per removal. `RemoveAll` fixes both the logic and the cost.

```csharp run id=ex-evens
#:property Optimize=true
using System.Diagnostics;
using System.Globalization;

CultureInfo.CurrentCulture =
    CultureInfo.InvariantCulture;

List<int> small = [4, 6, 7, 10, 12, 3];
DropEvensBackward(small);
Console.WriteLine(
    $"backward: {string.Join(' ', small)}");

const int N = 100_000;
var a = Enumerable.Range(0, N).ToList();
long start = Stopwatch.GetTimestamp();
DropEvensBackward(a);
TimeSpan loop = Stopwatch.GetElapsedTime(start);

var b = Enumerable.Range(0, N).ToList();
start = Stopwatch.GetTimestamp();
b.RemoveAll(x => x % 2 == 0);
TimeSpan all = Stopwatch.GetElapsedTime(start);

Console.WriteLine($"same: {a.SequenceEqual(b)}");
Console.WriteLine(
    $"RemoveAt loop {loop.TotalMilliseconds:F1} ms");
Console.WriteLine(
    $"RemoveAll     {all.TotalMilliseconds:F2} ms");

static void DropEvensBackward(List<int> values)
{
    for (int i = values.Count - 1; i >= 0; i--)
        if (values[i] % 2 == 0)
            values.RemoveAt(i);
}
```

```text output
backward: 7 3
same: True
RemoveAt loop [...] ms
RemoveAll     [...] ms
```

Two runs on this machine took 1.3 and 1.4 seconds for the backward loop and under a millisecond for `RemoveAll` (a figure that includes compiling the lambda). The loop performs 50,000 removals, each shifting the odd numbers already kept behind it, about 1.25 billion element moves in all; `RemoveAll` moves each surviving element once. Keep `RemoveAll`.
:::
::::

::::exercise[Extend DynamicArray with Insert and RemoveAt]
Add `Insert(int index, T item)` and `RemoveAt(int index)` to the `DynamicArray<T>` class from earlier. `Insert` must accept `index == Count`. After `RemoveAt`, one slot beyond the new end still holds a copy of the last element: decide what to do about it, and why it matters when `T` is a reference type.

:::solution
Both methods are one `Array.Copy` of the tail, which handles overlapping source and destination ranges correctly. The stale slot must be cleared: if `T` is a class, the leftover reference keeps its object alive until that slot is overwritten, although no index can reach it. `List.cs` clears it only when `T` is or contains a reference (it asks `RuntimeHelpers.IsReferenceOrContainsReferences<T>()`), because for an `int` a stale value is harmless. Clearing unconditionally, as below, is correct and costs one extra write.

```csharp run id=ex-extend
var stops = new DynamicArray<string>();
string[] route = ["Oslo", "Bergen", "Tromso"];
foreach (string stop in route)
    stops.Add(stop);

stops.Insert(1, "Flam");
stops.Insert(stops.Count, "Alta");
stops.RemoveAt(0);
for (int i = 0; i < stops.Count; i++)
    Console.Write($"{stops[i]} ");
Console.WriteLine($"({stops.Count})");

sealed class DynamicArray<T>
{
    private T[] _items = [];
    private int _count;

    public int Count => _count;

    public T this[int index]
    {
        get
        {
            if ((uint)index >= (uint)_count)
                throw new ArgumentOutOfRangeException(
                    nameof(index));
            return _items[index];
        }
    }

    public void Add(T item) => Insert(_count, item);

    public void Insert(int index, T item)
    {
        if ((uint)index > (uint)_count)
            throw new ArgumentOutOfRangeException(
                nameof(index));
        if (_count == _items.Length)
            Grow();
        Array.Copy(_items, index,
            _items, index + 1, _count - index);
        _items[index] = item;
        _count++;
    }

    public void RemoveAt(int index)
    {
        if ((uint)index >= (uint)_count)
            throw new ArgumentOutOfRangeException(
                nameof(index));
        _count--;
        Array.Copy(_items, index + 1,
            _items, index, _count - index);
        _items[_count] = default!; // drop the stale copy
    }

    private void Grow()
    {
        int newLength = _items.Length == 0
            ? 4
            : _items.Length * 2;
        var bigger = new T[newLength];
        Array.Copy(_items, bigger, _count);
        _items = bigger;
    }
}
```

```text output
Flam Bergen Tromso Alta (4)
```

One refinement in the real thing: when an insert arrives at a full array, growing first and shifting second copies the tail twice. `List.cs` has a `GrowForInsertion` method that copies the two halves of the old array directly to their final positions in the new one.
:::
::::

## Views that do not copy: Span and ArraySegment

Because an array is one run of equal-sized slots, any sub-range of it can be described by two numbers: where it starts and how many elements it has. .NET has two types built on that, and neither copies anything.

[`Span<T>`](https://learn.microsoft.com/en-us/dotnet/api/system.span-1) "represents a contiguous region of arbitrary memory": all or part of an array, memory from `stackalloc`, or native memory, all behind the same indexer. Slicing a span gives another span over the same elements. [`ArraySegment<T>`](https://learn.microsoft.com/en-us/dotnet/api/system.arraysegment-1) is narrower: a struct holding an array reference, an `Offset` and a `Count`. Its documentation stresses that the `Array` property "returns the entire original array, not a copy". A method that takes `ReadOnlySpan<T>` accepts an array, a span or a segment without overloads: [`ReadOnlySpan<T>` itself defines an implicit conversion](https://github.com/dotnet/runtime/blob/main/src/libraries/System.Private.CoreLib/src/System/ReadOnlySpan.cs) from a bare `T[]` and a second one from `ArraySegment<T>`, so both convert on the way in.

```csharp run id=views
using System.Runtime.InteropServices;

int[] week =
    [12, 15, 11, 18, 21, 9, 7];
Span<int> weekdays =
    week.AsSpan(0, 5);
var weekend =
    new ArraySegment<int>(week, 5, 2);

weekdays[0] = 99; // -> week[0]
weekend[1] = 77;  // -> week[6]
Console.WriteLine(
    string.Join(' ', week));
Console.WriteLine(
    $"weekdays: {Sum(weekdays)}");
Console.WriteLine(
    $"weekend:  {Sum(weekend)}");

var readings =
    new List<int>(4) { 1, 2, 3, 4 };
Span<int> view =
    CollectionsMarshal.AsSpan(readings);
readings.Add(5); // list moves house
view[0] = -1;    // writes old array

Console.WriteLine(
    $"list[0] = {readings[0]}");
Console.WriteLine(
    $"view[0] = {view[0]}");

static int Sum(ReadOnlySpan<int> values)
{
    int total = 0;
    foreach (int v in values)
        total += v;
    return total;
}
```

```text output
99 15 11 18 21 9 77
weekdays: 164
weekend:  86
list[0] = 1
view[0] = -1
```

The first three lines of output show both views writing through to `week`. The last line is the hazard. [`CollectionsMarshal.AsSpan`](https://learn.microsoft.com/en-us/dotnet/api/system.runtime.interopservices.collectionsmarshal.asspan) hands you the list's backing array directly, and its documentation carries one warning: items "should not be added or removed from the `List<T>` while the `Span<T>` is in use". Here is why. The list was full at 4 of 4; `Add(5)` allocated a new array and copied into it; `view` still describes the old one. The write of −1 succeeds, harms nothing, and is simply lost. Nothing throws: the `_version` check only guards enumerators. Treat a span over a list as valid until the next call that can change the list's size.

The main limit on `Span<T>` is where it may live. It is a `ref struct`, so according to its documentation it cannot be boxed, cannot be a field of a class, and cannot be used across `await` or `yield` boundaries. The compiler enforces this:

```csharp run error=CS8345
var holder = new Holder();
Console.WriteLine(holder.Window.Length);

class Holder
{
    public Span<int> Window;
}
```

`ArraySegment<T>` is an ordinary struct and has none of those restrictions: it can sit in a field or survive an `await`, and it also implements `IList<T>`, so older APIs written against that interface accept it directly. The `Span<T>` documentation itself points to `Memory<T>` as the general-purpose choice for those cases.

## Grids: one rectangle or an array of rows

C# gives you two ways to write a two-dimensional table, and after the sections above the difference can be stated in memory terms. The [C# reference](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/arrays) calls `int[,]` a multidimensional array and `int[][]` a jagged array, "an array whose elements are arrays, possibly of different sizes", whose elements start out `null` until you create each row.

<figure class="diagram">
<svg viewBox="0 0 360 372" role="img" aria-labelledby="grids-title grids-desc">
<title id="grids-title">A rectangular int[3,3] is one block; a jagged int[3][] is an outer array of references to separate row arrays</title>
<desc id="grids-desc">Top: nine slots in one row, labeled 0,0 to 2,2, with the three slots of row 1 highlighted in the middle. Bottom: an outer array of three references. Each reference points to its own row array drawn at a different position; the rows have three, three and two elements.</desc>
<defs>
<marker id="grids-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-stroke"/></marker>
</defs>
<text x="20" y="20" class="d-bold">int[3,3]: one object, 9 slots</text>
<rect x="20" y="30" width="35" height="34" class="d-box"/><text x="37.5" y="52" text-anchor="middle" class="d-mono d-small">0,0</text>
<rect x="55" y="30" width="35" height="34" class="d-box"/><text x="72.5" y="52" text-anchor="middle" class="d-mono d-small">0,1</text>
<rect x="90" y="30" width="35" height="34" class="d-box"/><text x="107.5" y="52" text-anchor="middle" class="d-mono d-small">0,2</text>
<rect x="125" y="30" width="35" height="34" class="d-box-accent"/><text x="142.5" y="52" text-anchor="middle" class="d-mono d-small">1,0</text>
<rect x="160" y="30" width="35" height="34" class="d-box-accent"/><text x="177.5" y="52" text-anchor="middle" class="d-mono d-small">1,1</text>
<rect x="195" y="30" width="35" height="34" class="d-box-accent"/><text x="212.5" y="52" text-anchor="middle" class="d-mono d-small">1,2</text>
<rect x="230" y="30" width="35" height="34" class="d-box"/><text x="247.5" y="52" text-anchor="middle" class="d-mono d-small">2,0</text>
<rect x="265" y="30" width="35" height="34" class="d-box"/><text x="282.5" y="52" text-anchor="middle" class="d-mono d-small">2,1</text>
<rect x="300" y="30" width="35" height="34" class="d-box"/><text x="317.5" y="52" text-anchor="middle" class="d-mono d-small">2,2</text>
<text x="72.5" y="82" text-anchor="middle" class="d-small d-muted">row 0</text>
<text x="177.5" y="82" text-anchor="middle" class="d-small d-text-accent">row 1</text>
<text x="282.5" y="82" text-anchor="middle" class="d-small d-muted">row 2</text>
<text x="20" y="106" class="d-small">[r,c] is slot r × 3 + c: one multiply-add, one read</text>
<text x="20" y="150" class="d-bold">int[3][]: an array of references to rows</text>
<rect x="20" y="164" width="52" height="34" class="d-box-2"/><text x="46" y="186" text-anchor="middle" class="d-mono d-small">[0]</text>
<rect x="20" y="198" width="52" height="34" class="d-box-2"/><text x="46" y="220" text-anchor="middle" class="d-mono d-small">[1]</text>
<rect x="20" y="232" width="52" height="34" class="d-box-2"/><text x="46" y="254" text-anchor="middle" class="d-mono d-small">[2]</text>
<path d="M72 181 L196 181" class="d-line" marker-end="url(#grids-arrow)"/>
<path d="M72 215 L118 229" class="d-line" marker-end="url(#grids-arrow)"/>
<path d="M72 249 L226 283" class="d-line" marker-end="url(#grids-arrow)"/>
<rect x="200" y="164" width="34" height="34" class="d-box"/><rect x="234" y="164" width="34" height="34" class="d-box"/><rect x="268" y="164" width="34" height="34" class="d-box"/>
<rect x="122" y="214" width="34" height="34" class="d-box-accent"/><rect x="156" y="214" width="34" height="34" class="d-box-accent"/><rect x="190" y="214" width="34" height="34" class="d-box-accent"/>
<rect x="230" y="268" width="34" height="34" class="d-box"/><rect x="264" y="268" width="34" height="34" class="d-box"/>
<text x="20" y="326" class="d-small">Each row is its own object, wherever the allocator</text>
<text x="20" y="342" class="d-small">put it, and rows may differ in length.</text>
<text x="20" y="362" class="d-small">[r][c] is two reads: find the row, then the slot</text>
</svg>
<figcaption>Figure 3. The rectangular array is Figure 1 with a wider index formula. The jagged array is an array of references like the <code>string[]</code> measured earlier: the rows are separate objects with their own headers and lengths, which is what lets them be ragged.</figcaption>
</figure>

Which is faster is not something to guess. The next program sums a 4000 × 4000 grid stored three ways (rectangular, jagged, and a plain `int[]` indexed as `r * N + c`) in both loop orders.

<details>
<summary>Full program: three layouts, two loop orders</summary>

```csharp run id=grids
#:property Optimize=true
using System.Diagnostics;
using System.Globalization;

CultureInfo.CurrentCulture =
    CultureInfo.InvariantCulture;
const int N = 4000;

var rect = new int[N, N];
var jagged = new int[N][];
var flat = new int[N * N];
for (int r = 0; r < N; r++)
{
    jagged[r] = new int[N];
    for (int c = 0; c < N; c++)
    {
        int v = (r + c) & 7;
        rect[r, c] = v;
        jagged[r][c] = v;
        flat[r * N + c] = v;
    }
}

Console.WriteLine(
    "layout        rows     cols");
Report("int[,]", rowsFirst =>
    RectSum(rect, rowsFirst));
Report("int[][]", rowsFirst =>
    JagSum(jagged, rowsFirst));
Report("flat int[]", rowsFirst =>
    FlatSum(flat, rowsFirst));

static void Report(
    string name, Func<bool, long> sum)
{
    double rows = Best(
        () => sum(true));
    double cols = Best(
        () => sum(false));
    Console.WriteLine(
        $"{name,-10} {rows,7:F1}  {cols,6:F1}");
}

static double Best(Func<long> sum)
{
    sum(); // warm-up
    double best = double.MaxValue;
    for (int run = 0; run < 5; run++)
    {
        long start = Stopwatch.GetTimestamp();
        sum();
        double ms = Stopwatch.GetElapsedTime(start)
            .TotalMilliseconds;
        best = Math.Min(best, ms);
    }
    return best;
}

// rowsFirst picks the loop nesting; the body that
// reads g is identical either way for each layout.
static long RectSum(
    int[,] g, bool rowsFirst)
{
    long s = 0;
    if (rowsFirst)
        for (int r = 0; r < N; r++)
            for (int c = 0; c < N; c++)
                s += g[r, c];
    else
        for (int c = 0; c < N; c++)
            for (int r = 0; r < N; r++)
                s += g[r, c];
    return s;
}

static long JagSum(
    int[][] g, bool rowsFirst)
{
    long s = 0;
    if (rowsFirst)
        foreach (int[] row in g)
            foreach (int v in row) s += v;
    else
        for (int c = 0; c < N; c++)
            for (int r = 0; r < N; r++)
                s += g[r][c];
    return s;
}

static long FlatSum(
    int[] g, bool rowsFirst)
{
    long s = 0;
    if (rowsFirst)
        foreach (int v in g) s += v;
    else
        for (int c = 0; c < N; c++)
            for (int r = 0; r < N; r++)
                s += g[r * N + c];
    return s;
}
```

```text output
layout        rows     cols
int[,]     [...]  [...]
int[][]    [...]  [...]
flat int[] [...]  [...]
```

</details>

Inside it, only the indexing expression changes between the three layouts:

```csharp snippet of=grids
static long RectSum(
    int[,] g, bool rowsFirst)
{
    long s = 0;
    if (rowsFirst)
        for (int r = 0; r < N; r++)
            for (int c = 0; c < N; c++)
                s += g[r, c];
```

```csharp snippet of=grids
static long JagSum(
    int[][] g, bool rowsFirst)
{
    long s = 0;
    if (rowsFirst)
        foreach (int[] row in g)
            foreach (int v in row) s += v;
```

```csharp snippet of=grids
static long FlatSum(
    int[] g, bool rowsFirst)
{
    long s = 0;
    if (rowsFirst)
        foreach (int v in g) s += v;
```

`RectSum` reads `g[r, c]` on one rectangular block, `JagSum` walks the outer array of row references and sums each row array, and `FlatSum` reads a single-dimension array through a hand-computed offset. The rest of each function, and the `Report`/`Best` timing wrapper above, is the same shape as the traversal harness earlier: warm up once, then keep the best of five runs.

The ranges over five runs on this machine:

| Layout | Rows ms | Cols ms |
|---|---:|---:|
| `int[,]` | 12 to 20 | 75 to 99 |
| `int[][]` | 7 to 12 | 160 to 205 |
| flat `int[]` | 7 to 11 | 72 to 94 |

Row-first, the jagged and flat versions are the quickest, and the rectangular array took between 1.5 and 2 times as long in every run, despite reading the elements in the same order. A likely reason: .NET's general array model supports a per-dimension lower bound other than 0, created with `Array.CreateInstance` rather than the `int[,]` syntax, and [`Array.GetLowerBound`'s documentation](https://learn.microsoft.com/en-us/dotnet/api/system.array.getlowerbound) confirms such arrays exist and can even come back from unmanaged code. A `g[r, c]` access may have more for the runtime to account for than a single-dimension, zero-based array does, even on an array like this one where every bound is 0. This page did not disassemble the generated code to confirm it, so hold it loosely; re-measure before relying on it.

Column-first, the jagged array is the worst, by a factor of roughly two against the flat and rectangular arrays. A plausible cause: the outer array of row references is read sequentially, which the cache predicts well by itself, but every element still needs a second, dependent read from a different object, the row, and `r` changes on every single step of this loop, so there is no fixed row for the JIT to keep the reference to. That is a hypothesis, not a measurement; the exercise below tests it.

In short: when the access pattern follows the rows, all three are fast and jagged loses nothing. When it does not, one contiguous block limits the damage. Use jagged when rows really do differ in length, or need to be replaced or sorted as units, because swapping two rows is then swapping two references. Use a flat array with your own `r * N + c` when you want the single block together with one-dimensional loop speed, and wrap the index arithmetic in one small method so the formula exists in only one place.

::::exercise[Test the row-reference hypothesis]
The claim above is that jagged column-first is slow partly because `g[r]` names a different object on every read. If that matters, summing several adjacent columns together before moving to the next row should help: it still visits the elements in close to column order, but it reads each row's reference once and reuses it several times. Predict whether summing the columns in bands of 16 will land closer to the 7-to-12-ms row-first range or the 160-to-205-ms column-first range from the table above, then write it and check.

:::solution
```csharp run id=ex-band
#:property Optimize=true
using System.Diagnostics;
using System.Globalization;

CultureInfo.CurrentCulture =
    CultureInfo.InvariantCulture;
const int N = 4000;
var jagged = new int[N][];
for (int r = 0; r < N; r++)
{
    jagged[r] = new int[N];
    for (int c = 0; c < N; c++)
        jagged[r][c] = (r + c) & 7;
}

double plain = Best(
    () => Cols(jagged));
double banded = Best(
    () => Banded(jagged, band: 16));
Console.WriteLine(
    $"column-first  {plain,6:F1} ms");
Console.WriteLine(
    $"banded by 16  {banded,6:F1} ms");

static double Best(Func<long> sum)
{
    sum(); // warm-up
    double best = double.MaxValue;
    for (int run = 0; run < 5; run++)
    {
        long start = Stopwatch.GetTimestamp();
        sum();
        double ms = Stopwatch.GetElapsedTime(start)
            .TotalMilliseconds;
        best = Math.Min(best, ms);
    }
    return best;
}

static long Cols(int[][] g)
{
    long s = 0;
    for (int c = 0; c < N; c++)
        for (int r = 0; r < N; r++)
            s += g[r][c];
    return s;
}

static long Banded(int[][] g, int band)
{
    long s = 0;
    for (int c0 = 0; c0 < N; c0 += band)
    {
        int end = Math.Min(c0 + band, N);
        for (int r = 0; r < N; r++)
        {
            int[] row = g[r]; // once per r
            for (int c = c0; c < end; c++)
                s += row[c];
        }
    }
    return s;
}
```

```text output
column-first  [...] ms
banded by 16  [...] ms
```

Two runs here gave column-first around 168 ms and banded-by-16 around 17 to 18 ms, a factor of roughly 9 to 10, and well under even the *rectangular* array's plain column-first time (75 to 99 ms) from the table above. That is stronger support for the row-reference hypothesis than a small change would have been, but it is not a clean isolation: banding also shortens the reuse distance for the data itself, the same effect the tiled experiment used earlier in this article, so both mechanisms are working together here, not separately measured. What the result does show cleanly is the fix: when a jagged array must be walked in something other than row order, reading each row's reference once and reusing it, rather than re-reading `g[r]` on every element, is worth doing regardless of which mechanism gets the credit.
:::
::::

## Picking between an array, a list and a view

The measurements above reframe the "array or list" question. Reading is equally fast in both. The choice is about what may change, and who is allowed to change it.

- **Read or write by index.** `T[]`: O(1). `List<T>`: O(1) too, an index check against `Count` on top of the array's own.
- **Append at the end.** `T[]`: not supported; the length is fixed for the life of the instance. `List<T>`: O(1) amortized, via `Add`.
- **Insert or remove at index *i*.** `T[]`: not supported without allocating a new, larger or smaller array and copying into it. `List<T>`: O(Count − *i*), roughly, the shift measured above.
- **`Contains` / `IndexOf` on unsorted data.** `T[]` and `List<T>`: both O(*n*); `List<T>` calls straight through to `Array.IndexOf` on its backing array.
- **`BinarySearch`.** `T[]` and `List<T>`: both O(log *n*), and both require the data to already be sorted by the comparison `BinarySearch` uses.

- **Length known and fixed:** `T[]`. Least overhead, and the length cannot drift.
- **Length unknown, growth at the end:** `List<T>`. `Add` is O(1) amortized.
- **Size known before filling:** `new List<T>(n)`. It still copies if you add past *n*, but every `Add` up to *n* skips the regrowth copy; the mechanism is worked out in [Amortized Analysis](/complexity/amortized-analysis/).
- **Frequent insert or remove at the front:** not a list. Each call shifts all the elements.
- **Deleting many elements by a condition:** `RemoveAll`, one O(*n*) pass.
- **Passing part of an array to a method:** `ReadOnlySpan<T>`. No copy, and it accepts arrays and segments.
- **Keeping a sub-range in a field or across `await`:** `Memory<T>` or `ArraySegment<T>`, because a `Span<T>` cannot be stored there.
- **Dense 2-D data read in row order:** `T[,]` or a flat `T[]`, one block either way.
- **Rows of different lengths:** `T[][]`, the only one of the three that allows it.

`Contains`, `IndexOf` and `BinarySearch` cost the same in an array and a `List<T>`. In [`List.cs`](https://github.com/dotnet/runtime/blob/main/src/libraries/System.Private.CoreLib/src/System/Collections/Generic/List.cs), `IndexOf` calls `Array.IndexOf` on `_items`, `Contains` calls `IndexOf`, and `BinarySearch` calls `Array.BinarySearch`: the list's version is the array's version, called on the backing array. `BinarySearch` only applies to data that is already sorted by the comparison it uses; run it on unsorted data and it can return a wrong index without telling you.
