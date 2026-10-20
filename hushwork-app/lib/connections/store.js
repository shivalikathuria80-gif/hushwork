// Saves, loads, renews and removes one person's connection to an app ("linear" or "google") in the "connections" table
// (supabase/connections.sql). Every token is scrambled (lib/connections/crypto.js) before it is written and unscrambled only
// here, on the server. Nothing is read from settings in this file: the database client, the scrambling key and the app's
// own credentials are handed in (so tests can use a pretend database). The client is the signed-in person's own, so the
// database's rules (only my rows) apply on top of the `.eq("user_id", ...)` below. Nothing here ever logs or returns a token
// except loadAccess, which returns the access token to the one server function that needs it.
import { decryptText, encryptText } from "./crypto.js";
import { findApp, APP_IDS } from "../connectors/app-list.js";
import { refreshTokens, revokeToken } from "../connectors/oauth-app.js";

const TABLE = "connections";
const RENEW_BEFORE_MS = 60_000; // renew a minute early so a token never runs out mid-request

// Which apps exist is decided by lib/connectors/app-list.js (its addresses say how to renew and cancel a token). Only those names can be used.
export const APP_NAMES = APP_IDS;
const known = (provider) => Boolean(findApp(provider));

// tokens: { accessToken, refreshToken, expiresAt (ms or null) }. Returns { ok: true } or { ok: false, code }.
export async function saveConnection({ supabase, provider, key, tokens }) {
  if (!known(provider)) return { ok: false, code: "unknown_app" };
  const row = {
    provider,
    access_token_enc: encryptText(tokens.accessToken, key),
    refresh_token_enc: tokens.refreshToken ? encryptText(tokens.refreshToken, key) : null,
    expires_at: tokens.expiresAt ? new Date(tokens.expiresAt).toISOString() : null,
  };
  // Connecting again replaces the old row (the table allows one per person and app). This is delete-then-add on purpose, not an
  // "upsert": an upsert also needs permission to change the provider column, which nobody has (see supabase/connections.sql).
  // The delete only reaches the signed-in person's own row because of the database rules.
  const removed = await supabase.from(TABLE).delete().eq("provider", provider);
  if (removed.error) return { ok: false, code: removed.error.code ?? "unknown" };
  const { error } = await supabase.from(TABLE).insert(row);
  return error ? { ok: false, code: error.code ?? "unknown" } : { ok: true };
}

// Returns { token } with a working access token (renewed first if it ran out), or null when the person has no connection or
// it cannot be used (table missing, wrong key, the app refused the renewal).
export async function loadAccess({ supabase, userId, provider, key, app, now = Date.now, fetchImpl }) {
  if (!known(provider)) return null;
  const { data, error } = await supabase
    .from(TABLE).select("access_token_enc, refresh_token_enc, expires_at")
    .eq("user_id", userId).eq("provider", provider).limit(1);
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
  if (!refresh || !app) return null;

  const renewed = await refreshTokens(findApp(provider), { clientId: app.clientId, clientSecret: app.clientSecret, refreshToken: refresh, fetchImpl, now });
  if (!renewed.ok) {
    // Two requests can try to renew at the same moment, and the app hands out a new refresh token each time, so the second one
    // fails. Look again: if the other request already saved a fresh token, use that one.
    const again = await supabase.from(TABLE).select("access_token_enc, expires_at").eq("user_id", userId).eq("provider", provider).limit(1);
    const latest = again.error ? null : again.data?.[0];
    try {
      if (latest && latest.access_token_enc !== row.access_token_enc && Date.parse(latest.expires_at) - RENEW_BEFORE_MS > now()) return { token: decryptText(latest.access_token_enc, key) };
    } catch {
      // unreadable: treated as not connected below
    }
    return null;
  }
  const nextRefresh = renewed.refreshToken ?? refresh; // Google keeps the same refresh token; Linear sends a new one each time
  const { error: saveError } = await supabase
    .from(TABLE)
    .update({
      access_token_enc: encryptText(renewed.accessToken, key),
      refresh_token_enc: encryptText(nextRefresh, key),
      expires_at: renewed.expiresAt ? new Date(renewed.expiresAt).toISOString() : null,
    })
    .eq("user_id", userId).eq("provider", provider);
  if (saveError) return null; // the app may already have replaced the old refresh token, so go on only if the new pair was saved
  return { token: renewed.accessToken };
}

// Disconnect: tell the app to cancel the permission (best effort), then delete the row. Returns { ok: true } or { ok: false }.
export async function removeConnection({ supabase, userId, provider, key, fetchImpl }) {
  if (!known(provider)) return { ok: false };
  const access = await loadAccess({ supabase, userId, provider, key, app: null, now: () => 0, fetchImpl }).catch(() => null);
  if (access?.token) await revokeToken(findApp(provider), { token: access.token, fetchImpl });
  const { error } = await supabase.from(TABLE).delete().eq("user_id", userId).eq("provider", provider);
  return { ok: !error };
}
