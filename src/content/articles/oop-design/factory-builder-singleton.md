---
title: "Creational Patterns: Factory, Builder, and the Trouble with Singleton"
description: "Factory Method, Abstract Factory and Builder compared with runnable C# examples, then a thread-safe Lazy<T> Singleton and why DI lifetimes replaced it."
pillar: oop-design
order: 6
author: markus
published: 2026-09-22
updated: 2026-09-22
level: intermediate
tags: [design-patterns, oop, dependency-injection, unit-testing, thread-safety, fluent-api]
prerequisites: ["oop-design/interfaces-vs-abstract-classes"]
sources:
  - title: "Lazy<T> Class"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.lazy-1"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Dependency injection - .NET"
    url: "https://learn.microsoft.com/en-us/dotnet/core/extensions/dependency-injection/overview"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Service lifetimes (dependency injection) - .NET"
    url: "https://learn.microsoft.com/en-us/dotnet/core/extensions/dependency-injection/service-lifetimes"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "StringBuilder Class"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.text.stringbuilder"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "WebApplication.CreateBuilder Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/microsoft.aspnetcore.builder.webapplication.createbuilder"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "WebApplication and WebApplicationBuilder in ASP.NET Core apps"
    url: "https://learn.microsoft.com/en-us/aspnet/core/fundamentals/minimal-apis/webapplication"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "File-based apps - .NET"
    url: "https://learn.microsoft.com/en-us/dotnet/core/sdk/file-based-apps"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Design Patterns: Elements of Reusable Object-Oriented Software, chapter 3 (Creational Patterns)"
    url: "https://www.pearson.com/en-us/subject-catalog/p/design-patterns-elements-of-reusable-object-oriented-software/P200000009480"
    publisher: "Addison-Wesley, 1994; publisher record, cited by chapter"
    accessed: 2026-09-22
draft: false
---

Gamma, Helm, Johnson and Vlissides group Factory Method, Abstract Factory, Builder and Singleton among the creational patterns in chapter 3 of *Design Patterns*[[8]](https://www.pearson.com/en-us/subject-catalog/p/design-patterns-elements-of-reusable-object-oriented-software/P200000009480). All four answer the same question — how does an object get constructed? — but they answer it so differently that lumping them together as "creational patterns" hides more than it reveals. This article builds a real example of each, then asks a question the catalogue does not: which of these four still earns its place in a modern C# codebase, and which one usually shouldn't. The programs on this page are complete file-based C# apps, compiled and run with `dotnet run` on .NET 10.0.401, Windows 11, x64.

## Simple factory: one method, a switch, no pattern name

The most common "factory" in everyday code is not in the GoF catalogue at all: a single static method that switches on a parameter and returns one of several implementations behind a shared interface.

```csharp run id=notification-simple-factory
INotification order = NotificationFactory.Create("email");
INotification alert = NotificationFactory.Create("sms");

Console.WriteLine(order.Describe());
Console.WriteLine(alert.Describe());

interface INotification
{
    string Describe();
}

sealed class EmailNotification : INotification
{
    public string Describe() => "email: formatted as HTML, sent via SMTP";
}

sealed class SmsNotification : INotification
{
    public string Describe() => "sms: plain text, sent via a carrier gateway";
}

static class NotificationFactory
{
    public static INotification Create(string channel) => channel switch
    {
        "email" => new EmailNotification(),
        "sms" => new SmsNotification(),
        _ => throw new ArgumentException($"Unknown channel: {channel}", nameof(channel)),
    };
}
```

```text output
email: formatted as HTML, sent via SMTP
sms: plain text, sent via a carrier gateway
```

`NotificationFactory.Create` centralizes the `switch`, so callers depend on `INotification` and never mention `EmailNotification` or `SmsNotification` directly. This shape is genuinely useful — it is the first thing worth reaching for when a handful of implementations need to be chosen by a string, an enum, or a config value — but *Design Patterns* catalogues five creational patterns (Abstract Factory, Builder, Factory Method, Prototype and Singleton), and a static switch is not one of them under its own name[[8]](https://www.pearson.com/en-us/subject-catalog/p/design-patterns-elements-of-reusable-object-oriented-software/P200000009480). The next two sections show what the catalogued patterns actually add on top of it.

## Factory Method: the decision moves into a subclass

Factory Method does not put a `switch` inside a shared method. It puts an abstract (or virtual) method on a base class, so the *base class's own algorithm* can call it without knowing which concrete type comes back — the decision is made once, by which subclass exists, not on every call.

```csharp run id=report-factory-method
ReportExporter csv = new CsvReportExporter();
ReportExporter md = new MarkdownReportExporter();

Console.WriteLine(csv.Export(["Priya", "Diego"]));
Console.WriteLine(md.Export(["Priya", "Diego"]));

abstract class ReportExporter
{
    public string Export(IEnumerable<string> rows)
    {
        IRowWriter writer = CreateWriter();
        return writer.Write(rows);
    }

    protected abstract IRowWriter CreateWriter();
}

sealed class CsvReportExporter : ReportExporter
{
    protected override IRowWriter CreateWriter() => new CsvRowWriter();
}

sealed class MarkdownReportExporter : ReportExporter
{
    protected override IRowWriter CreateWriter() => new MarkdownRowWriter();
}

interface IRowWriter
{
    string Write(IEnumerable<string> rows);
}

sealed class CsvRowWriter : IRowWriter
{
    public string Write(IEnumerable<string> rows) => string.Join(',', rows);
}

sealed class MarkdownRowWriter : IRowWriter
{
    public string Write(IEnumerable<string> rows) => string.Join(" | ", rows);
}
```

```text output
Priya,Diego
Priya | Diego
```

`ReportExporter.Export` is a template method: it calls `CreateWriter()` — the factory method — without knowing whether it will get back a `CsvRowWriter` or a `MarkdownRowWriter`. Nowhere in this program does a `switch` or an `if` compare a type name; the choice was made the moment the caller wrote `new CsvReportExporter()` instead of `new MarkdownReportExporter()`, and every subsequent call to `Export` reuses that one decision. That is the structural difference from the simple factory above: a simple factory is one method that branches on a parameter every time it runs; Factory Method is a base-class algorithm that a subclass configures once, by overriding a single method.

<figure class="diagram">
<svg viewBox="0 0 340 300" role="img" aria-labelledby="fm-flow-title fm-flow-desc">
<title id="fm-flow-title">Factory Method: a base-class algorithm calling an overridden method</title>
<desc id="fm-flow-desc">Four stacked boxes. The client constructs a CsvReportExporter. That flows into ReportExporter.Export, which calls the virtual CreateWriter method. Because the concrete instance is a CsvReportExporter, that call resolves to its override, which constructs a CsvRowWriter.</desc>
<defs>
<marker id="fm-flow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-stroke"/></marker>
</defs>
<rect x="30" y="10" width="280" height="52" rx="8" class="d-box"/>
<text x="170" y="32" text-anchor="middle" class="d-bold d-small">Client</text>
<text x="170" y="50" text-anchor="middle" class="d-mono d-small d-muted">new CsvReportExporter()</text>
<path d="M170 62 V92" class="d-line" marker-end="url(#fm-flow-arrow)"/>
<rect x="30" y="96" width="280" height="52" rx="8" class="d-box-accent"/>
<text x="170" y="118" text-anchor="middle" class="d-bold d-small">ReportExporter.Export(rows)</text>
<text x="170" y="136" text-anchor="middle" class="d-mono d-small d-muted">calls CreateWriter()</text>
<path d="M170 148 V178" class="d-line" marker-end="url(#fm-flow-arrow)"/>
<rect x="30" y="182" width="280" height="52" rx="8" class="d-box"/>
<text x="170" y="204" text-anchor="middle" class="d-bold d-small">CreateWriter() [abstract]</text>
<text x="170" y="222" text-anchor="middle" class="d-small d-muted">resolved by the runtime type</text>
<path d="M170 234 V264" class="d-line" marker-end="url(#fm-flow-arrow)"/>
<rect x="30" y="268" width="280" height="30" rx="8" class="d-box-good"/>
<text x="170" y="288" text-anchor="middle" class="d-mono d-small d-bold">CsvReportExporter -&gt; new CsvRowWriter()</text>
</svg>
<figcaption>Figure 1. Which concrete writer gets created is decided by which subclass overrides CreateWriter(), not by a runtime switch inside Export.</figcaption>
</figure>

## Abstract Factory: one call site, a matched family

Factory Method decides *one* product. Abstract Factory decides an entire *family* of related products at once, so that whatever a client builds from one factory instance is guaranteed to match. Below, a UI toolkit needs a `Button` and a `Checkbox` that always share the same theme — mixing a light button with a dark checkbox would be a visual bug.

```csharp run id=widget-abstract-factory
IWidgetFactory[] factories = [new LightWidgetFactory(), new DarkWidgetFactory()];

foreach (var factory in factories)
{
    IButton button = factory.CreateButton();
    ICheckbox checkbox = factory.CreateCheckbox();
    Console.WriteLine($"{button.Render()} + {checkbox.Render()}");
}

interface IButton { string Render(); }
interface ICheckbox { string Render(); }

interface IWidgetFactory
{
    IButton CreateButton();
    ICheckbox CreateCheckbox();
}

sealed class LightButton : IButton
{
    public string Render() => "button[bg=white,fg=black]";
}

sealed class LightCheckbox : ICheckbox
{
    public string Render() => "checkbox[bg=white,fg=black]";
}

sealed class LightWidgetFactory : IWidgetFactory
{
    public IButton CreateButton() => new LightButton();
    public ICheckbox CreateCheckbox() => new LightCheckbox();
}

sealed class DarkButton : IButton
{
    public string Render() => "button[bg=black,fg=white]";
}

sealed class DarkCheckbox : ICheckbox
{
    public string Render() => "checkbox[bg=black,fg=white]";
}

sealed class DarkWidgetFactory : IWidgetFactory
{
    public IButton CreateButton() => new DarkButton();
    public ICheckbox CreateCheckbox() => new DarkCheckbox();
}
```

```text output
button[bg=white,fg=black] + checkbox[bg=white,fg=black]
button[bg=black,fg=white] + checkbox[bg=black,fg=white]
```

The calling code never constructs a `LightButton` or a `DarkCheckbox` itself; it asks one `IWidgetFactory` for both members of the pair, so the two are structurally guaranteed to come from the same family. That guarantee is the entire point of Abstract Factory, and it is also its cost: adding a third widget kind (say, `ICheckbox` and `IButton` both gain a sibling `ISlider`) means changing the `IWidgetFactory` interface and every implementation of it, whereas Factory Method only ever has one product to extend.

::::exercise[Break the guarantee]
A developer wants a quick "high-contrast" look and writes `IButton mixedButton = new DarkButton();` followed by `ICheckbox mixedCheckbox = new LightCheckbox();`, instead of adding a new `IWidgetFactory` implementation.

What guarantee that `LightWidgetFactory` and `DarkWidgetFactory` each provide has this code given up? What would a `HighContrastWidgetFactory` need to look like to keep it?

:::solution
Abstract Factory's guarantee is that every product used together comes from the *same* concrete factory, so a caller can never end up with mismatched pieces. The hand-mixed code above defeats that by constructing `DarkButton` and `LightCheckbox` directly, bypassing any factory at all — nothing stops a caller from doing this again with an even worse mismatch, because the compiler only checks that each type implements its interface, not that the two came from one factory. `HighContrastWidgetFactory` needs to implement `IWidgetFactory` itself, with `CreateButton` and `CreateCheckbox` returning a pair designed to go together (for example a `HighContrastButton` and `HighContrastCheckbox`, both new types); that keeps the "always matched" promise for every caller that gets its widgets by asking a factory, the same way the two factories above already do.
:::
::::

## Builder: assembling something too complex for one constructor call

A constructor with many optional parameters (`new HttpRequest(method, url, headers: null, body: null, timeout: null, ...)`) is hard to read at the call site and hard to extend without breaking every existing caller. Builder solves this by spreading construction across several small, named calls that each set one part, ending in a call that produces the finished object.

```csharp run id=http-request-builder
HttpRequestSpec getRequest = new HttpRequestBuilder()
    .WithMethod("GET")
    .WithUrl("https://api.example.com/orders/42")
    .WithHeader("Accept", "application/json")
    .Build();

Console.WriteLine(getRequest);

try
{
    _ = new HttpRequestBuilder().WithHeader("Accept", "application/json").Build();
}
catch (InvalidOperationException ex)
{
    Console.WriteLine($"rejected: {ex.Message}");
}

sealed record HttpRequestSpec(
    string Method,
    string Url,
    IReadOnlyDictionary<string, string> Headers)
{
    public override string ToString()
        => $"{Method} {Url} ({Headers.Count} header(s))";
}

sealed class HttpRequestBuilder
{
    private string? _method;
    private string? _url;
    private readonly Dictionary<string, string> _headers = [];

    public HttpRequestBuilder WithMethod(string method)
    {
        _method = method;
        return this;
    }

    public HttpRequestBuilder WithUrl(string url)
    {
        _url = url;
        return this;
    }

    public HttpRequestBuilder WithHeader(string name, string value)
    {
        _headers[name] = value;
        return this;
    }

    public HttpRequestSpec Build()
    {
        if (_method is null) throw new InvalidOperationException("A method is required.");
        if (_url is null) throw new InvalidOperationException("A URL is required.");
        return new HttpRequestSpec(_method, _url, _headers);
    }
}
```

```text output
GET https://api.example.com/orders/42 (1 header(s))
rejected: A method is required.
```

Every `With...` method mutates the same builder instance and returns `this`, which is what lets the calls chain; `Build()` is the one place that both validates the accumulated state and produces the immutable `HttpRequestSpec` record — nothing outside `HttpRequestBuilder` can observe a half-built request. That is a narrower shape than the classic GoF Builder, which also names a separate *Director* that drives the same builder through two different construction sequences to get two different representations from one set of build steps[[8]](https://www.pearson.com/en-us/subject-catalog/p/design-patterns-elements-of-reusable-object-oriented-software/P200000009480). The fluent, self-returning style above has no Director; the calling code plays that role directly. Nearly every "builder" in modern C# — including both BCL examples below — uses this narrower fluent shape rather than the original two-role one.

<figure class="diagram">
<svg viewBox="0 0 340 320" role="img" aria-labelledby="builder-flow-title builder-flow-desc">
<title id="builder-flow-title">A fluent builder accumulating state before one Build call</title>
<desc id="builder-flow-desc">A builder box receives three chained calls that each return the same builder, shown as a loop back into the box. Only the final Build call, at the bottom, produces the finished HttpRequestSpec object.</desc>
<defs>
<marker id="builder-flow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-stroke"/></marker>
</defs>
<rect x="30" y="10" width="280" height="44" rx="8" class="d-box"/>
<text x="170" y="37" text-anchor="middle" class="d-bold d-small">new HttpRequestBuilder()</text>
<path d="M170 54 V80" class="d-line" marker-end="url(#builder-flow-arrow)"/>
<rect x="30" y="84" width="280" height="120" rx="8" class="d-box-accent"/>
<text x="170" y="108" text-anchor="middle" class="d-mono d-small">.WithMethod("GET")</text>
<text x="170" y="130" text-anchor="middle" class="d-mono d-small">.WithUrl(...)</text>
<text x="170" y="152" text-anchor="middle" class="d-mono d-small">.WithHeader(...)</text>
<text x="170" y="178" text-anchor="middle" class="d-small d-muted">each call mutates this builder</text>
<text x="170" y="194" text-anchor="middle" class="d-small d-muted">and returns the same instance</text>
<path d="M170 204 V234" class="d-line" marker-end="url(#builder-flow-arrow)"/>
<rect x="30" y="238" width="280" height="44" rx="8" class="d-box-good"/>
<text x="170" y="265" text-anchor="middle" class="d-bold d-small">.Build() -&gt; new HttpRequestSpec(...)</text>
<text x="20" y="304" class="d-small d-muted">The finished object is created once, here,</text>
<text x="20" y="318" class="d-small d-muted">already validated and immutable.</text>
</svg>
<figcaption>Figure 2. Every WithX call returns the same builder; the object under construction is created only inside Build, once every required part is present.</figcaption>
</figure>

## Builder in the BCL: `StringBuilder` and `WebApplicationBuilder`

`StringBuilder` is the oldest fluent builder in the BCL. Strings are immutable, so "each operation that appears to modify a `String` object actually creates a new string," and the documentation warns that "for routines that perform extensive string manipulation," modifying a string repeatedly "can exert a significant performance penalty"[[4]](https://learn.microsoft.com/en-us/dotnet/api/system.text.stringbuilder); `StringBuilder` mutates one buffer in place instead. "Most of the methods that modify the string in a `StringBuilder` instance return a reference to that same instance"[[4]](https://learn.microsoft.com/en-us/dotnet/api/system.text.stringbuilder), which is exactly the `return this;` shape `HttpRequestBuilder` used above.

```csharp run id=stringbuilder-chain
var sb = new System.Text.StringBuilder();
sb.Append("order #").Append(42).Append(": ").Append("shipped");
Console.WriteLine(sb.ToString());

sb.Replace("shipped", "delivered");
Console.WriteLine(sb.ToString());
```

```text output
order #42: shipped
order #42: delivered
```

`WebApplicationBuilder` is a newer, larger-scale version of the same idea. `WebApplication.CreateBuilder()` returns a `WebApplicationBuilder` "with preconfigured defaults"[[5]](https://learn.microsoft.com/en-us/dotnet/api/microsoft.aspnetcore.builder.webapplication.createbuilder); the caller configures it — registering services on `builder.Services`, reading `builder.Configuration` — over as many statements as the app needs, and a single terminal `builder.Build()` call produces the running `WebApplication`[[6]](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/minimal-apis/webapplication). The program below builds one and inspects it without starting a server, using the `#:sdk Microsoft.NET.Sdk.Web` file-based-app directive to pull in ASP.NET Core[[7]](https://learn.microsoft.com/en-us/dotnet/core/sdk/file-based-apps).

```csharp run id=webapplicationbuilder-demo
#:sdk Microsoft.NET.Sdk.Web

var builder = WebApplication.CreateBuilder();
builder.Services.AddSingleton<IGreeter, Greeter>();

var app = builder.Build();
app.MapGet("/hello", (IGreeter greeter) => greeter.Greet());

Console.WriteLine($"Environment: {app.Environment.EnvironmentName}");
Console.WriteLine("Routes registered without starting the server.");

interface IGreeter { string Greet(); }

sealed class Greeter : IGreeter
{
    public string Greet() => "hello";
}
```

```text output
Environment: Production
Routes registered without starting the server.
```

`builder.Services` is itself an `IServiceCollection`, configured with the same chained-call style as `StringBuilder`: `AddSingleton`, `AddScoped` and the rest each return the collection so calls can be strung together. That detail matters for the rest of this article — it is the same `AddSingleton` that reappears below, doing a very different job than the classic Singleton pattern.

## Singleton, implemented correctly

Singleton restricts a type to exactly one instance and gives the whole program one place to get it. Getting this right under concurrent access without paying a lock on every access is exactly what `Lazy<T>` is for: "by default, all public and protected members of the `Lazy<T>` class are thread safe and may be used concurrently from multiple threads"[[1]](https://learn.microsoft.com/en-us/dotnet/api/system.lazy-1). With `LazyThreadSafetyMode.ExecutionAndPublication` — the mode any constructor that takes a factory delegate uses by default — the type is "fully thread safe; uses locking to ensure that only one thread initializes the value"[[1]](https://learn.microsoft.com/en-us/dotnet/api/system.lazy-1).

```csharp run id=lazy-singleton
using System.Collections.Concurrent;

var instances = new ConcurrentBag<object>();

Parallel.For(0, 20, _ =>
{
    instances.Add(AppConfiguration.Instance);
});

Console.WriteLine($"distinct instances observed: {instances.Distinct(ReferenceEqualityComparer.Instance).Count()}");
Console.WriteLine($"factory ran: {AppConfiguration.Instance.TimesConstructed} time(s)");
Console.WriteLine($"IsValueCreated: {AppConfiguration.IsInitialized}");

sealed class AppConfiguration
{
    private static int _constructedCount;
    private static readonly Lazy<AppConfiguration> _lazy =
        new(
            () => new AppConfiguration(),
            LazyThreadSafetyMode.ExecutionAndPublication);

    public static AppConfiguration Instance => _lazy.Value;
    public static bool IsInitialized => _lazy.IsValueCreated;

    public int TimesConstructed { get; }

    private AppConfiguration()
    {
        TimesConstructed = Interlocked.Increment(ref _constructedCount);
    }
}
```

```text output
distinct instances observed: 1
factory ran: 1 time(s)
IsValueCreated: True
```

Twenty parallel tasks all read `AppConfiguration.Instance`; only one of them ever runs the constructor (`TimesConstructed` never exceeds `1`, verified with `Interlocked.Increment` rather than a plain `++` so the counter itself is not a second race), and every task gets back the same object reference, checked with `ReferenceEqualityComparer` rather than `GetHashCode()` — hash codes are not documented to be unique per instance, so they are not a reliable identity check on their own. Compare this with the tempting shortcut of a plain `private static readonly AppConfiguration _instance = new();` field: that is also thread-safe (the runtime guarantees a type's static field initializers run once, before first use), but it constructs the instance the moment the type is first touched, whether or not the program ever needs it. `Lazy<T>` defers that cost to the first real access, and `IsValueCreated` above shows precisely when it happened.

<figure class="diagram">
<svg viewBox="0 0 340 260" role="img" aria-labelledby="lazy-flow-title lazy-flow-desc">
<title id="lazy-flow-title">Three threads converging on one Lazy&lt;T&gt; initialization</title>
<desc id="lazy-flow-desc">Three thread boxes each send an arrow down into a single Lazy of AppConfiguration Value box. From there, a single arrow continues down to one AppConfiguration instance box, with a note that only the first caller's factory delegate actually runs.</desc>
<defs>
<marker id="lazy-flow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-stroke"/></marker>
</defs>
<rect x="10" y="10" width="90" height="40" rx="6" class="d-box"/>
<text x="55" y="34" text-anchor="middle" class="d-small">Thread A</text>
<rect x="125" y="10" width="90" height="40" rx="6" class="d-box"/>
<text x="170" y="34" text-anchor="middle" class="d-small">Thread B</text>
<rect x="240" y="10" width="90" height="40" rx="6" class="d-box"/>
<text x="285" y="34" text-anchor="middle" class="d-small">Thread C</text>
<path d="M55 50 L150 96" class="d-line" marker-end="url(#lazy-flow-arrow)"/>
<path d="M170 50 V96" class="d-line" marker-end="url(#lazy-flow-arrow)"/>
<path d="M285 50 L190 96" class="d-line" marker-end="url(#lazy-flow-arrow)"/>
<rect x="40" y="100" width="260" height="48" rx="8" class="d-box-accent"/>
<text x="170" y="122" text-anchor="middle" class="d-bold d-small">Lazy&lt;AppConfiguration&gt;.Value</text>
<text x="170" y="140" text-anchor="middle" class="d-small d-muted">internal lock serializes first access</text>
<path d="M170 148 V178" class="d-line" marker-end="url(#lazy-flow-arrow)"/>
<rect x="40" y="182" width="260" height="44" rx="8" class="d-box-good"/>
<text x="170" y="209" text-anchor="middle" class="d-bold d-small">one AppConfiguration instance</text>
<text x="20" y="246" class="d-small d-muted">Only the first caller's factory delegate runs;</text>
<text x="20" y="260" class="d-small d-muted">A, B and C all get the same reference back.</text>
</svg>
<figcaption>Figure 3. Lazy&lt;T&gt;'s internal lock lets many threads race to read Value while guaranteeing the factory delegate runs exactly once.</figcaption>
</figure>

::::exercise[Find the missing guarantee]
This rewrite of `AppConfiguration` replaces `LazyThreadSafetyMode.ExecutionAndPublication` with `LazyThreadSafetyMode.None` in the `Lazy<T>` field initializer, reasoning that a lambda with no side effects other than the constructor "can't race."

Under concurrent first access from multiple threads, what does `LazyThreadSafetyMode.None` actually give up compared to `ExecutionAndPublication`, and what would a reader observe if `AppConfiguration`'s constructor had a visible side effect (for example, appending to a shared log file)?

:::solution
`LazyThreadSafetyMode.None` removes the internal lock entirely — the documentation's equivalence table lists it as "not thread safe," with no synchronization at all if `Value` is read from more than one thread before initialization completes. Two threads racing into an uninitialized `Lazy<T>` in this mode can both start running the factory delegate, and the behavior of `Lazy<T>` itself becomes undefined for that instance. If `AppConfiguration`'s constructor appended to a shared log file, a reader could see two log entries instead of one, or a corrupted single entry if both writes interleave — the exact bug `ExecutionAndPublication`'s lock exists to prevent. `LazyThreadSafetyMode.None` is only appropriate when a `Lazy<T>` instance is provably never read from more than one thread, which is rarely true of something reached through a `public static` property.
:::
::::

## What a global singleton costs a test suite

A `public static Instance` property is not just a way to get one object — it is a hidden dependency baked into every type that calls it, with no seam a test can use to substitute anything else. `OrderProcessor` below calls `EmailSender.Instance.Send` directly, with no constructor parameter for it at all.

```csharp run id=bad-singleton-test fails
#:package xunit.v3@1.*
using Xunit;

public class OrderProcessorTests
{
    [Fact]
    public void Ship_SendsExactlyOneEmail_PerCustomer()
    {
        var first = new OrderProcessor();
        first.Ship("a@example.com", "A100");
        Assert.Single(EmailSender.Instance.SentLog);

        var second = new OrderProcessor();
        second.Ship("b@example.com", "B200");
        Assert.Single(EmailSender.Instance.SentLog);
    }
}

sealed class EmailSender
{
    private static readonly EmailSender _instance = new();
    public static EmailSender Instance => _instance;
    private EmailSender() { }

    public List<string> SentLog { get; } = [];
    public void Send(string to, string subject) => SentLog.Add($"{to}: {subject}");
}

sealed class OrderProcessor
{
    public void Ship(string customerEmail, string orderId)
        => EmailSender.Instance.Send(customerEmail, $"Order {orderId} shipped");
}
```

```text output
xUnit.net v3 In-Process Runner [...]
  Discovering: bad-singleton-test
  Discovered:  bad-singleton-test
  Starting:    bad-singleton-test
    OrderProcessorTests.Ship_SendsExactlyOneEmail_PerCustomer [FAIL]
      Assert.Single() Failure: The collection contained 2 items
      Collection: [...]
      Stack Trace:
[...]
[...]
[...]
  Finished:    bad-singleton-test
=== TEST EXECUTION SUMMARY ===
   bad-singleton-test  Total: 1, Errors: 0, Failed: 1, Skipped: 0, Not Run: 0, Time: [...]
```

Both `first` and `second` are fresh `OrderProcessor` objects — nothing is shared between them in the source code the test wrote. The test fails anyway, because `EmailSender.Instance` is one process-wide object underneath both of them, and its `SentLog` keeps every entry from the whole test run. This is not a contrived edge case: it is exactly the outcome Microsoft's own dependency-injection documentation predicts for a hard-coded dependency, calling it "difficult to unit test," because "the app should use a mock or stub... which isn't possible with this approach"[[2]](https://learn.microsoft.com/en-us/dotnet/core/extensions/dependency-injection/overview). Here the problem shows up even without a mock: two calls that look independent share invisible state because `OrderProcessor` gives a test no way to hand it anything else.

## The DI lifetime that replaced it

Microsoft's own guidance for [the DI container](/oop-design/dependency-injection/) is direct about the fix: "if the app requires singleton behavior, allow the service container to manage the service's lifetime... don't implement the singleton design pattern and provide code to dispose of the singleton"[[3]](https://learn.microsoft.com/en-us/dotnet/core/extensions/dependency-injection/service-lifetimes). `services.AddSingleton<IEmailSender, EmailSender>()` gives every part of the running app the same instance — the same "one instance" promise the classic pattern made — but through an interface a constructor can ask for and a test can replace, rather than a static property baked into every caller. The documentation's own words for the requirement carried over from the classic pattern: "singleton services must be thread safe"[[3]](https://learn.microsoft.com/en-us/dotnet/core/extensions/dependency-injection/service-lifetimes) — the container removes the *access point*, not the concurrency obligation.

```csharp run id=di-singleton-lifetime
#:package Microsoft.Extensions.DependencyInjection@9.*
using Microsoft.Extensions.DependencyInjection;

var services = new ServiceCollection();
services.AddSingleton<IEmailSender, EmailSender>();
services.AddTransient<OrderProcessor>();

using ServiceProvider provider = services.BuildServiceProvider();

IEmailSender first = provider.GetRequiredService<IEmailSender>();
IEmailSender second = provider.GetRequiredService<IEmailSender>();
Console.WriteLine($"same instance both times: {ReferenceEquals(first, second)}");

OrderProcessor processor = provider.GetRequiredService<OrderProcessor>();
processor.Ship("a@example.com", "A100");
Console.WriteLine($"emails sent: {((EmailSender)first).SentLog.Count}");

interface IEmailSender
{
    void Send(string to, string subject);
}

sealed class EmailSender : IEmailSender
{
    public List<string> SentLog { get; } = [];
    public void Send(string to, string subject) => SentLog.Add($"{to}: {subject}");
}

sealed class OrderProcessor(IEmailSender emailSender)
{
    public void Ship(string customerEmail, string orderId)
        => emailSender.Send(customerEmail, $"Order {orderId} shipped");
}
```

```text output
same instance both times: True
emails sent: 1
```

`first` and `second` are the same object (`ReferenceEquals` is `True`), confirming the container is holding one shared `EmailSender` for the app, exactly as `AddSingleton` promises. But `OrderProcessor` never mentions `EmailSender` or the container at all — it only asks its constructor for an `IEmailSender`. That is the seam the earlier version had none of, and it is all a unit test needs:

```csharp run id=good-singleton-test
#:package xunit.v3@1.*
using Xunit;

public class OrderProcessorTests
{
    [Fact]
    public void Ship_SendsOneConfirmationEmail_ForOrderA100()
    {
        var fake = new FakeEmailSender();
        var processor = new OrderProcessor(fake);

        processor.Ship("a@example.com", "A100");

        Assert.Single(fake.SentLog);
        Assert.Contains("A100", fake.SentLog[0]);
    }

    [Fact]
    public void Ship_SendsOneConfirmationEmail_ForOrderB200()
    {
        var fake = new FakeEmailSender();
        var processor = new OrderProcessor(fake);

        processor.Ship("b@example.com", "B200");

        Assert.Single(fake.SentLog);
        Assert.Contains("B200", fake.SentLog[0]);
    }
}

interface IEmailSender
{
    void Send(string to, string subject);
}

sealed class FakeEmailSender : IEmailSender
{
    public List<string> SentLog { get; } = [];
    public void Send(string to, string subject) => SentLog.Add($"{to}: {subject}");
}

sealed class OrderProcessor(IEmailSender emailSender)
{
    public void Ship(string customerEmail, string orderId)
        => emailSender.Send(customerEmail, $"Order {orderId} shipped");
}
```

```text output
xUnit.net v3 In-Process Runner [...]
  Discovering: good-singleton-test
  Discovered:  good-singleton-test
  Starting:    good-singleton-test
  Finished:    good-singleton-test
=== TEST EXECUTION SUMMARY ===
   good-singleton-test  Total: 2, Errors: 0, Failed: 0, Skipped: 0, Not Run: 0, Time: [...]
```

Both tests pass, in either order, because each constructs its own `FakeEmailSender` and hands it directly to `OrderProcessor` — there is no process-wide object for the two tests to fight over. Nothing here required a mocking library; `IEmailSender` and constructor injection were enough. That is the honest version of "DI lifetimes replaced Singleton": not that `AddSingleton` is a cleverer way to write the same pattern, but that constructor injection gives every caller an explicit, substitutable dependency, and the container's `Singleton` lifetime is one configuration choice about that dependency's lifetime rather than a structural decision baked into the type itself.

::::exercise[Judge the other two]
`AppConfiguration` earlier in this article (the `Lazy<T>` version) never appears behind an interface and is read directly by name, the same way `EmailSender.Instance` was. Does it have the same testability problem as `EmailSender.Instance` did? Why might a configuration value be a more defensible case for the classic pattern than an email sender is?

:::solution
Structurally, yes — any type that reads `AppConfiguration.Instance` directly has the identical seam-free coupling `OrderProcessor` had to the old `EmailSender.Instance`, and a test could not substitute a different `AppConfiguration` for it either. The difference is what the object *does*: `AppConfiguration` in this article only returns a `TimesConstructed` counter and has no method a test would ever want to fake the behavior of, whereas `EmailSender.Send` is exactly the kind of side-effecting call a unit test needs to observe or replace. A read-only value with no behavior to substitute is the weakest case against the classic pattern; a collaborator with methods a test wants to control or verify — a sender, a clock, a repository — is the strongest one, and that is the category DI lifetimes exist for.
:::
::::
