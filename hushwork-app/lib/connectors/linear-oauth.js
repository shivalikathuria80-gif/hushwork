// The "Connect Linear" sign-in, step by step (OAuth 2.0, as described in Linear's developer docs):
//   1. authorizeUrl: the address we send the person to. Linear shows an Allow screen.
//   2. Linear sends them back to us with a one-time "code" (and our "state", a random value that proves it is the same visit).
//   3. exchangeCode: we swap the code for an access token (valid 24 hours) and a refresh token. This uses our app's secret,
//      so it only ever runs on the server.
//   4. refreshTokens: when the access token runs out, the refresh token gets a new pair.
//   5. revokeToken: when someone disconnects, we tell Linear to cancel the permission.
// The shared form-sending part is in oauth-common.js; this file only knows Linear's addresses and field names.
import { postRevoke, postTokenForm, OAUTH_FAILED } from "./oauth-common.js";

export const LINEAR_OAUTH_FAILED = OAUTH_FAILED;
const TOKEN_URL = "https://api.linear.app/oauth/token";

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

export const exchangeCode = ({ clientId, clientSecret, redirectUri, code, fetchImpl, now }) =>
  postTokenForm(TOKEN_URL, { grant_type: "authorization_code", code, redirect_uri: redirectUri, client_id: clientId, client_secret: clientSecret }, { fetchImpl, now });

export const refreshTokens = ({ clientId, clientSecret, refreshToken, fetchImpl, now }) =>
  postTokenForm(TOKEN_URL, { grant_type: "refresh_token", refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret }, { fetchImpl, now });

export const revokeToken = ({ token, fetchImpl }) => postRevoke("https://api.linear.app/oauth/revoke", { token }, { fetchImpl });
