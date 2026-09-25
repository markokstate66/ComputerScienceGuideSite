# Crosslinks: databases/relational-model-and-keys

Desired links to planned-but-unpublished siblings (CONTENT_PLAN §7.6). Wire in once each target is published.

- Anchor "an index that every insert must update" -> `/databases/indexes/` -- in "Constraints have costs worth knowing", the bullet on unique constraints being implemented as indexes and the suggestion to index `loan.member_id`. — Status: wired, but on a nearby span rather than the literal recorded text: "an index that every insert must update" was already fully consumed by an existing external link (SQLite docs on unique-constraint indexes), so the internal link went on the bullet's other unlinked mention of the concept instead, "an index on the child's foreign key column" (same bullet, `loan.member_id` sentence).
- Anchor "atomic" -> `/databases/normalization/` -- in "Many-to-many needs a third table", the sentence "the textbook model asks for attribute values to be **atomic**, indivisible, for this reason" (1NF is the natural next stop after this point). — Status: wired
- Anchor "one transaction" -> `/databases/transactions-and-acid/` -- in "What declarations cannot say", the sentence about rules ending up "in application code that counts and inserts inside one transaction" (currently linked only to the glossary `/glossary/#transaction`; add the article link alongside once published). — Status: wired (upgraded from the glossary link to the article link, anchor extended to "one transaction")

Already linked in the body: `/databases/sql-joins/` (published, order 2) -- both in the M:N section ("How joins work, row by row, is the subject of...") and in "The slip with no name on it" (comparing this page's mandatory-member `loan` design with the joins article's nullable-member cut-down schema).
