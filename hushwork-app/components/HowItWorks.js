"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll, useSpring, useTransform } from "motion/react";
import { Icon } from "./icons";
import { FilmReel, FilmTitle } from "./FilmBits";
import CameraFilm, { shotRanges } from "./CameraFilm";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

// "How it works" as a short film made in code (CameraFilm.js) that the scroll plays, two shots per step: the room at dusk, then
// a tilted macro of the hands on the keys that dives into the screen and comes out on the phone in the cafe, which whips to the
// busy room and flashes into the office at night, craning down to the glowing laptop. The section stays pinned; scroll fast and
// the camera flies fast, scroll back and it runs back. No timer anywhere: the request types itself, the approve button gets
// tapped and the briefing lands as the scroll reaches each moment.
// With reduce motion there is no pin and no film: one still photo per step, with its words.

const SPRING = { type: "spring", stiffness: 260, damping: 24 };
const ASK = "Every Monday, summarise new leads and email me the top five.";
const N = 3;

const D = { src: "/landing/describe.jpg", size: [928, 1152] };
const P = { src: "/landing/approve.jpg", size: [928, 1152] };
const Z = { src: "/landing/rest.jpg", size: [928, 1152] };
const SHOTS = [
  { ...D, alt: "Hands typing on a laptop at dusk", into: "whip",
    keys: [{ t: 0, x: 0.45, y: 0.42, z: 1.05, rx: -5, ry: 6 }, { t: 1, x: 0.52, y: 0.55, z: 1.4, ry: -4 }] },
  { ...D, alt: "", into: "zoom", blur: [[0, 6], [0.3, 0], [1, 0]],
    keys: [{ t: 0, x: 0.62, y: 0.64, z: 2.1, rx: 20, rz: -6 }, { t: 1, x: 0.8, y: 0.5, z: 2.3, rx: 6, ry: -10, rz: 1 }] },
  { ...P, alt: "A phone held in a cafe, showing an approval card", into: "whip",
    keys: [{ t: 0, x: 0.66, y: 0.42, z: 1.85, ry: 12, rz: 6 }, { t: 1, x: 0.62, y: 0.45, z: 1.55, ry: -2, rz: 0 }] },
  { ...P, alt: "", into: "flash", blur: [[0, 0], [0.6, 0], [1, 5]],
    keys: [{ t: 0, x: 0.35, y: 0.3, z: 1.6, ry: -14 }, { t: 1, x: 0.55, y: 0.4, z: 1.05, ry: 6 }] },
  { ...Z, alt: "A quiet home office at night, the laptop still glowing", into: "whip",
    keys: [{ t: 0, x: 0.5, y: 0.22, z: 1.6, rx: -18 }, { t: 1, x: 0.42, y: 0.5, z: 1.25, rx: 0 }] },
  { ...Z, alt: "", len: 1.2, blur: [[0, 5], [0.3, 0], [1, 0]],
    keys: [{ t: 0, x: 0.36, y: 0.52, z: 1.6, ry: 9, rz: -2 }, { t: 1, x: 0.4, y: 0.55, z: 1.95, ry: -5 }] },
];
const R = shotRanges(SHOTS);
// Each step is two shots.
const CH = [0, 1, 2].map((i) => [R[i * 2][0], R[i * 2 + 1][1]]);

const STEPS = [
  { num: "01", label: "Describe", title: "Describe *it.*", body: "Write the chore the way you would tell a colleague. No nodes, no code." },
  { num: "02", label: "Approve", title: "Approve *the plan.*", body: "Hushwork shows each step and the tools it will touch. Nothing is sent until you tap approve." },
  { num: "03", label: "Let it run", title: "Let it *run.*", body: "It runs on schedule, flags anything unusual and keeps a log of every action. Even at night." },
];

// Step 1: the sentence types itself as you scroll, then Hushwork answers with a plan.
function Describe({ t }) {
  const typed = ASK.slice(0, Math.round(Math.min(1, t / 0.6) * ASK.length));
  return (
    <div aria-hidden="true" className="absolute right-5 top-28 w-[min(24rem,calc(100%-2.5rem))] space-y-2 sm:right-[6%] sm:top-[22%]">
      <div className="rounded-2xl rounded-bl-md border border-white/15 bg-black/55 px-3.5 py-2.5 text-[13px] leading-snug text-white shadow-lg backdrop-blur-md sm:text-sm">
        {typed}<span className="hw-caret ml-0.5 inline-block h-[1em] w-px translate-y-[2px] bg-white" />
      </div>
      <AnimatePresence>
        {t > 0.66 && (
          <motion.div key="plan" initial={{ opacity: 0, y: 10, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6 }} transition={SPRING}
            className="ml-auto w-max max-w-full rounded-2xl rounded-br-md border border-accent/40 bg-accent/85 px-3.5 py-2.5 text-[13px] font-medium text-on-accent shadow-lg backdrop-blur-md sm:text-sm">
            {t < 0.8 ? (
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

// Step 2: the approval card, tapped as the scroll passes the middle of the step, then "Sent".
function Approve({ t }) {
  const press = t > 0.45 && t < 0.55;
  const sent = t >= 0.55;
  return (
    <div aria-hidden="true" className="absolute right-5 top-28 w-[min(19rem,calc(100%-2.5rem))] rounded-3xl border border-white/15 bg-[#f7f7fa]/95 p-5 text-[#17151f] shadow-2xl backdrop-blur-md sm:right-[8%] sm:top-[24%]">
      <p className="text-xs font-semibold text-[#6d4aff]">Hushwork</p>
      <p className="mt-2 text-lg font-semibold">Send the digest?</p>
      <p className="mt-1 text-sm text-[#5b5868]">Top 5 leads, to your inbox. Gmail, Sheets.</p>
      <div className="mt-4 h-10 text-sm">
        <AnimatePresence mode="wait" initial={false}>
          {sent ? (
            <motion.p key="sent" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} transition={SPRING} className="flex h-full items-center justify-center gap-1.5 rounded-full bg-[#1f9d55] font-semibold text-white">
              <Icon name="Check" size={14} weight="bold" />Sent
            </motion.p>
          ) : (
            <motion.p key="ask" animate={{ scale: press ? 0.93 : 1, backgroundColor: press ? "#5835e0" : "#6d4aff" }} transition={SPRING} className="relative flex h-full items-center justify-center overflow-hidden rounded-full font-semibold text-white">
              Approve
              {press && <motion.span initial={{ scale: 0, opacity: 0.6 }} animate={{ scale: 6, opacity: 0 }} transition={{ duration: 0.7, ease: "easeOut" }} className="absolute left-1/2 top-1/2 -ml-2 -mt-2 h-4 w-4 rounded-full bg-white" />}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
      <motion.p className="mt-2 text-center text-xs text-[#5b5868]" animate={{ opacity: sent ? 1 : 0 }}>Logged in your run history</motion.p>
    </div>
  );
}

// Step 3: the morning briefing lands as a notification.
function Rest({ t }) {
  return (
    <div aria-hidden="true" className="absolute right-5 top-28 w-[min(22rem,calc(100%-2.5rem))] sm:right-[6%] sm:top-[22%]">
      <AnimatePresence>
        {t > 0.35 && (
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
const LIVE = [Describe, Approve, Rest];

// The words for one step: they rise in as the camera reaches it and lift away as it leaves.
function Words({ step, index, p }) {
  const [a, b] = CH[index], f = 0.04;
  // In after the camera reaches the step, out before it leaves, so two steps' words never sit on top of each other.
  const y = useTransform(p, [a, a + f, b - f, b], [index === 0 ? 0 : 80, 0, 0, index === N - 1 ? 0 : -60]);
  const opacity = useTransform(p, [a, a + f, b - f, b], [index === 0 ? 1 : 0, 1, 1, index === N - 1 ? 1 : 0]);
  return (
    <motion.div className="absolute inset-x-0 bottom-20 z-10 mx-auto max-w-6xl px-5 text-white sm:bottom-24" style={{ y, opacity }}>
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-white/70"><span className="tabular-nums">{step.num}</span> / 0{N}</p>
      <h3 className="mt-3"><FilmTitle text={step.title} /></h3>
      <p className="mt-5 max-w-md text-lg font-extralight leading-relaxed text-white/85">{step.body}</p>
    </motion.div>
  );
}

const Scrims = () => (
  <>
    <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.85)_0%,rgba(0,0,0,0.35)_45%,rgba(0,0,0,0)_70%)]" />
    <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.55)_0%,rgba(0,0,0,0)_55%)]" />
  </>
);

export default function HowItWorks() {
  const track = useRef(null);
  const reduce = usePrefersReducedMotion();
  const { scrollYProgress } = useScroll({ target: track, offset: ["start start", "end end"] });
  const p = useSpring(scrollYProgress, { stiffness: 260, damping: 34, mass: 0.35 });
  const [at, setAt] = useState(0); // where the scroll is, to the nearest 1/300, for the live parts
  useMotionValueEvent(p, "change", (v) => setAt(Math.round(v * 300) / 300));
  const active = Math.max(0, CH.findLastIndex(([a]) => at >= a));
  const t = (at - CH[active][0]) / (CH[active][1] - CH[active][0]); // how far into the step showing, 0 to 1
  const Live = LIVE[active];
  const reel = STEPS.map((s) => [s.num, s.label]);

  return (
    <section id="how" aria-labelledby="how-heading" className="relative bg-black text-white">
      <h2 id="how-heading" className="pointer-events-none absolute inset-x-0 top-24 z-30 mx-auto max-w-6xl px-5 text-xs font-medium uppercase tracking-[0.22em] text-white/70">
        How it works <span className="text-white/40">· Three steps, no code</span>
      </h2>
      {reduce ? (
        <div>
          {STEPS.map((s, i) => (
            <div key={s.num} className="relative h-dvh min-h-[560px] overflow-hidden">
              <CameraFilm shots={[SHOTS[i * 2]]} still />
              <Scrims />
              <div className="absolute inset-x-0 bottom-20 z-10 mx-auto max-w-6xl px-5 text-white sm:bottom-24">
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-white/70"><span className="tabular-nums">{s.num}</span> / 0{N}</p>
                <h3 className="mt-3"><FilmTitle text={s.title} /></h3>
                <p className="mt-5 max-w-md text-lg font-extralight leading-relaxed text-white/85">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div ref={track} className="relative h-[520vh]">
          <div className="sticky top-0 h-dvh overflow-hidden">
            <CameraFilm shots={SHOTS} progress={p} />
            <Scrims />
            <Live t={t} />
            {STEPS.map((s, i) => <Words key={s.num} step={s} index={i} p={p} />)}
            <FilmReel items={reel} progress={p} active={active} />
          </div>
        </div>
      )}
    </section>
  );
}
