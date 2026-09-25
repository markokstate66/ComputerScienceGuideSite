// The three learning paths on /start-here/ (CONTENT_PLAN.md §7, "Cross-cutting pages").
// Each step names an article as "pillar/slug" and says why it comes at that point.
// Only published articles are rendered; a step whose article is not published is skipped.
export type LearningPath = {
  id: string;
  title: string;
  /** Who the path is for and what they will be able to do at the end. */
  intro: string;
  steps: { article: string; why: string }[];
};

export const LEARNING_PATHS: LearningPath[] = [];
