// The address of the main Hushwork site, for the "Open Hushwork" link. On docs.hushwork.in a link to "/" would stay on the docs, so this one is a full address.
// Same rule as app/layout.js: NEXT_PUBLIC_SITE_URL once the domain is set, Vercel's own address meanwhile, localhost when developing.
export function mainSiteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3100";
}
