// Compiles the app's Tailwind v4 entry (src/app/globals.css) into a static
// stylesheet the design-sync bundle can ship. Tailwind v4 scans sources
// relative to the input file's project root, so we compile the real file
// in place and only redirect the output.
import { readFileSync, writeFileSync } from 'node:fs';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';

const input = 'src/app/globals.css';
const output = '.design-sync/build/tailwind.css';
// Tailwind only emits classes it finds in the repo's own sources, so a design
// built in Claude Design could reach for a utility this stylesheet never
// compiled. Safelist the layout/spacing/type/token vocabulary the design agent
// composes with (the conventions header documents exactly this set).
const SAFELIST = [
  '{,sm:,md:,lg:}{block,inline-block,flex,inline-flex,grid,hidden}',
  '{,sm:,md:,lg:}{flex-col,flex-row,flex-wrap,flex-1,shrink-0,grow}',
  '{,sm:,md:,lg:}{items-start,items-center,items-end,items-baseline}',
  '{,sm:,md:,lg:}{justify-start,justify-center,justify-end,justify-between,justify-around}',
  '{,sm:,md:,lg:}{grid-cols-1,grid-cols-2,grid-cols-3,grid-cols-4,grid-cols-6,grid-cols-12}',
  '{,sm:,md:,lg:}{col-span-1,col-span-2,col-span-3,col-span-4,col-span-6,col-span-full}',
  '{,sm:,md:,lg:}{gap,gap-x,gap-y}-{0,1,1.5,2,2.5,3,4,5,6,8,10,12}',
  '{,sm:,md:,lg:}{p,px,py,pt,pr,pb,pl}-{0,1,1.5,2,2.5,3,4,5,6,8,10,12,16}',
  '{,sm:,md:,lg:}{m,mx,my,mt,mr,mb,ml}-{0,1,2,3,4,5,6,8,10,12,auto}',
  '{,sm:,md:,lg:}{space-y,space-x}-{1,1.5,2,3,4,6,8}',
  '{,sm:,md:,lg:}{w,h}-{full,auto,fit,screen,px,4,5,6,8,10,12,16,20,24,32,40,48,64}',
  '{,sm:,md:,lg:}{max-w,min-w}-{none,full,fit,xs,sm,md,lg,xl,2xl,3xl,4xl,5xl,6xl,7xl}',
  '{,sm:,md:,lg:}{text-left,text-center,text-right}',
  'text-{xs,sm,base,lg,xl,2xl,3xl,4xl,5xl}',
  'font-{sans,heading,normal,medium,semibold,bold}',
  '{leading,tracking}-{none,tight,snug,normal,relaxed,wide}',
  '{truncate,text-balance,text-pretty,whitespace-nowrap,break-words,line-clamp-1,line-clamp-2,line-clamp-3}',
  '{bg,text,border,ring,fill,stroke,divide}-{background,foreground,card,card-foreground,popover,popover-foreground,primary,primary-foreground,secondary,secondary-foreground,muted,muted-foreground,accent,accent-foreground,destructive,border,input,ring,chart-1,chart-2,chart-3,chart-4,chart-5,sidebar,sidebar-foreground,sidebar-accent,sidebar-border,transparent,current}',
  '{border,border-t,border-r,border-b,border-l,border-x,border-y}-{0,2,4}',
  '{border,border-t,border-r,border-b,border-l,border-x,border-y}',
  'rounded{,-none,-sm,-md,-lg,-xl,-2xl,-3xl,-4xl,-full}',
  'shadow{,-xs,-sm,-md,-lg,-xl,-none}',
  '{relative,absolute,fixed,sticky,static,inset-0,top-0,right-0,bottom-0,left-0,z-10,z-20,z-50}',
  '{overflow-hidden,overflow-auto,overflow-x-auto,overflow-y-auto,shrink,object-cover,object-contain}',
  '{opacity-0,opacity-50,opacity-60,opacity-70,opacity-80,opacity-100,cursor-pointer,select-none,pointer-events-none}',
  '{hover:,focus:,focus-visible:,disabled:}{opacity-80,underline,bg-accent,bg-muted,text-foreground,text-muted-foreground}',
  '{aspect-square,aspect-video,size-4,size-5,size-6,size-8,size-10,size-12,size-16}',
];
// Tailwind's automatic source detection skips dot-directories, so classes used
// only in .design-sync/previews/ never compile unless the directory is named.
const EXTRA_SOURCES = '\n@source "../../.design-sync/previews";\n';
const css =
  readFileSync(input, 'utf8') +
  EXTRA_SOURCES +
  '\n' +
  SAFELIST.map((p) => `@source inline(${JSON.stringify(p)});`).join('\n') +
  '\n';
const res = await postcss([tailwind()]).process(css, { from: input, to: output });
// The app injects --font-sans at runtime via next/font (@theme leaves it as a
// self-reference), so the compiled sheet alone resolves to the browser's serif
// fallback. The bundle ships Inter itself (build-fonts.mjs) — bind the variable
// to it, unlayered so it wins over the @layer theme self-reference.
const FONT_BINDING =
  '\n/* design-sync: bind --font-sans to the Inter faces shipped in fonts/ */\n' +
  ':root { --font-sans: Inter, ui-sans-serif, system-ui, sans-serif; }\n';
writeFileSync(output, res.css + FONT_BINDING);
console.error(`css: ${output} — ${(res.css.length / 1024).toFixed(1)} KB`);
