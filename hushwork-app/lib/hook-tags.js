// START LINKS: the small pieces the browser needs too (the rest of the rules, lib/hooks.js, use the server's crypto). Plain data and
// plain functions with no imports.

// The tag an Ask the AI job uses for what arrived at the workflow's start link.
export const INCOMING_TAG = "{incoming}";

// The full address of a link. `site` is the site's own address (NEXT_PUBLIC_SITE_URL); without one the path alone is returned.
export const hookUrl = (site, code) => `${String(site ?? "").replace(/\/+$/, "")}/api/hooks/${code}`;

// The pretend arrival behind "Send a test": clearly made up, so nobody mistakes it for a real lead.
export const TEST_FLAG = "hushwork_test"; // in the body of a test: the arrival is labelled a test and no email is sent about it
export const TEST_ARRIVAL = { [TEST_FLAG]: true, name: "Sample Person (test)", email: "sample@example.com", message: "This is a test arrival from the Start links page. I would like to know your prices for a small website." };

// How many arrivals per day over the last `days` days, oldest first, for the small bar strip. `times` are ISO dates; `tzOffset` is minutes EAST of UTC (India is +330), like every schedule.
export function dailyCounts(times, now = Date.now(), days = 14, tzOffset = 0) {
  const DAY = 86_400_000;
  const shift = (Number.isFinite(tzOffset) ? tzOffset : 0) * 60_000;
  const today = Math.floor((now + shift) / DAY);
  const counts = Array.from({ length: days }, () => 0);
  for (const time of Array.isArray(times) ? times : []) {
    const at = Date.parse(time);
    if (!Number.isFinite(at)) continue;
    const back = today - Math.floor((at + shift) / DAY);
    if (back >= 0 && back < days) counts[days - 1 - back] += 1;
  }
  return counts;
}

// Paste-ready examples for the Start links page. `url` is the link's full address.
export function snippets(url) {
  return {
    form: `<form action="${url}" method="post">\n  <input name="name" placeholder="Your name" required>\n  <input name="email" type="email" placeholder="Your email" required>\n  <textarea name="message" placeholder="How can I help?"></textarea>\n  <button>Send</button>\n</form>`,
    curl: `curl -X POST "${url}" \\\n  -H "content-type: application/json" \\\n  -d '{"name":"Ana","email":"ana@example.com","message":"Hello"}'`,
    js: `await fetch("${url}", {\n  method: "POST",\n  headers: { "content-type": "application/json" },\n  body: JSON.stringify({ name, email, message }),\n});`,
  };
}
