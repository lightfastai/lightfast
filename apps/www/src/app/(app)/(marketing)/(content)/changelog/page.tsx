import Link from "next/link";
import Image from "next/image";
import { exposureTrial } from "~/lib/fonts";
import { changelog, type ChangelogEntriesQueryResponse } from "@vendor/cms";
import { Body } from "@vendor/cms/components/body";
import { Feed } from "@vendor/cms/components/feed";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/ui/accordion";

export const revalidate = 300;

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

// Helper to count items in a section
function countItems(text: string | null | undefined): number {
  return parseBulletPoints(text).length;
}

export default async function ChangelogPage() {
  return (
    <Feed queries={[changelog.entriesQuery]}>
      {async ([data]) => {
        "use server";

        const response = data as ChangelogEntriesQueryResponse;
        const entries = response.changelogPages?.items ?? [];

        return (
          <div className="max-w-7xl mx-auto px-4 pb-32">
            <h1
              className={`text-5xl font-light leading-[1.2] tracking-[-0.7] text-foreground mb-16 ${exposureTrial.className}`}
            >
              Changelog
            </h1>

            <div className="text-foreground divide-y divide-border">
              {entries.length === 0 ? (
                <div className="py-10">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
                    <div className="md:col-span-2 text-sm text-muted-foreground">
                      —
                    </div>
                    <article className="md:col-span-8 md:col-start-3 lg:col-span-6 lg:col-start-4">
                      <h2 className="text-2xl font-semibold mt-0 mb-4">
                        Stay tuned
                      </h2>
                      <p className="text-foreground/80 leading-relaxed">
                        We're shipping fast. Changelog entries will appear here
                        after our next release.
                      </p>
                    </article>
                  </div>
                </div>
              ) : (
                entries.map((item) => {
                  // Use publishedAt if available, fall back to createdAt
                  const publishedTime = item.publishedAt || item._sys?.createdAt;
                  const publishedDate = publishedTime
                    ? new Date(publishedTime)
                    : null;
                  const dateStr = publishedDate
                    ? publishedDate.toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })
                    : "";

                  const sections = [
                    {
                      key: "improvements",
                      title: "Improvements",
                      content: item.improvements,
                    },
                    {
                      key: "infrastructure",
                      title: "Infrastructure",
                      content: item.infrastructure,
                    },
                    { key: "fixes", title: "Fixes", content: item.fixes },
                    { key: "patches", title: "Patches", content: item.patches },
                  ].filter((section) => section.content);

                  return (
                    <section key={item._slug ?? item._title} className="py-10">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
                        <div className="md:col-span-2 flex items-center gap-2">
                          {item.slug && (
                            <span className="inline-block border rounded-full px-3 py-1 text-xs text-muted-foreground w-fit">
                              {item.slug}
                            </span>
                          )}
                          <time className="text-sm text-muted-foreground whitespace-nowrap">
                            {dateStr}
                          </time>
                        </div>
                        <article className="md:col-span-8 md:col-start-3 lg:col-span-6 lg:col-start-4 space-y-8">
                          <div>
                            <h2 className="text-3xl text-foreground font-semibold tracking-tight">
                              {item.slug ? (
                                <Link
                                  href={`/changelog/${item.slug}`}
                                  className="hover:text-foreground/80 transition-colors"
                                >
                                  {item._title}
                                </Link>
                              ) : (
                                item._title
                              )}
                            </h2>

                            {/* Excerpt for better list preview */}
                            {item.excerpt && (
                              <p className="text-foreground/70 mt-2 line-clamp-2">
                                {item.excerpt}
                              </p>
                            )}

                            {/* Featured image thumbnail */}
                            {item.featuredImage?.url && (
                              <div className="relative aspect-video rounded-lg overflow-hidden mt-4 max-w-sm">
                                <Image
                                  src={item.featuredImage.url}
                                  alt={item.featuredImage.alt || item._title || ""}
                                  width={400}
                                  height={225}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}

                            {item.body?.json?.content ? (
                              <div className="prose max-w-none mt-6 prose-headings:text-foreground prose-p:text-foreground/80 prose-strong:text-foreground prose-a:text-foreground hover:prose-a:text-foreground/80">
                                <Body content={item.body.json.content} />
                              </div>
                            ) : null}
                          </div>

                          {sections.length > 0 && (
                            <div className="space-y-4">
                              {sections.map((section) => {
                                const items = parseBulletPoints(
                                  section.content,
                                );
                                const count = items.length;

                                return (
                                  <div
                                    key={section.key}
                                    className="border rounded-sm overflow-hidden"
                                  >
                                    <Accordion
                                      type="multiple"
                                      className="w-full"
                                    >
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
                                              <li
                                                key={idx}
                                                className="leading-relaxed"
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

                          {item.body?.readingTime ? (
                            <div className="text-xs text-muted-foreground">
                              {item.body.readingTime} min read
                            </div>
                          ) : null}
                        </article>
                      </div>
                    </section>
                  );
                })
              )}
            </div>
          </div>
        );
      }}
    </Feed>
  );
}
