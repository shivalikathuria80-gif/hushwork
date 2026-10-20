import { startComposioConnect } from "@/lib/connections/composio-flow";

// "Connect <app>" for the apps reached through Composio. [app] is an id from lib/connectors/composio-apps.js (anything else is a 404).
export const GET = async (request, { params }) => startComposioConnect((await params).app, request);
