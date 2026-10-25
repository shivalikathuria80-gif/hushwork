// Tests for typed steps (workflow builder, phase B): the kinds in lib/steps.js and how lib/validate.js checks them.
// Run with `npm test`. Pure code only: no network, no database.
import test from "node:test";
import assert from "node:assert/strict";
import { NOTE, STEP_KINDS, STEP_KIND_ORDER, blankFields, describeStep, isTypedKind, planToSteps, readSavedStep, stepsToPlan } from "./steps.js";
import { BLOCKS, PALETTE_BLOCKS, DESCRIBING_BLOCKS, DRAG_KIND, DRAG_ROW, blockIdFor, blockName, insertRow, moveRow, newRow, newRowForBlock, parseDragKind, rowForKind, toWorking } from "./step-rows.js";
import { plainSteps } from "./update-plan.js";
import { LIMITS, checkSteps, cleanPlan, sameSteps } from "./validate.js";
import { ICON_NAMES } from "./ai/icon-names.js";

const UNREADABLE = "That plan could not be read.";
const bytes = (value) => new TextEncoder().encode(JSON.stringify(value)).length;

test("kinds: each has an icon from the icon list, unique field keys, and sensible limits", () => {
  assert.deepEqual(STEP_KIND_ORDER, ["trigger", "find", "write", "approve", "send", "row", "request", "ai", "app", "issue", "action"]);
  for (const [kind, spec] of Object.entries(STEP_KINDS)) {
    assert.ok(ICON_NAMES.includes(spec.icon), `${kind}: icon ${spec.icon} is not in the icon list`);
    assert.ok(spec.label && spec.help, `${kind}: needs a label and a help line`);
    assert.equal(typeof spec.describe, "function");
    const keys = spec.fields.map((field) => field.key);
    assert.equal(new Set(keys).size, keys.length, `${kind}: field keys must be unique`);
    for (const field of spec.fields) {
      assert.ok(field.label, `${kind}.${field.key}: needs a label`);
      if (field.type === "choice") assert.ok(Object.keys(field.options).length >= 2, `${kind}.${field.key}: a choice needs options`);
      else assert.ok(field.type === "text" && Number.isInteger(field.max) && field.max > 0, `${kind}.${field.key}: bad text field`);
    }
  }
});

test("isTypedKind: only the real kinds (not note, not names that exist on every object)", () => {
  for (const kind of STEP_KIND_ORDER) assert.equal(isTypedKind(kind), true);
  for (const bad of ["note", "constructor", "__proto__", "toString", "", 5, null, undefined, {}, ["send"]]) assert.equal(isTypedKind(bad), false);
});

test("describeStep: good fields become a title and a detail", () => {
  const cases = [
    ["trigger", { how: "schedule", when: "Every weekday at 9am" }, "On a schedule", "Every weekday at 9am"],
    ["trigger", { how: "manual", when: "" }, "When I ask", ""],
    ["find", { where: "inbox", what: "unpaid invoices" }, "Look something up", "Inbox: unpaid invoices"],
    ["write", { what: "email", about: "a polite reminder" }, "Draft something", "An email: a polite reminder"],
    ["write", { what: "report", about: "" }, "Draft something", "A report"],
    ["approve", { what: "" }, "Ask you to approve", "Nothing is sent until you say yes"],
    ["approve", { what: "the reminders" }, "Ask you to approve", "the reminders"],
    ["send", { how: "email", to: "each overdue client", about: "payment reminder" }, "Send a message", "By email, to each overdue client: payment reminder"],
    ["send", { how: "slack", to: "the team", about: "" }, "Send a message", "On Slack, to the team"],
    ["row", { to: "Invoice tracker", values: "client, amount" }, "Add a row", "To Invoice tracker: client, amount"],
    ["request", { url: "https://api.example.com/status", why: "check the site" }, "Call a web address", "Get https://api.example.com/status: check the site"],
    ["request", { url: "https://api.example.com/status", why: "" }, "Call a web address", "Get https://api.example.com/status"],
    ["ai", { task: "Which task first?", uses: "linear", address: "" }, "Ask the AI", "Which task first?: My Linear tasks"],
    ["ai", { task: "What is on today?", uses: "calendar", address: "" }, "Ask the AI", "What is on today?: My Google Calendar"],
    ["ai", { task: "Which emails first?", uses: "gmail", address: "" }, "Ask the AI", "Which emails first?: My Gmail inbox (senders and subjects)"],
    ["ai", { task: "Answer my emails", uses: "gmailtext", address: "" }, "Ask the AI", "Answer my emails: My Gmail inbox, with the text of each email"],
    ["ai", { task: "What did I work on?", uses: "drive", address: "" }, "Ask the AI", "What did I work on?: My Google Drive files"],
    ["ai", { task: "Read the React wiki", uses: "mcp", address: "https://mcp.deepwiki.com/mcp" }, "Ask the AI", "Read the React wiki: An MCP server"],
    ["ai", { task: "Write a haiku", uses: "nothing", address: "" }, "Ask the AI", "Write a haiku"],
  ];
  for (const [kind, fields, title, detail] of cases) assert.deepEqual(describeStep(kind, fields), { title, detail }, kind);
});

test("blankFields: a choice starts on its first option, text starts empty", () => {
  assert.deepEqual(blankFields("trigger"), { how: "schedule", when: "" });
  assert.deepEqual(blankFields("send"), { how: "email", to: "", about: "" });
  assert.deepEqual(blankFields("approve"), { what: "" });
});

test("checkSteps: a typed step is rebuilt from its fields (own icon, worked-out title and detail; extra keys and any title or detail sent are ignored)", () => {
  const sent = { kind: "send", icon: "Bell", title: "HACK", detail: "HACK", extra: 1, fields: { how: "slack", to: "  the team  ", about: "", junk: "x" } };
  const result = checkSteps([sent]);
  assert.deepEqual(result.value, [{ icon: "Send", title: "Send a message", detail: "On Slack, to the team", kind: "send", fields: { how: "slack", to: "the team", about: "" } }]);
});

test("checkSteps: plain notes are exactly as before (no kind, null, note, or a well-formed kind we do not know)", () => {
  const note = { icon: "Mail", title: "A", detail: "b" };
  const sent = [
    { ...note },
    { ...note, kind: null },
    { ...note, kind: "note", fields: { x: 1 } },
    { ...note, kind: "teleport", fields: { where: "moon" } },
    { ...note, kind: "constructor" },
    { ...note, kind: "__proto__" },
  ];
  const result = checkSteps(sent);
  assert.ok(result.value, result.error);
  for (const step of result.value) assert.deepEqual(step, note);
});

test("checkSteps: a kind that is not a short lowercase word is unreadable", () => {
  for (const kind of [5, true, {}, [], "A B", "x".repeat(21), "Send", "send now", "se-nd"]) {
    const result = checkSteps([{ icon: "Mail", title: "A", detail: "", kind }]);
    assert.equal(result.error, UNREADABLE, String(kind));
    assert.deepEqual(result.problems[0], { index: 0, field: "kind", kind: "unreadable", error: UNREADABLE });
  }
});

test("typed fields: a missing required field, a bad choice, too long, not text, or the wrong shape each name their own field", () => {
  const one = (step) => checkSteps([step]);

  let r = one({ kind: "send", fields: { how: "email", to: "", about: "" } });
  assert.equal(r.error, 'Step 1: fill in "To whom".');
  assert.deepEqual(r.problems, [{ index: 0, field: "fields.to", kind: "empty", error: 'Step 1: fill in "To whom".' }]);

  for (const how of ["carrier pigeon", "", "constructor", "__proto__", "Email", "email "]) {
    r = one({ kind: "send", fields: { how, to: "x" } });
    if (how === "email ") assert.ok(r.value, "a trailing space is tidied away, so it is the choice 'email'");
    else assert.deepEqual(r.problems, [{ index: 0, field: "fields.how", kind: "choice", error: 'Step 1: choose an option for "How".' }], JSON.stringify(how));
  }

  r = one({ kind: "row", fields: { to: "x".repeat(121), values: "ok" } });
  assert.deepEqual(r.problems, [{ index: 0, field: "fields.to", kind: "long", over: 1, error: 'Step 1: use 120 characters or fewer in "Google Sheet address".' }]);
  assert.ok(one({ kind: "row", fields: { to: "x".repeat(120), values: "y".repeat(80) } }).value, "exactly at the limits is fine");

  r = one({ kind: "row", fields: { to: 5, values: "ok" } });
  assert.deepEqual(r.problems, [{ index: 0, field: "fields.to", kind: "unreadable", error: UNREADABLE }]);

  for (const fields of [undefined, null, [], "x", 5, true]) {
    r = one({ kind: "send", fields });
    assert.deepEqual(r.problems, [{ index: 0, field: "fields", kind: "unreadable", error: UNREADABLE }], String(fields));
  }
});

test("typed fields: every problem is listed, in order, with the right step number", () => {
  const r = checkSteps([
    { icon: "Mail", title: "fine", detail: "" },
    { kind: "row", fields: { to: "", values: "" } },
    { kind: "send", fields: { how: "email", to: "ok" } },
  ]);
  assert.deepEqual(r.problems.map((p) => [p.index, p.field]), [[1, "fields.to"], [1, "fields.values"]]);
  assert.equal(r.error, 'Step 2: fill in "Google Sheet address".');
});

test("typed fields: text is tidied before it is checked (invisible characters, runs of spaces)", () => {
  const r = checkSteps([{ kind: "find", fields: { where: "inbox", what: "  a​‍   b\n\tc  " } }]);
  assert.equal(r.value[0].fields.what, "a b c");
  assert.equal(r.value[0].detail, "Inbox: a b c");
  const invisibleOnly = checkSteps([{ kind: "find", fields: { where: "inbox", what: "​⁠‮" } }]);
  assert.equal(invisibleOnly.problems[0].kind, "empty", "text made only of invisible characters counts as empty");
});

test("checkSteps: running it on its own typed output changes nothing", () => {
  const sample = {
    trigger: { how: "email", when: "Within an hour" }, find: { where: "payments", what: "unpaid" }, write: { what: "reply", about: "" },
    approve: { what: "" }, send: { how: "other", to: "the client", about: "invoice" }, row: { to: "Tracker", values: "a, b" },
    request: { url: "https://example.com/a", why: "" }, ai: { task: "Think", uses: "nothing", address: "" },
    app: { app: "todoist", what: "" }, issue: { title: "Reply to Ana", details: "", team: "ENG" },
    action: { action: "slack_message", target: "general", title: "Deploy done", details: "" },
  };
  const first = checkSteps(STEP_KIND_ORDER.map((kind) => ({ kind, fields: sample[kind] })));
  assert.ok(first.value, first.error);
  assert.deepEqual(checkSteps(first.value).value, first.value);
});

test("worst case: with every text field at its limit, the title and detail still fit, for every choice and kind", () => {
  const longest = (options) => Object.entries(options).sort((a, b) => b[1].length - a[1].length)[0][0];
  for (const [kind, spec] of Object.entries(STEP_KINDS)) {
    for (const filler of ["x", "字", "😀"]) {
      const fields = {};
      for (const field of spec.fields) fields[field.key] = field.type === "choice" ? longest(field.options) : filler.repeat(Math.floor(field.max / filler.length));
      const r = checkSteps([{ kind, fields }]);
      assert.ok(r.value, `${kind} with ${JSON.stringify(filler)}: ${r.error}`);
      assert.ok(r.value[0].title.length <= LIMITS.stepText && r.value[0].detail.length <= LIMITS.stepText, `${kind}: title/detail over ${LIMITS.stepText}`);
    }
  }
});

test("size: the biggest plan any kind allows is far below the limit, and the size guard itself works", () => {
  let biggest = 0;
  for (const [kind, spec] of Object.entries(STEP_KINDS)) {
    const fields = {};
    for (const field of spec.fields) fields[field.key] = field.type === "choice" ? Object.keys(field.options)[0] : "字".repeat(field.max);
    const r = checkSteps(Array.from({ length: LIMITS.planSteps }, () => ({ kind, fields })));
    assert.ok(r.value, `${kind}: ${r.error}`);
    biggest = Math.max(biggest, bytes(r.value));
  }
  assert.ok(biggest < LIMITS.planBytes * 0.8, `a kind makes plans of ${biggest} bytes: too close to ${LIMITS.planBytes}; shorten its fields`);

  const normal = [{ icon: "Mail", title: "A normal step", detail: "A normal detail" }];
  assert.ok(checkSteps(normal).value);
  const before = LIMITS.planBytes;
  LIMITS.planBytes = 10; // lowered for this test only
  try {
    const refused = checkSteps(normal);
    assert.equal(refused.error, "That plan is too large. Shorten some of the steps.");
    assert.deepEqual(refused.problems.map((p) => [p.field, p.kind]), [["steps", "big"]]);
  } finally {
    LIMITS.planBytes = before;
  }
});

test("cleanPlan: a typed plan survives the trip through JSON text unchanged, and a bad one is refused with a sentence", () => {
  const good = checkSteps([
    { kind: "trigger", fields: { how: "schedule", when: "Mondays" } },
    { kind: "write", fields: { what: "email", about: "reminder" } },
    { icon: "Bell", title: "A note", detail: "free text" },
  ]);
  assert.ok(good.value, good.error);
  assert.deepEqual(cleanPlan(JSON.stringify(good.value)).value, good.value);
  assert.equal(cleanPlan(JSON.stringify([{ kind: "send", fields: { how: "email" } }])).error, 'Step 1: fill in "To whom".');
});

test("sameSteps: typed steps compare by kind and fields, and a typed step is not the same as a note that reads alike", () => {
  const make = (fields) => checkSteps([{ kind: "send", fields }]).value;
  const a = make({ how: "email", to: "the client", about: "" });
  assert.equal(sameSteps(a, make({ how: "email", to: "  the   client ", about: "" })), true);
  assert.equal(sameSteps(a, make({ how: "slack", to: "the client", about: "" })), false);
  assert.equal(sameSteps(a, make({ how: "email", to: "the client", about: "late" })), false);
  const lookalike = [{ icon: a[0].icon, title: a[0].title, detail: a[0].detail }];
  assert.equal(sameSteps(a, lookalike), false);
  assert.equal(sameSteps(lookalike, lookalike), true);

  // Only the fields differ here (the blank field shows the default sentence, so the text reads the same): that must still
  // count as a change, or the editor would think a real edit was "no change".
  const blank = checkSteps([{ kind: "approve", fields: { what: "" } }]).value;
  const typedDefault = checkSteps([{ kind: "approve", fields: { what: "Nothing is sent until you say yes" } }]).value;
  assert.equal(blank[0].detail, typedDefault[0].detail);
  assert.equal(sameSteps(blank, typedDefault), false);
});

test("property: random typed plans (odd characters included): whatever is accepted is accepted again unchanged, within every limit", () => {
  let seed = 12345;
  const random = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const pick = (list) => list[Math.floor(random() * list.length)];
  const pieces = ["a", "word", " ", "  ", "\n", "\t", "​", "‮", "\u0000", "字", "😀", "\ud83d", "x".repeat(60), "<b>", "'; drop table", "../", "constructor"];
  const noise = (max) => Array.from({ length: Math.floor(random() * 6) }, () => pick(pieces)).join("").slice(0, max * 2);

  let accepted = 0;
  for (let round = 0; round < 600; round++) {
    const plan = Array.from({ length: 1 + Math.floor(random() * 14) }, () => {
      const kind = pick([...STEP_KIND_ORDER, "note", undefined, "teleport"]);
      if (!isTypedKind(kind)) return { icon: pick(ICON_NAMES), title: noise(200) || "t", detail: noise(200), kind };
      const fields = {};
      for (const field of STEP_KINDS[kind].fields) fields[field.key] = field.type === "choice" ? pick([...Object.keys(field.options), "nope", ""]) : noise(field.max);
      return { kind, fields };
    });
    const first = checkSteps(plan);
    if (!first.value) continue;
    accepted++;
    assert.deepEqual(checkSteps(first.value).value, first.value);
    assert.ok(first.value.length >= 1 && first.value.length <= LIMITS.planSteps);
    assert.ok(bytes(first.value) <= LIMITS.planBytes);
    for (const step of first.value) {
      assert.ok(step.title.length >= 1 && step.title.length <= LIMITS.stepText && step.detail.length <= LIMITS.stepText);
      assert.ok(!/[\u0000-\u001f‪-‮​-‍]/.test(step.title + step.detail + JSON.stringify(step.fields ?? {})));
      assert.deepEqual(Object.keys(step).sort(), step.kind ? ["detail", "fields", "icon", "kind", "title"] : ["detail", "icon", "title"]);
    }
  }
  assert.ok(accepted > 50, `only ${accepted} random plans were accepted: the generator is too harsh to prove anything`);
});

// ---- moving typed steps around the page, reading them back from the database, and switching a step's kind ----

test("plan tuples: notes and typed steps survive the trip to the screen's shape and back", () => {
  const steps = [
    { icon: "Mail", title: "A", detail: "b" },
    { icon: "Send", title: "Send a message", detail: "By email, to x", kind: "send", fields: { how: "email", to: "x", about: "" } },
  ];
  assert.deepEqual(planToSteps(stepsToPlan(steps)), steps);
  // The keyword planner's tuples have only three items: they stay plain notes.
  assert.deepEqual(planToSteps([["Clock", "t", "d"]]), [{ icon: "Clock", title: "t", detail: "d" }]);
});

test("readSavedStep: plain strings only; a typed step keeps its kind and its own fields; junk is left out", () => {
  assert.deepEqual(readSavedStep({ icon: 5, title: null, detail: {} }), { icon: "", title: "", detail: "" });
  for (const nothing of [undefined, null, "x", 5, []]) assert.deepEqual(readSavedStep(nothing), { icon: "", title: "", detail: "" });

  const good = { icon: "Send", title: "Send a message", detail: "By email, to x", kind: "send", fields: { how: "email", to: "x", about: "", extra: "dropped" } };
  assert.deepEqual(readSavedStep(good), { icon: "Send", title: "Send a message", detail: "By email, to x", kind: "send", fields: { how: "email", to: "x", about: "" } });

  assert.deepEqual(readSavedStep({ ...good, fields: { how: "email", to: 5 } }).fields, { how: "email", to: "", about: "" }, "a field that is not text becomes empty");
  assert.deepEqual(readSavedStep({ ...good, fields: Object.create({ to: "inherited" }) }).fields, { how: "", to: "", about: "" }, "inherited keys are not fields");
  for (const fields of [null, [], "x", 5, undefined]) assert.equal("kind" in readSavedStep({ ...good, fields }), false, `fields ${JSON.stringify(fields)}: read as a plain note`);
  for (const kind of ["teleport", "constructor", "__proto__", "note", 5, null]) assert.equal("kind" in readSavedStep({ ...good, kind }), false, String(kind));
});

test("plainSteps (the update path) keeps typed steps and still tolerates a broken plan", () => {
  const stored = [{ icon: "Table", title: "Add a row", detail: "To T: v", kind: "row", fields: { to: "T", values: "v" } }, { icon: "Mail", title: "n", detail: "" }];
  assert.deepEqual(plainSteps(stored), stored);
  assert.deepEqual(plainSteps(null), []);
  assert.deepEqual(plainSteps("nope"), []);
});

test("rowForKind: picking a kind rebuilds the row (blank fields, the kind's icon, the editor's key stays)", () => {
  const note = { key: 7, icon: "Mail", title: "old title", detail: "old detail" };
  assert.deepEqual(rowForKind(note, "send"), { key: 7, icon: "Send", title: "old title", detail: "old detail", kind: "send", fields: { how: "email", to: "", about: "" } });

  const send = { ...note, icon: "Send", kind: "send", fields: { how: "slack", to: "the team", about: "" } };
  assert.equal(rowForKind(send, "send"), send, "the same kind changes nothing");
  assert.deepEqual(rowForKind(send, "row"), { key: 7, icon: "Table", title: "old title", detail: "old detail", kind: "row", fields: { to: "", values: "" } }, "another kind starts blank");

  // A new typed row is not valid until its blanks are filled in.
  const blank = checkSteps([rowForKind(note, "send")]);
  assert.deepEqual(blank.problems.map((p) => [p.field, p.kind]), [["fields.to", "empty"]]);
});

test("rowForKind: back to free text keeps what the typed step said (when it can), or the old words", () => {
  const send = { key: 3, icon: "Send", title: "stale", detail: "stale", kind: "send", fields: { how: "slack", to: "the team", about: "" } };
  assert.deepEqual(rowForKind(send, NOTE), { key: 3, icon: "Send", title: "Send a message", detail: "On Slack, to the team" });

  const unfinished = { key: 4, icon: "Send", title: "my words", detail: "my detail", kind: "send", fields: { how: "email", to: "", about: "" } };
  assert.deepEqual(rowForKind(unfinished, NOTE), { key: 4, icon: "Send", title: "my words", detail: "my detail" }, "blank required field: the old words stay");

  const note = { key: 5, icon: "Mail", title: "t", detail: "d" };
  assert.equal(rowForKind(note, NOTE), note, "already free text");
  for (const kind of ["teleport", "constructor", "__proto__", 5, undefined]) assert.equal(rowForKind(note, kind), note, String(kind));
});

test("toWorking: keys are 1, 2, 3 in order every time (so the server and the browser draw the same ids), new rows carry on after them", () => {
  const plan = [
    ["Mail", "a", "b"],
    ["Send", "Send a message", "By email, to x", "send", { how: "email", to: "x", about: "" }],
    ["NotAnIcon", "c", "d"],
  ];
  const first = toWorking(plan);
  const second = toWorking(plan); // a second call (the server renders again, or the browser builds it) gives the very same keys
  assert.deepEqual(first.map((row) => row.key), [1, 2, 3]);
  assert.deepEqual(second.map((row) => row.key), [1, 2, 3]);
  assert.equal(first[2].icon, "Sparkles", "an icon we do not offer shows as Sparkles");
  assert.deepEqual(first[1].fields, { how: "email", to: "x", about: "" });
  assert.notEqual(first[1].fields, plan[1][4], "the fields are a copy, so editing a row never changes the plan it came from");
  assert.equal("kind" in first[0], false);

  const added = newRow("send");
  assert.ok(added.key > 3, "a row added later never reuses a key of the rows above");
  assert.equal(newRow().key, added.key + 1);
  assert.equal(added.kind, "send");
  assert.equal("kind" in newRow(), false, "a plain new row is free text");
  assert.deepEqual(toWorking([["Mail", "only", ""]]).map((row) => row.key), [1], "a shorter plan starts at 1 again");
  assert.deepEqual(toWorking([]), []);
});

test("moveRow: a row goes BEFORE the chosen position; its own spot changes nothing; the input is never changed", () => {
  const rows = [1, 2, 3, 4].map((key) => ({ key }));
  const keys = (list) => list.map((row) => row.key);
  assert.deepEqual(keys(moveRow(rows, 1, 3)), [2, 3, 1, 4], "first row dropped before the last");
  assert.deepEqual(keys(moveRow(rows, 1, 4)), [2, 3, 4, 1], "dropped at the very end");
  assert.deepEqual(keys(moveRow(rows, 4, 0)), [4, 1, 2, 3], "last row dropped at the very start");
  assert.deepEqual(keys(moveRow(rows, 3, 1)), [1, 3, 2, 4]);
  assert.deepEqual(keys(moveRow(rows, 2, 4)), [1, 3, 4, 2]);
  // dropped on its own spot (before itself, or right after itself): the very same list comes back
  for (const own of [[1, 0], [1, 1], [2, 1], [2, 2], [4, 3], [4, 4]]) assert.equal(moveRow(rows, own[0], own[1]), rows, `key ${own[0]} at ${own[1]}`);
  // anything wrong: the very same list comes back
  for (const bad of [-1, 5, 1.5, NaN, Infinity, "1", null, undefined]) assert.equal(moveRow(rows, 2, bad), rows, String(bad));
  assert.equal(moveRow(rows, 99, 1), rows, "unknown key");
  assert.deepEqual(keys(rows), [1, 2, 3, 4], "the list that was passed in is untouched");
});

test("moveRow: any sequence of moves keeps exactly the same rows (nothing lost, nothing doubled)", () => {
  let seed = 7;
  const random = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  let rows = Array.from({ length: 9 }, (_, i) => ({ key: i + 1 }));
  for (let round = 0; round < 500; round++) {
    rows = moveRow(rows, 1 + Math.floor(random() * 9), Math.floor(random() * (rows.length + 1)));
    assert.deepEqual(rows.map((row) => row.key).sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  }
});

test("insertRow: puts a row at a position, or at the end for a bad one, and never changes the input", () => {
  const rows = [{ key: 1 }, { key: 2 }];
  const fresh = { key: 9 };
  const keys = (list) => list.map((row) => row.key);
  assert.deepEqual(keys(insertRow(rows, fresh, 0)), [9, 1, 2]);
  assert.deepEqual(keys(insertRow(rows, fresh, 1)), [1, 9, 2]);
  assert.deepEqual(keys(insertRow(rows, fresh, 2)), [1, 2, 9]);
  for (const bad of [-1, 3, 0.5, NaN, "1", null, undefined]) assert.deepEqual(keys(insertRow(rows, fresh, bad)), [1, 2, 9], String(bad));
  assert.deepEqual(keys(insertRow([], fresh, 0)), [9]);
  assert.deepEqual(keys(rows), [1, 2], "the list that was passed in is untouched");
});

test("parseDragKind: only free text or a real kind is accepted from a drag", () => {
  for (const good of ["note", "trigger", "find", "write", "approve", "send", "row"]) assert.equal(parseDragKind(good), good);
  for (const bad of ["", "teleport", "constructor", "__proto__", "toString", "Send", 5, null, undefined, {}, ["send"]]) assert.equal(parseDragKind(bad), null, String(bad));
  assert.ok(DRAG_KIND.startsWith("application/x-hushwork-") && DRAG_ROW.startsWith("application/x-hushwork-") && DRAG_KIND !== DRAG_ROW);
});
test("blocks: every block makes a valid starting row, the Linear block is a find step already set to Linear, and bad ids do nothing", () => {
  assert.equal(new Set(BLOCKS.map((block) => block.id)).size, BLOCKS.length);
  assert.deepEqual(PALETTE_BLOCKS.map((block) => block.id).filter((id) => DESCRIBING_BLOCKS.includes(id)), [], "the Builder does not offer a block that only describes");
  assert.equal(PALETTE_BLOCKS.length, BLOCKS.length - DESCRIBING_BLOCKS.length);
  assert.ok(PALETTE_BLOCKS.some((block) => block.id === "ai") && PALETTE_BLOCKS.some((block) => block.id === "action"), "Ask the AI and Do in another app stay");
  for (const block of BLOCKS) {
    assert.ok(ICON_NAMES.includes(block.icon), `${block.id}: icon ${block.icon}`);
    assert.ok(block.label && block.help);
    assert.equal(parseDragKind(block.id), block.id);
    const row = newRowForBlock(block.id);
    assert.ok(row.key > 0, block.id);
  }
  const mcp = newRowForBlock("mcp");
  assert.deepEqual([mcp.kind, mcp.fields], ["ai", { task: "", uses: "mcp", address: "" }]);
  assert.equal(blockName(mcp), "MCP server");
  assert.equal(blockIdFor(mcp), "mcp");
  assert.equal(blockName(newRowForBlock("ai")), "Ask the AI");
  const linear = newRowForBlock("linear");
  assert.equal(linear.kind, "find");
  assert.deepEqual(linear.fields, { where: "linear", what: "My open tasks" });
  assert.ok(checkSteps([linear]).value, "the Linear block is valid right away");
  assert.equal(blockName(linear), "Linear");
  assert.equal(blockName(newRowForBlock("find")), "Find something");
  assert.equal(blockName(newRowForBlock("request")), "Web address");
  assert.equal(blockName(newRowForBlock("note")), "Note");
  for (const bad of ["__proto__", "constructor", "toString", "teleport", "", null, undefined, 5, {}]) assert.equal(parseDragKind(bad), null, String(bad));
});

test("the Add a row step: a pasted Google Sheet address reads as 'your Google Sheet', an older plain name is shown as it is, and a long name is cut", () => {
  assert.deepEqual(describeStep("row", { to: "https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789/edit", values: "Ana, 500" }), { title: "Add a row", detail: "To your Google Sheet: Ana, 500" });
  assert.equal(describeStep("row", { to: "Invoice tracker", values: "a, b" }).detail, "To Invoice tracker: a, b");
  assert.ok(describeStep("row", { to: "x".repeat(120), values: "v" }).detail.length < 70);
});
