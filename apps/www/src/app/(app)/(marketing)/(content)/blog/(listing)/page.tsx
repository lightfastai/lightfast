import type { PostMeta } from "@vendor/cms";
import { blog } from "@vendor/cms";
import type { BlogPosting, GraphContext } from "@vendor/seo/json-ld";
import { JsonLd } from "@vendor/seo/json-ld";
import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Lightfast Blog – Operating Infrastructure for Agents and Apps",
  description:
    "The Lightfast blog covers operating infrastructure, event-driven architecture, agent tooling, and building the layer between your agents and apps. Product updates, architecture deep dives, and guides.",
  keywords: [
    "operating infrastructure",
    "agent infrastructure",
    "event-driven architecture",
    "AI agents",
    "MCP tools",
    "tool integration",
    "real-time events",
    "semantic search",
    "Lightfast blog",
    "answer engine optimization",
  ],
  openGraph: {
    title: "Lightfast Blog – Operating Infrastructure for Agents and Apps",
    description:
      "Articles on operating infrastructure, event-driven architecture, and agent tooling for engineering and platform teams, plus product updates and deep dives.",
    type: "website",
    url: "https://lightfast.ai/blog",
    siteName: "Lightfast",
  },
  twitter: {
    card: "summary_large_image",
    title: "Lightfast Blog – Operating Infrastructure for Agents and Apps",
    description:
      "Operating infrastructure, event-driven architecture, and agent tooling for engineering and platform teams.",
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
  let posts: PostMeta[] = [];
  try {
    posts = await blog.getPosts();
  } catch {
    // CMS unavailable — render empty state
  }

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
          "Insights on operating infrastructure, event-driven architecture, and agent tooling for engineering teams",
        publisher: {
          "@id": "https://lightfast.ai/#organization",
        },
        blogPost: posts.slice(0, 10).map((post) => {
          const blogPosting: BlogPosting = {
            "@type": "BlogPosting",
            "@id": `https://lightfast.ai/blog/${post.slug}`,
            url: `https://lightfast.ai/blog/${post.slug}`,
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
          <div className="rounded-xs border border-transparent bg-card/40 p-4">
            <h2 className="mb-4 font-semibold text-sm">Coming soon</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
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
            const primaryCategory = post.categories[0]?._title;

            return (
              <article
                className="rounded-xs border border-transparent bg-card p-4 transition-colors hover:border-border/40"
                key={post._slug}
              >
                <Link className="group block" href={`/blog/${post.slug}`}>
                  <h2 className="mb-1 font-base text-md transition-colors group-hover:text-foreground/80">
                    {post._title}
                  </h2>

                  {post.description && (
                    <p className="mb-4 text-md text-muted-foreground leading-relaxed">
                      {post.description}
                    </p>
                  )}

                  {/* Metadata */}
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
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
