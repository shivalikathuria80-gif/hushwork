// The "keyword preview": the plan shown when the AI is off, slow or out of turns. It matches words in the task and returns steps that REALLY do
// something (an Ask the AI step that looks in the right place), never steps that only describe. Plain code with no Next.js, so tests can load it.
// The order matters: the first pattern that matches wins, so the narrow ones (lead, admin) come first and the broad "client" one (report) late.
// Returns steps for the editor ([icon, title, detail, kind, fields] lists, see lib/steps.js). A "send to me" in the words adds a real email
// (inside finishSteps), exactly as for an AI plan.
import { finishSteps } from "./plan.js";
import { stepsToPlan } from "../steps.js";

const LOOKS = [
  [/lead|enquir|prospect/, "gmail", "Which new enquiries need a reply? Say who and why. Up to 4 short lines."],
  [/calendar|meeting|my week|agenda/, "calendar", "Sum up my next 7 days in 5 short lines. Point out the busiest day."],
  [/receipt|contract|admin|expense/, "drive", "From my 10 latest file names, which look like receipts or contracts? 4 short lines."],
  [/invoice|pay|overdue|stripe/, "stripe", "List payments that failed or look overdue: client, amount, how late. Up to 5 short lines."],
  [/inbox|newsletter|gmail|email/, "gmail", "Which emails need me and which can wait? Use sender and subject. 4 short lines."],
  [/report|friday|summar|client|task|linear/, "linear", "Write a short client-ready report from my tasks: what is in progress and what is next."],
];

export function keywordPlan(task) {
  const words = String(task ?? "");
  const found = LOOKS.find(([pattern]) => pattern.test(words.toLowerCase()));
  const [choice, job] = found ? [found[1], found[2]] : ["nothing", `Do this: ${words.replace(/\s+/g, " ").trim()}`.slice(0, 110)];
  const steps = [
    { icon: "Zap", title: "x", detail: "x", block: "trigger", choice: "manual", a: "", b: "" },
    { icon: "Sparkles", title: "Ask the AI", detail: "x", block: "ai", choice, a: job, b: "" },
  ];
  const finished = finishSteps({ steps }, undefined, words); // the same safety nets as an AI plan: a real email for "send it to me", an approval step before it
  return finished ? stepsToPlan(finished) : stepsToPlan(finishSteps({ steps: [steps[0], { ...steps[1], choice: "nothing" }] }) ?? []);
}
