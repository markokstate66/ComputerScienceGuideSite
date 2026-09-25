// Every hand-written page, with the date its content last changed in substance.
// Single source of truth for the sitemap <lastmod> and the "Last updated" line on trust pages.
// Update the date when you edit the page's content (not for layout or style changes).
export const STATIC_PAGES = {
  '/start-here/': '2026-09-18',
  '/glossary/': '2026-09-18',
  '/search/': '2026-09-18',
  '/about/': '2026-09-24',
  '/contact/': '2026-09-18',
  '/privacy/': '2026-09-24',
  '/terms/': '2026-09-24',
  '/editorial-policy/': '2026-09-24',
  '/corrections/': '2026-09-18',
} as const;

export type StaticPath = keyof typeof STATIC_PAGES;
export const pageUpdated = (path: StaticPath) => new Date(STATIC_PAGES[path] + 'T00:00:00Z');
