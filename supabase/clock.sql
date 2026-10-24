-- A RELIABLE CLOCK, INSIDE SUPABASE. It asks Hushwork "is any schedule due?" once a minute, for free.
--
-- Why: GitHub's free timer (.github/workflows/clock.yml) only fires every 3 to 4 hours in practice, so a schedule such as "every morning at 9"
-- could run hours late. Supabase can call Hushwork itself every minute, using two features of the database you already have:
--   pg_cron  runs a SQL command on a schedule,   pg_net  lets SQL make a web request.
--
-- BEFORE YOU RUN IT (this is the only edit):
--   1. Find the line below that says PASTE_YOUR_CRON_SECRET_HERE and replace those words with the SAME password you set as CRON_SECRET on
--      Vercel. Keep the quote marks around it.
--   2. If your site address is not https://hushwork-six.vercel.app, change the address in the last command too.
-- Then paste the whole file into Supabase (Dashboard > SQL Editor > New query > paste > Run).
--
-- The password is stored in Supabase's own secret store (Vault), not written into the job. It is only ever sent to your own Hushwork address.
-- Safe to run again (it will not store the password twice and it replaces the job with the same name).
--
-- TO SEE IT WORKING (after a couple of minutes):   select * from cron.job_run_details order by start_time desc limit 5;
-- TO TURN IT OFF:                                  select cron.unschedule('hushwork-clock');

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare
  the_password text := 'PASTE_YOUR_CRON_SECRET_HERE';   -- <-- replace the words between the quotes with your CRON_SECRET
begin
  if starts_with(the_password, 'PASTE_YOUR') then
    raise exception 'Put your CRON_SECRET (the same password as on Vercel) between the quotes on the line above, then run this again.';
  end if;
  if not exists (select 1 from vault.secrets where name = 'hushwork_cron_secret') then
    perform vault.create_secret(the_password, 'hushwork_cron_secret', 'The password the Hushwork clock sends to /api/cron/tick');
  end if;
end $$;

select cron.schedule(
  'hushwork-clock',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://hushwork-six.vercel.app/api/cron/tick',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'hushwork_cron_secret')),
    timeout_milliseconds := 20000
  ) as request_id;
  $$
);
