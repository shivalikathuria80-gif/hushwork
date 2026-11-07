import { resourceMetadata, siteOrigin } from "@/lib/plugin/oauth";
import { oauthJson, preflight } from "@/lib/plugin/http";

// The same answer at /.well-known/oauth-protected-resource/api/mcp (RFC 9728 puts the resource's path after the well-known name). Only
// /api/mcp is a protected resource here.
export async function GET(request, { params }) {
  const { path } = await params;
  if ((path ?? []).join("/") !== "api/mcp") return oauthJson({ error: "not_found" }, 404);
  return oauthJson(resourceMetadata(siteOrigin(request.url)), 200, { "cache-control": "public, max-age=3600" });
}
export const OPTIONS = preflight;
