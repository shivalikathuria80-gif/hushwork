import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { takeDbSlot } from "./db-limits.js";

const fake = (answer) => ({ rpc: async (name, args) => { fake.last = { name, args }; return answer; } });

test("db limits: ok and over-limit answers, asking for this person's own counter by bucket name", async () => {
  assert.deepEqual(await takeDbSlot(fake({ data: "ok", error: null }), "ai_plan", 2, 20), { ok: true });
  assert.deepEqual(fake.last, { name: "take_usage", args: { p_bucket: "ai_plan", p_per_minute: 2, p_per_day: 20 } });
  assert.deepEqual(await takeDbSlot(fake({ data: "limit_minute", error: null }), "ai_plan", 2, 20), { ok: false, why: "limit_minute" });
  assert.deepEqual(await takeDbSlot(fake({ data: "limit_day", error: null }), "ai_plan", 2, 20), { ok: false, why: "limit_day" });
});

test("db limits: a missing table, an error or a crash lets the request through (the in-memory limits still apply) and logs only a short code", async () => {
  const logged = [];
  const original = console.log;
  console.log = (line) => logged.push(line);
  try {
    assert.deepEqual(await takeDbSlot(fake({ data: null, error: { code: "PGRST202", message: "secret details" } }), "x", 1, 1), { ok: true });
    assert.deepEqual(await takeDbSlot({ rpc: async () => { throw new Error("boom with details"); } }, "x", 1, 1), { ok: true });
  } finally {
    console.log = original;
  }
  assert.deepEqual(logged, ["usage-limit skipped code=PGRST202", "usage-limit skipped code=exception"]);
});

test("db limits: the scheduled-run client has no signed-in person, so it skips the check", async () => {
  const admin = { __hushworkAdmin: true, rpc: async () => { throw new Error("must not be called"); } };
  assert.deepEqual(await takeDbSlot(admin, "ai_step", 3, 15), { ok: true });
});

test("db limits: every approval that writes or spends (AI step, email and other actions, Linear task, sheet row) checks the database count before it goes out", () => {
  const core = fs.readFileSync(new URL("./run-core.js", import.meta.url), "utf8");
  const checks = [
    ["approveActionStep", 'dbLimitError(supabase, "action"', "runActionTool("],
    ["approveLinearCreate", 'dbLimitError(supabase, "linear_create"', "fetchImpl"],
    ["approveSheetsRow", 'dbLimitError(supabase, "sheets_row"', "appendRow("],
    ["approveAiStep", 'takeDbSlot(supabase, "ai_step"', "runAgent("],
  ];
  for (const [fn, check, send] of checks) {
    const body = core.slice(core.indexOf(`export async function ${fn}`));
    const end = body.indexOf(String.fromCharCode(10) + "}" + String.fromCharCode(10));
    const text = body.slice(0, end);
    assert.ok(text.includes(check), `${fn} checks the database count`);
    const sendAt = text.indexOf(send);
    if (sendAt > 0) assert.ok(text.indexOf(check) < sendAt, `${fn} checks before it sends`);
  }
});

