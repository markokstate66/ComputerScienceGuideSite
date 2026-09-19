// /sitemap.xml with a real <lastmod> per URL:
//   articles    -> front matter `updated`
//   hubs        -> newest `updated` among the hub's articles
//   / , /topics/ -> newest `updated` on the site (or the newest static page if there are no articles)
//   text pages  -> the date recorded in src/data/site-pages.ts
// Not listed: /search/, /styleguide/, /404.html (utility pages, served with X-Robots-Tag: noindex).
import type { APIRoute } from 'astro';
import { SITE, isoDate } from '../lib/site';
import { STATIC_PAGES } from '../data/site-pages';
import { getArticles, getLivePillars, articleUrl, pillarUrl } from '../lib/content';

const EXCLUDED = new Set(['/search/']);

export const GET: APIRoute = async () => {
  const articles = await getArticles();
  const live = await getLivePillars();
  const newest = (dates: Date[]) => new Date(Math.max(...dates.map((d) => d.getTime())));

  const staticEntries = Object.entries(STATIC_PAGES)
    .filter(([path]) => !EXCLUDED.has(path))
    .map(([path, date]) => ({ path, lastmod: new Date(date + 'T00:00:00Z') }));
  const siteNewest = newest([...articles.map((a) => a.data.updated), ...staticEntries.map((e) => e.lastmod)]);

  const entries = [
    { path: '/', lastmod: siteNewest },
    ...(live.length ? [{ path: '/topics/', lastmod: newest(articles.map((a) => a.data.updated)) }] : []),
    ...live.map(({ pillar, articles: list }) => ({ path: pillarUrl(pillar), lastmod: newest(list.map((a) => a.data.updated)) })),
    ...articles.map((a) => ({ path: articleUrl(a), lastmod: a.data.updated })),
    ...staticEntries,
  ];

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    entries.map((e) => `  <url><loc>${new URL(e.path, SITE.url).href}</loc><lastmod>${isoDate(e.lastmod)}</lastmod></url>`).join('\n') +
    '\n</urlset>\n';
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
