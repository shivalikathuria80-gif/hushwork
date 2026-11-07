import { headers } from "next/headers";
import { register, allowRegister } from "@/lib/plugin/oauth-server";
import { oauthJson, preflight, readForm } from "@/lib/plugin/http";
import { visitorAddress } from "@/lib/visitor";

// Dynamic Client Registration (RFC 7591): a chatbot introduces itself (its name and where to send the person back) and gets a client_id.
// Registering grants nothing: the person still has to sign in and press Allow on /oauth/authorize.
export async function POST(request) {
  if (!allowRegister(visitorAddress(await headers()))) return oauthJson({ error: "slow_down", error_description: "Too many registrations. Try again later." }, 429, { "retry-after": "3600" });
  const body = await readForm(request);
  if (!body) return oauthJson({ error: "invalid_client_metadata", error_description: "Send a JSON object under 16 KB." }, 400);
  const answer = await register(body);
  if (!answer) return oauthJson({ error: "temporarily_unavailable", error_description: "This Hushwork server is not set up for chatbots yet." }, 503);
  return oauthJson(answer.body, answer.status);
}
export const OPTIONS = preflight;
