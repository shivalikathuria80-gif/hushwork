// Row Level Security (RLS) checks on the SQL files. RLS is the database's own rule that a signed-in person can only see and change THEIR rows. These tests read the
// SQL text (they do not need a database) and check that every per-person table is locked the same way, so a new table cannot be added with a hole in it.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "supabase");
// The tables that belong to one person each. (waitlist is public-insert-only and usage_counters is reached through a function: both are checked elsewhere.)
const PER_PERSON = { "workflows.sql": "workflows", "runs.sql": "runs", "connections.sql": "connections", "schedules.sql": "schedules", "memory.sql": "workflow_memories", "skills.sql": "enabled_bundles", "agent.sql": "agent_state", "api-tokens.sql": "api_tokens", "oauth.sql": "oauth_grants", "hooks.sql": "hooks" };
const read = (file) => fs.readFileSync(path.join(dir, file), "utf8").replace(/\r\n/g, "\n");
const noComments = (sql) => sql.split("\n").filter((line) => !line.trim().startsWith("--")).join("\n");

for (const [file, table] of Object.entries(PER_PERSON)) {
  test(`RLS: ${table} (${file}) is locked to its owner`, () => {
    const sql = noComments(read(file));
    assert.match(sql, new RegExp(`create table public\\.${table} \\(`), "creates the table");
    assert.match(sql, /user_id uuid not null default auth\.uid\(\) references auth\.users \(id\) on delete cascade/, "user_id is filled in by the database and cascades with the account");
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security;`), "row level security is on");
    assert.match(sql, new RegExp(`revoke all on public\\.${table} from anon;`), "the public (not signed in) gets nothing");
    assert.match(sql, new RegExp(`revoke all on public\\.${table} from authenticated;`), "everything is revoked first, then granted one by one");
    assert.ok(!new RegExp(`grant[^;]*public\\.${table}[^;]*to[^;]*anon`, "i").test(sql), "never granted to anon");
    assert.ok(!/\bto\s+public\b/i.test(sql), "never granted to public");
    assert.ok(!/using\s*\(\s*true\s*\)|with check\s*\(\s*true\s*\)/i.test(sql), "no policy that lets everyone in");

    // every policy checks that the row is the signed-in person's
    const policies = sql.match(/create policy[\s\S]*?;\n/g) ?? [];
    assert.ok(policies.length >= 2, "has policies");
    // a policy that reads its own table makes Postgres stop with error 42P17 ("infinite recursion detected in policy"): such a rule has to be a trigger
    for (const policy of policies) assert.ok(!new RegExp(`from public\\.${table}\\b`, "i").test(policy), `a policy must not look inside its own table: ${policy.slice(0, 60)}`);
    for (const policy of policies) {
      assert.match(policy, /\(select auth\.uid\(\)\) = user_id/, `a policy checks the owner: ${policy.slice(0, 60)}`);
      assert.match(policy, /to authenticated/, "only for signed-in people");
    }

    // what is granted has a policy to match, and the person can never choose user_id, id or created_at
    const grants = sql.match(/^grant .*;$/gm) ?? [];
    const ops = new Set();
    for (const grant of grants) {
      assert.match(grant, /to authenticated;$/, grant);
      for (const op of ["select", "insert", "update", "delete"]) if (new RegExp(`^grant[^(]*\\b${op}\\b`).test(grant) || new RegExp(`^grant ${op} \\(`).test(grant)) ops.add(op);
      const columns = grant.match(/\(([^)]*)\)/)?.[1] ?? "";
      assert.ok(!/\b(user_id|id|created_at)\b/.test(columns), `the person cannot choose user_id, id or created_at: ${grant}`);
    }
    for (const op of ops) assert.ok(policies.some((policy) => new RegExp(`for ${op}\\b`).test(policy)), `${table}: a ${op} policy exists for the ${op} grant`);
    for (const op of ["select", "insert", "update", "delete"]) if (policies.some((policy) => new RegExp(`for ${op}\\b`).test(policy))) assert.ok(ops.has(op), `${table}: a ${op} policy without a ${op} grant is dead code`);
  });
}

test("RLS: every table made in supabase/ is either checked above or is one of the known exceptions", () => {
  const found = [];
  for (const file of fs.readdirSync(dir).filter((name) => name.endsWith(".sql"))) {
    for (const match of noComments(read(file)).matchAll(/create table (?:if not exists )?public\.(\w+)/g)) found.push([file, match[1]]);
  }
  for (const [file, table] of found) {
    if (PER_PERSON[file] === table) continue;
    assert.ok(["waitlist.sql", "usage.sql", "app-controls.sql"].includes(file) || (file === "oauth.sql" && ["oauth_clients", "oauth_codes"].includes(table)) || (file === "hooks.sql" && table === "hook_events"), `${file}: the table ${table} is not covered by the RLS test: add it to PER_PERSON or explain why not`);
    assert.match(noComments(read(file)), new RegExp(`alter table public\\.${table} enable row level security`), `${table}: row level security is on`);
  }
  assert.ok(found.length >= 8);
});

test("the new tables: workflow memories and enabled bundles cap the rows per person and check their words in the database", () => {
  const memory = noComments(read("memory.sql"));
  assert.match(memory, /count\(\*\) from public\.workflow_memories t where t\.user_id = new\.user_id\) >= 50/, "the cap is a trigger");
  assert.match(memory, /create trigger workflow_memories_cap\s+before insert/);
  assert.match(memory, /source in \('person', 'workflow', 'ai'\)/);
  assert.match(memory, /verification_status in \('verified', 'unverified', 'rejected'\)/);
  assert.ok(!/grant insert \([^)]*(source|verification_status)/.test(memory), "a person cannot write who the fact came from or whether it is verified");
  assert.ok(!/grant update \([^)]*(source|verification_status|user_id)/.test(memory), "nor change them later");
  const skills = noComments(read("skills.sql"));
  assert.match(skills, /count\(\*\) from public\.enabled_bundles t where t\.user_id = new\.user_id\) >= 20/, "the cap is a trigger");
  assert.match(skills, /create trigger enabled_bundles_cap\s+before insert/);
  assert.match(skills, /unique \(user_id, bundle_id\)/);
  assert.match(skills, /bundle_id ~ '\^\[a-z\]\[a-z0-9-\]\{1,39\}\$'/);
  assert.ok(!/grant update/.test(skills), "a row is on or off: nothing to update");
});

test("the pause switch table: signed-in people can only READ it, nobody can change it from the app, the public gets nothing", () => {
  const sql = noComments(read("app-controls.sql"));
  assert.match(sql, /alter table public\.app_controls enable row level security;/);
  assert.match(sql, /revoke all on public\.app_controls from anon;/);
  assert.match(sql, /revoke all on public\.app_controls from authenticated;/);
  const grants = sql.match(/^grant .*;$/gm) ?? [];
  assert.deepEqual(grants, ["grant select on public.app_controls to authenticated;"], "the only grant is read");
  assert.ok(!/create policy[^;]*for (insert|update|delete|all)/i.test(sql), "no policy lets anyone write");
  assert.ok(!/\bto (anon|public)\b/i.test(sql.replace(/revoke all on public\.app_controls from anon;/, "")), "never granted to the public");
});

test("API tokens: only a hash is kept, the person never reads it back, and the token limits counter is for the all-access key only", () => {
  const tokens = noComments(read("api-tokens.sql"));
  assert.match(tokens, /token_hash text not null unique/);
  assert.match(tokens, /token_hash ~ '\^\[0-9a-f\]\{64\}\$'/, "the database refuses anything but a sha-256 hash");
  assert.ok(!/grant update/.test(tokens), "a token is never changed, only made or removed");
  const usage = noComments(read("usage-tokens.sql"));
  assert.match(usage, /revoke execute on function public\.take_usage_for\(uuid, text, integer, integer\) from public, anon, authenticated;/);
  assert.match(usage, /grant execute on function public\.take_usage_for\(uuid, text, integer, integer\) to service_role;/);
  assert.match(usage, /security definer\s+set search_path = ''/);
});

test("OAuth: chatbot clients and one-time codes are for the server only, grants are per person, and only hashes are kept", () => {
  const sql = noComments(read("oauth.sql"));
  for (const table of ["oauth_clients", "oauth_codes"]) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security;`));
    assert.match(sql, new RegExp(`revoke all on public\\.${table} from anon;`));
    assert.match(sql, new RegExp(`revoke all on public\\.${table} from authenticated;`));
    assert.ok(!new RegExp(`^grant [^;]*public\\.${table}\\b`, "m").test(sql), `${table}: never granted to anyone`);
    assert.ok(!new RegExp(`create policy[^;]*on public\\.${table}`).test(sql), `${table}: no policy, so nobody but the server`);
  }
  assert.deepEqual(sql.match(/^grant .*;$/gm), ["grant select on public.oauth_grants to authenticated;", "grant delete on public.oauth_grants to authenticated;"], "a person can only read and remove their own connections");
  for (const column of ["code_hash", "access_hash", "refresh_hash"]) assert.match(sql, new RegExp(`${column} ~ '\\^\\[0-9a-f\\]\\{64\\}\\$'`), `${column} is a sha-256 hash`);
  assert.match(sql, /code_challenge text not null/, "every code has a PKCE challenge");
});

test("start links: arrivals are written by the server only, a link is tied to the owner's own workflow, and the code can never be chosen freely", () => {
  const sql = noComments(read("hooks.sql"));
  assert.match(sql, /grant select on public\.hook_events to authenticated;/);
  assert.ok(!/grant (?:insert|update|delete)[^;]*public\.hook_events/.test(sql), "a person cannot write, change or remove arrivals");
  assert.match(sql, /create policy "people read their own arrivals" on public\.hook_events for select to authenticated using \(\(select auth\.uid\(\)\) = user_id\);/);
  assert.match(sql, /exists \(select 1 from public\.workflows w where w\.id = workflow_id and w\.user_id = \(select auth\.uid\(\)\)\)/, "a link can only be made for the person's own workflow");
  assert.match(sql, /workflow_id uuid not null unique references public\.workflows \(id\) on delete cascade/);
  assert.match(sql, /code ~ '\^hwl_\[A-Za-z0-9_-\]\{32\}\$'/);
  assert.ok(!/grant (?:insert|update) \([^)]*(received_count|last_received_at)/.test(sql), "the counters are the server's");
});
