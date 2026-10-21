// Prints a fresh random secret as a ready-to-paste line for .env.local. It prints to the screen only. It does not read or change any file,
// and the value is made up on the spot: save the line you copy, because nobody (including this script) can recreate it.
//   npm run secret          prints CONNECTIONS_KEY=...  (locks each person's saved connection; if it is lost, people just press Connect again)
//   npm run secret cron     prints CRON_SECRET=...      (the password the clock sends to /api/cron/tick; see docs/deploy.md)
import { randomBytes } from "node:crypto";

const forClock = process.argv[2] === "cron";
console.log("");
console.log("Copy this whole line into hushwork-app/.env.local, then restart the app:");
console.log("");
console.log(forClock ? `CRON_SECRET=${randomBytes(32).toString("base64url")}` : `CONNECTIONS_KEY=${randomBytes(32).toString("base64")}`);
console.log("");
