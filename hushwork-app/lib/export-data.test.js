import test from "node:test";
import assert from "node:assert/strict";
import { buildExport } from "./export-data.js";

// A pretend database that answers each table with its own rows (or error) and remembers which tables were read.
function pretend(tables) {
  const read = [];
  return { read, from: (table) => { read.push(table); const answer = tables[table] ?? { data: [], error: null }; const chain = { select: () => chain, order: () => chain, limit: () => chain, then: (resolve) => resolve(answer) }; return chain; } };
}

test("export: the person's workflows, runs and schedules, with their email, and never the saved connections", async () => {
  const supabase = pretend({ workflows: { data: [{ id: "w1", name: "A" }], error: null }, runs: { data: [{ id: "r1" }], error: null }, schedules: { data: [{ workflow_id: "w1", frequency: "daily" }], error: null } });
  const { data } = await buildExport(supabase, { email: "me@example.com" });
  assert.deepEqual(supabase.read.sort(), ["runs", "schedules", "workflows"]);
  assert.ok(!supabase.read.includes("connections"), "connections hold tokens and are never read");
  assert.equal(data.account.email, "me@example.com");
  assert.deepEqual([data.workflows.length, data.runs.length, data.schedules.length], [1, 1, 1]);
  assert.match(data.note, /never included/);
  assert.ok(!Number.isNaN(Date.parse(data.exportedAt)));
});

test("export: a table that does not exist yet is just empty, but any other problem stops the export with a plain sentence and no details", async () => {
  const missing = pretend({ schedules: { data: null, error: { code: "42P01", message: "relation does not exist" } } });
  assert.deepEqual((await buildExport(missing, { email: "a@b.co" })).data.schedules, []);
  const broken = pretend({ runs: { data: null, error: { code: "XX000", message: "internal secret detail" } } });
  const result = await buildExport(broken, { email: "a@b.co" });
  assert.equal(result.data, undefined);
  assert.ok(result.error && !result.error.includes("secret detail"));
});
