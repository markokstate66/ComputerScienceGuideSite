---
title: "The Relational Model: Tables, Keys and Relationships"
description: "Design a small library database from its requirements: relations, candidate and foreign keys, a junction table, and constraints you watch reject bad rows."
pillar: databases
order: 1
author: markus
published: 2026-09-18
updated: 2026-09-18
level: beginner
tags: [sql, relational-model, keys, constraints, sqlite]
prerequisites: []
sources:
  - title: "E. F. Codd, A Relational Model of Data for Large Shared Data Banks, Communications of the ACM 13(6), 1970"
    url: "https://www.engineering.upenn.edu/~zives/03f/cis550/codd.pdf"
    publisher: "ACM (copy hosted by the University of Pennsylvania)"
    accessed: 2026-09-18
  - title: "Database System Concepts, 7th ed., chapter 2: Introduction to the Relational Model (authors' slides)"
    url: "https://www.db-book.com/slides-dir/PDF-dir/ch2.pdf"
    publisher: "Silberschatz, Korth and Sudarshan"
    accessed: 2026-09-18
  - title: "SQLite: CREATE TABLE (PRIMARY KEY, UNIQUE, NOT NULL and CHECK constraints, rowid)"
    url: "https://www.sqlite.org/lang_createtable.html"
    publisher: "SQLite"
    accessed: 2026-09-18
  - title: "SQLite Foreign Key Support"
    url: "https://www.sqlite.org/foreignkeys.html"
    publisher: "SQLite"
    accessed: 2026-09-18
  - title: "SQLite: PRAGMA statements (foreign_keys, foreign_key_check)"
    url: "https://www.sqlite.org/pragma.html"
    publisher: "SQLite"
    accessed: 2026-09-18
  - title: "SQLite: STRICT Tables"
    url: "https://www.sqlite.org/stricttables.html"
    publisher: "SQLite"
    accessed: 2026-09-18
  - title: "SQLite: Datatypes (storage classes, date and time values)"
    url: "https://www.sqlite.org/datatype3.html"
    publisher: "SQLite"
    accessed: 2026-09-18
  - title: "SQLite: Partial Indexes"
    url: "https://www.sqlite.org/partialindex.html"
    publisher: "SQLite"
    accessed: 2026-09-18
  - title: "SQLite: ALTER TABLE"
    url: "https://www.sqlite.org/lang_altertable.html"
    publisher: "SQLite"
    accessed: 2026-09-18
  - title: "SQLite: Date and Time Functions"
    url: "https://www.sqlite.org/lang_datefunc.html"
    publisher: "SQLite"
    accessed: 2026-09-18
  - title: "PostgreSQL Documentation: 11.8. Partial Indexes"
    url: "https://www.postgresql.org/docs/current/indexes-partial.html"
    publisher: "PostgreSQL Global Development Group"
    accessed: 2026-09-18
  - title: "Create filtered indexes (SQL Server)"
    url: "https://learn.microsoft.com/en-us/sql/relational-databases/indexes/create-filtered-indexes"
    publisher: "Microsoft Learn"
    accessed: 2026-09-18
  - title: "PostgreSQL Documentation: 5.5. Constraints"
    url: "https://www.postgresql.org/docs/current/ddl-constraints.html"
    publisher: "PostgreSQL Global Development Group"
    accessed: 2026-09-18
  - title: "Primary and foreign key constraints (SQL Server)"
    url: "https://learn.microsoft.com/en-us/sql/relational-databases/tables/primary-and-foreign-key-constraints"
    publisher: "Microsoft Learn"
    accessed: 2026-09-18
  - title: "Unique constraints and check constraints (SQL Server)"
    url: "https://learn.microsoft.com/en-us/sql/relational-databases/tables/unique-constraints-and-check-constraints"
    publisher: "Microsoft Learn"
    accessed: 2026-09-18
draft: true
---

A small public library is moving its records out of a spreadsheet. Asked how the place works, the librarian gives seven sentences:

1. Every member has a name and an email address, and no two members share an email address.
2. A member may have been referred by one other member.
3. A book can have several authors, and an author can have written several books.
4. The library may own several physical copies of one book. Each copy carries its own barcode.
5. A loan records which member took which copy, when, and when it is due back.
6. A copy can be out with only one member at a time.
7. Late fees are whole dollars and never negative.

Each sentence is a rule about which data is allowed to exist. This page turns all seven into declarations that the database enforces by itself, so that a row that breaks a rule is refused no matter which program, script or hurried human sends it. The vocabulary of the relational model (relation, tuple, key, foreign key) arrives as each rule needs it.

The SQL runs on SQLite 3.37 or later; the results shown come from SQLite 3.50. Run the statements in order in one session. Where PostgreSQL or SQL Server behaves differently, the text says so.

## A relation is a set of rows; a table only resembles one

Start with the members. A first attempt stores exactly what rule 1 mentions and nothing else:

```sql run
CREATE TABLE signup_sheet (
  name  TEXT,
  email TEXT
);

INSERT INTO signup_sheet (name, email)
VALUES
  ('Ada', 'ada@example.org'),
  ('Ada', 'ada@example.org');

SELECT name, email
FROM signup_sheet;
```

```text output
name  email
----  ---------------
Ada   ada@example.org
Ada   ada@example.org
```

Somebody pressed Enter twice, and the library now has two Adas that no query can tell apart. Try to remove one: every `WHERE` clause that matches the first row matches the second as well, so a `DELETE ... WHERE` removes both or neither. Engines have escape hatches (SQLite could address one row through its hidden `rowid` column), but nothing in the data distinguishes the rows.

The relational model rules this state out by definition. In [the 1970 paper that introduced it](https://www.engineering.upenn.edu/~zives/03f/cis550/codd.pdf), E. F. Codd uses **relation** "in its accepted mathematical sense": given sets *S*<sub>1</sub> to *S*<sub>n</sub>, a relation is a *set* of *n*-tuples whose first element comes from *S*<sub>1</sub>, second from *S*<sub>2</sub>, and so on. A **tuple** is one such list of values, and each *S* is a **domain**, the set of values allowed in that position. Codd then describes the picture everyone now draws, an array with one row per tuple, and lists its properties in section 1.3. Two of them do the work here:

- "The ordering of rows is immaterial."
- "All rows are distinct."

Both follow from the word *set*. A set has no first element and cannot contain the same thing twice. In that vocabulary, a table is a relation, a row is a tuple, and a column is an **attribute**: a named position in the tuple, with a domain.

The unordered part carries over to SQL: a query without `ORDER BY` may return rows in whatever order the engine finds convenient. In two other ways an SQL table is looser than a relation:

- **Duplicates.** As `signup_sheet` showed, a table with no key accepts the same row twice.
- **`NULL`.** A column may hold `NULL`, a marker for "no value here". The textbook relational model admits it too, with a warning: the slides for chapter 2 of [Silberschatz, Korth and Sudarshan](https://www.db-book.com/slides-dir/PDF-dir/ch2.pdf) say the null value "causes complications in the definition of many operations".

Designing a schema is largely the work of closing those gaps again: declaring keys so rows are distinct, and declaring `NOT NULL` wherever "no value" makes no sense.

```sql run
DROP TABLE signup_sheet;
```

:::pitfall[SQLite column types are a suggestion]
A domain is the first constraint: a column of numbers should refuse the word *twelve*. An ordinary SQLite table tries to convert the text and, if it cannot, [stores it as text anyway](https://www.sqlite.org/datatype3.html#type_affinity):

```sql run
CREATE TABLE loose (n INTEGER);
INSERT INTO loose (n)
VALUES ('12'), ('twelve');

SELECT n, typeof(n) AS stored_as
FROM loose;
```

```text output
n       stored_as
------  ---------
12      integer
twelve  text
```

Adding the keyword `STRICT` after the closing parenthesis ([SQLite 3.37 and later](https://www.sqlite.org/stricttables.html)) makes the declared type binding, which the same page says is how PostgreSQL, MySQL, SQL Server and Oracle behave all the time. The insert is refused with a message that begins:

```sql run error
CREATE TABLE tight (
  n INTEGER
) STRICT;
INSERT INTO tight (n)
VALUES ('twelve');
```

```text output
cannot store TEXT value
```

The tables on this page are ordinary ones, so the same `CREATE TABLE` statements work unchanged in other engines.
:::

```sql run
DROP TABLE loose;
DROP TABLE tight;
```

## Keys: which columns identify a row?

"All rows are distinct" is a weak promise by itself: two rows for Ada that differ only in the spelling of her name are distinct and still wrong. What you want to say is stronger: *these particular columns* are enough to pick out one row. The textbook vocabulary, from the same chapter of Silberschatz, has three levels.

A **superkey** is any set of columns whose values identify at most one row in every state the table is ever allowed to be in. For members, `{email}` is a superkey by rule 1. So is `{email, name}`, since adding columns to a superkey cannot make it identify less.

A **candidate key** is a superkey with nothing to spare: remove any column and it stops being a superkey. `{email}` is a candidate key; `{email, name}` is not, because `name` is superfluous. Codd's paper has the same idea under an older name: a key is "nonredundant" if none of its columns "is superfluous in uniquely identifying each element", and a relation "may possess more than one".

The **primary key** is the one candidate key the designer picks as the row's official identifier, the value other tables will use to refer to it. The candidate keys that were not picked are often called alternate keys.

Should `email` be the primary key, then? It is a **natural key**: a value that already exists in the world. People change their email addresses, and the primary key is the value that gets copied into every table that refers to a member, so each change would have to be copied too. The usual alternative is a **surrogate key**: a number with no meaning outside the database, which therefore never has a reason to change. The member gets both. `member_id` is the primary key, and `email` stays a candidate key, declared with `NOT NULL UNIQUE`:

```sql run
CREATE TABLE member (
  member_id   INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE,
  referred_by INTEGER
    REFERENCES member (member_id)
);

INSERT INTO member
  (member_id, name, email, referred_by)
VALUES
  (1, 'Ada',
   'ada@example.org', NULL),
  (2, 'Boris',
   'boris@example.org', 1),
  (3, 'Chen',
   'chen@example.org', 1),
  (4, 'Dalia',
   'dalia@example.org', 3);
```

The last column covers rule 2 and is explained in the next section.

<figure class="diagram">
<svg viewBox="0 0 360 300" role="img" aria-labelledby="rk-title rk-desc">
<title id="rk-title">Superkeys, candidate keys and the primary key of the member table</title>
<desc id="rk-desc">Three nested boxes. The outer box holds superkeys such as member_id with name, email with name, and member_id with email. Inside it, the candidate keys box holds the two minimal ones: member_id, marked as the chosen primary key, and email, marked as an alternate key declared NOT NULL UNIQUE.</desc>
<rect x="8" y="8" width="344" height="284" rx="8" class="d-box"/>
<text x="20" y="30" class="d-small d-bold">Superkeys: column sets that identify one row</text>
<text x="20" y="52" class="d-mono d-small d-muted">{member_id, name}   {email, name}</text>
<text x="20" y="70" class="d-mono d-small d-muted">{member_id, email}   and more</text>
<rect x="20" y="86" width="320" height="194" rx="8" class="d-box-2"/>
<text x="32" y="108" class="d-small d-bold">Candidate keys: no column to spare</text>
<rect x="32" y="120" width="296" height="68" rx="6" class="d-box-accent"/>
<text x="46" y="147" class="d-mono d-bold">{member_id}</text>
<text x="46" y="172" class="d-small">chosen: PRIMARY KEY</text>
<rect x="32" y="200" width="296" height="68" rx="6" class="d-box"/>
<text x="46" y="227" class="d-mono d-bold">{email}</text>
<text x="46" y="252" class="d-small">alternate key: NOT NULL UNIQUE</text>
</svg>
<figcaption>Figure 1. Every set that contains a candidate key is a superkey, so the outer box is large and uninteresting. The design decisions are in the inner box: find every candidate key, pick one as primary, and declare the rest as well.</figcaption>
</figure>

Declaring the alternate key matters as much as declaring the primary one. Without `UNIQUE` on `email`, rule 1 would live only in the application's sign-up form. With it, the database refuses the row:

```sql run error
INSERT INTO member (name, email)
VALUES ('Adah', 'ada@example.org');
```

```text output
UNIQUE constraint failed: member.email
```

The primary key is guarded the same way, and so is the `NOT NULL` on `name`:

```sql run error
INSERT INTO member
  (member_id, name, email)
VALUES
  (4, 'Dmitri', 'dmitri@example.org');
```

```text output
UNIQUE constraint failed: member.member_id
```

```sql run error
INSERT INTO member (email)
VALUES ('eve@example.org');
```

```text output
NOT NULL constraint failed: member.name
```

Where do surrogate values come from? The engine generates them. In SQLite, a column declared exactly `INTEGER PRIMARY KEY` becomes an alias for the table's internal row number, and [an insert that leaves it out](https://www.sqlite.org/lang_createtable.html#rowid) is given an unused integer. Other engines have their own generators; SQL Server's documentation notes that primary keys are ["frequently defined on an identity column"](https://learn.microsoft.com/en-us/sql/relational-databases/tables/primary-and-foreign-key-constraints#primary-key-constraints).

```sql run
INSERT INTO member (name, email)
VALUES ('Eve', 'eve@example.org')
RETURNING member_id;
```

```text output
member_id
---------
5
```

```sql run
DELETE FROM member
WHERE member_id = 5;
```

:::warning[NULL inside a key]
A key column that can be `NULL` is not doing its job, and engines disagree about what happens there.

- In a `UNIQUE` column, SQLite and PostgreSQL treat every `NULL` as different from every other, so any number of rows may have a `NULL` email. PostgreSQL's manual notes that the SQL standard leaves this implementation-defined, and offers [`NULLS NOT DISTINCT`](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-UNIQUE-CONSTRAINTS) to change it. SQL Server [allows exactly one](https://learn.microsoft.com/en-us/sql/relational-databases/tables/unique-constraints-and-check-constraints#unique-constraints) `NULL` per unique column.
- The SQL standard makes `PRIMARY KEY` imply `NOT NULL`. SQLite's documentation admits that, [because of a bug in early versions](https://www.sqlite.org/lang_createtable.html#the_primary_key), it still accepts `NULL` in a primary key column unless the column is an `INTEGER PRIMARY KEY`, is declared `NOT NULL`, or the table is `STRICT` or `WITHOUT ROWID`.

The habit that works everywhere: write `NOT NULL` on every column of every key, even where the engine would imply it.
:::

A key is a claim about every state the table may ever be in, not a pattern noticed in today's rows. Data can disprove a key; it can never prove one. The next exercise turns on that difference.

::::exercise[Which column sets are keys?]
The front desk roster is kept in a table `desk_shift (day, slot, librarian, desk)`. Two rules apply: a librarian works at most one desk in a slot, and a desk has at most one librarian in a slot. These are all the rows so far:

| day | slot | librarian | desk |
|---|---|---|---|
| Mon | am | Noor | front |
| Mon | am | Omar | back |
| Mon | pm | Noor | back |
| Tue | am | Omar | front |
| Tue | pm | Pia | front |

(a) `{librarian, desk}` has no repeated value in these five rows. Is it a candidate key? (b) Find the candidate keys that the two rules imply. (c) Write the `CREATE TABLE`.

:::solution
(a) No. Nothing in the rules stops Noor from working the front desk again on Wednesday morning; the five rows just happen not to contain a repeat. The sample cannot settle the question, only the rules can.

(b) "A librarian works at most one desk in a slot" says that day, slot and librarian together determine the row, so `{day, slot, librarian}` is a superkey. Dropping any of the three breaks it (Noor appears twice on Monday, for one), so it is a candidate key. The second rule gives `{day, slot, desk}` by the same argument. Two candidate keys that overlap, neither a single column.

(c) Pick either as the primary key and declare the other `UNIQUE`:

```sql run
CREATE TABLE desk_shift (
  day       TEXT NOT NULL,
  slot      TEXT NOT NULL,
  librarian TEXT NOT NULL,
  desk      TEXT NOT NULL,
  PRIMARY KEY (day, slot, librarian),
  UNIQUE (day, slot, desk)
);

INSERT INTO desk_shift
  (day, slot, librarian, desk)
VALUES
  ('Mon', 'am', 'Noor', 'front'),
  ('Mon', 'am', 'Omar', 'back'),
  ('Mon', 'pm', 'Noor', 'back'),
  ('Tue', 'am', 'Omar', 'front'),
  ('Tue', 'pm', 'Pia',  'front');

-- Allowed: repeats (Noor, front).
INSERT INTO desk_shift
  (day, slot, librarian, desk)
VALUES ('Wed', 'am', 'Noor', 'front');
```

A second librarian at the same desk in the same slot breaks the second rule and is refused:

```sql run error
INSERT INTO desk_shift
  (day, slot, librarian, desk)
VALUES ('Wed', 'am', 'Pia', 'front');
```

```text output
UNIQUE constraint failed: desk_shift.day, desk_shift.slot, desk_shift.desk
```

```sql run
DROP TABLE desk_shift;
```
:::
::::

## Foreign keys: references the database checks

Rule 4 separates two things a spreadsheet would blur: a *book* (a title in the catalog) and a *copy* (an object on a shelf with a barcode). One book, many copies. The copy has to say which book it is a copy of, and it does so by storing that book's primary key value:

```sql run
CREATE TABLE book (
  book_id INTEGER PRIMARY KEY,
  title   TEXT NOT NULL
);

CREATE TABLE copy (
  copy_id INTEGER PRIMARY KEY,
  book_id INTEGER NOT NULL
    REFERENCES book (book_id),
  barcode TEXT NOT NULL UNIQUE
);
```

`copy.book_id` is a **foreign key**: a column whose every value must appear as a key value in the table it references. The PostgreSQL manual's name for what this preserves is [referential integrity](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-FK). The referenced table is the **parent**, the referencing table the **child**. `copy` has two candidate keys of its own, the surrogate `copy_id` and the natural `barcode`.

A real catalog would also carry an ISBN as a second candidate key for `book`; it is left out to keep the rows narrow.

This is the whole mechanism behind a **one-to-many** relationship (1:N): the foreign key goes on the "many" side, one value per row, and any number of child rows may hold the same value. Nothing is stored on the "one" side. A book row does not list its copies; you find them by asking which copies carry its id.

### SQLite checks nothing until you ask

In SQLite, foreign key enforcement is [off by default for backwards compatibility](https://www.sqlite.org/foreignkeys.html#fk_enable) and has to be switched on for each connection. With it off, the `REFERENCES` clause is parsed and then ignored:

```sql run
PRAGMA foreign_keys = OFF;

INSERT INTO book (book_id, title)
VALUES (1, 'Dune');

INSERT INTO copy
  (copy_id, book_id, barcode)
VALUES (90, 77, 'C-0090');

PRAGMA foreign_key_check;
```

```text output
table  rowid  parent  fkid
-----  -----  ------  ----
copy   90     book    0
```

There is no book 77, and the insert succeeded anyway. [`PRAGMA foreign_key_check`](https://www.sqlite.org/pragma.html#pragma_foreign_key_check) finds such orphans after the fact: row 90 of `copy` points at a row of `book` that does not exist. Remove it, switch enforcement on, and confirm the setting:

```sql run
DELETE FROM copy WHERE copy_id = 90;

PRAGMA foreign_keys = ON;
PRAGMA foreign_keys;
```

```text output
foreign_keys
------------
1
```

Make that pragma the first statement of every SQLite connection your programs open. It is [ignored inside a transaction](https://www.sqlite.org/pragma.html#pragma_foreign_keys), so it cannot be slipped in halfway through one. PostgreSQL and SQL Server enforce declared foreign keys without being asked.

Now load the catalog. Dune has two copies; Neuromancer is on order and has none yet.

```sql run
INSERT INTO book (book_id, title)
VALUES
  (2, 'Emma'),
  (3, 'Ulysses'),
  (4, 'Hamlet'),
  (5, 'Beloved'),
  (6, 'Neuromancer'),
  (7, 'The Difference Engine');

INSERT INTO copy
  (copy_id, book_id, barcode)
VALUES
  (1, 1, 'C-0001'),
  (2, 1, 'C-0002'),
  (3, 2, 'C-0003'),
  (4, 3, 'C-0004'),
  (5, 4, 'C-0005'),
  (6, 5, 'C-0006'),
  (7, 7, 'C-0007');
```

### The constraint guards both ends

The same orphan insert is now refused:

```sql run error
INSERT INTO copy
  (copy_id, book_id, barcode)
VALUES (90, 77, 'C-0090');
```

```text output
FOREIGN KEY constraint failed
```

A reference can also be broken from the parent's side, by deleting the book that copies point at, or by changing its key. Both are refused too:

```sql run error
DELETE FROM book
WHERE title = 'Dune';
```

```text output
FOREIGN KEY constraint failed
```

```sql run error
UPDATE book
SET book_id = 100
WHERE title = 'Dune';
```

```text output
FOREIGN KEY constraint failed
```

SQLite's message does not say which foreign key failed. When a table has several, that is one reason to keep a failing statement small.

Two details of the declaration are easy to get wrong:

- **The target must be a key.** A foreign key has to reference the parent's primary key or a column set with a `UNIQUE` constraint; [PostgreSQL](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-FK) and [SQLite](https://www.sqlite.org/foreignkeys.html#fk_indexes) both require it. Otherwise "the row this value refers to" could be two rows.
- **`NULL` is exempt.** If the foreign key column is `NULL`, [no parent row is required](https://www.sqlite.org/foreignkeys.html#fk_basics). That is how `member.referred_by` expresses rule 2's word *may*: Ada was referred by nobody, and her `NULL` passes. For `copy.book_id` the `NOT NULL` closes that door, because a copy of no book is meaningless. `NOT NULL` on a foreign key is the difference between "must have one" and "may have one".

`member.referred_by` references `member` itself. Codd's definition of a foreign key allowed for this from the start, noting that the possibility that the two relations "are identical is not excluded". It is checked like any other:

```sql run error
INSERT INTO member
  (name, email, referred_by)
VALUES
  ('Eve', 'eve@example.org', 42);
```

```text output
FOREIGN KEY constraint failed
```

A **one-to-one** relationship needs nothing new: it is a foreign key that is also declared `UNIQUE`, so each parent row can be referenced by at most one child row.

### Choosing what a delete does

Refusing the delete is only the default. An `ON DELETE` clause on the foreign key picks one of five behaviors, which [SQLite](https://www.sqlite.org/foreignkeys.html#fk_actions), [PostgreSQL](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-FK) and, except for `RESTRICT`, [SQL Server](https://learn.microsoft.com/en-us/sql/relational-databases/tables/primary-and-foreign-key-constraints#cascading-referential-integrity) all offer (`ON UPDATE` takes the same list for changes to the parent key):

- `NO ACTION`, the default: nothing is done to the child rows, so the delete fails if any remain.
- `RESTRICT`: the same refusal, but made immediately; it cannot be deferred to the end of a transaction.
- `CASCADE`: the child rows are deleted along with the parent.
- `SET NULL`: the children stay, with their foreign key set to `NULL`.
- `SET DEFAULT`: the children stay, with their foreign key set to the column's default value.

The choice is a statement about meaning. Deleting a book must not silently destroy the record of physical copies the library owns, so `copy.book_id` keeps the default. The next section has a table where `CASCADE` is the right answer.

::::exercise[Four statements, four verdicts]
With the tables as they stand now, decide for each statement whether it succeeds, and if it fails, which constraint stops it. One of them is stopped by rows other than the one it touches.

```text
-- A
INSERT INTO copy
  (book_id, barcode)
VALUES (2, 'C-0002');

-- B
INSERT INTO member
  (name, email, referred_by)
VALUES
  ('Eli', 'eli@example.org',
   NULL);

-- C
DELETE FROM member
WHERE name = 'Ada';

-- D
UPDATE copy SET book_id = NULL
WHERE copy_id = 3;
```

:::solution
**A fails.** Book 2 exists, so the foreign key is satisfied, but barcode `C-0002` already belongs to the second copy of Dune.

```sql run error
INSERT INTO copy
  (book_id, barcode)
VALUES (2, 'C-0002');
```

```text output
UNIQUE constraint failed: copy.barcode
```

**B succeeds.** A `NULL` foreign key needs no parent. (The second statement removes Eli again so that later results on this page are unchanged.)

```sql run
INSERT INTO member
  (name, email, referred_by)
VALUES
  ('Eli', 'eli@example.org',
   NULL);

DELETE FROM member
WHERE name = 'Eli';
```

**C fails,** and not because of loans, which do not exist yet. Boris and Chen both have `referred_by = 1`. The table is its own child, and deleting Ada would orphan two rows of the table she is being deleted from.

```sql run error
DELETE FROM member
WHERE name = 'Ada';
```

```text output
FOREIGN KEY constraint failed
```

**D fails,** but the foreign key is not what stops it: `NULL` would pass that check. `NOT NULL` is what makes the relationship mandatory.

```sql run error
UPDATE copy SET book_id = NULL
WHERE copy_id = 3;
```

```text output
NOT NULL constraint failed: copy.book_id
```
:::
::::

## Many-to-many needs a third table

Rule 3 runs in both directions: a book can have several authors and an author several books. That is a **many-to-many** relationship (M:N), and a foreign key cannot express it directly, because a foreign key column holds one value per row. Put `author_id` in `book` and a book has one author; put `book_id` in `author` and an author has one book.

Two workarounds suggest themselves, and both fail. A text column holding `'William Gibson, Bruce Sterling'` hides two values inside one, so the database can neither check them against anything nor find all of Sterling's books without string matching; the textbook model asks for attribute values to be **atomic**, indivisible, for this reason. Columns `author1_id` and `author2_id` fail on the first book with three authors, and make "all books by author 6" a query over every numbered column.

The relational answer is that the relationship is itself a relation. Each fact of the form "this author wrote this book" is a tuple, so give those tuples a table:

```sql run
CREATE TABLE author (
  author_id INTEGER PRIMARY KEY,
  name      TEXT NOT NULL
);

CREATE TABLE book_author (
  book_id   INTEGER NOT NULL
    REFERENCES book (book_id)
    ON DELETE CASCADE,
  author_id INTEGER NOT NULL
    REFERENCES author (author_id),
  PRIMARY KEY (book_id, author_id)
);

INSERT INTO author (author_id, name)
VALUES
  (1, 'Frank Herbert'),
  (2, 'Jane Austen'),
  (3, 'James Joyce'),
  (4, 'William Shakespeare'),
  (5, 'Toni Morrison'),
  (6, 'William Gibson'),
  (7, 'Bruce Sterling');

INSERT INTO book_author
  (book_id, author_id)
VALUES
  (1, 1), (2, 2), (3, 3), (4, 4),
  (5, 5), (6, 6), (7, 6), (7, 7);
```

`book_author` is a **junction table** (also called an association or link table). It has two foreign keys and turns one M:N relationship into two 1:N relationships that meet in the middle.

<figure class="diagram">
<svg viewBox="0 0 360 280" role="img" aria-labelledby="rj-title rj-desc">
<title id="rj-title">Rows of the book_author junction table linking authors to books</title>
<desc id="rj-desc">Three authors on the left, three books on the right, and four junction rows in the middle. Austen links through one row to Emma. Gibson links through two rows, one to Neuromancer and one to The Difference Engine. Sterling links through one row to The Difference Engine, which therefore has two junction rows.</desc>
<text x="4" y="20" class="d-mono d-bold">author</text>
<text x="118" y="20" class="d-mono d-bold">book_author</text>
<text x="226" y="20" class="d-mono d-bold">book</text>
<path d="M100 60 H128" class="d-accent"/>
<path d="M100 132 L128 108" class="d-accent"/>
<path d="M100 132 L128 156" class="d-accent"/>
<path d="M100 204 H128" class="d-accent"/>
<path d="M198 60 H226" class="d-accent"/>
<path d="M198 108 H226" class="d-accent"/>
<path d="M198 156 L226 180" class="d-accent"/>
<path d="M198 204 L226 180" class="d-accent"/>
<rect x="4" y="42" width="96" height="36" rx="6" class="d-box"/><text x="12" y="65" class="d-small"><tspan class="d-mono">2</tspan> Austen</text>
<rect x="4" y="114" width="96" height="36" rx="6" class="d-box"/><text x="12" y="137" class="d-small"><tspan class="d-mono">6</tspan> Gibson</text>
<rect x="4" y="186" width="96" height="36" rx="6" class="d-box"/><text x="12" y="209" class="d-small"><tspan class="d-mono">7</tspan> Sterling</text>
<rect x="128" y="44" width="70" height="32" rx="6" class="d-box-accent"/><text x="163" y="65" text-anchor="middle" class="d-mono">2, 2</text>
<rect x="128" y="92" width="70" height="32" rx="6" class="d-box-accent"/><text x="163" y="113" text-anchor="middle" class="d-mono">6, 6</text>
<rect x="128" y="140" width="70" height="32" rx="6" class="d-box-accent"/><text x="163" y="161" text-anchor="middle" class="d-mono">7, 6</text>
<rect x="128" y="188" width="70" height="32" rx="6" class="d-box-accent"/><text x="163" y="209" text-anchor="middle" class="d-mono">7, 7</text>
<rect x="226" y="42" width="130" height="36" rx="6" class="d-box"/><text x="234" y="65" class="d-small"><tspan class="d-mono">2</tspan> Emma</text>
<rect x="226" y="90" width="130" height="36" rx="6" class="d-box"/><text x="234" y="113" class="d-small"><tspan class="d-mono">6</tspan> Neuromancer</text>
<rect x="226" y="162" width="130" height="36" rx="6" class="d-box"/><text x="234" y="185" class="d-small"><tspan class="d-mono">7</tspan> Difference Engine</text>
<text x="4" y="250" class="d-muted d-small">each middle row is one (book_id, author_id) pair</text>
<text x="4" y="270" class="d-muted d-small">Gibson starts two rows; book 7 ends two rows</text>
</svg>
<figcaption>Figure 2. Every line is an ordinary one-to-many foreign key. Many-to-many is what you get when two of them share a child table: Gibson reaches two books, and The Difference Engine reaches two authors, without any row holding more than one value per column.</figcaption>
</figure>

The primary key is **composite**: the pair `(book_id, author_id)`. Neither column is unique alone (7 appears twice as a book, 6 twice as an author), but the pair is, and that is exactly the rule you want: recording the same authorship twice should be impossible.

```sql run error
INSERT INTO book_author
  (book_id, author_id)
VALUES (7, 6);
```

```text output
UNIQUE constraint failed: book_author.book_id, book_author.author_id
```

The explicit `NOT NULL` on both columns is the habit from the warning above paying off: this is a composite primary key in an ordinary SQLite table, the case where `NULL` would otherwise be let in.

Reading the relationship back takes one join per foreign key. How joins work, row by row, is the subject of [SQL Joins Explained with Rows, Not Venn Diagrams](/databases/sql-joins/); here it is enough to see that the pairs come back as names:

```sql run
SELECT b.title, a.name AS author
FROM book AS b
JOIN book_author AS ba
  ON ba.book_id = b.book_id
JOIN author AS a
  ON a.author_id = ba.author_id
WHERE b.book_id >= 6
ORDER BY b.title, a.name;
```

```text output
title                  author
---------------------  --------------
Neuromancer            William Gibson
The Difference Engine  Bruce Sterling
The Difference Engine  William Gibson
```

`book_author.book_id` was declared `ON DELETE CASCADE`. An authorship row has no meaning without its book, so deleting a book should take its authorship rows along. A cataloging mistake shows it working:

```sql run
INSERT INTO book (book_id, title)
VALUES (8, 'Dune Messiah');
INSERT INTO book_author
  (book_id, author_id)
VALUES (8, 1);

DELETE FROM book WHERE book_id = 8;

SELECT COUNT(*) AS rows_for_book_8
FROM book_author
WHERE book_id = 8;
```

```text output
rows_for_book_8
---------------
0
```

The cascade stops where another constraint says no. Deleting *Dune* would still fail, because `copy.book_id` has no cascade, and when a statement fails a foreign key check, [all of its effects are reverted](https://www.sqlite.org/foreignkeys.html#fk_deferred), the cascaded part included.

## A loan is a relationship with a history

Rule 5 describes another many-to-many relationship: over time a member borrows many copies, and a copy is borrowed by many members. So `loan` is a junction table between `member` and `copy`. Unlike `book_author`, it has attributes of its own (dates, a fee), and its key needs more thought.

Is `(member_id, copy_id)` a candidate key, as the pair was for `book_author`? Apply the test from the keys section: is there any allowed state in which two rows share the pair? Yes: Ada borrows a copy of Dune in March and the same copy again in June. Adding `loaned_on` does not rescue it, since a copy can be returned and taken out again by the same person on the same day. When no natural candidate key holds up, a surrogate key is the right answer, and other tables (payments, say) get a single column to reference.

```sql run
CREATE TABLE loan (
  loan_id     INTEGER PRIMARY KEY,
  member_id   INTEGER NOT NULL
    REFERENCES member (member_id),
  copy_id     INTEGER NOT NULL
    REFERENCES copy (copy_id),
  loaned_on   TEXT NOT NULL,
  due_on      TEXT NOT NULL,
  returned_on TEXT,
  late_fee    INTEGER NOT NULL
    DEFAULT 0,
  CONSTRAINT fee_min_zero
    CHECK (late_fee >= 0),
  CONSTRAINT due_after_loan
    CHECK (due_on >= loaned_on),
  CONSTRAINT back_after_loan
    CHECK (returned_on >= loaned_on)
);

INSERT INTO loan
  (loan_id, member_id, copy_id,
   loaned_on, due_on, late_fee)
VALUES
  (101, 1, 1,
   '2026-08-03', '2026-08-24', 3),
  (102, 1, 3,
   '2026-08-10', '2026-08-31', 2),
  (103, 2, 4,
   '2026-09-07', '2026-09-28', 0),
  (104, 3, 5,
   '2026-07-27', '2026-08-17', 5);
```

SQLite has [no date type](https://www.sqlite.org/datatype3.html#date_and_time_datatype); dates are stored here as ISO 8601 text (`YYYY-MM-DD`), a format in which alphabetical order and chronological order agree, so `>=` compares them correctly. `returned_on` is `NULL` while the copy is still out.

A **`CHECK` constraint** is a Boolean expression over the columns of one row, evaluated whenever a row is inserted or updated. Rule 7 is the first one. Naming a constraint with `CONSTRAINT` costs a line and buys an error message that says which rule was broken:

```sql run error
UPDATE loan
SET late_fee = -5
WHERE loan_id = 103;
```

```text output
CHECK constraint failed: fee_min_zero
```

```sql run error
INSERT INTO loan
  (member_id, copy_id,
   loaned_on, due_on)
VALUES
  (4, 6,
   '2026-09-18', '2026-09-08');
```

```text output
CHECK constraint failed: due_after_loan
```

The third check compares `returned_on`, which is `NULL` in all four rows, and yet all four were accepted. A `CHECK` rejects a row only when its expression is *false*. `NULL >= '2026-08-03'` is `NULL`, not false, so the row passes. [SQLite](https://www.sqlite.org/lang_createtable.html#check_constraints), [PostgreSQL](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-CHECK-CONSTRAINTS) and [SQL Server](https://learn.microsoft.com/en-us/sql/relational-databases/tables/unique-constraints-and-check-constraints#limitations-of-check-constraints) all document this. Here it is what you want ("if there is a return date, it is not before the loan date"). On a column that must have a value it is a trap: `CHECK (late_fee >= 0)` alone would let a `NULL` fee through, and it is the separate `NOT NULL` that stops it.

::::exercise[Reject dates that are not dates]
`loaned_on` is `TEXT NOT NULL`, so the column itself accepts any text at all: `'soon'`, `'5 Sept'`. (`due_after_loan` happens to reject some of it, but only because it compares the two values as text.) Write a `CHECK` that accepts only valid `YYYY-MM-DD` dates. SQLite's [`date(x)` function](https://www.sqlite.org/lang_datefunc.html) returns a date as text in that format. Find out with `SELECT` what it returns for text that is not a date, and for `'2026-02-30'`, before you trust your expression.

:::solution
Compare the value with its own normalization. A valid date in the right format survives `date()` unchanged; anything else comes back different or `NULL`. Use `IS` and not `=`, so that a `NULL` result counts as "not the same" instead of slipping through as unknown:

```sql run
SELECT x, date(x) AS normalized,
       x IS date(x) AS ok
FROM (
  SELECT '2026-09-18' AS x
  UNION ALL SELECT 'soon'
  UNION ALL SELECT '18/09/2026'
  UNION ALL SELECT '2026-02-30'
);
```

```text output
x           normalized  ok
----------  ----------  --
2026-09-18  2026-09-18  1
soon        NULL        0
18/09/2026  NULL        0
2026-02-30  2026-03-02  0
```

In SQLite 3.50, text that does not parse gives `NULL`, and February 30 rolls over to March 2, so a bare `date(x) IS NOT NULL` test would have accepted it. The documentation spells out neither behavior, which is the reason to test. SQLite's `ALTER TABLE` [cannot add a constraint](https://www.sqlite.org/lang_altertable.html) to an existing table, so try the expression on a scratch table:

```sql run error
CREATE TABLE loan_date_test (
  loaned_on TEXT NOT NULL,
  CONSTRAINT loaned_on_is_date
    CHECK (
      loaned_on IS date(loaned_on)
    )
);

INSERT INTO loan_date_test
VALUES ('2026-09-18');
INSERT INTO loan_date_test
VALUES ('soon');
```

```text output
CHECK constraint failed: loaned_on_is_date
```

The first insert succeeded and the second was refused. In an engine with a real `DATE` type, the column type does this job and no `CHECK` is needed.
:::
::::

### One open loan per copy

Rule 6 is the hardest of the seven: a copy can be out with only one member at a time. `UNIQUE (copy_id)` is too strong, because it would allow each copy to be borrowed once, ever. The rule is about a subset of the rows: among loans *not yet returned*, `copy_id` is unique. A **partial unique index** says precisely that. It is an [index](/glossary/#index-database) that covers only the rows matching a `WHERE` clause, and SQLite's documentation describes this use: a unique partial index enforces ["uniqueness across some subset of the rows"](https://www.sqlite.org/partialindex.html#unique_partial_indexes). PostgreSQL's manual has [the same technique](https://www.postgresql.org/docs/current/indexes-partial.html) with the same syntax. SQL Server calls it a [filtered index](https://learn.microsoft.com/en-us/sql/relational-databases/indexes/create-filtered-indexes), which may also be `UNIQUE`.

```sql run
CREATE UNIQUE INDEX
  one_open_loan_per_copy
ON loan (copy_id)
WHERE returned_on IS NULL;
```

Ada still has copy 1. Boris cannot be handed the same physical object:

```sql run error
INSERT INTO loan
  (member_id, copy_id,
   loaned_on, due_on)
VALUES
  (2, 1,
   '2026-09-18', '2026-10-09');
```

```text output
UNIQUE constraint failed: loan.copy_id
```

Once Ada's loan has a return date, its row leaves the index, and the same insert goes through:

```sql run
UPDATE loan
SET returned_on = '2026-09-18'
WHERE loan_id = 101;

INSERT INTO loan
  (loan_id, member_id, copy_id,
   loaned_on, due_on)
VALUES
  (105, 2, 1,
   '2026-09-18', '2026-10-09');

SELECT l.loan_id, m.name, b.title,
       l.returned_on AS returned
FROM loan AS l
JOIN member AS m
  ON m.member_id = l.member_id
JOIN copy AS c
  ON c.copy_id = l.copy_id
JOIN book AS b
  ON b.book_id = c.book_id
ORDER BY l.loan_id;
```

```text output
loan_id  name   title    returned
-------  -----  -------  ----------
101      Ada    Dune     2026-09-18
102      Ada    Emma     NULL
103      Boris  Ulysses  NULL
104      Chen   Hamlet   NULL
105      Boris  Dune     NULL
```

Copy 1 appears twice in `loan`, which the index allows because only one of the two rows is open. The title came through two foreign keys, `loan -> copy -> book`; no table other than `book` stores it.

### The slip with no name on it

A paper loan slip turns up for the library's copy of *Beloved*. The name is illegible. Someone tries to enter it anyway:

```sql run error
INSERT INTO loan
  (member_id, copy_id,
   loaned_on, due_on)
VALUES
  (NULL, 6,
   '2026-09-11', '2026-10-02');
```

```text output
NOT NULL constraint failed: loan.member_id
```

The schema says a loan has a member, so the database refuses, and the problem lands on a person's desk today instead of surfacing in a report next quarter. The alternative design, a nullable `member_id`, accepts the row and pushes the cost onto every query that touches loans from then on. The joins article uses a cut-down two-table version of this schema that makes that choice on purpose (its `loan` carries the title directly and allows a `NULL` member), and several of its pitfalls, such as the `NOT IN` query that returns nothing, trace back to that one unknown borrower.

## The whole schema on one page

<figure class="diagram">
<svg viewBox="0 0 360 560" role="img" aria-labelledby="re-title re-desc">
<title id="re-title">Entity-relationship diagram of the library schema</title>
<desc id="re-desc">Six tables drawn as boxes listing their columns. On the left, from top to bottom: author, book_author, book and copy. One author has many book_author rows; one book has many book_author rows; one book has many copies. On the right: member at the top, with a loop from referred_by back to member_id, and loan at the bottom. One member has many loans and one copy has many loans. A legend explains that a bar means one and a three-pronged crow's foot means many.</desc>
<rect x="8" y="8" width="150" height="24" class="d-box-2"/><text x="16" y="25" class="d-mono d-bold">author</text>
<rect x="8" y="32" width="150" height="44" class="d-box"/>
<text x="16" y="50" class="d-mono d-small">author_id</text><text x="150" y="50" text-anchor="end" class="d-mono d-small d-text-accent d-bold">PK</text>
<text x="16" y="68" class="d-mono d-small">name</text>
<path d="M83 76 V124 M77 84 H89 M83 112 L75 124 M83 112 L91 124" class="d-line"/>
<rect x="8" y="124" width="150" height="24" class="d-box-2"/><text x="16" y="141" class="d-mono d-bold">book_author</text>
<rect x="8" y="148" width="150" height="44" class="d-box"/>
<text x="16" y="166" class="d-mono d-small">book_id</text><text x="150" y="166" text-anchor="end" class="d-mono d-small d-text-accent d-bold">PK FK</text>
<text x="16" y="184" class="d-mono d-small">author_id</text><text x="150" y="184" text-anchor="end" class="d-mono d-small d-text-accent d-bold">PK FK</text>
<path d="M83 192 V240 M77 232 H89 M83 204 L75 192 M83 204 L91 192" class="d-line"/>
<rect x="8" y="240" width="150" height="24" class="d-box-2"/><text x="16" y="257" class="d-mono d-bold">book</text>
<rect x="8" y="264" width="150" height="44" class="d-box"/>
<text x="16" y="282" class="d-mono d-small">book_id</text><text x="150" y="282" text-anchor="end" class="d-mono d-small d-text-accent d-bold">PK</text>
<text x="16" y="300" class="d-mono d-small">title</text>
<path d="M83 308 V356 M77 316 H89 M83 344 L75 356 M83 344 L91 356" class="d-line"/>
<rect x="8" y="356" width="150" height="24" class="d-box-2"/><text x="16" y="373" class="d-mono d-bold">copy</text>
<rect x="8" y="380" width="150" height="62" class="d-box"/>
<text x="16" y="398" class="d-mono d-small">copy_id</text><text x="150" y="398" text-anchor="end" class="d-mono d-small d-text-accent d-bold">PK</text>
<text x="16" y="416" class="d-mono d-small">book_id</text><text x="150" y="416" text-anchor="end" class="d-mono d-small d-text-accent d-bold">FK</text>
<text x="16" y="434" class="d-mono d-small">barcode</text><text x="150" y="434" text-anchor="end" class="d-mono d-small d-text-accent d-bold">AK</text>
<path d="M158 410 H196 M166 404 V416 M184 410 L196 402 M184 410 L196 418" class="d-line"/>
<rect x="196" y="8" width="142" height="24" class="d-box-2"/><text x="204" y="25" class="d-mono d-bold">member</text>
<rect x="196" y="32" width="142" height="80" class="d-box"/>
<text x="204" y="50" class="d-mono d-small">member_id</text><text x="330" y="50" text-anchor="end" class="d-mono d-small d-text-accent d-bold">PK</text>
<text x="204" y="68" class="d-mono d-small">name</text>
<text x="204" y="86" class="d-mono d-small">email</text><text x="330" y="86" text-anchor="end" class="d-mono d-small d-text-accent d-bold">AK</text>
<text x="204" y="104" class="d-mono d-small">referred_by</text><text x="330" y="104" text-anchor="end" class="d-mono d-small d-text-accent d-bold">FK</text>
<path d="M338 46 H354 V100 H338 M345 40 V52 M348 100 L338 94 M348 100 L338 106" class="d-line"/>
<path d="M320 112 V300 M314 120 H326 M320 288 L312 300 M320 288 L328 300" class="d-line"/>
<path d="M204 146 H236 M212 140 V152" class="d-line"/><text x="246" y="150" class="d-small">one</text>
<path d="M204 172 H236 M224 172 L236 164 M224 172 L236 180" class="d-line"/><text x="246" y="176" class="d-small">many</text>
<text x="204" y="204" class="d-small"><tspan class="d-mono d-text-accent d-bold">PK</tspan> primary key</text>
<text x="204" y="224" class="d-small"><tspan class="d-mono d-text-accent d-bold">AK</tspan> alternate key</text>
<text x="204" y="244" class="d-small"><tspan class="d-mono d-text-accent d-bold">FK</tspan> foreign key</text>
<rect x="196" y="300" width="142" height="24" class="d-box-2"/><text x="204" y="317" class="d-mono d-bold">loan</text>
<rect x="196" y="324" width="142" height="134" class="d-box"/>
<text x="204" y="342" class="d-mono d-small">loan_id</text><text x="330" y="342" text-anchor="end" class="d-mono d-small d-text-accent d-bold">PK</text>
<text x="204" y="360" class="d-mono d-small">member_id</text><text x="330" y="360" text-anchor="end" class="d-mono d-small d-text-accent d-bold">FK</text>
<text x="204" y="378" class="d-mono d-small">copy_id</text><text x="330" y="378" text-anchor="end" class="d-mono d-small d-text-accent d-bold">FK</text>
<text x="204" y="396" class="d-mono d-small">loaned_on</text>
<text x="204" y="414" class="d-mono d-small">due_on</text>
<text x="204" y="432" class="d-mono d-small">returned_on</text>
<text x="204" y="450" class="d-mono d-small">late_fee</text>
<text x="8" y="488" class="d-muted d-small">Every line is a foreign key, drawn from the key it</text>
<text x="8" y="506" class="d-muted d-small">references (bar) to the column that stores it (fork).</text>
<text x="8" y="530" class="d-muted d-small">book_author and loan each sit at the fork end of two</text>
<text x="8" y="548" class="d-muted d-small">lines: that is what a junction table looks like.</text>
</svg>
<figcaption>Figure 3. The finished schema in crow's foot notation, where a bar marks the "one" end of a relationship and a fork the "many" end. Follow loan to copy to book to reach a title, and notice that no table lists its children: every relationship is stored once, at the fork.</figcaption>
</figure>

A diagram like this is an **entity-relationship (ER) diagram**. It is a useful summary and a poor specification: it shows the foreign keys, but not the `CHECK` constraints, the `NOT NULL`s, or the partial index that carries rule 6. The `CREATE TABLE` statements are the specification.

Here are the seven rules next to what enforces each:

1. Unique email: `NOT NULL UNIQUE` on `member.email`.
2. Optional referrer: a nullable foreign key from `member` to itself.
3. Books and authors, many-to-many: the junction table `book_author` with a composite primary key.
4. Copies of a book: a `NOT NULL` foreign key in `copy`, and a unique `barcode`.
5. A loan has a member and a copy: two `NOT NULL` foreign keys in `loan`.
6. One open loan per copy: a partial unique index.
7. Fees never negative: a `CHECK`, backed by `NOT NULL`.

## What declarations cannot say

Suppose the librarian adds rule 8: a member may have at most three open loans. It looks like rule 6, but it is a count across rows, and no uniqueness trick captures "at most three". A `CHECK` cannot do it either. SQLite [forbids subqueries in `CHECK` expressions](https://www.sqlite.org/lang_createtable.html#check_constraints), and PostgreSQL's manual warns that it [does not support `CHECK` constraints that look at anything but the row being checked](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-CHECK-CONSTRAINTS), recommending `UNIQUE`, `EXCLUDE` or `FOREIGN KEY` constraints for cross-row rules where they fit and a trigger where they do not. Rules of this kind end up in a trigger or in application code that counts and inserts inside one [transaction](/glossary/#transaction), and they are only as reliable as that code.

That is the argument for pushing every rule you *can* declare into the schema. An [invariant](/glossary/#invariant) enforced in application code holds for that application, in the versions that remembered to check. A declared constraint holds for every program, every ad-hoc `UPDATE` typed into a console, and every import script written in a hurry, because the check sits in the one place all of them must pass through.

Constraints have costs worth knowing:

- **Writes do more work.** SQLite, like SQL Server, [implements most unique constraints as a unique index](https://www.sqlite.org/lang_createtable.html#uniqueconst) that every insert must update, and [deleting a parent row makes the engine search the child table](https://www.sqlite.org/foreignkeys.html#fk_indexes) for references. Neither SQLite, PostgreSQL nor SQL Server creates an index on the child's foreign key column for you, and all three manuals suggest adding one; `loan.member_id` would be the first candidate here.
- **Load order matters.** Parents must exist before children, which is why this page created `book` before `copy`.
- **Existing data can block a new rule.** Adding a constraint to a table whose rows already violate it fails (SQL Server's documentation [says so for `UNIQUE`](https://learn.microsoft.com/en-us/sql/relational-databases/tables/unique-constraints-and-check-constraints#unique-constraints)), which is a good reason to declare constraints on day one.

::::exercise[Design the reservation table]
Rule 9: a member can reserve a *book* (any copy will do) that is currently out. A member may hold at most one reservation per book, and a reservation records the date it was made. Write the `CREATE TABLE`, then answer: what is the relationship between `member` and `book` now, and what are the candidate keys of your table?

:::solution
Members reserve many books and a book is reserved by many members: another many-to-many relationship, so another junction table. "At most one reservation per member per book" makes the pair a candidate key, the situation of `book_author`, not of `loan`:

```sql run
CREATE TABLE reservation (
  member_id   INTEGER NOT NULL
    REFERENCES member (member_id),
  book_id     INTEGER NOT NULL
    REFERENCES book (book_id),
  reserved_on TEXT NOT NULL,
  PRIMARY KEY (member_id, book_id)
);

INSERT INTO reservation
  (member_id, book_id, reserved_on)
VALUES (4, 1, '2026-09-18');
```

Dalia reserving Dune a second time is refused by the composite key:

```sql run error
INSERT INTO reservation
  (member_id, book_id, reserved_on)
VALUES (4, 1, '2026-09-19');
```

```text output
UNIQUE constraint failed: reservation.member_id, reservation.book_id
```

`(member_id, book_id)` is the only candidate key. If the library later wants to keep fulfilled reservations as history, the pair stops being unique over time, exactly as it did for loans, and the fix is the same: a surrogate key plus a partial unique index over the reservations still waiting.
:::
::::
