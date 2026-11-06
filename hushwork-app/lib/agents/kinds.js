// Plain data about agents, safe for any page to import (lib/agents/create.js pulls in the whole run engine; this does not).
// An agent is a row in `workflows` with kind = 'agent' (supabase/agents.sql). Before that file is run there is no `kind` column:
// Postgres answers 42703 and the Supabase API PGRST204, and the app then behaves as before agents existed.
export const AGENT_KIND = "agent";
export const NO_KIND_COLUMN = new Set(["42703", "PGRST204"]);
export const SETUP = "Agents need one setup step that is not done yet. Open supabase/agents.sql and run it in Supabase.";
