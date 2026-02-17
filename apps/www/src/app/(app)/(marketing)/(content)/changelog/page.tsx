import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { changelog, type ChangelogEntriesQueryResponse } from "@vendor/cms";
import { Body } from "@vendor/cms/components/body";
import { Feed, isDraft } from "@vendor/cms/components/feed";
import { Button } from "@repo/ui/components/ui/button";

export const metadata: Metadata = {
  title: "Lightfast Changelog",
  description:
    "Product updates, new features, and improvements from Lightfast - the AI memory layer for engineering teams",
  openGraph: {
    title: "Lightfast Changelog",
    description:
      "Product updates, new features, and improvements from Lightfast - the AI memory layer for engineering teams",
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

export const revalidate = 300;

export default async function ChangelogPage() {
  return (
    <Feed draft={isDraft} queries={[changelog.entriesQuery]}>
      {async ([data]) => {
        "use server";

        const response = data as ChangelogEntriesQueryResponse;
        const entries = response.changelog?.post?.items ?? [];

        return (
          <div className="text-foreground space-y-12">
            {entries.length === 0 ? (
              <div className="py-16">
                <h2 className="text-2xl font-semibold mb-4">Stay tuned</h2>
                <p className="text-foreground/80 leading-relaxed">
                  We're shipping fast. Changelog entries will appear here after
                  our next release.
                </p>
              </div>
            ) : (
              entries.map((item) => {
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

                return (
                  <div key={item._slug ?? item._title} className="relative">
                    <article className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Changelog
                        {item.slug ? <> / {item.slug.slice(0, 3)}</> : null}
                      </p>

                      <h2 className="text-2xl font-pp font-medium pb-4">
                        {item.slug ? (
                          <Button
                            variant="link"
                            className="h-auto p-0 text-2xl font-pp font-medium"
                            asChild
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
                        <div className="relative w-full bg-card aspect-video rounded-lg overflow-hidden">
                          <Image
                            src={item.featuredImage.url}
                            alt={item.featuredImage?.alt || item._title || ""}
                            width={item.featuredImage?.width || 900}
                            height={item.featuredImage?.height || 506}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}

                      <p className="text-sm text-muted-foreground">
                        {/* @todo add author into basehub Changelog component */}
                        Jeevan Pillay · {dateStr}
                      </p>

                      {item.excerpt && (
                        <p className="pt-4 text-sm text-muted-foreground leading-relaxed">
                          {item.excerpt}
                        </p>
                      )}
                      {item.body?.json?.content ? (
                        <div className="">
                          <Body content={item.body.json.content} />
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
