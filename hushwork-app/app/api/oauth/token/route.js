import { headers } from "next/headers";
import { token, allowTokenCall } from "@/lib/plugin/oauth-server";
import { clientCredentials, siteOrigin } from "@/lib/plugin/oauth";
import { oauthJson, preflight, readForm } from "@/lib/plugin/http";
import { visitorAddress } from "@/lib/visitor";

// The token endpoint: swaps the one-time code (with its PKCE verifier) for an access token and a refresh token, and a refresh token for a
// new pair (lib/plugin/oauth.js exchangeToken). Only hashes are stored; the tokens are in this answer and nowhere else.
export async function POST(request) {
  const sent = await headers();
  if (!allowTokenCall(visitorAddress(sent))) return oauthJson({ error: "slow_down", error_description: "Too many requests. Wait a minute." }, 429, { "retry-after": "60" });
  const form = await readForm(request);
  if (!form) return oauthJson({ error: "invalid_request", error_description: "Send a form body." }, 400);
  const answer = await token(form, clientCredentials(form, sent.get("authorization")), siteOrigin(request.url));
  if (!answer) return oauthJson({ error: "temporarily_unavailable", error_description: "This Hushwork server is not set up for chatbots yet." }, 503);
  return oauthJson(answer.body, answer.status, answer.status === 401 ? { "www-authenticate": 'Basic realm="hushwork"' } : {});
}
export const OPTIONS = preflight;
