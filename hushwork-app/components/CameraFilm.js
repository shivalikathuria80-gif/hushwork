"use client";

import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

// A film made in code from the landing photos: a virtual camera flies over each photo (push in, pan, tilt, roll, rack focus),
// and the shots are joined by film transitions (a whip pan with motion blur, a zoom straight through into the next shot,
// a light flash, a dip to black). The scroll is the playhead: scroll fast and the camera moves fast, stop and it holds,
// scroll back and the film runs backwards. There is no timer.
//
// A shot: { src, size: [w, h], alt, len (how much of the scroll it gets, default 1), keys, into (transition into the NEXT shot),
//   blur: [[t, px], ...] optional rack focus }. keys are camera stops through the shot, at t from 0 to 1:
//   { t, x, y, z, rx, ry, rz }: x, y = the point of the photo at the centre of the screen (0 to 1), z = zoom (1 = the photo just
//   covers the screen), rx, ry, rz = camera tilt, pan and roll in degrees.
// Everything is written straight to the DOM on each scroll frame (no React renders), and only shots on screen are drawn.

const EASE = (t) => t * t * (3 - 2 * t);
const mix = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const OVER = 1.14; // overscan, so a tilted or rolled camera never shows the photo's edge
export const TRANSITION = 0.45; // how much of a shot's length a transition takes, split over both shots

// Where each shot starts and ends, 0 to 1 over the whole film. Overlays use this to know which shot is showing.
export function shotRanges(shots) {
  const total = shots.reduce((s, x) => s + (x.len ?? 1), 0);
  let at = 0;
  return shots.map((s) => { const a = at / total; at += s.len ?? 1; return [a, at / total]; });
}

function camAt(keys, t) {
  if (t <= keys[0].t) return keys[0];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i].t) {
      const a = keys[i - 1], b = keys[i], u = EASE((t - a.t) / (b.t - a.t || 1));
      const k = {};
      for (const f of ["x", "y", "z", "rx", "ry", "rz"]) k[f] = mix(a[f] ?? 0, b[f] ?? 0, u);
      return k;
    }
  }
  return keys[keys.length - 1];
}

const blurAt = (stops, t) => {
  if (!stops) return 0;
  if (t <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) return mix(stops[i - 1][1], stops[i][1], EASE((t - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0])));
  return stops[stops.length - 1][1];
};

export default function CameraFilm({ shots, progress, still = false }) {
  const stage = useRef(null);
  const layers = useRef([]);
  const flash = useRef(null);
  const reduce = usePrefersReducedMotion();
  const fixed = still || reduce;

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ranges = shotRanges(shots);
    const half = shots.map((s, i) => ((s.len ?? 1) / shots.reduce((n, x) => n + (x.len ?? 1), 0)) * TRANSITION * 0.5 * (i < shots.length - 1 ? 1 : 0));
    let W = 0, H = 0, raf = 0;

    const place = (i, cam, extra) => {
      const L = layers.current[i];
      if (!L) return;
      const [iw, ih] = shots[i].size;
      const k = Math.max(W / iw, H / ih);
      const z = Math.max(1, cam.z ?? 1) * OVER * (extra.zoom ?? 1);
      const dw = iw * k * z, dh = ih * k * z;
      const tx = Math.min(0, Math.max(W - dw, W / 2 - (cam.x ?? 0.5) * dw)) + (extra.dx ?? 0);
      const ty = Math.min(0, Math.max(H - dh, H / 2 - (cam.y ?? 0.5) * dh));
      L.img.style.width = `${iw * k}px`;
      L.img.style.height = `${ih * k}px`;
      L.img.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${z})`;
      L.rig.style.transform = `rotateX(${cam.rx ?? 0}deg) rotateY(${cam.ry ?? 0}deg) rotateZ(${cam.rz ?? 0}deg)`;
      const blur = (extra.blur ?? 0) + blurAt(shots[i].blur, extra.t ?? 0);
      // Phones skip the blur (a full-screen blur is the one costly part); the camera moves stay.
      L.box.style.filter = blur > 0.3 && W >= 768 ? `blur(${blur.toFixed(1)}px)` : "none";
      L.box.style.opacity = String(extra.opacity ?? 1);
      L.box.style.visibility = (extra.opacity ?? 1) > 0.001 ? "visible" : "hidden";
    };

    const draw = () => {
      raf = 0;
      const p = fixed ? 0 : clamp01(progress?.get() ?? 0);
      let white = 0;
      shots.forEach((s, i) => {
        const [a, b] = ranges[i];
        const hin = i > 0 ? half[i - 1] : 0; // the transition from the shot before, around a
        const hout = half[i]; // the transition into the next one, around b
        if (p < a - hin || p > b + hout) { place(i, s.keys[0], { opacity: 0 }); return; }
        const t = clamp01((p - (a - hin)) / (b + hout - (a - hin)));
        const cam = camAt(s.keys, t);
        const extra = { t, opacity: 1 };
        // Leaving: the transition into the next shot, u from 0 to 1 across b.
        if (hout && p > b - hout) {
          const u = clamp01((p - (b - hout)) / (2 * hout));
          const kind = s.into ?? "dip";
          if (kind === "whip") { extra.dx = -u * u * W * 0.9; extra.blur = u * 28; extra.opacity = 1 - clamp01((u - 0.45) / 0.15); }
          else if (kind === "zoom") { extra.zoom = 1 + u * u * 5; extra.blur = u * 10; extra.opacity = 1 - clamp01((u - 0.5) / 0.1); white = Math.max(white, Math.sin(u * Math.PI) * 0.95); }
          else if (kind === "flash") { extra.opacity = 1 - clamp01((u - 0.45) / 0.1); white = Math.max(white, Math.sin(u * Math.PI)); }
          else { extra.opacity = 1 - clamp01(u * 2); }
        }
        // Arriving: the matching other half of the transition from the shot before.
        if (hin && p < a + hin) {
          const u = clamp01((p - (a - hin)) / (2 * hin));
          const kind = shots[i - 1].into ?? "dip";
          if (kind === "whip") { const v = 1 - u; extra.dx = v * v * W * 0.9; extra.blur = v * 28; extra.opacity = clamp01((u - 0.4) / 0.15); }
          else if (kind === "zoom") { const v = 1 - u; extra.zoom = 1 / (1 + v * 0.6); extra.blur = v * 8; extra.opacity = clamp01((u - 0.45) / 0.1); }
          else if (kind === "flash") { extra.opacity = clamp01((u - 0.45) / 0.1); }
          else { extra.opacity = clamp01(u * 2 - 1); }
        }
        place(i, cam, extra);
      });
      if (flash.current) flash.current.style.opacity = String(white);
    };
    const ask = () => { if (!raf) raf = requestAnimationFrame(draw); };
    const fit = () => { W = el.clientWidth; H = el.clientHeight; draw(); };
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    fit();
    const off = fixed ? null : progress?.on("change", ask);
    return () => { off?.(); ro.disconnect(); cancelAnimationFrame(raf); };
  }, [shots, progress, fixed]);

  return (
    <div ref={stage} className="absolute inset-0 overflow-hidden bg-black" style={{ perspective: "1100px" }}>
      {shots.map((s, i) => (
        <div key={s.src + i} ref={(n) => { layers.current[i] = { ...(layers.current[i] || {}), box: n }; }} className="absolute inset-0 will-change-[opacity,filter]" style={{ visibility: i === 0 ? "visible" : "hidden" }}>
          <div ref={(n) => { layers.current[i] = { ...(layers.current[i] || {}), rig: n }; }} className="absolute inset-0 will-change-transform" style={{ transformStyle: "preserve-3d" }}>
            {/* A plain img on purpose: the camera moves it every frame, so next/image's wrapper and srcset would only get in the way. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img ref={(n) => { layers.current[i] = { ...(layers.current[i] || {}), img: n }; }} src={s.src} alt={i === 0 || !fixed ? s.alt : ""} draggable={false}
              decoding="async" loading={i < 2 ? "eager" : "lazy"} className="absolute left-0 top-0 max-w-none origin-top-left select-none will-change-transform" />
          </div>
        </div>
      ))}
      <div ref={flash} aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[#fff8ef] opacity-0 mix-blend-screen" />
      {/* Film grain and a vignette, so the photos read as footage. */}
      <div aria-hidden="true" className="hw-grain pointer-events-none absolute opacity-[0.12] mix-blend-overlay" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0)_55%,rgba(0,0,0,0.55)_100%)]" />
    </div>
  );
}
