// Astro integration that finishes every build (npm run build, astro build --outDir X, the
// verify tool's private builds) the same way:
//
//  1. Pagefind indexes the built HTML and writes /pagefind/ into the output directory.
//  2. staticwebapp.config.json is copied from the repo root into the output directory. The deploy
//     workflow uploads dist/ as the app, and Azure Static Web Apps only reads the config from inside
//     the uploaded app folder, so the root copy alone is never applied.
//     While copying, every redirect whose target page does not exist in this build is pointed at
//     /topics/ (or / if that does not exist either). A pillar hub only exists once the pillar has a
//     published article, so legacy redirects retarget themselves as pillars go live.
//     See docs/REDIRECTS.md.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export default function siteBuild() {
  let root;
  return {
    name: 'csg-site-build',
    hooks: {
      'astro:config:done': ({ config }) => { root = fileURLToPath(config.root); },
      'astro:build:done': async ({ dir, logger }) => {
        const out = fileURLToPath(dir);

        const pagefind = await import('pagefind');
        const { index, errors } = await pagefind.createIndex({});
        if (!index) throw new Error(`pagefind: ${errors.join('; ')}`);
        const added = await index.addDirectory({ path: out });
        if (added.errors.length) throw new Error(`pagefind: ${added.errors.join('; ')}`);
        const written = await index.writeFiles({ outputPath: path.join(out, 'pagefind') });
        if (written.errors.length) throw new Error(`pagefind: ${written.errors.join('; ')}`);
        await pagefind.close();
        logger.info(`pagefind indexed ${added.page_count} pages`);

        const config = JSON.parse(fs.readFileSync(path.join(root, 'staticwebapp.config.json'), 'utf8'));
        const exists = (url) => fs.existsSync(path.join(out, url, 'index.html'));
        const fallback = exists('/topics/') ? '/topics/' : '/';
        let retargeted = 0;
        for (const route of config.routes ?? []) {
          if (route.redirect && route.redirect.startsWith('/') && !exists(route.redirect)) {
            route.redirect = fallback;
            retargeted++;
          }
        }
        fs.writeFileSync(path.join(out, 'staticwebapp.config.json'), JSON.stringify(config, null, 2));
        logger.info(`staticwebapp.config.json written (${retargeted} redirect(s) fall back to ${fallback})`);
      },
    },
  };
}
