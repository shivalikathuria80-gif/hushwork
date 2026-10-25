# Hushwork

Hushwork is a small workspace where you describe a job in plain words ("every Friday, email me what I worked on"), turn it into steps, and let it run **only after you approve each step that does something**.

- **Live:** https://hushwork-six.vercel.app
- **Open source:** MIT license (see `LICENSE`).

## What it can do

- **Start from a template pack** (Everyday, Finance, Marketing, Coding, Design): 33 ready-made workflows, many with a suggested schedule.
- **Build workflows** from blocks (start, look something up, ask the AI, call a web address, add a spreadsheet row, create a Linear task, send an email, and more), with drag and drop, templates, or an AI that writes the plan.
- **Look things up** in Google (Calendar, Gmail sender and subject lines, Drive file names), Linear, and 14 more apps through [Composio](https://composio.dev) (Vercel, Xero and Cloudflare are listed but cannot be connected yet, because Composio has no ready-made sign-in for them).
- **Do things** only after you press Approve (or switch Auto mode on on purpose): send an email through Gmail, send a Slack message, create a GitHub issue, add a Todoist task, add a Google Calendar event, create a Notion page or a Linear task, add a row to a Google Sheet.
- **Run on a schedule**: write "Every weekday at 17:30" in the Start step, press Save, and the schedule is made. Writing is allowed only if you tick the box for that schedule, and you get an email if it starts failing.
- **See what is wrong**: a **Test all my connections** button checks every connection for real, and a step that stops says why (including what the app said).
- **Keep control of your data**: Download my data (a JSON copy), Delete my account, a Terms page, and a free leaked-password check at sign-up.
- **Explain results** with an AI summary (Groq), always followed by the app's own list exactly as it answered.

## Safety rules it keeps

- Nothing is sent or changed without an Approve click (or Auto mode on purpose), once per run for each writing step, with the exact words shown first.
- Your sign-in tokens for other apps are stored encrypted. API keys live in server settings, never in the browser.
- Each person only ever sees their own workflows and runs (database row-level security).

## Run it yourself

The app is in `hushwork-app/` (Next.js 16, React 19, Tailwind 4, Supabase, Groq). See [`hushwork-app/README.md`](hushwork-app/README.md) for the commands and [`docs/deploy.md`](docs/deploy.md) for putting it online. The SQL for the database is in `supabase/`. Copy `hushwork-app/.env.example` to `hushwork-app/.env.local` and fill in your own values; never commit that file.

```bash
cd hushwork-app
npm install
npm run dev
```

Run the tests with `npm test` (447 tests, including ones that run the real server code with a pretend database and a pretend Composio) and `npm run lint`. GitHub runs both on every push.

## Project notes

- [PROJECT.md](PROJECT.md): the shared brief every AI tool reads first.
- [DECISIONS.md](DECISIONS.md): every decision and why it was made.
- [PRODUCT.md](PRODUCT.md): who Hushwork is for and the product principles.
- [PLAN.md](PLAN.md): the original build plan and UI/UX direction (2026-10-14).
- [docs/INDEX.md](docs/INDEX.md): all specs, plans, designs and QA reports, by build slice.
- [hushwork-app/README.md](hushwork-app/README.md): the Next.js app, its commands and settings.
- [hushwork-app/AGENTS.md](hushwork-app/AGENTS.md): rules for AI coding agents in the app folder.
- [hushwork/README.md](hushwork/README.md): the old no-build prototype, kept for reference.

## Contributing and security

Issues and pull requests are welcome. Please read [`SECURITY.md`](SECURITY.md) before reporting anything security related.
