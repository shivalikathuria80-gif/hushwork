// The template library is split into PACKS, so you can start from the kind of work you do: Everyday, Finance, Marketing, Coding, Design.
// A template says which pack it belongs to with `pack` (no `pack` means Everyday). A template may also carry a suggested `schedule`
// ({ frequency, weekday, hour, minute }): it is only a suggestion, shown on the Templates page. You set the real schedule on the Workflows page.
// Plain data and two tiny functions, so tests and both sides of the app can load it.
import { describeSchedule, checkSchedule } from "./schedule.js";

export const PACKS = [
  { id: "everyday", label: "Everyday", icon: "Zap", blurb: "Inbox, calendar, files and tasks." },
  { id: "finance", label: "Finance", icon: "CreditCard", blurb: "Payments, invoices and receipts." },
  { id: "marketing", label: "Marketing", icon: "PenLine", blurb: "Ideas, pages and writing time." },
  { id: "coding", label: "Coding", icon: "Workflow", blurb: "GitHub, tasks and incidents." },
  { id: "design", label: "Design", icon: "Sparkles", blurb: "Reviews, feedback and focus time." },
];

export const PACK_IDS = PACKS.map((pack) => pack.id);

export const packOf = (template) => (PACK_IDS.includes(template?.pack) ? template.pack : "everyday");

// "Every week on Monday at 09:00" for a template that suggests a schedule, or "" when it does not (or the suggestion is not a valid schedule).
// The times are in the person's own local time: the Schedule panel on the Workflows page uses their clock.
export function suggestedSchedule(template) {
  const schedule = template?.schedule;
  if (!schedule) return "";
  const checked = checkSchedule({ ...schedule, tzOffset: 0 });
  return checked.value ? describeSchedule(checked.value) : "";
}
