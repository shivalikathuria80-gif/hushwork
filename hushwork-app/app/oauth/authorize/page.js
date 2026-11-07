import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Btn, Logo } from "@/components/ui";
import { Icon } from "@/components/icons";
import { currentUser } from "@/lib/auth";
import { checkAuthorizeRequest } from "@/lib/plugin/oauth-server";
import { AUTHORIZE_FIELDS, backToClient, requestOrigin } from "@/lib/plugin/oauth";
import { decideConnection } from "@/lib/actions/oauth";

export const metadata = { title: "Connect a chatbot - Hushwork", robots: { index: false, follow: false } };

// The page a chatbot sends the person to when they press "Connect" (OAuth, lib/plugin/oauth.js). It checks the chatbot's request, makes sure
// the person is signed in (if not: /login, then straight back here), and asks once: Allow or Cancel (lib/actions/oauth.js). Nothing is
// connected until Allow is pressed. The chatbot's name is its own claim, so the address it returns to is shown next to it.
export default function AuthorizePage({ searchParams }) {
  return (
    <div className="relative min-h-dvh">
      <header className="absolute inset-x-0 top-0">
        <Logo href="/" className="absolute left-5 top-1 sm:left-8" />
      </header>
      <main id="main" className="mx-auto flex min-h-dvh w-full max-w-[460px] flex-col justify-center px-5 py-16">
        <Suspense fallback={<span aria-hidden="true" className="block h-72 w-full rounded-2xl bg-raised" />}>
          <Consent searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}

async function Consent({ searchParams }) {
  const query = await searchParams;
  const params = {};
  for (const field of AUTHORIZE_FIELDS) {
    const value = Array.isArray(query?.[field]) ? query[field][0] : query?.[field];
    if (typeof value === "string" && value) params[field] = value;
  }
  const origin = requestOrigin(await headers());
  const checked = await checkAuthorizeRequest(params, origin);
  if (checked.fatal) {
    return (
      <div role="alert" className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <h1 className="flex items-center gap-2 text-xl font-semibold"><Icon name="CircleAlert" className="text-error" />This link cannot connect</h1>
        <p className="mt-2 text-[15px] text-mute">{checked.fatal}</p>
      </div>
    );
  }
  if (checked.redirectError) redirect(backToClient(checked.redirectUri, { ...checked.redirectError, iss: origin }));

  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/oauth/authorize?${new URLSearchParams(params)}`)}`);

  const { client, redirectUri } = checked.value;
  const returnsTo = new URL(redirectUri).host;
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6">
      <h1 className="text-[length:clamp(1.5rem,2.2vw,1.875rem)] font-bold leading-[1.2] tracking-[-0.01em]">Connect {client.client_name} to Hushwork?</h1>
      <p className="mt-2 text-sm text-mute">Signed in as <span className="font-medium text-ink">{user.email}</span>. When you allow it, you go back to <span className="font-medium text-ink break-all">{returnsTo}</span>. If you did not just press Connect in a chatbot, press Cancel.</p>
      <p className="mt-4 text-[15px] font-medium">It will be able to:</p>
      <ul className="mt-2 space-y-2 text-[15px]">
        <li className="flex gap-2"><Icon name="Check" className="mt-1 shrink-0 text-accent" />See your agents, your runs and the Hushwork Agent&rsquo;s notes.</li>
        <li className="flex gap-2"><Icon name="Check" className="mt-1 shrink-0 text-accent" />Make agents and start runs.</li>
        <li className="flex gap-2"><Icon name="Check" className="mt-1 shrink-0 text-accent" />Approve or turn down a waiting step, after it has shown you exactly what the step will do.</li>
      </ul>
      <p className="mt-4 text-sm text-mute">Anything that sends or creates still waits for your yes. Disconnect it any time on Settings, under Chatbot plugin.</p>
      <form action={decideConnection} className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {Object.entries(params).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
        <Btn type="submit" name="decision" value="cancel" variant="secondary">Cancel</Btn>
        <Btn type="submit" name="decision" value="allow">Allow</Btn>
      </form>
    </div>
  );
}
