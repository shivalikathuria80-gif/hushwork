-- The "workflow_memories" table: short FACTS a person wants the AI to remember when it plans or answers (for example "My timezone is IST",
-- "Reports go to finance@acme.com", "I prefer short bullet lists").
--
-- STATUS: written, NOT applied yet. The owner pastes it into Supabase (Dashboard > SQL Editor > New query > paste > Run).
-- Until then Settings says one setup step is missing and the AI simply runs without memory (nothing else breaks).
--
-- SAFETY RULES (see DECISIONS.md D-039):
--   * A memory is DATA, never instructions. The app puts the facts into the AI request inside <memory> tags, with look-alike angle brackets so a
--     fact cannot close the tag, and tells the AI to ignore any instructions inside it.
--   * Only facts with source = 'person' AND verification_status = 'verified' are ever given to the AI. A person can only add facts through the
--     app, which saves them as person + verified; the database refuses any other values from a signed-in person.
--   * The app refuses facts that look like secrets (card numbers, keys, tokens) before saving them. They never leave your account except
--     inside an AI request.
--   * Row Level Security: only signed-in people, only their own rows, at most 50 facts each (a trigger counts them).

create table public.workflow_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,   -- deleting the account deletes the facts

  scope text not null default 'general',          -- 'general' (every AI request) or a short label such as 'email' or 'finance'
  key text not null,                              -- a short name, for example 'timezone'
  value text not null,                            -- the fact itself, plain text
  source text not null default 'person',          -- person | workflow | ai: who wrote it. Only 'person' is ever given to the AI.
  verification_status text not null default 'verified',   -- verified | unverified | rejected. Only 'verified' is ever given to the AI.
  created_at timestamptz not null default now(),

  constraint workflow_memories_scope check (char_length(scope) between 1 and 40 and scope ~ '^[A-Za-z0-9 _-]+$'),
  constraint workflow_memories_key check (char_length(key) between 1 and 60),
  constraint workflow_memories_value check (char_length(value) between 1 and 300),
  constraint workflow_memories_source check (source in ('person', 'workflow', 'ai')),
  constraint workflow_memories_status check (verification_status in ('verified', 'unverified', 'rejected')),
  constraint workflow_memories_one_per_key unique (user_id, scope, key)
);

create index workflow_memories_user_id_idx on public.workflow_memories (user_id);

alter table public.workflow_memories enable row level security;

revoke all on public.workflow_memories from anon;
revoke all on public.workflow_memories from authenticated;
grant select, delete on public.workflow_memories to authenticated;
-- A person writes only the words. source and verification_status keep their defaults (person, verified): they cannot be chosen from the app.
grant insert (scope, key, value) on public.workflow_memories to authenticated;
grant update (value) on public.workflow_memories to authenticated;

create policy "owner can read own memories"
  on public.workflow_memories for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "owner can add own memories"
  on public.workflow_memories for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- The cap is a TRIGGER, not a policy: a policy that looks inside its own table makes Postgres stop with "infinite recursion detected in policy" (42P17).
create or replace function public.workflow_memories_cap() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.workflow_memories t where t.user_id = new.user_id) >= 50 then
    raise exception 'at most 50 facts per person' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger workflow_memories_cap
  before insert on public.workflow_memories
  for each row execute function public.workflow_memories_cap();

create policy "owner can change own memories"
  on public.workflow_memories for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "owner can delete own memories"
  on public.workflow_memories for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ROLLBACK (removes every saved fact; only run it on purpose):
--   drop table public.workflow_memories;
