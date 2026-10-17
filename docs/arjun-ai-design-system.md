# Arjun AI Design System: reference copy for Hushwork

Read on 2026-10-16 from the owner's Claude Design project "Arjun AI Design System"
(https://claude.ai/design/p/bfedd0b7-d431-4fd8-ac13-9a5384524416, owner's account, shown as the org default).
This file is a **copy of what was read**, so builders do not need browser access. If the two ever differ, the design project wins.

**What was read:** the Readme page, `tokens/colors.css`, `typography.css`, `radius.css`, `spacing.css`, `shadows.css`, `motion.css`, and the template "Hushwork: App" (screens Home, Hushwork Agent, Planner viewed).
**What was NOT read:** `tokens/fonts.css`, the component pages (Button, Input, Card, Dialog, Sidebar...), the guideline cards, and `uploads/DESIGN.md` beyond its first ~50 lines (it is the source brief, titled "Shivali's Product & UI Design System": "clean + futuristic", calm not noisy, functional not decorative). The Readme below summarises it.

## Owner decision for Hushwork (2026-10-16)
"Arjun AI everywhere, but keep Geist": the landing page, `/login`, `/app` and `/app/runs` all use Arjun AI's colours, neutrals, radius scale, shadows, motion and glass rules. **The font stays Geist** (the design system says Inter; the owner chose to keep Geist). Nothing else from the old Hushwork tokens is binding where it conflicts with this file, except the accessibility rules in section 6.

## 1. Colour tokens (exact)

Purple scale: 50 `#f5f0ff`, 100 `#ece4ff`, 200 `#dac9ff`, 300 `#c3a5ff`, 400 `#a476ff`, 500 `#8b5cf6`, **600 `#7c3aed` (accent)**, 700 `#6d28d9`, 800 `#5b21b6`, 900 `#4c1d78`.
Neutrals (warm-neutral, never pure white or black): 0 `#ffffff`, 25 `#fbfafd`, 50 `#f7f6f9`, 100 `#eeecf2`, 200 `#e2dfea`, 300 `#cac6d6`, 400 `#a8a3b8`, 500 `#847f96`, 600 `#635e73`, 700 `#4a4558`, 800 `#2e2a3a`, 900 `#1c1926`, 950 `#121018`.
Status (use sparingly, status only): success 500 `#16a34a` / 600 `#15803d`; warning 500 `#d97706` / 600 `#b45309`; error 500 `#dc2626` / 600 `#b91c1c`; info 500 `#2563eb` / 600 `#1d4ed8`.

| Role | Light | Dark |
|---|---|---|
| bg | gray-50 `#f7f6f9` | gray-950 `#121018` |
| surface | gray-0 `#ffffff` | gray-900 `#1c1926` |
| surface-elevated | gray-25 `#fbfafd` | gray-800 `#2e2a3a` |
| surface-sunken | gray-100 `#eeecf2` | `#0c0a10` |
| text-primary | gray-900 `#1c1926` | gray-50 `#f7f6f9` |
| text-secondary | gray-500 `#847f96` | gray-400 `#a8a3b8` |
| text-tertiary | gray-400 `#a8a3b8` | gray-600 `#635e73` |
| text-on-accent | `#ffffff` | `#ffffff` |
| border | gray-200 `#e2dfea` | `rgba(255,255,255,0.10)` |
| border-strong | gray-300 `#cac6d6` | `rgba(255,255,255,0.18)` |
| accent | purple-600 `#7c3aed` | purple-500 `#8b5cf6` |
| accent-hover | purple-700 `#6d28d9` | purple-400 `#a476ff` |
| accent-active | purple-800 `#5b21b6` | purple-300 `#c3a5ff` |
| accent-subtle | purple-50 `#f5f0ff` | `rgba(139,92,246,0.14)` |
| accent-subtle-border | purple-200 `#dac9ff` | `rgba(139,92,246,0.35)` |
| success / warning / error / info | the 500 values | `#4ade80` / `#fbbf24` / `#f87171` / `#60a5fa` |
| focus-ring | purple-400 `#a476ff` | purple-400 `#a476ff` |
| glass-bg | `rgba(255,255,255,0.6)` | `rgba(28,25,38,0.6)` |
| glass-border | `rgba(255,255,255,0.5)` | `rgba(255,255,255,0.08)` |

## 2. Type, radius, spacing, shadow, motion (exact)
- Font: Inter, with fallbacks `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` (**Hushwork keeps Geist**; use the same sizes, weights and tracking).
- Display `clamp(2.5rem, 4vw, 3.5rem)` / 1.05 / 700 / tracking -0.02em. H1 `clamp(1.75rem, 2.6vw, 2.25rem)` / 1.15 / 700 / -0.01em. H2 1.5rem / 1.25 / 600. H3 1.25rem / 1.35 / 600. Body-lg 1rem / 1.6 / 400. Body 0.9375rem / 1.6. Small 0.8125rem / 1.5. Micro 0.6875rem / 1.4 / tracking 0.02em (only for tiny letter-spaced eyebrow labels; Hushwork avoids eyebrows).
- Radius: sm 6px, md 10px, lg 16px, xl 22px, full 999px. "Controlled and larger on bigger surfaces: chips 6, controls 10, cards 16, hero panels 22, toggles pill."
- Spacing (4px rhythm): 1=4, 2=8, 3=12, 4=16, 6=24, 8=32, 12=48, 16=64. Container max 1200px, gutter 24px.
- Shadows: light sm `0 1px 2px rgba(28,25,38,.06)`, md `0 4px 12px rgba(28,25,38,.08), 0 1px 2px rgba(28,25,38,.04)`, lg `0 16px 40px rgba(28,25,38,.12), 0 2px 8px rgba(28,25,38,.06)`. Dark sm `0 1px 2px rgba(0,0,0,.3)`, md `0 4px 16px rgba(0,0,0,.4)`, lg `0 20px 48px rgba(0,0,0,.5)`. Focus ring `0 0 0 3px var(--accent-subtle-border)`. Glass blur `blur(16px) saturate(160%)`.
- Motion: ease-standard `cubic-bezier(0.4, 0, 0.2, 1)`; fast 120ms, base 200ms, slow 340ms. Reduced motion: durations to 0.001ms.

## 3. Visual rules (from the Readme)
Tone calm, direct, competent, never hypey; no "AI-powered" bravado, no exclamation marks. Second person ("you") in the app. **Sentence case everywhere**; no emoji; Lucide-style line icons. Empty and error states explain what happened and what to do next (never "No data" or "Error 500"). One accent; flat surfaces by default; **glass (blur + translucency) only on hero panels, floating controls and modals**, never on body text or primary buttons. One subtle accent-to-transparent wash allowed sparingly (for example a highlighted "Suggested" card). Animation: fades, slides and scale only, 120 to 200ms, no bounce, no parallax. Hover: one step darker (light) / lighter (dark) on the accent scale; ghost buttons get a neutral tint. Press: two steps, no scale/shrink. Borders 1px `--border`; accent border only for focus or selected. Focus: 3px accent-tinted ring, always visible. Cards: 1px border + shadow-sm, radius-lg, no nested cards, **no coloured left-border strip**. No photography, illustration or grain.

## 4. Components listed in the system (specs not read)
Forms: Button, Input, Select, Checkbox, Radio, Switch. Feedback: Badge, Tag, Toast, Tooltip. Surfaces: Card, Tabs, Dialog. Navigation: Sidebar, Navbar. Seen in the template: pill-shaped composer with a purple Send button; assistant bubble white with border, user bubble solid purple; stat cards; checklist rows with purple checkbox; a "Suggested" card with a soft purple wash and a purple button; sidebar "Arjun AI" wordmark with a purple dot on the active item and a user chip (initial in a purple circle) at the bottom; page title bar with a primary action at the right.

## 5. Today's Hushwork tokens that this replaces (see `hushwork-app/app/globals.css`)
Old: Geist, violet accent, radius 12/16/24, no glass, dark bg `#0b0a12`. New: the tables above, Geist kept.

## 6. Accessibility findings: Arjun AI's raw values vs WCAG AA (computed 2026-10-16)
Hushwork's `PRODUCT.md` requires WCAG AA (text 4.5:1, large text and UI parts 3:1). Contrast of the raw tokens:

| Pair | Ratio | Verdict |
|---|---|---|
| light text-primary on surface / bg | 17.26 / 16.03 | pass |
| **light text-secondary gray-500 on surface / bg** | **3.85 / 3.57** | **fails 4.5 for body text** |
| **light text-tertiary gray-400 on surface** | **2.44** | **fails** (placeholders, hints) |
| light gray-600 on surface / bg | 6.21 / 5.77 | pass: use for secondary text |
| light white on accent 600; accent 600 text on surface | 5.70; 5.70 | pass |
| light accent 600 on accent-subtle 50; accent 700 on it | 5.10; 6.36 | pass |
| light border gray-200 / gray-300 vs surface | 1.31 / 1.67 | decorative only; **input borders need 3:1** (gray-500 gives 3.85) |
| light focus ring purple-400 vs surface | 3.18 | pass (non-text 3:1) |
| light success / warning 500 as TEXT on surface | 3.30 / 3.19 | fail as text; fine as icons with a text label; use 600 values for text |
| light error 500 on surface | 4.83 | pass |
| dark text-primary on bg / surface | 17.52 / 16.03 | pass |
| dark text-secondary gray-400 on surface | 7.07 | pass |
| **dark text-tertiary gray-600 on surface / bg** | **2.78 / 3.04** | **fails** |
| **dark white on accent 500 `#8b5cf6`** | **4.23** | **fails 4.5 for normal text** (passes 3:1 large/bold) |
| **dark accent 500 as text on surface** | **4.08** | **fails**; accent 400 `#a476ff` gives 5.44 |
| dark error `#f87171` on surface | 6.24 | pass |

**Adaptations that keep the Arjun look and pass AA** (the designer confirms exact values by computing): secondary and placeholder text use gray-600 (light) and gray-400 (dark); tertiary is used only for text that is purely decorative or paired with a stronger label; in dark mode, filled buttons use purple-600 `#7c3aed` (white on it 5.70) and accent text/links use purple-400; input and control borders use gray-500 (light) and a stronger translucent white (dark) to reach 3:1; status colours as text use the 600 values (light) and the listed dark values.
