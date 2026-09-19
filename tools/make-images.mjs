#!/usr/bin/env node
// Generates the raster images the site references, from SVG, with sharp (already installed as an
// Astro dependency). Run `npm run images` after changing a pillar title or accent colour.
//
//   public/og-default.png        1200x630 social card (site-wide default)
//   public/og/<pillar>.png       1200x630 social card per pillar, in the pillar's accent colour
//   public/apple-touch-icon.png  180x180
//   public/logo.png              512x512 (Organization JSON-LD logo)
//
// Every card is palette-quantised PNG and must stay under 100 KB; the script fails otherwise.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = path.join(root, 'public');
const MAX_BYTES = 100 * 1024;
const FONT = "Segoe UI, Arial, Helvetica, sans-serif";
const MONO = "Consolas, 'Courier New', monospace";
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function readPillars() {
  const dir = path.join(root, 'src', 'content', 'pillars');
  return fs.readdirSync(dir).filter((f) => f.endsWith('.yaml')).map((f) => {
    const text = fs.readFileSync(path.join(dir, f), 'utf8');
    const get = (re) => (text.match(re) ?? [])[1];
    return { id: f.replace(/\.yaml$/, ''), title: get(/^title:\s*"(.+)"/m), accent: get(/^\s+light:\s*"(#[0-9a-f]{6})"/im) };
  });
}

// Greedy word wrap; SVG has no text flow.
function wrap(text, maxChars) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    if ((line + ' ' + word).trim().length > maxChars && line) { lines.push(line); line = word; }
    else line = (line + ' ' + word).trim();
  }
  if (line) lines.push(line);
  return lines;
}

function card({ kicker, title, accent }) {
  const lines = wrap(title, 22);
  const size = lines.length > 2 ? 76 : 88;
  const startY = 330 - ((lines.length - 1) * size * 1.12) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0e1217"/>
  <rect width="1200" height="14" fill="${accent}"/>
  <rect x="80" y="84" width="76" height="76" rx="16" fill="#1a53c0"/>
  <text x="118" y="135" font-family="${MONO}" font-size="34" font-weight="700" fill="#ffffff" text-anchor="middle">CS</text>
  <text x="180" y="135" font-family="${FONT}" font-size="36" font-weight="600" fill="#e4e9ee">Computer Science Guide</text>
  ${lines.map((l, i) => `<text x="80" y="${Math.round(startY + i * size * 1.12)}" font-family="${FONT}" font-size="${size}" font-weight="700" fill="#ffffff">${esc(l)}</text>`).join('\n  ')}
  <text x="80" y="560" font-family="${FONT}" font-size="32" fill="#a3adb9">${esc(kicker)}</text>
</svg>`;
}

const icon = (size, radius, fontSize) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="#1a53c0"/>
  <text x="${size / 2}" y="${size / 2 + fontSize * 0.35}" font-family="${MONO}" font-size="${fontSize}" font-weight="700" fill="#ffffff" text-anchor="middle">CS</text>
</svg>`;

async function writePng(file, svg, { palette = true } = {}) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await sharp(Buffer.from(svg)).png({ palette, colours: 64, compressionLevel: 9 }).toFile(file);
  const bytes = fs.statSync(file).size;
  console.log(`${path.relative(root, file).padEnd(40)} ${(bytes / 1024).toFixed(1)} KB`);
  if (bytes > MAX_BYTES) throw new Error(`${file} is over 100 KB`);
}

await writePng(path.join(pub, 'og-default.png'), card({ kicker: 'Fundamentals explained with C# you can run', title: 'Computer science, explained properly', accent: '#1a53c0' }));
for (const p of readPillars()) {
  await writePng(path.join(pub, 'og', `${p.id}.png`), card({ kicker: 'computerscienceguide.com', title: p.title, accent: p.accent }));
}
// iOS masks the icon itself, so the touch icon is a full-bleed square.
await writePng(path.join(pub, 'apple-touch-icon.png'), icon(180, 0, 84));
await writePng(path.join(pub, 'logo.png'), icon(512, 96, 240));
