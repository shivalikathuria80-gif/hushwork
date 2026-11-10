// Start link data controls: retention, the per-link daily limit, delete and export (lib/hook-data.js, lib/hook-export.js, lib/hook-prune.js,
// the cap inside lib/hook-receive.js, supabase/hooks-data.sql).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CAP_MAX, DEFAULT_KEEP, KEEP_DAYS, checkCap, dayStart, deletesAt, exportName, exportRow, readCap, readKeep, toCsv } from "./hook-data.js";
import { buildArrivalsExport } from "./hook-export.js";
import { countStartedSince, pruneArrivals } from "./hook-prune.js";
import { ANSWERS, receiveArrival } from "./hook-receive.js";
import { makeCode } from "./hooks.js";
import { makeLimiter } from "./ai/limits.js";

test("keep days and daily limits only take the allowed values", () => {
  assert.deepEqual(KEEP_DAYS, [1, 7, 30, 90]);
  assert.equal(readKeep(7), 7);
  for (const bad of [0, 5, "30", null, undefined, 91]) assert.equal(readKeep(bad), DEFAULT_KEEP);
  assert.equal(readCap(10), 10);
  for (const bad of [0, 61, 2.5, "10", null]) assert.equal(readCap(bad), null);
  assert.deepEqual(checkCap(null), { value: null });
  assert.deepEqual(checkCap(""), { value: null });
  assert.deepEqual(checkCap(" 12 "), { value: 12 });
  assert.deepEqual(checkCap(CAP_MAX), { value: CAP_MAX });
  for (const bad of [0, 61, -1, 1.5, "1e1", "abc", {}, true]) assert.ok(checkCap(bad).error, `refused: ${JSON.stringify(bad)}`);
});

test("the owner's day starts at their own midnight", () => {
  const now = Date.parse("2026-11-10T20:00:00Z"); // 01:30 on the 11th in India
  assert.equal(dayStart(now, 330), "2026-11-10T18:30:00.000Z");
  assert.equal(dayStart(now, 0), "2026-11-10T00:00:00.000Z");
  assert.equal(dayStart(Date.parse("2026-11-10T03:00:00Z"), -300), "2026-11-09T05:00:00.000Z"); // New York, still the 9th
  assert.equal(deletesAt("2026-11-10T00:00:00Z", 7), "2026-11-17T00:00:00.000Z");
  assert.equal(deletesAt("nope", 7), "");
});

test("the CSV never lets a spreadsheet run a stranger's words, and keeps every arrival on one row", () => {
  const rows = [
    exportRow({ created_at: "2026-11-10T10:00:00Z", status: "started", test: false, run_id: "r1", preview: [{ name: "email", value: "=HYPERLINK(\"http://x\")" }, { name: "note", value: "say \"hi\"" }, { bad: 1 }] }, { incoming: "email: =1+1\nnote: hi" }, "Lead reply"),
    exportRow({ created_at: "2026-11-10T11:00:00Z", status: "capped", test: true, run_id: null, preview: "junk" }, null, "Lead reply"),
  ];
  assert.deepEqual(rows[0].fields, [{ name: "email", value: "=HYPERLINK(\"http://x\")" }, { name: "note", value: "say \"hi\"" }]);
  assert.equal(rows[1].full_text, "");
  assert.deepEqual(rows[1].fields, []);
  const csv = toCsv(rows);
  assert.ok(csv.startsWith("﻿\"time\",\"workflow\""));
  assert.ok(csv.includes("\"email: =HYPERLINK(\"\"http://x\"\")\nnote: say \"\"hi\"\"\""), "quotes are doubled inside a cell");
  const risky = toCsv([exportRow({ created_at: "t", status: "started", preview: [] }, { incoming: "=cmd|' /C calc'!A0" }, "+SUM(A1)"), exportRow({ created_at: "t", status: "x", preview: [] }, { incoming: "@x" }, "-2")]);
  for (const cellText of ["\"'=cmd|' /C calc'!A0\"", "\"'+SUM(A1)\"", "\"'@x\"", "\"'-2\""]) assert.ok(risky.includes(cellText), `made plain text: ${cellText}`);
  assert.ok(!/(^|,)"[=+@-]/m.test(risky), "no cell starts with a formula sign");
  assert.equal(csv.trimEnd().split("\r\n").length, 3, "a header and one line per arrival (new lines inside cells stay inside quotes)");
  assert.equal(exportName("Lead réply / Ana!", "2026-11-10T09:00:00Z", "csv"), "hushwork-arrivals-lead-reply-ana-2026-11-10.csv");
  assert.equal(exportName("", "2026-11-10", "json"), "hushwork-arrivals-all-2026-11-10.json");
});

// A small stand-in for the Supabase client: records filters, answers from tables.
function fakeClient(tables, { failOn = "" } = {}) {
  const asked = [];
  return {
    asked,
    from(table) {
      const query = { table, filters: [], select: "" };
      const run = () => {
        asked.push(query);
        if (failOn === table) return Promise.resolve({ data: null, error: { code: "X" } });
        let rows = [...(tables[table] ?? [])];
        for (const [op, column, value] of query.filters) rows = rows.filter((row) => (op === "eq" ? row[column] === value : op === "in" ? value.includes(row[column]) : true));
        if (query.select.includes("start:results->0")) rows = rows.map((row) => ({ id: row.id, start: row.results?.[0] ?? null }));
        return Promise.resolve({ data: rows, error: null });
      };
      const chain = {
        select(columns) { query.select = columns; return chain; },
        eq(column, value) { query.filters.push(["eq", column, value]); return chain; },
        in(column, value) { query.filters.push(["in", column, value]); return chain; },
        order() { return chain; },
        limit() { return run(); },
        then(resolve, reject) { return run().then(resolve, reject); },
      };
      return chain;
    },
  };
}

const ME = { id: "u1" };
const H1 = "11111111-1111-4111-8111-111111111111";
const H2 = "22222222-2222-4222-8222-222222222222";
const R1 = "33333333-3333-4333-8333-333333333333";
const TABLES = {
  hooks: [{ id: H1, workflow_id: "w1", user_id: "u1" }, { id: H2, workflow_id: "w2", user_id: "u2" }],
  workflows: [{ id: "w1", name: "Lead reply", user_id: "u1" }, { id: "w2", name: "Not mine", user_id: "u2" }],
  hook_events: [
    { id: "e1", hook_id: H1, user_id: "u1", status: "started", run_id: R1, preview: [{ name: "email", value: "ana@example.com" }], test: false, created_at: "2026-11-10T10:00:00Z" },
    { id: "e2", hook_id: H2, user_id: "u2", status: "started", run_id: null, preview: [{ name: "email", value: "theirs@example.com" }], test: false, created_at: "2026-11-10T10:00:00Z" },
  ],
  runs: [{ id: R1, user_id: "u1", results: [{ outcome: "Started", incoming: "email: ana@example.com\nmessage: hello" }, { outcome: "AI" }] }],
};

test("an export holds only the person's own arrivals, with the full words from their runs", async () => {
  const client = fakeClient(TABLES);
  const all = await buildArrivalsExport(client, ME, "");
  assert.equal(all.rows.length, 1);
  assert.equal(all.rows[0].workflow, "Lead reply");
  assert.equal(all.rows[0].full_text, "email: ana@example.com\nmessage: hello");
  for (const query of client.asked) assert.ok(query.filters.some(([op, column, value]) => op === "eq" && column === "user_id" && value === "u1"), `${query.table} is asked for the person's own rows`);
  assert.ok(client.asked.find((query) => query.table === "runs").select.includes("results->0"), "only the Start step of each run is read");

  const one = await buildArrivalsExport(fakeClient(TABLES), ME, H1);
  assert.equal(one.workflow, "Lead reply");
  assert.deepEqual(await buildArrivalsExport(fakeClient(TABLES), ME, H2), { error: "That start link no longer exists.", status: 404 });
  assert.equal((await buildArrivalsExport(fakeClient(TABLES), ME, "../etc")).status, 404);
  assert.equal((await buildArrivalsExport(fakeClient(TABLES, { failOn: "hook_events" }), ME, "")).status, 500);
  assert.deepEqual(await buildArrivalsExport(fakeClient({ ...TABLES, hooks: [] }), ME, ""), { rows: [], workflow: "" });
});

test("counting and pruning: a missing setup step is quiet, a real error is not fatal", async () => {
  const counter = { from: () => { const c = { select: () => c, eq: () => c, gte: () => Promise.resolve({ count: 3, error: null }) }; return c; } };
  assert.equal(await countStartedSince(counter, "h", "2026-11-10T00:00:00Z"), 3);
  const broken = { from: () => { const c = { select: () => c, eq: () => c, gte: () => Promise.resolve({ count: null, error: { code: "X" } }) }; return c; } };
  assert.equal(await countStartedSince(broken, "h", "x"), null);
  const calls = [];
  assert.equal(await pruneArrivals({ rpc: async (name, args) => { calls.push([name, args]); return { data: 4, error: null }; } }, "h1"), 4);
  assert.deepEqual(calls, [["prune_arrivals", { p_hook: "h1" }]]);
  assert.equal(await pruneArrivals({ rpc: async () => ({ data: null, error: { code: "42883" } }) }), 0);
  assert.equal(await pruneArrivals(null), 0);
});

// ---- the cap and the prune inside a real arrival ----------------------------------------------------------------------------------------
const made = makeCode();
function fakeAdmin(hook, { noColumns = false } = {}) {
  const log = { events: [], selects: [] };
  return {
    log,
    from(table) {
      let columns = "";
      const chain = {
        select(value) { columns = value; return chain; },
        eq() { return chain; },
        lt() { return chain; },
        delete() { return chain; },
        then(resolve, reject) { return Promise.resolve({ data: [], error: null }).then(resolve, reject); },
        limit() {
          log.selects.push(columns);
          if (noColumns && columns.includes("keep_days")) return Promise.resolve({ data: null, error: { code: "42703" } });
          const row = noColumns ? Object.fromEntries(Object.entries(hook).filter(([key]) => !["keep_days", "daily_cap"].includes(key))) : hook;
          return Promise.resolve({ data: [row], error: null });
        },
        insert(row) { if (table === "hook_events") log.events.push(row); return { select: () => Promise.resolve({ data: [{ id: `e${log.events.length}` }], error: null }) }; },
        update() { return { eq: () => { const answer = Promise.resolve({ error: null, data: [{ id: "e" }] }); answer.select = () => answer; return answer; } }; },
      };
      return chain;
    },
  };
}
function deps(hook, extra = {}) {
  const calls = { runs: 0, counted: [], pruned: [] };
  return {
    calls,
    admin: fakeAdmin({ id: "h1", user_id: "u1", workflow_id: "w1", enabled: true, received_count: 0, tz_offset: 330, code_hash: made.hash, ...hook }, extra),
    clientFor: () => ({}),
    run: async () => { calls.runs += 1; return { ok: true, runId: "r1", auto: { waiting: 0 } }; },
    nudge: async () => {},
    paused: async () => false,
    takeSlot: async () => ({ ok: true }),
    limiter: { minute: makeLimiter({ max: 5, windowMs: 60_000 }), day: makeLimiter({ max: 60, windowMs: 86_400_000, calendar: true }), noise: makeLimiter({ max: 3, windowMs: 60_000 }) },
    now: Date.parse("2026-11-10T20:00:00Z"),
    countToday: async (hookId, since) => { calls.counted.push([hookId, since]); return extra.today ?? 0; },
    prune: async (hookId) => { calls.pruned.push(hookId); },
  };
}
const arrive = (d) => receiveArrival(d, { code: made.code, text: "{\"email\":\"a@b.co\"}", type: "application/json" });

test("a link's own daily limit stops runs once reached, counted from the owner's midnight, and writes the refusal down quietly", async () => {
  const full = deps({ keep_days: 30, daily_cap: 2 }, { today: 2 });
  const refused = await arrive(full);
  assert.deepEqual(refused.answer, ANSWERS.capped);
  assert.equal(refused.finish, undefined, "nothing runs");
  assert.deepEqual(full.calls.counted, [["h1", "2026-11-10T18:30:00.000Z"]], "today began at midnight in India");
  assert.equal(full.admin.log.events[0].status, "capped");
  for (let i = 0; i < 6; i += 1) await arrive(full);
  assert.ok(full.admin.log.events.length <= 3, "a link knocked on over its limit cannot fill the table");

  const room = deps({ keep_days: 7, daily_cap: 2 }, { today: 1 });
  const ok = await arrive(room);
  assert.deepEqual(ok.answer, ANSWERS.received);
  await ok.finish();
  assert.equal(room.calls.runs, 1);
  assert.deepEqual(room.calls.pruned, ["h1"], "old arrivals of this link are pruned after the run");

  const uncounted = deps({ keep_days: 30, daily_cap: 1 }, { today: null });
  assert.deepEqual((await arrive(uncounted)).answer, ANSWERS.received, "a count that cannot be read falls back to the account limits");

  const noCap = deps({ keep_days: 30, daily_cap: null });
  assert.deepEqual((await arrive(noCap)).answer, ANSWERS.received);
  assert.equal(noCap.calls.counted.length, 0, "no own limit: nothing extra is counted");
});

test("before hooks-data.sql is run, a link still works exactly as before", async () => {
  const old = deps({}, { noColumns: true });
  const result = await arrive(old);
  assert.deepEqual(result.answer, ANSWERS.received);
  assert.equal(old.admin.log.selects.length, 3, "asked again without the new columns");
  assert.ok(!old.admin.log.selects[2].includes("keep_days"));
  await result.finish();
  assert.equal(old.calls.runs, 1);
  assert.equal(old.calls.pruned.length, 0, "nothing to prune without the setup step");
  assert.equal(old.calls.counted.length, 0);
});

// ---- the SQL text ----------------------------------------------------------------------------------------------------------------------
const sql = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "supabase", "hooks-data.sql"), "utf8").split("\n").filter((line) => !line.trim().startsWith("--")).join("\n");

test("hooks-data.sql: a person changes only their own settings and deletes only their own arrivals; pruning is the server's", () => {
  assert.deepEqual(sql.match(/^grant .*;$/gm), [
    "grant update (keep_days, daily_cap) on public.hooks to authenticated;",
    "grant execute on function public.scrub_arrival_text(uuid[], uuid) to service_role;",
    "grant execute on function public.forget_arrivals(uuid, uuid) to authenticated;",
    "grant execute on function public.prune_arrivals(uuid) to service_role;",
  ]);
  assert.ok(!/grant[^;]*hook_events/.test(sql), "arrivals are still never written by a person directly");
  assert.match(sql, /revoke execute on function public\.scrub_arrival_text\(uuid\[\], uuid\) from public, anon, authenticated;/);
  assert.match(sql, /revoke execute on function public\.prune_arrivals\(uuid\) from public, anon, authenticated;/);
  assert.match(sql, /revoke execute on function public\.forget_arrivals\(uuid, uuid\) from public, anon;/);
  assert.match(sql, /if v_owner is null or v_owner is distinct from auth\.uid\(\) then return -1; end if;/, "forget checks the owner first");
  for (const fn of sql.match(/create or replace function[\s\S]*?\$\$;/g)) {
    assert.match(fn, /security definer/);
    assert.match(fn, /set search_path = ''/, "every function pins its search path");
  }
  assert.match(sql, /check \(keep_days in \(1, 7, 30, 90\)\)/);
  assert.match(sql, /check \(daily_cap is null or daily_cap between 1 and 60\)/);
  assert.match(sql, /'started', 'limited', 'off', 'failed', 'refused', 'duplicate', 'capped'/);
  assert.match(sql, /r\.user_id = u\.owner_id/, "pruning scrubs only the owner's own runs");
  assert.match(sql, /r\.user_id = p_owner/, "deleting scrubs only the owner's own runs");
});

test("a burst at a link with its own limit cannot all slip through, and a run whose arrival was deleted meanwhile loses its words", async () => {
  const d = deps({ keep_days: 30, daily_cap: 2 }, { today: 0 });
  d.countToday = async () => { await new Promise((done) => setTimeout(done, 5)); return 0; };
  const answers = await Promise.all(Array.from({ length: 5 }, () => arrive(d)));
  assert.equal(answers.filter((one) => one.answer.status === 202).length, 2, "only the cap's worth start");

  const gone = deps({ keep_days: 30, daily_cap: null });
  const scrubbed = [];
  gone.scrub = async (runId, owner) => { scrubbed.push([runId, owner]); };
  gone.admin.from = ((original) => (table) => {
    const chain = original(table);
    if (table === "hook_events") chain.update = () => ({ eq: () => ({ select: () => Promise.resolve({ data: [], error: null }) }) });
    return chain;
  })(gone.admin.from.bind(gone.admin));
  await (await arrive(gone)).finish();
  assert.deepEqual(scrubbed, [["r1", "u1"]]);
});
