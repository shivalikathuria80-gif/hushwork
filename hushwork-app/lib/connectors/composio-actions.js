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
//   selfAllowed  (optional) true when the "where" may be {myEmail}: the signed-in person's own address, filled in when the step is shown and run
//   example      (optional) the made-up value a TEMPLATE puts in the "where" box (a page id of zeros, your-name/your-repo). It is refused with a plain
//                sentence until the person changes it, instead of being sent to the app.
//   noDetails    (optional) true when the tool has no place for the "details" box: it is then never shown or sent
//   preview      (optional) turns the checked words into one or two plain lines for the approval card ("12 rows will be written"), so what is
//                built from the words (rows, slides) is read before it is made
//   then         (optional) for a file that needs TWO calls (make it, then write into it): { tool, candidates, meaning(values, made), when(values), partial }.
//                `made` = { id, link } found in the first answer. The second tool is looked at BEFORE the first call, so a mismatch makes nothing.
//                If the file was made but the second call fails, the step is still recorded as done with `partial` and the reason, and nothing is retried.
const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63}){1,4}$/;

// ---- reading the plain words of a sheet or a presentation -------------------------------------------------------------------------------------------------
// The person (or the AI step, through {answer}) writes ordinary lines; these turn them into the shapes the tools want. Both are cut to fixed sizes, and both are
// used for the approval card too, so what is read there is what is made.
const MAX_ROWS = 50;
const MAX_COLUMNS = 10;
const MAX_SLIDES = 12;
const MAX_BULLETS = 10;

// Rows of a sheet: one row per line, boxes separated by | (if the line has one) or by commas. Empty lines and Markdown table rulers (|---|---|) are skipped.
// Returns { rows: [[box, ...], ...], columns, cut } where `columns` is the widest row and `cut` says something was left out.
export function parseRows(text) {
  const rows = [];
  let cut = false;
  for (const line of String(text ?? "").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || /^[\s|:+-]+$/.test(trimmed)) continue;
    const boxes = (trimmed.includes("|") ? trimmed.replace(/^\|/, "").replace(/\|$/, "").split("|") : trimmed.split(",")).map((box) => box.trim().slice(0, 200));
    if (boxes.length > MAX_COLUMNS) cut = true;
    if (rows.length >= MAX_ROWS) { cut = true; break; }
    rows.push(boxes.slice(0, MAX_COLUMNS));
  }
  return { rows, columns: Math.max(0, ...rows.map((row) => row.length)), cut };
}

// Slides of a presentation: a line starting with "# " begins a slide, every other line is a bullet of the slide above it. Words before the first "# " (or an
// outline with no "# " at all) go on a first slide named after the presentation. Returns { slides: [{ heading, bullets }], cut }.
export function parseOutline(title, text) {
  const slides = [];
  let cut = false;
  const heading = String(title ?? "").trim().slice(0, 100) || "Presentation";
  for (const line of String(text ?? "").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const starts = trimmed.match(/^#+\s+(.*)$/);
    if (starts) {
      if (!starts[1].trim()) continue;
      if (slides.length >= MAX_SLIDES) { cut = true; break; }
      slides.push({ heading: starts[1].trim().slice(0, 100), bullets: [] });
      continue;
    }
    if (!slides.length) slides.push({ heading, bullets: [] });
    const bullet = trimmed.replace(/^[-*•]\s+/, "").slice(0, 200);
    if (slides.at(-1).bullets.length < MAX_BULLETS) slides.at(-1).bullets.push(bullet);
  }
  if (!slides.length) slides.push({ heading, bullets: [] });
  return { slides, cut };
}

// The Markdown the Slides tool takes: slides separated by ---, the first one a title slide. The words are made plain first (no pictures, quotes, rulers or
// column markers), so nothing the AI wrote can pull in a web address or change the layout.
const plainMarkdown = (text) => text.replace(/!\[/g, "[").replace(/\|\|\|/g, "|").replace(/^[>#]+\s*/, "").replace(/^-{3,}/, "").trim();
export function outlineToMarkdown(title, text) {
  return parseOutline(title, text).slides.map((slide, index) => {
    const lines = slide.bullets.map(plainMarkdown).filter(Boolean).map((bullet) => (index === 0 ? bullet : `- ${bullet}`));
    return [`# ${plainMarkdown(slide.heading) || "Slide"}`, ...lines].join("\n");
  }).join("\n\n---\n\n");
}

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
    id: "github_issue", app: "github", name: "Create a GitHub issue", tool: "GITHUB_CREATE_AN_ISSUE", needsTarget: true, example: "your-name/your-repo",
    target: { pattern: /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}$/, hint: "Write the repository as owner/name, for example acme/website." },
    candidates: { owner: ["owner"], repo: ["repo", "repo_name"], title: ["title"], body: ["body"] },
    meaning: (v) => { const [owner, repo] = v.target.split("/"); return { owner, repo, title: v.title, body: v.details }; },
    done: (v) => `Created a GitHub issue in ${v.target}`,
  },
  {
    id: "gmail_send", app: "gmailsend", name: "Send an email (Gmail)", tool: "GMAIL_SEND_EMAIL", needsTarget: true, selfAllowed: true,
    target: { pattern: EMAIL_PATTERN, hint: "Write the email address it goes to, for example name@example.com, or {myEmail} for your own address." },
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
    id: "notion_page", app: "notion", name: "Create a Notion page", tool: "NOTION_CREATE_NOTION_PAGE", needsTarget: true, example: "00000000000000000000000000000000",
    target: { pattern: /^[0-9a-fA-F]{8}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{12}$/, hint: "Write the id of the Notion page it goes under: the long code (32 letters and numbers) at the end of that page's address." },
    // `markdown` is the text on the page (Composio's create-page tool takes it in the same call). Empty means an empty page with just the title.
    candidates: { parent_id: ["parent_id"], title: ["title"], markdown: ["markdown"] },
    meaning: (v) => ({ parent_id: v.target, title: v.title, markdown: v.details }),
    done: () => "Created a Notion page",
    labels: { target: "Under page", title: "Page title", details: "Text on the page" },
  },
  {
    id: "todoist_task", app: "todoist", name: "Add a Todoist task", tool: "TODOIST_CREATE_TASK", needsTarget: false,
    target: null,
    candidates: { content: ["content"], description: ["description"] },
    meaning: (v) => ({ content: v.title, description: v.details }),
    done: () => "Added a Todoist task",
  },
  {
    // A DRAFT only: it lands in the person's Gmail Drafts and nothing is sent. Same boxes and the same {myEmail} rule as the email above.
    id: "gmail_draft", app: "gmailsend", name: "Save an email as a Gmail draft", tool: "GMAIL_CREATE_EMAIL_DRAFT", needsTarget: true, selfAllowed: true,
    target: { pattern: EMAIL_PATTERN, hint: "Write the email address the draft is for, for example name@example.com, or {myEmail} for your own address." },
    candidates: { recipient_email: ["recipient_email", "to"], subject: ["subject"], body: ["body", "message_body"] },
    meaning: (v) => ({ recipient_email: v.target, subject: v.title, body: v.details || v.title }),
    done: (v) => `Saved a draft in your Gmail Drafts for ${v.target} (nothing was sent)`,
    labels: { target: "To", title: "Subject", details: "Email text" },
    preview: () => "It is only saved as a draft in your Gmail. Nothing is sent: you open the draft and send it yourself.",
  },
  {
    // Two calls: make the spreadsheet, then write the rows into it. Every box is written as plain text ("RAW"), so a line such as =IMPORTXML(...) is never run as a formula.
    id: "sheet_create", app: "gsheets", name: "Create a Google Sheet with rows", tool: "GOOGLESHEETS_CREATE_GOOGLE_SHEET1", needsTarget: false,
    target: null,
    candidates: { title: ["title"] },
    meaning: (v) => ({ title: v.title }),
    then: {
      tool: "GOOGLESHEETS_VALUES_UPDATE",
      candidates: { spreadsheet_id: ["spreadsheet_id", "spreadsheetId"], range: ["range"], values: ["values"], value_input_option: ["value_input_option", "valueInputOption"] },
      meaning: (v, made) => ({ spreadsheet_id: made.id, range: "A1", values: parseRows(v.details).rows, value_input_option: "RAW" }),
      when: (v) => parseRows(v.details).rows.length > 0,
      partial: "The spreadsheet was created, but its rows may not have been added.",
    },
    done: () => "Created a Google Sheet",
    labels: { title: "Spreadsheet name", details: "Rows (one per line)" },
    preview: (v) => { const { rows, columns, cut } = parseRows(v.details); return `${rows.length} ${rows.length === 1 ? "row" : "rows"} of up to ${columns} ${columns === 1 ? "box" : "boxes"} will be written into one new spreadsheet, as plain text.${cut ? ` Rows after ${MAX_ROWS} and boxes after ${MAX_COLUMNS} are left out.` : ""}`; },
  },
  {
    id: "slides_create", app: "gslides", name: "Create a Google Slides presentation", tool: "GOOGLESLIDES_CREATE_SLIDES_MARKDOWN", needsTarget: false,
    target: null,
    candidates: { title: ["title"], markdown_text: ["markdown_text", "markdown"] },
    meaning: (v) => ({ title: v.title, markdown_text: outlineToMarkdown(v.title, v.details) }),
    done: () => "Created a Google Slides presentation",
    labels: { title: "Presentation title", details: "Outline (# starts a slide)" },
    preview: (v) => { const { slides, cut } = parseOutline(v.title, v.details); return `${slides.length} ${slides.length === 1 ? "slide" : "slides"} will be made: ${slides.map((slide) => `"${slide.heading.slice(0, 40)}"`).join(", ")}.${cut ? ` Slides after ${MAX_SLIDES} are left out.` : ""}`; },
  },
  {
    // Plain text on purpose (not the Markdown tool): Markdown could pull in pictures from web addresses the AI wrote.
    id: "doc_create", app: "gdocs", name: "Create a Google Doc with text", tool: "GOOGLEDOCS_CREATE_DOCUMENT", needsTarget: false,
    target: null,
    candidates: { title: ["title"], text: ["text"] },
    meaning: (v) => ({ title: v.title, text: v.details }),
    done: () => "Created a Google Doc",
    labels: { title: "Document name", details: "Text of the document" },
  },
  {
    // "Where" is optional here: empty = the top of the person's Drive; otherwise the id of a folder that already exists (the long code at the end of its address).
    id: "drive_folder_create", app: "gdrivewrite", name: "Create a Google Drive folder", tool: "GOOGLEDRIVE_CREATE_FOLDER", needsTarget: true, noDetails: true,
    target: { pattern: /^(?:[A-Za-z0-9_-]{10,100})?$/, hint: "Leave empty for the top of your Drive, or write the id of the folder it goes into (the long code at the end of that folder's address).", empty: "the top of your Drive" },
    candidates: { name: ["name"], parent_id: ["parent_id"] },
    meaning: (v) => ({ name: v.title, parent_id: v.target }),
    done: (v) => `Created a Google Drive folder${v.target ? " inside the folder you named" : ""}`,
    labels: { target: "Inside folder (id)", title: "Folder name" },
  },
];

export const labelFor = (action, box) => action?.labels?.[box] ?? { target: "Where", title: "Title", details: "Details" }[box];
export const findAction = (id) => (typeof id === "string" ? COMPOSIO_ACTIONS.find((action) => action.id === id) ?? null : null);
export const COMPOSIO_ACTION_IDS = COMPOSIO_ACTIONS.map((action) => action.id);
export const actionsForApp = (appId) => COMPOSIO_ACTIONS.filter((action) => action.app === appId);

// Is this "where" acceptable for this action? Returns { value } or { error }. An action with no "where" accepts only an empty one.
export const MY_EMAIL = "{myEmail}";

export function checkTarget(action, raw) {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!action.needsTarget) return text ? { error: "This action does not use a place. Leave that box empty." } : { value: "" };
  if (action.selfAllowed && text === MY_EMAIL) return { value: MY_EMAIL }; // filled in later by resolveTarget, from the signed-in person
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
// `action` may also be an action's `then` (its second call): it has the same `candidates` and `meaning`, and `made` ({ id, link } of the file the first call made) is handed to `meaning`.
export function buildArguments(action, values, { names, required }, made = {}) {
  const meant = action.meaning(values, made);
  const args = {};
  // some tools take the repository as one box "owner/name" instead of two
  const oneBox = action.id === "github_issue" && names.has("repo_name") && !names.has("repo");
  if (oneBox) args.repo_name = values.target;
  for (const [meaning, value] of Object.entries(meant)) {
    if (typeof value === "string" ? value === "" : !Array.isArray(value) || value.length === 0) continue; // an empty optional word is simply not sent (a list, such as the rows of a sheet, is sent as it is)
    if (oneBox && (meaning === "owner" || meaning === "repo")) continue;
    const name = action.candidates[meaning]?.find((candidate) => names.has(candidate));
    if (!name) return { error: "no input for " + meaning };
    args[name] = value;
  }
  for (const name of required) if (!(name in args)) return { error: "the tool needs " + name };
  return { arguments: args };
}

// The real "where": {myEmail} becomes the signed-in person's own address (checked like any other address); anything else is already real.
// `myEmail` comes from the session or the database, never from the step. Returns { value } or { error }.
export function resolveTarget(action, value, myEmail) {
  if (value !== MY_EMAIL) return { value };
  const own = checkTarget({ ...action, selfAllowed: false }, typeof myEmail === "string" ? myEmail : "");
  return own.error ? { error: "Your account has no email address to send to. Write an address in the step instead of {myEmail}." } : own;
}

// Is this "where" still the made-up value a template starts with? (A Notion page id of all zeros has no dashes or capitals to worry about.)
const plain = (text) => String(text ?? "").trim().toLowerCase().replaceAll("-", "");
export const isExampleTarget = (action, target) => Boolean(action?.example) && plain(target) === plain(action.example);

export const EXAMPLE_NOTICE = "This is still the example value from the template. In the Builder, change it to your own: for Notion the id of your page (the long code at the end of its address), for GitHub your repository as owner/name.";

