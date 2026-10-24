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

These promises are built in the app: each step that does something waits for an Approve click (or Auto mode, which the person switches on, or a schedule with writing ticked), every run keeps a step-by-step record on the Runs page, and a schedule can be paused. The example workflows on the landing page are samples and are labelled as such.

## Operating Context

Tools the page names: Gmail, Stripe, Calendar, Slack, Sheets, Linear.

Jobs the page leads with: invoice chasing, weekly client report, inbox triage, lead follow-up, and admin such as receipts, contracts and calendars.

## Capabilities and Constraints

- **Status: live in early access and open source** (https://hushwork-six.vercel.app, MIT license). There are no customers, testimonials or usage numbers, so the page must not claim any, or a private beta with active users. Workflows really run, but only after Approve, Auto mode, or a schedule with writing switched on.
- The agent box on the page is a simulation (keyword matching in `hushwork/AgentBox.jsx`), clearly labelled as a preview. The landing box uses no AI model. The app's Preview plan uses an AI model (run by Groq) only when a key is set and the person leaves "Write with AI" on; otherwise it is keyword matching too. A plan it writes only runs after the person approves each step that does something.
- Login, "Continue with Google" and "Save workflow" were simulated. The public site no longer shows them (`Login.jsx` is kept, not loaded, for the real product).
- **Waitlist storage: Supabase** (confirmed and live, 2026-10-14). Project `hushwork`, region ap-south-1, table `waitlist`. The public can add an email and cannot read, change or delete rows. Setup is recorded in `supabase/waitlist.sql`. Supabase is also intended as the base for login and data when the product is built.
- Current stack (confirmed, 2026-10-15): Next.js 16 (App Router), React 19, Tailwind 4, `motion`, Phosphor icons, in `hushwork-app/`. The earlier no-build prototype is kept in `hushwork/` for reference. Hosting (decided 2026-10-23): Vercel at https://hushwork-six.vercel.app, deployed from the public GitHub repository on every push to `main`. Local development runs on http://localhost:3100; port 3000 is kept free for the owner's other app.
- Undecided: whether to go through Google's app review so anyone, not only listed test users, can connect Gmail and Drive; which write actions to add next (Stripe is held back on purpose because of real money).

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

Related: [Build plan and UI/UX direction](PLAN.md), [Project brief](PROJECT.md), [Arjun AI Design System](docs/arjun-ai-design-system.md)
