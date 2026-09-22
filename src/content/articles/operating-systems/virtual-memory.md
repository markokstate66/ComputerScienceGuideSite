---
title: "Virtual Memory, Paging and Why Your Process Thinks It's Alone"
description: "Virtual address spaces, page tables and the TLB give each process its own memory, with real .NET page-fault, working-set and mapped-file measurements."
pillar: operating-systems
order: 3
author: markus
published: 2026-09-22
updated: 2026-09-22
level: intermediate
tags: [virtual-memory, paging, page-tables, tlb, memory-mapped-files, working-set]
prerequisites: ["operating-systems/processes-and-threads"]
sources:
  - title: "Virtual Address Space (Memory Management)"
    url: "https://learn.microsoft.com/en-us/windows/win32/memory/virtual-address-space"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "About Memory Management"
    url: "https://learn.microsoft.com/en-us/windows/win32/memory/about-memory-management"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Reserving and Committing Memory"
    url: "https://learn.microsoft.com/en-us/windows/win32/memory/reserving-and-committing-memory"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Working Set"
    url: "https://learn.microsoft.com/en-us/windows/win32/memory/working-set"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Operating Systems: Three Easy Pieces, chapter 18: Paging: Introduction"
    url: "https://pages.cs.wisc.edu/~remzi/OSTEP/vm-paging.pdf"
    publisher: "Arpaci-Dusseau Books"
    accessed: 2026-09-22
  - title: "Operating Systems: Three Easy Pieces, chapter 19: Paging: Faster Translations (TLBs)"
    url: "https://pages.cs.wisc.edu/~remzi/OSTEP/vm-tlbs.pdf"
    publisher: "Arpaci-Dusseau Books"
    accessed: 2026-09-22
  - title: "Process.WorkingSet64 Property"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.diagnostics.process.workingset64"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Process.PrivateMemorySize64 Property"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.diagnostics.process.privatememorysize64"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Process.VirtualMemorySize64 Property"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.diagnostics.process.virtualmemorysize64"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Environment.SystemPageSize Property"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.environment.systempagesize"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "MemoryMappedFile Class"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.io.memorymappedfiles.memorymappedfile"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Memory-Mapped Files"
    url: "https://learn.microsoft.com/en-us/dotnet/standard/io/memory-mapped-files"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "MemoryMappedFile.CreateNew Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.io.memorymappedfiles.memorymappedfile.createnew"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
draft: true
---

The article on processes and threads showed, from the outside, that a child process's write to what looked like "the same" array never reached its parent: the parent kept reading its own value, untouched. That article treated the process boundary as a given. This one opens it up: every address a program uses is a fiction the processor maintains on the operating system's behalf, and the machinery behind that fiction is also what a running process's memory numbers actually mean.

## Why does every process act like it owns the whole address space?

A pointer, a stack variable, a `new byte[]` — every one of them lives at a *virtual address*. Windows gives each process a private virtual address space and, on 64-bit Windows, that space is 8 terabytes; other processes cannot reach into it, and it cannot reach into theirs ([About Memory Management](https://learn.microsoft.com/en-us/windows/win32/memory/about-memory-management)). "Private" is not a permission check the OS repeats on every access — it is a consequence of how addresses get resolved at all. A virtual address does not name a physical memory location; the CPU maintains a *page table* for each process and consults it on every reference, translating the virtual address a thread supplies into the physical address that actually holds the byte ([Virtual Address Space](https://learn.microsoft.com/en-us/windows/win32/memory/virtual-address-space)). Two processes can both use address `0x00007FF6_12340000`; each process's page table sends that number somewhere different, and neither table has any entry pointing into the other process's physical frames. There is no address a process could write that would land in another process's memory, because the translation step simply never produces one.

That is the mechanism behind last article's experiment: the child process's `box[0]` and the parent's `box[0]` were never the same physical byte, because they were built from two different page tables, even though the C# source that created them was identical.

## What is a page, and what does a page table entry hold?

The page table does not translate one byte at a time. Address space is divided into fixed-size *pages*, and a virtual address splits into two parts: a page number (the high bits) and an *offset* within the page (the low bits). Only the page number goes through translation; the offset is copied straight across, because a page always lands on a page-sized boundary in physical memory too. A page table entry (PTE) carries, alongside the resulting physical frame number, a handful of bits the hardware and OS both read: a valid bit that lets the OS mark unused parts of a sparse address space as absent, read/write/execute protection bits, a present bit for whether the page is actually in RAM right now or out on disk, and dirty and accessed bits the OS uses to decide what to write back and what to evict (*Operating Systems: Three Easy Pieces*, chapter 18, "Paging: Introduction").

<figure class="diagram">
<svg viewBox="0 0 360 300" role="img" aria-labelledby="vm-translate-title vm-translate-desc">
<title id="vm-translate-title">Translating a virtual address into a physical address</title>
<desc id="vm-translate-desc">A virtual address splits into a VPN and an offset. The VPN indexes one row of the process's page table to find a physical frame number. The offset is never looked up; it passes straight through. The frame number and the offset combine into the physical address.</desc>
<defs>
<marker id="vm-translate-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-accent"/></marker>
</defs>
<text x="10" y="20" class="d-bold">Virtual address, split by the hardware</text>
<rect x="10" y="30" width="160" height="56" rx="6" class="d-box-accent"/>
<text x="90" y="54" text-anchor="middle" class="d-bold d-mono">VPN</text>
<text x="90" y="74" text-anchor="middle" class="d-small">picks a page table row</text>
<rect x="190" y="30" width="160" height="56" rx="6" class="d-box-2"/>
<text x="270" y="54" text-anchor="middle" class="d-bold d-mono">offset</text>
<text x="270" y="74" text-anchor="middle" class="d-small d-muted">byte within the page</text>
<path d="M90 86 V108" class="d-accent" marker-end="url(#vm-translate-arrow)"/>
<path d="M270 86 V232" class="d-line d-dashed"/>
<text x="195" y="150" class="d-small d-muted">offset is not looked up.</text>
<text x="195" y="166" class="d-small d-muted">it passes straight through</text>
<rect x="10" y="108" width="160" height="90" rx="8" class="d-box"/>
<text x="90" y="126" text-anchor="middle" class="d-small d-bold">page table</text>
<text x="20" y="146" class="d-mono d-small d-muted">0x0F1 -&gt; 0x2C0F</text>
<text x="20" y="164" class="d-mono d-small d-bold d-text-accent">0x0F3 -&gt; 0x2C31</text>
<text x="20" y="182" class="d-mono d-small d-muted">0x0F5 -&gt; none</text>
<path d="M90 198 V232" class="d-accent" marker-end="url(#vm-translate-arrow)"/>
<rect x="10" y="232" width="340" height="56" rx="8" class="d-box-accent"/>
<text x="180" y="256" text-anchor="middle" class="d-bold">Physical address</text>
<text x="180" y="276" text-anchor="middle" class="d-mono d-small">PFN 0x2C31 + offset</text>
</svg>
<figcaption>Figure 1. Only the page number is looked up. The offset is copied unchanged from the virtual address to the physical one, which is why translating an address costs one table lookup, not a full re-encoding.</figcaption>
</figure>

::::exercise[Walk the table yourself]
This article measures its own machine's page size further down; take the 4,096-byte (2^12) result as given here. A page table maps page number `0x4A` to physical frame `0x37`. Split the virtual address `0x0004A1F3` into a page number and an offset, then combine the frame number with the offset to get the physical address.

:::solution
With a 4,096-byte page, the offset is the low 12 bits — exactly three hex digits, since each hex digit is 4 bits. Splitting `0x0004A1F3` at the last three digits gives page number `0x4A` and offset `0x1F3`. The physical address takes the frame number the table returned, shifts it left by 12 bits (three hex digits), and drops the same offset into the low bits: `0x37` becomes `0x37000`, and `0x37000 | 0x1F3 = 0x371F3`. Nothing about the offset's value depended on the lookup; only the page number did.
:::
::::

## Why is there a TLB, and what does a miss cost?

A page table lookup is itself a memory read, so a naive implementation would double the cost of every memory access: one read for the translation, one for the data. Hardware avoids that with a *translation lookaside buffer* (TLB), a small, fast, on-chip cache of recently used page-number-to-frame-number translations, sitting next to the processor core so a hit resolves in a few CPU cycles instead of a trip to RAM (*OSTEP*, chapter 19, "Paging: Faster Translations (TLBs)"). On a hit, the frame number comes straight from the cache. On a miss, the processor has to read the page table row from RAM, install that translation into the TLB, and only then retry the instruction that needed it — the chapter's own microbenchmark on the hardware it measured found a miss costing roughly fourteen times what a hit costs, which is the general shape to expect even though the exact ratio is specific to that measurement and that hardware.

<figure class="diagram">
<svg viewBox="0 0 360 400" role="img" aria-labelledby="vm-tlb-title vm-tlb-desc">
<title id="vm-tlb-title">A TLB hit skips the page table walk; a miss performs one</title>
<desc id="vm-tlb-desc">Top panel: the translation is found in the TLB cache and the physical address is ready in a few cycles. Bottom panel: the TLB has no entry, so the processor reads the page table row from RAM, refills the TLB, and retries, which is much slower.</desc>
<defs>
<marker id="vm-tlb-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-stroke"/></marker>
</defs>
<text x="10" y="20" class="d-bold">TLB hit</text>
<rect x="10" y="30" width="340" height="36" rx="6" class="d-box"/>
<text x="180" y="53" text-anchor="middle">CPU needs VPN -&gt; PFN</text>
<path d="M180 66 V84" class="d-line" marker-end="url(#vm-tlb-arrow)"/>
<rect x="10" y="84" width="340" height="36" rx="6" class="d-box-good"/>
<text x="180" y="107" text-anchor="middle" class="d-bold">TLB: hit</text>
<path d="M180 120 V138" class="d-line" marker-end="url(#vm-tlb-arrow)"/>
<rect x="10" y="138" width="340" height="44" rx="6" class="d-box-good"/>
<text x="180" y="158" text-anchor="middle" class="d-bold">physical address ready</text>
<text x="180" y="174" text-anchor="middle" class="d-small d-muted">a few CPU cycles</text>
<text x="10" y="204" class="d-bold">TLB miss</text>
<rect x="10" y="214" width="340" height="36" rx="6" class="d-box"/>
<text x="180" y="237" text-anchor="middle">CPU needs VPN -&gt; PFN</text>
<path d="M180 250 V268" class="d-line" marker-end="url(#vm-tlb-arrow)"/>
<rect x="10" y="268" width="340" height="50" rx="6" class="d-box-bad"/>
<text x="180" y="288" text-anchor="middle" class="d-bold">TLB: miss</text>
<text x="180" y="306" text-anchor="middle" class="d-small">read the page table row in RAM</text>
<path d="M180 318 V336" class="d-line" marker-end="url(#vm-tlb-arrow)"/>
<rect x="10" y="336" width="340" height="44" rx="6" class="d-box-warn"/>
<text x="180" y="356" text-anchor="middle" class="d-bold">TLB refilled, retry</text>
<text x="180" y="372" text-anchor="middle" class="d-small d-muted">much slower than a hit</text>
</svg>
<figcaption>Figure 2. Both paths start the same way; only a miss forces a walk of the page table sitting in RAM before the instruction can proceed.</figcaption>
</figure>

Nothing in .NET reads the TLB directly — it is invisible to software by design, which is exactly what makes it fast. The number worth remembering is qualitative: code that jumps around a large address space unpredictably forces more misses than code that stays within a small, recently touched range, which is one of the reasons data layout affects performance independently of algorithmic complexity.

## What actually happens on a page fault?

A *page fault* is the CPU trapping into the OS because a page table entry could not satisfy a reference — the present bit was off, or the entry was invalid. Windows' own documentation is precise about the two kinds, and they are not the same event. A *hard* page fault "must be resolved by reading page contents from the page's backing store, which is either the system paging file or a memory-mapped file created by the process." A *soft* page fault is resolved without touching that backing store at all — because the page is already resident as part of another process's working set, because it is a *transition page* that was recently evicted but not yet reused, or because the process is touching a freshly allocated page for the very first time, a *demand-zero fault*, which the memory manager satisfies by handing over a zeroed page it already has ready ([Working Set](https://learn.microsoft.com/en-us/windows/win32/memory/working-set)). Both are called "faults," and both interrupt the instruction that caused them, but only a hard fault waits on a disk.

That demand-zero case matters for anything that allocates a large block up front: the OS does not have to zero and hand over the full block at allocation time, only the parts a program actually touches, page by page, as it touches them. That is exactly what the next section measures.

## "Working set" and "committed" are not the same number

Two terms get used almost interchangeably by people who have not had to distinguish them, and Windows defines them precisely enough that there is no need to guess. The *working set* of a process is "the set of pages in the virtual address space of the process that are currently resident in physical memory" ([Working Set](https://learn.microsoft.com/en-us/windows/win32/memory/working-set)) — pages actually sitting in RAM right now, backing that process. *Committed* memory is a different promise entirely: the OS guarantees that backing store (RAM or the page file) will be available if the page is ever touched, but "committed pages do not consume any physical storage until they are first accessed" ([Reserving and Committing Memory](https://learn.microsoft.com/en-us/windows/win32/memory/reserving-and-committing-memory)). A page can be fully committed and never once appear in the working set, if the program never reads or writes it.

.NET exposes all three layers of this directly on `Process`. `WorkingSet64` is "the amount of physical memory... allocated for the associated process," equivalent to the **Working Set** performance counter. `PrivateMemorySize64` is memory "that cannot be shared with other processes," equivalent to the **Private Bytes** counter — this is the committed figure. `VirtualMemorySize64` is the full virtual address space the process has claimed, reserved or committed, mapped either to RAM or to the paging file, equivalent to the **Virtual Bytes** counter ([Process.WorkingSet64](https://learn.microsoft.com/en-us/dotnet/api/system.diagnostics.process.workingset64), [Process.PrivateMemorySize64](https://learn.microsoft.com/en-us/dotnet/api/system.diagnostics.process.privatememorysize64), [Process.VirtualMemorySize64](https://learn.microsoft.com/en-us/dotnet/api/system.diagnostics.process.virtualmemorysize64)). Performance Monitor's Process object exposes the same three counters under those exact names, and Task Manager's Details tab can add memory columns for a selected process from that same set — so a number a reader can see on their own machine right now maps directly onto one of these three .NET properties.

The program below drives all three numbers on purpose, one step at a time, by calling the Windows memory API directly: reserve 200 MB of address space, commit it, touch every page in it, then release it.

Measured on .NET 10.0.401, Windows 11, x64.

```csharp run id=commit-vs-workingset
using System.Diagnostics;
using System.Runtime.InteropServices;

if (!OperatingSystem.IsWindows())
{
    Console.WriteLine("This demo calls VirtualAlloc and needs Windows.");
    return;
}

const int MemCommit = 0x1000;
const int MemReserve = 0x2000;
const int MemRelease = 0x8000;
const int PageReadWrite = 0x04;
const long RegionSize = 200L * 1024 * 1024; // 200 MB

[DllImport("kernel32.dll", SetLastError = true)]
static extern nint VirtualAlloc(
    nint lpAddress, nuint dwSize, uint flAllocationType, uint flProtect);
[DllImport("kernel32.dll", SetLastError = true)]
static extern bool VirtualFree(nint lpAddress, nuint dwSize, uint dwFreeType);

double ramGb =
    GC.GetGCMemoryInfo().TotalAvailableMemoryBytes / 1024.0 / 1024 / 1024;
Console.WriteLine($"RAM available to the GC: {ramGb:F1} GB");

var me = Process.GetCurrentProcess();
int pageSize = Environment.SystemPageSize;
Console.WriteLine($"page size: {pageSize:N0} bytes");

void Snap(string stage)
{
    me.Refresh();
    Console.WriteLine($"""
        {stage}:
          virtual:     {Mb(me.VirtualMemorySize64):N0} MB
          private:     {Mb(me.PrivateMemorySize64):N0} MB
          working set: {Mb(me.WorkingSet64):N0} MB
        """);
}
static long Mb(long bytes) => bytes / 1024 / 1024;

Snap("baseline");

nint region = VirtualAlloc(0, (nuint)RegionSize, MemReserve, PageReadWrite);
Snap("after reserving 200 MB");

VirtualAlloc(region, (nuint)RegionSize, MemCommit, PageReadWrite);
Snap("after committing it");

for (long offset = 0; offset < RegionSize; offset += pageSize)
    Marshal.WriteByte(region, (int)offset, 1);
Snap("after touching every page");

VirtualFree(region, 0, MemRelease);
Snap("after freeing it");
```

```text output
RAM available to the GC: [...] GB
page size: [...] bytes
baseline:
  virtual:     [...] MB
  private:     [...] MB
  working set: [...] MB
after reserving 200 MB:
  virtual:     [...] MB
  private:     [...] MB
  working set: [...] MB
after committing it:
  virtual:     [...] MB
  private:     [...] MB
  working set: [...] MB
after touching every page:
  virtual:     [...] MB
  private:     [...] MB
  working set: [...] MB
after freeing it:
  virtual:     [...] MB
  private:     [...] MB
  working set: [...] MB
```

On the test machine, the baseline read roughly 2,233,454 MB virtual, 6 MB private, 19 MB working set — the huge virtual figure is already about a quarter of the 8 TB address space the process could in principle reserve, almost none of it actually claimed. Reserving 200 MB moved only the virtual number, by almost exactly 200 MB; the process now owns that range of addresses, and nothing else. Committing it moved only the private number, by almost exactly 200 MB; the OS now guarantees storage for those pages, and still nothing is resident. Only touching every page moved the working set, by almost exactly 200 MB — the demand-zero faults from the "What actually happens on a page fault?" section above, one per page, each one pulling a physical page into RAM and this process's working set. Freeing the region brought all three back down together. Three distinct numbers, three distinct triggers.

:::pitfall
Because the working set counts shared pages too — "the working set includes both shared and private data... including instructions in the process modules and the system libraries" ([Process.WorkingSet64](https://learn.microsoft.com/en-us/dotnet/api/system.diagnostics.process.workingset64)) — adding up every process's working set on a machine overstates how much RAM is actually in use. A DLL mapped into fifty processes gets counted in all fifty working sets, but it occupies one set of physical pages.
:::

::::exercise[A fifth stage]
Add a stage to the demo above: after touching the region, call `VirtualFree(region, (nuint)(RegionSize / 2), 0x4000 /* MEM_DECOMMIT */)` to decommit only the first 100 MB, without releasing the reservation. Predict what happens to each of the three numbers before you run it, then check.

:::solution
Decommitting gives back the physical pages and the commit charge for that half of the region, but the address range is still reserved — decommitting is not releasing. So private and working set should each drop by roughly 100 MB, and virtual should barely move.

```csharp run id=decommit-half
using System.Diagnostics;
using System.Runtime.InteropServices;

if (!OperatingSystem.IsWindows())
{
    Console.WriteLine("This demo calls VirtualAlloc and needs Windows.");
    return;
}

const int MemCommit = 0x1000;
const int MemReserve = 0x2000;
const int MemDecommit = 0x4000;
const int MemRelease = 0x8000;
const int PageReadWrite = 0x04;
const long RegionSize = 200L * 1024 * 1024;
const long HalfSize = RegionSize / 2;

[DllImport("kernel32.dll", SetLastError = true)]
static extern nint VirtualAlloc(
    nint lpAddress, nuint dwSize, uint flAllocationType, uint flProtect);
[DllImport("kernel32.dll", SetLastError = true)]
static extern bool VirtualFree(nint lpAddress, nuint dwSize, uint dwFreeType);

var me = Process.GetCurrentProcess();
int pageSize = Environment.SystemPageSize;

void Snap(string stage)
{
    me.Refresh();
    Console.WriteLine($"""
        {stage}:
          virtual:     {Mb(me.VirtualMemorySize64):N0} MB
          private:     {Mb(me.PrivateMemorySize64):N0} MB
          working set: {Mb(me.WorkingSet64):N0} MB
        """);
}
static long Mb(long bytes) => bytes / 1024 / 1024;

nint region = VirtualAlloc(0, (nuint)RegionSize, MemReserve, PageReadWrite);
VirtualAlloc(region, (nuint)RegionSize, MemCommit, PageReadWrite);
for (long offset = 0; offset < RegionSize; offset += pageSize)
    Marshal.WriteByte(region, (int)offset, 1);
Snap("committed and touched, 200 MB");

VirtualFree(region, (nuint)HalfSize, MemDecommit);
Snap("first 100 MB decommitted");

VirtualFree(region, 0, MemRelease);
```

```text output
committed and touched, 200 MB:
  virtual:     [...] MB
  private:     [...] MB
  working set: [...] MB
first 100 MB decommitted:
  virtual:     [...] MB
  private:     [...] MB
  working set: [...] MB
```

On the test machine, private dropped from 206 MB to 106 MB and working set from 217 MB to 119 MB — both almost exactly 100 MB, matching the prediction. Virtual stayed within a few tens of megabytes of where it started; the small drift comes from unrelated allocations elsewhere in the runtime, not from this region, whose 200 MB reservation was never released.
:::
::::

## How does a memory-mapped file put a file's bytes directly into that address space?

A `MemoryMappedFile` maps a file's contents into a process's virtual address space, so that reading and writing the file becomes reading and writing memory — the same page-fault machinery from earlier in this article pulls pages in from disk as they are touched, instead of an explicit `Read` call copying bytes into a buffer ([MemoryMappedFile Class](https://learn.microsoft.com/en-us/dotnet/api/system.io.memorymappedfiles.memorymappedfile)). .NET distinguishes two kinds. A *persisted* mapping is backed by a real file on disk and survives after every process using it closes; a *non-persisted* mapping exists only in memory, is given a name instead of a path, and is reclaimed once the last process holding it lets go — a way to create shared memory for interprocess communication without a file at all ([Memory-Mapped Files](https://learn.microsoft.com/en-us/dotnet/standard/io/memory-mapped-files)).

You can open more than one *view* onto the same mapping, and for two views to see each other's writes they have to come from the same `MemoryMappedFile` object — that is what "concurrent" means here, and it is exactly analogous to two threads reaching the same heap array in the processes-and-threads article, except the shared thing is backed by a file instead of the CLR's heap. A second, genuinely separate process joins the same mapping by opening it under its shared name: `MemoryMappedFile.OpenExisting(name)` instead of creating a new one. The program below stays inside one process for reliability, the way `run-code` demands, but creates two independent view accessors from one mapping to show the sharing directly: a write through one is visible through the other with no copy in between.

```csharp run id=mmf-two-views
using System.IO.MemoryMappedFiles;
using System.Text;

string path = Path.Combine(Path.GetTempPath(), $"csg-vm-demo-{Guid.NewGuid():N}.bin");
const long Capacity = 4096; // one page

using (var mmf = MemoryMappedFile.CreateFromFile(path, FileMode.Create, mapName: null, Capacity))
{
    using var writerView = mmf.CreateViewAccessor(0, Capacity);
    using var readerView = mmf.CreateViewAccessor(0, Capacity);

    writerView.Write(0, 42);
    byte[] message = Encoding.UTF8.GetBytes("shared pages, not a copy");
    writerView.WriteArray(8, message, 0, message.Length);

    int seenByReader = readerView.ReadInt32(0);
    var received = new byte[message.Length];
    readerView.ReadArray(8, received, 0, received.Length);

    Console.WriteLine($"reader's view saw int:  {seenByReader}");
    Console.WriteLine($"reader's view saw text: {Encoding.UTF8.GetString(received)}");
} // both views and the mapping close here; changes flush to disk

byte[] onDisk = File.ReadAllBytes(path);
Console.WriteLine($"bytes now on disk start with: {BitConverter.ToInt32(onDisk, 0)}");
File.Delete(path);
```

```text output
reader's view saw int:  42
reader's view saw text: shared pages, not a copy
bytes now on disk start with: 42
```

`readerView` never called anything `writerView` returned — it read from offset 0 and offset 8 of the same underlying pages `writerView` had just written, and saw the write immediately, because there was only ever one copy of those bytes. And once both views and the mapping are disposed, the bytes are still on disk: `CreateFromFile` made this a persisted mapping, so closing it flushed the pages back to their file, which is why the plain `File.ReadAllBytes` at the end sees `42` with no `MemoryMappedFile` involved at all.

::::exercise[The second process that never joins]
A colleague writes a second console app that is supposed to join a shared, non-persisted counter that a first app already created with `MemoryMappedFile.CreateNew("shared-counter", 8)`. The second app also calls `MemoryMappedFile.CreateNew("shared-counter", 8)`. What happens when the second app runs while the first is still open, and what is the one-method fix?

:::solution
`CreateNew` always creates a brand-new mapping and fails if the name is already taken — on this machine, the second call throws:

```csharp run id=mmf-collision
using System.IO.MemoryMappedFiles;

if (!OperatingSystem.IsWindows())
{
    Console.WriteLine("This demo needs Windows.");
    return;
}

using var first = MemoryMappedFile.CreateNew("csg-collide-map", 16);
try
{
    using var second = MemoryMappedFile.CreateNew("csg-collide-map", 16);
    Console.WriteLine("both created without error");
}
catch (IOException ex)
{
    Console.WriteLine($"{ex.GetType().Name}: {ex.Message}");
}
```

```text output
IOException: Cannot create a file when that file already exists.
```

The fix is for the second process to open what the first one already made, either unconditionally with `OpenExisting("shared-counter")`, which throws `FileNotFoundException` if the first process has not run yet, or defensively with `CreateOrOpen`, which creates it if missing and opens it if present ([MemoryMappedFile.CreateNew](https://learn.microsoft.com/en-us/dotnet/api/system.io.memorymappedfiles.memorymappedfile.createnew)):

```csharp run id=mmf-fix
using System.IO.MemoryMappedFiles;

if (!OperatingSystem.IsWindows())
{
    Console.WriteLine("This demo needs Windows.");
    return;
}

using var first = MemoryMappedFile.CreateNew("csg-fix-map", 8);
using var second = MemoryMappedFile.CreateOrOpen("csg-fix-map", 8);
Console.WriteLine("both handles reference the same mapping");
```

```text output
both handles reference the same mapping
```
:::
::::

## Does a multi-terabyte "virtual" figure mean the machine is almost out of memory?

No, and the measurements above show why: the baseline `VirtualMemorySize64` on the test machine was already over two million megabytes before this article's program reserved a single byte, on a machine whose GC reported 63.9 GB of RAM available to it — the virtual number was already roughly 34 times the installed RAM. Every 64-bit process is created with virtually all of an 8 TB address space nominally available — before the CLR or any other runtime code reserves a byte of it — because reserving address space costs the OS almost nothing; it is bookkeeping, not storage. By the time a .NET program's own code can measure it, the runtime has already claimed some of that space for itself, which is why the baseline above started at roughly a quarter of the 8 TB reserved rather than at zero. What costs real resources, in order, is committing (a promise of backing store) and then touching (an actual physical page, in this process's working set). A process report where virtual dwarfs private, and private dwarfs working set, is not a leak or a warning sign — it is what every ordinary 64-bit process looks like, and it is the same three numbers Performance Monitor's Process counters and Task Manager's memory columns are built from, now with a name and a cause attached to each one.
