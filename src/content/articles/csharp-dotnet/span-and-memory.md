---
title: "Span<T> and Memory<T>: Slicing Without Allocating"
description: "Measure what parsing order lines with Span<T> saves over string.Split, then run the ref struct compiler errors and the Memory<T> fix async code needs."
pillar: csharp-dotnet
order: 8
author: markus
published: 2026-09-24
updated: 2026-09-24
level: advanced
tags: [span, memory-allocation, ref-struct, async-await]
prerequisites: ["csharp-dotnet/value-types-vs-reference-types", "csharp-dotnet/strings-and-unicode"]
sources:
  - title: "Memory<T> and Span<T> usage guidelines"
    url: "https://learn.microsoft.com/en-us/dotnet/standard/memory-and-spans/memory-t-usage-guidelines"
    publisher: "Microsoft Learn"
    accessed: 2026-09-24
  - title: "Span<T> Struct"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.span-1"
    publisher: "Microsoft Learn"
    accessed: 2026-09-24
  - title: "ref struct types"
    url: "https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/ref-struct"
    publisher: "Microsoft Learn"
    accessed: 2026-09-24
  - title: "GC.GetAllocatedBytesForCurrentThread Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.gc.getallocatedbytesforcurrentthread"
    publisher: "Microsoft Learn"
    accessed: 2026-09-24
  - title: "MemoryExtensions.Split Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.memoryextensions.split"
    publisher: "Microsoft Learn"
    accessed: 2026-09-24
  - title: "Utf8Parser.TryParse Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.buffers.text.utf8parser.tryparse"
    publisher: "Microsoft Learn"
    accessed: 2026-09-24
  - title: "Stream.ReadAsync Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.io.stream.readasync"
    publisher: "Microsoft Learn"
    accessed: 2026-09-24
  - title: "System.IO.Pipelines"
    url: "https://learn.microsoft.com/en-us/dotnet/standard/io/pipelines"
    publisher: "Microsoft Learn"
    accessed: 2026-09-24
draft: false
---

Parsing the line `"SKU-1042,3,19.99"` into a SKU, a quantity and a price with `line.Split(',')` costs four allocations before any arithmetic happens: the array `Split` returns, plus one new string for each of the three fields. Every one of those bytes already exists inside the original line. `Span<T>` is how C# lets code read them in place instead of copying them out first, and `Memory<T>` is what makes the same trick survive an `await`. [Strings, Immutability and Unicode in .NET](/csharp-dotnet/strings-and-unicode/) is the shorter first look at the same idea, for a single string slice; this article is the deeper dive, into the `ref struct` rules a span carries and the `Memory<T>` story for code that has to hold one across an `await`.

## What parsing an order line actually costs

`ReadOnlySpan<char>` wraps a string's existing characters instead of copying them: `IndexOf` and slicing walk the same memory the string already owns. Splitting 8,000 order lines this way, and comparing it against `string.Split`, turns the claim into a number instead of an assumption:

```csharp run id=order-line-cost
#:property Optimize=true

const int Lines = 8_000;
string[] orderLines = BuildLines(Lines);

Measure("string.Split", () => TotalWithSplit(orderLines));
Measure("Span slicing", () => TotalWithSpan(orderLines));

static string[] BuildLines(int count)
{
    var lines = new string[count];
    for (int i = 0; i < count; i++)
        lines[i] = $"SKU-{1000 + i % 500},{1 + i % 9},19.99";
    return lines;
}

static void Measure(string label, Func<decimal> total)
{
    total(); // warm-up, not measured
    long before = GC.GetAllocatedBytesForCurrentThread();
    decimal result = total();
    long bytes = GC.GetAllocatedBytesForCurrentThread() - before;
    Console.WriteLine($"{label,-13}{result,12:N2}{bytes,12:N0} B");
}

static decimal TotalWithSplit(string[] lines)
{
    decimal grandTotal = 0m;
    foreach (string line in lines)
    {
        string[] fields = line.Split(',');
        int quantity = int.Parse(fields[1]);
        decimal price = decimal.Parse(fields[2]);
        grandTotal += quantity * price;
    }
    return grandTotal;
}

static decimal TotalWithSpan(string[] lines)
{
    decimal grandTotal = 0m;
    foreach (string line in lines)
    {
        ReadOnlySpan<char> rest = line;
        int comma1 = rest.IndexOf(',');
        rest = rest[(comma1 + 1)..];
        int comma2 = rest.IndexOf(',');

        int quantity = int.Parse(rest[..comma2]);
        decimal price = decimal.Parse(rest[(comma2 + 1)..]);
        grandTotal += quantity * price;
    }
    return grandTotal;
}
```

```text output
string.Split   799,520.04   1,152,000 B
Span slicing   799,520.04           0 B
```

Both loops compute the same total from the same 8,000 lines — 799,520.04, so neither version is cutting a corner the other one pays for — but `TotalWithSplit` allocates 1,152,000 bytes and `TotalWithSpan` allocates none. `int.Parse` and `decimal.Parse` both have overloads that read straight from a `ReadOnlySpan<char>`, so the span version never needs a `string` for the quantity or the price at all; `TotalWithSpan` never calls `Split`, never calls `Substring`, and produces the identical decimal result. That 1,152,000 bytes is the array `Split` allocates for every line, plus one string object per field inside that line — a cost that exists purely to hold digits the original line already had, measured here with [`GC.GetAllocatedBytesForCurrentThread`](https://learn.microsoft.com/en-us/dotnet/api/system.gc.getallocatedbytesforcurrentthread), which reports bytes allocated on the managed heap since the thread started and is meant for exactly this kind of before/after comparison. These numbers came from running the program above with .NET 10.0.401 on Windows 11, x64; the exact byte counts are deterministic for this code and this runtime, so they need no `[...]` wildcard.

::::exercise[Measure it: does the cost scale like the concatenation loop did?]
A separate article on this site measured naive string concatenation and found the allocated bytes roughly *quadruple* when the number of appends doubles, because each append re-copies everything built so far. Parsing order lines is different: each line is parsed independently, with no result carried over from the line before it. Before running anything, predict what happens to `string.Split`'s allocated bytes if `Lines` above changes from `8_000` to `40_000` — same ratio as the input, or something else?

:::solution
```csharp run id=order-line-cost-40k
#:property Optimize=true

const int Lines = 40_000;
string[] orderLines = BuildLines(Lines);
Measure("string.Split", () => TotalWithSplit(orderLines));

static string[] BuildLines(int count)
{
    var lines = new string[count];
    for (int i = 0; i < count; i++)
        lines[i] = $"SKU-{1000 + i % 500},{1 + i % 9},19.99";
    return lines;
}

static void Measure(string label, Func<decimal> total)
{
    total();
    long before = GC.GetAllocatedBytesForCurrentThread();
    decimal result = total();
    long bytes = GC.GetAllocatedBytesForCurrentThread() - before;
    Console.WriteLine($"{label,-13}{result,12:N2}{bytes,12:N0} B");
}

static decimal TotalWithSplit(string[] lines)
{
    decimal grandTotal = 0m;
    foreach (string line in lines)
    {
        string[] fields = line.Split(',');
        grandTotal += int.Parse(fields[1]) * decimal.Parse(fields[2]);
    }
    return grandTotal;
}
```

```text output
string.Split 3,997,800.10   5,760,000 B
```

5,760,000 is exactly five times 1,152,000 — the same 5x as the input, not 25x. Each line's parse work is independent of every other line's, so the total cost is proportional to the number of lines: O(n), not O(n²). The quadratic case from naive concatenation came from re-copying a *growing, shared* buffer on every append; nothing here is shared or growing, so there is nothing to re-copy.
:::
::::

## `Span<T>`: a view over memory, not a copy

A [`Span<T>`](https://learn.microsoft.com/en-us/dotnet/api/system.span-1) is two numbers: a reference to where its data starts, and a length. Slicing one — `span.Slice(3, 3)`, `span[3..6]` — produces another `Span<T>` with a different starting reference and length, aimed at the *same* underlying memory. Nothing is copied, so a write through a slice is a write to the original storage:

```csharp run id=pressure-view
double[] pressureReadings = [101.1, 101.3, 101.2, 118.9, 119.4, 119.1];

Span<double> lastThree = pressureReadings.AsSpan(3, 3);
Calibrate(lastThree, offset: -0.4);

Print(pressureReadings);

static void Calibrate(Span<double> readings, double offset)
{
    for (int i = 0; i < readings.Length; i++)
        readings[i] += offset;
}

static void Print(double[] values)
{
    for (int i = 0; i < values.Length; i++)
        Console.Write(i == 0 ? $"{values[i]:F1}" : $", {values[i]:F1}");
    Console.WriteLine();
}
```

```text output
101.1, 101.3, 101.2, 118.5, 119.0, 118.7
```

`lastThree` never owns any doubles; `AsSpan(3, 3)` hands back a span whose reference points at `pressureReadings[3]`. `Calibrate` writes through that reference, so the last three elements of `pressureReadings` itself drop by 0.4 — the same effect as writing `pressureReadings[3] -= 0.4;` three times, but expressed as one reusable method that has no idea whether the span it received is a slice of an array, a whole array, or something else entirely.

<figure class="diagram">
<svg viewBox="0 0 360 220" role="img" aria-labelledby="span-view-title span-view-desc">
<title id="span-view-title">A span pointing at the last three elements of an array</title>
<desc id="span-view-desc">Six numbered cells in a row represent an array. The last three are highlighted and a bracket below labels them as a span, drawn as a small box holding only a pointer and a length.</desc>
<defs>
<marker id="span-view-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-accent"/></marker>
</defs>
<text x="36" y="16" class="d-muted d-small">pressureReadings (double[6])</text>
<rect x="36" y="24" width="48" height="40" class="d-box"/><text x="60" y="49" text-anchor="middle" class="d-mono d-small">[0]</text>
<rect x="84" y="24" width="48" height="40" class="d-box"/><text x="108" y="49" text-anchor="middle" class="d-mono d-small">[1]</text>
<rect x="132" y="24" width="48" height="40" class="d-box"/><text x="156" y="49" text-anchor="middle" class="d-mono d-small">[2]</text>
<rect x="180" y="24" width="48" height="40" class="d-box-accent"/><text x="204" y="49" text-anchor="middle" class="d-mono d-small d-bold">[3]</text>
<rect x="228" y="24" width="48" height="40" class="d-box-accent"/><text x="252" y="49" text-anchor="middle" class="d-mono d-small d-bold">[4]</text>
<rect x="276" y="24" width="48" height="40" class="d-box-accent"/><text x="300" y="49" text-anchor="middle" class="d-mono d-small d-bold">[5]</text>
<path d="M180 72 H324 M180 72 V80 M324 72 V80" class="d-line"/>
<text x="252" y="96" text-anchor="middle" class="d-text-accent d-small">lastThree: AsSpan(3, 3)</text>
<path d="M252 100 V128" class="d-accent" marker-end="url(#span-view-arrow)"/>
<rect x="164" y="128" width="176" height="40" rx="6" class="d-box-2"/>
<text x="252" y="146" text-anchor="middle" class="d-mono d-small">pointer -&gt; index 3</text>
<text x="252" y="162" text-anchor="middle" class="d-mono d-small">length = 3</text>
<text x="36" y="190" class="d-muted d-small">Calibrate writes through that pointer,</text>
<text x="36" y="204" class="d-muted d-small">so the array itself changes.</text>
</svg>
<figcaption>Figure 1. lastThree is two numbers, a pointer and a length, aimed at the same memory as pressureReadings[3..5]; nothing is copied, so writing to the span writes to the array.</figcaption>
</figure>

::::exercise[Extend the code: slice from the other end]
`AsSpan(3, 3)` hardcodes the starting index. Rewrite the slice using the range syntax `pressureReadings.AsSpan()[^3..]` — read "the last three elements" — so the code no longer needs to know the array has six elements, and confirm the output is unchanged.

:::solution
```csharp run id=pressure-view-range
double[] pressureReadings = [101.1, 101.3, 101.2, 118.9, 119.4, 119.1];

Span<double> lastThree = pressureReadings.AsSpan()[^3..];
Calibrate(lastThree, offset: -0.4);

Print(pressureReadings);

static void Calibrate(Span<double> readings, double offset)
{
    for (int i = 0; i < readings.Length; i++)
        readings[i] += offset;
}

static void Print(double[] values)
{
    for (int i = 0; i < values.Length; i++)
        Console.Write(i == 0 ? $"{values[i]:F1}" : $", {values[i]:F1}");
    Console.WriteLine();
}
```

```text output
101.1, 101.3, 101.2, 118.5, 119.0, 118.7
```

`^3` means "3 from the end", so `[^3..]` reads as "from there to the end" regardless of the array's length. The output matches exactly, because `AsSpan()[^3..]` and `AsSpan(3, 3)` compute the same reference and the same length whenever the array has six elements; only `AsSpan(3, 3)` stops working if the array's length ever changes, since `3` would no longer name a position three elements from the end.
:::
::::

### Three places a span can point

Nothing above is specific to arrays. A `Span<T>` can be constructed over an array (`AsSpan()`), over the characters inside a `string` (implicitly, since [`string` converts to `ReadOnlySpan<char>`](https://learn.microsoft.com/en-us/dotnet/api/system.span-1) — this is what made `rest.IndexOf(',')` legal on a `string` earlier), or over memory that was never an object at all: a block the `stackalloc` operator carves directly out of the current stack frame. That third option is useful whenever the data is genuinely temporary and small enough for the stack — formatting a handful of digits without allocating a `string` for them at all:

```csharp run id=stackalloc-format
#:property Optimize=true

int[] quantities = [812, 4, 90210, 7];

Span<char> field = stackalloc char[5];
foreach (int v in quantities)
{
    field.Fill('0');
    v.TryFormat(field[^CountDigits(v)..], out _);
    Console.WriteLine(field.ToString());
}

Measure("ToString", () => FormatWithToString(quantities));
Measure("stackalloc", () => FormatWithStackalloc(quantities));

static int CountDigits(int v) =>
    v == 0 ? 1 : (int)Math.Floor(Math.Log10(v)) + 1;

static void Measure(string label, Action work)
{
    work(); // warm-up, not measured
    long before = GC.GetAllocatedBytesForCurrentThread();
    work();
    long bytes = GC.GetAllocatedBytesForCurrentThread() - before;
    Console.WriteLine($"{label,-11}{bytes,8:N0} B");
}

static void FormatWithToString(int[] values)
{
    foreach (int v in values)
        Consume(v.ToString().PadLeft(5, '0'));
}

static void FormatWithStackalloc(int[] values)
{
    Span<char> field = stackalloc char[5];
    foreach (int v in values)
    {
        field.Fill('0');
        v.TryFormat(field[^CountDigits(v)..], out _);
        Consume(field);
    }
}

static void Consume(ReadOnlySpan<char> field)
{
    if (field.Length == 0)
        throw new InvalidOperationException();
}
```

```text output
00812
00004
90210
00007
ToString        160 B
stackalloc        0 B
```

`v.TryFormat` writes the digits of `v` directly into `field`, right-aligned by slicing to `field[^CountDigits(v)..]` after first filling the whole field with `'0'`; nothing about that touches the heap. `FormatWithToString` allocates 160 bytes across the four values — a `ToString()` result plus a `PadLeft` result for each one — while `FormatWithStackalloc` allocates nothing at all, because `field` is five `char`s' worth of stack space that gets reused on every iteration.

:::pitfall
`stackalloc` inside a loop is a real trap if the `Span<char> field = stackalloc char[5];` line is moved *inside* the `foreach`: the compiler warns with `CA2014` ("move the stackalloc out of the loop"), because each iteration would carve out its own slice of stack space that only gets released when the whole method returns, not when the loop body ends. Declare the buffer once, outside the loop, and reuse it — exactly as `FormatWithStackalloc` does above.
:::

::::exercise[Prove it: allocation-free means allocation-free at any scale]
"Zero bytes" for four values could be an artifact of a small sample rather than a real property of the technique. Wrap `FormatWithStackalloc`'s work in a loop that runs it 100,000 times, and confirm the total allocation is still exactly zero — not just small.

:::solution
```csharp run id=prove-zero-alloc
#:property Optimize=true

const int Iterations = 100_000;
int[] quantities = [812, 4, 90210, 7];

long before = GC.GetAllocatedBytesForCurrentThread();
for (int i = 0; i < Iterations; i++)
    FormatAll(quantities);
long bytes = GC.GetAllocatedBytesForCurrentThread() - before;

Console.WriteLine($"{Iterations:N0} iterations: {bytes:N0} B");

static void FormatAll(int[] values)
{
    Span<char> field = stackalloc char[5];
    foreach (int v in values)
    {
        field.Fill('0');
        v.TryFormat(field[^CountDigits(v)..], out _);
    }
}

static int CountDigits(int v) =>
    v == 0 ? 1 : (int)Math.Floor(Math.Log10(v)) + 1;
```

```text output
100,000 iterations: 0 B
```

Zero stays zero at 100,000 iterations, because the stack space `stackalloc` uses is reused, not allocated fresh, on every call to `FormatAll`. That is a property of where the memory lives, not a coincidence of a small test.
:::
::::

## The `ref struct` guarantee, and the errors that enforce it

`Span<T>` is declared as [`public readonly ref struct Span<T>`](https://learn.microsoft.com/en-us/dotnet/api/system.span-1), and internally it holds a `ref T` field pointing at its data rather than a normal reference — the same mechanism the [C# reference for `ref struct` types](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/ref-struct) shows for writing a custom one. A `ref` field is only safe if the compiler can guarantee it never outlives whatever it points at: a `pressureReadings` array, or a `stackalloc` buffer that disappears the moment the current method returns. So `ref struct` types — `Span<T>`, `ReadOnlySpan<T>`, and any type you declare with the same modifier — come with restrictions whose entire purpose is to stop an instance from ever reaching somewhere that could outlive its target: the managed heap.

Three of those restrictions show up immediately if you try to make an `OrderLineCache` around the `rest` span from the very first example. Boxing a span to `object` fails to compile:

```csharp run error=CS0029
ReadOnlySpan<char> line = "SKU-1042,3,19.99";
object boxed = line;
```

So does capturing one inside a lambda, because a captured local becomes a field of a compiler-generated class:

```csharp run error=CS8175
ReadOnlySpan<char> line = "SKU-1042,3,19.99";
Action print = () => Console.WriteLine(line.Length);
print();
```

And so does simply declaring a span-typed field on an ordinary class, for the same reason — a class instance lives on the heap, and its fields have to be able to outlive any one method call:

```csharp run error=CS8345
var cache = new OrderLineCache();
Console.WriteLine(cache);

class OrderLineCache
{
    public ReadOnlySpan<char> Line;
}
```

Each of those is the compiler refusing a specific way for a `Span<T>` to end up on the heap: as a boxed `object`, as a closure field, or as an ordinary field. [The `Span<T>` documentation lists the same three cases](https://learn.microsoft.com/en-us/dotnet/api/system.span-1) — it "can't be boxed", "assigned to variables of type `Object`… or to any interface type", or used as "fields in a reference type" — plus a fourth restriction covered next. None of this is a compiler being overly cautious: if any of the three above were allowed, the reference inside the span could still be read long after the array or stack frame it pointed at was gone, corrupting memory rather than throwing an exception.

:::note
`ref struct` restrictions have loosened over time rather than stayed fixed. As of C# 13, a `ref struct` can implement an interface (subject to its own ref-safety rules) and can be used as a generic type argument when the type parameter opts in with `allows ref struct`. Before C# 13 neither was possible at all. The [`ref struct` types reference](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/ref-struct) documents exactly which C# version relaxed which rule — worth checking directly rather than assuming, since this is exactly the kind of detail that changes between releases.
:::

::::exercise[Find the bug: does `static` fix the field error?]
A colleague suggests fixing the `OrderLineCache` error above by making the field `static`, reasoning that a `static` field is not tied to any one instance's lifetime. Predict whether `public static ReadOnlySpan<char> Line;` compiles inside that same class, then check.

:::solution
```csharp run error=CS8345
var cache = new OrderLineCache();
Console.WriteLine(cache);

class OrderLineCache
{
    public static ReadOnlySpan<char> Line;
}
```

Still `CS8345`, with the same message: "unless it is an instance member of a ref struct". `static` changes *whose* field it is, not *what kind of type* it can hold — the restriction is about the field's declared type, `ReadOnlySpan<char>`, appearing anywhere except as an instance field of a `ref struct` itself. A field that really needs to hold onto span-like data across calls has to either change the field's type to `Memory<T>` (next section), or make the containing type itself a `ref struct` and accept that *it* now inherits every one of the same restrictions.
:::
::::

## Crossing an `await`: why `Span<T>` can't and `Memory<T>` can

The fourth restriction is the one that matters most for real code: a `Span<T>` — or any `ref struct` — [cannot be preserved across an `await` or `yield` boundary](https://learn.microsoft.com/en-us/dotnet/api/system.span-1). An `async` method that awaits is compiled into a state machine, and everything that needs to survive a suspension has to live in a field of that state machine — which, per the previous section, a `ref struct` can never do. Trying to keep a span alive across an `await` inside the same block confirms it directly:

```csharp run error=CS4007
async Task ReadFirstLineAsync(Stream source)
{
    byte[] buffer = new byte[64];
    int read = await source.ReadAsync(buffer);
    Span<byte> line = buffer.AsSpan(0, read);
    await Task.Delay(1);
    Console.WriteLine(line.Length);
}

await ReadFirstLineAsync(new MemoryStream());
```

[`Memory<T>` and `ReadOnlyMemory<T>` exist specifically for this case](https://learn.microsoft.com/en-us/dotnet/standard/memory-and-spans/memory-t-usage-guidelines): they are ordinary structs, not `ref struct`s, so they can live in a state machine's fields, be stored in a class, or sit on the heap indefinitely. The pattern that makes both worlds work together is: hold the buffer as `Memory<T>` across every `await`, and take a fresh `.Span` from it only for the synchronous stretch of code between one `await` and the next.

<figure class="diagram">
<svg viewBox="0 0 360 296" role="img" aria-labelledby="span-await-title span-await-desc">
<title id="span-await-title">A span cannot survive an await; a Memory buffer can</title>
<desc id="span-await-desc">A Memory buffer is read and a span is sliced from it and used, then execution suspends at an await. A fresh span is sliced from the same buffer after resuming, since the earlier span cannot be used across the gap.</desc>
<defs>
<marker id="span-await-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-accent"/></marker>
</defs>
<rect x="20" y="10" width="320" height="32" rx="6" class="d-box-accent"/>
<text x="180" y="31" text-anchor="middle" class="d-mono d-small">Memory&lt;byte&gt; buffer</text>
<path d="M180 42 V62" class="d-accent" marker-end="url(#span-await-arrow)"/>
<rect x="20" y="66" width="320" height="32" rx="6" class="d-box"/>
<text x="180" y="87" text-anchor="middle" class="d-mono d-small">Span&lt;byte&gt; chunk = buffer.Span[..n]</text>
<text x="20" y="112" class="d-muted d-small">used only in this synchronous stretch</text>
<path d="M20 128 H340" class="d-line d-dashed"/>
<text x="180" y="146" text-anchor="middle" class="d-text-bad d-small">await source.ReadAsync(buffer)</text>
<text x="180" y="160" text-anchor="middle" class="d-text-bad d-small">chunk above: CS4007 if read past here</text>
<rect x="20" y="176" width="320" height="32" rx="6" class="d-box-accent"/>
<text x="180" y="197" text-anchor="middle" class="d-mono d-small">Memory&lt;byte&gt; buffer (same instance)</text>
<path d="M180 208 V228" class="d-accent" marker-end="url(#span-await-arrow)"/>
<rect x="20" y="232" width="320" height="32" rx="6" class="d-box"/>
<text x="180" y="253" text-anchor="middle" class="d-mono d-small">Span&lt;byte&gt; chunk = buffer.Span[..n]</text>
<text x="20" y="278" class="d-muted d-small">a fresh slice; the old chunk is gone</text>
</svg>
<figcaption>Figure 2. Memory&lt;byte&gt; survives the await because it is not a ref struct; a Span&lt;byte&gt; taken from it must be re-sliced after every resume.</figcaption>
</figure>

### Choosing between the two, before async even comes up

`SumQuantitiesAsync` above needs `Memory<byte>` for its field, but every *helper* it could call — a function that just reads a chunk and reports a count, say — should still take `Span<byte>` or `ReadOnlySpan<byte>` as a parameter, not `Memory<byte>`, even though a `Memory<byte>` converts to a `Span<byte>` for free through its `.Span` property. [Microsoft's own guidance states this as its first rule](https://learn.microsoft.com/en-us/dotnet/standard/memory-and-spans/memory-t-usage-guidelines): prefer `Span<T>` for a synchronous parameter, because it "is more versatile than `Memory<T>`" — it can wrap an array, a string, or a `stackalloc` buffer, none of which `Memory<T>` can point at — and it lets the compiler check the parameter is never used past the call it was passed into, which is exactly the safety property this whole section has been about. `Memory<T>` earns its place only where a `Span<T>` could not legally go: a field, a property, or an argument that has to be read again after an `await`. The second rule is about mutability rather than lifetime: [use `ReadOnlySpan<T>` or `ReadOnlyMemory<T>` whenever the callee only reads the buffer](https://learn.microsoft.com/en-us/dotnet/standard/memory-and-spans/memory-t-usage-guidelines), the way `Utf8Parser.TryParse` below takes a `ReadOnlySpan<byte>` rather than a `Span<byte>` — it has no business writing into the digits it is parsing, and the type signature says so.

Applied to the order-line example, reading from a [`Stream` asynchronously into a `Memory<byte>`](https://learn.microsoft.com/en-us/dotnet/api/system.io.stream.readasync) and slicing a fresh `Span<byte>` per chunk gives an allocation-free async parser: [`Utf8Parser.TryParse`](https://learn.microsoft.com/en-us/dotnet/api/system.buffers.text.utf8parser.tryparse) reads an integer straight out of a `ReadOnlySpan<byte>`, so the quantity field never needs to become a `string` either:

```csharp run id=async-order-lines
using System.Buffers.Text;
using System.Text;

string text = "SKU-1042,3,19.99\nSKU-1090,1,19.99\n";
byte[] source = Encoding.ASCII.GetBytes(text);
using var stream = new MemoryStream(source);

int total = await SumQuantitiesAsync(stream);
Console.WriteLine($"total quantity: {total}");

static async Task<int> SumQuantitiesAsync(Stream source)
{
    Memory<byte> buffer = new byte[64];
    int total = 0;
    int bytesRead;
    while ((bytesRead = await source.ReadAsync(buffer)) > 0)
    {
        Span<byte> chunk = buffer.Span[..bytesRead];
        foreach (Range r in chunk.Split((byte)'\n'))
        {
            Span<byte> line = chunk[r];
            if (line.IsEmpty) continue;

            int comma1 = line.IndexOf((byte)',');
            Span<byte> rest = line[(comma1 + 1)..];
            int comma2 = rest.IndexOf((byte)',');

            Utf8Parser.TryParse(rest[..comma2], out int qty, out _);
            total += qty;
        }
    }
    return total;
}
```

```text output
total quantity: 4
```

`buffer` is a `Memory<byte>` field of the async state machine, so it survives every `await source.ReadAsync(buffer)`. `chunk`, `line` and `rest` are all `Span<byte>` locals created fresh after each read completes, used entirely within that iteration of the `while` loop, and never referenced again once the loop goes back around to `await`. [`ReadOnlySpan<T>.Split`](https://learn.microsoft.com/en-us/dotnet/api/system.memoryextensions.split), added in .NET 9, splits on a separator without allocating an array of substrings — it hands back `Range` values into the same chunk, which is what makes `chunk[r]` a slice rather than a copy.

::::exercise[Predict the output: what happens with a small buffer?]
`SumQuantitiesAsync` above reads into a 64-byte buffer, comfortably larger than either line. Suppose it were parameterized to accept a buffer size, and called with `bufferSize: 9` against the same two-line input. Nine bytes is not enough to hold even the first line (`"SKU-1042,"` is already 9 characters). Predict what `total` prints — a compile error, a thrown exception, the correct total, or something else — then run it.

:::solution
```csharp run id=async-order-lines-small-buffer
using System.Buffers.Text;
using System.Text;

string text = "SKU-1042,3,19.99\nSKU-1090,1,19.99\n";
byte[] source = Encoding.ASCII.GetBytes(text);
using var stream = new MemoryStream(source);

int total = await SumQuantitiesAsync(stream, bufferSize: 9);
Console.WriteLine($"total quantity: {total}");

static async Task<int> SumQuantitiesAsync(Stream source, int bufferSize)
{
    Memory<byte> buffer = new byte[bufferSize];
    int total = 0;
    int bytesRead;
    while ((bytesRead = await source.ReadAsync(buffer)) > 0)
    {
        Span<byte> chunk = buffer.Span[..bytesRead];
        foreach (Range r in chunk.Split((byte)'\n'))
        {
            Span<byte> line = chunk[r];
            if (line.IsEmpty) continue;

            int comma1 = line.IndexOf((byte)',');
            if (comma1 < 0) continue;
            Span<byte> rest = line[(comma1 + 1)..];
            int comma2 = rest.IndexOf((byte)',');
            if (comma2 < 0) continue;

            Utf8Parser.TryParse(rest[..comma2], out int qty, out _);
            total += qty;
        }
    }
    return total;
}
```

```text output
total quantity: 0
```

It compiles, runs, and silently produces the wrong answer: `0` instead of `4`. With a 9-byte buffer, the first read returns `"SKU-1042,"` with no `\n` in it, so `chunk.Split` yields one "line" that is really just a line fragment; its only comma sits at the very end, `rest` after that comma is empty, and the guard clause skips it rather than throwing. The next read starts mid-line at `"3,19.99\nS"`, and the code treats `"3,19.99"` as if it were a whole `sku,qty,price` record, so its first field (`"3"`) is mistaken for a SKU rather than a quantity, and that guess fails too. Nothing here is a `Span<T>` or `Memory<T>` bug — every span is used within its own valid lifetime — it is a protocol bug: chunk-by-chunk parsing that assumes each chunk starts at a line boundary breaks the moment a real line spans two reads. Production code that cannot guarantee the buffer is always bigger than any line needs to carry unconsumed bytes over to the next read, which is exactly the problem [`System.IO.Pipelines`](https://learn.microsoft.com/en-us/dotnet/standard/io/pipelines) solves: its own documentation names "the entire message might not be received in a single call to `ReadAsync`" as the first problem a hand-rolled buffer loop like this one runs into.
:::
::::

Span-based parsing and `Memory<T>`-based buffering are not a replacement for careful protocol handling; they remove the allocation cost, not the responsibility for knowing where one record ends and the next begins.
