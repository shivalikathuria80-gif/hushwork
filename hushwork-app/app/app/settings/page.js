import { Suspense } from "react";
import Link from "next/link";
import ThemeToggle from "@/components/app/ThemeToggle";
import { requireUser } from "@/lib/auth";
import { aiStatus } from "@/lib/ai-status";

export const metadata = { title: "Settings - Hushwork", robots: { index: false, follow: false } };

// Settings. Nothing here can change an account (there is no password or email form yet); it shows what is true. The page
// shell is built ahead of time. The email and the AI status each need a real request, so each sits in its own <Suspense>.
export default function SettingsPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 lg:px-12 lg:py-16">
      <h1 tabIndex={-1} className="text-[length:clamp(1.75rem,2.6vw,2.25rem)] font-bold leading-[1.15] tracking-[-0.01em] outline-offset-4">Settings</h1>

      <section aria-labelledby="account-heading" className="mt-8">
        <h2 id="account-heading" className="text-xl font-semibold leading-[1.35] tracking-tight">Account</h2>
        <div className="mt-3 rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <p className="text-sm text-mute">Signed in as</p>
          <Suspense fallback={<span aria-hidden="true" className="mt-1 block h-6 w-56 rounded-md bg-raised" />}>
            <AccountEmail />
          </Suspense>
          <p className="mt-3 text-sm text-mute">
            To delete your account and its drafts, open an issue on <a href="https://github.com/shivalikathuria80-gif/hushwork/issues" className="underline">the project{"’"}s GitHub issues page</a> (do not put private details in it; we will reply there). There is no delete button in the app yet. Use Sign out in the sidebar to leave.
          </p>
        </div>
      </section>

      <section aria-labelledby="look-heading" className="mt-8">
        <h2 id="look-heading" className="text-xl font-semibold leading-[1.35] tracking-tight">Appearance</h2>
        <div className="mt-3 rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <p className="text-[15px]">Light or dark. The choice stays in this browser.</p>
          <ThemeToggle withLabel className="mt-2" />
        </div>
      </section>

      <section aria-labelledby="ai-heading" className="mt-8">
        <h2 id="ai-heading" className="text-xl font-semibold leading-[1.35] tracking-tight">AI planning</h2>
        <div className="mt-3 rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <Suspense fallback={<span aria-hidden="true" className="block h-12 w-full rounded-md bg-raised" />}>
            <AiStatus />
          </Suspense>
          <p className="mt-3 text-sm text-mute">What happens to your text is explained on the <Link href="/privacy">privacy page</Link>.</p>
        </div>
      </section>
    </main>
  );
}

async function AccountEmail() {
  const user = await requireUser(); // a signed-out visitor is redirected
  return <p className="mt-1 break-words text-[15px] font-medium">{user.email}</p>;
}

// Only a yes/no and the daily limit are used here (lib/ai-status.js). The key itself is never shown or passed on.
async function AiStatus() {
  const { enabled, limit } = await aiStatus();
  return enabled ? (
    <p className="text-[15px]"><strong className="font-medium">AI planning is on.</strong> When you preview a plan with &ldquo;Write with AI&rdquo; switched on, your task text is sent to Groq to write the plan. You get up to {limit} AI plans a day. Switch it off in the workspace box at any time.</p>
  ) : (
    <p className="text-[15px]"><strong className="font-medium">AI planning is off.</strong> Plans are matched on keywords in this browser, and your text is not sent to an AI service.</p>
  );
}
