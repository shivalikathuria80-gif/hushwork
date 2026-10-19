import { finishConnect } from "@/lib/connections/oauth-flow";

// "Connect Google", step 2: Google sent the person back with a one-time code (see lib/connections/oauth-flow.js).
export const GET = (request) => finishConnect("google", request);
