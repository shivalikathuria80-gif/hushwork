-- START LINKS: keep EVERY field of an arrival (lib/hook-fields.js, the Start links page). Paste into Supabase > SQL Editor > Run. Safe to run more
-- than once. Only needed if supabase/hooks.sql was run before this column was added to it; running it anyway does no harm.
--
-- hook_events.fields  every field that arrived, already cut by the server to at most 20 fields of 500 characters (4,000 in all), with anything
--                     that looks like a card number or a secret key left out. Lets the owner read the whole arrival, copy {incoming.name} tags,
--                     and replay it. Written by the server only, like the rest of the row; the owner can only read their own.

alter table public.hook_events add column if not exists fields jsonb;

alter table public.hook_events drop constraint if exists hook_events_fields_is_array;
alter table public.hook_events add constraint hook_events_fields_is_array check (fields is null or jsonb_typeof(fields) = 'array');
alter table public.hook_events drop constraint if exists hook_events_fields_size;
alter table public.hook_events add constraint hook_events_fields_size check (fields is null or octet_length(fields::text) <= 16000);
