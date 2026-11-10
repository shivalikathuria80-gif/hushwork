// APPROVE FROM A NOTIFICATION: the rules. Plain code with no Next.js and no database (the server and `node --test` load it).
//
// When a step waits for the person's Approve, Hushwork may tell them by email, Slack or a push notification (supabase/notify.sql). If they
// switched it on, each waiting step in that message gets its own "review and approve" link: https://<site>/a/<code>.
//
//   * Opening the link NEVER approves anything (mail scanners and link previews open links by themselves). It opens a page that shows the
//     exact words the step would send, with Approve and Turn down buttons. Only a button press does something.
//   * The page shows the words as they are NOW, and the button hands them back as `seen`: the step is done only if they are still the very
//     same words (lib/run-core.js "changed since you read it"), exactly like the Runs page and the chatbot plugin.
//   * One link = one step of one run, works ONCE, and for 48 hours at most. Only the sha-256 of its code is saved.
//   * The message itself never holds what the step would send (no draft, no AI answer): only the workflow's name and the step's own title,
//     which the person wrote. The words are read on the page, over HTTPS, and nowhere else.
import { createHash, randomBytes } from "node:crypto";

export const APPROVE_PREFIX = "hwa_";
const CODE_SHAPE = /^hwa_[A-Za-z0-9_-]{43}$/;
export const LINK_LIFE_MS = 48 * 60 * 60 * 1000;
export { MAX_ITEMS } from "./approve-words.js";
export const CHANNELS = ["email", "slack", "push"];
export const SLACK_MEMBER = /^[UW][A-Z0-9]{6,15}$/;
export const DIGEST_HOURS = { from: 8, until: 19 }; // inside the waking hours of lib/watch-rules.js, so a digest is never sent at night
export const NOTIFY_SETUP = "Notifications need one setup step that is not done yet. Open supabase/notify.sql and run it in Supabase.";

export const sha256 = (text) => createHash("sha256").update(String(text)).digest("hex");
export const looksLikeApproveCode = (value) => typeof value === "string" && CODE_SHAPE.test(value);

// A new link code: { code, hash }. 32 random bytes (43 letters and digits): far too many to guess.
export function makeApproveCode() {
  const code = `${APPROVE_PREFIX}${randomBytes(32).toString("base64url")}`;
  return { code, hash: sha256(code) };
}

export const approveUrl = (siteUrl, code) => `${String(siteUrl ?? "").replace(/\/$/, "")}/a/${code}`;

// The person's settings, always complete and safe: a missing row (or the table not made yet) means email only, no links, each time, which is
// exactly how Hushwork behaved before this feature.
export const DEFAULT_SETTINGS = Object.freeze({ email: true, slack: false, slackTo: "", push: false, links: false, digest: false, digestHour: 9, tzOffset: 0, lastDigestAt: null, saved: false });
export function readSettings(row) {
  if (!row || typeof row !== "object") return { ...DEFAULT_SETTINGS };
  const hour = Number.isInteger(row.digest_hour) && row.digest_hour >= DIGEST_HOURS.from && row.digest_hour <= DIGEST_HOURS.until ? row.digest_hour : 9;
  const slackTo = typeof row.slack_to === "string" && SLACK_MEMBER.test(row.slack_to) ? row.slack_to : "";
  return {
    email: row.email !== false,
    slack: row.slack === true && Boolean(slackTo),
    slackTo,
    push: row.push === true,
    links: row.links === true,
    digest: row.digest === true,
    digestHour: hour,
    tzOffset: Number.isInteger(row.tz_offset) && Math.abs(row.tz_offset) <= 840 ? row.tz_offset : 0,
    lastDigestAt: typeof row.last_digest_at === "string" ? row.last_digest_at : null,
    saved: true,
  };
}

// What the settings form sends, checked. Returns { value: row } (the columns the person may write) or { error }.
export function checkSettings(input) {
  const on = (key) => input?.[key] === true;
  const slackTo = typeof input?.slackTo === "string" ? input.slackTo.trim().toUpperCase() : "";
  if (on("slack") && !SLACK_MEMBER.test(slackTo)) return { error: "Write your Slack member ID (it starts with U). In Slack: your profile picture, Profile, the three dots, Copy member ID." };
  if (slackTo && !SLACK_MEMBER.test(slackTo)) return { error: "That does not look like a Slack member ID. It starts with U, like U04ABCDE12." };
  const hour = Number(input?.digestHour);
  if (on("digest") && !(Number.isInteger(hour) && hour >= DIGEST_HOURS.from && hour <= DIGEST_HOURS.until)) return { error: "Pick a digest time between 08:00 and 19:00." };
  const tz = Number(input?.tzOffset);
  if (!on("email") && !on("slack") && !on("push")) return { error: "Keep at least one way to tell you, or nothing will reach you when a step waits." };
  return {
    value: {
      email: on("email"), slack: on("slack"), slack_to: slackTo || null, push: on("push"), links: on("links"), digest: on("digest"),
      digest_hour: Number.isInteger(hour) && hour >= DIGEST_HOURS.from && hour <= DIGEST_HOURS.until ? hour : 9,
      tz_offset: Number.isInteger(tz) && Math.abs(tz) <= 840 ? tz : 0,
    },
  };
}

// Is a saved link still good? `row` = { expires_at, used_at }. Returns null, or the reason it is not.
export const LINK_WORDS = {
  unknown: "This link does not work. It may have been cancelled, or it was copied wrong.",
  used: "This link was already used. Each link works once.",
  expired: "This link has expired. Links work for 48 hours.",
  done: "This step is no longer waiting: it was already approved, turned down, or stopped.",
};
export function linkProblem(row, now = Date.now()) {
  if (!row || typeof row !== "object") return "unknown";
  if (row.used_at) return "used";
  const until = Date.parse(row.expires_at);
  if (!Number.isFinite(until) || until <= now) return "expired";
  return null;
}

// The words of the message live in lib/approve-words.js (no Node imports, so the Settings page previews them with the very same code).
export { noticeTitle, noticeText, slackText, pushPayload } from "./approve-words.js";

// Is it time for this person's digest? Their local hour is the digest hour and none was sent since their local midnight.
export function digestDue(settings, now, { localHour, localDayStartMs }) {
  if (!settings?.digest) return false;
  if (localHour(now, settings.tzOffset) !== settings.digestHour) return false;
  const last = Date.parse(settings.lastDigestAt ?? "");
  return !Number.isFinite(last) || last < localDayStartMs(now, settings.tzOffset);
}
