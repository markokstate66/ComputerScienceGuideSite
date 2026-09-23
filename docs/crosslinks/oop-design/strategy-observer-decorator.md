# Cross-links wanted by /oop-design/strategy-observer-decorator/

One line each: anchor text | target route | where in the article. No unpublished-sibling anchor text is needed in the body as written (2026-09-22): every pillar article this one would naturally reference — `four-pillars-of-oop`, `composition-over-inheritance`, `interfaces-vs-abstract-classes` — is either already published or not mentioned by name in the body.

## Inbound: pending crosslinks other articles already wrote for this one

Two published siblings pre-wrote anchor text pointing here, from before this article existed. Both expectations are satisfied by the body as written:

- `docs/crosslinks/oop-design/four-pillars-of-oop.md`: "a delegate is a single replaceable method" expects this article to treat delegates as lightweight strategy — see "Delegates as a lighter Strategy". Its second candidate, "Template Method pattern", is explicitly conditional ("only if that article ends up mentioning template method; otherwise leave unlinked") — this article does not mention Template Method, so that one stays unlinked, as instructed.
- `docs/crosslinks/oop-design/composition-over-inheritance.md`: "Strategy pattern" expects this article to own Strategy in depth, including where it appears in the BCL (`IComparer<T>`, `IObservable<T>`) — see "Strategy: the algorithm behind `IComparer<T>`" and "The formal shape events hide" (which covers `IObservable<T>` under Observer, not Strategy; the BCL-first Strategy example is `IComparer<T>`/`Comparison<T>`, not `IObservable<T>`— the composition-over-inheritance note conflates the two interfaces, but the intent, "this article owns Strategy's BCL grounding", is satisfied).

## Boundaries with planned siblings

- `/oop-design/factory-builder-singleton/` (unpublished, `CONTENT_PLAN.md` §7.4 row 6) owns the creational patterns: Factory, Builder and Singleton. This article stays scoped to Strategy, Observer and Decorator only and does not mention object-creation patterns.
- `/oop-design/dependency-injection/` (unpublished, `CONTENT_PLAN.md` §7.4 row 7) owns constructor injection, composition roots and container lifetimes in depth. This article's `Report(IEmployeeFormatter formatter)` and `LimitedObserver<T>(IObserver<T> inner, ...)` pass collaborators through a constructor without naming or discussing dependency injection as its own topic.
