import PublicFrame from "@/components/agents/PublicFrame";
import SharedAgent from "@/components/agents/SharedAgent";

// A shared agent (/agents/try?a=<sentence>). Anyone can write such a link, so this page is never indexed and the sentence is only shown
// as text; the page itself is static and the sentence is read in the browser (components/agents/SharedAgent.js).
export const metadata = {
  title: "An agent someone shared with you | Hushwork",
  description: "Someone shared a Hushwork agent with you. Read what it does, then make it in your own account. Nothing runs until you say so.",
  robots: { index: false, follow: true },
};

export default function SharedAgentPage() {
  return (
    <PublicFrame>
      <SharedAgent />
    </PublicFrame>
  );
}
