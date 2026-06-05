import { Button } from "@repo/ui/components/ui/button";
import { RssIcon } from "lucide-react";
import { JsonLdScript } from "~/app/(app)/(marketing)/(content)/json-ld-script";
import { NavLink } from "~/components/nav-link";
import {
  buildChangelogIndexJsonLd,
  getChangelogPages,
} from "~/lib/changelog-content";
import { resolveContentAssetSrc } from "~/lib/content-assets";

export default function ChangelogPage() {
  const pages = getChangelogPages();

  const sortedPages = [...pages].sort(
    (a, b) =>
      new Date(b.data.publishedAt).getTime() -
      new Date(a.data.publishedAt).getTime()
  );

  return (
    <div className="mx-auto w-full min-w-0 max-w-2xl pt-24 pb-32">
      <JsonLdScript code={buildChangelogIndexJsonLd()} />
      <div className="mb-12 flex items-center justify-between">
        <h1 className="font-medium font-pp text-3xl text-foreground">
          Changelog
        </h1>
        <NavLink
          className="inline-flex items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground"
          href="/changelog/rss.xml"
          title="Subscribe to RSS Feed"
        >
          <RssIcon className="h-4 w-4" />
          <span>RSS Feed</span>
        </NavLink>
      </div>
      <div className="space-y-12 text-foreground">
        {sortedPages.length === 0 ? (
          <div className="py-16">
            <h2 className="mb-4 font-semibold text-2xl">Stay tuned</h2>
            <p className="text-foreground/80 leading-relaxed">
              We're shipping fast. Changelog entries will appear here after our
              next release.
            </p>
          </div>
        ) : (
          sortedPages.map((page) => (
            <article className="space-y-3" key={page.slugs[0]}>
              <p className="text-muted-foreground text-sm">
                Changelog
                {page.data.version ? <> / {page.data.version}</> : null}
              </p>

              <h2 className="pb-4 font-medium font-pp text-2xl">
                <Button
                  asChild
                  className="h-auto p-0 font-medium font-pp text-2xl"
                  variant="link"
                >
                  <NavLink href={`/changelog/${page.slugs[0]}`}>
                    {page.data.title}
                  </NavLink>
                </Button>
              </h2>

              {page.data.featuredImage && (
                <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-card">
                  <img
                    alt={page.data.title}
                    className="h-full w-full object-cover"
                    height={675}
                    loading="eager"
                    src={resolveContentAssetSrc(page.data.featuredImage)}
                    width={1200}
                  />
                </div>
              )}

              <p className="text-muted-foreground text-sm">
                {page.data.authors[0]?.name ?? "Lightfast"} ·{" "}
                <time dateTime={page.data.publishedAt}>
                  {new Date(page.data.publishedAt).toLocaleDateString(
                    undefined,
                    { year: "numeric", month: "short", day: "numeric" }
                  )}
                </time>
              </p>

              {page.data.description && (
                <p className="pt-4 text-muted-foreground text-sm leading-relaxed">
                  {page.data.description}
                </p>
              )}
            </article>
          ))
        )}
      </div>
    </div>
  );
}
