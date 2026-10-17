import { io } from "next/cache";
import Workspace from "./Workspace";
import { getGroqKey } from "@/lib/ai/key";
import { AI_LIMITS } from "@/lib/ai/plan";

// Tells the workspace whether AI planning is on. This runs on the server for every visit (the page itself is built
// ahead of time, so the check must happen here, or an old answer would be frozen in). `await io()` is Next.js's way to say
// "wait for a real request before running the next line".
// Only a yes/no and the daily limit leave this file. The key itself never does: it is not passed on or put in the page.
// Put this inside <Suspense> (the page does), like every component that waits for a request.
export default async function AiWorkspace({ children }) {
  await io();
  const ai = { enabled: Boolean(getGroqKey()), limit: AI_LIMITS.perUserDay };
  return <Workspace ai={ai}>{children}</Workspace>;
}
