import { JsonLd } from "@vendor/seo/json-ld";
import type { Metadata, Route } from "next";
import { notFound } from "next/navigation";
import { getBlogPages } from "~/app/(app)/(content)/_lib/source";
import { NavLink } from "~/components/nav-link";
import { BLOG_CATEGORY_META } from "~/config/blog-categories";
import type { BlogCategory } from "~/lib/content-schemas";
import { BlogPostSchema } from "~/lib/content-schemas";
import { emitBlogCategorySeo } from "~/lib/seo-bundle";
import { BlogListingHeader } from "../../_components/blog-listing-header";

export const dynamic = "force-static";
export const dynamicParams = false;

interface Props {
  params: Promise<{ category: string }>;
}

export function generateStaticParams() {
  return BlogPostSchema.shape.category.options.map((category) => ({
    category,
  }));
}

function isBlogCategory(value: string): value is BlogCategory {
  return (BlogPostSchema.shape.category.options as readonly string[]).includes(
    value
  );
}

function getCategoryPages(category: BlogCategory) {
  return getBlogPages()
    .filter((page) => page.data.category === category)
    .sort(
      (a, b) =>
        new Date(b.data.publishedAt).getTime() -
        new Date(a.data.publishedAt).getTime()
    );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  if (!isBlogCategory(category)) {
    return {};
  }
  const meta = BLOG_CATEGORY_META[category];
  const posts = getCategoryPages(category).map((p) => ({
    slug: p.slugs[0] ?? "",
    title: p.data.title,
    description: p.data.description,
    publishedAt: p.data.publishedAt,
    updatedAt: p.data.updatedAt,
  }));
  return emitBlogCategorySeo(meta, posts).metadata;
}

export default async function BlogCategoryPage({ params }: Props) {
  const { category } = await params;
  if (!isBlogCategory(category)) {
    notFound();
  }
  const meta = BLOG_CATEGORY_META[category];
  const pages = getCategoryPages(category);
  const posts = pages.map((p) => ({
    slug: p.slugs[0] ?? "",
    title: p.data.title,
    description: p.data.description,
    publishedAt: p.data.publishedAt,
    updatedAt: p.data.updatedAt,
  }));
  const { jsonLd } = emitBlogCategorySeo(meta, posts);

  return (
    <>
      <JsonLd code={jsonLd} />
      <BlogListingHeader tagline={meta.tagline} title={meta.heading} />

      <div className="space-y-2">
        {pages.length === 0 ? (
          <div className="rounded-xs bg-accent/40 p-4">
            <h2 className="mb-4 font-semibold text-sm">No posts yet</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              We haven't published anything in {meta.title.toLowerCase()} yet.
              Check back soon — or browse{" "}
              <NavLink className="underline" href="/blog">
                all posts
              </NavLink>
              .
            </p>
          </div>
        ) : (
          pages.map((page) => (
            <article
              className="rounded-xs bg-accent/40 p-4 transition-colors hover:bg-accent"
              key={page.slugs[0]}
            >
              <NavLink
                className="block"
                href={`/blog/${page.slugs[0]}` as Route}
              >
                <h2 className="mb-1 font-base text-md">{page.data.title}</h2>
                <p className="mb-4 text-muted-foreground text-sm leading-relaxed">
                  {page.data.description}
                </p>
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <span className="capitalize">{page.data.category}</span>
                  <span>·</span>
                  <time dateTime={page.data.publishedAt}>
                    {new Date(page.data.publishedAt).toLocaleDateString(
                      "en-US",
                      { year: "numeric", month: "short", day: "numeric" }
                    )}
                  </time>
                </div>
              </NavLink>
            </article>
          ))
        )}
      </div>
    </>
  );
}
