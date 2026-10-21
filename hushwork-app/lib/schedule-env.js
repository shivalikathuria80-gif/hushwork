import "server-only";

// The ONLY place that reads the two settings scheduled runs need. Both live in hushwork-app/.env.local (git ignores that file) and, online,
// in the host's environment variables. Same rules as the other keys: never NEXT_PUBLIC_, never logged or shown on a page, and "server-only"
// above makes the build fail if browser code ever imports this file.
//   CRON_SECRET                 a long random password that only the clock knows. The clock sends it with every call to /api/cron/tick,
//                               and the address does nothing without it. Make one with: npm run secret
//   SUPABASE_SERVICE_ROLE_KEY   Supabase's all-access key (Dashboard > Project Settings > API Keys > secret key). It can read and write
//                               EVERY person's rows and ignores the database's privacy rules, so it is used in exactly one place
//                               (lib/supabase/admin.js, for scheduled runs) and only after the clock's password was checked.
// A missing or blank value means scheduled runs are not switched on.
const read = (name) => (process.env[name] ?? "").trim();

export const getCronSecret = () => read("CRON_SECRET") || null;
export const getServiceRoleKey = () => read("SUPABASE_SERVICE_ROLE_KEY") || null;
