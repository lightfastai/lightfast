import { Button } from "@repo/ui/components/ui/button";
import type { GraphContext } from "@vendor/seo/json-ld";
import { JsonLd } from "@vendor/seo/json-ld";
import { RssIcon } from "lucide-react";
import type { Metadata, Route } from "next";
import Image from "next/image";
import { getChangelogPages } from "~/app/(app)/(content)/_lib/source";
import { NavLink } from "~/components/nav-link";
import {
  buildFaqEntity,
  buildOrganizationEntity,
  buildWebSiteEntity,
} from "~/lib/builders";
import { createMetadata } from "~/lib/content-seo";

export const dynamic = "force-static";

const PAGE_TITLE = "Changelog";
const PAGE_DESCRIPTION =
  "Every feature, improvement, fix, and breaking change shipped in Lightfast. Follow the full release history of the superintelligence layer.";
const PAGE_URL = "https://lightfast.ai/changelog";
const FAQ = [
  {
    question: "Where can I follow Lightfast product updates?",
    answer:
      "This changelog is the canonical source for all Lightfast releases. Each entry includes the version, change type, and a summary of what shipped.",
  },
  {
    question: "What is Lightfast?",
    answer:
      "Lightfast is an engineering intelligence platform that connects to your developer tools, processes events through a neural pipeline, and lets you query your engineering knowledge with AI.",
  },
  {
    question: "How often does Lightfast ship updates?",
    answer:
      "Lightfast ships continuously. Each release is documented here with a version number, change type (feature, improvement, fix, or breaking change), and detailed release notes.",
  },
  {
    question: "What integrations does Lightfast support?",
    answer:
      "Lightfast integrates with GitHub, Vercel, Linear, and Sentry via OAuth. Events flow in real-time through webhooks and are processed by the neural pipeline.",
  },
  {
    question: "Does Lightfast have an API?",
    answer:
      "Yes. Lightfast ships with a public REST API, a TypeScript SDK (lightfast on npm), and an MCP server (@lightfastai/mcp) for AI agent integration.",
  },
];

export const metadata: Metadata = createMetadata({
  title: `${PAGE_TITLE} | Lightfast`,
  description: PAGE_DESCRIPTION,
  keywords: [
    "lightfast changelog",
    "release notes",
    "product updates",
    "version history",
  ],
  alternates: {
    canonical: PAGE_URL,
    types: {
      "application/rss+xml": [
        { url: "https://lightfast.ai/changelog/rss.xml", title: "RSS 2.0" },
      ],
      "application/atom+xml": [
        { url: "https://lightfast.ai/changelog/atom.xml", title: "Atom 1.0" },
      ],
    },
  },
  openGraph: {
    title: "Lightfast Changelog",
    description: PAGE_DESCRIPTION,
    type: "website",
    url: PAGE_URL,
    siteName: "Lightfast",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Lightfast Changelog",
    description: PAGE_DESCRIPTION,
    site: "@lightfastai",
    creator: "@lightfastai",
  },
});

export default function ChangelogPage() {
  const pages = getChangelogPages();

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
        "@type": "WebPage" as const,
        "@id": `${PAGE_URL}#webpage`,
        url: PAGE_URL,
        name: "Lightfast Changelog",
        description: PAGE_DESCRIPTION,
        isPartOf: { "@id": "https://lightfast.ai/#website" },
        publisher: { "@id": "https://lightfast.ai/#organization" },
      },
      buildFaqEntity(FAQ, PAGE_URL),
    ],
  };

  return (
    <div className="mx-auto w-full min-w-0 max-w-2xl pt-24 pb-32">
      <JsonLd code={structuredData} />
      <div className="mb-12 flex items-center justify-between">
        <h1 className="font-medium font-pp text-3xl text-foreground">
          Changelog
        </h1>
        <NavLink
          className="inline-flex items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground"
          href={"/changelog/rss.xml" as Route}
          title="Subscribe to RSS Feed"
        >
          <RssIcon className="h-4 w-4" />
          <span>RSS Feed</span>
        </NavLink>
      </div>
      <div className="space-y-12 text-foreground">
        {sortedPages.length === 0 ? (
          <div className="py-16">
            <h2 className="mb-4 font-semibold text-2xl">Stay tuned</h2>
            <p className="text-foreground/80 leading-relaxed">
              We're shipping fast. Changelog entries will appear here after our
              next release.
            </p>
          </div>
        ) : (
          sortedPages.map((page) => (
            <article className="space-y-3" key={page.slugs[0]}>
              <p className="text-muted-foreground text-sm">
                Changelog
                {page.data.version ? <> / {page.data.version}</> : null}
              </p>

              <h2 className="pb-4 font-medium font-pp text-2xl">
                <Button
                  asChild
                  className="h-auto p-0 font-medium font-pp text-2xl"
                  variant="link"
                >
                  <NavLink href={`/changelog/${page.slugs[0]}` as Route}>
                    {page.data.title}
                  </NavLink>
                </Button>
              </h2>

              {page.data.featuredImage && (
                <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-card">
                  <Image
                    alt={page.data.title}
                    className="h-full w-full object-cover"
                    fill
                    src={page.data.featuredImage}
                  />
                </div>
              )}

              <p className="text-muted-foreground text-sm">
                {page.data.authors[0]?.name ?? "Lightfast"} ·{" "}
                <time dateTime={page.data.publishedAt}>
                  {new Date(page.data.publishedAt).toLocaleDateString(
                    undefined,
                    { year: "numeric", month: "short", day: "numeric" }
                  )}
                </time>
              </p>

              {page.data.description && (
                <p className="pt-4 text-muted-foreground text-sm leading-relaxed">
                  {page.data.description}
                </p>
              )}
            </article>
          ))
        )}
      </div>
    </div>
  );
}
