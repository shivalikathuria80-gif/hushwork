"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion, useMotionValue, useScroll, useTransform } from "motion/react";
import { Icon } from "./icons";
import { useCoverBox } from "./photoScenes";
import { FilmReel, FilmTitle } from "./FilmBits";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

// "Same desk. Different Monday." as a full-screen scene: the messy desk fills the screen while the section stays pinned, and the
// scroll wipes the tidy desk in from the right behind a white hairline, like a film transition. The nagging notes sit on the mess,
// the done notes on the tidy desk (glued to the photo, so they stay on the same spot at any screen shape). The camera pushes in slowly.
// With reduce motion on there is no pin: the photo sits half and half, still.

const SIZE = [1264, 848];
const MESS = [
  ["43 unread emails", "left-[6%] top-[16%]", -4],
  ["Invoice #1042 overdue", "left-[46%] top-[22%]", 3],
  ["3 missed Slack pings", "left-[24%] top-[33%]", -2],
  ["Weekly report due", "left-[8%] top-[44%]", 2],
];
const DONE = [
  ["Inbox summed up in 5 lines", "right-[8%] top-[14%]"],
  ["Invoice reminder sent", "right-[24%] top-[29%]"],
  ["Report posted to Slack", "right-[6%] top-[42%]"],
];
const REEL = [["9:04", "Without Hushwork"], ["9:05", "With Hushwork"]];

export default function BeforeAfter() {
  const track = useRef(null);
  const stage = useRef(null);
  const reduce = usePrefersReducedMotion();
  const box = useCoverBox(stage, SIZE[0], SIZE[1]);
  const { scrollYProgress } = useScroll({ target: track, offset: ["start start", "end end"] });
  const half = useMotionValue(0.5);
  const p = reduce ? half : scrollYProgress;

  const edge = useTransform(p, [0.2, 0.75], [100, 0], { clamp: true }); // where the tidy photo starts, % from the left
  const clip = useTransform(edge, (v) => `inset(0 0 0 ${v}%)`);
  const left = useTransform(edge, (v) => `${v}%`);
  const push = useTransform(p, [0, 1], [1.16, 1.02]);
  const before = useTransform(p, [0.3, 0.48], [1, 0]);
  const after = useTransform(p, [0.5, 0.68], [0, 1]);
  const messO = useTransform(edge, [20, 60], [0, 1]);
  const doneO = useTransform(edge, [40, 10], [0, 1]);
  const lineO = useTransform(edge, [0, 2, 98, 100], [0, 1, 1, 0]);

  const glued = (children) => box && <div className="absolute" style={{ left: box.left, top: box.top, width: box.width, height: box.height }}>{children}</div>;

  return (
    <section id="monday" aria-labelledby="monday-heading" className="relative bg-black text-white">
      <div ref={track} className={reduce ? "" : "relative h-[280vh]"}>
        <div ref={stage} className={`${reduce ? "relative h-dvh min-h-[560px]" : "sticky top-0 h-dvh"} overflow-hidden`}>
          {/* The messy desk. */}
          <motion.div className="absolute inset-0" style={{ scale: reduce ? 1.02 : push }}>
            <Image src="/landing/before.jpg" alt="A cluttered desk covered in sticky notes, in cold light" fill sizes="100vw" className="object-cover" />
            {glued(
              <motion.ul aria-hidden="true" style={{ opacity: messO }} className="absolute inset-0 hidden sm:block">
                {MESS.map(([label, at, turn], i) => (
                  <li key={label} className={`absolute ${at}`} style={{ rotate: `${turn}deg` }}>
                    <span className="hw-nag items-center gap-2 border border-white/25 bg-black/70 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.12em] text-white sm:text-[13px]" style={{ "--d": `${i * 0.7}s` }}>
                      <span className="h-1.5 w-1.5 rounded-full bg-error" />{label}
                    </span>
                  </li>
                ))}
              </motion.ul>,
            )}
          </motion.div>
          {/* Phones crop the photo hard, so there the notes stack in a corner of the screen instead of sitting on the desk. */}
          <motion.ul aria-hidden="true" style={{ opacity: messO }} className="absolute left-5 top-24 space-y-2 sm:hidden">
            {MESS.slice(0, 3).map(([label]) => (
              <li key={label} className="flex w-max items-center gap-2 border border-white/25 bg-black/70 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-white"><span className="h-1.5 w-1.5 rounded-full bg-error" />{label}</li>
            ))}
          </motion.ul>

          {/* The tidy desk, wiped in from the right. */}
          <motion.div className="absolute inset-0" style={{ clipPath: clip }}>
            <motion.div className="absolute inset-0" style={{ scale: reduce ? 1.02 : push }}>
              <Image src="/landing/after.jpg" alt="The same desk, tidy, in warm morning light" fill sizes="100vw" className="object-cover" />
              {glued(
                <motion.ul aria-hidden="true" style={{ opacity: doneO }} className="absolute inset-0 hidden sm:block">
                  {DONE.map(([label, at]) => (
                    <li key={label} className={`absolute ${at} flex items-center gap-2 border border-white/25 bg-black/60 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.12em] text-white sm:text-[13px]`}>
                      <Icon name="Check" size={12} weight="bold" className="text-success" />{label}
                    </li>
                  ))}
                </motion.ul>,
              )}
            </motion.div>
            <motion.ul aria-hidden="true" style={{ opacity: doneO }} className="absolute right-5 top-24 space-y-2 sm:hidden">
              {DONE.map(([label]) => (
                <li key={label} className="ml-auto flex w-max items-center gap-2 border border-white/25 bg-black/60 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-white"><Icon name="Check" size={11} weight="bold" className="text-success" />{label}</li>
              ))}
            </motion.ul>
          </motion.div>
          <motion.span aria-hidden="true" className="absolute inset-y-0 z-10 w-px bg-white" style={{ left, opacity: lineO }} />

          <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.85)_0%,rgba(0,0,0,0.3)_40%,rgba(0,0,0,0)_65%)]" />
          <div className="absolute inset-x-0 bottom-20 z-10 mx-auto max-w-6xl px-5 sm:bottom-24">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-white/70">Monday, 9:04</p>
            <h2 id="monday-heading" className="sr-only">Same desk. Different Monday.</h2>
            <div aria-hidden="true" className="relative mt-3 h-[2.1em] text-[length:clamp(2.75rem,8.5vw,8rem)] leading-[0.92]">
              <motion.span className="absolute inset-x-0 bottom-0" style={{ opacity: reduce ? 1 : before }}><FilmTitle text="Forty-seven things *need you.*" /></motion.span>
              {!reduce && <motion.span className="absolute inset-x-0 bottom-0" style={{ opacity: after }}><FilmTitle text="Done before *coffee.*" /></motion.span>}
            </div>
            <p className="mt-5 max-w-md text-lg font-extralight leading-relaxed text-white/85">Same desk, same Monday. On the right, the morning after Hushwork ran first.</p>
          </div>
          {!reduce && <FilmReel items={REEL} progress={scrollYProgress} active={-1} />}
        </div>
      </div>
    </section>
  );
}
