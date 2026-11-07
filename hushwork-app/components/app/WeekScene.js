"use client";

import { useEffect, useRef, useState } from "react";
import { useMotionPause } from "../MotionProvider";
import { usePrefersReducedMotion } from "../usePrefersReducedMotion";

// "Your week" in 3D: seven towers of glowing dots, one tower per day (oldest on the left, today on the right) and one dot per run.
// The dots fall in and settle, day by day, on a softly rippling floor of dots. Colour says how the run went: green done,
// violet waiting for you, red stopped, grey a quiet watch check. Hovering a day below (WeekChart) lights its tower.
// The numbers themselves are always in the HTML next to it, so this is decoration (aria-hidden), never the only way to read them.
// Kept cheap like the other scenes: three.js loads after the page is idle, drawing stops when the tab is hidden, when it scrolls
// out of view or when motion is paused; reduce motion draws the settled towers once. No WebGL means nothing is drawn.

// A quiet week stacks one dot per layer; a busy one gets a 2 x 2 or 3 x 3 footprint, so the towers stay a readable height.
const footprint = (most) => (most <= 14 ? 1 : most <= 56 ? 2 : 3);
const MAX_LAYERS = 14; // taller than this only shows the first dots (the day's real number is in the HTML)
const TONES = { good: 0, you: 1, bad: 2, quiet: 3, preview: 4 };

const VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uFocus;
  uniform float uFocusAmt;
  uniform float uSize;
  attribute float aDelay;
  attribute float aTone;
  attribute float aDay;
  attribute float aSeed;
  varying float vTone;
  varying float vAlpha;
  varying float vLift;
  float backOut(float t) { float c = 1.70158; float u = t - 1.0; return 1.0 + (c + 1.0) * u * u * u + c * u * u; }
  void main() {
    vec3 p = position;
    float floorDot = step(4.5, aTone); // tone 5 = the floor
    float focus = 1.0 - min(1.0, abs(aDay - uFocus)); // 1 on the hovered day
    float lit = mix(1.0, mix(0.45, 1.0, focus), uFocusAmt);
    if (floorDot > 0.5) {
      // The floor breathes, and a ring spreads from the hovered day.
      float d = length(p.xz - vec2((uFocus - 3.0) * 1.5, 0.0));
      p.y += sin(p.x * 1.4 + uTime * 0.9) * 0.035 + cos(p.z * 1.7 + uTime * 0.7) * 0.03;
      p.y += sin(d * 3.0 - uTime * 3.0) * 0.05 * uFocusAmt * exp(-d * 0.6);
      vAlpha = 0.4 * (0.6 + 0.4 * exp(-d * 0.5 * uFocusAmt));
      vLift = 0.0;
    } else {
      float t = clamp((uTime - aDelay) / 0.9, 0.0, 1.0);
      float e = backOut(t);
      p.y = mix(p.y + 3.2, p.y, e);
      // A soft sway, stronger near the top of a tower.
      p.x += sin(uTime * 0.8 + aSeed * 6.28) * 0.012 * (1.0 + position.y);
      vAlpha = smoothstep(0.0, 0.25, t) * lit;
      vLift = focus * uFocusAmt;
    }
    vTone = aTone;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float waiting = step(0.5, aTone) * step(aTone, 1.5); // tone 1: twinkles, it needs you
    float size = uSize * mix(1.0, 0.3, floorDot) * (1.0 + 0.35 * waiting * (0.5 + 0.5 * sin(uTime * 3.0 + aSeed * 9.0))) * (1.0 + 0.3 * vLift);
    gl_PointSize = size * (9.0 / -mv.z);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 uGood;
  uniform vec3 uYou;
  uniform vec3 uBad;
  uniform vec3 uQuiet;
  uniform vec3 uPreview;
  uniform vec3 uFloor;
  uniform float uAlpha;
  varying float vTone;
  varying float vAlpha;
  varying float vLift;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r = length(c);
    if (r > 0.5) discard;
    float soft = smoothstep(0.5, 0.36, r) * 0.8 + smoothstep(0.5, 0.0, r) * 0.2; // a crisp dot with a little glow
    vec3 col = vTone < 0.5 ? uGood : vTone < 1.5 ? uYou : vTone < 2.5 ? uBad : vTone < 3.5 ? uQuiet : vTone < 4.5 ? uPreview : uFloor;
    col = mix(col, vec3(1.0), vLift * 0.25);
    gl_FragColor = vec4(col, soft * vAlpha * uAlpha);
  }
`;

const isDark = () => document.documentElement.classList.contains("dark");

// days: 7 arrays of tones, oldest first. focus: the hovered day (0-6) or -1.
export default function WeekScene({ days, focus = -1, className = "" }) {
  const box = useRef(null);
  const { paused } = useMotionPause();
  const reduce = usePrefersReducedMotion();
  const api = useRef(null);
  const [ready, setReady] = useState(0);
  const key = JSON.stringify(days);

  useEffect(() => {
    const host = box.current;
    if (!host) return;
    let cancelled = false;
    let cleanup = () => {};
    const list = JSON.parse(key);

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
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2));
      canvas.className = "h-full w-full";
      canvas.style.opacity = "0";
      canvas.style.transition = "opacity 700ms ease";
      host.appendChild(canvas);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
      const group = new THREE.Group();
      scene.add(group);

      // The towers: one dot per run, stacked 3 x 3 per layer, falling in day by day.
      const pos = [];
      const delay = [];
      const tone = [];
      const day = [];
      const seed = [];
      const gap = 0.34;
      const side = footprint(Math.max(0, ...list.map((tones) => tones.length)));
      const perLayer = side * side;
      const spread = 1.5;
      list.forEach((tones, d) => {
        const x0 = (d - 3) * spread;
        tones.slice(0, perLayer * MAX_LAYERS).forEach((name, i) => {
          const layer = Math.floor(i / perLayer);
          const cell = i % perLayer;
          const mid = (side - 1) / 2;
          pos.push(x0 + ((cell % side) - mid) * gap, 0.16 + layer * gap, (Math.floor(cell / side) - mid) * gap);
          delay.push(0.25 + d * 0.16 + layer * 0.09 + (cell % side) * 0.02 + Math.random() * 0.04);
          tone.push(TONES[name] ?? TONES.preview);
          day.push(d);
          seed.push(Math.random());
        });
      });
      // The floor: a field of small dots under all seven days.
      const cols = small ? 44 : 64;
      const rows = small ? 12 : 16;
      for (let ix = 0; ix < cols; ix++) {
        for (let iz = 0; iz < rows; iz++) {
          pos.push((ix / (cols - 1) - 0.5) * 11.5, -0.12, (iz / (rows - 1) - 0.5) * 3.4);
          delay.push(0); tone.push(5); day.push(-9); seed.push(Math.random());
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      geometry.setAttribute("aDelay", new THREE.Float32BufferAttribute(delay, 1));
      geometry.setAttribute("aTone", new THREE.Float32BufferAttribute(tone, 1));
      geometry.setAttribute("aDay", new THREE.Float32BufferAttribute(day, 1));
      geometry.setAttribute("aSeed", new THREE.Float32BufferAttribute(seed, 1));

      const uniforms = {
        uTime: { value: 0 }, uFocus: { value: -9 }, uFocusAmt: { value: 0 },
        uSize: { value: (small ? 13 : 16) * renderer.getPixelRatio() },
        uGood: { value: new THREE.Color() }, uYou: { value: new THREE.Color() }, uBad: { value: new THREE.Color() },
        uQuiet: { value: new THREE.Color() }, uPreview: { value: new THREE.Color() }, uFloor: { value: new THREE.Color() },
        uAlpha: { value: 1 },
      };
      const material = new THREE.ShaderMaterial({ vertexShader: VERTEX, fragmentShader: FRAGMENT, uniforms, transparent: true, depthWrite: false });
      const paint = () => {
        const dark = isDark();
        uniforms.uGood.value.set(dark ? "#4ade80" : "#16a34a");
        uniforms.uYou.value.set(dark ? "#c4b5fd" : "#7c3aed");
        uniforms.uBad.value.set(dark ? "#f87171" : "#dc2626");
        uniforms.uQuiet.value.set(dark ? "#6b6580" : "#b5b0c4");
        uniforms.uPreview.value.set(dark ? "#8b7fb0" : "#a99bd6");
        uniforms.uFloor.value.set(dark ? "#7c5cd6" : "#8b5cf6");
        material.blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending;
        uniforms.uAlpha.value = dark ? 0.95 : 0.9;
        material.needsUpdate = true;
      };
      paint();
      const points = new THREE.Points(geometry, material);
      group.add(points);

      const tallest = Math.max(1, ...list.map((tones) => Math.ceil(Math.min(tones.length, perLayer * MAX_LAYERS) / perLayer)));
      const height = 0.16 + tallest * gap;

      let running = false;
      let visible = !document.hidden;
      let onScreen = true;
      const render = () => renderer.render(scene, camera);
      const themeWatch = new MutationObserver(() => { paint(); if (!running) render(); });
      themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

      const resize = () => {
        const w = host.clientWidth || 1;
        const h = host.clientHeight || 1;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        // Far enough back that all seven towers fit across and the tallest fits up.
        const half = Math.tan((camera.fov * Math.PI) / 360);
        const dist = Math.max(5.5, (3 * spread + 0.9) / (half * camera.aspect), (height + 1.2) / (2 * half));
        camera.position.set(0, height * 0.55 + 1.1, dist);
        camera.lookAt(0, height * 0.42, 0);
        camera.updateProjectionMatrix();
        if (!running) render();
      };
      const ro = new ResizeObserver(resize);

      const pointer = new THREE.Vector2();
      const target = new THREE.Vector2();
      const onPointer = (e) => {
        const r = host.getBoundingClientRect();
        target.set(Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2)), Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - 0.5) * 2)));
      };

      let focusWant = -1;
      let frame = 0;
      let last = performance.now();
      const step = (dt) => {
        uniforms.uTime.value += dt;
        pointer.lerp(target, Math.min(1, dt * 3));
        group.rotation.y = Math.sin(uniforms.uTime.value * 0.18) * 0.1 + pointer.x * 0.16;
        group.rotation.x = pointer.y * 0.04;
        const want = focusWant >= 0 ? 1 : 0;
        if (focusWant >= 0) uniforms.uFocus.value = uniforms.uFocusAmt.value < 0.05 ? focusWant : uniforms.uFocus.value + (focusWant - uniforms.uFocus.value) * Math.min(1, dt * 10);
        uniforms.uFocusAmt.value += (want - uniforms.uFocusAmt.value) * Math.min(1, dt * 6);
      };
      const tick = (now) => {
        frame = requestAnimationFrame(tick);
        const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
        last = now;
        step(dt);
        render();
      };
      const start = () => {
        if (running || !visible || !onScreen) return;
        running = true;
        last = performance.now();
        frame = requestAnimationFrame(tick);
      };
      const stop = () => { running = false; cancelAnimationFrame(frame); };
      // A still frame: the towers settled (reduce motion, Pause, or before the fall when paused from the start).
      const still = () => {
        stop();
        if (uniforms.uTime.value < 4) uniforms.uTime.value = 4;
        uniforms.uFocus.value = focusWant >= 0 ? focusWant : uniforms.uFocus.value;
        uniforms.uFocusAmt.value = focusWant >= 0 ? 1 : 0;
        group.rotation.set(0, 0, 0);
        render();
      };
      const onVisibility = () => {
        visible = !document.hidden;
        if (!visible) stop();
        else if (api.current?.wanted()) start();
      };
      const io = new IntersectionObserver(([entry]) => {
        onScreen = entry.isIntersecting;
        if (!onScreen) stop();
        else if (api.current?.wanted()) start();
      });

      ro.observe(host);
      io.observe(host);
      window.addEventListener("pointermove", onPointer, { passive: true });
      document.addEventListener("visibilitychange", onVisibility);
      resize();
      render();
      requestAnimationFrame(() => { canvas.style.opacity = "1"; });

      api.current = {
        start, stop, still, wanted: () => false,
        focus: (d) => { focusWant = d; if (!running) still(); },
      };
      cleanup = () => {
        stop();
        ro.disconnect();
        io.disconnect();
        themeWatch.disconnect();
        window.removeEventListener("pointermove", onPointer);
        document.removeEventListener("visibilitychange", onVisibility);
        geometry.dispose();
        material.dispose();
        renderer.dispose();
        canvas.remove();
        api.current = null;
      };
      setReady((n) => n + 1);
    };

    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 300));
    const cancelIdle = window.cancelIdleCallback || clearTimeout;
    const handle = idle(() => { boot(); }, { timeout: 1200 });
    return () => { cancelled = true; cancelIdle(handle); cleanup(); };
  }, [key]);

  useEffect(() => {
    const a = api.current;
    if (!a) return;
    const wanted = !paused && !reduce;
    a.wanted = () => wanted;
    if (wanted) a.start();
    else a.still();
  }, [paused, reduce, ready]);

  useEffect(() => { api.current?.focus(focus); }, [focus, ready]);

  return <div ref={box} aria-hidden="true" className={className} />;
}
