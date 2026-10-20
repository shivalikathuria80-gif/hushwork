-- Lets the existing "connections" table hold a connection to ANY app that is listed in lib/connectors/app-list.js.
-- Run this ONCE if you ran an older supabase/connections.sql (it only allowed 'linear', or 'linear' and 'google'). A fresh run of
-- the new connections.sql already includes this. After it, adding a new app never needs another SQL step.
-- It changes one rule: instead of a fixed list of app names, the "provider" column may hold any short lowercase name
-- (letters, digits and _, 2 to 31 characters). The app itself still only accepts names from app-list.js.
-- Nothing is lost: saved Linear and Google connections stay exactly as they are.
--
-- Paste it into Supabase: Dashboard > SQL Editor > New query > paste > Run.

alter table public.connections drop constraint connections_provider;
alter table public.connections add constraint connections_provider check (provider ~ '^[a-z][a-z0-9_]{1,30}$');

-- ROLLBACK (only if no connection to a third app has been saved yet):
--   alter table public.connections drop constraint connections_provider;
--   alter table public.connections add constraint connections_provider check (provider in ('linear', 'google'));
