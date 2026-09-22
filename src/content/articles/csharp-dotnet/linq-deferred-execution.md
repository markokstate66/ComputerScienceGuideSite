---
title: "LINQ and Deferred Execution: When Your Query Really Runs"
description: "Trace a LINQ query whose side effect fires twice, rebuild Where and Select with yield return, and measure what re-enumerating actually costs."
pillar: csharp-dotnet
order: 4
author: markus
published: 2026-09-22
updated: 2026-09-22
level: intermediate
tags: [linq, deferred-execution, iterators, yield, iqueryable]
prerequisites: ["csharp-dotnet/value-types-vs-reference-types"]
sources:
  - title: "Iterators (C#)"
    url: "https://learn.microsoft.com/en-us/dotnet/csharp/iterators"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "yield statement - provide the next element in an iterator (C# reference)"
    url: "https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/statements/yield"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Deferred execution and lazy evaluation - LINQ to XML"
    url: "https://learn.microsoft.com/en-us/dotnet/standard/linq/deferred-execution-lazy-evaluation"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Introduction to LINQ Queries (C#)"
    url: "https://learn.microsoft.com/en-us/dotnet/csharp/linq/get-started/introduction-to-linq-queries"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Enumerable.Where Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.linq.enumerable.where"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "IQueryable Interface"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.linq.iqueryable"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Queryable.Where Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.linq.queryable.where"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
draft: true
---

A help-desk queue is a `List<Ticket>`. One LINQ query is supposed to find the tickets that breach their service-level agreement, log each one, and report how many there were. It reads like a single operation. It is not: it runs the SLA check once per ticket for every place the query is used, and nothing in the code says so.

## The SLA count that didn't add up

`IsSlaBreach` stands in for a real check — in production it might hit a database or a scheduling service. Here it just tests the subject line, but the program also counts how many times it actually runs.

```csharp run id=bug
List<Ticket> tickets =
[
    new(1, "printer offline"),
    new(2, "server down"),
    new(3, "password reset"),
    new(4, "database timeout"),
];

int slaLookups = 0;

IEnumerable<Ticket> urgent = tickets.Where(t =>
{
    slaLookups++;
    return IsSlaBreach(t);
});

Console.WriteLine($"urgent count: {urgent.Count()}");
foreach (var t in urgent)
    Console.WriteLine($"  escalate #{t.Id}: {t.Subject}");
Console.WriteLine($"SLA service calls: {slaLookups}");

static bool IsSlaBreach(Ticket t) =>
    t.Subject.Contains("down")
    || t.Subject.Contains("timeout");

record Ticket(int Id, string Subject);
```

```text output
urgent count: 2
  escalate #2: server down
  escalate #4: database timeout
SLA service calls: 8
```

Four tickets, and the check ran eight times. `urgent` is not a list of results; it is, in the words of the LINQ documentation, an object that "stores all the information that is required to perform the action" and is not executed "until the object is enumerated" ([`Enumerable.Where`](https://learn.microsoft.com/en-us/dotnet/api/system.linq.enumerable.where)). `Count()` enumerates the whole sequence once to count it — that's four calls to `IsSlaBreach`. The `foreach` right after it enumerates the same query variable again, from the start — four more calls. `urgent` never held a result; it held a plan, and the code ran that plan twice.

The one-line fix makes the plan run once and keeps the answer: `var urgent = tickets.Where(...).ToList();`. A `List<Ticket>` is a materialized result, not a plan, so `.Count` and `foreach` afterward cost nothing extra. The rest of this page is about why the unfixed version behaves this way, what a LINQ operator actually is, and where the same mistake gets expensive rather than just wasteful.

## What `yield return` actually builds

`Where` is written with an iterator method: a method containing `yield return`, which the C# compiler turns into something that implements `IEnumerator<T>` behind the scenes ([Iterators](https://learn.microsoft.com/en-us/dotnet/csharp/iterators)). Calling an iterator method does not run its body. It returns an object — the compiler-generated enumerator, wrapped as `IEnumerable<T>` — that remembers where to start. The body only runs when something calls `MoveNext()` on that object, which is what `foreach` and `Count()` do under the hood. The [C# reference](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/statements/yield) is explicit about the consequence: "Calling an iterator doesn't execute it immediately."

Each `yield return` is a suspend point. The method runs until it hits one, hands a value to the caller, and stops — not returns, stops, with every local variable and the exact line it was on preserved — until the caller asks for the next value, at which point it picks up right after that `yield return` and keeps going. The compiler manages this by generating a class that keeps the method's locals as fields and a marker for where execution left off, so `MoveNext()` can jump back in instead of starting over.

This program interleaves two independent trails of `Console.WriteLine` calls — one from the caller, one from inside the iterator — so the suspend-and-resume order is visible instead of asserted:

```csharp run id=trace
Console.WriteLine("Caller: query built");
IEnumerable<Ticket> pending = PendingTickets();
Console.WriteLine("Caller: about to enumerate");

foreach (var t in pending)
    Console.WriteLine($"Caller: received #{t.Id}");

Console.WriteLine("Caller: done");

static IEnumerable<Ticket> PendingTickets()
{
    Console.WriteLine("  Iterator: start");
    Console.WriteLine("  Iterator: about to yield #1");
    yield return new Ticket(1, "printer offline");
    Console.WriteLine("  Iterator: resumed after #1");

    Console.WriteLine("  Iterator: about to yield #2");
    yield return new Ticket(2, "server down");
    Console.WriteLine("  Iterator: resumed after #2");

    Console.WriteLine("  Iterator: end");
}

record Ticket(int Id, string Subject);
```

```text output
Caller: query built
Caller: about to enumerate
  Iterator: start
  Iterator: about to yield #1
Caller: received #1
  Iterator: resumed after #1
  Iterator: about to yield #2
Caller: received #2
  Iterator: resumed after #2
  Iterator: end
Caller: done
```

`PendingTickets()` prints nothing when it's called — "Caller: query built" is the only line before the loop starts. Once the `foreach` begins, the two trails interleave one step at a time: the iterator runs to the first `yield return`, the caller consumes it and asks for more, the iterator resumes from exactly that point. This suspend/resume behavior is what the LINQ documentation means when it says that deferred execution "is supported directly in the C# language by the `yield` keyword" ([Deferred execution and lazy evaluation](https://learn.microsoft.com/en-us/dotnet/standard/linq/deferred-execution-lazy-evaluation)): an iterator method is a deferred, on-demand source by construction, not because LINQ adds anything special to it.

## Deferred, immediate, streaming, nonstreaming

Microsoft's own classification splits the standard query operators into two groups. **Immediate** operators read the source and produce their answer as soon as they're called — `Count`, `Sum`, `First`, `ToList`. **Deferred** operators, everything that returns `IEnumerable<T>` such as `Where` and `Select`, don't run "at the point in the code where the query is declared," only "when the query variable is enumerated" ([Introduction to LINQ Queries](https://learn.microsoft.com/en-us/dotnet/csharp/linq/get-started/introduction-to-linq-queries)). That page adds the detail that explains the bug above precisely: "If the query variable is enumerated multiple times, the results might differ every time" — and, as `slaLookups` showed, so does every side effect the query touches.

Deferred operators split further by how much of the source they need before they can produce anything:

- **Streaming**: reads source elements one at a time and can yield a result element after reading just one. `Where` and `Select` are streaming — each is written as a `foreach` with a single `yield return` inside it, so it never needs more than the current element in hand.
- **Nonstreaming**: must consume the whole source before yielding anything. `OrderBy` is the clearest example — it cannot know which element sorts first until it has seen all of them, so it reads everything into a buffer before the first result comes out.

Both still defer: an unsorted `OrderBy` call runs no comparisons until enumerated. But a streaming operator can start producing output after touching one source element, and a nonstreaming one can't produce anything until it has touched all of them.

## Writing `Where` and `Select` from scratch

Nothing above is LINQ-specific machinery — it's two ordinary iterator methods. Here they are, with the same signatures as the real operators:

```csharp run id=custom
List<Ticket> tickets =
[
    new(1, "printer offline"),
    new(2, "server down"),
    new(3, "password reset"),
];

Console.WriteLine("building the pipeline...");
var subjects = tickets
    .Traced("source")
    .MyWhere(t =>
    {
        Console.WriteLine(
            $"  where: testing #{t.Id}");
        return t.Subject.Contains("down");
    })
    .MySelect(t =>
    {
        Console.WriteLine(
            $"  select: projecting #{t.Id}");
        return t.Subject.ToUpperInvariant();
    });

Console.WriteLine("built (nothing above yet)");
Console.WriteLine("enumerating...");
foreach (var s in subjects)
    Console.WriteLine($"result: {s}");

static class MyLinq
{
    public static IEnumerable<Ticket> Traced(
        this IEnumerable<Ticket> source, string label)
    {
        foreach (var item in source)
        {
            Console.WriteLine(
                $"  {label}: yielding #{item.Id}");
            yield return item;
        }
    }

    public static IEnumerable<T> MyWhere<T>(
        this IEnumerable<T> source,
        Func<T, bool> predicate)
    {
        foreach (var item in source)
            if (predicate(item))
                yield return item;
    }

    public static IEnumerable<TResult> MySelect<T, TResult>(
        this IEnumerable<T> source,
        Func<T, TResult> selector)
    {
        foreach (var item in source)
            yield return selector(item);
    }
}

record Ticket(int Id, string Subject);
```

```text output
building the pipeline...
built (nothing above yet)
enumerating...
  source: yielding #1
  where: testing #1
  source: yielding #2
  where: testing #2
  select: projecting #2
result: SERVER DOWN
  source: yielding #3
  where: testing #3
```

Building `tickets.Traced(...).MyWhere(...).MySelect(...)` calls three iterator methods and prints nothing, exactly like `PendingTickets()` above — the pipeline is three nested unstarted enumerators. Once the `foreach` starts pulling, the trace shows the pipeline going deep before it goes wide: `MySelect`'s `MoveNext()` calls `MyWhere`'s `MoveNext()`, which calls `Traced`'s `MoveNext()`, which pulls ticket #1 from the list. Only then does `where: testing #1` run. Ticket #1 fails the predicate, so `MyWhere` doesn't yield — it loops straight to pulling ticket #2, which passes, gets projected, and only then does the outer `foreach` see a result. Each element travels all the way through the pipeline before the next one is even read from the source.

<figure class="diagram">
<svg viewBox="0 0 360 440" role="img" aria-labelledby="pull-title pull-desc">
<title id="pull-title">A LINQ pipeline pulls one element at a time from the bottom up</title>
<desc id="pull-desc">Four stacked boxes, top to bottom: foreach, MySelect, MyWhere, and the source list. Between each pair, a downward dashed arrow labeled MoveNext asks the stage below for the next item, and an upward solid arrow labeled one item carries the answer back. Nothing moves until the top box asks.</desc>
<defs>
<marker id="pull-arrow-down" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-stroke"/></marker>
<marker id="pull-arrow-up" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-accent"/></marker>
</defs>
<rect x="20" y="20" width="320" height="44" rx="6" class="d-box-accent"/>
<text x="180" y="47" text-anchor="middle" class="d-mono d-bold">foreach (consumer)</text>
<path d="M120 66 V116" class="d-line d-dashed" marker-end="url(#pull-arrow-down)"/>
<text x="20" y="90" class="d-small d-muted">MoveNext()</text>
<path d="M250 116 V66" class="d-accent" marker-end="url(#pull-arrow-up)"/>
<text x="255" y="105" class="d-small d-text-accent">one item</text>
<rect x="20" y="118" width="320" height="44" rx="6" class="d-box"/>
<text x="180" y="145" text-anchor="middle" class="d-mono">MySelect</text>
<path d="M120 164 V214" class="d-line d-dashed" marker-end="url(#pull-arrow-down)"/>
<text x="20" y="188" class="d-small d-muted">MoveNext()</text>
<path d="M250 214 V164" class="d-accent" marker-end="url(#pull-arrow-up)"/>
<text x="255" y="203" class="d-small d-text-accent">one item</text>
<rect x="20" y="216" width="320" height="44" rx="6" class="d-box"/>
<text x="180" y="243" text-anchor="middle" class="d-mono">MyWhere</text>
<path d="M120 262 V312" class="d-line d-dashed" marker-end="url(#pull-arrow-down)"/>
<text x="20" y="286" class="d-small d-muted">MoveNext()</text>
<path d="M250 312 V262" class="d-accent" marker-end="url(#pull-arrow-up)"/>
<text x="255" y="301" class="d-small d-text-accent">one item</text>
<rect x="20" y="314" width="320" height="44" rx="6" class="d-box-2"/>
<text x="180" y="341" text-anchor="middle" class="d-mono">tickets (source list)</text>
<text x="20" y="382" class="d-muted d-small">Each MoveNext() travels all the way down to</text>
<text x="20" y="398" class="d-muted d-small">the source, and each item travels all the way</text>
<text x="20" y="414" class="d-muted d-small">back up, before the next MoveNext() is asked.</text>
</svg>
<figcaption>Figure 1. A three-stage pipeline over a list is not three passes over the data; it is one pass where each MoveNext() at the top ripples down to the source and one value ripples back, which is exactly the interleaving the trace above printed.</figcaption>
</figure>

If `MyWhere` and `MySelect` are only ordinary iterator methods, the real ones should behave identically — same interleaving, same order, called on the exact same data:

```csharp run id=compare
List<Ticket> tickets =
[
    new(1, "printer offline"),
    new(2, "server down"),
];

Console.WriteLine("== mine ==");
var mine = tickets.Traced()
    .MyWhere(t => Check("mine", t))
    .MySelect(t => Project("mine", t));
foreach (var s in mine)
    Console.WriteLine($"mine result: {s}");

Console.WriteLine("== real ==");
var real = tickets.Traced()
    .Where(t => Check("real", t))
    .Select(t => Project("real", t));
foreach (var s in real)
    Console.WriteLine($"real result: {s}");

static bool Check(string who, Ticket t)
{
    Console.WriteLine($"  {who}: testing #{t.Id}");
    return t.Subject.Contains("down");
}

static string Project(string who, Ticket t)
{
    Console.WriteLine(
        $"  {who}: projecting #{t.Id}");
    return t.Subject.ToUpperInvariant();
}

static class MyLinq
{
    public static IEnumerable<Ticket> Traced(
        this IEnumerable<Ticket> source)
    {
        foreach (var item in source)
        {
            Console.WriteLine(
                $"  source: yielding #{item.Id}");
            yield return item;
        }
    }

    public static IEnumerable<T> MyWhere<T>(
        this IEnumerable<T> source,
        Func<T, bool> predicate)
    {
        foreach (var item in source)
            if (predicate(item))
                yield return item;
    }

    public static IEnumerable<TResult> MySelect<T, TResult>(
        this IEnumerable<T> source,
        Func<T, TResult> selector)
    {
        foreach (var item in source)
            yield return selector(item);
    }
}

record Ticket(int Id, string Subject);
```

```text output
== mine ==
  source: yielding #1
  mine: testing #1
  source: yielding #2
  mine: testing #2
  mine: projecting #2
mine result: SERVER DOWN
== real ==
  source: yielding #1
  real: testing #1
  source: yielding #2
  real: testing #2
  real: projecting #2
real result: SERVER DOWN
```

Swap `MyWhere`/`MySelect` for `Where`/`Select` and only the labels change; every `source:`, `testing`, and `projecting` line lands in the same place relative to the others. The real `Enumerable.Where` and `Enumerable.Select` are more careful about edge cases (null checks, an indexed overload, a fast path when the source is an array or a `List<T>`) but they are, at heart, the same `foreach` loop with a `yield return` guarded by an `if`.

::::exercise[Predict the trace order]
Three tickets this time, and a predicate that matches two of them:

```csharp run id=ex1
List<Ticket> tickets =
[
    new(1, "printer offline"),
    new(2, "server down"),
    new(3, "database timeout"),
];

var urgent = tickets.Traced()
    .MyWhere(Check)
    .MySelect(Project);

Console.WriteLine("built");
foreach (var s in urgent)
    Console.WriteLine($"got: {s}");

static bool Check(Ticket t)
{
    Console.WriteLine($"check #{t.Id}");
    return t.Subject.Contains("down")
        || t.Subject.Contains("timeout");
}

static string Project(Ticket t)
{
    Console.WriteLine($"project #{t.Id}");
    return t.Subject.ToUpperInvariant();
}

static class MyLinq
{
    public static IEnumerable<Ticket> Traced(
        this IEnumerable<Ticket> source)
    {
        foreach (var item in source)
        {
            Console.WriteLine($"source #{item.Id}");
            yield return item;
        }
    }

    public static IEnumerable<T> MyWhere<T>(
        this IEnumerable<T> source,
        Func<T, bool> predicate)
    {
        foreach (var item in source)
            if (predicate(item))
                yield return item;
    }

    public static IEnumerable<TResult> MySelect<T, TResult>(
        this IEnumerable<T> source,
        Func<T, TResult> selector)
    {
        foreach (var item in source)
            yield return selector(item);
    }
}

record Ticket(int Id, string Subject);
```

Write down the full order of lines before you run it. `Check` rejects ticket #1, so does `source` get pulled for #2 before or after `check #1` prints?

:::solution
```text output
built
source #1
check #1
source #2
check #2
project #2
got: SERVER DOWN
source #3
check #3
project #3
got: DATABASE TIMEOUT
```

`built` prints before anything else because building the pipeline only constructs nested enumerators. `source #2` prints right after `check #1` fails, because `MyWhere`'s loop doesn't stop when a predicate returns `false` — it goes straight back to `foreach` on the source for the next element, which pulls #2 immediately. `check #2` succeeds, so `project #2` and `got: SERVER DOWN` follow before the loop ever looks at #3.
:::
::::

## What re-enumerating costs

The SLA bug above was a correctness problem: an operation with a real-world side effect that fired more times than intended. The same root cause — a deferred query with no cached result — is also a straightforward performance problem, because every enumeration reruns every predicate from the top of the pipeline, not just the parts that changed. `IsPrime` below does real, deterministic work (trial division), so the cost is measured in milliseconds, not just call counts. The numbers were taken on .NET 10.0.12, Windows 11, x64, on a desktop Core i7-11700K; wall-clock timings vary between machines, so only the shape of the difference matters.

```csharp run id=cost
#:property Optimize=true
using System.Diagnostics;

var expensive = Enumerable.Range(2, 200_000)
    .Where(IsPrime);

var sw = Stopwatch.StartNew();
int first = expensive.Count();
long ms1 = sw.ElapsedMilliseconds;

sw.Restart();
int second = expensive.Count();
long ms2 = sw.ElapsedMilliseconds;

var cached = expensive.ToList();
sw.Restart();
int third = cached.Count;
long ms3 = sw.ElapsedMilliseconds;

Console.WriteLine(
    $"first:  {first,5} primes, {ms1,4} ms");
Console.WriteLine(
    $"second: {second,5} primes, {ms2,4} ms");
Console.WriteLine(
    $"cached: {third,5} primes, {ms3,4} ms");

static bool IsPrime(int n)
{
    for (int i = 2; (long)i * i <= n; i++)
        if (n % i == 0) return false;
    return true;
}
```

```text output
first:  17984 primes, [...] ms
second: 17984 primes, [...] ms
cached: 17984 primes,   [...] ms
```

`expensive` is `Enumerable.Range(2, 200_000).Where(IsPrime)` — a deferred, streaming pipeline over two hundred thousand integers. Calling `.Count()` on it the first time runs `IsPrime` two hundred thousand times, at real trial-division cost. Calling `.Count()` on the *same variable* again does not reuse that work: `expensive` is still just a plan, so the second call re-runs `Enumerable.Range` and every `IsPrime` check from scratch, and takes about as long as the first. Only after `.ToList()` materializes the primes into an actual `List<int>` does reading `.Count` become a stored field lookup — the third line drops to sub-millisecond, because there is no pipeline left to re-run.

A web endpoint that builds a filtered `IQueryable`- or `IEnumerable`-backed result and then both logs `results.Count()` and returns `results` to the caller has this exact shape: two full passes over the filter for the price of what looks like one query.

## `IEnumerable` runs here; `IQueryable` writes a plan for someone else

`Where` on an `IEnumerable<T>` takes a `Func<T, bool>` — a compiled, callable delegate. `Where` on an `IQueryable<T>` takes an `Expression<Func<T, bool>>` instead, and the compiler builds that argument as *data describing the lambda* — a tree of objects for `t.Subject == "server down"`, not a runnable method. Both are deferred, but only one of them can be inspected before it runs, which is what actually distinguishes the two interfaces.

```csharp run id=queryable
using System.Linq.Expressions;

List<Ticket> tickets =
[
    new(1, "printer offline"),
    new(2, "server down"),
];

#pragma warning disable IL2026, IL3050
IQueryable<Ticket> query = tickets
    .AsQueryable()
    .Where(t => t.Id == 2);
#pragma warning restore IL2026, IL3050
IEnumerable<Ticket> sequence =
    tickets.Where(t => t.Id == 2);

var call = (MethodCallExpression)query.Expression;
Console.WriteLine("predicate as data:");
Console.WriteLine($"  {call.Arguments[1]}");
Console.WriteLine("predicate as code:");
Console.WriteLine($"  {sequence.GetType().Name}");

record Ticket(int Id, string Subject);
```

```text output
predicate as data:
  t => (t.Id == 2)
predicate as code:
  SizeOptIListWhereIterator`1
```

`query.Expression` is a real `Expression` tree — [`Queryable.Where`](https://learn.microsoft.com/en-us/dotnet/api/system.linq.queryable.where) "generates a `MethodCallExpression`" and hands it to the source's `IQueryProvider`, and its `Arguments[1]` is exactly the lambda, unexecuted. `sequence`, from `Enumerable.Where`, is an instance of a compiler- and runtime-internal iterator class — its exact name is an implementation detail (worth noting, not worth relying on), but the point is it has no `Expression` property to print: the lambda was compiled straight to IL, and the only way to know what it checks is to call it.

That the expression is real, inspectable data — not just a longer `ToString()` — is provable without ever calling the predicate. `MethodCallExpression.Arguments[1]` is a quoted `LambdaExpression`; walking into its body reaches a `BinaryExpression` with a `MemberExpression` on the left and a `ConstantExpression` on the right, and both are readable directly:

```csharp run id=inspect
using System.Linq.Expressions;

List<Ticket> tickets =
[
    new(1, "printer offline"),
    new(2, "server down"),
];

#pragma warning disable IL2026, IL3050
IQueryable<Ticket> query = tickets
    .AsQueryable()
    .Where(t => t.Subject == "server down");
#pragma warning restore IL2026, IL3050

var call = (MethodCallExpression)query.Expression;
var lambda =
    (LambdaExpression)Unquote(call.Arguments[1]);
var test = (BinaryExpression)lambda.Body;
var property = (MemberExpression)test.Left;
var target = (ConstantExpression)test.Right;

Console.WriteLine("read from the tree:");
Console.WriteLine(
    $"  property: {property.Member.Name}");
Console.WriteLine($"  value:    {target.Value}");

static Expression Unquote(Expression e)
{
    if (e is UnaryExpression u
        && u.NodeType == ExpressionType.Quote)
        return u.Operand;
    return e;
}

record Ticket(int Id, string Subject);
```

```text output
read from the tree:
  property: Subject
  value:    server down
```

Nothing in `IsSlaBreach`-style code ever ran; the field name and the comparison value came out of the tree structure alone. This is exactly what a real provider does with far more of the tree: Entity Framework Core walks an `IQueryable`'s expression the same way this program did, and turns it into SQL instead of a console line. The [`IQueryable`](https://learn.microsoft.com/en-us/dotnet/api/system.linq.iqueryable) documentation describes this in general terms — enumerating an `IQueryable` "causes the expression tree ... to be executed," and "the definition of 'executing an expression tree' is specific to a query provider," which "may involve translating the expression tree to an appropriate query language for the underlying data source." A `List<T>.AsQueryable()`, as used above, is not talking to a database: its provider is .NET's own `System.Linq.EnumerableQuery<T>`, which compiles the tree back into a delegate and runs it in-process — the same `IEnumerable` execution the whole rest of this page has been about. The difference between the two interfaces is not where code eventually runs; it's whether a provider gets a chance to look at the query before deciding.

## Practice: keep it from running twice

::::exercise[Find the bug: two lookups became eight]
This helper checks whether any ticket needs review and, if so, lists them and reports a total. It runs correctly and reports the wrong number of lookups.

```csharp run id=ex2
List<Ticket> tickets =
[
    new(1, "printer offline"),
    new(2, "server down"),
    new(3, "database timeout"),
];

int lookups = 0;
var flagged = tickets.Where(t => IsFlagged(t));

if (flagged.Any())
{
    foreach (var t in flagged)
        Console.WriteLine($"reviewing #{t.Id}");
    Console.WriteLine($"flagged: {flagged.Count()}");
}

Console.WriteLine($"SLA lookups: {lookups}");

bool IsFlagged(Ticket t)
{
    lookups++;
    return t.Subject.Contains("down")
        || t.Subject.Contains("timeout");
}

record Ticket(int Id, string Subject);
```

```text output
reviewing #2
reviewing #3
flagged: 2
SLA lookups: 8
```

Three tickets, three method calls, and yet `SLA lookups` reads 8. `Any()` alone only accounts for 2 of them (it stops as soon as ticket #2 passes). Where do the other six come from, and what is the smallest change that makes the total 3?
:::solution
`Any()` is streaming and short-circuits: it checks #1 (fails), #2 (passes), and stops — 2 lookups. `flagged` is still an unmaterialized query, so the `foreach` re-runs the predicate against all three tickets from the start (3 more), and `flagged.Count()` does it again (3 more): 2 + 3 + 3 = 8. Appending `.ToList()` where `flagged` is built turns it into a stored result, so `Any()` becomes `.Count > 0`, `foreach` walks the list, and `.Count()` becomes a property read — 3 lookups total, one per ticket:

```csharp run id=ex2-fixed
List<Ticket> tickets =
[
    new(1, "printer offline"),
    new(2, "server down"),
    new(3, "database timeout"),
];

int lookups = 0;
var flagged = tickets
    .Where(t => IsFlagged(t))
    .ToList();

if (flagged.Count > 0)
{
    foreach (var t in flagged)
        Console.WriteLine($"reviewing #{t.Id}");
    Console.WriteLine($"flagged: {flagged.Count}");
}

Console.WriteLine($"SLA lookups: {lookups}");

bool IsFlagged(Ticket t)
{
    lookups++;
    return t.Subject.Contains("down")
        || t.Subject.Contains("timeout");
}

record Ticket(int Id, string Subject);
```

```text output
reviewing #2
reviewing #3
flagged: 2
SLA lookups: 3
```
:::
::::

::::exercise[Extend it: a streaming operator that stops early]
`MyWhere` and `MySelect` always read their entire source. Write `MyTakeWhile`, which yields elements while a predicate holds and then stops — without reading the rest of the source at all. Use it to filter tickets up to (but not including) the first one whose subject contains `"down"`, over a traced source, and confirm from the trace that tickets after the matching one are never pulled.

:::solution
```csharp run id=ex3
List<Ticket> tickets =
[
    new(1, "printer offline"),
    new(2, "server down"),
    new(3, "password reset"),
    new(4, "database timeout"),
];

var firstRun = tickets.Traced()
    .MyTakeWhile(t =>
        !t.Subject.Contains("down"));

Console.WriteLine("enumerating:");
foreach (var t in firstRun)
    Console.WriteLine($"kept #{t.Id}");

static class MyLinq
{
    public static IEnumerable<Ticket> Traced(
        this IEnumerable<Ticket> source)
    {
        foreach (var item in source)
        {
            Console.WriteLine($"  source #{item.Id}");
            yield return item;
        }
    }

    public static IEnumerable<T> MyTakeWhile<T>(
        this IEnumerable<T> source,
        Func<T, bool> predicate)
    {
        foreach (var item in source)
        {
            if (!predicate(item))
                yield break;
            yield return item;
        }
    }
}

record Ticket(int Id, string Subject);
```

```text output
enumerating:
  source #1
kept #1
  source #2
```

`source #3` and `source #4` never print. `MyTakeWhile` reaches ticket #2, finds the predicate false, and runs `yield break` instead of looping back to `foreach` on the source — so the source's iterator is never asked for a third element. That's what makes it streaming in the strict sense used earlier: not just "produces results before reading everything," but capable of leaving the tail of the source unread entirely. The real `Enumerable.TakeWhile` behaves identically, for the same reason: it's the same loop.
:::
::::
