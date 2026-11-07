import ChatbotPlugin from "../ChatbotPlugin";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// The chatbot plugin box on the app's home page, with how many chatbots this person connected (Settings manages them).
// If the count cannot be read (oauth.sql not run yet, or the database does not answer) the box still shows, without the count.
export default async function ChatbotCard() {
  const user = await requireUser();
  let connected = null;
  try {
    const { count, error } = await (await createClient()).from("oauth_grants").select("id", { count: "exact", head: true }).eq("user_id", user.id);
    if (!error) connected = count ?? 0;
  } catch {
    connected = null;
  }
  return <ChatbotPlugin place="app" connected={connected} />;
}
