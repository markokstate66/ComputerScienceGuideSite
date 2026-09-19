---
title: "Mocks, Stubs and Fakes: Test Doubles Without Confusion"
description: "Mock vs. stub, settled: the five kinds of test double written by hand in C#, what a mocking library adds, and how over-mocking breaks tests of correct code."
pillar: testing
order: 2
author: markus
published: 2026-09-18
updated: 2026-09-18
level: intermediate
tags: [unit-testing, test-doubles, mocking, dependency-injection]
prerequisites: ["testing/unit-testing-fundamentals"]
sources:
  - title: "xUnit Test Patterns: Refactoring Test Code, chapters 11 (Using Test Doubles) and 23 (Test Double Patterns)"
    url: "https://www.informit.com/store/xunit-test-patterns-refactoring-test-code-9780131495050"
    publisher: "Gerard Meszaros, Addison-Wesley"
    accessed: 2026-09-18
  - title: "Test Double"
    url: "https://martinfowler.com/bliki/TestDouble.html"
    publisher: "Martin Fowler"
    accessed: 2026-09-18
  - title: "Mocks Aren't Stubs"
    url: "https://martinfowler.com/articles/mocksArentStubs.html"
    publisher: "Martin Fowler"
    accessed: 2026-09-18
  - title: "Software Engineering at Google, chapter 13: Test Doubles"
    url: "https://abseil.io/resources/swe-book/html/ch13.html"
    publisher: "O'Reilly / Google"
    accessed: 2026-09-18
  - title: "Best practices for writing unit tests: unit testing terminology"
    url: "https://learn.microsoft.com/en-us/dotnet/core/testing/unit-testing-best-practices"
    publisher: "Microsoft Learn"
    accessed: 2026-09-18
  - title: "NSubstitute: Getting started"
    url: "https://nsubstitute.github.io/help/getting-started/"
    publisher: "NSubstitute"
    accessed: 2026-09-18
  - title: "NSubstitute: Checking received calls"
    url: "https://nsubstitute.github.io/help/received-calls/"
    publisher: "NSubstitute"
    accessed: 2026-09-18
  - title: "Moq Quickstart"
    url: "https://github.com/devlooped/moq/wiki/Quickstart"
    publisher: "Moq"
    accessed: 2026-09-18
  - title: "File-based apps"
    url: "https://learn.microsoft.com/en-us/dotnet/core/sdk/file-based-apps"
    publisher: "Microsoft Learn"
    accessed: 2026-09-18
  - title: "What is the TimeProvider class"
    url: "https://learn.microsoft.com/en-us/dotnet/standard/datetime/timeprovider-overview"
    publisher: "Microsoft Learn"
    accessed: 2026-09-18
draft: true
---

A stub answers the code you are testing. A mock checks what the code you are testing did to it. The data flows in opposite directions, and that is the whole of the "mock vs. stub" question. The other three kinds of test double (dummy, spy and fake) fall into place once that direction is clear, and the quickest way to make it clear is to write all five by hand, with no library, against one small class.

The vocabulary comes from Gerard Meszaros, who named the general idea a *test double*, after a film's stunt double, and sorted the variations into dummy objects, test stubs, test spies, mock objects and fake objects (*xUnit Test Patterns*, chapter 23; Martin Fowler's [Test Double](https://martinfowler.com/bliki/TestDouble.html) note summarizes the list). A test double is any object a test puts in the place of a real collaborator of the code being tested.

## One exit gate, three collaborators

The class under test is the exit gate of a parking garage. A driver inserts a ticket and a card; the gate works out the fee, charges the card, marks the ticket as used and opens.

Every C# excerpt in this article comes from one program, collapsed here so that you can run it first or read it last. Its first half is the gate, the five doubles and a test for each; its second half is the refactoring experiment in the [over-mocking section](#over-mocking-a-test-that-fails-when-nothing-is-wrong).

<details>
<summary>The complete program and its output</summary>

```csharp run id=gate
using System.Globalization;

// Print 6.00 and not 6,00, whatever the machine culture.
CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;

var entered = new DateTime(2026, 3, 2, 9, 0, 0);
var ticket = new Ticket(
    "T-17", entered, Exited: null);
var at1140 = new StubClock(
    entered.AddMinutes(160));

Check.Test("dummy: unknown ticket", () =>
{
    var gate = new ExitGate(
        at1140,
        new InMemoryTicketStore(),
        new DummyTerminal());

    var result = gate.Process("T-99", "card-1");

    Check.Equal(GateResult.UnknownTicket, result);
});

Check.Test("stub: declined card", () =>
{
    var store = new InMemoryTicketStore(ticket);
    var gate = new ExitGate(
        at1140,
        store,
        new StubTerminal(approves: false));

    var result = gate.Process("T-17", "card-1");

    Check.Equal(GateResult.Declined, result);
    Check.Equal(null, store.Find("T-17")!.Exited);
});

Check.Test("spy: 160 minutes costs 6.00", () =>
{
    var terminal = new SpyTerminal();
    var gate = new ExitGate(
        at1140,
        new InMemoryTicketStore(ticket),
        terminal);

    gate.Process("T-17", "card-1");

    Check.Equal(1, terminal.Charges.Count);
    Check.Equal(
        new Payment("card-1", 6.00m),
        terminal.Charges[0]);
});

Check.Test("mock: 160 minutes costs 6.00", () =>
{
    var terminal = new MockTerminal();
    terminal.Expect("card-1", 6.00m);
    var gate = new ExitGate(
        at1140,
        new InMemoryTicketStore(ticket),
        terminal);

    gate.Process("T-17", "card-1");

    terminal.Verify();
});

Check.Test("fake: a ticket works once", () =>
{
    var store = new InMemoryTicketStore(ticket);
    var gate = new ExitGate(
        at1140,
        store,
        new StubTerminal(approves: true));

    var first = gate.Process("T-17", "card-1");
    var second = gate.Process("T-17", "card-1");

    Check.Equal(GateResult.Open, first);
    Check.Equal(GateResult.AlreadyUsed, second);
});

// ----- part two: three gates, two styles of test -----

(string Name, GateFactory Make)[] gates =
[
    ("Gate A: original",
        (c, s, t) => new ExitGate(c, s, t).Process),
    ("Gate B: reads the clock first",
        (c, s, t) => new GateB(c, s, t).Process),
    ("Gate C: never closes the ticket",
        (c, s, t) => new GateC(c, s, t).Process),
];

foreach (var (name, make) in gates)
{
    Console.WriteLine();
    Console.WriteLine(name);
    Check.Test("state-based test", () => StateBased(make));
    Check.Test("strict mock test", () => StrictMock(make));
}

void StateBased(GateFactory make)
{
    var store = new InMemoryTicketStore(ticket);
    var terminal = new SpyTerminal();
    var process = make(at1140, store, terminal);

    var result = process("T-17", "card-1");

    Check.Equal(GateResult.Open, result);
    Check.Equal(
        at1140.Now,
        store.Find("T-17")!.Exited,
        "exit time");
    Check.Equal(1, terminal.Charges.Count);
    Check.Equal(
        new Payment("card-1", 6.00m),
        terminal.Charges[0]);
}

void StrictMock(GateFactory make)
{
    var script = new Script(
        "tickets.Find T-17",
        "clock.Now",
        "terminal.Charge card-1 6.00",
        "tickets.Save T-17");
    var process = make(
        new ScriptedClock(script, at1140.Now),
        new ScriptedStore(script, ticket),
        new ScriptedTerminal(script));

    process("T-17", "card-1");

    script.Verify();
}

// ----- production code -----

record Ticket(
    string Id, DateTime Entered, DateTime? Exited);

record Payment(string Card, decimal Amount);

enum GateResult
{
    Open, UnknownTicket, AlreadyUsed, Declined
}

interface IClock { DateTime Now { get; } }

interface ITicketStore
{
    Ticket? Find(string id);
    void Save(Ticket ticket);
}

interface IPaymentTerminal
{
    bool Charge(string card, decimal amount);
}

static class Tariff
{
    // First 30 minutes free, then 2.00 per started hour.
    public static decimal FeeFor(TimeSpan stay) =>
        stay.TotalMinutes <= 30
            ? 0m
            : 2.00m * (decimal)Math.Ceiling(stay.TotalHours);
}

class ExitGate(
    IClock clock,
    ITicketStore tickets,
    IPaymentTerminal terminal)
{
    public GateResult Process(
        string ticketId, string card)
    {
        var ticket = tickets.Find(ticketId);
        if (ticket is null)
            return GateResult.UnknownTicket;
        if (ticket.Exited is not null)
            return GateResult.AlreadyUsed;

        var now = clock.Now;
        var stay = now - ticket.Entered;
        var fee = Tariff.FeeFor(stay);
        var paid = fee == 0
            || terminal.Charge(card, fee);
        if (!paid) return GateResult.Declined;

        tickets.Save(
            ticket with { Exited = now });
        return GateResult.Open;
    }
}

// ----- the five doubles -----

class DummyTerminal : IPaymentTerminal
{
    public bool Charge(string card, decimal amount) =>
        throw new NotSupportedException(
            "dummy terminal was used");
}

class StubClock(DateTime now) : IClock
{
    public DateTime Now => now;
}

class StubTerminal(bool approves) : IPaymentTerminal
{
    public bool Charge(string card, decimal amount) =>
        approves;
}

class SpyTerminal : IPaymentTerminal
{
    public List<Payment> Charges { get; } = [];

    public bool Charge(string card, decimal amount)
    {
        Charges.Add(new(card, amount));
        return true;
    }
}

class MockTerminal : IPaymentTerminal
{
    readonly Queue<Payment> expected = new();

    public void Expect(string card, decimal amount) =>
        expected.Enqueue(new(card, amount));

    public bool Charge(string card, decimal amount)
    {
        var actual = new Payment(card, amount);
        if (expected.Count == 0)
            throw new CheckFailed(
                $"unexpected {actual}");
        Check.Equal(expected.Dequeue(), actual);
        return true;
    }

    public void Verify()
    {
        if (expected.Count > 0)
            throw new CheckFailed(
                $"never got {expected.Peek()}");
    }
}

class InMemoryTicketStore(params Ticket[] seed)
    : ITicketStore
{
    readonly Dictionary<string, Ticket> byId =
        seed.ToDictionary(t => t.Id);

    public Ticket? Find(string id) =>
        byId.GetValueOrDefault(id);

    public void Save(Ticket ticket) =>
        byId[ticket.Id] = ticket;
}

// ----- part two: two more gates -----

delegate Func<string, string, GateResult> GateFactory(
    IClock clock,
    ITicketStore tickets,
    IPaymentTerminal terminal);

// Same behavior as ExitGate. The clock is read first, so
// one request uses one timestamp from start to finish.
class GateB(
    IClock clock,
    ITicketStore tickets,
    IPaymentTerminal terminal)
{
    public GateResult Process(
        string ticketId, string card)
    {
        var now = clock.Now;

        var ticket = tickets.Find(ticketId);
        if (ticket is null)
            return GateResult.UnknownTicket;
        if (ticket.Exited is not null)
            return GateResult.AlreadyUsed;

        var stay = now - ticket.Entered;
        var fee = Tariff.FeeFor(stay);
        var paid = fee == 0
            || terminal.Charge(card, fee);
        if (!paid) return GateResult.Declined;

        tickets.Save(
            ticket with { Exited = now });
        return GateResult.Open;
    }
}

// A real bug: the driver pays and the ticket stays open,
// so the same ticket works (and is charged) again.
class GateC(
    IClock clock,
    ITicketStore tickets,
    IPaymentTerminal terminal)
{
    public GateResult Process(
        string ticketId, string card)
    {
        var ticket = tickets.Find(ticketId);
        if (ticket is null)
            return GateResult.UnknownTicket;
        if (ticket.Exited is not null)
            return GateResult.AlreadyUsed;

        var stay = clock.Now - ticket.Entered;
        var fee = Tariff.FeeFor(stay);
        var paid = fee == 0
            || terminal.Charge(card, fee);
        if (!paid) return GateResult.Declined;

        return GateResult.Open;
    }
}

// ----- part two: strict mocks that share one script -----

class Script(params string[] expected)
{
    int next;

    public void Got(string call)
    {
        var wanted = next < expected.Length
            ? expected[next]
            : "no more calls";
        if (wanted != call)
            throw new CheckFailed(
                $"call {next + 1} was {call}\n" +
                $"expected {wanted}");
        next++;
    }

    public void Verify()
    {
        if (next < expected.Length)
            throw new CheckFailed(
                $"never received {expected[next]}");
    }
}

class ScriptedClock(Script script, DateTime now) : IClock
{
    public DateTime Now
    {
        get { script.Got("clock.Now"); return now; }
    }
}

class ScriptedStore(Script script, Ticket ticket)
    : ITicketStore
{
    public Ticket? Find(string id)
    {
        script.Got($"tickets.Find {id}");
        return id == ticket.Id ? ticket : null;
    }

    public void Save(Ticket ticket) =>
        script.Got($"tickets.Save {ticket.Id}");
}

class ScriptedTerminal(Script script) : IPaymentTerminal
{
    public bool Charge(string card, decimal amount)
    {
        script.Got(
            $"terminal.Charge {card} {amount}");
        return true;
    }
}

// ----- a very small test framework -----

class CheckFailed(string message) : Exception(message);

static class Check
{
    public static void Test(string name, Action body)
    {
        try
        {
            body();
            Console.WriteLine($"PASS  {name}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"FAIL  {name}");
            foreach (var line in ex.Message.Split('\n'))
                Console.WriteLine($"      {line}");
        }
    }

    public static void Equal<T>(
        T expected, T actual, string what = "value")
    {
        if (EqualityComparer<T>.Default
                .Equals(expected, actual)) return;
        throw new CheckFailed(
            $"{what}: expected {expected}\n" +
            $"but got {actual?.ToString() ?? "null"}");
    }
}
```

```text output
PASS  dummy: unknown ticket
PASS  stub: declined card
PASS  spy: 160 minutes costs 6.00
PASS  mock: 160 minutes costs 6.00
PASS  fake: a ticket works once

Gate A: original
PASS  state-based test
PASS  strict mock test

Gate B: reads the clock first
PASS  state-based test
FAIL  strict mock test
      call 1 was clock.Now
      expected tickets.Find T-17

Gate C: never closes the ticket
FAIL  state-based test
      exit time: expected 03/02/2026 11:40:00
      but got null
FAIL  strict mock test
      never received tickets.Save T-17
```

</details>

The gate itself:

```csharp snippet of=gate
class ExitGate(
    IClock clock,
    ITicketStore tickets,
    IPaymentTerminal terminal)
{
    public GateResult Process(
        string ticketId, string card)
    {
        var ticket = tickets.Find(ticketId);
        if (ticket is null)
            return GateResult.UnknownTicket;
        if (ticket.Exited is not null)
            return GateResult.AlreadyUsed;

        var now = clock.Now;
        var stay = now - ticket.Entered;
        var fee = Tariff.FeeFor(stay);
        var paid = fee == 0
            || terminal.Charge(card, fee);
        if (!paid) return GateResult.Declined;

        tickets.Save(
            ticket with { Exited = now });
        return GateResult.Open;
    }
}
```

The three constructor parameters are interfaces, and each real implementation is a problem for a [unit test](/glossary/#unit-test). The real clock gives a different answer on every run. The real ticket store is a database. The real payment terminal moves money. Because `ExitGate` receives them through its constructor instead of creating them, a test can hand it something else. That hand-over point is called a *seam*, and passing dependencies in like this (dependency injection) is the usual way to create one ([*Software Engineering at Google*, chapter 13](https://abseil.io/resources/swe-book/html/ch13.html)).

`Tariff.FeeFor` is a pure function: the first 30 minutes are free, then 2.00 per started hour. Nothing about it is awkward, so the tests use the real one. A double is for collaborators that are slow, nondeterministic, unavailable or dangerous, not for every class the code touches.

A test calls `Process` and gets a `GateResult` back: those are the gate's *direct* input and output. But the gate also receives data from its collaborators (the current time, the stored ticket, whether the card was approved) and does things to them (charges a card, saves a ticket). Meszaros calls these *indirect inputs* and *indirect outputs*. A test cannot supply the first kind or see the second kind through `Process` alone. Doubles exist to give the test a control point for indirect inputs and an observation point for indirect outputs (*xUnit Test Patterns*, chapter 11).

<figure class="diagram">
<svg viewBox="0 0 360 372" role="img" aria-labelledby="tdio-title tdio-desc">
<title id="tdio-title">Direct and indirect inputs and outputs of the exit gate</title>
<desc id="tdio-desc">The test calls the exit gate and reads its result. Below the gate are its three collaborators. The clock only sends data up to the gate, the terminal mostly receives calls from the gate, and the ticket store does both. A stub replaces the first, a spy or mock the last, and a fake the one in the middle.</desc>
<defs>
<marker id="tdio-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-stroke"/></marker>
<marker id="tdio-arrow-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-accent"/></marker>
<marker id="tdio-arrow-g" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-good"/></marker>
</defs>
<rect x="110" y="14" width="140" height="36" rx="6" class="d-box-2"/>
<text x="180" y="37" text-anchor="middle" class="d-bold">Test</text>
<path d="M150 50 V96" class="d-line" marker-end="url(#tdio-arrow)"/>
<path d="M210 100 V54" class="d-line" marker-end="url(#tdio-arrow)"/>
<text x="142" y="78" text-anchor="end" class="d-mono d-small">Process(...)</text>
<text x="218" y="78" class="d-mono d-small">GateResult</text>
<rect x="60" y="100" width="240" height="48" rx="6" class="d-box-accent"/>
<text x="180" y="121" text-anchor="middle" class="d-bold">ExitGate</text>
<text x="180" y="139" text-anchor="middle" class="d-small">system under test</text>
<path d="M70 216 V152" class="d-good" marker-end="url(#tdio-arrow-g)"/>
<path d="M165 148 V212" class="d-accent" marker-end="url(#tdio-arrow-a)"/>
<path d="M195 216 V152" class="d-good" marker-end="url(#tdio-arrow-g)"/>
<path d="M290 148 V212" class="d-accent" marker-end="url(#tdio-arrow-a)"/>
<rect x="20" y="216" width="100" height="52" rx="6" class="d-box"/>
<text x="70" y="238" text-anchor="middle" class="d-small d-bold">Clock</text>
<text x="70" y="256" text-anchor="middle" class="d-mono d-small">Now</text>
<rect x="130" y="216" width="100" height="52" rx="6" class="d-box"/>
<text x="180" y="238" text-anchor="middle" class="d-small d-bold">Ticket store</text>
<text x="180" y="256" text-anchor="middle" class="d-mono d-small">Find, Save</text>
<rect x="240" y="216" width="100" height="52" rx="6" class="d-box"/>
<text x="290" y="238" text-anchor="middle" class="d-small d-bold">Terminal</text>
<text x="290" y="256" text-anchor="middle" class="d-mono d-small">Charge</text>
<text x="70" y="290" text-anchor="middle" class="d-small d-text-good">indirect input</text>
<text x="180" y="290" text-anchor="middle" class="d-small d-muted">both</text>
<text x="290" y="290" text-anchor="middle" class="d-small d-text-accent">indirect output</text>
<text x="70" y="310" text-anchor="middle" class="d-bold">stub</text>
<text x="180" y="310" text-anchor="middle" class="d-bold">fake</text>
<text x="290" y="310" text-anchor="middle" class="d-bold">spy or mock</text>
<text x="20" y="340" class="d-small d-muted">Up arrows: data a collaborator feeds to the gate.</text>
<text x="20" y="358" class="d-small d-muted">Down arrows: what the gate does to a collaborator.</text>
</svg>
<figcaption>Figure 1. The test sees only the top two arrows. A stub takes control of an upward arrow; a spy or a mock watches a downward one; a fake handles both by really working.</figcaption>
</figure>

## Five doubles, written by hand

Each double below is an ordinary class that implements one of the three interfaces. The tests use a helper, `Check.Test(name, body)`, that runs the body and prints `PASS` or `FAIL`. It is about twenty lines long and sits at the bottom of the complete program.

Every test shares this setup: ticket T-17 entered at 09:00, and the usual "now" is 11:40, which is 160 minutes later. That is three started hours, so the fee is 6.00.

```csharp snippet of=gate
var entered = new DateTime(2026, 3, 2, 9, 0, 0);
var ticket = new Ticket(
    "T-17", entered, Exited: null);
var at1140 = new StubClock(
    entered.AddMinutes(160));
```

### Dummy: fills a parameter

When the ticket is unknown, the gate returns before it touches the terminal, yet the constructor still demands one. A dummy satisfies the compiler and nothing else. In C#, `null!` would do; a class that throws is a little better, because if the gate ever does reach the terminal on this path the test fails with a message instead of a `NullReferenceException`.

```csharp snippet of=gate
class DummyTerminal : IPaymentTerminal
{
    public bool Charge(string card, decimal amount) =>
        throw new NotSupportedException(
            "dummy terminal was used");
}
```

```csharp snippet of=gate
Check.Test("dummy: unknown ticket", () =>
{
    var gate = new ExitGate(
        at1140,
        new InMemoryTicketStore(),
        new DummyTerminal());

    var result = gate.Process("T-99", "card-1");

    Check.Equal(GateResult.UnknownTicket, result);
});
```

### Stub: controls what the gate is told

A stub returns canned answers, which puts an indirect input under the test's control. `StubClock` pins the time. `StubTerminal` decides whether the card is approved, and that is how a test reaches the `Declined` branch without a real declined card.

```csharp snippet of=gate
class StubClock(DateTime now) : IClock
{
    public DateTime Now => now;
}

class StubTerminal(bool approves) : IPaymentTerminal
{
    public bool Charge(string card, decimal amount) =>
        approves;
}
```

```csharp snippet of=gate
Check.Test("stub: declined card", () =>
{
    var store = new InMemoryTicketStore(ticket);
    var gate = new ExitGate(
        at1140,
        store,
        new StubTerminal(approves: false));

    var result = gate.Process("T-17", "card-1");

    Check.Equal(GateResult.Declined, result);
    Check.Equal(null, store.Find("T-17")!.Exited);
});
```

Notice what the assertions look at: the gate's return value and the state of the store. Nothing is asserted about the stub. A stub cannot fail a test; it only steers the code down the path whose result the test then checks.

### Spy: records what the gate did

The stub tests never checked the amount. `StubTerminal` would approve a charge of 600.00 as happily as 6.00, and the amount is not visible in `GateResult`. It is an indirect output, so the test needs an observation point. A spy is a stub that also writes down how it was called, for the test to read afterwards.

```csharp snippet of=gate
class SpyTerminal : IPaymentTerminal
{
    public List<Payment> Charges { get; } = [];

    public bool Charge(string card, decimal amount)
    {
        Charges.Add(new(card, amount));
        return true;
    }
}
```

```csharp snippet of=gate
Check.Test("spy: 160 minutes costs 6.00", () =>
{
    var terminal = new SpyTerminal();
    var gate = new ExitGate(
        at1140,
        new InMemoryTicketStore(ticket),
        terminal);

    gate.Process("T-17", "card-1");

    Check.Equal(1, terminal.Charges.Count);
    Check.Equal(
        new Payment("card-1", 6.00m),
        terminal.Charges[0]);
});
```

The test keeps the familiar arrange, act, assert order. The spy has no opinion about what should have happened; the test reads the recording and decides.

### Mock: knows in advance what should happen

A mock is told *before* the act what calls to expect, and it does the checking itself. A call that does not match fails at the moment it is made; a call that never arrives is caught by `Verify()` at the end.

```csharp snippet of=gate
class MockTerminal : IPaymentTerminal
{
    readonly Queue<Payment> expected = new();

    public void Expect(string card, decimal amount) =>
        expected.Enqueue(new(card, amount));

    public bool Charge(string card, decimal amount)
    {
        var actual = new Payment(card, amount);
        if (expected.Count == 0)
            throw new CheckFailed(
                $"unexpected {actual}");
        Check.Equal(expected.Dequeue(), actual);
        return true;
    }

    public void Verify()
    {
        if (expected.Count > 0)
            throw new CheckFailed(
                $"never got {expected.Peek()}");
    }
}
```

```csharp snippet of=gate
Check.Test("mock: 160 minutes costs 6.00", () =>
{
    var terminal = new MockTerminal();
    terminal.Expect("card-1", 6.00m);
    var gate = new ExitGate(
        at1140,
        new InMemoryTicketStore(ticket),
        terminal);

    gate.Process("T-17", "card-1");

    terminal.Verify();
});
```

This test and the spy test check the same fact. The difference is who holds the expectation and when it is compared, which the next section looks at more closely.

### Fake: a working implementation with a shortcut

The ticket store has been a fake all along. It is not scripted by the test. It really stores and finds tickets, using a dictionary where production uses a database, which is the shortcut that makes it unfit for production and ideal for tests.

```csharp snippet of=gate
class InMemoryTicketStore(params Ticket[] seed)
    : ITicketStore
{
    readonly Dictionary<string, Ticket> byId =
        seed.ToDictionary(t => t.Id);

    public Ticket? Find(string id) =>
        byId.GetValueOrDefault(id);

    public void Save(Ticket ticket) =>
        byId[ticket.Id] = ticket;
}
```

Because the fake has behavior, a test can run a scenario that spans several calls. Here the second `Process` sees what the first one saved:

```csharp snippet of=gate
Check.Test("fake: a ticket works once", () =>
{
    var store = new InMemoryTicketStore(ticket);
    var gate = new ExitGate(
        at1140,
        store,
        new StubTerminal(approves: true));

    var first = gate.Process("T-17", "card-1");
    var second = gate.Process("T-17", "card-1");

    Check.Equal(GateResult.Open, first);
    Check.Equal(GateResult.AlreadyUsed, second);
});
```

A stub store could not support this test without the test scripting it twice ("first return the open ticket, then return the closed one"), at which point the test is describing the store's behavior instead of the gate's.

All five tests pass (the first five lines of the program's output). Side by side, the five kinds differ in what the test uses them for:

| Kind | The test uses it to | Can it fail the test? |
|---|---|---|
| Dummy | fill a parameter | no (it is never called) |
| Stub | feed the code canned answers | no |
| Spy | record calls, assert on them later | no; the test's asserts do |
| Mock | check calls against expectations | yes, by itself |
| Fake | behave like the real thing, cheaply | no |

The kind is a role in a test, not a property of a class. `SpyTerminal` is a spy in the 6.00 test. In a test that never reads `Charges` it would be doing a stub's job, and nothing about the class would have changed.

::::exercise[Name the double]
Classify each of these. One of them is not a double at all.

1. An `IWeatherService` implementation whose `TemperatureAt` always returns 31.
2. An `ISmsSender` whose `Send` appends to a public list; the test ends with an assertion on that list.
3. `NullLogger.Instance` passed to a constructor because the test does not care about logging.
4. An `IOrderRepository` backed by a `List<Order>`, with working `Add`, `Remove` and `FindByCustomer`.
5. The real `Tariff.FeeFor` used inside the gate tests.
6. An `IAuditLog` set up with "expect `Record("exit", "T-17")` exactly once", followed by `Verify()`.

:::solution
1. Stub: a canned answer for an indirect input.
2. Spy: it records, and the test asserts afterwards.
3. Dummy in this test. (The class is a Null Object, a production pattern, but in a test that ignores logging it only fills a parameter.)
4. Fake: a working implementation with a shortcut (no database).
5. Not a double: it is the real collaborator, which is the right choice when the real thing is fast and deterministic.
6. Mock: expectations first, verification by the double.
:::
::::

## Mock vs. stub: two different kinds of test

A stub and a mock do not differ by how they are built; both can come from the same library call, as a later section shows. They differ in the kind of test they produce. Fowler's [Mocks Aren't Stubs](https://martinfowler.com/articles/mocksArentStubs.html) gives the two kinds names:

- **State verification**: run the code, then examine the result and the state of the objects involved. The declined-card test does this. It would still pass if the gate were rewritten to talk to the terminal in some other way, as long as the driver ends up declined and the ticket still open.
- **Behavior verification**: check that the code made the right calls to its collaborators. The mock test does this. Fowler's observation is that only mocks insist on this style; the other four kinds of double can be used with state verification, and usually are.

A spy sits between the two. It verifies behavior (a call was made with these arguments), but in the shape of a state-verifying test: the expectation is written after the act, as an ordinary assertion.

<figure class="diagram">
<svg viewBox="0 0 360 330" role="img" aria-labelledby="tdsm-title tdsm-desc">
<title id="tdsm-title">When a spy test and a mock test can fail</title>
<desc id="tdsm-desc">Two rows of three steps. With a spy, the steps are arrange, act and assert, and only the assert step can fail. With a mock, expectations are set during arrange, each call is checked during the act, and a final verify step catches missing calls, so two of the three steps can fail.</desc>
<text x="20" y="24" class="d-bold">Test with a spy</text>
<rect x="20" y="36" width="100" height="52" rx="6" class="d-box"/>
<text x="70" y="58" text-anchor="middle" class="d-small d-bold">1 Arrange</text>
<text x="70" y="76" text-anchor="middle" class="d-small">empty spy</text>
<rect x="130" y="36" width="100" height="52" rx="6" class="d-box"/>
<text x="180" y="58" text-anchor="middle" class="d-small d-bold">2 Act</text>
<text x="180" y="76" text-anchor="middle" class="d-small">calls recorded</text>
<rect x="240" y="36" width="100" height="52" rx="6" class="d-box-bad"/>
<text x="290" y="58" text-anchor="middle" class="d-small d-bold">3 Assert</text>
<text x="290" y="76" text-anchor="middle" class="d-small">test reads list</text>
<text x="20" y="110" class="d-small d-muted">Can fail only in step 3, in the test's own code.</text>
<text x="20" y="128" class="d-small d-muted">The expectation is the last thing you read.</text>
<text x="20" y="176" class="d-bold">Test with a mock</text>
<rect x="20" y="188" width="100" height="52" rx="6" class="d-box"/>
<text x="70" y="210" text-anchor="middle" class="d-small d-bold">1 Arrange</text>
<text x="70" y="228" text-anchor="middle" class="d-small">expect calls</text>
<rect x="130" y="188" width="100" height="52" rx="6" class="d-box-bad"/>
<text x="180" y="210" text-anchor="middle" class="d-small d-bold">2 Act</text>
<text x="180" y="228" text-anchor="middle" class="d-small">calls checked</text>
<rect x="240" y="188" width="100" height="52" rx="6" class="d-box-bad"/>
<text x="290" y="210" text-anchor="middle" class="d-small d-bold">3 Verify</text>
<text x="290" y="228" text-anchor="middle" class="d-small">none missing?</text>
<text x="20" y="262" class="d-small d-muted">A wrong call fails in step 2, inside the gate's</text>
<text x="20" y="280" class="d-small d-muted">call stack. A missing call fails in step 3, but</text>
<text x="20" y="298" class="d-small d-muted">only if the test remembers to call Verify.</text>
</svg>
<figcaption>Figure 2. Red boxes are the steps that can fail. A mock moves the expectation to the front of the test and part of the checking into the act.</figcaption>
</figure>

Failing inside the act has one real advantage: the exception is thrown from within `ExitGate.Process`, so the stack trace points at the line that made the wrong call. With a spy you learn only that the recording is wrong. The price is a test that reads out of order (the expected result appears before the action that produces it) and a third step that is easy to leave out.

::::exercise[A mock test that cannot fail]
`ReminderJob` should text everyone whose appointment is *tomorrow*. It has a bug, and this test passes anyway. Find the bug in the job and, more importantly, the bug in the test.

```csharp run
var today = new DateOnly(2026, 3, 2);
Appointment[] booked =
[
    new("555-0101", today.AddDays(1)),
    new("555-0102", today.AddDays(9)),
];

var sms = new MockSms();
sms.Expect("555-0101");

new ReminderJob(sms).Run(booked, today);

Console.WriteLine("PASS  reminds tomorrow's bookings");

record Appointment(string Phone, DateOnly Date);

interface ISmsSender { void Send(string phone); }

class ReminderJob(ISmsSender sms)
{
    public void Run(Appointment[] booked, DateOnly today)
    {
        foreach (var a in booked)
            if (a.Date == today)
                sms.Send(a.Phone);
    }
}

class MockSms : ISmsSender
{
    readonly Queue<string> expected = new();

    public void Expect(string phone) =>
        expected.Enqueue(phone);

    public void Send(string phone)
    {
        if (expected.Count == 0 || expected.Dequeue() != phone)
            throw new InvalidOperationException(
                $"unexpected Send({phone})");
    }

    public void Verify()
    {
        if (expected.Count > 0)
            throw new InvalidOperationException(
                $"never received Send({expected.Peek()})");
    }
}
```

```text output
PASS  reminds tomorrow's bookings
```

:::solution
The job compares against `today` instead of `today.AddDays(1)`, so with this data it sends nothing. The mock only complains about calls it *receives*, and it received none. The test never calls `sms.Verify()`, so the unmet expectation is never noticed: as written, the test passes for any job that stays silent.

Add `sms.Verify();` after the call to `Run`. The program then ends with an unhandled `InvalidOperationException` whose message is `never received Send(555-0101)`, which is the failure the test should have produced all along. Then fix the job: `a.Date == today.AddDays(1)`.

The same trap exists with libraries. In Moq, a `Setup` on a default (loose) mock is only a stub; nothing fails until the test calls `Verify` ([Moq Quickstart](https://github.com/devlooped/moq/wiki/Quickstart)). A spy-style test is harder to get wrong this way, because without its final assertion it visibly asserts nothing.
:::
::::

## Why .NET code calls everything a mock

The five-way vocabulary is not the one you will meet in most .NET codebases, and the mismatch is a large part of the confusion.

Microsoft's own [unit testing guidance](https://learn.microsoft.com/en-us/dotnet/core/testing/unit-testing-best-practices) uses *fake* as the umbrella term (where Meszaros says *test double*), and distinguishes only two roles: a fake you assert against is a mock, and one you do not is a stub. Under that definition this article's `SpyTerminal` is a mock, and `InMemoryTicketStore` has no special name. The page carries a note acknowledging that Fowler and Meszaros use the words more narrowly.

The libraries blur it further. In Moq every double is created with `new Mock<IFoo>()`, whether the test goes on to use it as a stub (`Setup(...).Returns(...)`) or as a mock (`Verify(...)`). NSubstitute declines to choose at all; its [getting-started page](https://nsubstitute.github.io/help/getting-started/) asks why you should bother asking for a stub, mock, fake or spy when you only want a substitute you can control.

So "we mock the repository" in conversation usually means "we replace it with a double of some kind". That is harmless as long as you can still answer the question the names were invented for: *is this test checking the result, or checking the calls?*

## What a mocking library writes for you

A mocking library generates the class at run time. Here is the 6.00 test again with [NSubstitute](https://nsubstitute.github.io/help/getting-started/) supplying all three doubles, as one file-based program:

```csharp run id=nsub
#:package NSubstitute@5.3.0
#:property PublishAot=false
using NSubstitute;

var entered = new DateTime(2026, 3, 2, 9, 0, 0);

var clock = Substitute.For<IClock>();
clock.Now.Returns(
    entered.AddMinutes(160));

var tickets = Substitute.For<ITicketStore>();
tickets.Find("T-17").Returns(
    new Ticket("T-17", entered, Exited: null));

var terminal = Substitute.For<IPaymentTerminal>();
terminal.Charge("card-1", 6.00m).Returns(true);

var gate = new ExitGate(clock, tickets, terminal);
Console.WriteLine(gate.Process("T-17", "card-1"));

terminal.Received(1).Charge("card-1", 6.00m);
tickets.Received(1).Save(
    Arg.Is<Ticket>(t => t.Exited != null));
Console.WriteLine("both calls verified");

// The same ticket, a second time:
Console.WriteLine(gate.Process("T-17", "card-1"));

// ----- the same production code, made public -----

public record Ticket(
    string Id, DateTime Entered, DateTime? Exited);

public enum GateResult
{
    Open, UnknownTicket, AlreadyUsed, Declined
}

public interface IClock { DateTime Now { get; } }

public interface ITicketStore
{
    Ticket? Find(string id);
    void Save(Ticket ticket);
}

public interface IPaymentTerminal
{
    bool Charge(string card, decimal amount);
}

static class Tariff
{
    public static decimal FeeFor(TimeSpan stay) =>
        stay.TotalMinutes <= 30
            ? 0m
            : 2.00m * (decimal)Math.Ceiling(stay.TotalHours);
}

class ExitGate(
    IClock clock,
    ITicketStore tickets,
    IPaymentTerminal terminal)
{
    public GateResult Process(
        string ticketId, string card)
    {
        var ticket = tickets.Find(ticketId);
        if (ticket is null)
            return GateResult.UnknownTicket;
        if (ticket.Exited is not null)
            return GateResult.AlreadyUsed;

        var now = clock.Now;
        var stay = now - ticket.Entered;
        var fee = Tariff.FeeFor(stay);
        var paid = fee == 0
            || terminal.Charge(card, fee);
        if (!paid) return GateResult.Declined;

        tickets.Save(
            ticket with { Exited = now });
        return GateResult.Open;
    }
}
```

```text output
Open
both calls verified
Open
```

:::note
This ran with NSubstitute 5.3.0 on the .NET 10 SDK. The `PublishAot=false` line is needed only because this is a file-based program: those enable native AOT by default ([File-based apps](https://learn.microsoft.com/en-us/dotnet/core/sdk/file-based-apps)), and without the line this program stopped here with a `PlatformNotSupportedException` saying that dynamic code generation is not supported. A normal test project does not need it. The interfaces are `public` so that the generated classes can implement them.
:::

Mapped onto the hand-written versions:

- `clock.Now.Returns(...)` is `StubClock`. A four-line class became one statement of setup.
- `terminal.Received(1).Charge(...)` is `SpyTerminal` plus its two assertions: the substitute recorded every call, and the check comes after the act. A failed check throws `ReceivedCallsException`, whose message lists the calls that were received ([NSubstitute: Checking received calls](https://nsubstitute.github.io/help/received-calls/)). So in Meszaros's terms NSubstitute makes stubs and spies. Moq's `MockBehavior.Strict`, which throws on any call without a matching setup, is the closer relative of `MockTerminal`.
- `Arg.Is<Ticket>(...)` is an argument matcher: the test says only "some ticket with an exit time" instead of spelling out the whole record.

The last line of output is the instructive one. The second `Process` for the same ticket printed `Open`, not `AlreadyUsed`, and the gate is not at fault. The substitute store accepted `Save` and did nothing with it, so `Find` keeps returning the open ticket it was scripted to return. A library gives you stubs and spies for free. It does not give you a fake, because a fake's value is behavior that somebody has to write.

That suggests a division of labor:

- **A library earns its place** when interfaces are wide (a hand-written stub must implement all twelve members to control one), when many tests each need a slightly different one-off stub, and when argument matchers keep assertions short.
- **A hand-written double earns its place** when it will be reused across many tests, when it needs real behavior (any fake), or when a named class such as `DeclinedCardTerminal` reads better than four lines of setup repeated in thirty tests.

## Over-mocking: a test that fails when nothing is wrong

A generated double makes behavior verification nearly free to write, and it is tempting to verify everything. The cost shows up later. The second half of the complete program runs two tests of the same scenario (T-17, 160 minutes, card approved) against three versions of the gate:

- **Gate A** is the original `ExitGate`.
- **Gate B** is a refactoring: it reads the clock at the top of `Process`, so that one request uses one timestamp throughout. No caller can tell the difference.
- **Gate C** has a real bug: it charges the card and opens, but never saves the ticket as exited, so the same ticket works again.

The state-based test uses the stub clock, fake store and spy terminal from before, and asserts on the result, the stored exit time and the recorded charge. The strict mock test replaces all three collaborators with mocks that report to one shared `Script`, an ordered list of every call the original gate makes:

```csharp snippet of=gate
    var script = new Script(
        "tickets.Find T-17",
        "clock.Now",
        "terminal.Charge card-1 6.00",
        "tickets.Save T-17");
```

`Script.Got` throws as soon as a call differs from the next one on the list, and `Verify` throws if the list was not used up. The only difference between the gates that matters here is the first line of Gate B:

```csharp snippet of=gate
// Same behavior as ExitGate. The clock is read first, so
// one request uses one timestamp from start to finish.
class GateB(
    // ...
    public GateResult Process(
        string ticketId, string card)
    {
        var now = clock.Now;

        var ticket = tickets.Find(ticketId);
        // ...
```

The results, copied from the second half of the program's output:

| Gate | State-based test | Strict mock test |
|---|---|---|
| A, original | pass | pass |
| B, harmless refactoring | pass | **fail** |
| C, real bug | fail | fail |

Both tests catch the bug. Only the strict mock test also fails on Gate B, with the message `call 1 was clock.Now`, `expected tickets.Find T-17`: a complaint about the order of two reads that no user, and no other part of the system, can observe. The test has not protected any behavior here. It has restated the method body in a different notation, so every change to the body must be made twice. Fowler describes this as mockist tests being more coupled to the implementation of a method; *Software Engineering at Google* says such tests leak implementation details and become brittle.

This example is deliberately extreme. It is strict, ordered, and verifies every call, and a looser mock that checked only `Charge` and `Save` would have survived Gate B. But each verified call is a constraint on the implementation, so the question to ask of each one is whether it is a requirement. The Google chapter's rule of thumb sorts them quickly: verify interactions only for *state-changing* calls, the ones whose absence or repetition would matter to the outside world.

- `terminal.Charge` moves money. Charging twice or not at all is a defect no matter what `Process` returns. Verifying it (with a spy or a mock) is right, and there is no state the test could inspect instead.
- `tickets.Save` changes state too, but with a fake store the test can simply look at the state afterwards, which is what the state-based test does.
- `tickets.Find` and `clock.Now` are queries. Whether they are called once, twice or in a different order has no effect on anything. Stub them and never verify them.

Signs that a test suite has drifted into over-mocking:

- tests fail after refactorings that changed no behavior, and are "fixed" by editing expectations to match the new code;
- a test's setup mirrors the method body line for line;
- stubs return other stubs (`a.GetB().GetC().Value`), which means the test knows the object graph better than the code does;
- value objects and simple data (`Ticket`, a `DateTime`, a list) are being replaced with doubles instead of constructed.

::::exercise[Loosen the strict test]
Rewrite the strict mock test's expectations so that it still fails for Gate C and passes for Gates A and B, using the same `Script` idea. Which of the four expected calls must go, and what must change about how the remaining ones are matched?

:::solution
Drop `tickets.Find T-17` and `clock.Now`: they are queries, and their count and order are implementation details. Keep `terminal.Charge card-1 6.00` and `tickets.Save T-17`.

Removing them from the list is not enough, because `Script.Got` treats any call that is not next on the list as an error, so `ScriptedStore.Find` and `ScriptedClock.Now` must stop reporting to the script at all (in library terms: a loose mock instead of a strict one). At that point the clock and the `Find` half of the store are plain stubs, and only the two state-changing calls are verified. Whether to keep their relative order is a judgment call: "charge before marking the ticket used" is defensible as a requirement, since the reverse order would let a declined driver out.

Even so, the state-based test remains stronger on `Save`. The scripted store checks only the ticket id, so it would accept a gate that saves the ticket without an exit time.
:::
::::

## Choosing a double

Start from what the test needs from the collaborator, and take the first answer that fits.

1. **Can the test use the real thing?** If it is fast, deterministic and has no side effects outside the process (`Tariff`, a `List<T>`, a value object), use it. The Google chapter states the preference outright: a real implementation over a test double, because the test then runs the code that production runs.
2. **Does the test not care about it at all?** Pass a dummy.
3. **Does the code need particular answers from it to reach the path under test** (a time, a declined card, a thrown `TimeoutException`)? Use a stub, and assert on results, not on the stub.
4. **Is a side effect on it the very thing being tested** (money charged, email sent, message published), with no state to inspect afterwards? Use a spy, or a mock if failing at the point of the call is worth the inverted test. Verify the state-changing calls only.
5. **Do several tests need it to behave consistently across calls** (save then find, enqueue then dequeue)? Use a fake.

### A fake is code, and code has bugs

A fake is only useful if it behaves like the real implementation in the ways the tests rely on, which the Google chapter calls *fidelity*. It recommends that the team owning the real implementation also own the fake, and that one set of *contract tests* run against both. If the fake drifts, a contract test fails, instead of every test built on the fake quietly passing against behavior production does not have.

:::dotnet
The base class library ships a seam for time, and a fake to go with it. `TimeProvider` (in .NET 8 and later) is an abstract class with `GetUtcNow()`, timestamps and timers, and `TimeProvider.System` is the real one. The `Microsoft.Extensions.TimeProvider.Testing` package adds `FakeTimeProvider`, whose clock moves only when the test sets or advances it ([TimeProvider overview](https://learn.microsoft.com/en-us/dotnet/standard/datetime/timeprovider-overview)). In new code, prefer taking a `TimeProvider` over defining your own `IClock`: `Task.Delay` and `CancellationTokenSource` accept one as well, so timeouts can be tested without waiting.
:::

::::exercise[Write the contract the fake must honor]
Suppose `ITicketStore.Save` is documented as *update only*: the production store runs an SQL `UPDATE`, and throws `KeyNotFoundException` when no row matches the ticket id. Write a `Contract.Run(name, create)` method that takes a factory for any `ITicketStore` and checks three rules: an unknown id is not found, `Find` returns what `Save` stored, and `Save` rejects an unknown id. Run it against this article's `InMemoryTicketStore`, then fix what it finds.

:::solution
The fake breaks the third rule: its `Save` uses the dictionary indexer, which inserts. A gate that saved a ticket under the wrong id would pass every test built on this fake and throw in production. `StrictTicketStore` closes the gap.

```csharp run
Contract.Run("InMemoryTicketStore",
    seed => new InMemoryTicketStore(seed));
Contract.Run("StrictTicketStore",
    seed => new StrictTicketStore(seed));

static class Contract
{
    public static void Run(
        string name, Func<Ticket[], ITicketStore> create)
    {
        Console.WriteLine(name);
        var entered = new DateTime(2026, 3, 2, 9, 0, 0);
        var open = new Ticket("T-17", entered, Exited: null);
        var closed = open with { Exited = entered.AddHours(1) };

        Rule("unknown id is not found",
            () => create([open]).Find("T-99") is null);

        Rule("Find returns what Save stored", () =>
        {
            var store = create([open]);
            store.Save(closed);
            return store.Find("T-17") == closed;
        });

        Rule("Save rejects an unknown id", () =>
        {
            try
            {
                create([]).Save(open);
                return false;
            }
            catch (KeyNotFoundException)
            {
                return true;
            }
        });
    }

    static void Rule(string rule, Func<bool> holds) =>
        Console.WriteLine(
            $"  {(holds() ? "ok  " : "FAIL")}  {rule}");
}

record Ticket(string Id, DateTime Entered, DateTime? Exited);

interface ITicketStore
{
    Ticket? Find(string id);
    void Save(Ticket ticket);
}

class InMemoryTicketStore(params Ticket[] seed) : ITicketStore
{
    protected readonly Dictionary<string, Ticket> ById =
        seed.ToDictionary(t => t.Id);

    public Ticket? Find(string id) =>
        ById.GetValueOrDefault(id);

    public virtual void Save(Ticket ticket) =>
        ById[ticket.Id] = ticket;
}

class StrictTicketStore(params Ticket[] seed)
    : InMemoryTicketStore(seed)
{
    public override void Save(Ticket ticket)
    {
        if (!ById.ContainsKey(ticket.Id))
            throw new KeyNotFoundException(ticket.Id);
        base.Save(ticket);
    }
}
```

```text output
InMemoryTicketStore
  ok    unknown id is not found
  ok    Find returns what Save stored
  FAIL  Save rejects an unknown id
StrictTicketStore
  ok    unknown id is not found
  ok    Find returns what Save stored
  ok    Save rejects an unknown id
```

The production store's own test project calls the same `Contract.Run` with a factory that creates the database-backed store; that second call is what keeps the two in step. The contract is also the place to write down what the fake deliberately does *not* imitate (durability across restarts, concurrent writers), so that nobody tests those properties against it by mistake.
:::
::::

Doubles make a unit test possible, but they also mean the gate has never been tested against a real terminal or a real database. Meszaros makes the same point in his description of the pattern (chapter 23): a test that uses doubles exercises a configuration that production never runs, so at least one test should cover the real assembly. That is the job of an integration test, and it is the one check no double can replace.
