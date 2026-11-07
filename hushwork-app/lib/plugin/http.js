// Answers for the OAuth endpoints and the .well-known files. They carry no cookies and are read by chatbots, some of which run in a browser
// (the MCP Inspector), so any site may read them (CORS *). Never used for /api/mcp itself, which refuses browser pages.
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "authorization, content-type, mcp-protocol-version",
  "access-control-max-age": "86400",
};

export const oauthJson = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json", "cache-control": "no-store", pragma: "no-cache", ...CORS, ...extra },
});

export const preflight = () => new Response(null, { status: 204, headers: CORS });

// A token or registration request body: a form (the OAuth standard) or JSON (some clients). Returns an object of strings, or null.
export async function readForm(request, max = 16_000) {
  const raw = await request.text();
  if (raw.length > max) return null;
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return Object.fromEntries(new URLSearchParams(raw));
}
