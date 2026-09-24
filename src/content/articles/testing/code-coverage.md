---
title: "Code Coverage: What the Number Means"
description: "A test suite with 100% line coverage still hides a sign bug. Measure it with dotnet-coverage, see what branch and mutation testing add, and pick a target."
pillar: testing
order: 6
author: markus
published: 2026-09-24
updated: 2026-09-24
level: intermediate
tags: [code-coverage, branch-coverage, mutation-testing, dotnet-coverage, unit-testing]
prerequisites: ["testing/unit-testing-fundamentals"]
sources:
  - title: "Use code coverage for unit testing - .NET"
    url: "https://learn.microsoft.com/en-us/dotnet/core/testing/unit-testing-code-coverage"
    publisher: "Microsoft Learn"
    accessed: 2026-09-24
  - title: "dotnet-coverage code coverage tool - .NET CLI"
    url: "https://learn.microsoft.com/en-us/dotnet/core/additional-tools/dotnet-coverage"
    publisher: "Microsoft Learn"
    accessed: 2026-09-24
  - title: "Mutation testing - .NET"
    url: "https://learn.microsoft.com/en-us/dotnet/core/testing/mutation-testing"
    publisher: "Microsoft Learn"
    accessed: 2026-09-24
  - title: "Stryker.NET: Introduction"
    url: "https://stryker-mutator.io/docs/stryker-net/introduction/"
    publisher: "Stryker.NET"
    accessed: 2026-09-24
  - title: "bliki: TestCoverage"
    url: "https://martinfowler.com/bliki/TestCoverage.html"
    publisher: "Martin Fowler"
    accessed: 2026-09-24
  - title: "bliki: AssertionFreeTesting"
    url: "https://martinfowler.com/bliki/AssertionFreeTesting.html"
    publisher: "Martin Fowler"
    accessed: 2026-09-24
  - title: "coverlet-coverage/coverlet"
    url: "https://github.com/coverlet-coverage/coverlet"
    publisher: "Coverlet (GitHub)"
    accessed: 2026-09-24
draft: true
---

This test really runs, and it really passes.

```csharp run id=weak
#:package xunit.v3@1.*
using Xunit;

public class TemperatureTests
{
    [Fact]
    public void CelsiusToFahrenheit_BoilingPoint_ReturnsNonZero()
    {
        var result = Temperature.CelsiusToFahrenheit(100);
        Assert.True(result != 0);
    }
}

public static class Temperature
{
    public static double CelsiusToFahrenheit(double celsius) =>
        celsius * 9 / 5 - 32;
}
```

```text output
xUnit.net v3 In-Process Runner [...]
  Discovering: weak
  Discovered:  weak
  Starting:    weak
  Finished:    weak
=== TEST EXECUTION SUMMARY ===
   weak  Total: 1, Errors: 0, Failed: 0, Skipped: 0, Not Run: 0, Time: [...]
```

`CelsiusToFahrenheit` has a sign flipped: it should add 32, not subtract it. Water boils at 100°C, which is 212°F, not 148°F. The test never notices, because it never checks the value the function returns — it only checks that the value isn't exactly zero. Every executable line in `Temperature` ran. Every line in the test that exercises it ran too. By the measure this article is about, that is a completely covered method.

::::exercise[Predict the coverage, not just the outcome]
Before running a coverage tool, guess: for the program above, what percentage of `Temperature`'s lines will a coverage tool report as covered? What percentage of its branches?

:::solution
`Temperature.CelsiusToFahrenheit` is a single expression with no `if`, no `?:`, no loop — nothing that could produce two outcomes from one line. [Coverlet](https://github.com/coverlet-coverage/coverlet), the open-source coverage framework for .NET, describes itself as providing "line, branch and method coverage" (["coverlet-coverage/coverlet"](https://github.com/coverlet-coverage/coverlet), Coverlet), and Microsoft's own testing guide is specific about what each of those counts: "Code coverage is a measurement of the amount of code that is run by unit tests - either lines, branches, or methods" (["Use code coverage for unit testing"](https://learn.microsoft.com/en-us/dotnet/core/testing/unit-testing-code-coverage), Microsoft Learn). With no branch point in the method, there is nothing for branch coverage to count, and the one line ran once, so line coverage is 100% — the guess most people land on. Here is the real measurement, from [dotnet-coverage](https://learn.microsoft.com/en-us/dotnet/core/additional-tools/dotnet-coverage), the coverage tool this whole page uses (more on how that works below):

```bash run
cat > weak.cs << 'EOF'
#:package xunit.v3@1.*
using Xunit;

public class TemperatureTests
{
    [Fact]
    public void CelsiusToFahrenheit_BoilingPoint_ReturnsNonZero()
    {
        var result = Temperature.CelsiusToFahrenheit(100);
        Assert.True(result != 0);
    }
}

public static class Temperature
{
    public static double CelsiusToFahrenheit(double celsius) =>
        celsius * 9 / 5 - 32;
}
EOF
dotnet-coverage collect --output cov.xml \
  --output-format cobertura -- dotnet run weak.cs
reportgenerator -reports:cov.xml -targetdir:report \
  -reporttypes:TextSummary > /dev/null 2>&1
grep -E "Line coverage|Branch coverage|Method coverage" \
  report/Summary.txt
```

```text output
dotnet-coverage v[...] [...]

SessionId: [...]
xUnit.net v3 In-Process Runner [...]
  Discovering: weak
  Discovered:  weak
  Starting:    weak
  Finished:    weak
=== TEST EXECUTION SUMMARY ===
   weak  Total: 1, Errors: 0, Failed: 0, Skipped: 0, Not Run: 0, Time: [...]
Code coverage results: cov.xml.
  Line coverage: 100%
  Method coverage: 100% (2 of 2)
```

No "Branch coverage" line prints at all — [reportgenerator](https://learn.microsoft.com/en-us/dotnet/core/testing/unit-testing-code-coverage) omits it when a program has zero branches to count, rather than reporting a meaningless 100% of nothing. Line coverage 100%, method coverage 100%, and the sign bug is still there. A coverage report answers "did this line execute," never "was the result checked, and was it right."
:::
::::

## Where that number actually comes from

`dotnet-coverage` is a cross-platform .NET global tool that "enables the cross-platform collection of code coverage data of a running process" (["dotnet-coverage code coverage tool"](https://learn.microsoft.com/en-us/dotnet/core/additional-tools/dotnet-coverage), Microsoft Learn). Its own documentation gives the exact pattern used above as a worked example: "Collect code coverage data for any .NET application (such as a console or Blazor application) by using the following command: `dotnet-coverage collect dotnet run`" (same source). A file-based xUnit v3 program — the kind this whole pillar's [unit tests](/testing/unit-testing-fundamentals/) are written as, with `#:package xunit.v3@1.*` at the top and no `.csproj` — is exactly that: a console application that happens to run its own tests and exit. `dotnet-coverage collect` doesn't know or care that the process it's watching is a test runner rather than a "Hello, World"; it instruments whatever .NET code that process loads and reports on it in the Cobertura XML format, an open, widely-supported layout that tools like [ReportGenerator](https://learn.microsoft.com/en-us/dotnet/core/testing/unit-testing-code-coverage) turn into the kind of summary shown above. This is genuinely new ground for this pillar's other articles: earlier ones run `dotnet run` on a test file and read the pass/fail summary xUnit prints; this is the first one that wraps that same command in a second tool to measure what happened underneath it, and every coverage number on this page was produced exactly that way, with `dotnet-coverage` and `dotnet-reportgenerator-globaltool` installed once as .NET global tools (`dotnet tool install --global <name>`).

:::note
Every program on this page ran with the .NET 10 SDK on Windows 11, x64, resolving `#:package xunit.v3@1.*` to xUnit v3 1.1.0 and `dotnet-coverage` to version 18.11.
:::

## The check that would have caught it

Martin Fowler's bliki tells a short, specific story about a project that showed a client "extensive JUnit test coverage," except "there weren't any assertions in the JUnit tests" — every test called production code and checked nothing about the result. His point cuts straight to the demonstration above: "you can do this and have 100% code coverage - which is one reason why you have to be careful on interpreting code coverage data" (["AssertionFreeTesting"](https://martinfowler.com/bliki/AssertionFreeTesting.html), Martin Fowler). `Assert.True(result != 0)` is one step short of that extreme — it is an assertion, just one so loose that almost any wrong answer still satisfies it. Tightening it to check the actual expected value turns the same program from silently wrong to loudly failing:

```csharp run id=tight fails
#:package xunit.v3@1.*
using Xunit;

public class TemperatureTests
{
    [Fact]
    public void CelsiusToFahrenheit_BoilingPoint_Returns212()
    {
        Assert.Equal(212, Temperature.CelsiusToFahrenheit(100));
    }
}

public static class Temperature
{
    public static double CelsiusToFahrenheit(double celsius) =>
        celsius * 9 / 5 - 32;
}
```

```text output
xUnit.net v3 In-Process Runner [...]
  Discovering: tight
  Discovered:  tight
  Starting:    tight
    TemperatureTests.CelsiusToFahrenheit_BoilingPoint_Returns212 [FAIL]
      Assert.Equal() Failure: Values differ
      Expected: 212
      Actual:   148
      Stack Trace:
        [...]
           [...]
           [...]
  Finished:    tight
=== TEST EXECUTION SUMMARY ===
   tight  Total: 1, Errors: 0, Failed: 1, Skipped: 0, Not Run: 0, Time: [...]
```

Coverage did not change at all between the two versions — same one line, same single method, same 100%. What changed was the assertion. Fixing the sign makes the tighter test pass, still at the same 100% line coverage it always had:

```csharp run id=fixed
#:package xunit.v3@1.*
using Xunit;

public class TemperatureTests
{
    [Fact]
    public void CelsiusToFahrenheit_BoilingPoint_Returns212()
    {
        Assert.Equal(212, Temperature.CelsiusToFahrenheit(100));
    }
}

public static class Temperature
{
    public static double CelsiusToFahrenheit(double celsius) =>
        celsius * 9 / 5 + 32;
}
```

```text output
xUnit.net v3 In-Process Runner [...]
  Discovering: fixed
  Discovered:  fixed
  Starting:    fixed
  Finished:    fixed
=== TEST EXECUTION SUMMARY ===
   fixed  Total: 1, Errors: 0, Failed: 0, Skipped: 0, Not Run: 0, Time: [...]
```

The lesson so far is specifically about assertions, not about branches — `CelsiusToFahrenheit` never had a decision to miss. The next bug does.

## What a branch adds that a line can't show

`Freezing.Classify` decides whether a Fahrenheit reading counts as freezing. The specification is that 32°F and below counts as freezing — water freezes at 32°F — and the implementation gets the comparison direction backwards at the boundary, using `<` where the spec calls for `<=`:

```csharp run id=one-branch
#:package xunit.v3@1.*
using Xunit;

public class FreezingTests
{
    [Fact]
    public void Classify_BelowThreshold_ReturnsFreezing()
    {
        Assert.Equal("Freezing", Freezing.Classify(20));
    }
}

public static class Freezing
{
    public static string Classify(double fahrenheit) =>
        fahrenheit < 32 ? "Freezing" : "Not freezing";
}
```

```text output
xUnit.net v3 In-Process Runner [...]
  Discovering: one-branch
  Discovered:  one-branch
  Starting:    one-branch
  Finished:    one-branch
=== TEST EXECUTION SUMMARY ===
   one-branch  Total: 1, Errors: 0, Failed: 0, Skipped: 0, Not Run: 0, Time: [...]
```

One test, one call, 20°F, "Freezing." That call runs the ternary's condition and its true branch; the `else` never executes. Line coverage still reads 100%, because `dotnet-coverage` marks a line covered the moment it executes at all, however many of its outcomes never ran — but this time branch coverage tells a different story:

```bash run
cat > one-branch.cs << 'EOF'
#:package xunit.v3@1.*
using Xunit;

public class FreezingTests
{
    [Fact]
    public void Classify_BelowThreshold_ReturnsFreezing()
    {
        Assert.Equal("Freezing", Freezing.Classify(20));
    }
}

public static class Freezing
{
    public static string Classify(double fahrenheit) =>
        fahrenheit < 32 ? "Freezing" : "Not freezing";
}
EOF
dotnet-coverage collect --output cov.xml \
  --output-format cobertura -- dotnet run one-branch.cs
reportgenerator -reports:cov.xml -targetdir:report \
  -reporttypes:TextSummary > /dev/null 2>&1
grep -E "Line coverage|Branch coverage|Method coverage" \
  report/Summary.txt
```

```text output
dotnet-coverage v[...] [...]

SessionId: [...]
xUnit.net v3 In-Process Runner [...]
  Discovering: one-branch
  Discovered:  one-branch
  Starting:    one-branch
  Finished:    one-branch
=== TEST EXECUTION SUMMARY ===
   one-branch  Total: 1, Errors: 0, Failed: 0, Skipped: 0, Not Run: 0, Time: [...]
Code coverage results: cov.xml.
  Line coverage: 100%
  Branch coverage: 50% (1 of 2)
  Method coverage: 100% (2 of 2)
```

Microsoft's own definition matches this exactly, down to the percentage: "if you have a simple application with only two conditional branches of code (*branch a*, and *branch b*), a unit test that verifies conditional *branch a* will report branch code coverage of 50%" (["Use code coverage for unit testing"](https://learn.microsoft.com/en-us/dotnet/core/testing/unit-testing-code-coverage), Microsoft Learn). Line coverage answers "did this statement run." Branch coverage answers a sharper question: "did every decision this statement can make actually get made." A single-line `?:` is one statement with two decisions, and 100% on the first tells you nothing about the second.

## Closing the branch, still missing the boundary

A second test, on the other side of 32°F, closes the gap branch coverage reported:

```csharp run id=two-branch
#:package xunit.v3@1.*
using Xunit;

public class FreezingTests
{
    [Fact]
    public void Classify_BelowThreshold_ReturnsFreezing()
    {
        Assert.Equal("Freezing", Freezing.Classify(20));
    }

    [Fact]
    public void Classify_AboveThreshold_ReturnsNotFreezing()
    {
        Assert.Equal("Not freezing", Freezing.Classify(50));
    }
}

public static class Freezing
{
    public static string Classify(double fahrenheit) =>
        fahrenheit < 32 ? "Freezing" : "Not freezing";
}
```

```text output
xUnit.net v3 In-Process Runner [...]
  Discovering: two-branch
  Discovered:  two-branch
  Starting:    two-branch
  Finished:    two-branch
=== TEST EXECUTION SUMMARY ===
   two-branch  Total: 2, Errors: 0, Failed: 0, Skipped: 0, Not Run: 0, Time: [...]
```

```bash run
cat > two-branch.cs << 'EOF'
#:package xunit.v3@1.*
using Xunit;

public class FreezingTests
{
    [Fact]
    public void Classify_BelowThreshold_ReturnsFreezing()
    {
        Assert.Equal("Freezing", Freezing.Classify(20));
    }

    [Fact]
    public void Classify_AboveThreshold_ReturnsNotFreezing()
    {
        Assert.Equal("Not freezing", Freezing.Classify(50));
    }
}

public static class Freezing
{
    public static string Classify(double fahrenheit) =>
        fahrenheit < 32 ? "Freezing" : "Not freezing";
}
EOF
dotnet-coverage collect --output cov.xml \
  --output-format cobertura -- dotnet run two-branch.cs
reportgenerator -reports:cov.xml -targetdir:report \
  -reporttypes:TextSummary > /dev/null 2>&1
grep -E "Line coverage|Branch coverage|Method coverage" \
  report/Summary.txt
```

```text output
dotnet-coverage v[...] [...]

SessionId: [...]
xUnit.net v3 In-Process Runner [...]
  Discovering: two-branch
  Discovered:  two-branch
  Starting:    two-branch
  Finished:    two-branch
=== TEST EXECUTION SUMMARY ===
   two-branch  Total: 2, Errors: 0, Failed: 0, Skipped: 0, Not Run: 0, Time: [...]
Code coverage results: cov.xml.
  Line coverage: 100%
  Branch coverage: 100% (2 of 2)
  Method coverage: 100% (3 of 3)
```

100% line, 100% branch, every number a coverage report can print maxed out — and the boundary bug from the opening of this section is still sitting there, because neither test used the value 32 itself. Both tests ran the `<` comparison; neither ran it *at* the one input where `<` and `<=` disagree.

<figure class="diagram">
<svg viewBox="0 0 360 260" role="img" aria-labelledby="covmap-title covmap-desc">
<title id="covmap-title">Branch coverage map for the freezing threshold, before and after a boundary test</title>
<desc id="covmap-desc">Two number lines from 0 to 60 degrees Fahrenheit. The top line has green dots at 20 and 50, both tested, and a red dot at 32 marking the boundary that was never run even though branch coverage already reads 100 percent. The bottom line repeats the same range with a third green dot added at 32, showing the boundary now covered.</desc>
<text x="20" y="20" class="d-bold">2 tests: 100% branch coverage</text>
<line x1="30" y1="55" x2="330" y2="55" class="d-line"/>
<circle cx="130" cy="55" r="6" class="d-fill-good"/>
<circle cx="280" cy="55" r="6" class="d-fill-good"/>
<circle cx="190" cy="55" r="6" class="d-fill-bad"/>
<text x="30" y="45" class="d-small d-muted">0</text>
<text x="308" y="45" class="d-small d-muted">60°F</text>
<text x="130" y="75" text-anchor="middle" class="d-mono d-small">20</text>
<text x="280" y="75" text-anchor="middle" class="d-mono d-small">50</text>
<text x="190" y="75" text-anchor="middle" class="d-mono d-small d-bold">32</text>
<text x="20" y="98" class="d-small d-muted">20 and 50 ran; 32, the</text>
<text x="20" y="114" class="d-small d-muted">boundary itself, never did.</text>
<text x="20" y="150" class="d-bold">3 tests: boundary covered</text>
<line x1="30" y1="185" x2="330" y2="185" class="d-line"/>
<circle cx="130" cy="185" r="6" class="d-fill-good"/>
<circle cx="280" cy="185" r="6" class="d-fill-good"/>
<circle cx="190" cy="185" r="6" class="d-fill-good"/>
<text x="30" y="175" class="d-small d-muted">0</text>
<text x="308" y="175" class="d-small d-muted">60°F</text>
<text x="130" y="205" text-anchor="middle" class="d-mono d-small">20</text>
<text x="280" y="205" text-anchor="middle" class="d-mono d-small">50</text>
<text x="190" y="205" text-anchor="middle" class="d-mono d-small d-bold">32</text>
<text x="20" y="228" class="d-small d-muted">A test at exactly 32 closes</text>
<text x="20" y="244" class="d-small d-muted">the gap the percentage hid.</text>
</svg>
<figcaption>Figure 1. Branch coverage reached 100% after two tests, but the boundary value itself, 32°F, was never run until a third test targeted it directly.</figcaption>
</figure>

A third test, aimed exactly at the boundary, is the one that actually exercises the comparison at the point where `<` and `<=` disagree:

```csharp run id=boundary fails
#:package xunit.v3@1.*
using Xunit;

public class FreezingTests
{
    [Fact]
    public void Classify_BelowThreshold_ReturnsFreezing()
    {
        Assert.Equal("Freezing", Freezing.Classify(20));
    }

    [Fact]
    public void Classify_AboveThreshold_ReturnsNotFreezing()
    {
        Assert.Equal("Not freezing", Freezing.Classify(50));
    }

    [Fact]
    public void Classify_AtThreshold_ReturnsFreezing()
    {
        Assert.Equal("Freezing", Freezing.Classify(32));
    }
}

public static class Freezing
{
    public static string Classify(double fahrenheit) =>
        fahrenheit < 32 ? "Freezing" : "Not freezing";
}
```

```text output
xUnit.net v3 In-Process Runner [...]
  Discovering: boundary
  Discovered:  boundary
  Starting:    boundary
    FreezingTests.Classify_AtThreshold_ReturnsFreezing [FAIL]
      Assert.Equal() Failure: Strings differ
                 ↓ (pos 0)
      Expected: "Freezing"
      Actual:   "Not freezing"
                 ↑ (pos 0)
      Stack Trace:
        [...]
           [...]
           [...]
  Finished:    boundary
=== TEST EXECUTION SUMMARY ===
   boundary  Total: 3, Errors: 0, Failed: 1, Skipped: 0, Not Run: 0, Time: [...]
```

Changing `<` to `<=` fixes it, and all three tests, including the boundary one, pass:

```csharp run id=freezing-fixed
#:package xunit.v3@1.*
using Xunit;

public class FreezingTests
{
    [Fact]
    public void Classify_BelowThreshold_ReturnsFreezing()
    {
        Assert.Equal("Freezing", Freezing.Classify(20));
    }

    [Fact]
    public void Classify_AboveThreshold_ReturnsNotFreezing()
    {
        Assert.Equal("Not freezing", Freezing.Classify(50));
    }

    [Fact]
    public void Classify_AtThreshold_ReturnsFreezing()
    {
        Assert.Equal("Freezing", Freezing.Classify(32));
    }
}

public static class Freezing
{
    public static string Classify(double fahrenheit) =>
        fahrenheit <= 32 ? "Freezing" : "Not freezing";
}
```

```text output
xUnit.net v3 In-Process Runner [...]
  Discovering: freezing-fixed
  Discovered:  freezing-fixed
  Starting:    freezing-fixed
  Finished:    freezing-fixed
=== TEST EXECUTION SUMMARY ===
   freezing-fixed  Total: 3, Errors: 0, Failed: 0, Skipped: 0, Not Run: 0, Time: [...]
```

::::exercise[Find the bug before the coverage tool would]
`HeatAdvisory.Classify` is meant to report `"Extreme heat"` at 38°C and above, `"Heat advisory"` from 32°C up to (but not including) 38°C, and `"Normal"` below that. Its implementation compares with `celsius > 38` for the top band and `celsius >= 32` for the middle one. Find the single input where that disagrees with the specification, before running anything.

:::solution
`celsius > 38` excludes 38 itself, so exactly 38°C falls through to the `>= 32` branch and comes back `"Heat advisory"` instead of `"Extreme heat"` — the same `<` vs `<=` mistake as `Freezing.Classify`, on the other boundary. Three tests that never touch 38 itself pass and report full branch coverage:

```csharp run id=heat-buggy
#:package xunit.v3@1.*
using Xunit;

public class HeatAdvisoryTests
{
    [Fact]
    public void Classify_35Celsius_ReturnsHeatAdvisory()
    {
        Assert.Equal("Heat advisory", HeatAdvisory.Classify(35));
    }

    [Fact]
    public void Classify_40Celsius_ReturnsExtremeHeat()
    {
        Assert.Equal("Extreme heat", HeatAdvisory.Classify(40));
    }

    [Fact]
    public void Classify_20Celsius_ReturnsNormal()
    {
        Assert.Equal("Normal", HeatAdvisory.Classify(20));
    }
}

public static class HeatAdvisory
{
    public static string Classify(double celsius) =>
        celsius > 38 ? "Extreme heat" :
        celsius >= 32 ? "Heat advisory" :
        "Normal";
}
```

```text output
xUnit.net v3 In-Process Runner [...]
  Discovering: heat-buggy
  Discovered:  heat-buggy
  Starting:    heat-buggy
  Finished:    heat-buggy
=== TEST EXECUTION SUMMARY ===
   heat-buggy  Total: 3, Errors: 0, Failed: 0, Skipped: 0, Not Run: 0, Time: [...]
```

A fourth test, at exactly 38, fails against this version and would pass once `>` becomes `>=`:

```csharp run id=heat-boundary fails
#:package xunit.v3@1.*
using Xunit;

public class HeatAdvisoryTests
{
    [Fact]
    public void Classify_38Celsius_ReturnsExtremeHeat()
    {
        Assert.Equal("Extreme heat", HeatAdvisory.Classify(38));
    }
}

public static class HeatAdvisory
{
    public static string Classify(double celsius) =>
        celsius > 38 ? "Extreme heat" :
        celsius >= 32 ? "Heat advisory" :
        "Normal";
}
```

```text output
xUnit.net v3 In-Process Runner [...]
  Discovering: heat-boundary
  Discovered:  heat-boundary
  Starting:    heat-boundary
    HeatAdvisoryTests.Classify_38Celsius_ReturnsExtremeHeat [FAIL]
      Assert.Equal() Failure: Strings differ
                 ↓ (pos 0)
      Expected: "Extreme heat"
      Actual:   "Heat advisory"
                 ↑ (pos 0)
      Stack Trace:
        [...]
           [...]
           [...]
  Finished:    heat-boundary
=== TEST EXECUTION SUMMARY ===
   heat-boundary  Total: 1, Errors: 0, Failed: 1, Skipped: 0, Not Run: 0, Time: [...]
```

Coverage reports 100% of lines and branches on both versions of `Classify` — the buggy one and the fixed one look identical to a coverage tool, because both run every line and take every branch. The number cannot distinguish a boundary at the right place from one that's off by a hair, only a test that actually lands on the boundary can.
:::
::::

## What full branch coverage still can't tell you

Both `Freezing.Classify` and `HeatAdvisory.Classify` reached 100% branch coverage while still shipping a bug, which raises the obvious next question: is there a way to check whether a test suite would catch *a* change, without waiting to find the specific change by hand? *Mutation testing* answers that by making the change on purpose. Stryker.NET, the tool Microsoft's own documentation points to for .NET, "offers you mutation testing for your .NET Core and .NET Framework projects. It allows you to test your tests by temporarily inserting bugs" (["Stryker.NET: Introduction"](https://stryker-mutator.io/docs/stryker-net/introduction/), Stryker.NET). Microsoft's page defines the unit of that process precisely: "A mutant is a small change in your code that Stryker makes on purpose. The idea is simple: if your tests are good, they should catch the change and fail. If they still pass, your tests might not be strong enough" (["Mutation testing"](https://learn.microsoft.com/en-us/dotnet/core/testing/mutation-testing), Microsoft Learn). A caught mutant is **killed**; one that slips through with every test still green has **survived**. The same page's mutation-type table names the exact kind of change this article keeps running into: "The equivalent operator is used to replace an operator with its equivalent. For example, `x < y` becomes `x <= y`" (same source) — precisely the `<` and `<=` swap both `Freezing.Classify` and `HeatAdvisory.Classify` got wrong.

### Why Stryker.NET can't run on this page's programs

Every other tool on this page — `dotnet run`, `dotnet-coverage`, `reportgenerator` — works directly against a single `.cs` file with `#:package` directives and no project file. Stryker.NET does not; it analyzes a `.csproj` or `.fsproj` to know what to mutate and how to rebuild it, and the file-based programs this pillar uses have neither. Rather than assert that as a fact, here is what it actually does when pointed at one:

```bash run
cat > tests.cs << 'EOF'
#:package xunit.v3@1.*
using Xunit;

public class CalcTests
{
    [Fact]
    public void Add_TwoPositives_ReturnsSum()
    {
        Assert.Equal(5, Calc.Add(2, 3));
    }
}

public static class Calc
{
    public static int Add(int a, int b) => a + b;
}
EOF
if dotnet-stryker > stryker.log 2>&1; then echo "exit code: 0"; else echo "exit code: 1"; fi
grep -c "No .csproj or .fsproj file found" stryker.log
```

```text output
exit code: 1
1
```

That is a real, current limitation of running Stryker.NET against this pillar's file-based test programs, not a guess — it exits 1 and its log names the missing `.csproj` as the reason. The rest of this section demonstrates the same idea by hand instead: apply the mutation Stryker would try, and check by hand whether the existing tests still pass.

### Applying a mutation by hand

Take the two-test version of `Freezing.Classify` from earlier — the one with 100% branch coverage that still missed the boundary bug — and apply Stryker's own "equivalent operator" mutation to it, flipping `<` to `<=`:

```csharp run id=survives
#:package xunit.v3@1.*
using Xunit;

public class FreezingTests
{
    [Fact]
    public void Classify_BelowThreshold_ReturnsFreezing()
    {
        Assert.Equal("Freezing", Freezing.Classify(20));
    }

    [Fact]
    public void Classify_AboveThreshold_ReturnsNotFreezing()
    {
        Assert.Equal("Not freezing", Freezing.Classify(50));
    }
}

// Mutant: <= in place of the original <.
public static class Freezing
{
    public static string Classify(double fahrenheit) =>
        fahrenheit <= 32 ? "Freezing" : "Not freezing";
}
```

```text output
xUnit.net v3 In-Process Runner [...]
  Discovering: survives
  Discovered:  survives
  Starting:    survives
  Finished:    survives
=== TEST EXECUTION SUMMARY ===
   survives  Total: 2, Errors: 0, Failed: 0, Skipped: 0, Not Run: 0, Time: [...]
```

Both tests pass, identically to how they passed against the original, un-mutated `<` version earlier in this article. Nothing distinguishes the two versions from this suite's point of view — the mutant **survived** — which is exactly the situation Microsoft's documentation describes: the tests are green either way, so they aren't strong enough to prove which comparison operator is actually there. That is not a hypothetical risk; it is the same boundary bug from earlier in this article, expressed as a mutation instead of a bug report, and it survives for the identical reason: neither test supplies the input, 32, where the two operators disagree.

A different mutation on the same two-test version — swapping which string each branch returns — does not survive:

```csharp run id=killed fails
#:package xunit.v3@1.*
using Xunit;

public class FreezingTests
{
    [Fact]
    public void Classify_BelowThreshold_ReturnsFreezing()
    {
        Assert.Equal("Freezing", Freezing.Classify(20));
    }

    [Fact]
    public void Classify_AboveThreshold_ReturnsNotFreezing()
    {
        Assert.Equal("Not freezing", Freezing.Classify(50));
    }
}

// Mutant: the two branches' results are swapped.
public static class Freezing
{
    public static string Classify(double fahrenheit) =>
        fahrenheit < 32 ? "Not freezing" : "Freezing";
}
```

```text output
xUnit.net v3 In-Process Runner [...]
  Discovering: killed
  Discovered:  killed
  Starting:    killed
    FreezingTests.Classify_BelowThreshold_ReturnsFreezing [FAIL]
      Assert.Equal() Failure: Strings differ
                 ↓ (pos 0)
      Expected: "Freezing"
      Actual:   "Not freezing"
                 ↑ (pos 0)
      Stack Trace:
        [...]
           [...]
           [...]
    FreezingTests.Classify_AboveThreshold_ReturnsNotFreezing [FAIL]
      Assert.Equal() Failure: Strings differ
                 ↓ (pos 0)
      Expected: "Not freezing"
      Actual:   "Freezing"
                 ↑ (pos 0)
      Stack Trace:
        [...]
           [...]
           [...]
  Finished:    killed
=== TEST EXECUTION SUMMARY ===
   killed  Total: 2, Errors: 0, Failed: 2, Skipped: 0, Not Run: 0, Time: [...]
```

Same two tests, same 100% branch coverage going in, two different one-line mutations: one killed outright, the other survived undetected. Coverage could not have predicted which — both mutated lines were fully covered before anyone touched them. Mutation testing's report is not "how much of the code ran" but "which of the changes a bug could look like would your tests actually notice."

::::exercise[Predict which mutant survives]
The three-test, boundary-fixed version of `Freezing.Classify` (the one using `<=` with tests at 20, 32 and 50) is the target. For each mutation below, predict survives or killed, then check by running the mutated version against all three tests.

1. Change the threshold literal from `32` to `33`.
2. Change the string `"Not freezing"` to `"NOT FREEZING"`.

:::solution
Both are killed. Mutation 1 changes what `Classify(32)` returns — the boundary test expects `"Freezing"` and a `33` threshold would make 32°F fall on the `"Not freezing"` side, so that test fails. Mutation 2 changes the exact text `Classify(50)` is asserted to return; `Assert.Equal` compares strings exactly, case included, so `"NOT FREEZING"` fails that assertion. Once a test suite exercises every branch *and* the exact boundary between them, this particular function has very little room left for a one-line change to hide in — which is a different, stronger claim than "100% branch coverage," and mutation testing is what lets you check it instead of assuming it.
:::
::::

Both bugs on this page were caught by one specific, hand-picked test landing exactly on the boundary. [Property-based testing](/testing/property-based-testing/) closes a related gap a different way: instead of a person having to think of 32 or 38 in particular, it generates inputs and lets a search find the value that breaks the code. It doesn't read a coverage report either, but across enough random trials it is far more likely to land on the boundary a hand-written test suite happened to skip.

## Picking a target you can defend

None of this makes coverage useless — it makes it a tool for a narrower job than "prove the tests are good." Martin Fowler's summary of that job is direct: "Test coverage is a useful tool for finding untested parts of a codebase. Test coverage is of little use as a numeric statement of how good your tests are" (["TestCoverage"](https://martinfowler.com/bliki/TestCoverage.html), Martin Fowler). Used that way — pointing at the parts of `Temperature` or `Freezing` nobody has exercised yet — coverage is exactly what this article's earlier examples needed to reveal the gap. Used as a target to hit, it invites exactly the kind of test this article opened with: one that runs the line without checking anything.

On what percentage to aim for, Fowler is specific rather than evasive: "If you are testing thoughtfully and well, I would expect a coverage percentage in the upper 80s or 90s," adding "I would be suspicious of anything like 100%" (same source) — a suspicion this article's own opening example earns honestly, since 100% line coverage was trivial to reach without writing a single correct assertion. He also credits colleague Brian Marick with the distinction that matters more than the number itself: "I expect a high level of coverage. Sometimes managers require one. There's a subtle difference" (same source). A team that treats a coverage percentage as a gate to pass will get a coverage percentage; a team that reads the report to find code nobody has thought to exercise gets something closer to what the number was supposed to mean in the first place.

Mutation testing earns a parallel warning against its own perfect score. Having shown a five-mutant suite improved down to nearly all killed, Microsoft's guide adds: "Don't chase a 100% mutation score. Instead, focus on high risk or business critical areas where undetected bugs would be most costly" (["Mutation testing"](https://learn.microsoft.com/en-us/dotnet/core/testing/mutation-testing), Microsoft Learn). Running Stryker.NET (or, until this pillar's programs have project files, applying a handful of its documented mutation types by hand, the way this article just did) on the handful of functions where a wrong boundary or a flipped comparison would actually cost something is worth far more than mutating every line of a codebase and staring at one aggregate percentage. Fowler's closing line about coverage doubles as the honest summary of everything on this page: "If a part of your test suite is weak in a way that coverage can detect, it's likely also weak in a way coverage can't detect" (["TestCoverage"](https://martinfowler.com/bliki/TestCoverage.html), Martin Fowler) — a 43% line-coverage report always means something is genuinely untested, but a 100% report, on its own, has told you almost nothing about whether the tests you do have would catch a real bug.

::::exercise[Extend the code and keep both numbers at 100%]
Add a third branch to `Freezing.Classify`: below 0°F should report `"Severe freezing"`, 0°F up to the existing 32°F boundary stays `"Freezing"`, and above 32°F stays `"Not freezing"`. Write enough tests to reach 100% branch coverage on the three-way version, then check with `dotnet-coverage` whether you actually did.

:::solution
Three branches from two comparisons need three tests, one per outcome:

```csharp run id=severe
#:package xunit.v3@1.*
using Xunit;

public class FreezingTests
{
    [Fact]
    public void Classify_BelowZero_ReturnsSevereFreezing()
    {
        Assert.Equal("Severe freezing", Freezing.Classify(-5));
    }

    [Fact]
    public void Classify_AtThreshold_ReturnsFreezing()
    {
        Assert.Equal("Freezing", Freezing.Classify(32));
    }

    [Fact]
    public void Classify_AboveThreshold_ReturnsNotFreezing()
    {
        Assert.Equal("Not freezing", Freezing.Classify(50));
    }
}

public static class Freezing
{
    public static string Classify(double fahrenheit) =>
        fahrenheit < 0 ? "Severe freezing" :
        fahrenheit <= 32 ? "Freezing" :
        "Not freezing";
}
```

```text output
xUnit.net v3 In-Process Runner [...]
  Discovering: severe
  Discovered:  severe
  Starting:    severe
  Finished:    severe
=== TEST EXECUTION SUMMARY ===
   severe  Total: 3, Errors: 0, Failed: 0, Skipped: 0, Not Run: 0, Time: [...]
```

```bash run
cat > severe.cs << 'EOF'
#:package xunit.v3@1.*
using Xunit;

public class FreezingTests
{
    [Fact]
    public void Classify_BelowZero_ReturnsSevereFreezing()
    {
        Assert.Equal("Severe freezing", Freezing.Classify(-5));
    }

    [Fact]
    public void Classify_AtThreshold_ReturnsFreezing()
    {
        Assert.Equal("Freezing", Freezing.Classify(32));
    }

    [Fact]
    public void Classify_AboveThreshold_ReturnsNotFreezing()
    {
        Assert.Equal("Not freezing", Freezing.Classify(50));
    }
}

public static class Freezing
{
    public static string Classify(double fahrenheit) =>
        fahrenheit < 0 ? "Severe freezing" :
        fahrenheit <= 32 ? "Freezing" :
        "Not freezing";
}
EOF
dotnet-coverage collect --output cov.xml \
  --output-format cobertura -- dotnet run severe.cs
reportgenerator -reports:cov.xml -targetdir:report \
  -reporttypes:TextSummary > /dev/null 2>&1
grep -E "Line coverage|Branch coverage|Method coverage" \
  report/Summary.txt
```

```text output
dotnet-coverage v[...] [...]

SessionId: [...]
xUnit.net v3 In-Process Runner [...]
  Discovering: severe
  Discovered:  severe
  Starting:    severe
  Finished:    severe
=== TEST EXECUTION SUMMARY ===
   severe  Total: 3, Errors: 0, Failed: 0, Skipped: 0, Not Run: 0, Time: [...]
Code coverage results: cov.xml.
  Line coverage: 100%
  Branch coverage: 100% (4 of 4)
  Method coverage: 100% (4 of 4)
```

Four branches, not two: each of the two comparisons contributes a true and a false outcome, and the tool counts them all. Reaching 100% took exactly as many tests as there were distinct outcomes to reach — the number scales with the code's actual decision count, not with how many `if`s happen to be visible on the screen at once.
:::
::::

Coverage told this page exactly where to look four times over — a method with no branches to speak of, a ternary with one branch untested, a boundary no test happened to land on, and a mutation two passing tests couldn't tell apart from the original. It answered every one of those questions correctly. What it never claimed, and what none of its three numbers can claim, is that the code behind a covered line does the right thing.
