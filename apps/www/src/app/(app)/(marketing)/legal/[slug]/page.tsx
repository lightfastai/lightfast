import { SSRCodeBlock } from "@repo/ui/components/ssr-code-block";
import type { LegalPostQueryResponse } from "@vendor/cms";

import { legal } from "@vendor/cms";
import { Body } from "@vendor/cms/components/body";
import { Feed, isDraft } from "@vendor/cms/components/feed";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

interface LegalPageProps {
  params: Promise<{ slug: string }>;
}

export const revalidate = 300;

export async function generateMetadata({
  params,
}: LegalPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await legal.getPost(slug);
  if (!post) {
    return {};
  }
  return {
    title: post._title ?? undefined,
    description: post.description ?? undefined,
  } satisfies Metadata;
}

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const posts = await legal.getPosts().catch(() => []);
  return posts.filter((p) => !!p._slug).map((p) => ({ slug: p._slug ?? "" }));
}

export default async function LegalPage({ params }: LegalPageProps) {
  const { slug } = await params;

  return (
    <Feed draft={isDraft} queries={[legal.postQuery(slug)]}>
      {async ([data]) => {
        "use server";

        const response = data as LegalPostQueryResponse;
        const page = response.legalPages?.item;
        if (!page) {
          notFound();
        }

        const lastModified = page._sys?.lastModifiedAt
          ? new Date(page._sys.lastModifiedAt)
          : null;
        const dateStr = lastModified
          ? lastModified.toLocaleDateString(undefined, {
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          : "";

        return (
          <div className="grid grid-cols-1 items-start gap-8 py-8 sm:py-12 md:grid-cols-12 lg:py-16">
            <div className="md:col-span-2">
              {dateStr && (
                <div className="text-muted-foreground text-sm">
                  <p className="mb-1 font-medium">Last updated</p>
                  <time className="whitespace-nowrap">{dateStr}</time>
                </div>
              )}
            </div>

            <article className="space-y-8 md:col-span-8 md:col-start-3 lg:col-span-6 lg:col-start-4">
              {page.body?.json?.content ? (
                <div className="max-w-none">
                  <Body
                    codeBlockComponent={SSRCodeBlock}
                    content={page.body.json.content}
                  />
                </div>
              ) : null}
            </article>
          </div>
        );
      }}
    </Feed>
  );
}
