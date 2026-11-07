import { mainSiteUrl } from "@/lib/docs/site";
import { DOC_PAGES } from "@/lib/docs/pages";
import { agentPath, publicAgentIds } from "@/lib/public-agents";

// sitemap.xml: the list of public pages, so search engines find them all (the docs pages are also at docs.hushwork.in).
export default function sitemap() {
  const site = mainSiteUrl();
  return [
    { url: site, priority: 1 },
    { url: `${site}/agents`, priority: 0.9 },
    ...publicAgentIds().map((id) => ({ url: `${site}${agentPath(id)}`, priority: 0.7 })),
    { url: `${site}/docs`, priority: 0.8 },
    ...DOC_PAGES.map((page) => ({ url: `${site}/docs/${page.slug}`, priority: 0.5 })),
    { url: `${site}/privacy`, priority: 0.3 },
    { url: `${site}/terms`, priority: 0.3 },
  ];
}
