// One-command evidence gate for a single article: static checks, code, rendered page.
//
//   node tools/gate.mjs <pillar/slug> [flags]
//   flags: --no-lighthouse   pass through to verify-page (fast pass while writing)
//          --no-verify       skip the browser pass entirely (check-article + run-code only)
//          --no-lock         do not wait for the machine-wide verify lock (see below)
//
// Runs, in order, from the checkout this script lives in (so it works inside a git worktree):
//   1. tools/check-article.mjs  -> .verify/<pillar>__<slug>/check.json
//   2. tools/run-code.mjs       -> .verify/code/<pillar>__<slug>.json
//   3. tools/verify-page.mjs --drafts /<pillar>/<slug>/ -> .verify/<pillar>__<slug>/report.json, PNGs, lighthouse.json
// and writes the combined evidence to .verify/<pillar>__<slug>/gate.json, then prints a one-screen summary.
//
// Parallel agents: verify-page makes a full private build and runs Lighthouse, which is unreliable when
// several run at once. Step 3 therefore takes a lock directory in the OS temp folder, shared by every
// checkout and worktree on this machine, so browser passes run one at a time while steps 1-2 run freely.
// A lock older than 20 minutes is treated as stale and taken over.
//
// "mechanicalPass" is the part of the definition of done a tool can decide (docs/ARTICLES_PLAN.md §3.1):
// no check-article errors, run-code green, and no verify-page failures other than the expected
// NEEDS_MARKUS byline placeholder. Critic scores are not part of it. Exit code 0 only if it passes.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const target = argv.find((a) => !a.startsWith('--'))?.replace(/^\/|\/$/g, '').replace(/\.md$/, '').replace(/^src\/content\/articles\//, '');
if (!target || !/^[a-z0-9-]+\/[a-z0-9-]+$/.test(target)) {
  console.error('usage: node tools/gate.mjs <pillar/slug> [--no-lighthouse] [--no-verify] [--no-lock]');
  process.exit(2);
}
const [pillar, slug] = target.split('/');
const key = `${pillar}__${slug}`;
const file = path.join(root, 'src/content/articles', pillar, `${slug}.md`);
const route = `/${pillar}/${slug}/`;
const outDir = path.join(root, '.verify', key);
fs.mkdirSync(outDir, { recursive: true });

const EXPECTED = [/^placeholder text: .*NEEDS_MARKUS/];

function run(label, args) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const seconds = Math.round((Date.now() - t0) / 100) / 10;
  process.stdout.write(`${label}: exit ${r.status} in ${seconds}s\n`);
  return { status: r.status, seconds, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function git(args) {
  try { return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim(); } catch { return null; }
}

const lockDir = path.join(os.tmpdir(), 'csg-verify-page.lock');
async function withLock(fn) {
  if (flags.has('--no-lock')) return fn();
  const started = Date.now();
  let announced = false;
  for (;;) {
    try {
      fs.mkdirSync(lockDir);
      fs.writeFileSync(path.join(lockDir, 'owner.json'), JSON.stringify({ route, root, pid: process.pid, at: new Date().toISOString() }));
      break;
    } catch {
      const age = Date.now() - (fs.statSync(lockDir, { throwIfNoEntry: false })?.mtimeMs ?? Date.now());
      if (age > 20 * 60 * 1000) { fs.rmSync(lockDir, { recursive: true, force: true }); continue; }
      if (!announced) {
        const owner = readJson(path.join(lockDir, 'owner.json'));
        console.log(`waiting for the verify lock (held by ${owner?.route ?? 'unknown'})...`);
        announced = true;
      }
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  const waited = Math.round((Date.now() - started) / 1000);
  try { return { ...fn(), lockWaitSeconds: waited }; } finally { fs.rmSync(lockDir, { recursive: true, force: true }); }
}

if (!fs.existsSync(file)) {
  console.error(`no article at ${path.relative(root, file)}`);
  process.exit(2);
}

const evidence = {
  route,
  file: path.relative(root, file).replace(/\\/g, '/'),
  checkedAt: new Date().toISOString(),
  git: { branch: git(['branch', '--show-current']), commit: git(['rev-parse', '--short', 'HEAD']), dirty: !!git(['status', '--porcelain', '--', path.relative(root, file)]) },
  host: { node: process.version, dotnet: (() => { try { return execFileSync('dotnet', ['--version'], { encoding: 'utf8' }).trim(); } catch { return null; } })(), os: `${os.type()} ${os.release()}` },
};

// 1. Static checks
const c = run('check-article', [path.join(root, 'tools/check-article.mjs'), file]);
const check = readJson(path.join(outDir, 'check.json'));
evidence.check = check && {
  pass: c.status === 0,
  errors: check.findings.filter((f) => f.level === 'error'),
  warnings: check.findings.filter((f) => f.level === 'warn'),
  stats: check.stats,
};

// 2. Code
const rc = run('run-code', [path.join(root, 'tools/run-code.mjs'), file]);
const code = readJson(path.join(root, '.verify/code', `${key}.json`));
evidence.runCode = {
  pass: rc.status === 0 && code?.pass === true,
  blocks: code?.blocks, executed: code?.executed,
  failures: (code?.results ?? []).filter((r) => !r.ok).map((r) => ({ line: r.line, id: r.id, reason: r.reason ?? r.error })),
  tail: rc.status === 0 ? undefined : (rc.stdout + rc.stderr).slice(-2000),
};

// 3. Rendered page
if (!flags.has('--no-verify')) {
  const vArgs = [path.join(root, 'tools/verify-page.mjs'), '--drafts'];
  if (flags.has('--no-lighthouse')) vArgs.push('--no-lighthouse');
  vArgs.push(route);
  const v = await withLock(() => run('verify-page', vArgs));
  const report = readJson(path.join(outDir, 'report.json'));
  const fresh = report && new Date(report.checkedAt) >= new Date(evidence.checkedAt);
  const failures = fresh ? report.failures ?? [] : ['verify-page produced no fresh report.json', (v.stdout + v.stderr).slice(-1500)];
  const unexpected = failures.filter((f) => !EXPECTED.some((re) => re.test(f)));
  evidence.verify = {
    pass: unexpected.length === 0,
    lockWaitSeconds: v.lockWaitSeconds,
    failures, unexpectedFailures: unexpected,
    lighthouse: fresh ? report.lighthouse ?? null : null,
    consoleErrors: fresh ? report.consoleErrors?.length : null,
    brokenInternalLinks: fresh ? report.broken?.length : null,
    mobileOverflowPx: fresh ? report.mobileOverflowPx : null,
    screenshots: fs.readdirSync(outDir).filter((f) => f.endsWith('.png')).sort().map((f) => path.join('.verify', key, f).replace(/\\/g, '/')),
  };
} else {
  evidence.verify = { skipped: true };
}

evidence.mechanicalPass = !!(evidence.check?.pass && evidence.runCode.pass && (evidence.verify.skipped || evidence.verify.pass));
evidence.note = evidence.verify.skipped
  ? 'browser pass skipped: not a complete gate'
  : 'mechanical gate only; critic scores decide the rest. Screenshots must still be opened and looked at.';
fs.writeFileSync(path.join(outDir, 'gate.json'), JSON.stringify(evidence, null, 2));

const s = evidence.check?.stats ?? {};
const lh = evidence.verify.lighthouse ? Object.values(evidence.verify.lighthouse).join('/') : '-';
console.log(`\n${evidence.mechanicalPass ? 'GATE PASS' : 'GATE FAIL'} ${route}  (${evidence.git.branch}@${evidence.git.commit}${evidence.git.dirty ? '+dirty' : ''})`);
console.log(`  check-article  ${evidence.check?.pass ? 'ok' : 'FAIL'}  errors=${evidence.check?.errors.length ?? '?'} warnings=${evidence.check?.warnings.length ?? '?'} words=${s.totalWords} prose=${s.proseWords} run=${s.runBlocks} fig=${s.figures} flesch=${s.fleschReadingEase}`);
console.log(`  run-code       ${evidence.runCode.pass ? 'ok' : 'FAIL'}  blocks=${evidence.runCode.blocks ?? '?'} executed=${evidence.runCode.executed ?? '?'}`);
if (evidence.verify.skipped) console.log('  verify-page    skipped');
else console.log(`  verify-page    ${evidence.verify.pass ? 'ok' : 'FAIL'}  lh(p/a/bp/seo)=${lh} console=${evidence.verify.consoleErrors} brokenLinks=${evidence.verify.brokenInternalLinks} overflow=${evidence.verify.mobileOverflowPx}px screenshots=${evidence.verify.screenshots.length}`);
for (const e of evidence.check?.errors ?? []) console.log(`    error L${e.line} [${e.rule}] ${e.message}`);
for (const f of evidence.runCode.failures) console.log(`    run-code: ${JSON.stringify(f)}`);
for (const f of evidence.verify.unexpectedFailures ?? []) console.log(`    verify: ${f}`);
console.log(`  evidence: ${path.join('.verify', key, 'gate.json')}`);
process.exit(evidence.mechanicalPass ? 0 : 1);
