// The kinds of step a plan can hold (workflow builder, phase B). A step used to be only free text: a title and a detail.
// A typed step has a KIND (what sort of step it is) and named FIELDS (the blanks to fill in), for example the kind
// "send" has the fields how, to and about. The title and detail you see are WORKED OUT from the fields, so everything
// that shows a step keeps working unchanged. Nothing here runs anything: a typed step is still only a plan to read,
// and it is labelled "Not connected" on screen.
//
// A step with no kind (every plan saved before phase B) is a plain "note": free title and detail.
//
// This file is plain data and one small function, with no imports, so the browser and the server load the same rules.
// To add a kind later: add an entry below, keep every text field short (see the worst-case test in steps.test.js), and
// use an icon from lib/ai/icon-names.js.

import { COMPOSIO_APPS } from "./connectors/composio-apps.js"; // plain data, so the browser and the server still load the same rules
import { COMPOSIO_ACTIONS } from "./connectors/composio-actions.js";

export const NOTE = "note";

// How to read a field description:
//   type "choice": the person picks one entry of `options` ({ saved-value: "label shown" }).
//   type "text":   a short piece of text, at most `max` characters, required unless `optional` is true.
const choice = (key, label, options) => ({ key, label, type: "choice", options });
const text = (key, label, max, extra = {}) => ({ key, label, type: "text", max, ...extra });
const join = (first, second) => (second ? `${first}: ${second}` : first);

export const STEP_KINDS = {
  trigger: {
    label: "Start",
    help: "What starts this workflow.",
    icon: "Zap",
    fields: [
      choice("how", "What starts it", { schedule: "On a schedule", watch: "Keep watching: tell me only when something new shows up", email:"When an email arrives", lead: "When a new lead arrives", manual: "When I ask" }),
      text("when", "When", 80, { optional: true, hint: "For example: every weekday at 9am" }),
    ],
    describe: (fields, label) => ({ title: label("how"), detail: fields.when }),
  },
  find: {
    label: "Look something up",
    help: "Find the information a later step needs.",
    icon: "Search",
    fields: [
      choice("where", "Where", { inbox: "Inbox", sheet: "Spreadsheet", calendar: "Calendar", files: "Files", payments: "Payments", linear: "Linear", other: "Somewhere else" }),
      text("what", "What to look for", 120, { hint: "For example: invoices more than 7 days overdue" }),
    ],
    describe: (fields, label) => ({ title: "Look something up", detail: join(label("where"), fields.what) }),
  },
  write: {
    label: "Draft something",
    help: "Write a first version for you to read.",
    icon: "PenLine",
    fields: [
      choice("what", "What to write", { email: "An email", reply: "A reply", summary: "A summary", report: "A report", message: "A message" }),
      text("about", "About", 120, { optional: true, hint: "For example: a polite reminder for each client" }),
    ],
    describe: (fields, label) => ({ title: "Draft something", detail: join(label("what"), fields.about) }),
  },
  approve: {
    label: "Ask you to approve",
    help: "Stop and wait for your yes before the next step.",
    icon: "ShieldCheck",
    fields: [
      text("what", "What you will approve", 120, { optional: true, hint: "For example: the reminders before they are sent" }),
    ],
    describe: (fields) => ({ title: "Ask you to approve", detail: fields.what || "Nothing is sent until you say yes" }),
  },
  send: {
    label: "Send a message",
    help: "Only describes who would get a message. NOTHING is sent: it is a plan. To really send an email, a Slack message and more, use \"Do something in another app\".",
    icon: "Send",
    fields: [
      choice("how", "How", { email: "By email", slack: "On Slack", other: "Another way" }),
      text("to", "To whom", 80, { hint: "For example: each overdue client" }),
      text("about", "About", 80, { optional: true, hint: "For example: payment reminder" }),
    ],
    describe: (fields, label) => ({ title: "Send a message", detail: join(`${label("how")}, to ${fields.to}`, fields.about) }),
  },
  row: {
    label: "Add a row",
    help: "Add a line to a Google Sheet. After you connect Google, you approve the row on the Runs page.",
    icon: "Table",
    fields: [
      text("to", "Google Sheet address", 120, { hint: "Paste the web address of your Google Sheet (docs.google.com/spreadsheets/...)" }),
      text("values", "What to add", 80, { hint: "Boxes separated by commas, for example: Ana, 500, 20 Oct. Write {answer} to add what an Ask the AI step said." }),
    ],
    // A pasted sheet address is long, so the plan just says "your Google Sheet"; a plain name (an older plan) is shown as it is, cut at 50.
    describe: (fields) => {
      const where = /^https:\/\/docs\.google\.com\/spreadsheets\//.test(fields.to) ? "your Google Sheet" : fields.to.length > 50 ? `${fields.to.slice(0, 49)}…` : fields.to;
      return { title: "Add a row", detail: `To ${where}: ${fields.values}` };
    },
  },
  request: {
    label: "Call a web address",
    help: "Ask a web address for information (a read-only GET). You approve the call on the Runs page.",
    icon: "Plug",
    fields: [
      text("url", "Web address", 120, { hint: "For example: https://api.example.com/status. Starts with https://. Never put a password or key in it." }),
      text("why", "What it is for", 60, { optional: true, hint: "For example: check if the site is up" }),
    ],
    describe: (fields) => ({ title: "Call a web address", detail: join(`Get ${fields.url}`, fields.why) }),
  },
  ai: {
    label: "Ask the AI",
    help: "Give the AI a job. It can look at your Linear tasks, your calendar, your Gmail inbox, your Google Drive file list, an app you connected through Composio, one web address or the read-only tools of one MCP server first. It can only read. You approve it on the Runs page.",
    icon: "Sparkles",
    fields: [
      text("task", "What should the AI do?", 110, { hint: "For example: Tell me which task to do first" }),
      choice("uses", "What may it look at?", { nothing: "Nothing, just think", linear: "My Linear tasks", calendar: "My Google Calendar", gmail: "My Gmail inbox (senders and subjects)", gmailtext: "My Gmail inbox, with the text of each email", drive: "My Google Drive files", app: "Another app (Todoist, Notion...)", web: "A web address", mcp: "An MCP server" }),
      text("address", "Web address", 100, { optional: true, hint: "Only for A web address or An MCP server (starts with https://), or Another app (its short name from the Connections page, for example todoist, github, stripe or stripeinvoices; for the messages of one Slack channel write slackmessages:channelname)" }),
    ],
    describe: (fields, label) => ({ title: "Ask the AI", detail: join(fields.task, label("uses") === "Nothing, just think" ? "" : label("uses")) }),
  },
  app: {
    label: "Look in another app",
    help: "Look at something in an app you connected through Composio (Todoist, Notion...). It only reads. You approve the look on the Runs page.",
    icon: "Plug",
    fields: [
      choice("app", "Which app", Object.fromEntries(COMPOSIO_APPS.filter((app) => !app.input && !app.noLookup).map((app) => [app.id, app.name]))),
      text("what", "Your note", 120, { optional: true, hint: "Optional. What you want to know, for example: which task is due first" }),
    ],
    describe: (fields, label) => ({ title: "Look in another app", detail: join(label("app"), fields.what) }),
  },
  issue: {
    label: "Create a Linear task",
    help: "Add one task in Linear. After you connect Linear, you approve the task on the Runs page. Write {answer} to use what an Ask the AI step said.",
    icon: "ListTodo",
    fields: [
      text("title", "Task title", 100, { hint: "For example: Reply to Ana about the invoice. Write {answer} to use what an Ask the AI step said." }),
      text("details", "Details", 150, { optional: true, hint: "Optional. More about the task." }),
      text("team", "Team key", 10, { optional: true, hint: "Optional. The short key of the Linear team, for example ENG. Empty means your first team." }),
    ],
    describe: (fields) => ({ title: "Create a Linear task", detail: join(fields.title, fields.team ? `in ${fields.team}` : "") }),
  },
  action: {
    label: "Do something in another app",
    help: "Send an email, send a Slack message, create a GitHub issue, add a Todoist task, add a Google Calendar event, create a Notion page, save a Gmail draft (nothing is sent), or create a Google Sheet, Slides presentation, Doc or Drive folder, in an app you connected through Composio. It does exactly that one thing. You read what will be sent and approve it on the Runs page. Write {answer} to use what an Ask the AI step said.",
    icon: "Send",
    fields: [
      choice("action", "What to do", Object.fromEntries(COMPOSIO_ACTIONS.map((action) => [action.id, action.name]))),
      text("target", "Where", 40, { optional: true, hint: "Slack: the channel, like general. GitHub: owner/name, like acme/website. Email: the address it goes to. Calendar: the start, like 2026-11-05 15:00. Notion: the id of the page it goes under. Todoist, Sheet, Slides, Doc: leave empty. Drive folder: empty, or the id of the folder it goes into." }),
      text("title", "Message or title", 80, { hint: "For example: Deploy finished. Write {answer} to use what an Ask the AI step said." }),
      text("details", "More details", 120, { optional: true, hint: "Optional. More words for the message or the issue. For an email this is the text of the email; for a Sheet, the rows (one row per line, boxes separated by |); for Slides, the outline (a line starting with # begins a slide); for a Doc, its text. A typed box is one line, so for several lines write {answer} and let an Ask the AI step write them." }),
    ],
    describe: (fields, label) => ({ title: label("action"), detail: join(fields.title, fields.target ? `in ${fields.target}` : "") }),
  },
};

// The kinds in the order the editor lists them (note, the free-text step, is offered first by the editor itself).
export const STEP_KIND_ORDER = Object.keys(STEP_KINDS);

export const isTypedKind = (kind) => typeof kind === "string" && Object.hasOwn(STEP_KINDS, kind);

// The title and detail for a typed step, worked out from its (already cleaned) fields. `fields` must hold a valid value
// for every required field; validate.js makes sure of that before calling this.
export function describeStep(kind, fields) {
  const spec = STEP_KINDS[kind];
  const label = (key) => spec.fields.find((field) => field.key === key).options[fields[key]];
  return spec.describe(fields, label);
}

// How a plan moves around the page. On screen a plan is a list of tuples [icon, title, detail, kind, fields] (the last two
// are missing for a plain note); the editor and the saving code use step objects { icon, title, detail, kind?, fields? }.
export const stepsToPlan = (steps) => steps.map((step) => [step.icon, step.title, step.detail, step.kind, step.fields]);
export const planToSteps = (plan) => plan.map(([icon, title, detail, kind, fields]) => (kind ? { icon, title, detail, kind, fields } : { icon, title, detail }));

// Reads one step of a SAVED plan (a row from the database) so it can be handed to the browser. It never throws and never
// trusts the shape: text becomes plain strings, and a typed step keeps its kind and its fields (strings only, only the
// fields the kind has). Anything else is left out. The saved text was already checked when it was stored; this is the
// second line of defence.
export function readSavedStep(step) {
  const text = (value) => (typeof value === "string" ? value : "");
  const read = { icon: text(step?.icon), title: text(step?.title), detail: text(step?.detail) };
  const isObject = step?.fields !== null && typeof step?.fields === "object" && !Array.isArray(step.fields);
  if (isTypedKind(step?.kind) && isObject) {
    read.kind = step.kind;
    read.fields = {};
    for (const spec of STEP_KINDS[step.kind].fields) read.fields[spec.key] = Object.hasOwn(step.fields, spec.key) ? text(step.fields[spec.key]) : "";
  }
  return read;
}

// A new, empty set of fields for a kind (every field blank; a choice starts on its first option so it always holds a
// valid value). The step editor uses it when someone picks a kind.
export function blankFields(kind) {
  const fields = {};
  for (const field of STEP_KINDS[kind].fields) fields[field.key] = field.type === "choice" ? Object.keys(field.options)[0] : "";
  return fields;
}
