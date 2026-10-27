// SKILLS AND SKILL BUNDLES (plugins). Plain data and a few small functions, no Next.js or database, so the page, the server and the tests load the same rules.
//
//   A SKILL is one small capability: ONE typed step (lib/steps.js) with the words that say what it reads and what it writes
//   ("Find unpaid payments" reads your latest Stripe payments; "Email me the result" sends one email to you). A skill can only do what its step kind can do,
//   so a skill adds no new power: reading skills only read, and a writing skill still waits for the Approve click on the Runs page like any other step.
//
//   A BUNDLE is a named package of skills for one kind of work, with the app connections it needs and a few ready-made WORKFLOWS built only from its own skills.
//   Turning a bundle on (the Skills page) saves those workflows as drafts in the person's own list. It never connects an app, never makes a schedule and never runs anything.
//
// To add a skill or a bundle: add an entry below. bundles.test.js checks the rules (every step is valid, a writing skill is always behind an approval step, the
// connections listed are exactly the ones the skills need, every skill is used).
import { APP_LIST } from "../connectors/app-list.js";
import { COMPOSIO_APPS } from "../connectors/composio-apps.js";
import { checkSteps } from "../validate.js";
import { describeSchedule, checkSchedule } from "../schedule.js";

const step = (kind, fields) => ({ kind, fields });
// `alone`: for a skill that writes words taken from an earlier AI step ({answer}), the plain words it uses when it is the only step of a workflow (see skillStart).
const skill = (id, name, icon, about, { reads = "", writes = "", needs = [], alone = null }, s) => ({ id, name, icon, about, reads, writes, needs, alone, step: s });

// ---- the skills ----------------------------------------------------------------------------------------------------------------------------------------
export const SKILLS = [
  // finance
  skill("stripe-unpaid", "Find unpaid invoices", "CreditCard", "Looks at your latest Stripe invoices and lists the ones that are open or overdue: client, amount, how late.",
    { reads: "Your latest Stripe invoices (read only: it cannot create, send, pay or change anything).", needs: ["stripe"] },
    step("ai", { task: "List invoices that are open or overdue: client, amount, how late. Up to 5 short lines.", uses: "app", address: "stripeinvoices" })),
  skill("stripe-summary", "Summarise payments", "FileBarChart", "Sums up your latest Stripe payments: how many, the total, the biggest, and anything odd.",
    { reads: "Your latest Stripe payments (read only).", needs: ["stripe"] },
    step("ai", { task: "Sum up my latest payments in 4 short lines: how many, the total, the biggest, and anything that looks odd.", uses: "app", address: "stripe" })),
  skill("gmail-clients", "Match clients in Gmail", "Mail", "Looks at who wrote to you lately and picks the senders that look like clients, with their email addresses.",
    { reads: "The sender, subject and time of your latest 10 emails. It never reads the text inside an email.", needs: ["google"] },
    step("ai", { task: "Which senders look like clients? Give the name and email address. Up to 5 short lines.", uses: "gmail", address: "" })),
  skill("draft-reminder", "Draft a reminder email", "PenLine", "Writes one short, polite payment reminder with blanks for the name and the amount, ready for you to adapt.",
    { reads: "Nothing from your apps: the AI only writes." },
    step("ai", { task: "Write one short, polite payment reminder email. Leave [Name] and [Amount] as blanks.", uses: "nothing", address: "" })),
  skill("drive-expenses", "Sort expenses from Drive", "FolderOpen", "Reads the names of your most recent Google Drive files and sorts the ones that look like receipts or expenses into software, travel and other.",
    { reads: "The names, kinds and times of your 10 most recently changed Drive files. It never opens a file.", needs: ["google"] },
    step("ai", { task: "From my 10 latest file names, which look like receipts or expenses? Group them as software, travel, other.", uses: "drive", address: "" })),
  // work and admin
  skill("gmail-urgent", "Spot urgent client requests", "Inbox", "Reads who wrote and the subjects of your latest emails and says which look like urgent client requests, and why.",
    { reads: "The sender, subject and time of your latest 10 emails. It never reads the text inside an email.", needs: ["google"] },
    step("ai", { task: "Which of my latest emails look like urgent client requests? Say why. Up to 4 short lines.", uses: "gmail", address: "" })),
  skill("gmail-top-request", "Pick the top request", "Search", "Picks the one email that most needs a reply, as a single line you can turn into a task.",
    { reads: "The sender, subject and time of your latest 10 emails. It never reads the text inside an email.", needs: ["google"] },
    step("ai", { task: "One line starting with Reply to: the email that most needs an answer. If none: Reply to: nobody.", uses: "gmail", address: "" })),
  skill("linear-blockers", "Find operational blockers", "ListChecks", "Reads your open Linear tasks and sums up what is in progress and what looks blocked.",
    { reads: "Your open Linear tasks (read only).", needs: ["linear"] },
    step("ai", { task: "Sum up my open tasks: what is in progress and what looks blocked. Up to 5 short lines.", uses: "linear", address: "" })),
  skill("gmail-reply-drafts", "Draft replies to my emails", "PenLine", "Reads the opening of your 5 newest emails and writes a short reply for each one that needs an answer. It only writes: nothing is sent.",
    { reads: "The sender, subject and the opening of the text (about 450 characters) of your 5 newest emails. That text goes to the AI (Groq) with your request. It cannot send, change or delete mail.", needs: ["google"] },
    step("ai", { task: "For each of my newest emails that needs an answer, write a short polite reply. Up to 5.", uses: "gmailtext", address: "" })),
  skill("slack-channel", "Read a Slack channel", "MessageSquare", "Reads the latest messages of ONE Slack channel and sums up what matters. Put your channel's name in the step after the colon.",
    { reads: "The latest 10 messages of the one channel named in the step (read only: it cannot post, edit or delete anything).", needs: ["slack"] },
    step("ai", { task: "Sum up the latest messages: decisions, questions and anything urgent. Up to 5 short lines.", uses: "app", address: "slackmessages:general" })),
  skill("github-notifications", "Read GitHub notifications", "Inbox", "Reads your latest GitHub notifications and lists what needs action first.",
    { reads: "Your latest GitHub notifications (read only).", needs: ["github"] },
    step("ai", { task: "List the notifications that need action first: repo, what and why. Up to 5 short lines.", uses: "app", address: "github" })),
  skill("pagerduty-incidents", "Read PagerDuty incidents", "ShieldCheck", "Reads your latest PagerDuty incidents and sums up which are open or serious.",
    { reads: "Your latest PagerDuty incidents (read only: it cannot acknowledge or resolve anything).", needs: ["pagerduty"] },
    step("ai", { task: "Sum up my latest incidents: which are open or serious, and how long. Up to 4 short lines.", uses: "app", address: "pagerduty" })),
  // marketing
  skill("blog-takeaways", "Pull takeaways from a blog post", "FileText", "Reads one blog post (the web address you put in the step) and pulls out its main takeaways and two short quotes.",
    { reads: "ONE web page: the address written in the step. Nothing else is fetched." },
    step("ai", { task: "Read this post. Give 3 key takeaways and 2 short quotes, as plain lines.", uses: "web", address: "https://example.com/blog/my-post" })),
  skill("campaign-content", "Write social posts and a newsletter", "PenLine", "Reads the same blog post and writes 5 short social posts and 1 short newsletter draft.",
    { reads: "ONE web page: the address written in the step. Nothing else is fetched." },
    step("ai", { task: "Read this post. Write 5 social posts under 250 characters, then one short newsletter. Plain text.", uses: "web", address: "https://example.com/blog/my-post" })),
  skill("post-ideas", "Think of post ideas", "Sparkles", "Thinks of five post ideas for your audience. No app is read.",
    { reads: "Nothing from your apps: the AI only writes." },
    step("ai", { task: "Give me five post ideas for a freelancer's audience, one short line each, with a hook.", uses: "nothing", address: "" })),
  // control and writing
  // freelancer safety net: each of these reads ONE place; the ones with {answers} also get what the steps before them found
  skill("slack-requests", "Find what the client asked for in Slack", "MessageSquare", "Reads the latest messages of ONE Slack channel and lists what the client asked for. Put your channel's name in the step after the colon.",
    { reads: "The latest 10 messages of the one channel named in the step (read only).", needs: ["slack"] },
    step("ai", { task: "List what the client asked for: who and what, numbered. Up to 8 short lines.", uses: "app", address: "slackmessages:general" })),
  skill("linear-untracked", "Spot requests with no task", "ListChecks", "Reads your open Linear tasks and, using what the step before found, says which requests have no matching task.",
    { reads: "Your open Linear tasks (read only), plus what the earlier Ask the AI steps found.", needs: ["linear"] },
    step("ai", { task: "Which of these requests have NO matching open task? Say why. {answers}", uses: "linear", address: "" })),
  skill("calendar-busy-days", "Find the busy days", "Calendar", "Reads your calendar for the next 7 days and says how many meetings each day has and which day is busiest.",
    { reads: "Your Google Calendar for the next 7 days (read only).", needs: ["google"] },
    step("ai", { task: "For each of the next 7 days: how many meetings, and which day is busiest. 7 short lines.", uses: "calendar", address: "" })),
  skill("linear-light-days", "Match tasks to the light days", "ListTodo", "Reads your open Linear tasks and, using what the step before found, picks 3 to do on the lightest days.",
    { reads: "Your open Linear tasks (read only), plus what the earlier Ask the AI steps found.", needs: ["linear"] },
    step("ai", { task: "Pick 3 open tasks to do on the lightest days below, and say which day. {answers}", uses: "linear", address: "" })),
  skill("calendar-today", "List today's meetings", "Clock", "Reads your calendar and lists today's meetings.",
    { reads: "Your Google Calendar (read only).", needs: ["google"] },
    step("ai", { task: "List today's meetings: time and title. Up to 6 short lines.", uses: "calendar", address: "" })),
  skill("gmail-urgent-text", "Find unhappy or urgent emails", "Inbox", "Reads the opening of your 5 newest emails and lists any urgent question or unhappy message.",
    { reads: "The sender, subject and opening text (about 450 characters) of your 5 newest emails. That text goes to the AI (Groq). It cannot send or change anything.", needs: ["google"] },
    step("ai", { task: "From these emails list any urgent question or unhappy message. Up to 3 bullets.", uses: "gmailtext", address: "" })),
  skill("prep-card", "Write a 3-bullet prep card", "FileText", "Takes what the steps before found and writes a short card: what to know before your meetings today.",
    { reads: "Nothing new from your apps: it only works from what the earlier steps found." },
    step("ai", { task: "Write a 3-bullet prep card for today's meetings from this. {answers}", uses: "nothing", address: "" })),
  skill("ask-approval", "Ask you to approve", "ShieldCheck", "A stop sign: it marks the point where the workflow starts to write, so you know to read the approval card.",
    { reads: "Nothing." },
    step("approve", { what: "Everything that writes below, before it happens" })),
  skill("notion-page", "Save to a Notion page", "FileText", "Creates ONE new Notion page with a title and text written on it, under a Notion page you name. First change the page id in the step to your own.",
    { writes: "Creates one new page in Notion, with the text you read on the approval card. It cannot change or delete existing pages. It waits for your Approve click.", needs: ["notion"], alone: { title: "Notes from Hushwork", details: "Write the page text here." } },
    step("action", { action: "notion_page", target: "00000000000000000000000000000000", title: "Notes from Hushwork", details: "{answers}" })),
  skill("email-me", "Email me the result", "Mail", "Sends ONE email to your own address with what the AI steps said. You read it and press Approve first.",
    { writes: "Sends one email to your own address through Gmail (send). It waits for your Approve click.", needs: ["gmailsend"], alone: { title: "A note from Hushwork", details: "Write your message here." } },
    step("action", { action: "gmail_send", target: "{myEmail}", title: "Your Hushwork result", details: "{answers}" })),
  skill("linear-task", "Create a Linear task", "ListTodo", "Adds ONE new task in Linear from what the last AI step said (for example a Reply to: line).",
    { writes: "Creates one new Linear task. It cannot change or delete existing tasks. It waits for your Approve click.", needs: ["linear"], alone: { title: "A task to do", details: "" } },
    step("issue", { title: "{answer}", details: "Made by Hushwork from your latest emails.", team: "" })),
];

// ---- the bundles -----------------------------------------------------------------------------------------------------------------------------------------
// A workflow's `flow` is a list of skill ids, in order; an entry may be [skillId, { field: value }] to change the skill's words for this workflow only.
// `start` is the Start step. `schedule` is only a suggestion, shown on the Skills page: enabling a bundle never creates a schedule.
export const BUNDLES = [
  {
    id: "finance-ops", name: "Finance and operations", icon: "CreditCard",
    blurb: "Chase unpaid invoices, sort expenses and send yourself a weekly money report.",
    connections: ["stripe", "google", "gmailsend"],
    skills: ["stripe-unpaid", "gmail-clients", "draft-reminder", "drive-expenses", "stripe-summary", "ask-approval", "email-me"],
    workflows: [
      {
        id: "invoice-chaser", title: "Invoice Chaser", body: "Every Friday: finds unpaid invoices, matches the client email addresses, drafts a polite reminder and emails you the lot to review. It does not email your clients.",
        request: "Every Friday at 10:00, find unpaid invoices, match the client email addresses, draft a reminder and email it to me. Ask me before it is sent.",
        start: { how: "schedule", when: "Every Friday at 10:00" }, schedule: { frequency: "weekly", weekday: 5, hour: 10, minute: 0 },
        flow: ["stripe-unpaid", "gmail-clients", "draft-reminder", "ask-approval", ["email-me", { title: "Invoices to chase" }]],
      },
      {
        id: "expense-sorter", title: "Expense Categorizer", body: "Every Monday: reads the names of your recent Drive files and emails you which ones look like receipts, sorted by kind.",
        request: "Every Monday at 9:00, look at my recent Drive files and email me which ones look like receipts, sorted by kind. Ask me before it is sent.",
        start: { how: "schedule", when: "Every Monday at 9:00" }, schedule: { frequency: "weekly", weekday: 1, hour: 9, minute: 0 },
        flow: ["drive-expenses", "ask-approval", ["email-me", { title: "Expenses this week" }]],
      },
      {
        id: "money-report", title: "Weekly Money Report", body: "Every Friday afternoon: sums up your latest Stripe payments and emails you the report.",
        request: "Every Friday at 16:00, sum up my latest Stripe payments and email me a short report. Ask me before it is sent.",
        start: { how: "schedule", when: "Every Friday at 16:00" }, schedule: { frequency: "weekly", weekday: 5, hour: 16, minute: 0 },
        flow: ["stripe-summary", "ask-approval", ["email-me", { title: "Your weekly money report" }]],
      },
    ],
  },
  {
    id: "marketing-growth", name: "Marketing and growth", icon: "PenLine",
    blurb: "Turn one blog post into social posts and a newsletter, and never run out of ideas.",
    connections: ["gmailsend", "notion"],
    skills: ["blog-takeaways", "campaign-content", "post-ideas", "ask-approval", "email-me", "notion-page"],
    workflows: [
      {
        id: "campaign-repurposer", title: "Campaign Repurposer", body: "Reads one blog post and emails you its takeaways, 5 social posts and a newsletter draft: your review queue is your inbox. Put the post's address in both Ask the AI steps in the Builder first.",
        request: "When I ask, read my new blog post, pull out the takeaways and write 5 social posts and a newsletter draft. Email them to me for review.",
        start: { how: "manual", when: "" },
        flow: ["blog-takeaways", "campaign-content", "ask-approval", ["email-me", { title: "Campaign content to review" }]],
      },
      {
        id: "weekly-post-ideas", title: "Weekly Post Ideas", body: "Every Monday: thinks of five post ideas and emails them to you.",
        request: "Every Monday at 9:00, think of five post ideas and email them to me. Ask me before it is sent.",
        start: { how: "schedule", when: "Every Monday at 9:00" }, schedule: { frequency: "weekly", weekday: 1, hour: 9, minute: 0 },
        flow: ["post-ideas", "ask-approval", ["email-me", { title: "Five post ideas" }]],
      },
      {
        id: "ideas-to-notion", title: "Post Ideas to Notion", body: "When you ask: thinks of five post ideas and writes them on a new Notion page. First change the page id in the last step to the Notion page it should go under.",
        request: "When I ask, think of five post ideas and write them on a new Notion page. Ask me before it is created.",
        start: { how: "manual", when: "" },
        flow: ["post-ideas", "ask-approval", ["notion-page", { title: "Post ideas", details: "{answer}" }]],
      },
    ],
  },
  {
    id: "dev-admin", name: "Dev and admin", icon: "Workflow",
    blurb: "Triage client requests into Linear tasks and get a weekly digest of GitHub and incidents.",
    connections: ["google", "linear", "gmailsend", "github", "pagerduty", "slack"],
    skills: ["gmail-urgent", "gmail-top-request", "gmail-reply-drafts", "slack-channel", "linear-blockers", "github-notifications", "pagerduty-incidents", "ask-approval", "linear-task", "email-me"],
    workflows: [
      {
        id: "client-triage", title: "Client Project Triage", body: "When you ask: spots urgent client emails, sums up what is blocked in Linear, then (after you approve) creates a Linear task for the top request and emails you a daily brief. Slack messages cannot be read, only Gmail.",
        request: "When I ask, find urgent client emails, sum up what is blocked, add a Linear task for the top request and email me a daily brief. Ask me first.",
        start: { how: "manual", when: "" },
        flow: ["gmail-urgent", "linear-blockers", "gmail-top-request", "ask-approval", ["linear-task", { details: "Made by Hushwork from your latest emails." }], ["email-me", { title: "Your daily client brief" }]],
      },
      {
        id: "reply-drafts", title: "Reply Drafts", body: "When you ask: reads the opening of your 5 newest emails, writes a short reply for each one that needs an answer, and emails you the drafts to review. Nothing is sent to anyone else. The text of those emails goes to the AI (Groq).",
        request: "When I ask, read my newest emails, write a short reply for each that needs one and email the drafts to me. Ask me before it is sent.",
        start: { how: "manual", when: "" },
        flow: ["gmail-reply-drafts", "ask-approval", ["email-me", { title: "Reply drafts to review" }]],
      },
      {
        id: "slack-brief", title: "Slack Channel Brief", body: "When you ask: reads the latest messages of one Slack channel and emails you a short brief. First change the channel name after the colon in the Ask the AI step.",
        request: "When I ask, read the latest messages of my Slack channel and email me a short brief. Ask me before it is sent.",
        start: { how: "manual", when: "" },
        flow: ["slack-channel", "ask-approval", ["email-me", { title: "Your Slack channel brief" }]],
      },
      {
        id: "dev-digest", title: "Weekly Dev Digest", body: "Every Monday: reads your GitHub notifications and PagerDuty incidents and emails you one digest.",
        request: "Every Monday at 9:00, read my GitHub notifications and PagerDuty incidents and email me one digest. Ask me before it is sent.",
        start: { how: "schedule", when: "Every Monday at 9:00" }, schedule: { frequency: "weekly", weekday: 1, hour: 9, minute: 0 },
        flow: ["github-notifications", "pagerduty-incidents", "ask-approval", ["email-me", { title: "Your weekly dev digest" }]],
      },
    ],
  },
  {
    id: "freelancer-safety-net", name: "Freelancer safety net", icon: "ShieldCheck",
    blurb: "Catch unpaid extra work, balance a heavy week and walk into every meeting prepared.",
    connections: ["slack", "linear", "google", "gmailsend"],
    skills: ["slack-requests", "linear-untracked", "calendar-busy-days", "linear-light-days", "calendar-today", "gmail-urgent-text", "prep-card", "ask-approval", "email-me"],
    workflows: [
      {
        id: "scope-creep-alarm", title: "Scope Creep Alarm", body: "When you ask: reads what your client asked for in one Slack channel, compares it with your open Linear tasks and emails you the requests that have NO task, so you can clarify the scope before doing unpaid work. First change the channel name in the first Ask the AI step.",
        request: "When I ask, read what my client asked for in Slack, find the requests with no Linear task and email them to me. Ask me before it is sent.",
        start: { how: "manual", when: "" },
        flow: ["slack-requests", "linear-untracked", "ask-approval", ["email-me", { title: "Possible untracked work", details: "{answer}" }]],
      },
      {
        id: "week-balancer", title: "Week Balancer", body: "Every Monday: finds your busiest and lightest days this week, then matches 3 of your open Linear tasks to the lightest days and emails you the plan.",
        request: "Every Monday at 8:00, find my busy and light days, match three open tasks to the light days and email me the plan. Ask me before it is sent.",
        start: { how: "schedule", when: "Every Monday at 8:00" }, schedule: { frequency: "weekly", weekday: 1, hour: 8, minute: 0 },
        flow: ["calendar-busy-days", "linear-light-days", "ask-approval", ["email-me", { title: "Your week, balanced", details: "{answer}" }]],
      },
      {
        id: "meeting-rescue-brief", title: "Meeting-Day Rescue Brief", body: "Every weekday morning: lists today's meetings, looks in your newest emails for anything urgent or unhappy, and emails you a 3-bullet prep card. The opening text of your 5 newest emails goes to the AI (Groq).",
        request: "Every weekday at 8:00, list today's meetings, find urgent or unhappy emails and email me a 3-bullet prep card. Ask me before it is sent.",
        start: { how: "schedule", when: "Every weekday at 8:00" }, schedule: { frequency: "weekdays", weekday: 1, hour: 8, minute: 0 },
        flow: ["calendar-today", "gmail-urgent-text", "prep-card", "ask-approval", ["email-me", { title: "Your meeting prep card", details: "{answer}" }]],
      },
    ],
  },
];

export const SKILL_IDS = SKILLS.map((one) => one.id);
export const BUNDLE_IDS = BUNDLES.map((one) => one.id);

// An id from outside (an address, a button) only counts if it is really one of ours ("__proto__" is just "not found").
export const findSkill = (id) => (typeof id === "string" ? SKILLS.find((one) => one.id === id) ?? null : null);
export const findBundle = (id) => (typeof id === "string" ? BUNDLES.find((one) => one.id === id) ?? null : null);

// "write" (it sends, creates or adds something: always behind an Approve click), "read" (it only looks at one of your apps or one web page), "think" (the AI
// only writes text, nothing is read) or "control" (a stop sign).
const WRITE_KINDS = new Set(["action", "issue", "row"]);
export const accessOf = (one) => (WRITE_KINDS.has(one.step.kind) ? "write" : one.step.kind === "approve" ? "control" : one.step.fields.uses === "nothing" ? "think" : "read");

// A connection id (from the app list or the Composio list) -> { id, name, own, unavailable? } or null.
export function connectionInfo(id) {
  const own = APP_LIST.find((app) => app.id === id);
  if (own) return { id, name: own.name, own: true };
  const more = COMPOSIO_APPS.find((app) => app.id === id);
  return more ? { id, name: more.name, own: false, unavailable: more.unavailable ?? "" } : null;
}

// The steps of a bundle workflow: the Start step, then every skill's step with this workflow's changes applied, all rebuilt by the normal checks.
// Returns { name, prompt, steps } or null when anything is not valid (a test makes sure that never happens).
export function buildWorkflow(bundle, workflow) {
  const raw = [step("trigger", { ...workflow.start })];
  for (const entry of workflow.flow) {
    const [id, changes] = Array.isArray(entry) ? entry : [entry, {}];
    const one = findSkill(id);
    if (!one || !bundle.skills.includes(id)) return null;
    raw.push({ kind: one.step.kind, fields: { ...one.step.fields, ...changes } });
  }
  const checked = checkSteps(raw);
  return checked.value ? { name: workflow.title, prompt: workflow.request, steps: checked.value } : null;
}

// A new workflow that starts from ONE skill (the Builder's ?skill=<id>): a Start step ("When I ask"), then the skill. A skill that writes gets an
// "Ask you to approve" step first, and its words are plain ones (an email cannot say {answers} when no AI step came before it). Returns { name, prompt, steps } or null.
export function skillStart(id) {
  const one = findSkill(id);
  if (!one || one.step.kind === "approve") return null;
  const writes = accessOf(one) === "write";
  const raw = [step("trigger", { how: "manual", when: "" })];
  if (writes) raw.push(step("approve", { what: "What is written below, before it happens" }));
  raw.push({ kind: one.step.kind, fields: { ...one.step.fields, ...(one.alone ?? {}) } });
  const checked = checkSteps(raw);
  return checked.value ? { name: one.name, prompt: `When I ask: ${one.about}`.slice(0, 300), steps: checked.value } : null;
}

// What a person is told before turning a bundle on: per skill what it reads and what it writes, which apps it needs, and what each workflow does.
export function describeBundle(bundle) {
  const skills = bundle.skills.map((id) => findSkill(id));
  return {
    id: bundle.id, name: bundle.name, icon: bundle.icon, blurb: bundle.blurb,
    connections: bundle.connections.map((id) => connectionInfo(id)),
    skills: skills.map((one) => ({ id: one.id, name: one.name, icon: one.icon, about: one.about, reads: one.reads, writes: one.writes, access: accessOf(one) })),
    writes: skills.some((one) => accessOf(one) === "write"),
    workflows: bundle.workflows.map((workflow) => {
      const checked = workflow.schedule ? checkSchedule({ ...workflow.schedule, tzOffset: 0 }) : null;
      return { id: workflow.id, title: workflow.title, body: workflow.body, schedule: checked?.value ? describeSchedule(checked.value) : "", steps: workflow.flow.length + 1 };
    }),
  };
}
