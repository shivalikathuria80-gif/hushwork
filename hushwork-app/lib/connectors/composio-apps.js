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
//   input     (optional) { label, pattern, example, rule }: this lookup needs one thing typed by the person (a channel, a Gmail search). `example` is a value
//             that works ("general"), and `rule` says in plain words what may be typed. Such a lookup is never offered to the AI plan writer and is not
//             tried by Test all my connections.
//   threadTool (optional) a second read-only tool this lookup also runs (Gmail search reads each conversation it finds, to see who wrote last). It is
//             allowed on the app's sign-in like the lookup itself.
//   lookupOf  (optional) the id of the app whose sign-in this lookup shares (a second read-only tool of the same app). It has no Connect button or box of its own.
//   noLookup  (optional) true when the app has no read-only tool that works with nothing typed (then `tool` is null): the app only holds the sign-in for its actions.
//             It is never offered as a lookup (not in "Look in another app", not to the AI plan writer, and not tried by Test all my connections).
//   watchOnly (optional) true for a tool only a watched Start step uses (lib/app-events.js): never offered as a lookup anywhere.
//   unavailable  (optional) a plain sentence saying why this app cannot be connected yet. Such an app shows that sentence instead of a Connect
//             button, and the server refuses to start its sign-in. Checked against Composio's toolkit pages on 2026-10-23.
export const COMPOSIO_APPS = [
  { id: "todoist", name: "Todoist", toolkit: "todoist", tool: "TODOIST_GET_ALL_TASKS", what: "your open tasks", about: "Reads your open Todoist tasks, and adds a task when you approve it." },
  { id: "gmailsend", name: "Gmail (send)", toolkit: "gmail", tool: "GMAIL_LIST_LABELS", what: "your Gmail label names", about: "Sends an email or saves a draft when you approve it." },
  // A second read-only tool on the Google Calendar (events) sign-in, used ONLY by "When a calendar event is added" (lib/app-event-read.js): `watchOnly`
  // keeps it out of every lookup list. If Google Calendar (events) was connected before it was added, press Disconnect and Connect once more.
  { id: "gcalevents", name: "Google Calendar (new events)", toolkit: "googlecalendar", tool: "GOOGLECALENDAR_EVENTS_LIST", lookupOf: "gcalwrite", watchOnly: true, what: "your newest calendar events", about: "Notices new calendar events, so a workflow can start from one." },
  { id: "gcalwrite", name: "Google Calendar (events)", toolkit: "googlecalendar", tool: "GOOGLECALENDAR_LIST_CALENDARS", what: "the names of your calendars", about: "Adds a calendar event when you approve it." },
  { id: "notion", name: "Notion", toolkit: "notion", tool: "NOTION_SEARCH_NOTION_PAGE", what: "your recent pages", about: "Finds your Notion pages, and creates a new page when you approve it." },
  { id: "airtable", name: "Airtable", toolkit: "airtable", tool: "AIRTABLE_LIST_BASES", what: "your bases", about: "Lists your Airtable bases." },
  { id: "hubspot", name: "HubSpot", toolkit: "hubspot", tool: "HUBSPOT_LIST_DEALS", what: "your deals", about: "Reads your HubSpot deals." },
  { id: "jira", name: "Jira", toolkit: "jira", tool: "JIRA_GET_ALL_PROJECTS", what: "your projects", about: "Lists your Jira projects." },
  // Code and shipping
  { id: "github", name: "GitHub", toolkit: "github", tool: "GITHUB_LIST_NOTIFICATIONS_FOR_THE_AUTHENTICATED_USER", what: "your latest notifications (review requests, mentions, issues)", about: "Reads your GitHub notifications, and creates an issue when you approve it." },
  { id: "vercel", name: "Vercel", toolkit: "vercel", tool: "VERCEL_LIST_PROJECTS", what: "your projects", about: "Lists your Vercel projects.", unavailable: "Composio cannot lend its sign-in for Vercel, so it needs a Vercel access token set up by hand. Not available yet." },
  { id: "sentry", name: "Sentry", toolkit: "sentry", tool: "SENTRY_LIST_ORGANIZATIONS", what: "your organizations", about: "Lists your Sentry organizations." },
  { id: "cloudflare", name: "Cloudflare", toolkit: "cloudflare", tool: "CLOUDFLARE_LIST_ACCOUNTS", what: "your accounts", about: "Lists your Cloudflare accounts.", unavailable: "Cloudflare only works with an API key, and Hushwork never collects keys. Not available yet." },
  { id: "pagerduty", name: "PagerDuty", toolkit: "pagerduty", tool: "PAGERDUTY_FETCH_INCIDENT_LIST", what: "your latest incidents", about: "Reads your PagerDuty incidents." },
  // Talking and money
  { id: "slack", name: "Slack", toolkit: "slack", tool: "SLACK_LIST_ALL_CHANNELS", what: "your channels", about: "Reads your channels, and sends a message when you approve it." },
  // A lookup that needs ONE thing typed by the person (`input`): Slack messages need the channel. It is written after a colon in the step's address box, for example slackmessages:general.
  { id: "slackmessages", name: "Slack messages", toolkit: "slack", tool: "SLACK_FETCH_CONVERSATION_HISTORY", lookupOf: "slack", input: { label: "channel", pattern: /^#?[A-Za-z0-9._-]{1,80}$/, example: "general", rule: "letters, numbers, dots and dashes only", mark: "#" }, what: "the latest messages in one channel", about: "Reads the latest messages of ONE channel you name in the step." },
  { id: "stripe", name: "Stripe", toolkit: "stripe", tool: "STRIPE_LIST_CHARGES", what: "your latest payments", about: "Reads your latest Stripe payments and invoices." },
  // A second lookup on the SAME sign-in as Stripe (`lookupOf`): it has no Connect button of its own, Connecting Stripe allows both tools. If Stripe was connected before invoices were added, press Disconnect and Connect once more.
  { id: "stripeinvoices", name: "Stripe invoices", toolkit: "stripe", tool: "STRIPE_LIST_INVOICES", lookupOf: "stripe", what: "your latest invoices (paid, open and overdue)", about: "Reads your latest Stripe invoices." },
  // A Gmail SEARCH on the same sign-in as Gmail (send) (`lookupOf`). It works for everyone (it is Composio's Gmail, not "Connect Google"). The step names the search
  // after a colon, written the way Gmail's own search box takes it: gmailsearch:in:sent newer_than:14d. It finds up to 10 messages, then reads each conversation
  // (up to 8) to say whether someone answered after you, using only the sender, subject, time and labels (never the text of an email). Tool names checked against
  // composio.dev/tools/gmail on 2026-11-06. If Gmail (send) was connected before this was added, press Disconnect and Connect once more.
  { id: "gmailsearch", name: "Gmail search", toolkit: "gmail", tool: "GMAIL_FETCH_EMAILS", threadTool: "GMAIL_FETCH_MESSAGE_BY_THREAD_ID", lookupOf: "gmailsend",
    input: { label: "search", pattern: /^(?=.*\S)[^\u0000-\u001f\u007f<>\\]{1,88}$/, example: "in:sent newer_than:14d", rule: "written like Gmail's own search box, at most 88 characters", mark: "" },
    what: "the conversations a Gmail search finds, and whether each one got a reply", about: "Searches your Gmail and tells you which conversations got a reply." },
  { id: "xero", name: "Xero", toolkit: "xero", tool: "XERO_GET_CONTACTS", what: "your contacts", about: "Reads your Xero contacts.", unavailable: "Composio cannot lend its sign-in for Xero, so it needs a Xero developer app set up by hand. Not available yet." },
  { id: "mailchimp", name: "Mailchimp", toolkit: "mailchimp", tool: "MAILCHIMP_LIST_CAMPAIGNS", what: "your email campaigns", about: "Lists your Mailchimp campaigns." },
  // Personal
  { id: "googletasks", name: "Google Tasks", toolkit: "googletasks", tool: "GOOGLETASKS_LIST_ALL_TASKS", what: "your tasks", about: "Reads your Google Tasks." },
  { id: "trello", name: "Trello", toolkit: "trello", tool: "TRELLO_GET_MEMBERS_ME_BOARDS", what: "your boards", about: "Lists your Trello boards." },
  // Google files made through Composio (tool names checked against docs.composio.dev/toolkits/<toolkit>.md on 2026-10-27). Each is its own sign-in at Composio,
  // separate from "Connect Google" (which only reads). The lookup only lists names; the create action is in composio-actions.js and waits for Approve.
  { id: "gsheets", name: "Google Sheets (create)", toolkit: "googlesheets", tool: "GOOGLESHEETS_SEARCH_SPREADSHEETS", what: "the names of your spreadsheets", about: "Creates a new spreadsheet when you approve it." },
  { id: "gdocs", name: "Google Docs (create)", toolkit: "googledocs", tool: "GOOGLEDOCS_SEARCH_DOCUMENTS", what: "the names of your documents", about: "Creates a new document when you approve it." },
  // Google Slides has NO tool that lists anything without being told which presentation (checked in the toolkit's list), so it has no lookup (`noLookup`):
  // the entry exists to hold the sign-in for the create action. It cannot be a `lookupOf` another app: Composio keeps one sign-in per toolkit, and a lookupOf has no Connect button.
  { id: "gslides", name: "Google Slides (create)", toolkit: "googleslides", tool: null, noLookup: true, what: "nothing (it only creates)", about: "Creates a new presentation when you approve it." },
  { id: "gdrivewrite", name: "Google Drive (folders)", toolkit: "googledrive", tool: "GOOGLEDRIVE_GET_ABOUT", what: "your Drive details (your name and how much space is used)", about: "Creates a new Drive folder when you approve it." },
];

// The step's address box for an app lookup: "stripe", or "slackmessages:general" for a lookup that needs one typed thing. Returns { app, input } or null
// ("stripe:x" and "slackmessages" with nothing after it are refused: nothing is guessed). Channel ids keep their capital letters.
export function parseAppAddress(raw) {
  const text = typeof raw === "string" ? raw.trim() : "";
  const colon = text.indexOf(":");
  const app = findComposioApp((colon === -1 ? text : text.slice(0, colon)).toLowerCase());
  if (!app || app.noLookup || app.watchOnly) return null;
  const input = colon === -1 ? "" : text.slice(colon + 1).trim().replace(/^#/, "");
  if (!app.input) return input ? null : { app, input: "" };
  return input && app.input.pattern.test(input) ? { app, input } : null;
}

// How a lookup with a typed thing is shown: "#general" for a Slack channel, "\"in:sent newer_than:14d\"" for a Gmail search.
export const showInput = (app, input) => (!input ? "" : app?.input?.mark === "" ? `"${input}"` : `${app?.input?.mark ?? "#"}${input}`);

// Finds one app by its id, or null. Only a real id from the list works ("__proto__" or a made-up name is just "not found").
export const findComposioApp = (id) => (typeof id === "string" ? COMPOSIO_APPS.find((app) => app.id === id) ?? null : null);
export const COMPOSIO_IDS = COMPOSIO_APPS.map((app) => app.id);
