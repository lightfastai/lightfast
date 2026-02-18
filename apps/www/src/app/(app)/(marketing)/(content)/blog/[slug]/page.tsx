import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { blog  } from "@vendor/cms";
import type {Post} from "@vendor/cms";
import { Body } from "@vendor/cms/components/body";
import { Feed, isDraft } from "@vendor/cms/components/feed";
import { JsonLd } from "@vendor/seo/json-ld";
import type { JsonLdData } from "@vendor/seo/json-ld";
import { SocialShare } from "~/components/blog-social-share";

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
      .map((post) => ({ slug: (post.slug ?? post._slug) ?? "" }));
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

  if (!post) return {};

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
        if (!post) notFound();

        const dateStr = post.publishedAt
          ? new Date(post.publishedAt).toLocaleDateString(undefined, {
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          : "";

        // Get category names for schema generation
        const categoryNames =
          (post.categories
            ?.map((c) => c._title?.toLowerCase())
            .filter(Boolean) as string[]);

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

            <article className="w-full max-w-2xl mx-auto pb-32 pt-24">
              <p className="text-sm text-muted-foreground mb-8">
                Blog
                {primaryCategory?._title ? (
                  <> / {primaryCategory._title}</>
                ) : null}
              </p>
                  {/* Header */}
                  <header className="space-y-6">
                    <div className="space-y-4">
                      {/* Title */}
                      <h1 className="text-2xl font-pp font-medium text-foreground">
                        {post._title}
                      </h1>

                      {/* Description */}
                      {post.description && (
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {post.description}
                        </p>
                      )}
                    </div>

                    {/* Author info and metadata */}
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      {/* Authors */}
                      {post.authors && post.authors.length > 0 && (
                        <div className="flex items-center gap-3">
                          <div className="flex -space-x-2">
                            {post.authors.map((author, authorIdx) => (
                              <div key={`${author._title ?? "author"}-${authorIdx}`} className="relative">
                                {author.avatar?.url ? (
                                  <Image
                                    src={author.avatar.url}
                                    alt={author._title ?? "Author"}
                                    width={32}
                                    height={32}
                                    className="rounded-full border-2 border-background"
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                                    <span className="text-xs text-muted-foreground">
                                      {author._title?.charAt(0)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                          <div>
                            {post.authors.map((author, idx) => (
                              <span key={author._title ?? `author-${idx}`}>
                                {author.xUrl ? (
                                  <Link
                                    href={author.xUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:text-foreground transition-colors"
                                  >
                                    {author._title}
                                  </Link>
                                ) : (
                                  author._title
                                )}
                                {idx < (post.authors?.length ?? 0) - 1 && ", "}
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
                    <div className="pt-4 border-t">
                      <SocialShare
                        title={post._title ?? ""}
                        url={`https://lightfast.ai/blog/${slug}`}
                        description={post.description ?? undefined}
                      />
                    </div>
                  </header>

                  {/* TL;DR Summary for AEO */}
                  {post.tldr && (
                    <div className="bg-card rounded-xs p-8 my-8">
                      <h2 className="text-xs font-semibold text-muted-foreground font-mono uppercase tracking-widest mb-12">
                        TL;DR
                      </h2>
                      <p className="text-foreground/90 text-sm leading-relaxed">
                        {post.tldr}
                      </p>
                    </div>
                  )}

                  {/* Featured Image */}
                  {post.featuredImage?.url && (
                    <div className="relative aspect-video rounded-lg overflow-hidden mt-8 mb-12">
                      <Image
                        src={post.featuredImage.url}
                        alt={post.featuredImage.alt ?? post._title ?? ""}
                        width={post.featuredImage.width ?? 1200}
                        height={post.featuredImage.height ?? 630}
                        className="w-full h-full object-cover"
                        priority
                      />
                    </div>
                  )}

                  {/* Content */}
                  {post.body?.json?.content ? (
                    <div className="max-w-none mt-12">
                      <Body content={post.body.json.content} />
                    </div>
                  ) : null}

                  {/* Share CTA */}
                  <div className="mt-16 p-6 bg-card rounded-sm">
                    <h3 className="text-lg font-semibold mb-2">
                      Enjoyed this article?
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      Share it with your team to spread the knowledge.
                    </p>
                    <SocialShare
                      title={post._title ?? ""}
                      url={`https://lightfast.ai/blog/${slug}`}
                      description={post.description ?? undefined}
                    />
                  </div>

                  {/* Author Bios */}
                  {post.authors && post.authors.length > 0 && (
                    <div className="mt-16 pt-8 border-t">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-6">
                        About the{" "}
                        {post.authors.length > 1 ? "Authors" : "Author"}
                      </h3>
                      <div className="space-y-6">
                        {post.authors.map((author, authorIdx) => (
                          <div key={`${author._title ?? "author-bio"}-${authorIdx}`} className="flex gap-4">
                            {author.avatar?.url && (
                              <Image
                                src={author.avatar.url}
                                alt={author._title ?? "Author"}
                                width={48}
                                height={48}
                                className="rounded-full flex-shrink-0"
                              />
                            )}
                            <div>
                              <h4 className="font-semibold text-foreground">
                                {author._title}
                              </h4>
                              {author.xUrl && (
                                <Link
                                  href={author.xUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
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
