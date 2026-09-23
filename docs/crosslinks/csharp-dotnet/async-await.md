# Crosslinks for `csharp-dotnet/async-await`

Both targets exist in `CONTENT_PLAN.md` §7.8 but are not published yet (`processes-and-threads` is a draft, `concurrency-race-conditions-locks` has no file). Wire these once each target is live.

- Anchor text: "a thread pool worker handling one HTTP request" (intro, "A loop that ties up its thread") — target `/operating-systems/processes-and-threads/` — that article measures thread-pool starvation from blocking calls directly; this page only gestures at the same idea before pivoting to `await`.
- Anchor text: "dedicated article on race conditions and locks" (end of "The deadlock `.Result` causes, precisely") — target `/operating-systems/concurrency-race-conditions-locks/` — that article covers `lock`-based deadlocks and their own timeout-based detection technique; kept separate here so this page stays about the `SynchronizationContext` mechanism specifically.
