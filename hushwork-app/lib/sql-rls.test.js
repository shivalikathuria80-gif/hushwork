// Row Level Security (RLS) checks on the SQL files. RLS is the database's own rule that a signed-in person can only see and change THEIR rows. These tests read the
// SQL text (they do not need a database) and check that every per-person table is locked the same way, so a new table cannot be added with a hole in it.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "supabase");
// The tables that belong to one person each. (waitlist is public-insert-only and usage_counters is reached through a function: both are checked elsewhere.)
const PER_PERSON = { "workflows.sql": "workflows", "runs.sql": "runs", "connections.sql": "connections", "schedules.sql": "schedules", "memory.sql": "workflow_memories", "skills.sql": "enabled_bundles" };
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

test("RLS: every table made in supabase/ is either checked above or is one of the two known exceptions", () => {
  const found = [];
  for (const file of fs.readdirSync(dir).filter((name) => name.endsWith(".sql"))) {
    for (const match of noComments(read(file)).matchAll(/create table (?:if not exists )?public\.(\w+)/g)) found.push([file, match[1]]);
  }
  for (const [file, table] of found) {
    if (PER_PERSON[file] === table) continue;
    assert.ok(["waitlist.sql", "usage.sql"].includes(file), `${file}: the table ${table} is not covered by the RLS test: add it to PER_PERSON or explain why not`);
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
