// Deleting an account, as plain testable steps. Whose account is decided by the caller from the signed-in session, never from anything the
// browser sends. Everything the person owns is removed by the database itself when the sign-in row goes (every table says
// "on delete cascade": workflows, runs, schedules, saved connections, usage counters). The apps connected through Composio are
// disconnected first, because they live at Composio and not in our database; if that fails the account is still deleted.

export const CONFIRM_WORDS = "delete my account";

// `admin` is the all-access database client (or null when it is not set up), `disconnectAll(userId)` removes the Composio connections.
// Returns { ok: true } or { error } with a sentence the person can read.
export async function deleteAccountCore({ userId, confirm, admin, disconnectAll }) {
  if (typeof confirm !== "string" || confirm.trim().toLowerCase() !== CONFIRM_WORDS) return { error: `Type the words "${CONFIRM_WORDS}" exactly to confirm.` };
  if (typeof userId !== "string" || !userId) return { error: "You are not signed in." };
  if (!admin) return { error: "Deleting accounts is not switched on for this server yet. Open an issue on the project's GitHub page and it will be done for you." };
  try {
    await disconnectAll(userId);
  } catch {
    console.error("disconnecting apps before deleting an account failed");
  }
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    console.error("deleting an account failed:", error.status ?? error.code ?? "unknown");
    return { error: "Could not delete the account. Nothing was lost; try again in a minute." };
  }
  return { ok: true };
}
