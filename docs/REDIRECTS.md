# Legacy redirects

Source of truth: the `routes` array in `staticwebapp.config.json` (repo root). Each legacy path is listed once, **with** a trailing slash. All are 301s.

**Known limitation, from the first real production deploy (2026-09-23):** a legacy URL hit *without* its trailing slash (e.g. `/guides/data-structures`, no final `/`) now 404s instead of redirecting -- only the `/guides/data-structures/` form redirects. Two things had to be traded off against each other and there wasn't time to solve both before shipping:
- The config used to list every legacy path **twice** (with and without a trailing slash) plus a top-level `"trailingSlash": "always"` setting. Azure's deploy-time validator rejects this: with that setting, Azure normalizes every request to its slash form *before* route rules are evaluated, so the no-slash entry can never be reached, and Azure treats it as a literal duplicate of the slash entry ("Encountered an issue while validating staticwebapp.config.json: ... duplicate route").
- Removing just the no-slash duplicates and keeping `trailingSlash: "always"` deployed successfully, but broke something worse: that setting appends a slash to *any* unmatched request, including real static files with no route rule at all -- `/robots.txt`, `/sitemap.xml` and `/404.html` all started 301-redirecting to a slash-suffixed path that doesn't exist, confirmed live via `curl`. Removing `trailingSlash` entirely fixed that (real Astro-built pages already serve correctly both with and without a trailing slash under Azure's default, unset behavior -- also verified live), but reintroduced the original duplicate-route validation error the moment the no-slash entries came back, since nothing was left to make Azure treat the two forms as different routes worth restoring both for.

Shipped with the safe combination (slash-form routes only, no `trailingSlash` setting) rather than risk a third failed deploy. The real fix is per-path wildcard routes (`/guides/data-structures*` matches both forms in one rule, sidestepping the duplicate check entirely) ordered before the existing `/guides/*` catch-all -- not done yet, tracked as follow-up work, not blocking.

## How targets are resolved

`staticwebapp.config.json` holds the **intended final target** from CONTENT_PLAN.md section 2. At build time `src/plugins/build-integration.mjs` copies the file into the build output and, for every redirect whose target page does not exist in that build, substitutes `/topics/` (or `/` if no pillar has an article yet, because then `/topics/` does not exist either). The build log prints how many redirects fell back.

So nothing needs retargeting by hand as pillars go live: once `/algorithms/` exists, `/guides/algorithms` points at it on the next build. Check the result in `dist/staticwebapp.config.json`.

The copy step also fixes a deployment bug found during the rebuild: the GitHub workflow uploads `dist/` as the app, and Azure Static Web Apps only reads `staticwebapp.config.json` from inside the uploaded folder. The root file was therefore never applied in production (the live site sent none of its security headers). It is now written into `dist/` on every build.

## Table

| Legacy URL | Intended target |
|---|---|
| `/guides/data-structures` | `/data-structures/` |
| `/guides/algorithms` | `/algorithms/` |
| `/guides/oop` | `/oop-design/` |
| `/guides/databases` | `/databases/` |
| `/guides/git-version-control` | `/version-control/` |
| `/guides/cs-basics` | `/start-here/` |
| `/guides/programming-fundamentals` | `/start-here/` |
| `/guides/system-design` | `/topics/` |
| `/guides/api-design` | `/topics/` |
| `/guides/web-development` | `/topics/` |
| `/guides/html-css` | `/topics/` |
| `/guides/javascript` | `/topics/` |
| `/guides/react` | `/topics/` |
| `/guides/nodejs` | `/topics/` |
| `/guides/portfolio` | `/topics/` |
| `/guides/interview-prep` | `/topics/` |
| `/guides` | `/topics/` |
| `/resources` | `/topics/` |
| `/roadmap` | `/start-here/` |
| `/500.html` | `/` |
| `/guides/*` | `/topics/` |

## Wave 3 review list

- `/guides/cs-basics` and `/guides/programming-fundamentals` go to `/start-here/`. If wave 3 adds a better landing page (for example a "foundations" learning path anchor), retarget them.
- `/guides/system-design` and `/guides/api-design` were dropped topics and go to `/topics/`. If the networking pillar publishes `http-explained`, consider `/guides/api-design` -> `/networking/http-explained/`.
- `/guides/interview-prep` could go to the interview-refresh learning path on `/start-here/` once it exists.
- To retarget: edit the `redirect` value (both the bare and the trailing-slash entry) in the root `staticwebapp.config.json`, rebuild, and update this table.

## Other routing decisions in the same file

- `navigationFallback` (SPA rewrite to `/index.html`) was removed, so unknown URLs get the real `404.html` with status 404.
- `/styleguide/*`, `/search/*`, `/pagefind/*` and `/404.html` are served with `X-Robots-Tag: noindex`. The header is used instead of a robots meta tag so that Lighthouse's SEO audit on localhost still measures the page itself; these pages are also absent from `sitemap.xml`.
- `trailingSlash: "always"` matches Astro's `trailingSlash: 'always'`.
