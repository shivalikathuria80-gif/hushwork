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
export const COMPOSIO_APPS = [
  { id: "todoist", name: "Todoist", toolkit: "todoist", tool: "TODOIST_GET_ALL_TASKS", what: "your open tasks", about: "Hushwork can read your open Todoist tasks. It cannot add, change or delete anything." },
  { id: "notion", name: "Notion", toolkit: "notion", tool: "NOTION_SEARCH_NOTION_PAGE", what: "your recent pages", about: "Hushwork can search your Notion pages and read their titles. It cannot add, change or delete anything." },
  { id: "airtable", name: "Airtable", toolkit: "airtable", tool: "AIRTABLE_LIST_BASES", what: "your bases", about: "Hushwork can list your Airtable bases. It cannot add, change or delete anything." },
  { id: "hubspot", name: "HubSpot", toolkit: "hubspot", tool: "HUBSPOT_LIST_DEALS", what: "your deals", about: "Hushwork can read your HubSpot deals. It cannot add, change or delete anything." },
  { id: "jira", name: "Jira", toolkit: "jira", tool: "JIRA_GET_ALL_PROJECTS", what: "your projects", about: "Hushwork can list your Jira projects. It cannot add, change or delete anything." },
];

// Finds one app by its id, or null. Only a real id from the list works ("__proto__" or a made-up name is just "not found").
export const findComposioApp = (id) => (typeof id === "string" ? COMPOSIO_APPS.find((app) => app.id === id) ?? null : null);
export const COMPOSIO_IDS = COMPOSIO_APPS.map((app) => app.id);
