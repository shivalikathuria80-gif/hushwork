// Where to send someone after they sign in. Only the chatbot "Allow" page is a valid place to come back to (lib/plugin/oauth.js): anything
// else, including another site ("//evil.example") or a backslash trick, falls back to /app. Used by the sign-in action and proxy.js.
export function safeNext(value) {
  if (typeof value !== "string" || value.length > 2000) return "";
  if (!value.startsWith("/oauth/authorize?") || /[\\\s]/.test(value)) return "";
  return value;
}
