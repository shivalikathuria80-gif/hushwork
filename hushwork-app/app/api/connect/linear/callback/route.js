import { finishConnect } from "@/lib/connections/oauth-flow";

// "Connect Linear", step 2: Linear sent the person back with a one-time code (see lib/connections/oauth-flow.js).
export const GET = (request) => finishConnect("linear", request);
