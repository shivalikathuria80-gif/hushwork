-- The "enabled_bundles" table: which Skill Bundles (plugins) a person has turned on (Skills page). One row per person per bundle.
--
-- STATUS: written, NOT applied yet. The owner pastes it into Supabase (Dashboard > SQL Editor > New query > paste > Run).
-- Until then the Skills page can show the bundles but says one setup step is missing and the Enable button does nothing.
--
-- What a row means: "this person turned this bundle on". The bundles themselves (their skills and workflows) live in the app's code
-- (lib/skills/bundles.js), not here, so this table only stores the bundle's short id. Turning a bundle on also saves its ready-made
-- workflows as drafts in the person's own `workflows` list; it never connects an app, never makes a schedule and never runs anything.
--
-- Same rules as every other table: Row Level Security on, only signed-in people, only their own rows, at most 20 rows each (a trigger counts them).
-- A person can only choose the bundle id; user_id and created_at are filled in by the database.

create table public.enabled_bundles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,   -- deleting the account deletes the rows
  bundle_id text not null,
  created_at timestamptz not null default now(),

  constraint enabled_bundles_bundle_id check (bundle_id ~ '^[a-z][a-z0-9-]{1,39}$'),
  constraint enabled_bundles_one_per_bundle unique (user_id, bundle_id)
);

create index enabled_bundles_user_id_idx on public.enabled_bundles (user_id);

alter table public.enabled_bundles enable row level security;

revoke all on public.enabled_bundles from anon;
revoke all on public.enabled_bundles from authenticated;
grant select, delete on public.enabled_bundles to authenticated;
grant insert (bundle_id) on public.enabled_bundles to authenticated;
-- No update: a row is either there or not.

create policy "owner can read own enabled bundles"
  on public.enabled_bundles for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "owner can enable bundles for themself"
  on public.enabled_bundles for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- The cap is a TRIGGER, not a policy: a policy that looks inside its own table makes Postgres stop with "infinite recursion detected in policy" (42P17).
create or replace function public.enabled_bundles_cap() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.enabled_bundles t where t.user_id = new.user_id) >= 20 then
    raise exception 'at most 20 bundles per person' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger enabled_bundles_cap
  before insert on public.enabled_bundles
  for each row execute function public.enabled_bundles_cap();

create policy "owner can disable own bundles"
  on public.enabled_bundles for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ROLLBACK (forgets which bundles were turned on; the saved workflows stay; only run it on purpose):
--   drop table public.enabled_bundles;
