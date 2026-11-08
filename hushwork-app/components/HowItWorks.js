"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useMotionValue, useMotionValueEvent, useScroll, useTransform } from "motion/react";
import { Icon } from "./icons";
import { useCoverBox, useFilmClock, usePhases, useTyped } from "./photoScenes";
import { FilmReel, FilmTitle } from "./FilmBits";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

// "How it works" as a short film: the three photos (made with Nano Banana) fill the screen one after another while the section
// stays pinned, and the scroll moves the camera (a slow push in) and dissolves from one photo to the next. Huge thin type sits
// over each photo, and small live scenes play on top of it: the request types itself, the phone gets tapped, the laptop glows.
// With reduce motion on there is no pin: the three photos simply stack, each one still.

const SPRING = { type: "spring", stiffness: 260, damping: 24 };
const ASK = "Every Monday, summarise new leads and email me the top five.";

// Step 1 on the photo: the sentence types itself in a bubble beside the hands, then Hushwork answers with a plan.
function DescribeFree({ phase }) {
  const typed = useTyped(ASK, phase >= 1);
  return (
    <div aria-hidden="true" className="absolute right-5 top-28 w-[min(24rem,calc(100%-2.5rem))] space-y-2 sm:right-[6%] sm:top-[22%]">
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
function ApproveGlued({ phase }) {
  const sent = phase === 3;
  const press = phase === 2;
  return (
    <div aria-hidden="true" className="absolute inset-0">
      <div className="absolute left-[44.1%] top-[33.6%] h-[38.6%] w-[21.6%] overflow-hidden rounded-[14%/6%] bg-[#f7f7fa] text-[#17151f] [transform:rotate(1.5deg)_skewX(-16deg)]">
        <div className="absolute inset-x-[10%] top-[7%] text-[clamp(7px,1.1vmin,12px)] leading-tight">
          <p className="font-semibold text-[#6d4aff]">Hushwork</p>
          <p className="mt-[8%] text-[1.15em] font-semibold">Send the digest?</p>
          <p className="mt-[4%] text-[#5b5868]">Top 5 leads, to your inbox</p>
        </div>
        <div className="absolute inset-x-[10%] top-[46%] h-[9%] text-[clamp(7px,1.1vmin,12px)]">
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
        <motion.p className="absolute inset-x-[10%] top-[62%] text-center text-[clamp(6px,0.9vmin,10px)] text-[#5b5868]" animate={{ opacity: sent ? 1 : 0 }}>Logged in your run history</motion.p>
      </div>
      <motion.img src="/landing/approve-thumb.png" alt="" draggable={false} className="absolute left-[30.17%] top-[48.61%] h-[13.89%] w-[25.86%] max-w-none"
        animate={{ x: press ? "-2%" : phase === 1 ? "-1%" : "0%", y: press ? "5%" : "0%" }} transition={{ type: "spring", stiffness: 300, damping: 20 }} />
    </div>
  );
}

// Step 3 on the night photo: the laptop glows like a breath, and the morning briefing lands as a notification.
function RestGlued({ phase }) {
  const reduce = usePrefersReducedMotion();
  if (reduce) return null;
  return <motion.span aria-hidden="true" className="absolute left-[30%] top-[42%] h-[20%] w-[22%] rounded-full bg-[#a78bfa] mix-blend-screen blur-2xl" animate={{ opacity: phase === 1 ? 0.75 : 0.3, scale: phase === 1 ? 1.15 : 1 }} transition={{ duration: 1.2, ease: "easeInOut" }} />;
}

function RestFree({ phase }) {
  const reduce = usePrefersReducedMotion(); // still: the briefing simply sits there
  return (
    <div aria-hidden="true" className="absolute right-5 top-28 w-[min(22rem,calc(100%-2.5rem))] sm:right-[6%] sm:top-[22%]">
      <AnimatePresence>
        {(phase === 1 || reduce) && (
          <motion.div key="toast" initial={{ y: -40, opacity: 0, scale: 0.96 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: -24, opacity: 0 }} transition={SPRING}
            className="flex items-center gap-3 rounded-2xl border border-white/15 bg-black/60 p-3 text-white shadow-xl backdrop-blur-md">
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
  { num: "01", label: "Describe", title: "Describe *it.*", body: "Write the chore the way you would tell a colleague. No nodes, no code.", src: "/landing/describe.jpg", alt: "Hands typing on a laptop at dusk", times: [900, 3400, 1300, 2800], Free: DescribeFree, pos: "50% 60%" },
  { num: "02", label: "Approve", title: "Approve *the plan.*", body: "Hushwork shows each step and the tools it will touch. Nothing is sent until you tap approve.", src: "/landing/approve.jpg", alt: "A phone held in a cafe, showing an approval card", times: [1600, 450, 550, 2600], Glued: ApproveGlued, pos: "50% 50%" },
  { num: "03", label: "Let it run", title: "Let it *run.*", body: "It runs on schedule, flags anything unusual and keeps a log of every action. Even at night.", src: "/landing/rest.jpg", alt: "A quiet home office at night, the laptop still glowing", times: [1700, 3400, 900], Glued: RestGlued, Free: RestFree, pos: "50% 50%" },
];
const SIZE = [928, 1152];
const N = STEPS.length;
// The middle of the shot after the one showing; after the last, a straight cut back to the first.
const nextShot = (v) => {
  const i = Math.min(N - 1, Math.floor(v * N)) + 1;
  return i >= N ? { to: 0.5 / N, cut: true } : { to: (i + 0.5) / N };
};

// One full-screen photo with its words and live parts. `p` is the scene's scroll progress (a motion value), or null when still.
function Bay({ step, index, p, active, still }) {
  const ref = useRef(null);
  const box = useCoverBox(ref, SIZE[0], SIZE[1]);
  const phase = usePhases(ref, step.times, still || active);
  const a = index / N, b = (index + 1) / N, fade = 0.06;
  const zero = useMotionValue(0);
  const src = p ?? zero;
  // Fade in over the end of the step before, hold, fade out into the next (the first starts shown, the last stays).
  const opacity = useTransform(src, index === 0 ? [b - fade, b + fade] : index === N - 1 ? [a - fade, a + fade] : [a - fade, a + fade, b - fade, b + fade], index === 0 ? [1, 0] : index === N - 1 ? [0, 1] : [0, 1, 1, 0]);
  const scale = useTransform(src, [a - fade, b + fade], [1.18, 1.02]);
  const textY = useTransform(src, [a - fade, a + fade, b - fade, b + fade], [80, 0, 0, -60]);
  const textO = useTransform(src, [a, a + fade, b - fade, b], [index === 0 ? 1 : 0, 1, 1, index === N - 1 ? 1 : 0]);
  const { Glued, Free } = step;
  return (
    <motion.div ref={ref} className={still ? "relative h-dvh min-h-[560px] overflow-hidden" : "absolute inset-0"} style={still ? undefined : { opacity, zIndex: index }}>
      <motion.div className="absolute inset-0" style={{ scale: still ? 1.02 : scale }}>
        <Image src={step.src} alt={step.alt} fill sizes="100vw" className="object-cover" style={{ objectPosition: step.pos }} priority={index === 0} />
        {Glued && box && (
          <div className="absolute" style={{ left: box.left, top: box.top, width: box.width, height: box.height }}><Glued phase={phase} /></div>
        )}
      </motion.div>
      {/* A scrim so the white type reads on any photo: dark at the bottom left, clear toward the top right. */}
      <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.85)_0%,rgba(0,0,0,0.35)_45%,rgba(0,0,0,0)_70%)]" />
      <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.55)_0%,rgba(0,0,0,0)_55%)]" />
      {Free && <Free phase={phase} />}
      <motion.div className="absolute inset-x-0 bottom-20 z-10 mx-auto max-w-6xl px-5 text-white sm:bottom-24" style={still ? undefined : { y: textY, opacity: textO }}>
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-white/70"><span className="tabular-nums">{step.num}</span> / 0{N}</p>
        <h3 className="mt-3"><FilmTitle text={step.title} /></h3>
        <p className="mt-5 max-w-md text-lg font-extralight leading-relaxed text-white/85">{step.body}</p>
      </motion.div>
    </motion.div>
  );
}

export default function HowItWorks() {
  const track = useRef(null);
  const reduce = usePrefersReducedMotion();
  const { scrollYProgress } = useScroll({ target: track, offset: ["start start", "end end"] });
  // Scroll moves the film, and so does time: left alone, it goes to the next shot every few seconds, then loops back to the first.
  const pos = useFilmClock(scrollYProgress, nextShot);
  const [active, setActive] = useState(0);
  useMotionValueEvent(pos, "change", (v) => setActive(Math.min(N - 1, Math.max(0, Math.floor(v * N)))));
  const reel = STEPS.map((s) => [s.num, s.label]);

  return (
    <section id="how" aria-labelledby="how-heading" className="relative bg-black text-white">
      <h2 id="how-heading" className="pointer-events-none absolute inset-x-0 top-24 z-30 mx-auto max-w-6xl px-5 text-xs font-medium uppercase tracking-[0.22em] text-white/70">
        How it works <span className="text-white/40">· Three steps, no code</span>
      </h2>
      {reduce ? (
        <div>{STEPS.map((s, i) => <Bay key={s.num} step={s} index={i} p={null} active still />)}</div>
      ) : (
        <div ref={track} className="relative h-[400vh]">
          <div className="sticky top-0 h-dvh overflow-hidden">
            {STEPS.map((s, i) => <Bay key={s.num} step={s} index={i} p={pos} active={i === active} />)}
            <FilmReel items={reel} progress={pos} active={active} />
          </div>
        </div>
      )}
    </section>
  );
}
