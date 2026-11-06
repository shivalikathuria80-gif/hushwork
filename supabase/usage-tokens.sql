-- take_usage_for: the twin of take_usage (usage.sql) for requests that come in with a person's API token (api-tokens.sql, /api/mcp).
-- Run it AFTER usage.sql and api-tokens.sql. Without it, the AI and sending limits for chatbot requests fall back to the in-memory ones only.
--
-- The AI and action limits (usage.sql) count for auth.uid(). A chatbot's request has no signed-in person, so the MCP endpoint counts
-- with this twin instead, naming the person whose token it checked. Only the all-access key may call it.
create or replace function public.take_usage_for(p_user uuid, p_bucket text, p_per_minute integer, p_per_day integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  minute_start timestamptz := date_trunc('minute', now());
  day_start timestamptz := date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  minute_hits integer;
  day_hits integer;
begin
  if p_user is null then return 'no_user'; end if;
  if p_bucket is null or char_length(p_bucket) not between 1 and 40 or p_per_minute < 1 or p_per_day < 1 then return 'bad_request'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user::text || ':' || p_bucket, 0));

  delete from public.usage_counters where user_id = p_user and window_start < now() - interval '2 days';

  select hits into minute_hits from public.usage_counters where user_id = p_user and bucket = p_bucket and kind = 'minute' and window_start = minute_start;
  select hits into day_hits from public.usage_counters where user_id = p_user and bucket = p_bucket and kind = 'day' and window_start = day_start;
  if coalesce(minute_hits, 0) >= p_per_minute then return 'limit_minute'; end if;
  if coalesce(day_hits, 0) >= p_per_day then return 'limit_day'; end if;

  insert into public.usage_counters (user_id, bucket, kind, window_start, hits) values (p_user, p_bucket, 'minute', minute_start, 1)
    on conflict (user_id, bucket, kind, window_start) do update set hits = public.usage_counters.hits + 1;
  insert into public.usage_counters (user_id, bucket, kind, window_start, hits) values (p_user, p_bucket, 'day', day_start, 1)
    on conflict (user_id, bucket, kind, window_start) do update set hits = public.usage_counters.hits + 1;
  return 'ok';
end;
$$;

revoke execute on function public.take_usage_for(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.take_usage_for(uuid, text, integer, integer) to service_role;

-- ROLLBACK:
--   drop function public.take_usage_for(uuid, text, integer, integer);
