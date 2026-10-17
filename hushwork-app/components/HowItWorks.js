"use client";

import { useRef } from "react";
import { motion, useInView, useScroll } from "motion/react";
import { Icon } from "./icons";
import { Reveal } from "./ui";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

const STEPS = [
  ["Describe it", "“Every Monday, summarise new leads and email me the top five.”", "MessageSquareText"],
  ["Review the plan", "Hushwork shows each step and the tools it will touch. You approve or edit.", "ListChecks"],
  ["Let it run", "It runs on schedule, flags anything unusual and keeps a log of every action.", "Play"],
];

// One step on the timeline. The line below it fills in as you scroll past (the order of the steps is shown by the line, not by numbers),
// and the marker lights up once the step has been reached.
function Step({ title, body, icon, index, isLast }) {
  const ref = useRef(null);
  const reduce = usePrefersReducedMotion();
  const reached = useInView(ref, { margin: "0px 0px -45% 0px", once: true });
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 70%", "end 55%"] });
  return (
    <li ref={ref} className="relative pb-12 pl-16 last:pb-0">
      {!isLast && (
        <>
          <span className="absolute bottom-0 left-5 top-12 w-px bg-line" aria-hidden="true" />
          <motion.span className="absolute bottom-0 left-5 top-12 w-px origin-top bg-accent" style={{ scaleY: reduce ? 1 : scrollYProgress }} aria-hidden="true" />
        </>
      )}
      <span className={`absolute left-0 top-0 grid h-10 w-10 place-items-center rounded-xl border transition-colors duration-340 ease-standard ${reached ? "border-accent bg-accent text-on-accent" : "border-line bg-surface text-accent-text"}`}>
        <Icon name={icon} size={18} />
      </span>
      <Reveal delay={index * 0.05}>
        <h3 className="text-xl font-semibold leading-10">{title}</h3>
        <p className="mt-1 max-w-md leading-relaxed text-mute">{body}</p>
      </Reveal>
    </li>
  );
}

export default function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-6xl px-5 py-24">
      <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] md:gap-16">
        <h2 className="text-3xl font-semibold tracking-tight md:sticky md:top-28 md:self-start md:text-4xl">Three steps. No code.</h2>
        <ol>
          {STEPS.map(([title, body, icon], i) => (
            <Step key={title} title={title} body={body} icon={icon} index={i} isLast={i === STEPS.length - 1} />
          ))}
        </ol>
      </div>
    </section>
  );
}
