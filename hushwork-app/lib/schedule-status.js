import "server-only";
import { getCronSecret, getServiceRoleKey } from "./schedule-env.js";

// What pages may know about scheduled runs: a yes or no, never a value (same idea as lib/ai-status.js).
// clockReady: both the clock's password and the database key are in the settings, so a clock calling /api/cron/tick would be accepted.
export const clockReady = () => Boolean(getCronSecret() && getServiceRoleKey());
