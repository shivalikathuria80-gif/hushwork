import Link from "next/link";
import { Icon } from "@/components/icons";

export const metadata = {
  title: "Terms | Hushwork",
  description: "The simple rules for using Hushwork: you stay in charge of what your workflows do, it is provided as it is, and what we may do if it is misused.",
};

const h2 = "mt-10 text-xl font-semibold tracking-tight";
const p = "mt-2 max-w-[65ch] text-[15px] leading-relaxed text-mute";
const ul = "mt-2 max-w-[65ch] list-disc space-y-1 pl-5 text-[15px] leading-relaxed text-mute";

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 pb-20 pt-12">
      <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-[15px]"><Icon name="ArrowLeft" size={16} />Back to Hushwork</Link>
      <h1 className="mt-6 text-[length:clamp(1.75rem,2.6vw,2.25rem)] font-bold leading-[1.15] tracking-[-0.01em]">Terms</h1>
      <p className={p}>Last updated 23 October 2026. These are plain-words rules, not legal advice. By creating an account or using Hushwork you agree to them.</p>

      <h2 className={h2}>What Hushwork is</h2>
      <p className={p}>Hushwork is a free, open-source project run by one person. It helps you build workflows and run them on your approval. It may change, break or go away at any time, and it comes with no promise that it will always be available or free.</p>

      <h2 className={h2}>You stay in charge</h2>
      <ul className={ul}>
        <li>Hushwork does nothing that changes something (sending an email, a Slack message, creating a task or an issue, adding a row) until you press Approve, or until you switch on Auto mode or tick {"“"}Let it write by itself{"”"} on a schedule. After that, what it does is on you.</li>
        <li>Read what an approval card says before you press Approve. Check the address, the words and the account.</li>
        <li>You are responsible for what you send and for having the right to send it. Do not use Hushwork to spam, harass, deceive or break the law.</li>
        <li>Keep your sign-in private. Do not put passwords, card numbers or secret keys in a workflow.</li>
      </ul>

      <h2 className={h2}>Other services</h2>
      <p className={p}>Hushwork reaches Google, Linear, Slack, GitHub and other apps with the permission you give them. Their own terms apply to what you do in them, and you can take the permission back at any time on their site or with Disconnect on the Connections page. AI writing and summaries are done by Groq. The <Link href="/privacy" className="underline">privacy page</Link> says what is sent.</p>

      <h2 className={h2}>Limits and misuse</h2>
      <p className={p}>There are daily limits on AI use and on lookups and actions, to keep the service usable for everyone. We may stop or remove an account that goes around the limits, attacks the service, or is used to harm other people. You can delete your own account at any time in Settings.</p>

      <h2 className={h2}>No warranty, and limits on responsibility</h2>
      <p className={p}>Hushwork is provided {"“"}as it is{"”"}, without any warranty. AI answers can be wrong: check them before you rely on them. To the most that the law allows, the author is not responsible for losses that come from using Hushwork, including a workflow that did something you did not mean to approve.</p>

      <h2 className={h2}>The code</h2>
      <p className={p}>The code is open source under the MIT license: <a href="https://github.com/shivalikathuria80-gif/hushwork" className="underline">github.com/shivalikathuria80-gif/hushwork</a>. These terms are about using the running service at this address, not about using the code.</p>

      <h2 className={h2}>Changes</h2>
      <p className={p}>If these terms change, the date above changes. Using Hushwork after that means you accept the new version.</p>

      <hr className="mt-10 border-line" />
      <p className={p}>Questions about this page: open an issue on <a href="https://github.com/shivalikathuria80-gif/hushwork/issues" className="underline">the project{"’"}s GitHub issues page</a>.</p>
    </main>
  );
}
