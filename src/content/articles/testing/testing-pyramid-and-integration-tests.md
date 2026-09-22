---
title: "Unit vs. Integration Tests: The Pyramid, the Trophy, and SQLite"
description: "Unit, integration and end-to-end tests defined precisely; the pyramid vs. the testing trophy; a real xUnit test against SQLite; and what makes tests flaky."
pillar: testing
order: 4
author: markus
published: 2026-09-22
updated: 2026-09-22
level: intermediate
tags: [integration-testing, unit-testing, testing-pyramid, sqlite, flaky-tests]
prerequisites: ["testing/unit-testing-fundamentals", "testing/test-doubles"]
sources:
  - title: "The Forgotten Layer of the Test Automation Pyramid"
    url: "https://www.mountaingoatsoftware.com/blog/the-forgotten-layer-of-the-test-automation-pyramid"
    publisher: "Mike Cohn, Mountain Goat Software"
    accessed: 2026-09-22
  - title: "TestPyramid"
    url: "https://martinfowler.com/bliki/TestPyramid.html"
    publisher: "Martin Fowler"
    accessed: 2026-09-22
  - title: "Write tests. Not too many. Mostly integration."
    url: "https://kentcdodds.com/blog/write-tests"
    publisher: "Kent C. Dodds"
    accessed: 2026-09-22
  - title: "Eradicating Non-Determinism in Tests"
    url: "https://martinfowler.com/articles/nonDeterminism.html"
    publisher: "Martin Fowler"
    accessed: 2026-09-22
  - title: "Testing in .NET: test types"
    url: "https://learn.microsoft.com/en-us/dotnet/core/testing/"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Integration tests in ASP.NET Core"
    url: "https://learn.microsoft.com/en-us/aspnet/core/test/integration-tests"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "EF Core: Choosing a testing strategy"
    url: "https://learn.microsoft.com/en-us/ef/core/testing/choosing-a-testing-strategy"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Overview - Microsoft.Data.Sqlite"
    url: "https://learn.microsoft.com/en-us/dotnet/standard/data/sqlite/"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "In-Memory Databases"
    url: "https://sqlite.org/inmemorydb.html"
    publisher: "SQLite"
    accessed: 2026-09-22
  - title: "Running Tests in Parallel"
    url: "https://xunit.net/docs/running-tests-in-parallel"
    publisher: "xUnit.net"
    accessed: 2026-09-22
  - title: "Getting Started with xUnit.net v3"
    url: "https://xunit.net/docs/getting-started/v3/getting-started"
    publisher: "xUnit.net"
    accessed: 2026-09-22
  - title: "Just Say No to More End-to-End Tests"
    url: "https://testing.googleblog.com/2015/04/just-say-no-to-more-end-to-end-tests.html"
    publisher: "Mike Wacker, Google Testing Blog"
    accessed: 2026-09-22
  - title: "File-based apps"
    url: "https://learn.microsoft.com/en-us/dotnet/core/sdk/file-based-apps"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
draft: false
---

"Unit test" and "integration test" get used loosely enough that two developers can agree a suite needs "more integration tests" and mean different things by it. This article pins the terms down, traces where the usual picture of test proportions came from, looks at a real objection to it, and then builds an integration test against a real database so the difference stops being abstract.

## What actually distinguishes a unit test from an integration test?

Microsoft's own testing overview draws the line at what is real underneath the call: "A unit test is a test that exercises individual software components or methods... They don't test infrastructure concerns. Infrastructure concerns include interacting with databases, file systems, and network resources." An integration test, by contrast, "exercises two or more software components' ability to function together... Often, integration tests do include infrastructure concerns" ([Testing in .NET](https://learn.microsoft.com/en-us/dotnet/core/testing/)). The ASP.NET Core testing guide phrases the same boundary from the other side: integration tests "confirm that two or more app components work together to produce an expected result, possibly including every component required to fully process a request," and lists the database, the file system, network appliances and the request-response pipeline as the infrastructure a unit test is not allowed to touch ([Integration tests in ASP.NET Core](https://learn.microsoft.com/en-us/aspnet/core/test/integration-tests)).

So the axis is not size, speed or how many `Assert` calls a test makes; it is whether the collaborators are real. A unit test replaces slow or nondeterministic dependencies with [test doubles](/testing/test-doubles/) so it can run in isolation, in milliseconds, as many times as you like. An integration test lets at least one of those dependencies be the real thing, which is the only way to learn whether the code and that dependency actually agree with each other, not just with a test author's idea of how the dependency behaves.

An end-to-end test goes further again: it drives the deployed system from the outside, usually through the same interface a user would use (a browser, an HTTP client, a CLI), with every internal component real and wired together. Nothing is faked, so it is the only kind of test that can catch a wiring mistake between two real components that no other test exercises — and also the only kind that pays for a database, a network and a full running process on every run.

| | What's real | What's usually faked | Typical run time |
|---|---|---|---|
| Unit | The code under test | Database, network, clock, other services | Microseconds to low milliseconds |
| Integration | The code plus one or more real collaborators (a database, a file system) | Everything further out (other services, the network boundary) | Milliseconds to low seconds |
| End-to-end | The whole deployed system | Nothing | Seconds to minutes |

## Where does the "testing pyramid" come from?

Mike Cohn described the shape in *Succeeding with Agile* (2009) and again on his own site: "Unit testing should be the foundation of a solid test automation strategy and as such represents the largest part of the pyramid," with a middle layer of service-level tests and, "at the top of the test automation pyramid because we want to do as little of it as possible," automated tests driven through the user interface ([The Forgotten Layer of the Test Automation Pyramid](https://www.mountaingoatsoftware.com/blog/the-forgotten-layer-of-the-test-automation-pyramid)). His warning about skipping the middle layer is specific: without it, "all other testing ends up being performed through the user interface, resulting in tests that are expensive to run, expensive to write, and brittle."

Martin Fowler's widely read treatment credits Cohn as the person who popularized the diagram, while tracing the idea further back: Cohn "originally drew it in conversation with Lisa Crispin in 2003-4," and Jason Huggins "independently came up with the same idea around 2006" ([TestPyramid](https://martinfowler.com/bliki/TestPyramid.html)). Fowler is also explicit about the assumption the whole shape rests on: "The pyramid is based on the assumption that broad-stack tests are expensive, slow, and brittle compared to more focused tests, such as unit tests. While this is usually true, there are exceptions."

The reasoning is economic, not aesthetic. Cheap, fast, reliable tests should be the largest layer because you can afford to run thousands of them on every save; expensive, slow, brittle tests should be the smallest layer because you can only afford a few. A test's position in the pyramid is a statement about its cost, and the pyramid's shape is a claim about how many tests that cost buys you confidence in.

## What do critics say is wrong with it?

Kent C. Dodds' 2019 post "Write tests. Not too many. Mostly integration." names the objection in its title and proposes an alternative shape, the **testing trophy**: a thin band of static analysis at the bottom, unit tests above that, a wide band of integration tests, and a thin band of end-to-end tests at the top ([Write tests. Not too many. Mostly integration.](https://kentcdodds.com/blog/write-tests)).

His argument is not about speed, it is about what a passing suite tells you. A unit test proves a component behaves correctly on its own; it says nothing about whether the pieces fit. Dodds makes the gap concrete: "It doesn't do you any good if you don't **also** verify that they work together properly... It doesn't matter if your component `<A />` renders component `<B />` with props `c` and `d` if component `<B />` actually breaks if prop `e` is not supplied." He frames the choice as a return on investment: "as you move up the pyramid, the confidence quotient of each form of testing increases. You get more bang for your buck," and singles out the middle layer as the sweet spot — "Integration tests strike a great balance on the trade-offs between confidence and speed/expense" — while end-to-end tests still cost the most and so stay rare. The practical advice that follows is "stop mocking so much stuff": a suite of heavily mocked unit tests can be green while the real components, wired together, are broken.

Two things are true at once here, and worth separating. Dodds does not dispute that end-to-end tests should be few — the top of the trophy is still the smallest band, same as the pyramid. What he disputes is the *pyramid's* allocation between unit and integration, and the definition of "unit" that leans on heavy mocking to get there. The trophy is a claim that, for the kind of application he was writing about (JavaScript UIs, tested with tools that make rendering a real component tree and talking to a real in-memory server cheap), the return on an integration test now beats the return on an isolated, heavily mocked unit test.

<figure class="diagram">
<svg viewBox="0 0 360 456" role="img" aria-labelledby="pyr-title pyr-desc">
<title id="pyr-title">The testing pyramid compared with the testing trophy</title>
<desc id="pyr-desc">Two stacked diagrams. The pyramid narrows going up through three bands: a wide unit band at the bottom, a narrower integration band, and a thin end-to-end band at the top. The trophy has four bands and bulges in the middle: a thin static band at the bottom, a unit band, a wide integration band, and a thin end-to-end band at the top.</desc>
<text x="180" y="20" text-anchor="middle" class="d-bold">The pyramid — Cohn, 2009</text>
<rect x="145" y="30" width="70" height="34" rx="4" class="d-box"/>
<text x="180" y="51" text-anchor="middle" class="d-small d-bold">E2E</text>
<rect x="105" y="72" width="150" height="34" rx="4" class="d-box-accent"/>
<text x="180" y="93" text-anchor="middle" class="d-small d-bold">Integration</text>
<rect x="40" y="114" width="280" height="34" rx="4" class="d-box"/>
<text x="180" y="135" text-anchor="middle" class="d-small d-bold">Unit</text>
<text x="20" y="172" class="d-small d-muted">Narrows going up: fewest end-to-end tests,</text>
<text x="20" y="190" class="d-small d-muted">most unit tests, because they run fastest.</text>
<text x="180" y="224" text-anchor="middle" class="d-bold">The trophy — Dodds, 2019</text>
<rect x="145" y="234" width="70" height="34" rx="4" class="d-box"/>
<text x="180" y="255" text-anchor="middle" class="d-small d-bold">E2E</text>
<rect x="50" y="276" width="260" height="34" rx="4" class="d-box-accent"/>
<text x="180" y="297" text-anchor="middle" class="d-small d-bold">Integration</text>
<rect x="105" y="318" width="150" height="34" rx="4" class="d-box"/>
<text x="180" y="339" text-anchor="middle" class="d-small d-bold">Unit</text>
<rect x="150" y="360" width="60" height="34" rx="4" class="d-box"/>
<text x="180" y="381" text-anchor="middle" class="d-small d-bold">Static</text>
<text x="20" y="418" class="d-small d-muted">Bulges at integration: Dodds argues it gives the</text>
<text x="20" y="436" class="d-small d-muted">best confidence per dollar, so mock less.</text>
</svg>
<figcaption>Figure 1. The accent band is where the two models disagree. Both keep end-to-end tests rare; the trophy widens integration testing (and adds a static-analysis band) at the expense of the pyramid's unit-heavy base.</figcaption>
</figure>

## So which model should you use?

Both models agree on more than the shapes suggest. Neither says to write mostly end-to-end tests — that inversion (few unit tests, most coverage from slow, brittle, whole-system tests) is the failure mode both are reacting against. Google's own testing blog, defending a pyramid shape in 2015, puts a specific number on it: "Google often suggests a 70/20/10 split: 70% unit tests, 20% integration tests, and 10% end-to-end tests. The exact mix will be different for each team, but in general, it should retain that pyramid shape" ([Just Say No to More End-to-End Tests](https://testing.googleblog.com/2015/04/just-say-no-to-more-end-to-end-tests.html)). Dodds' trophy does not publish a competing percentage split at all; it is a claim about which layer deserves your *next* test, not a ratio to hit.

Where they genuinely disagree is the cost side of the calculation, and that cost has moved since 2009. Cohn's book predates tools that make a real, in-process integration test nearly as fast as a unit test: an ASP.NET Core app under `WebApplicationFactory`, talking to a real SQLite database with no network involved, or a browser-based UI rendered against a real in-memory component tree. When an integration test is only slightly slower than a unit test but proves the wiring works, the pyramid's core justification — broad-stack tests are slow and brittle, so write few — weakens for that middle layer specifically, which is exactly the gap the trophy targets. It does not weaken for end-to-end tests, where a real browser, a real deployment and real network calls are still slow and still brittle; that is why both shapes keep that band thin, for reasons this article returns to below.

Practically: in a codebase where "unit test" already means "mock every collaborator," count how many of those tests would break if you renamed a private method versus how many would catch an actual bug. Tests that only break on renames are a cost with no return, and are exactly what the trophy is arguing you should replace with fewer, real integration tests.

::::exercise[Classify the test]
For each test below, decide whether it is a unit test, an integration test or an end-to-end test, and say which real collaborator (if any) makes it that kind.

1. A test that constructs an `OrderTotal` calculator directly and checks it sums three prices correctly.
2. A test that starts the real web application, opens a browser, fills in a checkout form and asserts a confirmation page appears.
3. A test that calls a `CustomerRepository` backed by a real SQLite database and asserts a saved customer can be found again.
4. A test that calls an `OrderService` whose `IPaymentGateway` has been replaced with a hand-rolled stub that always approves.

:::solution
1. Unit test. Nothing outside the calculator is involved.
2. End-to-end test. The browser, the deployed app and the whole request path are all real.
3. Integration test. The code and the database are both real; nothing else is involved.
4. Unit test. `OrderService` is exercised, but its one collaborator that would touch infrastructure (the payment gateway) is a double, so no infrastructure is real. Swapping the double for a real gateway is what would turn this into an integration test.
:::
::::

## What does a real integration test look like?

The clearest way to see the difference is to write one. The following tests exercise a small link-shortener's data-access layer — `LinkRepository`, wrapping a `Links` table — against a real SQLite database that lives only for the duration of each test. Nothing about the SQL is faked: the `CREATE TABLE`, the `INSERT`, the `PRIMARY KEY` constraint and the `UPDATE` all run through SQLite's real query engine.

:::note
Every program on this page was run with the .NET 10 SDK (10.0.401) on Windows 11, x64, resolving `#:package xunit.v3@1.*` to 1.1.0 and `#:package Microsoft.Data.Sqlite@9.*` to 9.0.20 — "a lightweight ADO.NET provider for SQLite" ([Overview - Microsoft.Data.Sqlite](https://learn.microsoft.com/en-us/dotnet/standard/data/sqlite/)). Both packages are ordinary NuGet references in a file-based program, the same mechanism used throughout this pillar ([File-based apps](https://learn.microsoft.com/en-us/dotnet/core/sdk/file-based-apps)); xUnit v3's own getting-started guide documents that its test projects "are stand-alone executables that can be directly run" with `dotnet run`, which is what lets the test programs on this page skip a `.csproj` and `dotnet test` entirely ([Getting Started with xUnit.net v3](https://xunit.net/docs/getting-started/v3/getting-started)).
:::

```csharp run id=link-repo-tests
#:package xunit.v3@1.*
#:package Microsoft.Data.Sqlite@9.*
using Microsoft.Data.Sqlite;
using Xunit;

public class LinkRepositoryTests
{
    static SqliteConnection OpenSchema()
    {
        var connection = new SqliteConnection("Data Source=:memory:");
        connection.Open();
        var create = connection.CreateCommand();
        create.CommandText = """
            CREATE TABLE Links (
                Code TEXT PRIMARY KEY,
                TargetUrl TEXT NOT NULL,
                Clicks INTEGER NOT NULL DEFAULT 0
            );
            """;
        create.ExecuteNonQuery();
        return connection;
    }

    [Fact]
    public void Create_ThenFind_RoundTripsTheTargetUrl()
    {
        using var connection = OpenSchema();
        var repo = new LinkRepository(connection);

        repo.Create("cs101", "https://computerscienceguide.com/testing/");
        var link = repo.Find("cs101");

        Assert.Equal("https://computerscienceguide.com/testing/", link?.TargetUrl);
    }

    [Fact]
    public void Create_DuplicateCode_ThrowsFromTheUniqueConstraint()
    {
        using var connection = OpenSchema();
        var repo = new LinkRepository(connection);
        repo.Create("cs101", "https://computerscienceguide.com/testing/");

        var ex = Assert.Throws<SqliteException>(() =>
            repo.Create("cs101", "https://computerscienceguide.com/other/"));

        Assert.Contains("UNIQUE constraint failed", ex.Message);
    }

    [Fact]
    public void RecordClick_IncrementsTheStoredCount()
    {
        using var connection = OpenSchema();
        var repo = new LinkRepository(connection);
        repo.Create("cs101", "https://computerscienceguide.com/testing/");

        repo.RecordClick("cs101");
        repo.RecordClick("cs101");

        Assert.Equal(2, repo.Find("cs101")?.Clicks);
    }
}

public record Link(string Code, string TargetUrl, int Clicks);

public class LinkRepository(SqliteConnection connection)
{
    public void Create(string code, string targetUrl)
    {
        var cmd = connection.CreateCommand();
        cmd.CommandText = "INSERT INTO Links (Code, TargetUrl) VALUES ($code, $url);";
        cmd.Parameters.AddWithValue("$code", code);
        cmd.Parameters.AddWithValue("$url", targetUrl);
        cmd.ExecuteNonQuery();
    }

    public Link? Find(string code)
    {
        var cmd = connection.CreateCommand();
        cmd.CommandText = "SELECT Code, TargetUrl, Clicks FROM Links WHERE Code = $code;";
        cmd.Parameters.AddWithValue("$code", code);
        using var reader = cmd.ExecuteReader();
        return reader.Read()
            ? new Link(reader.GetString(0), reader.GetString(1), reader.GetInt32(2))
            : null;
    }

    public void RecordClick(string code)
    {
        var cmd = connection.CreateCommand();
        cmd.CommandText = "UPDATE Links SET Clicks = Clicks + 1 WHERE Code = $code;";
        cmd.Parameters.AddWithValue("$code", code);
        cmd.ExecuteNonQuery();
    }
}
```

```text output
xUnit.net v3 In-Process Runner [...]
  Discovering: link-repo-tests
  Discovered:  link-repo-tests
  Starting:    link-repo-tests
  Finished:    link-repo-tests
=== TEST EXECUTION SUMMARY ===
   link-repo-tests  Total: 3, Errors: 0, Failed: 0, Skipped: 0, Not Run: 0, Time: [...]
```

Each test opens its own connection with `Data Source=:memory:` rather than sharing one. SQLite's own documentation explains why that matters: "Every `:memory:` database is distinct from every other," it is "only visible to the database connection that originally opened it," and "the database ceases to exist as soon as the database connection is closed" ([In-Memory Databases](https://sqlite.org/inmemorydb.html)). One connection per test, disposed at the end of the test (the `using` on `connection`), gives each test a database no other test can see or leave data in — isolation for free, from the database engine itself, with no manual cleanup step to forget.

The second test is the one a mocked repository could never produce on its own. `Assert.Throws<SqliteException>` is not testing `LinkRepository`'s logic — the repository has no duplicate-checking code at all. It is testing that the real `Links` table, with `Code TEXT PRIMARY KEY`, really does what a primary key promises. The [Mocks, Stubs and Fakes](/testing/test-doubles/) article makes the general point this test relies on: a double is only as good as the behavior someone remembered to give it, and a schema constraint enforced by SQLite itself needs nobody to remember anything.

### Is testing against SQLite really an integration test?

With one caveat: if your production database is something other than SQLite, this test is closer to what Microsoft's own EF Core documentation calls "SQLite as a database fake" than to testing against production. That page is direct about the gap: "testing against SQLite does not guarantee the same results as against SQL Server, or any other database," and gives a concrete example — "SQL Server does case-insensitive string comparison by default, whereas SQLite is case-sensitive. This can make your tests pass against SQLite where they would fail against SQL Server (or vice versa)" ([Choosing a testing strategy](https://learn.microsoft.com/en-us/ef/core/testing/choosing-a-testing-strategy)). Provider-specific SQL, and functions like SQL Server's `DateDiffDay`, are two more things that pass or fail on SQLite for reasons that have nothing to do with your code.

None of that makes the test above worthless — it still exercises real SQL, real constraints and a real query engine, none of which a hand-rolled fake does, and the same Microsoft page recommends SQLite in-memory precisely for this role when testing the actual production database on every run is not practical ([Integration tests in ASP.NET Core](https://learn.microsoft.com/en-us/aspnet/core/test/integration-tests)). It does mean "the integration test passed" is a claim about the code and SQLite together, not a guarantee about the code and whatever engine runs in production. If your production engine is SQLite itself, that gap is zero. If it is not, the honest reading of a passing suite like this one is "the data-access code is correct SQL against a real relational engine," with a smaller, separate set of tests needed to confirm the production engine agrees on the parts that differ.

::::exercise[Extend the repository]
Add a `Delete(string code)` method to `LinkRepository` that removes a link, and two tests: one proving a known code is gone after `Delete`, and one proving that deleting a code that was never created does not throw.

:::solution
```csharp run id=link-repo-delete
#:package xunit.v3@1.*
#:package Microsoft.Data.Sqlite@9.*
using Microsoft.Data.Sqlite;
using Xunit;

public class LinkRepositoryDeleteTests
{
    static SqliteConnection OpenSchema()
    {
        var connection = new SqliteConnection("Data Source=:memory:");
        connection.Open();
        var create = connection.CreateCommand();
        create.CommandText =
            "CREATE TABLE Links (Code TEXT PRIMARY KEY, TargetUrl TEXT NOT NULL, Clicks INTEGER NOT NULL DEFAULT 0);";
        create.ExecuteNonQuery();
        return connection;
    }

    [Fact]
    public void Delete_KnownCode_RemovesIt()
    {
        using var connection = OpenSchema();
        var repo = new LinkRepository(connection);
        repo.Create("cs101", "https://computerscienceguide.com/testing/");

        repo.Delete("cs101");

        Assert.Null(repo.Find("cs101"));
    }

    [Fact]
    public void Delete_UnknownCode_DoesNothing()
    {
        using var connection = OpenSchema();
        var repo = new LinkRepository(connection);

        repo.Delete("does-not-exist"); // must not throw
    }
}

public record Link(string Code, string TargetUrl, int Clicks);

public class LinkRepository(SqliteConnection connection)
{
    public void Create(string code, string targetUrl)
    {
        var cmd = connection.CreateCommand();
        cmd.CommandText = "INSERT INTO Links (Code, TargetUrl) VALUES ($code, $url);";
        cmd.Parameters.AddWithValue("$code", code);
        cmd.Parameters.AddWithValue("$url", targetUrl);
        cmd.ExecuteNonQuery();
    }

    public Link? Find(string code)
    {
        var cmd = connection.CreateCommand();
        cmd.CommandText = "SELECT Code, TargetUrl, Clicks FROM Links WHERE Code = $code;";
        cmd.Parameters.AddWithValue("$code", code);
        using var reader = cmd.ExecuteReader();
        return reader.Read()
            ? new Link(reader.GetString(0), reader.GetString(1), reader.GetInt32(2))
            : null;
    }

    public void Delete(string code)
    {
        var cmd = connection.CreateCommand();
        cmd.CommandText = "DELETE FROM Links WHERE Code = $code;";
        cmd.Parameters.AddWithValue("$code", code);
        cmd.ExecuteNonQuery();
    }
}
```

```text output
xUnit.net v3 In-Process Runner [...]
  Discovering: link-repo-delete
  Discovered:  link-repo-delete
  Starting:    link-repo-delete
  Finished:    link-repo-delete
=== TEST EXECUTION SUMMARY ===
   link-repo-delete  Total: 2, Errors: 0, Failed: 0, Skipped: 0, Not Run: 0, Time: [...]
```

`DELETE FROM Links WHERE Code = $code` matches zero rows for an unknown code and simply does nothing — no exception, because deleting something that is not there is not an error in SQL. A repository written to throw on a missing row would need that behavior added explicitly; SQLite's `DELETE` does not give it to you for free the way the `PRIMARY KEY` constraint gave the duplicate-rejection test its behavior.
:::
::::

## Why not just mock the repository instead?

A unit test for whatever calls `LinkRepository` should absolutely mock it — that is what makes it a unit test of the caller. The question here is narrower: could the three tests above be rewritten against a hand-rolled fake `LinkRepository`, backed by a `Dictionary`, and prove the same things? For the first and third, mostly yes. For the second, no, unless the fake is taught the rule by hand:

```csharp run id=fidelity-gap
#:package Microsoft.Data.Sqlite@9.*
using Microsoft.Data.Sqlite;

Report("real SQLite", TryDuplicate(new RealLinkRepository()));
Report("hand-rolled fake", TryDuplicate(new FakeLinkRepository()));

static bool TryDuplicate(ILinkRepository repo)
{
    repo.Create("cs101", "https://computerscienceguide.com/testing/");
    try
    {
        repo.Create("cs101", "https://computerscienceguide.com/other/");
        return false; // no exception: the duplicate was accepted
    }
    catch (Exception)
    {
        return true; // rejected, as a unique code should be
    }
}

static void Report(string name, bool rejected) =>
    Console.WriteLine(
        $"{(rejected ? "rejects" : "ACCEPTS"),-8} a duplicate code  ({name})");

interface ILinkRepository
{
    void Create(string code, string targetUrl);
}

class RealLinkRepository : ILinkRepository
{
    readonly SqliteConnection connection;

    public RealLinkRepository()
    {
        connection = new SqliteConnection("Data Source=:memory:");
        connection.Open();
        var create = connection.CreateCommand();
        create.CommandText =
            "CREATE TABLE Links (Code TEXT PRIMARY KEY, TargetUrl TEXT NOT NULL);";
        create.ExecuteNonQuery();
    }

    public void Create(string code, string targetUrl)
    {
        var cmd = connection.CreateCommand();
        cmd.CommandText =
            "INSERT INTO Links (Code, TargetUrl) VALUES ($code, $url);";
        cmd.Parameters.AddWithValue("$code", code);
        cmd.Parameters.AddWithValue("$url", targetUrl);
        cmd.ExecuteNonQuery();
    }
}

class FakeLinkRepository : ILinkRepository
{
    readonly Dictionary<string, string> links = new();

    public void Create(string code, string targetUrl) =>
        links[code] = targetUrl;
}
```

```text output
rejects  a duplicate code  (real SQLite)
ACCEPTS  a duplicate code  (hand-rolled fake)
```

The fake is not buggy in the sense of doing the wrong thing for what it was told to do; it was simply never told about uniqueness, because a `Dictionary` indexer overwrites rather than rejects. This is exactly the fidelity gap the [test-doubles article](/testing/test-doubles/) closes on: a double is a stand-in for behavior a person wrote, and "a test that uses doubles exercises a configuration that production never runs, so at least one test should cover the real assembly." A fake could be fixed to check for the key first and throw — the exercises in that article build exactly such a fix — but every rule like that has to be written and kept in step with the schema by hand. The SQLite version gets it from one line of DDL.

::::exercise[Predict the match]
The `Links` table stores `cs101` in lower case. Before running any code, predict what a query for `Code = 'CS101'` returns, and whether adding `COLLATE NOCASE` to that comparison changes the answer.

:::solution
```csharp run id=case-sensitivity
#:package Microsoft.Data.Sqlite@9.*
using Microsoft.Data.Sqlite;

using var connection = new SqliteConnection("Data Source=:memory:");
connection.Open();
Exec(connection,
    "CREATE TABLE Links (Code TEXT PRIMARY KEY, TargetUrl TEXT NOT NULL);");
Exec(connection,
    "INSERT INTO Links (Code, TargetUrl) VALUES ('cs101', 'https://computerscienceguide.com/testing/');");

Console.WriteLine(Find(connection, "Code = 'CS101'"));
Console.WriteLine(Find(connection, "Code = 'CS101' COLLATE NOCASE"));

static void Exec(SqliteConnection c, string sql)
{
    var cmd = c.CreateCommand();
    cmd.CommandText = sql;
    cmd.ExecuteNonQuery();
}

static string Find(SqliteConnection c, string where)
{
    var cmd = c.CreateCommand();
    cmd.CommandText = $"SELECT TargetUrl FROM Links WHERE {where};";
    return cmd.ExecuteScalar() as string ?? "not found";
}
```

```text output
not found
https://computerscienceguide.com/testing/
```

The first query does not match: SQLite's default `BINARY` collation compares strings byte for byte, so `'CS101'` and `'cs101'` are different values. This is the same case-sensitivity gap the EF Core documentation warns about — a query written assuming SQL Server's default case-insensitive comparison would quietly pass here and fail in production, or the reverse. Adding `COLLATE NOCASE` to the comparison (or to the column definition, so every query gets it automatically) makes SQLite match case-insensitively, which is closer to what most people expect from a lookup code.
:::
::::

## What makes integration tests flaky, and how do you stop it?

A *flaky test* passes and fails on the same code with nothing you changed on purpose. Integration tests are more exposed to this than unit tests because they touch more real state, and Martin Fowler's "Eradicating Non-Determinism in Tests" names the causes worth checking first.

**Shared mutable state and test-order dependence.** "If one test creates some data in the database and leaves it lying around, it can corrupt the run of another test," Fowler writes. This is not hypothetical; it is a direct consequence of giving two tests the same connection. The program below runs the same two checks — create a link, then confirm an unrelated code is unknown — in two different orders against a fixture that is fresh for each order, so the demonstration itself stays exactly repeatable:

```csharp run id=order-dependence
#:package Microsoft.Data.Sqlite@9.*
using Microsoft.Data.Sqlite;

(string Name, Func<LinkRepository, bool> Body)[] tests =
[
    ("CreatesALink", repo =>
    {
        repo.Create("promo", "https://computerscienceguide.com/promo/");
        return repo.Find("promo") is not null;
    }),
    ("RejectsAnUnknownCode", repo =>
        repo.Find("promo") is null),
];

void RunOrder(string label, int[] order)
{
    using var connection = new SqliteConnection("Data Source=:memory:");
    connection.Open();
    var create = connection.CreateCommand();
    create.CommandText = "CREATE TABLE Links (Code TEXT PRIMARY KEY, TargetUrl TEXT NOT NULL);";
    create.ExecuteNonQuery();
    var repo = new LinkRepository(connection);

    Console.WriteLine(label);
    foreach (var i in order)
    {
        var (name, body) = tests[i];
        Console.WriteLine($"  {(body(repo) ? "PASS" : "FAIL")}  {name}");
    }
}

RunOrder("Order A: CreatesALink, then RejectsAnUnknownCode", [0, 1]);
RunOrder("Order B: RejectsAnUnknownCode, then CreatesALink", [1, 0]);

public class LinkRepository(SqliteConnection connection)
{
    public void Create(string code, string targetUrl)
    {
        var cmd = connection.CreateCommand();
        cmd.CommandText = "INSERT INTO Links (Code, TargetUrl) VALUES ($code, $url);";
        cmd.Parameters.AddWithValue("$code", code);
        cmd.Parameters.AddWithValue("$url", targetUrl);
        cmd.ExecuteNonQuery();
    }

    public string? Find(string code)
    {
        var cmd = connection.CreateCommand();
        cmd.CommandText = "SELECT TargetUrl FROM Links WHERE Code = $code;";
        cmd.Parameters.AddWithValue("$code", code);
        return (string?)cmd.ExecuteScalar();
    }
}
```

```text output
Order A: CreatesALink, then RejectsAnUnknownCode
  PASS  CreatesALink
  FAIL  RejectsAnUnknownCode
Order B: RejectsAnUnknownCode, then CreatesALink
  PASS  RejectsAnUnknownCode
  PASS  CreatesALink
```

Both checks are individually correct. Run in order A, the first one leaves `promo` in the table, so the second — which never mentions `promo` and looks like it is testing something unrelated — fails only because it happened to run second. Run in order B, both pass. The bug is not in either check; it is in sharing one connection between them. This is precisely the risk of an xUnit `IClassFixture<T>` holding one `SqliteConnection` for every `[Fact]` in a class: xUnit itself documents that "tests within a single test collection will not be run in parallel against each other," so tests in one class run one at a time, but nothing about that guarantees *which* one runs first ([Running Tests in Parallel](https://xunit.net/docs/running-tests-in-parallel)). The `LinkRepositoryTests` earlier in this article avoid the whole problem by giving each `[Fact]` its own connection instead of a shared fixture, which is why they passed in every order without anyone having to reason about ordering at all.

**Time-dependent assertions.** "Each time you call it, you get a new result, and any tests that depend on it can thus change," Fowler writes of the system clock. The same is true of elapsed time. Five real `Task.Delay(50)` calls, timed with a `Stopwatch`, show the spread directly:

```csharp run id=timing-spread
using System.Diagnostics;

var samples = new List<long>();
for (int i = 0; i < 5; i++)
{
    var sw = Stopwatch.StartNew();
    await Task.Delay(50);
    sw.Stop();
    samples.Add(sw.ElapsedMilliseconds);
}

Console.WriteLine($"Requested: 50 ms each, 5 runs");
Console.WriteLine($"Measured min: {samples.Min()} ms");
Console.WriteLine($"Measured max: {samples.Max()} ms");
Console.WriteLine($"Spread: {samples.Max() - samples.Min()} ms");
```

```text output
Requested: 50 ms each, 5 runs
Measured min: [...] ms
Measured max: [...] ms
Spread: [...] ms
```

On this machine the five calls did not come back in exactly 50 ms, and no two runs of this block are likely to report the same spread — the operating system's scheduler, garbage collection pauses and whatever else is running all move the number. A test that asserted `elapsed == 50` would be flaky by construction: it fails on a slow CI runner and passes on a fast laptop for reasons that have nothing to do with whether the code works. `Assert.InRange` with a generous tolerance, or asserting on relative order ("the cached call was faster than the uncached one") instead of an absolute duration, survives the variance instead of tripping over it.

**Real network calls.** The same non-determinism applies to anything reached over a network, with less control over it. Fowler: "Never use bare sleeps to wait for asynchronous responses: use a callback or polling," warning specifically against guessing how long a remote call will take. The EF Core testing guide gives the sharper version for database calls specifically: hitting an external service in a test "may involve isolation issues, where tests interfere with one another," because "multiple tests running in parallel against a database may modify data and cause each other to fail in various ways" ([Choosing a testing strategy](https://learn.microsoft.com/en-us/ef/core/testing/choosing-a-testing-strategy)) — the same shared-state failure the order-dependence demonstration showed above, just harder to reproduce on demand because the shared resource is out of process. This is one reason `LinkRepositoryTests` uses an in-memory SQLite database rather than a shared test server: there is no network, and no other process, to introduce a result that varies between runs.

**Resource leaks.** "If your application has some kind of resource leak, this will lead to random tests failing," Fowler writes, as connections, file handles or memory build up until some later, unrelated test is the one that happens to hit the limit. Every repository test on this page opens its `SqliteConnection` inside a `using`, which disposes it — and, per SQLite's own documentation, destroys the in-memory database with it — as soon as the test method returns, whether the test passed or threw. Removing that `using` would not usually fail the very next test; it would fail some later test, on some later run, after enough leaked connections had accumulated, which is exactly the "random tests failing" pattern Fowler describes and one of the harder categories of flakiness to trace back to its cause.

::::exercise[Find the bug before it ships]
A colleague refactors `LinkRepositoryTests` to open the connection once, in a `static readonly SqliteConnection Shared` field initialized outside any test method, instead of inside `OpenSchema()`. All three tests still pass locally, in the order the file lists them. Using the causes above, name two concrete ways this change could make the suite fail later without any change to `LinkRepository` itself.

:::solution
First, test-order dependence: `Create_ThenFind_RoundTripsTheTargetUrl` and `RecordClick_IncrementsTheStoredCount` both insert a row for `"cs101"`. Against a shared connection, whichever of them runs second hits `Create_DuplicateCode_ThrowsFromTheUniqueConstraint`'s own duplicate check, or the reverse — a `SqliteException` from a `[Fact]` that never meant to test uniqueness, exactly like the `RejectsAnUnknownCode` failure demonstrated above, just with the roles of "leaves data behind" and "assumes a clean table" swapped between different tests.

Second, xUnit's own parallelism: xUnit puts each test *class* in its own collection by default and documents that "tests in different test classes will be" able to "run in parallel against each other" ([Running Tests in Parallel](https://xunit.net/docs/running-tests-in-parallel)). A `static` field is visible to every instance of the class, and if a second test class were added later that also reached into `LinkRepositoryTests.Shared`, the two classes' tests could genuinely run at the same time on different threads — a real race, not merely an order that happens to be inconvenient, and one that would not reproduce the same way twice.

"All three tests still pass locally, in the order the file lists them" is doing the real damage here: a shared-state bug that survives one full run in one order is not proven safe, only proven lucky, and CI systems that shard or reorder tests are frequently the first place it shows up.
:::
::::
