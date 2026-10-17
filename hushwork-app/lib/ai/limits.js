// Counters that stop one person (or everyone together) from asking for too many AI plans.
// They live in the server's MEMORY: a restart forgets them, and two server copies would each count separately. That is
// fine for one owner on one local server. Before any real deployment, replace them with a database table (see
// docs/plan-next.md section 3). Every function takes `now` (milliseconds) so tests can move the clock by hand.
import { AI_LIMITS } from "./plan.js";

const MINUTE = 60_000;
const DAY = 86_400_000;
const EVERYONE = "everyone";

// A counter for one kind of limit. Keeps the times of recent hits per key. `calendar: true` means "since the start of the
// window" (a UTC day, which begins at midnight UTC); otherwise the window slides back from `now` (the last minute).
// ponytail: keys of people who stop using it linger in the map until they come back; fine for a handful of accounts.
export function makeLimiter({ max, windowMs, calendar = false }) {
  const hits = new Map();
  function recent(key, now) {
    const list = (hits.get(key) ?? []).filter((time) => (calendar ? Math.floor(time / windowMs) === Math.floor(now / windowMs) : time > now - windowMs));
    if (list.length) hits.set(key, list);
    else hits.delete(key);
    return list;
  }
  return {
    left: (key, now) => Math.max(0, max - recent(key, now).length),
    take(key, now) {
      const list = recent(key, now);
      if (list.length >= max) return false;
      hits.set(key, [...list, now]);
      return true;
    },
  };
}

// The four limits together. take() looks at all four first and only uses a slot in each when every one has room, so a
// refused try costs nothing. `remaining` is how many of today's plans this person has left.
export function makeAiLimits(limits = AI_LIMITS) {
  const userMinute = makeLimiter({ max: limits.perUserMinute, windowMs: MINUTE });
  const userDay = makeLimiter({ max: limits.perUserDay, windowMs: DAY, calendar: true });
  const allMinute = makeLimiter({ max: limits.allMinute, windowMs: MINUTE });
  const allDay = makeLimiter({ max: limits.allDay, windowMs: DAY, calendar: true });
  return {
    take(userId, now) {
      const remaining = () => userDay.left(userId, now);
      if (userMinute.left(userId, now) < 1) return { ok: false, why: "limit_minute", remaining: remaining() };
      if (userDay.left(userId, now) < 1) return { ok: false, why: "limit_day", remaining: 0 };
      if (allMinute.left(EVERYONE, now) < 1) return { ok: false, why: "limit_all_minute", remaining: remaining() };
      if (allDay.left(EVERYONE, now) < 1) return { ok: false, why: "limit_all_day", remaining: remaining() };
      userMinute.take(userId, now);
      userDay.take(userId, now);
      allMinute.take(EVERYONE, now);
      allDay.take(EVERYONE, now);
      return { ok: true, remaining: remaining() };
    },
  };
}
