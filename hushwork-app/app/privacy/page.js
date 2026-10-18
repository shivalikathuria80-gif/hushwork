import Link from "next/link";
import { Icon } from "@/components/icons";

export const metadata = {
  title: "Privacy | Hushwork",
  description: "What Hushwork stores when you join the waitlist or create an account, what is sent to an AI service if you use AI plans, and how to have your data removed.",
};

const h2 = "mt-10 text-xl font-semibold tracking-tight";
const p = "mt-2 max-w-[65ch] text-[15px] leading-relaxed text-mute";
const ul = "mt-2 max-w-[65ch] list-disc space-y-1 pl-5 text-[15px] leading-relaxed text-mute";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 pb-20 pt-12">
      <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-[15px]"><Icon name="ArrowLeft" size={16} />Back to Hushwork</Link>
      <h1 className="mt-6 text-[length:clamp(1.75rem,2.6vw,2.25rem)] font-bold leading-[1.15] tracking-[-0.01em]">Privacy</h1>
      <p className={p}>Last updated 18 October 2026.</p>

      <h2 className={h2}>What we store</h2>
      <ul className={ul}>
        <li><b className="font-medium text-ink">Waitlist.</b> When you join the waitlist we store your email address and the time you joined.</li>
        <li><b className="font-medium text-ink">Account.</b> If you create an account we store your email address, a one-way scrambled version of your password (never the password itself), and the times you created the account and last signed in. Our sign-in provider, Supabase, also keeps technical records of sign-ups, sign-ins, sign-outs and session renewals, including the time, your IP address and your browser details.</li>
        <li><b className="font-medium text-ink">Drafts.</b> For each draft you save we store its name, the task text you typed, the preview steps, and the times it was saved and changed. Do not type passwords, card numbers or other people{"’"}s personal details into a task.</li>
        <li><b className="font-medium text-ink">AI plan counts.</b> When AI plans are on, our server keeps a running count of how many AI plans each account has asked for, so that a daily limit can be applied. The count is held in the server{"’"}s memory only. It is not saved in the database and starts again when the server restarts.</li>
      </ul>

      <h2 className={h2}>Why</h2>
      <p className={p}>To tell you when early access opens, to sign you in, to keep the drafts you choose to save, and, when you ask for one, to have an AI write a preview plan.</p>

      <h2 className={h2}>Drafts do nothing</h2>
      <p className={p}>A draft is only a saved plan to read. It is never run, sent or shared, and it is not connected to your email, Stripe or any other app. Hushwork does not run workflows yet.</p>

      <h2 className={h2}>AI plans</h2>
      <ul className={ul}>
        <li>AI planning is optional. It is off unless the person who runs Hushwork has switched it on, and the note under the task box always says which it is. When it is off, or when you turn the <b className="font-medium text-ink">Write with AI</b> switch off, the plan is made by simple keyword matching in your browser and your task text goes to no AI service. Your task text and the steps of the plan reach our server only when you press Save as draft or Save as new draft, and the steps you change in a draft you already saved reach it when you press Save changes.</li>
        <li>When AI planning is on and you press the arrow, only the task text you typed is sent, through our server, to Groq, a company that runs AI models. Groq runs an AI model (currently <span className="font-mono text-ink">openai/gpt-oss-20b</span>, an open-weight model from OpenAI) to write the plan. Your email address, name, account id and other drafts are not sent. Our server also refuses to send text that looks like a card number or a secret key.</li>
        <li>Groq says it does not keep inference requests by default. It may log inputs and outputs for up to 30 days, only to fix errors or investigate abuse, and it keeps any data it retains in the United States (<a href="https://console.groq.com/docs/your-data" rel="noopener">Groq{"’"}s data page</a>, read 17 October 2026).</li>
        <li>Groq{"’"}s Services Agreement says Groq may not use inputs or outputs to train or fine-tune models unless the customer allows it, and we do not allow it (<a href="https://console.groq.com/docs/legal/services-agreement" rel="noopener">Services Agreement</a>, modified 22 June 2026). Groq handles your text under its own terms.</li>
        <li>An AI can get things wrong. A plan is shown as text for you to read; it is never run, sent or connected to anything. Do not type passwords, card numbers or other people{"’"}s personal details into a task.</li>
      </ul>

      <h2 className={h2}>Where it lives</h2>
      <p className={p}>Your account and drafts live in a database and sign-in service run by Supabase, hosted in the Mumbai, India region. Supabase stores this data for us under its own terms. When AI plans are on, the task text of each AI plan goes to Groq, which says any data it retains is stored in the United States.</p>

      <h2 className={h2}>Who sees it</h2>
      <ul className={ul}>
        <li>Your drafts are visible to you when you are signed in. Other accounts cannot read them: the database itself enforces this.</li>
        <li>The people who run Hushwork can technically see the database. We do not sell your email or share it with advertisers.</li>
        <li>When AI plans are on, Groq receives the task text of every AI plan you ask for, and handles it under its own terms.</li>
      </ul>

      <h2 className={h2}>Cookies and your browser</h2>
      <ul className={ul}>
        <li>A sign-in cookie keeps you signed in. It exists only for that, and it is removed when you sign out.</li>
        <li>Your light or dark choice, your pause-motion choice and the position of the Write with AI switch are kept in your browser{"’"}s own storage. They never leave your device.</li>
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
