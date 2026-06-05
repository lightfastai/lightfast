import { type PageEntry, toLlmsTxt } from "@vendor/aeo";
import { getBlogCategories, getBlogPages } from "~/lib/blog-content";
import { getChangelogPages } from "~/lib/changelog-content";
import { getDocsPages } from "~/lib/docs-content";
import { SITE_URL } from "~/lib/landing-content";
import { getLegalPages } from "~/lib/legal-content";
import { getUseCasePages } from "~/lib/use-cases-content";

type ChangeFrequency =
  | "always"
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "never";

export interface SitemapEntry {
  changeFrequency: ChangeFrequency;
  lastModified?: Date;
  priority: number;
  url: string;
}

export type DeploymentEnv = "development" | "preview" | "production";

function getCategoryPriority(category: string): number {
  switch (category) {
    case "research":
      return 0.95;
    case "tutorial":
      return 0.9;
    case "engineering":
    case "product":
      return 0.85;
    case "company":
      return 0.7;
    default:
      return 0.8;
  }
}

function sortByPublishedAt<
  T extends { data: { publishedAt: string; updatedAt?: string } },
>(pages: T[]): T[] {
  return [...pages].sort(
    (a, b) =>
      new Date(b.data.publishedAt).getTime() -
      new Date(a.data.publishedAt).getTime()
  );
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toLastModified(value: string | undefined) {
  return value ? new Date(value) : undefined;
}

function readDeploymentEnv() {
  if (typeof process === "undefined") {
    return;
  }

  return process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV;
}

export function getDeploymentEnv(): DeploymentEnv {
  const value = readDeploymentEnv();

  if (
    value === "production" ||
    value === "preview" ||
    value === "development"
  ) {
    return value;
  }

  return "development";
}

export function getSitemapEntries(): SitemapEntry[] {
  const blogPosts = sortByPublishedAt(getBlogPages());
  const changelogEntries = sortByPublishedAt(getChangelogPages());
  const docsPages = getDocsPages();
  const legalPages = getLegalPages();
  const useCasePages = getUseCasePages();

  const mostRecentBlog =
    blogPosts[0]?.data.updatedAt ?? blogPosts[0]?.data.publishedAt;
  const mostRecentChangelog =
    changelogEntries[0]?.data.updatedAt ??
    changelogEntries[0]?.data.publishedAt;

  return [
    {
      url: SITE_URL,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/pricing`,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    ...useCasePages.map(
      (page): SitemapEntry => ({
        url: page.url,
        changeFrequency: "monthly",
        priority: 0.85,
      })
    ),
    {
      url: `${SITE_URL}/docs`,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...docsPages.map((page) => ({
      url: page.url,
      lastModified: toLastModified(page.data.updatedAt),
      changeFrequency: "weekly" as const,
      priority: 0.75,
    })),
    {
      url: `${SITE_URL}/docs/get-started/quickstart`,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/docs/get-started/config`,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/docs/api-reference`,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/blog`,
      lastModified: toLastModified(mostRecentBlog),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...blogPosts.map((page) => ({
      url: page.url,
      lastModified: new Date(page.data.updatedAt ?? page.data.publishedAt),
      changeFrequency: "weekly" as const,
      priority: getCategoryPriority(page.data.category),
    })),
    ...getBlogCategories().map(({ slug }) => {
      const postsInCategory = blogPosts.filter(
        (page) => page.data.category === slug
      );
      const mostRecentInCategory = postsInCategory[0];

      return {
        url: `${SITE_URL}/blog/topic/${slug}`,
        lastModified: toLastModified(
          mostRecentInCategory?.data.updatedAt ??
            mostRecentInCategory?.data.publishedAt
        ),
        changeFrequency: "weekly" as const,
        priority: getCategoryPriority(slug),
      };
    }),
    {
      url: `${SITE_URL}/changelog`,
      lastModified: toLastModified(mostRecentChangelog),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...changelogEntries.map((page) => ({
      url: page.url,
      lastModified: new Date(page.data.updatedAt ?? page.data.publishedAt),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    {
      url: `${SITE_URL}/blog/rss.xml`,
      lastModified: toLastModified(mostRecentBlog),
      changeFrequency: "daily",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/blog/atom.xml`,
      lastModified: toLastModified(mostRecentBlog),
      changeFrequency: "daily",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/blog/feed.xml`,
      lastModified: toLastModified(mostRecentBlog),
      changeFrequency: "daily",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/changelog/rss.xml`,
      lastModified: toLastModified(mostRecentChangelog),
      changeFrequency: "daily",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/changelog/atom.xml`,
      lastModified: toLastModified(mostRecentChangelog),
      changeFrequency: "daily",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/changelog/feed.xml`,
      lastModified: toLastModified(mostRecentChangelog),
      changeFrequency: "daily",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/search`,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    ...legalPages.map((page) => ({
      url: page.url,
      lastModified: new Date(page.data.updatedAt),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
    {
      url: `${SITE_URL}/sign-in`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/sign-up`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}

export function generateSitemapXml(entries = getSitemapEntries()): string {
  const body = entries
    .map((entry) => {
      const lastModified = entry.lastModified?.toISOString();

      return [
        "  <url>",
        `    <loc>${xmlEscape(entry.url)}</loc>`,
        ...(lastModified
          ? [`    <lastmod>${xmlEscape(lastModified)}</lastmod>`]
          : []),
        `    <changefreq>${entry.changeFrequency}</changefreq>`,
        `    <priority>${entry.priority.toFixed(1)}</priority>`,
        "  </url>",
      ].join("\n");
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    body,
    "</urlset>",
    "",
  ].join("\n");
}

export function generateRobotsTxt(env: DeploymentEnv = getDeploymentEnv()) {
  if (env !== "production") {
    return ["User-agent: *", "Disallow: /", ""].join("\n");
  }

  const lines = [
    "User-agent: *",
    "Allow: /",
    "Allow: /llms.txt",
    "Allow: /api/og/*",
    "Disallow: /api/",
    "Disallow: /account/",
    "Disallow: /new/",
    "Disallow: /*/settings/",
    "Disallow: /*/insights/",
    "Disallow: /*/jobs/",
    "Disallow: /*/search/",
    "Disallow: /confirm/",
    "",
  ];

  for (const userAgent of [
    "OAI-SearchBot",
    "ChatGPT-User",
    "GPTBot",
    "CCBot",
    "PerplexityBot",
    "Claude-Web",
    "Google-Extended",
    "anthropic-ai",
    "cohere-ai",
    "FacebookBot",
    "meta-externalagent",
    "Amazonbot",
    "Applebot",
    "Applebot-Extended",
    "Omgilibot",
    "Omgili",
  ]) {
    lines.push(`User-agent: ${userAgent}`, "Allow: /", "");
  }

  lines.push(`Sitemap: ${SITE_URL}/sitemap.xml`, "");

  return lines.join("\n");
}

function getLlmsEntries(): PageEntry[] {
  return [
    {
      url: SITE_URL,
      title: "The Operating Layer for Agents and Apps",
      description:
        "Lightfast is the operating layer between your agents and apps. Observe what's happening across your tools, remember what happened, and give agents and people a single system to reason and act through.",
      section: "Marketing",
    },
    {
      url: `${SITE_URL}/pricing`,
      title: "Pricing",
      description: "Pricing for Lightfast.",
      section: "Marketing",
    },
    ...getUseCasePages().map((page) => ({
      url: page.url,
      title: page.data.title,
      description: page.data.description,
      section: "Use Cases",
    })),
    {
      url: `${SITE_URL}/docs`,
      title: "Documentation",
      description: "Documentation for building with Lightfast.",
      section: "Docs",
    },
    {
      url: `${SITE_URL}/docs/api-reference`,
      title: "API Reference",
      description: "API reference for integrating with Lightfast.",
      section: "API Reference",
    },
    ...getDocsPages().map((page) => ({
      url: page.url,
      title: page.data.title,
      description: page.data.description,
      section: "Docs",
    })),
    {
      url: `${SITE_URL}/blog`,
      title: "Blog",
      description:
        "Insights, guides, and product updates from the Lightfast team.",
      section: "Blog",
    },
    ...getBlogPages().map((page) => ({
      url: page.url,
      title: page.data.title,
      description: page.data.description,
      section: "Blog",
    })),
    {
      url: `${SITE_URL}/changelog`,
      title: "Changelog",
      description:
        "What's new in Lightfast - product updates and improvements.",
      section: "Changelog",
    },
    ...getChangelogPages().map((page) => ({
      url: page.url,
      title: page.data.title,
      description: page.data.description,
      section: "Changelog",
    })),
    ...getLegalPages().map((page) => ({
      url: page.url,
      title: page.data.title,
      description: page.data.description,
      section: "Legal",
      optional: true,
    })),
  ];
}

export async function generateLlmsTxt(): Promise<string> {
  return toLlmsTxt(getLlmsEntries(), {
    title: "Lightfast",
    description:
      "The operating layer for AI agents and engineering teams. Agents and developers use Lightfast to observe events, build semantic memory, and act across their entire tool stack - giving AI systems persistent, source-cited knowledge of everything that happens across code, deployments, incidents, and decisions.",
    baseUrl: SITE_URL,
    sectionOrder: [
      "Marketing",
      "Use Cases",
      "Docs",
      "API Reference",
      "Blog",
      "Changelog",
      "Legal",
    ],
    defaultSection: "Marketing",
    footer: [
      "## Contact & Support",
      "",
      "- Email: hello@lightfast.ai",
      "- Founder: Jeevan Pillay - jp@lightfast.ai - https://twitter.com/jeevanpillay",
      "- Support: support@lightfast.ai",
      "- Twitter: https://twitter.com/lightfastai",
      "- Discord: https://discord.gg/YqPDfcar2C",
      "- GitHub (org): https://github.com/lightfastai",
      "- GitHub (SDK + MCP): https://github.com/lightfastai/lightfast",
      "- npm (SDK): https://www.npmjs.com/package/lightfast",
      "- npm (MCP server): https://www.npmjs.com/package/@lightfastai/mcp",
    ],
  });
}
