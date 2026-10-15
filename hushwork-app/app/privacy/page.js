import Link from "next/link";
import { Icon } from "@/components/icons";

export const metadata = {
  title: "Privacy | Hushwork",
  description: "What Hushwork stores when you join the waitlist, why, and how to have it removed.",
};

const h2 = "mt-10 text-xl font-semibold tracking-tight";
const p = "mt-2 max-w-[65ch] leading-relaxed text-mute";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 pb-20 pt-12">
      <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-[15px]"><Icon name="ArrowLeft" size={16} />Back to Hushwork</Link>
      <h1 className="mt-6 text-[length:clamp(2rem,5vw,2.5rem)] font-semibold leading-[1.1] tracking-tight">Privacy</h1>
      <p className={p}>Last updated 14 October 2026.</p>

      <h2 className={h2}>What we store</h2>
      <p className={p}>When you join the waitlist we store your email address and the time you joined. Nothing else.</p>

      <h2 className={h2}>Why</h2>
      <p className={p}>To tell you when early access opens, and to see how many people are interested.</p>

      <h2 className={h2}>Where it lives</h2>
      <p className={p}>In a database run by Supabase, our database provider. They process it for us and do not use it for anything else.</p>

      <h2 className={h2}>Who sees it</h2>
      <p className={p}>Only the Hushwork team. We do not sell your email or share it with advertisers.</p>

      <h2 className={h2}>What this site does not do</h2>
      <ul className="mt-2 max-w-[65ch] list-disc space-y-1 pl-5 leading-relaxed text-mute">
        <li>It has no analytics and no advertising trackers.</li>
        <li>It remembers your light or dark choice, and your pause-motion choice, in your own browser. That never leaves your device.</li>
        <li>Like any website, it is delivered by a hosting provider, which can see your IP address when your browser asks for a page.</li>
      </ul>

      <h2 className={h2}>Getting your email removed</h2>
      <p className={p}>Write to <a href="mailto:hello@hushwork.co">hello@hushwork.co</a> and we will delete it. We keep it until early access opens or you ask us to remove it, whichever comes first.</p>

      <hr className="mt-10 border-line" />
      <p className={p}>Questions about this page: <a href="mailto:hello@hushwork.co">hello@hushwork.co</a></p>
    </main>
  );
}
