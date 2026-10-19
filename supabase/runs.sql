-- The "runs" table: one row per time a workflow was run in Hushwork.
-- For now every run is a PRACTICE run: the app walks the steps and writes down what each one WOULD do. Nothing leaves
-- the app. The "mode" column is ready for real runs later.
--
-- STATUS: written, NOT applied yet. The owner pastes it into Supabase (Dashboard > SQL Editor > New query > paste > Run).
-- Until then the Runs page shows a plain "one setup step is missing" message instead of failing.
--
-- Same rules as supabase/workflows.sql: Row Level Security on, only signed-in people, only their own rows,
-- and the person can write only the content columns (never user_id, id or created_at).

create table public.runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,

  -- Which workflow was run. If the workflow is deleted later, the run stays (workflow_id becomes empty)
  -- and workflow_name still says what it was called.
  workflow_id uuid references public.workflows (id) on delete set null,
  workflow_name text not null,

  mode text not null default 'practice',
  status text not null default 'done',
  results jsonb not null default '[]'::jsonb,   -- one entry per step: what it would do / did
  created_at timestamptz not null default now(),

  constraint runs_mode check (mode in ('practice', 'live')),
  constraint runs_status check (status in ('done', 'failed')),
  constraint runs_name_length check (char_length(btrim(workflow_name)) between 1 and 120),
  constraint runs_results_is_array check (jsonb_typeof(results) = 'array'),
  constraint runs_results_size check (octet_length(results::text) <= 40000)
);

-- "My runs, newest first", and an index on the foreign keys.
create index runs_user_id_created_at_idx on public.runs (user_id, created_at desc);
create index runs_workflow_id_idx on public.runs (workflow_id);

alter table public.runs enable row level security;

revoke all on public.runs from anon;
revoke all on public.runs from authenticated;
-- A person can read and delete their runs, and add one. Runs are never edited afterwards (no update grant).
grant select, delete on public.runs to authenticated;
grant insert (workflow_id, workflow_name, mode, status, results) on public.runs to authenticated;

create policy "owner can read own runs"
  on public.runs for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- A run may only point at a workflow the same person owns (the subquery is itself filtered by the workflows rules).
create policy "owner can add own runs"
  on public.runs for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and (workflow_id is null or exists (select 1 from public.workflows w where w.id = workflow_id and w.user_id = (select auth.uid())))
  );

create policy "owner can delete own runs"
  on public.runs for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ROLLBACK (removes the table AND every saved run; only run it on purpose):
--   drop table public.runs;
