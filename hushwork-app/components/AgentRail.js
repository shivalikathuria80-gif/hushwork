"use client";

import Link from "next/link";
import ClothingRailHero from "./ui/product-rail-gallery";
import { useMotionPause } from "./MotionProvider";

// "Pick an agent off the rail": ready-made agents as hang tags on a clothing rail (components/ui/product-rail-gallery.tsx, from 21st.dev).
// Brush along the rail, slide a tag, or click one to lift it and read the back (what it does, step by step). The tags turn to the front one
// by one until the visitor touches the rail; the page's Pause switch stops that, and the rail itself stands still with reduce motion on.
// `items` come from lib/agent-tags.js (built on the server, so the pictures are in the HTML).
export default function AgentRail({ items }) {
  const { paused } = useMotionPause();
  return (
    <section id="rail" aria-label="Ready-made agents" className="py-20">
      <ClothingRailHero
        items={items}
        hanger="matte"
        eyebrow="Ready-made agents"
        heading="Pick an agent off the rail."
        caption="Brush along the rail or click a tag to read the back. Every one sends nothing without your OK."
        autoplay={!paused}
        interval={2600}
        labels={{ front: "Front", back: "What it does", close: "Close", show: "Show" }}
        action={
          <Link href="/agents" className="inline-flex h-11 items-center rounded-full bg-accent px-5 text-sm font-semibold text-on-accent shadow-sm transition-[transform,background-color] duration-150 hover:-translate-y-px hover:bg-accent-hover">
            See all agents
          </Link>
        }
      />
    </section>
  );
}
