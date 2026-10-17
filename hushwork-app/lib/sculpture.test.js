// Run with: npm test   (or: node --test lib/sculpture.test.js)
// Checks the four login sculpture images (made by scripts/make-sculpture.mjs) and that their flat background colour is the
// same colour as the page panel they sit on. If the two ever differ, the sculpture component would show a visible rectangle.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const config = JSON.parse(read("scripts/sculpture-config.json"));
const hex = (value) => [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16));
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) / 255;

test("each image has the right size, is within budget and is flat background all around its edge", async () => {
  for (const [file, { theme, shape }] of Object.entries(config.files)) {
    const location = path.join(root, "public", "sculpture", file);
    const size = fs.statSync(location).size;
    assert.ok(size <= config.budgetBytes, `${file} is ${size} bytes, over the ${config.budgetBytes} byte budget`);

    const { data, info } = await sharp(location).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(info.width, config.sizes[shape].width, `${file} width`);
    assert.equal(info.height, config.sizes[shape].height, `${file} height`);

    const bg = hex(config.themes[theme].bg);
    const border = config.borderPixels;
    let wrong = 0;
    for (let y = 0; y < info.height; y++) {
      const onEdgeRow = y < border || y >= info.height - border;
      for (let x = 0; x < info.width; x++) {
        if (!onEdgeRow && x >= border && x < info.width - border) { x = info.width - border - 1; continue; } // skip the middle of the row
        const i = (y * info.width + x) * 3;
        if (data[i] !== bg[0] || data[i + 1] !== bg[1] || data[i + 2] !== bg[2]) wrong++;
      }
    }
    assert.equal(wrong, 0, `${file}: ${wrong} pixels in the outer ${border}px are not exactly ${config.themes[theme].bg}`);
  }
});

test("the palette keeps every stop clearly away from the background colour", () => {
  for (const [name, theme] of Object.entries(config.themes)) {
    for (const stop of theme.ramp) assert.ok(distance(hex(stop), hex(theme.bg)) >= 0.1, `${name} ramp stop ${stop} is too close to ${theme.bg}`);
    for (const stop of theme.neutrals) assert.ok(distance(hex(stop), hex(theme.bg)) >= 0.1, `${name} neutral ${stop} is too close to ${theme.bg}`);
  }
});

test("the image background equals the panel colour in the page (same hex in config, CSS and SculpturePanel.js)", () => {
  const css = read("app/globals.css");
  const light = css.match(/:root\s*\{([^}]*)\}/)[1];
  const dark = css.match(/\.dark\s*\{([^}]*)\}/)[1];
  const token = (block, name) => block.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1].toLowerCase();
  assert.equal(token(light, "--sunken"), config.themes.light.bg, "--sunken (light) in globals.css");
  assert.equal(token(dark, "--sunken"), config.themes.dark.bg, "--sunken (dark) in globals.css");

  const panel = read("components/login/SculpturePanel.js");
  const constant = (name, theme) => panel.match(new RegExp(`const ${name} = \\{[^}]*${theme}: "(#[0-9a-fA-F]{6})"`))?.[1].toLowerCase();
  assert.equal(constant("PANEL", "light"), config.themes.light.bg, "PANEL.light in SculpturePanel.js");
  assert.equal(constant("PANEL", "dark"), config.themes.dark.bg, "PANEL.dark in SculpturePanel.js");
  assert.equal(constant("INK", "light"), token(light, "--ink"), "INK.light should be --ink");
  assert.equal(constant("INK", "dark"), token(dark, "--ink"), "INK.dark should be --ink");

  // The login page paints the panel (and the phone band) with the --sunken token.
  assert.ok(read("app/login/page.js").includes("bg-sunken"), "app/login/page.js should use bg-sunken for the panel");
});
