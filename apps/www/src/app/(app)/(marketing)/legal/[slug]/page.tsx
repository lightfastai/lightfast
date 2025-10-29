import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { legal } from "@vendor/cms";
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

        const page = data.legalPages.item;
        if (!page) notFound();
        return (
          <div className="w-full py-8 sm:py-12 lg:py-16">
            <h1 className="scroll-m-20 text-balance font-extrabold text-2xl tracking-tight lg:text-5xl">
              {page._title}
            </h1>
            {page.description ? (
              <p className="text-balance leading-7 mt-6">{page.description}</p>
            ) : null}

            <div className="mt-12">
              <div className="prose max-w-none prose-neutral dark:prose-invert w-full">
                {page.body?.json?.content ? (
                  <Body content={page.body.json.content} />
                ) : null}
              </div>
            </div>
          </div>
        );
      }}
    </Feed>
  );
}
