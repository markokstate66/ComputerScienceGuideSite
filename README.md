# Computer Science Guide

Source for computerscienceguide.com: a static Astro 4 site deployed to Azure Static Web Apps. Articles are Markdown files in a schema-validated content collection; every code sample in them is compiled and run by `tools/run-code.mjs`.

Read first: `CONTENT_PLAN.md` (the contract), `docs/WRITER_GUIDE.md` (how to write an article), `docs/SHELL_NOTES.md` (decisions behind the site shell), `docs/NEEDS_MARKUS.md` (open owner inputs).

## Commands

```text
npm install
npm run dev          local dev server
npm run build        astro build -> dist/, then Pagefind index and staticwebapp.config.json are written into dist/
npm run preview      serve dist/
npm run images       regenerate OG cards, apple-touch-icon.png and logo.png (tools/make-images.mjs)

node tools/run-code.mjs <article.md> | --pillar <name> | --all
node tools/verify-page.mjs [--drafts] [--no-lighthouse] [--external] /route/ ...   (use PowerShell, not Git Bash)
```

Requirements: Node 20+ to build; Node 22.5+ (for `node:sqlite`), the .NET 10 SDK, Git Bash and Chrome or Edge to run the two tools.

`INCLUDE_DRAFTS=1` (or `verify-page --drafts`) builds `draft: true` articles, including the layout fixture `complexity/zz-layout-fixture`.

## Structure

```text
src/
  content/
    config.ts                 collection schemas (articles, authors, pillars, glossary)
    articles/<pillar>/*.md    one file per article -> /<pillar>/<slug>/
    pillars/*.yaml            the ten pillars: titles, blurbs, accent colours
    authors/markus.yaml       the single author (NEEDS_MARKUS placeholders)
    glossary/*.yaml           one term per file -> /glossary/#<file-name>
  page-content/               Markdown bodies for hand-written pages (start-here)
  data/site-pages.ts          static pages + last-changed dates (sitemap lastmod, "Last updated")
  data/corrections.ts         public corrections log
  lib/                        site constants, content queries, reading time, related articles
  plugins/                    remark/rehype plugins (code blocks, callouts, tables, anchors) + build integration
  layouts/                    BaseLayout (head, header, footer), ArticleLayout, PageLayout
  components/                 ArticleCard, Breadcrumbs, Toc, NeedsMarkus
  scripts/site.ts             all client JS: theme, menu, copy buttons, TOC highlight, GA4 loader
  styles/global.css           the design system
  pages/                      routes; [pillar]/index.astro = hubs + /topics/, [pillar]/[slug].astro = articles
public/                       ads.txt, robots.txt, favicon, generated PNGs
api/contact/                  Azure Function behind the contact form (Azure Communication Services email)
staticwebapp.config.json      redirects, headers, 404 override (copied into dist/ at build; see docs/REDIRECTS.md)
tools/                        run-code.mjs, verify-page.mjs, make-images.mjs
```

A pillar hub, and every link to it, exists only when the pillar has at least one non-draft article. `/topics/` exists only when at least one hub does.

## Analytics and advertising

- Google Analytics 4 (`G-08FYJQ54RN`) is loaded by `src/scripts/site.ts` only on the production hostname, never when the browser sends Global Privacy Control or Do Not Track, and with Consent Mode defaulted to "denied" (no cookies). `src/pages/privacy.astro` describes exactly this; change both together.
- There is no ad code. `public/ads.txt` is kept. The AdSense site-verification snippet goes at the `ADSENSE-VERIFICATION-SNIPPET` comment in `src/layouts/BaseLayout.astro` and nowhere else.

## Deployment

Pushing to `master` runs `.github/workflows/azure-static-web-apps.yml`: `npm ci`, `npm run build`, then uploads `dist/` (app) and `api/` (functions) with `skip_app_build: true`. The workflow needs the repository secret `AZURE_STATIC_WEB_APPS_API_TOKEN` (Azure Portal > Static Web App > Manage deployment token).

The contact function needs these application settings on the Static Web App: `ACS_CONNECTION_STRING`, and optionally `ACS_SENDER_EMAIL` and `CONTACT_EMAIL`.

Custom domain: Azure Portal > Static Web App > Custom domains. The canonical host is `www.computerscienceguide.com` (`site` in `astro.config.mjs`).

## License

All rights reserved.
