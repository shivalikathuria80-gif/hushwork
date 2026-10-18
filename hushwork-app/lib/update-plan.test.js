// Run with: npm test   (or: node --test lib/update-plan.test.js)
// Tests the "save changed steps in place" core with a PRETEND database client (no network, no Supabase), and reads
// lib/actions/drafts.js as plain text to pin the order of checks in the Server Action.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CHANGED, FAILED, GONE, onlyNameMoved, updatePlan } from "./update-plan.js";

const ID = "3f2b8c1e-5d4a-4b7e-9c10-0a1b2c3d4e5f";
const USER = "11111111-2222-4333-8444-555555555555";
const V1 = "2026-10-17T10:15:30.123456+00:00";
const V2 = "2026-10-17T10:16:00.654321+00:00";
const goodSteps = [{ icon: "Clock", title: "Run every morning", detail: "8:00 am" }, { icon: "Mail", title: "Email each client", detail: "" }];
const plan = JSON.stringify(goodSteps);

// A pretend client. It records every call and answers from a script. `read` and `write` are the answers
// ({ data, error }) for the two queries the core makes. A `from` that throws proves the database was never touched.
function pretend({ read = { data: [{ name: "Chase invoices", plan: goodSteps, updated_at: V1 }] }, write = { data: [{ id: ID, updated_at: V2 }] } } = {}) {
  const calls = [];
  return {
    calls,
    from(table) {
      const call = { table, verb: null, updated: null, columns: null, filters: [] };
      calls.push(call);
      const chain = {
        select(columns) { call.verb ??= "read"; call.columns = columns; return chain; },
        update(values) { call.verb = "update"; call.updated = values; return chain; },
        eq(column, value) { call.filters.push([column, value]); return chain; },
        then(resolve) { resolve(call.verb === "update" ? write : read); },
      };
      return chain;
    },
  };
}
const untouchable = { from() { throw new Error("the database must not be touched"); } };
const ask = (client, overrides = {}) => updatePlan(client, { userId: USER, id: ID, version: V1, plan, ...overrides });

// console.error is silenced and recorded, so we can check what is logged.
function recordErrors(run) {
  const original = console.error;
  const logged = [];
  console.error = (...args) => logged.push(args);
  return Promise.resolve(run(logged)).finally(() => { console.error = original; });
}

test("saved: returns the new version, and the update object has exactly one key (plan)", async () => {
  const client = pretend();
  assert.deepEqual(await ask(client), { ok: true, version: V2 });
  const [read, write] = client.calls;
  assert.equal(client.calls.length, 2);
  assert.equal(read.verb, "read");
  assert.equal(write.verb, "update");
  assert.deepEqual(Object.keys(write.updated), ["plan"], "only the plan column can be written: never name, prompt, user_id, id or the times");
  assert.deepEqual(write.updated.plan, goodSteps);
  assert.equal(write.table, "workflows");
  assert.equal(write.columns, "id, updated_at");
});

test("saved: both queries are limited to this draft AND this person, and updated_at is not used as a filter", async () => {
  const client = pretend();
  await ask(client);
  for (const call of client.calls) assert.deepEqual(call.filters, [["id", ID], ["user_id", USER]], call.verb);
});

test("saved: the steps are rebuilt before they are written (extra keys dropped, text tidied, unknown icon becomes Sparkles)", async () => {
  const client = pretend();
  const messy = JSON.stringify([{ icon: "Rocket", title: "  Run\n now\u200b ", detail: "a\u0000b", user_id: "x", id: "y", key: 3 }]);
  assert.equal((await ask(client, { plan: messy })).ok, true);
  assert.deepEqual(client.calls[1].updated, { plan: [{ icon: "Sparkles", title: "Run now", detail: "a b" }] });
});

test("changed: an older version writes nothing and hands back the latest saved steps as plain data", async () => {
  const stored = [{ icon: "Bell", title: "Remind", detail: "d", extra: "no", user_id: USER }, "not a step"];
  const client = pretend({ read: { data: [{ name: "Renamed", plan: stored, updated_at: V2, user_id: USER, prompt: "secret words" }] } });
  const out = await ask(client, { version: V1 });
  assert.equal(out.why, "changed");
  assert.equal(out.error, CHANGED);
  assert.deepEqual(out.latest, { name: "Renamed", version: V2, plan: [{ icon: "Bell", title: "Remind", detail: "d" }, { icon: "", title: "", detail: "" }] });
  assert.equal(JSON.stringify(out).includes(USER), false, "no user id comes back");
  assert.equal(JSON.stringify(out).includes("secret words"), false, "no column that was not asked for comes back");
  assert.equal(client.calls.length, 1, "only the read happened");
  assert.equal(client.calls.some((call) => call.verb === "update"), false);
});

test("changed: the times are compared as exact text, so a value cut to milliseconds counts as different", async () => {
  const client = pretend();
  const out = await ask(client, { version: "2026-10-17T10:15:30.123+00:00" });
  assert.equal(out.why, "changed");
  assert.equal(client.calls.length, 1);
  assert.equal((await ask(pretend(), { version: V1 })).ok, true, "the exact text passes");
});

test("gone: no row for this person means gone, with no update (deleted, or never theirs)", async () => {
  const client = pretend({ read: { data: [] } });
  assert.deepEqual(await ask(client), { error: GONE, why: "gone" });
  assert.equal(client.calls.length, 1);
});

test("gone: deleted between the read and the write", async () => {
  const client = pretend({ write: { data: [] } });
  assert.deepEqual(await ask(client), { error: GONE, why: "gone" });
  assert.equal(client.calls.length, 2);
});

test("failed: a database error gives one plain sentence; only the short code is logged, never the message or ids", async () => {
  const secretMessage = 'relation "workflows" violates something about ' + USER;
  for (const script of [{ read: { data: null, error: { code: "57014", message: secretMessage } } }, { write: { data: null, error: { code: "23514", message: secretMessage } } }]) {
    await recordErrors(async (logged) => {
      const out = await ask(pretend(script));
      assert.deepEqual(out, { error: FAILED, why: "failed" });
      assert.equal(JSON.stringify(out).includes("violates"), false);
      assert.equal(logged.length, 1);
      assert.match(String(logged[0][1]), /^(57014|23514)$/, "the log holds a short code");
      assert.equal(JSON.stringify(logged).includes("violates"), false);
      assert.equal(JSON.stringify(logged).includes(USER), false);
      assert.equal(JSON.stringify(logged).includes("Run every"), false, "no step text in the log");
    });
  }
});

test("invalid input is refused before the database is touched", async () => {
  const hostile = [
    { id: "" }, { id: "1" }, { id: "not-a-uuid" }, { id: ID + "; drop table workflows" }, { id: null }, { id: { eq: 1 } }, { id: undefined },
    { version: "" }, { version: "x" }, { version: ", or(id.eq.1)" }, { version: 20261017 }, { version: null }, { version: "2".repeat(41) },
    { plan: "" }, { plan: "not json" }, { plan: "[]" }, { plan: "{}" }, { plan: null }, { plan: [{ icon: "Clock", title: "an array, not text", detail: "" }] },
    { plan: JSON.stringify(Array(13).fill(goodSteps[0])) },
    { plan: JSON.stringify([{ ...goodSteps[0], title: "t".repeat(201) }]) },
    { plan: JSON.stringify([{ ...goodSteps[0], detail: "d".repeat(201) }]) },
    { plan: JSON.stringify([{ ...goodSteps[0], title: "   " }]) },
    { plan: JSON.stringify([{ ...goodSteps[0], title: "\u200b\u0000" }]) },
    { plan: JSON.stringify([{ ...goodSteps[0], icon: "<script>" }]) },
    { plan: JSON.stringify([{ ...goodSteps[0], title: 5 }]) },
    { plan: JSON.stringify(["text"]) },
    { plan: "x".repeat(5_000_000) },
  ];
  for (const change of hostile) {
    const out = await ask(untouchable, change);
    assert.equal(out.why, "invalid", JSON.stringify(change).slice(0, 80));
    assert.ok(typeof out.error === "string" && out.error.length > 0);
  }
});

test("invalid: the sentence says which step to fix", async () => {
  const out = await ask(untouchable, { plan: JSON.stringify([goodSteps[0], { ...goodSteps[1], title: "" }]) });
  assert.deepEqual(out, { error: "Step 2 needs a title.", why: "invalid" });
});

test("a missing input object does not crash", async () => {
  assert.equal((await updatePlan(untouchable, { userId: USER })).why, "invalid");
});

// ---- the Server Action: the order of its checks, pinned by reading the file ----

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const actions = fs.readFileSync(path.join(root, "lib/actions/drafts.js"), "utf8");
const functionBody = (name) => {
  const start = actions.indexOf(`export async function ${name}`);
  assert.ok(start > 0, `${name} exists`);
  const next = actions.indexOf("\nexport async function ", start + 1);
  return actions.slice(start, next === -1 ? undefined : next);
};

test("updateDraft: 'use server' is first, and it asks who is calling before anything else", () => {
  assert.match(actions, /^\s*["']use server["'];?/, '"use server" is the first statement');
  const body = functionBody("updateDraft");
  const order = ["requireUser(", "createClient(", "updatePlan("].map((call) => body.indexOf(call));
  assert.ok(order.every((index) => index > 0), "all three calls are inside updateDraft");
  assert.deepEqual(order, [...order].sort((a, b) => a - b), "requireUser, then createClient, then updatePlan");
  const inside = body.slice(body.indexOf("{"));
  assert.ok(inside.indexOf("requireUser(") < inside.indexOf("input"), "the input is not even read before requireUser()");
});

test("updateDraft: refreshes the page only when the save worked, and returns the core's answer as it is", () => {
  const body = functionBody("updateDraft");
  assert.match(body, /if \(result\.ok\) revalidatePath\("\/app"\)/);
  assert.equal(body.match(/revalidatePath\(/g).length, 1);
  assert.match(body, /return result;/);
  assert.equal(body.includes("console."), false, "the action itself logs nothing; the core logs a code only");
});

test("every draft action asks who is calling first", () => {
  for (const name of ["saveDraft", "updateDraft", "renameDraft", "deleteDraft"]) {
    const body = functionBody(name);
    const firstCall = body.slice(body.indexOf("{") + 1).trim();
    assert.match(firstCall, /^(?:const user = )?await requireUser\(\);/, `${name} starts with requireUser()`);
  }
});

test("drafts.js: only async functions are exported, and no user id is ever written by an action", () => {
  assert.ok(!/export (?:const|let|var|default)\s/.test(actions), "a 'use server' file may export only async functions");
  const exported = [...actions.matchAll(/^export (\w+) /gm)].map((match) => match[1]);
  assert.ok(exported.every((word) => word === "async"));
  const code = actions.split(String.fromCharCode(10)).filter((line) => !line.trim().startsWith("//")).join(" ");
  assert.equal(code.includes("user_id"), false, "the database fills in user_id; the actions never write it");
});

test("update-plan.js: no Next.js, Supabase or server-only imports, and it writes one column", () => {
  const core = fs.readFileSync(path.join(root, "lib/update-plan.js"), "utf8");
  const imports = [...core.matchAll(/^import .* from "(.+)";$/gm)].map((match) => match[1]);
  assert.deepEqual(imports, ["./validate.js"]);
  assert.equal([...core.matchAll(/\.update\(/g)].length, 1);
  assert.match(core, /\.update\(\{ plan: steps\.value \}\)/);
});

// ---- QA round 3: answers, a false conflict after a rename, who is asking, the Composer's late-save guard ----

test("only a real save says ok: every other answer has no ok key, and a save carries nothing but the version", async () => {
  const stale = { read: { data: [{ name: "n", plan: goodSteps, updated_at: V2 }] } };
  const scripts = [stale, { read: { data: [] } }, { read: { data: null, error: { code: "57014", message: "x" } } }, { write: { data: [] } }, { write: { data: null, error: { code: "23514", message: "x" } } }];
  for (const script of scripts) {
    await recordErrors(async () => {
      const out = await ask(pretend(script));
      assert.equal("ok" in out, false, JSON.stringify(Object.keys(out)));
      assert.ok(["changed", "gone", "failed"].includes(out.why) && typeof out.error === "string");
    });
  }
  for (const change of [{ id: "x" }, { version: "x" }, { plan: "[]" }]) {
    const out = await ask(untouchable, change);
    assert.equal("ok" in out, false);
    assert.equal(out.why, "invalid");
  }
  const saved = await ask(pretend());
  assert.deepEqual(Object.keys(saved).sort(), ["ok", "version"]);
  assert.equal(saved.ok, true);
});

// A one-row pretend table that really changes when it is updated: the time moves on, as the database trigger makes it.
function pretendTable(row) {
  let clock = 0;
  const nextTime = () => `2026-10-17T11:00:0${++clock}.000000+00:00`;
  const client = {
    row, updates: 0,
    rename(name) { client.row = { ...client.row, name, updated_at: nextTime() }; },
    editElsewhere(plan) { client.row = { ...client.row, plan, updated_at: nextTime() }; },
    from() {
      let verb = null;
      let values = null;
      const chain = {
        select() { verb ??= "read"; return chain; },
        update(given) { verb = "update"; values = given; return chain; },
        eq() { return chain; },
        then(resolve) {
          if (verb === "update") {
            client.row = { ...client.row, plan: values.plan, updated_at: nextTime() };
            client.updates++;
            resolve({ data: [{ id: ID, updated_at: client.row.updated_at }] });
          } else resolve({ data: [client.row] });
        },
      };
      return chain;
    },
  };
  return client;
}

test("onlyNameMoved: a changed answer whose saved steps are still the ones this edit began from is a false conflict", () => {
  const changed = (plan) => ({ error: CHANGED, why: "changed", latest: { name: "Renamed", plan, version: V2 } });
  assert.equal(onlyNameMoved(changed(goodSteps), goodSteps), true);
  assert.equal(onlyNameMoved(changed(goodSteps.map((step) => ({ ...step, title: ` ${step.title} ` }))), goodSteps), true, "spaces only");
  assert.equal(onlyNameMoved(changed([goodSteps[0]]), goodSteps), false, "a step is missing");
  assert.equal(onlyNameMoved(changed([{ ...goodSteps[0], title: "Another title" }, goodSteps[1]]), goodSteps), false, "a title differs");
  assert.equal(onlyNameMoved(changed([goodSteps[1], goodSteps[0]]), goodSteps), false, "a different order");
  assert.equal(onlyNameMoved({ ok: true, version: V2 }, goodSteps), false);
  assert.equal(onlyNameMoved({ error: GONE, why: "gone" }, goodSteps), false);
  assert.equal(onlyNameMoved({ error: FAILED, why: "failed" }, goodSteps), false);
  assert.equal(onlyNameMoved({ why: "changed" }, goodSteps), false, "no latest copy to compare with");
  for (const nothing of [null, undefined, {}, "changed"]) assert.equal(onlyNameMoved(nothing, goodSteps), false);
});

test("a rename in the list gives one false conflict, and one silent retry with the newer version saves (QA m2)", async () => {
  const table = pretendTable({ name: "Chase invoices", plan: goodSteps, updated_at: V1 });
  const openedAt = V1;
  const edited = JSON.stringify([{ ...goodSteps[0], title: "Run at nine" }, goodSteps[1]]);
  table.rename("Chase invoices (renamed)"); // done in the list after the draft was opened
  const first = await updatePlan(table, { userId: USER, id: ID, version: openedAt, plan: edited });
  assert.equal(first.why, "changed");
  assert.equal(table.updates, 0, "nothing was written by the first try");
  assert.equal(onlyNameMoved(first, goodSteps), true, "the saved steps are still the ones the edit began from");
  const second = await updatePlan(table, { userId: USER, id: ID, version: first.latest.version, plan: edited });
  assert.equal(second.ok, true);
  assert.equal(table.updates, 1);
  assert.equal(table.row.plan[0].title, "Run at nine");
  assert.equal(table.row.name, "Chase invoices (renamed)", "the rename is kept: only the plan was written");
});

test("a REAL change in another tab is not retried: the steps differ, so the conflict is shown", async () => {
  const table = pretendTable({ name: "Chase invoices", plan: goodSteps, updated_at: V1 });
  table.editElsewhere([{ icon: "Bell", title: "Saved in the other tab", detail: "" }]);
  const first = await updatePlan(table, { userId: USER, id: ID, version: V1, plan: JSON.stringify(goodSteps) });
  assert.equal(first.why, "changed");
  assert.equal(onlyNameMoved(first, goodSteps), false);
  assert.equal(table.updates, 0);
  assert.equal(table.row.plan[0].title, "Saved in the other tab", "the other tab's steps are untouched");
});

test("updateDraft: only the signed-in user counts; a userId in the browser's input is never read (QA M20)", () => {
  const body = functionBody("updateDraft");
  assert.match(body, /userId:\s*user\.id\b/);
  assert.equal(body.match(/userId/g).length, 1, "userId appears once: as user.id");
  const fields = [...body.matchAll(/\binput\??\.(\w+)/g)].map((match) => match[1]).sort();
  assert.deepEqual(fields, ["id", "plan", "version"], "the browser can only say which draft, which version and which steps");
  assert.equal(/\buser_id\b|\buserId\b[^:]/.test(body.replace(/userId:\s*user\.id/, "")), false);
});

test("saveDraft: returns the id, name and version of the saved draft, which the screen needs to edit it in place (QA M27)", () => {
  const body = functionBody("saveDraft");
  assert.match(body, /\.select\("id, name, updated_at"\)/);
  assert.match(body, /id:\s*String\(saved\.id\)/);
  assert.match(body, /name:\s*String\(saved\.name\)/);
  assert.match(body, /version:\s*String\(saved\.updated_at\)/);
});

// ---- the Composer, read as plain text (there is no browser in `npm test`; the rendered check lives in the QA notes) ----

const composer = fs.readFileSync(path.join(root, "components/app/Composer.js"), "utf8").replace(/\r\n/g, "\n"); // the file may use Windows line ends
function composerFunction(name) {
  const start = composer.indexOf(`  function ${name}(`);
  assert.ok(start > 0, `${name} exists in Composer.js`);
  const end = composer.slice(start + 10).search(/\n  (?:function |\/\/ |const )/);
  return composer.slice(start, end === -1 ? undefined : start + 10 + end);
}

test("Composer: a save answer that arrives after the person moved on is dropped (QA M1)", () => {
  for (const name of ["save", "saveSteps", "saveAsNew"]) {
    const body = composerFunction(name);
    const mine = body.indexOf("const mine = requestId.current;");
    assert.ok(mine >= 0 && mine < body.indexOf("startSaving("), `${name} notes which screen it started on, before it starts saving`);
    const awaits = (body.match(/\bawait /g) ?? []).length;
    const checks = (body.match(/if \(mine !== requestId\.current\) return;/g) ?? []).length;
    assert.ok(awaits >= 1 && checks >= awaits + 1, `${name}: ${awaits} await(s) need ${awaits} check(s) plus one in the error path, found ${checks}`);
    assert.match(body, /unstable_rethrow\(problem\);[^\n]*\n\s*if \(mine !== requestId\.current\) return;/, `${name}: the error path checks too, right after the sign-in redirect is let through`);
  }
  assert.match(composer, /const reset = useCallback\(\(clearText\) => \{\n\s*requestId\.current \+= 1;/, "starting over bumps the number");
  assert.match(composer, /if \(!seedId\) return;\n\s*requestId\.current \+= 1;/, "opening a draft or recipe bumps the number");
});

test("Composer: a false conflict is retried once with the newer version, a real one is shown (QA m2)", () => {
  assert.match(composer, /import \{ onlyNameMoved \} from "@\/lib\/update-plan";/);
  const body = composerFunction("saveSteps");
  assert.equal((body.match(/onlyNameMoved\(result, startedFrom\)/g) ?? []).length, 1);
  assert.equal((body.match(/\bawait send\(/g) ?? []).length, 2, "the first try and exactly one retry");
  assert.match(body, /send\(adopted\.version\)/);
  assert.equal(/\bfor \(|\bwhile \(/.test(body), false, "no loop: the retry happens once");
  assert.match(body, /const startedFrom = steps;/);
});

test("Composer: the editor says unsaved changes are lost if you leave the page, only while there are changes (QA m3)", () => {
  assert.match(composer, /\{editorChanged && <p className="w-full text-sm text-mute">Unsaved changes are lost if you leave this page\.<\/p>\}/);
  assert.equal(/aria-live/.test(composer), false, "no second live region was added");
});

test("source files hold no literal invisible characters: they are written as \\u escapes so a person can see and edit them", () => {
  const files = ["lib/validate.js", "lib/validate.test.js", "lib/update-plan.js", "lib/update-plan.test.js", "lib/actions/drafts.js", "lib/ai/plan.js", "lib/ai/icon-names.js", "components/app/Composer.js", "components/app/StepEditor.js"];
  for (const file of files) {
    const text = fs.readFileSync(path.join(root, file), "utf8");
    const found = [...text.matchAll(/[\p{Cf}\u2028\u2029\u00a0]/gu)].map((match) => "U+" + match[0].codePointAt(0).toString(16));
    assert.deepEqual(found, [], `${file} has literal invisible characters`);
  }
});
