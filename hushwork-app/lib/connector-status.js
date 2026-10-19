import { io } from "next/cache";
import { getLinearKey } from "./connectors/linear-env.js";

// Which connections are set up? Pages learn only yes or no, never the key itself (same idea as ai-status.js).
// It must run on every visit, so it waits for a real request first; call it from a component inside <Suspense>.
export async function connectorStatus() {
  await io();
  return { linear: Boolean(getLinearKey()) };
}
