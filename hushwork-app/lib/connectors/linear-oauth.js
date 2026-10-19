// The "Connect Linear" sign-in, step by step (OAuth 2.0, as described in Linear's developer docs):
//   1. authorizeUrl: the address we send the person to. Linear shows an Allow screen.
//   2. Linear sends them back to us with a one-time "code" (and our "state", a random value that proves it is the same visit).
//   3. exchangeCode: we swap the code for an access token (valid 24 hours) and a refresh token. This uses our app's secret,
//      so it only ever runs on the server.
//   4. refreshTokens: when the access token runs out, the refresh token gets a new pair.
//   5. revokeToken: when someone disconnects, we tell Linear to cancel the permission.
// Nothing here reads settings or the database: values are handed in, and `fetchImpl` can be replaced so tests never call
// the real Linear. Failures come back as short fixed sentences, never Linear's own text, and never anything holding a secret.

export const LINEAR_OAUTH_FAILED = {
  failed: "Linear did not accept the sign-in. Try Connect Linear again.",
  network: "Could not reach Linear. Check your connection and try again.",
};

const TIMEOUT_MS = 10_000;
const form = (fields) => new URLSearchParams(fields).toString();

export function authorizeUrl({ clientId, redirectUri, state }) {
  const url = new URL("https://linear.app/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "read"); // read only: Hushwork never asks to change anything in Linear
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "consent");
  return url.toString();
}

// Reads Linear's answer. { ok: true, accessToken, refreshToken, expiresAt } or { ok: false, error }. `now` is in milliseconds.
async function postForm(fields, { fetchImpl, now }) {
  try {
    const response = await fetchImpl("https://api.linear.app/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form(fields),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return { ok: false, error: response.status >= 500 ? LINEAR_OAUTH_FAILED.network : LINEAR_OAUTH_FAILED.failed };
    const body = await response.json();
    const accessToken = typeof body?.access_token === "string" ? body.access_token : "";
    if (!accessToken || accessToken.length > 1000) return { ok: false, error: LINEAR_OAUTH_FAILED.failed };
    const refreshToken = typeof body?.refresh_token === "string" && body.refresh_token.length <= 1000 ? body.refresh_token : null;
    const seconds = Number(body?.expires_in);
    return { ok: true, accessToken, refreshToken, expiresAt: Number.isFinite(seconds) && seconds > 0 ? now() + seconds * 1000 : null };
  } catch {
    return { ok: false, error: LINEAR_OAUTH_FAILED.network };
  }
}

export const exchangeCode = ({ clientId, clientSecret, redirectUri, code, fetchImpl = fetch, now = Date.now }) =>
  postForm({ grant_type: "authorization_code", code, redirect_uri: redirectUri, client_id: clientId, client_secret: clientSecret }, { fetchImpl, now });

export const refreshTokens = ({ clientId, clientSecret, refreshToken, fetchImpl = fetch, now = Date.now }) =>
  postForm({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret }, { fetchImpl, now });

// Best effort: tells Linear to cancel a token. Never throws, and the answer does not matter to the person.
export async function revokeToken({ token, fetchImpl = fetch }) {
  try {
    await fetchImpl("https://api.linear.app/oauth/revoke", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form({ token }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    // nothing to do: the person is disconnected on our side either way
  }
}
