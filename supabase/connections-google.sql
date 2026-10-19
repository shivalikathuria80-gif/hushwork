-- Lets the existing "connections" table hold a Google connection too.
-- Run this ONLY if you already ran supabase/connections.sql before Google was added (a fresh run of connections.sql already
-- includes Google). It changes one rule: the allowed values of the "provider" column become 'linear' and 'google'.
-- Nothing is lost: saved Linear connections stay exactly as they are.
--
-- Paste it into Supabase: Dashboard > SQL Editor > New query > paste > Run.

alter table public.connections drop constraint connections_provider;
alter table public.connections add constraint connections_provider check (provider in ('linear', 'google'));

-- ROLLBACK (only if no Google connection has been saved yet):
--   alter table public.connections drop constraint connections_provider;
--   alter table public.connections add constraint connections_provider check (provider in ('linear'));
