import { JsonLdScript } from "~/app/(app)/(marketing)/(content)/json-ld-script";
import { NavLink } from "~/components/nav-link";
import {
  BLOG_CATEGORY_META,
  buildBlogCategoryJsonLd,
  getCategoryPages,
} from "~/lib/blog-content";
import type { BlogCategory } from "~/lib/content-schemas";
import { BlogListingHeader } from "../../_components/blog-listing-header";

export default function BlogCategoryPage({
  category,
}: {
  category: BlogCategory;
}) {
  const meta = BLOG_CATEGORY_META[category];
  const pages = getCategoryPages(category);

  return (
    <>
      <JsonLdScript code={buildBlogCategoryJsonLd(category)} />
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
                href={`/blog/${page.slugs[0]}`}
              >
                <h2 className="mb-1 font-base text-base">{page.data.title}</h2>
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
