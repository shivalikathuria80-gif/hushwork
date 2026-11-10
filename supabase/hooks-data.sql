-- START LINK DATA CONTROLS (lib/hook-data.js, lib/actions/hook-data.js, app/api/export/arrivals). Run AFTER hooks.sql. Paste this whole file into
-- Supabase > SQL Editor > Run. Safe to run more than once. Until it is run, Start links keep working exactly as before and the page says one
-- setup step is left for the data controls.
--
-- What arrives at a start link was written by a stranger, so the owner decides how long Hushwork keeps it:
--   hooks.keep_days     how long arrivals are kept: 1, 7, 30 (the default) or 90 days. Older ones are deleted by the clock (prune_arrivals).
--   hooks.daily_cap     at most this many runs a day from this ONE link (1 to 60). Empty: only the account limit (60 a day) applies.
--   forget_arrivals     the owner deletes one arrival, or all of a link's, now.
-- "Deleted" means both copies: the arrival row (its short preview) AND the full words that were kept on the run's Start step
-- (runs.results[0].incoming and incomingFields). The run itself stays, so the history of what Hushwork did is not lost; it only no longer holds the stranger's words.

alter table public.hooks add column if not exists keep_days integer not null default 30;
alter table public.hooks add column if not exists daily_cap integer;

-- tz_offset is minutes EAST of UTC (India +330), so it runs from -12:00 to +14:00. hooks.sql first had the range the wrong way round.
alter table public.hooks drop constraint if exists hooks_tz_range;
alter table public.hooks add constraint hooks_tz_range check (tz_offset between -720 and 840);

alter table public.hooks drop constraint if exists hooks_keep_days;
alter table public.hooks add constraint hooks_keep_days check (keep_days in (1, 7, 30, 90));
alter table public.hooks drop constraint if exists hooks_daily_cap;
alter table public.hooks add constraint hooks_daily_cap check (daily_cap is null or daily_cap between 1 and 60);

-- The existing "people change their own links" policy covers these two columns too.
grant update (keep_days, daily_cap) on public.hooks to authenticated;

-- The clock looks for old arrivals by time.
create index if not exists hook_events_created_idx on public.hook_events (created_at);

-- A new status: refused because the link's own daily limit was reached. (The list also keeps every status of hooks.sql and hooks-signing.sql.)
alter table public.hook_events drop constraint if exists hook_events_status;
alter table public.hook_events add constraint hook_events_status check (status in ('started', 'limited', 'off', 'failed', 'refused', 'duplicate', 'capped'));

-- The words a run kept of an arrival, removed: the text and the field-by-field copy. Only the Start step (index 0) ever holds them. Used by both functions below.
create or replace function public.scrub_arrival_text(p_runs uuid[], p_owner uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.runs r
     set results = jsonb_set(r.results, '{0}', ((r.results -> 0) - 'incoming' - 'incomingFields') || '{"incoming_deleted": true}'::jsonb)
   where r.id = any(p_runs)
     and r.user_id = p_owner
     and jsonb_typeof(r.results -> 0) = 'object'
     and (r.results -> 0) ?| array['incoming', 'incomingFields'];
$$;

revoke execute on function public.scrub_arrival_text(uuid[], uuid) from public, anon, authenticated;
grant execute on function public.scrub_arrival_text(uuid[], uuid) to service_role;
-- (the server calls it for an arrival that was deleted while its run was still starting)

-- The owner deletes arrivals now: one (p_event) or every one of the link (p_event null). Returns how many were deleted, or -1 when the link is
-- not the signed-in person's (the same answer as a link that does not exist).
create or replace function public.forget_arrivals(p_hook uuid, p_event uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_runs uuid[];
  v_count integer;
begin
  select user_id into v_owner from public.hooks where id = p_hook;
  if v_owner is null or v_owner is distinct from auth.uid() then return -1; end if;

  with gone as (
    delete from public.hook_events e
     where e.hook_id = p_hook and e.user_id = v_owner and (p_event is null or e.id = p_event)
    returning e.run_id
  )
  select coalesce(array_agg(run_id) filter (where run_id is not null), '{}'), count(*) into v_runs, v_count from gone;

  perform public.scrub_arrival_text(v_runs, v_owner);
  return v_count;
end;
$$;

revoke execute on function public.forget_arrivals(uuid, uuid) from public, anon;
grant execute on function public.forget_arrivals(uuid, uuid) to authenticated;

-- The clock (app/api/cron/tick) and every arrival: deletes what is older than its link's keep_days. p_hook limits it to one link. At most
-- 500 rows a call, oldest first, so one call stays quick; whatever is left goes on the next one. Server only.
create or replace function public.prune_arrivals(p_hook uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_runs uuid[];
  v_owners uuid[];
  v_count integer;
begin
  with old as (
    select e.id
      from public.hook_events e
      join public.hooks h on h.id = e.hook_id
     where (p_hook is null or e.hook_id = p_hook)
       and e.created_at < now() - make_interval(days => h.keep_days)
     order by e.created_at
     limit 500
  ), gone as (
    delete from public.hook_events e using old where e.id = old.id returning e.user_id, e.run_id
  )
  select coalesce(array_agg(run_id) filter (where run_id is not null), '{}'), coalesce(array_agg(user_id) filter (where run_id is not null), '{}'), count(*)
    into v_runs, v_owners, v_count from gone;

  update public.runs r
     set results = jsonb_set(r.results, '{0}', ((r.results -> 0) - 'incoming' - 'incomingFields') || '{"incoming_deleted": true}'::jsonb)
    from unnest(v_runs, v_owners) as u(run_id, owner_id)
   where r.id = u.run_id
     and r.user_id = u.owner_id
     and jsonb_typeof(r.results -> 0) = 'object'
     and (r.results -> 0) ?| array['incoming', 'incomingFields'];
  return v_count;
end;
$$;

revoke execute on function public.prune_arrivals(uuid) from public, anon, authenticated;
grant execute on function public.prune_arrivals(uuid) to service_role;

-- ROLLBACK:
--   drop function public.prune_arrivals(uuid); drop function public.forget_arrivals(uuid, uuid); drop function public.scrub_arrival_text(uuid[], uuid);
--   alter table public.hook_events drop constraint hook_events_status;
--   alter table public.hook_events add constraint hook_events_status check (status in ('started', 'limited', 'off', 'failed'));
--   alter table public.hooks drop column daily_cap; alter table public.hooks drop column keep_days;
