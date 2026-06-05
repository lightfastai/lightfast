import { Separator } from "@repo/ui/components/ui/separator";
import { SocialShare } from "~/app/(app)/_components/blog-social-share";
import { ContentMarkdown } from "~/app/(app)/(marketing)/(content)/content-markdown";
import { JsonLdScript } from "~/app/(app)/(marketing)/(content)/json-ld-script";
import { type BlogPage, buildBlogPostJsonLd } from "~/lib/blog-content";
import { resolveContentAssetSrc } from "~/lib/content-assets";

export default function BlogPostPage({ page }: { page: BlogPage }) {
  const {
    title,
    description,
    authors,
    publishedAt,
    readingTimeMinutes,
    tldr,
    featuredImage,
    category,
  } = page.data;
  const slug = page.slug;

  return (
    <>
      <JsonLdScript code={buildBlogPostJsonLd(page)} />
      <article className="mx-auto w-full max-w-2xl pt-24 pb-32">
        {/* Breadcrumb */}
        <p className="mb-8 text-muted-foreground text-sm">
          Blog / {category.charAt(0).toUpperCase() + category.slice(1)}
        </p>

        {/* Header */}
        <header className="space-y-6">
          <div className="space-y-4">
            <h1 className="font-medium font-pp text-2xl text-foreground">
              {title}
            </h1>
            {description && (
              <p className="text-muted-foreground text-sm leading-relaxed">
                {description}
              </p>
            )}
          </div>

          {/* Featured image */}
          {featuredImage && (
            <div className="relative aspect-16/9 overflow-hidden rounded-lg bg-card md:-mx-24">
              <img
                alt={title}
                className="h-full w-full object-cover"
                height={675}
                loading="eager"
                src={resolveContentAssetSrc(featuredImage)}
                width={1200}
              />
            </div>
          )}

          {/* Author + date + reading time */}
          <div className="flex flex-wrap items-center gap-4 text-muted-foreground text-sm">
            {authors.length > 0 && (
              <div className="flex items-center gap-3">
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
            <span className="text-muted-foreground/50">·</span>
            <span>{readingTimeMinutes} min read</span>
          </div>

          {/* Social sharing */}
          <Separator className="bg-border/50" />
          <SocialShare
            description={description}
            title={title}
            url={`https://lightfast.ai/blog/${slug}`}
          />
        </header>

        {/* TL;DR */}
        {tldr && (
          <div className="my-8 rounded-xs bg-card p-8">
            <h2 className="mb-4 font-mono font-semibold text-muted-foreground text-xs uppercase tracking-widest">
              TL;DR
            </h2>
            <p className="text-foreground/90 text-sm leading-relaxed">{tldr}</p>
          </div>
        )}

        {/* MDX content */}
        <div className="mt-12 max-w-none">
          <ContentMarkdown body={page.body} />
        </div>
      </article>
    </>
  );
}
