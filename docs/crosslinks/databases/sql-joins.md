# Cross-links wanted by /databases/sql-joins/

Links to planned articles that are not published yet. One line each: anchor text -> target route; where in the article.

- "foreign key" -> /databases/relational-model-and-keys/ ; section "Draw a line for every matching pair", paragraph beginning "`ON` takes any Boolean expression" (first use of "foreign key"). Also a candidate for `prerequisites` once published.
- "primary key of `member`" -> /databases/relational-model-and-keys/ ; section "When the key is not unique, rows multiply", first sentence (keep the existing glossary link at first use in the outer-join section).
- "index" / "B-tree index" -> /databases/indexes/ ; section "What the engine does instead of building every pair", bullet "Nested loops with an index" (replace or sit beside the glossary link), and the closing sentence "the first candidate for an index".
- "common table expressions" -> /databases/aggregation-and-window-functions/ ; section "When the key is not unique, rows multiply", paragraph after the fixed balance query. Same target for "`GROUP BY`" in "Three attempts at one report" if that article covers COUNT(*) versus COUNT(column).
- "a payment is not for a particular loan" -> /databases/normalization/ ; section "When the key is not unique, rows multiply", paragraph after Figure 5 (only if that article discusses independent one-to-many facts).
- "hash table" -> /data-structures/hash-tables/ ; section "What the engine does...", bullet "Hash join" (currently a glossary link).
- "the merge step of merge sort" -> /algorithms/sorting-algorithms-compared/ ; same section, bullet "Merge join".
- "big-O terms" -> /complexity/big-o-notation/ ; same section, paragraph after the C# program (currently a glossary link).

Inbound links worth adding from siblings: relational-model-and-keys (where foreign keys are first queried), indexes (join columns as index candidates), aggregation-and-window-functions (row multiplication before SUM).
