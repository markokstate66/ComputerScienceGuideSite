import { getCollection, getEntry, type CollectionEntry } from 'astro:content';

export type Article = CollectionEntry<'articles'>;
export type Pillar = CollectionEntry<'pillars'>;

/** Drafts are left out of every listing, route, sitemap and search index unless INCLUDE_DRAFTS=1. */
export const includeDrafts = process.env.INCLUDE_DRAFTS === '1';

/** "complexity/big-o-notation" -> "big-o-notation" */
export const articleSlug = (a: Article) => a.slug.split('/').slice(1).join('/');
export const articleUrl = (a: Article) => `/${a.data.pillar}/${articleSlug(a)}/`;
export const pillarUrl = (p: Pillar | string) => `/${typeof p === 'string' ? p : p.id}/`;

let cache: Promise<Article[]> | undefined;

/** All publishable articles, sorted by pillar order then article order. */
export function getArticles(): Promise<Article[]> {
  return (cache ??= (async () => {
    const pillars = await getCollection('pillars');
    const pillarOrder = new Map(pillars.map((p) => [p.id, p.data.order]));
    const all = await getCollection('articles', (a) => includeDrafts || !a.data.draft);
    for (const a of all) {
      const folder = a.slug.split('/')[0];
      if (a.slug.split('/').length !== 2) throw new Error(`Article "${a.id}" must live at src/content/articles/<pillar>/<slug>.md`);
      if (folder !== a.data.pillar) throw new Error(`Article "${a.id}": front matter pillar "${a.data.pillar}" does not match its folder "${folder}"`);
    }
    return all.sort(
      (a, b) =>
        (pillarOrder.get(a.data.pillar) ?? 99) - (pillarOrder.get(b.data.pillar) ?? 99) ||
        a.data.order - b.data.order ||
        a.slug.localeCompare(b.slug),
    );
  })());
}

/** Pillars that have at least one publishable article, in reading order. Empty pillars do not exist as far as the site is concerned. */
export async function getLivePillars(): Promise<{ pillar: Pillar; articles: Article[] }[]> {
  const [pillars, articles] = await Promise.all([getCollection('pillars'), getArticles()]);
  return pillars
    .sort((a, b) => a.data.order - b.data.order)
    .map((pillar) => ({ pillar, articles: articles.filter((a) => a.data.pillar === pillar.id) }))
    .filter((p) => p.articles.length > 0);
}

/** Seconds allowed per non-blank line of code, and the most one block can add. */
const CODE_SECONDS_PER_LINE = 2;
const CODE_SECONDS_CAP = 40;

/**
 * Reading time in minutes, never hand-entered:
 *   prose words / 220 wpm
 *   + 2 s per non-blank line of each code block, capped at 40 s per block (long listings are skimmed).
 * `text output` panels add nothing: they are checked at a glance against the program above them.
 * Documented in docs/WRITER_GUIDE.md and on /editorial-policy/; change all three together.
 */
export function readingTime(body: string): { minutes: number; words: number; codeBlocks: number; codeLines: number; codeSeconds: number } {
  let codeBlocks = 0;
  let codeLines = 0;
  let codeSeconds = 0;
  const prose = body
    .replace(/^(\s*)(`{3,}|~{3,})([^\n]*)\n([\s\S]*?)\n\1\2\s*$/gm, (_all, _indent, _fence, info: string, code: string) => {
      if (/^\s*text\b.*\boutput\b/i.test(info)) return ' ';
      const lines = code.split('\n').filter((l) => l.trim() !== '').length;
      codeBlocks++;
      codeLines += lines;
      codeSeconds += Math.min(lines * CODE_SECONDS_PER_LINE, CODE_SECONDS_CAP);
      return ' ';
    })
    .replace(/<svg[\s\S]*?<\/svg>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^:{3,}.*$/gm, ' ')
    .replace(/[#*_`>|\[\]()-]/g, ' ');
  const words = prose.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  const seconds = (words / 220) * 60 + codeSeconds;
  return { minutes: Math.max(1, Math.round(seconds / 60)), words, codeBlocks, codeLines, codeSeconds };
}

/** The draft layout fixture only exists in INCLUDE_DRAFTS builds; real articles never link to it. */
export const isFixture = (a: Article) => a.data.tags.includes('layout-fixture');

/** Up to `count` other articles, ranked by shared tags; ties prefer the same pillar, then reading order. */
export function relatedArticles(article: Article, all: Article[], count = 3, exclude: string[] = []): Article[] {
  const tags = new Set(article.data.tags);
  return all
    .filter((a) => a.slug !== article.slug && !exclude.includes(a.slug) && (isFixture(article) || !isFixture(a)))
    .map((a) => ({ a, shared: a.data.tags.filter((t) => tags.has(t)).length, samePillar: a.data.pillar === article.data.pillar ? 1 : 0 }))
    .filter((x) => x.shared > 0)
    .sort((x, y) => y.shared - x.shared || y.samePillar - x.samePillar || x.a.data.order - y.a.data.order)
    .slice(0, count)
    .map((x) => x.a);
}

export async function getAuthor(article: Article) {
  const author = await getEntry(article.data.author);
  if (!author) throw new Error(`Article "${article.id}" references unknown author "${article.data.author.id}"`);
  return author;
}

export const LEVEL_LABEL = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' } as const;
