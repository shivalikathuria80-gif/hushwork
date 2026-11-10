import test from "node:test";
import assert from "node:assert/strict";
import { WATCH_LIMITS, checkFilter, eventIncoming, filterFromStart, gmailQuery, mailIncoming, nextSeen, pickNew, readSeen, sourceOfStart, titleMatches, watchSentence } from "./app-events.js";
import { runDueWatches } from "./app-event-runner.js";
import { syncStartWatch } from "./app-event-sync.js";
import { fetchNewMail } from "./connectors/google-gmail.js";
import { fetchNewEvents } from "./connectors/google-calendar.js";
import { calendarEvents, runNewEvents, runNewMail } from "./connectors/composio.js";
import { findComposioApp } from "./connectors/composio-apps.js";
import { STEP_KINDS, describeStep } from "./steps.js";
import { makeLimiter } from "./ai/limits.js";

const NOW = Date.parse("2026-11-10T12:00:00Z");
const start = (how, when = "") => ({ kind: "trigger", icon: "Zap", title: "x", detail: "", fields: { how, when } });

// ---- a small pretend database: from(table) with select / eq / lte / order / limit / insert / update / delete, enough for these files ----------------
function fakeDb(tables = {}, { failOn = {} } = {}) {
  const db = { tables: Object.fromEntries(Object.entries(tables).map(([name, rows]) => [name, rows.map((row) => ({ ...row }))])), log: [] };
  let made = 0;
  db.from = (table) => {
    db.tables[table] ??= [];
    const state = { table, op: "select", filters: [], values: null, max: Infinity, returning: false };
    const rows = () => db.tables[table].filter((row) => state.filters.every(([kind, column, value]) => (kind === "eq" ? row[column] === value : String(row[column]) <= String(value))));
    const finish = () => {
      if (failOn[table]?.includes(state.op)) return { data: null, error: { code: failOn[table].code ?? "XX000" } };
      db.log.push({ table, op: state.op, filters: state.filters, values: state.values });
      if (state.op === "insert") {
        const row = { id: `${table}-${++made}`, ...state.values };
        db.tables[table].push(row);
        return { data: [row], error: null };
      }
      if (state.op === "update") {
        const hit = rows();
        for (const row of hit) Object.assign(row, state.values);
        return { data: hit.map((row) => ({ id: row.id })), error: null };
      }
      if (state.op === "delete") {
        const hit = rows();
        db.tables[table] = db.tables[table].filter((row) => !hit.includes(row));
        return { data: hit, error: null };
      }
      return { data: rows().slice(0, state.max).map((row) => ({ ...row })), error: null };
    };
    const chain = {
      select() { state.returning = true; return chain; },
      eq(column, value) { state.filters.push(["eq", column, value]); return chain; },
      lte(column, value) { state.filters.push(["lte", column, value]); return chain; },
      order() { return chain; },
      limit(max) { state.max = max; return chain; },
      insert(values) { state.op = "insert"; state.values = values; return chain; },
      update(values) { state.op = "update"; state.values = values; return chain; },
      delete() { state.op = "delete"; return chain; },
      then(resolve, reject) { return Promise.resolve(finish()).then(resolve, reject); },
    };
    return chain;
  };
  return db;
}

const WATCH = { id: "w1", user_id: "user-1", workflow_id: "wf-1", source: "gmail", filter: "", enabled: true, tz_offset: 330, cursor_at: new Date(NOW - 10 * 60_000).toISOString(), seen: [], next_check_at: new Date(NOW - 1000).toISOString(), started_count: 2 };
const mail = (id, minutesAgo, extra = {}) => {
  const incoming = mailIncoming({ from: "Ana Lopez", address: "ana@example.com", subject: `Hello ${id}`, at: NOW - minutesAgo * 60_000, snippet: "Could we meet on Friday?", ...extra });
  return { id, at: NOW - minutesAgo * 60_000, label: `Hello ${id}`, ...incoming };
};
function deps(db, overrides = {}) {
  const calls = { runs: [], nudges: [], reads: [], clients: [] };
  return {
    calls,
    admin: db,
    read: async (args) => { calls.reads.push(args); return { ok: true, items: [mail("m1", 3), mail("m2", 1)] }; },
    clientFor: (userId) => { calls.clients.push(userId); return { forUser: userId }; },
    run: async (input, who) => { calls.runs.push({ input, who }); return { ok: true, runId: `run-${calls.runs.length}`, auto: { done: 1, stoppedAt: 0, waiting: 1 } }; },
    nudge: async (found) => { calls.nudges.push(found); },
    takeSlot: async () => ({ ok: true }),
    limiter: { minute: makeLimiter({ max: 5, windowMs: 60_000 }), day: makeLimiter({ max: 40, windowMs: 86_400_000, calendar: true }) },
    now: NOW,
    ...overrides,
  };
}

// ---- the rules --------------------------------------------------------------------------------------------------------------------------------------------------
test("a Start step says which app it watches", () => {
  assert.equal(sourceOfStart(start("email")), "gmail");
  assert.equal(sourceOfStart(start("event")), "calendar");
  for (const how of ["schedule", "watch", "lead", "link", "manual", ""]) assert.equal(sourceOfStart(start(how)), null);
  assert.equal(sourceOfStart({ kind: "ai", fields: { how: "email" } }), null);
  assert.equal(sourceOfStart(null), null);
  assert.ok(Object.hasOwn(STEP_KINDS.trigger.fields[0].options, "event"), "the Builder offers the calendar start");
});

test("the filter takes Gmail's own search words or title words, and refuses times and odd characters", () => {
  assert.deepEqual(checkFilter("gmail", "  from:ana@example.com   subject:invoice "), { value: "from:ana@example.com subject:invoice" });
  assert.deepEqual(checkFilter("gmail", ""), { value: "" });
  assert.deepEqual(checkFilter("gmail", '"big order" OR has:attachment -label:spam'), { value: '"big order" OR has:attachment -label:spam' });
  for (const bad of ["newer_than:2d", "after:2026/01/01", "x".repeat(81), "from:a{b}", "a<script>"]) assert.ok(checkFilter("gmail", bad).error, bad);
  assert.deepEqual(checkFilter("calendar", "Interview"), { value: "Interview" });
  assert.ok(checkFilter("calendar", "a{b}").error);
  // an old plan that still holds a time in the second box means "everything"
  assert.equal(filterFromStart(start("email", "every weekday at 9am")), "");
  assert.equal(filterFromStart(start("email", "9:30 am")), "");
  assert.equal(filterFromStart(start("email", "from:boss@acme.com")), "from:boss@acme.com");
});

test("the Gmail search never includes the person's own mail and looks a minute before the cursor", () => {
  const q = gmailQuery("subject:invoice", NOW);
  assert.equal(q, `in:inbox -from:me after:${Math.floor((NOW - 60_000) / 1000)} (subject:invoice)`);
  assert.equal(gmailQuery("", NOW), `in:inbox -from:me after:${Math.floor((NOW - 60_000) / 1000)}`);
  assert.ok(titleMatches("", "anything"));
  assert.ok(titleMatches("interview ana", "Interview with Ana Lopez"));
  assert.ok(!titleMatches("interview bob", "Interview with Ana Lopez"));
});

test("only new items are picked: never one seen before, never one from before the cursor, oldest first, at most 3", () => {
  const cursorMs = NOW - 10 * 60_000;
  const items = [
    { id: "old", at: cursorMs - 5 * 60_000 }, { id: "seen", at: NOW - 60_000 }, { id: "a", at: NOW - 3000 }, { id: "b", at: NOW - 9000 },
    { id: "c", at: NOW - 1000 }, { id: "d", at: NOW - 500 }, { id: "b", at: NOW - 9000 }, { id: "bad id!", at: NOW }, { id: "x", at: Number.NaN },
  ];
  const picked = pickNew(items, { seen: ["seen"], cursorMs });
  assert.deepEqual(picked.take.map((one) => one.id), ["b", "a", "c"]);
  assert.equal(picked.waiting, 1, "d waits for the next look");
  assert.equal(picked.cursorMs, NOW - 1000, "the cursor stops at the last one taken");
  assert.deepEqual(pickNew([], { cursorMs }).take, []);
  assert.equal(pickNew(null, { cursorMs }).cursorMs, cursorMs);
  // seen ids are kept short and plain
  assert.equal(nextSeen(Array.from({ length: 60 }, (_, i) => `id${i}`), ["new"]).length, WATCH_LIMITS.seenKeep);
  assert.deepEqual(readSeen(["ok", 5, "no way", null]), ["ok"]);
  assert.deepEqual(readSeen("nope"), []);
});

test("what an email or event hands the AI is short, labelled, and never holds a card number", () => {
  const m = mailIncoming({ from: "Ana", address: "ana@example.com", subject: "Order", at: NOW, snippet: "My card is 4242 4242 4242 4242 thanks" });
  assert.match(m.text, /^From: Ana\nEmail: ana@example\.com\nSubject: Order\nReceived: 2026-11-10 12:00 UTC$/);
  assert.ok(!m.text.includes("4242"), "a card number never gets in");
  const tagged = mailIncoming({ from: "<b>x</b>", subject: "<incoming>", at: NOW, snippet: "" });
  assert.ok(!tagged.text.includes("<"), "nothing that arrived can form a tag");
  const e = eventIncoming({ title: "Interview", start: "2026-11-12T10:00:00+05:30", end: "", where: "Zoom", organizer: "Ana", guests: 3 });
  assert.equal(e.text, "Title: Interview\nStarts: 2026-11-12T10:00:00+05:30\nWhere: Zoom\nMade by: Ana\nGuests: 3");
  assert.ok(e.preview.length > 0 && Buffer.byteLength(JSON.stringify(e.preview)) < 2000);
});

test("the Start step reads well in the Builder, and the save sentence says what is watched", () => {
  assert.deepEqual(describeStep("trigger", { how: "email", when: "from:boss@acme.com" }), { title: "When an email arrives", detail: "Only emails matching from:boss@acme.com" });
  assert.deepEqual(describeStep("trigger", { how: "event", when: "" }), { title: "When a calendar event is added", detail: "" });
  assert.match(watchSentence("gmail", "from:a@b.co", "new"), /^Now watching Gmail: every new email matching "from:a@b.co" starts this workflow/);
  assert.match(watchSentence("calendar", "", "same"), /^Watching Google Calendar\. .*Approve/);
  assert.match(watchSentence("gmail", "", "off"), /switched off/);
  assert.equal(watchSentence("nope", "", "new"), "");
});

// ---- the clock's look ---------------------------------------------------------------------------------------------------------------------------------------
test("a due watch is claimed, each new email starts the workflow as its owner without writing, is written down, and nudges", async () => {
  const db = fakeDb({ app_watches: [WATCH] });
  const d = deps(db);
  const summary = await runDueWatches(d);
  assert.deepEqual({ looked: summary.looked, started: summary.started }, { looked: 1, started: 2 });
  assert.equal(d.calls.reads[0].sinceMs, Date.parse(WATCH.cursor_at));
  const [first, second] = d.calls.runs;
  assert.equal(first.input.id, "wf-1");
  assert.equal(first.input.auto, true);
  assert.equal(first.input.allowWrites, false, "a new email can never make Hushwork send anything by itself");
  assert.equal(first.input.incoming.from, "gmail");
  assert.match(first.input.incoming.text, /Subject: Hello m1/, "oldest first");
  assert.match(second.input.incoming.text, /Subject: Hello m2/);
  assert.deepEqual(first.who.user, { id: "user-1" });
  assert.deepEqual(d.calls.clients, ["user-1"]);
  assert.equal(d.calls.nudges.length, 2);
  assert.equal(d.calls.nudges[0].reason, "email");
  assert.equal(d.calls.nudges[0].tzOffset, 330);
  const events = db.tables.app_watch_events;
  assert.deepEqual(events.map((one) => [one.status, one.run_id]), [["started", "run-1"], ["started", "run-2"]]);
  assert.ok(events.every((one) => one.user_id === "user-1" && one.watch_id === "w1" && Array.isArray(one.preview)));
  const saved = db.tables.app_watches[0];
  assert.deepEqual(saved.seen, ["m1", "m2"]);
  assert.equal(saved.cursor_at, new Date(NOW - 60_000).toISOString());
  assert.equal(saved.last_status, "new");
  assert.equal(saved.started_count, 4);
  assert.equal(saved.next_check_at, new Date(NOW + WATCH_LIMITS.checkEveryMs).toISOString(), "it looks again in 2 minutes");

  // the next look finds the same two emails and starts nothing
  db.tables.app_watches[0].next_check_at = new Date(NOW - 1).toISOString();
  const again = await runDueWatches(deps(db));
  assert.equal(again.started, 0);
  assert.equal(db.tables.app_watches[0].last_status, "ok");
});

test("a watch that is not due, switched off, or already claimed by another clock call is left alone", async () => {
  const db = fakeDb({ app_watches: [{ ...WATCH, next_check_at: new Date(NOW + 60_000).toISOString() }, { ...WATCH, id: "w2", workflow_id: "wf-2", enabled: false }] });
  const d = deps(db);
  assert.equal((await runDueWatches(d)).looked, 0);
  assert.equal(d.calls.reads.length, 0);

  // two clock calls at once: only one look
  const db2 = fakeDb({ app_watches: [WATCH] });
  const both = await Promise.all([runDueWatches(deps(db2)), runDueWatches(deps(db2))]);
  assert.equal(both.reduce((sum, one) => sum + one.looked, 0), 1);
  assert.equal(both.reduce((sum, one) => sum + one.started, 0), 2);
});

test("a problem is written on the watch in our own words and the next look waits longer", async () => {
  const db = fakeDb({ app_watches: [WATCH] });
  const d = deps(db, { read: async () => ({ ok: false, kind: "not_connected", error: "Hushwork cannot read your Gmail." }) });
  const summary = await runDueWatches(d);
  assert.equal(summary.problems, 1);
  const saved = db.tables.app_watches[0];
  assert.equal(saved.last_status, "not_connected");
  assert.equal(saved.last_error, "Hushwork cannot read your Gmail.");
  assert.equal(saved.next_check_at, new Date(NOW + 30 * 60_000).toISOString());
  assert.equal(d.calls.runs.length, 0);

  const db2 = fakeDb({ app_watches: [WATCH] });
  await runDueWatches(deps(db2, { read: async () => { throw new Error("boom with a secret"); } }));
  assert.equal(db2.tables.app_watches[0].last_status, "failed");
  assert.ok(!db2.tables.app_watches[0].last_error.includes("secret"));
});

test("a flood is held back by the per-person limit: written down as limited, marked seen, never queued", async () => {
  const db = fakeDb({ app_watches: [WATCH] });
  const items = [mail("a", 5), mail("b", 4), mail("c", 3), mail("d", 2), mail("e", 1)];
  const d = deps(db, { read: async () => ({ ok: true, items }), limiter: { minute: makeLimiter({ max: 1, windowMs: 60_000 }), day: makeLimiter({ max: 40, windowMs: 86_400_000 }) } });
  const summary = await runDueWatches(d);
  assert.equal(summary.started, 1);
  assert.equal(summary.limited, 2);
  assert.deepEqual(db.tables.app_watch_events.map((one) => one.status), ["started", "limited", "limited"]);
  assert.deepEqual(db.tables.app_watches[0].seen, ["a", "b", "c"]);
  assert.equal(db.tables.app_watches[0].next_check_at, new Date(NOW).toISOString(), "two more were waiting: it looks again at the next clock call");

  const db2 = fakeDb({ app_watches: [WATCH] });
  const d2 = deps(db2, { takeSlot: async () => ({ ok: false, why: "limit_day" }) });
  assert.equal((await runDueWatches(d2)).started, 0);
  assert.equal(d2.calls.runs.length, 0, "the database limit holds too");
});

test("a run that cannot start is written down as failed and nobody is nudged; a calendar watch nudges as an event", async () => {
  const db = fakeDb({ app_watches: [WATCH] });
  const d = deps(db, { run: async () => ({ error: "This workflow has no Start step" }) });
  const summary = await runDueWatches(d);
  assert.equal(summary.failed, 2);
  assert.deepEqual(db.tables.app_watch_events.map((one) => one.status), ["failed", "failed"]);
  assert.equal(d.calls.nudges.length, 0);
  assert.equal(db.tables.app_watches[0].last_status, "failed");
  assert.match(db.tables.app_watches[0].last_error, /Builder/);

  const db2 = fakeDb({ app_watches: [{ ...WATCH, source: "calendar" }] });
  const d2 = deps(db2);
  await runDueWatches(d2);
  assert.equal(d2.calls.nudges[0].reason, "event");
  assert.equal(d2.calls.runs[0].input.incoming.from, "calendar");
});

test("the clock's budget: no look starts after the deadline, and an item not reached stays new", async () => {
  const db = fakeDb({ app_watches: [WATCH, { ...WATCH, id: "w2", workflow_id: "wf-2" }] });
  let t = 0;
  const d = deps(db, { clock: () => (t += 10), deadline: 25 });
  const summary = await runDueWatches(d);
  assert.equal(summary.looked, 1);
  assert.equal(summary.deferred, 1);
  assert.ok(db.tables.app_watches[0].seen.length < 2, "the email it did not reach is not marked seen");
});

test("Check now looks at exactly one watch of exactly one person", async () => {
  const db = fakeDb({ app_watches: [{ ...WATCH, next_check_at: new Date(NOW + 60_000).toISOString() }, { ...WATCH, id: "w2", user_id: "user-2", workflow_id: "wf-2" }] });
  const d = deps(db, { onlyId: "w1", userId: "user-1" });
  const summary = await runDueWatches(d);
  assert.equal(summary.looked, 1);
  assert.equal(summary.status, "new");
  assert.equal(d.calls.reads[0].watch.id, "w1");
  const other = await runDueWatches(deps(db, { onlyId: "w2", userId: "user-1" }));
  assert.equal(other.due, 0, "someone else's watch is never looked at");
});

test("a missing table is reported as setup, not as an error", async () => {
  const db = fakeDb({}, { failOn: { app_watches: Object.assign(["select"], { code: "42P01" }) } });
  const summary = await runDueWatches(deps(db));
  assert.equal(summary.setup, true);
  assert.equal(summary.ok, true);
});

// ---- saving in the Builder ----------------------------------------------------------------------------------------------------------------------------------
const AI = { kind: "ai", icon: "Sparkles", title: "Ask the AI", detail: "", fields: { task: "Read {incoming} and draft a reply", uses: "nothing", address: "" } };
test("saving a workflow that starts from an email makes its watch; the same save again changes nothing; a new filter is saved", async () => {
  const db = fakeDb({ app_watches: [] });
  const plan = [start("email", "from:ana@example.com"), AI];
  const first = await syncStartWatch({ supabase: db, userId: "user-1", workflowId: "wf-1", plan, tzOffset: 330 });
  assert.match(first.text, /^Now watching Gmail/);
  assert.deepEqual(db.tables.app_watches.map((row) => [row.workflow_id, row.source, row.filter, row.tz_offset]), [["wf-1", "gmail", "from:ana@example.com", 330]]);
  assert.ok(!("user_id" in db.tables.app_watches[0]), "the person's own client never sends user_id (the database fills it in)");
  db.tables.app_watches[0].user_id = "user-1";
  db.tables.app_watches[0].enabled = true;
  assert.match((await syncStartWatch({ supabase: db, userId: "user-1", workflowId: "wf-1", plan, tzOffset: 330 })).text, /^Watching Gmail\./);
  const changed = await syncStartWatch({ supabase: db, userId: "user-1", workflowId: "wf-1", plan: [start("event", "interview"), AI], tzOffset: 330 });
  assert.match(changed.text, /^Now watching Google Calendar/);
  assert.equal(db.tables.app_watches.length, 1);
  assert.deepEqual([db.tables.app_watches[0].source, db.tables.app_watches[0].filter], ["calendar", "interview"]);
});

test("a workflow that stops starting from an app has its watch switched off; bad filters and plan-only workflows are not watched", async () => {
  const db = fakeDb({ app_watches: [{ id: "w1", user_id: "user-1", workflow_id: "wf-1", source: "gmail", filter: "", enabled: true }] });
  const off = await syncStartWatch({ supabase: db, userId: "user-1", workflowId: "wf-1", plan: [start("manual"), AI] });
  assert.match(off.text, /stopped watching/);
  assert.equal(db.tables.app_watches[0].enabled, false);
  assert.equal((await syncStartWatch({ supabase: db, userId: "user-1", workflowId: "wf-1", plan: [start("manual"), AI] })).text, "", "already off: nothing to say");

  const empty = fakeDb({ app_watches: [] });
  assert.match((await syncStartWatch({ supabase: empty, userId: "user-1", workflowId: "wf-9", plan: [start("email", "newer_than:1d"), AI] })).text, /^Not watching Gmail yet/);
  assert.match((await syncStartWatch({ supabase: empty, userId: "user-1", workflowId: "wf-9", plan: [start("email"), { kind: "write", fields: { what: "email", about: "" } }] })).text, /none of this workflow's steps can really run/);
  assert.equal(empty.tables.app_watches.length, 0);

  const full = fakeDb({ app_watches: Array.from({ length: WATCH_LIMITS.maxWatches }, (_, i) => ({ id: `w${i}`, user_id: "user-1", workflow_id: `other-${i}`, source: "gmail", filter: "", enabled: true })) });
  assert.match((await syncStartWatch({ supabase: full, userId: "user-1", workflowId: "wf-new", plan: [start("email"), AI] })).text, /already have 10/);

  const missing = fakeDb({}, { failOn: { app_watches: Object.assign(["select"], { code: "PGRST205" }) } });
  assert.match((await syncStartWatch({ supabase: missing, userId: "user-1", workflowId: "wf-1", plan: [start("email"), AI] })).text, /app-events\.sql/);
  assert.equal((await syncStartWatch({ supabase: missing, userId: "user-1", workflowId: "wf-1", plan: [start("manual"), AI] })).text, "", "nothing to watch: says nothing about setup");
});

// ---- the readers -------------------------------------------------------------------------------------------------------------------------------------------------
const answer = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body), headers: new Headers() });

test("Hushwork's Gmail reader sends ONE search and reads who, subject, when and Gmail's snippet, with GETs only", async () => {
  const asked = [];
  const fetchImpl = async (url, options) => {
    asked.push([String(url), options.method]);
    if (String(url).includes("/messages?")) return answer({ messages: [{ id: "abc123" }, { id: "bad/../id" }] });
    return answer({ id: "abc123", internalDate: String(NOW), snippet: "Can we talk &amp; meet? It&#39;s urgent", payload: { headers: [{ name: "From", value: '"Ana Lopez" <ana@example.com>' }, { name: "Subject", value: "=?UTF-8?B?Q2Fmw6k=?=" }] } });
  };
  const read = await fetchNewMail({ authorization: "Bearer t", query: gmailQuery("", NOW), fetchImpl });
  assert.equal(read.ok, true);
  assert.deepEqual(read.mails, [{ id: "abc123", at: NOW, from: "Ana Lopez", address: "ana@example.com", subject: "Café", snippet: "Can we talk & meet? It's urgent" }]);
  assert.ok(asked.every(([, method]) => method === "GET"));
  assert.equal(new URL(asked[0][0]).searchParams.get("q"), gmailQuery("", NOW));
  assert.equal(asked.length, 2, "an id that is not plain is never put into an address");

  const refused = await fetchNewMail({ authorization: "Bearer t", query: "x", fetchImpl: async () => answer({ error: { status: "UNAUTHENTICATED" } }, 401) });
  assert.equal(refused.ok, false);
  const crashed = await fetchNewMail({ authorization: "Bearer t", query: "x", fetchImpl: async () => { throw new Error("token=secret"); } });
  assert.ok(!crashed.error.includes("secret"));
});

test("Hushwork's Calendar reader counts only events CREATED lately, never cancelled ones", async () => {
  let asked = "";
  const fetchImpl = async (url) => {
    asked = String(url);
    return answer({ items: [
      { id: "ev1", status: "confirmed", created: new Date(NOW - 60_000).toISOString(), summary: "Interview with Ana", start: { dateTime: "2026-11-12T10:00:00+05:30" }, end: { dateTime: "2026-11-12T10:30:00+05:30" }, location: "Zoom", organizer: { email: "ana@example.com" }, attendees: [{}, {}] },
      { id: "ev2", status: "cancelled", created: new Date(NOW).toISOString() },
    ] });
  };
  const read = await fetchNewEvents({ authorization: "Bearer t", sinceMs: NOW - 10 * 60_000, fetchImpl });
  assert.equal(read.ok, true);
  assert.deepEqual(read.events, [{ id: "ev1", at: NOW - 60_000, title: "Interview with Ana", start: "2026-11-12T10:00:00+05:30", end: "2026-11-12T10:30:00+05:30", where: "Zoom", organizer: "ana@example.com", guests: 2 }]);
  assert.equal(new URL(asked).searchParams.get("updatedMin"), new Date(NOW - 11 * 60_000).toISOString());
  assert.equal((await fetchNewEvents({ authorization: "Bearer t", sinceMs: NOW, fetchImpl: async () => answer({}, 503) })).ok, false);
});

test("Composio's Gmail and Calendar readers fill only the inputs the tool really has, and read the answer by its shape", async () => {
  const gmailApp = findComposioApp("gmailsearch");
  const calendarApp = findComposioApp("gcalevents");
  assert.equal(calendarApp.lookupOf, "gcalwrite");
  assert.equal(calendarApp.watchOnly, true);
  const sent = [];
  const fetchImpl = async (url, options) => {
    const path = new URL(String(url)).pathname;
    if (options.method === "GET" && path.endsWith("/tools/GMAIL_FETCH_EMAILS")) return answer({ input_parameters: { properties: { query: {}, max_results: {}, include_payload: {} }, required: [] } });
    if (options.method === "GET" && path.endsWith("/tools/GOOGLECALENDAR_EVENTS_LIST")) return answer({ input_parameters: { properties: { calendarId: {}, updatedMin: {}, maxResults: {}, showDeleted: {} }, required: ["calendarId"] } });
    sent.push([path, JSON.parse(options.body)]);
    if (path.endsWith("/GMAIL_FETCH_EMAILS")) return answer({ successful: true, data: { messages: [
      { messageId: "m111111", threadId: "t111111", messageTimestamp: new Date(NOW).toISOString(), sender: "Ana Lopez <ana@example.com>", subject: "Quote please", labelIds: ["INBOX"], preview: { body: "Hi, could you send a quote?" } },
      { messageId: "m222222", threadId: "t222222", messageTimestamp: new Date(NOW).toISOString(), sender: "me@x.com", subject: "Sent", labelIds: ["SENT"] },
    ] } });
    return answer({ successful: true, data: { items: [{ id: "ev9", created: new Date(NOW).toISOString(), summary: "Demo", start: { date: "2026-11-20" } }] } });
  };
  const mails = await runNewMail({ key: "k", userId: "user-1", app: gmailApp, query: "in:inbox -from:me after:1", fetchImpl });
  assert.deepEqual(mails, { ok: true, mails: [{ id: "m111111", at: NOW, from: "Ana Lopez", address: "ana@example.com", subject: "Quote please", snippet: "Hi, could you send a quote?" }] });
  assert.deepEqual(sent[0][1].arguments, { query: "in:inbox -from:me after:1", max_results: 10, include_payload: false });
  assert.equal(sent[0][1].user_id, "user-1");
  const events = await runNewEvents({ key: "k", userId: "user-1", app: calendarApp, sinceMs: NOW, fetchImpl });
  assert.equal(events.ok, true);
  assert.deepEqual(events.events.map((one) => [one.id, one.title, one.start]), [["ev9", "Demo", "2026-11-20"]]);
  assert.deepEqual(sent[1][1].arguments, { updatedMin: new Date(NOW - 60_000).toISOString(), calendarId: "primary", maxResults: 25, showDeleted: false });

  // a tool that insists on something we do not fill is never run
  const strict = async (url, options) => (options.method === "GET" ? answer({ input_parameters: { properties: { query: {}, mystery: {} }, required: ["mystery"] } }) : assert.fail("must not run"));
  assert.equal((await runNewMail({ key: "k", userId: "u", app: gmailApp, query: "x", fetchImpl: strict })).ok, false);
  assert.deepEqual(calendarEvents({ deep: [{ id: "a", created: "x", summary: "s", status: "cancelled" }, { id: "no created", summary: "s" }] }), []);
});
