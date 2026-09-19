#!/usr/bin/env node
// Regenerates pr-playtest.html (repo root, git-ignored) from live GitHub data.
//
//   node tools/refresh-playtest.mjs          regenerate now
//   node tools/refresh-playtest.mjs --hook   hook mode: reads the tool-call JSON on stdin and only
//                                            regenerates when the command touched `gh pr` / `gh issue`
//
// - Open PRs  -> "Needs your playtest" cards: how to preview locally, the routes to open, and the
//                checklist parsed from the PR body's "## 🧪 Playtest instructions" section.
//                Draft PRs (an article that has not passed its round yet) are shown separately.
// - Issues    -> the queue at a glance (todo / in-progress / review / blocked-on-human).
// - Merged    -> compact "Shipped" line.
// - Follow-ups come from tools/playtest-followups.json (hand-maintained).
// Checkbox state is stored in localStorage keyed by PR number, so regenerating keeps your ticks.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = 'markokstate66/ComputerScienceGuideSite';
const LOCAL = 'http://localhost:4321';

if (process.argv.includes('--hook')) {
  let input = '';
  try { input = fs.readFileSync(0, 'utf8'); } catch {}
  let cmd = '';
  try { cmd = JSON.parse(input)?.tool_input?.command ?? ''; } catch {}
  if (!/\bgh\s+(pr|issue)\b/.test(cmd)) process.exit(0);
}

function gh(...args) {
  const env = { ...process.env };
  delete env.GH_TOKEN; // a stale injected token would override the real login
  const r = spawnSync('gh', args, { encoding: 'utf8', env, cwd: root });
  if (r.status !== 0) throw new Error(`gh ${args.slice(0, 2).join(' ')} failed: ${r.stderr}`);
  return JSON.parse(r.stdout);
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const mdInline = (s) => esc(s)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
  // A bare site route such as /databases/sql-joins/ becomes a link to the local preview.
  .replace(/(^|[\s(])(\/[a-z0-9][a-z0-9\-/]*\/)(?=$|[\s),.;])/g, `$1<a href="${LOCAL}$2" target="_blank" rel="noopener">$2</a>`);

function section(body, headingRe) {
  const m = (body ?? '').replace(/\r\n/g, '\n').match(new RegExp(`##\\s*${headingRe}[^\\n]*\\n([\\s\\S]*?)(?=\\n##\\s|$)`));
  return m ? m[1] : '';
}
function checklist(body) {
  const text = section(body, '🧪');
  const items = [...text.matchAll(/^\s*(?:\d+\.|[-*](?:\s+\[[ x]\])?)\s+([\s\S]*?)(?=^\s*(?:\d+\.|[-*])\s|$(?![\s\S]))/gm)].map((m) => m[1].replace(/\s+/g, ' ').trim());
  return items.filter(Boolean);
}
const routesOf = (body) => [...new Set([...(section(body, '🧪') + '\n' + (body ?? '').match(/\*\*Routes?:\*\*[^\n]*/)?.[0] ?? '').matchAll(/(?:^|[\s(`])(\/[a-z0-9][a-z0-9\-/]*\/)(?=$|[\s),.;`])/gm)].map((m) => m[1]))];

let prs = [], issues = [], error = null;
try {
  prs = gh('pr', 'list', '--repo', REPO, '--state', 'all', '--limit', '100', '--json', 'number,title,state,isDraft,mergedAt,body,url,headRefName,baseRefName');
  issues = gh('issue', 'list', '--repo', REPO, '--state', 'open', '--limit', '200', '--json', 'number,title,labels,url');
} catch (e) { error = e.message; }

// --demo adds two fake PRs so the card layout can be checked while no real PR is open. Writes pr-playtest.demo.html.
const demo = process.argv.includes('--demo');
if (demo) {
  const sample = (number, isDraft, title) => ({ number, title, state: 'OPEN', isDraft, url: `https://github.com/${REPO}/pull/${number}`, baseRefName: 'adsense-rebuild',
    body: 'Closes #1\n\n## 🧪 Playtest instructions\n1. Open /algorithms/binary-search/ at phone width: Figure 1 must be legible without zooming.\n2. Read the section **The bug everyone writes**: does the explanation land before the fix is shown?\n3. Toggle dark mode; check the `lower bound` output panel.\n\n## Gauntlet\nRound 2: technical 8.8 / AdSense 8.7 / design 8.6' });
  prs.push(sample(9001, false, 'DEMO — Binary Search and the Bugs Everyone Writes'), sample(9002, true, 'DEMO — What Happens When You Request a URL (round 2 of 4)'));
}

const byNum = (a, b) => a.number - b.number;
const open = prs.filter((p) => p.state === 'OPEN' && !p.isDraft).sort(byNum);
const drafts = prs.filter((p) => p.state === 'OPEN' && p.isDraft).sort(byNum);
const merged = prs.filter((p) => p.state === 'MERGED').sort(byNum);
const closed = prs.filter((p) => p.state === 'CLOSED').sort(byNum);

function card(p, isDraft) {
  const n = p.number;
  const checks = checklist(p.body);
  const routes = routesOf(p.body);
  const issue = (p.body ?? '').match(/Closes #(\d+)/i)?.[1];
  const toMaster = p.baseRefName === 'master';
  const lis = (checks.length ? checks : ['No "## 🧪 Playtest instructions" section in the PR body: read the PR description and ask the consumer to add one.'])
    .map((c) => `          <li><label><input type="checkbox"><span>${mdInline(c)}</span></label></li>`).join('\n');
  return `    <details ${isDraft ? '' : 'open'} class="card" id="pr${n}" data-pr="${n}">
      <summary><span class="prnum">#${n}</span><span class="pr-title">${esc(p.title)}</span><span class="pill ${isDraft ? 'draft' : 'open'}">${isDraft ? 'Draft: not passed yet' : 'Awaiting playtest'}</span>${toMaster ? '<span class="pill danger">targets master: deploys</span>' : ''}<span class="chev">▸</span></summary>
      <div class="card-body">
        <div class="meta">
          <a href="${p.url}" target="_blank" rel="noopener">PR #${n}</a>
          <a href="${p.url}/files" target="_blank" rel="noopener">Diff</a>${issue ? `\n          <a href="https://github.com/${REPO}/issues/${issue}" target="_blank" rel="noopener">Issue #${issue}</a>` : ''}
          <span class="base">into <code>${esc(p.baseRefName)}</code></span>
        </div>
        <div class="preview">
          <span class="label">Preview locally</span>
          <code class="copy" title="Click to copy">gh pr checkout ${n} &amp;&amp; npm run dev:drafts</code>
          ${routes.length ? `<span class="routes">then open ${routes.map((r) => `<a href="${LOCAL}${r}" target="_blank" rel="noopener">${esc(r)}</a>`).join(' ')}</span>` : ''}
        </div>
        <ul class="checks">
${lis}
        </ul>
        <p class="note">${isDraft ? 'Still in the gauntlet. The next <code>/work-next</code> run takes its next round; nothing to approve yet.' : `When it looks right: <code class="copy" title="Click to copy">/ship ${n}</code>`}</p>
      </div>
    </details>`;
}

const has = (i, l) => i.labels.some((x) => x.name === l);
const prio = (i) => ['P0', 'P1', 'P2', 'P3'].find((p) => has(i, p)) ?? 'P?';
const groups = [
  ['blocked-on-human', 'Waiting on you', (i) => has(i, 'blocked-on-human')],
  ['review', 'In review (has a PR)', (i) => has(i, 'review')],
  ['in-progress', 'Being worked', (i) => has(i, 'in-progress')],
  ['todo', 'Ready to pull', (i) => has(i, 'todo') && !has(i, 'blocked-on-human')],
  ['needs-grooming', 'Needs grooming', (i) => has(i, 'needs-grooming')],
];
const queue = groups.map(([key, label, test]) => {
  const list = issues.filter(test).sort((a, b) => prio(a).localeCompare(prio(b)) || a.number - b.number);
  if (!list.length) return '';
  const shown = list.slice(0, 12).map((i) => `<li><span class="prio ${prio(i)}">${prio(i)}</span> <a href="${i.url}" target="_blank" rel="noopener">#${i.number}</a> ${esc(i.title)}</li>`).join('\n        ');
  return `    <details class="qgroup" ${key === 'blocked-on-human' ? 'open' : ''}>
      <summary><span class="qlabel">${label}</span><span class="count">${list.length}</span></summary>
      <ul>
        ${shown}${list.length > 12 ? `\n        <li class="more">… and ${list.length - 12} more</li>` : ''}
      </ul>
    </details>`;
}).join('\n');

const needs = open.length
  ? `  <h2>Needs your playtest <span class="count">— ${open.length} open PR${open.length === 1 ? '' : 's'}</span></h2>\n  <div class="cards">\n${open.map((p) => card(p, false)).join('\n')}\n  </div>`
  : `  <h2>Needs your playtest <span class="count">— 0 open PRs</span></h2>\n  <div class="empty">Nothing is waiting on you. The next <code>/work-next</code> that finishes an issue will list its PR here with preview steps and a checklist.</div>`;
const draftHtml = drafts.length ? `  <h2>Still in the gauntlet <span class="count">— ${drafts.length} draft PR${drafts.length === 1 ? '' : 's'}</span></h2>\n  <div class="cards">\n${drafts.map((p) => card(p, true)).join('\n')}\n  </div>` : '';

const followups = JSON.parse(fs.readFileSync(path.join(root, 'tools', 'playtest-followups.json'), 'utf8'));
const fu = followups.map((f, i) => `      <li><label><input type="checkbox" data-key="fu-${i}"><span>${f.html}</span></label></li>`).join('\n');
const shipped = merged.length
  ? merged.map((p) => `<a href="${p.url}" target="_blank" rel="noopener">#${p.number}</a> ${esc(p.title.slice(0, 48))}${p.title.length > 48 ? '…' : ''}`).join(' ·\n    ')
  : 'Nothing merged yet.';
const closedNote = closed.length ? `\n  <p class="footnote">Closed without merging: ${closed.map((p) => `<a href="${p.url}" target="_blank" rel="noopener">#${p.number}</a>`).join(', ')}.</p>` : '';

const now = new Date();
const stamp = `${now.toISOString().slice(0, 10)} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
const page = fs.readFileSync(path.join(root, 'tools', 'playtest-template.html'), 'utf8')
  .replace('{{DATE}}', stamp)
  .replace('{{ERROR}}', error ? `<div class="error">Could not reach GitHub (${esc(error.slice(0, 200))}). Showing nothing live; run <code>gh auth status</code>.</div>` : '')
  .replace('{{NEEDS}}', needs)
  .replace('{{DRAFTS}}', draftHtml)
  .replace('{{QUEUE}}', queue || '<div class="empty">No open issues. Run <code>/triage</code> or <code>/new-issue</code>.</div>')
  .replace('{{FOLLOWUPS}}', fu)
  .replace('{{SHIPPED}}', shipped)
  .replace('{{CLOSED_NOTE}}', closedNote);
fs.writeFileSync(path.join(root, demo ? 'pr-playtest.demo.html' : 'pr-playtest.html'), page);
if (!process.argv.includes('--hook')) console.log(`pr-playtest.html regenerated: ${open.length} awaiting playtest, ${drafts.length} draft, ${merged.length} shipped, ${issues.length} open issues`);
