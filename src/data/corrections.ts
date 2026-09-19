// The public corrections log. Add an entry (newest first) whenever a published article is changed
// because it was wrong. `article` is "pillar/slug"; `date` is the day the fix was published.
// Also bump the article's `updated` date and the '/corrections/' date in site-pages.ts.
export interface Correction {
  date: string; // YYYY-MM-DD
  article: string; // "pillar/slug"
  summary: string; // what was wrong and what it says now
  reportedBy?: 'reader' | 'author';
}

export const CORRECTIONS: Correction[] = [];
