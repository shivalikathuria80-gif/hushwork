// THE LIST OF THINGS A STEP MAY DO in an app reached through Composio (see composio-apps.js for the apps and their read-only lookups). Each
// entry is ONE action that WRITES somewhere (send a message, create an issue, add a task). To add one, add an entry here: nothing else in
// the sign-in, the step, the approval or the run changes.
//
// Everything about writing is held tight:
//   - only these entries can ever be run: a step names an `id` from this list, never a tool name, and the tool is always the one written here;
//   - it is approved by a person (or by Auto mode on purpose), once per run, and what is sent is shown in full before it is approved;
//   - the words are checked here (`checkTarget`) and put into the tool's inputs by `buildArguments`, which only fills inputs the tool really
//     has (Hushwork asks Composio for the tool's list of inputs first) and refuses if the tool needs something we do not fill in.
//
//   id           short lowercase name (also the saved choice in a step)
//   app          the id of the app in composio-apps.js this belongs to (its connection is used)
//   name         what people see ("Send a Slack message")
//   tool         the ONE Composio tool, written exactly as Composio writes it
//   needsTarget  does the step need a "where" (a Slack channel, a GitHub repository)?
//   target       { pattern, hint }: what a "where" may look like (anything else is refused before any request)
//   candidates   for each thing we send, the names the tool may call that input (the first one the tool really has is used)
//   meaning      turns the step's words into the things we send
//   done         how a finished action is described in the result ("Sent a Slack message")
//   labels       (optional) the words the approval card uses for the three boxes: { target, title, details }; the default is Where / Title / Details
//   noDetails    (optional) true when the tool has no place for the "details" box: it is then never shown or sent
export const COMPOSIO_ACTIONS = [
  {
    id: "slack_message", app: "slack", name: "Send a Slack message", tool: "SLACK_SEND_MESSAGE", needsTarget: true,
    target: { pattern: /^#?[A-Za-z0-9._-]{1,80}$/, hint: "Write the Slack channel, for example general (letters, numbers, dots and dashes only)." },
    candidates: { channel: ["channel", "channel_id"], message: ["markdown_text", "text"] },
    meaning: (v) => ({ channel: v.target.replace(/^#/, ""), message: v.details ? `${v.title}\n${v.details}` : v.title }),
    done: (v) => `Sent a Slack message to #${v.target.replace(/^#/, "")}`,
    labels: { title: "Message" },
  },
  {
    id: "github_issue", app: "github", name: "Create a GitHub issue", tool: "GITHUB_CREATE_AN_ISSUE", needsTarget: true,
    target: { pattern: /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}$/, hint: "Write the repository as owner/name, for example acme/website." },
    candidates: { owner: ["owner"], repo: ["repo", "repo_name"], title: ["title"], body: ["body"] },
    meaning: (v) => { const [owner, repo] = v.target.split("/"); return { owner, repo, title: v.title, body: v.details }; },
    done: (v) => `Created a GitHub issue in ${v.target}`,
  },
  {
    id: "gmail_send", app: "gmailsend", name: "Send an email (Gmail)", tool: "GMAIL_SEND_EMAIL", needsTarget: true,
    target: { pattern: /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63}){1,4}$/, hint: "Write the email address it goes to, for example name@example.com." },
    candidates: { recipient_email: ["recipient_email", "to"], subject: ["subject"], body: ["body"] },
    meaning: (v) => ({ recipient_email: v.target, subject: v.title, body: v.details || v.title }),
    done: (v) => `Sent an email to ${v.target}`,
    labels: { target: "To", title: "Subject", details: "Email text" },
  },
  {
    id: "calendar_event", app: "gcalwrite", name: "Add a Google Calendar event", tool: "GOOGLECALENDAR_CREATE_EVENT", needsTarget: true,
    target: { pattern: /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]) ([01]\d|2[0-3]):[0-5]\d$/, hint: "Write when it starts as year-month-day hour:minute, for example 2026-11-05 15:00 (24-hour clock, in your calendar's own time zone)." },
    candidates: { start_datetime: ["start_datetime", "start_time"], summary: ["summary", "title"], description: ["description"] },
    meaning: (v) => ({ start_datetime: `${v.target.replace(" ", "T")}:00`, summary: v.title, description: v.details }),
    done: (v) => `Added a calendar event at ${v.target}`,
    labels: { target: "Starts", title: "Event", details: "Notes" },
  },
  {
    id: "notion_page", app: "notion", name: "Create a Notion page", tool: "NOTION_CREATE_NOTION_PAGE", needsTarget: true, noDetails: true,
    target: { pattern: /^[0-9a-fA-F]{8}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{12}$/, hint: "Write the id of the Notion page it goes under: the long code (32 letters and numbers) at the end of that page's address." },
    candidates: { parent_id: ["parent_id"], title: ["title"] },
    meaning: (v) => ({ parent_id: v.target, title: v.title }),
    done: () => "Created a Notion page",
    labels: { target: "Under page", title: "Page title" },
  },
  {
    id: "todoist_task", app: "todoist", name: "Add a Todoist task", tool: "TODOIST_CREATE_TASK", needsTarget: false,
    target: null,
    candidates: { content: ["content"], description: ["description"] },
    meaning: (v) => ({ content: v.title, description: v.details }),
    done: () => "Added a Todoist task",
  },
];

export const labelFor = (action, box) => action?.labels?.[box] ?? { target: "Where", title: "Title", details: "Details" }[box];
export const findAction = (id) => (typeof id === "string" ? COMPOSIO_ACTIONS.find((action) => action.id === id) ?? null : null);
export const COMPOSIO_ACTION_IDS = COMPOSIO_ACTIONS.map((action) => action.id);
export const actionsForApp = (appId) => COMPOSIO_ACTIONS.filter((action) => action.app === appId);

// Is this "where" acceptable for this action? Returns { value } or { error }. An action with no "where" accepts only an empty one.
export function checkTarget(action, raw) {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!action.needsTarget) return text ? { error: "This action does not use a place. Leave that box empty." } : { value: "" };
  if (!action.target.pattern.test(text)) return { error: action.target.hint };
  return { value: text };
}

// What an action's tool takes as input, read from Composio's description of the tool. Composio describes inputs either as a JSON schema
// ({ properties, required }) or as a plain list ({ name: { required } }); both are understood. Returns { names: Set, required: Set }.
export function readToolInputs(body) {
  const given = body?.input_parameters ?? body?.inputParameters;
  const raw = given && typeof given === "object" && !Array.isArray(given) ? given : {};
  const properties = raw && typeof raw.properties === "object" && raw.properties ? raw.properties : raw;
  const ok = (name) => /^[A-Za-z0-9_]{1,60}$/.test(name);
  const names = new Set(Object.keys(properties ?? {}).filter(ok));
  const required = new Set(Array.isArray(raw?.required) ? raw.required.filter((name) => typeof name === "string" && ok(name)) : []);
  if (!Array.isArray(raw?.required)) for (const name of names) if (properties[name]?.required === true) required.add(name);
  return { names, required };
}

// The inputs to send: only what the tool really has, from the step's words. `values` = { target, title, details } (already checked and cut).
// Returns { arguments } or { error } when a needed input has no home in the tool, or the tool needs something we do not fill in.
export function buildArguments(action, values, { names, required }) {
  const meant = action.meaning(values);
  const args = {};
  // some tools take the repository as one box "owner/name" instead of two
  const oneBox = action.id === "github_issue" && names.has("repo_name") && !names.has("repo");
  if (oneBox) args.repo_name = values.target;
  for (const [meaning, value] of Object.entries(meant)) {
    if (typeof value !== "string" || value === "") continue; // an empty optional word is simply not sent
    if (oneBox && (meaning === "owner" || meaning === "repo")) continue;
    const name = action.candidates[meaning]?.find((candidate) => names.has(candidate));
    if (!name) return { error: "no input for " + meaning };
    args[name] = value;
  }
  for (const name of required) if (!(name in args)) return { error: "the tool needs " + name };
  return { arguments: args };
}
