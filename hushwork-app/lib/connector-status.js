import { io } from "next/cache";
import { getTelegram } from "./connectors/telegram-env.js";

// Which connections are set up? Pages learn only yes or no, never the token or the chat id (same idea as ai-status.js).
// It must run on every visit, so it waits for a real request first; call it from a component inside <Suspense>.
export async function connectorStatus() {
  await io();
  return { telegram: Boolean(getTelegram()) };
}
