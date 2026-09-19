// Rehype plugin for article Markdown. Must run after rehypeHeadingIds (see astro.config.mjs) so ids exist.
//   - wraps tables in a focusable scroll container and sizes their columns for phones,
//   - wraps each diagram's <svg> in its own scroll container with a minimum rendered scale,
//   - adds a permalink to every h2/h3,
//   - makes inline code wrap at sensible places instead of mid-token.

import { visit, SKIP } from 'unist-util-visit';

const textOf = (node) => (node.type === 'text' ? node.value : (node.children ?? []).map(textOf).join(''));

/** Inline code at or under this many characters never wraps. About 25 monospace characters fit every
 *  text column on a 390 px phone, including a list inside a callout. */
const NOWRAP_MAX = 25;

const el = (tagName, properties, children = []) => ({ type: 'element', tagName, properties, children });
const text = (value) => ({ type: 'text', value });
const nowrap = (value) => el('span', { className: ['nw'] }, [text(value)]);

/** Long inline code: break only at spaces, or after . _ / \ , ; ( = and "::" inside a long token,
 *  and between camelCase words of a piece that is still too long. Every piece that fits is wrapped in a
 *  no-wrap span, so a hyphen ("-t", "--oneline") is never a break point. */
function wrapLongCode(value) {
  const out = [];
  for (const token of value.split(/(\s+)/)) {
    if (!token) continue;
    if (/^\s+$/.test(token)) { out.push(text(token)); continue; }
    if (token.length <= NOWRAP_MAX) { out.push(nowrap(token)); continue; }
    const pieces = token.split(/(?<=::|[._/\\,;(=])(?=[^\s:=>])/);
    // A piece that is still too long (one 33-character identifier) may also break between camelCase words.
    const parts = pieces.flatMap((piece) => (piece.length <= NOWRAP_MAX ? [piece] : piece.split(/(?<=[a-z0-9])(?=[A-Z])/)));
    parts.forEach((part, i) => {
      if (i > 0) out.push(el('wbr', {}));
      out.push(part.length <= NOWRAP_MAX ? nowrap(part) : text(part));
    });
  }
  return out;
}

/** Column widths for phones: a cell that wraps to five lines off-screen makes every visible cell in its
 *  row look empty. Columns are classed by their longest cell; global.css turns that into min-widths. */
function sizeTableColumns(table) {
  const rows = [];
  visit(table, 'element', (n) => { if (n.tagName === 'tr') rows.push(n.children.filter((c) => c.tagName === 'td' || c.tagName === 'th')); });
  const longest = [];
  for (const cells of rows) cells.forEach((c, i) => { longest[i] = Math.max(longest[i] ?? 0, textOf(c).trim().length); });
  for (const cells of rows) {
    cells.forEach((c, i) => {
      const size = longest[i] <= 40 ? 's' : longest[i] <= 80 ? 'm' : 'l';
      c.properties = { ...c.properties, dataCol: size };
    });
  }
}

/** <figure class="diagram"><svg viewBox="0 0 W H"> ... : put the svg in a scroll container and tell CSS the
 *  viewBox width, so the drawing is never rendered below the scale at which 12-unit text is about 11 px. */
function wrapDiagrams(html) {
  return html.replace(
    /(<figure\b[^>]*\bclass="[^"]*\bdiagram\b[^"]*"[^>]*>)\s*(<svg\b[^>]*>)([\s\S]*?<\/svg>)/g,
    (all, figure, svgOpen, rest) => {
      if (all.includes('diagram-scroll')) return all;
      const w = Number((svgOpen.match(/viewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)/) ?? [])[1]);
      let svg = svgOpen;
      if (w > 0) {
        svg = /\sstyle="/.test(svgOpen)
          ? svgOpen.replace(/\sstyle="/, ` style="--vbw:${w};`)
          : svgOpen.replace(/^<svg/, `<svg style="--vbw:${w}"`);
      }
      return `${figure}<div class="diagram-scroll" tabindex="0" role="group" aria-label="Diagram (scrolls horizontally if it is wider than the screen)">${svg}${rest}</div>`;
    },
  );
}

export default function rehypeArticle() {
  return (tree) => {
    // Hand-written <figure class="diagram"> blocks are still raw HTML strings at this stage.
    visit(tree, 'raw', (node) => {
      if (node.value.includes('<figure')) node.value = wrapDiagrams(node.value);
    });
    visit(tree, 'element', (node, index, parent) => {
      if (node.tagName === 'pre') return SKIP;
      if (node.tagName === 'code' && node.children.length === 1 && node.children[0].type === 'text') {
        const value = node.children[0].value;
        if (value.length <= NOWRAP_MAX) node.properties = { ...node.properties, className: [...(node.properties?.className ?? []), 'nw'] };
        else node.children = wrapLongCode(value);
        return SKIP;
      }
      if (node.tagName === 'table' && parent && !parent.properties?.className?.includes?.('table-scroll')) {
        sizeTableColumns(node);
        parent.children[index] = {
          type: 'element',
          tagName: 'div',
          // tabindex + role/label: keyboard users must be able to scroll an overflowing region.
          properties: { className: ['table-scroll'], tabIndex: 0, role: 'region', ariaLabel: 'Table (scrolls horizontally on small screens)' },
          children: [node],
        };
        // Do not SKIP: inline code inside the cells still needs its wrapping classes. The table is now
        // inside a .table-scroll parent, so it is not wrapped twice.
        return;
      }
      if ((node.tagName === 'h2' || node.tagName === 'h3') && node.properties?.id) {
        node.children.push({
          type: 'element',
          tagName: 'a',
          properties: { className: ['heading-anchor'], href: `#${node.properties.id}`, ariaLabel: `Link to section: ${textOf(node).trim()}` },
          children: [{ type: 'text', value: '#' }],
        });
        // Not SKIP either: headings may contain inline code. The anchor has no <code>, so it is unaffected.
        return;
      }
    });
  };
}
