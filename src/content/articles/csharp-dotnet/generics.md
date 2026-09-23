---
title: "Generics in C#: Constraints, Variance and Why They're Fast"
description: "See why ArrayList boxes and List<T> does not, reproduce the CS1961 errors the compiler gives for misused variance, and sum with INumber<T> generic math."
pillar: csharp-dotnet
order: 5
author: markus
published: 2026-09-22
updated: 2026-09-22
level: intermediate
tags: [generics, constraints, variance, boxing, generic-math]
prerequisites: ["csharp-dotnet/value-types-vs-reference-types"]
sources:
  - title: "Generic types and methods (C#)"
    url: "https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/types/generics"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Constraints on type parameters (C# Programming Guide)"
    url: "https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/generics/constraints-on-type-parameters"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Covariance and Contravariance (C#)"
    url: "https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/concepts/covariance-contravariance/"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Covariance and Contravariance in Generics"
    url: "https://learn.microsoft.com/en-us/dotnet/standard/generics/covariance-and-contravariance"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Generics in .NET"
    url: "https://learn.microsoft.com/en-us/dotnet/standard/generics/"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Generic math"
    url: "https://learn.microsoft.com/en-us/dotnet/standard/generics/math"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "INumberBase<TSelf>.Zero Property"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.numerics.inumberbase-1.zero"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Type Erasure (The Java Tutorials)"
    url: "https://docs.oracle.com/javase/tutorial/java/generics/erasure.html"
    publisher: "Oracle"
    accessed: 2026-09-22
draft: true
---

A part-tracking list that holds `object` compiles no matter what you put in it. A list that holds `T` rejects the wrong type before the program ever runs. That one difference — moving a check from runtime to compile time — is what generics are for, and it costs nothing at runtime because the CLR keeps the real type around instead of throwing it away.

## What `object` costs you

[`ArrayList`](https://learn.microsoft.com/en-us/dotnet/api/system.collections.arraylist) is the pre-generics list: every slot is typed `object`. Put an `int` in it and the runtime **boxes** it — copies the value onto the heap and stores a reference to that box, because an `object` reference has to point at something with an object header, and a bare `int` doesn't have one. Read it back and you have to cast, because the compiler only ever knew the slot held `object`.

```csharp run id=arraylist-bag throws=InvalidCastException
using System.Collections;

ArrayList bin = [];
bin.Add(1001);
bin.Add(1002);
bin.Add("1003-A");

int total = 0;
foreach (object partId in bin)
    total += (int)partId;

Console.WriteLine($"total: {total}");
```

`"1003-A"` isn't a part ID; it's a typo for a part ID. `ArrayList.Add(object)` accepts it without complaint, because to the compiler an `int` and a `string` are both just `object`. The mistake surfaces two lines later, as an unhandled `InvalidCastException` — `Unable to cast object of type 'System.String' to type 'System.Int32'` — that could just as easily be two thousand lines later, in a foreach a different developer wrote. Nothing about the `bin.Add("1003-A")` call itself looked wrong.

`List<int>` closes the same hole a different way — not by catching the cast at the point it fails, but by never accepting the wrong type in the first place:

```csharp run error=CS1503
List<int> partIds = [1001, 1002];
partIds.Add("1003-A");
```

`List<T>.Add` isn't `Add(object)`; once `T` is fixed to `int`, it's `Add(int)`, and the compiler rejects the call at the exact line that's wrong. That's the guarantee `object`-based code can't give you: the [C# generics overview](https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/types/generics) puts it plainly — "the compiler checks types at compile time, so you don't need runtime casts or risk `InvalidCastException`."

Boxing isn't just a safety gap, it's also allocation and copying that `List<int>` skips entirely — [Microsoft's generics overview](https://learn.microsoft.com/en-us/dotnet/standard/generics/) lists this as one of the concrete benefits: "generic collection types generally perform better for storing and manipulating value types because there is no need to box the value types." Summing eight million part IDs through each list shows the gap instead of just asserting it:

```csharp run id=box-cost
#:property Optimize=true
using System.Collections;
using System.Diagnostics;

const int n = 8_000_000;

ArrayList boxedIds = new(n);
for (int i = 0; i < n; i++) boxedIds.Add(i);

List<int> typedIds = new(n);
for (int i = 0; i < n; i++) typedIds.Add(i);

var sw = Stopwatch.StartNew();
long boxedTotal = 0;
foreach (object id in boxedIds) boxedTotal += (int)id;
long boxedMs = sw.ElapsedMilliseconds;

sw.Restart();
long typedTotal = 0;
foreach (int id in typedIds) typedTotal += id;
long typedMs = sw.ElapsedMilliseconds;

Console.WriteLine($"ArrayList (boxed): {boxedTotal}, {boxedMs} ms");
Console.WriteLine($"List<int>:         {typedTotal}, {typedMs} ms");
```

```text output
ArrayList (boxed): 31999996000000, [...] ms
List<int>:         31999996000000, [...] ms
```

On this machine (.NET 10.0.401, Windows 11, x64) the boxed sum consistently ran several times slower than the typed one — the exact multiple moved between runs, but `List<int>` was never close to the `ArrayList` time. The loop over `boxedIds` unboxes eight million times (a bounds-checked type test plus a copy out of the heap) before it can add anything; the loop over `typedIds` never leaves value-type land.

## Constraints: telling the compiler what `T` can do

A method that only knows its parameter is `T` can do exactly what it could do with `object`: assign it, compare references, pass it along. `T`'s methods and operators aren't available until a **constraint** — a `where` clause — tells the compiler what `T` is guaranteed to support. The compiler then enforces that guarantee on every caller, before your code ever runs.

| Constraint | Requires |
|---|---|
| `where T : class` | `T` is a reference type |
| `where T : struct` | `T` is a non-nullable value type |
| `where T : new()` | `T` has a public parameterless constructor |
| `where T : SomeBase` | `T` is `SomeBase` or derives from it |
| `where T : ISomeInterface` | `T` implements `ISomeInterface` |

Constraints can combine (`class` and `new()` can both sit alongside interface constraints), and a violation is a compile error naming exactly which constraint failed — not a runtime surprise. A leaderboard needs only that scores can be ordered, so `IComparable<T>` is enough; it doesn't care whether `T` is a number, a string, or anything else that can compare itself:

```csharp run id=leaderboard
int[] scores = [1840, 2210, 1975, 2050];
Console.WriteLine($"top score: {HighestScore(scores)}");

string[] names = ["Priya", "Ola", "Yusuf"];
Console.WriteLine($"last alphabetically: {HighestScore(names)}");

static T HighestScore<T>(IEnumerable<T> values) where T : IComparable<T>
{
    using var e = values.GetEnumerator();
    if (!e.MoveNext()) throw new InvalidOperationException("empty sequence");
    T best = e.Current;
    while (e.MoveNext())
        if (e.Current.CompareTo(best) > 0)
            best = e.Current;
    return best;
}
```

```text output
top score: 2210
last alphabetically: Yusuf
```

Without `where T : IComparable<T>`, `e.Current.CompareTo(best)` wouldn't compile at all — `T` on its own only has what `object` has, and `object` has no `CompareTo`. The constraint is what makes the method body legal, and it's checked at the call site too. Each of the constraints below rejects a real argument, with the compiler naming the exact rule that broke:

```csharp run error=CS0452
Cache(42);

static void Cache<T>(T value) where T : class { }
```

`int` is a value type, so it fails `where T : class` outright — no reference for a value type to pretend to be. Swap the constraint and a reference type fails it the same way:

```csharp run error=CS0453
Enqueue("player-1");

static void Enqueue<T>(T value) where T : struct { }
```

`new()` fails differently: it's not about the category of type, but whether that specific type has a public constructor that takes no arguments.

```csharp run error=CS0310
Spawn<Monster>();

static T Spawn<T>() where T : new() => new T();

class Monster
{
    public Monster(int health) { }
}
```

`Monster` only has a constructor that takes an `int`, so `new T()` inside `Spawn` has nothing to call. `where T : new()` is a promise that `new T()` will work for every type argument a caller supplies — the compiler checks the promise at every call site, not just inside `Spawn`.

A base-class constraint and `new()` combine cleanly when a factory needs both a shared shape and a way to build one:

```csharp run id=spawn-ok
var goblin = Spawn<Goblin>();
Console.WriteLine($"{goblin.Kind}: {goblin.Health} hp");

static T Spawn<T>() where T : GameEntity, new()
{
    var entity = new T();
    entity.Health = 10;
    return entity;
}

abstract class GameEntity
{
    public int Health { get; set; }
    public abstract string Kind { get; }
}

class Goblin : GameEntity
{
    public override string Kind => "goblin";
}
```

```text output
goblin: 10 hp
```

`Spawn<T>` can set `entity.Health` because `GameEntity` guarantees the property exists, and it can call `new T()` because `new()` guarantees a parameterless constructor — neither works alone. `new()`, when combined with other constraints, has to come last in the list ([Constraints on type parameters](https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/generics/constraints-on-type-parameters)).

## Reified at compile time and at runtime

C# generics are **reified**: the type argument you gave is still there at runtime, not just at compile time. `typeof(T)` inside a generic method returns the real, substituted type — not `object`, not some placeholder:

```csharp run id=reified
List<int> ids = [1, 2, 3];
List<string> names = ["a", "b"];

Console.WriteLine(ids.GetType());
Console.WriteLine(names.GetType());
Console.WriteLine(ids.GetType() == typeof(List<int>));

Describe(7);
Describe("seven");

static void Describe<T>(T value) =>
    Console.WriteLine($"T is {typeof(T)} here, not just object");
```

```text output
System.Collections.Generic.List`1[System.Int32]
System.Collections.Generic.List`1[System.String]
True
T is System.Int32 here, not just object
T is System.String here, not just object
```

`List<int>` and `List<string>` report distinct runtime types — `List<int>`'s `GetType()` is reference-equal to `typeof(List<int>)`, not to some shared, type-erased `List`. Inside `Describe<T>`, `typeof(T)` reports `System.Int32` or `System.String` on the two calls, even though both call sites compile against the exact same method body. The [C# generics overview](https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/types/generics) states this directly for readers coming from another language: "C# generics are similar to generics in Java or templates in C++, but with full runtime type information and no type erasure."

Java's own documentation describes the alternative it's contrasting with. The [Java Tutorials' page on type erasure](https://docs.oracle.com/javase/tutorial/java/generics/erasure.html) explains that to implement generics, the compiler applies erasure to:

> Replace all type parameters in generic types with their bounds or Object if the type parameters are unbounded. The produced bytecode, therefore, contains only ordinary classes, interfaces, and methods.
>
> Insert type casts if necessary to preserve type safety.
>
> Generate bridge methods to preserve polymorphism in extended generic types.

In that model, `List<Integer>` and `List<String>` compile down to the same class, `List`, holding `Object` references; the compiler inserts the casts a reader would otherwise write by hand, and there's no `typeof(T)`-equivalent to ask a generic method what its actual type argument was, because the answer no longer exists once the class file is built. This is Java's documented design, not a limitation this page tested against a running JVM — the C# side of the comparison above (the `List<int>`/`List<string>` identity and the `typeof(T)` output) is exactly what ran above.

## Which direction does assignment compatibility flow?

By default, a generic type parameter is **invariant**: `List<Circle>` and `List<Shape>` are unrelated types even if `Circle` derives from `Shape`, and assigning one to the other is a compile error, not a narrowing check deferred to runtime:

```csharp run error=CS0029
List<Circle> circles = [new Circle()];
List<Shape> shapes = circles;
Console.WriteLine(shapes.Count);

class Shape;
class Circle : Shape;
```

An interface or delegate can opt out of invariance for a type parameter using `out` (**covariant**) or `in` (**contravariant**). Marking a parameter `out` says every member of the interface only ever *returns* `T`, never accepts it as input — so an `IProducer<Circle>` really can stand in anywhere an `IProducer<Shape>` is expected, because the object can only hand back circles, and every circle is a shape:

```csharp run id=variance-ok
IProducer<Circle> circleSource = new ShapeFactory<Circle>(new Circle());
IProducer<Shape> shapeSource = circleSource;
Console.WriteLine(shapeSource.Get().GetType().Name);

IConsumer<Shape> shapeSink = new ShapeLogger();
IConsumer<Circle> circleSink = shapeSink;
circleSink.Accept(new Circle());

interface IProducer<out T>
{
    T Get();
}

class ShapeFactory<T>(T value) : IProducer<T>
{
    public T Get() => value;
}

interface IConsumer<in T>
{
    void Accept(T item);
}

class ShapeLogger : IConsumer<Shape>
{
    public void Accept(Shape item) => Console.WriteLine($"logged {item.GetType().Name}");
}

class Shape;
class Circle : Shape;
```

```text output
Circle
logged Circle
```

`in` runs the other way: it says every member only ever *accepts* `T`, so an `IConsumer<Shape>` — something that already knows how to handle any shape — can stand in for an `IConsumer<Circle>`, because handing it a circle is just handing it a shape it already knows how to log. `IProducer<Circle>` converts to `IProducer<Shape>` (the same direction as `Circle`-derives-from-`Shape`); `IConsumer<Shape>` converts to `IConsumer<Circle>` (the reverse direction).

<figure class="diagram">
<svg viewBox="0 0 360 550" role="img" aria-labelledby="variance-title variance-desc">
<title id="variance-title">Covariant and contravariant assignment run in opposite directions</title>
<desc id="variance-desc">Circle derives from Shape. Below that, IProducer of Circle can be used as IProducer of Shape, the same direction as the inheritance arrow, because T is out. Below that, IConsumer of Shape can be used as IConsumer of Circle, the reverse direction, because T is in.</desc>
<defs>
<marker id="variance-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-stroke"/></marker>
<marker id="variance-arrow-good" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-accent"/></marker>
</defs>
<text x="20" y="24" class="d-small d-muted">Inheritance</text>
<rect x="100" y="34" width="160" height="36" rx="6" class="d-box"/>
<text x="180" y="57" text-anchor="middle" class="d-mono">Circle</text>
<path d="M180 70 V104" class="d-line" marker-end="url(#variance-arrow)"/>
<text x="196" y="92" class="d-small d-muted">is-a</text>
<rect x="100" y="106" width="160" height="36" rx="6" class="d-box"/>
<text x="180" y="129" text-anchor="middle" class="d-mono">Shape</text>
<text x="20" y="176" class="d-small d-bold d-text-accent">out T (covariant)</text>
<rect x="60" y="186" width="240" height="36" rx="6" class="d-box-accent"/>
<text x="180" y="209" text-anchor="middle" class="d-mono d-small">IProducer&lt;Circle&gt;</text>
<path d="M180 222 V256" class="d-accent" marker-end="url(#variance-arrow-good)"/>
<text x="20" y="244" class="d-small d-muted">can be used as</text>
<rect x="60" y="258" width="240" height="36" rx="6" class="d-box-accent"/>
<text x="180" y="281" text-anchor="middle" class="d-mono d-small">IProducer&lt;Shape&gt;</text>
<text x="20" y="312" class="d-muted d-small">Same direction as Circle -&gt; Shape:</text>
<text x="20" y="328" class="d-muted d-small">out T only returns values.</text>
<text x="20" y="366" class="d-small d-bold d-text-accent">in T (contravariant)</text>
<rect x="60" y="376" width="240" height="36" rx="6" class="d-box-2"/>
<text x="180" y="399" text-anchor="middle" class="d-mono d-small">IConsumer&lt;Shape&gt;</text>
<path d="M180 412 V446" class="d-accent d-dashed" marker-end="url(#variance-arrow-good)"/>
<text x="20" y="434" class="d-small d-muted">can be used as</text>
<rect x="60" y="448" width="240" height="36" rx="6" class="d-box-2"/>
<text x="180" y="471" text-anchor="middle" class="d-mono d-small">IConsumer&lt;Circle&gt;</text>
<text x="20" y="502" class="d-muted d-small">Reversed from Circle -&gt; Shape:</text>
<text x="20" y="518" class="d-muted d-small">in T only accepts values.</text>
</svg>
<figcaption>Figure 1. Covariant `out T` converts in the same direction as the inheritance arrow (Circle to Shape); contravariant `in T` converts in the opposite direction.</figcaption>
</figure>

The compiler enforces the "only returns" and "only accepts" promises member by member, not just as a general vibe. Put `T` in an input position on a covariant interface and every member is checked; the first one that uses `T` as a parameter is rejected:

```csharp run error=CS1961
interface IProducer<out T>
{
    T Get();
    void Accept(T item);
}
```

The diagnostic names the exact member and says what's required: "the type parameter `T` must be contravariantly valid on `IProducer<T>.Accept(T)`". `Accept(T item)` takes `T` as input, which is a contravariant position — exactly wrong for a type parameter declared `out`. The same rule, mirrored, rejects a contravariant type parameter used as a return type:

```csharp run error=CS1961
interface IConsumer<in T>
{
    void Accept(T item);
    T Get();
}
```

This is why the two BCL interface families split the way they do: [`IEnumerable<out T>`](https://learn.microsoft.com/en-us/dotnet/standard/generics/covariance-and-contravariance) only ever returns `T` from `MoveNext`-driven enumeration, so it's covariant; [`IComparer<in T>`](https://learn.microsoft.com/en-us/dotnet/standard/generics/covariance-and-contravariance) only ever takes `T` as parameters to `Compare`, so it's contravariant. A type that needs to do both — like `IList<T>`, which both returns elements and accepts them through an indexer setter — can't be marked either way, which is why `IList<T>` stays invariant while `IEnumerable<T>` and `IReadOnlyList<T>` (read-only, so covariant is safe) are not. Variance is also restricted to interfaces and delegates in the first place — you cannot mark a type parameter of a `class` or `struct` as `in` or `out` ([Covariance and Contravariance](https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/concepts/covariance-contravariance/)), which is part of why the invariant `List<Circle>`/`List<Shape>` example above fails: `List<T>`'s own type parameter is invariant, even though it implements the covariant `IEnumerable<T>`.

## Generic math: constraining `T` to `INumber<T>`

.NET 7 added [`INumber<TSelf>`](https://learn.microsoft.com/en-us/dotnet/api/system.numerics.inumber-1) and the interfaces around it, built on C# 11's `static abstract` interface members, so a type parameter can be constrained to "number-like" instead of one specific numeric type ([Generic math](https://learn.microsoft.com/en-us/dotnet/standard/generics/math)). `int`, `double`, and `decimal` all implement `INumber<T>`, along with every other built-in numeric type, so one generic method sums all three without an overload for each:

```csharp run id=generic-math
using System.Numerics;

int[] wholeHits = [3, 7, 2, 9];
double[] cpuLoad = [0.42, 0.71, 0.55];
decimal[] prices = [19.99m, 4.50m, 100m];

Console.WriteLine($"hits total:  {Sum(wholeHits)}");
Console.WriteLine($"load total:  {Sum(cpuLoad)}");
Console.WriteLine($"price total: {Sum(prices)}");

static T Sum<T>(IEnumerable<T> values) where T : INumber<T>
{
    T total = T.Zero;
    foreach (var v in values)
        total += v;
    return total;
}
```

```text output
hits total:  21
load total:  1.68
price total: 124.49
```

`T.Zero` and `total += v` both resolve at compile time to `int`'s operators, `double`'s operators, or `decimal`'s operators, depending on the call site — there's no boxing to a common numeric type and no `dynamic`. `T.Zero` is possible at all because `Zero` is declared `public static abstract TSelf Zero { get; }` on [`INumberBase<TSelf>`](https://learn.microsoft.com/en-us/dotnet/api/system.numerics.inumberbase-1.zero), which `INumber<TSelf>` extends — a `static abstract` member, the same C# 11 feature that lets [interfaces declare `static` contracts rather than instance ones](/oop-design/interfaces-vs-abstract-classes/#static-abstract-members-contracts-for-statics-not-instances), applied here to operators (`+`) and factory-style members (`Zero`, `One`) instead of ordinary methods. Before generic math, writing `Sum` for `int`, `double`, and `decimal` meant three overloads, or one that widened everything to `decimal` and paid for conversions nobody asked for.
