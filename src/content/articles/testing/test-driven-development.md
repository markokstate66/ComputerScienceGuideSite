---
title: "TDD Worked Example: Building a Bowling Scorer"
description: "A ten-pin bowling scorer built through five red-green-refactor laps in C# and xUnit, each one run for real, plus when TDD helps and when it gets in the way."
pillar: testing
order: 3
author: markus
published: 2026-09-22
updated: 2026-09-22
level: intermediate
tags: [tdd, red-green-refactor, katas, unit-testing, xunit]
prerequisites: ["testing/unit-testing-fundamentals"]
sources:
  - title: "Canon TDD"
    url: "https://newsletter.kentbeck.com/p/canon-tdd"
    publisher: "Kent Beck"
    accessed: 2026-09-22
  - title: "Test Driven Development"
    url: "https://martinfowler.com/bliki/TestDrivenDevelopment.html"
    publisher: "Martin Fowler"
    accessed: 2026-09-22
  - title: "Is TDD Dead?"
    url: "https://martinfowler.com/articles/is-tdd-dead/"
    publisher: "Martin Fowler, Kent Beck and David Heinemeier Hansson"
    accessed: 2026-09-22
  - title: "Adventures in C#: The Bowling Game"
    url: "https://ronjeffries.com/xprog/articles/acsbowling/"
    publisher: "Ron Jeffries"
    accessed: 2026-09-22
  - title: "Getting Started with xUnit.net v3"
    url: "https://xunit.net/docs/getting-started/v3/getting-started"
    publisher: "xUnit.net"
    accessed: 2026-09-22
  - title: "File-based apps"
    url: "https://learn.microsoft.com/en-us/dotnet/core/sdk/file-based-apps"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
draft: true
---

A red bar is not a bug report. It is the next sentence of a specification written in code, one test at a time, with the implementation kept just far enough ahead to satisfy the sentence already written and no further. This article writes one such specification end to end: a scorer for ten-pin bowling, through five real red-green-refactor laps. Every version of the code below is the actual file from that lap, compiled and run, not a cleaned-up retelling.

## The loop, and what each third of it is for

"Test-Driven Development (TDD) is a technique for building software that guides software development by writing tests," developed by Kent Beck "in the late 1990's as part of Extreme Programming" ([Test Driven Development](https://martinfowler.com/bliki/TestDrivenDevelopment.html), Martin Fowler). Its three repeating steps are usually shortened to **red, green, refactor**: write a test that fails, write just enough code to pass it, then improve the code's structure without changing what it does.

Beck's own recent restatement, [Canon TDD](https://newsletter.kentbeck.com/p/canon-tdd), spells out five steps rather than three, and the extra two matter for how this article is organized: start from a **list of the tests/behaviors you plan to write**, then for each one, write one test, make it pass, refactor if the code needs it, and cross that item off the list (adding new items as you notice them). The list is not a spec to complete before coding starts; it is scratch paper that changes as the code teaches you things. This article's version of that list is in the next section.

<figure class="diagram">
<svg viewBox="0 0 300 320" role="img" aria-labelledby="cycle-title cycle-desc">
<title id="cycle-title">The red-green-refactor loop</title>
<desc id="cycle-desc">Three stacked boxes, Red, Green and Refactor, connected top to bottom by down arrows. A fourth arrow loops from the right of Refactor back up to the right of Red, labelled repeat, showing the next lap starts immediately with a new failing test.</desc>
<defs>
<marker id="cycle-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-stroke"/></marker>
</defs>
<rect x="60" y="16" width="180" height="56" rx="8" class="d-box-bad"/>
<text x="150" y="40" text-anchor="middle" class="d-bold">1 · Red</text>
<text x="150" y="58" text-anchor="middle" class="d-small">a test that fails</text>
<path d="M150 72 V118" class="d-line" marker-end="url(#cycle-arrow)"/>
<text x="160" y="98" class="d-small d-muted">write it first</text>
<rect x="60" y="120" width="180" height="56" rx="8" class="d-box-good"/>
<text x="150" y="144" text-anchor="middle" class="d-bold">2 · Green</text>
<text x="150" y="162" text-anchor="middle" class="d-small">just enough code</text>
<path d="M150 176 V222" class="d-line" marker-end="url(#cycle-arrow)"/>
<text x="160" y="202" class="d-small d-muted">minimal fix</text>
<rect x="60" y="224" width="180" height="56" rx="8" class="d-box-accent"/>
<text x="150" y="248" text-anchor="middle" class="d-bold">3 · Refactor</text>
<text x="150" y="266" text-anchor="middle" class="d-small">tidy, tests stay green</text>
<path d="M240 252 H270 V44 H240" class="d-line" marker-end="url(#cycle-arrow)"/>
<text x="266" y="150" text-anchor="end" class="d-small d-muted">repeat</text>
<text x="60" y="298" class="d-small d-muted">Next lap: one item off the test</text>
<text x="60" y="314" class="d-small d-muted">list, in either order you choose.</text>
</svg>
<figcaption>Figure 1. Every lap starts with a failing test and ends with tidied code that still passes; refactoring is the step people skip under time pressure, and skipping it is what turns a passing suite into unreadable production code.</figcaption>
</figure>

## Ten-pin scoring, and a test list before any code

The scorer takes a sequence of rolls (pins knocked down per throw) and reports the game's total. A game has ten **frames**. In an **open frame**, the bowler gets two rolls and the frame scores the pins knocked down. Knock down all ten pins in two rolls and it is a **spare**, worth ten plus whatever the next roll knocks down. Knock them down in one roll and it is a **strike**, worth ten plus the next *two* rolls. The tenth frame gets extra fill balls when it ends in a spare or strike, so a player can always be credited the bonus they earned. This is standard ten-pin scoring, not something invented for this article; the bowling-game kata that walks through implementing it has circulated in the test-driven-development community since at least 2003, when Ron Jeffries published a worked version in C# ([Adventures in C#: The Bowling Game](https://ronjeffries.com/xprog/articles/acsbowling/)). The design and every test below are written fresh for this article, not taken from Jeffries' solution.

The trap is the lookahead: a frame's score is not knowable from that frame's own rolls alone once a strike or spare is involved. That is also exactly why the kata is worth doing — it is small enough to finish in an afternoon and has a genuine design problem inside it.

A starting test list, ordered easiest-first the way Canon TDD suggests:

1. A gutter game (every roll 0) scores 0.
2. A game of all ones scores 20.
3. A spare, followed by a known roll, scores that roll twice.
4. A strike, followed by two known rolls, scores both of them twice.
5. A perfect game (twelve strikes) scores 300.

Item 5 needs explaining before it looks reasonable: a perfect game is ten strikes, but the tenth frame's own strike earns two bonus balls, and both of those need to land to resolve its score. Nine frames at one roll each, plus three balls in the tenth, is twelve rolls total — fewer rolls than a game with no strikes at all takes (twenty, two per frame), even though it is the highest score a game can reach.

.NET 10.0.401 on Windows 11, x64 ran every program on this page.

## Lap 1: a gutter game

The first test can't even compile yet — there is no `Game` class:

```csharp run error=CS0246
#:package xunit.v3@1.*
using Xunit;

public class GameTests
{
    [Fact]
    public void GutterGame_ScoresZero()
    {
        var game = new Game();
        for (var i = 0; i < 20; i++)
            game.Roll(0);
        Assert.Equal(0, game.Score());
    }
}
```

A compiler error is a red bar too — it says just as clearly that the behavior does not exist yet. The smallest change that gets past it is a `Game` class with a `Roll` that does nothing and a `Score` that returns the one answer this test needs:

```csharp run id=bowling-v1
#:package xunit.v3@1.*
using Xunit;

public class Game
{
    public void Roll(int pins) { }
    public int Score() => 0;
}

public class GameTests
{
    [Fact]
    public void GutterGame_ScoresZero()
    {
        var game = new Game();
        for (var i = 0; i < 20; i++)
            game.Roll(0);
        Assert.Equal(0, game.Score());
    }
}
```

```text output
xUnit.net v3 In-Process Runner [...]
  Discovering: bowling-v1
  Discovered:  bowling-v1
  Starting:    bowling-v1
  Finished:    bowling-v1
=== TEST EXECUTION SUMMARY ===
   bowling-v1  Total: 1, Errors: 0, Failed: 0, Skipped: 0, Not Run: 0, Time: [...]
```

`Score` hard-coding `0` is not a shortcut taken for this article; it is a named move. Beck calls it **Fake It**: return the constant the current test needs, and let a later test force the constant into something real. Nothing here proves the code sums anything yet, which is precisely what the next test checks.

## Lap 2: forcing real arithmetic

Add the all-ones test against the code exactly as Lap 1 left it, and it fails, because `Score` still ignores every roll:

```csharp run id=bowling-v2-red fails
#:package xunit.v3@1.*
using Xunit;

public class Game
{
    public void Roll(int pins) { }
    public int Score() => 0;
}

public class GameTests
{
    [Fact]
    public void GutterGame_ScoresZero()
    {
        var game = new Game();
        for (var i = 0; i < 20; i++)
            game.Roll(0);
        Assert.Equal(0, game.Score());
    }

    [Fact]
    public void AllOnes_ScoresTwenty()
    {
        var game = new Game();
        for (var i = 0; i < 20; i++)
            game.Roll(1);
        Assert.Equal(20, game.Score());
    }
}
```

```text output
xUnit.net v3 In-Process Runner [...]
  Discovering: bowling-v2-red
  Discovered:  bowling-v2-red
  Starting:    bowling-v2-red
    GameTests.AllOnes_ScoresTwenty [FAIL]
      Assert.Equal() Failure: Values differ
      Expected: 20
      Actual:   0
      Stack Trace:
        [...]
           [...]
           [...]
  Finished:    bowling-v2-red
=== TEST EXECUTION SUMMARY ===
   bowling-v2-red  Total: 2, Errors: 0, Failed: 1, Skipped: 0, Not Run: 0, Time: [...]
```

The fake now has to become real. `Roll` records what it is given, and `Score` sums it:

```csharp run id=bowling-v2
#:package xunit.v3@1.*
using Xunit;

public class Game
{
    readonly List<int> rolls = [];
    public void Roll(int pins) => rolls.Add(pins);
    public int Score() => rolls.Sum();
}

public class GameTests
{
    [Fact]
    public void GutterGame_ScoresZero()
    {
        var game = new Game();
        for (var i = 0; i < 20; i++)
            game.Roll(0);
        Assert.Equal(0, game.Score());
    }

    [Fact]
    public void AllOnes_ScoresTwenty()
    {
        var game = new Game();
        for (var i = 0; i < 20; i++)
            game.Roll(1);
        Assert.Equal(20, game.Score());
    }
}
```

```text output
xUnit.net v3 In-Process Runner [...]
  Discovering: bowling-v2
  Discovered:  bowling-v2
  Starting:    bowling-v2
  Finished:    bowling-v2
=== TEST EXECUTION SUMMARY ===
   bowling-v2  Total: 2, Errors: 0, Failed: 0, Skipped: 0, Not Run: 0, Time: [...]
```

`rolls.Sum()` is correct for any game with no spares or strikes, and only for such a game. It is the "obvious implementation" move, not fake-it: there was no reason to write anything cleverer before a test asked for it.

## Lap 3: the spare's bonus roll

A spare (5, 5) followed by a 3, then out the rest of the game with gutters, should score 16: 10 for the spare plus the 3 bonus, then 3 for the next frame, then zero the rest of the way. Summing every roll instead gives 13 — the bonus roll counted once, when a spare needs it counted twice:

```csharp run id=bowling-v3-red fails
#:package xunit.v3@1.*
using Xunit;

public class Game
{
    readonly List<int> rolls = [];
    public void Roll(int pins) => rolls.Add(pins);
    public int Score() => rolls.Sum();
}

public class GameTests
{
    [Fact]
    public void GutterGame_ScoresZero()
    {
        var game = new Game();
        for (var i = 0; i < 20; i++)
            game.Roll(0);
        Assert.Equal(0, game.Score());
    }

    [Fact]
    public void AllOnes_ScoresTwenty()
    {
        var game = new Game();
        for (var i = 0; i < 20; i++)
            game.Roll(1);
        Assert.Equal(20, game.Score());
    }

    [Fact]
    public void SpareThenThree_ScoresSixteen()
    {
        var game = new Game();
        game.Roll(5);
        game.Roll(5);
        game.Roll(3);
        for (var i = 0; i < 17; i++)
            game.Roll(0);
        Assert.Equal(16, game.Score());
    }
}
```

```text output
xUnit.net v3 In-Process Runner [...]
  Discovering: bowling-v3-red
  Discovered:  bowling-v3-red
  Starting:    bowling-v3-red
    GameTests.SpareThenThree_ScoresSixteen [FAIL]
      Assert.Equal() Failure: Values differ
      Expected: 16
      Actual:   13
      Stack Trace:
        [...]
           [...]
           [...]
  Finished:    bowling-v3-red
=== TEST EXECUTION SUMMARY ===
   bowling-v3-red  Total: 3, Errors: 0, Failed: 1, Skipped: 0, Not Run: 0, Time: [...]
```

Fixing this needs a concept `Sum()` cannot express: frames, walked with a pointer into the rolls, where a spare consumes two rolls but scores three:

```csharp run id=bowling-v3
#:package xunit.v3@1.*
using Xunit;

public class Game
{
    readonly List<int> rolls = [];
    public void Roll(int pins) => rolls.Add(pins);

    public int Score()
    {
        var score = 0;
        var rollIndex = 0;
        for (var frame = 0; frame < 10; frame++)
        {
            if (IsSpare(rollIndex))
            {
                score += 10 + rolls[rollIndex + 2];
                rollIndex += 2;
            }
            else
            {
                score += rolls[rollIndex] + rolls[rollIndex + 1];
                rollIndex += 2;
            }
        }
        return score;
    }

    bool IsSpare(int rollIndex) =>
        rolls[rollIndex] + rolls[rollIndex + 1] == 10;
}

public class GameTests
{
    [Fact]
    public void GutterGame_ScoresZero()
    {
        var game = new Game();
        for (var i = 0; i < 20; i++)
            game.Roll(0);
        Assert.Equal(0, game.Score());
    }

    [Fact]
    public void AllOnes_ScoresTwenty()
    {
        var game = new Game();
        for (var i = 0; i < 20; i++)
            game.Roll(1);
        Assert.Equal(20, game.Score());
    }

    [Fact]
    public void SpareThenThree_ScoresSixteen()
    {
        var game = new Game();
        game.Roll(5);
        game.Roll(5);
        game.Roll(3);
        for (var i = 0; i < 17; i++)
            game.Roll(0);
        Assert.Equal(16, game.Score());
    }
}
```

```text output
xUnit.net v3 In-Process Runner [...]
  Discovering: bowling-v3
  Discovered:  bowling-v3
  Starting:    bowling-v3
  Finished:    bowling-v3
=== TEST EXECUTION SUMMARY ===
   bowling-v3  Total: 3, Errors: 0, Failed: 0, Skipped: 0, Not Run: 0, Time: [...]
```

The ten-frame loop is a deliberate, permanent design decision, not a value that happened to work for this test: a game is scored ten frames, always, regardless of how many rolls it takes to fill them. That decision is what makes the rest of this article's laps land where they do.

::::exercise[Predict a score before running anything]
Work out the total for this sequence by hand, using the rules above: roll 4 then 6 (a spare), then 5 then 5 (another spare), then sixteen more rolls of 0 to finish the game.

:::solution
25. Frame 1 is a spare (4 + 6), worth 10 plus its bonus — the next roll, which is frame 2's first ball, a 4... no: the next roll after frame 1 is the first roll of frame 2, which is 5. Frame 1 scores 10 + 5 = 15. Frame 2 is also a spare (5 + 5), worth 10 plus *its* bonus — the next roll, which is frame 3's first ball, a 0. Frame 2 scores 10 + 0 = 10. Frames 3 through 10 are all gutters. Total: 15 + 10 + 0 = 25.

The general rule this shows: a spare's bonus is always the single roll immediately following it, whatever frame that roll happens to open.
:::
::::

## Lap 4: the strike's two-roll bonus

A strike (10), then rolls of 3 and 4, then gutters, should score 24: the strike frame gets 10 + 3 + 4 = 17, the next frame gets 3 + 4 = 7, the rest score 0. `IsSpare` was written assuming every frame supplies two rolls to look at — a strike supplies one, so it reads into the next frame's rolls as if they belonged to this one, and the whole game runs eleven frames short of rolls by the time the pointer reaches the last one:

```csharp run id=bowling-v4-red fails
#:package xunit.v3@1.*
using Xunit;

public class Game
{
    readonly List<int> rolls = [];
    public void Roll(int pins) => rolls.Add(pins);

    public int Score()
    {
        var score = 0;
        var rollIndex = 0;
        for (var frame = 0; frame < 10; frame++)
        {
            if (IsSpare(rollIndex))
            {
                score += 10 + rolls[rollIndex + 2];
                rollIndex += 2;
            }
            else
            {
                score += rolls[rollIndex] + rolls[rollIndex + 1];
                rollIndex += 2;
            }
        }
        return score;
    }

    bool IsSpare(int rollIndex) =>
        rolls[rollIndex] + rolls[rollIndex + 1] == 10;
}

public class GameTests
{
    [Fact]
    public void GutterGame_ScoresZero()
    {
        var game = new Game();
        for (var i = 0; i < 20; i++)
            game.Roll(0);
        Assert.Equal(0, game.Score());
    }

    [Fact]
    public void AllOnes_ScoresTwenty()
    {
        var game = new Game();
        for (var i = 0; i < 20; i++)
            game.Roll(1);
        Assert.Equal(20, game.Score());
    }

    [Fact]
    public void SpareThenThree_ScoresSixteen()
    {
        var game = new Game();
        game.Roll(5);
        game.Roll(5);
        game.Roll(3);
        for (var i = 0; i < 17; i++)
            game.Roll(0);
        Assert.Equal(16, game.Score());
    }

    [Fact]
    public void StrikeThenThreeFour_ScoresTwentyFour()
    {
        var game = new Game();
        game.Roll(10);
        game.Roll(3);
        game.Roll(4);
        for (var i = 0; i < 16; i++)
            game.Roll(0);
        Assert.Equal(24, game.Score());
    }
}
```

```text output
xUnit.net v3 In-Process Runner [...]
  Discovering: bowling-v4-red
  Discovered:  bowling-v4-red
  Starting:    bowling-v4-red
    GameTests.StrikeThenThreeFour_ScoresTwentyFour [FAIL]
      System.ArgumentOutOfRangeException : Index was out of range. Must be non-negative and less than the size of the collection. (Parameter 'index')
      Stack Trace:
           [...]
        [...]
        [...]
        [...]
           [...]
           [...]
  Finished:    bowling-v4-red
=== TEST EXECUTION SUMMARY ===
   bowling-v4-red  Total: 4, Errors: 0, Failed: 1, Skipped: 0, Not Run: 0, Time: [...]
```

This is not a wrong number to fix; it is a missing branch. A strike is checked first, consumes one roll instead of two, and looks two rolls ahead instead of one:

```csharp run id=bowling-v4
#:package xunit.v3@1.*
using Xunit;

public class Game
{
    readonly List<int> rolls = [];
    public void Roll(int pins) => rolls.Add(pins);

    public int Score()
    {
        var score = 0;
        var rollIndex = 0;
        for (var frame = 0; frame < 10; frame++)
        {
            if (IsStrike(rollIndex))
            {
                score += 10 + rolls[rollIndex + 1] + rolls[rollIndex + 2];
                rollIndex += 1;
            }
            else if (IsSpare(rollIndex))
            {
                score += 10 + rolls[rollIndex + 2];
                rollIndex += 2;
            }
            else
            {
                score += rolls[rollIndex] + rolls[rollIndex + 1];
                rollIndex += 2;
            }
        }
        return score;
    }

    bool IsStrike(int rollIndex) => rolls[rollIndex] == 10;

    bool IsSpare(int rollIndex) =>
        rolls[rollIndex] + rolls[rollIndex + 1] == 10;
}

public class GameTests
{
    [Fact]
    public void GutterGame_ScoresZero()
    {
        var game = new Game();
        for (var i = 0; i < 20; i++)
            game.Roll(0);
        Assert.Equal(0, game.Score());
    }

    [Fact]
    public void AllOnes_ScoresTwenty()
    {
        var game = new Game();
        for (var i = 0; i < 20; i++)
            game.Roll(1);
        Assert.Equal(20, game.Score());
    }

    [Fact]
    public void SpareThenThree_ScoresSixteen()
    {
        var game = new Game();
        game.Roll(5);
        game.Roll(5);
        game.Roll(3);
        for (var i = 0; i < 17; i++)
            game.Roll(0);
        Assert.Equal(16, game.Score());
    }

    [Fact]
    public void StrikeThenThreeFour_ScoresTwentyFour()
    {
        var game = new Game();
        game.Roll(10);
        game.Roll(3);
        game.Roll(4);
        for (var i = 0; i < 16; i++)
            game.Roll(0);
        Assert.Equal(24, game.Score());
    }
}
```

```text output
xUnit.net v3 In-Process Runner [...]
  Discovering: bowling-v4
  Discovered:  bowling-v4
  Starting:    bowling-v4
  Finished:    bowling-v4
=== TEST EXECUTION SUMMARY ===
   bowling-v4  Total: 4, Errors: 0, Failed: 0, Skipped: 0, Not Run: 0, Time: [...]
```

## A checkpoint that needed no new code

Item 5 on the list was the perfect game: twelve strikes, score 300. Adding it to the same four tests, against the Lap 4 code unchanged, is worth running before assuming it needs another lap:

```csharp run id=bowling-v5
#:package xunit.v3@1.*
using Xunit;

public class Game
{
    readonly List<int> rolls = [];
    public void Roll(int pins) => rolls.Add(pins);

    public int Score()
    {
        var score = 0;
        var rollIndex = 0;
        for (var frame = 0; frame < 10; frame++)
        {
            if (IsStrike(rollIndex))
            {
                score += 10 + rolls[rollIndex + 1] + rolls[rollIndex + 2];
                rollIndex += 1;
            }
            else if (IsSpare(rollIndex))
            {
                score += 10 + rolls[rollIndex + 2];
                rollIndex += 2;
            }
            else
            {
                score += rolls[rollIndex] + rolls[rollIndex + 1];
                rollIndex += 2;
            }
        }
        return score;
    }

    bool IsStrike(int rollIndex) => rolls[rollIndex] == 10;

    bool IsSpare(int rollIndex) =>
        rolls[rollIndex] + rolls[rollIndex + 1] == 10;
}

public class GameTests
{
    [Fact]
    public void GutterGame_ScoresZero()
    {
        var game = new Game();
        for (var i = 0; i < 20; i++)
            game.Roll(0);
        Assert.Equal(0, game.Score());
    }

    [Fact]
    public void AllOnes_ScoresTwenty()
    {
        var game = new Game();
        for (var i = 0; i < 20; i++)
            game.Roll(1);
        Assert.Equal(20, game.Score());
    }

    [Fact]
    public void SpareThenThree_ScoresSixteen()
    {
        var game = new Game();
        game.Roll(5);
        game.Roll(5);
        game.Roll(3);
        for (var i = 0; i < 17; i++)
            game.Roll(0);
        Assert.Equal(16, game.Score());
    }

    [Fact]
    public void StrikeThenThreeFour_ScoresTwentyFour()
    {
        var game = new Game();
        game.Roll(10);
        game.Roll(3);
        game.Roll(4);
        for (var i = 0; i < 16; i++)
            game.Roll(0);
        Assert.Equal(24, game.Score());
    }

    [Fact]
    public void AllStrikes_ScoresThreeHundred()
    {
        var game = new Game();
        for (var i = 0; i < 12; i++)
            game.Roll(10);
        Assert.Equal(300, game.Score());
    }
}
```

```text output
xUnit.net v3 In-Process Runner [...]
  Discovering: bowling-v5
  Discovered:  bowling-v5
  Starting:    bowling-v5
  Finished:    bowling-v5
=== TEST EXECUTION SUMMARY ===
   bowling-v5  Total: 5, Errors: 0, Failed: 0, Skipped: 0, Not Run: 0, Time: [...]
```

Green on the first try. That is a legitimate outcome in TDD, not a failure to find a harder test: Lap 4's `for (frame = 0; frame < 10; ...)` already generalizes to any mix of strikes and spares, because it fixed the number of frames at ten and let `rollIndex` — not the frame count — track how many rolls each kind of frame consumes. A perfect game just exercises that generalization at its busiest.

That fixed bound is easy to lose without a test pinning it down. Swap the `for` loop for a `while (rollIndex < rolls.Count)` — plausible-looking code, since nothing about it mentions the number ten — and four of these five tests still pass, because none of them run out of rolls before the tenth frame ends. The perfect game does, since it has twelve rolls: after ten frames' worth of strikes the pointer sits at roll index 10, which is still less than 12, so the loop reads two more "frames" that were never there, one of which reaches past the end of the list:

```csharp run id=bowling-shortcut fails
#:package xunit.v3@1.*
using Xunit;

public class Game
{
    readonly List<int> rolls = [];
    public void Roll(int pins) => rolls.Add(pins);

    public int Score()
    {
        var score = 0;
        var rollIndex = 0;
        while (rollIndex < rolls.Count)
        {
            if (IsStrike(rollIndex))
            {
                score += 10 + rolls[rollIndex + 1] + rolls[rollIndex + 2];
                rollIndex += 1;
            }
            else if (IsSpare(rollIndex))
            {
                score += 10 + rolls[rollIndex + 2];
                rollIndex += 2;
            }
            else
            {
                score += rolls[rollIndex] + rolls[rollIndex + 1];
                rollIndex += 2;
            }
        }
        return score;
    }

    bool IsStrike(int rollIndex) => rolls[rollIndex] == 10;

    bool IsSpare(int rollIndex) =>
        rolls[rollIndex] + rolls[rollIndex + 1] == 10;
}

public class GameTests
{
    [Fact]
    public void GutterGame_ScoresZero()
    {
        var game = new Game();
        for (var i = 0; i < 20; i++)
            game.Roll(0);
        Assert.Equal(0, game.Score());
    }

    [Fact]
    public void AllOnes_ScoresTwenty()
    {
        var game = new Game();
        for (var i = 0; i < 20; i++)
            game.Roll(1);
        Assert.Equal(20, game.Score());
    }

    [Fact]
    public void SpareThenThree_ScoresSixteen()
    {
        var game = new Game();
        game.Roll(5);
        game.Roll(5);
        game.Roll(3);
        for (var i = 0; i < 17; i++)
            game.Roll(0);
        Assert.Equal(16, game.Score());
    }

    [Fact]
    public void StrikeThenThreeFour_ScoresTwentyFour()
    {
        var game = new Game();
        game.Roll(10);
        game.Roll(3);
        game.Roll(4);
        for (var i = 0; i < 16; i++)
            game.Roll(0);
        Assert.Equal(24, game.Score());
    }

    [Fact]
    public void AllStrikes_ScoresThreeHundred()
    {
        var game = new Game();
        for (var i = 0; i < 12; i++)
            game.Roll(10);
        Assert.Equal(300, game.Score());
    }
}
```

```text output
xUnit.net v3 In-Process Runner [...]
  Discovering: bowling-shortcut
  Discovered:  bowling-shortcut
  Starting:    bowling-shortcut
    GameTests.AllStrikes_ScoresThreeHundred [FAIL]
      System.ArgumentOutOfRangeException : Index was out of range. Must be non-negative and less than the size of the collection. (Parameter 'index')
      Stack Trace:
           [...]
        [...]
        [...]
           [...]
           [...]
  Finished:    bowling-shortcut
=== TEST EXECUTION SUMMARY ===
   bowling-shortcut  Total: 5, Errors: 0, Failed: 1, Skipped: 0, Not Run: 0, Time: [...]
```

That is the whole reason the perfect game belongs on the test list even when it looks redundant next to the strike test: it is the only scenario here where the frame count and the roll count genuinely diverge, so it is the only one that can catch this particular shortcut.

## Refactor: same five tests, a clearer `Score`

Nothing is red, so nothing here is required by a failing test — refactoring is optional in Canon TDD precisely because it is a judgment call about the code you already have, not a step a test can force. `Score` currently repeats "add to the total, advance the pointer" three times with the advance amount buried in each branch. Pulling frame-scoring and pointer-advancing apart into one method with an `out` parameter says what each branch means (a score, and how many rolls it used) instead of just what it does:

```csharp run id=bowling-v6
#:package xunit.v3@1.*
using Xunit;

public class Game
{
    readonly List<int> rolls = [];
    public void Roll(int pins) => rolls.Add(pins);

    public int Score()
    {
        var score = 0;
        var rollIndex = 0;
        for (var frame = 0; frame < 10; frame++)
        {
            score += FrameScore(rollIndex, out var ballsUsed);
            rollIndex += ballsUsed;
        }
        return score;
    }

    int FrameScore(int rollIndex, out int ballsUsed)
    {
        if (IsStrike(rollIndex))
        {
            ballsUsed = 1;
            return 10 + rolls[rollIndex + 1] + rolls[rollIndex + 2];
        }
        if (IsSpare(rollIndex))
        {
            ballsUsed = 2;
            return 10 + rolls[rollIndex + 2];
        }
        ballsUsed = 2;
        return rolls[rollIndex] + rolls[rollIndex + 1];
    }

    bool IsStrike(int rollIndex) => rolls[rollIndex] == 10;

    bool IsSpare(int rollIndex) =>
        rolls[rollIndex] + rolls[rollIndex + 1] == 10;
}

public class GameTests
{
    [Fact]
    public void GutterGame_ScoresZero()
    {
        var game = new Game();
        for (var i = 0; i < 20; i++)
            game.Roll(0);
        Assert.Equal(0, game.Score());
    }

    [Fact]
    public void AllOnes_ScoresTwenty()
    {
        var game = new Game();
        for (var i = 0; i < 20; i++)
            game.Roll(1);
        Assert.Equal(20, game.Score());
    }

    [Fact]
    public void SpareThenThree_ScoresSixteen()
    {
        var game = new Game();
        game.Roll(5);
        game.Roll(5);
        game.Roll(3);
        for (var i = 0; i < 17; i++)
            game.Roll(0);
        Assert.Equal(16, game.Score());
    }

    [Fact]
    public void StrikeThenThreeFour_ScoresTwentyFour()
    {
        var game = new Game();
        game.Roll(10);
        game.Roll(3);
        game.Roll(4);
        for (var i = 0; i < 16; i++)
            game.Roll(0);
        Assert.Equal(24, game.Score());
    }

    [Fact]
    public void AllStrikes_ScoresThreeHundred()
    {
        var game = new Game();
        for (var i = 0; i < 12; i++)
            game.Roll(10);
        Assert.Equal(300, game.Score());
    }
}
```

```text output
xUnit.net v3 In-Process Runner [...]
  Discovering: bowling-v6
  Discovered:  bowling-v6
  Starting:    bowling-v6
  Finished:    bowling-v6
=== TEST EXECUTION SUMMARY ===
   bowling-v6  Total: 5, Errors: 0, Failed: 0, Skipped: 0, Not Run: 0, Time: [...]
```

Same five tests, same five passes, and the only thing that changed is how easy `Score` is to read six months from now. That is what the refactor step buys, and it is only safe to spend that effort because the tests just above already say, mechanically, whether the meaning changed.

`Game` never needed a [test double](/testing/test-doubles/): it has no clock, no database, no network call, only pure arithmetic over an in-memory list. That is also why every test above is a plain `[Fact]` rather than an `[InlineData]`-driven `[Theory]` — each one sets up a genuinely different shape of game, not the same computation over a table of numbers — and why the whole suite runs in a fraction of a second, which is what makes running it after every one-line change practical in the first place. xUnit's runner reports that speed honestly: each block above is a self-contained program built on xUnit.net v3's in-process runner, and in xUnit.net v3 unit test projects "are stand-alone executables that can be directly run" rather than handed off to an external test host ([Getting Started with xUnit.net v3](https://xunit.net/docs/getting-started/v3/getting-started)); the `#:package xunit.v3@1.*` line at the top of each block is what pulls that runner into a single-file, project-free C# program ([File-based apps](https://learn.microsoft.com/en-us/dotnet/core/sdk/file-based-apps)).

## When TDD earns its keep, and when it gets in the way

This kata is close to the best case for TDD, and it is worth being specific about why, instead of treating that as a property of TDD in general. The rules of ten-pin bowling do not change while you are writing the code: every test above was knowable in advance, from the rules alone, before a line of `Game` existed. Kent Beck makes exactly this point about where the technique fits best: JUnit itself succeeded as an early TDD project because testing frameworks have "clear interfaces that make a sweet spot for TDD" ([Is TDD Dead?](https://martinfowler.com/articles/is-tdd-dead/), Kent Beck, David Heinemeier Hansson and Martin Fowler). A scoring function is exactly that shape: fixed inputs, fixed rules, one correct number out.

The same discussion is candid about where the fit is worse. Weighing whether a test is worth writing at all, Fowler notes that tests helping show software is useful to its user is not universal: "sometimes tests help with this (eg payroll calculations) and sometimes not (eg html rendering)." Heinemeier Hansson goes further about a different kind of UI-adjacent code: the discussion's own notes record that "he thinks that using TDD well in an MVC web app is harder than writing clean PHP." The common thread is not that UI code is untestable; it is that the *interface* under test is still being discovered rather than fixed, so a test written first pins down a shape that is likely to be thrown away within the hour. The bowling kata never has that problem: `Roll(int pins)` and `Score()` were the obvious interface from the first sentence of the rules, so committing to them in test 1 cost nothing.

That gives a rough, honest rule of thumb, not a universal one: TDD earns its keep fastest when the contract is stable and the hard part is getting the *logic* right (parsers, calculations, state machines, this kata) — the lookahead in `Score` is exactly the kind of thing a human proofreads badly and a test catches instantly. It earns its keep more slowly on exploratory work where the right interface is itself the open question — a spike to see whether an approach is even feasible, or a first pass at a UI where the layout will change twice before lunch. Writing the test first is not what buys correctness in either case; running a fast, specific check after every small change is, and on genuinely exploratory work that check can be cheaper to write once the shape has settled than before.

::::exercise[Extend the code yourself]
`Game.Roll` currently accepts any `int`, including negative numbers or values above 10. Real ten-pin bowling never has a roll like that. Add validation to `Roll` that throws `ArgumentOutOfRangeException` for any `pins` outside `0..10`, write the two tests that should have driven that change (one roll too low, one too high), and confirm the five existing tests still pass unmodified.
:::solution
```csharp run id=bowling-exercise
#:package xunit.v3@1.*
using Xunit;

public class Game
{
    readonly List<int> rolls = [];

    public void Roll(int pins)
    {
        if (pins < 0 || pins > 10)
            throw new ArgumentOutOfRangeException(
                nameof(pins), pins, "a roll knocks down 0-10 pins");
        rolls.Add(pins);
    }

    public int Score()
    {
        var score = 0;
        var rollIndex = 0;
        for (var frame = 0; frame < 10; frame++)
        {
            score += FrameScore(rollIndex, out var ballsUsed);
            rollIndex += ballsUsed;
        }
        return score;
    }

    int FrameScore(int rollIndex, out int ballsUsed)
    {
        if (IsStrike(rollIndex))
        {
            ballsUsed = 1;
            return 10 + rolls[rollIndex + 1] + rolls[rollIndex + 2];
        }
        if (IsSpare(rollIndex))
        {
            ballsUsed = 2;
            return 10 + rolls[rollIndex + 2];
        }
        ballsUsed = 2;
        return rolls[rollIndex] + rolls[rollIndex + 1];
    }

    bool IsStrike(int rollIndex) => rolls[rollIndex] == 10;

    bool IsSpare(int rollIndex) =>
        rolls[rollIndex] + rolls[rollIndex + 1] == 10;
}

public class GameTests
{
    [Fact]
    public void NegativeRoll_Throws()
    {
        var game = new Game();
        Assert.Throws<ArgumentOutOfRangeException>(
            () => game.Roll(-1));
    }

    [Fact]
    public void RollAboveTen_Throws()
    {
        var game = new Game();
        Assert.Throws<ArgumentOutOfRangeException>(
            () => game.Roll(11));
    }

    [Fact]
    public void AllStrikes_ScoresThreeHundred()
    {
        var game = new Game();
        for (var i = 0; i < 12; i++)
            game.Roll(10);
        Assert.Equal(300, game.Score());
    }
}
```

```text output
xUnit.net v3 In-Process Runner [...]
  Discovering: bowling-exercise
  Discovered:  bowling-exercise
  Starting:    bowling-exercise
  Finished:    bowling-exercise
=== TEST EXECUTION SUMMARY ===
   bowling-exercise  Total: 3, Errors: 0, Failed: 0, Skipped: 0, Not Run: 0, Time: [...]
```

Only the strike test is shown alongside the two new ones here to keep the listing short; the other four from Lap 4 onward pass unchanged too, since `Roll` still stores exactly what it is given once the value clears the new check. A frame that adds up to more than 10 without a strike (say, 6 then 6) is a *different* bug this validation does not catch, because it depends on the previous roll in the same frame — worth noticing as a reminder that "add validation" is rarely just one check.
:::
::::
