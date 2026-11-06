// Personal API tokens for the Hushwork plugin (a chatbot such as Claude reaching /api/mcp). Plain code: no Next.js, the database client is
// handed in, so tests can use a pretend one.
//
// A token looks like "hw_" + 43 letters and digits (32 random bytes). It is shown to the person ONCE, on the Settings page. Only its SHA-256
// hash is saved (supabase/api-tokens.sql), with a short prefix so the person can tell their tokens apart. Checking a token = hashing what
// the chatbot sent and looking that hash up with the all-access client.
import { createHash, randomBytes } from "node:crypto";

export const TOKEN_PREFIX = "hw_";
export const MAX_TOKENS = 5;
export const TOKEN_SETUP = "Chatbot tokens need one setup step that is not done yet. Open supabase/api-tokens.sql and run it in Supabase.";
const TOKEN_SHAPE = /^hw_[A-Za-z0-9_-]{43}$/;
export const NO_TABLE = new Set(["42P01", "PGRST205"]);

export const hashToken = (token) => createHash("sha256").update(String(token)).digest("hex");
export const looksLikeToken = (value) => typeof value === "string" && TOKEN_SHAPE.test(value);

// A new token: { token, hash, prefix }. Only `hash` and `prefix` are saved.
export function makeToken() {
  const token = `${TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
  return { token, hash: hashToken(token), prefix: token.slice(0, 9) };
}

// The token from an "Authorization: Bearer hw_..." header, or "".
export function bearerToken(header) {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(String(header ?? ""));
  return match && looksLikeToken(match[1]) ? match[1] : "";
}

// Whose token is this? `admin` is the all-access client. Returns { userId, tokenId } or null (unknown, malformed, or the table is missing).
// Marks the token as used (best effort, at most about once a minute so a busy chat does not write on every call).
export async function findTokenOwner(admin, token, now = Date.now()) {
  if (!admin || !looksLikeToken(token)) return null;
  try {
    const { data, error } = await admin.from("api_tokens").select("id, user_id, last_used_at").eq("token_hash", hashToken(token)).limit(1);
    if (error || !data?.[0]?.user_id) return null;
    const row = data[0];
    if (!row.last_used_at || Date.parse(row.last_used_at) < now - 60_000) {
      await admin.from("api_tokens").update({ last_used_at: new Date(now).toISOString() }).eq("id", row.id);
    }
    return { userId: String(row.user_id), tokenId: String(row.id) };
  } catch {
    return null;
  }
}

// The name the person typed for a new token: 1 to 60 characters. Returns { value } or { error }.
export function checkTokenName(value) {
  const name = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (!name) return { error: "Give the token a name, like \"Claude on my laptop\"." };
  if (name.length > 60) return { error: "Keep the name under 60 characters." };
  return { value: name };
}
