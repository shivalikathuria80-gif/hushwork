// Creates ONE task (an "issue") in Linear. This is the only thing in this file that writes: one fixed request called
// issueCreate, with the title and details sent as separate values (never glued into the request text), so what a person or
// the AI writes can never change what the request does. It also asks which teams exist (a read) so the task can go to the team
// the step names (its short key, like ENG) or, when the step names none, to the person's first team.
// Linear answers questions sent to https://api.linear.app/graphql. The Authorization value is handed in: a personal key as it is
// (linear-env.js) or "Bearer <token>" for a person who used the Connect button; the Connect permission for this is
// "issues:create", which cannot change or delete anything that already exists. `fetchImpl` can be replaced so tests never call the
// real Linear. Failures come back as short fixed sentences, never Linear's own text, and never anything holding a key.

const TIMEOUT_MS = 10_000;
const ENDPOINT = "https://api.linear.app/graphql";

export const LINEAR_CREATE_FAILED = {
  auth: "Linear refused to create the task. Open Connections, press Disconnect under Linear and then Connect Linear again, so Linear asks for the permission to create tasks.",
  team: "Linear could not find that team. Check the team key in the step (for example ENG), or leave it empty to use your first team.",
  busy: "Linear is busy right now. Try again in a minute.",
  network: "Could not reach Linear. Check your connection and try again.",
};

const TEAMS_QUERY = "query { teams(first: 50) { nodes { id key } } }";
const CREATE_MUTATION = "mutation CreateTask($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { identifier url } } }";

const flat = (value, max) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "");

async function ask(authorization, payload, fetchImpl) {
  const response = await fetchImpl(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", authorization },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (response.status === 401 || response.status === 403) return { error: LINEAR_CREATE_FAILED.auth };
  if (response.status === 429 || response.status >= 500) return { error: LINEAR_CREATE_FAILED.busy };
  const body = await response.json();
  if (!response.ok || body?.errors?.length) return { error: LINEAR_CREATE_FAILED.auth };
  return { data: body?.data };
}

// title: required (cut at 200); details: optional (cut at 1500); team: optional team key (letters and digits, up to 10).
// Returns { ok: true, id, url } or { ok: false, error }.
export async function createIssue({ authorization, title, details = "", team = "", fetchImpl = fetch }) {
  const cleanTitle = flat(title, 200);
  if (!cleanTitle) return { ok: false, error: "Write the title of the task in the step first." };
  const key = flat(team, 10).toUpperCase();
  if (key && !/^[A-Z0-9]{1,10}$/.test(key)) return { ok: false, error: LINEAR_CREATE_FAILED.team };
  try {
    const teams = await ask(authorization, { query: TEAMS_QUERY }, fetchImpl);
    if (teams.error) return { ok: false, error: teams.error };
    const nodes = Array.isArray(teams.data?.teams?.nodes) ? teams.data.teams.nodes : [];
    const chosen = key ? nodes.find((node) => typeof node?.key === "string" && node.key.toUpperCase() === key) : nodes[0];
    if (!chosen || typeof chosen.id !== "string" || !/^[0-9a-f-]{36}$/i.test(chosen.id)) return { ok: false, error: LINEAR_CREATE_FAILED.team };

    const input = { teamId: chosen.id, title: cleanTitle };
    const description = typeof details === "string" ? details.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]+/g, " ").trim().slice(0, 1500) : "";
    if (description) input.description = description;
    const created = await ask(authorization, { query: CREATE_MUTATION, variables: { input } }, fetchImpl);
    if (created.error) return { ok: false, error: created.error };
    const issue = created.data?.issueCreate;
    if (!issue?.success || typeof issue.issue?.identifier !== "string") return { ok: false, error: LINEAR_CREATE_FAILED.network };
    const url = typeof issue.issue.url === "string" && issue.issue.url.startsWith("https://linear.app/") ? issue.issue.url.slice(0, 200) : "";
    return { ok: true, id: flat(issue.issue.identifier, 20), url };
  } catch {
    return { ok: false, error: LINEAR_CREATE_FAILED.network };
  }
}
