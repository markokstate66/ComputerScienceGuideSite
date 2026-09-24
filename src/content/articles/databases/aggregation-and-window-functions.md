---
title: "GROUP BY, HAVING and Window Functions"
description: "See exactly which rows GROUP BY collapses and which a window function keeps, then use RANK, LAG and explicit frames for running totals and top-N results."
pillar: databases
order: 6
author: markus
published: 2026-09-24
updated: 2026-09-24
level: intermediate
tags: [sql, group-by, window-functions, aggregation, sqlite]
prerequisites: ["databases/relational-model-and-keys", "databases/sql-joins", "databases/indexes"]
sources:
  - title: "SQLite: SELECT (2.4 Generation of the set of result rows, 2.5 Bare columns in an aggregate query)"
    url: "https://www.sqlite.org/lang_select.html"
    publisher: "SQLite"
    accessed: 2026-09-24
  - title: "SQLite: Aggregate Functions (count, sum, total, avg, min, max, DISTINCT, FILTER)"
    url: "https://www.sqlite.org/lang_aggfunc.html"
    publisher: "SQLite"
    accessed: 2026-09-24
  - title: "SQLite: Window Functions"
    url: "https://www.sqlite.org/windowfunctions.html"
    publisher: "SQLite"
    accessed: 2026-09-24
  - title: "PostgreSQL Documentation: 3.5. Window Functions (tutorial)"
    url: "https://www.postgresql.org/docs/current/tutorial-window.html"
    publisher: "PostgreSQL Global Development Group"
    accessed: 2026-09-24
  - title: "PostgreSQL Documentation: SELECT (GROUP BY, HAVING, and the WINDOW clause's default frame)"
    url: "https://www.postgresql.org/docs/current/sql-select.html"
    publisher: "PostgreSQL Global Development Group"
    accessed: 2026-09-24
  - title: "PostgreSQL Documentation: 9.22. Window Functions (reference)"
    url: "https://www.postgresql.org/docs/current/functions-window.html"
    publisher: "PostgreSQL Global Development Group"
    accessed: 2026-09-24
  - title: "OVER Clause (Transact-SQL)"
    url: "https://learn.microsoft.com/en-us/sql/t-sql/queries/select-over-clause-transact-sql"
    publisher: "Microsoft Learn"
    accessed: 2026-09-24
  - title: "SELECT (Transact-SQL): Logical processing order of the SELECT statement"
    url: "https://learn.microsoft.com/en-us/sql/t-sql/queries/select-transact-sql"
    publisher: "Microsoft Learn"
    accessed: 2026-09-24
  - title: "Ranking Functions (Transact-SQL)"
    url: "https://learn.microsoft.com/en-us/sql/t-sql/functions/ranking-functions-transact-sql"
    publisher: "Microsoft Learn"
    accessed: 2026-09-24
  - title: "GROUP BY (Transact-SQL)"
    url: "https://learn.microsoft.com/en-us/sql/t-sql/queries/select-group-by-transact-sql"
    publisher: "Microsoft Learn"
    accessed: 2026-09-24
draft: true
---

The `loan` table below logs eleven checkouts from a small library. Two questions about it sound almost the same but call for different SQL. "How many loans did each member make, and what do they owe in late fees?" collapses those eleven rows down to five, one per member. "What did each member owe running after every individual loan?" needs all eleven rows, in order, each carrying its own number. `GROUP BY` answers the first question; a window function answers the second. Reach for the wrong one and the query still runs, but it hands back the wrong shape of answer, or a number that only looks right.

The tables reuse the `member`, `book` and `copy` design from [The Relational Model](/databases/relational-model-and-keys/), narrowed to what aggregation needs. Window functions need SQLite 3.25 or later; the results here come from SQLite 3.50.

## Every row collapses into its group

```sql run
CREATE TABLE member (
  member_id INTEGER PRIMARY KEY,
  name      TEXT NOT NULL
);

CREATE TABLE book (
  book_id INTEGER PRIMARY KEY,
  title   TEXT NOT NULL
);

CREATE TABLE copy (
  copy_id INTEGER PRIMARY KEY,
  book_id INTEGER NOT NULL
    REFERENCES book (book_id)
);

CREATE TABLE loan (
  loan_id   INTEGER PRIMARY KEY,
  member_id INTEGER NOT NULL
    REFERENCES member (member_id),
  copy_id   INTEGER NOT NULL
    REFERENCES copy (copy_id),
  loaned_on TEXT NOT NULL,
  late_fee  INTEGER NOT NULL
    DEFAULT 0
);

INSERT INTO member (member_id, name)
VALUES
  (1, 'Ada'), (2, 'Boris'),
  (3, 'Chen'), (4, 'Dalia'),
  (5, 'Eve');

INSERT INTO book (book_id, title)
VALUES
  (1, 'Dune'), (2, 'Emma'),
  (3, 'Ulysses'), (4, 'Hamlet'),
  (6, 'Neuromancer');

INSERT INTO copy (copy_id, book_id)
VALUES
  (1, 1), (2, 1), (3, 2), (4, 2),
  (5, 3), (6, 3), (7, 4), (8, 6);

INSERT INTO loan
  (loan_id, member_id, copy_id,
   loaned_on, late_fee)
VALUES
  (101, 1, 1, '2026-08-03', 2),
  (102, 1, 3, '2026-08-03', 3),
  (103, 1, 5, '2026-08-10', 0),
  (104, 1, 7, '2026-08-17', 5),
  (105, 2, 2, '2026-08-05', 0),
  (106, 2, 8, '2026-08-12', 4),
  (107, 2, 4, '2026-08-19', 0),
  (108, 3, 6, '2026-08-06', 5),
  (109, 3, 7, '2026-08-20', 5),
  (110, 4, 2, '2026-08-08', 4),
  (111, 5, 6, '2026-08-21', 0);
```

Every row of `loan` is one checkout: which member, which copy, when, and how much the member ended up owing in late fees (`0` for a loan returned on time). The first question, loans and fees per member, is a **`GROUP BY`**:

```sql run
SELECT member_id,
       COUNT(*) AS loans,
       SUM(late_fee) AS total_fee
FROM loan
GROUP BY member_id
ORDER BY member_id;
```

```text output
member_id  loans  total_fee
---------  -----  ---------
1          4      10
2          3      4
3          2      10
4          1      4
5          1      0
```

Eleven input rows became five output rows. SQLite's own description of what just happened is exact: for an aggregate query with a `GROUP BY` clause, "each of the expressions specified as part of the `GROUP BY` clause is evaluated for each row of the dataset... rows for which the results... are the same get assigned to the same group," and then "[e]ach group of input dataset rows contributes a single row to the set of result rows," per [SQLite's SELECT documentation](https://www.sqlite.org/lang_select.html#the_group_by_clause). `member_id` is the grouping key; `COUNT(*)` and `SUM(late_fee)` are **aggregate functions**, each folding every row of a group down to one number. `total_fee` for member 1 is `2 + 3 + 0 + 5`; the four separate late fees are gone from the output, replaced by their sum.

`SUM` and `COUNT` handle `NULL` differently, and the difference bites the first time a loan has no fee recorded rather than a fee of `0`. SQLite's aggregate function reference is specific: `count(X)` "returns a count of the number of times that X is not NULL," while `count(*)` "returns the total number of rows in the group," and `sum(X)` "returns the sum of all non-NULL values in the group" and, with no non-`NULL` input at all, "returns NULL" rather than `0` ([SQLite Aggregate Functions](https://www.sqlite.org/lang_aggfunc.html)). `AVG` and `MIN`/`MAX` are the same: they skip `NULL`s and return `NULL` only when every value in the group was `NULL`. A member with three loans and one unrecorded fee would get `COUNT(late_fee)` of 3 but `COUNT(*)` of 4; using the wrong one silently under- or over-counts.

## What a bare column means once rows have collapsed

`member_id` survived the collapse because it is the grouping key: every row in a group agrees on its value. `late_fee` survived because it sits inside `SUM`. What about a column that is neither? PostgreSQL's manual states the rule plainly: once `GROUP BY` or an aggregate function is present, "it is not valid for the `SELECT` list expressions to refer to ungrouped columns except within aggregate functions," because "there would otherwise be more than one possible value to return for an ungrouped column" ([PostgreSQL: SELECT](https://www.postgresql.org/docs/current/sql-select.html#SQL-GROUPBY)). SQL Server's `GROUP BY` reference agrees from the other direction: a plain column "must appear in the `GROUP BY` clause" if it is used in "any nonaggregate expression in the... select list" ([SQL Server: GROUP BY](https://learn.microsoft.com/en-us/sql/t-sql/queries/select-group-by-transact-sql#arguments)). Try to select `loaned_on` next to a per-member aggregate in either engine and the query is refused before it runs.

SQLite instead runs it, and calls the result a **bare column**:

```sql run
SELECT member_id, loaned_on,
       COUNT(*) AS loans
FROM loan
GROUP BY member_id
ORDER BY member_id;
```

```text output
member_id  loaned_on   loans
---------  ----------  -----
1          2026-08-03  4
2          2026-08-05  3
3          2026-08-06  2
4          2026-08-08  1
5          2026-08-21  1
```

Every `loaned_on` shown is a real date from that member's rows, but not a meaningful one: it is whichever row SQLite happened to process last while building the group, which is why members with several loans on different dates each show only their earliest date here, an accident of insertion order rather than a rule. SQLite's own documentation is blunt about relying on this: "you usually do not know which input row is used to compute [the bare column], and so in many cases the value... is undefined," and "[m]ost other SQL database engines disallow bare columns... This is considered a feature, not a bug" of SQLite specifically ([SQLite: SELECT §2.5](https://www.sqlite.org/lang_select.html#bare_columns_in_an_aggregate_query)).

There is one documented exception. With exactly one `min()` or `max()` in the query, SQLite guarantees that every bare column comes from the same input row as that extreme value:

```sql run
SELECT member_id, loaned_on,
       MAX(late_fee) AS worst_fee
FROM loan
GROUP BY member_id
ORDER BY member_id;
```

```text output
member_id  loaned_on   worst_fee
---------  ----------  ---------
1          2026-08-17  5
2          2026-08-12  4
3          2026-08-06  5
4          2026-08-08  4
5          2026-08-21  0
```

Here `loaned_on` really is the date of the highest-fee loan for each member, because "all bare columns in the result set take values from an input row which also contains the... maximum" ([SQLite: SELECT §2.5](https://www.sqlite.org/lang_select.html#bare_columns_in_an_aggregate_query)). The guarantee is narrow: it needs exactly one `min()`/`max()` call, breaks if the query has two, and does not extend to `sum()` or `count()` at all, as the previous query showed. Treat it as a documented special case to reach for on purpose, not a habit; a `MIN`/`MAX` subquery joined back to the base table says the same thing in every engine.

::::exercise[Predict a bare column before you run it]
Using the same `loan` table, predict what `loaned_on` will show for each member in this query, then check it:

```text
SELECT member_id, loaned_on,
       MIN(late_fee) AS best_fee
FROM loan
GROUP BY member_id;
```

:::solution
Exactly one `MIN()` is present, so the special case applies: every bare column takes its value from the row holding that member's smallest fee. Member 1's smallest fee is the `0` from the loan on `2026-08-10`, so that row's date is what comes back, not the earliest loan date:

```sql run
SELECT member_id, loaned_on,
       MIN(late_fee) AS best_fee
FROM loan
GROUP BY member_id
ORDER BY member_id;
```

```text output
member_id  loaned_on   best_fee
---------  ----------  --------
1          2026-08-10  0
2          2026-08-05  0
3          2026-08-06  5
4          2026-08-08  4
5          2026-08-21  0
```

Members 3, 4 and 5 have only one loan each, or loans that all share the minimum, so the row is unambiguous either way.
:::
::::

## `HAVING` filters groups; `WHERE` never sees an aggregate

A `WHERE` clause runs before grouping happens, against individual rows, so it cannot mention `COUNT(*)` or `SUM(late_fee)`: those values do not exist yet.

```sql run error
SELECT member_id, COUNT(*) AS loans
FROM loan
WHERE COUNT(*) > 2
GROUP BY member_id;
```

```text output
misuse of aggregate: COUNT()
```

`HAVING` exists for exactly this: a filter that runs after the groups do. PostgreSQL's manual draws the line precisely: "`WHERE` filters individual rows before the application of `GROUP BY`, while `HAVING` filters group rows created by `GROUP BY`" ([PostgreSQL: SELECT](https://www.postgresql.org/docs/current/sql-select.html#SQL-HAVING)).

```sql run
SELECT member_id, COUNT(*) AS loans
FROM loan
GROUP BY member_id
HAVING COUNT(*) > 2
ORDER BY member_id;
```

```text output
member_id  loans
---------  -----
1          4
2          3
```

The two clauses are not interchangeable even when both could in principle run: `WHERE` is cheaper, because it discards rows before the (comparatively expensive) grouping work happens, so a condition that only needs a single row's columns belongs in `WHERE` even if `HAVING` would also accept it. A condition on an aggregate can only ever go in `HAVING`. Both can appear together, each doing its own job, and each is optional independently:

```sql run
SELECT member_id,
       COUNT(*) AS loans,
       SUM(late_fee) AS total_fee
FROM loan
WHERE loaned_on < '2026-08-15'
GROUP BY member_id
HAVING SUM(late_fee) > 0
ORDER BY member_id;
```

```text output
member_id  loans  total_fee
---------  -----  ---------
1          3      5
2          2      4
3          1      5
4          1      4
```

`WHERE` drops every loan from the second half of August before grouping starts; `HAVING` then drops member 5, whose one remaining loan (if any) carries no fee. Member 5 has no row here at all because their only loan, on the 21st, was filtered out by `WHERE` before grouping ever saw it — a group with zero rows is not a group, so `HAVING` never gets a chance to evaluate it.

A related tool, `FILTER`, restricts a single aggregate to a subset of rows without a second query or a `CASE` expression: "[i]f a `FILTER` clause is provided, then only rows for which the expr is true are included" in that one aggregate's input ([SQLite: Window Functions](https://www.sqlite.org/windowfunctions.html#filterclause)). `COUNT(*) FILTER (WHERE late_fee > 0)` counts only the late loans, in the same row as an unfiltered `COUNT(*)`, without a `HAVING` clause at all.

## `GROUP BY` is one step in a longer pipeline

`GROUP BY` and `HAVING` are two steps in a fixed sequence, and the order explains both the `WHERE`/aggregate error above and where window functions fit in. SQL Server's reference spells the sequence out as the "logical processing order... for a `SELECT` statement," where "objects defined in one step are made available... to subsequent steps": `FROM`, then `WHERE`, then `GROUP BY`, then `HAVING`, then the `SELECT` list itself, then `ORDER BY` ([SQL Server: SELECT](https://learn.microsoft.com/en-us/sql/t-sql/queries/select-transact-sql#logical-processing-order-of-the-select-statement)). A window function's `OVER` clause is evaluated as part of building that `SELECT` list — after `WHERE`, `GROUP BY` and `HAVING` have already produced whatever rows survive them. PostgreSQL's manual says the same thing from the window function's point of view: "[t]he rows considered by a window function are those of the 'virtual table' produced by the query's `FROM` clause as filtered by its `WHERE`, `GROUP BY`, and `HAVING` clauses if any" ([PostgreSQL: Window Functions tutorial](https://www.postgresql.org/docs/current/tutorial-window.html)).

<figure class="diagram">
<svg viewBox="0 0 320 460" role="img" aria-labelledby="pipeline-title pipeline-desc">
<title id="pipeline-title">The logical processing order of a SELECT statement</title>
<desc id="pipeline-desc">Six stacked boxes connected top to bottom: FROM, WHERE, GROUP BY, HAVING, then a highlighted box for window functions labelled "OVER runs here, on whatever HAVING left", then SELECT list and ORDER BY at the bottom.</desc>
<defs>
<marker id="pipeline-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 10 5 0 10z" class="d-fill-stroke"/></marker>
</defs>
<path d="M160 46 V70" class="d-line" marker-end="url(#pipeline-arrow)"/>
<path d="M160 116 V140" class="d-line" marker-end="url(#pipeline-arrow)"/>
<path d="M160 186 V210" class="d-line" marker-end="url(#pipeline-arrow)"/>
<path d="M160 256 V280" class="d-line" marker-end="url(#pipeline-arrow)"/>
<path d="M160 356 V380" class="d-line" marker-end="url(#pipeline-arrow)"/>
<rect x="60" y="6" width="200" height="40" rx="6" class="d-box"/>
<text x="160" y="31" text-anchor="middle" class="d-mono">FROM</text>
<rect x="60" y="76" width="200" height="40" rx="6" class="d-box"/>
<text x="160" y="101" text-anchor="middle" class="d-mono">WHERE</text>
<rect x="60" y="146" width="200" height="40" rx="6" class="d-box"/>
<text x="160" y="171" text-anchor="middle" class="d-mono">GROUP BY</text>
<rect x="60" y="216" width="200" height="40" rx="6" class="d-box"/>
<text x="160" y="241" text-anchor="middle" class="d-mono">HAVING</text>
<rect x="30" y="286" width="260" height="70" rx="6" class="d-box-accent"/>
<text x="160" y="311" text-anchor="middle" class="d-mono d-bold">window functions</text>
<text x="160" y="330" text-anchor="middle" class="d-small">OVER runs here, on</text>
<text x="160" y="346" text-anchor="middle" class="d-small">whatever HAVING left</text>
<rect x="60" y="386" width="200" height="40" rx="6" class="d-box"/>
<text x="160" y="411" text-anchor="middle" class="d-mono">SELECT list</text>
<text x="20" y="440" class="d-muted d-small">ORDER BY and DISTINCT run last,</text>
<text x="20" y="456" class="d-muted d-small">after every step drawn above.</text>
</svg>
<figcaption>Figure 1. FROM through HAVING can turn many rows into few (or none). Window functions read whatever those steps left, one row at a time, before the final SELECT list and ORDER BY.</figcaption>
</figure>

That order is also why a window function cannot appear in `WHERE` or `HAVING`: both clauses run before the step that evaluates it. The next two sections put that fixed order to work.

## Window functions keep every row

Rewrite the member-fee query so that, instead of five collapsed rows, every loan keeps its own row and carries its member's total alongside it:

```sql run
SELECT loan_id, member_id, late_fee,
       SUM(late_fee) OVER (
         PARTITION BY member_id
       ) AS member_total
FROM loan
WHERE member_id IN (1, 2)
ORDER BY member_id, loan_id;
```

```text output
loan_id  member_id  late_fee  member_total
-------  ---------  --------  ------------
101      1          2         10
102      1          3         10
103      1          0         10
104      1          5         10
105      2          0         4
106      2          4         4
107      2          0         4
```

Seven rows in, seven rows out. `SUM(late_fee) OVER (PARTITION BY member_id)` is a **window function**: syntactically an aggregate function, `SUM`, but followed by an `OVER` clause instead of a `GROUP BY`. PostgreSQL's tutorial states the contrast directly: a window function "performs a calculation across a set of table rows that are somehow related to the current row," comparable to an aggregate, but "window functions do not cause rows to become grouped into a single output row... [i]nstead, the rows retain their separate identities" ([PostgreSQL: Window Functions tutorial](https://www.postgresql.org/docs/current/tutorial-window.html)). `PARTITION BY` plays the role `GROUP BY` played before: it decides which rows share a computation. The difference is entirely in what happens to the rows once the computation is done. `GROUP BY` throws the individual rows away and keeps the summary. `OVER` keeps the individual rows and attaches the summary to each one.

<figure class="diagram">
<svg viewBox="0 0 340 380" role="img" aria-labelledby="collapse-title collapse-desc">
<title id="collapse-title">Four loan rows aggregated with GROUP BY versus the same four rows with a window function</title>
<desc id="collapse-desc">Top: four small rows for member 1 feed into GROUP BY and come out as a single row holding the total, 10. Bottom: the same four rows feed into a window function and come out as four rows, each still showing its own fee but now also carrying the same total, 10, attached.</desc>
<text x="10" y="20" class="d-small d-bold">GROUP BY: rows collapse</text>
<rect x="10" y="30" width="60" height="24" rx="4" class="d-box"/><text x="40" y="46" text-anchor="middle" class="d-mono d-small">2</text>
<rect x="76" y="30" width="60" height="24" rx="4" class="d-box"/><text x="106" y="46" text-anchor="middle" class="d-mono d-small">3</text>
<rect x="142" y="30" width="60" height="24" rx="4" class="d-box"/><text x="172" y="46" text-anchor="middle" class="d-mono d-small">0</text>
<rect x="208" y="30" width="60" height="24" rx="4" class="d-box"/><text x="238" y="46" text-anchor="middle" class="d-mono d-small">5</text>
<path d="M140 60 V90" class="d-accent"/>
<rect x="90" y="94" width="100" height="34" rx="6" class="d-box-accent"/>
<text x="140" y="116" text-anchor="middle" class="d-mono d-bold">total = 10</text>
<text x="10" y="160" class="d-small d-bold">window function: rows stay</text>
<rect x="10" y="172" width="80" height="34" rx="4" class="d-box"/>
<text x="50" y="190" text-anchor="middle" class="d-mono d-small">fee 2</text>
<text x="50" y="202" text-anchor="middle" class="d-text-accent d-small">total 10</text>
<rect x="96" y="172" width="80" height="34" rx="4" class="d-box"/>
<text x="136" y="190" text-anchor="middle" class="d-mono d-small">fee 3</text>
<text x="136" y="202" text-anchor="middle" class="d-text-accent d-small">total 10</text>
<rect x="182" y="172" width="80" height="34" rx="4" class="d-box"/>
<text x="222" y="190" text-anchor="middle" class="d-mono d-small">fee 0</text>
<text x="222" y="202" text-anchor="middle" class="d-text-accent d-small">total 10</text>
<rect x="268" y="172" width="66" height="34" rx="4" class="d-box"/>
<text x="301" y="190" text-anchor="middle" class="d-mono d-small">fee 5</text>
<text x="301" y="202" text-anchor="middle" class="d-text-accent d-small">total 10</text>
<text x="10" y="240" class="d-muted d-small">Same input, same total. GROUP BY keeps</text>
<text x="10" y="256" class="d-muted d-small">one row and loses the individual fees;</text>
<text x="10" y="272" class="d-muted d-small">OVER keeps all four and adds the total</text>
<text x="10" y="288" class="d-muted d-small">to each one, so a later WHERE, ORDER BY</text>
<text x="10" y="304" class="d-muted d-small">or another window function downstream</text>
<text x="10" y="320" class="d-muted d-small">can still see every original row.</text>
</svg>
<figcaption>Figure 2. The same four rows and the same SUM, two different endings: GROUP BY produces one row, a window function produces four.</figcaption>
</figure>

Nothing stops the two from combining. `SUM(late_fee) OVER (PARTITION BY member_id)` computed directly over `loan` needed no `GROUP BY` at all, because it did not need to collapse anything; the next section ranks members by a `SUM` that is grouped first and ranked second, in the same query.

## Ranking: three functions, one set of ties

Aggregate the fees per member as before, then rank the results, all in one query. Because window functions run after `GROUP BY` and `HAVING` (Figure 1), a window function's `OVER` clause can freely reference `SUM(late_fee)`: by the time it runs, that sum is just another column of an already-grouped row.

```sql run
SELECT member_id,
       SUM(late_fee) AS total_fee,
       RANK() OVER (
         ORDER BY SUM(late_fee) DESC
       ) AS fee_rank,
       DENSE_RANK() OVER (
         ORDER BY SUM(late_fee) DESC
       ) AS fee_dense_rank,
       ROW_NUMBER() OVER (
         ORDER BY SUM(late_fee) DESC,
                  member_id
       ) AS fee_row_num
FROM loan
GROUP BY member_id
ORDER BY total_fee DESC, member_id;
```

```text output
member_id  total_fee  fee_rank  fee_dense_rank  fee_row_num
---------  ---------  --------  --------------  -----------
1          10         1         1               1
3          10         1         1               2
2          4          3         2               3
4          4          3         2               4
5          0          5         3               5
```

Members 1 and 3 tie at 10, and members 2 and 4 tie at 4, so all three ranking functions have something real to disagree about. `ROW_NUMBER()` breaks every tie: no two rows ever share a value, which is why the query gave it a full tiebreaker, `ORDER BY... member_id`, to make that number reproducible instead of arbitrary between ties. `RANK()` and `DENSE_RANK()` both let ties share a rank, but count differently afterwards. SQLite defines them by what each does to the row that comes after a tie: `rank()` is "the `row_number()` of the first peer in each group — the rank of the current row with gaps," while `dense_rank()` is "the rank of the current row's peer group... without gaps" ([SQLite: Window Functions](https://www.sqlite.org/windowfunctions.html#builtinwindowfunctions)). After the two-way tie at rank 1, `RANK()` jumps to 3, leaving a gap the size of the tie; `DENSE_RANK()` continues at 2, so the next distinct fee amount is never separated from the previous one by more than 1. `RANK()` answers "how many rows do better than or tie this one, plus one" (fee_rank 3 means two rows beat member 2); `DENSE_RANK()` answers "how many distinct fee totals are better" (fee_dense_rank 2 means one higher total exists, `10`).

SQL Server's ranking-function reference and PostgreSQL's window-function reference define all three the same way ([SQL Server: Ranking Functions](https://learn.microsoft.com/en-us/sql/t-sql/functions/ranking-functions-transact-sql); [PostgreSQL: Window Functions](https://www.postgresql.org/docs/current/functions-window.html#FUNCTIONS-WINDOW-TABLE)), and the `OVER (ORDER BY ...)` syntax carries over unchanged to both. One caution is specific to SQL Server's documentation: "[r]anking functions are nondeterministic" ([SQL Server: Ranking Functions](https://learn.microsoft.com/en-us/sql/t-sql/functions/ranking-functions-transact-sql)) — without a tiebreaker column, which of two tied rows gets which `ROW_NUMBER()` is not guaranteed to stay the same between runs, which is exactly why `member_id` is in this query's `ORDER BY` and not merely `SUM(late_fee) DESC` alone.

::::exercise[Extend the ranking query]
Add one more column to the query above: `fee_gap_to_leader`, the number of dollars each member owes less than whoever is ranked first. Member 1 and member 3 should both show `0`; member 5 should show `10`.

:::solution
`FIRST_VALUE` is a **frame-aware** window function: it "calculates the window frame for each row... [and] returns the value of _expr_ evaluated against the first row in the window frame" ([SQLite: Window Functions](https://www.sqlite.org/windowfunctions.html#builtinwindowfunctions)). With `ORDER BY SUM(late_fee) DESC` and the default frame (covered next), every row's frame starts at the very first row of the partition, so `FIRST_VALUE` always returns the leader's total, no matter which row it is evaluated for:

```sql run
SELECT member_id,
       SUM(late_fee) AS total_fee,
       FIRST_VALUE(SUM(late_fee)) OVER (
         ORDER BY SUM(late_fee) DESC
       ) - SUM(late_fee) AS fee_gap_to_leader
FROM loan
GROUP BY member_id
ORDER BY total_fee DESC, member_id;
```

```text output
member_id  total_fee  fee_gap_to_leader
---------  ---------  -----------------
1          10         0
3          10         0
2          4          6
4          4          6
5          0          10
```
:::
::::

## `LAG` and `LEAD`: comparing a row to its neighbor

`RANK` and `SUM(...) OVER (...)` both look at a whole partition at once. `LAG` and `LEAD` instead look sideways, at one specific neighboring row. Reusing every loan (not just member 1's), partitioned by member so that Ada's history never leaks into Boris's:

```sql run
SELECT member_id, loan_id, loaned_on,
       LAG(loaned_on) OVER (
         PARTITION BY member_id
         ORDER BY loaned_on, loan_id
       ) AS previous_loan,
       CAST(
         julianday(loaned_on) -
         julianday(LAG(loaned_on) OVER (
           PARTITION BY member_id
           ORDER BY loaned_on, loan_id
         ))
       AS INTEGER) AS days_since
FROM loan
WHERE member_id IN (1, 2)
ORDER BY member_id, loaned_on, loan_id;
```

```text output
member_id  loan_id  loaned_on   previous_loan  days_since
---------  -------  ----------  -------------  ----------
1          101      2026-08-03  NULL           NULL
1          102      2026-08-03  2026-08-03     0
1          103      2026-08-10  2026-08-03     7
1          104      2026-08-17  2026-08-10     7
2          105      2026-08-05  NULL           NULL
2          106      2026-08-12  2026-08-05     7
2          107      2026-08-19  2026-08-12     7
```

`LAG(loaned_on)` looks back one row within the current partition, in the order given by its own `ORDER BY`; `previous_loan` resets to `NULL` at the start of every member's partition, exactly the way `SUM(...) OVER (PARTITION BY ...)` reset earlier. Subtracting Julian day numbers turns two dates into a day count. `LEAD` is `LAG`'s mirror image, looking one row forward instead of back (`LEAD(loaned_on)` in the same query would return each row's *next* loan date); both accept an optional second argument for how many rows to skip and a third for what to return past the partition's edge, and both ignore any frame clause entirely: "[t]he frame-spec is ignored by both `lag()` and `lead()`" ([SQLite: Window Functions](https://www.sqlite.org/windowfunctions.html#builtinwindowfunctions)) — unlike `FIRST_VALUE`, `LAST_VALUE` and `NTH_VALUE`, which do respect it, as the next section shows why that matters.

## Frames: which rows the aggregate actually sees

Every window function that aggregates (`SUM`, `AVG`, `COUNT`, and the frame-aware trio above) works over a **frame**: the subset of the partition visible to the current row, not necessarily the whole partition. Leave the frame unstated and all three engines agree on the default. SQLite's documentation gives it exactly: "`RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW EXCLUDE NO OTHERS`," meaning the frame "read[s] all rows from the beginning of the partition up to and including the current row **and its peers**" ([SQLite: Window Functions](https://www.sqlite.org/windowfunctions.html#framespec)). PostgreSQL states the identical default, `RANGE UNBOUNDED PRECEDING`, and defines a peer as "a row that the window's `ORDER BY` clause considers equivalent to the current row" ([PostgreSQL: SELECT](https://www.postgresql.org/docs/current/sql-select.html#SQL-WINDOW)). SQL Server's `OVER` clause reference gives the same default frame, `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`, whenever `ORDER BY` is present and no explicit `ROWS`/`RANGE` is given ([SQL Server: OVER Clause](https://learn.microsoft.com/en-us/sql/t-sql/queries/select-over-clause-transact-sql#order-by)). The phrase "and its peers" is the part that goes wrong in an ordinary running total, because two loans on the same day are peers under `ORDER BY loaned_on` alone:

```sql run
SELECT loan_id, loaned_on, late_fee,
       SUM(late_fee) OVER (
         ORDER BY loaned_on
       ) AS running_total
FROM loan
WHERE member_id = 1
ORDER BY loaned_on, loan_id;
```

```text output
loan_id  loaned_on   late_fee  running_total
-------  ----------  --------  -------------
101      2026-08-03  2         5
102      2026-08-03  3         5
103      2026-08-10  0         5
104      2026-08-17  5         10
```

Loans 101 and 102 share `2026-08-03`, so under `RANGE`, each is a peer of the other, and the frame for *both* rows runs through their combined total, `5`, not the `2` a reader would expect after the first loan alone. A running total should never repeat like that. `ROWS` fixes it by counting physical rows instead of matching values, so peers stop mattering, at the cost of needing a tiebreaker in `ORDER BY` to make row order well-defined:

```sql run
SELECT loan_id, loaned_on, late_fee,
       SUM(late_fee) OVER (
         ORDER BY loaned_on, loan_id
         ROWS BETWEEN
           UNBOUNDED PRECEDING
           AND CURRENT ROW
       ) AS running_total
FROM loan
WHERE member_id = 1
ORDER BY loaned_on, loan_id;
```

```text output
loan_id  loaned_on   late_fee  running_total
-------  ----------  --------  -------------
101      2026-08-03  2         2
102      2026-08-03  3         5
103      2026-08-10  0         5
104      2026-08-17  5         10
```

Now each row's total includes exactly the rows at or before it in `loan_id` order, tie or no tie: `2`, then `2 + 3 = 5`, unaffected by the shared date. A cumulative sum, a running count, or any "so far" calculation over rows that might legitimately tie on the `ORDER BY` column should specify `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` explicitly rather than rely on the default; the two produce the same answer only when no two rows in the frame ever tie.

<figure class="diagram">
<svg viewBox="0 0 340 300" role="img" aria-labelledby="frame-title frame-desc">
<title id="frame-title">Default RANGE frame versus an explicit ROWS frame over the same tied rows</title>
<desc id="frame-desc">Top: under RANGE, the two rows dated August 3rd are peers, so one shared frame boundary encloses both, giving each the same running total of 5. Bottom: under ROWS, each row gets its own boundary counted by position, so the first row's frame stops at itself, giving 2, and only the second row's frame includes both, giving 5.</desc>
<text x="10" y="20" class="d-small d-bold">RANGE (default): peers share a frame</text>
<rect x="10" y="30" width="140" height="30" rx="4" class="d-box-accent"/>
<text x="80" y="50" text-anchor="middle" class="d-mono d-small">Aug 3: fee 2</text>
<rect x="154" y="30" width="140" height="30" rx="4" class="d-box-accent"/>
<text x="224" y="50" text-anchor="middle" class="d-mono d-small">Aug 3: fee 3</text>
<rect x="6" y="24" width="292" height="42" rx="8" class="d-line d-dashed"/>
<text x="10" y="86" class="d-text-accent d-small">one frame, both rows: total 5 for each</text>
<text x="10" y="130" class="d-small d-bold">ROWS: each row gets its own frame</text>
<rect x="10" y="140" width="140" height="30" rx="4" class="d-box"/>
<text x="80" y="160" text-anchor="middle" class="d-mono d-small">Aug 3: fee 2</text>
<rect x="154" y="140" width="140" height="30" rx="4" class="d-box"/>
<text x="224" y="160" text-anchor="middle" class="d-mono d-small">Aug 3: fee 3</text>
<rect x="6" y="134" width="150" height="42" rx="8" class="d-line d-dashed"/>
<text x="10" y="192" class="d-text-good d-small">row 1's frame: total 2</text>
<rect x="6" y="134" width="294" height="42" rx="8" class="d-good"/>
<text x="10" y="216" class="d-text-good d-small">row 2's frame: total 5</text>
<text x="10" y="256" class="d-muted d-small">Same two rows, same ORDER BY column value.</text>
<text x="10" y="272" class="d-muted d-small">RANGE groups tied values into one boundary;</text>
<text x="10" y="288" class="d-muted d-small">ROWS BETWEEN counts rows regardless of ties.</text>
</svg>
<figcaption>Figure 3. The default frame treats same-day loans as one unit; an explicit ROWS frame treats every row as its own step, which is what a running total almost always wants.</figcaption>
</figure>

Frames are not only for running totals: they can look both ways. `ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING` computes a centered moving average, one loan on either side of the current one:

```sql run
SELECT loan_id, loaned_on, late_fee,
       ROUND(AVG(late_fee) OVER (
         ORDER BY loaned_on, loan_id
         ROWS BETWEEN 1 PRECEDING
           AND 1 FOLLOWING
       ), 2) AS moving_avg
FROM loan
WHERE member_id = 1
ORDER BY loaned_on, loan_id;
```

```text output
loan_id  loaned_on   late_fee  moving_avg
-------  ----------  --------  ----------
101      2026-08-03  2         2.5
102      2026-08-03  3         1.67
103      2026-08-10  0         2.67
104      2026-08-17  5         2.5
```

The first and last rows still work, because a `PRECEDING`/`FOLLOWING` boundary that runs off the end of the partition is simply clipped to what exists, not treated as an error.

## Top-N per group, without losing the rest of the query

A natural next question — the two most recent loans per member — looks like it should filter on a window function directly. It cannot:

```text
SELECT member_id, loan_id, loaned_on,
       ROW_NUMBER() OVER (
         PARTITION BY member_id
         ORDER BY loaned_on DESC
       ) AS rn
FROM loan
WHERE rn <= 2;
```

::::exercise[Find the bug]
Run the query above. It fails before returning a single row. Using Figure 1, explain why `rn` is not available to `WHERE`, and rewrite the query so it works.

:::solution
`WHERE` is evaluated before the `SELECT` list, and `rn` is defined *in* the `SELECT` list — Figure 1 puts window functions after `WHERE`, not before it. SQLite's own window-function documentation states the restriction directly: "[w]indow functions may only appear in the result set and in the `ORDER BY` clause of a SELECT statement" ([SQLite: Window Functions](https://www.sqlite.org/windowfunctions.html#winfuncoverview)). Running the query confirms it:

```sql run error
SELECT member_id, loan_id, loaned_on,
       ROW_NUMBER() OVER (
         PARTITION BY member_id
         ORDER BY loaned_on DESC
       ) AS rn
FROM loan
WHERE rn <= 2;
```

```text output
misuse of aliased window function rn
```

The fix wraps the ranked query in a subquery (or a `WITH` clause) and filters the *outer* query, whose `WHERE` clause runs against `rn` as an ordinary already-computed column:

```sql run
WITH ranked AS (
  SELECT member_id, loan_id, loaned_on,
         ROW_NUMBER() OVER (
           PARTITION BY member_id
           ORDER BY loaned_on DESC
         ) AS rn
  FROM loan
)
SELECT member_id, loan_id, loaned_on
FROM ranked
WHERE rn <= 2
ORDER BY member_id, loaned_on DESC;
```

```text output
member_id  loan_id  loaned_on
---------  -------  ----------
1          104      2026-08-17
1          103      2026-08-10
2          107      2026-08-19
2          106      2026-08-12
3          109      2026-08-20
3          108      2026-08-06
4          110      2026-08-08
5          111      2026-08-21
```

Members 4 and 5 only ever had one loan each, so they contribute one row, not two; "top 2" means "at most 2," which this query gets right without any special-casing, because `rn <= 2` is simply never true a second time for those partitions.
:::
::::

`ROW_NUMBER()` is the right tool for top-N specifically because, unlike `RANK()`, it never lets two rows tie for the cutoff: "the most recent loan" for a member with two loans on the same day still needs exactly one winner, which `RANK()` would hand back as a two-way tie for first place, both included. Swapping in `RANK()` instead of `ROW_NUMBER()` in the CTE, then filtering `rn <= 1`, is the standard way to say "the leader, and everyone tied with the leader" — a different, occasionally useful question from "exactly one row per group."

## The vocabulary, side by side

Every query on this page has been built from a small vocabulary, and the two branches never actually overlap:

- **`GROUP BY`** collapses rows sharing a key into one row per key; **`HAVING`** filters those collapsed rows by an aggregate; the input rows are gone from the result.
- **A window function** (`OVER`, with `PARTITION BY`, `ORDER BY` and optionally a frame) computes a value **per row**, from a set of related rows, without collapsing anything; `RANK`/`DENSE_RANK`/`ROW_NUMBER` rank within a partition, `LAG`/`LEAD` read a neighboring row, and frame-aware functions like `SUM`, `FIRST_VALUE` and the moving average above see only the rows the frame includes.

The two combine, as the ranking query did, precisely because they run at different, fixed points in the same pipeline: `GROUP BY` and `HAVING` decide what rows exist by the time the `SELECT` list runs, and window functions are simply part of that `SELECT` list, reading whatever those earlier steps left behind.
