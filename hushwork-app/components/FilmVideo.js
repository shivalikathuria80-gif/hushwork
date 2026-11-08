"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { useInView } from "motion/react";
import { useMotionPause } from "./MotionProvider";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

// A landing photo brought to life: the Google Flow clip of it (public/landing/film, made by scripts/landing-clips.sh) fills its box
// like the photo did. Left alone it plays on a seamless loop (the clip runs forward then back), so the picture is never still.
// Scrolling takes the clip over: it pauses and the scroll moves it frame by frame, forward or back, eased so it glides;
// when the scroll rests, it plays on from that frame. Nothing ever jumps.
// `progress` is the scene's motion value (0 to 1). `seconds` is how much of the clip one whole scene of scroll moves.
// `live` = false holds it (a shot that is not showing). Off screen it stops. With reduce motion it is the still poster.
export default function FilmVideo({ name, alt = "", progress, seconds = 16, live = true, position = "50% 50%", priority = false, sizes = "100vw" }) {
  const box = useRef(null);
  const video = useRef(null);
  const reduce = usePrefersReducedMotion();
  const { paused } = useMotionPause();
  const inView = useInView(box, { margin: "10% 0px 10% 0px" });
  const near = useInView(box, { margin: "150% 0px 150% 0px", once: true }); // start loading a screen or so ahead
  const on = inView && live && !reduce;

  useEffect(() => {
    const v = video.current;
    if (!v || !on) return;
    let target = null; // where the scroll wants the clip, in seconds (null while it plays by itself)
    let raf = 0;
    let rest = 0;
    let last = progress ? progress.get() : 0;
    const play = () => { if (!paused) v.play().catch(() => {}); };
    const wrap = (t) => { const d = v.duration || 1; return ((t % d) + d) % d; };
    const step = () => {
      raf = 0;
      if (target == null || v.readyState < 2) return;
      const now = v.currentTime;
      let gap = target - now;
      const d = v.duration || 1;
      if (Math.abs(gap) > d / 2) gap -= Math.sign(gap) * d; // the short way round the loop
      if (Math.abs(gap) < 1 / 60) return;
      if (!v.seeking) v.currentTime = wrap(now + gap * 0.35);
      raf = requestAnimationFrame(step);
    };
    const off = progress?.on("change", (p) => {
      const delta = p - last;
      last = p;
      if (!v.duration || !delta) return;
      if (target == null) { v.pause(); target = v.currentTime; }
      target = wrap(target + delta * seconds);
      if (!raf) raf = requestAnimationFrame(step);
      clearTimeout(rest);
      rest = setTimeout(() => { target = null; play(); }, 260);
    });
    play();
    return () => { off?.(); cancelAnimationFrame(raf); clearTimeout(rest); v.pause(); };
  }, [on, paused, progress, seconds]);

  return (
    <div ref={box} className="absolute inset-0">
      {reduce ? (
        <Image src={`/landing/film/${name}.jpg`} alt={alt} fill sizes={sizes} className="object-cover" style={{ objectPosition: position }} priority={priority} />
      ) : (
        <video ref={video} src={`/landing/film/${name}.mp4`} poster={`/landing/film/${name}.jpg`} muted loop playsInline preload={priority || near ? "auto" : "none"}
          aria-label={alt || undefined} aria-hidden={alt ? undefined : true} className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: position }} />
      )}
    </div>
  );
}
