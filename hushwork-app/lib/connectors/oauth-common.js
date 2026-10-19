// The part of every OAuth sign-in (Linear, Google...) that is the same: sending a form to the app's token address and reading
// the answer. Nothing here reads settings or the database: values are handed in, and `fetchImpl` can be replaced so tests
// never call a real service. Failures come back as short fixed sentences, never the service's own text, and never anything
// holding a secret.

export const OAUTH_FAILED = {
  failed: "The sign-in was not accepted. Press Connect again.",
  network: "Could not reach the other app. Check your connection and try again.",
};

const TIMEOUT_MS = 10_000;
export const formBody = (fields) => new URLSearchParams(fields).toString();

// Sends `fields` as a form to `url` and reads { access_token, refresh_token?, expires_in? }.
// Returns { ok: true, accessToken, refreshToken (or null), expiresAt (milliseconds, or null) } or { ok: false, error }.
export async function postTokenForm(url, fields, { fetchImpl = fetch, now = Date.now } = {}) {
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: formBody(fields),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return { ok: false, error: response.status >= 500 ? OAUTH_FAILED.network : OAUTH_FAILED.failed };
    const body = await response.json();
    const accessToken = typeof body?.access_token === "string" ? body.access_token : "";
    if (!accessToken || accessToken.length > 1500) return { ok: false, error: OAUTH_FAILED.failed };
    const refreshToken = typeof body?.refresh_token === "string" && body.refresh_token.length <= 1500 ? body.refresh_token : null;
    const seconds = Number(body?.expires_in);
    return { ok: true, accessToken, refreshToken, expiresAt: Number.isFinite(seconds) && seconds > 0 ? now() + seconds * 1000 : null };
  } catch {
    return { ok: false, error: OAUTH_FAILED.network };
  }
}

// Best effort: tells the other app to cancel a token. Never throws, and the answer does not matter to the person.
export async function postRevoke(url, fields, { fetchImpl = fetch } = {}) {
  try {
    await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: formBody(fields),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    // nothing to do: the person is disconnected on our side either way
  }
}
