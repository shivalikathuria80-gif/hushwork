import { startConnect } from "@/lib/connections/oauth-flow";

// "Connect <app>", step 1: the person pressed the button. [provider] is an app id from lib/connectors/app-list.js (anything else is a 404).
export const GET = async (request, { params }) => startConnect((await params).provider, request);
