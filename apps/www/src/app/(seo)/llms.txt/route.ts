import { createLlmsTxtHandler, type PageEntry } from "@vendor/aeo";
import {
  getBlogPages,
  getChangelogPages,
  getLegalPages,
} from "~/app/(app)/(content)/_lib/source";

export const revalidate = false;

const BASE_URL = "https://lightfast.ai";

const providers: Array<() => Promise<PageEntry[]>> = [
  // Home page override — richer title/description than what extractMeta gets from HTML
  () =>
    Promise.resolve([
      {
        url: BASE_URL,
        title: "The Operating Layer for Agents and Apps",
        description:
          "Lightfast is the operating layer between your agents and apps. Observe what's happening across your tools, remember what happened, and give agents and people a single system to reason and act through.",
        section: "Marketing",
      },
    ]),

  // Blog listing + posts
  () => {
    const pages = getBlogPages();
    const entries: PageEntry[] = [
      {
        url: `${BASE_URL}/blog`,
        title: "Blog",
        description:
          "Insights, guides, and product updates from the Lightfast team.",
        section: "Blog",
      },
    ];
    for (const page of pages) {
      entries.push({
        url: `${BASE_URL}/blog/${page.slugs[0]}`,
        title: page.data.title,
        description: page.data.description,
        section: "Blog",
      });
    }
    return Promise.resolve(entries);
  },

  // Changelog listing + entries
  () => {
    const pages = getChangelogPages();
    const entries: PageEntry[] = [
      {
        url: `${BASE_URL}/changelog`,
        title: "Changelog",
        description:
          "What's new in Lightfast — product updates and improvements.",
        section: "Changelog",
      },
    ];
    for (const page of pages) {
      entries.push({
        url: `${BASE_URL}/changelog/${page.slugs[0]}`,
        title: page.data.title,
        section: "Changelog",
      });
    }
    return Promise.resolve(entries);
  },

  // Legal pages
  () =>
    Promise.resolve(
      getLegalPages().map((page) => ({
        url: `${BASE_URL}/legal/${page.slugs[0]}`,
        title: page.data.title,
        description: page.data.description,
        section: "Legal",
        optional: true as const,
      })),
    ),
];

export const { GET } = createLlmsTxtHandler(
  providers,
  {
    title: "Lightfast",
    description:
      "The operating layer for AI agents and engineering teams. Agents and developers use Lightfast to observe events, build semantic memory, and act across their entire tool stack — giving AI systems persistent, source-cited knowledge of everything that happens across code, deployments, incidents, and decisions.",
    baseUrl: BASE_URL,
    sectionOrder: [
      "Marketing",
      "Use Cases",
      "Docs",
      "API Reference",
      "Blog",
      "Changelog",
      "Legal",
    ],
    sectionResolver: (url) => {
      if (url === BASE_URL || /\/(pricing)($|\/)/.test(url)) {
        return "Marketing";
      }
      if (url.includes("/use-cases/")) {
        return "Use Cases";
      }
      if (url.includes("/docs/api-reference")) {
        return "API Reference";
      }
      if (url.includes("/docs")) {
        return "Docs";
      }
      return undefined; // fall through to defaultSection
    },
    defaultSection: "Marketing",
    footer: [
      "## Contact & Support",
      "",
      "- Email: hello@lightfast.ai",
      "- Founder: Jeevan Pillay — jp@lightfast.ai — https://twitter.com/jeevanpillay",
      "- Support: support@lightfast.ai",
      "- Twitter: https://twitter.com/lightfastai",
      "- Discord: https://discord.gg/YqPDfcar2C",
      "- GitHub (org): https://github.com/lightfastai",
      "- GitHub (SDK + MCP): https://github.com/lightfastai/lightfast",
      "- npm (SDK): https://www.npmjs.com/package/lightfast",
      "- npm (MCP server): https://www.npmjs.com/package/@lightfastai/mcp",
    ],
  },
  { cacheControl: "public, max-age=86400, s-maxage=86400" },
  {
    skipUrl: [/\/search(\b|\/)/, /\/pitch-deck/],
    stripTitleSuffix: "Lightfast",
  },
);
