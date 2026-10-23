import test from "node:test";
import assert from "node:assert/strict";
import { CONFIRM_WORDS, deleteAccountCore } from "./account-core.js";

// A pretend all-access client that remembers which accounts it was asked to delete.
function pretendAdmin(answer = { error: null }) {
  const deleted = [];
  return { deleted, auth: { admin: { deleteUser: async (id) => { deleted.push(id); return answer; } } } };
}

test("deleting an account: the words must match, and nothing happens before they do", async () => {
  const admin = pretendAdmin();
  const calls = [];
  for (const confirm of [undefined, null, "", "delete", "delete my acount", "yes", 5, {}]) {
    const result = await deleteAccountCore({ userId: "u1", confirm, admin, disconnectAll: async () => calls.push("disconnect") });
    assert.ok(result.error, String(confirm));
  }
  assert.deepEqual(admin.deleted, [], "no account was deleted");
  assert.deepEqual(calls, [], "no app was disconnected");
});

test("deleting an account: the right words (any capital letters, spaces around) disconnect apps first, then delete exactly that account", async () => {
  const admin = pretendAdmin();
  const order = [];
  const result = await deleteAccountCore({ userId: "u1", confirm: `  ${CONFIRM_WORDS.toUpperCase()} `, admin, disconnectAll: async (id) => order.push(`disconnect ${id}`) });
  assert.deepEqual(result, { ok: true });
  assert.deepEqual(order, ["disconnect u1"]);
  assert.deepEqual(admin.deleted, ["u1"]);
});

test("deleting an account: a failing disconnect does not stop it; a failing delete is a calm sentence with no details; no admin client or no person is refused", async () => {
  const quiet = console.error;
  const lines = [];
  console.error = (...parts) => lines.push(parts.join(" "));
  try {
    const admin = pretendAdmin();
    assert.deepEqual(await deleteAccountCore({ userId: "u1", confirm: CONFIRM_WORDS, admin, disconnectAll: async () => { throw new Error("Composio is down: secret detail"); } }), { ok: true });
    assert.deepEqual(admin.deleted, ["u1"]);

    const broken = pretendAdmin({ error: { status: 500, message: "internal secret detail" } });
    const failed = await deleteAccountCore({ userId: "u1", confirm: CONFIRM_WORDS, admin: broken, disconnectAll: async () => {} });
    assert.match(failed.error, /Could not delete the account/);
    assert.ok(!JSON.stringify(failed).includes("secret detail"));

    assert.match((await deleteAccountCore({ userId: "u1", confirm: CONFIRM_WORDS, admin: null, disconnectAll: async () => {} })).error, /not switched on/);
    assert.match((await deleteAccountCore({ userId: "", confirm: CONFIRM_WORDS, admin: pretendAdmin(), disconnectAll: async () => {} })).error, /not signed in/);
  } finally {
    console.error = quiet;
  }
  assert.ok(lines.every((line) => !line.includes("secret detail")), "details are never logged");
});
