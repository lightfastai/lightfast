import type { Metadata } from "next";
import { exposureTrial } from "~/lib/fonts";
import Link from "next/link";
import { blog } from "@vendor/cms";
import { JsonLd } from "@vendor/seo/json-ld";
import { createMetadata } from "@vendor/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Blog",
  description: "Stories, updates, and deep dives from Lightfast.",
  alternates: {
    canonical: "https://lightfast.ai/blog",
  },
});

export const revalidate = 300;

export default async function BlogPage() {
  const posts = await blog.getPosts().catch(() => []);

  return (
    <>
      <JsonLd code={{ "@context": "https://schema.org", "@type": "Blog" }} />
      <h1
        className={`text-6xl font-light leading-[1.2] tracking-[-0.7] text-foreground mb-8 ${exposureTrial.className}`}
      >
        Blog
      </h1>

      <div className="space-y-12 text-foreground">
        {posts.length === 0 ? (
          <article className="border-l-2 border-border pl-8 py-4">
            <time className="text-sm text-muted-foreground">No posts yet</time>
            <h2 className="text-2xl font-semibold mt-2 mb-4">Stay Tuned</h2>
            <p className="text-foreground/80 leading-relaxed">
              We’re publishing engineering deep dives, product updates, and founder
              notes here soon. Subscribe and check back shortly.
            </p>
          </article>
        ) : (
          posts.map((post) => (
            <article key={post._slug} className="border-l-2 border-border pl-8 py-4">
              <time className="text-sm text-muted-foreground">
                {post.date ? new Date(post.date).toLocaleDateString() : ""}
              </time>
              <h2 className="text-2xl font-semibold mt-2 mb-2">
                <Link href={`/blog/${post._slug}`} className="underline decoration-foreground/20 hover:decoration-foreground">
                  {post._title}
                </Link>
              </h2>
              {post.description ? (
                <p className="text-foreground/80 leading-relaxed">{post.description}</p>
              ) : null}
            </article>
          ))
        )}
      </div>
    </>
  );
}
