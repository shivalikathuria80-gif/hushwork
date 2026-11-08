"use client";

import { useRef } from "react";
import { motion, useMotionTemplate, useMotionValue, useScroll, useSpring, useTransform } from "motion/react";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

// Scroll-driven pieces for the landing page, after the popular patterns on 21st.dev (scroll progress bar,
// text reveal, spotlight card, container scroll). Written here with `motion`, which the site already uses,
// so they add no new packages. Every one of them stands still when the visitor asks for reduced motion.

// A thin violet line along the top of the window that fills as you read down the page.
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.3 });
  return <motion.div aria-hidden="true" className="fixed inset-x-0 top-0 z-[70] h-0.5 origin-left bg-accent" style={{ scaleX }} />;
}

// Each word comes out of a blur and rises into place as it lights up, so the sentence reads like it is being said.
function Word({ children, progress, range }) {
  const opacity = useTransform(progress, range, [0.12, 1]);
  const y = useTransform(progress, range, ["0.35em", "0em"]);
  const blur = useTransform(progress, range, ["blur(6px)", "blur(0px)"]);
  return <motion.span style={{ opacity, y, filter: blur }} className="inline-block will-change-transform">{children}</motion.span>;
}

// A big sentence that lights up word by word as you scroll through it. The block stays pinned while it fills.
// Screen readers get the whole sentence at once (the word spans are hidden from them).
export function TextReveal({ text, className = "" }) {
  const ref = useRef(null);
  const reduce = usePrefersReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 75%", "end 60%"] });
  const words = text.split(" ");
  return (
    <div ref={ref} className={`relative ${reduce ? "" : "h-[170vh] md:h-[200vh]"} ${className}`}>
      <div className={`${reduce ? "" : "sticky top-0 flex min-h-dvh items-center"}`}>
        <p className="mx-auto max-w-5xl px-5 py-24 text-[length:clamp(1.75rem,4.6vw,3.5rem)] font-semibold leading-[1.15] tracking-[-0.025em]">
          <span className="sr-only">{text}</span>
          <span aria-hidden="true">
            {words.map((word, i) => {
              const start = i / words.length;
              const accent = word.startsWith("*");
              const clean = accent ? word.slice(1) : word;
              return (
                <span key={i} className={accent ? "text-accent-text" : undefined}>
                  {reduce ? clean : <Word progress={scrollYProgress} range={[start, start + 1 / words.length]}>{clean}</Word>}
                  {i < words.length - 1 && " "}
                </span>
              );
            })}
          </span>
        </p>
      </div>
    </div>
  );
}

// A soft violet light that follows the pointer across a card. Touch screens and reduced motion get no light.
export function Spotlight({ children, className = "" }) {
  const x = useMotionValue(-400);
  const y = useMotionValue(-400);
  const background = useMotionTemplate`radial-gradient(420px circle at ${x}px ${y}px, color-mix(in oklab, var(--accent) 16%, transparent), transparent 70%)`;
  const onMove = (e) => {
    if (e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    x.set(e.clientX - r.left);
    y.set(e.clientY - r.top);
  };
  return (
    <div onPointerMove={onMove} onPointerLeave={() => { x.set(-400); y.set(-400); }} className={`group relative ${className}`}>
      {children}
      <motion.div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-340 group-hover:opacity-100 motion-reduce:hidden" style={{ background }} />
    </div>
  );
}

// A panel that starts tilted back and a little small, and settles flat as it scrolls into the middle of the screen.
export function TiltIn({ children, className = "", tilt = 14 }) {
  const ref = useRef(null);
  const reduce = usePrefersReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center 55%"] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [tilt, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.9, 1]);
  const y = useTransform(scrollYProgress, [0, 1], [40, 0]);
  return (
    <div ref={ref} className={`[perspective:1200px] ${className}`}>
      <motion.div style={reduce ? { rotateX: 0, scale: 1, y: 0 } : { rotateX, scale, y, transformOrigin: "50% 0%" }}>{children}</motion.div>
    </div>
  );
}

// Wraps the pinned story film. In the last stretch of its scroll track the stage sinks back, blurs and fades, so it hands over to
// the next section instead of sliding up under the menu bar.
export function StoryExit({ children, className = "" }) {
  const ref = useRef(null);
  const reduce = usePrefersReducedMotion();
  // 0 when the track's top meets the top of the screen, 1 when its bottom does; the pin lets go at about 0.67.
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const opacity = useTransform(scrollYProgress, [0.6, 0.85], [1, 0]);
  const scale = useTransform(scrollYProgress, [0.6, 0.85], [1, 0.9]);
  const filter = useTransform(scrollYProgress, [0.6, 0.85], ["blur(0px)", "blur(8px)"]);
  return (
    <div ref={ref} data-story-track className={className}>
      <motion.div className="sticky top-0 h-dvh motion-reduce:static motion-reduce:h-auto" style={reduce ? { opacity: 1, scale: 1, filter: "none" } : { opacity, scale, filter }}>{children}</motion.div>
    </div>
  );
}

// A card that flips up out of the page the first time it is seen, hinged on its bottom edge, with a little overshoot.
export function FlipIn({ children, className = "", delay = 0 }) {
  const reduce = usePrefersReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <div className={`[perspective:1200px] ${className}`}>
      <motion.div className="h-full" style={{ transformOrigin: "50% 100%" }} initial={{ opacity: 0, rotateX: -32, y: 70, scale: 0.94 }} whileInView={{ opacity: 1, rotateX: 0, y: 0, scale: 1 }}
        viewport={{ once: true, amount: 0.25 }} transition={{ type: "spring", stiffness: 120, damping: 16, mass: 0.9, delay }}>
        {children}
      </motion.div>
    </div>
  );
}

// Moves its content a little slower (or faster) than the page, for depth. `speed` is pixels across the scroll.
export function Parallax({ children, className = "", speed = 60 }) {
  const ref = useRef(null);
  const reduce = usePrefersReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [speed, -speed]);
  return <motion.div ref={ref} className={className} style={{ y: reduce ? 0 : y }}>{children}</motion.div>;
}
