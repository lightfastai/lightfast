import { SITE_URL } from "~/lib/landing-content";

const searchDescription =
  "Search across Lightfast documentation, guides, and resources. Find what you need about the operating layer for agents and apps.";

export function buildSearchHead() {
  return {
    meta: [
      { title: "Search - Lightfast" },
      {
        name: "description",
        content: searchDescription,
      },
      { property: "og:title", content: "Search - Lightfast" },
      {
        property: "og:description",
        content: searchDescription,
      },
      { property: "og:url", content: `${SITE_URL}/search` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Search - Lightfast" },
      {
        name: "twitter:description",
        content:
          "Search across Lightfast documentation, guides, and resources.",
      },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/search` }],
  };
}
