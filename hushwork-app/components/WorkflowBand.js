"use client";

import { useRef } from "react";
import { motion, useAnimationFrame, useInView, useMotionValue, useTransform } from "motion/react";
import { Icon } from "./icons";
import { PauseButton } from "./ui";
import { useMotionPause } from "./MotionProvider";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

// Sample workflows drifting past, so a visitor sees the shape of what Hushwork runs: trigger, action, result.
// Real components (not pictures), so they follow the light/dark theme.
const WORKFLOWS = [
  [["Mail", "New email"], ["Sparkles", "Summarise"], ["Send", "Send digest"]],
  [["UserPlus", "New lead"], ["Brain", "Score with AI"], ["Table", "Add to CRM"]],
  [["Receipt", "Invoice due"], ["PenLine", "Draft reminder"], ["CircleCheck", "Send & log"]],
  [["FileText", "Form submitted"], ["Search", "Extract data"], ["Table", "Update sheet"]],
  [["Clock", "Every Monday"], ["FileBarChart", "Pull metrics"], ["MessageSquare", "Post to Slack"]],
];
const COUNT = 9; // cards in the loop
const PITCH = 262; // distance between cards, px
const TOTAL = COUNT * PITCH;

function BandCard({ index, offset }) {
  // Each card's position and tilt are worked out from one shared number (offset). These are motion values:
  // they update the card directly, without re-rendering React, so the band stays smooth.
  const x = useTransform(offset, (o) => ((((index * PITCH - o) % TOTAL) + TOTAL) % TOTAL) - TOTAL / 2);
  const k = useTransform(x, (v) => Math.max(-1, Math.min(1, v / 640)));
  const rotateY = useTransform(k, (v) => -v * 62);
  const scale = useTransform(k, (v) => 1 + Math.abs(v) * 0.25);
  const opacity = useTransform(k, (v) => (Math.abs(v) >= 1 ? 0 : 1));
  const steps = WORKFLOWS[index % WORKFLOWS.length];
  return (
    <motion.div style={{ x, rotateY, scale, opacity }} className="absolute left-1/2 top-1/2 -ml-[120px] -mt-[75px] h-[150px] w-[240px] rounded-2xl border border-line bg-surface p-4">
      <div className="relative flex h-full items-center justify-between">
        <span className="absolute left-7 right-7 top-[26px] border-t border-dashed border-field" />
        {steps.map(([icon, label]) => (
          <div key={label} className="relative flex w-[64px] flex-col items-center gap-2 text-center">
            <span className="grid h-[34px] w-[34px] place-items-center rounded-full border border-line bg-raised text-accent-text"><Icon name={icon} size={16} /></span>
            <span className="text-[12px] font-medium leading-tight text-ink">{label}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export default function WorkflowBand() {
  const ref = useRef(null);
  const offset = useMotionValue(0);
  const inView = useInView(ref);
  const reduce = usePrefersReducedMotion();
  const { paused, toggle } = useMotionPause();
  const active = inView && !paused && !reduce;

  // Slides the band. It does nothing when scrolled offscreen, paused, or when the visitor asked for reduced motion.
  useAnimationFrame((_, delta) => {
    if (active) offset.set(offset.get() + delta * 0.04);
  });

  return (
    <div className="pb-10">
      <div
        ref={ref} aria-hidden="true"
        style={{ perspective: 900, perspectiveOrigin: "50% 78%" }}
        className="relative h-[210px] overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_14%,#000_86%,transparent)]"
      >
        {Array.from({ length: COUNT }, (_, i) => <BandCard key={i} index={i} offset={offset} />)}
      </div>
      {!reduce && (
        <div className="mx-auto flex max-w-6xl justify-end px-5">
          <PauseButton paused={paused} onToggle={toggle} />
        </div>
      )}
    </div>
  );
}
