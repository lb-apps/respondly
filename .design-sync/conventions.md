## Respondly conventions

Respondly is a WhatsApp management dashboard for businesses (hotels first). The UI
is shadcn/ui (New York, `radix-rhea` style, `mist` base) on Tailwind v4, with every
colour and radius coming from CSS custom properties. Product surfaces are
**Turkish-first** — write UI copy in Turkish unless asked otherwise.

### Setup

No global wrapper is required: colours, fonts and radii live in `styles.css`, so
linking it is enough for components to look right. Three components need their own
provider, and render unstyled or throw without it:

- `SidebarProvider` — wrap anything using `Sidebar*` (it owns open/collapsed state).
- `TooltipProvider` — wrap `Tooltip` (one provider near the root is enough).
- `DirectionProvider` — only for RTL (`dir="rtl"`); LTR needs nothing.

Dark mode is class-based (`@custom-variant dark (&:is(.dark *))`): put `class="dark"`
on `<html>` or any ancestor and every token flips. Never hand-write a second palette.

Fonts: **Inter** ships with the bundle and `--font-sans` is already bound to it. Use
`font-sans` (body) and `font-heading` (headings) — do not import a webfont.

### Styling idiom

Tailwind v4 utility classes, and **colour only ever through semantic token classes** —
never `bg-blue-500`, never a raw hex or `oklch()` in a component.

| Family | Classes |
|---|---|
| Surfaces | `bg-background` `bg-card` `bg-popover` `bg-muted` `bg-accent` `bg-secondary` `bg-primary` `bg-destructive` `bg-input` |
| Text | `text-foreground` `text-muted-foreground` `text-card-foreground` `text-popover-foreground` `text-primary-foreground` `text-secondary-foreground` `text-accent-foreground` `text-destructive` |
| Lines / focus | `border-border` `ring-ring` `divide-border` |
| Sidebar | `bg-sidebar` `text-sidebar-foreground` `bg-sidebar-accent` `border-sidebar-border` |
| Charts | `bg-chart-1` … `bg-chart-5` (also `fill-`/`stroke-`) |
| Chat | `bg-bubble-sent` `text-bubble-sent-foreground` (outbound WhatsApp bubbles) |
| Radius | `rounded-sm` `rounded-md` `rounded-lg` `rounded-xl` `rounded-2xl` `rounded-3xl` `rounded-4xl` — all derived from `--radius`; this system is round, prefer `rounded-2xl` and up on containers |
| Type | `font-sans` `font-heading`, `text-xs`…`text-4xl`, `font-medium` `font-semibold` |
| Layout | `flex` `grid` `gap-*` `p-*` `m-*` `w-*` `max-w-*` `items-*` `justify-*`, `sm:`/`md:`/`lg:` variants |

Prefer the component's own props over utility overrides: `Button` has `variant`
(`default` `secondary` `outline` `ghost` `link` `destructive`) and `size`
(`xs` `sm` `default` `lg` `xl` `icon` `icon-xs` `icon-sm` `icon-lg`) plus `loading`;
`Badge`, `Item`, `Bubble` and `Alert` carry their own `variant` scales. Icons come
from `lucide-react` and are sized by the component — pass `<Plus />` as a child, no
size class needed.

The stylesheet is compiled from this repo's own sources plus a safelisted utility
set, so stay inside the families above; an exotic utility (`mt-[37px]`,
`bg-emerald-400`) may not exist in the shipped CSS. Arbitrary one-offs belong in an
inline `style` if they are truly needed.

### Where the truth is

- `_ds/<folder>/styles.css` and its `@import`s (`_ds_bundle.css`, `fonts/fonts.css`) —
  the real tokens and component CSS. Read them before inventing a class.
- `components/<group>/<Name>/<Name>.prompt.md` — usage; `<Name>.d.ts` — the exact props.
- Groups mirror the DS pane: `actions` `forms` `overlays` `navigation` `data-display`
  `feedback` `layout` `chat`.

`recharts` and `react-hook-form` are merged into `window.Respondly`, so charts built
with `ChartContainer` and forms built with `Form`/`FormField` share the library's own
copies — import them normally.

### Idiomatic example

```jsx
<Card className="max-w-sm">
  <CardHeader>
    <CardTitle>WhatsApp Business</CardTitle>
    <CardDescription>
      Numaranız Meta Cloud API üzerinden bağlı.
    </CardDescription>
    <CardAction>
      <Badge variant="secondary">Bağlı</Badge>
    </CardAction>
  </CardHeader>
  <CardContent className="text-muted-foreground">
    +90 555 000 00 00 · Son senkronizasyon 2 dakika önce
  </CardContent>
  <CardFooter className="gap-2">
    <Button size="sm">Ayarları aç</Button>
    <Button size="sm" variant="ghost">Bağlantıyı kes</Button>
  </CardFooter>
</Card>
```
