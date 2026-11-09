"use client";

import { useRef } from "react";
import { motion, useScroll, useSpring, useTransform } from "motion/react";
import { Icon } from "./icons";
import { FilmReel, FilmTitle } from "./FilmBits";
import CameraFilm, { shotRanges } from "./CameraFilm";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

// "Same desk. Different Monday." as a short film made in code (CameraFilm.js) that the scroll plays: the section stays pinned
// while the camera tilts over the messy desk, whips to the buzzing phone, pans the wall of sticky notes and dives into the
// laptop, then flashes out onto the same desk, tidy, craning down from above, a close-up of the coffee, and a pull back.
// Scroll fast and the camera flies fast; scroll back and it flies back. No timer.
// The nagging notes are thrown off the screen on the dive; the done notes land on the tidy desk.
// With reduce motion there is no pin and no film: the first shot, still, with the first title.

const B = { src: "/landing/before.jpg", size: [1264, 848] };
const A = { src: "/landing/after.jpg", size: [1264, 848] };
const SHOTS = [
  { ...B, alt: "A cluttered desk covered in sticky notes, in cold light", into: "whip",
    keys: [{ t: 0, x: 0.5, y: 0.5, z: 1.02, rx: 6, ry: -7 }, { t: 1, x: 0.45, y: 0.4, z: 1.55, rx: 0, ry: 5, rz: -1.5 }] },
  { ...B, alt: "", into: "whip", blur: [[0, 7], [0.35, 0], [1, 0]],
    keys: [{ t: 0, x: 0.68, y: 0.76, z: 2.3, rx: 16, rz: -5 }, { t: 1, x: 0.62, y: 0.7, z: 2.6, rx: 6, rz: 2 }] },
  { ...B, alt: "", into: "dip",
    keys: [{ t: 0, x: 0.86, y: 0.2, z: 2.1, ry: -16, rz: 3 }, { t: 1, x: 0.7, y: 0.3, z: 1.8, ry: 8, rz: -1 }] },
  { ...B, alt: "", into: "zoom",
    keys: [{ t: 0, x: 0.42, y: 0.36, z: 1.5, rx: 8 }, { t: 1, x: 0.47, y: 0.31, z: 2.4, rx: 0, rz: 1 }] },
  { ...A, alt: "The same desk, tidy, in warm morning light", into: "whip",
    keys: [{ t: 0, x: 0.5, y: 0.62, z: 1.7, rx: 24, rz: -4 }, { t: 1, x: 0.5, y: 0.5, z: 1.08, rx: 0, rz: 0 }] },
  { ...A, alt: "", into: "whip", blur: [[0, 6], [0.3, 0], [1, 0]],
    keys: [{ t: 0, x: 0.69, y: 0.42, z: 2.3, ry: 10, rz: 2 }, { t: 1, x: 0.66, y: 0.4, z: 2.6, ry: -5 }] },
  { ...A, alt: "", len: 1.2,
    keys: [{ t: 0, x: 0.42, y: 0.5, z: 1.7, ry: -8 }, { t: 1, x: 0.5, y: 0.5, z: 1.02, ry: 2 }] },
];
const R = shotRanges(SHOTS);

const MESS = [
  ["43 unread emails", "left-[6%] top-[18%]", -4, -260],
  ["Invoice #1042 overdue", "left-[44%] top-[24%]", 3, 220],
  ["3 missed Slack pings", "left-[22%] top-[36%]", -2, -180],
  ["Weekly report due", "left-[64%] top-[52%]", 2, 240],
];
const DONE = ["Inbox summed up in 5 lines", "Invoice reminder sent", "Report posted to Slack"];
const REEL = [["9:04", "Without Hushwork"], ["9:05", "With Hushwork"]];

// One nagging note: it shakes while the desk is a mess, then the camera move flings it off the screen.
function Nag({ label, at, turn, fling, i, p }) {
  const start = R[3][0] - 0.02 + i * 0.012;
  const x = useTransform(p, [start, start + 0.08], [0, fling * 3], { clamp: true });
  const y = useTransform(p, [start, start + 0.08], [0, -420], { clamp: true });
  const rotate = useTransform(p, [start, start + 0.08], [turn, turn * 12], { clamp: true });
  const opacity = useTransform(p, [start + 0.03, start + 0.08], [1, 0], { clamp: true });
  return (
    <motion.li className={`absolute ${at}`} style={{ x, y, rotate, opacity }}>
      <span className="hw-nag items-center gap-2 border border-white/25 bg-black/70 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-white sm:text-[13px]" style={{ "--d": `${i * 0.7}s` }}>
        <span className="h-1.5 w-1.5 rounded-full bg-error" />{label}
      </span>
    </motion.li>
  );
}

function Done({ label, i, p }) {
  const start = R[4][0] + 0.03 + i * 0.025;
  const opacity = useTransform(p, [start, start + 0.06], [0, 1], { clamp: true });
  const x = useTransform(p, [start, start + 0.08], [60, 0], { clamp: true });
  return (
    <motion.li style={{ opacity, x }} className="ml-auto flex w-max items-center gap-2 border border-white/25 bg-black/60 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-white backdrop-blur-sm sm:text-[13px]">
      <Icon name="Check" size={12} weight="bold" className="text-success" />{label}
    </motion.li>
  );
}

export default function BeforeAfter() {
  const track = useRef(null);
  const reduce = usePrefersReducedMotion();
  const { scrollYProgress } = useScroll({ target: track, offset: ["start start", "end end"] });
  // A light spring so the camera glides over the frames instead of stepping, but still keeps up with a fast flick.
  const p = useSpring(scrollYProgress, { stiffness: 260, damping: 34, mass: 0.35 });
  const before = useTransform(p, [R[1][1] - 0.02, R[2][0] + 0.02], [1, 0]);
  const after = useTransform(p, [R[5][0], R[5][0] + 0.05], [0, 1]);

  return (
    <section id="monday" aria-labelledby="monday-heading" className="relative bg-black text-white">
      <div ref={track} className={reduce ? "" : "relative h-[460vh]"}>
        <div className={`${reduce ? "relative h-dvh min-h-[560px]" : "sticky top-0 h-dvh"} overflow-hidden`}>
          <CameraFilm shots={SHOTS} progress={p} />

          {!reduce && (
            <>
              <ul aria-hidden="true" className="absolute inset-0">
                {MESS.map(([label, at, turn, fling], i) => <Nag key={label} label={label} at={at} turn={turn} fling={fling} i={i} p={p} />)}
              </ul>
              <ul aria-hidden="true" className="absolute right-5 top-24 space-y-2 sm:right-[6%] sm:top-[18%]">
                {DONE.map((label, i) => <Done key={label} label={label} i={i} p={p} />)}
              </ul>
            </>
          )}

          <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.85)_0%,rgba(0,0,0,0.3)_40%,rgba(0,0,0,0)_65%)]" />
          <div className="absolute inset-x-0 bottom-20 z-10 mx-auto max-w-6xl px-5 sm:bottom-24">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-white/70">Monday, 9:04</p>
            <h2 id="monday-heading" className="sr-only">Same desk. Different Monday.</h2>
            <div aria-hidden="true" className="relative mt-3 h-[2.1em] text-[length:clamp(2.75rem,8.5vw,8rem)] leading-[0.92]">
              <motion.span className="absolute inset-x-0 bottom-0" style={{ opacity: reduce ? 1 : before }}><FilmTitle text="Forty-seven things *need you.*" /></motion.span>
              {!reduce && <motion.span className="absolute inset-x-0 bottom-0" style={{ opacity: after }}><FilmTitle text="Done before *coffee.*" /></motion.span>}
            </div>
            <p className="mt-5 max-w-md text-lg font-extralight leading-relaxed text-white/85">Same desk, same Monday. Scroll, and watch the morning after Hushwork ran first.</p>
          </div>
          {!reduce && <FilmReel items={REEL} progress={p} active={-1} />}
        </div>
      </div>
    </section>
  );
}
