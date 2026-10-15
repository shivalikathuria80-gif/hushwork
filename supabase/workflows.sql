-- The "workflows" table: one row per saved draft in Hushwork.
-- A draft is only a saved "Preview plan" (the task text plus the steps shown on screen). Nothing runs.
-- Design notes live in docs/plan.md, section 5.
--
-- STATUS: written, NOT applied yet. Applying changes the hosted Supabase project "hushwork"
-- (region ap-south-1), so the owner approves it first. When applied, record it as ONE migration named
-- "create_workflows_table", the same way supabase/waitlist.sql records its migrations.
--
-- Plain-words glossary:
--   table  = a spreadsheet inside the database; each draft is one row.
--   RLS    = Row Level Security: rules the database itself enforces about which rows a person may touch.
--   policy = one such rule.
--   grant  = permission to use the table at all (separate from RLS: grants decide WHETHER you may knock,
--            RLS decides WHICH rows you may see once inside).

create table public.workflows (
  id uuid primary key default gen_random_uuid(),

  -- Who owns the draft. Filled in automatically from the signed-in person, so the app never sends it
  -- (and a person can never claim a draft for somebody else).
  -- If the account is deleted (Dashboard > Authentication > Users), their drafts are deleted with it.
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,

  name text not null,                        -- the title shown in "Your drafts"
  prompt text not null,                      -- the task as the person typed it
  plan jsonb not null default '[]'::jsonb,   -- the preview steps: a JSON list like [{"icon":"Clock","title":"...","detail":"..."}]
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Limits live in the database too, because the browser can be bypassed.
  constraint workflows_name_length check (char_length(btrim(name)) between 1 and 120),
  constraint workflows_prompt_length check (char_length(btrim(prompt)) between 1 and 2000),
  constraint workflows_plan_is_array check (jsonb_typeof(plan) = 'array'),
  constraint workflows_plan_size check (octet_length(plan::text) <= 20000)
);

-- The list page asks "my drafts, newest first", and Postgres needs an index on the foreign key anyway.
-- user_id leads, so this one index serves both jobs.
create index workflows_user_id_updated_at_idx on public.workflows (user_id, updated_at desc);

-- Keeps updated_at honest without the app having to remember (and without letting a person forge it).
-- SECURITY INVOKER = it runs with the caller's own permissions, not a more powerful role's.
-- An empty search_path stops anyone from tricking it into calling a look-alike function.
create function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger workflows_set_updated_at
before update on public.workflows
for each row execute function public.set_updated_at();

-- Row Level Security ON: with no matching policy, a row is invisible and untouchable.
alter table public.workflows enable row level security;

-- Grants, in two steps. First take everything away from both public roles ...
revoke all on public.workflows from anon;
revoke all on public.workflows from authenticated;
-- ... then give back only what a signed-in person needs. "anon" (not signed in) gets nothing at all.
-- Column lists keep id, user_id, created_at and updated_at out of reach: a person can write the three
-- content columns and nothing else. (service_role, used only from the Supabase dashboard, keeps its defaults.)
grant select, delete on public.workflows to authenticated;
grant insert (name, prompt, plan) on public.workflows to authenticated;
grant update (name, prompt, plan) on public.workflows to authenticated;

-- Policies: every one says "signed-in people only" (TO authenticated) AND "only rows that are mine".
-- "(select auth.uid())" is written with the select on purpose: Postgres then evaluates it once per query
-- instead of once per row. Never use user_metadata in a policy; people can edit their own.
create policy "owner can read own workflows"
  on public.workflows for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "owner can add own workflows"
  on public.workflows for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- UPDATE needs both parts: USING picks which rows may be edited, WITH CHECK stops the edited row from
-- being handed to someone else. (An update also needs the select policy above, or it silently changes 0 rows.)
create policy "owner can edit own workflows"
  on public.workflows for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "owner can delete own workflows"
  on public.workflows for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------------------------------
-- AFTER APPLYING, check it (read-only queries, safe to run any time):
--   select relname, relrowsecurity from pg_class where oid = 'public.workflows'::regclass;   -- true
--   select policyname, cmd, roles from pg_policies where tablename = 'workflows';           -- 4 rows
--   select grantee, privilege_type from information_schema.role_table_grants
--     where table_name = 'workflows' and grantee in ('anon', 'authenticated');              -- nothing for anon
-- Then run the Supabase security and performance advisors; both should stay clean.
--
-- ROLLBACK (removes the table AND every saved draft; only run it on purpose):
--   drop table public.workflows;            -- the policies, index and trigger go with it
--   drop function public.set_updated_at();
-- ---------------------------------------------------------------------------------------------------
