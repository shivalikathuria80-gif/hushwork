// Google files through Composio (a sheet, a presentation, a document, a Drive folder, a Gmail draft), tested by RUNNING the real server code (lib/run-core.js) against
// a pretend database and a pretend Composio. The promises: each is made exactly once after the Approve, a second Approve is refused, a dropped connection leaves it
// UNKNOWN (never sent again by itself), a sheet that was made but not filled is told honestly and never made twice, the "changed since you read it" guard and the
// pause switch stop it, and a sensitive-looking text is refused.
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { makeFakeSupabase, fakeComposio } from "./test-server-support.js";
import { finishSteps } from "./ai/plan.js";

process.env["COMPOSIO" + "_API_KEY"] = "ak_test_key_not_real";
process.env["GROQ" + "_API_KEY"] = "gsk_test_key_not_real";
const { startPracticeRun, resumeRun, approveActionStep, approveAiStep } = await import("./run-core.js");
const { actionSummary } = await import("./run-engine.js");

const trigger = { icon: "Zap", title: "Start", detail: "x", block: "trigger", choice: "manual", a: "", b: "" };
const ask = { icon: "Sparkles", title: "Ask the AI", detail: "x", block: "ai", choice: "nothing", a: "Write the rows.", b: "" };
const make = (choice, title, a = "", detail = "{answer}") => ({ icon: "FileText", title: "Make it", detail, block: "action", choice, a, b: title });
const planWith = (action) => finishSteps({ steps: [trigger, ask, action] });
const actionIndex = (plan) => plan.findIndex((step) => step.kind === "action");

function setup(plan) {
  const user = randomUUID();
  const workflow = randomUUID();
  const supabase = makeFakeSupabase({ asUser: user, workflows: [{ id: workflow, user_id: user, name: "Google file", plan }] });
  return { user, workflow, supabase, who: { user: { id: user, email: "me@example.com" }, supabase } };
}
const posts = (composio) => composio.calls.filter((call) => call.method === "POST" && call.path.startsWith("/tools/execute/")).map((call) => call.path.replace("/tools/execute/", ""));
const bodyOf = (composio, slug) => composio.calls.find((call) => call.method === "POST" && call.path === `/tools/execute/${slug}`)?.body.arguments;
const history = (supabase, runId, index) => supabase.tables.runs.filter((row) => row.mode === "live" && row.results[0].from === runId && row.results[0].fromStep === index && !row.results[0].note).map((row) => row.results[0].status);
const lastOutcome = (supabase, runId, index) => supabase.tables.runs.filter((row) => row.mode === "live" && row.results[0].from === runId && row.results[0].fromStep === index && !row.results[0].note).at(-1).results[0].outcome;

const SHEET_ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcdef";
const LINK = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`;
const SHEET_TOOLS = {
  GOOGLESHEETS_CREATE_GOOGLE_SHEET1: { inputs: { title: {}, folder_id: {} }, answer: { successful: true, data: { spreadsheetId: SHEET_ID, spreadsheetUrl: LINK } } },
  GOOGLESHEETS_VALUES_UPDATE: { inputs: { spreadsheet_id: { required: true }, range: { required: true }, values: { required: true }, value_input_option: { required: true } }, answer: { successful: true, data: {} } },
};
const ROWS = "Date | Customer | Amount\n2026-10-20 | Ana | 120\n2026-10-21 | Ben | 80";
const sheetPlan = () => planWith(make("sheet_create", "Weekly report"));
const withSheet = (overrides = {}) => ({ GOOGLESHEETS_CREATE_GOOGLE_SHEET1: { ...SHEET_TOOLS.GOOGLESHEETS_CREATE_GOOGLE_SHEET1, ...overrides.create }, GOOGLESHEETS_VALUES_UPDATE: { ...SHEET_TOOLS.GOOGLESHEETS_VALUES_UPDATE, ...overrides.fill } });

test("AI writes the rows, you approve, the sheet is made ONCE and filled with exactly those rows; the result holds the link; a second Approve is refused", async () => {
  const plan = sheetPlan();
  const { workflow, supabase, who, user } = setup(plan);
  const index = actionIndex(plan);
  const composio = fakeComposio(withSheet(), { groq: [ROWS] });
  try {
    const first = await startPracticeRun({ id: workflow, auto: true }, who);
    assert.deepEqual(first.auto, { done: 2, stoppedAt: 0 });
    assert.deepEqual(posts(composio), ["GOOGLESHEETS_CREATE_GOOGLE_SHEET1", "GOOGLESHEETS_VALUES_UPDATE"], "make the sheet, then fill it, nothing else");
    assert.deepEqual(bodyOf(composio, "GOOGLESHEETS_CREATE_GOOGLE_SHEET1"), { title: "Weekly report" });
    assert.deepEqual(bodyOf(composio, "GOOGLESHEETS_VALUES_UPDATE"), { spreadsheet_id: SHEET_ID, range: "A1", value_input_option: "RAW", values: [["Date", "Customer", "Amount"], ["2026-10-20", "Ana", "120"], ["2026-10-21", "Ben", "80"]] });
    assert.equal(composio.calls.find((call) => call.path === "/tools/execute/GOOGLESHEETS_VALUES_UPDATE").body.user_id, user, "for this person's own connection");
    assert.deepEqual(history(supabase, first.runId, index), ["pending", "done"], "a started record BEFORE the call, then the finished one");
    assert.match(lastOutcome(supabase, first.runId, index), /^Created a Google Sheet: Weekly report\nhttps:\/\/docs\.google\.com\/spreadsheets\/d\//);
    const again = await approveActionStep({ runId: first.runId, index }, who);
    assert.match(again.error, /already/i);
    assert.deepEqual(posts(composio).length, 2, "no second sheet");
  } finally { composio.restore(); }
});

test("a dropped connection while making the sheet leaves it UNKNOWN: Resume and Approve do not make it again, and nothing is written into a sheet nobody saw", async () => {
  const plan = sheetPlan();
  const { workflow, supabase, who } = setup(plan);
  const index = actionIndex(plan);
  const composio = fakeComposio(withSheet({ create: { answer: ["drop", SHEET_TOOLS.GOOGLESHEETS_CREATE_GOOGLE_SHEET1.answer] } }), { groq: [ROWS] });
  try {
    const first = await startPracticeRun({ id: workflow, auto: true }, who);
    assert.match(first.auto.reason, /could not tell whether it went through/);
    assert.deepEqual(posts(composio), ["GOOGLESHEETS_CREATE_GOOGLE_SHEET1"], "one try, it dropped, the rows were not written");
    assert.equal(history(supabase, first.runId, index)[0], "pending", "it was recorded as started before the call");
    assert.ok(!history(supabase, first.runId, index).includes("done"), "and it is not recorded as done");
    const resumed = await resumeRun({ runId: first.runId }, who);
    assert.match(resumed.auto.reason, /never saw whether it finished/);
    const approved = await approveActionStep({ runId: first.runId, index }, who);
    assert.equal(approved.pending, true);
    assert.deepEqual(posts(composio), ["GOOGLESHEETS_CREATE_GOOGLE_SHEET1"], "still exactly one try");
    const retried = await approveActionStep({ runId: first.runId, index, confirmRetry: true }, who);
    assert.equal(retried.error, undefined, "only after 'it was not done' is it made once more");
    assert.deepEqual(posts(composio), ["GOOGLESHEETS_CREATE_GOOGLE_SHEET1", "GOOGLESHEETS_CREATE_GOOGLE_SHEET1", "GOOGLESHEETS_VALUES_UPDATE"]);
    assert.match((await approveActionStep({ runId: first.runId, index, confirmRetry: true }, who)).error, /already/i, "done is done");
    assert.equal(posts(composio).length, 3);
  } finally { composio.restore(); }
});

test("a sheet that was made but could not be filled is recorded as DONE with an honest note and the link, and nothing makes a second sheet or fills it again", async () => {
  const plan = sheetPlan();
  const { workflow, supabase, who } = setup(plan);
  const index = actionIndex(plan);
  const composio = fakeComposio(withSheet({ fill: { answer: { successful: false, error: "Forbidden: insufficient permissions" } } }), { groq: [ROWS] });
  try {
    const first = await startPracticeRun({ id: workflow, auto: true }, who);
    assert.deepEqual(first.auto, { done: 2, stoppedAt: 0 }, "the file exists, so the step is done");
    assert.deepEqual(history(supabase, first.runId, index), ["pending", "done"]);
    const outcome = lastOutcome(supabase, first.runId, index);
    assert.match(outcome, /^Created a Google Sheet: Weekly report\nhttps:\/\/docs\.google\.com\/spreadsheets\/d\//);
    assert.match(outcome, /Heads up: The spreadsheet was created, but its rows may not have been added\./);
    assert.match(outcome, /will not try again by itself/);
    const again = await approveActionStep({ runId: first.runId, index, confirmRetry: true }, who);
    assert.match(again.error, /already/i);
    const resumed = await resumeRun({ runId: first.runId }, who);
    assert.equal(resumed.auto.done, 0);
    assert.deepEqual(posts(composio), ["GOOGLESHEETS_CREATE_GOOGLE_SHEET1", "GOOGLESHEETS_VALUES_UPDATE"], "one sheet, one try at the rows, ever");
  } finally { composio.restore(); }
});

test("the card shows the rows and how many; a sheet is NOT made when the words changed after the card was read, but a matching card sends", async () => {
  const plan = sheetPlan();
  const { workflow, supabase, who } = setup(plan);
  const index = actionIndex(plan);
  const composio = fakeComposio(withSheet(), { groq: ["a | b", "a | b\nc | d\ne | f"] });
  try {
    const first = await startPracticeRun({ id: workflow, auto: false }, who);
    assert.equal((await approveAiStep({ runId: first.runId, index: 1 }, who)).error, undefined);
    const card = actionSummary(plan[index], "a | b", [], "me@example.com");
    assert.match(card, /Spreadsheet name: Weekly report/);
    assert.match(card, /Rows \(one per line\): a \| b/);
    assert.match(card, /1 row of up to 2 boxes will be written into one new spreadsheet, as plain text\./);
    assert.equal((await approveAiStep({ runId: first.runId, index: 1 }, who)).error, undefined, "the AI step is approved again and now says something else");
    const stale = await approveActionStep({ runId: first.runId, index, seen: card }, who);
    assert.equal(stale.changed, true);
    assert.match(stale.error, /changed after you opened this page/);
    assert.deepEqual(posts(composio), [], "nothing was made");
    assert.deepEqual(history(supabase, first.runId, index), [], "and nothing was recorded as started");
    const fresh = await approveActionStep({ runId: first.runId, index, seen: actionSummary(plan[index], "a | b\nc | d\ne | f", [], "me@example.com") }, who);
    assert.equal(fresh.error, undefined);
    assert.equal(bodyOf(composio, "GOOGLESHEETS_VALUES_UPDATE").values.length, 3);
  } finally { composio.restore(); }
});

test("while Hushwork is paused no sheet is made and nothing is recorded as started; unpausing brings it back", async () => {
  const plan = sheetPlan();
  const { workflow, supabase, who } = setup(plan);
  const composio = fakeComposio(withSheet(), { groq: [ROWS] });
  try {
    supabase.tables.app_controls = [{ name: "paused", value: true }];
    const first = await startPracticeRun({ id: workflow, auto: true }, who);
    assert.match(first.auto.reason, /Hushwork is paused right now/);
    assert.deepEqual(posts(composio), []);
    assert.equal(supabase.tables.runs.filter((row) => row.mode === "live" && row.results[0].status === "pending").length, 0);
    supabase.tables.app_controls[0].value = false;
    const again = await resumeRun({ runId: first.runId }, who);
    assert.equal(again.auto.stoppedAt, 0);
    assert.deepEqual(posts(composio), ["GOOGLESHEETS_CREATE_GOOGLE_SHEET1", "GOOGLESHEETS_VALUES_UPDATE"]);
  } finally { composio.restore(); }
});

test("a text that looks like a card number is refused before anything is made", async () => {
  const plan = sheetPlan();
  const { workflow, who } = setup(plan);
  const composio = fakeComposio(withSheet(), { groq: ["Card | 4111 1111 1111 1111"] });
  try {
    const first = await startPracticeRun({ id: workflow, auto: true }, who);
    assert.match(first.auto.reason, /card number or a secret key/);
    assert.deepEqual(posts(composio), []);
  } finally { composio.restore(); }
});

test("the sheet's second tool not fitting makes NOTHING (the check happens before the sheet is created)", async () => {
  const plan = sheetPlan();
  const { workflow, who } = setup(plan);
  const composio = fakeComposio(withSheet({ fill: { inputs: { spreadsheet_id: { required: true }, cells: { required: true } } } }), { groq: [ROWS] });
  try {
    const first = await startPracticeRun({ id: workflow, auto: true }, who);
    assert.match(first.auto.reason, /does not know how to fill in/);
    assert.deepEqual(posts(composio), []);
  } finally { composio.restore(); }
});

// ---- the one-call files: a presentation, a document, a Drive folder, a Gmail draft ----
const CASES = [
  {
    name: "a presentation", action: make("slides_create", "Proposal"), answer: "# Why us\n- Fast\n- Fair\n# Price\n- From 10 dollars",
    tools: { GOOGLESLIDES_CREATE_SLIDES_MARKDOWN: { inputs: { title: { required: true }, markdown_text: { required: true } }, answer: { successful: true, data: { presentationId: SHEET_ID, url: `https://docs.google.com/presentation/d/${SHEET_ID}/edit` } } } },
    slug: "GOOGLESLIDES_CREATE_SLIDES_MARKDOWN", args: { title: "Proposal", markdown_text: "# Why us\nFast\nFair\n\n---\n\n# Price\n- From 10 dollars" },
    outcome: /^Created a Google Slides presentation: Proposal\nhttps:\/\/docs\.google\.com\/presentation\/d\//,
  },
  {
    name: "a document", action: make("doc_create", "Meeting notes"), answer: "Standup\nGoal: ship\nAction: Ana sends the plan",
    tools: { GOOGLEDOCS_CREATE_DOCUMENT: { inputs: { title: { required: true }, text: {} }, answer: { successful: true, data: { id: SHEET_ID, link: `https://docs.google.com/document/d/${SHEET_ID}/edit` } } } },
    slug: "GOOGLEDOCS_CREATE_DOCUMENT", args: { title: "Meeting notes", text: "Standup\nGoal: ship\nAction: Ana sends the plan" },
    outcome: /^Created a Google Doc: Meeting notes\nhttps:\/\/docs\.google\.com\/document\/d\//,
  },
  {
    name: "a Drive folder", action: make("drive_folder_create", "Invoices 2026", "1AbCdEfGhIjKlMnOp", ""), answer: "unused",
    tools: { GOOGLEDRIVE_CREATE_FOLDER: { inputs: { name: { required: true }, parent_id: {} }, answer: { successful: true, data: { id: SHEET_ID, webViewLink: `https://drive.google.com/drive/folders/${SHEET_ID}` } } } },
    slug: "GOOGLEDRIVE_CREATE_FOLDER", args: { name: "Invoices 2026", parent_id: "1AbCdEfGhIjKlMnOp" },
    outcome: /^Created a Google Drive folder inside the folder you named: Invoices 2026\nhttps:\/\/drive\.google\.com\/drive\/folders\//,
  },
  {
    name: "a Gmail draft", action: make("gmail_draft", "Hello Ana", "me"), answer: "Dear Ana,\nHere is the plan.",
    tools: { GMAIL_CREATE_EMAIL_DRAFT: { inputs: { recipient_email: {}, subject: {}, body: {} }, answer: { successful: true, data: { draft_id: "r123" } } }, GMAIL_SEND_EMAIL: { inputs: { recipient_email: { required: true }, body: { required: true } } } },
    slug: "GMAIL_CREATE_EMAIL_DRAFT", args: { recipient_email: "me@example.com", subject: "Hello Ana", body: "Dear Ana,\nHere is the plan." },
    outcome: /^Saved a draft in your Gmail Drafts for me@example\.com \(nothing was sent\): Hello Ana\nDear Ana,/,
  },
];

for (const one of CASES) {
  test(`${one.name}: made exactly once after the Approve with the words you read, the link (if any) is in the result, a second Approve is refused, and it is never sent`, async () => {
    const plan = planWith(one.action);
    const { workflow, supabase, who } = setup(plan);
    const index = actionIndex(plan);
    const composio = fakeComposio(one.tools, { groq: [one.answer] });
    try {
      const first = await startPracticeRun({ id: workflow, auto: true }, who);
      assert.deepEqual(first.auto, { done: 2, stoppedAt: 0 });
      assert.deepEqual(posts(composio), [one.slug], "one request, to the one tool");
      assert.deepEqual(bodyOf(composio, one.slug), one.args);
      assert.deepEqual(history(supabase, first.runId, index), ["pending", "done"]);
      assert.match(lastOutcome(supabase, first.runId, index), one.outcome);
      assert.match((await approveActionStep({ runId: first.runId, index }, who)).error, /already/i);
      assert.deepEqual(posts(composio), [one.slug], "no second copy");
    } finally { composio.restore(); }
  });

  test(`${one.name}: a dropped connection leaves it UNKNOWN and it is never made again by itself`, async () => {
    const plan = planWith(one.action);
    const { workflow, supabase, who } = setup(plan);
    const index = actionIndex(plan);
    const tools = { ...one.tools, [one.slug]: { ...one.tools[one.slug], answer: ["drop", one.tools[one.slug].answer] } };
    const composio = fakeComposio(tools, { groq: [one.answer] });
    try {
      const first = await startPracticeRun({ id: workflow, auto: true }, who);
      assert.match(first.auto.reason, /could not tell whether it went through/);
      const resumed = await resumeRun({ runId: first.runId }, who);
      assert.match(resumed.auto.reason, /never saw whether it finished/);
      const approved = await approveActionStep({ runId: first.runId, index }, who);
      assert.equal(approved.pending, true);
      assert.deepEqual(posts(composio), [one.slug], "exactly one try");
      assert.equal(history(supabase, first.runId, index).at(-1) === "done", false);
    } finally { composio.restore(); }
  });
}

test("a Gmail draft never calls the send tool, and the approval card says it is only a draft", () => {
  const plan = planWith(make("gmail_draft", "Hello Ana", "me"));
  const card = actionSummary(plan[actionIndex(plan)], "Dear Ana", [], "me@example.com");
  assert.match(card, /Save an email as a Gmail draft/);
  assert.match(card, /To: me@example\.com/);
  assert.match(card, /Nothing is sent: you open the draft and send it yourself\./);
});

test("the card of a Drive folder says where it goes, and 'the top of your Drive' when nothing is written; a presentation's card lists its slides", () => {
  const folder = planWith(make("drive_folder_create", "Invoices", "", ""));
  assert.match(actionSummary(folder[actionIndex(folder)]), /Inside folder \(id\): the top of your Drive/);
  const deck = planWith(make("slides_create", "Pitch"));
  assert.match(actionSummary(deck[actionIndex(deck)], "# Why\n- a\n# Price\n- b"), /2 slides will be made: "Why", "Price"\./, "the outline comes from the AI step's answer, one slide per # line");
});
