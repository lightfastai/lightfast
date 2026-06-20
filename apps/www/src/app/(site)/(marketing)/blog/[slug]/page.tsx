import { JsonLd } from "@vendor/seo/json-ld";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getBlogPage,
  getBlogPages,
} from "~/lib/content/source";
import { emitBlogPostSeo } from "~/lib/seo-bundle";
import { markdownComponents } from "~/lib/content/markdown";
import type { BlogPostUrl } from "~/lib/url-types";
import { Landing } from "./_components/landing";
import { Toc, type TocItem } from "./_components/toc";

export const dynamic = "force-static";

interface Props {
  params: Promise<{ slug: string }>;
}

const toc: readonly TocItem[] = [
  { title: "The connecting tissue", depth: 2, id: "the-connecting-tissue" },
  {
    title: "Every founder now runs two companies",
    depth: 2,
    id: "every-founder-now-runs-two-companies",
  },
  {
    title: "More tools isn't the answer",
    depth: 2,
    id: "more-tools-isnt-the-answer",
  },
  {
    title: "An operating layer, not another app",
    depth: 2,
    id: "an-operating-layer-not-another-app",
  },
  { title: "What's live today", depth: 2, id: "whats-live-today" },
  {
    title: "Every company is a Program",
    depth: 2,
    id: "every-company-is-a-program",
  },
  {
    title: "We are building the runtime",
    depth: 2,
    id: "we-are-building-the-runtime",
  },
] as const;

export function generateStaticParams() {
  return getBlogPages().map((page) => ({ slug: page.slugs[0] }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = getBlogPage([slug]);
  if (!page) {
    return {};
  }

  const canonicalUrl = `https://lightfast.ai/blog/${slug}` as BlogPostUrl;

  return emitBlogPostSeo(page.data, canonicalUrl).metadata;
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const page = getBlogPage([slug]);
  if (!page) {
    notFound();
  }

  const canonicalUrl = `https://lightfast.ai/blog/${slug}` as BlogPostUrl;
  const MDXContent = page.data.body;
  const { title, description, featuredImage, tldr, answerSummary } = page.data;
  const { jsonLd } = emitBlogPostSeo(page.data, canonicalUrl);

  return (
    <main className="bg-background text-foreground">
      <JsonLd code={jsonLd} />
      <Landing
        description={description}
        featuredImage={featuredImage}
        title={title}
        tldr={tldr}
      />

      <section className="px-6 pt-12 pb-24 sm:px-10 md:pb-32">
        <div className="mx-auto grid max-w-[1960px] grid-cols-1 gap-y-14 lg:grid-cols-12 lg:gap-x-6">
          <aside className="hidden lg:col-span-4 lg:block">
            <Toc items={toc} />
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
