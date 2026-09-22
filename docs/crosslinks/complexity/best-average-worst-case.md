# Cross-links wanted by /complexity/best-average-worst-case/

One line each: anchor text | target route | where in the article. All targets are planned in `CONTENT_PLAN.md` section 7 and were unpublished on 2026-09-22, so the body does not link them yet; each sentence reads correctly with or without the link. `/complexity/big-o-notation/` and `/complexity/amortized-analysis/` are already published and linked directly in the body, so they are not listed here.

- "hash table" / "hash tables" | /data-structures/hash-tables/ | "Adversarial inputs and hash flooding", first paragraph and the `:::dotnet` callout — several mentions once that article exists.
- "quicksort" (general context, e.g. where it sits among other sorts) | /algorithms/sorting-algorithms-compared/ | Could be added to the opening paragraph or the closing section, as a "see also" for readers who want the full sort lineup, stability and the comparison-sort lower bound. Not required; this article is self-contained about quicksort's three cases.
- "recursion" | /algorithms/recursion/ | "When it does not just get slow", first sentence. Currently links to the glossary entry `/glossary/#recursion`; switch to the article once published.
- "recursion trees" / "the Master theorem" | /complexity/analyzing-loops-and-recursion/ | Not currently mentioned by name; if that article publishes a formal recursion-tree derivation of Θ(*n* log *n*), the two recurrences in "Best, average and worst case, defined" could link there instead of only citing CLRS/Sedgewick and Wayne.

## Boundaries with planned siblings (to avoid near-duplicate coverage)

- `/data-structures/hash-tables/` owns hashing, collisions, chaining vs open addressing, and `Dictionary`'s real BCL layout. This article only uses a minimal hand-rolled chaining table to demonstrate the algorithmic-complexity-attack mechanism and cites why `String.GetHashCode` is randomized; it does not attempt to explain `Dictionary` internals.
- `/algorithms/sorting-algorithms-compared/` owns the full sort lineup (selection, merge, heap, quicksort variants), stability, and the Ω(*n* log *n*) comparison-sort lower bound. This article uses only quicksort, as the vehicle for best/average/worst/expected case; it does not compare quicksort against other sorts.
- `/complexity/analyzing-loops-and-recursion/` owns recursion trees, recurrences and the Master theorem in general. This article solves exactly two specific quicksort recurrences (Θ(*n*²) and Θ(*n* log *n*)) by unrolling/citation, without deriving the Master theorem itself.
- `/complexity/amortized-analysis/` already distinguishes worst-case, amortized, average-case and expected (in "Amortized is not average-case") using one quicksort sentence as an example and links here for the fuller treatment; this article is that fuller treatment and does not repeat the amortized-analysis definition, only cross-references it implicitly through consistent terminology.
