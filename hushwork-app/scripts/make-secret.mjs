// Prints a fresh random secret as a ready-to-paste line for .env.local. Run it with: npm run secret
// It prints to the screen only. It does not read or change any file, and the value is made up on the spot: save the line
// you copy, because nobody (including this script) can recreate it. If it is lost, people just press Connect again.
import { randomBytes } from "node:crypto";

console.log("");
console.log("Copy this whole line into hushwork-app/.env.local, then restart the app:");
console.log("");
console.log(`CONNECTIONS_KEY=${randomBytes(32).toString("base64")}`);
console.log("");
