---
title: "SQL Joins Explained with Rows, Not Venn Diagrams"
description: "Inner, left, full, cross and self joins traced row by row on two tiny tables, plus the NULL, ON-versus-WHERE and duplicate-row bugs that Venn diagrams hide."
pillar: databases
order: 2
author: markus
published: 2026-09-18
updated: 2026-09-18
level: beginner
tags: [sql, joins, null-handling, sqlite]
prerequisites: []
sources:
  - title: "PostgreSQL Documentation: 7.2. Table Expressions (joined tables)"
    url: "https://www.postgresql.org/docs/current/queries-table-expressions.html"
    publisher: "PostgreSQL Global Development Group"
    accessed: 2026-09-18
  - title: "SQLite: SELECT (FROM clause processing, special handling of CROSS JOIN)"
    url: "https://www.sqlite.org/lang_select.html"
    publisher: "SQLite"
    accessed: 2026-09-18
  - title: "SQLite: SQL Language Expressions (the IS and IS NOT operators)"
    url: "https://www.sqlite.org/lang_expr.html"
    publisher: "SQLite"
    accessed: 2026-09-18
  - title: "PostgreSQL Documentation: 9.2. Comparison Functions and Operators"
    url: "https://www.postgresql.org/docs/current/functions-comparison.html"
    publisher: "PostgreSQL Global Development Group"
    accessed: 2026-09-18
  - title: "PostgreSQL Documentation: 9.24. Subquery Expressions (EXISTS, NOT IN)"
    url: "https://www.postgresql.org/docs/current/functions-subquery.html"
    publisher: "PostgreSQL Global Development Group"
    accessed: 2026-09-18
  - title: "Joins (SQL Server)"
    url: "https://learn.microsoft.com/en-us/sql/relational-databases/performance/joins?view=sql-server-ver17"
    publisher: "Microsoft Learn"
    accessed: 2026-09-18
  - title: "The SQLite Query Optimizer Overview"
    url: "https://www.sqlite.org/optoverview.html"
    publisher: "SQLite"
    accessed: 2026-09-18
  - title: "SQLite Release 3.39.0"
    url: "https://www.sqlite.org/releaselog/3_39_0.html"
    publisher: "SQLite"
    accessed: 2026-09-18
  - title: "MySQL 8.4 Reference Manual: JOIN Clause"
    url: "https://dev.mysql.com/doc/refman/8.4/en/join.html"
    publisher: "Oracle"
    accessed: 2026-09-18
  - title: "MySQL 8.4 Reference Manual: Comparison Functions and Operators"
    url: "https://dev.mysql.com/doc/refman/8.4/en/comparison-operators.html"
    publisher: "Oracle"
    accessed: 2026-09-18
  - title: "IS [NOT] DISTINCT FROM (Transact-SQL)"
    url: "https://learn.microsoft.com/en-us/sql/t-sql/queries/is-distinct-from-transact-sql?view=sql-server-ver17"
    publisher: "Microsoft Learn"
    accessed: 2026-09-18
  - title: "PostgreSQL Documentation: Planner/Optimizer (join strategies)"
    url: "https://www.postgresql.org/docs/current/planner-optimizer.html"
    publisher: "PostgreSQL Global Development Group"
    accessed: 2026-09-18
  - title: "PostgreSQL Documentation: Operator Optimization Information (HASHES, MERGES)"
    url: "https://www.postgresql.org/docs/current/xoper-optimization.html"
    publisher: "PostgreSQL Global Development Group"
    accessed: 2026-09-18
  - title: "Spark SQL Reference: JOIN (semi join, anti join)"
    url: "https://spark.apache.org/docs/latest/sql-ref-syntax-qry-select-join.html"
    publisher: "Apache Software Foundation"
    accessed: 2026-09-18
  - title: "dotnet/runtime: System.Linq Lookup.cs (CreateForJoin)"
    url: "https://github.com/dotnet/runtime/blob/main/src/libraries/System.Linq/src/System/Linq/Lookup.cs"
    publisher: "GitHub"
    accessed: 2026-09-18
draft: false
---

A librarian asks for one small report: every member, and how many books each has on loan. The library has four members and five loans, so you can check any answer by eye.

```sql run
CREATE TABLE member (
  member_id   INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  referred_by INTEGER
    REFERENCES member (member_id)
);

CREATE TABLE loan (
  loan_id   INTEGER PRIMARY KEY,
  member_id INTEGER
    REFERENCES member (member_id),
  title     TEXT NOT NULL,
  late_fee  INTEGER NOT NULL DEFAULT 0
);

INSERT INTO member
  (member_id, name, referred_by)
VALUES
  (1, 'Ada',   NULL),
  (2, 'Boris', 1),
  (3, 'Chen',  1),
  (4, 'Dalia', 3);

INSERT INTO loan
  (loan_id, member_id, title, late_fee)
VALUES
  (101, 1,    'Dune',    3),
  (102, 1,    'Emma',    2),
  (103, 2,    'Ulysses', 0),
  (104, 3,    'Hamlet',  5),
  (105, NULL, 'Beloved', 0);
```

To follow along, run the statements on this page in order in one SQLite session; the results shown come from SQLite 3.50, and `FULL JOIN` needs 3.39 or later. Two rows are there to cause trouble. Dalia has borrowed nothing. Loan 105 was typed in from a paper slip with no legible name, so its `member_id` is `NULL`: the book is out, and nobody knows who has it.

## Three attempts at one report

The first attempt joins the tables and counts:

```sql run
SELECT m.name, COUNT(*) AS loans
FROM member AS m
JOIN loan AS l
  ON l.member_id = m.member_id
GROUP BY m.member_id, m.name
ORDER BY m.name;
```

```text output
name   loans
-----  -----
Ada    2
Boris  1
Chen   1
```

Dalia is missing, and a report of "every member" that silently drops members is wrong. The obvious next step is a `LEFT JOIN`:

```sql run
SELECT m.name, COUNT(*) AS loans
FROM member AS m
LEFT JOIN loan AS l
  ON l.member_id = m.member_id
GROUP BY m.member_id, m.name
ORDER BY m.name;
```

```text output
name   loans
-----  -----
Ada    2
Boris  1
Chen   1
Dalia  1
```

Dalia is back, and now the report says she has one book. She has none. The third attempt changes what is counted:

```sql run
SELECT m.name,
       COUNT(l.loan_id) AS loans
FROM member AS m
LEFT JOIN loan AS l
  ON l.member_id = m.member_id
GROUP BY m.member_id, m.name
ORDER BY m.name;
```

```text output
name   loans
-----  -----
Ada    2
Boris  1
Chen   1
Dalia  0
```

This one is right. But if you cannot say *why* the second query produced a 1 and the third a 0, you got there by luck, and the Venn-diagram picture of joins, two overlapping circles, cannot tell you. Circles have no rows in them. The rest of this page replaces them with a picture that does.

## Draw a line for every matching pair

Put the two tables side by side and draw a line from each loan to the member whose `member_id` it carries. That is all the `ON` clause says: *these two rows belong together when this comparison is true*.

<figure class="diagram">
<svg viewBox="0 0 350 330" role="img" aria-labelledby="jm-title jm-desc">
<title id="jm-title">Match lines between member rows and loan rows</title>
<desc id="jm-desc">Four member rows on the left and five loan rows on the right, each loan showing its member_id and title. Ada is connected to two loans, Boris to one, Chen to one. Dalia has no line, and the loan of Beloved, whose member_id is NULL, has no line either.</desc>
<text x="6" y="20" class="d-mono d-bold">member</text>
<text x="200" y="20" class="d-mono d-bold">loan</text>
<text x="16" y="40" class="d-mono d-small d-muted">member_id</text><text x="90" y="40" class="d-mono d-small d-muted">name</text>
<text x="210" y="40" class="d-mono d-small d-muted">member_id</text><text x="284" y="40" class="d-mono d-small d-muted">title</text>
<path d="M136 95 L200 70" class="d-accent"/>
<path d="M136 95 L200 122" class="d-accent"/>
<path d="M136 153 L200 174" class="d-accent"/>
<path d="M136 211 L200 226" class="d-accent"/>
<rect x="6" y="75" width="130" height="40" rx="6" class="d-box"/><text x="16" y="100" class="d-mono">1</text><text x="90" y="100">Ada</text>
<rect x="6" y="133" width="130" height="40" rx="6" class="d-box"/><text x="16" y="158" class="d-mono">2</text><text x="90" y="158">Boris</text>
<rect x="6" y="191" width="130" height="40" rx="6" class="d-box"/><text x="16" y="216" class="d-mono">3</text><text x="90" y="216">Chen</text>
<rect x="6" y="249" width="130" height="40" rx="6" class="d-box-warn"/><text x="16" y="274" class="d-mono">4</text><text x="90" y="274">Dalia</text>
<text x="6" y="310" class="d-muted d-small">no loan carries a 4</text>
<rect x="200" y="50" width="144" height="40" rx="6" class="d-box"/><text x="210" y="75" class="d-mono">1</text><text x="284" y="75">Dune</text>
<rect x="200" y="102" width="144" height="40" rx="6" class="d-box"/><text x="210" y="127" class="d-mono">1</text><text x="284" y="127">Emma</text>
<rect x="200" y="154" width="144" height="40" rx="6" class="d-box"/><text x="210" y="179" class="d-mono">2</text><text x="284" y="179">Ulysses</text>
<rect x="200" y="206" width="144" height="40" rx="6" class="d-box"/><text x="210" y="231" class="d-mono">3</text><text x="284" y="231">Hamlet</text>
<rect x="200" y="258" width="144" height="40" rx="6" class="d-box-warn"/><text x="210" y="283" class="d-mono">NULL</text><text x="284" y="283">Beloved</text>
<text x="200" y="319" class="d-muted d-small">NULL matches nothing</text>
</svg>
<figcaption>Figure 1. Four lines, so an inner join returns four rows. Ada sits at the end of two of them and will appear twice. The two amber rows touch no line; outer joins exist to decide what happens to them.</figcaption>
</figure>

**One line is one result row.** An inner join returns exactly the lines:

```sql run
SELECT m.name, l.title
FROM member AS m
INNER JOIN loan AS l
  ON l.member_id = m.member_id
ORDER BY m.name, l.title;
```

```text output
name   title
-----  -------
Ada    Dune
Ada    Emma
Boris  Ulysses
Chen   Hamlet
```

`JOIN` on its own means `INNER JOIN`. Each result row is a *pair*: one member row glued to one loan row. It is not a member and it is not a loan, which is the first thing the circles get wrong.

`ON` takes any Boolean expression, the same kind `WHERE` accepts. Equality between a [foreign key](/databases/relational-model-and-keys/) and the key it points at is the usual condition, but a range or an inequality draws lines just as well, and one later section adds a second condition with `AND`.

When the two columns share a name, as they do here, `USING (member_id)` is shorthand for the equality. It also merges the two columns into one in the output, which is why the unqualified `member_id` below is not ambiguous:

```sql run
SELECT member_id, name, title
FROM member
JOIN loan USING (member_id)
ORDER BY name, title;
```

```text output
member_id  name   title
---------  -----  -------
1          Ada    Dune
1          Ada    Emma
2          Boris  Ulysses
3          Chen   Hamlet
```

`NATURAL JOIN` goes one step further and joins on *every* pair of columns that happen to share a name, without listing them. Avoid it. The [PostgreSQL manual's section on joined tables](https://www.postgresql.org/docs/current/queries-table-expressions.html#QUERIES-JOIN) calls it "considerably more risky" than `USING`, because adding a column to either table can silently change the join condition: give `loan` a `name` column and `member NATURAL JOIN loan` starts demanding that the member's name equal it.

## Where the lines come from: every pair, then a filter

SQLite's documentation defines every join with one recipe, and it is simpler than the keyword list suggests. Start from the **cross product** (also called the Cartesian product): every row of the left table paired with every row of the right. Then evaluate the `ON` expression for each pair and keep the pairs where it is true. [SQLite's description of the `FROM` clause](https://www.sqlite.org/lang_select.html#fromclause) says it outright: "All joins in SQLite are based on the cartesian product of the left and right-hand datasets." [PostgreSQL's manual](https://www.postgresql.org/docs/current/queries-table-expressions.html#QUERIES-JOIN) describes the same thing from the other end: `T1 CROSS JOIN T2` is equivalent to `T1 INNER JOIN T2 ON TRUE`, an inner join whose filter lets every pair through.

With 4 members and 5 loans there are 4 × 5 = 20 pairs:

```sql run
SELECT COUNT(*) AS pairs
FROM member CROSS JOIN loan;
```

```text output
pairs
-----
20
```

<figure class="diagram">
<svg viewBox="0 0 350 330" role="img" aria-labelledby="jg-title jg-desc">
<title id="jg-title">The 20 member and loan pairs with the ON test evaluated in each</title>
<desc id="jg-desc">A grid with one row per loan and one column per member; each header shows the member_id under the name or title. Each cell shows the comparison of the loan's member_id with the member's member_id and its result. Four cells are true. Every cell in the Beloved row is NULL because that loan's member_id is NULL. The remaining cells are false.</desc>
<rect x="4" y="6" width="78" height="48" class="d-box-2"/><text x="43" y="28" text-anchor="middle" class="d-small d-muted">name and</text><text x="43" y="44" text-anchor="middle" class="d-small d-muted">member_id</text>
<rect x="82" y="6" width="66" height="48" class="d-box-2"/><text x="115" y="27" text-anchor="middle" class="d-bold">Ada</text><text x="115" y="46" text-anchor="middle" class="d-mono">1</text>
<rect x="148" y="6" width="66" height="48" class="d-box-2"/><text x="181" y="27" text-anchor="middle" class="d-bold">Boris</text><text x="181" y="46" text-anchor="middle" class="d-mono">2</text>
<rect x="214" y="6" width="66" height="48" class="d-box-2"/><text x="247" y="27" text-anchor="middle" class="d-bold">Chen</text><text x="247" y="46" text-anchor="middle" class="d-mono">3</text>
<rect x="280" y="6" width="66" height="48" class="d-box-2"/><text x="313" y="27" text-anchor="middle" class="d-bold">Dalia</text><text x="313" y="46" text-anchor="middle" class="d-mono">4</text>
<rect x="4" y="54" width="78" height="50" class="d-box-2"/><text x="43" y="75" text-anchor="middle" class="d-bold">Dune</text><text x="43" y="94" text-anchor="middle" class="d-mono">1</text>
<rect x="82" y="54" width="66" height="50" class="d-box-good"/><text x="115" y="73" text-anchor="middle" class="d-mono d-small">1 = 1</text><text x="115" y="94" text-anchor="middle" class="d-bold d-text-good">true</text>
<rect x="148" y="54" width="66" height="50" class="d-box"/><text x="181" y="73" text-anchor="middle" class="d-mono d-small">1 = 2</text><text x="181" y="94" text-anchor="middle" class="d-muted">false</text>
<rect x="214" y="54" width="66" height="50" class="d-box"/><text x="247" y="73" text-anchor="middle" class="d-mono d-small">1 = 3</text><text x="247" y="94" text-anchor="middle" class="d-muted">false</text>
<rect x="280" y="54" width="66" height="50" class="d-box"/><text x="313" y="73" text-anchor="middle" class="d-mono d-small">1 = 4</text><text x="313" y="94" text-anchor="middle" class="d-muted">false</text>
<rect x="4" y="104" width="78" height="50" class="d-box-2"/><text x="43" y="125" text-anchor="middle" class="d-bold">Emma</text><text x="43" y="144" text-anchor="middle" class="d-mono">1</text>
<rect x="82" y="104" width="66" height="50" class="d-box-good"/><text x="115" y="123" text-anchor="middle" class="d-mono d-small">1 = 1</text><text x="115" y="144" text-anchor="middle" class="d-bold d-text-good">true</text>
<rect x="148" y="104" width="66" height="50" class="d-box"/><text x="181" y="123" text-anchor="middle" class="d-mono d-small">1 = 2</text><text x="181" y="144" text-anchor="middle" class="d-muted">false</text>
<rect x="214" y="104" width="66" height="50" class="d-box"/><text x="247" y="123" text-anchor="middle" class="d-mono d-small">1 = 3</text><text x="247" y="144" text-anchor="middle" class="d-muted">false</text>
<rect x="280" y="104" width="66" height="50" class="d-box"/><text x="313" y="123" text-anchor="middle" class="d-mono d-small">1 = 4</text><text x="313" y="144" text-anchor="middle" class="d-muted">false</text>
<rect x="4" y="154" width="78" height="50" class="d-box-2"/><text x="43" y="175" text-anchor="middle" class="d-bold">Ulysses</text><text x="43" y="194" text-anchor="middle" class="d-mono">2</text>
<rect x="82" y="154" width="66" height="50" class="d-box"/><text x="115" y="173" text-anchor="middle" class="d-mono d-small">2 = 1</text><text x="115" y="194" text-anchor="middle" class="d-muted">false</text>
<rect x="148" y="154" width="66" height="50" class="d-box-good"/><text x="181" y="173" text-anchor="middle" class="d-mono d-small">2 = 2</text><text x="181" y="194" text-anchor="middle" class="d-bold d-text-good">true</text>
<rect x="214" y="154" width="66" height="50" class="d-box"/><text x="247" y="173" text-anchor="middle" class="d-mono d-small">2 = 3</text><text x="247" y="194" text-anchor="middle" class="d-muted">false</text>
<rect x="280" y="154" width="66" height="50" class="d-box"/><text x="313" y="173" text-anchor="middle" class="d-mono d-small">2 = 4</text><text x="313" y="194" text-anchor="middle" class="d-muted">false</text>
<rect x="4" y="204" width="78" height="50" class="d-box-2"/><text x="43" y="225" text-anchor="middle" class="d-bold">Hamlet</text><text x="43" y="244" text-anchor="middle" class="d-mono">3</text>
<rect x="82" y="204" width="66" height="50" class="d-box"/><text x="115" y="223" text-anchor="middle" class="d-mono d-small">3 = 1</text><text x="115" y="244" text-anchor="middle" class="d-muted">false</text>
<rect x="148" y="204" width="66" height="50" class="d-box"/><text x="181" y="223" text-anchor="middle" class="d-mono d-small">3 = 2</text><text x="181" y="244" text-anchor="middle" class="d-muted">false</text>
<rect x="214" y="204" width="66" height="50" class="d-box-good"/><text x="247" y="223" text-anchor="middle" class="d-mono d-small">3 = 3</text><text x="247" y="244" text-anchor="middle" class="d-bold d-text-good">true</text>
<rect x="280" y="204" width="66" height="50" class="d-box"/><text x="313" y="223" text-anchor="middle" class="d-mono d-small">3 = 4</text><text x="313" y="244" text-anchor="middle" class="d-muted">false</text>
<rect x="4" y="254" width="78" height="50" class="d-box-2"/><text x="43" y="275" text-anchor="middle" class="d-bold">Beloved</text><text x="43" y="294" text-anchor="middle" class="d-mono">NULL</text>
<rect x="82" y="254" width="66" height="50" class="d-box-warn"/><text x="115" y="273" text-anchor="middle" class="d-mono d-small">NULL = 1</text><text x="115" y="294" text-anchor="middle" class="d-bold">NULL</text>
<rect x="148" y="254" width="66" height="50" class="d-box-warn"/><text x="181" y="273" text-anchor="middle" class="d-mono d-small">NULL = 2</text><text x="181" y="294" text-anchor="middle" class="d-bold">NULL</text>
<rect x="214" y="254" width="66" height="50" class="d-box-warn"/><text x="247" y="273" text-anchor="middle" class="d-mono d-small">NULL = 3</text><text x="247" y="294" text-anchor="middle" class="d-bold">NULL</text>
<rect x="280" y="254" width="66" height="50" class="d-box-warn"/><text x="313" y="273" text-anchor="middle" class="d-mono d-small">NULL = 4</text><text x="313" y="294" text-anchor="middle" class="d-bold">NULL</text>
<text x="4" y="322" class="d-muted d-small">cell: loan.member_id = member.member_id; 4 of 20 true</text>
</svg>
<figcaption>Figure 2. The same four matches as Figure 1, seen as a filter over all 20 pairs. Dalia's column has no green cell and Beloved's row has none either: its comparisons are not false but NULL, which the filter also rejects.</figcaption>
</figure>

You can run that definition literally. A `CROSS JOIN` with the condition moved to `WHERE` returns the same four rows as the `INNER JOIN` above:

```sql run
SELECT m.name, l.title
FROM member AS m
CROSS JOIN loan AS l
WHERE l.member_id = m.member_id
ORDER BY m.name, l.title;
```

```text output
name   title
-----  -------
Ada    Dune
Ada    Emma
Boris  Ulysses
Chen   Hamlet
```

The rows are the same; how they are computed need not be. In SQLite specifically, [`CROSS JOIN` has a side effect](https://www.sqlite.org/lang_select.html#crossjoin): it produces the same result as `INNER JOIN` but stops the optimizer from reordering the two tables, so it is not a spelling to reach for when you mean an inner join.

The cross product is the *definition* of the result, not the way it is computed; the [last section](#what-the-engine-does-instead-of-building-every-pair) covers what engines really do. A cross join is also sometimes what you want on its own, when you need every combination: each member against each weekend day for a volunteer rota, say.

```sql run
WITH day (day_name) AS (
  VALUES ('Sat'), ('Sun')
)
SELECT m.name, day.day_name
FROM member AS m
CROSS JOIN day
WHERE m.member_id <= 2
ORDER BY m.name, day.day_name;
```

```text output
name   day_name
-----  --------
Ada    Sat
Ada    Sun
Boris  Sat
Boris  Sun
```

:::pitfall
A join with a forgotten or always-true condition *is* a cross join. Two tables of 100,000 rows each produce ten billion pairs. If a query that used to return in milliseconds never comes back after you added a table to the `FROM` clause, check that the new table has an `ON` condition that mentions it.
:::

## Outer joins put the unmatched rows back

An inner join discards Dalia and Beloved because neither touches a line. The three outer joins are the inner join plus a repair step, and the [PostgreSQL manual](https://www.postgresql.org/docs/current/queries-table-expressions.html#QUERIES-JOIN) defines them in exactly that order: first the inner join is performed, then, for each row of the preserved table that matched nothing, one extra row is added with `NULL` in every column of the other table.

`LEFT JOIN` preserves the table written to the left of the keyword:

```sql run
SELECT m.name, l.loan_id, l.title
FROM member AS m
LEFT JOIN loan AS l
  ON l.member_id = m.member_id
ORDER BY m.name, l.title;
```

```text output
name   loan_id  title
-----  -------  -------
Ada    101      Dune
Ada    102      Emma
Boris  103      Ulysses
Chen   104      Hamlet
Dalia  NULL     NULL
```

This result explains the first puzzle. Dalia's padding row is a real row, so `COUNT(*)`, which counts rows, counted it and reported 1. `COUNT(l.loan_id)` counts only the rows where `l.loan_id` is not `NULL`, and in the padding row it is `NULL`, so it reported 0. When you count the far side of an outer join, count a column from the far side that cannot be `NULL` in a real match; the [primary key](/glossary/#primary-key) is the safe choice.

`RIGHT JOIN` preserves the table on the other side of the keyword. Here that is `loan`, so Dalia goes and the unclaimed book comes back:

```sql run
SELECT m.name, l.title
FROM member AS m
RIGHT JOIN loan AS l
  ON l.member_id = m.member_id
ORDER BY l.loan_id;
```

```text output
name   title
-----  -------
Ada    Dune
Ada    Emma
Boris  Ulysses
Chen   Hamlet
NULL   Beloved
```

`FULL JOIN` preserves both tables:

```sql run
SELECT m.name, l.title
FROM member AS m
FULL JOIN loan AS l
  ON l.member_id = m.member_id
ORDER BY m.name IS NULL,
         m.name, l.title;
```

```text output
name   title
-----  -------
Ada    Dune
Ada    Emma
Boris  Ulysses
Chen   Hamlet
Dalia  NULL
NULL   Beloved
```

<figure class="diagram">
<svg viewBox="0 0 350 300" role="img" aria-labelledby="jo-title jo-desc">
<title id="jo-title">Which result rows each join type keeps</title>
<desc id="jo-desc">Six result rows are listed: Dalia padded with NULL, the four matched pairs, and NULL padded with Beloved. Brackets show that INNER keeps the four matched pairs, LEFT adds the Dalia row, RIGHT adds the Beloved row, and FULL keeps all six.</desc>
<text x="16" y="26" class="d-mono d-bold">m.name</text>
<text x="92" y="26" class="d-mono d-bold">l.title</text>
<rect x="6" y="43" width="164" height="34" class="d-box-warn"/><text x="16" y="65">Dalia</text><text x="92" y="65" class="d-mono d-muted">NULL</text>
<rect x="6" y="81" width="164" height="34" class="d-box"/><text x="16" y="103">Ada</text><text x="92" y="103">Dune</text>
<rect x="6" y="119" width="164" height="34" class="d-box"/><text x="16" y="141">Ada</text><text x="92" y="141">Emma</text>
<rect x="6" y="157" width="164" height="34" class="d-box"/><text x="16" y="179">Boris</text><text x="92" y="179">Ulysses</text>
<rect x="6" y="195" width="164" height="34" class="d-box"/><text x="16" y="217">Chen</text><text x="92" y="217">Hamlet</text>
<rect x="6" y="233" width="164" height="34" class="d-box-warn"/><text x="16" y="255" class="d-mono d-muted">NULL</text><text x="92" y="255">Beloved</text>
<text x="199" y="26" text-anchor="middle" class="d-bold d-small">INNER</text><path d="M189 81 H199 V229 H189" class="d-accent"/><text x="199" y="290" text-anchor="middle" class="d-muted d-small">4 rows</text>
<text x="243" y="26" text-anchor="middle" class="d-bold d-small">LEFT</text><path d="M233 43 H243 V229 H233" class="d-accent"/><text x="243" y="290" text-anchor="middle" class="d-muted d-small">5 rows</text>
<text x="287" y="26" text-anchor="middle" class="d-bold d-small">RIGHT</text><path d="M277 81 H287 V267 H277" class="d-accent"/><text x="287" y="290" text-anchor="middle" class="d-muted d-small">5 rows</text>
<text x="329" y="26" text-anchor="middle" class="d-bold d-small">FULL</text><path d="M319 43 H329 V267 H319" class="d-accent"/><text x="329" y="290" text-anchor="middle" class="d-muted d-small">6 rows</text>
</svg>
<figcaption>Figure 3. Every join type shares the four matched pairs in the middle. The types differ only in which amber padding rows they add: the left table's leftovers, the right table's, or both.</figcaption>
</figure>

`A RIGHT JOIN B` returns the same rows as `B LEFT JOIN A`, so you can write every one-sided outer join as a left join and read each query the same way: start from this table, optionally attach that one. `LEFT OUTER JOIN` and `LEFT JOIN` are the same thing; the word `OUTER` is optional.

Support for the other two is uneven, so check your engine before relying on them. SQLite gained `RIGHT` and `FULL` joins only in [version 3.39.0](https://www.sqlite.org/releaselog/3_39_0.html), released in June 2022. MySQL has no `FULL JOIN` at all: the grammar in its [`JOIN` clause reference](https://dev.mysql.com/doc/refman/8.4/en/join.html) offers only `LEFT` and `RIGHT` outer joins.

### A filter in WHERE quietly undoes a left join

The manager wants every member, with any loan that carries a late fee above 2 next to the name. The natural-looking query is wrong:

```sql run
SELECT m.name, l.title, l.late_fee
FROM member AS m
LEFT JOIN loan AS l
  ON l.member_id = m.member_id
WHERE l.late_fee > 2
ORDER BY m.name;
```

```text output
name  title   late_fee
----  ------  --------
Ada   Dune    3
Chen  Hamlet  5
```

Boris and Dalia are gone, as if the join were an inner join. `WHERE` runs after the join has finished, padding rows included. Dalia's padding row has `late_fee` `NULL`; `NULL > 2` is not true; the row is removed. Boris's only real row has a fee of 0 and is removed too, and nothing pads him back, because padding belongs to the join step, which is over.

A condition about the optional table belongs in `ON`, where it decides *which lines are drawn* rather than which finished rows survive:

```sql run
SELECT m.name, l.title, l.late_fee
FROM member AS m
LEFT JOIN loan AS l
  ON l.member_id = m.member_id
 AND l.late_fee > 2
ORDER BY m.name;
```

```text output
name   title   late_fee
-----  ------  --------
Ada    Dune    3
Boris  NULL    NULL
Chen   Hamlet  5
Dalia  NULL    NULL
```

Now only two lines are drawn (Ada–Dune and Chen–Hamlet), every other member is unmatched, and the left join pads all of them. The [PostgreSQL manual](https://www.postgresql.org/docs/current/queries-table-expressions.html#QUERIES-JOIN) makes the same point about its own example: a restriction in `ON` is processed before the join, one in `WHERE` after it, which "does not matter with inner joins, but it matters a lot with outer joins".

The mistake has a mirror image. A condition on the *preserved* table placed in `ON` filters nothing out, because `ON` can only stop lines being drawn, and a preserved row with no lines is padded, not removed. Someone who wants only members 1 and 2 and writes the test in `ON` still gets all four:

```sql run
SELECT m.name, l.title
FROM member AS m
LEFT JOIN loan AS l
  ON l.member_id = m.member_id
 AND m.member_id <= 2
ORDER BY m.name, l.title;
```

```text output
name   title
-----  -------
Ada    Dune
Ada    Emma
Boris  Ulysses
Chen   NULL
Dalia  NULL
```

Chen has lost his loan and kept his row. So, in a left join: a condition on the *left* table goes in `WHERE`, a condition on the *right* table goes in `ON`, unless removing unmatched rows is what you intend.

::::exercise[Two bugs in one report]
This query should list **every** member with the number of their loans that carry a late fee. It returns only Ada and Chen. Explain what happens to Boris and to Dalia, then fix it. There is a second bug waiting behind the first.

```sql run
SELECT m.name,
       COUNT(*) AS late_loans
FROM member AS m
LEFT JOIN loan AS l
  ON l.member_id = m.member_id
WHERE l.late_fee > 0
GROUP BY m.member_id, m.name
ORDER BY m.name;
```

```text output
name  late_loans
----  ----------
Ada   2
Chen  1
```

:::solution
The `WHERE` clause runs after the join: it removes Boris's only row (fee 0) and Dalia's padding row (`NULL > 0` is not true), so neither member reaches `GROUP BY`. Moving the condition into `ON` brings both back as padding rows, but then `COUNT(*)` would count each padding row as 1, the bug from the top of the page. Count a column of `loan` instead:

```sql run
SELECT m.name,
       COUNT(l.loan_id) AS late_loans
FROM member AS m
LEFT JOIN loan AS l
  ON l.member_id = m.member_id
 AND l.late_fee > 0
GROUP BY m.member_id, m.name
ORDER BY m.name;
```

```text output
name   late_loans
-----  ----------
Ada    2
Boris  0
Chen   1
Dalia  0
```
:::
::::

## NULL never equals anything, including NULL

The Beloved row of Figure 2 is amber, not grey, for a reason. SQL comparisons have three possible results: true, false and `NULL` (unknown). Any ordinary comparison with `NULL` on either side is `NULL`. SQLite prints true as 1 and false as 0:

```sql run
SELECT 1 = 1        AS same,
       1 = NULL     AS one_null,
       NULL = NULL  AS null_null,
       NULL IS NULL AS is_null;
```

```text output
same  one_null  null_null  is_null
----  --------  ---------  -------
1     NULL      NULL       1
```

`ON` keeps a pair only when the condition is *true*, so a `NULL` join key matches nothing, not even another `NULL`. Microsoft's documentation for SQL Server [states the consequence directly](https://learn.microsoft.com/en-us/sql/relational-databases/performance/joins?view=sql-server-ver17#null-values-and-joins): null values in joined columns "don't match each other", and such rows can come back only through an outer join. For a foreign key this is what you want: an unknown borrower should not match every other unknown borrower.

When you do need two `NULL`s to count as equal (comparing two versions of a table column by column, for example), the spelling depends on the engine:

- PostgreSQL: `a IS NOT DISTINCT FROM b`, which [its manual](https://www.postgresql.org/docs/current/functions-comparison.html) describes as acting "as though null were a normal data value".
- SQLite accepts that spelling and also the shorter `a IS b`, which [its documentation](https://www.sqlite.org/lang_expr.html#isisnot) marks as a SQLite extension.
- SQL Server has `IS NOT DISTINCT FROM` [from SQL Server 2022](https://learn.microsoft.com/en-us/sql/t-sql/queries/is-distinct-from-transact-sql?view=sql-server-ver17) onward, not before.
- MySQL writes it `a <=> b`, which [its manual](https://dev.mysql.com/doc/refman/8.4/en/comparison-operators.html#operator_equal-to) calls the equivalent of the standard operator.

One more consequence: in a left join result, a `NULL` in `l.title` could mean "no loan matched" or "a loan matched and its title is `NULL`". To test for *no match*, test a column that is never `NULL` in a real row, again the primary key: `WHERE l.loan_id IS NULL`.

:::dotnet
C# disagrees with SQL here: for `int?` operands, `null == null` is `true`. LINQ's `Join` nevertheless behaves like SQL. In the current implementation in dotnet/runtime, the lookup that `Enumerable.Join` builds skips every element whose key is `null`, so null keys never match. That is an implementation detail you can read in [`Lookup.CreateForJoin`](https://github.com/dotnet/runtime/blob/main/src/libraries/System.Linq/src/System/Linq/Lookup.cs), and you can observe it. If the two nulls below matched each other, `Join` would produce two pairs:

```csharp run
int?[] left = [1, null];
int?[] right = [1, null];

int? a = null, b = null;
Console.WriteLine($"a == b: {a == b}");

var pairs = left.Join(
    right,
    l => l,
    r => r,
    (l, r) => (l, r)).ToList();
Console.WriteLine($"pairs: {pairs.Count}");
```

```text output
a == b: True
pairs: 1
```
:::

## A table can join to itself

`member.referred_by` holds the `member_id` of another member. To show names instead of numbers, join `member` to `member`. The table appears twice, so each appearance needs its own alias, and it helps to name the aliases after their roles: `m` for the member, `r` for the referrer.

```sql run
SELECT m.name AS member,
       r.name AS referred_by
FROM member AS m
LEFT JOIN member AS r
  ON r.member_id = m.referred_by
ORDER BY m.member_id;
```

```text output
member  referred_by
------  -----------
Ada     NULL
Boris   Ada
Chen    Ada
Dalia   Chen
```

Nothing new is happening. Put two copies of the table side by side and draw a line from each row on the left to the row on the right whose `member_id` equals its `referred_by`:

<figure class="diagram">
<svg viewBox="0 0 350 306" role="img" aria-labelledby="js-title js-desc">
<title id="js-title">Match lines from the member table to a second copy of itself</title>
<desc id="js-desc">On the left, the member table under the alias m, showing name and referred_by. On the right, the same table under the alias r, showing member_id and name. Boris and Chen on the left each connect to Ada on the right, and Dalia on the left connects to Chen on the right. Ada on the left has referred_by NULL and no line.</desc>
<text x="6" y="20" class="d-mono d-bold">member AS m</text>
<text x="214" y="20" class="d-mono d-bold">member AS r</text>
<text x="16" y="40" class="d-mono d-small d-muted">name</text><text x="62" y="40" class="d-mono d-small d-muted">referred_by</text>
<text x="224" y="40" class="d-mono d-small d-muted">member_id</text><text x="300" y="40" class="d-mono d-small d-muted">name</text>
<path d="M150 122 L214 70" class="d-accent"/>
<path d="M150 174 L214 70" class="d-accent"/>
<path d="M150 226 L214 174" class="d-accent"/>
<rect x="6" y="50" width="144" height="40" rx="6" class="d-box-warn"/><text x="16" y="75">Ada</text><text x="100" y="75" class="d-mono">NULL</text>
<rect x="6" y="102" width="144" height="40" rx="6" class="d-box"/><text x="16" y="127">Boris</text><text x="100" y="127" class="d-mono">1</text>
<rect x="6" y="154" width="144" height="40" rx="6" class="d-box"/><text x="16" y="179">Chen</text><text x="100" y="179" class="d-mono">1</text>
<rect x="6" y="206" width="144" height="40" rx="6" class="d-box"/><text x="16" y="231">Dalia</text><text x="100" y="231" class="d-mono">3</text>
<rect x="214" y="50" width="130" height="40" rx="6" class="d-box"/><text x="224" y="75" class="d-mono">1</text><text x="300" y="75">Ada</text>
<rect x="214" y="102" width="130" height="40" rx="6" class="d-box"/><text x="224" y="127" class="d-mono">2</text><text x="300" y="127">Boris</text>
<rect x="214" y="154" width="130" height="40" rx="6" class="d-box"/><text x="224" y="179" class="d-mono">3</text><text x="300" y="179">Chen</text>
<rect x="214" y="206" width="130" height="40" rx="6" class="d-box"/><text x="224" y="231" class="d-mono">4</text><text x="300" y="231">Dalia</text>
<text x="6" y="272" class="d-muted d-small">m's Ada: referred_by is NULL, so she starts no line</text>
<text x="6" y="292" class="d-muted d-small">r's Ada: the end of two lines, so she is output twice</text>
</svg>
<figcaption>Figure 4. One table in two roles. Ada starts no line on the left, where she is a member, and ends two on the right, where she is a referrer. Boris and Dalia on the right end none, which matters only if you preserve that side.</figcaption>
</figure>

Ada's `referred_by` is `NULL`, so she matches nothing, and she is in the result only because this is a left join; with an inner join she would vanish. Self joins answer questions about rows of the same kind: employee and manager, a flight and its connecting flight, a reading and the previous reading.

## When the key is not unique, rows multiply

So far each loan has matched at most one member, because `member_id` is the primary key of `member`. The number of result rows produced for one key value is (left rows with that value) × (right rows with that value). With a unique key on one side, that product is just the count on the other side. When *both* sides repeat the value, it is not.

Members pay late fees in installments:

```sql run
CREATE TABLE payment (
  payment_id INTEGER PRIMARY KEY,
  member_id  INTEGER NOT NULL
    REFERENCES member (member_id),
  amount     INTEGER NOT NULL
);

INSERT INTO payment
  (payment_id, member_id, amount)
VALUES
  (1, 1, 2),
  (2, 1, 1),
  (3, 3, 5);
```

Ada owes 3 + 2 = 5 and has paid 2 + 1 = 3. The obvious balance report joins all three tables and sums:

```sql run
SELECT m.name,
       SUM(l.late_fee) AS fees,
       SUM(p.amount)   AS paid
FROM member AS m
JOIN loan AS l
  ON l.member_id = m.member_id
JOIN payment AS p
  ON p.member_id = m.member_id
GROUP BY m.member_id, m.name
ORDER BY m.name;
```

```text output
name  fees  paid
----  ----  ----
Ada   10    6
Chen  5     5
```

Ada's fees and payments have both doubled. No error, no warning, and Chen's figures are correct, so a test that checks only Chen passes. Remove the aggregation and look at Ada's rows before they were summed:

```sql run
SELECT l.title,
       l.late_fee,
       p.payment_id AS pay_id,
       p.amount
FROM member AS m
JOIN loan AS l
  ON l.member_id = m.member_id
JOIN payment AS p
  ON p.member_id = m.member_id
WHERE m.name = 'Ada'
ORDER BY l.title, p.payment_id;
```

```text output
title  late_fee  pay_id  amount
-----  --------  ------  ------
Dune   3         1       2
Dune   3         2       1
Emma   2         1       2
Emma   2         2       1
```

<figure class="diagram">
<svg viewBox="0 0 350 250" role="img" aria-labelledby="jf-title jf-desc">
<title id="jf-title">Ada's two loans each pair with both of her payments</title>
<desc id="jf-desc">Two loan rows on the left and two payment rows on the right, all with member_id 1. Four lines connect every loan to every payment, so each late fee and each payment amount appears twice in the joined result.</desc>
<text x="6" y="20" class="d-bold">Ada's loans</text>
<text x="214" y="20" class="d-bold">Ada's payments</text>
<text x="16" y="40" class="d-mono d-small d-muted">title</text><text x="126" y="40" text-anchor="end" class="d-mono d-small d-muted">late_fee</text>
<text x="224" y="40" class="d-mono d-small d-muted">pay_id</text><text x="334" y="40" text-anchor="end" class="d-mono d-small d-muted">amount</text>
<path d="M136 70 L214 70" class="d-bad"/>
<path d="M136 70 L214 126" class="d-bad"/>
<path d="M136 126 L214 70" class="d-bad"/>
<path d="M136 126 L214 126" class="d-bad"/>
<rect x="6" y="50" width="130" height="40" rx="6" class="d-box"/><text x="16" y="75">Dune</text><text x="126" y="75" text-anchor="end" class="d-mono">3</text>
<rect x="6" y="106" width="130" height="40" rx="6" class="d-box"/><text x="16" y="131">Emma</text><text x="126" y="131" text-anchor="end" class="d-mono">2</text>
<rect x="214" y="50" width="130" height="40" rx="6" class="d-box"/><text x="224" y="75" class="d-mono">1</text><text x="334" y="75" text-anchor="end" class="d-mono">2</text>
<rect x="214" y="106" width="130" height="40" rx="6" class="d-box"/><text x="224" y="131" class="d-mono">2</text><text x="334" y="131" text-anchor="end" class="d-mono">1</text>
<text x="6" y="180" class="d-mono d-small">SUM(late_fee) = 3+3+2+2 = 10</text><text x="344" y="180" text-anchor="end" class="d-text-bad d-small d-bold">true total: 5</text>
<text x="6" y="204" class="d-mono d-small">SUM(amount)   = 2+1+2+1 = 6</text><text x="344" y="204" text-anchor="end" class="d-text-bad d-small d-bold">true total: 3</text>
<text x="6" y="236" class="d-muted d-small">2 loans × 2 payments = 4 rows: every value counted twice</text>
</svg>
<figcaption>Figure 5. Loans and payments are unrelated to each other; they only share a parent. Joining both to the parent in one query pairs every loan with every payment, a small cross product hidden inside an ordinary-looking join.</figcaption>
</figure>

A payment is not *for* a particular loan, so there is no correct line to draw between them, and the query draws all of them. `SUM(DISTINCT ...)` is not a fix: two loans with the same fee would collapse into one. The fix is to make each side unique per member *before* joining, by aggregating it on its own:

```sql run
WITH fees AS (
  SELECT member_id,
         SUM(late_fee) AS total
  FROM loan
  GROUP BY member_id
),
paid AS (
  SELECT member_id,
         SUM(amount) AS total
  FROM payment
  GROUP BY member_id
)
SELECT m.name,
       COALESCE(f.total, 0) AS fees,
       COALESCE(p.total, 0) AS paid,
       COALESCE(f.total, 0)
         - COALESCE(p.total, 0) AS owes
FROM member AS m
LEFT JOIN fees AS f
  ON f.member_id = m.member_id
LEFT JOIN paid AS p
  ON p.member_id = m.member_id
ORDER BY m.name;
```

```text output
name   fees  paid  owes
-----  ----  ----  ----
Ada    5     3     2
Boris  0     0     0
Chen   5     5     0
Dalia  0     0     0
```

Each of the two `WITH` subqueries ([common table expressions](/databases/aggregation-and-window-functions/)) has at most one row per member, so each left join attaches at most one row and the row count stays at four. The left joins also bring back Boris and Dalia, whom the buggy inner-join version dropped for having no payments.

Two checks expose this bug. Before joining on a column, ask whether it is unique on at least one side, and look when unsure:

```sql run
SELECT member_id,
       COUNT(*) AS rows_per_key
FROM payment
GROUP BY member_id
HAVING COUNT(*) > 1;
```

```text output
member_id  rows_per_key
---------  ------------
1          2
```

And when a join is meant only to *look something up*, compare `COUNT(*)` before and after adding it. If the count rises, the join is multiplying rows.

::::exercise[Count the lines before you run it]
Join `loan` to itself, aliased `a` and `b`, with `ON a.member_id = b.member_id`, and select `COUNT(*)`. The table has five rows. Work out the count on paper first, and say why it is neither 5 nor 25.

:::solution
Count lines per key value, left rows × right rows. `member_id` 1 appears twice on each side: 2 × 2 = 4 (Dune–Dune, Dune–Emma, Emma–Dune, Emma–Emma). Values 2 and 3 appear once on each side: 1 each. Beloved's `NULL` equals nothing, so that row contributes 0, even though it is being compared with a copy of itself. 4 + 1 + 1 + 0 = 6: more rows than the table has, from a table joined to itself on a column that is neither unique nor always known.

```sql run
SELECT COUNT(*) AS n
FROM loan AS a
JOIN loan AS b
  ON a.member_id = b.member_id;
```

```text output
n
-
6
```
:::
::::

## What the circles cannot show

The Venn diagram for an inner join shades the overlap of circle A and circle B. Read literally, that says: the result is the set of things that are in both tables. Test the claim with the SQL operator that really does compute an overlap, `INTERSECT`:

```sql run
SELECT member_id FROM member
INTERSECT
SELECT member_id FROM loan
ORDER BY member_id;
```

```text output
member_id
---------
1
2
3
```

Three values are in both columns, and the inner join on the same columns returned four rows, so the join is already not the overlap. The payment join went further: Ada's two loans and two payments produced four rows, more than either input had. An overlap can never be larger than the smaller circle; a join result can be larger than both tables. The specific things the circles hide are the ones this page has been about:

- **Result rows are pairs**, not members of either table. There is no region of two circles that contains "Ada glued to Dune".
- **Multiplicity.** A set has no duplicates, so a Venn diagram cannot show Ada appearing twice, let alone four times.
- **The condition.** The circles assume "matching" is a fixed fact. In SQL it is whatever expression you put in `ON`, and moving a condition between `ON` and `WHERE` changes the result.
- **NULL.** A `NULL` key is present in the table and matches nothing; there is nowhere to put it in the picture.
- **Cross joins**, which have no condition at all.

Venn diagrams are the right picture for `UNION`, `INTERSECT` and `EXCEPT`, which combine two results with the *same columns* row-wise. Joins combine tables with different columns side by side; match lines are the right picture for those.

## Anti-joins: finding the rows with no match

"Which members have no loans?" asks for the rows that touch no line. This is called an **anti-join**. None of SQLite, PostgreSQL, MySQL or SQL Server has an `ANTI JOIN` keyword; a few analytics engines do, and [Spark SQL](https://spark.apache.org/docs/latest/sql-ref-syntax-qry-select-join.html), for one, accepts `LEFT ANTI JOIN`. In the other four there are three ways to write one, and one of them is a trap.

The first uses the padding rows of a left join and keeps only those:

```sql run
SELECT m.name
FROM member AS m
LEFT JOIN loan AS l
  ON l.member_id = m.member_id
WHERE l.loan_id IS NULL;
```

```text output
name
-----
Dalia
```

The second says what it means:

```sql run
SELECT m.name
FROM member AS m
WHERE NOT EXISTS (
  SELECT 1
  FROM loan AS l
  WHERE l.member_id = m.member_id
);
```

```text output
name
-----
Dalia
```

Prefer this form, for three reasons. It states the intent, where the left-join version makes the reader decode an `IS NULL` test. It cannot be broken by testing the wrong column: `WHERE l.title IS NULL` would also catch real loans with a missing title. And unlike a join, a subquery in `WHERE` can only keep or drop a member row, never duplicate it, which matters for the semi-join below. Engines treat it as an operation of its own: [SQL Server's documentation](https://learn.microsoft.com/en-us/sql/relational-databases/performance/joins?view=sql-server-ver17#join-fundamentals) lists semi joins and anti semi joins among the logical joins its optimizer uses that "can't be directly expressed with Transact-SQL syntax".

The third looks the simplest. It is wrapped in a count here so that the result is unmistakable:

```sql run
SELECT COUNT(*) AS members_found
FROM member AS m
WHERE m.member_id NOT IN (
  SELECT member_id FROM loan
);
```

```text output
members_found
-------------
0
```

Zero members, and Dalia has still borrowed nothing.

:::pitfall[NOT IN and a single NULL]
The subquery yields 1, 1, 2, 3 and `NULL`. `NOT IN` means "differs from every one of these", so for Dalia, whose `member_id` is 4, SQL evaluates:

```text
    4 <> 1       true
AND 4 <> 1       true
AND 4 <> 2       true
AND 4 <> 3       true
AND 4 <> NULL    NULL
```

True `AND` `NULL` is `NULL`, not true, and `WHERE` discards the row. The same happens to every member. The [PostgreSQL manual](https://www.postgresql.org/docs/current/functions-subquery.html#FUNCTIONS-SUBQUERY-NOTIN) documents exactly this: when no equal value is found and at least one right-hand row is null, the result of `NOT IN` "will be null, not true".

One `NULL` anywhere in the subquery empties the entire result, and this query was correct until loan 105 was entered. `NOT EXISTS` has no such problem, because `EXISTS` only asks whether the subquery returned a row and so is never `NULL`.
:::

The mirror image, "members with *at least one* loan", is a **semi-join**, and the same four engines have no keyword for it either (Spark SQL has `LEFT SEMI JOIN`). Writing it as an inner join lists Ada once per loan; `EXISTS` returns each member once regardless of how many matches there are:

```sql run
SELECT m.name
FROM member AS m
WHERE EXISTS (
  SELECT 1
  FROM loan AS l
  WHERE l.member_id = m.member_id
)
ORDER BY m.name;
```

```text output
name
-----
Ada
Boris
Chen
```

::::exercise[Who never referred anyone?]
List the members who have never referred anyone. You need the self-join idea and the anti-join idea at once. Work out the expected answer from the `member` table by eye before opening the solution.

:::solution
A member has referred someone if some *other* row's `referred_by` points at them. Ask for the members for whom no such row exists:

```sql run
SELECT m.name
FROM member AS m
WHERE NOT EXISTS (
  SELECT 1
  FROM member AS newer
  WHERE newer.referred_by = m.member_id
)
ORDER BY m.name;
```

```text output
name
-----
Boris
Dalia
```

Ada referred Boris and Chen, and Chen referred Dalia, which leaves Boris and Dalia. The `NOT IN` version, with `SELECT referred_by FROM member` as the subquery, would return no rows at all, because Ada's own `referred_by` is `NULL`.
:::
::::

## What the engine does instead of building every pair

Here is the left join definition executed literally in C#: for each member, test every loan, emit the pairs that pass, and emit a padding row if none did.

```csharp run id=nested
Member[] members =
[
    new(1, "Ada"),
    new(2, "Boris"),
    new(3, "Chen"),
    new(4, "Dalia"),
];
Loan[] loans =
[
    new(101, 1, "Dune"),
    new(102, 1, "Emma"),
    new(103, 2, "Ulysses"),
    new(104, 3, "Hamlet"),
    new(105, null, "Beloved"),
];

int tests = 0;
var rows = LeftJoin(members, loans);
foreach (var (name, title) in rows)
{
    string shown = title ?? "NULL";
    Console.WriteLine($"{name,-6} {shown}");
}
Console.WriteLine($"ON ran {tests} times");

// SQL's ON: true only when both sides
// are known and equal.
bool On(Member m, Loan l) =>
    l.MemberId is int id && id == m.Id;

IEnumerable<(string Name, string? Title)>
    LeftJoin(Member[] left, Loan[] right)
{
    foreach (var m in left)
    {
        bool matched = false;
        foreach (var l in right)
        {
            tests++;
            if (!On(m, l)) continue;
            matched = true;
            yield return
                (m.Name, l.Title);
        }
        // Nothing passed: pad the row.
        if (!matched)
            yield return (m.Name, null);
    }
}

record Member(int Id, string Name);
record Loan(
    int Id, int? MemberId, string Title);
```

```text output
Ada    Dune
Ada    Emma
Boris  Ulysses
Chen   Hamlet
Dalia  NULL
ON ran 20 times
```

Twenty tests for five output rows is fine here and hopeless at scale. With *n* rows on the outer side and *m* on the inner, this naive nested loop evaluates `ON` exactly *n* × *m* times, Θ(*n* · *m*) in [big-O terms](/complexity/big-o-notation/), no matter how few pairs match. Databases return the rows the definition demands without doing that work. The [PostgreSQL planner documentation](https://www.postgresql.org/docs/current/planner-optimizer.html#PLANNER-OPTIMIZER-GENERATING-POSSIBLE-PLANS) and [SQL Server's join documentation](https://learn.microsoft.com/en-us/sql/relational-databases/performance/joins?view=sql-server-ver17#understand-nested-loops-joins) describe the same three strategies. Below, *k* is the number of rows the join outputs, which every method must at least write out.

- **Nested loops with an index.** Keep the outer loop, but replace the inner scan with a lookup in an [index](/databases/indexes/) on the inner table's join column, using the current outer row's value as the search key. With a B-tree index each lookup costs O(log *m*), so the join costs O(*n* log *m* + *k*). It works for any condition the index can search, ranges included, and it is at its best when *n* is small; SQL Server's page calls it the fastest choice when one input is small and the other is large and indexed.

- **Hash join.** Read one input (the *build* side, ideally the smaller, which SQL Server's optimizer picks deliberately) into a [hash table](/data-structures/hash-tables/) keyed on the join column, then read the other input once and probe the table with each row. Expected cost is O(*n* + *m* + *k*), given a hash function that spreads the keys and a build side that fits in memory; when it does not fit, engines partition both inputs to disk first and pay extra passes.

  It applies to equality conditions only: a hash table can find "the same key" but not "a smaller key". PostgreSQL states the restriction in its [rules for hash-joinable operators](https://www.postgresql.org/docs/current/xoper-optimization.html#XOPER-HASHES): the operator "must represent equality".

- **Merge join.** Sort both inputs on the join column, then walk the two sorted lists in step, advancing whichever side has the smaller key, as [the merge step of merge sort](/algorithms/sorting-algorithms-compared/) does. The walk is O(*n* + *m* + *k*). If an input is not already in order (from an index on the join column, say), the engine sorts it first, which adds O(*n* log *n* + *m* log *m*). PostgreSQL's [rules for merge-joinable operators](https://www.postgresql.org/docs/current/xoper-optimization.html#XOPER-MERGES) again require the operator to "behave like equality".

SQLite is the small-engine case: it [implements every join as nested loops](https://www.sqlite.org/optoverview.html#joins) and chooses the loop order of inner joins to suit the available indexes. With no suitable index it may [build a temporary one](https://www.sqlite.org/optoverview.html#autoindex) for the one statement, at a cost it gives as O(*m* log *m*), and its documentation describes the result as almost the same thing as a hash join.

The *k* term is not a formality. When a key value repeats on both sides, every method must still produce all the pairs, and if every row carries the same key then *k* = *n* · *m* and nothing beats the naive loop. That is the row-multiplication section again, seen from the engine's side.

SQL Server's page adds an adaptive variant that defers the choice between hash join and nested loops until run time, and says that the optimizer, not the query text, picks the method and the join order. The same holds for the ways of spelling an inner join: SQLite's manual calls `INNER JOIN`, `JOIN` and the old comma-and-`WHERE` style "[completely interchangeable](https://www.sqlite.org/lang_select.html#crossjoin)". That freedom covers inner joins only. Outer joins are different operations with different results, SQLite's optimizer documentation says it does not reorder tables across them as it does for inner joins, and `CROSS JOIN` in SQLite pins the order as noted earlier. So between the inner-join spellings, choose for the human reader and write the form that states your intent. The three algorithms also explain why the column you join on is the first candidate for an index: two of them can use one directly.
