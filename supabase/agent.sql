-- The "agent_state" table: one row per person for the Hushwork Agent (lib/agent/). The agent is ALWAYS ON once the person turns it on: three times a day
-- (09:00, 13:00, 17:00 their time) the clock looks at the apps they connected and saves up to 3 short notes ("what needs you today"). It only READS:
-- nothing is sent or changed in any app. The notes show at the top of the workspace; "Do this" turns one into a plan the person reviews first.
--
-- STATUS: written, NOT applied yet. The owner pastes it into Supabase (Dashboard > SQL Editor > New query > paste > Run).
-- Until then the workspace says one setup step is missing and nothing else breaks.
--
-- Row Level Security: a signed-in person can read, add and change only their OWN row. The clock writes notes with the all-access key (it has no
-- signed-in person). Deleting the account deletes the row (on delete cascade).

create table public.agent_state (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,   -- filled in by the database, never by the browser
  enabled boolean not null default false,                -- the one switch: is the agent on?
  tz_offset integer not null default 0,                  -- minutes EAST of UTC (India is 330), the same number a schedule stores
  next_check_at timestamptz,                             -- when the clock looks next (null while off)
  checked_at timestamptz,                                -- when it last looked
  status text,                                           -- how the last look went: ok | quiet | nothing_connected | failed
  notes jsonb not null default '[]'::jsonb,              -- up to 3 notes: [{ "title", "why", "ask", "dismissed"? }]
  updated_at timestamptz not null default now(),

  primary key (user_id),                                 -- one agent per person
  constraint agent_state_tz check (tz_offset between -840 and 840),
  constraint agent_state_status check (status is null or status in ('ok', 'quiet', 'nothing_connected', 'failed')),
  constraint agent_state_notes check (jsonb_typeof(notes) = 'array' and jsonb_array_length(notes) <= 3 and pg_column_size(notes) < 8000)
);

-- The clock asks "whose agent is due?" every minute; this keeps that question quick.
create index agent_state_due on public.agent_state (next_check_at) where enabled;

alter table public.agent_state enable row level security;

revoke all on public.agent_state from anon;
revoke all on public.agent_state from authenticated;
grant select on public.agent_state to authenticated;
grant insert (enabled, tz_offset, next_check_at, updated_at) on public.agent_state to authenticated;
grant update (enabled, tz_offset, next_check_at, checked_at, status, notes, updated_at) on public.agent_state to authenticated;

create policy "people read their own agent" on public.agent_state for select to authenticated using ((select auth.uid()) = user_id);
create policy "people add their own agent" on public.agent_state for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "people change their own agent" on public.agent_state for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ROLLBACK:
--   drop table public.agent_state;
