import { createLlmsTxtHandler, type PageEntry } from "@vendor/aeo";
import { getBlogPages, getLegalPages } from "~/lib/content/source";

export const revalidate = false;

const BASE_URL = "https://lightfast.ai";

const providers: Array<() => Promise<PageEntry[]>> = [
  () => {
    const entries: PageEntry[] = [
      {
        url: `${BASE_URL}/v2`,
        title: "Lightfast",
        description:
          "Lightfast is the operating layer between AI agents, apps, and teams responsible for real work.",
        section: "Marketing",
      },
      {
        url: `${BASE_URL}/v2/brand`,
        title: "Brand",
        description: "Official Lightfast brand resources and company details.",
        section: "Company",
      },
      {
        url: `${BASE_URL}/v2/blog`,
        title: "Blog",
        description:
          "Notes from Lightfast on agent infrastructure, workspace memory, and reliable AI operations.",
        section: "Blog",
      },
    ];

    for (const page of getBlogPages()) {
      entries.push({
        url: `${BASE_URL}/v2/blog/${page.slugs[0]}`,
        title: page.data.title,
        description: page.data.answerSummary ?? page.data.description,
        lastModified: page.data.reviewedAt ?? page.data.updatedAt,
        section: "Blog",
      });
    }

    for (const page of getLegalPages()) {
      entries.push({
        url: `${BASE_URL}/v2/legal/${page.slugs[0]}`,
        title: page.data.title,
        description: page.data.description,
        lastModified: page.data.reviewedAt ?? page.data.updatedAt,
        section: "Legal",
        optional: true,
      });
    }

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
      "Lightfast is the operating layer for AI agents and engineering teams. Agents and developers use Lightfast to observe events, build semantic memory, and act across their tool stack with source-cited context.",
    baseUrl: `${BASE_URL}/v2`,
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
