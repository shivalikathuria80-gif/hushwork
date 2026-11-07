"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow, useRouter } from "next/navigation";
import { Btn } from "../ui";
import { Icon } from "../icons";
import { disconnectChatbot } from "@/lib/actions/tokens";

// Settings > Chatbot plugin: the chatbots connected with their own Connect button (OAuth). Disconnect ends that chatbot's access at once.
const day = (value) => (value ? new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "never");

export default function PluginConnections({ connections }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [pending, startTransition] = useTransition();

  function remove(id) {
    setError("");
    setBusyId(id);
    startTransition(async () => {
      let result;
      try {
        result = await disconnectChatbot({ id });
      } catch (problem) {
        unstable_rethrow(problem);
        result = { error: "Could not reach Hushwork. Check your connection and try again." };
      }
      setBusyId("");
      if (result.error) return setError(result.error);
      router.refresh();
    });
  }

  if (connections.length === 0) return <p className="text-sm text-mute">No chatbots connected yet. In Claude, add Hushwork as a connector and press Connect.</p>;
  return (
    <div>
      <ul className="space-y-2">
        {connections.map((one) => (
          <li key={one.id} className="flex items-start gap-3 rounded-xl border border-line bg-raised px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="break-words text-[15px] font-medium">{one.name}</p>
              <p className="text-sm text-mute">connected {day(one.createdAt)} · last used {day(one.lastUsedAt)}</p>
            </div>
            <Btn size="sm" variant="ghost" icon="Trash" loading={busyId === one.id} disabled={pending} onClick={() => remove(one.id)} aria-label={`Disconnect ${one.name}`}>Disconnect</Btn>
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="mt-2 flex items-start gap-2 text-sm"><Icon name="CircleAlert" className="mt-0.5 shrink-0 text-error" />{error}</p>}
    </div>
  );
}
