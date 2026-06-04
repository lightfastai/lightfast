import { Button } from "@repo/ui/components/ui/button";
import { NavLink } from "~/components/nav-link";
import { JsonLdScript } from "~/app/(app)/(marketing)/(content)/json-ld-script";
import { buildBlogIndexJsonLd, getBlogPages } from "~/lib/blog-content";
import { resolveContentAssetSrc } from "~/lib/content-assets";
import { BlogListingHeader } from "./_components/blog-listing-header";

export default function BlogPage() {
  const pages = getBlogPages();

  const sortedPages = [...pages].sort(
    (a, b) =>
      new Date(b.data.publishedAt).getTime() -
      new Date(a.data.publishedAt).getTime()
  );

  const [latest, ...restPages] = sortedPages;
  const featured = latest?.data.featuredImage ? latest : null;
  const listPages = featured ? restPages : sortedPages;

  return (
    <>
      <JsonLdScript code={buildBlogIndexJsonLd()} />
      <BlogListingHeader title="Blog" />
      {featured?.data.featuredImage && (
        <article className="mb-12" key={featured.slugs[0]}>
          <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-card">
            <img
              alt={featured.data.title}
              className="h-full w-full object-cover"
              loading="eager"
              src={resolveContentAssetSrc(featured.data.featuredImage)}
            />
          </div>
          <h2 className="mt-6 font-medium font-pp text-2xl">
            <Button
              asChild
              className="h-auto p-0 font-medium font-pp text-2xl"
              variant="link"
            >
              <NavLink href={`/blog/${featured.slugs[0]}`}>{featured.data.title}</NavLink>
            </Button>
          </h2>
          <p className="mt-2 text-muted-foreground text-sm">
            <time dateTime={featured.data.publishedAt}>
              {new Date(featured.data.publishedAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </time>
          </p>
        </article>
      )}
      <div className="space-y-2">
        {sortedPages.length === 0 ? (
          <div className="rounded-xs bg-accent/40 p-4">
            <h2 className="mb-4 font-semibold text-sm">Coming soon</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              We're preparing news and updates about Lightfast. Check back soon
              for product announcements, feature releases, and insights from the
              Lightfast team.
            </p>
          </div>
        ) : (
          listPages.map((page) => (
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
