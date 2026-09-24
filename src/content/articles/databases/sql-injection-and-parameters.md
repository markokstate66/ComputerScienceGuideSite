---
title: "SQL Injection and Parameterized Queries in .NET"
description: "Exploit a login query against in-memory SQLite, watch two kinds of escaping fail, fix it with parameters, and see what EF Core's FromSqlRaw still gets wrong."
pillar: databases
order: 7
author: markus
published: 2026-09-24
updated: 2026-09-24
level: intermediate
tags: [sql, sql-injection, security, parameterized-queries, ef-core, sqlite]
prerequisites: ["databases/relational-model-and-keys", "databases/transactions-and-acid"]
sources:
  - title: "SQL Injection Prevention - OWASP Cheat Sheet Series"
    url: "https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html"
    publisher: "OWASP"
    accessed: 2026-09-24
  - title: "CWE-89: Improper Neutralization of Special Elements used in an SQL Command"
    url: "https://cwe.mitre.org/data/definitions/89.html"
    publisher: "MITRE"
    accessed: 2026-09-24
  - title: "SQL Injection - SQL Server"
    url: "https://learn.microsoft.com/en-us/sql/relational-databases/security/sql-injection"
    publisher: "Microsoft Learn"
    accessed: 2026-09-24
  - title: "Parameters - Microsoft.Data.Sqlite"
    url: "https://learn.microsoft.com/en-us/dotnet/standard/data/sqlite/parameters"
    publisher: "Microsoft Learn"
    accessed: 2026-09-24
  - title: "Connection strings - Microsoft.Data.Sqlite"
    url: "https://learn.microsoft.com/en-us/dotnet/standard/data/sqlite/connection-strings"
    publisher: "Microsoft Learn"
    accessed: 2026-09-24
  - title: "SQL Queries - EF Core"
    url: "https://learn.microsoft.com/en-us/ef/core/querying/sql-queries"
    publisher: "Microsoft Learn"
    accessed: 2026-09-24
  - title: "SQLite: Result and Error Codes"
    url: "https://www.sqlite.org/rescode.html"
    publisher: "SQLite"
    accessed: 2026-09-24
  - title: "Batching - Microsoft.Data.Sqlite"
    url: "https://learn.microsoft.com/en-us/dotnet/standard/data/sqlite/batching"
    publisher: "Microsoft Learn"
    accessed: 2026-09-24
  - title: "Datatypes In SQLite"
    url: "https://www.sqlite.org/datatype3.html"
    publisher: "SQLite"
    accessed: 2026-09-24
draft: true
---

A login endpoint checks a username and password against a database table by building the `WHERE` clause with string concatenation. It passes every test a developer runs by hand: real accounts log in, mistyped passwords are rejected. Then someone submits `admin' -- ` as the username and any text at all as the password, and gets back an administrator's row with no working password in sight. Nothing about the check changed. Only what one of the two strings contained did.

The table below lives entirely in an in-memory SQLite database created by the program itself. There is no real system, credential, or product on the other end of any exploit on this page — the point is to see the mechanism clearly enough to recognize it in real code.

```csharp run id=vulnerable-login
#:package Microsoft.Data.Sqlite@9.*
using Microsoft.Data.Sqlite;

using var db = new SqliteConnection("Data Source=:memory:");
db.Open();

void Exec(string sql)
{
    using var cmd = db.CreateCommand();
    cmd.CommandText = sql;
    cmd.ExecuteNonQuery();
}

Exec(
    "CREATE TABLE account (username TEXT PRIMARY KEY, " +
    "password TEXT NOT NULL, is_admin INTEGER NOT NULL)");
Exec(
    "INSERT INTO account VALUES " +
    "('ada', 'trilobyte19', 0), ('admin', 'p7q2vX9wZ4', 1)");

bool? TryLogin(string username, string password)
{
    string where =
        $"username = '{username}' AND password = '{password}'";
    Console.WriteLine($"  WHERE {where}");
    using var cmd = db.CreateCommand();
    cmd.CommandText = "SELECT is_admin FROM account WHERE " + where;
    var result = cmd.ExecuteScalar();
    return result is null ? null : Convert.ToInt64(result) != 0;
}

Console.WriteLine("Ada, with her real password:");
Console.WriteLine($"  is_admin = {TryLogin("ada", "trilobyte19")}");

Console.WriteLine("Attacker, no password, closes the string early:");
Console.WriteLine(
    $"  is_admin = {TryLogin("admin' -- ", "anything")}");
```

```text output
Ada, with her real password:
  WHERE username = 'ada' AND password = 'trilobyte19'
  is_admin = False
Attacker, no password, closes the string early:
  WHERE username = 'admin' -- ' AND password = 'anything'
  is_admin = True
```

## Why does a closing quote change the question?

`TryLogin` builds one string and hands it to SQLite as SQL text. SQLite has no way to tell which parts of that text came from the developer and which parts came from the person typing into the login form; by the time it reaches the database, it is just a command. [MITRE's CWE-89 entry](https://cwe.mitre.org/data/definitions/89.html) names exactly this failure: a product "constructs all or part of an SQL command using externally-influenced input... but does not neutralize or incorrectly neutralizes special elements that could modify the intended SQL command." The special element here is the single quote. The username field expects a name; it ends the moment the attacker's own quote appears, one character sooner than the developer intended.

[Microsoft's own SQL injection guide](https://learn.microsoft.com/en-us/sql/relational-databases/security/sql-injection) walks through the identical mechanism against SQL Server: "the injection process works by prematurely terminating a text string and appending a new command," and because whatever follows the injected code might not be valid SQL on its own, "the malefactor terminates the injected string with a comment mark `--`." That is exactly what `admin' -- ` does. The quote right after `admin` closes the string literal the developer opened; `--` then turns everything after it, including the real `AND password = '...'` check, into a SQL comment the parser never evaluates. The query SQLite actually runs is `SELECT is_admin FROM account WHERE username = 'admin'`, full stop — a query that needs no password because, as far as the database is concerned, no password clause was ever written.

::::exercise[Predict the first row, not the admin row]
A well-known version of this attack skips naming an account entirely: instead of `admin' -- `, the attacker sends `' OR '1'='1' -- ` as the username with an empty password. Before running it, predict what `TryLogin` returns. Is the attacker necessarily logged in as an administrator?

:::solution
The built query becomes `SELECT is_admin FROM account WHERE username = '' OR '1'='1' -- ' AND password = ''`. `'1'='1'` is true for every row, so the `WHERE` clause matches both accounts, not just `admin`. `ExecuteScalar` returns only the first column of the first row SQLite happens to produce — which, for a plain scan with no `ORDER BY`, is Ada's, since her row was inserted first:

```csharp run id=or-trick
#:package Microsoft.Data.Sqlite@9.*
using Microsoft.Data.Sqlite;

using var db = new SqliteConnection("Data Source=:memory:");
db.Open();

void Exec(string sql)
{
    using var cmd = db.CreateCommand();
    cmd.CommandText = sql;
    cmd.ExecuteNonQuery();
}

Exec(
    "CREATE TABLE account (username TEXT PRIMARY KEY, " +
    "password TEXT NOT NULL, is_admin INTEGER NOT NULL)");
Exec(
    "INSERT INTO account VALUES " +
    "('ada', 'trilobyte19', 0), ('admin', 'p7q2vX9wZ4', 1)");

object? FirstIsAdmin(string username, string password)
{
    using var cmd = db.CreateCommand();
    cmd.CommandText =
        "SELECT is_admin FROM account WHERE username = '" +
        username + "' AND password = '" + password + "'";
    return cmd.ExecuteScalar();
}

var result = FirstIsAdmin("' OR '1'='1' -- ", "");
Console.WriteLine($"first row's is_admin: {result}");
```

```text output
first row's is_admin: 0
```

The attacker still broke in with no valid password — `is_admin: 0` is Ada's account, not a rejection — but they did not automatically become an administrator. That depends on row order, which `SELECT` without `ORDER BY` never promises. A real exploit against this bug would still need a second step, such as asking for a specific username, to reliably reach the admin row. The generalization "the OR trick logs you in as admin" is not quite true; it logs you in as *some* account whose row the query happens to return first.
:::
::::

## The same gap reaches further than a login form

A `WHERE` clause is not the only thing a closing quote can change. SQLite treats a semicolon as a statement separator inside a single batch of SQL text, and [Microsoft.Data.Sqlite's batching guide](https://learn.microsoft.com/en-us/dotnet/standard/data/sqlite/batching) documents exactly how far that goes: `ExecuteReader` "executes up to the first [statement] that returns results," each call to `NextResult()` runs statements up to the next one that returns results (or the end of the batch), and disposing the reader "executes any remaining statements that haven't been consumed by `NextResult()`" — so a batch is not optional extra work the library declines to do, it runs to completion as long as the reader is drained or disposed. Microsoft's own SQL injection guide names the identical shape against SQL Server: because "the semicolon (`;`) denotes the end of one query and the start of another," a single string closing a quote and adding a semicolon turns one intended query into two, and the database runs both. Try the same idea against the account table:

```csharp run id=stacked-query
#:package Microsoft.Data.Sqlite@9.*
using Microsoft.Data.Sqlite;

using var db = new SqliteConnection("Data Source=:memory:");
db.Open();

void Exec(string sql)
{
    using var cmd = db.CreateCommand();
    cmd.CommandText = sql;
    // NextResult() runs the batch's remaining statements
    // one at a time; without draining it, a later statement
    // never executes.
    using var reader = cmd.ExecuteReader();
    while (reader.NextResult()) { }
}

Exec(
    "CREATE TABLE account (username TEXT PRIMARY KEY, " +
    "password TEXT NOT NULL, is_admin INTEGER NOT NULL)");
Exec(
    "INSERT INTO account VALUES " +
    "('ada', 'trilobyte19', 0), ('admin', 'p7q2vX9wZ4', 1)");

// A username that ends the SELECT, starts a second
// statement, and comments out whatever follows it.
string username = "admin'; DROP TABLE account; --";
try
{
    Exec(
        "SELECT * FROM account WHERE username = '" +
        username + "'");
    Console.WriteLine("query ran, no exception");
}
catch (SqliteException ex)
{
    Console.WriteLine($"query failed: {ex.Message}");
}

using var check = db.CreateCommand();
check.CommandText =
    "SELECT COUNT(*) FROM sqlite_master WHERE name = 'account'";
bool stillThere = (long)check.ExecuteScalar()! == 1;
Console.WriteLine($"account table still exists: {stillThere}");
```

```text output
query ran, no exception
account table still exists: False
```

Nothing at the SQL level checks whether a given batch of text "is a login check" versus "is a schema change" — a connection either has permission to run a statement or it doesn't, and that permission belongs to the connection, not to the field the attacker's string came from. This is why a login bypass and a wiped table are the same bug at different depths, not two separate vulnerabilities; what actually limits which statements a connection can carry out is covered later, under least privilege. It is also why the account table has to be recreated after this block: it no longer exists.

## Escaping the quote closes one door, not the building

The obvious patch is to escape the character that made the bypass possible: double every single quote before it reaches the query, the way SQL represents a literal quote inside a string. Apply it to the login check:

```csharp run id=escaping-quote
#:package Microsoft.Data.Sqlite@9.*
using Microsoft.Data.Sqlite;

using var db = new SqliteConnection("Data Source=:memory:");
db.Open();

void Exec(string sql)
{
    using var cmd = db.CreateCommand();
    cmd.CommandText = sql;
    cmd.ExecuteNonQuery();
}

Exec(
    "CREATE TABLE account (username TEXT PRIMARY KEY, " +
    "password TEXT NOT NULL, is_admin INTEGER NOT NULL)");
Exec(
    "INSERT INTO account VALUES " +
    "('ada', 'trilobyte19', 0), ('admin', 'p7q2vX9wZ4', 1)");

static string Escaped(string s) => s.Replace("'", "''");

bool? TryLogin(string username, string password)
{
    string where =
        $"username = '{Escaped(username)}' " +
        $"AND password = '{Escaped(password)}'";
    Console.WriteLine($"  WHERE {where}");
    using var cmd = db.CreateCommand();
    cmd.CommandText = "SELECT is_admin FROM account WHERE " + where;
    var result = cmd.ExecuteScalar();
    return result is null ? null : Convert.ToInt64(result) != 0;
}

Console.WriteLine("Same attack string, quotes doubled first:");
var admin = TryLogin("admin' -- ", "anything");
Console.WriteLine(
    $"  is_admin = {(admin is null ? "no match" : admin.ToString())}");
```

```text output
Same attack string, quotes doubled first:
  WHERE username = 'admin'' -- ' AND password = 'anything'
  is_admin = no match
```

The doubled quote no longer closes the string early, so the whole attacker string is compared as one literal value and matches nothing. It looks like a fix. It fixes exactly one injection point, though: a place where the input is wrapped in quotes to begin with. Not every field is. A second, entirely reasonable-looking endpoint — "look up an account by its numeric ID" — takes an integer straight off a URL and never puts a quote anywhere near it:

```csharp run id=escaping-numeric
#:package Microsoft.Data.Sqlite@9.*
using Microsoft.Data.Sqlite;

using var db = new SqliteConnection("Data Source=:memory:");
db.Open();

void Exec(string sql)
{
    using var cmd = db.CreateCommand();
    cmd.CommandText = sql;
    cmd.ExecuteNonQuery();
}

Exec(
    "CREATE TABLE account (id INTEGER PRIMARY KEY, " +
    "username TEXT NOT NULL, is_admin INTEGER NOT NULL)");
Exec(
    "INSERT INTO account VALUES " +
    "(1, 'ada', 0), (2, 'boris', 0), (3, 'admin', 1)");

static string Escaped(string s) => s.Replace("'", "''");

// A "view one account" endpoint: the id comes from a URL
// like /accounts/1, so nothing here ever needs a quote.
List<string> AccountsWithId(string idText)
{
    using var cmd = db.CreateCommand();
    cmd.CommandText =
        "SELECT username FROM account WHERE id = " +
        Escaped(idText);
    using var reader = cmd.ExecuteReader();
    var names = new List<string>();
    while (reader.Read()) names.Add(reader.GetString(0));
    return names;
}

Console.WriteLine("A normal id:");
Console.WriteLine($"  {string.Join(", ", AccountsWithId("1"))}");

Console.WriteLine("Same escaping helper, id = '1 OR 1=1':");
Console.WriteLine(
    $"  {string.Join(", ", AccountsWithId("1 OR 1=1"))}");
```

```text output
A normal id:
  ada
Same escaping helper, id = '1 OR 1=1':
  ada, boris, admin
```

`Escaped` runs on every input, unconditionally, and does nothing here, because `1 OR 1=1` does not contain a single quote for it to double. The escaping helper was never wrong; it was only ever an answer to one character. [OWASP's cheat sheet](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html) is blunt about the whole strategy: escaping "is fragile compared to other defenses, and we CANNOT guarantee that this option will prevent all SQL injections in all situations." A numeric field with no quotes anywhere near it is exactly the situation it does not cover.

::::exercise[Does escaping stop the stacked query too?]
The numeric endpoint above still calls `Escaped` on its input. Predict what happens when it is called with `AccountsWithId("1; DROP TABLE account; --")`, using the batched-execution helper from the previous section instead of `ExecuteReader` directly. Then check.

:::solution
Same result as the unescaped stacked-query attack, because the payload still has no single quote for `Escaped` to touch:

```csharp run id=escaped-numeric-stacked
#:package Microsoft.Data.Sqlite@9.*
using Microsoft.Data.Sqlite;

using var db = new SqliteConnection("Data Source=:memory:");
db.Open();

void Exec(string sql)
{
    using var cmd = db.CreateCommand();
    cmd.CommandText = sql;
    using var reader = cmd.ExecuteReader();
    while (reader.NextResult()) { }
}

Exec(
    "CREATE TABLE account (id INTEGER PRIMARY KEY, " +
    "username TEXT NOT NULL, is_admin INTEGER NOT NULL)");
Exec(
    "INSERT INTO account VALUES " +
    "(1, 'ada', 0), (2, 'boris', 0), (3, 'admin', 1)");

static string Escaped(string s) => s.Replace("'", "''");

void RunWithId(string idText) =>
    Exec("SELECT username FROM account WHERE id = " + Escaped(idText));

try
{
    RunWithId("1; DROP TABLE account; --");
    Console.WriteLine("query ran, no exception");
}
catch (SqliteException ex)
{
    Console.WriteLine($"query failed: {ex.Message}");
}

using var check = db.CreateCommand();
check.CommandText =
    "SELECT COUNT(*) FROM sqlite_master WHERE name = 'account'";
bool stillThere = (long)check.ExecuteScalar()! == 1;
Console.WriteLine($"account table still exists: {stillThere}");
```

```text output
query ran, no exception
account table still exists: False
```

The escaping helper is not merely incomplete for the numeric endpoint; it offers no protection there at all, against either kind of attack. A defense that only neutralizes the quote character can't be the one thing standing between user input and a `DROP TABLE`.
:::
::::

## Parameters keep the value out of the command text

Every fix so far has tried to make the *string* safer before handing it to SQLite. Parameters remove the problem from that end entirely: the command's text and the value are sent to the database as two separate pieces, and the database only ever treats one of them as SQL.

<figure class="diagram">
<svg viewBox="0 0 360 320" role="img" aria-labelledby="qp-title qp-desc">
<title id="qp-title">Concatenation lets input rewrite the query; a parameter cannot</title>
<desc id="qp-desc">Two stacked panels. The top panel shows a WHERE clause built by string concatenation, where the attacker's closing quote and comment turn part of the query into dead text. The bottom panel shows the same input passed as a bound parameter, where it stays a single value next to a placeholder and the query text never changes.</desc>
<rect x="8" y="8" width="344" height="118" rx="6" class="d-box-bad"/>
<text x="20" y="28" class="d-small d-bold">Built by concatenation</text>
<rect x="20" y="38" width="320" height="52" rx="4" class="d-box-2"/>
<text x="28" y="58" class="d-mono d-small">username = 'admin' -- '</text>
<text x="28" y="76" class="d-mono d-small d-muted">AND password = 'x'</text>
<text x="20" y="112" class="d-small d-muted">the closing quote and -- rewrite the query</text>
<rect x="8" y="140" width="344" height="170" rx="6" class="d-box-good"/>
<text x="20" y="160" class="d-small d-bold">Bound as a parameter</text>
<rect x="20" y="170" width="320" height="36" rx="4" class="d-box-2"/>
<text x="28" y="193" class="d-mono d-small">username = $username</text>
<rect x="20" y="214" width="320" height="36" rx="4" class="d-box-2"/>
<text x="28" y="237" class="d-mono d-small">$username: "admin' -- "</text>
<text x="20" y="266" class="d-small d-muted">the value never becomes part of the SQL text</text>
<text x="20" y="286" class="d-small d-muted">the query the engine compiles cannot change</text>
</svg>
<figcaption>Figure 1. The same attacker input, built into the command text above versus bound as a parameter below. Concatenation lets the closing quote change what the database parses as SQL; a parameter cannot, because the query's structure is fixed before the value is attached.</figcaption>
</figure>

[OWASP's cheat sheet](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html) puts the guarantee plainly: with a prepared statement, "the database will always distinguish between code and data, regardless of what user input is supplied." [Microsoft.Data.Sqlite's parameters guide](https://learn.microsoft.com/en-us/dotnet/standard/data/sqlite/parameters) shows the mechanics: "parameters can be prefixed with either `:`, `@`, or `$`," and a value is attached with `Parameters.AddWithValue`, never woven into the command string. Rewrite the login check that way:

```csharp run id=params-login
#:package Microsoft.Data.Sqlite@9.*
using Microsoft.Data.Sqlite;

using var db = new SqliteConnection("Data Source=:memory:");
db.Open();

void Exec(string sql)
{
    using var cmd = db.CreateCommand();
    cmd.CommandText = sql;
    cmd.ExecuteNonQuery();
}

Exec(
    "CREATE TABLE account (username TEXT PRIMARY KEY, " +
    "password TEXT NOT NULL, is_admin INTEGER NOT NULL)");
Exec(
    "INSERT INTO account VALUES " +
    "('ada', 'trilobyte19', 0), ('admin', 'p7q2vX9wZ4', 1)");

bool? TryLogin(string username, string password)
{
    using var cmd = db.CreateCommand();
    cmd.CommandText =
        "SELECT is_admin FROM account " +
        "WHERE username = $username AND password = $password";
    cmd.Parameters.AddWithValue("$username", username);
    cmd.Parameters.AddWithValue("$password", password);
    var result = cmd.ExecuteScalar();
    return result is null ? null : Convert.ToInt64(result) != 0;
}

Console.WriteLine("Ada, real password, bound as parameters:");
Console.WriteLine($"  is_admin = {TryLogin("ada", "trilobyte19")}");

var attack = TryLogin("admin' -- ", "anything");
Console.WriteLine("Same attack string, bound as a parameter:");
Console.WriteLine(
    $"  is_admin = " +
    (attack is null ? "no match" : attack.ToString()));
```

```text output
Ada, real password, bound as parameters:
  is_admin = False
Same attack string, bound as a parameter:
  is_admin = no match
```

Nothing in `admin' -- ` gets special treatment. It is compared, character for character, against the stored usernames, and matches none of them — the query SQLite compiles is `WHERE username = $username AND password = $password` no matter what either value contains. That includes the numeric endpoint the escaping helper never protected:

```csharp run id=params-numeric
#:package Microsoft.Data.Sqlite@9.*
using Microsoft.Data.Sqlite;

using var db = new SqliteConnection("Data Source=:memory:");
db.Open();

void Exec(string sql)
{
    using var cmd = db.CreateCommand();
    cmd.CommandText = sql;
    cmd.ExecuteNonQuery();
}

Exec(
    "CREATE TABLE account (id INTEGER PRIMARY KEY, " +
    "username TEXT NOT NULL, is_admin INTEGER NOT NULL)");
Exec(
    "INSERT INTO account VALUES " +
    "(1, 'ada', 0), (2, 'boris', 0), (3, 'admin', 1)");

List<string> AccountsWithId(string idText)
{
    using var cmd = db.CreateCommand();
    cmd.CommandText = "SELECT username FROM account WHERE id = $id";
    cmd.Parameters.AddWithValue("$id", idText);
    using var reader = cmd.ExecuteReader();
    var names = new List<string>();
    while (reader.Read()) names.Add(reader.GetString(0));
    return names;
}

Console.WriteLine("Same payload, now bound as a parameter:");
var rows = AccountsWithId("1 OR 1=1");
Console.WriteLine($"  [{string.Join(", ", rows)}]");
```

```text output
Same payload, now bound as a parameter:
  []
```

`$id` is bound as the text value `"1 OR 1=1"`, and this is not a coincidence of that one payload failing to look like a number. [SQLite's own type documentation](https://www.sqlite.org/datatype3.html) sets the rule: comparing a value against an `INTEGER`-affinity column applies numeric affinity to the other side first, converting it *only if it looks like a well-formed number*; `"1 OR 1=1"` does not, so it stays `TEXT`, and SQLite's storage-class ordering says "an INTEGER or REAL value is less than any TEXT or BLOB value" — a `TEXT` value can never equal an `INTEGER` one, full stop. Bound as a parameter, no string the caller supplies can ever satisfy `id = $id` unless it is itself a valid integer literal, which is guaranteed by the comparison rule, not by this particular attack string missing a quote. The result is an empty set instead of the whole table. Unlike escaping, the fix does not depend on which character happens to be dangerous in a given spot: the value never enters the SQL text at all, so it makes no difference whether it contains a quote, a semicolon, or nothing special-looking whatsoever.

## What FromSqlInterpolated does that FromSqlRaw does not

An ORM does not remove this problem; it moves the decision to an API surface. Entity Framework Core offers two ways to drop into raw SQL, and [its own documentation is explicit](https://learn.microsoft.com/en-us/ef/core/querying/sql-queries) about which one is which: "[FromSql] and [FromSqlInterpolated] are safe against SQL injection, and always integrate parameter data as a separate SQL parameter. However, the [FromSqlRaw] method can be vulnerable to SQL injection attacks, if improperly used." `FromSqlInterpolated` takes a C# interpolated string but does not simply concatenate it — each `{ }` becomes a separate `DbParameter` before the SQL is sent. `FromSqlRaw` takes a plain string, so anything built into that string before the call, including ordinary concatenation, is just text to it.

```csharp run id=ef-core-fromsql
#:package Microsoft.EntityFrameworkCore.Sqlite@9.*
#:property PublishAot=false
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

using var connection = new SqliteConnection("Data Source=:memory:");
connection.Open();
using (var db = new AppDb(connection))
{
    db.Database.EnsureCreated();
    db.Accounts.AddRange(
        new Account { Username = "ada", IsAdmin = false },
        new Account { Username = "admin", IsAdmin = true });
    db.SaveChanges();
}

string attacker = "admin' -- ";

using (var db = new AppDb(connection))
{
    var safe = db.Accounts
        .FromSqlInterpolated(
            $"SELECT * FROM Accounts WHERE Username = {attacker}")
        .ToList();
    Console.WriteLine($"FromSqlInterpolated: {safe.Count} row(s)");
}

using (var db = new AppDb(connection))
{
    var risky = db.Accounts
        .FromSqlRaw(
            "SELECT * FROM Accounts WHERE Username = '" +
            attacker + "'")
        .ToList();
    Console.WriteLine(
        $"FromSqlRaw + concatenation: {risky.Count} row(s)");
    foreach (var a in risky)
        Console.WriteLine($"  leaked: {a.Username}, admin={a.IsAdmin}");
}

class Account
{
    public string Username { get; set; } = "";
    public bool IsAdmin { get; set; }
}

class AppDb(SqliteConnection connection) : DbContext
{
    public DbSet<Account> Accounts => Set<Account>();

    protected override void OnConfiguring(
        DbContextOptionsBuilder options)
        => options.UseSqlite(connection);

    protected override void OnModelCreating(ModelBuilder model) =>
        model.Entity<Account>().HasKey(a => a.Username);
}
```

```text output
FromSqlInterpolated: 0 row(s)
FromSqlRaw + concatenation: 1 row(s)
  leaked: admin, admin=True
```

`FromSqlInterpolated` treats `attacker` as one parameter value, exactly like the raw ADO.NET parameter above, and correctly finds nobody. `FromSqlRaw`, handed the already-concatenated string, has no way to know a value was ever glued in — by the time it sees the text, it looks like any other query, quote and all, and the injected row comes back with `admin=True`. The method is not "the dangerous one" in general; the [same documentation](https://learn.microsoft.com/en-us/ef/core/querying/sql-queries) also describes legitimate uses of `FromSqlRaw`, such as building a query with a caller-supplied column name, which SQL has no parameter syntax for at all: "databases do not allow parameterizing column names (or any other part of the schema)." What makes the call above unsafe is not the method name; it is concatenating unchecked input into the string before the call.

::::exercise[Sort by a caller-chosen column, safely]
A reporting page lets its caller pick a sort column, which can't be a parameter because `ORDER BY` doesn't accept one for a column name. Write a version of the query that still rejects `"Username; DROP TABLE Accounts; --"` as a column name.

:::solution
Check the column name against a fixed allow-list before it ever reaches the SQL string, so nothing but a known-good identifier is ever concatenated:

```csharp run id=ef-allowlist
#:package Microsoft.EntityFrameworkCore.Sqlite@9.*
#:property PublishAot=false
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

using var connection = new SqliteConnection("Data Source=:memory:");
connection.Open();
using (var db = new AppDb(connection))
{
    db.Database.EnsureCreated();
    db.Accounts.AddRange(
        new Account { Username = "boris", IsAdmin = false },
        new Account { Username = "ada", IsAdmin = false });
    db.SaveChanges();
}

HashSet<string> AllowedColumns = ["Username", "IsAdmin"];

List<Account> SortedBy(AppDb db, string column)
{
    if (!AllowedColumns.Contains(column))
        throw new ArgumentException($"unknown sort column: {column}");
    return db.Accounts
        .FromSqlRaw("SELECT * FROM Accounts ORDER BY " + column)
        .ToList();
}

using (var db = new AppDb(connection))
{
    foreach (var a in SortedBy(db, "Username"))
        Console.WriteLine($"  {a.Username}");
}

using (var db = new AppDb(connection))
{
    try
    {
        SortedBy(db, "Username; DROP TABLE Accounts; --");
    }
    catch (ArgumentException ex)
    {
        Console.WriteLine($"rejected: {ex.Message}");
    }
}

class Account
{
    public string Username { get; set; } = "";
    public bool IsAdmin { get; set; }
}

class AppDb(SqliteConnection connection) : DbContext
{
    public DbSet<Account> Accounts => Set<Account>();

    protected override void OnConfiguring(
        DbContextOptionsBuilder options)
        => options.UseSqlite(connection);

    protected override void OnModelCreating(ModelBuilder model) =>
        model.Entity<Account>().HasKey(a => a.Username);
}
```

```text output
  ada
  boris
rejected: unknown sort column: Username; DROP TABLE Accounts; --
```

This is exactly the "allow-list" defense OWASP's cheat sheet names for the cases parameters cannot reach: the value is checked against a small, fixed set of acceptable identifiers, and anything else is refused before it can become part of the query text — the same principle as parameters, applied where SQL's own syntax leaves no parameter slot to fill.
:::
::::

## Least privilege limits the damage, not the injection

Everything above fixes the query. Least privilege is a different kind of defense: it assumes some query, somewhere, will eventually be wrong, and asks what a connection is even allowed to do once that happens. [Microsoft.Data.Sqlite's connection strings guide](https://learn.microsoft.com/en-us/dotnet/standard/data/sqlite/connection-strings) documents a `Mode=ReadOnly` keyword that "opens the database in read-only mode," which is as close as file-based SQLite gets to a restricted database account — there is no `GRANT` statement to reach for. Give a read-only, reporting-style connection the same vulnerable, concatenated query from the stacked-query section above:

```csharp run id=least-privilege
#:package Microsoft.Data.Sqlite@9.*
using Microsoft.Data.Sqlite;

string path = Path.Combine(
    Path.GetTempPath(), $"account-{Guid.NewGuid()}.db");
string cs = $"Data Source={path}";

using (var setup = new SqliteConnection(cs))
{
    setup.Open();
    using var cmd = setup.CreateCommand();
    cmd.CommandText =
        "CREATE TABLE account (username TEXT PRIMARY KEY, " +
        "password TEXT NOT NULL); " +
        "INSERT INTO account VALUES " +
        "('ada', 'trilobyte19'), ('admin', 'p7q2vX9wZ4')";
    cmd.ExecuteNonQuery();
}

// The reporting feature only ever needs to read, so its
// connection is opened read-only at the SQLite level.
using (var reports = new SqliteConnection($"{cs};Mode=ReadOnly"))
{
    reports.Open();

    void RunConcatenated(string sql)
    {
        using var cmd = reports.CreateCommand();
        cmd.CommandText = sql;
        using var reader = cmd.ExecuteReader();
        while (reader.Read())
            Console.WriteLine(
                $"  row: {reader.GetString(0)}, {reader.GetString(1)}");
        while (reader.NextResult()) { }
    }

    Console.WriteLine("Attacker tries to drop the table:");
    string drop = "nobody'; DROP TABLE account; --";
    try
    {
        RunConcatenated(
            "SELECT * FROM account WHERE username = '" + drop + "'");
    }
    catch (SqliteException ex)
    {
        Console.WriteLine(
            $"  blocked: SQLite error {ex.SqliteErrorCode}");
    }

    Console.WriteLine("Attacker instead reads every row with UNION:");
    string leak =
        "nobody' UNION SELECT username, password FROM account --";
    RunConcatenated(
        "SELECT * FROM account WHERE username = '" + leak + "'");
}

SqliteConnection.ClearAllPools();
File.Delete(path);
```

```text output
Attacker tries to drop the table:
  blocked: SQLite error 8
Attacker instead reads every row with UNION:
  row: ada, trilobyte19
  row: admin, p7q2vX9wZ4
```

Error 8 is [`SQLITE_READONLY`](https://www.sqlite.org/rescode.html), "returned when an attempt is made to alter some data for which the current database connection does not have write permission." The destructive half of the attack genuinely fails: no table is dropped, no row is changed, because the connection itself cannot write, no matter what SQL text reaches it. The reader half fails to fail. A `UNION SELECT` needs no write permission at all, so the same injection that couldn't drop a table walks out with every stored password in the file, in one query, on a connection that was doing exactly what it was configured to do. [OWASP's guidance on minimizing privileges](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html) is about limiting what an attacker can reach once inside, not about stopping them from getting in, and [CWE-89's own list of consequences](https://cwe.mitre.org/data/definitions/89.html) names exactly this split: it lists "Execute Unauthorized Code or Commands" first and "Read Application Data" second. A read-only connection removes the first consequence entirely — there is no write permission left to abuse — without touching the second at all, which is a sharper way to say the same thing: least privilege closes one of CWE-89's listed doors and leaves the other standing. That is the whole shape of least privilege as a defense: it changes what the bug is worth to whoever finds it, not whether the bug exists.
