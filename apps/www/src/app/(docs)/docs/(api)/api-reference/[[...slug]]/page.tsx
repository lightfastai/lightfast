import type {
  Article,
  BreadcrumbList,
  GraphContext,
  Organization,
  WebSite,
} from "@vendor/seo/json-ld";
import { JsonLd } from "@vendor/seo/json-ld";
import { createMetadata } from "@vendor/seo/metadata";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AlphaBanner } from "@/src/app/(docs)/_components/alpha-banner";
import { DocsLayout } from "@/src/app/(docs)/_components/docs-layout";
import { APIPage } from "@/src/app/(docs)/_lib/api-page";
import { mdxComponents } from "@/src/app/(docs)/_lib/mdx-components";
import type { ApiPageType } from "@/src/app/(docs)/_lib/source";
import {
  getApiPage,
  getApiPages,
  isOpenAPIPage,
} from "@/src/app/(docs)/_lib/source";

// ---------------------------------------------------------------------------
// Shared structured-data entities — identical across all API reference pages
// ---------------------------------------------------------------------------

const ORG_ENTITY: Organization = {
  "@type": "Organization",
  "@id": "https://lightfast.ai/#organization",
  name: "Lightfast",
  url: "https://lightfast.ai",
  logo: {
    "@type": "ImageObject",
    url: "https://lightfast.ai/android-chrome-512x512.png",
  },
  sameAs: [
    "https://twitter.com/lightfastai",
    "https://github.com/lightfastai",
    "https://www.linkedin.com/company/lightfastai",
  ],
  description:
    "Lightfast is the operating layer between your agents and apps. Observe events, build memory, and act across your entire tool stack.",
};

const WEBSITE_ENTITY: WebSite = {
  "@type": "WebSite",
  "@id": "https://lightfast.ai/docs#website",
  url: "https://lightfast.ai/docs",
  name: "Lightfast API Reference",
  description:
    "API Reference for Lightfast — REST API and MCP tools documentation",
  publisher: { "@id": "https://lightfast.ai/#organization" },
};

function buildApiRefBreadcrumb(slug: string[]): BreadcrumbList {
  const fullPath = ["api-reference", ...slug];
  return {
    "@type": "BreadcrumbList",
    "@id": `https://lightfast.ai/docs/api-reference/${slug.join("/")}#breadcrumb`,
    itemListElement: fullPath.map((segment, index) => ({
      "@type": "ListItem" as const,
      position: index + 1,
      name: segment
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" "),
      item: `https://lightfast.ai/docs/${fullPath.slice(0, index + 1).join("/")}`,
    })),
  };
}

function buildApiRefArticle(
  slug: string[],
  title: string,
  description: string | undefined
): Article {
  return {
    "@type": "Article",
    "@id": `https://lightfast.ai/docs/api-reference/${slug.join("/")}#article`,
    headline: title,
    description: description ?? "API documentation for Lightfast",
    url: `https://lightfast.ai/docs/api-reference/${slug.join("/")}`,
    author: { "@id": "https://lightfast.ai/#organization" },
    publisher: { "@id": "https://lightfast.ai/#organization" },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://lightfast.ai/docs/api-reference/${slug.join("/")}`,
    },
  };
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

  // OpenAPI virtual page — has getAPIPageProps() from openapiPlugin
  // Note: OpenAPI pages bypass our Zod schema, so ?? fallbacks are needed
  if (isOpenAPIPage(page)) {
    const props = page.data.getAPIPageProps();
    const title = page.data.title ?? "API Reference";
    const structuredData: GraphContext = {
      "@context": "https://schema.org",
      "@graph": [
        ORG_ENTITY,
        WEBSITE_ENTITY,
        buildApiRefBreadcrumb(slug),
        buildApiRefArticle(slug, title, page.data.description),
      ],
    };

    return (
      <>
        <JsonLd code={structuredData} />
        <DocsLayout toc={[]}>
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
  const title = pageData.title;
  const description = pageData.description;

  const structuredData: GraphContext = {
    "@context": "https://schema.org",
    "@graph": [
      ORG_ENTITY,
      WEBSITE_ENTITY,
      buildApiRefBreadcrumb(slug),
      buildApiRefArticle(slug, title, description),
    ],
  };

  return (
    <>
      <JsonLd code={structuredData} />
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
      metadataBase: new URL("https://lightfast.ai/docs"),
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
        canonical: "https://lightfast.ai/docs/docs/api-reference",
      },
      openGraph: {
        title: "API Reference – Lightfast",
        description:
          "Complete API reference for Lightfast. REST endpoints and MCP tools for surfacing decisions across your tools.",
        url: "https://lightfast.ai/docs/docs/api-reference",
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
      metadataBase: new URL("https://lightfast.ai/docs"),
      robots: {
        index: false,
        follow: false,
      },
    });
  }

  // Build canonical URL for SEO
  const pageUrl = `/docs/api-reference/${slug.join("/")}`;
  const title = page.data.title
    ? `${page.data.title} – Lightfast API`
    : "Lightfast API Reference";
  const description =
    page.data.description ?? "API documentation for Lightfast";

  return createMetadata({
    title,
    description,
    metadataBase: new URL("https://lightfast.ai/docs"),
    keywords: [
      "API reference",
      "REST API",
      "MCP tools",
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
      canonical: `https://lightfast.ai/docs${pageUrl}`,
    },
    openGraph: {
      title,
      description,
      url: `https://lightfast.ai/docs${pageUrl}`,
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
