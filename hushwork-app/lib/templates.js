// Starter workflows for the Builder, written as TYPED steps (see lib/steps.js). A template is only a starting point: it
// opens in the Builder, where every step can be changed. Nothing runs by itself: a template with `needs` set is one whose
// steps can really do something after you connect that app and press Approve on the Runs page. Every template says what it needs; none of them
// is plan-only any more (a test keeps it that way).
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
    id: "testall", icon: "ShieldCheck", title: "Test all my connections", needs: "Linear, Google",
    body: "A check-up. It reads your Calendar, Gmail, Drive and Linear, calls one web address, writes a one-line report, then creates ONE Linear task from it. Connect Google and Linear first, run it on Manual, and delete the test task afterwards.",
    request: "When I ask, test every connection: read my calendar, inbox, files and Linear, call one web address, write a one-line report, and add a test task in Linear.",
    steps: [
      step("trigger", { how: "manual", when: "" }),
      step("ai", { task: "Say in one line what is on my calendar this week.", uses: "calendar", address: "" }),
      step("ai", { task: "Say in one line who wrote to me last.", uses: "gmail", address: "" }),
      step("ai", { task: "Say in one line which file I changed last.", uses: "drive", address: "" }),
      step("ai", { task: "Say in one line what my top Linear task is.", uses: "linear", address: "" }),
      step("request", { url: "https://example.com/", why: "check the web call works" }),
      step("ai", { task: "Write ONE short line: Hushwork connection test passed.", uses: "nothing", address: "" }),
      step("issue", { title: "{answer}", details: "Test task made by Hushwork. Safe to delete.", team: "" }),
    ],
  },
  {
    id: "hellomail", icon: "Mail", title: "Send a formal hello email", needs: "Gmail (send)",
    body: "When you ask, it sends one short formal hello email to your own address (the step says {myEmail}). Change that to someone else's address to greet them instead. You read the email and press Approve before anything is sent.",
    request: "When I ask, send myself a short formal hello email. Ask me before it is sent.",
    steps: [
      step("trigger", { how: "manual", when: "" }),
      step("action", { action: "gmail_send", target: "{myEmail}", title: "Warm greetings", details: "Hello, I hope this message finds you well. I am writing to send my warmest greetings. Kind regards" }),
    ],
  },
  {
    id: "emailweek", icon: "Calendar", title: "Email me my week ahead", needs: "Google, Gmail (send)",
    body: "The AI reads your Google Calendar for the next 7 days and emails you a short summary. You read the email and press Approve before it is sent. It goes to your own address ({myEmail}); change that in the step to send it to someone else.",
    request: "When I ask, read my Google Calendar for the next 7 days and email me a short summary. Ask me before it is sent.",
    steps: [
      step("trigger", { how: "manual", when: "" }),
      step("ai", { task: "Sum up my next 7 days in 5 short lines. Point out the busiest day.", uses: "calendar", address: "" }),
      step("action", { action: "gmail_send", target: "{myEmail}", title: "My week ahead", details: "{answer}" }),
    ],
  },
  {
    id: "emailinbox", icon: "Inbox", title: "Email me what to answer first", needs: "Google, Gmail (send)",
    body: "The AI looks at who wrote to you and the subjects of your latest 10 emails, then emails you which three to answer first. It never reads the text inside an email.",
    request: "When I ask, look at my latest emails and email me which ones need an answer first. Ask me before it is sent.",
    steps: [
      step("trigger", { how: "manual", when: "" }),
      step("ai", { task: "Which 3 of my latest emails need an answer first? Use sender and subject. Say why, in 3 short lines.", uses: "gmail", address: "" }),
      step("action", { action: "gmail_send", target: "{myEmail}", title: "Emails to answer first", details: "{answer}" }),
    ],
  },
  {
    id: "emailfiles", icon: "FolderOpen", title: "Email me what I worked on", needs: "Google, Gmail (send)",
    body: "The AI reads the names of your 10 most recently changed Google Drive files and emails you a short recap. It never opens a file.",
    request: "When I ask, look at the files I changed most recently in Google Drive and email me a short recap. Ask me before it is sent.",
    steps: [
      step("trigger", { how: "manual", when: "" }),
      step("ai", { task: "From my 10 latest files (names and times only), sum up what I worked on lately in 3 short lines.", uses: "drive", address: "" }),
      step("action", { action: "gmail_send", target: "{myEmail}", title: "What I worked on", details: "{answer}" }),
    ],
  },
  {
    id: "emailtask", icon: "ListTodo", title: "Email me my top task", needs: "Google, Gmail (send)",
    body: "The AI looks at your open Linear tasks and emails you which one to start with. You press Approve before it is sent.",
    request: "When I ask, look at my open Linear tasks and email me which one to do first. Ask me before it is sent.",
    steps: [
      step("trigger", { how: "manual", when: "" }),
      step("ai", { task: "Tell me which of my open tasks to do first and why, in 3 short lines.", uses: "linear", address: "" }),
      step("action", { action: "gmail_send", target: "{myEmail}", title: "My top task", details: "{answer}" }),
    ],
  },
  {
    id: "mailtask", icon: "ListTodo", title: "Turn my latest email into a task", needs: "Google, Linear",
    body: "The AI looks at the senders and subjects of your latest 10 emails, picks the one that needs action, and you approve a new Linear task for it. It never reads the text inside an email.",
    request: "When I ask, look at my latest emails, pick the one that needs action, and add a task for it in Linear. Ask me before it is added.",
    steps: [
      step("trigger", { how: "manual", when: "" }),
      step("ai", { task: "Write ONE short line: the action I should take for the email that needs an answer most. Start with a verb.", uses: "gmail", address: "" }),
      step("issue", { title: "{answer}", details: "Made from my latest emails by Hushwork.", team: "" }),
    ],
  },
  {
    id: "briefing", icon: "Clock", title: "Morning briefing by email", needs: "Google, Linear, Gmail (send)",
    body: "The AI reads your week ahead, your latest emails and your top Linear task, then sends you ONE email with all three summaries. You read the email and press Approve before it is sent. Pair it with a daily schedule for a real morning briefing.",
    request: "When I ask, look at my calendar, my latest emails and my Linear tasks, and email me one briefing with all three. Ask me before it is sent.",
    steps: [
      step("trigger", { how: "manual", when: "" }),
      step("ai", { task: "Sum up my next 7 days in 4 short lines. Start with the heading: This week.", uses: "calendar", address: "" }),
      step("ai", { task: "Which 3 of my latest emails need an answer first? 3 short lines. Start with the heading: Inbox.", uses: "gmail", address: "" }),
      step("ai", { task: "Which of my open tasks should I do first, and why? 2 short lines. Start with the heading: Tasks.", uses: "linear", address: "" }),
      step("action", { action: "gmail_send", target: "{myEmail}", title: "Your morning briefing", details: "{answers}" }),
    ],
  },
  // ---- the packs: Finance, Marketing, Coding and Design. Each is a few ready-made workflows with a suggested schedule (lib/template-packs.js) ----
  {
    id: "stripeweek", pack: "finance", icon: "CreditCard", title: "Weekly Stripe summary by email", needs: "Stripe, Gmail (send)",
    body: "The AI reads your latest Stripe payments and emails you a short summary: how many, how much, anything odd. It cannot charge or refund anything. You press Approve before the email is sent.",
    request: "Every Monday morning, look at my latest Stripe payments and email me a short summary. Ask me before it is sent.",
    schedule: { frequency: "weekly", weekday: 1, hour: 9, minute: 0 },
    steps: [
      step("trigger", { how: "schedule", when: "Every Monday at 9:00" }),
      step("ai", { task: "Sum up my latest payments in 4 short lines: how many, the total, the biggest, and anything that looks odd.", uses: "app", address: "stripe" }),
      step("action", { action: "gmail_send", target: "{myEmail}", title: "Your weekly Stripe summary", details: "{answer}" }),
    ],
  },
  {
    id: "invoicemail", pack: "finance", icon: "Receipt", title: "Turn an invoice email into a to-do", needs: "Google, Linear",
    body: "The AI looks at the senders and subjects of your latest 10 emails, picks the one that looks like a bill or invoice, and you approve a Linear task to pay it. It never reads the text inside an email.",
    request: "Every Monday, look at my latest emails, find a bill or invoice, and add a task in Linear to pay it. Ask me before it is added.",
    schedule: { frequency: "weekly", weekday: 1, hour: 9, minute: 30 },
    steps: [
      step("trigger", { how: "schedule", when: "Every Monday at 9:30" }),
      step("ai", { task: "One line starting with Pay: the email that looks most like a bill (sender, subject). If none: Pay: nothing.", uses: "gmail", address: "" }),
      step("issue", { title: "{answer}", details: "Made from my latest emails by Hushwork.", team: "" }),
    ],
  },
  {
    id: "receiptsmail", pack: "finance", icon: "FolderOpen", title: "Receipts and invoices I saved, by email", needs: "Google, Gmail (send)",
    body: "The AI reads the names of your 10 most recently changed Drive files and emails you which ones look like receipts, invoices or contracts. It never opens a file.",
    request: "Every Friday, look at the files I changed lately in Google Drive and email me which ones look like receipts or invoices. Ask me before it is sent.",
    schedule: { frequency: "weekly", weekday: 5, hour: 16, minute: 0 },
    steps: [
      step("trigger", { how: "schedule", when: "Every Friday at 16:00" }),
      step("ai", { task: "From my 10 latest file names, which look like receipts, invoices or contracts? List them in 3 short lines.", uses: "drive", address: "" }),
      step("action", { action: "gmail_send", target: "{myEmail}", title: "Receipts and invoices this week", details: "{answer}" }),
    ],
  },
  {
    id: "postideas", pack: "marketing", icon: "PenLine", title: "Five post ideas by email", needs: "Gmail (send)",
    body: "The AI writes five short post ideas and emails them to you. Change the task in the AI step to describe your own product and readers. You press Approve before the email is sent.",
    request: "Every Monday morning, email me five short social post ideas for my product. Ask me before it is sent.",
    schedule: { frequency: "weekly", weekday: 1, hour: 8, minute: 0 },
    steps: [
      step("trigger", { how: "schedule", when: "Every Monday at 8:00" }),
      step("ai", { task: "Give me 5 short social post ideas for a small software product that automates weekly admin. One line each.", uses: "nothing", address: "" }),
      step("action", { action: "gmail_send", target: "{myEmail}", title: "Five post ideas for this week", details: "{answer}" }),
    ],
  },
  {
    id: "pagecheck", pack: "marketing", icon: "Plug", title: "Check my landing page and email me", needs: "Gmail (send)",
    body: "The AI reads one web page and emails you three clear things to improve. Change the address in the AI step to your own page. You press Approve before the email is sent.",
    request: "Every Friday, read my landing page and email me three things to improve. Ask me before it is sent.",
    schedule: { frequency: "weekly", weekday: 5, hour: 9, minute: 0 },
    steps: [
      step("trigger", { how: "schedule", when: "Every Friday at 9:00" }),
      step("ai", { task: "Read this page like a new visitor. Give 3 short, specific things that would make it clearer.", uses: "web", address: "https://example.com/" }),
      step("action", { action: "gmail_send", target: "{myEmail}", title: "Three ways to improve the page", details: "{answer}" }),
    ],
  },
  {
    id: "writingblock", pack: "marketing", icon: "Calendar", title: "Block writing time on my calendar", needs: "Google Calendar (events)",
    body: "Adds one event to your Google Calendar for writing. Change the start time in the step first: a template cannot know your date. You see the event and press Approve before it is added.",
    request: "Put a writing block on my calendar. Ask me before it is added.",
    steps: [
      step("trigger", { how: "manual", when: "" }),
      step("action", { action: "calendar_event", target: "2026-11-02 09:00", title: "Writing time: this week's posts", details: "Draft and schedule the week's posts." }),
    ],
  },
  {
    id: "launchnotes", pack: "marketing", icon: "FileText", title: "Launch notes page in Notion", needs: "Google, Notion",
    body: "The AI looks at your latest Drive files and creates a Notion page called Launch notes with a one-line summary of what you worked on. First change the page id in the step to the Notion page it should go under. You press Approve before it is created.",
    request: "When I ask, create a Launch notes page in Notion with a summary of what I worked on. Ask me before it is created.",
    steps: [
      step("trigger", { how: "manual", when: "" }),
      step("ai", { task: "Say in 8 words or fewer what I worked on most lately, from my latest file names.", uses: "drive", address: "" }),
      step("action", { action: "notion_page", target: "00000000000000000000000000000000", title: "Launch notes: {answer}", details: "" }),
    ],
  },
  {
    id: "githubdigest", pack: "coding", icon: "Inbox", title: "GitHub digest by email", needs: "GitHub, Gmail (send)",
    body: "The AI reads your latest GitHub notifications (review requests, mentions, issues) and emails you a short digest. You press Approve before the email is sent.",
    request: "Every weekday morning, read my GitHub notifications and email me a short digest. Ask me before it is sent.",
    schedule: { frequency: "weekdays", weekday: 1, hour: 8, minute: 30 },
    steps: [
      step("trigger", { how: "schedule", when: "Every weekday at 8:30" }),
      step("ai", { task: "Sum up my GitHub notifications in 4 short lines. Put review requests first.", uses: "app", address: "github" }),
      step("action", { action: "gmail_send", target: "{myEmail}", title: "Your GitHub digest", details: "{answer}" }),
    ],
  },
  {
    id: "notifytask", pack: "coding", icon: "ListTodo", title: "Turn a GitHub notification into a Linear task", needs: "GitHub, Linear",
    body: "The AI reads your latest GitHub notifications, picks the one most worth doing, and you approve a Linear task for it.",
    request: "Every weekday, look at my GitHub notifications and add the most important one as a task in Linear. Ask me before it is added.",
    schedule: { frequency: "weekdays", weekday: 1, hour: 9, minute: 0 },
    steps: [
      step("trigger", { how: "schedule", when: "Every weekday at 9:00" }),
      step("ai", { task: "Write ONE short line starting with a verb: the most important thing to do from my GitHub notifications.", uses: "app", address: "github" }),
      step("issue", { title: "{answer}", details: "Made from my GitHub notifications by Hushwork.", team: "" }),
    ],
  },
  {
    id: "weeklydeps", pack: "coding", icon: "ShieldCheck", title: "Weekly dependency check issue", needs: "GitHub",
    body: "Creates one GitHub issue each week as a reminder to check dependency updates and security alerts. First change owner/name in the step to your own repository. You press Approve before it is created.",
    request: "Every Monday, create an issue in my repository to check dependency updates and security alerts. Ask me before it is created.",
    schedule: { frequency: "weekly", weekday: 1, hour: 9, minute: 0 },
    steps: [
      step("trigger", { how: "schedule", when: "Every Monday at 9:00" }),
      step("action", { action: "github_issue", target: "your-name/your-repo", title: "Weekly: check dependency updates and security alerts", details: "Made by Hushwork. Close it when done." }),
    ],
  },
  {
    id: "incidentmail", pack: "coding", icon: "Clock", title: "Incident digest by email", needs: "PagerDuty, Gmail (send)",
    body: "The AI reads your latest PagerDuty incidents and emails you a short digest. It cannot acknowledge or resolve anything. You press Approve before the email is sent.",
    request: "Every weekday evening, read my PagerDuty incidents and email me a short digest. Ask me before it is sent.",
    schedule: { frequency: "weekdays", weekday: 1, hour: 17, minute: 30 },
    steps: [
      step("trigger", { how: "schedule", when: "Every weekday at 17:30" }),
      step("ai", { task: "Sum up my latest incidents in 4 short lines: how many, how serious, and which are still open.", uses: "app", address: "pagerduty" }),
      step("action", { action: "gmail_send", target: "{myEmail}", title: "Incident digest", details: "{answer}" }),
    ],
  },
  {
    id: "designreview", pack: "design", icon: "ListChecks", title: "Weekly design review task", needs: "Linear",
    body: "Creates one Linear task every week to review your screens for spacing, contrast and wording. You press Approve before it is created.",
    request: "Every Friday afternoon, add a design review task in Linear. Ask me before it is added.",
    schedule: { frequency: "weekly", weekday: 5, hour: 15, minute: 0 },
    steps: [
      step("trigger", { how: "schedule", when: "Every Friday at 15:00" }),
      step("issue", { title: "Design review: check this week's screens for spacing, contrast and wording", details: "Made by Hushwork. Note what to fix, then close it.", team: "" }),
    ],
  },
  {
    id: "feedbackmail", pack: "design", icon: "MessageSquare", title: "Feedback roundup by email", needs: "Google, Gmail (send)",
    body: "The AI looks at who wrote to you and the subjects of your latest 10 emails, and emails you which ones look like feedback or complaints. It never reads the text inside an email.",
    request: "Every Friday, look at my latest emails and email me the ones that look like feedback. Ask me before it is sent.",
    schedule: { frequency: "weekly", weekday: 5, hour: 16, minute: 30 },
    steps: [
      step("trigger", { how: "schedule", when: "Every Friday at 16:30" }),
      step("ai", { task: "Which emails look like feedback or complaints? Use sender and subject. Up to 3 short lines.", uses: "gmail", address: "" }),
      step("action", { action: "gmail_send", target: "{myEmail}", title: "Feedback this week", details: "{answer}" }),
    ],
  },
  {
    id: "designlog", pack: "design", icon: "FileText", title: "Design log page in Notion", needs: "Google, Notion",
    body: "The AI looks at the names of your latest Drive files and creates a Notion page called Design log with a one-line summary. First change the page id in the step to the Notion page it should go under. You press Approve before it is created.",
    request: "When I ask, create a Design log page in Notion that sums up my latest design files. Ask me before it is created.",
    steps: [
      step("trigger", { how: "manual", when: "" }),
      step("ai", { task: "Say in 8 words or fewer which design work I changed most lately, from my latest file names.", uses: "drive", address: "" }),
      step("action", { action: "notion_page", target: "00000000000000000000000000000000", title: "Design log: {answer}", details: "" }),
    ],
  },
  {
    id: "focusblock", pack: "design", icon: "Calendar", title: "Block design focus time on my calendar", needs: "Google Calendar (events)",
    body: "Adds one focus block to your Google Calendar. Change the start time in the step first: a template cannot know your date. You see the event and press Approve before it is added.",
    request: "Put a design focus block on my calendar. Ask me before it is added.",
    steps: [
      step("trigger", { how: "manual", when: "" }),
      step("action", { action: "calendar_event", target: "2026-11-03 14:00", title: "Design focus: no meetings", details: "Deep work on the current design." }),
    ],
  },
  // ---- the five oldest templates, rebuilt so that every step REALLY does something (they used to only describe a plan) ----
  {
    id: "invoices", pack: "finance", icon: "Receipt", title: "Chase unpaid invoices", needs: "Stripe, Gmail (send)",
    body: "The AI reads your latest Stripe payments and emails YOU a short list of the ones that failed or look overdue, with client and amount, so you know who to chase. It does not email your clients. You press Approve before the email is sent.",
    request: "Every weekday morning, look at my latest Stripe payments and email me the ones that failed or look overdue. Ask me before it is sent.",
    schedule: { frequency: "weekdays", weekday: 1, hour: 9, minute: 0 },
    steps: [
      step("trigger", { how: "schedule", when: "Every weekday at 9:00" }),
      step("ai", { task: "List payments that failed or look overdue: client, amount, how late. Up to 5 short lines.", uses: "app", address: "stripe" }),
      step("action", { action: "gmail_send", target: "{myEmail}", title: "Invoices to chase", details: "{answer}" }),
    ],
  },
  {
    id: "report", pack: "everyday", icon: "FileBarChart", title: "Send a weekly client report", needs: "Linear, Gmail (send)",
    body: "The AI reads your open Linear tasks and emails YOU a short report you can check and forward to your clients. It does not email your clients itself. You press Approve before the email is sent.",
    request: "Every Friday afternoon, look at my Linear tasks and email me a short report I can send to my clients. Ask me before it is sent.",
    schedule: { frequency: "weekly", weekday: 5, hour: 16, minute: 0 },
    steps: [
      step("trigger", { how: "schedule", when: "Every Friday at 16:00" }),
      step("ai", { task: "Write a short client-ready report from my tasks: what is in progress and what is next. 5 short lines.", uses: "linear", address: "" }),
      step("action", { action: "gmail_send", target: "{myEmail}", title: "Weekly report draft", details: "{answer}" }),
    ],
  },
  {
    id: "inbox", pack: "everyday", icon: "Inbox", title: "Sort your inbox", needs: "Google, Gmail (send)",
    body: "The AI looks at who wrote to you and the subjects of your latest 10 emails, and emails you one short morning digest: what needs you and what can wait. It never reads the text inside an email and does not move or star anything. You press Approve before the email is sent.",
    request: "Every morning, look at my latest emails and email me one short digest of what needs me. Ask me before it is sent.",
    schedule: { frequency: "weekdays", weekday: 1, hour: 8, minute: 0 },
    steps: [
      step("trigger", { how: "schedule", when: "Every weekday at 8:00" }),
      step("ai", { task: "Which emails need me and which can wait? Use sender and subject. 4 short lines.", uses: "gmail", address: "" }),
      step("action", { action: "gmail_send", target: "{myEmail}", title: "Your morning digest", details: "{answer}" }),
    ],
  },
  {
    id: "leads", pack: "marketing", icon: "UserPlus", title: "Follow up new leads", needs: "Google, Linear",
    body: "The AI looks at the senders and subjects of your latest 10 emails, picks the one that looks like a new enquiry, and you approve a Linear task to reply to it. It does not email the lead for you. It never reads the text inside an email.",
    request: "Every weekday, look at my latest emails, find a new enquiry, and add a task in Linear to follow up. Ask me before it is added.",
    schedule: { frequency: "weekdays", weekday: 1, hour: 10, minute: 0 },
    steps: [
      step("trigger", { how: "schedule", when: "Every weekday at 10:00" }),
      step("ai", { task: "One line starting with Reply to: the email that looks like a new enquiry. If none: Reply to: nobody.", uses: "gmail", address: "" }),
      step("issue", { title: "{answer}", details: "Made from my latest emails by Hushwork.", team: "" }),
    ],
  },
  {
    id: "admin", pack: "finance", icon: "FolderOpen", title: "Keep admin tidy", needs: "Google, Gmail (send)",
    body: "The AI reads the names of your 10 most recently changed Google Drive files and emails you which ones look like receipts or contracts. It never opens a file and does not move anything. You press Approve before the email is sent.",
    request: "Every Monday, look at my recent Drive files and email me which ones look like receipts or contracts. Ask me before it is sent.",
    schedule: { frequency: "weekly", weekday: 1, hour: 9, minute: 0 },
    steps: [
      step("trigger", { how: "schedule", when: "Every Monday at 9:00" }),
      step("ai", { task: "From my 10 latest file names, which look like receipts or contracts? 3 short lines.", uses: "drive", address: "" }),
      step("action", { action: "gmail_send", target: "{myEmail}", title: "Receipts and contracts this week", details: "{answer}" }),
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
