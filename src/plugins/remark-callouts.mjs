// Remark plugin (runs after remark-directive): turns container directives into callouts.
//
//   :::note[Optional title]      :::warning      :::pitfall      :::dotnet
//   ::::exercise[Optional title]
//   Question text...
//   :::solution
//   Answer...
//   :::
//   ::::
//
// remark-directive also parses inline `:name` and leaf `::name` syntax. Technical prose is full of
// accidental matches ("std::vector", "key:value"), so every directive we do not own is put back
// exactly as the author typed it.

import { visit, SKIP } from 'unist-util-visit';

// Icons are CSS masks (global.css), not inline SVG, so they do not count as figures in verify-page.
const CALLOUTS = {
  note: 'Note',
  warning: 'Warning',
  pitfall: 'Common pitfall',
  dotnet: 'In .NET',
  exercise: 'Exercise',
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const textOf = (node) => (node.value ?? (node.children ?? []).map(textOf).join(''));

export default function remarkCallouts() {
  return (tree, file) => {
    const source = String(file.value ?? '');
    let exerciseNo = 0;

    visit(tree, (node, index, parent) => {
      if (node.type === 'textDirective' || node.type === 'leafDirective') {
        // Not ours: restore the literal source text.
        const start = node.position?.start?.offset;
        const end = node.position?.end?.offset;
        const literal = start != null && end != null ? source.slice(start, end) : `:${node.name}`;
        parent.children[index] = { type: 'text', value: literal };
        return [SKIP, index + 1];
      }
      if (node.type !== 'containerDirective') return;

      const labelNode = node.children[0]?.data?.directiveLabel ? node.children.shift() : null;
      const label = labelNode ? textOf(labelNode).trim() : '';

      if (node.name === 'solution') {
        node.data = { hName: 'details', hProperties: { class: 'solution' } };
        node.children.unshift({ type: 'html', value: `<summary>${esc(label || 'Show solution')}</summary>` });
        return;
      }

      const base = CALLOUTS[node.name];
      if (!base) {
        file.message(`Unknown directive ":::${node.name}". Known: ${Object.keys(CALLOUTS).join(', ')}, solution.`, node);
        node.data = { hName: 'div' };
        return;
      }
      let title = label || base;
      if (node.name === 'exercise') {
        exerciseNo += 1;
        title = label ? `Exercise ${exerciseNo}: ${label}` : `Exercise ${exerciseNo}`;
      }
      node.data = { hName: 'div', hProperties: { class: `callout callout-${node.name}`, role: 'note' } };
      node.children.unshift({ type: 'html', value: `<p class="callout-title">${esc(title)}</p>` });
    });
  };
}
