# design-sync notes — Respondly

## What this repo is

Respondly is a Next.js **application**, not a published component library, so the
converter's normal `dist/` entry doesn't exist. Three generator scripts build the
package shape it needs. `cfg.buildCmd` runs them in order:

| Script | Produces | Why |
|---|---|---|
| `build-css.mjs` | `.design-sync/build/tailwind.css` | Tailwind v4 compiled from `src/app/globals.css` via postcss. Also appends the `--font-sans` binding and the utility safelist (below). |
| `build-fonts.mjs` | `.design-sync/fonts/` | Copies the Inter faces next/font generated under `.next/dev` + an `@font-face` css. **Committed** — a fresh clone has no `.next`, and re-extraction needs `npm run dev` to have run once. |
| `build-pkg.mjs` | `.design-sync/pkg/` | Barrel over `src/components/ui/*.tsx` + a real `.d.ts` tree (`tsc --emitDeclarationOnly`) + `styles.css`. This is `cfg.entry`'s package. |
| `build-docs.mjs` | `.design-sync/docs/` | One frontmatter-only `<Name>.md` per component carrying `category:`. Grouping only — an empty body still gets the synthesized `.prompt.md`. |

`.design-sync/pkg/`, `docs/`, `build/` are generated and gitignored; `fonts/`,
`previews/`, `config.json`, `NOTES.md`, `conventions.md` are committed.

## Gotchas paid for once

- **Never `--node-modules` without `cfg.entry`.** `PKG_DIR` would become
  `node_modules/respondly`. Symlinking the repo there (`ln -s .. node_modules/respondly`)
  makes ts-morph glob through the self-link and OOM node at 4 GB. `cfg.entry` pointing
  into `.design-sync/pkg/` is what keeps `PKG_DIR` small.
- **Tailwind only compiles classes it finds in the repo.** A design the agent builds in
  Claude Design can reach for utilities this stylesheet never emitted — hence the
  `SAFELIST` in `build-css.mjs` (`@source inline(...)`). Extending the agent's usable
  vocabulary means extending that list, and `conventions.md` must keep naming the same set.
  Note `.design-sync/previews/` is NOT gitignored, so classes used in authored previews
  are picked up by Tailwind's source scan — but only if `build-css.mjs` runs after them.
- **`--font-sans` is a self-reference in `globals.css`** (`@theme inline` expects next/font
  to supply it at runtime). Unbound, every design renders in the browser's serif fallback.
  `build-css.mjs` appends an unlayered `:root { --font-sans: Inter, … }` — unlayered so it
  beats the `@layer theme` self-reference. `extraFonts` only carries `@font-face` rules
  through; a `:root` block in that file is dropped.
- **Overlay components** (Dialog, Sheet, Drawer, Popover, DropdownMenu, Tooltip…): grid
  cells carry `transform: translateZ(0)`, which makes a `fixed` child position against the
  cell (height ~0) and clip. Fix is `cfg.overrides.<Name> = {"cardMode": "single",
  "viewport": "760x560"}` and then write the preview **plainly** — `open modal={false}`,
  no positioning hacks. Radix portals to `<body>`, so with `single` the fixed panel lands
  centred in the shot. `modal={false}` also drops the dimming overlay.
- **Tailwind v4 centres with the `translate` property, not `transform`.** An inline
  `transform: "none"` does not cancel `-translate-x-1/2`; `translate: "none"` does. Cost a
  full debugging cycle on Dialog before the `cardMode: single` route replaced it.
- **Any `cfg.overrides` edit needs a full `package-build.mjs`** — `preview-rebuild.mjs`
  refuses with `[CONFIG_STALE]`.
- Measuring in a browser: the in-app Browser pane starts at 0×0, so
  `getBoundingClientRect()` is meaningless until `resize_window` is called.

- **`package-build.mjs` wipes the whole `--out` dir**, `_screenshots/` included. Read a
  review sheet *before* the next build, or capture again after it.
- **Tailwind's source scan skips dot-directories**, so classes used only in
  `.design-sync/previews/` never compiled. `build-css.mjs` now emits
  `@source "../../.design-sync/previews";` — without it, a preview styled with e.g.
  `mt-48` silently renders unstyled.
- **`recharts` and `react-hook-form` are in `cfg.extraEntries`.** Both are already
  inside the bundle (chart.tsx / form.tsx import them), but a preview importing them
  by name would otherwise get a *second* copy, and the context identity mismatch makes
  `ChartContainer` paint nothing and `FormField` throw. Merging them onto
  `window.Respondly` gives previews — and designs — the library's own copies.
- **Overlay-in-a-card recipe that works**: `cfg.overrides.<Name> = {"cardMode":"single",
  "viewport":"760x560"}` + a plain `open modal={false}` composition. Applied to Dialog,
  AlertDialog, Sheet, Drawer, Popover, DropdownMenu, ContextMenu, Menubar, HoverCard,
  Tooltip, Command, AppSheet, Select, Combobox, NavigationMenu.
- **Pointer-anchored menus** (`ContextMenu`) position at the cell origin because there
  is no real right-click; the preview offsets its trigger (`mt-48 ml-64`) so menu and
  trigger are both visible.

## Deliberately not authored

- **`Toaster` (sonner)** — toasts only exist after an imperative `toast()` call, and
  `toast` is not a DS export, so a static card cannot show one. Ships the floor card.
- The 263 compound parts (`CardHeader`, `DialogTrigger`, …) ship floor cards by design:
  they are fully importable and typed, and their real render is inside the parent's
  preview. Authoring any of them later is a normal re-sync task.

## Known render warns

- `[RENDER_THIN] AttachmentAction` — "mounts have no text". Correct: the component is an
  icon-only action button, so there is no text to measure. Screenshot confirmed good.

## Re-sync risks

- **`.design-sync/pkg/`, `docs/`, `build/` are generated and gitignored.** A fresh clone
  must run `cfg.buildCmd` before the converter; `build-pkg.mjs` shells out to `npx tsc`,
  so the repo's dev dependencies have to be installed.
- **`build-fonts.mjs` needs `.next/dev` only on first extraction.** The extracted faces
  are committed under `.design-sync/fonts/`, so later runs skip it — but if Inter is ever
  swapped in `src/app/layout.tsx`, delete `.design-sync/fonts/` and re-run after
  `npm run dev`, or every design keeps rendering in the old face.
- **The safelist in `build-css.mjs` is the design agent's usable utility vocabulary.**
  `conventions.md` documents exactly that set; changing one without the other makes the
  header lie. Same for the token families — they come from `src/app/globals.css`.
- **Node here is v20 while `engines` says 24.x.** Everything above ran on 20; the
  converter and `tsc` are fine with it, but that is untested on 24.
- Preview compositions inline product copy (hotel names, phone numbers, Turkish UI
  strings). All of it is invented sample data — no real guest data is in the bundle.
- `[EXPORT_COLLISION]` on `Tooltip`/`Label` (recharts) and `Form` (react-hook-form) is
  expected: the main package's bindings win, which is what we want.
