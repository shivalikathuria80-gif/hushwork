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
      choice("how", "What starts it", { schedule: "On a schedule", email: "When an email arrives", lead: "When a new lead arrives", manual: "When I ask" }),
      text("when", "When", 80, { optional: true, hint: "For example: every weekday at 9am" }),
    ],
    describe: (fields, label) => ({ title: label("how"), detail: fields.when }),
  },
  find: {
    label: "Look something up",
    help: "Find the information a later step needs.",
    icon: "Search",
    fields: [
      choice("where", "Where", { inbox: "Inbox", sheet: "Spreadsheet", calendar: "Calendar", files: "Files", payments: "Payments", other: "Somewhere else" }),
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
    help: "Say who gets it. A practice run sends nothing. On Telegram, you can approve a real message to yourself from the Runs page.",
    icon: "Send",
    fields: [
      choice("how", "How", { email: "By email", slack: "On Slack", telegram: "On Telegram", other: "Another way" }),
      text("to", "To whom", 80, { hint: "For example: each overdue client" }),
      text("about", "About", 80, { optional: true, hint: "For example: payment reminder" }),
    ],
    describe: (fields, label) => ({ title: "Send a message", detail: join(`${label("how")}, to ${fields.to}`, fields.about) }),
  },
  row: {
    label: "Add a row",
    help: "Add a line to a spreadsheet.",
    icon: "Table",
    fields: [
      text("to", "Spreadsheet", 80, { hint: "For example: Invoice tracker" }),
      text("values", "What to add", 100, { hint: "For example: client name, amount, date" }),
    ],
    describe: (fields) => ({ title: "Add a row", detail: `To ${fields.to}: ${fields.values}` }),
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
