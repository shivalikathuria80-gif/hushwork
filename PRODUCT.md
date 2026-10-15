# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: freelancers and solo studios who run their own client work and lose hours every week to admin: chasing invoices, writing client reports, triaging an inbox, following up leads.

Later: small agencies of roughly 2 to 10 people, where shared workflows and team approval matter. Confirmed as "both, freelancers first". Nothing about team features is decided.

## Product Purpose

Hushwork lets a person describe a recurring task in plain English. It turns that into a workflow they can read, edit and approve, connects the tools they already use, runs it on a schedule, and keeps a log of every run. Success for the user is "get your week back".

## Positioning

A plain-English builder with no nodes to wire up and no code. The workflow is shown as readable steps before anything runs. The page promises approval before anything is sent, a step-by-step log for every run, and a one-click pause.

These are promises the page makes. None of them is built yet.

## Operating Context

Tools the page names: Gmail, Stripe, Calendar, Slack, Sheets, Linear.

Jobs the page leads with: invoice chasing, weekly client report, inbox triage, lead follow-up, and admin such as receipts, contracts and calendars.

## Capabilities and Constraints

- **Status: pre-launch, waitlist only.** Nobody is using the product. No workflow runs for anyone. This is confirmed, so the page must not claim a private beta or active users.
- The agent box on the page is a simulation (keyword matching in `hushwork/AgentBox.jsx`), clearly labelled as a preview. No AI model is called.
- Login, "Continue with Google" and "Save workflow" were simulated. The public site no longer shows them (`Login.jsx` is kept, not loaded, for the real product).
- **Waitlist storage: Supabase** (confirmed and live, 2026-10-14). Project `hushwork`, region ap-south-1, table `waitlist`. The public can add an email and cannot read, change or delete rows. Setup is recorded in `supabase/waitlist.sql`. Supabase is also intended as the base for login and data when the product is built.
- Current stack (confirmed, 2026-10-15): Next.js 16 (App Router), React 19, Tailwind 4, `motion`, Phosphor icons, in `hushwork-app/`. The earlier no-build prototype is kept in `hushwork/` for reference. Hosting: none. The owner decided on 2026-10-15 to keep the site running locally and not deploy it. It runs on http://localhost:3100; port 3000 is kept free for the owner's other app.
- Undecided: the first product slice to build (the Invoice Chaser is proposed, not confirmed); the framework for Phase 2; whether Gmail access is feasible, because Google's app-review requirements have not been checked.

## Brand Commitments

Observed on the current site, not declared binding by the owner:

- Name: Hushwork.
- Voice lines: "Describe the task. Hushwork handles it." and "Quiet work, done."
- The dot-matrix "hushwork" wordmark in the footer.
- A violet accent, with dark as the default theme and a working light theme.
- Geist (with Geist Mono) as the typeface. Confirmed by the owner on 2026-10-15, so it is binding.
- Motion is welcome on the landing page (owner request, 2026-10-15), but every piece must have a reason, stop under "reduce motion", and anything that runs on its own needs a visible Pause control.

## Evidence on Hand

None. There are no customers, testimonials, usage numbers, case studies, press or logos. The sample content on the page (Maya Studio, invoice amounts, run counts, example emails) is illustrative.

Future work must not invent counts, testimonials, customer names or scarcity, and must label sample data as sample.

## Product Principles

1. **Say only what is true today.** Status claims (beta, "you're on the list", "saved") match what actually happens.
2. **Nothing consequential happens unseen.** The user sees and approves a plan before it runs, and approves messages before they are sent.
3. **Plain language over tool jargon.** The user describes outcomes; the product shows readable steps.
4. **Every action leaves a trace.** Runs are logged step by step and can be paused.
5. **Quiet by design.** The product removes work and does not ask for attention.

## Accessibility & Inclusion

No product-specific requirement has been stated. Working target for the redesign, set in `PLAN.md`: WCAG 2.2 AA, both themes, full keyboard operation, and reduced-motion honoured for CSS, JavaScript and SVG motion.
