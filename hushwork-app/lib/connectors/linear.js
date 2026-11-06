// Asks Linear for the signed-in person's open tasks, with each one's due date and priority (read-only: this file can only READ, it has no way to change anything).
// Linear answers questions sent to https://api.linear.app/graphql (GraphQL is just a way of asking for exactly the fields
// you want). The Authorization value is handed in: a personal key as it is (linear-env.js) or "Bearer <token>" for a person who used
// the Connect button (lib/connections/linear-store.js); `fetchImpl` can be replaced so tests never call the real Linear.
// Failures come back as short fixed sentences, never Linear's own error text, and never anything that holds the key.

const TIMEOUT_MS = 10_000;

export const LINEAR_FAILED = {
  key: "Linear refused the key. Check LINEAR_API_KEY in .env.local, then restart the app.",
  busy: "Linear is busy right now. Try again in a minute.",
  network: "Could not reach Linear. Check your connection and try again.",
};

const QUERY = `{
  viewer {
    assignedIssues(first: 10, orderBy: updatedAt, filter: { state: { type: { nin: ["completed", "canceled"] } } }) {
      nodes { identifier title dueDate priority state { name } }
    }
  }
}`;

const text = (value, max) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "");

// Linear's priority is a number: 0 = none, 1 = urgent, 2 = high, 3 = medium, 4 = low. Anything else counts as none.
const PRIORITY = { 1: "Urgent", 2: "High", 3: "Medium", 4: "Low" };
// Linear's dueDate is a day with no time ("2026-11-20"). Anything that is not exactly that shape is dropped.
const day = (value) => (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) ? value : "");

// One task as one line, the way the AI and the Hushwork Agent see it: "ENG-1 Fix the login (In Progress, due 2026-11-20, Urgent)".
export function issueLine(issue) {
  const extra = [issue.state, issue.due ? `due ${issue.due}` : "", issue.priority].filter(Boolean).join(", ");
  return `${issue.id} ${issue.title}${extra ? ` (${extra})` : ""}`;
}

// Returns { ok: true, issues: [{ id, title, state, due, priority }] } or { ok: false, error }. `due` is "YYYY-MM-DD" or "", `priority` a word or "".
export async function fetchLinearIssues({ authorization, fetchImpl = fetch }) {
  try {
    const response = await fetchImpl("https://api.linear.app/graphql", {
      method: "POST",
      headers: { "content-type": "application/json", authorization },
      body: JSON.stringify({ query: QUERY }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.status === 401 || response.status === 403) return { ok: false, error: LINEAR_FAILED.key };
    if (response.status === 429 || response.status >= 500) return { ok: false, error: LINEAR_FAILED.busy };
    const body = await response.json();
    if (!response.ok || body?.errors?.length) return { ok: false, error: LINEAR_FAILED.key };
    const nodes = body?.data?.viewer?.assignedIssues?.nodes;
    if (!Array.isArray(nodes)) return { ok: false, error: LINEAR_FAILED.network };
    return { ok: true, issues: nodes.map((n) => ({ id: text(n?.identifier, 20), title: text(n?.title, 100), state: text(n?.state?.name, 30), due: day(n?.dueDate), priority: PRIORITY[n?.priority] ?? "" })) };
  } catch {
    return { ok: false, error: LINEAR_FAILED.network };
  }
}
