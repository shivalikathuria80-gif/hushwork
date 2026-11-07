"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useInView } from "motion/react";
import { Icon } from "./icons";
import AnimatedFolder from "./AnimatedFolder";
import { EASE } from "./ui";
import { useMotionPause } from "./MotionProvider";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

// Three folders that open by themselves, one after another, and fan out the workflows inside them.
// Hover, focus or tap a folder to open it yourself (the self-playing stops while you do).
// The self-playing stops off screen and on the page's Pause button; with "reduce motion" on, all three sit open.
const FOLDERS = [
  ["Sales", "var(--accent)", "Zap", [["Score new leads", "Hourly"], ["Top-5 digest", "Mondays"], ["Follow-up nudges", "Daily"]]],
  ["Support", "var(--info)", "Inbox", [["Triage inbox", "All day"], ["Draft replies", "On email"], ["Weekly themes", "Fridays"]]],
  ["Finance", "var(--success)", "Receipt", [["Chase invoices", "Weekly"], ["File receipts", "On email"], ["Monthly summary", "1st"]]],
];
export default function Automations() {
  const ref = useRef(null);
  const inView = useInView(ref, { amount: 0.4 });
  const { paused } = useMotionPause();
  const reduce = usePrefersReducedMotion();
  const [auto, setAuto] = useState(0); // the folder the self-playing has open
  const [held, setHeld] = useState(null); // a folder the visitor opened (hover, focus or tap)
  const playing = inView && !paused && !reduce && held === null;

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setAuto((n) => (n + 1) % FOLDERS.length), 2600);
    return () => clearInterval(id);
  }, [playing]);

  const isOpen = (i) => reduce || (held === null ? auto === i : held === i);

  return (
    <section id="auto" className="mx-auto max-w-6xl px-5 pb-24 pt-8">
      <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Example workflows</h2>
      <p className="mt-3 max-w-xl text-[17px] text-mute">Open a folder to see a few things you could build. These are examples, not running jobs.</p>
      <motion.div
        ref={ref} className="mt-10 grid gap-6 sm:grid-cols-3"
        initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.4, ease: EASE }}
      >
        {FOLDERS.map(([name, color, icon, files], i) => (
          <AnimatedFolder
            key={name} name={name} color={color} icon={icon} papers={files} open={isOpen(i)}
            aria-expanded={isOpen(i)} aria-label={`${name} folder: ${files.map(([f]) => f).join(", ")}`}
            onMouseEnter={() => setHeld(i)} onMouseLeave={() => { setHeld(null); setAuto(i); }}
            onFocus={() => setHeld(i)} onBlur={() => { setHeld(null); setAuto(i); }}
            onClick={() => setHeld((h) => (h === i ? null : i))}
          />
        ))}
      </motion.div>
      <Link href="/agents" className="mt-6 inline-flex min-h-11 items-center gap-2 font-medium text-accent-text hover:underline">See every ready-made agent<Icon name="ArrowRight" size={16} /></Link>
    </section>
  );
}
