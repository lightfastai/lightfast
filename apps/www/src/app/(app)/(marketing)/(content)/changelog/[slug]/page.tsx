import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { changelog, type ChangelogEntryQueryResponse } from "@vendor/cms";
import { Body } from "@vendor/cms/components/body";
import { Feed } from "@vendor/cms/components/feed";
import { JsonLd } from "@vendor/seo/json-ld";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/ui/accordion";

type ChangelogPageProps = {
  params: Promise<{ slug: string }>;
};

export const revalidate = 300;

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const entries = await changelog.getEntries().catch(() => []);
  return entries
    .filter((entry) => !!entry.slug)
    .map((entry) => ({ slug: entry.slug as string }));
}

export async function generateMetadata({
  params,
}: ChangelogPageProps): Promise<Metadata> {
  const { slug } = await params;
  const entry = await changelog.getEntryBySlug(slug);

  if (!entry) return {};

  // Use SEO fields with fallbacks
  const title = entry.seo?.metaTitle || entry._title || "Changelog";
  const description =
    entry.seo?.metaDescription ||
    entry.excerpt ||
    entry.tldr ||
    entry.body?.plainText?.slice(0, 160) ||
    `${entry._title} - Lightfast changelog update`;

  const canonicalUrl =
    entry.seo?.canonicalUrl || `https://lightfast.ai/changelog/${slug}`;
  const ogImage = entry.featuredImage?.url || "https://lightfast.ai/og.jpg";
  const publishedTime = entry.publishedAt || entry._sys?.createdAt;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
      types: {
        "application/rss+xml": [
          { url: "https://lightfast.ai/changelog/rss.xml", title: "RSS 2.0" },
        ],
        "application/atom+xml": [
          { url: "https://lightfast.ai/changelog/atom.xml", title: "Atom" },
        ],
      },
    },
    openGraph: {
      title,
      description,
      type: "article",
      url: canonicalUrl,
      siteName: "Lightfast",
      publishedTime: publishedTime ?? undefined,
      images: [
        {
          url: ogImage,
          width: entry.featuredImage?.width ?? 1200,
          height: entry.featuredImage?.height ?? 630,
          alt: entry.featuredImage?.alt ?? title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
      creator: "@lightfastai",
    },
    ...(entry.seo?.noIndex ? { robots: { index: false } } : {}),
  } satisfies Metadata;
}

// Helper to parse bullet points from markdown text
function parseBulletPoints(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("-") || line.startsWith("•"))
    .map((line) => line.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean);
}

export default async function ChangelogEntryPage({
  params,
}: ChangelogPageProps) {
  const { slug } = await params;

  return (
    <Feed queries={[changelog.entryBySlugQuery(slug)]}>
      {async ([data]) => {
        "use server";

        const response = data as ChangelogEntryQueryResponse;
        const entry = response.changelogPages?.item;
        if (!entry) notFound();

        // Fetch adjacent entries for navigation
        const adjacentEntries = await changelog.getAdjacentEntries(slug);

        // Use publishedAt if available, fall back to createdAt
        const publishedTime = entry.publishedAt || entry._sys?.createdAt;
        const publishedDate = publishedTime ? new Date(publishedTime) : null;
        const dateStr = publishedDate
          ? publishedDate.toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            })
          : "";

        // Generate base structured data
        const baseStructuredData = {
          "@context": "https://schema.org" as const,
          "@type": "SoftwareApplication" as const,
          name: "Lightfast",
          applicationCategory: "DeveloperApplication",
          releaseNotes: `https://lightfast.ai/changelog/${slug}`,
          ...(publishedDate
            ? { datePublished: publishedDate.toISOString() }
            : {}),
          ...(entry.slug ? { softwareVersion: entry.slug } : {}),
          description:
            entry.seo?.metaDescription ||
            entry.excerpt ||
            entry.tldr ||
            entry.body?.plainText?.slice(0, 160) ||
            entry._title ||
            "Lightfast changelog entry",
          ...(entry.featuredImage?.url
            ? {
                image: {
                  "@type": "ImageObject" as const,
                  url: entry.featuredImage.url,
                  ...(entry.featuredImage.width
                    ? { width: entry.featuredImage.width }
                    : {}),
                  ...(entry.featuredImage.height
                    ? { height: entry.featuredImage.height }
                    : {}),
                },
              }
            : {}),
          offers: {
            "@type": "Offer" as const,
            price: "0",
            priceCurrency: "USD",
          },
        };

        // Generate FAQ schema if FAQ items exist
        const faqItems = entry.seo?.faq?.items?.filter(
          (item) => item.question && item.answer,
        );
        const faqSchema =
          faqItems && faqItems.length > 0
            ? {
                "@type": "FAQPage" as const,
                mainEntity: faqItems.map((item) => ({
                  "@type": "Question" as const,
                  name: item.question,
                  acceptedAnswer: {
                    "@type": "Answer" as const,
                    text: item.answer,
                  },
                })),
              }
            : null;

        // Combine schemas
        const structuredData = faqSchema
          ? {
              "@context": "https://schema.org",
              "@graph": [baseStructuredData, faqSchema],
            }
          : baseStructuredData;

        const sections = [
          {
            key: "improvements",
            title: "Improvements",
            content: entry.improvements,
          },
          {
            key: "infrastructure",
            title: "Infrastructure",
            content: entry.infrastructure,
          },
          { key: "fixes", title: "Fixes", content: entry.fixes },
          { key: "patches", title: "Patches", content: entry.patches },
        ].filter((section) => section.content);

        return (
          <>
            {/* Structured data for SEO */}
            <JsonLd code={structuredData as any} />

            <div className="max-w-7xl mx-auto px-4">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
                <div className="md:col-span-2 flex items-center gap-2">
                  {entry.slug && (
                    <span className="inline-block border rounded-full px-3 py-1 text-xs text-muted-foreground w-fit">
                      {entry.slug}
                    </span>
                  )}
                  <time className="text-sm text-muted-foreground whitespace-nowrap">
                    {dateStr}
                  </time>
                </div>

                <article className="md:col-span-8 md:col-start-3 lg:col-span-6 lg:col-start-4 space-y-8">
                  <div>
                    <h1 className="text-3xl text-foreground font-semibold tracking-tight">
                      {entry._title}
                    </h1>

                    {/* TL;DR Summary for AEO */}
                    {entry.tldr && (
                      <div className="bg-muted/50 border rounded-lg p-4 mt-6">
                        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                          TL;DR
                        </h2>
                        <p className="text-foreground/90 leading-relaxed">
                          {entry.tldr}
                        </p>
                      </div>
                    )}

                    {/* Featured Image */}
                    {entry.featuredImage?.url && (
                      <div className="relative aspect-video rounded-lg overflow-hidden mt-8">
                        <Image
                          src={entry.featuredImage.url}
                          alt={entry.featuredImage.alt || entry._title || ""}
                          width={entry.featuredImage.width || 1200}
                          height={entry.featuredImage.height || 630}
                          className="w-full h-full object-cover"
                          priority
                        />
                      </div>
                    )}

                    {entry.body?.json?.content ? (
                      <div className="prose max-w-none mt-6 prose-headings:text-foreground prose-p:text-foreground/80 prose-strong:text-foreground prose-a:text-foreground hover:prose-a:text-foreground/80">
                        <Body content={entry.body.json.content} />
                      </div>
                    ) : null}
                  </div>

                  {sections.length > 0 && (
                    <div className="space-y-4">
                      {sections.map((section) => {
                        const items = parseBulletPoints(section.content);
                        const count = items.length;

                        return (
                          <div
                            key={section.key}
                            className="border rounded-sm overflow-hidden"
                          >
                            <Accordion type="multiple" className="w-full">
                              <AccordionItem
                                value={section.key}
                                className="border-none"
                              >
                                <AccordionTrigger className="text-base font-semibold px-4 py-3">
                                  {section.title} ({count})
                                </AccordionTrigger>
                                <AccordionContent className="px-4">
                                  <ul className="space-y-2 text-foreground/80">
                                    {items.map((item, idx) => (
                                      <li key={idx} className="leading-relaxed">
                                        • {item}
                                      </li>
                                    ))}
                                  </ul>
                                </AccordionContent>
                              </AccordionItem>
                            </Accordion>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {entry.body?.readingTime ? (
                    <div className="text-xs text-muted-foreground">
                      {entry.body.readingTime} min read
                    </div>
                  ) : null}

                  {/* Previous/Next Navigation */}
                  {(adjacentEntries.previous || adjacentEntries.next) && (
                    <nav
                      aria-label="Changelog navigation"
                      className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-12 pb-4 pt-8"
                    >
                      {adjacentEntries.previous ? (
                        <Link
                          href={`/changelog/${adjacentEntries.previous.slug}`}
                          className="group"
                        >
                          <div className="h-full rounded-sm border border-transparent bg-card p-4 transition-all duration-200 hover:border-muted-foreground/20 hover:bg-accent/5">
                            <span className="flex items-center gap-1 text-sm text-muted-foreground">
                              <ChevronLeft className="h-4 w-4" />
                              Previous post
                            </span>
                            <span className="block mt-1 font-medium text-sm text-foreground line-clamp-2">
                              {adjacentEntries.previous._title}
                            </span>
                          </div>
                        </Link>
                      ) : (
                        <div />
                      )}
                      {adjacentEntries.next ? (
                        <Link
                          href={`/changelog/${adjacentEntries.next.slug}`}
                          className="group md:text-right"
                        >
                          <div className="h-full rounded-sm border border-transparent bg-card p-4 transition-all duration-200 hover:border-muted-foreground/20 hover:bg-accent/5">
                            <span className="flex items-center justify-end gap-1 text-sm text-muted-foreground md:justify-end">
                              Next post
                              <ChevronRight className="h-4 w-4" />
                            </span>
                            <span className="block mt-1 font-medium text-sm text-foreground line-clamp-2">
                              {adjacentEntries.next._title}
                            </span>
                          </div>
                        </Link>
                      ) : (
                        <div />
                      )}
                    </nav>
                  )}
                </article>
              </div>
            </div>
          </>
        );
      }}
    </Feed>
  );
}
