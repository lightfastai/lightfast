import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { changelog  } from "@vendor/cms";
import type {ChangelogEntryQueryResponse} from "@vendor/cms";
import { Body } from "@vendor/cms/components/body";
import { Feed, isDraft } from "@vendor/cms/components/feed";
import { JsonLd } from "@vendor/seo/json-ld";
import type { JsonLdData } from "@vendor/seo/json-ld";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/ui/accordion";
import { Button } from "@repo/ui/components/ui/button";

interface ChangelogPageProps {
  params: Promise<{ slug: string }>;
}

export const revalidate = 300;

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  try {
    const entries = await changelog.getEntries();
    return entries
      .filter((entry) => !!entry.slug)
      .map((entry) => ({ slug: entry.slug ?? "" }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: ChangelogPageProps): Promise<Metadata> {
  const { slug } = await params;

  let entry;
  try {
    entry = await changelog.getEntryBySlug(slug);
  } catch {
    return {};
  }

  if (!entry) return {};

  // Use SEO fields with fallbacks
  const title = entry.seo?.metaTitle ?? entry._title ?? "Changelog";
  const description =
    entry.seo?.metaDescription ??
    entry.excerpt ??
    entry.tldr ??
    entry.body?.plainText?.slice(0, 160) ??
    `${entry._title} - Lightfast changelog update`;

  const canonicalUrl =
    entry.seo?.canonicalUrl ?? `https://lightfast.ai/changelog/${slug}`;
  const publishedTime = entry.publishedAt ?? entry._sys?.createdAt;

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
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
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
    <Feed draft={isDraft} queries={[changelog.entryBySlugQuery(slug)]}>
      {async ([data]) => {
        "use server";

        const response = data as ChangelogEntryQueryResponse;
        const entry = response.changelog?.post?.item;
        if (!entry) notFound();

        // Fetch adjacent entries for navigation
        const adjacentEntries = await changelog
          .getAdjacentEntries(slug)
          .catch(() => ({ previous: null, next: null }));

        // Use publishedAt if available, fall back to createdAt
        const publishedTime = entry.publishedAt ?? entry._sys?.createdAt;
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
            entry.seo?.metaDescription ??
            entry.excerpt ??
            entry.tldr ??
            entry.body?.plainText?.slice(0, 160) ??
            entry._title ??
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
            <JsonLd code={structuredData as JsonLdData} />

            <article className="space-y-3">
              <p className="text-sm text-muted-foreground">
                <Button
                  variant="link"
                  className="h-auto p-0 text-sm text-muted-foreground hover:text-foreground"
                  asChild
                >
                  <Link href="/changelog">Changelog</Link>
                </Button>
                {entry.slug ? <> / {entry.slug.slice(0, 3)}</> : null}
              </p>

              <h2 className="text-2xl font-pp font-medium pb-4">
                {entry._title}
              </h2>

              {entry.featuredImage?.url && (
                <div className="relative w-full bg-card aspect-video rounded-lg overflow-hidden">
                  <Image
                    src={entry.featuredImage.url}
                    alt={entry.featuredImage.alt ?? entry._title ?? ""}
                    width={entry.featuredImage.width ?? 900}
                    height={entry.featuredImage.height ?? 506}
                    className="w-full h-full object-cover"
                    priority
                  />
                </div>
              )}

              <p className="text-sm text-muted-foreground">
                {/* @todo add author into basehub Changelog component */}
                Jeevan Pillay · {dateStr}
              </p>

              {/* TL;DR Summary for AEO */}
              {entry.tldr && (
                <div className="bg-card rounded-xs p-8 my-8">
                  <h3 className="text-xs font-semibold text-muted-foreground font-mono uppercase tracking-widest mb-4">
                    TL;DR
                  </h3>
                  <p className="text-foreground/90 text-sm leading-relaxed">
                    {entry.tldr}
                  </p>
                </div>
              )}

              {entry.excerpt && (
                <p className="pt-4 text-sm text-muted-foreground leading-relaxed">
                  {entry.excerpt}
                </p>
              )}

              {entry.body?.json?.content ? (
                <div className="">
                  <Body content={entry.body.json.content} />
                </div>
              ) : null}

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
                                {items.map((item, itemIdx) => (
                                  <li
                                    key={`${item}-${itemIdx}`}
                                    className="leading-relaxed text-sm"
                                  >
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
              {(adjacentEntries.previous ?? adjacentEntries.next) && (
                <nav
                  aria-label="Changelog navigation"
                  className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-8"
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
          </>
        );
      }}
    </Feed>
  );
}
