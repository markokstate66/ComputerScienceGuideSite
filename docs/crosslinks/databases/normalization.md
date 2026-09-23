# Cross-links wanted by /databases/normalization/

One line each: anchor text | target route | where in the article. All targets are planned in CONTENT_PLAN.md section 7 and were unpublished when this round was written (2026-09-22), so the body does not link them yet. Each sentence reads correctly with or without the link.

- "What an index does to the cost of each of those joins" (or "How Database Indexes Work") | /databases/indexes/ | "When seven tables are the wrong answer", first paragraph after the five-join report query, sentence beginning "What an index does to the cost of each of those joins is a separate question...". That article owns `EXPLAIN QUERY PLAN`, seeks vs. scans, and composite index column order; this page only claims that normalization controls join *count*, not join *cost*.
- "Isolation levels" or a mention of concurrent updates (optional) | /databases/transactions-and-acid/ | Could be added near the "When seven tables are the wrong answer" section if a sentence about concurrent writers to the normalized schema is ever added; not currently referenced in the body, so no specific anchor yet.

## Boundaries with planned siblings

- /databases/indexes/ owns index structure, `EXPLAIN QUERY PLAN`, seeks vs. scans, and when an index is not used. This article only states that a normalized schema's reporting queries need more joins, not what those joins cost or how to speed them up.
- /databases/relational-model-and-keys/ owns the definitions of relation, tuple, superkey, candidate key, primary key and foreign key, and is linked once at first use of "candidate key" in the "functional dependencies" section. This article does not redefine those terms.
- /databases/transactions-and-acid/ (planned) would own what happens when two writers update the normalized tables concurrently; this article's anomaly demonstrations are all single-session and do not touch concurrency.
