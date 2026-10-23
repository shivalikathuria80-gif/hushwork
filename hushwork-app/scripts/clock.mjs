// A clock for your own computer. While the app is running (npm run dev), this asks it "is anything due?" once a minute, so saved
// schedules can run without any hosting. Start it in a SECOND terminal:  npm run clock
// It reads CRON_SECRET from .env.local (npm run clock loads that file for it) and never prints it.
//   npm run clock -- --once    asks one time and stops (handy to test)
const address = "http://localhost:3100/api/cron/tick";
const secret = process.env.CRON_SECRET;
const once = process.argv.includes("--once");

if (!secret) {
  console.log("CRON_SECRET is not set. Run `npm run secret cron`, copy the line into hushwork-app/.env.local, and try again.");
  process.exit(1);
}

const MEANING = {
  200: "ok",
  401: "the app refused the password: CRON_SECRET in .env.local changed, so restart the app (npm run dev) and this clock",
  503: "the app has no CRON_SECRET yet: restart the app (npm run dev) after adding it",
};

async function tick() {
  const time = new Date().toLocaleTimeString();
  try {
    const response = await fetch(address, { method: "POST", headers: { Authorization: `Bearer ${secret}` } });
    const text = await response.text();
    console.log(`${time}  ${response.status} ${MEANING[response.status] ?? "unexpected answer"}${response.status === 200 ? ` ${text.slice(0, 200)}` : ""}`);
  } catch {
    console.log(`${time}  could not reach ${address}. Is the app running (npm run dev)?`);
  }
}

await tick();
if (!once) setInterval(tick, 60_000);
