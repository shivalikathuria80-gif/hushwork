// Run with: node --test lib/validate.test.js
// (Node may print a harmless "module type not specified" warning. Do not add "type": "module" to package.json.)
import test from "node:test";
import assert from "node:assert/strict";
import { LIMITS, PASSWORD_BYTES_RULE, checkEmail, checkPassword, checkId, checkPrompt, checkSteps, checkVersion, cleanName, cleanPlan, cleanDraft, defaultName, sameSteps, tidyText } from "./validate.js";
import { ICON_LABELS, ICON_NAMES } from "./ai/icon-names.js";

const goodPlan = JSON.stringify([{ icon: "Clock", title: "Run every morning", detail: "8:00 am, weekdays" }]);

test("email: good and bad", () => {
  assert.equal(checkEmail("  you@company.com ").value, "you@company.com");
  for (const bad of ["", "nope", "a@b", "a b@c.com", "@c.com", 42, null, `${"a".repeat(250)}@c.com`]) {
    assert.ok(checkEmail(bad).error, `should reject ${String(bad).slice(0, 20)}`);
  }
});

test("password when creating: 9 no, 10 yes, 64 yes, 65 no", () => {
  assert.ok(checkPassword("a".repeat(9), true).error);
  assert.ok(checkPassword("a".repeat(10), true).value);
  assert.ok(checkPassword("a".repeat(64), true).value);
  assert.ok(checkPassword("a".repeat(65), true).error);
  assert.ok(checkPassword("", true).error);
  assert.equal(checkPassword("          ", true).value, "          "); // spaces are allowed, never trimmed
});

test("password when creating: also at most 72 BYTES", () => {
  assert.ok(checkPassword("あ".repeat(24), true).value, "24 Japanese letters = 72 bytes is fine");
  assert.ok(checkPassword("あ".repeat(25), true).error, "25 Japanese letters = 75 bytes is too long");
  assert.ok(checkPassword("😀".repeat(18), true).value, "18 emoji = 72 bytes is fine");
  assert.equal(checkPassword("😀".repeat(19), true).error, PASSWORD_BYTES_RULE, "19 emoji = 76 bytes is too long");
  assert.ok(checkPassword("a".repeat(64), true).value, "64 ordinary letters = 64 bytes is fine");
});

test("password when signing in: only needs something typed", () => {
  assert.ok(checkPassword("x", false).value);
  assert.ok(checkPassword("", false).error);
  assert.ok(checkPassword("a".repeat(LIMITS.signInPasswordMax + 1), false).error);
});

test("draft id: a UUID passes, anything else is refused", () => {
  assert.ok(checkId("3f2b8c1e-5d4a-4b7e-9c10-0a1b2c3d4e5f").value);
  for (const bad of ["", "1", "not-a-uuid", "3f2b8c1e5d4a4b7e9c100a1b2c3d4e5f", "3f2b8c1e-5d4a-4b7e-9c10-0a1b2c3d4e5f; drop table", null, 7, {}]) {
    assert.ok(checkId(bad).error, `should reject ${String(bad)}`);
  }
});

test("rename: empty, normal, 80 and 81 characters", () => {
  assert.ok(cleanName("   ").error);
  assert.equal(cleanName("  Invoices ").value, "Invoices");
  assert.ok(cleanName("a".repeat(80)).value);
  assert.ok(cleanName("a".repeat(81)).error);
});

test("default name: short stays, long is cut at a word with ...", () => {
  assert.equal(defaultName("Chase invoices"), "Chase invoices");
  const cut = defaultName("Every weekday at 9am, find invoices more than 7 days overdue and draft a polite reminder for each client.");
  assert.ok(cut.endsWith("..."));
  assert.ok(cut.length <= LIMITS.defaultNameLength + 3);
});

test("draft: a good one is accepted and rebuilt", () => {
  const out = cleanDraft({ prompt: "  Chase invoices ", name: "", plan: goodPlan });
  assert.deepEqual(out.value, { name: "Chase invoices", prompt: "Chase invoices", plan: [{ icon: "Clock", title: "Run every morning", detail: "8:00 am, weekdays" }] });
});

test("draft: extra fields on steps are dropped", () => {
  const plan = JSON.stringify([{ icon: "Clock", title: "a", detail: "b", user_id: "x", evil: true }]);
  assert.deepEqual(Object.keys(cleanDraft({ prompt: "p", plan }).value.plan[0]), ["icon", "title", "detail"]);
});

test("draft: bad input is refused", () => {
  assert.ok(cleanDraft({ prompt: "   ", plan: goodPlan }).error, "empty prompt");
  assert.ok(cleanDraft({ prompt: "a".repeat(LIMITS.promptMax + 1), plan: goodPlan }).error, "2001-character prompt");
  assert.ok(cleanDraft({ prompt: "p", plan: "not json" }).error, "plan not json");
  assert.ok(cleanDraft({ prompt: "p", plan: JSON.stringify({ icon: "Clock" }) }).error, "plan not an array");
  assert.ok(cleanDraft({ prompt: "p", plan: "[]" }).error, "empty plan");
  const step = { icon: "Clock", title: "a", detail: "b" };
  assert.ok(cleanDraft({ prompt: "p", plan: JSON.stringify(Array(13).fill(step)) }).error, "13 steps");
  assert.ok(cleanDraft({ prompt: "p", plan: JSON.stringify([{ ...step, title: 5 }]) }).error, "non-string field");
  assert.ok(cleanDraft({ prompt: "p", plan: JSON.stringify([{ ...step, detail: "x".repeat(201) }]) }).error, "long detail");
  assert.ok(cleanDraft({ prompt: "p", plan: JSON.stringify([{ ...step, icon: "<script>" }]) }).error, "odd icon name");
  assert.ok(cleanDraft({ prompt: "p", plan: JSON.stringify(["text"]) }).error, "step not an object");
  assert.ok(cleanDraft({ prompt: "p", name: "n".repeat(81), plan: goodPlan }).error, "name too long");
  assert.ok(cleanDraft(null).error, "null input");
});

test("prompt: trimmed, 1 to 2000 characters, with a code the screen can use", () => {
  assert.equal(checkPrompt("  Chase invoices ").value, "Chase invoices");
  assert.equal(checkPrompt("a".repeat(LIMITS.promptMax)).value.length, LIMITS.promptMax);
  for (const empty of ["", "   ", null, 5, {}]) assert.equal(checkPrompt(empty).code, "empty");
  const long = checkPrompt("a".repeat(LIMITS.promptMax + 1));
  assert.equal(long.code, "too_long");
  assert.equal(long.error, `Use ${LIMITS.promptMax} characters or fewer.`);
  assert.equal(cleanDraft({ prompt: "   ", plan: goodPlan }).error, "Write a request first.", "saving a draft says the same as before");
});

test("plan: cleanPlan is the strict gate (exported for the AI)", () => {
  assert.deepEqual(cleanPlan(goodPlan).value, [{ icon: "Clock", title: "Run every morning", detail: "8:00 am, weekdays" }]);
  assert.ok(cleanPlan("[]").error);
  assert.ok(cleanPlan(JSON.stringify(Array(13).fill({ icon: "Clock", title: "a", detail: "b" }))).error);
  assert.ok(cleanPlan(JSON.stringify([{ icon: "Clock", title: "a".repeat(201), detail: "b" }])).error);
});

test("prompt: text made only of zero-width characters counts as empty (it cannot spend an AI plan)", () => {
  for (const hidden of ["\u{200b}", "\u{200b}\u{200c}\u{200d}", "\u{feff}", "  \u{200b} \u{feff} "]) assert.equal(checkPrompt(hidden).code, "empty", JSON.stringify(hidden));
  assert.equal(checkPrompt("\u{feff}  Chase\u{200b} invoices ").value, "Chase invoices");
  assert.equal(cleanDraft({ prompt: "\u{200b}\u{200b}", plan: goodPlan }).error, "Write a request first.");
});

// ---- the step editor's rules: tidyText, checkSteps, checkVersion (the browser and the server run the same functions) ----

const good = { icon: "Clock", title: "Run every morning", detail: "8:00 am" };

test("tidyText: removes invisible and direction-flipping characters, one space for any run of whitespace or control characters", () => {
  assert.equal(tidyText("  Run\n every\tday  "), "Run every day");
  assert.equal(tidyText("a\u0000b\u0007c\u007fd\u0085e\u009ff"), "a b c d e f", "C0, DEL and C1 controls become a space");
  assert.equal(tidyText("a\u2028b\u2029c\u00a0d"), "a b c d", "line and paragraph separators and non-breaking spaces");
  assert.equal(tidyText("Pay \u202eevil\u202c now \u2066x\u2069"), "Pay evil now x", "bidi controls");
  assert.equal(tidyText("a\u200bb\u200cc\u200dd\ufeffe"), "abcde", "zero-width characters are removed, not turned into spaces");
  assert.equal(tidyText("a \u200b b"), "a b", "removing a zero-width character never leaves a double space");
  assert.equal(tidyText("ab\ud800cd"), "ab�cd", "a lone surrogate (the database refuses it) is replaced");
  assert.equal(tidyText("\u{1f600} ok \u{4e2d}\u{6587}"), "\u{1f600} ok \u{4e2d}\u{6587}", "real emoji and CJK stay");
  for (const notText of [null, undefined, 5, {}, [], true]) assert.equal(tidyText(notText), "");
});

test("tidyText: idempotent, and it never cuts text short", () => {
  for (const sample of ["  a \u200b b\n", "x\u0000y", "\u202e\u202c", "ab\ud800", "plain", ""]) {
    const once = tidyText(sample);
    assert.equal(tidyText(once), once, JSON.stringify(sample));
  }
  assert.equal(tidyText("x".repeat(5000)).length, 5000);
});

test("checkSteps: 0, 1, 12 and 13 steps", () => {
  assert.equal(checkSteps([]).field, "steps");
  assert.match(checkSteps([]).error, /at least 1 step/);
  assert.equal(checkSteps([good]).value.length, 1);
  assert.equal(checkSteps(Array(12).fill(good)).value.length, 12);
  assert.match(checkSteps(Array(13).fill(good)).error, /up to 12 steps/);
  for (const notAList of [null, undefined, "x", 5, {}, { length: 2 }]) assert.ok(checkSteps(notAList).error, String(notAList));
});

test("checkSteps: title is required (after cleaning) and at most 200 characters", () => {
  for (const empty of ["", "   ", "\u200b\u200b", "\n\t", "\u0000"]) {
    const out = checkSteps([good, { ...good, title: empty }]);
    assert.equal(out.error, "Step 2 needs a title.", JSON.stringify(empty));
    assert.equal(out.index, 1);
    assert.equal(out.field, "title");
  }
  assert.ok(checkSteps([{ ...good, title: "a".repeat(200) }]).value, "200 is fine");
  const long = checkSteps([{ ...good, title: "a".repeat(201) }]);
  assert.equal(long.error, "Step 1: use 200 characters or fewer in the title.");
  assert.equal(long.problems[0].over, 1);
  assert.ok(checkSteps([{ ...good, title: " " + "a".repeat(200) + " " }]).value, "spaces around 200 characters do not count");
});

test("checkSteps: detail may be empty, at most 200 characters", () => {
  assert.equal(checkSteps([{ ...good, detail: "" }]).value[0].detail, "");
  assert.ok(checkSteps([{ ...good, detail: "b".repeat(200) }]).value);
  const out = checkSteps([{ ...good, detail: "b".repeat(201) }]);
  assert.equal(out.error, "Step 1: use 200 characters or fewer in the detail.");
  assert.equal(out.field, "detail");
  assert.equal(out.problems[0].over, 1);
});

test("checkSteps: an icon that is not in the list becomes Sparkles; odd or non-text icons are refused", () => {
  for (const unknown of ["Rocket", "constructor", "toString", "valueOf", "hasOwnProperty", ""]) {
    assert.equal(checkSteps([{ ...good, icon: unknown }]).value[0].icon, "Sparkles", unknown);
  }
  for (const name of ICON_NAMES) assert.equal(checkSteps([{ ...good, icon: name }]).value[0].icon, name);
  for (const bad of ["<script>", "x y", "a-b", "__proto__", "A".repeat(41), 7, null, undefined, {}, ["Clock"]]) {
    const out = checkSteps([{ ...good, icon: bad }]);
    assert.ok(out.error, `should refuse ${String(bad).slice(0, 12)}`);
    assert.equal(out.field, "icon");
  }
});

test("checkSteps: text that is not text, and steps that are not objects, are refused", () => {
  for (const bad of [{ ...good, title: 5 }, { ...good, detail: null }, { ...good, title: undefined }, "text", null, 7, ["Clock", "a", "b"]]) {
    assert.ok(checkSteps([bad]).error, JSON.stringify(bad));
  }
});

test("checkSteps: every step is rebuilt from scratch (extra keys go nowhere) and the text is tidied", () => {
  const out = checkSteps([{ icon: "Clock", title: "  Run\u200b now ", detail: "a\u0000b", user_id: "x", evil: true, key: 4 }]);
  assert.deepEqual(out.value, [{ icon: "Clock", title: "Run now", detail: "a b" }]);
  assert.deepEqual(Object.keys(out.value[0]), ["icon", "title", "detail"]);
  const fromJson = cleanPlan('[{"icon":"Clock","title":"t","detail":"d","__proto__":{"polluted":1},"user_id":"x"}]');
  assert.deepEqual(fromJson.value, [{ icon: "Clock", title: "t", detail: "d" }]);
  assert.equal({}.polluted, undefined, "nothing leaked onto Object.prototype");
});

test("checkSteps: lists every problem, in order, for the editor to show under each field", () => {
  const out = checkSteps([{ ...good, title: "" }, good, { ...good, title: "t".repeat(230), detail: "d".repeat(210) }]);
  assert.deepEqual(out.problems.map((p) => [p.index, p.field, p.kind, p.over]), [[0, "title", "empty", undefined], [2, "title", "long", 30], [2, "detail", "long", 10]]);
  assert.equal(out.error, out.problems[0].error);
  assert.equal(out.index, 0);
});

test("checkSteps: running it on its own output changes nothing", () => {
  const messy = [{ icon: "Rocket", title: " Run\n\u200bnow ", detail: "x\u0000y" }, { icon: "Mail", title: "Send", detail: "" }];
  const once = checkSteps(messy).value;
  assert.deepEqual(checkSteps(once).value, once);
  assert.deepEqual(cleanPlan(JSON.stringify(once)).value, once);
});

test("cleanPlan: an empty title is now refused (it used to pass)", () => {
  assert.equal(cleanPlan(JSON.stringify([{ icon: "Clock", title: "", detail: "d" }])).error, "Step 1 needs a title.");
  assert.equal(cleanPlan(JSON.stringify([{ icon: "Clock", title: " \u200b ", detail: "d" }])).error, "Step 1 needs a title.");
  assert.equal(cleanDraft({ prompt: "p", plan: JSON.stringify([{ icon: "Clock", title: "", detail: "" }]) }).error, "Step 1 needs a title.");
  for (const unreadable of ["", "nope", "{", "null", "5", '"x"', "{}", undefined, 5, null]) assert.ok(cleanPlan(unreadable).error, String(unreadable));
});

test("cleanPlan: control characters are cleaned away, so they can no longer push a plan past the database's size rule (QA N5)", () => {
  const step = { icon: "Clock", title: "\u0000".repeat(199) + "t", detail: "\u0001".repeat(200) };
  const stuffed = JSON.stringify(Array(12).fill(step));
  assert.ok(stuffed.length > 20000, "as sent, this was over the database's 20,000-byte rule");
  const out = cleanPlan(stuffed);
  assert.equal(out.value.length, 12);
  assert.deepEqual(out.value[0], { icon: "Clock", title: "t", detail: "" }, "runs of control characters collapse to nothing at the ends of the text");
  assert.ok(JSON.stringify(out.value).length < 1000);
});

test("the browser and the server agree: whatever the editor can send, the server accepts and rebuilds the same", () => {
  // A tiny seeded random generator, so a failure can be repeated.
  let seed = 20261017;
  const random = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const pick = (list) => list[Math.floor(random() * list.length)];
  const pieces = ["a", "b", " ", "  ", "\n", "\t", "\u0000", "\u200b", "\ufeff", "\u202e", "\u2066", "\u2028", "\u00a0", "\u200e", "\u061c", "\u2060", "\u00ad", "\u3164", "\u2800", "\u{1f600}", "\u{4e2d}", "\ud800", "x".repeat(40), '"', "\\", "</b>", "{}", "constructor"];
  const text = () => { let out = ""; for (let n = Math.floor(random() * (random() < 0.15 ? 12 : 5)); n > 0; n--) out += pick(pieces); return out; };
  const icons = [...ICON_NAMES, "Rocket", "constructor", "", "x y", "<b>", 7, null, "A".repeat(45)];
  let accepted = 0;
  for (let round = 0; round < 600; round++) {
    const steps = Array.from({ length: Math.floor(random() * 15) }, () => ({ icon: pick(icons), title: text(), detail: text(), key: round }));
    const browser = checkSteps(steps);
    const server = cleanPlan(JSON.stringify(steps));
    if (browser.value) {
      accepted++;
      assert.deepEqual(server.value, browser.value, "accepted steps are identical on both sides");
      assert.deepEqual(cleanPlan(JSON.stringify(browser.value)).value, browser.value, "and sending the editor's cleaned result is accepted unchanged");
    } else {
      assert.equal(server.error, browser.error, "refused on both sides, with the same sentence");
    }
  }
  assert.ok(accepted > 20, `the generator should produce plenty of acceptable plans (got ${accepted})`);
});

test("size: the longest plan the rules allow stays far below the database's 20,000-byte limit", () => {
  const DATABASE_LIMIT = 20000;
  // The database counts the bytes of the plan as text. jsonb text adds a space after each colon and comma; 8 per step is generous.
  const bytes = (steps) => Buffer.byteLength(JSON.stringify(steps), "utf8") + steps.length * 8;
  const worst = (character) => checkSteps(Array.from({ length: LIMITS.planSteps }, () => ({ icon: "FolderInput", title: character.repeat(LIMITS.stepText / character.length), detail: character.repeat(LIMITS.stepText / character.length) }))).value;
  // CJK: 3 bytes for each of 200 characters. Emoji: 4 bytes, each 2 characters long. Quotes and backslashes are escaped (2 bytes each).
  for (const [name, character] of [["CJK", "\u{4e2d}"], ["emoji", "\u{1f600}"], ["quotes", '"'], ["backslashes", "\\"], ["replacement characters", "�"]]) {
    const steps = worst(character);
    assert.ok(steps, name);
    assert.ok(bytes(steps) < DATABASE_LIMIT, `${name}: ${bytes(steps)} bytes`);
  }
  assert.ok(bytes(worst("\u{4e2d}")) < 16000, "the documented worst case is about 15,300 bytes");
  // A plan of NUL characters used to pass the app and fail in the database at 29,304 bytes. Now they are removed.
  assert.equal(checkSteps([{ icon: "Clock", title: "t", detail: "\u0000".repeat(200) }]).value[0].detail, "");
});

test("checkVersion: real timestamps pass; anything else is refused", () => {
  for (const ok of ["2026-10-17T10:15:30.123456+00:00", "2026-10-17T10:15:30+00:00", "2026-10-17T10:15:30.1Z", "2026-10-17T10:15:30.12345+05:30", "2026-10-17 10:15:30.123456+00", "2026-10-17T10:15:30.123456-0800"]) {
    assert.equal(checkVersion(ok).value, ok, ok);
  }
  for (const bad of ["", "x", ", or(id.eq.1)", "2026-10-17", "2026-10-17T10:15:30.1234567+00:00", "2026-10-17T10:15:30+00:00; drop table", 20261017, null, undefined, {}, "2".repeat(41)]) {
    assert.ok(checkVersion(bad).error, `should refuse ${String(bad)}`);
  }
});

test("sameSteps: moving a step away and back, or extra spaces, is no change", () => {
  const a = [good, { icon: "Mail", title: "Send", detail: "" }];
  assert.equal(sameSteps(a, [{ ...good }, { icon: "Mail", title: " Send ", detail: "", key: 9 }]), true);
  assert.equal(sameSteps(a, [a[1], a[0]]), false, "a different order is a change");
  assert.equal(sameSteps(a, [a[0]]), false, "a different length is a change");
  assert.equal(sameSteps(a, [good, { icon: "Mail", title: "Send", detail: "x" }]), false);
  assert.equal(sameSteps([{ ...good, icon: "Rocket" }], [{ ...good, icon: "Sparkles" }]), true, "an unknown icon is stored as Sparkles, so it is the same");
});

test("icon labels: every icon the editor offers has a plain name, and nothing else is listed", () => {
  assert.deepEqual(Object.keys(ICON_LABELS).sort(), [...ICON_NAMES].sort());
  for (const label of Object.values(ICON_LABELS)) assert.ok(label.length > 0 && label.length <= 14, label);
  assert.equal(ICON_NAMES.length, 32);
});

// Every character below shows nothing on screen. A title made only of them must count as EMPTY (QA round 3, n1).
const INVISIBLE_CHARACTERS = {
  "left-to-right mark": "\u200e", "right-to-left mark": "\u200f", "Arabic letter mark": "\u061c",
  "word joiner": "\u2060", "function application": "\u2061", "invisible times": "\u2062", "invisible separator": "\u2063", "invisible plus": "\u2064",
  "deprecated format (start)": "\u206a", "deprecated format (end)": "\u206f", "soft hyphen": "\u00ad", "Mongolian vowel separator": "\u180e",
  "embedding start": "\u202a", "embedding right": "\u202b", "pop direction": "\u202c", "override left": "\u202d", "override right": "\u202e",
  "isolate left": "\u2066", "isolate right": "\u2067", "isolate first strong": "\u2068", "pop isolate": "\u2069",
  "zero-width space": "\u200b", "zero-width non-joiner": "\u200c", "zero-width joiner": "\u200d", "byte order mark": "\ufeff",
  "language tag": "\u{e0001}", "tag letter": "\u{e0041}", "Hangul filler": "ㅤ", "blank braille": "⠀",
};

test("tidyText: invisible characters go (not turned into spaces), so a title made only of them needs a title", () => {
  for (const [name, mark] of Object.entries(INVISIBLE_CHARACTERS)) {
    assert.equal(tidyText(mark), "", name);
    assert.equal(tidyText(`a${mark}b`), "ab", `${name} inside a word`);
    const refused = checkSteps([good, { ...good, title: ` ${mark}${mark} ` }]);
    assert.equal(refused.error, "Step 2 needs a title.", name);
    assert.equal(refused.problems[0].kind, "empty", name);
    assert.equal(checkSteps([{ ...good, detail: mark }]).value[0].detail, "", `${name} as a whole detail is fine and empty`);
  }
  const all = Object.values(INVISIBLE_CHARACTERS).join(" ");
  assert.equal(tidyText(all), "");
  assert.equal(checkSteps([{ ...good, title: all }]).error, "Step 1 needs a title.");
  assert.equal(cleanPlan(JSON.stringify([{ ...good, title: all }])).error, "Step 1 needs a title.", "the server refuses it too");
});

test("tidyText: visible text in other scripts, emoji and look-alike marks that do show are left alone", () => {
  for (const text of ["Café über", "中文 日本語", "שלום", "مرحبا", "\u{1f600} ok", "tatweel ـ", "braille ⠁", "가", "café"]) {
    assert.equal(tidyText(text), text, JSON.stringify(text));
  }
  assert.equal(tidyText("  café \u200e 中  "), "café 中", "only the invisible one goes; the spaces around it collapse");
});

test("tidyText: control characters and size behave as before (a NUL-stuffed plan still cleans down)", () => {
  assert.equal(tidyText("a\u0000\u0001\u001fb\u007fc\u0085d"), "a b c d");
  const nulls = checkSteps([{ ...good, title: "\u0000".repeat(199) + "t", detail: "\u200e".repeat(200) }]);
  assert.deepEqual(nulls.value, [{ icon: "Clock", title: "t", detail: "" }]);
  assert.ok(JSON.stringify(nulls.value).length < 100);
});
