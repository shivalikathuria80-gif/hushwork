// Makes the two keys push notifications need (lib/web-push.js). Run once: npm run vapid
// Put both lines in .env.local AND in the hosting settings (Vercel > Settings > Environment Variables), then deploy again.
// Keep VAPID_PRIVATE_KEY secret. Making new keys later means every browser has to switch push on again.
import { makeVapidKeys } from "../lib/web-push.js";

const { publicKey, privateKey } = makeVapidKeys();
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log("VAPID_SUBJECT=mailto:you@example.com   (an address push services can reach you at)");
