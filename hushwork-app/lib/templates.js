// Starter workflows for the Builder, written as TYPED steps (see lib/steps.js). A template is only a starting point: it
// opens in the Builder, where every step can be changed. Nothing runs by itself: a template with `needs` set is one whose
// steps can really do something after you connect that app and press Approve on the Runs page (needs: "Linear", "Google" or
// "Nothing", meaning it works straight away). The others only describe what would happen.
// `request` is the sentence the template stands for; it is saved with the draft, like the text typed in the workspace box.
// Pure data and one small function, no imports from React or Next.js, so tests and both sides of the app can load it.
import { checkSteps } from "./validate.js";

const step = (kind, fields) => ({ kind, fields });

export const TEMPLATES = [
  // ---- these three work for real (after the right connection, and only after you press Approve on the Runs page) ----
  {
    id: "firsttask", icon: "ListTodo", title: "Which task should I do first?", needs: "Linear",
    body: "The AI looks at your open Linear tasks and tells you where to start.",
    request: "When I ask, look at my open Linear tasks and tell me which one to do first and why.",
    steps: [
      step("trigger", { how: "manual", when: "" }),
      step("ai", { task: "Tell me which of my open tasks to do first and why, in 3 short lines.", uses: "linear", address: "" }),
    ],
  },
  {
    id: "inboxnow", icon: "Mail", title: "What is in my inbox?", needs: "Google",
    body: "The AI reads who wrote to you and the subjects of your latest 10 emails, and tells you which to answer first. It never reads the text inside an email.",
    request: "When I ask, look at my latest emails and tell me which ones need an answer first.",
    steps: [
      step("trigger", { how: "manual", when: "" }),
      step("ai", { task: "Which 3 of my latest emails need an answer first? Use sender and subject. Say why, in 3 short lines.", uses: "gmail", address: "" }),
    ],
  },
  {
    id: "recentfiles", icon: "FolderOpen", title: "What did I work on lately?", needs: "Google",
    body: "The AI reads the names of the 10 files you changed most recently in Google Drive and sums up what you worked on. It never opens a file.",
    request: "When I ask, look at the files I changed most recently in Google Drive and sum up what I worked on.",
    steps: [
      step("trigger", { how: "manual", when: "" }),
      step("ai", { task: "From my 10 latest files (names and times only), sum up what I worked on lately in 3 short lines.", uses: "drive", address: "" }),
    ],
  },
  {
    id: "weekahead", icon: "Calendar", title: "My week ahead", needs: "Google",
    body: "The AI reads your Google Calendar and sums up the next 7 days.",
    request: "When I ask, read my Google Calendar for the next 7 days and sum up the week.",
    steps: [
      step("trigger", { how: "manual", when: "" }),
      step("ai", { task: "Sum up my next 7 days in 5 short lines. Point out the busiest day.", uses: "calendar", address: "" }),
    ],
  },
  {
    id: "siteup", icon: "Plug", title: "Is my website up?", needs: "Nothing",
    body: "The AI reads one web page and tells you if it looks like a normal working site. Change the address to your own.",
    request: "When I ask, read my website's front page and tell me if it looks like a normal working site.",
    steps: [
      step("trigger", { how: "manual", when: "" }),
      step("ai", { task: "Does this page look like a normal working website? Answer in one sentence.", uses: "web", address: "https://example.com/" }),
    ],
  },
  {
    id: "testall", icon: "ShieldCheck", title: "Test all my connections", needs: "Linear, Google, Todoist",
    body: "A check-up. It reads your Calendar, Gmail, Drive, Linear and Todoist, calls one web address, writes a one-line report, then creates ONE Linear task and ONE Todoist task from it. Connect those first, run it on Manual, and delete the two test tasks afterwards.",
    request: "When I ask, test every connection: read my calendar, inbox, files, Linear and Todoist, call one web address, write a one-line report, and add a test task in Linear and in Todoist.",
    steps: [
      step("trigger", { how: "manual", when: "" }),
      step("ai", { task: "Say in one line what is on my calendar this week.", uses: "calendar", address: "" }),
      step("ai", { task: "Say in one line who wrote to me last.", uses: "gmail", address: "" }),
      step("ai", { task: "Say in one line which file I changed last.", uses: "drive", address: "" }),
      step("ai", { task: "Say in one line what my top Linear task is.", uses: "linear", address: "" }),
      step("app", { app: "todoist", what: "which task is due first" }),
      step("request", { url: "https://example.com/", why: "check the web call works" }),
      step("ai", { task: "Write ONE short line: Hushwork connection test passed.", uses: "nothing", address: "" }),
      step("issue", { title: "{answer}", details: "Test task made by Hushwork. Safe to delete.", team: "" }),
      step("action", { action: "todoist_task", target: "", title: "{answer}", details: "Test task made by Hushwork. Safe to delete." }),
    ],
  },
  {
    id: "hellomail", icon: "Mail", title: "Send a formal hello email", needs: "Gmail (send)",
    body: "When you ask, it sends one short formal hello email to the address in the step. You read the email and press Approve before anything is sent. Change the address and words to your own.",
    request: "When I ask, send a short formal hello email to arjun.arora30th@gmail.com. Ask me before it is sent.",
    steps: [
      step("trigger", { how: "manual", when: "" }),
      step("action", { action: "gmail_send", target: "arjun.arora30th@gmail.com", title: "Warm greetings", details: "Dear Arjun, I hope this message finds you well. I am writing to send my warmest greetings. Kind regards, Shivalika" }),
    ],
  },
  // ---- these describe a plan only ----
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
