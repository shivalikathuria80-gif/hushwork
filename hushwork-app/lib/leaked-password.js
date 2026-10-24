import { createHash } from "node:crypto";

// Is this password in a known data leak? Checked when someone CREATES an account (a free stand-in for Supabase's paid "leaked password
// protection"). It uses the free Pwned Passwords range service (api.pwnedpasswords.com) in its privacy-keeping way: the password is turned into a
// SHA-1 fingerprint on our server, ONLY the first 5 characters of that fingerprint are sent, the service answers with every leaked fingerprint that
// starts the same way, and we look for ours in that list ourselves. The password and the full fingerprint never leave the server. "Add-Padding"
// asks the service to add fake entries so the size of the answer reveals nothing.
// If the service is slow, down or says something odd, the answer is "not leaked": a broken checker must never stop someone signing up.
export async function isLeakedPassword(password, { fetchImpl = fetch, timeoutMs = 2500 } = {}) {
  if (typeof password !== "string" || !password) return false;
  const fingerprint = createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = fingerprint.slice(0, 5);
  const suffix = fingerprint.slice(5);
  let timer;
  try {
    // A hard race against a timer, so a service that hangs (and ignores the cancel signal) can never hold a sign-up up.
    const response = await Promise.race([
      fetchImpl(`https://api.pwnedpasswords.com/range/${prefix}`, { headers: { "Add-Padding": "true" }, signal: AbortSignal.timeout(timeoutMs), cache: "no-store" }),
      new Promise((resolve) => { timer = setTimeout(() => resolve(null), timeoutMs); }),
    ]);
    if (!response?.ok) return false;
    const text = await response.text();
    for (const line of text.split("\n")) {
      const [found, count] = line.trim().split(":");
      if (found === suffix && Number(count) > 0) return true; // padded fake entries have a count of 0
    }
    return false;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
