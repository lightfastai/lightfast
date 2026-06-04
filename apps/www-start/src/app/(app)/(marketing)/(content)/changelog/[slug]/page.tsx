import { Button } from "@repo/ui/components/ui/button";
import { Separator } from "@repo/ui/components/ui/separator";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ContentMarkdown } from "~/app/(app)/(marketing)/(content)/content-markdown";
import { JsonLdScript } from "~/app/(app)/(marketing)/(content)/json-ld-script";
import { ChangelogImprovements } from "~/app/(app)/(marketing)/(content)/changelog/_components/changelog-improvements";
import {
  buildChangelogEntryJsonLd,
  type ChangelogPage,
  getChangelogPages,
} from "~/lib/changelog-content";
import { NavLink } from "~/components/nav-link";
import { resolveContentAssetSrc } from "~/lib/content-assets";

export default function ChangelogEntryPage({ page }: { page: ChangelogPage }) {
  const {
    title,
    version,
    type,
    publishedAt,
    authors,
    tldr,
    featuredImage,
    description,
    improvements,
  } = page.data;
  const slug = page.slug;

  const allPages = getChangelogPages().sort(
    (a, b) =>
      new Date(b.data.publishedAt).getTime() -
      new Date(a.data.publishedAt).getTime()
  );
  const currentIndex = allPages.findIndex((p) => p.slugs[0] === slug);
  const prevEntry =
    currentIndex < allPages.length - 1 ? allPages[currentIndex + 1] : null;
  const nextEntry = currentIndex > 0 ? allPages[currentIndex - 1] : null;

  return (
    <div className="mx-auto w-full min-w-0 max-w-2xl pt-24 pb-32">
      <JsonLdScript code={buildChangelogEntryJsonLd(page)} />
      <article className="space-y-3">
        <p className="text-muted-foreground text-sm">
          <Button
            asChild
            className="h-auto p-0 text-muted-foreground text-sm hover:text-foreground"
            variant="link"
          >
            <NavLink href="/changelog">Changelog</NavLink>
          </Button>
          {version ? <> / {version}</> : null}
        </p>

        <h2 className="pb-8 font-medium font-pp text-2xl">{title}</h2>

        <p className="hidden font-mono text-muted-foreground text-xs uppercase tracking-wider">
          {type}
        </p>

        {featuredImage && (
          <div className="relative aspect-16/9 overflow-hidden rounded-lg bg-card md:-mx-24">
            <img
              alt={title}
              className="h-full w-full object-cover"
              loading="eager"
              src={resolveContentAssetSrc(featuredImage)}
            />
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-4 text-muted-foreground text-sm">
          {authors.length > 0 && (
            <div>
              {authors.map((author, idx) => (
                <span key={author.name}>
                  {author.url ? (
                    <a
                      className="transition-colors hover:text-foreground"
                      href={author.url}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {author.name}
                    </a>
                  ) : (
                    author.name
                  )}
                  {idx < authors.length - 1 && ", "}
                </span>
              ))}
            </div>
          )}

          <span className="text-muted-foreground/50">·</span>
          <time dateTime={publishedAt}>
            {new Date(publishedAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </time>
        </div>

        <Separator className="mt-4 bg-border/50" />

        {tldr && (
          <div className="my-8 rounded-xs bg-card p-8">
            <h3 className="mb-4 font-mono font-semibold text-muted-foreground text-xs uppercase tracking-widest">
              TL;DR
            </h3>
            <p className="text-foreground/90 text-sm leading-relaxed">{tldr}</p>
          </div>
        )}

        {description && (
          <p className="hidden pt-4 text-muted-foreground text-sm leading-relaxed">
            {description}
          </p>
        )}

        <div className="mt-8 max-w-none">
          <ContentMarkdown body={page.body} />
        </div>

        {improvements && improvements.length > 0 && (
          <div className="mt-12 rounded-lg border border-border/50 px-6">
            <ChangelogImprovements items={improvements} />
          </div>
        )}

        {(prevEntry ?? nextEntry) && (
          <nav
            aria-label="Changelog navigation"
            className="grid grid-cols-1 gap-4 pt-8 md:grid-cols-2"
          >
            {prevEntry ? (
              <NavLink
                className="group"
                href={`/changelog/${prevEntry.slugs[0]}`}
                prefetch
              >
                <div className="h-full rounded-sm border border-transparent bg-card p-4 transition-all duration-200 hover:border-muted-foreground/20 hover:bg-accent/5">
                  <span className="flex items-center gap-1 text-muted-foreground text-sm">
                    <ChevronLeft className="h-4 w-4" />
                    Previous post
                  </span>
                  <span className="mt-1 line-clamp-2 block font-medium text-foreground text-sm">
                    {prevEntry.data.title}
                  </span>
                </div>
              </NavLink>
            ) : (
              <div />
            )}
            {nextEntry ? (
              <NavLink
                className="group md:text-right"
                href={`/changelog/${nextEntry.slugs[0]}`}
                prefetch
              >
                <div className="h-full rounded-sm border border-transparent bg-card p-4 transition-all duration-200 hover:border-muted-foreground/20 hover:bg-accent/5">
                  <span className="flex items-center justify-end gap-1 text-muted-foreground text-sm">
                    Next post
                    <ChevronRight className="h-4 w-4" />
                  </span>
                  <span className="mt-1 line-clamp-2 block font-medium text-foreground text-sm">
                    {nextEntry.data.title}
                  </span>
                </div>
              </NavLink>
            ) : (
              <div />
            )}
          </nav>
        )}
      </article>
    </div>
  );
}
