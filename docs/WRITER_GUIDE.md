# Writer guide (mechanics only)

How to get an article into the site and through the tools. What to write is in `CONTENT_PLAN.md`; this file is only about how.

You own `src/content/articles/<your-pillar>/` and `src/assets/diagrams/<your-pillar>/`. Everything else is shared: request changes in `docs/INTEGRATOR_REQUESTS.md`.

## 1. Where the file goes

`src/content/articles/<pillar>/<slug>.md` becomes `/<pillar>/<slug>/`. The slug is the file name; use the slug from `CONTENT_PLAN.md` §7. Plain Markdown only (`.md`); MDX is not enabled.

A pillar hub, its nav/footer/topics entries and its legacy redirects appear automatically once the pillar has one non-draft article. You do not create hub pages.

## 2. Front matter

Validated at build time; a violation fails `npm run build` with the field name.

```yaml
---
title: "Big-O Notation: What It Measures and What It Hides"   # 10-70 chars, no "Complete/Ultimate Guide"
description: "Learn what Big-O really bounds, how to read it off C# code, and where it misleads, with a measured case where the O(n^2) sort wins."  # 110-160 chars
pillar: complexity            # must equal the folder name
order: 1                      # position in the pillar's reading order (CONTENT_PLAN row number)
author: markus                # the only author id; do not change
published: 2026-09-20         # real date; set when the article first passes the gauntlet
updated: 2026-09-20           # >= published; change only for substantive edits
level: beginner               # beginner | intermediate | advanced
tags: [big-o, asymptotic-analysis, sorting]      # 2-6, lower-case-with-hyphens; drives "Related articles"
prerequisites: []             # ["pillar/slug", ...]; shown as "Before you read" once those are published
sources:                      # at least 2, https only, primary sources
  - title: "List<T>.Capacity Property"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.list-1.capacity"
    publisher: "Microsoft Learn"        # optional
    accessed: 2026-09-18
  - title: "Introduction to Algorithms, 4th ed., chapter 3"
    url: "https://mitpress.mit.edu/9780262046305/introduction-to-algorithms/"
    publisher: "MIT Press"
    accessed: 2026-09-18
draft: true                   # true while you work; drafts are not built, listed, indexed or in the sitemap
---
```

Unknown keys are rejected. Do **not** add a reading time: it is computed. The formula is prose words at 220 wpm, plus 2 s for each non-blank line of every code block, capped at 40 s per block; `text output` panels, diagrams and front matter count for nothing. (A 3,800-word article with 23 short Bash blocks comes out at 22 minutes.) The same formula is stated on `/editorial-policy/`. Do not write an `# H1`; the title is rendered from front matter. Start sections at `##`. Never skip a level (`##` then `####` fails the accessibility check). Only `##` and `###` appear in "On this page".

Tags are shared across pillars: reuse an existing tag when it fits (`grep -rh "^tags:" src/content/articles`), because related articles are chosen by tag overlap.

## 3. Code fences

The word(s) after the language are read by both the site and `tools/run-code.mjs`. They never appear on the page.

| Fence | Meaning | What the reader sees |
|---|---|---|
| ` ```csharp run ` | Complete file-based program (top-level statements). Compiled and run with `dotnet run`. Warnings fail unless you add `warnings`. | "C#" label, Copy button |
| ` ```csharp run id=name ` | Same, and names the program so snippets can refer to it. | same |
| ` ```text output ` directly after a `run` block | Exact expected stdout. `[...]` matches any run of characters within a line. | Dark "Output" panel attached to the program ("Result" after SQL) |
| ` ```csharp snippet of=name ` | Excerpt: every non-blank line must appear, in order, in run block `name` of the same article. `// ...` lines are ignored. | "Excerpt" label |
| ` ```csharp run error=CS0165 ` | Must fail to compile with that diagnostic. | Red "Does not compile: CS0165" label |
| ` ```csharp run throws=InvalidOperationException ` | Must end with that unhandled exception. | Red "Throws ..." label |
| ` ```csharp run fails ` | Must exit non-zero (a normal `run` block failing this way is a build failure; `fails` is the escape hatch). For a file-based **xUnit v3** test program with a deliberately-red test (a TDD red step); see below. | same |
| `args="a b"`, `stdin="text"` | Extra options for a `csharp run` block. | nothing |
| ` ```sql run ` / ` ```sql run error ` | Runs on one in-memory SQLite database per article, blocks in order. `error` means the statement must fail. | "SQL" / "Statement fails" |
| ` ```bash run ` / `fails` / `stderr` | Runs in Git Bash in one scratch directory per article, fixed Git identity and date. | "Bash" / "Exits with an error" |
| `text`, `json`, `http`, `xml`, `diff`, `console`, `il`, `asm`, `yaml`, `ini`, `csv`, `html`, `css` | Illustrative; highlighted, never executed. | language label |

Rules the tools enforce: a `csharp`/`sql`/`bash` block with neither `run` nor `snippet of=` fails; a fence with no language fails; a language not in the lists above fails; a program that prints output with no `text output` block after it fails; a `text output` block not directly after a `run` block fails. Nothing may sit between a program and its output block except blank lines.

SQL result sets must be written exactly as the tool renders them: columns padded with two spaces, a dashed rule under the header, `NULL` for nulls. Easiest: run the tool, copy the "actual" block from its failure message.

**xUnit tests** are a plain `csharp run` block, no project file or `dotnet test` needed — put `#:package xunit.v3@1.*` on its own line at the top, then `[Fact]`/`[Theory]` methods same as a normal test project (`using Xunit;` or `Xunit.Assert`/`Xunit.Fact` inline both work). It really compiles and runs as a file-based app; xUnit's own in-process runner prints a summary to stdout and the process exits 0 if every test passed. For a red/green TDD step where a test is meant to fail, add the `fails` flag so the (otherwise build-breaking) non-zero exit is expected instead. Wildcard the version banner and the `Time:` value with `[...]`, since both vary run to run; everything else — including the `Total`/`Failed` counts, which is what actually proves the test ran — is exact, and the run's assembly name is always the block's `id`, so it never needs wildcarding:

```csharp run id=stack-tests
#:package xunit.v3@1.*
using Xunit;

public class StackTests
{
    [Fact]
    public void Push_ThenPop_ReturnsLastPushed()
    {
        var stack = new Stack<int>();
        stack.Push(1);
        stack.Push(2);
        Assert.Equal(2, stack.Pop());
    }
}
```

```text output
xUnit.net v3 In-Process Runner [...]
  Discovering: stack-tests
  Discovered:  stack-tests
  Starting:    stack-tests
  Finished:    stack-tests
=== TEST EXECUTION SUMMARY ===
   stack-tests  Total: 1, Errors: 0, Failed: 0, Skipped: 0, Not Run: 0, Time: [...]
```

A deliberately-red test for a TDD red step looks the same but adds `fails` to the fence and its `Failed` count is non-zero:

```csharp run id=red-step fails
#:package xunit.v3@1.*
using Xunit;

public class StackTests
{
    [Fact]
    public void Pop_OnEmptyStack_Throws()
    {
        var stack = new Stack<int>();
        Assert.Throws<InvalidOperationException>(() => stack.Pop());
    }
}
```

```text output
xUnit.net v3 In-Process Runner [...]
  Discovering: red-step
  Discovered:  red-step
  Starting:    red-step
    StackTests.Pop_OnEmptyStack_Throws [FAIL]
      Assert.Throws() Failure: No exception was thrown
      Expected: typeof(System.InvalidOperationException)
[...]
  Finished:    red-step
=== TEST EXECUTION SUMMARY ===
   red-step  Total: 1, Errors: 0, Failed: 1, Skipped: 0, Not Run: 0, Time: [...]
```

There is no multi-file mode (a `project=`/`file=` tag scheme) yet — one `csharp run` block is one compiled program, so put the system-under-test and its tests in the same file, same as any other `csharp run` block.

Long listings for snippet-heavy articles go in a collapsible block (keep the blank lines exactly as shown):

````markdown
<details>
<summary>Full program</summary>

```csharp run id=heap
// ...
```

</details>
````

Code fonts have ligatures switched off, so `!=` and `=>` render as typed.

## 4. Callouts

```markdown
:::note
Useful but not essential context.
:::

:::warning[Optional custom title]
Ignoring this gives wrong results.
:::

:::pitfall
A mistake people commonly make.
:::

:::dotnet
How the BCL or runtime really does it. Callouts may contain code fences, lists and links.
:::

::::exercise[Optional short title]
The question. Exercises are numbered automatically per article.

:::solution
The answer, collapsed until the reader opens it. `:::solution[Show hint]` changes the label.
:::
::::
```

The outer fence of an exercise needs **four** colons because it contains a three-colon `:::solution`. Any other directive name produces a build warning and an unstyled box. Inline text such as `std::vector`, `10:30` or `key:value` is safe; it is not treated as a directive.

## 5. Diagrams

Diagrams are hand-written inline SVG inside a `<figure class="diagram">`, straight in the Markdown. They follow the light/dark theme because they use the classes below instead of literal colours. No raster images of other people's diagrams, no Mermaid.

### How the shell sizes a diagram

The shell reads the width of your `viewBox` and renders the drawing at between **0.92 and 1.2 CSS px per viewBox unit**, never less and never more. So text keeps its size: 12-unit text is never under 11 px, and a small diagram is not blown up on desktop. If the minimum size is wider than the screen, the drawing scrolls sideways inside the figure, its hidden edge fades out, and the caption stays in place.

What that means at the two widths that matter:

| viewBox width | 390 px phone (340 px of drawing) | Desktop column (700 px of drawing) |
|---|---|---|
| up to 360 | fits, no scrolling | shown at 1.2x at most, centred |
| 361 to 720 | scrolls; only the left 360 units or so are visible at first | fits |
| over 720 | scrolls | scrolls: not allowed |

`diagram-narrow` no longer does anything. It used to squeeze a 490-unit drawing into a phone, which put 12-unit labels at 7.5 px. Existing uses are harmless; do not add new ones.

### Rules for the drawing

- **Aim for a viewBox at most 360 wide.** Most readers are on phones, and a diagram that fits is always better than one that scrolls. Height is free: go as tall as you need.
- **Prefer portrait, stacked layouts.** Before/after goes top and bottom, not left and right. A pipeline runs downwards. A comparison of three things is three rows, not three columns.
- **Put annotations under (or over) the thing they describe, never beside it.** A column of notes to the right of a drawing is the first thing a phone cuts off. One or two `d-small` lines under each band works.
- **Minimum text size is 12 viewBox units (`d-small`).** Default text is 14, `d-large` is 17. Never set a smaller `font-size`, and never rely on shrinking the whole figure.
- **Budget the text.** At 12 units a sans-serif character is about 6 units wide and a `d-mono` character about 7.2, so a 360-wide drawing with 20-unit margins holds about 52 characters of `d-small` text or 44 of mono on one line. Abbreviate 40-character hashes to 7.
- **Use the full 720 only when the content is inherently wide** (a timeline, a number line, a wide tree), never wider. Put what the caption talks about in the left 360 units, because that is what a phone shows first, and keep each label next to its own shape so that any 340-unit window makes sense by itself.
- The caption must not depend on something a phone reader has to scroll to see.

### Hard rules (markup)

- **No blank lines anywhere inside the `<figure>`.** A blank line ends the HTML block and Markdown will mangle the rest.
- `viewBox` only, starting at `0 0`, with no `width`/`height` attributes and no `style` on the `<svg>`. The `<svg>` must be the first child of the figure and the `<figcaption>` the last.
- `role="img"` plus `<title>` and `<desc>` with ids unique on the page, referenced by `aria-labelledby`.
- ids (markers, titles) must be unique per page: prefix them with the diagram's name.
- No `fill="#..."`/`stroke="#..."` literals and no `<style>`; use the classes.
- Every figure has a `<figcaption>` that says what to notice.

### How to check at 390 px

Run `node tools/verify-page.mjs --drafts --no-lighthouse /<pillar>/<slug>/` and open the `mobile-light-partNN.png` and `mobile-dark-partNN.png` that contain the figure (the images are 2x, so 780 px wide). Check three things: no edge of the drawing is faded (a fade means it scrolls; if you aimed for 360 and see a fade, the viewBox is too wide); every label is readable at the size shown, including in dark; nothing the caption mentions is cut off. Then look at the same figure in `desktop-light` to see that it has not become a small island in a wide column: if it has, that is fine for a 360-wide drawing, but do not pad it out with decoration.

Classes:

| Class | Use |
|---|---|
| `d-line` | Neutral stroke, no fill (connectors, axes). Add `d-dashed` for dashes. |
| `d-box`, `d-box-2` | Neutral boxes (two fill strengths). |
| `d-box-accent` | Highlighted box in the pillar accent colour. |
| `d-box-good`, `d-box-bad`, `d-box-warn` | Semantic boxes (green/red/amber). |
| `d-accent`, `d-good`, `d-bad` | Coloured strokes, no fill (emphasised arrows and paths). |
| `d-fill-stroke`, `d-fill-accent`, `d-fill-good`, `d-fill-bad` | Solid fills, for arrowheads and dots. |
| on `<text>`: `d-muted`, `d-text-accent`, `d-text-good`, `d-text-bad` | Text colours. Default text colour needs no class. |
| on `<text>`: `d-mono`, `d-small` (12), `d-large` (17), `d-bold` | Monospace, sizes, weight. |

CSS variables, if you need them in a `style=""` attribute: `--accent` (pillar accent, theme-aware), `--d-stroke`, `--d-fill`, `--d-fill-2`, `--d-text`, `--d-text-muted`, `--d-good`, `--d-good-fill`, `--d-bad`, `--d-bad-fill`, `--d-warn`, `--d-warn-fill`, and the page tokens `--bg`, `--bg-subtle`, `--border`, `--text`, `--text-muted`.

Copy-paste starting point (360 wide, stacked, annotation underneath):

```html
<figure class="diagram">
<svg viewBox="0 0 360 200" role="img" aria-labelledby="ring-title ring-desc">
<title id="ring-title">Two array slots and a pointer between them</title>
<desc id="ring-desc">An occupied slot at the top points down to a highlighted slot; a label underneath explains the step.</desc>
<defs>
<marker id="ring-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-accent"/></marker>
</defs>
<rect x="20" y="16" width="160" height="48" rx="6" class="d-box"/>
<text x="100" y="45" text-anchor="middle" class="d-mono">items[0]</text>
<path d="M100 64 V106" class="d-accent" marker-end="url(#ring-arrow)"/>
<text x="112" y="90" class="d-text-accent d-small">head moves</text>
<rect x="20" y="110" width="160" height="48" rx="6" class="d-box-accent"/>
<text x="100" y="139" text-anchor="middle" class="d-mono d-bold">items[1]</text>
<text x="20" y="184" class="d-muted d-small">Step 1: the head index advances by one slot</text>
</svg>
<figcaption>Figure 1. One sentence saying what the reader should notice.</figcaption>
</figure>
```

Two full working examples (a 360-wide stacked diagram and a 720-wide scrolling one) are in `src/content/articles/complexity/zz-layout-fixture.md`; see them rendered at `/styleguide/`.

## 6. Links

- Other articles: root-relative with trailing slash, `[binary search](/algorithms/binary-search/)`; sections as `/algorithms/binary-search/#lower-bound`. Heading ids are the GitHub-style slug of the heading text.
- Linking to an article that is not published yet breaks the link check. Until the target exists, write the sentence without the link and leave a request in `docs/INTEGRATOR_REQUESTS.md` for wave 3 cross-linking.
- Glossary: `[amortized](/glossary/#amortized-analysis)`. The id is the file name in `src/content/glossary/`. Link a term once, at first use. To add a term, request it in `docs/INTEGRATOR_REQUESTS.md` with the term, a definition in your own words and the article that teaches it.
- External links are plain Markdown links. Every source you rely on also goes in `sources`.
- Tables are plain GFM tables; they get a scroll container automatically. Use `---:` to right-align numeric columns. See section 7 for what a table does on a phone.

## 7. Phone width (390 px)

Most readers arrive on a phone. The text column there is about 358 px wide. Nothing you write can break the page width, because code, output panels, tables and diagrams each scroll sideways inside their own box, with the hidden edge faded out as the cue. But what sits beyond the fade is not read by most people, so write for what is visible.

- **About 40 characters of code are visible** in a code block or output panel (about 34 inside a callout or exercise), and the last four or five of those sit under the fade. Longer lines are fine when the tail is boilerplate; they are not fine when the tail is the point.
- **Keep the operative part of a line on screen.** Wrap long statements so the part the prose talks about is within the first 40 columns: break a shell pipeline after `|` or with a trailing backslash, break a C# call chain before each `.Method(`, put each SQL clause on its own line, and move long string literals to a variable. If the section is about `sha1sum`, the word `sha1sum` must be visible without scrolling.
- **Keep output panels to 40 columns or fewer when the columns matter.** Narrow the format widths (`{x,8}` rather than `{x,15}`), drop a column the prose never mentions, shorten hashes with `--abbrev=7` or `cut -c1-7`, and shape command output with `awk`/`cut` in the command itself. If the last column is the evidence for a claim, it must not be the one that is cut off.
- **No long inline code in prose.** Inline code of 25 characters or fewer never wraps, and longer inline code breaks only at spaces, after `.` `_` `/` `,` `(` and between camelCase words. That keeps it readable, but a 60-character expression in the middle of a sentence still makes a ragged paragraph on a phone: put it in a code block instead. Write ASCII arrows and operators in backticks (`old -> new`), because outside code a `->` can split across lines.
- **Tables:** on a phone a table is as wide as its content needs and scrolls; a column whose longest cell is 40 characters or fewer never wraps. Four columns of sentences will put half the table off-screen. Prefer at most three columns, keep cells to a phrase rather than a sentence, put the identifying column first, and if each row is really a short paragraph, use a list or sub-headings instead.
- Diagrams: section 5.

Check by opening the `mobile-*` screenshots from `verify-page`. A faded right edge on a block means content is hidden there; decide each time whether that matters.

## 8. Running the tools

Use PowerShell or cmd for `verify-page` (Git Bash rewrites arguments that start with `/`).

```text
node tools/run-code.mjs src/content/articles/<pillar>/<slug>.md
node tools/run-code.mjs --pillar <pillar>

node tools/verify-page.mjs --drafts /<pillar>/<slug>/          (drafts need --drafts)
node tools/verify-page.mjs --drafts --no-lighthouse /<pillar>/<slug>/     (fast screenshot pass)
node tools/verify-page.mjs --external /<pillar>/<slug>/        (also checks external links)
```

`verify-page` makes its own private build, so it is safe while others work. It writes `.verify/<pillar>__<slug>/`: for each of desktop/mobile x light/dark an above-the-fold image (`<device>-<theme>-fold.png`) and the whole page in numbered segments (`<device>-<theme>-partNN.png`), plus `lighthouse.json` and `report.json`. Open the screenshots and look at them. The `fig=` number in its output counts `<figure>` elements in the page body.

`run-code` fails on: compile errors or warnings, non-zero exit, output that differs from the `text output` block (trailing spaces are ignored, everything else is exact), unexpected output with no output block, wrong or missing expected error/exception, snippet lines not found in order, unlabelled or unknown-language fences, runs over 180 s.

`verify-page` fails on: broken internal links or anchors, broken external links (with `--external`), any console or network error, the placeholder words `lorem ipsum`, `coming soon`, `TBD`, `XXXXXXXX`, `NEEDS_MARKUS` inside `<main>`, not exactly one `<h1>`, horizontal overflow at 390 px, and any Lighthouse category under 90.

Expected for now: every article page fails the placeholder check because the byline shows `NEEDS_MARKUS(#1 ...)` until the owner supplies the author name. That single failure is accepted; nothing else is.

`npm run build` must stay green. A schema error in one article breaks the build for everyone, so build before you hand off.
