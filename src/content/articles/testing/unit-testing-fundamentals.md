---
title: "Unit Testing Fundamentals with xUnit"
description: "What a passing xUnit test actually proves, Arrange-Act-Assert in a real C# test, naming tests so failures explain themselves, [Theory] data, and a brittle test."
pillar: testing
order: 1
author: markus
published: 2026-09-22
updated: 2026-09-22
level: beginner
tags: [unit-testing, xunit, arrange-act-assert, test-naming, brittle-tests]
prerequisites: []
sources:
  - title: "Getting Started with xUnit.net v3"
    url: "https://xunit.net/docs/getting-started/v3/getting-started"
    publisher: "xUnit.net"
    accessed: 2026-09-22
  - title: "Best practices for writing unit tests"
    url: "https://learn.microsoft.com/en-us/dotnet/core/testing/unit-testing-best-practices"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "3A – Arrange, Act, Assert"
    url: "https://xp123.com/articles/3a-arrange-act-assert/"
    publisher: "Bill Wake"
    accessed: 2026-09-22
  - title: "File-based apps"
    url: "https://learn.microsoft.com/en-us/dotnet/core/sdk/file-based-apps"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "EqualityAsserts.cs, xunit/assert.xunit"
    url: "https://github.com/xunit/assert.xunit/blob/main/EqualityAsserts.cs"
    publisher: "xUnit.net (GitHub)"
    accessed: 2026-09-22
draft: false
---

Run `GradeCalculator.Average([70, 80, 90])` inside a test and get `80` back, and you have proven exactly one thing: for this input, on this code, right now, the method returns 80. That is a real fact, checked by a machine instead of asserted by a person, and it is also a much narrower fact than "the code works." Most of what makes unit testing useful, and most of what makes it misunderstood, lives in that gap.

## What a unit test proves — and what it doesn't

xUnit's own documentation draws the line procedurally rather than philosophically: "Facts are tests which are always true. They test invariant conditions," while "Theories are tests which are only true for a particular set of data" ([Getting Started with xUnit.net v3](https://xunit.net/docs/getting-started/v3/getting-started)). Calling a test a Fact is a claim about the code, not a guarantee from the framework: xUnit runs the one path your test builds and reports whether what it asserts held. It does not explore any path you didn't construct.

So a passing test demonstrates three things, no more:

- the code compiles and runs to completion,
- the exact inputs the test arranged produce the exact result the test asserted,
- and it did so on this run, on this machine.

It does **not** demonstrate that the method is correct for inputs nobody tried (a later section runs `GradeCalculator` on an input none of its tests cover, and the result is not obviously right), that no other part of the program is broken, or that the test will keep passing after the next edit — only that if you run this exact test again against this exact code, it keeps confirming the same narrow fact. That repeatable re-checking is genuinely valuable: Microsoft's own list of reasons to write [unit tests](/glossary/#unit-test) calls it "protection against regression" (Microsoft Learn, [Best practices for writing unit tests](https://learn.microsoft.com/en-us/dotnet/core/testing/unit-testing-best-practices)) — rerunning the suite catches a change that breaks a fact something already checks. It says nothing about a fact nothing checks.

## Arrange, Act, Assert

Every test in this article follows the same three-part shape: set up the situation, do the one thing under test, check the one outcome that matters. Bill Wake named and popularized this as "Arrange, Act, Assert" in 2001 ([3A – Arrange, Act, Assert](https://xp123.com/articles/3a-arrange-act-assert/)); Microsoft's unit-testing guidance teaches the same three steps under the same name, recommending that each stay visually separate so "assertions [don't] intermix with code in the Act task" (Microsoft Learn, [Best practices for writing unit tests](https://learn.microsoft.com/en-us/dotnet/core/testing/unit-testing-best-practices)).

The shape is a discipline, not a library feature — nothing in xUnit enforces it. The value is what it rules out: a test whose setup, action and check are tangled together is harder to read and hides which line would actually catch a regression.

## A first test, run for real

The class under test is a small grade calculator: `Average` takes a set of numeric scores and averages them, and `LetterGrade` maps an average onto a letter with the usual school boundaries. An empty array has no average, and LINQ's own `Average()` already throws for that case on its own — `InvalidOperationException`, with the generic message "Sequence contains no elements." `GradeCalculator.Average` guards for it explicitly anyway, so it can throw the same exception type with a message that says what actually went wrong: "cannot average zero scores." Neither method reaches out to a file, a clock or a network, so nothing about testing them needs a double — that subject belongs to [Mocks, Stubs and Fakes](/testing/test-doubles/), a later article.

Every program below ran against the .NET 10 SDK (10.0.401) on Windows 11, x64.

```csharp run id=grades
#:package xunit.v3@1.*
using Xunit;

public static class GradeCalculator
{
    public static double Average(int[] scores)
    {
        if (scores.Length == 0)
            throw new InvalidOperationException(
                "cannot average zero scores");
        return scores.Average();
    }

    public static char LetterGrade(double average) => average switch
    {
        >= 90 => 'A',
        >= 80 => 'B',
        >= 70 => 'C',
        >= 60 => 'D',
        _ => 'F'
    };
}

public class GradeCalculatorTests
{
    [Fact]
    public void Average_ThreeScores_ReturnsMean()
    {
        // Arrange
        int[] scores = [70, 80, 90];

        // Act
        var average = GradeCalculator.Average(scores);

        // Assert
        Assert.Equal(80, average);
    }

    [Fact]
    public void Average_EmptyArray_ThrowsInvalidOperationException()
    {
        // Arrange
        int[] scores = [];

        // Act & Assert
        var exception = Assert.Throws<InvalidOperationException>(
            () => GradeCalculator.Average(scores));
        Assert.Equal("cannot average zero scores", exception.Message);
    }

    [Theory]
    [InlineData(100, 'A')]
    [InlineData(90, 'A')]
    [InlineData(89.9, 'B')]
    [InlineData(80, 'B')]
    [InlineData(70, 'C')]
    [InlineData(60, 'D')]
    [InlineData(59.9, 'F')]
    [InlineData(0, 'F')]
    public void LetterGrade_BoundaryScore_ReturnsExpectedGrade(
        double average, char expected)
    {
        Assert.Equal(expected, GradeCalculator.LetterGrade(average));
    }
}
```

```text output
xUnit.net v3 In-Process Runner [...]
  Discovering: grades
  Discovered:  grades
  Starting:    grades
  Finished:    grades
=== TEST EXECUTION SUMMARY ===
   grades  Total: 10, Errors: 0, Failed: 0, Skipped: 0, Not Run: 0, Time: [...]
```

The `#:package xunit.v3@1.*` line is a file-based-app directive: it pulls in the NuGet package with no `.csproj` at all, and `dotnet run` compiles and runs the file directly ([File-based apps](https://learn.microsoft.com/en-us/dotnet/core/sdk/file-based-apps)). The rest is an ordinary xUnit test class. `Total: 10` is two `[Fact]` methods plus eight cases of one `[Theory]`, and every one of the ten ran and passed — that count is the actual proof that ten separate checks executed, not just that the file compiled.

`Average_ThreeScores_ReturnsMean` is the plainest AAA test in the file: three lines, three jobs, in order.

<figure class="diagram">
<svg viewBox="0 0 360 300" role="img" aria-labelledby="aaa-title aaa-desc">
<title id="aaa-title">The arrange, act and assert regions of one xUnit test</title>
<desc id="aaa-desc">Three stacked boxes labeled 1 Arrange, 2 Act and 3 Assert, each showing one line from Average_ThreeScores_ReturnsMean and what that line is for. A note below says only the assert box can fail the test.</desc>
<defs>
<marker id="aaa-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-stroke"/></marker>
</defs>
<rect x="20" y="16" width="320" height="70" rx="6" class="d-box"/>
<text x="34" y="36" class="d-bold">1 Arrange</text>
<text x="34" y="56" class="d-mono d-small">scores = [70, 80, 90]</text>
<text x="34" y="74" class="d-muted d-small">sets up the input</text>
<path d="M180 86 V106" class="d-line" marker-end="url(#aaa-arrow)"/>
<rect x="20" y="110" width="320" height="70" rx="6" class="d-box"/>
<text x="34" y="130" class="d-bold">2 Act</text>
<text x="34" y="150" class="d-mono d-small">average = Average(scores)</text>
<text x="34" y="168" class="d-muted d-small">calls the one thing under test</text>
<path d="M180 180 V200" class="d-line" marker-end="url(#aaa-arrow)"/>
<rect x="20" y="204" width="320" height="70" rx="6" class="d-box-accent"/>
<text x="34" y="224" class="d-bold">3 Assert</text>
<text x="34" y="244" class="d-mono d-small">Assert.Equal(80, average)</text>
<text x="34" y="262" class="d-muted d-small">checks the one outcome</text>
<text x="20" y="292" class="d-small d-muted">Only the assert box can fail this test.</text>
</svg>
<figcaption>Figure 1. Arrange builds the input, act calls the single method under test, assert checks the single result. Nothing before the assert can fail the test itself.</figcaption>
</figure>

The second test, `Average_EmptyArray_ThrowsInvalidOperationException`, collapses act and assert into one call for its first check: `Assert.Throws` both performs the act (invoking the delegate) and checks its type, so there is nothing to act on separately. That is a normal variation, not a broken pattern — arrange still comes first. The line after it checks the exception's message too, so the test pins down not just that `Average` throws on an empty array but what it says when it does — specific enough that deleting the custom guard, and falling back to LINQ's own generic exception, would turn this test red.

## Naming a test so the failure explains itself

All three test names above follow the same shape: what is being called, the situation, the expected result. Microsoft's guidance spells this out as three parts — "name of the method being tested," "scenario under which the method is being tested," "expected behavior when the scenario is invoked" — and gives the reasoning: a suite named this way documents the code without anyone opening it, and a failure names the exact scenario that broke (Microsoft Learn, [Best practices for writing unit tests](https://learn.microsoft.com/en-us/dotnet/core/testing/unit-testing-best-practices)). `Average_EmptyArray_ThrowsInvalidOperationException` is readable as a sentence even with the test body hidden: given an empty array, `Average` throws `InvalidOperationException`.

```csharp snippet of=grades
public void Average_ThreeScores_ReturnsMean()
public void Average_EmptyArray_ThrowsInvalidOperationException()
public void LetterGrade_BoundaryScore_ReturnsExpectedGrade(
```

The exact word order is not sacred — some teams write BDD-flavored names such as `Should_ReturnMean_When_GivenThreeScores` instead. What both styles share is the content: which method, which situation, which outcome. A name like `Test1` or `Average_Works` gives a failure message no more information than "something, somewhere, is wrong."

Good naming pays off fastest exactly when a test is red. The next test class has the same boundaries as `LetterGrade` above, with one change to the production code:

::::exercise[Find the bug]
One character is wrong in `LetterGrade` below, and one of the three theory cases catches it. Before scrolling down to the switch expression, see if the test names and the failure below are enough on their own to say which score is misclassified and in which direction (too high a letter, or too low).

```csharp run id=boundary-bug fails
#:package xunit.v3@1.*
using Xunit;

public static class GradeCalculator
{
    public static char LetterGrade(double average) => average switch
    {
        > 90 => 'A',
        >= 80 => 'B',
        >= 70 => 'C',
        >= 60 => 'D',
        _ => 'F'
    };
}

public class GradeCalculatorTests
{
    [Theory]
    [InlineData(95, 'A')]
    [InlineData(90, 'A')]
    [InlineData(85, 'B')]
    public void LetterGrade_BoundaryScore_ReturnsExpectedGrade(
        double average, char expected)
    {
        Assert.Equal(expected, GradeCalculator.LetterGrade(average));
    }
}
```

```text output
xUnit.net v3 In-Process Runner [...]
  Discovering: boundary-bug
  Discovered:  boundary-bug
  Starting:    boundary-bug
    GradeCalculatorTests.LetterGrade_BoundaryScore_ReturnsExpectedGrade(average: 90, expected: 'A') [FAIL]
      Assert.Equal() Failure: Values differ
      Expected: 'A'
      Actual:   'B'
      Stack Trace:
[...]
[...]
[...]
  Finished:    boundary-bug
=== TEST EXECUTION SUMMARY ===
   boundary-bug  Total: 3, Errors: 0, Failed: 1, Skipped: 0, Not Run: 0, Time: [...]
```

:::solution
The failing case name says it directly: `average: 90, expected: 'A'` got `'B'` instead — a score of exactly 90 is being graded one letter too low. The `>` in the `'A'` branch should be `>=`: with strict `>`, a score exactly on the 90 boundary falls through to the *next* branch (`>= 80`) instead of the one it belongs to. `[InlineData(95, 'A')]` and `[InlineData(85, 'B')]` sit safely inside their bands, so only the boundary case (90) exposes the bug — the same reason the theory earlier in this article tested `89.9` next to `90` instead of only round numbers.

```csharp run id=boundary-fixed
#:package xunit.v3@1.*
using Xunit;

public static class GradeCalculator
{
    public static char LetterGrade(double average) => average switch
    {
        >= 90 => 'A',
        >= 80 => 'B',
        >= 70 => 'C',
        >= 60 => 'D',
        _ => 'F'
    };
}

public class GradeCalculatorTests
{
    [Theory]
    [InlineData(95, 'A')]
    [InlineData(90, 'A')]
    [InlineData(85, 'B')]
    public void LetterGrade_BoundaryScore_ReturnsExpectedGrade(
        double average, char expected)
    {
        Assert.Equal(expected, GradeCalculator.LetterGrade(average));
    }
}
```

```text output
xUnit.net v3 In-Process Runner [...]
  Discovering: boundary-fixed
  Discovered:  boundary-fixed
  Starting:    boundary-fixed
  Finished:    boundary-fixed
=== TEST EXECUTION SUMMARY ===
   boundary-fixed  Total: 3, Errors: 0, Failed: 0, Skipped: 0, Not Run: 0, Time: [...]
```
:::
::::

## One method, many inputs: Theory and InlineData

Writing eight `[Fact]` methods for the eight rows in `LetterGrade_BoundaryScore_ReturnsExpectedGrade` would repeat the same three lines eight times with only the numbers changing. `[Theory]` plus `[InlineData]` runs the same method body once per row instead: xUnit's docs describe a Theory as true "only for a particular set of data," and state plainly that "each theory with its data set is a separate test" ([Getting Started with xUnit.net v3](https://xunit.net/docs/getting-started/v3/getting-started)). The exercise above showed what that means in practice — the failure report named the exact row (`average: 90, expected: 'A'`) as its own test, distinct from the two rows that passed, rather than reporting one lump failure for the method.

```csharp snippet of=grades
    [Theory]
    [InlineData(100, 'A')]
    [InlineData(90, 'A')]
    [InlineData(89.9, 'B')]
    [InlineData(80, 'B')]
    [InlineData(70, 'C')]
    [InlineData(60, 'D')]
    [InlineData(59.9, 'F')]
    [InlineData(0, 'F')]
    public void LetterGrade_BoundaryScore_ReturnsExpectedGrade(
```

Each `InlineData` row is picked to sit next to a boundary, not just inside a band: `89.9` next to `90`, `59.9` next to `60`. A theory of round numbers only (`95`, `85`, `75`...) would have passed against the buggy `>` version in the exercise above, because none of those rows land on a boundary. The value of a Theory is not "more test methods" — it is more *inputs* to the same rule, chosen to include the ones most likely to break it.

::::exercise[Predict, don't run]
The theory above never tests `59.99`, only `59.9` and `60`. Using the same rule as `LetterGrade` — `>= 60` is a D, anything lower is an F — what does `LetterGrade(59.99)` return? If a ninth row, `[InlineData(59.99, 'F')]`, were added to the theory, would it pass?

:::solution
`59.99` is less than `60`, so it falls through every `>=` case to the default arm: `'F'`. A row of `[InlineData(59.99, 'F')]` would pass, for the same reason `[InlineData(59.9, 'F')]` already does — both are below the D boundary, just by different margins. Running it confirms the reasoning instead of leaving it as a guess:

```csharp run id=predict-grade
Console.WriteLine(LetterGrade(59.99));

static char LetterGrade(double average) => average switch
{
    >= 90 => 'A',
    >= 80 => 'B',
    >= 70 => 'C',
    >= 60 => 'D',
    _ => 'F'
};
```

```text output
F
```
:::
::::

## A brittle test: right today, wrong after a harmless change

`GradeCalculator` grows a `Summarize` method that formats an average and a letter grade into one string, using a record for the pair:

```csharp run id=summarize-before
#:package xunit.v3@1.*
using Xunit;

public readonly record struct ReportCard(double Average, char Grade)
{
    public override string ToString() => $"{Average:F2} ({Grade})";
}

public static class GradeCalculator
{
    public static ReportCard Summarize(int[] scores)
    {
        var average = scores.Average();
        return new ReportCard(average, LetterGrade(average));
    }

    public static char LetterGrade(double average) => average switch
    {
        >= 90 => 'A',
        >= 80 => 'B',
        >= 70 => 'C',
        >= 60 => 'D',
        _ => 'F'
    };
}

public class ReportCardTests
{
    [Fact]
    public void Summarize_ThreeScores_FormatsReport()
    {
        int[] scores = [70, 80, 100];

        var report = GradeCalculator.Summarize(scores);

        Assert.Equal("83.33 (B)", report.ToString());
    }
}
```

```text output
xUnit.net v3 In-Process Runner [...]
  Discovering: summarize-before
  Discovered:  summarize-before
  Starting:    summarize-before
  Finished:    summarize-before
=== TEST EXECUTION SUMMARY ===
   summarize-before  Total: 1, Errors: 0, Failed: 0, Skipped: 0, Not Run: 0, Time: [...]
```

The test passes, and it looks reasonable: arrange three scores, act by summarizing, assert on the result. But look at what it actually pins down — not the average (83.33...), not the grade (`'B'`), but the exact two-decimal string `ReportCard.ToString()` happens to produce today. Suppose the team later decides one decimal place reads better and changes the format string from `F2` to `F1`. Nothing about which grade a student receives has changed. The test disagrees:

```csharp run id=summarize-after fails
#:package xunit.v3@1.*
using Xunit;

public readonly record struct ReportCard(double Average, char Grade)
{
    public override string ToString() => $"{Average:F1} ({Grade})";
}

public static class GradeCalculator
{
    public static ReportCard Summarize(int[] scores)
    {
        var average = scores.Average();
        return new ReportCard(average, LetterGrade(average));
    }

    public static char LetterGrade(double average) => average switch
    {
        >= 90 => 'A',
        >= 80 => 'B',
        >= 70 => 'C',
        >= 60 => 'D',
        _ => 'F'
    };
}

public class ReportCardTests
{
    [Fact]
    public void Summarize_ThreeScores_FormatsReport()
    {
        int[] scores = [70, 80, 100];

        var report = GradeCalculator.Summarize(scores);

        Assert.Equal("83.33 (B)", report.ToString());
    }

    [Fact]
    public void Summarize_ThreeScores_ReturnsAverageAndGrade()
    {
        int[] scores = [70, 80, 100];

        var report = GradeCalculator.Summarize(scores);

        Assert.Equal(83.33, report.Average, 2);
        Assert.Equal('B', report.Grade);
    }
}
```

```text output
xUnit.net v3 In-Process Runner [...]
  Discovering: summarize-after
  Discovered:  summarize-after
  Starting:    summarize-after
    ReportCardTests.Summarize_ThreeScores_FormatsReport [FAIL]
      Assert.Equal() Failure: Strings differ
                     ↓ (pos 4)
      Expected: "83.33 (B)"
      Actual:   "83.3 (B)"
                     ↑ (pos 4)
      Stack Trace:
[...]
[...]
[...]
  Finished:    summarize-after
=== TEST EXECUTION SUMMARY ===
   summarize-after  Total: 2, Errors: 0, Failed: 1, Skipped: 0, Not Run: 0, Time: [...]
```

That is a brittle test: it broke on a change that made no behavioral difference, and it will cost someone time to work out that the test, not the code, needed the update. `Summarize_ThreeScores_ReturnsAverageAndGrade` checks the same scenario without that cost — it asserts on `report.Average` and `report.Grade`, the values a caller actually depends on, instead of on the incidental detail of how `ToString` renders them. `Assert.Equal(83.33, report.Average, 2)` uses xUnit's precision overload, which rounds both sides to the given number of decimal places before comparing — the documented way to compare a `double` without hard-coding a floating-point value that may not be exactly representable ([EqualityAsserts.cs](https://github.com/xunit/assert.xunit/blob/main/EqualityAsserts.cs)). That second test passed against the same `F1`-formatted code that broke the first one, because reformatting a string a caller only reads for display was never a fact `Summarize`'s contract makes about its numbers.

:::pitfall
The general shape: a test is brittle when it asserts more than the behavior it claims to check requires. A string built for display, an internal collection's iteration order, an exact log message — each is a real detail of *how* the code currently does something, not of *what* it is supposed to do. Assert on the second kind of detail and a refactor is free to change the first kind without touching the tests.
:::

## An input nobody wrote a test for

Every test above uses scores between 0 and 100. `Average` never checks that range — nothing in its signature or its body rejects a negative number or a score over 100.

::::exercise[Prove it]
Write a test that calls `GradeCalculator.Average` with a score of `-10` mixed in among ordinary scores, and find out — don't guess — what the method actually does with it: does it throw, clamp the value, or something else?

:::solution
Nothing in `Average` singles out negative numbers, so a negative score is just averaged in like any other:

```csharp run id=negative-scores
#:package xunit.v3@1.*
using Xunit;

public static class GradeCalculator
{
    public static double Average(int[] scores)
    {
        if (scores.Length == 0)
            throw new InvalidOperationException(
                "cannot average zero scores");
        return scores.Average();
    }
}

public class GradeCalculatorTests
{
    [Fact]
    public void Average_NegativeScore_IsIncludedWithNoValidation()
    {
        int[] scores = [-10, 50, 90];

        var average = GradeCalculator.Average(scores);

        Assert.Equal(43.33, average, 2);
    }
}
```

```text output
xUnit.net v3 In-Process Runner [...]
  Discovering: negative-scores
  Discovered:  negative-scores
  Starting:    negative-scores
  Finished:    negative-scores
=== TEST EXECUTION SUMMARY ===
   negative-scores  Total: 1, Errors: 0, Failed: 0, Skipped: 0, Not Run: 0, Time: [...]
```

That passing test is not an endorsement — it is a record of the current, unvalidated behavior, written down so that if someone later decides `Average` should reject out-of-range scores, they change this test on purpose instead of discovering the old behavior by accident. This is the gap this article opened with: every test so far proves `GradeCalculator` correct for the inputs it was actually given, and this input, until just now, was not one of them.
:::
::::
