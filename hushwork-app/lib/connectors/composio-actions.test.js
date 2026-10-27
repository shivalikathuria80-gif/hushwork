import test from "node:test";
import assert from "node:assert/strict";
import { COMPOSIO_ACTIONS, buildArguments, checkTarget, findAction, readToolInputs, actionsForApp, parseRows, parseOutline, outlineToMarkdown } from "./composio-actions.js";
import { COMPOSIO_APPS, findComposioApp } from "./composio-apps.js";
import { runActionTool, allowedTools, ensureAuthConfig, findCreated, COMPOSIO_FAILED } from "./composio.js";

const sentence = (result) => ({ ok: result.ok, error: result.error });
const json = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) });
const slack = findAction("slack_message");
const github = findAction("github_issue");
const todoist = findAction("todoist_task");

// A pretend Composio: remembers every request. `tool` is what GET /tools/<slug> answers; `execute` is what running it answers.
function composio({ tool, execute = { successful: true, data: { ok: true } } } = {}) {
  const sent = [];
  const fetchImpl = async (url, init) => {
    const u = new URL(url);
    sent.push({ method: init.method, path: u.pathname, body: init.body ? JSON.parse(init.body) : undefined });
    return init.method === "GET" ? json(tool) : json(execute);
  };
  return { fetchImpl, sent };
}

test("the list: each action belongs to a real app, names one tool written Composio's way that is NOT the app's read-only lookup, and has a way to say each thing", () => {
  assert.ok(COMPOSIO_ACTIONS.length >= 3);
  assert.equal(new Set(COMPOSIO_ACTIONS.map((action) => action.id)).size, COMPOSIO_ACTIONS.length);
  assert.equal(new Set(COMPOSIO_ACTIONS.map((action) => action.tool)).size, COMPOSIO_ACTIONS.length);
  for (const action of COMPOSIO_ACTIONS) {
    const app = findComposioApp(action.app);
    assert.ok(app, `${action.id}: its app exists`);
    assert.match(action.tool, new RegExp(`^${app.toolkit.toUpperCase()}_[A-Z0-9_]+$`), `${action.id}: the tool belongs to the toolkit`);
    assert.notEqual(action.tool, app.tool);
    assert.ok(action.name && typeof action.done === "function" && typeof action.meaning === "function");
    const meant = action.meaning({ target: action.needsTarget ? ({ github_issue: "acme/site", gmail_send: "a@b.co", calendar_event: "2026-11-05 15:00", notion_page: "0123456789abcdef0123456789abcdef" }[action.id] ?? "general") : "", title: "T", details: "D" });
    for (const meaning of Object.keys(meant)) assert.ok(action.candidates[meaning]?.length, `${action.id}: a name for ${meaning}`);
  }
  for (const bad of ["", "nope", "__proto__", "constructor", 5, null, undefined]) assert.equal(findAction(bad), null, String(bad));
  assert.deepEqual(actionsForApp("slack").map((action) => action.id), ["slack_message"]);
  assert.deepEqual(actionsForApp("notion").map((action) => action.id), ["notion_page"]);
  assert.deepEqual(actionsForApp("airtable"), []);
});

test("the sign-in at Composio is limited to the app's lookup plus the tools of its actions, and nothing else", () => {
  assert.deepEqual(allowedTools(findComposioApp("slack")), ["SLACK_LIST_ALL_CHANNELS", "SLACK_SEND_MESSAGE", "SLACK_FETCH_CONVERSATION_HISTORY"], "Slack: the channel list, the send, and reading one channel");
  assert.deepEqual(allowedTools(findComposioApp("airtable")), ["AIRTABLE_LIST_BASES"]);
  assert.deepEqual(allowedTools(findComposioApp("todoist")), ["TODOIST_GET_ALL_TASKS", "TODOIST_CREATE_TASK"]);
  for (const app of COMPOSIO_APPS) assert.ok(allowedTools(app).length >= 1);
});

test("a blueprint is reused only when its limit is exactly the allowed tools; otherwise one is made with them", async () => {
  const wanted = ["SLACK_LIST_ALL_CHANNELS", "SLACK_SEND_MESSAGE", "SLACK_FETCH_CONVERSATION_HISTORY"];
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ method: init.method, body: init.body ? JSON.parse(init.body) : undefined });
    if (init.method === "GET") return json({ items: [{ id: "ac_old", toolkit: { slug: "slack" }, is_composio_managed: true, status: "ENABLED", restrict_to_following_tools: ["SLACK_LIST_ALL_CHANNELS"] }] });
    return json({ auth_config: { id: "ac_new" } }, 201);
  };
  assert.deepEqual(await ensureAuthConfig({ key: "k", app: findComposioApp("slack"), fetchImpl }), { id: "ac_new" });
  assert.deepEqual(calls[1].body.auth_config.restrict_to_following_tools, wanted);
  const reuse = async () => json({ items: [{ id: "ac_ok", toolkit: { slug: "slack" }, is_composio_managed: true, status: "ENABLED", restrict_to_following_tools: [...wanted].reverse() }] });
  assert.deepEqual(await ensureAuthConfig({ key: "k", app: findComposioApp("slack"), fetchImpl: reuse }), { id: "ac_ok" });
});

test("where a message or issue goes is checked before any request: a plain channel or owner/name, never anything with odd characters", () => {
  for (const good of ["general", "#general", "team-updates", "C0123ABCD", "dev.ops_1"]) assert.deepEqual(checkTarget(slack, good), { value: good }, good);
  for (const bad of ["", "two words", "a/b", "../x", "<script>", "x".repeat(81), "general\nsecret", 5, null]) assert.ok(checkTarget(slack, bad).error, String(bad));
  for (const good of ["acme/website", "my-org/repo.name", "a/b"]) assert.deepEqual(checkTarget(github, good), { value: good }, good);
  for (const bad of ["acme", "acme/", "/repo", "acme/re po", "acme/repo/extra", "-acme/repo", "ac me/repo", "../../etc/passwd", "acme/..%2f"]) assert.ok(checkTarget(github, bad).error, bad);
  const email = findAction("gmail_send");
  for (const good of ["alex.example@gmail.com", "a+b@mail.example.co.uk"]) assert.deepEqual(checkTarget(email, good), { value: good }, good);
  for (const bad of ["arjun", "a@b", "a b@c.com", "a@@c.com", "a@c.com"+String.fromCharCode(10)+"bcc:x@y.com", "<a@c.com>", "a@c..com", "@c.com"]) assert.ok(checkTarget(email, bad).error, bad);
  assert.deepEqual(checkTarget(todoist, ""), { value: "" });
  assert.ok(checkTarget(todoist, "inbox").error, "an action with no place refuses one");
});

test("reading a tool's inputs works for a plain list and for a JSON schema; odd names are ignored", () => {
  const plain = readToolInputs({ input_parameters: { channel: { required: true }, markdown_text: { required: true }, thread_ts: {}, "bad name!": { required: true } } });
  assert.deepEqual([...plain.names].sort(), ["channel", "markdown_text", "thread_ts"]);
  assert.deepEqual([...plain.required].sort(), ["channel", "markdown_text"]);
  const schema = readToolInputs({ input_parameters: { type: "object", properties: { owner: {}, repo: {}, title: {}, body: {} }, required: ["owner", "repo", "title"] } });
  assert.deepEqual([...schema.names].sort(), ["body", "owner", "repo", "title"]);
  assert.deepEqual([...schema.required].sort(), ["owner", "repo", "title"]);
  for (const odd of [null, undefined, {}, { input_parameters: null }, { input_parameters: "x" }]) assert.deepEqual([...readToolInputs(odd).names], []);
});

test("the request is built only from inputs the tool really has; a missing home or an extra required input means nothing is sent", () => {
  const values = { target: "#general", title: "Deploy done", details: "All green" };
  assert.deepEqual(buildArguments(slack, values, readToolInputs({ input_parameters: { channel: { required: true }, markdown_text: { required: true }, thread_ts: {} } })), { arguments: { channel: "general", markdown_text: "Deploy done\nAll green" } });
  assert.deepEqual(buildArguments(slack, { ...values, details: "" }, readToolInputs({ input_parameters: { channel: { required: true }, text: { required: true } } })).arguments, { channel: "general", text: "Deploy done" });
  assert.ok(buildArguments(slack, values, readToolInputs({ input_parameters: { channel: { required: true } } })).error, "no input for the message");
  assert.ok(buildArguments(slack, values, readToolInputs({ input_parameters: { channel: { required: true }, text: { required: true }, bot_token: { required: true } } })).error, "an input we do not fill in is required");
  const issue = { target: "acme/website", title: "Broken link", details: "" };
  assert.deepEqual(buildArguments(github, issue, readToolInputs({ input_parameters: { type: "object", properties: { owner: {}, repo: {}, title: {}, body: {} }, required: ["owner", "repo", "title"] } })).arguments, { owner: "acme", repo: "website", title: "Broken link" });
  assert.deepEqual(buildArguments(github, issue, readToolInputs({ input_parameters: { repo_name: { required: true }, title: { required: true } } })).arguments, { repo_name: "acme/website", title: "Broken link" }, "one box for owner/name");
  assert.deepEqual(buildArguments(todoist, { target: "", title: "Buy milk", details: "2 litres" }, readToolInputs({ input_parameters: { content: { required: true }, description: {}, project_id: {} } })).arguments, { content: "Buy milk", description: "2 litres" });
});

test("an email: the address, subject and text go to the tool's own boxes, and the subject is the text if there is no text", () => {
  const email = findAction("gmail_send");
  const inputs = readToolInputs({ input_parameters: { recipient_email: { required: true }, subject: {}, body: { required: true }, cc: {} } });
  assert.deepEqual(buildArguments(email, { target: "a@b.co", title: "Greetings", details: "Dear Arjun" }, inputs).arguments, { recipient_email: "a@b.co", subject: "Greetings", body: "Dear Arjun" });
  assert.deepEqual(buildArguments(email, { target: "a@b.co", title: "Greetings", details: "" }, inputs).arguments, { recipient_email: "a@b.co", subject: "Greetings", body: "Greetings" });
  assert.deepEqual(allowedTools(findComposioApp("gmailsend")), ["GMAIL_LIST_LABELS", "GMAIL_SEND_EMAIL", "GMAIL_CREATE_EMAIL_DRAFT"]);
});

test("doing an action: the tool's inputs are asked for first, then ONE request with exactly the built inputs for this person; nothing else is ever sent", async () => {
  const pretend = composio({ tool: { input_parameters: { channel: { required: true }, markdown_text: { required: true } } }, execute: { successful: true, data: { ok: true, ts: "1.2" } } });
  const result = await runActionTool({ key: "k", userId: "u-1", action: slack, values: { target: "general", title: "Hello team", details: "" }, fetchImpl: pretend.fetchImpl });
  assert.equal(result.ok, true);
  assert.deepEqual(pretend.sent.map((entry) => [entry.method, entry.path]), [["GET", "/api/v3.1/tools/SLACK_SEND_MESSAGE"], ["POST", "/api/v3.1/tools/execute/SLACK_SEND_MESSAGE"]]);
  assert.deepEqual(pretend.sent[1].body, { user_id: "u-1", arguments: { channel: "general", markdown_text: "Hello team" } });
});

test("nothing is sent when the tool does not match what we know, and every problem is a fixed sentence", async () => {
  const mismatch = composio({ tool: { input_parameters: { channel: { required: true }, markdown_text: { required: true }, api_secret: { required: true } } } });
  assert.deepEqual(await runActionTool({ key: "k", userId: "u", action: slack, values: { target: "general", title: "x", details: "" }, fetchImpl: mismatch.fetchImpl }), { ok: false, error: COMPOSIO_FAILED.cannotFill });
  assert.equal(mismatch.sent.filter((entry) => entry.method === "POST").length, 0, "no write request was sent");
  const refused = async () => json({}, 401);
  assert.deepEqual(sentence(await runActionTool({ key: "ak_SECRET", userId: "u", action: slack, values: { target: "general", title: "x", details: "" }, fetchImpl: refused })), { ok: false, error: COMPOSIO_FAILED.key });
  const notConnected = composio({ tool: { input_parameters: { channel: { required: true }, text: { required: true } } }, execute: { successful: false, error: "No connected account for user" } });
  assert.deepEqual(sentence(await runActionTool({ key: "k", userId: "u", action: slack, values: { target: "general", title: "x", details: "" }, fetchImpl: notConnected.fetchImpl })), { ok: false, error: COMPOSIO_FAILED.notConnected });
  const odd = composio({ tool: { input_parameters: { channel: { required: true }, text: { required: true } } }, execute: { successful: false, error: "weird SECRET text" } });
  const failed = await runActionTool({ key: "k", userId: "u", action: slack, values: { target: "general", title: "x", details: "" }, fetchImpl: odd.fetchImpl });
  assert.deepEqual(sentence(failed), { ok: false, error: COMPOSIO_FAILED.failed });
  assert.equal(failed.said, "weird SECRET text", "what the app said is kept, cleaned, for the person to read");
  assert.ok(!failed.error.includes("SECRET"), "but the sentence is always ours");
});

test("a calendar event and a Notion page: the start time and the page id are checked, the words go to the tool's own boxes, and a Notion page carries its text in the tool's `markdown` box", () => {
  const event = findAction("calendar_event");
  for (const good of ["2026-11-05 15:00", "2027-01-31 00:00", "2026-12-31 23:59"]) assert.deepEqual(checkTarget(event, good), { value: good }, good);
  for (const bad of ["", "2026-13-05 15:00", "2026-11-32 15:00", "2026-11-05 24:00", "2026-11-05 15:60", "2026-11-05T15:00", "tomorrow 3pm", "2026-11-05", "2026-11-05 15:00\nbcc"]) assert.ok(checkTarget(event, bad).error, bad);
  const inputs = readToolInputs({ input_parameters: { start_datetime: { required: true }, summary: {}, description: {}, event_duration_minutes: {} } });
  assert.deepEqual(buildArguments(event, { target: "2026-11-05 15:00", title: "Dentist", details: "Bring the card" }, inputs).arguments, { start_datetime: "2026-11-05T15:00:00", summary: "Dentist", description: "Bring the card" });
  assert.deepEqual(buildArguments(event, { target: "2026-11-05 15:00", title: "Dentist", details: "" }, inputs).arguments, { start_datetime: "2026-11-05T15:00:00", summary: "Dentist" });
  assert.ok(buildArguments(event, { target: "2026-11-05 15:00", title: "x", details: "" }, readToolInputs({ input_parameters: { start_datetime: { required: true }, summary: {}, timezone: { required: true } } })).error, "an input we do not fill in is required: nothing is sent");

  const page = findAction("notion_page");
  for (const good of ["0123456789abcdef0123456789abcdef", "01234567-89ab-cdef-0123-456789abcdef"]) assert.deepEqual(checkTarget(page, good), { value: good }, good);
  for (const bad of ["", "abc", "0123456789abcdef0123456789abcdeg", "https://notion.so/x-0123456789abcdef0123456789abcdef"]) assert.ok(checkTarget(page, bad).error, bad);
  assert.equal(page.noDetails, undefined, "a Notion page can carry text now");
  const pageInputs = readToolInputs({ input_parameters: { parent_id: { required: true }, title: { required: true }, markdown: {}, icon: {} } });
  assert.deepEqual(buildArguments(page, { target: "0123456789abcdef0123456789abcdef", title: "Notes", details: "# Hello\n- one" }, pageInputs).arguments, { parent_id: "0123456789abcdef0123456789abcdef", title: "Notes", markdown: "# Hello\n- one" });
  assert.deepEqual(buildArguments(page, { target: "0123456789abcdef0123456789abcdef", title: "Notes", details: "" }, pageInputs).arguments, { parent_id: "0123456789abcdef0123456789abcdef", title: "Notes" }, "no text means an empty page with the title");
  const oldTool = readToolInputs({ input_parameters: { parent_id: { required: true }, title: { required: true } } });
  assert.ok(buildArguments(page, { target: "0123456789abcdef0123456789abcdef", title: "Notes", details: "words" }, oldTool).error, "a tool with no place for the text is never sent the text by guessing");
  assert.deepEqual(allowedTools(findComposioApp("gcalwrite")), ["GOOGLECALENDAR_LIST_CALENDARS", "GOOGLECALENDAR_CREATE_EVENT"]);
  assert.deepEqual(allowedTools(findComposioApp("notion")), ["NOTION_SEARCH_NOTION_PAGE", "NOTION_CREATE_NOTION_PAGE"]);
  // Stripe has two lookups on one sign-in: connecting Stripe (or its invoices) allows both, and nothing else
  assert.deepEqual(allowedTools(findComposioApp("stripe")), ["STRIPE_LIST_CHARGES", "STRIPE_LIST_INVOICES"]);
  assert.deepEqual(allowedTools(findComposioApp("stripeinvoices")), ["STRIPE_LIST_CHARGES", "STRIPE_LIST_INVOICES"]);
  assert.equal(findComposioApp("stripeinvoices").lookupOf, "stripe");
});

test("{myEmail}: allowed only for an email, becomes the signed-in person's own address (never one from the step), and a missing address is a clear message", async () => {
  const { MY_EMAIL, resolveTarget } = await import("./composio-actions.js");
  const email = findAction("gmail_send");
  assert.deepEqual(checkTarget(email, MY_EMAIL), { value: MY_EMAIL });
  assert.deepEqual(checkTarget(email, "  {myEmail} "), { value: MY_EMAIL });
  for (const other of ["slack_message", "github_issue", "calendar_event", "notion_page", "todoist_task"]) assert.ok(checkTarget(findAction(other), MY_EMAIL).error, `${other} does not take {myEmail}`);
  for (const bad of ["{myemail}", "{myEmail}x", "{{myEmail}}", "{ myEmail }"]) assert.ok(checkTarget(email, bad).error, bad);

  assert.deepEqual(resolveTarget(email, MY_EMAIL, "me@example.com"), { value: "me@example.com" });
  assert.deepEqual(resolveTarget(email, "friend@example.com", "me@example.com"), { value: "friend@example.com" }, "a written address is left alone");
  for (const missing of ["", undefined, null, 5, "not an address", "{myEmail}", "a@b.co\nbcc:x@y.co"]) assert.match(resolveTarget(email, MY_EMAIL, missing).error, /no email address/, String(missing));
});

test("a template's made-up value is recognised, and only that: zeros for Notion, your-name/your-repo for GitHub", async () => {
  const { isExampleTarget, EXAMPLE_NOTICE } = await import("./composio-actions.js");
  const page = findAction("notion_page");
  const repo = findAction("github_issue");
  for (const same of ["00000000000000000000000000000000", "00000000-0000-0000-0000-000000000000", " 00000000000000000000000000000000 "]) assert.equal(isExampleTarget(page, same), true, same);
  for (const real of ["0123456789abcdef0123456789abcdef", "00000000000000000000000000000001", "", undefined]) assert.equal(isExampleTarget(page, real), false, String(real));
  assert.equal(isExampleTarget(repo, "your-name/your-repo"), true);
  assert.equal(isExampleTarget(repo, "Your-Name/Your-Repo"), true);
  assert.equal(isExampleTarget(repo, "acme/website"), false);
  for (const other of ["slack_message", "gmail_send", "calendar_event", "todoist_task"]) assert.equal(isExampleTarget(findAction(other), "00000000000000000000000000000000"), false, `${other} has no example value`);
  assert.match(EXAMPLE_NOTICE, /change it to your own/);
});

test("when an app refuses an action, the person gets one of our own sentences that says what to check, and the app's own words are never shown", async () => {
  const { explainFailure } = await import("./composio.js");
  const cases = [
    ["No connected account found for user", "notConnected"], ["Could not find page with ID: 000", "notFound"], ["object_not_found", "notFound"], ["Not Found (404)", "notFound"],
    ["Forbidden", "forbidden"], ["Insufficient permissions to create pages", "forbidden"], ["Access denied: page not shared with integration", "forbidden"],
    ["body failed validation: parent_id is not a valid UUID", "invalid"], ["Bad request", "invalid"], ["Unauthorized", "notConnected"],
    ["weird SECRET text", "failed"], ["", "failed"], [undefined, "failed"], [{ nested: "object" }, "failed"],
  ];
  for (const [said, key] of cases) {
    const sentence = explainFailure(said);
    assert.equal(sentence, COMPOSIO_FAILED[key], `${String(said)} -> ${key}`);
    assert.ok(!sentence.includes("SECRET"), "the app's words are never echoed");
  }
  for (const key of ["notFound", "forbidden", "invalid"]) assert.ok(COMPOSIO_FAILED[key].length > 40, key);
});


// ---- a lookup that needs a typed channel: Slack messages ----
test("parseAppAddress: 'stripe' and 'slackmessages:general' work, anything half-written or odd is refused (nothing is guessed)", async () => {
  const { parseAppAddress } = await import("./composio-apps.js");
  assert.equal(parseAppAddress("stripe").app.id, "stripe");
  assert.equal(parseAppAddress(" Stripe ").app.id, "stripe");
  assert.equal(parseAppAddress("stripeinvoices").app.lookupOf, "stripe");
  assert.deepEqual([parseAppAddress("slackmessages:general").app.id, parseAppAddress("slackmessages:general").input], ["slackmessages", "general"]);
  assert.equal(parseAppAddress("SlackMessages:#general").input, "general", "a # in front is dropped");
  assert.equal(parseAppAddress("slackmessages:C0123ABCD").input, "C0123ABCD", "an id keeps its capital letters");
  for (const bad of ["slackmessages", "slackmessages:", "slackmessages:bad channel", "slackmessages:a/b", "stripe:x", "nope", "", "__proto__", "slackmessages:" + "a".repeat(81), 5, null, undefined]) assert.equal(parseAppAddress(bad), null, String(bad));
});

test("Slack messages: the channel name is looked up in the person's own channel list, then ONE history read for that channel; answers of different shapes are understood", async () => {
  const { findComposioApp } = await import("./composio-apps.js");
  const { runChannelMessages, findChannelId, messageLines } = await import("./composio.js");
  const app = findComposioApp("slackmessages");
  const calls = [];
  const fetchImpl = async (url, init) => {
    const path = new URL(url).pathname.replace("/api/v3.1", "");
    calls.push({ path, body: init.body ? JSON.parse(init.body) : undefined });
    const ok = (data) => ({ ok: true, status: 200, json: async () => ({ successful: true, data }), text: async () => "" });
    if (path === "/tools/execute/SLACK_LIST_ALL_CHANNELS") return ok({ response_data: { channels: [{ id: "C1AAAAAAA", name: "random" }, { id: "C0123ABCD", name: "General" }] } });
    if (path === "/tools/execute/SLACK_FETCH_CONVERSATION_HISTORY") return ok({ messages: [{ ts: "1792800000.000100", user: "U1", text: "Deploy at 5" }, { ts: "1792800100.0", username: "bot", text: "Done <script>" }, { type: "x" }] });
    return { ok: false, status: 404, json: async () => ({}), text: async () => "" };
  };
  const result = await runChannelMessages({ key: "ak_k", userId: "u1", app, channel: "general", fetchImpl });
  assert.equal(result.ok, true);
  assert.match(result.text, /U1: Deploy at 5\n.*bot: Done <script>/);
  assert.deepEqual(calls.map((c) => c.path), ["/tools/execute/SLACK_LIST_ALL_CHANNELS", "/tools/execute/SLACK_FETCH_CONVERSATION_HISTORY"]);
  assert.deepEqual(calls[1].body, { user_id: "u1", arguments: { channel: "C0123ABCD", limit: 10 } });
  calls.length = 0;
  await runChannelMessages({ key: "ak_k", userId: "u1", app, channel: "C0123ABCD", fetchImpl });
  assert.deepEqual(calls.map((c) => c.path), ["/tools/execute/SLACK_FETCH_CONVERSATION_HISTORY"], "an id needs no lookup");
  const missing = await runChannelMessages({ key: "ak_k", userId: "u1", app, channel: "nope", fetchImpl });
  assert.equal(missing.ok, false);
  assert.match(missing.error, /could not find a Slack channel called nope/);
  assert.equal(findChannelId({ a: [{ id: "lower", name: "general" }] }, "general"), "", "an id must look like a Slack id");
  assert.deepEqual(messageLines("nothing"), []);
  const refused = await runChannelMessages({ key: "ak_k", userId: "u1", app, channel: "C0123ABCD", fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ successful: false, error: "missing_scope: channels:history" }), text: async () => "" }) });
  assert.equal(refused.ok, false);
  assert.ok(refused.error.length > 20);
});


// ---- Google files and a Gmail draft (sheet, slides, doc, folder), all through the same list ----
const SHEET_ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcdef";
const SHEET_LINK = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`;
const SHEET_MADE = { successful: true, data: { response_data: { spreadsheetId: SHEET_ID, spreadsheetUrl: SHEET_LINK } } };
const SHEET_FIRST = { input_parameters: { title: {}, folder_id: {} } };
const SHEET_SECOND = { input_parameters: { spreadsheet_id: { required: true }, range: { required: true }, values: { required: true }, value_input_option: { required: true }, major_dimension: {} } };

// A pretend Composio that knows several tools: `tools` maps a slug to { described, answer }; every request is remembered.
function pretendTools(tools) {
  const sent = [];
  const fetchImpl = async (url, init) => {
    const path = new URL(url).pathname.replace("/api/v3.1", "");
    sent.push({ method: init.method, path, body: init.body ? JSON.parse(init.body) : undefined });
    const described = path.match(/^\/tools\/([A-Z0-9_]+)$/);
    if (described) return tools[described[1]] ? json(tools[described[1]].described) : json({}, 404);
    const slug = path.match(/^\/tools\/execute\/([A-Z0-9_]+)$/)?.[1];
    const answer = tools[slug]?.answer;
    if (answer === "drop") throw new TypeError("fetch failed");
    return json(answer ?? { successful: true, data: {} });
  };
  return { fetchImpl, sent, runs: () => sent.filter((entry) => entry.method === "POST").map((entry) => entry.path.replace("/tools/execute/", "")) };
}

test("the rows of a sheet: one row per line, boxes split on | or commas, rulers and empty lines skipped, and cut to 50 rows x 10 boxes x 200 characters", () => {
  assert.deepEqual(parseRows("Name | Amount\nAna | 10\n\nBen | 20"), { rows: [["Name", "Amount"], ["Ana", "10"], ["Ben", "20"]], columns: 2, cut: false });
  assert.deepEqual(parseRows("a, b, c\nd,e").rows, [["a", "b", "c"], ["d", "e"]], "commas when a line has no |");
  assert.deepEqual(parseRows("| Name | Amount |\n|---|:---:|\n| Ana | 10 |").rows, [["Name", "Amount"], ["Ana", "10"]], "a Markdown table works and its ruler is not a row");
  assert.deepEqual(parseRows("a | b, c").rows, [["a", "b, c"]], "a | on the line wins over commas");
  for (const none of ["", "  \n \n", null, undefined, "---"]) assert.deepEqual(parseRows(none).rows, [], String(none));
  const big = parseRows(Array.from({ length: 80 }, (_, row) => Array.from({ length: 14 }, (__, box) => `r${row}b${box}`).join("|")).join("\n"));
  assert.equal(big.rows.length, 50);
  assert.equal(big.columns, 10);
  assert.equal(big.cut, true);
  assert.equal(parseRows("x".repeat(500)).rows[0][0].length, 200);
  assert.equal(parseRows(Array.from({ length: 50 }, () => "a|b").join("\n")).cut, false, "exactly 50 rows is not cut");
  assert.equal(findAction("sheet_create").preview({ details: "a|b\nc|d" }), "2 rows of up to 2 boxes will be written into one new spreadsheet, as plain text.");
  assert.match(findAction("sheet_create").preview({ details: Array.from({ length: 60 }, () => "a").join("\n") }), /Rows after 50 and boxes after 10 are left out/);
});

test("the slides of a presentation: a '# ' line starts a slide, other lines are its bullets, up to 12 slides; the Markdown holds no picture, quote or ruler from the words", () => {
  const parsed = parseOutline("Pitch", "# Why\n- Fast\n* Cheap\n• Safe\n# Price\nFrom 10 dollars");
  assert.deepEqual(parsed, { slides: [{ heading: "Why", bullets: ["Fast", "Cheap", "Safe"] }, { heading: "Price", bullets: ["From 10 dollars"] }], cut: false });
  assert.deepEqual(parseOutline("Pitch", "Just words").slides, [{ heading: "Pitch", bullets: ["Just words"] }], "words before any # go on a first slide named after the presentation");
  assert.deepEqual(parseOutline("Pitch", "").slides, [{ heading: "Pitch", bullets: [] }], "an empty outline is still one title slide");
  const many = parseOutline("Deck", Array.from({ length: 20 }, (_, n) => `# Slide ${n}\n- a`).join("\n"));
  assert.equal(many.slides.length, 12);
  assert.equal(many.cut, true);
  assert.equal(parseOutline("Deck", "# S\n" + Array.from({ length: 30 }, (_, n) => `- b${n}`).join("\n")).slides[0].bullets.length, 10);
  assert.equal(outlineToMarkdown("Pitch", "# Why\n- Fast\n- Cheap\n# Price\n- Low"), "# Why\nFast\nCheap\n\n---\n\n# Price\n- Low", "the first slide is the title slide, the others have bullets");
  const sneaky = outlineToMarkdown("Deck", "# Hello\n# ![x](https://evil.example/a.png)\n- ![pic](https://evil.example/b.png)\n- ---\n- > quote |||");
  assert.ok(!sneaky.includes("!["), "no picture can be pulled in");
  assert.equal(sneaky.split("\n\n---\n\n").length, 2, "only our own separators make slides");
  assert.match(findAction("slides_create").preview({ title: "Pitch", details: "# Why\n- a\n# Price\n- b" }), /^2 slides will be made: "Why", "Price"\.$/);
});

test("a Gmail draft: the same boxes as an email, {myEmail} allowed, and its own tool (which creates a draft and cannot send)", () => {
  const draft = findAction("gmail_draft");
  assert.equal(draft.tool, "GMAIL_CREATE_EMAIL_DRAFT");
  assert.equal(draft.app, "gmailsend", "it uses the Gmail (send) sign-in");
  assert.deepEqual(checkTarget(draft, "{myEmail}"), { value: "{myEmail}" });
  assert.deepEqual(checkTarget(draft, "a@b.co"), { value: "a@b.co" });
  for (const bad of ["", "arjun", "a@b", "a@c.com\nbcc:x@y.com"]) assert.ok(checkTarget(draft, bad).error, bad);
  const inputs = readToolInputs({ input_parameters: { recipient_email: {}, subject: {}, body: {}, is_html: {}, cc: {} } });
  assert.deepEqual(buildArguments(draft, { target: "a@b.co", title: "Hello", details: "Dear Ana" }, inputs).arguments, { recipient_email: "a@b.co", subject: "Hello", body: "Dear Ana" });
  assert.deepEqual(buildArguments(draft, { target: "a@b.co", title: "Hello", details: "" }, inputs).arguments, { recipient_email: "a@b.co", subject: "Hello", body: "Hello" });
  assert.match(draft.done({ target: "a@b.co" }), /nothing was sent/);
  assert.ok(!allowedTools(findComposioApp("gmailsend")).some((tool) => /SEND_DRAFT|REPLY/.test(tool)), "nothing that sends a draft is allowed");
});

test("a Google Doc and a Drive folder: one call each, the words go to the tool's own boxes, the folder's parent is optional and plain", () => {
  const doc = findAction("doc_create");
  assert.deepEqual(buildArguments(doc, { target: "", title: "Notes", details: "Line one\nLine two" }, readToolInputs({ input_parameters: { title: { required: true }, text: {} } })).arguments, { title: "Notes", text: "Line one\nLine two" });
  assert.deepEqual(buildArguments(doc, { target: "", title: "Notes", details: "" }, readToolInputs({ input_parameters: { title: { required: true }, text: {} } })).arguments, { title: "Notes" }, "no text: an empty document with the name");
  assert.ok(buildArguments(doc, { target: "", title: "Notes", details: "x" }, readToolInputs({ input_parameters: { title: { required: true } } })).error, "no place for the text: nothing is sent");
  assert.equal(doc.then, undefined);
  assert.equal(checkTarget(doc, "").value, "");
  assert.ok(checkTarget(doc, "somewhere").error, "a doc has no place to type");

  const folder = findAction("drive_folder_create");
  assert.deepEqual(checkTarget(folder, ""), { value: "" }, "empty = the top of the Drive");
  assert.deepEqual(checkTarget(folder, "1AbCdEfGhIjKlMnOp"), { value: "1AbCdEfGhIjKlMnOp" });
  for (const bad of ["short", "has space in it 12345", "../../etc/passwd", "https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOp", "1AbCdEfGhIjKlMnOp\nx"]) assert.ok(checkTarget(folder, bad).error, bad);
  const inputs = readToolInputs({ input_parameters: { name: { required: true }, parent_id: {} } });
  assert.deepEqual(buildArguments(folder, { target: "", title: "Invoices 2026", details: "" }, inputs).arguments, { name: "Invoices 2026" });
  assert.deepEqual(buildArguments(folder, { target: "1AbCdEfGhIjKlMnOp", title: "Invoices 2026", details: "" }, inputs).arguments, { name: "Invoices 2026", parent_id: "1AbCdEfGhIjKlMnOp" });
  assert.equal(folder.noDetails, true);
});

test("a Google Sheet and a presentation: the arguments of the first call, and of the sheet's second call (rows as plain text from A1)", () => {
  const sheet = findAction("sheet_create");
  const values = { target: "", title: "Weekly report", details: "Name | Amount\nAna | 10" };
  assert.deepEqual(buildArguments(sheet, values, readToolInputs(SHEET_FIRST)).arguments, { title: "Weekly report" });
  const second = buildArguments(sheet.then, values, readToolInputs(SHEET_SECOND), { id: SHEET_ID });
  assert.deepEqual(second.arguments, { spreadsheet_id: SHEET_ID, range: "A1", values: [["Name", "Amount"], ["Ana", "10"]], value_input_option: "RAW" });
  assert.equal(sheet.then.when(values), true);
  assert.equal(sheet.then.when({ ...values, details: "" }), false, "no rows: only the empty spreadsheet is made");
  assert.ok(buildArguments(sheet.then, values, readToolInputs({ input_parameters: { ...SHEET_SECOND.input_parameters, owner_token: { required: true } } }), { id: SHEET_ID }).error, "an input we do not fill in is required: nothing is sent");
  assert.ok(buildArguments(sheet.then, values, readToolInputs(SHEET_SECOND), {}).error, "without the new file's id the second call cannot be built");
  assert.deepEqual(allowedTools(findComposioApp("gsheets")), ["GOOGLESHEETS_SEARCH_SPREADSHEETS", "GOOGLESHEETS_CREATE_GOOGLE_SHEET1", "GOOGLESHEETS_VALUES_UPDATE"], "the second tool is allowed at Composio too");

  const slides = findAction("slides_create");
  assert.deepEqual(buildArguments(slides, { target: "", title: "Pitch", details: "# Why\n- Fast" }, readToolInputs({ input_parameters: { title: { required: true }, markdown_text: { required: true } } })).arguments, { title: "Pitch", markdown_text: "# Why\nFast" });
  assert.deepEqual(buildArguments(slides, { target: "", title: "Pitch", details: "" }, readToolInputs({ input_parameters: { title: { required: true }, markdown_text: { required: true } } })).arguments, { title: "Pitch", markdown_text: "# Pitch" }, "even an empty outline gives a title slide");
  assert.deepEqual(allowedTools(findComposioApp("gslides")), ["GOOGLESLIDES_CREATE_SLIDES_MARKDOWN"], "Google Slides has no lookup: only its create tool is allowed");
  assert.deepEqual(allowedTools(findComposioApp("gdocs")), ["GOOGLEDOCS_SEARCH_DOCUMENTS", "GOOGLEDOCS_CREATE_DOCUMENT"]);
  assert.deepEqual(allowedTools(findComposioApp("gdrivewrite")), ["GOOGLEDRIVE_GET_ABOUT", "GOOGLEDRIVE_CREATE_FOLDER"]);
});

test("the made file's id and address are found in differently shaped answers, and only a docs.google.com or drive.google.com address is ever kept", () => {
  assert.deepEqual(findCreated(SHEET_MADE.data), { id: SHEET_ID, link: SHEET_LINK });
  assert.deepEqual(findCreated({ spreadsheet_id: SHEET_ID }), { id: SHEET_ID, link: "" });
  assert.deepEqual(findCreated({ webViewLink: "https://drive.google.com/drive/folders/" + SHEET_ID + "." }), { id: SHEET_ID, link: "https://drive.google.com/drive/folders/" + SHEET_ID }, "the id comes from the address when nothing else has it; a trailing dot is dropped");
  assert.deepEqual(findCreated({ documentId: SHEET_ID, note: `Open it at ${"https://docs.google.com/document/d/" + SHEET_ID + "/edit"} now` }).link, "https://docs.google.com/document/d/" + SHEET_ID + "/edit", "an address inside a sentence");
  for (const evil of ["https://evil.example/https", "https://docs.google.com.evil.example/x", "https://docs.google.com@evil.example/x", "http://docs.google.com/x", "javascript:alert(1)", "https://drive.google.com.evil.example/", "ftp://docs.google.com/x"]) assert.equal(findCreated({ url: evil }).link, "", evil);
  for (const nothing of [null, undefined, "text", 5, [], {}]) assert.deepEqual(findCreated(nothing), { id: "", link: "" }, String(nothing));
  assert.equal(findCreated({ id: "short" }).id, "", "an id must look like a Google file id");
});

test("a sheet takes TWO calls: the tools are looked at first, the sheet is made, then the rows are written into it, and the answer carries the link", async () => {
  const pretend = pretendTools({ GOOGLESHEETS_CREATE_GOOGLE_SHEET1: { described: SHEET_FIRST, answer: SHEET_MADE }, GOOGLESHEETS_VALUES_UPDATE: { described: SHEET_SECOND } });
  const result = await runActionTool({ key: "k", userId: "u-1", action: findAction("sheet_create"), values: { target: "", title: "Weekly report", details: "Name | Amount\nAna | 10" }, fetchImpl: pretend.fetchImpl });
  assert.equal(result.ok, true);
  assert.equal(result.link, SHEET_LINK);
  assert.equal(result.note, undefined);
  assert.deepEqual(pretend.sent.map((entry) => `${entry.method} ${entry.path}`), [
    "GET /tools/GOOGLESHEETS_CREATE_GOOGLE_SHEET1", "GET /tools/GOOGLESHEETS_VALUES_UPDATE", "POST /tools/execute/GOOGLESHEETS_CREATE_GOOGLE_SHEET1", "POST /tools/execute/GOOGLESHEETS_VALUES_UPDATE",
  ]);
  assert.deepEqual(pretend.sent[2].body, { user_id: "u-1", arguments: { title: "Weekly report" } });
  assert.deepEqual(pretend.sent[3].body, { user_id: "u-1", arguments: { spreadsheet_id: SHEET_ID, range: "A1", values: [["Name", "Amount"], ["Ana", "10"]], value_input_option: "RAW" } });
});

test("a sheet with no rows is only the empty spreadsheet (one call); a sheet whose second tool does not fit makes NOTHING", async () => {
  const empty = pretendTools({ GOOGLESHEETS_CREATE_GOOGLE_SHEET1: { described: SHEET_FIRST, answer: SHEET_MADE } });
  assert.equal((await runActionTool({ key: "k", userId: "u", action: findAction("sheet_create"), values: { target: "", title: "Empty", details: "" }, fetchImpl: empty.fetchImpl })).ok, true);
  assert.deepEqual(empty.runs(), ["GOOGLESHEETS_CREATE_GOOGLE_SHEET1"]);

  const odd = pretendTools({ GOOGLESHEETS_CREATE_GOOGLE_SHEET1: { described: SHEET_FIRST, answer: SHEET_MADE }, GOOGLESHEETS_VALUES_UPDATE: { described: { input_parameters: { spreadsheet_id: { required: true }, cells: { required: true } } } } });
  assert.deepEqual(await runActionTool({ key: "k", userId: "u", action: findAction("sheet_create"), values: { target: "", title: "x", details: "a|b" }, fetchImpl: odd.fetchImpl }), { ok: false, error: COMPOSIO_FAILED.cannotFill });
  assert.deepEqual(odd.runs(), [], "the second tool does not fit, so the spreadsheet was not even created");

  const missing = pretendTools({ GOOGLESHEETS_CREATE_GOOGLE_SHEET1: { described: SHEET_FIRST, answer: SHEET_MADE } });
  const gone = await runActionTool({ key: "k", userId: "u", action: findAction("sheet_create"), values: { target: "", title: "x", details: "a|b" }, fetchImpl: missing.fetchImpl });
  assert.equal(gone.ok, false);
  assert.deepEqual(missing.runs(), [], "an unknown second tool also creates nothing");
});

test("a sheet that was made but could not be filled is told honestly: ok with a note and the link, never retried, never a second sheet", async () => {
  const wrong = { successful: false, error: "Forbidden: insufficient permissions" };
  for (const [answer, why] of [[wrong, /not allowed to do that/], ["drop", /Could not reach Composio/], [{ successful: true, data: {} }, null]]) {
    const pretend = pretendTools({ GOOGLESHEETS_CREATE_GOOGLE_SHEET1: { described: SHEET_FIRST, answer: SHEET_MADE }, GOOGLESHEETS_VALUES_UPDATE: { described: SHEET_SECOND, answer } });
    const result = await runActionTool({ key: "k", userId: "u", action: findAction("sheet_create"), values: { target: "", title: "x", details: "a|b" }, fetchImpl: pretend.fetchImpl });
    assert.equal(result.ok, true, "the file exists, so this is not a failure");
    assert.equal(result.link, SHEET_LINK);
    assert.deepEqual(pretend.runs(), ["GOOGLESHEETS_CREATE_GOOGLE_SHEET1", "GOOGLESHEETS_VALUES_UPDATE"], "one sheet, one try at the rows");
    if (why) {
      assert.match(result.note, /^The spreadsheet was created, but its rows may not have been added\./);
      assert.match(result.note, why);
      assert.match(result.note, /will not try again by itself/);
    } else assert.equal(result.note, undefined);
  }
  // the first answer holds no id: the sheet exists but nothing can be written into it
  const noId = pretendTools({ GOOGLESHEETS_CREATE_GOOGLE_SHEET1: { described: SHEET_FIRST, answer: { successful: true, data: { ok: true } } }, GOOGLESHEETS_VALUES_UPDATE: { described: SHEET_SECOND } });
  const lost = await runActionTool({ key: "k", userId: "u", action: findAction("sheet_create"), values: { target: "", title: "x", details: "a|b" }, fetchImpl: noId.fetchImpl });
  assert.equal(lost.ok, true);
  assert.match(lost.note, /could not find the new file's id/);
  assert.deepEqual(noId.runs(), ["GOOGLESHEETS_CREATE_GOOGLE_SHEET1"]);
  // the FIRST call failing is an ordinary failure (nothing was made)
  const refused = pretendTools({ GOOGLESHEETS_CREATE_GOOGLE_SHEET1: { described: SHEET_FIRST, answer: wrong }, GOOGLESHEETS_VALUES_UPDATE: { described: SHEET_SECOND } });
  assert.equal((await runActionTool({ key: "k", userId: "u", action: findAction("sheet_create"), values: { target: "", title: "x", details: "a|b" }, fetchImpl: refused.fetchImpl })).ok, false);
  assert.deepEqual(refused.runs(), ["GOOGLESHEETS_CREATE_GOOGLE_SHEET1"], "the rows are not written when the sheet was not made");
});

test("test all my connections checks BOTH tools of a two-call action, and an app with no lookup is not asked to look anything up", async () => {
  const { checkActionFits, checkComposioConnections } = await import("./composio.js");
  const good = pretendTools({ GOOGLESHEETS_CREATE_GOOGLE_SHEET1: { described: SHEET_FIRST }, GOOGLESHEETS_VALUES_UPDATE: { described: SHEET_SECOND } });
  assert.deepEqual(await checkActionFits({ key: "k", action: findAction("sheet_create"), sample: { target: "", title: "Test", details: "Test" }, fetchImpl: good.fetchImpl }), { ok: true });
  const bad = pretendTools({ GOOGLESHEETS_CREATE_GOOGLE_SHEET1: { described: SHEET_FIRST }, GOOGLESHEETS_VALUES_UPDATE: { described: { input_parameters: { spreadsheet_id: { required: true } } } } });
  assert.equal((await checkActionFits({ key: "k", action: findAction("sheet_create"), sample: { target: "", title: "Test", details: "Test" }, fetchImpl: bad.fetchImpl })).ok, false);
  assert.equal(good.sent.filter((entry) => entry.method === "POST").length, 0, "nothing is ever run by the check");

  const slidesOnly = pretendTools({ GOOGLESLIDES_CREATE_SLIDES_MARKDOWN: { described: { input_parameters: { title: { required: true }, markdown_text: { required: true } } } } });
  const fetchImpl = async (url, init) => {
    const path = new URL(url).pathname;
    if (path.endsWith("/connected_accounts")) return json({ items: [{ id: "ca_1", toolkit: { slug: "googleslides" } }] });
    return slidesOnly.fetchImpl(url, init);
  };
  const rows = await checkComposioConnections({ key: "k", userId: "u", fetchImpl });
  assert.deepEqual(rows.rows.map((row) => [row.name, row.ok]), [["Google Slides (create)", true]]);
  assert.deepEqual(rows.rows[0].actions.map((action) => action.ok), [true]);
  assert.deepEqual(slidesOnly.runs(), [], "no tool was run: Google Slides has no lookup and the action is only checked");
});
