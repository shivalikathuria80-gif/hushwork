import Workspace from "./Workspace";
import { aiStatus } from "@/lib/ai-status";

// Tells the workspace whether AI planning is on (see lib/ai-status.js: only a yes/no and the daily limit come out, never
// the key). Put this inside <Suspense> (the page does), like every component that waits for a request.
export default async function AiWorkspace({ children, top, plugin }) {
  const ai = await aiStatus();
  return <Workspace ai={ai} top={top} plugin={plugin}>{children}</Workspace>;
}
