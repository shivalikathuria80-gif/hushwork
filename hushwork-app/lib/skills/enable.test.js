import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { makeFakeSupabase } from "../test-server-support.js";
import { enableBundle, disableBundle, enabledBundleIds, SKILLS_FAILED } from "./enable.js";
import { BUNDLES, findBundle } from "./bundles.js";
import { cleanPlan } from "../validate.js";

// One person with a pretend database that has the enabled_bundles table (one row per person per bundle, like the real table).
function person() {
  const user = randomUUID();
  const supabase = makeFakeSupabase({ asUser: user });
  supabase.tables.enabled_bundles = [];
  supabase.unique = { enabled_bundles: ["user_id", "bundle_id"] };
  return { user, supabase };
}
const names = (supabase) => supabase.tables.workflows.map((row) => row.name);

test("turning a bundle on saves its workflows as the person's own drafts, valid enough to open in the Builder", async () => {
  const { user, supabase } = person();
  const bundle = findBundle("finance-ops");
  const result = await enableBundle(supabase, user, "finance-ops");
  assert.equal(result.ok, true);
  assert.deepEqual(result.saved, bundle.workflows.map((w) => w.title));
  assert.deepEqual(result.skipped, []);
  assert.deepEqual(names(supabase), bundle.workflows.map((w) => w.title));
  for (const row of supabase.tables.workflows) {
    assert.equal(row.user_id, user, "the drafts belong to this person");
    assert.ok(cleanPlan(JSON.stringify(row.plan)).value, `${row.name}: the saved plan passes the same checks as any saved plan`);
  }
  assert.deepEqual([...(await enabledBundleIds(supabase, user)).ids], ["finance-ops"]);
});

test("pressing it twice (or from two tabs) saves nothing a second time", async () => {
  const { user, supabase } = person();
  assert.equal((await enableBundle(supabase, user, "dev-admin")).ok, true);
  const again = await enableBundle(supabase, user, "dev-admin");
  assert.deepEqual(again, { ok: true, already: true });
  assert.equal(supabase.tables.workflows.length, findBundle("dev-admin").workflows.length);
  assert.equal(supabase.tables.enabled_bundles.length, 1);
});

test("turning it on never makes a schedule or a run, and never touches anyone else's rows", async () => {
  const { user, supabase } = person();
  const stranger = randomUUID();
  supabase.tables.workflows.push({ id: randomUUID(), user_id: stranger, name: "Invoice Chaser", prompt: "x", plan: [] });
  await enableBundle(supabase, user, "finance-ops");
  assert.equal(supabase.tables.schedules, undefined, "no schedule table was even asked");
  assert.equal(supabase.tables.runs.length, 0, "nothing ran");
  assert.equal(supabase.tables.workflows.filter((row) => row.user_id === stranger).length, 1, "the other person's workflow of the same name is theirs, and does not count as mine");
  assert.equal(supabase.tables.workflows.filter((row) => row.user_id === user).length, 3);
});

test("a workflow the person already has (same name) is kept, not copied; the rest are still saved", async () => {
  const { user, supabase } = person();
  supabase.tables.workflows.push({ id: randomUUID(), user_id: user, name: "Invoice Chaser", prompt: "mine", plan: [] });
  const result = await enableBundle(supabase, user, "finance-ops");
  assert.deepEqual(result.skipped, ["Invoice Chaser"]);
  assert.equal(result.saved.length, 2);
  assert.equal(supabase.tables.workflows.find((row) => row.name === "Invoice Chaser").prompt, "mine", "their own version is untouched");
});

test("turning it off removes only the row; the saved workflows stay; turning it on again does not copy them", async () => {
  const { user, supabase } = person();
  await enableBundle(supabase, user, "marketing-growth");
  assert.deepEqual(await disableBundle(supabase, user, "marketing-growth"), { ok: true });
  assert.equal((await enabledBundleIds(supabase, user)).ids.size, 0);
  assert.equal(supabase.tables.workflows.length, 3, "the workflows are the person's now");
  const again = await enableBundle(supabase, user, "marketing-growth");
  assert.deepEqual(again.saved, []);
  assert.equal(again.skipped.length, 3);
});

test("an unknown bundle id is refused without touching the database; turning off asks the same", async () => {
  const { user, supabase } = person();
  for (const bad of ["nope", "", "__proto__", "constructor", 7, null, undefined, ["dev-admin"], { id: "dev-admin" }]) {
    assert.deepEqual(await enableBundle(supabase, user, bad), { error: SKILLS_FAILED.unknown }, String(bad));
    assert.deepEqual(await disableBundle(supabase, user, bad), { error: SKILLS_FAILED.unknown }, String(bad));
  }
  assert.equal(supabase.tables.enabled_bundles.length, 0);
  assert.equal(supabase.tables.workflows.length, 0);
});

test("when the table is not set up yet the person is told the one step to take, and no workflow is saved", async () => {
  const supabase = makeFakeSupabase({ asUser: randomUUID() }); // no enabled_bundles table
  assert.deepEqual(await enableBundle(supabase, "u", "dev-admin"), { error: SKILLS_FAILED.setup });
  assert.equal(supabase.tables.workflows.length, 0);
  assert.deepEqual(await disableBundle(supabase, "u", "dev-admin"), { error: SKILLS_FAILED.setup });
  const read = await enabledBundleIds(supabase, "u");
  assert.deepEqual([read.ids.size, read.missing, read.failed], [0, true, false]);
});

test("if saving a workflow fails, the 'on' row is taken back so the person can simply try again", async () => {
  const { user, supabase } = person();
  const realFrom = supabase.from;
  supabase.from = (name) => {
    const query = realFrom(name);
    if (name === "workflows") {
      const realInsert = query.insert.bind(query);
      query.insert = (values) => { realInsert(values); query.run = () => ({ data: null, error: { code: "XX000" } }); return query; };
    }
    return query;
  };
  assert.deepEqual(await enableBundle(supabase, user, "dev-admin"), { error: SKILLS_FAILED.enable });
  assert.equal(supabase.tables.enabled_bundles.length, 0, "not left half turned on");
  supabase.from = realFrom;
  assert.equal((await enableBundle(supabase, user, "dev-admin")).ok, true, "and it works on the next try");
});

test("every bundle can be turned on for a fresh person", async () => {
  for (const bundle of BUNDLES) {
    const { user, supabase } = person();
    const result = await enableBundle(supabase, user, bundle.id);
    assert.equal(result.saved.length, bundle.workflows.length, bundle.id);
  }
});
