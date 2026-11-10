-- START LINKS (lib/hooks.js, app/api/hooks/[code]). Paste this whole file into Supabase > SQL Editor > Run. Safe to run once.
--
-- A start link is a private web address for ONE workflow. When a form tool, a shop or any other app sends something to it, the workflow starts
-- by itself, as its owner, with writing switched OFF (anything that sends or creates still waits for the owner's Approve).
--
--   hooks        one row per workflow that has a link: the secret code, its hash (how the address is looked up), on/off and counters.
--   hook_events  what arrived lately: when, how it went, which run it started, a SHORT preview of the fields (never more than 2,000 bytes) and
--                every field (already cut by the server), so the owner can read and replay an arrival.
--
-- The owner reads and manages their own links with the normal privacy rules. Arrivals are written by the server only (the all-access key),
-- because the sender is a stranger with no account.

create table public.hooks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,  -- filled in by the database, never by the browser
  workflow_id uuid not null unique references public.workflows (id) on delete cascade,   -- one link per workflow; deleted with it
  code text not null,                                   -- the secret part of the address ("hwl_..."); only its owner can read it
  code_hash text not null unique,                       -- sha-256 of the code, hex: the address is looked up by this
  enabled boolean not null default true,
  tz_offset integer not null default 0,                 -- the owner's clock (minutes, as the browser gives it), so the "a step is waiting" email is never sent at night
  received_count integer not null default 0,
  last_received_at timestamptz,
  created_at timestamptz not null default now(),

  constraint hooks_code_shape check (code ~ '^hwl_[A-Za-z0-9_-]{32}$'),
  constraint hooks_hash_shape check (code_hash ~ '^[0-9a-f]{64}$'),
  constraint hooks_count_positive check (received_count >= 0),
  constraint hooks_tz_range check (tz_offset between -840 and 720)
);

create index hooks_user_id_idx on public.hooks (user_id, created_at desc);

alter table public.hooks enable row level security;

revoke all on public.hooks from anon;
revoke all on public.hooks from authenticated;
grant select, delete on public.hooks to authenticated;
grant insert (workflow_id, code, code_hash, tz_offset) on public.hooks to authenticated;
grant update (enabled, code, code_hash, tz_offset) on public.hooks to authenticated;

create policy "people read their own links" on public.hooks for select to authenticated using ((select auth.uid()) = user_id);
create policy "people add links to their own workflows" on public.hooks for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.workflows w where w.id = workflow_id and w.user_id = (select auth.uid()))
  );
create policy "people change their own links" on public.hooks for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "people remove their own links" on public.hooks for delete to authenticated using ((select auth.uid()) = user_id);

create table public.hook_events (
  id uuid primary key default gen_random_uuid(),
  hook_id uuid not null references public.hooks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null,                                 -- started | limited | off | failed
  run_id uuid references public.runs (id) on delete set null,
  preview jsonb not null default '[]'::jsonb,           -- [{ "name": "email", "value": "ana@..." }], cut short
  fields jsonb,                                         -- every field that arrived (cut by the server: 20 fields, 4,000 characters), for the inspector and Replay
  test boolean not null default false,                  -- true when the owner pressed "Send a test"
  created_at timestamptz not null default now(),

  constraint hook_events_status check (status in ('started', 'limited', 'off', 'failed')),
  constraint hook_events_preview_is_array check (jsonb_typeof(preview) = 'array'),
  constraint hook_events_preview_size check (octet_length(preview::text) <= 2000),
  constraint hook_events_fields_is_array check (fields is null or jsonb_typeof(fields) = 'array'),
  constraint hook_events_fields_size check (fields is null or octet_length(fields::text) <= 16000)
);

create index hook_events_user_created_idx on public.hook_events (user_id, created_at desc);
create index hook_events_hook_created_idx on public.hook_events (hook_id, created_at desc);

alter table public.hook_events enable row level security;

revoke all on public.hook_events from anon;
revoke all on public.hook_events from authenticated;
grant select on public.hook_events to authenticated;   -- read only: the server writes them

create policy "people read their own arrivals" on public.hook_events for select to authenticated using ((select auth.uid()) = user_id);
