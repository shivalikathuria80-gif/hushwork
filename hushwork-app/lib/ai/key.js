import "server-only";

// The ONLY place that reads the Groq API key. An API key is a secret password for a service: whoever holds it can spend
// the account's allowance. It lives in hushwork-app/.env.local (git ignores that file) and is read here, on the server,
// at the moment a request arrives. Three rules:
//   - the name never starts with NEXT_PUBLIC_ (that prefix would copy the value into the browser's JavaScript),
//   - it is never logged, returned to the page or put in a prompt,
//   - "server-only" above makes the build fail if browser code ever imports this file.
// A missing or blank key means AI planning is off and the keyword preview is used.
export function getGroqKey() {
  const value = (process.env.GROQ_API_KEY ?? "").trim();
  return value || null;
}
