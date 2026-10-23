-- Usage counters kept in the DATABASE, so a limit holds even when the app runs on several servers (as it does on Vercel).
-- Used for the AI: "Preview plan", AI steps and AI summaries. Without this table the app still works, but each server counts alone.
--
-- STATUS: written, NOT applied yet. Paste it into Supabase (Dashboard > SQL Editor > New query > paste > Run).
--
-- How it works: the app calls take_usage('ai_plan', 2, 20) = "this person may do this 2 times a minute and 20 times a day".
-- The function counts for the person who is signed in (auth.uid()), adds one when there is room and says 'ok', or says
-- 'limit_minute' / 'limit_day' and adds nothing. Nobody can read or edit the counters directly (no policies on the table).

create table public.usage_counters (
  user_id uuid not null references auth.users (id) on delete cascade,
  bucket text not null,
  kind text not null,                 -- 'minute' or 'day'
  window_start timestamptz not null,  -- the start of that minute or UTC day
  hits integer not null default 0,
  primary key (user_id, bucket, kind, window_start),
  constraint usage_kind check (kind in ('minute', 'day')),
  constraint usage_bucket_length check (char_length(bucket) between 1 and 40)
);

alter table public.usage_counters enable row level security;
-- no policies on purpose: only take_usage (below) touches the table

create or replace function public.take_usage(p_bucket text, p_per_minute integer, p_per_day integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  minute_start timestamptz := date_trunc('minute', now());
  day_start timestamptz := date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  minute_hits integer;
  day_hits integer;
begin
  if uid is null then return 'no_user'; end if;
  if p_bucket is null or char_length(p_bucket) not between 1 and 40 or p_per_minute < 1 or p_per_day < 1 then return 'bad_request'; end if;

  -- one at a time per person and kind of use, so two quick requests cannot both take the last slot
  perform pg_advisory_xact_lock(hashtextextended(uid::text || ':' || p_bucket, 0));

  delete from public.usage_counters where user_id = uid and window_start < now() - interval '2 days';

  select hits into minute_hits from public.usage_counters where user_id = uid and bucket = p_bucket and kind = 'minute' and window_start = minute_start;
  select hits into day_hits from public.usage_counters where user_id = uid and bucket = p_bucket and kind = 'day' and window_start = day_start;
  if coalesce(minute_hits, 0) >= p_per_minute then return 'limit_minute'; end if;
  if coalesce(day_hits, 0) >= p_per_day then return 'limit_day'; end if;

  insert into public.usage_counters (user_id, bucket, kind, window_start, hits) values (uid, p_bucket, 'minute', minute_start, 1)
    on conflict (user_id, bucket, kind, window_start) do update set hits = public.usage_counters.hits + 1;
  insert into public.usage_counters (user_id, bucket, kind, window_start, hits) values (uid, p_bucket, 'day', day_start, 1)
    on conflict (user_id, bucket, kind, window_start) do update set hits = public.usage_counters.hits + 1;
  return 'ok';
end;
$$;

revoke execute on function public.take_usage(text, integer, integer) from public, anon;
grant execute on function public.take_usage(text, integer, integer) to authenticated;
