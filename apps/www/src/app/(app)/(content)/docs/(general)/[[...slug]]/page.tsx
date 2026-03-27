import { JsonLd } from "@vendor/seo/json-ld";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { mdxComponents } from "~/app/(app)/(content)/_lib/mdx-components";
import { getPage, getPages } from "~/app/(app)/(content)/_lib/source";
import { DocsLayout } from "~/app/(app)/(content)/docs/_components/docs-layout";
import { DeveloperPlatformLanding } from "~/app/(app)/(content)/docs/(general)/[[...slug]]/_components/developer-platform-landing";
import type { Crumb } from "~/lib/builders";
import { createMetadata } from "~/lib/content-seo";
import { emitDocsSeo } from "~/lib/seo-bundle";
import type { DocsUrl } from "~/lib/url-types";

function toTitleCase(segment: string): string {
  return segment
    .split("-")
    .map((s) => (s[0]?.toUpperCase() ?? "") + s.slice(1))
    .join(" ");
}

function buildDocsBreadcrumbs(slug: string[]): Crumb[] {
  return [
    { name: "Home", url: "https://lightfast.ai" },
    { name: "Docs", url: "https://lightfast.ai/docs" },
    ...slug.map((segment, i) => ({
      name: toTitleCase(segment),
      url: `https://lightfast.ai/docs/${slug.slice(0, i + 1).join("/")}`,
    })),
  ];
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const resolvedParams = await params;

  // Redirect /docs to /docs/get-started/overview
  if (!resolvedParams.slug || resolvedParams.slug.length === 0) {
    redirect("/docs/get-started/overview");
  }

  // TypeScript now knows slug is defined
  const slug = resolvedParams.slug;
  const page = getPage(slug);

  if (!page) {
    return notFound();
  }

  // Show custom landing page for the get-started/overview page
  if (
    slug.length === 2 &&
    slug[0] === "get-started" &&
    slug[1] === "overview"
  ) {
    return <DeveloperPlatformLanding />;
  }

  // Type-safe access using collection type from fumadocs-mdx v14
  // DocsPageType includes runtime properties (body, toc) from DocData
  const pageData = page.data;
  const MDX = pageData.body;
  const toc = pageData.toc;
  const title = pageData.title;
  const description = pageData.description;

  const url = `https://lightfast.ai/docs/${slug.join("/")}` as DocsUrl;
  const { jsonLd } = emitDocsSeo(page.data, url, buildDocsBreadcrumbs(slug));

  return (
    <>
      <JsonLd code={jsonLd} />
      <DocsLayout toc={toc}>
        <article className="max-w-none">
          {/* Page Header */}
          {(title || description) && (
            <div className="mx-auto mb-16 flex w-full max-w-3xl flex-col items-center text-center">
              {title ? (
                <h1 className="text-balance font-light font-pp text-2xl leading-[1.1] tracking-[-0.02em] sm:text-3xl md:text-4xl">
                  {title}
                </h1>
              ) : null}
              {description && (
                <div className="mt-4 w-full">
                  <p className="text-base text-muted-foreground">
                    {description}
                  </p>
                </div>
              )}
            </div>
          )}

          <MDX components={mdxComponents} />
        </article>
      </DocsLayout>
    </>
  );
}

export function generateStaticParams() {
  return getPages().map((page) => ({
    slug: page.slugs,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const resolvedParams = await params;

  // Handle root docs metadata
  if (!resolvedParams.slug || resolvedParams.slug.length === 0) {
    return createMetadata({
      title: "Documentation – Lightfast",
      description:
        "Comprehensive documentation for Lightfast — surface decisions across your tools",
      metadataBase: new URL("https://lightfast.ai"),
      keywords: [
        "Lightfast documentation",
        "decision search",
        "decisions across tools",
        "team decisions",
        "engineering knowledge search",
        "cited answers",
        "semantic search",
        "semantic search docs",
        "answers with sources",
        "developer API",
        "developer API reference",
        "MCP tools",
        "REST API",
        "security best practices",
      ],
      authors: [
        {
          name: "Lightfast",
          url: "https://lightfast.ai",
        },
      ],
      creator: "Lightfast",
      publisher: "Lightfast",
      robots: {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          "max-video-preview": -1,
          "max-image-preview": "large",
          "max-snippet": -1,
        },
      },
      alternates: {
        canonical: "https://lightfast.ai/docs",
      },
      openGraph: {
        title: "Documentation – Lightfast",
        description:
          "Comprehensive documentation for Lightfast — surface decisions across your tools",
        url: "https://lightfast.ai/docs",
        siteName: "Lightfast Documentation",
        type: "website",
        locale: "en_US",
      },
      twitter: {
        card: "summary_large_image",
        title: "Documentation – Lightfast",
        description:
          "Comprehensive documentation for Lightfast — surface decisions across your tools",
        site: "@lightfastai",
        creator: "@lightfastai",
      },
      category: "Technology",
    });
  }

  // TypeScript knows slug is defined after the redirect check
  const slug = resolvedParams.slug;
  const page = getPage(slug);

  // Return 404 metadata for missing pages
  if (!page) {
    return createMetadata({
      title: "Page Not Found – Lightfast Docs",
      description: "The requested documentation page could not be found",
      metadataBase: new URL("https://lightfast.ai"),
      robots: {
        index: false,
        follow: false,
      },
    });
  }

  const url = `https://lightfast.ai/docs/${slug.join("/")}` as DocsUrl;
  const { metadata } = emitDocsSeo(page.data, url, buildDocsBreadcrumbs(slug));
  return metadata;
}
