import type { GraphContext } from "@vendor/seo/json-ld";
import { JsonLd } from "@vendor/seo/json-ld";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { markdownComponents } from "~/app/_components/mdx-components";
import { buildOrganizationEntity, buildWebSiteEntity } from "~/lib/builders";
import { getHomePage } from "~/lib/content/source";
import { createMetadata } from "~/lib/content-seo";

export const dynamic = "force-static";

const PAGE_URL = "https://lightfast.ai";
const DEFAULT_OG_IMAGE = {
  url: "https://lightfast.ai/opengraph-image",
  width: 1200,
  height: 630,
  alt: "Lightfast - Human-AI Collaboration Lab",
} as const;

export function generateMetadata(): Metadata {
  const page = getHomePage();
  if (!page) {
    return {};
  }

  const canonicalUrl = page.data.canonicalUrl ?? PAGE_URL;

  return createMetadata({
    title: `${page.data.title} | Lightfast`,
    description: page.data.description,
    keywords: page.data.keywords,
    creator: "Lightfast",
    publisher: "Lightfast",
    robots: {
      index: !page.data.noindex,
      follow: !page.data.nofollow,
      googleBot: {
        index: !page.data.noindex,
        follow: !page.data.nofollow,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: page.data.ogTitle,
      description: page.data.ogDescription,
      images: [DEFAULT_OG_IMAGE],
      type: "website",
      url: canonicalUrl,
      siteName: "Lightfast",
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: page.data.ogTitle,
      description: page.data.ogDescription,
      images: [DEFAULT_OG_IMAGE.url],
      site: "@lightfastai",
      creator: "@lightfastai",
    },
  });
}

export default function HomePage() {
  const page = getHomePage();
  if (!page) {
    notFound();
  }

  const MDXContent = page.data.body;
  const canonicalUrl = page.data.canonicalUrl ?? PAGE_URL;

  const structuredData: GraphContext = {
    "@context": "https://schema.org",
    "@graph": [
      buildOrganizationEntity(),
      buildWebSiteEntity(),
      {
        "@type": "WebPage" as const,
        "@id": `${canonicalUrl}#webpage`,
        url: canonicalUrl,
        name: page.data.title,
        description: page.data.description,
        isPartOf: { "@id": "https://lightfast.ai/#website" },
        publisher: { "@id": "https://lightfast.ai/#organization" },
        dateModified: page.data.updatedAt,
      },
    ],
  };

  return (
    <main className="bg-background text-foreground">
      <JsonLd code={structuredData} />

      <section className="flex flex-col items-center pt-28 pb-16 text-center sm:pt-32 lg:pt-24">
        <h1 className="font-medium font-title text-3xl text-foreground tracking-normal lg:text-4xl">
          {page.data.title}
        </h1>
      </section>

      <article className="pb-24 md:pb-32">
        <MDXContent components={markdownComponents} />
      </article>
    </main>
  );
}
