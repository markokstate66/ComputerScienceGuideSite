---
title: "The Four Pillars of OOP, Without the Clichés"
description: "What encapsulation, polymorphism, inheritance and abstraction each fix, shown in C# on a billing system, down to how .NET dispatches a virtual call."
pillar: oop-design
order: 1
author: markus
published: 2026-09-18
updated: 2026-09-21
level: beginner
tags: [oop, encapsulation, polymorphism, inheritance, virtual-dispatch]
prerequisites: []
sources:
  - title: "Object-oriented programming (C# tutorial)"
    url: "https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/tutorials/oop"
    publisher: "Microsoft Learn"
    accessed: 2026-09-18
  - title: "Object-oriented programming: inheritance"
    url: "https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/object-oriented/inheritance"
    publisher: "Microsoft Learn"
    accessed: 2026-09-18
  - title: "C# language specification: Classes (virtual methods, constructor execution)"
    url: "https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/language-specification/classes"
    publisher: "Microsoft Learn"
    accessed: 2026-09-21
  - title: "C# language specification: Expressions (static binding, overload resolution)"
    url: "https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/language-specification/expressions"
    publisher: "Microsoft Learn"
    accessed: 2026-09-18
  - title: "Book of the Runtime: Type Loader Design"
    url: "https://github.com/dotnet/runtime/blob/main/docs/design/coreclr/botr/type-loader.md"
    publisher: "dotnet/runtime"
    accessed: 2026-09-18
  - title: "Book of the Runtime: Method Descriptor"
    url: "https://github.com/dotnet/runtime/blob/main/docs/design/coreclr/botr/method-descriptor.md"
    publisher: "dotnet/runtime"
    accessed: 2026-09-18
  - title: "Book of the Runtime: Virtual Stub Dispatch"
    url: "https://github.com/dotnet/runtime/blob/main/docs/design/coreclr/botr/virtual-stub-dispatch.md"
    publisher: "dotnet/runtime"
    accessed: 2026-09-18
  - title: "Guarded Devirtualization (JIT design document)"
    url: "https://github.com/dotnet/runtime/blob/main/docs/design/coreclr/jit/GuardedDevirtualization.md"
    publisher: "dotnet/runtime"
    accessed: 2026-09-21
  - title: "MethodInfo.GetBaseDefinition Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.reflection.methodinfo.getbasedefinition"
    publisher: "Microsoft Learn"
    accessed: 2026-09-18
  - title: "List<T>.AsReadOnly Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.list-1.asreadonly"
    publisher: "Microsoft Learn"
    accessed: 2026-09-18
  - title: "CA2214: Do not call overridable methods in constructors"
    url: "https://learn.microsoft.com/en-us/dotnet/fundamentals/code-analysis/quality-rules/ca2214"
    publisher: "Microsoft Learn"
    accessed: 2026-09-18
  - title: "Framework Design Guidelines: Virtual Members"
    url: "https://learn.microsoft.com/en-us/dotnet/standard/design-guidelines/virtual-members"
    publisher: "Microsoft Learn"
    accessed: 2026-09-18
  - title: "Design Patterns: Elements of Reusable Object-Oriented Software, chapters 1 (Inheritance versus Composition) and 5 (Template Method)"
    url: "https://www.pearson.com/en-us/subject-catalog/p/design-patterns-elements-of-reusable-object-oriented-software/P200000009480"
    publisher: "Addison-Wesley"
    accessed: 2026-09-18
  - title: "The Expression Problem (Philip Wadler, 12 November 1998)"
    url: "https://homepages.inf.ed.ac.uk/wadler/papers/expression/expression.txt"
    publisher: "University of Edinburgh"
    accessed: 2026-09-21
  - title: "Compiler Warning (level 2) CS0108"
    url: "https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/compiler-messages/cs0108"
    publisher: "Microsoft Learn"
    accessed: 2026-09-21
draft: true
---

Each of the four words answers a different question about code that has to keep changing. Encapsulation: who is able to put this object into a state that makes no sense? Polymorphism: how many places must be edited when a new variant arrives? Inheritance: where does shared code live, and what does sharing it tie together? Abstraction: what is a caller allowed to rely on?

The list is a teaching convention. Microsoft's C# tutorial names abstraction, encapsulation, inheritance and polymorphism as "the four basic principles" of object-oriented programming [[1]](https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/tutorials/oop), while its own page on inheritance speaks of "three primary characteristics" and leaves abstraction out [[2]](https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/object-oriented/inheritance). Instead of memorizing four definitions, learn what each one is for, because that tells you when to use it and when to leave it alone.

Every example below comes from one small domain: a subscription billing system with invoices, pricing plans and a payment gateway. The programs use current C# (records, primary constructors, collection expressions); each one is complete and prints the output shown under it.

## What problem does each pillar solve?

| Pillar | What goes wrong without it |
|---|---|
| Encapsulation | Any code can corrupt state |
| Polymorphism | Every variant edits a `switch` |
| Inheritance | Similar classes repeat code |
| Abstraction | Callers see changing details |

Two of the four have a price that one-line definitions leave out. Polymorphism costs an indirect call at run time, and inheritance binds a derived class to the inner workings of its base. Both are shown below with programs you can run.

## What is encapsulation really protecting?

Encapsulation means keeping an object's data private and letting only the object's own methods change it. Hiding data is the mechanism; the goal is to protect an [invariant](/glossary/#invariant), a condition that is true of an object every time a public method returns. An invoice has several. Every line amount is above zero. The amount paid is never negative and never more than the total. A paid invoice owes nothing, and an issued one still owes something. One more rule is about change over time: the lines stop changing once the invoice has been issued.

Here is an invoice with no protection at all. Three lines of calling code, each plausible by itself, leave it in a state no real invoice can be in.

```csharp run
var invoice = new OpenInvoice();
invoice.Lines.Add(
    new("Team plan", 245m));
invoice.Total = 245m;

// Three call sites, three mistakes:
invoice.Paid += 300m;     // overpays
invoice.Lines.Add(
    new("Setup fee", 99m));
invoice.Status = "Paid";  // 44 is owed

decimal lineSum =
    invoice.Lines.Sum(l => l.Amount);
Print("Status", invoice.Status);
Print("Total", invoice.Total);
Print("Line sum", lineSum);
Print("Owed", lineSum - invoice.Paid);

static void Print(string name, object v)
    => Console.WriteLine(
        $"{name,-9}{v}");

record Line(string Text, decimal Amount);

class OpenInvoice
{
    public List<Line> Lines = [];
    public decimal Total;
    public decimal Paid;
    public string Status = "Draft";
}
```

```text output
Status   Paid
Total    245
Line sum 344
Owed     44
```

The invoice says it is paid, its stored total disagrees with its own lines, and 44 is still owed. Nothing crashed. The wrong numbers will surface later, in a report or a customer email, far from the line that caused them. With public fields, the rules of an invoice live in the heads of everyone who writes to it, and every one of those call sites has to get them right.

### An invoice that cannot be put into a wrong state

The fix is to make the class the only code that can write its state, and to have every writing method check the rules first. In the listing, read `AddLine`, `Issue` and `RecordPayment`; the lines above the `enum` are only a driver that exercises them.

```csharp run id=invoice
var invoice = new Invoice();
invoice.AddLine("Team plan", 245m);
invoice.AddLine("Setup fee", 99m);
invoice.Issue();
invoice.RecordPayment(300m);
Show(invoice);

Attempt(() =>
    invoice.RecordPayment(50m));
Attempt(() =>
    invoice.AddLine("Tip", 10m));

invoice.RecordPayment(44m);
Show(invoice);

static void Show(Invoice i)
    => Console.WriteLine(
        $"{i.Status}: total {i.Total}" +
        $", owed {i.Balance}");

static void Attempt(Action change)
{
    try { change(); }
    catch (InvalidOperationException e)
    {
        Console.WriteLine(
            $"Rejected: {e.Message}");
    }
}

enum Status { Draft, Issued, Paid }

record Line(string Text, decimal Amount);

sealed class Invoice
{
    private readonly List<Line>
        _lines = [];
    private decimal _paid;

    public Status Status
        { get; private set; }
    public decimal Total
        => _lines.Sum(l => l.Amount);
    public decimal Balance
        => Total - _paid;
    public IReadOnlyList<Line> Lines
        => _lines.AsReadOnly();

    public void AddLine(
        string text, decimal amount)
    {
        Require(Status == Status.Draft,
            "Lines are frozen.");
        Require(amount > 0,
            "Amounts are above zero.");
        _lines.Add(
            new Line(text, amount));
    }

    public void Issue()
    {
        Require(Status == Status.Draft,
            "Already issued.");
        Require(_lines.Count > 0,
            "Needs at least one line.");
        Status = Status.Issued;
    }

    public void RecordPayment(
        decimal amount)
    {
        Require(Status == Status.Issued,
            "Not open for payment.");
        Require(amount > 0,
            "Payments are above zero.");
        Require(amount <= Balance,
            $"Only {Balance} is owed.");
        _paid += amount;
        if (Balance == 0)
            Status = Status.Paid;
    }

    private static void Require(
        bool rule, string message)
    {
        if (rule) return;
        throw new
            InvalidOperationException(
                message);
    }
}
```

```text output
Issued: total 344, owed 44
Rejected: Only 44 is owed.
Rejected: Lines are frozen.
Paid: total 344, owed 0
```

Four design decisions do the work here, and only one of them is the keyword `private`.

1. **State is private, so the class is the only writer.** To know whether `_paid` can ever exceed the total, read three methods instead of the whole code base.
2. **`Total` is computed rather than stored.** The stale total in the first program was possible because the same fact was kept in two places. A value derived from the lines cannot disagree with them. If summing ever became too slow, a cached total would be a private detail that `AddLine` keeps in step, and no caller would notice the change.
3. **Every method checks before it changes anything.** `RecordPayment` runs all of its `Require` calls first and only then touches `_paid` and `Status`. A rejected call leaves the invoice exactly as it was, so catching the exception and carrying on is safe.
4. **The status has one writer too.** With `private set`, "paid" is a conclusion the invoice draws from its own numbers; nobody can stick the label on.

The invariant may be false for a moment inside a method: between `_paid += amount` and the next line, a fully paid invoice still says `Issued`. In single-threaded code that is harmless, because no outside code runs in the middle of the method. The promise is about what is true when public methods return. (Sharing an invoice between threads needs synchronization on top of this, which is outside this article.)

<figure class="diagram">
<svg viewBox="0 0 360 372" role="img" aria-labelledby="inv-title inv-desc">
<title id="inv-title">The invariant boundary around an Invoice object</title>
<desc id="inv-desc">Three callers at the top can reach the invoice only through three public methods. Each method checks its rules before writing the private state underneath. Three invariants that hold whenever a public method returns are listed at the bottom.</desc>
<defs>
<marker id="inv-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-stroke"/></marker>
<marker id="inv-arrow-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-accent"/></marker>
</defs>
<rect x="20" y="12" width="96" height="34" rx="6" class="d-box"/><text x="68" y="34" text-anchor="middle" class="d-small">checkout</text>
<rect x="132" y="12" width="96" height="34" rx="6" class="d-box"/><text x="180" y="34" text-anchor="middle" class="d-small">webhook</text>
<rect x="244" y="12" width="96" height="34" rx="6" class="d-box"/><text x="292" y="34" text-anchor="middle" class="d-small">admin tool</text>
<path d="M68 46 V92" class="d-line" marker-end="url(#inv-arrow)"/>
<path d="M180 46 V92" class="d-line" marker-end="url(#inv-arrow)"/>
<path d="M292 46 V92" class="d-line" marker-end="url(#inv-arrow)"/>
<rect x="10" y="66" width="340" height="212" rx="10" class="d-accent"/>
<text x="20" y="84" class="d-text-accent d-small d-bold">Invoice</text>
<rect x="20" y="94" width="96" height="40" rx="6" class="d-box-accent"/><text x="68" y="119" text-anchor="middle" class="d-mono d-small">AddLine</text>
<rect x="132" y="94" width="96" height="40" rx="6" class="d-box-accent"/><text x="180" y="119" text-anchor="middle" class="d-mono d-small">Issue</text>
<rect x="236" y="94" width="108" height="40" rx="6" class="d-box-accent"/><text x="290" y="119" text-anchor="middle" class="d-mono d-small">RecordPayment</text>
<text x="180" y="154" text-anchor="middle" class="d-small d-muted">each method: check the rules, then write</text>
<path d="M68 162 V190" class="d-accent" marker-end="url(#inv-arrow-a)"/>
<path d="M180 162 V190" class="d-accent" marker-end="url(#inv-arrow-a)"/>
<path d="M290 162 V190" class="d-accent" marker-end="url(#inv-arrow-a)"/>
<rect x="20" y="194" width="320" height="72" rx="6" class="d-box-2"/>
<text x="32" y="214" class="d-small d-bold">private state</text>
<text x="32" y="234" class="d-mono d-small">_lines   _paid   Status</text>
<text x="32" y="254" class="d-small d-muted">no other code can write these</text>
<text x="20" y="300" class="d-small d-bold">True whenever a public method returns:</text>
<text x="20" y="320" class="d-small">every line amount is above zero</text>
<text x="20" y="338" class="d-small">0 ≤ paid ≤ total</text>
<text x="20" y="356" class="d-small">Paid owes nothing; Issued owes something</text>
</svg>
<figcaption>Figure 1. The accent outline is the invariant boundary. Callers can only reach the private state through three methods, so those three methods are the only code that has to be right.</figcaption>
</figure>

An attempt to go around the boundary does not fail at run time. It fails to compile:

```csharp run error=CS0122
var invoice = new Invoice();
invoice.RecordPayment(300m);
invoice._paid = 900m;

sealed class Invoice
{
    private decimal _paid;
    public decimal Paid => _paid;
    public void RecordPayment(
        decimal amount)
        => _paid += amount;
}
```

### How can private state still leak?

`private` protects a field, and the object the field refers to is a separate matter. If a class hands out a reference to its own mutable list, the caller holds a second way in. That is why `Lines` above returns `_lines.AsReadOnly()`: a wrapper that exposes no mutating methods, created in O(1), which still shows later changes made through the invoice itself [[10]](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.list-1.asreadonly). Each read of the property allocates a new small wrapper, which is fine here; a class read in a hot loop could keep one wrapper in a field. `Line` is a positional record, whose properties cannot be reassigned after construction, so a caller cannot edit a line it was given either.

::::exercise[Find the way in]
A colleague simplifies the `Lines` property so that it returns `_lines` directly, with no `AsReadOnly()`. The reasoning: the property's declared type, `IReadOnlyList<Line>`, has no `Add` method, so callers still cannot change the list.

Without reflection, write calling code that adds a line to an invoice that has already been issued.

:::solution
The declared type of the property changed; the object it returns is still the `List<Line>` itself. A cast gets it back.

```csharp run
var invoice = new Invoice();
invoice.AddLine("Team plan", 245m);
invoice.Issue();

var backDoor = (List<Line>)invoice.Lines;
backDoor.Add(new Line("Oops", -500m));

Console.WriteLine(invoice.Issued);
Console.WriteLine(invoice.Total);

record Line(string Text, decimal Amount);

sealed class Invoice
{
    private readonly List<Line>
        _lines = [];

    public bool Issued
        { get; private set; }
    public decimal Total
        => _lines.Sum(l => l.Amount);
    public IReadOnlyList<Line> Lines
        => _lines;

    public void AddLine(
        string text, decimal amount)
    {
        if (Issued || amount <= 0)
            throw new
            InvalidOperationException();
        _lines.Add(
            new Line(text, amount));
    }

    public void Issue() => Issued = true;
}
```

```text output
True
-255
```

Both rules were bypassed: the invoice was already issued, and the amount is negative. With `_lines.AsReadOnly()` the same cast throws `InvalidCastException`, because the object returned is a `ReadOnlyCollection<Line>` and not the list. A cast to `IList<Line>` does compile, since `ReadOnlyCollection<T>` implements that interface explicitly, but its `Add` throws `NotSupportedException`.
:::
::::

## How does polymorphism work at run time?

Polymorphism means that one call can run different code depending on the object it is given. A billing system charges customers under different pricing plans, and the code that produces invoices should not need to know which plans exist. In the program below, `abstract` marks a method that every concrete plan must supply, and `virtual` gives a default body that a subclass may replace with `override`. Read the three `PriceFor` overrides; the loop at the top is the only caller.

```csharp run id=plans
Plan[] plans =
[
    new FlatPlan("Starter", 29m),
    new PerSeatPlan("Team", 12m,
        minSeats: 5),
    new MeteredPlan("API", 3m,
        freeBlocks: 10),
];
Usage usage = new(Seats: 3, Blocks: 45);

foreach (Plan plan in plans)
{
    decimal due = plan.PriceFor(usage);
    Console.WriteLine(
        $"{plan.Name,-8}{due,4}  " +
        plan.Describe());
}

record Usage(int Seats, int Blocks);

abstract class Plan(string name)
{
    public string Name { get; } = name;

    public abstract decimal PriceFor(
        Usage usage);

    public virtual string Describe()
        => "fixed price";
}

sealed class FlatPlan(
    string name, decimal price)
    : Plan(name)
{
    public override decimal PriceFor(
        Usage usage) => price;
}

sealed class PerSeatPlan(
    string name, decimal perSeat,
    int minSeats) : Plan(name)
{
    public override decimal PriceFor(
        Usage usage)
    {
        int seats = Math.Max(
            usage.Seats, minSeats);
        return perSeat * seats;
    }

    public override string Describe()
        => $"{perSeat}/seat, " +
           $"min {minSeats}";
}

sealed class MeteredPlan(
    string name, decimal perBlock,
    int freeBlocks) : Plan(name)
{
    public override decimal PriceFor(
        Usage usage)
    {
        int extra =
            usage.Blocks - freeBlocks;
        int billable =
            Math.Max(extra, 0);
        return perBlock * billable;
    }

    public override string Describe()
        => $"{perBlock}/block after " +
           $"{freeBlocks} free";
}
```

```text output
Starter   29  fixed price
Team      60  12/seat, min 5
API      105  3/block after 10 free
```

The loop contains one call, `plan.PriceFor(usage)`, and it ran three different method bodies. The variable's compile-time type is `Plan` each time; what differs is the run-time type of the object it refers to. The C# specification states the rule: "In a virtual method invocation, the run-time type of the instance for which that invocation takes place determines the actual method implementation to invoke" [[3]](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/language-specification/classes). An `abstract` method is a virtual method with no body in the base class, so every non-abstract derived class has to supply one [[3]](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/language-specification/classes).

The payoff is in what you do not edit. A fourth plan is one new class; the loop, and every other piece of code that works with `Plan`, stays as it is. Written as a `switch` on a plan-type code instead, the same feature means finding and editing every such `switch`.

The trade runs the other way when the set of types is fixed and new *operations* keep arriving. Then a `switch` with pattern matching keeps each operation in one place, where virtual methods would make you touch every class. Wadler's 1998 note names this tension the expression problem: extend both the cases and the operations without touching existing code [[14]](https://homepages.inf.ed.ac.uk/wadler/papers/expression/expression.txt). C# has no way to declare a class hierarchy closed, so a `switch` over class types compiles with warning CS8509 unless it ends in a fallback arm.

### What the runtime does with `plan.PriceFor(usage)`

The compiler cannot know which body to call, so it cannot emit a jump to a fixed address. CoreCLR, the runtime behind .NET, resolves the call with a table lookup:

- Every object on the heap carries a pointer to a structure describing its type, the **method table**. The runtime's design notes compare that pointer to a C++ v-table pointer and list the v-table among the things the method table holds [[5]](https://github.com/dotnet/runtime/blob/main/docs/design/coreclr/botr/type-loader.md). Objects of the same type share one method table.
- Each virtual method has a numbered **slot** in that table, and the slot contains the current entry point of the method's code [[6]](https://github.com/dotnet/runtime/blob/main/docs/design/coreclr/botr/method-descriptor.md). `PriceFor` has the same slot number in `FlatPlan`, `PerSeatPlan` and `MeteredPlan`; an override puts a different address in the inherited slot.
- The call site therefore never asks "what type is this?". It loads the method table pointer from the object, reads the slot, and calls whatever address is there.

<figure class="diagram">
<svg viewBox="0 0 360 516" role="img" aria-labelledby="mt-title mt-desc">
<title id="mt-title">Virtual dispatch through a method table</title>
<desc id="mt-desc">A variable of type Plan refers to a PerSeatPlan object. An arrow numbered 1 leads from the object's method table pointer to the PerSeatPlan method table. In that table the PriceFor slot, numbered 2, holds the address of PerSeatPlan's code, which is what is called, numbered 3. The FlatPlan method table below has the same slots in the same order with different addresses, and its Describe slot still points to the code inherited from Plan.</desc>
<defs>
<marker id="mt-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-accent"/></marker>
</defs>
<rect x="20" y="12" width="320" height="34" rx="6" class="d-box"/>
<text x="32" y="34" class="d-mono d-small">plan</text><text x="72" y="34" class="d-small d-muted">variable, compile-time type Plan</text>
<path d="M44 46 V70" class="d-accent" marker-end="url(#mt-arrow)"/>
<text x="60" y="64" class="d-small d-bold">a PerSeatPlan object on the heap</text>
<rect x="20" y="74" width="280" height="30" class="d-box-accent"/><text x="32" y="94" class="d-small d-bold">method table pointer</text>
<rect x="20" y="104" width="280" height="30" class="d-box-2"/><text x="32" y="124" class="d-mono d-small">perSeat = 12   minSeats = 5</text>
<path d="M300 89 H328 V166" class="d-accent" marker-end="url(#mt-arrow)"/>
<text x="318" y="152" text-anchor="end" class="d-small d-text-accent">1. load the pointer</text>
<rect x="20" y="170" width="320" height="26" class="d-box"/><text x="32" y="188" class="d-small d-bold">Method table of PerSeatPlan</text>
<rect x="20" y="196" width="320" height="28" class="d-box-2"/><text x="56" y="215" class="d-small d-muted">ToString, Equals, … from Object</text>
<rect x="20" y="224" width="320" height="28" class="d-box-accent"/><text x="56" y="243" class="d-mono d-small d-bold">PriceFor → PerSeatPlan code</text>
<circle cx="36" cy="238" r="9" class="d-box"/><text x="36" y="242" text-anchor="middle" class="d-small d-bold">2</text>
<circle cx="321" cy="238" r="9" class="d-box"/><text x="321" y="242" text-anchor="middle" class="d-small d-bold">3</text>
<rect x="20" y="252" width="320" height="28" class="d-box"/><text x="56" y="271" class="d-mono d-small">Describe      → PerSeatPlan code</text>
<text x="20" y="304" class="d-small d-text-accent">2. read the PriceFor slot</text>
<text x="20" y="322" class="d-small d-text-accent">3. call the address found there</text>
<rect x="20" y="340" width="320" height="26" class="d-box"/><text x="32" y="358" class="d-small d-bold">Method table of FlatPlan</text>
<rect x="20" y="366" width="320" height="28" class="d-box-2"/><text x="56" y="385" class="d-small d-muted">ToString, Equals, … from Object</text>
<rect x="20" y="394" width="320" height="28" class="d-box-accent"/><text x="56" y="413" class="d-mono d-small d-bold">PriceFor → FlatPlan code</text>
<rect x="20" y="422" width="320" height="28" class="d-box"/><text x="56" y="441" class="d-mono d-small">Describe      → Plan code</text>
<text x="20" y="474" class="d-small d-muted">Same slots in the same order, different addresses.</text>
<text x="20" y="492" class="d-small d-muted">FlatPlan never overrode Describe, so its slot</text>
<text x="20" y="508" class="d-small d-muted">still holds the address of Plan's version.</text>
</svg>
<figcaption>Figure 2. The call site is identical for every plan: follow the object's pointer (1), read one slot (2), call the address in it (3). Which code runs depends only on which method table the object points to.</figcaption>
</figure>

The slot layout is an implementation detail of CoreCLR, and the C# language promises nothing about it, but you can see its outline from inside a program. `MethodInfo.GetBaseDefinition` returns the declaration that first introduced a virtual method, and for a method declared with `new` it returns the method itself [[9]](https://learn.microsoft.com/en-us/dotnet/api/system.reflection.methodinfo.getbasedefinition). `LegacyPlan` below hides `Describe` with `new` instead of overriding it.

```csharp run id=slots
using System.Reflection;

Console.WriteLine(
    "Type        Body in     Slot from");
Row(typeof(FlatPlan)
    .GetMethod("Describe")!);
Row(typeof(PerSeatPlan)
    .GetMethod("Describe")!);
Row(typeof(LegacyPlan)
    .GetMethod("Describe")!);

static void Row(MethodInfo m)
{
    var first = m.GetBaseDefinition();
    Console.WriteLine(
        $"{m.ReflectedType!.Name,-12}" +
        $"{m.DeclaringType!.Name,-12}" +
        first.DeclaringType!.Name);
}

abstract class Plan
{
    public virtual string Describe()
        => "fixed price";
}

sealed class FlatPlan : Plan;

sealed class PerSeatPlan : Plan
{
    public override string Describe()
        => "per seat";
}

sealed class LegacyPlan : Plan
{
    public new string Describe()
        => "grandfathered";
}
```

```text output
Type        Body in     Slot from
FlatPlan    Plan        Plan
PerSeatPlan PerSeatPlan Plan
LegacyPlan  LegacyPlan  LegacyPlan
```

`FlatPlan` and `PerSeatPlan` both use the slot that `Plan` introduced; one leaves the inherited address in it and the other replaces it. `LegacyPlan.Describe` is a different method that happens to share a name. It is not in `Plan`'s slot, so a virtual call made through a `Plan` variable does not reach it.

::::exercise[Predict what `new` does]
Using the classes above, a variable is declared as `Plan plan = new LegacyPlan();`. Decide what each of these expressions returns before opening the solution:

- `plan.Describe()`
- `((LegacyPlan)plan).Describe()`

:::solution
```csharp run
Plan plan = new LegacyPlan();
var legacy = (LegacyPlan)plan;
Console.WriteLine(plan.Describe());
Console.WriteLine(legacy.Describe());

abstract class Plan
{
    public virtual string Describe()
        => "fixed price";
}

sealed class LegacyPlan : Plan
{
    public new string Describe()
        => "grandfathered";
}
```

```text output
fixed price
grandfathered
```

Same object, two answers. The first call goes through `Plan`'s slot, which `LegacyPlan` never filled, so `Plan`'s body runs. The second call is bound at compile time to the separate, non-virtual `LegacyPlan.Describe`. The specification walks through the same situation in its section on override methods [[3]](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/language-specification/classes).

Behavior that depends on the type of the variable instead of the type of the object is what polymorphism exists to remove. That is why the compiler warns (CS0108) when you hide a member without writing `new` to say you meant it [[15]](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/compiler-messages/cs0108).
:::
::::

### What does a virtual call cost?

For a virtual call on a class, the JIT team's design notes show the machine code as a chain of three dependent loads before the indirect call: fetch the method table from the object, fetch the chunk of the table that holds the slot, and call through the slot [[8]](https://github.com/dotnet/runtime/blob/main/docs/design/coreclr/jit/GuardedDevirtualization.md). Figure 2 draws the slots as one block; the extra step is that CoreCLR keeps them in chunks reached through one more pointer. The larger cost is usually the optimization that is lost: the Framework Design Guidelines say virtual members are slower than non-virtual ones "mostly because calls to virtual members are not inlined" [[12]](https://learn.microsoft.com/en-us/dotnet/standard/design-guidelines/virtual-members).

The JIT removes the lookup when it can prove the target. It turns a virtual call into a direct one when it knows the exact type of the object, for example because it has just seen the `new` expression, or when the declared type is a `sealed` class [[8]](https://github.com/dotnet/runtime/blob/main/docs/design/coreclr/jit/GuardedDevirtualization.md). That is one practical reason the concrete plans above are `sealed`. The other reason is in the section on inheritance.

In a request that waits on a database or a network call, the lookup is unlikely to show up in a profile. It matters in tight loops that run the same small method millions of times.

:::dotnet
Calls through an *interface* do not use this table directly. CoreCLR currently uses a separate mechanism, virtual stub dispatch, only for interface calls: small generated stubs, which for a call site that keeps seeing one type compare the object's type with a cached one and jump straight to the target. Virtual methods on classes use a true v-table, because routing them through stubs as well cost too much in startup time and throughput [[7]](https://github.com/dotnet/runtime/blob/main/docs/design/coreclr/botr/virtual-stub-dispatch.md).
:::

### Is method overloading polymorphism too?

Overloading, several methods that share a name and differ in parameter types, looks similar: one name leads to different code. The choice is made from the types the compiler can see, though. C# binds an operation "at compile-time, based on the compile-time type of its subexpressions", and overload resolution is part of that binding [[4]](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/language-specification/expressions).

```csharp run
Plan plan = new PerSeatPlan();
Audit.Log(plan);
Audit.Log((PerSeatPlan)plan);

class Plan;
sealed class PerSeatPlan : Plan;

static class Audit
{
    public static void Log(Plan p)
        => Console.WriteLine(
            "Log(Plan)");

    public static void Log(
        PerSeatPlan p)
        => Console.WriteLine(
            "Log(PerSeatPlan)");
}
```

```text output
Log(Plan)
Log(PerSeatPlan)
```

The object is a `PerSeatPlan` both times. The first call picks `Log(Plan)` because the variable is declared as `Plan`. If behavior has to follow the object, it must be a virtual or interface member of the object, and an overload chosen from outside cannot do that. (An argument of type `dynamic` postpones binding to run time, which is a different tool with its own costs.)

### Do you need inheritance to get polymorphism?

No. The essential ingredient is a call whose target is chosen at run time, and a base class is only one way to get that. An interface gives the same substitutability with no shared code, and a delegate is a single replaceable method with no type hierarchy at all:

```csharp run
Func<int, decimal>[] seatPricing =
[
    seats => 12m * seats,
    seats => seats <= 10
        ? 100m
        : 100m + 8m * (seats - 10),
];

foreach (var price in seatPricing)
    Console.WriteLine(price(25));
```

```text output
300
220
```

The loop calls `price(25)` without knowing which formula it holds, which is the same property the `Plan` loop had. When the variation is one function, this is often all the design you need.

## What does inheritance cost?

Inheritance lets a class start from another class: it receives the base class's members, and it can be used wherever the base class is expected. That is two things at once, subtyping (the substitution) and reuse (the free code). The plans above use both: `Name` and the default `Describe` are written once.

The costs come from the reuse. In C#, a class can have only one direct base class [[2]](https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/object-oriented/inheritance), so that one choice had better be the right axis of variation. And a derived class does more than use the base's public surface; it runs *inside* the base's control flow. Gamma et al. make this point in chapter 1 of *Design Patterns*: a subclass is exposed to details of its parent's implementation, so inheritance weakens encapsulation, and they advise favoring object composition [[13]](https://www.pearson.com/en-us/subject-catalog/p/design-patterns-elements-of-reusable-object-oriented-software/P200000009480).

Two concrete forms of that coupling follow. Both compile without a warning under the default settings.

### The base class runs your override before your constructor

```csharp run
var plan = new PerSeatPlan(
    "Team", 12m, minSeats: 5);
Console.WriteLine(
    $"Later:   {plan.Describe()}");

abstract class Plan
{
    protected Plan(string name)
    {
        Name = name;
        Console.WriteLine(
            $"Created: {Describe()}");
    }

    public string Name { get; }
    public abstract string Describe();
}

sealed class PerSeatPlan : Plan
{
    private readonly decimal _perSeat;
    private readonly int _minSeats;

    public PerSeatPlan(
        string name, decimal perSeat,
        int minSeats) : base(name)
    {
        _perSeat = perSeat;
        _minSeats = minSeats;
    }

    public override string Describe()
        => $"{Name}: {_perSeat}" +
           $"/seat, min {_minSeats}";
}
```

```text output
Created: Team: 0/seat, min 0
Later:   Team: 12/seat, min 5
```

The base constructor's call to `Describe()` is a virtual call on an object whose run-time type is already `PerSeatPlan`, so it dispatches to the override. But the base constructor body runs before the derived constructor body, and `_perSeat` and `_minSeats` are still zero. Had `Describe` been a validation method, it would have validated zeros. This is what analyzer rule CA2214 looks for; it is not enabled by default in .NET 10 [[11]](https://learn.microsoft.com/en-us/dotnet/fundamentals/code-analysis/quality-rules/ca2214).

:::note
Field *initializers* work differently from constructor bodies: the specification requires them to run before the base constructor is invoked [[3]](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/language-specification/classes). A field declared with an initializer, such as `_notes = []`, is already set when the base constructor calls your override. Anything assigned in the constructor body is not.

Parameters captured by a primary constructor behave like initializers. With a primary constructor in place of the explicit one, the demo above printed `Team: 12/seat, min 5` on both lines when run on .NET 10, so the hazard does not appear. That is why this demo spells the constructor out. Calling an overridable method from a base constructor is still fragile, because the next override may compute something in its constructor body.
:::

### An override can break a promise the base class made

Everything that consumes a `Plan` assumes a price is never negative. `AddLine` enforces that on its side. Nothing enforces it on the `Plan` side, because `PriceFor` is public and abstract: each derived class is trusted to honor a rule that is written down nowhere.

```csharp run
Plan plan = new PromoPlan(
    price: 29m, credit: 40m);
var usage = new Usage(3);
decimal due = plan.PriceFor(usage);
Console.WriteLine($"PriceFor: {due}");

var lines = new List<decimal>();
try { AddLine(lines, due); }
catch (InvalidOperationException e)
{
    Console.WriteLine(e.Message);
}

static void AddLine(
    List<decimal> lines, decimal amount)
{
    if (amount <= 0)
        throw new
            InvalidOperationException(
            "Amounts are above zero.");
    lines.Add(amount);
}

record Usage(int Seats);

abstract class Plan
{
    public abstract decimal PriceFor(
        Usage usage);
}

sealed class PromoPlan(
    decimal price, decimal credit)
    : Plan
{
    public override decimal PriceFor(
        Usage usage) => price - credit;
}
```

```text output
PriceFor: -11
Amounts are above zero.
```

The exception comes from `AddLine` and talks about line amounts. The code at fault is `PromoPlan`, which may live in a different file written by someone else a year later. For a derived class to be usable wherever its base is expected, it has to keep what the base promises: what callers may assume about results, and the invariants the base maintains. The unwritten promises count too. That requirement is known as the Liskov substitution principle, after Barbara Liskov and Jeannette Wing's 1994 paper "A Behavioral Notion of Subtyping", and here `PromoPlan` weakens the base's unwritten postcondition that the price is not negative. The compiler checks none of it beyond method signatures.

::::exercise[Move the check to where the promise is made]
Change `Plan` so that no derived class, present or future, can hand a negative price to a caller, and so that the error names the plan at fault. Derived classes should still supply the pricing formula.

Hint: the guidelines for .NET library authors say public members should provide extensibility "by calling into a protected virtual member" [[12]](https://learn.microsoft.com/en-us/dotnet/standard/design-guidelines/virtual-members).

:::solution
Make the public method non-virtual, so that its body always runs, and have it call a protected abstract method for the part that varies.

```csharp run
Plan[] plans =
[
    new PromoPlan("Spring", 29m, 10m),
    new PromoPlan("Broken", 29m, 40m),
];

foreach (Plan plan in plans)
{
    try
    {
        var usage = new Usage(3);
        Console.WriteLine(
            plan.PriceFor(usage));
    }
    catch (InvalidOperationException e)
    {
        Console.WriteLine(e.Message);
    }
}

record Usage(int Seats);

abstract class Plan(string name)
{
    public decimal PriceFor(Usage usage)
    {
        decimal price = Compute(usage);
        if (price >= 0) return price;
        throw new
            InvalidOperationException(
            $"{name} priced {price}");
    }

    protected abstract decimal Compute(
        Usage usage);
}

sealed class PromoPlan(
    string name, decimal price,
    decimal credit) : Plan(name)
{
    protected override decimal Compute(
        Usage usage) => price - credit;
}
```

```text output
19
Broken priced -11
```

The base class now encapsulates its own rule instead of delegating it to every subclass. Callers cannot reach `Compute` at all, so the check cannot be skipped. This shape is the Template Method pattern, one of the behavioral patterns in *Design Patterns* [[13]](https://www.pearson.com/en-us/subject-catalog/p/design-patterns-elements-of-reusable-object-oriented-software/P200000009480).
:::
::::

### So when is inheritance the right tool?

Use it when all three of these hold:

- The derived class really can stand in for the base everywhere (substitutability, as above).
- The base class was written to be inherited from, with its few extension points `protected` and its rules enforced in non-virtual methods.
- You control both classes, so a change to the base can be tested against every subclass.

The `Plan` hierarchy qualifies. When you only want to reuse some code, hold an object of the other class in a private field and call it.

The Framework Design Guidelines put the default bluntly: do not make members virtual "unless you have a good reason to do so and you are aware of all the costs related to designing, testing, and maintaining virtual members" [[12]](https://learn.microsoft.com/en-us/dotnet/standard/design-guidelines/virtual-members). A `sealed` class makes the same statement for a whole type: nobody can override anything, so the reasoning you did about `Invoice` cannot be undone from a subclass.

## How is abstraction different from encapsulation?

Abstraction is a decision about *what* a caller gets to rely on. Encapsulation is the enforcement that stops them relying on anything else. `Invoice` made both moves: the abstraction is "lines, a total, a balance and a status that obey the rules of invoices"; the encapsulation is the `private` fields and guarded methods that keep it true.

The decision happens at every scale of a program, and the `abstract` keyword is only one place it shows up:

- **A method** abstracts over statements. `invoice.RecordPayment(44m)` lets the caller think "a payment arrived" instead of "add to a field, then compare, then maybe change a status".
- **A class** abstracts over a representation. Callers of `Total` cannot tell whether it is stored or summed.
- **An abstract class or interface** abstracts over a family of classes. The pricing loop knows `Plan` and never sees the three kinds of plan.
- **A boundary interface** abstracts over a whole outside system, as below.

Collecting payment means talking to a card processor over the network. The billing logic should be written in terms of what it needs from that processor, in billing vocabulary.

```csharp run
var gateway = new TestGateway(
    limit: 500m);
var collector = new Collector(gateway);
Console.WriteLine(
    collector.Collect("Acme", 344m));
Console.WriteLine(
    collector.Collect("Globex", 1200m));

enum ChargeResult
{
    Approved, Declined, Unreachable
}

interface IPaymentGateway
{
    ChargeResult Charge(
        string customer, decimal amount);
}

sealed class TestGateway(decimal limit)
    : IPaymentGateway
{
    public ChargeResult Charge(
        string customer, decimal amount)
        => amount <= limit
            ? ChargeResult.Approved
            : ChargeResult.Declined;
}

sealed class Collector(
    IPaymentGateway gateway)
{
    public string Collect(
        string customer, decimal owed)
    {
        ChargeResult r = gateway.Charge(
            customer, owed);
        string next = r switch
        {
            ChargeResult.Approved
                => $"paid {owed}",
            ChargeResult.Declined
                => "declined",
            _   => "gateway down",
        };
        return $"{customer}: {next}";
    }
}
```

```text output
Acme: paid 344
Globex: declined
```

`Collector` can be run and tested with no network, and a production gateway that makes HTTPS calls can replace `TestGateway` without `Collector` changing.

The design work is in choosing what the interface *admits*. `Charge` has no URL, no API key and no JSON, because those belong to one processor. It does have `Unreachable`, because any gateway reached over a network can be down, and `Collector` must decide what to do about that. An interface that pretended charging either succeeds or is declined would be simpler and wrong: the network failure would arrive anyway, as an exception that `Collector` was never written to expect. A good abstraction leaves out what varies between implementations and keeps what is true of all of them, failure modes included.

Abstractions have a cost too. Each one is a layer a reader has to see through, and an interface with a single implementation and no test double is a guess about variation that may never come. Introduce one when a second implementation exists (a test double counts) or when a boundary such as the network, a database or the clock needs to be kept out of the core logic.

## How do the four fit together?

In the billing code they are not four separate features. `Plan.PriceFor` from the last exercise is an abstraction (callers know only "a plan yields a non-negative price"), enforced by encapsulation (the check lives in a method nobody can bypass or override), varied through polymorphism (each plan fills in `Compute`), with inheritance as the mechanism that carries the shared check to every plan.

They are not equally safe to reach for. Encapsulation protects you from the first class onward. Abstraction and polymorphism pay for themselves once a second variant really exists. Inheritance is the one to justify each time.

::::exercise[Extend the invariant: refunds]
Add `Refund(decimal amount)` to the `Invoice` class from the encapsulation section. Before writing code, decide: which of the three invariants in Figure 1 could a refund break, and what must the method do to `Status`?

:::solution
A refund lowers `_paid`, so it threatens `0 ≤ paid` (refunding more than was paid) and "Paid owes nothing, Issued owes something" (a fully paid invoice that is partly refunded must go back to `Issued`). The line rule is untouched.

The program below is cut down to what the refund needs; `Refund` drops into the full class unchanged.

```csharp run
var invoice = new Invoice(total: 245m);
invoice.RecordPayment(245m);
Show(invoice);

invoice.Refund(45m);
Show(invoice);

try { invoice.Refund(500m); }
catch (InvalidOperationException e)
{
    Console.WriteLine(e.Message);
}

static void Show(Invoice i)
    => Console.WriteLine(
        $"{i.Status}, owed {i.Balance}");

enum Status { Draft, Issued, Paid }

sealed class Invoice(decimal total)
{
    private decimal _paid;

    public Status Status
        { get; private set; }
        = Status.Issued;
    public decimal Balance
        => total - _paid;

    public void RecordPayment(
        decimal amount)
    {
        Require(amount > 0
            && amount <= Balance,
            "Payment not accepted.");
        _paid += amount;
        if (Balance == 0)
            Status = Status.Paid;
    }

    public void Refund(decimal amount)
    {
        Require(amount > 0,
            "Refunds are above zero.");
        Require(amount <= _paid,
            $"Only {_paid} was paid.");
        _paid -= amount;
        Status = Status.Issued;
    }

    private static void Require(
        bool rule, string message)
    {
        if (rule) return;
        throw new
            InvalidOperationException(
                message);
    }
}
```

```text output
Paid, owed 0
Issued, owed 45
Only 200 was paid.
```

Setting `Status` to `Issued` unconditionally is correct: a refund is above zero, so afterwards something is owed. In the full class, a draft has `_paid` of zero, so the second `Require` already rejects every refund on a draft. That leaves only `Issued` and `Paid` invoices, and both end as `Issued`. You only had to read one class to be sure of all of this.
:::
::::

::::exercise[Reason about a sealed call site]
`PerSeatPlan` is `sealed`. Suppose a method takes a parameter declared as `PerSeatPlan plan` and calls `plan.PriceFor(usage)`. Does the runtime need the method table to find the code? What changes if the parameter is declared as `Plan`?

:::solution
With the parameter declared as the sealed type `PerSeatPlan`, no other class can be behind that reference, so there is only one possible target. The JIT design notes list exactly this case, a declared type that is a `sealed` class, as one where it can replace the virtual call with a direct call [[8]](https://github.com/dotnet/runtime/blob/main/docs/design/coreclr/jit/GuardedDevirtualization.md), and a direct call can then be considered for inlining.

Declared as `Plan`, the reference may point to any plan type, including one loaded later, so in general the call goes through the slot. The same document describes the JIT's fallback, guarded devirtualization: guess the likely type, test for it, call directly if the guess holds, and make the ordinary virtual call if not.
:::
::::
