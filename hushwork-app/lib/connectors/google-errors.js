// When Google answers 401 or 403 there are two very different reasons, and the person needs to know which one:
//   "apiOff"  the API (Gmail, Drive...) is switched off in the owner's Google Cloud project   (Google's reason: SERVICE_DISABLED / accessNotConfigured)
//   "scope"   the person did not give Hushwork that permission when they pressed Allow          (ACCESS_TOKEN_SCOPE_INSUFFICIENT / insufficientPermissions)
//   "other"   anything else (an old connection, a revoked permission...)
// Only these known words are looked for in Google's answer; none of Google's own text is ever shown, saved or logged, so nothing
// that could hold a token can leak. Never throws.
export async function refusalKind(response) {
  try {
    const text = JSON.stringify(await response.json());
    if (/SERVICE_DISABLED|accessNotConfigured/.test(text)) return "apiOff";
    if (/ACCESS_TOKEN_SCOPE_INSUFFICIENT|insufficientPermissions/.test(text)) return "scope";
  } catch {
    // an answer that is not JSON is just "other"
  }
  return "other";
}
