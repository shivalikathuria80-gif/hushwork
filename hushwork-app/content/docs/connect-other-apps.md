# More apps through Composio

Composio lets Hushwork reach apps like Slack, Notion, GitHub, Stripe and Todoist without making a separate sign-in for each one.

## What Composio is

Composio (composio.dev) is a separate company that already holds sign-ins for hundreds of apps. When you press **Connect** on one of these apps, you sign in on Composio's page and Composio keeps the permission. Hushwork never sees it. Hushwork tells Composio who you are with a random account number, never your email. It also asks Composio to refuse every tool except the one lookup and the few actions Hushwork needs for that app. Whatever Hushwork reads or sends passes through Composio.

You can press **Disconnect** at any time. The Google apps in this group have their own page: [Google Workspace through Composio](/docs/connect-google-workspace).

## What each app can do

Every app below has one fixed lookup. Some also have one fixed action. Actions only happen when a step says so and you press Approve. None can change or delete things that already exist.

| App | Reads | Can do after you Approve |
| --- | --- | --- |
| Todoist | your open tasks | add one task |
| Notion | titles of your recent pages | create one page under a page you name |
| Slack | your channel names | send one message |
| GitHub | your notifications (review requests, mentions, issues) | create one issue |
| Stripe | your latest payments and invoices | nothing |
| Airtable | your bases | nothing |
| HubSpot | your deals | nothing |
| Jira | your projects | nothing |
| Sentry | your organizations | nothing |
| PagerDuty | your latest incidents | nothing |
| Mailchimp | your email campaigns | nothing |
| Trello | your boards | nothing |

## Not available yet

Three apps are listed but show **Not available yet** instead of a Connect button:

- **Vercel:** Composio cannot lend its sign-in for Vercel. It would need a Vercel access token set up by hand.
- **Xero:** Composio cannot lend its sign-in for Xero. It would need a Xero developer app set up by hand.
- **Cloudflare:** it only works with an API key, and Hushwork never collects keys.

## Reading Slack messages

The Slack lookup lists channel names. To read the latest messages of one channel, use an **Ask the AI** step set to **Another app** and write the channel after a colon in the address box:

```
slackmessages:general
```

Hushwork reads the latest 10 messages of that one channel and hands them to the AI. Channel names can use letters, numbers, dots, dashes and underscores. A `#` in front is fine. The step cannot read any other channel, and it cannot post, edit or delete.

To send a message, use **Do something in another app** and choose **Send a Slack message**. Write the channel in **Where**, for example `general`.

> **Note:** As of late October 2026, Slack messages and GitHub issues have been tested with pretend servers. If one does not work with your real account, press **Test all my connections** and read what the app said.

## Stripe payments and invoices

Stripe has two lookups on one sign-in:

- `stripe` reads your latest payments.
- `stripeinvoices` reads your latest invoices: paid, open and overdue.

Connecting Stripe allows both. If you connected Stripe before invoices were added, press **Disconnect** and **Connect** once more. Hushwork cannot charge, refund, create, send or pay anything in Stripe. Money actions are not offered on purpose.

## Using the apps in a workflow

- **Look in another app** (the **Another app** block): pick the app and Hushwork reads its one fixed thing after you approve.
- **Ask the AI** set to **Another app**: write the app's short name in the address box, for example `todoist`, `github`, `stripe` or `stripeinvoices`.
- **Do something in another app**: pick the action, fill in **Where**, a title and more details.

For Notion, the page also has to be shared with the connection: open the page, press the three dots, then **Connections**. A Notion page id is the long code of 32 letters and numbers at the end of the page's address.

If Composio's free allowance runs out, Hushwork says "The free allowance at Composio is used up for now. Try again later."

## Related pages

- [Connections overview](/docs/connections)
- [Ask the AI and earlier answers](/docs/ai-writing)
- [Step types](/docs/step-types)
