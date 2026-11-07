import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { makeLimiter } from "@/lib/ai/limits";
import { checkAuthorize, issueCode, registerClient, exchangeToken } from "./oauth";

// The OAuth steps that need the all-access database client (lib/plugin/oauth.js has the logic; supabase/oauth.sql the tables). Clients and
// codes are nobody's own rows, so only the server reads them; every grant it writes names the person who pressed Allow.
// Returns null wherever the server is not set up (no all-access key), and the caller says so.

// Registrations and token swaps per visitor, in memory per server: they only stop a runaway loop or a flood of fake chatbots.
const limits = () => (globalThis.__hushworkOauthLimits ??= {
  register: makeLimiter({ max: 20, windowMs: 3_600_000 }),
  registerAll: makeLimiter({ max: 1000, windowMs: 86_400_000, calendar: true }),
  token: makeLimiter({ max: 60, windowMs: 60_000 }),
});

export function allowRegister(visitor, now = Date.now()) {
  const limit = limits();
  if (limit.register.left(visitor, now) < 1 || limit.registerAll.left("everyone", now) < 1) return false;
  limit.register.take(visitor, now);
  limit.registerAll.take("everyone", now);
  return true;
}
export const allowTokenCall = (visitor, now = Date.now()) => limits().token.take(visitor, now);

export async function register(body) {
  const admin = createAdminClient();
  return admin ? registerClient(admin, body) : null;
}

export async function token(form, credentials, origin) {
  const admin = createAdminClient();
  return admin ? exchangeToken(admin, form, credentials, origin) : null;
}

export async function checkAuthorizeRequest(params, origin) {
  const admin = createAdminClient();
  return admin ? checkAuthorize(admin, params, origin) : { fatal: "This Hushwork server is not set up for chatbots yet (its all-access database key is missing, see docs/deploy.md)." };
}

export async function makeCode(input) {
  const admin = createAdminClient();
  return admin ? issueCode(admin, input) : null;
}

