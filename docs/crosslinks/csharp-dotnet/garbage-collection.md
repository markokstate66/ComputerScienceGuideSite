# Cross-links wanted by /csharp-dotnet/garbage-collection/

One line each: anchor text | target route | where in the article. All targets are planned in CONTENT_PLAN.md section 7 and were unpublished when this round was written (2026-09-22), so the body does not link them yet. Each sentence reads correctly with or without the extra link. `/csharp-dotnet/value-types-vs-reference-types/` is already published and is linked directly from the body (see "How do you check any of this without guessing?").

- "avoiding large temporary allocations" | /csharp-dotnet/span-and-memory/ | "What happens to an allocation too big for the young generations?", last paragraph (the one ending "...can cross that line without anyone intending it"). That article owns `Span<T>`/`Memory<T>` as the tool for slicing data without allocating a new buffer at all, which is the constructive follow-up to "this array landed on the LOH by accident."
- "a dependency-injection container runs for you" | /oop-design/dependency-injection/ | "Does calling `Dispose` collect the object?", first paragraph, where `Dispose`'s role as an ordinary method call is introduced. `Microsoft.Extensions.DependencyInjection` calls `Dispose`/`DisposeAsync` on registered services when their scope ends, which is a natural "you don't always call this yourself" follow-up once that article exists; this page does not cover DI lifetimes itself.
- "what `await` actually compiles to" | /csharp-dotnet/async-await/ | Not currently referenced in the body; only add this link if a future round adds a sentence noting that finalizers and `async`/`await` continuations are unrelated mechanisms that beginners sometimes conflate. No such sentence exists yet, so there is nothing to wire up today.

## Boundaries with planned siblings

- /csharp-dotnet/span-and-memory/ owns `Span<T>`/`Memory<T>` and allocation-free slicing in depth. This article only uses allocation totals (`GC.GetTotalMemory`, `GC.GetAllocatedBytesForCurrentThread`) as evidence for how the collector behaves; it does not teach how to avoid allocating in the first place.
- /oop-design/dependency-injection/ owns service lifetimes and container-managed disposal. This article's `IDisposable`/finalizer sections are about the mechanism only (what `Dispose`, `using` and a finalizer each guarantee), not about who calls `Dispose` in a DI-based application.
- /csharp-dotnet/async-await/ has no material overlap with this article and needs no link from it; `Task` continuations and GC roots are unrelated mechanisms.
