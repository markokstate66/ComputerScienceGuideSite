# Editorial brief

For writers and critics. Mechanics (front matter, fences, callouts, diagrams, tools) are in `docs/WRITER_GUIDE.md`. The article list, outlines and angles are in `CONTENT_PLAN.md` §7. This file is about quality.

## The bar

Put the article next to the best existing page for its target query (MDN, Microsoft Learn, Real Python, a good university course note). A reader who opens both should find ours at least as accurate, at least as deep, clearer, and better illustrated. If it is merely "fine", it fails.

## Hard rules

1. **Nothing fabricated.** No invented statistics, benchmarks, quotes, history, anecdotes, credentials or personal experience. The byline is a real person; do not put words in his mouth ("in my 10 years…", "at my last job…"). Write in a direct second-person/neutral voice.
2. **Measured numbers must be real.** If the article says "this took 41 ms", that number came from running the program on this machine, the article says so, and timing lines in output blocks use `[...]` wildcards so the check is about shape, not the digits. Describe results qualitatively where exact values vary ("roughly ten times slower on this machine").
3. **Every non-obvious factual claim has a primary source**, fetched and read during research: official documentation (learn.microsoft.com, the dotnet/runtime source on GitHub, sqlite.org, postgresql.org, git-scm.com), RFCs, language specifications, original papers, standard textbooks (CLRS, Sedgewick, Tanenbaum, Kurose & Ross, Silberschatz, Gamma et al., Meszaros). Blogs, Stack Overflow, Wikipedia, GeeksforGeeks, W3Schools and tutorial sites are not sources. List every source in front matter with the date accessed; cite inline where the claim is made. Do not cite a page you did not open. For textbooks you cannot open, cite only well-known, uncontroversial facts and name the chapter, not a page number you cannot verify.
4. **Never copy or closely paraphrase.** Read sources to understand, close them, then write from understanding. Examples, variable names, datasets, analogies and diagrams are our own. Do not reuse a source's running example.
5. **All code runs.** `node tools/run-code.mjs <file>` must pass before you hand in. Complete programs with their real output. No pseudocode dressed as C#. Modern idiomatic C# (file-based programs with top-level statements, .NET 10): collection expressions, pattern matching, `var` where the type is obvious, nullable reference types respected, no warnings.
6. **No filler.** First sentence delivers something. No "In today's world", no restating the title, no "In this article we will", no "Let's dive in", no summary that repeats the headings, no conclusion paragraph that says nothing. Length comes from depth: worked examples, edge cases, failure modes, measurements, exercises.
7. **Vary the structure.** Follow the shape assigned in the plan (W/B/I/C/D/R/Q). Do not give every article the same heading set. No boilerplate "Introduction"/"Conclusion"/"Key takeaways" headings; headings should be specific to the content. Exercise sections may recur, but vary their form (predict-the-output, find-the-bug, extend-the-code, prove-it, measure-it).
8. **No keyword stuffing, no doorway content.** Write the title and description for a human.
9. Stay inside your pillar folder. Link to other articles only if they are listed in `CONTENT_PLAN.md`, using their planned URL `/<pillar>/<slug>/`; the integrator resolves links to cut articles later.

## Lessons from the pilot round (binding)

These came from real critic findings on the first three articles. Every one cost an article its pass.

- **Generalisations get checked.** "The only file Git creates", "everything else can be rebuilt", "that text is the entire commit", "SQL has no ANTI JOIN": critics tested these and found counter-examples. Before writing *only/always/never/entire/every*, test it or scope it ("in standard SQL", "in a default repository", "for an Add-only sequence").
- **A reader's machine is not the verification harness.** The harness pins `init.defaultBranch=main`, a fixed identity and dates. If an example depends on such a setting, make the article set it explicitly (for example `git init -b main`) so a reader who follows along gets the same result.
- **Shell blocks are one session.** The working directory carries over between `bash run` blocks; `cd` once, as a reader would.
- **Cite where the claim is made**, and make sure that page supports that clause. A source in the list that is never cited inline, or a citation attached to a sentence its page does not support, is a finding. If a proof or construction follows a textbook or lecture closely (for example the three-coin banker's argument), say so inline.
- **Every algorithm named gets its cost**, and the conditions under which it applies.
- **State the toolchain once, where measurements appear** (runtime version, OS and CPU class, e.g. ".NET 10.0.x on Windows 11, x64 laptop"), in your own words and not as a stamped opening sentence. Do not open articles with a provenance sentence of the form "every block on this page was run with…"; the site says that globally.
- **No "what most people think" claims** unless sourced. No asserted experience ("this fails in production", "the two are confused constantly").
- **Do not give away exercises.** A predict-the-output exercise must not show the output panel under the question; the program and its output go inside the solution.
- **Vary the ending.** Do not title the last section "Exercises" with a first item called "Predict the …" on every article. Name the section for what it practises, vary the first exercise's form, and place exercises mid-article where they fit the flow.
- **Phones.** Around 40 characters of code are visible at 390 px. Keep output panels to 40 columns when the columns carry the point; break long statements so the operative part is not clipped; do not put long expansions in inline code (use a block). Diagrams must follow the phone rules in `docs/WRITER_GUIDE.md`: labels legible at 390 px, annotations under the drawing rather than beside it, and nothing essential off-screen.
- **Cross-links.** In the body, link only to pages that exist in the build (the link checker fails otherwise). Record the links you want to planned-but-unpublished articles in `docs/crosslinks/<pillar>/<slug>.md` (one line each: anchor text, target route, where in the article). The integrator wires them in wave 3. Critics do not penalise missing links to unpublished siblings when this file exists and is sensible.

## Writing style

- Precise over chatty. Define each term once, at the point of first use, in plain words, then use it consistently.
- Show, then tell: a concrete case before the general rule wherever the shape allows.
- State complexity claims exactly: which operation, which case (worst/expected/amortized), which assumption.
- Say what goes wrong in practice: the bug people actually write, the misconception people actually hold, the limit of the technique.
- Distinguish specification from implementation detail. If something is true of current .NET but not guaranteed, say so and cite it.
- Diagrams earn their place: they show structure or motion that prose cannot. Every figure has a caption that says what to notice, and accessible `<title>`/`<desc>`. Labels are legible at 390 px width.
- Exercises have worked solutions (collapsed). Solution code is verified like everything else.
- British/American: use American spelling in articles.

## Critic rubrics

All critics score 0–10 against the current top results for the target query and must justify the score with specific evidence. Anchors: **10** clearly better than the best existing result · **8.5** equal to MDN/Real Python quality with only nits · **7** decent personal blog · **5** thin or generic filler · **3** wrong or misleading. Do not round up. A single factual error caps the technical score at 7; a code sample that does not run caps it at 5. Critics never edit articles; they return a ranked issue list where each issue names the location, the problem, and what "fixed" looks like.

**Technical editor** (senior CS professor/engineer). Verify claims against primary sources yourself; re-derive complexity claims; read every program for correctness, edge cases and idiom; run `tools/run-code.mjs` on the article and report the real result; check that cited sources exist and say what the article says they say; flag vagueness, hand-waving, missing caveats, padding, and anything a strong student would find unsatisfying.

**AdSense reviewer** (Google policy reviewer looking for low-value content). Judge originality and value-add over existing results; filler intros/outros; templated or repetitive structure compared with sibling articles in the same pillar (open two or three and compare headings and phrasing); keyword stuffing; near-duplicate coverage; copied or closely paraphrased passages (spot-check distinctive sentences with web search); missing or weak sourcing; unsupported claims; navigation dead-ends; anything that reads as mass-produced or machine-generated boilerplate; policy problems.

**Design/UX critic.** Run `tools/verify-page.mjs` on the article's route and open the screenshots (desktop and mobile, light and dark, full-page). Judge readability, hierarchy, code block rendering and overflow, output blocks, diagram legibility and theme-correctness in both themes, table behaviour on mobile, callout use, rhythm of text vs. code vs. figures, walls of text, and report the real Lighthouse numbers, console errors and link failures from `report.json`. Distinguish article-level issues (writer fixes) from shell-level issues (append to `docs/INTEGRATOR_REQUESTS.md`).

**Pass** = all three ≥ 8.5, `run-code` green, zero console errors, Lighthouse ≥ 90 in all four categories. Maximum 4 rounds, then the article is cut.
