// Where to send someone after they sign in. Only three places are valid to come back to: the chatbot "Allow" page (lib/plugin/oauth.js),
// a ready-made agent opened from a public agent page (/app/builder?template=<id>), and a shared agent sentence put in the Agents box
// (/app/agents?try=<sentence, URL-encoded>). Anything else, including another site ("//evil.example") or a backslash trick, falls back to /app.
// Used by the sign-in action and proxy.js.
const TEMPLATE_NEXT = /^\/app\/builder\?template=[a-z0-9]{1,40}$/;
// encodeURIComponent output only: letters, digits, - _ . ! ~ * ' ( ) and %XX. No spaces, slashes, backslashes or "&".
const TRY_NEXT = /^\/app\/agents\?try=(?:[A-Za-z0-9\-_.!~*'()]|%[0-9A-Fa-f]{2}){1,1950}$/;

export function safeNext(value) {
  if (typeof value !== "string" || value.length > 2000) return "";
  if (TEMPLATE_NEXT.test(value) || TRY_NEXT.test(value)) return value;
  if (!value.startsWith("/oauth/authorize?") || /[\\\s]/.test(value)) return "";
  return value;
}
