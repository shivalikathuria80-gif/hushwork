"use client";

import { useEffect, useRef } from "react";
import { useMotionPause } from "../MotionProvider";
import { usePrefersReducedMotion } from "../usePrefersReducedMotion";

// The little three.js orb at the top of the command palette: a ball of violet dots that spins up while you type (`energy` jumps on each
// key) and opens into a ring when nothing matches (`empty`). It draws only while the palette is open; reduce motion and Pause draw one
// still frame. No WebGL means nothing is drawn.
const VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uEnergy;
  uniform float uEmpty;
  uniform float uSize;
  attribute vec3 aRing;
  attribute float aSeed;
  varying float vGlow;
  void main() {
    vec3 p = mix(position, aRing, uEmpty);
    float spin = uTime * (0.4 + uEnergy * 3.0);
    float c = cos(spin), s = sin(spin);
    p.xz = mat2(c, -s, s, c) * p.xz;
    float t = 0.35 + uTime * 0.2;
    p.yz = mat2(cos(t), -sin(t), sin(t), cos(t)) * p.yz;
    p *= 1.0 + uEnergy * 0.12 * sin(uTime * 9.0 + aSeed * 20.0);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vGlow = 0.45 + 0.55 * aSeed;
    gl_PointSize = uSize * (0.6 + aSeed * 0.7) * (3.0 / -mv.z);
  }
`;
const FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  varying float vGlow;
  void main() {
    float r = length(gl_PointCoord - 0.5);
    if (r > 0.5) discard;
    gl_FragColor = vec4(uColor, smoothstep(0.5, 0.1, r) * vGlow * 0.8);
  }
`;

export default function PaletteOrb({ energy = 0, empty = false, className = "" }) {
  const box = useRef(null);
  const api = useRef(null);
  const { paused } = useMotionPause();
  const reduce = usePrefersReducedMotion();
  const still = paused || reduce;

  useEffect(() => {
    const host = box.current;
    if (!host) return;
    let cancelled = false;
    let cleanup = () => {};
    (async () => {
      const THREE = await import("three");
      if (cancelled) return;
      const canvas = document.createElement("canvas");
      let renderer;
      try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: "low-power" }); } catch { return; }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      canvas.className = "h-full w-full";
      host.appendChild(canvas);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 20);
      camera.position.set(0, 0, 3.4);
      const n = 520;
      const pos = new Float32Array(n * 3);
      const ring = new Float32Array(n * 3);
      const seed = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const y = 1 - (i / (n - 1)) * 2;
        const r = Math.sqrt(1 - y * y);
        const t = i * 2.39996;
        pos.set([Math.cos(t) * r, y, Math.sin(t) * r], i * 3);
        const a = (i / n) * Math.PI * 2;
        ring.set([Math.cos(a) * 1.15, (Math.random() - 0.5) * 0.08, Math.sin(a) * 1.15], i * 3);
        seed[i] = Math.random();
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geometry.setAttribute("aRing", new THREE.BufferAttribute(ring, 3));
      geometry.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
      const uniforms = { uTime: { value: 0 }, uEnergy: { value: 0 }, uEmpty: { value: 0 }, uSize: { value: 2.4 * renderer.getPixelRatio() }, uColor: { value: new THREE.Color() } };
      const material = new THREE.ShaderMaterial({ vertexShader: VERTEX, fragmentShader: FRAGMENT, uniforms, transparent: true, depthWrite: false });
      const paint = () => {
        const dark = document.documentElement.classList.contains("dark");
        uniforms.uColor.value.set(dark ? "#c4b5fd" : "#7c3aed");
        material.blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending;
        material.needsUpdate = true;
      };
      paint();
      scene.add(new THREE.Points(geometry, material));
      const size = () => { const w = host.clientWidth || 1; const h = host.clientHeight || 1; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
      size();
      const want = { energy: 0, empty: 0 };
      let frame = 0;
      let running = false;
      let last = performance.now();
      const render = () => renderer.render(scene, camera);
      const tick = (now) => {
        frame = requestAnimationFrame(tick);
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        uniforms.uTime.value += dt;
        want.energy = Math.max(0, want.energy - dt * 1.2);
        uniforms.uEnergy.value += (want.energy - uniforms.uEnergy.value) * Math.min(1, dt * 8);
        uniforms.uEmpty.value += (want.empty - uniforms.uEmpty.value) * Math.min(1, dt * 6);
        render();
      };
      api.current = {
        kick: (e) => { want.energy = Math.min(1, want.energy + e); },
        empty: (on) => { want.empty = on ? 1 : 0; if (!running) { uniforms.uEmpty.value = want.empty; render(); } },
        play: () => { if (running) return; running = true; last = performance.now(); frame = requestAnimationFrame(tick); },
        stop: () => { running = false; cancelAnimationFrame(frame); uniforms.uTime.value = Math.max(uniforms.uTime.value, 0.6); render(); },
      };
      if (still) api.current.stop(); else api.current.play();
      cleanup = () => { cancelAnimationFrame(frame); geometry.dispose(); material.dispose(); renderer.dispose(); canvas.remove(); api.current = null; };
    })();
    return () => { cancelled = true; cleanup(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (still) api.current?.stop(); else api.current?.play(); }, [still]);
  useEffect(() => { if (energy) api.current?.kick(0.35); }, [energy]);
  useEffect(() => { api.current?.empty(empty); }, [empty]);

  return <div ref={box} aria-hidden="true" className={className} />;
}
