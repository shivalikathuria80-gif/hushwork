"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { animate, motion, useInView } from "motion/react";
import { usePrefersReducedMotion } from "../usePrefersReducedMotion";
import { pulse } from "./AppScene";

// Small moving parts for the signed-in pages (Runs and Home). Each one stands still with "reduce motion" on.

// Fades and lifts its children in, one after another. Give it a `key` that changes (a run id) to play it again.
export function Reveal({ children, as = "div", delay = 0, className = "", ...rest }) {
  const Tag = motion[as];
  return (
    <Tag
      className={className} {...rest}
      initial="hidden" animate="shown"
      variants={{ hidden: {}, shown: { transition: { staggerChildren: 0.06, delayChildren: delay } } }}
    >
      {children}
    </Tag>
  );
}
const ITEM = { hidden: { opacity: 0, y: 12 }, shown: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 26 } } };
export function RevealItem({ children, as = "div", className = "", ...rest }) {
  const Tag = motion[as];
  return <Tag className={className} variants={ITEM} {...rest}>{children}</Tag>;
}

// A number that counts up from 0 when it first comes into view.
export function CountUp({ value, className = "" }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const reduce = usePrefersReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce || !inView) { el.textContent = String(value); return; }
    const controls = animate(0, value, { duration: 0.9, ease: [0.22, 1, 0.36, 1], onUpdate: (v) => { el.textContent = String(Math.round(v)); } });
    return () => controls.stop();
  }, [value, inView, reduce]);
  return <span ref={ref} className={`tabular-nums ${className}`}>{value}</span>;
}

// A bar that fills to done/total, with the words beside it.
export function StepProgress({ done, total, tone = "good" }) {
  const share = total > 0 ? done / total : 0;
  const fill = tone === "you" ? "bg-accent" : tone === "bad" ? "bg-error" : "bg-success";
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between text-xs text-mute">
        <span>{done} of {total} {total === 1 ? "step" : "steps"} done</span>
        <span className="tabular-nums">{Math.round(share * 100)}%</span>
      </div>
      <div role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label="Steps done" className="mt-1.5 h-2 overflow-hidden rounded-full bg-raised">
        <motion.div className={`h-full origin-left rounded-full ${fill}`} initial={{ scaleX: 0 }} animate={{ scaleX: share }} transition={{ type: "spring", stiffness: 90, damping: 20, delay: 0.15 }} />
      </div>
    </div>
  );
}

// The line between two steps, drawn downward as the step appears.
export function StepLine({ className = "" }) {
  return <motion.span aria-hidden="true" className={`origin-top ${className}`} variants={{ hidden: { scaleY: 0 }, shown: { scaleY: 1, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } } }} />;
}

// The round step marker. A step waiting for you has a soft ring pulsing round it; a done step's tick pops in.
export function StepDot({ state, number, className, children }) {
  return (
    <motion.span aria-hidden="true" className={className} variants={{ hidden: { scale: 0.6, opacity: 0 }, shown: { scale: 1, opacity: 1, transition: { type: "spring", stiffness: 420, damping: 18 } } }}>
      {state === "waiting" && <span className="hw-ping absolute inset-0 rounded-full border-2 border-accent" />}
      {children ?? number}
    </motion.span>
  );
}

// Move between runs with J and K (or the arrow keys while the list has focus), the way mail apps do.
// It also tells the 3D backdrop how this run went, once, when it opens.
export function RunsKeys({ ids, current, mood }) {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target?.tagName ?? "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || e.target?.isContentEditable) return;
      const inList = e.target?.closest?.("[data-runs-list]");
      const next = e.key === "j" || (inList && e.key === "ArrowDown");
      const prev = e.key === "k" || (inList && e.key === "ArrowUp");
      if (!next && !prev) return;
      const at = ids.indexOf(current);
      const to = ids[Math.min(ids.length - 1, Math.max(0, at + (next ? 1 : -1)))];
      if (!to || to === current) return;
      e.preventDefault();
      router.push(`/app/runs?run=${to}`, { scroll: false });
      requestAnimationFrame(() => document.querySelector(`[data-run-id="${to}"]`)?.focus({ preventScroll: true }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ids, current, router]);
  useEffect(() => { if (mood === "good" || mood === "bad") pulse(mood); }, [current, mood]);
  return null;
}
