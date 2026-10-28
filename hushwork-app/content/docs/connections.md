# Connections overview

A connection lets Hushwork look at one of your apps, or add one thing to it, but only after you press Approve.

## What a connection is

A connection is a permission you give Hushwork on another app's own page. You press **Connect**, sign in on that app's page, and press **Allow**. You never type your password for that app into Hushwork. Every connection lives on the **Connections** page, and every one has a **Disconnect** button.

Hushwork can only read one fixed thing from each app (for example "your open tasks"). Some apps also have one fixed action, like "add one task". The action only happens when a step says so and you press Approve. Hushwork cannot change or delete anything that already exists in your apps.

## Two ways to connect

**Own sign-in.** Hushwork asks the app for permission directly. Two apps work this way: Linear and Google (Calendar, Sheets, Gmail and Drive). Hushwork keeps the permission it gets, scrambled (encrypted), until you press Disconnect.

**Through Composio.** Composio is a separate company that already holds sign-ins for many apps, so Hushwork does not need to make an app on each website. When you press Connect, you sign in on Composio's page and Composio keeps the permission. Hushwork never sees it and tells Composio who you are only with a random account number, never your email. Hushwork also asks Composio to refuse every tool except the ones Hushwork needs. More in [More apps through Composio](/docs/connect-other-apps).

## Test all my connections

At the top of the Connections page, press **Test now**. Hushwork does a real but harmless look at everything you connected: a few calendar events, a few email headers, a few file names, your Linear tasks, and each app's one lookup. For actions it only checks that the app's inputs match what Hushwork would send. Nothing is sent, written or changed.

Each line shows green (works), red (with what the app said) or "not connected". You can run it up to 4 times every 5 minutes. After that, wait a few minutes.

## Disconnect

Press **Disconnect** beside an app, then **Yes, disconnect**. Hushwork deletes its saved permission and, for apps with their own sign-in, asks the app to cancel it. To use the app again, press Connect again.

If new abilities are added to an app after you connected it, Hushwork may need a new permission. Press Disconnect and Connect once more.

## Every app you can connect

| App | What Hushwork reads | What it can add after you Approve |
| --- | --- | --- |
| Linear | your open tasks (up to 10) | one new task |
| Google | next 7 days of calendar events, Gmail sender, subject and time, names of 10 recent Drive files | one row at the bottom of a Google Sheet you name |
| Gmail (send) | names of your Gmail labels | send one email, or save one draft |
| Google Calendar (events) | names of your calendars | one event |
| Google Tasks | your tasks | nothing |
| Google Sheets (create) | names of your spreadsheets | one new spreadsheet with rows |
| Google Docs (create) | names of your documents | one new document |
| Google Slides (create) | nothing | one new presentation |
| Google Drive (folders) | basic Drive details | one new folder |
| Todoist | your open tasks | one task |
| Notion | titles of your recent pages | one page under a page you name |
| Slack | channel names, or the latest messages of one channel you name | one message |
| GitHub | your notifications | one issue |
| Stripe | latest payments and invoices | nothing |
| Airtable | your bases | nothing |
| HubSpot | your deals | nothing |
| Jira | your projects | nothing |
| Sentry | your organizations | nothing |
| PagerDuty | your incidents | nothing |
| Mailchimp | your campaigns | nothing |
| Trello | your boards | nothing |
| Vercel, Cloudflare, Xero | Not available yet | nothing |

Two more things need no connection. A **Call a web address** step asks one https address for information. An **MCP server** step lets the AI use the read-only tools of one server. Both are explained in [How Hushwork keeps you in control](/docs/safety).

## Where to go next

- [Google](/docs/connect-google) and [Linear](/docs/connect-linear) have their own sign-in.
- [Google Workspace through Composio](/docs/connect-google-workspace) covers sending email and creating Google files.
- [Troubleshooting and FAQ](/docs/troubleshooting) helps when Connect does not work.
