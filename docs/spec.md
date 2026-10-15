# Spec: the real Hushwork app, first slice

Draft for the owner's checkpoint, 2026-10-15. Local only (http://localhost:3100), not deployed, port 3000 never used. Saved here, not in Notion.

**Goal:** bring the five screenshot patterns into the signed-in app (not the landing page `/`, which stays as it is), with the liquid sculpture on the sign-in page, and keep every label true to what really works.

## 1. What "the real app" means for this slice

Three new pages in the same Next.js project, built in this order:

| # | Page | Based on | What it is |
|---|---|---|---|
| 1 | `/login` | 4 (split screen, form on the right) and 3 (calm headline, one clear form) | Sign in or create an account with email and password. The sculpture fills the left panel on desktop. |
| 2 | `/app` | 2 (composer plus suggestion cards) and 5 (tile grid) | Workspace inside an app shell (sidebar: New workflow, Runs; theme toggle; sign out). Empty state: small violet mark, "What should Hushwork take off your plate?", the existing agent box, 3 suggestion cards, 5 recipe tiles (2 large, 3 small, one per job the site already lists: invoices, client report, inbox, lead follow-up, admin), then "Your drafts". |
| 3 | `/app/runs` | 1 (list left, detail right, sidebar) | Runs viewer. Honest empty state ("Nothing has run yet") plus one run labelled "Sample". On phones the two panes stack. |

**Must:** login and sign out, pages that need a login, composer with a labelled preview plan, save draft, runs empty state, sculpture with its fallbacks. **Nice:** sample run, recipe tiles, rename or delete a draft.

**Take layouts only.** Leave out: Google/GitHub/Apple buttons (not real), the Search / Deep research / Reason chips, mic and Upload Files (they would do nothing), glass blur, stock 3D art. Do not copy any text: screenshot 5's sample copy is about harvesting social security numbers and dodging privacy law, and screenshot 1 has invented inbox counts.

**Where the sculpture fits: the left panel of `/login`, desktop only.** Reasons: it is the one moment a person arrives with nothing to scan or decide; it takes the slot screenshot 4 gives to an animated visual; and it is isolated, so if WebGL (the browser's graphics engine) is missing, a still image shows and the product is untouched. **It does not belong** in the workspace, the runs viewer or beside any "Approve" button (app screens must be calm and scannable, and moving particles next to a consequential action cut against "quiet by design"), nor on phones. The component is a 100svh section with its own nav and brand, so it must be used in contained mode: fill the panel, no component nav, Hushwork's own headline ("Quiet work, done.").

## 2. User flow

1. Owner opens `/login`: sculpture on the left, "Welcome back" form on the right. Moving the mouse makes the particles flow; they settle back.
2. Creates an account or signs in. A wrong password gives a plain error. Success goes to `/app`.
3. `/app` shows the empty state: composer, suggestion cards, recipe tiles.
4. Types a task or clicks a tile, then the arrow. A plan appears as readable steps, headed "Preview plan. Nothing will run."
5. Clicks "Save as draft". It is stored in the owner's account and appears under "Your drafts" (saving, saved and error states shown).
6. Opens Runs: "Nothing has run yet. Hushwork does not run workflows yet." Can open the labelled sample run to see the layout.
7. Switches light and dark, signs out, lands on `/login`. Opening `/app` while signed out also lands on `/login`.

## 3. Honest status

| Feature | Today | After this slice | Cost and risk |
|---|---|---|---|
| Sculpture on `/login` | Not in the app | REAL (looks only, no data) | Component file and images, see section 7. |
| Sign in, sign up, sign out via Supabase Auth (Supabase checks the email and password and gives the browser a session; we store no passwords) | Not real (`Login.jsx` accepts anything) | **REAL, build first** | Small. Adds `@supabase/supabase-js` and `@supabase/ssr` (not installed). Owner sets the Auth site URL to `http://localhost:3100` in the Supabase dashboard and picks the "confirm email" setting. Built-in emails have a low hourly limit, so keep confirmation off while testing. |
| Pages need a login (`/app` redirects) | None | REAL | Same work. Next 16 changed conventions; read `node_modules/next/dist/docs/` first (see `hushwork-app/AGENTS.md`). |
| Google / GitHub sign-in | Not real | LATER, button not shown | Owner must create an OAuth client in Google Cloud. A dead button breaks "say only what is true". |
| Saved drafts (new table `workflows`) | Not real | **REAL, build second** | Small. One table with Row Level Security (a rule that each user sees only their own rows). Risk: a wrong rule leaks drafts, so test with a second account. A draft never runs and the page says so. |
| Plan from the composer (keyword matching in `AgentBox.js`) | SIMULATED | SIMULATED, labelled | Free. The real version needs `ANTHROPIC_API_KEY` (a secret the owner supplies, server only, billed per use) and a server route (code that runs on the server) limited to a fixed list of steps. Medium. Do after login and drafts, only if wanted. |
| Suggestion cards, recipe tiles | n/a | REAL (static; click fills the composer) | None. |
| Runs list | Nothing runs | SIMULATED: empty state plus one "Sample" run | Small UI. A real list needs a runner. |
| Approval step, pause switch | Landing-page samples | SIMULATED, only inside the sample run | Real versions need the runner. |
| Stripe (read-only) and Gmail (drafts) | Not real | LATER | Stripe key is a secret to store encrypted. Gmail needs Google's app review; requirements not checked, could take weeks. |
| Scheduled runner, run history, billing, teams | None | LATER | This is the actual product (PLAN Phase 3). |

**Make real first:** sign-in, then drafts. Everything else that implies "runs" stays labelled or later. **Data stored:** Supabase manages users; one new table `workflows` (id, user_id, name, prompt, plan as JSON, created_at). No `runs` table yet.

## 4. Out of scope

Real AI planner (unless the owner picks it), Stripe, Gmail, runner and schedules, real runs, approvals or pause, Google/GitHub login, "Forgot password" and password-reset emails, settings, billing, teams, file upload, mic, stock imagery, converting the rest of the app to TypeScript, deploying anything.

## 5. Acceptance criteria

Start the site with `npm run dev` inside `hushwork-app` (it serves the app on port 3100).

1. Open `/login` in dark and light. The sculpture shows, every word is readable, and the contrast checker used in Phase 2 reports 0 failures.
2. Move the mouse over the sculpture: the material flows, then settles back within a few seconds.
3. Turn on Windows Settings > Accessibility > Visual effects > turn off Animation effects, reload: a still image, no moving particles, form still works.
4. Press "Pause motion": the sculpture freezes. Reload: it is still paused (same saved setting as the landing page).
5. Turn off the browser's graphics acceleration (Chrome Settings > System) and reload: a still image, no blank box, no error.
6. Wrong password shows a plain error; the right one reaches `/app`. A private window opening `/app` is sent to `/login`.
7. Type a task, press the arrow: the plan says "Preview plan". Save as draft, refresh: the draft is still listed. A second test account cannot see it.
8. `/app/runs` says nothing has run; the sample run is labelled "Sample"; no name or number looks real.
9. Keyboard only (Tab, Enter): every control on `/login`, `/app` and `/app/runs` is reachable with a visible focus ring.
10. `npm run lint` and `npm run build` pass, `/` still works (the waitlist still saves an email), and `/login` at phone width has no sideways scroll.

## 6. Open decisions for the owner

1. **How real should this slice be?** Default: real sign-in and real saved drafts, plan stays a labelled preview. Alternatives: everything labelled preview with no Supabase work; or also a real AI planner now (you supply an Anthropic API key, it costs money per use, and plans still cannot run).
2. **Where does the sculpture live?** Default: left panel of `/login`, desktop only, still image on phones. Alternative: a full-screen welcome shown once after first sign-in.
3. **Which sculpture image?** Default: you have none, so we use the component's images as local placeholders only after reading their licence, host a copy ourselves, and swap in an image we own (tinted violet) before calling it done. Tell us if you already own or license one.
4. **Does the runs page ship now?** Default: yes, empty state plus one labelled sample, because it is where the trust promises (log, approval, pause) will live. Alternative: skip it and ship login plus workspace only.

## 7. Risks

- **WebGL cost.** About 100,000 particles are redrawn every frame. Fine on a laptop GPU; a low-end phone can slow down, heat up and drain the battery. Mitigation: live version only at desktop width and without reduce-motion, still image elsewhere; stop drawing when offscreen, in a hidden tab or paused; load it after the form so sign-in is usable first; measure frame rate and cut the particle count if it falls below about 50 fps; check phone Lighthouse stays near the landing page's 80.
- **Image hosting and licence.** The default images are hotlinked from `cdn.21st.dev` (loaded from someone else's server): they can change or vanish, it breaks our self-hosting habit (fonts are local), and WebGL can only read a cross-origin image if that host allows it, so the sculpture could render blank. Verify: the licence on the component's own 21st.dev page (PLAN confirmed only four component licences); who made each image and whether its licence allows reuse (a code licence does not cover pictures); then record source and licence in a note beside the files in `hushwork-app/public/`. Not yet checked: the component file is not in the repo.
- **Quiet brand.** A spectacle on a "quiet by design" product. Contain it to one page, keep Pause and the still-image paths, replace the component's default headline, CTAs and nav, and test headline contrast against the lightest and darkest parts of the image.
- **Scope creep.** The five screenshots come from five different products. Stop at three pages; any control that does not work is cut, and sample data is labelled. The PLAN gate (prove demand first) is skipped by owner choice, so keep the slice small and Invoice-Chaser-shaped.
- **Small technical snags.** The component is `.tsx` but the app is JavaScript. TypeScript packages already show as uncommitted edits in `hushwork-app/package.json` (not made by this spec), but there is no `tsconfig.json` yet, so Next will create one (accept for this one file). If the component imports something like `three`, that is a new package to approve. Supabase's built-in email limit can block testing sign-up.
