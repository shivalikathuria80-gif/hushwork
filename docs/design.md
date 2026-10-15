# Design: sign-in, workspace and runs (first slice)

Written 2026-10-15 for `docs/spec.md` (owner-approved answers 1 to 4). Local only, http://localhost:3100. Figma not used (not authorised). Inputs: the repo, the five reference screenshots (layouts only, no copy taken) and the four sculpture images.

**How it was checked.** Contrast ratios are computed from the tokens in `app/globals.css` (WCAG formula, script). The sculpture blend was simulated in Python by copying the component's own shader maths (key out the flat background, multiply by panel colour / image colour) and the CSS `hue-rotate` matrix. It was not run in a browser, so the builder must look at both themes once (section 2.2). Component behaviour was read from its source.

---

## 0. Ground rules (apply to every page)

- **Existing tokens only.** No new colours, radii or fonts. Radius 12 (controls), 16 (cards), 24 (big panels). Geist for everything; Geist Mono only for durations and timestamps.
- **Three contrast limits found while checking** (bake into every component):
  1. Dark theme: a field border on `--raised` is 2.99:1 and an accent fill or accent icon on `--raised` is 2.91:1 (both need 3:1). Put inputs and the segmented control on `--surface` or `--bg`. On `--raised` use `--accent-text` for icons.
  2. There is no error colour and we do not add one. An error is the WarningCircle icon, the message text and a stronger border (`border-ink`) on the field. Never colour alone.
  3. Cards and tiles use `--line` borders (1.2:1, decorative). Each is identified by its text, icon and arrow, not by the border. Text fields use `--field` borders.
- **Type:** h1 `clamp(1.75rem, 3vw, 2.25rem)` semibold tracking-tight. h2 `text-lg font-semibold`. Body 15px. Meta `text-sm text-mute`. Labels `text-sm font-medium`.
- **Spacing:** Tailwind steps 1, 2, 3, 4, 6, 8, 12 only. Page gutters 20px phone, 32px tablet, 48px desktop.
- **Touch targets:** every control `h-11` on phones (the `Btn` pattern: `h-11 md:h-9`).
- **Icons:** Phosphor through `Icon`. Add to `components/icons.js`: `Eye`, `EyeOff` (EyeSlash), `SignOut`, `Trash`, `Plus`, `Save` (FloppyDisk), `History` (ClockCounterClockwise).
- No em dashes, no gradient text, no glass blur, no glow. Every page sets `<title>`, `robots: noindex`.

---

## 1. Pages and shared shell

| Route | Purpose | h1 | Title |
|---|---|---|---|
| `/login` | Sign in or create an account | "Welcome back" or "Create your account" | Sign in - Hushwork |
| `/app` | Describe a task, preview a plan, save drafts | "What should Hushwork take off your plate?" | Workspace - Hushwork |
| `/app/runs` | Runs viewer (empty state plus one Sample run) | "Runs" | Runs - Hushwork |

Signed-out `/app*` goes to `/login`. Signed-in `/login` goes to `/app`.

### App shell (wraps `/app` and `/app/runs`)

- **Desktop, 1024px and up.** Sticky left sidebar, 256px, `bg-surface`, `border-r border-line`, full height. Top: `Logo` (links to `/app`). Then `New workflow` (primary `Btn`, `Plus` icon, full width) and `Runs` (nav link, `History` icon). Bottom: signed-in email (`text-sm text-mute`, truncated, label "Signed in as"), `ThemeToggle` with text ("Light mode" or "Dark mode"), `Sign out` (ghost `Btn`, `SignOut` icon). Active link: `bg-raised text-ink font-medium` plus `aria-current="page"` plus a 2px `bg-accent-text` bar on its left edge (shape, not colour alone).
- **Tablet and phone, under 1024px.** No sidebar. A 56px top bar (`bg-surface`, `border-b border-line`): `Logo` left, a `Menu` icon button right (44px, `aria-expanded`, `aria-controls`, Escape closes; same pattern as `Nav.js`). The menu is a dropdown under the bar listing New workflow, Runs, email, theme toggle, Sign out. Content is centred, `max-w-3xl`.
- `New workflow` on `/app` also clears the composer and focuses it (it is the same page, so the link alone would do nothing).
- Sign out: loading state on the button, then `/login`. Failure: "Could not sign out. Try again." in a `role="status"` line under the button.
- First focusable item on every page: skip link, same markup as `app/page.js`. Main content is `<main id="main">`.

```
DESKTOP                                   TABLET / PHONE
+----------+------------------------+     +-------------------------+
| H Hush.. |                        |     | H Hushwork       [Menu] |
| [+ New ] |  <main>  max-w-3xl     |     +-------------------------+
|  Runs    |  centred               |     |  <main> stacked,        |
|          |                        |     |  gutters 20 / 32px      |
| you@mail |                        |     |                         |
| Dark mode|                        |     +-------------------------+
| Sign out |                        |
+----------+------------------------+
```

---

## 2. `/login`

### 2.1 Layout

```
DESKTOP (>= 1024)
+---------------------------+----------------------------+
| H Hushwork                |                    [theme] |
|                           |                            |
|     live sculpture        |   Welcome back             |
|     (reacts to cursor)    |   Sign in to see your      |
|                           |   drafts.                  |
|                           |   ( Sign in | Create acc.) |
|  Quiet work,              |   Email address            |
|  done.                    |   [______________________] |
|                           |   Password                 |
|  Sculpture component by   |   [_____________ (eye)]    |
|  ...             [Pause]  |   [        Sign in       ]  |
+---------------------------+----------------------------+
 panel 50%, sticky, h-svh      form column max-w-[400px],
 light --raised / dark --bg    centred, page bg --bg

TABLET (640-1023)                    PHONE (< 640)
+-----------------------------+      +---------------------+
| H Hushwork          [theme] |      | H Hushwork  [theme] |
|  ~~ still sculpture, 176px ~|      | ~ still sculpt 112px|
|  Welcome back  (max-w 420)  |      | Welcome back        |
|  tabs, fields, button       |      | tabs, fields, button|
+-----------------------------+      +---------------------+
```

DOM order (this is also the tab order): skip link, `Logo` (links to `/`), `ThemeToggle`, `<main id="main">` (form), then the panel's bottom row (credit link, Pause). The bottom row is the last child of the page root and is positioned over the left panel with CSS (`absolute bottom-5 left-0 w-1/2 px-6 hidden lg:flex`). Keyboard users reach the form first; Pause comes last because the sculpture only reacts to a mouse.

### 2.2 The sculpture panel

**Containment.** Wrapper is `absolute inset-0` (the component's `height="100%"` needs a parent with a definite height) and carries `aria-hidden="true"`. Logo and the bottom row sit above it with `pointer-events-none`, and only the link or button inside gets `pointer-events-auto`, so the mouse still reaches the sculpture everywhere else. Do not use `inert` or `pointer-events-none` on the sculpture wrapper (it listens for pointer events on its own root).

**Props that make the component a contained decorative panel** (the component file stays untouched):

```jsx
<SculptureHero
  key={live ? "live" : "still"}
  className="login-art"
  src="/sculpture/light.webp"            darkSrc="/sculpture/dark.webp"
  mobileSrc="/sculpture/mobile-light.webp" mobileDarkSrc="/sculpture/mobile-dark.webp"
  imageAlt=""                              // decorative
  theme={dark ? "dark" : "light"}         // from useTheme(); the component has no toggle of its own here
  background="#efecfa"  darkBackground="#0b0a12"   // --raised (light), --bg (dark), as hex
  textColor={dark ? "#f4f2fb" : "#181428"}          // --ink
  headline={"Quiet work,\ndone."} headlineAccent="" eyebrow="" body=""
  primaryCta={{ label: "", href: "" }} secondaryCta={{ label: "", href: "" }} navCta={{ label: "", href: "" }}
  showNav={false} themeToggle={false} showCredit={false} backdropText="" loadFonts={false}
  headingFont="var(--font-geist-sans), system-ui, sans-serif"
  bodyFont="var(--font-geist-sans), system-ui, sans-serif"
  accentFont="var(--font-geist-sans), system-ui, sans-serif"
  hint="Move your cursor over it" hintTouch=""
  height="100%" interactive={live} intro={false} ambient={false}
/>
```

Mount rules (client only, so no flash of the wrong theme): render only when `useTheme()` is not `null`, and only when `(min-width: 1024px)` matches. `live = (hover: hover) and (pointer: fine) matches && !usePrefersReducedMotion() && !paused` (from `useMotionPause`). Add a 7-line `useMediaQuery` hook modelled on `usePrefersReducedMotion.js`.

**What the component cannot do without a code change, and the workaround**

| Limit | Workaround |
|---|---|
| Always renders an `<h1>` (an empty headline gives an empty `<h1>`) | The wrapper is `aria-hidden`, so assistive tech sees one h1, the form's "Welcome back". The headline text stays visible as a decorative tagline. Nothing else in the panel is focusable. |
| Colours must be hex strings (it reads them in JavaScript for the shader) | Keep the two panel hexes and two ink hexes in one `const` next to the tokens and note "mirrors globals.css". |
| Image defaults are hotlinked from `cdn.21st.dev` | Pass all four `src` props (above). Missing one makes it fetch the remote default. |
| No Pause. Turning `interactive` off while the pointer is inside leaves the material stuck mid-flow | `key` flips between `"live"` and `"still"`, which rebuilds the engine at rest. Pause, reduced motion and "no hover device" all use this. |
| Reduced motion only halves the strength, it does not stop | `interactive={false}` when reduced motion is on, so the panel is a still image. |
| Credit link is 10px at 38% opacity (fails contrast) and the hint is 11px at 50% | `showCredit={false}`, render our own credit (below), restyle the hint in CSS (2.4). |
| Loads Google Fonts by default | `loadFonts={false}`. |
| Leaves an empty `.sh-aside` block and a large headline | CSS overrides in 2.4. |
| Raw fallback image shows its beige or black rectangle | CSS edge fade in 2.4. |

Nothing here blocks. The component stays as it is.

**Blend with our tokens (beige and brass images).** The component removes the image's flat background and multiplies the sculpture colours by (panel colour / image colour). Simulated results:

| Theme | Panel colour | Result |
|---|---|---|
| Dark | `--bg` #0b0a12 | The sculpture turns periwinkle-violet by itself. No filter needed. This is the only good dark choice: on `--surface` it goes pink and bright, on `--raised` it blows out to near white. |
| Light | `--raised` #efecfa | Stays warm beige on a lilac panel. Add `hue-rotate(235deg)` (light theme only) to turn it violet-grey. 215deg is bluer, 255deg pinker, all acceptable. Check once in the browser. |
| Fallback and still images | same panel colours | Raw images carry their own flat background (light #e9eae5, dark #111111). The edge fade hides the rectangle, and the same hue shift applies in both themes (the raw dark image is beige, not yet violet). |

When an owned violet image replaces these, delete the two hue-shift rules and keep the edge fade.

**What shows in each state**

| State | What the person sees |
|---|---|
| Loading (before hydration, image fetching) | Flat panel colour, Logo, credit row. No spinner or skeleton. When the sculpture mounts the wrapper fades in over 400ms (`hw-fade`, 2.4). |
| Live (desktop, mouse, motion allowed) | Crisp image. Cursor makes the material flow, then it settles in about 4 seconds. A small hint under the sculpture, gone after the first mouse move. |
| Paused | Remounted at rest, `interactive` off, no hint (so no pulsing dot). Pause button shows "Play motion". Saved in `hw-motion`, so a reload stays paused (same switch as the landing page). |
| Reduced motion | Still image, no particles, no Pause button (same rule as `WorkflowBand`). Form fully usable. |
| No WebGL2, or context lost | The component shows its own fallback image, positioned like the live one, with our hue shift and edge fade. No error text, no blank box. Pause button stays (it is a shared site setting). |
| Image fails to load | Panel stays flat colour with Logo and tagline. `alt=""` means no broken-image icon. |
| Under 1024px (tablet, phone) | No panel and no WebGL. A still band above the form: `<img>` pair `/sculpture/light.webp` and `/sculpture/dark.webp` (landscape fits a short band), `class="dark:hidden"` and `class="hidden dark:block"`, both `loading="lazy" decoding="async" fetchpriority="low" alt=""` with `width="1983" height="793"`. Hidden lazy images are not fetched, so only the visible theme downloads. Band height `h-28 sm:h-44`, `object-contain`, background `--raised` (light) or `--bg` (dark). |
| Large touch screen (iPad landscape) | Panel shows, `interactive` off, so a still image. |

**Pause control.** Bottom-right of the panel, `PauseButton` (extracted from `WorkflowBand`, same markup: ghost, `h-11`, `Pause` or `Play` icon, "Pause motion" or "Play motion"). Hidden when reduced motion is on.

**Credit** (bottom-left of the panel): "Sculpture component by guglielmogiannattasio.it", a link, `text-xs text-mute underline`, 24px minimum target, `target="_blank" rel="noopener"`. It credits the component only, not the image (image licence unknown). Update it when the image is replaced.

### 2.3 Check once in a browser (not verified here)

Both themes: tint looks violet, no visible rectangle edge in the fallback, headline readable, hint readable, then the portrait variant (viewport 1024 to 1279, panel under 640px wide, where the component switches to the `mobile-*` images and the picture may tuck 30% under the headline).

### 2.4 CSS to add to `app/globals.css`

```css
/* Login sculpture panel. The component file is untouched; these rules only adjust it. */
@keyframes hw-fade { from { opacity: 0; } to { opacity: 1; } }
.hw-fade { animation: hw-fade 0.4s ease-out both; }

.login-art .sh-aside { display: none; }                    /* empty block (no body, no buttons) */
.login-art .sh-content { padding-bottom: 72px; }           /* room for the credit and Pause row */
.login-art .sh-h1 { font-size: clamp(40px, 6cqw, 72px); }  /* quieter than the component's default */
.login-art .sh-hint { opacity: 1; color: var(--mute); font-size: 12px; letter-spacing: 0.08em; } /* still fades out after first move */
:root:not(.dark) .login-art .sh-stage { filter: hue-rotate(235deg); }  /* light: beige to violet-grey (canvas and fallback) */
.dark .login-art .sh-fallback { filter: hue-rotate(235deg); }          /* dark: live canvas is already violet, only the raw fallback needs it */
.login-art .sh-fallback, .login-still {
  -webkit-mask-image: linear-gradient(to right, transparent, #000 10%, #000 90%, transparent), linear-gradient(to bottom, transparent, #000 12%, #000 88%, transparent);
  -webkit-mask-composite: source-in;
  mask-image: linear-gradient(to right, transparent, #000 10%, #000 90%, transparent), linear-gradient(to bottom, transparent, #000 12%, #000 88%, transparent);
  mask-composite: intersect;
}
.login-still { filter: hue-rotate(235deg); }
```

The edge fade is a mask, not a glow. `hw-fade` is skipped by the existing reduced-motion rule (durations drop to 0.01ms).

### 2.5 The form (right side)

- **Switch:** a two-option segmented control built from native radios in a `<fieldset>` (legend visually hidden: "Choose how to continue"): "Sign in" and "Create account". Arrow keys work natively. Container `bg-surface border border-field rounded-xl p-1`, each option `h-11 md:h-10 rounded-lg`, selected `bg-accent text-white`, unselected `text-mute`. Switching keeps the typed email and clears errors. No separate toggle link.
- **Heading and sub (changes with the switch, 150ms crossfade):**

| Mode | h1 | Line under it |
|---|---|---|
| Sign in | Welcome back | Sign in to see your drafts. |
| Create | Create your account | Save your plans as drafts and come back to them. |

- **Fields** (inputs on `--surface`, `h-12 rounded-xl px-4 text-[15px]`, `border-field`, placeholder `text-hint`, keep the global 2px focus outline, do not hide it):
  - "Email address": `type="email"`, `inputMode="email"`, `autoComplete="email"`, `autoCapitalize="none"`, `spellCheck={false}`, placeholder "you@company.com".
  - "Password": `autoComplete` is `current-password` (sign in) or `new-password` (create). Create mode shows helper text "At least 8 characters." (visible always, replaced by the error when there is one).
  - Show or hide password: a 44px icon button inside the field, `Eye` or `EyeOff`, constant label "Show password" with `aria-pressed`. The password hides again on submit.
- **Submit:** `Btn` primary, `size="lg"`, full width, label "Sign in" or "Create account", `loading` while the request runs (spinner, `aria-busy`, disabled), plus a visually hidden `role="status"` line "Signing in..." or "Creating your account...".
- **Note under the button, create mode only:** "Hushwork is an early preview. You can describe work and save drafts. Nothing runs yet. We only use your email to sign you in. Privacy" (the last word links to `/privacy`). Sign-in mode shows no note.
- No "Forgot password" and no social buttons: neither works in this slice, and a dead control breaks "say only what is true".
- **Validation** runs on submit (form has `noValidate`). Field errors sit under the field, linked with `aria-invalid` and `aria-describedby`. Focus goes to the first invalid field. Form-level errors sit above the button in a `role="alert"` box (`rounded-xl border border-field bg-raised px-3 py-2.5 text-sm`, WarningCircle icon in `text-accent-text`).
- **Focus after a failed request:** wrong credentials go to the password field (text selected). Existing account stays on the "Sign in instead" button. Weak password goes to the password field. Offline or server error returns to the submit button.
- **Success:** the button stays in its loading state while the redirect runs and a `role="status"` line says "Signed in. Opening your workspace." On `/app` focus lands on the h1 (`tabIndex={-1}`).
- **Create with email confirmation switched on in Supabase:** no session comes back. Replace the form with a `role="status"` block: h1 "Check your email", then "We sent a link to {email}. Open it to finish creating your account, then sign in.", then a ghost button "Use a different email". If Supabase returns a user with an empty `identities` list, that also means "account already exists" (it hides the error on purpose). Treat it as the existing-account error.

### 2.6 Messages

| When | Message | Extra |
|---|---|---|
| Email empty or malformed | Enter a valid email address, like you@company.com. | field |
| Password empty (sign in) | Enter your password. | field |
| Password under 8 (create), or server "weak password" | Use at least 8 characters. A short sentence you will remember works well. | field |
| Wrong email or password (Supabase says only "invalid credentials", so we cannot tell which) | That email and password do not match. Check both and try again. | inline button "New here? Create an account" (switches mode, keeps email, focuses password) |
| Account already exists (create) | An account with this email already exists. | inline button "Sign in instead" (switches mode, keeps email, focuses password) |
| Too many attempts (429) | Too many attempts. Wait a minute, then try again. | |
| Offline or request failed | Cannot reach Hushwork. Check your internet connection and try again. | |
| Anything else | Something went wrong on our side. Try again in a moment. | |

Match Supabase's minimum password length setting to 8 so the form and the server agree.

---

## 3. `/app`

### 3.1 Layout

```
DESKTOP (content column max-w-3xl, centred)        PHONE
        [violet mark 44px]                         [mark]
  What should Hushwork take off your plate?        What should Hushwork
  Describe something you do every week.            take off your plate?
  You get a plan to read, not a workflow           Describe something...
  that runs.
 +--------------------------------------------+    +----------------------+
 | Describe the work...                        |    | textarea             |
 |                                        [^]  |    |                 [^]  |
 +--------------------------------------------+    +----------------------+
  This is a preview. It drafts a plan and          This is a preview...
  sends nothing.
  (plan card appears here after the arrow)
  When should it happen?                           When should it happen?
  [On a schedule] [When something] [When I ask]    [On a schedule]       (stack)
  Recipes                                          [When something arrives]
  [ Chase unpaid invoices ] [ Weekly client rpt ]  [When I ask]
  [ Sort inbox ] [ New leads ] [ Admin ]           Recipes (5 tiles stack)
  Your drafts (2)                                  Your drafts
  [icon] Name  Draft   [Open] [rename] [delete]    rows
```

Tablet matches the phone sketch with the content column centred and the recipe grid as on desktop.

**Empty state.** The page always starts here: a 44px `rounded-2xl bg-accent` tile with a white `Workflow` icon (decorative), the h1 (centred), one line of `text-mute` copy: "Describe something you do every week. You get a plan to read, not a workflow that runs." Then the composer.

### 3.2 Composer: reuse `AgentBox`, app variant

| Control in `AgentBox.js` | In the app |
|---|---|
| Label "What should Hushwork take off your plate?" | Stays but visually hidden and reworded "Describe the work you want off your plate" (the h1 already says the sentence) |
| Textarea (3 rows, Enter sends, Shift+Enter new line, placeholder) | Unchanged |
| Mode chips Search, Deep research, Reason | **Removed.** They add invented steps to a canned plan |
| Attach files button, hidden file input, file chips | **Removed.** Nothing would be uploaded |
| Arrow button | Stays. Accessible name becomes "Preview plan" (was "Build workflow") |
| Line "This is a preview. It drafts a plan and sends nothing." | Stays, same words |
| "Try one:" chips | **Removed** in the app (the cards and recipes below do that job) |
| "Reading your request" row with caret | Stays |
| Plan header "Building your workflow" and "Workflow ready" | Replaced by an `h2`, "Preview plan. Nothing will run.", shown from the first step on |
| Plan steps (`StepRow` plus check) | Stay |
| "Join the waitlist" button | **Replaced by "Save as draft"** (primary `Btn`, `Save` icon) |
| "Edit request", "Start over" | Stay |
| Line "Nothing is saved yet. Join the waitlist..." | Replaced: before saving "Not saved yet."; after saving "Saved to your drafts. It will not run." |

Cards, tiles and "Open draft" fill the composer through one new prop, `seed` (`{ id, text, plan? }`, `id` increases on each click). Text only: fill, focus the textarea, scroll it into view, do not run. With `plan`: show that saved plan straight away (no step-by-step reveal) in the "saved" state.

### 3.3 Save as draft states

| State | What shows |
|---|---|
| Idle | "Save as draft" button beside Edit request and Start over |
| Saving | Button shows spinner, label "Saving...", disabled, `aria-busy`. Others stay enabled |
| Saved | Button is replaced (150ms fade) by a `role="status"` line with CheckCircle: "Saved to your drafts. It will not run." and a link "See your drafts" (jumps to `#drafts`). The new row appears at the top of Your drafts. The button returns if the request is edited and previewed again (a new save makes a new draft) |
| Error | Button comes back labelled "Try again". Under it, `role="alert"`: "Could not save your draft. Check your connection and try again." If the session ended: "Your session has ended. Sign in again to save." with a link to `/login` |

Draft name is made for the person: the first 60 characters of the request, cut at a word boundary with "..." if shortened. They can rename it later.

### 3.4 "When should it happen?" cards (3)

`h2` "When should it happen?" Three buttons in a row (stack on phones). Each card is a `rounded-2xl border border-line bg-surface p-4` button: 36px icon tile (`bg-raised`, `text-accent-text`), title `font-medium`, one `text-sm text-mute` line. Click fills the composer with the start of a sentence, cursor at the end.

| Icon | Title | Line | Fills the box with |
|---|---|---|---|
| Clock | On a schedule | Every day, week or month. | `Every weekday at 9am, ` |
| Mail | When something arrives | A new email, lead or payment. | `When a client emails me, ` |
| Zap | When I ask | You press the button when you want it done. | `Whenever I ask, ` |

Chosen over repeating the three job examples so these cards and the recipes below do different jobs: cards teach how to phrase a request, recipes are ready-made jobs. If the owner prefers three finished examples, the existing `SUGGEST` list in `AgentBox.js` is the one-line swap.

### 3.5 Recipes (5 tiles)

`h2` "Recipes", then `text-mute`: "Common weekly jobs. Pick one to fill the box, change the words, then preview the plan." Grid: 1 column on phones, from 768px a 6-column grid (`md:grid-cols-6`, `gap-3`), 2 large tiles span 3, 3 small tiles span 2. Whole tile is a button (hover lift 200ms like `Btn`, `hover:bg-raised`), `ArrowRight` at its bottom right. Large tiles are about 176px high with a mono meta line "In the plan: ..." (names tools the plan would use, so nothing claims they are connected). Small tiles about 120px, no meta line.

| Size | Icon | Title | Body | Meta | Text put in the box |
|---|---|---|---|---|---|
| Large | Receipt | Chase unpaid invoices | Spot invoices more than 7 days late and draft a polite reminder for each client. | In the plan: Stripe, Gmail | Every weekday at 9am, find invoices more than 7 days overdue and draft a polite reminder for each client. Ask me before anything is sent. |
| Large | FileBarChart | Send a weekly client report | Gather what you finished this week and write a short summary for each client to check. | In the plan: Linear, Gmail | Every Friday at 4pm, summarise what I finished this week for each client and draft an email with the summary. Ask me before anything is sent. |
| Small | Inbox | Sort your inbox | File newsletters, star client mail and get one digest. | | Every morning at 8am, file newsletters into Reading, star emails from clients and send me one short digest. |
| Small | UserPlus | Follow up new leads | Reply to each new enquiry and remind you to chase it. | | When a new lead fills in my contact form, thank them within an hour and remind me to follow up after 3 days. |
| Small | FolderOpen | Keep admin tidy | Gather receipts and contracts and add deadlines to your calendar. | | Every month, gather my receipts and contracts into one folder and add upcoming deadlines to my calendar. |

### 3.6 Planner copy (`planFor` in `AgentBox.js`)

The preview is keyword matching, so the recipe text must land on the right plan. Two of the five jobs have no branch today, and there is an existing bug.

**Existing bug (also on the landing page):** the "Triage my inbox" example contains the word "client", so it matches the report branch first and shows a Friday report plan. Fix by testing in this order and removing bare `email` from the inbox pattern:

1. lead `/lead|enquir|prospect/`
2. admin `/receipt|contract|calendar|admin|expense/`
3. invoice `/invoice|pay|overdue|stripe/`
4. inbox `/inbox|newsletter|gmail/`
5. report `/report|friday|summar|client/`
6. otherwise the existing generic plan

All five recipe texts above were checked against this order (each lands on its own branch). New plans (icon, title, subtitle):

| Branch | Steps |
|---|---|
| lead | UserPlus "When a new lead arrives" / "Contact form or email"; PenLine "Draft a friendly reply" / "Uses your tone of voice"; ShieldCheck "Ask you to approve" / "Nothing is sent until you say yes"; Bell "Remind you in 3 days" / "If they have not replied" |
| admin | Clock "Run on the 1st of each month" / "9:00 am"; Receipt "Collect receipts and contracts" / "From your inbox"; FolderInput "File them by client" / "One folder each"; Calendar "Add deadlines to your calendar" / "Only dates found in contracts" |

Also add one step to the invoice and report plans just before the send step: ShieldCheck "Ask you to approve" / "Nothing is sent until you say yes". It matches product principle 2 and the recipe wording ("Ask me before anything is sent").

### 3.7 Your drafts

`h2` "Your drafts" with the count in `text-mute` (id `drafts`, `tabIndex={-1}`). It is last on the page, after Recipes (fixed order, so loading it does not shift the layout above).

| State | What shows |
|---|---|
| Loading | Three static placeholder rows (`bg-raised` blocks, no shimmer) and a hidden "Loading your drafts" status. `aria-busy` on the list |
| Empty | Bordered card: "No drafts yet." and "Preview a plan above, then choose Save as draft." with a ghost button "Write a request" that focuses the composer |
| Load error | "Could not load your drafts. Check your connection and try again." with a "Try again" button |
| List | `<ul>`, newest first |

**Row** (`rounded-2xl border border-line bg-surface p-3`): 36px `Workflow` icon tile, then the name as a button (truncated, accessible name "Open draft: {name}"), under it `text-sm text-mute` "Saved 14 Oct, 3:20 pm . 4 steps" (`<time>`), a `DRAFT` chip (`border border-line bg-raised text-xs`, so nobody mistakes it for a running workflow), then two 44px icon buttons: Rename (`Pencil`, label "Rename draft: {name}") and Delete (`Trash`, label "Delete draft: {name}").

- **Open:** puts the saved request and plan into the composer in the "saved" state (no Save button until the text is edited and previewed again), scrolls to it and moves focus to the plan's h2. Editing and saving again makes a new draft. Updating an existing draft is out of scope.
- **Rename:** the name turns into a text input (`aria-label="Draft name"`, text selected), with `Check` (label "Save name") and `X` (label "Cancel") buttons. Enter saves, Escape cancels. Saving shows a spinner on the Check button. Errors under the input: empty "Give the draft a name.", over 80 characters "Use 80 characters or fewer.", request failed "Could not rename. Try again." (`role="alert"`). Focus returns to the Rename button afterwards.
- **Delete (plain confirm, inline):** the row's content is replaced by "Delete this draft? This cannot be undone." with "Delete draft" (`Btn` dark variant) and "Keep draft" (secondary). Focus goes to "Keep draft". Escape cancels and returns focus to the Trash button. On success the row collapses over 200ms, a `role="status"` line says "Draft deleted.", and focus moves to the next row's name button (or the Your drafts heading if none is left). On failure "Could not delete. Try again." stays in the row.

---

## 4. `/app/runs`

### 4.1 Layout

```
DESKTOP / TABLET (>= 768)                          PHONE (stacked)
Runs                                               Runs
+-----------------------+----------------------+   Your runs
| Your runs             | [Sample] This is an  |   [empty state card]
| +-------------------+ |  example run. Nothing|   Example
| | Nothing has run   | |  here happened.      |   [Chase overdue ... Sample]
| | yet.              | | Chase overdue        |
| | Hushwork does not | |  invoices            |   [Sample banner]
| | run workflows yet.| | 3 steps done, 1      |   Chase overdue invoices
| | [Preview a plan]  | |  waiting for approval|   Steps ...
| +-------------------+ | Steps                |   Needs your approval
| Example               |  v Trigger      0.1s |   [approval card]
| > Chase overdue       |  v Check Stripe 0.8s |   Pause
|   invoices  [Sample]  |  v Draft        2.1s |   [pause row]
|                       |  . Approval Waiting  |
|                       | Needs your approval  |
|                       |  [approval card]     |
|                       | Pause                |
|                       |  [pause row]         |
+-----------------------+----------------------+
 list 280px, border-r        detail fills the rest
```

Panes: from 768px side by side (list `md:w-72`, detail `flex-1`); below that stacked, list first. Two `h2` groups in the list pane, both always visible.

### 4.2 Content

**"Your runs" (honest empty state):** `ClockCounterClockwise` icon in a `bg-raised` tile, "Nothing has run yet." (`font-semibold`), "Hushwork does not run workflows yet. When it does, each run will be listed here with every step it took." and a secondary `Btn` "Preview a plan" (link to `/app`).

**"Example" group:** one list item that is selected (`aria-current="true"`, `bg-raised`, 2px accent-text bar) and not a button (it would be a control that does nothing). Title "Chase overdue invoices", chip `Sample`, line "3 steps done, 1 waiting".

**Detail pane (the Sample run), every part labelled:**

- Top banner (`rounded-xl border border-field bg-raised p-3`): chip `Sample`, "This is an example run. Nothing here happened."
- `h2` "Chase overdue invoices", line "3 steps done. 1 step waiting for your approval."
- `h3` "Steps": a `<ol>` of `StepRow`. Right slot as in the landing run log (Check icon plus mono duration):

| Icon | Title | Sub | Right |
|---|---|---|---|
| Zap | Trigger | Invoice 14 days overdue | check, 0.1s |
| CreditCard | Check Stripe | No payment found | check, 0.8s |
| PenLine | Draft reminder | Polite, firm, your tone | check, 2.1s |
| ShieldCheck | Approval | Waiting for you | text "Waiting" |

- `h3` "Needs your approval": the landing `ApprovalSample`, headed "Sample approval". Body "Client A, Client B and Client C are overdue by 3 to 14 days." Approved text "Approved. In a real run these would send at 9:00. Nothing was sent." Skipped text "Skipped. Nothing was sent." Approve, Skip and Undo work locally.
- `h3` "Pause": the landing `PauseSample`, named "Invoice chaser (sample)", text "Sample switch. It only changes this page." in both positions.
- No new animation. The log is static (calm screen).

**Deliberately not shown:** any count ("0 runs this week"), success rate, time saved, charts, filters, search, status tabs, a "Run now" or "Retry" button, schedules, connected-tool status, notification bell, past-run history, real-looking names, amounts or dates, avatars, activity feed. Nothing may look like data that exists.

---

## 5. Component inventory

**Reused unchanged:** `Btn` (all variants, `loading`, `href`), `StepRow`, `Icon`, `useTheme`, `usePrefersReducedMotion`, `MotionProvider` and `useMotionPause`, the `SculptureHero` file, `Waitlist` field and error patterns (as the model, not imported), `app/layout.js`, `Nav.js`, `Hero.js`, `Automations.js`, `HowItWorks.js`, `Footer.js`.

**Small changes**

| File | Change |
|---|---|
| `components/ui.js` | `Logo` takes an optional `href` (default `"#top"`). Add `PauseButton` (the markup now inside `WorkflowBand`) |
| `components/WorkflowBand.js` | Use `PauseButton` (same markup, no visible change) |
| `components/icons.js` | Add the 7 icons listed in section 0 |
| `components/AgentBox.js` | `variant="app"` (section 3.2), `onSave`, `seed`, planner order and new branches (3.6) |
| `components/Features.js` | Export `ApprovalSample` and `PauseSample`; optional props for heading, body, approved text, skipped text, switch name and caption. Defaults equal today's text so the landing page does not change |
| `app/globals.css` | The block in 2.4 |

**New**

| Component | Used by |
|---|---|
| `LoginPanel` (sculpture wrapper, Logo, credit row, Pause) and `LoginForm` | `/login` |
| `ThemeToggle` (icon, or icon plus text) | login, app shell. `Nav.js` keeps its own |
| `useMediaQuery` hook | `LoginPanel` |
| `AppShell` (sidebar, top bar, menu, sign out) | `/app`, `/app/runs` |
| `StartCards`, `RecipeTiles` | `/app` |
| `DraftList` (row, rename, delete confirm) | `/app` |
| `RunsView` (list, detail) | `/app/runs` |

---

## 6. Motion plan

| Page | Focal moment | Supporting feedback | Reduced motion | Paused |
|---|---|---|---|---|
| `/login` | The sculpture answering the cursor (started by the person, not on its own) | Panel fades in 400ms. Button hover lift 200ms and press scale (`Btn`). Spinner while submitting. Error message fades in 200ms. Heading crossfade 150ms on mode switch | Still image, no Pause button, spinner kept, movement removed by `MotionConfig` | Sculpture remounted at rest, `interactive` off, hint and its dot gone |
| `/app` | The plan building one step at a time (existing `AgentBox`: 700ms "reading", 650ms per step) | Card and tile hover lift 200ms. Save status swap 150ms. New draft row fades in 200ms. Delete collapse 200ms. Menu 200ms | Fades kept, sliding and scaling removed (`MotionConfig`), spinners kept | Nothing runs on its own here, so no Pause control on this page |
| `/app/runs` | None (calm, scannable) | Approval and switch springs from the landing samples, only when clicked | Same | No autonomous motion, so no Pause control |

Nothing loops except spinners and the hint dot, which stops on first mouse move, on Pause and on reduced motion.

---

## 7. Accessibility checklist

**All pages**
- [ ] Skip link first; one `<main id="main">`; one visible h1; headings in order.
- [ ] Every control is a real `<button>`, `<a>`, input or radio; reachable by keyboard; visible 2px focus outline (global rule, not hidden).
- [ ] Page title set; `lang="en"` already on `<html>`.
- [ ] Route change: focus goes to the new page's h1 (`tabIndex={-1}`) after sign-in; after sign-out the skip link is first on `/login`.
- [ ] Targets 44px on phones. No horizontal scroll at 320px.
- [ ] Both themes: text 4.5:1, icons and field borders 3:1.

**`/login`**
- [ ] One effective h1 ("Welcome back" or "Create your account"). The component's h1 is inside an `aria-hidden` wrapper that contains nothing focusable.
- [ ] Visible `<label>` on both fields; password toggle has a name and `aria-pressed`; radios in a fieldset with a legend.
- [ ] Errors: `aria-invalid`, `aria-describedby`, message text not colour only; form error has `role="alert"`; focus rule from 2.5.
- [ ] `autoComplete` values set (email, current-password or new-password) so password managers work.
- [ ] Tab order: skip, Logo, theme toggle, mode radios, email, password, show password, submit, credit, Pause.
- [ ] Pause works from the keyboard; state survives reload.

**`/app`**
- [ ] Composer label exists (visually hidden), arrow button named "Preview plan", plan region `aria-live="polite"` (kept), save result is `role="status"` or `role="alert"`.
- [ ] Cards and tiles: accessible name is the title plus body; they do not run anything.
- [ ] Drafts: icon buttons carry the draft name in their label; rename input has a label; delete confirm moves focus to "Keep draft" and Escape cancels; delete result announced.
- [ ] Sidebar: `<nav aria-label="Workspace">`, `aria-current="page"`.

**`/app/runs`**
- [ ] Every sample element carries the word "Sample" in text. The list item is not a button.
- [ ] Switch is `role="switch"` with a label (existing `PauseSample`).

**Contrast pairs to verify in the browser** (ratios computed from the tokens, light / dark)

| Pair | Light | Dark |
|---|---|---|
| ink on bg / surface | 16.71 / 17.96 | 17.76 / 16.64 |
| ink on raised (active nav, panel headline) | 15.43 | 14.96 |
| mute on bg / surface / raised | 5.88 / 6.32 / 5.43 | 9.81 / 9.19 / 8.26 |
| hint (placeholder) on surface | 5.18 | 7.58 |
| accent-text on bg / raised (links, icons) | 6.61 / 6.11 | 10.67 / 8.98 |
| white on accent (primary button, selected segment) | 5.70 | 5.70 |
| field border on surface / on bg | 3.54 / 3.30 | 3.33 / 3.55 |
| accent fill on surface (selected segment vs its container) | 5.70 | 3.24 |
| Avoid: field border on raised, accent on raised | 3.05, 4.90 | 2.99, 2.91 (fail) |

Still to measure live: the panel hint and credit on the panel, the headline over the lightest and darkest parts of the sculpture, and the Sample chip and DRAFT chip (`mute` or `ink` on `raised`).

---

## 8. Open questions and decisions

**Blocking questions: none.**

Decisions made where the spec was silent (cheap to change):
1. **Cards versus recipes.** The three cards are sentence starters by trigger, not job examples, so they do not repeat the recipes.
2. **"Open" on a draft.** Added, otherwise saved drafts could not be viewed. Updating an existing draft is out of scope.
3. **No error colour.** Icon, text and a stronger border instead. A tested `--danger` pair can be added later if the owner wants red.
4. **Pause on `/login`** is a remount, not a prop change (the component keeps its flow state otherwise).
5. **Panel colours:** dark uses `--bg`, light uses `--raised`, chosen from the simulation above.
6. **Privacy page** (`app/privacy/page.js`) is written for waitlist emails only. Before real accounts are used it needs a sentence on sign-in emails and saved drafts. The link in the create-account note points there.
7. **Confirm-email setting** in Supabase is the owner's switch. The design covers both (redirect when off, "Check your email" screen when on).
