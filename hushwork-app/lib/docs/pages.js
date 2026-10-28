// The list of pages on the docs site (docs.hushwork.in, also served at /docs). Each page is one markdown file in content/docs/<slug>.md.
// The order here is the order in the side menu and the "Next" links. Add a page by adding a line here AND the file (a test checks both).
export const DOC_GROUPS = [
  {
    title: "Getting started",
    pages: [
      { slug: "welcome", title: "What is Hushwork?" },
      { slug: "quick-start", title: "Your first 5 minutes" },
      { slug: "how-it-works", title: "How Hushwork works" },
    ],
  },
  {
    title: "Using Hushwork",
    pages: [
      { slug: "workspace", title: "The workspace: describe a chore" },
      { slug: "builder", title: "The Builder and its blocks" },
      { slug: "templates", title: "Templates" },
      { slug: "skills-and-bundles", title: "Skills and bundles" },
      { slug: "runs-and-approvals", title: "Runs and Approve" },
      { slug: "schedules", title: "Schedules" },
      { slug: "watch-mode", title: "Watch mode" },
      { slug: "memory", title: "Memory" },
      { slug: "account", title: "Your account and your data" },
    ],
  },
  {
    title: "Connections",
    pages: [
      { slug: "connections", title: "Connections overview" },
      { slug: "connect-google", title: "Google (Gmail, Calendar, Drive, Sheets)" },
      { slug: "connect-linear", title: "Linear" },
      { slug: "connect-google-workspace", title: "Google Workspace through Composio" },
      { slug: "connect-other-apps", title: "More apps through Composio" },
    ],
  },
  {
    title: "Safety and privacy",
    pages: [
      { slug: "safety", title: "How Hushwork keeps you in control" },
      { slug: "privacy", title: "Privacy and what the AI sees" },
      { slug: "limits", title: "Limits and numbers" },
    ],
  },
  {
    title: "Reference",
    pages: [
      { slug: "step-types", title: "Step types" },
      { slug: "ai-writing", title: "Ask the AI and earlier answers" },
      { slug: "glossary", title: "Glossary" },
      { slug: "troubleshooting", title: "Troubleshooting and FAQ" },
    ],
  },
];

export const DOC_PAGES = DOC_GROUPS.flatMap((group) => group.pages.map((page) => ({ ...page, group: group.title })));

// An id from outside (an address) only counts if it is really one of ours ("__proto__" is just "not found").
export const findDocPage = (slug) => (typeof slug === "string" ? DOC_PAGES.find((page) => page.slug === slug) ?? null : null);

// The page before and after, for the "Previous / Next" links.
export function neighbours(slug) {
  const index = DOC_PAGES.findIndex((page) => page.slug === slug);
  return { previous: index > 0 ? DOC_PAGES[index - 1] : null, next: index >= 0 && index < DOC_PAGES.length - 1 ? DOC_PAGES[index + 1] : null };
}
