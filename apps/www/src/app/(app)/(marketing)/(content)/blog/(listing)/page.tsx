import type { GraphContext } from "@vendor/seo/json-ld";
import { JsonLd } from "@vendor/seo/json-ld";
import type { Metadata } from "next";
import Link from "next/link";
import { getBlogPages } from "~/app/(app)/(content)/_lib/source";
import {
  buildFaqEntity,
  buildOrganizationEntity,
  buildWebSiteEntity,
} from "~/lib/builders";
import { createMetadata } from "~/lib/content-seo";

export const dynamic = "force-static";

const PAGE_TITLE = "Blog";
const PAGE_DESCRIPTION =
  "Engineering deep-dives, product updates, and lessons from building the superintelligence layer for founders at Lightfast.";
const PAGE_URL = "https://lightfast.ai/blog";
const FAQ = [
  {
    question: "What topics does the Lightfast blog cover?",
    answer:
      "We cover engineering deep-dives on AI agent orchestration, product launches and changelogs, company updates, tutorials for integrating with Lightfast, and research on MCP tools and agent memory.",
  },
];

export const metadata: Metadata = createMetadata({
  title: `${PAGE_TITLE} | Lightfast`,
  description: PAGE_DESCRIPTION,
  keywords: [
    "lightfast blog",
    "ai engineering blog",
    "agent infrastructure",
    "mcp tools",
    "product updates",
  ],
  alternates: {
    canonical: PAGE_URL,
    types: {
      "application/rss+xml": [
        { url: "https://lightfast.ai/blog/rss.xml", title: "RSS 2.0" },
      ],
      "application/atom+xml": [
        { url: "https://lightfast.ai/blog/atom.xml", title: "Atom 1.0" },
      ],
    },
  },
  openGraph: {
    title: "Lightfast Blog – Operating Infrastructure for Agents and Apps",
    description:
      "Articles on operating infrastructure, event-driven architecture, and agent tooling.",
    type: "website",
    url: PAGE_URL,
    siteName: "Lightfast",
    locale: "en_US",
    images: [
      {
        url: "https://lightfast.ai/images/og-default.png",
        width: 1200,
        height: 630,
        alt: "Lightfast Blog",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Lightfast Blog",
    description: PAGE_DESCRIPTION,
    site: "@lightfastai",
    creator: "@lightfastai",
    images: ["https://lightfast.ai/images/og-default.png"],
  },
});

export default function BlogPage() {
  const pages = getBlogPages();

  const sortedPages = [...pages].sort((a, b) => {
    return (
      new Date(b.data.publishedAt).getTime() -
      new Date(a.data.publishedAt).getTime()
    );
  });

  const structuredData: GraphContext = {
    "@context": "https://schema.org",
    "@graph": [
      buildOrganizationEntity(),
      buildWebSiteEntity(),
      {
        "@type": "Blog" as const,
        "@id": `${PAGE_URL}#blog`,
        url: PAGE_URL,
        name: "Lightfast Blog",
        description: PAGE_DESCRIPTION,
        publisher: { "@id": "https://lightfast.ai/#organization" },
        blogPost: sortedPages.slice(0, 10).map((page) => ({
          "@type": "BlogPosting" as const,
          headline: page.data.title,
          description: page.data.description,
          url: `https://lightfast.ai/blog/${page.slugs[0]}`,
          datePublished: page.data.publishedAt,
        })),
      },
      buildFaqEntity(FAQ, PAGE_URL),
    ],
  };

  return (
    <>
      <JsonLd code={structuredData} />
      <div className="space-y-2">
        {sortedPages.length === 0 ? (
          <div className="rounded-xs border border-transparent bg-card/40 p-4">
            <h2 className="mb-4 font-semibold text-sm">Coming soon</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              We're preparing news and updates about Lightfast. Check back soon
              for product announcements, feature releases, and insights from the
              Lightfast team.
            </p>
          </div>
        ) : (
          sortedPages.map((page) => (
            <article
              className="rounded-xs border border-transparent bg-card p-4 transition-colors hover:border-border/40"
              key={page.slugs[0]}
            >
              <Link className="group block" href={`/blog/${page.slugs[0]}`}>
                <h2 className="mb-1 font-base text-md transition-colors group-hover:text-foreground/80">
                  {page.data.title}
                </h2>
                <p className="mb-4 text-md text-muted-foreground leading-relaxed">
                  {page.data.description}
                </p>
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <span>{page.data.category}</span>
                  <span>·</span>
                  <time dateTime={page.data.publishedAt}>
                    {new Date(page.data.publishedAt).toLocaleDateString(
                      "en-US",
                      { year: "numeric", month: "short", day: "numeric" }
                    )}
                  </time>
                </div>
              </Link>
            </article>
          ))
        )}
      </div>
    </>
  );
}
