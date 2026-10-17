"use client";

import { useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { PauseButton } from "../ui";
import { useMotionPause } from "../MotionProvider";
import { usePrefersReducedMotion } from "../usePrefersReducedMotion";
import { useMediaQuery } from "../useMediaQuery";
import { useTheme } from "../useTheme";

// The sculpture is a big WebGL effect, so it is loaded only when it is needed: on desktop, after the page has
// hydrated. ssr:false means it never runs on the server. The form is usable before it arrives.
const SculptureHero = dynamic(() => import("../ui/liquid-sculpture-hero"), { ssr: false });

// The sculpture reads its colours in JavaScript, so it needs hex values. They mirror globals.css:
// panel = --sunken (light and dark); text = --ink. The four sculpture images are drawn on exactly the panel colour
// (scripts/sculpture-config.json), and lib/sculpture.test.js fails if the three ever drift apart.
const PANEL = { light: "#eeecf2", dark: "#0c0a10" };
const INK = { light: "#1c1926", dark: "#f7f6f9" };
const FONT = "var(--font-geist-sans), system-ui, sans-serif";

// Can this browser draw WebGL2 at all? Asked once, then remembered. The test context is released straight away
// so it does not count against the browser's small limit of open graphics contexts.
let webgl2Answer;
function hasWebGL2() {
  if (webgl2Answer === undefined) {
    const gl = document.createElement("canvas").getContext("webgl2");
    webgl2Answer = Boolean(gl);
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  }
  return webgl2Answer;
}
const subscribeToNothing = () => () => {};

// The decorative left panel of /login (desktop only, 1024px and wider). Hidden from screen readers: the page's
// real heading is the form's.
export default function SculpturePanel() {
  const [dark] = useTheme(); // null until the browser knows the theme
  const reduceMotion = usePrefersReducedMotion();
  const { paused } = useMotionPause();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const hasMouse = useMediaQuery("(hover: hover) and (pointer: fine)");
  const canDrawWebGL = useSyncExternalStore(subscribeToNothing, hasWebGL2, () => true);

  if (dark === null || !isDesktop) return null;

  const mode = dark ? "dark" : "light";
  // "Live" means the material may react to the mouse. Otherwise it is a still picture: with reduced motion,
  // with Pause pressed, or on a touch screen. Changing the key rebuilds it at rest, so nothing freezes mid-flow.
  const live = hasMouse && !reduceMotion && !paused;

  return (
    <div aria-hidden="true" className="hw-fade absolute inset-0">
      <SculptureHero
        key={live ? "live" : "still"}
        className="login-art"
        src="/sculpture/light.webp" darkSrc="/sculpture/dark.webp"
        mobileSrc="/sculpture/mobile-light.webp" mobileDarkSrc="/sculpture/mobile-dark.webp"
        imageAlt=""
        theme={mode}
        background={PANEL.light} darkBackground={PANEL.dark}
        textColor={INK[mode]}
        headline={"Quiet work,\ndone."} headlineAccent="" eyebrow="" body=""
        primaryCta={{ label: "", href: "" }} secondaryCta={{ label: "", href: "" }} navCta={{ label: "", href: "" }}
        showNav={false} themeToggle={false} showCredit={false} backdropText="" loadFonts={false}
        headingFont={FONT} bodyFont={FONT} accentFont={FONT}
        hint={canDrawWebGL ? "Move your cursor over it" : ""} hintTouch=""
        height="100%" interactive={live} intro={false} ambient={false}
        sculptureScale={0.785} mobileSculptureScale={1}
      />
    </div>
  );
}

// Credit and Pause button: two small glass pills over the bottom corners of the panel (16px in from its edges; the panel
// is inset 12px). It is the last thing in the page's HTML so keyboard users reach the form first.
export function PanelFooter() {
  const reduceMotion = usePrefersReducedMotion();
  const { paused, toggle } = useMotionPause();
  return (
    <footer className="hidden lg:block">
      <a href="https://guglielmogiannattasio.it" target="_blank" rel="noopener" className="hw-glass fixed bottom-6 left-7 z-10 inline-flex h-11 items-center rounded-full px-3 text-xs text-ink underline underline-offset-2 transition-colors duration-120 ease-standard hover:bg-raised">
        Sculpture component by guglielmogiannattasio.it
      </a>
      {/* Same rule as the landing page: no Pause button when the visitor already asked for reduced motion. */}
      {!reduceMotion && <span className="fixed bottom-6 right-[calc(50%+1.75rem)] z-10"><PauseButton glass paused={paused} onToggle={toggle} /></span>}
    </footer>
  );
}
