import { SSRCodeBlock } from "@repo/ui/components/ssr-code-block";
import type { Post } from "@vendor/cms";
import { blog } from "@vendor/cms";
import { Body } from "@vendor/cms/components/body";
import { Feed, isDraft } from "@vendor/cms/components/feed";
import type { JsonLdData } from "@vendor/seo/json-ld";
import { JsonLd } from "@vendor/seo/json-ld";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SocialShare } from "~/app/(app)/_components/blog-social-share";

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

interface BlogPostQueryResponse {
  blog?: {
    post?: {
      item?: Post | null;
    } | null;
  } | null;
}

export const revalidate = 300;

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  try {
    const posts = await blog.getPosts();
    return posts
      .filter((post) => !!(post.slug ?? post._slug))
      .map((post) => ({ slug: post.slug ?? post._slug ?? "" }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;

  let post;
  try {
    post = await blog.getPost(slug);
  } catch {
    return {};
  }

  if (!post) {
    return {};
  }

  const description =
    post.description ??
    post.body?.plainText?.slice(0, 160) ??
    `${post._title} - Lightfast blog`;

  const canonicalUrl = `https://lightfast.ai/blog/${slug}`;
  return {
    title: post._title ?? undefined,
    description,
    authors: post.authors?.map((author) => ({
      name: author._title ?? undefined,
    })),
    alternates: {
      canonical: canonicalUrl,
      types: {
        "application/rss+xml": [
          { url: "https://lightfast.ai/blog/rss.xml", title: "RSS 2.0" },
        ],
      },
    },
    openGraph: {
      title: post._title ?? "Blog Post",
      description,
      type: "article",
      url: canonicalUrl,
      siteName: "Lightfast",
      publishedTime: post.publishedAt ?? undefined,
      authors: post.authors
        ?.map((author) => author._title ?? "")
        .filter(Boolean),
    },
    twitter: {
      card: "summary_large_image",
      title: post._title ?? "Blog Post",
      description,
      creator: "@lightfastai",
    },
  } satisfies Metadata;
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;

  return (
    <Feed draft={isDraft} queries={[blog.postQuery(slug)]}>
      {async ([data]) => {
        "use server";

        const response = data as BlogPostQueryResponse;
        const post = response.blog?.post?.item;
        if (!post) {
          notFound();
        }

        const publishedDate = post.publishedAt
          ? new Date(post.publishedAt)
          : null;
        const dateStr = publishedDate
          ? publishedDate.toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          : "";

        // Get category names for schema generation
        const categoryNames = post.categories
          ?.map((c) => c._title?.toLowerCase())
          .filter(Boolean) as string[];

        // Helper function to get additional schema types based on categories

        const getAdditionalSchemas = (): Record<string, unknown>[] => {
          const schemas: Record<string, unknown>[] = [];

          // Add FAQ schema from CMS data
          if (post.seo?.faq?.items && post.seo.faq.items.length > 0) {
            const faqItems = post.seo.faq.items
              .filter((item) => item.question && item.answer)
              .map((item) => ({
                "@type": "Question",
                name: item.question,
                acceptedAnswer: {
                  "@type": "Answer",
                  text: item.answer,
                },
              }));

            if (faqItems.length > 0) {
              schemas.push({
                "@type": "FAQPage",
                mainEntity: faqItems,
              });
            }
          }

          // Add HowTo schema for Data category posts
          if (categoryNames.includes("data")) {
            schemas.push({
              "@type": "HowTo",
              name: post._title ?? "",
              description: post.description ?? "",
              step: [
                {
                  "@type": "HowToStep",
                  name: "Methodology",
                  text:
                    post.description ??
                    post.body?.plainText?.slice(0, 200) ??
                    "",
                },
              ],
            });
          }

          // Add SoftwareSourceCode schema for Technology posts
          if (categoryNames.includes("technology")) {
            schemas.push({
              "@type": "SoftwareSourceCode",
              name: post._title ?? "",
              description: post.description ?? "",
              programmingLanguage: "TypeScript",
              codeRepository: "https://github.com/lightfastai",
            });
          }

          return schemas;
        };

        // Generate structured data for SEO
        const baseStructuredData = {
          "@context": "https://schema.org" as const,
          "@type": "BlogPosting" as const,
          headline: post._title ?? "",
          description:
            post.description ?? post.body?.plainText?.slice(0, 160) ?? "",
          ...(publishedDate
            ? { datePublished: publishedDate.toISOString() }
            : {}),
          url: `https://lightfast.ai/blog/${slug}`,
          ...(post.authors && post.authors.length > 0
            ? {
                author: post.authors.map((author) => ({
                  "@type": "Person" as const,
                  name: author._title ?? "",
                  ...(author.xUrl ? { url: author.xUrl } : {}),
                })),
              }
            : {}),
          ...(post.featuredImage?.url
            ? {
                image: {
                  "@type": "ImageObject" as const,
                  url: post.featuredImage.url,
                  ...(post.featuredImage.width
                    ? { width: post.featuredImage.width }
                    : {}),
                  ...(post.featuredImage.height
                    ? { height: post.featuredImage.height }
                    : {}),
                },
              }
            : {}),
          publisher: {
            "@type": "Organization" as const,
            name: "Lightfast",
            logo: {
              "@type": "ImageObject" as const,
              url: "https://lightfast.ai/android-chrome-512x512.png",
            },
          },
        };

        // Get additional schemas based on category
        const additionalSchemas = getAdditionalSchemas();

        // Combine base schema with additional schemas
        const structuredData =
          additionalSchemas.length > 0
            ? {
                "@context": "https://schema.org",
                "@graph": [baseStructuredData, ...additionalSchemas],
              }
            : baseStructuredData;

        // Get primary category for breadcrumb
        const primaryCategory = post.categories?.[0];

        return (
          <>
            {/* Structured data for SEO */}
            <JsonLd code={structuredData as JsonLdData} />

            <article className="mx-auto w-full max-w-2xl pt-24 pb-32">
              <p className="mb-8 text-muted-foreground text-sm">
                Blog
                {primaryCategory?._title ? (
                  <> / {primaryCategory._title}</>
                ) : null}
              </p>
              {/* Header */}
              <header className="space-y-6">
                <div className="space-y-4">
                  {/* Title */}
                  <h1 className="font-medium font-pp text-2xl text-foreground">
                    {post._title}
                  </h1>

                  {/* Description */}
                  {post.description && (
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {post.description}
                    </p>
                  )}
                </div>

                {/* Author info and metadata */}
                <div className="flex flex-wrap items-center gap-4 text-muted-foreground text-sm">
                  {/* Authors */}
                  {post.authors && post.authors.length > 0 && (
                    <div className="flex items-center gap-3">
                      <div className="flex -space-x-2">
                        {post.authors.map((author, authorIdx) => (
                          <div
                            className="relative"
                            key={`${author._title ?? "author"}-${authorIdx}`}
                          >
                            {author.avatar?.url ? (
                              <Image
                                alt={author._title ?? "Author"}
                                className="rounded-full border-2 border-background"
                                height={32}
                                src={author.avatar.url}
                                width={32}
                              />
                            ) : (
                              <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-muted">
                                <span className="text-muted-foreground text-xs">
                                  {author._title?.charAt(0)}
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      <div>
                        {post.authors.map((author, authorIdx) => (
                          <span key={`author-name-${authorIdx}`}>
                            {author.xUrl ? (
                              <Link
                                className="transition-colors hover:text-foreground"
                                href={author.xUrl}
                                rel="noopener noreferrer"
                                target="_blank"
                              >
                                {author._title}
                              </Link>
                            ) : (
                              author._title
                            )}
                            {authorIdx < (post.authors?.length ?? 0) - 1 &&
                              ", "}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Date */}
                  {dateStr && (
                    <>
                      <span className="text-muted-foreground/50">·</span>
                      <time>{dateStr}</time>
                    </>
                  )}

                  {/* Reading time */}
                  {post.body?.readingTime && (
                    <>
                      <span className="text-muted-foreground/50">·</span>
                      <span>{post.body.readingTime} min read</span>
                    </>
                  )}
                </div>

                {/* Social sharing */}
                <div className="border-t pt-4">
                  <SocialShare
                    description={post.description ?? undefined}
                    title={post._title ?? ""}
                    url={`https://lightfast.ai/blog/${slug}`}
                  />
                </div>
              </header>

              {/* TL;DR Summary for AEO */}
              {post.tldr && (
                <div className="my-8 rounded-xs bg-card p-8">
                  <h2 className="mb-12 font-mono font-semibold text-muted-foreground text-xs uppercase tracking-widest">
                    TL;DR
                  </h2>
                  <p className="text-foreground/90 text-sm leading-relaxed">
                    {post.tldr}
                  </p>
                </div>
              )}

              {/* Featured Image */}
              {post.featuredImage?.url && (
                <div className="relative mt-8 mb-12 aspect-video overflow-hidden rounded-lg">
                  <Image
                    alt={post.featuredImage.alt ?? post._title ?? ""}
                    className="h-full w-full object-cover"
                    height={post.featuredImage.height ?? 630}
                    priority
                    src={post.featuredImage.url}
                    width={post.featuredImage.width ?? 1200}
                  />
                </div>
              )}

              {/* Content */}
              {post.body?.json?.content ? (
                <div className="mt-12 max-w-none">
                  <Body
                    codeBlockComponent={SSRCodeBlock}
                    content={post.body.json.content}
                  />
                </div>
              ) : null}

              {/* Share CTA */}
              <div className="mt-16 rounded-sm bg-card p-6">
                <h3 className="mb-2 font-semibold text-lg">
                  Enjoyed this article?
                </h3>
                <p className="mb-4 text-muted-foreground">
                  Share it with your team to spread the knowledge.
                </p>
                <SocialShare
                  description={post.description ?? undefined}
                  title={post._title ?? ""}
                  url={`https://lightfast.ai/blog/${slug}`}
                />
              </div>

              {/* Author Bios */}
              {post.authors && post.authors.length > 0 && (
                <div className="mt-16 border-t pt-8">
                  <h3 className="mb-6 font-semibold text-muted-foreground text-sm uppercase tracking-wide">
                    About the {post.authors.length > 1 ? "Authors" : "Author"}
                  </h3>
                  <div className="space-y-6">
                    {post.authors.map((author, authorIdx) => (
                      <div
                        className="flex gap-4"
                        key={`${author._title ?? "author-bio"}-${authorIdx}`}
                      >
                        {author.avatar?.url && (
                          <Image
                            alt={author._title ?? "Author"}
                            className="flex-shrink-0 rounded-full"
                            height={48}
                            src={author.avatar.url}
                            width={48}
                          />
                        )}
                        <div>
                          <h4 className="font-semibold text-foreground">
                            {author._title}
                          </h4>
                          {author.xUrl && (
                            <Link
                              className="text-muted-foreground text-sm transition-colors hover:text-foreground"
                              href={author.xUrl}
                              rel="noopener noreferrer"
                              target="_blank"
                            >
                              @{author.xUrl.split("/").pop()}
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </article>
          </>
        );
      }}
    </Feed>
  );
}
