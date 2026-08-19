// Ships the app's real webfont with the bundle. next/font/google downloads
// Inter at build time and rewrites it into .next/ (gitignored), so the synced
// stylesheet would otherwise reference a --font-sans nothing defines and every
// design would render in the browser's serif fallback. This copies the faces
// next generated into .design-sync/fonts/ (committed, so re-syncs on a fresh
// clone don't need a Next build) and writes the @font-face css extraFonts
// points at. Idempotent: skips extraction once the fonts are in place.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

const OUT = '.design-sync/fonts';
const CSS = join(OUT, 'inter.css');
const VAR = ':root {\n  --font-sans: Inter, ui-sans-serif, system-ui, sans-serif;\n}\n\n';

if (existsSync(CSS) && readdirSync(OUT).some((f) => f.endsWith('.woff2'))) {
  console.error(`fonts: ${CSS} already present — skipping extraction`);
  process.exit(0);
}

const chunks = '.next/dev/static/chunks';
const src = existsSync(chunks)
  ? readdirSync(chunks).find((f) => f.includes('font_google_inter') && f.endsWith('.css'))
  : null;
if (!src) {
  console.error('fonts: no next/font css found under .next/dev — run `npm run dev` once, then re-run');
  process.exit(1);
}

const cssPath = join(chunks, src);
let css = readFileSync(cssPath, 'utf8').replace(/^\/\*.*?\*\/\n/, '');
mkdirSync(OUT, { recursive: true });
let copied = 0;
css = css.replace(/url\("([^"]+\.woff2)"\)/g, (_, rel) => {
  const abs = resolve(dirname(cssPath), rel);
  const name = basename(abs);
  copyFileSync(abs, join(OUT, name));
  copied++;
  return `url("./${name}")`;
});
writeFileSync(CSS, VAR + css);
console.error(`fonts: ${copied} Inter face(s) → ${OUT}`);
