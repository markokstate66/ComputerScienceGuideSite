# Content Plan — computerscienceguide.com

Companion to `AUDIT.md`. This is the contract every agent works from. Status lives in `docs/STATUS.json`; things only Markus can supply live in `docs/NEEDS_MARKUS.md`.

## 1. Positioning

Computer science fundamentals explained by a working .NET developer, with **every example compiled and run**. The top results for most CS-fundamentals queries use Python, Java or pseudocode; a C#-first treatment that shows how each idea surfaces in the real .NET runtime and base class library (`List<T>` growth, `Dictionary<TKey,TValue>` buckets, `PriorityQueue`, `Span<T>`, `async` state machines, `System.Net.Sockets`) is a real gap, and it is the owner's real expertise.

Assumptions (stated, not asked): .NET 10 SDK is the reference toolchain because that is what is installed; SQL examples run on SQLite because it is the engine we can execute in CI, with dialect notes for SQL Server and PostgreSQL where they differ; Python is not used because it is not installed and no topic below requires it.

## 2. Stack decisions

- **Keep** Astro + Azure Static Web Apps (audit: fast, working pipeline).
- **Change** content to Astro content collections: Markdown (`.md`, `.mdx` only when a component is needed) under `src/content/articles/<pillar>/<slug>.md`, schema-validated at build.
- URLs: `/<pillar>/` (hub) and `/<pillar>/<slug>/` (article). Trailing slash everywhere.
- The 17 legacy `/guides/*` pages are retired. Each gets a 301 in `staticwebapp.config.json` to the closest new hub or article; topics we are dropping (React, Node.js, HTML/CSS, JavaScript, web-development, portfolio, interview-prep, system-design, api-design) redirect to `/topics/`. `/resources/` is removed (hot-linked images, undisclosed affiliate links); `/roadmap/` is replaced by `/start-here/`.
- Search: Pagefind (static index built after `astro build`, no server, no third party).
- Syntax highlighting: Astro's built-in Shiki with dual light/dark themes. No client-side highlighter.
- No web fonts; system font stack. No JS frameworks. JS budget: theme toggle, mobile menu, copy button, search.

## 3. Content model

`src/content/config.ts`, collection `articles`:

| Field | Type | Notes |
|---|---|---|
| `title` | string ≤ 70 chars | Specific; no "Complete/Ultimate Guide" |
| `description` | string 110–160 chars | Meta description; says what the reader will be able to do |
| `pillar` | enum of pillar slugs | Must match folder |
| `order` | number | Position within the pillar's reading order |
| `author` | reference → `authors` collection | Single real author; bio facts come from `NEEDS_MARKUS.md` |
| `published` | date | Real date the article first passed the gauntlet |
| `updated` | date | Real date of last substantive edit |
| `level` | `beginner` \| `intermediate` \| `advanced` | |
| `tags` | string[] 2–6 | Drives related-article links and glossary back-links |
| `prerequisites` | slug[] | Rendered as "Before you read" |
| `sources` | `{title, url, publisher?, accessed}`[] ≥ 2 | Primary sources only; rendered as a numbered reference list |
| `draft` | boolean | Drafts are excluded from build, sitemap and search |

Reading time is **computed** from prose word count (220 wpm) plus 20 s per code block; never hand-entered. Collections `authors`, `pillars` (title, blurb, hub intro, accent colour) and `glossary` (term, definition, see-also slugs) are data files.

### Code block contract (enforced by `tools/run-code.mjs`)

| Fence | Meaning |
|---|---|
| ` ```csharp run ` (optional `id=name`) | Complete file-based C# program (top-level statements). Compiled and executed with `dotnet run`. |
| ` ```text output ` immediately after a `run` block | The exact stdout the program must produce. `[...]` matches any run of characters on a line (timings, addresses, hashes). |
| ` ```csharp snippet of=name ` | Excerpt. Every line must appear, in order, in the `run` block with that id, so excerpts cannot drift from tested code. |
| ` ```csharp run error=CS0165 ` | Must **fail** to compile with that diagnostic (for "this is the bug" examples). `throws=InvalidOperationException` is the runtime equivalent. |
| ` ```sql run ` | Executed in order against one in-memory SQLite database per article; a following `text output` block must match the rendered result set. |
| ` ```bash run ` | Executed in order in one throwaway directory per article (Git Bash); used by the version-control pillar. |
| `text`, `json`, `http`, `xml`, `diff`, `console`, `il`, `asm` | Illustrative, not executed. `console` is for transcripts of interactive tools and must be produced by really running them. |

A `csharp`, `sql` or `bash` block with none of `run`/`snippet` fails the build. Hidden full programs for snippet-heavy articles go in a `<details>` "Full program" block so the page stays readable.

## 4. Design system

- **Type:** system UI stack for prose, `ui-monospace, "Cascadia Code", Consolas` for code. Prose measure 68–75 ch, 18 px base on desktop, 17 px on mobile, 1.7 line height. Modular scale 1.25.
- **Colour:** tokens defined once on `:root`, redefined for `[data-theme="dark"]` and `prefers-color-scheme`. All text/background pairs ≥ 4.5:1 (checked by Lighthouse). One accent hue per pillar, used only for the hub banner, breadcrumbs and diagram strokes.
- **Layout:** article = content column + sticky "On this page" TOC (auto-generated from `h2`/`h3`, highlights current section) at ≥ 1100 px; TOC collapses into a `<details>` above the content below that. Header has a real mobile menu button. Skip link, visible focus rings, `prefers-reduced-motion` respected.
- **Code blocks:** Shiki dual theme, language label, copy button, horizontal scroll inside the block (page never scrolls sideways), `output` blocks styled as terminal output and visually attached to the program above.
- **Callouts:** `:::note`, `:::warning`, `:::pitfall`, `:::dotnet` (how the BCL actually does it), `:::exercise` with collapsible solution.
- **Diagrams:** hand-authored inline SVG using `currentColor` and CSS variables so they follow the theme; `<figure>` + `<figcaption>`; `role="img"` + `<title>`/`<desc>`. No raster screenshots of other people's diagrams, no Mermaid runtime.
- **Tables:** wrapped in a scroll container; complexity tables use a shared component.
- **Article furniture:** breadcrumbs, byline with author link, published/updated dates, computed reading time, level, prerequisites, sources list, previous/next in pillar, 3 related articles by tag overlap, "report an error" link to `/contact/`.

## 5. Technical SEO

`sitemap.xml` with per-page `lastmod` from `updated`; `robots.txt` pointing at the real sitemap; canonical URLs; JSON-LD `Article` (author = `Person`), `BreadcrumbList`, `WebSite`, `Organization` (no `SearchAction` unless `/search/` exists and works); Open Graph + Twitter tags with a per-pillar OG image under 100 KB; real 404 (remove the SPA `navigationFallback`); 301s for every legacy URL; `apple-touch-icon.png` and `logo.png` actually present; `ads.txt` kept; AdSense loader removed and replaced by one commented verification slot in `BaseLayout`.

## 6. Trust pages

About (real person; facts from `NEEDS_MARKUS.md`), Contact (existing form + API kept), Privacy Policy (rewritten around what the site really does: GA4, the contact form via Azure Communication Services, theme preference in `localStorage`, future AdSense + consent), Terms, **Editorial Policy** (how articles are researched, that code is machine-verified, how AI assistance is used and reviewed, corrections process), **Corrections log**. Anything unknown is a visible `NEEDS_MARKUS` marker that the verify tool treats as a failing placeholder, so it cannot ship by accident.

## 7. Pillars and articles

Ten pillars, 67 planned articles. **Wave A** is the first five rows of each pillar (50 articles); **wave B** is the remainder, written only once wave A has cleared the gauntlet. We expect the gauntlet to cut some; the floor is 40 published. Depth target per article is "covers the topic as thoroughly as the best existing result, plus our angle"; no word-count targets.

Every article carries: at least one original diagram unless marked *(no diagram needed)*, runnable code, 3–6 exercises with solutions, and a sources list. Structure is deliberately varied; the "shape" column assigns a different skeleton to neighbouring articles so the site does not read as one template.

Shapes: **W** worked problem first, theory after · **B** build it from scratch step by step · **I** investigation (measure something, explain the result) · **C** comparison/decision guide · **D** debugging story (start from a bug) · **R** reference with deep examples · **Q** question-driven (FAQ-style headings that are real search questions).

### 7.1 `complexity` — Complexity and Big-O

| # | Slug · working title | Intent | Shape | Outline | Our angle | Diagrams | Code |
|---|---|---|---|---|---|---|---|
| 1 | `big-o-notation` · Big-O Notation: What It Measures and What It Hides | "what is big o notation" | W | Counting operations on a real loop → growth, not speed → formal definition (c, n₀) → dropping constants, why that is legitimate and when it lies → O vs Ω vs Θ → common classes with a feel for each → reading Big-O off code → exercises | Most pages never give the formal definition or show where it misleads; we do both, and measure a case where the O(n²) algorithm wins for small n | Growth curves (log–log and linear); c·g(n) bound illustration | Operation-counting harness; insertion sort vs merge sort crossover measurement |
| 2 | `analyzing-loops-and-recursion` · How to Work Out the Complexity of Your Own Code | "how to calculate time complexity" | Q | Sequential/nested loops → loops that halve → dependent inner loops (triangular sums) → recursion trees → recurrences and the Master Theorem, three cases with examples → when Master Theorem does not apply | A procedure a reader can apply, with 8 graded code fragments analysed fully | Recursion tree for T(n)=2T(n/2)+n; triangular loop area | Instrumented counters that confirm each derived formula |
| 3 | `amortized-analysis` · Amortized Analysis: Why List&lt;T&gt;.Add Is O(1) | "amortized time complexity" | I | Observe `List<T>.Capacity` while adding → aggregate method → banker's method → why doubling and not +k → amortized ≠ average-case → other examples (stack with multipop, binary counter) | Uses the real `List<T>` growth policy, observed by running code, not a toy dynamic array | Capacity staircase; credit diagram | Capacity trace; +k vs ×2 copy counts |
| 4 | `space-complexity` · Space Complexity and the Memory Your Code Really Uses | "space complexity" | C | Auxiliary vs total space → the call stack as space → in-place algorithms → time–space trades (memoization) → .NET realities: object headers, references, `struct` vs `class`, `Span<T>`/`stackalloc` | Connects textbook space complexity to measured allocations | Stack frames during recursion; array-of-struct vs array-of-class layout | `GC.GetAllocatedBytesForCurrentThread` measurements |
| 5 | `best-average-worst-case` · Best, Average and Worst Case: Quicksort as a Case Study | "best average worst case complexity" | D | A quicksort that dies on sorted input → why → the three cases defined properly → expected-case via randomization → adversarial inputs and hash flooding → how to state complexity honestly | Clears up the common "Big-O = worst case" confusion with a concrete failure | Partition trees, balanced vs degenerate | Naive vs randomized pivot, comparison counts |
| 6 | `p-vs-np` · P, NP and NP-Completeness for Working Programmers | "p vs np explained" | Q | Decision problems → P → NP as "checkable" → reductions → NP-complete/NP-hard → what to do when your problem is NP-hard (exact for small n, approximation, heuristics) | Practical "how to recognise one at work and what to do" section | Venn of classes (with the honest "if P≠NP" caveat); reduction arrow diagram | Subset-sum: brute force vs DP (pseudo-polynomial), verifier function |

### 7.2 `data-structures`

| # | Slug · working title | Intent | Shape | Outline | Our angle | Diagrams | Code |
|---|---|---|---|---|---|---|---|
| 1 | `arrays-and-dynamic-arrays` · Arrays and List&lt;T&gt;: Contiguous Memory and Why It Wins | "array vs list c#", "dynamic array" | I | Memory layout → index arithmetic → cache locality measured → `List<T>` internals → insertion/removal cost → `Span<T>`, `ArraySegment` → multi-dimensional vs jagged | Measures locality (row- vs column-major) instead of asserting it | Memory layout; insert shift; jagged vs rectangular | Traversal-order timing; minimal `DynamicArray<T>` |
| 2 | `linked-lists` · Linked Lists: How They Work and Why You Rarely Need One | "linked list explained" | B | Build singly linked → doubly linked → sentinel nodes → operations and costs → `LinkedList<T>` → why arrays usually beat them → where they do win (LRU cache, intrusive lists) | Honest about modern hardware; builds an LRU cache as the legitimate use | Node/pointer diagrams for insert, delete, reverse | Own `SinglyLinkedList<T>`; reverse; LRU cache with `LinkedList<T>`+`Dictionary` |
| 3 | `stacks-and-queues` · Stacks, Queues and Deques, with Real Uses | "stack vs queue" | W | Bracket matching problem → stack ADT → array vs linked implementation → queue via circular buffer → deque → `Stack<T>`, `Queue<T>` internals → monotonic stack | Circular buffer built and drawn step by step | Ring buffer head/tail wraparound; call stack | Bracket matcher; `RingQueue<T>`; next-greater-element |
| 4 | `hash-tables` · Hash Tables: How Dictionary&lt;TKey,TValue&gt; Finds Things in O(1) | "how does a hash table work" | B | Direct addressing → hash functions → collisions: chaining vs open addressing → load factor and resize → how .NET's `Dictionary` is laid out (buckets + entries arrays) → `GetHashCode`/`Equals` contract → mutable-key bug → worst case and randomized string hashing | Explains the real BCL layout and the mutable-key bug with runnable proof | Chaining vs probing; buckets/entries arrays | Own chained `HashMap<K,V>`; broken-key demo |
| 5 | `binary-search-trees` · Binary Search Trees, Balance, and What SortedDictionary Uses | "binary search tree" | B | BST property → search/insert/delete (three delete cases) → traversals → degenerate trees → rotations → red-black idea at invariant level → `SortedDictionary`/`SortedSet` | Delete handled fully; ties to BCL types | Delete cases; rotation; degenerate vs balanced | Generic `Bst<T>` with in-order iterator; height experiment |
| 6 | `heaps-and-priority-queues` · Binary Heaps and PriorityQueue&lt;TElement,TPriority&gt; | "heap data structure", "priority queue c#" | B | Priority queue ADT → heap as array → sift-up/down → O(n) heapify proof sketch → `PriorityQueue` API quirks (no decrease-key, not stable) → top-k, merge k lists | Heapify O(n) argument made visual; BCL caveats | Tree↔array mapping; sift-down steps; heapify work per level | Own `MinHeap<T>`; top-k; stable-priority workaround |
| 7 | `graphs-representation` · Representing Graphs: Adjacency Lists, Matrices and Trade-offs | "graph data structure" | C | Vocabulary → adjacency matrix vs list vs edge list → space/time table → weighted/directed → implicit graphs (grids) → choosing | Decision guide with measured memory for sparse vs dense | Same graph in three representations | `Graph` class; grid-as-graph neighbours |
| 8 | `tries` · Tries: Prefix Trees for Autocomplete | "trie data structure" | W | Autocomplete problem → naive scan → trie insert/search/prefix → memory cost → compressed tries → when a sorted array + binary search is enough | Compares against the simple alternative instead of overselling | Trie for a small word set; radix compression | `Trie` with `StartsWith` enumeration; benchmark vs sorted array |

### 7.3 `algorithms`

| # | Slug · working title | Intent | Shape | Outline | Our angle | Diagrams | Code |
|---|---|---|---|---|---|---|---|
| 1 | `binary-search` · Binary Search and the Bugs Everyone Writes | "binary search algorithm" | D | A subtly wrong binary search → invariants → correct version → overflow in midpoint → lower/upper bound variants → `Array.BinarySearch` return convention (`~index`) → search on answer space | Invariant-driven; the bitwise-complement convention explained | Shrinking interval; lower-bound invariant | Buggy + fixed; lower bound; answer-space search |
| 2 | `sorting-algorithms-compared` · Sorting Algorithms Compared: What to Know and What .NET Uses | "sorting algorithms" | C | Insertion, selection → merge sort → quicksort → heap sort → stability → Ω(n log n) lower bound for comparison sorts → introsort in `Array.Sort`, stable LINQ `OrderBy` → choosing | Decision table + what the runtime really does, cited to docs/source | Merge tree; partition; decision-tree lower bound | All sorts implemented; comparison counters |
| 3 | `recursion` · Recursion: Thinking in Smaller Problems | "recursion explained" | W | Solve directory size recursively → base/recursive case → call stack trace → recursion vs iteration → stack overflow and depth limits in .NET → tail calls (what the CLR does and does not guarantee) → converting to explicit stack | Call-stack visual trace; honest tail-call section | Stack frames for factorial; recursion tree for Fibonacci | Tree walk; permutations; explicit-stack rewrite |
| 4 | `breadth-first-and-depth-first-search` · BFS and DFS: Two Ways to Walk a Graph | "bfs vs dfs" | C | One graph, both traversals side by side → queue vs stack → shortest path in unweighted graphs → DFS uses: cycle detection, topological sort, components → iterative DFS pitfalls → complexity | Same skeleton, one data structure swapped | Frontier expansion frames; DFS tree with edge types | Grid shortest path; topological sort; cycle detection |
| 5 | `dijkstra-shortest-path` · Dijkstra's Algorithm with PriorityQueue | "dijkstra algorithm" | B | Why BFS fails with weights → greedy idea and correctness intuition → implementation with lazy deletion (no decrease-key) → path reconstruction → negative edges and Bellman–Ford → A* in brief | Lazy-deletion pattern that .NET's queue forces, explained | Relaxation steps on a small graph | Dijkstra + path; negative-edge failure demo |
| 6 | `dynamic-programming` · Dynamic Programming: From Recursion to Tables | "dynamic programming explained" | W | Coin change by brute force → overlapping subproblems → memoize → tabulate → recover the solution → space optimization → recognising DP: LCS, knapsack, edit distance | One problem taken through every stage before generalising | Recursion tree with repeated nodes; DP table fill order | Coin change ×3; LCS with reconstruction; edit distance |
| 7 | `greedy-algorithms` · Greedy Algorithms and How to Know When They Work | "greedy algorithm" | D | Greedy coin change that fails on {1,3,4} → when greedy is right: exchange argument → interval scheduling → Huffman coding → greedy vs DP | Starts from failure; gives the proof technique | Interval scheduling timeline; Huffman tree | Interval scheduling; Huffman encoder/decoder |
| 8 | `backtracking` · Backtracking: N-Queens, Sudoku and Pruning | "backtracking algorithm" | B | State-space tree → choose/explore/un-choose → N-Queens → pruning → Sudoku solver → complexity honesty | Counts explored nodes with vs without pruning | State-space tree with pruned branches | N-Queens; Sudoku; node counters |

### 7.4 `oop-design` — OOP and Design Patterns

| # | Slug · working title | Intent | Shape | Outline | Our angle | Diagrams | Code |
|---|---|---|---|---|---|---|---|
| 1 | `four-pillars-of-oop` · Encapsulation, Inheritance, Polymorphism, Abstraction, Without the Clichés | "4 pillars of oop" | Q | What problem each solves → encapsulation as invariant protection → polymorphism via virtual dispatch (what the runtime does) → inheritance's costs → abstraction levels | No Animal/Dog; a billing domain; shows a vtable-level picture | Method table dispatch; invariant boundary | Invariant-protecting class; dispatch demo |
| 2 | `composition-over-inheritance` · Composition over Inheritance: A Refactoring | "composition vs inheritance" | D | An inheritance hierarchy that breaks on a new requirement → fragile base class → refactor to composition → when inheritance is right | Full before/after refactor, both runnable | Class diagrams before/after | Both versions |
| 3 | `solid-principles` · SOLID Principles with C# Examples That Aren't Toys | "solid principles c#" | R | Each principle: violation → consequence → fix; LSP via the real `ReadOnlyCollection`/`IList` wrinkle; DIP vs DI containers; criticisms of SOLID | Includes where SOLID is over-applied | Dependency direction before/after DIP | Five paired examples |
| 4 | `interfaces-vs-abstract-classes` · Interfaces vs Abstract Classes in Modern C# | "interface vs abstract class c#" | C | Capabilities table → default interface members → state and constructors → versioning → decision guide | Up to date with default interface methods and static abstracts | Decision flowchart | Examples of each capability incl. static abstract members |
| 5 | `strategy-observer-decorator` · Three Patterns You Already Use: Strategy, Observer, Decorator | "design patterns c#" | W | Each found in the BCL first (`IComparer<T>`, events/`IObservable<T>`, `Stream` wrappers) → then hand-built → delegates as lightweight strategy | Patterns discovered in the BCL, not memorised from a catalogue | Decorator stream chain; observer notifications | Custom comparer; event publisher; stream decorator |
| 6 | `factory-builder-singleton` · Creational Patterns: Factory, Builder, and the Trouble with Singleton | "factory pattern c#" | C | Factory method vs simple factory vs abstract factory → builder and fluent APIs (`StringBuilder`, host builders) → singleton: thread-safe `Lazy<T>`, why DI lifetimes replaced it | Honest singleton critique with testability demo | Creation flow diagrams | Factory; builder; `Lazy<T>` singleton; DI alternative |
| 7 | `dependency-injection` · Dependency Injection from First Principles | "dependency injection explained" | B | Hard-coded dependency → constructor injection by hand → composition root → lifetimes → build a 60-line container → `Microsoft.Extensions.DependencyInjection` → captive dependency bug | Builds a tiny container so the "magic" disappears | Object graph; lifetime scopes | Hand DI; mini container; captive-dependency demo |

### 7.5 `csharp-dotnet` — C# and .NET Fundamentals

| # | Slug · working title | Intent | Shape | Outline | Our angle | Diagrams | Code |
|---|---|---|---|---|---|---|---|
| 1 | `value-types-vs-reference-types` · Value Types vs Reference Types: What Really Gets Copied | "value type vs reference type c#" | I | Copy semantics experiments → stack vs heap (and why that is an implementation detail) → boxing → `ref`/`in`/`out` → `record struct`, `readonly struct` → mutable-struct pitfalls | Corrects the "structs live on the stack" oversimplification with sources | Variable→object diagrams; boxing | Copy experiments; boxing allocation measurement |
| 2 | `garbage-collection` · How the .NET Garbage Collector Works | ".net garbage collector explained" | Q | Roots and reachability → generations → LOH → mark/compact → `IDisposable` and finalizers are different things → `using` → leaks in a GC world (events, statics) → measuring | Leak demos you can run; disposal vs collection disentangled | Generational heap; reachability graph | `GC.CollectionCount`; weak reference; event-handler leak |
| 3 | `async-await` · async/await: What the Compiler Builds for You | "async await c# explained" | B | The blocking problem → tasks → what `await` does (state machine, continuation) → sync context and `ConfigureAwait` → deadlock from `.Result` → `Task.WhenAll`, cancellation → `ValueTask` → `async void` | State machine sketched by hand; classic deadlock explained precisely | Timeline of thread usage; state machine states | Sequential vs concurrent awaits timed; cancellation; exception flow |
| 4 | `linq-deferred-execution` · LINQ and Deferred Execution: When Your Query Really Runs | "linq deferred execution" | D | A bug from enumerating twice → iterators and `yield` → deferred vs immediate → build `Where`/`Select` yourself → multiple enumeration costs → `IQueryable` vs `IEnumerable` | Rebuilds LINQ operators in 30 lines | Pull-based pipeline | Own operators; side-effect trace showing order of execution |
| 5 | `generics` · Generics in C#: Constraints, Variance and Why They're Fast | "c# generics" | R | Problem generics solve (vs `object`) → constraints → reified generics vs Java erasure → covariance/contravariance with real compile errors → generic math | Variance explained through compile errors you can reproduce | Variance arrows | Constraint examples; `error=` blocks; `INumber<T>` sum |
| 6 | `strings-and-unicode` · Strings, Immutability and Unicode in .NET | "c# string immutable", "c# unicode" | I | Immutability and interning → `StringBuilder` measured → UTF-16, surrogate pairs, `Rune`, grapheme clusters → culture-sensitive comparison bugs (Turkish i) → `Span<char>` | Emoji/`Length` surprises run live; ordinal vs culture | Code unit vs code point vs grapheme | Concatenation benchmark; `StringInfo`; comparison pitfalls |
| 7 | `exceptions` · Exception Handling That Helps You Debug | "c# exception handling best practices" | Q | What to catch and where → `throw` vs `throw ex` (stack trace shown) → filters → custom exceptions → `finally`/`using` → exceptions vs result types → cost measured | Shows the destroyed stack trace side by side | Propagation up the call stack | Stack-trace comparison; filter; cost measurement |
| 8 | `span-and-memory` · Span&lt;T&gt; and Memory&lt;T&gt;: Slicing Without Allocating | "c# span" | I | Substring allocations measured → `Span<T>` as a view → `ref struct` rules and the compile errors they cause → `Memory<T>` for async → parsing example | Allocation numbers before/after | Span as window over array | CSV-line parser: string.Split vs span; `error=` examples |

### 7.6 `databases` — Databases and SQL

| # | Slug · working title | Intent | Shape | Outline | Our angle | Diagrams | Code |
|---|---|---|---|---|---|---|---|
| 1 | `relational-model-and-keys` · The Relational Model: Tables, Keys and Relationships | "relational database explained" | B | Design a small library schema from requirements → relations, tuples → primary/foreign/candidate keys → 1:N, M:N with junction → constraints as correctness | One schema reused across the pillar | ER diagram | DDL + constraint violation demos |
| 2 | `sql-joins` · SQL Joins Explained with Rows, Not Venn Diagrams | "sql joins explained" | W | Why Venn diagrams mislead → join as filtered cross product → inner/left/full/cross/self → NULL behaviour → join on non-unique keys and row multiplication → anti-joins | Row-matching diagrams; the duplicate-row bug | Row-to-row match lines | All joins with outputs |
| 3 | `indexes` · How Database Indexes Work: B-Trees and Query Plans | "how do database indexes work" | I | Full scan measured → B-tree structure → seeks vs scans via `EXPLAIN QUERY PLAN` → composite index column order → covering indexes → write cost → when indexes are not used | Real plans before/after | B-tree nodes; composite index ordering | Plans and timing on a generated table |
| 4 | `normalization` · Normalization: 1NF to BCNF on One Messy Table | "database normalization" | W | One denormalized spreadsheet → anomalies demonstrated → functional dependencies → 1NF/2NF/3NF/BCNF step by step → when to denormalize | Anomalies shown by running the bad updates | Table decomposition | Before/after schemas, anomaly queries |
| 5 | `transactions-and-acid` · Transactions, ACID and Isolation Levels | "acid transactions" | Q | Atomicity via rollback demo → consistency → isolation anomalies (dirty, non-repeatable, phantom) → levels in the SQL standard vs SQL Server/PostgreSQL defaults → durability and WAL → deadlocks | Anomaly timelines; per-engine defaults cited to vendor docs | Interleaving timelines | Rollback demo in SQL; C# two-connection demo |
| 6 | `aggregation-and-window-functions` · GROUP BY, HAVING and Window Functions | "sql window functions" | R | GROUP BY mental model → HAVING vs WHERE → window functions: ranking, running totals, LAG/LEAD → frames → top-N per group | Logical query processing order drawn out | Group collapse vs window retain rows | Progressive queries with outputs |
| 7 | `sql-injection-and-parameters` · SQL Injection and Parameterized Queries in .NET | "sql injection prevention c#" | D | A vulnerable login, exploited locally → why escaping fails → parameters → what ORMs do → least privilege | Exploit run safely against in-memory SQLite, then fixed | Query string vs parameter binding | Vulnerable vs parameterized C# |

### 7.7 `networking`

| # | Slug · working title | Intent | Shape | Outline | Our angle | Diagrams | Code |
|---|---|---|---|---|---|---|---|
| 1 | `how-the-internet-works` · What Happens When You Request a URL | "what happens when you type a url" | W | One request followed through DNS → TCP → TLS → HTTP → response; each step with the layer model attached afterwards | Every step reproduced from C# | End-to-end sequence; encapsulation | `Dns.GetHostAddresses`, raw `TcpClient` HTTP request |
| 2 | `tcp-vs-udp` · TCP vs UDP: Reliability, Ordering and Cost | "tcp vs udp" | C | Guarantees of each → handshake, sequence numbers, retransmission, flow/congestion control → UDP uses → QUIC | Loopback echo servers in both | Handshake; segment/ack timeline | TCP and UDP echo over loopback |
| 3 | `http-explained` · HTTP from the Wire Up: Methods, Status Codes, Headers, Caching | "http protocol explained" | B | Hand-write a request → methods and idempotency → status code families → caching headers → cookies → HTTP/1.1 vs 2 vs 3 | Builds a tiny HTTP server on `TcpListener` | Request/response anatomy; cache validation flow | Mini server + client on loopback |
| 4 | `dns` · DNS: How Names Become Addresses | "how dns works" | Q | Hierarchy → recursive vs iterative → record types → TTL and caching → failure modes and debugging | Troubleshooting section | Resolution walk | Record lookups from C# |
| 5 | `tls-and-https` · TLS and HTTPS: What the Padlock Guarantees | "how https works" | Q | Goals → symmetric vs asymmetric → TLS 1.3 handshake at message level → certificates and chains → what HTTPS does not protect | Accurate to TLS 1.3 (RFC 8446), not the outdated RSA-key-exchange story | Handshake; chain of trust | Local hashing/signing demos; inspect a cert via `SslStream` |
| 6 | `ip-addresses-and-subnets` · IP Addresses, Subnets and CIDR | "subnetting explained" | W | Binary addresses → masks → CIDR → computing ranges → private ranges, NAT → IPv6 essentials | Subnet calculator you build | Address/mask bit layout | CIDR calculator |

### 7.8 `operating-systems`

| # | Slug · working title | Intent | Shape | Outline | Our angle | Diagrams | Code |
|---|---|---|---|---|---|---|---|
| 1 | `processes-and-threads` · Processes vs Threads | "process vs thread" | C | What each owns → context switches → creating both from .NET → thread pool → when to use which | Observed from code, not just described | Address space with threads | `Process.Start`, threads, pool starvation demo |
| 2 | `concurrency-race-conditions-locks` · Race Conditions, Locks and Deadlocks | "race condition example" | D | A counter that loses updates → why (read-modify-write) → `lock`, `Interlocked` → deadlock reproduced → lock ordering → `SemaphoreSlim`, concurrent collections | Bugs reproduced deterministically enough to run | Interleaving; wait-for cycle | Lost update; fix; deadlock with timeout detection |
| 3 | `virtual-memory` · Virtual Memory, Paging and Why Your Process Thinks It's Alone | "virtual memory explained" | Q | Address spaces → pages, page tables, TLB → page faults → working set vs commit → memory-mapped files | Links to what Task Manager numbers mean | Translation; page table walk | Memory-mapped file; working-set observation |
| 4 | `cpu-scheduling` · CPU Scheduling: How the OS Shares Processors | "cpu scheduling algorithms" | B | Goals → FCFS, SJF, RR, priority, MLFQ → simulate them → what Windows/Linux really do (cited) | Simulator with Gantt output | Gantt charts | Scheduler simulator |
| 5 | `file-systems` · File Systems: From Bytes on Disk to Files and Folders | "how file systems work" | Q | Blocks → inodes/MFT → directories → journaling → buffering and `Flush` → why a "saved" file can still be lost | Durability pitfalls for app developers | Inode → blocks; journal | `FileStream` flush behaviour; atomic replace pattern |
| 6 | `memory-hierarchy-and-caches` · The Memory Hierarchy and CPU Caches | "cpu cache explained" | I | Latency ladder (cited) → locality → cache lines → false sharing measured → data-oriented layout | False-sharing benchmark | Hierarchy pyramid; cache line sharing | False sharing; struct-of-arrays vs array-of-structs |

### 7.9 `version-control`

| # | Slug · working title | Intent | Shape | Outline | Our angle | Diagrams | Code |
|---|---|---|---|---|---|---|---|
| 1 | `how-git-works` · How Git Works Inside: Blobs, Trees, Commits, Refs | "how git works internally" | I | Build a commit with plumbing commands → object store → refs and HEAD → why branches are cheap | Everything inspected with `git cat-file` in a real repo | Object graph | `bash run` plumbing session |
| 2 | `branching-and-merging` · Branching and Merging, Including Conflicts | "git merge explained" | W | Feature branch walk-through → fast-forward vs three-way → a real conflict resolved → merge strategies | Conflict produced and resolved by script | Commit DAGs | Scripted repo scenario |
| 3 | `rebase-vs-merge` · Rebase vs Merge: What Each Does to History | "git rebase vs merge" | C | Same starting DAG, both outcomes → interactive rebase uses → golden rule → team policies | Side-by-side DAGs from the same repo | Before/after DAGs | Scripted scenario |
| 4 | `undoing-things-in-git` · Undoing Things in Git: restore, reset, revert, reflog | "git undo commit" | Q | By situation: unstaged, staged, committed, pushed, "lost" → three trees model → reflog rescue | Organised by what went wrong | Three trees; reset modes | Each rescue scripted |
| 5 | `git-workflows` · Git Workflows: Trunk-Based, GitHub Flow, Git Flow | "git workflow" | C | Each model → trade-offs → PR hygiene → commit messages → tags and releases | Decision guide by team/release style | Branch timelines | Tagging and release-branch script |

### 7.10 `testing`

| # | Slug · working title | Intent | Shape | Outline | Our angle | Diagrams | Code |
|---|---|---|---|---|---|---|---|
| 1 | `unit-testing-fundamentals` · Unit Testing Fundamentals with xUnit | "unit testing c#" | B | What a unit test proves → AAA → a first test → naming → theories → what makes tests brittle | Real xUnit project executed by the runner | Test anatomy | xUnit project (multi-file runner mode) |
| 2 | `test-doubles` · Mocks, Stubs and Fakes: Test Doubles Without Confusion | "mock vs stub" | C | Taxonomy (Meszaros) → hand-rolled versions of each → when mocking frameworks help → over-mocking smell | Hand-rolled first so the terms mean something | Collaborator replacement | Hand-rolled doubles |
| 3 | `test-driven-development` · TDD Worked Example: Building a Bowling Scorer | "tdd example" | W | Red/green/refactor through a real kata, each step shown → when TDD helps/hurts | Every intermediate step compiles | Cycle | Stepwise evolution |
| 4 | `testing-pyramid-and-integration-tests` · The Test Pyramid and Integration Tests | "unit vs integration test" | Q | Definitions → pyramid and its critics → integration test against SQLite → flakiness causes | Balanced view incl. "testing trophy" | Pyramid | Integration test with in-memory DB |
| 5 | `property-based-testing` · Property-Based Testing: Let the Computer Find Your Edge Cases | "property based testing c#" | I | Example tests miss a bug → properties → generators and shrinking → build a tiny generator/shrinker → FsCheck/CsCheck pointer | Tiny framework built from scratch | Shrinking path | Mini property tester finds a sort bug |
| 6 | `code-coverage` · Code Coverage: What the Number Means | "code coverage explained" | D | 100% coverage suite that misses a bug → line vs branch → mutation testing idea → sensible targets | Shows a fully covered bug | Branch coverage map | Covered-but-wrong demo |

### Cross-cutting pages (wave 3)

Homepage, `/topics/` (all pillars), ten hub pages (own introduction, reading order with rationale, not just link lists), `/start-here/` with three learning paths (CS foundations for self-taught devs; .NET developer depth; interview-style fundamentals refresh), `/glossary/` (every term defined once, linking to the article that teaches it), `/search/`.

## 8. Quality gate (from the brief)

Three critics per article: technical editor, AdSense reviewer, design/UX critic. Scores 0–10 against the current top results for the target query. Pass = all three ≥ 8.5, `run-code` green, zero console errors, Lighthouse ≥ 90 in all four categories. Up to 4 rounds, then the article is cut. Scores, issues and rounds are recorded in `docs/STATUS.json` without rounding up.

## 9. Agent ownership

| Agent | May write |
|---|---|
| Integrator | `src/layouts`, `src/components`, `src/styles`, `src/pages`, `src/content/config.ts`, `src/content/{authors,pillars,glossary}`, `public`, `astro.config.mjs`, `staticwebapp.config.json`, `tools` |
| Writer for pillar *p* | `src/content/articles/<p>/` and `src/assets/diagrams/<p>/` only |
| Critics | `docs/reviews/<p>/<slug>.round-N.json` only |
| Orchestrator | `docs/STATUS.json`, `WORKLOG.md`, `CHANGELOG.md` |

Writers request shared changes by appending to `docs/INTEGRATOR_REQUESTS.md`.
