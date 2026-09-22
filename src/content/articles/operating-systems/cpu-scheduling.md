---
title: "CPU Scheduling: How the OS Shares Processors"
description: "Build FCFS, SJF, round robin, priority and MLFQ in C#, run them on one workload with real Gantt output, then check what Windows and Linux actually schedule."
pillar: operating-systems
order: 4
author: markus
published: 2026-09-22
updated: 2026-09-22
level: intermediate
tags: [cpu-scheduling, round-robin, mlfq, throughput, context-switch]
prerequisites: ["operating-systems/processes-and-threads"]
sources:
  - title: "Scheduling: Introduction (OSTEP, chapter 7)"
    url: "https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched.pdf"
    publisher: "Arpaci-Dusseau Books"
    accessed: 2026-09-22
  - title: "Scheduling: The Multi-Level Feedback Queue (OSTEP, chapter 8)"
    url: "https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched-mlfq.pdf"
    publisher: "Arpaci-Dusseau Books"
    accessed: 2026-09-22
  - title: "Operating System Concepts, 10th ed., chapter 5: CPU Scheduling"
    url: "https://www.os-book.com/OS10/"
    publisher: "John Wiley & Sons"
    accessed: 2026-09-22
  - title: "Scheduling (Win32 apps)"
    url: "https://learn.microsoft.com/en-us/windows/win32/procthread/scheduling"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Scheduling Priorities"
    url: "https://learn.microsoft.com/en-us/windows/win32/procthread/scheduling-priorities"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Priority Boosts"
    url: "https://learn.microsoft.com/en-us/windows/win32/procthread/priority-boosts"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "EEVDF Scheduler"
    url: "https://docs.kernel.org/scheduler/sched-eevdf.html"
    publisher: "The Linux Kernel documentation"
    accessed: 2026-09-22
  - title: "Completely Fair Scheduler (CFS)"
    url: "https://docs.kernel.org/scheduler/sched-design-CFS.html"
    publisher: "The Linux Kernel documentation"
    accessed: 2026-09-22
  - title: "sched(7): overview of CPU scheduling"
    url: "https://man7.org/linux/man-pages/man7/sched.7.html"
    publisher: "Linux man-pages"
    accessed: 2026-09-22
draft: false
---

When more than one runnable thread is waiting and a core is free, something has to pick which one runs next, for how long, and what happens to the ones that lose. That something is the CPU scheduler, and the [processes vs threads](/operating-systems/processes-and-threads/) article already showed that [the scheduler time-slices](/operating-systems/processes-and-threads/#what-a-context-switch-costs) and that each hand-off costs a real, measured amount of time. This article is about the policy layer above that: the rule the scheduler uses to choose, five real implementations of that rule in C#, and what two real operating systems actually run today.

## What the scheduler is optimizing for

A scheduling policy is judged against a small set of goals, and the goals conflict, which is why there is more than one policy. Operating Systems: Three Easy Pieces defines the first two precisely. **Turnaround time** is `T_turnaround = T_completion - T_arrival`: the total time a job spends in the system, from arrival to finishing. **Response time** is `T_response = T_firstrun - T_arrival`: the time until a job is *first* given the CPU, which is what an interactive user actually feels while waiting for the first sign of life ([OSTEP ch. 7](https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched.pdf)).

Two more goals follow from those. **Waiting time** is the turnaround time minus the burst time (`T_waiting = T_turnaround - T_burst`): the part of turnaround spent doing nothing but sitting in the ready queue rather than running. **Throughput** is how many jobs complete per unit of time; a scheduler that keeps the CPU busy on useful work maximizes it, and a scheduler that leaves the CPU idle while jobs wait for something else does not. **Fairness** is a claim about how evenly the CPU is divided among competing jobs, and OSTEP is explicit that it usually trades off against the performance goals above: a scheduler that always prefers the shortest job improves average turnaround at the direct expense of making some jobs wait far longer than others ([OSTEP ch. 7](https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched.pdf)). No single algorithm below wins on all five; the point of running them on identical input is to see exactly which goal each one buys, and at whose expense. This turnaround/waiting/response/throughput/fairness framework is not specific to OSTEP: Operating System Concepts covers the same scheduling criteria in its own chapter on CPU scheduling ([Operating System Concepts, 10th ed., ch. 5](https://www.os-book.com/OS10/)).

## One workload, five algorithms

Every algorithm below runs the same five processes, defined once as a `Proc` record: an arrival time, a CPU burst (how long the process needs the CPU, assuming for this simulation that it never blocks on I/O), and a priority where 1 is the most urgent.

```csharp run id=workload
List<Proc> Workload() =>
[
    new("P1", Arrival: 0, Burst: 5, Priority: 3),
    new("P2", Arrival: 1, Burst: 3, Priority: 1),
    new("P3", Arrival: 2, Burst: 8, Priority: 4),
    new("P4", Arrival: 3, Burst: 4, Priority: 2),
    new("P5", Arrival: 4, Burst: 2, Priority: 5),
];

var procs = Workload();
Console.WriteLine("id   arr  bur  pri");
foreach (var p in procs)
    Console.WriteLine($"{p.Id,-4}{p.Arrival,4}{p.Burst,5}{p.Priority,5}");

record Proc(string Id, int Arrival, int Burst, int Priority);
```

```text output
id   arr  bur  pri
P1     0    5    3
P2     1    3    1
P3     2    8    4
P4     3    4    2
P5     4    2    5
```

Priority 1 is the most urgent here, the convention traditional textbooks and Linux `nice` values use (`nice` runs -20, most urgent, to +19, least, [sched(7)](https://man7.org/linux/man-pages/man7/sched.7.html)). Windows numbers its levels the other way, as the Windows section below shows, so "1 is best" is this article's choice, not a universal rule.

Every program that follows redefines `Workload()` identically and is a complete, independently runnable file, because the site has no multi-file mode; that duplication is the price of every block being something you could paste and run on its own.

## First-come, first-served: simple, and a convoy waiting to happen

FCFS runs jobs in arrival order, to completion, no preemption. Nothing decides *which* job to run next except who got there first.

```csharp run id=fcfs
List<Proc> Workload() =>
[
    new("P1", Arrival: 0, Burst: 5, Priority: 3),
    new("P2", Arrival: 1, Burst: 3, Priority: 1),
    new("P3", Arrival: 2, Burst: 8, Priority: 4),
    new("P4", Arrival: 3, Burst: 4, Priority: 2),
    new("P5", Arrival: 4, Burst: 2, Priority: 5),
];

var procs = Workload();

// FCFS: run in arrival order, to completion, no preemption.
var order = procs.OrderBy(p => p.Arrival).ThenBy(p => p.Id).ToList();
var slices = new List<(string Id, int Start, int End)>();
var completion = new Dictionary<string, int>();
var firstStart = new Dictionary<string, int>();
int clock = 0;
foreach (var p in order)
{
    int start = Math.Max(clock, p.Arrival);
    int end = start + p.Burst;
    slices.Add((p.Id, start, end));
    firstStart[p.Id] = start;
    completion[p.Id] = end;
    clock = end;
}

PrintGantt(slices);
PrintMetrics("FCFS", procs, completion, firstStart);

static void PrintGantt(List<(string Id, int Start, int End)> slices)
{
    var top = new System.Text.StringBuilder("|");
    var pipeAt = new List<int> { 0 };
    foreach (var s in slices)
    {
        int width = s.Id.Length + 2;
        int pad = (width - s.Id.Length) / 2;
        top.Append(new string(' ', pad)).Append(s.Id)
           .Append(new string(' ', width - s.Id.Length - pad)).Append('|');
        pipeAt.Add(top.Length - 1);
    }
    var bottom = new System.Text.StringBuilder(new string(' ', top.Length + 4));
    for (int i = 0; i < pipeAt.Count; i++)
    {
        string t = (i == 0 ? slices[0].Start : slices[i - 1].End).ToString();
        for (int c = 0; c < t.Length && pipeAt[i] + c < bottom.Length; c++)
            bottom[pipeAt[i] + c] = t[c];
    }
    Console.WriteLine(top.ToString());
    Console.WriteLine(bottom.ToString().TrimEnd());
}

static void PrintMetrics(
    string label, List<Proc> procs,
    Dictionary<string, int> completion, Dictionary<string, int> firstStart)
{
    Console.WriteLine();
    Console.WriteLine($"{label,-4} {"arr",3} {"bur",3} {"comp",4} {"turn",4} {"wait",4} {"resp",4}");
    double turnSum = 0, waitSum = 0, respSum = 0;
    foreach (var p in procs.OrderBy(p => p.Id))
    {
        int turn = completion[p.Id] - p.Arrival;
        int wait = turn - p.Burst;
        int resp = firstStart[p.Id] - p.Arrival;
        turnSum += turn; waitSum += wait; respSum += resp;
        Console.WriteLine($"{p.Id,-4} {p.Arrival,3} {p.Burst,3} {completion[p.Id],4} {turn,4} {wait,4} {resp,4}");
    }
    int n = procs.Count;
    Console.WriteLine($"turn {turnSum / n:F1}  wait {waitSum / n:F1}  resp {respSum / n:F1}");
}

record Proc(string Id, int Arrival, int Burst, int Priority);
```

```text output
| P1 | P2 | P3 | P4 | P5 |
0    5    8    16   20   22

FCFS arr bur comp turn wait resp
P1     0   5    5    5    0    0
P2     1   3    8    7    4    4
P3     2   8   16   14    6    6
P4     3   4   20   17   13   13
P5     4   2   22   18   16   16
turn 12.2  wait 7.8  resp 7.8
```

These numbers come from actually running the program above (.NET 10.0.401 on Windows 11, x64); nothing here is hand arithmetic, and the same is true of every measurement below.

The Gantt chart line is the schedule; the table underneath is `T_completion`, `T_turnaround`, `T_waiting` and `T_response` for each process, computed from the formulas above. Look at P5: it needs only 2 units of CPU time but arrives right behind P3, which needs 8. P5 waits 16 units, eight times its own burst, purely because a long job happened to get there first. OSTEP names this the **convoy effect**: a short job stuck behind a long one, dragging down the average for everyone behind the head of the queue ([OSTEP ch. 7](https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched.pdf)). FCFS's response time equals its waiting time for every process here, because a non-preemptive algorithm that runs a job to completion gives it exactly one slice, so the first time it runs is the only time it runs.

## Shortest job first: the provably-best average, if you already know the future

SJF fixes the convoy effect by asking a different question at each decision point: not who arrived first, but who needs the CPU for the shortest time. This version is non-preemptive: once a job starts, it runs to completion, even if a shorter job arrives a moment later.

```csharp run id=sjf
List<Proc> Workload() =>
[
    new("P1", Arrival: 0, Burst: 5, Priority: 3),
    new("P2", Arrival: 1, Burst: 3, Priority: 1),
    new("P3", Arrival: 2, Burst: 8, Priority: 4),
    new("P4", Arrival: 3, Burst: 4, Priority: 2),
    new("P5", Arrival: 4, Burst: 2, Priority: 5),
];

var procs = Workload();

// Non-preemptive SJF: when the CPU is free, run whichever arrived
// process has the smallest burst; ties go to the earlier arrival.
var remaining = procs.ToDictionary(p => p.Id, p => p);
var completion = new Dictionary<string, int>();
var firstStart = new Dictionary<string, int>();
var slices = new List<(string Id, int Start, int End)>();
int clock = 0;
while (remaining.Count > 0)
{
    var ready = remaining.Values.Where(p => p.Arrival <= clock).ToList();
    if (ready.Count == 0)
    {
        clock = remaining.Values.Min(p => p.Arrival);
        continue;
    }
    var next = ready.OrderBy(p => p.Burst).ThenBy(p => p.Arrival).First();
    int start = clock;
    int end = start + next.Burst;
    slices.Add((next.Id, start, end));
    firstStart[next.Id] = start;
    completion[next.Id] = end;
    clock = end;
    remaining.Remove(next.Id);
}

PrintGantt(slices);
PrintMetrics("SJF", procs, completion, firstStart);

static void PrintGantt(List<(string Id, int Start, int End)> slices)
{
    var top = new System.Text.StringBuilder("|");
    var pipeAt = new List<int> { 0 };
    foreach (var s in slices)
    {
        int width = s.Id.Length + 2;
        int pad = (width - s.Id.Length) / 2;
        top.Append(new string(' ', pad)).Append(s.Id)
           .Append(new string(' ', width - s.Id.Length - pad)).Append('|');
        pipeAt.Add(top.Length - 1);
    }
    var bottom = new System.Text.StringBuilder(new string(' ', top.Length + 4));
    for (int i = 0; i < pipeAt.Count; i++)
    {
        string t = (i == 0 ? slices[0].Start : slices[i - 1].End).ToString();
        for (int c = 0; c < t.Length && pipeAt[i] + c < bottom.Length; c++)
            bottom[pipeAt[i] + c] = t[c];
    }
    Console.WriteLine(top.ToString());
    Console.WriteLine(bottom.ToString().TrimEnd());
}

static void PrintMetrics(
    string label, List<Proc> procs,
    Dictionary<string, int> completion, Dictionary<string, int> firstStart)
{
    Console.WriteLine();
    Console.WriteLine($"{label,-4} {"arr",3} {"bur",3} {"comp",4} {"turn",4} {"wait",4} {"resp",4}");
    double turnSum = 0, waitSum = 0, respSum = 0;
    foreach (var p in procs.OrderBy(p => p.Id))
    {
        int turn = completion[p.Id] - p.Arrival;
        int wait = turn - p.Burst;
        int resp = firstStart[p.Id] - p.Arrival;
        turnSum += turn; waitSum += wait; respSum += resp;
        Console.WriteLine($"{p.Id,-4} {p.Arrival,3} {p.Burst,3} {completion[p.Id],4} {turn,4} {wait,4} {resp,4}");
    }
    int n = procs.Count;
    Console.WriteLine($"turn {turnSum / n:F1}  wait {waitSum / n:F1}  resp {respSum / n:F1}");
}

record Proc(string Id, int Arrival, int Burst, int Priority);
```

```text output
| P1 | P5 | P2 | P4 | P3 |
0    5    7    10   14   22

SJF  arr bur comp turn wait resp
P1     0   5    5    5    0    0
P2     1   3   10    9    6    6
P3     2   8   22   20   12   12
P4     3   4   14   11    7    7
P5     4   2    7    3    1    1
turn 9.6  wait 5.2  resp 5.2
```

Average waiting time drops from 7.8 to 5.2 units, and average turnaround from 12.2 to 9.6, just by reordering the same five jobs. P1 still runs first only because it is the sole process that has arrived at time 0; from that point on, the shortest remaining job always wins. The cost lands on P3: it has the longest burst, so it is the one job SJF is willing to make wait for everyone shorter, and its turnaround (20) is the worst of any process in this run, worse even than under FCFS (14). Under heavier and more varied load a burst-8 job could be pushed back indefinitely by a stream of shorter arrivals; that is the trade-off OSTEP calls the SJF/STCF weakness, and it is what priority scheduling's starvation problem below is really the same shape of. SJF also assumes something FCFS does not: that the scheduler already knows each job's burst length before running it, which a real OS almost never does. A preemptive variant, Shortest Time-to-Completion First (STCF), lets a newly arrived shorter job interrupt whatever is running; OSTEP asserts that SJF is optimal for average turnaround when all jobs arrive together, without walking through the proof, and does prove STCF optimal for the general case where arrivals are staggered, as they are in this workload ([OSTEP ch. 7](https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched.pdf)).

::::exercise[Do the arithmetic before you run it]
Three jobs arrive together at time 0: A needs 6 units of CPU time, B needs 2, C needs 4. Predict the average turnaround time under FCFS, running them in the order A, B, C, and under SJF. Then check your numbers by running a program that computes both.

:::solution
```csharp run id=ex-predict
(string Id, int Burst)[] jobs = [("A", 6), ("B", 2), ("C", 4)];

Report("FCFS", jobs);                                   // as listed
Report("SJF", jobs.OrderBy(j => j.Burst).ToArray());     // shortest first

static void Report(string label, (string Id, int Burst)[] order)
{
    int clock = 0;
    var turnarounds = new List<int>();
    foreach (var (id, burst) in order)
    {
        clock += burst;
        turnarounds.Add(clock);   // all arrived at 0, so turnaround == completion
        Console.WriteLine($"  {id} completes at {clock}");
    }
    Console.WriteLine($"{label} average turnaround: {turnarounds.Average():F2}");
}
```

```text output
  A completes at 6
  B completes at 8
  C completes at 12
FCFS average turnaround: 8.67
  B completes at 2
  C completes at 6
  A completes at 12
SJF average turnaround: 6.67
```

FCFS: A finishes at 6, B at 6+2=8, C at 8+4=12, average (6+8+12)/3 = 8.67. SJF runs B first (finishes at 2), then C (2+4=6), then A (6+6=12): average (2+6+12)/3 = 6.67. SJF wins here for the same reason it won on the five-process workload: the two short jobs no longer wait behind the long one, at the cost of A now finishing exactly as late as it would under FCFS regardless of order — the longest job in a batch always finishes last under both policies when everything arrives at once.
:::
::::

## Round robin: trading turnaround for response time

Round robin gives up "shortest first" entirely. It runs each ready job for at most one **quantum** — a fixed time slice — and if the job is not done, moves it to the back of the queue and starts the next one. The rule that matters for correctness: a process that finishes its slice rejoins the ready queue *after* any process that arrived during that slice, or an unlucky arrival timing could let one process cut in front of another on every round, not just once.

```csharp run id=rr
List<Proc> Workload() =>
[
    new("P1", Arrival: 0, Burst: 5, Priority: 3),
    new("P2", Arrival: 1, Burst: 3, Priority: 1),
    new("P3", Arrival: 2, Burst: 8, Priority: 4),
    new("P4", Arrival: 3, Burst: 4, Priority: 2),
    new("P5", Arrival: 4, Burst: 2, Priority: 5),
];

const int Quantum = 4;
var procs = Workload();

// Round robin: a FIFO ready queue and a fixed time slice.
// Newly arrived processes join the queue before a process that
// just used up its slice rejoins it, or a same-tick arrival could
// be pushed behind that process on every round that follows.
var remainingBurst = procs.ToDictionary(p => p.Id, p => p.Burst);
var notArrivedYet = new Queue<Proc>(procs.OrderBy(p => p.Arrival).ThenBy(p => p.Id));
var ready = new Queue<string>();
var completion = new Dictionary<string, int>();
var firstStart = new Dictionary<string, int>();
var slices = new List<(string Id, int Start, int End)>();
int clock = 0;

void AdmitArrivals(int upTo)
{
    while (notArrivedYet.Count > 0 && notArrivedYet.Peek().Arrival <= upTo)
        ready.Enqueue(notArrivedYet.Dequeue().Id);
}

AdmitArrivals(0);
if (ready.Count == 0 && notArrivedYet.Count > 0)
{
    clock = notArrivedYet.Peek().Arrival;
    AdmitArrivals(clock);
}

while (ready.Count > 0)
{
    string id = ready.Dequeue();
    if (!firstStart.ContainsKey(id)) firstStart[id] = clock;
    int run = Math.Min(Quantum, remainingBurst[id]);
    int start = clock;
    clock += run;
    remainingBurst[id] -= run;
    slices.Add((id, start, clock));

    AdmitArrivals(clock);              // arrivals during this slice go first
    if (remainingBurst[id] > 0)
        ready.Enqueue(id);             // then the process that just ran
    else
        completion[id] = clock;

    if (ready.Count == 0 && notArrivedYet.Count > 0)
    {
        clock = notArrivedYet.Peek().Arrival;
        AdmitArrivals(clock);
    }
}

PrintGantt(slices);
PrintMetrics("RR-4", procs, completion, firstStart);

static void PrintGantt(List<(string Id, int Start, int End)> slices)
{
    var top = new System.Text.StringBuilder("|");
    var pipeAt = new List<int> { 0 };
    foreach (var s in slices)
    {
        int width = s.Id.Length + 2;
        int pad = (width - s.Id.Length) / 2;
        top.Append(new string(' ', pad)).Append(s.Id)
           .Append(new string(' ', width - s.Id.Length - pad)).Append('|');
        pipeAt.Add(top.Length - 1);
    }
    var bottom = new System.Text.StringBuilder(new string(' ', top.Length + 4));
    for (int i = 0; i < pipeAt.Count; i++)
    {
        string t = (i == 0 ? slices[0].Start : slices[i - 1].End).ToString();
        for (int c = 0; c < t.Length && pipeAt[i] + c < bottom.Length; c++)
            bottom[pipeAt[i] + c] = t[c];
    }
    Console.WriteLine(top.ToString());
    Console.WriteLine(bottom.ToString().TrimEnd());
}

static void PrintMetrics(
    string label, List<Proc> procs,
    Dictionary<string, int> completion, Dictionary<string, int> firstStart)
{
    Console.WriteLine();
    Console.WriteLine($"{label,-4} {"arr",3} {"bur",3} {"comp",4} {"turn",4} {"wait",4} {"resp",4}");
    double turnSum = 0, waitSum = 0, respSum = 0;
    foreach (var p in procs.OrderBy(p => p.Id))
    {
        int turn = completion[p.Id] - p.Arrival;
        int wait = turn - p.Burst;
        int resp = firstStart[p.Id] - p.Arrival;
        turnSum += turn; waitSum += wait; respSum += resp;
        Console.WriteLine($"{p.Id,-4} {p.Arrival,3} {p.Burst,3} {completion[p.Id],4} {turn,4} {wait,4} {resp,4}");
    }
    int n = procs.Count;
    Console.WriteLine($"turn {turnSum / n:F1}  wait {waitSum / n:F1}  resp {respSum / n:F1}");
}

record Proc(string Id, int Arrival, int Burst, int Priority);
```

```text output
| P1 | P2 | P3 | P4 | P5 | P1 | P3 |
0    4    7    11   15   17   18   22

RR-4 arr bur comp turn wait resp
P1     0   5   18   18   13    0
P2     1   3    7    6    3    3
P3     2   8   22   20   12    5
P4     3   4   15   12    8    8
P5     4   2   17   13   11   11
turn 13.8  wait 9.4  resp 5.4
```

Average response time is 5.4, worse than SJF's 5.2 here only because P1 happens to start immediately under both, but look at P3 and P4: under FCFS or SJF a process either starts at time 0 or waits behind whichever full job runs before it; under RR, every process is guaranteed to be looked at within one pass of the queue. The trade is visible in the averages: turnaround (13.8) and waiting (9.4) are both worse than plain FCFS. Every job except the one that happens to finish inside its first slice pays for a second dispatch, and RR has no notion of "shortest job" at all, so a long job delays every other job's *second* turn exactly as much as it delayed FCFS's first pass.

::::exercise[Shrink and grow the quantum]
Predict what happens to average turnaround, waiting and response time if the quantum shrinks to 2, and if it grows to 8 (the length of the longest burst in the workload). Then run it.

:::solution
```csharp run id=ex-quantum
List<Proc> Workload() =>
[
    new("P1", Arrival: 0, Burst: 5, Priority: 3),
    new("P2", Arrival: 1, Burst: 3, Priority: 1),
    new("P3", Arrival: 2, Burst: 8, Priority: 4),
    new("P4", Arrival: 3, Burst: 4, Priority: 2),
    new("P5", Arrival: 4, Burst: 2, Priority: 5),
];

Console.WriteLine(" q  turn wait resp");
foreach (int quantum in new[] { 2, 4, 8 })
    RunRoundRobin(quantum);

void RunRoundRobin(int quantum)
{
    var procs = Workload();
    var remainingBurst = procs.ToDictionary(p => p.Id, p => p.Burst);
    var notArrivedYet = new Queue<Proc>(procs.OrderBy(p => p.Arrival).ThenBy(p => p.Id));
    var ready = new Queue<string>();
    var completion = new Dictionary<string, int>();
    var firstStart = new Dictionary<string, int>();
    int clock = 0;

    void AdmitArrivals(int upTo)
    {
        while (notArrivedYet.Count > 0 && notArrivedYet.Peek().Arrival <= upTo)
            ready.Enqueue(notArrivedYet.Dequeue().Id);
    }

    AdmitArrivals(0);
    if (ready.Count == 0 && notArrivedYet.Count > 0)
    {
        clock = notArrivedYet.Peek().Arrival;
        AdmitArrivals(clock);
    }

    while (ready.Count > 0)
    {
        string id = ready.Dequeue();
        if (!firstStart.ContainsKey(id)) firstStart[id] = clock;
        int run = Math.Min(quantum, remainingBurst[id]);
        clock += run;
        remainingBurst[id] -= run;

        AdmitArrivals(clock);
        if (remainingBurst[id] > 0) ready.Enqueue(id);
        else completion[id] = clock;

        if (ready.Count == 0 && notArrivedYet.Count > 0)
        {
            clock = notArrivedYet.Peek().Arrival;
            AdmitArrivals(clock);
        }
    }

    double turnSum = 0, waitSum = 0, respSum = 0;
    foreach (var p in procs)
    {
        int turn = completion[p.Id] - p.Arrival;
        turnSum += turn;
        waitSum += turn - p.Burst;
        respSum += firstStart[p.Id] - p.Arrival;
    }
    int n = procs.Count;
    Console.WriteLine(
        $"{quantum,2} {turnSum / n,5:F1}{waitSum / n,5:F1}{respSum / n,5:F1}");
}

record Proc(string Id, int Arrival, int Burst, int Priority);
```

```text output
 q  turn wait resp
 2  14.2  9.8  2.8
 4  13.8  9.4  5.4
 8  12.2  7.8  7.8
```

A smaller quantum (2) improves average response time further, to 2.8, because every process is revisited twice as often, but it also raises turnaround and waiting slightly, because more of the run is spent context-switching between short slices. A quantum of 8, at least as large as the longest burst, makes round robin behave exactly like FCFS: `P3` needs only one slice regardless, so no process is ever preempted, and the three averages match the FCFS run precisely. A useful quantum sits well above the cost of a context switch (measured for this workload's underlying operating system in [Processes vs Threads](/operating-systems/processes-and-threads/#what-a-context-switch-costs)) and well below the typical job length, or it degenerates toward one extreme or the other.
:::
::::

## Priority scheduling, and the starvation it invites

Priority scheduling picks the highest-priority ready job at each decision point, ignoring arrival order and burst length alike. This version is non-preemptive and uses the `Priority` field already in the workload, where 1 is most urgent.

```csharp run id=priority
List<Proc> Workload() =>
[
    new("P1", Arrival: 0, Burst: 5, Priority: 3),
    new("P2", Arrival: 1, Burst: 3, Priority: 1),
    new("P3", Arrival: 2, Burst: 8, Priority: 4),
    new("P4", Arrival: 3, Burst: 4, Priority: 2),
    new("P5", Arrival: 4, Burst: 2, Priority: 5),
];

var procs = Workload();

// Non-preemptive priority: lowest Priority number runs first among
// arrived processes; ties go to the earlier arrival.
var remaining = procs.ToDictionary(p => p.Id, p => p);
var completion = new Dictionary<string, int>();
var firstStart = new Dictionary<string, int>();
var slices = new List<(string Id, int Start, int End)>();
int clock = 0;
while (remaining.Count > 0)
{
    var ready = remaining.Values.Where(p => p.Arrival <= clock).ToList();
    if (ready.Count == 0)
    {
        clock = remaining.Values.Min(p => p.Arrival);
        continue;
    }
    var next = ready.OrderBy(p => p.Priority).ThenBy(p => p.Arrival).First();
    int start = clock;
    int end = start + next.Burst;
    slices.Add((next.Id, start, end));
    firstStart[next.Id] = start;
    completion[next.Id] = end;
    clock = end;
    remaining.Remove(next.Id);
}

PrintGantt(slices);
PrintMetrics("Prio", procs, completion, firstStart);

static void PrintGantt(List<(string Id, int Start, int End)> slices)
{
    var top = new System.Text.StringBuilder("|");
    var pipeAt = new List<int> { 0 };
    foreach (var s in slices)
    {
        int width = s.Id.Length + 2;
        int pad = (width - s.Id.Length) / 2;
        top.Append(new string(' ', pad)).Append(s.Id)
           .Append(new string(' ', width - s.Id.Length - pad)).Append('|');
        pipeAt.Add(top.Length - 1);
    }
    var bottom = new System.Text.StringBuilder(new string(' ', top.Length + 4));
    for (int i = 0; i < pipeAt.Count; i++)
    {
        string t = (i == 0 ? slices[0].Start : slices[i - 1].End).ToString();
        for (int c = 0; c < t.Length && pipeAt[i] + c < bottom.Length; c++)
            bottom[pipeAt[i] + c] = t[c];
    }
    Console.WriteLine(top.ToString());
    Console.WriteLine(bottom.ToString().TrimEnd());
}

static void PrintMetrics(
    string label, List<Proc> procs,
    Dictionary<string, int> completion, Dictionary<string, int> firstStart)
{
    Console.WriteLine();
    Console.WriteLine($"{label,-4} {"arr",3} {"bur",3} {"pri",3} {"comp",4} {"turn",4} {"wait",4} {"resp",4}");
    double turnSum = 0, waitSum = 0, respSum = 0;
    foreach (var p in procs.OrderBy(p => p.Id))
    {
        int turn = completion[p.Id] - p.Arrival;
        int wait = turn - p.Burst;
        int resp = firstStart[p.Id] - p.Arrival;
        turnSum += turn; waitSum += wait; respSum += resp;
        Console.WriteLine($"{p.Id,-4} {p.Arrival,3} {p.Burst,3} {p.Priority,3} {completion[p.Id],4} {turn,4} {wait,4} {resp,4}");
    }
    int n = procs.Count;
    Console.WriteLine($"turn {turnSum / n:F1}  wait {waitSum / n:F1}  resp {respSum / n:F1}");
}

record Proc(string Id, int Arrival, int Burst, int Priority);
```

```text output
| P1 | P2 | P4 | P3 | P5 |
0    5    8    12   20   22

Prio arr bur pri comp turn wait resp
P1     0   5   3    5    5    0    0
P2     1   3   1    8    7    4    4
P3     2   8   4   20   18   10   10
P4     3   4   2   12    9    5    5
P5     4   2   5   22   18   16   16
turn 11.4  wait 7.0  resp 7.0
```

P5 has priority 5, the worst in the workload, and it pays for it: it waits 16 units even though its burst is only 2, finishing dead last regardless of the fact that it arrived fourth, not fifth. Give this algorithm a steady stream of arriving high-priority work and a low-priority job can wait arbitrarily long — real starvation, not just a bad average. The classic fix is **aging**: gradually raise a waiting job's effective priority the longer it waits, so it eventually outranks even freshly arrived urgent work ([OSTEP ch. 8](https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched-mlfq.pdf) discusses the same starvation problem for MLFQ, which aging and the priority boost below both address).

::::exercise[Add aging and watch a low-priority job stop waiting]
Extend the priority scheduler so effective priority is `Priority - (waited time) / AgingPeriod`, recomputed at every decision point, and ties still favor the earlier arrival. Run it on a workload where one low-priority job arrives first and a steady trickle of priority-1 jobs keeps arriving after it. Does aging change when the low-priority job runs?

:::solution
```csharp run id=ex-aging
List<Proc> Workload() =>
[
    new("P1", Arrival: 0, Burst: 2, Priority: 5),
    new("P2", Arrival: 0, Burst: 2, Priority: 1),
    new("P3", Arrival: 2, Burst: 2, Priority: 1),
    new("P4", Arrival: 4, Burst: 2, Priority: 1),
    new("P5", Arrival: 6, Burst: 2, Priority: 1),
];

Run("static priority", agingPeriod: 0);
Run("aged, 1 point per tick waited", agingPeriod: 1);

void Run(string label, int agingPeriod)
{
    var remaining = Workload().ToDictionary(p => p.Id, p => p);
    var completion = new Dictionary<string, int>();
    int clock = 0;
    while (remaining.Count > 0)
    {
        var ready = remaining.Values.Where(p => p.Arrival <= clock).ToList();
        if (ready.Count == 0) { clock = remaining.Values.Min(p => p.Arrival); continue; }
        var next = ready
            .OrderBy(p => Effective(p, clock, agingPeriod))
            .ThenBy(p => p.Arrival)
            .First();
        clock += next.Burst;
        completion[next.Id] = clock;
        remaining.Remove(next.Id);
    }
    Console.WriteLine(label + ":");
    foreach (var p in Workload().OrderBy(p => p.Id))
        Console.WriteLine(
            $"  {p.Id} completes at {completion[p.Id],2}, turnaround {completion[p.Id] - p.Arrival}");
}

static int Effective(Proc p, int clock, int agingPeriod) =>
    agingPeriod == 0 ? p.Priority : p.Priority - (clock - p.Arrival) / agingPeriod;

record Proc(string Id, int Arrival, int Burst, int Priority);
```

```text output
static priority:
  P1 completes at 10, turnaround 10
  P2 completes at  2, turnaround 2
  P3 completes at  4, turnaround 2
  P4 completes at  6, turnaround 2
  P5 completes at  8, turnaround 2
aged, 1 point per tick waited:
  P1 completes at  6, turnaround 6
  P2 completes at  2, turnaround 2
  P3 completes at  4, turnaround 2
  P4 completes at  8, turnaround 4
  P5 completes at 10, turnaround 4
```

Under static priority, P1 (priority 5) loses to every priority-1 arrival and runs dead last, at turnaround 10. Under aging, its effective priority falls by 1 every tick it waits; by time 4 it has waited 4 ticks and reached effective priority 1, exactly tying the newly arrived P4 — and the tie-break favors P1's earlier arrival, so it finally wins and completes at 6. Aging does not eliminate the wait, it bounds it: P1 still yields to the two priority-1 jobs that were already ahead of it, but it can no longer be shut out forever by jobs that keep arriving after it.
:::
::::

## Multi-level feedback queue: learning a job's behavior instead of guessing it

SJF gives the best average turnaround but needs to know burst lengths up front, which a general-purpose OS does not. MLFQ is the classic answer: several queues at different priority levels, each with its own quantum, and rules that move a job between levels based on how it actually behaves, not on a length nobody told the scheduler in advance. OSTEP states the rules this way (paraphrased from chapters 8.2–8.4, using this article's variable names):

- **Rule 1.** If two ready jobs are on different levels, the one on the higher-priority level runs.
- **Rule 2.** If two ready jobs are on the same level, they round-robin using that level's quantum.
- **Rule 3.** A new job enters at the topmost (highest-priority) level.
- **Rule 4.** Once a job uses up its whole time allotment at a level — regardless of how many times it gave up the CPU before that — its priority drops one level.
- **Rule 5.** After every `S` time units, every job is moved back to the topmost level.

Rule 4 exists to stop a job from gaming the scheduler by voluntarily yielding just before its quantum expires to stay at a high level forever; an earlier version of the rule reset the allotment on any voluntary yield, and OSTEP shows that a job can exploit exactly that loophole to monopolize the CPU ([OSTEP ch. 8](https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched-mlfq.pdf)). Rule 5 exists so a job that spends a long time at the bottom is not stuck there permanently: without it, enough short-lived arrivals could starve it exactly the way plain priority scheduling starved P5 above.

<figure class="diagram">
<svg viewBox="0 0 360 330" role="img" aria-labelledby="mlfq-title mlfq-desc">
<title id="mlfq-title">Three MLFQ levels with demotion and a periodic boost</title>
<desc id="mlfq-desc">Level 0 at the top has the shortest quantum and highest priority. A job that uses its whole quantum at a level drops one level. A curved arrow on the right shows every waiting job jumping back to level 0 every S ticks.</desc>
<defs>
<marker id="mlfq-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-accent"/></marker>
<marker id="mlfq-arrow-bad" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-bad"/></marker>
</defs>
<text x="10" y="20" class="d-small d-muted">new jobs enter at the top (Rule 3)</text>
<rect x="10" y="28" width="260" height="46" rx="6" class="d-box-accent"/>
<text x="20" y="48" class="d-bold">level 0</text>
<text x="20" y="66" class="d-small">quantum 3, highest priority</text>
<rect x="10" y="100" width="260" height="46" rx="6" class="d-box-2"/>
<text x="20" y="120" class="d-bold">level 1</text>
<text x="20" y="138" class="d-small">quantum 6</text>
<rect x="10" y="172" width="260" height="46" rx="6" class="d-box"/>
<text x="20" y="192" class="d-bold">level 2</text>
<text x="20" y="210" class="d-small">quantum 12, lowest priority</text>
<path d="M140 74 V100" class="d-bad" marker-end="url(#mlfq-arrow-bad)"/>
<text x="150" y="90" class="d-small d-text-bad">quantum used up</text>
<path d="M140 146 V172" class="d-bad" marker-end="url(#mlfq-arrow-bad)"/>
<text x="150" y="162" class="d-small d-text-bad">quantum used up</text>
<path d="M300 195 C340 195 340 40 300 40" class="d-accent d-dashed" marker-end="url(#mlfq-arrow)"/>
<text x="10" y="240" class="d-small d-text-accent">Right curve: every S ticks, every waiting job</text>
<text x="10" y="256" class="d-small d-text-accent">jumps back to level 0 (Rule 5, the boost)</text>
<text x="10" y="290" class="d-small d-muted">A job runs from the highest non-empty level;</text>
<text x="10" y="306" class="d-small d-muted">same-level jobs round-robin (Rules 1-2).</text>
</svg>
<figcaption>Figure 1. A job that keeps using its whole quantum sinks one level each time (Rule 4); the periodic boost undoes that so a job whose behavior changes later is not stuck at the bottom.</figcaption>
</figure>

The implementation below uses three levels with quantums 3, 6 and 12, and boosts every 14 ticks. Every process here is a one-shot CPU burst with no I/O, so the classic MLFQ benefit — keeping an interactive job that frequently yields for input at a high level — cannot show up; what this run demonstrates instead is demotion and the boost, the mechanical half of the algorithm.

```csharp run id=mlfq
List<Proc> Workload() =>
[
    new("P1", Arrival: 0, Burst: 5, Priority: 3),
    new("P2", Arrival: 1, Burst: 3, Priority: 1),
    new("P3", Arrival: 2, Burst: 8, Priority: 4),
    new("P4", Arrival: 3, Burst: 4, Priority: 2),
    new("P5", Arrival: 4, Burst: 2, Priority: 5),
];

// Three levels, quantum widening as jobs sink, and a periodic
// priority boost so a job at the bottom is not stuck there forever
// (OSTEP's MLFQ rules 1-5).
int[] quantum = [3, 6, 12];
const int BoostEvery = 14;

var procs = Workload();
var remainingArrivals = new Queue<Proc>(procs.OrderBy(p => p.Arrival).ThenBy(p => p.Id));
var queues = new Queue<string>[quantum.Length];
for (int i = 0; i < queues.Length; i++) queues[i] = new Queue<string>();
var level = new Dictionary<string, int>();
var usedInLevel = new Dictionary<string, int>();
var remaining = procs.ToDictionary(p => p.Id, p => p.Burst);
var completion = new Dictionary<string, int>();
var firstStart = new Dictionary<string, int>();
var timeline = new List<(string Id, int Level)>();   // one entry per tick

string? runningId = null;
int t = 0;
while (completion.Count < procs.Count)
{
    while (remainingArrivals.Count > 0 && remainingArrivals.Peek().Arrival == t)
    {
        var p = remainingArrivals.Dequeue();
        level[p.Id] = 0;
        usedInLevel[p.Id] = 0;
        queues[0].Enqueue(p.Id);
    }

    if (t > 0 && t % BoostEvery == 0)
    {
        var unfinished = new List<string>();
        if (runningId is not null) unfinished.Add(runningId);
        foreach (var q in queues) { unfinished.AddRange(q); q.Clear(); }
        runningId = null;
        foreach (var id in unfinished.Distinct())
        {
            level[id] = 0;
            usedInLevel[id] = 0;
            queues[0].Enqueue(id);
        }
    }

    if (runningId is not null)
    {
        int myLevel = level[runningId];
        bool higherLevelReady = Enumerable.Range(0, myLevel).Any(l => queues[l].Count > 0);
        if (higherLevelReady)
        {
            // Preempted: resume at the front of its own queue later,
            // with its used-quantum count intact.
            var q = new Queue<string>();
            q.Enqueue(runningId);
            foreach (var id in queues[myLevel]) q.Enqueue(id);
            queues[myLevel] = q;
            runningId = null;
        }
    }

    if (runningId is null)
    {
        for (int l = 0; l < queues.Length; l++)
        {
            if (queues[l].Count > 0) { runningId = queues[l].Dequeue(); break; }
        }
    }

    if (runningId is null) { timeline.Add(("-", -1)); t++; continue; }

    if (!firstStart.ContainsKey(runningId)) firstStart[runningId] = t;
    timeline.Add((runningId, level[runningId]));
    remaining[runningId]--;
    usedInLevel[runningId]++;
    int lvl = level[runningId];

    if (remaining[runningId] == 0)
    {
        completion[runningId] = t + 1;
        runningId = null;
    }
    else if (usedInLevel[runningId] == quantum[lvl])
    {
        int next = Math.Min(lvl + 1, quantum.Length - 1);
        level[runningId] = next;
        usedInLevel[runningId] = 0;
        queues[next].Enqueue(runningId);
        runningId = null;
    }
    t++;
}

PrintLevelTrace(timeline);
PrintMetrics("MLFQ", procs, completion, firstStart);

static void PrintLevelTrace(List<(string Id, int Level)> timeline)
{
    var slices = new List<(string Id, int Level, int Start, int End)>();
    foreach (var (id, lvl) in timeline)
    {
        if (slices.Count > 0 && slices[^1].Id == id && slices[^1].Level == lvl)
        {
            var last = slices[^1];
            slices[^1] = (last.Id, last.Level, last.Start, last.End + 1);
        }
        else
        {
            int start = slices.Count == 0 ? 0 : slices[^1].End;
            slices.Add((id, lvl, start, start + 1));
        }
    }
    Console.WriteLine("time   proc  level");
    foreach (var s in slices)
    {
        string span = $"{s.Start}-{s.End}";
        Console.WriteLine($"{span,-7}{s.Id,-6}{s.Level}");
    }
}

static void PrintMetrics(
    string label, List<Proc> procs,
    Dictionary<string, int> completion, Dictionary<string, int> firstStart)
{
    Console.WriteLine($"{label,-4} {"arr",3} {"bur",3} {"comp",4} {"turn",4} {"wait",4} {"resp",4}");
    double turnSum = 0, waitSum = 0, respSum = 0;
    foreach (var p in procs.OrderBy(p => p.Id))
    {
        int turn = completion[p.Id] - p.Arrival;
        int wait = turn - p.Burst;
        int resp = firstStart[p.Id] - p.Arrival;
        turnSum += turn; waitSum += wait; respSum += resp;
        Console.WriteLine($"{p.Id,-4} {p.Arrival,3} {p.Burst,3} {completion[p.Id],4} {turn,4} {wait,4} {resp,4}");
    }
    int n = procs.Count;
    Console.WriteLine($"turn {turnSum / n:F1}  wait {waitSum / n:F1}  resp {respSum / n:F1}");
}

record Proc(string Id, int Arrival, int Burst, int Priority);
```

```text output
time   proc  level
0-3    P1    0
3-6    P2    0
6-9    P3    0
9-12   P4    0
12-14  P5    0
14-16  P1    0
16-19  P3    0
19-20  P4    0
20-22  P3    1
MLFQ arr bur comp turn wait resp
P1     0   5   16   16   11    0
P2     1   3    6    5    2    2
P3     2   8   22   20   12    4
P4     3   4   20   17   13    6
P5     4   2   14   10    8    8
turn 13.6  wait 9.2  resp 4.0
```

Watch P1: it uses its whole level-0 quantum (3 units, 0-3), so Rule 4 demotes it to level 1 with 2 units of burst left. Before it gets to run again, the boost at `t=14` (`14 % 14 == 0`) fires and resets every still-waiting job to level 0, so when P1 finally runs again at 14-16 the trace shows level 0, not level 1 — the boost erased its demotion. P3, the longest job, gets demoted the same way at `t=9`, is boosted back to level 0 at `t=14`, runs another full level-0 quantum (16-19), gets demoted again, and only reaches level 1 for its last slice (20-22). Every process here got a slice within its first 14 units, which is why average response time (4.0) beats every other algorithm above, including SJF; the cost is an average turnaround (13.6) worse than plain FCFS, because the boost is deliberately generous with this article's small, short-lived workload and repeatedly resets progress that a pure SJF or priority scheduler would never give up.

## Five algorithms, one workload, five different pictures

Every row below is copied from the average lines actually printed above; nothing here is computed by hand.

| Algorithm | Turn | Wait | Resp |
|---|---:|---:|---:|
| FCFS | 12.2 | 7.8 | 7.8 |
| SJF | 9.6 | 5.2 | 5.2 |
| RR-4 | 13.8 | 9.4 | 5.4 |
| Priority | 11.4 | 7.0 | 7.0 |
| MLFQ | 13.6 | 9.2 | 4.0 |

SJF wins on turnaround and waiting because it has information the other four do not: exact burst lengths, known in advance, which is unrealistic for a general-purpose OS. Among the algorithms that do not require that knowledge, MLFQ gets the best response time (4.0) by giving every job early access to the CPU and letting demotion sort out who deserves more of it, at the cost of turnaround, because this workload is too short and too I/O-free for its long-run advantage over plain round robin to show. Priority scheduling sits in the middle only because the priorities happened to be assigned sensibly here; nothing stops someone from assigning them so that priority scheduling behaves far worse than FCFS on every metric, which is exactly why a real scheduler that exposes priorities to applications also needs a defense against the starvation that creates, whether that is aging (above) or MLFQ's periodic boost.

That knowledge requirement, and whether each algorithm can be interrupted mid-burst, is what actually separates the five:

| Algorithm | Preemptive | Needs burst length |
|---|---|---|
| FCFS | No | No |
| SJF | No | Yes |
| RR-4 | Yes | No |
| Priority | No | No |
| MLFQ | Yes | No |

## What Windows actually schedules

Windows schedules threads, not processes: the system scheduler decides which of the competing threads gets the next processor time slice, based on scheduling priorities ([Scheduling](https://learn.microsoft.com/en-us/windows/win32/procthread/scheduling)). It uses **32 priority levels, numbered 0 (lowest) to 31 (highest)**, where threads of equal priority round-robin and a thread becomes eligible to preempt a lower-priority one immediately, without waiting for that thread's slice to end ([Scheduling Priorities](https://learn.microsoft.com/en-us/windows/win32/procthread/scheduling-priorities)). A thread's *base priority* comes from combining its process's priority class (`IDLE_PRIORITY_CLASS` through `REALTIME_PRIORITY_CLASS`) with a priority level relative to that class (`THREAD_PRIORITY_IDLE` through `THREAD_PRIORITY_TIME_CRITICAL`); Microsoft's own table shows, for example, that `THREAD_PRIORITY_NORMAL` in `NORMAL_PRIORITY_CLASS` gives base priority 8, while the same thread priority level in `HIGH_PRIORITY_CLASS` gives base priority 13 ([Scheduling Priorities](https://learn.microsoft.com/en-us/windows/win32/procthread/scheduling-priorities)).

On top of that static base, every thread also has a *dynamic priority*, which starts equal to the base priority and which the scheduler raises temporarily to improve responsiveness: when a process is brought to the foreground, when a thread's window receives input, and when a blocked thread's wait condition is satisfied (finishing a disk or keyboard I/O wait, for instance). Critically, this boost decays on its own: "the scheduler reduces that priority by one level each time the thread completes a time slice, until the thread drops back to its base priority" ([Priority Boosts](https://learn.microsoft.com/en-us/windows/win32/procthread/priority-boosts)). Only threads with a base priority from 0 to 15 receive these boosts at all; the 16-31 real-time range is left alone ([Priority Boosts](https://learn.microsoft.com/en-us/windows/win32/procthread/priority-boosts)).

That combination — a static priority, a temporary boost for a thread that just became runnable or just got input, and automatic, gradual decay back down as the thread consumes its slices — is a real-time relative of what this article's MLFQ demotes and boosts explicitly: a thread that behaves like an interactive job (frequent short waits, each one triggering a fresh boost) tends to run at an effectively higher priority than one that just burns CPU continuously and decays straight back to its base level. It is not literally multiple queues with Rules 1-5, but it produces the same shape of outcome for the same reason MLFQ does: recent behavior, not a fixed number, decides who runs next.

## What Linux actually schedules, and why the textbook answer is dated

For years the correct answer here was the **Completely Fair Scheduler (CFS)**, merged in Linux 2.6.23. CFS tracks a per-task **virtual runtime** (`vruntime`) and keeps ready tasks in a red-black tree ordered by it, always picking the leftmost (smallest-`vruntime`) task to run next, which is the mechanism that gives every task an equal share of the CPU over time without fixed time slices ([CFS design](https://docs.kernel.org/scheduler/sched-design-CFS.html)). That is still an accurate description of CFS. It is no longer an accurate description of what a current Linux kernel runs by default.

Linux 6.6, released in 2023, replaced CFS as the default with a different algorithm, **EEVDF** (Earliest Eligible Virtual Deadline First). The kernel's own current scheduler documentation describes the change directly: the kernel began "moving away from the earlier Completely Fair Scheduler (CFS) in favor of a version of EEVDF proposed by Peter Zijlstra in 2023" ([EEVDF Scheduler](https://docs.kernel.org/scheduler/sched-eevdf.html)). Where CFS orders purely by accumulated virtual runtime, EEVDF gives each task a **virtual deadline** and a **lag** value — positive lag means a task is owed CPU time, negative means it has taken more than its fair share — and picks whichever eligible task (lag at least zero) has the earliest virtual deadline; a task can also preempt the one running if its own deadline is earlier ([EEVDF Scheduler](https://docs.kernel.org/scheduler/sched-eevdf.html)). The practical difference from CFS is that EEVDF reasons explicitly about *when* a task is owed its fair share, not only *how much*, which the documentation credits with improving latency for tasks CFS's heuristics would otherwise leave behind.

A widely used man page, `sched(7)`, still says as of this writing that "the default scheduler is CFS" for `SCHED_OTHER`, the ordinary time-sharing policy ([sched(7)](https://man7.org/linux/man-pages/man7/sched.7.html)) — a reminder that even official-looking documentation can lag a kernel change, which is exactly why this section cites the kernel's own scheduler documentation, not just a man page, for the current behavior. Both CFS and EEVDF apply to `SCHED_OTHER`, the default policy; niceness still works under EEVDF the way it did under CFS, adjusting how much of the CPU a task is owed, not which specific algorithm makes the decision.

Neither CFS nor EEVDF is a small number of fixed queues the way MLFQ is. Both are trying to solve a version of the same problem this article's simulator explored by hand: give every ready task a fair, low-latency share of the CPU without knowing its future behavior in advance, and both do it by tracking a continuously updated number per task (virtual runtime, or lag and a virtual deadline) instead of sorting tasks into discrete priority levels the way Windows and this article's MLFQ do.

## Extend the simulator further

::::exercise[Find the bug]
This trimmed-down round-robin loop only admits arrivals once, before the dispatch loop starts, instead of after every slice. Two processes are enough to show what breaks. What happens to the second process, and for which kind of workload would this bug never show up in the output?

```csharp run id=ex-bug-workload
List<Proc> Workload() =>
[
    new("P1", Arrival: 0, Burst: 5, Priority: 3),
    new("P2", Arrival: 1, Burst: 3, Priority: 1),
];

const int Quantum = 4;
var procs = Workload();
var remainingBurst = procs.ToDictionary(p => p.Id, p => p.Burst);
var notArrivedYet = new Queue<Proc>(procs.OrderBy(p => p.Arrival).ThenBy(p => p.Id));
var ready = new Queue<string>();
var completion = new Dictionary<string, int>();
int clock = 0;

// BUG: only admits arrivals once, before the loop starts.
while (notArrivedYet.Count > 0 && notArrivedYet.Peek().Arrival <= clock)
    ready.Enqueue(notArrivedYet.Dequeue().Id);

while (ready.Count > 0)
{
    string id = ready.Dequeue();
    int run = Math.Min(Quantum, remainingBurst[id]);
    clock += run;
    remainingBurst[id] -= run;
    if (remainingBurst[id] > 0) ready.Enqueue(id);
    else completion[id] = clock;
}

foreach (var p in procs.OrderBy(p => p.Id))
    Console.WriteLine(completion.ContainsKey(p.Id)
        ? $"{p.Id} completed at {completion[p.Id]}"
        : $"{p.Id} never completed: still waiting to be admitted");

record Proc(string Id, int Arrival, int Burst, int Priority);
```

```text output
P1 completed at 5
P2 never completed: still waiting to be admitted
```

:::solution
`notArrivedYet` is only drained once, in the loop that runs before the main dispatch loop starts. After that, nothing ever checks it again, so P2, which arrives at time 1 while P1 (burst 5) is already running, is never moved from `notArrivedYet` into `ready`. The main loop only looks at `ready`, so once P1 finishes — one slice of 4, then a final slice of 1, completing at t=5 — `ready` is empty, the loop's own condition ends it, and P2 sits in `notArrivedYet` forever, correctly reported as never admitted rather than hanging the program. (A version of this loop that also tried to wait for `notArrivedYet` to empty, instead of stopping when `ready` empties, would spin forever the moment `ready` ran dry with unadmitted arrivals still waiting — worth tracing through by hand.) The bug is invisible for exactly one kind of workload: every process arriving at time 0. With nothing left in `notArrivedYet` once the program starts, the one-time admission before the loop already captured everyone, and the missing per-slice check never had anything to do.
:::
::::
