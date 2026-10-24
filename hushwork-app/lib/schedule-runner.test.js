import test from "node:test";
import assert from "node:assert/strict";
import { runDueSchedules } from "./schedule-runner.js";

const NOW = Date.parse("2026-10-21T04:00:00Z");
const due = (extra = {}) => ({ id: "s1", user_id: "u1", workflow_id: "w1", frequency: "daily", hour: 9, minute: 0, weekday: 0, tz_offset: 330, allow_writes: false, next_run_at: "2026-10-21T03:30:00+00:00", ...extra });

// A pretend database. It answers the "which are due" question with `rows`, answers each claim with `claim(row)` and records every update.
function pretend({ rows = [], error = null, claim = () => [{ id: "x" }] } = {}) {
  const log = { selects: [], updates: [] };
  const admin = {
    from(table) {
      const state = { table, filters: [] };
      const chain = {
        select(columns) { state.select = columns; return chain; },
        update(values) { state.update = values; return chain; },
        eq(name, value) { state.filters.push(["eq", name, value]); return chain; },
        lte(name, value) { state.filters.push(["lte", name, value]); return chain; },
        order() { return chain; },
        limit() { return chain; },
        then(resolve) {
          if (state.update) {
            log.updates.push({ values: state.update, filters: state.filters });
            const wantsRows = state.select !== undefined;
            const claimed = state.update.next_run_at ? claim(state) : null;
            resolve(wantsRows ? { data: claimed, error: null } : { error: null });
          } else {
            log.selects.push(state);
            resolve({ data: error ? null : rows, error });
          }
        },
      };
      return chain;
    },
  };
  return { admin, log };
}

test("a due schedule is claimed first (only if nobody moved it), then run as its owner in Auto mode, then its outcome is written down", async () => {
  const { admin, log } = pretend({ rows: [due()] });
  const calls = [];
  const run = async (input, who) => { calls.push({ input, who }); return { ok: true, runId: "r1", auto: { done: 2, stoppedAt: 0 } }; };
  const summary = await runDueSchedules({ admin, run, now: NOW });
  assert.deepEqual(summary, { ok: true, due: 1, ran: 1, stopped: 0, failed: 0, skipped: 0 });
  assert.deepEqual(log.selects[0].filters, [["eq", "enabled", true], ["lte", "next_run_at", "2026-10-21T04:00:00.000Z"]]);
  const claim = log.updates[0];
  assert.equal(claim.values.next_run_at, "2026-10-22T03:30:00.000Z", "the next run is the next 09:00 India time, after now");
  assert.equal(claim.values.last_run_at, "2026-10-21T04:00:00.000Z");
  assert.deepEqual(claim.filters, [["eq", "id", "s1"], ["eq", "next_run_at", "2026-10-21T03:30:00+00:00"]], "only if its due time is still the one we read");
  assert.deepEqual(calls, [{ input: { id: "w1", auto: true, allowWrites: false, startedBy: "Every day at 09:00 (your time)" }, who: { user: { id: "u1" }, supabase: admin } }]);
  assert.deepEqual(log.updates[1].values, { last_status: "ok", last_run_id: "r1" });
});

test("writing steps run on a schedule only when the person ticked allow writing", async () => {
  for (const [allow, expected] of [[true, true], [false, false], [null, false], ["yes", false], [undefined, false]]) {
    const { admin } = pretend({ rows: [due({ allow_writes: allow })] });
    let seen;
    await runDueSchedules({ admin, run: async (input) => { seen = input; return { ok: true, runId: "r", auto: { done: 0, stoppedAt: 0 } }; }, now: NOW });
    assert.equal(seen.allowWrites, expected, String(allow));
  }
});

test("a schedule someone else already claimed is skipped; a run that stops, fails or crashes is written down and the next ones still run", async () => {
  const rows = [due({ id: "a" }), due({ id: "b" }), due({ id: "c" }), due({ id: "d" })];
  const { admin, log } = pretend({ rows, claim: (state) => (state.filters.some(([, name, value]) => name === "id" && value === "a") ? [] : [{ id: "x" }]) });
  const outcomes = { b: { ok: true, runId: "rb", auto: { done: 1, stoppedAt: 2 } }, c: { ok: false }, d: "crash" };
  const order = [];
  const summary = await runDueSchedules({
    admin, now: NOW,
    run: async (input, who) => {
      order.push(who.user.id);
      const index = order.length; // 1 = b, 2 = c, 3 = d
      const outcome = [outcomes.b, outcomes.c, outcomes.d][index - 1];
      if (outcome === "crash") throw new Error("boom with a private detail");
      return outcome;
    },
  });
  assert.deepEqual(summary, { ok: true, due: 4, ran: 0, stopped: 1, failed: 2, skipped: 1 });
  assert.equal(order.length, 3, "a was not run");
  const statuses = log.updates.filter((entry) => entry.values.last_status).map((entry) => [entry.filters.find(([, name]) => name === "id")[2], entry.values.last_status]);
  assert.deepEqual(statuses, [["b", "stopped"], ["c", "failed"], ["d", "failed"]]);
});

test("nothing due means nothing runs; a database error is reported without any detail", async () => {
  let ran = false;
  const run = async () => { ran = true; };
  assert.deepEqual(await runDueSchedules({ admin: pretend({ rows: [] }).admin, run, now: NOW }), { ok: true, due: 0, ran: 0, stopped: 0, failed: 0, skipped: 0 });
  assert.deepEqual(await runDueSchedules({ admin: pretend({ error: { code: "42P01", message: "SECRET detail" } }).admin, run, now: NOW }), { ok: false });
  assert.equal(ran, false);
});

test("trouble notices: sent once when a schedule goes from fine (or never run) to stopped or failed, never for ok, never again while it stays broken, and a crashing notice does not fail the run", async () => {
  const cases = [
    ["ok", "stopped", true], ["ok", "failed", true], [null, "failed", true], ["failed", "failed", false], ["stopped", "failed", false],
    ["ok", "ok", false], ["failed", "ok", false], [null, "ok", false],
  ];
  for (const [before, after, expected] of cases) {
    const { admin } = pretend({ rows: [due({ last_status: before })] });
    const told = [];
    const run = async () => (after === "failed" ? { ok: false } : { ok: true, runId: "r1", auto: after === "stopped" ? { stoppedAt: 2 } : {} });
    await runDueSchedules({ admin, run, notify: async (problem) => told.push(problem), now: NOW });
    assert.equal(told.length === 1, expected, `${before} -> ${after}`);
    if (expected) assert.deepEqual(told[0], { userId: "u1", workflowId: "w1", status: after });
  }
  const { admin, log } = pretend({ rows: [due({ last_status: "ok" })] });
  const quiet = console.error;
  console.error = () => {};
  try {
    const summary = await runDueSchedules({ admin, run: async () => ({ ok: false }), notify: async () => { throw new Error("mail is down"); }, now: NOW });
    assert.equal(summary.failed, 1);
  } finally {
    console.error = quiet;
  }
  assert.ok(log.updates.some((entry) => entry.values.last_status === "failed"), "the outcome was still written down");
});
