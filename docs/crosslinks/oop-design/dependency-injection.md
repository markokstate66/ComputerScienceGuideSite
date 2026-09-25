# Cross-links wanted by /oop-design/dependency-injection/

One line each: anchor text | target route | where in the article. `/oop-design/factory-builder-singleton/` is planned in `CONTENT_PLAN.md` §7 row 6 and was unpublished (being written concurrently this round) when this article was written, so the body does not link it yet. The sentence reads correctly with or without the link.

- "A companion article on creational patterns" | /oop-design/factory-builder-singleton/ | "Lifetimes: transient, scoped, and singleton, precisely" section, the paragraph right after the three lifetime definitions, contrasting the container's Singleton lifetime with the classic Singleton design pattern ("This is a different idea from the classic Singleton design pattern... A companion article on creational patterns covers that version and why DI lifetimes have mostly replaced it"). — Status: wired (that paragraph, "A companion article on creational patterns" linked)

## Inbound: pending crosslinks other articles already wrote for this one

Two published siblings pre-wrote anchor text pointing here, from before this article existed. Both expectations are satisfied by the body as written:

- `docs/crosslinks/oop-design/composition-over-inheritance.md`: "dependency injection" expects this article to own constructor injection, composition roots and container lifetimes in depth — satisfied by the whole article, in particular "Passing the dependency in by hand" and "Wiring the whole graph: the composition root".
- `docs/crosslinks/oop-design/solid-principles.md`: "a dedicated article on building this wiring by hand, and on container lifetimes" — satisfied by "Passing the dependency in by hand" (hand-rolled constructor injection), "Wiring the whole graph: the composition root" (composition root), and "Lifetimes: transient, scoped, and singleton, precisely" (lifetimes).

## Boundaries with planned siblings (to avoid near-duplicate coverage)

- `/oop-design/factory-builder-singleton/` (unpublished, `CONTENT_PLAN.md` §7 row 6) owns Factory, Builder, and the classic Singleton design pattern — including thread-safe `Lazy<T>` singleton construction — in depth. This article names the classic Singleton pattern in one sentence, only to distinguish it from the container's Singleton *lifetime*, and does not build or critique it.
- `/oop-design/solid-principles/` (published) owns dependency inversion as a design principle, including the fact that constructor injection alone satisfies it without any container. This article assumes that distinction (linked back to it in "Passing the dependency in by hand") and does not re-derive it; it is scoped to the mechanics of injecting, wiring, and lifetime-managing dependencies, with or without a framework.
