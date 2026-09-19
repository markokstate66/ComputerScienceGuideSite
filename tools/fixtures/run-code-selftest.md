---
title: run-code self-test (not site content)
---

Passing program with exact output:

```csharp run id=sum
int[] values = [3, 1, 4];
int total = 0;
foreach (int v in values)
{
    total += v;
}
Console.WriteLine($"total = {total}");
```

```text output
total = 8
```

Excerpt that must exist in the program above:

```csharp snippet of=sum
foreach (int v in values)
{
    total += v;
}
```

Wildcard output:

```csharp run
Console.WriteLine($"elapsed: {Environment.TickCount64} ms");
```

```text output
elapsed: [...] ms
```

Expected compile error:

```csharp run error=CS0165
int x;
Console.WriteLine(x);
```

Expected exception:

```csharp run throws=InvalidOperationException
var q = new Queue<int>();
q.Dequeue();
```

SQL with shared state:

```sql run
CREATE TABLE book (id INTEGER PRIMARY KEY, title TEXT NOT NULL, year INTEGER);
INSERT INTO book (title, year) VALUES ('SICP', 1985), ('TAOCP', NULL);
```

```sql run
SELECT id, title, year FROM book ORDER BY id;
```

```text output
id  title  year
--  -----  ----
1   SICP   1985
2   TAOCP  NULL
```

```sql run error
INSERT INTO book (title) VALUES (NULL);
```

```text output
NOT NULL constraint failed
```

Shell with reproducible git hashes:

```bash run
git init -q demo
cd demo
echo "hello" > a.txt
git add a.txt
git commit -q -m "first"
git log --oneline
```

```text output
[...] first
```

The working directory carries over between shell blocks (no second `cd demo`):

```bash run
git rev-list --count HEAD
basename "$(pwd)"
```

```text output
1
demo
```

The blocks below MUST be reported as failures.

```csharp run
Console.WriteLine("actual");
```

```text output
claimed
```

```csharp
Console.WriteLine("unverified");
```

```csharp snippet of=sum
total -= v;
```
