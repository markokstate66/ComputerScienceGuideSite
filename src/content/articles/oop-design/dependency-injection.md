---
title: "Dependency Injection from First Principles"
description: "Fix a hard-coded dependency by hand, build a real ~60-line DI container, then reproduce a captive-dependency bug in Microsoft.Extensions.DependencyInjection."
pillar: oop-design
order: 7
author: markus
published: 2026-09-22
updated: 2026-09-22
level: intermediate
tags: [dependency-injection, oop, design-patterns, service-lifetimes]
prerequisites: ["oop-design/solid-principles"]
sources:
  - title: "Dependency injection - .NET"
    url: "https://learn.microsoft.com/en-us/dotnet/core/extensions/dependency-injection/overview"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Service lifetimes (dependency injection) - .NET"
    url: "https://learn.microsoft.com/en-us/dotnet/core/extensions/dependency-injection/service-lifetimes"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "ServiceLifetime Enum"
    url: "https://learn.microsoft.com/en-us/dotnet/api/microsoft.extensions.dependencyinjection.servicelifetime"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Dependency injection guidelines - .NET"
    url: "https://learn.microsoft.com/en-us/dotnet/core/extensions/dependency-injection/guidelines"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "ServiceCollectionContainerBuilderExtensions.BuildServiceProvider Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/microsoft.extensions.dependencyinjection.servicecollectioncontainerbuilderextensions.buildserviceprovider"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "ServiceProviderOptions Class"
    url: "https://learn.microsoft.com/en-us/dotnet/api/microsoft.extensions.dependencyinjection.serviceprovideroptions"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
draft: false
---

`InvoiceService` below processes an invoice and sends a receipt for it. Its constructor takes nothing, because the object that actually sends the receipt is built right there, inside the class:

Every program below is a complete, file-based C# app, compiled and run with `dotnet run` — on .NET 10.0.401, Windows 11, x64, here.

```csharp run id=hard-coded-dependency
var invoiceIds = new[] { "INV-1001", "INV-1002" };

var service = new InvoiceService();
foreach (var id in invoiceIds)
    service.Process(id);

sealed class InvoiceService
{
    private readonly SmtpReceiptSender _sender = new();

    public void Process(string invoiceId)
        => _sender.Send(invoiceId);
}

sealed class SmtpReceiptSender
{
    public void Send(string invoiceId)
    {
        Console.WriteLine("Connecting to smtp.contoso.example:587");
        Console.WriteLine($"Sent receipt for {invoiceId}");
    }
}
```

```text output
Connecting to smtp.contoso.example:587
Sent receipt for INV-1001
Connecting to smtp.contoso.example:587
Sent receipt for INV-1002
```

`InvoiceService` never asks for a sender — it makes one, in a field initializer, before `Process` ever runs. Microsoft's own dependency-injection documentation names the same three costs for a class built this way: every caller that wants different behavior has to edit `InvoiceService` itself and every class like it that also hard-codes `SmtpReceiptSender`; if `SmtpReceiptSender` ever grows its own dependencies (a host name, credentials), that configuration has to be threaded through wherever `InvoiceService` gets constructed; and there is no seam left for a test to substitute anything else, so verifying `Process` without opening a real connection is not possible without editing this file[[1]](https://learn.microsoft.com/en-us/dotnet/core/extensions/dependency-injection/overview).

## Passing the dependency in by hand

Fix it by introducing an interface for the one thing `InvoiceService` needs, and taking that interface as a constructor parameter instead of constructing an implementation internally:

```csharp run id=constructor-injection-by-hand
var production = new InvoiceService(new SmtpReceiptSender());
production.Process("INV-2001");

var recorder = new RecordingReceiptSender();
var underTest = new InvoiceService(recorder);
underTest.Process("INV-2002");
Console.WriteLine($"Test recorded: {string.Join(", ", recorder.Sent)}");

interface IReceiptSender
{
    void Send(string invoiceId);
}

sealed class SmtpReceiptSender : IReceiptSender
{
    public void Send(string invoiceId)
    {
        Console.WriteLine("Connecting to smtp.contoso.example:587");
        Console.WriteLine($"Sent receipt for {invoiceId}");
    }
}

sealed class RecordingReceiptSender : IReceiptSender
{
    public List<string> Sent { get; } = [];

    public void Send(string invoiceId) => Sent.Add(invoiceId);
}

sealed class InvoiceService(IReceiptSender sender)
{
    public void Process(string invoiceId) => sender.Send(invoiceId);
}
```

```text output
Connecting to smtp.contoso.example:587
Sent receipt for INV-2001
Test recorded: INV-2002
```

`InvoiceService` still does exactly one thing — call `Send` on whatever it was given — but it no longer decides what that thing is. Production code passes a real `SmtpReceiptSender`; the test above passes a `RecordingReceiptSender` that keeps invoice ids in a list instead of touching a socket, and the assertion at the bottom reads that list directly. The technique has a name because it is specific: passing an object's dependencies into its constructor, rather than letting it build them, is *constructor injection* — the built-in .NET container's own documentation uses that exact term for the mechanism it automates later in this article[[1]](https://learn.microsoft.com/en-us/dotnet/core/extensions/dependency-injection/overview). It is also, on its own, the whole of what [dependency inversion requires](/oop-design/solid-principles/#dependency-inversion-is-not-a-di-container): nothing here used a container, a registration, or a framework attribute.

::::exercise[Find the missed injection]
A colleague "fixes" `ReportExporter` the same way this section just fixed `InvoiceService`: add a constructor parameter, `ReportExporter(IReportFormatter formatter)`, and store it in a field, `_formatter`. Months later, someone notices that swapping in a `JsonReportFormatter` for a test still produces CSV output — `Export` still builds `new CsvReportFormatter()` on its own first line and calls `Format` on that, never on `_formatter`. What did the constructor parameter actually fix?

:::solution
Nothing that matters yet. `ReportExporter` now accepts an `IReportFormatter` and keeps a reference to it, but `Export` never reads that reference — it hard-codes `CsvReportFormatter` exactly as before, just with an unused parameter sitting next to the hard-coding. Accepting a dependency through the constructor is not the same as using it: every code path that is supposed to honor a substitution has to actually call through the injected reference, not a locally constructed one.
:::
::::

## Wiring the whole graph: the composition root

A real class rarely needs just one dependency. Give `InvoiceService` an audit trail, and give the audit trail its own dependency on a clock, and the graph looks like this:

<figure class="diagram">
<svg viewBox="0 0 300 500" role="img" aria-labelledby="di-graph-title di-graph-desc">
<title id="di-graph-title">Object graph for InvoiceService</title>
<desc id="di-graph-desc">Four boxes stacked vertically: InvoiceService at top, then SmtpReceiptSender, ConsoleAuditLog, and SystemClock at the bottom, connected by solid arrows for each constructor parameter. A dashed arrow runs from InvoiceService directly down to SystemClock, skipping the two boxes in between.</desc>
<defs>
<marker id="di-graph-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-stroke"/></marker>
<marker id="di-graph-arrow-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-accent"/></marker>
</defs>
<rect x="30" y="10" width="240" height="56" rx="8" class="d-box-accent"/>
<text x="150" y="32" text-anchor="middle" class="d-mono d-bold">InvoiceService</text>
<text x="150" y="50" text-anchor="middle" class="d-small">composition root's entry point</text>
<path d="M150 66 V128" class="d-line" marker-end="url(#di-graph-arrow)"/>
<text x="160" y="100" class="d-small d-muted">constructor param</text>
<rect x="30" y="134" width="240" height="56" rx="8" class="d-box"/>
<text x="150" y="156" text-anchor="middle" class="d-mono d-bold">SmtpReceiptSender</text>
<text x="150" y="174" text-anchor="middle" class="d-small">implements IReceiptSender</text>
<path d="M150 190 V252" class="d-line" marker-end="url(#di-graph-arrow)"/>
<text x="160" y="224" class="d-small d-muted">constructor param</text>
<rect x="30" y="258" width="240" height="56" rx="8" class="d-box"/>
<text x="150" y="280" text-anchor="middle" class="d-mono d-bold">ConsoleAuditLog</text>
<text x="150" y="298" text-anchor="middle" class="d-small">implements IAuditLog</text>
<path d="M150 314 V376" class="d-line" marker-end="url(#di-graph-arrow)"/>
<text x="160" y="348" class="d-small d-muted">constructor param</text>
<rect x="30" y="382" width="240" height="56" rx="8" class="d-box"/>
<text x="150" y="404" text-anchor="middle" class="d-mono d-bold">SystemClock</text>
<text x="150" y="422" text-anchor="middle" class="d-small">implements IClock</text>
<path d="M30 38 H12 V410 H30" class="d-accent d-dashed" fill="none" marker-end="url(#di-graph-arrow-a)"/>
<text x="30" y="456" class="d-small d-muted">Dashed line: InvoiceService also</text>
<text x="30" y="470" class="d-small d-muted">depends on IClock directly (the</text>
<text x="30" y="484" class="d-small d-muted">diamond both paths share).</text>
</svg>
<figcaption>Figure 1. InvoiceService depends on IClock twice: once directly, and once indirectly through IReceiptSender and IAuditLog. Whether both paths reach the same SystemClock instance is a wiring decision, not something the graph's shape decides on its own.</figcaption>
</figure>

Nothing here needs a framework yet — it needs one place that knows about every concrete type and constructs them in the right order:

```csharp run id=composition-root
IClock clock = new SystemClock();
IAuditLog auditLog = new ConsoleAuditLog(clock);
IReceiptSender sender = new SmtpReceiptSender(auditLog);
var invoiceService = new InvoiceService(sender, clock);

invoiceService.Process("INV-3001");

Console.WriteLine(
    $"Same clock instance: {ReferenceEquals(invoiceService.Clock, auditLog.Clock)}");

interface IClock
{
    DateTimeOffset UtcNow { get; }
}

sealed class SystemClock : IClock
{
    public DateTimeOffset UtcNow => DateTimeOffset.UtcNow;
}

interface IAuditLog
{
    IClock Clock { get; }
    void Record(string message);
}

sealed class ConsoleAuditLog(IClock clock) : IAuditLog
{
    public IClock Clock { get; } = clock;

    public void Record(string message) => Console.WriteLine($"[audit] {message}");
}

interface IReceiptSender
{
    void Send(string invoiceId);
}

sealed class SmtpReceiptSender(IAuditLog auditLog) : IReceiptSender
{
    public void Send(string invoiceId)
    {
        auditLog.Record($"sent receipt for {invoiceId}");
        Console.WriteLine("Connecting to smtp.contoso.example:587");
        Console.WriteLine($"Sent receipt for {invoiceId}");
    }
}

sealed class InvoiceService(IReceiptSender sender, IClock clock)
{
    public IReceiptSender Sender { get; } = sender;
    public IClock Clock { get; } = clock;

    public void Process(string invoiceId) => Sender.Send(invoiceId);
}
```

```text output
[audit] sent receipt for INV-3001
Connecting to smtp.contoso.example:587
Sent receipt for INV-3001
Same clock instance: True
```

Code that wires concrete types together like this, all in one place, is commonly called a *composition root*: the one part of the program allowed to write `new SmtpReceiptSender(...)` and `new ConsoleAuditLog(...)`, so that `InvoiceService` itself never has to. Everything below the composition root — `InvoiceService`, `SmtpReceiptSender`, `ConsoleAuditLog` — only ever sees interfaces.

Notice the last line printed `True`: `invoiceService.Clock` and `auditLog.Clock` are the same object, because the composition root passed the same `clock` variable to both constructors. That was a decision a human had to remember to make correctly. Nothing about the graph's shape forces it — the exercise below shows what happens when a human forgets.

::::exercise[Predict a forgotten reuse]
The composition root above deliberately reuses one `SystemClock` instance for both `auditLog` and `invoiceService`. Suppose the last line had been written the "obvious" way instead — `new InvoiceService(sender, new SystemClock())`, building a fresh clock right there instead of passing the existing `clock` variable — with everything else unchanged. Predict what `Same clock instance` prints, and say whether you would call this a dependency-injection bug or something else.

:::solution
It prints `False`. Two separate `SystemClock` objects now exist — one built for `ConsoleAuditLog`, one built directly for `InvoiceService` — and nothing catches the mismatch, because `SystemClock` carries no state that would make two instances visibly disagree; a bug like this only shows up later, at whatever point the two paths needed to observe the same instant and silently didn't.

```csharp run id=composition-root-forgot
IClock clock = new SystemClock();
IAuditLog auditLog = new ConsoleAuditLog(clock);
IReceiptSender sender = new SmtpReceiptSender(auditLog);
var invoiceService = new InvoiceService(sender, new SystemClock());

invoiceService.Process("INV-3001");

Console.WriteLine(
    $"Same clock instance: {ReferenceEquals(invoiceService.Clock, auditLog.Clock)}");

interface IClock
{
    DateTimeOffset UtcNow { get; }
}

sealed class SystemClock : IClock
{
    public DateTimeOffset UtcNow => DateTimeOffset.UtcNow;
}

interface IAuditLog
{
    IClock Clock { get; }
    void Record(string message);
}

sealed class ConsoleAuditLog(IClock clock) : IAuditLog
{
    public IClock Clock { get; } = clock;

    public void Record(string message) => Console.WriteLine($"[audit] {message}");
}

interface IReceiptSender
{
    void Send(string invoiceId);
}

sealed class SmtpReceiptSender(IAuditLog auditLog) : IReceiptSender
{
    public void Send(string invoiceId)
    {
        auditLog.Record($"sent receipt for {invoiceId}");
        Console.WriteLine("Connecting to smtp.contoso.example:587");
        Console.WriteLine($"Sent receipt for {invoiceId}");
    }
}

sealed class InvoiceService(IReceiptSender sender, IClock clock)
{
    public IReceiptSender Sender { get; } = sender;
    public IClock Clock { get; } = clock;

    public void Process(string invoiceId) => Sender.Send(invoiceId);
}
```

```text output
[audit] sent receipt for INV-3001
Connecting to smtp.contoso.example:587
Sent receipt for INV-3001
Same clock instance: False
```

This is not a dependency-injection bug in the sense the rest of this article is about — there is no container yet to misconfigure. It is the ordinary risk hand-wiring carries: the correctness of the whole graph depends on a human remembering, every single time, which references to reuse and which to construct fresh. The rest of this article replaces "remember to reuse `clock`" with a declaration the container enforces automatically, for every consumer, however deep in the graph it sits.
:::
::::

## Lifetimes: transient, scoped, and singleton, precisely

A *lifetime* is the sharing policy a container applies to a registration, so that "reuse this instance" or "always build a new one" is declared once instead of remembered at every call site. .NET's built-in container recognizes exactly three, and defines each one precisely[[2]](https://learn.microsoft.com/en-us/dotnet/core/extensions/dependency-injection/service-lifetimes):

- **Transient** — "a new instance of the service will be created every time it is requested"[[3]](https://learn.microsoft.com/en-us/dotnet/api/microsoft.extensions.dependencyinjection.servicelifetime). Two constructor parameters that both ask for the same transient service get two different objects, even within a single resolution.
- **Scoped** — "a new instance of the service will be created for each scope"[[3]](https://learn.microsoft.com/en-us/dotnet/api/microsoft.extensions.dependencyinjection.servicelifetime). A *scope* is an explicit unit you open and close — one HTTP request in a web app, or one block wrapped in a manually created scope in a console app — and every resolution inside that scope for the same service returns the same instance.
- **Singleton** — "a single instance of the service will be created"[[3]](https://learn.microsoft.com/en-us/dotnet/api/microsoft.extensions.dependencyinjection.servicelifetime), the first time anything asks for it, and every later resolution from any scope returns that same instance for the rest of the app's life.

This is a different idea from the classic Singleton design pattern, where a class enforces its own single-instance-ness through a private constructor and a static accessor. A companion article on creational patterns covers that version and why DI lifetimes have mostly replaced it; the container's singleton lifetime, covered here, is a *registration policy* applied to an ordinary class that has no idea it is being shared.

<figure class="diagram">
<svg viewBox="0 0 320 520" role="img" aria-labelledby="di-lifetime-title di-lifetime-desc">
<title id="di-lifetime-title">Singleton, scoped, and transient lifetimes</title>
<desc id="di-lifetime-desc">A container box holds one Singleton band at the top, shared by two Scope boxes below it. Each scope box holds one scoped instance, labeled A in scope 1 and B in scope 2, plus two transient instances that are freshly created on every resolve. A dashed line connects the singleton band to the second scope, showing it reaches every scope without being recreated.</desc>
<defs>
<marker id="di-lifetime-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-accent"/></marker>
</defs>
<rect x="10" y="8" width="300" height="504" rx="8" class="d-line" fill="none"/>
<text x="22" y="26" class="d-small d-muted">Container (app lifetime)</text>
<rect x="25" y="36" width="270" height="78" rx="6" class="d-box-accent"/>
<text x="160" y="58" text-anchor="middle" class="d-mono d-bold">Singleton</text>
<text x="160" y="76" text-anchor="middle" class="d-small">one SystemClock instance</text>
<text x="160" y="92" text-anchor="middle" class="d-small d-muted">shared everywhere below</text>
<rect x="25" y="132" width="270" height="150" rx="6" class="d-box"/>
<text x="40" y="152" class="d-bold">Scope 1</text>
<rect x="40" y="162" width="240" height="38" rx="4" class="d-box-2"/>
<text x="160" y="186" text-anchor="middle" class="d-mono d-small">Scoped instance A</text>
<rect x="40" y="212" width="115" height="34" rx="4" class="d-box-2"/>
<text x="97" y="234" text-anchor="middle" class="d-small">Transient #1</text>
<rect x="165" y="212" width="115" height="34" rx="4" class="d-box-2"/>
<text x="222" y="234" text-anchor="middle" class="d-small">Transient #2</text>
<text x="40" y="264" class="d-small d-muted">new instance every resolve</text>
<rect x="25" y="296" width="270" height="150" rx="6" class="d-box"/>
<text x="40" y="316" class="d-bold">Scope 2</text>
<rect x="40" y="326" width="240" height="38" rx="4" class="d-box-2"/>
<text x="160" y="350" text-anchor="middle" class="d-mono d-small">Scoped instance B</text>
<rect x="40" y="376" width="115" height="34" rx="4" class="d-box-2"/>
<text x="97" y="398" text-anchor="middle" class="d-small">Transient #3</text>
<rect x="165" y="376" width="115" height="34" rx="4" class="d-box-2"/>
<text x="222" y="398" text-anchor="middle" class="d-small">Transient #4</text>
<text x="40" y="428" class="d-small d-muted">new instance every resolve</text>
<path d="M295 75 H308 V371 H295" class="d-accent d-dashed" fill="none" marker-end="url(#di-lifetime-arrow)"/>
<text x="22" y="462" class="d-small d-muted">Scoped instances differ between</text>
<text x="22" y="476" class="d-small d-muted">scopes; the singleton above is</text>
<text x="22" y="490" class="d-small d-muted">the same object in both.</text>
</svg>
<figcaption>Figure 2. A singleton is built once for the whole container; a scoped service is built once per scope; a transient service is built on every resolve, even twice inside the same scope.</figcaption>
</figure>

## A container that resolves the graph, in about sixty lines

A DI container is not a mysterious piece of infrastructure — it is a dictionary of registrations plus a resolver that walks constructors with reflection. `MiniContainer` below implements all three lifetimes and genuinely resolves the four-type graph from the diagrams above, diamond included:

```csharp run id=mini-container-demo
using System.Diagnostics.CodeAnalysis;
using System.Reflection;

var container = new MiniContainer();
container.Register<IClock, SystemClock>(
    Lifetime.Singleton);
container.Register<IAuditLog, ConsoleAuditLog>(
    Lifetime.Scoped);
container.Register<IReceiptSender, SmtpReceiptSender>(
    Lifetime.Transient);
container.Register<InvoiceService, InvoiceService>(
    Lifetime.Transient);

using var scope1 = container.CreateScope();
var inv1A = scope1.Resolve<InvoiceService>();
var inv1B = scope1.Resolve<InvoiceService>();

using var scope2 = container.CreateScope();
var inv2 = scope2.Resolve<InvoiceService>();

Console.WriteLine(
    $"Same audit log, same scope:  {ReferenceEquals(inv1A.Sender.AuditLog, inv1B.Sender.AuditLog)}");
Console.WriteLine(
    $"Same audit log, other scope: {ReferenceEquals(inv1A.Sender.AuditLog, inv2.Sender.AuditLog)}");
Console.WriteLine(
    $"Same sender, same scope:     {ReferenceEquals(inv1A.Sender, inv1B.Sender)}");
Console.WriteLine(
    $"Same clock everywhere:       {ReferenceEquals(inv1A.Clock, inv2.Clock) && ReferenceEquals(inv1A.Clock, inv1A.Sender.AuditLog.Clock)}");

enum Lifetime { Transient, Scoped, Singleton }

sealed class Registration
{
    public required Type ImplementationType { get; init; }
    public required Lifetime Lifetime { get; init; }
    public object? SingletonInstance;
}

sealed class MiniContainer : IDisposable
{
    private readonly Dictionary<Type, Registration> _registrations;
    private readonly MiniContainer? _root;
    private readonly Dictionary<Type, object> _scoped = new();

    public MiniContainer() : this(new Dictionary<Type, Registration>(), null) { }

    private MiniContainer(Dictionary<Type, Registration> registrations, MiniContainer? root)
    {
        _registrations = registrations;
        _root = root;
    }

    public void Register<TService, TImplementation>(Lifetime lifetime)
        where TImplementation : TService
        => _registrations[typeof(TService)] =
            new Registration { ImplementationType = typeof(TImplementation), Lifetime = lifetime };

    public MiniContainer CreateScope() => new(_registrations, _root ?? this);

    public T Resolve<T>() => (T)Resolve(typeof(T));

    private object Resolve(Type serviceType)
    {
        if (!_registrations.TryGetValue(serviceType, out var reg))
            throw new InvalidOperationException($"No registration for {serviceType.Name}.");

        return reg.Lifetime switch
        {
            Lifetime.Singleton => ResolveSingleton(reg),
            Lifetime.Scoped => ResolveScoped(this, reg),
            _ => Create(this, reg),
        };
    }

    private object ResolveSingleton(Registration reg)
    {
        var root = _root ?? this;
        return reg.SingletonInstance ??= Create(root, reg);
    }

    private static object ResolveScoped(MiniContainer scope, Registration reg)
    {
        if (!scope._scoped.TryGetValue(reg.ImplementationType, out var instance))
            scope._scoped[reg.ImplementationType] = instance = Create(scope, reg);
        return instance;
    }

    [UnconditionalSuppressMessage("Trimming", "IL2075", Justification = "Teaching container; not meant to be trim- or AOT-safe.")]
    private static object Create(MiniContainer scope, Registration reg)
    {
        var ctor = reg.ImplementationType.GetConstructors().Single();
        var args = ctor.GetParameters().Select(p => scope.Resolve(p.ParameterType)).ToArray();
        return ctor.Invoke(args);
    }

    public void Dispose() => _scoped.Clear();
}

interface IClock
{
    DateTimeOffset UtcNow { get; }
}

sealed class SystemClock : IClock
{
    public DateTimeOffset UtcNow => DateTimeOffset.UtcNow;
}

interface IAuditLog
{
    IClock Clock { get; }
    void Record(string message);
}

sealed class ConsoleAuditLog(IClock clock) : IAuditLog
{
    public IClock Clock { get; } = clock;

    public void Record(string message) => Console.WriteLine($"[audit] {message}");
}

interface IReceiptSender
{
    IAuditLog AuditLog { get; }
    void Send(string invoiceId);
}

sealed class SmtpReceiptSender(IAuditLog auditLog) : IReceiptSender
{
    public IAuditLog AuditLog { get; } = auditLog;

    public void Send(string invoiceId) => AuditLog.Record($"sent receipt for {invoiceId}");
}

sealed class InvoiceService(IReceiptSender sender, IClock clock)
{
    public IReceiptSender Sender { get; } = sender;
    public IClock Clock { get; } = clock;

    public void Process(string invoiceId) => Sender.Send(invoiceId);
}
```

```text output
Same audit log, same scope:  True
Same audit log, other scope: False
Same sender, same scope:     False
Same clock everywhere:       True
```

Read `Resolve` from the bottom up. `Create` uses reflection to find the implementation's one public constructor, resolves every parameter type recursively, and invokes it — that recursion is the entire "wiring" step; nothing hand-writes `new SmtpReceiptSender(new ConsoleAuditLog(...))` anywhere. `ResolveScoped` caches an instance in the *calling* `MiniContainer`'s own dictionary, which is exactly why two resolutions inside `scope1` share one `ConsoleAuditLog` while `scope2` gets a different one — each `CreateScope()` call hands back a `MiniContainer` with a fresh, empty `_scoped` dictionary. `ResolveSingleton` is the interesting one: it always builds through `_root`, never through whatever scope asked for it. That single line is both why `SystemClock` is the same object down every path in the four-type graph, and — a few sections from now — exactly the line responsible for a real bug.

The output confirms all four registered lifetimes at once, from one resolution of a real, four-type dependency graph: `SmtpReceiptSender` differs on every request (transient), `ConsoleAuditLog` differs across scopes but not within one (scoped), and `SystemClock` is identical no matter which of the two paths in the diamond reaches it (singleton).

## The same graph, `Microsoft.Extensions.DependencyInjection`

Swap `MiniContainer` for the real package, keep the same four registrations and the same checks, and the output does not change:

```csharp run id=msdi-demo
#:package Microsoft.Extensions.DependencyInjection@9.*
using Microsoft.Extensions.DependencyInjection;

var services = new ServiceCollection();
services.AddSingleton<IClock, SystemClock>();
services.AddScoped<IAuditLog, ConsoleAuditLog>();
services.AddTransient<IReceiptSender, SmtpReceiptSender>();
services.AddTransient<InvoiceService>();
using var provider = services.BuildServiceProvider();

using var scope1 = provider.CreateScope();
var inv1A = scope1.ServiceProvider.GetRequiredService<InvoiceService>();
var inv1B = scope1.ServiceProvider.GetRequiredService<InvoiceService>();

using var scope2 = provider.CreateScope();
var inv2 = scope2.ServiceProvider.GetRequiredService<InvoiceService>();

Console.WriteLine(
    $"Same audit log, same scope:  {ReferenceEquals(inv1A.Sender.AuditLog, inv1B.Sender.AuditLog)}");
Console.WriteLine(
    $"Same audit log, other scope: {ReferenceEquals(inv1A.Sender.AuditLog, inv2.Sender.AuditLog)}");
Console.WriteLine(
    $"Same sender, same scope:     {ReferenceEquals(inv1A.Sender, inv1B.Sender)}");
Console.WriteLine(
    $"Same clock everywhere:       {ReferenceEquals(inv1A.Clock, inv2.Clock) && ReferenceEquals(inv1A.Clock, inv1A.Sender.AuditLog.Clock)}");

interface IClock
{
    DateTimeOffset UtcNow { get; }
}

sealed class SystemClock : IClock
{
    public DateTimeOffset UtcNow => DateTimeOffset.UtcNow;
}

interface IAuditLog
{
    IClock Clock { get; }
    void Record(string message);
}

sealed class ConsoleAuditLog(IClock clock) : IAuditLog
{
    public IClock Clock { get; } = clock;

    public void Record(string message) => Console.WriteLine($"[audit] {message}");
}

interface IReceiptSender
{
    IAuditLog AuditLog { get; }
    void Send(string invoiceId);
}

sealed class SmtpReceiptSender(IAuditLog auditLog) : IReceiptSender
{
    public IAuditLog AuditLog { get; } = auditLog;

    public void Send(string invoiceId) => AuditLog.Record($"sent receipt for {invoiceId}");
}

sealed class InvoiceService(IReceiptSender sender, IClock clock)
{
    public IReceiptSender Sender { get; } = sender;
    public IClock Clock { get; } = clock;

    public void Process(string invoiceId) => Sender.Send(invoiceId);
}
```

```text output
Same audit log, same scope:  True
Same audit log, other scope: False
Same sender, same scope:     False
Same clock everywhere:       True
```

`AddSingleton`, `AddScoped`, and `AddTransient` are the registration methods; `BuildServiceProvider` and `CreateScope` do what `MiniContainer`'s constructor and `CreateScope` did. `GetRequiredService<InvoiceService>()` finds `InvoiceService`'s one constructor and resolves its parameters recursively, the same way `Create` did above — a primary constructor like `InvoiceService(IReceiptSender sender, IClock clock)` compiles to a public constructor, which is exactly what the container's own constructor-injection rules require[[1]](https://learn.microsoft.com/en-us/dotnet/core/extensions/dependency-injection/overview). Four identical booleans is the whole point: the framework's container is not doing anything the sixty-line one above does not also do. It is a faster, more careful, more thoroughly-tested implementation of the same idea — with one more feature `MiniContainer` does not have, which turns out to matter.

## The captive dependency: a singleton that outlives its scope

Register `IReceiptSender` as a singleton instead of transient, and leave `IAuditLog` scoped, and the container will build it without complaint — but every scope after the first gets the wrong audit trail:

```csharp run id=captive-bug-demo
#:package Microsoft.Extensions.DependencyInjection@9.*
using Microsoft.Extensions.DependencyInjection;

var services = new ServiceCollection();
services.AddScoped<IAuditLog, ConsoleAuditLog>();
services.AddSingleton<IReceiptSender, SmtpReceiptSender>();
services.AddTransient<InvoiceService>();
using var provider = services.BuildServiceProvider();

using (var scope1 = provider.CreateScope())
{
    var invoiceService = scope1.ServiceProvider.GetRequiredService<InvoiceService>();
    invoiceService.Process("INV-4001");
}

using (var scope2 = provider.CreateScope())
{
    var invoiceService = scope2.ServiceProvider.GetRequiredService<InvoiceService>();
    invoiceService.Process("INV-4002");
}

interface IAuditLog
{
    void Record(string message);
}

sealed class ConsoleAuditLog : IAuditLog
{
    private static int _count;
    private readonly int _id = ++_count;

    public void Record(string message) => Console.WriteLine($"[audit #{_id}] {message}");
}

interface IReceiptSender
{
    void Send(string invoiceId);
}

sealed class SmtpReceiptSender(IAuditLog auditLog) : IReceiptSender
{
    public void Send(string invoiceId) => auditLog.Record($"sent receipt for {invoiceId}");
}

sealed class InvoiceService(IReceiptSender sender)
{
    public void Process(string invoiceId) => sender.Send(invoiceId);
}
```

```text output
[audit #1] sent receipt for INV-4001
[audit #1] sent receipt for INV-4002
```

`ConsoleAuditLog` now numbers itself when constructed, so the bug is visible in the audit trail itself, not just in a boolean: invoice `INV-4002`, processed in `scope2`, was recorded by audit log `#1` — the one built for `scope1`. `SmtpReceiptSender` is a singleton, so the container builds it exactly once, the first time anything asks for it, and that one build resolved `IAuditLog` from the container's own internal root context rather than from either caller's scope — precisely the behavior `MiniContainer`'s `ResolveSingleton` reproduced above by always calling `Create(root, reg)`. Every later resolution of `IReceiptSender`, from any scope, gets that same frozen `SmtpReceiptSender` back, still holding the first audit log it was ever given. This misconfiguration — a longer-lived service holding a shorter-lived one past the point where it should have been replaced — is called a *captive dependency*, a term Microsoft's own guidelines credit to Mark Seemann[[4]](https://learn.microsoft.com/en-us/dotnet/core/extensions/dependency-injection/guidelines).

:::warning[This ran without any error]
The program above built and ran to completion; nothing about the mismatched lifetimes stopped it. .NET's container validates that a scoped service is never consumed by a singleton only when it is told to — by default, that check runs automatically in the Development environment when a host is built through `Host.CreateApplicationBuilder`[[1]](https://learn.microsoft.com/en-us/dotnet/core/extensions/dependency-injection/overview). A bare `new ServiceCollection().BuildServiceProvider()`, as used throughout this article, has no such default and needs the check turned on explicitly, shown next.
:::

`BuildServiceProvider` has an overload that takes a `ServiceProviderOptions`, whose `ValidateScopes` property checks "that scoped services never gets resolved from root provider"[[5]](https://learn.microsoft.com/en-us/dotnet/api/microsoft.extensions.dependencyinjection.servicecollectioncontainerbuilderextensions.buildserviceprovider) and whose `ValidateOnBuild` property "indicates whether validation is performed to ensure all services can be created when `BuildServiceProvider` ... is called"[[6]](https://learn.microsoft.com/en-us/dotnet/api/microsoft.extensions.dependencyinjection.serviceprovideroptions) — turning both on moves the failure from a silent wrong answer in production to an exception at startup:

```csharp run id=captive-bug-validate
#:package Microsoft.Extensions.DependencyInjection@9.*
using Microsoft.Extensions.DependencyInjection;

var services = new ServiceCollection();
services.AddScoped<IAuditLog, ConsoleAuditLog>();
services.AddSingleton<IReceiptSender, SmtpReceiptSender>();
services.AddTransient<InvoiceService>();

try
{
    using var strict = services.BuildServiceProvider(
        new ServiceProviderOptions { ValidateScopes = true, ValidateOnBuild = true });
    Console.WriteLine("Built without error (unexpected).");
}
catch (AggregateException ex)
{
    Exception innermost = ex;
    while (innermost.InnerException is not null)
        innermost = innermost.InnerException;
    Console.WriteLine(innermost.Message);
}

interface IAuditLog
{
    void Record(string message);
}

sealed class ConsoleAuditLog : IAuditLog
{
    private static int _count;
    private readonly int _id = ++_count;

    public void Record(string message) => Console.WriteLine($"[audit #{_id}] {message}");
}

interface IReceiptSender
{
    void Send(string invoiceId);
}

sealed class SmtpReceiptSender(IAuditLog auditLog) : IReceiptSender
{
    public void Send(string invoiceId) => auditLog.Record($"sent receipt for {invoiceId}");
}

sealed class InvoiceService(IReceiptSender sender)
{
    public void Process(string invoiceId) => sender.Send(invoiceId);
}
```

```text output
Cannot consume scoped service 'IAuditLog' from singleton 'IReceiptSender'.
```

`BuildServiceProvider` throws an `AggregateException` wrapping the validation failure; unwrapping it down to the innermost exception gives the sentence above, naming the exact two services at fault. That is the same message shape Microsoft's guidelines document for this anti-pattern[[4]](https://learn.microsoft.com/en-us/dotnet/core/extensions/dependency-injection/guidelines), reproduced here from a real run rather than copied from the page.

The registration itself was still wrong, though — `IReceiptSender` should not have been a singleton in the first place if it needs a fresh audit log per scope. When a singleton genuinely needs to reach a scoped service on every call, the documented fix is to inject `IServiceScopeFactory` and open an explicit scope each time, rather than injecting the scoped service directly[[1]](https://learn.microsoft.com/en-us/dotnet/core/extensions/dependency-injection/overview):

:::dotnet
.NET's documentation notes that "the `IServiceScopeFactory` is always registered as a singleton"[[1]](https://learn.microsoft.com/en-us/dotnet/core/extensions/dependency-injection/overview), so a singleton depending on it is never a captive dependency — a singleton holding a reference to another singleton is exactly what the lifetime is for.
:::

```csharp run id=captive-bug-fix
#:package Microsoft.Extensions.DependencyInjection@9.*
using Microsoft.Extensions.DependencyInjection;

var services = new ServiceCollection();
services.AddScoped<IAuditLog, ConsoleAuditLog>();
services.AddSingleton<IReceiptSender, ScopedReceiptSender>();
services.AddTransient<InvoiceService>();
using var provider = services.BuildServiceProvider();

var invoiceService = provider.GetRequiredService<InvoiceService>();
invoiceService.Process("INV-5001");
invoiceService.Process("INV-5002");

interface IAuditLog
{
    void Record(string message);
}

sealed class ConsoleAuditLog : IAuditLog
{
    private static int _count;
    private readonly int _id = ++_count;

    public void Record(string message) => Console.WriteLine($"[audit #{_id}] {message}");
}

interface IReceiptSender
{
    void Send(string invoiceId);
}

sealed class ScopedReceiptSender(IServiceScopeFactory scopeFactory) : IReceiptSender
{
    public void Send(string invoiceId)
    {
        using var scope = scopeFactory.CreateScope();
        var auditLog = scope.ServiceProvider.GetRequiredService<IAuditLog>();
        auditLog.Record($"sent receipt for {invoiceId}");
    }
}

sealed class InvoiceService(IReceiptSender sender)
{
    public void Process(string invoiceId) => sender.Send(invoiceId);
}
```

```text output
[audit #1] sent receipt for INV-5001
[audit #2] sent receipt for INV-5002
```

`ScopedReceiptSender` is still a singleton — built once, reused for the rest of the app — but it no longer holds a scoped dependency captive, because it never keeps one past the method call that needed it. Each `Send` opens its own scope, resolves a fresh `IAuditLog` from it, and disposes the scope when it is done, so audit log `#1` and `#2` are each exactly as current as the call that used them. Singletons are not the problem; a singleton *holding onto* a scoped or transient object past the call that resolved it is. Microsoft's guidelines list the general shape of that risk under thread safety, too: a singleton that holds shared mutable state has to synchronize access to it itself, because the container only guarantees that resolving services is thread-safe, not that the objects it hands back are[[4]](https://learn.microsoft.com/en-us/dotnet/core/extensions/dependency-injection/guidelines).
