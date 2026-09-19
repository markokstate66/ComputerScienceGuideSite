# Cross-links wanted by /complexity/amortized-analysis/

One line each: anchor text | target route | where in the article. All targets are planned in CONTENT_PLAN.md section 7 and were unpublished on 2026-09-18, so the body does not link them yet. Each sentence reads correctly with or without the link.

- "Big-O terms" | /complexity/big-o-notation/ | Opening paragraph, first O(1). Currently links to the glossary entry /glossary/#big-o-notation; switch to the article (it is also the listed prerequisite).
- "arrays and dynamic arrays" | /data-structures/arrays-and-dynamic-arrays/ | "Watch the capacity move", first paragraph, sentence "Indexing, insertion and removal in arrays and dynamic arrays are a data-structures topic".
- "best, average and worst cases" | /complexity/best-average-worst-case/ | "Amortized is not average-case", the quicksort paragraph, sentence beginning "How the best, average and worst cases of a single algorithm are defined".
- "hash table" | /data-structures/hash-tables/ | "Amortized is not average-case", the Dictionary paragraph. Currently links to the glossary entry /glossary/#hash-table; switch to the article.
- "A stack with `MultiPop(k)`" (or just "stack") | /data-structures/stacks-and-queues/ | "The same argument elsewhere: multipop and a binary counter", second paragraph.
- "space complexity" | /complexity/space-complexity/ | "Why the array doubles instead of growing by a fixed amount", last paragraph before the exercise ("a trade between time and memory"). Currently links to the glossary entry /glossary/#space-complexity; switch to the article.

## Boundaries with planned siblings (to avoid near-duplicate coverage)

- /data-structures/arrays-and-dynamic-arrays/ owns memory layout, indexing, insertion and removal cost, and building a `DynamicArray<T>`. This article owns only the cost of appending: the observed `List<T>` growth policy, the three amortized proofs, growth-factor comparison, and how the guarantee is lost. That article should link here for the O(1) amortized proof instead of repeating it.
- /complexity/best-average-worst-case/ owns the definitions of the three cases, the quicksort case study, randomization and hash flooding. This article uses one quicksort sentence only to contrast average-case with amortized.
- /data-structures/hash-tables/ owns hashing, collisions and `Dictionary` internals. This article only states which qualifier (average-case versus amortized) covers which half of the documented cost of `Dictionary.Add`.
