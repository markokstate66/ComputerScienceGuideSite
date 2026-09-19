#!/usr/bin/env node
// Code-block verifier: extracts every fenced code block from an article and really runs it.
//
//   node tools/run-code.mjs src/content/articles/algorithms/binary-search.md [more files...]
//   node tools/run-code.mjs --all
//   node tools/run-code.mjs --pillar algorithms
//
// Fence contract (see CONTENT_PLAN.md §3):
//   ```csharp run [id=name] [error=CS0165 | throws=TypeName] [args="a b"] [stdin="text"]
//   ```text output            (directly after a run block: exact expected stdout; "[...]" is a wildcard)
//   ```csharp snippet of=name (every non-blank line must appear, in order, in run block `name`)
//   ```sql run [error]        (SQLite, one in-memory database per article, blocks run in order)
//   ```bash run               (Git Bash, one throwaway directory per article, blocks run in order)
//   text/json/http/xml/diff/console/il/asm/yaml/ini/plaintext are illustrative and not executed.
// Any csharp/sql/bash block that is neither `run` nor `snippet` is a failure.
//
// Writes .verify/code/<pillar>__<slug>.json and exits non-zero on any failure.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const articlesDir = path.join(root, 'src', 'content', 'articles');
const outDir = path.join(root, '.verify', 'code');
const EXECUTABLE = new Set(['csharp', 'cs', 'sql', 'bash', 'sh']);
const ILLUSTRATIVE = new Set(['text', 'json', 'http', 'xml', 'diff', 'console', 'il', 'asm', 'yaml', 'ini', 'plaintext', 'txt', 'csv', 'html', 'css']);
const GIT_BASH = ['C:\\Program Files\\Git\\bin\\bash.exe', '/bin/bash', '/usr/bin/bash'].find((p) => fs.existsSync(p));

function findArticles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile() && /\.mdx?$/.test(e.name))
    .map((e) => path.join(e.parentPath ?? e.path, e.name))
    .sort();
}

function parseMeta(meta) {
  const out = { flags: new Set() };
  for (const m of meta.matchAll(/(\w+)=(?:"([^"]*)"|(\S+))|(\w+)/g)) {
    if (m[4]) out.flags.add(m[4]);
    else out[m[1]] = m[2] ?? m[3];
  }
  return out;
}

function extractBlocks(source) {
  const lines = source.split(/\r?\n/);
  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    const open = lines[i].match(/^(\s*)(`{3,})(\w+)?\s*(.*)$/);
    if (!open) continue;
    const [, indent, ticks, lang = '', meta] = open;
    const body = [];
    let j = i + 1;
    for (; j < lines.length && !(lines[j].trim().startsWith(ticks) && lines[j].trim().replace(/`/g, '') === ''); j++) {
      body.push(lines[j].startsWith(indent) ? lines[j].slice(indent.length) : lines[j]);
    }
    blocks.push({ lang: lang.toLowerCase(), meta: parseMeta(meta), code: body.join('\n'), line: i + 1 });
    i = j;
  }
  return blocks;
}

const norm = (s) => s.replace(/\r\n/g, '\n').split('\n').map((l) => l.trimEnd()).join('\n').trim();

function outputMatches(expected, actual) {
  const e = norm(expected).split('\n');
  const a = norm(actual).split('\n');
  if (e.length !== a.length) return false;
  return e.every((line, i) => {
    if (!line.includes('[...]')) return line === a[i];
    const re = new RegExp('^' + line.split('[...]').map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
    return re.test(a[i]);
  });
}

function renderTable(columns, rows) {
  const cells = rows.map((r) => columns.map((c) => (r[c] === null ? 'NULL' : String(r[c]))));
  const widths = columns.map((c, i) => Math.max(c.length, ...cells.map((r) => r[i].length)));
  const fmt = (r) => r.map((v, i) => v.padEnd(widths[i])).join('  ').trimEnd();
  return [fmt(columns), fmt(widths.map((w) => '-'.repeat(w))), ...cells.map(fmt)].join('\n');
}

function splitSql(sql) {
  // Split on semicolons that end a line, ignoring ones inside string literals and BEGIN...END trigger bodies.
  const stmts = [];
  let cur = '', inStr = false, depth = 0;
  const src = sql.replace(/--[^\n]*/g, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    cur += ch;
    if (ch === "'") inStr = !inStr;
    if (inStr) continue;
    if (/\bBEGIN$/i.test(cur) && /\bTRIGGER\b/i.test(cur)) depth = 1;
    if (depth && /\bEND$/i.test(cur)) depth = 0;
    if (ch === ';' && !depth) { stmts.push(cur.trim()); cur = ''; }
  }
  if (cur.trim()) stmts.push(cur.trim());
  return stmts.filter((s) => s !== ';');
}

async function verifyArticle(file) {
  const rel = path.relative(articlesDir, file).replace(/\\/g, '/');
  const key = rel.replace(/\.mdx?$/, '').replace(/\//g, '__');
  const work = fs.mkdtempSync(path.join(os.tmpdir(), `csg-${key}-`));
  const blocks = extractBlocks(fs.readFileSync(file, 'utf8'));
  const results = [];
  const runBlocks = new Map();
  let db = null, shellDir = null, n = 0;

  const fail = (b, msg, extra = {}) => results.push({ line: b.line, lang: b.lang, ok: false, message: msg, ...extra });
  const pass = (b, extra = {}) => results.push({ line: b.line, lang: b.lang, ok: true, ...extra });

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const next = blocks[i + 1];
    const expected = next && next.lang === 'text' && next.meta.flags.has('output') ? next.code : null;
    if (b.lang === 'text' && b.meta.flags.has('output')) {
      const prev = blocks[i - 1];
      if (!prev || !prev.meta.flags.has('run')) fail(b, 'output block does not follow a run block');
      continue;
    }
    if (!EXECUTABLE.has(b.lang)) {
      if (b.lang && !ILLUSTRATIVE.has(b.lang)) fail(b, `language "${b.lang}" is not in the verified or illustrative lists; use a supported one`);
      if (!b.lang) fail(b, 'code fence has no language');
      continue;
    }
    const isRun = b.meta.flags.has('run');

    if (['csharp', 'cs'].includes(b.lang)) {
      if (b.meta.of) {
        const target = runBlocks.get(b.meta.of);
        if (!target) { fail(b, `snippet refers to unknown run block id "${b.meta.of}" (the run block must appear in the same article)`); continue; }
        const hay = target.split(/\r?\n/).map((l) => l.trim());
        let pos = 0, missing = null;
        for (const line of b.code.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && l !== '// ...')) {
          const at = hay.indexOf(line, pos);
          if (at === -1) { missing = line; break; }
          pos = at + 1;
        }
        missing ? fail(b, `snippet line not found (in order) in run block "${b.meta.of}": ${missing}`) : pass(b, { kind: 'snippet' });
        continue;
      }
      if (!isRun) { fail(b, 'csharp block is neither `run` nor `snippet of=`; unverified code is not allowed'); continue; }
      const id = b.meta.id ?? `block${++n}`;
      const srcFile = path.join(work, `${id}.cs`);
      fs.writeFileSync(srcFile, b.code);
      const started = Date.now();
      const r = spawnSync('dotnet', ['run', srcFile, ...(b.meta.args ? ['--', ...b.meta.args.split(' ')] : [])], {
        cwd: work, encoding: 'utf8', timeout: 180000, input: b.meta.stdin ?? '',
        env: { ...process.env, DOTNET_CLI_UI_LANGUAGE: 'en', DOTNET_NOLOGO: '1', DOTNET_CLI_TELEMETRY_OPTOUT: '1' },
      });
      const ms = Date.now() - started;
      const all = (r.stdout ?? '') + (r.stderr ?? '');
      // Register even expected-failure blocks so later `snippet of=` excerpts can refer to them.
      runBlocks.set(id, b.code);
      if (r.error?.code === 'ETIMEDOUT') { fail(b, 'timed out after 180 s', { id }); continue; }
      if (b.meta.error) {
        r.status !== 0 && all.includes(b.meta.error) ? pass(b, { id, kind: `expected compile error ${b.meta.error}`, ms })
          : fail(b, `expected compile error ${b.meta.error}`, { id, output: all.slice(-2000) });
        continue;
      }
      if (b.meta.throws) {
        r.status !== 0 && all.includes(b.meta.throws) ? pass(b, { id, kind: `expected exception ${b.meta.throws}`, ms })
          : fail(b, `expected unhandled ${b.meta.throws}`, { id, output: all.slice(-2000) });
        if (expected !== null && !outputMatches(expected, r.stdout)) fail(next, 'stdout before the exception does not match', { expected: norm(expected), actual: norm(r.stdout) });
        continue;
      }
      if (r.status !== 0) { fail(b, `exit code ${r.status}`, { id, output: all.slice(-3000) }); continue; }
      if (/warning CS\d+/.test(all) && !b.meta.flags.has('warnings')) { fail(b, 'compiles with warnings (fix them, or add the `warnings` flag if the warning is the point)', { id, output: all.match(/.*warning CS\d+.*/g).slice(0, 5).join('\n') }); continue; }
      if (expected === null && norm(r.stdout) !== '') { fail(b, 'program prints output but the article has no `text output` block after it', { id, actual: norm(r.stdout).slice(0, 2000) }); continue; }
      if (expected !== null && !outputMatches(expected, r.stdout)) { fail(b, 'stdout does not match the article', { id, expected: norm(expected), actual: norm(r.stdout) }); continue; }
      pass(b, { id, kind: 'run', ms });
      continue;
    }

    if (!isRun) { fail(b, `${b.lang} block is not marked \`run\`; unverified code is not allowed`); continue; }

    if (b.lang === 'sql') {
      if (!db) { const { DatabaseSync } = await import('node:sqlite'); db = new DatabaseSync(':memory:'); db.exec('PRAGMA foreign_keys = ON'); }
      const rendered = [];
      let error = null;
      for (const stmt of splitSql(b.code)) {
        try {
          const s = db.prepare(stmt);
          const cols = s.columns().map((c) => c.name);
          if (cols.length) rendered.push(renderTable(cols, s.all())); else s.run();
        } catch (e) { error = e.message; break; }
      }
      if (b.meta.flags.has('error')) {
        if (!error) fail(b, 'expected this SQL to fail, but it succeeded');
        else if (expected !== null && !error.includes(norm(expected))) fail(b, 'error message does not contain the text in the output block', { expected: norm(expected), actual: error });
        else pass(b, { kind: 'expected sql error', error });
        continue;
      }
      if (error) { fail(b, `SQLite error: ${error}`); continue; }
      const actual = rendered.join('\n\n');
      if (expected === null && actual) { fail(b, 'query returns rows but the article has no `text output` block after it', { actual: actual.slice(0, 2000) }); continue; }
      if (expected !== null && !outputMatches(expected, actual)) { fail(b, 'result set does not match the article', { expected: norm(expected), actual }); continue; }
      pass(b, { kind: 'sql' });
      continue;
    }

    // bash
    if (!GIT_BASH) { fail(b, 'no bash found'); continue; }
    if (!shellDir) {
      shellDir = path.join(work, 'shell');
      fs.mkdirSync(shellDir);
      fs.writeFileSync(path.join(work, 'gitconfig'), '[user]\n\tname = Ada Example\n\temail = ada@example.com\n[init]\n\tdefaultBranch = main\n[core]\n\tautocrlf = false\n\teditor = true\n[advice]\n\tdetachedHead = false\n');
    }
    const script = path.join(work, `step${++n}.sh`);
    // Blocks behave like one terminal session: the working directory carries over from block to block,
    // so an article can `cd repo` once, exactly as a reader following along would.
    const cwdFile = path.join(work, 'cwd').replace(/\\/g, '/');
    fs.writeFileSync(script, `if [ -f "${cwdFile}" ]; then cd "$(cat "${cwdFile}")"; fi\ntrap 'pwd > "${cwdFile}"' EXIT\nset -e\n` + b.code.replace(/\r\n/g, '\n') + '\n');
    // Fixed identity and dates make commit hashes reproducible, so articles can show real hashes.
    const date = '2026-01-15T10:00:00+00:00';
    const r = spawnSync(GIT_BASH, [script], {
      cwd: shellDir, encoding: 'utf8', timeout: 60000,
      env: { ...process.env, GIT_CONFIG_GLOBAL: path.join(work, 'gitconfig'), GIT_CONFIG_NOSYSTEM: '1', GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date, GIT_PAGER: 'cat', PAGER: 'cat', TZ: 'UTC', LC_ALL: 'C' },
    });
    const okExit = b.meta.flags.has('fails') ? r.status !== 0 : r.status === 0;
    const actual = (r.stdout ?? '') + (b.meta.flags.has('stderr') ? r.stderr ?? '' : '');
    if (!okExit) { fail(b, `exit code ${r.status}${b.meta.flags.has('fails') ? ' (expected failure)' : ''}`, { output: ((r.stdout ?? '') + (r.stderr ?? '')).slice(-3000) }); continue; }
    if (expected !== null && !outputMatches(expected, actual)) { fail(b, 'shell output does not match the article', { expected: norm(expected), actual: norm(actual) }); continue; }
    pass(b, { kind: 'bash' });
  }

  db?.close();
  fs.rmSync(work, { recursive: true, force: true, maxRetries: 3 });
  const report = { file: rel, checkedAt: new Date().toISOString(), blocks: blocks.length, executed: results.filter((r) => r.ok && r.kind !== 'snippet').length, pass: results.every((r) => r.ok), results };
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `${key}.json`), JSON.stringify(report, null, 2));
  return report;
}

const argv = process.argv.slice(2);
let files = argv.filter((a) => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--pillar').map((f) => path.resolve(f));
if (argv.includes('--all')) files = findArticles(articlesDir);
if (argv.includes('--pillar')) files = findArticles(path.join(articlesDir, argv[argv.indexOf('--pillar') + 1]));
if (!files.length) { console.error('No article files given. Use a path, --pillar <name>, or --all.'); process.exit(2); }

let failed = 0;
for (const f of files) {
  const r = await verifyArticle(f);
  const bad = r.results.filter((x) => !x.ok);
  console.log(`${r.pass ? 'PASS' : 'FAIL'} ${r.file}  blocks=${r.blocks} executed=${r.executed}`);
  for (const x of bad) {
    console.log(`  line ${x.line} [${x.lang}${x.id ? ' ' + x.id : ''}]: ${x.message}`);
    if (x.expected !== undefined) console.log(`    --- expected ---\n${x.expected}\n    --- actual ---\n${x.actual}`);
    else if (x.actual) console.log(`    --- actual ---\n${x.actual}`);
    if (x.output) console.log(`    --- tool output ---\n${x.output}`);
  }
  if (!r.pass) failed++;
}
process.exit(failed ? 1 : 0);
