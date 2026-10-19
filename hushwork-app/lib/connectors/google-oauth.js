// The "Connect Google" sign-in (OAuth 2.0, as described in Google's developer docs). Same five steps as Linear
// (linear-oauth.js), with Google's addresses:
//   - the Allow screen asks for ONE permission: read-only access to the person's calendar events. Hushwork cannot add,
//     change or delete anything in the calendar with it.
//   - "access_type=offline" and "prompt=consent" make Google hand out a refresh token, which lets Hushwork renew the
//     short-lived access token (about an hour) without asking the person again.
//   - Google gives the refresh token only the first time and keeps it valid when it renews, so a renewal answer has no new
//     refresh token (lib/connections/store.js keeps the old one).
import { postRevoke, postTokenForm } from "./oauth-common.js";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

export function authorizeUrl({ clientId, redirectUri, state }) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_SCOPE);
  url.searchParams.set("state", state);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  return url.toString();
}

export const exchangeCode = ({ clientId, clientSecret, redirectUri, code, fetchImpl, now }) =>
  postTokenForm(TOKEN_URL, { grant_type: "authorization_code", code, redirect_uri: redirectUri, client_id: clientId, client_secret: clientSecret }, { fetchImpl, now });

export const refreshTokens = ({ clientId, clientSecret, refreshToken, fetchImpl, now }) =>
  postTokenForm(TOKEN_URL, { grant_type: "refresh_token", refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret }, { fetchImpl, now });

export const revokeToken = ({ token, fetchImpl }) => postRevoke("https://oauth2.googleapis.com/revoke", { token }, { fetchImpl });
