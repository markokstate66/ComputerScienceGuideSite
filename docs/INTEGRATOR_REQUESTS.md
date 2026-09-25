# Integrator requests

Writers and critics: append requests for shared changes here (layout, components, global styles, navigation, config, tools). Do not edit shared files yourself. Format:

```text
## <date> <pillar>/<slug> — <short title>
What is needed and why. Status: open | done (<what was changed>)
```

## 2026-09-18 Shell fixes from the round-1 design reviews of the three pilot articles: done

Raised in `docs/reviews/*/*.round-1.design.json` (owner "integrator") and by the editor. All ten are done; details in `docs/SHELL_NOTES.md` ("Wave 2 shell fixes"), writer-facing rules in `docs/WRITER_GUIDE.md` sections 2, 5, 7.

1. Output/result panels inside callouts and solutions were light text on a light background in the light theme. Status: done (removed the `.callout .code-block` background override in `global.css`; the fixture now nests a panel in note, warning, pitfall, dotnet, exercise and solution).
2. No cue that code, output, tables or diagrams scroll sideways on phones. Status: done (the hidden edge fades out; `site.ts` + `.fade-l/.fade-r` in `global.css`).
3. Tall blank table rows on phones. Status: done (`rehype-article` classes columns by longest cell; short columns never wrap, long ones get a min-width).
4. Inflated reading time. Status: done (220 wpm + 2 s per non-blank code line, max 40 s per block, output panels free; stated in the writer guide and editorial policy).
5. "On this page" dropped a trailing "#" ("... in C#" became "... in C"). Status: done (`Toc.astro`).
6. Inline code broke mid-token on phones. Status: done (`rehype-article` + `global.css`: code of 25 characters or fewer never wraps; longer code breaks at spaces, after `. _ / , (` and between camelCase words).
7. Articles ended in a dead end. Status: done ("Keep reading" block on every article; the layout fixture is no longer offered as prev/next/related of real articles).
8. `verify-page` reported `fig=4` for two figures. Status: done (counts `<figure>` elements in `<main>` only).
9. Diagrams clipped (720 wide) or illegible (`diagram-narrow`) on phones. Status: done (shell renders every diagram at 0.92 to 1.2 px per viewBox unit and scrolls it if needed; `diagram-narrow` is now a no-op; new rules in writer guide section 5: aim for viewBox <= 360 wide, 12-unit minimum text, stacked layouts, annotations underneath). **Writers still have to redraw the pilot figures to those rules**: the shell makes them legible and scrollable, it cannot make a 490- or 720-wide drawing fit a phone.
10. Phone-width guidance for code, output, inline code and tables. Status: done (writer guide section 7).

## 2026-09-24 Wave-B fan-out (issues #125-#131): glossary terms and one shell item

Raised by the writers of the seven new articles (full text in their workflow results; definitions are the writers own words, to be edited by the integrator). Status: open for all.

- **csharp-dotnet/exceptions** (#125): Glossary term request (docs/INTEGRATOR_REQUESTS.md, needed for A-11 per CONTENT_PLAN §5): term "exception" — definition in my own words: "An object, derived from System.Exception, that represents an error condition and carries it up the call stack until a matching catch clause handles it or the process ends. Throwing one interrupts normal control flow immediately, unwinding stack frames as it goes." seeAlso: csharp-dotnet/exceptions. I did not link to it from the body since the term does not exist yet (check-article's glossary-link check fails on that); once added, the natural first-use point is the sentence beginning "An exception that isn't caught anywhere doesn't vanish..." in the "Which layer should catch this?" section. Status: open
- **csharp-dotnet/span-and-memory** (#126): Glossary term request: "span" — a lightweight, type-safe view over a contiguous block of memory (an array, a string's characters, or stack memory), stored as a reference plus a length, that lets code read or write that memory without copying it. Taught in csharp-dotnet/span-and-memory; no existing glossary entry covers it. Status: open
- **csharp-dotnet/span-and-memory** (#126): Glossary term request: "ref struct" — a struct type restricted to the stack: an instance can't be boxed, stored in a heap object's field, captured by a lambda, or kept alive across an await/yield, which guarantees any pointer-like data it holds never outlives what it points at. Taught in csharp-dotnet/span-and-memory; no existing glossary entry covers it. Status: open
- **databases/aggregation-and-window-functions** (#127): Glossary term request: "window function" - definition in my own words: "A SQL function, marked with an OVER clause, that computes a value for each row from a set of related rows (its partition, and optionally a frame) without collapsing those rows into one, unlike an aggregate used with GROUP BY." Taught in databases/aggregation-and-window-functions. Status: open
- **databases/aggregation-and-window-functions** (#127): Glossary term request: "aggregate function" - definition in my own words: "A SQL function such as COUNT, SUM, AVG, MIN or MAX that folds every row of a group (or, given an OVER clause, every row of a window frame) down to a single value." Taught in databases/aggregation-and-window-functions. Status: open
- **databases/sql-injection-and-parameters** (#128): Glossary term request: `sql-injection` (module A-14, per docs/ARTICLES_PLAN.md §5). Suggested definition in my own words: "A vulnerability where untrusted input is concatenated into a SQL command's text instead of being kept separate from it, letting that input change the structure of the query the database runs rather than just supplying a value. Parameterized queries and prepared statements prevent it by sending the query text and each value to the database separately." seeAlso: databases/sql-injection-and-parameters. Status: open
- **networking/ip-addresses-and-subnets** (#129): Glossary term "cidr": first use in the "prefix length" section; suggested definition in docs/crosslinks/networking/ip-addresses-and-subnets.md. Status: open
- **networking/ip-addresses-and-subnets** (#129): Glossary term "private-ip-address": first use in "Address space nobody has to hand out"; suggested definition in the same crosslinks file. Status: open
- **networking/ip-addresses-and-subnets** (#129): Design round-2 minor (integrator-owned, unchanged since round 1): the opening web/database/management results table's "Usable addresses" column is cropped at the 390px mobile viewport (page-level mobileOverflowPx is 0, so it's the table component's own horizontal scroll, not a Markdown/layout break). Needs a shell/table-component fix — let the range wrap to a second line in its cell, or tighten the three columns to fit 390px — since this is the first content block a mobile reader hits and is outside what the writer's Markdown controls. Status: open
- **testing/code-coverage** (#131): Glossary term needed: `code-coverage` — a measurement of how much of a program's source ran during testing, usually as lines, branches, or methods executed divided by the total; it says a line ran, never that its result was checked or correct. Taught by testing/code-coverage. Status: open
- **testing/code-coverage** (#131): Glossary term needed: `mutation-testing` — evaluating a test suite by deliberately inserting a small, deliberate change (a 'mutant') into the code under test and checking whether any test then fails; a mutant that makes every test still pass 'survived' and reveals a gap the suite's coverage numbers couldn't show. Taught by testing/code-coverage. Status: open

## 2026-09-22 data-structures/tries — new glossary term (restored 2026-09-24; dropped by the batch-ship conflict rule)

`tries.md` (issue #107) is the first article to use the term "trie" as a core concept, and no glossary entry exists yet for it. Status: open.

- **Term:** trie
- **Definition:** A tree that stores a set of strings one character per edge, so every string that shares a prefix with another shares the path down to where they diverge; a node marks the end of a stored word, not necessarily a leaf, so one stored word can sit on the path to a longer one (`do` on the path to `dot`).
- **Aliases:** prefix tree, digital tree
- **Taught by:** `data-structures/tries`
