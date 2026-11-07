import { Btn } from "@/components/ui";
import PublicFrame from "@/components/agents/PublicFrame";
import AgentFolders from "@/components/agents/AgentFolders";
import { needsLine, publicAgentGroups } from "@/lib/public-agents";

const description = "Ready-made AI agents for freelancers and small teams: client follow-ups, deadline watch, invoice chasing, morning briefings and more. Each one asks before it sends anything.";

export const metadata = {
  title: "Ready-made AI agents | Hushwork",
  description,
  alternates: { canonical: "/agents" },
  openGraph: { title: "Ready-made AI agents | Hushwork", description, url: "/agents" },
};

// The public list of every ready-made agent (lib/templates.js), grouped by pack and shown as animated folders (components/agents/AgentFolders.js). Each card links to that agent's own page.
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
      <AgentFolders groups={groups.map((group) => ({ ...group, agents: group.agents.map((agent) => ({ ...agent, needsText: needsLine(agent.needs) })) }))} />
    </PublicFrame>
  );
}
