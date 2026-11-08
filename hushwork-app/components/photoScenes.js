"use client";

// Hooks for the live scenes drawn over the landing page photos (HowItWorks.js, BeforeAfter.js).

import { useEffect, useRef, useState } from "react";
import { animate, useInView, useMotionValue } from "motion/react";
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


// The clock that plays a pinned photo scene. The scroll still drives it, but when the visitor stops scrolling while the scene is
// pinned, it moves on by itself every `every` ms (to wherever `next(pos)` says; `cut: true` jumps instead of gliding, used to loop
// from the last shot back to the first). Scrolling again takes over at once. Paused or with reduce motion, only the scroll moves it.
export function useFilmClock(progress, next, every = 5200) {
  const reduce = usePrefersReducedMotion();
  const { paused } = useMotionPause();
  const pos = useMotionValue(0);
  const nextRef = useRef(next);
  useEffect(() => { nextRef.current = next; }, [next]);
  useEffect(() => {
    let ctl = null;
    let timer = 0;
    let auto = false; // true while pos is ahead of the scroll because the clock moved it
    const stop = () => { if (ctl) ctl.stop(); ctl = null; };
    const done = () => { ctl = null; };
    const arm = () => {
      clearTimeout(timer);
      if (reduce || paused) return;
      timer = setTimeout(function tick() {
        const v = progress.get();
        if (v > 0.002 && v < 0.998 && document.visibilityState === "visible") {
          const { to, cut } = nextRef.current(pos.get());
          stop();
          auto = true;
          if (cut) pos.set(to);
          else ctl = animate(pos, to, { duration: 1.8, ease: [0.65, 0, 0.35, 1], onComplete: done });
        }
        timer = setTimeout(tick, every);
      }, every);
    };
    pos.set(progress.get());
    const off = progress.on("change", (v) => {
      if (auto) { auto = false; stop(); ctl = animate(pos, v, { duration: 0.6, ease: [0.22, 1, 0.36, 1], onComplete: done }); }
      else if (!ctl) pos.set(v);
      else { stop(); ctl = animate(pos, v, { duration: 0.3, ease: "easeOut", onComplete: done }); }
      arm();
    });
    arm();
    return () => { off(); stop(); clearTimeout(timer); };
  }, [progress, pos, reduce, paused, every]);
  return pos;
}
