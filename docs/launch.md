# Launch checklist for hushwork.in

> Written 2026-10-25 after asking two outside AIs (ChatGPT and Gemini, through the owner's own signed-in Chrome) what to do before launch, then checking each suggestion against what Hushwork already does. What both said that was already built is not repeated here. Some points below depend on other companies' rules (Google, Vercel, Supabase): **check their current pages before you rely on them**. This is not legal advice.

Up: [Docs index](INDEX.md) · [Deploy checklist](deploy.md)

## 1. Gates: do not invite real people until these pass

| # | Gate | How | Who |
|---|---|---|---|
| 1 | **Privacy rules hold against a real attacker** | Make two throwaway accounts on the sign-up page. In `hushwork-app` run `npm run check:privacy` with their emails and passwords set for that one command (see the top of `scripts/two-account-check.mjs`). Every line must say PASS. | You, then tell Claude about any FAIL |
| 2 | **The pause switch works** | Paste `supabase/app-controls.sql` into Supabase. Run `update public.app_controls set value = true where name = 'paused';`, press Approve on a writing step (it must refuse and say Hushwork is paused), then set it back to `false`. | You |
| 3 | **Every connection and every ready-made workflow works on your real accounts** | Connections > Test all my connections (all green). Skills > turn on each bundle, run each workflow once with an email to yourself. Write down anything that breaks. | You press Approve, Claude fixes |
| 4 | **A truthful ending for every failure** | Run one workflow, then disconnect Google or Gmail (send) in the middle: the Runs page must say where it stopped and why, "Continue from where it stopped" must not repeat a done step. | You |
| 5 | **Cost is known and capped** | Set a monthly spending cap in Groq. Check your Composio plan's monthly allowance. Press Run on the most expensive workflow you have a few times and compare the Groq and Composio dashboards with what you expected. | You |

## 2. Things only the owner can do

- **Google sign-in verification (the big one).** Hushwork's Google Connect asks for Calendar, Sheets, **Gmail read** and Drive file-name permissions. Google treats Gmail read access as a *restricted* permission: before strangers can use it without a scary "unverified app" screen (and without the small test-user limit), the app has to be verified, and Google may require a paid security assessment for restricted permissions. Until then, only people you add as test users can connect Google. Options: launch to a small pilot as test users first, or launch without the Gmail permission (Gmail *sending* goes through Composio and is separate). Read Google's current "OAuth app verification" pages before deciding. The step-by-step list is in [Google review checklist](google-review.md).
- **The domain.** In Vercel add `hushwork.in`. Then change it everywhere it is written: the site address setting (`NEXT_PUBLIC_SITE_URL`), the Google, Linear and Composio redirect addresses, Supabase (Authentication > URL configuration), the address inside `supabase/clock.sql` (run its `select cron.schedule(...)` again), and the `HUSHWORK_URL` GitHub variable. `docs/deploy.md` section 13 has the order.
- **Vercel plan.** Vercel's free (Hobby) plan is meant for personal, non-commercial projects. If you will charge money or run it as a business, check Vercel's terms and plan.
- **Backups.** Check which backups your Supabase plan includes (free projects may have none). People can use **Download my data** for their own copy, but that is not a backup of the whole database.
- **Seeing problems.** Vercel keeps runtime logs only about an hour on the free plan. For launch, add an error-monitoring service (for example Sentry: a free account, then ask Claude to wire it in, with tokens and email text removed from reports), or at least look at the Vercel logs daily for the first week.
- **Law.** The Privacy and Terms pages are plain-words drafts, not legal advice. India's DPDP Act and, for EU visitors, GDPR expect: a clear reason for every piece of data, a way to delete (Delete my account exists), a way to get a copy (Download my data exists), and a contact for complaints. Add a real contact address to both pages and have someone qualified read them before you advertise.
- **New clock password.** The old clock password was printed once in a chat session. Run `npm run secret cron`, put the new value in Vercel (`CRON_SECRET`), redeploy, and run `supabase/clock.sql` again with it.

## 3. The pilot (first two weeks)

Invite 5 to 10 freelancers or small-agency owners, as Google test users. Give them only three workflows to start: **Reply Drafts** (emails you the drafts), **Invoice Chaser** or **Weekly Money Report**, and **Client Project Triage**. Do not help them through the screens: every time you have to explain something is feedback.

| Measure | Target |
|---|---|
| People who finish setup without help | at least 4 of 5 |
| Runs that end in a truthful status | all |
| Emails sent twice | 0 |
| Anything sent without an Approve click (Manual mode) | 0 |
| People who run it again the next week | at least 3 of 5 |

## 4. What is already built (so nobody builds it twice)

Approval is checked on the server for every writing step, once per run, built again from the saved run (never from the browser), and now also refuses if the words changed after the person read them. A step that might have happened is never sent again by itself. Email recipients are only the person or addresses they typed. The AI only reads; text from emails, pages and apps reaches it wrapped as data. Limits per person live in the database. A scheduled run that stops at a writing step emails the person once. Delete my account and Download my data exist. The pause switch stops writes, AI calls and schedules without a new deploy.

## 5. Known limits to say out loud

Gmail text is read only when a step asks for it, about 450 characters of each of the 5 newest emails. Slack messages are untested against a real Slack. Stripe is read through payments and invoices lists. A person who clicks Approve without reading cannot be protected by any software: keep the approval cards short and exact (they are).
