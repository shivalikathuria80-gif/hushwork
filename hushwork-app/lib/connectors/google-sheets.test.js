import test from "node:test";
import assert from "node:assert/strict";
import { appendRow, parseCells, parseSheetUrl, SHEETS_FAILED, MAX_CELLS } from "./google-sheets.js";

const ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-aB";
const reply = (status) => async () => ({ ok: status >= 200 && status < 300, status });

test("only a normal Google Sheets address is accepted, and the id is all that is taken from it", () => {
  for (const good of [`https://docs.google.com/spreadsheets/d/${ID}/edit`, `https://docs.google.com/spreadsheets/d/${ID}/edit?gid=0#gid=0`, `  https://docs.google.com/spreadsheets/d/${ID}  `, `https://docs.google.com/spreadsheets/d/${ID}?usp=sharing`]) {
    assert.deepEqual(parseSheetUrl(good), { id: ID }, good);
  }
  for (const bad of ["", "Invoice tracker", null, 5, `http://docs.google.com/spreadsheets/d/${ID}/edit`, `https://evil.com/spreadsheets/d/${ID}`, `https://docs.google.com.evil.com/spreadsheets/d/${ID}`,
    `https://docs.google.com/document/d/${ID}/edit`, "https://docs.google.com/spreadsheets/d/short/edit", `https://docs.google.com/spreadsheets/d/${ID}/../../x`.replace("/../../x", " x"), `https://docs.google.com/spreadsheets/d/${ID}%2F..%2Fx`, `https://docs.google.com/spreadsheets/d/${"a".repeat(200)}/edit`]) {
    assert.equal(typeof parseSheetUrl(bad).error, "string", String(bad));
  }
});

test("cells: commas separate the boxes, spaces are tidied, empty or too big rows are refused", () => {
  assert.deepEqual(parseCells("Ana, 500 ,  20   Oct"), { cells: ["Ana", "500", "20 Oct"] });
  assert.deepEqual(parseCells("a,,c,"), { cells: ["a", "", "c"] });
  assert.deepEqual(parseCells("=SUM(A1)"), { cells: ["=SUM(A1)"] }, "kept as plain text; RAW stops it being a formula");
  for (const bad of ["", "   ", ",,,", null, 5, Array(MAX_CELLS + 1).fill("x").join(","), "x".repeat(101)]) assert.equal(typeof parseCells(bad).error, "string", String(bad));
});

test("appending sends one POST to Google's append address with plain text cells, and nothing else", async () => {
  let seen;
  const fetchImpl = async (url, init) => { seen = { url: new URL(url), init }; return { ok: true, status: 200 }; };
  assert.deepEqual(await appendRow({ authorization: "Bearer tok", spreadsheetId: ID, cells: ["Ana", "500"], fetchImpl }), { ok: true });
  assert.equal(seen.url.origin + seen.url.pathname, `https://sheets.googleapis.com/v4/spreadsheets/${ID}/values/A1:append`);
  assert.equal(seen.url.searchParams.get("valueInputOption"), "RAW", "never USER_ENTERED (that would run formulas)");
  assert.equal(seen.url.searchParams.get("insertDataOption"), "INSERT_ROWS");
  assert.equal(seen.init.method, "POST");
  assert.equal(seen.init.headers.authorization, "Bearer tok");
  assert.deepEqual(JSON.parse(seen.init.body), { majorDimension: "ROWS", values: [["Ana", "500"]] });
});

test("a bad id or empty cells never reach the network, and errors become fixed sentences without the token", async () => {
  const never = async () => assert.fail("called Google");
  assert.deepEqual(await appendRow({ authorization: "Bearer x", spreadsheetId: "../../other", cells: ["a"], fetchImpl: never }), { ok: false, error: SHEETS_FAILED.missing });
  assert.deepEqual(await appendRow({ authorization: "Bearer x", spreadsheetId: ID, cells: [], fetchImpl: never }), { ok: false, error: SHEETS_FAILED.missing });
  const token = "Bearer ya29.SECRET";
  for (const [status, error] of [[401, SHEETS_FAILED.auth], [403, SHEETS_FAILED.auth], [404, SHEETS_FAILED.missing], [400, SHEETS_FAILED.missing], [429, SHEETS_FAILED.busy], [503, SHEETS_FAILED.busy], [418, SHEETS_FAILED.network]]) {
    assert.deepEqual(await appendRow({ authorization: token, spreadsheetId: ID, cells: ["a"], fetchImpl: reply(status) }), { ok: false, error }, String(status));
  }
  const thrown = await appendRow({ authorization: token, spreadsheetId: ID, cells: ["a"], fetchImpl: async () => { throw new Error(`boom ${token}`); } });
  assert.deepEqual(thrown, { ok: false, error: SHEETS_FAILED.network });
  assert.ok(!JSON.stringify(thrown).includes("SECRET"));
});
