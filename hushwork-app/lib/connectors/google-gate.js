// GOOGLE IS PAUSED for most people (D-054) until Google approves the Hushwork Google app. Until then Google lets only its listed test users sign in,
// so a stranger pressing "Connect Google" would only meet an error. This gate closes Hushwork's OWN Google connection (reading Gmail, Calendar and
// Drive, and adding Sheet rows) for everyone except the accounts named in one server setting. The Google keys stay where they are.
// Google apps through Composio (Gmail sending, Docs, Sheets, Slides, Calendar events, Drive folders) use Composio's own Google app and are NOT gated.
//
// GOOGLE_ONLY_FOR (a server setting on Vercel and in .env.local, never NEXT_PUBLIC_): account ids (Supabase user ids), separated by commas.
//   set      -> only those accounts may connect or use Google; everyone else is told it is coming soon
//   not set  -> Google is open to everyone (delete the setting once Google has approved the app)
// The id checked is always the one the server read from the session or from a saved schedule row: nothing a browser sends can change it.
// No Next.js here, so tests can load it.
export const GOOGLE_SOON = "Google is coming soon: Google is still reviewing Hushwork. Use Google Workspace on the Connections page for now.";

export function googleOpenFor(userId, setting = process.env.GOOGLE_ONLY_FOR) {
  const allowed = String(setting ?? "").split(",").map((id) => id.trim()).filter(Boolean);
  if (allowed.length === 0) return true;
  return typeof userId === "string" && allowed.includes(userId);
}
