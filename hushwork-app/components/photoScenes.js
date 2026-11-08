"use client";

// Hooks for the live scenes drawn over the landing page photos (HowItWorks.js, BeforeAfter.js).

import { useEffect, useState } from "react";
import { useInView } from "motion/react";
import { useMotionPause } from "./MotionProvider";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

// Steps through a little scene (0, 1, 2, ...) while it is on screen, then starts over, like a demo on a loop.
// `times` are how long each phase lasts, in ms. Paused or offscreen it holds still; with reduce motion it shows the last phase.
// `enabled` lets a caller hold the scene too (a photo that is not the one showing).
export function usePhases(ref, times, enabled = true) {
  const reduce = usePrefersReducedMotion();
  const { paused } = useMotionPause();
  const inView = useInView(ref, { margin: "-10% 0px -10% 0px" });
  const [phase, setPhase] = useState(0);
  const run = inView && enabled && !paused && !reduce;
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

// Where a photo drawn with object-fit: cover actually lands inside its box, in px. Live parts placed in % of this box stay glued
// to the thing in the photo (a phone screen, a laptop) at any screen shape, even though the photo is cropped differently.
export function useCoverBox(ref, width, height) {
  const [box, setBox] = useState(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth, h = el.clientHeight;
      const k = Math.max(w / width, h / height);
      setBox({ width: width * k, height: height * k, left: (w - width * k) / 2, top: (h - height * k) / 2 });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, width, height]);
  return box;
}

