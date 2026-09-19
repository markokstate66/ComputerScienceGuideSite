import { defineCollection, reference, z } from 'astro:content';

// Slugs are fixed by CONTENT_PLAN.md §7; the folder under src/content/articles/ must match.
export const PILLAR_SLUGS = [
  'complexity',
  'data-structures',
  'algorithms',
  'oop-design',
  'csharp-dotnet',
  'databases',
  'networking',
  'operating-systems',
  'version-control',
  'testing',
] as const;

const articles = defineCollection({
  type: 'content',
  schema: z
    .object({
      title: z
        .string()
        .min(10)
        .max(70, 'title must be 70 characters or fewer')
        .refine((t) => !/\b(complete|ultimate|definitive) guide\b/i.test(t), 'no "Complete/Ultimate Guide" titles'),
      description: z
        .string()
        .min(110, 'description must be 110-160 characters (it is the meta description)')
        .max(160, 'description must be 110-160 characters (it is the meta description)'),
      pillar: z.enum(PILLAR_SLUGS),
      order: z.number().int().positive(),
      author: reference('authors'),
      published: z.coerce.date(),
      updated: z.coerce.date(),
      level: z.enum(['beginner', 'intermediate', 'advanced']),
      tags: z.array(z.string().regex(/^[a-z0-9][a-z0-9.#+-]*$/, 'tags are lower-case-with-hyphens')).min(2).max(6),
      // "pillar/slug" of articles to read first. Only published ones are shown.
      prerequisites: z.array(z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+$/, 'use "pillar/slug"')).default([]),
      sources: z
        .array(
          z.object({
            title: z.string().min(3),
            url: z.string().url().startsWith('https://', 'sources must be https URLs'),
            publisher: z.string().optional(),
            accessed: z.coerce.date(),
          }),
        )
        .min(2, 'at least two primary sources are required'),
      draft: z.boolean().default(false),
    })
    .strict()
    .refine((a) => a.updated.getTime() >= a.published.getTime(), { message: '"updated" cannot be earlier than "published"', path: ['updated'] }),
});

const authors = defineCollection({
  type: 'data',
  schema: z.object({
    name: z.string(),
    // Short first-person-free bio shown in the author box. Facts come from docs/NEEDS_MARKUS.md only.
    bio: z.string(),
    links: z.array(z.object({ label: z.string(), url: z.string().url() })).default([]),
  }),
});

const hex = z.string().regex(/^#[0-9a-f]{6}$/i);

const pillars = defineCollection({
  type: 'data',
  schema: z.object({
    title: z.string(),
    // Short name for navigation and breadcrumbs.
    navTitle: z.string(),
    // Reading order on /topics/, the homepage and /start-here/.
    order: z.number().int().positive(),
    blurb: z.string().min(80),
    // Longer editorial introduction for the hub page; written in wave 3.
    hubIntro: z.string().optional(),
    // One hue per pillar, given for each theme so text in the accent colour stays >= 4.5:1.
    accent: z.object({ light: hex, dark: hex }),
  }),
});

const glossary = defineCollection({
  type: 'data',
  schema: z.object({
    term: z.string(),
    definition: z.string().min(40),
    // Other names readers may search for.
    aliases: z.array(z.string()).default([]),
    // "pillar/slug" of the article(s) that teach the term; linked only once published.
    seeAlso: z.array(z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+$/)).default([]),
  }),
});

export const collections = { articles, authors, pillars, glossary };
