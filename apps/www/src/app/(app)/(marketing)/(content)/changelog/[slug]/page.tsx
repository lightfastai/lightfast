import { SSRCodeBlock } from "@repo/ui/components/ssr-code-block";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/ui/accordion";
import { Button } from "@repo/ui/components/ui/button";
import type { ChangelogEntryQueryResponse } from "@vendor/cms";
import { changelog } from "@vendor/cms";
import { Body } from "@vendor/cms/components/body";
import { Feed } from "@vendor/cms/components/feed";
import type { JsonLdData } from "@vendor/seo/json-ld";
import { JsonLd } from "@vendor/seo/json-ld";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-static";

interface ChangelogPageProps {
  params: Promise<{ slug: string }>;
}


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

  if (!entry) {
    return {};
  }

  // Use SEO fields with fallbacks
  const title = entry.seo.metaTitle ?? entry._title;
  const description =
    entry.seo.metaDescription ??
    entry.excerpt ??
    entry.tldr ??
    entry.body?.plainText?.slice(0, 160) ??
    entry._title;

  const canonicalUrl =
    entry.seo.canonicalUrl ?? `https://lightfast.ai/changelog/${slug}`;
  const publishedTime = entry.publishedAt;

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
    ...(entry.seo.noIndex ? { robots: { index: false } } : {}),
  } satisfies Metadata;
}

// Helper to parse bullet points from markdown text
function parseBulletPoints(text: string | null | undefined): string[] {
  if (!text) {
    return [];
  }
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
        const entry = response.changelog.post.item;
        if (!entry) {
          notFound();
        }

        // Fetch adjacent entries for navigation
        const adjacentEntries = await changelog
          .getAdjacentEntries(slug)
          .catch(() => ({ previous: null, next: null }));

        const publishedTime = entry.publishedAt;
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
          ...(entry.prefix ? { softwareVersion: entry.prefix } : {}),
          description:
            entry.seo.metaDescription ??
            entry.excerpt ??
            entry.tldr ??
            entry.body?.plainText?.slice(0, 160) ??
            entry._title,
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
        const faqItems = entry.seo.faq.items.filter(
          (item) => item.question && item.answer
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
              <p className="text-muted-foreground text-sm">
                <Button
                  asChild
                  className="h-auto p-0 text-muted-foreground text-sm hover:text-foreground"
                  variant="link"
                >
                  <Link href="/changelog">Changelog</Link>
                </Button>
                {entry.prefix ? <> / {entry.prefix}</> : null}
              </p>

              <h2 className="pb-4 font-medium font-pp text-2xl">
                {entry._title}
              </h2>

              {entry.featuredImage?.url && (
                <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-card">
                  <Image
                    alt={entry.featuredImage.alt ?? entry._title ?? ""}
                    className="h-full w-full object-cover"
                    height={entry.featuredImage.height ?? 506}
                    priority
                    src={entry.featuredImage.url}
                    width={entry.featuredImage.width ?? 900}
                  />
                </div>
              )}

              <p className="text-muted-foreground text-sm">
                {/* @todo add author into basehub Changelog component */}
                Jeevan Pillay · {dateStr}
              </p>

              {/* TL;DR Summary for AEO */}
              {entry.tldr && (
                <div className="my-8 rounded-xs bg-card p-8">
                  <h3 className="mb-4 font-mono font-semibold text-muted-foreground text-xs uppercase tracking-widest">
                    TL;DR
                  </h3>
                  <p className="text-foreground/90 text-sm leading-relaxed">
                    {entry.tldr}
                  </p>
                </div>
              )}

              {entry.excerpt && (
                <p className="pt-4 text-muted-foreground text-sm leading-relaxed">
                  {entry.excerpt}
                </p>
              )}

              {entry.body?.json?.content ? (
                <div className="">
                  <Body
                    codeBlockComponent={SSRCodeBlock}
                    content={entry.body.json.content}
                  />
                </div>
              ) : null}

              {sections.length > 0 && (
                <div className="space-y-4">
                  {sections.map((section) => {
                    const items = parseBulletPoints(section.content);
                    const count = items.length;

                    return (
                      <div
                        className="overflow-hidden rounded-sm border"
                        key={section.key}
                      >
                        <Accordion className="w-full" type="multiple">
                          <AccordionItem
                            className="border-none"
                            value={section.key}
                          >
                            <AccordionTrigger className="px-4 py-3 font-semibold text-base">
                              {section.title} ({count})
                            </AccordionTrigger>
                            <AccordionContent className="px-4">
                              <ul className="space-y-2 text-foreground/80">
                                {items.map((item, itemIdx) => (
                                  <li
                                    className="text-sm leading-relaxed"
                                    key={`${item}-${itemIdx}`}
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
                <div className="text-muted-foreground text-xs">
                  {entry.body.readingTime} min read
                </div>
              ) : null}

              {/* Previous/Next Navigation */}
              {(adjacentEntries.previous ?? adjacentEntries.next) && (
                <nav
                  aria-label="Changelog navigation"
                  className="grid grid-cols-1 gap-4 pt-8 md:grid-cols-2"
                >
                  {adjacentEntries.previous ? (
                    <Link
                      className="group"
                      href={`/changelog/${adjacentEntries.previous.slug}`}
                      prefetch
                    >
                      <div className="h-full rounded-sm border border-transparent bg-card p-4 transition-all duration-200 hover:border-muted-foreground/20 hover:bg-accent/5">
                        <span className="flex items-center gap-1 text-muted-foreground text-sm">
                          <ChevronLeft className="h-4 w-4" />
                          Previous post
                        </span>
                        <span className="mt-1 line-clamp-2 block font-medium text-foreground text-sm">
                          {adjacentEntries.previous._title}
                        </span>
                      </div>
                    </Link>
                  ) : (
                    <div />
                  )}
                  {adjacentEntries.next ? (
                    <Link
                      className="group md:text-right"
                      href={`/changelog/${adjacentEntries.next.slug}`}
                      prefetch
                    >
                      <div className="h-full rounded-sm border border-transparent bg-card p-4 transition-all duration-200 hover:border-muted-foreground/20 hover:bg-accent/5">
                        <span className="flex items-center justify-end gap-1 text-muted-foreground text-sm md:justify-end">
                          Next post
                          <ChevronRight className="h-4 w-4" />
                        </span>
                        <span className="mt-1 line-clamp-2 block font-medium text-foreground text-sm">
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
