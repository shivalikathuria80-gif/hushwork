import { Suspense } from "react";
import Link from "next/link";
import ThemeToggle from "@/components/app/ThemeToggle";
import { requireUser } from "@/lib/auth";
import { aiStatus } from "@/lib/ai-status";
import DeleteAccount from "@/components/app/DeleteAccount";
import MemorySettings from "@/components/app/MemorySettings";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Settings - Hushwork", robots: { index: false, follow: false } };

// Settings. It shows what is true and has the one irreversible button, Delete my account (it asks first and makes the person type the words). The page
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
          <div className="mt-4 border-t border-line pt-4">
            <p className="text-sm text-mute">Keep a copy of your workflows, your newest runs and your schedules as one file. Saved app connections are never in it.</p>
            <a href="/api/export" download className="mt-2 inline-flex min-h-11 items-center rounded-xl border border-field bg-surface px-4 text-sm font-medium shadow-sm hover:bg-raised">Download my data</a>
          </div>
          <div className="mt-4 border-t border-line pt-4"><DeleteAccount /></div>
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

      <section aria-labelledby="memory-heading" className="mt-8">
        <h2 id="memory-heading" className="text-xl font-semibold leading-[1.35] tracking-tight">Memory</h2>
        <div className="mt-3 rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <p className="mb-3 text-sm text-mute">Short facts the AI may use as background when it plans or answers (your timezone, who gets the reports). They are only facts: the AI is told to ignore any instructions written in them. Do not save passwords, keys or card numbers. Saved facts are sent to Groq with your AI requests.</p>
          <Suspense fallback={<span aria-hidden="true" className="block h-12 w-full rounded-md bg-raised" />}>
            <Memory />
          </Suspense>
        </div>
      </section>
    </main>
  );
}

async function Memory() {
  const user = await requireUser();
  const { data, error } = await (await createClient()).from("workflow_memories").select("id, key, value").eq("user_id", user.id).order("created_at", { ascending: true }).limit(50);
  if (error) {
    const missing = error.code === "42P01" || error.code === "PGRST205";
    if (!missing) console.error("Loading memory failed:", error.code);
    return <p className="text-[15px]">{missing ? "Memory needs one setup step: paste supabase/memory.sql into the Supabase SQL Editor and press Run." : "Could not load your saved facts. Try again in a minute."}</p>;
  }
  return <MemorySettings facts={data.map((row) => ({ id: String(row.id), key: String(row.key), value: String(row.value) }))} />;
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
