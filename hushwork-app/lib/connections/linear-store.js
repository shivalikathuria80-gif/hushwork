// Saves, loads, renews and removes one person's Linear connection in the "connections" table (supabase/connections.sql).
// Every token is scrambled (lib/connections/crypto.js) before it is written and unscrambled only here, on the server.
// Nothing is read from settings in this file: the database client, the scrambling key and the Linear app are handed in
// (so tests can use a pretend database). The client is the signed-in person's own, so the database's rules (only my rows)
// apply on top of the `.eq("user_id", ...)` below. Nothing here ever logs or returns a token except loadLinearAccess,
// which returns the access token to the one server function that needs it.
import { decryptText, encryptText } from "./crypto.js";
import { refreshTokens, revokeToken } from "../connectors/linear-oauth.js";

const TABLE = "connections";
const RENEW_BEFORE_MS = 60_000; // renew a minute early so a token never runs out mid-request

// tokens: { accessToken, refreshToken, expiresAt (ms or null) }. Returns { ok: true } or { ok: false, code }.
export async function saveLinearConnection({ supabase, key, tokens }) {
  const row = {
    provider: "linear",
    access_token_enc: encryptText(tokens.accessToken, key),
    refresh_token_enc: tokens.refreshToken ? encryptText(tokens.refreshToken, key) : null,
    expires_at: tokens.expiresAt ? new Date(tokens.expiresAt).toISOString() : null,
  };
  // Connecting again replaces the old row: the table allows one per person and app.
  const { error } = await supabase.from(TABLE).upsert(row, { onConflict: "user_id,provider" });
  return error ? { ok: false, code: error.code ?? "unknown" } : { ok: true };
}

// Returns { token } with a working access token (renewed first if it ran out), or null when the person has no connection or
// it cannot be used (table missing, wrong key, Linear refused the renewal).
export async function loadLinearAccess({ supabase, userId, key, app, now = Date.now, fetchImpl }) {
  const { data, error } = await supabase
    .from(TABLE).select("access_token_enc, refresh_token_enc, expires_at")
    .eq("user_id", userId).eq("provider", "linear").limit(1);
  const row = error ? null : data?.[0];
  if (!row) return null;
  let access;
  let refresh = null;
  try {
    access = decryptText(row.access_token_enc, key);
    refresh = row.refresh_token_enc ? decryptText(row.refresh_token_enc, key) : null;
  } catch {
    return null; // the scrambling key changed or the row was altered: treat it as not connected
  }
  const expiresAt = row.expires_at ? Date.parse(row.expires_at) : null;
  if (!expiresAt || expiresAt - RENEW_BEFORE_MS > now()) return { token: access };
  if (!refresh) return null;

  const renewed = await refreshTokens({ clientId: app.clientId, clientSecret: app.clientSecret, refreshToken: refresh, fetchImpl, now });
  if (!renewed.ok) return null;
  const { error: saveError } = await supabase
    .from(TABLE)
    .update({
      access_token_enc: encryptText(renewed.accessToken, key),
      refresh_token_enc: renewed.refreshToken ? encryptText(renewed.refreshToken, key) : null,
      expires_at: renewed.expiresAt ? new Date(renewed.expiresAt).toISOString() : null,
    })
    .eq("user_id", userId).eq("provider", "linear");
  if (saveError) return null; // Linear already replaced the old refresh token, so keep going only if the new pair was saved
  return { token: renewed.accessToken };
}

// Disconnect: tell Linear to cancel the permission (best effort), then delete the row. Returns { ok: true } or { ok: false }.
export async function removeLinearConnection({ supabase, userId, key, fetchImpl }) {
  const access = await loadLinearAccess({ supabase, userId, key, app: null, now: () => 0, fetchImpl }).catch(() => null);
  if (access?.token) await revokeToken({ token: access.token, fetchImpl });
  const { error } = await supabase.from(TABLE).delete().eq("user_id", userId).eq("provider", "linear");
  return { ok: !error };
}
