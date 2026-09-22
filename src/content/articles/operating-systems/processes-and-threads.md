---
title: "Processes vs Threads: What Each One Owns and Costs"
description: "Watch from C# what a process and a thread each own: shared heap, private stacks, crash isolation, context switch cost and thread pool starvation."
pillar: operating-systems
order: 1
author: markus
published: 2026-09-21
updated: 2026-09-21
level: intermediate
tags: [processes, threads, thread-pool, concurrency, context-switch]
prerequisites: []
sources:
  - title: "About Processes and Threads"
    url: "https://learn.microsoft.com/en-us/windows/win32/procthread/about-processes-and-threads"
    publisher: "Microsoft Learn"
    accessed: 2026-09-21
  - title: "Context Switches"
    url: "https://learn.microsoft.com/en-us/windows/win32/procthread/context-switches"
    publisher: "Microsoft Learn"
    accessed: 2026-09-21
  - title: "Thread Stack Size"
    url: "https://learn.microsoft.com/en-us/windows/win32/procthread/thread-stack-size"
    publisher: "Microsoft Learn"
    accessed: 2026-09-21
  - title: "Inheritance (Processes and Threads)"
    url: "https://learn.microsoft.com/en-us/windows/win32/procthread/inheritance"
    publisher: "Microsoft Learn"
    accessed: 2026-09-21
  - title: "pthreads(7): POSIX threads"
    url: "https://man7.org/linux/man-pages/man7/pthreads.7.html"
    publisher: "Linux man-pages"
    accessed: 2026-09-21
  - title: "clone(2): create a child process"
    url: "https://man7.org/linux/man-pages/man2/clone.2.html"
    publisher: "Linux man-pages"
    accessed: 2026-09-21
  - title: "fork(2): create a child process"
    url: "https://man7.org/linux/man-pages/man2/fork.2.html"
    publisher: "Linux man-pages"
    accessed: 2026-09-21
  - title: "dotnet/runtime: pal_process.c (SystemNative_ForkAndExecProcess)"
    url: "https://github.com/dotnet/runtime/blob/main/src/native/libs/System.Native/pal_process.c"
    publisher: "GitHub"
    accessed: 2026-09-21
  - title: "Threads and threading"
    url: "https://learn.microsoft.com/en-us/dotnet/standard/threading/threads-and-threading"
    publisher: "Microsoft Learn"
    accessed: 2026-09-21
  - title: "Foreground and background threads"
    url: "https://learn.microsoft.com/en-us/dotnet/standard/threading/foreground-and-background-threads"
    publisher: "Microsoft Learn"
    accessed: 2026-09-21
  - title: "Thread constructors (maxStackSize)"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.threading.thread.-ctor"
    publisher: "Microsoft Learn"
    accessed: 2026-09-21
  - title: "Process.Start method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.diagnostics.process.start"
    publisher: "Microsoft Learn"
    accessed: 2026-09-21
  - title: "The managed thread pool"
    url: "https://learn.microsoft.com/en-us/dotnet/standard/threading/the-managed-thread-pool"
    publisher: "Microsoft Learn"
    accessed: 2026-09-21
  - title: "ThreadPool.SetMinThreads method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.threading.threadpool.setminthreads"
    publisher: "Microsoft Learn"
    accessed: 2026-09-21
  - title: "Debug ThreadPool starvation"
    url: "https://learn.microsoft.com/en-us/dotnet/core/diagnostics/debug-threadpool-starvation"
    publisher: "Microsoft Learn"
    accessed: 2026-09-21
  - title: "TaskCreationOptions enum"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.threading.tasks.taskcreationoptions"
    publisher: "Microsoft Learn"
    accessed: 2026-09-21
  - title: "Operating Systems: Three Easy Pieces, chapter 26: Concurrency: An Introduction"
    url: "https://pages.cs.wisc.edu/~remzi/OSTEP/threads-intro.pdf"
    publisher: "Arpaci-Dusseau Books"
    accessed: 2026-09-21
  - title: "Operating Systems: Three Easy Pieces, chapter 7: Scheduling: Introduction"
    url: "https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched.pdf"
    publisher: "Arpaci-Dusseau Books"
    accessed: 2026-09-21
  - title: "Li, Ding, Shen: Quantifying The Cost of Context Switch (ExpCS 2007)"
    url: "https://www.usenix.org/legacy/events/expcs07/papers/2-li.pdf"
    publisher: "USENIX"
    accessed: 2026-09-21
  - title: "Chromium design documents: Multi-process Architecture"
    url: "https://www.chromium.org/developers/design-documents/multi-process-architecture/"
    publisher: "The Chromium Projects"
    accessed: 2026-09-21
draft: true
---

A [process](/glossary/#process) is the operating system's unit of ownership: it holds memory, open files and a security identity. A [thread](/glossary/#thread) is the unit of execution: the thing the scheduler places on a CPU core. A running program is one process with at least one thread inside it. Most practical differences between the two (what a crash destroys, what is cheap to create, what can corrupt what) follow from a single fact: threads of one process share its memory, and separate processes do not. The programs below make that fact visible from C#, then put prices on it.

## One write, seen from a thread and from a child process

This program keeps a number in an array, lets a second thread change it, then starts a second process and lets that change it too. To get a second process without a second source file, it launches its own executable again with the argument `child`; `Environment.ProcessPath` is the path of the executable that `dotnet run` built.

```csharp run id=shared
using System.Diagnostics;

int[] box = [100];   // one array on the heap
int pid = Environment.ProcessId;
void Say(string who, string what) =>
    Console.WriteLine($"{who} {pid}: {what}");

if (args is ["child"])
{
    // A new process: the file runs from the top.
    Say("child ", $"sees {box[0]}");
    box[0] = 999;
    Say("child ", $"wrote {box[0]}");
    return;
}

var worker = new Thread(() =>
{
    box[0] += 1;
    Say("thread", $"wrote {box[0]}");
});
worker.Start();
worker.Join();
Say("parent", $"sees {box[0]}");

var startInfo = new ProcessStartInfo(
    Environment.ProcessPath!, "child")
{
    RedirectStandardOutput = true,
};
using var child = Process.Start(startInfo)!;
string childSaid =
    child.StandardOutput.ReadToEnd();
child.WaitForExit();
Console.Write(childSaid);
Say("parent", $"sees {box[0]}");
```

```text output
thread [...]: wrote 101
parent [...]: sees 101
child  [...]: sees 100
child  [...]: wrote 999
parent [...]: sees 101
```

The process IDs are wildcards because they differ on every run; on one run here the thread and parent lines showed 9428 and the child lines 34488.

Read the five lines as two experiments. The thread ran inside process 9428, reached the same array through the same reference, and its write was there when the main thread looked. The child got its own process ID, built its own array holding 100, overwrote it with 999, and none of that reached the parent, which still reads 101. The only thing that crossed the boundary was text: the child's standard output travelled through a pipe that `RedirectStandardOutput` asked for, and the parent read it as a stream of characters. Between threads you share objects. Between processes you send bytes.

:::note[What about fork?]
The child saw 100, not 101, because `Process.Start` runs a program from its beginning. On Windows a new process gets handles, environment variables and the current directory from its parent if the parent allows it, but none of the parent's heap ([Inheritance](https://learn.microsoft.com/en-us/windows/win32/procthread/inheritance)). On Linux, `fork()` does start the child with a copy of the parent's memory, made cheap by copy-on-write pages, and the two copies then diverge ([fork(2)](https://man7.org/linux/man-pages/man2/fork.2.html)). A C program that forks would print 101 in the child. A .NET program will not: on Unix the runtime follows `fork` or `vfork` with `execve` straight away, which replaces the copied image with the new program ([pal_process.c](https://github.com/dotnet/runtime/blob/main/src/native/libs/System.Native/pal_process.c)). Either way the writes stay private.
:::

## What belongs to the process and what belongs to each thread

Microsoft's description of the Windows model lists the two sets precisely. A process has a virtual address space, executable code, open handles to system objects, a security context, a process identifier, environment variables, a priority class and at least one thread. All threads of the process share that address space and those system resources, and each thread additionally keeps its own scheduling priority, thread-local storage, thread identifier and *thread context*: the machine registers, a kernel stack and a user-mode stack that lives inside the process's address space ([About Processes and Threads](https://learn.microsoft.com/en-us/windows/win32/procthread/about-processes-and-threads)). POSIX draws the line in almost the same place: process ID, open file descriptors, current directory, user and group IDs and signal dispositions are process-wide, while thread ID, signal mask and `errno` are per thread ([pthreads(7)](https://man7.org/linux/man-pages/man7/pthreads.7.html)).

<figure class="diagram">
<svg viewBox="0 0 360 430" role="img" aria-labelledby="pt-as-title pt-as-desc">
<title id="pt-as-title">One process with three threads, next to a separate process</title>
<desc id="pt-as-desc">Process A is one address space containing code, a heap with static data, and open handles, all shared. Inside it, three threads each have a private stack and private registers. Process B below is a separate address space that no address in A refers to.</desc>
<text x="10" y="22" class="d-bold">Process A: one virtual address space</text>
<rect x="10" y="32" width="340" height="250" rx="8" class="d-box"/>
<rect x="24" y="44" width="312" height="32" rx="5" class="d-box-accent"/>
<text x="180" y="65" text-anchor="middle">code: the program and its libraries</text>
<rect x="24" y="84" width="312" height="48" rx="5" class="d-box-accent"/>
<text x="180" y="104" text-anchor="middle" class="d-bold">heap and static data</text>
<text x="180" y="122" text-anchor="middle" class="d-small">any thread can read and write any of it</text>
<rect x="24" y="140" width="312" height="32" rx="5" class="d-box-accent"/>
<text x="180" y="161" text-anchor="middle">open files, sockets, other handles</text>
<text x="74" y="192" text-anchor="middle" class="d-small d-muted">thread 1</text>
<text x="180" y="192" text-anchor="middle" class="d-small d-muted">thread 2</text>
<text x="286" y="192" text-anchor="middle" class="d-small d-muted">thread 3</text>
<rect x="24" y="198" width="100" height="36" rx="5" class="d-box-2"/>
<text x="74" y="221" text-anchor="middle" class="d-mono">stack</text>
<rect x="130" y="198" width="100" height="36" rx="5" class="d-box-2"/>
<text x="180" y="221" text-anchor="middle" class="d-mono">stack</text>
<rect x="236" y="198" width="100" height="36" rx="5" class="d-box-2"/>
<text x="286" y="221" text-anchor="middle" class="d-mono">stack</text>
<rect x="24" y="238" width="100" height="32" rx="5" class="d-box-2"/>
<text x="74" y="259" text-anchor="middle" class="d-mono d-small">registers</text>
<rect x="130" y="238" width="100" height="32" rx="5" class="d-box-2"/>
<text x="180" y="259" text-anchor="middle" class="d-mono d-small">registers</text>
<rect x="236" y="238" width="100" height="32" rx="5" class="d-box-2"/>
<text x="286" y="259" text-anchor="middle" class="d-mono d-small">registers</text>
<text x="10" y="302" class="d-small d-text-accent">Accent boxes: shared by every thread of A</text>
<text x="10" y="320" class="d-small d-muted">Gray boxes: one set per thread</text>
<path d="M10 340 H350" class="d-bad d-dashed"/>
<text x="180" y="360" text-anchor="middle" class="d-small d-text-bad">no address in A refers to memory in B</text>
<rect x="10" y="372" width="340" height="50" rx="8" class="d-box"/>
<text x="180" y="393" text-anchor="middle">Process B: its own code, heap, handles</text>
<text x="180" y="411" text-anchor="middle" class="d-small d-muted">and at least one thread of its own</text>
</svg>
<figcaption>Figure 1. A thread adds only a stack and a set of registers to its process. Everything in the accent boxes is common property, which is why threads can cooperate without copying and can also corrupt each other's data.</figcaption>
</figure>

Two details in that picture are easy to get wrong.

First, the stacks are private by convention, not by protection. They sit in the same address space as everything else, so a pointer to one thread's local variable works from any other thread of the process. Nothing in the hardware separates thread 1's stack from thread 2's the way it separates process A from process B. How the hardware enforces the process boundary is the subject of virtual memory, a later article in this series.

Second, the operating systems disagree about how fundamental the distinction is. Windows treats process and thread as different kinds of object. Linux creates both with one system call, `clone`, and a set of flags that say what the new task shares with its creator: `CLONE_VM` for the memory space, `CLONE_FILES` for the file descriptor table, `CLONE_THREAD` to join the caller's thread group ([clone(2)](https://man7.org/linux/man-pages/man2/clone.2.html)). With the flags set you get what everyone calls a thread; with none of them you get what `fork` gives you. The glibc thread library is a 1:1 implementation built on `clone`, meaning every `pthread` is a separate kernel scheduling entity ([pthreads(7)](https://man7.org/linux/man-pages/man7/pthreads.7.html)). "Process versus thread" is therefore two useful points on a scale of how much is shared, and the rest of this article is about those two points.

### The private part, measured

A thread's [call stack](/glossary/#call-stack) is the largest thing it owns. This program parks 100 threads on an event and asks the operating system how much the process grew.

```csharp run id=stacks
using System.Diagnostics;

const int Count = 100;
using ManualResetEventSlim release = new();
using CountdownEvent allStarted = new(Count);

var me = Process.GetCurrentProcess();
long reserved0 = me.VirtualMemorySize64;
long committed0 = me.PrivateMemorySize64;
int threads0 = me.Threads.Count;

var threads = new List<Thread>();
for (int i = 0; i < Count; i++)
{
    var t = new Thread(() =>
    {
        allStarted.Signal();
        release.Wait();   // park here
    });
    t.Start();
    threads.Add(t);
}
allStarted.Wait();

me.Refresh();
long reservedKb =
    (me.VirtualMemorySize64 - reserved0)
    / Count / 1024;
long committedKb =
    (me.PrivateMemorySize64 - committed0)
    / Count / 1024;
Console.WriteLine(
    $"OS threads: {threads0} -> {me.Threads.Count}");
Console.WriteLine(
    $"reserved per thread:  {reservedKb} KB");
Console.WriteLine(
    $"committed per thread: {committedKb} KB");

release.Set();
threads.ForEach(t => t.Join());
```

```text output
OS threads: [...] -> [...]
reserved per thread:  [...] KB
committed per thread: [...] KB
```

On the test machine (.NET 10.0.401, Windows 11, x64) the three lines were `8 -> 108`, 1536 to 1537 KB and 38 KB, stable across repeated runs.

`8 -> 108` says that each `Thread` object became a real operating-system thread, and that the process already had eight before the program asked for any: the main thread plus helpers the runtime started for itself.

The other two numbers show the difference between *reserving* address space and *committing* memory. Windows reserves the whole stack up front so that it can grow contiguously, commits a few pages, and commits more as the stack deepens; the size of the reservation comes from the executable's header, and the linker's default is 1 MB ([Thread Stack Size](https://learn.microsoft.com/en-us/windows/win32/procthread/thread-stack-size)). The 1536 KB measured here means the executable that `dotnet run` produced asks for 1.5 MB. The `Thread` constructor has an overload with a `maxStackSize` argument that overrides the header value, although its documentation recommends leaving the default alone ([Thread constructors](https://learn.microsoft.com/en-us/dotnet/api/system.threading.thread.-ctor)); passing `256 * 1024` brought the reserved figure down to 257 KB on the same machine.

Reserved address space costs almost nothing on a 64-bit system. The 37 KB of committed memory per parked thread is the real charge, and it covers the first stack pages plus the bookkeeping the OS and the runtime keep for each thread. These are Windows figures; expect different ones on Linux or macOS.

::::exercise[A local that is not local]
Both threads below run `Tally`, and the output shows that each had its own `local` but that they shared `captured`. Both are declared as local variables. Explain where each one lives in memory and why, then say what could change in the output if the `Interlocked.Increment` call were replaced by `captured++`.

```csharp run id=tally
using static System.Threading.Interlocked;

int captured = 0;

void Tally()
{
    int local = 0;
    for (int i = 0; i < 1000; i++)
    {
        local++;
        Increment(ref captured);  // atomic
    }
    Console.WriteLine(
        $"local    = {local}");
}

var first = new Thread(Tally);
var second = new Thread(Tally);
first.Start();
second.Start();
first.Join();
second.Join();
Console.WriteLine(
    $"captured = {captured}");
```

```text output
local    = 1000
local    = 1000
captured = 2000
```

:::solution
Each call to `Tally` gets its own stack frame on the calling thread's stack, so there are two separate `local` variables and each reaches 1000. `captured` is used inside a local function that is converted to a delegate, so the C# compiler moves it off the stack into a compiler-generated object on the heap, and both threads reach that one object. "Locals are private to a thread" is true of what is really on a stack; a variable captured by a lambda or a local function is not there any more.

`Interlocked.Increment` makes each increment a single atomic step. `captured++` is a read, an add and a write, and two threads can interleave those steps so that one increment overwrites the other. The last line could then show less than 2000, and not the same number on each run. That is a [race condition](/glossary/#race-condition), the subject of the next article in this series. The two `local` lines cannot change, because nothing else can reach those variables.
:::
::::

## A crash takes the whole process, and stops at its edge

Sharing an address space also means sharing a fate. In .NET an unhandled exception on any thread, foreground, background or pool, terminates the process ([Threads and threading](https://learn.microsoft.com/en-us/dotnet/standard/threading/threads-and-threading), [The managed thread pool](https://learn.microsoft.com/en-us/dotnet/standard/threading/the-managed-thread-pool)). The child below starts a thread that throws while its main thread is asleep with work still to do. The parent watches from outside.

```csharp run id=crash
using System.Diagnostics;

if (args is ["child"])
{
    var doomed = new Thread(() =>
        throw new FormatException("bad input"));
    doomed.Start();
    Thread.Sleep(5000);
    Console.WriteLine("child: main finished");
    return;
}

var startInfo = new ProcessStartInfo(
    Environment.ProcessPath!, "child")
{
    RedirectStandardOutput = true,
    RedirectStandardError = true,
};
using var child = Process.Start(startInfo)!;
var stderrTask =
    child.StandardError.ReadToEndAsync();
string stdout =
    child.StandardOutput.ReadToEnd();
child.WaitForExit();

string stderr = await stderrTask;
string firstLine = stderr.Split('\n')[0].Trim();
bool clean = child.ExitCode == 0;
Console.WriteLine($"child stdout: \"{stdout}\"");
Console.WriteLine("child stderr starts:");
foreach (string part in firstLine.Split(". ", 2))
    Console.WriteLine($"  {part}");
Console.WriteLine($"exit code 0: {clean}");
Console.WriteLine("parent: still running");
```

```text output
child stdout: ""
child stderr starts:
  Unhandled exception
  System.FormatException: bad input
exit code 0: False
parent: still running
```

The child's main thread never printed its line. It had done nothing wrong; it was in the same process as a thread that failed, and the runtime tore the process down around it. The parent lost nothing except the result it was waiting for, and it found out through the two channels a process boundary leaves open: an exit code and a stream of text.

That asymmetry is the main engineering reason to pay for a process. Chromium's design documents state it as the premise of the browser's architecture: it is close to impossible to build a rendering engine that never crashes or hangs, so each renderer runs in its own process, where a crash takes out a tab and leaves the browser up, and where the renderer's access to the network and the file system can be restricted separately from the browser's ([Multi-process Architecture](https://www.chromium.org/developers/design-documents/multi-process-architecture/)). A thread cannot be given fewer rights to the rest of its process's memory than its siblings have.

:::pitfall
The exit code differs by platform: an unhandled .NET exception produces a large negative number on Windows and a signal-style code on Linux. Test for "not zero", as the program does, and define your own small exit codes for failures you expect.
:::

## What a context switch costs

There are usually more runnable threads than cores, so the scheduler time-slices. A *context switch* is the act of taking one thread off a core and putting another on. Windows documents the steps: save the context of the outgoing thread, put it at the back of the queue for its priority if it is still runnable, find the highest-priority queue that has a ready thread, restore that thread's context and resume it.

A switch happens when a thread's time slice (its *quantum*) runs out and an equal-priority thread is ready, when a higher-priority thread becomes ready, or when the running thread has to wait for something, in which case it gives up the rest of its slice ([Context Switches](https://learn.microsoft.com/en-us/windows/win32/procthread/context-switches)). On Windows the thread, not the process, is the entity that gets scheduled, and on Linux each thread is likewise its own kernel scheduling entity ([pthreads(7)](https://man7.org/linux/man-pages/man7/pthreads.7.html)). A process with 50 ready threads competes as 50 entries.

Switching between two threads of the same process leaves the address space alone. Switching to a thread of another process must also switch to that process's page tables, and *Operating Systems: Three Easy Pieces* names this as the one major difference between the two kinds of switch ([OSTEP chapter 26](https://pages.cs.wisc.edu/~remzi/OSTEP/threads-intro.pdf)).

Saving and restoring registers is the *direct* cost. The same book points out that a running program also builds up state in CPU caches, translation lookaside buffers and branch predictors, and that the incoming thread finds that state cold ([OSTEP chapter 7](https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched.pdf)). Li, Ding and Shen measured both parts on a 2007 Linux machine: 3.8 microseconds of direct cost per switch, and a total, once cache refill was included, that ranged from several microseconds to more than a thousand depending on how much data the program touched ([Quantifying The Cost of Context Switch](https://www.usenix.org/legacy/events/expcs07/papers/2-li.pdf)).

Their method, which they credit to earlier benchmarks by Ousterhout and McVoy, was two processes passing a token through pipes so that each pass forces a switch. The program below does the same with two threads and a pair of events. A *round* is one hand-off to the partner and one back. It runs the round three ways: with no second thread at all, with two threads the OS may place on any core, and with the process restricted to a single core so that the two threads cannot run at the same time and every hand-off has to be a switch.

```csharp run id=relay
using System.Diagnostics;
using System.Runtime.CompilerServices;

const int Rounds = 100_000;

// Baseline: one thread takes both turns.
int turns = 0;
var clock = Stopwatch.StartNew();
for (int i = 0; i < Rounds; i++)
{
    TakeTurn(ref turns);
    TakeTurn(ref turns);
}
Report("one thread, no switch", clock);

clock = Relay();
Report("two threads, any core", clock);

if (OperatingSystem.IsWindows()
    || OperatingSystem.IsLinux())
{
    // Let this process run on CPU 0 only.
    using var me = Process.GetCurrentProcess();
    me.ProcessorAffinity = 1;
    clock = Relay();
    Report("two threads, one core", clock);
}

static Stopwatch Relay()
{
    using AutoResetEvent ping = new(false);
    using AutoResetEvent pong = new(false);
    var partner = new Thread(() =>
    {
        for (int i = 0; i < Rounds; i++)
        {
            ping.WaitOne();  // block
            pong.Set();      // wake main
        }
    });
    partner.Start();

    var clock = Stopwatch.StartNew();
    for (int i = 0; i < Rounds; i++)
    {
        ping.Set();
        pong.WaitOne();
    }
    clock.Stop();
    partner.Join();
    return clock;
}

static void Report(string label, Stopwatch sw)
{
    double ns =
        sw.Elapsed.TotalNanoseconds / Rounds;
    Console.WriteLine($"{label}: {ns,7:N0} ns");
}

[MethodImpl(MethodImplOptions.NoInlining)]
static void TakeTurn(ref int counter) =>
    counter++;
```

```text output
one thread, no switch: [...] ns
two threads, any core: [...] ns
two threads, one core: [...] ns
```

Six runs on the test machine (Core i7-11700K, 8 cores and 16 logical processors, with other work sharing the machine while these numbers were taken) gave 13 to 20 ns for the single thread, roughly 7,600 to 22,000 ns for two threads on any core, and roughly 3,000 to 8,500 ns for two threads on one core.

The single-core figure is the cleanest, because pinning both threads to one core removes the cost of waking a second, possibly idle, core. A round there contains two switches and four calls into the kernel (two `Set`, two `WaitOne`), so one switch between threads of the same process, with almost no data to evict from the caches, cost roughly 1.5 to 4 microseconds on these runs. Even the low end is one to two orders of magnitude above the cost of doing the same work as two method calls. A quieter machine should sit nearer the low end; a busier one pushes it higher, because a "switch" here also has to wait its turn for the one core.

The any-core figure did not show the earlier, cleaner gap that a quiet machine produces: run over run, letting the OS place each thread on any of the 16 processors was between about 1.2 and 4.7 times slower than pinning both to one core, not a single fixed multiple. The likely mechanism, which this program cannot confirm, is the same one that applies on a quiet machine: the woken thread tends to land on a different, possibly idle, core, which pays for waking that core as well as the thread. What changes under load is that the one-core baseline is no longer clean either, since it is now competing with everything else for that one core, so the gap between the two configurations narrows and jitters.

Whatever the split, two conclusions are safe. Blocking hand-offs between threads cost microseconds, not nanoseconds, so a design that passes every small item to another thread and waits for the answer is slower than doing the work in place. And the cost of a switch is not one number: it depends on what has to be woken, on how much cached state the thread finds gone when it returns, and on what else the machine is doing at the time, which is how the 2007 paper saw a range of more than a hundred to one from data size alone, before any contention from other programs is added.

This program does not measure a switch between two processes: an `AutoResetEvent` created this way exists inside one process only.

## Creating each one from .NET, and what it costs

The three ways of running a piece of code somewhere else, in ascending order of weight:

- `Task.Run(work)` queues the work to the thread pool, a set of worker threads the runtime keeps alive and reuses ([The managed thread pool](https://learn.microsoft.com/en-us/dotnet/standard/threading/the-managed-thread-pool)).
- `new Thread(work).Start()` creates a dedicated OS thread, which you saw above costs a stack reservation and a kernel object.
- `Process.Start(...)` asks the OS for a new address space, loads an executable into it and starts its first thread. It returns a `Process` object associated with the new process, or `null` if no process resource was started ([Process.Start](https://learn.microsoft.com/en-us/dotnet/api/system.diagnostics.process.start)). The listings here start their own executable, so they assert the result with `!`; production code should check it.

The next program runs the same trivial job each way, one at a time, waiting for each to finish before starting the next.

```csharp run id=cost
using System.Diagnostics;

if (args is ["noop"]) return;   // the child

const int Jobs = 500, Children = 10;
int done = 0;
void Work() =>
    Interlocked.Increment(ref done);

// 1. Hand each job to the thread pool.
var clock = Stopwatch.StartNew();
for (int i = 0; i < Jobs; i++)
{
    Task.Run(Work).Wait();
}
double poolUs =
    clock.Elapsed.TotalMicroseconds / Jobs;

// 2. A dedicated thread per job.
clock.Restart();
for (int i = 0; i < Jobs; i++)
{
    var t = new Thread(Work);
    t.Start();
    t.Join();
}
double threadUs =
    clock.Elapsed.TotalMicroseconds / Jobs;

// 3. A child process per job.
clock.Restart();
for (int i = 0; i < Children; i++)
{
    using var child = Process.Start(
        Environment.ProcessPath!, "noop");
    child.WaitForExit();
}
double processUs =
    clock.Elapsed.TotalMicroseconds / Children;

Report("jobs run in-process", done, "");
Report("pool job", poolUs, "us");
Report("new thread", threadUs, "us");
Report("new process", processUs, "us");

void Report(string what, double n, string unit) =>
    Console.WriteLine($"{what,-20}{n,7:N0} {unit}");
```

```text output
jobs run in-process   1,000
pool job            [...] us
new thread          [...] us
new process         [...] us
```

Three runs on the test machine gave 9 to 23 microseconds per pool job, 97 to 149 per dedicated thread, and about 29,900 to 32,600 (roughly 30 to 33 ms) per child process. Each step up is roughly one to two orders of magnitude.

The process figure needs a caveat: the child is another .NET program, so the 30-plus ms includes starting the runtime in the new process, not only the operating system's work to create it. For a .NET developer that is the honest price, because it is the one you pay. It also explains a design you see everywhere in server software: processes are started rarely and kept, threads are pooled, and the unit of work that is created and destroyed thousands of times a second is something lighter than either.

::::exercise[The audit line that never appears]
This program is supposed to write an audit line in the background. The line is missing every time. Find out why, and fix it.

```csharp run id=lostwork
// Fire and forget.
_ = Task.Run(() =>
{
    Thread.Sleep(300);   // slow disk
    Console.WriteLine("audit: saved");
});
Console.WriteLine("main: returning");
```

```text output
main: returning
```

:::solution[Show the cause and the fix]
Returning from the main method does not by itself end a .NET process, and it does not wait for all threads either. Every managed thread is a *foreground* or a *background* thread. The runtime keeps the process alive until all foreground threads have stopped, then stops the background threads, without raising an exception in them, and shuts down. Threads created with `new Thread` are foreground threads by default; thread pool threads are background threads ([Foreground and background threads](https://learn.microsoft.com/en-us/dotnet/standard/threading/foreground-and-background-threads)). `Task.Run` put the audit job on a pool thread, the only foreground thread returned 300 ms before the job finished, and the job was discarded in mid-sleep.

The discard `_ =` is part of the bug. Without it the compiler reports warning CS4014, "because this call is not awaited, execution of the current method continues before the call is completed", which is an exact description of what went wrong; the discard tells the compiler that you meant it. The fix is to wait for work you care about:

```csharp run id=keptwork
Task audit = Task.Run(() =>
{
    Thread.Sleep(300);   // slow disk
    Console.WriteLine("audit: saved");
});
Console.WriteLine("main: returning soon");
await audit;
```

```text output
main: returning soon
audit: saved
```

Running the job on a `new Thread` would also make the line appear, because a foreground thread keeps the process alive. The rule cuts the other way as well: a foreground thread stuck in a loop keeps a program from exiting after its main method has returned, which is why long-lived monitoring threads are usually marked `IsBackground = true`.
:::
::::

## The thread pool, and how to starve it

The pool exists because of the 90-microsecond line in the last output and the memory figures before it: creating a thread per small job wastes time, and thousands of threads waste memory and scheduler effort. The pool keeps a modest number of workers, starting from the number of processors, and feeds them from a queue. `Task.Run`, the Task Parallel Library, timer callbacks and the continuations of `await` all run there, and there is one pool per process ([The managed thread pool](https://learn.microsoft.com/en-us/dotnet/standard/threading/the-managed-thread-pool)).

A small, fixed set of workers is the right shape for CPU-bound work, where more threads than cores only adds context switches. It is the wrong shape for jobs that spend their time waiting, and the pool's defence against those is deliberately slow. It creates workers on demand up to a minimum, which defaults to the processor count; past that it may add a thread or wait for jobs to finish, guided by measured throughput ([ThreadPool.SetMinThreads](https://learn.microsoft.com/en-us/dotnet/api/system.threading.threadpool.setminthreads)). Microsoft's diagnostics guide puts a number on it: under starvation the count climbs by one or two threads per second ([Debug ThreadPool starvation](https://learn.microsoft.com/en-us/dotnet/core/diagnostics/debug-threadpool-starvation)).

The demonstration queues three times as many one-second jobs as the machine has logical processors, then queues one more job that does nothing and measures how long it sat in the queue. It does this twice. In the first pass a job waits by blocking its thread, with `Thread.Sleep` standing in for a synchronous database call, a synchronous file read or a contended lock. In the second pass the job awaits.

```csharp run id=starve
using System.Diagnostics;

int cores = Environment.ProcessorCount;
int jobCount = cores * 3;
Console.WriteLine(
    $"{cores} CPUs, {jobCount} jobs of 1 s");

await Run("blocking", () =>
{
    // Waits while keeping its pool thread.
    Thread.Sleep(1000);
    return Task.CompletedTask;
});
await Run("awaiting", async () =>
{
    // Waits after giving the thread back.
    await Task.Delay(1000);
});

async Task Run(string label, Func<Task> job)
{
    int atOnce = 0;
    var clock = Stopwatch.StartNew();
    var jobs = new List<Task>();
    for (int i = 0; i < jobCount; i++)
    {
        jobs.Add(Task.Run(async () =>
        {
            long ms =
                clock.ElapsedMilliseconds;
            if (ms < 250)
                Interlocked.Increment(
                    ref atOnce);
            await job();
        }));
    }
    // An unrelated, instant job queued behind them.
    long queuedAt = clock.ElapsedMilliseconds;
    long waited = await Task.Run(
        () => clock.ElapsedMilliseconds - queuedAt);

    await Task.WhenAll(jobs);
    double total = clock.Elapsed.TotalSeconds;
    Console.WriteLine($"""
        {label}:
          started at once: {atOnce}
          instant job waited: {waited} ms
          all done: {total:F1} s
        """);
}
```

```text output
[...] CPUs, [...] jobs of 1 s
blocking:
  started at once: [...]
  instant job waited: [...] ms
  all done: [...] s
awaiting:
  started at once: [...]
  instant job waited: [...] ms
  all done: [...] s
```

With 16 logical processors the program queued 48 jobs. Blocking, across four runs: 16 jobs started at once in three of them and only 1 in the fourth (that run had more competition from other work on the machine), the instant job waited 2.0 to 3.1 s, and everything finished after 3.0 to 4.2 s. Awaiting, all four runs: all 48 started at once, the instant job waited 0 ms, and everything finished after 1.0 to 1.1 s. Even the worst blocking run is far slower than the best awaiting one, which is the point: an overloaded pool degrades by a lot more than a slow machine degrades on its own.

No CPU was busy during those three seconds. Sixteen workers each picked up a job and went to sleep holding it; the other 32 jobs, and the instant job behind them, sat in the queue with nobody to run them. In a server the instant job is somebody else's request, a timer callback or the continuation of an `await` that finished long ago, which is why starvation shows up as the whole application becoming slow while CPU usage stays low. That combination, together with a slowly rising thread count, is the signature the diagnostics guide tells you to look for.

<figure class="diagram">
<svg viewBox="0 0 360 396" role="img" aria-labelledby="pt-pool-title pt-pool-desc">
<title id="pt-pool-title">A thread pool with blocked workers compared with one whose jobs await</title>
<desc id="pt-pool-desc">Top: a queue full of jobs above four workers that are all asleep inside a job, so nothing is taken from the queue. Bottom: the queue is empty and the four workers are idle, because the pending waits are held by a timer and not by threads.</desc>
<defs>
<marker id="pt-pool-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-bad"/></marker>
</defs>
<text x="10" y="20" class="d-bold">Jobs that block: Sleep, .Result, lock</text>
<text x="10" y="50" class="d-small d-muted">queue</text>
<rect x="60" y="32" width="44" height="28" rx="4" class="d-box-2"/><text x="82" y="51" text-anchor="middle" class="d-mono d-small">job</text>
<rect x="108" y="32" width="44" height="28" rx="4" class="d-box-2"/><text x="130" y="51" text-anchor="middle" class="d-mono d-small">job</text>
<rect x="156" y="32" width="44" height="28" rx="4" class="d-box-2"/><text x="178" y="51" text-anchor="middle" class="d-mono d-small">job</text>
<rect x="204" y="32" width="44" height="28" rx="4" class="d-box-2"/><text x="226" y="51" text-anchor="middle" class="d-mono d-small">job</text>
<rect x="252" y="32" width="44" height="28" rx="4" class="d-box-2"/><text x="274" y="51" text-anchor="middle" class="d-mono d-small">job</text>
<rect x="300" y="32" width="44" height="28" rx="4" class="d-box-accent"/><text x="322" y="51" text-anchor="middle" class="d-mono d-small">0 ms</text>
<path d="M82 64 V94" class="d-bad d-dashed" marker-end="url(#pt-pool-arrow)"/>
<text x="94" y="84" class="d-small d-text-bad">no worker is free to take the next job</text>
<rect x="10" y="98" width="80" height="46" rx="5" class="d-box-bad"/><text x="50" y="117" text-anchor="middle" class="d-small">worker 1</text><text x="50" y="135" text-anchor="middle" class="d-mono d-small">asleep</text>
<rect x="96" y="98" width="80" height="46" rx="5" class="d-box-bad"/><text x="136" y="117" text-anchor="middle" class="d-small">worker 2</text><text x="136" y="135" text-anchor="middle" class="d-mono d-small">asleep</text>
<rect x="182" y="98" width="80" height="46" rx="5" class="d-box-bad"/><text x="222" y="117" text-anchor="middle" class="d-small">worker 3</text><text x="222" y="135" text-anchor="middle" class="d-mono d-small">asleep</text>
<rect x="268" y="98" width="80" height="46" rx="5" class="d-box-bad"/><text x="308" y="117" text-anchor="middle" class="d-small">worker 4</text><text x="308" y="135" text-anchor="middle" class="d-mono d-small">asleep</text>
<text x="10" y="164" class="d-small d-muted">Every worker holds a job that is only waiting.</text>
<text x="10" y="181" class="d-small d-muted">The instant job (accent) waits behind all of them.</text>
<text x="10" y="222" class="d-bold">Jobs that await: Task.Delay, async I/O</text>
<text x="10" y="252" class="d-small d-muted">queue</text>
<rect x="60" y="234" width="284" height="28" rx="4" class="d-box-2 d-dashed"/><text x="202" y="253" text-anchor="middle" class="d-small d-muted">empty</text>
<rect x="10" y="274" width="80" height="46" rx="5" class="d-box-good"/><text x="50" y="293" text-anchor="middle" class="d-small">worker 1</text><text x="50" y="311" text-anchor="middle" class="d-mono d-small">idle</text>
<rect x="96" y="274" width="80" height="46" rx="5" class="d-box-good"/><text x="136" y="293" text-anchor="middle" class="d-small">worker 2</text><text x="136" y="311" text-anchor="middle" class="d-mono d-small">idle</text>
<rect x="182" y="274" width="80" height="46" rx="5" class="d-box-good"/><text x="222" y="293" text-anchor="middle" class="d-small">worker 3</text><text x="222" y="311" text-anchor="middle" class="d-mono d-small">idle</text>
<rect x="268" y="274" width="80" height="46" rx="5" class="d-box-good"/><text x="308" y="293" text-anchor="middle" class="d-small">worker 4</text><text x="308" y="311" text-anchor="middle" class="d-mono d-small">idle</text>
<rect x="10" y="332" width="338" height="30" rx="5" class="d-box"/>
<text x="179" y="352" text-anchor="middle" class="d-small">pending waits: timer entries, not threads</text>
<text x="10" y="384" class="d-small d-muted">Each job ran up to its await, then let go of the worker.</text>
</svg>
<figcaption>Figure 2. The same jobs on a four-worker pool. A blocked worker is occupied without doing anything, so the queue stops moving; an awaiting job occupies a worker only while it has instructions to execute.</figcaption>
</figure>

The second pass is the fix, not a trick. `await Task.Delay` registers a timer and returns the worker to the pool; when the timer fires, a worker runs the rest of the method. The same holds for genuinely asynchronous I/O. A waiting job then costs a small heap object and no thread at all, which is how 48 one-second waits fit into one second on 16 workers and would fit just as well on two. How the compiler turns an `async` method into something that can let go of its thread and pick up later belongs to a separate article on `async`/`await`.

:::warning[Raising the minimum is a bandage]
`ThreadPool.SetMinThreads` makes the pool create more workers without the delay, and the documentation describes it as a way to work around blocking temporarily. The same page lists what it costs: more context switching, more memory, more stacks for the garbage collector to walk, and oversubscribed cores when the jobs are not blocked after all. Remove the blocking call if you can reach it.
:::

::::exercise[Measure the most common blocking call]
The usual way to block a pool thread is not `Thread.Sleep` but waiting synchronously on a task: `.Result`, `.Wait()` or `.GetAwaiter().GetResult()`. Replace the body of the blocking job with `Task.Delay(1000).Wait()`, print `ThreadPool.ThreadCount` at the end, and run it. Is the outcome as bad as with `Thread.Sleep`? What did the runtime do, and what did it cost?

:::solution
```csharp run id=syncoverasync
using System.Diagnostics;

int cores = Environment.ProcessorCount;
int jobCount = cores * 3;
int atOnce = 0;
var clock = Stopwatch.StartNew();

var jobs = new List<Task>();
for (int i = 0; i < jobCount; i++)
{
    jobs.Add(Task.Run(() =>
    {
        long ms = clock.ElapsedMilliseconds;
        if (ms < 250)
            Interlocked.Increment(
                ref atOnce);
        Task.Delay(1000).Wait();  // sync over async
    }));
}
await Task.WhenAll(jobs);

double total = clock.Elapsed.TotalSeconds;
int threads = ThreadPool.ThreadCount;
Console.WriteLine($"jobs:            {jobCount}");
Console.WriteLine($"started at once: {atOnce}");
Console.WriteLine($"all done:        {total:F1} s");
Console.WriteLine($"pool threads:    {threads}");
```

```text output
jobs:            [...]
started at once: [...]
all done:        [...] s
pool threads:    [...]
```

On the 16-processor test machine: 48 jobs, 39 started within 250 ms, all done after 1.5 s, and the pool had grown to 52 threads. That is much better than the 3.0 to 4.2 s of the `Thread.Sleep` pass, and the reason is documented: since .NET 6 the pool's heuristics add threads much faster when the blocking happens inside certain `Task` APIs that the runtime can see, where a plain `Thread.Sleep`, a synchronous read or a lock gives it no such signal ([Debug ThreadPool starvation](https://learn.microsoft.com/en-us/dotnet/core/diagnostics/debug-threadpool-starvation)). The cost is in the last line. The runtime papered over the blocking with 52 threads, each with its own stack, to do work that the awaiting version did with no waiting threads. The same guide warns that a pool which settles at far more threads than about three times the core count is compensating for blocked threads, and that it starves again after every restart or burst of load while it climbs back up.
:::
::::

## Choosing between a process, a thread, a pool job and no thread

The measurements line up into a decision you can make from the requirements. "Pool job" means `Task.Run` or `Parallel.For`, "no thread" means `async`/`await`, and "own thread" means `new Thread`.

| Reach for | When you need |
|---|---|
| Process | Isolation from a crashing part |
| Process | Fewer OS rights for one part |
| Process | Code you cannot load yourself |
| Pool job | Many short CPU-bound jobs |
| No thread | To wait for I/O, timers, services |
| Own thread | One long-lived loop that blocks |
| Own thread | A fixed priority, or foreground |

**A process** buys isolation and nothing else. You saw the price: tens of milliseconds to start, a whole runtime's worth of memory, and every exchange serialized into bytes through a pipe, a socket or a file. Pay it when a failure, a memory leak or a security hole in one part must not reach the other, which is the Chromium case, or when the other part is not yours to load into your address space. Resource limits attach at this level too: a Windows job object manages a group of processes as a unit ([About Processes and Threads](https://learn.microsoft.com/en-us/windows/win32/procthread/about-processes-and-threads)), so "stop it if it exceeds its budget" is something you can ask of a process and not of a thread.

**A pool job** is the default for work inside your own program. It was the cheapest of the three in the cost measurement by an order of magnitude, and the pool sizes itself to the cores. It assumes that jobs are short and do not block.

**A dedicated thread** is for the cases where that assumption fails, and the documentation's list of reasons to avoid the pool is a good checklist: the job blocks for long periods, needs a particular priority, must be a foreground thread, or needs a stable identity ([The managed thread pool](https://learn.microsoft.com/en-us/dotnet/standard/threading/the-managed-thread-pool)). A consumer loop that sits in a blocking `Take()` on a queue for the life of the program is the typical example. `TaskCreationOptions.LongRunning` expresses the same intent through the task API: it hints to the scheduler that the task may need an additional thread so that it does not hold up other work items ([TaskCreationOptions](https://learn.microsoft.com/en-us/dotnet/api/system.threading.tasks.taskcreationoptions)).

**No thread** is the answer whenever the job is waiting and not computing. Threads are a way to use CPU cores. A thousand pending network calls need a thousand small objects, and the starvation demo showed what happens when they are given a thousand threads' worth of demand instead.

Whatever you choose inside a process, the shared heap from Figure 1 comes with it. Two threads that can reach the same object can also interleave their reads and writes to it, and the program is then correct only if you arrange for it to be. A second process removes that problem by removing the sharing.

::::exercise[Four designs to judge]
For each situation, decide between a separate process, a dedicated thread, pool jobs and `async` with no thread, and name the measurement or property from this article that decides it.

1. A photo app resizes 2,000 images already loaded in memory.
2. A web API handler calls three other HTTP services and combines their answers.
3. A desktop editor runs user-installed plugins that are sometimes buggy.
4. A service reads commands from a serial port with a blocking `ReadLine()` call, for as long as it runs.

:::solution
1. **Pool jobs** (`Parallel.ForEach` or `Task.Run` per batch). The work is CPU-bound and short per item, there is nothing to wait for, and a worker per core is what the pool provides. Creating 2,000 threads would reserve 2,000 stacks and make the scheduler rotate through them for no gain; at about 90 microseconds each on the test machine, creating them would by itself take close to 0.2 s.
2. **`async` with no thread.** The handler spends nearly all of its time waiting for the network. Blocking a pool thread per outbound call is the starvation pass of the demo: low CPU, a queue that stops moving, unrelated requests delayed by seconds. Start the three calls, then `await Task.WhenAll`.
3. **A separate process per plugin, or one host process for all plugins.** An unhandled exception on any thread ends the process, as the crash demo showed, and a thread cannot be given fewer rights than its siblings. Only a process boundary keeps a plugin's crash or stray write away from the user's unsaved document. The price is the start-up time and a byte-stream protocol between editor and plugin host.
4. **A dedicated thread**, marked as a background thread if the service should be able to exit while the read is pending. The call blocks for long periods, which is first on the documentation's list of reasons not to use a pool thread, and it lasts for the life of the program, so the creation cost is paid once. If the serial API offers a true asynchronous read, awaiting it is equally good and saves the stack.
:::
::::
