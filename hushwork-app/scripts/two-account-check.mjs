// THE TWO-ACCOUNT PRIVACY CHECK. Run it yourself, with two THROWAWAY accounts (make them on the sign-up page, for example test-a@... and test-b@...).
// It proves, against the REAL database, what the privacy rules are supposed to guarantee: person B can never see, change, delete or write into person A's
// data, and a visitor who is not signed in gets nothing. It does the same attempts the browser's public key could make. It never touches any other account:
// it only creates a few tiny rows for A, tries everything as B and as a visitor, and deletes A's rows again.
//
//   PowerShell (inside hushwork-app):
//     $env:CHECK_A_EMAIL="test-a@example.com"; $env:CHECK_A_PASSWORD="..."; $env:CHECK_B_EMAIL="test-b@example.com"; $env:CHECK_B_PASSWORD="..."
//     npm run check:privacy
//
// The two passwords are only read from your own terminal for this one command (they are never saved or printed). Every line says PASS or FAIL; the
// exit code is 1 if anything failed. A table that is not set up yet in your database is skipped, not failed.
import { createClient } from "@supabase/supabase-js";

const need = (name, value) => {
  if (!value) { console.error(`Missing ${name}. See the top of scripts/two-account-check.mjs.`); process.exit(2); }
  return value;
};
const url = need("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
const key = need("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
const accounts = {
  a: [need("CHECK_A_EMAIL", process.env.CHECK_A_EMAIL), need("CHECK_A_PASSWORD", process.env.CHECK_A_PASSWORD)],
  b: [need("CHECK_B_EMAIL", process.env.CHECK_B_EMAIL), need("CHECK_B_PASSWORD", process.env.CHECK_B_PASSWORD)],
};
if (accounts.a[0].toLowerCase() === accounts.b[0].toLowerCase()) { console.error("The two accounts must be different."); process.exit(2); }

const fresh = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const missing = (error) => error?.code === "42P01" || error?.code === "PGRST205";
let failed = 0;
const report = (ok, text) => { if (!ok) failed += 1; console.log(`${ok ? "PASS" : "FAIL"}  ${text}`); };
const skip = (text) => console.log(`skip  ${text} (not set up in this database)`);

async function signIn(label, [email, password]) {
  const client = fresh();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data?.user) { console.error(`Could not sign in as ${label} (${error?.message ?? "no user"}).`); process.exit(2); }
  return { client, id: data.user.id };
}
const a = await signIn("A", accounts.a);
const b = await signIn("B", accounts.b);
const visitor = fresh();
const mark = `privacy-check-${Date.now()}`;

// ---- A makes one small row in every per-person table ----
const made = {}; // table -> id
async function plant(table, values) {
  const { data, error } = await a.client.from(table).insert(values).select("id");
  if (error) { if (missing(error)) { skip(table); return; } report(false, `A could not add a row to ${table} (${error.code}), so it cannot be checked`); return; }
  made[table] = data[0].id;
}
await plant("workflows", { name: mark, prompt: mark, plan: [] });
const workflowId = made.workflows;
await plant("workflow_memories", { scope: "general", key: mark, value: "check" });
await plant("enabled_bundles", { bundle_id: "finance-ops" });
if (workflowId) {
  await plant("runs", { workflow_id: workflowId, workflow_name: mark, mode: "practice", status: "done", results: [] });
  await plant("schedules", { workflow_id: workflowId, frequency: "daily", hour: 3, minute: 0, weekday: 0, tz_offset: 0, allow_writes: false, enabled: false, next_run_at: new Date(Date.now() + 86_400_000).toISOString() });
}

// ---- B and the visitor try everything against A's rows ----
for (const [table, id] of Object.entries(made)) {
  for (const [who, client] of [["B", b.client], ["a visitor", visitor]]) {
    const seen = await client.from(table).select("id").eq("id", id);
    report(!seen.error ? (seen.data ?? []).length === 0 : true, `${who} cannot read A's ${table} row`);
    const removed = await client.from(table).delete().eq("id", id).select("id");
    report(removed.error ? true : (removed.data ?? []).length === 0, `${who} cannot delete A's ${table} row`);
  }
  const all = await b.client.from(table).select("user_id").limit(200);
  report(!all.error && (all.data ?? []).every((row) => row.user_id === b.id), `B's own list of ${table} holds only B's rows`);
  const stillThere = await a.client.from(table).select("id").eq("id", id);
  report((stillThere.data ?? []).length === 1, `A's ${table} row is still there after B and the visitor tried to delete it`);
}
// changing A's data
for (const [table, column, value] of [["workflows", "name", "hacked"], ["workflow_memories", "value", "hacked"], ["schedules", "enabled", true]]) {
  if (!made[table]) continue;
  const changed = await b.client.from(table).update({ [column]: value }).eq("id", made[table]).select("id");
  report(changed.error ? true : (changed.data ?? []).length === 0, `B cannot change A's ${table} row`);
}
// writing into A's account
if (workflowId) {
  const asA = await b.client.from("workflows").insert({ name: mark, prompt: mark, plan: [], user_id: a.id }).select("id");
  report(Boolean(asA.error), "B cannot create a workflow that belongs to A (the owner cannot be chosen)");
  if (asA.data?.length) await a.client.from("workflows").delete().in("id", asA.data.map((row) => row.id));
  const run = await b.client.from("runs").insert({ workflow_id: workflowId, workflow_name: mark, mode: "live", status: "done", results: [] }).select("id");
  report(Boolean(run.error), "B cannot add a run under A's workflow");
  const schedule = await b.client.from("schedules").insert({ workflow_id: workflowId, frequency: "daily", hour: 3, minute: 0, weekday: 0, tz_offset: 0, allow_writes: true, enabled: true, next_run_at: new Date().toISOString() }).select("id");
  report(Boolean(schedule.error), "B cannot schedule A's workflow (and so cannot make it run, or write, as A)");
}
// the visitor writes nothing anywhere
for (const [table, values] of [["workflows", { name: mark, prompt: mark, plan: [] }], ["workflow_memories", { scope: "general", key: mark, value: "x" }], ["enabled_bundles", { bundle_id: "finance-ops" }]]) {
  const attempt = await visitor.from(table).insert(values).select("id");
  if (missing(attempt.error)) { skip(`${table} (visitor)`); continue; }
  report(Boolean(attempt.error), `a visitor who is not signed in cannot add to ${table}`);
}
// nobody can flip the pause switch or edit the saved app connections from the browser
const switchRow = await b.client.from("app_controls").update({ value: true }).eq("name", "paused").select("name");
if (missing(switchRow.error)) skip("app_controls"); else report(switchRow.error ? true : (switchRow.data ?? []).length === 0, "B cannot flip the pause switch");
const tokens = await b.client.from("connections").select("user_id").limit(50);
if (missing(tokens.error)) skip("connections"); else report(!tokens.error && (tokens.data ?? []).every((row) => row.user_id === b.id), "B's list of saved app connections holds only B's own");

// ---- clean up: A removes its rows (the workflow last, because the others point at it) ----
for (const table of ["schedules", "runs", "workflow_memories", "enabled_bundles", "workflows"]) if (made[table]) await a.client.from(table).delete().eq("id", made[table]);
const leftover = workflowId ? await a.client.from("workflows").select("id").eq("name", mark) : { data: [] };
report((leftover.data ?? []).length === 0, "the check's own rows were cleaned up");

console.log(failed ? `\n${failed} check(s) FAILED. Do not launch until they pass: tell Claude which lines said FAIL.` : "\nAll checks passed.");
process.exit(failed ? 1 : 0);
