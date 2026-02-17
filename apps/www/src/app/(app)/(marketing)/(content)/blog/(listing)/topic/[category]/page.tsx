import Link from "next/link";
import { type Post, categories as categoriesAPI } from "@vendor/cms";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { JsonLd, type GraphContext } from "@vendor/seo/json-ld";

const categorySEO: Record<
  string,
  {
    metaTitle: string;
    metaDescription: string;
    focusKeyword: string;
    secondaryKeywords: string;
  }
> = {
  company: {
    metaTitle: "Company News - Lightfast Blog",
    metaDescription:
      "Stay updated on Lightfast company news, team updates, and milestones. Learn about our mission to make team knowledge instantly searchable with AI-powered memory.",
    focusKeyword: "team memory",
    secondaryKeywords:
      "organizational knowledge, knowledge management, AI search, company updates, Lightfast news",
  },
  data: {
    metaTitle: "Data & Infrastructure - Lightfast Blog",
    metaDescription:
      "Deep dives into data engineering, vector search, and knowledge graph infrastructure. Learn how Lightfast stores, indexes, and retrieves your team's information at scale.",
    focusKeyword: "vector search",
    secondaryKeywords:
      "knowledge graphs, data infrastructure, embeddings, semantic search, retrieval systems, Pinecone, Redis",
  },
  guides: {
    metaTitle: "Guides & Tutorials - Lightfast Blog",
    metaDescription:
      "Step-by-step guides for getting the most out of Lightfast. Learn how to configure memory stores, integrate with your tools, and search your team's knowledge effectively.",
    focusKeyword: "Lightfast tutorials",
    secondaryKeywords:
      "knowledge base setup, search guides, MCP integration, API documentation, how-to guides",
  },
  technology: {
    metaTitle: "Technology & Engineering - Lightfast Blog",
    metaDescription:
      "Technical deep dives into Lightfast's architecture, AI models, and search algorithms. Explore hybrid retrieval, cross-encoder reranking, and the engineering behind team memory.",
    focusKeyword: "AI architecture",
    secondaryKeywords:
      "retrieval systems, hybrid search, neural search, cross-encoder, technical architecture, engineering blog",
  },
  product: {
    metaTitle: "Product Updates - Lightfast Blog",
    metaDescription:
      "Latest product announcements, feature releases, and roadmap updates from Lightfast. Discover new capabilities for searching and understanding your team's knowledge.",
    focusKeyword: "product updates",
    secondaryKeywords:
      "new features, release notes, changelog, product announcements, Lightfast updates",
  },
};

type Props = {
  params: Promise<{
    category: string;
  }>;
};

export async function generateStaticParams() {
  try {
    const allCategories = await categoriesAPI.getCategories();
    return allCategories.map((category) => ({
      category: category._slug || "",
    }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const seo = categorySEO[category];

  let currentCategory;
  try {
    const allCategories = await categoriesAPI.getCategories();
    currentCategory = allCategories.find(
      (cat) => cat._slug?.toLowerCase() === category.toLowerCase(),
    );
  } catch {
    return { title: seo?.metaTitle || "Blog" };
  }

  if (!seo || !currentCategory) {
    return {
      title: "Category Not Found",
    };
  }

  return {
    title: seo.metaTitle,
    description: seo.metaDescription,
    keywords: [seo.focusKeyword, ...seo.secondaryKeywords.split(", ")],
    openGraph: {
      title: seo.metaTitle,
      description: seo.metaDescription,
      type: "website",
      url: `https://lightfast.ai/blog/topic/${category}`,
      siteName: "Lightfast",
    },
    twitter: {
      card: "summary_large_image",
      title: seo.metaTitle,
      description: seo.metaDescription,
      creator: "@lightfastai",
    },
    alternates: {
      canonical: `https://lightfast.ai/blog/topic/${category}`,
      types: {
        "application/rss+xml": [
          { url: "https://lightfast.ai/blog/rss.xml", title: "RSS 2.0" },
        ],
      },
    },
  };
}

export default async function CategoryPage({ params }: Props) {
  const { category } = await params;

  // Fetch categories from BaseHub
  let allCategories;
  try {
    allCategories = await categoriesAPI.getCategories();
  } catch {
    // CMS unavailable — show empty state with category slug as display name
    return (
      <>
        <div className="space-y-2">
          <div className="bg-card/40 border border-transparent rounded-xs p-4">
            <h2 className="text-sm font-semibold mb-4">
              Temporarily unavailable
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              We&apos;re having trouble loading posts right now. Please try again
              shortly or{" "}
              <Link href="/blog" className="underline">
                view all posts
              </Link>
              .
            </p>
          </div>
        </div>
      </>
    );
  }

  // Find the current category
  const currentCategory = allCategories.find(
    (cat) => cat._slug?.toLowerCase() === category.toLowerCase(),
  );

  // Validate category exists
  if (!currentCategory) {
    notFound();
  }

  const displayName = currentCategory._title || category;

  // TODO: Fetch real posts from CMS
  const allPosts: Post[] = [];

  // Filter posts by category
  const posts = allPosts.filter((post) =>
    post.categories?.some(
      (cat) =>
        cat._title?.toLowerCase() === currentCategory._title?.toLowerCase(),
    ),
  );

  // Structured data for category page
  const structuredData: GraphContext = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://lightfast.ai/#organization",
        name: "Lightfast",
        url: "https://lightfast.ai",
        logo: {
          "@type": "ImageObject",
          url: "https://lightfast.ai/android-chrome-512x512.png",
        },
      },
      {
        "@type": "CollectionPage",
        "@id": `https://lightfast.ai/blog/topic/${category}`,
        name: displayName,
        description: categorySEO[category]?.metaDescription || "",
        url: `https://lightfast.ai/blog/topic/${category}`,
        isPartOf: {
          "@id": "https://lightfast.ai/blog#blog",
        },
      },
    ],
  };

  return (
    <>
      <JsonLd code={structuredData} />

      {/* Posts List */}
      <div className="space-y-2">
        {posts.length === 0 ? (
          <div className="bg-card/40 border border-transparent rounded-xs p-4">
            <h2 className="text-sm font-semibold mb-4">
              No {displayName} posts yet
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              We haven't published any {displayName.toLowerCase()} posts yet.
              Check back soon or{" "}
              <Link href="/blog" className="underline">
                view all posts
              </Link>
              .
            </p>
          </div>
        ) : (
          posts.map((post) => {
            const publishedDate = post.publishedAt
              ? new Date(post.publishedAt)
              : null;
            const dateStr = publishedDate
              ? publishedDate.toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })
              : "";

            // Get primary category
            const primaryCategory = post.categories?.[0]?._title;

            return (
              <article
                key={post._slug ?? post._title}
                className="bg-card border border-transparent rounded-xs p-4 hover:border-border/40 transition-colors"
              >
                <Link
                  href={`/blog/${post.slug || post._slug}`}
                  className="block group"
                >
                  <h2 className="text-md font-base mb-1 group-hover:text-foreground/80 transition-colors">
                    {post._title}
                  </h2>

                  {post.description && (
                    <p className="text-muted-foreground text-md leading-relaxed mb-4">
                      {post.description}
                    </p>
                  )}

                  {/* Metadata */}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {primaryCategory && (
                      <>
                        <span>{primaryCategory}</span>
                        <span>·</span>
                      </>
                    )}
                    <time>{dateStr}</time>
                  </div>
                </Link>
              </article>
            );
          })
        )}
      </div>
    </>
  );
}

