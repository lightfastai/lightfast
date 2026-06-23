import { createLlmsTxtHandler, type PageEntry } from "@vendor/aeo";
import { getBlogPages, getHomePage, getLegalPages } from "~/lib/content/source";

export const revalidate = false;

const BASE_URL = "https://lightfast.ai";

const providers: Array<() => Promise<PageEntry[]>> = [
  () => {
    const homePage = getHomePage();
    const blogPosts = getBlogPages();
    const mostRecentBlog = blogPosts
      .slice()
      .sort(
        (a, b) =>
          new Date(b.data.publishedAt).getTime() -
          new Date(a.data.publishedAt).getTime()
      )
      .at(0);
    const entries: PageEntry[] = [
      {
        url: `${BASE_URL}`,
        title: homePage?.data.title ?? "Lightfast",
        description:
          homePage?.data.answerSummary ??
          homePage?.data.description ??
          "Lightfast is a human-AI collaboration lab building new mediums for complex work.",
        lastModified:
          homePage?.data.reviewedAt ??
          homePage?.data.updatedAt ??
          mostRecentBlog?.data.reviewedAt ??
          mostRecentBlog?.data.updatedAt ??
          mostRecentBlog?.data.publishedAt,
        section: "Marketing",
      },
      {
        url: `${BASE_URL}/brand`,
        title: "Brand",
        description: "Official Lightfast brand resources and company details.",
        section: "Company",
      },
    ];

    for (const page of blogPosts) {
      entries.push({
        url: `${BASE_URL}/blog/${page.slugs[0]}`,
        title: page.data.title,
        description: page.data.answerSummary ?? page.data.description,
        lastModified: page.data.reviewedAt ?? page.data.updatedAt,
        section: "Blog",
      });
    }

    for (const page of getLegalPages()) {
      entries.push({
        url: `${BASE_URL}/legal/${page.slugs[0]}`,
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
