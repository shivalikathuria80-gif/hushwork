import { serverMetadata, siteOrigin } from "@/lib/plugin/oauth";
import { oauthJson, preflight } from "@/lib/plugin/http";

// RFC 8414: where a chatbot registers, sends the person to say yes, and swaps the code for tokens (lib/plugin/oauth.js).
export const GET = (request) => oauthJson(serverMetadata(siteOrigin(request.url)), 200, { "cache-control": "public, max-age=3600" });
export const OPTIONS = preflight;
