-- The waitlist table as it exists in the Supabase project "hushwork" (region ap-south-1).
-- Kept here so the setup can be recreated. It was applied as two migrations:
--   create_waitlist_table, then waitlist_restrict_public_to_insert_only.

create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  created_at timestamptz not null default now(),
  constraint waitlist_email_format check (
    length(email) <= 254
    and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  )
);

-- One signup per address, ignoring capitalisation.
create unique index waitlist_email_unique on public.waitlist (lower(email));

-- Row Level Security: the rules that decide who may touch each row.
alter table public.waitlist enable row level security;

-- The public (anon) role may ADD an email and nothing else.
-- There is deliberately no SELECT, UPDATE or DELETE for it, so nobody can read the list from the browser.
revoke all on public.waitlist from anon;
revoke all on public.waitlist from authenticated;
grant insert on public.waitlist to anon;
grant select, insert, update, delete on public.waitlist to service_role;
create policy "anyone can join the waitlist" on public.waitlist for insert to anon with check (true);

-- To see your signups, open the Supabase dashboard, Table Editor, waitlist.
