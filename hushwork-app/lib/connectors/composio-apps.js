// THE LIST OF APPS reached through Composio (composio.dev), a service that already holds the sign-in for hundreds of apps. To add an
// app, add ONE entry here. Nothing in this file is secret and nothing else needs to change: the Connections page, the Connect
// button, the step block and the AI all read this list.
//
//   id        short lowercase name (also the ?app= in addresses and the saved choice in a step)
//   name      what people see
//   toolkit   Composio's own name for the app (see https://docs.composio.dev/toolkits/<toolkit>)
//   tool      the ONE read-only Composio tool this app is allowed to use, written exactly as Composio writes it.
//             It is the only thing Hushwork ever asks Composio to run for this app, and Hushwork also tells Composio to
//             refuse every other tool for the sign-in it creates. Choose a tool that only LISTS or READS (never create, update,
//             delete or send), and that needs no input from a person (it is always called with nothing to fill in).
//   what      what the lookup returns, in plain words ("your open tasks")
//   about     one plain sentence on the Connections page
//   unavailable  (optional) a plain sentence saying why this app cannot be connected yet. Such an app shows that sentence instead of a Connect
//             button, and the server refuses to start its sign-in. Checked against Composio's toolkit pages on 2026-10-23.
export const COMPOSIO_APPS = [
  { id: "todoist", name: "Todoist", toolkit: "todoist", tool: "TODOIST_GET_ALL_TASKS", what: "your open tasks", about: "Hushwork can read your open Todoist tasks, and add a new task when a step says so and you approve it. It cannot change or delete existing tasks." },
  { id: "gmailsend", name: "Gmail (send)", toolkit: "gmail", tool: "GMAIL_LIST_LABELS", what: "your Gmail label names", about: "Hushwork can read the names of your Gmail labels, and send one email when a step says so and you approve it. It cannot read your emails, delete or change anything." },
  { id: "gcalwrite", name: "Google Calendar (events)", toolkit: "googlecalendar", tool: "GOOGLECALENDAR_LIST_CALENDARS", what: "the names of your calendars", about: "Hushwork can list the names of your calendars, and add one event when a step says so and you approve it. It cannot read your events, change or delete anything." },
  { id: "notion", name: "Notion", toolkit: "notion", tool: "NOTION_SEARCH_NOTION_PAGE", what: "your recent pages", about: "Hushwork can search your Notion pages and read their titles, and create one new page under a page you name when a step says so and you approve it. It cannot change or delete existing pages." },
  { id: "airtable", name: "Airtable", toolkit: "airtable", tool: "AIRTABLE_LIST_BASES", what: "your bases", about: "Hushwork can list your Airtable bases. It cannot add, change or delete anything." },
  { id: "hubspot", name: "HubSpot", toolkit: "hubspot", tool: "HUBSPOT_LIST_DEALS", what: "your deals", about: "Hushwork can read your HubSpot deals. It cannot add, change or delete anything." },
  { id: "jira", name: "Jira", toolkit: "jira", tool: "JIRA_GET_ALL_PROJECTS", what: "your projects", about: "Hushwork can list your Jira projects. It cannot add, change or delete anything." },
  // Code and shipping
  { id: "github", name: "GitHub", toolkit: "github", tool: "GITHUB_LIST_NOTIFICATIONS_FOR_THE_AUTHENTICATED_USER", what: "your latest notifications (review requests, mentions, issues)", about: "Hushwork can read your GitHub notifications, and create an issue when a step says so and you approve it. It cannot comment, merge, push or delete anything." },
  { id: "vercel", name: "Vercel", toolkit: "vercel", tool: "VERCEL_LIST_PROJECTS", what: "your projects", about: "Hushwork can list your Vercel projects. It cannot deploy, change settings or delete anything.", unavailable: "Composio cannot lend its sign-in for Vercel, so it needs a Vercel access token set up by hand. Not available yet." },
  { id: "sentry", name: "Sentry", toolkit: "sentry", tool: "SENTRY_LIST_ORGANIZATIONS", what: "your organizations", about: "Hushwork can list your Sentry organizations. It cannot change or delete anything." },
  { id: "cloudflare", name: "Cloudflare", toolkit: "cloudflare", tool: "CLOUDFLARE_LIST_ACCOUNTS", what: "your accounts", about: "Hushwork can list your Cloudflare accounts. It cannot change settings or delete anything.", unavailable: "Cloudflare only works with an API key, and Hushwork never collects keys. Not available yet." },
  { id: "pagerduty", name: "PagerDuty", toolkit: "pagerduty", tool: "PAGERDUTY_FETCH_INCIDENT_LIST", what: "your latest incidents", about: "Hushwork can read your PagerDuty incidents. It cannot acknowledge, resolve or change anything." },
  // Talking and money
  { id: "slack", name: "Slack", toolkit: "slack", tool: "SLACK_LIST_ALL_CHANNELS", what: "your channels", about: "Hushwork can list your Slack channels, and send one message when a step says so and you approve it. It cannot edit or delete messages." },
  { id: "stripe", name: "Stripe", toolkit: "stripe", tool: "STRIPE_LIST_CHARGES", what: "your latest payments", about: "Hushwork can read your latest Stripe payments. It cannot charge, refund or change anything." },
  { id: "xero", name: "Xero", toolkit: "xero", tool: "XERO_GET_CONTACTS", what: "your contacts", about: "Hushwork can read your Xero contacts. It cannot create invoices or change anything.", unavailable: "Composio cannot lend its sign-in for Xero, so it needs a Xero developer app set up by hand. Not available yet." },
  { id: "mailchimp", name: "Mailchimp", toolkit: "mailchimp", tool: "MAILCHIMP_LIST_CAMPAIGNS", what: "your email campaigns", about: "Hushwork can list your Mailchimp campaigns. It cannot send or change anything." },
  // Personal
  { id: "googletasks", name: "Google Tasks", toolkit: "googletasks", tool: "GOOGLETASKS_LIST_ALL_TASKS", what: "your tasks", about: "Hushwork can read your Google Tasks. It cannot add, change or delete anything." },
  { id: "trello", name: "Trello", toolkit: "trello", tool: "TRELLO_GET_MEMBERS_ME_BOARDS", what: "your boards", about: "Hushwork can list your Trello boards. It cannot add, move or delete cards." },
];

// Finds one app by its id, or null. Only a real id from the list works ("__proto__" or a made-up name is just "not found").
export const findComposioApp = (id) => (typeof id === "string" ? COMPOSIO_APPS.find((app) => app.id === id) ?? null : null);
export const COMPOSIO_IDS = COMPOSIO_APPS.map((app) => app.id);
