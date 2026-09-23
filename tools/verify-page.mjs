#!/usr/bin/env node
// Page verification tool.
//
//   node tools/verify-page.mjs /guides/algorithms/ /about/      verify specific routes
//   node tools/verify-page.mjs --all                            verify every built page
//   flags: --no-build        serve the existing dist/ instead of making a private build
//          --no-lighthouse   skip Lighthouse (fast screenshot/link pass)
//          --external        also check external links over the network
//          --drafts          build with INCLUDE_DRAFTS=1 so `draft: true` articles (e.g. the layout fixture) exist.
//                            Setting INCLUDE_DRAFTS=1 in the environment does the same.
//
// For every route it writes to .verify/<slug>/:
//   desktop-light.png, desktop-dark.png, mobile-light.png, mobile-dark.png
//   lighthouse.json (category scores + failing audits), lighthouse-full.json
//   report.json      (word count, links, console errors, pass/fail summary)
// and a roll-up at .verify/summary.json. Exit code is non-zero if any page fails.
//
// The build goes to .verify/_build-<pid> so it never touches dist/ or a running dev server,
// which keeps it safe to run while other agents are working.

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import zlib from 'node:zlib';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sirv from 'sirv';
import puppeteer from 'puppeteer-core';
import lighthouse from 'lighthouse';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outRoot = path.join(root, '.verify');

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
let routes = args.filter((a) => !a.startsWith('--'));

const CHROME = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
].find((p) => p && fs.existsSync(p));
if (!CHROME) throw new Error('No Chrome/Edge found. Set CHROME_PATH.');

const LH_MIN = 90;

function build() {
  // Build to a private dir per invocation, then swap, so concurrent runs don't read half-written output.
  const tmp = path.join(outRoot, `_build-${process.pid}`);
  fs.mkdirSync(outRoot, { recursive: true });
  const env = { ...process.env, ...(flags.has('--drafts') ? { INCLUDE_DRAFTS: '1' } : {}) };
  execSync(`npx astro build --outDir "${tmp}"`, { cwd: root, env, stdio: ['ignore', 'ignore', 'inherit'] });
  return tmp;
}

function listRoutes(dir) {
  const found = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.html')) {
        found.push('/' + path.relative(dir, p).replace(/\\/g, '/').replace(/index\.html$/, ''));
      }
    }
  })(dir);
  return found.sort();
}

function fileFor(dir, url) {
  const clean = decodeURIComponent(url.split('#')[0].split('?')[0]);
  const base = path.join(dir, clean);
  return [base, path.join(base, 'index.html'), base + '.html'].find((p) => fs.existsSync(p) && fs.statSync(p).isFile());
}

function analyseHtml(dir, route) {
  const file = fileFor(dir, route);
  if (!file) return null;
  const html = fs.readFileSync(file, 'utf8');
  const main = (html.match(/<main[\s\S]*?<\/main>/) ?? [html])[0];
  const prose = main
    .replace(/<(pre|script|style|svg|nav)[\s\S]*?<\/\1>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ');
  const words = prose.split(/\s+/).filter((w) => /\w/.test(w)).length;
  // preconnect/dns-prefetch hints point at origins, not documents, so they aren't links to check.
  const linkable = html.replace(/<link[^>]+rel="(?:preconnect|dns-prefetch)"[^>]*>/g, '');
  // Attribute values are HTML-escaped in the file ("&" is written "&#38;" or "&amp;"); decode before treating them as URLs.
  const links = [...linkable.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1].replace(/&#38;|&amp;/g, '&'));
  const internal = [...new Set(links.filter((l) => l.startsWith('/') && !l.startsWith('//')))];
  const external = [...new Set(links.filter((l) => /^https?:\/\//.test(l) && !/computerscienceguide\.com/.test(l)))];
  const broken = [];
  for (const l of internal) {
    const target = fileFor(dir, l);
    if (!target) { broken.push(l); continue; }
    const frag = l.split('#')[1];
    if (frag && target.endsWith('.html') && !fs.readFileSync(target, 'utf8').includes(`id="${frag}"`)) broken.push(l);
  }
  for (const frag of [...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1])) {
    if (!html.includes(`id="${frag}"`)) broken.push('#' + frag);
  }
  const placeholders = [...main.replace(/<pre[\s\S]*?<\/pre>/g, '').matchAll(/lorem ipsum|coming soon|XXXXXXXX|\bTBD\b|NEEDS_MARKUS/gi)].map((m) => m[0]);
  return {
    words,
    codeBlocks: (main.match(/<pre/g) ?? []).length,
    // Content figures only: <figure> elements in the page body. Icon <svg>s and the <svg>/<img> inside a figure are not extra figures.
    figures: (main.match(/<figure[\s>]/g) ?? []).length,
    h1: (html.match(/<h1/g) ?? []).length,
    title: (html.match(/<title>([^<]*)/) ?? [])[1] ?? null,
    description: (html.match(/<meta name="description" content="([^"]*)/) ?? [])[1] ?? null,
    canonical: (html.match(/<link rel="canonical" href="([^"]*)/) ?? [])[1] ?? null,
    jsonLdTypes: [...html.matchAll(/"@type":\s*"([^"]+)"/g)].map((m) => m[1]),
    internalLinks: internal.length,
    external,
    broken: [...new Set(broken)],
    placeholders,
  };
}

async function checkExternal(urls) {
  const bad = [];
  await Promise.all(urls.map(async (u) => {
    try {
      const ctl = AbortSignal.timeout(15000);
      let r = await fetch(u, { method: 'HEAD', redirect: 'follow', signal: ctl, headers: { 'user-agent': 'Mozilla/5.0 link-check' } });
      if (r.status >= 400) r = await fetch(u, { redirect: 'follow', signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'Mozilla/5.0 link-check' } });
      // 403/429 usually mean bot-blocking rather than a dead link; report separately as "unverified".
      if (r.status >= 400) bad.push({ url: u, status: r.status, unverified: [401, 403, 429, 999].includes(r.status) });
    } catch (e) {
      bad.push({ url: u, status: String(e.cause?.code ?? e.name) });
    }
  }));
  return bad;
}

const slug = (route) => route.replace(/^\/|\/$/g, '').replace(/[\/.]/g, '__') || 'home';

// sirv's `dev: true` mode serves every response uncompressed (no gzip/brotli negotiation), which
// makes this tool's private preview measurably heavier over the wire than the compressed responses
// a real host (Azure Static Web Apps) sends. That skews Lighthouse's document-latency / FCP / LCP
// audits low for no reason related to the article's actual content. Wrap the handler so text assets
// get compressed exactly the way a static host would, matching what Lighthouse would see in production.
const COMPRESSIBLE = /^(text\/|application\/(javascript|json|xml|manifest\+json)|image\/svg)/;
function withCompression(handler) {
  return (req, res) => {
    const acceptEncoding = req.headers['accept-encoding'] || '';
    const encoding = /\bbr\b/.test(acceptEncoding) ? 'br' : /\bgzip\b/.test(acceptEncoding) ? 'gzip' : null;
    // sirv sends its response via a single `res.writeHead(code, headers)` call (see its send() helper),
    // not incremental res.setHeader() calls — so headers land on the wire before a naive res.end()
    // override ever runs, and rewriting them afterwards throws (headers already sent) or silently no-ops.
    // Intercept writeHead too: hold the status/headers back, buffer the body, and only flush both together
    // once we know whether to compress, so Content-Encoding/Content-Length always describe the real bytes.
    const chunks = [];
    let pendingStatus = 200;
    let pendingHeaders = {};
    const originalWriteHead = res.writeHead.bind(res);
    const originalEnd = res.end.bind(res);
    res.writeHead = (code, headers) => {
      pendingStatus = code;
      if (headers) pendingHeaders = { ...pendingHeaders, ...headers };
      return res;
    };
    res.setHeader = (name, value) => { pendingHeaders[name] = value; return res; };
    res.write = (chunk) => { if (chunk) chunks.push(Buffer.from(chunk)); return true; };
    res.end = (chunk) => {
      if (chunk) chunks.push(Buffer.from(chunk));
      const body = Buffer.concat(chunks);
      const headerEntries = Object.entries(pendingHeaders);
      const contentType = String(pendingHeaders['Content-Type'] ?? pendingHeaders['content-type'] ?? '');
      if (!encoding || body.length < 256 || !COMPRESSIBLE.test(contentType)) {
        originalWriteHead(pendingStatus, pendingHeaders);
        originalEnd(body);
        return;
      }
      const compressed = encoding === 'br' ? zlib.brotliCompressSync(body) : zlib.gzipSync(body);
      const finalHeaders = {};
      for (const [k, v] of headerEntries) if (!/^content-length$/i.test(k)) finalHeaders[k] = v;
      finalHeaders['Content-Encoding'] = encoding;
      finalHeaders['Content-Length'] = compressed.length;
      finalHeaders['Vary'] = 'Accept-Encoding';
      originalWriteHead(pendingStatus, finalHeaders);
      originalEnd(compressed);
    };
    handler(req, res);
  };
}

async function main() {
  // Each run serves its own private build (removed on exit); --no-build serves the project's dist/ instead.
  const ownBuild = !flags.has('--no-build');
  const built = ownBuild ? build() : path.join(root, 'dist');
  if (ownBuild) process.on('exit', () => fs.rmSync(built, { recursive: true, force: true }));
  if (flags.has('--all') || routes.length === 0) routes = listRoutes(built);

  const server = http.createServer(withCompression(sirv(built, { dev: true, single: false })));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;

  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--remote-debugging-port=0'] });
  const debugPort = Number(new URL(browser.wsEndpoint()).port);
  const summary = [];

  for (const route of routes) {
    const dir = path.join(outRoot, slug(route));
    fs.mkdirSync(dir, { recursive: true });
    const report = { route, checkedAt: new Date().toISOString(), ...analyseHtml(built, route) };
    if (report.words === undefined) {
      report.failures = ['route not found in build'];
      summary.push(report);
      continue;
    }

    const consoleLog = [];
    for (const [device, viewport] of [['desktop', { width: 1366, height: 900 }], ['mobile', { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]]) {
      for (const theme of ['light', 'dark']) {
        const page = await browser.newPage();
        await page.setViewport(viewport);
        await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }]);
        await page.evaluateOnNewDocument((t) => { try { localStorage.setItem('theme', t); } catch {} }, theme);
        // Third-party analytics/ads are blocked here so console logs reflect our own code only.
        await page.setRequestInterception(true);
        page.on('request', (req) => (/googletagmanager|googlesyndication|google-analytics|doubleclick/.test(req.url()) ? req.abort() : req.continue()));
        page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) consoleLog.push({ device, theme, type: m.type(), text: m.text() }); });
        page.on('pageerror', (e) => consoleLog.push({ device, theme, type: 'pageerror', text: String(e) }));
        page.on('requestfailed', (req) => { if (req.url().startsWith(origin)) consoleLog.push({ device, theme, type: 'requestfailed', text: req.url() }); });
        page.on('response', (res) => { if (res.status() >= 400 && res.url().startsWith(origin)) consoleLog.push({ device, theme, type: 'http' + res.status(), text: res.url() }); });
        await page.goto(origin + route, { waitUntil: 'networkidle0', timeout: 60000 });
        if (device === 'mobile' && theme === 'light') {
          report.mobileOverflowPx = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        }
        // Above-the-fold crop is what a reviewer sees first.
        await page.screenshot({ path: path.join(dir, `${device}-${theme}-fold.png`) });
        // The whole page, in numbered segments. One full-page image of a long article exceeds Chrome's
        // 16384 px texture limit (content repeats) and is unreadable when scaled down for review.
        for (const f of fs.readdirSync(dir)) if (f.startsWith(`${device}-${theme}-part`) || f === `${device}-${theme}.png`) fs.rmSync(path.join(dir, f));
        const total = await page.evaluate(() => document.documentElement.scrollHeight);
        const segment = device === 'mobile' ? 1500 : 1800;
        for (let y = 0, n = 1; y < total; y += segment, n++) {
          await page.screenshot({
            path: path.join(dir, `${device}-${theme}-part${String(n).padStart(2, '0')}.png`),
            clip: { x: 0, y, width: viewport.width, height: Math.min(segment, total - y) },
            captureBeyondViewport: true,
          });
        }
        report.screenshotParts = { ...(report.screenshotParts ?? {}), [`${device}-${theme}`]: Math.ceil(total / segment) };
        await page.close();
      }
    }
    report.consoleErrors = consoleLog.filter((c) => c.type !== 'warning');
    report.consoleWarnings = consoleLog.filter((c) => c.type === 'warning');

    if (flags.has('--external')) report.externalBroken = await checkExternal(report.external);

    if (!flags.has('--no-lighthouse')) {
      const lh = await lighthouse(origin + route, { port: debugPort, output: 'json', logLevel: 'error', onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'] });
      const cats = lh.lhr.categories;
      report.lighthouse = Object.fromEntries(Object.entries(cats).map(([k, v]) => [k, Math.round((v.score ?? 0) * 100)]));
      const failing = Object.values(lh.lhr.audits)
        .filter((a) => a.score !== null && a.score < 0.9 && a.scoreDisplayMode !== 'informative' && a.scoreDisplayMode !== 'notApplicable' && a.scoreDisplayMode !== 'manual')
        .map((a) => ({ id: a.id, score: a.score, title: a.title, display: a.displayValue }));
      fs.writeFileSync(path.join(dir, 'lighthouse.json'), JSON.stringify({ scores: report.lighthouse, failing }, null, 2));
      fs.writeFileSync(path.join(dir, 'lighthouse-full.json'), lh.report);
    }

    const failures = [];
    if (report.broken.length) failures.push(`broken internal links: ${report.broken.join(', ')}`);
    if (report.externalBroken?.some((b) => !b.unverified)) failures.push(`broken external links: ${report.externalBroken.filter((b) => !b.unverified).map((b) => b.url).join(', ')}`);
    if (report.consoleErrors.length) failures.push(`${report.consoleErrors.length} console/network errors`);
    if (report.placeholders.length) failures.push(`placeholder text: ${[...new Set(report.placeholders)].join(', ')}`);
    if (report.h1 !== 1) failures.push(`expected exactly one <h1>, found ${report.h1}`);
    if (report.mobileOverflowPx > 1) failures.push(`mobile horizontal overflow ${report.mobileOverflowPx}px`);
    for (const [k, v] of Object.entries(report.lighthouse ?? {})) if (v < LH_MIN) failures.push(`lighthouse ${k} ${v} < ${LH_MIN}`);
    report.failures = failures;
    report.pass = failures.length === 0;

    fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(report, null, 2));
    summary.push(report);
    const lhs = report.lighthouse ? Object.values(report.lighthouse).join('/') : '-';
    console.log(`${report.pass ? 'PASS' : 'FAIL'} ${route}  words=${report.words} code=${report.codeBlocks} fig=${report.figures} lh(p/a/bp/seo)=${lhs}${failures.length ? '\n     ' + failures.join('\n     ') : ''}`);
  }

  await browser.close();
  server.close();

  // Merge into the roll-up so partial runs don't erase earlier results.
  const summaryPath = path.join(outRoot, 'summary.json');
  const prior = fs.existsSync(summaryPath) ? JSON.parse(fs.readFileSync(summaryPath, 'utf8')) : {};
  for (const r of summary) prior[r.route] = { pass: r.pass ?? false, words: r.words, lighthouse: r.lighthouse, failures: r.failures, checkedAt: r.checkedAt };
  fs.writeFileSync(summaryPath, JSON.stringify(prior, null, 2));
  console.log(`\nArtifacts: ${path.relative(root, outRoot)}${path.sep}<page>${path.sep}`);
  process.exit(summary.every((r) => r.pass) ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(2); });
