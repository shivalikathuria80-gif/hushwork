// Starter workflows for the Builder, written as TYPED steps (see lib/steps.js). A template is only a starting point: it
// opens in the Builder, where every step can be changed, and nothing in it runs or connects to anything.
// `request` is the sentence the template stands for; it is saved with the draft, like the text typed in the workspace box.
// Pure data and one small function, no imports from React or Next.js, so tests and both sides of the app can load it.
import { checkSteps } from "./validate.js";

const step = (kind, fields) => ({ kind, fields });

export const TEMPLATES = [
  {
    id: "invoices", icon: "Receipt", title: "Chase unpaid invoices",
    body: "Spot invoices more than 7 days late and draft a polite reminder for each client.",
    request: "Every weekday at 9am, find invoices more than 7 days overdue and draft a polite reminder for each client. Ask me before anything is sent.",
    steps: [
      step("trigger", { how: "schedule", when: "Every weekday at 9am" }),
      step("find", { where: "payments", what: "invoices more than 7 days overdue" }),
      step("write", { what: "email", about: "a polite reminder for each client" }),
      step("approve", { what: "the reminders before they are sent" }),
      step("send", { how: "email", to: "each overdue client", about: "payment reminder" }),
    ],
  },
  {
    id: "report", icon: "FileBarChart", title: "Send a weekly client report",
    body: "Gather what you finished this week and write a short summary for each client to check.",
    request: "Every Friday at 4pm, summarise what I finished this week for each client and draft an email with the summary. Ask me before anything is sent.",
    steps: [
      step("trigger", { how: "schedule", when: "Every Friday at 4pm" }),
      step("find", { where: "other", what: "what I finished this week, by client" }),
      step("write", { what: "report", about: "a short summary for each client" }),
      step("approve", { what: "each summary before it goes out" }),
      step("send", { how: "email", to: "each client", about: "weekly summary" }),
    ],
  },
  {
    id: "inbox", icon: "Inbox", title: "Sort your inbox",
    body: "Look through newsletters and client mail, then get one short digest.",
    request: "Every morning at 8am, file newsletters into Reading, star emails from clients and send me one short digest.",
    steps: [
      step("trigger", { how: "schedule", when: "Every morning at 8am" }),
      step("find", { where: "inbox", what: "newsletters and mail from clients" }),
      step("write", { what: "summary", about: "one short digest of what needs me" }),
      step("send", { how: "email", to: "me", about: "morning digest" }),
    ],
  },
  {
    id: "leads", icon: "UserPlus", title: "Follow up new leads",
    body: "Reply to each new enquiry and note when to chase it.",
    request: "When a new lead fills in my contact form, thank them within an hour and remind me to follow up after 3 days.",
    steps: [
      step("trigger", { how: "lead", when: "Within an hour" }),
      step("write", { what: "reply", about: "a friendly thank-you" }),
      step("approve", { what: "the reply before it is sent" }),
      step("send", { how: "email", to: "the new lead", about: "thank you" }),
      step("row", { to: "Lead tracker", values: "name, email, follow-up date (3 days later)" }),
    ],
  },
  {
    id: "admin", icon: "FolderOpen", title: "Keep admin tidy",
    body: "Find receipts and contracts, then log the deadlines in one place.",
    request: "Every month, gather my receipts and contracts into one folder and add upcoming deadlines to my calendar.",
    steps: [
      step("trigger", { how: "schedule", when: "On the 1st of each month" }),
      step("find", { where: "inbox", what: "receipts and contracts" }),
      step("write", { what: "summary", about: "the deadlines found in contracts" }),
      step("row", { to: "Deadlines tracker", values: "document, deadline date" }),
    ],
  },
];

// The checked steps of a template (every step rebuilt by the same rules as everything else), or null for an unknown id.
// `id` comes from the address bar, so anything that is not a plain string is refused.
export function templateById(id) {
  const template = typeof id === "string" ? TEMPLATES.find((t) => t.id === id) : undefined;
  if (!template) return null;
  const checked = checkSteps(template.steps);
  return checked.value ? { ...template, steps: checked.value } : null;
}
