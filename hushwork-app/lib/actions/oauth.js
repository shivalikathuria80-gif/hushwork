"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { requireUser } from "@/lib/auth";
import { checkAuthorizeRequest, makeCode } from "@/lib/plugin/oauth-server";
import { AUTHORIZE_FIELDS, backToClient, requestOrigin } from "@/lib/plugin/oauth";

// The Allow / Cancel buttons on /oauth/authorize. The form carries the chatbot's request again, so everything is checked again here: a Server
// Action is a public door. Allow makes a one-time code for the signed-in person and sends them back to the chatbot; Cancel sends them back
// with access_denied. A request whose chatbot or return address is wrong never redirects anywhere (that would let anyone bounce people
// to any site): it goes back to the Allow page, which shows the problem.

export async function decideConnection(formData) {
  if (!(formData instanceof FormData)) redirect("/app");
  const user = await requireUser();
  const params = {};
  for (const field of AUTHORIZE_FIELDS) {
    const value = formData.get(field);
    if (typeof value === "string" && value) params[field] = value;
  }
  const origin = requestOrigin(await headers());
  const checked = await checkAuthorizeRequest(params, origin);
  if (checked.fatal) redirect(`/oauth/authorize?${new URLSearchParams(params)}`);
  if (checked.redirectError) redirect(backToClient(checked.redirectUri, { ...checked.redirectError, iss: origin }));
  const { client, redirectUri, codeChallenge, state } = checked.value;

  if (formData.get("decision") !== "allow") redirect(backToClient(redirectUri, { error: "access_denied", error_description: "You chose not to connect.", state, iss: origin }));
  const code = await makeCode({ userId: user.id, clientId: client.client_id, redirectUri, codeChallenge });
  if (!code) redirect(backToClient(redirectUri, { error: "server_error", error_description: "Hushwork could not finish connecting. Try again.", state, iss: origin }));
  redirect(backToClient(redirectUri, { code, state, iss: origin }));
}
