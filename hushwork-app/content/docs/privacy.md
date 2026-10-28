# Privacy and what the AI sees

Hushwork keeps your account in Supabase, uses Groq for the AI and Composio for some app sign-ins. This page says what goes where.

> **Note:** This page is a plain-words summary. The full, dated Privacy page at `/privacy` is the one to rely on.

## Who holds what

- **Supabase** runs the database and the sign-in. Your account and drafts live there, in the Mumbai, India region. It holds your email, a one-way scrambled version of your password (never the password itself), your drafts, workflows, runs, schedules, Memory facts and the connections you made with Linear and Google (scrambled, encrypted).
- **Groq** runs the AI. It gets the text the AI needs to do a job (see below).
- **Composio** keeps the sign-in for the apps you connect through it. Hushwork never sees that permission and identifies you to Composio only by a random account id, never your email.

Other accounts cannot read your rows. The database itself enforces this. The people who run Hushwork can technically see the database. Your email is not sold or shared with advertisers, and the site has no analytics or advertising trackers.

## What text reaches the AI

Only when the AI is switched on and a job needs it:

- **AI plans.** When you press the arrow to write a plan with AI, only the task text you typed is sent to Groq. Your email address, name, account id and other drafts are not sent. If the AI is off, or you turn **Write with AI** off, a simple keyword match in your browser makes the plan and no AI service sees your text.
- **Ask the AI steps.** Your step's request, plus anything the step is allowed to read, goes to Groq. That might be your Linear task titles, calendar event titles, Gmail senders and subjects, Drive file names, one web page, an app's answer, or the answers of earlier steps. Only the AI's answer is saved in your runs.
- **Email text.** Only if you pick **My Gmail inbox, with the text of each email**: about the first 450 characters of your 5 newest emails go to Groq. The email text itself is not kept.
- **Lookup summaries.** When a lookup step finds something and the AI is on, the result is also sent to Groq for a clear summary. Your own list is saved as well.
- **Slack.** If an Ask the AI step reads one Slack channel, its latest 10 messages go to Groq.
- **MCP servers.** The AI's questions go to the server you named, and its answers go to Groq.

Hushwork refuses to send text that looks like a card number or a secret key to the AI. Groq says it does not keep requests by default and may log them for up to 30 days to fix errors or look into abuse. It says it does not train on your text unless the customer allows it, and Hushwork does not. Do not type passwords, card numbers or other people's private details into a task.

## Memory

**Settings, then Memory** lets you save short facts such as "Timezone: India (IST)". Only facts you wrote yourself are given to the AI, as background and never as orders. They are sent to Groq with your AI requests (plans and Ask the AI steps), but not beside an MCP server. Text that looks like a secret is refused. See [Memory](/docs/memory).

## No passwords for other apps

Hushwork never asks for or stores your password for Linear, Google, Slack or any other app. You sign in on the app's own page (or Composio's page) and press Allow. Linear and Google permissions are kept scrambled. Composio apps are held by Composio.

## Download and delete

- **Download my data** (in Settings) gives you one file with your workflows, your 500 newest runs, your schedules and your Memory facts. Saved app connections are never included, because they hold sign-in permissions.
- **Delete my account** (in Settings) removes your workflows, runs, schedules and saved connections together, and disconnects the apps you connected through Composio. You type the words "delete my account" to confirm.

To remove a waitlist email, open an issue on the project's GitHub issues page.

## Related pages

- [Connections overview](/docs/connections)
- [Ask the AI and earlier answers](/docs/ai-writing)
- [Account and settings](/docs/account)
