import Link from "next/link";
import { type Post } from "@vendor/cms";
import {
  JsonLd,
  type GraphContext,
  type Blog,
  type Organization,
  type WebSite,
  type BlogPosting,
} from "@vendor/seo/json-ld";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Lightfast Blog – Team Memory & Semantic Search",
  description:
    "The Lightfast blog covers team memory, semantic search, and answer-with-sources systems for engineering and platform teams. Find product updates, architecture deep dives, and guides on building reliable organizational memory.",
  keywords: [
    "AI team memory",
    "organizational knowledge management",
    "semantic search",
    "AI search",
    "knowledge graph",
    "team collaboration",
    "decision tracking",
    "context preservation",
    "Lightfast blog",
    "answer engine optimization",
  ],
  openGraph: {
    title: "Lightfast Blog – Team Memory & Semantic Search",
    description:
      "Articles on team memory, semantic search, and answer-with-sources systems for engineering and platform teams, plus product updates and architecture deep dives.",
    type: "website",
    url: "https://lightfast.ai/blog",
    siteName: "Lightfast",
    images: [
      {
        url: "https://lightfast.ai/og.jpg",
        width: 1200,
        height: 630,
        alt: "Lightfast Blog - Team Memory & Semantic Search",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Lightfast Blog – Team Memory & Semantic Search",
    description:
      "Team memory, semantic search, and answer-with-sources content for engineering and platform teams.",
    images: ["https://lightfast.ai/og.jpg"],
    creator: "@lightfastai",
  },
  alternates: {
    canonical: "https://lightfast.ai/blog",
    types: {
      "application/rss+xml": [
        { url: "https://lightfast.ai/blog/rss.xml", title: "RSS 2.0" },
      ],
      "application/atom+xml": [
        { url: "https://lightfast.ai/blog/atom.xml", title: "Atom 1.0" },
      ],
    },
  },
};

export default async function BlogPage() {
  // TODO: Fetch real posts from CMS
  const posts: Post[] = [];

  // Structured data for SEO - using @graph for multiple entities
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
        sameAs: [
          "https://twitter.com/lightfastai",
          "https://github.com/lightfastai",
        ],
      },
      {
        "@type": "WebSite",
        "@id": "https://lightfast.ai/#website",
        url: "https://lightfast.ai",
        name: "Lightfast",
        publisher: {
          "@id": "https://lightfast.ai/#organization",
        },
      },
      {
        "@type": "Blog",
        "@id": "https://lightfast.ai/blog#blog",
        url: "https://lightfast.ai/blog",
        name: "Lightfast Blog",
        description:
          "Insights on AI-powered team memory, semantic search, and organizational knowledge management",
        publisher: {
          "@id": "https://lightfast.ai/#organization",
        },
        blogPost: posts.slice(0, 10).map((post) => {
          const blogPosting: BlogPosting = {
            "@type": "BlogPosting",
            "@id": `https://lightfast.ai/blog/${post.slug || post._slug}`,
            url: `https://lightfast.ai/blog/${post.slug || post._slug}`,
          };

          // Only add properties if they have values
          if (post._title) {
            blogPosting.headline = post._title;
          }
          if (post.description) {
            blogPosting.description = post.description;
          }
          if (post.publishedAt) {
            blogPosting.datePublished = post.publishedAt;
          }

          return blogPosting;
        }),
      },
    ],
  };

  return (
    <>
      <JsonLd code={structuredData} />

      {/* Posts List */}
      <div className="space-y-2">
        {posts.length === 0 ? (
          <div className="bg-card border border-transparent rounded-xs p-6">
            <h2 className="text-lg font-semibold mb-4">Coming soon</h2>
            <p className="text-muted-foreground leading-relaxed">
              We're preparing news and updates about Lightfast. Check back soon
              for product announcements, feature releases, and insights from the
              Lightfast team.
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
