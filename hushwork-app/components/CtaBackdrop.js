"use client";

import { useRef } from "react";
import FilmVideo from "./FilmVideo";
import { motion, useScroll, useTransform } from "motion/react";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

// The tidy desk (its Google Flow clip, playing on a loop) from "Same desk. Different Monday." behind the sign-up band, pulled back slowly as you scroll (a slow camera move),
// under a violet wash so the white text stays readable. Still with reduce motion on.
export default function CtaBackdrop() {
  const ref = useRef(null);
  const reduce = usePrefersReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const scale = useTransform(scrollYProgress, [0, 1], [1.25, 1.05]);
  const x = useTransform(scrollYProgress, [0, 1], ["3%", "-3%"]);
  return (
    <div ref={ref} aria-hidden="true" className="absolute inset-0 -z-10 overflow-hidden rounded-[inherit]">
      <motion.div className="absolute inset-0" style={{ scale: reduce ? 1 : scale, x: reduce ? 0 : x }}>
        <FilmVideo name="after" />
      </motion.div>
      <div className="absolute inset-0 bg-[linear-gradient(115deg,color-mix(in_oklab,var(--accent)_92%,black)_0%,color-mix(in_oklab,var(--accent)_70%,transparent)_55%,color-mix(in_oklab,var(--accent)_35%,transparent)_100%)]" />
    </div>
  );
}
