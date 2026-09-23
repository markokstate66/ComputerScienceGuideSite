# Cross-links wanted by /csharp-dotnet/linq-deferred-execution/

One line each: anchor text | target route | where in the article. The target was unpublished when this round was written (2026-09-22). The body does not reference it yet; the sentence it would extend reads correctly without it.

- "async/await" (a new sentence, not yet written) | /csharp-dotnet/async-await/ | "What `yield return` actually builds", after the paragraph explaining that the compiler generates a class holding the method's locals as fields plus a resume marker. Once that article exists, add one sentence there noting that `async`/`await` is compiled the same way — a compiler-generated class saving locals and a resume point — so a reader who has seen one state machine recognizes the other. Do not add the sentence, or the link, until that article is published and its account of the async state machine has been checked against it; this page must not assert async/await internals it has not verified.

## Boundaries with planned siblings

- /csharp-dotnet/async-await/ owns the `async`/`await` state machine itself (what fields it holds, how continuations are scheduled, `SynchronizationContext`). This article only uses plain synchronous iterators (`yield return` producing `IEnumerable<T>`), not `IAsyncEnumerable<T>` or `await foreach`, and does not describe how `async` methods are compiled.
- /csharp-dotnet/generics/ owns constraints, variance and generic math in depth. `MyWhere<T>`/`MySelect<T,TResult>` on this page use only the plain unconstrained generic parameters LINQ itself uses; there is nothing here for that article to build on beyond the ordinary generic method syntax.
