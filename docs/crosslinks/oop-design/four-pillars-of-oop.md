# Cross-links wanted by /oop-design/four-pillars-of-oop/

One line each: anchor text | target route | where in the article. All targets are planned in CONTENT_PLAN.md section 7 and were unpublished on 2026-09-18, so the body does not link them yet. Each sentence reads correctly with or without the link.

- "favoring object composition" | /oop-design/composition-over-inheritance/ | "What does inheritance cost?", second paragraph (the Gamma et al. sentence). Also a good target for "hold an object of the other class in a private field and call it" under "So when is inheritance the right tool?".
- "Liskov substitution principle" | /oop-design/solid-principles/ | "An override can break a promise the base class made", paragraph after the throwing program.
- "An interface gives the same substitutability" (or just "interface") | /oop-design/interfaces-vs-abstract-classes/ | "Do you need inheritance to get polymorphism?", first paragraph.
- "a delegate is a single replaceable method" | /oop-design/strategy-observer-decorator/ | same paragraph; that article treats delegates as lightweight strategy.
- "a test double counts" | /oop-design/dependency-injection/ | "How is abstraction different from encapsulation?", last paragraph; `Collector(IPaymentGateway gateway)` is constructor injection.
- "Template Method pattern" | /oop-design/strategy-observer-decorator/ | only if that article ends up mentioning template method; otherwise leave unlinked.

## Boundaries with planned siblings (to avoid near-duplicate coverage)

- /oop-design/composition-over-inheritance/ owns the fragile-base-class refactoring story. This article shows only two costs of inheritance (virtual call from a base constructor; an override breaking an unwritten base-class promise) and deliberately does not do a before/after refactor to composition.
- /oop-design/solid-principles/ owns LSP in depth (the `ReadOnlyCollection`/`IList` wrinkle). This article names the principle in one sentence.
- /oop-design/interfaces-vs-abstract-classes/ owns the capability comparison, default interface members and static abstracts. This article uses one interface (`IPaymentGateway`) only to discuss what an abstraction should admit.
- /csharp-dotnet/ articles own value/reference types and generics; parametric polymorphism is intentionally not covered here.
