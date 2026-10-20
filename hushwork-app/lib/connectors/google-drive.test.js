import test from "node:test";
import assert from "node:assert/strict";
import { fetchRecentFiles, kindOf, DRIVE_FAILED } from "./google-drive.js";

const json = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

test("kinds of file are named in plain words", () => {
  assert.equal(kindOf("application/vnd.google-apps.document"), "Doc");
  assert.equal(kindOf("application/vnd.google-apps.spreadsheet"), "Sheet");
  assert.equal(kindOf("application/vnd.google-apps.folder"), "Folder");
  assert.equal(kindOf("application/pdf"), "PDF");
  assert.equal(kindOf("image/png"), "Image");
  assert.equal(kindOf("application/zip"), "File");
  assert.equal(kindOf(undefined), "File");
});

test("recent files: one GET asking only for name, kind and time, newest first, cut to short plain text", async () => {
  let seen;
  const fetchImpl = async (url, init) => {
    seen = { url: new URL(url), init };
    return json({ files: [
      { name: "  Budget   2026 ", mimeType: "application/vnd.google-apps.spreadsheet", modifiedTime: "2026-10-20T03:45:12.000Z" },
      { name: "x".repeat(300), mimeType: "application/pdf", modifiedTime: "garbage" },
      { mimeType: "image/jpeg" },
      null,
    ] });
  };
  const result = await fetchRecentFiles({ authorization: "Bearer tok", fetchImpl });
  assert.deepEqual(result.files[0], { time: "2026-10-20 03:45", kind: "Sheet", name: "Budget 2026" });
  assert.deepEqual(result.files[1], { time: "", kind: "PDF", name: "x".repeat(100) });
  assert.deepEqual(result.files[2], { time: "", kind: "Image", name: "(no name)" });
  assert.deepEqual(result.files[3], { time: "", kind: "File", name: "(no name)" });
  assert.equal(seen.init.method, "GET");
  assert.equal(seen.init.headers.authorization, "Bearer tok");
  assert.equal(seen.url.pathname, "/drive/v3/files");
  assert.equal(seen.url.searchParams.get("pageSize"), "10");
  assert.equal(seen.url.searchParams.get("orderBy"), "modifiedTime desc");
  assert.equal(seen.url.searchParams.get("q"), "trashed = false");
  assert.equal(seen.url.searchParams.get("fields"), "files(name,mimeType,modifiedTime)", "no contents, links or owners are asked for");
});

test("errors become fixed sentences that never contain the token", async () => {
  const token = "Bearer ya29.SECRET";
  const reply = (status, body = {}) => async () => json(body, status);
  assert.deepEqual(await fetchRecentFiles({ authorization: token, fetchImpl: reply(401) }), { ok: false, error: DRIVE_FAILED.auth });
  assert.deepEqual(await fetchRecentFiles({ authorization: token, fetchImpl: reply(403) }), { ok: false, error: DRIVE_FAILED.auth });
  assert.deepEqual(await fetchRecentFiles({ authorization: token, fetchImpl: reply(429) }), { ok: false, error: DRIVE_FAILED.busy });
  assert.deepEqual(await fetchRecentFiles({ authorization: token, fetchImpl: reply(404) }), { ok: false, error: DRIVE_FAILED.network });
  assert.deepEqual(await fetchRecentFiles({ authorization: token, fetchImpl: reply(200, {}) }), { ok: false, error: DRIVE_FAILED.network });
  assert.deepEqual(await fetchRecentFiles({ authorization: token, fetchImpl: reply(200, { files: [] }) }), { ok: true, files: [] });
  const thrown = await fetchRecentFiles({ authorization: token, fetchImpl: async () => { throw new Error(`boom ${token}`); } });
  assert.deepEqual(thrown, { ok: false, error: DRIVE_FAILED.network });
  assert.ok(!JSON.stringify(thrown).includes("SECRET"));
});

test("a refusal says WHY when Google's answer holds a known reason: the API is switched off, or the permission was not given", async () => {
  const refuse = (body) => async () => ({ ok: false, status: 403, json: async () => body });
  assert.deepEqual(await fetchRecentFiles({ authorization: "Bearer t", fetchImpl: refuse({ error: { errors: [{ reason: "accessNotConfigured" }] } }) }), { ok: false, error: DRIVE_FAILED.apiOff });
  assert.deepEqual(await fetchRecentFiles({ authorization: "Bearer t", fetchImpl: refuse({ error: { details: [{ reason: "ACCESS_TOKEN_SCOPE_INSUFFICIENT" }] } }) }), { ok: false, error: DRIVE_FAILED.scope });
  assert.deepEqual(await fetchRecentFiles({ authorization: "Bearer t", fetchImpl: refuse({}) }), { ok: false, error: DRIVE_FAILED.auth });
});
