import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { legal, type LegalPostQueryResponse } from "@vendor/cms";
import { Body } from "@vendor/cms/components/body";
import { Feed } from "@vendor/cms/components/feed";

type LegalPageProps = {
  params: Promise<{ slug: string }>;
};

export const revalidate = 300;

export async function generateMetadata({
  params,
}: LegalPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await legal.getPost(slug);
  if (!post) return {};
  return {
    title: post._title ?? undefined,
    description: post.description ?? undefined,
  } satisfies Metadata;
}

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const posts = await legal.getPosts().catch(() => []);
  return posts
    .filter((p) => !!p._slug)
    .map((p) => ({ slug: p._slug as string }));
}

export default async function LegalPage({ params }: LegalPageProps) {
  const { slug } = await params;

  return (
    <Feed queries={[legal.postQuery(slug)]}>
      {async ([data]) => {
        "use server";

        const response = data as LegalPostQueryResponse;
        const page = response.legalPages?.item;
        if (!page) notFound();

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
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start py-8 sm:py-12 lg:py-16">
            <div className="md:col-span-2">
              {dateStr && (
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium mb-1">Last updated</p>
                  <time className="whitespace-nowrap">{dateStr}</time>
                </div>
              )}
            </div>

            <article className="md:col-span-8 md:col-start-3 lg:col-span-6 lg:col-start-4 space-y-8">
              {page.body?.json?.content ? (
                <div className="prose max-w-none prose-headings:text-foreground prose-p:text-foreground/80 prose-strong:text-foreground prose-a:text-foreground hover:prose-a:text-foreground/80">
                  <Body content={page.body.json.content} />
                </div>
              ) : null}
            </article>
          </div>
        );
      }}
    </Feed>
  );
}
