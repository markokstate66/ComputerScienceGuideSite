// Git worktrees for parallel article work, with node_modules shared safely.
//
//   node tools/worktree.mjs add <branch> [--from <base>]   create (or reuse) a worktree for <branch>
//   node tools/worktree.mjs remove <branch>                  unlink node_modules, then remove the worktree
//   node tools/worktree.mjs list
//
// Worktrees live in <os tmp>/csg-worktrees/<branch>. Each one gets node_modules as a directory junction
// to this checkout's node_modules, so no per-worktree install is needed.
//
// Why "remove" exists: deleting a worktree with a recursive delete (rm -rf, Remove-Item -Recurse,
// `git worktree remove --force` on some setups) can follow the junction and empty the MAIN checkout's
// node_modules. That happened more than once in this project (WORKLOG, 2026-09-22 entries). This script
// removes the junction itself first (fs.unlinkSync on the link, never a recursive delete through it) and
// refuses to continue if the link is still there.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = path.join(os.tmpdir(), 'csg-worktrees');
const [cmd, branch, ...rest] = process.argv.slice(2);

const git = (args, opts = {}) => execFileSync('git', args, { cwd: root, encoding: 'utf8', ...opts }).trim();
const dirFor = (b) => path.join(base, b.replace(/[\\/]/g, '__'));

function isLink(p) {
  try { return fs.lstatSync(p).isSymbolicLink(); } catch { return false; }
}

function add() {
  const from = rest.includes('--from') ? rest[rest.indexOf('--from') + 1] : 'adsense-rebuild';
  const dir = dirFor(branch);
  fs.mkdirSync(base, { recursive: true });
  if (!fs.existsSync(dir)) {
    const exists = (() => { try { git(['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`]); return true; } catch { return false; } })();
    git(exists ? ['worktree', 'add', dir, branch] : ['worktree', 'add', '-b', branch, dir, from], { stdio: 'pipe' });
  }
  const nm = path.join(dir, 'node_modules');
  const mainNm = path.join(root, 'node_modules');
  if (!fs.existsSync(path.join(mainNm, 'astro'))) {
    console.error(`main checkout node_modules looks empty (${mainNm}); run "npm ci" there first`);
    process.exit(1);
  }
  if (!fs.existsSync(nm)) fs.symlinkSync(mainNm, nm, 'junction');
  const current = execFileSync('git', ['branch', '--show-current'], { cwd: dir, encoding: 'utf8' }).trim();
  if (current !== branch) {
    console.error(`worktree ${dir} is on "${current}", expected "${branch}"`);
    process.exit(1);
  }
  console.log(dir);
}

function remove() {
  const dir = dirFor(branch);
  if (!fs.existsSync(dir)) { console.log(`no worktree at ${dir}`); return; }
  const status = execFileSync('git', ['status', '--porcelain'], { cwd: dir, encoding: 'utf8' }).split('\n')
    .filter((l) => l.trim() && !/ node_modules$/.test(l));
  if (status.length && !rest.includes('--force')) {
    console.error(`worktree ${dir} has uncommitted changes; commit them or pass --force:\n${status.join('\n')}`);
    process.exit(1);
  }
  const nm = path.join(dir, 'node_modules');
  if (isLink(nm)) fs.unlinkSync(nm);
  if (isLink(nm) || fs.existsSync(nm)) {
    console.error(`refusing to remove ${dir}: node_modules is still present and may point at the main checkout`);
    process.exit(1);
  }
  git(['worktree', 'remove', ...(rest.includes('--force') ? ['--force'] : []), dir], { stdio: 'pipe' });
  if (!fs.existsSync(path.join(root, 'node_modules', 'astro'))) console.error('WARNING: main node_modules is missing astro after removal; run npm ci');
  console.log(`removed ${dir}`);
}

if (cmd === 'add' && branch) add();
else if (cmd === 'remove' && branch) remove();
else if (cmd === 'list') console.log(git(['worktree', 'list']));
else {
  console.error('usage: node tools/worktree.mjs add <branch> [--from <base>] | remove <branch> [--force] | list');
  process.exit(2);
}
