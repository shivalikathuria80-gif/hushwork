"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useScroll } from "motion/react";
import { Icon } from "./icons";
import { Reveal } from "./ui";
import { LivePhoto, usePhases, useTyped } from "./LivePhoto";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

const SPRING = { type: "spring", stiffness: 260, damping: 24 };
const ASK = "Every Monday, summarise new leads and email me the top five.";

// Step 1 on the photo: the sentence types itself in a bubble beside the hands, then Hushwork answers with a plan.
function DescribeLive() {
  const ref = useRef(null);
  const phase = usePhases(ref, [900, 3400, 1300, 2800]);
  const typed = useTyped(ASK, phase >= 1);
  return (
    <div ref={ref} aria-hidden="true" className="absolute inset-x-[6%] top-[7%] space-y-2">
      <div className="rounded-2xl rounded-bl-md border border-white/15 bg-black/55 px-3.5 py-2.5 text-[13px] leading-snug text-white shadow-lg backdrop-blur-md sm:text-sm">
        {typed}<span className="hw-caret ml-0.5 inline-block h-[1em] w-px translate-y-[2px] bg-white" />
      </div>
      <AnimatePresence>
        {phase >= 2 && (
          <motion.div key="plan" initial={{ opacity: 0, y: 10, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6 }} transition={SPRING}
            className="ml-auto w-max max-w-full rounded-2xl rounded-br-md border border-accent/40 bg-accent/85 px-3.5 py-2.5 text-[13px] font-medium text-on-accent shadow-lg backdrop-blur-md sm:text-sm">
            {phase === 2 ? (
              <span className="inline-flex items-center gap-2"><Icon name="Loader2" size={14} className="animate-spin" />Building the plan</span>
            ) : (
              <span className="inline-flex items-center gap-2"><Icon name="ListChecks" size={14} />Plan ready: 3 steps, Gmail and Sheets</span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Step 2 on the phone's screen: the approval card, a thumb tap with a ripple, then "Sent".
// The box is fitted to the screen in approve.jpg (it leans like the phone: a slight turn and a slant), and the thumb, cut out of the
// same photo (approve-thumb.png), sits on top so the finger is in front of the screen, and presses down when it taps.
function ApproveLive() {
  const ref = useRef(null);
  const phase = usePhases(ref, [1600, 450, 550, 2600]);
  const sent = phase === 3;
  const press = phase === 2;
  return (
    <div ref={ref} aria-hidden="true" className="absolute inset-0">
      <div className="absolute left-[44.1%] top-[33.6%] h-[38.6%] w-[21.6%] overflow-hidden rounded-[14%/6%] bg-[#f7f7fa] text-[#17151f] [transform:rotate(1.5deg)_skewX(-16deg)]">
        <div className="absolute inset-x-[10%] top-[7%] text-[clamp(6px,0.95vw,10px)] leading-tight">
          <p className="font-semibold text-[#6d4aff]">Hushwork</p>
          <p className="mt-[8%] text-[1.15em] font-semibold">Send the digest?</p>
          <p className="mt-[4%] text-[#5b5868]">Top 5 leads, to your inbox</p>
        </div>
        <div className="absolute inset-x-[10%] top-[46%] h-[9%] text-[clamp(6px,0.95vw,10px)]">
          <AnimatePresence mode="wait" initial={false}>
            {sent ? (
              <motion.p key="sent" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} transition={SPRING} className="flex h-full items-center justify-center gap-1 rounded-full bg-[#1f9d55] font-semibold text-white">
                <Icon name="Check" size={10} weight="bold" />Sent
              </motion.p>
            ) : (
              <motion.p key="ask" animate={{ scale: press ? 0.93 : 1, backgroundColor: press ? "#5835e0" : "#6d4aff" }} transition={SPRING} className="relative flex h-full items-center justify-center overflow-hidden rounded-full font-semibold text-white">
                Approve
                {phase >= 1 && <motion.span initial={{ scale: 0, opacity: 0.6 }} animate={{ scale: 4, opacity: 0 }} transition={{ duration: 0.8, ease: "easeOut" }} className="absolute left-[28%] top-1/2 -ml-2 -mt-2 h-4 w-4 rounded-full bg-white" />}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
        <motion.p className="absolute inset-x-[10%] top-[62%] text-center text-[clamp(5px,0.8vw,9px)] text-[#5b5868]" animate={{ opacity: sent ? 1 : 0 }}>Logged in your run history</motion.p>
      </div>
      <motion.img src="/landing/approve-thumb.png" alt="" draggable={false} className="absolute left-[30.17%] top-[48.61%] h-[13.89%] w-[25.86%] max-w-none"
        animate={{ x: press ? "-2%" : phase === 1 ? "-1%" : "0%", y: press ? "5%" : "0%" }} transition={{ type: "spring", stiffness: 300, damping: 20 }} />
    </div>
  );
}

// Step 3 on the night photo: the laptop glows like a breath, and the morning briefing lands as a notification.
function RestLive() {
  const ref = useRef(null);
  const reduce = usePrefersReducedMotion();
  const phase = usePhases(ref, [1700, 3400, 900]);
  return (
    <div ref={ref} aria-hidden="true" className="absolute inset-0">
      {!reduce && <motion.span className="absolute left-[30%] top-[42%] h-[20%] w-[22%] rounded-full bg-[#a78bfa] mix-blend-screen blur-2xl" animate={{ opacity: phase === 1 ? 0.75 : 0.3, scale: phase === 1 ? 1.15 : 1 }} transition={{ duration: 1.2, ease: "easeInOut" }} />}
      <AnimatePresence>
        {phase === 1 && (
          <motion.div key="toast" initial={{ y: -40, opacity: 0, scale: 0.96 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: -24, opacity: 0 }} transition={SPRING}
            className="absolute inset-x-[7%] top-[6%] flex items-center gap-3 rounded-2xl border border-white/15 bg-black/60 p-3 text-white shadow-xl backdrop-blur-md">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-accent text-on-accent"><Icon name="Sunrise" size={16} /></span>
            <span className="min-w-0 text-[13px] leading-tight">
              <span className="block font-semibold">Morning briefing is ready</span>
              <span className="block text-white/70">Ran at 6:30 while you slept. 3 things need you.</span>
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const STEPS = [
  { title: "Describe it", body: `“${ASK}”`, icon: "MessageSquareText", src: "/landing/describe.jpg", alt: "Hands typing on a laptop at dusk", Live: DescribeLive },
  { title: "Review the plan", body: "Hushwork shows each step and the tools it will touch. Nothing is sent until you tap approve.", icon: "ListChecks", src: "/landing/approve.jpg", alt: "A phone held in a cafe, showing an approval card", Live: ApproveLive },
  { title: "Let it run", body: "It runs on schedule, flags anything unusual and keeps a log of every action. Even at night.", icon: "Play", src: "/landing/rest.jpg", alt: "A quiet home office at night, the laptop still glowing", Live: RestLive },
];
const SIZE = { width: 928, height: 1152 };

// One step on the timeline. The line below it fills in as you scroll past, and the marker lights up when it is the step in view.
function Step({ step, index, isLast, active, reached, stepRef }) {
  const ref = useRef(null);
  const reduce = usePrefersReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 60%", "end 45%"] });
  const { Live } = step;
  return (
    <li ref={(n) => { ref.current = n; stepRef(n); }} data-step={index} className="relative pb-14 pl-16 last:pb-0 md:flex md:min-h-[70vh] md:flex-col md:justify-center md:pb-0">
      {!isLast && (
        <>
          <span className="absolute bottom-0 left-5 top-12 w-px bg-line md:top-[calc(50%+24px)] md:-bottom-[calc(35vh-24px)]" aria-hidden="true" />
          <motion.span className="absolute bottom-0 left-5 top-12 w-px origin-top bg-accent md:top-[calc(50%+24px)] md:-bottom-[calc(35vh-24px)]" style={{ scaleY: reduce ? 1 : scrollYProgress }} aria-hidden="true" />
        </>
      )}
      <div className="relative">
        <motion.span
          animate={reduce ? undefined : { scale: active ? 1.12 : 1 }} transition={SPRING}
          className={`absolute -left-16 top-0 grid h-10 w-10 place-items-center rounded-xl border transition-colors duration-340 ease-standard ${reached ? "border-accent bg-accent text-on-accent" : "border-line bg-surface text-accent-text"}`}
        >
          {active && !reduce && <span aria-hidden="true" className="hw-ping absolute inset-0 rounded-xl border border-accent" />}
          <Icon name={step.icon} size={18} />
        </motion.span>
        <Reveal delay={index * 0.05}>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-text">Step {index + 1}</p>
          <h3 className={`text-2xl font-semibold transition-colors duration-300 md:text-3xl ${active ? "text-ink" : "md:text-mute"}`}>{step.title}</h3>
          <p className="mt-2 max-w-md leading-relaxed text-mute">{step.body}</p>
        </Reveal>
        {/* Phones and small screens: the photo sits right under its step. */}
        <LivePhoto src={step.src} alt={step.alt} {...SIZE} sizes="90vw" className="mt-6 max-w-[360px] md:hidden"><Live /></LivePhoto>
      </div>
    </li>
  );
}

export default function HowItWorks() {
  const [active, setActive] = useState(0);
  const [reached, setReached] = useState(-1);
  const nodes = useRef([]);
  const reduce = usePrefersReducedMotion();

  // The step crossing the middle of the screen is the active one; the photo beside the steps follows it.
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) {
        const i = Number(e.target.dataset.step);
        setActive(i);
        setReached((r) => Math.max(r, i));
      }
    }, { rootMargin: "-45% 0px -45% 0px" });
    nodes.current.forEach((n) => n && io.observe(n));
    return () => io.disconnect();
  }, []);

  const step = STEPS[active];
  return (
    <section id="how" className="mx-auto max-w-6xl px-5 py-24">
      <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:gap-16">
        <div className="md:sticky md:top-24 md:self-start">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Three steps. No code.</h2>
          <p className="mt-2 text-mute">Scroll through a real Monday.</p>
          {/* Bigger screens: one photo frame stays put and wipes to the next photo as each step comes up. */}
          <div className="relative mt-8 hidden aspect-[928/1152] max-h-[calc(100dvh-14rem)] md:block">
            <AnimatePresence initial={false}>
              <motion.div key={active} className="absolute inset-0" initial={reduce ? { opacity: 0 } : { opacity: 1 }} animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.94, filter: "blur(6px)" }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
                <LivePhoto src={step.src} alt={step.alt} {...SIZE} sizes="40vw" className="mx-auto h-full max-w-full [aspect-ratio:928/1152]"><step.Live /></LivePhoto>
              </motion.div>
            </AnimatePresence>
            <ol aria-hidden="true" className="absolute -right-5 top-1/2 flex -translate-y-1/2 flex-col gap-2">
              {STEPS.map((s, i) => <li key={s.title} className={`h-6 w-1 rounded-full transition-colors duration-300 ${i === active ? "bg-accent" : "bg-line"}`} />)}
            </ol>
          </div>
        </div>
        <ol>
          {STEPS.map((s, i) => (
            <Step key={s.title} step={s} index={i} isLast={i === STEPS.length - 1} active={i === active} reached={i <= reached} stepRef={(n) => { nodes.current[i] = n; }} />
          ))}
        </ol>
      </div>
    </section>
  );
}
