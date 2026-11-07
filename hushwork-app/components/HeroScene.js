"use client";

import { useEffect, useRef, useState } from "react";
import { useMotionPause } from "./MotionProvider";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

// The hero's 3D backdrop: a field of violet dots rolling like a slow sea. It leans toward the pointer and
// flattens out as you scroll past the hero.
// Kept cheap on purpose:
// - three.js is loaded only in the browser, after the page is idle (it never delays the headline).
// - Drawing stops when the hero is off screen, when the tab is hidden, and when motion is paused.
// - With "reduce motion" on, one still frame is drawn and nothing moves.
// - Phones get fewer dots and a lower pixel ratio.
// If WebGL is missing the component draws nothing, and the CSS glow behind it stays as the backdrop.

const VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uScroll;
  uniform vec2 uPointer;
  uniform float uSize;
  uniform float uHalf;
  attribute float aSeed;
  varying float vLift;
  varying float vFade;
  void main() {
    vec3 p = position;
    float t = uTime * 0.35;
    float calm = 1.0 - uScroll * 0.75;
    float wave = sin(p.x * 0.55 + t) * 0.55 + sin(p.z * 0.8 + t * 1.3) * 0.35 + sin((p.x + p.z) * 0.35 - t * 0.8) * 0.45;
    // A soft bump that follows the pointer.
    float d = distance(p.xz, uPointer);
    float bump = exp(-d * d * 0.18) * 1.1;
    p.y += (wave + bump) * calm;
    p.y += sin(aSeed * 6.283 + t * 2.0) * 0.04;
    vLift = clamp((p.y + 1.2) / 2.8, 0.0, 1.0);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * (0.6 + vLift * 0.8) * (10.0 / -mv.z);
    // Fade the far edge and the sides so the field has no hard border.
    vFade = smoothstep(26.0, 8.0, -mv.z) * smoothstep(uHalf, uHalf * 0.45, abs(p.x));
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 uLow;
  uniform vec3 uHigh;
  uniform float uAlpha;
  varying float vLift;
  varying float vFade;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r = length(c);
    if (r > 0.5) discard;
    float soft = smoothstep(0.5, 0.1, r);
    gl_FragColor = vec4(mix(uLow, uHigh, vLift), soft * vFade * uAlpha * (0.35 + vLift * 0.65));
  }
`;

const isDark = () => document.documentElement.classList.contains("dark");

export default function HeroScene() {
  const box = useRef(null);
  const { paused } = useMotionPause();
  const reduce = usePrefersReducedMotion();
  const api = useRef(null); // { start, stop, still } once three.js has loaded
  const [ready, setReady] = useState(0); // bumps when three.js has loaded, so the effect below runs again

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
        return; // no WebGL: keep the CSS glow
      }
      const small = window.matchMedia("(max-width: 767px)").matches;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.25 : 1.6));
      canvas.className = "h-full w-full";
      canvas.style.opacity = "0";
      canvas.style.transition = "opacity 900ms ease";
      host.appendChild(canvas);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
      camera.position.set(0, 3.2, 9);
      camera.lookAt(0, -1.6, -2);

      // The grid of dots.
      const width = small ? 14 : 28;
      const cols = small ? 80 : 170;
      const rows = small ? 60 : 70;
      const count = cols * rows;
      const positions = new Float32Array(count * 3);
      const seeds = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        const cx = i % cols;
        const rz = Math.floor(i / cols);
        positions[i * 3] = (cx / (cols - 1) - 0.5) * width;
        positions[i * 3 + 1] = -1;
        positions[i * 3 + 2] = -(rz / (rows - 1)) * 22 + 4;
        seeds[i] = Math.random();
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));

      const uniforms = {
        uTime: { value: 0 },
        uScroll: { value: 0 },
        uPointer: { value: new THREE.Vector2(0, -2) },
        uHalf: { value: width / 2 - 1 },
        uSize: { value: (small ? 4.2 : 4.4) * renderer.getPixelRatio() },
        uLow: { value: new THREE.Color() },
        uHigh: { value: new THREE.Color() },
        uAlpha: { value: 1 },
      };
      const material = new THREE.ShaderMaterial({ vertexShader: VERTEX, fragmentShader: FRAGMENT, uniforms, transparent: true, depthWrite: false });
      const paint = () => {
        const dark = isDark();
        uniforms.uLow.value.set(dark ? "#5b21b6" : "#c4b5fd");
        uniforms.uHigh.value.set(dark ? "#d8c4ff" : "#6d28d9");
        material.blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending;
        uniforms.uAlpha.value = dark ? 1 : 0.6;
        material.needsUpdate = true;
      };
      paint();
      const themeWatch = new MutationObserver(() => { paint(); if (!running) renderer.render(scene, camera); });
      themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
      scene.add(new THREE.Points(geometry, material));

      const resize = () => {
        const w = host.clientWidth || 1;
        const h = host.clientHeight || 1;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        if (!running) renderer.render(scene, camera);
      };
      const ro = new ResizeObserver(resize);

      // Pointer: eased toward the target so the bump glides rather than jumps.
      const target = new THREE.Vector2(0, -2);
      const onPointer = (e) => {
        const r = host.getBoundingClientRect();
        target.set(((e.clientX - r.left) / r.width - 0.5) * 18, -((e.clientY - r.top) / r.height) * 12 + 2);
      };
      const onScroll = () => {
        const r = host.getBoundingClientRect();
        uniforms.uScroll.value = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height)));
      };

      let running = false;
      let visible = true;
      let frame = 0;
      let last = performance.now();
      const tick = (now) => {
        frame = requestAnimationFrame(tick);
        const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
        last = now;
        uniforms.uTime.value += dt;
        uniforms.uPointer.value.lerp(target, 0.06);
        camera.position.y = 3.2 + uniforms.uScroll.value * 1.5;
        camera.lookAt(0, -1.6, -2);
        renderer.render(scene, camera);
      };
      const start = () => {
        if (running || !visible) return;
        running = true;
        last = performance.now();
        frame = requestAnimationFrame(tick);
      };
      const stop = () => { running = false; cancelAnimationFrame(frame); };
      const still = () => { stop(); renderer.render(scene, camera); };

      const io = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (!visible) stop();
        else if (api.current && api.current.wanted()) start();
      });

      ro.observe(host);
      io.observe(host);
      window.addEventListener("pointermove", onPointer, { passive: true });
      window.addEventListener("scroll", onScroll, { passive: true });
      resize();
      onScroll();
      renderer.render(scene, camera);
      requestAnimationFrame(() => { canvas.style.opacity = "1"; });

      api.current = { start, stop, still, wanted: () => false };
      cleanup = () => {
        stop();
        ro.disconnect();
        io.disconnect();
        themeWatch.disconnect();
        window.removeEventListener("pointermove", onPointer);
        window.removeEventListener("scroll", onScroll);
        geometry.dispose();
        material.dispose();
        renderer.dispose();
        canvas.remove();
        api.current = null;
      };
      setReady((n) => n + 1);
    };

    // Wait until the browser is idle so the 3D code never competes with the first paint.
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 600));
    const cancelIdle = window.cancelIdleCallback || clearTimeout;
    const handle = idle(() => { boot(); }, { timeout: 2000 });
    return () => { cancelled = true; cancelIdle(handle); cleanup(); };
  }, []);

  // Start, stop or freeze whenever the Pause button or the reduce-motion setting changes (and once three.js is ready).
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
      className="pointer-events-none absolute inset-0 -z-10 [mask-image:linear-gradient(to_bottom,transparent_0%,black_18%,black_70%,transparent_100%)]"
    />
  );
}
