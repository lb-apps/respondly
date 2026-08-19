// Groups the DS pane. The converter derives a component's group from its src
// directory, and every ui primitive lives in one flat src/components/ui/ — so
// all 337 exports would land in "general". A per-component doc stub carrying
// `category:` frontmatter is the documented regroup path; an empty body means
// the .prompt.md is still synthesized from the .d.ts, so these stubs only
// carry grouping.
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const UI = 'src/components/ui';
const DOCS = '.design-sync/docs';

const CATEGORY = {
  Actions: ['button', 'button-group', 'toggle', 'toggle-group', 'kbd'],
  Forms: ['input', 'input-group', 'input-otp', 'textarea', 'label', 'field', 'form', 'checkbox',
    'radio-group', 'select', 'native-select', 'combobox', 'switch', 'slider', 'phone-input',
    'currency-input', 'quantity-input', 'unit-quantity-input', 'calendar'],
  Overlays: ['dialog', 'alert-dialog', 'sheet', 'drawer', 'popover', 'hover-card', 'tooltip',
    'context-menu', 'dropdown-menu', 'command', 'menubar', 'app-sheet'],
  Navigation: ['breadcrumb', 'navigation-menu', 'pagination', 'tabs', 'sidebar'],
  'Data Display': ['table', 'card', 'item', 'badge', 'avatar', 'chart', 'carousel', 'accordion',
    'collapsible', 'marker', 'attachment'],
  Feedback: ['alert', 'progress', 'skeleton', 'spinner', 'sonner', 'empty'],
  Layout: ['separator', 'scroll-area', 'resizable', 'aspect-ratio', 'direction'],
  Chat: ['bubble', 'message', 'message-scroller'],
};

const fileCategory = new Map();
for (const [cat, files] of Object.entries(CATEGORY)) for (const f of files) fileCategory.set(f, cat);

const files = readdirSync(UI).filter((f) => f.endsWith('.tsx')).map((f) => f.replace(/\.tsx$/, ''));
const uncategorized = files.filter((f) => !fileCategory.has(f));
if (uncategorized.length) throw new Error(`uncategorized ui modules: ${uncategorized.join(', ')}`);

// PascalCase exports per module → that module's category.
const owner = new Map();
for (const f of files) {
  const src = readFileSync(`${UI}/${f}.tsx`, 'utf8');
  const names = new Set();
  for (const m of src.matchAll(/^export\s*\{([^}]*)\}/gm)) {
    for (const part of m[1].split(',')) {
      const n = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (n && /^[A-Z][A-Za-z0-9]*$/.test(n)) names.add(n);
    }
  }
  for (const m of src.matchAll(/^export\s+(?:declare\s+)?(?:const|function|class)\s+([A-Z][A-Za-z0-9]*)/gm)) {
    names.add(m[1]);
  }
  for (const n of names) if (!owner.has(n)) owner.set(n, fileCategory.get(f));
}

// The emitted tree is the authoritative name index.
const emitted = readdirSync('ds-bundle/components').flatMap((g) => readdirSync(`ds-bundle/components/${g}`));
const byLength = [...owner.keys()].sort((a, b) => b.length - a.length);

rmSync(DOCS, { recursive: true, force: true });
mkdirSync(DOCS, { recursive: true });
const missed = [];
for (const name of emitted) {
  // Compound parts (DialogTrigger) are re-exports of a Radix primitive and
  // never appear in an `export {}` list under their own name — inherit the
  // category of the longest owned name they start with.
  const cat = owner.get(name) ?? owner.get(byLength.find((p) => name.startsWith(p)) ?? '');
  if (!cat) { missed.push(name); continue; }
  writeFileSync(`${DOCS}/${name}.md`, `---\ncategory: ${cat}\n---\n`);
}
console.error(`docs: ${emitted.length - missed.length}/${emitted.length} components categorized`);
if (missed.length) console.error(`  ungrouped (stay in "general"): ${missed.join(', ')}`);
