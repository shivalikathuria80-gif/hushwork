-- APP EVENTS (lib/app-events.js, lib/app-event-runner.js). Paste this whole file into Supabase > SQL Editor > Run. Safe to run once.
--
-- A workflow whose Start step says "When an email arrives" or "When a calendar event is added" gets one row here when it is saved in the
-- Builder. The clock (app/api/cron/tick) looks every 2 minutes for new mail or new events and starts the workflow by itself, as its owner, with
-- writing switched OFF (anything that sends or creates still waits for the owner's Approve).
--
--   app_watches        one row per watched workflow: which app, the filter, on/off, where it got to (cursor_at, seen) and how the last look went.
--   app_watch_events   what started a run lately (or was held back), with a SHORT preview (never more than 2,000 bytes).
--
-- The owner reads their own rows and may switch a watch on or off. Everything else is written by the server only (the all-access key).

create table public.app_watches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workflow_id uuid not null unique references public.workflows (id) on delete cascade,   -- one watch per workflow; deleted with it
  source text not null,                                 -- gmail | calendar
  filter text not null default '',                      -- Gmail search words, or words in an event title; '' = everything
  enabled boolean not null default true,
  tz_offset integer not null default 0,                 -- the owner's clock (minutes EAST of UTC), so the nudge email is never sent at night
  cursor_at timestamptz not null default now(),         -- only mail or events after this moment count (a new watch never starts old mail)
  seen jsonb not null default '[]'::jsonb,              -- the ids it already started for (the last 50), so nothing starts twice
  next_check_at timestamptz not null default now(),
  last_checked_at timestamptz,
  last_status text,                                     -- ok | new | limited | not_connected | failed
  last_error text,                                      -- one short fixed sentence for the owner, never Google's own text
  started_count integer not null default 0,
  last_started_at timestamptz,
  created_at timestamptz not null default now(),

  constraint app_watches_source check (source in ('gmail', 'calendar')),
  constraint app_watches_filter_size check (char_length(filter) <= 80),
  constraint app_watches_seen_is_array check (jsonb_typeof(seen) = 'array'),
  constraint app_watches_seen_size check (octet_length(seen::text) <= 4000),
  constraint app_watches_status check (last_status is null or last_status in ('ok', 'new', 'limited', 'not_connected', 'failed')),
  constraint app_watches_error_size check (last_error is null or char_length(last_error) <= 300),
  constraint app_watches_count_positive check (started_count >= 0),
  constraint app_watches_tz_range check (tz_offset between -840 and 840)
);

create index app_watches_due_idx on public.app_watches (next_check_at) where enabled;
create index app_watches_user_idx on public.app_watches (user_id, created_at);

alter table public.app_watches enable row level security;

revoke all on public.app_watches from anon;
revoke all on public.app_watches from authenticated;
grant select, delete on public.app_watches to authenticated;
grant insert (workflow_id, source, filter, tz_offset) on public.app_watches to authenticated;
grant update (enabled, source, filter, tz_offset) on public.app_watches to authenticated;

create policy "people read their own app watches" on public.app_watches for select to authenticated using ((select auth.uid()) = user_id);
create policy "people watch their own workflows" on public.app_watches for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.workflows w where w.id = workflow_id and w.user_id = (select auth.uid()))
  );
create policy "people change their own app watches" on public.app_watches for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "people remove their own app watches" on public.app_watches for delete to authenticated using ((select auth.uid()) = user_id);

-- Changing what is watched (another app, other filter words) starts afresh from that moment: the old cursor and seen ids belong to the old watch.
create function public.app_watches_restart() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.source is distinct from old.source or new.filter is distinct from old.filter then
    new.cursor_at := now();
    new.seen := '[]'::jsonb;
    new.next_check_at := now();
  end if;
  if new.enabled and not old.enabled then
    new.cursor_at := now();               -- switched back on: what came while it was off does not all start at once
    new.next_check_at := now();
  end if;
  return new;
end;
$$;
create trigger app_watches_restart before update on public.app_watches for each row execute function public.app_watches_restart();

create table public.app_watch_events (
  id uuid primary key default gen_random_uuid(),
  watch_id uuid not null references public.app_watches (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null,                                 -- started | limited | failed
  run_id uuid references public.runs (id) on delete set null,
  preview jsonb not null default '[]'::jsonb,           -- [{ "name": "From", "value": "Ana Lopez" }], cut short
  created_at timestamptz not null default now(),

  constraint app_watch_events_status check (status in ('started', 'limited', 'failed')),
  constraint app_watch_events_preview_is_array check (jsonb_typeof(preview) = 'array'),
  constraint app_watch_events_preview_size check (octet_length(preview::text) <= 2000)
);

create index app_watch_events_user_created_idx on public.app_watch_events (user_id, created_at desc);
create index app_watch_events_watch_created_idx on public.app_watch_events (watch_id, created_at desc);

alter table public.app_watch_events enable row level security;

revoke all on public.app_watch_events from anon;
revoke all on public.app_watch_events from authenticated;
grant select on public.app_watch_events to authenticated;   -- read only: the server writes them

create policy "people read their own app events" on public.app_watch_events for select to authenticated using ((select auth.uid()) = user_id);
