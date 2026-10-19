import { startConnect } from "@/lib/connections/oauth-flow";

// "Connect Linear", step 1: the person pressed the button (see lib/connections/oauth-flow.js).
export const GET = (request) => startConnect("linear", request);
