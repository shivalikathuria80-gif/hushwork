"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useInView } from "motion/react";
import { Icon } from "./icons";
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
const SPRING = { type: "spring", stiffness: 170, damping: 20, mass: 0.9 };

function Folder({ name, color, icon, files, open, onOpen, onClose, onToggle }) {
  const tint = (pct) => `color-mix(in oklab, ${color} ${pct}%, var(--surface))`;
  return (
    <button
      type="button" aria-expanded={open} aria-label={`${name} folder: ${files.map(([f]) => f).join(", ")}`}
      onMouseEnter={onOpen} onMouseLeave={onClose} onFocus={onOpen} onBlur={onClose} onClick={onToggle}
      className="group relative block h-[300px] w-full rounded-3xl text-left [perspective:1100px]"
    >
      {/* A soft glow under the open folder. */}
      <motion.span aria-hidden="true" className="absolute inset-x-8 bottom-4 h-16 rounded-full blur-2xl" style={{ background: color }} animate={{ opacity: open ? 0.35 : 0.08 }} transition={{ duration: 0.4 }} />

      {/* The folder's back, with its tab. */}
      <span aria-hidden="true" className="absolute inset-x-4 bottom-6 top-16 rounded-2xl border border-line" style={{ background: tint(30) }}>
        <span className="absolute -top-5 left-0 h-6 w-28 rounded-t-xl border border-b-0 border-line" style={{ background: tint(30) }} />
      </span>

      {/* The workflows inside, which fan out when the folder opens. */}
      {files.map(([file, when], i) => (
        <motion.span
          key={file} aria-hidden="true"
          className="absolute inset-x-9 bottom-10 flex h-24 flex-col justify-between rounded-xl border border-line bg-surface p-3 shadow-md"
          initial={false}
          animate={open
            ? { y: -96 - (2 - i) * 34, rotate: (i - 1) * 4, x: (i - 1) * 10, opacity: 1 }
            : { y: -i * 8, rotate: 0, x: 0, opacity: 1 - i * 0.15 }}
          transition={{ ...SPRING, delay: open ? i * 0.07 : (2 - i) * 0.04 }}
          style={{ zIndex: 1 + i }}
        >
          <span className="flex items-center gap-2 text-sm font-medium text-ink">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md" style={{ background: tint(18), color }}><Icon name={icon} size={13} /></span>
            <span className="truncate">{file}</span>
          </span>
          <span className="flex items-center justify-between text-xs text-mute">
            <span className="flex items-center gap-1"><Icon name="Clock" size={12} />{when}</span>
            <span className="rounded-md border border-line bg-raised px-1.5 font-medium">Sample</span>
          </span>
        </motion.span>
      ))}

      {/* The front flap, which tips forward on its bottom edge. */}
      <motion.span
        aria-hidden="true"
        className="absolute inset-x-4 bottom-6 z-10 flex h-[150px] flex-col justify-end rounded-2xl border border-line p-5 shadow-lg backdrop-blur-md"
        style={{ background: `linear-gradient(160deg, ${tint(42)}, ${tint(22)})`, transformOrigin: "50% 100%" }}
        initial={false}
        animate={{ rotateX: open ? -32 : 0, y: open ? 6 : 0 }}
        transition={SPRING}
      >
        <span className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-surface/80 shadow-sm" style={{ color }}><Icon name={open ? "FolderOpen" : "Folder"} size={20} /></span>
          <span>
            <span className="block text-lg font-semibold text-ink">{name}</span>
            <span className="block text-sm text-mute">{files.length} workflows</span>
          </span>
          <Icon name="ArrowRight" size={18} className="ml-auto -rotate-45 text-mute transition-transform duration-200 group-hover:rotate-0" />
        </span>
      </motion.span>
    </button>
  );
}

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
          <Folder
            key={name} name={name} color={color} icon={icon} files={files} open={isOpen(i)}
            onOpen={() => setHeld(i)} onClose={() => { setHeld(null); setAuto(i); }}
            onToggle={() => setHeld((h) => (h === i ? null : i))}
          />
        ))}
      </motion.div>
      <Link href="/agents" className="mt-6 inline-flex min-h-11 items-center gap-2 font-medium text-accent-text hover:underline">See every ready-made agent<Icon name="ArrowRight" size={16} /></Link>
    </section>
  );
}
