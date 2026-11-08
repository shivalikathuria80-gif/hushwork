"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { Icon } from "../icons";
import { pulse } from "./AppScene";
import { CountUp } from "./RunMotion";
import { usePrefersReducedMotion } from "../usePrefersReducedMotion";
import { buildCalendar, dayStart, untilText } from "@/lib/calendar";
import { startPracticeRun } from "@/lib/actions/runs";

// "Calendar": the next 7 days of planned runs, laid out in the visitor's own time zone. Bold "spec sheet" styling: heavy tight headlines,
// mono labels, everything a pill. The Next up card has the page's one continuous animation (a rainbow border turning, .hw-conic in
// globals.css); the rest settles in once (pills drop into their days, the view switch glides) and lifts on hover.
// Filtering by agent and switching Week/List only change what is shown. Run now starts a practice run, which only looks; anything that
// sends or creates still waits for Approve on the Runs page.

const EASE = [0.33, 1, 0.68, 1];
const HUES = ["#6647f0", "#0091ff", "#16c0a4", "#e0369f", "#f07a3c", "#00a86b"];
const hue = (id) => HUES[[...id].reduce((sum, ch) => (sum * 31 + ch.charCodeAt(0)) >>> 0, 7) % HUES.length];
const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";
const TONE = {
  good: ["bg-success", "Done"], you: ["bg-accent", "Needs your OK"], bad: ["bg-error", "Stopped"], quiet: ["bg-line-strong", "Nothing new"], preview: ["bg-accent-edge", "Practice"],
};

// The browser's clock, read every 30 seconds so the countdown moves. The server renders nothing time-based (it cannot know the zone).
let cached = null;
const read = () => cached;
const subscribe = (notify) => {
  const tick = () => { cached = Date.now(); notify(); };
  tick();
  const id = setInterval(tick, 30_000);
  return () => clearInterval(id);
};
const useNow = () => useSyncExternalStore(subscribe, read, () => null);

const time = (ms) => new Date(ms).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
const dayName = (ms, i) => (i === 0 ? "Today" : i === 1 ? "Tomorrow" : new Date(ms).toLocaleDateString(undefined, { weekday: "long" }));

function Avatar({ id, name, size = 28, ring = true }) {
  return (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-full font-bold text-white ${ring ? "ring-2 ring-surface" : ""}`} style={{ background: hue(id), width: size, height: size, fontSize: size * 0.38 }}>
      {initials(name)}
    </span>
  );
}

function Pill({ tone = "neutral", children }) {
  const look = {
    sends: "bg-[#0091ff]/12 text-[#0070d1] dark:text-[#5cb8ff]",
    reads: "bg-success/12 text-success",
    paused: "bg-raised text-mute",
    today: "bg-ink text-bg",
    neutral: "bg-raised text-mute",
  }[tone];
  return <span className={`inline-flex h-5 shrink-0 items-center rounded-full px-2 font-mono text-[10px] font-medium uppercase leading-none tracking-[0.06em] ${look}`}>{children}</span>;
}

function RunNow({ workflowId, name, small = false }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const go = async () => {
    setBusy(true); setNote("");
    try {
      const result = await startPracticeRun({ id: workflowId });
      if (result?.ok && result.runId) { pulse("good"); router.push(`/app/runs?run=${encodeURIComponent(result.runId)}`); return; }
      setNote(result?.error || "Could not start the run. Try again."); pulse("bad");
    } catch {
      setNote("Could not start the run. Check your connection and try again.");
    }
    setBusy(false);
  };
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <motion.button
        type="button" onClick={go} disabled={busy} aria-label={`Run ${name} now (practice run)`} whileTap={{ scale: 0.96 }}
        className={`inline-flex items-center gap-1.5 rounded-full bg-ink font-bold text-bg transition-colors duration-150 hover:bg-ink/85 disabled:opacity-60 ${small ? "h-8 px-3 text-xs" : "h-11 px-5 text-sm"}`}
      >
        <Icon name={busy ? "Loader2" : "Play"} size={small ? 12 : 14} className={busy ? "hw-spin" : ""} weight="fill" />Run now
      </motion.button>
      {note && <span role="alert" className="text-xs text-error">{note}</span>}
    </span>
  );
}

function NextUp({ next, now, tzOffset }) {
  if (!next) return null;
  const inDays = Math.round((dayStart(next.at, tzOffset) - dayStart(now, tzOffset)) / 86_400_000);
  return (
    <motion.section aria-labelledby="next-heading" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: EASE }}
      className="hw-conic rounded-[20px] bg-surface p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-mute">Next up</p>
          <div className="mt-3 flex items-center gap-3">
            <Avatar id={next.workflowId} name={next.name} size={40} ring={false} />
            <h2 id="next-heading" className="min-w-0 truncate text-[length:clamp(1.5rem,3vw,2.15rem)] font-extrabold tracking-[-0.03em]">{next.name}</h2>
          </div>
          <p className="mt-2 text-sm text-mute">
            {dayName(next.at, inDays)} at {time(next.at)} · {next.when}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">{next.sends ? <Pill tone="sends">Sends after your OK</Pill> : <Pill tone="reads">Reads only</Pill>}</div>
        </div>
        <div className="text-right">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-mute">Starts</p>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.p key={untilText(next.at - now)} initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -14, opacity: 0 }} transition={{ duration: 0.3, ease: EASE }}
              className="mt-1 text-[length:clamp(2rem,4.4vw,3.25rem)] font-extrabold leading-none tracking-[-0.04em] tabular-nums">
              {untilText(next.at - now)}
            </motion.p>
          </AnimatePresence>
          <div className="mt-4 flex justify-end"><RunNow workflowId={next.workflowId} name={next.name} /></div>
        </div>
      </div>
    </motion.section>
  );
}

function Stat({ label, value, hint, delay }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: EASE, delay }} className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-[length:clamp(1.9rem,3.4vw,2.6rem)] font-extrabold leading-none tracking-[-0.04em] tabular-nums">{typeof value === "number" ? <CountUp value={value} /> : value}</p>
      <p className="mt-2 text-sm font-semibold">{label}</p>
      {hint && <p className="text-xs text-mute">{hint}</p>}
    </motion.div>
  );
}

// One run on a day. Planned runs show the time and whether they send; runs from earlier today show how they went.
function Event({ event, index, column, reduce, compact }) {
  const ran = event.kind === "ran";
  const tone = ran ? TONE[event.tone] ?? TONE.good : null;
  return (
    <motion.li
      layout={!reduce}
      initial={reduce ? false : { opacity: 0, y: -16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.45, ease: EASE, delay: reduce ? 0 : Math.min(0.6, column * 0.05 + index * 0.04) }}
      whileHover={reduce ? undefined : { y: -2 }}
      className={`group rounded-xl border bg-surface px-2.5 py-2 transition-[border-color,box-shadow] duration-150 hover:border-line-strong hover:shadow-[0_4px_14px_rgba(13,21,48,0.08)] ${ran ? "border-dashed border-line" : "border-line"}`}
    >
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ background: hue(event.workflowId) }} />
        <span className="font-mono text-[11px] tabular-nums text-mute">{time(event.at)}</span>
        {event.kind === "hourly" && <span className="font-mono text-[11px] text-mute">· ×{event.count}</span>}
      </div>
      <p className={`mt-1 truncate text-[13px] font-semibold leading-snug ${ran ? "text-mute" : ""}`} title={event.name}>{event.name}</p>
      <div className={`mt-1.5 flex flex-wrap items-center gap-1 ${compact ? "" : ""}`}>
        {ran ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-mute"><span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${tone[0]}`} />{tone[1]}</span>
        ) : event.kind === "hourly" ? (
          <Pill>Every hour</Pill>
        ) : event.sends ? <Pill tone="sends">Sends</Pill> : <Pill tone="reads">Reads</Pill>}
      </div>
      <span className="sr-only">{ran ? `Ran at ${time(event.at)}: ${tone[1]}` : event.kind === "hourly" ? `${event.count} runs, every hour from ${time(event.at)}` : `Planned at ${time(event.at)}${event.sends ? ", sends after your OK" : ", reads only"}`}</span>
    </motion.li>
  );
}

// The "now" mark in today's column, between what already ran and what is still to come.
function NowLine({ now, reduce }) {
  return (
    <li aria-hidden="true" className="relative flex items-center gap-1.5 py-0.5">
      <span className="relative grid h-2.5 w-2.5 place-items-center">
        {!reduce && <span className="hw-ping absolute inset-0 rounded-full bg-[#fa24ce]" />}
        <span className="h-2 w-2 rounded-full bg-[#fa24ce]" />
      </span>
      <span className="h-px flex-1 bg-[#fa24ce]/60" />
      <span className="font-mono text-[10px] text-[#c2187f] dark:text-[#ff7bd5]">{time(now)}</span>
    </li>
  );
}

function DayColumn({ day, i, now, reduce, list }) {
  const ran = day.events.filter((e) => e.kind === "ran");
  const ahead = day.events.filter((e) => e.kind !== "ran");
  const d = new Date(day.start);
  const header = (
    <div className={`flex items-baseline justify-between gap-2 ${list ? "border-b border-line pb-2" : ""}`}>
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-mute">{d.toLocaleDateString(undefined, { weekday: "short" })}</span>
        <span className={`text-xl font-extrabold tracking-[-0.03em] ${i === 0 ? "" : "text-ink/80"}`}>{d.getDate()}</span>
        {list && <span className="text-sm font-semibold">{dayName(day.start, i)}</span>}
      </div>
      {i === 0 ? <Pill tone="today">Today</Pill> : ahead.length > 0 && <span className="font-mono text-[11px] tabular-nums text-mute">{ahead.length}</span>}
    </div>
  );
  return (
    <motion.section layout={!reduce} aria-label={`${dayName(day.start, i)}: ${ahead.length} planned`} className={list ? "py-3" : `flex min-w-0 flex-col gap-2 rounded-2xl p-2 ${i === 0 ? "bg-accent-subtle/60" : "bg-raised/50"}`}>
      {header}
      <ul className={list ? "mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3" : "flex flex-col gap-2"}>
        <AnimatePresence initial={false}>
          {ran.map((e, j) => <Event key={`r${e.at}${e.workflowId}`} event={e} index={j} column={i} reduce={reduce} />)}
          {i === 0 && <NowLine key="now" now={now} reduce={reduce} />}
          {ahead.map((e, j) => <Event key={`p${e.at}${e.workflowId}`} event={e} index={ran.length + j} column={i} reduce={reduce} />)}
        </AnimatePresence>
        {day.events.length === 0 && i !== 0 && <li className="px-1 py-2 text-xs text-mute">Free</li>}
      </ul>
    </motion.section>
  );
}

function Segmented({ value, onChange, options, label, id }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full border border-line bg-surface p-1">
      {options.map(([key, text, icon]) => {
        const on = value === key;
        return (
          <button key={key} type="button" role="radio" aria-checked={on} onClick={() => onChange(key)}
            className={`relative inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-sm font-bold transition-colors duration-150 ${on ? "text-bg" : "text-mute hover:text-ink"}`}>
            {on && <motion.span layoutId={id} className="absolute inset-0 -z-0 rounded-full bg-ink" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
            <span className="relative inline-flex items-center gap-1.5">{icon && <Icon name={icon} size={14} />}{text}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function CalendarBoard({ items, runs, schedulesMissing }) {
  const now = useNow();
  const reduce = usePrefersReducedMotion();
  const [view, setView] = useState("week");
  const [only, setOnly] = useState("");
  const tzOffset = now === null ? 0 : -new Date(now).getTimezoneOffset();
  const shownItems = only ? items.filter((item) => item.workflowId === only) : items;
  const shownRuns = only ? runs.filter((run) => run.workflowId === only) : runs;
  const cal = useMemo(() => (now === null ? null : buildCalendar({ items: shownItems, runs: shownRuns, now, tzOffset })), [now, shownItems, shownRuns, tzOffset]);
  const all = useMemo(() => (now === null ? null : buildCalendar({ items, runs: [], now, tzOffset })), [now, items, tzOffset]);
  const agents = items.filter((item) => item.schedule?.enabled !== false);

  if (schedulesMissing) {
    return <p className="mt-8 rounded-2xl border border-line bg-surface p-4 text-sm">Scheduling needs one setup step that is not done yet. Open <code className="rounded bg-sunken px-1 py-0.5 text-[13px]">supabase/schedules.sql</code> and run it in Supabase.</p>;
  }
  if (!cal) return <div aria-hidden="true" className="mt-8 h-[420px] rounded-[20px] border border-line bg-raised" />;

  if (items.length === 0) {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: EASE }} className="hw-conic mt-8 rounded-[20px] bg-surface p-6 sm:p-8">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-mute">Nothing planned yet</p>
        <p className="mt-2 text-2xl font-extrabold tracking-[-0.03em]">Give an agent a time, and it shows up here.</p>
        <p className="mt-2 max-w-[55ch] text-sm text-mute">Say when in the sentence, like &ldquo;every weekday at 8, sum up my day&rdquo;, or set a schedule on any workflow on the home page.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/app/agents" className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-bold text-bg hover:bg-ink/85"><Icon name="Bot" size={16} />Make an agent</Link>
          <Link href="/app#drafts" className="inline-flex h-11 items-center gap-2 rounded-full border border-line px-5 text-sm font-bold hover:bg-raised">Schedule a workflow</Link>
        </div>
      </motion.div>
    );
  }

  const busiest = all.stats.busiest >= 0 ? dayName(all.days[all.stats.busiest].start, all.stats.busiest) : "None";
  return (
    <div className="mt-8 space-y-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <NextUp next={cal.next} now={now} tzOffset={tzOffset} />
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Runs planned" value={all.stats.planned} hint="Next 7 days" delay={0.05} />
          <Stat label="Can send" value={all.stats.sending} hint="Each waits for your OK" delay={0.1} />
          <Stat label="Agents on a schedule" value={all.stats.agents} delay={0.15} />
          <Stat label="Busiest day" value={busiest} delay={0.2} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Filter by agent: an avatar cluster that opens into pills. */}
        <div role="radiogroup" aria-label="Show agent" className="flex flex-wrap items-center gap-1.5">
          <button type="button" role="radio" aria-checked={!only} onClick={() => setOnly("")}
            className={`inline-flex h-9 items-center gap-2 rounded-full border pl-1.5 pr-3.5 text-sm font-bold transition-colors duration-150 ${!only ? "border-ink bg-ink text-bg" : "border-line bg-surface hover:bg-raised"}`}>
            <span className="flex -space-x-2">{agents.slice(0, 4).map((a) => <Avatar key={a.workflowId} id={a.workflowId} name={a.name} size={24} />)}</span>
            All agents
          </button>
          {agents.map((a) => (
            <motion.button key={a.workflowId} type="button" role="radio" aria-checked={only === a.workflowId} onClick={() => setOnly(only === a.workflowId ? "" : a.workflowId)} whileTap={{ scale: 0.96 }}
              className={`inline-flex h-9 max-w-[16rem] items-center gap-2 rounded-full border pl-1.5 pr-3.5 text-sm font-semibold transition-colors duration-150 ${only === a.workflowId ? "border-ink bg-ink text-bg" : "border-line bg-surface hover:bg-raised"}`}>
              <Avatar id={a.workflowId} name={a.name} size={24} ring={false} /><span className="truncate">{a.name}</span>
            </motion.button>
          ))}
        </div>
        <Segmented id="cal-view" label="Layout" value={view} onChange={setView} options={[["week", "Week", "Calendar"], ["list", "List", "Menu"]]} />
      </div>

      <LayoutGroup>
        <motion.div layout={!reduce} className={view === "week" ? "grid gap-2 md:grid-cols-4 lg:grid-cols-7" : "divide-y divide-line rounded-[20px] border border-line bg-surface px-4 sm:px-5"}>
          {cal.days.map((day, i) => (view === "list" && day.events.length === 0 && i !== 0 ? null : <DayColumn key={day.start} day={day} i={i} now={now} reduce={reduce} list={view === "list"} />))}
        </motion.div>
      </LayoutGroup>

      {cal.paused.length > 0 && (
        <section aria-labelledby="paused-heading" className="rounded-2xl border border-dashed border-line p-4">
          <h2 id="paused-heading" className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-mute">Paused, not planned</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {cal.paused.map((p) => (
              <li key={p.workflowId} className="inline-flex items-center gap-2 rounded-full bg-raised py-1 pl-1 pr-3 text-sm"><Avatar id={p.workflowId} name={p.name} size={22} ring={false} /><span className="font-semibold">{p.name}</span><span className="text-xs text-mute">{p.when}</span><Pill tone="paused">Paused</Pill></li>
            ))}
          </ul>
        </section>
      )}
      <p className="text-xs text-mute">Times are in your own time zone. Run now starts a practice run: it only looks, and anything that would send waits for Approve on the Runs page.</p>
    </div>
  );
}
