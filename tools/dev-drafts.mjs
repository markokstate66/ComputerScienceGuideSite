#!/usr/bin/env node
// `npm run dev:drafts`: the dev server with `draft: true` articles included, on the port the
// playtest page links to. A plain env-var prefix is not portable between PowerShell and bash.
import { spawn } from 'node:child_process';

const child = spawn('npx', ['astro', 'dev', '--port', '4321', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, INCLUDE_DRAFTS: '1' },
});
child.on('exit', (code) => process.exit(code ?? 0));
