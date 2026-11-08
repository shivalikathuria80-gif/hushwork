"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { animate, motion, useInView, useMotionValue, useMotionValueEvent, useScroll, useTransform } from "motion/react";
import { Icon } from "./icons";
import { useMotionPause } from "./MotionProvider";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

// "Your Monday, before and after": two photos of the same desk (made with Nano Banana, then retouched), one on top of the other.
// Drag the handle (or use the arrow keys on it) to wipe between them. The first time it is seen, the handle sweeps across once
// by itself to show that it moves. The messy side carries the nagging notes; the tidy side carries what Hushwork did.

const MESS = [
  ["43 unread emails", "left-[6%] top-[14%]", -4],
  ["Invoice #1042 overdue", "left-[16%] top-[58%]", 3],
  ["3 missed Slack pings", "left-[30%] top-[30%]", -2],
  ["Weekly report due", "left-[4%] top-[78%]", 2],
];
const DONE = [
  ["Inbox summed up in 5 lines", "right-[6%] top-[16%]"],
  ["Invoice reminder sent", "right-[18%] top-[44%]"],
  ["Report posted to Slack", "right-[5%] top-[70%]"],
];

export default function BeforeAfter() {
  const ref = useRef(null);
  const frame = useRef(null);
  const reduce = usePrefersReducedMotion();
  const { paused } = useMotionPause();
  const seen = useInView(ref, { once: true, margin: "0px 0px -35% 0px" });
  const pos = useMotionValue(50); // % of the width that shows the "before" photo
  const [value, setValue] = useState(50);
  const touched = useRef(false);
  useMotionValueEvent(pos, "change", (v) => setValue(Math.round(v)));

  const clip = useTransform(pos, (v) => `inset(0 ${100 - v}% 0 0)`);
  const left = useTransform(pos, (v) => `${v}%`);
  const messOpacity = useTransform(pos, [10, 45], [0, 1]);
  const doneOpacity = useTransform(pos, [55, 90], [1, 0]);

  // Depth: the photos drift and zoom a touch as the section passes.
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const zoom = useTransform(scrollYProgress, [0, 1], [1.12, 1]);
  const tiltX = useTransform(scrollYProgress, [0, 0.45], [18, 0]);

  // The one-time sweep: to the messy side, across to the tidy side, then back to the middle.
  useEffect(() => {
    if (!seen || reduce || paused || touched.current) return;
    const controls = animate(pos, [50, 88, 12, 50], { duration: 3.2, ease: "easeInOut", times: [0, 0.3, 0.75, 1], delay: 0.4 });
    return () => controls.stop();
  }, [seen, reduce, paused, pos]);

  const setFrom = (clientX) => {
    const r = frame.current.getBoundingClientRect();
    pos.set(Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)));
  };
  const onDown = (e) => {
    touched.current = true;
    pos.stop();
    e.currentTarget.setPointerCapture(e.pointerId);
    setFrom(e.clientX);
  };
  const onMove = (e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) setFrom(e.clientX); };

  return (
    <section id="monday" ref={ref} aria-labelledby="monday-heading" className="mx-auto max-w-6xl px-5 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-text">Monday, 9:04</p>
        <h2 id="monday-heading" className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Same desk. Different Monday.</h2>
        <p className="mt-3 text-mute">Drag across the photo. On the left, the chores waiting for you. On the right, the same morning after Hushwork ran first.</p>
      </div>

      <div className="mt-10 [perspective:1400px]">
        <motion.div
          ref={frame}
          style={{ rotateX: reduce ? 0 : tiltX, transformOrigin: "50% 100%" }}
          onPointerDown={onDown} onPointerMove={onMove}
          className="relative aspect-[4/5] cursor-ew-resize sm:aspect-[1264/848] touch-pan-y select-none overflow-hidden rounded-3xl border border-line bg-raised shadow-2xl shadow-black/30"
        >
          {/* After: the whole frame. */}
          <motion.div className="absolute inset-0" style={{ scale: reduce ? 1 : zoom }}>
            <Image src="/landing/after.jpg" alt="The same desk, tidy, in warm morning light" fill sizes="(min-width: 1152px) 1100px, 100vw" className="object-cover" draggable={false} />
          </motion.div>
          <motion.ul aria-hidden="true" style={{ opacity: doneOpacity }} className="absolute inset-0">
            {DONE.map(([label, at], i) => (
              <motion.li key={label} className={`absolute ${at} ${i > 1 ? "hidden sm:flex" : "flex"} items-center gap-2 rounded-full border border-white/20 bg-black/55 px-3 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur-md sm:text-sm`}
                initial={{ opacity: 0, y: 14, scale: 0.9 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true }} transition={{ type: "spring", stiffness: 220, damping: 20, delay: 0.9 + i * 0.15 }}>
                <span className="grid h-4 w-4 place-items-center rounded-full bg-success text-[10px] text-bg"><Icon name="Check" size={10} weight="bold" /></span>{label}
              </motion.li>
            ))}
          </motion.ul>
          <span className="absolute bottom-4 right-4 rounded-full bg-black/55 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">With Hushwork</span>

          {/* Before: clipped to the left of the handle. */}
          <motion.div className="absolute inset-0" style={{ clipPath: clip }}>
            <motion.div className="absolute inset-0" style={{ scale: reduce ? 1 : zoom }}>
              <Image src="/landing/before.jpg" alt="A cluttered desk covered in sticky notes, in cold light" fill sizes="(min-width: 1152px) 1100px, 100vw" className="object-cover" draggable={false} />
            </motion.div>
            <motion.ul aria-hidden="true" style={{ opacity: messOpacity }} className="absolute inset-0">
              {MESS.map(([label, at, turn], i) => (
                <li key={label} className={`absolute ${at} ${i > 1 ? "hidden sm:block" : ""}`} style={{ rotate: `${turn}deg` }}>
                  <span className="hw-nag flex items-center gap-2 rounded-lg border border-error/40 bg-black/60 px-3 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur-md sm:text-sm" style={{ "--d": `${i * 0.7}s` }}>
                    <span className="h-2 w-2 rounded-full bg-error" />{label}
                  </span>
                </li>
              ))}
            </motion.ul>
            <span className="absolute bottom-4 left-4 rounded-full bg-black/55 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">Without</span>
          </motion.div>

          {/* The handle. The real control is a range input, so it works with a keyboard and screen readers. */}
          <motion.div aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white/90 shadow-[0_0_24px_rgba(255,255,255,0.6)]" style={{ left }}>
            <span className="absolute left-1/2 top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/70 bg-black/50 text-white shadow-xl backdrop-blur-md">
              <Icon name="Compare" size={20} />
            </span>
          </motion.div>
          <input
            type="range" min={0} max={100} value={value} aria-label="Compare the desk before and after Hushwork" aria-valuetext={`${value}% before`}
            onChange={(e) => { touched.current = true; pos.stop(); pos.set(Number(e.target.value)); }}
            className="peer absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
            onPointerDown={(e) => e.preventDefault()}
          />
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-3xl ring-2 ring-inset ring-transparent peer-focus-visible:ring-focus" />
        </motion.div>
      </div>
    </section>
  );
}
