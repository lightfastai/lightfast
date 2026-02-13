import { getPage, getPages, type DocsPageType } from "@/src/lib/source";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DeveloperPlatformLanding } from "./_components/developer-platform-landing";
import { DocsLayout } from "@/src/components/docs-layout";
import { mdxComponents } from "@/mdx-components";
import { createMetadata } from "@vendor/seo/metadata";
import { JsonLd } from "@vendor/seo/json-ld";
import type {
  GraphContext,
  Organization,
  WebSite,
  TechArticle,
  BreadcrumbList,
} from "@vendor/seo/json-ld";

/**
 * Extended frontmatter SEO fields.
 * These match the schema defined in source.config.ts
 */
interface ExtendedFrontmatter {
  // Base fumadocs fields
  title?: string;
  description?: string;
  // SEO meta fields
  keywords?: string;
  canonical?: string;
  // OpenGraph overrides
  ogImage?: string;
  ogTitle?: string;
  ogDescription?: string;
  // Indexing controls
  noindex?: boolean;
  nofollow?: boolean;
  // Article metadata
  author?: string;
  publishedAt?: string;
  updatedAt?: string;
  // TechArticle fields
  proficiencyLevel?: "Beginner" | "Intermediate" | "Advanced" | "Expert";
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
  const pageData = page.data as DocsPageType;
  const MDX = pageData.body;
  const toc = pageData.toc;
  const frontmatter = pageData;
  const title = frontmatter.title;
  const description = frontmatter.description;

  // Build structured data for SEO
  const organizationEntity: Organization = {
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
      "Lightfast is memory built for teams. We help people and agents find what they need, understand context, and trace decisions across their entire organization.",
  };

  const websiteEntity: WebSite = {
    "@type": "WebSite",
    "@id": "https://lightfast.ai/docs#website",
    url: "https://lightfast.ai/docs",
    name: "Lightfast Documentation",
    description:
      "Documentation for Lightfast neural memory — Learn how to integrate team memory via a simple REST API and MCP tools",
    publisher: {
      "@id": "https://lightfast.ai/#organization",
    },
  };

  // Build breadcrumb list
  const breadcrumbItems = slug.map((segment, index) => {
    const url = `/docs/${slug.slice(0, index + 1).join("/")}`;
    const name = segment
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    return {
      "@type": "ListItem" as const,
      position: index + 1,
      name,
      item: `https://lightfast.ai${url}`,
    };
  });

  const breadcrumbList: BreadcrumbList = {
    "@type": "BreadcrumbList",
    "@id": `https://lightfast.ai/docs/${slug.join("/")}#breadcrumb`,
    itemListElement: breadcrumbItems,
  };

  // Build TechArticle entity for documentation pages
  // TechArticle is better suited for technical documentation than generic Article
  const techArticleEntity: TechArticle = {
    "@type": "TechArticle",
    "@id": `https://lightfast.ai/docs/${slug.join("/")}#article`,
    headline: title ?? "Documentation",
    description: description ?? "Documentation for Lightfast neural memory — Learn how to integrate the memory layer for software teams via a simple REST API and MCP tools. Build search by meaning with sources.",
    url: `https://lightfast.ai/docs/${slug.join("/")}`,
    author: frontmatter.author
      ? { "@type": "Person", name: frontmatter.author }
      : { "@id": "https://lightfast.ai/#organization" },
    publisher: {
      "@id": "https://lightfast.ai/#organization",
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://lightfast.ai/docs/${slug.join("/")}`,
    },
    // TechArticle-specific fields
    proficiencyLevel: frontmatter.proficiencyLevel ?? "Beginner",
    // Add article dates if available in frontmatter
    ...(frontmatter.publishedAt
      ? { datePublished: frontmatter.publishedAt }
      : {}),
    ...(frontmatter.updatedAt ? { dateModified: frontmatter.updatedAt } : {}),
  };

  const structuredData: GraphContext = {
    "@context": "https://schema.org",
    "@graph": [
      organizationEntity,
      websiteEntity,
      breadcrumbList,
      techArticleEntity,
    ],
  };

  return (
    <>
      <JsonLd code={structuredData} />
      <DocsLayout toc={toc}>
        <article className="max-w-none">
          {/* Page Header */}
          {(title !== undefined || description !== undefined) && (
            <div className="flex w-full flex-col items-center text-center mb-16 max-w-3xl mx-auto">
              {title ? (
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-light leading-[1.1] tracking-[-0.02em] text-balance font-[family-name:var(--font-exposure-plus)]">
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
        "Comprehensive documentation for Lightfast - Team memory and neural search for modern teams",
      image: "https://lightfast.ai/og.jpg",
      metadataBase: new URL("https://lightfast.ai/docs"),
      keywords: [
        "Lightfast documentation",
        "memory layer",
        "memory layer for software teams",
        "software team memory",
        "engineering knowledge search",
        "neural memory docs",
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
        canonical: "https://lightfast.ai/docs/docs",
      },
      openGraph: {
        title: "Documentation – Lightfast",
        description:
          "Comprehensive documentation for Lightfast - Team memory and neural search for modern teams",
        url: "https://lightfast.ai/docs/docs",
        siteName: "Lightfast Documentation",
        type: "website",
        locale: "en_US",
        images: [
          {
            url: "https://lightfast.ai/og.jpg",
            width: 1200,
            height: 630,
            alt: "Lightfast Documentation",
            type: "image/jpeg",
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: "Documentation – Lightfast",
        description:
          "Comprehensive documentation for Lightfast - Team memory and neural search for modern teams",
        site: "@lightfastai",
        creator: "@lightfastai",
        images: ["https://lightfast.ai/og.jpg"],
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
      image: "https://lightfast.ai/og.jpg",
      metadataBase: new URL("https://lightfast.ai/docs"),
      robots: {
        index: false,
        follow: false,
      },
    });
  }

  // Cast page.data to include extended frontmatter fields
  const frontmatter = page.data as unknown as ExtendedFrontmatter;

  // Build canonical URL for SEO
  const pageUrl = `/docs/${slug.join("/")}`;
  const title = frontmatter.title
    ? `${frontmatter.title} – Lightfast Docs`
    : "Lightfast Docs";
  const description = frontmatter.description ?? "Documentation for Lightfast neural memory — Learn how to integrate the memory layer for software teams via a simple REST API and MCP tools. Build search by meaning with sources.";

  // Extract per-page SEO fields from extended frontmatter with fallbacks
  const pageKeywords = frontmatter.keywords
    ? frontmatter.keywords.split(",").map((k: string) => k.trim())
    : [];
  const ogImage = frontmatter.ogImage
    ? `https://lightfast.ai${frontmatter.ogImage}`
    : "https://lightfast.ai/og.jpg";
  const canonical = frontmatter.canonical ?? `https://lightfast.ai/docs${pageUrl}`;
  const noindex = frontmatter.noindex ?? false;
  const nofollow = frontmatter.nofollow ?? false;

  // Use ogTitle/ogDescription overrides if provided, otherwise use page title/description
  const ogTitle = frontmatter.ogTitle ?? title;
  const ogDescription = frontmatter.ogDescription ?? description;

  // Enhance the metadata with comprehensive SEO properties
  return createMetadata({
    title,
    description,
    image: ogImage,
    metadataBase: new URL("https://lightfast.ai/docs"),
    // Merge per-page keywords with default docs keywords
    keywords: [
      ...pageKeywords,
      "Lightfast documentation",
      "memory layer",
      "memory layer for software teams",
      "software team memory",
      "engineering knowledge search",
      "neural memory docs",
      "semantic search",
      "semantic search docs",
      "answers with sources",
      "developer API",
      "developer API reference",
      "MCP tools",
      "REST API",
      "security best practices",
    ],
    authors: frontmatter.author
      ? [{ name: frontmatter.author }, { name: "Lightfast", url: "https://lightfast.ai" }]
      : [{ name: "Lightfast", url: "https://lightfast.ai" }],
    creator: "Lightfast",
    publisher: "Lightfast",
    robots: {
      index: !noindex,
      follow: !nofollow,
      googleBot: {
        index: !noindex,
        follow: !nofollow,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    alternates: {
      canonical,
    },
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      url: `https://lightfast.ai/docs${pageUrl}`,
      siteName: "Lightfast Documentation",
      type: "article",
      locale: "en_US",
      // Include article dates for better SEO and freshness signals
      ...(frontmatter.publishedAt
        ? { publishedTime: frontmatter.publishedAt }
        : {}),
      ...(frontmatter.updatedAt ? { modifiedTime: frontmatter.updatedAt } : {}),
      ...(frontmatter.author ? { authors: [frontmatter.author] } : {}),
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: ogTitle,
          type: "image/jpeg",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: ogDescription,
      site: "@lightfastai",
      creator: "@lightfastai",
      images: [ogImage],
    },
    category: "Technology",
  });
}
