import { ImageResponse } from "next/og";

// The picture shown when someone shares the link (Slack, WhatsApp, X, LinkedIn ...).
// Next.js draws it once at build time from the markup below.
export const alt = "Hushwork: describe the task, we run it quietly";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#121018", color: "#f7f6f9", padding: 80 }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: 10, background: "#7c3aed", color: "#fff", fontSize: 34, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>H</div>
          <div style={{ marginLeft: 18, fontSize: 36, fontWeight: 600 }}>Hushwork</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 92, fontWeight: 600, lineHeight: 1.05, letterSpacing: -2 }}>
          <div>Describe the task.</div>
          <div style={{ color: "#c3a5ff" }}>Hushwork handles it.</div>
        </div>
        <div style={{ fontSize: 32, color: "#a8a3b8" }}>Join the early access list</div>
      </div>
    ),
    { ...size }
  );
}
