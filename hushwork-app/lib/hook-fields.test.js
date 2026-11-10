import test from "node:test";
import assert from "node:assert/strict";
import { fieldKey, fieldTag, fillFields, hasFieldTag, isOnlyFieldTag, readFieldList, tagsIn } from "./hook-fields.js";
import { actionSummary, fillCells, incomingOf, readSavedResults, sheetsSummary, isActionStep } from "./run-engine.js";
import { checkTarget, findAction, resolveTarget } from "./connectors/composio-actions.js";
import { makeCode } from "./hooks.js";
import { REPLAY_ERRORS, receiveArrival, replayArrival } from "./hook-receive.js";
import { makeLimiter } from "./ai/limits.js";

const FIELDS = [{ name: "Your email", value: "ana@example.com" }, { name: "customer.Name", value: "Ana" }, { name: "Message", value: "Hi\nthere {answer}" }];

test("a field's tag is its name made short and plain", () => {
  assert.equal(fieldKey("Your email"), "your_email");
  assert.equal(fieldKey("customer.Name"), "customer.name");
  assert.equal(fieldKey("  Café — ok! "), "cafe_ok");
  assert.equal(fieldTag("E-mail"), "{incoming.e_mail}");
  assert.equal(fieldTag("!!!"), "{incoming.value}");
  assert.ok(hasFieldTag("To {incoming.email}") && !hasFieldTag("{incoming}") && !hasFieldTag("{incoming.}"));
  assert.ok(isOnlyFieldTag(" {incoming.email} ") && !isOnlyFieldTag("a {incoming.email}"));
  assert.deepEqual(tagsIn("{incoming.A} and {incoming.b_c}"), ["a", "b_c"]);
});

test("tags are filled with what arrived, as plain text, and a missing field or no arrival says so", () => {
  assert.deepEqual(fillFields("To {incoming.your_email}, {incoming.customer.name}", FIELDS), { text: "To ana@example.com, Ana" });
  assert.equal(fillFields("{incoming.message}", FIELDS).text, "Hi\nthere ｛answer｝");
  assert.equal(fillFields("{incoming.message}", FIELDS, { oneLine: true }).text, "Hi there ｛answer｝");
  assert.equal(fillFields("{incoming.MESSAGE}", FIELDS, { max: 4 }).text, "Hi\nt");
  assert.deepEqual(fillFields("no tags", null), { text: "no tags" });
  assert.match(fillFields("{incoming.email}", null).error, /not started by its start link/);
  assert.match(fillFields("{incoming.phone}", FIELDS).error, /Nothing named "phone" arrived/);
  assert.match(fillFields("{incoming.blank}", [{ name: "blank", value: "  " }]).error, /Nothing named "blank"/);
});

test("a saved list of fields is read back with care", () => {
  assert.equal(readFieldList(undefined), null);
  assert.equal(readFieldList("x"), null);
  assert.deepEqual(readFieldList([{ name: "a", value: "1" }, { name: 2, value: "x" }, null, { name: "", value: "y" }, { name: "b", value: "z".repeat(900) }]), [{ name: "a", value: "1" }, { name: "b", value: "z".repeat(500) }]);
  assert.equal(readFieldList(Array.from({ length: 40 }, (_, i) => ({ name: `f${i}`, value: "v" }))).length, 20);
  const results = readSavedResults([{ kind: "trigger", title: "Start", incomingFields: FIELDS }, { title: "x" }]);
  assert.deepEqual(incomingOf(results), FIELDS);
  assert.equal(incomingOf(readSavedResults([{ title: "Start" }])), null);
});

test("an email step may send to {incoming.email}: the card shows the real address, and a bad one is refused before anything", () => {
  const email = findAction("gmail_send");
  assert.deepEqual(checkTarget(email, "{incoming.your_email}"), { value: "{incoming.your_email}" });
  assert.ok(checkTarget(findAction("slack_message"), "{incoming.channel}").error, "only an email may take its place from what arrived");
  assert.deepEqual(resolveTarget(email, "{incoming.your_email}", "", FIELDS), { value: "ana@example.com" });
  assert.match(resolveTarget(email, "{incoming.message}", "", FIELDS).error, /is not an email address/);
  assert.match(resolveTarget(email, "{incoming.your_email}", "", null).error, /not started by its start link/);
  const step = { kind: "action", fields: { action: "gmail_send", target: "{incoming.your_email}", title: "Thanks, {incoming.customer.name}", details: "{incoming.message}" } };
  assert.ok(isActionStep(step));
  const card = actionSummary(step, "", [], "me@example.com", FIELDS);
  assert.match(card, /ana@example\.com/);
  assert.match(card, /Thanks, Ana/);
  assert.match(card, /Hi\nthere ｛answer｝/);
  const none = actionSummary(step, "", [], "me@example.com", null);
  assert.match(none, /\{incoming\.your_email\}/, "without an arrival the tag itself is shown, not a made-up address");
  assert.match(none, /not started by its start link/);
});

test("a Sheet row fills each box on its own, so a comma that arrived never makes a new box", () => {
  assert.deepEqual(fillCells(["{incoming.customer.name}", "{incoming.message}"], [{ name: "customer.name", value: "Ana, B" }, { name: "message", value: "a\nb" }]), { cells: ["Ana, B", "a b"] });
  const card = sheetsSummary({ kind: "row", fields: { to: "x", values: "{incoming.customer.name}, {answer}" } }, "done", FIELDS);
  assert.match(card, /1\. Ana\n2\. done/);
  assert.match(sheetsSummary({ kind: "row", fields: { to: "x", values: "{incoming.phone}" } }, "", FIELDS), /Nothing named "phone"/);
});

// ---- the arrival keeps every field, and Replay runs them again ----
function fakeDb({ hook, event, noColumn = false } = {}) {
  const log = { inserts: [], selects: [] };
  return {
    log,
    from(table) {
      const filters = {};
      let columns = "";
      const chain = {
        select(cols) { columns = cols; return chain; },
        eq(column, value) { filters[column] = value; return chain; },
        limit() {
          log.selects.push({ table, columns, filters: { ...filters } });
          if (table === "hooks") return Promise.resolve({ data: hook && (filters.code_hash === hook.code_hash || filters.id === hook.id) && (!filters.user_id || filters.user_id === hook.user_id) ? [hook] : [], error: null });
          if (noColumn && columns.includes("fields")) return Promise.resolve({ data: null, error: { code: "42703" } });
          return Promise.resolve({ data: event && filters.id === event.id && filters.user_id === event.user_id ? [event] : [], error: null });
        },
        insert(row) {
          if (table === "hook_seen") return Promise.resolve({ error: null }); // the repeat check (lib/hook-receive.js claimKey): always a first delivery here
          log.inserts.push(row);
          const failed = noColumn && "fields" in row;
          return { select: () => Promise.resolve(failed ? { data: null, error: { code: "PGRST204" } } : { data: [{ id: `event-${log.inserts.length}` }], error: null }) };
        },
        update() { return { eq: () => Promise.resolve({ error: null }) }; },
      };
      return chain;
    },
  };
}
const made = makeCode();
const HOOK = { id: "hook-1", user_id: "user-1", workflow_id: "wf-1", enabled: true, received_count: 0, tz_offset: 0, code_hash: made.hash };
const limiter = () => ({ minute: makeLimiter({ max: 5, windowMs: 60_000 }), day: makeLimiter({ max: 60, windowMs: 86_400_000, calendar: true }) });
const arrive = (admin, runs) => receiveArrival({ admin, clientFor: () => ({}), run: async (input) => { runs.push(input); return { ok: true, runId: "run-1", auto: { waiting: 0 } }; }, nudge: async () => {}, paused: async () => false, takeSlot: async () => ({ ok: true }), limiter: limiter() }, { code: made.code, text: JSON.stringify({ email: "ana@example.com", message: "Hello" }), type: "application/json" });

test("an arrival keeps every field and hands them to the run one by one; a database without the column still saves the preview", async () => {
  const runs = [];
  const admin = fakeDb({ hook: HOOK });
  const { finish } = await arrive(admin, runs);
  assert.deepEqual(admin.log.inserts[0].fields, [{ name: "email", value: "ana@example.com" }, { name: "message", value: "Hello" }]);
  await finish();
  assert.deepEqual(runs[0].incoming.fields, admin.log.inserts[0].fields);

  const old = fakeDb({ hook: HOOK, noColumn: true });
  const second = await arrive(old, []);
  assert.equal(old.log.inserts.length, 2, "tried with every field, then saved without");
  assert.ok(!("fields" in old.log.inserts[1]) && old.log.inserts[1].preview.length === 2);
  assert.equal((await second.finish()).ok, true);
});

test("Replay runs the owner's own arrival again with the same fields, writing off, within the same limits", async () => {
  const event = { id: "ev-1", user_id: "user-1", hook_id: "hook-1", test: false, fields: [{ name: "email", value: "ana@example.com" }, { name: 3, value: "x" }] };
  const runs = [];
  const deps = (over = {}) => ({ client: fakeDb({ hook: HOOK, event }), run: async (input, who) => { runs.push({ input, who }); return { ok: true, runId: "run-9", auto: { waiting: 1 } }; }, limiter: limiter(), takeSlot: async () => ({ ok: true }), ...over });
  const done = await replayArrival(deps(), { user: { id: "user-1" } }, "ev-1");
  assert.deepEqual(done, { ok: true, runId: "run-9", waiting: 1 });
  assert.equal(runs[0].input.id, "wf-1");
  assert.equal(runs[0].input.allowWrites, false);
  assert.equal(runs[0].input.incoming.replay, true);
  assert.deepEqual(runs[0].input.incoming.fields, [{ name: "email", value: "ana@example.com" }]);
  assert.match(runs[0].input.incoming.text, /email: ana@example\.com/);

  assert.deepEqual(await replayArrival(deps(), { user: { id: "user-2" } }, "ev-1"), { error: REPLAY_ERRORS.gone }, "somebody else's arrival is never found");
  assert.deepEqual(await replayArrival(deps({ client: fakeDb({ hook: HOOK, event: { ...event, fields: null } }) }), { user: { id: "user-1" } }, "ev-1"), { error: REPLAY_ERRORS.old });
  assert.deepEqual(await replayArrival(deps({ client: fakeDb({ hook: null, event }) }), { user: { id: "user-1" } }, "ev-1"), { error: REPLAY_ERRORS.linkGone });
  assert.deepEqual(await replayArrival(deps({ client: fakeDb({ hook: HOOK, event, noColumn: true }) }), { user: { id: "user-1" } }, "ev-1"), { error: REPLAY_ERRORS.setup });
  assert.deepEqual(await replayArrival(deps({ takeSlot: async () => ({ ok: false }) }), { user: { id: "user-1" } }, "ev-1"), { error: REPLAY_ERRORS.limited });
  const full = { minute: makeLimiter({ max: 1, windowMs: 60_000 }), day: makeLimiter({ max: 60, windowMs: 86_400_000 }) };
  await replayArrival(deps({ limiter: full }), { user: { id: "user-1" } }, "ev-1");
  assert.deepEqual(await replayArrival(deps({ limiter: full }), { user: { id: "user-1" } }, "ev-1"), { error: REPLAY_ERRORS.limited });
  assert.equal(runs.length, 2, "only the allowed replays ran");
});
