import { Button } from "@repo/ui/components/ui/button";
import type { GraphContext } from "@vendor/seo/json-ld";
import { JsonLd } from "@vendor/seo/json-ld";
import type { Metadata, Route } from "next";
import Image from "next/image";
import { getBlogPages } from "~/app/(app)/(content)/_lib/source";
import { NavLink } from "~/components/nav-link";
import {
  buildFaqEntity,
  buildOrganizationEntity,
  buildWebSiteEntity,
} from "~/lib/builders";
import { createMetadata } from "~/lib/content-seo";
import { BlogListingHeader } from "./_components/blog-listing-header";

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
  },
  twitter: {
    card: "summary_large_image",
    title: "Lightfast Blog",
    description: PAGE_DESCRIPTION,
    site: "@lightfastai",
    creator: "@lightfastai",
  },
});

export default function BlogPage() {
  const pages = getBlogPages();

  const sortedPages = [...pages].sort(
    (a, b) =>
      new Date(b.data.publishedAt).getTime() -
      new Date(a.data.publishedAt).getTime()
  );

  const [latest, ...restPages] = sortedPages;
  const featured = latest?.data.featuredImage ? latest : null;
  const listPages = featured ? restPages : sortedPages;

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
      <BlogListingHeader title="Blog" />
      {featured?.data.featuredImage && (
        <article className="mb-12" key={featured.slugs[0]}>
          <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-card">
            <Image
              alt={featured.data.title}
              className="h-full w-full object-cover"
              fill
              src={featured.data.featuredImage}
            />
          </div>
          <h2 className="mt-6 font-medium font-pp text-2xl">
            <Button
              asChild
              className="h-auto p-0 font-medium font-pp text-2xl"
              variant="link"
            >
              <NavLink href={`/blog/${featured.slugs[0]}` as Route}>
                {featured.data.title}
              </NavLink>
            </Button>
          </h2>
          <p className="mt-2 text-muted-foreground text-sm">
            <time dateTime={featured.data.publishedAt}>
              {new Date(featured.data.publishedAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </time>
          </p>
        </article>
      )}
      <div className="space-y-2">
        {sortedPages.length === 0 ? (
          <div className="rounded-xs bg-accent/40 p-4">
            <h2 className="mb-4 font-semibold text-sm">Coming soon</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              We're preparing news and updates about Lightfast. Check back soon
              for product announcements, feature releases, and insights from the
              Lightfast team.
            </p>
          </div>
        ) : (
          listPages.map((page) => (
            <article
              className="rounded-xs bg-accent/40 p-4 transition-colors hover:bg-accent"
              key={page.slugs[0]}
            >
              <NavLink
                className="block"
                href={`/blog/${page.slugs[0]}` as Route}
              >
                <h2 className="mb-1 font-base text-md">{page.data.title}</h2>
                <p className="mb-4 text-muted-foreground text-sm leading-relaxed">
                  {page.data.description}
                </p>
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <span className="capitalize">{page.data.category}</span>
                  <span>·</span>
                  <time dateTime={page.data.publishedAt}>
                    {new Date(page.data.publishedAt).toLocaleDateString(
                      "en-US",
                      { year: "numeric", month: "short", day: "numeric" }
                    )}
                  </time>
                </div>
              </NavLink>
            </article>
          ))
        )}
      </div>
    </>
  );
}
