---
title: "Layout Fixture: Every Article Component on One Page"
description: "Internal draft used to verify the article template. It exercises code blocks, output, callouts, tables, diagrams and article furniture."
pillar: complexity
order: 999
author: markus
published: 2026-09-18
updated: 2026-09-18
level: intermediate
tags: [layout-fixture, big-o]
prerequisites: []
sources:
  - title: "List<T>.Capacity Property"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.list-1.capacity"
    publisher: "Microsoft Learn"
    accessed: 2026-09-18
  - title: "SQLite: SELECT"
    url: "https://www.sqlite.org/lang_select.html"
    publisher: "SQLite"
    accessed: 2026-09-18
draft: true
---

This page is a **test fixture**, not an article. It is marked `draft: true`, so it is only built when `INCLUDE_DRAFTS=1` is set. Its job is to put every component a writer can use in front of the screenshot and code-verification tools. Prose here is deliberately long enough to judge the measure and the rhythm of the text: a paragraph of three or four sentences, with *emphasis*, **strong text**, `inline code` such as `List<T>.Capacity`, a [link to the editorial policy](/editorial-policy/), and a keyboard shortcut like <kbd>Ctrl</kbd>+<kbd>C</kbd>.

Inline code must wrap sanely at phone width. Short code never breaks: the flag `-t`, the operator `NOT IN`, the option `--oneline`, the call `list.Add(item)`. Long identifiers break after a dot or an underscore, never one character from the end: `GC.GetAllocatedBytesForCurrentThread`, `System.Collections.Generic.Dictionary<TKey,TValue>.EnsureCapacity`, `SQLITE_DEFAULT_WAL_AUTOCHECKPOINT_PAGES`, and a command such as `git log --oneline --graph --decorate --all` breaks only at its spaces.

Accidental directive syntax must survive untouched: `std::vector` in code, and in prose a ratio like 3:2, a time like 10:30, a label such as key:value, and C++-style scope Foo::bar.

## A runnable program with output

A `csharp run` block is a complete file-based program. The `text output` block directly after it is attached to it visually and is compared with the real standard output by `tools/run-code.mjs`.

```csharp run id=capacity
var list = new List<int>();
int lastCapacity = -1;

for (int i = 0; i < 20; i++)
{
    list.Add(i);
    if (list.Capacity != lastCapacity)
    {
        lastCapacity = list.Capacity;
        Console.WriteLine($"Count = {list.Count,2}  Capacity = {list.Capacity,2}");
    }
}
```

```text output
Count =  1  Capacity =  4
Count =  5  Capacity =  8
Count =  9  Capacity = 16
Count = 17  Capacity = 32
```

### An excerpt of that program

A `snippet of=` block must match lines of the program above, in order. It gets an "Excerpt" label so readers know it will not compile on its own.

```csharp snippet of=capacity
if (list.Capacity != lastCapacity)
{
    lastCapacity = list.Capacity;
```

### A long line, to prove the block scrolls and the page does not

```csharp run
Dictionary<string, List<(int Count, int Capacity)>> history = new() { ["list"] = new List<(int Count, int Capacity)> { (1, 4), (5, 8), (9, 16), (17, 32) } };
Console.WriteLine(history["list"].Count);
```

```text output
4
```

## Code that is supposed to fail

This block carries `error=CS0165`. The build tool checks that the compiler really reports that diagnostic, and the page labels it so nobody pastes it expecting it to work.

```csharp run error=CS0165
int total;
Console.WriteLine(total);
```

The runtime equivalent is `throws=`:

```csharp run throws=InvalidOperationException
var queue = new Queue<int>();
queue.Dequeue();
```

## SQL with a result set

```sql run
CREATE TABLE growth (step INTEGER PRIMARY KEY, capacity INTEGER NOT NULL);
INSERT INTO growth (capacity) VALUES (4), (8), (16), (32);

SELECT step, capacity, capacity * 4 AS bytes
FROM growth
WHERE capacity > 4;
```

```text output
step  capacity  bytes
----  --------  -----
2     8         32
3     16        64
4     32        128
```

## Shell commands

```bash run
mkdir demo && cd demo
git init -q
echo "hello" > readme.txt
git add readme.txt
git commit -q -m "Add readme"
git log --oneline | wc -l
```

```text output
1
```

Illustrative blocks are highlighted but never executed:

```json
{ "capacity": 32, "count": 17, "growth": "double" }
```

```http
GET /complexity/ HTTP/1.1
Host: www.computerscienceguide.com
Accept: text/html
```

```diff
- list.Capacity = list.Count + 1;
+ list.Capacity = list.Count * 2;
```

## Callouts

:::note
A note adds context that is useful but not essential. It can contain `inline code` and [links](/glossary/#dynamic-array).
:::

### Output panels inside callouts, in SQL, Bash and C#

Every callout type below holds a program with an attached output panel. The panel must stay a dark terminal with light text in **both** themes. The heading above must keep its "C#" in the table of contents.

:::note
```bash run
echo "output inside a note"
```

```text output
output inside a note
```
:::

:::warning
```sql run
SELECT step, capacity FROM growth WHERE step = 1;
```

```text output
step  capacity
----  --------
1     4
```
:::

:::pitfall
```bash run
echo "output inside a pitfall"
```

```text output
output inside a pitfall
```
:::

:::dotnet
```csharp run
var list = new List<int>(capacity: 3);
Console.WriteLine($"output inside a dotnet callout: {list.Capacity}");
```

```text output
output inside a dotnet callout: 3
```
:::

::::exercise[Output in an exercise and in its solution]
```bash run
echo "output inside an exercise"
```

```text output
output inside an exercise
```

:::solution
```sql run
SELECT count(*) AS n FROM growth;
```

```text output
n
-
4
```
:::
::::

### The plain callouts

:::warning[Capacity is not Count]
A warning flags something that will cause incorrect results if ignored. This one has a custom title.
:::

:::pitfall
A pitfall describes a mistake people commonly make, such as calling `TrimExcess()` inside a loop and turning an O(n) loop into an O(n²) one.
:::

:::dotnet
The `dotnet` callout explains how the base class library really does something. It may contain code:

```csharp snippet of=capacity
var list = new List<int>();
```
:::

::::exercise[Predict the capacity]
Without running it, what capacity does the list have after 33 calls to `Add`? Then change the loop bound in the first program and check.

:::solution
64. The capacity doubles each time the list is full: 4, 8, 16, 32, and the 33rd element does not fit in 32.
:::
::::

::::exercise
A second exercise, to show that numbering continues and that a default title works.

:::solution[Show the answer]
Solutions can have a custom label and can hold several paragraphs.

Including this second one.
:::
::::

## A table

| Operation | Array | `List<T>` | `LinkedList<T>` | Notes |
|---|---|---|---|---|
| Index | O(1) | O(1) | O(n) | Linked lists must walk from one end |
| Append | not supported | O(1) amortized | O(1) | `List<T>` occasionally copies everything |
| Insert at front | not supported | O(n) | O(1) | Every element shifts one place |
| Search (unsorted) | O(n) | O(n) | O(n) | No structure to exploit |

A table with long cells, which must scroll on a phone with compact rows rather than wrap its hidden cells five lines tall:

| Kind of bound | What is averaged | What is assumed | What can go wrong |
|---|---|---|---|
| Worst-case | Nothing: one operation | Nothing | The bound is loose for every typical input, so it overstates the cost |
| Amortized | The operations of one sequence | Nothing about the input; only that you look at the whole sequence | A single operation can still be slow, which matters for latency |
| Average-case | All possible inputs | A probability distribution over inputs | Real inputs do not follow the assumed distribution |

Numbers align right when the Markdown column is right-aligned:

| n | n log₂ n | n² |
|---:|---:|---:|
| 10 | 33 | 100 |
| 1,000 | 9,966 | 1,000,000 |
| 1,000,000 | 19,931,569 | 1,000,000,000,000 |

## A themed diagram

This diagram follows the phone rules in the writer guide: a viewBox 360 wide, stacked top to bottom, annotations under the drawing, no text under 12 units. It fits a 390 px screen without scrolling.

<figure class="diagram">
<svg viewBox="0 0 360 290" role="img" aria-labelledby="fx-title fx-desc">
<title id="fx-title">A list growing from capacity 4 to capacity 8</title>
<desc id="fx-desc">A full four-element array is copied into a new eight-element array, leaving three free slots after the fifth element is stored.</desc>
<defs>
<marker id="fx-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-accent"/></marker>
</defs>
<text x="20" y="24" class="d-bold">Before: Count = 4, Capacity = 4</text>
<rect x="20" y="36" width="40" height="40" class="d-box"/><text x="40" y="61" text-anchor="middle" class="d-mono">0</text>
<rect x="60" y="36" width="40" height="40" class="d-box"/><text x="80" y="61" text-anchor="middle" class="d-mono">1</text>
<rect x="100" y="36" width="40" height="40" class="d-box"/><text x="120" y="61" text-anchor="middle" class="d-mono">2</text>
<rect x="140" y="36" width="40" height="40" class="d-box"/><text x="160" y="61" text-anchor="middle" class="d-mono">3</text>
<text x="20" y="96" class="d-muted d-small">Full: the next Add must grow the array</text>
<path d="M100 108 V150" class="d-accent" marker-end="url(#fx-arrow)"/>
<text x="112" y="134" class="d-text-accent d-small">copy 4 elements</text>
<text x="20" y="180" class="d-bold">After Add(4): Count = 5, Capacity = 8</text>
<rect x="20" y="192" width="40" height="40" class="d-box"/><text x="40" y="217" text-anchor="middle" class="d-mono">0</text>
<rect x="60" y="192" width="40" height="40" class="d-box"/><text x="80" y="217" text-anchor="middle" class="d-mono">1</text>
<rect x="100" y="192" width="40" height="40" class="d-box"/><text x="120" y="217" text-anchor="middle" class="d-mono">2</text>
<rect x="140" y="192" width="40" height="40" class="d-box"/><text x="160" y="217" text-anchor="middle" class="d-mono">3</text>
<rect x="180" y="192" width="40" height="40" class="d-box-accent"/><text x="200" y="217" text-anchor="middle" class="d-mono d-bold">4</text>
<rect x="220" y="192" width="40" height="40" class="d-box-2 d-dashed"/>
<rect x="260" y="192" width="40" height="40" class="d-box-2 d-dashed"/>
<rect x="300" y="192" width="40" height="40" class="d-box-2 d-dashed"/>
<text x="20" y="254" class="d-muted d-small">Slots 5 to 7 are free: three more Adds copy nothing</text>
<text x="20" y="274" class="d-muted d-small">Accent slot: the element that forced the growth</text>
</svg>
<figcaption>Figure 1. Growth copies every element once, then buys several cheap appends. Strokes, fills and text all come from theme variables.</figcaption>
</figure>

A diagram that really needs the width (a timeline, a wide graph) may use a viewBox up to 720. On a phone it keeps its scale and scrolls sideways under a fading edge, so the essential part must sit in the left 360 units:

<figure class="diagram">
<svg viewBox="0 0 720 110" role="img" aria-labelledby="fxw-title fxw-desc">
<title id="fxw-title">Capacity after each growth step</title>
<desc id="fxw-desc">Five boxes in a row show the capacity doubling from 4 to 64, with the number of elements copied at each step written underneath.</desc>
<defs>
<marker id="fxw-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-stroke"/></marker>
</defs>
<rect x="20" y="20" width="100" height="44" rx="6" class="d-box-accent"/><text x="70" y="47" text-anchor="middle" class="d-mono d-bold">4</text>
<path d="M120 42 H165" class="d-line" marker-end="url(#fxw-arrow)"/>
<rect x="170" y="20" width="100" height="44" rx="6" class="d-box"/><text x="220" y="47" text-anchor="middle" class="d-mono">8</text>
<path d="M270 42 H315" class="d-line" marker-end="url(#fxw-arrow)"/>
<rect x="320" y="20" width="100" height="44" rx="6" class="d-box"/><text x="370" y="47" text-anchor="middle" class="d-mono">16</text>
<path d="M420 42 H465" class="d-line" marker-end="url(#fxw-arrow)"/>
<rect x="470" y="20" width="100" height="44" rx="6" class="d-box"/><text x="520" y="47" text-anchor="middle" class="d-mono">32</text>
<path d="M570 42 H615" class="d-line" marker-end="url(#fxw-arrow)"/>
<rect x="620" y="20" width="80" height="44" rx="6" class="d-box"/><text x="660" y="47" text-anchor="middle" class="d-mono">64</text>
<text x="145" y="88" text-anchor="middle" class="d-muted d-small">copy 4</text>
<text x="295" y="88" text-anchor="middle" class="d-muted d-small">copy 8</text>
<text x="445" y="88" text-anchor="middle" class="d-muted d-small">copy 16</text>
<text x="595" y="88" text-anchor="middle" class="d-muted d-small">copy 32</text>
</svg>
<figcaption>Figure 2. A wide diagram: on a phone the drawing scrolls and its right edge fades while more is hidden; the caption stays put.</figcaption>
</figure>

## Remaining prose elements

Ordered and unordered lists, nested one level:

1. Allocate a new array with double the capacity.
2. Copy the existing elements.
   - This is the O(n) step.
   - It happens only when the list is full.
3. Store the new element.

> A blockquote is for quoting a specification or primary source briefly, with the citation in the sources list.

### A third-level heading before the fourth

Heading levels must not skip: an `h4` only ever follows an `h3`.

#### A fourth-level heading

Fourth-level headings are available but do not appear in the table of contents.

<details>
<summary>Full program</summary>

Snippet-heavy articles can tuck the complete listing into a plain `<details>` element like this one.

</details>
