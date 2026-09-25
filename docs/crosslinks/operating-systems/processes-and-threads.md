# Cross-links wanted by /operating-systems/processes-and-threads/

One line each: anchor text | target route | where in the article. All targets are planned in CONTENT_PLAN.md section 7 and were unpublished on 2026-09-18, so the body does not link them yet. Each sentence reads correctly with or without the link.

- "virtual memory, a later article in this series" | /operating-systems/virtual-memory/ | "What belongs to the process and what belongs to each thread", paragraph beginning "First, the stacks are private by convention". — Status: wired (/operating-systems/virtual-memory/)
- "the next article in this series" (race condition) | /operating-systems/concurrency-race-conditions-locks/ | Solution of the exercise "A local that is not local". Currently links the term to /glossary/#race-condition; keep that and add the article link on "the next article in this series". — Status: wired (kept the existing /glossary/#race-condition link on "race condition" and added the new link on "the next article in this series")
- "interleave their reads and writes" | /operating-systems/concurrency-race-conditions-locks/ | Last paragraph before the exercise "Four designs to judge". — Status: dropped (duplicate target /operating-systems/concurrency-race-conditions-locks/, already linked earlier via "the next article in this series")
- "the scheduler time-slices" | /operating-systems/cpu-scheduling/ | "What a context switch costs", first paragraph. — Status: wired (/operating-systems/cpu-scheduling/)
- "CPU caches" | /operating-systems/memory-hierarchy-and-caches/ | "What a context switch costs", second paragraph (indirect cost). — Status: wired (/operating-systems/memory-hierarchy-and-caches/)
- "a separate article on `async`/`await`" | /csharp-dotnet/async-await/ | "The thread pool, and how to starve it", paragraph beginning "The second pass is the fix". — Status: wired (/csharp-dotnet/async-await/)

## Boundaries with planned siblings (to avoid near-duplicate coverage)

- /operating-systems/concurrency-race-conditions-locks/ owns lost updates, `lock`, `Interlocked`, deadlock. This article only shows that a captured variable is shared and names the race in one solution paragraph.
- /operating-systems/cpu-scheduling/ owns scheduling algorithms and what Windows/Linux schedulers do. This article covers only the mechanics and measured cost of a single context switch.
- /operating-systems/virtual-memory/ owns page tables, reserve vs commit in depth, working set. This article uses reserve vs commit only to read the per-thread stack measurement.
- /csharp-dotnet/async-await/ owns the state machine, `ConfigureAwait` and the `.Result` deadlock. This article owns thread pool starvation and measures sync-over-async only as thread-count growth.
