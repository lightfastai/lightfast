import { createLlmsTxtHandler, type PageEntry } from "@vendor/aeo";
import { blog, changelog, legal } from "@vendor/cms";

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
  () =>
    blog.getPosts().then((posts) => {
      const entries: PageEntry[] = [
        {
          url: `${BASE_URL}/blog`,
          title: "Blog",
          description:
            "Insights, guides, and product updates from the Lightfast team.",
          section: "Blog",
        },
      ];
      for (const post of posts) {
        const slug = post.slug ?? post._slug;
        if (!slug) {
          continue;
        }
        entries.push({
          url: `${BASE_URL}/blog/${slug}`,
          title: post._title ?? slug,
          description: post.description ?? undefined,
          section: "Blog",
        });
      }
      return entries;
    }),

  // Changelog listing + entries
  () =>
    changelog.getEntries().then((entries) => {
      const pages: PageEntry[] = [
        {
          url: `${BASE_URL}/changelog`,
          title: "Changelog",
          description:
            "What's new in Lightfast — product updates and improvements.",
          section: "Changelog",
        },
      ];
      for (const entry of entries) {
        const slug = entry.slug ?? entry._slug;
        if (!slug) {
          continue;
        }
        pages.push({
          url: `${BASE_URL}/changelog/${slug}`,
          title: entry._title ?? slug,
          section: "Changelog",
        });
      }
      return pages;
    }),

  // Legal pages
  () =>
    legal.getPosts().then((pages) =>
      pages
        .filter((p) => !!p._slug)
        .map((p) => ({
          url: `${BASE_URL}/legal/${p._slug}`,
          title: p._title ?? p._slug!,
          description: p.description ?? undefined,
          section: "Legal",
          optional: true as const,
        }))
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
  }
);
