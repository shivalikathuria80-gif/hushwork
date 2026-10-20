-- The "connections" table: one row per person per app they have connected to Hushwork with the Connect button
-- (any app listed in lib/connectors/app-list.js: "linear", "google"...; if you ran an older copy of this file that only allowed
-- some names, run connections-any-app.sql once). The row holds the permission that app gave Hushwork for that person.
--
-- STATUS: written, NOT applied yet. The owner pastes it into Supabase (Dashboard > SQL Editor > New query > paste > Run).
-- Until then the Connect button says one setup step is missing.
--
-- The tokens are stored ENCRYPTED. The app encrypts them with a secret (CONNECTIONS_KEY in .env.local) before they reach the
-- database, so even someone who could read this table would only see scrambled text. The secret is never stored here.
--
-- Same rules as workflows and runs: Row Level Security on, only signed-in people, only their own rows.

create table public.connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  provider text not null,
  access_token_enc text not null,    -- scrambled (encrypted) access token
  refresh_token_enc text,            -- scrambled refresh token, used to get a new access token when it runs out
  expires_at timestamptz,            -- when the access token runs out (Linear: 24 hours)
  created_at timestamptz not null default now(),

  constraint connections_provider check (provider ~ '^[a-z][a-z0-9_]{1,30}$'), -- the app only accepts names from lib/connectors/app-list.js
  constraint connections_token_size check (char_length(access_token_enc) <= 2000 and char_length(coalesce(refresh_token_enc, '')) <= 2000),
  constraint connections_one_per_app unique (user_id, provider)
);

alter table public.connections enable row level security;

revoke all on public.connections from anon;
revoke all on public.connections from authenticated;
grant select, delete on public.connections to authenticated;
grant insert (provider, access_token_enc, refresh_token_enc, expires_at) on public.connections to authenticated;
grant update (access_token_enc, refresh_token_enc, expires_at) on public.connections to authenticated;

create policy "owner can read own connections"
  on public.connections for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "owner can add own connections"
  on public.connections for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "owner can renew own connections"
  on public.connections for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "owner can delete own connections"
  on public.connections for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ROLLBACK (removes every saved connection; only run it on purpose):
--   drop table public.connections;
