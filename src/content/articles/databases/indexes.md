---
title: "How Database Indexes Work: B-Trees and Query Plans"
description: "Build a 300,000-row table, watch a full scan lose to an index seek by thousands of times, and read the real query plans and B-tree page counts that explain why."
pillar: databases
order: 3
author: markus
published: 2026-09-22
updated: 2026-09-22
level: intermediate
tags: [sql, indexes, b-tree, query-plan, sqlite]
prerequisites: ["databases/relational-model-and-keys", "databases/sql-joins"]
sources:
  - title: "SQLite: Database File Format (B-tree pages)"
    url: "https://www.sqlite.org/fileformat2.html"
    publisher: "SQLite"
    accessed: 2026-09-22
  - title: "SQLite: Query Planning"
    url: "https://www.sqlite.org/queryplanner.html"
    publisher: "SQLite"
    accessed: 2026-09-22
  - title: "SQLite: EXPLAIN QUERY PLAN"
    url: "https://www.sqlite.org/eqp.html"
    publisher: "SQLite"
    accessed: 2026-09-22
  - title: "SQLite: The SQLite Query Optimizer Overview"
    url: "https://www.sqlite.org/optoverview.html"
    publisher: "SQLite"
    accessed: 2026-09-22
  - title: "SQLite: CREATE INDEX"
    url: "https://www.sqlite.org/lang_createindex.html"
    publisher: "SQLite"
    accessed: 2026-09-22
  - title: "SQLite: Indexes On Expressions"
    url: "https://www.sqlite.org/expridx.html"
    publisher: "SQLite"
    accessed: 2026-09-22
  - title: "Overview - Microsoft.Data.Sqlite"
    url: "https://learn.microsoft.com/en-us/dotnet/standard/data/sqlite/"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
draft: true
---

Add one `CREATE INDEX` statement to the table this page builds, and finding one visitor's hits in it stops being a sweep of 300,000 rows and becomes a lookup so fast it barely registers on a stopwatch. This page builds that table, measures both, and then opens the query plans and the on-disk B-tree pages that explain the gap, so "index" stops being a word you trust and starts being a structure you can reason about.

## A full scan, measured

The table is a web server access log: one row per page hit, with the visitor, the path, the HTTP status and the date. `hit_at` and `path` repeat a lot; `visitor_id` does not. A `WITH RECURSIVE` common table expression generates 300,000 rows in one statement, spread over 20,000 visitors and 365 days, so a lookup for one visitor has a real, small answer to find inside a large table.

```sql run
CREATE TABLE hit (
  hit_id     INTEGER PRIMARY KEY,
  path       TEXT NOT NULL,
  visitor_id INTEGER NOT NULL,
  status     INTEGER NOT NULL,
  hit_at     TEXT NOT NULL
);

WITH RECURSIVE seq(n) AS (
  SELECT 0
  UNION ALL
  SELECT n + 1 FROM seq WHERE n < 299999
),
path_list(i, path) AS (
  VALUES
    (0,'/home'), (1,'/pricing'),
    (2,'/blog/indexes'), (3,'/blog/joins'),
    (4,'/checkout'), (5,'/login'),
    (6,'/about'), (7,'/contact'),
    (8,'/docs'), (9,'/api/health')
),
hashed(n, h) AS (
  SELECT n,
    ((n * 2654435761) % 1000000007
      + 1000000007) % 1000000007
  FROM seq
)
INSERT INTO hit (path, visitor_id, status, hit_at)
SELECT
  path_list.path,
  (hashed.n % 20000) + 1,
  CASE WHEN hashed.h % 50 = 0 THEN 500
       WHEN hashed.h % 20 = 0 THEN 404
       ELSE 200 END,
  date('2025-01-01', '+' || (hashed.h % 365) || ' days')
FROM hashed
JOIN path_list ON path_list.i = hashed.h % 10;

SELECT COUNT(*) AS rows FROM hit;
```

```text output
rows
------
300000
```

The multiplier `2654435761` is Knuth's multiplicative hash constant; it just needs to scatter `n` well enough that a visitor's rows land on different paths, statuses and dates instead of a suspiciously tidy pattern. The SQL on this page runs against SQLite 3.50 in one session; run the statements in order if you follow along.

Ask for one visitor's hits with no index, and SQLite has exactly one way to answer: read every row.

```sql run
EXPLAIN QUERY PLAN
SELECT * FROM hit WHERE visitor_id = 555;
```

```text output
id  parent  notused  detail
--  ------  -------  --------
2   0       216      SCAN hit
```

`EXPLAIN QUERY PLAN` reports one row per table the query touches. Each row has [four fields](https://www.sqlite.org/eqp.html): "An integer node id, an integer parent id, an auxiliary integer field that is not currently used, and a description of the node." Only the last one, `detail`, says anything about the plan itself; `id`/`parent` matter for queries with subqueries or joins (this one has neither, so `parent` is always 0), and `notused` is exactly what its name says. From here on, only `detail` is worth reading, and this page's first plan opens with the least helpful word it can show: [`SCAN`](https://www.sqlite.org/eqp.html), which the same page defines as "a full-table scan." SQLite's [query planning documentation](https://www.sqlite.org/queryplanner.html) explains why that is a *fixed* cost regardless of what the query asks for: "the entire content of the table must be read and examined in order to find the one row of interest." `SEARCH` is the alternative: it indicates that "only a subset of the table rows are visited," per that same `EXPLAIN QUERY PLAN` documentation.

A `SCAN` costs one comparison per row, so it costs the same whether the visitor you want is row 1 or row 300,000. Now measure it. `Microsoft.Data.Sqlite`, ["a lightweight ADO.NET provider for SQLite"](https://learn.microsoft.com/en-us/dotnet/standard/data/sqlite/), builds its own copy of the same table and times the query directly, so the numbers below are wall-clock time, not a row count. This program (and the two later on this page that measure time) ran on .NET 10.0.12 on Windows 11, an 8-core x64 desktop (Intel Core i7-11700K); the SQLite build inside that NuGet package reports its own version, printed below, which need not match the 3.50 running the blocks above.

```csharp run id=scan-timing
#:package Microsoft.Data.Sqlite@8.0.11
#:property NoWarn=NU1903
#:property Optimize=true
using System.Diagnostics;
using System.Globalization;
using Microsoft.Data.Sqlite;

CultureInfo.CurrentCulture =
    CultureInfo.InvariantCulture;

using var conn = new SqliteConnection(
    "Data Source=:memory:");
conn.Open();
Exec(conn, """
CREATE TABLE hit (
  hit_id     INTEGER PRIMARY KEY,
  path       TEXT NOT NULL,
  visitor_id INTEGER NOT NULL,
  status     INTEGER NOT NULL,
  hit_at     TEXT NOT NULL
);
""");
Exec(conn, """
WITH RECURSIVE seq(n) AS (
  SELECT 0
  UNION ALL
  SELECT n + 1 FROM seq WHERE n < 299999
),
path_list(i, path) AS (
  VALUES
    (0,'/home'), (1,'/pricing'),
    (2,'/blog/indexes'), (3,'/blog/joins'),
    (4,'/checkout'), (5,'/login'),
    (6,'/about'), (7,'/contact'),
    (8,'/docs'), (9,'/api/health')
),
hashed(n, h) AS (
  SELECT n,
    ((n * 2654435761) % 1000000007
      + 1000000007) % 1000000007
  FROM seq
)
INSERT INTO hit (path, visitor_id, status, hit_at)
SELECT
  path_list.path,
  (hashed.n % 20000) + 1,
  CASE WHEN hashed.h % 50 = 0 THEN 500
       WHEN hashed.h % 20 = 0 THEN 404
       ELSE 200 END,
  date('2025-01-01', '+' || (hashed.h % 365) || ' days')
FROM hashed
JOIN path_list ON path_list.i = hashed.h % 10;
""");

Console.WriteLine(
    $"rows          : {Scalar(conn, "SELECT COUNT(*) FROM hit")}");
Console.WriteLine(
    $"sqlite_version: {Scalar(conn, "SELECT sqlite_version()")}");

double scan = TimeQuery(conn,
    "SELECT COUNT(*) FROM hit WHERE visitor_id = 555",
    reps: 300);
Console.WriteLine($"full scan     : {scan,8:F4} ms/query");

static void Exec(SqliteConnection c, string sql)
{
    using var cmd = c.CreateCommand();
    cmd.CommandText = sql;
    cmd.ExecuteNonQuery();
}

static object? Scalar(SqliteConnection c, string sql)
{
    using var cmd = c.CreateCommand();
    cmd.CommandText = sql;
    return cmd.ExecuteScalar();
}

static double TimeQuery(
    SqliteConnection c, string sql, int reps)
{
    using var cmd = c.CreateCommand();
    cmd.CommandText = sql;
    cmd.ExecuteScalar(); // warm-up
    double best = double.MaxValue;
    for (int run = 0; run < 5; run++)
    {
        long start = Stopwatch.GetTimestamp();
        for (int i = 0; i < reps; i++) cmd.ExecuteScalar();
        double ms = Stopwatch
            .GetElapsedTime(start).TotalMilliseconds;
        best = Math.Min(best, ms / reps);
    }
    return best;
}
```

```text output
rows          : 300000
sqlite_version: 3.41.2
full scan     : [...] ms/query
```

Each number is the best of five batches of 300 repeated queries, which smooths out the noise a single run has. Across several runs here, the full scan cost between about 7.6 and 7.8 ms per query. Keep that range; the rest of this page keeps coming back to it.

## What SQLite actually walks

A table with no index is not unindexed in the sense of "unstructured": SQLite still keeps `hit` itself in a **B-tree**, a "table b-tree", keyed by the hidden `rowid` that backs `hit_id`. [SQLite's own file format documentation](https://www.sqlite.org/fileformat2.html) is exact about the shape: "A b-tree page is either an interior page or a leaf page. A leaf page contains keys and in the case of a table b-tree each key has associated data. An interior page contains K keys together with K+1 pointers to child b-tree pages." The keys inside one page are always sorted, and "for any key X, pointers to the left of X refer to b-tree pages on which all keys are less than or equal to X. Pointers to the right of X refer to pages where all keys are greater than X." Every leaf sits at the same depth, so no row is ever cheaper or more expensive to reach than any other.

<figure class="diagram">
<svg viewBox="0 0 360 300" role="img" aria-labelledby="btree-title btree-desc">
<title id="btree-title">An interior b-tree page pointing at three leaf pages</title>
<desc id="btree-desc">A root interior page holds two keys, 300 and 700, with pointers P0, P1 and P2 around them. P0 leads to a leaf holding keys under 300, P1 to a leaf holding keys from 300 up to 700, and P2 to a leaf holding keys 700 and above. All three leaves are drawn at the same depth below the root.</desc>
<defs>
<marker id="btree-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-accent"/></marker>
</defs>
<rect x="30" y="10" width="300" height="40" rx="6" class="d-box-accent"/>
<text x="50" y="35" class="d-mono d-small">P0</text>
<text x="130" y="35" text-anchor="middle" class="d-mono d-bold">300</text>
<text x="185" y="35" class="d-mono d-small">P1</text>
<text x="270" y="35" text-anchor="middle" class="d-mono d-bold">700</text>
<text x="310" y="35" class="d-mono d-small">P2</text>
<text x="180" y="66" text-anchor="middle" class="d-small d-muted">root (interior): 2 keys, 3 pointers</text>
<path d="M70 50 V100" class="d-accent" marker-end="url(#btree-arrow)"/>
<path d="M190 50 V100" class="d-accent" marker-end="url(#btree-arrow)"/>
<path d="M300 50 V100" class="d-accent" marker-end="url(#btree-arrow)"/>
<rect x="10" y="104" width="120" height="50" rx="6" class="d-box"/>
<text x="70" y="124" text-anchor="middle" class="d-mono d-small">leaf</text>
<text x="70" y="144" text-anchor="middle" class="d-mono d-small">120 210 260</text>
<rect x="130" y="104" width="120" height="50" rx="6" class="d-box"/>
<text x="190" y="124" text-anchor="middle" class="d-mono d-small">leaf</text>
<text x="190" y="144" text-anchor="middle" class="d-mono d-small">340 500 690</text>
<rect x="250" y="104" width="100" height="50" rx="6" class="d-box"/>
<text x="300" y="124" text-anchor="middle" class="d-mono d-small">leaf</text>
<text x="300" y="144" text-anchor="middle" class="d-mono d-small">710 900</text>
<text x="14" y="176" class="d-small d-muted">under 300</text>
<text x="140" y="176" class="d-small d-muted">300 to 699</text>
<text x="264" y="176" class="d-small d-muted">700 and up</text>
<text x="10" y="208" class="d-small">Every leaf is the same distance from the root,</text>
<text x="10" y="226" class="d-small">so every lookup reads the same number of pages.</text>
<text x="10" y="256" class="d-small d-muted">This page's own hit table: a root with 5 keys and</text>
<text x="10" y="274" class="d-small d-muted">6 pointers, 6 more interior pages, then 2,518 leaf</text>
<text x="10" y="292" class="d-small d-muted">pages — three page reads reach any one row.</text>
</svg>
<figcaption>Figure 1. An interior page stores keys and child pointers alternately; a leaf page stores the sorted keys (and, in a table b-tree, the row data). Every child of one page is the same depth from the root, which is what keeps every lookup's cost equal.</figcaption>
</figure>

That is a description, not a hand-wave: the same file format documentation exposes a `dbstat` virtual table that reports the real pages of a running database, and it agrees with Figure 1's shape.

```sql run
SELECT
  CASE WHEN pageno = (
    SELECT rootpage FROM sqlite_schema
    WHERE name = 'hit'
  ) THEN 'root' ELSE pagetype END AS kind,
  COUNT(*) AS pages,
  MIN(ncell) AS min_cell,
  MAX(ncell) AS max_cell
FROM dbstat
WHERE name = 'hit'
GROUP BY kind
ORDER BY kind;
```

```text output
kind      pages  min_cell  max_cell
--------  -----  --------  --------
internal  6      397       442
leaf      2518   76        140
root      1      5         5
```

`hit`'s 300,000 rows live in 2,518 leaf pages. The root holds only 5 keys (6 pointers), and the 6 pages those pointers lead to are themselves interior pages (the other 6 rows counted as `internal`) that each fan out to hundreds of leaves; the largest interior page here holds 442 cells. Reaching any single row means one pointer followed at the root, one at that second level, then one leaf read: three page reads, no matter which of the 300,000 rows it is. A `SCAN`, by contrast, touches all 2,518 leaf pages every time, which is the entire reason it is `Θ(n)` and a lookup by key is not.

::::exercise[Prove the depth barely grows]
Using only the numbers above (a root with 5 keys and 6 pointers, interior pages holding up to 442 cells, 2,518 leaves for 300,000 rows), argue that growing `hit` to 3,000,000 rows — ten times the size — would not make an indexed lookup even twice as slow, while it would make a full scan roughly ten times slower.

:::solution
Ten times the rows means roughly ten times the leaves: about 25,180 instead of 2,518. One interior page holds up to 442 pointers, so a single extra level of interior pages (442 pointers per page, times 442 pages) can already address up to 442 · 442 ≈ 195,000 leaves — more than 25,180 needs. The tree grows from three levels to at most four: one more pointer to follow, one more page to read. A lookup goes from 3 page reads to at most 4, not from 3 to 30. `Θ(log n)` is exactly this: the *depth* grows by a constant amount each time the fan-out's worth of rows is multiplied in, while a full scan's cost is the row count itself, so it grows in direct proportion. Ten times the rows is ten times the `SCAN` cost and essentially the same `SEARCH` cost.
:::
::::

## Seeks: the plan after CREATE INDEX

`CREATE INDEX` builds a second B-tree over the same table, this one an "index b-tree": its keys are the indexed column's values, in sorted order, and each key carries the matching row's `rowid` instead of the row's data. [SQLite's documentation](https://www.sqlite.org/fileformat2.html) states the rule plainly: "There is one index b-tree in the database file for each index in the schema." Give the query planner one on `visitor_id`, and the same query's plan changes shape.

```sql run
CREATE INDEX idx_visitor ON hit(visitor_id);

EXPLAIN QUERY PLAN
SELECT * FROM hit WHERE visitor_id = 555;
```

```text output
id  parent  notused  detail
--  ------  -------  -------------------------------------------------
3   0       61       SEARCH hit USING INDEX idx_visitor (visitor_id=?)
```

`SCAN` became `SEARCH`, naming the index and the condition it is searching on. SQLite's [query planning documentation](https://www.sqlite.org/queryplanner.html) walks through exactly this shape of lookup for an index on a non-key column: the engine binary-searches the index, sorted by that column, to find a matching entry and its `rowid`, and then, as the documentation puts it, "does a second binary search on the original ... table to find the original row." Two binary searches, not one, but each costs `O(log N)` against the table's `Θ(n)` for a scan, and the documentation draws the same conclusion this page's own numbers do: "for a table with a large number of rows, this is still much faster than doing a full table scan." The same program that timed the scan, changed only to build the index before asking:

```csharp run id=seek-timing
#:package Microsoft.Data.Sqlite@8.0.11
#:property NoWarn=NU1903
#:property Optimize=true
using System.Diagnostics;
using System.Globalization;
using Microsoft.Data.Sqlite;

CultureInfo.CurrentCulture =
    CultureInfo.InvariantCulture;

using var conn = new SqliteConnection(
    "Data Source=:memory:");
conn.Open();
Exec(conn, """
CREATE TABLE hit (
  hit_id     INTEGER PRIMARY KEY,
  path       TEXT NOT NULL,
  visitor_id INTEGER NOT NULL,
  status     INTEGER NOT NULL,
  hit_at     TEXT NOT NULL
);
""");
Exec(conn, """
WITH RECURSIVE seq(n) AS (
  SELECT 0
  UNION ALL
  SELECT n + 1 FROM seq WHERE n < 299999
),
path_list(i, path) AS (
  VALUES
    (0,'/home'), (1,'/pricing'),
    (2,'/blog/indexes'), (3,'/blog/joins'),
    (4,'/checkout'), (5,'/login'),
    (6,'/about'), (7,'/contact'),
    (8,'/docs'), (9,'/api/health')
),
hashed(n, h) AS (
  SELECT n,
    ((n * 2654435761) % 1000000007
      + 1000000007) % 1000000007
  FROM seq
)
INSERT INTO hit (path, visitor_id, status, hit_at)
SELECT
  path_list.path,
  (hashed.n % 20000) + 1,
  CASE WHEN hashed.h % 50 = 0 THEN 500
       WHEN hashed.h % 20 = 0 THEN 404
       ELSE 200 END,
  date('2025-01-01', '+' || (hashed.h % 365) || ' days')
FROM hashed
JOIN path_list ON path_list.i = hashed.h % 10;
""");
Exec(conn, "CREATE INDEX idx_visitor ON hit(visitor_id);");

Console.WriteLine(
    $"rows          : {Scalar(conn, "SELECT COUNT(*) FROM hit")}");

double seek = TimeQuery(conn,
    "SELECT COUNT(*) FROM hit WHERE visitor_id = 555",
    reps: 300);
Console.WriteLine($"indexed seek  : {seek,8:F4} ms/query");

static void Exec(SqliteConnection c, string sql)
{
    using var cmd = c.CreateCommand();
    cmd.CommandText = sql;
    cmd.ExecuteNonQuery();
}

static object? Scalar(SqliteConnection c, string sql)
{
    using var cmd = c.CreateCommand();
    cmd.CommandText = sql;
    return cmd.ExecuteScalar();
}

static double TimeQuery(
    SqliteConnection c, string sql, int reps)
{
    using var cmd = c.CreateCommand();
    cmd.CommandText = sql;
    cmd.ExecuteScalar(); // warm-up
    double best = double.MaxValue;
    for (int run = 0; run < 5; run++)
    {
        long start = Stopwatch.GetTimestamp();
        for (int i = 0; i < reps; i++) cmd.ExecuteScalar();
        double ms = Stopwatch
            .GetElapsedTime(start).TotalMilliseconds;
        best = Math.Min(best, ms / reps);
    }
    return best;
}
```

```text output
rows          : 300000
indexed seek  : [...] ms/query
```

Across several runs here the seek cost between about 0.0014 and 0.0037 ms per query, against the scan's 7.6 to 7.8 ms measured earlier. Dividing the two ranges gives anywhere from about two thousand to five thousand times faster, and that spread is not a mistake to fix: once a measurement drops to a few microseconds it is mostly clock resolution and cache state, not signal. Treat the exact multiple as noise and the order of magnitude — three to four zeros — as the finding, matching the "roughly log N vs N" shape the documentation describes rather than any specific ratio.

## Composite indexes: column order is not cosmetic

An index can cover more than one column, and which column comes first decides what the index is sorted by. `(visitor_id, hit_at)` sorts by `visitor_id` first and only breaks ties with `hit_at`; `(hit_at, visitor_id)` sorts the other way. The two are different structures, useful for different queries, even though they mention the same two columns.

```sql run
DROP INDEX idx_visitor;

CREATE INDEX idx_visitor_date
  ON hit(visitor_id, hit_at);

EXPLAIN QUERY PLAN
SELECT * FROM hit
WHERE visitor_id = 555 AND hit_at = '2025-02-14';
```

```text output
id  parent  notused  detail
--  ------  -------  -------------------------------------------------------------------
3   0       61       SEARCH hit USING INDEX idx_visitor_date (visitor_id=? AND hit_at=?)
```

Both conditions narrow the search, because both name a prefix of the index's sort order: first pin down `visitor_id`, then, inside that visitor's block of entries, pin down `hit_at`. Ask only about `hit_at`, and the leading column is missing:

```sql run
EXPLAIN QUERY PLAN
SELECT * FROM hit WHERE hit_at = '2025-02-14';
```

```text output
id  parent  notused  detail
--  ------  -------  --------
2   0       216      SCAN hit
```

`hit_at` values for `2025-02-14` are scattered across every visitor's block, in no particular order relative to each other, so there is no contiguous range of the index to seek to; SQLite falls back to reading the table. [SQLite's own worked example](https://www.sqlite.org/queryplanner.html) of a two-column index makes the same point with a `fruit`/`state` table: an index `(fruit, state)` can satisfy a query that filters `fruit` alone — the documentation's own phrase is "simply ignoring the state column" — precisely because `fruit` is the leading column, while a filter on `state` alone needs an index that leads with `state` instead. Swap the column order here and the table itself is unchanged, but which query benefits flips:

```sql run
DROP INDEX idx_visitor_date;

CREATE INDEX idx_date_visitor
  ON hit(hit_at, visitor_id);

EXPLAIN QUERY PLAN
SELECT * FROM hit WHERE hit_at = '2025-02-14';
```

```text output
id  parent  notused  detail
--  ------  -------  --------------------------------------------------
3   0       62       SEARCH hit USING INDEX idx_date_visitor (hit_at=?)
```

```sql run
EXPLAIN QUERY PLAN
SELECT * FROM hit WHERE visitor_id = 555;
```

```text output
id  parent  notused  detail
--  ------  -------  --------
2   0       216      SCAN hit
```

<figure class="diagram">
<svg viewBox="0 0 360 340" role="img" aria-labelledby="order-title order-desc">
<title id="order-title">The same four rows sorted two ways by a two-column index</title>
<desc id="order-desc">Four rows for visitors 12 and 47 on dates 2025-01-05, 2025-02-20 and 2025-03-09. Sorted by visitor_id then hit_at, visitor 12's two rows sit next to each other at the top. Sorted by hit_at then visitor_id, the two rows dated 2025-01-05 sit next to each other instead, and visitor 12's rows are now the first and the last.</desc>
<text x="10" y="20" class="d-bold">Index on (visitor_id, hit_at)</text>
<rect x="10" y="30" width="160" height="30" rx="4" class="d-box-accent"/><text x="20" y="50" class="d-mono d-small">12  2025-01-05</text>
<rect x="10" y="62" width="160" height="30" rx="4" class="d-box-accent"/><text x="20" y="82" class="d-mono d-small">12  2025-03-09</text>
<rect x="10" y="94" width="160" height="30" rx="4" class="d-box"/><text x="20" y="114" class="d-mono d-small">47  2025-01-05</text>
<rect x="10" y="126" width="160" height="30" rx="4" class="d-box"/><text x="20" y="146" class="d-mono d-small">47  2025-02-20</text>
<text x="10" y="172" class="d-small d-text-accent">visitor_id = 12: one contiguous range</text>
<text x="10" y="204" class="d-bold">Index on (hit_at, visitor_id)</text>
<rect x="10" y="214" width="160" height="30" rx="4" class="d-box-accent"/><text x="20" y="234" class="d-mono d-small">2025-01-05  12</text>
<rect x="10" y="246" width="160" height="30" rx="4" class="d-box-accent"/><text x="20" y="266" class="d-mono d-small">2025-01-05  47</text>
<rect x="10" y="278" width="160" height="30" rx="4" class="d-box"/><text x="20" y="298" class="d-mono d-small">2025-02-20  47</text>
<rect x="10" y="310" width="160" height="30" rx="4" class="d-box"/><text x="20" y="330" class="d-mono d-small">2025-03-09  12</text>
<text x="180" y="238" class="d-small d-text-accent">hit_at = 2025-01-05:</text>
<text x="180" y="256" class="d-small d-text-accent">one contiguous range</text>
<text x="180" y="290" class="d-small d-muted">visitor 12's two rows</text>
<text x="180" y="308" class="d-small d-muted">are now far apart</text>
</svg>
<figcaption>Figure 2. Reordering the same two columns reorders the index. Whichever column is named first groups its own values together and makes single-value lookups on it a short range; the second column only groups values within one value of the first.</figcaption>
</figure>

The rule of thumb this earns: put the column your queries filter alone, or filter most selectively, first. [SQLite's documentation](https://www.sqlite.org/queryplanner.html) adds a related warning worth keeping in mind when a schema accumulates indexes over time: a three-column index already contains everything a matching one-column or two-column prefix of it does, so "your database schema should never contain two indices where one index is a prefix of the other" — drop the narrower one.

::::exercise[Predict the plan]
An index `idx_status_path` covers `(status, path)`. Before running anything, decide which of these three queries can use it directly (a `SEARCH`) and which falls back to a full scan:

(a) `WHERE status = 404`
(b) `WHERE path = '/checkout'`
(c) `WHERE status = 404 AND path = '/checkout'`

:::solution
(a) and (c) search the index; (b) scans the table. `status` is the leading column, so a query that constrains `status` — alone or together with `path` — can start at the right place in the index. `path` alone says nothing about where in the `status`-major order to begin, so SQLite has no better option than reading every row.

```sql run
CREATE INDEX idx_status_path ON hit(status, path);

EXPLAIN QUERY PLAN
SELECT * FROM hit WHERE status = 404;
```

```text output
id  parent  notused  detail
--  ------  -------  -------------------------------------------------
3   0       62       SEARCH hit USING INDEX idx_status_path (status=?)
```

```sql run
EXPLAIN QUERY PLAN
SELECT * FROM hit WHERE path = '/checkout';
```

```text output
id  parent  notused  detail
--  ------  -------  --------
2   0       216      SCAN hit
```

```sql run
EXPLAIN QUERY PLAN
SELECT * FROM hit
WHERE status = 404 AND path = '/checkout';
```

```text output
id  parent  notused  detail
--  ------  -------  ------------------------------------------------------------
3   0       61       SEARCH hit USING INDEX idx_status_path (status=? AND path=?)
```
:::
::::

## Covering indexes: skipping the table entirely

An index only stores the columns you put in it, plus the `rowid` of the row it came from. Ordinarily that `rowid` is a second step: find the entry in the index, then use its `rowid` to fetch the actual row from the table's own B-tree. [SQLite's optimizer overview](https://www.sqlite.org/optoverview.html) spells out what changes when every column a query needs is already sitting in the index: "If, however, all columns that were to be fetched from the table are already available in the index itself, SQLite will use the values contained in the index and will never look up the original table row. This saves one binary search for each row." An index that makes the table lookup unnecessary is called, in that same documentation, a **covering index**.

```sql run
DROP INDEX idx_date_visitor;
DROP INDEX idx_status_path;

CREATE INDEX idx_cover
  ON hit(visitor_id, hit_at, status);

EXPLAIN QUERY PLAN
SELECT hit_at, status FROM hit
WHERE visitor_id = 555;
```

```text output
id  parent  notused  detail
--  ------  -------  --------------------------------------------------------
2   0       55       SEARCH hit USING COVERING INDEX idx_cover (visitor_id=?)
```

`USING COVERING INDEX` is SQLite's exact wording for this in `EXPLAIN QUERY PLAN` output; the query only asks for `hit_at` and `status`, both of which `idx_cover` already holds. Ask for anything outside the index — `path` or `hit_id`, say — with the identical index still in place, and the plan changes by one word:

```sql run
EXPLAIN QUERY PLAN
SELECT * FROM hit WHERE visitor_id = 555;
```

```text output
id  parent  notused  detail
--  ------  -------  -----------------------------------------------
3   0       62       SEARCH hit USING INDEX idx_cover (visitor_id=?)
```

Same index, same `WHERE` clause; the only difference is the select list, and it is the difference between "look at the index" and "look at the index, then the table too." A covering index is not a separate kind of index you declare; it is an ordinary index that happens to hold every column a particular query needs.

## Every index is also a write cost

An index is a second B-tree that has to stay sorted, so every `INSERT`, `UPDATE` of an indexed column, or `DELETE` does the sorted-insertion work again for each index on the table, on top of writing the row itself. Three indexes on `hit` means three extra B-trees an insert has to update, not one.

```csharp run id=write-cost
#:package Microsoft.Data.Sqlite@8.0.11
#:property NoWarn=NU1903
#:property Optimize=true
using System.Diagnostics;
using System.Globalization;
using Microsoft.Data.Sqlite;

CultureInfo.CurrentCulture =
    CultureInfo.InvariantCulture;
const int N = 50_000;

TimeInserts(indexes: 0); // warm-up: JIT the path once

double bare = Best(() => TimeInserts(indexes: 0));
double withIdx = Best(() => TimeInserts(indexes: 3));

Console.WriteLine(
    $"0 indexes : {bare,7:F1} ms for {N:N0} rows");
Console.WriteLine(
    $"3 indexes : {withIdx,7:F1} ms for {N:N0} rows");
Console.WriteLine(
    $"overhead  : {(withIdx / bare - 1) * 100,6:F0}%");

static double Best(Func<double> f)
{
    double best = double.MaxValue;
    for (int i = 0; i < 4; i++) best = Math.Min(best, f());
    return best;
}

static double TimeInserts(int indexes)
{
    using var conn = new SqliteConnection(
        "Data Source=:memory:");
    conn.Open();
    Exec(conn, """
    CREATE TABLE hit (
      hit_id     INTEGER PRIMARY KEY,
      path       TEXT NOT NULL,
      visitor_id INTEGER NOT NULL,
      status     INTEGER NOT NULL,
      hit_at     TEXT NOT NULL
    );
    """);
    if (indexes >= 1)
        Exec(conn, "CREATE INDEX idx_visitor ON hit(visitor_id);");
    if (indexes >= 2)
        Exec(conn, "CREATE INDEX idx_status ON hit(status);");
    if (indexes >= 3)
        Exec(conn, "CREATE INDEX idx_hit_at ON hit(hit_at);");

    using var cmd = conn.CreateCommand();
    cmd.CommandText =
        "INSERT INTO hit (path, visitor_id, status, hit_at) " +
        "VALUES ($p, $v, $s, $d)";
    var p = cmd.CreateParameter();
    p.ParameterName = "$p"; cmd.Parameters.Add(p);
    var v = cmd.CreateParameter();
    v.ParameterName = "$v"; cmd.Parameters.Add(v);
    var s = cmd.CreateParameter();
    s.ParameterName = "$s"; cmd.Parameters.Add(s);
    var d = cmd.CreateParameter();
    d.ParameterName = "$d"; cmd.Parameters.Add(d);

    long start = Stopwatch.GetTimestamp();
    using (var tx = conn.BeginTransaction())
    {
        cmd.Transaction = tx;
        for (int i = 0; i < N; i++)
        {
            p.Value = "/checkout";
            v.Value = i % 20000;
            s.Value = 200;
            d.Value = "2025-06-01";
            cmd.ExecuteNonQuery();
        }
        tx.Commit();
    }
    return Stopwatch.GetElapsedTime(start).TotalMilliseconds;
}

static void Exec(SqliteConnection c, string sql)
{
    using var cmd = c.CreateCommand();
    cmd.CommandText = sql;
    cmd.ExecuteNonQuery();
}
```

```text output
0 indexes : [...] ms for 50,000 rows
3 indexes : [...] ms for 50,000 rows
overhead  : [...]%
```

Across four runs here, zero indexes took between about 66 and 80 ms to insert 50,000 rows in one transaction; three indexes took between about 98 and 105 ms — roughly a quarter to two-thirds more time, and the range itself is the honest answer: this overhead depends on the data, the indexes and the machine, so treat "adding an index costs writes" as the reliable part and any single percentage as this run's noise. It does not shrink to zero even in one transaction with no other clients, because the extra B-trees still have to be walked and rewritten; it would be worse still with one `INSERT` per transaction, since each would also pay its own commit.

:::note
Nothing here is free to reverse, either. Dropping an unused index removes both costs at once: less work on every write, and one less structure for the query planner to consider (and occasionally misjudge) when it plans a read.
:::

## When SQLite ignores an index that exists

An index does not guarantee `SEARCH`. SQLite only uses one when it can prove the index's sort order narrows the search, and two ordinary-looking queries fail that test in ways worth knowing before they surprise you in production.

```sql run
DROP INDEX idx_cover;

CREATE INDEX idx_path ON hit(path);

EXPLAIN QUERY PLAN
SELECT * FROM hit WHERE path LIKE '/check%';
```

```text output
id  parent  notused  detail
--  ------  -------  --------
2   0       216      SCAN hit
```

That pattern has no leading wildcard, so it looks like exactly the case the [LIKE optimization](https://www.sqlite.org/optoverview.html) was built for: SQLite can turn `path LIKE '/check%'` into a plain range, `path >= '/check' AND path < '/checl'`, and search that range in the index instead. It still scanned, because of a rule easy to miss: SQLite's `LIKE` is case-insensitive by default, and the same documentation lists the optimization's requirements as an exact pairing — "if case_sensitive_like mode is enabled then the column must be indexed using the built-in BINARY collating sequence, or if case_sensitive_like mode is disabled then the column must be indexed using the built-in NOCASE collating sequence." `idx_path` uses the default `BINARY` collation while `case_sensitive_like` is off, which is neither allowed combination, so the optimization does not fire and SQLite falls back to a full scan to stay correct.

::::exercise[Make the index earn its keep]
Fix the query above so `path LIKE '/check%'` uses an index, without changing what the query matches (it must still find `/checkout` whether the pattern is typed `/check%` or `/CHECK%`) and without flipping `case_sensitive_like` globally, which would change every other `LIKE` in the database.

:::solution
Match the other half of the documentation's pairing instead: index the column with `COLLATE NOCASE` and leave `case_sensitive_like` at its default (off).

```sql run
DROP INDEX idx_path;

CREATE INDEX idx_path_ci
  ON hit(path COLLATE NOCASE);

EXPLAIN QUERY PLAN
SELECT * FROM hit WHERE path LIKE '/check%';
```

```text output
id  parent  notused  detail
--  ------  -------  ------------------------------------------------------
3   0       165      SEARCH hit USING INDEX idx_path_ci (path>? AND path<?)
```

The plan now searches a range instead of scanning, and case-insensitive matching still works, because `NOCASE` is what makes the column case-insensitive in the first place:

```sql run
SELECT COUNT(*) AS n FROM hit WHERE path LIKE '/CHECK%';
```

```text output
n
-----
29999
```
:::
::::

A second way to lose an index is to compute something from the column before comparing it, rather than comparing the column as stored.

```sql run
CREATE INDEX idx_hit_at ON hit(hit_at);

EXPLAIN QUERY PLAN
SELECT * FROM hit
WHERE substr(hit_at, 1, 7) = '2025-02';
```

```text output
id  parent  notused  detail
--  ------  -------  --------
2   0       216      SCAN hit
```

`idx_hit_at` is sorted by `hit_at`, not by `substr(hit_at, 1, 7)`, and SQLite will not work out that the two happen to agree for month-prefix comparisons. [SQLite's documentation on indexes over expressions](https://www.sqlite.org/expridx.html) states the limit directly: "The query planner does not do algebra. In order to match WHERE clause constraints and ORDER BY terms to indexes, SQLite requires that the expressions be the same, except for minor syntactic differences such as white-space changes." An index that stores `substr(hit_at, 1, 7)` itself, built with `CREATE INDEX ... ON hit(substr(hit_at, 1, 7))`, would match this exact query; a plain index on `hit_at` never will, no matter how obviously related the two expressions look to a person reading the query. The same rule is why `WHERE hit_at >= '2025-02-01' AND hit_at < '2025-03-01'` is the better fix here: it compares the indexed column as-is and lets the B-tree's own ordering do the work.

## Deciding whether an index earns its keep

Everything above points at the same trade: an index turns a lookup from "proportional to the table" into "proportional to `log` of the table, plus the size of the answer", and it does that by giving every write on that column one more sorted structure to maintain. That makes the decision a question about the query mix, not a rule of thumb to apply everywhere. A column that filters queries down to a handful of rows, the way `visitor_id` does here, is worth indexing almost regardless of write volume, because the read saving is enormous and the extra structure is small relative to the table. A column like `status`, where one value covers most of the table, narrows a `SCAN` down by so little that a `SEARCH` over most of the index can cost about as much as reading the table directly, while every insert still pays for it. Composite indexes are not "more coverage is always better": a three-column index that duplicates a one-column index's leading column makes the narrower one redundant, per SQLite's own advice earlier on this page, and a covering index is worth its extra columns exactly when the queries it targets are frequent and read few enough columns that carrying them along in the index costs less than the table lookups it removes. None of that is guessable from the schema alone; it comes from writing the query, reading its plan, and, when the answer is not obvious from the plan alone, measuring it the way this page just did.
