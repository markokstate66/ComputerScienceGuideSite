import { defineConfig } from 'astro/config';
import { rehypeHeadingIds } from '@astrojs/markdown-remark';
import remarkDirective from 'remark-directive';
import remarkCallouts from './src/plugins/remark-callouts.mjs';
import remarkCodeBlocks from './src/plugins/remark-code-blocks.mjs';
import rehypeArticle from './src/plugins/rehype-article.mjs';
import siteBuild from './src/plugins/build-integration.mjs';

export default defineConfig({
  site: 'https://www.computerscienceguide.com',
  trailingSlash: 'always',
  build: {
    assets: '_assets',
    format: 'directory',
    // One small stylesheet: inlining it removes the only render-blocking request.
    inlineStylesheets: 'always',
  },
  markdown: {
    // Highlighting is done by remark-code-blocks (Shiki, dual theme) so fence meta can be handled.
    syntaxHighlight: false,
    remarkPlugins: [remarkDirective, remarkCallouts, remarkCodeBlocks],
    rehypePlugins: [rehypeHeadingIds, rehypeArticle],
  },
  integrations: [siteBuild()],
});
