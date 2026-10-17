// Makes the four login sculpture images (public/sculpture/*.webp). Our own picture, drawn by this script:
// no photo, no model, no third-party image.
//
//   npm run make:sculpture                     draws the four images and writes them into public/sculpture/
//   npm run make:sculpture -- --verify         draws them again in memory and checks the files on disk match,
//                                              plus the rules below (exits with an error if something is off)
//   npm run make:sculpture -- --out some/dir   writes somewhere else (to look at a change without touching the site)
//
// What it draws: one continuous ribbon of brushed, folded metal in Arjun purple. It enters from the left as loose dust,
// folds over itself into one open ring, then twists and dissolves into dust on the right. The ribbon is a 3D strip (a
// centre line plus a width that twists). We turn it into many small triangles, draw them nearest-first (a "z-buffer"),
// and light each point like brushed metal. The same shape and the same random seed are used for the light and the dark
// picture; only the colours differ, so the picture does not jump when the theme changes.
//
// Rules the images must follow (the sculpture component in components/ui/ finds the form by its colour):
//   1. Every pixel that is not part of the form is EXACTLY the flat background colour (config: themes.*.bg), which is
//      also the colour of the page panel. The outer 32 pixels of every file are background only.
//   2. Every pixel fully inside the form is at least 0.08 away from that background (otherwise it would become a hole).
//   3. Same input, same bytes: a fixed seed, no Math.random, no clock.
// WebP is saved lossless first (exact colours). Only if a file is over budget do we try near-lossless, and only if the
// corners and the 32px border still equal the background exactly.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

let sharp;
try {
  sharp = (await import("sharp")).default;
} catch {
  console.error("The image tool 'sharp' could not be loaded. Run `npm ci` inside the hushwork-app folder, then try again.");
  process.exit(1);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(here, "sculpture-config.json"), "utf8"));
const defaultOut = path.join(here, "..", "public", "sculpture");

// ---------------------------------------------------------------------------------------------------------------------
// Small helpers: colours, a seeded random generator, smooth noise
// ---------------------------------------------------------------------------------------------------------------------
const hexToRgb = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
const rgbDistance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) / 255; // 0 (same) to 1.73 (black vs white)
const clamp = (x, lo = 0, hi = 1) => (x < lo ? lo : x > hi ? hi : x);
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;

// mulberry32: a tiny seeded random generator. Same seed, same numbers, every run and every machine.
function makeRandom(seed) {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (random) => Math.sqrt(-2 * Math.log(random() + 1e-9)) * Math.cos(2 * Math.PI * random()); // bell-curve number

// Value noise: a smooth random surface, 0 to 1. Used for the brushed lines and for the ragged ends of the ribbon.
function hash2(ix, iy, seed) {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function noise2(x, y, seed) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash2(x0, y0, seed), b = hash2(x0 + 1, y0, seed), c = hash2(x0, y0 + 1, seed), d = hash2(x0 + 1, y0 + 1, seed);
  return mix(mix(a, b, sx), mix(c, d, sx), sy);
}

// A colour ramp: stops from shadow to light. x = 0 gives the first stop, x = 1 the last; in between we blend neighbours.
function rampColor(stops, x, out) {
  const f = clamp(x) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(f));
  const t = f - i;
  out[0] = mix(stops[i][0], stops[i + 1][0], t);
  out[1] = mix(stops[i][1], stops[i + 1][1], t);
  out[2] = mix(stops[i][2], stops[i + 1][2], t);
}

// A smooth curve through keyframes [[t, value], ...] (used for the ribbon width and twist along its length).
function keyed(keys) {
  const slope = keys.map((k, i) => {
    const a = keys[Math.max(0, i - 1)], b = keys[Math.min(keys.length - 1, i + 1)];
    return b[0] === a[0] ? 0 : (b[1] - a[1]) / (b[0] - a[0]);
  });
  return (t) => {
    let i = 0;
    while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
    const [t0, v0] = keys[i], [t1, v1] = keys[i + 1];
    const h = t1 - t0, u = clamp((t - t0) / h);
    const u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * v0 + (u3 - 2 * u2 + u) * h * slope[i] + (-2 * u3 + 3 * u2) * v1 + (u3 - u2) * h * slope[i + 1];
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// The shape. Everything below is in pixels of the image it belongs to. Edit these numbers to change the sculpture.
// ---------------------------------------------------------------------------------------------------------------------

// Landscape control points [x as a share of width, y as a share of height, depth in px (bigger = nearer the viewer)].
// The ribbon passes through them in order: enters left, crosses itself once (behind, then in front) to make the ring, leaves right.
const LANDSCAPE_POINTS = [
  [0.095, 0.7, -50], [0.185, 0.665, -35], [0.29, 0.635, -25], [0.39, 0.63, -35], [0.465, 0.665, -55],
  [0.54, 0.69, -45], [0.615, 0.62, -10], [0.655, 0.46, 20], [0.625, 0.305, 45], [0.555, 0.205, 60],
  [0.47, 0.205, 60], [0.42, 0.305, 45], [0.43, 0.45, 30], [0.485, 0.59, 25], [0.55, 0.71, 50],
  [0.625, 0.775, 55], [0.72, 0.775, 30], [0.81, 0.69, 0], [0.875, 0.585, -25], [0.915, 0.5, -45],
];
const HALF_WIDTH = [[0, 3], [0.04, 18], [0.12, 60], [0.28, 86], [0.5, 97], [0.7, 95], [0.86, 75], [0.95, 31], [1, 3]]; // px, landscape
const TWIST = [[0, 0.6], [0.1, 0.9], [0.2, -0.5], [0.3, 0.7], [0.4, 0.3], [0.5, 0.9], [0.57, 0.35], [0.66, -0.9], [0.76, 0.5], [0.82, -0.6], [0.9, 0.9], [1, 0.5]]; // radians
const THICKNESS = 4; // px: the ribbon is a thin slab, so an edge-on ribbon is still a 4px line, never thinner

const SHAPES = {
  landscape: { ...config.sizes.landscape },
  // The portrait picture is not a crop: the same ribbon, turned about 43 degrees so it climbs from lower left to upper right.
  portrait: { ...config.sizes.portrait, turn: -0.75, scale: 0.7, centre: [0.5, 0.46], widthBoost: 1.42 },
};

// ---------------------------------------------------------------------------------------------------------------------
// Step 1: the centre line of the ribbon, sampled every pixel, with its twisting frame
// ---------------------------------------------------------------------------------------------------------------------
function catmullRom(points, segment, u) {
  const p0 = points[Math.max(segment - 1, 0)], p1 = points[segment], p2 = points[segment + 1], p3 = points[Math.min(segment + 2, points.length - 1)];
  const u2 = u * u, u3 = u2 * u;
  return [0, 1, 2].map((k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u3));
}

function buildPath(shapeName) {
  const shape = SHAPES[shapeName];
  const W = shape.width, H = shape.height;
  // Landscape points in pixels.
  let pts = LANDSCAPE_POINTS.map(([fx, fy, z]) => [fx * SHAPES.landscape.width, fy * SHAPES.landscape.height, z]);
  let widthScale = 1;
  if (shapeName === "portrait") {
    // Turn and shrink the landscape ribbon around the middle of the ring, then place it in the portrait picture.
    const ring = [0.54 * SHAPES.landscape.width, 0.47 * SHAPES.landscape.height];
    const cos = Math.cos(shape.turn), sin = Math.sin(shape.turn);
    pts = pts.map(([x, y, z]) => {
      const dx = x - ring[0], dy = y - ring[1];
      return [(dx * cos - dy * sin) * shape.scale + shape.centre[0] * W, (dx * sin + dy * cos) * shape.scale + shape.centre[1] * H, z * shape.scale];
    });
    widthScale = shape.scale * shape.widthBoost;
  }
  // Dense samples of the spline, then resample at equal distances (1px), so "t" means distance along the ribbon.
  const dense = [];
  for (let s = 0; s < pts.length - 1; s++) for (let k = 0; k < 40; k++) dense.push(catmullRom(pts, s, k / 40));
  dense.push(pts[pts.length - 1]);
  const lengths = [0];
  for (let i = 1; i < dense.length; i++) lengths.push(lengths[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1], dense[i][2] - dense[i - 1][2]));
  const total = lengths[lengths.length - 1];
  const n = Math.ceil(total);
  const P = new Float64Array(n * 3);
  let j = 0;
  for (let i = 0; i < n; i++) {
    const target = (i / (n - 1)) * total;
    while (j < lengths.length - 2 && lengths[j + 1] < target) j++;
    const f = (target - lengths[j]) / (lengths[j + 1] - lengths[j] || 1);
    for (let k = 0; k < 3; k++) P[i * 3 + k] = mix(dense[j][k], dense[j + 1][k], f);
  }
  // Frame at every sample: T along the ribbon, Wd across it (the width direction, twisted), N out of its face.
  const widthAt = keyed(HALF_WIDTH), twistAt = keyed(TWIST);
  const T = new Float64Array(n * 3), Wd = new Float64Array(n * 3), N = new Float64Array(n * 3), half = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 3), b = Math.min(n - 1, i + 3);
    let tx = P[b * 3] - P[a * 3], ty = P[b * 3 + 1] - P[a * 3 + 1], tz = P[b * 3 + 2] - P[a * 3 + 2];
    const tl = Math.hypot(tx, ty, tz); tx /= tl; ty /= tl; tz /= tl;
    // B0 lies in the picture plane, across the ribbon; N0 faces the viewer. The twist angle turns them around T.
    let bx = ty, by = -tx; const bl = Math.hypot(bx, by) || 1; bx /= bl; by /= bl;
    let nx = by * tz, ny = -bx * tz, nz = bx * ty - by * tx; // B0 x T
    const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
    const phi = twistAt(i / (n - 1)), c = Math.cos(phi), s = Math.sin(phi);
    T[i * 3] = tx; T[i * 3 + 1] = ty; T[i * 3 + 2] = tz;
    Wd[i * 3] = c * bx + s * nx; Wd[i * 3 + 1] = c * by + s * ny; Wd[i * 3 + 2] = s * nz;
    N[i * 3] = -s * bx + c * nx; N[i * 3 + 1] = -s * by + c * ny; N[i * 3 + 2] = c * nz;
    half[i] = Math.max(1.5, widthAt(i / (n - 1)) * widthScale);
  }
  return { n, P, T, Wd, N, half, total, width: W, height: H };
}

// ---------------------------------------------------------------------------------------------------------------------
// Step 2: draw the ribbon's triangles into a depth buffer (nearest wins). We draw at SS times the final size, then average.
// ---------------------------------------------------------------------------------------------------------------------
function drawRibbon(path, SS) {
  const W = path.width * SS, H = path.height * SS;
  const depth = new Float32Array(W * H).fill(-1e9);
  const along = new Float32Array(W * H); // 0..1 along the ribbon
  const across = new Float32Array(W * H); // -1..1 across the ribbon
  const face = new Int8Array(W * H); // +1 front sheet, -1 back sheet, 0 empty
  const ACROSS_STEPS = 40;
  const { n, P, Wd, N, half } = path;
  const row = (i, side, out) => { // the screen position of one row of vertices
    for (let k = 0; k <= ACROSS_STEPS; k++) {
      const s = -1 + (2 * k) / ACROSS_STEPS;
      const bow = (1 - s * s) * half[i] * 0.1; // the strip bows a little toward the viewer
      const lift = side * THICKNESS * 0.5 + bow;
      out[k * 3] = (P[i * 3] + s * half[i] * Wd[i * 3] + lift * N[i * 3]) * SS;
      out[k * 3 + 1] = (P[i * 3 + 1] + s * half[i] * Wd[i * 3 + 1] + lift * N[i * 3 + 1]) * SS;
      out[k * 3 + 2] = P[i * 3 + 2] + s * half[i] * Wd[i * 3 + 2] + lift * N[i * 3 + 2];
    }
  };
  const A = new Float64Array((ACROSS_STEPS + 1) * 3), B = new Float64Array((ACROSS_STEPS + 1) * 3);

  function triangle(x0, y0, z0, t0, s0, x1, y1, z1, t1, s1, x2, y2, z2, t2, s2, side) {
    const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2))), maxX = Math.min(W - 1, Math.ceil(Math.max(x0, x1, x2)));
    const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2))), maxY = Math.min(H - 1, Math.ceil(Math.max(y0, y1, y2)));
    const denom = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
    if (Math.abs(denom) < 1e-9) return;
    const inv = 1 / denom, eps = -1e-5;
    for (let y = minY; y <= maxY; y++) {
      const py = y + 0.5;
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5;
        const w0 = ((y1 - y2) * (px - x2) + (x2 - x1) * (py - y2)) * inv;
        const w1 = ((y2 - y0) * (px - x2) + (x0 - x2) * (py - y2)) * inv;
        const w2 = 1 - w0 - w1;
        if (w0 < eps || w1 < eps || w2 < eps) continue;
        const z = w0 * z0 + w1 * z1 + w2 * z2;
        const idx = y * W + x;
        if (z > depth[idx]) {
          depth[idx] = z;
          along[idx] = w0 * t0 + w1 * t1 + w2 * t2;
          across[idx] = w0 * s0 + w1 * s1 + w2 * s2;
          face[idx] = side;
        }
      }
    }
  }

  for (const side of [1, -1]) {
    row(0, side, A);
    for (let i = 0; i < n - 1; i++) {
      row(i + 1, side, B);
      const t0 = i / (n - 1), t1 = (i + 1) / (n - 1);
      for (let k = 0; k < ACROSS_STEPS; k++) {
        const s0 = -1 + (2 * k) / ACROSS_STEPS, s1 = -1 + (2 * (k + 1)) / ACROSS_STEPS;
        triangle(A[k * 3], A[k * 3 + 1], A[k * 3 + 2], t0, s0, B[k * 3], B[k * 3 + 1], B[k * 3 + 2], t1, s0, A[k * 3 + 3], A[k * 3 + 4], A[k * 3 + 5], t0, s1, side);
        triangle(A[k * 3 + 3], A[k * 3 + 4], A[k * 3 + 5], t0, s1, B[k * 3], B[k * 3 + 1], B[k * 3 + 2], t1, s0, B[k * 3 + 3], B[k * 3 + 4], B[k * 3 + 5], t1, s1, side);
      }
      A.set(B);
    }
  }
  return { W, H, depth, along, across, face };
}

// ---------------------------------------------------------------------------------------------------------------------
// Step 3: light each point like brushed metal. We work out a few "light terms" once, then each theme mixes them its own way.
// Brushed metal has fine grooves along the ribbon, so a light shows up as a bright BAND ACROSS the ribbon (not a round spot).
// ---------------------------------------------------------------------------------------------------------------------
function norm3(v) { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; }
const KEY = norm3([-0.5, -0.62, 0.6]); // soft key light, upper left, toward the viewer
const RIM = norm3([0.62, 0.5, 0.6]); // cool light from lower right, separates the ribbon from the ground
const STRIP = norm3([0.12, -0.8, 0.59]); // a narrow strip light overhead: the long specular streaks
const halfway = (light) => norm3([light[0], light[1], light[2] + 1]); // halfway between the light and the viewer (0,0,1)
const H_KEY = halfway(KEY), H_RIM = halfway(RIM), H_STRIP = halfway(STRIP);
const dot3 = (a, b0, b1, b2) => a[0] * b0 + a[1] * b1 + a[2] * b2;

// Anisotropic highlight (Ward): sharp along the grooves (t), wide across them (w).
function bandHighlight(h, n, t, w, sharp, wide) {
  const hn = Math.max(0.05, dot3(n, h[0], h[1], h[2]));
  const ht = dot3(t, h[0], h[1], h[2]) / sharp, hw = dot3(w, h[0], h[1], h[2]) / wide;
  return Math.exp(-(ht * ht + hw * hw) / (hn * hn));
}

// Terms for one surface point: n = normal, t = along the ribbon, w = across it.
// Returns [diffuse, horizon, key band, rim band, strip band].
const terms = new Float64Array(5);
const nVec = [0, 0, 1];
const BEAD_T = [1, 0, 0], BEAD_W = [0, 1, 0];
function lightTerms(nx, ny, nz, t, w) {
  if (nz < 0) { nx = -nx; ny = -ny; nz = -nz; } // we only see the side that faces us
  nVec[0] = nx; nVec[1] = ny; nVec[2] = nz;
  terms[0] = Math.max(0, nx * KEY[0] + ny * KEY[1] + nz * KEY[2]);
  const ry = 2 * nz * ny; // up/down part of the mirror direction: sky above, ground below
  terms[1] = smoothstep(-0.3, 0.3, -ry - 0.08); // a fairly crisp horizon: bright sky above, dark ground below
  terms[2] = bandHighlight(H_KEY, nVec, t, w, 0.2, 0.55);
  terms[3] = bandHighlight(H_RIM, nVec, t, w, 0.22, 0.6) * (1 - 0.4 * nz);
  terms[4] = bandHighlight(H_STRIP, nVec, t, w, 0.12, 0.5);
  return terms;
}

// Tones are rounded to this many steps. It keeps the files small (a smooth picture compresses far better when many neighbouring
// pixels share a value) and the steps are only 2 to 3 colour levels wide, so no banding is visible.
const TONE_STEPS = 32;

// How each theme turns light terms into one tone (0 = ramp shadow, 1 = ramp highlight).
const TONE = {
  light: (t, occlusion, grain) => clamp((0.0 + 0.26 * t[0] + 0.3 * t[1] + 0.7 * t[2] + 0.5 * t[3] + 0.5 * t[4] + 0.14 * grain) * occlusion) ** 1.15,
  dark: (t, occlusion, grain) => clamp((0.0 + 0.3 * t[0] + 0.3 * t[1] + 0.5 * t[2] + 0.42 * t[3] + 0.4 * t[4] + 0.14 * grain) * occlusion) ** 1.12,
};

// Shades every drawn sample and averages SS x SS samples into one final pixel. Returns, for each theme, premultiplied
// colour sums and the share of each pixel the ribbon covers (0 to 1).
function shadeRibbon(path, raster, themes, SS) {
  const { W, H, depth, along, across, face } = raster;
  const outW = W / SS, outH = H / SS;
  const names = Object.keys(themes);
  const sums = {}; for (const name of names) sums[name] = new Float32Array(outW * outH * 3);
  const count = new Float32Array(outW * outH);
  const { n, T, Wd, N } = path;
  const color = [0, 0, 0];
  const tv = [0, 0, 0], wv = [0, 0, 0];
  const radii = [[5 * SS, 1], [14 * SS, 0.7]];
  const directions = [[1, 0], [0.7, 0.7], [0, 1], [-0.7, 0.7], [-1, 0], [-0.7, -0.7], [0, -1], [0.7, -0.7]];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      if (face[idx] === 0) continue;
      const t = along[idx], s = across[idx];
      // Ragged ends: the ribbon breaks into fine specks near both ends.
      const edge = Math.min(t, 1 - t);
      const dissolve = Math.pow(1 - smoothstep(0, 0.13, edge), 1.4);
      if (dissolve > 0 && noise2(x / (SS * 1.7), y / (SS * 1.7), 11) < dissolve * 1.1) continue;
      // Frame at this point along the ribbon.
      const f = t * (n - 1), i0 = Math.min(n - 2, Math.floor(f)), u = f - i0;
      for (let k = 0; k < 3; k++) { wv[k] = mix(Wd[i0 * 3 + k], Wd[i0 * 3 + 3 + k], u); tv[k] = mix(T[i0 * 3 + k], T[i0 * 3 + 3 + k], u); }
      const nx0 = mix(N[i0 * 3], N[i0 * 3 + 3], u), ny0 = mix(N[i0 * 3 + 1], N[i0 * 3 + 4], u), nz0 = mix(N[i0 * 3 + 2], N[i0 * 3 + 5], u);
      // Brushed look: fine lines run along the ribbon, so the surface wobbles quickly ACROSS it and slowly ALONG it.
      const lines = noise2(s * 26 + 40, t * 7, 3) * 0.65 + noise2(s * 64 + 9, t * 14, 5) * 0.35;
      const tilt = s * 0.55 + s * s * s * 0.95 + (lines - 0.5) * 0.3; // the strip is bowed (steep at the edges), with the brushing on top
      const side = face[idx];
      const c = Math.cos(tilt), sn = Math.sin(tilt);
      let nx = side * (nx0 * c + wv[0] * sn), ny = side * (ny0 * c + wv[1] * sn), nz = side * (nz0 * c + wv[2] * sn);
      const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      // Ambient occlusion: darker where something nearer is close by (where the ribbon passes over itself).
      const z = depth[idx];
      let blocked = 0, taps = 0;
      for (const [radius, weight] of radii) {
        for (const [dx, dy] of directions) {
          const sx = x + Math.round(dx * radius), sy = y + Math.round(dy * radius);
          taps += weight;
          if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
          if (depth[sy * W + sx] > z + 14) blocked += weight;
        }
      }
      const occlusion = 1 - 0.55 * (blocked / taps);
      const lt = lightTerms(nx, ny, nz, tv, wv);
      const grain = 0.5 * (lines - 0.5) * (0.4 + 1.6 * (lt[2] + lt[4]));
      const o = ((y / SS) | 0) * outW + ((x / SS) | 0);
      count[o] += 1;
      for (const name of names) {
        rampColor(themes[name].ramp, Math.round(TONE[name](lt, occlusion, grain) * TONE_STEPS) / TONE_STEPS, color);
        const sum = sums[name];
        sum[o * 3] += color[0]; sum[o * 3 + 1] += color[1]; sum[o * 3 + 2] += color[2];
      }
    }
  }
  return { outW, outH, sums, count, perPixel: SS * SS };
}

// ---------------------------------------------------------------------------------------------------------------------
// Step 4: dust, grains and a few beads around the ribbon. Same positions for both themes (fixed seed).
// ---------------------------------------------------------------------------------------------------------------------
function scatterParticles(path, shapeName) {
  const random = makeRandom(config.seed + (shapeName === "portrait" ? 7919 : 0));
  const { n, P, T, total, width: W, height: H } = path;
  const scale = shapeName === "portrait" ? 0.75 : 1;
  // Particles stay inside this box, so the picture keeps its empty margins (about 5.5% at the sides, 8% above, a bit more below).
  const box = shapeName === "portrait" ? [0.065 * W, 0.1 * H, 0.935 * W, 0.89 * H] : [0.055 * W, 0.1 * H, 0.945 * W, 0.9 * H];
  const list = [];
  // tPos is a place along the ribbon; below 0 or above 1 it continues in a straight line past the end.
  const add = (kind, count, spreadFor, sizeFor, pickT) => {
    for (let k = 0; k < count; k++) {
      const tPos = pickT();
      const t = clamp(tPos), i = Math.round(t * (n - 1)), extra = (tPos - t) * total;
      const spread = spreadFor(t);
      const x = P[i * 3] + T[i * 3] * extra + gauss(random) * spread, y = P[i * 3 + 1] + T[i * 3 + 1] * extra + gauss(random) * spread * 0.8;
      if (x < box[0] || y < box[1] || x > box[2] || y > box[3]) continue;
      list.push({ kind, x, y, r: sizeFor(), tone: random(), pick: random(), t });
    }
  };
  const atEnds = () => (random() < 0.5 ? Math.abs(gauss(random)) * 0.1 - 0.035 : 1 - (Math.abs(gauss(random)) * 0.1 - 0.035)); // thick near both ends, thinning outward
  const anywhere = () => random();
  const endSpread = (t) => (16 + 58 * (1 - smoothstep(0, 0.2, Math.min(t, 1 - t)))) * scale;
  add("dust", 2800, endSpread, () => 0.55 + random() * 0.45, atEnds);
  add("dust", 700, () => 46 * scale, () => 0.55 + random() * 0.4, anywhere);
  add("grain", 600, endSpread, () => 1.5 + random() * 0.6, atEnds);
  add("grain", 180, () => 38 * scale, () => 1.5 + random() * 0.6, anywhere);
  add("bead", 34, () => 36 * scale, () => (3 + random() * 4) * Math.max(0.75, scale), () => 0.1 + random() * 0.8);
  return list;
}

// ---------------------------------------------------------------------------------------------------------------------
// Step 5: put it together: background, ribbon, particles. Returns pixels plus facts for the checks.
// ---------------------------------------------------------------------------------------------------------------------
function composeScene(shapeName, themeNames, SS) {
  const path = buildPath(shapeName);
  const raster = drawRibbon(path, SS);
  const themes = {};
  for (const name of themeNames) {
    const t = config.themes[name];
    themes[name] = { bg: hexToRgb(t.bg), ramp: t.ramp.map(hexToRgb), neutrals: t.neutrals.map(hexToRgb) };
  }
  const shaded = shadeRibbon(path, raster, themes, SS);
  const { outW: W, outH: H } = shaded;
  const particles = scatterParticles(path, shapeName);
  const images = {};
  for (const name of themeNames) {
    const { bg, ramp, neutrals } = themes[name];
    const pixels = new Uint8Array(W * H * 3);
    const cover = new Float32Array(W * H); // 1 = fully part of the form, 0 = exactly background
    const touched = new Uint8Array(W * H); // 1 where a particle was drawn (its soft edge blends two palette colours)
    const sum = shaded.sums[name];
    const colour = [0, 0, 0];
    for (let i = 0; i < W * H; i++) {
      const c = shaded.count[i] / shaded.perPixel;
      cover[i] = c;
      for (let k = 0; k < 3; k++) pixels[i * 3 + k] = c === 0 ? bg[k] : Math.round(bg[k] + (sum[i * 3 + k] / shaded.count[i] - bg[k]) * c);
    }
    // Particles are drawn on top, as soft little discs.
    const blend = (x, y, alpha, rgb) => {
      if (x < 0 || y < 0 || x >= W || y >= H || alpha <= 0) return;
      const i = y * W + x;
      for (let k = 0; k < 3; k++) pixels[i * 3 + k] = Math.round(pixels[i * 3 + k] * (1 - alpha) + rgb[k] * alpha);
      cover[i] = cover[i] + alpha * (1 - cover[i]);
      touched[i] = 1;
    };
    for (const p of particles) {
      const margin = config.borderPixels + 4;
      if (p.x < margin || p.y < margin || p.x > W - margin || p.y > H - margin) continue;
      if (p.kind === "bead") {
        const r = p.r;
        for (let y = Math.floor(p.y - r - 1); y <= Math.ceil(p.y + r + 1); y++) for (let x = Math.floor(p.x - r - 1); x <= Math.ceil(p.x + r + 1); x++) {
          const qx = (x + 0.5 - p.x) / r, qy = (y + 0.5 - p.y) / r, q = Math.hypot(qx, qy);
          const alpha = clamp((1 - q) * r + 0.5);
          if (alpha <= 0) continue;
          const nz = Math.sqrt(Math.max(0, 1 - q * q));
          const lt = lightTerms(qx, qy, nz, BEAD_T, BEAD_W);
          const spark = Math.pow(clamp(1 - Math.hypot(qx + 0.4, qy + 0.45) / 0.3), 1.5); // a tiny highlight
          const tone = clamp(TONE[name](lt, 1, 0) * (0.85 + 0.3 * p.tone) + 0.5 * spark);
          rampColor(ramp, tone, colour);
          blend(x, y, alpha, colour);
        }
        continue;
      }
      const neutral = p.pick < 0.22;
      if (neutral) { const c = neutrals[p.pick < 0.11 ? 0 : 1]; colour[0] = c[0]; colour[1] = c[1]; colour[2] = c[2]; }
      else rampColor(ramp, Math.round(((name === "dark" ? 0.2 : 0.05) + p.tone * (name === "dark" ? 0.8 : 0.72)) * 8) / 8, colour);
      for (let y = Math.floor(p.y - p.r - 1); y <= Math.ceil(p.y + p.r + 1); y++) for (let x = Math.floor(p.x - p.r - 1); x <= Math.ceil(p.x + p.r + 1); x++) {
        const d = Math.hypot(x + 0.5 - p.x, y + 0.5 - p.y);
        blend(x, y, Math.round(clamp(p.r + 0.5 - d) * 3) / 3, colour); // three edge levels only: keeps the file small
      }
    }
    images[name] = { width: W, height: H, pixels, cover, touched, bg };
  }
  return images;
}

// ---------------------------------------------------------------------------------------------------------------------
// Checks and encoding
// ---------------------------------------------------------------------------------------------------------------------
function borderIsBackground(pixels, W, H, bg, border) {
  for (let y = 0; y < H; y++) {
    const inBand = y < border || y >= H - border;
    for (let x = 0; x < W; x++) {
      if (!inBand && x >= border && x < W - border) { x = W - border - 1; continue; }
      const i = (y * W + x) * 3;
      if (pixels[i] !== bg[0] || pixels[i + 1] !== bg[1] || pixels[i + 2] !== bg[2]) return false;
    }
  }
  return true;
}

// What the sculpture component will make of this picture (it reads it on a 1000-wide grid).
// How far a colour is from the theme's palette: the nearest point on the ramp (a line through the stops) or a neutral.
function paletteDistance(rgb, ramp, neutrals) {
  let best = 9;
  for (const n of neutrals) best = Math.min(best, rgbDistance(rgb, n));
  for (let k = 0; k < ramp.length - 1; k++) {
    const a = ramp[k], b = ramp[k + 1];
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ap = [rgb[0] - a[0], rgb[1] - a[1], rgb[2] - a[2]];
    const u = clamp((ab[0] * ap[0] + ab[1] * ap[1] + ab[2] * ap[2]) / (ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2]));
    best = Math.min(best, rgbDistance(rgb, [a[0] + ab[0] * u, a[1] + ab[1] * u, a[2] + ab[2] * u]));
  }
  return best;
}

let PALETTE_LIMIT = 0.06;
function describe(image, ramp, neutrals) {
  const { width: W, height: H, pixels, cover, touched, bg } = image;
  let covered = 0, minFull = 9, minFullAt = null, left = W, right = -1, top = H, bottom = -1, fullPlain = 0, offPalette = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const rgb = [pixels[i * 3], pixels[i * 3 + 1], pixels[i * 3 + 2]];
    const d = rgbDistance(rgb, bg);
    if (d >= 0.05) { covered++; if (x < left) left = x; if (x > right) right = x; if (y < top) top = y; if (y > bottom) bottom = y; }
    if (cover[i] > 0.999) {
      if (d < minFull) { minFull = d; minFullAt = [x, y]; }
      // Plain form pixels should sit on the palette. A few blended pixels along sharp fold edges are allowed (below).
      if (!touched[i]) { fullPlain++; if (paletteDistance(rgb, ramp, neutrals) > PALETTE_LIMIT) offPalette++; }
    }
  }
  const gw = 1000, gh = Math.max(1, Math.round(gw / (W / H)));
  // particle estimate: cells whose average colour is far enough from the background
  let particles = 0;
  const cellW = W / gw, cellH = H / gh;
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    const x = Math.min(W - 1, Math.floor((gx + 0.5) * cellW)), y = Math.min(H - 1, Math.floor((gy + 0.5) * cellH));
    const i = y * W + x;
    const d = rgbDistance([pixels[i * 3], pixels[i * 3 + 1], pixels[i * 3 + 2]], bg);
    if (d >= 0.07) particles++; else if (d >= 0.03) particles += (d - 0.03) / 0.04;
  }
  return {
    coverage: covered / (W * H), minFull, minFullAt, offPalette: offPalette / Math.max(1, fullPlain), particles: Math.round(particles),
    box: { left: left / W, right: (W - 1 - right) / W, top: top / H, bottom: (H - 1 - bottom) / H, width: (right - left + 1) / W, height: (bottom - top + 1) / H },
  };
}

// Lossless first; near-lossless only if the file is over budget and the border and corners still equal the background.
async function encode(image) {
  const { width: W, height: H, pixels, bg } = image;
  const input = () => sharp(Buffer.from(pixels.buffer, pixels.byteOffset, pixels.length), { raw: { width: W, height: H, channels: 3 } });
  const tries = [{ lossless: true, effort: 6 }, { nearLossless: true, quality: 80, effort: 6 }, { nearLossless: true, quality: 60, effort: 6 }];
  let last = null;
  for (const options of tries) {
    const bytes = await input().webp(options).toBuffer();
    if (options.lossless) { last = { bytes, mode: "lossless" }; if (bytes.length <= config.budgetBytes) return last; continue; }
    const decoded = await sharp(bytes).raw().toBuffer();
    if (bytes.length <= config.budgetBytes && borderIsBackground(decoded, W, H, bg, config.borderPixels)) return { bytes, mode: `near-lossless ${options.quality} (lossless was ${(last.bytes.length / 1024).toFixed(0)} KB)` };
  }
  return { ...last, overBudget: true };
}

async function renderAll() {
  const results = {};
  const byShape = {};
  for (const [file, { theme, shape }] of Object.entries(config.files)) (byShape[shape] ??= []).push([file, theme]);
  for (const [shape, entries] of Object.entries(byShape)) {
    const images = composeScene(shape, [...new Set(entries.map(([, theme]) => theme))], SUPERSAMPLE);
    for (const [file, theme] of entries) results[file] = { image: images[theme], theme, shape };
  }
  return results;
}

// ---------------------------------------------------------------------------------------------------------------------
// Command line
// ---------------------------------------------------------------------------------------------------------------------
const args = process.argv.slice(2);
const verify = args.includes("--verify");
const outIndex = args.indexOf("--out");
const outDir = outIndex >= 0 ? path.resolve(args[outIndex + 1]) : defaultOut;
const png = args.includes("--png"); // also write a PNG of each picture next to it (for looking at it)
const ssIndex = args.indexOf("--ss"); // a smaller number draws faster but rougher: only for looking, never for the site
const SUPERSAMPLE = ssIndex >= 0 ? Number(args[ssIndex + 1]) : config.supersample;
if (SUPERSAMPLE !== config.supersample && (verify || outDir === defaultOut)) {
  console.error("--ss only works together with --out <folder>, because the site's images must use the supersample in sculpture-config.json.");
  process.exit(1);
}

const started = Date.now();
const rendered = await renderAll();
const problems = [];
const fmt = (n, d = 3) => Number(n).toFixed(d);

for (const [file, { image, theme, shape }] of Object.entries(rendered)) {
  const { bytes, mode, overBudget } = await encode(image);
  const themeConfig = config.themes[theme];
  // Judge the picture as it will be shipped: decode the file we are about to write.
  const shipped = { ...image, pixels: await sharp(bytes).raw().toBuffer() };
  const facts = describe(shipped, themeConfig.ramp.map(hexToRgb), themeConfig.neutrals.map(hexToRgb));
  const rules = config.rules;
  PALETTE_LIMIT = rules.paletteMaxDistance;
  console.log(`${file}  ${image.width}x${image.height}  ${(bytes.length / 1024).toFixed(0)} KB (${mode})  covers ${fmt(facts.coverage * 100, 1)}%  particles~${facts.particles}  ` +
    `margins L${fmt(facts.box.left * 100, 1)}% R${fmt(facts.box.right * 100, 1)}% T${fmt(facts.box.top * 100, 1)}% B${fmt(facts.box.bottom * 100, 1)}%  closest full pixel to background ${fmt(facts.minFull)}  pixels off the palette ${fmt(facts.offPalette * 100, 2)}%`);
  if (overBudget) problems.push(`${file}: ${bytes.length} bytes is over the ${config.budgetBytes} byte budget`);
  if (facts.minFull < config.minKeyDistance) problems.push(`${file}: a fully covered pixel at ${facts.minFullAt} is only ${fmt(facts.minFull)} from the background (needs ${config.minKeyDistance})`);
  if (facts.offPalette > rules.paletteMaxOffShare) problems.push(`${file}: ${fmt(facts.offPalette * 100, 2)}% of the form's pixels are more than ${rules.paletteMaxDistance} away from the palette (limit ${rules.paletteMaxOffShare * 100}%)`);
  if (!borderIsBackground(shipped.pixels, image.width, image.height, image.bg, config.borderPixels)) problems.push(`${file}: the outer ${config.borderPixels}px are not all the exact background colour`);
  if (facts.coverage < rules.coverage[0] || facts.coverage > rules.coverage[1]) problems.push(`${file}: the form covers ${fmt(facts.coverage * 100, 1)}% of the picture (expected ${rules.coverage[0] * 100} to ${rules.coverage[1] * 100}%)`);
  const [lo, hi] = rules.particles[shape];
  if (facts.particles < lo || facts.particles > hi) problems.push(`${file}: about ${facts.particles} particles (expected ${lo} to ${hi})`);
  const [sideMargin, edgeMargin] = rules.margins[shape];
  if (facts.box.left < sideMargin || facts.box.right < sideMargin || facts.box.top < edgeMargin || facts.box.bottom < edgeMargin) problems.push(`${file}: the form comes closer than ${sideMargin * 100}% (sides) or ${edgeMargin * 100}% (top and bottom) to the edge`);
  for (const stop of themeConfig.ramp) if (rgbDistance(hexToRgb(stop), image.bg) < 0.1) problems.push(`${file}: palette stop ${stop} is closer than 0.10 to the background`);

  if (verify) {
    const onDisk = path.join(defaultOut, file);
    if (!fs.existsSync(onDisk)) problems.push(`${file}: missing in public/sculpture`);
    else if (!fs.readFileSync(onDisk).equals(bytes)) problems.push(`${file}: the file on disk is not what this script draws (run npm run make:sculpture)`);
    const meta = fs.existsSync(onDisk) ? await sharp(onDisk).metadata() : null;
    if (meta && (meta.width !== image.width || meta.height !== image.height)) problems.push(`${file}: wrong size ${meta.width}x${meta.height}`);
  } else {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, file), bytes);
    if (png) await sharp(Buffer.from(image.pixels.buffer, image.pixels.byteOffset, image.pixels.length), { raw: { width: image.width, height: image.height, channels: 3 } }).png().toFile(path.join(outDir, file.replace(/\.webp$/, ".png")));
  }
}
console.log(`done in ${((Date.now() - started) / 1000).toFixed(1)}s${verify ? " (verify)" : ` -> ${outDir}`}`);
if (problems.length) {
  console.error("\nProblems:\n - " + problems.join("\n - "));
  process.exit(1);
}
if (verify) console.log("verify: OK");
