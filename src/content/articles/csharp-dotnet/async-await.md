---
title: "async/await: What the Compiler Builds for You"
description: "Trace the state machine the C# compiler builds for await, reproduce the classic .Result deadlock safely, and measure WhenAll, cancellation and ValueTask."
pillar: csharp-dotnet
order: 3
author: markus
published: 2026-09-22
updated: 2026-09-22
level: intermediate
tags: [async-await, tasks, synchronization-context, deadlocks, cancellation, value-task]
prerequisites: ["csharp-dotnet/value-types-vs-reference-types"]
sources:
  - title: "await operator - asynchronously wait for a task to complete"
    url: "https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/operators/await"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Asynchronous programming scenarios"
    url: "https://learn.microsoft.com/en-us/dotnet/csharp/asynchronous-programming/async-scenarios"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Task-based Asynchronous Pattern (TAP): Introduction and overview"
    url: "https://learn.microsoft.com/en-us/dotnet/standard/asynchronous-programming-patterns/task-based-asynchronous-pattern-tap"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "How Async/Await Really Works in C#"
    url: "https://devblogs.microsoft.com/dotnet/how-async-await-really-works/"
    publisher: ".NET Blog, Microsoft"
    accessed: 2026-09-22
  - title: "SynchronizationContext Class"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.threading.synchronizationcontext"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Parallel Computing - It's All About the SynchronizationContext (MSDN Magazine, Feb 2011)"
    url: "https://learn.microsoft.com/en-us/archive/msdn-magazine/2011/february/msdn-magazine-parallel-computing-it-s-all-about-the-synchronizationcontext"
    publisher: "Microsoft Learn archive"
    accessed: 2026-09-22
  - title: "ConfigureAwait FAQ"
    url: "https://devblogs.microsoft.com/dotnet/configureawait-faq/"
    publisher: ".NET Blog, Microsoft"
    accessed: 2026-09-22
  - title: "Foreground and background threads"
    url: "https://learn.microsoft.com/en-us/dotnet/standard/threading/foreground-and-background-threads"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Task.WhenAll Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.threading.tasks.task.whenall"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Cancellation in Managed Threads"
    url: "https://learn.microsoft.com/en-us/dotnet/standard/threading/cancellation-in-managed-threads"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "ValueTask Struct"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.threading.tasks.valuetask"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Understanding the Whys, Whats, and Whens of ValueTask"
    url: "https://devblogs.microsoft.com/dotnet/understanding-the-whys-whats-and-whens-of-valuetask/"
    publisher: ".NET Blog, Microsoft"
    accessed: 2026-09-22
draft: false
---

A C# compiler does not leave `await` in the assembly. It rewrites an `async` method into a state machine, in a documented and mechanical way, and it does that rewriting the same way whether the method waits ten milliseconds or reads a socket. This page starts from a method that blocks its calling thread, measures what that costs, then builds by hand the state machine the compiler would generate for its `async` replacement, before working through what that rewriting explains: why a stray `.Result` call deadlocks some programs and not others, and why an `async void` method can throw in a place no `catch` block reaches.

## A loop that ties up its thread

`ReadSensor` below stands in for a call that can't return instantly: a network request, a disk read, a query. `Thread.Sleep` is the honest version of "blocks": the thread that calls it parks and runs nothing else until the wait is over.

```csharp run id=blocking
using System.Diagnostics;

var clock = Stopwatch.StartNew();
List<string> reports = [];
foreach (int sensor in Enumerable.Range(1, 4))
    reports.Add(ReadSensor(sensor));
Console.WriteLine(
    $"read {reports.Count} sensors in {clock.ElapsedMilliseconds} ms");

static string ReadSensor(int id)
{
    Thread.Sleep(100);   // stands in for a blocking network read
    return $"sensor {id}: ok";
}
```

```text output
read 4 sensors in [...] ms
```

Measured on .NET 10.0.12 on Windows 11, x64, on a Core i7-11700K, four 100 ms reads cost just over 400 ms of wall time, and every one of those milliseconds the thread was doing nothing but waiting. It couldn't run another line of this program. If this were the one thread pumping a UI's message loop, the window would stop repainting; if it were [a thread pool worker handling one HTTP request](/operating-systems/processes-and-threads/), that worker couldn't pick up another request until this one finished sleeping.

`async` and `await` exist to get that thread back during the wait without inverting the code into callbacks. The `async` modifier on a method "doesn't force a method to run asynchronously on another thread. It enables `await`, and the method runs synchronously until it reaches an incomplete awaitable" ([Task-based Asynchronous Pattern](https://learn.microsoft.com/en-us/dotnet/standard/asynchronous-programming-patterns/task-based-asynchronous-pattern-tap)). `await` names the mechanism precisely: it "suspends evaluation of the enclosing `async` method until the asynchronous operation represented by its operand completes... The `await` operator doesn't block the thread that evaluates the async method. When the `await` operator suspends the enclosing async method, the control returns to the caller of the method" ([await operator](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/operators/await)). The operand is usually a `Task` or `Task<TResult>`, the types .NET uses to represent "an asynchronous operation that might not be complete" under the Task-based Asynchronous Pattern.

## What the compiler builds when it sees `await`

The claim that `await` "suspends and returns control to the caller" is not a metaphor; it names two real, generated code paths. The next program calls one ordinary `async` method and one method written by hand to do exactly what the compiler would generate for it, and compares the results.

```csharp run id=statemachine
using System.Runtime.CompilerServices;

Console.WriteLine(await AddOneAsync(41));
Console.WriteLine(await AddOneByHandAsync(41));

static async Task<int> AddOneAsync(int x)
{
    await Task.Delay(10);
    return x + 1;
}

// What the compiler generates for AddOneAsync, written by hand.
static Task<int> AddOneByHandAsync(int x)
{
    var machine = new AddOneStateMachine
    {
        X = x,
        Builder = AsyncTaskMethodBuilder<int>.Create(),
        State = -1,
    };
    machine.Builder.Start(ref machine);
    return machine.Builder.Task;
}

struct AddOneStateMachine : IAsyncStateMachine
{
    public int X;
    public int State;
    public AsyncTaskMethodBuilder<int> Builder;
    private TaskAwaiter _awaiter;

    public void MoveNext()
    {
        try
        {
            if (State == 0)
            {
                // Resuming after the await: pick up where we left off.
                _awaiter.GetResult();
                Builder.SetResult(X + 1);
                return;
            }

            // State -1: run the body up to the first await.
            var awaiter = Task.Delay(10).GetAwaiter();
            if (awaiter.IsCompleted)
            {
                Builder.SetResult(X + 1);   // rare: finished already
                return;
            }
            _awaiter = awaiter;
            State = 0;
            Builder.AwaitUnsafeOnCompleted(ref _awaiter, ref this);
            // MoveNext returns here; the caller keeps running.
        }
        catch (Exception ex)
        {
            Builder.SetException(ex);
        }
    }

    public void SetStateMachine(IAsyncStateMachine stateMachine) { }
}
```

```text output
42
42
```

Both lines print 42, because `AddOneByHandAsync` is a faithful sketch of what `AddOneAsync` compiles to. The .NET team's own description of the transformation names the same pieces: the compiler emits a state machine type holding a state field, an `AsyncTaskMethodBuilder<TResult>`, the awaiter for whatever is being awaited, and a `MoveNext` method that a switch on the state field re-enters at the right spot; real field names look like `<>1__state` and `<>t__builder` ([How Async/Await Really Works in C#](https://devblogs.microsoft.com/dotnet/how-async-await-really-works/)). `MoveNext` runs the method body exactly twice for one `await`: once from the top, up to `Task.Delay(10).GetAwaiter()`, and once resumed, when the timer's continuation calls `MoveNext` again and the `State == 0` branch skips straight to `GetResult()`. Nothing about this requires a second thread — the delay's continuation runs wherever the thread pool's timer callback runs, and that could be any pool thread.

<figure class="diagram">
<svg viewBox="0 0 340 460" role="img" aria-labelledby="aa-sm-title aa-sm-desc">
<title id="aa-sm-title">MoveNext runs the same method body twice, split at the await</title>
<desc id="aa-sm-desc">A box for the first call to MoveNext with state minus one runs down to a branch on whether the awaiter is already completed; the no branch saves the awaiter, sets state to zero, and returns to the caller. A separate box below, reached later when the awaited operation completes, shows MoveNext called again, taking the state-zero branch straight to GetResult and SetResult.</desc>
<defs>
<marker id="aa-sm-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-accent"/></marker>
</defs>
<text x="14" y="24" class="d-bold">Call 1: MoveNext(), state = -1</text>
<rect x="14" y="34" width="312" height="40" rx="6" class="d-box"/>
<text x="170" y="59" text-anchor="middle" class="d-mono d-small">var awaiter = Task.Delay(10).GetAwaiter()</text>
<path d="M170 74 V96" class="d-line" marker-end="url(#aa-sm-arrow)"/>
<text x="170" y="112" text-anchor="middle" class="d-small">awaiter.IsCompleted?</text>
<rect x="14" y="124" width="145" height="56" rx="6" class="d-box-good"/>
<text x="86" y="146" text-anchor="middle" class="d-small d-bold">yes (rare)</text>
<text x="86" y="163" text-anchor="middle" class="d-small">SetResult(x+1)</text>
<rect x="181" y="124" width="145" height="56" rx="6" class="d-box-accent"/>
<text x="253" y="146" text-anchor="middle" class="d-small d-bold">no</text>
<text x="253" y="163" text-anchor="middle" class="d-small">save awaiter, state = 0</text>
<text x="14" y="200" class="d-muted d-small">AwaitUnsafeOnCompleted(...); MoveNext</text>
<text x="14" y="216" class="d-muted d-small">returns. Caller keeps running.</text>
<path d="M14 238 H326" class="d-line d-dashed"/>
<text x="14" y="266" class="d-bold">Later, when the delay elapses:</text>
<text x="14" y="284" class="d-small d-muted">a pool thread's timer callback resumes it</text>
<rect x="14" y="296" width="312" height="40" rx="6" class="d-box-accent"/>
<text x="170" y="321" text-anchor="middle" class="d-mono d-small">Call 2: MoveNext(), state = 0</text>
<path d="M170 336 V358" class="d-accent" marker-end="url(#aa-sm-arrow)"/>
<rect x="14" y="370" width="312" height="64" rx="6" class="d-box"/>
<text x="170" y="396" text-anchor="middle" class="d-mono d-small">_awaiter.GetResult()</text>
<text x="170" y="416" text-anchor="middle" class="d-mono d-small">Builder.SetResult(x + 1)</text>
</svg>
<figcaption>Figure 1. The two calls to MoveNext together are the whole method; the state field is how the second call knows to skip the part already done.</figcaption>
</figure>

:::dotnet
The real compiler output does more than this sketch: it flows `ExecutionContext` across the suspension, picks `AwaitOnCompleted` instead of `AwaitUnsafeOnCompleted` when the awaiter doesn't implement `ICriticalNotifyCompletion`, and — because `AddOneStateMachine` is a struct — boxes it onto the heap the first time the method actually suspends, so that the copy referenced by the pending continuation and the copy `MoveNext` runs on are the same object. A method that always completes synchronously never pays that box ([How Async/Await Really Works in C#](https://devblogs.microsoft.com/dotnet/how-async-await-really-works/)).
:::

::::exercise[Predict it: what runs before the first await]
The program below records five letters into `log` instead of printing them, so there's nothing to peek at. Without running it, write down the order `log` ends up in.

```csharp run id=order
List<string> log = [];
log.Add("A");
var task = ShowAsync();
log.Add("C");
await task;
log.Add("E");

// What order is `log` in now?

async Task ShowAsync()
{
    log.Add("B");
    await Task.Delay(10);
    log.Add("D");
}
```

:::solution
```csharp run id=order-solved
List<string> log = [];
log.Add("A");
var task = ShowAsync();
log.Add("C");
await task;
log.Add("E");

Console.WriteLine(string.Join(", ", log));

async Task ShowAsync()
{
    log.Add("B");
    await Task.Delay(10);
    log.Add("D");
}
```

```text output
A, B, C, D, E
```

`ShowAsync()` is a normal method call, and per the state-machine sketch above, `MoveNext` runs synchronously from the top of the body until the first incomplete `await` — so `"B"` is logged before `ShowAsync()` returns a `Task` to its caller. Only then does control return to log `"C"`. `"D"` is logged later, from the second call to `MoveNext`, once `await task` on the last line actually starts waiting for it. Nothing here proves `ShowAsync` ran on a different thread; a single thread interleaving two partially-run methods produces the same order.
:::
::::

## Where the rest of the method runs: `SynchronizationContext`

`AwaitUnsafeOnCompleted` doesn't just remember "call `MoveNext` later" — by default it also remembers *where*. Every thread has a current [`SynchronizationContext`](https://learn.microsoft.com/en-us/dotnet/api/system.threading.synchronizationcontext), a base class the docs describe as providing "a free-threaded context with no synchronization," and UI and hosting frameworks install their own derived context to change that. The clearest description of the differences is the still-current 2011 MSDN Magazine piece that introduced the type: Windows Forms and WPF each install a context whose delegates "are executed one at a time... by a specific UI thread, in the order they were queued," classic (non-Core) ASP.NET installs one that runs queued work on any free request thread but still "ensure[s] that they execute one at a time" per request, and "by default, all threads in console applications and Windows Services only have the default SynchronizationContext," which queues work to the thread pool with no such exclusivity ([It's All About the SynchronizationContext](https://learn.microsoft.com/en-us/archive/msdn-magazine/2011/february/msdn-magazine-parallel-computing-it-s-all-about-the-synchronizationcontext)).

That claim about console apps is checkable, not something to take on faith:

```csharp run id=synccontext
Console.WriteLine($"main thread:  {SynchronizationContext.Current is null}");

await Task.Delay(10);
Console.WriteLine($"after await:  {SynchronizationContext.Current is null}");

await Task.Run(() =>
    Console.WriteLine($"pool thread:  {SynchronizationContext.Current is null}"));
```

```text output
main thread:  True
after await:  True
pool thread:  True
```

`SynchronizationContext.Current` is `null` everywhere in this program, before and after every `await`. That single fact is why a console app cannot show you the deadlock in the next section without help: `await`'s default behavior is to capture `SynchronizationContext.Current` and, if it isn't `null`, marshal the continuation back to it via `Post`; with nothing captured, the continuation just runs on whichever thread pool worker is free. `Task.ConfigureAwait(false)` turns that capture off explicitly, for any context that *is* present: "by specifying `false`, even if there is a current context or scheduler to call back to, it pretends as if there isn't" ([ConfigureAwait FAQ](https://devblogs.microsoft.com/dotnet/configureawait-faq/)). In a plain console program `ConfigureAwait(false)` changes nothing observable, because there was never a context to opt out of — which is exactly what the next section needs to build around.

::::exercise[Find the bug: it runs here, but not everywhere]
This compiles, runs, and prints `42`. It is still a bug. Which call is the dangerous one, and what is the smallest change to the three `async` methods — not the call site — that removes the danger for every caller?

```csharp run id=findbug
Console.WriteLine(LoadConfigAsync().Result);

static async Task<int> LoadConfigAsync()
{
    string raw = await ReadFileAsync();
    return await ParseAsync(raw);
}

static async Task<string> ReadFileAsync()
{
    await Task.Delay(20);
    return "42";
}

static async Task<int> ParseAsync(string raw)
{
    await Task.Delay(20);
    return int.Parse(raw);
}
```

```text output
42
```

:::solution
`.Result` on the first line blocks the calling thread until `LoadConfigAsync` finishes. That's harmless here only because a console app's default `SynchronizationContext` is `null` and doesn't serialize anything, as the experiment above showed. Call the same three methods with `.Result` from a WPF button handler or a classic ASP.NET action, and each internal `await` tries to resume on that caller's exclusive context — which is occupied by the very thread blocked on `.Result`. The fix that protects every caller, including ones you don't control, is `ConfigureAwait(false)` on every `await` inside library code that might be blocked on:

```csharp run id=findbugfix
Console.WriteLine(LoadConfigAsync().Result);

static async Task<int> LoadConfigAsync()
{
    string raw = await ReadFileAsync().ConfigureAwait(false);
    return await ParseAsync(raw).ConfigureAwait(false);
}

static async Task<string> ReadFileAsync()
{
    await Task.Delay(20).ConfigureAwait(false);
    return "42";
}

static async Task<int> ParseAsync(string raw)
{
    await Task.Delay(20).ConfigureAwait(false);
    return int.Parse(raw);
}
```

```text output
42
```

Same output, but now none of the three methods ever tries to resume on a captured context, so a caller's `.Result` can no longer starve them. The call site is still a bad idea — `await` all the way up is the real fix — but that's a design choice for the caller, not something the library can enforce.
:::
::::

## The deadlock `.Result` causes, precisely

The mechanism behind that exercise deserves to be shown, not just described, and it can be shown safely: build a stand-in for the "exclusive" contexts from the previous section, reproduce the deadlock inside it, and detect the hang with a timeout instead of waiting on it forever.

`ExclusiveContext` below is a minimal version of what `WindowsFormsSynchronizationContext` and `DispatcherSynchronizationContext` both are: a `SynchronizationContext` whose `Post` queues work for one dedicated thread to run, one item at a time, in order — matching the "specific thread, exclusive" row of the table above.

```csharp run id=deadlock
using System.Collections.Concurrent;

var pump = new ExclusiveContext();
var finished = new ManualResetEventSlim(false);

pump.RunOnContextThread(() =>
{
    SynchronizationContext.SetSynchronizationContext(pump);
    Console.WriteLine("context thread: calling .Result");
    int n = FetchAsync().Result;
    Console.WriteLine($"never printed: {n}");
    finished.Set();
});

bool completed = finished.Wait(TimeSpan.FromSeconds(2));
Console.WriteLine(completed
    ? "finished before the timeout"
    : "still blocked after 2000 ms: this is the deadlock");

static async Task<int> FetchAsync()
{
    await Task.Delay(200);   // captures SynchronizationContext.Current
    return 42;
}

// A minimal stand-in for WindowsFormsSynchronizationContext /
// DispatcherSynchronizationContext: one dedicated thread, one item
// running at a time, in order.
class ExclusiveContext : SynchronizationContext
{
    private readonly BlockingCollection<(SendOrPostCallback, object?)> _queue = new();

    public ExclusiveContext() =>
        new Thread(RunLoop) { IsBackground = true }.Start();

    public void RunOnContextThread(Action action) =>
        Post(_ => action(), null);

    public override void Post(SendOrPostCallback callback, object? state) =>
        _queue.Add((callback, state));

    private void RunLoop()
    {
        foreach (var (callback, state) in _queue.GetConsumingEnumerable())
            callback(state);
    }
}
```

```text output
context thread: calling .Result
still blocked after 2000 ms: this is the deadlock
```

Walk the cycle in order. `RunOnContextThread` posts the lambda to `pump`, which runs it on the pump's one dedicated thread. That lambda sets `pump` as the *current* context, then calls `FetchAsync().Result` — blocking the pump thread until the `Task<int>` completes. `FetchAsync` runs synchronously up to `await Task.Delay(200)`, which is not complete yet, so — per the state-machine sketch two sections back — it captures `SynchronizationContext.Current` (which is `pump`, just set), saves the awaiter, and returns. 200 ms later the delay's timer fires and tries to resume the rest of `FetchAsync` the way a captured `SynchronizationContext` resumes anything: by calling `pump.Post(...)`. `Post` only *queues* the continuation; the one thread that could ever dequeue and run it is the pump thread, and that thread is parked inside `.Result`, waiting for the very `Task` that continuation would complete. Neither side can move. `finished.Wait(2)` proves it: two seconds is a thousand times the 200 ms the operation actually needs, and it still times out.

<figure class="diagram">
<svg viewBox="0 0 320 300" role="img" aria-labelledby="aa-cycle-title aa-cycle-desc">
<title id="aa-cycle-title">The wait-for cycle behind the deadlock</title>
<desc id="aa-cycle-desc">A box for the pump's one thread, blocked inside .Result, connects downward to a box for the queued continuation with an arrow labelled blocks waiting for; a second arrow goes back upward labelled can only run on, showing each side depends on the other.</desc>
<defs>
<marker id="aa-cycle-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-bad"/></marker>
</defs>
<rect x="10" y="10" width="300" height="64" rx="6" class="d-box-bad"/>
<text x="160" y="36" text-anchor="middle" class="d-bold">Pump's one thread</text>
<text x="160" y="56" text-anchor="middle" class="d-small">blocked inside FetchAsync().Result</text>
<path d="M120 78 V128" class="d-bad" marker-end="url(#aa-cycle-arrow)"/>
<text x="70" y="106" text-anchor="middle" class="d-small d-text-bad">blocks,</text>
<text x="70" y="120" text-anchor="middle" class="d-small d-text-bad">waiting for</text>
<path d="M200 128 V78" class="d-bad" marker-end="url(#aa-cycle-arrow)"/>
<text x="255" y="106" text-anchor="middle" class="d-small d-text-bad">can only</text>
<text x="255" y="120" text-anchor="middle" class="d-small d-text-bad">run on</text>
<rect x="10" y="130" width="300" height="64" rx="6" class="d-box-warn"/>
<text x="160" y="156" text-anchor="middle" class="d-bold">The delay's continuation</text>
<text x="160" y="176" text-anchor="middle" class="d-small">queued in pump, waiting for a turn</text>
<text x="20" y="220" class="d-small d-muted">Each box is waiting on the other. Nothing in</text>
<text x="20" y="238" class="d-small d-muted">the process can break the cycle from outside.</text>
<text x="20" y="270" class="d-small d-muted">The fix: FetchAsync's await never captures</text>
<text x="20" y="286" class="d-small d-muted">pump in the first place (next block).</text>
</svg>
<figcaption>Figure 2. The pump thread and the continuation each need the other to move; that mutual wait is the whole deadlock, not a side effect of it.</figcaption>
</figure>

`ConfigureAwait(false)` breaks the cycle by removing the capture in the first place, not by working around the block. Changing exactly one line — the `await` inside `FetchAsync` — and nothing at the call site:

```csharp run id=nodeadlock
using System.Collections.Concurrent;

var pump = new ExclusiveContext();
var finished = new ManualResetEventSlim(false);

pump.RunOnContextThread(() =>
{
    SynchronizationContext.SetSynchronizationContext(pump);
    Console.WriteLine("context thread: calling .Result");
    int n = FetchAsync().Result;
    Console.WriteLine($"result: {n}");
    finished.Set();
});

bool completed = finished.Wait(TimeSpan.FromSeconds(2));
Console.WriteLine(completed
    ? "finished before the timeout: no deadlock"
    : "still blocked after 2000 ms");

static async Task<int> FetchAsync()
{
    await Task.Delay(200).ConfigureAwait(false);
    return 42;
}

class ExclusiveContext : SynchronizationContext
{
    private readonly BlockingCollection<(SendOrPostCallback, object?)> _queue = new();

    public ExclusiveContext() =>
        new Thread(RunLoop) { IsBackground = true }.Start();

    public void RunOnContextThread(Action action) =>
        Post(_ => action(), null);

    public override void Post(SendOrPostCallback callback, object? state) =>
        _queue.Add((callback, state));

    private void RunLoop()
    {
        foreach (var (callback, state) in _queue.GetConsumingEnumerable())
            callback(state);
    }
}
```

```text output
context thread: calling .Result
result: 42
finished before the timeout: no deadlock
```

`ConfigureAwait(false)` on the delay tells `AwaitUnsafeOnCompleted` to skip capturing `SynchronizationContext.Current`, so the resumed half of `FetchAsync` runs on whichever thread pool worker the timer wakes — a thread nobody is blocking on. `.Result` still blocks the pump thread for the 200 ms the delay genuinely needs, which is its own cost, but it is no longer waiting on itself.

:::note[Why this needed a stand-in context]
The [`SynchronizationContext.Current` experiment](#where-the-rest-of-the-method-runs-synchronizationcontext) showed it is `null` throughout an ordinary console program. `ExclusiveContext` exists only to give this console program the one property — a single thread that every queued continuation must share — that a real WPF, Windows Forms, or classic ASP.NET host installs automatically. The deadlock is the same deadlock; this page just had to build the context a GUI framework would otherwise hand you for free.
:::

Two threads deadlocking over a `lock` is a different, more familiar failure with its own detection technique; it belongs to a [dedicated article on race conditions and locks](/operating-systems/concurrency-race-conditions-locks/) rather than a repeat here.

## Running several awaits at once: `Task.WhenAll`

An `await` in a loop, one call at a time, is still sequential — `async` changes what the thread does while it waits, not how many things happen at once. Starting every task before awaiting any of them, then awaiting the group with `Task.WhenAll`, is what actually overlaps the waits:

```csharp run id=seqconcurrent
using System.Diagnostics;

const int Requests = 5;
var clock = Stopwatch.StartNew();

List<int> sequential = [];
foreach (int i in Enumerable.Range(0, Requests))
    sequential.Add(await FetchAsync(i));
Console.WriteLine(
    $"sequential: {clock.ElapsedMilliseconds} ms, {sequential.Count} results");

clock.Restart();
Task<int>[] tasks = [.. Enumerable.Range(0, Requests).Select(FetchAsync)];
int[] concurrent = await Task.WhenAll(tasks);
Console.WriteLine(
    $"concurrent: {clock.ElapsedMilliseconds} ms, {concurrent.Length} results");

static async Task<int> FetchAsync(int id)
{
    await Task.Delay(100);
    return id;
}
```

```text output
sequential: [...] ms, 5 results
concurrent: [...] ms, 5 results
```

On the test machine the sequential loop took a little over 500 ms — five 100 ms waits, back to back, none of them overlapping because each `await` doesn't start the next `FetchAsync` until the previous one has fully finished. The `WhenAll` version started all five `Task<int>` objects first (`Select` alone starts them; nothing waits yet), then awaited the whole array, and took a little over 100 ms — roughly the cost of one wait, because all five ran concurrently on the thread pool. Awaiting `Task.WhenAll` doesn't use five threads for five hundred milliseconds; it uses however many threads happen to be running at once, each holding a worker only while it has code to execute, the same "let go of the thread while waiting" behavior as a single `await`.

`WhenAll`'s handling of failures is easy to get backwards. If more than one of the awaited tasks faults, the task `WhenAll` returns "will also complete in a Faulted state, where its exceptions will contain the aggregation of the set of unwrapped exceptions from each of the supplied tasks" ([Task.WhenAll](https://learn.microsoft.com/en-us/dotnet/api/system.threading.tasks.task.whenall)) — but `await`ing that faulted task only ever rethrows one of them:

```csharp run id=whenallexc
var first = FailAsync("first", 50);
var second = FailAsync("second", 10);
var all = Task.WhenAll(first, second);

try
{
    await all;
}
catch (InvalidOperationException ex)
{
    Console.WriteLine($"await surfaced: {ex.Message}");
}

Console.WriteLine(
    $"WhenAll task has {all.Exception!.InnerExceptions.Count} exceptions:");
foreach (var e in all.Exception.InnerExceptions)
    Console.WriteLine($"  {e.Message}");

static async Task FailAsync(string name, int delayMs)
{
    await Task.Delay(delayMs);
    throw new InvalidOperationException($"{name} failed");
}
```

```text output
await surfaced: second failed
WhenAll task has 2 exceptions:
  second failed
  first failed
```

`second` faults first, because its delay is shorter, and `await` surfaces only that one exception — the same "throw the first exception, not the whole aggregate" behavior a plain awaited `Task` has. Both failures are still there on the completed task's `Exception.InnerExceptions`; code that needs to react to every failure, not just the first one observed, has to look there instead of relying on the `catch` block.

## Cancelling work that is actually running

.NET's cancellation model is cooperative: a `CancellationTokenSource` owns the decision to cancel, hands copies of its `CancellationToken` to the operations that should listen, and each operation decides for itself how and when to notice ([Cancellation in Managed Threads](https://learn.microsoft.com/en-us/dotnet/standard/threading/cancellation-in-managed-threads)). Nothing forces a running operation to stop; passing the token is what gives it the chance to. The program below downloads ten chunks, each with its own delay, and is asked to stop partway through:

```csharp run id=cancel
using var cts = new CancellationTokenSource();
cts.CancelAfter(TimeSpan.FromMilliseconds(250));

try
{
    await DownloadAsync(cts.Token);
}
catch (OperationCanceledException)
{
    Console.WriteLine("canceled: caught OperationCanceledException");
}

static async Task DownloadAsync(CancellationToken token)
{
    for (int chunk = 1; chunk <= 10; chunk++)
    {
        token.ThrowIfCancellationRequested();
        await Task.Delay(100, token);
        Console.WriteLine($"chunk {chunk} done");
    }
}
```

```text output
chunk 1 done
chunk 2 done
canceled: caught OperationCanceledException
```

`CancelAfter(250 ms)` schedules the cancellation; it doesn't touch the download loop directly. Two chunks complete (200 ms), and while `Task.Delay(100, token)` is waiting for the third, the token fires: `Task.Delay` observes it, and rather than completing normally it ends the task with an `OperationCanceledException` carrying that token. `ThrowIfCancellationRequested()` at the top of the loop is the same idea checked by hand, for the parts of a method that aren't already `await`ing something cancellation-aware. Passing the token into `Task.Delay` is what lets the wait itself end early instead of running the full 100 ms before the next poll.

## `ValueTask<T>`: paying for the box only when you need it

`Task<TResult>` is a class, so a method that returns one — even one that already knows the answer — allocates. `ValueTask<TResult>` is a struct that can hold a `TResult` directly, with no heap object, for exactly that case: "the default choice for any asynchronous method... should be `Task`. Only if performance analysis proves it worthwhile should a `ValueTask` be used instead" ([ValueTask Struct](https://learn.microsoft.com/en-us/dotnet/api/system.threading.tasks.valuetask)), because the type it wraps around most often *is* one already backed by a `Task` behind the scenes. A cache is the textbook case for the exception: most calls already have an answer.

```csharp run id=valuetask
#:property Optimize=true
using System.Runtime.CompilerServices;

Dictionary<int, string> cache = new() { [1] = "one" };

Report("Task<string>", () => GetTaskAsync(cache, 1).GetAwaiter().GetResult());
Report("ValueTask<string>", () => GetValueTaskAsync(cache, 1).GetAwaiter().GetResult());

static void Report(string label, Func<string> call)
{
    call();   // warm-up run, not measured
    long before = HeapBytes();
    string result = call();
    long bytes = HeapBytes() - before;
    Console.WriteLine($"{label,-18}{bytes,4} B  ({result})");
}

static long HeapBytes() => GC.GetAllocatedBytesForCurrentThread();

[MethodImpl(MethodImplOptions.NoInlining)]
static Task<string> GetTaskAsync(Dictionary<int, string> cache, int key) =>
    cache.TryGetValue(key, out var v) ? Task.FromResult(v) : SlowAsync(key);

[MethodImpl(MethodImplOptions.NoInlining)]
static ValueTask<string> GetValueTaskAsync(Dictionary<int, string> cache, int key) =>
    cache.TryGetValue(key, out var v)
        ? new ValueTask<string>(v)
        : new ValueTask<string>(SlowAsync(key));

static async Task<string> SlowAsync(int key)
{
    await Task.Delay(10);
    return $"slow-{key}";
}
```

```text output
Task<string>        72 B  (one)
ValueTask<string>    0 B  (one)
```

On a cache hit, `Task.FromResult(v)` allocates a new `Task<string>` every call — 72 bytes of it, on this runtime — while `new ValueTask<string>(v)` wraps the string directly in a struct and allocates nothing. Both methods still fall back to a real `Task` (via `SlowAsync`) when the cache misses; `ValueTask<TResult>` can hold either a value or a `Task<TResult>`, which is what makes it a drop-in replacement for the fast path without losing the slow path.

That saving comes with sharp edges the docs are explicit about: "the following operations should never be performed on a `ValueTask` instance: awaiting the instance multiple times... calling `AsTask` multiple times... using more than one of these techniques to consume the instance. If you do any of the above, the results are undefined" ([ValueTask Struct](https://learn.microsoft.com/en-us/dotnet/api/system.threading.tasks.valuetask)). A `Task` can be awaited, cached in a variable, and awaited again by something else; some `ValueTask` implementations recycle their internal state as soon as they're consumed once, and a second consumer can find a completely different operation's result waiting there. Store the result, not the `ValueTask`, if more than one piece of code needs it.

## `async void`: the one place exceptions have nowhere to go

`async void` exists for one reason: an event handler's signature is fixed as `void`, and it still needs to run `async` code. Everywhere else the guidance is not to use it, because "exceptions thrown in an `async void` method can't be caught outside of that method" and such methods "are difficult to test" and "can cause negative side effects if the caller isn't expecting them to be asynchronous" ([Asynchronous programming scenarios](https://learn.microsoft.com/en-us/dotnet/csharp/asynchronous-programming/async-scenarios)). "Can't be caught outside of that method" is easy to state and easy to doubt, so the program below tries to catch one anyway, from a child process so the crash it causes doesn't take down the article's own test run.

```csharp run id=asyncvoid
using System.Diagnostics;

if (args is ["child"])
{
    try
    {
        FailAsyncVoid();
        Console.WriteLine("try: returned normally");
    }
    catch (InvalidOperationException)
    {
        Console.WriteLine("try: caught it (should not print)");
    }
    Thread.Sleep(500);
    Console.WriteLine("main: finished (should not print)");
    return;
}

var startInfo = new ProcessStartInfo(
    Environment.ProcessPath!, "child")
{
    RedirectStandardOutput = true,
    RedirectStandardError = true,
};
using var child = Process.Start(startInfo)!;
string stdout = child.StandardOutput.ReadToEnd().Trim();
string stderr = child.StandardError.ReadToEnd();
child.WaitForExit();
string firstLine = stderr.Split('\n')[0].Trim();

Console.WriteLine($"child printed: \"{stdout}\"");
Console.WriteLine($"child exit code 0: {child.ExitCode == 0}");
Console.WriteLine($"child stderr starts: {firstLine}");

static async void FailAsyncVoid()
{
    await Task.Yield();
    throw new InvalidOperationException("boom from async void");
}
```

```text output
child printed: "try: returned normally"
child exit code 0: False
child stderr starts: Unhandled exception. System.InvalidOperationException: boom from async void
```

The `try` block did finish normally — `FailAsyncVoid()` had already returned to it by the time anything could go wrong, exactly as the state machine sketch predicts: `FailAsyncVoid` runs synchronously up to `await Task.Yield()`, returns `void` to its caller, and only then does the queued continuation run and throw. Nothing is listening for that exception the way a `Task`'s caller listens by awaiting it, so it becomes an unhandled exception on whatever thread runs the continuation — the same fate an exception on any unmonitored thread has, and it takes the whole process down mid-`Sleep`, before `"main: finished"` ever prints. Wrapping `FailAsyncVoid()` in `try`/`catch` compiled without warning and did nothing.

`async Task` behaves the way `catch` expects, because the exception has somewhere documented to live: the task itself.

```csharp run id=asynctaskcatch
try
{
    await FailAsyncTask();
    Console.WriteLine("finished normally (should not print)");
}
catch (InvalidOperationException ex)
{
    Console.WriteLine($"caught: {ex.Message}");
}

static async Task FailAsyncTask()
{
    await Task.Yield();
    throw new InvalidOperationException("boom from async Task");
}
```

```text output
caught: boom from async Task
```

Same shape of method, same exception, same `await Task.Yield()` before it throws — the only difference is the return type. `Builder.SetException(ex)` in the earlier sketch is what makes the difference: an `AsyncTaskMethodBuilder<TResult>` routes an exception into the `Task` it hands back, where `await` can rethrow it; the `void`-returning builder has no task to put it in, so it has nowhere to route the exception but the thread that happens to run the continuation.

## Practice: trace what actually runs

::::exercise[Extend it: process results as they arrive]
`Task.WhenAll` waits for every task before returning anything. Extend the pattern below to print each city's result as soon as it finishes, in whichever order that turns out to be, using `Task.WhenAny` in a loop instead. Predict the order before you run it: the delays are 150 ms, 50 ms and 100 ms.

```csharp run id=whenany-stub
List<Task<(string City, int Ms)>> pending =
[
    FetchAsync("north", 150),
    FetchAsync("south", 50),
    FetchAsync("east", 100),
];

// Extend from here: drain `pending` with Task.WhenAny,
// printing each result as it becomes available.

static async Task<(string, int)> FetchAsync(string city, int ms)
{
    await Task.Delay(ms);
    return (city, ms);
}
```

:::solution
```csharp run id=whenany
var pending = new List<Task<(string City, int Ms)>>
{
    FetchAsync("north", 150),
    FetchAsync("south", 50),
    FetchAsync("east", 100),
};

while (pending.Count > 0)
{
    Task<(string City, int Ms)> done = await Task.WhenAny(pending);
    pending.Remove(done);
    var (city, ms) = await done;
    Console.WriteLine($"{city} answered first after its own {ms} ms");
}

static async Task<(string, int)> FetchAsync(string city, int ms)
{
    await Task.Delay(ms);
    return (city, ms);
}
```

```text output
south answered first after its own 50 ms
east answered first after its own 100 ms
north answered first after its own 150 ms
```

The order matches each request's own delay, not the order it was listed in `pending`: `WhenAny` resolves to whichever task in the collection finishes first, `Remove` takes it out so the next `WhenAny` doesn't see it again, and `await done` on an already-completed task returns instantly. All three requests were still running concurrently the whole time — this reorders when you *observe* each result, not when the work happens.
:::
::::

::::exercise[Measure it: does the optimizer change what `ValueTask<T>` saves?]
The `ValueTask<string>` measurement earlier used `new ValueTask<string>(v)` directly. Write an `async ValueTask<string>` *method* instead — cache hit returns immediately, cache miss awaits a delay — and measure the heap bytes of a cache-hit call, once compiled the normal way and once with `#:property Optimize=true` added. Predict whether the flag matters before you run either version.

:::solution
Without the flag, `dotnet run` builds the file in a debug configuration, which affects the async state machine's own codegen, separately from anything about `ValueTask`:

```csharp run id=valuetask-debug
using System.Runtime.CompilerServices;

Dictionary<int, string> cache = new() { [1] = "one" };

GetAsync(cache, 1).GetAwaiter().GetResult();   // warm-up
long before = GC.GetAllocatedBytesForCurrentThread();
string result = GetAsync(cache, 1).GetAwaiter().GetResult();
long bytes = GC.GetAllocatedBytesForCurrentThread() - before;
Console.WriteLine($"debug build: {bytes} B ({result})");

[MethodImpl(MethodImplOptions.NoInlining)]
static async ValueTask<string> GetAsync(Dictionary<int, string> cache, int key)
{
    if (cache.TryGetValue(key, out var v)) return v;
    await Task.Delay(10);
    return "slow";
}
```

```text output
debug build: 64 B (one)
```

Adding `#:property Optimize=true` and nothing else brings the same call down to 0 bytes:

```csharp run id=valuetask-release
#:property Optimize=true
using System.Runtime.CompilerServices;

Dictionary<int, string> cache = new() { [1] = "one" };

GetAsync(cache, 1).GetAwaiter().GetResult();   // warm-up
long before = GC.GetAllocatedBytesForCurrentThread();
string result = GetAsync(cache, 1).GetAwaiter().GetResult();
long bytes = GC.GetAllocatedBytesForCurrentThread() - before;
Console.WriteLine($"optimized build: {bytes} B ({result})");

[MethodImpl(MethodImplOptions.NoInlining)]
static async ValueTask<string> GetAsync(Dictionary<int, string> cache, int key)
{
    if (cache.TryGetValue(key, out var v)) return v;
    await Task.Delay(10);
    return "slow";
}
```

```text output
optimized build: 0 B (one)
```

Writing `async ValueTask<T>` is not the same trick as constructing a `ValueTask<T>` by hand: it still goes through the state-machine machinery from earlier in this page, and whether an optimized JIT manages to avoid allocating that state machine on the synchronous path is a codegen detail, not a guarantee. The earlier hand-constructed `new ValueTask<string>(v)` allocates nothing regardless of this flag, because it never builds a state machine at all — it is one struct constructor call. The lesson the `ValueTask` docs draw from this kind of gap is the reason they recommend `Task` by default and `ValueTask` "only if performance analysis proves it worthwhile": the saving is real, but it is not automatic just because the return type changed.
:::
::::
