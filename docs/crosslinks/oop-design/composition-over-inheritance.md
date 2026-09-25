# Cross-links wanted by /oop-design/composition-over-inheritance/

One line each: anchor text | target route | where in the article. Both targets are planned in CONTENT_PLAN.md section 7 and were unpublished on 2026-09-22, so the body does not link them yet. Each sentence reads correctly with or without the link.

- "Strategy pattern" | /oop-design/strategy-observer-decorator/ | "Behaviors as objects the enemy holds, not base classes it extends", the paragraph right after the composed `Enemy` listing (the "Two things worth naming here" paragraph). — Status: wired (that paragraph, "Strategy pattern" linked)
- "dependency injection" | /oop-design/dependency-injection/ | same paragraph, same sentence. — Status: wired (same paragraph, "dependency injection" linked)

## Boundaries with planned siblings (to avoid near-duplicate coverage)

- This article owns the fragile-base-class refactoring story for `oop-design` (see the boundary note in `docs/crosslinks/oop-design/four-pillars-of-oop.md`, which four-pillars-of-oop.md respects by not doing a before/after refactor of its own).
- /oop-design/strategy-observer-decorator/ owns the Strategy pattern in depth, including where it appears in the BCL (`IComparer<T>`, `IObservable<T>`). This article names Strategy in one sentence once the composed design already exists; it does not build toward the pattern as a destination.
- /oop-design/dependency-injection/ owns constructor injection, composition roots and container lifetimes in depth. This article uses plain constructor injection to wire `Enemy` and names it once; it does not discuss containers, lifetimes or a composition root.
- /oop-design/solid-principles/ owns the Liskov substitution principle in depth. This article deliberately does not invoke LSP: the `Wyvern` bug is a fragile-base-class duplication bug, not a substitutability violation (every reference to `Wyvern`, however typed, keeps working — the returned behavior is just wrong), so citing LSP here would misapply it.
- /oop-design/interfaces-vs-abstract-classes/ owns the capability comparison between interfaces and abstract classes. This article uses interfaces only as the mechanism composition needs (a class can implement many, extend only one) and does not compare the two constructs.
