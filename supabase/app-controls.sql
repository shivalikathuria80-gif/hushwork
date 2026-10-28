-- The "app_controls" table: global on/off switches for the whole app. Right now one switch: "paused".
--
-- STATUS: APPLIED on the hosted Supabase project (checked 2026-10-28; "paused" is false). Do not run this file again: it will say
-- "relation app_controls already exists", which only means it is already done. To pause or restart, use the two update lines below.
-- (A missing table is treated by the app as "not paused", so nothing breaks without it.)
--
-- While "paused" is true Hushwork does nothing on anyone's behalf: no step that writes (send, create, add), no Ask the AI step, no scheduled run.
-- Pages, runs and Disconnect / Delete my account still work.
--
--   STOP EVERYTHING:   update public.app_controls set value = true,  updated_at = now() where name = 'paused';
--   START AGAIN:       update public.app_controls set value = false, updated_at = now() where name = 'paused';
--
-- Signed-in people may READ the switches (the Runs page shows a notice while paused). Nobody can change them from the app: no INSERT, UPDATE or
-- DELETE is granted to anyone, so only you (in the SQL Editor, which runs as the database owner) can flip it.

create table public.app_controls (
  name text primary key,
  value boolean not null default false,
  note text,
  updated_at timestamptz not null default now(),
  constraint app_controls_name check (name ~ '^[a-z_]{1,40}$')
);

insert into public.app_controls (name, value, note) values ('paused', false, 'true = Hushwork sends nothing, asks no AI and runs no schedule') on conflict (name) do nothing;

alter table public.app_controls enable row level security;

revoke all on public.app_controls from anon;
revoke all on public.app_controls from authenticated;
grant select on public.app_controls to authenticated;

create policy "signed-in people can read the switches"
  on public.app_controls for select
  to authenticated
  using (true);

-- ROLLBACK:
--   drop table public.app_controls;
