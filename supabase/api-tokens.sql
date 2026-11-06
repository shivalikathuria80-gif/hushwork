-- The "api_tokens" table: personal tokens that let a chatbot (Claude, or any app that speaks MCP) use the person's Hushwork through
-- /api/mcp (see hushwork-app/lib/plugin/). A token is made on the Settings page, shown ONCE, and only its SHA-256 hash is kept here,
-- so a copy of this table is useless to anyone who finds it.
--
-- STATUS: written, NOT applied yet. The owner pastes it into Supabase (Dashboard > SQL Editor > New query > paste > Run), then
-- usage-tokens.sql (the limits counter for token requests).
-- Until then the Settings page says one setup step is missing and /api/mcp refuses every token.
--
-- Row Level Security: a signed-in person can see, add and remove only their OWN tokens (the Settings page reads only name, prefix and
-- dates; a hash of a 256-bit random token cannot be turned back into the token, so reading one's own hashes gives nothing away).
-- The MCP endpoint looks a hash up with the all-access key: there is no signed-in person on a chatbot's request, and the token
-- itself is the proof of who it is.
-- Deleting the account deletes the tokens (on delete cascade).

create table public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,  -- filled in by the database, never by the browser
  name text not null,                                     -- what the person called it ("Claude on my laptop")
  token_hash text not null unique,                        -- sha-256 of the token, hex; the token itself is never stored
  prefix text not null,                                   -- the first characters ("hw_ab12cd"), so the person can tell tokens apart
  created_at timestamptz not null default now(),
  last_used_at timestamptz,

  constraint api_tokens_name_length check (char_length(btrim(name)) between 1 and 60),
  constraint api_tokens_hash_shape check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint api_tokens_prefix_length check (char_length(prefix) between 4 and 16)
);

create index api_tokens_user_id_idx on public.api_tokens (user_id, created_at desc);

alter table public.api_tokens enable row level security;

revoke all on public.api_tokens from anon;
revoke all on public.api_tokens from authenticated;
grant select on public.api_tokens to authenticated;
grant insert (name, token_hash, prefix) on public.api_tokens to authenticated;
grant delete on public.api_tokens to authenticated;

create policy "people read their own tokens" on public.api_tokens for select to authenticated using ((select auth.uid()) = user_id);
create policy "people add their own tokens" on public.api_tokens for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "people remove their own tokens" on public.api_tokens for delete to authenticated using ((select auth.uid()) = user_id);

-- ROLLBACK:
--   drop table public.api_tokens;
