-- APPROVE FROM A NOTIFICATION (lib/approve-links.js, lib/approve-notify.js, app/a/[code]). Paste this whole file into Supabase > SQL Editor > Run.
-- Safe to run once.
--
--   notify_settings     one row per person: where Hushwork may tell them a step is waiting (email, Slack, push), once each time or as one
--                       daily digest, and whether those messages may carry a "review and approve" link.
--   push_subscriptions  the browsers a person switched push on in (the address the browser's push service gave, and its two public keys).
--   approve_links       one row per "review and approve" link Hushwork sent: only the HASH of the link's code, which run and step it is for,
--                       the hash of the exact words that step would send at that moment, when it stops working, and whether it was used.
--                       Written by the server only (the all-access key); the person can read and cancel their own.
--
-- A link never approves by being opened: it opens a page that shows the exact words, and only the button on that page does the step, with the
-- same "changed since you read it" check the Runs page uses. A link works ONCE, for ONE step, and for 48 hours at most.

create table public.notify_settings (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade primary key,
  email boolean not null default true,                  -- tell me by email (through my own Gmail connection, to my own address)
  slack boolean not null default false,                 -- tell me in Slack, as a direct message to me only
  slack_to text,                                        -- my Slack member id (U..., a direct message to me), never a channel
  push boolean not null default false,                  -- tell me with a push notification on the browsers I switched on
  links boolean not null default false,                 -- the messages may carry a one-step "review and approve" link
  digest boolean not null default false,                -- false: each time a step waits; true: one digest a day at digest_hour
  digest_hour integer not null default 9,
  tz_offset integer not null default 0,                 -- minutes EAST of UTC (India is 330), as lib/watch-rules.js reads it
  last_digest_at timestamptz,                           -- written by the server only
  updated_at timestamptz not null default now(),

  constraint notify_settings_hour check (digest_hour between 8 and 19),   -- a digest is never sent in the quiet hours (20:00 to 08:00)
  constraint notify_settings_tz check (tz_offset between -840 and 840),
  constraint notify_settings_slack_to check (slack_to is null or slack_to ~ '^[UW][A-Z0-9]{6,15}$')
);

alter table public.notify_settings enable row level security;

revoke all on public.notify_settings from anon;
revoke all on public.notify_settings from authenticated;
grant select on public.notify_settings to authenticated;
grant insert (email, slack, slack_to, push, links, digest, digest_hour, tz_offset, updated_at) on public.notify_settings to authenticated;
grant update (email, slack, slack_to, push, links, digest, digest_hour, tz_offset, updated_at) on public.notify_settings to authenticated;

create policy "people read their own notice settings" on public.notify_settings for select to authenticated using ((select auth.uid()) = user_id);
create policy "people add their own notice settings" on public.notify_settings for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "people change their own notice settings" on public.notify_settings for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null unique,                        -- the push service's address for this browser (checked in lib/web-push.js)
  p256dh text not null,                                 -- the browser's public key, base64url
  auth text not null,                                   -- the browser's push secret, base64url
  created_at timestamptz not null default now(),

  constraint push_endpoint_https check (endpoint ~ '^https://' and length(endpoint) <= 800),
  constraint push_p256dh_shape check (p256dh ~ '^[A-Za-z0-9_-]{80,100}$'),
  constraint push_auth_shape check (auth ~ '^[A-Za-z0-9_-]{16,30}$')
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id, created_at desc);

alter table public.push_subscriptions enable row level security;

revoke all on public.push_subscriptions from anon;
revoke all on public.push_subscriptions from authenticated;
grant select, delete on public.push_subscriptions to authenticated;
grant insert (endpoint, p256dh, auth) on public.push_subscriptions to authenticated;

create policy "people read their own push browsers" on public.push_subscriptions for select to authenticated using ((select auth.uid()) = user_id);
create policy "people add their own push browsers" on public.push_subscriptions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "people remove their own push browsers" on public.push_subscriptions for delete to authenticated using ((select auth.uid()) = user_id);

create table public.approve_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  code_hash text not null unique,                       -- sha-256 of the code in the link, hex; the code itself is never saved
  run_id uuid not null references public.runs (id) on delete cascade,
  step_index integer not null,
  words_hash text not null,                             -- sha-256 of the exact words the step would send when the link was made
  channel text not null,                                -- email | slack | push | digest
  expires_at timestamptz not null,
  used_at timestamptz,
  used_as text,                                         -- approved | turned_down
  created_at timestamptz not null default now(),

  constraint approve_links_hash_shape check (code_hash ~ '^[0-9a-f]{64}$' and words_hash ~ '^[0-9a-f]{64}$'),
  constraint approve_links_step check (step_index between 0 and 50),
  constraint approve_links_channel check (channel in ('email', 'slack', 'push', 'digest')),
  constraint approve_links_used_as check (used_as is null or used_as in ('approved', 'turned_down')),
  constraint approve_links_life check (expires_at <= created_at + interval '49 hours')
);

create index approve_links_user_idx on public.approve_links (user_id, created_at desc);
create index approve_links_run_idx on public.approve_links (run_id, step_index);

alter table public.approve_links enable row level security;

revoke all on public.approve_links from anon;
revoke all on public.approve_links from authenticated;
grant select, delete on public.approve_links to authenticated;   -- read and cancel; only the server makes or uses them

create policy "people read their own approve links" on public.approve_links for select to authenticated using ((select auth.uid()) = user_id);
create policy "people cancel their own approve links" on public.approve_links for delete to authenticated using ((select auth.uid()) = user_id);
