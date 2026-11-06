-- AGENTS (D-055): marks which saved workflows are agents, the ones a person made from one plain-English sentence on the Agents page.
-- An agent is an ordinary row in public.workflows, so every rule in workflows.sql (row level security, the owner-only policies, the size
-- limits) already covers it. This only adds one column:
--   kind  'workflow' (made in the workspace, the Builder, a template or a skill: the default, so every existing row stays a workflow)
--         'agent'    (made on the Agents page)
-- A person may choose the kind when a row is ADDED, never change it later (no update grant), so an agent stays an agent.
-- Run it once, after workflows.sql. Safe to run more than once.
-- Paste it into Supabase (Dashboard > SQL Editor > New query > paste > Run).
-- Until it is run, the app works as before: the Agents page says this step is missing, and the workflow lists show everything.

alter table public.workflows add column if not exists kind text not null default 'workflow';

alter table public.workflows drop constraint if exists workflows_kind_check;
alter table public.workflows add constraint workflows_kind_check check (kind in ('workflow', 'agent'));

grant insert (kind) on public.workflows to authenticated;

-- AFTER APPLYING, check it (read-only, safe any time):
--   select kind, count(*) from public.workflows group by kind;   -- every old row says workflow
-- ROLLBACK (agents then show as ordinary workflows; nothing is deleted):
--   revoke insert (kind) on public.workflows from authenticated;
--   alter table public.workflows drop column kind;
