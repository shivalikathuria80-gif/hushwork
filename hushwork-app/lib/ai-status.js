import { io } from "next/cache";
import { getGroqKey } from "./ai/key.js";
import { AI_LIMITS } from "./ai/plan.js";

// Is AI planning on, and how many AI plans does a person get a day? This is the ONLY thing pages and components learn
// about the key: a yes/no and the daily limit. The key itself never leaves lib/ai/key.js.
// It must run on the server for every visit (the page shell is built ahead of time, so an old answer would be frozen in
// otherwise). `await io()` is Next.js's way to say "wait for a real request before running the next line". Call it from
// a component that sits inside <Suspense>, like every component that waits for a request.
export async function aiStatus() {
  await io();
  return { enabled: Boolean(getGroqKey()), limit: AI_LIMITS.perUserDay };
}
