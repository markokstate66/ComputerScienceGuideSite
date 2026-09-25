---
title: "Backtracking: N-Queens, Sudoku and Pruning"
description: "Builds the choose, explore, un-choose backtracking template, solves N-Queens and Sudoku in C#, then measures exactly how many search nodes pruning skips."
pillar: algorithms
order: 8
author: markus
published: 2026-09-22
updated: 2026-09-22
level: intermediate
tags: [backtracking, recursion, state-space-search, n-queens, sudoku, pruning]
prerequisites: ["algorithms/recursion"]
sources:
  - title: "The Art of Computer Programming, Volume 4, Fascicle 5: Introduction to Backtracking"
    url: "https://www-cs-faculty.stanford.edu/~knuth/taocp.html"
    accessed: 2026-09-22
  - title: "6.6 Intractability"
    url: "https://algs4.cs.princeton.edu/66intractability/"
    publisher: "Algorithms, 4th ed. (Sedgewick & Wayne)"
    accessed: 2026-09-22
  - title: "17.3 Array creation - Arrays, C# language specification"
    url: "https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/language-specification/arrays"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
draft: false
---

Place a queen in every row of a chessboard, one column each, so that no two attack each other. At row 0 there are 8 columns to try. Whichever one you pick, row 1 again has columns to try — some now ruled out by row 0's queen, some not. Draw every row's every choice as a branch and you get a **state-space tree**: each node is a partial assignment (which columns are taken so far), the root is the empty board, and a leaf is either a complete, valid board or a dead end. Backtracking is depth-first search over that tree, with one extra move: after exploring everything below a node, undo the choice that led to it before trying the next one.

## Choose, explore, un-choose

The whole technique is one template, reused at every node: **choose** an option and record it in shared state, **explore** by recursing one level deeper, then **un-choose** — undo exactly what was recorded — before the loop tries the next option. [Donald Knuth's characterization of backtrack programming](https://www-cs-faculty.stanford.edu/~knuth/taocp.html), in *The Art of Computer Programming*, Volume 4, Fascicle 5, is the same idea stated formally: search a state space depth-first, and whenever a partial choice cannot possibly extend to a solution, abandon that branch rather than continuing to build on it.

The smallest version of the template ignores whether choices are any good and just enumerates them. For three rows and three columns, one queen per row, one column each:

```csharp run id=column-permutations
int n = 3;
var usedColumn = new bool[n];
var columns = new int[n];
var found = 0;

Assign(0);

void Assign(int row)
{
    if (row == n)
    {
        found++;
        Console.WriteLine(string.Join(",", columns));
        return;
    }
    for (int col = 0; col < n; col++)
    {
        if (usedColumn[col]) continue;
        usedColumn[col] = true;   // choose
        columns[row] = col;
        Assign(row + 1);          // explore
        usedColumn[col] = false;  // un-choose
    }
}

Console.WriteLine($"{found} total assignments");
```

```text output
0,1,2
0,2,1
1,0,2
1,2,0
2,0,1
2,1,0
6 total assignments
```

`usedColumn` and `columns` are shared across the whole recursion — every call reads and writes the same arrays. The `un-choose` line is what makes that safe: without it, the loop's next iteration would start from whatever the previous branch left behind rather than from a clean board, and options would leak between branches that are supposed to be independent. This exact bug, and what it does to the output, is worth seeing once; it comes up again below.

`Assign` never checks whether a placement is any good — every row tries every unused column, so it visits all `3 × 2 × 1 = 6` leaves and nothing more, because a permutation already uses each column once. That restriction (no repeated columns) is baked into the state space itself, not something the search decides to skip; it is why the count is 6 and not `3³ = 27`. What the search has not decided anything about yet is diagonals, which is where N-Queens actually gets hard.

## Eight queens, checked early versus checked late

Two queens attack each other if they share a row, a column, or a diagonal. One queen per row, one column each, rules out the first two. Only the diagonal test is left, and there are two ways to apply it:

- **Check only at the end.** Build a complete column assignment exactly like `Assign` above, then look at the finished board once and see if any pair of queens shares a diagonal.
- **Check before each choice.** Before placing a queen in row `r`, column `c`, check whether it shares a diagonal with any queen already on the board. If it does, skip that column without recursing into it at all.

Both visit the same *kind* of tree — one queen per row, columns not repeated — so a fair comparison runs both over identical input and counts how many nodes the recursive function actually enters, once per call:

```csharp run id=queens-naive-vs-pruned
const int n = 8;

int naiveNodes = 0;
int prunedNodes = 0;
var naiveSolutions = new List<int[]>();
var prunedSolutions = new List<int[]>();

// Check late: try every unused column, and only test the diagonals
// once all n columns have been chosen.
void SolveNaive(int row, int[] cols, bool[] usedCol)
{
    naiveNodes++;
    if (row == n)
    {
        if (IsDiagonallySafe(cols)) naiveSolutions.Add((int[])cols.Clone());
        return;
    }
    for (int c = 0; c < n; c++)
    {
        if (usedCol[c]) continue;
        usedCol[c] = true;
        cols[row] = c;
        SolveNaive(row + 1, cols, usedCol);
        usedCol[c] = false;
    }
}

bool IsDiagonallySafe(int[] cols)
{
    for (int r1 = 0; r1 < n; r1++)
        for (int r2 = r1 + 1; r2 < n; r2++)
            if (Math.Abs(cols[r1] - cols[r2]) == r2 - r1)
                return false;
    return true;
}

// Check early: track both diagonal directions incrementally and
// skip a column the moment it conflicts, before recursing into it.
void SolvePruned(int row, int[] cols, bool[] usedCol, bool[] usedDiagUp, bool[] usedDiagDown)
{
    prunedNodes++;
    if (row == n)
    {
        prunedSolutions.Add((int[])cols.Clone());
        return;
    }
    for (int c = 0; c < n; c++)
    {
        int up = row - c + n - 1;   // constant along a "\" diagonal
        int down = row + c;         // constant along a "/" diagonal
        if (usedCol[c] || usedDiagUp[up] || usedDiagDown[down]) continue;
        usedCol[c] = true; usedDiagUp[up] = true; usedDiagDown[down] = true;
        cols[row] = c;
        SolvePruned(row + 1, cols, usedCol, usedDiagUp, usedDiagDown);
        usedCol[c] = false; usedDiagUp[up] = false; usedDiagDown[down] = false;
    }
}

SolveNaive(0, new int[n], new bool[n]);
SolvePruned(0, new int[n], new bool[n], new bool[2 * n - 1], new bool[2 * n - 1]);

// Closed form for "check late": one queen per row, columns not
// repeated, is a tree with n children at the root, n-1 at the next
// level, and so on — the count of partial column assignments of
// every length from 0 to n.
long ExpectedTreeSize(int width)
{
    long total = 1, term = 1;
    for (int d = 0; d < width; d++)
    {
        term *= width - d;
        total += term;
    }
    return total;
}

Console.WriteLine($"naive nodes visited:  {naiveNodes}");
Console.WriteLine($"pruned nodes visited: {prunedNodes}");
Console.WriteLine($"closed-form tree size for n={n}: {ExpectedTreeSize(n)}");
Console.WriteLine($"naive solutions found:  {naiveSolutions.Count}");
Console.WriteLine($"pruned solutions found: {prunedSolutions.Count}");
```

```text output
naive nodes visited:  109601
pruned nodes visited: 2057
closed-form tree size for n=8: 109601
naive solutions found:  92
pruned solutions found: 92
```

Measured with .NET 10.0.x on Windows 11, x64: checking early visits 2,057 nodes; checking late visits 109,601, and that number is exact, not approximate — it matches the closed-form count of every partial column assignment from length 0 to 8, because "check late" is defined to visit that entire tree regardless of what it finds. Checking early visits about 1.9% as many nodes, and both variants agree on the answer: 92 solutions for 8 queens, the same 92 either way (comparing the two search's solution sets is itself a correctness check — if a bug made one variant prune something it shouldn't, the counts would disagree).

<figure class="diagram">
<svg viewBox="0 0 340 230" role="img" aria-labelledby="qtree-title qtree-desc">
<title id="qtree-title">Partial state-space tree for 4-Queens, one branch pruned</title>
<desc id="qtree-desc">A root box for the empty board branches into four boxes for row 0's column choice. Only the column-0 branch is expanded: it leads to three row-1 boxes, one marked as pruned because it shares a diagonal with the row-0 queen, and two marked safe and explored further.</desc>
<rect x="120" y="8" width="100" height="32" rx="6" class="d-box-accent"/>
<text x="170" y="29" text-anchor="middle" class="d-mono d-small">empty board</text>
<path d="M170 40 L36 64" class="d-line"/>
<path d="M170 40 L122 64" class="d-line"/>
<path d="M170 40 L208 64" class="d-line"/>
<path d="M170 40 L294 64" class="d-line"/>
<rect x="4" y="64" width="64" height="30" rx="6" class="d-box-accent"/>
<text x="36" y="84" text-anchor="middle" class="d-mono d-small">r0 c0</text>
<rect x="90" y="64" width="64" height="30" rx="6" class="d-box"/>
<text x="122" y="84" text-anchor="middle" class="d-mono d-small">r0 c1</text>
<rect x="176" y="64" width="64" height="30" rx="6" class="d-box"/>
<text x="208" y="84" text-anchor="middle" class="d-mono d-small">r0 c2</text>
<rect x="262" y="64" width="64" height="30" rx="6" class="d-box"/>
<text x="294" y="84" text-anchor="middle" class="d-mono d-small">r0 c3</text>
<path d="M122 94 L122 108" class="d-line d-dashed"/>
<path d="M208 94 L208 108" class="d-line d-dashed"/>
<path d="M294 94 L294 108" class="d-line d-dashed"/>
<text x="122" y="120" text-anchor="middle" class="d-muted d-small">...</text>
<text x="208" y="120" text-anchor="middle" class="d-muted d-small">...</text>
<text x="294" y="120" text-anchor="middle" class="d-muted d-small">...</text>
<path d="M36 94 L36 140" class="d-line"/>
<path d="M36 94 L122 140" class="d-line"/>
<path d="M36 94 L208 140" class="d-line"/>
<rect x="4" y="140" width="64" height="30" rx="6" class="d-box-bad"/>
<text x="36" y="160" text-anchor="middle" class="d-mono d-small">r1 c1</text>
<rect x="90" y="140" width="64" height="30" rx="6" class="d-box-good"/>
<text x="122" y="160" text-anchor="middle" class="d-mono d-small">r1 c2</text>
<rect x="176" y="140" width="64" height="30" rx="6" class="d-box-good"/>
<text x="208" y="160" text-anchor="middle" class="d-mono d-small">r1 c3</text>
<text x="36" y="184" text-anchor="middle" class="d-text-bad d-small">attacked</text>
<text x="122" y="184" text-anchor="middle" class="d-text-good d-small">safe</text>
<text x="208" y="184" text-anchor="middle" class="d-text-good d-small">safe</text>
<text x="170" y="212" text-anchor="middle" class="d-muted d-small">row 0's other columns branch the same way</text>
</svg>
<figcaption>Figure 1. In a 4-queens search, once row 0's queen is in column 0, row 1's column 1 is skipped without recursing because it shares a diagonal with it; columns 2 and 3 are explored.</figcaption>
</figure>

The diagram is deliberately small — 4 queens, one branch expanded — because the point is the shape, not the count: a pruned branch is never entered, so no call happens for it and nothing below it is drawn. The 8-queens numbers above come from `usedDiagUp`/`usedDiagDown`, two `bool[]` arrays indexed by the two diagonal directions (`row - col`, shifted to stay non-negative, and `row + col`). Both start out `false` in every slot — [the C# language specification guarantees that elements of an array created by `new` are always initialized to their type's default value](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/language-specification/arrays#173-array-creation), which is `false` for `bool` — so no explicit setup is needed before the first row starts choosing columns.

:::pitfall
It is easy to track one diagonal direction and forget the other; both look similar and a board that only checks one still rejects *most* bad placements, so a quick glance at the output can look plausible. The exercise below measures exactly what that mistake does.
:::

::::exercise[Find the missing check]
Take `SolvePruned` above and delete `usedDiagDown` entirely: drop it from the parameter list, the `continue` condition, and both places that set it. Run the result for `n = 5`. Does the reported solution count go up, down, or land on the right number by coincidence — and are all of the boards it accepts actually safe?

:::solution
Dropping `usedDiagDown` means the search only rejects queens sharing a `row - col` diagonal; two queens sharing a `row + col` diagonal (the other direction) are never checked, so some accepted boards are not actually safe, and the count comes out too high:

```csharp run id=buggy-diagonal-fixed
const int n = 5;

bool IsSafeBoard(int[] cols)
{
    for (int r1 = 0; r1 < n; r1++)
        for (int r2 = r1 + 1; r2 < n; r2++)
            if (cols[r1] == cols[r2] || Math.Abs(cols[r1] - cols[r2]) == r2 - r1)
                return false;
    return true;
}

var usedCol = new bool[n];
var usedDiagUp = new bool[2 * n - 1];
var cols = new int[n];
var buggyBoards = new List<int[]>();

BuggySolve(0);

void BuggySolve(int row)
{
    if (row == n) { buggyBoards.Add((int[])cols.Clone()); return; }
    for (int c = 0; c < n; c++)
    {
        int up = row - c + n - 1;
        if (usedCol[c] || usedDiagUp[up]) continue;
        usedCol[c] = true; usedDiagUp[up] = true;
        cols[row] = c;
        BuggySolve(row + 1);
        usedCol[c] = false; usedDiagUp[up] = false;
    }
}

int invalid = buggyBoards.Count(b => !IsSafeBoard(b));
Console.WriteLine($"buggy solver accepted {buggyBoards.Count} boards, {invalid} of them not actually safe");

var usedDiagDown = new bool[2 * n - 1];
Array.Clear(usedCol); Array.Clear(usedDiagUp);
int fixedCount = 0;
FixedSolve(0);

void FixedSolve(int row)
{
    if (row == n) { fixedCount++; return; }
    for (int c = 0; c < n; c++)
    {
        int up = row - c + n - 1, down = row + c;
        if (usedCol[c] || usedDiagUp[up] || usedDiagDown[down]) continue;
        usedCol[c] = true; usedDiagUp[up] = true; usedDiagDown[down] = true;
        cols[row] = c;
        FixedSolve(row + 1);
        usedCol[c] = false; usedDiagUp[up] = false; usedDiagDown[down] = false;
    }
}

Console.WriteLine($"fixed solver finds {fixedCount} solutions for n={n}");
```

```text output
buggy solver accepted 23 boards, 13 of them not actually safe
fixed solver finds 10 solutions for n=5
```

Missing a single check does not fail loudly — the program still runs, still returns an integer, and that integer is simply wrong. Only re-validating each accepted board against the full safety rule, or comparing against a version that checks both diagonals, surfaces the bug.
:::
::::

## How much does checking early actually buy, and does it change with size?

The 8-queens ratio (about 1.9%) is one data point. Measuring the same comparison at a few more sizes shows whether that ratio is stable, without claiming to prove anything about how it behaves in the limit:

```csharp run id=queens-scale
Console.WriteLine($"{"n",3} {"naive",9} {"pruned",7} {"ratio",7}");
foreach (int n in new[] { 4, 6, 8, 10 })
{
    int naiveNodes = 0, prunedNodes = 0;
    var usedColN = new bool[n];
    void SolveNaive(int row)
    {
        naiveNodes++;
        if (row == n) return;
        for (int c = 0; c < n; c++)
        {
            if (usedColN[c]) continue;
            usedColN[c] = true;
            SolveNaive(row + 1);
            usedColN[c] = false;
        }
    }
    SolveNaive(0);

    var usedCol = new bool[n];
    var usedUp = new bool[2 * n - 1];
    var usedDown = new bool[2 * n - 1];
    void SolvePruned(int row)
    {
        prunedNodes++;
        if (row == n) return;
        for (int c = 0; c < n; c++)
        {
            int up = row - c + n - 1, down = row + c;
            if (usedCol[c] || usedUp[up] || usedDown[down]) continue;
            usedCol[c] = true; usedUp[up] = true; usedDown[down] = true;
            SolvePruned(row + 1);
            usedCol[c] = false; usedUp[up] = false; usedDown[down] = false;
        }
    }
    SolvePruned(0);

    double ratio = 100.0 * prunedNodes / naiveNodes;
    Console.WriteLine($"{n,3} {naiveNodes,9} {prunedNodes,7} {ratio,6:F2}%");
}
```

```text output
  n     naive  pruned   ratio
  4        65      17  26.15%
  6      1957     153   7.82%
  8    109601    2057   1.88%
 10   9864101   35539   0.36%
```

The fraction of the tree that checking early actually enters keeps shrinking as the board grows — from about a quarter at `n = 4` to well under half a percent at `n = 10`. That is a real, measured trend over four sizes, not a derivation, and it says nothing on its own about what happens at, say, `n = 30`; the section on what these numbers prove comes back to exactly that gap.

## The same pattern on a grid of digits: a Sudoku solver

Sudoku is choose/explore/un-choose over a different kind of state: instead of one column per row, it is one digit per empty cell, and a placement is safe when its row, column and 3×3 box don't already contain that digit. The template does not change — the "cell" plays the role "row" played in N-Queens, and "digit 1 through 9" plays the role "column" played there:

```csharp run id=sudoku-solver
const int side = 9;
const int box = 3;

// A valid base grid, generated rather than typed in by hand: shift
// each band of rows so that rows, columns and boxes all come out as
// permutations of 1..9. This is checked below, not just asserted.
var solved = new int[side, side];
for (int r = 0; r < side; r++)
    for (int c = 0; c < side; c++)
        solved[r, c] = (box * (r % box) + r / box + c) % side + 1;

bool IsValidGrid(int[,] grid)
{
    for (int i = 0; i < side; i++)
    {
        var rowSeen = new bool[side + 1];
        var colSeen = new bool[side + 1];
        for (int j = 0; j < side; j++)
        {
            if (rowSeen[grid[i, j]]) return false;
            rowSeen[grid[i, j]] = true;
            if (colSeen[grid[j, i]]) return false;
            colSeen[grid[j, i]] = true;
        }
    }
    for (int br = 0; br < side; br += box)
        for (int bc = 0; bc < side; bc += box)
        {
            var seen = new bool[side + 1];
            for (int r = br; r < br + box; r++)
                for (int c = bc; c < bc + box; c++)
                {
                    if (seen[grid[r, c]]) return false;
                    seen[grid[r, c]] = true;
                }
        }
    return true;
}

Console.WriteLine($"generated base grid is valid: {IsValidGrid(solved)}");

// Keep every other cell (in row-major order) as a given; blank the rest.
var puzzle = new int[side, side];
int givens = 0;
for (int r = 0; r < side; r++)
    for (int c = 0; c < side; c++)
        if ((r * side + c) % 2 == 0)
        {
            puzzle[r, c] = solved[r, c];
            givens++;
        }
Console.WriteLine($"puzzle has {givens} givens, {side * side - givens} empty cells");

bool FitsRules(int[,] grid, int row, int col, int digit)
{
    for (int i = 0; i < side; i++)
        if (grid[row, i] == digit || grid[i, col] == digit) return false;
    int boxRow = row / box * box, boxCol = col / box * box;
    for (int r = boxRow; r < boxRow + box; r++)
        for (int c = boxCol; c < boxCol + box; c++)
            if (grid[r, c] == digit) return false;
    return true;
}

var emptyCells = new List<(int Row, int Col)>();
for (int r = 0; r < side; r++)
    for (int c = 0; c < side; c++)
        if (puzzle[r, c] == 0) emptyCells.Add((r, c));

int nodes = 0;

bool Solve(int[,] grid, int index)
{
    nodes++;
    if (index == emptyCells.Count) return true;   // every cell filled and safe
    var (row, col) = emptyCells[index];
    for (int digit = 1; digit <= side; digit++)
    {
        if (!FitsRules(grid, row, col, digit)) continue;   // choose only if safe
        grid[row, col] = digit;                            // choose
        if (Solve(grid, index + 1)) return true;            // explore
        grid[row, col] = 0;                                 // un-choose
    }
    return false;
}

var working = (int[,])puzzle.Clone();
bool solvedOk = Solve(working, 0);
Console.WriteLine($"solved: {solvedOk}");
Console.WriteLine($"nodes visited: {nodes}");
```

```text output
generated base grid is valid: True
puzzle has 41 givens, 40 empty cells
solved: True
nodes visited: 60
```

The recursion stops as soon as `Solve` returns `true`, instead of exploring every remaining branch the way the N-Queens counters did — a Sudoku puzzle only needs one solution, so there is no reason to keep searching after finding it, and doing so would inflate the node count with work the solver did not actually need. 60 nodes for 40 empty cells is small because this particular puzzle is easy: 41 of 81 cells are already filled, which leaves most empty cells with only one or two legal digits by the time the solver reaches them. Nothing here measures a *hard* puzzle — that would need choosing a puzzle known to have few givens and a unique solution, which is a harder claim to verify than generating one from a formula, so it is left for a reader to try rather than asserted here.

### With and without checking early, small enough to run both fully

Sudoku's naive form — try every digit in every empty cell, check the whole grid only once every cell is filled — is `9^40` leaf checks for the puzzle above, roughly `1.5 × 10^38`; that is the same kind of brute-force blow-up [Sedgewick and Wayne illustrate for exhaustive search generally](https://algs4.cs.princeton.edu/66intractability/) — not a number a laptop finishes counting to — so a real head-to-head needs a smaller board. A 4×4 Sudoku (digits 1–4, 2×2 boxes) keeps the same rules at a size where both the naive and pruned searches finish and can be counted exactly. Keeping rows 0 and 2 as givens and leaving rows 1 and 3 empty gives a puzzle with a unique solution:

```csharp run id=sudoku-4x4-naive-vs-pruned
const int side = 4;
const int box = 2;

var solved = new int[side, side];
for (int r = 0; r < side; r++)
    for (int c = 0; c < side; c++)
        solved[r, c] = (box * (r % box) + r / box + c) % side + 1;

var puzzle = new int[side, side];
for (int c = 0; c < side; c++)
{
    puzzle[0, c] = solved[0, c];
    puzzle[2, c] = solved[2, c];
}
var emptyCells = new List<(int Row, int Col)>();
for (int c = 0; c < side; c++) emptyCells.Add((1, c));
for (int c = 0; c < side; c++) emptyCells.Add((3, c));

bool FitsRules(int[,] grid, int row, int col, int digit)
{
    for (int i = 0; i < side; i++)
        if (grid[row, i] == digit || grid[i, col] == digit) return false;
    int boxRow = row / box * box, boxCol = col / box * box;
    for (int r = boxRow; r < boxRow + box; r++)
        for (int c = boxCol; c < boxCol + box; c++)
            if (grid[r, c] == digit) return false;
    return true;
}

bool FullyValid(int[,] grid)
{
    for (int r = 0; r < side; r++)
        for (int c = 0; c < side; c++)
        {
            int d = grid[r, c];
            grid[r, c] = 0;
            bool ok = FitsRules(grid, r, c, d);
            grid[r, c] = d;
            if (!ok) return false;
        }
    return true;
}

int naiveNodes = 0, naiveSolutions = 0;
void SolveNaive(int[,] grid, int index)
{
    naiveNodes++;
    if (index == emptyCells.Count)
    {
        if (FullyValid(grid)) naiveSolutions++;
        return;
    }
    var (row, col) = emptyCells[index];
    for (int digit = 1; digit <= side; digit++)
    {
        grid[row, col] = digit;
        SolveNaive(grid, index + 1);
    }
    grid[row, col] = 0;
}

int prunedNodes = 0, prunedSolutions = 0;
void SolvePruned(int[,] grid, int index)
{
    prunedNodes++;
    if (index == emptyCells.Count) { prunedSolutions++; return; }
    var (row, col) = emptyCells[index];
    for (int digit = 1; digit <= side; digit++)
    {
        if (!FitsRules(grid, row, col, digit)) continue;
        grid[row, col] = digit;
        SolvePruned(grid, index + 1);
    }
    grid[row, col] = 0;
}

SolveNaive((int[,])puzzle.Clone(), 0);
SolvePruned((int[,])puzzle.Clone(), 0);

Console.WriteLine($"naive nodes visited:  {naiveNodes}");
Console.WriteLine($"pruned nodes visited: {prunedNodes}");
Console.WriteLine($"naive solutions found:  {naiveSolutions}");
Console.WriteLine($"pruned solutions found: {prunedSolutions}");
```

```text output
naive nodes visited:  87381
pruned nodes visited: 11
naive solutions found:  1
pruned solutions found: 1
```

Both agree on 1 solution, and checking early cuts 87,381 nodes down to 11 — a far bigger drop than N-Queens' 98%, because half the grid is already fixed, which leaves very little room for a wrong digit to survive even one step. The naive count here also matches its own closed form for a reason worth stating plainly: with 8 empty cells and 4 candidate digits each, "check only at the end" always visits exactly `4⁰ + 4¹ + ... + 4⁸ = 87,381` nodes no matter what the givens are, because nothing about the givens is consulted until the very last check. The pruned count has no such fixed formula; it depends on the specific puzzle, and even on the order cells are filled in.

::::exercise[Does fill order change the pruned count?]
The pruned solver above fills row 1 then row 3, left to right within each row. For a sparser 4×4 puzzle — only row 0 given, plus the single cell at row 2, column 0, leaving 11 empty cells — would filling column by column instead (column 0 top to bottom, then column 1, and so on) visit more nodes, fewer, or the same number? Measure both orders and compare.

:::solution
Column-major visits fewer nodes than row-major on this puzzle:

```csharp run id=sudoku-order-comparison
const int side = 4;
const int box = 2;

var solved = new int[side, side];
for (int r = 0; r < side; r++)
    for (int c = 0; c < side; c++)
        solved[r, c] = (box * (r % box) + r / box + c) % side + 1;

var puzzle = new int[side, side];
for (int c = 0; c < side; c++) puzzle[0, c] = solved[0, c];
puzzle[2, 0] = solved[2, 0];

bool FitsRules(int[,] grid, int row, int col, int digit)
{
    for (int i = 0; i < side; i++)
        if (grid[row, i] == digit || grid[i, col] == digit) return false;
    int boxRow = row / box * box, boxCol = col / box * box;
    for (int r = boxRow; r < boxRow + box; r++)
        for (int c = boxCol; c < boxCol + box; c++)
            if (grid[r, c] == digit) return false;
    return true;
}

int CountNodes(List<(int Row, int Col)> order)
{
    int nodes = 0;
    void Solve(int[,] grid, int index)
    {
        nodes++;
        if (index == order.Count) return;
        var (row, col) = order[index];
        for (int digit = 1; digit <= side; digit++)
        {
            if (!FitsRules(grid, row, col, digit)) continue;
            grid[row, col] = digit;
            Solve(grid, index + 1);
        }
        grid[row, col] = 0;
    }
    Solve((int[,])puzzle.Clone(), 0);
    return nodes;
}

var rowMajor = new List<(int, int)>();
for (int r = 1; r < side; r++)
    for (int c = 0; c < side; c++)
        if (puzzle[r, c] == 0) rowMajor.Add((r, c));

var colMajor = new List<(int, int)>();
for (int c = 0; c < side; c++)
    for (int r = 1; r < side; r++)
        if (puzzle[r, c] == 0) colMajor.Add((r, c));

Console.WriteLine($"empty cells: {rowMajor.Count}");
Console.WriteLine($"row-major pruned nodes: {CountNodes(rowMajor)}");
Console.WriteLine($"col-major pruned nodes: {CountNodes(colMajor)}");
```

```text output
empty cells: 11
row-major pruned nodes: 59
col-major pruned nodes: 55
```

Neither order changes what the *final* answer is — the puzzle still has whatever solutions it has — but they reach different numbers of nodes, because a check for row `r`, column `c` only rules something out using digits already placed in that row, column or box, and which cells are "already placed" at that point depends entirely on visiting order. Filling a box's cells together, so that box constraint fires as early as possible, tends to prune more than scattering them; column-major here happens to bunch column 0's two empty cells (which share a box with the given `(2,0)`) earlier than row-major does. That is a property of this one puzzle and this one comparison, not a general ranking of orderings — a different puzzle can favor the other order.
:::
::::

## What these numbers do and don't prove

Every pruned search above walks a subtree of the exact tree its naive counterpart walks in full: `SolvePruned` and `SolveNaive` share the same recursion shape and the same "choose an unused column" restriction, and the only difference is that `SolvePruned` sometimes takes `continue` where `SolveNaive` would still have recursed. A branch skipped by `continue` contributes zero nodes; a branch that is entered contributes at least one. So pruned-node-count ≤ naive-node-count holds by construction, for any input, not just the ones measured here — that part does not need running code to believe.

What running the code establishes, and what it does not, are different things. It establishes real counts at specific sizes: 2,057 versus 109,601 at `n = 8`; a shrinking ratio from `n = 4` to `n = 10`; 11 versus 87,381 on a tiny Sudoku puzzle. It does not establish how the pruned count grows as `n` keeps increasing — four data points suggest a trend, they do not prove one, and nothing here fits a curve to them or extrapolates past `n = 10`. Most importantly, checking diagonals early never changes the *ceiling*: both N-Queens variants remain bounded above by the same closed-form tree size (order `n!`, since it counts partial column-permutations), because pruning can only remove nodes from that tree, never visit a node outside it. No claim here is that early checking brings the worst-case bound down to something smaller than `n!` — only that, at the sizes actually run, it visits a small and shrinking fraction of that ceiling. The same logic applies to Sudoku: checking rules early can only visit a subset of the `side^(empty cells)` tree that checking-only-at-the-end is defined to walk in full, and nothing measured here bounds that subset by any smaller closed form. "Pruning helps a lot in practice, on these inputs" and "pruning lowers the worst-case order of growth" are different claims; this article's numbers support the first and were never evidence for the second.
