import "server-only";

// The ONLY place that reads the Composio key. It lives in hushwork-app/.env.local (git ignores that file). Same rules as the Groq
// key: the name never starts with NEXT_PUBLIC_, it is never logged or shown on a page, and "server-only" above makes the build
// fail if browser code ever imports this file. A missing or blank key means "More apps" is not switched on.
export function getComposioKey() {
  const value = (process.env.COMPOSIO_API_KEY ?? "").trim();
  return value || null;
}
