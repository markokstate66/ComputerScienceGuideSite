// Static editorial checks for one article (no build, no browser; runs in about a second).
//
//   node tools/check-article.mjs <pillar/slug | path/to/article.md> [...more]
//   node tools/check-article.mjs --pillar <name>
//   node tools/check-article.mjs --all
//   flags: --json   print the JSON report instead of the summary
//
// Complements tools/run-code.mjs (code blocks) and tools/verify-page.mjs (rendered page, links,
// console errors, Lighthouse, screenshots). It checks what those two cannot see in the source:
// front matter against the schema and the house rules, heading structure, diagrams' accessibility
// markup, glossary and internal links, sources cited inline, banned filler, British spellings,
// long code lines for phones, word count against the plan's band, and a readability score.
//
// Each finding is an "error" (breaks a written rule) or a "warn" (worth a look; critics decide).
// Writes .verify/<pillar>__<slug>/check.json. Exit code is non-zero if any article has an error.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const articlesDir = path.join(root, 'src/content/articles');
const glossaryDir = path.join(root, 'src/content/glossary');

// Guide band from docs/ARTICLES_PLAN.md §0.5 (25th–75th percentile of the 50 published articles).
const WORDS_MIN = 4000;
const WORDS_MAX = 7000;
const CODE_LINE_WARN = 72; // about what fits a phone code block with horizontal scroll kept short

const FILLER = [
  /in today's (fast-paced )?world/i,
  /in this article,? (we|you) will/i,
  /let's dive in/i,
  /without further ado/i,
  /\bdelve\b/i,
  /it'?s (important|worth) to note that/i,
  /in conclusion\b/i,
  /\bgame[- ]changer\b/i,
  /\bunlock the (power|potential)\b/i,
];
const BOILERPLATE_HEADINGS = /^(introduction|conclusion|summary|key takeaways|final thoughts|wrapping up)$/i;
// British forms whose American spelling the editorial brief requires. Word-boundary matched, prose only.
const BRITISH = ['behaviour', 'colour', 'favour', 'honour', 'neighbour', 'labour', 'optimise', 'optimised', 'optimisation',
  'recognise', 'recognised', 'realise', 'realised', 'organise', 'organised', 'summarise', 'initialise', 'initialised',
  'serialise', 'serialised', 'normalise', 'normalised', 'minimise', 'maximise', 'analyse', 'analysed', 'catalogue',
  'centre', 'licence', 'defence', 'grey', 'programme', 'travelled', 'modelling', 'labelled', 'cancelled', 'judgement'];

function parseArgs(argv) {
  const out = { targets: [], json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') out.json = true;
    else if (a === '--all') out.targets.push(...listArticles());
    else if (a === '--pillar') out.targets.push(...listArticles(argv[++i]));
    else out.targets.push(resolveTarget(a));
  }
  return out;
}

function listArticles(pillar) {
  const pillars = pillar ? [pillar] : fs.readdirSync(articlesDir);
  return pillars.flatMap((p) => fs.readdirSync(path.join(articlesDir, p))
    .filter((f) => f.endsWith('.md') && !f.startsWith('zz-'))
    .map((f) => path.join(articlesDir, p, f)));
}

function resolveTarget(t) {
  if (t.endsWith('.md')) return path.resolve(t);
  return path.join(articlesDir, `${t.replace(/^\/|\/$/g, '')}.md`);
}

// Minimal front-matter reader for the fields this schema uses: scalars, inline arrays, and the sources list.
function parseFrontMatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!m) return { fm: null, body: text, fmLines: 0 };
  const fm = {};
  let current = null;
  for (const raw of m[1].split(/\r?\n/)) {
    const line = raw.replace(/\s+#.*$/, '');
    if (!line.trim()) continue;
    const item = line.match(/^\s+-\s+(\w+):\s*(.*)$/);
    const cont = line.match(/^\s{4,}(\w+):\s*(.*)$/);
    const top = line.match(/^(\w+):\s*(.*)$/);
    if (item && current) { fm[current].push({ [item[1]]: scalar(item[2]) }); }
    else if (cont && current && fm[current].length) { fm[current].at(-1)[cont[1]] = scalar(cont[2]); }
    else if (top) {
      const [, k, v] = top;
      if (v === '') { fm[k] = []; current = k; } else { fm[k] = scalar(v); current = null; }
    }
  }
  return { fm, body: text.slice(m[0].length), fmLines: m[0].split('\n').length - 1 };
}

function scalar(v) {
  v = v.trim();
  if (v.startsWith('[')) {
    return v.slice(1, -1).split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
  }
  if (/^["'].*["']$/.test(v)) return v.slice(1, -1);
  if (v === 'true' || v === 'false') return v === 'true';
  if (/^\d+$/.test(v)) return Number(v);
  return v;
}

// Split the body into prose lines and code blocks, keeping line numbers.
function scan(body, offset) {
  const lines = body.split(/\r?\n/);
  const prose = [];
  const code = [];
  let fence = null;
  lines.forEach((line, i) => {
    const n = i + 1 + offset;
    const f = line.match(/^(\s*)(`{3,}|~{3,})(.*)$/);
    if (f && !fence) { fence = { marker: f[2], info: f[3].trim(), start: n, lines: [] }; return; }
    if (f && fence && f[2].startsWith(fence.marker[0]) && f[2].length >= fence.marker.length && !f[3].trim()) {
      code.push(fence); fence = null; return;
    }
    if (fence) fence.lines.push({ n, text: line });
    else prose.push({ n, text: line });
  });
  return { prose, code };
}

function words(s) {
  return s.replace(/`[^`]*`/g, ' x ').replace(/<[^>]+>/g, ' ').replace(/\]\([^)]*\)/g, ']')
    .split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
}

function syllables(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const groups = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '').match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

function fleschReadingEase(text) {
  const sentences = text.split(/[.!?]+(?:\s|$)/).filter((s) => s.trim().split(/\s+/).length > 2);
  const ws = text.split(/\s+/).filter((w) => /[A-Za-z]/.test(w));
  if (!sentences.length || !ws.length) return null;
  const syl = ws.reduce((a, w) => a + syllables(w), 0);
  return Math.round((206.835 - 1.015 * (ws.length / sentences.length) - 84.6 * (syl / ws.length)) * 10) / 10;
}

const glossaryIds = new Set(fs.readdirSync(glossaryDir).map((f) => f.replace(/\.ya?ml$/, '')));
const articleRoutes = new Set(listArticles().map((f) => {
  const rel = path.relative(articlesDir, f).replace(/\\/g, '/').replace(/\.md$/, '');
  return `/${rel}/`;
}));
const plannedRoutes = new Set();
try {
  const plan = fs.readFileSync(path.join(root, 'CONTENT_PLAN.md'), 'utf8');
  let pillar = null;
  for (const line of plan.split('\n')) {
    const h = line.match(/^### 7\.\d+ `([a-z-]+)`/);
    if (h) pillar = h[1];
    const r = line.match(/^\| \d+ \| `([a-z0-9-]+)`/);
    if (r && pillar) plannedRoutes.add(`/${pillar}/${r[1]}/`);
  }
} catch { /* plan is optional */ }
const siteRoutes = new Set(['/', '/topics/', '/start-here/', '/glossary/', '/search/', '/about/', '/contact/',
  '/privacy/', '/terms/', '/editorial-policy/', '/corrections/', '/styleguide/']);
for (const p of fs.readdirSync(articlesDir)) siteRoutes.add(`/${p}/`);

// True if the article already exists on the integration branch (so it has been shipped).
function onIntegrationBranch(rel) {
  try {
    execFileSync('git', ['cat-file', '-e', `adsense-rebuild:${rel}`], { cwd: root, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function check(file) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  const findings = [];
  const add = (level, line, rule, message) => findings.push({ level, line, rule, message });
  if (!fs.existsSync(file)) {
    return { file: rel, findings: [{ level: 'error', line: 0, rule: 'exists', message: 'file not found' }], stats: {} };
  }
  const text = fs.readFileSync(file, 'utf8');
  const { fm, body, fmLines } = parseFrontMatter(text);
  const pillar = path.basename(path.dirname(file));
  const slug = path.basename(file, '.md');

  // Front matter
  if (!fm) add('error', 1, 'front-matter', 'no front matter block');
  else {
    const need = ['title', 'description', 'pillar', 'order', 'author', 'published', 'updated', 'level', 'tags', 'sources'];
    for (const k of need) if (fm[k] === undefined) add('error', 1, 'front-matter', `missing "${k}"`);
    const allowed = new Set([...need, 'prerequisites', 'draft']);
    for (const k of Object.keys(fm)) if (!allowed.has(k)) add('error', 1, 'front-matter', `unknown key "${k}" (schema is strict)`);
    if (typeof fm.title === 'string' && (fm.title.length < 10 || fm.title.length > 70)) add('error', 1, 'title-length', `title is ${fm.title.length} chars (10-70)`);
    if (typeof fm.title === 'string' && /\b(complete|ultimate|definitive) guide\b/i.test(fm.title)) add('error', 1, 'title', 'no "Complete/Ultimate Guide" titles');
    if (typeof fm.description === 'string' && (fm.description.length < 110 || fm.description.length > 160)) add('error', 1, 'description-length', `description is ${fm.description.length} chars (110-160)`);
    if (fm.pillar && fm.pillar !== pillar) add('error', 1, 'pillar', `pillar "${fm.pillar}" does not match folder "${pillar}"`);
    if (Array.isArray(fm.tags) && (fm.tags.length < 2 || fm.tags.length > 6)) add('error', 1, 'tags', `${fm.tags.length} tags (2-6)`);
    if (fm.published && fm.updated && String(fm.updated) < String(fm.published)) add('error', 1, 'dates', 'updated is earlier than published');
    for (const p of fm.prerequisites ?? []) if (!articleRoutes.has(`/${p}/`)) add('warn', 1, 'prerequisites', `prerequisite "${p}" is not an article in this checkout (shown only once published)`);
    const sources = Array.isArray(fm.sources) ? fm.sources : [];
    if (sources.length < 2) add('error', 1, 'sources', `${sources.length} sources (at least 2)`);
    for (const s of sources) {
      if (!s.url || !String(s.url).startsWith('https://')) add('error', 1, 'sources', `source "${s.title}" needs an https url`);
      else if (!body.includes(s.url)) add('warn', 1, 'source-cited-inline', `source never linked in the body: ${s.url}`);
    }
    if (fm.draft === false && !onIntegrationBranch(rel)) add('warn', 1, 'draft', 'draft: false on an article not yet on adsense-rebuild; keep draft: true until /ship (ARTICLES_PLAN O-1)');
  }

  const { prose, code } = scan(body, fmLines);

  // Headings
  let prev = 1;
  const headings = [];
  for (const { n, text: t } of prose) {
    const h = t.match(/^(#{1,6})\s+(.*)$/);
    if (!h) continue;
    const level = h[1].length;
    const title = h[2].trim();
    headings.push({ level, title, line: n });
    if (level === 1) add('error', n, 'headings', 'no "#" H1 in the body; the title renders from front matter');
    if (level > prev + 1) add('error', n, 'headings', `heading jumps from h${prev} to h${level}`);
    if (BOILERPLATE_HEADINGS.test(title.replace(/[*_`]/g, ''))) add('error', n, 'boilerplate-heading', `boilerplate heading "${title}"`);
    prev = level;
  }
  if (!headings.some((h) => h.level === 2)) add('error', 0, 'headings', 'no "##" sections');

  // Prose rules
  const proseText = prose.map((p) => p.text).join('\n');
  let inSvg = false;
  let svgOpen = null;
  for (const { n, text: t } of prose) {
    if (/<svg\b/i.test(t)) {
      inSvg = true;
      svgOpen = { n, role: /role="img"/.test(t), title: false, desc: false };
    }
    if (inSvg) {
      if (/role="img"/.test(t)) svgOpen.role = true;
      if (/<title\b/.test(t)) svgOpen.title = true;
      if (/<desc\b/.test(t)) svgOpen.desc = true;
      if (/<\/svg>/i.test(t)) {
        if (!svgOpen.role) add('error', svgOpen.n, 'diagram-a11y', 'svg without role="img"');
        if (!svgOpen.title) add('error', svgOpen.n, 'diagram-a11y', 'svg without <title>');
        if (!svgOpen.desc) add('error', svgOpen.n, 'diagram-a11y', 'svg without <desc>');
        inSvg = false;
      }
      continue;
    }
    const img = t.match(/!\[([^\]]*)\]\(([^)]+)\)/);
    if (img && !img[1].trim()) add('error', n, 'alt-text', `image without alt text: ${img[2]}`);
    if (/<img\b(?![^>]*\balt="[^"]+")/i.test(t)) add('error', n, 'alt-text', '<img> without alt text');
    for (const re of FILLER) if (re.test(t)) add('error', n, 'filler', `filler phrase: "${t.match(re)[0]}"`);
    const plain = t.replace(/`[^`]*`/g, ' CODE ').replace(/\]\([^)]*\)/g, ']');
    for (const b of BRITISH) if (new RegExp(`\\b${b}\\b`, 'i').test(plain)) add('warn', n, 'american-spelling', `British spelling "${b}"`);
    const dbl = plain.match(/\b([A-Za-z]+)\s+\1\b(?!-)/i);
    if (dbl && !/^(that|had|is|very|bye|no|code)$/i.test(dbl[1])) add('warn', n, 'doubled-word', `doubled word "${dbl[0]}"`);
    for (const [, href] of t.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      if (href.startsWith('/glossary/#')) {
        const id = href.slice('/glossary/#'.length);
        if (!glossaryIds.has(id)) add('error', n, 'glossary-link', `glossary term "${id}" does not exist (request it in docs/INTEGRATOR_REQUESTS.md)`);
      } else if (href.startsWith('/')) {
        const route = href.split('#')[0];
        if (articleRoutes.has(route) || siteRoutes.has(route)) continue;
        if (plannedRoutes.has(route)) add('error', n, 'internal-link', `${route} is planned but not in this checkout; record it in docs/crosslinks/${pillar}/${slug}.md instead`);
        else add('error', n, 'internal-link', `${route} is not a page on this site`);
      }
    }
  }

  // Code blocks
  let runBlocks = 0;
  for (const c of code) {
    const lang = c.info.split(/\s+/)[0];
    if (['csharp', 'sql', 'bash'].includes(lang) && !/\b(run|snippet)\b/.test(c.info)) {
      add('error', c.start, 'code-fence', `${lang} block with neither "run" nor "snippet" (fails the build)`);
    }
    if (/\brun\b/.test(c.info)) runBlocks++;
    const long = c.lines.filter((l) => l.text.length > CODE_LINE_WARN);
    if (long.length) add('warn', long[0].n, 'code-width', `${long.length} line(s) over ${CODE_LINE_WARN} chars in this ${c.info || 'code'} block (phones show about 40)`);
  }

  const proseWords = words(proseText.replace(/<svg[\s\S]*?<\/svg>/gi, ''));
  const codeLines = code.reduce((a, c) => a + c.lines.length, 0);
  const totalWords = text.split(/\s+/).filter(Boolean).length;
  if (totalWords < WORDS_MIN || totalWords > WORDS_MAX) {
    add('warn', 0, 'length', `${totalWords} words total (wc -w style); plan band ${WORDS_MIN}-${WORDS_MAX}, a guide not a gate`);
  }
  const readable = proseText.replace(/<svg[\s\S]*?<\/svg>/gi, '').replace(/^#+.*$/gm, '').replace(/`[^`]*`/g, 'code')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/<[^>]+>/g, ' ').replace(/^\s*[-*|>:].*$/gm, '');
  const stats = {
    totalWords, proseWords, codeBlocks: code.length, runBlocks, codeLines,
    headings: { h2: headings.filter((h) => h.level === 2).length, h3: headings.filter((h) => h.level === 3).length },
    figures: (proseText.match(/<figure\b/g) ?? []).length,
    glossaryLinks: (proseText.match(/\]\(\/glossary\/#/g) ?? []).length,
    sources: Array.isArray(fm?.sources) ? fm.sources.length : 0,
    fleschReadingEase: fleschReadingEase(readable),
    draft: fm?.draft ?? null,
  };
  return { file: rel, route: `/${pillar}/${slug}/`, checkedAt: new Date().toISOString(), stats, findings };
}

const { targets, json } = parseArgs(process.argv.slice(2));
if (!targets.length) {
  console.error('usage: node tools/check-article.mjs <pillar/slug | file.md> [...] | --pillar <name> | --all [--json]');
  process.exit(2);
}
const reports = targets.map(check);
let failed = 0;
for (const r of reports) {
  const errors = r.findings.filter((f) => f.level === 'error');
  const warns = r.findings.filter((f) => f.level === 'warn');
  if (errors.length) failed++;
  if (r.route) {
    const dir = path.join(root, '.verify', r.route.slice(1, -1).replace('/', '__'));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'check.json'), JSON.stringify(r, null, 2));
  }
  if (json) continue;
  const s = r.stats;
  console.log(`${errors.length ? 'FAIL' : 'PASS'} ${r.file}  words=${s.totalWords ?? '-'} prose=${s.proseWords ?? '-'} run=${s.runBlocks ?? '-'} fig=${s.figures ?? '-'} sources=${s.sources ?? '-'} flesch=${s.fleschReadingEase ?? '-'}  errors=${errors.length} warnings=${warns.length}`);
  for (const f of [...errors, ...warns]) console.log(`  ${f.level.padEnd(5)} L${f.line} [${f.rule}] ${f.message}`);
}
if (json) console.log(JSON.stringify(reports.length === 1 ? reports[0] : reports, null, 2));
process.exit(failed ? 1 : 0);
