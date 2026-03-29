import { Button } from "@repo/ui/components/ui/button";
import type { GraphContext } from "@vendor/seo/json-ld";
import { JsonLd } from "@vendor/seo/json-ld";
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
    images: [
      {
        url: "https://lightfast.ai/images/og-default.png",
        width: 1200,
        height: 630,
        alt: "Lightfast Changelog",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Lightfast Changelog",
    description: PAGE_DESCRIPTION,
    site: "@lightfastai",
    creator: "@lightfastai",
    images: ["https://lightfast.ai/images/og-default.png"],
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
    <>
      <JsonLd code={structuredData} />
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

              {page.data.ogImage &&
                page.data.ogImage !==
                  "https://lightfast.ai/images/og-default.png" && (
                  <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-card">
                    <Image
                      alt={page.data.title}
                      className="h-full w-full object-cover"
                      fill
                      src={page.data.ogImage}
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
    </>
  );
}
