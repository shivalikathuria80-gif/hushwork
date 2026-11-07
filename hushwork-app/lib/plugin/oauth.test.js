// OAuth sign-in for the plugin (lib/plugin/oauth.js), run end to end against a small in-memory database: register, authorize, swap the code,
// call with the access token, refresh. The point: a code works once and only with its PKCE verifier, a refresh token works once, a removed
// connection stops at once, and a wrong chatbot or return address never turns into a redirect.
import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  registerClient, checkAuthorize, issueCode, exchangeToken, findGrantOwner, checkRedirectUri, pkceMatches, clientCredentials,
  backToClient, resourceMetadata, serverMetadata, resourceAllowed, MAX_GRANTS,
} from "./oauth.js";
import { safeNext } from "../next-path.js";

const ORIGIN = "https://hushwork.in";

function fakeAdmin() {
  const tables = { oauth_clients: [], oauth_codes: [], oauth_grants: [] };
  let tick = 0;
  class Query {
    constructor(name) { this.name = name; this.filters = []; this.mode = "select"; this.max = Infinity; this.returning = false; this.sort = null; }
    select() { if (this.mode !== "select") this.returning = true; return this; }
    insert(values) { this.mode = "insert"; this.values = values; return this; }
    update(values) { this.mode = "update"; this.values = values; return this; }
    delete() { this.mode = "delete"; return this; }
    eq(column, value) { this.filters.push((row) => row[column] === value); return this; }
    lt(column, value) { this.filters.push((row) => String(row[column]) < String(value)); return this; }
    in(column, values) { this.filters.push((row) => values.includes(row[column])); return this; }
    order(column, { ascending = true } = {}) { this.sort = { column, ascending }; return this; }
    limit(count) { this.max = count; return this; }
    then(resolve) { resolve(this.run()); }
    run() {
      const table = tables[this.name];
      if (this.mode === "insert") {
        tick += 1;
        table.push({ id: randomUUID(), created_at: new Date(Date.UTC(2026, 10, 7, 0, 0, tick)).toISOString(), last_used_at: null, ...this.values });
        return { error: null };
      }
      let found = table.filter((row) => this.filters.every((check) => check(row)));
      if (this.mode === "delete") for (const row of found) table.splice(table.indexOf(row), 1);
      if (this.mode === "update") for (const row of found) Object.assign(row, this.values);
      if (this.sort) found = [...found].sort((a, b) => String(a[this.sort.column]).localeCompare(String(b[this.sort.column])) * (this.sort.ascending ? 1 : -1));
      if (this.mode !== "select" && !this.returning) return { error: null };
      return { data: found.slice(0, this.max).map((row) => ({ ...row })), error: null };
    }
  }
  return { tables, from: (name) => new Query(name) };
}

const pkce = () => {
  const verifier = randomBytes(32).toString("base64url");
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
};

async function connect(admin, { method = "none", now = Date.now() } = {}) {
  const registered = await registerClient(admin, { client_name: "Claude", redirect_uris: ["https://claude.ai/api/mcp/auth_callback"], token_endpoint_auth_method: method });
  assert.equal(registered.status, 201);
  const clientId = registered.body.client_id;
  const { verifier, challenge } = pkce();
  const checked = await checkAuthorize(admin, { response_type: "code", client_id: clientId, redirect_uri: "https://claude.ai/api/mcp/auth_callback", code_challenge: challenge, code_challenge_method: "S256", state: "s1", resource: `${ORIGIN}/api/mcp` }, ORIGIN);
  assert.ok(checked.value, JSON.stringify(checked));
  const user = randomUUID();
  const code = await issueCode(admin, { userId: user, clientId, redirectUri: checked.value.redirectUri, codeChallenge: challenge }, now);
  return { clientId, secret: registered.body.client_secret, verifier, code, user };
}

test("metadata: the resource points at this server, which offers code + PKCE S256, registration and refresh", () => {
  assert.deepEqual(resourceMetadata(ORIGIN).authorization_servers, [ORIGIN]);
  assert.equal(resourceMetadata(ORIGIN).resource, `${ORIGIN}/api/mcp`);
  const server = serverMetadata(ORIGIN);
  assert.equal(server.issuer, ORIGIN);
  assert.deepEqual(server.code_challenge_methods_supported, ["S256"]);
  assert.ok(server.registration_endpoint.endsWith("/api/oauth/register") && server.token_endpoint.endsWith("/api/oauth/token") && server.authorization_endpoint.endsWith("/oauth/authorize"));
  assert.ok(resourceAllowed(undefined, ORIGIN) && resourceAllowed(`${ORIGIN}/api/mcp/`, ORIGIN) && resourceAllowed(ORIGIN, ORIGIN) && !resourceAllowed("https://evil.example/api/mcp", ORIGIN));
});

test("registration: https or localhost return addresses only, and a secret only for a client that asks for one", async () => {
  for (const good of ["https://claude.ai/api/mcp/auth_callback", "http://localhost:33418/callback", "http://127.0.0.1:5000/cb"]) assert.ok(checkRedirectUri(good), good);
  for (const bad of ["http://evil.example/cb", "javascript:alert(1)", "https://a.example/cb#x", "https://user:pw@a.example/", "", "x".repeat(501)]) assert.ok(!checkRedirectUri(bad), bad);
  const admin = fakeAdmin();
  assert.equal((await registerClient(admin, { redirect_uris: ["http://evil.example/cb"] })).status, 400);
  assert.equal((await registerClient(admin, { redirect_uris: [] })).status, 400);
  assert.equal((await registerClient(admin, { redirect_uris: ["https://a.example/cb"], grant_types: ["client_credentials"] })).status, 400);
  const open = await registerClient(admin, { client_name: "  Claude\u0000 Code ", redirect_uris: ["http://localhost:4000/cb"] });
  assert.equal(open.body.client_name, "Claude Code");
  assert.equal(open.body.client_secret, undefined);
  const closed = await registerClient(admin, { redirect_uris: ["https://a.example/cb"], token_endpoint_auth_method: "client_secret_post" });
  assert.match(closed.body.client_secret, /^hws_/);
  assert.ok(admin.tables.oauth_clients.every((row) => !JSON.stringify(row).includes("hws_")), "only the secret's hash is saved");
});

test("authorize: a wrong client or return address is shown, never redirected; other mistakes go back to the chatbot", async () => {
  const admin = fakeAdmin();
  const { body } = await registerClient(admin, { redirect_uris: ["https://claude.ai/api/mcp/auth_callback"] });
  const { challenge } = pkce();
  const base = { response_type: "code", client_id: body.client_id, redirect_uri: "https://claude.ai/api/mcp/auth_callback", code_challenge: challenge, code_challenge_method: "S256", state: "abc" };
  assert.ok((await checkAuthorize(admin, { ...base, client_id: "hwc_AAAAAAAAAAAAAAAAAAAAAA" }, ORIGIN)).fatal);
  assert.ok((await checkAuthorize(admin, { ...base, redirect_uri: "https://evil.example/cb" }, ORIGIN)).fatal);
  const plain = await checkAuthorize(admin, { ...base, code_challenge_method: "plain" }, ORIGIN);
  assert.equal(plain.redirectError.error, "invalid_request");
  assert.equal(plain.redirectError.state, "abc");
  assert.equal((await checkAuthorize(admin, { ...base, code_challenge: undefined }, ORIGIN)).redirectError.error, "invalid_request");
  assert.equal((await checkAuthorize(admin, { ...base, resource: "https://evil.example/api/mcp" }, ORIGIN)).redirectError.error, "invalid_target");
  assert.ok((await checkAuthorize(admin, base, ORIGIN)).value);
  assert.equal(backToClient("https://claude.ai/cb?x=1", { code: "c", state: "", iss: ORIGIN }), "https://claude.ai/cb?x=1&code=c&iss=https%3A%2F%2Fhushwork.in");
});

test("tokens: the code works once, only with its verifier and client; the access token names the person; refresh swaps once; removing the connection ends it", async () => {
  const admin = fakeAdmin();
  const now = Date.parse("2026-11-07T10:00:00Z");
  const { clientId, code } = await connect(admin, { now });
  assert.ok(admin.tables.oauth_codes.every((row) => row.code_hash !== code), "only the code's hash is saved");

  const swap = (form) => exchangeToken(admin, { grant_type: "authorization_code", redirect_uri: "https://claude.ai/api/mcp/auth_callback", ...form }, { clientId: form.client_id ?? clientId, secret: "" }, ORIGIN, now + 1000);
  assert.equal((await swap({ code, code_verifier: pkce().verifier })).body.error, "invalid_grant", "a wrong verifier fails");
  // the failed try used the code up (it is deleted when read), like a real single-use code
  const again = await connect(admin, { now });
  assert.equal((await swap({ code: again.code, code_verifier: again.verifier, client_id: clientId })).body.error, "invalid_grant", "a code made for another client fails");
  const third = await connect(admin, { now });
  const ok = await swap({ code: third.code, code_verifier: third.verifier, client_id: third.clientId });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.match(ok.body.access_token, /^hwa_/);
  assert.match(ok.body.refresh_token, /^hwr_/);
  assert.equal(ok.body.token_type, "Bearer");
  assert.equal((await swap({ code: third.code, code_verifier: third.verifier, client_id: third.clientId })).body.error, "invalid_grant", "a code works once");
  assert.ok(!JSON.stringify(admin.tables.oauth_grants).includes(ok.body.access_token), "only hashes are saved");

  assert.deepEqual((await findGrantOwner(admin, ok.body.access_token, now + 2000)).userId, third.user);
  assert.equal(await findGrantOwner(admin, ok.body.access_token, now + 3601_000), null, "an access token lasts an hour");
  assert.equal(await findGrantOwner(admin, "hwa_" + "x".repeat(43), now), null);

  const refresh = (token) => exchangeToken(admin, { grant_type: "refresh_token", refresh_token: token }, { clientId: third.clientId, secret: "" }, ORIGIN, now + 4000_000);
  const renewed = await refresh(ok.body.refresh_token);
  assert.equal(renewed.status, 200);
  assert.equal(await findGrantOwner(admin, ok.body.access_token, now + 4001_000), null, "the old access token stops");
  assert.equal((await findGrantOwner(admin, renewed.body.access_token, now + 4001_000)).userId, third.user);
  assert.equal((await refresh(ok.body.refresh_token)).body.error, "invalid_grant", "a refresh token works once");

  admin.tables.oauth_grants.length = 0; // Disconnect on Settings
  assert.equal(await findGrantOwner(admin, renewed.body.access_token, now + 4002_000), null);
  assert.equal((await refresh(renewed.body.refresh_token)).body.error, "invalid_grant");

  const expired = await connect(admin, { now });
  const late = await exchangeToken(admin, { grant_type: "authorization_code", code: expired.code, code_verifier: expired.verifier }, { clientId: expired.clientId, secret: "" }, ORIGIN, now + 601_000);
  assert.equal(late.body.error, "invalid_grant", "a code lasts 10 minutes");
  assert.equal((await exchangeToken(admin, { grant_type: "password" }, { clientId: expired.clientId, secret: "" }, ORIGIN, now)).body.error, "unsupported_grant_type");
});

test("tokens: a client with a secret must send it; connections per person are capped", async () => {
  const admin = fakeAdmin();
  const now = Date.now();
  const { clientId, secret, verifier, code } = await connect(admin, { method: "client_secret_basic", now });
  const wrong = await exchangeToken(admin, { grant_type: "authorization_code", code, code_verifier: verifier }, { clientId, secret: "hws_" + "x".repeat(43) }, ORIGIN, now);
  assert.equal(wrong.status, 401);
  const basic = `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`;
  assert.deepEqual(clientCredentials({}, basic), { clientId, secret });
  assert.equal((await exchangeToken(admin, { grant_type: "authorization_code", code, code_verifier: verifier }, clientCredentials({}, basic), ORIGIN, now)).status, 200);

  const many = fakeAdmin();
  const { body } = await registerClient(many, { redirect_uris: ["https://claude.ai/cb"] });
  const user = randomUUID();
  for (let i = 0; i < MAX_GRANTS + 3; i += 1) {
    const { verifier: v, challenge } = pkce();
    const made = await issueCode(many, { userId: user, clientId: body.client_id, redirectUri: "https://claude.ai/cb", codeChallenge: challenge }, now);
    assert.equal((await exchangeToken(many, { grant_type: "authorization_code", code: made, code_verifier: v }, { clientId: body.client_id, secret: "" }, ORIGIN, now)).status, 200);
  }
  assert.equal(many.tables.oauth_grants.filter((row) => row.user_id === user).length, MAX_GRANTS);
});

test("PKCE and the sign-in return path", () => {
  const { verifier, challenge } = pkce();
  assert.ok(pkceMatches(verifier, challenge));
  assert.ok(!pkceMatches(`${verifier}x`, challenge) && !pkceMatches("short", challenge) && !pkceMatches(undefined, challenge));
  assert.equal(safeNext("/oauth/authorize?client_id=x"), "/oauth/authorize?client_id=x");
  for (const bad of ["/app", "//evil.example/oauth/authorize?", "https://evil.example", "/oauth/authorize?\\\\evil", "/oauth/authorizeX?", null]) assert.equal(safeNext(bad), "", String(bad));
});
