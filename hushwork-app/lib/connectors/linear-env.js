import "server-only";

// The ONLY place that reads the Linear key. It is a "personal API key": a long secret code that lets a program act as you
// in Linear. It lives in hushwork-app/.env.local (git ignores that file) and is read here, on the server, when a request
// arrives. Same rules as the Groq key: the name never starts with NEXT_PUBLIC_, it is never logged or shown on a page,
// and "server-only" above makes the build fail if browser code ever imports this file.
// A missing or blank key means Linear is not connected.
export function getLinearKey() {
  const value = (process.env.LINEAR_API_KEY ?? "").trim();
  return value || null;
}
