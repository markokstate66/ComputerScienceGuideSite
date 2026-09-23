# Legacy redirects

Source of truth: the `routes` array in `staticwebapp.config.json` (repo root). Each legacy path is listed twice there, without and with a trailing slash; the table shows it once. All are 301s.

(2026-09-23, the first real production deploy: the root config used to also set `"trailingSlash": "always"`, which normalizes every request to its slash form *before* route rules are evaluated -- so Azure's deploy-time validator rejected the no-slash half of every pair as an unreachable duplicate of the slash half. Removing just the duplicates fixed the deploy, but `trailingSlash: "always"` turned out to have a second, worse effect that only showed up in production: it also appends a slash to *real files* with no route rule at all -- `/robots.txt`, `/sitemap.xml` and `/404.html` were all getting redirected to a slash-suffixed path that doesn't exist, breaking exactly the files crawlers fetch at literal paths. Fixed by removing `trailingSlash` entirely (real Astro-built pages already serve correctly both with and without a trailing slash under Azure's default, unset behavior -- verified live) and restoring the no-slash route entries, which are no longer duplicates once nothing normalizes them together.)

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
