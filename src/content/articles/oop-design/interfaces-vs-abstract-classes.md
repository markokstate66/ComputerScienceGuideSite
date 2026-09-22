---
title: "Interfaces vs Abstract Classes in Modern C#"
description: "What an interface and an abstract class can each hold, why their defaults can collide, and how C# 11 static abstract members change the choice."
pillar: oop-design
order: 4
author: markus
published: 2026-09-22
updated: 2026-09-22
level: intermediate
tags: [oop, interfaces, abstract-classes, generics]
prerequisites: ["oop-design/four-pillars-of-oop"]
sources:
  - title: "Safely update interfaces using default interface methods"
    url: "https://learn.microsoft.com/en-us/dotnet/csharp/advanced-topics/interface-implementation/default-interface-methods-versions"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "interface keyword - C# reference"
    url: "https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/keywords/interface"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Interfaces - define behavior for multiple types"
    url: "https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/types/interfaces"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "abstract keyword - C# reference"
    url: "https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/keywords/abstract"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Generic math - .NET"
    url: "https://learn.microsoft.com/en-us/dotnet/standard/generics/math"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Interfaces (C# language specification), §19.4 Interface members and §19.4.10 Most specific implementation"
    url: "https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/language-specification/interfaces"
    publisher: "Microsoft Learn / dotnet/csharpstandard"
    accessed: 2026-09-22
draft: false
---

Two rules of thumb get repeated for interfaces versus abstract classes: an interface says what a type can do, an abstract class says what a type is. Both survive contact with the language only partly. C# 8 let an interface member carry a body, so an interface can now say a good deal about *how* something is done. C# 11 let an interface demand a `static` member from its implementers, which has nothing to do with instances at all. The useful question is not the mnemonic; it is which of a short list of concrete capabilities each construct has, what happens when two interfaces disagree about one of them, and which of that list your design actually needs.

## What can each one hold, build and expose?

| Capability | Interface | Abstract class |
|---|---|---|
| Instance fields | No (`CS0525`) | Yes |
| Instance constructors | No (`CS0526`) | Yes, usually `protected` |
| Member with a body | Yes, since C# 8 | Yes, always |
| Default member access | Public by default | Any modifier |
| Static abstract/virtual | Yes, since C# 11 | No |
| Base types allowed | Any number | Exactly one |
| Direct instantiation | Never | Never |

A member declared with no body — the ordinary case, `void Send(string message);` — is implicitly `public` and cannot be marked otherwise [[3]](https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/types/interfaces). Every other row needs code to be believed rather than taken on faith, and the sections below run each one.

## Default interface members: a method body inside an interface

A *default interface member* is an interface member declared with a body; a type that implements the interface gets that body unless it supplies its own [[2]](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/keywords/interface). Below, `INotifier` requires `Send` from every implementer and offers a default `Describe`. `EmailNotifier` overrides it; `SmsNotifier` does not.

The programs on this page are complete file-based C# apps, compiled and run with `dotnet run` on .NET 10.0.401, Windows 11, x64; the diagnostic codes quoted are the exact ones the compiler printed.

```csharp run id=dim-basic
INotifier[] channels =
    [new EmailNotifier(), new SmsNotifier()];

foreach (var channel in channels)
    Console.WriteLine(channel.Describe());

interface INotifier
{
    void Send(string message);

    string Describe() => "a notification channel";
}

class EmailNotifier : INotifier
{
    public void Send(string message) { }
    public string Describe() => "email channel";
}

class SmsNotifier : INotifier
{
    public void Send(string message) { }
}
```

```text output
email channel
a notification channel
```

`SmsNotifier` never mentions `Describe`, yet calling it through the `INotifier`-typed array element runs the interface's own body. No modifier was written on `Describe`, and it is reachable from outside the interface all the same: the language specification states plainly that "all interface members implicitly have public access" unless an explicit modifier says otherwise, with no special case for members that have a body [[6]](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/language-specification/interfaces). Writing `private` is what actually hides a default member, and then only from outside the interface's own code:

```csharp run error=CS0122
INotifier n = new SmsNotifier();
n.Log("hi");

interface INotifier
{
    void Send(string message);
    private void Log(string message)
        => Console.WriteLine($"log: {message}");
}

class SmsNotifier : INotifier
{
    public void Send(string message) { }
}
```

### A member with no override still needs the interface type

`SmsNotifier` compiled above because every call to `Describe` went through a variable of type `INotifier`. A class does not inherit members from the interfaces it implements — it only gets to run them through a reference of the interface's own type [[1]](https://learn.microsoft.com/en-us/dotnet/csharp/advanced-topics/interface-implementation/default-interface-methods-versions). Ask for the same default member through the class type instead, with no cast, and there is nothing to find:

```csharp run error=CS1061
var sms = new SmsNotifier();
Console.WriteLine(sms.Describe());

interface INotifier
{
    void Send(string message);
    string Describe() => "a notification channel";
}

class SmsNotifier : INotifier
{
    public void Send(string message) { }
}
```

`SmsNotifier` has no member named `Describe` as far as the compiler is concerned; the one it can see lives on `INotifier`, and only a variable declared as `INotifier` (or a cast to it) can reach it.

## When two defaults collide: the diamond problem, precisely

::::exercise[Predict the collision]
`IPersistable` and `IAuditable` are two unrelated interfaces — neither derives from the other, and neither derives from a common interface. Both happen to declare a default method with the same name and signature:

```csharp run id=diamond-non-conflict-q
IPersistable asPersistable = new Record();
IAuditable asAuditable = new Record();
_ = asPersistable.Describe();
_ = asAuditable.Describe();

interface IPersistable
{
    string Describe() => "persistable record";
}

interface IAuditable
{
    string Describe() => "auditable record";
}

class Record : IPersistable, IAuditable;
```

Before opening the solution, decide: does `class Record : IPersistable, IAuditable` compile? If it does, what do `((IPersistable)r).Describe()` and `((IAuditable)r).Describe()` each return, and what happens when you call `r.Describe()` directly on a `Record`-typed variable?

:::solution
It compiles, with no ambiguity at all — because there is nothing to disambiguate. `IPersistable.Describe` and `IAuditable.Describe` are two separate members that happen to share a name and signature; `Record` gets both, and each is reachable only through its own interface type.

```csharp run id=diamond-non-conflict
IPersistable asPersistable = new Record();
IAuditable asAuditable = new Record();
Console.WriteLine(asPersistable.Describe());
Console.WriteLine(asAuditable.Describe());

interface IPersistable
{
    string Describe() => "persistable record";
}

interface IAuditable
{
    string Describe() => "auditable record";
}

class Record : IPersistable, IAuditable;
```

```text output
persistable record
auditable record
```

A `Record`-typed variable cannot reach either one, for the same reason `SmsNotifier.Describe` was unreachable above:

```csharp run error=CS1061
var record = new Record();
Console.WriteLine(record.Describe());

interface IPersistable
{
    string Describe() => "persistable record";
}

interface IAuditable
{
    string Describe() => "auditable record";
}

class Record : IPersistable, IAuditable;
```

Nothing here is the diamond problem. That name belongs to the next scenario, where the two defaults really do compete for the same slot.
:::
::::

### A shared ancestor is the real diamond

The conflict needs a common ancestor: one interface declares a member with no body, and two interfaces that both derive from it each supply a default for that same inherited member. `IPersistable` and `IAuditable` now both derive from `IEntity` and both re-implement its `Describe`, using explicit interface implementation syntax (`string IEntity.Describe()`) — required whenever an interface overrides a member it inherited from a base interface [[2]](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/keywords/interface).

```csharp run error=CS8705
IEntity e = new Record();
Console.WriteLine(e.Describe());

interface IEntity
{
    string Describe();
}

interface IPersistable : IEntity
{
    string IEntity.Describe() => "persistable record";
}

interface IAuditable : IEntity
{
    string IEntity.Describe() => "auditable record";
}

class Record : IPersistable, IAuditable;
```

`CS8705` is reported on `class Record : IPersistable, IAuditable` itself, before any call site — the compiler refuses to pick a winner between `IPersistable`'s and `IAuditable`'s implementations of `IEntity.Describe` at the point where `Record` brings both into scope. The C# language specification calls the sound member a type must have for every inherited virtual member its *most specific implementation*, and states the rule this way: "Every class and struct shall have a most specific implementation for every virtual member declared in all interfaces implemented by that type"; when two candidates both qualify and neither is more specific than the other, "an error occurs" [[6]](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/language-specification/interfaces). The same source calls this "an ambiguity arising from diamond interface inheritance", resolved by forcing the programmer to settle it explicitly rather than letting the runtime guess [[6]](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/language-specification/interfaces).

### One interface deriving from the other breaks the tie automatically

The specification's most-specific rule has a second clause: if one of the two competing interfaces derives from the other, directly or indirectly, the more derived interface's implementation wins and no error occurs [[6]](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/language-specification/interfaces). Suppose `IArchivable` is added later as a refinement of `IPersistable`, with its own, more specific override:

```csharp run id=diamond-tiebreak
IEntity e = new Record();
Console.WriteLine(e.Describe());

interface IEntity
{
    string Describe();
}

interface IPersistable : IEntity
{
    string IEntity.Describe() => "persistable record";
}

interface IArchivable : IPersistable
{
    string IEntity.Describe() => "archivable record";
}

class Record : IPersistable, IArchivable;
```

```text output
archivable record
```

No `CS8705` this time. `IArchivable` derives from `IPersistable`, so its override of `IEntity.Describe` is unambiguously more specific, and `Record` picks it up without being asked. This is also why the earlier, unrelated-interfaces case never conflicted in the first place: there was no shared ancestor for either implementation to be "more specific" about.

### Resolving a genuine diamond yourself

Back at the true diamond, `Record` has to say what it means. The class can supply its own explicit implementation of the ancestor member, which the specification also names as the most specific implementation whenever the implementing type declares one directly [[6]](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/language-specification/interfaces):

```csharp run id=diamond-fix
IEntity e = new Record();
Console.WriteLine(e.Describe());

interface IEntity
{
    string Describe();
}

interface IPersistable : IEntity
{
    string IEntity.Describe() => "persistable record";
}

interface IAuditable : IEntity
{
    string IEntity.Describe() => "auditable record";
}

class Record : IPersistable, IAuditable
{
    string IEntity.Describe()
        => "record: persistable and auditable";
}
```

```text output
record: persistable and auditable
```

## What only a base class can hold: fields and constructors

The capabilities table's first two rows are compile errors, not conventions. `IThrottledNotifier` cannot hold the counter it would need to enforce a rate limit:

```csharp run error=CS0525
interface IThrottledNotifier
{
    int SentThisMinute;
}
```

```csharp run error=CS0526
interface IThrottledNotifier
{
    IThrottledNotifier(int maxPerMinute) { }
}
```

An abstract class can hold both, and that combination — private state plus a constructor that checks it once — is exactly what lets a rate limit live in one place instead of being copied into every notifier that needs one. `ThrottledNotifier` below implements `INotifier`, owns the counter, and calls an abstract `Deliver` for the part that still varies by channel:

```csharp run id=throttled-notifier
INotifier[] channels =
[
    new EmailNotifier(max: 2),
    new SmsNotifier(max: 1),
];

foreach (var channel in channels)
    for (int i = 1; i <= 3; i++)
        channel.Send($"msg {i}");

interface INotifier
{
    void Send(string message);
}

abstract class ThrottledNotifier
    : INotifier
{
    private readonly int _max;
    private int _sent;

    protected ThrottledNotifier(int max)
    {
        ArgumentOutOfRangeException
            .ThrowIfNegativeOrZero(max);
        _max = max;
    }

    public void Send(string message)
    {
        if (_sent >= _max)
        {
            Console.WriteLine(
                $"[{Label}] dropped: {message}");
            return;
        }
        _sent++;
        Deliver(message);
    }

    protected abstract
        string Label { get; }
    protected abstract
        void Deliver(string msg);
}

sealed class EmailNotifier(int max)
    : ThrottledNotifier(max)
{
    protected override
        string Label => "email";
    protected override
        void Deliver(string msg)
        => Console.WriteLine($"[email] {msg}");
}

sealed class SmsNotifier(int max)
    : ThrottledNotifier(max)
{
    protected override
        string Label => "sms";
    protected override
        void Deliver(string msg)
        => Console.WriteLine($"[sms] {msg}");
}
```

```text output
[email] msg 1
[email] msg 2
[email] dropped: msg 3
[sms] msg 1
[sms] dropped: msg 2
[sms] dropped: msg 3
```

`_max` and `_sent` are private to `ThrottledNotifier`; neither `EmailNotifier` nor `SmsNotifier` can see or reset them directly, and the constructor's `ThrowIfNegativeOrZero` check runs exactly once, for every channel, because it lives in the one constructor they all call. An interface has no field to check, so an interface-only version of this design would have to trust each implementer to copy the throttling logic correctly, or to compose in a separate throttling object by hand.

::::exercise[Add a way to reset the counter]
Add a public `Reset()` operation to the notifier hierarchy above that zeroes the count for one channel, without giving `EmailNotifier` or `SmsNotifier` direct access to `_sent`. Where does `Reset()` have to live, and why is that the only place a plain interface version of `INotifier` could not put it?

:::solution
`Reset()` has to be a member of `ThrottledNotifier`, because `_sent` is private there. A plain `INotifier` interface has nowhere to put a reset that touches shared state, because it has no state to touch — every implementer would need its own copy of the counter and its own `Reset`, with no guarantee the two stay consistent.

```csharp run id=throttled-notifier-reset
INotifier channel =
    new EmailNotifier(max: 2);
channel.Send("a");
channel.Send("b");
channel.Send("c");

if (channel is ThrottledNotifier t)
    t.Reset();

channel.Send("d");

interface INotifier
{
    void Send(string message);
}

abstract class ThrottledNotifier
    : INotifier
{
    private readonly int _max;
    private int _sent;

    protected ThrottledNotifier(int max)
        => _max = max;

    public void Send(string message)
    {
        if (_sent >= _max)
        {
            Console.WriteLine(
                $"dropped: {message}");
            return;
        }
        _sent++;
        Deliver(message);
    }

    public void Reset() => _sent = 0;

    protected abstract
        void Deliver(string msg);
}

sealed class EmailNotifier(int max)
    : ThrottledNotifier(max)
{
    protected override
        void Deliver(string msg)
        => Console.WriteLine($"email: {msg}");
}
```

```text output
email: a
email: b
dropped: c
email: d
```
:::
::::

## Static abstract members: contracts for statics, not instances

`static abstract` and `static virtual` interface members, added in C# 11, let an interface require a *static* member — most often an operator — from every implementing type, instead of an instance member [[2]](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/keywords/interface). Because operators must be `static`, there was previously no way to say "every `T` used here must support `+`" [[5]](https://learn.microsoft.com/en-us/dotnet/standard/generics/math). `IAddable<TSelf>` below says exactly that, using the same self-referencing constraint the real numeric interfaces use so that `T.Zero` and `T + T` both resolve to `T`'s own members [[2]](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/keywords/interface):

```csharp run id=static-abstract-fraction
Fraction[] shares = [new(1, 4), new(1, 2), new(1, 8)];
Console.WriteLine(Sum(shares));

static T Sum<T>(IEnumerable<T> items) where T : IAddable<T>
{
    T total = T.Zero;
    foreach (var item in items)
        total += item;
    return total;
}

interface IAddable<TSelf> where TSelf : IAddable<TSelf>
{
    static abstract TSelf Zero { get; }
    static abstract TSelf operator +(TSelf left, TSelf right);
}

readonly struct Fraction : IAddable<Fraction>
{
    private readonly int _n, _d;

    public Fraction(int numerator, int denominator)
    {
        int g = Gcd(Math.Abs(numerator), Math.Abs(denominator));
        g = g == 0 ? 1 : g;
        _n = numerator / g;
        _d = denominator / g;
    }

    private static int Gcd(int a, int b)
        => b == 0 ? a : Gcd(b, a % b);

    public static Fraction Zero => new(0, 1);

    public static Fraction operator +(Fraction a, Fraction b)
        => new(a._n * b._d + b._n * a._d, a._d * b._d);

    public override string ToString() => $"{_n}/{_d}";
}
```

```text output
7/8
```

`Sum<T>` never mentions `Fraction`. Inside the generic method, `T.Zero` and `total += item` are resolved from the constraint alone: "the compiler must resolve calls to `static virtual` and `static abstract` methods at compile time", using the type argument, because there is no object to carry a method table the way an instance virtual call has one [[2]](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/keywords/interface). That is also why the constraint exists: without `where T : IAddable<T>`, `T.Zero` would have nothing to bind to.

::::exercise[Why does this not compile?]
```csharp run error=CS0315
Console.WriteLine(Product([2, 3, 4]));

static T Product<T>(IEnumerable<T> values)
    where T : IMultipliable<T>
{
    T total = T.One;
    foreach (var v in values) total *= v;
    return total;
}

interface IMultipliable<TSelf>
    where TSelf : IMultipliable<TSelf>
{
    static abstract TSelf One { get; }
    static abstract TSelf operator *(TSelf a, TSelf b);
}
```

Before opening the solution: why does `Product([2, 3, 4])` fail to compile against `IMultipliable<T>`? You do not own `int`, so you cannot add `IMultipliable<int>` to it yourself. What already-implemented BCL interface would let `Product` work for `int`, `double` and every other built-in numeric type at once, with no changes to `Product` itself beyond the constraint?

:::solution
`int` never implements the custom interface `IMultipliable<int>` — nothing in the framework declares that, and a built-in type cannot be retrofitted with a new interface from outside it — so the constraint `where T : IMultipliable<T>` rejects `int` as a type argument, with the compiler reporting exactly that (`CS0315`) on the call above.

This is exactly the gap .NET 7's generic math interfaces close. Every built-in numeric type already implements [`INumber<TSelf>`](https://learn.microsoft.com/en-us/dotnet/api/system.numerics.inumber-1), which composes smaller interfaces such as `IAdditionOperators<TSelf,TOther,TResult>` for `+` and exposes `T.Zero` via `INumberBase<TSelf>` [[5]](https://learn.microsoft.com/en-us/dotnet/standard/generics/math). Constraining to `INumber<T>` instead of a hand-rolled interface makes the same generic shape work for types you never wrote:

```csharp run id=static-abstract-inumber
using System.Numerics;

int[] tickets = [12, 45, 7, 30];
double[] prices = [12.5, 8.75, 3.0];

Console.WriteLine(Total(tickets));
Console.WriteLine(Total(prices));

static T Total<T>(IEnumerable<T> values)
    where T : INumber<T>
{
    T sum = T.Zero;
    foreach (var v in values)
        sum += v;
    return sum;
}
```

```text output
94
24.25
```

Building `IAddable<TSelf>` first is still worth doing once: it is small enough to see exactly what a static abstract member requires, before reaching for the sprawling real interface that ships in `System.Numerics`.
:::
::::

## Versioning: adding a member without breaking every implementer

The `INotifier` interface has shipped with one member, `Send`, and outside code already implements it. A new requirement arrives: send several messages at once, more cheaply than one `Send` call per message where a channel supports it. Adding the obvious member as a plain, bodyless interface method breaks every existing implementer, because implementing an interface has always meant supplying every one of its members:

```csharp run error=CS0535
INotifier[] notifiers =
    [new EmailNotifier(), new SmsNotifier()];
foreach (var n in notifiers)
    n.Send("Deploy finished");

interface INotifier
{
    void Send(string message);
    void SendBatch(IEnumerable<string> messages);
}

class EmailNotifier : INotifier
{
    public void Send(string message)
        => Console.WriteLine($"email: {message}");
}

class SmsNotifier : INotifier
{
    public void Send(string message)
        => Console.WriteLine($"sms: {message}");
}
```

Both `CS0535` errors point at `EmailNotifier` and `SmsNotifier`, not at `INotifier` — from the compiler's position, the interface changed its contract and the classes silently stopped honoring it. A `NuGet` package that shipped `INotifier` and did this in a minor version would break every consumer's build. Giving the new member a default body instead keeps the old contract satisfiable while adding the new one, which is the versioning case default interface members exist to solve: an interface author can add a member to an interface "already released and used by innumerable clients" without forcing a recompile-and-fix on every implementer [[1]](https://learn.microsoft.com/en-us/dotnet/csharp/advanced-topics/interface-implementation/default-interface-methods-versions).

```csharp run id=versioning-fix
INotifier[] notifiers =
    [new EmailNotifier(), new SmsNotifier()];
foreach (var n in notifiers)
    n.Send("Deploy finished");

INotifier batch = new SmsNotifier();
batch.SendBatch(["a", "b"]);

interface INotifier
{
    void Send(string message);

    void SendBatch(IEnumerable<string> messages)
    {
        foreach (var m in messages)
            Send(m);
    }
}

class EmailNotifier : INotifier
{
    public void Send(string message)
        => Console.WriteLine($"email: {message}");
}

class SmsNotifier : INotifier
{
    public void Send(string message)
        => Console.WriteLine($"sms: {message}");

    public void SendBatch(IEnumerable<string> messages)
        => Console.WriteLine(
            $"sms batch of {messages.Count()}: " +
            string.Join(", ", messages));
}
```

```text output
email: Deploy finished
sms: Deploy finished
sms batch of 2: a, b
```

`EmailNotifier` did not change at all and still compiles; calling `SendBatch` on it would fall back to the default, one `Send` per message. `SmsNotifier` opted into a real batch implementation by overriding the default, the same way `EmailNotifier` overrode `Describe` earlier. Nothing about this is free: the new member still has to be reachable through `INotifier` (as `batch.SendBatch` is above), because a class never inherits interface members through its own type, default or not — the rule from the first section applies here too.

::::exercise[Find the bug in this diff]
A teammate's pull request adds order history to a shipped `IAccount` interface used by a dozen implementers across the codebase:

```diff
 public interface IAccount
 {
     decimal Balance { get; }
     void Deposit(decimal amount);
+
+    // new in this PR
+    IReadOnlyList<string> History
+        { get; }
 }
```

CI fails on every one of the dozen implementers with the same diagnostic. Name the diagnostic, explain why it fires on classes the PR never touched, and give the one-line change to `IAccount` that fixes all of them at once without editing any implementer.

:::solution
The diagnostic is `CS0535`, "does not implement interface member", on each of the twelve classes — the same error `EmailNotifier` and `SmsNotifier` got above. It fires on untouched classes because C# interface implementation is checked structurally: adding any bodyless member to `IAccount` obligates every existing implementer to supply it, whether or not that class's author asked for the new feature. One representative implementer reproduces it:

```csharp run error=CS0535
IAccount account = new CheckingAccount(100m);

interface IAccount
{
    decimal Balance { get; }
    void Deposit(decimal amount);

    // new in this PR
    IReadOnlyList<string> History { get; }
}

class CheckingAccount(decimal balance) : IAccount
{
    public decimal Balance { get; private set; } = balance;
    public void Deposit(decimal amount) => Balance += amount;
}
```

The fix is to give `History` a default body instead of leaving it bodyless, the same move `SendBatch` got. `CheckingAccount` is unchanged and compiles again, now with a default, empty activity list:

```csharp run id=account-fix
IAccount account = new CheckingAccount(100m);
account.Deposit(25m);
Console.WriteLine(account.Balance);
Console.WriteLine(account.History.Count);

interface IAccount
{
    decimal Balance { get; }
    void Deposit(decimal amount);

    IReadOnlyList<string> History
        => Array.Empty<string>();
}

class CheckingAccount(decimal balance) : IAccount
{
    public decimal Balance { get; private set; } = balance;
    public void Deposit(decimal amount) => Balance += amount;
}
```

```text output
125
0
```

Every existing implementer keeps compiling with an empty activity list by default; only the classes that want real history need to override the property.
:::
::::

## Choosing between them

None of the rows in the first table are stylistic. Reach for an abstract class when the design needs one from the "abstract class" column above: shared mutable state, a constructor that checks an invariant once for every subtype, or a template method like `ThrottledNotifier.Send` that only makes sense with private state behind it. Reach for an interface — plain, or with default members if it is likely to grow — everywhere else, because a type can implement any number of interfaces but extend only one class, and because an interface costs nothing until a second implementation (a real one or a test double) actually exists.

<figure class="diagram">
<svg viewBox="0 0 360 430" role="img" aria-labelledby="ivac-flow-title ivac-flow-desc">
<title id="ivac-flow-title">Decision flowchart: interface or abstract class</title>
<desc id="ivac-flow-desc">Three yes/no questions stacked vertically. Each has an answer box to its right reached by a yes arrow, and a no arrow continuing down to the next question. If all three answers are no, a final box recommends starting with an interface and promoting to an abstract class only when a rule above applies.</desc>
<defs>
<marker id="ivac-arrow-n" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-stroke"/></marker>
<marker id="ivac-arrow-y" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-accent"/></marker>
</defs>
<rect x="10" y="12" width="190" height="78" rx="8" class="d-box"/>
<text x="25" y="38" class="d-small">State or a constructor</text>
<text x="25" y="56" class="d-small">rule to share?</text>
<path d="M200 51 H210" class="d-accent" marker-end="url(#ivac-arrow-y)"/>
<text x="204" y="44" class="d-small d-text-accent">yes</text>
<rect x="210" y="12" width="140" height="78" rx="8" class="d-box-accent"/>
<text x="225" y="36" class="d-bold d-small">Abstract class</text>
<text x="225" y="54" class="d-small d-muted">state lives here</text>
<text x="225" y="70" class="d-small d-muted">checked once</text>
<path d="M105 90 V116" class="d-line" marker-end="url(#ivac-arrow-n)"/>
<text x="112" y="106" class="d-small d-muted">no</text>
<rect x="10" y="120" width="190" height="68" rx="8" class="d-box"/>
<text x="25" y="146" class="d-small">Base class slot</text>
<text x="25" y="164" class="d-small">already used?</text>
<path d="M200 154 H210" class="d-accent" marker-end="url(#ivac-arrow-y)"/>
<text x="204" y="147" class="d-small d-text-accent">yes</text>
<rect x="210" y="120" width="140" height="68" rx="8" class="d-box-accent"/>
<text x="225" y="146" class="d-bold d-small">Interface</text>
<text x="225" y="164" class="d-small d-muted">only slot left</text>
<path d="M105 188 V214" class="d-line" marker-end="url(#ivac-arrow-n)"/>
<text x="112" y="204" class="d-small d-muted">no</text>
<rect x="10" y="218" width="190" height="78" rx="8" class="d-box"/>
<text x="25" y="244" class="d-small">Unrelated types</text>
<text x="25" y="262" class="d-small">opting into it?</text>
<path d="M200 257 H210" class="d-accent" marker-end="url(#ivac-arrow-y)"/>
<text x="204" y="250" class="d-small d-text-accent">yes</text>
<rect x="210" y="218" width="140" height="78" rx="8" class="d-box-accent"/>
<text x="225" y="242" class="d-bold d-small">Interface</text>
<text x="225" y="260" class="d-small d-muted">default members</text>
<text x="225" y="276" class="d-small d-muted">let it grow safely</text>
<path d="M105 296 V322" class="d-line" marker-end="url(#ivac-arrow-n)"/>
<text x="112" y="312" class="d-small d-muted">no</text>
<rect x="10" y="326" width="340" height="94" rx="8" class="d-box-2"/>
<text x="25" y="350" class="d-bold d-small">Neither is forced</text>
<text x="25" y="368" class="d-small">Start with an interface;</text>
<text x="25" y="384" class="d-small">promote to an abstract class</text>
<text x="25" y="400" class="d-small">only when a rule above applies.</text>
</svg>
<figcaption>Figure 1. Three questions, asked top to bottom; the first "yes" settles it. If every answer is "no", start with an interface and add an abstract class only if a later requirement forces one of the earlier questions to "yes".</figcaption>
</figure>

The middle question is a narrower stand-in for the interface segregation principle: a contract that unrelated types opt into stays healthier as a small interface than as a slice of a larger abstract class carved out with `NotSupportedException`. The same capability table also explains why "prefer composition over inheritance" is not a rule against abstract classes as such — it is a warning against reaching for shared *state and a base class* when the real requirement was only a shared *contract*, which an interface gives you without a single-inheritance slot spent on it.

::::exercise[Apply the guide]
A payments codebase has three unrelated types — `Invoice`, `SubscriptionCharge`, and `RefundRequest` — that all need a `decimal GetAuditAmount()` method for a new reporting feature, with no shared state and no shared base class today. A second, separate need: four different `PaymentMethod` subtypes (`CreditCard`, `BankTransfer`, `Wallet`, `Voucher`) all enforce the same "amount must be positive and below a per-method limit" check before processing, and duplicating that check has already caused one production bug.

For each of the two needs, walk the flowchart and name the outcome.
:::solution
`GetAuditAmount()`: no shared state, no base class already in use, and three otherwise-unrelated types opting into one small contract — every question but the last is "no", and the last is "yes". That is an interface, `IAuditable` with one member.

The `PaymentMethod` limit check: this is exactly the state-and-invariant case from the `ThrottledNotifier` section — a rule ("positive, below this method's limit") that must be enforced once, backed by state (the limit) that every subtype shares. The first question is "yes", which settles it before the other two are even asked: an abstract `PaymentMethod` class with a non-virtual `Process(decimal amount)` that checks the rule and then calls a `protected abstract` method for what is specific to each subtype — the same shape `Plan.PriceFor` used for pricing rules in [the four pillars article](/oop-design/four-pillars-of-oop/#so-when-is-inheritance-the-right-tool).
:::
::::
