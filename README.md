# Hushwork

Hushwork is a small workspace where you describe a job in plain words ("every Friday, email me what I worked on"), turn it into steps, and let it run **only after you approve each step that does something**.

- **Live:** https://hushwork-six.vercel.app
- **Open source:** MIT license (see `LICENSE`).

## What it can do

- **Build workflows** from blocks (start, look something up, ask the AI, call a web address, add a spreadsheet row, create a Linear task, send an email, and more), with drag and drop, templates, or an AI that writes the plan.
- **Look things up** in Google (Calendar, Gmail sender and subject lines, Drive file names), Linear, and 14 more apps through [Composio](https://composio.dev) (Vercel, Xero and Cloudflare are listed but cannot be connected yet, because Composio has no ready-made sign-in for them).
- **Do things** only after you press Approve (or switch Auto mode on on purpose): send an email through Gmail, send a Slack message, create a GitHub issue, add a Todoist task or a Linear task, add a row to a Google Sheet.
- **Run on a schedule**, with writing allowed only if you tick the box for that schedule.
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

Run the tests with `npm test`.

## Contributing and security

Issues and pull requests are welcome. Please read [`SECURITY.md`](SECURITY.md) before reporting anything security related.
