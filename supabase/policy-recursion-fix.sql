-- ONLY NEEDED if you pasted supabase/memory.sql or supabase/skills.sql BEFORE 2026-10-25. The first versions counted rows inside their own insert
-- policy, which Postgres refuses ("infinite recursion detected in policy", error 42P17), so Turn on (Skills) and Remember (Memory) never worked.
-- This swaps that policy for the same rule written as a trigger. Safe to run twice. If you have not pasted those two files yet, skip this: they are already fixed.

drop policy if exists "owner can enable bundles for themself (at most 20)" on public.enabled_bundles;
drop policy if exists "owner can enable bundles for themself" on public.enabled_bundles;
create policy "owner can enable bundles for themself"
  on public.enabled_bundles for insert to authenticated
  with check ((select auth.uid()) = user_id);

create or replace function public.enabled_bundles_cap() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.enabled_bundles t where t.user_id = new.user_id) >= 20 then
    raise exception 'at most 20 bundles per person' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists enabled_bundles_cap on public.enabled_bundles;
create trigger enabled_bundles_cap before insert on public.enabled_bundles for each row execute function public.enabled_bundles_cap();

drop policy if exists "owner can add own memories (at most 50)" on public.workflow_memories;
drop policy if exists "owner can add own memories" on public.workflow_memories;
create policy "owner can add own memories"
  on public.workflow_memories for insert to authenticated
  with check ((select auth.uid()) = user_id);

create or replace function public.workflow_memories_cap() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.workflow_memories t where t.user_id = new.user_id) >= 50 then
    raise exception 'at most 50 facts per person' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists workflow_memories_cap on public.workflow_memories;
create trigger workflow_memories_cap before insert on public.workflow_memories for each row execute function public.workflow_memories_cap();
