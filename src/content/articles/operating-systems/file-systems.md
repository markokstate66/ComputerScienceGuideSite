---
title: "File Systems: From Bytes on Disk to Files and Folders"
description: "How ext4 inodes and NTFS's MFT map a file to disk blocks, why filesystems journal, and what FileStream.Flush and File.WriteAllText really guarantee in C#."
pillar: operating-systems
order: 5
author: markus
published: 2026-09-22
updated: 2026-09-22
level: intermediate
tags: [file-systems, inodes, ntfs, journaling, fsync, durability]
prerequisites: ["operating-systems/virtual-memory"]
sources:
  - title: "Master File Table (Local File Systems)"
    url: "https://learn.microsoft.com/en-us/windows/win32/fileio/master-file-table"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "NTFS overview"
    url: "https://learn.microsoft.com/en-us/windows-server/storage/file-server/ntfs-overview"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "FileStream.Flush Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.io.filestream.flush"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "File.WriteAllText Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.io.file.writealltext"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "FileOptions Enum"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.io.fileoptions"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "FileMode Enum"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.io.filemode"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "File.Move Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.io.file.move"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "File.Replace Method"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.io.file.replace"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "FlushFileBuffers function (fileapi.h)"
    url: "https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-flushfilebuffers"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "File.cs (System.Private.CoreLib), WriteToFile helper"
    url: "https://github.com/dotnet/runtime/blob/main/src/libraries/System.Private.CoreLib/src/System/IO/File.cs"
    publisher: "dotnet/runtime on GitHub"
    accessed: 2026-09-22
  - title: "ext4 Data Structures and Algorithms: Overview"
    url: "https://docs.kernel.org/filesystems/ext4/overview.html"
    publisher: "The Linux Kernel documentation"
    accessed: 2026-09-22
  - title: "ext4 Data Structures and Algorithms: Block Groups"
    url: "https://docs.kernel.org/filesystems/ext4/blockgroup.html"
    publisher: "The Linux Kernel documentation"
    accessed: 2026-09-22
  - title: "ext4 Data Structures and Algorithms: The Journal (jbd2)"
    url: "https://docs.kernel.org/filesystems/ext4/journal.html"
    publisher: "The Linux Kernel documentation"
    accessed: 2026-09-22
  - title: "ext4 Data Structures and Algorithms: Directory Entries"
    url: "https://docs.kernel.org/filesystems/ext4/directory.html"
    publisher: "The Linux Kernel documentation"
    accessed: 2026-09-22
  - title: "ext4 Data Structures and Algorithms: Index Nodes / Extent Trees"
    url: "https://docs.kernel.org/filesystems/ext4/ifork.html"
    publisher: "The Linux Kernel documentation"
    accessed: 2026-09-22
  - title: "fsync(2) - Linux manual page"
    url: "https://man7.org/linux/man-pages/man2/fsync.2.html"
    publisher: "Linux man-pages"
    accessed: 2026-09-22
  - title: "rename(2) - Linux manual page"
    url: "https://man7.org/linux/man-pages/man2/rename.2.html"
    publisher: "Linux man-pages"
    accessed: 2026-09-22
  - title: "Operating Systems: Three Easy Pieces, chapter 42: Crash Consistency: FSCK and Journaling"
    url: "https://pages.cs.wisc.edu/~remzi/OSTEP/file-journaling.pdf"
    publisher: "Arpaci-Dusseau Books"
    accessed: 2026-09-22
draft: false
---

The [virtual-memory article](/operating-systems/virtual-memory/)'s memory-mapped-file section stopped at the boundary where a page fault pulls a file's bytes into a process's address space; it never asked what a file actually is on the other side of that fault, or what has to happen for a byte a program just wrote to still be there after the machine restarts. This article starts on the disk side of that boundary and ends at the two C# calls application code actually has for crossing it: `FileStream.Flush` and a file rename.

## Why doesn't a filesystem track individual bytes on disk?

A disk volume is addressed in fixed-size units, not bytes. NTFS calls its unit a *cluster* — 4 KB by default on most modern volumes, though the size is chosen when the volume is formatted and scales up on very large volumes ("NTFS overview"). ext4 groups the volume into *block groups* and allocates space within them in fixed-size *blocks*, and its own documentation notes that the allocator "tries very hard to keep each file's blocks within the same group" to limit fragmentation ("ext4 Data Structures and Algorithms: Overview"). Either way, the filesystem's job is to track, for each file, *which* of these fixed-size units hold its bytes — never an individual byte's own address. A one-byte file and a 4,000-byte file can occupy exactly the same one cluster; the filesystem does not economize below block granularity.

That single design choice is why the rest of this article has three separate questions to answer: how a filesystem finds the list of blocks that belong to one file, how it turns a name a person typed into that same file, and what has to happen, in what order, for a change to that bookkeeping to survive a crash.

## How does a file's inode or MFT record point to its data blocks?

Both filesystems this article covers keep one fixed-size bookkeeping record per file, separate from the file's actual bytes, and both records end in the same kind of thing: a short list of block numbers.

### ext4: an inode number indexes a table, and an extent covers a run of blocks

Every ext4 file has an *inode number*, and every block group reserves a slice of disk for that number to index into: the group's inode table, whose location the block group descriptor records in a field the documentation describes as "a continuous range of blocks large enough to contain `sb.s_inodes_per_group * sb.s_inode_size` bytes" ("ext4 Data Structures and Algorithms: Block Groups"). The inode holds standard bookkeeping — size, permissions, timestamps — and, critically, `i_block`, a field that is either an old-style block map or, on any modern ext4 filesystem, the root of an *extent tree*. An extent is a single, compact record — `struct ext4_extent`, with a starting logical block, a length, and a starting physical block — that covers a whole run of contiguous blocks at once: "allocating a contiguous run of 1,000 blocks requires an indirect block to map all 1,000 entries; with extents, the mapping is reduced to a single `struct ext4_extent` with `ee_len = 1000`" ("ext4 Data Structures and Algorithms: Index Nodes / Extent Trees"). Four such extents fit directly inside the inode's own `i_block` field; a file fragmented into more runs than that grows the tree into extra blocks the inode points to, which is why a badly fragmented file costs more than one extra disk read to open.

### NTFS: everything about a file lives in its MFT record

NTFS keeps one *Master File Table* (MFT), and "there is at least one entry in the MFT for every file on an NTFS file system volume, including the MFT itself." The same page is explicit about where a file's content lives relative to that entry: "All information about a file, including its size, time and date stamps, permissions, and data content, is stored either in MFT entries, or in space outside the MFT that is described by MFT entries" ("Master File Table (Local File Systems)"). A very small file's bytes can sit inside its own MFT record; anything larger is described by that record the same way an ext4 extent describes a run of blocks — a compact pointer to space outside the record, not a copy of the bytes themselves.

<figure class="diagram">
<svg viewBox="0 0 360 245" role="img" aria-labelledby="rec-title rec-desc">
<title id="rec-title">A file record's fields end in a list of block numbers, not file content</title>
<desc id="rec-desc">A box for the file record holds its size, timestamps and permissions, plus a short list of block numbers. Three data blocks sit below it, each holding part of the file's actual bytes, and an arrow connects the record's block list down to them.</desc>
<defs>
<marker id="rec-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-accent"/></marker>
</defs>
<rect x="10" y="10" width="340" height="120" rx="8" class="d-box-accent"/>
<text x="180" y="32" text-anchor="middle" class="d-bold">file record</text>
<text x="180" y="48" text-anchor="middle" class="d-small d-muted">ext4: an inode &#183; NTFS: an MFT record</text>
<text x="24" y="70" class="d-mono d-small">size, timestamps, permissions</text>
<text x="24" y="90" class="d-mono d-small d-bold">block list: 900, 901, 902</text>
<text x="24" y="110" class="d-small d-muted">an extent in ext4, a data run in NTFS</text>
<path d="M180 130 V162" class="d-accent" marker-end="url(#rec-arrow)"/>
<rect x="10" y="162" width="105" height="60" rx="6" class="d-box"/>
<text x="62" y="197" text-anchor="middle" class="d-mono">block 900</text>
<rect x="127" y="162" width="105" height="60" rx="6" class="d-box"/>
<text x="180" y="197" text-anchor="middle" class="d-mono">block 901</text>
<rect x="245" y="162" width="105" height="60" rx="6" class="d-box"/>
<text x="298" y="197" text-anchor="middle" class="d-mono">block 902</text>
</svg>
<figcaption>Figure 1. Beyond a tiny file whose bytes fit inside its own MFT record, the record holds no file content — only bookkeeping and a list of block numbers, an extent in ext4 or a data run in NTFS. Following that list is the only way from a file to its bytes.</figcaption>
</figure>

This machine runs Windows, so the NTFS claims above and the C# claims later in this article are things this machine can and does check directly; the ext4 claims are read from Linux's own kernel documentation, not run or verified on this machine.

## How does a directory turn a name into a file?

A directory is not a special kind of container the filesystem understands semantically — it is an ordinary file whose bytes happen to encode a lookup table. ext4's own documentation says it plainly: a directory is "a flat file that maps an arbitrary byte string (usually ASCII) to an inode number on the filesystem" ("ext4 Data Structures and Algorithms: Directory Entries"). Concretely, each entry (`struct ext4_dir_entry_2`) is a small record with a length, a name, and one four-byte field, `inode`, described as the "number of the inode that this directory entry points to." Looking up `notes.txt` means reading the directory file's own blocks, scanning its entries for one whose name matches, and reading off that one field.

NTFS's directories work the same way at the level that matters here: a directory's MFT record holds an index of names, and each index entry carries the MFT record number of the file it names, the same relationship an ext4 directory entry has to an inode number. Neither structure stores a file's *path* anywhere; a path is just the sequence of name lookups a program (or the OS) performs one directory at a time to get from a volume's root to a target file's record number.

One consequence is worth stating because it explains a common surprise: renaming a file, or moving it to a different directory on the *same volume*, never has to touch the file's block list, size or content — those live in the file's own record, which does not move. That is also why the pattern later in this article can rely on a rename being cheap, as long as the temporary file and the target it replaces sit on the same volume.

## What breaks if the system crashes mid-update, and how does a journal fix it?

A single filesystem operation a program thinks of as one step is usually several separate writes underneath. Creating a file writes a new directory entry *and* allocates and initializes an inode or MFT record. Appending to a file writes the new data block(s), updates the record's block list, *and* updates the record's size. If the machine loses power after the first of these writes reaches disk but before the rest do, the on-disk structures are left in a state no sequence of legal operations would ever produce — a directory entry pointing at an inode that was never initialized, or a record claiming a block that some other file also claims. Older filesystems found this out the hard way, with a repair tool that scanned a volume's own metadata after every unclean shutdown, looking for exactly these inconsistencies before the volume could be trusted again — `fsck` on Unix systems (OSTEP's chapter on this contrasts it directly with journaling: "Operating Systems: Three Easy Pieces, chapter 42: Crash Consistency: FSCK and Journaling"), and the same kind of repair NTFS's own `chkdsk` still performs when a volume needs more than its log file can fix on its own ("NTFS overview").

Both ext4 and NTFS avoid that scan with a *journal*: before touching the real inode table, MFT or directory blocks, the filesystem writes down what it is *about* to do, then writes a single *commit* record marking that description as final, and only then makes the real changes. ext4's documentation states the purpose directly — "the ext4 filesystem employs a journal to protect the filesystem against metadata inconsistencies in the case of a system crash" — and its recovery guarantee: "should the system crash during the second slow write, the journal can be replayed all the way to the latest commit record, guaranteeing the atomicity of whatever gets written through the journal to the disk" ("ext4 Data Structures and Algorithms: The Journal (jbd2)"). NTFS documents the same shape of guarantee in its own terms: "NTFS enhances reliability by maintaining a transaction-based log file and checkpoint information. If a system failure occurs, NTFS uses this log to automatically restore file system consistency during the next startup" ("NTFS overview"). Neither page promises this for a file's *data* — only for the filesystem's own bookkeeping, which is exactly the gap the rest of this article is about.

<figure class="diagram">
<svg viewBox="0 0 360 350" role="img" aria-labelledby="journal-title journal-desc">
<title id="journal-title">Write-ahead journaling: the journal is written and committed before anything else changes</title>
<desc id="journal-desc">Four steps stacked top to bottom: write the change to the journal, write a commit record, apply the change to its real location, then reclaim the journal space. A crash before the commit record leaves nothing to replay. A crash any time after it is repaired by replaying the journal at the next mount.</desc>
<defs>
<marker id="journal-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-stroke"/></marker>
</defs>
<rect x="10" y="16" width="340" height="56" rx="6" class="d-box"/>
<text x="180" y="38" text-anchor="middle" class="d-small">1. Write the change to the journal</text>
<text x="180" y="56" text-anchor="middle" class="d-small d-muted">not applied to its real location yet</text>
<path d="M180 72 V108" class="d-line" marker-end="url(#journal-arrow)"/>
<text x="180" y="94" text-anchor="middle" class="d-small d-muted">crash before this: nothing to replay</text>
<rect x="10" y="108" width="340" height="56" rx="6" class="d-box-accent"/>
<text x="180" y="130" text-anchor="middle" class="d-bold d-small">2. Write a commit record</text>
<text x="180" y="148" text-anchor="middle" class="d-small">the transaction is now durable</text>
<path d="M180 164 V200" class="d-line" marker-end="url(#journal-arrow)"/>
<text x="180" y="186" text-anchor="middle" class="d-small d-muted">crash after this: journal replays it</text>
<rect x="10" y="200" width="340" height="56" rx="6" class="d-box"/>
<text x="180" y="222" text-anchor="middle" class="d-small">3. Apply the change to its real location</text>
<text x="180" y="240" text-anchor="middle" class="d-small d-muted">the checkpoint</text>
<path d="M180 256 V276" class="d-line" marker-end="url(#journal-arrow)"/>
<rect x="10" y="276" width="340" height="56" rx="6" class="d-box-2"/>
<text x="180" y="298" text-anchor="middle" class="d-small">4. Reclaim the journal space</text>
<text x="180" y="316" text-anchor="middle" class="d-small d-muted">once every older transaction is checkpointed</text>
</svg>
<figcaption>Figure 2. A crash before the commit record (step 2) leaves the journal entry incomplete and ignored; any crash from that point on is repaired by replaying the journal up to its last commit record at the next mount.</figcaption>
</figure>

The same write-first-commit-second shape shows up one layer up the stack, in a database engine's own [write-ahead logging](/databases/transactions-and-acid/#how-does-write-ahead-logging-change-durability-and-concurrency): a record of a change reaches stable storage and is marked committed before the engine reports success, for exactly the same crash-consistency reason.

::::exercise[What "ordered" actually promises]
ext4's documentation says its default `data=ordered` mode "only writes filesystem metadata through the journal," and that under it "file data blocks are *not* guaranteed to be in any consistent state after a crash" ("ext4 Data Structures and Algorithms: The Journal (jbd2)"). A program appends 100 bytes to a file: ext4 allocates a new block, writes the 100 bytes into it, and updates the inode's extent tree to reference that block as part of the file — a metadata change. The machine crashes partway through this sequence. After the journal replays on the next mount, which of these two claims can you actually rely on: (a) the inode's replayed state is internally consistent — no block claimed by two files, no directory entry pointing at a deleted inode — or (b) the 100 new bytes are recoverable? Say which, and what it would take to get a guarantee about the other one.

:::solution
(a). The journal covers metadata, so replay restores a consistent set of inodes, extents and directory entries. It says nothing about (b): the documentation is explicit that under the default mode, file data blocks are not guaranteed consistent after a crash, so whether those 100 bytes survive depends on whether the data block itself reached disk before the crash — a fact the metadata journal does not track. A guarantee about (b) needs either `data=journal` mode, which journals data too at a real performance cost, or an application-level durability step for the data write itself, which is exactly what the rest of this article covers.
:::
::::

## What does `FileStream.Flush()` actually force to disk?

Everything from here on is something this machine, running .NET 10.0.401 on Windows 11 x64, actually ran — not a claim about ext4 or NTFS internals, but about what a C# program can observe through the .NET file APIs. `FileStream` has two `Flush` overloads, and their documentation draws a real line between them. The parameterless `Flush()` "clears buffers for this stream and causes any buffered data to be written to the file," and its remarks add that "the operating system I/O buffer is also flushed" — meaning .NET's own managed buffer is emptied *into* the OS. `Flush(bool flushToDisk)` goes one step further: passing `true` "clears all intermediate file buffers," and Microsoft's guidance is to "use this overload when you want to ensure that all buffered data in intermediate file buffers is written to disk" ("FileStream.Flush Method"). On Windows, that call reaches `FlushFileBuffers`, documented as writing "all the buffered information for a specified file to the device" ("FlushFileBuffers function (fileapi.h)").

The program below makes that two-stage gap visible by opening a *second*, independent handle onto the same file and asking, at each stage, how many bytes it can see:

```csharp run id=flush-stages
using System.Text;

string path = Path.Combine(Path.GetTempPath(), $"csg-flush-demo-{Guid.NewGuid():N}.txt");
byte[] data = Encoding.UTF8.GetBytes("hello, durable world");
Console.WriteLine($"data length: {data.Length}");

var writer = new FileStream(path, FileMode.Create, FileAccess.Write, FileShare.Read, bufferSize: 65536);
writer.Write(data);

int Peek()
{
    using var reader = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
    return reader.Read(new byte[256]);
}

Console.WriteLine($"before Flush(): {Peek()} bytes visible through a second handle");
writer.Flush();
Console.WriteLine($"after Flush():  {Peek()} bytes visible through a second handle");
writer.Flush(true);
Console.WriteLine("Flush(true) returned normally");

writer.Dispose();
File.Delete(path);
```

```text output
data length: 20
before Flush(): 0 bytes visible through a second handle
after Flush():  20 bytes visible through a second handle
Flush(true) returned normally
```

The 65,536-byte buffer is large enough that a 20-byte write never leaves `FileStream`'s own managed buffer, so a second handle opened before `Flush()` sees a file with nothing readable in it — not corrupted, just genuinely empty from the OS's point of view, because .NET has not handed those bytes to the operating system yet. `Flush()` hands them over, and the second handle immediately sees all 20 bytes: that visibility is the OS cache doing its normal job of keeping every handle on one machine looking at the same data, and it is not evidence of anything reaching a physical disk. `Flush(true)` runs without throwing, which is as far as a running program can verify its own claim: nothing short of pulling the plug and checking what is on disk afterward can confirm `FlushFileBuffers` did what its documentation says, and this article does not have a way to do that safely or repeatably.

There is also a way to ask for the `Flush(true)` step on every single write instead of calling it explicitly: opening the `FileStream` with `FileOptions.WriteThrough`, documented as indicating "that the system should write through any intermediate cache and go directly to disk" ("FileOptions Enum"). That trades away exactly the batching a large buffer exists to provide — every write pays the disk-flush cost the demo above shows happens once, at the end, with `Flush(true)` — so it fits a handful of small, latency-tolerant writes far better than the kind of bulk write `FileStream`'s own buffering is built for.

## What does `File.WriteAllText` guarantee — and where's the gap?

`File.WriteAllText`'s own documentation says only that it "creates a new file, writes the specified string to the file, and then closes the file. If the target file already exists, it is truncated and overwritten" ("File.WriteAllText Method") — nothing about flushing, and nothing about disk at all. A quick check confirms the write is visible the moment the call returns:

```csharp run id=writealltext-visible
string path = Path.Combine(Path.GetTempPath(), $"csg-wat-demo-{Guid.NewGuid():N}.txt");
File.WriteAllText(path, "written by WriteAllText");
string seen = File.ReadAllText(path);
Console.WriteLine($"visible immediately after WriteAllText returns: \"{seen}\"");
File.Delete(path);
```

```text output
visible immediately after WriteAllText returns: "written by WriteAllText"
```

:::dotnet
The current .NET runtime source shows why that visibility check passes but proves nothing about durability. `WriteAllText`'s private helper does not build a `FileStream` at all: it opens a raw `SafeFileHandle` with `FileMode.Create`, `FileAccess.Write` and `FileShare.Read`, writes the encoded bytes directly to that handle with `RandomAccess.WriteAtOffset`, and closes the handle when the `using` block ends — with no call to `Flush`, `Flush(true)`, or anything that reaches `FlushFileBuffers` ("File.cs (System.Private.CoreLib), WriteToFile helper"). So the bytes reach the OS immediately (which is why a second handle sees them at once, the same "after `Flush()`" stage from the previous section), but `WriteAllText` never takes the extra step the previous section showed is a separate, explicit call. Its durability guarantee, in other words, is exactly none beyond whatever the operating system does with a normal cached write on its own schedule.
:::

`FileMode.Create` matters here for a second reason, independent of flushing. Its documented behavior is "equivalent to requesting that if the file does not exist, use `CreateNew`; otherwise, use `Truncate`," and `Truncate` means the file "should be truncated so that its size is zero bytes" ("FileMode Enum") — *before* a single new byte is written. Calling `File.WriteAllText` on a file that already exists is therefore never a pure append-in-place: for a brief window the file on disk is shorter than either the old or the new content, all the way down to zero bytes, and only then does it grow back to the new content's length.

## Why can a file you already "saved" still vanish after a crash?

Put the last three sections together and there are two separate, independent ways a file a program has already "saved" can still be gone or wrong after a crash, and they are not the same failure:

1. **The bytes never left the process's own buffering.** Anything written through a buffered writer — a `StreamWriter`, a large `FileStream` buffer like the one in the flush demo above — and never explicitly flushed is still sitting in managed memory when the process dies. The OS never saw it, so there is nothing on disk to lose *or* to have kept; it simply never happened.
2. **The bytes reached the OS (or even the disk), but the filesystem's own bookkeeping that would make them count as part of the file was never journaled.** This is the ext4 exercise above in miniature: a data write with no corresponding, committed metadata update is not durably part of any file, no matter how thoroughly the data write itself succeeded.

:::pitfall
A successful, exception-free call to `File.WriteAllText`, or a `FileStream.Write` followed only by the implicit flush a `using` block's `Dispose` performs, rules out neither failure. Both leave a file that reads back correctly right now, on a machine that has not crashed, which is exactly why the gap is easy to miss in development and testing: the difference between "this file is on disk" and "this file will survive a crash" only ever shows up during the crash itself.
:::

Neither ext4's journal nor NTFS's log file is described, in either filesystem's own documentation, as covering the second failure for ordinary file *data* by default — both are scoped to the filesystem's *own* metadata. Closing that gap for a file's actual content, from application code, means asking for `Flush(true)` explicitly and accepting the documented cost of doing so.

## How do you update a file so a crash can never leave it half-written?

Combine what the last three sections showed and a plan follows directly. Write the *new* content to a brand-new temporary file, not the target — so the target is never truncated or partially overwritten in place. Force that temporary file's bytes to disk with `Flush(true)` before anything else touches the target. Then replace the target with the temporary file using a rename, not a copy — because on POSIX systems a rename onto an existing name is documented as atomic: "if *newpath* already exists, it will be atomically replaced, so that there is no point at which another process attempting to access *newpath* will find it missing" ("rename(2) - Linux manual page"). `File.Move`'s own documentation describes only the expensive path for .NET: "moving the file across disk volumes is equivalent to copying the file and deleting it from the source if the copying was successful" ("File.Move Method"). It says nothing directly about the same-volume case, but the implication is that the copy-and-delete fallback is needed specifically *because* crossing volumes rules out the cheap path — the underlying rename this pattern relies on, and the one the same page's cross-volume sentence is drawing a contrast with.

```csharp run id=atomic-replace
using System.Text;

string dir = Path.Combine(Path.GetTempPath(), $"csg-atomic-demo-{Guid.NewGuid():N}");
Directory.CreateDirectory(dir);
string target = Path.Combine(dir, "config.json");
string tmp = target + ".tmp";

void SaveAtomically(string path, string tempPath, string contents)
{
    using (var stream = new FileStream(tempPath, FileMode.Create, FileAccess.Write, FileShare.None))
    using (var streamWriter = new StreamWriter(stream, new UTF8Encoding(false)))
    {
        streamWriter.Write(contents);
        streamWriter.Flush();
        stream.Flush(true);
    }
    File.Move(tempPath, path, overwrite: true);
}

SaveAtomically(target, tmp, """{"retries":3}""");
Console.WriteLine(File.ReadAllText(target));
Console.WriteLine($"temp file still exists: {File.Exists(tmp)}");

SaveAtomically(target, tmp, """{"retries":5}""");
Console.WriteLine(File.ReadAllText(target));

Directory.Delete(dir, recursive: true);
```

```text output
{"retries":3}
temp file still exists: False
{"retries":5}
```

A reader who opens `config.json` at any point during either `SaveAtomically` call sees either the complete old JSON or the complete new JSON — the incomplete state only ever exists in `config.json.tmp`, a file nothing else has a reason to open, and that file is gone the instant the rename lands. `File.Replace` offers a close variant of this same pattern built into the BCL, with the useful extra of an automatic backup copy of what it overwrites, though its documentation warns that "if the `sourceFileName` and `destinationFileName` are on different volumes, this method raises an exception" ("File.Replace Method") — the same same-volume requirement this hand-rolled version relies on implicitly through `File.Move`.

:::note[One more gap, documented for Linux and not checked here]
This machine is Windows, so this is a citation, not something this article ran: on Linux, a rename's atomicity is not the end of the durability story either, because durably renaming a file involves *two* things reaching disk, not one. The Linux manual page for `fsync` is explicit that flushing the renamed file's own descriptor is not enough — "calling `fsync()` does not necessarily ensure that the entry in the directory containing the file has also reached disk. For that an explicit `fsync()` on a file descriptor for the directory is also needed" ("fsync(2) - Linux manual page"). Whether NTFS has an equivalent gap between "the rename is atomic" and "the directory's own record of it is durable," and what would close it from C#, is not something this article's Windows-only sources answer, so it is left here rather than guessed at.
:::

::::exercise[The version that looks fine until it isn't]
A teammate "simplifies" `SaveAtomically` by dropping the temp file entirely and calling `File.WriteAllText(path, contents)` directly on the target, twice: once with the old content, once with the new. Every existing test still passes, because no test kills the process mid-write. Using what the last two sections showed about `FileMode.Create` and about what `WriteAllText` does and does not flush, predict what its console output looks like next to the safe version's, then explain why a test suite comparing the two outputs would never catch the difference between them.

:::solution
```csharp run id=naive-overwrite
string path = Path.Combine(Path.GetTempPath(), $"csg-naive-demo-{Guid.NewGuid():N}.json");
File.WriteAllText(path, """{"retries":3}""");
Console.WriteLine(File.ReadAllText(path));
File.WriteAllText(path, """{"retries":5}""");
Console.WriteLine(File.ReadAllText(path));
File.Delete(path);
```

```text output
{"retries":3}
{"retries":5}
```

The output is identical to the safe version's, and that is the trap: this program never crashes, so it can never show the one behavior that tells the two versions apart. `File.WriteAllText` opens the *target* with `FileMode.Create`, which truncates it to zero bytes before writing a single new byte — so a crash between the truncate and the write's completion leaves `config.json` empty or partially written, something a reader could open and parse into garbage. `SaveAtomically` never truncates anything a reader can see: every intermediate state lives in `config.json.tmp`, and the rename that finally touches `config.json` is documented as atomic rather than a byte-by-byte overwrite. A test suite that never interrupts the process cannot distinguish these two versions, which is exactly why this has to be reasoned about from the documented behavior of `FileMode.Create` and `File.Move`, not discovered by testing.
:::
::::
