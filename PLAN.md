# Hushwork: Build Plan and UI/UX Direction

Written 2026-10-14. Based on reading every file in `hushwork/`, running the UI/UX Pro Max, Taste and Impeccable skills against it, and browsing 21st.dev.

---

## 0. The short version

1. **Hushwork today is a landing page, not a product.** The AI agent, the waitlist, the login and the "Save workflow" button are all simulated. The waitlist form tells people "You're on the list" and then throws their email away.
2. **"Pulling this off" is two separate jobs.** Track A is making the page great and capturing real signups (days). Track B is building the real automation product (months, and it should be gated on proof that people want it).
3. **The UI has one structural problem and several fixable ones.** The structural one: an app-style sidebar is bolted onto a marketing page. The fixable ones: light mode is broken in several places, the hero is built from fake screenshots, motion never stops, and three sections use the same 3-card layout.
4. **Recommended order:** safety net (git) -> make it honest (real waitlist) -> fix and restyle in place -> migrate to a proper project -> build one product slice (the invoice chaser).
5. **Three decisions are needed from you** (section 8). I have picked defaults so nothing is blocked.

---

## Phase 2 status (updated 2026-10-15)

**The site now lives in `hushwork-app/` (Next.js 16, Tailwind 4, React 19).** The no-build prototype in `hushwork/` is kept for reference.

| Item | Status | Notes |
|---|---|---|
| Scaffold and port of every section | Done | Same design, same copy. Fonts now come from `next/font` (self-hosted). |
| Icons Lucide to Phosphor | Done | One map in `components/icons.js`. |
| Geist | **Decided: keep** | Owner decision 2026-10-15. Impeccable's detector calls it "overused"; accepted. |
| Motion restored | Done | Owner request. Dial raised from 4 to about 6. Headline word reveal, drifting glow, 3D workflow band (real components, pauses offscreen, Pause button), scroll-filled timeline rail, sliding tab indicator, run log that completes step by step, approval pop, switch spring, footer wordmark wipe. |
| Reduce motion | Done | Movement removed, fades kept, spinners kept, band static, Pause button hidden. Checked in a real browser. |
| Link preview picture | Done | Generated at build time by `app/opengraph-image.js`. |
| Waitlist through the new form | Done | Real signup tested; test row deleted. |
| Lint and production build | Pass | All routes are static. |
| Real-browser checks | Pass | Motion runs, Pause works, 0 contrast failures (dark and light), console clean, no sideways scroll from 320px to 1024px. |
| Lighthouse, desktop | 100 / 100 / 100 / 100 | Performance, accessibility, best practices, SEO. LCP 0.7s, CLS 0. |
| Lighthouse, phone | 80 / 100 / 100 / 100 | Lighthouse simulates a slow 4G connection and a CPU four times slower. It estimates LCP 3.0s (target was 2.5s); CLS 0. Measured in real time, the headline appears in about 0.5s. |
| Deploy to Vercel | **Not done** | Needs your go-ahead: it makes the site public. |

**Phone performance, for later (optional):** the page ships about 215KB of compressed JavaScript (React and Next.js, then the motion library at about 46KB, then icons at about 28KB). Ways to trim if it ever matters: load `motion` through `LazyMotion` (saves roughly 25KB up front), delay hydrating sections below the fold. A test that removed the headline blur made no difference, so the blur stayed.

---

## Progress (updated 2026-10-14)

**Phase 0 and Phase 1 are done.** Each step is its own Git commit, so any one can be undone (`git log --oneline` lists them).

| Step | Status | Notes |
|---|---|---|
| 0 Safety net, `PRODUCT.md` | Done | Audience, "waitlist only" status and Supabase decision recorded. |
| 1.1 Real waitlist | Done | Supabase project `hushwork`; public can insert only; verified with real requests and through the form. |
| 1.2 Copy and truth | Done | "Private beta" badge, "Saved to drafts" and the fake login are gone. One CTA label. Em dashes removed. |
| 1.3 Hide login | Done | `Login.jsx` kept, not loaded. |
| 1.4 Tokens and contrast | Done | Final scan: 103 text elements, 0 failures in both themes, lowest ratio 4.91:1. |
| 1.5 Navigation | Done | Sidebar removed; one top bar. |
| 1.6 Hero | Done | Real agent box beside the promise; fake screenshot band removed. |
| 1.7 Sections | Done | Timeline, folder tabs, feature samples. |
| 1.8 Motion | Done | No endless animation, no JS or SVG motion loops. |
| 1.9 Type and shape | Done with one open question | Geist. Impeccable's detector calls Geist "overused" while Taste recommends it. Your call. |
| 1.10 Accessibility and meta | Done | Skip link, `<main>`, 44px tap targets, meta and Open Graph tags, `privacy.html` (draft). |
| 1.11 Verification | Done | Detector 5 findings down to 1; contrast, phone layout, menu, keyboard behaviour measured. |

**Still open before launch:**

- Review `privacy.html` and confirm `hello@hushwork.co` is a real mailbox.
- ~~Decide on Geist versus another face.~~ Decided: keep Geist.
- ~~Add a social preview image.~~ Done in Phase 2 (generated, not invented).
- Look at the finished page yourself in light and dark at phone width. My Phase 2 checks used a real headless browser (screenshots and measurements), but a quick look from you is still worth it.

**Shipped values that differ from the plan below:** the radius scale is 12 / 16 / 24px (controls / cards / panels), not 14 / 20 / 28. Impeccable's floor says card radii stay at 12 to 16px.

---

## 1. What is in the workspace

| Piece | File | Real or simulated? |
|---|---|---|
| Landing sections (hero, how it works, automations, features, agent box, waitlist, footer) | `Hero.jsx`, `Sections.jsx`, `Features.jsx`, `AgentBox.jsx`, `Footer.jsx` | Real UI |
| "Describe your task" agent box | `AgentBox.jsx` | **Simulated.** `planFor()` matches keywords with regular expressions (`/invoice\|pay\|overdue\|stripe/`) and returns canned steps. No AI is called. The page says so ("live preview"), which is honest. |
| Waitlist form | `Sections.jsx` (`Waitlist`) | **Simulated.** Validates the email, then only does `setDone(true)`. Nothing is stored or sent. |
| Login / Sign up | `Login.jsx` | **Simulated.** Any valid-looking email plus 8 characters signs you in after a fake 1-second delay. The "Continue with Google" button signs in as `you@gmail.com`. State lives in `localStorage` (browser memory). |
| Workflow product mock (3-pane runs viewer) | `Hero.jsx` (`ProductMock`) | Built but **never rendered**. `Home` in `App.jsx` does not include it. |
| Five use-case cards | `Features.jsx` (`UseCases`) | Built but **never rendered**. |
| Stack | `index.html` | React 18 (development build) + Babel compiling JSX **in the visitor's browser** + Tailwind from a CDN. No build step. |

**What is genuinely good and should be kept** (Impeccable's rule: refinement preserves what works):

- The voice: "Describe the task. Hushwork handles it." and "Quiet work, done."
- The agent box interaction, including its honesty line and `aria-live` announcements.
- The CSS-variable colour tokens (`bg`, `surface`, `raised`, `ink`, `mute`, `line`, `accent`). That is a solid theming foundation.
- Dark-first with a working light toggle, and a global `prefers-reduced-motion` rule.
- The dot-matrix "hushwork" wordmark in the footer. It is distinctive, and 21st.dev has a whole family of wordmark footers (section 4), so the idea is current.
- The folder metaphor for automations. Distinctive; it just needs to be keyboard accessible.
- The login form's labels and `aria-describedby` error wiring.

---

## 2. Two tracks

**Track A: the page.** Fix the UI/UX, make the waitlist real, publish. Goal: collect real signups and conversations. Needs no backend beyond one database table.

**Track B: the product.** A user describes a task, the AI turns it into a workflow, the workflow runs on a schedule against their Gmail/Stripe/etc., every run is logged, and risky steps wait for approval. This needs authentication, a database, an AI service, scheduled jobs and OAuth connections to other companies' APIs.

Do Track A first, in full. Start Track B only after the waitlist has told you something (section 5, Phase 3 gate).

---

## 3. UI/UX direction

### 3.1 Design Read and dials (Taste skill, section 0 and 1)

> **Reading this as:** a Persuade-mode SaaS landing page for freelancers and solo operators, with a calm "quiet work" language, leaning toward Tailwind and restrained motion, as a **redesign that preserves the brand** (violet accent, copy voice, section order).

| Dial | Current site (my estimate) | Target | Why |
|---|---|---|---|
| DESIGN_VARIANCE | ~6 | **6** | Offset, asymmetric hero, but not chaotic. Matches "balanced / modern". |
| MOTION_INTENSITY | ~8 (things move constantly) | **4**, then **raised to about 6 on 2026-10-15 at the owner's request** | The brand is "hush", so the first target was 4. The owner asked for the motion back, so it returned in Phase 2, each piece with a reason, a reduced-motion path and (for anything that runs on its own) a Pause control. |
| VISUAL_DENSITY | ~4 | **3** | Spacious, one idea per section. |

Impeccable mode: the landing page is **Persuade**. The future logged-in app is **Operate** (scanability and consistency beat expression). They get different rules, which is why the sidebar belongs in the app and not on the landing page.

### 3.2 Where the three skills disagree, and my call

| Topic | UI/UX Pro Max says | Taste says | Impeccable says | **Decision** |
|---|---|---|---|---|
| Purple accent | Recommends `#7C3AED` plus a cyan `#0891B2` accent | "Lila rule": discouraged by default, **but a brand that is already purple stays purple** (section 11.C). Max 1 accent. | Detector flags violet gradients as an "AI colour palette" tell | **Keep flat `#7C3AED` as the one accent. Delete the violet gradients and the aurora glow. Reject the cyan.** The brand is already violet, so redesign-preserve applies. Gradients are what make it look generic. |
| Font | Suggests Space Grotesk + DM Sans | Avoid Inter by default; names **Geist + Geist Mono** as a pairing | (not prescriptive here) | **Geist + Geist Mono.** Geist Mono is already loaded, so the swap is one line, and Space Grotesk's "futuristic/bold" mood fights a quiet brand. |
| Icons | Phosphor default | Phosphor, Lucide only if already used | (none) | **Keep Lucide for now** (it is already a dependency and `Icon` standardises stroke at 1.75). Switch to Phosphor during the Phase 2 migration, when icons become imports. One family at a time. |
| Glass blur | Use blur to dismiss a background (modal), not as decoration | Fine for premium consumer, wrong for "boring B2B" | Flags it as a tell when decorative | **Blur only on the floating nav**, where content scrolls underneath it. Buttons and cards become solid. Add a `prefers-reduced-transparency` fallback. |
| Sidebar | Sidebar for large screens (app UI guidance) | Navigation on one line, max 80px high | Mode decides: Persuade vs Operate | **Remove the sidebar from the landing page. Reuse it in the Phase 3 dashboard.** |

### 3.3 Audit: what is wrong, ranked

Evidence is from the code, from contrast ratios I computed (WCAG formula, script run in this session), and from Impeccable's detector (5 findings). **I have not seen the page render**: the browser pane cannot open local files. Treat the "looks like" claims as code-derived until we screenshot it in Phase 1.

**A. Honesty problems (fix first)**

| # | Problem | Where |
|---|---|---|
| A1 | Waitlist confirms "You're on the list" but stores nothing. Also has no loading, error, or already-subscribed state. | `Sections.jsx` `Waitlist` |
| A2 | "Sign up" in the nav leads to a screen titled "Welcome back / Sign in to your account". Wrong promise, and there are no accounts to sign in to. | `App.jsx` Nav, `Login.jsx` |
| A3 | Login accepts anything and "Continue with Google" fakes a Google account. Fine as a prototype, not on a public site. | `Login.jsx` |
| A4 | "Saved to drafts" after Save workflow; nothing is saved. | `AgentBox.jsx` |
| A5 | Footer About / Privacy / Terms are all `href="#top"`. You cannot collect emails without a privacy notice. | `Footer.jsx` |

**B. Accessibility and contrast (measured)**

| # | Problem | Number |
|---|---|---|
| B1 | **Light mode hero headline** "Hushwork handles it." is a white-to-lilac gradient on a near-white page | white 1.07:1, `#C4B5FD` 1.72:1 (need 4.5:1; large text 3:1) |
| B2 | **Light mode footer** text `#bdbab0` and the dot wordmark `#ebe8dc` are hard-coded for a dark page | 1.81:1 and **1.14:1** (effectively invisible) |
| B3 | Light mode secondary buttons are `bg-white/10` with `border-white/20` on a light page | Boundary is practically invisible |
| B4 | Violet-400 step numbers and icons on white cards | 2.72:1 (need 3:1 for icons, 4.5:1 for small text) |
| B5 | Dark mode footer headings and copyright `#6f6d66` | 3.8:1 (need 4.5:1) |
| B6 | Form field borders (`border-line`) | Light 1.32:1, dark 1.16:1 (need 3:1 to identify a control) |
| B7 | Light mode placeholder text (`text-mute/60`) | 2.64:1 |
| B8 | Accent `#7C3AED` used as **text** on the dark background (links, "Workflow ready") | 3.46:1 |
| B9 | **Reduced motion is not fully honoured.** The global CSS rule stops CSS animations, but the hero carousel is driven by a JavaScript `requestAnimationFrame` loop and the feature diagrams use SVG `<animate>` tags. Neither is stopped by that rule, so they keep moving for users who asked for no motion. | WCAG 2.2.2 (pause/stop/hide) |
| B10 | Automation folders are `<div onClick>`: not focusable, no keyboard operation | Pro Max `keyboard-nav` |
| B11 | "How it works" cards are `<button>`s whose only effect is a visual lift. A control that does nothing. | `Sections.jsx` |
| B12 | No `<main>` landmark and no skip link on the home page | Pro Max `skip-links` |

**C. Structure and layout**

| # | Problem |
|---|---|
| C1 | **Sidebar plus top nav on a marketing page.** The top nav's link row is permanently hidden (`className="mx-auto hidden"`), so on desktop it only holds a theme toggle and auth buttons while the sidebar does the navigating and eats 240px of width. This is the app shell leaking into the landing page. |
| C2 | Hero is a fixed `h-[760px]` with a `top-[520px]` hard-coded carousel and `pt-32` top padding. Taste: use `min-h-[100dvh]`, cap top padding at `pt-24`. |
| C3 | Hero visual is nine hand-built SVG "workflow screenshots" in a spinning 3D band. Taste bans fake screenshots and hand-rolled SVG illustration; the hero needs a real visual. |
| C4 | Three sections in a row use three equal cards (`How it works`, `Automations`, and the feature trio). Taste's layout-repetition ban and "no three equal cards". |
| C5 | Duplicate CTA intent: "Join the waitlist", "Join waitlist", "Sign up". One label per intent. |
| C6 | Hero subtext is 22 words (limit 20). Hero stack is badge + headline + subtext + 2 CTAs, which is fine, but trim the copy. |

**D. Motion**

| # | Problem |
|---|---|
| D1 | Things that animate forever for no reason: floating glow blob, shimmering gradient headline, spinning card band (runs even when scrolled offscreen), dashed flow lines, bars that pulse in SVG, "syncing..." pulse. Taste: every animation must communicate something. |
| D2 | Bounce easing on the folders (`cubic-bezier(.34,1.36,.5,1)`), flagged by the detector as dated. |

**E. Detector findings (Impeccable, 5)**: violet palette tell in `Sections.jsx:7`, `Sections.jsx:22`, `ui.jsx:8`; gradient text in `Login.jsx:15`; bounce easing in `Sections.jsx:12`. The detector did not flag the hero gradient text (B1) because it is written as an arbitrary Tailwind value, so I flagged it by hand.

**F. Technical**

| # | Problem |
|---|---|
| F1 | Development builds of React and a multi-megabyte in-browser Babel compiler run on every visit. Slow first load. |
| F2 | The page is an empty `<div id="root">` until JavaScript finishes. Link previews and some crawlers see nothing. There is a `<title>` but no meta description and no Open Graph tags. |
| F3 | Eight em dashes in the files (four in live copy: page title, Features body, two in AgentBox). Taste bans them in page copy. |
| F4 | `ProductMock` and `UseCases` are dead code (about 60 lines each). |
| F5 | Sidebar uses a `window` scroll listener to track the active section. Removed with the sidebar. |

### 3.4 Section-by-section redesign

| Section | Now | Change | 21st.dev reference |
|---|---|---|---|
| **Nav** | Floating bar with hidden links, plus a sidebar | One floating bar, one line, 64px: logo, 4 anchor links (`#how` `#auto` `#features` `#agent`, IDs unchanged), theme toggle, single CTA "Join the waitlist". Blur stays here. | Navigation Menus category (477 items) |
| **Hero** | Centered text over a spinning band of fake cards | **Split hero.** Left: headline, one 18-word sentence, one primary CTA, one secondary. Right: the **real agent box**, compact, with the plan building step by step. It is a genuine component preview, which Taste allows, and it is Hushwork's best asset. Solid violet button, no gradient text, no glow. | Waitlist Hero (`/@minhxthanh/components/waitlist-hero`) for structure |
| **How it works** | 3 equal clickable cards labelled 01/02/03 | A **vertical timeline**: verb labels ("Describe", "Review", "Run") on a rail, with the existing sentences beneath. No fake click. | How It Works Timeline (`/@olewandowski1/components/how-it-works-2`, MIT) |
| **Automations** | 3 equal folders, `div onClick` | Keep the folder metaphor, make each a real `<button>` with `aria-expanded`, replace bounce with a decelerating ease, and change the layout to **one wide folder row with tabs** so it stops repeating the 3-card shape. | Tabbed Feature Categories (`/@olewandowski1/components/features-4`) |
| **Features** | Three decorative animated SVG diagrams | Asymmetric bento (1 large + 2 small). Replace the diagrams with **real mini-UIs**: the approval card (trust story) and the run log (reusing the unused `ProductMock`'s steps list). | Grid Feature Cards (`/@efferd/components/grid-feature-cards`), Approval Card (MIT), Audit Log (`/@corr/components/audit-log`) |
| **Agent box** | Strong. Keep. | Move a compact version into the hero; keep the full-size one as the "try it" section, or fold them into one. Fix A4 copy. Plan steps keep their sequential reveal (that animation shows the plan being built, so it is motivated). | Agent Plan (`/@isaiahbjork/components/agent-plan`, MIT), AI Task List (`/@educalvolpz/components/ai-task-list`, MIT) |
| **Waitlist** | Solid violet slab, form does nothing | Real submit, with loading, success, error and "already on the list" states. One honest line about what early access means (no fabricated scarcity or counts: Pro Max `waitlist-coming-soon` rule). | (own design) |
| **Footer** | Dot wordmark, dead links, hard-coded dark colours | Token colours (fixes B2/B5), real Privacy page, remove dead links, keep the wordmark. | Halftone Wordmark Footer (`/@kedhareswer/components/halftone-wordmark-footer`) |
| **Login** | Fake | Hide from the public nav until real auth exists (Phase 3). When it returns, use a split screen with a visible 3:1 field border. | Sign In Split Screen (`/@felipemenezes098/components/sign-in-6`) |

**Motion plan (dial 4):** hero entrance once; scroll reveal once per section (the existing `Reveal`, fine); button press feedback; plan steps appearing in sequence; the "thinking" caret. Everything else is static. All JS-driven motion checks `matchMedia('(prefers-reduced-motion: reduce)')`.

### 3.5 Tokens

Keep the existing variable names. Changes:

```css
:root {                         /* light */
  --bg: 247 246 252;  --surface: 255 255 255;  --raised: 239 236 250;
  --ink: 24 20 40;    --mute: 98 92 120;       --line: 226 222 240;
  --accent: 124 58 237;           /* fills, buttons: unchanged, white text on it = 5.7:1 */
  --accent-text: 109 40 217;      /* NEW: #6D28D9 for text on light = 6.61:1 */
  --field: 139 132 163;           /* NEW: input border #8B84A3 = 3.54:1 */
  --placeholder: 111 105 137;     /* NEW: #6F6989 = 5.18:1 */
}
.dark {
  --bg: 11 10 18;  --surface: 21 18 31;  --raised: 32 26 56;
  --ink: 244 242 251;  --mute: 185 180 204;  --line: 36 30 56;
  --accent: 124 58 237;
  --accent-text: 196 181 253;     /* #C4B5FD on dark = 10.67:1 (was 3.46:1) */
  --field: 107 100 133;           /* #6B6485 = 3.33:1 */
  --placeholder: 168 163 188;
}
```

- **Radius rule (Taste shape lock):** controls 14px (`xl`), cards 20px (`2xl`), page-level panels 28px (`3xl`). Remove the stray `rounded-[14px]`, `rounded-[20px]`, `rounded-[28px]` literals.
- **Type:** Geist 400/500/600, Geist Mono for labels. Scale 14 / 16 / 18 / 24 / 36 / 56. Headings `tracking-tight`, no gradient text. Body max 65 characters wide.
- **Buttons:** solid. Primary = flat violet, white text. Secondary = `surface` fill with a `--field` border. Min height 44px on touch screens.
- **Footer text** uses `ink`/`mute` tokens, not hex, so both themes work.

---

## 4. 21st.dev research

### What 21st.dev is
A marketplace and registry of React + Tailwind components in the shadcn/ui style (12,000+ items, 700+ authors). Components are source code you copy into your project. Its categories live at `https://21st.dev/community/components/s/<slug>`.

### How I collected this, and the limits
- My normal fetch tool failed (an error on the tool's side, not the site), so I **used the built-in browser** to load pages and read their text and links.
- I read: the home page, the category listings for **hero, features, ai-chat, timeline, sign-in, footer, grid**, and individual pages for **agent-plan, approval-card, how-it-works-2, ai-task-list** (licence and dependencies read and confirmed), plus **grid-feature-cards, waitlist-hero, sign-in-6** (opened, but the licence panel had not loaded).
- This is **a targeted sample, not the whole site.** Heroes alone are 1,152 components. Names below marked "listed" I saw in listings but did not open.
- Previews render small in the narrow browser pane. I judged patterns from descriptions and structure, not from pixel-level inspection.
- Reuse rule: take the **structure and interaction pattern**. If we copy actual code, check that component's own licence line first. The four I confirmed say MIT.

### Shortlist

| Need | Component | Status | Dependencies (as listed) |
|---|---|---|---|
| Plan steps with status | [Agent Plan](https://21st.dev/@isaiahbjork/components/agent-plan): "animated task plan for your agent, including subtasks" | Opened, MIT | lucide-react, framer-motion |
| Plan steps, minimal | [AI Task List](https://21st.dev/@educalvolpz/components/ai-task-list) | Opened, MIT | framer-motion |
| **Approval gate** (maps straight onto "ask for approval before anything is sent") | [Approval Card](https://21st.dev/@syeddhasnainn/components/approval-card): "human-in-the-loop decision surface for ... consequential actions" | Opened, MIT | @base-ui/react, class-variance-authority |
| How it works | [How It Works Timeline](https://21st.dev/@olewandowski1/components/how-it-works-2) | Opened, MIT | @remixicon/react |
| How it works (alt) | [Vertical How It Works Timeline](https://21st.dev/@ln-dev7/components/how-it-works-02), [Process Timeline](https://21st.dev/@shadcnui-blocks/components/timeline-05) | Listed | |
| Features bento | [Grid Feature Cards](https://21st.dev/@efferd/components/grid-feature-cards), [Feature Section with Bento Grid](https://21st.dev/@tommyjepsen/components/feature-section-with-bento-grid), [Features Grid](https://21st.dev/@shadcnui-blocks/components/features-01) | Opened / Listed | licence not verified |
| "Connects your tools" tile | [Integrations Grid](https://21st.dev/@efferd/components/integrations-4-2) | Listed | |
| Run log | [Audit Log](https://21st.dev/@corr/components/audit-log), [Activity Timeline](https://21st.dev/@olewandowski1/components/timeline-3), [Incident Status Timeline](https://21st.dev/@cnippet-dev/components/incident-status-timeline) | Listed | |
| Hero / waitlist | [Waitlist Hero](https://21st.dev/@minhxthanh/components/waitlist-hero), [Hero 1](https://21st.dev/@preetsuthar17/components/hero-1), [DevTool Landing Page](https://21st.dev/@mokshithgujjeti/components/dev-tool-landing-page) | Opened / Listed | |
| Sign in | [Sign In Split Screen](https://21st.dev/@felipemenezes098/components/sign-in-6), [Clean & Minimal sign in](https://21st.dev/@preetsuthar17/components/clean-minimal-sign-in) | Opened / Listed | |
| Footer wordmark | [Halftone Wordmark Footer](https://21st.dev/@kedhareswer/components/halftone-wordmark-footer), [Large Name Footer](https://21st.dev/@arihantcodes_1f7b8c4d/components/large-name-footer) | Listed | |
| Phase 3 app shell | Categories: [Sidebars](https://21st.dev/community/components/s/sidebar) (95), [Dashboards](https://21st.dev/community/components/s/dashboard) (400), [Empty States](https://21st.dev/community/components/s/empty-state) (77), [Onboarding](https://21st.dev/community/components/s/onboarding) (53) | Category pages only | |

Component libraries hosted on 21st that are worth a look for marketing blocks: Tailark, Efferd, Shadcnblocks.com, Motion Primitives, Magic UI.

### A caution
A lot of 21st's marketing blocks (Background Beams, Background Boxes, Aurora, glowing gradients) are exactly the decorative glow that Taste and Impeccable flag. Using them would recreate the generic AI-landing look this redesign is removing. Borrow **layout and interaction**, skip the **backgrounds and glow**.

---

## 5. Phased plan

Each phase ends with a "done when" you can check yourself.

### Phase 0: Safety net and context (one sitting)

**Why:** this folder is not under version control, so there is no undo. And Impeccable needs a short product brief so design decisions stop being re-argued.

1. Create a checkpoint system with Git (Git is a tool that records every version of your files so you can go back).

```bash
git init
git add .
git commit -m "Hushwork prototype as received"
```

`git init` creates the hidden history folder. `git add .` selects every file. `git commit` saves them as a named checkpoint you can return to.

2. Run Impeccable's `init` interview (5 or so questions) to write `PRODUCT.md`: who it is for, tone, what it must never look like. Later, `document` writes `DESIGN.md` from the finished code.

**Done when:** `git log` shows one commit and `PRODUCT.md` exists.

### Phase 1: Make the page honest and good, in place (Track A)

No build step, same files. Smallest changes first, highest impact first. Items cite the audit IDs above.

| Step | Work | Audit IDs |
|---|---|---|
| 1.1 | **Real waitlist** (see section 6.1). Loading, success, error, duplicate states. Honest confirmation copy. | A1 |
| 1.2 | Copy and truth pass: one CTA label ("Join the waitlist"), remove "Sign up", fix "Saved to drafts", remove em dashes, trim hero subtext to 20 words or fewer. | A2 A4 C5 C6 F3 |
| 1.3 | Hide Login from the public nav. Keep the file for Phase 3. | A3 |
| 1.4 | Token and contrast repair (section 3.5). Footer and wordmark to tokens. Field borders and placeholders. | B1-B8 |
| 1.5 | Nav consolidation: remove `SideBar`, enable the link row, one CTA. Delete the scroll listener. | C1 F5 |
| 1.6 | Hero rebuild: split layout, compact live agent box, `min-h-[100dvh]`, solid button, no gradient text, no carousel. | B1 C2 C3 |
| 1.7 | De-repeat sections: timeline for How it works, tabbed folders for Automations, bento for Features with real mini-UIs. Delete dead `UseCases`. | B4 B10 B11 C4 D2 F4 |
| 1.8 | Motion diet and reduced-motion for JS and SVG. | B9 D1 |
| 1.9 | Geist type swap, radius rule, solid buttons. | |
| 1.10 | `<main>`, skip link, 44px touch targets on mobile, privacy page, meta description and Open Graph tags. | A5 B12 F2 |
| 1.11 | **One bounded verification pass** (Impeccable's rule: build fully, inspect once, fix in one batch, confirm once, stop): run `impeccable detect`; re-run the contrast script; screenshot 375 / 768 / 1440 in both themes; test with reduced motion on; keyboard-only walkthrough; read every string (Taste's copy self-audit). | all |

Commit after each numbered step so any one can be undone.

**Done when:** detector reports no warnings, every pair in section 3.5 passes, the waitlist stores a real email you can see, and the page is readable in light mode.

**Important:** I have not seen the page render. Step 1.11 is where we first look at it.

### Phase 2: Move to a real project (Track A, and the base for Track B)

**Why:** fixes F1 and F2 (speed and SEO) and gives Track B a home. **What changes:** the code moves out of the browser-compiled setup into a normal project.

- **Next.js** (a framework that builds your React pages ahead of time so they load fast and show up in link previews) + **Tailwind v4** + **Supabase** (hosted database and login), deployed on **Vercel**.
- Create it in a **new folder**, not in `D:\arjun work\claude expo`. That folder already has a `package.json` with Tailwind and `motion` but no React, which looks like a leftover from another experiment.
- Your machine is ready: Node v26.7.0, npm 11.19.0 and Git 2.55 are installed.
- Port tokens into Tailwind v4's `@theme`; port components one file at a time; fonts via `next/font` (self-hosted, no Google link); icons Lucide -> Phosphor; reveal animation via `motion/react`.
- Default language: JavaScript, as the code is today. TypeScript can come later.

**Done when:** the live URL loads with LCP under 2.5s, CLS under 0.1 (Taste's Core Web Vitals targets), a pasted link shows a proper preview card, and visual parity with Phase 1 is confirmed.

### Phase 3: Product slice (Track B). Only after the gate.

**Gate (suggested, your call):** the waitlist has real signups **and** you have talked to some of those people. For example 100 signups or 10 conversations. The point is to learn which task people want automated before building connectors.

**Build one slice end to end: the Invoice Chaser.** It is the page's lead example and has the clearest value.

1. **Login** (Supabase Auth). The login screen comes back, now real.
2. **App shell with the sidebar** (this is where it belongs): Workflows, Runs, Connections.
3. **AI planner** (section 6.2): the agent box calls a server route that asks Claude for a plan.
4. **Connections:** Stripe (read-only key) and Gmail (**drafts, not auto-send, in v1**).
5. **Runner:** a scheduled job finds overdue invoices, drafts reminders, then stops at an **approval step**.
6. **Run log** and a **pause switch** (these are the page's "runs you can trust" promises, so they must exist before launch).

**Done when:** a stranger can describe "chase invoices over 7 days overdue", review the plan, connect Stripe and Gmail, approve the first drafts, and see a log entry for each run.

### Phase 4: Widen
More recipes (weekly report, inbox triage, lead follow-up), more connectors (Slack, Sheets, Calendar, Linear), billing, and auto-send once drafts are trusted. Only after Phase 3 shows people use it.

---

## 6. Technical design for the parts that become real

### 6.1 Waitlist (Phase 1.1)

**What a database is:** a program that stores your data in tables, like spreadsheets that code can read and write. **What Supabase is:** a service that hosts one for you and gives your page a safe way to talk to it.

```text
waitlist
 ├── id          (unique id)
 ├── email       (unique, so duplicates are caught)
 └── created_at  (when they joined)
```

```sql
create table waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (length(email) <= 254 and email ~* '^\S+@\S+\.\S+$'),
  created_at timestamptz not null default now()
);
alter table waitlist enable row level security;
create policy "anyone can join" on waitlist for insert to anon with check (true);
-- no select policy: the public can add emails but can never read them
```

**Row Level Security (RLS)** is the rule that decides who can read or write each row. Here the public can only add a row; reading the list is impossible from the browser, so someone opening dev tools cannot download your signups. That is why the page can carry Supabase's **publishable key**. It is designed to be public, unlike a secret key, which must never go in browser code.

Flow: `form -> browser -> Supabase (insert) -> success or "already on the list" -> message`. A hidden honeypot field (a form box real people never see) filters simple bots.

Simplest fallback if you want zero database now: Netlify Forms or Formspree. Both collect emails with almost no setup, but you would migrate later.

### 6.2 AI planner (Phase 3)

```text
User
  ↓
Agent box (browser)
  ↓
Server route  POST /api/plan        <- holds the secret key
  ↓
Claude API
  ↓
Server route  validates the reply
  ↓
Agent box shows steps; user approves or edits
```

- The **API key** (a password that lets your server use Claude and bills you) lives in an **environment variable** on the server (`ANTHROPIC_API_KEY`), never in browser code.
- The AI does **not** invent arbitrary actions. It picks from a fixed catalogue (`stripe.find_overdue`, `llm.draft_email`, `gmail.create_draft`, `approval.request` ...). The server rejects anything outside the catalogue. This is what makes runs safe and explainable.
- Prompt-injection note: invoice text and email bodies are untrusted input. They must be passed to the model as data, and the model's output can only choose catalogue steps, never run free-form commands.

### 6.3 Data for Phase 3

```text
workflows        runs               connections
 ├── id           ├── id             ├── id
 ├── user_id      ├── workflow_id    ├── user_id
 ├── name         ├── status         ├── provider (stripe, gmail)
 ├── prompt       ├── steps (json)   ├── secret_ref (encrypted token, not plaintext)
 ├── plan (json)  ├── started_at     └── scopes
 ├── schedule     └── finished_at
 └── paused
```

Every table gets RLS so a user can only see their own rows.

### 6.4 Risks (the real ones)

| Risk | Why it matters | Mitigation |
|---|---|---|
| **Google verification.** Gmail access sits behind Google's app-review process, and the broader read scopes can require a security assessment. **I have not verified the current requirements; check Google's docs before committing to Gmail.** | Could add weeks and cost | Start with drafts and the narrowest scope. Consider a Stripe-first slice if Gmail blocks. |
| **Trust.** The product sends messages in someone's name. | One wrong email to a client ends the relationship | Approval gate by default, drafts before sends, pause switch, per-run log. |
| **Reliability.** A scheduled job that silently fails is worse than no job. | Users assume it ran | Run status, retry, and a failure notification. |
| **Privacy.** You will hold emails, client names and invoice data. | Legal and trust | Privacy page before collecting anything (Phase 1.10), minimal data, delete-account path. This is not legal advice. |
| **Cost.** Every plan and every draft is a model call. | Margins | Cache plans, cap runs per user, measure cost per run before pricing. |
| **Demand.** Building connectors before knowing which task people want. | Wasted months | The Phase 3 gate. |

---

## 7. Definition of done for any UI change (distilled from the three skills)

- [ ] Both themes checked; text pairs 4.5:1, icons and field borders 3:1.
- [ ] One accent colour, one radius rule, one icon family.
- [ ] No gradient text, no decorative glow, blur only where content scrolls beneath.
- [ ] Every animation justifiable in one sentence; JS and SVG motion honour reduced motion.
- [ ] Every clickable thing is a real `<button>` or `<a>`, reachable by keyboard, with visible focus.
- [ ] Loading, error, empty and success states for every async action.
- [ ] Hero fits the first screen at 375px and 1440px; no horizontal scroll at 375px.
- [ ] One CTA label per intent. No dead links. No fabricated numbers; sample data labelled as sample.
- [ ] No em dashes; every string re-read.
- [ ] `impeccable detect` clean.

---

## 8. Decisions

**Defaults I chose (tell me if any is wrong):**

1. **"Build this" means both** the page and, eventually, the product. The plan front-loads the page.
2. **Keep the violet accent**, drop the gradients.
3. **Start with Phase 0 and Phase 1 in the existing no-build files**, migrating in Phase 2 rather than first.

**Questions only you can answer:**

1. **Waitlist storage:** Supabase (recommended; it is also the base for Track B) or a no-code form service for now?
2. **Is the first product slice really the Invoice Chaser?** It is the page's lead example, but you know your audience.
3. **Do you want the brand to stay loud-violet or move toward a quieter ink-violet?** "Hush" and a saturated violet pull in different directions. I kept violet because the brief was to preserve the brand.

---

## 9. Honest gaps

- I read the code but **did not see Hushwork rendered**. Light-mode claims come from colour maths on the tokens, not from looking.
- 21st.dev was **sampled, not exhausted**, and licences are confirmed for four components only.
- The Impeccable detector catches style tells, not layout or information-architecture problems; the structural findings (C1, C3, C4) come from reading the code.
- Estimates of effort are deliberately omitted. Sizes depend on how much you want to hand-build versus have me implement.
