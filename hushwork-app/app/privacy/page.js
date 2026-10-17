import Link from "next/link";
import { Icon } from "@/components/icons";

export const metadata = {
  title: "Privacy | Hushwork",
  description: "What Hushwork stores when you join the waitlist or create an account, why, and how to have it removed.",
};

const h2 = "mt-10 text-xl font-semibold tracking-tight";
const p = "mt-2 max-w-[65ch] text-[15px] leading-relaxed text-mute";
const ul = "mt-2 max-w-[65ch] list-disc space-y-1 pl-5 text-[15px] leading-relaxed text-mute";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 pb-20 pt-12">
      <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-[15px]"><Icon name="ArrowLeft" size={16} />Back to Hushwork</Link>
      <h1 className="mt-6 text-[length:clamp(1.75rem,2.6vw,2.25rem)] font-bold leading-[1.15] tracking-[-0.01em]">Privacy</h1>
      <p className={p}>Last updated 15 October 2026.</p>

      <h2 className={h2}>What we store</h2>
      <ul className={ul}>
        <li><b className="font-medium text-ink">Waitlist.</b> When you join the waitlist we store your email address and the time you joined.</li>
        <li><b className="font-medium text-ink">Account.</b> If you create an account we store your email address, a one-way scrambled version of your password (never the password itself), and the times you created the account and last signed in. Our sign-in provider, Supabase, also keeps technical records of sign-ups, sign-ins, sign-outs and session renewals, including the time, your IP address and your browser details.</li>
        <li><b className="font-medium text-ink">Drafts.</b> For each draft you save we store its name, the task text you typed, the preview steps, and the times it was saved and changed. Do not type passwords, card numbers or other people{"’"}s personal details into a task.</li>
      </ul>

      <h2 className={h2}>Why</h2>
      <p className={p}>To tell you when early access opens, to sign you in, and to keep the drafts you choose to save.</p>

      <h2 className={h2}>Drafts do nothing</h2>
      <p className={p}>A draft is only a saved plan to read. It is never run, sent or shared, and it is not connected to your email, Stripe or any other app. Hushwork does not run workflows yet.</p>

      <h2 className={h2}>No AI</h2>
      <p className={p}>The preview plan is made by simple keyword matching in your browser. What you type goes to no AI service.</p>

      <h2 className={h2}>Where it lives</h2>
      <p className={p}>In a database and sign-in service run by Supabase, hosted in the Mumbai, India region. Supabase stores this data for us under its own terms.</p>

      <h2 className={h2}>Who sees it</h2>
      <ul className={ul}>
        <li>Your drafts are visible to you when you are signed in. Other accounts cannot read them: the database itself enforces this.</li>
        <li>The people who run Hushwork can technically see the database. We do not sell your email or share it with advertisers.</li>
      </ul>

      <h2 className={h2}>Cookies and your browser</h2>
      <ul className={ul}>
        <li>A sign-in cookie keeps you signed in. It exists only for that, and it is removed when you sign out.</li>
        <li>Your light or dark choice, and your pause-motion choice, are kept in your browser{"’"}s own storage. They never leave your device.</li>
        <li>This site has no analytics and no advertising trackers.</li>
        <li>Like any website, whoever serves it can see your IP address when your browser asks for a page.</li>
      </ul>

      <h2 className={h2}>Waitlist and accounts are separate</h2>
      <p className={p}>Joining the waitlist does not create an account, and creating an account does not add you to the waitlist.</p>

      <h2 className={h2}>Getting your data removed</h2>
      <p className={p}>
        Write to <a href="mailto:hello@hushwork.co">hello@hushwork.co</a> and we will delete your waitlist email, or your account and all its drafts together.
        There is no delete button in the app yet. We keep waitlist emails until early access opens or you ask us to remove them, and accounts and drafts until you ask or the account is deleted.
      </p>

      <hr className="mt-10 border-line" />
      <p className={p}>Questions about this page: <a href="mailto:hello@hushwork.co">hello@hushwork.co</a></p>
    </main>
  );
}
