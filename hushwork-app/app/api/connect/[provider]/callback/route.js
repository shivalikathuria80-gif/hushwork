import { finishConnect } from "@/lib/connections/oauth-flow";

// "Connect <app>", step 2: the app sent the person back with a one-time code (see lib/connections/oauth-flow.js).
export const GET = async (request, { params }) => finishConnect((await params).provider, request);
