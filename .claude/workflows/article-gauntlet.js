export const meta = {
  name: 'article-gauntlet',
  description: 'Write each planned article, then run it through three independent critics for up to 4 rounds',
  phases: [
    { title: 'Write', detail: 'one writer per article, confined to its pillar folder' },
    { title: 'Review', detail: 'technical editor, AdSense reviewer, design/UX critic' },
  ],
}

const REPO = 'C:\\Users\\marko\\source\\repos\\ComputerScienceGuideSite'
const today = args.today
const MAX_ROUNDS = args.maxRounds ?? 4

const COMMON = `Repo: ${REPO} (Windows; PowerShell is the primary shell, Git Bash exists; Node 24; .NET 10 SDK; no Python). Branch adsense-rebuild. Never commit, push, stash, or switch branches. Today is ${today}. Other agents are working in this repo at the same time on other articles: touch only the files you are told you own, and never delete .verify output belonging to other pages.`

const WRITER_SCHEMA = {
  type: 'object',
  properties: {
    file: { type: 'string' },
    proseWords: { type: 'number' },
    codeBlocksExecuted: { type: 'number' },
    runCodePass: { type: 'boolean' },
    buildPass: { type: 'boolean' },
    sourcesOpened: { type: 'array', items: { type: 'string' } },
    changesThisRound: { type: 'string' },
    issuesNotFixed: { type: 'array', items: { type: 'string' } },
    integratorRequests: { type: 'array', items: { type: 'string' } },
  },
  required: ['file', 'runCodePass', 'buildPass', 'changesThisRound'],
}

const ISSUES = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      severity: { type: 'string', enum: ['blocker', 'major', 'minor'] },
      location: { type: 'string' },
      problem: { type: 'string' },
      fixLooksLike: { type: 'string' },
      owner: { type: 'string', enum: ['writer', 'integrator'] },
    },
    required: ['severity', 'location', 'problem', 'fixLooksLike', 'owner'],
  },
}

const CRITIC_SCHEMA = {
  type: 'object',
  properties: {
    score: { type: 'number' },
    comparedAgainst: { type: 'array', items: { type: 'string' } },
    justification: { type: 'string' },
    issues: ISSUES,
    runCodePass: { type: 'boolean' },
    consoleErrors: { type: 'number' },
    brokenLinks: { type: 'number' },
    lighthouse: {
      type: 'object',
      properties: { performance: { type: 'number' }, accessibility: { type: 'number' }, bestPractices: { type: 'number' }, seo: { type: 'number' } },
    },
  },
  required: ['score', 'comparedAgainst', 'justification', 'issues'],
}

function writerPrompt(a, round, reviews) {
  const path = `src/content/articles/${a.pillar}/${a.slug}.md`
  const base = `${COMMON}

You are the WRITER for one article on computerscienceguide.com: pillar "${a.pillar}", slug "${a.slug}" (file ${path}, route /${a.pillar}/${a.slug}/). You own ONLY that file. Inline SVG diagrams live inside it.

Read first, fully: docs/EDITORIAL_BRIEF.md (quality rules, binding), docs/WRITER_GUIDE.md (mechanics, binding), and your row in CONTENT_PLAN.md section 7 (intent, title, shape, outline, angle, diagrams, code). Skim src/content/articles/complexity/zz-layout-fixture.md for working syntax. Look at sibling files already in src/content/articles/${a.pillar}/ (if any) so your structure and phrasing do not mirror theirs.`
  if (round === 1) {
    return `${base}

Round 1: research and write the article.
1. Find and READ the pages currently ranking best for the target query (WebSearch + WebFetch) to learn the bar and find what they lack. Do not borrow their wording, examples, or structure.
2. Research from primary sources and open every source you will cite. Record only sources you actually opened.
3. Write the article with front matter exactly per the schema: author "markus", published and updated ${today}, draft: true (the orchestrator flips it when the article passes). Original examples, original inline SVG diagrams, exercises with verified solutions.
4. Every number you report as measured must come from actually running the program here; say it is machine-specific and use [...] wildcards for varying digits in output blocks.
5. Verify, from PowerShell: \`node tools/run-code.mjs ${path}\` must pass; \`npm run build\` must pass; \`node tools/verify-page.mjs --drafts /${a.pillar}/${a.slug}/\` must show zero failures other than the expected "placeholder text: NEEDS_MARKUS" (the byline placeholder, which is not yours to fix). Then OPEN the screenshot parts in .verify/${a.pillar}__${a.slug}/ with the Read tool (desktop-light and mobile-dark at minimum, every part) and fix what looks wrong: diagram legibility at phone width, overflowing code lines you could wrap, walls of text.
6. Re-read the finished article once as a sceptical expert and once as the target reader. Cut filler. Fix vagueness.
Shared layout/components/tools are not yours: put requests in your return value (integratorRequests), do not edit them.
Return the structured result honestly; runCodePass/buildPass must reflect the final real run.${a.note ? `

Note for this article: ${a.note}` : ''}`
  }
  return `${base}

Round ${round}: REVISE the existing article. Three independent critics reviewed the previous round. Their ranked issues (JSON) follow. Fix every blocker and major issue owned by "writer", and minors where sensible; if you believe an issue is factually mistaken, check a primary source and either fix or list it in issuesNotFixed with the evidence. Do not pad. Keep \`updated\` as ${today}.

Since round 1 the shared rules changed; re-read docs/EDITORIAL_BRIEF.md section "Lessons from the pilot round (binding)" and the phone-width and diagram sections of docs/WRITER_GUIDE.md (rewritten by the integrator, who also fixed the shell-level issues: scroll affordances, reading time, callout-nested output panels, end-of-article navigation). Apply all of it to this article. In particular: shell blocks now share one session (the working directory carries over, so remove repeated \`cd\` lines); record desired links to unpublished siblings in docs/crosslinks/${a.pillar}/${a.slug}.md (you own that file too) instead of linking them; redraw diagrams to the new phone rules. Then repeat the full verification from round 1 step 5 and look at the screenshots again.

REVIEWS:
${JSON.stringify(reviews, null, 1)}`
}

function criticPrompt(kind, a, round) {
  const path = `src/content/articles/${a.pillar}/${a.slug}.md`
  const out = `docs/reviews/${a.pillar}/${a.slug}.round-${round}.${kind}.json`
  const head = `${COMMON}

You are an independent CRITIC (${kind}) in a quality gauntlet. You never edit articles, layouts or tools. The only file you may write is ${out} (your full review as JSON, same content as your structured return value). Article under review: ${path}, route /${a.pillar}/${a.slug}/, round ${round}. Target query and intended angle: see its row in CONTENT_PLAN.md section 7.

Read docs/EDITORIAL_BRIEF.md: the hard rules and the rubric for your role are binding. Score 0-10 against the pages that currently rank best for the target query; find and actually read at least two of them (WebSearch/WebFetch) and list them in comparedAgainst. Anchors: 10 clearly better than the best existing result; 8.5 equal to MDN/Real Python quality with only nits; 7 decent personal blog; 5 thin/generic. Never inflate: an undeserved pass costs the site its review. Never deflate to look tough: if it is genuinely at the bar, say so. Use one decimal place. Every issue must name a location, the problem, and what fixed looks like, ranked most severe first. Known and NOT an issue: the byline shows a NEEDS_MARKUS placeholder (owner-supplied later), the article is draft: true, and a draft "Layout Fixture" article may appear in lists.${round >= 2 || args.lessons ? `
Also binding: the section "Lessons from the pilot round" in docs/EDITORIAL_BRIEF.md. Missing body links to planned-but-unpublished sibling articles are NOT an issue when docs/crosslinks/${a.pillar}/${a.slug}.md exists and lists sensible links (the integrator wires them in wave 3); judge that file instead.` : ''}${round >= 2 ? `
This is round ${round}. Form your own fresh judgement of the whole article first. Only then open the previous round's reviews in docs/reviews/${a.pillar}/ (all three critics) and check that each blocker/major issue was really fixed, not papered over; unfixed ones go back on your list. Score the article as it stands now, on the same anchors; do not raise the score merely because effort was made.` : ''}`
  if (kind === 'technical') {
    return `${head}

Role: TECHNICAL EDITOR, a senior CS professor and working engineer. Verify factual claims against primary sources yourself (open them). Re-derive every complexity claim. Read each program for correctness, edge cases, idiomatic modern C#/SQL/git usage. Check each cited source exists and supports the sentence citing it. Hunt for vagueness, hand-waving, missing caveats, wrong generalisations, padding. Run \`node tools/run-code.mjs ${path}\` from PowerShell yourself and report the real result in runCodePass. A factual error caps your score at 7; code that fails caps it at 5.`
  }
  if (kind === 'adsense') {
    return `${head}

Role: ADSENSE REVIEWER, playing a Google policy reviewer hunting for "low value content". Judge: original value over the existing top results; filler intro/outro; padding; keyword stuffing; templated structure (open the sibling articles present in src/content/articles/${a.pillar}/ and two from other pillars if they exist, compare headings, openings, exercise formats, phrasing tics); near-duplicate coverage; copied or closely paraphrased passages (take 5 distinctive sentences and web-search them in quotes; also compare against the sources cited); unsupported claims or missing sources; invented experience or statistics; whether it reads as mass-produced machine text (formulaic triplets, "it's not X, it's Y", empty signposting, uniform paragraph lengths); dead-end navigation on the rendered page. Build and view the page if useful: \`node tools/verify-page.mjs --drafts --no-lighthouse /${a.pillar}/${a.slug}/\`.`
  }
  return `${head}

Role: DESIGN/UX CRITIC. From PowerShell run \`node tools/verify-page.mjs --drafts /${a.pillar}/${a.slug}/\`, then open .verify/${a.pillar}__${a.slug}/report.json and lighthouse.json and report the REAL numbers (lighthouse, consoleErrors count, brokenLinks count; the NEEDS_MARKUS placeholder failure is expected). Other agents are loading this machine, so if performance is below 90 re-run once and report the better run, noting it. Then open EVERY screenshot part for desktop-light and mobile-dark, and at least the fold plus two parts for desktop-dark and mobile-light, with the Read tool. Judge: reading rhythm (walls of text, code/figure/prose balance), heading hierarchy, code blocks (overflow, wrapped or very long lines, output panels), diagrams (legible at phone width? correct in dark theme? informative or decorative? captions useful?), tables on mobile, callout over/under-use, exercises, sources list. Mark each issue owner "writer" (article-level) or "integrator" (shell-level).`
}

function passed(r) {
  const s = r.technical && r.adsense && r.design
  if (!s) return false
  const lh = r.design.lighthouse ?? {}
  const lhOk = ['accessibility', 'bestPractices', 'seo'].every((k) => (lh[k] ?? 0) >= 90)
  return r.technical.score >= 8.5 && r.adsense.score >= 8.5 && r.design.score >= 8.5 &&
    r.technical.runCodePass === true && (r.design.consoleErrors ?? 1) === 0 && (r.design.brokenLinks ?? 1) === 0 && lhOk
}

const results = await pipeline(args.articles, async (a) => {
  const history = []
  let reviews = null
  for (let round = (a.startRound ?? 1); round <= MAX_ROUNDS; round++) {
    const w = await agent(writerPrompt(a, round, reviews ?? a.priorReviews), { label: `write:${a.pillar}/${a.slug} r${round}`, phase: 'Write', schema: WRITER_SCHEMA })
    if (!w) { history.push({ round, error: 'writer agent failed' }); break }
    const [technical, adsense, design] = await parallel(['technical', 'adsense', 'design'].map((k) => () =>
      agent(criticPrompt(k, a, round), { label: `${k}:${a.slug} r${round}`, phase: 'Review', schema: CRITIC_SCHEMA })))
    const r = { round, writer: w, technical, adsense, design }
    r.pass = passed(r)
    history.push(r)
    log(`${a.pillar}/${a.slug} round ${round}: tech ${technical?.score ?? '-'} / adsense ${adsense?.score ?? '-'} / design ${design?.score ?? '-'} => ${r.pass ? 'PASS' : 'not yet'}`)
    if (r.pass) break
    reviews = { technical: technical?.issues ?? [], adsense: adsense?.issues ?? [], design: (design?.issues ?? []).filter((i) => i.owner === 'writer') }
  }
  const last = history[history.length - 1]
  return { pillar: a.pillar, slug: a.slug, pass: !!last?.pass, rounds: history.length, history }
})

return results