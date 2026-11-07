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

function Word({ children, progress, range }) {
  const opacity = useTransform(progress, range, [0.16, 1]);
  return <motion.span style={{ opacity }} className="inline-block">{children}</motion.span>;
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
      <motion.div style={reduce ? undefined : { rotateX, scale, y, transformOrigin: "50% 0%" }}>{children}</motion.div>
    </div>
  );
}

// Moves its content a little slower (or faster) than the page, for depth. `speed` is pixels across the scroll.
export function Parallax({ children, className = "", speed = 60 }) {
  const ref = useRef(null);
  const reduce = usePrefersReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [speed, -speed]);
  return <motion.div ref={ref} className={className} style={reduce ? undefined : { y }}>{children}</motion.div>;
}
