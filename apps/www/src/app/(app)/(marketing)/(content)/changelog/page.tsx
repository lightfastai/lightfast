import { SSRCodeBlock } from "@repo/ui/components/ssr-code-block";
import { Button } from "@repo/ui/components/ui/button";
import type { ChangelogEntriesQueryResponse } from "@vendor/cms";
import { changelog } from "@vendor/cms";
import { Body } from "@vendor/cms/components/body";
import { Feed } from "@vendor/cms/components/feed";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Lightfast Changelog",
  description:
    "Product updates, new features, and improvements from Lightfast — surfaces decisions across your tools",
  openGraph: {
    title: "Lightfast Changelog",
    description:
      "Product updates, new features, and improvements from Lightfast — surfaces decisions across your tools",
    type: "website",
    url: "https://lightfast.ai/changelog",
    siteName: "Lightfast",
  },
  twitter: {
    card: "summary_large_image",
    title: "Lightfast Changelog",
    description:
      "Product updates, new features, and improvements from Lightfast",
    creator: "@lightfastai",
  },
  alternates: {
    canonical: "https://lightfast.ai/changelog",
    types: {
      "application/rss+xml": [
        { url: "https://lightfast.ai/changelog/rss.xml", title: "RSS 2.0" },
      ],
      "application/atom+xml": [
        { url: "https://lightfast.ai/changelog/atom.xml", title: "Atom 1.0" },
      ],
    },
  },
};

export default function ChangelogPage() {
  return (
    <Feed queries={[changelog.entriesQuery]}>
      {async ([data]) => {
        "use server";

        const response = data as ChangelogEntriesQueryResponse;
        const entries = response.changelog.post.items;

        return (
          <div className="space-y-12 text-foreground">
            {entries.length === 0 ? (
              <div className="py-16">
                <h2 className="mb-4 font-semibold text-2xl">Stay tuned</h2>
                <p className="text-foreground/80 leading-relaxed">
                  We're shipping fast. Changelog entries will appear here after
                  our next release.
                </p>
              </div>
            ) : (
              entries.map((item) => {
                const publishedTime = item.publishedAt;
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

                return (
                  <div className="relative" key={item._slug}>
                    <article className="space-y-3">
                      <p className="text-muted-foreground text-sm">
                        Changelog
                        {item.prefix ? <> / {item.prefix}</> : null}
                      </p>

                      <h2 className="pb-4 font-medium font-pp text-2xl">
                        {item.slug ? (
                          <Button
                            asChild
                            className="h-auto p-0 font-medium font-pp text-2xl"
                            variant="link"
                          >
                            <Link href={`/changelog/${item.slug}`}>
                              {item._title}
                            </Link>
                          </Button>
                        ) : (
                          item._title
                        )}
                      </h2>

                      {item.featuredImage?.url && (
                        <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-card">
                          <Image
                            alt={item.featuredImage.alt ?? item._title ?? ""}
                            className="h-full w-full object-cover"
                            height={item.featuredImage.height ?? 506}
                            src={item.featuredImage.url}
                            width={item.featuredImage.width ?? 900}
                          />
                        </div>
                      )}

                      <p className="text-muted-foreground text-sm">
                        {/* @todo add author into basehub Changelog component */}
                        Jeevan Pillay · {dateStr}
                      </p>

                      {item.excerpt && (
                        <p className="pt-4 text-muted-foreground text-sm leading-relaxed">
                          {item.excerpt}
                        </p>
                      )}
                      {item.body?.json?.content ? (
                        <div className="">
                          <Body
                            codeBlockComponent={SSRCodeBlock}
                            content={item.body.json.content}
                          />
                        </div>
                      ) : null}
                    </article>
                  </div>
                );
              })
            )}
          </div>
        );
      }}
    </Feed>
  );
}
