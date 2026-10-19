// Sends one text message through the Telegram Bot API (https://core.telegram.org/bots/api#sendmessage).
// An API is a way for two programs to talk: here Hushwork's server sends a web request to Telegram's server, and Telegram
// puts the text in your chat. This file has no secrets of its own: the token and chat id are handed in (from
// telegram-env.js), and `fetchImpl` can be replaced so tests never call the real Telegram.
// The token is part of the web address Telegram requires, so nothing here ever returns or logs that address or an
// error that could contain it: failures come back as short fixed sentences.

const TIMEOUT_MS = 10_000;
const MAX_LENGTH = 4000; // Telegram refuses more than 4096 characters

export const TELEGRAM_FAILED = {
  setup: "Telegram refused the message. Check the bot token and chat id in .env.local, and that you have sent your bot a message first.",
  busy: "Telegram is busy right now. Try again in a minute.",
  network: "Could not reach Telegram. Check your connection and try again.",
};

// Returns { ok: true } or { ok: false, error }.
export async function sendTelegram({ token, chatId, text, fetchImpl = fetch }) {
  const body = JSON.stringify({ chat_id: chatId, text: String(text).slice(0, MAX_LENGTH), disable_web_page_preview: true });
  try {
    const response = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.ok) return { ok: true };
    return { ok: false, error: response.status === 429 || response.status >= 500 ? TELEGRAM_FAILED.busy : TELEGRAM_FAILED.setup };
  } catch {
    return { ok: false, error: TELEGRAM_FAILED.network };
  }
}
