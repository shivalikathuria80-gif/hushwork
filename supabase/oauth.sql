-- OAuth sign-in for the chatbot plugin: lets Claude (claude.ai, Claude Code, Cowork) or another MCP app connect to /api/mcp with a "Connect"
-- button, instead of a pasted hw_ token. Code: hushwork-app/lib/plugin/oauth.js, app/oauth/authorize, app/api/oauth/*, app/.well-known/*.
--
-- STATUS: written, NOT applied yet. The owner pastes it into Supabase (Dashboard > SQL Editor > New query > paste > Run). It needs
-- api-tokens.sql and usage-tokens.sql to have been run first (they have). Until it runs, "Connect" in a chatbot ends on an error page and
-- the Settings page says one setup step is missing; personal hw_ tokens keep working either way.
--
-- Three tables:
--   oauth_clients  the chatbots that registered themselves (Dynamic Client Registration). Not anyone's own row: only the server reads it.
--   oauth_codes    one-time codes, 10 minutes, between "Allow" and the chatbot swapping the code for tokens. Only the server reads it.
--   oauth_grants   one row per connected chatbot per person: the hash of the current access token (1 hour) and refresh token. The person can
--                  see their own (Settings > Chatbot plugin) and remove one, which disconnects that chatbot at once.
-- Like api_tokens, only SHA-256 hashes of codes, secrets and tokens are kept, never the values. Deleting the account deletes codes and grants.

create table public.oauth_clients (
  client_id text primary key,                             -- "hwc_" + 22 characters, made by the server
  client_name text not null,                              -- what the chatbot calls itself; shown on the Allow page with its return address
  redirect_uris text[] not null,
  auth_method text not null default 'none',
  secret_hash text,                                       -- only for clients that asked for a secret
  created_at timestamptz not null default now(),

  constraint oauth_clients_id_shape check (client_id ~ '^hwc_[A-Za-z0-9_-]{22}$'),
  constraint oauth_clients_name_length check (char_length(client_name) between 1 and 80),
  constraint oauth_clients_uris check (cardinality(redirect_uris) between 1 and 10),
  constraint oauth_clients_method check (auth_method in ('none', 'client_secret_post', 'client_secret_basic')),
  constraint oauth_clients_secret check ((auth_method = 'none') = (secret_hash is null)),
  constraint oauth_clients_secret_shape check (secret_hash is null or secret_hash ~ '^[0-9a-f]{64}$')
);

create table public.oauth_codes (
  code_hash text primary key,
  client_id text not null references public.oauth_clients (client_id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  redirect_uri text not null,
  code_challenge text not null,                           -- PKCE S256
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),

  constraint oauth_codes_hash_shape check (code_hash ~ '^[0-9a-f]{64}$'),
  constraint oauth_codes_challenge_shape check (code_challenge ~ '^[A-Za-z0-9_-]{43}$')
);

create table public.oauth_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id text not null references public.oauth_clients (client_id) on delete cascade,
  client_name text not null,
  access_hash text not null unique,
  access_expires_at timestamptz not null,
  refresh_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,

  constraint oauth_grants_access_shape check (access_hash ~ '^[0-9a-f]{64}$'),
  constraint oauth_grants_refresh_shape check (refresh_hash ~ '^[0-9a-f]{64}$')
);

create index oauth_codes_expires_idx on public.oauth_codes (expires_at);
create index oauth_grants_user_id_idx on public.oauth_grants (user_id, created_at desc);

alter table public.oauth_clients enable row level security;
alter table public.oauth_codes enable row level security;
alter table public.oauth_grants enable row level security;

-- Clients and codes: nobody but the server (the all-access key, which skips these rules). No grants, no policies.
revoke all on public.oauth_clients from anon;
revoke all on public.oauth_clients from authenticated;
revoke all on public.oauth_codes from anon;
revoke all on public.oauth_codes from authenticated;

-- Grants: a signed-in person can see and remove only their own. Making and refreshing them is the server's job.
revoke all on public.oauth_grants from anon;
revoke all on public.oauth_grants from authenticated;
grant select on public.oauth_grants to authenticated;
grant delete on public.oauth_grants to authenticated;

create policy "people read their own chatbot connections" on public.oauth_grants for select to authenticated using ((select auth.uid()) = user_id);
create policy "people remove their own chatbot connections" on public.oauth_grants for delete to authenticated using ((select auth.uid()) = user_id);

-- ROLLBACK:
--   drop table public.oauth_grants;
--   drop table public.oauth_codes;
--   drop table public.oauth_clients;
