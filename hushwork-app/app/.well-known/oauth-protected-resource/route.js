import { resourceMetadata, siteOrigin } from "@/lib/plugin/oauth";
import { oauthJson, preflight } from "@/lib/plugin/http";

// RFC 9728: tells a chatbot that /api/mcp signs people in with Hushwork's own OAuth server (lib/plugin/oauth.js).
export const GET = (request) => oauthJson(resourceMetadata(siteOrigin(request.url)), 200, { "cache-control": "public, max-age=3600" });
export const OPTIONS = preflight;
