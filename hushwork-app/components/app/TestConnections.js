"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { Btn } from "../ui";
import { Icon } from "../icons";
import { testConnections } from "@/lib/actions/connections-check";

// "Test all my connections". One press runs a real but harmless look at every connection (Google, Linear and each app connected through
// Composio) and lists, in plain words, which work and what is wrong with the ones that do not, including what the app itself said. Nothing is
// sent, written or changed anywhere. The Connect and Disconnect buttons stay where they are on this page.
const ICON = { ok: ["CircleCheck", "text-success"], problem: ["CircleAlert", "text-error"], off: ["Info", "text-mute"] };

function Row({ row, nested = false }) {
  const [icon, tone] = ICON[row.state] ?? ICON.off;
  return (
    <li className={nested ? "mt-1 pl-6" : "mt-2"}>
      <p className="flex items-start gap-2 text-[15px]">
        <Icon name={icon} size={16} className={`mt-1 shrink-0 ${tone}`} />
        <span className="min-w-0"><b className="font-medium">{row.name}</b>{" "}<span className="text-mute">{row.note}</span></span>
      </p>
      {row.actions?.length > 0 && <ul>{row.actions.map((action) => <Row key={action.name} row={action} nested />)}</ul>}
    </li>
  );
}

export default function TestConnections() {
  const [result, setResult] = useState(null);
  const [problem, setProblem] = useState("");
  const [pending, startTransition] = useTransition();

  function run() {
    setProblem("");
    startTransition(async () => {
      try {
        const answer = await testConnections();
        if (answer?.error) { setProblem(answer.error); setResult(null); } else setResult(answer);
      } catch (error) {
        unstable_rethrow(error);
        setProblem("Could not run the test. Check your connection and try again.");
      }
    });
  }

  const bad = result ? result.groups.flatMap((group) => group.rows.flatMap((row) => [row, ...(row.actions ?? [])])).filter((row) => row.state === "problem").length : 0;

  return (
    <section aria-labelledby="test-heading" className="mt-6 rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 id="test-heading" className="text-lg font-semibold tracking-tight">Test all my connections</h2>
          <p className="mt-1 max-w-[60ch] text-sm text-mute">Checks every connection for real and tells you what is wrong, so you do not have to find out one step at a time. It only looks: nothing is sent or changed.</p>
        </div>
        <Btn size="sm" icon="Zap" loading={pending} onClick={run}>{result ? "Test again" : "Test now"}</Btn>
      </div>
      {problem && <p role="alert" className="mt-3 flex items-start gap-2 text-sm"><Icon name="CircleAlert" className="mt-0.5 shrink-0 text-error" />{problem}</p>}
      {result && (
        <div role="status" className="mt-4">
          <p className="text-sm font-medium">{bad === 0 ? "Everything you connected works." : `${bad} ${bad === 1 ? "thing needs" : "things need"} attention.`}</p>
          {result.groups.map((group) => (
            <div key={group.title} className="mt-4">
              <h3 className="text-sm font-medium text-mute">{group.title}</h3>
              <ul>{group.rows.map((row) => <Row key={row.name} row={row} />)}</ul>
            </div>
          ))}
          {result.off.length > 0 && <p className="mt-4 text-sm text-mute"><b className="font-medium text-ink">Not connected or not available:</b> {result.off.join(", ")}.</p>}
        </div>
      )}
    </section>
  );
}
