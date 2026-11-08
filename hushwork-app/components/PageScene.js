"use client";

import { useEffect, useRef } from "react";
import { useMotionPause } from "./MotionProvider";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

// One three.js particle cloud behind every section after the hero. As you scroll, the same ~6,000 dots
// flow from one shape into the next, so each section has its own 3D figure:
//   statement band  → a drifting dust cloud (the week's loose chores)
//   How it works    → three stacked rings (the three steps)
//   Look inside     → a deck of cards standing on edge (the app screens that tip forward)
//   Chatbot plugin  → a globe with a tail (a chat bubble)
//   Example workflows → three cubes (the three folders)
//   Agent rail      → a rail with tags hanging from it (the ready-made agents)
//   Features        → a knot (everything connected)
//   Sign up         → a big tick
// The scroll position between two sections sets how far the morph has got, so it plays forwards and backwards
// with the wheel. The mouse tilts the figure. One WebGL canvas, fixed to the screen, loaded after the page is
// idle; it draws only while it is showing (not over the hero, which has its own scene), stops in a hidden tab,
// stops turning on Pause, and is not loaded at all with "reduce motion" on.

const SECTIONS = ["#reveal", "#how", "#inside", "#plugin", "#auto", "#rail", "#features", "#wait"];
// Where each figure sits across the screen on wide screens (away from that section's text).
const SIDE = [0, 3.4, 0, -3.6, 0, 0, 0, 0];
const LAST = SECTIONS.length - 1; // the tick

const VERTEX = /* glsl */ `
  attribute vec3 aS0; attribute vec3 aS1; attribute vec3 aS2; attribute vec3 aS3; attribute vec3 aS4; attribute vec3 aS5; attribute vec3 aS6; attribute vec3 aS7;
  attribute float aSeed;
  uniform float uStage;
  uniform float uTime;
  uniform float uSize;
  varying float vDepth;
  varying float vSeed;
  vec3 shape(float i) {
    if (i < 0.5) return aS0;
    if (i < 1.5) return aS1;
    if (i < 2.5) return aS2;
    if (i < 3.5) return aS3;
    if (i < 4.5) return aS4;
    if (i < 5.5) return aS5;
    if (i < 6.5) return aS6;
    return aS7;
  }
  void main() {
    float i = floor(uStage);
    // Each dot leaves a little earlier or later than its neighbours, so the morph ripples instead of snapping.
    float f = smoothstep(0.0, 1.0, clamp((uStage - i) * 1.6 - aSeed * 0.6, 0.0, 1.0));
    vec3 a = shape(i);
    vec3 b = shape(min(i + 1.0, 7.0));
    vec3 p = mix(a, b, f);
    // Mid-morph the dots swirl outward a little, then settle.
    float lift = sin(f * 3.14159);
    p += normalize(p + 0.001) * lift * (0.6 + aSeed);
    p += vec3(sin(uTime * 0.7 + aSeed * 40.0), cos(uTime * 0.5 + aSeed * 30.0), sin(uTime * 0.6 + aSeed * 20.0)) * 0.05;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * (0.6 + aSeed * 0.8) * (8.0 / -mv.z);
    vDepth = clamp((-mv.z - 6.0) / 10.0, 0.0, 1.0);
    vSeed = aSeed;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 uNear;
  uniform vec3 uFar;
  uniform vec3 uTint;
  uniform float uTintMix;
  uniform float uAlpha;
  varying float vDepth;
  varying float vSeed;
  void main() {
    float r = length(gl_PointCoord - 0.5);
    if (r > 0.5) discard;
    vec3 col = mix(uNear, uFar, vDepth);
    col = mix(col, uTint, uTintMix * (0.4 + vSeed * 0.6));
    gl_FragColor = vec4(col, smoothstep(0.5, 0.05, r) * uAlpha * (1.0 - vDepth * 0.6));
  }
`;

// --- The eight shapes, as lists of points. ---
const rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
function cloud(n) {
  return Array.from({ length: n }, () => {
    const r = 3 + rnd() * 5;
    const t = rnd() * Math.PI * 2;
    const u = rnd() * 2 - 1;
    const s = Math.sqrt(1 - u * u);
    return [Math.cos(t) * s * r * 1.4, u * r * 0.7, Math.sin(t) * s * r];
  });
}
function rings(n) {
  return Array.from({ length: n }, (_, i) => {
    const k = i % 3;
    const t = rnd() * Math.PI * 2;
    const r = 2.6 + (rnd() - 0.5) * 0.35;
    return [Math.cos(t) * r, (1 - k) * 1.9 + (rnd() - 0.5) * 0.2, Math.sin(t) * r];
  });
}
function bubble(n) {
  return Array.from({ length: n }, (_, i) => {
    if (i % 9 === 0) { // the tail
      const k = rnd();
      return [-1.6 - k * 1.2 + (rnd() - 0.5) * 0.3 * (1 - k), -2.1 - k * 1.1, (rnd() - 0.5) * 0.5 * (1 - k)];
    }
    const y = 1 - (i / n) * 2;
    const r = Math.sqrt(1 - y * y);
    const t = i * 2.39996;
    return [Math.cos(t) * r * 3.2, y * 2.6, Math.sin(t) * r * 3.2];
  });
}
function cubes(n) {
  return Array.from({ length: n }, (_, i) => {
    const k = (i % 3) - 1;
    const face = Math.floor(rnd() * 6);
    const a = rnd() * 2 - 1;
    const b = rnd() * 2 - 1;
    const p = [[1, a, b], [-1, a, b], [a, 1, b], [a, -1, b], [a, b, 1], [a, b, -1]][face];
    return [p[0] * 1.1 + k * 3.4, p[1] * 1.1 + Math.abs(k) * -0.2, p[2] * 1.1];
  });
}
function knot(n) {
  return Array.from({ length: n }, () => {
    const t = rnd() * Math.PI * 2;
    const p = 2, q = 3;
    const r = 2 + Math.cos(q * t);
    const j = 0.35;
    // Drawn large, so it loops out around the feature cards.
    return [r * Math.cos(p * t) * 2 + (rnd() - 0.5) * j, Math.sin(q * t) * 2.2 + (rnd() - 0.5) * j, r * Math.sin(p * t) * 1.4 + (rnd() - 0.5) * j];
  });
}
function deck(n) {
  // Five cards standing on edge one behind the other, the front one tipping forward.
  return Array.from({ length: n }, (_, i) => {
    const k = i % 5;
    const a = rnd() * 2 - 1;
    const b = rnd();
    const tilt = k === 0 ? -0.7 : 0; // the front card is falling towards you
    const y = -1.8 + b * 3.4 * Math.cos(tilt);
    const z = 1.6 - k * 0.9 + b * 3.4 * Math.sin(tilt);
    return [a * 3.1, y + k * 0.18, z];
  });
}
function rail(n) {
  // A long bar, and tags swinging from it on short hooks.
  return Array.from({ length: n }, (_, i) => {
    if (i % 5 === 0) return [(rnd() - 0.5) * 9, 2.4 + (rnd() - 0.5) * 0.12, (rnd() - 0.5) * 0.12];
    const k = i % 7;
    const x = (k - 3) * 1.3;
    const yaw = (k - 3) * 0.35;
    if (i % 5 === 1) { const t = rnd(); return [x, 2.4 - t * 0.5, 0]; }
    const a = rnd() - 0.5;
    const y = 1.9 - rnd() * 2.8;
    return [x + Math.cos(yaw) * a * 1.0, y, Math.sin(yaw) * a * 1.0];
  });
}
function tick(n) {
  // Two thick strokes: short down-stroke, long up-stroke.
  const A = [-2.6, 0.2], B = [-0.8, -1.7], C = [3, 2.3];
  return Array.from({ length: n }, () => {
    const long = rnd() < 0.68;
    const [p, q] = long ? [B, C] : [A, B];
    const k = rnd();
    const w = 0.42;
    return [p[0] + (q[0] - p[0]) * k + (rnd() - 0.5) * w, p[1] + (q[1] - p[1]) * k + (rnd() - 0.5) * w, (rnd() - 0.5) * 0.9];
  });
}

const isDark = () => document.documentElement.classList.contains("dark");

export default function PageScene() {
  const box = useRef(null);
  const { paused } = useMotionPause();
  const reduce = usePrefersReducedMotion();
  const pausedRef = useRef(paused);
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  useEffect(() => {
    if (reduce) return;
    const host = box.current;
    let cancelled = false;
    let cleanup = () => {};

    const boot = async () => {
      const THREE = await import("three");
      if (cancelled) return;
      const canvas = document.createElement("canvas");
      let renderer;
      try {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: "low-power" });
      } catch {
        return;
      }
      const small = window.matchMedia("(max-width: 767px)").matches;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.25 : 1.5));
      canvas.className = "h-full w-full";
      host.appendChild(canvas);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
      camera.position.set(0, 0, 12);

      const n = small ? 3200 : 6400;
      const geometry = new THREE.BufferGeometry();
      const shapes = [cloud(n), rings(n), deck(n), bubble(n), cubes(n), rail(n), knot(n), tick(n)];
      shapes.forEach((pts, k) => {
        const arr = new Float32Array(n * 3);
        pts.forEach((p, i) => arr.set(p, i * 3));
        geometry.setAttribute(`aS${k}`, new THREE.BufferAttribute(arr, 3));
      });
      geometry.setAttribute("position", geometry.getAttribute("aS0"));
      const seeds = new Float32Array(n);
      for (let i = 0; i < n; i++) seeds[i] = rnd();
      geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
      geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 20);

      const uniforms = {
        uStage: { value: 0 }, uTime: { value: 0 }, uSize: { value: (small ? 4.4 : 3.4) * renderer.getPixelRatio() },
        uNear: { value: new THREE.Color() }, uFar: { value: new THREE.Color() },
        uTint: { value: new THREE.Color("#4ade80") }, uTintMix: { value: 0 }, uAlpha: { value: 0 },
      };
      const material = new THREE.ShaderMaterial({ vertexShader: VERTEX, fragmentShader: FRAGMENT, uniforms, transparent: true, depthWrite: false });
      let alphaMax = 1;
      const paint = () => {
        const dark = isDark();
        uniforms.uNear.value.set(dark ? "#d8c4ff" : "#6d28d9");
        uniforms.uFar.value.set(dark ? "#5b21b6" : "#c4b5fd");
        material.blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending;
        alphaMax = dark ? 0.85 : 0.55;
        material.needsUpdate = true;
      };
      paint();
      const themeWatch = new MutationObserver(paint);
      themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
      const points = new THREE.Points(geometry, material);
      scene.add(points);

      const resize = () => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        // Phones are narrow: pull the camera back so the figures fit.
        camera.position.z = w < 768 ? 17 : 12;
        camera.updateProjectionMatrix();
      };
      window.addEventListener("resize", resize);
      resize();

      // Which section the middle of the screen is in, as a number: 2.5 = halfway from the plugin to the folders.
      let centres = [];
      const measure = () => {
        centres = SECTIONS.map((sel) => {
          const el = document.querySelector(sel);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return r.top + window.scrollY + r.height / 2;
        }).filter((v) => v !== null);
      };
      const stageNow = () => {
        const mid = window.scrollY + window.innerHeight / 2;
        if (!centres.length || mid <= centres[0]) return 0;
        for (let k = 0; k < centres.length - 1; k++) {
          if (mid < centres[k + 1]) {
            const f = (mid - centres[k]) / (centres[k + 1] - centres[k]);
            return k + Math.min(1, Math.max(0, (f - 0.25) / 0.5)); // hold each shape while its section is centred
          }
        }
        return centres.length - 1;
      };
      // How visible the scene should be: 0 over the hero and its story, 1 below it, fading out once the footer fills the screen.
      const visibility = () => {
        const first = document.querySelector(SECTIONS[0]);
        const foot = document.querySelector("footer");
        const top = first ? first.getBoundingClientRect().top : 0;
        const fin = foot ? foot.getBoundingClientRect().top : Infinity;
        const vh = window.innerHeight;
        return Math.min(1, Math.max(0, (vh - top) / (vh * 0.6))) * Math.min(1, Math.max(0, fin / (vh * 0.4)));
      };
      const ro = new ResizeObserver(measure);
      ro.observe(document.body);
      measure();

      const target = { x: 0, y: 0 };
      const onPointer = (e) => { target.x = e.clientX / window.innerWidth - 0.5; target.y = e.clientY / window.innerHeight - 0.5; };
      window.addEventListener("pointermove", onPointer, { passive: true });

      let frame = 0;
      let last = performance.now();
      let spin = 0;
      const tickFn = (now) => {
        frame = requestAnimationFrame(tickFn);
        const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
        last = now;
        const vis = visibility();
        uniforms.uAlpha.value += (vis * alphaMax * (1 + Math.max(0, uniforms.uStage.value - (LAST - 1)) * 0.6) - uniforms.uAlpha.value) * Math.min(1, dt * 6); // the tick glows brighter
        if (uniforms.uAlpha.value < 0.01 && vis === 0) { canvas.style.visibility = "hidden"; return; }
        canvas.style.visibility = "visible";
        const stage = stageNow();
        uniforms.uStage.value += (stage - uniforms.uStage.value) * Math.min(1, dt * 5);
        uniforms.uTintMix.value = Math.max(0, uniforms.uStage.value - (LAST - 1)); // the tick turns green
        if (!pausedRef.current) { uniforms.uTime.value += dt; spin += dt * 0.12; }
        // Turn with the scroll as well as with time, and lean toward the mouse.
        // The tick turns to face you (so it never reads backwards); the other figures keep turning.
        const face = Math.min(1, Math.max(0, uniforms.uStage.value - (LAST - 1)));
        const turn = spin + window.scrollY * 0.0004;
        const facing = Math.round(turn / (Math.PI * 2)) * Math.PI * 2;
        points.rotation.y = turn + (facing - turn) * face + target.x * 0.5;
        points.rotation.x = target.y * 0.3 + Math.sin(uniforms.uStage.value * 1.3) * 0.15;
        // Sit to the side the section's text is not on, on wide screens.
        const st = uniforms.uStage.value;
        const k = Math.min(LAST - 1, Math.floor(st));
        const side = window.innerWidth >= 1024 ? SIDE[k] + (SIDE[k + 1] - SIDE[k]) * (st - k) : 0;
        points.position.x += (side - points.position.x) * Math.min(1, dt * 3);
        renderer.render(scene, camera);
      };
      frame = requestAnimationFrame(tickFn);

      cleanup = () => {
        cancelAnimationFrame(frame);
        ro.disconnect();
        themeWatch.disconnect();
        window.removeEventListener("resize", resize);
        window.removeEventListener("pointermove", onPointer);
        geometry.dispose();
        material.dispose();
        renderer.dispose();
        canvas.remove();
      };
    };

    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 900));
    const cancelIdle = window.cancelIdleCallback || clearTimeout;
    const handle = idle(() => { boot(); }, { timeout: 3000 });
    return () => { cancelled = true; cancelIdle(handle); cleanup(); };
  }, [reduce]);

  return <div ref={box} aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10" />;
}
