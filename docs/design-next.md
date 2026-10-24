# Design: Arjun AI restyle, AI plan preview, owned sculpture

> **Historical document.** Written for an earlier slice of the project and not kept up to date. For how Hushwork works today read [`PROJECT.md`](../PROJECT.md) and [`DECISIONS.md`](../DECISIONS.md).
Stage 2 of the ship-it pipeline, 2026-10-16. Local only (http://localhost:3100). Figma and Notion not used. Owner decisions (do not reopen): Arjun AI Design System everywhere with Geist kept; AI plan with a keyword fallback; four sculpture images made by code in Arjun purple.
**How it was checked.** Every ratio below comes from `contrast.py` (WCAG formula, glass uses the CSS `saturate(160%)` matrix); sculpture colour, keying, particle counts and WebP size from `mock.py` (rough Pillow mock-up). Both live in the scratchpad `...\scratchpad\design-next\`, not in the repo. Not run in a browser: the builder looks at both themes once (section 7).
**Overrides.** This file beats `PRODUCT.md`, `PLAN.md` s3, `docs/design.md` and skill defaults on: glass (now allowed, 3 places), radius (6/10/16/22/pill), shadows (sm/md/lg), "no error colour" (status colours now allowed, always with icon and text), uppercase chips (sentence case). Still binding: Geist, WCAG AA both themes, reduced motion plus Pause, honest copy, no em dashes, 44px phone targets, local only.

## 1. Tokens
### 1.1 Replacement for the `:root` / `.dark` blocks in `hushwork-app/app/globals.css`
All 10 existing names stay. Added: `--sunken --line-strong --accent-hover --accent-active --accent-subtle --accent-subtle-border --on-accent --focus --success --warning --error --info --r-* --elev-* --ring --glass-* --dur-* --ease`.

```css
:root {
  color-scheme: light;
  --bg: #f7f6f9;  --surface: #ffffff;  --raised: #eeecf2;  --sunken: #eeecf2;   /* raised: hover, tiles, chips. sunken: recessed panels */
  --ink: #1c1926;  --mute: #635e73;  --hint: #635e73;                          /* gray-900, gray-600, gray-600 */
  --line: #e2dfea;  --line-strong: #cac6d6;  --field: #847f96;                 /* field = gray-500, the only 3:1 border */
  --accent: #7c3aed;  --accent-hover: #6d28d9;  --accent-active: #5b21b6;  --accent-text: #6d28d9;
  --accent-subtle: #f5f0ff;  --accent-subtle-border: #dac9ff;  --on-accent: #ffffff;  --focus: #7c3aed;
  --success: #15803d;  --warning: #b45309;  --error: #b91c1c;  --info: #1d4ed8;  /* 600 values: text-safe. Never success/warning text on --raised */
  --r-sm: 6px;  --r-md: 10px;  --r-lg: 16px;  --r-xl: 22px;
  --elev-sm: 0 1px 2px rgba(28,25,38,.06);
  --elev-md: 0 4px 12px rgba(28,25,38,.08), 0 1px 2px rgba(28,25,38,.04);
  --elev-lg: 0 16px 40px rgba(28,25,38,.12), 0 2px 8px rgba(28,25,38,.06);
  --ring: 0 0 0 7px var(--accent-subtle-border);                               /* 3px halo outside the 2px outline at 2px offset */
  --glass-bg: rgba(255,255,255,.85);  --glass-border: #e2dfea;  --glass-solid: #ffffff;  --glass-blur: blur(16px) saturate(160%);
  --dur-fast: 120ms;  --dur-base: 200ms;  --dur-slow: 340ms;  --ease: cubic-bezier(.4, 0, .2, 1);
}
.dark {
  color-scheme: dark;
  --bg: #121018;  --surface: #1c1926;  --raised: #2e2a3a;  --sunken: #0c0a10;
  --ink: #f7f6f9;  --mute: #a8a3b8;  --hint: #a8a3b8;
  --line: rgba(255,255,255,.10);  --line-strong: rgba(255,255,255,.18);  --field: rgba(255,255,255,.38);
  --accent: #7c3aed;  --accent-hover: #844bf2;  --accent-active: #6d28d9;  --accent-text: #c3a5ff;
  --accent-subtle: rgba(139,92,246,.14);  --accent-subtle-border: rgba(139,92,246,.35);  --focus: #a476ff;
  --success: #4ade80;  --warning: #fbbf24;  --error: #f87171;  --info: #60a5fa;
  --elev-sm: 0 1px 2px rgba(0,0,0,.3);  --elev-md: 0 4px 16px rgba(0,0,0,.4);  --elev-lg: 0 20px 48px rgba(0,0,0,.5);
  --glass-bg: rgba(28,25,38,.78);  --glass-border: rgba(255,255,255,.08);  --glass-solid: #1c1926;
}
```

Base rules to change in the same file (`@layer base` and unlayered):

```css
:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }       /* was accent-text. Carries the 3:1 */
.on-accent :focus-visible { outline-color: var(--on-accent); }                  /* was #fff */
:where(button, input, select, summary, [role="switch"], a[class]):focus-visible { box-shadow: var(--ring); }  /* UNLAYERED so it beats shadow utilities. No textarea: its wrapper has .field-focus */
.field-focus:focus-within { border-color: var(--accent); outline: 2px solid var(--focus); outline-offset: 2px; box-shadow: var(--ring); } /* composer box */
/* the .hw-glass rules below go in @layer components, so shadow-lg can still override */
.hw-glass { background: var(--glass-solid); border: 1px solid var(--line); box-shadow: var(--elev-md); }
@supports (backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)) {
  .hw-glass { background: var(--glass-bg); border-color: var(--glass-border); -webkit-backdrop-filter: var(--glass-blur); backdrop-filter: var(--glass-blur); }
}
@media (prefers-reduced-transparency: reduce), (prefers-contrast: more) {
  .hw-glass { background: var(--glass-solid) !important; border-color: var(--line) !important; -webkit-backdrop-filter: none !important; backdrop-filter: none !important; }
}
```
Delete the old `.hw-nav` reduced-transparency rule (replaced by `.hw-glass`). `a { color: var(--accent-text) }` and the underline rule stay.

### 1.2 `@theme inline` additions (the 10 existing colour lines and the two fonts stay)
```css
  --color-sunken: var(--sunken);  --color-line-strong: var(--line-strong);  --color-on-accent: var(--on-accent);  --color-focus: var(--focus);
  --color-accent-hover: var(--accent-hover);  --color-accent-active: var(--accent-active);
  --color-accent-subtle: var(--accent-subtle);  --color-accent-edge: var(--accent-subtle-border);
  --color-success: var(--success);  --color-warning: var(--warning);  --color-error: var(--error);  --color-info: var(--info);
  /* Radius. Use rounded-md (chip 6), rounded-xl (control or tile 10), rounded-2xl (card 16), rounded-3xl (hero panel 22), rounded-full. Do not use rounded-lg. */
  --radius-md: var(--r-sm);  --radius-xl: var(--r-md);  --radius-2xl: var(--r-lg);  --radius-3xl: var(--r-xl);   /* replaces the 12/16/24 lines */
  --shadow-sm: var(--elev-sm);  --shadow-md: var(--elev-md);  --shadow-lg: var(--elev-lg);
  --ease-standard: var(--ease);          /* ease-standard; durations are duration-120, duration-200, duration-340 */
```

### 1.3 Where Hushwork differs from the raw Arjun file (each is an AA fix unless marked)
| Arjun raw | Hushwork | Why |
|---|---|---|
| text-secondary gray-500 (light) | gray-600 `#635e73` | 3.85 on surface, 3.57 on bg: fails 4.5 |
| text-tertiary gray-400 / dark gray-600 | `--hint` = same as `--mute` | 2.44 light, 2.78 dark: fail. Placeholder is text |
| border-strong gray-300 / white .18 | `--field` gray-500 / white .38. Arjun's value kept as `--line-strong` (decorative) | 1.67 and 1.76: fail the 3:1 field border rule |
| dark accent purple-500 | `#7c3aed` (purple-600) | white on 500 is 4.23 |
| dark accent-hover purple-400, active purple-300 | `#844bf2`, `#6d28d9` | white on purple-400 is 3.18; press goes darker so white keeps 7.10 |
| dark accent text purple-400 | purple-300 `#c3a5ff` | purple-400 is 4.38 on `--raised`: fails 4.5 (alert box, tiles) |
| light accent text purple-600 | purple-700 `#6d28d9` (today's value) | more margin on tints. Not a failure |
| focus-ring purple-400 (light), accent-subtle-border as ring | solid 2px `--focus` plus Arjun's soft halo | purple-400 is 2.95 on bg; the halo alone is 1.52 |
| glass-bg alpha .6, light glass-border white .5 | .85 light, .78 dark; light border = `--line` | .6 gives secondary text 3.25 over the accent panel; white .5 is invisible on a light page |
| status 500 as text | 600 (light), Arjun dark values | 500 is 3.2 to 3.3 as text |
| Inter | Geist | owner decision (not an AA matter) |

### 1.4 Computed contrast (light / dark). Text needs 4.5, UI parts 3.0. FAIL rows are banned pairings
| Text pair | Light | Dark |
|---|---|---|
| ink on bg / surface / raised / accent-subtle | 16.03 / 17.26 / 14.73 / 15.45 | 17.52 / 16.03 / 12.93 / 13.77 |
| mute on bg / surface / raised / sunken / accent-subtle | 5.77 / 6.21 / 5.30 / 5.30 / 5.56 | 7.72 / 7.07 / 5.70 / 8.06 / 6.07 |
| hint (placeholder) on surface | 6.21 | 7.07 |
| accent-text on bg / surface / raised / accent-subtle | 6.60 / 7.10 / 6.06 / 6.36 | 9.12 / 8.34 / 6.73 / 7.16 |
| white on accent / accent-hover / accent-active | 5.70 / 7.10 / 8.98 | 5.70 / 4.92 / 7.10 |
| error text on surface / raised | 6.47 / 5.52 | 6.24 / 5.03 |
| info text on surface / raised | 6.70 / 5.72 | 6.79 / 5.48 |
| success text on surface / raised | 5.02 / **4.28 FAIL** | 9.91 / 7.99 |
| warning text on surface (unused so far) / raised | 5.02 / **4.28 FAIL** | 10.34 / 8.34 |
| On the accent panel (waitlist): white, white/90, white on `accent-active` pill | 5.70, 4.91, 8.98 | same |
| Waitlist input (now `bg-surface text-ink placeholder:text-hint`) on accent: edge, ink, placeholder | 5.70, 17.26, 6.21 | 3.03, 16.03, 7.07 |

| UI pair | Light | Dark |
|---|---|---|
| field border on surface / bg / raised | 3.85 / 3.57 / 3.28 | 3.54 / 3.57 / 3.34 |
| accent fill on surface / bg / raised | 5.70 / 5.29 / 4.86 | 3.03 / 3.31 / **2.44 FAIL** (never put an accent fill, switch track or selected segment on `--raised` in dark) |
| focus line on bg / surface / raised / sunken / accent-subtle | 5.29 / 5.70 / 4.86 / 4.86 / 5.10 | 5.94 / 5.44 / 4.38 / 6.20 / 4.67 |
| success / error / info icon on surface | 5.02 / 6.47 / 6.70 | 9.91 / 6.24 / 6.79 |

Today's waitlist success pill (`bg-white/15`) is 4.34: **fails**; use `bg-accent-active`. Decorative only, no ratio needed: `--line`, `--line-strong`, `--accent-subtle-border`.

### 1.5 Glass: final alpha and worst cases (backdrop is saturated 160% then composited, no blur averaging, so this is the worst case)
| Backdrop under the glass | Light ink / mute | Dark ink / mute |
|---|---|---|
| page bg | 17.12 / 6.16 | 16.36 / 7.21 |
| accent panel `#7c3aed` | 13.70 / 4.93 | 13.30 / 5.86 |
| sculpture shadow purple-800 (light) or highlight purple-300 (dark) | 13.30 / 4.79 | 10.26 / 4.52 |
| purple-100 specular or pure white (dark only) | n/a | 8.57 / 3.78 and 7.83 / 3.45 |

Rule: **text on glass is `--ink`** (passes everywhere, min 7.83). `--mute` text is allowed only on the app menu (backdrop can only be page surfaces or accent). Icons on glass may be `--mute` (3:1 needed, min 3.45). Raw alpha .6 fails dark ink over white (4.22), so .85 and .78 are the floor.

## 2. Restyle map
### 2.1 Global rules (apply everywhere)
- **Radius:** chip 6 (`rounded-md`), control and tile 10 (`rounded-xl`), card 16 (`rounded-2xl`), hero panel 22 (`rounded-3xl`), switch and Send `rounded-full`. Nested radius = outer minus padding (segmented items are `rounded-md`).
- **Shadow:** card at rest `shadow-sm`, hovered clickable card `shadow-md`, menus and glass `shadow-md` or `shadow-lg`. Flat rows inside a card (sample approval, tool tiles, tab rows) get border only: this is the "no nested cards" rule.
- **State recipe:** hover = one colour step (`hover:bg-accent-hover`, ghost and secondary `hover:bg-raised`), press = `active:bg-accent-active` or `active:bg-line`. No translate, no scale, no spring. Transitions `duration-120 ease-standard`.
- **Focus:** global outline plus halo (1.1). Fields (`input`, composer box) also turn `border-accent`. Never `outline-hidden` without `.field-focus` on the wrapper.
- **Spacing:** keep the 4px rhythm: replace half steps (`gap-1.5` x8, `mt-0.5` x7, `space-y-0.5` x5, `mt-1.5`, `mb-1.5`, `px-3.5`, `px-1.5` and 7 more: 36 hits, each moves 2px at most). Gutters, `py-24`, `max-w-6xl` stay.
- **Type:** Geist. App pages and `/privacy`: h1 `clamp(1.75rem,2.6vw,2.25rem)` / 1.15 / 700 / -0.01em; section headings 1.25rem / 1.35 / 600; body 15px; small 13px. `/` keeps today's sizes and weights (a bigger Display would rewrap the hero). Sentence case only.
- **Status colour:** error icon, border and message for failures; success for the "Saved" check. Text stays `--ink` or `--mute`; the colour is on the icon and the border (never colour alone).

### 2.2 Shared components
| Component | Change |
|---|---|
| `Btn` (`ui.js`) | primary `border-transparent bg-accent text-on-accent hover:bg-accent-hover active:bg-accent-active`; secondary `border-field bg-surface text-ink shadow-sm hover:bg-raised active:bg-line`; ghost `border-transparent text-mute hover:bg-raised hover:text-ink active:bg-line`; `dark` stays (it is the "ink button": waitlist, delete confirm; no red button, the confirm step is the safeguard). Delete `hover:-translate-y-0.5`, `active:scale-[.98]`; `px-3.5` becomes `px-4`. Heights 44/36/48 stay |
| `StepRow` | tile `rounded-xl bg-accent-subtle text-accent-text`, no border; entrance `y: 8`, `duration: .2`; unknown icon name shows `Workflow` |
| `Logo` | mark `rounded-xl bg-accent text-on-accent` |
| `Switch` (new, `ui.js`) | `role="switch"`, track 40x24, 44px hit area (`before:-inset-y-2.5 before:-inset-x-1`), on `border-accent bg-accent`, off `border-field bg-raised`, white thumb moved by `transition-transform duration-120` (no spring). Used by `PauseSample` and the composer |
| Cards, tiles, `FeatureCard`, band cards, plan card | `rounded-2xl border border-line bg-surface shadow-sm`; clickable: `hover:border-line-strong hover:shadow-md active:bg-raised`. Icon tile inside: `rounded-xl bg-accent-subtle text-accent-text` |
| Inputs | `h-12 rounded-xl border border-field bg-surface text-ink placeholder:text-hint focus-visible:border-accent`; invalid `border-error` plus `text-error` icon |
| Segmented control | container `rounded-xl border-field bg-surface p-1`; item `rounded-md`; checked `bg-accent text-on-accent`; unchecked `text-mute hover:bg-raised`; focus `peer-focus-visible:outline-focus peer-focus-visible:shadow-[var(--ring)]` |
| Chips (`Draft`, `Sample`) | `rounded-md border border-line bg-raised px-2 text-xs font-medium text-ink`; remove `uppercase tracking-wide` |
| Landing nav | `.hw-glass rounded-2xl`; delete the `scrolled` state, `useScroll` and `bg-surface/70|95`; links `text-ink` (AA on glass); theme and menu buttons keep `text-mute` icons; drop `whileTap` rotate |
| Mobile menus | landing: `.hw-glass rounded-2xl shadow-lg`. App dropdown: `.hw-glass shadow-lg rounded-b-2xl` |
| App sidebar | `bg-surface border-r border-line`. Active link: `bg-accent-subtle font-medium text-ink` plus a 6px `rounded-full bg-accent-text` dot before the icon, in the flow (not an absolute strip), plus `aria-current`. Bottom: user chip = 32px `rounded-full bg-accent text-on-accent` initial, email beside it, "Signed in as" as `sr-only`. Phone top bar stays solid |
| Sample cards (`ApprovalSample`, `PauseSample`) | `rounded-xl border border-line-strong bg-surface` (was `border-field`), flat. Undo `rounded-md` |
| Footer, `HowItWorks`, `Automations`, `WorkflowBand` | tokens and radius only. Tab indicator spring becomes a 200ms tween; step marker `duration-500` becomes `duration-340` |

### 2.3 Pages
| Page | Changes |
|---|---|
| `/` | Colours, radius, glass nav, focus, motion timings only. `Waitlist`: input `bg-surface text-ink placeholder:text-hint`, success pill `bg-accent-active`, panel `rounded-3xl` (22) solid accent (no glass), `text-white` becomes `text-on-accent`. The agent box matches the composer (`rounded-3xl`, `.field-focus`, round Send) and stays keyword only: no AI call from the public page |
| `/privacy` | Tokens, h1 per 2.1, `text-xl` headings stay (that is the 1.25 step). Copy change in 3.6 |
| `/login` | Inset hero panel: the sticky left cell gets `lg:p-3` (12px inset) and holds a `relative h-full overflow-hidden rounded-3xl bg-sunken` panel; phone and tablet band `mx-3 rounded-3xl bg-sunken`. Panel footer becomes two glass pills (`.hw-glass rounded-full px-3`, text `--ink`): credit bottom left (`fixed bottom-6 left-7`), Pause bottom right (`fixed bottom-6 right-[calc(50%+1.75rem)]`), both 16px inside the panel edge. Headline CSS in section 4.7. Form per 2.2. Viewports 1024 to 1327px now get the portrait image (panel under 640px; was 1024 to 1279) |
| `/app` | Composer per section 3. Header mark `rounded-2xl` stays 16 (it is a 44px tile). Starter cards and recipe tiles per 2.2; the three section headings use the 1.25rem step. Drafts: card `shadow-sm`, rename input `border-field`, errors `border-error`, delete confirm unchanged |
| `/app/runs` | Selected example item: `bg-accent-subtle` plus `aria-current`, no left strip. Banner `border-line-strong bg-raised`. Empty-state card per 2.2. No page-level action (the sidebar already has New workflow) |

### 2.4 Stays identical on `/` (no layout change)
DOM order and copy of every section, hero type sizes and wrap, `max-w-6xl`, `px-5`, `py-24`, grid gaps, nav height 56 and position, `Btn` heights, WorkflowBand geometry (240x150 cards, 262 pitch, perspective tilt, Pause, mask), footer dot wordmark, waitlist form markup, `HowItWorks` timeline. Only paint, radius, shadow, focus and timing change.

### 2.5 Bypasses found by grep (fix these files)
| Bypass | Where | Fix |
|---|---|---|
| Hard-coded hex | `app/layout.js:30` (`#0b0a12`), `app/opengraph-image.js:12-21` (`#0b0a12 #f4f2fb #c4b5fd #b9b4cc`, radius 14), `components/login/SculpturePanel.js:17-18`, `app/globals.css:75` (`#fff`) | `#121018`, `#f7f6f9`, `#c3a5ff`, `#a8a3b8`, radius 10; panel and ink hex per 4.6; `var(--on-accent)`. `Footer.js:34` `#fff` is an offscreen scratch canvas: leave |
| `text-white` x11, `bg-white`, `text-zinc-900`, `placeholder:text-zinc-500`, `bg-white/15`, `text-white/90` | `ui.js`, `Waitlist.js`, `Features.js`, `HowItWorks.js`, `LoginForm.js`, `AgentBox.js`, `Composer.js`, `app/app/page.js` | `text-on-accent`, tokens per 2.3. `Features.js:76` thumb `bg-white` stays (fixed thumb) |
| `bg-accent/90` x3 (`ui.js`, `AgentBox.js`, `Composer.js`) | | `hover:bg-accent-hover active:bg-accent-active` |
| `ring-2 ring-accent/25` x2 (`AgentBox.js:73`, `Composer.js:120`), `focus-visible:ring-white/70 ring-offset-accent` (`Waitlist.js:56`) | | `.field-focus`; the waitlist input uses the global outline (white inside `.on-accent`) |
| `border-ink` x3 as error border (`LoginForm.js` x2, `DraftCard.js`) | | `border-error`. The `dark` Btn variant's `border-ink` stays |
| `CircleAlert` in `text-accent-text` x5 (`LoginForm`, `Composer`, `DraftList`) | | `text-error` (failures), `text-info` (notices) |
| `rounded-lg` x9 in 7 files | `ui.js`, `AgentBox.js`, `DraftCard.js`, `RunsViewer.js`, `Workspace.js`, `Features.js`, `LoginForm.js` | `rounded-xl`; segmented items and file chips `rounded-md` |
| Left strips x2 | `AppNav.js:21`, `RunsViewer.js:34` | dot and wash (2.2) |
| Uppercase chips x2 | `DraftCard.js:124`, `RunsViewer.js:11` | sentence case |
| Springs x9, `whileTap` x3, `whileHover` x1, `hover:-translate-y` x6, `active:scale` x1, `blur(8px)` in `hw-word`, `ease [0.16,1,0.3,1]` | `ui.js`, `Features.js`, `Composer.js`, `AgentBox.js`, `Nav.js`, `Automations.js`, `Footer.js`, `globals.css` | section 6 |
| Hue-rotate and mask rules | `globals.css:127-136` | delete (4.7) |

### 2.6 Glass is used here and only here
`.hw-glass` (`backdrop-filter: var(--glass-blur)` = `blur(16px) saturate(160%)`, tokens `--glass-bg` and `--glass-border`): (1) landing nav bar, (2) landing mobile menu, (3) app phone menu dropdown, (4) the two login panel pills (credit, Pause). A future modal uses `.hw-glass rounded-3xl shadow-lg`; none exists today (delete confirm is inline). Never on: sidebar, cards, composer, plan card, buttons, body text, the waitlist panel. Fallbacks (solid `--glass-solid` and `--line`): browsers without `backdrop-filter`, `prefers-reduced-transparency`, `prefers-contrast: more`. Contrast: 1.5. Radius `rounded-2xl` bars and menus, `rounded-full` pills.

## 3. AI plan experience (`/app` composer)
### 3.1 What the UI needs from the server (architect owns the real shape)
`Composer` gets `ai = { enabled, limit }` from the page (enabled is only "a server key exists", never the key). A preview call returns `{ source: "ai" | "keyword", reason?: "no_key" | "failed" | "rejected" | "limit", steps: [{ icon, title, detail }], remaining?: number }` or `{ error: "empty" | "too_long" | "invalid", message }`. Steps keep today's shape and limits (12 steps, 200 chars); the server maps an unknown icon name to `Sparkles`, and `StepRow` shows `Workflow` if an old draft has one. Offline is detected in the browser (`navigator.onLine` or a thrown call), and the local `planFor` then answers. Drafts never run anything; saving is unchanged and stores the steps on screen.

### 3.2 Under the box: the note and the control
Line 1 always: "A plan is only something to read. Nothing runs. Do not put passwords or card numbers in a task." Line 2 is the truthful source line (icon `Sparkles` when AI is on, `Info` otherwise). The switch sits inside the box, bottom left, so the tab order is textarea, switch, Send.

### 3.3 States and exact copy
| State | Line 2 under the box | Plan area | Announcement |
|---|---|---|---|
| No key (AI off) | "No AI is used. Plans are matched on keywords, and your text is not sent to an AI service." No switch | Keyword result (below) | none until a plan exists |
| Key present, idle | "Your text is sent to Anthropic to write the plan." Switch "Write with Claude" on. After the first call, right-aligned meta "{remaining} of {limit} AI plans left today" | none | none |
| Key present, switch off | "Keyword preview. Your text is not sent to an AI service." (switch choice kept in `localStorage` `hw-ai`, try/catch) | Keyword result | none |
| Writing (AI) | unchanged | Card: spinner, "Claude is writing your plan." plus 3 static `bg-raised` placeholder rows (no shimmer), `aria-busy`. The textarea is `readOnly` (not `disabled`, so focus is kept), Send shows the spinner | status: "Claude is writing your plan." |
| Writing, slow (after 6 s) | | adds "This is taking longer than usual." and ghost button "Show keyword preview instead" (cancels the AI call, runs `planFor`) | status repeats once |
| Written (AI) | | `h2` "Plan written by Claude. Nothing will run." sub "Claude can get things wrong. Read each step before you save." Steps, then actions | status: "Plan ready, {n} steps. Nothing will run." |
| Keyword result | | `h2` "Keyword preview. Nothing will run." sub "Matched on keywords in your text. No AI was used." Steps appear at once (no pretend "reading" delay: that was theatre, and it made keyword and AI look alike) | same status |
| Fallback, AI failed | | Notice above the `h2` (`role="status"`, raised row, `Info` icon): "We could not reach the AI, so this is a keyword preview." plus ghost "Try Claude again". Heading is the keyword one | status: notice text |
| Fallback, reply unusable | | Notice: "Claude's reply could not be used, so this is a keyword preview." plus "Try Claude again" | same |
| Limit reached | "You have used your {limit} AI plans for today. Try again tomorrow. The keyword preview still works." Switch disabled and off | Pressing Send gives a keyword plan with notice "You have used your {limit} AI plans for today, so this is a keyword preview. Try again tomorrow." | notice text |
| Offline | | Notice: "You are offline, so this is a keyword preview. Saving needs a connection." Save later fails with today's message | notice text |
| Empty input | | Under the box, `role="alert"`, `CircleAlert` in `text-error`: "Describe the work first, then preview the plan." Focus returns to the textarea; clears on typing | alert |
| Too long | At 90% of {max}: meta "{n} of {max} characters". At the limit: "Limit reached. Shorten your text to add more." | Server variant under the box: "That is longer than {max} characters. Shorten it and try again." | alert for the server variant |
| Server refused the input | | Under the box, `role="alert"`: the server's one plain sentence | alert |
| Saved draft opened | per mode | `h2` "Saved plan. Nothing will run." (we do not store the source, so we do not claim one) | focus moves to the `h2` (existing) |

The note uses an id so the textarea has `aria-describedby="ai-note"`.

### 3.4 The plan card, steps, saving
- Card: `rounded-2xl border border-line bg-surface shadow-sm p-4`. **The Suggested wash has exactly one use in the app: the AI plan card.** Class `bg-linear-to-b from-accent-subtle to-surface to-50%`. The keyword card is plain, so source is visible without colour (the heading text carries it). No wash on recipe tiles.
- Steps reuse `StepRow`: all rendered at once with `delay={index * 0.04}` and the 200ms fade and 8px rise. The per-step `setTimeout` chain and `shown` state go away. The green-check pop on each row is removed: a check says "done", and nothing is done. Rows keep the "1." numbering in the title.
- Actions: `Save as draft` (primary, `Save` icon), `Edit request` (secondary), `Start over` (ghost). Both sources save the same way; the saved and error lines are today's: "Not saved yet." / "Saved to your drafts. It will not run." / "Could not save your draft. Check your connection and try again." Success icon uses `text-success`.
- Live regions: remove `aria-live` from the card (it reads every row as it mounts). One persistent `sr-only role="status"` carries the announcements in 3.3; failures use `role="alert"`. Do not move focus when a plan arrives (a sighted user is on Send; a screen reader user hears the status, then reads on).
- Composer shape: **rounded rectangle (`rounded-3xl`, 22), not a literal pill.** A 3-row textarea inside a 999px pill clips its corners. The pill feel comes from the round purple Send button (`rounded-full bg-accent`, 44px phone, 36px desktop, `ArrowUp`, name "Preview plan"). No chat bubbles: there is no second turn, and the request already sits in the box.

```
PHONE (320-639)                              DESKTOP: same stack in the max-w-3xl column
+------------------------------+
| Describe the work...         |   rounded-3xl, border-field, shadow-sm, .field-focus
|                              |
| (o) Write with Claude   ( ^ )|   switch left, round Send right
+------------------------------+
 A plan is only something to read...        text-sm, mute
 (spark) Your text is sent to Anthropic...  7 of 10 left   (wraps below on 320px)
+------------------------------+
| (i) We could not reach the AI,|  only after a failure
|     so this is a keyword...   |
| Plan written by Claude. ...   |  h2, wash header (AI only)
| 1 [icon] Title / detail       |  StepRow x n
| [   Save as draft          ]  |  w-full on phones, auto from sm
| [Edit request] [Start over]   |
| Not saved yet.                |
+------------------------------+
```

### 3.5 Keyboard order
Skip link, sidebar, `h1`, textarea, switch, Send, (notice buttons), Save as draft, Edit request, Start over, "See your drafts" link, starter cards, recipe tiles, drafts. Escape does nothing here. Enter sends, Shift+Enter adds a line (unchanged).

### 3.6 Privacy page copy (`app/privacy/page.js`, section "No AI" is false once a key exists)
Replace its heading and text with: **AI plans.** "When AI plans are on, the text you type in a task is sent through our server to Anthropic, which writes the preview plan. Anthropic handles it under its own terms. You can switch AI off in the box, and then the plan is matched on keywords and your text goes to no AI service. The same is true whenever AI is not turned on. A plan is never run." Also add to "What we store" if the architect keeps a daily counter: "How many AI plans your account made today, to apply a daily limit." Also stale and to be reworded: `PRODUCT.md` line 34 ("No AI model is called"), `README`, and the composer line "sends nothing" (replaced in 3.2).

## 4. Sculpture art direction (replaces the four beige and brass placeholders)
### 4.1 Files
| File (`public/sculpture/`, names unchanged) | Pixels | Flat background (every pixel outside the form) | Budget |
|---|---|---|---|
| `light.webp` | 1983 x 793 | `#eeecf2` (`--sunken` light) | <= 250 KB |
| `dark.webp` | 1983 x 793 | `#0c0a10` (`--sunken` dark) | <= 250 KB |
| `mobile-light.webp` | 1024 x 1300 | `#eeecf2` | <= 250 KB |
| `mobile-dark.webp` | 1024 x 1300 | `#0c0a10` | <= 250 KB |

Sizes equal the current files, so `computeRect`, the 2.5 and 0.788 aspects, the hint position and the `<img width height>` pair stay valid. Lossy WebP (quality 80 to 84, method 6, RGB). A rough Pillow mock-up (a plain ribbon, not the art) gave 135 to 151 KB and a corner drift of 1 level after encoding, so there is headroom for finer detail. It also showed the ramp reading as clean violet on `#eeecf2` and as glowing lilac on `#0c0a10`.

### 4.2 The form
One abstract object, no logo, face, text, horizon or floor: **a single continuous ribbon of folded liquid metal.** It enters from the left as loose dust, gathers into a brushed band, folds over itself into one open ring a little right of centre (the ring is the focal point; its hole shows the flat background), then twists and dissolves into dust on the right. The surface reads as brushed metal: long fine striations along the ribbon, crisp fold edges, broad soft reflections. Around it: dust (60%, 1 to 2px), grains (30%, 3 to 4px) and at most 40 small beads (6 to 14px, with a tiny highlight). No filament thinner than 3px (the component samples a 1000-wide grid, about 2px per cell). Light and dark of each pair use the **same geometry and seed**; only lighting and ramp differ, so the 280ms theme swap keeps one silhouette. Portrait is its own composition, not a crop: the same ribbon flowing diagonally from lower left to upper right, one fold, one open ring.

### 4.3 Palette (Arjun tokens only; the generator asserts every opaque pixel is within a small distance of this set)
| | Light image (bg `#eeecf2`) | Dark image (bg `#0c0a10`) |
|---|---|---|
| Shadow to light ramp | 900 `#4c1d78`, 800 `#5b21b6`, 700 `#6d28d9`, 600 `#7c3aed`, 500 `#8b5cf6`, 400 `#a476ff`, up to **200 `#dac9ff`** | 800 `#5b21b6`, 700, 600, 500, 400, 300 `#c3a5ff`, 200, up to specular **50 `#f5f0ff`** |
| Bead and dust neutrals | gray-600 `#635e73`, gray-500 `#847f96` | gray-300 `#cac6d6`, gray-400 `#a8a3b8` |
| **Banned stops** | purple-50, purple-100, gray-200: their distance from the bg is 0.06 to 0.08, below the component's 0.10 comfort line, so they would be keyed out as holes. Every stop used must be >= 0.10 from the bg | none (all stops are 0.44 or more from `#0c0a10`) |

Key distance from the flat bg (component rule: under 0.012 transparent, over 0.05 opaque, particle skipped under 0.03): light stops range 0.17 (purple-200) to 1.14 (purple-900); dark 0.73 (purple-800) to 1.59. Never use `--bg` as the image background: purple-200 is only 0.21 from it and the panel would not match.

### 4.4 Lighting
Key light upper left, soft; a cool lilac rim from lower right to separate the ribbon from the ground; deep folds go to the ramp floor (900 light, 800 dark) so the form has weight; one or two specular streaks per fold, never a white blob. Light image: mid-dark and saturated (the form reads as ink on pale paper). Dark image: luminous (the form glows, brightest highlights near the ring). No ground shadow, no bloom, no vignette, no grain.

### 4.5 Composition and the component's keying
| Rule | Landscape 1983x793 | Portrait 1024x1300 |
|---|---|---|
| Mass | ring centre at 54% x, 47% y; whole form 88 to 94% of width, 70 to 80% of height | diagonal from lower left to upper right, centre of mass 52% x, 44% y, form 84% of width, 80% of height |
| Empty margins | >= 5% left and right (99px), >= 8% top and bottom | >= 6% left and right, top 8%; **bottom 12% (156px) holds sparse dust only** (on narrow panels the component lets the picture run under the headline by 30% of the headline block's height) |
| Corners (critical) | the component averages four corner patches of 12px on its 1000 grid (about 24px in the file) to learn the bg. **The outer 32px of every file is exactly the flat bg** | same |
| Coverage and particles | 22 to 32%, about 90 to 130k particles (current files: 121k, 127k) | 18 to 28%, about 210 to 330k (current: 316k, 349k; same cost as today) |

### 4.6 Props for the login page (`SculpturePanel.js`)
```js
const PANEL = { light: "#eeecf2", dark: "#0c0a10" };   // mirrors --sunken
const INK   = { light: "#1c1926", dark: "#f7f6f9" };   // mirrors --ink
// <SculptureHero background={PANEL.light} darkBackground={PANEL.dark} textColor={INK[mode]} sculptureScale={1} mobileSculptureScale={1} ... />
```
Do not pass `imageBackground` (it is one colour for both themes; the corner detection finds the right one per file). `sculptureScale` goes from 0.8 to 1 because the new art carries its own 5% margins: width becomes 1.02 x panel, mass about 94%. Because the flat bg equals the panel colour, the component's `uBg / uImgBg` multiply is 1 (no tint shift) and the `<img>` fallbacks and phone bands show no rectangle. Alpha-channel cut-outs were rejected: the component would stop re-tinting, edge pixels bleed the colour hidden under transparent areas, and files grow about 30%.

### 4.7 CSS: what to delete and what to keep (`globals.css`, login block)
Delete all of: the two `hue-rotate(235deg)` rules (`:root:not(.dark) .login-art .sh-stage`, `.dark .login-art .sh-fallback`), `.login-still { filter }`, and the radial `mask-image` block. **Gate:** delete only after the generator's check passes (corners within 2 levels of the bg after encoding). If a file drifts, encode that file lossless; do not bring the mask back. Keep and change:

```css
.login-art .sh-aside { display: none; }
.login-art .sh-content { padding-bottom: 72px; }
.login-art .sh-h1 { font-size: clamp(2.5rem, 4vw, 3.5rem); font-weight: 700; letter-spacing: -0.02em; line-height: 1.05; }   /* Arjun display */
.login-art .sh-hint { opacity: 1; color: var(--mute); font-size: .8125rem; letter-spacing: 0; text-transform: none; }
```
The credit stays "Sculpture component by guglielmogiannattasio.it" (it credits the component only). `docs/sculpture-assets.md` should say the four images are generated by us and drop the licence warning.

### 4.8 How to judge success from a screenshot (1440x900, both themes, then 1100 wide, then 390 wide)
1. One continuous violet form on a panel with no visible rectangle edge, at 200% zoom too; no beige, brass or grey cast.
2. Light: dark, saturated ribbon, nothing washed out; dark: glowing, shadows still visible against `#0c0a10`.
3. Headline "Quiet work, done." and the hint are clear of the form (ink 14.73 or 18.29 on the panel).
4. Mouse across it: particles flow and settle, colours do not shift (factor 1).
5. WebGL off: the still image looks the same as the live one.
6. 1100 wide shows the portrait art with a quiet bottom; 390 wide shows the landscape band on `bg-sunken` with no seam.
7. Numbers: 4 files, each <= 250 KB, exact pixel sizes, corners within 2 levels, particle estimate in range.

## 5. Component inventory
| Class | Items |
|---|---|
| Reuse unchanged | `useTheme`, `useMediaQuery`, `usePrefersReducedMotion`, `MotionProvider`, `liquid-sculpture-hero.tsx`, `WorkflowBand`, `Drafts.js`, `app/app/error.js`, everything in `lib/` |
| Small change | `ui.js` (Btn, StepRow, Logo, EASE value `[0.4,0,0.2,1]`, `Reveal` .34s and y 12, new `Switch`), `globals.css` (1.1, 2.5, 4.7, motion), `Nav.js` (glass), `AppNav.js` (dot, user chip, glass menu), `UserBadge.js` (initial chip), `Workspace.js`, `DraftCard.js`, `RunsViewer.js`, `LoginForm.js`, `SculpturePanel.js` (consts, `sculptureScale`, glass pills), `app/login/page.js` (inset), `Features.js` (`Switch`, sample cards, springs), `Waitlist.js`, `AgentBox.js` (tokens, radius, motion only; copy unchanged), `Automations.js`, `HowItWorks.js`, `Footer.js` (fade, not wipe), `DraftList.js` (icon colour), `Hero.js` (word stagger .04s, second line delay .12s, other delays 0.2 to 0.4s), `app/layout.js`, `opengraph-image.js`, `icons.js` (add `Info`), `app/privacy/page.js` |
| Larger change | `Composer.js` (AI states, drop the `shown` timer chain, `readOnly` while writing, switch, notice, live region) |
| New | `Switch` only. No new files: notice, counter and source line live inside `Composer.js` |

## 6. Motion plan
Durations: 120ms (hover, press, focus, colour), 200ms (fades, menus, collapse, step entrance), 340ms (page and panel entrances). Easing `cubic-bezier(.4,0,.2,1)`. No bounce, no blur, no parallax, no scale-on-press.

| Page | Focal moment | Supporting | Autonomous motion | Reduced motion | Paused |
|---|---|---|---|---|---|
| `/` | Headline words rise (340ms each, 40ms stagger, no blur; total about 0.6s) | `Reveal` 340ms, 12px; agent box steps 200ms; footer wordmark wipe becomes a 340ms fade | Hero glow and workflow band: unchanged, still stopped by Pause and reduced motion | `MotionConfig` removes movement, fades stay; band and glow stop; no Pause button | glow and band stop |
| `/privacy` | none | none | none | n/a | n/a |
| `/login` | The sculpture answering the cursor (started by the person) | panel fade 340ms; mode heading crossfade 120ms; error fade 200ms | none (hint dot stops on first move) | still image, no Pause button | remount at rest, no hint |
| `/app` | The plan arriving (steps 200ms fade plus 8px, 40ms stagger) | card hover 120ms; notice and status swap 120ms; delete collapse 200ms; menu 200ms | none | steps fade only; spinners kept | nothing runs here, no Pause |
| `/app/runs` | none | switch thumb 120ms; approval 120 to 200ms fades on click | none | same | none |

Keep as is: the workflow band's perspective tilt (a continuous marquee, not a UI transition, already has Pause and reduced motion). Convert to tweens: the 9 springs. Nothing new that moves on its own.

## 7. Accessibility checklist (changed things only)
- [ ] Contrast: all pairs in 1.4 used as written; banned pairs (success or warning text on raised, accent fill on raised in dark) absent. Re-run `contrast.py` if a token changes.
- [ ] Focus: every control shows the 2px `--focus` outline plus halo: `Btn`, icon buttons, Send, switch, segmented radios (`peer-focus-visible`), tiles, links, textarea box (`.field-focus`), rename input, sidebar links. Check keyboard-only on all 5 pages, both themes.
- [ ] Glass: nav, menus and pills have a solid fallback with no `backdrop-filter`, and under `prefers-reduced-transparency` and `prefers-contrast: more`. Text on glass is `--ink`. Turn Windows "Transparency effects" off (or emulate `prefers-reduced-transparency` in DevTools) and confirm.
- [ ] Not colour alone: error = icon + message + border; active nav = dot + wash + `aria-current`; AI plan = heading text, not just the wash; selected example run = wash + `aria-current` + "Sample" chip.
- [ ] AI states: one persistent `role="status"`; failures `role="alert"`; notice has `role="status"`; textarea is `readOnly` (focus kept) while writing; `aria-describedby` on the textarea; switch is `role="switch"` with `aria-checked`, label visible.
- [ ] Targets: Send, switch hit area, Pause pill, icon buttons 44px on phones. 320px: no horizontal scroll, switch row wraps.
- [ ] Reduced motion: steps fade only, no spring anywhere (grep `spring` returns 0), sculpture still, no Pause button; `prefers-reduced-motion` and the Pause button both checked on `/` and `/login`.
- [ ] Login: one effective h1 (panel is `aria-hidden`), tab order unchanged (skip, Logo, theme, mode radios, email, password, show, submit, Privacy, credit, Pause).
- [ ] Sculpture: panel text 14.73 (light) and 18.29 (dark) ink on `--sunken`; hint 5.30 and 8.06.

## 8. Open questions and decisions
**Blocking questions: none.**

Decisions where the brief was silent (cheap to change):
1. **AI switch.** A "Write with Claude" switch lets a person keep their text away from the AI. It reuses `planFor`, so the cost is one component. Drop it by deleting one row of 3.3 if unwanted.
2. **No fake delay** for the keyword preview and no check marks on plan steps (both made keyword and AI look alike and implied "done").
3. **Source not stored.** Opened drafts say "Saved plan" with no source. If the owner wants "written by Claude" kept, the architect adds one column.
4. **Inset login panel** (22px radius, sunken colour) instead of the full-bleed half, because Arjun names 22 for hero panels.
5. **No red delete button;** `dark` ink button stays. **Landing agent box** never calls AI (cost and abuse on a public page).
6. **Sculpture exception.** Arjun says no illustration; the login sculpture is the owner's approved exception and is abstract and generated. Type scale not applied to `/` (would rewrap the hero).
7. **Limit number and window** ({limit}, "tomorrow") are the architect's; copy only needs the number.

Related: [Plan: restyle and Preview plan](plan-next.md), [Arjun AI Design System](arjun-ai-design-system.md), [Sculpture assets](sculpture-assets.md), [Groq amendment](plan-groq.md)
