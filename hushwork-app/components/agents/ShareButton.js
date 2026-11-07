"use client";

import { useState } from "react";
import { Btn } from "../ui";

// "Share this agent": copies a link to this site. On a phone that can share, the phone's own share sheet opens instead.
// `path` is a link on this site ("/agents/followup" or "/agents/try?a=..."); the full address is made in the browser from its own origin.
export default function ShareButton({ path, title = "A Hushwork agent", label = "Share this agent", size = "md", variant = "secondary", className = "" }) {
  const [state, setState] = useState(""); // "" | "copied" | "failed"
  const [link, setLink] = useState("");

  async function share() {
    const url = `${window.location.origin}${path}`;
    try {
      if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setState("copied");
    } catch (problem) {
      if (problem?.name === "AbortError") return; // the person closed the share sheet
      setLink(url);
      setState("failed");
      return; // the link stays on screen so it can be copied by hand
    }
    setTimeout(() => setState(""), 2500);
  }

  return (
    <>
      <Btn variant={variant} size={size} icon={state === "copied" ? "Check" : "Share"} onClick={share} className={className}>{state === "copied" ? "Link copied" : label}</Btn>
      <span role="status" className="sr-only">{state === "copied" ? "Link copied" : state === "failed" ? "Could not copy the link" : ""}</span>
      {state === "failed" && <p className="mt-1 break-all text-xs text-mute">Could not copy. Copy this link: {link}</p>}
    </>
  );
}
