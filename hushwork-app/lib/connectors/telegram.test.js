import test from "node:test";
import assert from "node:assert/strict";
import { sendTelegram, TELEGRAM_FAILED } from "./telegram.js";

const reply = (status) => async () => ({ ok: status >= 200 && status < 300, status });

test("a good answer is ok, and the request goes to Telegram with the chat id and text", async () => {
  let seen;
  const fetchImpl = async (url, init) => { seen = { url, init }; return { ok: true, status: 200 }; };
  assert.deepEqual(await sendTelegram({ token: "123:fake", chatId: "42", text: "hi", fetchImpl }), { ok: true });
  assert.equal(seen.url, "https://api.telegram.org/bot123:fake/sendMessage");
  assert.deepEqual(JSON.parse(seen.init.body), { chat_id: "42", text: "hi", disable_web_page_preview: true });
});

test("errors become fixed sentences that never contain the token", async () => {
  const token = "999:SECRET";
  const cases = [[401, TELEGRAM_FAILED.setup], [400, TELEGRAM_FAILED.setup], [429, TELEGRAM_FAILED.busy], [502, TELEGRAM_FAILED.busy]];
  for (const [status, expected] of cases) {
    const result = await sendTelegram({ token, chatId: "1", text: "x", fetchImpl: reply(status) });
    assert.deepEqual(result, { ok: false, error: expected });
  }
  const thrown = await sendTelegram({ token, chatId: "1", text: "x", fetchImpl: async () => { throw new Error(`failed https://api.telegram.org/bot${token}/sendMessage`); } });
  assert.deepEqual(thrown, { ok: false, error: TELEGRAM_FAILED.network });
  assert.ok(!JSON.stringify(thrown).includes("SECRET"));
});

test("very long text is cut before sending", async () => {
  let body;
  await sendTelegram({ token: "1:a", chatId: "1", text: "z".repeat(9000), fetchImpl: async (_u, init) => { body = JSON.parse(init.body); return { ok: true, status: 200 }; } });
  assert.ok(body.text.length <= 4000);
});
