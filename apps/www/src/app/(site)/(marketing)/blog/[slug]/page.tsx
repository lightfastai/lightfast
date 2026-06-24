import { JsonLd } from "@vendor/seo/json-ld";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { markdownComponents } from "~/app/_components/mdx-components";
import {
  getBlogPostPublication,
  getBlogPostStaticParams,
} from "~/lib/publishing";
import { marketingLayout } from "../../_components/layout-primitives";
import { Toc } from "./_components/toc";

export const dynamic = "force-static";

interface Props {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getBlogPostStaticParams();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return getBlogPostPublication(slug)?.metadata ?? {};
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const publication = getBlogPostPublication(slug);
  if (!publication) {
    notFound();
  }

  const MDXContent = publication.body;
  const { answerSummary, description, featuredImage, tldr, title } =
    publication;

  return (
    <main className="bg-background text-foreground">
      <JsonLd code={publication.jsonLd} />

      <section className={`pb-12 md:pb-16 ${marketingLayout.pageTop}`}>
        <div className="space-y-16">
          <div className="space-y-4">
            <h1 className="font-medium font-title text-3xl text-foreground tracking-normal lg:text-4xl">
              {title}
            </h1>
            {description && (
              <p className="text-foreground text-md leading-relaxed">
                {description}
              </p>
            )}
          </div>

          {featuredImage && (
            <div className="w-full">
              <div className="relative aspect-video overflow-hidden rounded-lg bg-card">
                <Image
                  alt={title}
                  className="h-full w-full object-cover"
                  fetchPriority="high"
                  fill
                  preload
                  quality={40}
                  sizes="(max-width: 640px) calc(100vw - 3rem), (max-width: 1024px) calc(100vw - 5rem), 1440px"
                  src={featuredImage}
                />
              </div>
            </div>
          )}

          {tldr && (
            <div className="w-full rounded-xs border bg-background p-8">
              <h2 className="mb-4 font-mono font-semibold text-muted-foreground text-xs uppercase tracking-widest">
                TL;DR
              </h2>
              <p className="text-foreground text-sm leading-relaxed">{tldr}</p>
            </div>
          )}
        </div>
      </section>

      <section className="pt-12 pb-24 md:pb-32">
        <div className="grid grid-cols-1 gap-y-14 lg:grid-cols-12 lg:gap-x-6">
          <aside className="hidden lg:col-span-4 lg:block">
            <Toc items={publication.toc} />
          </aside>

          <article className="max-w-none lg:col-span-7 lg:col-start-5">
            {answerSummary ? (
              <aside className="mb-10 border-border border-l pl-5">
                <h2 className="font-medium text-foreground text-sm">
                  Quick answer
                </h2>
                <p className="mt-3 text-muted-foreground text-sm leading-6">
                  {answerSummary}
                </p>
              </aside>
            ) : null}
            <MDXContent components={markdownComponents} />
          </article>
        </div>
      </section>
    </main>
  );
}
