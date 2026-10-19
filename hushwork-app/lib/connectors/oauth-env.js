import "server-only";

// The ONLY place that reads the settings for the Connect button. All three live in hushwork-app/.env.local (git ignores
// that file). Same rules as the Groq key: never NEXT_PUBLIC_, never logged or shown on a page, and "server-only" above
// makes the build fail if browser code ever imports this file.
//   LINEAR_CLIENT_ID, LINEAR_CLIENT_SECRET  Hushwork's own "app" in Linear (made once by the owner). The secret is SECRET.
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET  the same for Hushwork's own app in Google Cloud. The secret is SECRET.
//   CONNECTIONS_KEY                         the secret that scrambles each person's saved permission before it goes into the
//                                           database (make one with `npm run secret`). Losing it means everyone must reconnect.
// Missing or blank values mean the Connect button is not set up.
const read = (name) => (process.env[name] ?? "").trim();

export function getLinearApp() {
  const clientId = read("LINEAR_CLIENT_ID");
  const clientSecret = read("LINEAR_CLIENT_SECRET");
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function getGoogleApp() {
  const clientId = read("GOOGLE_CLIENT_ID");
  const clientSecret = read("GOOGLE_CLIENT_SECRET");
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function getConnectionsKey() {
  return read("CONNECTIONS_KEY") || null;
}

