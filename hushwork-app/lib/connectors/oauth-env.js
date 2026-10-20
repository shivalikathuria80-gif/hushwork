import "server-only";

// The ONLY place that reads the settings for the Connect buttons. All of them live in hushwork-app/.env.local (git ignores
// that file). Same rules as the Groq key: never NEXT_PUBLIC_, never logged or shown on a page, and "server-only" above
// makes the build fail if browser code ever imports this file.
//   <PREFIX>_CLIENT_ID, <PREFIX>_CLIENT_SECRET  Hushwork's own "app" on that site (made once by the owner), one pair per app in
//                                               lib/connectors/app-list.js (LINEAR_..., GOOGLE_...). The secret is SECRET.
//   CONNECTIONS_KEY                             the secret that scrambles each person's saved permission before it goes into the
//                                               database (make one with `npm run secret`). Losing it means everyone must reconnect.
// Missing or blank values mean the Connect button is not set up.
const read = (name) => (process.env[name] ?? "").trim();

// `entry` is one app from app-list.js. Returns { clientId, clientSecret } or null.
export function getApp(entry) {
  const clientId = read(`${entry.envPrefix}_CLIENT_ID`);
  const clientSecret = read(`${entry.envPrefix}_CLIENT_SECRET`);
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function getConnectionsKey() {
  return read("CONNECTIONS_KEY") || null;
}

