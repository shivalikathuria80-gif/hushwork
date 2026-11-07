import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icons";
import { Btn } from "@/components/ui";
import PublicFrame from "@/components/agents/PublicFrame";
import ShareButton from "@/components/agents/ShareButton";
import { agentPath, metaDescription, needsLine, publicAgent, publicAgentIds, templateSignupHref } from "@/lib/public-agents";

// Every ready-made agent gets its own page, built ahead of time. An unknown id is a plain 404.
export function generateStaticParams() {
  return publicAgentIds().map((id) => ({ id }));
}

export async function generateMetadata({ params }) {
  const agent = publicAgent((await params).id);
  if (!agent) return {};
  const title = `${agent.title}: a ready-made AI agent | Hushwork`;
  const description = metaDescription(agent.body);
  return { title, description, alternates: { canonical: agentPath(agent.id) }, openGraph: { title, description, url: agentPath(agent.id) } };
}

const KIND_ICON = { trigger: "Clock", ai: "Sparkles", action: "Send", issue: "ListTodo" };

export default async function PublicAgentPage({ params }) {
  const agent = publicAgent((await params).id);
  if (!agent) notFound();
  return (
    <PublicFrame>
      <Link href="/agents" className="inline-flex min-h-11 items-center gap-2 text-[15px] text-mute hover:text-ink"><Icon name="ArrowLeft" size={16} />All agents</Link>
      <article className="mt-4 grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
          <p className="text-sm font-medium text-accent-text">{agent.packLabel} agent</p>
          <h1 tabIndex={-1} className="mt-2 flex items-center gap-3 text-[length:clamp(2rem,4vw,2.75rem)] font-bold leading-[1.1] tracking-[-0.02em] outline-offset-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent text-on-accent"><Icon name={agent.icon} size={22} fallback="Bot" /></span>{agent.title}
          </h1>
          <p className="mt-5 max-w-[62ch] text-[17px] leading-relaxed text-mute">{agent.body}</p>
          {agent.request && (
            <figure className="mt-6 max-w-[62ch] rounded-2xl border border-line bg-raised p-4">
              <figcaption className="text-xs font-medium uppercase tracking-wide text-mute">In one sentence</figcaption>
              <blockquote className="mt-1 text-[15px] text-ink">“{agent.request}”</blockquote>
            </figure>
          )}
          <h2 className="mt-10 text-xl font-semibold tracking-tight">What it does, step by step</h2>
          <ol className="mt-4 grid gap-3">
            {agent.steps.map((step, index) => (
              <li key={index} className="flex gap-3 rounded-2xl border border-line bg-surface p-4 shadow-sm">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-subtle text-accent-text"><Icon name={KIND_ICON[step.kind] ?? "Zap"} size={18} /></span>
                <div className="min-w-0">
                  <p className="font-medium text-ink">{index + 1}. {step.title}</p>
                  {step.detail && <p className="mt-0.5 text-sm text-mute">{step.detail}</p>}
                  {step.approve && <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-medium text-accent-text"><Icon name="ShieldCheck" size={14} />Waits for your Approve</p>}
                </div>
              </li>
            ))}
          </ol>
        </div>
        <aside className="lg:pt-10">
          <div className="rounded-3xl border border-line bg-surface p-5 shadow-sm lg:sticky lg:top-24">
            <dl className="grid gap-3 text-sm">
              <div><dt className="text-mute">Apps</dt><dd className="mt-0.5 font-medium text-ink">{needsLine(agent.needs)}</dd></div>
              <div><dt className="text-mute">When</dt><dd className="mt-0.5 font-medium text-ink">{agent.schedule || "When you press Run"}</dd></div>
              <div><dt className="text-mute">Safety</dt><dd className="mt-0.5 font-medium text-ink">Reads on its own. Sends or creates nothing until you press Approve.</dd></div>
            </dl>
            <Btn href={templateSignupHref(agent.id)} icon="Bot" className="mt-5 w-full">Use this agent free</Btn>
            <ShareButton path={agentPath(agent.id)} title={agent.title} className="mt-2 w-full" />
            <p className="mt-3 text-xs text-mute">You can change every step before it runs.</p>
          </div>
        </aside>
      </article>
    </PublicFrame>
  );
}
