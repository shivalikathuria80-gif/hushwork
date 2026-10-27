import test from "node:test";
import assert from "node:assert/strict";

// schedule-notify.js starts with `import "server-only"`, which only the real app can load, so the pure wording is checked from the source text
// and the sending logic by reading the file's rules.
import fs from "node:fs";
const source = fs.readFileSync(new URL("./schedule-notify.js", import.meta.url), "utf8");

test("the failure notice: names only the workflow, says where to look, is sent through the person's own Gmail connection to their own address, and never throws", () => {
  assert.match(source, /^import "server-only";/m);
  assert.ok(source.includes('findAction("gmail_send")') && source.includes("found?.user?.email"), "to the person's own address, through Gmail (send)");
  assert.ok(source.includes('.eq("user_id", userId)'), "the workflow name is looked up for that person only");
  assert.ok(source.includes("catch {") && source.includes('return "error"'), "a problem is never thrown at the clock");
  const problemNotice = source.slice(0, source.indexOf("// ---- WATCH MODE")); // the watch part below saves its own small "Told you" record, so it is checked in watch-mode.test.js
  assert.ok(!/results|answer|outcome/.test(problemNotice.replace(/\/\/.*$/gm, "")), "nothing from the run itself goes into the email");
  assert.ok(source.indexOf('if (!key || !WHAT[status]) return "off"') < source.indexOf("getUserById"), "nothing is looked up when notices are off");
});
