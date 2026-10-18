// Tests for what the Builder opens with. Run with `npm test`. Uses a pretend database client: nothing real is read.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { builderStart } from "./builder-start.js";

const root = path.resolve(import.meta.dirname, "..");
const ID = "3f2b8c1e-1111-4222-8333-444455556666";
const ME = "user-me";

// A pretend client: records every call, and answers a query with `result` when it is awaited.
function pretend(result) {
  const calls = [];
  const chain = {
    select: (columns) => { calls.push(["select", columns]); return chain; },
    eq: (column, value) => { calls.push(["eq", column, value]); return chain; },
    then: (resolve) => resolve(result),
  };
  return { client: { from: (table) => { calls.push(["from", table]); return chain; } }, calls };
}

test("new: no parameters, or ones we do not know, start an empty workflow without asking the database", async () => {
  for (const params of [undefined, null, {}, { other: "x" }, { template: "nope" }, { template: ["invoices", "report"] }, { template: 5 }]) {
    const { client, calls } = pretend({ data: [] });
    assert.deepEqual(await builderStart(client, ME, params), { start: "new" }, JSON.stringify(params));
    assert.equal(calls.length, 0);
  }
});

test("template: a known id starts from its checked steps and request", async () => {
  const { client, calls } = pretend({ data: [] });
  const result = await builderStart(client, ME, { template: "invoices" });
  assert.equal(result.start, "template");
  assert.equal(result.name, "Chase unpaid invoices");
  assert.match(result.prompt, /^Every weekday at 9am/);
  assert.equal(result.steps.length, 5);
  assert.equal(result.steps[0].kind, "trigger");
  assert.equal(calls.length, 0, "templates need no database");
});

test("draft: an id that is not an id is refused before the database is asked", async () => {
  for (const bad of ["", "x", "1; drop table workflows", "../../etc", ID + "x", ["a", "b"], 5]) {
    const { client, calls } = pretend({ data: [] });
    assert.deepEqual(await builderStart(client, ME, { draft: bad }), { start: "missing" }, JSON.stringify(bad));
    assert.equal(calls.length, 0);
  }
});

test("draft: reads only this person's row, and hands back plain strings, steps with their kind and fields, and the version", async () => {
  const row = {
    id: ID, name: "My flow", prompt: "Do it", updated_at: "2026-10-18T10:00:00.123456+00:00",
    plan: [{ icon: "Send", title: "Send a message", detail: "By email, to x", kind: "send", fields: { how: "email", to: "x", about: "", extra: "dropped" } }, { icon: "Mail", title: "note", detail: "", user_id: "x" }],
  };
  const { client, calls } = pretend({ data: [row] });
  const result = await builderStart(client, ME, { draft: ID });
  assert.deepEqual(calls, [["from", "workflows"], ["select", "id, name, prompt, plan, updated_at"], ["eq", "id", ID], ["eq", "user_id", ME]]);
  assert.deepEqual(result.draft, { id: ID, name: "My flow", prompt: "Do it", version: "2026-10-18T10:00:00.123456+00:00" });
  assert.deepEqual(result.steps, [
    { icon: "Send", title: "Send a message", detail: "By email, to x", kind: "send", fields: { how: "email", to: "x", about: "" } },
    { icon: "Mail", title: "note", detail: "" },
  ]);
});

test("draft: not found (or not theirs) is the same answer; a broken plan column becomes an empty list; a failed read logs only a code", async () => {
  assert.deepEqual(await builderStart(pretend({ data: [] }).client, ME, { draft: ID }), { start: "missing" });
  assert.deepEqual(await builderStart(pretend({ data: null }).client, ME, { draft: ID }), { start: "missing" });
  const odd = await builderStart(pretend({ data: [{ id: ID, name: 5, prompt: null, plan: "nope", updated_at: 7 }] }).client, ME, { draft: ID });
  assert.deepEqual(odd, { start: "draft", draft: { id: ID, name: "", prompt: "", version: "" }, steps: [] });

  const logged = [];
  const original = console.error;
  console.error = (...args) => logged.push(args.join(" "));
  try {
    const failed = await builderStart(pretend({ data: null, error: { code: "57014", message: "secret detail" } }).client, ME, { draft: ID });
    assert.deepEqual(failed, { start: "failed" });
  } finally { console.error = original; }
  assert.deepEqual(logged, ["builder load failed: 57014"], "only the code, never the message");
});

test("draft wins over template when both are given", async () => {
  const { client } = pretend({ data: [{ id: ID, name: "n", prompt: "p", plan: [], updated_at: "2026-10-18T10:00:00+00:00" }] });
  assert.equal((await builderStart(client, ME, { draft: ID, template: "invoices" })).start, "draft");
});

test("builder-start.js imports nothing from Next.js, Supabase or React", () => {
  const source = fs.readFileSync(path.join(root, "lib/builder-start.js"), "utf8");
  const imports = [...source.matchAll(/^import .* from "(.+)";$/gm)].map((match) => match[1]);
  assert.deepEqual(imports, ["./validate.js", "./steps.js", "./templates.js"]);
});
