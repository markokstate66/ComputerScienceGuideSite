// Remark plugin: renders every fenced code block to final HTML at the Markdown stage.
//
// Doing this in remark (not rehype) means the fence meta string and the neighbouring blocks are
// both still available, so we can:
//   - keep the run-code contract words (run, snippet of=, id=, error=, throws=, args=, stdin=,
//     warnings, fails, stderr, output) out of the page,
//   - attach a ```text output block to the program directly above it,
//   - add the language label, status label and copy button.
// Highlighting uses Shiki with two themes; colours are emitted as CSS variables
// (--shiki-light / --shiki-dark) and global.css picks one based on <html data-theme>.

import { createHighlighter } from 'shiki';

const THEMES = { light: 'github-light-default', dark: 'github-dark-default' };
// github-light-default's comment grey is 4.27:1 on our code background; this one is 5.9:1.
const COLOR_REPLACEMENTS = { '#6e7781': '#57606a' };

const LANGS = ['csharp', 'sql', 'bash', 'json', 'http', 'xml', 'diff', 'shellsession', 'asm', 'yaml', 'ini', 'html', 'css', 'powershell'];
const ALIAS = { cs: 'csharp', sh: 'bash', console: 'shellsession', plaintext: 'text', txt: 'text', il: 'text', csv: 'text' };
const LABEL = {
  csharp: 'C#', sql: 'SQL', bash: 'Bash', json: 'JSON', http: 'HTTP', xml: 'XML', diff: 'Diff', shellsession: 'Console',
  asm: 'Assembly', yaml: 'YAML', ini: 'INI', html: 'HTML', css: 'CSS', powershell: 'PowerShell', text: 'Text', il: 'IL', csv: 'CSV',
};

let highlighterPromise;
const getHighlighter = () => (highlighterPromise ??= createHighlighter({ themes: Object.values(THEMES), langs: LANGS }));

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Same grammar as tools/run-code.mjs so both tools agree on what a fence says.
function parseMeta(meta) {
  const out = { flags: new Set() };
  for (const m of (meta ?? '').matchAll(/(\w+)=(?:"([^"]*)"|(\S+))|(\w+)/g)) {
    if (m[4]) out.flags.add(m[4]);
    else out[m[1]] = m[2] ?? m[3];
  }
  return out;
}

function statusFlag(lang, meta) {
  if (meta.error) return { cls: 'error', text: `Does not compile: ${meta.error}` };
  if (meta.throws) return { cls: 'error', text: `Throws ${meta.throws}` };
  if (lang === 'sql' && meta.flags.has('error')) return { cls: 'error', text: 'Statement fails' };
  if (lang === 'bash' && meta.flags.has('fails')) return { cls: 'error', text: 'Exits with an error' };
  if (meta.of) return { cls: 'info', text: 'Excerpt' };
  return null;
}

function renderBlock(hl, node, { output = false, after = null } = {}) {
  const rawLang = (node.lang ?? 'text').toLowerCase();
  const lang = ALIAS[rawLang] ?? rawLang;
  const meta = parseMeta(node.meta);
  const known = lang === 'text' || hl.getLoadedLanguages().includes(lang);
  const pre = hl.codeToHtml(node.value, {
    lang: known ? lang : 'text',
    themes: THEMES,
    defaultColor: false,
    colorReplacements: COLOR_REPLACEMENTS,
  });
  let label = LABEL[rawLang] ?? LABEL[lang] ?? rawLang;
  if (output) label = after === 'sql' ? 'Result' : 'Output';
  const flag = output ? null : statusFlag(lang, meta);
  const classes = ['code-block', output ? 'code-output' : '', flag?.cls === 'error' ? 'code-fails' : ''].filter(Boolean).join(' ');
  return (
    `<div class="${classes}" data-lang="${esc(rawLang)}">` +
    `<div class="code-head"><span class="code-lang">${esc(label)}</span>` +
    (flag ? `<span class="code-flag code-flag-${flag.cls}">${esc(flag.text)}</span>` : '') +
    `<button type="button" class="copy-btn" aria-label="Copy ${output ? 'output' : 'code'} to clipboard">Copy</button></div>` +
    pre +
    `</div>`
  );
}

const isOutput = (n) => n?.type === 'code' && (n.lang ?? '').toLowerCase() === 'text' && parseMeta(n.meta).flags.has('output');

export default function remarkCodeBlocks() {
  return async (tree) => {
    const hl = await getHighlighter();
    const walk = (parent) => {
      if (!Array.isArray(parent.children)) return;
      for (let i = 0; i < parent.children.length; i++) {
        const node = parent.children[i];
        if (node.type !== 'code') { walk(node); continue; }
        if (isOutput(node)) {
          // Orphan output block (run-code.mjs reports this as an error); still render it sanely.
          parent.children[i] = { type: 'html', value: renderBlock(hl, node, { output: true }) };
          continue;
        }
        const next = parent.children[i + 1];
        if (isOutput(next)) {
          const lang = ALIAS[(node.lang ?? '').toLowerCase()] ?? (node.lang ?? '').toLowerCase();
          const html = `<div class="code-group">${renderBlock(hl, node)}${renderBlock(hl, next, { output: true, after: lang })}</div>`;
          parent.children.splice(i, 2, { type: 'html', value: html });
        } else {
          parent.children[i] = { type: 'html', value: renderBlock(hl, node) };
        }
      }
    };
    walk(tree);
  };
}
