import { createClient } from "@/lib/supabase/server";
import { buildExport } from "@/lib/export-data";

// "Download my data" (a plain link in Settings). Signed out: 401. Otherwise a JSON file of the person's own workflows, runs and schedules.
const json = (body, status, extra = {}) => Response.json(body, { status, headers: { "cache-control": "no-store", ...extra } });

export const GET = async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data?.user) return json({ error: "Sign in first." }, 401);
  const result = await buildExport(supabase, data.user);
  if (result.error) return json({ error: result.error }, 500);
  const day = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(result.data, null, 2), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="hushwork-export-${day}.json"`, "cache-control": "no-store" },
  });
};
