---
title: "Dynamic Programming: From Recursion to Tables"
description: "Coin change through brute-force recursion, a measured exponential blowup, memoization, tabulation, solution reconstruction, then LCS and edit distance."
pillar: algorithms
order: 6
author: markus
published: 2026-09-22
updated: 2026-09-22
level: intermediate
tags: [dynamic-programming, memoization, coin-change, longest-common-subsequence, edit-distance]
prerequisites: ["algorithms/recursion", "complexity/big-o-notation"]
sources:
  - title: "Introduction to Algorithms, 4th ed., chapter 14 (Dynamic Programming)"
    url: "https://mitpress.mit.edu/9780262046305/introduction-to-algorithms/"
    publisher: "MIT Press"
    accessed: 2026-09-22
  - title: "Levenshtein distance"
    url: "https://xlinux.nist.gov/dads/HTML/Levenshtein.html"
    publisher: "NIST Dictionary of Algorithms and Data Structures"
    accessed: 2026-09-22
  - title: "longest common subsequence"
    url: "https://xlinux.nist.gov/dads/HTML/longestCommonSubsequence.html"
    publisher: "NIST Dictionary of Algorithms and Data Structures"
    accessed: 2026-09-22
  - title: "Dictionary<TKey,TValue> Class"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.dictionary-2"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
draft: false
---

Given coins worth {1, 4, 5} and unlimited supply of each, making change for 12 with the fewest coins looks like a job for a simple rule: keep taking the largest coin that still fits.

```csharp run id=coin-greedy-fails
int[] coins = [5, 4, 1];
int amount = 12, remaining = amount, used = 0;
var picked = new List<int>();
foreach (int c in coins)
    while (remaining >= c)
    {
        picked.Add(c);
        remaining -= c;
        used++;
    }
Console.WriteLine($"greedy: {string.Join(" + ", picked)} = {used} coins");
```

```text output
greedy: 5 + 5 + 1 + 1 = 4 coins
```

Four coins, but three 4s also add up to 12. ["Always take the biggest coin" is not a proof of anything; it is a habit that happens to work for some coin systems and not others](/algorithms/greedy-algorithms/), and nothing about this run tells you which one you are in. Finding the true minimum means considering the possibilities, not guessing at one. The recursive definition of "fewest coins for amount *n*" says exactly what those possibilities are: 0 coins if *n* is 0, otherwise the best of trying each coin *c* and paying one coin plus however many the same question needs for *n − c*. That translates into code directly.

```csharp run id=coin-brute
int[] coins = [1, 4, 5];
int amount = 12;
long calls = 0;
int best = MinCoins(amount, coins, ref calls);
Console.WriteLine($"min coins for {amount}: {best}");
Console.WriteLine($"recursive calls: {calls}");

static int MinCoins(int amount, int[] coins, ref long calls)
{
    calls++;
    if (amount == 0) return 0;
    int best = int.MaxValue;
    foreach (int c in coins)
        if (c <= amount)
        {
            int sub = MinCoins(amount - c, coins, ref calls);
            if (sub + 1 < best) best = sub + 1;
        }
    return best;
}
```

```text output
min coins for 12: 3
recursive calls: 180
```

Three coins, confirming the 4-plus-4-plus-4 guess and beating greedy's four. `MinCoins` never considers a coin larger than what is left (`if (c <= amount)`), so it only ever recurses into remaining amounts that are still zero or positive; the base case, `amount == 0`, is the only place it stops without recursing further.

## The same remaining amount, asked from three different directions

180 calls to answer one small question is already more than the three coin values would suggest, and the reason is visible in the call tree itself: more than one path through the coins arrives at the same remaining amount.

<figure class="diagram">
<svg viewBox="0 0 340 215" role="img" aria-labelledby="cointree-title cointree-desc">
<title id="cointree-title">The first two levels of MinCoins(12)'s call tree</title>
<desc id="cointree-desc">A root labelled 12 branches into 11, 8 and 7. The 7 is highlighted. The 11 branches into 10, 7 and 6, with its 7 also highlighted. The 8 branches into 7, 4 and 3, with that 7 highlighted too, so the remaining amount 7 appears three times.</desc>
<path d="M170 34 L50 78" class="d-line"/>
<path d="M170 34 L170 78" class="d-line"/>
<path d="M170 34 L290 78" class="d-line"/>
<path d="M50 104 L17 148" class="d-line"/>
<path d="M50 104 L55 148" class="d-line"/>
<path d="M50 104 L93 148" class="d-line"/>
<path d="M170 104 L157 148" class="d-line"/>
<path d="M170 104 L195 148" class="d-line"/>
<path d="M170 104 L233 148" class="d-line"/>
<rect x="150" y="8" width="40" height="26" rx="5" class="d-box"/>
<text x="170" y="25" text-anchor="middle" class="d-mono">12</text>
<rect x="30" y="78" width="40" height="26" rx="5" class="d-box"/>
<text x="50" y="95" text-anchor="middle" class="d-mono">11</text>
<rect x="150" y="78" width="40" height="26" rx="5" class="d-box"/>
<text x="170" y="95" text-anchor="middle" class="d-mono">8</text>
<rect x="270" y="78" width="40" height="26" rx="5" class="d-box-accent"/>
<text x="290" y="95" text-anchor="middle" class="d-mono d-bold">7</text>
<rect x="0" y="148" width="34" height="26" rx="5" class="d-box"/>
<text x="17" y="165" text-anchor="middle" class="d-mono">10</text>
<rect x="38" y="148" width="34" height="26" rx="5" class="d-box-accent"/>
<text x="55" y="165" text-anchor="middle" class="d-mono d-bold">7</text>
<rect x="76" y="148" width="34" height="26" rx="5" class="d-box"/>
<text x="93" y="165" text-anchor="middle" class="d-mono">6</text>
<rect x="140" y="148" width="34" height="26" rx="5" class="d-box-accent"/>
<text x="157" y="165" text-anchor="middle" class="d-mono d-bold">7</text>
<rect x="178" y="148" width="34" height="26" rx="5" class="d-box"/>
<text x="195" y="165" text-anchor="middle" class="d-mono">4</text>
<rect x="216" y="148" width="34" height="26" rx="5" class="d-box"/>
<text x="233" y="165" text-anchor="middle" class="d-mono">3</text>
<text x="170" y="200" text-anchor="middle" class="d-small d-muted">Each box is a remaining amount passed to MinCoins</text>
</svg>
<figcaption>Figure 1. The first two levels of <code>MinCoins(12)</code>'s call tree for coins {1, 4, 5}. Remaining amount 7 is reached three separate times: directly from 12 (paying a 5), from 11 (paying a 4), and from 8 (paying a 1). Every highlighted box goes on to make the same further calls underneath it, independently, because none of the three knows the other two exist.</figcaption>
</figure>

Three occurrences of `MinCoins(7)` in the first two levels alone, each about to redo the same work as the other two: all three coins still fit at 7, so each one calls `MinCoins(6)`, `MinCoins(3)`, and `MinCoins(2)` next, and so on, three separate times. Nothing here is a coincidence of this particular amount — any time a target can be reached by more than one combination of coins, which is the normal case once there is more than one denomination, the paths that reach the same remaining amount recompute it from scratch. That repetition is what CLRS calls an **overlapping subproblem**: the recursion's tree of calls, unrolled, revisits the same argument many times. ([*Introduction to Algorithms*](https://mitpress.mit.edu/9780262046305/introduction-to-algorithms/), chapter 14, states this as one of the two properties — alongside optimal substructure, which `MinCoins` already relies on by combining the best answer to each subproblem — that make a problem a candidate for dynamic programming.)

## How bad it gets

A 180-call tree for amount 12 is not a problem on its own. What matters is the trend as the amount grows, since every extra unit of amount adds another layer where the tree can re-branch.

```csharp run id=coin-blowup
int[] coins = [1, 4, 5];
foreach (int amount in new[] { 10, 20, 30, 40 })
{
    long calls = 0;
    var sw = System.Diagnostics.Stopwatch.StartNew();
    int best = MinCoins(amount, coins, ref calls);
    double ms = sw.Elapsed.TotalMilliseconds;
    Console.WriteLine($"{amount,2}: {calls,8} calls  {ms,6:F1} ms");
}

static int MinCoins(int amount, int[] coins, ref long calls)
{
    calls++;
    if (amount == 0) return 0;
    int best = int.MaxValue;
    foreach (int c in coins)
        if (c <= amount)
        {
            int sub = MinCoins(amount - c, coins, ref calls);
            if (sub + 1 < best) best = sub + 1;
        }
    return best;
}
```

```text output
10:       79 calls  [...] ms
20:     4522 calls  [...] ms
30:   255904 calls  [...] ms
40: 14473707 calls  [...] ms
```

Measured with .NET 10.0.401 on Windows 11, x64: doubling the amount from 20 to 40 multiplies the call count by roughly 3,200, not by 2. That is exponential growth in the amount, not the linear or quadratic growth a loop-based algorithm would show, and it is why brute-force recursion is a working answer to "what is the minimum," never a shipped one — amount 40 alone spends [...] ms doing work that answer 12's tree already proved is mostly repeated.

## Remembering an answer instead of recomputing it

Every one of those calls that repeats a remaining amount asks a question this program has already answered. Caching that answer the first time and returning it on every later call — **memoization** — changes nothing about *which* calls the recursion wants to make, only whether each one does real work or hands back a stored result.

```csharp run id=coin-memo
int[] coins = [1, 4, 5];
foreach (int amount in new[] { 10, 20, 30, 40 })
{
    long calls = 0, computed = 0;
    var cache = new Dictionary<int, int>();
    var sw = System.Diagnostics.Stopwatch.StartNew();
    int best = MinCoinsMemo(amount, coins, cache, ref calls, ref computed);
    double ms = sw.Elapsed.TotalMilliseconds;
    Console.WriteLine(
        $"{amount,2}: {calls,3} calls, {computed,2} computed  {ms,6:F3} ms");
}

static int MinCoinsMemo(
    int amount, int[] coins, Dictionary<int, int> cache,
    ref long calls, ref long computed)
{
    calls++;
    if (amount == 0) return 0;
    if (cache.TryGetValue(amount, out int cached)) return cached;
    computed++;
    int best = int.MaxValue;
    foreach (int c in coins)
        if (c <= amount)
        {
            int sub = MinCoinsMemo(
                amount - c, coins, cache, ref calls, ref computed);
            if (sub + 1 < best) best = sub + 1;
        }
    cache[amount] = best;
    return best;
}
```

```text output
10:  24 calls, 10 computed  [...] ms
20:  54 calls, 20 computed  [...] ms
30:  84 calls, 30 computed  [...] ms
40: 114 calls, 40 computed  [...] ms
```

`computed` — the count of calls that miss the cache and do real work — equals the amount exactly, every time: there is one genuinely new subproblem per integer from 1 up to the target, and once each is solved it is never solved again. `calls`, the total number of invocations including cache hits, grows linearly too, because each of those O(*n*) real computations makes at most 3 recursive calls — one per coin that still fits, which is all 3 once the amount reaches the largest coin's value and fewer only for the handful of amounts below it — before returning. Both counts replace amount 40's 14.4 million-call tree with about a hundred calls, and the measured time drops from tens of milliseconds to a fraction of one. [`Dictionary<TKey,TValue>`'s own documentation](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.dictionary-2) describes key lookup as "close to O(1)... because [it] is implemented as a hash table," which is what keeps the cache check itself cheap regardless of how many amounts have already been solved.

::::exercise[Find the bug: a cache that is never read]
This version compiles, runs, and returns the correct answer for every amount — but measure its call count against the brute-force version above and it is no faster at all. What is missing?

```csharp run id=coin-memo-buggy
int[] coins = [1, 4, 5];
foreach (int amount in new[] { 10, 20, 30 })
{
    long calls = 0;
    var cache = new Dictionary<int, int>();
    int best = MinCoinsBuggy(amount, coins, cache, ref calls);
    Console.WriteLine($"{amount,2}: best={best,2} calls={calls,8}");
}

static int MinCoinsBuggy(
    int amount, int[] coins, Dictionary<int, int> cache, ref long calls)
{
    calls++;
    if (amount == 0) return 0;
    int best = int.MaxValue;
    foreach (int c in coins)
        if (c <= amount)
        {
            int sub = MinCoinsBuggy(amount - c, coins, cache, ref calls);
            if (sub + 1 < best) best = sub + 1;
        }
    cache[amount] = best;
    return best;
}
```

:::solution
`cache[amount] = best;` writes to the cache on the way out, but nothing ever reads from it on the way in — there is no `cache.TryGetValue` check before the recursive calls. Every call still expands its full subtree exactly as the brute-force version did:

```text output
10: best= 2 calls=      79
20: best= 4 calls=    4522
30: best= 6 calls=  255904
```

79, 4,522 and 255,904 are the same counts the brute-force table measured for the same amounts — the dictionary fills up correctly, entry by entry, and is simply never consulted. The fix is the single line the correct version has and this one doesn't: check the cache and return immediately on a hit, before doing any recursive work, not after.
:::
::::

Memoization still recurses, so it still pays for a stack frame per active call, all the way down to `amount == 0`. `MinCoins(1_000_000)` would need on the order of a million nested frames before its first result comes back — past the roughly 19,000-frame ceiling [recursion](/algorithms/recursion/#measuring-the-wall-stack-overflow-in-practice) measured on this machine — regardless of how fast the cache makes each individual frame's work. Filling the answers in the other direction avoids that ceiling entirely.

## Filling the table instead of asking for it

Tabulation computes the same subproblems bottom-up: start from the base case and build every larger amount from smaller ones already sitting in a table, so nothing is ever requested before it exists. Organizing the table by *which coins are allowed so far* — not just by amount — makes both the fill order and, shortly, the reconstruction straightforward: `dp[i, j]` is the fewest coins to make amount `j` using only the first `i` denominations, with unlimited copies of each.

<figure class="diagram">
<svg viewBox="0 0 340 180" role="img" aria-labelledby="cointable-title cointable-desc">
<title id="cointable-title">Part of the coin-change table for coins {1, 4, 5}</title>
<desc id="cointable-desc">A three-row, nine-column table of minimum-coin counts for amounts 0 to 8, one row per coin set considered so far. A curved arrow shows the bottom-right highlighted cell being filled from a cell five columns to its left in the same row, instead of from the row above.</desc>
<defs>
<marker id="cointable-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-accent"/></marker>
</defs>
<text x="6" y="20" class="d-mono d-small">i=1</text>
<text x="6" y="46" class="d-mono d-small">i=2</text>
<text x="6" y="72" class="d-mono d-small">i=3</text>
<rect x="40" y="6" width="256" height="22" rx="3" class="d-box"/>
<rect x="40" y="32" width="256" height="22" rx="3" class="d-box"/>
<rect x="200" y="58" width="32" height="22" rx="3" class="d-box-accent"/>
<rect x="40" y="58" width="160" height="22" rx="3" class="d-box"/>
<rect x="232" y="58" width="64" height="22" rx="3" class="d-box"/>
<rect x="40" y="58" width="32" height="22" rx="3" class="d-box-accent"/>
<text x="56" y="21" text-anchor="middle" class="d-mono d-small">0</text>
<text x="88" y="21" text-anchor="middle" class="d-mono d-small">1</text>
<text x="120" y="21" text-anchor="middle" class="d-mono d-small">2</text>
<text x="152" y="21" text-anchor="middle" class="d-mono d-small">3</text>
<text x="184" y="21" text-anchor="middle" class="d-mono d-small">4</text>
<text x="216" y="21" text-anchor="middle" class="d-mono d-small">5</text>
<text x="248" y="21" text-anchor="middle" class="d-mono d-small">6</text>
<text x="280" y="21" text-anchor="middle" class="d-mono d-small">7</text>
<text x="56" y="47" text-anchor="middle" class="d-mono d-small">0</text>
<text x="88" y="47" text-anchor="middle" class="d-mono d-small">1</text>
<text x="120" y="47" text-anchor="middle" class="d-mono d-small">2</text>
<text x="152" y="47" text-anchor="middle" class="d-mono d-small">3</text>
<text x="184" y="47" text-anchor="middle" class="d-mono d-small">1</text>
<text x="216" y="47" text-anchor="middle" class="d-mono d-small">2</text>
<text x="248" y="47" text-anchor="middle" class="d-mono d-small">3</text>
<text x="280" y="47" text-anchor="middle" class="d-mono d-small">4</text>
<text x="56" y="73" text-anchor="middle" class="d-mono d-bold">0</text>
<text x="88" y="73" text-anchor="middle" class="d-mono d-small">1</text>
<text x="120" y="73" text-anchor="middle" class="d-mono d-small">2</text>
<text x="152" y="73" text-anchor="middle" class="d-mono d-small">3</text>
<text x="184" y="73" text-anchor="middle" class="d-mono d-small">1</text>
<text x="216" y="73" text-anchor="middle" class="d-mono d-bold d-text-accent">1</text>
<text x="248" y="73" text-anchor="middle" class="d-mono d-small">2</text>
<text x="280" y="73" text-anchor="middle" class="d-mono d-small">3</text>
<path d="M56 84 C 130 108, 150 108, 210 84" class="d-accent" marker-end="url(#cointable-arrow)"/>
<text x="130" y="118" text-anchor="middle" class="d-text-accent d-small">dp[3][0] + 1, paying a 5</text>
<text x="6" y="140" class="d-muted d-small">Columns are amounts 0-8 (8 cut off at the</text>
<text x="6" y="154" class="d-muted d-small">right); rows are coins {1}, {1,4}, {1,4,5}</text>
<text x="6" y="168" class="d-muted d-small">allowed so far, filled top-to-bottom, left-to-right</text>
</svg>
<figcaption>Figure 2. Rows 1-3 of the coin-change table for amounts 0-8 (column 8 cropped for width; the full table continues the same way). <code>dp[3][5]</code>, highlighted, is filled from <code>dp[3][0]</code> five columns to its left in the *same* row — the cost of one more coin worth 5 — rather than from the cell directly above it, because reusing coin 5 beats not using it again at this amount.</figcaption>
</figure>

```csharp run id=coin-tabulate
int[] coins = [1, 4, 5];
int amount = 23;
var (dp, used) = FillTable(amount, coins);
Console.WriteLine($"min coins for {amount}: {dp[coins.Length, amount]}");
var chosen = Reconstruct(coins, used, amount);
Console.WriteLine($"coins used: {string.Join(" + ", chosen)}");
Console.WriteLine($"check: {chosen.Sum()} == {amount}");

static (int[,] dp, bool[,] used) FillTable(int amount, int[] coins)
{
    int k = coins.Length;
    var dp = new int[k + 1, amount + 1];
    var used = new bool[k + 1, amount + 1];
    const int Infinity = int.MaxValue / 2;
    for (int j = 1; j <= amount; j++) dp[0, j] = Infinity;
    for (int i = 1; i <= k; i++)
    {
        int coin = coins[i - 1];
        for (int j = 0; j <= amount; j++)
        {
            int skip = dp[i - 1, j];
            int take = coin <= j ? dp[i, j - coin] + 1 : Infinity;
            if (take < skip) { dp[i, j] = take; used[i, j] = true; }
            else { dp[i, j] = skip; used[i, j] = false; }
        }
    }
    return (dp, used);
}

static List<int> Reconstruct(int[] coins, bool[,] used, int amount)
{
    var chosen = new List<int>();
    int i = coins.Length, j = amount;
    while (j > 0)
    {
        if (used[i, j]) { chosen.Add(coins[i - 1]); j -= coins[i - 1]; }
        else i--;
    }
    return chosen;
}
```

```text output
min coins for 23: 5
coins used: 5 + 5 + 5 + 4 + 4
check: 23 == 23
```

Row `i = 0` (not shown in Figure 2) holds the base case: `dp[0, 0] = 0` and every other `dp[0, j]` is left at a large sentinel, because making a positive amount out of zero allowed coins is impossible. From there, each row only ever reads the row above it (`skip`, don't use this coin type again) and cells to its own left in the same row (`take`, use one more of the current coin) — never a cell below or to the right, which is exactly what makes filling it row by row, left to right, produce every value before it is needed.

## Getting the coins back, not just the count

`dp[coins.Length, amount]` on its own is a number, not an answer a person can hand a cashier. `used[i, j]` records, for every cell, whether reaching it took one more of the current coin or fell back to the row above — the same decision that filled the cell in the first place — so walking backward from `(coins.Length, amount)` and replaying those decisions in reverse reconstructs one actual set of coins that achieves the minimum. `Reconstruct` above does exactly that: on a `true` cell it records the coin and moves left by that coin's value in the same row; on a `false` cell it moves up a row without changing the amount. The `check` line confirms the reconstructed coins really do sum to the target, which is worth asserting in any program that reconstructs a solution rather than trusting the walk was implemented correctly by eye.

Nothing about `used` guarantees *the* minimal combination is unique — a tie between `take` and `skip` is broken here in favor of `take`, so a coin system with more than one way to hit the same minimum would report whichever one that tie-break happens to prefer, not every optimal answer.

## One array is enough

`dp[i, j]`'s `skip` branch only ever looks at row `i - 1`; its `take` branch only ever looks back along row `i` itself. No cell needs a row further back than the one just above it, so the whole table can collapse into a single array of size `amount + 1`, overwritten one coin at a time: before processing coin `i`, `dp[j]` still holds row `i - 1`'s value at `j` — exactly the `skip` case — and updating `dp[j]` from `dp[j - coin]` mid-pass reads a value already updated for the current coin, exactly the `take` case.

```csharp run id=coin-1d
int[] coins = [1, 4, 5];
int amount = 23;
var (dp, lastCoin) = FillTable1D(amount, coins);
Console.WriteLine($"min coins for {amount}: {dp[amount]}");
var chosen = Reconstruct1D(lastCoin, amount);
Console.WriteLine($"coins used: {string.Join(" + ", chosen)}");
Console.WriteLine($"check: {chosen.Sum()} == {amount}");

static (int[] dp, int[] lastCoin) FillTable1D(int amount, int[] coins)
{
    const int Infinity = int.MaxValue / 2;
    var dp = new int[amount + 1];
    var lastCoin = new int[amount + 1];
    for (int j = 1; j <= amount; j++) dp[j] = Infinity;
    foreach (int coin in coins)
        for (int j = coin; j <= amount; j++)
            if (dp[j - coin] + 1 < dp[j])
            {
                dp[j] = dp[j - coin] + 1;
                lastCoin[j] = coin;
            }
    return (dp, lastCoin);
}

static List<int> Reconstruct1D(int[] lastCoin, int amount)
{
    var chosen = new List<int>();
    int j = amount;
    while (j > 0)
    {
        chosen.Add(lastCoin[j]);
        j -= lastCoin[j];
    }
    return chosen;
}
```

```text output
min coins for 23: 5
coins used: 5 + 5 + 5 + 4 + 4
check: 23 == 23
```

Same answer, same reconstructed coins, in O(amount) space instead of O(amount × coins) — 24 integers for this run instead of 96. `lastCoin[j]` replaces the two-dimensional `used[i, j]`: it records only the *last* coin that improved `dp[j]`, anywhere across the whole run, so reconstruction is a straight walk — subtract `lastCoin[j]` from `j`, look up the new `j`, repeat — with no second dimension to step through. ([Space Complexity and the Memory Your Code Really Uses](/complexity/space-complexity/) covers how to turn an element count like this into actual measured bytes.)

::::exercise[Prove it: the two tables agree]
The 2D and 1D versions were written from the same recurrence, but that is a claim, not a proof. Confirm it by running both across a range of amounts and comparing every result — not just the one amount this article has been reconstructing.

:::solution
```csharp run id=coin-agree
int[] coins = [1, 4, 5];
bool allMatch = true;
for (int amount = 0; amount <= 200; amount++)
{
    var (dp2D, _) = FillTable(amount, coins);
    var (dp1D, _) = FillTable1D(amount, coins);
    if (dp2D[coins.Length, amount] != dp1D[amount])
    {
        allMatch = false;
        Console.WriteLine($"mismatch at {amount}");
    }
}
Console.WriteLine($"all match, 0..200: {allMatch}");

static (int[,] dp, bool[,] used) FillTable(int amount, int[] coins)
{
    int k = coins.Length;
    var dp = new int[k + 1, amount + 1];
    var used = new bool[k + 1, amount + 1];
    const int Infinity = int.MaxValue / 2;
    for (int j = 1; j <= amount; j++) dp[0, j] = Infinity;
    for (int i = 1; i <= k; i++)
    {
        int coin = coins[i - 1];
        for (int j = 0; j <= amount; j++)
        {
            int skip = dp[i - 1, j];
            int take = coin <= j ? dp[i, j - coin] + 1 : Infinity;
            if (take < skip) { dp[i, j] = take; used[i, j] = true; }
            else { dp[i, j] = skip; used[i, j] = false; }
        }
    }
    return (dp, used);
}

static (int[] dp, int[] lastCoin) FillTable1D(int amount, int[] coins)
{
    const int Infinity = int.MaxValue / 2;
    var dp = new int[amount + 1];
    var lastCoin = new int[amount + 1];
    for (int j = 1; j <= amount; j++) dp[j] = Infinity;
    foreach (int coin in coins)
        for (int j = coin; j <= amount; j++)
            if (dp[j - coin] + 1 < dp[j])
            {
                dp[j] = dp[j - coin] + 1;
                lastCoin[j] = coin;
            }
    return (dp, lastCoin);
}
```

```text output
all match, 0..200: True
```
:::
::::

## The same table shape, a different question: longest common subsequence

A **longest common subsequence** is "a maximum length... subsequence of two or more strings" — characters that appear in both, in the same relative order, not necessarily touching. ([NIST's *Dictionary of Algorithms and Data Structures*](https://xlinux.nist.gov/dads/HTML/longestCommonSubsequence.html); CLRS, chapter 14, works through the same problem as a worked example of the general technique.) The recursive definition matches coin change's shape closely: comparing the two strings' last characters either extends a shorter match by one (if they're equal) or falls back to the best of dropping the last character of either string (if they're not) — optimal substructure again, and the same last-character comparison gets repeated across many overlapping calls for longer strings.

```csharp run id=lcs
string a = "TABULATION";
string b = "MEMOIZATION";
var dp = LcsTable(a, b);
Console.WriteLine($"LCS length: {dp[a.Length, b.Length]}");
Console.WriteLine($"LCS: {Reconstruct(a, b, dp)}");

static int[,] LcsTable(string a, string b)
{
    var dp = new int[a.Length + 1, b.Length + 1];
    for (int i = 1; i <= a.Length; i++)
        for (int j = 1; j <= b.Length; j++)
            dp[i, j] = a[i - 1] == b[j - 1]
                ? dp[i - 1, j - 1] + 1
                : Math.Max(dp[i - 1, j], dp[i, j - 1]);
    return dp;
}

static string Reconstruct(string a, string b, int[,] dp)
{
    var chars = new Stack<char>();
    int i = a.Length, j = b.Length;
    while (i > 0 && j > 0)
    {
        if (a[i - 1] == b[j - 1])
        {
            chars.Push(a[i - 1]);
            i--; j--;
        }
        else if (dp[i - 1, j] >= dp[i, j - 1]) i--;
        else j--;
    }
    return new string(chars.ToArray());
}
```

```text output
LCS length: 5
LCS: ATION
```

`TABULATION` and `MEMOIZATION` share `ATION` as a common suffix, which the table finds without being told to look for a suffix specifically — `Reconstruct` walks backward from `dp[a.Length, b.Length]` exactly the way coin change's reconstruction walked backward from `dp[coins.Length, amount]`: on a matching pair of characters, take the character and move diagonally (both strings contributed to this position, the way `take` moved left along one row); otherwise, follow whichever neighbor — the cell above or the cell to the left — holds the larger value, since that neighbor is the one this cell's `Math.Max` actually kept. The table itself costs O(*n* × *m*) time and space for strings of length *n* and *m*, filled by two nested loops instead of coin change's one, because there are now two independent choices — how much of `a` and how much of `b` to consider — instead of one.

## The same table shape, a third time: edit distance

**Edit distance**, formally, is "the smallest number of insertions, deletions, and substitutions required to change one string... into another," and the standard algorithm to compute it runs in Θ(*m* × *n*) time — the same shape, for the same reason, as longest common subsequence. ([NIST DADS](https://xlinux.nist.gov/dads/HTML/Levenshtein.html), which attributes the technique to Vladimir Levenshtein's 1965 paper "Binary codes capable of correcting deletions, insertions, and reversals.") Where LCS asks "how much already matches," edit distance asks "how many changes turn one string into the other" — a different question over the same two-string, two-index state space, with a recurrence that differs from LCS's in one place: on a mismatch, it considers substituting one character for the other (moving diagonally at a cost of 1) in addition to dropping a character from either side.

```csharp run id=edit-distance
string a = "SUBPROBLEM";
string b = "SUBPROGRAM";
var dp = EditDistanceTable(a, b);
Console.WriteLine($"edit distance: {dp[a.Length, b.Length]}");

static int[,] EditDistanceTable(string a, string b)
{
    var dp = new int[a.Length + 1, b.Length + 1];
    for (int i = 0; i <= a.Length; i++) dp[i, 0] = i;
    for (int j = 0; j <= b.Length; j++) dp[0, j] = j;
    for (int i = 1; i <= a.Length; i++)
        for (int j = 1; j <= b.Length; j++)
        {
            int best = Math.Min(
                dp[i - 1, j - 1], Math.Min(dp[i - 1, j], dp[i, j - 1]));
            dp[i, j] = a[i - 1] == b[j - 1] ? dp[i - 1, j - 1] : 1 + best;
        }
    return dp;
}
```

```text output
edit distance: 3
```

`SUBPROBLEM` and `SUBPROGRAM` are both ten characters, share the first six (`SUBPRO`) and the last one (`M`), and differ in exactly the three characters between: `B/G`, `L/R`, `E/A`. Three substitutions turn one into the other, and the table confirms three is the minimum — no combination of insertions or deletions does better here, even though the recurrence is free to use them. The base cases carry the meaning directly: `dp[i, 0] = i` is "delete all of `a`'s first `i` characters to reach the empty string," and `dp[0, j] = j` is its mirror for inserting into an empty string, which is where every other cell's chain of comparisons ultimately bottoms out.

::::exercise[Extend it: print the edit script, not just its length]
`edit distance: 3` says how many edits, not which ones. Reuse the reconstruction technique from LCS and coin change — walk backward from `dp[a.Length, b.Length]`, following whichever of the three neighbors actually produced the stored value — to print the specific sequence of matches, substitutions, deletions and insertions that turns `SUBPROBLEM` into `SUBPROGRAM`.

:::solution
Recording which of the three predecessors (`dp[i-1,j-1]` on a match or substitution, `dp[i-1,j]` on a deletion, `dp[i,j-1]` on an insertion) actually produced each cell, alongside the distance itself, makes the backward walk a direct readout:

```csharp run id=edit-script
string a = "SUBPROBLEM";
string b = "SUBPROGRAM";
var (dp, ops) = BuildTables(a, b);
Console.WriteLine($"edit distance: {dp[a.Length, b.Length]}");
foreach (string line in Reconstruct(a, b, ops))
    Console.WriteLine(line);

static (int[,] dp, char[,] ops) BuildTables(string a, string b)
{
    var dp = new int[a.Length + 1, b.Length + 1];
    var ops = new char[a.Length + 1, b.Length + 1];
    for (int i = 0; i <= a.Length; i++) { dp[i, 0] = i; ops[i, 0] = 'D'; }
    for (int j = 0; j <= b.Length; j++) { dp[0, j] = j; ops[0, j] = 'I'; }
    for (int i = 1; i <= a.Length; i++)
        for (int j = 1; j <= b.Length; j++)
        {
            if (a[i - 1] == b[j - 1])
            {
                dp[i, j] = dp[i - 1, j - 1];
                ops[i, j] = '=';
                continue;
            }
            int sub = dp[i - 1, j - 1], del = dp[i - 1, j], ins = dp[i, j - 1];
            int best = Math.Min(sub, Math.Min(del, ins));
            dp[i, j] = 1 + best;
            ops[i, j] = best == sub ? 'S' : best == del ? 'D' : 'I';
        }
    return (dp, ops);
}

static List<string> Reconstruct(string a, string b, char[,] ops)
{
    var lines = new List<string>();
    int i = a.Length, j = b.Length;
    while (i > 0 || j > 0)
    {
        char op = ops[i, j];
        if (op == '=') { lines.Add($"match {a[i - 1]}"); i--; j--; }
        else if (op == 'S')
        {
            lines.Add($"sub   {a[i - 1]} -> {b[j - 1]}");
            i--; j--;
        }
        else if (op == 'D') { lines.Add($"del   {a[i - 1]}"); i--; }
        else { lines.Add($"ins   {b[j - 1]}"); j--; }
    }
    lines.Reverse();
    return lines;
}
```

```text output
edit distance: 3
match S
match U
match B
match P
match R
match O
sub   B -> G
sub   L -> R
sub   E -> A
match M
```

The three `sub` lines are exactly the three positions found by inspection earlier, in order, with the seven matches around them accounting for the rest of both ten-character strings.
:::
::::

## What makes a problem a dynamic-programming problem

Coin change went through all five stages; LCS and edit distance only needed the tabulated form and its reconstruction, because by then the recurrence was the only genuinely new part. All three share the same two properties CLRS names for dynamic programming generally: an optimal answer is built from optimal answers to smaller instances of the same question (optimal substructure), and the naive recursion that expresses this asks the same smaller instance more than once (overlapping subproblems). The **0/1 knapsack problem** — given items with weights and values and a weight capacity, choose a subset maximizing value without exceeding capacity — fits the same mold without needing its own worked example here: `best[i, w]`, the most value achievable using only the first `i` items within capacity `w`, is either `best[i-1, w]` (skip item `i`) or `best[i-1, w - weight(i)] + value(i)` (take it, if it fits) — one more two-choice recurrence over a two-dimensional index space, solvable with the identical row-by-row fill — O(items × capacity) time and space, the same shape of bound LCS and edit distance already paid — and the identical space-optimization argument this page applied twice already.

What differs between problems is the shape of the index space — one number for coin change, two for LCS, edit distance and knapsack — and the base case's meaning, not the technique. Recognizing "the answer to this depends on the answers to smaller versions of itself, and a direct recursive translation will ask for the same smaller version more than once" is the whole signal; everything from there is memoize it, or tabulate it and read the fill order off the recurrence.
