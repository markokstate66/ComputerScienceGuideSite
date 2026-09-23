---
title: "Transactions, ACID and Isolation Levels"
description: "A real ROLLBACK that undoes a multi-statement transfer, the SQL-standard read anomalies, and which ones SQLite can and cannot show across two real connections."
pillar: databases
order: 5
author: markus
published: 2026-09-22
updated: 2026-09-22
level: intermediate
tags: [sql, transactions, acid, isolation-levels, sqlite]
prerequisites: ["databases/relational-model-and-keys", "databases/sql-joins"]
sources:
  - title: "PostgreSQL Documentation: 13.2. Transaction Isolation"
    url: "https://www.postgresql.org/docs/current/transaction-iso.html"
    publisher: "PostgreSQL Global Development Group"
    accessed: 2026-09-22
  - title: "PostgreSQL Documentation: 3.4. Transactions"
    url: "https://www.postgresql.org/docs/current/tutorial-transactions.html"
    publisher: "PostgreSQL Global Development Group"
    accessed: 2026-09-22
  - title: "SET TRANSACTION ISOLATION LEVEL (Transact-SQL)"
    url: "https://learn.microsoft.com/en-us/sql/t-sql/statements/set-transaction-isolation-level-transact-sql"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Deadlocks Guide - SQL Server"
    url: "https://learn.microsoft.com/en-us/sql/relational-databases/sql-server-deadlocks-guide"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Connection strings - Microsoft.Data.Sqlite"
    url: "https://learn.microsoft.com/en-us/dotnet/standard/data/sqlite/connection-strings"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "SQLite: Isolation In SQLite"
    url: "https://www.sqlite.org/isolation.html"
    publisher: "SQLite"
    accessed: 2026-09-22
  - title: "SQLite: File Locking And Concurrency In SQLite Version 3"
    url: "https://www.sqlite.org/lockingv3.html"
    publisher: "SQLite"
    accessed: 2026-09-22
  - title: "SQLite: Write-Ahead Logging"
    url: "https://www.sqlite.org/wal.html"
    publisher: "SQLite"
    accessed: 2026-09-22
  - title: "SQLite: BEGIN TRANSACTION"
    url: "https://www.sqlite.org/lang_transaction.html"
    publisher: "SQLite"
    accessed: 2026-09-22
  - title: "SQLite: sqlite3_busy_timeout"
    url: "https://www.sqlite.org/c3ref/busy_timeout.html"
    publisher: "SQLite"
    accessed: 2026-09-22
  - title: "SQLite: Result and Error Codes"
    url: "https://www.sqlite.org/rescode.html"
    publisher: "SQLite"
    accessed: 2026-09-22
  - title: "SQLite: ON CONFLICT Clause"
    url: "https://www.sqlite.org/lang_conflict.html"
    publisher: "SQLite"
    accessed: 2026-09-22
draft: false
---

A library lets members keep prepaid printing credit in a wallet. Moving credit from one member's wallet to another touches two rows: debit one, credit the other. If the program crashes, the network drops, or a rule is violated after the debit but before the credit, one member has lost money that nobody else received. Whether that can happen — and what a database connection can and cannot observe while it is happening — is what [ACID](/glossary/#transaction) is actually about.

## What does a transaction guarantee when a step in the middle fails?

Start with the wallets and a rule: a balance can never go negative, and this library caps prepaid credit at 1000 cents so nobody hoards it.

```sql run
CREATE TABLE wallet (
  member_id     INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,
  balance_cents INTEGER NOT NULL,
  CONSTRAINT balance_range
    CHECK (balance_cents BETWEEN 0 AND 1000)
);

INSERT INTO wallet (member_id, name, balance_cents)
VALUES
  (1, 'Ada', 500),
  (2, 'Boris', 800);
```

Moving 300 cents from Ada to Boris is two statements: debit Ada, credit Boris. Wrap them in an explicit transaction, and after the debit, check the state so far:

```sql run
BEGIN;

UPDATE wallet
SET balance_cents = balance_cents - 300
WHERE member_id = 1;

SELECT member_id, balance_cents
FROM wallet
ORDER BY member_id;
```

```text output
member_id  balance_cents
---------  -------------
1          200
2          800
```

Ada's debit is applied. The transaction is still open — nothing has committed. Now credit Boris, except the library just raised his balance with a bonus and he is already at 800; 800 + 300 = 1100 breaks the cap:

```sql run error
UPDATE wallet
SET balance_cents = balance_cents + 300
WHERE member_id = 2;
```

```text output
CHECK constraint failed: balance_range
```

The `CHECK` constraint refuses the second statement. Ada's debit is still sitting there, uncommitted, inside the open transaction. `ROLLBACK` discards the whole transaction, debit included, not just the statement that failed:

```sql run
ROLLBACK;

SELECT member_id, balance_cents
FROM wallet
ORDER BY member_id;
```

```text output
member_id  balance_cents
---------  -------------
1          500
2          800
```

Ada is back to 500. That is **atomicity**: a transaction's statements happen as one unit, so either all of them take effect or none do. Nobody who reads the wallets afterward, and no crash between the two statements, can catch the database in the half-finished state where Ada has paid and Boris has not.

Atomicity is not automatic just because two statements are related. Run the same debit-then-credit sequence with no `BEGIN` at all:

```sql run
UPDATE wallet
SET balance_cents = balance_cents - 300
WHERE member_id = 1;

SELECT member_id, balance_cents
FROM wallet
ORDER BY member_id;
```

```text output
member_id  balance_cents
---------  -------------
1          200
2          800
```

With no open transaction, [SQLite runs in autocommit mode](https://www.sqlite.org/lang_transaction.html): each statement is its own transaction and commits the instant it finishes. Ada's debit is already permanent. The credit fails exactly as before:

```sql run error
UPDATE wallet
SET balance_cents = balance_cents + 300
WHERE member_id = 2;
```

```text output
CHECK constraint failed: balance_range
```

There is no open transaction to roll back, because there never was one:

```sql run
SELECT member_id, balance_cents
FROM wallet
ORDER BY member_id;
```

```text output
member_id  balance_cents
---------  -------------
1          200
2          800
```

300 cents have gone missing. Ada was debited, Boris was never credited, and nothing in the database records that a transfer was even attempted. This is precisely the failure atomicity rules out — provided the transaction is actually opened, and actually rolled back when a step fails.

::::exercise[Commit after an ignored error]
Reset Ada to 500 first. Now suppose the application code opens a transaction, debits Ada, attempts to credit Boris, and its `catch` block logs the `CHECK constraint failed` error from the credit but has a bug: it calls `COMMIT` instead of `ROLLBACK`. Does the `COMMIT` succeed or fail? What are the final balances? [PostgreSQL's tutorial](https://www.postgresql.org/docs/current/tutorial-transactions.html) says that once a statement inside a transaction errors, the transaction is left in an aborted state, and "ROLLBACK TO is the only way to regain control of a transaction block that was put in aborted state by the system due to an error, short of rolling it back completely and starting again." Does SQLite behave the same way?

:::solution
SQLite lets the `COMMIT` succeed. [SQLite's documentation for its default `ABORT` conflict resolution algorithm](https://www.sqlite.org/lang_conflict.html) says a constraint violation "aborts the current SQL statement... but changes caused by prior SQL statements within the same transaction are preserved and the transaction remains active" — and calls this "the default behavior and the behavior specified by the SQL standard." A failed statement does not mark the transaction as broken; it just undoes itself and leaves the transaction open and otherwise usable, so a `COMMIT` right after is a perfectly ordinary `COMMIT` as far as SQLite is concerned:

```sql run
UPDATE wallet SET balance_cents = 500
WHERE member_id = 1;

BEGIN;

UPDATE wallet
SET balance_cents = balance_cents - 300
WHERE member_id = 1;
```

```sql run error
UPDATE wallet
SET balance_cents = balance_cents + 300
WHERE member_id = 2;
```

```text output
CHECK constraint failed: balance_range
```

```sql run
COMMIT;

SELECT member_id, balance_cents
FROM wallet
ORDER BY member_id;
```

```text output
member_id  balance_cents
---------  -------------
1          200
2          800
```

The `COMMIT` succeeded, and the same 300 cents vanished — this time despite an explicit transaction, because the code never checked whether the credit statement actually worked. PostgreSQL is stricter about exactly this mistake: once a statement inside a transaction fails, PostgreSQL marks the whole transaction aborted and refuses every further statement, `COMMIT` included, until a `ROLLBACK`. SQLite will not save you from a forgotten `ROLLBACK`; your application code has to check every statement's result and roll back on error itself.
:::
::::

## What does "consistency" mean once atomicity already exists?

The `CHECK (balance_cents BETWEEN 0 AND 1000)` constraint is the database's half of consistency: a rule the schema enforces on every row, regardless of which statement or which connection is writing. Atomicity is what makes that rule meaningful across a multi-statement operation — without it, a transfer that fails halfway could leave a row that, taken alone, still satisfies every `CHECK`, `UNIQUE` and foreign key, while the *pair* of wallets no longer adds up to what it did before the transfer. `CHECK`, `UNIQUE`, `NOT NULL` and foreign keys, covered in [The Relational Model: Tables, Keys and Relationships](/databases/relational-model-and-keys/), are the invariants a schema can state; atomicity, isolation and durability are the machinery that keeps a multi-statement operation from ever leaving the database in a state that breaks them, even briefly. Not every invariant can be written as a constraint — "the sum of all wallet balances never decreases except through a documented withdrawal" is a consistency rule no `CHECK` can express, because a `CHECK` only ever sees one row — and for those, consistency is only as good as the application code that maintains them inside a transaction.

## What can go wrong when two transactions overlap?

Everything so far has used one connection at a time. Real workloads run many transactions concurrently, and **isolation** is the question of what one transaction is allowed to see of another's in-progress work. [PostgreSQL's manual](https://www.postgresql.org/docs/current/transaction-iso.html) names three read anomalies from the SQL standard, plus a fourth that only a fully serializable engine avoids:

- **Dirty read.** A transaction reads a row that a concurrent, still-open transaction has written but not committed.
- **Non-repeatable read.** A transaction reads a row twice and gets two different answers, because another transaction committed a change to that row in between.
- **Phantom read.** A transaction re-runs a query with a `WHERE` clause and gets a different *set of rows*, because another transaction committed an insert or delete that changed which rows match.
- **Serialization anomaly.** The combined result of several committed transactions is not what any one-at-a-time ordering of them would have produced, even though no individual read looks wrong.

A dirty read is the easiest to picture. Suppose a database allowed one connection to see another's uncommitted write:

<figure class="diagram">
<svg viewBox="0 0 360 300" role="img" aria-labelledby="dirty-title dirty-desc">
<title id="dirty-title">A dirty read: T2 reads a balance T1 has not committed</title>
<desc id="dirty-desc">A vertical timeline of three steps. T1 begins a transaction and debits a wallet without committing. T2 then reads the debited balance on a separate connection. T1 rolls back. A caption notes that T2 saw a value that never existed in the committed data.</desc>
<defs>
<marker id="dirty-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-accent"/></marker>
</defs>
<rect x="8" y="8" width="344" height="56" rx="6" class="d-box-accent"/>
<text x="20" y="30" class="d-mono d-bold">T1</text>
<text x="60" y="30" class="d-small">BEGIN; UPDATE balance_cents</text>
<text x="60" y="50" class="d-small d-muted">-= 300 (not committed)</text>
<path d="M180 64 V96" class="d-accent" marker-end="url(#dirty-arrow)"/>
<text x="20" y="112" class="d-text-accent d-small">T2 reads it anyway</text>
<rect x="8" y="124" width="344" height="56" rx="6" class="d-box-bad"/>
<text x="20" y="146" class="d-mono d-bold">T2</text>
<text x="60" y="146" class="d-small">SELECT balance_cents</text>
<text x="60" y="166" class="d-small d-bold">reads 200</text>
<rect x="8" y="196" width="344" height="40" rx="6" class="d-box-accent"/>
<text x="20" y="220" class="d-mono d-bold">T1</text>
<text x="60" y="220" class="d-small">ROLLBACK</text>
<text x="8" y="260" class="d-muted d-small">200 never existed in the committed</text>
<text x="8" y="280" class="d-muted d-small">data: T1's debit was undone.</text>
</svg>
<figcaption>Figure 1. A dirty read in a database that allows it: T2's SELECT returns a value from an update that is later rolled back and never becomes real. The section on SQLite below shows why SQLite cannot produce this particular timeline.</figcaption>
</figure>

## Which SQL-standard isolation level prevents which anomaly?

The SQL standard defines four isolation levels by which of the first three anomalies each one permits. [PostgreSQL's documentation](https://www.postgresql.org/docs/current/transaction-iso.html) presents this as a table of what the standard permits at each level, adapted here to the three anomalies above (PostgreSQL's own version of the table adds a fourth column for the serialization anomaly, covered separately below):

| Level | Dirty | Non-repeat | Phantom |
|---|---|---|---|
| Uncommitted | Yes | Yes | Yes |
| Committed | No | Yes | Yes |
| Repeatable | No | No | Yes |
| Serializable | No | No | No |

Read the table as a floor, not a ceiling: the standard says what each level must prevent, not how, and an engine may prevent more than its level requires. PostgreSQL's own table flags exactly two such cells as "Allowed, but not in PG": requesting Read Uncommitted in PostgreSQL actually gets Read Committed behavior, because, as its documentation explains, "it is the only sensible way to map the standard isolation levels to PostgreSQL's multiversion concurrency control architecture" — so the dirty read the standard allows at that level never happens there. [PostgreSQL's own Repeatable Read does not allow phantom reads either](https://www.postgresql.org/docs/current/transaction-iso.html), which the standard permits but does not demand. A serialization anomaly is a separate, stronger guarantee: even a transaction that reads and writes disjoint rows from every other transaction can still produce a result no one-at-a-time ordering would, and only Serializable rules that out.

::::exercise[Name the anomaly]
T1 runs `SELECT COUNT(*) FROM wallet WHERE balance_cents > 0` and gets 2. Before T1 commits, T2 inserts a third wallet with a positive balance and commits. T1 re-runs the exact same query, still inside its own transaction, and now gets 3. Which anomaly is this, and which is the *weakest* of the four standard levels that guarantees it cannot happen?

:::solution
This is a phantom read: the same query, run twice in one transaction, returned a different set of matching rows because another transaction committed an insert in between (not because an existing row's value changed, which would be a non-repeatable read). Looking at the table, Repeatable Read still allows phantom reads — only Serializable disallows them. So Serializable is the weakest standard level that rules this out.
:::
::::

## What isolation level do SQL Server and PostgreSQL use by default?

Both default to the same name, Read Committed, but get there by different mechanisms.

[SQL Server's documentation](https://learn.microsoft.com/en-us/sql/t-sql/statements/set-transaction-isolation-level-transact-sql) states plainly that Read Committed "is the SQL Server default." By default that means locking: "the Database Engine uses shared locks to prevent other transactions from modifying rows while the current transaction is running a read operation," and those shared locks are released statement by statement, not held for the whole transaction — which is exactly why non-repeatable and phantom reads are still possible at this level. SQL Server also offers a row-versioned Read Committed, `READ_COMMITTED_SNAPSHOT`, which reads a consistent snapshot instead of taking locks; it is off by default on a boxed SQL Server instance, but the same documentation notes it "is the default on Azure SQL Database and SQL database in Microsoft Fabric."

PostgreSQL has no locking alternative for reads at all. [Its manual](https://www.postgresql.org/docs/current/transaction-iso.html) confirms "Read Committed is the default isolation level in PostgreSQL," and describes what that means under MVCC (multiversion concurrency control): "a `SELECT` query... sees only data committed before the query began; it never sees either uncommitted data or changes committed by concurrent transactions during the query's execution." The key word is *query*, not *transaction* — every statement gets its own fresh snapshot. PostgreSQL's Repeatable Read is the same mechanism at a coarser grain: "a query in a repeatable read transaction sees a snapshot as of the start of the first non-transaction-control statement in the transaction, not as of the start of the current statement within the transaction," so every statement in that transaction shares one snapshot, which is exactly what stops the non-repeatable read the table above predicts it should stop.

So "Read Committed" names a guarantee, not an implementation: SQL Server's default reaches it by taking and releasing row locks per statement, PostgreSQL's default reaches it by handing every statement a fresh multi-version snapshot, and neither approach lets one connection see another's in-progress write either way.

## Which of these anomalies can SQLite actually show you?

SQLite has no `SET TRANSACTION ISOLATION LEVEL`. Instead it [documents its guarantee directly](https://www.sqlite.org/isolation.html): "all transactions in SQLite show 'serializable' isolation... SQLite implements serializable transactions by actually serializing the writes. There can only be a single writer at a time to an SQLite database." One writer at a time, enforced by the five-state lock described in [SQLite's locking documentation](https://www.sqlite.org/lockingv3.html) — UNLOCKED, SHARED (many readers), RESERVED (one intending writer), PENDING and EXCLUSIVE — is a coarser mechanism than either vendor above: no row locks, no per-row versions, just one file-level write lock. Demonstrating what that mechanism can and cannot produce needs two real connections, which the `sql run` blocks on this page cannot give you (they all share one connection), so the rest of this section uses [Microsoft.Data.Sqlite](https://learn.microsoft.com/en-us/dotnet/standard/data/sqlite/connection-strings) against a real file. The demos below ran with .NET 10.0.401 on Windows 11, x64.

```csharp run id=no-dirty-read
#:package Microsoft.Data.Sqlite@9.*
using Microsoft.Data.Sqlite;

string path = Path.Combine(
    Path.GetTempPath(), $"wallet-{Guid.NewGuid()}.db");
string cs = $"Data Source={path}";

void Exec(SqliteConnection c, string sql)
{
    using var cmd = c.CreateCommand();
    cmd.CommandText = sql;
    cmd.ExecuteNonQuery();
}
object? Balance(SqliteConnection c)
{
    using var cmd = c.CreateCommand();
    cmd.CommandText =
        "SELECT balance_cents FROM wallet " +
        "WHERE member_id = 1";
    return cmd.ExecuteScalar();
}

using (var setup = new SqliteConnection(cs))
{
    setup.Open();
    Exec(setup,
        "CREATE TABLE wallet (member_id " +
        "INTEGER PRIMARY KEY, balance_cents " +
        "INTEGER NOT NULL)");
    Exec(setup,
        "INSERT INTO wallet VALUES (1, 500)");
}

using var a = new SqliteConnection(cs);
using var b = new SqliteConnection(cs);
a.Open();
b.Open();

// A debits Ada's wallet but has not committed yet.
Exec(a, "BEGIN IMMEDIATE");
Exec(a,
    "UPDATE wallet SET balance_cents = " +
    "balance_cents - 300 WHERE member_id = 1");

Console.WriteLine(
    $"B reads while A is uncommitted: {Balance(b)}");
Exec(a, "COMMIT");
Console.WriteLine(
    $"B reads after A commits:        {Balance(b)}");

a.Dispose();
b.Dispose();
SqliteConnection.ClearAllPools();
File.Delete(path);
```

```text output
B reads while A is uncommitted: 500
B reads after A commits:        200
```

No dirty read: B's first read, taken while A's debit is still uncommitted, returns the old value, not A's in-flight change — matching SQLite's own claim above. Notice, too, that B's two reads *did* return different answers, 500 then 200. That is not a non-repeatable read in the standard's sense, because B never opened a transaction of its own — each of those two `SELECT`s is its own implicit transaction under SQLite's autocommit rule, and two different transactions are allowed to see two different, both-correct answers. A genuine non-repeatable read requires one transaction to see two different answers from the *same* row, which is a stronger claim. Test that one next, together with a phantom read, using the same mechanism:

```csharp run id=blocked-write
#:package Microsoft.Data.Sqlite@9.*
using Microsoft.Data.Sqlite;

string path = Path.Combine(
    Path.GetTempPath(), $"wallet2-{Guid.NewGuid()}.db");
string cs = $"Data Source={path}";

void Exec(SqliteConnection c, string sql)
{
    using var cmd = c.CreateCommand();
    cmd.CommandText = sql;
    cmd.ExecuteNonQuery();
}
object? PositiveCount(SqliteConnection c)
{
    using var cmd = c.CreateCommand();
    cmd.CommandText =
        "SELECT COUNT(*) FROM wallet " +
        "WHERE balance_cents > 0";
    return cmd.ExecuteScalar();
}

using (var setup = new SqliteConnection(cs))
{
    setup.Open();
    Exec(setup,
        "CREATE TABLE wallet (member_id " +
        "INTEGER PRIMARY KEY, name TEXT NOT " +
        "NULL, balance_cents INTEGER NOT NULL)");
    Exec(setup,
        "INSERT INTO wallet VALUES " +
        "(1, 'Ada', 500), (2, 'Boris', 800)");
}

using var a = new SqliteConnection(cs);
using var b = new SqliteConnection(cs);
a.Open();
b.Open();
Exec(a, "PRAGMA busy_timeout = 300");

// B opens a transaction and counts positive wallets.
Exec(b, "BEGIN");
Console.WriteLine(
    $"B's first count:  {PositiveCount(b)}");

// A adds a third wallet that matches B's WHERE clause,
// then tries to commit while B's transaction is open.
Exec(a, "BEGIN IMMEDIATE");
Exec(a,
    "INSERT INTO wallet VALUES " +
    "(3, 'Chen', 100)");
try
{
    Exec(a, "COMMIT");
    Console.WriteLine("A's COMMIT: succeeded");
}
catch (SqliteException ex)
{
    Console.WriteLine(
        $"A's COMMIT: failed (code {ex.SqliteErrorCode})");
}

// B repeats the exact same query, same transaction.
Console.WriteLine(
    $"B's second count: {PositiveCount(b)}");
Exec(b, "COMMIT");

// B is out of the way; A's write can finally commit.
Exec(a, "COMMIT");
Console.WriteLine(
    $"B's count after both finish: " +
    $"{PositiveCount(b)}");

a.Dispose();
b.Dispose();
SqliteConnection.ClearAllPools();
File.Delete(path);
```

```text output
B's first count:  2
A's COMMIT: failed (code 5)
B's second count: 2
B's count after both finish: 3
```

A's row still matched B's `WHERE balance_cents > 0`, and A's insert even succeeded — but A's `COMMIT` did not. A's `INSERT` only needed the RESERVED lock, which coexists with B's SHARED lock just fine; A's `COMMIT` needs to escalate all the way to EXCLUSIVE, which [requires every SHARED lock to be released first](https://www.sqlite.org/lockingv3.html), and B is still holding one. B's transaction sees no phantom row and no non-repeatable read, but not because SQLite quietly gave it a stable snapshot the way PostgreSQL's MVCC does — B simply never has to reconcile a competing commit, because [SQLite blocks that commit](https://www.sqlite.org/rescode.html) until B is done. That code, 5, is `SQLITE_BUSY`, whose full message is `'database is locked'`, and [SQLite's own documentation](https://www.sqlite.org/rescode.html) says it means exactly this: "the database file could not be written... because of concurrent activity by some other database connection." SQLite is not choosing between Read Committed and Repeatable Read here; it is refusing to let a second writer finish at all while a reader is mid-transaction, which is a stronger, blunter guarantee than either standard level promises.

## How does write-ahead logging change durability and concurrency?

**Durability** is the promise that once a transaction commits, it survives a crash immediately afterward. SQLite's default rollback-journal mode gets there by writing the original page content to a journal file before overwriting the database file itself, so a crash mid-write can be undone on the next open. [Write-ahead logging (WAL) mode](https://www.sqlite.org/wal.html) inverts that: "the original content is preserved in the database file and the changes are appended into a separate WAL file. A COMMIT occurs when a special record indicating a commit is appended to the WAL." Durability comes from the same place either way — a record of the change reaches stable storage before the connection reports success — but WAL's append-only file changes what concurrent readers and writers can do to each other, because a writer no longer has to touch the pages a reader might be using.

Turn the previous demo's blocked `COMMIT` into a successful one, changing nothing except the journal mode:

```csharp run id=wal-snapshot
#:package Microsoft.Data.Sqlite@9.*
using Microsoft.Data.Sqlite;

string path = Path.Combine(
    Path.GetTempPath(), $"wallet3-{Guid.NewGuid()}.db");
string cs = $"Data Source={path}";

void Exec(SqliteConnection c, string sql)
{
    using var cmd = c.CreateCommand();
    cmd.CommandText = sql;
    cmd.ExecuteNonQuery();
}
object? Balance(SqliteConnection c)
{
    using var cmd = c.CreateCommand();
    cmd.CommandText =
        "SELECT balance_cents FROM wallet " +
        "WHERE member_id = 1";
    return cmd.ExecuteScalar();
}
object? JournalMode(SqliteConnection c)
{
    using var cmd = c.CreateCommand();
    cmd.CommandText = "PRAGMA journal_mode";
    return cmd.ExecuteScalar();
}

using (var setup = new SqliteConnection(cs))
{
    setup.Open();
    Exec(setup, "PRAGMA journal_mode = WAL");
    Exec(setup,
        "CREATE TABLE wallet (member_id " +
        "INTEGER PRIMARY KEY, balance_cents " +
        "INTEGER NOT NULL)");
    Exec(setup,
        "INSERT INTO wallet VALUES (1, 500)");
}

using var a = new SqliteConnection(cs);
using var b = new SqliteConnection(cs);
a.Open();
b.Open();
Console.WriteLine($"journal_mode: {JournalMode(a)}");

// B takes a snapshot by starting a read transaction.
Exec(b, "BEGIN");
Console.WriteLine(
    $"B's snapshot read:       {Balance(b)}");

// A writes and commits while B's snapshot is open.
Exec(a, "BEGIN IMMEDIATE");
Exec(a,
    "UPDATE wallet SET balance_cents = " +
    "balance_cents - 300 WHERE member_id = 1");
Exec(a, "COMMIT");
Console.WriteLine(
    "A's COMMIT: succeeded, B's transaction " +
    "is still open");

Console.WriteLine(
    $"B reads again, same snapshot: {Balance(b)}");
Exec(b, "COMMIT");
Console.WriteLine(
    $"B's next read, new snapshot:  {Balance(b)}");

a.Dispose();
b.Dispose();
SqliteConnection.ClearAllPools();
foreach (var suffix in new[] { "", "-wal", "-shm" })
    File.Delete(path + suffix);
```

```text output
journal_mode: wal
B's snapshot read:       500
A's COMMIT: succeeded, B's transaction is still open
B reads again, same snapshot: 500
B's next read, new snapshot:  200
```

In WAL mode, A's `COMMIT` no longer waits on B at all: [SQLite's WAL documentation explains that "because writers do nothing that would interfere with the actions of readers, writers and readers can run at the same time"](https://www.sqlite.org/wal.html) — or, as the same page's list of advantages puts it, "readers do not block writers and a writer does not block readers" — so a writer never has to evict a reader to finish. B's transaction still sees a consistent snapshot throughout — 500, then 500 again — but this time it is because [SQLite hands B's read transaction a fixed point in the WAL to read from](https://www.sqlite.org/wal.html), conceptually the same trade PostgreSQL's MVCC makes, not because anyone was blocked. Only once B ends its own transaction does its next read pick up A's committed change. Durability is unaffected either way: [checkpointing](https://www.sqlite.org/wal.html) still has to sync the WAL to storage before folding it back into the main file, exactly as the rollback journal has to sync before it can be deleted.

## What happens when two transactions each wait on a lock the other holds?

A **deadlock** is two transactions each waiting on a resource the other one holds, with neither able to proceed. [SQL Server's documentation](https://learn.microsoft.com/en-us/sql/relational-databases/sql-server-deadlocks-guide) gives the textbook shape: "transaction T1 has a shared (S) lock on row r1 and is waiting to get an exclusive (X) lock on r2. Transaction T2 has a shared (S) lock on r2 and is waiting to get an exclusive (X) lock on row r1." SQL Server runs a background "lock monitor thread" that searches for exactly this kind of cycle, and when it finds one, "chooses one of the tasks as a victim and terminates its transaction with an error," so the other transaction can proceed.

SQLite has no row-level locks to form that particular cycle, and no lock monitor. But its coarser, file-level locks can form a cycle of their own. Run two connections that each read first, then try to write:

```csharp run id=lock-cycle
#:package Microsoft.Data.Sqlite@9.*
using Microsoft.Data.Sqlite;

string path = Path.Combine(
    Path.GetTempPath(), $"wallet4-{Guid.NewGuid()}.db");
string cs = $"Data Source={path}";

void Exec(SqliteConnection c, string sql)
{
    using var cmd = c.CreateCommand();
    cmd.CommandText = sql;
    cmd.ExecuteNonQuery();
}
object? Read(SqliteConnection c, int id)
{
    using var cmd = c.CreateCommand();
    cmd.CommandText =
        "SELECT balance_cents FROM wallet " +
        "WHERE member_id = $id";
    cmd.Parameters.AddWithValue("$id", id);
    return cmd.ExecuteScalar();
}

using (var setup = new SqliteConnection(cs))
{
    setup.Open();
    Exec(setup,
        "CREATE TABLE wallet (member_id " +
        "INTEGER PRIMARY KEY, balance_cents " +
        "INTEGER NOT NULL)");
    Exec(setup,
        "INSERT INTO wallet VALUES " +
        "(1, 500), (2, 800)");
}

using var connA = new SqliteConnection(cs);
using var connB = new SqliteConnection(cs);
connA.Open();
connB.Open();
Exec(connA, "PRAGMA busy_timeout = 500");
Exec(connB, "PRAGMA busy_timeout = 500");

var bothReading = new Barrier(2);
var aHoldsReserved = new ManualResetEventSlim(false);
var bothWriting = new Barrier(2);
string resultA = "", resultB = "";

var taskB = Task.Run(() =>
{
    Exec(connB, "BEGIN");
    Read(connB, 2);
    bothReading.SignalAndWait();
    aHoldsReserved.Wait();
    bothWriting.SignalAndWait();
    try
    {
        Exec(connB,
            "UPDATE wallet SET balance_cents = " +
            "balance_cents - 50 WHERE member_id = 2");
        resultB = "B's UPDATE: succeeded";
    }
    catch (SqliteException ex)
    {
        resultB = $"B's UPDATE: failed (code {ex.SqliteErrorCode})";
    }
});

var taskA = Task.Run(() =>
{
    Exec(connA, "BEGIN");
    Read(connA, 1);
    bothReading.SignalAndWait();
    Exec(connA,
        "UPDATE wallet SET balance_cents = " +
        "balance_cents - 50 WHERE member_id = 1");
    aHoldsReserved.Set();
    bothWriting.SignalAndWait();
    try
    {
        Exec(connA, "COMMIT");
        resultA = "A's COMMIT: succeeded";
    }
    catch (SqliteException ex)
    {
        resultA = $"A's COMMIT: failed (code {ex.SqliteErrorCode})";
    }
});

Task.WaitAll(taskA, taskB);
Console.WriteLine(resultA);
Console.WriteLine(resultB);

try { Exec(connA, "ROLLBACK"); } catch { }
try { Exec(connB, "ROLLBACK"); } catch { }
Console.WriteLine(
    $"Final balances unchanged: {Read(connA, 1)}, " +
    $"{Read(connA, 2)}");

connA.Dispose();
connB.Dispose();
SqliteConnection.ClearAllPools();
File.Delete(path);
```

```text output
A's COMMIT: failed (code 5)
B's UPDATE: failed (code 5)
Final balances unchanged: 500, 800
```

The two `Barrier`s and the `ManualResetEventSlim` in that program exist only to line the two real threads up at the exact moment each one is about to block, so the run is reproducible instead of a race. What they line up is a genuine cycle: A holds the one RESERVED lock SQLite allows and is waiting for B's SHARED lock to release before it can reach EXCLUSIVE and commit; B is waiting for A's RESERVED lock to release before it can get RESERVED for itself and write. Each holds what the other is waiting for. That is the same shape as SQL Server's row-lock cycle, one level coarser.

<figure class="diagram">
<svg viewBox="0 0 360 372" role="img" aria-labelledby="lock-title lock-desc">
<title id="lock-title">A wait-for cycle between two SQLite connections</title>
<desc id="lock-desc">Five steps in order. T1 and T2 each begin and read, holding a SHARED lock. T1 writes, taking the one RESERVED lock. T2 tries to write and blocks, because RESERVED is taken. T1 tries to commit and also blocks, because T2 still holds SHARED. A caption explains that each is waiting on the other, and SQLite resolves it by letting both busy timeouts expire rather than detecting the cycle.</desc>
<rect x="8" y="8" width="344" height="40" rx="6" class="d-box"/>
<text x="20" y="32" class="d-mono d-bold">T1</text>
<text x="60" y="32" class="d-small">BEGIN; SELECT (holds SHARED)</text>
<rect x="8" y="56" width="344" height="40" rx="6" class="d-box"/>
<text x="20" y="80" class="d-mono d-bold">T2</text>
<text x="60" y="80" class="d-small">BEGIN; SELECT (holds SHARED)</text>
<rect x="8" y="104" width="344" height="40" rx="6" class="d-box-accent"/>
<text x="20" y="128" class="d-mono d-bold">T1</text>
<text x="60" y="128" class="d-small">UPDATE (takes RESERVED)</text>
<rect x="8" y="152" width="344" height="48" rx="6" class="d-box-bad"/>
<text x="20" y="174" class="d-mono d-bold">T2</text>
<text x="60" y="174" class="d-small">UPDATE: blocked, wants</text>
<text x="60" y="192" class="d-small">the RESERVED lock T1 holds</text>
<rect x="8" y="208" width="344" height="48" rx="6" class="d-box-bad"/>
<text x="20" y="230" class="d-mono d-bold">T1</text>
<text x="60" y="230" class="d-small">COMMIT: blocked, wants</text>
<text x="60" y="248" class="d-small">the SHARED lock T2 holds</text>
<text x="8" y="284" class="d-muted d-small">Each waits on a lock the other holds.</text>
<text x="8" y="304" class="d-muted d-small">SQLite has no cycle detector: it does</text>
<text x="8" y="324" class="d-muted d-small">not pick a victim. Both connections'</text>
<text x="8" y="344" class="d-muted d-small">busy timeouts simply expire, and both</text>
<text x="8" y="364" class="d-muted d-small">operations fail.</text>
</svg>
<figcaption>Figure 2. The lock-state timeline behind the demo above. Unlike SQL Server's deadlock monitor, which picks a victim so the other transaction can finish, neither SQLite connection here gets to finish; both retry loops just time out.</figcaption>
</figure>

That difference matters for how you write retry logic. [SQL Server's deadlock guide](https://learn.microsoft.com/en-us/sql/relational-databases/sql-server-deadlocks-guide) says that when the engine chooses a transaction as a deadlock victim, it "terminates the current batch, rolls back the transaction, and returns error 1205 to the application," so exactly one side needs to retry; the other already succeeded. Against SQLite, a `SQLITE_BUSY` on either side tells you only that *your* attempt timed out — the other connection may have failed too, may still be waiting, or may have already succeeded before your timeout expired. [Microsoft.Data.Sqlite's `Default Timeout` connection string keyword](https://learn.microsoft.com/en-us/dotnet/standard/data/sqlite/connection-strings) sets this per connection (30 seconds unless you override it), or `PRAGMA busy_timeout` as shown above sets it directly — [SQLite's own description of the underlying call](https://www.sqlite.org/c3ref/busy_timeout.html) is that it "sleeps for a specified amount of time when a table is locked" and, once that budget is used up, simply "returns SQLITE_BUSY." Application code has to be ready to retry its own transaction from the start once that happens, not just assume the other side lost the race.

::::exercise[Why a consistent lock order avoids the cycle]
In the demo above, A updates wallet 1 then commits; B reads wallet 2 then tries to update wallet 2. Suppose B instead updated wallet 1 *first*, i.e. both connections always touch wallet 1 before wallet 2. Using the five SQLite lock states — UNLOCKED, SHARED, RESERVED, PENDING, EXCLUSIVE — explain why this ordering cannot reproduce the cycle in the demo.

:::solution
Whichever connection reaches wallet 1's `UPDATE` first is the one that acquires the single RESERVED lock, since SQLite allows only one at a time. The other connection, trying the same `UPDATE wallet ... WHERE member_id = 1` next, blocks immediately waiting for RESERVED — before it has touched wallet 2 at all, and therefore before it can be holding anything the first connection needs. There is no longer a second edge in the wait-for graph: the second connection depends on the first, but the first depends on nothing, so it finishes, releases its locks, and the second connection's blocked write goes through. A cycle needs two connections each already holding something the other wants; forcing every transaction to acquire locks in the same order guarantees that whichever one gets there first is never blocked by the one behind it.
:::
::::
