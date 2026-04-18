import { Separator } from "@repo/ui/components/ui/separator";
import { JsonLd } from "@vendor/seo/json-ld";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { SocialShare } from "~/app/(app)/_components/blog-social-share";
import { mdxComponents } from "~/app/(app)/(content)/_lib/mdx-components";
import { getBlogPage, getBlogPages } from "~/app/(app)/(content)/_lib/source";
import { emitBlogPostSeo } from "~/lib/seo-bundle";
import type { BlogPostUrl } from "~/lib/url-types";

export const dynamic = "force-static";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getBlogPages().map((page) => ({ slug: page.slugs[0] }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = getBlogPage([slug]);
  if (!page) {
    return {};
  }
  const url = `https://lightfast.ai/blog/${slug}` as BlogPostUrl;
  const { metadata } = emitBlogPostSeo(page.data, url);
  return metadata;
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const page = getBlogPage([slug]);
  if (!page) {
    notFound();
  }

  const url = `https://lightfast.ai/blog/${slug}` as BlogPostUrl;
  const { jsonLd } = emitBlogPostSeo(page.data, url);
  const MDXContent = page.data.body;

  const {
    title,
    description,
    authors,
    publishedAt,
    readingTimeMinutes,
    tldr,
    featuredImage,
    category,
  } = page.data;

  return (
    <>
      <JsonLd code={jsonLd} />
      <article className="mx-auto w-full max-w-2xl pt-24 pb-32">
        {/* Breadcrumb */}
        <p className="mb-8 text-muted-foreground text-sm">
          Blog / {category.charAt(0).toUpperCase() + category.slice(1)}
        </p>

        {/* Header */}
        <header className="space-y-6">
          <div className="space-y-4">
            <h1 className="font-medium font-pp text-2xl text-foreground">
              {title}
            </h1>
            {description && (
              <p className="text-muted-foreground text-sm leading-relaxed">
                {description}
              </p>
            )}
          </div>

          {/* Featured image */}
          {featuredImage && (
            <div className="-mx-24 relative aspect-16/9 overflow-hidden rounded-lg bg-card">
              <Image
                alt={title}
                className="h-full w-full object-cover"
                fill
                priority
                src={featuredImage}
              />
            </div>
          )}

          {/* Author + date + reading time */}
          <div className="flex flex-wrap items-center gap-4 text-muted-foreground text-sm">
            {authors.length > 0 && (
              <div className="flex items-center gap-3">
                <div>
                  {authors.map((author, idx) => (
                    <span key={author.name}>
                      {author.url ? (
                        <a
                          className="transition-colors hover:text-foreground"
                          href={author.url}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          {author.name}
                        </a>
                      ) : (
                        author.name
                      )}
                      {idx < authors.length - 1 && ", "}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <span className="text-muted-foreground/50">·</span>
            <time dateTime={publishedAt}>
              {new Date(publishedAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </time>
            <span className="text-muted-foreground/50">·</span>
            <span>{readingTimeMinutes} min read</span>
          </div>

          {/* Social sharing */}
          <Separator className="bg-border/50" />
          <SocialShare
            description={description}
            title={title}
            url={`https://lightfast.ai/blog/${slug}`}
          />
        </header>

        {/* TL;DR */}
        {tldr && (
          <div className="my-8 rounded-xs bg-card p-8">
            <h2 className="mb-4 font-mono font-semibold text-muted-foreground text-xs uppercase tracking-widest">
              TL;DR
            </h2>
            <p className="text-foreground/90 text-sm leading-relaxed">{tldr}</p>
          </div>
        )}

        {/* MDX content */}
        <div className="mt-12 max-w-none">
          <MDXContent components={mdxComponents} />
        </div>
      </article>
    </>
  );
}
