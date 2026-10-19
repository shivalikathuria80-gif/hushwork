import "server-only";

// The ONLY place that reads the Telegram settings. Both values live in hushwork-app/.env.local (git ignores that file):
//   TELEGRAM_BOT_TOKEN  - SECRET. The password of your bot; whoever has it can post as the bot. From @BotFather.
//   TELEGRAM_CHAT_ID    - the number of YOUR chat with the bot. Not a secret, but it is private, so it stays here too.
// Same rules as the Groq key: never NEXT_PUBLIC_, never logged or returned to the page, and "server-only" above makes the
// build fail if browser code imports this file. Missing or blank values mean Telegram is not connected.
export function getTelegram() {
  const token = (process.env.TELEGRAM_BOT_TOKEN ?? "").trim();
  const chatId = (process.env.TELEGRAM_CHAT_ID ?? "").trim();
  return token && chatId ? { token, chatId } : null;
}
