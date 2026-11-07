// OAuth 2.1 sign-in for the Hushwork plugin, so a chatbot (Claude on claude.ai, Claude Code, any MCP app) can connect with a "Connect" button
// instead of a pasted token. It follows the MCP authorization spec: the chatbot finds this server from the 401 on /api/mcp, registers itself
// (Dynamic Client Registration), sends the person to /oauth/authorize to say yes, and swaps the one-time code for tokens (PKCE S256 only).
// Plain code: no Next.js, the all-access database client is handed in, so tests can use a pretend one. Tables: supabase/oauth.sql.
//
// What is kept: a SHA-256 hash of every code and token, never the thing itself (like api_tokens). An access token lasts an hour; the refresh
// token is swapped for a new pair on every use, and the old one stops working. Removing the connection on Settings deletes the grant row,
// which ends both at once.
import { createHash, randomBytes } from "node:crypto";

export const SCOPE = "hushwork";
export const ACCESS_SECONDS = 3600;
export const CODE_SECONDS = 600;
export const MAX_GRANTS = 20; // connections per person; the oldest is dropped when a new one is made
export const OAUTH_SETUP = "Connecting a chatbot needs one setup step that is not done yet. Open supabase/oauth.sql and run it in Supabase.";

const SHAPE = { access: /^hwa_[A-Za-z0-9_-]{43}$/, refresh: /^hwr_[A-Za-z0-9_-]{43}$/, code: /^hwk_[A-Za-z0-9_-]{43}$/, client: /^hwc_[A-Za-z0-9_-]{22}$/, secret: /^hws_[A-Za-z0-9_-]{43}$/ };
const hash = (value) => createHash("sha256").update(String(value)).digest("hex");
const random = (prefix, bytes = 32) => `${prefix}${randomBytes(bytes).toString("base64url")}`;
export const looksLikeAccessToken = (value) => typeof value === "string" && SHAPE.access.test(value);
const clean = (value, max) => (typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, max) : "");

// ---- where things are ---------------------------------------------------------------------------------------------------------------------------
// The public address of this app: NEXT_PUBLIC_SITE_URL when set (hushwork.in), otherwise the address the request came in on (local runs).
export function siteOrigin(requestUrl) {
  const set = (process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/+$/, "");
  if (set) return set;
  try {
    return new URL(requestUrl).origin;
  } catch {
    return "https://hushwork.in";
  }
}
// The same from a page or Server Action, which see the request's headers rather than its address.
export const requestOrigin = (sent) => siteOrigin(`${sent.get("x-forwarded-proto") ?? "http"}://${sent.get("x-forwarded-host") ?? sent.get("host") ?? "hushwork.in"}`);
export const resourceUrl = (origin) => `${origin}/api/mcp`;
export const resourceMetadataUrl = (origin) => `${origin}/.well-known/oauth-protected-resource/api/mcp`;

// RFC 9728: what /api/mcp is and who signs people in for it.
export const resourceMetadata = (origin) => ({
  resource: resourceUrl(origin),
  authorization_servers: [origin],
  scopes_supported: [SCOPE],
  bearer_methods_supported: ["header"],
  resource_name: "Hushwork",
  resource_documentation: `${origin}/docs`,
});

// RFC 8414: where to register, send the person, and swap codes.
export const serverMetadata = (origin) => ({
  issuer: origin,
  authorization_endpoint: `${origin}/oauth/authorize`,
  token_endpoint: `${origin}/api/oauth/token`,
  registration_endpoint: `${origin}/api/oauth/register`,
  scopes_supported: [SCOPE],
  response_types_supported: ["code"],
  response_modes_supported: ["query"],
  grant_types_supported: ["authorization_code", "refresh_token"],
  token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
  code_challenge_methods_supported: ["S256"],
  authorization_response_iss_parameter_supported: true,
  service_documentation: `${origin}/docs`,
});

// ---- checks -------------------------------------------------------------------------------------------------------------------------------------
// A redirect address a chatbot may register: https anywhere, or http only back to this computer (Claude Code and other desktop apps listen on
// localhost). No fragments, no passwords in the address, at most 500 characters.
export function checkRedirectUri(value) {
  if (typeof value !== "string" || !value || value.length > 500) return false;
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.hash || url.username || url.password) return false;
  if (url.protocol === "https:") return true;
  return url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
}

// PKCE (RFC 7636, S256): the verifier the chatbot kept, hashed, must equal the challenge it sent at the start.
export function pkceMatches(verifier, challenge) {
  if (typeof verifier !== "string" || !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return false;
  return createHash("sha256").update(verifier).digest("base64url") === challenge;
}

// The resource a chatbot asks for (RFC 8707) must be this server's MCP address, or left out.
export function resourceAllowed(value, origin) {
  if (value === undefined || value === null || value === "") return true;
  const wanted = String(value).replace(/\/+$/, "");
  return wanted === resourceUrl(origin) || wanted === origin;
}

// The body of a registration request (RFC 7591). Returns { value } or { error, description }.
export function checkRegistration(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "invalid_client_metadata", description: "Send a JSON object." };
  const uris = body.redirect_uris;
  if (!Array.isArray(uris) || uris.length < 1 || uris.length > 10) return { error: "invalid_redirect_uri", description: "Give 1 to 10 redirect_uris." };
  if (!uris.every(checkRedirectUri)) return { error: "invalid_redirect_uri", description: "Each redirect_uri must be https, or http on localhost." };
  const method = body.token_endpoint_auth_method ?? "none";
  if (!["none", "client_secret_post", "client_secret_basic"].includes(method)) return { error: "invalid_client_metadata", description: "Unsupported token_endpoint_auth_method." };
  const grants = body.grant_types ?? ["authorization_code", "refresh_token"];
  if (!Array.isArray(grants) || !grants.includes("authorization_code") || grants.some((one) => !["authorization_code", "refresh_token"].includes(one))) {
    return { error: "invalid_client_metadata", description: "grant_types may only be authorization_code and refresh_token." };
  }
  const responses = body.response_types ?? ["code"];
  if (!Array.isArray(responses) || responses.some((one) => one !== "code")) return { error: "invalid_client_metadata", description: "response_types may only be code." };
  return { value: { name: clean(body.client_name, 80) || "A chatbot", redirectUris: [...new Set(uris)], method } };
}

// ---- registration -------------------------------------------------------------------------------------------------------------------------------
export async function registerClient(admin, body, now = Date.now()) {
  const checked = checkRegistration(body);
  if (checked.error) return { status: 400, body: { error: checked.error, error_description: checked.description } };
  const { name, redirectUris, method } = checked.value;
  const clientId = random("hwc_", 16);
  const secret = method === "none" ? "" : random("hws_");
  const { error } = await admin.from("oauth_clients").insert({ client_id: clientId, client_name: name, redirect_uris: redirectUris, auth_method: method, secret_hash: secret ? hash(secret) : null });
  if (error) {
    console.error("saving an OAuth client failed:", error.code);
    return { status: 500, body: { error: "server_error", error_description: "Could not register. Try again." } };
  }
  return {
    status: 201,
    body: {
      client_id: clientId, client_id_issued_at: Math.floor(now / 1000), client_name: name, redirect_uris: redirectUris,
      grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], token_endpoint_auth_method: method, scope: SCOPE,
      ...(secret ? { client_secret: secret, client_secret_expires_at: 0 } : {}),
    },
  };
}

export async function findClient(admin, clientId) {
  if (!admin || typeof clientId !== "string" || !SHAPE.client.test(clientId)) return null;
  try {
    const { data, error } = await admin.from("oauth_clients").select("client_id, client_name, redirect_uris, auth_method, secret_hash").eq("client_id", clientId).limit(1);
    return error || !data?.[0] ? null : data[0];
  } catch {
    return null;
  }
}

// The query fields of an authorize request that are carried from the Allow page to its buttons.
export const AUTHORIZE_FIELDS = ["response_type", "client_id", "redirect_uri", "code_challenge", "code_challenge_method", "state", "scope", "resource"];

// ---- the authorize step -------------------------------------------------------------------------------------------------------------------------
// Checks the address the chatbot sent the person to. `params` is a plain object of the query. Returns one of:
//   { fatal }                       the client or redirect address is wrong: show the message, NEVER redirect (that would be an open redirect)
//   { redirectError, redirectUri }  the rest is wrong: send the person back to the chatbot with this OAuth error
//   { value }                       everything checks out
export async function checkAuthorize(admin, params, origin) {
  const client = await findClient(admin, params.client_id);
  if (!client) return { fatal: "This chatbot is not registered with Hushwork. Start connecting again from the chatbot." };
  const redirectUri = params.redirect_uri ?? (client.redirect_uris.length === 1 ? client.redirect_uris[0] : "");
  if (!client.redirect_uris.includes(redirectUri)) return { fatal: "This chatbot asked to return to an address it did not register. Start connecting again from the chatbot." };
  const back = (error, description) => ({ redirectError: { error, error_description: description, ...(params.state ? { state: params.state } : {}) }, redirectUri });
  if (params.response_type !== "code") return back("unsupported_response_type", "Only response_type=code is supported.");
  if (typeof params.code_challenge !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(params.code_challenge)) return back("invalid_request", "A PKCE code_challenge is required.");
  if (params.code_challenge_method !== "S256") return back("invalid_request", "code_challenge_method must be S256.");
  if (!resourceAllowed(params.resource, origin)) return back("invalid_target", "Unknown resource.");
  if (params.scope && !String(params.scope).split(" ").every((one) => one === SCOPE || one === "")) return back("invalid_scope", `The only scope is ${SCOPE}.`);
  if (typeof params.state === "string" && params.state.length > 500) return back("invalid_request", "state is too long.");
  return { value: { client, redirectUri, codeChallenge: params.code_challenge, state: typeof params.state === "string" ? params.state : "" } };
}

// The address the chatbot gets back, with `extra` (code or error, state, iss) added to its own query.
export function backToClient(redirectUri, extra) {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(extra)) if (value) url.searchParams.set(key, value);
  return url.toString();
}

// The person said yes: a one-time code for this person, client, redirect address and PKCE challenge, good for 10 minutes.
export async function issueCode(admin, { userId, clientId, redirectUri, codeChallenge }, now = Date.now()) {
  const code = random("hwk_");
  try {
    await admin.from("oauth_codes").delete().lt("expires_at", new Date(now).toISOString()); // tidy codes nobody swapped
  } catch {
    // best effort
  }
  const { error } = await admin.from("oauth_codes").insert({
    code_hash: hash(code), client_id: clientId, user_id: userId, redirect_uri: redirectUri, code_challenge: codeChallenge,
    expires_at: new Date(now + CODE_SECONDS * 1000).toISOString(),
  });
  if (error) {
    console.error("saving an OAuth code failed:", error.code);
    return null;
  }
  return code;
}

// ---- the token endpoint -------------------------------------------------------------------------------------------------------------------------
const fail = (error, description, status = 400) => ({ status, body: { error, error_description: description } });

// Who is calling the token endpoint: client_id (and secret) from the form, or from an "Authorization: Basic" header.
export function clientCredentials(form, authorization) {
  const basic = /^Basic\s+([A-Za-z0-9+/=]+)\s*$/i.exec(String(authorization ?? ""));
  if (basic) {
    const decode = (part = "") => {
      try {
        return decodeURIComponent(part.replace(/\+/g, " "));
      } catch {
        return "";
      }
    };
    const text = Buffer.from(basic[1], "base64").toString("utf8");
    const split = text.indexOf(":");
    return split < 0 ? { clientId: "", secret: "" } : { clientId: decode(text.slice(0, split)), secret: decode(text.slice(split + 1)) };
  }
  return { clientId: String(form.client_id ?? ""), secret: String(form.client_secret ?? "") };
}

async function authenticate(admin, credentials) {
  const client = await findClient(admin, credentials.clientId);
  if (!client) return null;
  if (client.auth_method === "none") return client;
  return SHAPE.secret.test(credentials.secret) && hash(credentials.secret) === client.secret_hash ? client : null;
}

function tokenAnswer(access, refresh) {
  return { status: 200, body: { access_token: access, token_type: "Bearer", expires_in: ACCESS_SECONDS, refresh_token: refresh, scope: SCOPE } };
}

// `form` is the decoded request body (an object of strings). Returns { status, body } for the route to send.
export async function exchangeToken(admin, form, credentials, origin, now = Date.now()) {
  const client = await authenticate(admin, credentials);
  if (!client) return fail("invalid_client", "Unknown client or wrong secret.", 401);
  if (!resourceAllowed(form.resource, origin)) return fail("invalid_target", "Unknown resource.");

  if (form.grant_type === "authorization_code") {
    if (!SHAPE.code.test(String(form.code ?? ""))) return fail("invalid_grant", "The code is not valid.");
    // Deleting it and reading it back in one step means a code works once, even if two requests race.
    const { data, error } = await admin.from("oauth_codes").delete().eq("code_hash", hash(form.code)).select("client_id, user_id, redirect_uri, code_challenge, expires_at");
    if (error) return fail("server_error", "Could not check the code. Try again.", 500);
    const row = data?.[0];
    if (!row || row.client_id !== client.client_id || Date.parse(row.expires_at) <= now) return fail("invalid_grant", "The code is not valid, was used already, or expired.");
    if ((form.redirect_uri ?? row.redirect_uri) !== row.redirect_uri) return fail("invalid_grant", "redirect_uri does not match.");
    if (!pkceMatches(form.code_verifier, row.code_challenge)) return fail("invalid_grant", "The PKCE code_verifier does not match.");

    const access = random("hwa_");
    const refresh = random("hwr_");
    const { error: saveError } = await admin.from("oauth_grants").insert({
      user_id: row.user_id, client_id: client.client_id, client_name: client.client_name,
      access_hash: hash(access), access_expires_at: new Date(now + ACCESS_SECONDS * 1000).toISOString(), refresh_hash: hash(refresh),
    });
    if (saveError) {
      console.error("saving an OAuth grant failed:", saveError.code);
      return fail("server_error", "Could not finish connecting. Try again.", 500);
    }
    await pruneGrants(admin, row.user_id);
    return tokenAnswer(access, refresh);
  }

  if (form.grant_type === "refresh_token") {
    if (!SHAPE.refresh.test(String(form.refresh_token ?? ""))) return fail("invalid_grant", "The refresh token is not valid.");
    const oldHash = hash(form.refresh_token);
    const access = random("hwa_");
    const refresh = random("hwr_");
    // Only swaps when the old refresh token is still the current one, so a copied refresh token cannot be used twice.
    const { data, error } = await admin.from("oauth_grants").update({
      access_hash: hash(access), access_expires_at: new Date(now + ACCESS_SECONDS * 1000).toISOString(), refresh_hash: hash(refresh),
    }).eq("refresh_hash", oldHash).eq("client_id", client.client_id).select("id");
    if (error) return fail("server_error", "Could not refresh. Try again.", 500);
    if (!data?.length) return fail("invalid_grant", "The refresh token is not valid or was removed on the Hushwork Settings page.");
    return tokenAnswer(access, refresh);
  }

  return fail("unsupported_grant_type", "Use authorization_code or refresh_token.");
}

// Keeps the newest MAX_GRANTS connections of one person (a chatbot that reconnects often should not pile up rows).
async function pruneGrants(admin, userId) {
  try {
    const { data } = await admin.from("oauth_grants").select("id, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(MAX_GRANTS + 10);
    const extra = (data ?? []).slice(MAX_GRANTS).map((row) => row.id);
    if (extra.length) await admin.from("oauth_grants").delete().in("id", extra);
  } catch {
    // best effort
  }
}

// ---- /api/mcp: whose access token is this? ------------------------------------------------------------------------------------------------------
// Returns { userId, grantId } for a current access token, or null (unknown, expired, removed, or the table is missing).
export async function findGrantOwner(admin, token, now = Date.now()) {
  if (!admin || !looksLikeAccessToken(token)) return null;
  try {
    const { data, error } = await admin.from("oauth_grants").select("id, user_id, access_expires_at, last_used_at").eq("access_hash", hash(token)).limit(1);
    const row = data?.[0];
    if (error || !row?.user_id || Date.parse(row.access_expires_at) <= now) return null;
    if (!row.last_used_at || Date.parse(row.last_used_at) < now - 60_000) {
      await admin.from("oauth_grants").update({ last_used_at: new Date(now).toISOString() }).eq("id", row.id);
    }
    return { userId: String(row.user_id), grantId: String(row.id) };
  } catch {
    return null;
  }
}
