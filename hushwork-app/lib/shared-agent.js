// A shared agent is only a SENTENCE in a link (/agents/try?a=<sentence>). This file is the small part of lib/public-agents.js that the
// browser needs (the Agents box, the share page and the Share button), so they do not load the whole template list.

export const SHARE_MAX = 300;

// A shared sentence as safe plain text: a string, no control or direction-changing characters, no line breaks, spaces squeezed, at most
// SHARE_MAX characters. Anything else becomes "" (the share page then says the link is empty).
export function cleanShared(value) {
  if (typeof value !== "string") return "";
  const text = value.replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, " ").replace(/\s+/g, " ").trim();
  return text.length > SHARE_MAX ? `${text.slice(0, SHARE_MAX - 1).trimEnd()}…` : text;
}

// The share page's address for a sentence (relative, so the browser adds its own origin).
export const sharedPath = (sentence) => `/agents/try?a=${encodeURIComponent(cleanShared(sentence))}`;

// Sign up (or sign in) first, then land on the Agents page with the shared sentence in the box (lib/next-path.js allows exactly this).
export const sharedSignupHref = (sentence) => `/login?next=${encodeURIComponent(`/app/agents?try=${encodeURIComponent(cleanShared(sentence))}`)}#create`;
