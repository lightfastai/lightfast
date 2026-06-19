import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getBlogPage,
  getBlogPages,
} from "~/app/(v1)/(content)/_lib/source";
import { createArticleMetadata } from "~/lib/content-seo";
import { Landing } from "./_components/landing";
import { markdownComponents } from "./_components/markdown";
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

  const canonicalUrl = `https://lightfast.ai/v2/blog/${slug}`;

  return createArticleMetadata(
    {
      title: `${page.data.title} | Lightfast`,
      description: page.data.description,
      keywords: page.data.keywords,
      authors: page.data.authors.map((author) => ({
        name: author.name,
        url: author.url,
      })),
      creator: "Lightfast",
      publisher: "Lightfast",
      robots: {
        index: !page.data.noindex,
        follow: !page.data.nofollow,
        googleBot: {
          index: !page.data.noindex,
          follow: !page.data.nofollow,
          "max-video-preview": -1,
          "max-image-preview": "large",
          "max-snippet": -1,
        },
      },
      alternates: { canonical: canonicalUrl },
      openGraph: {
        title: page.data.ogTitle,
        description: page.data.ogDescription,
        url: canonicalUrl,
        siteName: "Lightfast",
        locale: "en_US",
        authors: page.data.authors.map((author) => author.url),
      },
      twitter: {
        card: "summary_large_image",
        title: page.data.ogTitle,
        description: page.data.ogDescription,
        site: "@lightfastai",
        creator: "@lightfastai",
      },
      category: "Technology",
    },
    {
      publishedAt: page.data.publishedAt,
      updatedAt: page.data.updatedAt,
    }
  );
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const page = getBlogPage([slug]);
  if (!page) {
    notFound();
  }

  const MDXContent = page.data.body;
  const { title, description, featuredImage, tldr } = page.data;

  return (
    <main className="bg-background text-foreground">
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
            <MDXContent components={markdownComponents} />
          </article>
        </div>
      </section>
    </main>
  );
}
