---
title: "Normalization: 1NF to BCNF on One Messy Table"
description: "Decompose one denormalized order table through 1NF, 2NF, 3NF and BCNF, proving each update, insertion and deletion anomaly with real SQL before fixing it."
pillar: databases
order: 4
author: markus
published: 2026-09-22
updated: 2026-09-22
level: intermediate
tags: [sql, sqlite, normalization, functional-dependencies, database-design]
prerequisites: ["databases/relational-model-and-keys", "databases/sql-joins"]
sources:
  - title: "Database System Concepts, 7th ed., Chapter 7: Relational Database Design (authors' slides)"
    url: "https://www.db-book.com/slides-dir/PDF-dir/ch7.pdf"
    publisher: "Silberschatz, Korth and Sudarshan"
    accessed: 2026-09-22
  - title: "Database Management Systems, 3rd ed., Chapter 19: Schema Refinement and Normal Forms (authors' slides)"
    url: "https://pages.cs.wisc.edu/~dbbook/openAccess/thirdEdition/slides/slides3ed-english/Ch19_FDs-95.pdf"
    publisher: "Ramakrishnan and Gehrke"
    accessed: 2026-09-22
  - title: "SQLite: CREATE TABLE (composite PRIMARY KEY, NOT NULL)"
    url: "https://www.sqlite.org/lang_createtable.html"
    publisher: "SQLite"
    accessed: 2026-09-22
  - title: "SQLite: ALTER TABLE (DROP COLUMN restrictions)"
    url: "https://www.sqlite.org/lang_altertable.html"
    publisher: "SQLite"
    accessed: 2026-09-22
  - title: "SQLite: STRICT Tables"
    url: "https://www.sqlite.org/stricttables.html"
    publisher: "SQLite"
    accessed: 2026-09-22
  - title: "SQLite: Datatypes (storage classes and type affinity)"
    url: "https://www.sqlite.org/datatype3.html"
    publisher: "SQLite"
    accessed: 2026-09-22
draft: false
---

A small mail-order bookstore that sells to schools and offices keeps its orders in a spreadsheet: one row per order, a column for the customer, and a column listing which books went out.

```sql run
CREATE TABLE order_spreadsheet (
  order_id      INTEGER PRIMARY KEY,
  order_date    TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  items         TEXT NOT NULL
);

INSERT INTO order_spreadsheet
  (order_id, order_date, customer_name, items)
VALUES
  (1, '2026-09-02', 'Priya Iyer',  '1:3,3:2'),
  (2, '2026-09-05', 'Marcus Webb', '11:1'),
  (3, '2026-09-08', 'Yuki Tanaka', '4:5');

SELECT order_id, customer_name, items
FROM order_spreadsheet
ORDER BY order_id;
```

```text output
order_id  customer_name  items
--------  -------------  -------
1         Priya Iyer     1:3,3:2
2         Marcus Webb    11:1
3         Yuki Tanaka    4:5
```

`items` packs a whole order into one string: `1:3,3:2` means "3 of product 1, 2 of product 3". Every question about products needs to parse that string back apart. "Which orders contain product 1?" looks like a `LIKE` search:

```sql run
SELECT order_id, items
FROM order_spreadsheet
WHERE items LIKE '%1:%';
```

```text output
order_id  items
--------  -------
1         1:3,3:2
2         11:1
```

Order 2 is wrong. It contains product 11, not product 1, but `11:1` contains the substring `1:` starting at its second character, so the pattern matches it anyway. There is no query that reliably answers "which orders contain product 1" against this column, because the database has no idea that `items` holds a list of (product, quantity) pairs rather than one indivisible value. A **domain is atomic** when its values are not decomposed by the schema itself, and Codd's original description of the relational model required exactly this; the vocabulary and the rest of this pillar's schema are set up in [The Relational Model: Tables, Keys and Relationships](/databases/relational-model-and-keys/). The fix here is the one this whole article is about: stop hiding a list inside a column, and give every fact its own row.

```sql run
DROP TABLE order_spreadsheet;
```

## One row per line item, and every fact still on it

Splitting `items` apart means one row per (order, product) pair. Doing that honestly also means writing down everything the spreadsheet implied about the order, the customer, and the product on *every* one of those rows, because nothing yet says those facts belong anywhere else:

```sql run
CREATE TABLE order_flat (
  order_id         INTEGER NOT NULL,
  order_date       TEXT    NOT NULL,
  customer_id      INTEGER NOT NULL,
  customer_name    TEXT    NOT NULL,
  customer_email   TEXT    NOT NULL,
  customer_zip     TEXT    NOT NULL,
  customer_city    TEXT    NOT NULL,
  product_id       INTEGER NOT NULL,
  product_name     TEXT    NOT NULL,
  product_category TEXT    NOT NULL,
  unit_price       INTEGER NOT NULL,
  quantity         INTEGER NOT NULL,
  salesperson_id   INTEGER NOT NULL,
  PRIMARY KEY (order_id, product_id)
) STRICT;
```

The SQL on this page runs on SQLite 3.37 or later ([`STRICT` needs it](https://www.sqlite.org/stricttables.html)); the results shown come from SQLite 3.50, with every statement run in order in one session. `customer_zip` is `TEXT`, not `INTEGER`: Boston's `02138` has a real leading zero, and an `INTEGER` column would [store it as the number 2138](https://www.sqlite.org/datatype3.html#storage_classes_and_datatypes) and lose it.

Seven line items across five orders are enough to show every problem this page discusses:

```sql run
INSERT INTO order_flat (
  order_id, order_date, customer_id,
  customer_name, customer_email,
  customer_zip, customer_city,
  product_id, product_name,
  product_category, unit_price,
  quantity, salesperson_id
)
VALUES
  (1001, '2026-09-02', 1,
   'Priya Iyer', 'priya@example.org',
   '60614', 'Chicago',
   101, 'Dune', 'Fiction', 12, 3, 1),
  (1001, '2026-09-02', 1,
   'Priya Iyer', 'priya@example.org',
   '60614', 'Chicago',
   103, 'Clean Code', 'Programming', 32, 2, 2),
  (1002, '2026-09-05', 2,
   'Marcus Webb', 'marcus@example.org',
   '10001', 'New York',
   102, 'Beloved', 'Fiction', 11, 1, 1),
  (1003, '2026-09-08', 3,
   'Yuki Tanaka', 'yuki@example.org',
   '60614', 'Chicago',
   104, 'Refactoring', 'Programming', 35, 5, 2),
  (1003, '2026-09-08', 3,
   'Yuki Tanaka', 'yuki@example.org',
   '60614', 'Chicago',
   105, 'Elements of Style', 'Reference', 9, 2, 3),
  (1004, '2026-09-12', 1,
   'Priya Iyer', 'priya@example.org',
   '60614', 'Chicago',
   102, 'Beloved', 'Fiction', 11, 1, 1),
  (1005, '2026-09-15', 4,
   'Sofia Castro', 'sofia@example.org',
   '02138', 'Boston',
   105, 'Elements of Style', 'Reference', 9, 1, 3);

SELECT order_id, product_id, customer_name
FROM order_flat
ORDER BY order_id, product_id;
```

```text output
order_id  product_id  customer_name
--------  ----------  -------------
1001      101         Priya Iyer
1001      103         Priya Iyer
1002      102         Marcus Webb
1003      104         Yuki Tanaka
1003      105         Yuki Tanaka
1004      102         Priya Iyer
1005      105         Sofia Castro
```

Priya's name is stored three times, Yuki's twice, and every fact about the book *Beloved* is stored twice (once for Marcus's order, once for Priya's). `order_flat` is the one messy table the rest of this page works on: values are atomic, so it clears the bar the spreadsheet failed, but it is one table trying to describe four different kinds of thing — orders, customers, products, and who sold what to whom.

## Three ways the flat table corrupts itself

Nothing declares that the seven `Priya Iyer` cells must agree, so nothing stops them from disagreeing. Fix a typo in her email on a single line item, the way a support agent handling one ticket would:

```sql run
SELECT order_id, customer_email
FROM order_flat
WHERE customer_id = 1
ORDER BY order_id;

UPDATE order_flat
SET customer_email = 'priya.iyer@example.org'
WHERE order_id = 1001 AND product_id = 101;

SELECT order_id, customer_email
FROM order_flat
WHERE customer_id = 1
ORDER BY order_id;
```

```text output
order_id  customer_email
--------  -----------------
1001      priya@example.org
1001      priya@example.org
1004      priya@example.org

order_id  customer_email
--------  ----------------------
1001      priya.iyer@example.org
1001      priya@example.org
1004      priya@example.org
```

The `UPDATE` succeeded, and Priya now has two email addresses in the same table, depending on which line item you ask. This is the classic **update anomaly**: a fact that is stored more than once can be updated in one place and left stale in another, and nothing in the schema notices ([Ramakrishnan and Gehrke](https://pages.cs.wisc.edu/~dbbook/openAccess/thirdEdition/slides/slides3ed-english/Ch19_FDs-95.pdf) name this failure mode directly, over a different running example). Put the correct address back before the rest of the page relies on it:

```sql run
UPDATE order_flat
SET customer_email = 'priya@example.org'
WHERE order_id = 1001 AND product_id = 101;
```

The bookstore also wants to list a new title, *Atomic Habits*, before anyone has ordered a copy — just its name, category and price. There is no row for a product that is not on an order:

```sql run error
INSERT INTO order_flat (
  product_id, product_name,
  product_category, unit_price
)
VALUES (106, 'Atomic Habits', 'Nonfiction', 18);
```

```text output
NOT NULL constraint failed: order_flat.order_id
```

The catalog fact ("this book exists, it costs $18") cannot be stored without also inventing an order, a customer and a quantity to go with it — an **insertion anomaly**: one fact cannot be entered without an unrelated one accompanying it. The only way around it in this schema is to fabricate a fake order, which is worse than refusing the insert.

Sofia's only order is a single copy of *Elements of Style*. Suppose she calls to cancel it:

```sql run
SELECT customer_name, customer_email
FROM order_flat
WHERE customer_id = 4;

DELETE FROM order_flat
WHERE order_id = 1005 AND product_id = 105;

SELECT customer_name, customer_email
FROM order_flat
WHERE customer_id = 4;
```

```text output
customer_name  customer_email
-------------  -----------------
Sofia Castro   sofia@example.org

customer_name  customer_email
-------------  --------------
```

Cancelling the one order she had also erased Sofia herself: her name and email existed nowhere except on that row. A **deletion anomaly** loses a fact (a registered customer) as an unavoidable side effect of removing an unrelated one (an order). Restore her:

```sql run
INSERT INTO order_flat (
  order_id, order_date, customer_id,
  customer_name, customer_email,
  customer_zip, customer_city,
  product_id, product_name,
  product_category, unit_price,
  quantity, salesperson_id
)
VALUES
  (1005, '2026-09-15', 4,
   'Sofia Castro', 'sofia@example.org',
   '02138', 'Boston',
   105, 'Elements of Style', 'Reference', 9, 1, 3);

SELECT COUNT(*) AS n FROM order_flat;
```

```text output
n
-
7
```

All three anomalies come from the same root cause: a fact about a customer, or a product, is stored once per line item that happens to mention it, instead of once. Normalization is the discipline of finding facts that belong together and giving each group exactly one table, so each fact has exactly one place to live.

## What the table is actually promising: functional dependencies

Before deciding which columns belong together, write down the rules `order_flat` is supposed to follow. A **functional dependency** `X -> Y` holds when any two rows that agree on every column in `X` are guaranteed to agree on every column in `Y` too — it is a promise about every row the table will ever hold, not a pattern the current seven rows happen to show ([Silberschatz, Korth and Sudarshan](https://www.db-book.com/slides-dir/PDF-dir/ch7.pdf) state this as the formal definition of a functional dependency). The business rules behind `order_flat` are:

- `order_id -> order_date, customer_id` — an order has one date and one customer.
- `customer_id -> customer_name, customer_email, customer_zip` — a customer has one name, one email, one zip.
- `customer_zip -> customer_city` — a zip code has one city.
- `product_id -> product_name, product_category, unit_price` — a catalog entry has one name, category and price.
- `order_id, product_id -> quantity` — one line item, one quantity.
- `customer_id, product_category -> salesperson_id` — the bookstore gives each customer a single dedicated rep *per category*: whoever handles Priya's fiction orders always handles her fiction orders.
- `salesperson_id -> product_category` — the reverse also holds: each rep specializes in exactly one category, so knowing the rep tells you the category.

`{order_id, product_id}` is a [candidate key](/databases/relational-model-and-keys/#keys-which-columns-identify-a-row) of `order_flat`: every other column is reachable from it by following the list above (customer facts through `order_id`, product facts through `product_id`, the rep through both), and neither `order_id` alone nor `product_id` alone reaches everything — an order can list several products, and a product appears on several orders. SQLite enforces that this pair really is unique, because it is the table's `PRIMARY KEY`:

```sql run error
INSERT INTO order_flat (
  order_id, order_date, customer_id,
  customer_name, customer_email,
  customer_zip, customer_city,
  product_id, product_name,
  product_category, unit_price,
  quantity, salesperson_id
)
VALUES
  (1001, '2026-09-02', 1,
   'Priya Iyer', 'priya@example.org',
   '60614', 'Chicago',
   101, 'Dune', 'Fiction', 12, 1, 1);
```

```text output
UNIQUE constraint failed: order_flat.order_id, order_flat.product_id
```

Every normal form below is a rule about which of these seven dependencies a table is allowed to have, given its key.

## First normal form: already satisfied

**First normal form (1NF)** requires every column to hold an atomic value — no list, no delimited string, nothing a query would need to parse apart ([Silberschatz, Korth and Sudarshan](https://www.db-book.com/slides-dir/PDF-dir/ch7.pdf) define it exactly this way, immediately after `order_spreadsheet`'s `items` column is exactly the kind of non-atomic value the definition rules out). `order_flat` already qualifies: every column holds one number, one string, or one date, so this page's real work starts at second normal form.

## Second normal form: nothing may depend on half the key

`{order_id, product_id}` is a **composite key** — two columns, together. A **partial dependency** is a non-key column that depends on only *part* of a composite key, and **second normal form (2NF)** forbids it: every non-key column must depend on the whole key, not a piece of it.

Six columns fail this test. `order_date` and `customer_id` (and, by riding along with `customer_id`, `customer_name`, `customer_email`, `customer_zip` and `customer_city`) depend on `order_id` alone — two line items on the same order always show the same date and customer, whichever product they name. Symmetrically, `product_name`, `product_category` and `unit_price` depend on `product_id` alone. Only `quantity` and `salesperson_id` genuinely need both halves of the key: `salesperson_id` needs `customer_id` (through `order_id`) *and* `product_category` (through `product_id`) to be determined at all, since the same customer can have a different rep for a different category.

The fix groups columns by what they depend on:

```sql run
CREATE TABLE orders (
  order_id    INTEGER PRIMARY KEY,
  order_date  TEXT NOT NULL,
  customer_id INTEGER NOT NULL,
  customer_name  TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_zip   TEXT NOT NULL,
  customer_city  TEXT NOT NULL
);
INSERT INTO orders
SELECT DISTINCT order_id, order_date, customer_id,
       customer_name, customer_email, customer_zip, customer_city
FROM order_flat;

CREATE TABLE products (
  product_id       INTEGER PRIMARY KEY,
  product_name     TEXT NOT NULL,
  product_category TEXT NOT NULL,
  unit_price       INTEGER NOT NULL
);
INSERT INTO products
SELECT DISTINCT product_id, product_name, product_category, unit_price
FROM order_flat;

CREATE TABLE order_line (
  order_id       INTEGER NOT NULL,
  product_id     INTEGER NOT NULL,
  quantity       INTEGER NOT NULL,
  salesperson_id INTEGER NOT NULL,
  PRIMARY KEY (order_id, product_id)
);
INSERT INTO order_line (order_id, product_id, quantity, salesperson_id)
SELECT order_id, product_id, quantity, salesperson_id
FROM order_flat;

SELECT order_id, customer_id, customer_zip
FROM orders
ORDER BY order_id;
```

```text output
order_id  customer_id  customer_zip
--------  -----------  ------------
1001      1            60614
1002      2            10001
1003      3            60614
1004      1            60614
1005      4            02138
```

Priya (`customer_id` 1) still shows `60614` on two separate order rows — that redundancy is exactly what third normal form removes next — but `product_name`, `product_category` and Priya's home address no longer repeat once per line item; each lives in exactly one row of `products` or `orders`. The update anomaly from the previous section cannot recur here: Priya's email is a column of `orders`, appearing once per order rather than once per line item, and it will disappear from `orders` entirely in the next section, down to one row total.

::::exercise[A column that snuck back in]
A colleague reviewing the `order_line` table above suggests adding `product_name`, "since the shipping label needs it and joining to `products` feels like extra work." Is a table `order_line (order_id, product_id, product_name, quantity, salesperson_id)` still in second normal form? If not, name the dependency that breaks it, and show a real `INSERT`/`UPDATE` pair that would let two rows disagree about the same product's name.

:::solution
No. `product_name` depends on `product_id` alone, a proper subset of the composite key `{order_id, product_id}` — the same partial dependency that `product_name` had directly on `order_flat`. Nothing would stop it from drifting:

```sql run
CREATE TABLE order_line_bad (
  order_id       INTEGER NOT NULL,
  product_id     INTEGER NOT NULL,
  product_name   TEXT NOT NULL,
  quantity       INTEGER NOT NULL,
  PRIMARY KEY (order_id, product_id)
);
INSERT INTO order_line_bad VALUES
  (2001, 101, 'Dune', 1),
  (2002, 101, 'Dune', 2);

UPDATE order_line_bad
SET product_name = 'Dune (2025 reprint)'
WHERE order_id = 2001 AND product_id = 101;

SELECT order_id, product_name
FROM order_line_bad
ORDER BY order_id;
```

```text output
order_id  product_name
--------  -------------------
2001      Dune (2025 reprint)
2002      Dune
```

Product 101 now has two names depending on which order you look at. Putting `product_name` only in `products`, keyed by `product_id` alone, makes this impossible: there is exactly one row to update, so there is nothing left to disagree with.

```sql run
DROP TABLE order_line_bad;
```
:::
::::

## Third normal form: nothing may depend on a non-key fact

`orders` passed the 2NF test — every column depends on the *whole* key, `order_id` — but it still repeats. **Third normal form (3NF)** catches what 2NF misses: a **transitive dependency**, where a non-key column depends on *another non-key column* rather than on the key directly. `customer_id -> customer_name, customer_email, customer_zip` holds regardless of which order carries it, so those three columns are really facts about the customer, reached through `order_id` only because `order_id` happens to determine `customer_id` first. `customer_zip -> customer_city` chains a second transitive dependency onto the first.

```sql run
CREATE TABLE zip_codes (
  zip  TEXT PRIMARY KEY,
  city TEXT NOT NULL
);
INSERT INTO zip_codes
SELECT DISTINCT customer_zip, customer_city FROM orders;

CREATE TABLE customers (
  customer_id    INTEGER PRIMARY KEY,
  customer_name  TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_zip   TEXT NOT NULL
);
INSERT INTO customers
SELECT DISTINCT customer_id, customer_name, customer_email, customer_zip
FROM orders;

CREATE TABLE orders_3nf (
  order_id    INTEGER PRIMARY KEY,
  order_date  TEXT NOT NULL,
  customer_id INTEGER NOT NULL
);
INSERT INTO orders_3nf
SELECT order_id, order_date, customer_id FROM orders;

DROP TABLE orders;
ALTER TABLE orders_3nf RENAME TO orders;

SELECT * FROM zip_codes ORDER BY zip;
```

```text output
zip    city
-----  --------
02138  Boston
10001  New York
60614  Chicago
```

Chicago is one row now, no matter how many customers or orders reference `60614` — Yuki and Priya share a zip but are different customers, which is exactly why `zip_codes` had to be keyed on the zip itself, not folded into `customers`. `customers` and the slimmed `orders` complete the split:

```sql run
SELECT customer_id, customer_name, customer_zip
FROM customers
ORDER BY customer_id;
```

```text output
customer_id  customer_name  customer_zip
-----------  -------------  ------------
1            Priya Iyer     60614
2            Marcus Webb    10001
3            Yuki Tanaka    60614
4            Sofia Castro   02138
```

```sql run
SELECT * FROM orders ORDER BY order_id;
```

```text output
order_id  order_date  customer_id
--------  ----------  -----------
1001      2026-09-02  1
1002      2026-09-05  2
1003      2026-09-08  3
1004      2026-09-12  1
1005      2026-09-15  4
```

Priya's email now exists in exactly one row of `customers`, no matter how many orders she places. The deletion anomaly from earlier is gone too: cancelling Sofia's only order deletes a row of `order_line`, and `customers` never hears about it, so her name and email survive.

`products` needed nothing further — `product_id` was already its only key, and no other column of `products` determines another, so it was in 3NF (in fact BCNF) as soon as 2NF produced it. Not every table needs every cut.

That leaves `order_line (order_id, product_id, quantity, salesperson_id)`. Checked against its own four columns, nothing looks wrong: no non-key column determines another, so by the letter of the 3NF test above, it already passes.

## The redundancy 3NF didn't catch

`order_line` passing 3NF by its own four columns is where a normalization pass that stops too early goes wrong. `salesperson_id` didn't get there by accident — recall the business rule from the functional-dependency list: `customer_id, product_category -> salesperson_id`. Neither `customer_id` nor `product_category` is a column of `order_line` any more (2NF moved them into `orders`/`customers` and `products`), but the rule they express is still true of the data, and `order_line` still stores its consequence on every line. Join the three tables back together and check it:

```sql run
SELECT o.customer_id, p.product_category,
       COUNT(DISTINCT ol.salesperson_id) AS reps
FROM order_line ol
JOIN orders o ON o.order_id = ol.order_id
JOIN products p ON p.product_id = ol.product_id
GROUP BY o.customer_id, p.product_category
ORDER BY o.customer_id, p.product_category;
```

```text output
customer_id  product_category  reps
-----------  ----------------  ----
1            Fiction           1
1            Programming       1
2            Fiction           1
3            Programming       1
3            Reference         1
4            Reference         1
```

One rep per customer per category, every time — so far. Nothing in `order_line`'s own schema enforces that. Priya has two fiction line items (`Dune` on order 1001, `Beloved` on order 1004); update the second one the way a rushed data-entry fix might:

```sql run
UPDATE order_line
SET salesperson_id = 2
WHERE order_id = 1004 AND product_id = 102;

SELECT o.customer_id, p.product_category,
       COUNT(DISTINCT ol.salesperson_id) AS reps
FROM order_line ol
JOIN orders o ON o.order_id = ol.order_id
JOIN products p ON p.product_id = ol.product_id
GROUP BY o.customer_id, p.product_category
HAVING COUNT(DISTINCT ol.salesperson_id) > 1;
```

```text output
customer_id  product_category  reps
-----------  ----------------  ----
1            Fiction           2
```

Priya's fiction orders now name two different reps, and every constraint declared so far — `PRIMARY KEY (order_id, product_id)`, `NOT NULL` on `salesperson_id` — is satisfied by the corrupted row. 3NF is a real guarantee (no non-key column of a *given* table depends on another non-key column of that *same* table), but it says nothing about a dependency whose determining columns were moved to a different table during an earlier cut. Undo the damage before continuing:

```sql run
UPDATE order_line
SET salesperson_id = 1
WHERE order_id = 1004 AND product_id = 102;
```

**Boyce-Codd normal form (BCNF)** is the fix: a table is in BCNF when *every* determinant of a non-trivial dependency is a superkey, full stop, with none of 3NF's exceptions ([Silberschatz, Korth and Sudarshan](https://www.db-book.com/slides-dir/PDF-dir/ch7.pdf) and [Ramakrishnan and Gehrke](https://pages.cs.wisc.edu/~dbbook/openAccess/thirdEdition/slides/slides3ed-english/Ch19_FDs-95.pdf) both define it this way). To apply it, name the relationship the join query just tested and give it its own table:

```sql run
CREATE TABLE rep_of (
  customer_id      INTEGER NOT NULL,
  product_category TEXT    NOT NULL,
  salesperson_id   INTEGER NOT NULL
);
INSERT INTO rep_of (customer_id, product_category, salesperson_id)
SELECT DISTINCT o.customer_id, p.product_category, ol.salesperson_id
FROM order_line ol
JOIN orders o ON o.order_id = ol.order_id
JOIN products p ON p.product_id = ol.product_id;

SELECT customer_id, product_category AS category, salesperson_id
FROM rep_of
ORDER BY customer_id, category;
```

```text output
customer_id  category     salesperson_id
-----------  -----------  --------------
1            Fiction      1
1            Programming  2
2            Fiction      1
3            Programming  2
3            Reference    3
4            Reference    3
```

`rep_of` has two dependencies: `customer_id, product_category -> salesperson_id` (the assignment rule) and `salesperson_id -> product_category` (a rep only ever appears under their own specialty). Both are provable from the six rows, not just assumed:

```sql run
SELECT customer_id, product_category, COUNT(*) AS n
FROM rep_of
GROUP BY customer_id, product_category
HAVING COUNT(*) > 1;
```

```text output
customer_id  product_category  n
-----------  ----------------  -
```

```sql run
SELECT customer_id, salesperson_id, COUNT(*) AS n
FROM rep_of
GROUP BY customer_id, salesperson_id
HAVING COUNT(*) > 1;
```

```text output
customer_id  salesperson_id  n
-----------  --------------  -
```

Neither query returns a row, so both `{customer_id, product_category}` and `{customer_id, salesperson_id}` are candidate keys: the first because the assignment rule makes it a superkey with nothing to spare, the second because `salesperson_id -> product_category` makes it one too (a rep already fixes the category, so customer plus rep fixes everything).

```sql run
SELECT salesperson_id, COUNT(DISTINCT product_category) AS categories
FROM rep_of
GROUP BY salesperson_id;
```

```text output
salesperson_id  categories
--------------  ----------
1               1
2               1
3               1
```

Every rep has exactly one category, confirming `salesperson_id -> product_category` holds over all six rows. With two overlapping candidate keys, `customer_id`, `product_category` and `salesperson_id` are all **prime attributes** — each sits in at least one candidate key. That is precisely why `rep_of` passed 3NF earlier without anyone noticing a problem: 3NF's third clause excuses a non-superkey determinant whenever the attribute on the other side is prime, and `product_category` is prime here. BCNF grants no such excuse. `salesperson_id -> product_category` is a non-trivial dependency whose left side, `salesperson_id` alone, is not a superkey of `rep_of` (it doesn't determine `customer_id`), so `rep_of` is in 3NF but not BCNF — the gap between the two normal forms, made of real rows instead of a textbook's placeholder letters.

The repair follows the same rule as every earlier cut: split off the columns of the violating dependency into their own table, keyed on its left side.

```sql run
CREATE TABLE salespeople (
  salesperson_id INTEGER PRIMARY KEY,
  specialty      TEXT NOT NULL
);
INSERT INTO salespeople
SELECT DISTINCT salesperson_id, product_category FROM rep_of;

CREATE TABLE customer_rep (
  customer_id    INTEGER NOT NULL,
  salesperson_id INTEGER NOT NULL,
  PRIMARY KEY (customer_id, salesperson_id)
);
INSERT INTO customer_rep
SELECT DISTINCT customer_id, salesperson_id FROM rep_of;

DROP TABLE rep_of;

SELECT * FROM salespeople ORDER BY salesperson_id;
```

```text output
salesperson_id  specialty
--------------  -----------
1               Fiction
2               Programming
3               Reference
```

`salespeople` is trivially in BCNF: its only determinant is `salesperson_id`, which is its whole primary key. `customer_rep` is too: with `product_category` gone, nothing determines anything except the composite key determining itself.

`order_line.salesperson_id` is now redundant — the same fact, derivable by joining `orders`, `products`, `customer_rep` and `salespeople`, that used to be typed onto every line item by hand. Drop it. [SQLite's `ALTER TABLE`](https://www.sqlite.org/lang_altertable.html) refuses to drop a column that is part of a primary key, a `UNIQUE` constraint, an index, or a foreign key — none of which apply to this plain, unconstrained `salesperson_id` column, so the drop goes through:

```sql run
ALTER TABLE order_line DROP COLUMN salesperson_id;

SELECT * FROM order_line ORDER BY order_id, product_id;
```

```text output
order_id  product_id  quantity
--------  ----------  --------
1001      101         3
1001      103         2
1002      102         1
1003      104         5
1003      105         2
1004      102         1
1005      105         1
```

The fact is not lost, only relocated: it is still one join away.

```sql run
SELECT sp.salesperson_id, sp.specialty
FROM customer_rep cr
JOIN salespeople sp ON sp.salesperson_id = cr.salesperson_id
WHERE cr.customer_id = 1 AND sp.specialty = 'Fiction';
```

```text output
salesperson_id  specialty
--------------  ---------
1               Fiction
```

Seven tables now stand where `order_flat` stood: `orders`, `customers`, `zip_codes`, `products`, `order_line`, `salespeople`, `customer_rep`. Every one of them is in BCNF, and the corrupting `UPDATE` from the start of this section has no column left to land on — `order_line` no longer has a `salesperson_id` to disagree with itself about.

<figure class="diagram">
<svg viewBox="0 0 360 372" role="img" aria-labelledby="nf-title nf-desc">
<title id="nf-title">order_flat decomposed into seven normalized tables</title>
<desc id="nf-desc">One wide box labelled order_flat, thirteen columns, at the top. An arrow points down to a grid of seven smaller boxes: orders, products, customers, zip_codes, order_line, salespeople, and customer_rep, each showing its primary key.</desc>
<defs>
<marker id="nf-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-accent"/></marker>
</defs>
<rect x="8" y="8" width="344" height="56" rx="8" class="d-box-warn"/>
<text x="180" y="32" text-anchor="middle" class="d-mono d-bold">order_flat</text>
<text x="180" y="52" text-anchor="middle" class="d-mono d-small d-muted">13 columns · PK (order_id, product_id)</text>
<path d="M180 64 V98" class="d-accent" marker-end="url(#nf-arrow)"/>
<text x="180" y="112" text-anchor="middle" class="d-small d-muted">splits into seven single-fact tables</text>
<rect x="8" y="122" width="164" height="48" rx="6" class="d-box-good"/>
<text x="90" y="142" text-anchor="middle" class="d-mono d-bold">orders</text>
<text x="90" y="160" text-anchor="middle" class="d-mono d-small d-muted">order_id (PK)</text>
<rect x="188" y="122" width="164" height="48" rx="6" class="d-box-good"/>
<text x="270" y="142" text-anchor="middle" class="d-mono d-bold">products</text>
<text x="270" y="160" text-anchor="middle" class="d-mono d-small d-muted">product_id (PK)</text>
<rect x="8" y="184" width="164" height="48" rx="6" class="d-box-good"/>
<text x="90" y="204" text-anchor="middle" class="d-mono d-bold">customers</text>
<text x="90" y="222" text-anchor="middle" class="d-mono d-small d-muted">customer_id (PK)</text>
<rect x="188" y="184" width="164" height="48" rx="6" class="d-box-good"/>
<text x="270" y="204" text-anchor="middle" class="d-mono d-bold">zip_codes</text>
<text x="270" y="222" text-anchor="middle" class="d-mono d-small d-muted">zip (PK)</text>
<rect x="8" y="246" width="164" height="48" rx="6" class="d-box-good"/>
<text x="90" y="266" text-anchor="middle" class="d-mono d-bold">order_line</text>
<text x="90" y="284" text-anchor="middle" class="d-mono d-small d-muted">composite PK</text>
<rect x="188" y="246" width="164" height="48" rx="6" class="d-box-good"/>
<text x="270" y="266" text-anchor="middle" class="d-mono d-bold">salespeople</text>
<text x="270" y="284" text-anchor="middle" class="d-mono d-small d-muted">salesperson_id (PK)</text>
<rect x="98" y="308" width="164" height="48" rx="6" class="d-box-good"/>
<text x="180" y="328" text-anchor="middle" class="d-mono d-bold">customer_rep</text>
<text x="180" y="346" text-anchor="middle" class="d-mono d-small d-muted">composite PK</text>
</svg>
<figcaption>Figure 1. Every box on the bottom holds exactly one kind of fact. A column that used to repeat once per line item on order_flat now has exactly one row to live in.</figcaption>
</figure>

::::exercise[Same shape, a different business]
A tutoring center keeps `session (student_id, subject, tutor_id)`. Two rules hold: a student sees one dedicated tutor per subject (`student_id, subject -> tutor_id`), and every tutor teaches exactly one subject (`tutor_id -> subject`).

(a) Name both candidate keys of `session`. (b) Is `session` in 3NF? (c) Is it in BCNF? Justify each answer the way this section justified `rep_of`'s.

:::solution
(a) `{student_id, subject}` is a candidate key by the first rule directly. `{student_id, tutor_id}` is one too: `tutor_id -> subject` means the pair already determines `subject`, and neither `student_id` alone (a student has different tutors for different subjects) nor `tutor_id` alone (a tutor teaches many students) determines the other.

(b) Yes. The only dependency whose left side isn't a superkey is `tutor_id -> subject`, and `subject` is prime — it belongs to the first candidate key — so 3NF's third clause excuses it.

(c) No. `tutor_id` alone is not a superkey (it doesn't determine `student_id`), so `tutor_id -> subject` violates BCNF's flat rule, exactly as `salesperson_id -> product_category` did for `rep_of`. The fix is the same decomposition: `tutors (tutor_id PK, subject)` and `student_tutor (student_id, tutor_id, PRIMARY KEY (student_id, tutor_id))`.
:::
::::

## When seven tables are the wrong answer

None of this is free. A report the bookstore actually wants — "for this customer, every order with the title, the date and which specialty handled it" — now needs five tables:

```sql run
SELECT o.order_date, p.product_name,
       sp.specialty AS handled_by
FROM order_line ol
JOIN orders o ON o.order_id = ol.order_id
JOIN customers c ON c.customer_id = o.customer_id
JOIN products p ON p.product_id = ol.product_id
JOIN customer_rep cr ON cr.customer_id = c.customer_id
 AND cr.salesperson_id IN (
   SELECT salesperson_id FROM salespeople
   WHERE specialty = p.product_category
 )
JOIN salespeople sp ON sp.salesperson_id = cr.salesperson_id
WHERE c.customer_id = 1
ORDER BY o.order_date, p.product_name;
```

```text output
order_date  product_name  handled_by
----------  ------------  -----------
2026-09-02  Clean Code    Programming
2026-09-02  Dune          Fiction
2026-09-12  Beloved       Fiction
```

That query is correct, but it is also five joins for a report a store manager wants to run every morning, and the subquery picking the right rep by matching `specialty` to `product_category` is not something a manager writing ad-hoc SQL should have to rediscover. What an index does to the *cost* of each of those joins is a separate question from how many of them a query needs in the first place, which is all normalization controls.

For a system that *records* orders — the one this page built — that cost is worth paying: every insert, update and delete touches exactly one table, and no anomaly from the second section can happen again. A system whose job is mostly *reading* aggregated history, like a monthly sales dashboard, has the opposite shape: it runs the same few wide reports over and over and almost never updates old rows. Rebuilding `order_flat` as a **denormalized reporting table** — refreshed on a schedule, joined once when it's built rather than once per query — trades exactly the redundancy this page spent its length removing for a query that no longer needs five joins to answer. The trade only works because that table is a read-only copy: the normalized tables stay the system of record, the update anomaly has nowhere to reappear because nobody runs `UPDATE` against the report, and a stale report is fixed by rebuilding it, not by chasing down every row a fact was copied into. Denormalizing without keeping a normalized original is choosing to bring every anomaly in this article back on purpose.

::::exercise[Build the reporting table]
Using `orders`, `customers`, `products`, `order_line`, `customer_rep` and `salespeople`, write a single `CREATE TABLE monthly_report AS SELECT ...` that flattens one row per line item with `customer_name`, `product_name`, `product_category`, `quantity`, and `handled_by` (the specialty), for every order — no `WHERE` restricting it to one customer this time. Then write the one-line query a dashboard would run against `monthly_report` to get total quantity sold per category, and compare it with what that query would have to look like against the seven normalized tables.

:::solution
```sql run
CREATE TABLE monthly_report AS
SELECT c.customer_name, p.product_name, p.product_category,
       ol.quantity, sp.specialty AS handled_by
FROM order_line ol
JOIN orders o ON o.order_id = ol.order_id
JOIN customers c ON c.customer_id = o.customer_id
JOIN products p ON p.product_id = ol.product_id
JOIN customer_rep cr ON cr.customer_id = c.customer_id
 AND cr.salesperson_id IN (
   SELECT salesperson_id FROM salespeople
   WHERE specialty = p.product_category
 )
JOIN salespeople sp ON sp.salesperson_id = cr.salesperson_id;

SELECT product_category, SUM(quantity) AS total
FROM monthly_report
GROUP BY product_category
ORDER BY product_category;
```

```text output
product_category  total
----------------  -----
Fiction           5
Programming       7
Reference         3
```

Against `monthly_report`, the dashboard query is one table and one `GROUP BY`. Against the normalized schema it is the same five-join query from this section wrapped in another `GROUP BY`, run without the `WHERE c.customer_id = 1` filter — correct, but five times the joins for a number a manager wants refreshed every morning. Nothing here is free: `monthly_report` now carries `product_name` and `customer_name` on every row again, so if it is ever written to directly instead of rebuilt from the normalized tables, every anomaly from the start of this page comes back.

```sql run
DROP TABLE monthly_report;
```
:::
::::

Every normal form on this page asked the same question of a different scope: does this column really depend on the whole key, nothing but the key, and only the key? 1NF asked whether a column held one value. 2NF asked whether a value needed the whole key or just part of it. 3NF asked whether it depended on the key or on another ordinary column instead. BCNF dropped the exception 3NF grants prime attributes and asked the question in its strictest form: is *every* determinant here actually a key? A table that survives all four questions has exactly one place for each fact to live — which is also exactly the property that made every anomaly in the second section impossible to reproduce once the schema stopped lying to `order_flat` about how many kinds of thing it was.
