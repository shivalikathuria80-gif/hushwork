-- One small speed fix for the "schedules" table: an index on last_run_id, which links a schedule to its latest run.
-- Without it, Postgres has to scan the whole schedules table when a run is deleted (to clear that link).
-- Safe to run more than once. Paste it into Supabase (Dashboard > SQL Editor > New query > paste > Run).
create index if not exists schedules_last_run_id_idx on public.schedules (last_run_id);
