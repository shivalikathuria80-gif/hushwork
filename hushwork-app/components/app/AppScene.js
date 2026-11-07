"use client";

import { useEffect, useRef, useState } from "react";
import { useMotionPause } from "../MotionProvider";
import { usePrefersReducedMotion } from "../usePrefersReducedMotion";

// The signed-in app's 3D backdrop: a slow cloud of violet dots orbiting a quiet core, high up behind the page.
// It reacts to what you do (window events, so any component can send one without importing this file):
// - "hw:pulse" with detail { kind: "think" }: the AI is writing a plan, so the cloud spins faster and draws in.
// - "hw:pulse" with detail { kind: "good" }: a plan is ready or a step was approved, so a green ring rolls out.
// - "hw:pulse" with detail { kind: "bad" }: something stopped, so a short red shiver.
// Kept cheap like the landing scenes: three.js loads after the page is idle, drawing stops when the tab is hidden or
// motion is paused, reduce motion draws one still frame, phones get fewer dots. No WebGL means nothing is drawn.
export const pulse = (kind) => { try { window.dispatchEvent(new CustomEvent("hw:pulse", { detail: { kind } })); } catch {} };

const VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uThink;
  uniform float uGood;
  uniform float uBad;
  uniform float uRing;
  uniform vec2 uPointer;
  uniform float uSize;
  attribute float aSeed;
  attribute float aBand;
  varying float vGlow;
  varying float vRingHit;
  void main() {
    vec3 p = position;
    float spin = uTime * (0.06 + uThink * 0.5) * (0.6 + aBand * 0.8);
    float c = cos(spin), s = sin(spin);
    p.xz = mat2(c, -s, s, c) * p.xz;
    // Breathe, and draw in while thinking.
    float r = 1.0 + sin(uTime * 0.5 + aSeed * 6.283) * 0.04 - uThink * 0.18;
    p *= r;
    // A shiver when something stopped.
    p += vec3(sin(uTime * 40.0 + aSeed * 50.0), cos(uTime * 37.0 + aSeed * 40.0), 0.0) * 0.05 * uBad;
    // The green ring: a shell rolling outward.
    float d = length(p);
    vRingHit = exp(-pow(d - uRing, 2.0) * 6.0) * uGood;
    p += normalize(p + 0.0001) * vRingHit * 0.35;
    // Lean toward the pointer.
    p.x += uPointer.x * 0.35 * (0.4 + aBand);
    p.y += uPointer.y * 0.25 * (0.4 + aBand);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vGlow = 0.35 + 0.65 * aBand;
    gl_PointSize = uSize * (0.55 + aSeed * 0.7) * (8.0 / -mv.z) * (1.0 + vRingHit);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 uLow;
  uniform vec3 uHigh;
  uniform vec3 uGreen;
  uniform vec3 uRed;
  uniform float uAlpha;
  uniform float uBad;
  varying float vGlow;
  varying float vRingHit;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r = length(c);
    if (r > 0.5) discard;
    float soft = smoothstep(0.5, 0.05, r);
    vec3 col = mix(uLow, uHigh, vGlow);
    col = mix(col, uRed, uBad * 0.6);
    col = mix(col, uGreen, clamp(vRingHit * 1.5, 0.0, 1.0));
    gl_FragColor = vec4(col, soft * uAlpha * (vGlow + vRingHit));
  }
`;

const isDark = () => document.documentElement.classList.contains("dark");

export default function AppScene() {
  const box = useRef(null);
  const { paused } = useMotionPause();
  const reduce = usePrefersReducedMotion();
  const api = useRef(null);
  const [ready, setReady] = useState(0);

  useEffect(() => {
    const host = box.current;
    if (!host) return;
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
      canvas.style.opacity = "0";
      canvas.style.transition = "opacity 900ms ease";
      host.appendChild(canvas);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 50);
      camera.position.set(0, 0.6, 7);
      camera.lookAt(0, 0, 0);

      // Dots: a loose shell (the cloud) and two tilted rings around it (the orbits).
      const count = small ? 900 : 2200;
      const positions = new Float32Array(count * 3);
      const seeds = new Float32Array(count);
      const bands = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        const kind = i % 3;
        let x, y, z;
        if (kind === 0) {
          const u = Math.random() * 2 - 1;
          const t = Math.random() * Math.PI * 2;
          const rad = 1.3 + Math.random() * 0.5;
          const q = Math.sqrt(1 - u * u);
          x = q * Math.cos(t) * rad; y = u * rad; z = q * Math.sin(t) * rad;
          bands[i] = 0.2 + Math.random() * 0.3;
        } else {
          const t = Math.random() * Math.PI * 2;
          const rad = (kind === 1 ? 2.3 : 3.1) + (Math.random() - 0.5) * 0.25;
          const tilt = kind === 1 ? 0.35 : -0.5;
          x = Math.cos(t) * rad; z = Math.sin(t) * rad; y = (Math.random() - 0.5) * 0.12;
          const yy = y * Math.cos(tilt) - z * Math.sin(tilt);
          z = y * Math.sin(tilt) + z * Math.cos(tilt); y = yy;
          bands[i] = kind === 1 ? 0.75 : 1;
        }
        positions[i * 3] = x; positions[i * 3 + 1] = y; positions[i * 3 + 2] = z;
        seeds[i] = Math.random();
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
      geometry.setAttribute("aBand", new THREE.BufferAttribute(bands, 1));

      const uniforms = {
        uTime: { value: 0 }, uThink: { value: 0 }, uGood: { value: 0 }, uBad: { value: 0 }, uRing: { value: 0 },
        uPointer: { value: new THREE.Vector2(0, 0) },
        uSize: { value: (small ? 3.6 : 3.8) * renderer.getPixelRatio() },
        uLow: { value: new THREE.Color() }, uHigh: { value: new THREE.Color() },
        uGreen: { value: new THREE.Color("#4ade80") }, uRed: { value: new THREE.Color("#f87171") },
        uAlpha: { value: 1 },
      };
      const material = new THREE.ShaderMaterial({ vertexShader: VERTEX, fragmentShader: FRAGMENT, uniforms, transparent: true, depthWrite: false });
      const paint = () => {
        const dark = isDark();
        uniforms.uLow.value.set(dark ? "#4c1d95" : "#ddd6fe");
        uniforms.uHigh.value.set(dark ? "#c4b5fd" : "#7c3aed");
        material.blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending;
        uniforms.uAlpha.value = (dark ? 0.85 : 0.45) * (small ? 0.45 : 1); // fainter on phones, where it sits behind the text
        material.needsUpdate = true;
      };
      paint();
      const points = new THREE.Points(geometry, material);
      scene.add(points);

      let running = false;
      let visible = !document.hidden;
      const render = () => renderer.render(scene, camera);
      const themeWatch = new MutationObserver(() => { paint(); if (!running) render(); });
      themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

      const resize = () => {
        const w = host.clientWidth || 1;
        const h = host.clientHeight || 1;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        // Sit up and to the right on wide screens, centred on phones.
        points.position.set(w > 900 ? 2.2 : 0, w > 900 ? 0.6 : 1.8, w > 900 ? 0 : -1.5);
        if (!running) render();
      };
      const ro = new ResizeObserver(resize);

      const target = new THREE.Vector2();
      const onPointer = (e) => target.set((e.clientX / window.innerWidth - 0.5) * 2, -(e.clientY / window.innerHeight - 0.5) * 2);

      // Reactions: each kind sets a target that eases back to rest.
      const want = { think: 0, good: 0, bad: 0 };
      let thinkUntil = 0;
      const onPulse = (e) => {
        const kind = e.detail?.kind;
        const now = performance.now();
        if (kind === "think") { thinkUntil = now + 20000; }
        else if (kind === "good") { thinkUntil = 0; want.good = 1; uniforms.uRing.value = 0; }
        else if (kind === "bad") { thinkUntil = 0; want.bad = 1; }
        else if (kind === "rest") { thinkUntil = 0; }
        if (!running && api.current?.wanted()) start();
      };

      let frame = 0;
      let last = performance.now();
      const tick = (now) => {
        frame = requestAnimationFrame(tick);
        const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
        last = now;
        uniforms.uTime.value += dt;
        uniforms.uPointer.value.lerp(target, 0.04);
        want.think = now < thinkUntil ? 1 : 0;
        const k = Math.min(1, dt * 3);
        uniforms.uThink.value += (want.think - uniforms.uThink.value) * k;
        uniforms.uGood.value += (want.good - uniforms.uGood.value) * Math.min(1, dt * 8);
        uniforms.uBad.value += (want.bad - uniforms.uBad.value) * Math.min(1, dt * 10);
        if (want.good) { uniforms.uRing.value += dt * 3.2; if (uniforms.uRing.value > 4.5) { want.good = 0; } }
        if (want.bad && uniforms.uBad.value > 0.9) want.bad = 0;
        render();
      };
      const start = () => {
        if (running || !visible) return;
        running = true;
        last = performance.now();
        frame = requestAnimationFrame(tick);
      };
      const stop = () => { running = false; cancelAnimationFrame(frame); };
      const still = () => { stop(); render(); };
      const onVisibility = () => {
        visible = !document.hidden;
        if (!visible) stop();
        else if (api.current?.wanted()) start();
      };

      ro.observe(host);
      window.addEventListener("pointermove", onPointer, { passive: true });
      window.addEventListener("hw:pulse", onPulse);
      document.addEventListener("visibilitychange", onVisibility);
      resize();
      render();
      requestAnimationFrame(() => { canvas.style.opacity = "1"; });

      api.current = { start, stop, still, wanted: () => false };
      cleanup = () => {
        stop();
        ro.disconnect();
        themeWatch.disconnect();
        window.removeEventListener("pointermove", onPointer);
        window.removeEventListener("hw:pulse", onPulse);
        document.removeEventListener("visibilitychange", onVisibility);
        geometry.dispose();
        material.dispose();
        renderer.dispose();
        canvas.remove();
        api.current = null;
      };
      setReady((n) => n + 1);
    };

    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 600));
    const cancelIdle = window.cancelIdleCallback || clearTimeout;
    const handle = idle(() => { boot(); }, { timeout: 2000 });
    return () => { cancelled = true; cancelIdle(handle); cleanup(); };
  }, []);

  useEffect(() => {
    const a = api.current;
    if (!a) return;
    const wanted = !paused && !reduce;
    a.wanted = () => wanted;
    if (wanted) a.start();
    else a.still();
  }, [paused, reduce, ready]);

  return (
    <div
      ref={box}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 [mask-image:linear-gradient(to_bottom,black_0%,black_35%,transparent_75%)] lg:left-64"
    />
  );
}
