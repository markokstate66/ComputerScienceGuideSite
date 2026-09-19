# Computer Science Guide

Astro 4 static site for computerscienceguide.com, deployed to Azure Static Web Apps. The site is being rebuilt to pass Google AdSense review: 40+ in-depth, C#-first computer science articles whose every code sample is machine-verified.

## Read before working
- `computerscienceguide-adsense-prompt.md`: the owner's brief. Its **Rules** section is binding (never fabricate, never copy, all code runs, no filler, no ad code, never inflate scores).
- `CONTENT_PLAN.md`: stack decisions, content model, design system, the 67 planned articles, who may touch what.
- `docs/EDITORIAL_BRIEF.md` (quality), `docs/WRITER_GUIDE.md` (mechanics), `docs/ARTICLE_GAUNTLET.md` (how an article is written and reviewed).
- `docs/STATUS.json` (article inventory and scores), `WORKLOG.md`, `docs/SHELL_NOTES.md`, `docs/NEEDS_MARKUS.md`.

## Branches and deploys
- **Pushing to `master` deploys to production.** Never commit or push to `master`.
- **Integration branch: `adsense-rebuild`.** All issue branches start from it and all PRs target it (`gh pr create --base adsense-rebuild`). PRs into `adsense-rebuild` do not trigger a deploy. Merging `adsense-rebuild` into `master` is the owner's decision, after the final gate.

## Work queue
Work is fed and pulled through GitHub issues: `/triage` and `/groom` produce `todo` issues, `/work-next` (alias `/next`) consumes one and opens a PR. Definition of Ready: `.github/DEFINITION_OF_READY.md`. One `/work-next` run on an `article` issue does exactly one gauntlet round, to keep token spend predictable.

## Commands
- `npm run build`: production build (must always stay green; drafts excluded).
- `node tools/run-code.mjs <article.md>`: compiles and runs every code block, compares output with the article. `--pillar <name>` or `--all` for more.
- `node tools/verify-page.mjs [--drafts] <route>`: private build, screenshots (desktop/mobile × light/dark, in numbered parts), Lighthouse, links, console errors, placeholders. Run it from PowerShell, not Git Bash (Git Bash rewrites arguments that start with `/`). Run it serially: Lighthouse performance is unreliable when other heavy jobs are running.
- Toolchain on the owner's machine: Node 24, .NET 10 SDK, Git Bash, Chrome. **No Python.**

## Danger zones (always `risk:high`, confirm with the owner first)
Anything that reaches production or the owner's accounts: merging to `master`, `staticwebapp.config.json` redirects and headers, the contact API (`api/`), analytics or consent code, `public/ads.txt`, adding any ad code, and the legal text of Privacy/Terms. Owner-only facts are never invented; they go in `docs/NEEDS_MARKUS.md` and show on the site as `NEEDS_MARKUS(#n)` markers, which `verify-page` deliberately fails.
