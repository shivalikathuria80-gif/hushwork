import test from "node:test";
import assert from "node:assert/strict";
import { isPaused, PAUSED_MESSAGE } from "./app-controls.js";

const answering = (result) => ({ from: (table) => { assert.equal(table, "app_controls"); const q = { select: () => q, eq: (c, v) => { assert.deepEqual([c, v], ["name", "paused"]); return q; }, limit: async () => result }; return q; } });

test("the pause switch: only a row that says true pauses; a missing table, an error or an odd answer means NOT paused", async () => {
  assert.equal(await isPaused(answering({ data: [{ value: true }], error: null })), true);
  for (const result of [{ data: [{ value: false }], error: null }, { data: [], error: null }, { data: null, error: { code: "42P01" } }, { data: "x", error: null }, { data: [{ value: "true" }], error: null }, { data: [{}], error: null }]) assert.equal(await isPaused(answering(result)), false, JSON.stringify(result));
  assert.equal(await isPaused({ from: () => { throw new Error("down"); } }), false);
  assert.match(PAUSED_MESSAGE, /paused/);
});
