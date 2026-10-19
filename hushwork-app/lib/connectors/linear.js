// Asks Linear for the signed-in person's open tasks (read-only: this file can only READ, it has no way to change anything).
// Linear answers questions sent to https://api.linear.app/graphql (GraphQL is just a way of asking for exactly the fields
// you want). The key is handed in (from linear-env.js); `fetchImpl` can be replaced so tests never call the real Linear.
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
      nodes { identifier title state { name } }
    }
  }
}`;

const text = (value, max) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "");

// Returns { ok: true, issues: [{ id, title, state }] } or { ok: false, error }.
export async function fetchLinearIssues({ key, fetchImpl = fetch }) {
  try {
    const response = await fetchImpl("https://api.linear.app/graphql", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: key },
      body: JSON.stringify({ query: QUERY }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.status === 401 || response.status === 403) return { ok: false, error: LINEAR_FAILED.key };
    if (response.status === 429 || response.status >= 500) return { ok: false, error: LINEAR_FAILED.busy };
    const body = await response.json();
    if (!response.ok || body?.errors?.length) return { ok: false, error: LINEAR_FAILED.key };
    const nodes = body?.data?.viewer?.assignedIssues?.nodes;
    if (!Array.isArray(nodes)) return { ok: false, error: LINEAR_FAILED.network };
    return { ok: true, issues: nodes.map((n) => ({ id: text(n?.identifier, 20), title: text(n?.title, 100), state: text(n?.state?.name, 30) })) };
  } catch {
    return { ok: false, error: LINEAR_FAILED.network };
  }
}
