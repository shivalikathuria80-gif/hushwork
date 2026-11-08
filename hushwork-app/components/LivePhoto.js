"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion, useInView, useMotionTemplate, useMotionValue, useScroll, useSpring, useTransform } from "motion/react";
import { useMotionPause } from "./MotionProvider";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

// A photo that behaves like a real thing on the page (the photos in public/landing were made with Nano Banana, then retouched):
// it opens like a curtain the first time it is seen, drifts and slowly zooms as you scroll (depth), tilts toward the pointer with
// a glare that follows it, and can carry live HTML on top (a phone screen, a toast). With reduce motion on it is a still photo.
export function LivePhoto({ src, alt, width, height, sizes = "(min-width: 768px) 40vw, 100vw", className = "", children, priority = false, tilt = 7 }) {
  const ref = useRef(null);
  const reduce = usePrefersReducedMotion();
  const seen = useInView(ref, { once: true, margin: "0px 0px -15% 0px" });
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const zoom = useTransform(scrollYProgress, [0, 1], [1.16, 1.02]);
  const drift = useTransform(scrollYProgress, [0, 1], ["-4%", "4%"]);

  // Pointer tilt: springs, so the card leans with some weight instead of snapping.
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const rotateY = useSpring(useTransform(px, [0, 1], [-tilt, tilt]), { stiffness: 160, damping: 18 });
  const rotateX = useSpring(useTransform(py, [0, 1], [tilt, -tilt]), { stiffness: 160, damping: 18 });
  const gx = useTransform(px, (v) => `${v * 100}%`);
  const gy = useTransform(py, (v) => `${v * 100}%`);
  const glare = useMotionTemplate`radial-gradient(60% 60% at ${gx} ${gy}, rgba(255,255,255,0.22), transparent 70%)`;
  const [hover, setHover] = useState(false);

  const onMove = (e) => {
    if (reduce || e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width);
    py.set((e.clientY - r.top) / r.height);
    setHover(true);
  };
  const onLeave = () => { px.set(0.5); py.set(0.5); setHover(false); };

  const curtain = { clipPath: seen || reduce ? "inset(0% 0% 0% 0% round 24px)" : "inset(10% 18% 10% 18% round 48px)" };

  return (
    <div ref={ref} className={`[perspective:1100px] ${className}`} onPointerMove={onMove} onPointerLeave={onLeave}>
      <motion.div
        className="relative overflow-hidden rounded-3xl border border-line bg-raised shadow-2xl shadow-black/25 [transform-style:preserve-3d]"
        style={{ rotateX: reduce ? 0 : rotateX, rotateY: reduce ? 0 : rotateY }}
        initial={false}
        animate={curtain}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.div className="relative" style={{ aspectRatio: `${width} / ${height}`, scale: reduce ? 1 : zoom, y: reduce ? 0 : drift }}>
          <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className="object-cover" />
          {/* Live parts drawn on the photo, in % of the photo and inside the zooming layer, so they stay glued to the phone or laptop. */}
          {children && <div className="absolute inset-0">{children}</div>}
        </motion.div>
        {!reduce && <motion.div aria-hidden="true" className="pointer-events-none absolute inset-0 transition-opacity duration-300" style={{ background: glare, opacity: hover ? 1 : 0 }} />}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-white/10" />
      </motion.div>
    </div>
  );
}

// Steps through a little scene (0, 1, 2, ...) while it is on screen, then starts over, like a demo on a loop.
// `times` are how long each phase lasts, in ms. Paused or offscreen it holds still; with reduce motion it shows the last phase.
export function usePhases(ref, times) {
  const reduce = usePrefersReducedMotion();
  const { paused } = useMotionPause();
  const inView = useInView(ref, { margin: "-10% 0px -10% 0px" });
  const [phase, setPhase] = useState(0);
  const run = inView && !paused && !reduce;
  useEffect(() => {
    if (!run) return;
    const id = setTimeout(() => setPhase((p) => (p + 1) % times.length), times[phase]);
    return () => clearTimeout(id);
  }, [run, phase, times]);
  return reduce ? times.length - 1 : phase;
}

// Types a sentence out letter by letter while `on` is true, and shows it whole with reduce motion.
export function useTyped(text, on, speed = 32) {
  const reduce = usePrefersReducedMotion();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (reduce) return;
    if (!on) { const id = setTimeout(() => setN(0), 0); return () => clearTimeout(id); }
    if (n >= text.length) return;
    const id = setTimeout(() => setN((v) => v + 1), speed + (text[n] === "," ? 180 : 0));
    return () => clearTimeout(id);
  }, [on, n, text, speed, reduce]);
  return reduce ? text : text.slice(0, n);
}
