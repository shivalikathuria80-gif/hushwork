// The one door to "which AI company writes the plan". The rest of the app calls writePlan(text, keys) and never learns
// whether Groq or someone else answered. To add a second company later: write a new file with a function that returns
// the same kind of result as writeWithGroq, add it to PROVIDERS, and give it its key in `keys`. No screen changes.
import { writeWithGroq, coolOffLeft } from "./groq.js";

const PROVIDERS = [writeWithGroq]; // later: [writeWithGroq, writeWithGemini]
const TROUBLE = ["busy", "timeout", "model_missing"]; // only these problems make us try the next company

export async function writePlan(text, keys, providers = PROVIDERS) { // `providers` can be swapped by tests only
  let last = { ok: false, why: "off" };
  for (const write of providers) {
    last = await write(text, keys);
    if (last.ok || !TROUBLE.includes(last.why)) return last;
  }
  return last;
}

// Seconds left in a "slow down" pause (0 when there is none). Asked before a person's allowance is used up.
export const coolOffSeconds = (nowMs) => coolOffLeft(nowMs);
