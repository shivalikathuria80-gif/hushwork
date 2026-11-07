"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { animate, motion, useInView } from "motion/react";
import { usePrefersReducedMotion } from "../usePrefersReducedMotion";
import { pulse } from "./AppScene";
import WeekScene from "./WeekScene";
import { minutesText } from "@/lib/week-time";

// The moving parts of "Your week" (app/app/week/page.js). Built in the 21st.dev style (spotlight cards, a light running round
// the border, number tickers) by hand, because that site cannot be reached from where this is built. Each stands still with
// reduce motion on, and the 3D towers also stop with the Pause switch.

// A card with a soft glow that follows the pointer. The glow is a colour change, not movement, so it stays with reduce motion.
export function SpotlightCard({ children, className = "", beam = false, as = "div", ...rest }) {
  const ref = useRef(null);
  const Tag = as;
  const onMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  };
  return (
    <Tag ref={ref} onPointerMove={onMove} className={`group/spot relative isolate overflow-hidden rounded-2xl border border-line bg-surface/90 shadow-sm ${beam ? "hw-beam" : ""} ${className}`} {...rest}>
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-300 group-hover/spot:opacity-100" style={{ background: "radial-gradient(320px circle at var(--mx, 50%) var(--my, 0%), color-mix(in oklab, var(--accent) 16%, transparent), transparent 65%)" }} />
      {children}
    </Tag>
  );
}

// A number of minutes that counts up when it first comes into view: "1 h 25 min".
export function TimeUp({ minutes, className = "" }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const reduce = usePrefersReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce || !inView) { el.textContent = minutesText(minutes); return; }
    const controls = animate(0, minutes, { duration: 1.4, ease: [0.22, 1, 0.36, 1], onUpdate: (v) => { el.textContent = minutesText(v); } });
    return () => controls.stop();
  }, [minutes, inView, reduce]);
  return <span ref={ref} className={`tabular-nums ${className}`}>{minutesText(minutes)}</span>;
}

// When the page opens, the app's backdrop rolls out a green ring if anything was done this week.
export function WeekPulse({ good }) {
  useEffect(() => { if (good) { const id = setTimeout(() => pulse("good"), 700); return () => clearTimeout(id); } }, [good]);
  return null;
}

const DOT = { good: "bg-success", you: "bg-accent", bad: "bg-error", quiet: "bg-line-strong", preview: "bg-accent-edge" };
const WORDS = { good: "done", you: "waiting for you", bad: "stopped", quiet: "quiet checks", preview: "practice only" };
const ORDER = ["good", "you", "bad", "preview", "quiet"];

// The 7 days, oldest first, in the visitor's own time zone (the server cannot know it). Each day: { label, long, tones[] }.
function bucket(dots, now) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() - (6 - i));
    return { from: d.getTime(), label: i === 6 ? "Today" : d.toLocaleDateString(undefined, { weekday: "short" }), long: d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }), tones: [] };
  });
  for (const dot of dots) {
    const t = Date.parse(dot.t);
    if (!Number.isFinite(t)) continue;
    for (let i = 6; i >= 0; i--) if (t >= days[i].from) { days[i].tones.push(dot.tone); break; }
  }
  return days;
}

let openedAt = null;
const browserNow = () => (openedAt ??= Date.now());
const subscribeToNothing = () => () => {};

// The towers and the day strip under them. Hovering (or focusing) a day lights its tower.
export function WeekChart({ dots }) {
  const now = useSyncExternalStore(subscribeToNothing, browserNow, () => null); // the browser only, so the server and browser HTML match
  const days = useMemo(() => (now ? bucket(dots, now) : null), [dots, now]);
  const [focus, setFocus] = useState(-1);
  const most = days ? Math.max(1, ...days.map((day) => day.tones.length)) : 1;

  return (
    <div>
      <div className="relative h-[210px] sm:h-[320px]">
        {days && <WeekScene days={days.map((day) => day.tones)} focus={focus} className="absolute inset-0" />}
      </div>
      <ol aria-label="Runs per day" className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {(days ?? Array.from({ length: 7 }, () => null)).map((day, i) => {
          const counts = day ? ORDER.map((tone) => [tone, day.tones.filter((t) => t === tone).length]).filter(([, n]) => n > 0) : [];
          const total = day?.tones.length ?? 0;
          return (
            <li
              key={i} tabIndex={day ? 0 : -1}
              onPointerEnter={() => setFocus(i)} onPointerLeave={() => setFocus(-1)} onFocus={() => setFocus(i)} onBlur={() => setFocus(-1)}
              className={`group relative flex min-w-0 flex-col items-center rounded-xl border px-1 py-2 text-center outline-offset-2 transition-colors duration-200 ${focus === i ? "border-accent-edge bg-accent-subtle" : "border-line bg-surface/80"}`}
            >
              <span className="text-[11px] font-medium text-mute sm:text-xs">{day?.label ?? " "}</span>
              <span className="mt-0.5 text-base font-semibold tabular-nums sm:text-lg">{day ? total : " "}</span>
              {/* A tiny bar for each day, so the shape of the week reads without the 3D view. */}
              <span aria-hidden="true" className="mt-1 flex h-8 w-2.5 flex-col-reverse overflow-hidden rounded-full bg-raised">
                {counts.map(([tone, n]) => (
                  <motion.span key={tone} className={`${DOT[tone]} w-full origin-bottom`} style={{ height: `${(n / most) * 100}%` }} initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ type: "spring", stiffness: 140, damping: 18, delay: 0.3 + i * 0.06 }} />
                ))}
              </span>
              {day && <span className="sr-only">{`${day.long}: ${total} ${total === 1 ? "run" : "runs"}${counts.length ? `, ${counts.map(([tone, n]) => `${n} ${WORDS[tone]}`).join(", ")}` : ""}`}</span>}
            </li>
          );
        })}
      </ol>
      <ul aria-label="What the colours mean" className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-mute">
        {ORDER.map((tone) => (
          <li key={tone} className="inline-flex items-center gap-1.5"><span aria-hidden="true" className={`h-2 w-2 rounded-full ${DOT[tone]}`} />{WORDS[tone][0].toUpperCase() + WORDS[tone].slice(1)}</li>
        ))}
      </ul>
    </div>
  );
}

// A bar that grows to its share when it comes into view (the "By workflow" list).
export function GrowBar({ parts, total, most }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  return (
    <span ref={ref} aria-hidden="true" className="flex h-2 overflow-hidden rounded-full bg-raised" style={{ width: `${Math.max(12, (total / Math.max(1, most)) * 100)}%` }}>
      {ORDER.map((tone) => (parts[tone] ? (
        <motion.span key={tone} className={`${DOT[tone]} h-full origin-left`} style={{ width: `${(parts[tone] / total) * 100}%` }} initial={{ scaleX: 0 }} animate={inView ? { scaleX: 1 } : { scaleX: 0 }} transition={{ type: "spring", stiffness: 90, damping: 20, delay: 0.1 }} />
      ) : null))}
    </span>
  );
}
