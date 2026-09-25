---
title: "SOLID Principles with C# Examples That Aren't Toys"
description: "Each SOLID principle shown as a real violation that breaks something, a working fix, and one place the site's own examples say the principle goes too far."
pillar: oop-design
order: 3
author: markus
published: 2026-09-22
updated: 2026-09-22
level: intermediate
tags: [solid, oop, liskov-substitution, dependency-inversion, design-principles]
prerequisites: ["oop-design/four-pillars-of-oop"]
sources:
  - title: "The Single Responsibility Principle"
    url: "https://blog.cleancoder.com/uncle-bob/2014/05/08/SingleReponsibilityPrinciple.html"
    publisher: "Robert C. Martin, cleancoder.com"
    accessed: 2026-09-22
  - title: "Solid Relevance"
    url: "https://blog.cleancoder.com/uncle-bob/2020/10/18/Solid-Relevance.html"
    publisher: "Robert C. Martin, cleancoder.com"
    accessed: 2026-09-22
  - title: "A Behavioral Notion of Subtyping (Liskov and Wing, 1994)"
    url: "https://www.cs.cmu.edu/~wing/publications/LiskovWing94.pdf"
    publisher: "Carnegie Mellon University"
    accessed: 2026-09-22
  - title: "ReadOnlyCollection<T> Class"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.objectmodel.readonlycollection-1"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "IList<T> Interface"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.ilist-1"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Architectural principles (Dependency inversion)"
    url: "https://learn.microsoft.com/en-us/dotnet/architecture/modern-web-apps-azure/architectural-principles"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Interfaces Aren't Abstractions"
    url: "https://blog.ploeh.dk/2010/12/02/Interfacesarenotabstractions/"
    publisher: "Mark Seemann"
    accessed: 2026-09-22
  - title: "Yagni"
    url: "https://martinfowler.com/bliki/Yagni.html"
    publisher: "Martin Fowler"
    accessed: 2026-09-22
  - title: "IList<T>.Insert(Int32, T) Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.ilist-1.insert"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
draft: false
---

Five separate principles share one mnemonic. Each one below gets a real violation, a real consequence you can watch happen by running the program, and a fix. Robert C. Martin, who described all five, put the point behind Single Responsibility this way: "Gather together the things that change for the same reasons. Separate things that change for different reasons" [[2]](https://blog.cleancoder.com/uncle-bob/2020/10/18/Solid-Relevance.html). That sentence, more than the five-letter acronym, is what the rest of this page is about: where change pressure comes from, and what happens when code that should be separate is fused together.

Every program below is a complete, file-based .NET 10 console app; `[[n]]` links go to the source that makes the claim next to it.

## Single responsibility: whose reason to change is this?

A class has a single responsibility when there is exactly one kind of change that would require editing it — in Martin's own words, "each software module should have one and only one reason to change" [[1]](https://blog.cleancoder.com/uncle-bob/2014/05/08/SingleReponsibilityPrinciple.html). The usual failure looks harmless: two things that happen to sit next to each other get written as one method, because at the time nothing seems to depend on keeping them apart.

A library's overdue-notice class computes a fine and writes the message a member sees. Both live in `BuildNotice`.

```csharp run id=notice-v1
var loan = new Loan(
    "Priya", "DSA Notes",
    Due: new DateOnly(2026, 9, 1));
var today = new DateOnly(2026, 9, 15);

var notice = new OverdueNotice();
string text = notice.BuildNotice(loan, today);
Console.WriteLine(text);

CheckFine(text, expected: 3.50m);

static void CheckFine(
    string text, decimal expected)
{
    string want = $"Fine: ${expected:0.00}";
    if (!text.Contains(want))
    {
        Console.WriteLine($"FAIL: no '{want}'");
        Environment.Exit(1);
    }
    Console.WriteLine("Fine check passed.");
}

record Loan(
    string Member, string Title, DateOnly Due);

class OverdueNotice
{
    public string BuildNotice(
        Loan loan, DateOnly today)
    {
        int daysLate = today.DayNumber
            - loan.Due.DayNumber;
        decimal fine = daysLate * 0.25m;
        return $"Dear {loan.Member}, " +
               $"'{loan.Title}' is {daysLate} " +
               $"days overdue. " +
               $"Fine: ${fine:0.00}.";
    }
}
```

```text output
Dear Priya, 'DSA Notes' is 14 days overdue. Fine: $3.50.
Fine check passed.
```

`CheckFine` is a stand-in for a real test: it cares only about the fine, and it can only get at the fine by reading it out of the sentence `BuildNotice` produces. That is the coupling. The member-communications team, who own none of the fine math, rewrite the wording the following month:

```csharp run id=notice-v2 fails
var loan = new Loan(
    "Priya", "DSA Notes",
    Due: new DateOnly(2026, 9, 1));
var today = new DateOnly(2026, 9, 15);

var notice = new OverdueNotice();
string text = notice.BuildNotice(loan, today);
Console.WriteLine(text);

CheckFine(text, expected: 3.50m);

static void CheckFine(
    string text, decimal expected)
{
    string want = $"Fine: ${expected:0.00}";
    if (!text.Contains(want))
    {
        Console.WriteLine($"FAIL: no '{want}'");
        Environment.Exit(1);
    }
    Console.WriteLine("Fine check passed.");
}

record Loan(
    string Member, string Title, DateOnly Due);

class OverdueNotice
{
    // Reworded for clarity. The fine math is
    // completely untouched below.
    public string BuildNotice(
        Loan loan, DateOnly today)
    {
        int daysLate = today.DayNumber
            - loan.Due.DayNumber;
        decimal fine = daysLate * 0.25m;
        return $"Hi {loan.Member}, " +
               $"'{loan.Title}' is {daysLate} " +
               $"days late. " +
               $"Amount owed: ${fine:0.00}.";
    }
}
```

```text output
Hi Priya, 'DSA Notes' is 14 days late. Amount owed: $3.50.
FAIL: no 'Fine: $3.50'
```

Nothing about the fine changed: `daysLate * 0.25m` is identical in both versions. The check still fails, because it was never really testing the fine; it was testing a sentence that happened to contain the fine. In a real codebase this is what "flaky test" often means — not randomness, but a check coupled to a responsibility it doesn't own. Multiply this by however many tests read numbers out of user-facing strings, and every wording pass becomes a test-fixing pass owned by the wrong team.

The fix is to give the fine and the wording their own classes, so a change to one has nothing to import from the other.

```csharp run id=notice-fixed
var loan = new Loan(
    "Priya", "DSA Notes",
    Due: new DateOnly(2026, 9, 1));
var today = new DateOnly(2026, 9, 15);

var calc = new FineCalculator();
var fmt = new OverdueNoticeFormatter();

decimal fine = calc.FineFor(loan, today);
string text = fmt.Format(loan, today, fine);
Console.WriteLine(text);

CheckFine(fine, expected: 3.50m);

static void CheckFine(
    decimal fine, decimal expected)
{
    if (fine != expected)
    {
        Console.WriteLine(
            $"FAIL: expected {expected}, " +
            $"got {fine}");
        Environment.Exit(1);
    }
    Console.WriteLine("Fine check passed.");
}

record Loan(
    string Member, string Title, DateOnly Due);

class FineCalculator
{
    public decimal FineFor(
        Loan loan, DateOnly today)
    {
        int daysLate = today.DayNumber
            - loan.Due.DayNumber;
        return daysLate * 0.25m;
    }
}

class OverdueNoticeFormatter
{
    // Reworded again. Nothing above this class
    // changed, and CheckFine never re-parses text.
    public string Format(
        Loan loan, DateOnly today, decimal fine)
    {
        int daysLate = today.DayNumber
            - loan.Due.DayNumber;
        return $"Hi {loan.Member}, " +
               $"'{loan.Title}' is {daysLate} " +
               $"days late. " +
               $"Amount owed: ${fine:0.00}.";
    }
}
```

```text output
Hi Priya, 'DSA Notes' is 14 days late. Amount owed: $3.50.
Fine check passed.
```

`CheckFine` now reads `calc.FineFor(...)` directly, a `decimal`, not a substring of a sentence a different team owns. The wording can change every week without anyone who cares about the fine noticing.

::::exercise[Spot the second responsibility]
`FineCalculator.FineFor` still has two reasons to change: the grace-period rule that decides when a loan counts as late, and the per-day rate. A separate "hardship waiver" policy is being added that halves the rate for some members. Where does that belong, and why doesn't it belong inside `FineCalculator` as an `if` branch?

:::solution
A waiver is a rule about *which rate applies*, which is a different concern from *how the rate turns into a fine once you know it*. Adding `if (loan.HasWaiver) rate = 0.125m;` inside `FineFor` fuses "compute a fine given a rate" with "decide which rate a member gets," so every new waiver category (senior members, staff, a promotional period) means editing the same method again. Passing the rate in as a parameter — `FineFor(Loan loan, DateOnly today, decimal ratePerDay)` — moves the decision to whoever already knows about waiver policy, and `FineCalculator` goes back to having exactly one reason to change: the arithmetic.
:::
::::

## Open/closed: extend by adding, not by editing what shipped

The open/closed principle is commonly traced to Bertrand Meyer; the phrasing this page uses is Martin's own summary of it: "a module should be open for extension but closed for modification" [[2]](https://blog.cleancoder.com/uncle-bob/2020/10/18/Solid-Relevance.html). The violation is not "using an `if` chain" — a short chain is fine. It's a chain that a later change has to be *inserted into*, at a specific place, for the right answer to come out.

A shipping calculator prices a package from its method name:

```csharp run id=ocp-violation
string[] methods =
    ["Standard", "Express", "Overnight"];
foreach (var m in methods)
    Console.WriteLine($"{m,-10}{Rate(m)}");

static decimal Rate(string method)
{
    if (method.StartsWith("Standard"))
        return 1.0m;
    if (method.StartsWith("Express"))
        return 2.5m;
    if (method.StartsWith("Overnight"))
        return 5.0m;
    throw new ArgumentException(
        $"Unknown method: {method}");
}
```

```text output
Standard  1.0
Express   2.5
Overnight 5.0
```

`StartsWith` was chosen so that method codes like `"Standard-Bulk"` still match. Six months later, a discounted `"StandardPlus"` tier ships. The natural place to add it is at the end of the chain, where every other addition has gone:

```csharp run id=ocp-consequence
string[] methods =
[
    "Standard", "Express",
    "Overnight", "StandardPlus",
];
foreach (var m in methods)
    Console.WriteLine($"{m,-13}{Rate(m)}");

static decimal Rate(string method)
{
    if (method.StartsWith("Standard"))
        return 1.0m;
    if (method.StartsWith("Express"))
        return 2.5m;
    if (method.StartsWith("Overnight"))
        return 5.0m;
    // Added for the new StandardPlus tier:
    if (method.StartsWith("StandardPlus"))
        return 1.5m;
    throw new ArgumentException(
        $"Unknown method: {method}");
}
```

```text output
Standard     1.0
Express      2.5
Overnight    5.0
StandardPlus 1.0
```

`"StandardPlus".StartsWith("Standard")` is `true`, and the `Standard` branch sits earlier in the chain, so it matches first. `StandardPlus` shipments are quietly billed at the `Standard` rate. No exception, no compiler warning, no failing build — the code the shipping team tested (`Standard`, `Express`, `Overnight`) still gives the same three answers it always did, which is exactly why this kind of bug survives code review: the reviewer reads the diff, sees one new `if`, and the three lines above it look untouched.

The fix moves each rate into its own type that matches itself, so there is no chain for order to matter in:

```csharp run id=ocp-fixed
IShippingRate[] rates =
[
    new FlatRate("Standard", 1.0m),
    new FlatRate("Express", 2.5m),
    new FlatRate("Overnight", 5.0m),
    new FlatRate("StandardPlus", 1.5m),
];
string[] methods =
[
    "Standard", "Express",
    "Overnight", "StandardPlus",
];
foreach (var m in methods)
    Console.WriteLine(
        $"{m,-13}{RateFor(rates, m)}");

static decimal RateFor(
    IShippingRate[] rates, string method)
{
    foreach (var rate in rates)
        if (rate.Matches(method))
            return rate.PricePerKg;
    throw new ArgumentException(
        $"Unknown method: {method}");
}

interface IShippingRate
{
    bool Matches(string method);
    decimal PricePerKg { get; }
}

sealed class FlatRate(
    string method, decimal pricePerKg)
    : IShippingRate
{
    public bool Matches(string candidate)
        => candidate == method;
    public decimal PricePerKg { get; }
        = pricePerKg;
}
```

```text output
Standard     1.0
Express      2.5
Overnight    5.0
StandardPlus 1.5
```

`FlatRate.Matches` uses `==`, not `StartsWith`, so `StandardPlus` and `Standard` can never collide regardless of which is registered first. `RateFor` itself never changes again for a new flat-rate tier — the extension is a new `FlatRate(...)` entry, not a new branch inside logic that other tiers already depend on. It is not literally true that nothing here is ever edited again: a tier priced by weight brackets instead of a flat rate would need a second `IShippingRate` implementation, which is exactly the kind of extension the interface exists to admit without touching `FlatRate` or `RateFor`.

::::exercise[Predict before you run it]
Before running it, decide what `Rate("StandardPlus")` returns if the `Overnight` check in the very first (broken) version is moved to check `method.StartsWith("Overnight-Plus")` — does that change which branch `StandardPlus` hits?

:::solution
No. `StandardPlus` never reaches the `Overnight` branch at all in the broken version, because the very first check, `method.StartsWith("Standard")`, already matches and returns `1.0m`. The bug is entirely about `Standard` coming before `StandardPlus` in the chain; nothing about the `Overnight` branch's condition is involved.
:::
::::

## Liskov substitution: a violation the BCL ships with

Liskov and Wing's formal treatment defines subtyping in terms of behavior a substitute must preserve, not just the method signatures it must have [[3]](https://www.cs.cmu.edu/~wing/publications/LiskovWing94.pdf). Martin's shorter version: "a program that uses an interface must not be confused by an implementation of that interface" [[2]](https://blog.cleancoder.com/uncle-bob/2020/10/18/Solid-Relevance.html). Most write-ups illustrate this with an invented `Bird`/`Penguin` hierarchy. .NET's own base class library has a real one, and it compiles without a warning.

`List<T>.AsReadOnly()` returns a `ReadOnlyCollection<T>`. Its documented type is `ICollection<T>, IEnumerable<T>, IList<T>, IReadOnlyCollection<T>, IReadOnlyList<T>` [[4]](https://learn.microsoft.com/en-us/dotnet/api/system.collections.objectmodel.readonlycollection-1) — it really does implement `IList<T>`, the same interface a `List<T>` implements. `IList<T>.Add` is a real member of that interface [[5]](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.ilist-1). Code that only knows it is holding an `IList<T>` has every reason to believe `Add` works:

```csharp run id=lsp-violation throws=NotSupportedException
using System.Collections.ObjectModel;

var numbers = new List<int> { 10, 20, 30 };
IList<int> published = numbers.AsReadOnly();

AppendAuditEntry(published, 40);

static void AppendAuditEntry(
    IList<int> log, int entry)
{
    // Typed as IList<T>, so this "should" work.
    log.Add(entry);
    Console.WriteLine(
        $"Logged. Count: {log.Count}");
}
```

It doesn't: the call throws `System.NotSupportedException: Collection is read-only`. Microsoft's own reference documents this precisely: `ReadOnlyCollection<T>`'s explicit implementation of `ICollection<T>.Add` "always throws `NotSupportedException`", and the same is true of `Clear`, `Remove`, `IList<T>.Insert`, and `IList<T>.RemoveAt` [[4]](https://learn.microsoft.com/en-us/dotnet/api/system.collections.objectmodel.readonlycollection-1). This is exactly what Liskov substitution forbids: a type that satisfies the interface's *shape* while breaking a behavior every caller of that interface is entitled to assume. The compiler has no rule against it, because signatures are all it checks.

`IList<T>` itself anticipates this: it inherits an `IsReadOnly` property from `ICollection<T>` [[5]](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.ilist-1), and the consequence of ignoring that flag is documented on the mutating members themselves — `IList<T>.Insert`'s Exceptions list states that it throws `NotSupportedException` when "the `IList<T>` is read-only" [[9]](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.ilist-1.insert). A caller that checks `IsReadOnly` first degrades instead of crashing:

```csharp run id=lsp-fixed
using System.Collections.ObjectModel;

var numbers = new List<int> { 10, 20, 30 };
IList<int> published = numbers.AsReadOnly();

AppendAuditEntry(published, 40);
Console.WriteLine("Done.");

static void AppendAuditEntry(
    IList<int> log, int entry)
{
    if (log.IsReadOnly)
    {
        Console.WriteLine(
            $"Skipped: read-only, " +
            $"has {log.Count} entries.");
        return;
    }
    log.Add(entry);
    Console.WriteLine(
        $"Logged. Count: {log.Count}");
}
```

```text output
Skipped: read-only, has 3 entries.
Done.
```

`IsReadOnly` is a runtime flag, not a type, so this is a defensive check rather than a real fix — nothing stops a third `IList<T>` implementation from setting `IsReadOnly` to `false` and still throwing on `Add`. The type-level fix is to stop asking for `IList<T>` in the first place: a method that only ever reads should ask for `IReadOnlyList<T>`, which has no `Add` to call, so the mistake cannot compile. `AppendAuditEntry` asks to mutate, so the honest fix is to type it as `ICollection<T>` (which still has `IsReadOnly`) and treat every caller-supplied collection as possibly read-only, the same way the check above does. The general shape — split a capability-heavy interface so callers only depend on the parts they can actually rely on — is the Interface Segregation Principle, next.

This particular violation is narrow: one interface, a handful of mutating members. A base class whose subclasses cannot honor its contract *at all* — not one method, the whole relationship — usually is not fixable by narrowing an interface, because the problem is the inheritance itself. That trade, and when to replace a hierarchy with composition instead, is covered in [a dedicated article on composition over inheritance](/oop-design/composition-over-inheritance/).

::::exercise[Prove it with a narrower type]
Change `AppendAuditEntry`'s parameter from `IList<int>` to `IReadOnlyList<int>` and try to keep the `log.Add(entry)` call. What happens, and at which stage — compiling or running?

:::solution
It fails to compile: `IReadOnlyList<T>` has no `Add` method at all, so `log.Add(entry)` is `CS1061`, "does not contain a definition for 'Add'". That is strictly better than the runtime `NotSupportedException` above, because the mistake is now impossible to ship — the LSP violation can't reach a caller who was never given a type capable of expressing it.
:::
::::

## Interface segregation: don't force callers to implement what they can't do

"Keep interfaces small so that users don't end up depending on things they don't need" is Martin's own summary [[2]](https://blog.cleancoder.com/uncle-bob/2020/10/18/Solid-Relevance.html). The failure mode is a single interface that bundles several capabilities, so any class that has only one of them has to fake the rest.

A reporting system exports to three formats through one interface:

```csharp run id=isp-violation throws=NotImplementedException
object[] reports =
[
    new SalesReport(),
    new QuickSummaryReport(),
    new SalesReport(),
];

foreach (var r in reports)
{
    var exp = (IDataExporter)r;
    exp.ExportToPdf($"{r.GetType().Name}.pdf");
    Console.WriteLine(
        $"Archived {r.GetType().Name}");
}

interface IDataExporter
{
    void ExportToCsv(string path);
    void ExportToPdf(string path);
    void ExportToExcel(string path);
}

sealed class SalesReport : IDataExporter
{
    public void ExportToCsv(string path)
        => Console.WriteLine($"csv -> {path}");
    public void ExportToPdf(string path)
        => Console.WriteLine($"pdf -> {path}");
    public void ExportToExcel(string path)
        => Console.WriteLine($"xlsx -> {path}");
}

// A lightweight report; nobody has ever asked
// for it as a PDF or a spreadsheet.
sealed class QuickSummaryReport : IDataExporter
{
    public void ExportToCsv(string path)
        => Console.WriteLine($"csv -> {path}");
    public void ExportToPdf(string path)
        => throw new NotImplementedException();
    public void ExportToExcel(string path)
        => throw new NotImplementedException();
}
```

The batch job's nightly PDF archive loops over every report and calls `ExportToPdf`. It archives the first `SalesReport`, then throws on `QuickSummaryReport` — and the *second* `SalesReport`, listed right after it, never runs at all, because the loop died partway through. `QuickSummaryReport` was forced to be a `IDataExporter`, the interface said it could export to PDF, and a caller reasonably believed it.

Splitting the interface by capability removes the forced implementation entirely — a class simply doesn't claim a capability it doesn't have:

```csharp run id=isp-fixed
object[] reports =
[
    new SalesReport(),
    new QuickSummaryReport(),
    new SalesReport(),
];

foreach (var r in reports.OfType<IPdfExportable>())
{
    r.ExportToPdf($"{r.GetType().Name}.pdf");
    Console.WriteLine(
        $"Archived {r.GetType().Name}");
}

interface ICsvExportable
{ void ExportToCsv(string path); }
interface IPdfExportable
{ void ExportToPdf(string path); }
interface IExcelExportable
{ void ExportToExcel(string path); }

sealed class SalesReport
    : ICsvExportable, IPdfExportable,
      IExcelExportable
{
    public void ExportToCsv(string path)
        => Console.WriteLine($"csv -> {path}");
    public void ExportToPdf(string path)
        => Console.WriteLine($"pdf -> {path}");
    public void ExportToExcel(string path)
        => Console.WriteLine($"xlsx -> {path}");
}

sealed class QuickSummaryReport
    : ICsvExportable
{
    public void ExportToCsv(string path)
        => Console.WriteLine($"csv -> {path}");
}
```

```text output
pdf -> SalesReport.pdf
Archived SalesReport
pdf -> SalesReport.pdf
Archived SalesReport
```

`reports.OfType<IPdfExportable>()` keeps only what genuinely supports the capability the loop needs; `QuickSummaryReport` is skipped, not crashed past. Both `SalesReport` instances are archived — including the second one, which the broken version never reached.

::::exercise[Add a format without breaking anyone]
A `ReceiptReport` class needs CSV export only, like `QuickSummaryReport`, plus a brand-new `IJsonExportable` capability nothing else has yet. Write its declaration line (the `class ReceiptReport : ...` part). Does any existing class or the `OfType<IPdfExportable>()` loop need to change?

:::solution
```csharp run
object[] reports =
    [new ReceiptReport()];
foreach (var r in
    reports.OfType<IJsonExportable>())
    r.ExportToJson("out.json");

interface ICsvExportable
{ void ExportToCsv(string path); }
interface IJsonExportable
{ void ExportToJson(string path); }

sealed class ReceiptReport
    : ICsvExportable, IJsonExportable
{
    public void ExportToCsv(string path)
        => Console.WriteLine($"csv -> {path}");
    public void ExportToJson(string path)
        => Console.WriteLine($"json -> {path}");
}
```

```text output
json -> out.json
```

Nothing else changes. `SalesReport` and `QuickSummaryReport` never mention `IJsonExportable`, so they are unaffected, and the PDF batch loop still only sees types that opted into `IPdfExportable` — `ReceiptReport` correctly never appears in it.
:::
::::

## Dependency inversion: point dependencies at the abstraction, not the detail

Martin's summary: "Depend in the direction of abstraction. High level modules should not depend upon low level details" [[2]](https://blog.cleancoder.com/uncle-bob/2020/10/18/Solid-Relevance.html). Microsoft's architecture guide states the same shape more mechanically: ordinarily, "if class A calls a method of class B and class B calls a method of class C, then at compile time class A will depend on class B, and class B will depend on class C" — a straight line, high level to low. Applying dependency inversion, in the guide's own words, "allows A to call methods on an abstraction that B implements... thus *inverting* the typical compile-time dependency" [[6]](https://learn.microsoft.com/en-us/dotnet/architecture/modern-web-apps-azure/architectural-principles).

An order processor that prints receipts by naming the concrete printer class directly:

```csharp run id=dip-violation
var batch = new OrderProcessor();
batch.Process("Order-201", quiet: true);

var interactive = new OrderProcessor();
interactive.Process("Order-202", quiet: false);

sealed class OrderProcessor
{
    public void Process(
        string orderId, bool quiet)
    {
        if (quiet)
            ConsoleReceiptPrinter.Muted = true;

        new ConsoleReceiptPrinter()
            .Print(orderId);

        // No code path resets Muted.
    }
}

sealed class ConsoleReceiptPrinter
{
    public static bool Muted;

    public void Print(string orderId)
    {
        if (Muted) return;
        Console.WriteLine(
            $"Receipt: {orderId}");
    }
}
```

```text output
```

Nothing prints. `OrderProcessor` names `ConsoleReceiptPrinter` directly, so a nightly batch import that wants to run quietly has only one lever available: a `static` flag on the concrete class itself, because that class is the only thing anyone can reach. Muting it for the batch run leaves it muted for the interactive order that runs immediately afterward in the same process — `Order-202`'s receipt is silently dropped, and there is no exception to notice. The low-level detail (`ConsoleReceiptPrinter`) is shared global state precisely because the high-level policy (`OrderProcessor`) never asked for an abstraction it could hold one instance of at a time.

<figure class="diagram">
<svg viewBox="0 0 320 400" role="img" aria-labelledby="dip-title dip-desc">
<title id="dip-title">Dependency direction before and after inversion</title>
<desc id="dip-desc">Before: OrderProcessor points down at the concrete ConsoleReceiptPrinter class. After: OrderProcessor points down at an IReceiptPrinter interface it owns, and ConsoleReceiptPrinter now points up at that same interface by implementing it.</desc>
<defs>
<marker id="dip-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-accent"/></marker>
</defs>
<text x="20" y="20" class="d-small d-bold">Before</text>
<rect x="20" y="30" width="280" height="38" rx="6" class="d-box-accent"/>
<text x="160" y="54" text-anchor="middle" class="d-mono d-small">OrderProcessor</text>
<path d="M160 68 V104" class="d-line" marker-end="url(#dip-arrow)"/>
<text x="160" y="90" text-anchor="middle" class="d-small d-muted">compile-time dependency</text>
<rect x="20" y="108" width="280" height="38" rx="6" class="d-box"/>
<text x="160" y="132" text-anchor="middle" class="d-mono d-small">ConsoleReceiptPrinter</text>
<text x="20" y="184" class="d-small d-bold">After</text>
<rect x="20" y="194" width="280" height="38" rx="6" class="d-box-accent"/>
<text x="160" y="218" text-anchor="middle" class="d-mono d-small">OrderProcessor</text>
<path d="M160 232 V268" class="d-line" marker-end="url(#dip-arrow)"/>
<text x="160" y="254" text-anchor="middle" class="d-small d-muted">depends on</text>
<rect x="20" y="272" width="280" height="38" rx="6" class="d-box-accent"/>
<text x="160" y="296" text-anchor="middle" class="d-mono d-small">IReceiptPrinter</text>
<path d="M160 348 V310" class="d-line" marker-end="url(#dip-arrow)"/>
<text x="205" y="332" class="d-small d-text-accent">implements</text>
<rect x="20" y="348" width="280" height="38" rx="6" class="d-box"/>
<text x="160" y="372" text-anchor="middle" class="d-mono d-small">ConsoleReceiptPrinter</text>
</svg>
<figcaption>Figure 1. Before, the high-level class names the low-level class directly. After, both point at an interface the high-level side owns; the low-level class now depends upward on it instead of the other way around.</figcaption>
</figure>

The fix gives `OrderProcessor` an abstraction it owns and receives an implementation of, instead of a class name it looks up:

```csharp run id=dip-fixed
var batch = new OrderProcessor(
    new NullReceiptPrinter());
batch.Process("Order-201");

var interactive = new OrderProcessor(
    new ConsoleReceiptPrinter());
interactive.Process("Order-202");

interface IReceiptPrinter
{
    void Print(string orderId);
}

sealed class OrderProcessor(
    IReceiptPrinter printer)
{
    public void Process(string orderId)
        => printer.Print(orderId);
}

sealed class ConsoleReceiptPrinter
    : IReceiptPrinter
{
    public void Print(string orderId)
        => Console.WriteLine(
            $"Receipt: {orderId}");
}

sealed class NullReceiptPrinter
    : IReceiptPrinter
{
    public void Print(string orderId) { }
}
```

```text output
Receipt: Order-202
```

There is no shared state to forget to reset. `batch` and `interactive` are two independent `OrderProcessor` instances, each holding the printer it was given; a batch job that wants silence gets a `NullReceiptPrinter` instead of toggling a flag that outlives it.

### Dependency inversion is not a DI container

The two are often treated as the same thing because they usually show up together, but they answer different questions. Dependency inversion is the *design* claim just demonstrated: the interface `IReceiptPrinter` belongs to `OrderProcessor`'s side of the relationship, and `ConsoleReceiptPrinter` depends on it, not the reverse. Nothing about that fix used a container — `new OrderProcessor(new ConsoleReceiptPrinter())` is dependency injection done entirely by hand ("constructor injection"), and the principle was already satisfied before any container entered the picture.

A DI container such as `Microsoft.Extensions.DependencyInjection` is a *mechanism* that automates the wiring `new OrderProcessor(new ConsoleReceiptPrinter())` did manually — useful once a graph has enough constructors that assembling it by hand gets tedious, not a requirement for the principle:

```csharp run id=dip-container
#:package Microsoft.Extensions.DependencyInjection@9.*
using Microsoft.Extensions.DependencyInjection;

var services = new ServiceCollection();
services.AddSingleton<
    IReceiptPrinter, ConsoleReceiptPrinter>();
services.AddTransient<OrderProcessor>();
using var provider =
    services.BuildServiceProvider();

var processor = provider
    .GetRequiredService<OrderProcessor>();
processor.Process("Order-501");

interface IReceiptPrinter
{
    void Print(string orderId);
}

sealed class ConsoleReceiptPrinter
    : IReceiptPrinter
{
    public void Print(string orderId)
        => Console.WriteLine(
            $"Receipt: {orderId}");
}

sealed class OrderProcessor(
    IReceiptPrinter printer)
{
    public void Process(string orderId)
        => printer.Print(orderId);
}
```

```text output
Receipt: Order-501
```

The container only decides *which* `IReceiptPrinter` to hand `OrderProcessor` and *when* to construct it; `OrderProcessor` still only knows about the interface. A container can just as easily be used to violate the principle: a class that calls `provider.GetRequiredService<ConsoleReceiptPrinter>()` for the concrete type, from inside its own logic, is naming a low-level detail again — the "service locator" shape — except the dependency is now hidden inside a method body instead of visible in a constructor signature, which is a regression for readability, not an improvement. Having a container in the project proves nothing about whether dependency inversion is being followed; reading a constructor's parameter types does. [A dedicated article](/oop-design/dependency-injection/) on building this wiring by hand, and on container lifetimes, is planned separately.

::::exercise[Find the bug from a description alone]
A payment service is refactored to use dependency injection: `PaymentService(IFraudChecker checker)`. A later change adds a second constructor, `PaymentService()`, that internally does `checker = new LiveFraudChecker()` so that "existing callers don't need to change." Six months later, tests that construct `PaymentService()` with no arguments start making real fraud-check network calls in CI. Explain why, in terms of dependency inversion specifically.

:::solution
The parameterless constructor reintroduced the exact dependency the injected constructor removed: `PaymentService` now contains the name `LiveFraudChecker`, a concrete low-level class, inside its own code. `PaymentService(IFraudChecker checker)` still exists and still satisfies the principle, but it is no longer the *only* way to build a `PaymentService`, and any test or caller that uses the convenience constructor is silently back to depending on the concrete detail — dependency inversion is a property of a specific construction path, not a label that, once earned, protects every constructor a class happens to have.
:::
::::

## Where SOLID gets over-applied

Every principle above earned its place by preventing a specific, demonstrated failure. That is also the honest test for when to stop applying one.

**An interface with exactly one implementation, and no second one on the roadmap, is not evidence of dependency inversion — it can be evidence of nothing at all.** Mark Seemann, author of a widely used book on the subject, puts it directly: "An interface is just a language construct. In essence, it's just a shape" [[7]](https://blog.ploeh.dk/2010/12/02/Interfacesarenotabstractions/). Extracting an interface from every class — what he calls "Header Interfaces," the shape Visual Studio's Extract Interface command produces — adds a layer a reader has to look through without adding a second thing the code can become. He names having only one implementation of a given interface a code smell in its own right [[7]](https://blog.ploeh.dk/2010/12/02/Interfacesarenotabstractions/). The `IShippingRate` interface earlier in this page earns its keep because two concrete rates already exist and a third is expected; an `IOrderProcessor` extracted from the single `OrderProcessor` class in the DIP section, with no second implementation anywhere, would not — `OrderProcessor` would still be a fine constructor parameter typed as itself.

**Interface segregation can be run past the point where it helps, too.** Splitting `IDataExporter` into three interfaces was justified by `QuickSummaryReport` genuinely lacking two of the three capabilities. Splitting further — an interface per method on `ICsvExportable` down to one `IHasExportPath` and one `IWritesCsvBody` — adds ceremony with no class that needs the extra seam; the Interface Segregation Principle asks for interfaces to match the capabilities that actually vary between implementers, not for interfaces to be as small as the language allows.

**Martin Fowler's argument against speculative generality applies directly to Open/Closed.** Building an extension point — a strategy interface, a plugin list, a rules engine — for a second case that has not arrived yet is a bet, and Fowler's point is that the bet usually loses: "you may not need the other... functions, or if you do your current ideas of what abstractions you'll need will not match what you learn when you do actually need them" [[8]](https://martinfowler.com/bliki/Yagni.html). The `IShippingRate` fix in this article was justified retroactively, by a real collision bug; written pre-emptively, before any second tier existed, it would have been exactly this bet, made with no evidence yet that the `if` chain would ever cause a problem. Fowler is explicit that this isn't an argument against abstraction in general, only against the kind that "makes it harder to understand the code for current requirements," which he treats as "presumed guilty" until a real second case shows up to justify it [[8]](https://martinfowler.com/bliki/Yagni.html).

The pattern across all three: every fix on this page was justified by pointing at a concrete failure the violation produced — a broken test, a wrong price, a crashed batch, a silenced receipt. That is also the bar for applying the principle again next time. "This interface might need a second implementation someday" is a guess; "this interface has a second implementation, here, in this file" is a reason.

::::exercise[Decide, don't guess]
A `TaxCalculator` class computes sales tax for one country and has done so for three years, with no plan to expand internationally. A teammate proposes extracting `ITaxCalculator` "for SOLID." What single question would tell you whether that extraction is justified?

:::solution
Whether a second implementation (a real one, or a test double standing in for one) exists or is concretely planned — not "might a second country ever be supported," which is true of almost any class, but "is something today prevented from working because `TaxCalculator` is a concrete class." If the only thing the interface would enable is a hand-written stub for unit tests, that is a real reason (it removes a dependency on real tax rules from a test), and the extraction is justified on exactly that ground; if nothing today needs the seam, the interface is a Header Interface with a SOLID-shaped justification attached after the fact.
:::
::::
