import { createLlmsTxtHandler, type PageEntry } from "@vendor/aeo";
import {
  getPublicPublications,
  type StaticPublication,
} from "~/lib/publishing";

export const revalidate = false;

const BASE_URL = "https://lightfast.ai";

function sectionFor(publication: StaticPublication): string {
  switch (publication.kind) {
    case "home":
      return "Marketing";
    case "brand":
      return "Company";
    case "blog-index":
    case "blog-post":
      return "Blog";
    case "legal":
      return "Legal";
  }
}

function descriptionFor(publication: StaticPublication): string {
  if ("answerSummary" in publication && publication.answerSummary) {
    return publication.answerSummary;
  }

  return publication.description;
}

function pageEntryFor(publication: StaticPublication): PageEntry {
  return {
    url: publication.canonicalUrl,
    title: publication.title,
    description: descriptionFor(publication),
    lastModified: publication.lastModified,
    section: sectionFor(publication),
    ...(publication.kind === "legal" ? { optional: true } : {}),
  };
}

const providers: Array<() => Promise<PageEntry[]>> = [
  () => {
    const entries: PageEntry[] = getPublicPublications().map(pageEntryFor);

    entries.push(
      {
        url: "https://github.com/lightfastai",
        title: "Lightfast on GitHub",
        description: "Official Lightfast GitHub organization.",
        section: "External Authority",
        optional: true,
      },
      {
        url: "https://www.npmjs.com/package/lightfast",
        title: "Lightfast SDK on npm",
        description: "The Lightfast TypeScript SDK package.",
        section: "External Authority",
        optional: true,
      },
      {
        url: "https://www.npmjs.com/package/@lightfastai/mcp",
        title: "Lightfast MCP server on npm",
        description: "The Lightfast MCP server package for AI agents.",
        section: "External Authority",
        optional: true,
      }
    );

    return Promise.resolve(entries);
  },
];

export const { GET } = createLlmsTxtHandler(
  providers,
  {
    title: "Lightfast",
    description:
      "Lightfast is a human-AI collaboration lab building new mediums for complex work: live, multiplayer systems where AI participates while work happens.",
    baseUrl: `${BASE_URL}`,
    sectionOrder: [
      "Marketing",
      "Company",
      "Blog",
      "Legal",
      "External Authority",
    ],
    defaultSection: "Marketing",
    footer: [
      "## Contact & Support",
      "",
      "- Email: hello@lightfast.ai",
      "- Founder: Jeevan Pillay — jp@lightfast.ai — https://twitter.com/jeevanpillay",
      "- Twitter: https://twitter.com/lightfastai",
      "- GitHub: https://github.com/lightfastai",
      "- npm SDK: https://www.npmjs.com/package/lightfast",
      "- npm MCP server: https://www.npmjs.com/package/@lightfastai/mcp",
    ],
  },
  { cacheControl: "public, max-age=86400, s-maxage=86400" },
  {
    skipUrl: [/\/search(\b|\/)/, /\/pitch-deck/],
    stripTitleSuffix: "Lightfast",
  }
);
