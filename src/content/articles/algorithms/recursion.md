---
title: "Recursion: Thinking in Smaller Problems"
description: "A real call-stack trace, a measured stack overflow, and a verified answer to whether C# actually optimizes tail calls, built from a directory-size walk."
pillar: algorithms
order: 3
author: markus
published: 2026-09-22
updated: 2026-09-22
level: intermediate
tags: [recursion, call-stack, stack-overflow, tail-calls]
prerequisites: ["algorithms/binary-search"]
sources:
  - title: "StackOverflowException Class"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.stackoverflowexception"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Thread(ThreadStart, Int32) Constructor"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.threading.thread.-ctor"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "OpCodes.Tailcall Field"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.reflection.emit.opcodes.tailcall"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Tail call JIT conditions"
    url: "https://github.com/dotnet/runtime/blob/main/docs/design/coreclr/profiling/davbr-blog-archive/Tail%20call%20JIT%20conditions.md"
    publisher: "dotnet/runtime on GitHub"
    accessed: 2026-09-22
draft: true
---

A directory's size is the size of its own files, plus the size of everything inside its subdirectories — and each of those subdirectories is defined the same way. "Plus everything inside" is already a recursive definition; the code only has to say it directly.

```csharp run id=dirsize
string root = Path.Combine(
    Path.GetTempPath(), "csg-recursion-demo");
if (Directory.Exists(root))
    Directory.Delete(root, recursive: true);
Directory.CreateDirectory(root);

WriteFile(root, "readme.txt", 120);
string src = Path.Combine(root, "src");
Directory.CreateDirectory(src);
WriteFile(src, "main.cs", 540);
WriteFile(src, "utils.cs", 310);
string tests = Path.Combine(src, "tests");
Directory.CreateDirectory(tests);
WriteFile(tests, "main.tests.cs", 275);
string assets = Path.Combine(root, "assets");
Directory.CreateDirectory(assets);
WriteFile(assets, "logo.png", 2048);

long size = DirectorySize(root);
Console.WriteLine($"total bytes: {size}");

Directory.Delete(root, recursive: true);

static void WriteFile(string dir, string name, int bytes) =>
    File.WriteAllBytes(Path.Combine(dir, name), new byte[bytes]);

static long DirectorySize(string path)
{
    long total = 0;
    foreach (string file in Directory.GetFiles(path))
        total += new FileInfo(file).Length;
    foreach (string dir in Directory.GetDirectories(path))
        total += DirectorySize(dir);
    return total;
}
```

```text output
total bytes: 3293
```

`DirectorySize` builds a small tree first — `readme.txt`, a `src` folder with two files and a `tests` subfolder, an `assets` folder — measures it, then deletes it, so the program is a complete, repeatable demonstration rather than a walk over whatever happens to be on disk. The function has no loop that visits "every file everywhere." It visits the files in *one* directory with `foreach`, and for the subdirectories it does something bolder: it calls itself. `DirectorySize(tests)` runs to completion, with its own `total`, its own `path`, its own loop, before the call to it inside `DirectorySize(src)` can add that result in and move on. Nothing here is special to directories; it works because "a directory's contents" is defined in terms of smaller directories, all the way down to ones with no subdirectories at all.

## Every recursive function makes the same promise

That last sentence is the whole idea, stated formally: a [recursive](/glossary/#recursion) function solves a problem by handling the smallest version of it directly — the **base case** — and handling every other version by calling itself on a *smaller* version and using that answer — the **recursive case**. `DirectorySize`'s recursive case is the second `foreach`. Its base case is never written out; it falls out of the code, because a directory with no subdirectories makes `Directory.GetDirectories` return an empty array, and a loop over nothing does nothing.

Factorial makes both cases explicit, which is why it is the standard first example, and it is a better vehicle for watching the call stack than a filesystem walk: one integer per call, nothing else to track.

```csharp run id=factorial-trace
int result = Factorial(4, 0);
Console.WriteLine($"4! = {result}");

static int Factorial(int n, int depth)
{
    string indent = new string(' ', depth * 2);
    Console.WriteLine($"{indent}Factorial({n}) called");
    int result;
    if (n <= 1)
    {
        result = 1;
        Console.WriteLine($"{indent}base case: return 1");
    }
    else
    {
        result = n * Factorial(n - 1, depth + 1);
        Console.WriteLine(
            $"{indent}Factorial({n}) returns {result}");
    }
    return result;
}
```

```text output
Factorial(4) called
  Factorial(3) called
    Factorial(2) called
      Factorial(1) called
      base case: return 1
    Factorial(2) returns 2
  Factorial(3) returns 6
Factorial(4) returns 24
4! = 24
```

Every line of that trace is a real event on the [call stack](/glossary/#call-stack). `Factorial(4)` cannot compute `4 * Factorial(3)` until `Factorial(3)` has an answer, so it calls `Factorial(3)` and waits — and the CLR has to remember, somewhere, that `Factorial(4)`'s `n` was 4 and that it still owes a multiplication once the call it made returns. That "somewhere" is a new stack frame, one per active call, holding that call's own parameters and locals and the address to resume at. Figure 1 shows what the stack looks like at the deepest point of this run, the instant `Factorial(1)` hits its base case and the unwinding is about to begin.

<figure class="diagram">
<svg viewBox="0 0 300 300" role="img" aria-labelledby="factstack-title factstack-desc">
<title id="factstack-title">The call stack for Factorial(4) at its deepest point</title>
<desc id="factstack-desc">Four stacked frames from Factorial(4) at the top down to Factorial(1) at the bottom. The bottom frame has reached its base case; the three frames above it are each paused, waiting for the call below to return.</desc>
<defs>
<marker id="factstack-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-stroke"/></marker>
</defs>
<rect x="40" y="14" width="220" height="50" rx="6" class="d-box"/>
<text x="150" y="35" text-anchor="middle" class="d-mono d-bold">Factorial(4)</text>
<text x="150" y="53" text-anchor="middle" class="d-small d-muted">waiting for Factorial(3)</text>
<path d="M150 64 V78" class="d-line" marker-end="url(#factstack-arrow)"/>
<rect x="40" y="78" width="220" height="50" rx="6" class="d-box"/>
<text x="150" y="99" text-anchor="middle" class="d-mono d-bold">Factorial(3)</text>
<text x="150" y="117" text-anchor="middle" class="d-small d-muted">waiting for Factorial(2)</text>
<path d="M150 128 V142" class="d-line" marker-end="url(#factstack-arrow)"/>
<rect x="40" y="142" width="220" height="50" rx="6" class="d-box"/>
<text x="150" y="163" text-anchor="middle" class="d-mono d-bold">Factorial(2)</text>
<text x="150" y="181" text-anchor="middle" class="d-small d-muted">waiting for Factorial(1)</text>
<path d="M150 192 V206" class="d-line" marker-end="url(#factstack-arrow)"/>
<rect x="40" y="206" width="220" height="50" rx="6" class="d-box-accent"/>
<text x="150" y="227" text-anchor="middle" class="d-mono d-bold">Factorial(1)</text>
<text x="150" y="245" text-anchor="middle" class="d-small">base case: returns 1</text>
<text x="150" y="280" text-anchor="middle" class="d-small d-muted">top of stack</text>
</svg>
<figcaption>Figure 1. The call stack for <code>Factorial(4)</code> the instant the base case is reached. Every frame above the bottom one is a paused call, still holding its own <code>n</code>, waiting for the call below it to return before it can multiply and return in turn.</figcaption>
</figure>

Once `Factorial(1)` returns 1, the frames pop in the reverse of the order they were pushed — that is exactly the bottom half of the printed trace, each `returns` line firing as its frame is removed.

## The same subproblem, asked twice: Fibonacci's tree

`DirectorySize` branches into several *sibling* recursive calls per level, but each subdirectory is a genuinely different piece of the problem. The naive Fibonacci recursion is a sharper contrast: it makes exactly two recursive calls, and those two calls can end up asking the very same question.

```csharp run id=fib-tree
var calls = new Dictionary<int, int>();
int result = Fib(4, calls);
Console.WriteLine($"fib(4) = {result}");
foreach (var (n, count) in calls.OrderBy(kv => kv.Key))
    Console.WriteLine($"fib({n}) called {count} time(s)");

static int Fib(int n, Dictionary<int, int> calls)
{
    calls[n] = calls.GetValueOrDefault(n) + 1;
    if (n <= 1) return n;
    return Fib(n - 1, calls) + Fib(n - 2, calls);
}
```

```text output
fib(4) = 3
fib(0) called 2 time(s)
fib(1) called 3 time(s)
fib(2) called 2 time(s)
fib(3) called 1 time(s)
fib(4) called 1 time(s)
```

<figure class="diagram">
<svg viewBox="0 0 340 250" role="img" aria-labelledby="fibtree-title fibtree-desc">
<title id="fibtree-title">Recursion tree for the naive Fibonacci call fib(4)</title>
<desc id="fibtree-desc">A tree of nine calls rooted at fib(4). Its two children are fib(3) and fib(2); fib(3) itself calls fib(2) and fib(1), so the fib(2) subtree, highlighted in both places it appears, is expanded twice from scratch.</desc>
<path d="M180 33 L95 72" class="d-line"/>
<path d="M180 33 L265 72" class="d-line"/>
<path d="M95 98 L55 137" class="d-line"/>
<path d="M95 98 L135 137" class="d-line"/>
<path d="M265 98 L225 137" class="d-line"/>
<path d="M265 98 L305 137" class="d-line"/>
<path d="M55 163 L30 202" class="d-line"/>
<path d="M55 163 L80 202" class="d-line"/>
<rect x="160" y="7" width="40" height="26" rx="5" class="d-box"/>
<text x="180" y="24" text-anchor="middle" class="d-mono d-small">f(4)</text>
<rect x="75" y="72" width="40" height="26" rx="5" class="d-box"/>
<text x="95" y="89" text-anchor="middle" class="d-mono d-small">f(3)</text>
<rect x="245" y="72" width="40" height="26" rx="5" class="d-box-accent"/>
<text x="265" y="89" text-anchor="middle" class="d-mono d-small">f(2)</text>
<rect x="35" y="137" width="40" height="26" rx="5" class="d-box-accent"/>
<text x="55" y="154" text-anchor="middle" class="d-mono d-small">f(2)</text>
<rect x="115" y="137" width="40" height="26" rx="5" class="d-box"/>
<text x="135" y="154" text-anchor="middle" class="d-mono d-small">f(1)</text>
<rect x="205" y="137" width="40" height="26" rx="5" class="d-box"/>
<text x="225" y="154" text-anchor="middle" class="d-mono d-small">f(1)</text>
<rect x="285" y="137" width="40" height="26" rx="5" class="d-box"/>
<text x="305" y="154" text-anchor="middle" class="d-mono d-small">f(0)</text>
<rect x="10" y="202" width="40" height="26" rx="5" class="d-box"/>
<text x="30" y="219" text-anchor="middle" class="d-mono d-small">f(1)</text>
<rect x="60" y="202" width="40" height="26" rx="5" class="d-box"/>
<text x="80" y="219" text-anchor="middle" class="d-mono d-small">f(0)</text>
</svg>
<figcaption>Figure 2. The call tree for the naive <code>Fib(4)</code>. The two highlighted <code>f(2)</code> nodes are the same call, fib(2), expanded completely independently in two different branches; each redoes work the other already did.</figcaption>
</figure>

`fib(2)` is called twice for entirely different reasons — once because `fib(4)` needs it directly, once because `fib(3)` needs it on the way to answering `fib(4)` — and each call re-derives it from nothing, including re-deriving `fib(1)` and `fib(0)` underneath it a second time. Neither call knows the other one exists. *Analyzing the Complexity of Loops and Recursion*, a companion article in this series, covers exactly how fast that repetition grows and how to derive it with a recursion tree and the Master theorem; this page only needs the shape. The fix, when the repetition matters, is to remember an answer the first time and hand back the memory instead of recomputing it — [memoization](/glossary/#dynamic-programming).

::::exercise[Extend it: memoize]
Add a `Dictionary<int,int>` cache to `Fib` above: check it first, and after computing a result, store it before returning. Keep a counter of how many times each `fib(n)` is genuinely *computed* — increment it only when the cache does not already have an answer, not on every call. How many times is each `fib(n)` computed for `fib(4)`, versus merely called?

:::solution
Once each, no matter how many times it is called, because the cache check happens before the counter and returns immediately on a hit:

```csharp run id=fib-memo
var computed = new Dictionary<int, int>();
var cache = new Dictionary<int, int>();
int result = Fib(4, computed, cache);
Console.WriteLine($"fib(4) = {result}");
foreach (var (n, c) in computed.OrderBy(kv => kv.Key))
    Console.WriteLine($"fib({n}) computed {c} time(s)");

static int Fib(int n, Dictionary<int, int> computed, Dictionary<int, int> cache)
{
    if (cache.TryGetValue(n, out int cached)) return cached;
    computed[n] = computed.GetValueOrDefault(n) + 1;
    int result = n <= 1 ? n : Fib(n - 1, computed, cache) + Fib(n - 2, computed, cache);
    cache[n] = result;
    return result;
}
```

```text output
fib(4) = 3
fib(0) computed 1 time(s)
fib(1) computed 1 time(s)
fib(2) computed 1 time(s)
fib(3) computed 1 time(s)
fib(4) computed 1 time(s)
```

The tree in Figure 2 still gets *called* the same number of times as before at each node, but the second and later calls for a given `n` now return immediately from the cache instead of re-expanding their whole subtree underneath it.
:::
::::

## A different branch every time: permutations

Fibonacci's two calls could ask the same question by accident. A function that builds every permutation of a list also makes several recursive calls per level, and the tree is just as branchy, but for a different reason: each call explores a genuinely different choice, so nothing is ever recomputed — there really are that many permutations to produce.

```csharp run id=permutations
char[] letters = ['A', 'B', 'C'];
foreach (var p in Permute(letters, 0))
    Console.WriteLine(string.Join("", p));

static IEnumerable<char[]> Permute(char[] items, int k)
{
    if (k == items.Length - 1)
    {
        yield return (char[])items.Clone();
        yield break;
    }
    for (int i = k; i < items.Length; i++)
    {
        Swap(items, k, i);
        foreach (var p in Permute(items, k + 1))
            yield return p;
        Swap(items, k, i);
    }
}

static void Swap(char[] a, int i, int j) =>
    (a[i], a[j]) = (a[j], a[i]);
```

```text output
ABC
ACB
BAC
BCA
CBA
CAB
```

`Permute(items, k)` fixes position `k` by trying each remaining letter there in turn: swap it into place, recurse on positions `k+1` onward, then swap back before the loop tries the next letter. That second swap is the important line — it undoes the choice, so the next iteration of the loop starts from the same array the previous one did, not from whatever the previous branch left behind. (The output is not alphabetical, because the algorithm works by swapping positions, not by picking letters in sorted order.) This choose–recurse–undo shape, explore everything that follows from a choice and then take it back before trying the next one, is the pattern behind backtracking search generally, not just permutations.

::::exercise[Find the bug]
Take `Permute` above and delete the *second* `Swap(items, k, i);` — the one after the inner `foreach`, which undoes the swap before the loop tries the next `i`. Run the result. Six lines still come out; are they six distinct permutations? If not, which ones are missing, and which repeat?

:::solution
Six lines still come out — the recursion's shape (how deep it goes, how many leaves it has) never depended on the array's contents — but they are not six distinct permutations:

```csharp run id=permute-bug
char[] letters = ['A', 'B', 'C'];
foreach (var p in Permute(letters, 0))
    Console.WriteLine(string.Join("", p));

static IEnumerable<char[]> Permute(char[] items, int k)
{
    if (k == items.Length - 1)
    {
        yield return (char[])items.Clone();
        yield break;
    }
    for (int i = k; i < items.Length; i++)
    {
        Swap(items, k, i);
        foreach (var p in Permute(items, k + 1))
            yield return p;
    }
}

static void Swap(char[] a, int i, int j) =>
    (a[i], a[j]) = (a[j], a[i]);
```

```text output
ABC
ACB
CAB
CBA
ABC
ACB
```

`BAC` and `BCA` never appear, and `ABC`/`ACB` each appear twice. Without the second swap, every iteration of the outer loop starts from whatever the *previous* iteration left the array as, instead of from the array `Permute` was actually called with, so position `k` drifts to values it was never meant to hold. The bug has nothing to do with recursion depth or base cases; it is a plain "forgot to undo a mutation" bug, one recursion makes easy to introduce because the mutation is shared through a single array reference passed down the whole tree of calls.
:::
::::

## What recursion actually costs that a loop doesn't

`DirectorySize`, `Factorial`, `Fib` and `Permute` all lean on the same mechanism: a call. Each one pushes a new call stack frame that remembers where to resume and what its own local state was, and popping that frame is how the function "goes back" to finish the caller's work. A loop does the equivalent job with none of that machinery — the same handful of local variables is reused on every turn, so the amount of state a loop keeps in flight does not grow with how many times it runs.

That is exactly why recursion fits `DirectorySize` so naturally: nothing in the code has to know the tree's depth ahead of time, the way a bounded `for` loop needs a trip count. The price for that convenience is that every level of depth is a frame that has to live somewhere until its call returns, and "somewhere" is a fixed-size region of memory handed to the thread once, not an unbounded one. How fixed, and what happens when a recursive function outgrows it, is worth measuring rather than guessing.

## Measuring the wall: stack overflow in practice

The call stack is not memory a program allocates on demand; it is a fixed-size block the operating system reserves for the thread before a single line of managed code runs. [Microsoft's documentation for the `Thread` constructor overload that lets you choose that size](https://learn.microsoft.com/en-us/dotnet/api/system.threading.thread.-ctor) puts the default at 1 megabyte, and recommends against changing it: "the most likely cause [of stack problems] is programming error, such as infinite recursion." A function that recurses without bound eventually runs out of room in that block, and .NET's own documentation for what happens next is blunt: [`StackOverflowException` "cannot be caught with a try/catch block, and the corresponding process is terminated by default."](https://learn.microsoft.com/en-us/dotnet/api/system.stackoverflowexception)

That claim is checkable directly. Wrap the recursive call in a `try`/`catch` and see whether the `catch` block ever gets a chance to run. Measured with .NET 10.0.401 on Windows 11, x64:

```bash run fails stderr
cat > Overflow.cs <<'CS'
long n = long.Parse(args[0]);
try
{
    Console.WriteLine(Sum(n));
}
catch (StackOverflowException)
{
    Console.WriteLine("caught it");
}

static long Sum(long n) =>
    n <= 0 ? 0 : n + Sum(n - 1);
CS
dotnet run Overflow.cs -- 50000000
```

```text output
Stack overflow.
Repeated [...] times:
--------------------------------
   at Program.<<Main>$>g__Sum|0_0(Int64)
--------------------------------
   at Program.<Main>$(System.String[])
```

"caught it" never prints. What appears instead is the CLR's own crash report, not a normal exception trace, and the process exits with a non-zero code rather than returning control anywhere. `Sum` itself is unremarkable: it adds up the numbers below 50 million, one recursive call per number. Somewhere around 19,000 calls deep — the exact count moves a little from run to run, and would differ on another machine or CLR version, but the order of magnitude will not, and that is what the `[...]` above stands in for — this thread runs out of room and the process ends. There is no exception to catch and nothing to clean up afterward; the fix Microsoft's own docs point to is keeping recursion depth bounded in the first place, with an explicit counter or condition, not catching the failure once it happens.

::::exercise[Predict, then check]
`Sum` above crashes somewhere past 19,000 levels deep when asked to sum up to 50,000,000. Before running anything, predict whether `Sum(5_000)` completes normally, and if so, what it prints.

:::solution
5,000 is far below the measured ~19,000-frame ceiling, so it completes normally and returns the sum of 1 through 5,000:

```csharp run id=sum-small args="5000"
long n = long.Parse(args[0]);
Console.WriteLine(Sum(n));

static long Sum(long n) =>
    n <= 0 ? 0 : n + Sum(n - 1);
```

```text output
12502500
```

5,000 × 5,001 / 2 = 12,502,500 confirms it against the closed form for a triangular number — a check worth running whenever brute-force recursion is easy to verify against a formula.
:::
::::

## Does writing it as a tail call save you?

`Sum` above does its addition *after* the recursive call returns (`n + Sum(n - 1)`), so the current frame has to stay alive to perform that addition once the call comes back. A **tail call** is different: the recursive call is the very last thing the function does, and its result becomes the function's own result directly, with no work left afterward. In principle a tail call does not need its caller's frame to still be there — the caller was about to return that exact value anyway, so the frame could be reused instead of stacked on top of. This is not hypothetical: the CLR's instruction set has a real opcode for it. [`OpCodes.Tailcall`](https://learn.microsoft.com/en-us/dotnet/api/system.reflection.emit.opcodes.tailcall), written `tail.` in IL, must immediately precede a `call`, `calli` or `callvirt`, and its documented effect is that "the current method's stack frame should be removed before the call instruction is executed."

Having the instruction available is not the same as C# using it. Rewrite `Sum` so the addition happens on the way *in*, through an accumulator, making the recursive call the genuinely last thing the function does — then read the compiled IL back and check, byte for byte, whether the `tail.` prefix (hex `FE 14`) is actually there:

```csharp run id=sumtail-il
using System.Reflection;
using System.Reflection.Metadata;
using System.Reflection.PortableExecutable;

long n = 10;
Console.WriteLine(SumTail(n, 0));

string name = Assembly.GetExecutingAssembly().GetName().Name!;
string path = Path.Combine(AppContext.BaseDirectory, name + ".dll");
using var fs = File.OpenRead(path);
using var pe = new PEReader(fs);
var md = pe.GetMetadataReader();
foreach (var h in md.MethodDefinitions)
{
    var m = md.GetMethodDefinition(h);
    if (md.GetString(m.Name) != "<<Main>$>g__SumTail|0_0") continue;
    byte[] il = pe.GetMethodBody(m.RelativeVirtualAddress).GetILBytes()!;
    bool tailPrefix = false;
    for (int i = 0; i + 1 < il.Length; i++)
        if (il[i] == 0xFE && il[i + 1] == 0x14) tailPrefix = true;
    Console.WriteLine($"SumTail IL bytes: {il.Length}, tail. prefix present: {tailPrefix}");
}

static long SumTail(long n, long acc) =>
    n <= 0 ? acc : SumTail(n - 1, acc + n);
```

```text output
55
SumTail IL bytes: 21, tail. prefix present: False
```

This program inspects its own compiled assembly through `System.Reflection.Metadata` — the same metadata format tools like ildasm read — and scans `SumTail`'s 21 bytes of IL for the two-byte `tail.` opcode. It is not there. Roslyn wrote a call in tail position, but chose not to mark it as one.

:::dotnet
The runtime's own design notes describe the general disposition, in an internal writeup on the 64-bit JIT's handling of tail calls: it tries to honor the optimization "whenever we're allowed to," but list a long set of disqualifying conditions — return-type mismatches, particular value-type parameter layouts, synchronized methods, code that takes the address of a local, and more ([Tail call JIT conditions](https://github.com/dotnet/runtime/blob/main/docs/design/coreclr/profiling/davbr-blog-archive/Tail%20call%20JIT%20conditions.md), archived in the dotnet/runtime documentation). None of that reasoning runs unless the compiler emits the `tail.` prefix in the first place, and the scan above shows that for this program, it did not.
:::

Whether the JIT can special-case a self-recursive tail call into a loop *without* needing the `tail.` prefix at all is a separate question, and it is easiest to just measure directly. Build both the original `Sum` and the tail-form `SumTail`, then push each one far enough to fail:

```bash run
cat > Sum.cs <<'CS'
long n = long.Parse(args[0]);
Console.WriteLine(Sum(n));
static long Sum(long n) => n <= 0 ? 0 : n + Sum(n - 1);
CS
cat > SumTail.cs <<'CS'
long n = long.Parse(args[0]);
Console.WriteLine(SumTail(n, 0));
static long SumTail(long n, long acc) =>
    n <= 0 ? acc : SumTail(n - 1, acc + n);
CS
echo "non-tail, debug build:"
dotnet run Sum.cs -- 50000000 2>&1 | grep Repeated
echo "tail-form, debug build:"
dotnet run SumTail.cs -- 50000000 2>&1 | grep Repeated
echo "tail-form, release build:"
dotnet run -c Release SumTail.cs -- 50000000 2>&1 | grep Repeated
```

```text output
non-tail, debug build:
Repeated [...] times:
tail-form, debug build:
Repeated [...] times:
tail-form, release build:
Repeated [...] times:
```

Writing the sum in tail form made no difference under the same build a reader gets from a plain `dotnet run`: `SumTail` crashes at essentially the same depth as the version that adds after the call returns. Compiling in Release moves the ceiling higher — a leaner frame fits more of them into the same 1 MB — but it is still a ceiling; the call did not turn into a loop. For C#, being written as a tail call is not a promise of anything. It is a shape the JIT is occasionally free to take advantage of and, as measured here, twice did not.

## Keeping the same shape without the call stack

Every one of `DirectorySize`, `Sum`, `Fib` and `Permute` can be rewritten to use its own explicit `Stack<T>` instead of the CLR's call stack. The trade is direct: a frame the runtime manages, capped at the size measured above, becomes an entry on a stack that lives on the heap, capped only by how much memory the process can get. Rewriting `DirectorySize` this way means finding what each paused call was "waiting on" — here, just the path of the next directory to look at — and pushing that instead of making a call:

```csharp run id=dirsize-explicit
string root = Path.Combine(
    Path.GetTempPath(), "csg-recursion-demo");
if (Directory.Exists(root))
    Directory.Delete(root, recursive: true);
Directory.CreateDirectory(root);

WriteFile(root, "readme.txt", 120);
string src = Path.Combine(root, "src");
Directory.CreateDirectory(src);
WriteFile(src, "main.cs", 540);
WriteFile(src, "utils.cs", 310);
string tests = Path.Combine(src, "tests");
Directory.CreateDirectory(tests);
WriteFile(tests, "main.tests.cs", 275);
string assets = Path.Combine(root, "assets");
Directory.CreateDirectory(assets);
WriteFile(assets, "logo.png", 2048);

long recursive = DirectorySize(root);
long iterative = DirectorySizeIterative(root);
Console.WriteLine($"recursive: {recursive}");
Console.WriteLine($"iterative: {iterative}");

Directory.Delete(root, recursive: true);

static void WriteFile(string dir, string name, int bytes) =>
    File.WriteAllBytes(Path.Combine(dir, name), new byte[bytes]);

static long DirectorySize(string path)
{
    long total = 0;
    foreach (string file in Directory.GetFiles(path))
        total += new FileInfo(file).Length;
    foreach (string dir in Directory.GetDirectories(path))
        total += DirectorySize(dir);
    return total;
}

static long DirectorySizeIterative(string root)
{
    long total = 0;
    var pending = new Stack<string>();
    pending.Push(root);
    while (pending.Count > 0)
    {
        string dir = pending.Pop();
        foreach (string file in Directory.GetFiles(dir))
            total += new FileInfo(file).Length;
        foreach (string sub in Directory.GetDirectories(dir))
            pending.Push(sub);
    }
    return total;
}
```

```text output
recursive: 3293
iterative: 3293
```

The two functions agree because they visit the same set of directories; they do not visit them in the same *order*. `DirectorySizeIterative` pushes every subdirectory of the one it just popped, and `Stack<T>.Pop` always returns the most recently pushed entry, so the walk goes depth-first down whichever subdirectory was pushed *last* — the reverse of `Directory.GetDirectories`'s own order — before backing up to the others. A sum does not care about order. It matters the moment a recursive version's order was load-bearing.

:::pitfall
An explicit-stack rewrite is depth-first by construction, since a `Stack<T>`'s LIFO order mirrors what the call stack was already doing. It is not automatically the *same* depth-first order as the original recursive version, unless children are pushed in reverse, and it is not breadth-first at all — swapping in a `Queue<T>` gives a breadth-first walk instead, a different traversal with different results for anything order-sensitive.
:::

::::exercise[Extend it: count directories]
Add a second value to `DirectorySizeIterative`'s return: the number of directories it visited, including `root` itself. Leave `DirectorySize` alone; only the iterative version needs a counter, since the stack already visits each directory exactly once by construction.

:::solution
Increment a counter once per pop, at the point where each directory starts being processed:

```csharp run id=dirsize-count
string root = Path.Combine(
    Path.GetTempPath(), "csg-recursion-demo");
if (Directory.Exists(root))
    Directory.Delete(root, recursive: true);
Directory.CreateDirectory(root);

WriteFile(root, "readme.txt", 120);
string src = Path.Combine(root, "src");
Directory.CreateDirectory(src);
WriteFile(src, "main.cs", 540);
WriteFile(src, "utils.cs", 310);
string tests = Path.Combine(src, "tests");
Directory.CreateDirectory(tests);
WriteFile(tests, "main.tests.cs", 275);
string assets = Path.Combine(root, "assets");
Directory.CreateDirectory(assets);
WriteFile(assets, "logo.png", 2048);

var (bytes, dirs) = DirectorySizeIterative(root);
Console.WriteLine($"bytes: {bytes}");
Console.WriteLine($"directories visited: {dirs}");

Directory.Delete(root, recursive: true);

static void WriteFile(string dir, string name, int bytes) =>
    File.WriteAllBytes(Path.Combine(dir, name), new byte[bytes]);

static (long bytes, int dirs) DirectorySizeIterative(string root)
{
    long total = 0;
    int dirs = 0;
    var pending = new Stack<string>();
    pending.Push(root);
    while (pending.Count > 0)
    {
        string dir = pending.Pop();
        dirs++;
        foreach (string file in Directory.GetFiles(dir))
            total += new FileInfo(file).Length;
        foreach (string sub in Directory.GetDirectories(dir))
            pending.Push(sub);
    }
    return (total, dirs);
}
```

```text output
bytes: 3293
directories visited: 4
```

Four: `root`, `src`, `tests` and `assets`. The recursive version could answer the same question by having `DirectorySize` return a `(long, int)` tuple too and summing the counts on the way back up — the call stack was always tracking "how many calls are open," it just never had to be asked.
:::
::::
