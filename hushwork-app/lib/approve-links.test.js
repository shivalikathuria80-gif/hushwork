import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SETTINGS, LINK_LIFE_MS, MAX_ITEMS, approveUrl, checkSettings, digestDue, linkProblem, looksLikeApproveCode, makeApproveCode, noticeText, pushPayload, readSettings, sha256, slackText } from "./approve-links.js";
import { localDayStartMs, localHour } from "./watch-rules.js";

const SITE = "https://hushwork.test";

test("codes: long, random, recognisable; only the hash is meant to be kept", () => {
  const a = makeApproveCode();
  const b = makeApproveCode();
  assert.ok(looksLikeApproveCode(a.code) && looksLikeApproveCode(b.code));
  assert.notEqual(a.code, b.code);
  assert.equal(a.hash, sha256(a.code));
  assert.match(a.hash, /^[0-9a-f]{64}$/);
  for (const bad of ["", "hwa_short", `hwl_${"a".repeat(43)}`, `hwa_${"a".repeat(42)}!`, null, 5]) assert.equal(looksLikeApproveCode(bad), false, String(bad));
  assert.equal(approveUrl(`${SITE}/`, a.code), `${SITE}/a/${a.code}`);
});

test("a link works once and for 48 hours", () => {
  const now = Date.parse("2026-11-10T09:00:00Z");
  const row = { expires_at: new Date(now + LINK_LIFE_MS).toISOString(), used_at: null };
  assert.equal(linkProblem(row, now), null);
  assert.equal(linkProblem({ ...row, used_at: "2026-11-10T08:00:00Z" }, now), "used");
  assert.equal(linkProblem(row, now + LINK_LIFE_MS), "expired");
  assert.equal(linkProblem({ ...row, expires_at: "nonsense" }, now), "expired");
  assert.equal(linkProblem(null, now), "unknown");
});

test("settings: a missing row means Hushwork's old behaviour (email only, no links, each time); the form is checked", () => {
  assert.deepEqual(readSettings(null), { ...DEFAULT_SETTINGS });
  assert.equal(readSettings(null).links, false, "links are opt-in");
  const read = readSettings({ email: false, slack: true, slack_to: "U04ABCDE12", push: true, links: true, digest: true, digest_hour: 23, tz_offset: 330 });
  assert.equal(read.digestHour, 9, "a night-time digest hour is never used");
  assert.equal(read.slack, true);
  assert.equal(readSettings({ slack: true, slack_to: "#general" }).slack, false, "Slack goes to a person's direct messages only, never a channel");
  assert.ok(checkSettings({ email: false, slack: false, push: false }).error, "at least one way to tell you");
  assert.ok(checkSettings({ email: true, slack: true, slackTo: "general" }).error, "a channel is refused");
  assert.ok(checkSettings({ email: true, digest: true, digestHour: 21 }).error, "no digest at night");
  assert.deepEqual(checkSettings({ email: true, slack: true, slackTo: " u04abcde12 ", links: true, digest: true, digestHour: 8, tzOffset: 330 }).value, { email: true, slack: true, slack_to: "U04ABCDE12", push: false, links: true, digest: true, digest_hour: 8, tz_offset: 330 });
});

const items = [
  { workflow: "Lead replies", title: "Email the lead", step: 3, url: `${SITE}/a/hwa_x`, willDo: "SECRET DRAFT TEXT" },
  { workflow: "Invoices", title: "Post in Slack", step: 2, willDo: "SECRET 2" },
];

test("the words name steps by their titles only: never what a step would send", () => {
  for (const text of [noticeText({ reason: "arrived", name: "Lead replies", items, siteUrl: SITE }), slackText({ reason: "digest", items, siteUrl: SITE }), JSON.stringify(pushPayload({ reason: "waiting", name: "Lead replies", items, siteUrl: SITE }))]) {
    assert.ok(!text.includes("SECRET"), text);
    assert.ok(text.includes("Email the lead"));
  }
  const email = noticeText({ reason: "arrived", name: "Lead replies", items, siteUrl: SITE });
  assert.match(email, /^Something arrived at the start link of "Lead replies", and 2 steps are waiting for you\./);
  assert.ok(email.includes(`Read the exact words and approve: ${SITE}/a/hwa_x`));
  assert.ok(email.includes("Nothing is approved until you press Approve there"));
  assert.ok(email.includes(`${SITE}/app/runs`));
  const plain = noticeText({ reason: "waiting", name: "X", items: [{ title: "Send", step: 1 }], siteUrl: SITE });
  assert.ok(!/\/a\//.test(plain) && plain.includes("Nothing was approved or sent for you."), "no links when they are off");
  assert.match(slackText({ reason: "digest", items, siteUrl: SITE }), /<https:\/\/hushwork\.test\/a\/hwa_x\|Review and approve>/);
  assert.ok(!slackText({ reason: "digest", items: [{ workflow: "<!channel>", title: "a <@U1> b", step: 1 }], siteUrl: SITE }).includes("<!channel>"), "nobody can make it ping a channel");
});

test("push: one tap opens the single step's page, or Runs when there are several", () => {
  assert.equal(pushPayload({ reason: "arrived", name: "L", items: [items[0]], siteUrl: SITE }).url, `${SITE}/a/hwa_x`);
  assert.equal(pushPayload({ reason: "arrived", name: "L", items, siteUrl: SITE }).url, `${SITE}/app/runs`);
  assert.match(pushPayload({ reason: "arrived", name: "L", items, siteUrl: SITE }).body, /and 1 more/);
});

test("long lists are cut to 10 steps, the rest counted", () => {
  const many = Array.from({ length: MAX_ITEMS + 3 }, (_, i) => ({ workflow: "W", title: `Step ${i}`, step: i }));
  const text = noticeText({ reason: "digest", items: many, siteUrl: SITE });
  assert.match(text, /^13 steps are waiting for your OK\./);
  assert.ok(text.includes("and 3 more on the Runs page"));
});

test("the digest is due once a day, at the person's own hour", () => {
  const helpers = { localHour, localDayStartMs };
  const india9 = Date.parse("2026-11-10T03:30:00Z"); // 09:00 in India
  const settings = { digest: true, digestHour: 9, tzOffset: 330, lastDigestAt: null };
  assert.equal(digestDue(settings, india9, helpers), true);
  assert.equal(digestDue({ ...settings, lastDigestAt: "2026-11-10T03:31:00Z" }, india9 + 10 * 60_000, helpers), false, "already sent today");
  assert.equal(digestDue({ ...settings, lastDigestAt: "2026-11-09T03:31:00Z" }, india9, helpers), true, "yesterday's does not count");
  assert.equal(digestDue({ ...settings, tzOffset: 0 }, india9, helpers), false, "03:30 in London is not 9");
  assert.equal(digestDue({ ...settings, digest: false }, india9, helpers), false);
});
