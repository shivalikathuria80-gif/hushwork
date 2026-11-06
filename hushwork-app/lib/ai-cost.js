// How many of a person's AI steps a plan uses. Everyone has AI_STEPS_PER_DAY a day (the "ai_step" count, takeDbSlot(supabase, "ai_step", 3, 15)),
// shared by the Ask the AI steps of every run, watch checks and the Hushwork Agent's looks. Plain code (no database, no clock), so tests can run it.
//
// One run of a plan takes a slot for:
//   - each Ask the AI step (approveAiStep in lib/run-core.js), and
//   - each lookup that adds an AI summary to what it read (withSummary in lib/run-core.js: Linear, Google Calendar, Gmail, Google Drive and
//     "Look in another app"). A summary is skipped (no slot) when the app answered with nothing or the day's steps are used up, so those
//     count as "up to".
import { isAiStep, isLinearLookup, isCalendarLookup, isGmailLookup, isDriveLookup, isAppLookup } from "./run-engine.js";

export const AI_STEPS_PER_DAY = 15;

const summarizes = (step) => isLinearLookup(step) || isCalendarLookup(step) || isGmailLookup(step) || isDriveLookup(step) || isAppLookup(step);

// A step as the page holds it: an object { kind, fields } or a tuple [icon, title, detail, kind, fields] (see stepsToPlan in lib/steps.js).
const asStep = (step) => (Array.isArray(step) ? { kind: step[3], fields: step[4] } : step);

// The most AI steps ONE run of this plan can use. Only the first 20 steps ever run (runAutomatically in lib/run-core.js).
export function aiStepsPerRun(plan) {
  if (!Array.isArray(plan)) return 0;
  return plan.slice(0, 20).map(asStep).filter((step) => isAiStep(step) || summarizes(step)).length;
}

const plural = (n) => (n === 1 ? "1 AI step" : `${n} AI steps`);

// The line on a card: "Uses up to 2 of your 15 AI steps each run." Empty when the plan uses none.
export function perRunLine(perRun) {
  if (!Number.isInteger(perRun) || perRun <= 0) return "";
  return `Uses up to ${perRun} of your ${AI_STEPS_PER_DAY} AI steps each run.`;
}

// How many a schedule uses, in words: "About 2 AI steps a day." Empty when the plan uses none or the frequency is unknown.
// Every hour = 24 runs a day, every day = 1, every weekday = 1 on Monday to Friday (none at weekends), every week = 1 a week.
export function scheduleLine(perRun, frequency) {
  if (!Number.isInteger(perRun) || perRun <= 0) return "";
  if (frequency === "daily") return `About ${plural(perRun)} a day.`;
  if (frequency === "weekdays") return `About ${plural(perRun)} a day on weekdays.`;
  if (frequency === "weekly") return `About ${plural(perRun)} a week.`;
  if (frequency === "hourly") {
    const perDay = perRun * 24;
    return `About ${plural(perDay)} a day. That is more than your ${AI_STEPS_PER_DAY}, so later runs that day cannot use the AI.`;
  }
  return "";
}
