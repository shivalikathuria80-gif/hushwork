// The sign-in steps for ANY app in lib/connectors/app-list.js (OAuth 2.0). Same five steps for every app:
//   1. authorizeUrl: the address we send the person to. The app shows an Allow screen.
//   2. The app sends them back to us with a one-time "code" and our "state" (a random value that proves it is the same visit).
//   3. exchangeCode: we swap the code for an access token and (usually) a refresh token. This uses our app's secret, so it only
//      ever runs on the server.
//   4. refreshTokens: when the access token runs out, the refresh token gets a new one.
//   5. revokeToken: when someone disconnects, we tell the app to cancel the permission.
// The first argument is the app's entry from the list; its addresses and permissions come from there. The shared form-sending
// part is in oauth-common.js. Nothing here reads settings or the database.
import { postRevoke, postTokenForm } from "./oauth-common.js";

export function authorizeUrl(entry, { clientId, redirectUri, state }) {
  const url = new URL(entry.authorizeUrl);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", entry.scopes.join(entry.scopeSeparator ?? " "));
  url.searchParams.set("state", state);
  for (const [name, value] of Object.entries(entry.extraAuthorize ?? {})) url.searchParams.set(name, value);
  return url.toString();
}

export const exchangeCode = (entry, { clientId, clientSecret, redirectUri, code, fetchImpl, now }) =>
  postTokenForm(entry.tokenUrl, { grant_type: "authorization_code", code, redirect_uri: redirectUri, client_id: clientId, client_secret: clientSecret }, { fetchImpl, now });

export const refreshTokens = (entry, { clientId, clientSecret, refreshToken, fetchImpl, now }) =>
  postTokenForm(entry.tokenUrl, { grant_type: "refresh_token", refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret }, { fetchImpl, now });

export const revokeToken = (entry, { token, fetchImpl }) => postRevoke(entry.revokeUrl, { token }, { fetchImpl });
