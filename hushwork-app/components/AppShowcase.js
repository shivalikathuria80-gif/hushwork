"use client";

import TumbleDeckShowcase from "./ui/tumble-deck-showcase";
import { Reveal } from "./ui";

// "Look inside": real screens of the signed-in app as a tumble deck (components/ui/tumble-deck-showcase.tsx, from 21st.dev). The front
// screen tips forward onto the floor and the next one stands behind it. Click it, drag it or use the arrow keys; once it has focus the
// mouse wheel flips it too (before that the wheel scrolls the page as usual). With reduce motion on it moves one whole card at a time.
// The pictures are in public/showcase, taken from the app with sample data.
const CARDS = [
  { src: "/showcase/home.jpg", alt: "The home page: describe a chore in one sentence, and the Hushwork Agent" },
  { src: "/showcase/week.jpg", alt: "Your week: the time Hushwork gave back, and a dot for each run, day by day" },
  { src: "/showcase/runs.jpg", alt: "Runs: what needs your OK first, and each step of a run" },
  { src: "/showcase/agents.jpg", alt: "Agents: tell an agent what to do and when" },
  { src: "/showcase/templates.jpg", alt: "Templates: ready-made workflows in packs" },
];

export default function AppShowcase() {
  return (
    <section id="inside" aria-labelledby="inside-heading" className="py-24">
      <div className="mx-auto max-w-6xl px-5">
        <Reveal>
          <h2 id="inside-heading" className="text-3xl font-semibold tracking-tight md:text-4xl">Look inside</h2>
          <p className="mt-3 max-w-xl text-[17px] text-mute">The real app, one screen at a time. Click the deck or drag it to flip to the next screen.</p>
        </Reveal>
      </div>
      <TumbleDeckShowcase
        cards={CARDS} aspect={1.6} height="clamp(420px, 72vh, 680px)" depth={4} scrollPerCard={260}
        background="transparent" ariaLabel="Screens from the Hushwork app" wheelNeedsFocus className="mt-6 cursor-pointer"
      />
    </section>
  );
}
