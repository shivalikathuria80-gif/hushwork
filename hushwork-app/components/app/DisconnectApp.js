"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow, useRouter } from "next/navigation";
import { Btn } from "../ui";
import { disconnectApp } from "@/lib/actions/connections";
import { disconnectComposioApp } from "@/lib/actions/composio";

// The Disconnect button on the Connections page, for any app in lib/connectors/app-list.js, or (through="composio") an app in composio-apps.js. It asks first, because disconnecting
// means pressing Connect again later.
export default function DisconnectApp({ app, label, through }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function confirm() {
    setError("");
    startTransition(async () => {
      let result;
      try {
        result = await (through === "composio" ? disconnectComposioApp(app) : disconnectApp(app));
      } catch (problem) {
        unstable_rethrow(problem);
        result = { error: "Could not disconnect. Check your connection and try again." };
      }
      if (result.error) setError(result.error);
      else { setAsking(false); router.refresh(); }
    });
  }

  if (!asking) return <Btn size="sm" variant="secondary" onClick={() => setAsking(true)} aria-label={`Disconnect ${label}`}>Disconnect</Btn>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm">Disconnect {label}?</span>
      <Btn size="sm" variant="dark" loading={pending} onClick={confirm}>Yes, disconnect</Btn>
      <Btn size="sm" variant="secondary" disabled={pending} onClick={() => setAsking(false)}>Keep it</Btn>
      {error && <span role="alert" className="w-full text-sm text-error">{error}</span>}
    </div>
  );
}
