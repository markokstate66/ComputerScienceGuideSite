---
title: "Value Types vs Reference Types: What Really Gets Copied"
description: "Run the copy experiments that separate C# structs from classes, measure what boxing allocates, and test the claim that structs live on the stack."
pillar: csharp-dotnet
order: 1
author: markus
published: 2026-09-21
updated: 2026-09-21
level: intermediate
tags: [value-types, reference-types, structs, boxing, memory-allocation]
prerequisites: []
sources:
  - title: "Value types (C# reference)"
    url: "https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/value-types"
    publisher: "Microsoft Learn"
    accessed: 2026-09-21
  - title: "Structure types (C# reference)"
    url: "https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/struct"
    publisher: "Microsoft Learn"
    accessed: 2026-09-21
  - title: "Method parameters and modifiers (C# reference)"
    url: "https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/keywords/method-parameters"
    publisher: "Microsoft Learn"
    accessed: 2026-09-21
  - title: "Boxing and Unboxing (C# programming guide)"
    url: "https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/types/boxing-and-unboxing"
    publisher: "Microsoft Learn"
    accessed: 2026-09-21
  - title: "ref struct types (C# reference)"
    url: "https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/ref-struct"
    publisher: "Microsoft Learn"
    accessed: 2026-09-21
  - title: "Records (C# reference)"
    url: "https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/record"
    publisher: "Microsoft Learn"
    accessed: 2026-09-21
  - title: "Compiler Error CS1612"
    url: "https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/compiler-messages/cs1612"
    publisher: "Microsoft Learn"
    accessed: 2026-09-21
  - title: "What's new in the .NET 10 runtime: stack allocation and escape analysis"
    url: "https://learn.microsoft.com/en-us/dotnet/core/whats-new/dotnet-10/runtime"
    publisher: "Microsoft Learn"
    accessed: 2026-09-21
  - title: "What's new in the .NET 9 runtime: object stack allocation for boxes"
    url: "https://learn.microsoft.com/en-us/dotnet/core/whats-new/dotnet-9/runtime"
    publisher: "Microsoft Learn"
    accessed: 2026-09-21
  - title: "GC.GetAllocatedBytesForCurrentThread Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.gc.getallocatedbytesforcurrentthread"
    publisher: "Microsoft Learn"
    accessed: 2026-09-21
  - title: "Explore C# string interpolation handlers"
    url: "https://learn.microsoft.com/en-us/dotnet/csharp/advanced-topics/performance/interpolated-string-handler"
    publisher: "Microsoft Learn"
    accessed: 2026-09-21
  - title: "Choosing Between Class and Struct (Framework Design Guidelines)"
    url: "https://learn.microsoft.com/en-us/dotnet/standard/design-guidelines/choosing-between-class-and-struct"
    publisher: "Microsoft Learn"
    accessed: 2026-09-21
  - title: "Eric Lippert, The Stack Is An Implementation Detail, Part One (archived MSDN blog)"
    url: "https://learn.microsoft.com/en-us/archive/blogs/ericlippert/the-stack-is-an-implementation-detail-part-one"
    publisher: "Microsoft Learn archive"
    accessed: 2026-09-21
draft: false
---

A variable of a [value type](/glossary/#value-type) contains the data itself. A variable of a [reference type](/glossary/#reference-type) contains a reference to an object that lives somewhere else. C# copies *what the variable contains* on every assignment, every argument pass and every return, so a struct gets duplicated and a class instance gets a second reference pointing at it. That is the whole definition in the [C# reference](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/value-types), and it says nothing about stacks or heaps.

The experiments below start with the copy, because the rest of the page (boxing, `ref`, the list element that refuses to change) is that one rule seen from a different side. Memory placement comes later, and it gets measured instead of asserted.

## One assignment, two outcomes

The two types below are identical except for the keyword. Each models a water tank with a fill level. The program copies a variable of each type, changes the copy, and prints the original.

```csharp run id=copy
var steel = new StructTank { Liters = 40 };
var steelCopy = steel;
steelCopy.Liters = 5;

var glass = new ClassTank { Liters = 40 };
var glassCopy = glass;
glassCopy.Liters = 5;

Console.WriteLine($"steel: {steel.Liters}");
Console.WriteLine($"glass: {glass.Liters}");
Console.WriteLine(
    ReferenceEquals(glass, glassCopy));

struct StructTank { public int Liters; }
class ClassTank { public int Liters; }
```

```text output
steel: 40
glass: 5
True
```

`steelCopy = steel` duplicated the tank, so draining the copy left `steel` at 40. `glassCopy = glass` duplicated a reference, so there was only ever one glass tank, and both names reach it. `ReferenceEquals` confirms that the two variables refer to the same object.

<figure class="diagram">
<svg viewBox="0 0 360 372" role="img" aria-labelledby="vr-copy-title vr-copy-desc">
<title id="vr-copy-title">What two variables hold after an assignment, for a struct and for a class</title>
<desc id="vr-copy-desc">Top: the struct variables steel and steelCopy are two separate boxes, one holding Liters 40 and the other Liters 5. Bottom: the class variables glass and glassCopy each hold a reference, and both arrows end at a single object holding Liters 5.</desc>
<defs>
<marker id="vr-copy-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-accent"/></marker>
</defs>
<text x="20" y="24" class="d-bold">struct: the variable is the tank</text>
<text x="20" y="50" class="d-mono d-small">steel</text>
<rect x="20" y="58" width="150" height="44" rx="6" class="d-box"/>
<text x="95" y="85" text-anchor="middle" class="d-mono">Liters = 40</text>
<text x="190" y="50" class="d-mono d-small">steelCopy</text>
<rect x="190" y="58" width="150" height="44" rx="6" class="d-box-accent"/>
<text x="265" y="85" text-anchor="middle" class="d-mono d-bold">Liters = 5</text>
<text x="20" y="124" class="d-muted d-small">Two variables, two tanks. Changing one cannot</text>
<text x="20" y="140" class="d-muted d-small">affect the other.</text>
<path d="M20 162 H340" class="d-line d-dashed"/>
<text x="20" y="192" class="d-bold">class: the variable is a reference</text>
<text x="20" y="218" class="d-mono d-small">glass</text>
<rect x="20" y="226" width="150" height="36" rx="6" class="d-box"/>
<text x="95" y="249" text-anchor="middle" class="d-muted d-small">reference</text>
<text x="190" y="218" class="d-mono d-small">glassCopy</text>
<rect x="190" y="226" width="150" height="36" rx="6" class="d-box"/>
<text x="265" y="249" text-anchor="middle" class="d-muted d-small">reference</text>
<path d="M95 262 L160 298" class="d-accent" marker-end="url(#vr-copy-arrow)"/>
<path d="M265 262 L200 298" class="d-accent" marker-end="url(#vr-copy-arrow)"/>
<rect x="105" y="300" width="150" height="44" rx="6" class="d-box-accent"/>
<text x="180" y="327" text-anchor="middle" class="d-mono d-bold">Liters = 5</text>
<text x="20" y="364" class="d-muted d-small">Two variables, one ClassTank object.</text>
</svg>
<figcaption>Figure 1. After the assignment, the struct exists twice and the class instance exists once. Assignment copied the contents of the variable in both cases; only the contents differ.</figcaption>
</figure>

Which types fall on which side is fixed by how the type was declared, never by how it is used:

- **Value types** are declared with `struct`, `enum` or `record struct`. From the library: `int`, `double`, `bool`, `char`, `decimal`, `DateTime`, `Guid`, tuples such as `(int, string)`, and nullable value types such as `int?`.
- **Reference types** are declared with `class`, `interface`, `delegate` or `record`. From the library: `string`, `object`, `List<T>`, `Task`, and every array, including `int[]`.

The built-in numeric types, `bool` and `char` are structs with literal syntax, and a tuple like `(int, string)` is a value type too ([C# reference](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/value-types#built-in-value-types)). Two entries deserve a second look. An array is a reference type even when its elements are value types: `int[] b = a;` gives you a second name for the same array. And `string` is a reference type that *feels* like a value because it is immutable: you can share a string freely since nobody can change it under you.

A value-type variable always holds a value, so it cannot be `null`; its default is the all-zero instance (`default(StructTank)` has `Liters == 0`). When "no value" is needed, `StructTank?` wraps the struct in `Nullable<T>`, which is itself a value type.

## A copy goes one level deep

Copying a struct copies its fields. If one of those fields is a reference, the reference is copied, not the object behind it. The struct below keeps a level and a maintenance log:

```csharp run id=shallow
var original = new LoggedTank(40);
original.Log.Add("installed");

var copy = original;
copy.Liters = 5;
copy.Log.Add("drained");

Show("original", original);
Show("copy", copy);

static void Show(string name, LoggedTank t) =>
    Console.WriteLine($"{name,-9}{t.Liters,2} L  "
        + string.Join(" > ", t.Log));

struct LoggedTank(int liters)
{
    public int Liters = liters;
    public List<string> Log = [];
}
```

```text output
original 40 L  installed > drained
copy      5 L  installed > drained
```

`Liters` diverged, the log did not: both structs hold a reference to the same `List<string>`. The C# reference describes exactly this case: the copy and the original "have access to the same reference-type instance" ([Value types](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/value-types)). A struct only behaves like an independent value if everything inside it is either a value or immutable.

::::exercise[Four numbers]
Arrays make a good test of the model, because an array element is a variable in its own right. The program below prints nothing. Predict the four values named in its comment, then open the solution, which prints them.

```csharp run id=elements
StructTank[] steel =
    [new() { Liters = 10 }, new() { Liters = 20 }];
ClassTank[] glass =
    [new() { Liters = 10 }, new() { Liters = 20 }];

var s = steel[0];
s.Liters = 99;
steel[1].Liters = 77;

var g = glass[0];
g.Liters = 99;
glass[1].Liters = 77;

// What do these four hold now?
//   steel[0].Liters, steel[1].Liters
//   glass[0].Liters, glass[1].Liters

struct StructTank { public int Liters; }
class ClassTank { public int Liters; }
```

:::solution
```csharp run id=elements-solved
StructTank[] steel =
    [new() { Liters = 10 }, new() { Liters = 20 }];
ClassTank[] glass =
    [new() { Liters = 10 }, new() { Liters = 20 }];

var s = steel[0];
s.Liters = 99;
steel[1].Liters = 77;

var g = glass[0];
g.Liters = 99;
glass[1].Liters = 77;

Console.WriteLine(
    $"steel: {steel[0].Liters} {steel[1].Liters}");
Console.WriteLine(
    $"glass: {glass[0].Liters} {glass[1].Liters}");

struct StructTank { public int Liters; }
class ClassTank { public int Liters; }
```

```text output
steel: 10 77
glass: 99 77
```

`var s = steel[0]` copied the element into a new variable, so the 99 went into the copy and `steel[0]` kept 10. `steel[1].Liters = 77` names the element itself, with no copy in between, so it sticks. For the class array, `g` and `glass[0]` are two references to one object, so both routes change it. The `steel[1].Liters = 77` line works for arrays only; [the list version does not compile](#the-list-element-that-will-not-change).
:::
::::

## Arguments are assignments: `ref`, `out` and `in`

Passing an argument is an assignment to the parameter, so the same copy happens. By default the method receives a copy of the struct, or a copy of the reference ([Method parameters](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/keywords/method-parameters)). The second case is sometimes summarized as "reference types are passed by reference"; Microsoft's older [design guidelines](https://learn.microsoft.com/en-us/dotnet/standard/design-guidelines/choosing-between-class-and-struct) word it that way. In C#'s own terms that is wrong: the reference is passed *by value*, and the difference shows as soon as the method assigns to its parameter.

```csharp run id=passing
var steel = new StructTank { Liters = 40 };
var glass = new ClassTank { Liters = 40 };

DrainStruct(steel);
DrainClass(glass);
Show("Drain", steel, glass);

Replace(glass);
Show("Replace", steel, glass);

DrainRef(ref steel);
ReplaceRef(ref glass);
Show("ref", steel, glass);

static void DrainStruct(StructTank t) =>
    t.Liters = 0;

static void DrainClass(ClassTank t) =>
    t.Liters = 0;

static void Replace(ClassTank t) =>
    t = new ClassTank { Liters = 500 };

static void DrainRef(ref StructTank t) =>
    t.Liters = 0;

static void ReplaceRef(ref ClassTank t) =>
    t = new ClassTank { Liters = 500 };

static void Show(
    string step, StructTank s, ClassTank g) =>
    Console.WriteLine($"{step,-8}"
        + $" steel={s.Liters,-3}"
        + $" glass={g.Liters}");

struct StructTank { public int Liters; }
class ClassTank { public int Liters; }
```

```text output
Drain    steel=40  glass=0
Replace  steel=40  glass=0
ref      steel=0   glass=500
```

Reading the three lines in order:

1. `DrainStruct(steel)` emptied a copy. `DrainClass(glass)` followed its copy of the reference to the one shared object and emptied that.
2. `Replace(glass)` pointed *its own* parameter at a new 500-liter tank. The caller's variable never noticed, which is what "the reference is passed by value" means.
3. With `ref`, the parameter is not a new variable at all. It is an alias for the caller's variable, so draining `t` drains `steel`, and assigning to `t` re-points `glass` at the new tank.

The four by-reference modifiers differ only in what each side promises ([Method parameters: reference parameters](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/keywords/method-parameters#reference-parameters)):

| Modifier | Set before call | Method assigns |
|---|---|---|
| `ref` | required | may |
| `out` | not required | must |
| `in` | required | cannot |
| `ref readonly` | required | cannot |

`out` is how `int.TryParse(text, out int n)` returns a second result. `in` and `ref readonly` exist for large structs: they pass an alias instead of copying the bytes, while forbidding assignment. They differ at the call site. `in` accepts any expression, and if you pass something that is not a variable (a literal, a property, a value needing conversion) the compiler quietly makes a temporary and passes a reference to that; `ref readonly` warns in the same situation, because its purpose is to insist on a real variable. For an `int` none of this pays: the same page notes that an `int` is no bigger than the reference that would replace it.

## Are structs "on the stack"? Measure it

The usual shorthand says value types live on the [call stack](/glossary/#call-stack) and reference types on the managed heap, the memory the [garbage collector](/csharp-dotnet/garbage-collection/) looks after. Both halves can be tested, because .NET reports heap allocation per thread: [`GC.GetAllocatedBytesForCurrentThread`](https://learn.microsoft.com/en-us/dotnet/api/system.gc.getallocatedbytesforcurrentthread) returns the bytes allocated on the managed heap so far, so the difference around a call is what that call put on the heap. Anything that shows 0 was placed somewhere else (the stack, or CPU registers) or optimized out of existence.

The measurements on this page were taken with .NET 10.0.10 on Windows 11, x64, on a desktop Core i7-11700K. Byte counts depend on the runtime version and on 64-bit pointers; they did not vary between runs here. Three details of the program:

- Its first line turns the optimizer on, because `dotnet run` on a single file builds a debug configuration, and the JIT does far less analysis on debug code.
- `Keep` is a non-inlined method that gives an object somewhere to escape to, so the optimizer cannot remove the allocation.
- `[CallerArgumentExpression]` hands `Report` the text of its argument, which labels each row with the method name. The culture line makes `N0` print `4,024` on every machine.

```csharp run id=where
#:property Optimize=true
using System.Globalization;
using System.Runtime.CompilerServices;

CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;

Report(LocalStruct);
Report(KeptObject);
Report(StructArray);
Report(ClassArray);
Report(Captured);
Report(LocalObject);

static void Report(
    Func<int> experiment,
    [CallerArgumentExpression(nameof(experiment))]
    string name = "")
{
    experiment();   // warm-up run, not measured
    long before = HeapBytes();
    int result = experiment();
    long bytes = HeapBytes() - before;
    Console.WriteLine($"{name,-12}{bytes,7:N0} B");
    GC.KeepAlive(result);
}

static long HeapBytes() =>
    GC.GetAllocatedBytesForCurrentThread();

// A struct local, used and returned.
static int LocalStruct()
{
    var tank = new StructTank { Liters = 40 };
    tank.Liters += 2;
    return tank.Liters;
}

// One object that escapes through Keep.
static int KeptObject()
{
    var tank = new ClassTank { Liters = 40 };
    Keep(tank);
    return tank.Liters;
}

static int StructArray()
{
    var tanks = new StructTank[1000];
    Keep(tanks);
    return tanks[999].Liters;
}

// The same array, as class instances.
static int ClassArray()
{
    var tanks = new ClassTank[1000];
    for (int i = 0; i < tanks.Length; i++)
        tanks[i] = new ClassTank();
    Keep(tanks);
    return tanks[999].Liters;
}

// A struct local that a lambda uses.
static int Captured()
{
    var tank = new StructTank { Liters = 40 };
    Func<int> read = () => tank.Liters;
    Keep(read);
    return read();
}

// KeptObject without the call to Keep.
[MethodImpl(MethodImplOptions.AggressiveOptimization)]
static int LocalObject()
{
    var tank = new ClassTank { Liters = 40 };
    tank.Liters += 2;
    return tank.Liters;
}

[MethodImpl(MethodImplOptions.NoInlining)]
static void Keep(object o) => GC.KeepAlive(o);

struct StructTank { public int Liters; }
class ClassTank { public int Liters; }
```

```text output
LocalStruct       0 B
KeptObject       24 B
StructArray   4,024 B
ClassArray   32,024 B
Captured         88 B
LocalObject       0 B
```

`LocalStruct` and `KeptObject` match the shorthand: a struct local costs no heap, and a `ClassTank` costs 24 bytes, of which 4 are the `int` and the rest is the per-object overhead and padding that a heap object carries on this runtime. The other four rows do not match it.

**A thousand structs on the heap.** `new StructTank[1000]` allocated 4,024 bytes: 1,000 tanks of 4 bytes each, stored inside the array object, plus 24 bytes for the array itself. An array is a heap object, and its value-type elements are *in* it. The same goes for a struct field of any class. The class array tells the other story: 8,000 bytes of references, 24 for the array, and then 1,000 separate 24-byte objects, about eight times the memory for the same data.

<figure class="diagram">
<svg viewBox="0 0 360 388" role="img" aria-labelledby="vr-arr-title vr-arr-desc">
<title id="vr-arr-title">Memory layout of an array of structs compared with an array of class instances</title>
<desc id="vr-arr-desc">Top: a StructTank array is a single heap block with a header followed by the Liters values stored side by side. Bottom: a ClassTank array is a heap block of references, each pointing to its own separate object that has its own header.</desc>
<defs>
<marker id="vr-arr-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-accent"/></marker>
</defs>
<text x="20" y="24" class="d-bold">StructTank[4]: one heap object</text>
<rect x="20" y="36" width="60" height="44" class="d-box-2"/>
<text x="50" y="63" text-anchor="middle" class="d-muted d-small">header</text>
<rect x="80" y="36" width="65" height="44" class="d-box-accent"/><text x="112" y="63" text-anchor="middle" class="d-mono">40</text>
<rect x="145" y="36" width="65" height="44" class="d-box-accent"/><text x="177" y="63" text-anchor="middle" class="d-mono">12</text>
<rect x="210" y="36" width="65" height="44" class="d-box-accent"/><text x="242" y="63" text-anchor="middle" class="d-mono">35</text>
<rect x="275" y="36" width="65" height="44" class="d-box-accent"/><text x="307" y="63" text-anchor="middle" class="d-mono">8</text>
<text x="20" y="102" class="d-muted d-small">The tanks are the elements: side by side, 4 bytes</text>
<text x="20" y="118" class="d-muted d-small">each, no per-tank overhead.</text>
<path d="M20 140 H340" class="d-line d-dashed"/>
<text x="20" y="170" class="d-bold">ClassTank[4]: one array + four objects</text>
<rect x="20" y="182" width="60" height="44" class="d-box-2"/>
<text x="50" y="209" text-anchor="middle" class="d-muted d-small">header</text>
<rect x="80" y="182" width="65" height="44" class="d-box"/><text x="112" y="209" text-anchor="middle" class="d-muted d-small">ref</text>
<rect x="145" y="182" width="65" height="44" class="d-box"/><text x="177" y="209" text-anchor="middle" class="d-muted d-small">ref</text>
<rect x="210" y="182" width="65" height="44" class="d-box"/><text x="242" y="209" text-anchor="middle" class="d-muted d-small">ref</text>
<rect x="275" y="182" width="65" height="44" class="d-box"/><text x="307" y="209" text-anchor="middle" class="d-muted d-small">ref</text>
<path d="M112 226 V254" class="d-accent" marker-end="url(#vr-arr-arrow)"/>
<path d="M177 226 V304" class="d-accent" marker-end="url(#vr-arr-arrow)"/>
<path d="M242 226 V254" class="d-accent" marker-end="url(#vr-arr-arrow)"/>
<path d="M307 226 V304" class="d-accent" marker-end="url(#vr-arr-arrow)"/>
<rect x="82" y="256" width="30" height="36" class="d-box-2"/><text x="97" y="279" text-anchor="middle" class="d-muted d-small">hdr</text>
<rect x="112" y="256" width="30" height="36" class="d-box-accent"/><text x="127" y="279" text-anchor="middle" class="d-mono d-small">40</text>
<rect x="212" y="256" width="30" height="36" class="d-box-2"/><text x="227" y="279" text-anchor="middle" class="d-muted d-small">hdr</text>
<rect x="242" y="256" width="30" height="36" class="d-box-accent"/><text x="257" y="279" text-anchor="middle" class="d-mono d-small">35</text>
<rect x="147" y="306" width="30" height="36" class="d-box-2"/><text x="162" y="329" text-anchor="middle" class="d-muted d-small">hdr</text>
<rect x="177" y="306" width="30" height="36" class="d-box-accent"/><text x="192" y="329" text-anchor="middle" class="d-mono d-small">12</text>
<rect x="277" y="306" width="30" height="36" class="d-box-2"/><text x="292" y="329" text-anchor="middle" class="d-muted d-small">hdr</text>
<rect x="307" y="306" width="30" height="36" class="d-box-accent"/><text x="322" y="329" text-anchor="middle" class="d-mono d-small">8</text>
<text x="20" y="368" class="d-muted d-small">Each tank is its own object with its own header (hdr).</text>
</svg>
<figcaption>Figure 2. Both arrays are on the heap. The struct array stores its tanks inline; the class array stores references to tanks that each carry their own header, which is where the 4,024 versus 32,024 bytes came from.</figcaption>
</figure>

**A struct local on the heap.** `Captured` declares a plain local `StructTank`, yet the method allocated 88 bytes. A lambda uses the variable, and a variable that a lambda uses has to outlive the method call, so the compiler moves it into a field of a hidden class: the .NET 10 runtime notes describe each capturing lambda as becoming "a closure class with a method corresponding to the delegate's definition and fields matching any captured variables" ([escape analysis for delegates](https://learn.microsoft.com/en-us/dotnet/core/whats-new/dotnet-10/runtime#delegates)). The 88 bytes are that closure object plus the delegate.

**A class instance that is not on the heap.** `LocalObject` says `new ClassTank` and allocates nothing. Recent JIT compilers perform *escape analysis*: if the JIT can prove an object cannot outlive the method that creates it, it may put the object on the stack, and once there it can often replace the object with its plain field values. The release notes document this for boxes in .NET 9, and for small arrays, delegates and objects referenced from local struct fields in .NET 10 ([.NET 9](https://learn.microsoft.com/en-us/dotnet/core/whats-new/dotnet-9/runtime#object-stack-allocation-for-boxes), [.NET 10](https://learn.microsoft.com/en-us/dotnet/core/whats-new/dotnet-10/runtime#stack-allocation)). The measurement shows the .NET 10 JIT doing it for this ordinary class instance as well. `KeptObject` creates the same object but hands it to a method the JIT may not inline, so it escapes and costs 24 bytes. This is an optimization, not a promise: it needs optimized code, and what qualifies changes between runtime versions.

So placement follows *lifetime*, not the `struct` keyword. Storage that dies with the method call can go on the stack or in registers; storage that may outlive it goes on the heap; and a value type is simply stored inline in whatever contains it, be that a stack frame, an array, or another object.

The older design guidelines say the same in fewer words: value types are allocated "either on the stack or inline in containing types" ([Choosing Between Class and Struct](https://learn.microsoft.com/en-us/dotnet/standard/design-guidelines/choosing-between-class-and-struct)). Eric Lippert, then on the C# compiler team, argued in [The Stack Is An Implementation Detail](https://learn.microsoft.com/en-us/archive/blogs/ericlippert/the-stack-is-an-implementation-detail-part-one) that the defining property of a value type is that it is copied by value, and that a runtime is free to pick any storage strategy that preserves that. The six rows above are what that freedom looks like in .NET 10.

## Boxing: a value gets an object of its own

Every ordinary type in C# converts to `object`, and a struct can implement interfaces. But an `object` or interface variable holds a reference, and a struct value is not a thing a reference can point to. *Boxing* closes the gap: the runtime allocates an object, copies the value into it, and hands back a reference to that object. *Unboxing*, written as a cast, checks the type and copies the value back out ([Boxing and Unboxing](https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/types/boxing-and-unboxing)). Boxing happens implicitly, which is why it is easy to overlook.

One family opts out entirely: a `ref struct` such as `Span<T>` is built to guarantee it never reaches the heap, so the compiler refuses to box it to `object`, to `System.ValueType`, or to an interface it implements ([ref struct types](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/ref-struct)). That restriction is what makes `Span<T>` safe to point at stack memory in the first place.

<figure class="diagram">
<svg viewBox="0 0 360 306" role="img" aria-labelledby="vr-box-title vr-box-desc">
<title id="vr-box-title">Boxing copies a struct value into a new heap object</title>
<desc id="vr-box-desc">The variable tank holds Liters 40. Boxing copies that value into a new heap object made of a header and the value 40, and the variable boxed holds a reference to that object. When tank is later set to 5, the boxed copy still holds 40.</desc>
<defs>
<marker id="vr-box-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-accent"/></marker>
<marker id="vr-box-arrow2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-stroke"/></marker>
</defs>
<text x="20" y="24" class="d-mono d-small">tank</text>
<rect x="20" y="32" width="150" height="44" rx="6" class="d-box"/>
<text x="95" y="59" text-anchor="middle" class="d-mono">Liters = 40</text>
<text x="190" y="24" class="d-mono d-small">boxed</text>
<rect x="190" y="32" width="150" height="44" rx="6" class="d-box"/>
<text x="265" y="59" text-anchor="middle" class="d-muted d-small">reference</text>
<path d="M95 76 V150" class="d-line d-dashed" marker-end="url(#vr-box-arrow2)"/>
<text x="20" y="116" class="d-muted d-small">copy the</text>
<text x="20" y="132" class="d-muted d-small">value in</text>
<path d="M265 76 L225 150" class="d-accent" marker-end="url(#vr-box-arrow)"/>
<text x="258" y="124" class="d-text-accent d-small">points to</text>
<text x="20" y="176" class="d-bold">New object on the managed heap</text>
<rect x="60" y="188" width="90" height="44" class="d-box-2"/>
<text x="105" y="215" text-anchor="middle" class="d-muted d-small">header</text>
<rect x="150" y="188" width="150" height="44" class="d-box-accent"/>
<text x="225" y="215" text-anchor="middle" class="d-mono d-bold">Liters = 40</text>
<text x="20" y="260" class="d-muted d-small">object boxed = tank;  allocates, then copies.</text>
<text x="20" y="278" class="d-muted d-small">A later tank.Liters = 5 changes only the variable:</text>
<text x="20" y="294" class="d-muted d-small">the box still holds 40.</text>
</svg>
<figcaption>Figure 3. A box is a snapshot. It is a separate heap object holding a copy of the value, so the variable and the box go their own ways afterwards.</figcaption>
</figure>

Because the box is a copy, a change to the variable does not reach the box, and a change made through an interface reference lands in the box and never reaches the variable:

```csharp run id=boxcopy
var tank = new StructTank { Liters = 40 };

// Box: allocate an object, copy tank into it.
object boxed = tank;
tank.Liters = 5;
var unboxed = (StructTank)boxed;
Console.WriteLine($"boxed: {unboxed.Liters}");

// Converting to an interface boxes too.
IDrainable drainable = tank;
drainable.Drain();
Console.WriteLine($"tank:  {tank.Liters}");

interface IDrainable { void Drain(); }

struct StructTank : IDrainable
{
    public int Liters;
    public void Drain() => Liters = 0;
}
```

```text output
boxed: 40
tank:  5
```

Unboxing is exact. The cast must name the type that was boxed, even where a plain numeric conversion would be legal. A boxed `int` cannot be unboxed as a `long`:

```csharp run throws=InvalidCastException
object boxed = 42;
long wide = (long)boxed;
Console.WriteLine(wide);
```

`(long)(int)boxed` works: unbox to the real type first, then convert.

### What a million boxes cost

The program fills a list with a million integers and sums them, first as `List<int>`, then as `List<object>`, where every `Add` boxes and every read unboxes. Both lists are created with their final capacity so that growth copies do not muddy the numbers.

```csharp run id=boxcost
#:property Optimize=true
using System.Diagnostics;
using System.Globalization;

CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;
const int N = 1_000_000;

Run("List<int>", () =>
{
    var list = new List<int>(N);
    for (int i = 0; i < N; i++)
        list.Add(i);
    long sum = 0;
    foreach (int x in list)
        sum += x;
    return sum;
});

Run("List<object>", () =>
{
    var list = new List<object>(N);
    for (int i = 0; i < N; i++)
        list.Add(i);          // boxes i
    long sum = 0;
    foreach (object x in list)
        sum += (int)x;        // unboxes
    return sum;
});

static void Run(
    string name, Func<long> work)
{
    work();   // warm-up run, not measured
    long before = HeapBytes();
    long start = Stopwatch.GetTimestamp();
    long sum = work();
    double ms = Stopwatch.GetElapsedTime(start)
        .TotalMilliseconds;
    long bytes = HeapBytes() - before;
    Console.WriteLine(
        $"{name,-13}{bytes,11:N0} B{ms,8:F1} ms");
    GC.KeepAlive(sum);
}

static long HeapBytes() =>
    GC.GetAllocatedBytesForCurrentThread();
```

```text output
List<int>      4,000,[...] B[...] ms
List<object>  32,000,[...] B[...] ms
```

On this machine the `int` version took about 3 ms and the `object` version about 95 to 100 ms, roughly thirty times slower. The byte counts explain it. `List<int>` allocated one 4 MB array with the integers inline. `List<object>` allocated an 8 MB array of references and then a million boxes of 24 bytes each: 24 MB of tiny objects for 4 MB of data, every one of them work for the garbage collector. Avoiding this is a large part of [what generics are for](/csharp-dotnet/generics/): `List<int>` has an `int[]` inside it, not an `object[]`.

Boxing happens wherever a value meets a location typed as `object`, `System.ValueType`, `System.Enum` or an interface: non-generic collections such as `ArrayList`, a `params object[]` parameter, a struct stored in an interface-typed field, a struct passed to a method that takes an interface. For that last case there is a way out. A generic method with an interface *constraint* accepts the same arguments, but `T` is the struct type itself, so no reference, and no box, is needed:

```csharp run id=constraint
using System.Runtime.CompilerServices;

var tank = new StructTank { Liters = 40 };

Report("interface", () => ReadBoxed(tank));
Report("generic", () => Read(tank));

static void Report(
    string what, Func<int> read)
{
    read();   // warm-up run, not measured
    long before = HeapBytes();
    int liters = read();
    long bytes = HeapBytes() - before;
    Console.WriteLine(
        $"{what,-10}{liters,3} L{bytes,4} B");
}

static long HeapBytes() =>
    GC.GetAllocatedBytesForCurrentThread();

[MethodImpl(MethodImplOptions.NoInlining)]
static int ReadBoxed(IHasLiters source) =>
    source.Liters;

[MethodImpl(MethodImplOptions.NoInlining)]
static int Read<T>(T source)
    where T : IHasLiters =>
    source.Liters;

interface IHasLiters { int Liters { get; } }

struct StructTank : IHasLiters
{
    public int Liters { get; set; }
}
```

```text output
interface  40 L  24 B
generic    40 L   0 B
```

## Mutable structs and the copies you did not ask for

Every experiment so far made its copies in plain sight. The trouble with a struct whose fields can change is that C# also makes copies where no assignment is written, and a mutation that lands on one of those is lost.

### The list element that will not change

`steel[1].Liters = 77` worked on an array. The same line on a `List<StructTank>` is a compile error:

```csharp run error=CS1612
List<StructTank> fleet = [new()];
fleet[0].Liters = 5;

struct StructTank { public int Liters; }
```

An array element is a variable. A list indexer is a method that *returns* a value, and for a struct that return value is a copy. The compiler can see that assigning to a field of a temporary copy would do nothing, so it refuses ([CS1612](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/compiler-messages/cs1612)). The fix is to copy the element into a local, change the local, and assign it back to `fleet[0]`; the exercise at the end of this section does exactly that. With a class the line compiles and works, because the indexer returns a reference to the one object.

### Three copies the compiler does not flag

CS1612 only catches direct assignment to a field or property. Call a *method* that mutates, and the compiler has no way to know the call is pointless, so it compiles. `Meter` counts ticks; the program ticks four meters and only one of them counts.

```csharp run id=hidden
var station = new Station();
station.TickEverything();

class Station
{
    private Meter _plain;
    private readonly Meter _frozen;
    public Meter Exposed { get; set; }

    public void TickEverything()
    {
        _plain.Tick();
        _frozen.Tick();
        Exposed.Tick();
        Show("_plain", _plain);
        Show("_frozen", _frozen);
        Show("Exposed", Exposed);

        TickIn(in _plain);
        Show("_plain", _plain);
    }

    static void TickIn(in Meter meter)
    {
        meter.Tick();
        Show("meter", meter);
    }

    static void Show(string name, Meter m) =>
        Console.WriteLine(
            $"{name,-8}{m.Ticks}");
}

struct Meter
{
    public int Ticks;
    public void Tick() => Ticks++;
}
```

```text output
_plain  1
_frozen 0
Exposed 0
meter   1
_plain  1
```

- `_frozen` is a `readonly` field. The compiler must keep it unchanged but cannot tell whether `Tick` writes, so it runs `Tick` on a temporary copy and throws the copy away.
- `Exposed` is a property. Its getter returns a copy, the same mechanism as the list indexer, and `Tick` increments that.
- `meter` is an `in` parameter. It aliases `_plain`, which held 1, and the alias is read-only, so `Tick` again ran on a copy: `meter` still reads 1 inside `TickIn`, and so does `_plain` back in the caller.

The struct documentation describes this *defensive copy* for the closely related case of a `readonly` member calling a non-`readonly` one: "the compiler creates a copy of the structure instance and calls the non-`readonly` member on that copy" ([readonly instance members](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/struct#readonly-instance-members)). None of the three produces a warning in a default build. Besides being wrong, the copies undo the reason for using `in` in the first place.

::::exercise[Find the lost update]
A maintenance job is supposed to take 5 liters out of every tank in the fleet. It compiles without warnings, and the levels do not move. Why, and what is the smallest fix that keeps `StructTank` a struct?

```csharp run id=lostupdate
List<StructTank> fleet =
    [new() { Liters = 40 }, new() { Liters = 60 }];

for (int i = 0; i < fleet.Count; i++)
{
    var tank = fleet[i];
    tank.Liters -= 5;
}

Console.WriteLine(string.Join(" ",
    fleet.Select(t => t.Liters)));

struct StructTank { public int Liters; }
```

```text output
40 60
```

:::solution
`var tank = fleet[i]` copies the element, the subtraction changes the copy, and the copy is dropped at the end of the iteration. It is the manual version of what CS1612 forbids, split over two statements so the compiler no longer objects. Writing the copy back fixes it:

```csharp run id=lostupdate-fixed
List<StructTank> fleet =
    [new() { Liters = 40 }, new() { Liters = 60 }];

for (int i = 0; i < fleet.Count; i++)
{
    var tank = fleet[i];
    tank.Liters -= 5;
    fleet[i] = tank;      // the missing line
}

Console.WriteLine(string.Join(" ",
    fleet.Select(t => t.Liters)));

struct StructTank { public int Liters; }
```

```text output
35 55
```

A `foreach` over the list would not have helped: assigning to a member of a struct-typed `foreach` variable is a compile error too (CS1654), for the same reason as CS1612. If the type needs to be updated in place this often, that is a sign it wants to be a class.
:::
::::

## `readonly struct` and `record struct`: copies that cannot hurt

All of the lost updates above need one ingredient: a struct that can change after it is created. Remove that and every hidden copy becomes harmless, because a copy of an immutable value is indistinguishable from the original. Microsoft's struct guidance is blunt about it: "we recommend you define *immutable* structure types" ([Structure types](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/struct)).

`readonly struct` makes the compiler enforce that: every field must be `readonly` and every property get-only or `init`-only. It also tells the compiler that no member can write to `this`, so the defensive copies from the previous section are not needed. To "change" such a value you build a new one, and the `with` expression does that without listing every member.

`record struct` adds what a data-carrying value usually wants: a constructor and properties from one line, value-based `==`, and a readable `ToString`. There is a trap in the defaults. A positional `record class` gets `init`-only properties, but a positional `record struct` gets ordinary *read-write* properties; it takes `readonly record struct` to get the immutable version ([Records](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/record#immutability)).

```csharp run id=records
var dawn = new Level("north", 40);
var dusk = dawn with { Liters = 35 };
var same = new Level("north", 40);

Console.WriteLine(dawn);
Console.WriteLine(dusk);
Console.WriteLine(dawn == same);

// Compiles: LooseLevel is not readonly.
var loose = new LooseLevel("north", 40);
loose.Liters = 0;
Console.WriteLine(loose);

readonly record struct Level(
    string Tank, int Liters);

record struct LooseLevel(
    string Tank, int Liters);
```

```text output
Level { Tank = north, Liters = 40 }
Level { Tank = north, Liters = 35 }
True
LooseLevel { Tank = north, Liters = 0 }
```

The same assignment on the `readonly` version does not compile:

```csharp run error=CS8852
var level = new Level("north", 40);
level.Liters = 0;

readonly record struct Level(
    string Tank, int Liters);
```

Equality is where the record form also pays in performance. A plain struct inherits `Equals(object)` from `System.ValueType`; the records page notes that this inherited implementation "relies on reflection", while a record's is generated by the compiler from the declared members ([Records: value equality](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/record#value-equality)). The inherited method also takes an `object`, which means boxing. Measured with the same technique as before:

```csharp run id=equals
var p1 = new PlainLevel { Liters = 40 };
var p2 = new PlainLevel { Liters = 40 };
var e1 = new EquatableLevel { Liters = 40 };
var e2 = new EquatableLevel { Liters = 40 };
var r1 = new RecordLevel(40);
var r2 = new RecordLevel(40);

Report("one box", () => Box(p1) != null);
Report("plain", () => p1.Equals(p2));
Report("equatable", () => e1.Equals(e2));
Report("record", () => r1.Equals(r2));

static object Box(PlainLevel level) =>
    level;

static void Report(
    string what, Func<bool> test)
{
    test();   // warm-up run, not measured
    long before = HeapBytes();
    bool result = test();
    long bytes = HeapBytes() - before;
    Console.WriteLine(
        $"{what,-10}{result,-5}{bytes,3} B");
}

static long HeapBytes() =>
    GC.GetAllocatedBytesForCurrentThread();

struct PlainLevel { public int Liters; }

struct EquatableLevel : IEquatable<EquatableLevel>
{
    public int Liters;

    public readonly bool Equals(EquatableLevel other) =>
        Liters == other.Liters;

    public override readonly bool Equals(object? obj) =>
        obj is EquatableLevel other && Equals(other);

    public override readonly int GetHashCode() =>
        Liters;
}

readonly record struct RecordLevel(int Liters);
```

```text output
one box   True  24 B
plain     True  48 B
equatable True   0 B
record    True   0 B
```

One comparison of two plain structs allocated exactly two boxes' worth of memory; the record struct allocated nothing. Neither did `EquatableLevel`, a plain struct that implements `IEquatable<T>` by hand: overload resolution picks its strongly typed `Equals(EquatableLevel)`, so nothing is converted to `object`. A record struct gets that method generated for it. The difference matters when a struct is a dictionary key or is searched for in a list, because those operations call `Equals` many times.

## When a struct is the right call

Default to a class. Reach for a struct when the thing you are modeling *is* a value (a measurement, a coordinate pair, an amount of money, a date range) and it meets the conditions the framework designers set for their own types ([Choosing Between Class and Struct](https://learn.microsoft.com/en-us/dotnet/standard/design-guidelines/choosing-between-class-and-struct)): it represents a single value, it is small, it is immutable, and it will not be boxed frequently. Their size threshold is an instance under 16 bytes.

That page is reprinted from a 2008 book and carries a notice that parts may be out of date; `in` parameters and `readonly struct` have since made somewhat larger structs cheaper to pass around, but the direction of the advice stands, because every by-value pass of a struct copies all of its bytes while a reference stays pointer-sized no matter how big the object is.

The measurements above give the two honest performance arguments. For: a large array or list of small structs is one allocation with the data packed together, against one allocation per element for a class (4,024 versus 32,024 bytes for a thousand tanks). Against: if the struct ends up in `object` or interface variables, each trip allocates a box, and the advantage turns into a cost. Neither argument is about the stack.

## Practice: follow the copies

The first two exercises are [above](#a-copy-goes-one-level-deep), where they fit the flow. These two use the measuring technique from this page.

::::exercise[Measure it: does string interpolation box?]
`string.Format("{0} L", liters)` takes its arguments as `object`. Does the interpolated string `$"{liters} L"` also box the `int`? Both produce the same 4-character string for `liters = 40`. Write a program that measures the heap bytes of each, after a warm-up, and explain the difference.

:::solution
```csharp run id=interp
int liters = 40;

Report("interpolated", () => $"{liters} L");
Report("string.Format",
    () => string.Format("{0} L", liters));

static void Report(
    string what, Func<string> make)
{
    make();   // warm-up run, not measured
    long before = HeapBytes();
    string text = make();
    long bytes = HeapBytes() - before;
    Console.WriteLine(
        $"{what,-14}{text,-6}{bytes,3} B");
}

static long HeapBytes() =>
    GC.GetAllocatedBytesForCurrentThread();
```

```text output
interpolated  40 L   32 B
string.Format 40 L   56 B
```

Both rows include the 32 bytes of the resulting string. `string.Format` allocated 24 bytes more, which is the size of one boxed `int` measured earlier: its parameter is an `object`, so the argument is boxed. For an interpolated string the compiler emits calls to `AppendLiteral` and to a generic `AppendFormatted<T>` on a handler type ([string interpolation handlers](https://learn.microsoft.com/en-us/dotnet/csharp/advanced-topics/performance/interpolated-string-handler)), so, as with `Read<T>` above, the `int` is passed as an `int`. These byte counts are from .NET 10.0.10 on x64 and the exact values may differ on other runtimes; the 24-byte gap is the point.
:::
::::

::::exercise[Extend it: make the object escape]
In the `where` program, `LocalObject` allocated 0 bytes. Without removing `AggressiveOptimization`, make one change that brings it back to 24 bytes, and one different change that brings `Captured` down from 88 bytes to 0. Predict first, then run.

:::solution
For `LocalObject`, let the object escape: add `Keep(tank);` before the `return`. `Keep` is marked `NoInlining`, so the JIT cannot see what it does with the reference and has to assume the object may outlive the method. That is precisely how `KeptObject` differs, and it prints 24 B.

For `Captured`, the heap allocation exists because a lambda captures the local. Remove the capture and the struct is an ordinary local again:

```csharp run
long before = HeapBytes();
int liters = NotCaptured();
long bytes = HeapBytes() - before;
Console.WriteLine($"{liters} L, {bytes} B");

static long HeapBytes() =>
    GC.GetAllocatedBytesForCurrentThread();

static int NotCaptured()
{
    var tank = new StructTank { Liters = 40 };
    return Read(tank);
}

static int Read(StructTank t) => t.Liters;

struct StructTank { public int Liters; }
```

```text output
40 L, 0 B
```
:::
::::
