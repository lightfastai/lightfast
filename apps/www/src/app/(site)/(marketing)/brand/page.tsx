import { Logo } from "@repo/ui-v2/components/brand/logo";
import { Button } from "@repo/ui-v2/components/ui/button";
import type { GraphContext } from "@vendor/seo/json-ld";
import { JsonLd } from "@vendor/seo/json-ld";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { markdownComponents } from "~/app/_components/mdx-components";
import { buildOrganizationEntity, buildWebSiteEntity } from "~/lib/builders";
import { createMetadata } from "~/lib/content-seo";
import { getBrandPage } from "~/lib/content/source";

export const dynamic = "force-static";

const PAGE_URL = "https://lightfast.ai/brand";

export function generateMetadata(): Metadata {
  const page = getBrandPage();
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
      type: "website",
      url: canonicalUrl,
      siteName: "Lightfast",
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: page.data.ogTitle,
      description: page.data.ogDescription,
      site: "@lightfastai",
      creator: "@lightfastai",
    },
  });
}

export default function BrandPage() {
  const page = getBrandPage();
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
    <>
      <JsonLd code={structuredData} />
      <article className="w-full bg-background text-foreground">
        <section className="flex items-start justify-center px-6 pt-40 pb-16 text-center sm:px-10 sm:pt-32">
          <div>
            <h1 className="font-medium font-title text-5xl text-foreground">
              {page.data.title}
            </h1>
            <Button
              className="mt-10"
              nativeButton={false}
              render={<a href="#contact" />}
              size="lg"
              variant="secondary"
            >
              Contact
            </Button>
          </div>
        </section>

        <section className="px-6 pb-20 sm:px-10 sm:pb-28">
          <div className="mx-auto aspect-video max-w-[1620px] overflow-hidden rounded-md bg-foreground text-background">
            <div className="flex h-full flex-col px-12 py-16 sm:px-20 lg:px-28">
              <div className="grid grid-cols-[1fr_auto_1fr] items-start text-[10px] leading-none text-background">
                <span />
                <span>Wordmarks</span>
                <span />
              </div>
              <div className="flex flex-1 items-center justify-center">
                <Logo className="text-background" size="lg" />
              </div>
            </div>
          </div>
        </section>

        <div className="px-6 sm:px-10">
          <div className="mx-auto w-full max-w-2xl py-16 md:py-24">
            <MDXContent components={markdownComponents} />
          </div>
        </div>
      </article>
    </>
  );
}
