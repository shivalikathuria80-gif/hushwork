import { mainSiteUrl } from "@/lib/docs/site";

// robots.txt: tells search engines what they may read. The public pages are open; the signed-in app and the server routes are not.
export default function robots() {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/app", "/api", "/login"] },
    sitemap: `${mainSiteUrl()}/sitemap.xml`,
  };
}
