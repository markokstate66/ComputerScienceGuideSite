# Goal
Give computerscienceguide.com a full facelift and content build-out so it passes Google AdSense review. The bar is best-in-class technical education: every article should be able to sit next to MDN, Real Python, or Microsoft Learn on the same topic and not look worse. Accurate, original, genuinely useful, well-designed, fast. Never thin, never filler, never "AI slop."

AdSense rejects sites for "low value content," thin pages, poor navigation, missing trust pages, copied content, and policy violations. Every decision below is aimed at eliminating those failure modes.

# How to work
1. Audit and plan first. Before touching content, inspect the existing repo and live site and write AUDIT.md: current stack, page inventory, word counts, broken links, Lighthouse scores, missing pages, and anything that would fail AdSense review. Then write CONTENT_PLAN.md:
   - Topic pillars (e.g. data structures, algorithms, complexity/Big-O, OOP and design patterns, C#/.NET fundamentals, databases/SQL, networking, operating systems, version control, testing). Each pillar gets a hub page plus 5–8 in-depth articles, for 40+ substantial articles total.
   - For each article: target search intent, working title, outline, the unique angle (what we add that the top results don't), required diagrams, and runnable code samples.
   - A shared content model (front matter schema: title, description, author, published/updated dates, pillar, tags, reading time, sources).
   - A design system (typography, code blocks with copy button, callouts, diagrams, dark/light theme, responsive layout).
   - Technical SEO: sitemap.xml, robots.txt, canonical URLs, structured data (Article, BreadcrumbList), Open Graph, clean URLs, 404 page.
   - Keep the existing stack unless the audit shows a strong reason to change. If rebuilding, use a static site deployable to Azure Static Web Apps.
   - Code examples default to C#/.NET (my real expertise), with Python only where the topic clearly calls for it.

2. Build the verification loop before content. A tool that builds the site, serves it locally, and for any page writes: a headless-Chrome screenshot (desktop + mobile, light + dark), a Lighthouse report (performance, accessibility, SEO, best practices), a link check, word count, and a JSON log of console errors. A second tool extracts every code block from an article and actually compiles/runs it, failing on any error or on output that doesn't match what the article claims. No agent may claim anything it hasn't built, run, screenshotted, and looked at.

3. Fan out. Use multi-agent orchestration. Run in waves:
   (1) Site shell: design system, layout, navigation, search, trust pages (About, Contact, Privacy Policy, Terms, Editorial Policy / how content is made), technical SEO plumbing.
   (2) Content: one writer agent per pillar, each owning only its pillar folder. Writers research from authoritative primary sources (official docs, textbooks, specs), then write in their own words with original examples, diagrams, and exercises.
   (3) Integration: hub pages, cross-linking between related articles, glossary, "start here" learning paths, homepage.
   Between waves, one integrator agent (the only one allowed to touch shared layout, navigation, sitemap, and global styles) applies requested changes and fixes seams.

4. Gauntlet every article and every page. After each writer round, three separate critics (none of them write content) review independently:
   - Technical editor: a senior CS professor/engineer. Checks correctness, depth, clarity, whether code runs, whether complexity claims are right, whether anything is vague, hand-wavy, or padded.
   - AdSense reviewer: plays the Google policy reviewer. Checks for thin content, filler intros, keyword stuffing, repetitive templated structure across articles, copied or closely paraphrased text, missing sources, navigation dead-ends, and anything that reads as mass-produced.
   - Design/UX critic: checks screenshots at desktop and mobile, readability, code block rendering, diagram quality, Lighthouse scores.
   Each scores 0–10 against the top-ranking pages for the same query: 10 = clearly better than the best existing result, 8.5 = equal to MDN/Real Python quality with nits, 7 = decent personal blog, 5 = thin or generic filler. Pass = ≥8.5 from all three critics, all code runs, zero console errors, Lighthouse ≥90 on every category. Below that, the writer gets the ranked issue list and goes again, up to 4 rounds. Articles that still fail after 4 rounds are cut, not published.

5. Final gate. A whole-site critic performs a full AdSense-readiness audit: every page reachable within 3 clicks from home, no empty or "coming soon" sections, no placeholder text, all trust pages present and real, consistent authorship, ads.txt ready. Then blind judges get pairs of articles labelled only A and B (ours vs. the current #1 Google result for the same query, order shuffled) and say which is more useful and why. We need to win or tie on a clear majority.

6. /loop until every critic passes. Persist per-article scores, open issues, and round counts to docs/STATUS.json so each iteration resumes from the weakest article, not from scratch. Keep WORKLOG.md and CHANGELOG.md current.

# Rules
- Never inflate scores. Report real numbers, failed rounds, cut articles, and what is still missing.
- Never fabricate anything: no invented facts, statistics, quotes, benchmarks, testimonials, credentials, author bios, or "years of experience." Every non-obvious factual claim cites a real, checked source.
- Never copy. No text lifted or lightly reworded from other sites, docs, or books. Explanations, examples, and diagrams must be original.
- Every code sample must compile and run exactly as shown. No pseudocode presented as working code.
- No filler: no generic intros ("In today's fast-paced world..."), no restating the title, no padding to hit word counts. Length comes from depth, examples, and exercises.
- Vary structure across articles. Identical templates repeated 40 times is a mass-production signal.
- No doorway pages, no keyword stuffing, no near-duplicate articles targeting minor keyword variants.
- Do not add AdSense ad code or ad placeholders. Only prepare ads.txt and a clearly marked spot for the verification snippet.
- Never edit another writer's pillar folder. Shared changes go through the integrator.
- Keep the local site building and servable at all times; other agents are screenshotting it.
- Do not ask me questions. Make routine decisions yourself, state assumptions, keep going. Anything only I can supply (legal business name, contact email, real author bio facts, privacy policy specifics like analytics in use) goes in docs/NEEDS_MARKUS.md with a clearly marked placeholder. Never invent it.

Start now.
