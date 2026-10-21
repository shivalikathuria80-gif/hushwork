-- The "schedules" table: one row per workflow that should run BY ITSELF at a chosen time (for example "every weekday at 09:00").
--
-- STATUS: written, NOT applied yet. The owner pastes it into Supabase (Dashboard > SQL Editor > New query > paste > Run).
-- Until then the Schedule button on the Workflows page says one setup step is missing.
--
-- How a schedule runs: a clock (Vercel Cron, a free pinger, or a task on your own computer) calls /api/cron/tick about every minute.
-- That address finds the schedules whose next_run_at has passed and runs each workflow the way Auto mode does. See docs/deploy.md.
--
-- Same rules as workflows and runs: Row Level Security on, only signed-in people, only their own rows. A person may choose WHEN a
-- workflow runs and whether it may write; they can never write the bookkeeping columns (last_run_at, last_status, last_run_id): only the
-- clock's runner fills those in.

create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workflow_id uuid not null references public.workflows (id) on delete cascade,   -- deleting a workflow deletes its schedule

  frequency text not null,                         -- hourly | daily | weekdays | weekly
  hour smallint not null default 0,                -- the person's local time of day (ignored for hourly)
  minute smallint not null default 0,
  weekday smallint not null default 0,             -- 0 = Sunday ... 6 = Saturday (only for weekly)
  tz_offset smallint not null default 0,           -- minutes east of UTC at the time it was saved (India = 330)
  allow_writes boolean not null default false,     -- may a scheduled run add a row or create a task by itself? Off unless the person ticks it
  enabled boolean not null default true,

  next_run_at timestamptz not null,                -- the next time it is due (kept up to date by the app and by the runner)
  last_run_at timestamptz,
  last_status text,                                -- ok | stopped | failed
  last_run_id uuid references public.runs (id) on delete set null,
  created_at timestamptz not null default now(),

  constraint schedules_frequency check (frequency in ('hourly', 'daily', 'weekdays', 'weekly')),
  constraint schedules_hour check (hour between 0 and 23),
  constraint schedules_minute check (minute between 0 and 59),
  constraint schedules_weekday check (weekday between 0 and 6),
  constraint schedules_tz_offset check (tz_offset between -840 and 840),
  constraint schedules_status check (last_status is null or last_status in ('ok', 'stopped', 'failed')),
  constraint schedules_one_per_workflow unique (workflow_id)
);

-- "Which schedules are due?" is asked every minute.
create index schedules_due_idx on public.schedules (next_run_at) where enabled;
create index schedules_user_id_idx on public.schedules (user_id);

alter table public.schedules enable row level security;

revoke all on public.schedules from anon;
revoke all on public.schedules from authenticated;
grant select, delete on public.schedules to authenticated;
grant insert (workflow_id, frequency, hour, minute, weekday, tz_offset, allow_writes, enabled, next_run_at) on public.schedules to authenticated;
grant update (frequency, hour, minute, weekday, tz_offset, allow_writes, enabled, next_run_at) on public.schedules to authenticated;

create policy "owner can read own schedules"
  on public.schedules for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- A schedule may only point at a workflow the same person owns.
create policy "owner can add own schedules"
  on public.schedules for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.workflows w where w.id = workflow_id and w.user_id = (select auth.uid()))
  );

create policy "owner can change own schedules"
  on public.schedules for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "owner can delete own schedules"
  on public.schedules for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ROLLBACK (removes every schedule; only run it on purpose):
--   drop table public.schedules;
