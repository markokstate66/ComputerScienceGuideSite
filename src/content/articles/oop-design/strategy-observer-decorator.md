---
title: "Three Patterns You Already Use: Strategy, Observer, Decorator"
description: "IComparer<T>, C# events and GZipStream already implement Strategy, Observer and Decorator; this finds each in the BCL, then builds it by hand."
pillar: oop-design
order: 5
author: markus
published: 2026-09-22
updated: 2026-09-22
level: intermediate
tags: [design-patterns, oop, delegates, events, streams]
prerequisites: ["oop-design/interfaces-vs-abstract-classes"]
sources:
  - title: "IComparer<T> Interface"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.icomparer-1"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "List<T>.Sort Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.list-1.sort"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Comparer<T>.Create(Comparison<T>) Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.comparer-1.create"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Handling and raising events"
    url: "https://learn.microsoft.com/en-us/dotnet/standard/events/"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "IObservable<T> Interface"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.iobservable-1"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Observer design pattern - .NET"
    url: "https://learn.microsoft.com/en-us/dotnet/standard/events/observer-design-pattern"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "GZipStream Class"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.io.compression.gzipstream"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "BufferedStream Class"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.io.bufferedstream"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Stream Class"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.io.stream"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Design Patterns: Elements of Reusable Object-Oriented Software, chapters 4 (Structural Patterns) and 5 (Behavioral Patterns)"
    url: "https://www.pearson.com/en-us/subject-catalog/p/design-patterns-elements-of-reusable-object-oriented-software/P200000009480"
    publisher: "Addison-Wesley, 1994; publisher record, cited by chapter"
    accessed: 2026-09-22
draft: true
---

A custom `IComparer<T>` passed to `List<T>.Sort`, a C# `event` with two independent subscribers, and a `GZipStream` wrapped around a `MemoryStream` are not analogies for Strategy, Observer and Decorator — they are those patterns, already compiled into the base class library. This article opens each one where it already lives, names the pattern, and then builds a minimal version by hand so the mechanism behind the convenient syntax is visible.

## Strategy: the algorithm behind `IComparer<T>`

`List<T>.Sort` has an overload that takes an `IComparer<T>`: an object whose one method, `Compare`, decides the order of two elements[[1]](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.icomparer-1). Below, `ByDepartmentThenSalaryDesc` groups a staff list by department, then breaks ties within a department by salary, highest first.

The programs on this page are complete file-based C# apps, compiled and run with `dotnet run` on .NET 10.0.401, Windows 11, x64.

```csharp run id=employee-sort-bcl
List<Employee> staff =
[
    new("Priya", "Engineering", 96000m),
    new("Marcus", "Sales", 71000m),
    new("Diego", "Engineering", 104000m),
    new("Ada", "Sales", 88000m),
    new("Wen", "Engineering", 99000m),
];

staff.Sort(new ByDepartmentThenSalaryDesc());
foreach (var e in staff)
    Console.WriteLine($"{e.Department,-12}{e.Name,-8}{e.Salary,8:C0}");

record Employee(string Name, string Department, decimal Salary);

sealed class ByDepartmentThenSalaryDesc : IComparer<Employee>
{
    public int Compare(Employee? x, Employee? y)
    {
        ArgumentNullException.ThrowIfNull(x);
        ArgumentNullException.ThrowIfNull(y);
        int byDept = string.Compare(
            x.Department, y.Department, StringComparison.Ordinal);
        return byDept != 0 ? byDept : y.Salary.CompareTo(x.Salary);
    }
}
```

```text output
Engineering Diego   $104,000
Engineering Wen      $99,000
Engineering Priya    $96,000
Sales       Ada      $88,000
Sales       Marcus   $71,000
```

`staff.Sort` contains no `if` about departments or salaries; every ordering decision lives inside `ByDepartmentThenSalaryDesc.Compare`. `List<T>.Sort`'s `IComparer<T>` overload runs an introspective sort — insertion sort for small partitions, otherwise heapsort or quicksort — in O(n log n) time, and documents itself as an *unstable* sort: "if two elements are equal, their order might not be preserved"[[2]](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.list-1.sort). That is one reason the list above has no two employees tied on both department and salary; the exercise later in this section comes back to what would happen if it did.

`ByDepartmentThenSalaryDesc` is Strategy: an algorithm that varies — here, how to order two elements — sits behind a stable interface, so the code that calls it (`staff.Sort`) depends only on that interface. Gamma, Helm, Johnson and Vlissides catalogue this shape as Strategy, one of the behavioral patterns in *Design Patterns*[[10]](https://www.pearson.com/en-us/subject-catalog/p/design-patterns-elements-of-reusable-object-oriented-software/P200000009480).

### Building the same strategy by hand

`List<T>.Sort` hides where `Compare` actually gets called. Writing a minimal sort by hand makes it visible: `InsertionSort<T>` below takes the same `IComparer<T>` and calls it exactly where a decision is needed.

```csharp run id=employee-sort-insertion
List<Employee> staff =
[
    new("Priya", "Engineering", 96000m),
    new("Marcus", "Sales", 71000m),
    new("Diego", "Engineering", 104000m),
    new("Ada", "Sales", 88000m),
    new("Wen", "Engineering", 99000m),
];

InsertionSort(staff, new ByDepartmentThenSalaryDesc());
foreach (var e in staff)
    Console.WriteLine($"{e.Department,-12}{e.Name,-8}{e.Salary,8:C0}");

static void InsertionSort<T>(List<T> items, IComparer<T> comparer)
{
    for (int i = 1; i < items.Count; i++)
    {
        T key = items[i];
        int j = i - 1;
        while (j >= 0 && comparer.Compare(items[j], key) > 0)
        {
            items[j + 1] = items[j];
            j--;
        }
        items[j + 1] = key;
    }
}

record Employee(string Name, string Department, decimal Salary);

sealed class ByDepartmentThenSalaryDesc : IComparer<Employee>
{
    public int Compare(Employee? x, Employee? y)
    {
        ArgumentNullException.ThrowIfNull(x);
        ArgumentNullException.ThrowIfNull(y);
        int byDept = string.Compare(
            x.Department, y.Department, StringComparison.Ordinal);
        return byDept != 0 ? byDept : y.Salary.CompareTo(x.Salary);
    }
}
```

```text output
Engineering Diego   $104,000
Engineering Wen      $99,000
Engineering Priya    $96,000
Sales       Ada      $88,000
Sales       Marcus   $71,000
```

`InsertionSort<T>` never mentions `Employee`, `Department`, or `Salary`; every ordering decision funnels through `comparer.Compare(items[j], key)`. It also has a different cost profile than `List<T>.Sort`: O(n²) comparisons in the worst case rather than O(n log n), but it only moves an element when the comparer says it is strictly greater (`> 0`), never when the two compare equal — so two tied elements are never swapped past each other. Unlike `List<T>.Sort`, this hand-rolled version is stable. That guarantee is exactly the freedom `List<T>.Sort` keeps for itself by staying unstable, traded away here for O(n log n).

### A strategy that isn't about ordering

Strategy is not only for comparisons. `Report` below holds an `IEmployeeFormatter` and knows nothing about commas or column widths; each formatter is free to lay the same data out differently.

```csharp run id=employee-report-formats
List<Employee> staff =
[
    new("Priya", "Engineering", 96000m),
    new("Diego", "Engineering", 104000m),
];

Report csv = new(new CsvFormatter());
Report plain = new(new PlainTextFormatter());

Console.WriteLine(csv.Render(staff));
Console.WriteLine(plain.Render(staff));

record Employee(string Name, string Department, decimal Salary);

interface IEmployeeFormatter
{
    string Format(IEnumerable<Employee> employees);
}

sealed class CsvFormatter : IEmployeeFormatter
{
    public string Format(IEnumerable<Employee> employees)
        => string.Join('\n',
            employees.Select(e => $"{e.Name},{e.Department},{e.Salary}"));
}

sealed class PlainTextFormatter : IEmployeeFormatter
{
    public string Format(IEnumerable<Employee> employees)
        => string.Join('\n',
            employees.Select(e => $"{e.Name,-6}{e.Salary,8:C0}"));
}

sealed class Report(IEmployeeFormatter formatter)
{
    public string Render(IEnumerable<Employee> employees)
        => formatter.Format(employees);
}
```

```text output
Priya,Engineering,96000
Diego,Engineering,104000
Priya  $96,000
Diego $104,000
```

`Report.Render` calls `formatter.Format` and nothing else; swapping `CsvFormatter` for `PlainTextFormatter` changes the output without changing `Report`.

## Delegates as a lighter Strategy

Every strategy above is a single-method interface implemented by a class whose only job is to hold that one method. C# has a lighter tool for exactly that shape: a delegate. `Render` below takes a `Func<IEnumerable<Employee>, string>` directly, and no class named `CsvFormatter` needs to exist for this call site.

```csharp run id=employee-report-lambda
List<Employee> staff =
[
    new("Priya", "Engineering", 96000m),
    new("Diego", "Engineering", 104000m),
];

Func<IEnumerable<Employee>, string> csv = employees
    => string.Join('\n',
        employees.Select(e => $"{e.Name},{e.Department},{e.Salary}"));

Console.WriteLine(Render(staff, csv));

static string Render(
    IEnumerable<Employee> employees,
    Func<IEnumerable<Employee>, string> format)
    => format(employees);

record Employee(string Name, string Department, decimal Salary);
```

```text output
Priya,Engineering,96000
Diego,Engineering,104000
```

`List<T>.Sort` has offered the same option for comparisons from the start: pass a `Comparison<T>` delegate instead of building an `IComparer<T>` class[[2]](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.list-1.sort).

```csharp run id=employee-sort-comparison
List<Employee> staff =
[
    new("Priya", "Engineering", 96000m),
    new("Marcus", "Sales", 71000m),
    new("Diego", "Engineering", 104000m),
    new("Ada", "Sales", 88000m),
    new("Wen", "Engineering", 99000m),
];

staff.Sort((x, y) =>
{
    int byDept = string.Compare(
        x.Department, y.Department, StringComparison.Ordinal);
    return byDept != 0 ? byDept : y.Salary.CompareTo(x.Salary);
});

foreach (var e in staff)
    Console.WriteLine($"{e.Department,-12}{e.Name,-8}{e.Salary,8:C0}");

record Employee(string Name, string Department, decimal Salary);
```

```text output
Engineering Diego   $104,000
Engineering Wen      $99,000
Engineering Priya    $96,000
Sales       Ada      $88,000
Sales       Marcus   $71,000
```

Same ordering, no `ByDepartmentThenSalaryDesc` class.

:::dotnet
The BCL bridges the two forms in the other direction too: `Comparer<T>.Create(Comparison<T>)` wraps a delegate back into a real `IComparer<T>`, for the rarer API that insists on the interface rather than the delegate[[3]](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.comparer-1.create).
:::

A delegate is enough when the strategy is one operation, decided at the call site, with nothing beyond what the lambda captures. Reach for a class instead once the strategy needs more than one related member, needs to be constructed once with configuration and reused across many calls, or needs to be a named type a unit test can substitute — a `Func<IEnumerable<Employee>, string>` field is much harder to tell apart from any other field of the same delegate type than a named class is from another named class.

::::exercise[Explain the tie]
`staff` above has no two employees tied on both department and salary. Suppose it did — two Engineering employees both earning exactly $99,000. Would `staff.Sort(new ByDepartmentThenSalaryDesc())` necessarily print them in the same relative order as the source list? Would `InsertionSort(staff, new ByDepartmentThenSalaryDesc())`?

:::solution
No for `Sort`, yes for `InsertionSort`. `List<T>.Sort` documents itself as an unstable sort: "if two elements are equal, their order might not be preserved"[[2]](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.list-1.sort). `Compare` returning `0` for the two tied employees tells `Sort` they are interchangeable, and the underlying introspective sort is free to leave them in either order. `InsertionSort` above only moves an element when `comparer.Compare(items[j], key) > 0` — strictly greater — so two elements that compare equal are never swapped past each other, and their source order survives. That guarantee is the reason a stable sort can cost more: the algorithm gives up some freedom to reorder in exchange for predictability.
:::
::::

## Observer: what happens when an event fires

A C# `event` is not similar to Observer; Microsoft's own documentation states the relationship directly: "Events in .NET are based on the delegate model. The delegate model follows the observer design pattern"[[4]](https://learn.microsoft.com/en-us/dotnet/standard/events/). Below, `PriceFeed` raises `PriceChanged` whenever `Publish` runs, and two independent subscribers react to it without knowing about each other.

```csharp run id=pricefeed-events
var feed = new PriceFeed();

feed.PriceChanged += (sender, e)
    => Console.WriteLine($"log:   {e.Symbol} -> {e.Price:C2}");
feed.PriceChanged += (sender, e) =>
{
    if (e.Price > 100m)
        Console.WriteLine($"alert: {e.Symbol} above 100");
};

feed.Publish("ACME", 95.50m);
feed.Publish("ACME", 101.25m);

sealed class PriceFeed
{
    public event EventHandler<PriceChangedEventArgs>? PriceChanged;

    public void Publish(string symbol, decimal price)
        => PriceChanged?.Invoke(
            this, new PriceChangedEventArgs(symbol, price));
}

sealed class PriceChangedEventArgs(string symbol, decimal price)
    : EventArgs
{
    public string Symbol { get; } = symbol;
    public decimal Price { get; } = price;
}
```

```text output
log:   ACME -> $95.50
log:   ACME -> $101.25
alert: ACME above 100
```

Neither subscriber calls the other, and `PriceFeed` calls neither by name — `+=` added each one to `PriceChanged`'s invocation list, and `PriceChanged?.Invoke` fires every delegate on that list. In this run, the log line for the second `Publish` call appears before the alert line because the logging handler was subscribed first.

### The formal shape events hide: `IObservable<T>` and `IObserver<T>`

.NET also has an explicit pair of interfaces for this same shape. Their own remarks describe them as "a generalized mechanism for push-based notification, also known as the observer design pattern"[[5]](https://learn.microsoft.com/en-us/dotnet/api/system.iobservable-1). Implementing the pattern this way means supplying, by hand, the pieces C#'s `event` keyword normally generates: a provider that implements `Subscribe`, a container for observers, and an `IDisposable` that lets an observer unsubscribe[[6]](https://learn.microsoft.com/en-us/dotnet/standard/events/observer-design-pattern). `SensorHub` below is a minimal version of all three.

```csharp run id=sensor-observable
var hub = new SensorHub();

var display = new ConsoleDisplay();
var threshold = new ThresholdAlert(limit: 30);

using var sub1 = hub.Subscribe(display);
using (hub.Subscribe(threshold))
{
    hub.Publish(22.5);
    hub.Publish(31.0);
}
hub.Publish(40.0);

sealed class SensorHub : IObservable<double>
{
    private readonly List<IObserver<double>> _observers = [];

    public IDisposable Subscribe(IObserver<double> observer)
    {
        _observers.Add(observer);
        return new Unsubscriber(_observers, observer);
    }

    public void Publish(double reading)
    {
        foreach (var observer in _observers.ToArray())
            observer.OnNext(reading);
    }

    private sealed class Unsubscriber(
        List<IObserver<double>> observers,
        IObserver<double> observer) : IDisposable
    {
        public void Dispose() => observers.Remove(observer);
    }
}

sealed class ConsoleDisplay : IObserver<double>
{
    public void OnNext(double value)
        => Console.WriteLine($"display: {value:F1}");
    public void OnError(Exception error) { }
    public void OnCompleted() { }
}

sealed class ThresholdAlert(double limit) : IObserver<double>
{
    public void OnNext(double value)
    {
        if (value > limit)
            Console.WriteLine(
                $"alert:   {value:F1} exceeds {limit:F1}");
    }
    public void OnError(Exception error) { }
    public void OnCompleted() { }
}
```

```text output
display: 22.5
display: 31.0
alert:   31.0 exceeds 30.0
display: 40.0
```

`display` receives every reading. `threshold` only prints once a reading exceeds its limit, and stops being called at all once the `using` block disposes its subscription — the same `IDisposable`-based unsubscribe the observer design pattern specifies[[6]](https://learn.microsoft.com/en-us/dotnet/standard/events/observer-design-pattern): `40.0` reaches `display` alone.

:::pitfall
`Publish` iterates `_observers.ToArray()`, not `_observers` itself. If an observer's own `OnNext` calls back into `Subscribe`, or disposes its own subscription mid-notification, mutating `_observers` during a `foreach` over it throws `InvalidOperationException`. Microsoft's own `IObservable<T>` sample takes the same precaution, snapshotting the observer collection before notifying, for the identical reason[[6]](https://learn.microsoft.com/en-us/dotnet/standard/events/observer-design-pattern).
:::

<figure class="diagram">
<svg viewBox="0 0 360 260" role="img" aria-labelledby="obs-fanout-title obs-fanout-desc">
<title id="obs-fanout-title">SensorHub fanning notifications out to two observers</title>
<desc id="obs-fanout-desc">SensorHub, an IObservable of double, sends arrows down to two observer boxes, ConsoleDisplay and ThresholdAlert. Text underneath explains that Publish calls OnNext on every current observer in turn, and that disposing a subscription removes only that one observer.</desc>
<defs>
<marker id="obs-fanout-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-accent"/></marker>
</defs>
<rect x="100" y="10" width="160" height="52" rx="8" class="d-box-accent"/>
<text x="180" y="32" text-anchor="middle" class="d-bold">SensorHub</text>
<text x="180" y="50" text-anchor="middle" class="d-small d-mono d-muted">IObservable&lt;double&gt;</text>
<path d="M150 62 L95 108" class="d-accent" marker-end="url(#obs-fanout-arrow)"/>
<path d="M210 62 L268 108" class="d-accent" marker-end="url(#obs-fanout-arrow)"/>
<rect x="15" y="112" width="155" height="58" rx="8" class="d-box"/>
<text x="92" y="134" text-anchor="middle" class="d-bold d-small">ConsoleDisplay</text>
<text x="92" y="152" text-anchor="middle" class="d-small d-muted">OnNext -&gt; print</text>
<rect x="190" y="112" width="155" height="58" rx="8" class="d-box"/>
<text x="267" y="134" text-anchor="middle" class="d-bold d-small">ThresholdAlert</text>
<text x="267" y="150" text-anchor="middle" class="d-small d-muted">OnNext -&gt;</text>
<text x="267" y="164" text-anchor="middle" class="d-small d-muted">alert if over limit</text>
<text x="20" y="200" class="d-small d-muted">Publish() calls OnNext on every</text>
<text x="20" y="214" class="d-small d-muted">current observer, in turn.</text>
<text x="20" y="232" class="d-small d-muted">Disposing what Subscribe() returned</text>
<text x="20" y="246" class="d-small d-muted">removes just that one observer.</text>
</svg>
<figcaption>Figure 1. SensorHub notifies every current observer in turn; ThresholdAlert stops receiving readings once its subscription is disposed, while ConsoleDisplay keeps receiving them.</figcaption>
</figure>

::::exercise[Add a self-unsubscribing observer]
Write `LimitedObserver<T>`, an `IObserver<T>` that wraps another `IObserver<T>`, forwards the first `maxNotifications` calls to `OnNext`, and then disposes its own subscription (stored in a settable `Subscription` property, the `IDisposable` `SensorHub.Subscribe` returns) so it stops receiving readings without `SensorHub` needing any special case for it.

:::solution
```csharp run id=limited-observer
var hub = new SensorHub();
var display = new ConsoleDisplay();
var limited = new LimitedObserver<double>(display, maxNotifications: 2);
limited.Subscription = hub.Subscribe(limited);

hub.Publish(10.0);
hub.Publish(20.0);
hub.Publish(30.0);

sealed class LimitedObserver<T>(
    IObserver<T> inner, int maxNotifications) : IObserver<T>
{
    private int _count;
    public IDisposable? Subscription { get; set; }

    public void OnNext(T value)
    {
        inner.OnNext(value);
        _count++;
        if (_count >= maxNotifications)
            Subscription?.Dispose();
    }
    public void OnError(Exception error) => inner.OnError(error);
    public void OnCompleted() => inner.OnCompleted();
}

sealed class ConsoleDisplay : IObserver<double>
{
    public void OnNext(double value)
        => Console.WriteLine($"display: {value:F1}");
    public void OnError(Exception error) { }
    public void OnCompleted() { }
}

sealed class SensorHub : IObservable<double>
{
    private readonly List<IObserver<double>> _observers = [];
    public IDisposable Subscribe(IObserver<double> observer)
    {
        _observers.Add(observer);
        return new Unsubscriber(_observers, observer);
    }
    public void Publish(double reading)
    {
        foreach (var observer in _observers.ToArray())
            observer.OnNext(reading);
    }
    private sealed class Unsubscriber(
        List<IObserver<double>> observers,
        IObserver<double> observer) : IDisposable
    {
        public void Dispose() => observers.Remove(observer);
    }
}
```

```text output
display: 10.0
display: 20.0
```

`limited` disposes its own subscription inside `OnNext`, right after forwarding the second reading, so `SensorHub` has already removed it from `_observers` before `Publish(30.0)` runs — nothing prints for the third reading.
:::
::::

## Decorator: streams wrapping streams

`GZipStream` and `BufferedStream` both inherit directly from the same abstract `System.IO.Stream`[[9]](https://learn.microsoft.com/en-us/dotnet/api/system.io.stream); neither is a special case wired into the base class. `GZipStream` compresses or decompresses on top of whatever stream it is given[[7]](https://learn.microsoft.com/en-us/dotnet/api/system.io.compression.gzipstream), and `BufferedStream` "can be composed around certain types of streams" to add buffering to one that doesn't already have it[[8]](https://learn.microsoft.com/en-us/dotnet/api/system.io.bufferedstream). Both are ordinary `Stream` subclasses that hold another `Stream` and forward most calls to it.

```csharp run id=buffered-basic
var raw = new MemoryStream();
long lengthAfterWrite;
using (var buffered = new BufferedStream(raw, bufferSize: 128))
{
    var bytes = "hello, buffered stream"u8.ToArray();
    buffered.Write(bytes);
    buffered.Flush();
    lengthAfterWrite = raw.Length;
}
Console.WriteLine(
    $"bytes now in the underlying stream: {lengthAfterWrite}");
```

```text output
bytes now in the underlying stream: 22
```

`buffered.Write` did not necessarily touch `raw` at all until `Flush` ran — `BufferedStream` is "designed to prevent the buffer from slowing down input and output when the buffer is not needed"[[8]](https://learn.microsoft.com/en-us/dotnet/api/system.io.bufferedstream), holding writes in memory and forwarding them to `raw` in one batch. `GZipStream` composes the same way, wrapping a `MemoryStream` to compress text written through it:

```csharp run id=gzip-roundtrip
using System.IO.Compression;

string text = string.Concat(
    Enumerable.Repeat("the quick brown fox jumps over the lazy dog. ", 20));

var raw = new MemoryStream();
using (var gzip = new GZipStream(
    raw, CompressionMode.Compress, leaveOpen: true))
using (var writer = new StreamWriter(gzip))
    writer.Write(text);

byte[] compressed = raw.ToArray();
Console.WriteLine($"original:   {text.Length} chars");
Console.WriteLine($"compressed: {compressed.Length} bytes");

using var compressedStream = new MemoryStream(compressed);
using var gunzip = new GZipStream(
    compressedStream, CompressionMode.Decompress);
using var reader = new StreamReader(gunzip);
string roundTrip = reader.ReadToEnd();

Console.WriteLine(
    $"round-trip matches original: {roundTrip == text}");
```

```text output
original:   900 chars
compressed: 83 bytes
round-trip matches original: True
```

Twenty repeats of the same sentence compress well because they repeat; the `GZipStream` docs are explicit that this only holds for uncompressed input — feeding it data that is already compressed "may actually increase the size of the stream"[[7]](https://learn.microsoft.com/en-us/dotnet/api/system.io.compression.gzipstream). `StreamWriter` wraps `gzip`, which wraps `raw`: three layers, each adding one capability (text encoding, then compression, then storage) without any layer knowing what is above or below it. Gamma, Helm, Johnson and Vlissides catalogue this shape as Decorator, one of the structural patterns in the same book[[10]](https://www.pearson.com/en-us/subject-catalog/p/design-patterns-elements-of-reusable-object-oriented-software/P200000009480): attach a capability by wrapping an object in another object of the same base type, rather than subclassing every combination of capabilities directly.

<figure class="diagram">
<svg viewBox="0 0 360 350" role="img" aria-labelledby="dec-chain-title dec-chain-desc">
<title id="dec-chain-title">Four stream layers stacked from StreamWriter down to MemoryStream</title>
<desc id="dec-chain-desc">StreamWriter wraps GZipStream, which wraps a hand-built CountingStream, which wraps MemoryStream. An arrow points down from each layer to the next, showing data flowing from text at the top to stored compressed bytes at the bottom.</desc>
<defs>
<marker id="dec-chain-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-stroke"/></marker>
</defs>
<rect x="40" y="10" width="280" height="56" rx="8" class="d-box"/>
<text x="180" y="32" text-anchor="middle" class="d-bold">StreamWriter</text>
<text x="180" y="50" text-anchor="middle" class="d-small d-muted">text -&gt; bytes</text>
<path d="M180 66 V96" class="d-line" marker-end="url(#dec-chain-arrow)"/>
<rect x="40" y="100" width="280" height="56" rx="8" class="d-box"/>
<text x="180" y="122" text-anchor="middle" class="d-bold">GZipStream</text>
<text x="180" y="140" text-anchor="middle" class="d-small d-muted">bytes -&gt; compressed bytes</text>
<path d="M180 156 V186" class="d-line" marker-end="url(#dec-chain-arrow)"/>
<rect x="40" y="190" width="280" height="56" rx="8" class="d-box-accent"/>
<text x="180" y="212" text-anchor="middle" class="d-bold">CountingStream (ours)</text>
<text x="180" y="230" text-anchor="middle" class="d-small d-muted">counts bytes, forwards unchanged</text>
<path d="M180 246 V276" class="d-line" marker-end="url(#dec-chain-arrow)"/>
<rect x="40" y="280" width="280" height="56" rx="8" class="d-box"/>
<text x="180" y="302" text-anchor="middle" class="d-bold">MemoryStream</text>
<text x="180" y="320" text-anchor="middle" class="d-small d-muted">stores the compressed bytes</text>
</svg>
<figcaption>Figure 2. Each wrapper adds one capability and forwards the rest of the call to the stream underneath it; CountingStream sits between GZipStream and MemoryStream without either one knowing it is there.</figcaption>
</figure>

### Building your own decorator

`Stream`'s own documentation lists exactly which members a subclass must supply: `CanRead`, `CanSeek`, `CanWrite`, `Length`, `Position`, `Read`, `Write`, `Flush`, `Seek` and `SetLength`[[9]](https://learn.microsoft.com/en-us/dotnet/api/system.io.stream). `CountingStream` below implements all of them by forwarding to an inner stream, and adds one thing neither `GZipStream` nor `BufferedStream` does: a running count of the bytes that actually crossed it.

```csharp run id=counting-stream
using System.IO.Compression;

string text = string.Concat(
    Enumerable.Repeat("the quick brown fox jumps over the lazy dog. ", 20));

var raw = new MemoryStream();
var counting = new CountingStream(raw);

using (var gzip = new GZipStream(
    counting, CompressionMode.Compress, leaveOpen: true))
using (var writer = new StreamWriter(gzip))
    writer.Write(text);

Console.WriteLine(
    $"bytes counting saw written: {counting.BytesWritten}");
Console.WriteLine(
    $"underlying MemoryStream length: {raw.Length}");

counting.Position = 0;
using (var gunzip = new GZipStream(
    counting, CompressionMode.Decompress))
using (var reader = new StreamReader(gunzip))
{
    string roundTrip = reader.ReadToEnd();
    Console.WriteLine(
        $"round-trip matches original: {roundTrip == text}");
}
Console.WriteLine(
    $"bytes counting saw read: {counting.BytesRead}");

sealed class CountingStream(Stream inner) : Stream
{
    public long BytesWritten { get; private set; }
    public long BytesRead { get; private set; }

    public override bool CanRead => inner.CanRead;
    public override bool CanSeek => inner.CanSeek;
    public override bool CanWrite => inner.CanWrite;
    public override long Length => inner.Length;

    public override long Position
    {
        get => inner.Position;
        set => inner.Position = value;
    }

    public override void Flush() => inner.Flush();

    public override int Read(byte[] buffer, int offset, int count)
    {
        int read = inner.Read(buffer, offset, count);
        BytesRead += read;
        return read;
    }

    public override long Seek(long offset, SeekOrigin origin)
        => inner.Seek(offset, origin);

    public override void SetLength(long value)
        => inner.SetLength(value);

    public override void Write(byte[] buffer, int offset, int count)
    {
        inner.Write(buffer, offset, count);
        BytesWritten += count;
    }
}
```

```text output
bytes counting saw written: 83
underlying MemoryStream length: 83
round-trip matches original: True
bytes counting saw read: 83
```

`counting` sits between `GZipStream` and `MemoryStream` in both directions, and `GZipStream` never notices — it calls `Read` and `Write` on whatever `Stream` it was constructed with, and `CountingStream` satisfies that contract exactly as `MemoryStream` would. `BytesWritten` matches `raw.Length` exactly, because every byte `GZipStream` sent downstream passed through `counting.Write` on its way; `BytesRead` matches the same number on the way back, because decompression reads the entire compressed payload once.

:::dotnet
`gzip` is constructed with `leaveOpen: true` in both directions above. Every `Stream` wrapper in this article disposes the stream it wraps by default when it is itself disposed; `leaveOpen: true` is what let `raw` and `counting` survive past the first `using` block, so the code could read the compressed bytes back out and reopen the same chain for decompression.
:::

::::exercise[Explain the exception]
```csharp run throws=ObjectDisposedException
using System.IO.Compression;

var raw = new MemoryStream();
using (var gzip = new GZipStream(raw, CompressionMode.Compress))
    gzip.WriteByte(1);

raw.WriteByte(2);
```

Which constructor argument from the sections above is missing here, and why does its absence reach all the way to `raw` — a plain `MemoryStream` that `GZipStream` never subclasses?

:::solution
`leaveOpen: true` is missing from the `GZipStream` constructor. Its default is to dispose the stream it was given when it is itself disposed[[7]](https://learn.microsoft.com/en-us/dotnet/api/system.io.compression.gzipstream). The `using` block disposes `gzip` at its closing brace, and `gzip`, constructed with no `leaveOpen` argument, disposes `raw` as part of that. By the time `raw.WriteByte(2)` runs, `raw` has already been closed by a stream that never subclasses it and holds no special relationship to it beyond a field reference — disposal cascades through whichever stream holds a reference to the next one down the chain, independent of which concrete classes are involved. Every runnable example earlier in this article that reused a stream after disposing a wrapper around it passed `leaveOpen: true` for exactly this reason.
:::
::::

## Naming the pattern already at work

Every example above started from a BCL type already shaped like Strategy, Observer or Decorator, then rebuilt the same shape by hand. The more common task in practice runs the other way: recognizing which of the three a new requirement already matches, before writing a class hierarchy that reinvents one of them.

::::exercise[Name the pattern already doing the work]
Three unrelated features land in the same sprint:

1. A report needs `en-US` and `de-DE` number formatting, chosen by the user at runtime, with exactly one rule active per report.
2. A shopping cart total needs to update a page badge and a running analytics count the moment an item is added, with neither caring how the other reacts.
3. An upload endpoint needs to optionally log every chunk that passes through it, and separately, optionally, throttle its rate — both switchable per request, without changing the endpoint's own read and write code.

For each, name the pattern from this article that already fits, and which BCL interface or keyword is the first thing to reach for.

:::solution
1. **Strategy** — one algorithm, a formatting rule, swapped in as a single interchangeable unit. `CultureInfo`/`IFormatProvider` covers most of this already; a hand-rolled interface shaped like `IComparer<T>` covers whatever it doesn't.
2. **Observer** — one change, an open-ended number of independently interested reactions, all within the same process. A plain C# `event`, the same shape as `PriceFeed.PriceChanged` above, is the first thing to reach for.
3. **Decorator** — two independent capabilities layered onto the same read/write contract, each optional and combinable. Wrap the endpoint's `Stream` the way `CountingStream` wrapped `GZipStream`'s target above: one decorator per capability, composed only where a request actually needs it.
:::
::::
