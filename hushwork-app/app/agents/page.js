import Link from "next/link";
import { Icon } from "@/components/icons";
import { Btn } from "@/components/ui";
import PublicFrame from "@/components/agents/PublicFrame";
import { agentPath, needsLine, publicAgentGroups } from "@/lib/public-agents";

const description = "Ready-made AI agents for freelancers and small teams: client follow-ups, deadline watch, invoice chasing, morning briefings and more. Each one asks before it sends anything.";

export const metadata = {
  title: "Ready-made AI agents | Hushwork",
  description,
  alternates: { canonical: "/agents" },
  openGraph: { title: "Ready-made AI agents | Hushwork", description, url: "/agents" },
};

// The public list of every ready-made agent (lib/templates.js), grouped by pack. Each card links to that agent's own page.
export default function AgentsLibrary() {
  const groups = publicAgentGroups();
  const count = groups.reduce((total, group) => total + group.agents.length, 0);
  return (
    <PublicFrame>
      <header className="max-w-[62ch]">
        <p className="text-sm font-medium text-accent-text">{count} ready-made agents</p>
        <h1 tabIndex={-1} className="mt-2 text-[length:clamp(2rem,4vw,3rem)] font-bold leading-[1.1] tracking-[-0.02em] outline-offset-4">AI agents for the jobs you keep putting off</h1>
        <p className="mt-4 text-[17px] text-mute">Each agent reads what it needs from your apps, writes the result, and waits for your Approve before it sends or creates anything. Pick one, connect the apps it names, and it runs on its own schedule.</p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Btn href="/login#create" icon="Bot">Start free</Btn>
          <Btn href="/docs" variant="secondary">How it works</Btn>
        </div>
      </header>
      {groups.map((group) => (
        <section key={group.id} aria-labelledby={`pack-${group.id}`} className="mt-14">
          <h2 id={`pack-${group.id}`} className="flex items-center gap-2 text-xl font-semibold tracking-tight"><Icon name={group.icon} size={20} className="text-accent-text" />{group.label}</h2>
          <p className="mt-1 text-[15px] text-mute">{group.blurb}</p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.agents.map((agent) => (
              <li key={agent.id}>
                <Link href={agentPath(agent.id)} className="flex h-full flex-col rounded-2xl border border-line bg-surface p-4 shadow-sm transition-[background-color,border-color] duration-120 ease-standard hover:border-line-strong active:bg-raised">
                  <span className="flex items-center gap-2 font-medium text-ink"><Icon name={agent.icon} size={18} fallback="Bot" className="shrink-0 text-accent-text" />{agent.title}</span>
                  <span className="mt-2 line-clamp-3 text-sm text-mute">{agent.body}</span>
                  <span className="mt-auto pt-3 text-xs text-mute">{needsLine(agent.needs)}{agent.schedule ? ` · ${agent.schedule.replace(/^Every /, "every ")}` : ""}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </PublicFrame>
  );
}
