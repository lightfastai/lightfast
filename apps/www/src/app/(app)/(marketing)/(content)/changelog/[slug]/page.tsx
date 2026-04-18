import { Button } from "@repo/ui/components/ui/button";
import { Separator } from "@repo/ui/components/ui/separator";
import { JsonLd } from "@vendor/seo/json-ld";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata, Route } from "next";
import nextDynamic from "next/dynamic";
import Image from "next/image";
import { notFound } from "next/navigation";

const ChangelogImprovements = nextDynamic<{ items: string[] }>(() =>
  import("../_components/changelog-improvements").then((m) => ({
    default: m.ChangelogImprovements,
  }))
);

import { mdxComponents } from "~/app/(app)/(content)/_lib/mdx-components";
import {
  getChangelogPage,
  getChangelogPages,
} from "~/app/(app)/(content)/_lib/source";
import { NavLink } from "~/components/nav-link";
import { emitChangelogEntrySeo } from "~/lib/seo-bundle";
import type { ChangelogUrl } from "~/lib/url-types";

export const dynamic = "force-static";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getChangelogPages().map((page) => ({ slug: page.slugs[0] }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = getChangelogPage([slug]);
  if (!page) {
    return {};
  }
  const url = `https://lightfast.ai/changelog/${slug}` as ChangelogUrl;
  const { metadata } = emitChangelogEntrySeo(page.data, url);
  return metadata;
}

export default async function ChangelogEntryPage({ params }: Props) {
  const { slug } = await params;
  const page = getChangelogPage([slug]);
  if (!page) {
    notFound();
  }

  const url = `https://lightfast.ai/changelog/${slug}` as ChangelogUrl;
  const { jsonLd } = emitChangelogEntrySeo(page.data, url);
  const MDXContent = page.data.body;

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
      <JsonLd code={jsonLd} />
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

        <p className="font-mono hidden text-muted-foreground text-xs uppercase tracking-wider">
          {type}
        </p>

        {featuredImage && (
          <div className="-mx-24 relative aspect-16/9 overflow-hidden rounded-lg bg-card">
            <Image
              alt={title}
              className="h-full w-full object-cover"
              fill
              priority
              src={featuredImage}
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
          <p className="pt-4 hidden text-muted-foreground text-sm leading-relaxed">
            {description}
          </p>
        )}

        <div className="mt-8 max-w-none">
          <MDXContent components={mdxComponents} />
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
                href={`/changelog/${prevEntry.slugs[0]}` as Route}
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
                href={`/changelog/${nextEntry.slugs[0]}` as Route}
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
