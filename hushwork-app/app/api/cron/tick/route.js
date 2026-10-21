import { handleTick } from "@/lib/schedule-tick";

// The clock calls this about every minute (see docs/deploy.md). GET is what Vercel Cron sends; POST is for any other clock.
// Both need the CRON_SECRET password, checked in lib/schedule-tick.js before anything else happens.
export const GET = (request) => handleTick(request);
export const POST = (request) => handleTick(request);
