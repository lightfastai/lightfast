import type { Article, GraphContext } from "@vendor/seo/json-ld";
import { JsonLd } from "@vendor/seo/json-ld";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { APIPage } from "~/app/(app)/(content)/_lib/api-page";
import { mdxComponents } from "~/app/(app)/(content)/_lib/mdx-components";
import type { ApiPageType } from "~/app/(app)/(content)/_lib/source";
import {
  getApiPage,
  getApiPages,
  isOpenAPIPage,
} from "~/app/(app)/(content)/_lib/source";
import { AlphaBanner } from "~/app/(app)/(content)/docs/_components/alpha-banner";
import { DocsLayout } from "~/app/(app)/(content)/docs/_components/docs-layout";
import type { Crumb } from "~/lib/builders";
import {
  buildBreadcrumbList,
  buildOrganizationEntity,
  buildWebSiteEntity,
} from "~/lib/builders";
import { createMetadata } from "~/lib/content-seo";
import { emitApiRefSeo } from "~/lib/seo-bundle";
import type { ApiRefUrl } from "~/lib/url-types";

function toTitleCase(segment: string): string {
  return segment
    .split("-")
    .map((s) => (s[0]?.toUpperCase() ?? "") + s.slice(1))
    .join(" ");
}

function buildApiRefBreadcrumbs(slug: string[]): Crumb[] {
  return [
    { name: "Home", url: "https://lightfast.ai" },
    { name: "API Reference", url: "https://lightfast.ai/docs/api-reference" },
    ...slug.map((_, i) => ({
      name: toTitleCase(slug[i]!),
      url: `https://lightfast.ai/docs/api-reference/${slug.slice(0, i + 1).join("/")}`,
    })),
  ];
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const resolvedParams = await params;

  // Redirect /docs/api-reference to /docs/api-reference/getting-started/overview
  if (!resolvedParams.slug || resolvedParams.slug.length === 0) {
    redirect("/docs/api-reference/getting-started/overview");
  }

  // TypeScript now knows slug is defined
  const slug = resolvedParams.slug;
  const page = getApiPage(slug);

  if (!page) {
    return notFound();
  }

  const url =
    `https://lightfast.ai/docs/api-reference/${slug.join("/")}` as ApiRefUrl;
  const breadcrumbs = buildApiRefBreadcrumbs(slug);

  // OpenAPI virtual page — has getAPIPageProps() from openapiPlugin
  // Note: OpenAPI pages bypass our Zod schema, so ?? fallbacks are needed
  if (isOpenAPIPage(page)) {
    const props = page.data.getAPIPageProps();
    const title = page.data.title ?? "API Reference";
    const article: Article = {
      "@type": "Article",
      "@id": `${url}#article`,
      headline: title,
      description: page.data.description ?? "API documentation for Lightfast",
      url,
      author: { "@id": "https://lightfast.ai/#organization" },
      publisher: { "@id": "https://lightfast.ai/#organization" },
    };
    const structuredData: GraphContext = {
      "@context": "https://schema.org",
      "@graph": [
        buildOrganizationEntity(),
        buildWebSiteEntity(),
        buildBreadcrumbList(breadcrumbs),
        article,
      ],
    };

    return (
      <>
        <JsonLd code={structuredData} />
        <DocsLayout fullWidth toc={[]}>
          <AlphaBanner />
          <article className="max-w-none">
            <APIPage {...props} />
          </article>
        </DocsLayout>
      </>
    );
  }

  // Regular MDX page (getting-started, sdks-tools)
  // Type-safe access using collection type from fumadocs-mdx v14
  const pageData = page.data as ApiPageType;
  const MDX = pageData.body;
  const toc = pageData.toc;
  const { jsonLd } = emitApiRefSeo(pageData, url, breadcrumbs);

  return (
    <>
      <JsonLd code={jsonLd} />
      <DocsLayout toc={toc}>
        <AlphaBanner />
        <article className="max-w-none">
          <MDX components={mdxComponents} />
        </article>
      </DocsLayout>
    </>
  );
}

export function generateStaticParams() {
  return getApiPages().map((page) => ({
    slug: page.slugs,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const resolvedParams = await params;

  // Handle root API reference metadata
  if (!resolvedParams.slug || resolvedParams.slug.length === 0) {
    return createMetadata({
      title: "API Reference – Lightfast",
      description:
        "Complete API reference for Lightfast. REST endpoints and MCP tools for surfacing decisions across your tools.",
      metadataBase: new URL("https://lightfast.ai"),
      keywords: [
        "API reference",
        "REST API",
        "MCP tools",
        "developer documentation",
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
        canonical: "https://lightfast.ai/docs/api-reference",
      },
      openGraph: {
        title: "API Reference – Lightfast",
        description:
          "Complete API reference for Lightfast. REST endpoints and MCP tools for surfacing decisions across your tools.",
        url: "https://lightfast.ai/docs/api-reference",
        siteName: "Lightfast Documentation",
        type: "website",
        locale: "en_US",
      },
      twitter: {
        card: "summary_large_image",
        title: "API Reference – Lightfast",
        description:
          "Complete API reference for Lightfast. REST endpoints and MCP tools.",
        site: "@lightfastai",
        creator: "@lightfastai",
      },
      category: "Technology",
    });
  }

  // TypeScript knows slug is defined after the redirect check
  const slug = resolvedParams.slug;
  const page = getApiPage(slug);

  // Return 404 metadata for missing pages
  if (!page) {
    return createMetadata({
      title: "Page Not Found – Lightfast API Reference",
      description: "The requested API documentation page could not be found",
      metadataBase: new URL("https://lightfast.ai"),
      robots: {
        index: false,
        follow: false,
      },
    });
  }

  const url =
    `https://lightfast.ai/docs/api-reference/${slug.join("/")}` as ApiRefUrl;

  // OpenAPI virtual pages — bypass Zod schema, use createMetadata directly
  if (isOpenAPIPage(page)) {
    const title = page.data.title
      ? `${page.data.title} – Lightfast API`
      : "Lightfast API Reference";
    const description =
      page.data.description ?? "API documentation for Lightfast";
    return createMetadata({
      title,
      description,
      metadataBase: new URL("https://lightfast.ai"),
      alternates: {
        canonical: url,
      },
      openGraph: {
        title,
        description,
        url,
        siteName: "Lightfast API Reference",
        type: "article",
        locale: "en_US",
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        site: "@lightfastai",
        creator: "@lightfastai",
      },
      category: "Technology",
    });
  }

  // MDX pages — have full DocsPageData via DocsPageSchema, use SeoBundle
  const pageData = page.data as ApiPageType;
  const { metadata } = emitApiRefSeo(
    pageData,
    url,
    buildApiRefBreadcrumbs(slug)
  );
  return metadata;
}
