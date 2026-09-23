---
title: "Generics in C#: Constraints, Variance and Why They're Fast"
description: "See why ArrayList boxes and List<T> does not, reproduce the CS1961 errors from misused variance, and clamp values with INumber<T> generic math."
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
  - title: "INumber<TSelf>.Clamp(TSelf, TSelf, TSelf) Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.numerics.inumber-1.clamp"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "INumberBase<TSelf>.CreateChecked<TOther>(TOther) Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.numerics.inumberbase-1.createchecked"
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

Boxing isn't just a safety gap, it's also allocation and copying that `List<int>` skips entirely — [Microsoft's generics overview](https://learn.microsoft.com/en-us/dotnet/standard/generics/) lists this as one of the concrete benefits: "generic collection types generally perform better for storing and manipulating value types because there is no need to box the value types." [Value types vs. reference types](/csharp-dotnet/value-types-vs-reference-types/#what-a-million-boxes-cost) measures that cost once, for a `List<object>` that boxes each *element* it stores. A non-generic dictionary pays the same tax twice over, because every entry has both a key and a value, and `Hashtable` — the pre-generics `Dictionary<TKey,TValue>` — types both `object`:

```csharp run id=box-cost
#:property Optimize=true
using System.Collections;
using System.Diagnostics;

const int n = 2_000_000;

Run("Hashtable", () =>
{
    var map = new Hashtable(n);
    for (int i = 0; i < n; i++)
        map.Add(i, i);            // boxes the key and the value
    long sum = 0;
    foreach (DictionaryEntry e in map)
        sum += Convert.ToInt32(e.Value);   // unboxes the value
    return sum;
});

Run("Dictionary", () =>
{
    var map = new Dictionary<int, int>(n);
    for (int i = 0; i < n; i++)
        map.Add(i, i);
    long sum = 0;
    foreach (var kv in map)
        sum += kv.Value;
    return sum;
});

static void Run(string name, Func<long> work)
{
    work();   // warm-up run, not measured
    long before = HeapBytes();
    long start = Stopwatch.GetTimestamp();
    long sum = work();
    double ms = Stopwatch.GetElapsedTime(start).TotalMilliseconds;
    long bytes = HeapBytes() - before;
    Console.WriteLine($"{name}: {bytes:N0} B, {ms:F1} ms");
    GC.KeepAlive(sum);
}

static long HeapBytes() => GC.GetAllocatedBytesForCurrentThread();
```

```text output
Hashtable: [...] B, [...] ms
Dictionary: [...] B, [...] ms
```

`Hashtable.Add(object, object)` boxes both arguments, so every one of the two million entries allocates two boxes instead of `Dictionary<int, int>`'s zero — on this machine (.NET 10.0.401, Windows 11, x64) that showed up as tens of millions more allocated bytes and a run several times slower, the same shape as the `List<object>` result but doubled, because a dictionary has two `object` slots per entry where a list has one. `Dictionary<TKey, TValue>` closes it the same way `List<T>` does: `TKey` and `TValue` are substituted at the type it's built from, not carried as `object`, so there is nothing to box on the way in or unbox on the way out.

## Constraints: telling the compiler what `T` can do

A method that only knows its parameter is `T` can do exactly what it could do with `object`: assign it, compare references, pass it along. `T`'s methods and operators aren't available until a **constraint** — a `where` clause — tells the compiler what `T` is guaranteed to support. The compiler then enforces that guarantee on every caller, before your code ever runs.

| Constraint | Requires |
|---|---|
| `where T : class` | `T` is a reference type |
| `where T : struct` | `T` is a non-nullable value type |
| `where T : new()` | `T` has a public parameterless ctor |
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

static T Spawn<T>()
    where T : GameEntity, new()
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

::::exercise[Explain the error: why does `new()` have to come last?]
This version of `Spawn` only swaps the order of the two constraints. It does not compile.

```csharp run error=CS0401
Spawn<Goblin>();

static T Spawn<T>() where T : new(), GameEntity => new T();

abstract class GameEntity
{
}

class Goblin : GameEntity
{
}
```

Before opening the solution: `GameEntity, new()` compiles, but `new(), GameEntity` does not, even though a `where` clause is just a list of requirements with no obvious reason to care about order. What does the compiler need to know about `T` before it can make sense of `new()`, and why would putting `new()` first make that impossible in general?

:::solution
`new()` alone only promises a parameterless constructor; it says nothing about what type `T` otherwise is. A base-class or interface constraint narrows `T` down to "a `GameEntity`, or something more specific." The compiler resolves the whole constraint list as one description of `T`, and `new()` is defined relative to whatever that description turns out to be — so the grammar simply requires every other constraint to be stated first, with `new()` last, rather than trying to make sense of `new()` before it knows what else `T` must be. [Constraints on type parameters](https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/generics/constraints-on-type-parameters) states the rule directly: "If you specify the `new()` constraint, it must be the last constraint for that type parameter." Swapping the two back into `GameEntity, new()` is the only fix; nothing else about the method changes:

```csharp run id=spawn-fixed
Spawn<Goblin>();

static T Spawn<T>() where T : GameEntity, new() => new T();

abstract class GameEntity
{
}

class Goblin : GameEntity
{
}
```
:::
::::

## Reified at compile time and at runtime

C# generics are **reified**: the type argument you gave is still there at runtime, not just at compile time. `typeof(T)` inside a generic method returns the real, substituted type — not `object`, not some placeholder:

```csharp run id=reified
List<int> ids = [1, 2, 3];
List<string> names = ["a", "b"];

Console.WriteLine($"List<{ids.GetType().GetGenericArguments()[0].Name}>");
Console.WriteLine($"List<{names.GetType().GetGenericArguments()[0].Name}>");
Console.WriteLine(ids.GetType() == typeof(List<int>));

Describe(7);
Describe("seven");

static void Describe<T>(T value) =>
    Console.WriteLine($"T is {typeof(T)} here, not just object");
```

```text output
List<Int32>
List<String>
True
T is System.Int32 here, not just object
T is System.String here, not just object
```

`List<int>` and `List<string>` report distinct runtime types — the generic argument reflected back off each `GetType()` is `Int32` for one and `String` for the other, and `List<int>`'s `GetType()` is reference-equal to `typeof(List<int>)`, not to some shared, type-erased `List`. Inside `Describe<T>`, `typeof(T)` reports `System.Int32` or `System.String` on the two calls, even though both call sites compile against the exact same method body. The [C# generics overview](https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/types/generics) states this directly for readers coming from another language: "C# generics are similar to generics in Java or templates in C++, but with full runtime type information and no type erasure."

Java's own documentation describes the alternative it's contrasting with. The [Java Tutorials' page on type erasure](https://docs.oracle.com/javase/tutorial/java/generics/erasure.html) explains that to implement generics, the compiler applies erasure to:

> Replace all type parameters in generic types with their bounds or Object if the type parameters are unbounded. The produced bytecode, therefore, contains only ordinary classes, interfaces, and methods.
>
> Insert type casts if necessary to preserve type safety.
>
> Generate bridge methods to preserve polymorphism in extended generic types.

In that model, `List<Integer>` and `List<String>` compile down to the same class, `List`, holding `Object` references; the compiler inserts the casts a reader would otherwise write by hand, and there's no `typeof(T)`-equivalent to ask a generic method what its actual type argument was, because the answer no longer exists once the class file is built. This is Java's documented design, not a limitation this page tested against a running JVM — the C# side of the comparison above (the `List<int>`/`List<string>` identity and the `typeof(T)` output) is exactly what ran above.

::::exercise[Predict it: does reification see through a record struct?]
Four calls to the same generic method, each with a different `T`. Without running it, write down what `report` holds after all four calls — specifically, which of the four come back `IsValueType=True`.

```csharp run id=reflect-stub
List<string> report = [];
Describe(42);
Describe("forty-two");
Describe(new Coordinate(1, 2));
Describe(new Wrapper());

// What does each report entry say?

void Describe<T>(T value) =>
    report.Add($"{typeof(T).Name}: IsValueType={typeof(T).IsValueType}");

readonly record struct Coordinate(int X, int Y);
class Wrapper;
```

:::solution
```csharp run id=reflect
Describe(42);
Describe("forty-two");
Describe(new Coordinate(1, 2));
Describe(new Wrapper());

static void Describe<T>(T value) =>
    Console.WriteLine($"{typeof(T).Name}: IsValueType={typeof(T).IsValueType}");

readonly record struct Coordinate(int X, int Y);
class Wrapper;
```

```text output
Int32: IsValueType=True
String: IsValueType=False
Coordinate: IsValueType=True
Wrapper: IsValueType=False
```

`typeof(T)` is reified per call site, exactly as in the `Describe` example above, so `IsValueType` is asked of the true, substituted type on all four calls — never of some shared `object`. `record struct` still declares a value type, so `Coordinate` reports `True` alongside `int`; the ordinary class `Wrapper` reports `False` alongside `string`, even though nothing about the four call sites looks different from one another.
:::
::::

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

This is why the two BCL interface families split the way they do: [`IEnumerable<out T>`](https://learn.microsoft.com/en-us/dotnet/standard/generics/covariance-and-contravariance) only ever returns `T` from `MoveNext`-driven enumeration, so it's covariant; [`IComparer<in T>`](https://learn.microsoft.com/en-us/dotnet/standard/generics/covariance-and-contravariance) only ever takes `T` as parameters to `Compare`, so it's contravariant. A type that needs to do both — like `IList<T>`, which both returns elements and accepts them through an indexer setter — can't be marked either way, which is why `IList<T>` stays invariant while `IEnumerable<T>` and `IReadOnlyList<T>` (read-only, so covariant is safe) are not. Variance is also restricted to interfaces and delegates in the first place — "only interface types and delegate types can have variant type parameters" ([Covariance and Contravariance in Generics](https://learn.microsoft.com/en-us/dotnet/standard/generics/covariance-and-contravariance)), so a `class` or `struct` can never mark one `in` or `out`, which is part of why the invariant `List<Circle>`/`List<Shape>` example above fails: `List<T>`'s own type parameter is invariant, even though it implements the covariant `IEnumerable<T>`.

::::exercise[Find the bug: a covariant feed that will not compile]
`ILiveFeed<out T>` is meant to be a read-only, covariant view over a sequence — the same idea as `IReadOnlyList<T>` from the paragraph above. It does not compile.

```csharp run error=CS1961
interface ILiveFeed<out T>
{
    T Latest { get; }
    T this[int index] { get; set; }
}
```

Before opening the solution: `Latest` is a plain `get`-only property and compiles fine on its own. Which member is the compiler actually rejecting, and why does combining `get` and `set` on it break covariance when `Latest`'s single `get` does not? What is the smallest change to `ILiveFeed<T>` that keeps index access and makes it compile?

:::solution
An indexer with both `get` and `set` is really two members sharing one syntax: the `get` needs `T` in an output position (fine for covariant `out T`), but the `set` needs `T` in an input position (fine only for contravariant `in T`). A single declaration cannot be covariant for reads and contravariant for writes at once, so the compiler requires `T` to be **invariantly** valid there instead — the exact conflict the `IList<T>` paragraph above describes for the same reason — and rejects it: `error CS1961: Invalid variance: The type parameter 'T' must be invariantly valid on 'ILiveFeed<T>.this[int]'. 'T' is covariant.` `Latest` never had this problem because it only ever declares `get`.

Dropping the indexer's `set` is the smallest fix, and it is exactly the shape `IReadOnlyList<T>` uses in the BCL:

```csharp run id=livefeed-fixed
ILiveFeed<Circle> circleFeed = new FeedAdapter<Circle>([new Circle()]);
ILiveFeed<Shape> shapeFeed = circleFeed;
Console.WriteLine(shapeFeed[0].GetType().Name);

interface ILiveFeed<out T>
{
    T Latest { get; }
    T this[int index] { get; }
}

class FeedAdapter<T>(IReadOnlyList<T> source) : ILiveFeed<T>
{
    public T Latest => source[^1];
    public T this[int index] => source[index];
}

class Shape;
class Circle : Shape;
```

```text output
Circle
```

`ILiveFeed<Circle>` now converts to `ILiveFeed<Shape>` the same way `IProducer<Circle>` did earlier, because every remaining member — `Latest` and the indexer's `get` — only ever returns `T`.
:::
::::

## Generic math: constraining `T` to `INumber<T>`

.NET 7 added [`INumber<TSelf>`](https://learn.microsoft.com/en-us/dotnet/api/system.numerics.inumber-1) and the interfaces around it, built on C# 11's `static abstract` interface members, so a type parameter can be constrained to "number-like" instead of one specific numeric type ([Generic math](https://learn.microsoft.com/en-us/dotnet/standard/generics/math)). `int`, `double`, `decimal`, and every other built-in numeric type already implement it, which is the specific thing a hand-rolled interface can't give you: a type you don't own can never be retrofitted to implement an interface you invent after the fact, so a custom `IClampable<T>` would only ever work for types you wrote yourself. `INumber<T>` works for `int` and `double` today because Microsoft put the implementation on those types directly, inside the BCL:

```csharp run id=generic-math
using System.Numerics;

int[] wholeHits = [3, 11, -2, 9];
double[] cpuLoad = [0.42, 1.15, -0.08];

Console.WriteLine(string.Join(", ", Clamped(wholeHits, 0, 10)));
Console.WriteLine(string.Join(", ", Clamped(cpuLoad, 0.0, 1.0)));

static IEnumerable<T> Clamped<T>(IEnumerable<T> values, T min, T max)
    where T : INumber<T>
{
    foreach (var v in values)
        yield return T.Clamp(v, min, max);
}
```

```text output
3, 10, 0, 9
0.42, 1, 0
```

`Clamped<T>` never mentions `int` or `double` — `T.Clamp(v, min, max)` resolves at compile time to whichever type argument the call site supplies, the same way `T.Zero` would. What's different from a hand-written `where T : IComparable<T>` clamp is where the logic lives: [`Clamp`](https://learn.microsoft.com/en-us/dotnet/api/system.numerics.inumber-1.clamp) is declared `public static virtual TSelf Clamp(TSelf value, TSelf min, TSelf max)` directly on `INumber<TSelf>` — `virtual`, not `abstract`, so it ships with a working default implementation, argument checking included (it throws `ArgumentException` if `min` is greater than `max`). `Clamped<T>` gets that behavior, correct for every built-in numeric type, from the constraint alone.

::::exercise[Extend it: a percentage that never casts to `double`]
`PercentOfTotal` is meant to turn each element of an array into its percentage of the array's sum — entirely in `T`, no matter which numeric type `T` turns out to be. The body sums the array but the percentage step is missing, and a percentage needs the number 100, which nothing in `values` supplies.

```csharp run id=percent-stub
using System.Numerics;

double[] cpuLoad = [0.42, 1.15, -0.08];
_ = PercentOfTotal(cpuLoad);

// Extend so result[i] is each value's percent
// of the total, computed entirely in T.
// INumberBase<T>.CreateChecked converts the
// literal 100 into T's own type — use it.

static T[] PercentOfTotal<T>(T[] values) where T : INumber<T>
{
    T total = T.Zero;
    foreach (var v in values) total += v;
    var result = new T[values.Length];
    // TODO: fill in result[i]
    return result;
}
```

Before opening the solution: there is no `(T)100` in C# — a cast only converts between types the compiler already knows how to convert. What does `T.CreateChecked(100)` do that a cast cannot, and where does the reachable-for-every-numeric-type property come from?

:::solution
`(T)100` doesn't compile because `T` is an unconstrained-looking type parameter as far as casting is concerned — the compiler has no idea, for a generic `T`, whether `100` converts to it at all. [`T.CreateChecked(100)`](https://learn.microsoft.com/en-us/dotnet/api/system.numerics.inumberbase-1.createchecked) sidesteps that: it's `public static virtual TSelf CreateChecked<TOther>(TOther value) where TOther : INumberBase<TOther>`, declared on `INumberBase<TSelf>`, so it takes the `int` literal `100` (itself an `INumberBase<int>`) and converts it to whichever `T` the constraint resolved to, throwing `OverflowException` if `T` can't represent it. It reaches every built-in numeric type for the same reason `Clamp` does: Microsoft implemented `INumberBase<TSelf>` directly on `int`, `double`, `decimal`, and the rest, so the conversion already exists no matter what `T` turns out to be.

```csharp run id=percent
using System.Numerics;

int[] wholeHits = [3, 11, -2, 9];
double[] cpuLoad = [0.42, 1.15, -0.08];

Console.WriteLine(string.Join(", ", PercentOfTotal(wholeHits)));
Console.WriteLine(string.Join(", ",
    PercentOfTotal(cpuLoad).Select(x => x.ToString("F1"))));

static T[] PercentOfTotal<T>(T[] values) where T : INumber<T>
{
    T total = T.Zero;
    foreach (var v in values) total += v;
    T hundred = T.CreateChecked(100);
    var result = new T[values.Length];
    for (int i = 0; i < values.Length; i++)
        result[i] = values[i] * hundred / total;
    return result;
}
```

```text output
14, 52, -9, 42
28.2, 77.2, -5.4
```

`values[i] * hundred / total` multiplies before it divides on purpose: for `T = int`, dividing first (`values[i] / total`) truncates to `0` for every element smaller than `total`, because that division already happened in integer arithmetic before the multiply ever ran. Multiplying first keeps the intermediate value large enough that the final integer division still lands on a meaningful percentage — a reordering a `double`-based version would never need to think about, but a fully generic one, valid for `int` too, does.
:::
::::
