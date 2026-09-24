---
title: "Exception Handling in C# That Helps You Debug"
description: "See throw ex; erase a stack trace where throw; preserves it, prove catch filters run before the stack unwinds, and measure what throwing actually costs."
pillar: csharp-dotnet
order: 7
author: markus
published: 2026-09-24
updated: 2026-09-24
level: intermediate
tags: [exceptions, exception-handling, stack-trace, idisposable, call-stack]
prerequisites: []
sources:
  - title: "Best practices for exceptions"
    url: "https://learn.microsoft.com/en-us/dotnet/standard/exceptions/best-practices-for-exceptions"
    publisher: "Microsoft Learn"
    accessed: 2026-09-24
  - title: "Exception-handling statements - throw and try, catch, finally"
    url: "https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/statements/exception-handling-statements"
    publisher: "Microsoft Learn"
    accessed: 2026-09-24
  - title: "using statement - ensure the correct use of disposable objects"
    url: "https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/statements/using"
    publisher: "Microsoft Learn"
    accessed: 2026-09-24
  - title: "Exception Throwing (Framework Design Guidelines)"
    url: "https://learn.microsoft.com/en-us/dotnet/standard/design-guidelines/exception-throwing"
    publisher: "Microsoft Learn"
    accessed: 2026-09-24
  - title: "Exceptions and Performance (Framework Design Guidelines)"
    url: "https://learn.microsoft.com/en-us/dotnet/standard/design-guidelines/exceptions-and-performance"
    publisher: "Microsoft Learn"
    accessed: 2026-09-24
  - title: "ExceptionDispatchInfo Class"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.runtime.exceptionservices.exceptiondispatchinfo"
    publisher: "Microsoft Learn"
    accessed: 2026-09-24
draft: true
---

A stack trace that points at the wrong line has usually been edited, not lied to. Something upstream re-threw the exception, or caught it and built a new one, and the frames that would have shown where the failure really started are gone. None of this is mysterious once you know which statements throw away information and which ones keep it. This page works through the handful of C# constructs that decide what a caught exception still remembers by the time a human reads it: `throw` versus `throw ex`, exception filters, `ExceptionDispatchInfo`, and `finally`/`using`. It ends by measuring what a `throw` actually costs on this machine, because "exceptions are slow" is usually stated as folklore rather than a number.

## Which layer should catch this?

A `try`/`catch` block is a decision: *this frame knows what to do when the operation inside it fails.* The failure below travels through two frames that don't know that, and one that does.

```csharp run id=layerbug
OrderService.PlaceOrder(orderId: 42);
Console.WriteLine("order 42 placed");

static class OrderService
{
    public static void PlaceOrder(int orderId)
    {
        try
        {
            OrderRepository.Save(orderId);
        }
        catch (IOException ex)
        {
            // OrderService can log this, but not decide what to do:
            // retry? refund? tell the user? that's the caller's call.
            Console.WriteLine($"logged and swallowed: {ex.Message}");
        }
    }
}

static class OrderRepository
{
    public static void Save(int orderId) =>
        throw new IOException("disk quota exceeded");
}
```

```text output
logged and swallowed: disk quota exceeded
order 42 placed
```

`OrderService` did handle the exception, in the sense that the program didn't crash. It also produced a lie: `"order 42 placed"` printed even though the order was never saved, because catching `IOException` here only stopped it from propagating — it didn't stop the save from having failed. The fix isn't a better catch block inside `OrderService`; it's no catch block at all, because `OrderService` genuinely has no way to answer "now what?" for a disk failure. The decision belongs to whichever frame can act on it:

```csharp run id=layerfix
try
{
    OrderService.PlaceOrder(orderId: 42);
    Console.WriteLine("order 42 placed");
}
catch (IOException ex)
{
    // The top level is the first frame that knows what to do about a
    // storage failure: queue the order for retry and tell the caller.
    Console.WriteLine($"order 42 queued for retry: {ex.Message}");
}

static class OrderService
{
    // No try/catch here: PlaceOrder cannot decide what a save
    // failure means to its caller, so it lets it propagate.
    public static void PlaceOrder(int orderId) =>
        OrderRepository.Save(orderId);
}

static class OrderRepository
{
    public static void Save(int orderId) =>
        throw new IOException("disk quota exceeded");
}
```

```text output
order 42 queued for retry: disk quota exceeded
```

Microsoft's own guidance for the framework states the same rule directly: "when your code can't recover from an exception, don't catch that exception. Enable methods further up the call stack to recover if possible" ([Best practices for exceptions](https://learn.microsoft.com/en-us/dotnet/standard/exceptions/best-practices-for-exceptions)). An exception that isn't caught anywhere doesn't vanish where it's thrown — it climbs the [call stack](/glossary/#call-stack) (see [recursion](/algorithms/recursion/) for how that same stack grows and shrinks on ordinary calls), one returning frame at a time, until a `catch` clause whose type matches is found.

<figure class="diagram">
<svg viewBox="0 0 340 320" role="img" aria-labelledby="exc-prop-title exc-prop-desc">
<title id="exc-prop-title">An exception climbs frames until one catches it</title>
<desc id="exc-prop-desc">Three stacked frames, top to bottom in time: OrderRepository.Save throws an IOException, OrderService.PlaceOrder has no matching catch and lets it pass through unchanged, and the top-level catch block is the first frame that can decide what to do about it.</desc>
<defs>
<marker id="exc-prop-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-bad"/></marker>
</defs>
<rect x="20" y="10" width="300" height="56" rx="6" class="d-box"/>
<text x="170" y="32" text-anchor="middle" class="d-bold">OrderRepository.Save</text>
<text x="170" y="52" text-anchor="middle" class="d-mono d-small">throw new IOException(...)</text>
<path d="M170 66 V104" class="d-bad" marker-end="url(#exc-prop-arrow)"/>
<text x="180" y="90" class="d-text-bad d-small">no catch: keeps climbing</text>
<rect x="20" y="106" width="300" height="56" rx="6" class="d-box-2 d-dashed"/>
<text x="170" y="128" text-anchor="middle" class="d-bold">OrderService.PlaceOrder</text>
<text x="170" y="148" text-anchor="middle" class="d-small">no try/catch here at all</text>
<path d="M170 162 V200" class="d-bad" marker-end="url(#exc-prop-arrow)"/>
<text x="180" y="186" class="d-text-bad d-small">still climbing</text>
<rect x="20" y="202" width="300" height="56" rx="6" class="d-box-good"/>
<text x="170" y="224" text-anchor="middle" class="d-bold">Program (top level)</text>
<text x="170" y="244" text-anchor="middle" class="d-mono d-small">catch (IOException ex)</text>
<text x="20" y="284" class="d-muted d-small">This is the first frame that knows what a</text>
<text x="20" y="300" class="d-muted d-small">storage failure should mean to the caller.</text>
</svg>
<figcaption>Figure 1. The exception is not resolved where it is thrown; it climbs frame by frame, skipping every frame without a matching catch, until one is found.</figcaption>
</figure>

When a frame does list more than one `catch` clause, "the runtime checks catch clauses in the specified order, from top to bottom. At most, only one catch block runs for any thrown exception" ([Exception-handling statements](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/statements/exception-handling-statements)), which is why putting a broader clause before a narrower one in the same hierarchy isn't just a style mistake — the compiler refuses to compile it:

```csharp run error=CS0160
try
{
    File.ReadAllText("missing.txt");
}
catch (Exception ex)
{
    Console.WriteLine(ex.Message);
}
catch (FileNotFoundException ex)
{
    Console.WriteLine(ex.Message);
}
```

`catch (Exception ex)` matches every exception type, so a `FileNotFoundException` clause placed after it could never run; the compiler refuses to compile a clause it can prove is unreachable rather than let it silently do nothing.

## Does `throw ex;` really throw away the stack trace?

`throw;` and `throw ex;` both re-raise the exception a `catch` block just caught, and both compile without complaint. Only one of them keeps the trail that led there. `ConfigLoader.ReadValue` below catches an `InvalidOperationException` from `Parse` and re-throws it with `throw ex;`:

```csharp run id=throwex
Console.WriteLine("=== throw ex; ===");
try
{
    ConfigLoader.ReadValue("timeout");
}
catch (InvalidOperationException ex)
{
    Console.WriteLine(ex.StackTrace);
}

static class ConfigLoader
{
    public static string ReadValue(string key)
    {
        try
        {
            return Parse(key);
        }
        catch (InvalidOperationException ex)
        {
            throw ex;
        }
    }

    static string Parse(string key) =>
        throw new InvalidOperationException($"missing key: {key}");
}
```

```text output
[...] warning CA2200: [...]
=== throw ex; ===
   at ConfigLoader.ReadValue(String key) in [...]:line [...]
   at Program.<Main>$(String[] args) in [...]:line [...]
```

`dotnet run` prints that `CA2200` warning on its own before the program's output even runs — the compiler already suspects this line, and the trace below confirms it. The frame for `Parse`, the method that actually threw, is gone. The only change needed to keep it is dropping the exception variable from the `throw` statement:

```csharp run id=throwbare
Console.WriteLine("=== throw; ===");
try
{
    ConfigLoader.ReadValue("timeout");
}
catch (InvalidOperationException ex)
{
    Console.WriteLine(ex.StackTrace);
}

static class ConfigLoader
{
    public static string ReadValue(string key)
    {
        try
        {
            return Parse(key);
        }
        catch (InvalidOperationException)
        {
            throw;
        }
    }

    static string Parse(string key) =>
        throw new InvalidOperationException($"missing key: {key}");
}
```

```text output
=== throw; ===
   at ConfigLoader.Parse(String key) in [...]:line [...]
   at ConfigLoader.ReadValue(String key) in [...]:line [...]
   at Program.<Main>$(String[] args) in [...]:line [...]
```

The documentation states exactly this mechanism: "`throw;` preserves the original stack trace of the exception, which is stored in the `Exception.StackTrace` property. In contrast, `throw e;` updates the `StackTrace` property of `e`" ([Exception-handling statements](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/statements/exception-handling-statements)). `throw ex;` isn't rethrowing the same failure — it's recording a new one, whose history happens to start at the `catch` block instead of at `Parse`. It doesn't manufacture a new object to do that — `ex` is still the same reference the `catch` caught, just with its `StackTrace` overwritten. Writing `throw new InvalidOperationException(ex.Message)` instead would go further than that: a `new` expression always allocates, so the caller receives a genuinely different object, one that has also dropped `ex`'s `InnerException`, `Data`, and original runtime type along with its trace. `throw ex;` only does the smaller, still-damaging thing — same object, same type, trace erased. The compiler's own analyzer flags the statement for exactly this reason (rule CA2200, "re-throwing caught exception changes stack information"), which is why `throw ex;` is a mistake worth naming rather than a matter of taste.

:::pitfall
`throw ex;` compiles cleanly and the program still runs correctly — the bug is invisible until the day someone needs the trace to find where a failure actually started, and by then the frame that mattered has already been thrown away.
:::

::::exercise[Trace it: how many frames survive]
`Chain.Middle` below catches the exception `Chain.Inner` throws and re-throws it with `throw ex;`, then `Chain.Outer` catches *that* and re-throws it with `throw;`. Before running it, predict how many `at` lines `ex.StackTrace` will contain when `Program` finally prints it, and which method's name appears first.

```csharp run id=mixedrethrow
try
{
    Chain.Outer();
}
catch (InvalidOperationException ex)
{
    Console.WriteLine(ex.StackTrace);
}

static class Chain
{
    public static void Outer()
    {
        try
        {
            Middle();
        }
        catch (InvalidOperationException)
        {
            throw;
        }
    }

    static void Middle()
    {
        try
        {
            Inner();
        }
        catch (InvalidOperationException ex)
        {
            throw ex;
        }
    }

    static void Inner() => throw new InvalidOperationException("boom");
}
```

:::solution
Three `at` lines, starting with `Chain.Middle`, not two — it's easy to forget that the frame which first *called* `Outer` (here, the top-level `Program`) always shows up at the bottom, no matter how much a rethrow further down shortens the rest. `throw ex;` inside `Middle` resets the trace to begin at `Middle`'s own `throw` statement — `Inner`'s frame is discarded at that point and no later `throw;` can bring it back. `Outer`'s `throw;` then preserves whatever trace it received, which is already the shortened one, and adds nothing of its own except the frame for `Outer` itself:

```text output
[...] warning CA2200: [...]
   at Chain.Middle() in [...]:line [...]
   at Chain.Outer() in [...]:line [...]
   at Program.<Main>$(String[] args) in [...]:line [...]
```

The lesson generalizes: `throw;` never loses information, but it can't restore what an earlier `throw ex;` already erased, and the frame that first entered the chain is always still there. One careless rethrow anywhere in the middle is enough to lose the original failure site for good.
:::
::::

## What if the rethrow has to happen somewhere else entirely?

`throw;` only compiles inside the `catch` block that caught the exception — there's no bare `throw;` you can call from a different method once the `catch` has exited. `ExceptionDispatchInfo` exists for exactly that gap: it captures an exception's trace as an object you can hold onto, and rethrows it later with the original trace intact. The parser below tries every line, remembers the first failure instead of stopping, and reports it only once every line has been tried. Its `firstFailure?.Throw()` really does end the program with an unhandled exception, so the code relaunches itself as a child process to capture that crash's own output instead of ending the article's own run:

```csharp run id=edi
using System.Diagnostics;
using System.Runtime.ExceptionServices;

if (args is ["child"])
{
    ExceptionDispatchInfo? firstFailure = null;
    string[] lines = ["10", "oops", "20"];
    List<int> parsed = [];

    foreach (string line in lines)
    {
        try
        {
            parsed.Add(LineParser.Parse(line));
        }
        catch (FormatException ex)
        {
            firstFailure ??= ExceptionDispatchInfo.Capture(ex);
        }
    }

    Console.WriteLine($"parsed {parsed.Count} of {lines.Length} lines");
    firstFailure?.Throw();
    return;
}

var startInfo = new ProcessStartInfo(Environment.ProcessPath!, "child")
{
    RedirectStandardOutput = true,
    RedirectStandardError = true,
};
using var child = Process.Start(startInfo)!;
string stdout = child.StandardOutput.ReadToEnd().TrimEnd();
string stderr = child.StandardError.ReadToEnd().TrimEnd();
child.WaitForExit();

Console.WriteLine(stdout);
Console.WriteLine(stderr);

static class LineParser
{
    public static int Parse(string line) => int.Parse(line);
}
```

```text output
parsed 2 of 3 lines
Unhandled exception. [...] 'oops' [...]
   at System.Number.ThrowFormatException[TChar](ReadOnlySpan`1 value)
   at System.Int32.Parse(String s)
   at LineParser.Parse(String line) in [...]:line [...]
   at Program.<Main>$(String[] args) in [...]:line [...]
--- End of stack trace from previous location ---
   at Program.<Main>$(String[] args) in [...]:line [...]
```

The child process printed `"parsed 2 of 3 lines"` and then crashed, because `firstFailure?.Throw()` really does rethrow. `ExceptionDispatchInfo.Throw()` "throws the exception... as if it had flowed from the point where it was captured to the point where the Throw method is called" ([ExceptionDispatchInfo Class](https://learn.microsoft.com/en-us/dotnet/api/system.runtime.exceptionservices.exceptiondispatchinfo)); the trace runs from `int.Parse` inside `LineParser.Parse`, through the original `foreach` iteration, and the `--- End of stack trace from previous location ---` line marks the seam where .NET switched from replaying that history to recording the later rethrow, rather than hiding it the way `throw ex;` would. `throw;` still wins whenever it applies, because it's simpler and needs no extra type — `ExceptionDispatchInfo` earns its place specifically when the rethrow can't happen inside the original `catch`, such as here, after a loop has kept going past the first failure.

::::exercise[Find the bug: which failure gets reported]
The comment says this reports the *first* line that failed to parse, once every line has been tried. Given `lines = ["10", "oops", "20", "nope"]`, does it? If not, what would you change?

```csharp run id=edibug
using System.Diagnostics;
using System.Runtime.ExceptionServices;

if (args is ["child"])
{
    // Intent: keep the FIRST failure, keep going, report it once done.
    ExceptionDispatchInfo? firstFailure = null;
    string[] lines = ["10", "oops", "20", "nope"];
    List<int> parsed = [];

    foreach (string line in lines)
    {
        try
        {
            parsed.Add(LineParser.Parse(line));
        }
        catch (FormatException ex)
        {
            firstFailure = ExceptionDispatchInfo.Capture(ex);
        }
    }

    Console.WriteLine($"parsed {parsed.Count} of {lines.Length} lines");
    firstFailure?.Throw();
    return;
}

var startInfo = new ProcessStartInfo(Environment.ProcessPath!, "child")
{
    RedirectStandardOutput = true,
    RedirectStandardError = true,
};
using var child = Process.Start(startInfo)!;
string stdout = child.StandardOutput.ReadToEnd().TrimEnd();
string stderr = child.StandardError.ReadToEnd().TrimEnd();
child.WaitForExit();

Console.WriteLine(stdout);
Console.WriteLine(stderr.Split('\n')[0].TrimEnd());

static class LineParser
{
    public static int Parse(string line) => int.Parse(line);
}
```

:::solution
No — it reports the *last* failure, `'nope'`, not the first, `'oops'`:

```text output
parsed 2 of 4 lines
Unhandled exception. [...] 'nope' [...]
```

`firstFailure = ExceptionDispatchInfo.Capture(ex);` runs on every failing line and overwrites whatever was captured before, so the last assignment wins. The working version earlier in this page used `firstFailure ??= ExceptionDispatchInfo.Capture(ex);` — the null-coalescing assignment only stores a value the first time, when `firstFailure` is still `null`, which is what "remember the first failure" actually requires.
:::
::::

## Do exception filters really run before the stack unwinds?

An exception filter — the `when` clause after a catch type — looks like a shorter way to write an `if` inside the `catch` block. It isn't just that. `LogBeforeUnwind` below runs as part of *deciding* whether this `catch` handles the exception, and `Withdraw`'s `finally` only runs once that decision has already been made:

```csharp run id=filterorder
try
{
    Withdraw(500);
}
catch (InvalidOperationException ex) when (LogBeforeUnwind(ex))
{
    Console.WriteLine("3. catch body ran");
}

static bool LogBeforeUnwind(InvalidOperationException ex)
{
    Console.WriteLine($"1. filter evaluated: {ex.Message}");
    return true;
}

static void Withdraw(decimal amount)
{
    try
    {
        throw new InvalidOperationException("insufficient funds");
    }
    finally
    {
        Console.WriteLine("2. Withdraw's finally ran");
    }
}
```

```text output
1. filter evaluated: insufficient funds
2. Withdraw's finally ran
3. catch body ran
```

The filter's own `Console.WriteLine` runs *before* `Withdraw`'s `finally` does, even though `Withdraw` is the deeper frame and its `finally` sits textually closer to the throw. The documentation calls out the same ordering: "the filter expression is evaluated before the stack is unwound... the original call stack and all local variables remain intact during filter evaluation," where a plain `catch` block "runs after the stack is unwound, potentially losing valuable debugging information" ([Exception-handling statements](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/statements/exception-handling-statements)). Concretely, unwinding is the process of popping frames between the throw site and the chosen handler and running their `finally` blocks on the way — and the runtime can't know which handler is "chosen" until every candidate's filter has had a chance to say yes or no. A filter that returns `false` costs a function call and nothing else: no frame is unwound, no `finally` runs, and the search simply continues to the next candidate `catch` clause, in this frame or further up.

That makes a filter with a side effect and no intent to handle a legitimate pattern — logging every exception of a given type as it passes through, without disturbing where it ends up:

```csharp run id=filterpeek
try
{
    try
    {
        Withdraw(500);
    }
    catch (Exception ex) when (Peek(ex))
    {
        Console.WriteLine("inner catch ran (should not print)");
    }
}
catch (InvalidOperationException ex)
{
    Console.WriteLine($"outer catch handled it: {ex.Message}");
}

static bool Peek(Exception ex)
{
    Console.WriteLine($"peeked without handling: {ex.GetType().Name}");
    return false; // observes only; lets the exception keep going
}

static void Withdraw(decimal amount) =>
    throw new InvalidOperationException("insufficient funds");
```

```text output
peeked without handling: InvalidOperationException
outer catch handled it: insufficient funds
```

`Peek` runs, prints, and returns `false`; the inner `catch` is never entered, and the same exception object — with its original, unmodified trace — reaches the outer `catch` intact. A `catch`-log-rethrow block that used `throw ex;` here would have reset that trace; a filter that declines to handle never touches it at all, because it was never "caught" as far as `StackTrace` is concerned.

## When does a new exception type earn its keep?

.NET ships exception types for the common cases — `ArgumentException` for a bad argument, `InvalidOperationException` for a call that doesn't fit the object's current state — and the guidance is to reach for one of those before writing a new class: "introduce a new exception class only when a predefined one doesn't apply" ([Best practices for exceptions](https://learn.microsoft.com/en-us/dotnet/standard/exceptions/best-practices-for-exceptions)). A custom type earns its place when the *caller* needs to do something with information a built-in exception has nowhere to put — here, exactly how much an account was short by:

```csharp run id=customexc
using System.Globalization;

var account = new Account(balance: 100m);

try
{
    account.Withdraw(150m);
}
catch (InsufficientFundsException ex)
{
    Console.WriteLine($"{ex.Message} (short by {Money(ex.Shortfall)})");
}

static string Money(decimal amount) =>
    amount.ToString("F2", CultureInfo.InvariantCulture);

class InsufficientFundsException : Exception
{
    public decimal Shortfall { get; }

    public InsufficientFundsException() { }

    public InsufficientFundsException(string message)
        : base(message) { }

    public InsufficientFundsException(string message, Exception inner)
        : base(message, inner) { }

    public InsufficientFundsException(decimal shortfall)
        : base("exceeds balance") => Shortfall = shortfall;
}

class Account(decimal balance)
{
    public void Withdraw(decimal amount)
    {
        if (amount > balance)
            throw new InsufficientFundsException(amount - balance);
        balance -= amount;
    }
}
```

```text output
exceeds balance (short by 50.00)
```

`catch (ArgumentOutOfRangeException)` could have reported that *something* about the amount was wrong, but not what a caller would actually want here: how much more money is needed. Three constructors are present even though only one is used — the parameterless one, the message-only one, and the message-plus-inner-exception one — because that trio is the guidance's minimum for any custom exception type, so that generic code that constructs exceptions reflectively (test frameworks, serializers, wrapping helpers) can always find one that fits. The name ends in `Exception`, and the type derives from `Exception` directly rather than from an unrelated built-in type, matching the same guidance's naming convention.

Not every built-in exception is fair game to throw yourself, either: "you shouldn't raise some *reserved* exception types, such as `AccessViolationException`, `IndexOutOfRangeException`, `NullReferenceException` and `StackOverflowException`" ([Best practices for exceptions](https://learn.microsoft.com/en-us/dotnet/standard/exceptions/best-practices-for-exceptions#use-predefined-exception-types)), flagged by analyzer rule CA2201, because catching one conventionally means "the runtime detected a bug," not "a library reported an expected failure."

::::exercise[Extend it: add the non-throwing twin]
`Account.Withdraw` above throws when the balance is too low. Using the [Try-Parse pattern](#exception-or-return-value-which-one-reports-this-failure) below as a model, add a `TryWithdraw` method that returns `false` and reports the shortfall through an `out` parameter instead of throwing, without duplicating the balance check.

:::solution
```csharp run id=trywithdraw
using System.Globalization;

var account = new Account(balance: 100m);

Console.WriteLine(account.TryWithdraw(150m, out decimal shortfall)
    ? "withdrew 150"
    : $"declined, short by {Money(shortfall)}");

static string Money(decimal amount) =>
    amount.ToString("F2", CultureInfo.InvariantCulture);

class InsufficientFundsException(decimal shortfall)
    : Exception("exceeds balance")
{
    public decimal Shortfall { get; } = shortfall;
}

class Account(decimal balance)
{
    public void Withdraw(decimal amount)
    {
        if (amount > balance)
            throw new InsufficientFundsException(amount - balance);
        balance -= amount;
    }

    public bool TryWithdraw(decimal amount, out decimal shortfall)
    {
        try
        {
            Withdraw(amount);
            shortfall = 0m;
            return true;
        }
        catch (InsufficientFundsException ex)
        {
            shortfall = ex.Shortfall;
            return false;
        }
    }
}
```

```text output
declined, short by 50.00
```

`TryWithdraw` reuses `Withdraw`'s one balance check instead of repeating the condition; it just converts the exception the throwing version already raises into a return value. This is the same relationship `int.TryParse` has with `int.Parse` — one real implementation, two ways to be told the result.
:::
::::

## What does `finally` guarantee, and does `using` really become that?

`finally` runs when control leaves its `try` block "as a result of normal execution... execution of a jump statement... or propagation of an exception out of the try block" ([Exception-handling statements](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/statements/exception-handling-statements)) — success, `return`, `break`, or a `throw`, all trigger it. `using` is built on exactly that guarantee: the same page states plainly that "the compiler transforms a using statement into a try-finally statement" ([Exception-handling statements](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/statements/exception-handling-statements)) — the same fact [garbage-collection](/csharp-dotnet/garbage-collection/#what-does-using-actually-guarantee-and-what-does-it-not) establishes to separate `Dispose` from collection. What matters for exception handling specifically is less *that* it runs and more *when*, relative to a `catch` block that might be watching: a resource is disposed even when the method returns early from inside the block, and even when an exception passes straight through it:

```csharp run id=usingexc
try
{
    Run();
}
catch (InvalidOperationException)
{
    Console.WriteLine("caught after the resource was already disposed");
}

static void Run()
{
    using var resource = new LoggingResource("connection");
    throw new InvalidOperationException("query failed");
}

class LoggingResource(string name) : IDisposable
{
    public void Dispose() => Console.WriteLine($"disposed {name}");
}
```

```text output
disposed connection
caught after the resource was already disposed
```

`"disposed connection"` prints before the `catch` block runs, for the same reason the filter section's `finally` ran before its `catch` body did: `Dispose()` happens during the unwind, on the way to whichever frame ends up handling the exception. The same lowering explains a detail that's easy to get backwards when a method opens more than one resource: declaring several `using` locals disposes them last-declared-first, the reverse of declaration order — the [using statement](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/statements/using) documentation states the identical reverse-order result for its parenthesized multi-resource form, `using (a, b) { }` — because each `using` local becomes a `finally` nested inside the previous one's `try`, and nested `finally` blocks unwind from the inside out.

```csharp run id=usingorder
Console.WriteLine(ReadFirstLine());
Report();

static string ReadFirstLine()
{
    using var reader = new LoggingResource("reader");
    return "first line (pretend)"; // early return still disposes
}

static void Report()
{
    using var a = new LoggingResource("A");
    using var b = new LoggingResource("B");
    Console.WriteLine("using A and B");
} // B disposes before A: reverse of declaration order

class LoggingResource(string name) : IDisposable
{
    public void Dispose() => Console.WriteLine($"disposed {name}");
}
```

```text output
disposed reader
first line (pretend)
using A and B
disposed B
disposed A
```

`"disposed reader"` prints before `ReadFirstLine`'s return value is even written to the console, and `B` — opened second — is disposed first. Both follow from the same rewrite: `return "first line (pretend)";` inside a `using` block still has to run the block's `finally` before the method can actually return, and each `using` local's `finally` is nested one level deeper than the one before it, so the innermost one unwinds first.

:::dotnet
An `await`ed method's exception doesn't throw immediately — the compiler stores it on the `Task` the method returns, and it surfaces only when that `Task` is awaited (see [async/await](/csharp-dotnet/async-await/) for the state machine that makes this true). A `using` around an `await` still disposes correctly once that stored exception does surface, because `await` propagating an exception is still "an exception passing through the block," just deferred to whenever the `await` expression resumes.
:::

Framework guidance adds one restriction worth stating alongside `finally`'s guarantee: "don't raise exceptions in finally clauses" ([Best practices for exceptions](https://learn.microsoft.com/en-us/dotnet/standard/exceptions/best-practices-for-exceptions#dont-raise-exceptions-in-finally-clauses)). A `finally` block that throws while an original exception is already unwinding through it replaces that original exception with the new one — the first failure's message and trace are simply gone, with nothing left behind to say it ever happened.

## Exception or return value: which one reports this failure?

.NET's own guidance is unambiguous about the framework's public surface: "do not return error codes... exceptions are the primary means of reporting errors" ([Exception Throwing](https://learn.microsoft.com/en-us/dotnet/standard/design-guidelines/exception-throwing)). That's a statement about *unexpected* failures — a file that should exist and doesn't, a network call that times out. It is not a statement that every method should only throw. Where failure is a routine, expected outcome — a value that frequently fails to parse, a key that frequently isn't present — the same guidance recommends a non-throwing form instead, and .NET's own library follows it: `int.TryParse` alongside `int.Parse`, `Dictionary<TKey,TValue>.TryGetValue` alongside indexing.

```csharp run id=tryresult
Console.WriteLine(TryDivide(10, 2, out int quotient)
    ? $"quotient: {quotient}" : "cannot divide");
Console.WriteLine(TryDivide(10, 0, out quotient)
    ? $"quotient: {quotient}" : "cannot divide");

try
{
    Console.WriteLine(Divide(10, 0));
}
catch (DivideByZeroException ex)
{
    Console.WriteLine($"threw instead: {ex.GetType().Name}");
}

static bool TryDivide(int a, int b, out int result)
{
    if (b == 0) { result = 0; return false; }
    result = a / b;
    return true;
}

static int Divide(int a, int b) => a / b;
```

```text output
quotient: 5
cannot divide
threw instead: DivideByZeroException
```

Both methods exist side by side deliberately: the guidance calls this the *Try-Parse Pattern* and is explicit that "if the member fails for any reason other than the well-defined try, the member must still throw a corresponding exception," and that a library should "provide an exception-throwing member for each member using the Try-Parse Pattern" ([Exceptions and Performance](https://learn.microsoft.com/en-us/dotnet/standard/design-guidelines/exceptions-and-performance)). `TryDivide` returning `false` communicates one specific, anticipated condition — a zero divisor — and any *other* way `a / b` could fail (there isn't one for `int`, but there would be for a checked type) is still expected to throw, not to be smuggled into the same `false`. A method that swallows every possible failure into one Boolean has usually thrown away exactly the distinction a caller needed.

The same design guidelines note when the throwing form alone becomes a genuine cost, not just a style question: "consider the performance implications of throwing exceptions. Throw rates above 100 per second are likely to noticeably impact the performance of most applications" ([Exception Throwing](https://learn.microsoft.com/en-us/dotnet/standard/design-guidelines/exception-throwing)). A hundred a second sounds like a low bar for something described as a "primary means of reporting errors" — which is exactly why it's worth measuring rather than repeating as received wisdom.

## How much does throwing actually cost, measured here?

The guidelines above are blunt that a throwing call "can be orders of magnitude slower" than one that doesn't throw ([Exceptions and Performance](https://learn.microsoft.com/en-us/dotnet/standard/design-guidelines/exceptions-and-performance)), without attaching a number. The benchmark below runs the same failing input through `int.TryParse` and through `int.Parse` wrapped in `try`/`catch`, timing 200,000 calls of each after a short warm-up so the JIT has already compiled both paths before either is measured. Toolchain for every measured number on this page: .NET 10.0.12 on Windows 11, x64, on an Intel Core i7-11700K.

```csharp run id=cost
#:property Optimize=true
using System.Diagnostics;

const int Iterations = 200_000;

// Warm-up: let the JIT compile both paths before timing either one.
RunReturning(1_000);
RunThrowing(1_000);

long returningMs = Time(() => RunReturning(Iterations));
long throwingMs = Time(() => RunThrowing(Iterations));

Console.WriteLine($"TryParse, no throw: {returningMs,4} ms");
Console.WriteLine($"throw and catch:    {throwingMs,4} ms");

static long Time(Action action)
{
    var sw = Stopwatch.StartNew();
    action();
    return sw.ElapsedMilliseconds;
}

static void RunReturning(int iterations)
{
    int hits = 0;
    for (int i = 0; i < iterations; i++)
    {
        if (int.TryParse("not a number", out int value))
            hits++;
    }
}

static void RunThrowing(int iterations)
{
    int hits = 0;
    for (int i = 0; i < iterations; i++)
    {
        try
        {
            hits += int.Parse("not a number");
        }
        catch (FormatException)
        {
            // expected: this is the failure path, timed on purpose
        }
    }
}
```

```text output
TryParse, no throw: [...] ms
throw and catch:    [...] ms
```

On this machine the `TryParse` loop finished in single-digit milliseconds; the throw-and-catch loop over the same 200,000 iterations took several hundred times as long, comfortably matching "orders of magnitude" rather than a modest overhead. That gap isn't primarily the cost of the `catch` matching a type or running its body — it's the cost of building and unwinding the exception itself: capturing a stack trace at the throw site, and popping every frame between there and the handler. `TryDivide` and `TryParse` avoid all of that on the expected-failure path; they only pay it on the path that's actually exceptional. This is also the concrete meaning behind "throw rates above 100 per second are likely to noticeably impact performance" from the design guidelines cited earlier — at hundreds of times the cost of a normal return, a hot loop that throws routinely can spend most of its time unwinding rather than working.

## Practice: verifying the cost claim yourself

::::exercise[Measure it: does a filter add to that cost]
Section "[Do exception filters really run before the stack unwinds?](#do-exception-filters-really-run-before-the-stack-unwinds)" showed that a filter runs during the search for a handler, before any unwinding happens. Extend the benchmark above to compare a plain `catch (FormatException)` against `catch (FormatException ex) when (ex.Message.Length > 0)`, both around the same failing `int.Parse` call, 200,000 iterations each. Predict whether the filter meaningfully changes the timing before you run it.

:::solution
```csharp run id=costfilter
#:property Optimize=true
using System.Diagnostics;

const int Iterations = 200_000;

RunPlainCatch(1_000);
RunFilteredCatch(1_000);

long plainMs = Time(() => RunPlainCatch(Iterations));
long filteredMs = Time(() => RunFilteredCatch(Iterations));

Console.WriteLine($"plain catch:    {plainMs,4} ms");
Console.WriteLine($"filtered catch: {filteredMs,4} ms");

static long Time(Action action)
{
    var sw = Stopwatch.StartNew();
    action();
    return sw.ElapsedMilliseconds;
}

static void RunPlainCatch(int iterations)
{
    for (int i = 0; i < iterations; i++)
    {
        try { int.Parse("nope"); }
        catch (FormatException) { }
    }
}

static void RunFilteredCatch(int iterations)
{
    for (int i = 0; i < iterations; i++)
    {
        try { int.Parse("nope"); }
        catch (FormatException ex) when (ex.Message.Length > 0) { }
    }
}
```

```text output
plain catch:    [...] ms
filtered catch: [...] ms
```

On this machine the two totals land within noise of each other, run to run — sometimes the filtered version is faster, sometimes slower, never by more than the loop's own run-to-run variance. That matches what the filter-ordering demonstration predicted: a filter's own check is one more method call evaluated during the search for a handler, immeasurably small next to the cost the earlier benchmark found in building and unwinding the exception itself. The expensive part of a thrown exception is the throw, not whatever `when` clause happens to be attached to the `catch` that eventually handles it.
:::
::::
