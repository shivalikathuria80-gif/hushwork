-- START LINKS, part 2: the sender check and repeat skipping. ONLY for a database where supabase/hooks.sql was run BEFORE 10 November 2026
-- (the hooks.sql of today already has all of this). Paste into Supabase > SQL Editor > Run. Safe to run more than once.

alter table public.hooks add column if not exists signing_style text not null default 'none';
alter table public.hooks add column if not exists signing_secret text;
alter table public.hooks drop constraint if exists hooks_signing_style;
alter table public.hooks add constraint hooks_signing_style check (signing_style in ('none', 'tally', 'typeform', 'stripe', 'github', 'hushwork'));
alter table public.hooks drop constraint if exists hooks_signing_secret;
alter table public.hooks add constraint hooks_signing_secret check (signing_style = 'none' or signing_secret ~ '^[!-~][ -~]{6,198}[!-~]$');
grant update (signing_style, signing_secret) on public.hooks to authenticated;

alter table public.hook_events drop constraint if exists hook_events_status;
alter table public.hook_events add constraint hook_events_status check (status in ('started', 'limited', 'off', 'failed', 'refused', 'duplicate'));

create table if not exists public.hook_seen (
  hook_id uuid not null references public.hooks (id) on delete cascade,
  key_hash text not null,
  expires_at timestamptz not null,
  primary key (hook_id, key_hash),
  constraint hook_seen_hash_shape check (key_hash ~ '^[0-9a-f]{64}$')
);

create index if not exists hook_seen_expires_idx on public.hook_seen (expires_at);

alter table public.hook_seen enable row level security;

revoke all on public.hook_seen from anon;
revoke all on public.hook_seen from authenticated;
