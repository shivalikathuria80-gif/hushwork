import { createClient } from "@/lib/supabase/server";
import { buildArrivalsExport } from "@/lib/hook-export";
import { exportName, toCsv } from "@/lib/hook-data";

// "Download arrivals" on the Start links page: ?link=<id> for one link (none: all of them), &format=csv (default) or json. Signed out: 401.
// Only what Hushwork still keeps is in it (the link's keep days decide), with the full words from each run.
const json = (body, status) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

export const GET = async (request) => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data?.user) return json({ error: "Sign in first." }, 401);
  const params = new URL(request.url).searchParams;
  const format = params.get("format") === "json" ? "json" : "csv";
  const result = await buildArrivalsExport(supabase, data.user, params.get("link") ?? "");
  if (result.error) return json({ error: result.error }, result.status);
  const day = new Date().toISOString().slice(0, 10);
  const body = format === "json" ? JSON.stringify({ exported_at: new Date().toISOString(), arrivals: result.rows }, null, 2) : toCsv(result.rows);
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": format === "json" ? "application/json; charset=utf-8" : "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportName(result.workflow, day, format)}"`,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
};
