// Click-depth check over the built site: breadth-first from "/" following internal <a href> links in dist/.
//
//   node tools/click-depth.mjs [--max 3] [--dist dist]
//
// Prints the depth histogram and every page deeper than --max (default 3) or unreachable from "/".
// Pages listed in the sitemap are the set that must be reachable. Exit code 1 if any page fails.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const max = Number(argv.includes('--max') ? argv[argv.indexOf('--max') + 1] : 3);
const dist = path.resolve(root, argv.includes('--dist') ? argv[argv.indexOf('--dist') + 1] : 'dist');

const htmlFor = (route) => path.join(dist, route, 'index.html');
function links(route) {
  const file = htmlFor(route);
  if (!fs.existsSync(file)) return [];
  const html = fs.readFileSync(file, 'utf8');
  const out = new Set();
  for (const [, href] of html.matchAll(/<a\b[^>]*\bhref="([^"#?]*)[^"]*"/g)) {
    if (!href.startsWith('/') || href.startsWith('//')) continue;
    const r = href.endsWith('/') ? href : `${href}/`;
    if (fs.existsSync(htmlFor(r))) out.add(r);
  }
  return [...out];
}

const depth = new Map([['/', 0]]);
const queue = ['/'];
while (queue.length) {
  const r = queue.shift();
  for (const next of links(r)) {
    if (!depth.has(next)) { depth.set(next, depth.get(r) + 1); queue.push(next); }
  }
}

const sitemap = fs.readFileSync(path.join(dist, 'sitemap.xml'), 'utf8');
const required = [...sitemap.matchAll(/<loc>https?:\/\/[^/]+(\/[^<]*)<\/loc>/g)].map((m) => m[1]);
const hist = {};
const failures = [];
for (const r of required) {
  const d = depth.get(r);
  if (d === undefined) failures.push(`${r} unreachable from /`);
  else {
    hist[d] = (hist[d] ?? 0) + 1;
    if (d > max) failures.push(`${r} is ${d} clicks from /`);
  }
}
console.log(`sitemap pages: ${required.length}; depth histogram: ${Object.entries(hist).map(([d, n]) => `${d}:${n}`).join(' ')}`);
for (const f of failures) console.log(`  FAIL ${f}`);
console.log(failures.length ? `FAIL: ${failures.length} page(s) deeper than ${max} or unreachable` : `PASS: every sitemap page within ${max} clicks of /`);
process.exit(failures.length ? 1 : 0);
