# Try everything Hushwork can do (in plain words)

Hushwork is online at https://hushwork-six.vercel.app (and runs on your computer at `http://localhost:3100` with `npm run dev` inside `hushwork-app`). **Nothing real happens until you press an Approve button**, or you switch Auto mode on, or you tick "Let it write by itself" on a schedule.

## 1. Connect your apps (once)

Open **Connections**.

1. **Google:** press **Connect Google** and press **Allow** on every permission (Calendar, Sheets, Gmail, Drive). Google must have the Calendar, Sheets, Gmail and Drive APIs enabled in your Google Cloud project, and the live address registered as a redirect address (`docs/deploy.md` section 3).
2. **Linear:** press **Connect Linear** (it now also asks to add a task).
3. **More apps (through Composio):** press **Connect** on each app you use. For sending email use **Gmail (send)**; for calendar events **Google Calendar (events)**. Vercel, Xero and Cloudflare say "Not available yet" on purpose.
4. Press **Test all my connections** at the top. Every line should be green. A red line says what the app answered; fix that first.

## 2. Easy things to try (they only read, or only email you)

Open **Templates**, pick a pack (Everyday, Finance, Marketing, Coding, Design), press **Open in the Builder** on a template, then **Save**. Go to **Workflows** and press **Run**. Open **Runs** and press **Approve** on each step. Start with an email to yourself:

| Template | What it does |
| --- | --- |
| Send a formal hello email | emails you a short hello (change `{myEmail}` in the step to greet someone else) |
| Email me my week ahead | the AI reads your calendar, then emails you a summary |
| Morning briefing by email | three AI summaries (calendar, inbox, top task) in one email |
| Which task should I do first? | the AI reads your Linear tasks |
| What is in my inbox? | the AI reads who wrote to you and the subjects (never the text) |
| Test all my connections | reads Calendar, Gmail, Drive and Linear, calls one web address, then creates ONE Linear task (delete it after) |

Every template says what it needs ("Works with Google, Gmail (send)").

## 3. Things that write (read the card before you approve)

- **Do something in another app** really sends an email, sends a Slack message, creates a GitHub issue, adds a Todoist task, adds a Calendar event or creates a Notion page. The approval card shows the exact words and where they go. It can be approved **once** per run.
- **Add a row** puts one line into a Google Sheet you name. **Create Linear task** adds one task.
- `{myEmail}` means your own address. `{answer}` is what the last **Ask the AI** step said. `{answers}` (emails only) is every AI step's answer, in order.
- **Notion:** put the id of the page it should go under (the long code at the end of the page's address) in the step, and share that page with the connection (three dots on the page, then Connections). A template's example id (all zeros) is refused until you change it. The same goes for `your-name/your-repo` in the GitHub template and the example dates in the calendar templates.

## 4. Make something run by itself

1. In the Builder set the **Start** step to "On a schedule" and write the time the way you would say it: `Every weekday at 17:30`, `Every Monday at 9`, `Daily at 5pm`. Press **Save**: the message tells you the schedule was made.
2. On **Workflows**, the Schedule panel shows it. A new schedule only reads. Tick **Let it write by itself** only if it should send or create things while you are away.
3. If a schedule starts failing you get one email (needs Gmail (send) connected). The Runs page shows where it stopped and why.
4. On your own computer, `npm run clock` in a second terminal makes a clock for testing. Online, the clock is inside Supabase (`docs/deploy.md` section 15).

## 5. Ask the AI to build it

On the home screen of the app describe a job ("send a message to my account every morning"). The plan uses real steps: an email like that really goes to your own address after Approve. A step marked **Plan only** never does anything; swap it for **Do something in another app**.

## 6. Continue a run that stopped, and Memory

- When a run stops at a step, press **Continue from where it stopped** on the Runs page. Steps already done are skipped, so nothing is sent twice. If a step says **Not sure if this happened**, look in the app first (is the email there?), then press **It was not done, try again** only if it was not.
- **Settings > Memory** keeps short facts (your timezone, who gets the reports) that the AI may use as background. Do not save passwords or keys. (One setup step: paste `supabase/memory.sql` in Supabase.)

## 7. Skills: turn on a ready-made bundle

Open **Skills**. Each bundle (Finance and operations, Marketing and growth, Dev and admin) lists the apps it needs, exactly what each skill can read and write, and its ready-made workflows. Press **Turn on**: the workflows are saved to **Workflows** (nothing runs, nothing connects, no schedule is made). Open one in the Builder to change it, or press **Run**. Writing steps still wait for your **Approve** click. One setup step: paste `supabase/skills.sql` in Supabase.

## 8. The Builder explains every step

In the **Builder** each step has a card: **Why** it is there and **Evidence** (Planned until it has run; on the Runs page it says Verified, Failed or Not sure for real). Press "How it runs and what if it fails" for more. If a step needs an app you have not connected, the card says so right there: press **Connect** (a new tab), then **I connected it: check again**, or let the AI just think, or remove the step. The **Skills** list on the left adds a ready-made step; one that writes brings an "Ask me first" step with it.

## 9. New in the AI steps

- At the top of a run a **summary line** says what was done and what could not run.
- A **Notion page** step writes the text onto the page. **Stripe invoices** are readable (disconnect and connect Stripe once if it was connected before).
- **Ask the AI** can read the text of your 5 newest emails: pick *My Gmail inbox, with the text of each email*. The text goes to the AI (Groq).
- **Slack:** write `slackmessages:channelname` in an Ask the AI step set to Another app.
- **Email several people** (Builder, left side): one email step for each address you type.
- **Watch mode:** turn on the *Watch for me* bundle on the Skills page, or set a Start step to *Keep watching*. It checks on a schedule, stays quiet unless something is new, never emails you at night, at most 3 times a day, and never does anything without your Approve.
- **Google files and a Gmail draft:** on Connections press Connect for Google Sheets (create), Docs (create), Slides (create) and Drive (folders), then turn on the bundle *Google Docs, Sheets and Slides*. After you approve, a new Sheet, Slides deck or Doc appears in your Drive, with its link on the Runs page. *Save an email as a Gmail draft* only saves a draft; nothing is sent.

## 10. If something goes wrong

- A red message under an Approve button says what happened and, when an app refused, what the app said. "Not allowed" for Notion almost always means the page is not shared with the connection.
- "Google refused" or "Linear refused": press Disconnect, then Connect again.
- Delete any run you do not want with **Delete this run** (it only removes the record).
- **Settings** has **Download my data** (a copy of your workflows, runs and schedules) and **Delete my account**.
- More: `docs/deploy.md` section 16.

Related: [Deploy checklist](deploy.md), [Hushwork app README](../hushwork-app/README.md), [Project brief](../PROJECT.md)
