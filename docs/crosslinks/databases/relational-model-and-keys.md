# Crosslinks: databases/relational-model-and-keys

Desired links to planned-but-unpublished siblings (CONTENT_PLAN §7.6). Wire in once each target is published.

- Anchor "an index that every insert must update" -> `/databases/indexes/` -- in "Constraints have costs worth knowing", the bullet on unique constraints being implemented as indexes and the suggestion to index `loan.member_id`.
- Anchor "atomic" -> `/databases/normalization/` -- in "Many-to-many needs a third table", the sentence "the textbook model asks for attribute values to be **atomic**, indivisible, for this reason" (1NF is the natural next stop after this point).
- Anchor "one transaction" -> `/databases/transactions-and-acid/` -- in "What declarations cannot say", the sentence about rules ending up "in application code that counts and inserts inside one transaction" (currently linked only to the glossary `/glossary/#transaction`; add the article link alongside once published).

Already linked in the body: `/databases/sql-joins/` (published, order 2) -- both in the M:N section ("How joins work, row by row, is the subject of...") and in "The slip with no name on it" (comparing this page's mandatory-member `loan` design with the joins article's nullable-member cut-down schema).
