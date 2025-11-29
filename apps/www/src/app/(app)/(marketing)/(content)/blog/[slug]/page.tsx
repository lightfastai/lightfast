import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { blog } from "@vendor/cms";
import { Body } from "@vendor/cms/components/body";
import { exposureTrial } from "~/lib/fonts";
import { createMetadata } from "@vendor/seo/metadata";
import { JsonLd, type BlogPosting, type WithContext } from "@vendor/seo/json-ld";
import { createBaseUrl } from "~/lib/base-url";

type Params = { params: Promise<{ slug: string }> };

export const revalidate = 300;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const post = await blog.getPost(slug);
  if (!post) return {};
  const baseUrl = createBaseUrl();
  return createMetadata({
    title: post._title ?? "Blog",
    description: post.description ?? "",
    image: post.image?.url ?? undefined,
    alternates: {
      canonical: `${baseUrl}/blog/${slug}`,
    },
  });
}

export async function generateStaticParams() {
  const posts = await blog.getPosts().catch(() => []);
  return posts
    .filter((p) => !!p._slug)
    .map((p) => ({ slug: p._slug as string }));
}

export default async function BlogPostPage({ params }: Params) {
  const { slug } = await params;
  const post = await blog.getPost(slug);
  if (!post) notFound();

  const blogPostSchema: WithContext<BlogPosting> = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post._title ?? "",
    description: post.description ?? "",
    datePublished: post.date ?? undefined,
    dateModified: post.date ?? undefined,
    image: post.image?.url ?? undefined,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${createBaseUrl()}/blog/${slug}`,
    },
    author: post.authors?.at(0)?._title ?? undefined,
    isAccessibleForFree: true,
  };

  return (
    <div className="text-foreground">
      <JsonLd code={blogPostSchema} />
      <h1 className={`text-5xl font-light leading-tight tracking-[-0.7] mb-6 ${exposureTrial.className}`}>
        {post._title}
      </h1>
      <div className="text-muted-foreground text-sm mb-8">
        {post.date ? new Date(post.date).toLocaleDateString() : null}
        {post.body?.readingTime ? (
          <span className="ml-2">• {post.body.readingTime} min read</span>
        ) : null}
      </div>
      {post.body?.json?.content ? (
        <div className="prose max-w-none">
          <Body content={post.body.json.content} />
        </div>
      ) : null}
    </div>
  );
}
