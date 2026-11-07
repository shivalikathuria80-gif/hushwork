// The chatbot plugin's address (the MCP endpoint), the same for everyone. Plain module so both server and client code can import it.
export const PLUGIN_ADDRESS = `${(process.env.NEXT_PUBLIC_SITE_URL || "https://hushwork.in").replace(/\/$/, "")}/api/mcp`;
