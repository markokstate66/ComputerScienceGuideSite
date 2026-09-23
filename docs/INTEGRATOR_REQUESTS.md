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

## 2026-09-22 data-structures/tries — new glossary term

`tries.md` (issue #107) is the first article to use the term "trie" as a core concept, and no glossary entry exists yet for it. Status: open.

- **Term:** trie
- **Definition:** A tree that stores a set of strings one character per edge, so every string that shares a prefix with another shares the path down to where they diverge; a node marks the end of a stored word, not necessarily a leaf, so one stored word can sit on the path to a longer one (`do` on the path to `dot`).
- **Aliases:** prefix tree, digital tree
- **Taught by:** `data-structures/tries`
